import os
import re
from decimal import Decimal
from django.db import models, transaction
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission

from ..bookings.models import Booking
from ..users.models import log_action
from .models import Payment, Invoice, PaymentConfig
from .serializers import PaymentSerializer, PaymentConfigSerializer

class IsAdminOrOwnerUser(BasePermission):
    """
    Chỉ cho phép tài khoản có quyền Admin Hệ Thống hoặc Chủ Khách Sạn (Owner) truy cập để sửa đổi cấu hình tài khoản thụ hưởng ngân hàng.
    Quản lý (Manager) chỉ có quyền Xem (GET), không được phép sửa đổi (PUT / PATCH).
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        allowed_roles = ['admin', 'owner']
        return getattr(request.user, 'role', None) in allowed_roles

class ConfirmPaymentView(APIView):
    """
    API endpoint: POST /api/payments/confirm/
    Xác nhận thanh toán chuyển khoản VietQR cho đơn đặt phòng.
    Payload:
    - booking_id: ID hoặc booking_code của đơn đặt phòng
    - amount: Số tiền thanh toán (bắt buộc phải khớp với total_amount)
    - payment_method: Phương thức (mặc định 'TRANSFER')
    """
    permission_classes = [AllowAny]

    def post(self, request):
        booking_id = request.data.get('booking_id')
        amount = request.data.get('amount')
        payment_method = request.data.get('payment_method', 'TRANSFER')

        # 1. Kiểm tra đầu vào bắt buộc
        if not booking_id:
            return Response(
                {
                    "success": False,
                    "message": "Vui lòng cung cấp booking_id."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if amount is None:
            return Response(
                {
                    "success": False,
                    "message": "Vui lòng cung cấp số tiền thanh toán (amount)."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Lấy Booking theo ID hoặc booking_code
        try:
            if isinstance(booking_id, int) or (isinstance(booking_id, str) and booking_id.isdigit()):
                booking = Booking.objects.get(id=int(booking_id))
            else:
                booking = Booking.objects.get(booking_code=str(booking_id))
        except Booking.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "message": f"Không tìm thấy đơn đặt phòng với ID '{booking_id}'."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Tính toán chi phí lưu trú và số tiền còn lại cần thanh toán
        try:
            amount_dec = Decimal(str(amount))
        except (ValueError, TypeError):
            return Response(
                {
                    "success": False,
                    "message": "Số tiền truyền lên không đúng định dạng số hợp lệ."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if amount_dec <= Decimal('0'):
            return Response(
                {
                    "success": False,
                    "message": "Số tiền thanh toán phải lớn hơn 0 VND."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Tính toán tiền phòng
        room_charge = Decimal(str(booking.total_amount or 0))

        # Tính toán tiền dịch vụ hoàn thành phát sinh
        completed_requests = booking.service_requests.filter(status='completed').select_related('service')
        service_charge = Decimal(str(sum(
            (req.total_price or ((req.service.price if req.service else 0) * req.quantity))
            for req in completed_requests
        )))

        for bes in booking.extra_services.all():
            raw_name = (bes.service_name or '').strip()
            if not re.search(r'\[Yêu cầu #\d+\]', raw_name, re.IGNORECASE):
                service_charge += Decimal(str((bes.price or 0) * (bes.quantity or 1)))

        grand_total = room_charge + service_charge

        # Số tiền đã thanh toán trước đó (COMPLETED payments)
        paid_amount = Decimal('0')
        if hasattr(booking, 'payments'):
            completed_payments = booking.payments.filter(payment_status='COMPLETED')
            if completed_payments.exists():
                paid_amount = sum(Decimal(str(p.amount)) for p in completed_payments)
        if paid_amount <= Decimal('0'):
            if booking.status in ['paid', 'PAID'] or (hasattr(booking, 'invoice') and booking.invoice and booking.invoice.status == 'paid'):
                paid_amount = room_charge
            elif booking.note and ('vietqr: đã thanh toán' in booking.note.lower() or 'đã thanh toán thành công' in booking.note.lower()):
                paid_amount = room_charge

        remaining_balance = max(Decimal('0'), grand_total - paid_amount)

        # Kiểm tra vai trò: Nhân viên Lễ tân / Quản lý / Thu ngân hoặc thanh toán tiền mặt tại quầy
        is_staff = bool(
            request.user and request.user.is_authenticated and (
                request.user.is_staff or 
                request.user.is_superuser or 
                getattr(request.user, 'role', '') in ['admin', 'owner', 'manager', 'receptionist', 'cashier']
            )
        )
        is_cash_payment = str(payment_method).upper() == 'CASH'

        # Nếu là khách hàng tự thanh toán trực tuyến:
        # Số tiền thanh toán không được nhỏ hơn số tiền còn lại cần thanh toán (remaining_balance)
        # Dung sai 1,000 VND để tránh lỗi làm tròn số học
        if not is_staff and not is_cash_payment:
            target_required = remaining_balance if remaining_balance > Decimal('0') else room_charge
            if amount_dec < (target_required - Decimal('1000')):
                return Response(
                    {
                        "success": False,
                        "message": f"Số tiền thanh toán ({amount_dec:,.0f} VND) không đủ so với số tiền cần thanh toán ({target_required:,.0f} VND)."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Kiểm tra trạng thái đơn: Không cho phép thanh toán đơn đã hủy hoặc khách không đến
        if booking.status in ['cancelled', 'no_show']:
            return Response(
                {
                    "success": False,
                    "message": f"Đơn đặt phòng {booking.booking_code} đang ở trạng thái '{booking.get_status_display()}', không thể thực hiện thanh toán."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 4. Bọc trong Transaction Atomic: Đảm bảo Payment được lưu thành công thì mới update Booking
        with transaction.atomic():
            # Khóa bi quan (Pessimistic Lock) bản ghi booking để tuần tự hóa các request thanh toán spam click cùng 1 đơn
            booking = Booking.objects.select_for_update().get(pk=booking.pk)

            # 4.1 Kiểm tra chống trùng giao dịch kép trong 30 giây (Idempotency check)
            thirty_seconds_ago = timezone.now() - timezone.timedelta(seconds=30)
            recent_duplicate = Payment.objects.filter(
                booking=booking,
                amount=amount_dec,
                payment_status='COMPLETED',
                created_at__gte=thirty_seconds_ago
            ).first()

            if recent_duplicate:
                serializer = PaymentSerializer(recent_duplicate)
                return Response(
                    {
                        "success": True,
                        "message": f"Giao dịch thanh toán {amount_dec:,.0f} VND cho đơn {booking.booking_code} đã được ghi nhận trước đó ({recent_duplicate.transaction_id}).",
                        "data": serializer.data
                    },
                    status=status.HTTP_200_OK
                )

            # 4.2 Cập nhật bản ghi Payment PENDING nếu có khớp số tiền, hoặc tạo mới bản ghi COMPLETED
            pending_payment = Payment.objects.filter(
                booking=booking,
                payment_status='PENDING',
                amount=amount_dec
            ).first()

            if pending_payment:
                pending_payment.payment_method = payment_method or 'TRANSFER'
                pending_payment.payment_status = 'COMPLETED'
                pending_payment.save(update_fields=['payment_method', 'payment_status'])
                payment = pending_payment
            else:
                payment = Payment.objects.create(
                    booking=booking,
                    amount=amount_dec,
                    payment_method=payment_method or 'TRANSFER',
                    payment_status='COMPLETED'
                )

            # 4.3 Cập nhật hóa đơn nếu có
            try:
                invoice = getattr(booking, 'invoice', None)
                if invoice:
                    invoice.status = 'paid'
                    invoice.payment_method = 'bank_transfer'
                    invoice.paid_at = timezone.now()
                    invoice.save()
            except Exception:
                pass

            # 4.4 Sau khi Payment đã tạo thành công 100%: Cập nhật bảng Booking
            if booking.status == 'pending':
                booking.status = 'paid'
            note_str = (booking.note or '').strip()
            method_label = 'Tiền mặt' if str(payment_method).upper() == 'CASH' else 'VietQR'
            pay_note = f"{method_label}: Đã thanh toán ({amount_dec:,.0f} VND)"
            if pay_note not in note_str:
                booking.note = f"{note_str} | {pay_note}" if note_str else pay_note
            booking.save(update_fields=['status', 'note'])

        # Ghi nhận Nhật ký thao tác hệ thống (Audit Log)
        acting_user = request.user if (request.user and request.user.is_authenticated) else getattr(booking, 'guest', None)
        log_action(
            user=acting_user,
            action='CREATE',
            module='INVOICE',
            description=f"Ghi nhận thanh toán {amount_dec:,.0f} VND ({payment_method}) cho đơn #{booking.booking_code}",
            request=request
        )

        serializer = PaymentSerializer(payment)
        return Response(
            {
                "success": True,
                "message": f"Xác nhận thanh toán cho đơn {booking.booking_code} thành công!",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )


class PaymentListView(APIView):
    """
    API endpoint: GET /api/payments/
    Lấy danh sách các giao dịch thanh toán:
    - Quản lý / Lễ tân / Thu ngân: xem toàn bộ giao dịch
    - Khách hàng: chỉ xem giao dịch của chính mình
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        is_staff_or_admin = (
            user.is_staff or 
            user.is_superuser or 
            getattr(user, 'role', '') in ['admin', 'owner', 'manager', 'receptionist', 'cashier']
        )

        # 1. Tự động đồng bộ các Hóa đơn (Invoices) nếu là nhân viên
        if is_staff_or_admin:
            invoices = Invoice.objects.select_related('booking').all()
            for inv in invoices:
                booking = inv.booking
                if booking and not Payment.objects.filter(booking=booking).exists():
                    method_code = 'TRANSFER' if str(inv.payment_method).lower() in ['bank_transfer', 'momo', 'transfer', 'vietqr', 'credit_card'] else 'CASH'
                    status_code = 'COMPLETED' if inv.status == 'paid' else ('FAILED' if inv.status == 'cancelled' else 'PENDING')
                    Payment.objects.create(
                        booking=booking,
                        amount=inv.total_amount,
                        payment_method=method_code,
                        payment_status=status_code,
                        transaction_id=f"TXN-{inv.invoice_code.replace('INV-', '')}"
                    )

            # 2. Đồng bộ thêm các booking đã thanh toán hợp lệ mà chưa có payment
            paid_bookings = Booking.objects.filter(
                models.Q(status__in=['completed', 'checked_out', 'paid', 'PAID']) |
                models.Q(note__icontains='VietQR: Đã thanh toán') |
                models.Q(note__icontains='đã thanh toán thành công')
            ).exclude(status__in=['cancelled', 'no_show']).exclude(payments__isnull=False)

            for b in paid_bookings:
                note_lower = (b.note or '').lower()
                method_code = 'TRANSFER' if ('vietqr' in note_lower or 'chuyển khoản' in note_lower or 'transfer' in note_lower) else 'CASH'
                Payment.objects.create(
                    booking=b,
                    amount=b.total_amount or 0,
                    payment_method=method_code,
                    payment_status='COMPLETED',
                    transaction_id=f"TXN-{b.booking_code.replace('BK-', '')}"
                )

        queryset = Payment.objects.select_related('booking', 'booking__guest', 'booking__room', 'booking__category').all().order_by('-created_at')

        # Khách hàng chỉ xem giao dịch của chính mình
        if not is_staff_or_admin:
            queryset = queryset.filter(booking__guest=user)

        # Lọc trạng thái
        payment_status = request.query_params.get('status')
        if payment_status and payment_status != 'ALL':
            queryset = queryset.filter(payment_status=payment_status)

        # Tìm kiếm từ khóa
        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                models.Q(booking__booking_code__icontains=search) |
                models.Q(booking__guest__first_name__icontains=search) |
                models.Q(booking__guest__last_name__icontains=search) |
                models.Q(booking__guest__username__icontains=search) |
                models.Q(transaction_id__icontains=search)
            )

        serializer = PaymentSerializer(queryset, many=True)
        return Response({
            "success": True,
            "count": queryset.count(),
            "results": serializer.data
        }, status=status.HTTP_200_OK)


class PaymentConfigView(APIView):
    """
    API endpoint: /api/payments/config/
    - GET (Public): Lấy bản ghi cấu hình VietQR đầu tiên. Nếu chưa có, tự động tạo cấu hình mặc định.
    - PUT / PATCH (Admin Only): Cập nhật thông tin tài khoản ngân hàng thụ hưởng VietQR.
    """
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated(), IsAdminOrOwnerUser()]

    def get(self, request):
        config = PaymentConfig.get_solo()
        serializer = PaymentConfigSerializer(config)
        return Response({
            "success": True,
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    def put(self, request):
        config = PaymentConfig.get_solo()
        serializer = PaymentConfigSerializer(config, data=request.data, partial=False)
        if serializer.is_valid():
            cfg = serializer.save()
            log_action(
                user=request.user,
                action='UPDATE',
                module='SYSTEM',
                description=f"Cập nhật cấu hình thụ hưởng VietQR ({cfg.bank_id} - STK: {cfg.account_no} - {cfg.account_name})",
                request=request
            )
            return Response({
                "success": True,
                "message": "Cập nhật cấu hình thanh toán VietQR thành công!",
                "data": serializer.data
            }, status=status.HTTP_200_OK)
        return Response({
            "success": False,
            "message": "Dữ liệu cấu hình không hợp lệ.",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        config = PaymentConfig.get_solo()
        serializer = PaymentConfigSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            cfg = serializer.save()
            log_action(
                user=request.user,
                action='UPDATE',
                module='SYSTEM',
                description=f"Cập nhật cấu hình thụ hưởng VietQR ({cfg.bank_id} - STK: {cfg.account_no} - {cfg.account_name})",
                request=request
            )
            return Response({
                "success": True,
                "message": "Cập nhật cấu hình thanh toán VietQR thành công!",
                "data": serializer.data
            }, status=status.HTTP_200_OK)
        return Response({
            "success": False,
            "message": "Dữ liệu cấu hình không hợp lệ.",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class PaymentStatusView(APIView):
    """
    API endpoint: GET /api/payments/<booking_id>/status/
    Kiểm tra trạng thái thanh toán của đơn đặt phòng phục vụ Long Polling từ Frontend.
    Hỗ trợ booking_id là ID (số) hoặc booking_code (chuỗi).
    Trả về {"status": "COMPLETED"} hoặc {"status": "PENDING"}.
    """
    permission_classes = [AllowAny]

    def get(self, request, booking_id):
        # 1. Tra cứu booking theo ID số hoặc booking_code
        try:
            if str(booking_id).isdigit():
                booking = Booking.objects.get(id=int(booking_id))
            else:
                booking = Booking.objects.get(booking_code=str(booking_id))
        except Booking.DoesNotExist:
            return Response(
                {
                    "status": "NOT_FOUND",
                    "message": f"Không tìm thấy đơn đặt phòng với ID '{booking_id}'."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # 2. Kiểm tra trạng thái thanh toán:
        has_completed_payment = Payment.objects.filter(booking=booking, payment_status='COMPLETED').exists()
        is_invoice_paid = hasattr(booking, 'invoice') and booking.invoice.status == 'paid'
        is_booking_paid = booking.status in ['paid', 'confirmed', 'completed', 'checked_in']

        if has_completed_payment or is_invoice_paid or is_booking_paid:
            return Response({
                "status": "COMPLETED",
                "booking_code": booking.booking_code,
                "booking_id": booking.id
            }, status=status.HTTP_200_OK)

        return Response({
            "status": "PENDING",
            "booking_code": booking.booking_code,
            "booking_id": booking.id
        }, status=status.HTTP_200_OK)


class SepayWebhookView(APIView):
    """
    API endpoint: POST /api/payments/webhook/sepay/
    Nhận Webhook từ SePay khi có biến động số dư chuyển khoản VietQR thành công.
    Tự động cập nhật trạng thái đơn đặt phòng sang COMPLETED.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        # 1. Xác thực API Key từ SePay (nếu có cấu hình SEPAY_WEBHOOK_SECRET)
        secret = os.getenv('SEPAY_WEBHOOK_SECRET', '').strip().strip('"').strip("'")
        auth_header = request.headers.get('Authorization', '')
        
        if secret and auth_header:
            token = auth_header.replace('Apikey', '').strip()
            if token != secret:
                return Response(
                    {"success": False, "message": "Sai API Key xác thực SePay."},
                    status=status.HTTP_401_UNAUTHORIZED
                )

        data = request.data
        transfer_type = data.get('transferType', 'in')
        if transfer_type and str(transfer_type).lower() != 'in':
            return Response({"success": True, "message": "Bỏ qua giao dịch không phải tiền vào."}, status=status.HTTP_200_OK)

        content = str(data.get('content', '') or data.get('description', ''))
        amount_val = data.get('transferAmount') or data.get('amount')
        sepay_id = data.get('id', '')
        reference_code = data.get('referenceCode', '')

        # 2. Tìm mã đơn booking_code trong nội dung chuyển khoản bằng Regex
        # Hỗ trợ mọi biến thể ngân hàng: có gạch ngang (BK-DA5F79) hoặc bị nuốt gạch ngang (BKDA5F79, BKDA5F79-)
        booking = None
        match = re.search(r'BK-?([A-Za-z0-9]{4,10})', content, re.IGNORECASE)
        if match:
            clean_suffix = match.group(1).upper()
            # 2.1 Thử tìm theo định dạng chuẩn BK-XXXXXX
            booking = Booking.objects.filter(booking_code__iexact=f"BK-{clean_suffix}").first()
            if not booking:
                # 2.2 Thử tìm theo chuỗi con suffix
                booking = Booking.objects.filter(booking_code__icontains=clean_suffix).first()

        # Fallback: nếu không thấy BK-xxx, thử tìm theo ID số trong content
        if not booking:
            id_match = re.search(r'\b(\d{1,6})\b', content)
            if id_match:
                booking = Booking.objects.filter(id=int(id_match.group(1))).first()

        if not booking:
            return Response(
                {"success": False, "message": f"Không tìm thấy đơn đặt phòng từ nội dung: '{content}'"},
                status=status.HTTP_200_OK
            )

        # 3. Chuyển đổi số tiền
        try:
            transfer_amount = Decimal(str(amount_val or 0))
        except (ValueError, TypeError):
            transfer_amount = Decimal('0')

        # 4. Cập nhật thanh toán và trạng thái Booking trong Database
        with transaction.atomic():
            booking = Booking.objects.select_for_update().get(pk=booking.pk)

            txn_id = f"SEPAY-{sepay_id}" if sepay_id else (f"SEPAY-{reference_code}" if reference_code else None)
            defaults = {
                'booking': booking,
                'amount': transfer_amount or booking.total_amount,
                'payment_method': 'TRANSFER',
                'payment_status': 'COMPLETED'
            }

            if txn_id:
                payment, _ = Payment.objects.update_or_create(
                    transaction_id=txn_id,
                    defaults=defaults
                )
            else:
                payment = Payment.objects.create(**defaults)

            # Cập nhật hóa đơn
            if hasattr(booking, 'invoice') and booking.invoice:
                invoice = booking.invoice
                invoice.status = 'paid'
                invoice.payment_method = 'bank_transfer'
                invoice.paid_at = timezone.now()
                invoice.save()

            # Cập nhật đơn đặt phòng sang paid
            if booking.status in ['pending', 'unconfirmed']:
                booking.status = 'paid'
            note_str = (booking.note or '').strip()
            if 'SePay VietQR' not in note_str:
                booking.note = f"{note_str} | SePay VietQR Auto ({transfer_amount:,.0f} VND)" if note_str else f"SePay VietQR Auto ({transfer_amount:,.0f} VND)"
            booking.save(update_fields=['status', 'note'])

        log_action(
            user=getattr(booking, 'guest', None),
            action='UPDATE',
            module='PAYMENT',
            description=f"SePay Webhook tự động xác nhận thanh toán {transfer_amount:,.0f} VND cho đơn {booking.booking_code}",
            request=request
        )

        return Response({
            "success": True,
            "message": f"Đã cập nhật trạng thái COMPLETED cho đơn {booking.booking_code} thành công!",
            "booking_code": booking.booking_code
        }, status=status.HTTP_200_OK)


