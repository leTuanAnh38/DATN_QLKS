from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import BasePermission, IsAuthenticated, AllowAny
from django.db.models import Q, Count, Avg, Case, When, Value, IntegerField
from django.utils import timezone
from django.utils.text import slugify
from ..users.models import log_action, User
from ..users.views import check_role_permission
from ..bookings.models import Booking, BookingExtraService
from ..notifications.models import Notification
from .models import Room, RoomCategory, Amenity, RoomImage, MaintenanceTicket, MinibarItem, MinibarCheck, LostAndFoundItem
from .serializers import (
    AmenitySerializer,
    RoomSerializer,
    RoomCategorySerializer,
    RoomImageSerializer,
    RoomStatusUpdateSerializer,
    MaintenanceTicketSerializer,
    MinibarItemSerializer,
    MinibarCheckSerializer,
    LostAndFoundItemSerializer
)


def generate_unique_slug(name, instance=None):
    """
    Tự động tạo slug không dấu, không trùng lặp cho Hạng phòng.
    """
    base_slug = slugify(name) or 'room-category'
    slug = base_slug
    counter = 1
    qs = RoomCategory.objects.filter(slug=slug)
    if instance:
        qs = qs.exclude(id=instance.id)
    while qs.exists():
        slug = f"{base_slug}-{counter}"
        counter += 1
        qs = RoomCategory.objects.filter(slug=slug)
        if instance:
            qs = qs.exclude(id=instance.id)
    return slug


class IsHotelStaffOrAdmin(BasePermission):
    """
    Cho phép nhân viên khách sạn (Lễ tân, Buồng phòng, Quản lý, Admin)
    truy cập và thao tác trên sơ đồ phòng. Khách hàng thông thường (role='guest') bị chặn.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        # Mọi tài khoản nhân viên nội bộ (khác 'guest')
        return getattr(request.user, 'role', '') != 'guest'


class IsManagerOrAdminOnly(BasePermission):
    """
    Kiểm tra phân quyền động theo ma trận quyền cho Hạng phòng (categories).
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        action_map = {
            'GET': 'read',
            'POST': 'create',
            'PUT': 'update',
            'PATCH': 'update',
            'DELETE': 'delete'
        }
        action = action_map.get(request.method, 'read')
        return check_role_permission(request.user, 'categories', action)


# =========================================================================
# 1. VIEWSET QUẢN LÝ HẠNG PHÒNG & UPLOAD HÌNH ẢNH (Room Categories & Images)
# =========================================================================

class RoomCategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet xử lý CRUD toàn diện cho Hạng phòng:
    - GET /api/rooms/categories/: Xem danh sách (Công khai cho Khách hàng & Trang chủ)
    - POST /api/rooms/categories/: Tạo hạng phòng mới + Upload nhiều ảnh cùng lúc
    - GET /api/rooms/categories/<id>/: Chi tiết hạng phòng
    - PATCH / PUT /api/rooms/categories/<id>/: Cập nhật thông tin + Thêm/Xóa ảnh
    - DELETE /api/rooms/categories/<id>/: Xóa hạng phòng
    - POST /api/rooms/categories/<id>/delete-image/: Xóa ảnh cụ thể
    - POST /api/rooms/categories/<id>/set-feature-image/: Chọn ảnh đại diện chính
    """
    queryset = RoomCategory.objects.prefetch_related('images', 'amenities', 'rooms').all().order_by('base_price')
    serializer_class = RoomCategorySerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return RoomCategory.objects.prefetch_related('images', 'amenities', 'rooms').annotate(
            avg_rating=Avg('reviews__overall_rating', filter=Q(reviews__is_visible=True)),
            total_reviews=Count('reviews', filter=Q(reviews__is_visible=True))
        ).order_by('base_price')

    def get_permissions(self):
        # Khách vãng lai và Trang chủ có thể xem danh sách và chi tiết
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsManagerOrAdminOnly()]

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()

        # Bộ lọc tìm kiếm theo tên hoặc loại giường
        q = request.query_params.get('q', '').strip()
        if q:
            queryset = queryset.filter(
                Q(name__icontains=q) |
                Q(description__icontains=q) |
                Q(bed_type__icontains=q)
            )

        serializer = self.get_serializer(queryset, many=True, context={'request': request})
        return Response({
            'success': True,
            'count': queryset.count(),
            'categories': serializer.data,
            'results': serializer.data
        }, status=status.HTTP_200_OK)

    def get_object(self):
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_value = self.kwargs.get(lookup_url_kwarg)
        if lookup_value is not None:
            # Nếu là số -> tìm theo ID (pk)
            if str(lookup_value).isdigit():
                obj = RoomCategory.objects.filter(pk=lookup_value).first()
                if obj:
                    self.check_object_permissions(self.request, obj)
                    return obj
            # Nếu là chuỗi slug
            obj = RoomCategory.objects.filter(slug=lookup_value).first()
            if obj:
                self.check_object_permissions(self.request, obj)
                return obj
        from rest_framework.exceptions import NotFound
        raise NotFound("Không tìm thấy hạng phòng yêu cầu.")

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, context={'request': request})
        return Response({
            'success': True,
            'category': serializer.data
        }, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        name = data.get('name', '').strip()
        if not name:
            return Response({
                'success': False,
                'message': 'Tên hạng phòng không được để trống.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Tự động tạo slug không trùng
        slug = generate_unique_slug(name)
        data['slug'] = slug

        # Làm sạch promo_price nếu gửi chuỗi rỗng
        if 'promo_price' in data and (data['promo_price'] == '' or data['promo_price'] is None):
            data.pop('promo_price', None)

        serializer = self.get_serializer(data=data, context={'request': request})
        if not serializer.is_valid():
            first_error = next(iter(serializer.errors.values()))
            error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
            return Response({
                'success': False,
                'message': error_msg,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        category = serializer.save()

        # Xử lý các file ảnh được gửi lên từ FormData (hỗ trợ nhiều ảnh)
        files = request.FILES.getlist('images') or request.FILES.getlist('images[]')
        if not files:
            single = request.FILES.get('image')
            if single:
                files = [single]

        feature_index = 0
        try:
            feature_index = int(request.data.get('feature_image_index', 0))
        except (ValueError, TypeError):
            feature_index = 0

        for idx, file in enumerate(files):
            is_feature = (idx == feature_index) or (idx == 0 and len(files) == 1)
            RoomImage.objects.create(
                room_category=category,
                image=file,
                is_feature=is_feature
            )

        category.refresh_from_db()

        log_action(
            user=request.user,
            action='CREATE',
            module='ROOM',
            description=f'Thêm mới hạng phòng "{category.name}" (Giá cơ sở: {category.base_price:,.0f} VNĐ)',
            request=request
        )

        return Response({
            'success': True,
            'message': f'Thêm mới hạng phòng "{category.name}" thành công!',
            'category': RoomCategorySerializer(category, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', True)
        instance = self.get_object()
        data = request.data.copy()

        # Cập nhật slug nếu tên thay đổi
        if 'name' in data and data.get('name', '').strip():
            name = data.get('name').strip()
            if name != instance.name:
                data['slug'] = generate_unique_slug(name, instance=instance)

        # Xử lý promo_price rỗng
        if 'promo_price' in data and (data['promo_price'] == '' or data['promo_price'] is None):
            instance.promo_price = None
            instance.save(update_fields=['promo_price'])
            data.pop('promo_price', None)

        serializer = self.get_serializer(instance, data=data, partial=partial, context={'request': request})
        if not serializer.is_valid():
            first_error = next(iter(serializer.errors.values()))
            error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
            return Response({
                'success': False,
                'message': error_msg,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        category = serializer.save()

        # 1. Xóa ảnh theo danh sách ID yêu cầu xóa (nếu có)
        delete_ids_raw = request.data.get('delete_image_ids') or request.data.get('deleted_image_ids')
        if delete_ids_raw:
            if isinstance(delete_ids_raw, str):
                del_ids = [int(i.strip()) for i in delete_ids_raw.split(',') if i.strip().isdigit()]
            elif isinstance(delete_ids_raw, list):
                del_ids = [int(i) for i in delete_ids_raw if str(i).isdigit()]
            else:
                del_ids = []
            if del_ids:
                category.images.filter(id__in=del_ids).delete()

        # 2. Upload các file ảnh mới gửi kèm (nếu có)
        new_files = request.FILES.getlist('images') or request.FILES.getlist('images[]')
        if not new_files:
            single = request.FILES.get('image')
            if single:
                new_files = [single]

        newly_created = []
        for file in new_files:
            img = RoomImage.objects.create(
                room_category=category,
                image=file,
                is_feature=False
            )
            newly_created.append(img)

        # 3. Cập nhật ảnh đại diện chính (theo feature_image_id hoặc feature_image_index)
        feature_id = request.data.get('feature_image_id')
        if feature_id and str(feature_id).isdigit():
            category.images.all().update(is_feature=False)
            category.images.filter(id=int(feature_id)).update(is_feature=True)
        elif newly_created and 'feature_image_index' in request.data:
            try:
                f_idx = int(request.data.get('feature_image_index'))
                if 0 <= f_idx < len(newly_created):
                    category.images.all().update(is_feature=False)
                    newly_created[f_idx].is_feature = True
                    newly_created[f_idx].save()
            except (ValueError, TypeError):
                pass

        # Đảm bảo nếu có ảnh thì luôn có 1 ảnh đại diện chính
        if category.images.exists() and not category.images.filter(is_feature=True).exists():
            first_img = category.images.first()
            first_img.is_feature = True
            first_img.save()

        category.refresh_from_db()

        log_action(
            user=request.user,
            action='UPDATE',
            module='ROOM',
            description=f'Cập nhật hạng phòng "{category.name}"',
            request=request
        )

        return Response({
            'success': True,
            'message': f'Cập nhật hạng phòng "{category.name}" thành công!',
            'category': RoomCategorySerializer(category, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        category = self.get_object()
        name = category.name
        rooms_count = category.rooms.count()
        if rooms_count > 0:
            return Response({
                'success': False,
                'message': f'Không thể xóa hạng phòng "{name}" vì hiện đang có {rooms_count} phòng thực tế liên kết tới hạng phòng này. Vui lòng chuyển hoặc xóa các phòng thực tế trước.'
            }, status=status.HTTP_400_BAD_REQUEST)

        category.delete()

        log_action(
            user=request.user,
            action='DELETE',
            module='ROOM',
            description=f'Xóa hạng phòng "{name}"',
            request=request
        )

        return Response({
            'success': True,
            'message': f'Đã xóa hạng phòng "{name}" thành công.'
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='delete-image')
    def delete_image(self, request, pk=None):
        category = self.get_object()
        image_id = request.data.get('image_id')
        if not image_id:
            return Response({'success': False, 'message': 'Thiếu ID ảnh cần xóa.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            img = category.images.get(id=image_id)
            was_feature = img.is_feature
            img.delete()

            if was_feature and category.images.exists():
                first_img = category.images.first()
                first_img.is_feature = True
                first_img.save()

            category.refresh_from_db()
            return Response({
                'success': True,
                'message': 'Đã xóa ảnh thành công.',
                'category': RoomCategorySerializer(category, context={'request': request}).data
            }, status=status.HTTP_200_OK)
        except RoomImage.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy ảnh cần xóa.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], url_path='set-feature-image')
    def set_feature_image(self, request, pk=None):
        category = self.get_object()
        image_id = request.data.get('image_id')
        if not image_id:
            return Response({'success': False, 'message': 'Thiếu ID ảnh cần đặt làm đại diện.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            category.images.all().update(is_feature=False)
            target = category.images.get(id=image_id)
            target.is_feature = True
            target.save()

            category.refresh_from_db()
            return Response({
                'success': True,
                'message': 'Đã đặt ảnh đại diện chính thành công.',
                'category': RoomCategorySerializer(category, context={'request': request}).data
            }, status=status.HTTP_200_OK)
        except RoomImage.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy ảnh này.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], url_path='upload-images', parser_classes=[MultiPartParser, FormParser])
    def upload_images(self, request, pk=None):
        category = self.get_object()
        files = request.FILES.getlist('images') or request.FILES.getlist('images[]')
        if not files:
            single = request.FILES.get('image')
            if single:
                files = [single]

        if not files:
            return Response({'success': False, 'message': 'Không có file ảnh nào được gửi lên.'}, status=status.HTTP_400_BAD_REQUEST)

        has_feature = category.images.filter(is_feature=True).exists()
        for idx, file in enumerate(files):
            is_feature = (not has_feature and idx == 0)
            RoomImage.objects.create(
                room_category=category,
                image=file,
                is_feature=is_feature
            )

        category.refresh_from_db()
        return Response({
            'success': True,
            'message': f'Đã tải lên {len(files)} ảnh mới thành công.',
            'category': RoomCategorySerializer(category, context={'request': request}).data
        }, status=status.HTTP_200_OK)


# Giữ alias tương thích nếu code cũ gọi RoomCategoryListView
RoomCategoryListView = RoomCategoryViewSet.as_view({'get': 'list'})


# =========================================================================
# 2. API DANH SÁCH & TẠO MỚI PHÒNG THỰC TẾ (Rooms Board)
# =========================================================================

class AdminRoomListCreateView(APIView):
    permission_classes = [IsHotelStaffOrAdmin]

    def get(self, request):
        if not (request.user.is_superuser or check_role_permission(request.user, 'rooms', 'read')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền xem sơ đồ phòng.'
            }, status=status.HTTP_403_FORBIDDEN)

        queryset = Room.objects.select_related('category').all()

        # 1. Tìm kiếm theo số phòng hoặc tên loại phòng
        q = request.query_params.get('q', '').strip()
        if q:
            queryset = queryset.filter(
                Q(room_number__icontains=q) |
                Q(category__name__icontains=q)
            )

        # 2. Lọc theo Tầng (Floor)
        floor = request.query_params.get('floor')
        if floor and floor != 'all':
            try:
                queryset = queryset.filter(floor=int(floor))
            except ValueError:
                pass

        # 3. Lọc theo Trạng thái (Status)
        room_status = request.query_params.get('status')
        if room_status and room_status != 'all':
            queryset = queryset.filter(status=room_status)

        # 4. Lọc theo Loại phòng (Category)
        category_id = request.query_params.get('category')
        if category_id and category_id != 'all':
            try:
                queryset = queryset.filter(category_id=int(category_id))
            except ValueError:
                pass

        # Sắp xếp theo tầng tăng dần, số phòng tăng dần
        queryset = queryset.order_by('floor', 'room_number')

        # Thống kê toàn khách sạn (không bị ảnh hưởng bởi bộ lọc tìm kiếm)
        all_rooms = Room.objects.all()
        total_rooms = all_rooms.count()
        available_count = all_rooms.filter(status='available').count()
        occupied_count = all_rooms.filter(status='occupied').count()
        cleaning_count = all_rooms.filter(status='cleaning').count()
        maintenance_count = all_rooms.filter(status='maintenance').count()

        occupancy_rate = 0.0
        if total_rooms > 0:
            occupancy_rate = round((occupied_count / total_rooms) * 100, 1)

        # Danh sách tất cả các tầng hiện có trong khách sạn
        floors = list(
            Room.objects.values_list('floor', flat=True).distinct().order_by('floor')
        )

        # Danh sách categories để frontend render dropdown
        categories = RoomCategory.objects.all().order_by('base_price')

        serializer = RoomSerializer(queryset, many=True)

        return Response({
            'success': True,
            'count': queryset.count(),
            'rooms': serializer.data,
            'floors': floors,
            'categories': RoomCategorySerializer(categories, many=True).data,
            'stats': {
                'total': total_rooms,
                'available': available_count,
                'occupied': occupied_count,
                'cleaning': cleaning_count,
                'maintenance': maintenance_count,
                'occupancy_rate': occupancy_rate,
            }
        }, status=status.HTTP_200_OK)

    def post(self, request):
        if not (request.user.is_superuser or check_role_permission(request.user, 'rooms', 'create')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền thêm phòng mới vào sơ đồ (Yêu cầu quyền Thêm mới).'
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = RoomSerializer(data=request.data)
        if serializer.is_valid():
            room = serializer.save()

            log_action(
                user=request.user,
                action='CREATE',
                module='ROOM',
                description=f'Thêm phòng mới {room.room_number} (Tầng {room.floor}, Hạng phòng: {room.category.name if room.category else "Chưa chọn"})',
                request=request
            )

            return Response({
                'success': True,
                'message': f'Thêm phòng {room.room_number} (Tầng {room.floor}) thành công!',
                'room': RoomSerializer(room).data
            }, status=status.HTTP_201_CREATED)

        first_error = next(iter(serializer.errors.values()))
        error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
        return Response({
            'success': False,
            'message': error_msg,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


# =========================================================================
# 3. API CHI TIẾT, CẬP NHẬT & XÓA PHÒNG
# =========================================================================

class AdminRoomDetailView(APIView):
    permission_classes = [IsHotelStaffOrAdmin]

    def get_object(self, pk):
        try:
            return Room.objects.select_related('category').get(pk=pk)
        except Room.DoesNotExist:
            return None

    def get(self, request, pk):
        if not (request.user.is_superuser or check_role_permission(request.user, 'rooms', 'read')):
            return Response({'success': False, 'message': 'Bạn không có quyền xem thông tin phòng.'}, status=status.HTTP_403_FORBIDDEN)

        room = self.get_object(pk)
        if not room:
            return Response({'success': False, 'message': 'Không tìm thấy phòng.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'success': True, 'room': RoomSerializer(room).data}, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        if not (request.user.is_superuser or check_role_permission(request.user, 'rooms', 'update')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền chỉnh sửa thông tin phòng (Yêu cầu quyền Cập nhật).'
            }, status=status.HTTP_403_FORBIDDEN)

        room = self.get_object(pk)
        if not room:
            return Response({'success': False, 'message': 'Không tìm thấy phòng.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = RoomSerializer(room, data=request.data, partial=True)
        if serializer.is_valid():
            updated_room = serializer.save()

            log_action(
                user=request.user,
                action='UPDATE',
                module='ROOM',
                description=f'Cập nhật thông tin phòng {updated_room.room_number}',
                request=request
            )

            return Response({
                'success': True,
                'message': f'Cập nhật thông tin phòng {updated_room.room_number} thành công!',
                'room': RoomSerializer(updated_room).data
            }, status=status.HTTP_200_OK)

        first_error = next(iter(serializer.errors.values()))
        error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
        return Response({
            'success': False,
            'message': error_msg,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not (request.user.is_superuser or check_role_permission(request.user, 'rooms', 'delete')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền xóa phòng khỏi sơ đồ (Yêu cầu quyền Xóa).'
            }, status=status.HTTP_403_FORBIDDEN)

        room = self.get_object(pk)
        if not room:
            return Response({'success': False, 'message': 'Không tìm thấy phòng cần xóa.'}, status=status.HTTP_404_NOT_FOUND)

        room_num = room.room_number
        room.delete()

        log_action(
            user=request.user,
            action='DELETE',
            module='ROOM',
            description=f'Xóa phòng {room_num} khỏi sơ đồ phòng',
            request=request
        )

        return Response({
            'success': True,
            'message': f'Đã xóa phòng {room_num} khỏi sơ đồ phòng khách sạn thành công.'
        }, status=status.HTTP_200_OK)


# =========================================================================
# 4. API THAY ĐỔI NHANH TRẠNG THÁI PHÒNG (Cho Lễ tân & Buồng phòng)
# =========================================================================

class AdminRoomStatusUpdateView(APIView):
    """
    Endpoint tối ưu tốc độ cho Lễ tân / Buồng phòng bấm nút nhanh đổi trạng thái:
    available <-> occupied <-> cleaning <-> maintenance
    """
    permission_classes = [IsHotelStaffOrAdmin]

    def patch(self, request, pk):
        if not (request.user.is_superuser or check_role_permission(request.user, 'rooms', 'update')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền cập nhật trạng thái phòng (Yêu cầu quyền Cập nhật).'
            }, status=status.HTTP_403_FORBIDDEN)

        user_role = getattr(request.user, 'role', '')
        if user_role in ['technician', 'service_staff']:
            return Response({
                'success': False,
                'message': 'Vai trò của bạn không được phép thay đổi trực tiếp trạng thái phòng. Kỹ thuật viên vui lòng thao tác qua phiếu Bảo trì.'
            }, status=status.HTTP_403_FORBIDDEN)

        if user_role == 'housekeeper':
            new_status = request.data.get('status')
            if new_status not in ['available', 'cleaning']:
                return Response({
                    'success': False,
                    'message': 'Nhân viên buồng phòng chỉ được cập nhật trạng thái dọn dẹp phòng (Trống/Đang dọn).'
                }, status=status.HTTP_403_FORBIDDEN)

        try:
            room = Room.objects.select_related('category').get(pk=pk)
        except Room.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy phòng.'}, status=status.HTTP_404_NOT_FOUND)

        old_status = room.status
        active_booking = room.bookings.filter(status='checked_in').select_related('guest').first()

        update_data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        requested_status = update_data.get('status')

        # CHẶN LỄ TÂN TỰ Ý DUYỆT PHÒNG SẠCH: Chỉ Buồng phòng (housekeeper) hoặc Quản lý/Admin mới có quyền nghiệm thu dọn xong
        if user_role == 'receptionist' and old_status == 'cleaning' and requested_status == 'available':
            return Response({
                'success': False,
                'message': 'Chỉ nhân viên Buồng phòng (Housekeeping) hoặc Quản lý mới có quyền xác nhận hoàn tất dọn dẹp phòng.'
            }, status=status.HTTP_403_FORBIDDEN)

        # CHẶN LỖI NGHIỆP VỤ: Không cho phép đổi trực tiếp từ 'occupied' sang 'available' khi khách chưa check-out hoặc đổi phòng
        if active_booking and old_status == 'occupied' and requested_status == 'available':
            return Response({
                'success': False,
                'message': f'Phòng {room.room_number} hiện đang có khách lưu trú (#{active_booking.booking_code}). Không thể chuyển trực tiếp sang "Phòng trống" khi khách chưa làm thủ tục Check-out hoặc Đổi phòng.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # BẢO VỆ PHÒNG CÓ KHÁCH: Khi dọn dẹp xong phòng (từ cleaning) mà phòng đang có khách ở, tự động về 'occupied'
        if active_booking and requested_status == 'available':
            update_data['status'] = 'occupied'

        serializer = RoomStatusUpdateSerializer(room, data=update_data, partial=True)
        if serializer.is_valid():
            updated_room = serializer.save()
            new_status = updated_room.status
            all_rooms = Room.objects.all()
            available_count = all_rooms.filter(status='available').count()
            occupied_count = all_rooms.filter(status='occupied').count()
            cleaning_count = all_rooms.filter(status='cleaning').count()
            maintenance_count = all_rooms.filter(status='maintenance').count()
            total_rooms = all_rooms.count()
            occupancy_rate = round((occupied_count / total_rooms * 100), 1) if total_rooms > 0 else 0
            stats_data = {
                'total': total_rooms,
                'available': available_count,
                'occupied': occupied_count,
                'cleaning': cleaning_count,
                'maintenance': maintenance_count,
                'occupancy_rate': occupancy_rate,
            }

            # Ghi nhận Nhật ký thao tác hệ thống (Audit Log)
            log_action(
                user=request.user,
                action='UPDATE',
                module='ROOM',
                description=f"Cập nhật phòng {updated_room.room_number} sang trạng thái \"{updated_room.get_status_display()}\"",
                request=request
            )

            # 1. KHI BUỒNG PHÒNG DỌN XONG (cleaning -> available hoặc occupied khi có khách ở)
            if old_status == 'cleaning' and new_status in ['available', 'occupied']:
                try:
                    staff_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Nhân viên Buồng phòng"
                    recipients = User.objects.filter(
                        Q(role__in=['receptionist', 'admin']) | (Q(is_superuser=True) & ~Q(role__in=['owner', 'manager', 'guest', 'housekeeper', 'technician', 'service_staff', 'cashier']))
                    ).distinct()
                    cat_name = updated_room.category.name if updated_room.category else 'Tiêu chuẩn'
                    
                    if active_booking:
                        guest_name = active_booking.guest.get_full_name() if active_booking.guest else active_booking.guest_name
                        notif_title = f"✨ [DỌN PHÒNG HOÀN TẤT] Phòng {updated_room.room_number} đã dọn xong!"
                        notif_message = (
                            f"Nhân viên ({staff_name}) đã hoàn tất dọn dẹp phòng {updated_room.room_number} ({cat_name}).\n"
                            f"• Phòng đang có khách lưu trú: {guest_name} (#{active_booking.booking_code})\n"
                            f"• Trạng thái hiện tại: Có khách (Occupied) - Tiếp tục phục vụ khách."
                        )
                    else:
                        notif_title = f"✨ [PHÒNG SẴN SÀNG] Phòng {updated_room.room_number} đã dọn xong!"
                        notif_message = (
                            f"Nhân viên ({staff_name}) đã hoàn tất dọn dẹp phòng {updated_room.room_number} ({cat_name}).\n"
                            f"• Trạng thái hiện tại: Trống (Sẵn sàng mở bán)\n"
                            f"Lễ tân có thể tiến hành Gán phòng hoặc Check-in đón khách ngay."
                        )
                    notifs = [
                        Notification(
                            recipient=r,
                            title=notif_title,
                            message=notif_message,
                            notification_type='room',
                            action_url='/admin/rooms',
                            priority='normal'
                        )
                        for r in recipients
                    ]
                    if notifs:
                        Notification.objects.bulk_create(notifs)
                except Exception:
                    pass

            # 2. KHI YÊU CẦU DỌN DẸP (trạng thái khác -> cleaning): Gửi thông báo đến Buồng phòng
            elif old_status != 'cleaning' and new_status == 'cleaning':
                try:
                    staff_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Lễ tân"
                    recipients = User.objects.filter(
                        Q(role__in=['housekeeper', 'admin']) | (Q(is_superuser=True) & ~Q(role__in=['owner', 'manager', 'guest', 'technician', 'service_staff', 'cashier']))
                    ).distinct()
                    cat_name = updated_room.category.name if updated_room.category else 'Tiêu chuẩn'
                    notif_title = f"🧹 [YÊU CẦU DỌN PHÒNG] Phòng {updated_room.room_number} cần dọn dẹp!"
                    notif_message = (
                        f"Phòng {updated_room.room_number} ({cat_name}) vừa được chuyển sang 'Đang dọn dẹp' (Cleaning).\n"
                        f"• Người yêu cầu: {staff_name}\n"
                        f"Kính mời bộ phận Buồng phòng tiến hành vệ sinh và thay ga gối."
                    )
                    notifs = [
                        Notification(
                            recipient=r,
                            title=notif_title,
                            message=notif_message,
                            notification_type='room',
                            action_url='/admin/rooms',
                            priority='normal'
                        )
                        for r in recipients
                    ]
                    if notifs:
                        Notification.objects.bulk_create(notifs)
                except Exception:
                    pass

            return Response({
                'success': True,
                'message': f'Đã đổi trạng thái phòng {updated_room.room_number} thành "{updated_room.get_status_display()}".',
                'room': RoomSerializer(updated_room).data,
                'stats': stats_data,
            }, status=status.HTTP_200_OK)

        first_error = next(iter(serializer.errors.values()))
        error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
        return Response({
            'success': False,
            'message': error_msg,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class AmenityViewSet(viewsets.ModelViewSet):
    """
    API Quản lý Tiện nghi phòng (Amenities):
    - GET /api/rooms/amenities/: Lấy toàn bộ danh sách tiện nghi
    - POST /api/rooms/amenities/: Tạo tiện nghi mới (Chỉ Manager/Admin)
    """
    queryset = Amenity.objects.all().order_by('id')
    serializer_class = AmenitySerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsManagerOrAdminOnly()]


# =========================================================================
# 5. API QUẢN LÝ PHIẾU BẢO TRÌ & THIẾT BỊ HỎNG
# =========================================================================

class MaintenanceTicketViewSet(viewsets.ModelViewSet):
    """
    API Quản lý Phiếu Bảo Trì & Sửa Chữa Thiết Bị Phòng:
    - GET /api/rooms/maintenance-tickets/: Danh sách phiếu bảo trì
    - POST /api/rooms/maintenance-tickets/: Báo hỏng thiết bị (Tự động chuyển phòng sang 'maintenance')
    - POST /api/rooms/maintenance-tickets/{id}/complete/: Hoàn thành sửa chữa (Tự động chuyển phòng sang 'cleaning' để buồng phòng dọn dẹp)
    """
    queryset = MaintenanceTicket.objects.select_related('room', 'booking', 'technician', 'created_by')
    serializer_class = MaintenanceTicketSerializer
    permission_classes = [IsHotelStaffOrAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        room_id = self.request.query_params.get('room_id') or self.request.query_params.get('room')
        status_param = self.request.query_params.get('status')
        if room_id:
            qs = qs.filter(room_id=room_id)
        if status_param:
            qs = qs.filter(status=status_param)

        # Ưu tiên phiếu Đang sửa chữa (status='fixing') lên ĐẦU danh sách, Đã hoàn thành/Hủy xuống dưới
        qs = qs.annotate(
            status_priority=Case(
                When(status='fixing', then=Value(0)),
                When(status='completed', then=Value(1)),
                When(status='cancelled', then=Value(2)),
                default=Value(3),
                output_field=IntegerField()
            )
        ).order_by('status_priority', '-start_date', '-id')

        return qs

    def create(self, request, *args, **kwargs):
        room_id = request.data.get('room') or request.data.get('room_id')
        if not room_id:
            return Response({'success': False, 'message': 'Thiếu thông tin phòng cần bảo trì.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            room = Room.objects.get(pk=room_id)
        except Room.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy phòng.'}, status=status.HTTP_404_NOT_FOUND)

        equipment_name = request.data.get('equipment_name', '').strip()
        if not equipment_name:
            return Response({'success': False, 'message': 'Vui lòng nhập tên thiết bị bị hư hỏng.'}, status=status.HTTP_400_BAD_REQUEST)

        issue_type = request.data.get('issue_type', 'ac')
        description = request.data.get('description', '')
        parts_replaced = request.data.get('parts_replaced', '')
        cost = int(request.data.get('cost') or 0)
        is_guest_fault = bool(request.data.get('is_guest_fault', False))
        booking_id = request.data.get('booking') or request.data.get('booking_id')
        technician_id = request.data.get('technician') or request.data.get('technician_id')

        booking = None
        if booking_id:
            booking = Booking.objects.filter(pk=booking_id).first()
        elif room.status == 'occupied':
            booking = room.bookings.filter(status='checked_in').first()

        technician = None
        if technician_id:
            technician = User.objects.filter(pk=technician_id).first()

        ticket = MaintenanceTicket.objects.create(
            room=room,
            equipment_name=equipment_name,
            issue_type=issue_type,
            description=description,
            parts_replaced=parts_replaced,
            cost=cost,
            is_guest_fault=is_guest_fault,
            booking=booking,
            technician=technician,
            created_by=request.user if request.user.is_authenticated else None,
            status='fixing'
        )

        # 1. CÁCH LY PHÒNG: Tự động chuyển phòng sang 'maintenance'
        room.status = 'maintenance'
        room.save(update_fields=['status'])

        # 2. XỬ LÝ TIỀN ĐỀN BÙ: Nếu khách làm hỏng và có đơn đặt phòng + chi phí > 0
        if is_guest_fault and booking and cost > 0:
            BookingExtraService.objects.create(
                booking=booking,
                service_name=f"Bồi thường hỏng thiết bị: {equipment_name}",
                quantity=1,
                price=cost
            )

        # 3. Ghi nhận Nhật ký thao tác
        fault_text = f" (Khách bồi thường {cost:,.0f} đ)" if (is_guest_fault and cost > 0) else " (Bảo dưỡng khách sạn)"
        log_action(
            user=request.user,
            action='CREATE',
            module='ROOM',
            description=f"Lập phiếu bảo trì #{ticket.ticket_code} cho phòng {room.room_number}: {equipment_name}{fault_text}",
            request=request
        )

        # 4. GỬI THÔNG BÁO TỰ ĐỘNG ĐẾN KỸ THUẬT VIÊN VÀ QUẢN LÝ
        try:
            reporter_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Nhân viên"
            tech_users = User.objects.filter(
                Q(role__in=['technician', 'receptionist', 'admin', 'manager']) |
                (Q(is_superuser=True) & ~Q(role__in=['owner', 'guest', 'housekeeper', 'service_staff', 'cashier']))
            ).distinct()
            fault_note = "Do khách làm hỏng (Bồi thường)" if is_guest_fault else "Bảo dưỡng khách sạn"
            issue_labels = {
                'ac': 'Điều hòa / Máy lạnh',
                'electric': 'Điện / Đèn / Ổ cắm',
                'water': 'Nước / Vòi / Cống / Toilet',
                'lock': 'Khóa từ / Cửa phòng',
                'tv': 'Tivi / Remote / Mạng',
                'furniture': 'Nội thất / Giường / Tủ / Ghế',
                'broken_item': 'Vật dụng bể vỡ',
                'other': 'Khác'
            }
            issue_display = issue_labels.get(issue_type, issue_type)
            notif_title = f"🛠️ [BẢO TRÌ] P.{room.room_number} báo hỏng: {equipment_name}"
            notif_message = (
                f"Phòng {room.room_number} vừa được chuyển sang 'Bảo trì' cần kiểm tra gấp:\n"
                f"• Thiết bị: {equipment_name} ({issue_display})\n"
                f"• Chi tiết: {description or 'Cần kỹ thuật đến kiểm tra'}\n"
                f"• Phân loại: {fault_note}\n"
                f"• Người báo: {reporter_name}\n"
                f"• Mã phiếu: #{ticket.ticket_code}"
            )
            notifs = [
                Notification(
                    recipient=recipient,
                    title=notif_title,
                    message=notif_message,
                    notification_type='room',
                    action_url='/admin/rooms',
                    priority='high'
                )
                for recipient in tech_users
            ]
            if notifs:
                Notification.objects.bulk_create(notifs)
        except Exception as e:
            pass

        all_rooms = Room.objects.all()
        stats_data = {
            'total': all_rooms.count(),
            'available': all_rooms.filter(status='available').count(),
            'occupied': all_rooms.filter(status='occupied').count(),
            'cleaning': all_rooms.filter(status='cleaning').count(),
            'maintenance': all_rooms.filter(status='maintenance').count(),
        }

        return Response({
            'success': True,
            'message': f'Đã lập phiếu bảo trì #{ticket.ticket_code} và chuyển phòng {room.room_number} sang "Đang bảo trì".',
            'ticket': MaintenanceTicketSerializer(ticket).data,
            'room': RoomSerializer(room).data,
            'stats': stats_data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post', 'patch'], url_path='complete')
    def complete_maintenance(self, request, pk=None):
        ticket = self.get_object()
        if ticket.status == 'completed':
            return Response({'success': False, 'message': 'Phiếu bảo trì này đã hoàn tất trước đó.'}, status=status.HTTP_400_BAD_REQUEST)

        parts_replaced = request.data.get('parts_replaced', ticket.parts_replaced)
        cost = int(request.data.get('cost') or ticket.cost or 0)
        note = request.data.get('note', '')
        is_guest_fault = request.data.get('is_guest_fault')
        if is_guest_fault is not None:
            ticket.is_guest_fault = bool(is_guest_fault)

        ticket.parts_replaced = parts_replaced
        ticket.cost = cost
        ticket.note = note
        ticket.completed_date = timezone.now()
        ticket.status = 'completed'
        if request.user.is_authenticated and not ticket.technician:
            ticket.technician = request.user
        ticket.save()

        # Cập nhật chi phí bồi thường nếu có
        if ticket.is_guest_fault and ticket.booking and cost > 0:
            bes = BookingExtraService.objects.filter(
                booking=ticket.booking,
                service_name__contains=f"Bồi thường hỏng thiết bị: {ticket.equipment_name}"
            ).first()
            if bes:
                bes.price = cost
                bes.save(update_fields=['price'])
            else:
                BookingExtraService.objects.create(
                    booking=ticket.booking,
                    service_name=f"Bồi thường hỏng thiết bị: {ticket.equipment_name}",
                    quantity=1,
                    price=cost
                )
        elif ticket.booking:
            # Nếu nghiệm thu xác nhận không phải lỗi khách hoặc chi phí = 0: Gỡ phụ phí khỏi hóa đơn
            BookingExtraService.objects.filter(
                booking=ticket.booking,
                service_name__contains=f"Bồi thường hỏng thiết bị: {ticket.equipment_name}"
            ).delete()

        # 4. QUY TRÌNH BÀN GIAO: Chuyển phòng từ 'maintenance' sang 'cleaning' (Đang dọn dẹp)
        room = ticket.room
        room.status = 'cleaning'
        room.save(update_fields=['status'])

        log_action(
            user=request.user,
            action='UPDATE',
            module='ROOM',
            description=f"Hoàn tất bảo trì #{ticket.ticket_code} phòng {room.room_number} ({ticket.equipment_name}). Bàn giao Buồng phòng vệ sinh.",
            request=request
        )

        # 5. GỬI THÔNG BÁO TỰ ĐỘNG ĐẾN BUỒNG PHÒNG VÀ LỄ TÂN/QUẢN LÝ
        try:
            tech_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Kỹ thuật viên"
            housekeeping_users = User.objects.filter(
                Q(role__in=['housekeeper', 'receptionist', 'admin']) |
                (Q(is_superuser=True) & ~Q(role__in=['owner', 'manager', 'guest', 'technician', 'service_staff', 'cashier']))
            ).distinct()
            active_booking = room.bookings.filter(status='checked_in').select_related('guest').first()
            guest_display = (active_booking.guest.get_full_name() or active_booking.guest.username) if (active_booking and active_booking.guest) else "Khách lưu trú"
            guest_stay_note = f"\n• Lưu ý: Phòng đang có khách lưu trú ({guest_display} - #{active_booking.booking_code})." if active_booking else ""
            action_instruction = "Kính mời bộ phận Buồng phòng hỗ trợ lau dọn sạch sẽ để khách tiếp tục sinh hoạt!" if active_booking else "Kính mời bộ phận Buồng phòng tiến hành vệ sinh, thay ga gối để sẵn sàng đón khách!"

            parts_info = ticket.parts_replaced or "Không có (Sửa chữa/Bảo dưỡng)"
            cost_info = f"{int(ticket.cost):,} VNĐ" if ticket.cost else "0 VNĐ (Không phát sinh)"

            notif_title = f"🧹 [BÀN GIAO DỌN DẸP] Phòng {room.room_number} đã sửa xong!"
            notif_message = (
                f"Kỹ thuật viên ({tech_name}) đã hoàn tất sửa chữa thiết bị tại phòng {room.room_number}:\n"
                f"• Thiết bị: {ticket.equipment_name}\n"
                f"• Vật tư thay thế: {parts_info}\n"
                f"• Chi phí: {cost_info}\n"
                f"• Trạng thái mới: Đang dọn dẹp (Cleaning){guest_stay_note}\n"
                f"{action_instruction}"
            )
            notifs = [
                Notification(
                    recipient=recipient,
                    title=notif_title,
                    message=notif_message,
                    notification_type='room',
                    action_url='/admin/rooms',
                    priority='normal'
                )
                for recipient in housekeeping_users
            ]
            if notifs:
                Notification.objects.bulk_create(notifs)
        except Exception as e:
            pass

        all_rooms = Room.objects.all()
        stats_data = {
            'total': all_rooms.count(),
            'available': all_rooms.filter(status='available').count(),
            'occupied': all_rooms.filter(status='occupied').count(),
            'cleaning': all_rooms.filter(status='cleaning').count(),
            'maintenance': all_rooms.filter(status='maintenance').count(),
        }

        return Response({
            'success': True,
            'message': f'Đã hoàn tất sửa chữa phòng {room.room_number}! Phòng đã được chuyển giao cho bộ phận Buồng phòng dọn dẹp.',
            'ticket': MaintenanceTicketSerializer(ticket).data,
            'room': RoomSerializer(room).data,
            'stats': stats_data
        }, status=status.HTTP_200_OK)


# =========================================================================
# 7. QUẢN LÝ MINIBAR PHÒNG (Cho Buồng phòng kiểm kê & Lễ tân quyết toán)
# =========================================================================

class MinibarItemViewSet(viewsets.ModelViewSet):
    """
    CRUD danh mục đồ minibar trang bị trong phòng (Nước khoáng, Nước ngọt, Bia, Snack...).
    """
    queryset = MinibarItem.objects.filter(is_active=True).order_by('category', 'name')
    serializer_class = MinibarItemSerializer

    def get_permissions(self):
        # Mọi nhân viên (Buồng phòng, Lễ tân) có thể xem danh mục minibar để kiểm kê
        if self.request.method in ['GET', 'HEAD', 'OPTIONS']:
            return [IsHotelStaffOrAdmin()]
        # Thêm mới, sửa giá, xóa món, bật/tắt bán: Chỉ Quản lý / Admin / Chủ KS
        return [IsManagerOrAdminOnly()]

    def get_queryset(self):
        qs = MinibarItem.objects.all().order_by('category', 'name')
        active_only = self.request.query_params.get('active_only')
        if active_only == 'true':
            qs = qs.filter(is_active=True)
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return qs


class MinibarCheckViewSet(viewsets.ModelViewSet):
    """
    Quản lý Phiếu Kiểm Kê Minibar:
    - GET /api/rooms/minibar-checks/?room_id=...
    - POST /api/rooms/minibar-checks/: Buồng phòng gửi kết quả kiểm tra minibar -> Tự động đồng bộ vào Folio thanh toán!
    """
    queryset = MinibarCheck.objects.select_related('room', 'booking', 'inspector').order_by('-created_at')
    serializer_class = MinibarCheckSerializer
    permission_classes = [IsHotelStaffOrAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        room_id = self.request.query_params.get('room_id')
        booking_id = self.request.query_params.get('booking_id')
        if room_id:
            qs = qs.filter(room_id=room_id)
        if booking_id:
            qs = qs.filter(booking_id=booking_id)
        return qs

    @action(detail=False, methods=['post'], url_path='request-inspection')
    def request_inspection(self, request):
        """
        API Lễ tân bấm 'Yêu cầu kiểm phòng' trước khi Check-out:
        POST /api/rooms/minibar-checks/request-inspection/
        Body: { room_id, booking_id, note }
        """
        room_id = request.data.get('room_id') or request.data.get('room')
        if not room_id:
            return Response({'success': False, 'message': 'Thiếu ID phòng cần kiểm tra.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            room = Room.objects.get(pk=room_id)
        except Room.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy phòng tương ứng.'}, status=status.HTTP_404_NOT_FOUND)

        booking_id = request.data.get('booking_id') or request.data.get('booking')
        booking = None
        if booking_id:
            booking = Booking.objects.filter(pk=booking_id).first()
        if not booking:
            booking = room.bookings.filter(status='checked_in').first()

        note = request.data.get('note', '').strip() or 'Lễ tân yêu cầu kiểm phòng Check-out (Minibar & Hư hại)'

        # Kiểm tra xem phòng đã có phiếu check 'requested' nào đang chờ chưa
        pending_check = room.minibar_checks.filter(status='requested').order_by('-created_at').first()
        if pending_check:
            pending_check.requested_by = request.user if request.user.is_authenticated else None
            pending_check.note = note
            if booking:
                pending_check.booking = booking
            pending_check.save()
            check = pending_check
        else:
            check = MinibarCheck.objects.create(
                room=room,
                booking=booking,
                requested_by=request.user if request.user.is_authenticated else None,
                status='requested',
                items_consumed=[],
                total_amount=0,
                note=note
            )

        receptionist_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Lễ tân"
        guest_name_str = ""
        if booking:
            if booking.guest:
                guest_name_str = booking.guest.get_full_name() or booking.guest.username
            elif getattr(booking, 'guest_name', None):
                guest_name_str = str(booking.guest_name)
            elif getattr(booking, 'identity_card', None):
                guest_name_str = f"CCCD {booking.identity_card}"
            else:
                guest_name_str = "Khách lưu trú"
        guest_label = f" (Khách #{booking.booking_code} - {guest_name_str})" if booking else ""

        # Gửi thông báo đến Buồng phòng (housekeeper) và Quản lý (manager, admin)
        try:
            recipients = User.objects.filter(
                Q(role__in=['housekeeper', 'receptionist', 'admin']) |
                (Q(is_superuser=True) & ~Q(role__in=['owner', 'manager', 'guest', 'technician', 'service_staff', 'cashier']))
            ).distinct()
            notif_title = f"🛎️ [YÊU CẦU KIỂM PHÒNG] Phòng {room.room_number}{guest_label}"
            notif_message = (
                f"Lễ tân ({receptionist_name}) vừa gửi yêu cầu kiểm tra phòng {room.room_number}.\n"
                f"Khách đang làm thủ tục trả phòng tại quầy. Vui lòng kiểm tra Minibar và Hư hại tài sản!"
            )
            notifs = [
                Notification(
                    recipient=r,
                    title=notif_title,
                    message=notif_message,
                    notification_type='room',
                    action_url='/admin/rooms',
                    priority='high'
                )
                for r in recipients
            ]
            if notifs:
                Notification.objects.bulk_create(notifs)
        except Exception:
            pass

        log_action(
            user=request.user,
            action='CREATE',
            module='ROOM',
            description=f"Lễ tân {receptionist_name} yêu cầu kiểm phòng {room.room_number} trước khi Check-out.",
            request=request
        )

        return Response({
            'success': True,
            'message': f"Đã gửi yêu cầu kiểm tra phòng {room.room_number} đến bộ phận Buồng phòng!",
            'check': MinibarCheckSerializer(check).data,
            'room_id': room.id,
            'booking_id': booking.id if booking else None
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='latest')
    def latest(self, request):
        """
        API Lấy phiếu kiểm tra phòng gần nhất:
        GET /api/rooms/minibar-checks/latest/?room_id=...&booking_id=...
        """
        room_id = request.query_params.get('room_id')
        booking_id = request.query_params.get('booking_id')
        qs = self.get_queryset()
        if booking_id:
            qs = qs.filter(booking_id=booking_id)
        elif room_id:
            qs = qs.filter(room_id=room_id)
        else:
            return Response({'success': False, 'message': 'Thiếu tham số room_id hoặc booking_id.'}, status=status.HTTP_400_BAD_REQUEST)

        latest_check = qs.first()
        if not latest_check:
            return Response({'success': True, 'check': None}, status=status.HTTP_200_OK)

        return Response({'success': True, 'check': MinibarCheckSerializer(latest_check).data}, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        room_id = request.data.get('room_id') or request.data.get('room')
        if not room_id:
            return Response({'success': False, 'message': 'Thiếu thông tin số phòng kiểm kê.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            room = Room.objects.get(pk=room_id)
        except Room.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy phòng tương ứng.'}, status=status.HTTP_404_NOT_FOUND)

        items_consumed = request.data.get('items', [])
        note = request.data.get('note', '').strip()
        booking_id = request.data.get('booking_id') or request.data.get('booking')
        has_damage = bool(request.data.get('has_damage', False))
        damage_desc = request.data.get('damage_description', '').strip()
        damage_amt = float(request.data.get('damage_amount') or 0)
        check_id = request.data.get('check_id')

        booking = None
        if booking_id:
            booking = Booking.objects.filter(pk=booking_id).first()
        else:
            # Tự động tìm booking: ưu tiên checked_in, nếu không có lấy booking vừa completed gần nhất (trong vòng 24h)
            booking = room.bookings.filter(status='checked_in').first()
            if not booking:
                booking = room.bookings.filter(status='completed').order_by('-actual_check_out', '-id').first()

        # Tính tổng tiền và lọc các món có tiêu thụ
        valid_consumed = []
        total_amount = 0
        for it in items_consumed:
            qty = int(it.get('quantity') or 0)
            if qty > 0:
                price = float(it.get('price') or 0)
                name = it.get('name') or 'Mặt hàng minibar'
                subtotal = qty * price
                total_amount += subtotal
                valid_consumed.append({
                    'item_id': it.get('id') or it.get('item_id'),
                    'name': name,
                    'price': price,
                    'quantity': qty,
                    'total': subtotal
                })

        now = timezone.now()
        # Tìm phiếu requested đang chờ (nếu có) để hoàn tất cập nhật
        check = None
        if check_id:
            check = MinibarCheck.objects.filter(pk=check_id).first()
        if not check:
            check = room.minibar_checks.filter(status='requested').order_by('-created_at').first()

        if check:
            check.status = 'completed'
            check.items_consumed = valid_consumed
            check.total_amount = total_amount
            check.has_damage = has_damage
            check.damage_description = damage_desc if has_damage else ''
            check.damage_amount = damage_amt if has_damage else 0
            check.note = note
            check.inspector = request.user if request.user.is_authenticated else None
            check.completed_at = now
            if booking and not check.booking:
                check.booking = booking
            check.save()
        else:
            check = MinibarCheck.objects.create(
                room=room,
                booking=booking,
                inspector=request.user if request.user.is_authenticated else None,
                status='completed',
                items_consumed=valid_consumed,
                total_amount=total_amount,
                has_damage=has_damage,
                damage_description=damage_desc if has_damage else '',
                damage_amount=damage_amt if has_damage else 0,
                note=note,
                completed_at=now
            )

        extra_services_created = 0
        if booking:
            # 1. Tự động đồng bộ các món Minibar vào BookingExtraService
            if valid_consumed:
                for it in valid_consumed:
                    BookingExtraService.objects.create(
                        booking=booking,
                        service_name=f"[Minibar] {it['name']}",
                        quantity=it['quantity'],
                        price=it['price'],
                        is_paid=False
                    )
                    extra_services_created += 1

            # 2. Tự động đồng bộ khoản Đền bù hư hại (nếu có) vào BookingExtraService
            if has_damage and damage_amt > 0:
                damage_label = damage_desc or "Bồi thường hư hại phòng"
                BookingExtraService.objects.create(
                    booking=booking,
                    service_name=f"[Đền bù hư hại] {damage_label}",
                    quantity=1,
                    price=damage_amt,
                    is_paid=False
                )
                extra_services_created += 1

        staff_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Buồng phòng"
        guest_name_str = ""
        if booking:
            if booking.guest:
                guest_name_str = booking.guest.get_full_name() or booking.guest.username
            elif getattr(booking, 'guest_name', None):
                guest_name_str = str(booking.guest_name)
            elif getattr(booking, 'identity_card', None):
                guest_name_str = f"CCCD {booking.identity_card}"
            else:
                guest_name_str = "Khách lưu trú"
        guest_label = f" (Khách #{booking.booking_code} - {guest_name_str})" if booking else ""

        # Gửi thông báo đến Lễ tân, Thu ngân, Quản lý
        try:
            consumed_desc = ", ".join([f"{it['name']} x{it['quantity']}" for it in valid_consumed]) if valid_consumed else "Không dùng Minibar"
            target_roles = ['receptionist', 'cashier', 'admin']
            if has_damage and damage_amt > 0:
                target_roles.append('manager')
            recipients = User.objects.filter(
                Q(role__in=target_roles) |
                (Q(is_superuser=True) & ~Q(role__in=['owner', 'guest', 'housekeeper', 'service_staff', 'technician']))
            ).distinct()
            notif_title = f"✅ [HOÀN TẤT KIỂM PHÒNG] Phòng {room.room_number}{guest_label}"
            damage_text = f"\n• Hư hại / Đền bù: {damage_amt:,.0f} đ ({damage_desc})" if (has_damage and damage_amt > 0) else "\n• Hư hại phòng: Không phát sinh"
            notif_message = (
                f"Buồng phòng ({staff_name}) đã hoàn tất kiểm tra phòng {room.room_number}.\n"
                f"• Minibar: {consumed_desc} ({total_amount:,.0f} VNĐ)"
                f"{damage_text}\n"
                + (f"• Đã tự động cập nhật vào Hóa đơn thanh toán của khách." if extra_services_created > 0 else "• Phòng nguyên vẹn, sẵn sàng thanh toán.")
            )
            target_action_url = '/admin/finance' if (total_amount > 0 or has_damage) else '/admin/rooms'
            target_priority = 'high' if (has_damage or total_amount > 500000) else 'normal'
            notifs = [
                Notification(
                    recipient=r,
                    title=notif_title,
                    message=notif_message,
                    notification_type='room',
                    action_url=target_action_url,
                    priority=target_priority
                )
                for r in recipients
            ]
            if notifs:
                Notification.objects.bulk_create(notifs)
        except Exception:
            pass

        log_action(
            user=request.user,
            action='CREATE',
            module='ROOM',
            description=f"Kiểm tra phòng #{check.check_code} phòng {room.room_number}. Minibar: {total_amount:,.0f} đ, Hư hại: {damage_amt if has_damage else 0:,.0f} đ.",
            request=request
        )

        summary_msg = f"Đã hoàn tất kiểm tra phòng {room.room_number}!"
        if total_amount > 0 or (has_damage and damage_amt > 0):
            summary_msg += f" Tổng phụ thu: {total_amount + (damage_amt if has_damage else 0):,.0f} đ (Đã đồng bộ vào hóa đơn)."
        else:
            summary_msg += " Phòng nguyên vẹn, không phát sinh phụ phí."

        return Response({
            'success': True,
            'message': summary_msg,
            'check': MinibarCheckSerializer(check).data,
            'extra_services_created': extra_services_created,
            'booking_id': booking.id if booking else None
        }, status=status.HTTP_201_CREATED)


# =========================================================================
# 8. QUẢN LÝ ĐỒ THẤT LẠC (LOST & FOUND MANAGEMENT)
# =========================================================================

class LostAndFoundViewSet(viewsets.ModelViewSet):
    """
    CRUD Quản lý Đồ thất lạc / Tài sản khách bỏ quên (Lost & Found):
    - GET /api/rooms/lost-and-found/: Danh sách đồ thất lạc (tìm kiếm, lọc theo status, category, room)
    - POST /api/rooms/lost-and-found/: Buồng phòng khai báo đồ thất lạc
    - POST /api/rooms/lost-and-found/{id}/return/: Bàn giao trả khách
    - GET /api/rooms/lost-and-found/stats/: Thống kê số lượng theo trạng thái
    """
    queryset = LostAndFoundItem.objects.select_related('room', 'booking', 'finder', 'handled_by').order_by('-found_date')
    serializer_class = LostAndFoundItemSerializer
    permission_classes = [IsHotelStaffOrAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        category_param = self.request.query_params.get('category')
        room_id = self.request.query_params.get('room_id')
        search = self.request.query_params.get('search', '').strip()

        if status_param and status_param != 'all':
            qs = qs.filter(status=status_param)
        if category_param and category_param != 'all':
            qs = qs.filter(category=category_param)
        if room_id:
            qs = qs.filter(room_id=room_id)
        if search:
            qs = qs.filter(
                Q(tracking_code__icontains=search) |
                Q(item_name__icontains=search) |
                Q(location_found__icontains=search) |
                Q(guest_name__icontains=search) |
                Q(guest_phone__icontains=search) |
                Q(description__icontains=search)
            )
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        item_name = data.get('item_name', '').strip()
        if not item_name:
            return Response({'success': False, 'message': 'Vui lòng nhập tên đồ vật nhặt được.'}, status=status.HTTP_400_BAD_REQUEST)

        room_id = data.get('room_id') or data.get('room')
        room = None
        booking = None
        guest_name = data.get('guest_name', '').strip()
        guest_phone = data.get('guest_phone', '').strip()

        if room_id:
            try:
                room = Room.objects.get(pk=room_id)
                # Tự động gán booking và thông tin khách nếu không điền tay
                active_bk = room.bookings.filter(status='checked_in').first()
                if not active_bk:
                    active_bk = room.bookings.filter(status='completed').order_by('-actual_check_out', '-id').first()
                if active_bk:
                    booking = active_bk
                    if not guest_name:
                        if active_bk.guest:
                            guest_name = active_bk.guest.get_full_name() or active_bk.guest.username
                        elif getattr(active_bk, 'guest_name', None):
                            guest_name = str(active_bk.guest_name)
                        else:
                            guest_name = "Khách lưu trú"
                    if not guest_phone and active_bk.guest:
                        guest_phone = active_bk.guest.phone_number or ''
            except Room.DoesNotExist:
                pass

        location_found = data.get('location_found', '').strip()
        if not location_found:
            location_found = f"Phòng {room.room_number}" if room else "Khu vực khách sạn"

        finder = request.user if request.user.is_authenticated else None

        item = LostAndFoundItem.objects.create(
            room=room,
            location_found=location_found,
            item_name=item_name,
            category=data.get('category', 'other'),
            description=data.get('description', ''),
            image=request.FILES.get('image'),
            found_date=data.get('found_date') or timezone.now(),
            finder=finder,
            booking=booking,
            guest_name=guest_name,
            guest_phone=guest_phone,
            storage_location=data.get('storage_location', 'Két an toàn Lễ tân'),
            status='stored'
        )

        staff_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Nhân viên"
        try:
            recipients = User.objects.filter(
                Q(role__in=['receptionist', 'manager', 'admin']) |
                (Q(is_superuser=True) & ~Q(role__in=['owner', 'guest', 'housekeeper', 'technician', 'service_staff', 'cashier']))
            ).distinct()
            notif_title = f"🧳 [ĐỒ THẤT LẠC MỚI] #{item.tracking_code} - {item.item_name}"
            guest_info = f"Khách: {guest_name} ({guest_phone})" if guest_name else "Chưa xác định chủ nhân"
            notif_message = (
                f"Nhân viên ({staff_name}) vừa phát hiện tài sản khách bỏ quên:\n"
                f"• Món đồ: {item.item_name} ({item.get_category_display()})\n"
                f"• Vị trí: {location_found}\n"
                f"• {guest_info}\n"
                f"• Nơi cất giữ: {item.storage_location}\n"
                f"Lễ tân vui lòng rà soát hồ sơ để liên hệ trao trả khách."
            )
            notifs = [
                Notification(
                    recipient=r,
                    title=notif_title,
                    message=notif_message,
                    notification_type='room',
                    action_url='/admin/rooms',
                    priority='normal'
                )
                for r in recipients
            ]
            if notifs:
                Notification.objects.bulk_create(notifs)
        except Exception:
            pass

        log_action(
            user=request.user,
            action='CREATE',
            module='ROOM',
            description=f"Báo nhận đồ thất lạc #{item.tracking_code}: '{item.item_name}' tại {location_found}",
            request=request
        )

        return Response({
            'success': True,
            'message': f"Đã ghi nhận đồ thất lạc #{item.tracking_code}: {item.item_name}.",
            'item': LostAndFoundItemSerializer(item, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='return')
    def return_to_guest(self, request, pk=None):
        item = self.get_object()
        if item.status == 'returned':
            return Response({'success': False, 'message': 'Món đồ này đã được trao trả cho khách trước đó.'}, status=status.HTTP_400_BAD_REQUEST)

        returned_to = request.data.get('returned_to', '').strip()
        if not returned_to:
            return Response({'success': False, 'message': 'Vui lòng nhập họ tên hoặc thông tin liên hệ của người nhận lại đồ.'}, status=status.HTTP_400_BAD_REQUEST)

        return_note = request.data.get('return_note', '').strip()

        item.status = 'returned'
        item.returned_date = timezone.now()
        item.returned_to = returned_to
        item.return_note = return_note
        item.handled_by = request.user if request.user.is_authenticated else None
        item.save()

        staff_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Lễ tân"
        try:
            recipients = User.objects.filter(
                Q(role__in=['manager', 'admin', 'housekeeper', 'receptionist']) |
                (Q(is_superuser=True) & ~Q(role__in=['owner', 'guest', 'technician', 'service_staff', 'cashier']))
            ).distinct()
            notif_title = f"✅ [ĐÃ TRẢ ĐỒ THẤT LẠC] #{item.tracking_code} - {item.item_name}"
            notif_message = (
                f"Món đồ '{item.item_name}' (#{item.tracking_code}) đã được bàn giao thành công cho: {returned_to}.\n"
                f"• Nhân viên bàn giao: {staff_name}\n"
                f"• Ghi chú: {return_note or 'Đầy đủ chữ ký/xác nhận.'}"
            )
            notifs = [
                Notification(
                    recipient=r,
                    title=notif_title,
                    message=notif_message,
                    notification_type='room',
                    action_url='/admin/rooms',
                    priority='normal'
                )
                for r in recipients
            ]
            if notifs:
                Notification.objects.bulk_create(notifs)
        except Exception:
            pass

        log_action(
            user=request.user,
            action='UPDATE',
            module='ROOM',
            description=f"Bàn giao trao trả đồ thất lạc #{item.tracking_code} cho '{returned_to}'",
            request=request
        )

        return Response({
            'success': True,
            'message': f"Đã hoàn tất bàn giao trao trả món đồ #{item.tracking_code} cho {returned_to}!",
            'item': LostAndFoundItemSerializer(item, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='stats')
    def get_stats(self, request):
        qs = LostAndFoundItem.objects.all()
        total = qs.count()
        stored = qs.filter(status='stored').count()
        contacted = qs.filter(status='contacted').count()
        returned = qs.filter(status='returned').count()
        disposed = qs.filter(status='disposed').count()
        return Response({
            'success': True,
            'total': total,
            'stored': stored,
            'contacted': contacted,
            'returned': returned,
            'disposed': disposed,
            'return_rate': round((returned / total * 100), 1) if total > 0 else 0
        }, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_superuser or check_role_permission(request.user, 'rooms', 'delete')):
            return Response(
                {'success': False, 'message': 'Chỉ Quản lý hoặc Quản trị viên mới có quyền xóa vĩnh viễn phiếu đồ thất lạc.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

