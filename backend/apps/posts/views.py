from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q, F
from django.http import Http404

from .models import Post
from .serializers import PostSerializer, PostListSerializer


class IsHotelStaffOrAdmin(BasePermission):
    """
    Quyền chỉnh sửa/thêm/xóa bài viết: Chỉ dành cho nhân viên khách sạn hoặc Admin.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_staff or request.user.is_superuser:
            return True
        return getattr(request.user, 'role', '') in ['admin', 'manager', 'receptionist']


class PostViewSet(viewsets.ModelViewSet):
    """
    ViewSet xử lý CRUD Bài viết & Tin tức:
    - Khách hàng (Public): Chỉ xem danh sách và chi tiết các bài có status='published'.
    - Lễ tân / Quản trị viên (Admin): Xem được tất cả bài (Bản nháp, Hiển thị) và thực hiện CRUD.
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        # Xem danh sách hoặc đọc bài viết: Công khai cho mọi người
        if self.action in ['list', 'retrieve', 'categories', 'latest']:
            return [AllowAny()]
        # Tạo mới, chỉnh sửa, xóa: Bắt buộc là Nhân viên / Admin
        return [IsHotelStaffOrAdmin()]

    def get_serializer_class(self):
        if self.action == 'list':
            return PostListSerializer
        return PostSerializer

    def get_queryset(self):
        user = self.request.user
        is_staff_user = (
            user.is_authenticated and (
                user.is_staff or
                user.is_superuser or
                getattr(user, 'role', '') in ['admin', 'manager', 'receptionist']
            )
        )
        show_all = self.request.query_params.get('all', '').lower() in ['1', 'true', 'yes']

        # Nếu là staff và có yêu cầu xem toàn bộ (hoặc từ trang admin)
        if is_staff_user and show_all:
            qs = Post.objects.all()
        elif is_staff_user:
            # Staff có thể xem toàn bộ bài viết
            qs = Post.objects.all()
        else:
            # Khách hàng chỉ xem được bài viết có trạng thái "Hiển thị"
            qs = Post.objects.filter(status='published')

        # Bộ lọc Chuyên mục
        category = self.request.query_params.get('category')
        if category and category != 'all':
            qs = qs.filter(category=category)

        # Bộ lọc Trạng thái (chỉ dành cho Staff)
        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all' and is_staff_user:
            qs = qs.filter(status=status_param)

        # Tìm kiếm theo từ khóa trong Tiêu đề hoặc Tóm tắt
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(
                Q(title__icontains=q) |
                Q(summary__icontains=q) |
                Q(author__icontains=q)
            )

        return qs.order_by('-created_at')

    def get_object(self):
        """
        Hỗ trợ tìm bài viết linh hoạt bằng cả ID (số nguyên) hoặc Slug (chuỗi SEO).
        """
        lookup_value = self.kwargs.get('pk')
        queryset = self.filter_queryset(self.get_queryset())

        # Nếu lookup_value là số, thử tìm theo ID
        if str(lookup_value).isdigit():
            obj = queryset.filter(pk=lookup_value).first()
            if obj:
                self.check_object_permissions(self.request, obj)
                return obj

        # Tìm theo slug
        obj = queryset.filter(slug=lookup_value).first()
        if not obj:
            raise Http404("Không tìm thấy bài viết hoặc bài viết chưa được công khai.")

        self.check_object_permissions(self.request, obj)
        return obj

    def retrieve(self, request, *args, **kwargs):
        """
        Chi tiết bài viết: Tự động tăng view_count lên 1 khi người dùng truy cập.
        """
        instance = self.get_object()

        # Tăng view_count nguyên tử trong database
        Post.objects.filter(pk=instance.pk).update(view_count=F('view_count') + 1)
        instance.refresh_from_db(fields=['view_count'])

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            post = serializer.save()
            return Response({
                'success': True,
                'message': f'Tạo bài viết "{post.title}" thành công!',
                'post': PostSerializer(post, context={'request': request}).data
            }, status=status.HTTP_201_CREATED)
        return Response({
            'success': False,
            'message': 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            post = serializer.save()
            return Response({
                'success': True,
                'message': f'Cập nhật bài viết "{post.title}" thành công!',
                'post': PostSerializer(post, context={'request': request}).data
            }, status=status.HTTP_200_OK)
        return Response({
            'success': False,
            'message': 'Cập nhật thất bại. Vui lòng kiểm tra lại.',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        title = instance.title
        instance.delete()
        return Response({
            'success': True,
            'message': f'Đã xóa bài viết "{title}" thành công.'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='categories')
    def categories(self, request):
        """
        Trả về danh sách chuyên mục có sẵn trong hệ thống
        """
        cats = [
            {'value': key, 'label': label}
            for key, label in Post.CATEGORY_CHOICES
        ]
        return Response({'success': True, 'categories': cats}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='latest')
    def latest(self, request):
        """
        Lấy nhanh top 5 bài viết mới nhất cho Widget Sidebar hoặc Trang chủ
        """
        posts = Post.objects.filter(status='published').order_by('-created_at')[:5]
        serializer = PostListSerializer(posts, many=True, context={'request': request})
        return Response({'success': True, 'posts': serializer.data}, status=status.HTTP_200_OK)


from rest_framework.views import APIView
from .models import ImageUpload


class ImageUploadView(APIView):
    """
    API tải ảnh độc lập cho trình soạn thảo Quill (Blog Content).
    POST /api/upload-image/
    Body: multipart/form-data với key 'image' (hoặc 'file').
    Trả về: {"success": True, "url": "http://localhost:8000/media/uploads/xxx.jpg"}
    """
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsHotelStaffOrAdmin]

    def post(self, request):
        image_file = request.FILES.get('image') or request.FILES.get('file')
        if not image_file:
            return Response({
                'success': False,
                'message': 'Vui lòng chọn file ảnh để tải lên (key multipart là "image").'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Kiểm tra định dạng file
        allowed_extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg']
        ext = image_file.name.split('.')[-1].lower() if '.' in image_file.name else ''
        if ext not in allowed_extensions:
            return Response({
                'success': False,
                'message': f'Định dạng file không được hỗ trợ. Chỉ chấp nhận các định dạng: {", ".join(allowed_extensions)}.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Giới hạn dung lượng ảnh (tối đa 10MB)
        if image_file.size > 10 * 1024 * 1024:
            return Response({
                'success': False,
                'message': 'Kích thước ảnh vượt quá giới hạn 10MB. Vui lòng nén ảnh trước khi tải lên.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Lưu ảnh vào database & thư mục media/uploads/
        image_instance = ImageUpload.objects.create(image=image_file)
        absolute_url = request.build_absolute_uri(image_instance.image.url)

        return Response({
            'success': True,
            'url': absolute_url,
            'message': 'Tải ảnh lên thành công.'
        }, status=status.HTTP_201_CREATED)
