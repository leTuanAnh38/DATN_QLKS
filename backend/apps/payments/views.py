import os
import re
from decimal import Decimal
from django.db import models, transaction
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from ..bookings.models import Booking, GroupBooking, HotelSetting
from ..bookings.email_service import send_booking_email_async, send_group_booking_email_async
from ..users.models import log_action
from ..users.views import check_role_permission
from .models import Payment, Invoice, PaymentConfig, CashierShift, CashOutVoucher
from .serializers import PaymentSerializer, PaymentConfigSerializer, CashierShiftSerializer, CashOutVoucherSerializer

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

        # 2. Lấy Booking hoặc GroupBooking theo ID / Code
        from ..bookings.models import GroupBooking
        booking = None
        group_booking = None

        if str(booking_id).upper().startswith('GRP-'):
            group_booking = GroupBooking.objects.filter(group_code__iexact=str(booking_id).strip()).first()

        if not group_booking:
            try:
                if isinstance(booking_id, int) or (isinstance(booking_id, str) and booking_id.isdigit()):
                    booking = Booking.objects.get(id=int(booking_id))
                else:
                    booking = Booking.objects.get(booking_code=str(booking_id))
            except Booking.DoesNotExist:
                group_booking = GroupBooking.objects.filter(group_code__iexact=str(booking_id).strip()).first()

        if not booking and not group_booking:
            return Response(
                {
                    "success": False,
                    "message": f"Không tìm thấy đơn đặt phòng hoặc đơn đoàn với mã '{booking_id}'."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if group_booking:
            try:
                amount_dec = Decimal(str(amount))
            except (ValueError, TypeError):
                amount_dec = group_booking.deposit_amount or group_booking.total_amount

            with transaction.atomic():
                group_booking = GroupBooking.objects.select_for_update().get(pk=group_booking.pk)
                payment, _ = Payment.objects.update_or_create(
                    group_booking=group_booking,
                    defaults={
                        'amount': amount_dec,
                        'payment_method': payment_method or 'TRANSFER',
                        'payment_status': 'COMPLETED'
                    }
                )
                group_booking.is_deposit_paid = True
                if group_booking.status == 'tentative':
                    group_booking.status = 'confirmed'
                group_booking.save(update_fields=['is_deposit_paid', 'status'])

                if hasattr(group_booking, 'master_invoice') and group_booking.master_invoice:
                    inv = group_booking.master_invoice
                    inv.status = 'paid'
                    inv.paid_at = timezone.now()
                    inv.save()

                for sub_b in group_booking.sub_bookings.all():
                    if sub_b.status in ['pending', 'unconfirmed']:
                        sub_b.status = 'confirmed'
                        sub_b.save(update_fields=['status'])
                    sub_b.service_requests.filter(is_paid=False).update(is_paid=True)
                    sub_b.extra_services.filter(is_paid=False).update(is_paid=True)

            log_action(
                user=request.user if request.user.is_authenticated else None,
                action='CREATE',
                module='INVOICE',
                description=f"Xác nhận thanh toán {amount_dec:,.0f} VND cho Đơn Đoàn #{group_booking.group_code}",
                request=request
            )
            serializer = PaymentSerializer(payment)
            return Response({
                "success": True,
                "message": f"Xác nhận thanh toán cho Đơn Đoàn #{group_booking.group_code} thành công!",
                "data": serializer.data
            }, status=status.HTTP_200_OK)

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

        # Tính toán tiền phòng chuẩn xác (pure_room_charge)
        check_in = booking.check_in_date
        check_out = booking.check_out_date
        nights = max(1, (check_out - check_in).days) if (check_in and check_out) else 1

        daily_rate = Decimal('0')
        if booking.category and booking.category.base_price:
            daily_rate = Decimal(str(booking.category.promo_price or booking.category.base_price))
        elif booking.room and booking.room.category and booking.room.category.base_price:
            daily_rate = Decimal(str(booking.room.category.promo_price or booking.room.category.base_price))

        room_subtotal = daily_rate * Decimal(str(nights))
        mem_discount = Decimal(str(booking.membership_discount or 0))

        # Tiền phòng thuần (pure_room_charge) xác định từ booking.total_amount
        prepaid_service_requests_total = sum(
            Decimal(str(r.total_price or 0)) 
            for r in booking.service_requests.filter(is_paid=True)
        )
        if booking.total_amount:
            pure_room_charge = max(Decimal('0'), Decimal(str(booking.total_amount)) - prepaid_service_requests_total)
        else:
            pure_room_charge = max(Decimal('0'), room_subtotal - mem_discount)

        room_charge = pure_room_charge

        promo_discount = Decimal('0')
        if booking.applied_promotion:
            actual_promo = max(Decimal('0'), room_subtotal - room_charge - mem_discount)
            if actual_promo > Decimal('0'):
                promo_discount = actual_promo
            else:
                if booking.applied_promotion.discount_type == 'percentage':
                    calc_promo = (room_subtotal * Decimal(str(booking.applied_promotion.discount_value))) / Decimal('100')
                    if getattr(booking.applied_promotion, 'max_discount_amount', None):
                        calc_promo = min(calc_promo, Decimal(str(booking.applied_promotion.max_discount_amount)))
                    promo_discount = calc_promo
                else:
                    promo_discount = min(room_subtotal, Decimal(str(booking.applied_promotion.discount_value)))
        elif getattr(booking, 'promotion_discount', None):
            promo_discount = Decimal(str(booking.promotion_discount))

        # Tính toán tiền dịch vụ phát sinh & đặt trước
        valid_requests = booking.service_requests.exclude(status='cancelled').select_related('service')
        service_charge = Decimal(str(sum(
            (req.total_price or ((req.service.price if req.service else 0) * req.quantity))
            for req in valid_requests
        )))

        for bes in booking.extra_services.all():
            raw_name = (bes.service_name or '').strip()
            if not re.search(r'\[Yêu cầu #\d+\]', raw_name, re.IGNORECASE):
                clean_name = re.sub(r'\[.*?\]', '', raw_name).strip()
                if not any((r.service.name if r.service else '').strip().lower() == clean_name.lower() for r in valid_requests):
                    service_charge += Decimal(str((bes.price or 0) * (bes.quantity or 1)))

        grand_total = pure_room_charge + service_charge

        # Số tiền đã thanh toán trước đó (COMPLETED payments)
        paid_amount = Decimal('0')
        if hasattr(booking, 'payments'):
            completed_payments = booking.payments.filter(payment_status='COMPLETED')
            if completed_payments.exists():
                paid_amount = sum(Decimal(str(p.amount)) for p in completed_payments)
        if paid_amount <= Decimal('0'):
            if booking.status in ['paid', 'PAID'] or (hasattr(booking, 'invoice') and booking.invoice and booking.invoice.status == 'paid'):
                paid_amount = Decimal(str(booking.total_amount or pure_room_charge))
            elif booking.note and ('vietqr: đã thanh toán' in booking.note.lower() or 'đã thanh toán thành công' in booking.note.lower()):
                paid_amount = Decimal(str(booking.total_amount or pure_room_charge))

        remaining_balance = max(Decimal('0'), grand_total - paid_amount)

        # Kiểm tra vai trò theo ma trận quyền cho phân hệ tài chính (finance)
        is_staff = bool(
            request.user and request.user.is_authenticated and (
                request.user.is_superuser or 
                check_role_permission(request.user, 'finance', 'create') or
                check_role_permission(request.user, 'bookings', 'update')
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

            # 4.1 Kiểm tra xem đơn đặt phòng đã thanh toán đủ hay chưa (Idempotency & Overpayment Protection)
            completed_payments = booking.payments.filter(payment_status='COMPLETED')
            total_already_paid = sum(Decimal(str(p.amount)) for p in completed_payments)

            # Nếu đơn đặt phòng đã được thanh toán đủ (hoặc vượt): trả về giao dịch gần nhất, không tạo mới trùng lặp
            if total_already_paid >= grand_total and completed_payments.exists():
                latest_payment = completed_payments.order_by('-id').first()
                return Response(
                    {
                        "success": True,
                        "message": f"Đơn đặt phòng {booking.booking_code} đã được thanh toán đủ ({total_already_paid:,.0f} VND).",
                        "data": PaymentSerializer(latest_payment).data
                    },
                    status=status.HTTP_200_OK
                )

            # Nếu số tiền thanh toán gửi lên vượt quá số dư còn nợ thực tế
            current_remaining = max(Decimal('0'), grand_total - total_already_paid)
            if total_already_paid > Decimal('0') and amount_dec > (current_remaining + Decimal('1000')):
                # Nếu đã trả đủ tiền phòng rồi và amount_dec bằng đúng tiền phòng (thao tác trùng từ modal cũ)
                if total_already_paid >= pure_room_charge:
                    latest_payment = completed_payments.order_by('-id').first()
                    return Response(
                        {
                            "success": True,
                            "message": f"Tiền phòng cho đơn {booking.booking_code} đã được ghi nhận trước đó ({latest_payment.transaction_id}). Dư nợ còn lại là {current_remaining:,.0f} VND.",
                            "data": PaymentSerializer(latest_payment).data
                        },
                        status=status.HTTP_200_OK
                    )
                return Response(
                    {
                        "success": False,
                        "message": f"Số tiền thanh toán ({amount_dec:,.0f} VND) vượt quá số dư còn thiếu của đơn ({current_remaining:,.0f} VND)."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 4.2 Kiểm tra chống trùng giao dịch kép trong 30 giây (Idempotency check)
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

            # Tìm ca làm việc đang mở (ưu tiên của user, sau đó là ca chung tại quầy)
            active_shift = None
            if request.user and request.user.is_authenticated:
                active_shift = CashierShift.objects.filter(user=request.user, status='OPEN').first()
                if not active_shift:
                    active_shift = CashierShift.objects.filter(status='OPEN').order_by('-opened_at').first()

            if pending_payment:
                pending_payment.payment_method = payment_method or 'TRANSFER'
                pending_payment.payment_status = 'COMPLETED'
                if active_shift and not pending_payment.shift:
                    pending_payment.shift = active_shift
                    pending_payment.save(update_fields=['payment_method', 'payment_status', 'shift'])
                else:
                    pending_payment.save(update_fields=['payment_method', 'payment_status'])
                payment = pending_payment
            else:
                payment = Payment.objects.create(
                    booking=booking,
                    amount=amount_dec,
                    payment_method=payment_method or 'TRANSFER',
                    payment_status='COMPLETED',
                    shift=active_shift
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

            # 4.5 Cập nhật tất cả dịch vụ đi kèm của đơn sang is_paid = True
            booking.service_requests.filter(is_paid=False).update(is_paid=True)
            booking.extra_services.filter(is_paid=False).update(is_paid=True)

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
            user.is_superuser or 
            check_role_permission(user, 'finance', 'read')
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

            # 2. Đồng bộ thêm các booking lẻ đã thanh toán hợp lệ mà chưa có payment
            # Lưu ý: Bỏ qua các phòng thuộc hợp đồng đoàn (group_booking) vì tiền phòng và quyết toán đã được hạch toán tập trung ở HĐ đoàn
            paid_bookings = Booking.objects.filter(
                models.Q(status__in=['completed', 'checked_out', 'paid', 'PAID']) |
                models.Q(note__icontains='VietQR: Đã thanh toán') |
                models.Q(note__icontains='đã thanh toán thành công')
            ).filter(
                group_booking__isnull=True
            ).exclude(
                status__in=['cancelled', 'no_show']
            ).exclude(
                payments__isnull=False
            )

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

            # 3. Tự động dọn dẹp các bản ghi PENDING thừa của các đơn đã có giao dịch COMPLETED
            Payment.objects.filter(
                payment_status='PENDING',
                booking__payments__payment_status='COMPLETED'
            ).delete()

        queryset = Payment.objects.select_related(
            'booking',
            'booking__guest',
            'booking__room',
            'booking__category',
            'group_booking',
            'group_booking__corporate_partner',
            'group_booking__master_invoice'
        ).prefetch_related(
            'group_booking__sub_bookings',
            'group_booking__sub_bookings__room'
        ).annotate(
            status_priority=models.Case(
                models.When(payment_status__in=['PENDING', 'PROCESSING'], then=models.Value(1)),
                models.When(payment_status='COMPLETED', then=models.Value(2)),
                default=models.Value(3),
                output_field=models.IntegerField()
            )
        ).all().order_by('status_priority', '-created_at')

        # Khách hàng chỉ xem giao dịch của chính mình (hoặc đoàn/doanh nghiệp do mình làm đầu mối)
        if not is_staff_or_admin:
            user_email = getattr(user, 'email', '')
            user_phone = getattr(user, 'phone', '')
            q_filter = models.Q(booking__guest=user)
            if user_email:
                q_filter |= models.Q(group_booking__leader_email__iexact=user_email)
                q_filter |= models.Q(group_booking__corporate_partner__contact_email__iexact=user_email)
            if user_phone:
                q_filter |= models.Q(group_booking__leader_phone=user_phone)
                q_filter |= models.Q(group_booking__corporate_partner__contact_phone=user_phone)
            queryset = queryset.filter(q_filter)

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
                models.Q(booking__company_name__icontains=search) |
                models.Q(group_booking__group_code__icontains=search) |
                models.Q(group_booking__group_name__icontains=search) |
                models.Q(group_booking__leader_name__icontains=search) |
                models.Q(group_booking__corporate_partner__company_name__icontains=search) |
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
    Kiểm tra trạng thái thanh toán của đơn đặt phòng hoặc đơn đặt đoàn phục vụ Long Polling từ Frontend.
    Hỗ trợ booking_id là ID (số) hoặc mã code (BK-xxxxxx hoặc GRP-xxxxxx).
    Trả về {"status": "COMPLETED"} hoặc {"status": "PENDING"}.
    """
    permission_classes = [AllowAny]

    def get(self, request, booking_id):
        from ..bookings.models import GroupBooking
        booking = None
        group_booking = None

        raw_id = str(booking_id).strip()

        # 1. Tra cứu theo GroupBooking (Mã đoàn GRP-xxxxxx hoặc ID)
        if raw_id.upper().startswith('GRP-') or 'GRP' in raw_id.upper():
            group_booking = GroupBooking.objects.filter(group_code__iexact=raw_id).first()
            if not group_booking:
                clean_grp = re.sub(r'[^A-Za-z0-9]', '', raw_id).upper()
                group_booking = GroupBooking.objects.filter(group_code__icontains=clean_grp.replace('GRP', '')).first()

        if not group_booking and raw_id.isdigit():
            group_booking = GroupBooking.objects.filter(id=int(raw_id)).first()

        # 2. Tra cứu theo Booking đơn lẻ nếu chưa thấy đơn đoàn
        if not group_booking:
            try:
                if raw_id.isdigit():
                    booking = Booking.objects.get(id=int(raw_id))
                else:
                    booking = Booking.objects.get(booking_code__iexact=raw_id)
            except Booking.DoesNotExist:
                pass

        if not booking and not group_booking:
            return Response(
                {
                    "status": "NOT_FOUND",
                    "message": f"Không tìm thấy đơn đặt phòng hoặc đơn đặt đoàn với mã '{booking_id}'."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # Xử lý kết quả kiểm tra cho Đơn đặt đoàn
        if group_booking:
            has_completed_payment = Payment.objects.filter(group_booking=group_booking, payment_status='COMPLETED').exists()
            is_deposit_paid = bool(group_booking.is_deposit_paid)
            is_group_confirmed = group_booking.status in ['confirmed', 'checked_in', 'paid', 'completed']
            is_invoice_paid = hasattr(group_booking, 'master_invoice') and group_booking.master_invoice and group_booking.master_invoice.status == 'paid'

            if has_completed_payment or is_deposit_paid or is_group_confirmed or is_invoice_paid:
                return Response({
                    "status": "COMPLETED",
                    "group_code": group_booking.group_code,
                    "group_id": group_booking.id,
                    "is_group": True,
                    "is_deposit_paid": True,
                    "group_status": group_booking.status
                }, status=status.HTTP_200_OK)

            return Response({
                "status": "PENDING",
                "group_code": group_booking.group_code,
                "group_id": group_booking.id,
                "is_group": True,
                "is_deposit_paid": False
            }, status=status.HTTP_200_OK)

        # Xử lý kết quả kiểm tra cho Đơn phòng lẻ
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

        # 2. Tìm mã đơn booking_code hoặc group_code trong nội dung chuyển khoản bằng Regex
        # Hỗ trợ mọi biến thể ngân hàng: có gạch ngang (BK-DA5F79, GRP-912A34) hoặc nuốt gạch ngang
        booking = None
        group_booking = None

        match_grp = re.search(r'GRP-?([A-Za-z0-9]{4,10})', content, re.IGNORECASE)
        if match_grp:
            clean_grp = match_grp.group(1).upper()
            group_booking = GroupBooking.objects.filter(group_code__iexact=f"GRP-{clean_grp}").first()
            if not group_booking:
                group_booking = GroupBooking.objects.filter(group_code__icontains=clean_grp).first()
        else:
            match_doan = re.search(r'(?:doan|group)\s*#?([A-Za-z0-9]{4,10})', content, re.IGNORECASE)
            if match_doan:
                suffix = match_doan.group(1).upper()
                group_booking = GroupBooking.objects.filter(group_code__iexact=f"GRP-{suffix}").first()
                if not group_booking:
                    group_booking = GroupBooking.objects.filter(group_code__icontains=suffix).first()

        if not group_booking:
            match = re.search(r'BK-?([A-Za-z0-9]{4,10})', content, re.IGNORECASE)
            if match:
                clean_suffix = match.group(1).upper()
                booking = Booking.objects.filter(booking_code__iexact=f"BK-{clean_suffix}").first()
                if not booking:
                    booking = Booking.objects.filter(booking_code__icontains=clean_suffix).first()

        # Fallback: nếu không thấy BK-xxx hay GRP-xxx, thử tìm theo ID số trong content
        if not booking and not group_booking:
            id_match = re.search(r'\b(\d{1,6})\b', content)
            if id_match:
                booking = Booking.objects.filter(id=int(id_match.group(1))).first()

        if not booking and not group_booking:
            return Response(
                {"success": False, "message": f"Không tìm thấy đơn đặt phòng hoặc đơn đặt đoàn từ nội dung: '{content}'"},
                status=status.HTTP_200_OK
            )

        # 3. Chuyển đổi số tiền
        try:
            transfer_amount = Decimal(str(amount_val or 0))
        except (ValueError, TypeError):
            transfer_amount = Decimal('0')

        # Xử lý đơn Đặt Đoàn (Group Booking)
        if group_booking:
            with transaction.atomic():
                group_booking = GroupBooking.objects.select_for_update().get(pk=group_booking.pk)
                txn_id = f"SEPAY-{sepay_id}" if sepay_id else (f"SEPAY-{reference_code}" if reference_code else None)
                defaults = {
                    'group_booking': group_booking,
                    'amount': transfer_amount or group_booking.deposit_amount or group_booking.total_amount,
                    'payment_method': 'TRANSFER',
                    'payment_status': 'COMPLETED'
                }
                pending_payment = Payment.objects.filter(
                    group_booking=group_booking,
                    payment_status='PENDING'
                ).order_by('-created_at').first()

                if pending_payment:
                    pending_payment.transaction_id = txn_id or pending_payment.transaction_id
                    pending_payment.amount = transfer_amount or pending_payment.amount
                    pending_payment.payment_method = 'TRANSFER'
                    pending_payment.payment_status = 'COMPLETED'
                    pending_payment.save(update_fields=['transaction_id', 'amount', 'payment_method', 'payment_status'])
                    payment = pending_payment
                else:
                    if txn_id:
                        payment, _ = Payment.objects.update_or_create(
                            transaction_id=txn_id,
                            defaults=defaults
                        )
                    else:
                        payment = Payment.objects.create(**defaults)

                Payment.objects.filter(group_booking=group_booking, payment_status='PENDING').delete()

                group_booking.is_deposit_paid = True
                if group_booking.status == 'tentative':
                    group_booking.status = 'confirmed'
                grp_note = (group_booking.note or '').strip()
                pay_note = f"SePay VietQR Auto ({transfer_amount:,.0f} VND)"
                if 'SePay VietQR' not in grp_note:
                    group_booking.note = f"{grp_note} | {pay_note}" if grp_note else pay_note
                group_booking.save(update_fields=['is_deposit_paid', 'status', 'note'])

                if hasattr(group_booking, 'master_invoice') and group_booking.master_invoice:
                    inv = group_booking.master_invoice
                    inv.status = 'paid'
                    inv.payment_method = 'bank_transfer'
                    inv.paid_at = timezone.now()
                    inv.save()

                for sub_b in group_booking.sub_bookings.all():
                    if sub_b.status in ['pending', 'unconfirmed']:
                        sub_b.status = 'confirmed'
                        sub_b.save(update_fields=['status'])
                    sub_b.service_requests.filter(is_paid=False).update(is_paid=True)
                    sub_b.extra_services.filter(is_paid=False).update(is_paid=True)

            log_action(
                user=None,
                action='CREATE',
                module='INVOICE',
                description=f"SePay Webhook tự động xác nhận thanh toán {transfer_amount:,.0f} VND cho Đơn Đoàn #{group_booking.group_code}",
                request=request
            )

            # Gửi email HTML 5 sao xác nhận thanh toán/đặt cọc thành công cho toàn đoàn
            try:
                send_group_booking_email_async(
                    group_booking=group_booking,
                    email_type='payment_success'
                )
            except Exception:
                pass

            return Response({
                "success": True,
                "message": f"Webhook SePay: Thanh toán cho Đơn Đoàn {group_booking.group_code} thành công!",
                "data": {"group_code": group_booking.group_code, "amount": float(transfer_amount)}
            }, status=status.HTTP_200_OK)

        # 4. Cập nhật thanh toán và trạng thái Booking đơn lẻ trong Database
        with transaction.atomic():
            booking = Booking.objects.select_for_update().get(pk=booking.pk)

            txn_id = f"SEPAY-{sepay_id}" if sepay_id else (f"SEPAY-{reference_code}" if reference_code else None)
            defaults = {
                'booking': booking,
                'amount': transfer_amount or booking.total_amount,
                'payment_method': 'TRANSFER',
                'payment_status': 'COMPLETED'
            }

            # Tìm và cập nhật bản ghi PENDING trước đó của booking này (được tạo lúc khách bấm Đặt phòng)
            pending_payment = Payment.objects.filter(
                booking=booking,
                payment_status='PENDING'
            ).order_by('-created_at').first()

            if pending_payment:
                pending_payment.transaction_id = txn_id or pending_payment.transaction_id
                pending_payment.amount = transfer_amount or pending_payment.amount
                pending_payment.payment_method = 'TRANSFER'
                pending_payment.payment_status = 'COMPLETED'
                pending_payment.save(update_fields=['transaction_id', 'amount', 'payment_method', 'payment_status'])
                payment = pending_payment
            else:
                if txn_id:
                    payment, _ = Payment.objects.update_or_create(
                        transaction_id=txn_id,
                        defaults=defaults
                    )
                else:
                    payment = Payment.objects.create(**defaults)

            # Dọn dẹp các bản ghi PENDING thừa khác nếu có của booking này (tránh bị trùng 2 dòng trên màn hình Hóa đơn)
            Payment.objects.filter(booking=booking, payment_status='PENDING').delete()

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

            # Tự động cập nhật tất cả các dịch vụ đặt kèm sang is_paid = True
            booking.service_requests.filter(is_paid=False).update(is_paid=True)
            booking.extra_services.filter(is_paid=False).update(is_paid=True)

        log_action(
            user=getattr(booking, 'guest', None),
            action='UPDATE',
            module='PAYMENT',
            description=f"SePay Webhook tự động xác nhận thanh toán {transfer_amount:,.0f} VND cho đơn {booking.booking_code}",
            request=request
        )

        # TRIGGER 2 - Khi khách quét mã VietQR và Webhook SePay báo tiền về thành công:
        # Ngay sau khi cập nhật trạng thái đơn sang đã thanh toán, tự động gọi lại hàm gửi email chạy ngầm
        recipient_target = None
        if hasattr(booking, 'invoice') and booking.invoice and booking.invoice.invoice_recipient_email:
            recipient_target = booking.invoice.invoice_recipient_email.strip()
        elif booking.guest and booking.guest.email:
            recipient_target = booking.guest.email.strip()

        send_booking_email_async(
            booking=booking,
            email_type='payment_success',
            custom_subject=f"[Khách Sạn TA Đà Nẵng] Xác nhận ĐÃ THANH TOÁN THÀNH CÔNG - Đơn #{booking.booking_code}",
            recipient_email=recipient_target
        )

        return Response({
            "success": True,
            "message": f"Đã cập nhật trạng thái COMPLETED cho đơn {booking.booking_code} thành công!",
            "booking_code": booking.booking_code
        }, status=status.HTTP_200_OK)


class ConfirmPaymentByIdView(APIView):
    """
    API endpoint: POST /api/payments/<int:payment_id>/confirm/
    Xác nhận hoàn tất một giao dịch thanh toán (PENDING -> COMPLETED) bởi Thu ngân / Lễ tân / Quản lý:
    - Cập nhật payment_status = 'COMPLETED'
    - Cập nhật payment_method ('CASH' hoặc 'TRANSFER') nếu được cung cấp
    - Cập nhật Booking hoặc GroupBooking (status, note, dịch vụ đi kèm)
    - Cập nhật Invoice liên quan sang status = 'paid'
    - Gửi email xác nhận thanh toán tự động
    - Ghi nhận Audit Log
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, payment_id):
        user = request.user
        can_confirm = (
            user.is_superuser or
            getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'cashier', 'owner'] or
            check_role_permission(user, 'finance', 'update') or
            check_role_permission(user, 'finance', 'create')
        )
        if not can_confirm:
            return Response({
                'success': False,
                'message': 'Bạn không có quyền xác nhận thanh toán (Yêu cầu vai trò Thu ngân / Lễ tân / Quản lý).'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            payment = Payment.objects.select_related('booking', 'group_booking').get(pk=payment_id)
        except Payment.DoesNotExist:
            return Response({
                'success': False,
                'message': f'Không tìm thấy giao dịch thanh toán #{payment_id}.'
            }, status=status.HTTP_404_NOT_FOUND)

        if payment.payment_status == 'COMPLETED':
            return Response({
                'success': True,
                'message': 'Giao dịch này đã ở trạng thái hoàn tất thành công.',
                'data': PaymentSerializer(payment).data
            }, status=status.HTTP_200_OK)

        new_method = request.data.get('payment_method')
        note = (request.data.get('note') or '').strip()

        with transaction.atomic():
            payment.payment_status = 'COMPLETED'
            if new_method:
                payment.payment_method = str(new_method).upper()
            payment.save(update_fields=['payment_status', 'payment_method'])

            # 1. Đơn đặt phòng lẻ
            if payment.booking:
                b = payment.booking
                if b.status in ['pending', 'unconfirmed']:
                    b.status = 'paid'
                method_name = 'Tiền mặt' if payment.payment_method == 'CASH' else 'VietQR'
                pay_note = f"{method_name}: Đã xác nhận thu ({payment.amount:,.0f} VND)"
                if note:
                    pay_note += f" - {note}"
                curr_note = (b.note or '').strip()
                if pay_note not in curr_note:
                    b.note = f"{curr_note} | {pay_note}" if curr_note else pay_note
                b.save(update_fields=['status', 'note'])

                # Đồng bộ invoice
                inv = getattr(b, 'invoice', None)
                if inv:
                    inv.status = 'paid'
                    inv.paid_at = timezone.now()
                    inv.save(update_fields=['status', 'paid_at'])

                # Đồng bộ dịch vụ
                b.service_requests.filter(is_paid=False).update(is_paid=True)
                b.extra_services.filter(is_paid=False).update(is_paid=True)

                # Gửi email xác nhận thanh toán
                target_email = None
                if inv and inv.invoice_recipient_email:
                    target_email = inv.invoice_recipient_email.strip()
                elif b.guest and b.guest.email:
                    target_email = b.guest.email.strip()

                try:
                    send_booking_email_async(
                        booking=b,
                        email_type='payment_success',
                        custom_subject=f"[Khách Sạn TA Đà Nẵng] Xác nhận THU TIỀN THÀNH CÔNG - Đơn #{b.booking_code}",
                        recipient_email=target_email
                    )
                except Exception:
                    pass

            # 2. Đơn đặt phòng đoàn
            elif payment.group_booking:
                grp = payment.group_booking
                grp.is_deposit_paid = True
                if grp.status == 'tentative':
                    grp.status = 'confirmed'
                grp.save(update_fields=['is_deposit_paid', 'status'])

                if hasattr(grp, 'master_invoice') and grp.master_invoice:
                    inv = grp.master_invoice
                    inv.status = 'paid'
                    inv.paid_at = timezone.now()
                    inv.save(update_fields=['status', 'paid_at'])

                for sub_b in grp.sub_bookings.all():
                    if sub_b.status in ['pending', 'unconfirmed']:
                        sub_b.status = 'confirmed'
                        sub_b.save(update_fields=['status'])
                    sub_b.service_requests.filter(is_paid=False).update(is_paid=True)
                    sub_b.extra_services.filter(is_paid=False).update(is_paid=True)

                try:
                    send_group_booking_email_async(
                        group_booking=grp,
                        email_type='group_deposit_success',
                        custom_subject=f"[Khách Sạn TA Đà Nẵng] Xác nhận thanh toán đặt đoàn #{grp.group_code}",
                        recipient_email=grp.leader_email
                    )
                except Exception:
                    pass

        log_action(
            user=user,
            action='UPDATE',
            module='INVOICE',
            description=f"Thu ngân ({user.username}) xác nhận hoàn tất thanh toán #{payment.transaction_id or payment.id} ({payment.amount:,.0f} VND) phương thức {payment.payment_method}",
            request=request
        )

        # Tự động gắn ca làm việc nếu thu ngân/lễ tân đang có ca mở hoặc quầy đang mở ca
        active_shift = CashierShift.objects.filter(user=user, status='OPEN').first()
        if not active_shift:
            active_shift = CashierShift.objects.filter(status='OPEN').order_by('-opened_at').first()
        if active_shift:
            payment.shift = active_shift
            payment.save(update_fields=['shift'])

        return Response({
            'success': True,
            'message': f'Xác nhận thanh toán cho giao dịch #{payment.transaction_id or payment.id} thành công!',
            'data': PaymentSerializer(payment).data
        }, status=status.HTTP_200_OK)


# =============================================================================
# NGHIỆP VỤ CA LÀM VIỆC & KẾT CA BÀN GIAO QUỸ TIỀN MẶT (Z-REPORT)
# =============================================================================

class CurrentShiftView(APIView):
    """
    API endpoint: GET /api/payments/shifts/current/
    Lấy ca làm việc đang mở (OPEN):
    - Ưu tiên 1: Ca do chính nhân viên này mở.
    - Ưu tiên 2: Ca đang mở chung tại quầy tiếp tân / thu ngân (Lễ tân, Thu ngân, Quản lý, Chủ KS và Admin đều cùng nhìn thấy và làm việc chung trên két tiền quầy).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        is_manager = bool(user.is_superuser or user.role in ['admin', 'owner', 'manager'])

        # 1. Tìm ca đang mở của chính user trước
        active_shift = CashierShift.objects.filter(user=user, status='OPEN').first()

        # 2. Nếu user chưa có ca mở riêng, lấy ca đang mở chung tại quầy tiếp tân / thu ngân
        if not active_shift:
            active_shift = CashierShift.objects.filter(status='OPEN').order_by('-opened_at').first()

        if not active_shift:
            return Response({
                'success': True,
                'has_active_shift': False,
                'is_manager_view': is_manager,
                'active_shift': None,
                'shift': None
            }, status=status.HTTP_200_OK)

        serializer = CashierShiftSerializer(active_shift)
        data = serializer.data
        data['is_own_shift'] = bool(active_shift.user == user)
        data['is_manager_view'] = is_manager

        return Response({
            'success': True,
            'has_active_shift': True,
            'is_manager_view': is_manager,
            'is_own_shift': bool(active_shift.user == user),
            'active_shift': data,
            'shift': data
        }, status=status.HTTP_200_OK)


class OpenShiftView(APIView):
    """
    API endpoint: POST /api/payments/shifts/open/
    Mở ca làm việc mới cho Thu ngân / Lễ tân.
    Payload:
    - shift_type: 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'STANDARD'
    - opening_cash: Số tiền mặt ban đầu nhận trong két (Float)
    - notes: Ghi chú mở ca
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        # 1. Kiểm tra nếu user đang có ca chưa kết thúc
        existing_open = CashierShift.objects.filter(user=user, status='OPEN').first()
        if existing_open:
            return Response({
                'success': False,
                'message': f"Bạn đang có ca làm việc #{existing_open.shift_code} chưa kết thúc. Vui lòng kết ca hiện tại trước khi mở ca mới!"
            }, status=status.HTTP_400_BAD_REQUEST)

        shift_type = request.data.get('shift_type', 'MORNING')
        opening_cash_raw = request.data.get('opening_cash', 0)
        notes = request.data.get('notes', '').strip()

        try:
            opening_cash = max(Decimal('0'), Decimal(str(opening_cash_raw or 0)))
        except (ValueError, TypeError):
            opening_cash = Decimal('0')

        new_shift = CashierShift.objects.create(
            user=user,
            shift_type=shift_type,
            opening_cash=opening_cash,
            notes=notes,
            status='OPEN'
        )

        log_action(
            user=user,
            action='CREATE',
            module='INVOICE',
            description=f"Mở ca làm việc {new_shift.get_shift_type_display()} (#{new_shift.shift_code}) với số dư ban đầu {opening_cash:,.0f} VND",
            request=request
        )

        serializer = CashierShiftSerializer(new_shift)
        return Response({
            'success': True,
            'message': f"Mở ca làm việc {new_shift.get_shift_type_display()} thành công!",
            'data': serializer.data,
            'shift': serializer.data
        }, status=status.HTTP_201_CREATED)


class CloseShiftView(APIView):
    """
    API endpoint: POST /api/payments/shifts/<int:pk>/close/
    Kết ca & Bàn giao quỹ tiền mặt (Lập Z-Report).
    Payload:
    - actual_cash: Tiền mặt thực tế đếm được trong két (Bắt buộc)
    - handover_user_id: ID nhân viên nhận bàn giao ca (Tùy chọn)
    - notes: Ghi chú kết ca / giải trình chênh lệch
    - denominations: Object chi tiết số lượng từng mệnh giá tiền
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        shift = CashierShift.objects.filter(pk=pk).first()
        if not shift:
            return Response({
                'success': False,
                'message': 'Không tìm thấy ca làm việc.'
            }, status=status.HTTP_404_NOT_FOUND)

        if shift.status == 'CLOSED':
            return Response({
                'success': False,
                'message': 'Ca làm việc này đã được kết ca trước đó.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Chỉ người mở ca hoặc Quản lý / Admin / Chủ KS mới có quyền kết ca bàn giao
        is_manager = bool(user.is_superuser or user.role in ['admin', 'owner', 'manager'])
        if shift.user != user and not is_manager:
            owner_name = shift.user.get_full_name() or shift.user.username
            return Response({
                'success': False,
                'message': f"Ca trực này do nhân viên {owner_name} mở và chịu trách nhiệm tiền két. Chỉ {owner_name} hoặc Quản lý mới có quyền kết ca bàn giao!"
            }, status=status.HTTP_403_FORBIDDEN)

        actual_cash_raw = request.data.get('actual_cash')
        if actual_cash_raw is None:
            return Response({
                'success': False,
                'message': 'Vui lòng nhập số tiền mặt thực tế kiểm đếm được trong két.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            actual_cash = max(Decimal('0'), Decimal(str(actual_cash_raw)))
        except (ValueError, TypeError):
            return Response({
                'success': False,
                'message': 'Số tiền mặt kiểm đếm không đúng định dạng số.'
            }, status=status.HTTP_400_BAD_REQUEST)

        handover_user_id = request.data.get('handover_user_id')
        handover_user_obj = None
        if handover_user_id:
            from django.contrib.auth import get_user_model
            UserModel = get_user_model()
            handover_user_obj = UserModel.objects.filter(pk=handover_user_id).first()
            if handover_user_obj and handover_user_obj.pk == shift.user_id:
                return Response({
                    'success': False,
                    'message': 'Không thể bàn giao ca làm việc cho chính người đang trực ca hiện tại!'
                }, status=status.HTTP_400_BAD_REQUEST)

        notes = request.data.get('notes', '').strip()
        denominations = request.data.get('denominations')

        with transaction.atomic():
            shift = CashierShift.objects.select_for_update().get(pk=pk)

            # Tính toán tóm tắt doanh thu thực tế
            summary = shift.calculate_current_summary()
            shift.total_cash_in = Decimal(str(summary['cash_in']))
            shift.total_transfer_in = Decimal(str(summary['transfer_in']))
            shift.total_card_in = Decimal(str(summary['card_in']))
            shift.total_cash_out = Decimal(str(summary.get('cash_out', 0)))
            shift.expected_cash = Decimal(str(summary['expected_cash']))
            shift.actual_cash = actual_cash
            shift.difference = actual_cash - shift.expected_cash

            shift.status = 'CLOSED'
            shift.closed_at = timezone.now()

            if handover_user_obj:
                shift.handover_user = handover_user_obj

            if notes:
                shift.notes = f"{shift.notes}\n{notes}".strip() if shift.notes else notes

            if denominations:
                shift.denominations = denominations

            shift.save()

            # Gắn tất cả các payment COMPLETED chưa có shift trong khoảng thời gian này vào ca
            Payment.objects.filter(
                models.Q(shift__isnull=True),
                created_at__gte=shift.opened_at,
                created_at__lte=shift.closed_at,
                payment_status='COMPLETED'
            ).update(shift=shift)

        diff_str = f"Thừa {shift.difference:+,.0f} VND" if shift.difference > 0 else (f"Hụt {shift.difference:,.0f} VND" if shift.difference < 0 else "Cân bằng (0 VND)")
        log_action(
            user=user,
            action='UPDATE',
            module='INVOICE',
            description=f"Kết ca #{shift.shift_code} ({shift.get_shift_type_display()}): Dự kiến {shift.expected_cash:,.0f} VND, Thực kiểm {shift.actual_cash:,.0f} VND, Chênh lệch {diff_str}",
            request=request
        )

        serializer = CashierShiftSerializer(shift)
        return Response({
            'success': True,
            'message': f"Kết ca làm việc #{shift.shift_code} và lập báo cáo Z-Report thành công!",
            'data': serializer.data,
            'shift': serializer.data
        }, status=status.HTTP_200_OK)


class ShiftSummaryView(APIView):
    """
    API endpoint: GET /api/payments/shifts/<int:pk>/summary/
    Lấy tóm tắt tài chính và danh sách giao dịch chi tiết của ca làm việc.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        shift = CashierShift.objects.filter(pk=pk).first()
        if not shift:
            return Response({
                'success': False,
                'message': 'Không tìm thấy ca làm việc.'
            }, status=status.HTTP_404_NOT_FOUND)

        summary = shift.calculate_current_summary()
        end_time = shift.closed_at or timezone.now()

        payments = Payment.objects.filter(
            models.Q(shift=shift) | (
                models.Q(shift__isnull=True) &
                models.Q(created_at__gte=shift.opened_at) &
                models.Q(created_at__lte=end_time)
            ),
            payment_status='COMPLETED'
        ).select_related('booking', 'group_booking')

        payment_list = PaymentSerializer(payments, many=True).data
        cash_out_list = CashOutVoucherSerializer(shift.cash_outs.all(), many=True).data

        return Response({
            'success': True,
            'shift': CashierShiftSerializer(shift).data,
            'summary': summary,
            'payments': payment_list,
            'cash_outs': cash_out_list
        }, status=status.HTTP_200_OK)


class ShiftListView(APIView):
    """
    API endpoint: GET /api/payments/shifts/
    Lấy lịch sử danh sách ca làm việc. Hỗ trợ lọc theo trạng thái, ngày mở, nhân viên.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        queryset = CashierShift.objects.select_related('user', 'handover_user').all().order_by('-opened_at', '-id')

        # Quản trị viên, Quản lý, Lễ tân và Thu ngân được xem toàn bộ lịch sử ca quầy để đối soát & in Z-Report
        is_front_office = bool(
            user.is_superuser or
            user.role in ['admin', 'owner', 'manager', 'receptionist', 'cashier']
        )
        if not is_front_office:
            queryset = queryset.filter(models.Q(user=user) | models.Q(handover_user=user))

        status_param = request.query_params.get('status')
        if status_param and status_param != 'ALL':
            queryset = queryset.filter(status=status_param)

        shift_type = request.query_params.get('shift_type')
        if shift_type and shift_type != 'ALL':
            queryset = queryset.filter(shift_type=shift_type)

        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(shift_code__icontains=search) |
                models.Q(user__username__icontains=search) |
                models.Q(user__first_name__icontains=search) |
                models.Q(user__last_name__icontains=search) |
                models.Q(notes__icontains=search)
            )

        from_date = request.query_params.get('from_date')
        if from_date:
            queryset = queryset.filter(opened_at__date__gte=from_date)

        to_date = request.query_params.get('to_date')
        if to_date:
            queryset = queryset.filter(opened_at__date__lte=to_date)

        user_id = request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        serializer = CashierShiftSerializer(queryset, many=True)
        return Response({
            'success': True,
            'count': queryset.count(),
            'data': serializer.data,
            'shifts': serializer.data
        }, status=status.HTTP_200_OK)


class ShiftReportView(APIView):
    """
    API endpoint: GET /api/payments/shifts/<int:pk>/report/
    Dữ liệu báo cáo kết ca chuẩn Z-Report phục vụ in phiếu khổ 80mm / A4 / A5.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        shift = CashierShift.objects.select_related('user', 'handover_user').filter(pk=pk).first()
        if not shift:
            return Response({
                'success': False,
                'message': 'Không tìm thấy ca làm việc.'
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            hotel_settings = HotelSetting.get_settings()
            hotel_name = hotel_settings.hotel_name or 'Khách Sạn TA Đà Nẵng'
            hotel_address = hotel_settings.address or 'Đà Nẵng, Việt Nam'
            hotel_hotline = hotel_settings.hotline or '0905 123 456'
        except Exception:
            hotel_name = 'Khách Sạn TA Đà Nẵng'
            hotel_address = 'Đà Nẵng, Việt Nam'
            hotel_hotline = '0905 123 456'

        summary = shift.calculate_current_summary()
        shift_data = CashierShiftSerializer(shift).data
        cash_out_list = CashOutVoucherSerializer(shift.cash_outs.all(), many=True).data

        report_data = {
            **shift_data,
            'hotel': {
                'name': hotel_name,
                'address': hotel_address,
                'hotline': hotel_hotline,
            },
            'shift': shift_data,
            'summary': summary,
            'cash_outs': cash_out_list,
            'printed_at': timezone.now().isoformat(),
            'printed_by': request.user.get_full_name() or request.user.username
        }

        return Response({
            'success': True,
            'data': report_data,
            'report': report_data,
            'shift': shift_data,
            'summary': summary,
            'cash_outs': cash_out_list
        }, status=status.HTTP_200_OK)


class CreateCashOutView(APIView):
    """
    API endpoint: POST /api/payments/cash-outs/
    Lập phiếu chi tiền mặt hoặc hoàn tiền (Refund / Petty Cash Out):
    1. REFUND_DEPOSIT: Hoàn cọc / Trả tiền thừa đơn phòng
    2. REFUND_CANCEL: Hoàn tiền cọc khi hủy đơn phòng / đơn đoàn
    3. PETTY_CASH: Chi phí phát sinh nội bộ quầy tiếp tân
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        # 0. Phân quyền nghiệp vụ: Chỉ Thu ngân (Cashier), Quản lý (Manager), Chủ KS (Owner) và Admin mới có quyền lập phiếu chi / hoàn cọc
        # Lễ tân (Front Desk) chỉ có quyền thu tiền, không được phép tự ý xuất quỹ két chi tiền
        can_cash_out = (
            user.is_superuser or
            getattr(user, 'role', '') in ['admin', 'owner', 'manager', 'cashier']
        )
        if not can_cash_out:
            return Response({
                'success': False,
                'message': 'Bạn không có quyền lập phiếu chi tiền mặt hoặc hoàn cọc. Nghiệp vụ này thuộc thẩm quyền của Thu ngân và Quản lý khách sạn.'
            }, status=status.HTTP_403_FORBIDDEN)

        voucher_type = request.data.get('voucher_type', 'REFUND_DEPOSIT')
        payment_method = request.data.get('payment_method', 'CASH').upper()
        amount_raw = request.data.get('amount')
        recipient_name = (request.data.get('recipient_name') or '').strip()
        recipient_phone = (request.data.get('recipient_phone') or '').strip()
        reason = (request.data.get('reason') or '').strip()
        approved_by = (request.data.get('approved_by') or '').strip()
        booking_id = request.data.get('booking_id')
        group_booking_id = request.data.get('group_booking_id')

        # 1. Validation cơ bản
        if not recipient_name:
            return Response({'success': False, 'message': 'Vui lòng nhập họ tên người nhận tiền.'}, status=status.HTTP_400_BAD_REQUEST)

        if not reason:
            return Response({'success': False, 'message': 'Vui lòng nhập lý do lập phiếu chi.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = Decimal(str(amount_raw or 0))
            if amount <= Decimal('0'):
                return Response({'success': False, 'message': 'Số tiền chi phải lớn hơn 0 đ.'}, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({'success': False, 'message': 'Số tiền chi không đúng định dạng số hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Tìm ca trực hiện tại tại quầy
        active_shift = CashierShift.objects.filter(user=user, status='OPEN').first()
        if not active_shift:
            active_shift = CashierShift.objects.filter(status='OPEN').order_by('-opened_at').first()

        # 3. Nếu chi TIỀN MẶT từ két: Bắt buộc phải có ca trực mở và két phải đủ tiền
        if payment_method == 'CASH':
            if not active_shift:
                return Response({
                    'success': False,
                    'message': 'Quầy hiện chưa có ca trực nào đang mở. Không thể chi tiền mặt từ két khi chưa mở ca làm việc!'
                }, status=status.HTTP_400_BAD_REQUEST)

            summary = active_shift.calculate_current_summary()
            current_cash_in_drawer = Decimal(str(summary.get('expected_cash', 0)))
            if amount > current_cash_in_drawer:
                return Response({
                    'success': False,
                    'message': f"Số tiền mặt trong két hiện tại ({current_cash_in_drawer:,.0f} đ) không đủ để chi số tiền {amount:,.0f} đ!"
                }, status=status.HTTP_400_BAD_REQUEST)

        # 4. Tìm booking liên quan nếu có
        booking_obj = None
        if booking_id:
            from ..bookings.models import Booking
            booking_obj = Booking.objects.filter(models.Q(id=booking_id) | models.Q(booking_code=booking_id)).first()

        group_booking_obj = None
        if group_booking_id:
            from ..bookings.models import GroupBooking
            group_booking_obj = GroupBooking.objects.filter(models.Q(id=group_booking_id) | models.Q(group_code=group_booking_id)).first()

        # 5. Tạo phiếu chi
        voucher = CashOutVoucher.objects.create(
            shift=active_shift,
            voucher_type=voucher_type,
            payment_method=payment_method,
            amount=amount,
            booking=booking_obj,
            group_booking=group_booking_obj,
            recipient_name=recipient_name,
            recipient_phone=recipient_phone,
            reason=reason,
            user=user,
            approved_by=approved_by or (user.get_full_name() or user.username)
        )

        # Cập nhật số tiền total_cash_out của ca nếu chi tiền mặt
        if payment_method == 'CASH' and active_shift:
            summary = active_shift.calculate_current_summary()
            active_shift.total_cash_out = Decimal(str(summary.get('cash_out', 0)))
            active_shift.save(update_fields=['total_cash_out'])

        # Ghi log kiểm toán
        log_action(
            user=user,
            action='CREATE',
            module='INVOICE',
            description=f"Lập phiếu chi {voucher.voucher_code}: {amount:,.0f} VND ({voucher.get_voucher_type_display()}) cho {recipient_name}",
            request=request
        )

        serializer = CashOutVoucherSerializer(voucher)
        return Response({
            'success': True,
            'message': f"Lập phiếu chi #{voucher.voucher_code} thành công ({amount:,.0f} đ)!",
            'data': serializer.data,
            'voucher': serializer.data
        }, status=status.HTTP_201_CREATED)


class CashOutListView(APIView):
    """
    API endpoint: GET /api/payments/cash-outs/
    Lấy danh sách các phiếu chi tiền & hoàn cọc.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = CashOutVoucher.objects.select_related('shift', 'booking', 'group_booking', 'user').all().order_by('-created_at')

        shift_id = request.query_params.get('shift_id')
        if shift_id:
            queryset = queryset.filter(shift_id=shift_id)

        voucher_type = request.query_params.get('voucher_type')
        if voucher_type and voucher_type != 'ALL':
            queryset = queryset.filter(voucher_type=voucher_type)

        payment_method = request.query_params.get('payment_method')
        if payment_method and payment_method != 'ALL':
            queryset = queryset.filter(payment_method=payment_method)

        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(voucher_code__icontains=search) |
                models.Q(recipient_name__icontains=search) |
                models.Q(recipient_phone__icontains=search) |
                models.Q(reason__icontains=search) |
                models.Q(booking__booking_code__icontains=search) |
                models.Q(group_booking__group_code__icontains=search)
            )

        serializer = CashOutVoucherSerializer(queryset, many=True)
        return Response({
            'success': True,
            'count': queryset.count(),
            'data': serializer.data,
            'vouchers': serializer.data
        }, status=status.HTTP_200_OK)





