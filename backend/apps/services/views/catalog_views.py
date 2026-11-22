"""Danh mục dịch vụ, món dịch vụ và booking đang lưu trú."""
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import ServiceCategory, ServiceItem
from ..serializers import ServiceCategorySerializer, ServiceItemSerializer
from ...bookings.models import Booking
from ...users.models import log_action
from .permissions import IsManagerOrAdminOnly


class ServiceCategoryListView(APIView):
    """
    API Lấy danh sách nhóm dịch vụ (GET /api/services/categories/)
    và Thêm mới nhóm dịch vụ (POST /api/services/categories/)
    """
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsManagerOrAdminOnly()]

    def get(self, request):
        categories = ServiceCategory.objects.all().order_by('id')
        serializer = ServiceCategorySerializer(categories, many=True, context={'request': request})
        return Response({
            'success': True,
            'count': categories.count(),
            'categories': serializer.data,
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ServiceCategorySerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Dữ liệu nhóm dịch vụ không hợp lệ.',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        cat = serializer.save()

        log_action(
            user=request.user,
            action='CREATE',
            module='SERVICE',
            description=f'Tạo nhóm dịch vụ "{cat.name}"',
            request=request
        )

        return Response({
            'success': True,
            'message': f'Đã tạo nhóm dịch vụ "{cat.name}" thành công.',
            'category': ServiceCategorySerializer(cat, context={'request': request}).data,
            'data': ServiceCategorySerializer(cat, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)


class ServiceCategoryDetailView(APIView):
    """
    API Chi tiết / Cập nhật / Xóa an toàn Nhóm dịch vụ:
    - GET /api/services/categories/<id>/
    - PUT/PATCH /api/services/categories/<id>/: Đổi tên, icon, mô tả nhóm
    - DELETE /api/services/categories/<id>/?reassign_to=<target_category_id>:
      + Nếu nhóm trống (0 dịch vụ): xóa ngay.
      + Nếu nhóm đang có dịch vụ: bắt buộc truyền reassign_to để chuyển toàn bộ dịch vụ
        sang nhóm đích trong 1 transaction trước khi xóa (tránh CASCADE mất dịch vụ & lịch sử đơn).
    """
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsManagerOrAdminOnly()]

    def get(self, request, pk):
        category = get_object_or_404(ServiceCategory, pk=pk)
        data = ServiceCategorySerializer(category, context={'request': request}).data
        return Response({'success': True, 'category': data, 'data': data}, status=status.HTTP_200_OK)

    def _update(self, request, pk, partial=False):
        category = get_object_or_404(ServiceCategory, pk=pk)
        old_name = category.name
        serializer = ServiceCategorySerializer(
            category,
            data=request.data,
            partial=partial,
            context={'request': request}
        )
        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Dữ liệu cập nhật nhóm dịch vụ không hợp lệ.',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        updated = serializer.save()
        log_action(
            user=request.user,
            action='UPDATE',
            module='SERVICE',
            description=f'Cập nhật nhóm dịch vụ "{old_name}" -> "{updated.name}"',
            request=request
        )
        out_data = ServiceCategorySerializer(updated, context={'request': request}).data
        return Response({
            'success': True,
            'message': f'Đã cập nhật nhóm dịch vụ "{updated.name}" thành công.',
            'category': out_data,
            'data': out_data
        }, status=status.HTTP_200_OK)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def delete(self, request, pk):
        category = get_object_or_404(ServiceCategory, pk=pk)
        cat_name = category.name
        total_items = category.services.count()

        reassign_to = request.query_params.get('reassign_to')
        if not reassign_to and isinstance(request.data, dict):
            reassign_to = request.data.get('reassign_to')

        if total_items > 0:
            if not reassign_to:
                return Response({
                    'success': False,
                    'requires_reassign': True,
                    'total_services_count': total_items,
                    'message': (
                        f'Nhóm "{cat_name}" hiện đang chứa {total_items} dịch vụ. '
                        'Vui lòng chọn một nhóm khác để chuyển toàn bộ dịch vụ trước khi xóa.'
                    )
                }, status=status.HTTP_400_BAD_REQUEST)

            if not str(reassign_to).isdigit() or int(reassign_to) == category.pk:
                return Response({
                    'success': False,
                    'message': 'Nhóm đích để chuyển dịch vụ không hợp lệ.'
                }, status=status.HTTP_400_BAD_REQUEST)

            target_cat = ServiceCategory.objects.filter(pk=int(reassign_to)).exclude(pk=category.pk).first()
            if not target_cat:
                return Response({
                    'success': False,
                    'message': 'Không tìm thấy nhóm đích để chuyển dịch vụ.'
                }, status=status.HTTP_404_NOT_FOUND)

            with transaction.atomic():
                moved_count = category.services.update(category=target_cat)
                category.delete()

            log_action(
                user=request.user,
                action='DELETE',
                module='SERVICE',
                description=f'Chuyển {moved_count} dịch vụ từ nhóm "{cat_name}" sang "{target_cat.name}" và xóa nhóm "{cat_name}"',
                request=request
            )
            return Response({
                'success': True,
                'moved_count': moved_count,
                'reassigned_to': target_cat.id,
                'message': f'Đã chuyển {moved_count} dịch vụ sang nhóm "{target_cat.name}" và xóa nhóm "{cat_name}".'
            }, status=status.HTTP_200_OK)

        category.delete()
        log_action(
            user=request.user,
            action='DELETE',
            module='SERVICE',
            description=f'Xóa nhóm dịch vụ "{cat_name}"',
            request=request
        )
        return Response({
            'success': True,
            'moved_count': 0,
            'message': f'Đã xóa nhóm dịch vụ "{cat_name}" thành công.'
        }, status=status.HTTP_200_OK)


class ServiceItemViewSet(viewsets.ModelViewSet):
    """
    CRUD Quản lý Danh mục Dịch vụ Khách sạn:
    - GET /api/services/items/: Khách hàng & Admin xem danh mục (hỗ trợ lọc category_id, q, status, all)
    - POST /api/services/items/: Thêm dịch vụ mới (hỗ trợ upload ảnh file hoặc URL)
    - GET /api/services/items/<id>/: Chi tiết dịch vụ
    - PUT/PATCH /api/services/items/<id>/: Sửa dịch vụ
    - DELETE /api/services/items/<id>/: Xóa dịch vụ
    - PATCH /api/services/items/<id>/toggle-active/: Đổi nhanh trạng thái phục vụ
    """
    serializer_class = ServiceItemSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsManagerOrAdminOnly()]

    def get_queryset(self):
        # Luôn tạo mới QuerySet để tránh cache in-memory
        queryset = ServiceItem.objects.select_related('category').all().order_by('category__id', 'id')

        # Đối với các thao tác theo ID cụ thể (retrieve, update, destroy, toggle_active), luôn trả về toàn bộ
        if self.action and self.action != 'list':
            return queryset

        category_id = self.request.query_params.get('category_id')
        search_query = self.request.query_params.get('q', '').strip()
        status_param = self.request.query_params.get('status', '').strip()
        all_param = self.request.query_params.get('all', '').lower() in ['1', 'true', 'yes']

        # Phân loại trạng thái phục vụ
        if status_param == 'active':
            queryset = queryset.filter(is_active=True)
        elif status_param == 'inactive':
            queryset = queryset.filter(is_active=False)
        elif status_param == 'all' or all_param:
            pass  # Lấy tất cả active + inactive cho trang quản lý admin
        else:
            # Mặc định (cho màn hình khách hàng): chỉ hiển thị dịch vụ đang hoạt động
            queryset = queryset.filter(is_active=True)

        if category_id and str(category_id).isdigit():
            queryset = queryset.filter(category_id=int(category_id))

        if search_query:
            queryset = queryset.filter(
                Q(name__icontains=search_query) |
                Q(description__icontains=search_query) |
                Q(ingredients__icontains=search_query) |
                Q(category__name__icontains=search_query)
            )

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True, context={'request': request})
        return Response({
            'success': True,
            'count': queryset.count(),
            'items': serializer.data,
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Dữ liệu dịch vụ không hợp lệ.',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        instance = serializer.save()

        log_action(
            user=request.user,
            action='CREATE',
            module='SERVICE',
            description=f'Thêm dịch vụ mới "{instance.name}" ({instance.price:,.0f} VNĐ, Nhóm: {instance.category.name if instance.category else "Chưa phân loại"})',
            request=request
        )

        out_serializer = self.get_serializer(instance, context={'request': request})
        return Response({
            'success': True,
            'message': f'Đã thêm dịch vụ "{instance.name}" thành công vào thực đơn.',
            'item': out_serializer.data,
            'data': out_serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial, context={'request': request})
        if not serializer.is_valid():
            return Response({
                'success': False,
                'message': 'Dữ liệu cập nhật không hợp lệ.',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        updated_instance = serializer.save()

        log_action(
            user=request.user,
            action='UPDATE',
            module='SERVICE',
            description=f'Cập nhật thông tin dịch vụ "{updated_instance.name}"',
            request=request
        )

        out_serializer = self.get_serializer(updated_instance, context={'request': request})
        return Response({
            'success': True,
            'message': f'Đã cập nhật dịch vụ "{updated_instance.name}" thành công.',
            'item': out_serializer.data,
            'data': out_serializer.data
        }, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.name
        active_requests = instance.requests.filter(status__in=['pending', 'in_progress', 'delivering']).count()
        if active_requests > 0:
            return Response({
                'success': False,
                'message': f'Không thể xóa dịch vụ "{name}" vì đang có {active_requests} yêu cầu đang chờ xử lý, đang thực hiện hoặc đang giao. Vui lòng bấm Tạm ngưng phục vụ thay vì xóa.'
            }, status=status.HTTP_400_BAD_REQUEST)

        completed_requests = instance.requests.filter(status='completed').count()
        if completed_requests > 0:
            return Response({
                'success': False,
                'message': (
                    f'Không thể xóa vĩnh viễn dịch vụ "{name}" vì đã phát sinh {completed_requests} đơn dịch vụ hoàn thành '
                    'trong lịch sử. Để bảo toàn báo cáo doanh thu, vui lòng bấm "Tạm ngưng phục vụ" để ẩn khỏi thực đơn.'
                )
            }, status=status.HTTP_400_BAD_REQUEST)

        instance.delete()

        log_action(
            user=request.user,
            action='DELETE',
            module='SERVICE',
            description=f'Xóa dịch vụ "{name}" khỏi hệ thống',
            request=request
        )

        return Response({
            'success': True,
            'message': f'Đã xóa dịch vụ "{name}" khỏi hệ thống thành công.'
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch', 'post'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        instance = self.get_object()
        instance.is_active = not instance.is_active
        instance.save(update_fields=['is_active'])
        status_text = "Đang phục vụ" if instance.is_active else "Tạm ngưng phục vụ"

        log_action(
            user=request.user,
            action='UPDATE',
            module='SERVICE',
            description=f'Chuyển trạng thái dịch vụ "{instance.name}" sang: {status_text}',
            request=request
        )

        return Response({
            'success': True,
            'message': f'Đã chuyển trạng thái dịch vụ "{instance.name}" sang: {status_text}.',
            'is_active': instance.is_active,
            'item': self.get_serializer(instance, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class ActiveGuestBookingsView(APIView):
    """
    API Lấy danh sách các đơn đặt phòng đang hiệu lực (GET /api/services/my-active-bookings/)
    Dùng cho Dropdown chọn phòng/mã booking khi khách hàng đặt dịch vụ.
    - Khách hàng đã đăng nhập: Lấy các đơn của chính họ đang ở (checked_in) hoặc đã duyệt (confirmed).
    - Nhân viên / Quản lý: Lấy tất cả các phòng đang có khách (checked_in).
    """
    permission_classes = [AllowAny]

    def get(self, request):
        user = request.user
        base_qs = Booking.objects.select_related(
            'room', 'category', 'guest'
        ).prefetch_related('guests').filter(
            status='checked_in',
            room__isnull=False
        ).order_by('-created_at')

        # Phân quyền
        is_staff_or_admin = (
            user.is_authenticated and (
                user.is_staff or 
                user.is_superuser or 
                getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'owner', 'staff', 'cashier'] or
                getattr(user, 'role', '') != 'guest'
            )
        )

        if not user.is_authenticated:
            return Response({
                'success': True,
                'count': 0,
                'bookings': [],
                'data': []
            }, status=status.HTTP_200_OK)

        if not is_staff_or_admin:
            user_email = user.email.strip() if user.email else ''
            if user_email:
                base_qs = base_qs.filter(Q(guest=user) | Q(guest__email=user_email))
            else:
                base_qs = base_qs.filter(guest=user)

        results = []
        for b in base_qs:
            if not b.room or not b.room.room_number:
                continue
            room_num = b.room.room_number
            cat_name = b.category.name if b.category else (b.room.category.name if b.room and b.room.category else 'Tiêu chuẩn')

            # 1. Ưu tiên lấy tên người đại diện lưu trú của từng phòng (rất quan trọng cho đơn đặt theo đoàn công ty)
            guest_name = ''
            try:
                primary_guest = b.guests.filter(is_primary=True).first() or b.guests.first()
                if primary_guest and primary_guest.full_name:
                    guest_name = primary_guest.full_name.strip()
            except Exception:
                pass

            # 2. Nếu phòng chưa có khai báo lưu trú chi tiết, lấy từ tài khoản đặt phòng
            if not guest_name and b.guest:
                guest_name = (b.guest.get_full_name().strip() or f"{b.guest.first_name or ''} {b.guest.last_name or ''}".strip()) or b.guest.username

            if not guest_name:
                guest_name = 'Khách lưu trú'

            results.append({
                'id': b.id,
                'booking_code': b.booking_code,
                'room_number': room_num,
                'room_name': cat_name,
                'guest_name': guest_name,
                'status': b.status,
                'status_display': b.get_status_display(),
                'display_label': f"Phòng {room_num} • Mã #{b.booking_code} ({guest_name})"
            })

        return Response({
            'success': True,
            'count': len(results),
            'bookings': results,
            'data': results
        }, status=status.HTTP_200_OK)
