from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import BasePermission, IsAuthenticated, AllowAny
from django.db.models import Q, Count
from django.utils import timezone
from django.utils.text import slugify
from ..users.models import log_action, User
from ..bookings.models import Booking, BookingExtraService
from ..notifications.models import Notification
from .models import Room, RoomCategory, Amenity, RoomImage, MaintenanceTicket
from .serializers import (
    AmenitySerializer,
    RoomSerializer,
    RoomCategorySerializer,
    RoomImageSerializer,
    RoomStatusUpdateSerializer,
    MaintenanceTicketSerializer
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
    Chỉ cho phép cấp Quản lý trở lên (admin, owner, manager) tạo mới hoặc xóa phòng / hạng phòng.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
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
        if not (request.user.is_superuser or getattr(request.user, 'role', '') in ['admin', 'owner', 'manager']):
            return Response({
                'success': False,
                'message': 'Chỉ Quản lý hoặc Quản trị viên mới có quyền thêm phòng mới vào sơ đồ.'
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
        room = self.get_object(pk)
        if not room:
            return Response({'success': False, 'message': 'Không tìm thấy phòng.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'success': True, 'room': RoomSerializer(room).data}, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        user_role = getattr(request.user, 'role', '')
        if user_role == 'cashier':
            return Response({
                'success': False,
                'message': 'Thu ngân không có quyền chỉnh sửa phòng.'
            }, status=status.HTTP_403_FORBIDDEN)

        if user_role not in ['admin', 'owner', 'manager'] and not request.user.is_superuser:
            allowed_keys = {'status'}
            if not set(request.data.keys()).issubset(allowed_keys):
                return Response({
                    'success': False,
                    'message': 'Bạn chỉ có quyền cập nhật trạng thái phòng, không được thay đổi thông tin số phòng, tầng hoặc hạng phòng.'
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
        if not (request.user.is_superuser or getattr(request.user, 'role', '') in ['admin', 'owner', 'manager']):
            return Response({
                'success': False,
                'message': 'Chỉ Quản lý hoặc Quản trị viên mới có quyền xóa phòng khỏi sơ đồ.'
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
        user_role = getattr(request.user, 'role', '')
        if user_role == 'cashier':
            return Response({
                'success': False,
                'message': 'Thu ngân không có quyền cập nhật trạng thái phòng.'
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
                        Q(role__in=['receptionist', 'manager', 'admin', 'owner']) | Q(is_superuser=True)
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
                    for r in recipients:
                        Notification.objects.create(
                            recipient=r,
                            title=notif_title,
                            message=notif_message
                        )
                except Exception:
                    pass

            # 2. KHI YÊU CẦU DỌN DẸP (trạng thái khác -> cleaning): Gửi thông báo đến Buồng phòng
            elif old_status != 'cleaning' and new_status == 'cleaning':
                try:
                    staff_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Lễ tân"
                    recipients = User.objects.filter(
                        Q(role__in=['housekeeper', 'manager', 'admin']) | Q(is_superuser=True)
                    ).distinct()
                    cat_name = updated_room.category.name if updated_room.category else 'Tiêu chuẩn'
                    notif_title = f"🧹 [YÊU CẦU DỌN PHÒNG] Phòng {updated_room.room_number} cần dọn dẹp!"
                    notif_message = (
                        f"Phòng {updated_room.room_number} ({cat_name}) vừa được chuyển sang 'Đang dọn dẹp' (Cleaning).\n"
                        f"• Người yêu cầu: {staff_name}\n"
                        f"Kính mời bộ phận Buồng phòng tiến hành vệ sinh và thay ga gối."
                    )
                    for r in recipients:
                        Notification.objects.create(
                            recipient=r,
                            title=notif_title,
                            message=notif_message
                        )
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
    - POST /api/rooms/amenities/: Tạo tiện nghi mới
    """
    queryset = Amenity.objects.all().order_by('id')
    serializer_class = AmenitySerializer
    permission_classes = [AllowAny]


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
    queryset = MaintenanceTicket.objects.select_related('room', 'booking', 'technician', 'created_by').order_by('-start_date')
    serializer_class = MaintenanceTicketSerializer
    permission_classes = [IsHotelStaffOrAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        room_id = self.request.query_params.get('room_id')
        status_param = self.request.query_params.get('status')
        if room_id:
            qs = qs.filter(room_id=room_id)
        if status_param:
            qs = qs.filter(status=status_param)
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
                Q(role__in=['technician', 'admin', 'owner', 'manager']) | Q(is_superuser=True)
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
            for recipient in tech_users:
                Notification.objects.create(
                    recipient=recipient,
                    title=notif_title,
                    message=notif_message
                )
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
                Q(role__in=['housekeeper', 'receptionist', 'manager', 'admin', 'owner']) | Q(is_superuser=True)
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
            for recipient in housekeeping_users:
                Notification.objects.create(
                    recipient=recipient,
                    title=notif_title,
                    message=notif_message
                )
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

