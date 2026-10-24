from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from core_project.pagination import StandardResultsSetPagination
from .models import Notification
from .serializers import NotificationSerializer
from .services import (
    run_daily_reminders_if_needed,
    send_checkin_checkout_reminders,
    send_single_booking_reminder,
)


class NotificationPagination(StandardResultsSetPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 50


class NotificationViewSet(viewsets.ModelViewSet):
    """
    API ViewSet quản lý Thông báo (Notification)
    - GET /api/notifications/: Lấy danh sách thông báo của người dùng hiện tại (hỗ trợ phân trang ?page=1&page_size=15)
    - PATCH /api/notifications/{id}/read/: Đánh dấu 1 thông báo đã đọc
    - PATCH /api/notifications/read-all/: Đánh dấu tất cả thông báo đã đọc
    - DELETE /api/notifications/clear-read/: Xóa tất cả thông báo đã đọc
    - GET /api/notifications/unread-count/: Đếm số lượng thông báo chưa đọc
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = NotificationPagination

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Notification.objects.none()

        qs = Notification.objects.filter(recipient=user).order_by('-created_at')

        # Dành riêng cho Chủ Khách Sạn & Chủ Tịch HĐQT (Owner):
        # Tự động lọc bỏ các thông báo tác nghiệp vi mô hàng ngày của nhân viên cấp dưới
        # (dọn dẹp buồng phòng, kiểm tra minibar, đồ thất lạc, phục vụ món ăn nhỏ lẻ, nhắc lịch check-in/out khách lẻ)
        if getattr(user, 'role', '') == 'owner':
            from django.db.models import Q
            excluded_keywords = [
                'PHÒNG SẴN SÀNG',
                'YÊU CẦU DỌN PHÒNG',
                'DỌN PHÒNG HOÀN TẤT',
                'BÀN GIAO DỌN DẸP',
                'KIỂM PHÒNG',
                'HOÀN TẤT KIỂM PHÒNG',
                'KIỂM KÊ MINIBAR',
                'ĐỒ THẤT LẠC',
                'Tiện ích buồng phòng',
                'Báo Buồng phòng',
                'Yêu cầu tiện ích',
                'Dịch vụ phòng',
                'Món ăn',
                'Đơn gọi món',
                'đặt xe',
                'Điều vận',
                'Phương tiện đã sẵn sàng',
                'Lịch Check-in hôm nay: Khách',
                'Lịch Check-out hôm nay:',
                'Khách đã Check-in:',
                'Khách đã Check-out:'
            ]
            q_exclude = Q()
            for kw in excluded_keywords:
                q_exclude |= Q(title__icontains=kw)
            qs = qs.exclude(q_exclude).exclude(notification_type='service')

        # Dành riêng cho Quản Lý Khách Sạn (Manager):
        # Tự động lọc bỏ các thông báo tác nghiệp vi mô (dọn dẹp thường, minibar thường 0đ hư hại, phục vụ món ăn/tiện ích, nhắc lịch phòng lẻ)
        # Giữ lại trọn vẹn: Đền bù hư hại tài sản, Phiếu bảo trì sửa chữa phòng, Đơn đoàn & Master Invoice, Dòng tiền/Thanh toán/VAT/Chi quỹ, Đánh giá khách hàng, Đồ thất lạc.
        elif getattr(user, 'role', '') == 'manager':
            from django.db.models import Q
            manager_excluded_keywords = [
                'PHÒNG SẴN SÀNG',
                'YÊU CẦU DỌN PHÒNG',
                'DỌN PHÒNG HOÀN TẤT',
                'BÀN GIAO DỌN DẸP',
                'YÊU CẦU KIỂM PHÒNG',
                'KIỂM KÊ MINIBAR',
                'Tiện ích buồng phòng',
                'Báo Buồng phòng',
                'Yêu cầu tiện ích',
                'Dịch vụ phòng',
                'Món ăn',
                'Đơn gọi món',
                'đặt xe',
                'Điều vận',
                'Phương tiện đã sẵn sàng',
                'Lịch Check-in hôm nay: Khách',
                'Lịch Check-out hôm nay:',
                'Khách đã Check-in:',
                'Khách đã Check-out:'
            ]
            q_exclude = Q()
            for kw in manager_excluded_keywords:
                q_exclude |= Q(title__icontains=kw)
            
            # Kiểm phòng minibar chỉ hiện đối với các trường hợp có phát sinh hư hại / đền bù tài sản
            q_routine_minibar = Q(title__icontains='HOÀN TẤT KIỂM PHÒNG') & ~Q(message__icontains='Hư hại / Đền bù')

            qs = qs.exclude(q_exclude).exclude(q_routine_minibar).exclude(notification_type='service')

        # Hỗ trợ query params: ?unread_only=true hoặc ?is_read=false
        unread_only = self.request.query_params.get('unread_only')
        is_read_param = self.request.query_params.get('is_read')

        if unread_only in ['true', 'True', '1', True]:
            qs = qs.filter(is_read=False)
        elif is_read_param is not None:
            if is_read_param.lower() in ['false', '0']:
                qs = qs.filter(is_read=False)
            elif is_read_param.lower() in ['true', '1']:
                qs = qs.filter(is_read=True)

        # Hỗ trợ lọc theo loại thông báo: ?type=payment, ?type=booking, ?type=service, ?type=room
        type_param = self.request.query_params.get('type')
        if type_param:
            if type_param in ['booking', 'bookings']:
                qs = qs.filter(notification_type__in=['booking', 'group_booking', 'room'])
            else:
                qs = qs.filter(notification_type=type_param)

        return qs

    def list(self, request, *args, **kwargs):
        # Tự động quét và kích hoạt nhắc nhở Check-in & Check-out hôm nay nếu cần (tối đa 1 lần/15 phút)
        run_daily_reminders_if_needed()

        base_qs = self.get_queryset()
        queryset = self.filter_queryset(base_qs)
        unread_count = base_qs.filter(is_read=False).count()
        all_count = base_qs.count()
        filtered_count = queryset.count()

        # Nếu có sử dụng pagination
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            res = self.get_paginated_response(serializer.data)
            res.data['unread_count'] = unread_count
            res.data['all_count'] = all_count
            res.data['total_count'] = all_count
            res.data['filtered_count'] = filtered_count
            res.data['data'] = serializer.data
            res.data['has_next'] = bool(self.paginator.get_next_link())
            res.data['success'] = True
            return res

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'unread_count': unread_count,
            'all_count': all_count,
            'total_count': all_count,
            'filtered_count': filtered_count,
            'data': serializer.data,
            'results': serializer.data,
            'has_next': False
        })

    @action(detail=False, methods=['delete', 'post'], url_path='clear-read')
    def clear_read(self, request):
        """
        DELETE /api/notifications/clear-read/
        Xóa tất cả thông báo đã đọc của người dùng hiện tại
        """
        base_qs = self.get_queryset()
        deleted_count, _ = base_qs.filter(is_read=True).delete()
        unread_count = self.get_queryset().filter(is_read=False).count()
        return Response({
            'success': True,
            'message': f'Đã dọn dẹp {deleted_count} thông báo đã đọc',
            'deleted_count': deleted_count,
            'unread_count': unread_count
        })

    @action(detail=True, methods=['patch', 'post'], url_path='read')
    def mark_as_read(self, request, pk=None):
        """
        PATCH /api/notifications/{id}/read/
        Đánh dấu 1 thông báo là đã đọc
        """
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=['is_read'])

        unread_count = self.get_queryset().filter(is_read=False).count()
        return Response({
            'success': True,
            'message': 'Đã đánh dấu thông báo đã đọc',
            'unread_count': unread_count,
            'data': self.get_serializer(notification).data
        })

    @action(detail=False, methods=['patch', 'post'], url_path='read-all')
    def mark_all_as_read(self, request):
        """
        PATCH /api/notifications/read-all/
        Đánh dấu tất cả thông báo của người dùng là đã đọc
        """
        updated_count = self.get_queryset().filter(is_read=False).update(is_read=True)

        return Response({
            'success': True,
            'message': f'Đã đánh dấu {updated_count} thông báo là đã đọc',
            'updated_count': updated_count,
            'unread_count': 0
        })

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        """
        GET /api/notifications/unread-count/
        Lấy nhanh số lượng thông báo chưa đọc để poll nhẹ nhàng
        """
        count = self.get_queryset().filter(is_read=False).count()
        return Response({
            'success': True,
            'unread_count': count
        })

    @action(detail=False, methods=['post'], url_path='trigger-reminders')
    def trigger_reminders(self, request):
        """
        POST /api/notifications/trigger-reminders/
        Cho phép Admin / Lễ tân chủ động kích hoạt quét và gửi nhắc nhở Check-in/Check-out hôm nay
        Body: { "force": false }
        """
        force = bool(request.data.get('force', False))
        result = send_checkin_checkout_reminders(force=force)
        return Response({
            'success': True,
            'message': f"Đã quét và tạo {result['total_notifications_created']} thông báo nhắc nhở ngày {result['date']}",
            'data': result
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='remind-booking')
    def remind_booking(self, request):
        """
        POST /api/notifications/remind-booking/
        Gửi thông báo nhắc nhở tức thì cho một đơn đặt phòng cụ thể
        Body: { "booking_id": 123, "reminder_type": "check_in" | "check_out" | "auto" }
        """
        booking_id = request.data.get('booking_id')
        if not booking_id:
            return Response({'success': False, 'message': 'Thiếu tham số booking_id'}, status=status.HTTP_400_BAD_REQUEST)

        reminder_type = request.data.get('reminder_type', 'auto')
        notify_guest = request.data.get('notify_guest', True)
        notify_staff = request.data.get('notify_staff', False)

        result = send_single_booking_reminder(
            booking_id=booking_id,
            reminder_type=reminder_type,
            notify_guest=notify_guest,
            notify_staff=notify_staff
        )
        return Response(result, status=status.HTTP_200_OK if result.get('success') else status.HTTP_400_BAD_REQUEST)
