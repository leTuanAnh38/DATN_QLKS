"""Quản lý ca trực lễ tân và báo cáo ca."""
from decimal import Decimal
from django.db import models, transaction
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from ...bookings.models import HotelSetting
from ...users.models import log_action
from ...users.views import check_role_permission
from ...notifications.models import Notification
from ..models import Payment, CashierShift
from ..serializers import PaymentSerializer, CashierShiftSerializer, CashOutVoucherSerializer


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
        can_view_shift = (
            user.is_superuser or
            getattr(user, 'role', '') in ['admin', 'owner', 'manager', 'receptionist', 'cashier'] or
            check_role_permission(user, 'finance', 'read')
        )
        if not can_view_shift:
            return Response({
                'success': True,
                'has_active_shift': False,
                'is_manager_view': False,
                'active_shift': None,
                'shift': None
            }, status=status.HTTP_200_OK)

        is_manager = bool(user.is_superuser or getattr(user, 'role', '') in ['admin', 'owner', 'manager'])

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

        # 0. Kiểm tra phân quyền RBAC: Chỉ Thu ngân, Lễ tân, Quản lý, Admin mới được mở ca thu ngân
        can_open_shift = (
            user.is_superuser or
            getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'cashier', 'owner'] or
            check_role_permission(user, 'finance', 'create')
        )
        if not can_open_shift:
            return Response({
                'success': False,
                'message': "Bạn không có quyền mở ca thu ngân / lễ tân."
            }, status=status.HTTP_403_FORBIDDEN)

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

        # Gửi thông báo kết ca & Báo cáo Z-Report cho Chủ KS, Quản lý, Admin và Thu ngân nhận bàn giao
        try:
            from django.contrib.auth import get_user_model
            UserModel = get_user_model()
            has_diff = (shift.difference != Decimal('0'))
            diff_prefix = "[CẢNH BÁO LỆCH KÉT]" if has_diff else "[BÁO CÁO KẾT CA]"
            notif_priority = 'urgent' if shift.difference < 0 else ('high' if has_diff else 'normal')

            shift_user_name = shift.user.get_full_name() or shift.user.username if shift.user else "Thu ngân"
            total_rev = Decimal(str(summary.get('total_revenue', 0)))

            if has_diff:
                diff_desc = f"Két tiền bị {diff_str}! (Thực tế: {shift.actual_cash:,.0f} VND vs Dự kiến: {shift.expected_cash:,.0f} VND)"
            else:
                diff_desc = f"Két tiền: Cân bằng ({shift.actual_cash:,.0f} VND khớp 100% hệ thống)."

            notif_title = f"{diff_prefix}: #{shift.shift_code} ({shift.get_shift_type_display()})"
            notif_msg = (
                f"Thu ngân {shift_user_name} vừa kết thúc ca trực #{shift.shift_code}.\n"
                f"• Doanh thu ghi nhận trong ca: {total_rev:,.0f} VND ({summary.get('payments_count', 0)} giao dịch).\n"
                f"• Tiền mặt kiểm đếm: {shift.actual_cash:,.0f} VND.\n"
                f"• {diff_desc}\n"
                f"Vui lòng vào đối soát phiếu Z-Report."
            )

            supervisors = UserModel.objects.filter(
                models.Q(is_superuser=True) |
                models.Q(role__in=['owner', 'manager', 'admin'])
            ).distinct()

            shift_notifs = [
                Notification(
                    recipient=supervisor,
                    title=notif_title,
                    message=notif_msg,
                    notification_type='payment',
                    action_url='/admin/finance',
                    priority=notif_priority
                )
                for supervisor in supervisors
            ]
            if shift_notifs:
                Notification.objects.bulk_create(shift_notifs)

            # Gửi thông báo nhận bàn giao cho Thu ngân ca sau (nếu có chọn handover_user)
            if shift.handover_user and shift.handover_user != shift.user:
                Notification.objects.create(
                    recipient=shift.handover_user,
                    title=f"[NHẬN BÀN GIAO CA] #{shift.shift_code} - {shift.get_shift_type_display()}",
                    message=(
                        f"Bạn vừa được nhân viên {shift_user_name} bàn giao ca trực #{shift.shift_code}.\n"
                        f"• Số tiền mặt bàn giao trong két: {shift.actual_cash:,.0f} VND.\n"
                        f"• Ghi chú bàn giao: {shift.notes or 'Không có ghi chú'}.\n"
                        f"Vui lòng kiểm đếm lại quỹ két tiền mặt trước khi mở ca mới."
                    ),
                    notification_type='payment',
                    action_url='/admin/finance',
                    priority='high'
                )

        except Exception:
            pass

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
