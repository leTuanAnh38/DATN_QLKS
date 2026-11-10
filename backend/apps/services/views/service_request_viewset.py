"""ServiceRequestViewSet: CRUD phiếu yêu cầu dịch vụ; workflow ghép từ mixin."""
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from ..models import ServiceItem, ServiceRequest
from ..serializers import ServiceRequestSerializer
from ...bookings.models import Booking, BookingExtraService
from ...users.models import log_action
from core_project.pagination import StandardResultsSetPagination
from .request_workflow_mixin import ServiceRequestWorkflowMixin


class ServiceRequestViewSet(ServiceRequestWorkflowMixin, viewsets.ModelViewSet):
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
            'booking', 'booking__room', 'booking__room__category', 'booking__category',
            'booking__guest', 'booking__guest__current_tier',
            'service', 'service__category', 'assigned_staff'
        ).prefetch_related('booking__guests').exclude(
            Q(service__name__icontains='Make-up') | Q(service__name__icontains='dọn dẹp phòng lưu trú')
        ).order_by('-created_at')

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

        # Lọc theo Phân loại Nghiệp vụ Hiện trường (Mobile / Web):
        # 1. transport: Xe đưa đón, đón tiễn sân bay
        # 2. fnb: Ẩm thực & Đồ uống
        # 3. spa: Dịch vụ Spa & Massage
        # 4. laundry: Giặt ủi
        # 5. amenities: Tiện ích phòng
        category_type = self.request.query_params.get('category_type', '').strip().lower()
        if category_type == 'transport':
            base_qs = base_qs.filter(
                Q(service__name__icontains='sân bay') | Q(service__name__icontains='xe') |
                Q(service__name__icontains='đưa đón') | Q(service__name__icontains='transfer') |
                Q(service__name__icontains='airport') | Q(service__name__icontains='taxi') |
                Q(service__name__icontains='shuttle') | Q(service__name__icontains='đón tiễn') |
                Q(service__category__name__icontains='sân bay') | Q(service__category__name__icontains='xe') |
                Q(service__category__name__icontains='vận chuyển') | Q(service__category__name__icontains='transport')
            )
        elif category_type == 'spa':
            base_qs = base_qs.filter(
                Q(service__name__icontains='spa') | Q(service__name__icontains='massage') |
                Q(service__name__icontains='trị liệu') | Q(service__name__icontains='xông hơi') |
                Q(service__name__icontains='sauna') | Q(service__name__icontains='thư giãn') |
                Q(service__name__icontains='wellness') | Q(service__category__name__icontains='spa')
            )
        elif category_type == 'laundry':
            base_qs = base_qs.filter(
                Q(service__name__icontains='giặt') | Q(service__name__icontains='ủi') |
                Q(service__name__icontains='laundry') | Q(service__name__icontains='giặt sấy')
            )
        elif category_type == 'fnb':
            base_qs = base_qs.filter(
                Q(service__name__icontains='ẩm thực') | Q(service__name__icontains='đồ ăn') |
                Q(service__name__icontains='món') | Q(service__name__icontains='bữa ăn') |
                Q(service__name__icontains='đồ uống') | Q(service__name__icontains='f&b') |
                Q(service__name__icontains='dining') | Q(service__name__icontains='bếp') |
                Q(service__name__icontains='nhà hàng') | Q(service__name__icontains='bar') |
                Q(service__name__icontains='cà phê') | Q(service__name__icontains='coffee') |
                Q(service__name__icontains='trà') | Q(service__name__icontains='bánh') |
                Q(service__name__icontains='buffet') | Q(service__name__icontains='rượu') |
                Q(service__name__icontains='bia') | Q(service__category__name__icontains='ẩm thực') |
                Q(service__category__name__icontains='nhà hàng') | Q(service__category__name__icontains='f&b')
            )
        elif category_type in ['amenities', 'room_amenity']:
            # Loại trừ transport, spa, fnb, laundry
            base_qs = base_qs.exclude(
                Q(service__name__icontains='sân bay') | Q(service__name__icontains='xe') |
                Q(service__name__icontains='đưa đón') | Q(service__name__icontains='transfer') |
                Q(service__name__icontains='spa') | Q(service__name__icontains='massage') |
                Q(service__name__icontains='ẩm thực') | Q(service__name__icontains='đồ ăn') |
                Q(service__name__icontains='món') | Q(service__name__icontains='giặt')
            )

        # Lọc việc của tôi / chưa ai nhận
        assigned_to_me = self.request.query_params.get('assigned_to_me', '').lower() in ['1', 'true', 'yes']
        if assigned_to_me and user.is_authenticated:
            base_qs = base_qs.filter(assigned_staff=user)

        unassigned = self.request.query_params.get('unassigned', '').lower() in ['1', 'true', 'yes']
        if unassigned:
            base_qs = base_qs.filter(assigned_staff__isnull=True)

        if not user.is_authenticated:
            # Khách chưa đăng nhập (khách đoàn/vãng lai): chỉ cho phép tra cứu nếu truyền đúng mã booking cụ thể
            booking_param = self.request.query_params.get('booking_id') or self.request.query_params.get('booking')
            if booking_param:
                if str(booking_param).isdigit():
                    return base_qs.filter(booking_id=int(booking_param))
                return base_qs.filter(booking__booking_code=str(booking_param).strip().upper())
            return base_qs.none()

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
            'results': serializer.data,
            'requests': serializer.data,
            'items': serializer.data,
            'data': serializer.data
        }, status=status.HTTP_200_OK)


    def create(self, request, *args, **kwargs):
        """
        Khách hàng gửi yêu cầu dịch vụ tại phòng:
        Hỗ trợ:
        1. Gọi đơn lẻ 1 món:
           Payload: { "booking_id": "BK-02DE4E", "service_id": 1, "quantity": 2, "note": "..." }
        2. Gọi nhiều món cùng lúc (Giỏ dịch vụ - Service Cart):
           Payload: {
               "booking_id": "BK-02DE4E",
               "items": [
                   { "service_id": 1, "quantity": 2, "note": "Ít cay" },
                   { "service_id": 3, "quantity": 1, "note": "" }
               ],
               "note": "Giao cùng lúc",
               "is_scheduled": false,
               "request_time": "..."
           }
        """
        user = request.user
        data = request.data
        booking_id = data.get('booking') or data.get('booking_id')
        items = data.get('items')

        # 1. Kiểm tra mã đặt phòng bắt buộc
        if not booking_id:
            return Response({
                'success': False,
                'message': 'Vui lòng nhập Mã Đặt phòng (VD: BK-02DE4E) in trên thẻ phòng hoặc phiếu nhận phòng của bạn.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 2. Tìm Booking theo ID hoặc booking_code
        booking = Booking.objects.filter(pk=booking_id).select_related('room', 'guest', 'group_booking').first() if str(booking_id).isdigit() else None
        if not booking:
            booking = Booking.objects.filter(booking_code=str(booking_id).strip().upper()).select_related('room', 'guest', 'group_booking').first()

        if not booking:
            return Response({
                'success': False,
                'message': f'Không tìm thấy đơn đặt phòng với mã "{booking_id}". Quý khách vui lòng kiểm tra lại mã in trên phiếu nhận phòng hoặc thẻ phòng.'
            }, status=status.HTTP_404_NOT_FOUND)

        # 2.1. Phân quyền:
        # Nếu khách đã đăng nhập: kiểm tra tính sở hữu đơn phòng
        is_staff_or_admin = False
        if user.is_authenticated:
            is_staff_or_admin = (
                user.is_staff or 
                user.is_superuser or 
                getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'owner', 'staff', 'cashier', 'service_staff', 'housekeeper'] or
                getattr(user, 'role', '') != 'guest'
            )
            if not is_staff_or_admin:
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

        room_display = booking.room.room_number if booking.room else 'phòng'

        # Xử lý thời gian hẹn giờ phục vụ / giao món (Scheduled delivery)
        req_time_str = data.get('request_time')
        is_scheduled_param = bool(data.get('is_scheduled', False))
        final_request_time = None

        if req_time_str:
            try:
                from django.utils.dateparse import parse_datetime
                parsed_dt = parse_datetime(req_time_str)
                if parsed_dt:
                    if timezone.is_naive(parsed_dt):
                        parsed_dt = timezone.make_aware(parsed_dt)
                    final_request_time = parsed_dt
                    is_scheduled_param = True
            except Exception as e:
                print(f"Lỗi parse request_time: {e}")

        if not final_request_time:
            final_request_time = timezone.now()

        # Tự động gán nhân viên phụ trách nếu đơn được tạo bởi nhân viên / lễ tân
        assigned_to = None
        if user.is_authenticated and is_staff_or_admin:
            target_staff_id = data.get('assigned_staff') or data.get('staff_id')
            if target_staff_id:
                from ...users.models import User as UserModel
                target_user = UserModel.objects.filter(pk=target_staff_id).first()
                if target_user:
                    assigned_to = target_user
            else:
                # Nhân viên phục vụ / Lái xe tạo đơn hộ khách -> tự động nhận phụ trách
                assigned_to = user

        general_note = data.get('note', '').strip()

        # ==========================================
        # TRƯỜNG HỢP 1: ĐẶT NHIỀU MÓN CÙNG LÚC (CART)
        # ==========================================
        if items and isinstance(items, list):
            if len(items) == 0:
                return Response({
                    'success': False,
                    'message': 'Giỏ dịch vụ của quý khách đang trống.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Thu thập và kiểm tra danh sách items
            parsed_items = []
            service_ids = []
            for idx, raw_item in enumerate(items):
                s_id = raw_item.get('service') or raw_item.get('service_id')
                if not s_id:
                    return Response({
                        'success': False,
                        'message': f'Món thứ {idx + 1} trong giỏ chưa có thông tin dịch vụ.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                try:
                    qty = int(raw_item.get('quantity', 1))
                    if qty < 1 or qty > 99:
                        return Response({
                            'success': False,
                            'message': f'Số lượng món thứ {idx + 1} phải từ 1 đến 99.'
                        }, status=status.HTTP_400_BAD_REQUEST)
                except (ValueError, TypeError):
                    return Response({
                        'success': False,
                        'message': f'Số lượng món thứ {idx + 1} không hợp lệ.'
                    }, status=status.HTTP_400_BAD_REQUEST)

                service_ids.append(s_id)
                parsed_items.append({
                    'service_id': s_id,
                    'quantity': qty,
                    'note': (raw_item.get('note') or '').strip()
                })

            # Lấy thông tin các ServiceItem hợp lệ
            service_map = {item.id: item for item in ServiceItem.objects.filter(pk__in=service_ids, is_active=True)}
            missing_ids = [s_id for s_id in service_ids if s_id not in service_map]
            if missing_ids:
                return Response({
                    'success': False,
                    'message': 'Một số dịch vụ trong giỏ hiện đang tạm ngưng phục vụ hoặc không tồn tại.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Tạo hàng loạt ServiceRequest trong atomic transaction
            created_requests = []
            with transaction.atomic():
                for item_info in parsed_items:
                    srv = service_map[item_info['service_id']]
                    qty = item_info['quantity']
                    item_note = item_info['note']
                    combined_note = f"{item_note} ({general_note})" if item_note and general_note else (item_note or general_note)
                    total_p = srv.price * qty

                    sr = ServiceRequest.objects.create(
                        booking=booking,
                        service=srv,
                        quantity=qty,
                        unit_price=srv.price,
                        total_price=total_p,
                        status='pending',
                        assigned_staff=assigned_to,
                        note=combined_note,
                        is_scheduled=is_scheduled_param,
                        request_time=final_request_time
                    )
                    created_requests.append(sr)

            serializer = ServiceRequestSerializer(created_requests, many=True, context={'request': request})
            return Response({
                'success': True,
                'message': f'Đã gửi thành công {len(created_requests)} dịch vụ/món ăn cho Phòng {room_display}! Nhân viên sẽ chuẩn bị và phục vụ quý khách.',
                'request': serializer.data[0] if serializer.data else None,
                'requests': serializer.data,
                'data': serializer.data[0] if serializer.data else None,
                'count': len(created_requests),
                'room_number': room_display
            }, status=status.HTTP_201_CREATED)

        # ==========================================
        # TRƯỜNG HỢP 2: ĐẶT 1 MÓN ĐƠN LẺ
        # ==========================================
        service_id = data.get('service') or data.get('service_id')
        quantity = data.get('quantity', 1)
        note = general_note

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

        service_item = ServiceItem.objects.filter(pk=service_id, is_active=True).first()
        if not service_item:
            return Response({
                'success': False,
                'message': 'Dịch vụ này hiện đang tạm ngưng phục vụ hoặc không tồn tại.'
            }, status=status.HTTP_404_NOT_FOUND)

        total_price = service_item.price * quantity
        service_request = ServiceRequest.objects.create(
            booking=booking,
            service=service_item,
            quantity=quantity,
            unit_price=service_item.price,
            total_price=total_price,
            status='pending',
            assigned_staff=assigned_to,
            note=note,
            is_scheduled=is_scheduled_param,
            request_time=final_request_time
        )

        serializer = ServiceRequestSerializer(service_request, context={'request': request})

        return Response({
            'success': True,
            'message': f'Đã gửi yêu cầu "{service_item.name}" cho Phòng {room_display} thành công! Nhân viên sẽ phục vụ trong ít phút.',
            'request': serializer.data,
            'requests': [serializer.data],
            'data': serializer.data,
            'room_number': room_display
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

        if not user.is_authenticated:
            if new_status == 'cancelled':
                if service_req.status != 'pending':
                    return Response({
                        'success': False,
                        'message': 'Yêu cầu chỉ có thể hủy khi đang ở trạng thái Chờ xử lý (nhân viên chưa tiếp nhận chuẩn bị).'
                    }, status=status.HTTP_400_BAD_REQUEST)
                if service_req.is_paid:
                    return Response({
                        'success': False,
                        'message': 'Dịch vụ này đã thanh toán trước. Quý khách vui lòng liên hệ Lễ tân để được hỗ trợ hủy và hoàn tiền.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                req_booking_code = str(request.data.get('booking_code') or request.query_params.get('booking_code') or '').strip()
                if req_booking_code and service_req.booking and service_req.booking.booking_code.upper() != req_booking_code.upper():
                    return Response({
                        'success': False,
                        'message': 'Mã đặt phòng xác thực không khớp với đơn dịch vụ.'
                    }, status=status.HTTP_403_FORBIDDEN)
                service_req.status = 'cancelled'
                service_req.save(update_fields=['status', 'updated_at'])
                BookingExtraService.objects.filter(
                    booking=service_req.booking,
                    is_paid=False,
                    service_name__contains=f"[Yêu cầu #{service_req.id}]"
                ).delete()
                log_action(
                    user=user if user.is_authenticated else (service_req.booking.guest if service_req.booking else None),
                    action='UPDATE',
                    module='SERVICE',
                    description=f"Khách hàng hủy yêu cầu dịch vụ #{service_req.id} ({service_req.service.name if service_req.service else 'Dịch vụ'})",
                    request=request
                )
                serializer = self.get_serializer(service_req, context={'request': request})
                return Response({
                    'success': True,
                    'message': 'Đã hủy yêu cầu dịch vụ thành công.',
                    'data': serializer.data
                }, status=status.HTTP_200_OK)
            return Response({
                'success': False,
                'message': 'Quý khách vui lòng đăng nhập để thực hiện thao tác.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        is_staff_or_admin = (
            user.is_staff or 
            user.is_superuser or 
            getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'owner', 'staff', 'cashier', 'housekeeper', 'service_staff', 'technician'] or
            getattr(user, 'role', '') != 'guest'
        )

        # Nếu là khách hàng: Chỉ cho phép hủy đơn của chính mình khi còn pending và chưa thanh toán
        if not is_staff_or_admin:
            if new_status == 'cancelled':
                if service_req.booking and service_req.booking.guest and service_req.booking.guest != user:
                    req_booking_code = str(request.data.get('booking_code') or '').strip()
                    if not req_booking_code or service_req.booking.booking_code.upper() != req_booking_code.upper():
                        return Response({
                            'success': False,
                            'message': 'Bạn không có quyền hủy yêu cầu dịch vụ của phòng khác.'
                        }, status=status.HTTP_403_FORBIDDEN)
                if service_req.status != 'pending':
                    return Response({
                        'success': False,
                        'message': 'Yêu cầu chỉ có thể hủy khi đang ở trạng thái Chờ xử lý (nhân viên chưa tiếp nhận chuẩn bị).'
                    }, status=status.HTTP_400_BAD_REQUEST)
                if service_req.is_paid:
                    return Response({
                        'success': False,
                        'message': 'Dịch vụ này đã thanh toán trước. Quý khách vui lòng liên hệ Lễ tân để được hỗ trợ hủy và hoàn tiền.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                service_req.status = 'cancelled'
                service_req.save(update_fields=['status', 'updated_at'])
                BookingExtraService.objects.filter(
                    booking=service_req.booking,
                    is_paid=False,
                    service_name__contains=f"[Yêu cầu #{service_req.id}]"
                ).delete()
                log_action(
                    user=user if user.is_authenticated else (service_req.booking.guest if service_req.booking else None),
                    action='UPDATE',
                    module='SERVICE',
                    description=f"Khách hàng hủy yêu cầu dịch vụ #{service_req.id} ({service_req.service.name if service_req.service else 'Dịch vụ'})",
                    request=request
                )
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
        perm_resp = self._check_staff_service_permission(user, service_req, action_name='cập nhật trạng thái')
        if perm_resp is not None:
            return perm_resp

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

            # Kiểm tra điều kiện bắt đầu / thực hiện dịch vụ phòng (khóa dịch vụ)
            if new_status in ['in_progress', 'delivering', 'completed']:
                lock_response = self._check_service_lock(service_req)
                if lock_response is not None:
                    return lock_response

            old_status = service_req.status
            service_req.status = new_status
            update_fields.append('status')

            if 'is_paid' in request.data:
                service_req.is_paid = bool(request.data.get('is_paid'))
                update_fields.append('is_paid')

            # Đồng bộ sang BookingExtraService và ghi nhận Payment thanh toán tiền mặt tại phòng
            effective_status = new_status or service_req.status
            if effective_status == 'completed':
                try:
                    clean_name = service_req.service.name if service_req.service else "Dịch vụ phòng"
                    service_name_bill = f"{clean_name} [Yêu cầu #{service_req.id}]"
                    existing_bes = BookingExtraService.objects.filter(
                        booking=service_req.booking
                    ).filter(
                        Q(service_name__contains=f"[Yêu cầu #{service_req.id}]") |
                        Q(service_name__icontains=clean_name)
                    ).first()

                    if existing_bes:
                        existing_bes.is_paid = service_req.is_paid
                        existing_bes.save(update_fields=['is_paid'])
                    else:
                        BookingExtraService.objects.create(
                            booking=service_req.booking,
                            service_name=service_name_bill,
                            quantity=service_req.quantity,
                            price=service_req.service.price if service_req.service else service_req.unit_price,
                            is_paid=service_req.is_paid
                        )

                    # Ghi nhận / Cập nhật bản ghi Payment tiền mặt tại phòng nếu đã thu tiền
                    from ...payments.models import Payment, CashierShift
                    txn_id = f"SVC-REQ-{service_req.id}"
                    if service_req.is_paid:
                        active_shift = CashierShift.objects.filter(status='OPEN').order_by('-opened_at').first()
                        svc_amount = service_req.total_price or ((service_req.service.price if service_req.service else 0) * service_req.quantity)
                        pay_method = str(request.data.get('payment_method') or 'CASH').upper()
                        Payment.objects.update_or_create(
                            transaction_id=txn_id,
                            defaults={
                                'booking': service_req.booking,
                                'amount': svc_amount,
                                'payment_method': pay_method,
                                'payment_status': 'COMPLETED',
                                'shift': active_shift,
                            }
                        )
                    else:
                        Payment.objects.filter(transaction_id=txn_id).delete()
                except Exception as e:
                    print(f"Lỗi khi đồng bộ phụ phí và thanh toán dịch vụ: {e}")

            # Nếu chuyển sang "cancelled" hoặc lùi từ "completed" sang trạng thái khác: gỡ phụ phí chưa thanh toán khỏi Folio
            elif new_status == 'cancelled' or (old_status == 'completed' and new_status != 'completed'):
                try:
                    BookingExtraService.objects.filter(
                        booking=service_req.booking,
                        is_paid=False,
                        service_name__contains=f"[Yêu cầu #{service_req.id}]"
                    ).delete()
                    from ...payments.models import Payment
                    Payment.objects.filter(transaction_id=f"SVC-REQ-{service_req.id}").delete()
                except Exception as e:
                    print(f"Lỗi khi gỡ phụ phí và thanh toán BookingExtraService: {e}")

        # Cập nhật nhân viên / tài xế phụ trách (nếu được truyền lên hoặc tự động gán khi nhân viên xử lý đơn)
        assigned_staff_param = request.data.get('assigned_staff') or request.data.get('staff_id')
        if assigned_staff_param is not None and is_staff_or_admin:
            if assigned_staff_param in ['', 0, 'null', 'none']:
                service_req.assigned_staff = None
            else:
                from ...users.models import User as UserModel
                assign_target = UserModel.objects.filter(pk=assigned_staff_param).first()
                if assign_target:
                    service_req.assigned_staff = assign_target
            update_fields.append('assigned_staff')
        elif service_req.assigned_staff is None and is_staff_or_admin and user.is_authenticated:
            # Tự động gán nhân viên đang thao tác xử lý đơn (bắt đầu chế biến, đi đón, giao món, hoàn thành)
            if new_status in ['in_progress', 'delivering', 'completed']:
                service_req.assigned_staff = user
                update_fields.append('assigned_staff')

        if 'is_paid' in request.data and 'is_paid' not in update_fields:
            service_req.is_paid = bool(request.data.get('is_paid'))
            update_fields.append('is_paid')

        # Xử lý lý do hủy đơn dịch vụ nếu có
        cancel_reason = request.data.get('reason') or request.data.get('cancellation_reason')
        if new_status == 'cancelled' and cancel_reason:
            import re
            reason_clean = str(cancel_reason).strip()
            curr_note = (service_req.note or '').strip()
            if '[ĐÃ HỦY:' in curr_note:
                curr_note = re.sub(r'\[ĐÃ HỦY:.*?\]\s*', '', curr_note).strip()
            service_req.note = f"[ĐÃ HỦY: {reason_clean}] {curr_note}".strip()
            update_fields.append('note')
        elif 'note' in request.data:
            service_req.note = request.data.get('note', '').strip()
            update_fields.append('note')

        service_req.save(update_fields=list(set(update_fields)))
        service_req.refresh_from_db()

        # Ghi nhận Nhật ký thao tác hệ thống (Audit Log)
        svc_label = service_req.service.name if service_req.service else 'Dịch vụ'
        room_label = service_req.booking.room.room_number if (service_req.booking and service_req.booking.room) else 'Chưa xếp phòng'
        audit_desc = f"Cập nhật yêu cầu dịch vụ #{service_req.id} ({svc_label} - P.{room_label}) sang \"{service_req.get_status_display()}\""
        if new_status == 'completed':
            amt_val = float(service_req.total_price or 0)
            pay_label = "Đã thu tiền mặt tại phòng" if service_req.is_paid else "Ghi nợ vào Folio phòng"
            audit_desc = f"Hoàn tất phục vụ #{service_req.id} ({svc_label} - P.{room_label}): {amt_val:,.0f} VND ({pay_label})"
        elif new_status == 'cancelled' and cancel_reason:
            audit_desc = f"Hủy yêu cầu dịch vụ #{service_req.id} ({svc_label} - P.{room_label}) (Lý do: {cancel_reason.strip()})"

        log_action(
            user=user if user.is_authenticated else None,
            action='UPDATE',
            module='SERVICE',
            description=audit_desc,
            request=request
        )

        serializer = self.get_serializer(service_req, context={'request': request})
        return Response({
            'success': True,
            'message': f'Đã cập nhật yêu cầu #{service_req.id} sang "{service_req.get_status_display()}".',
            'data': serializer.data
        }, status=status.HTTP_200_OK)


    def destroy(self, request, *args, **kwargs):
        user = request.user
        user_role = getattr(user, 'role', '')
        if not (user.is_authenticated and (user.is_superuser or user_role in ['admin', 'owner', 'manager'])):
            return Response({
                'success': False,
                'message': 'Chỉ Quản lý hoặc Quản trị viên mới có quyền xóa đơn yêu cầu dịch vụ.'
            }, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)
