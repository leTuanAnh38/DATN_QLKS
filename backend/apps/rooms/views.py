from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import BasePermission, IsAuthenticated, AllowAny
from django.db.models import Q, Count
from django.utils.text import slugify
from .models import Room, RoomCategory, Amenity, RoomImage
from .serializers import (
    RoomSerializer,
    RoomCategorySerializer,
    RoomImageSerializer,
    RoomStatusUpdateSerializer
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
        if request.user.is_staff or request.user.is_superuser:
            return True
        # Mọi tài khoản nhân viên nội bộ (khác 'guest')
        return getattr(request.user, 'role', '') != 'guest'


class IsManagerOrAdminOnly(BasePermission):
    """
    Chỉ cho phép cấp Quản lý trở lên (admin, owner, manager) tạo mới hoặc xóa phòng.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_staff or request.user.is_superuser:
            return True
        return getattr(request.user, 'role', '') in ['admin', 'owner', 'manager']


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

    def get_permissions(self):
        # Khách vãng lai và Trang chủ có thể xem danh sách và chi tiết
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsHotelStaffOrAdmin()]

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
        serializer = RoomSerializer(data=request.data)
        if serializer.is_valid():
            room = serializer.save()
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
        room = self.get_object(pk)
        if not room:
            return Response({'success': False, 'message': 'Không tìm thấy phòng.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'success': True, 'room': RoomSerializer(room).data}, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        room = self.get_object(pk)
        if not room:
            return Response({'success': False, 'message': 'Không tìm thấy phòng.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = RoomSerializer(room, data=request.data, partial=True)
        if serializer.is_valid():
            updated_room = serializer.save()
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
        room = self.get_object(pk)
        if not room:
            return Response({'success': False, 'message': 'Không tìm thấy phòng cần xóa.'}, status=status.HTTP_404_NOT_FOUND)

        room_num = room.room_number
        room.delete()
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
        try:
            room = Room.objects.select_related('category').get(pk=pk)
        except Room.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy phòng.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = RoomStatusUpdateSerializer(room, data=request.data, partial=True)
        if serializer.is_valid():
            updated_room = serializer.save()
            return Response({
                'success': True,
                'message': f'Đã đổi trạng thái phòng {updated_room.room_number} thành "{updated_room.get_status_display()}".',
                'room': RoomSerializer(updated_room).data
            }, status=status.HTTP_200_OK)

        first_error = next(iter(serializer.errors.values()))
        error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
        return Response({
            'success': False,
            'message': error_msg,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
