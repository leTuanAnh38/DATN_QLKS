from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ServiceCategory, ServiceItem, ServiceRequest
from .serializers import (
    ServiceCategorySerializer,
    ServiceItemSerializer,
    ServiceRequestSerializer,
)
from ..bookings.models import Booking, BookingExtraService
from ..users.models import log_action
from core_project.pagination import StandardResultsSetPagination


class IsManagerOrAdminOnly(BasePermission):
    """
    Chỉ cho phép cấp Quản lý trở lên (admin, owner, manager) cấu hình thực đơn và danh mục dịch vụ.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        return getattr(request.user, 'role', '') in ['admin', 'owner', 'manager']


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
        pending_requests = instance.requests.filter(status__in=['pending', 'in_progress']).count()
        if pending_requests > 0:
            return Response({
                'success': False,
                'message': f'Không thể xóa dịch vụ "{name}" vì đang có {pending_requests} đơn yêu cầu đang chờ xử lý hoặc đang làm. Bạn có thể tạm ngưng phục vụ thay vì xóa.'
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
        base_qs = Booking.objects.select_related('room', 'category', 'guest').filter(
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

        if not is_staff_or_admin:
            if user.is_authenticated:
                user_email = user.email.strip() if user.email else ''
                if user_email:
                    base_qs = base_qs.filter(Q(guest=user) | Q(guest__email=user_email))
                else:
                    base_qs = base_qs.filter(guest=user)
            else:
                # Khách vãng lai chưa đăng nhập: lấy danh sách các phòng đang lưu trú để chọn
                base_qs = base_qs[:20]

        results = []
        for b in base_qs:
            if not b.room or not b.room.room_number:
                continue
            room_num = b.room.room_number
            cat_name = b.category.name if b.category else (b.room.category.name if b.room and b.room.category else 'Tiêu chuẩn')
            guest_name = (b.guest.get_full_name().strip() or f"{b.guest.first_name or ''} {b.guest.last_name or ''}".strip()) if b.guest else 'Khách lưu trú'
            results.append({
                'id': b.id,
                'booking_code': b.booking_code,
                'room_number': room_num,
                'room_name': cat_name,
                'guest_name': guest_name or (b.guest.username if b.guest else 'Khách lưu trú'),
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


class ServiceRequestViewSet(viewsets.ModelViewSet):
    """
    API Xử lý Phiếu Yêu Cầu Dịch Vụ:
    - GET /api/services/requests/: Danh sách phiếu (Nhân viên xem tất cả, Khách xem phiếu của mình)
    - GET /api/service-requests/?guest_id={id}: Lịch sử sử dụng dịch vụ của khách (kèm phân trang)
    - POST /api/services/requests/: Khách đặt món / dịch vụ tại phòng
    - PATCH /api/services/requests/<id>/: Nhân viên chuyển trạng thái Kanban (Pending -> In Progress -> Completed)
    - GET /api/services/requests/kanban/: Dữ liệu phân nhóm theo 3 cột Kanban
    """
    serializer_class = ServiceRequestSerializer
    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        # Cho phép gửi yêu cầu, xem menu và cập nhật kanban linh hoạt
        return [AllowAny()]

    def get_queryset(self):
        user = self.request.user
        # Luôn tạo mới QuerySet để tránh stale result_cache
        base_qs = ServiceRequest.objects.select_related(
            'booking', 'booking__room', 'booking__category', 'booking__guest',
            'service', 'service__category'
        ).all().order_by('-created_at')

        # Lọc theo guest_id nếu có trong query params (phục vụ CRM / Chi tiết khách hàng)
        guest_id = self.request.query_params.get('guest_id') or self.request.query_params.get('guest')
        if guest_id:
            if str(guest_id).isdigit():
                base_qs = base_qs.filter(booking__guest_id=int(guest_id))
            else:
                base_qs = base_qs.filter(Q(booking__guest__username=guest_id) | Q(booking__guest__email=guest_id))

        booking_id = self.request.query_params.get('booking_id') or self.request.query_params.get('booking')
        if booking_id:
            if str(booking_id).isdigit():
                base_qs = base_qs.filter(booking_id=int(booking_id))
            else:
                base_qs = base_qs.filter(booking__booking_code=str(booking_id).strip().upper())

        status_param = self.request.query_params.get('status')
        if status_param:
            base_qs = base_qs.filter(status=status_param)

        if not user.is_authenticated:
            # Cho phép hiển thị dữ liệu phục vụ quản trị và thử nghiệm hoặc lọc theo booking
            return base_qs

        is_staff_or_admin = (
            user.is_staff or 
            user.is_superuser or 
            getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'owner', 'staff', 'cashier', 'housekeeper', 'service_staff', 'technician'] or
            getattr(user, 'role', '') != 'guest'
        )

        if is_staff_or_admin:
            return base_qs

        # Nếu là khách hàng: chỉ xem yêu cầu thuộc các đơn đặt phòng của chính họ
        user_email = user.email.strip() if user.email else ''
        if user_email:
            return base_qs.filter(Q(booking__guest=user) | Q(booking__guest__email=user_email))
        return base_qs.filter(booking__guest=user)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True, context={'request': request})
            paginator = self.paginator
            return Response({
                'success': True,
                'count': paginator.page.paginator.count,
                'total_pages': paginator.page.paginator.num_pages,
                'current_page': paginator.page.number,
                'page_size': paginator.get_page_size(request),
                'next': paginator.get_next_link(),
                'previous': paginator.get_previous_link(),
                'results': serializer.data,
                'requests': serializer.data,
                'items': serializer.data,
                'data': serializer.data
            }, status=status.HTTP_200_OK)

        serializer = self.get_serializer(queryset, many=True, context={'request': request})
        return Response({
            'success': True,
            'count': queryset.count(),
            'requests': serializer.data,
            'items': serializer.data,
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        """
        Khách hàng gửi yêu cầu dịch vụ tại phòng:
        Payload: {
            "booking_id": 7,
            "service_id": 1,
            "quantity": 2,
            "note": "Mang lên lúc 19:30, ít đường"
        }
        """
        data = request.data
        booking_id = data.get('booking') or data.get('booking_id')
        service_id = data.get('service') or data.get('service_id')
        quantity = data.get('quantity', 1)
        note = data.get('note', '').strip()

        # 1. Kiểm tra đầu vào bắt buộc
        if not booking_id:
            return Response({
                'success': False,
                'message': 'Vui lòng chọn đơn đặt phòng / số phòng đang lưu trú của bạn.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not service_id:
            return Response({
                'success': False,
                'message': 'Vui lòng chọn dịch vụ hoặc món ăn cần gọi.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            quantity = int(quantity)
            if quantity < 1 or quantity > 99:
                return Response({
                    'success': False,
                    'message': 'Số lượng yêu cầu phải từ 1 đến 99.'
                }, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            return Response({
                'success': False,
                'message': 'Số lượng không hợp lệ.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 2. Tìm Booking
        booking = Booking.objects.filter(pk=booking_id).select_related('room', 'guest').first()
        if not booking:
            # Thử tìm theo booking_code nếu truyền vào mã chuỗi
            booking = Booking.objects.filter(booking_code=str(booking_id).strip().upper()).select_related('room', 'guest').first()

        if not booking:
            return Response({
                'success': False,
                'message': 'Không tìm thấy thông tin đơn đặt phòng tương ứng.'
            }, status=status.HTTP_404_NOT_FOUND)

        # 2.1. Phân quyền: Khách hàng chỉ được đặt dịch vụ cho đơn của chính mình
        user = request.user
        is_staff_or_admin = (
            user.is_authenticated and (
                user.is_staff or 
                user.is_superuser or 
                getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'owner', 'staff', 'cashier', 'service_staff', 'housekeeper'] or
                getattr(user, 'role', '') != 'guest'
            )
        )
        if user.is_authenticated and not is_staff_or_admin:
            user_email = user.email.strip() if user.email else ''
            is_owner = (booking.guest == user) or (user_email and booking.guest and booking.guest.email == user_email)
            if not is_owner:
                return Response({
                    'success': False,
                    'message': 'Quý khách không thể gọi dịch vụ cho đơn đặt phòng của khách hàng khác.'
                }, status=status.HTTP_403_FORBIDDEN)

        # 2.2. Kiểm tra trạng thái đơn: Phải là đang lưu trú (checked_in)
        if booking.status != 'checked_in':
            if booking.status == 'confirmed':
                status_desc = "chưa làm thủ tục nhận phòng (Check-in). Quý khách vui lòng nhận phòng tại quầy lễ tân trước khi gọi dịch vụ lên phòng."
            elif booking.status == 'pending':
                status_desc = "đang ở trạng thái chờ duyệt. Quý khách vui lòng hoàn tất đặt phòng và nhận phòng trước khi gọi dịch vụ."
            elif booking.status == 'checked_out':
                status_desc = "đã hoàn tất trả phòng (Check-out). Không thể đặt thêm dịch vụ phòng."
            elif booking.status == 'cancelled':
                status_desc = "đã bị hủy. Không thể đặt dịch vụ phòng."
            else:
                status_desc = "chưa ở trạng thái đang lưu trú. Quý khách chỉ có thể gọi dịch vụ khi đã nhận phòng tại khách sạn."
            return Response({
                'success': False,
                'message': f'Đơn đặt phòng {booking.booking_code} {status_desc}'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 2.3. Kiểm tra xếp phòng: Bắt buộc phải có số phòng thực tế
        if not booking.room or not booking.room.room_number:
            return Response({
                'success': False,
                'message': f'Đơn đặt phòng {booking.booking_code} hiện chưa được xếp phòng cụ thể. Quý khách vui lòng liên hệ lễ tân để được xếp phòng trước khi gọi dịch vụ.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Tìm ServiceItem
        service_item = ServiceItem.objects.filter(pk=service_id, is_active=True).first()
        if not service_item:
            return Response({
                'success': False,
                'message': 'Dịch vụ này hiện đang tạm ngưng phục vụ hoặc không tồn tại.'
            }, status=status.HTTP_404_NOT_FOUND)

        # 4. Tạo ServiceRequest mới
        total_price = service_item.price * quantity
        service_request = ServiceRequest.objects.create(
            booking=booking,
            service=service_item,
            quantity=quantity,
            total_price=total_price,
            status='pending',
            note=note,
            request_time=timezone.now()
        )

        serializer = ServiceRequestSerializer(service_request, context={'request': request})
        room_display = booking.room.room_number if booking.room else 'phòng'

        return Response({
            'success': True,
            'message': f'Đã gửi yêu cầu "{service_item.name}" cho Phòng {room_display} thành công! Nhân viên sẽ phục vụ trong ít phút.',
            'request': serializer.data,
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        """
        Cập nhật trạng thái phiếu yêu cầu (Kanban Board):
        - PATCH /api/services/requests/<id>/
        - Payload: { "status": "in_progress" | "completed" | "cancelled", "note": "..." }
        """
        service_req = self.get_object()
        user = request.user
        new_status = request.data.get('status')

        is_staff_or_admin = (
            not user.is_authenticated or
            user.is_staff or 
            user.is_superuser or 
            getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'owner', 'staff', 'cashier', 'housekeeper', 'service_staff', 'technician'] or
            getattr(user, 'role', '') != 'guest'
        )

        # Nếu là khách hàng: Chỉ cho phép hủy khi đơn còn pending
        if not is_staff_or_admin:
            if new_status == 'cancelled':
                if service_req.status != 'pending':
                    return Response({
                        'success': False,
                        'message': 'Yêu cầu chỉ có thể hủy khi đang ở trạng thái Chờ xử lý.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                service_req.status = 'cancelled'
                service_req.save(update_fields=['status', 'updated_at'])
                serializer = self.get_serializer(service_req, context={'request': request})
                return Response({
                    'success': True,
                    'message': 'Đã hủy yêu cầu dịch vụ thành công.',
                    'data': serializer.data
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'success': False,
                    'message': 'Bạn không có quyền chuyển trạng thái xử lý của nhân viên.'
                }, status=status.HTTP_403_FORBIDDEN)

        # Nhân viên / Quản trị thực hiện đổi trạng thái Kanban
        update_fields = ['updated_at']

        if new_status:
            valid_statuses = [choice[0] for choice in ServiceRequest.STATUS_CHOICES]
            if new_status not in valid_statuses:
                return Response({
                    'success': False,
                    'message': f'Trạng thái "{new_status}" không hợp lệ. Cho phép: {", ".join(valid_statuses)}'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Chặn thay đổi trạng thái nếu đơn đã hoàn thành (đã tính vào hóa đơn)
            if service_req.status == 'completed' and new_status != 'completed':
                return Response({
                    'success': False,
                    'message': 'Yêu cầu dịch vụ này đã hoàn thành và được tính vào hóa đơn phòng, không thể thay đổi trạng thái.'
                }, status=status.HTTP_400_BAD_REQUEST)

            old_status = service_req.status
            service_req.status = new_status
            update_fields.append('status')

            # Nếu chuyển sang "completed" (Đã hoàn thành):
            # Tự động đồng bộ vào bảng Phụ phí phát sinh (BookingExtraService) để tính vào hóa đơn check-out
            if old_status != 'completed' and new_status == 'completed':
                try:
                    clean_name = service_req.service.name if service_req.service else "Dịch vụ phòng"
                    service_name_bill = f"{clean_name} [Yêu cầu #{service_req.id}]"
                    exists = BookingExtraService.objects.filter(
                        booking=service_req.booking,
                        service_name__contains=f"[Yêu cầu #{service_req.id}]"
                    ).exists()
                    if not exists:
                        BookingExtraService.objects.create(
                            booking=service_req.booking,
                            service_name=service_name_bill,
                            quantity=service_req.quantity,
                            price=service_req.service.price
                        )
                except Exception as e:
                    print(f"Lỗi khi đồng bộ phụ phí BookingExtraService: {e}")

            # Nếu chuyển từ "completed" lùi lại trạng thái khác (in_progress, pending, cancelled):
            elif old_status == 'completed' and new_status != 'completed':
                try:
                    BookingExtraService.objects.filter(
                        booking=service_req.booking,
                        service_name__contains=f"[Yêu cầu #{service_req.id}]"
                    ).delete()
                except Exception as e:
                    print(f"Lỗi khi gỡ phụ phí BookingExtraService: {e}")

        if 'note' in request.data:
            service_req.note = request.data.get('note', '').strip()
            update_fields.append('note')

        service_req.save(update_fields=list(set(update_fields)))
        service_req.refresh_from_db()

        # Ghi nhận Nhật ký thao tác hệ thống (Audit Log)
        log_action(
            user=user if user.is_authenticated else None,
            action='UPDATE',
            module='SERVICE',
            description=f"Cập nhật yêu cầu dịch vụ #{service_req.id} ({service_req.service.name if service_req.service else 'Dịch vụ'}) sang \"{service_req.get_status_display()}\"",
            request=request
        )

        serializer = self.get_serializer(service_req, context={'request': request})
        return Response({
            'success': True,
            'message': f'Đã cập nhật yêu cầu #{service_req.id} sang "{service_req.get_status_display()}".',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='kanban')
    def kanban(self, request):
        """
        API chuyên biệt cung cấp dữ liệu định dạng sẵn cho Kanban Board (3 cột chính)
        GET /api/services/requests/kanban/
        """
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True, context={'request': request})
        all_items = serializer.data

        kanban_data = {
            'pending': [item for item in all_items if item['status'] == 'pending'],
            'in_progress': [item for item in all_items if item['status'] == 'in_progress'],
            'completed': [item for item in all_items if item['status'] == 'completed'],
            'cancelled': [item for item in all_items if item['status'] == 'cancelled'],
            'stats': {
                'total': len(all_items),
                'pending_count': len([i for i in all_items if i['status'] == 'pending']),
                'in_progress_count': len([i for i in all_items if i['status'] == 'in_progress']),
                'completed_count': len([i for i in all_items if i['status'] == 'completed']),
                'total_revenue': sum(float(i['total_price'] or 0) for i in all_items if i['status'] == 'completed')
            }
        }

        return Response({
            'success': True,
            'kanban': kanban_data,
            'data': kanban_data
        }, status=status.HTTP_200_OK)
