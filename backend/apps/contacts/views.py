from django.db.models import Q
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from core_project.pagination import StandardResultsSetPagination

from .models import ContactMessage
from .serializers import ContactMessageCreateSerializer, ContactMessageSerializer


class IsHotelStaffOrAdmin(BasePermission):
    """Chỉ nhân viên khách sạn / quản trị viên được xem, đánh dấu và xóa liên hệ."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_staff or user.is_superuser:
            return True
        return getattr(user, 'role', '') in ['admin', 'manager', 'receptionist']


class ContactCreateThrottle(AnonRateThrottle):
    """Giới hạn số lần gửi liên hệ từ một IP để chống spam form public."""
    rate = '30/hour'


class ContactMessageViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    API Liên hệ:
    - POST   /api/contacts/             : Public - khách gửi liên hệ (không cần token).
    - GET    /api/contacts/             : Admin - danh sách, phân trang, ?search=, ?is_read=true|false
    - PATCH  /api/contacts/{id}/read/   : Admin - đánh dấu đã đọc.
    - DELETE /api/contacts/{id}/        : Admin - xóa liên hệ.
    """
    queryset = ContactMessage.objects.all()
    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsHotelStaffOrAdmin()]

    def get_throttles(self):
        if self.action == 'create':
            return [ContactCreateThrottle()]
        return []

    def get_serializer_class(self):
        if self.action == 'create':
            return ContactMessageCreateSerializer
        return ContactMessageSerializer

    def get_queryset(self):
        qs = ContactMessage.objects.all()
        params = self.request.query_params

        # Tìm kiếm theo tên, email, chủ đề, nội dung
        search = (params.get('search') or params.get('q') or '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(email__icontains=search)
                | Q(subject__icontains=search)
                | Q(message__icontains=search)
            )

        # Lọc theo trạng thái đã đọc / chưa đọc
        is_read = (params.get('is_read') or '').strip().lower()
        if is_read in ('true', '1'):
            qs = qs.filter(is_read=True)
        elif is_read in ('false', '0'):
            qs = qs.filter(is_read=False)

        return qs.order_by('-created_at', '-id')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
                'errors': serializer.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer.save()
        # Không trả lại dữ liệu bản ghi cho client public
        return Response({
            'success': True,
            'message': 'Cảm ơn quý khách! Yêu cầu liên hệ đã được gửi thành công.',
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='read')
    def mark_read(self, request, pk=None):
        contact = self.get_object()
        if not contact.is_read:
            contact.is_read = True
            contact.save(update_fields=['is_read'])
        return Response({
            'success': True,
            'message': 'Đã đánh dấu đã đọc.',
            'contact': ContactMessageSerializer(contact).data,
        }, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        contact = self.get_object()
        contact.delete()
        return Response({
            'success': True,
            'message': 'Đã xóa liên hệ thành công.',
        }, status=status.HTTP_200_OK)
