from decimal import Decimal
from django.db import models
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from ..bookings.models import Booking
from .models import Payment, Invoice
from .serializers import PaymentSerializer

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

        if abs(amount_dec - booking_total) > Decimal('100'):
            return Response(
                {
                    "success": False,
                    "message": f"Số tiền thanh toán ({amount_dec:,.0f} VND) không khớp với tổng tiền đơn đặt phòng ({booking_total:,.0f} VND)."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 4. Hợp lệ: Đổi trạng thái Booking thành "Đã thanh toán" (PAID)
        booking.status = 'paid'
        booking.save(update_fields=['status'])

        # Cập nhật hóa đơn nếu có
        try:
            invoice = getattr(booking, 'invoice', None)
            if invoice:
                invoice.status = 'paid'
                invoice.payment_method = 'bank_transfer'
                invoice.paid_at = timezone.now()
                invoice.save()
        except Exception:
            pass

        # 5. Tạo bản ghi Payment với status "COMPLETED"
        payment = Payment.objects.create(
            booking=booking,
            amount=amount_dec,
            payment_method=payment_method or 'TRANSFER',
            payment_status='COMPLETED'
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

        # Đồng bộ thêm các booking completed/paid mà chưa có payment
        completed_bookings = Booking.objects.filter(
            status__in=['completed', 'checked_out', 'paid', 'PAID']
        ).exclude(payments__isnull=False)
        for b in completed_bookings:
            Payment.objects.create(
                booking=b,
                amount=b.total_amount or 0,
                payment_method='CASH',
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
