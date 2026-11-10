"""Hạng phòng, upload ảnh và tiện nghi."""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.db.models import Q, Count, Avg
from ...users.models import log_action
from ..models import RoomCategory, Amenity, RoomImage
from ..serializers import AmenitySerializer, RoomCategorySerializer
from .helpers import generate_unique_slug
from .permissions import IsManagerOrAdminOnly


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


# Giữ alias tương thích nếu code cũ gọi RoomCategoryListView
RoomCategoryListView = RoomCategoryViewSet.as_view({'get': 'list'})
