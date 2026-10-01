from django.db import models
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from core_project.pagination import StandardResultsSetPagination
from .models import Review
from .serializers import ReviewSerializer, ReviewCreateSerializer


class IsStaffOrAdminUser(permissions.BasePermission):
    """
    Cho phép nhân viên quản lý, lễ tân hoặc admin truy cập các thao tác quản trị đánh giá.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        user = request.user
        return bool(
            user.is_staff or
            user.is_superuser or
            getattr(user, 'role', '') in ['admin', 'owner', 'manager', 'receptionist', 'staff']
        )


class ReviewViewSet(viewsets.ModelViewSet):
    """
    ViewSet xử lý CRUD và các thao tác đặc thù của hệ thống Đánh giá & Phản hồi:
    - POST /api/reviews/: Khách hàng tạo đánh giá
    - GET /api/reviews/: Lấy danh sách đánh giá (Mới nhất)
    - PATCH /api/reviews/{id}/reply/: Admin viết/sửa phản hồi
    - PATCH /api/reviews/{id}/toggle-visibility/: Admin Ẩn/Hiện đánh giá
    - DELETE /api/reviews/{id}/: Admin xóa đánh giá
    """
    queryset = Review.objects.select_related('booking', 'guest', 'room_category').all().order_by('-created_at')
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.action == 'create':
            return ReviewCreateSerializer
        return ReviewSerializer

    def get_permissions(self):
        if self.action in ['create']:
            return [permissions.IsAuthenticated()]
        if self.action in ['reply', 'toggle_visibility', 'destroy']:
            return [IsStaffOrAdminUser()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()

        is_staff_user = user.is_authenticated and (
            user.is_staff or
            user.is_superuser or
            getattr(user, 'role', '') in ['admin', 'owner', 'manager', 'receptionist', 'staff']
        )

        # Lọc theo Hạng phòng nếu có query param ?room_category=ID hoặc ?category=ID
        category_param = self.request.query_params.get('room_category') or self.request.query_params.get('category')
        if category_param:
            if category_param.isdigit():
                qs = qs.filter(room_category_id=int(category_param))
            else:
                qs = qs.filter(room_category__slug=category_param)

        # Lọc theo Đơn đặt phòng nếu có query param ?booking=ID
        booking_param = self.request.query_params.get('booking')
        if booking_param and booking_param.isdigit():
            qs = qs.filter(booking_id=int(booking_param))

        # Phân quyền hiển thị:
        if not is_staff_user:
            # Khách vãng lai chỉ thấy đánh giá công khai (is_visible=True)
            # Khách đã đăng nhập thấy đánh giá công khai + đánh giá do chính họ viết
            if user.is_authenticated:
                qs = qs.filter(models.Q(is_visible=True) | models.Q(guest=user))
            else:
                qs = qs.filter(is_visible=True)

        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        review = serializer.save()
        output_serializer = ReviewSerializer(review, context={'request': request})
        return Response(
            {
                'success': True,
                'message': 'Cảm ơn quý khách đã gửi đánh giá trải nghiệm kỳ nghỉ!',
                'data': output_serializer.data,
            },
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['patch'], url_path='reply')
    def reply(self, request, pk=None):
        review = self.get_object()
        admin_reply = request.data.get('admin_reply')

        if admin_reply is None:
            return Response(
                {
                    'success': False,
                    'message': 'Trường admin_reply không được để trống.',
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        review.admin_reply = str(admin_reply).strip() if admin_reply else None
        review.save(update_fields=['admin_reply', 'updated_at'])

        return Response(
            {
                'success': True,
                'message': 'Đã cập nhật phản hồi của khách sạn thành công.',
                'data': ReviewSerializer(review, context={'request': request}).data,
            },
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['patch'], url_path='toggle-visibility')
    def toggle_visibility(self, request, pk=None):
        review = self.get_object()

        if 'is_visible' in request.data:
            review.is_visible = bool(request.data['is_visible'])
        else:
            review.is_visible = not review.is_visible

        review.save(update_fields=['is_visible', 'updated_at'])

        state_text = 'Hiển thị' if review.is_visible else 'Đã ẩn'
        return Response(
            {
                'success': True,
                'message': f'Đã chuyển trạng thái đánh giá sang "{state_text}".',
                'data': ReviewSerializer(review, context={'request': request}).data,
            },
            status=status.HTTP_200_OK
        )

    def destroy(self, request, *args, **kwargs):
        review = self.get_object()
        review_id = review.id
        review.delete()
        return Response(
            {
                'success': True,
                'message': f'Đã xóa đánh giá #{review_id} thành công khỏi hệ thống.',
            },
            status=status.HTTP_200_OK
        )
