from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ModelViewSet):
    """
    API ViewSet quản lý Thông báo (Notification)
    - GET /api/notifications/: Lấy danh sách thông báo của người dùng hiện tại
    - PATCH /api/notifications/{id}/read/: Đánh dấu 1 thông báo đã đọc
    - PATCH /api/notifications/read-all/: Đánh dấu tất cả thông báo đã đọc
    - GET /api/notifications/unread-count/: Đếm số lượng thông báo chưa đọc
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Notification.objects.none()

        qs = Notification.objects.filter(recipient=user).order_by('-created_at')

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

        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        unread_count = Notification.objects.filter(recipient=request.user, is_read=False).count()

        # Nếu có sử dụng pagination
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            res = self.get_paginated_response(serializer.data)
            res.data['unread_count'] = unread_count
            res.data['success'] = True
            return res

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'unread_count': unread_count,
            'total_count': queryset.count(),
            'data': serializer.data,
            'results': serializer.data
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

        unread_count = Notification.objects.filter(recipient=request.user, is_read=False).count()
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
        updated_count = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).update(is_read=True)

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
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({
            'success': True,
            'unread_count': count
        })
