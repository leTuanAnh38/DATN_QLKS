"""BookingViewSet: CRUD cơ bản; các nhóm action được ghép từ các mixin."""
from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action
from django.utils import timezone
from datetime import datetime, timedelta
from django.db.models import Q, F
from django.db import transaction
from ..models import Booking, Promotion, BookingExtraService, BookingGuest
from ...rooms.models import Room, RoomCategory
from ...users.models import User, GuestProfile, log_action
from ...users.views import check_role_permission
from ...services.models import ServiceItem, ServiceRequest
from ...payments.models import Invoice, Payment
from ..serializers import BookingSerializer, optimize_booking_queryset
from ..email_service import send_booking_email_async
from core_project.pagination import StandardResultsSetPagination
from .room_assignment_mixin import BookingRoomAssignmentMixin
from .frontdesk_mixin import BookingFrontDeskMixin
from .reservation_mixin import BookingReservationMixin
from .extra_services_mixin import BookingExtraServicesMixin
from .analytics_mixin import BookingAnalyticsMixin


class BookingViewSet(
    BookingRoomAssignmentMixin,
    BookingFrontDeskMixin,
    BookingReservationMixin,
    BookingExtraServicesMixin,
    BookingAnalyticsMixin,
    viewsets.ModelViewSet,
):
    """
    API xử lý Đặt phòng cho Khách hàng & Quản lý đơn:
    - POST /api/bookings/: Đặt phòng mới (Công khai / Khách vãng lai & Thành viên)
    - GET /api/bookings/: Xem danh sách đơn (Thành viên xem đơn của mình, Staff xem tất cả)
    - GET /api/bookings/<id>/: Chi tiết đơn đặt phòng
    """
    serializer_class = BookingSerializer
    pagination_class = StandardResultsSetPagination


    def get_permissions(self):
        # Cho phép mọi khách hàng (kể cả chưa đăng nhập) có thể kiểm tra phòng, tạo đơn đặt phòng và hủy đơn tại bước thanh toán
        if self.action in ['create', 'check_availability', 'cancel_booking']:
            return [AllowAny()]
        return [IsAuthenticated()]


    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Booking.objects.none()

        # Luôn tạo mới QuerySet từ DB (.all()) để tránh lưu cache kết quả cũ trong bộ nhớ (QuerySet._result_cache)
        base_qs = Booking.objects.select_related(
            'guest', 'category', 'room', 'room__category', 'applied_promotion'
        ).all().order_by('-created_at')
        # API danh sách (chỉ đọc): prefetch toàn bộ quan hệ để tránh N+1 query.
        # Các action ghi (check-in, thêm dịch vụ, thanh toán...) không prefetch để luôn đọc dữ liệu mới nhất.
        if getattr(self, 'action', None) == 'list':
            base_qs = optimize_booking_queryset(base_qs)

        # Nếu là nhân viên, lễ tân, quản lý, admin -> xem tất cả đơn mới nhất từ CSDL, ưu tiên:
        # 1. Chờ duyệt (pending) lên đầu tiên
        # 2. Đã xác nhận (confirmed) kế tiếp
        # 3. Đang lưu trú / đang ở (checked_in) kế tiếp
        # 4. Các đơn khác (đã hoàn tất / trả phòng / no-show / đã hủy)
        is_staff_or_admin = (
            user.is_staff or 
            user.is_superuser or 
            getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'owner', 'staff', 'cashier', 'housekeeper', 'service_staff', 'technician'] or
            getattr(user, 'role', '') != 'guest'
        )

        # Lọc theo guest_id nếu có trong query params (phục vụ CRM / Trang Chi tiết Khách hàng)
        guest_id = self.request.query_params.get('guest_id') or self.request.query_params.get('guest')
        if guest_id:
            if str(guest_id).isdigit():
                guest_filter = Q(guest_id=int(guest_id)) | Q(guest__id=int(guest_id))
            else:
                guest_filter = Q(guest__username=guest_id) | Q(guest__email=guest_id)
            if not is_staff_or_admin:
                base_qs = base_qs.filter(Q(guest=user) & guest_filter)
            else:
                base_qs = base_qs.filter(guest_filter)
            return base_qs.order_by('-created_at')

        # Lọc tìm kiếm theo từ khóa (Mã đặt phòng, Tên khách, SĐT, Số CCCD, Số phòng)
        search_query = (self.request.query_params.get('search') or '').strip()
        if search_query:
            clean_kw = search_query.lstrip('#').strip() or search_query
            base_qs = base_qs.filter(
                Q(booking_code__icontains=clean_kw) |
                Q(guest__first_name__icontains=search_query) |
                Q(guest__last_name__icontains=search_query) |
                Q(guest__username__icontains=search_query) |
                Q(guest__email__icontains=search_query) |
                Q(guest__phone_number__icontains=search_query) |
                Q(guests__full_name__icontains=search_query) |
                Q(guests__id_number__icontains=search_query) |
                Q(identity_card__icontains=search_query) |
                Q(room__room_number__icontains=search_query) |
                Q(company_name__icontains=search_query)
            ).distinct()

            from django.db.models import Case, When, Value, IntegerField
            # ƯU TIÊN TUYỆT ĐỐI: Khớp chính xác mã đơn lên vị trí số 1 đầu tiên
            match_priority = Case(
                When(booking_code__iexact=clean_kw, then=Value(1)),
                When(booking_code__iexact=f"BK-{clean_kw}", then=Value(1)),
                When(booking_code__istartswith=clean_kw, then=Value(2)),
                When(booking_code__istartswith=f"BK-{clean_kw}", then=Value(2)),
                When(booking_code__icontains=clean_kw, then=Value(3)),
                default=Value(10),
                output_field=IntegerField()
            )
            return base_qs.order_by(match_priority, '-created_at')

        # Nếu là nhân viên, lễ tân, quản lý, admin -> xem tất cả đơn mới nhất từ CSDL, ưu tiên:
        # 1. Chờ duyệt (pending) lên đầu tiên
        # 2. Đã xác nhận (confirmed) kế tiếp
        # 3. Đang lưu trú / đang ở (checked_in) kế tiếp
        # 4. Các đơn khác (đã hoàn tất / trả phòng / no-show / đã hủy)
        if is_staff_or_admin:
            from django.db.models import Case, When, Value, IntegerField
            status_priority = Case(
                When(status__in=['pending', 'paid', 'PAID'], then=Value(1)),
                When(status='confirmed', then=Value(2)),
                When(status='checked_in', then=Value(3)),
                When(status__in=['checked_out', 'completed'], then=Value(4)),
                When(status='no_show', then=Value(5)),
                When(status='cancelled', then=Value(6)),
                default=Value(99),
                output_field=IntegerField()
            )
            return base_qs.order_by(status_priority, '-created_at')

        # Nếu là khách hàng -> chỉ xem đơn của chính họ
        user_email = user.email.strip() if user.email else ''
        if user_email:
            return base_qs.filter(Q(guest=user) | Q(guest__email=user_email))
        return base_qs.filter(guest=user)


    def perform_update(self, serializer):
        instance = serializer.instance
        old_status = instance.status
        pending_status = serializer.validated_data.get('status', old_status)
        if pending_status == 'no_show' and old_status != 'no_show':
            today = timezone.localdate()
            if instance.check_in_date and today < instance.check_in_date:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({
                    'status': f"Chưa tới ngày nhận phòng ({instance.check_in_date.strftime('%d/%m/%Y')}). Không thể chuyển sang trạng thái No-show."
                })
        updated_booking = serializer.save()
        new_status = updated_booking.status

        # 1. Nếu chuyển sang checked_out hoặc completed: Tự động ghi nhận actual_check_out và chuyển phòng sang cleaning (đang dọn dẹp)
        if old_status not in ['checked_out', 'completed'] and new_status in ['checked_out', 'completed']:
            if not updated_booking.actual_check_out:
                updated_booking.actual_check_out = timezone.now()
                updated_booking.save(update_fields=['actual_check_out'])
            if updated_booking.room:
                updated_booking.room.status = 'cleaning'
                updated_booking.room.save(update_fields=['status'])

        # 2. Nếu hủy đơn (cancelled) hoặc No-show: Nếu phòng thực tế đang bị giữ -> giải phóng về available (sẵn sàng)
        elif new_status in ['cancelled', 'no_show']:
            if updated_booking.room and updated_booking.room.status != 'available':
                updated_booking.room.status = 'available'
                updated_booking.room.save(update_fields=['status'])


    def create(self, request, *args, **kwargs):
        data = request.data
        room_identifier = data.get('room') or data.get('room_id') or data.get('category_id')
        check_in_str = data.get('check_in_date')
        check_out_str = data.get('check_out_date')
        note = data.get('note', '').strip()
        guest_name = data.get('guest_name', '').strip()
        guest_phone = data.get('guest_phone', '').strip()
        guest_email = data.get('guest_email', '').strip()
        identity_card = data.get('identity_card', '').strip()
        promo_code = data.get('promo_code', '').strip().upper()

        customer_type = str(data.get('customer_type') or 'MEMBER').strip().upper()
        company_name = str(data.get('company_name') or '').strip() or None
        company_tax_code = str(data.get('company_tax_code') or '').strip() or None
        company_address = str(data.get('company_address') or '').strip() or None

        if customer_type == 'CORPORATE':
            if not company_name:
                return Response({
                    'success': False,
                    'message': 'Vui lòng nhập Tên công ty / Doanh nghiệp khi chọn loại đặt phòng Doanh nghiệp.'
                }, status=status.HTTP_400_BAD_REQUEST)
            if not company_tax_code:
                return Response({
                    'success': False,
                    'message': 'Vui lòng nhập Mã số thuế của công ty.'
                }, status=status.HTTP_400_BAD_REQUEST)
            if not company_address:
                return Response({
                    'success': False,
                    'message': 'Vui lòng nhập Địa chỉ xuất hóa đơn GTGT của công ty.'
                }, status=status.HTTP_400_BAD_REQUEST)
            import re
            if not re.match(r'^(\d{10}|\d{13}|\d{10}-\d{3})$', company_tax_code):
                return Response({
                    'success': False,
                    'message': 'Mã số thuế không đúng chuẩn Việt Nam. MST phải gồm 10 số (VD: 0101234567) hoặc 13 số (VD: 0101234567-001 hoặc 0101234567001).'
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            customer_type = 'MEMBER'
            company_name = None
            company_tax_code = None
            company_address = None

        if not room_identifier:
            return Response({
                'success': False,
                'message': 'Vui lòng chọn hạng phòng cần đặt.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not identity_card:
            return Response({
                'success': False,
                'message': 'Số CCCD / Hộ chiếu là bắt buộc theo quy định pháp lý lưu trú.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if len(identity_card) < 8 or len(identity_card) > 20:
            return Response({
                'success': False,
                'message': 'Số CCCD / Hộ chiếu phải có độ dài từ 8 đến 20 ký tự.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not check_in_str or not check_out_str:
            return Response({
                'success': False,
                'message': 'Vui lòng chọn ngày nhận phòng và ngày trả phòng hợp lệ.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 1. Parse & Kiểm tra tính hợp lệ của ngày tháng
        try:
            check_in = datetime.strptime(str(check_in_str)[:10], '%Y-%m-%d').date()
            check_out = datetime.strptime(str(check_out_str)[:10], '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'success': False,
                'message': 'Định dạng ngày tháng không đúng (chuẩn YYYY-MM-DD).'
            }, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localdate()
        if check_in < today:
            return Response({
                'success': False,
                'message': f'Ngày nhận phòng không hợp lệ. Ngày nhận phòng ({check_in.strftime("%d/%m/%Y")}) không thể ở trong quá khứ (Hôm nay là {today.strftime("%d/%m/%Y")}).'
            }, status=status.HTTP_400_BAD_REQUEST)

        if check_out <= check_in:
            return Response({
                'success': False,
                'message': 'Ngày trả phòng (Check-out) bắt buộc phải sau ngày nhận phòng (Check-in).'
            }, status=status.HTTP_400_BAD_REQUEST)

        nights = (check_out - check_in).days
        if nights < 1:
            nights = 1

        # 2. Tìm Hạng phòng hoặc Phòng thực tế
        room_instance = None
        category_instance = None

        # Kiểm tra nếu room_identifier là số ID hoặc chuỗi slug
        if str(room_identifier).isdigit():
            # Thử tìm theo RoomCategory trước
            category_instance = RoomCategory.objects.filter(pk=int(room_identifier)).first()
            if not category_instance:
                # Thử tìm theo Room
                room_instance = Room.objects.filter(pk=int(room_identifier)).first()
                if room_instance:
                    category_instance = room_instance.category
        else:
            category_instance = RoomCategory.objects.filter(slug=str(room_identifier)).first()

        if not category_instance and not room_instance:
            return Response({
                'success': False,
                'message': f'Không tìm thấy thông tin phòng với mã "{room_identifier}".'
            }, status=status.HTTP_404_NOT_FOUND)

        # 2.1 Kiểm tra tình trạng phòng trống và tạo đơn trong transaction.atomic với Pessimistic Lock
        with transaction.atomic():
            # Khóa bi quan hạng phòng để chống overbooking khi nhiều khách cùng đặt tại một thời điểm
            category_instance = RoomCategory.objects.select_for_update().get(pk=category_instance.pk)

            # Chỉ tính các đơn pending được tạo trong vòng 15 phút gần nhất (chờ thanh toán QR)
            pending_timeout = timezone.now() - timedelta(minutes=15)
            total_rooms = category_instance.rooms.exclude(status='maintenance').count()
            booked_rooms = Booking.objects.filter(
                category=category_instance,
                check_in_date__lt=check_out,
                check_out_date__gt=check_in
            ).filter(
                Q(status__in=['confirmed', 'checked_in']) |
                Q(status__in=['pending', 'paid', 'PAID'], created_at__gte=pending_timeout)
            ).count()
            available_rooms = max(0, total_rooms - booked_rooms)

            if available_rooms <= 0:
                suggested = []
                for other_cat in RoomCategory.objects.exclude(id=category_instance.id):
                    other_total = other_cat.rooms.exclude(status='maintenance').count()
                    other_booked = Booking.objects.filter(
                        category=other_cat,
                        check_in_date__lt=check_out,
                        check_out_date__gt=check_in
                    ).filter(
                        Q(status__in=['confirmed', 'checked_in']) |
                        Q(status__in=['pending', 'paid', 'PAID'], created_at__gte=pending_timeout)
                    ).count()
                    other_avail = max(0, other_total - other_booked)
                    if other_avail > 0:
                        feat_img = other_cat.images.filter(is_feature=True).first() or other_cat.images.first()
                        feat_url = request.build_absolute_uri(feat_img.image.url) if (feat_img and feat_img.image) else ''
                        suggested.append({
                            'id': other_cat.id,
                            'name': other_cat.name,
                            'base_price': float(other_cat.base_price),
                            'promo_price': float(other_cat.promo_price) if other_cat.promo_price else None,
                            'available_rooms': other_avail,
                            'image': feat_url,
                            'size': other_cat.size,
                            'bed_type': other_cat.bed_type,
                            'capacity': other_cat.capacity
                        })

                return Response({
                    'success': False,
                    'code': 'ROOM_SOLD_OUT',
                    'message': f'Rất tiếc, tất cả các phòng thuộc hạng "{category_instance.name}" đã được đặt kín từ {check_in.strftime("%d/%m/%Y")} đến {check_out.strftime("%d/%m/%Y")}. Quý khách vui lòng chọn ngày khác hoặc tham khảo các hạng phòng còn trống bên dưới.',
                    'total_rooms': total_rooms,
                    'booked_rooms': booked_rooms,
                    'available_rooms': 0,
                    'suggested_categories': suggested
                }, status=status.HTTP_400_BAD_REQUEST)

            # Nếu chưa có room_instance cụ thể, gán phòng trống thuộc hạng phòng đó
            if not room_instance and category_instance:
                available_room = category_instance.rooms.filter(status='available').first()
                room_instance = available_room or category_instance.rooms.first()

            # 3. Tính toán tiền phòng
            price_per_night = category_instance.promo_price or category_instance.base_price
            subtotal = Decimal(str(price_per_night * nights))

            # 4. Xác định User đặt phòng (Nếu đã đăng nhập hoặc tìm/tạo tài khoản khách)
            if request.user and request.user.is_authenticated:
                guest_user = request.user
            else:
                # Tìm hoặc gán tài khoản khách
                guest_user = None
                if guest_email:
                    guest_user = User.objects.filter(email=guest_email).first()
                if not guest_user:
                    # Gán vào tài khoản khách mặc định
                    guest_user = User.objects.filter(role='guest').first() or User.objects.first()

            # 5. Xử lý Giảm giá Hạng thành viên (Loyalty & Membership Program)
            membership_discount = Decimal('0')
            tier_percent = Decimal('0')
            tier_name = None
            if guest_user and getattr(guest_user, 'current_tier', None):
                tier = guest_user.current_tier
                tier_percent = Decimal(str(tier.discount_percent or 0))
                if tier_percent > 0:
                    membership_discount = (subtotal * tier_percent) / Decimal('100')
                    tier_name = tier.name

            # 6. Xử lý Mã khuyến mãi (nếu có)
            promotion_obj = None
            discount_amount = Decimal('0')
            if promo_code:
                now = timezone.now()
                promo = Promotion.objects.filter(
                    code=promo_code,
                    is_active=True,
                    valid_from__lte=now,
                    valid_to__gte=now
                ).first()

                # Tự động tạo bản ghi Promotion nếu là mã hệ thống mặc định (đồng bộ ValidatePromoCodeView)
                if not promo and promo_code in ['WELCOME10', 'VIP10', 'SUMMER2026', 'TADANANG']:
                    promo, _ = Promotion.objects.get_or_create(
                        code=promo_code,
                        defaults={
                            'discount_type': 'percentage',
                            'discount_value': 10,
                            'valid_from': now - timedelta(days=30),
                            'valid_to': now + timedelta(days=365),
                            'usage_limit': 1000,
                            'is_active': True
                        }
                    )

                if promo and promo.used_count < promo.usage_limit and subtotal >= Decimal(str(promo.min_order_value or 0)):
                    # Atomic update lượt dùng khuyến mãi với F('used_count') + 1 để chống race condition
                    promo_updated = Promotion.objects.filter(
                        id=promo.id,
                        used_count__lt=promo.usage_limit
                    ).update(used_count=F('used_count') + 1)

                    if promo_updated > 0:
                        promotion_obj = promo
                        if promo.discount_type == 'percentage':
                            calc_discount = (subtotal * Decimal(str(promo.discount_value))) / Decimal('100')
                            if promo.max_discount_amount:
                                calc_discount = min(calc_discount, Decimal(str(promo.max_discount_amount)))
                            discount_amount = calc_discount
                        else:
                            discount_amount = min(subtotal, Decimal(str(promo.discount_value)))
                elif data.get('discount_amount'):
                    try:
                        discount_amount = Decimal(str(data.get('discount_amount')))
                    except (ValueError, TypeError):
                        pass

            # 7. Xử lý Dịch vụ đi kèm (Add-on Services Upselling)
            selected_services = data.get('selected_services', [])
            services_to_create = []
            total_services_amount = Decimal('0')
            selected_services_summary = []

            if isinstance(selected_services, list) and len(selected_services) > 0:
                for item in selected_services:
                    if not isinstance(item, dict):
                        continue
                    svc_id = item.get('service_id') or item.get('id')
                    qty = item.get('quantity', 1)
                    try:
                        qty = int(qty)
                        if qty <= 0:
                            continue
                    except (ValueError, TypeError):
                        continue

                    # Truy vấn trực tiếp từ bảng ServiceItem trong DB để lấy đơn giá chuẩn
                    svc_obj = ServiceItem.objects.filter(id=svc_id, is_active=True).first()
                    if not svc_obj:
                        continue

                    unit_price = Decimal(str(svc_obj.price or 0))
                    item_total = unit_price * Decimal(str(qty))
                    total_services_amount += item_total

                    services_to_create.append({
                        'service': svc_obj,
                        'quantity': qty,
                        'unit_price': unit_price,
                        'total_price': item_total
                    })

            # 8. Tính tổng tiền thanh toán cuối cùng (Tiền phòng + Tiền dịch vụ - Giảm giá)
            room_net_amount = max(Decimal('0'), subtotal - membership_discount - discount_amount)
            grand_total_amount = room_net_amount + total_services_amount

            # 9. Tạo Đơn đặt phòng mới:
            # Khách hàng đặt phòng theo Hạng phòng (RoomCategory).
            # Số phòng thực tế (Room) để trống (None) để Lễ tân chọn và gán phòng trống khi làm thủ tục Check-in.
            booking = Booking.objects.create(
                guest=guest_user,
                customer_type=customer_type,
                company_name=company_name,
                company_tax_code=company_tax_code,
                company_address=company_address,
                category=category_instance,
                room=None,
                identity_card=identity_card,
                check_in_date=check_in,
                check_out_date=check_out,
                total_amount=grand_total_amount,
                membership_discount=membership_discount,
                applied_promotion=promotion_obj,
                status='pending',
                note=note
            )

            # 10. Tạo các bản ghi ServiceRequest và BookingExtraService gắn vào Booking
            now_dt = timezone.now()
            for s_info in services_to_create:
                svc = s_info['service']
                req = ServiceRequest.objects.create(
                    booking=booking,
                    service=svc,
                    quantity=s_info['quantity'],
                    unit_price=s_info['unit_price'],
                    total_price=s_info['total_price'],
                    status='pending',
                    note='Dịch vụ tiện ích đặt kèm khi đặt phòng (Add-on Upsell)',
                    request_time=now_dt
                )
                # Đồng bộ vào BookingExtraService cho hệ thống kế toán / PMS
                BookingExtraService.objects.create(
                    booking=booking,
                    service_name=f"{svc.name} [Đặt kèm]",
                    quantity=s_info['quantity'],
                    price=s_info['unit_price']
                )

                feat_img = ''
                if svc.image:
                    try:
                        feat_img = request.build_absolute_uri(svc.image.url)
                    except Exception:
                        feat_img = ''
                if not feat_img:
                    feat_img = svc.image_url or ''

                selected_services_summary.append({
                    'id': req.id,
                    'service_id': svc.id,
                    'service_name': svc.name,
                    'category_name': svc.category.name if svc.category else '',
                    'unit_price': float(s_info['unit_price']),
                    'quantity': s_info['quantity'],
                    'total_price': float(s_info['total_price']),
                    'image': feat_img
                })

            # 10.1 Khởi tạo Danh sách Khách lưu trú (BookingGuest) - TRẠM 2
            guests_data = data.get('guests', None)
            if guests_data and isinstance(guests_data, list) and len(guests_data) > 0:
                guests_to_create = []
                has_primary = False
                for idx, g in enumerate(guests_data):
                    if not isinstance(g, dict):
                        continue
                    g_name = (g.get('full_name') or '').strip()
                    if not g_name:
                        continue
                    is_p = bool(g.get('is_primary', idx == 0))
                    if is_p:
                        has_primary = True
                    dob = g.get('date_of_birth')
                    if not dob or str(dob).strip() == '':
                        dob = None
                    raw_id = (g.get('id_number') or g.get('identity_card') or '').strip()
                    if not raw_id and is_p:
                        raw_id = (identity_card or '').strip()
                    guests_to_create.append(BookingGuest(
                        booking=booking,
                        full_name=g_name,
                        id_type=g.get('id_type', 'CCCD'),
                        id_number=raw_id or None,
                        date_of_birth=dob,
                        gender=(g.get('gender') or '').strip() or 'Nam',
                        nationality=(g.get('nationality') or '').strip() or 'Việt Nam',
                        is_primary=is_p
                    ))
                if guests_to_create:
                    if not has_primary:
                        guests_to_create[0].is_primary = True
                    BookingGuest.objects.bulk_create(guests_to_create)
            else:
                primary_name = guest_name or (guest_user.get_full_name() if guest_user else 'Khách hàng')
                BookingGuest.objects.create(
                    booking=booking,
                    full_name=primary_name,
                    id_type='CCCD',
                    id_number=identity_card or None,
                    nationality='Việt Nam',
                    is_primary=True
                )

            # 10.2 Tự động khởi tạo Hóa đơn (Invoice) lưu trữ thông tin doanh nghiệp (VAT) - TRẠM 5
            is_corp_invoice = (customer_type == 'CORPORATE') or bool(company_name)
            Invoice.objects.update_or_create(
                booking=booking,
                defaults={
                    'room_charge': room_net_amount,
                    'service_charge': total_services_amount,
                    'total_amount': grand_total_amount,
                    'status': 'pending',
                    'is_company_invoice': is_corp_invoice,
                    'company_name': company_name,
                    'company_tax_code': company_tax_code,
                    'company_address': company_address,
                    'invoice_recipient_email': data.get('invoice_recipient_email') or guest_email or None
                }
            )

            # 11. Tạo bản ghi Payment ở trạng thái PENDING với tổng tiền cuối cùng (phục vụ thanh toán VietQR)
            Payment.objects.create(
                booking=booking,
                amount=grand_total_amount,
                payment_method='TRANSFER',
                payment_status='PENDING',
                transaction_id=f"TXN-{booking.booking_code}"
            )

            # Cập nhật số CCCD vào hồ sơ khách hàng nếu hồ sơ chưa có
            if guest_user:
                try:
                    profile, _ = GuestProfile.objects.get_or_create(user=guest_user)
                    if not profile.id_card_number:
                        profile.id_card_number = identity_card
                        profile.save(update_fields=['id_card_number'])
                except Exception:
                    pass

        # TRIGGER 1 - Khi tạo đơn đặt phòng thành công:
        # Tự động gửi email xác nhận đặt phòng ngay lập tức cho khách hàng
        recipient_target = guest_email or (guest_user.email if (guest_user and guest_user.email) else None)
        send_booking_email_async(
            booking=booking,
            email_type='booking_confirmation',
            custom_subject=f"[Khách Sạn TA Đà Nẵng] Xác nhận đặt phòng #{booking.booking_code} - Hướng dẫn thanh toán & Chi tiết đặt phòng",
            recipient_email=recipient_target
        )

        serializer = BookingSerializer(booking, context={'request': request})
        return Response({
            'success': True,
            'message': f'Chúc mừng quý khách đã đặt phòng thành công! Mã đơn: {booking.booking_code}',
            'booking_code': booking.booking_code,
            'booking': serializer.data,
            'selected_services': selected_services_summary,
            'summary': {
                'nights': nights,
                'room_price_per_night': float(price_per_night),
                'room_subtotal': float(subtotal),
                'membership_discount': float(membership_discount),
                'tier_name': tier_name,
                'tier_percent': float(tier_percent),
                'discount_amount': float(discount_amount),
                'room_total': float(room_net_amount),
                'services_total': float(total_services_amount),
                'services_count': len(selected_services_summary),
                'total_amount': float(grand_total_amount),
            }
        }, status=status.HTTP_201_CREATED)


    @action(detail=True, methods=['post'], url_path='resend-email', permission_classes=[IsAuthenticated])
    def resend_email(self, request, pk=None):
        """
        Trigger 3 - API Gửi lại Email thủ công cho Lễ tân / Nhân viên:
        Endpoint: POST /api/bookings/<id>/resend-email/
        Lễ tân có thể bấm gửi lại email xác nhận/biên lai cho khách bất cứ lúc nào.
        """
        booking = self.get_object()
        user = request.user

        # Phân quyền: Nhân viên nội bộ hoặc khách hàng sở hữu đơn
        is_staff_or_admin = (
            user.is_staff or 
            user.is_superuser or 
            getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'owner', 'staff', 'cashier'] or
            check_role_permission(user, 'bookings', 'update')
        )
        if not is_staff_or_admin and booking.guest != user:
            return Response({
                'success': False,
                'message': 'Bạn không có quyền gửi lại email cho đơn đặt phòng của khách hàng khác.'
            }, status=status.HTTP_403_FORBIDDEN)

        # Lấy địa chỉ email mục tiêu (ưu tiên email do lễ tân nhập mới trong request.data)
        custom_email = (request.data.get('email') or '').strip()
        target_email = custom_email or (booking.guest.email if booking.guest else None)
        if not target_email and hasattr(booking, 'invoice') and booking.invoice:
            target_email = booking.invoice.invoice_recipient_email

        if not target_email:
            return Response({
                'success': False,
                'message': 'Đơn đặt phòng này chưa có địa chỉ email nhận thư. Vui lòng nhập địa chỉ email vào ô thông tin để gửi lại.'
            }, status=status.HTTP_400_BAD_REQUEST)

        import re
        if not re.match(r"[^@]+@[^@]+\.[^@]+", target_email):
            return Response({
                'success': False,
                'message': f'Địa chỉ email "{target_email}" không đúng định dạng.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Nhận diện trạng thái đơn để thiết lập tiêu đề phù hợp
        is_paid = (
            booking.status in ['paid', 'PAID', 'checked_in', 'checked_out', 'completed'] or
            (hasattr(booking, 'invoice') and booking.invoice and booking.invoice.status == 'paid') or
            (hasattr(booking, 'payments') and booking.payments.filter(payment_status='COMPLETED').exists())
        )

        if is_paid:
            subject = f"[Khách Sạn TA Đà Nẵng] Xác nhận ĐÃ THANH TOÁN THÀNH CÔNG - Đơn #{booking.booking_code}"
            email_type = 'payment_success'
        else:
            subject = f"[Khách Sạn TA Đà Nẵng] Xác nhận đặt phòng #{booking.booking_code} - Trạng thái thanh toán"
            email_type = 'booking_confirmation'

        # Gửi email chạy ngầm
        send_booking_email_async(
            booking=booking,
            email_type=email_type,
            custom_subject=subject,
            recipient_email=target_email
        )

        log_action(
            user=user,
            action='UPDATE',
            module='BOOKING',
            description=f"Lễ tân {user.username} gửi lại email biên lai cho đơn #{booking.booking_code} tới {target_email}",
            request=request
        )

        return Response({
            'success': True,
            'message': f'Hệ thống đang tiến hành gửi email xác nhận cho đơn #{booking.booking_code} tới {target_email}.',
            'booking_code': booking.booking_code,
            'recipient_email': target_email,
            'is_paid': is_paid
        }, status=status.HTTP_200_OK)


    @action(detail=False, methods=['post'], url_path='cancel-booking', permission_classes=[AllowAny])
    def cancel_booking(self, request):
        """
        API POST /api/bookings/cancel-booking/
        Hủy đơn đặt phòng linh hoạt theo booking_id hoặc booking_code.
        Bảo mật chống BOLA / IDOR:
        - Quản trị viên / Lễ tân: Có quyền hủy mọi đơn.
        - Khách hàng đã đăng nhập: CHỈ được phép hủy đơn của chính mình.
        - Khách chưa đăng nhập: CHỈ được hủy đơn đang ở trạng thái 'pending' (chưa thanh toán) và phải xác thực thông tin.
        """
        booking_identifier = request.data.get('booking_id') or request.data.get('id') or request.data.get('booking_code')
        reason = request.data.get('reason', 'Khách hàng hủy tại bước quét mã VietQR').strip()

        if not booking_identifier:
            return Response({'success': False, 'message': 'Vui lòng cung cấp mã đơn đặt phòng.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if str(booking_identifier).isdigit():
                booking = Booking.objects.get(id=int(booking_identifier))
            else:
                booking = Booking.objects.get(booking_code=str(booking_identifier))
        except Booking.DoesNotExist:
            return Response({'success': False, 'message': f'Không tìm thấy đơn đặt phòng "{booking_identifier}".'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        is_authenticated = user and user.is_authenticated
        user_role = getattr(user, 'role', '') if is_authenticated else ''
        is_staff_or_admin = is_authenticated and (user.is_superuser or check_role_permission(user, 'bookings', 'update'))

        # Phân quyền bảo mật chống IDOR:
        if not is_staff_or_admin:
            if is_authenticated:
                if booking.guest != user:
                    return Response({
                        'success': False,
                        'message': 'Bạn không có quyền hủy đơn đặt phòng của khách hàng khác.'
                    }, status=status.HTTP_403_FORBIDDEN)
            else:
                # Khách chưa đăng nhập: Tuyệt đối không được hủy đơn đã thanh toán hoặc đã duyệt
                if booking.status not in ['pending']:
                    return Response({
                        'success': False,
                        'message': f'Đơn đặt phòng đang ở trạng thái "{booking.get_status_display()}". Vui lòng đăng nhập hoặc liên hệ trực tiếp Lễ tân để được hỗ trợ hủy đơn.'
                    }, status=status.HTTP_403_FORBIDDEN)

                # Xác thực mã booking_code hoặc số CCCD
                provided_code = str(request.data.get('booking_code', '')).strip().upper()
                provided_id = str(request.data.get('identity_card', '')).strip()
                code_matches = provided_code and provided_code == booking.booking_code.upper()
                id_matches = provided_id and booking.identity_card and provided_id == booking.identity_card
                if not (code_matches or id_matches):
                    return Response({
                        'success': False,
                        'message': 'Xác thực không thành công. Vui lòng cung cấp đúng mã đơn (booking_code) hoặc số CCCD khi đặt phòng.'
                    }, status=status.HTTP_403_FORBIDDEN)

        if booking.status not in ['pending', 'confirmed', 'paid', 'PAID']:
            return Response({'success': False, 'message': f'Đơn đặt phòng đang ở trạng thái "{booking.get_status_display()}", không thể hủy.'}, status=status.HTTP_400_BAD_REQUEST)

        booking.status = 'cancelled'
        now_str = timezone.now().strftime('%d/%m/%Y %H:%M')
        acting_name = user.get_full_name() or user.username if is_authenticated else "Khách vãng lai"
        booking.note = f"{booking.note or ''}\n[Hủy bởi {acting_name} lúc {now_str}]: {reason}".strip()
        booking.save(update_fields=['status', 'note', 'updated_at'])

        if booking.room and booking.room.status == 'occupied':
            booking.room.status = 'available'
            booking.room.save(update_fields=['status'])

        # Hủy các ServiceRequest đang chờ của phòng này (nếu có)
        try:
            from ...services.models import ServiceRequest
            ServiceRequest.objects.filter(booking=booking, status__in=['pending', 'in_progress']).update(status='cancelled')
        except Exception:
            pass

        # Nếu phòng này thuộc một Đơn Đặt Đoàn (GroupBooking), tự động đồng bộ lại đoàn
        if booking.group_booking:
            group = booking.group_booking
            active_subs = group.sub_bookings.exclude(status='cancelled')
            if not active_subs.exists():
                group.status = 'cancelled'
                group.note = f"{group.note or ''}\n[Toàn bộ phòng trong đoàn đã hủy lúc {now_str}]".strip()
                group.save(update_fields=['status', 'note', 'updated_at'])
            else:
                new_total = sum(Decimal(str(b.grand_total_amount or b.total_amount or 0)) for b in active_subs)
                group.total_amount = new_total
                group.save(update_fields=['total_amount', 'updated_at'])

        # Ghi nhận Nhật ký thao tác hệ thống (Audit Log)
        log_action(
            user=user if is_authenticated else None,
            action='DELETE',
            module='BOOKING',
            description=f"Hủy đơn đặt phòng #{booking.booking_code}. Lý do: {reason}",
            request=request
        )

        return Response({
            'success': True,
            'message': f'Đơn đặt phòng {booking.booking_code} đã được hủy thành công.',
            'booking_code': booking.booking_code,
            'status': 'cancelled'
        }, status=status.HTTP_200_OK)


    def partial_update(self, request, *args, **kwargs):
        """
        API cập nhật đơn đặt phòng (PATCH /api/bookings/<id>/):
        - Khách hàng: Cho phép hủy đơn (chuyển status='cancelled') nếu đơn đang ở trạng thái 'pending'.
        - Nhân viên / Quản trị: Có quyền cập nhật trạng thái (status), ghi chú nội bộ (internal_note) và thông tin nghiệp vụ.
        """
        booking = self.get_object()
        user = request.user
        user_role = getattr(user, 'role', '')
        is_guest = not user.is_authenticated or user_role == 'guest'
        has_update_permission = user.is_superuser or check_role_permission(user, 'bookings', 'update')

        new_status = request.data.get('status')

        # Nhân viên nội bộ nếu không có quyền Cập nhật (update) trong ma trận quyền
        if not is_guest and not has_update_permission:
            return Response({
                'success': False,
                'message': 'Bạn không có quyền chỉnh sửa đơn đặt phòng (Yêu cầu quyền Cập nhật đơn đặt phòng).'
            }, status=status.HTTP_403_FORBIDDEN)

        # Xử lý trường hợp tài khoản là khách hàng
        if is_guest:
            if new_status == 'cancelled':
                if booking.status not in ['pending', 'paid', 'PAID']:
                    return Response({
                        'success': False,
                        'message': 'Đơn đặt phòng chỉ có thể hủy khi đang ở trạng thái Chờ duyệt (Pending).'
                    }, status=status.HTTP_400_BAD_REQUEST)

                booking.status = 'cancelled'
                cancel_reason = request.data.get('cancel_reason', 'Khách hàng yêu cầu hủy đặt phòng').strip()
                if cancel_reason:
                    now_str = timezone.now().strftime('%d/%m/%Y %H:%M')
                    booking.note = f"{booking.note or ''}\n[Khách hủy {now_str}]: {cancel_reason}".strip()
                booking.save(update_fields=['status', 'note', 'updated_at'])

                if booking.room and booking.room.status == 'occupied':
                    booking.room.status = 'available'
                    booking.room.save(update_fields=['status'])

                serializer = self.get_serializer(booking, context={'request': request})
                return Response({
                    'success': True,
                    'message': f'Đơn đặt phòng {booking.booking_code} đã được hủy thành công.',
                    'booking': serializer.data,
                    **serializer.data
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'success': False,
                    'message': 'Khách hàng chỉ có quyền thực hiện thao tác hủy đơn đặt phòng đang chờ duyệt.'
                }, status=status.HTTP_403_FORBIDDEN)

        # Quản trị viên / Lễ tân / Nhân viên thực hiện cập nhật nghiệp vụ
        update_fields = ['updated_at']

        if new_status:
            valid_statuses = [choice[0] for choice in Booking.STATUS_CHOICES]
            if new_status not in valid_statuses:
                return Response({
                    'success': False,
                    'message': f'Trạng thái "{new_status}" không hợp lệ. Cho phép: {", ".join(valid_statuses)}'
                }, status=status.HTTP_400_BAD_REQUEST)
            booking.status = new_status
            update_fields.append('status')

        if 'internal_note' in request.data:
            booking.internal_note = request.data.get('internal_note', '').strip()
            update_fields.append('internal_note')

        if 'note' in request.data:
            booking.note = request.data.get('note', '').strip()
            update_fields.append('note')

        if 'identity_card' in request.data:
            booking.identity_card = request.data.get('identity_card', '').strip()
            update_fields.append('identity_card')

        # Lưu thay đổi trực tiếp vào Database
        booking.save(update_fields=list(set(update_fields)))
        booking.refresh_from_db()

        # Đồng bộ trạng thái phòng thực tế (Room Board PMS)
        if booking.room:
            if booking.status == 'checked_in' and booking.room.status != 'occupied':
                booking.room.status = 'occupied'
                booking.room.save(update_fields=['status'])
            elif booking.status == 'checked_out' and booking.room.status == 'occupied':
                booking.room.status = 'cleaning'
                booking.room.save(update_fields=['status'])
            elif booking.status in ['cancelled', 'no_show'] and booking.room.status == 'occupied':
                booking.room.status = 'available'
                booking.room.save(update_fields=['status'])

        # Ghi nhận Nhật ký thao tác hệ thống (Audit Log)
        log_action(
            user=user if user.is_authenticated else None,
            action='UPDATE',
            module='BOOKING',
            description=f"Cập nhật đơn đặt phòng #{booking.booking_code}" + (f" sang trạng thái {booking.get_status_display()}" if new_status else ""),
            request=request
        )

        serializer = self.get_serializer(booking, context={'request': request})
        return Response({
            'success': True,
            'message': f'Cập nhật đơn đặt phòng {booking.booking_code} thành công.',
            'booking': serializer.data,
            **serializer.data
        }, status=status.HTTP_200_OK)


    def update(self, request, *args, **kwargs):
        return self.partial_update(request, *args, **kwargs)


    def destroy(self, request, *args, **kwargs):
        user = request.user
        if not (user.is_superuser or check_role_permission(user, 'bookings', 'delete')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền xóa đơn đặt phòng (Yêu cầu quyền Xóa đơn đặt phòng).'
            }, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)
