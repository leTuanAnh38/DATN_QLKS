"""Phiếu chi tiền mặt và hoàn tiền."""
from decimal import Decimal
from django.db import models
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from ...bookings.models import Booking, GroupBooking
from ...users.models import log_action
from ..models import CashierShift, CashOutVoucher
from ..serializers import CashOutVoucherSerializer


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
            from ...bookings.models import Booking
            booking_obj = Booking.objects.filter(models.Q(id=booking_id) | models.Q(booking_code=booking_id)).first()

        group_booking_obj = None
        if group_booking_id:
            from ...bookings.models import GroupBooking
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
