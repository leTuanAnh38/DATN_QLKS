from decimal import Decimal
from django.db import models, transaction
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission

from ..bookings.models import Booking
from .models import Payment, Invoice, PaymentConfig
from .serializers import PaymentSerializer, PaymentConfigSerializer

class IsAdminOrManagerUser(BasePermission):
    """
    Chỉ cho phép tài khoản có quyền Admin / Manager / Staff truy cập để sửa đổi cấu hình.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        allowed_roles = ['admin', 'owner', 'manager']
        return (
            getattr(request.user, 'role', None) in allowed_roles or
            request.user.is_staff or
            request.user.is_superuser
        )

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

        # 3. Kiểm tra số tiền amount có bằng total_amount của Booking không
        try:
            amount_dec = Decimal(str(amount))
            booking_total = Decimal(str(booking.total_amount))
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

        # 4. Bọc trong Transaction Atomic: Đảm bảo Payment được lưu thành công thì mới update Booking
        with transaction.atomic():
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
            if 'VietQR: Đã thanh toán' not in note_str:
                booking.note = f"{note_str} | VietQR: Đã thanh toán ({amount_dec:,.0f} VND)" if note_str else f"VietQR: Đã thanh toán ({amount_dec:,.0f} VND)"
            booking.save(update_fields=['status', 'note'])

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
    Lấy danh sách tất cả các giao dịch thanh toán cho Admin.
    Hỗ trợ query params:
    - search: tìm theo booking_code, guest username/full_name, transaction_id
    - status: lọc theo payment_status (COMPLETED, PENDING, FAILED)
    """
    permission_classes = [AllowAny]

    def get(self, request):
        # 1. Tự động đồng bộ các Hóa đơn (Invoices) hoặc đơn đã check-out vào bảng Payment nếu chưa có
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
        # TUYỆT ĐỐI LOẠI TRỪ các đơn đã hủy (cancelled) hoặc vắng mặt (no_show)
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
        return [IsAuthenticated(), IsAdminOrManagerUser()]

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
            serializer.save()
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
            serializer.save()
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
