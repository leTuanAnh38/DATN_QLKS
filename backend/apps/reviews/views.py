from django.db import models
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from core_project.pagination import StandardResultsSetPagination
from .models import Review
from .serializers import ReviewSerializer, ReviewCreateSerializer
from ..users.models import log_action
from ..notifications.models import Notification


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
        if self.action in ['update', 'partial_update']:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def perform_update(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        user = self.request.user
        instance = serializer.instance
        is_staff = (
            user.is_staff or
            user.is_superuser or
            getattr(user, 'role', '') in ['admin', 'owner', 'manager', 'receptionist', 'staff']
        )
        if not is_staff and instance.guest != user:
            raise PermissionDenied("Bạn chỉ có quyền chỉnh sửa đánh giá do chính mình viết.")

        if not is_staff:
            serializer.save(
                admin_reply=instance.admin_reply,
                is_visible=instance.is_visible
            )
        else:
            serializer.save()

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

        # Gửi thông báo cho Quản lý & Chủ khách sạn (ưu tiên cao nếu đánh giá <= 3 sao để kịp thời can thiệp)
        try:
            from django.contrib.auth import get_user_model
            UserModel = get_user_model()
            is_negative = bool(review.rating and review.rating <= 3)
            rating_stars = "⭐" * int(review.rating or 5)
            guest_name = review.guest.get_full_name() or review.guest.username if review.guest else "Khách hàng"
            booking_code = review.booking.booking_code if review.booking else "N/A"
            cat_name = review.room_category.name if review.room_category else ""

            if is_negative:
                notif_title = f"⚠️ [CẢNH BÁO ĐÁNH GIÁ THẤP] {guest_name} ({review.rating}⭐)"
                notif_priority = 'urgent' if review.rating <= 2 else 'high'
            else:
                notif_title = f"🌟 [ĐÁNH GIÁ MỚI] {guest_name} ({review.rating}⭐)"
                notif_priority = 'normal'

            notif_msg = (
                f"Khách hàng {guest_name} vừa gửi đánh giá {review.rating} sao {rating_stars} "
                f"cho đơn đặt phòng #{booking_code}{f' ({cat_name})' if cat_name else ''}.\n"
                f"• Tiêu đề: \"{review.title or 'Đánh giá kỳ nghỉ'}\"\n"
                f"• Nội dung: \"{(review.comment or 'Không có lời nhắn')[:120]}\"\n"
                f"Vui lòng xem chi tiết và phản hồi khách hàng."
            )

            supervisors = UserModel.objects.filter(
                models.Q(is_superuser=True) |
                models.Q(role__in=['owner', 'manager', 'admin'])
            ).distinct()

            notifs = [
                Notification(
                    recipient=sup,
                    title=notif_title,
                    message=notif_msg,
                    notification_type='system',
                    action_url='/admin',
                    priority=notif_priority
                )
                for sup in supervisors
            ]
            if notifs:
                Notification.objects.bulk_create(notifs)
        except Exception:
            pass

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

        log_action(
            user=request.user,
            action='UPDATE',
            module='OTHER',
            description=f'Phản hồi đánh giá #{review.id} của khách {review.guest.username if review.guest else "Khách"}',
            request=request
        )

        # Thông báo cho Khách hàng khi khách sạn gửi phản hồi
        try:
            if review.guest and review.admin_reply:
                reply_preview = review.admin_reply[:100] + ('...' if len(review.admin_reply) > 100 else '')
                Notification.objects.create(
                    recipient=review.guest,
                    title="Khách sạn đã phản hồi đánh giá của bạn!",
                    message=(
                        f"Khách sạn TA Đà Nẵng đã gửi phản hồi cho đánh giá của bạn: \"{reply_preview}\". "
                        f"Cảm ơn quý khách đã đóng góp ý kiến để khách sạn nâng cao chất lượng dịch vụ!"
                    ),
                    notification_type='booking',
                    action_url='/booking-history',
                    priority='normal'
                )
        except Exception:
            pass

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

        log_action(
            user=request.user,
            action='UPDATE',
            module='OTHER',
            description=f'Chuyển trạng thái hiển thị đánh giá #{review.id} sang: {state_text}',
            request=request
        )

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

        log_action(
            user=request.user,
            action='DELETE',
            module='OTHER',
            description=f'Xóa đánh giá #{review_id} khỏi hệ thống',
            request=request
        )

        return Response(
            {
                'success': True,
                'message': f'Đã xóa đánh giá #{review_id} thành công khỏi hệ thống.',
            },
            status=status.HTTP_200_OK
        )
