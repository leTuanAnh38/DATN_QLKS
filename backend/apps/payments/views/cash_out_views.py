"""Phiếu chi tiền mặt và hoàn tiền."""
import json
import re
from decimal import Decimal
from django.db import models, transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from ...bookings.models import Booking, GroupBooking
from ...users.models import log_action
from ...users.views import check_role_permission
from ..models import CashierShift, CashOutVoucher
from ..serializers import CashOutVoucherSerializer

_BANK_TRANSFER_PATTERN = re.compile(r'\[BANK_TRANSFER_JSON\](.*?)\[/BANK_TRANSFER_JSON\]', re.DOTALL)


def strip_voucher_bank_tag(raw_reason):
    """Loại bỏ thẻ JSON ngân hàng khỏi lý do chi hiển thị."""
    if not raw_reason:
        return ''
    return _BANK_TRANSFER_PATTERN.sub('', str(raw_reason)).strip()


def parse_voucher_bank_info(raw_reason):
    """Đọc thông tin tài khoản nhận chuyển khoản từ CashOutVoucher.reason."""
    if not raw_reason:
        return None
    match = _BANK_TRANSFER_PATTERN.search(str(raw_reason))
    if not match:
        return None
    try:
        data = json.loads(match.group(1).strip())
        if not isinstance(data, dict):
            return None
        bank_name = str(data.get('bank_name') or '').strip()
        account_number = str(data.get('account_number') or '').strip()
        account_holder = str(data.get('account_holder') or '').strip()
        if not (bank_name or account_number or account_holder):
            return None
        parts = [p for p in [bank_name, account_number, account_holder] if p]
        return {
            'bank_name': bank_name,
            'account_number': account_number,
            'account_holder': account_holder,
            'summary': ' - '.join(parts),
        }
    except Exception:
        return None


def embed_voucher_bank_info(reason, bank_name='', account_number='', account_holder=''):
    """Đính kèm thông tin ngân hàng nhận chuyển khoản vào reason mà không cần sửa schema DB."""
    cleaned = strip_voucher_bank_tag(reason)
    b_name = str(bank_name or '').strip()
    acc_no = str(account_number or '').strip()
    acc_holder = str(account_holder or '').strip()
    if not (b_name or acc_no or acc_holder):
        return cleaned
    payload = {
        'bank_name': b_name,
        'account_number': acc_no,
        'account_holder': acc_holder,
    }
    tag = f"[BANK_TRANSFER_JSON]{json.dumps(payload, ensure_ascii=False)}[/BANK_TRANSFER_JSON]"
    return f"{cleaned}\n{tag}".strip() if cleaned else tag


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
        recipient_bank_name = (request.data.get('recipient_bank_name') or '').strip()
        recipient_account_number = (request.data.get('recipient_account_number') or '').strip()
        recipient_account_holder = (request.data.get('recipient_account_holder') or '').strip()
        reason = (request.data.get('reason') or '').strip()
        approved_by = (request.data.get('approved_by') or '').strip()
        booking_id = request.data.get('booking_id')
        group_booking_id = request.data.get('group_booking_id')

        # 1. Validation cơ bản
        if payment_method not in ('CASH', 'TRANSFER'):
            return Response({'success': False, 'message': 'Phương thức chi chỉ hỗ trợ CASH hoặc TRANSFER.'}, status=status.HTTP_400_BAD_REQUEST)

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

        # 2. Tìm booking liên quan nếu có
        booking_obj = None
        if booking_id:
            from ...bookings.models import Booking
            booking_obj = Booking.objects.filter(models.Q(id=booking_id) | models.Q(booking_code=booking_id)).first()

        group_booking_obj = None
        if group_booking_id:
            from ...bookings.models import GroupBooking
            group_booking_obj = GroupBooking.objects.filter(models.Q(id=group_booking_id) | models.Q(group_code=group_booking_id)).first()

        # 3. Khóa ca trực trong transaction để chống race condition rút âm két tiền mặt
        with transaction.atomic():
            active_shift = CashierShift.objects.select_for_update().filter(user=user, status='OPEN').first()
            if not active_shift:
                active_shift = CashierShift.objects.select_for_update().filter(status='OPEN').order_by('-opened_at').first()

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

            stored_reason = (
                embed_voucher_bank_info(
                    reason,
                    bank_name=recipient_bank_name,
                    account_number=recipient_account_number,
                    account_holder=recipient_account_holder,
                )
                if payment_method == 'TRANSFER'
                else reason
            )

            voucher = CashOutVoucher.objects.create(
                shift=active_shift,
                voucher_type=voucher_type,
                payment_method=payment_method,
                amount=amount,
                booking=booking_obj,
                group_booking=group_booking_obj,
                recipient_name=recipient_name,
                recipient_phone=recipient_phone,
                reason=stored_reason,
                user=user,
                approved_by=approved_by or (user.get_full_name() or user.username)
            )

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
        user = request.user
        can_view_cash_outs = (
            user.is_superuser or
            getattr(user, 'role', '') in ['admin', 'owner', 'manager', 'receptionist', 'cashier'] or
            check_role_permission(user, 'finance', 'read')
        )
        if not can_view_cash_outs:
            return Response({
                'success': False,
                'message': 'Bạn không có quyền xem danh sách phiếu chi và hoàn tiền.'
            }, status=status.HTTP_403_FORBIDDEN)

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

        search = (request.query_params.get('search') or '').strip()
        if search:
            queryset = queryset.filter(
                models.Q(voucher_code__icontains=search) |
                models.Q(recipient_name__icontains=search) |
                models.Q(recipient_phone__icontains=search) |
                models.Q(reason__icontains=search) |
                models.Q(booking__booking_code__icontains=search) |
                models.Q(group_booking__group_code__icontains=search)
            )

        date_from = (request.query_params.get('date_from') or '').strip()
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from[:10])

        date_to = (request.query_params.get('date_to') or '').strip()
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to[:10])

        # Thống kê tổng hợp trên toàn bộ tập kết quả sau lọc (trước khi cắt trang)
        agg = queryset.aggregate(
            total_amount=models.Sum('amount'),
            refund_cancel_total=models.Sum('amount', filter=models.Q(voucher_type='REFUND_CANCEL')),
            refund_deposit_total=models.Sum('amount', filter=models.Q(voucher_type='REFUND_DEPOSIT')),
            petty_cash_total=models.Sum('amount', filter=models.Q(voucher_type='PETTY_CASH')),
            cash_total=models.Sum('amount', filter=models.Q(payment_method='CASH')),
            transfer_total=models.Sum('amount', filter=models.Q(payment_method='TRANSFER')),
            refund_count=models.Count('id', filter=models.Q(voucher_type__in=['REFUND_CANCEL', 'REFUND_DEPOSIT'])),
        )
        total_count = queryset.count()
        summary = {
            'total_amount': float(agg['total_amount'] or 0),
            'refund_cancel_total': float(agg['refund_cancel_total'] or 0),
            'refund_deposit_total': float(agg['refund_deposit_total'] or 0),
            'petty_cash_total': float(agg['petty_cash_total'] or 0),
            'cash_total': float(agg['cash_total'] or 0),
            'transfer_total': float(agg['transfer_total'] or 0),
            'refund_count': int(agg['refund_count'] or 0),
        }

        # Hỗ trợ phân trang server-side khi client truyền page / page_size
        page_param = request.query_params.get('page')
        page_size_param = request.query_params.get('page_size')
        if page_param is not None or page_size_param is not None:
            try:
                page = max(1, int(page_param or 1))
            except (ValueError, TypeError):
                page = 1
            try:
                page_size = min(100, max(1, int(page_size_param or 10)))
            except (ValueError, TypeError):
                page_size = 10

            total_pages = max(1, (total_count + page_size - 1) // page_size)
            if page > total_pages:
                page = total_pages
            start_idx = (page - 1) * page_size
            page_qs = queryset[start_idx:start_idx + page_size]
            serializer = CashOutVoucherSerializer(page_qs, many=True)
            return Response({
                'success': True,
                'count': total_count,
                'page': page,
                'page_size': page_size,
                'total_pages': total_pages,
                'summary': summary,
                'results': serializer.data,
                'data': serializer.data,
                'vouchers': serializer.data,
            }, status=status.HTTP_200_OK)

        serializer = CashOutVoucherSerializer(queryset, many=True)
        return Response({
            'success': True,
            'count': total_count,
            'summary': summary,
            'results': serializer.data,
            'data': serializer.data,
            'vouchers': serializer.data,
        }, status=status.HTTP_200_OK)
