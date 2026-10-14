import uuid
from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.decorators import action
from django.utils import timezone
from datetime import datetime, timedelta
from django.db.models import Q, F
from django.db import transaction
from .models import Booking, Promotion, BookingExtraService, BookingGuest
from ..rooms.models import Room, RoomCategory
from ..users.models import User, GuestProfile, log_action
from ..users.views import check_role_permission
from ..services.models import ServiceItem, ServiceRequest
from ..payments.models import Invoice, Payment
from ..notifications.models import Notification
from ..notifications.signals import get_staff_and_admin_users
from .serializers import BookingSerializer, PromotionSerializer
from core_project.pagination import StandardResultsSetPagination


class BookingViewSet(viewsets.ModelViewSet):
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
        ).prefetch_related(
            'extra_services', 'service_requests', 'service_requests__service'
        ).all().order_by('-created_at')

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

    @action(detail=True, methods=['get'], url_path='available-rooms')
    def available_rooms(self, request, pk=None):
        """
        API lấy danh sách các phòng thực tế (Room) đang 'available' (Sẵn sàng)
        thuộc đúng Hạng phòng mà khách đã đặt để Lễ tân chọn trong Modal Check-in.
        """
        booking = self.get_object()
        category = booking.category or (booking.room.category if booking.room else None)
        param_cat = request.query_params.get('category_id')
        if param_cat and str(param_cat).isdigit():
            category_id = int(param_cat)
        else:
            category_id = category.id if category else None

        available_rooms_qs = Room.objects.filter(status='available').select_related('category')
        all_categories = request.query_params.get('all_categories', 'false').lower() in ['true', '1', 'yes']
        if category_id and not all_categories:
            available_rooms_qs = available_rooms_qs.filter(category_id=category_id)

        from ..rooms.serializers import RoomSerializer
        serializer = RoomSerializer(available_rooms_qs.order_by('floor', 'room_number'), many=True)

        cat_display = 'Tất cả các hạng phòng' if all_categories else (category.name if category else 'Phòng tiêu chuẩn')
        return Response({
            'success': True,
            'count': available_rooms_qs.count(),
            'category_id': None if all_categories else category_id,
            'category_name': cat_display,
            'rooms': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='check-in')
    def check_in(self, request, pk=None):
        """
        API thực hiện thủ tục Check-in (Nhận phòng) cho khách hàng:
        - POST /api/bookings/<id>/check-in/
        - Payload: { "room_id": 101, "internal_note": "Ghi chú lễ tân..." }
        - Transaction đồng thời:
          1. Cập nhật bảng Booking: Gán room_id, đổi status='checked_in', actual_check_in = timezone.now()
          2. Cập nhật bảng Room tương ứng: đổi status='occupied' (Đang có khách)
        """
        booking = self.get_object()
        user = request.user

        # 1. Kiểm tra phân quyền theo ma trận quyền (Yêu cầu quyền bookings.update)
        if not (user.is_superuser or check_role_permission(user, 'bookings', 'update')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền thực hiện thủ tục Check-in nhận phòng (Yêu cầu quyền Cập nhật đơn đặt phòng).'
            }, status=status.HTTP_403_FORBIDDEN)

        # 2. Kiểm tra trạng thái hợp lệ của đơn đặt phòng
        if booking.status == 'checked_in':
            actual_str = timezone.localtime(booking.actual_check_in).strftime('%H:%M %d/%m/%Y') if booking.actual_check_in else ''
            return Response({
                'success': False,
                'message': f'Đơn đặt phòng {booking.booking_code} đã hoàn tất Check-in trước đó ({actual_str}). Không thể Check-in lại.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if booking.status == 'checked_out':
            return Response({
                'success': False,
                'message': f'Đơn đặt phòng {booking.booking_code} đã hoàn tất trả phòng (Checked-out), không thể Check-in.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if booking.status == 'cancelled':
            return Response({
                'success': False,
                'message': f'Đơn đặt phòng {booking.booking_code} đã bị hủy bỏ, không thể thực hiện nhận phòng.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if booking.status == 'no_show':
            return Response({
                'success': False,
                'message': f'Đơn đặt phòng {booking.booking_code} đã được đánh dấu là Khách không đến (No-Show). Vui lòng chuyển trạng thái đơn sang "Đã xác nhận" nếu khách muốn nhận phòng.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 2.2 Kiểm tra ngày lưu trú: Đã quá ngày Check-out (Hết hạn lưu trú)
        today = timezone.localdate()
        now = timezone.now()

        if today >= booking.check_out_date:
            return Response({
                'success': False,
                'code': 'BOOKING_EXPIRED_NO_SHOW',
                'check_out_date': booking.check_out_date.strftime('%d/%m/%Y'),
                'message': f'Đơn đặt phòng {booking.booking_code} đã quá hạn lưu trú (ngày trả phòng dự kiến là {booking.check_out_date.strftime("%d/%m/%Y")}). Không thể thực hiện Check-in. Vui lòng chuyển trạng thái đơn sang Khách không đến (No-Show) hoặc tạo đơn mới cho khách.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Lấy và kiểm tra ID phòng thực tế cần gán
        room_id = request.data.get('room_id') or request.data.get('room')
        if not room_id:
            return Response({
                'success': False,
                'message': 'Vui lòng chọn phòng thực tế cụ thể để bàn giao cho khách lưu trú.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_room = Room.objects.select_related('category').get(pk=int(room_id))
        except (Room.DoesNotExist, ValueError):
            return Response({
                'success': False,
                'message': f'Không tìm thấy thông tin phòng thực tế với mã ID {room_id}.'
            }, status=status.HTTP_404_NOT_FOUND)

        # 4. Kiểm tra trạng thái phòng: Bắt buộc phải là available (Sẵn sàng)
        if target_room.status != 'available':
            status_display = target_room.get_status_display()
            return Response({
                'success': False,
                'message': f'Phòng {target_room.room_number} hiện không ở trạng thái sẵn sàng đón khách (Hiện tại: "{status_display}"). Vui lòng chọn phòng đang trống khác.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 4.1 Kiểm tra xung đột lịch: Phòng này có bị trùng với bất kỳ đơn nào khác từ hôm nay đến ngày check-out không
        stay_end_date = booking.check_out_date
        conflict_booking = Booking.objects.filter(
            room=target_room,
            status__in=['confirmed', 'checked_in']
        ).exclude(id=booking.id).filter(
            check_in_date__lt=stay_end_date,
            check_out_date__gt=today
        ).first()

        if conflict_booking:
            return Response({
                'success': False,
                'message': f'Không thể gán phòng {target_room.room_number}. Phòng này đã có khách (#{conflict_booking.booking_code}) đặt trước trong khoảng thời gian {conflict_booking.check_in_date.strftime("%d/%m/%Y")} - {conflict_booking.check_out_date.strftime("%d/%m/%Y")}. Vui lòng chọn phòng trống khác.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 5. Kiểm tra hạng phòng tương ứng
        booking_category_id = booking.category_id or (booking.room.category_id if booking.room else None)
        booking_cat_name = booking.category.name if booking.category else (booking.room.category.name if booking.room and booking.room.category else 'Khác')

        if booking_category_id and target_room.category_id != booking_category_id:
            target_cat_name = target_room.category.name if target_room.category else 'Khác'
            allow_upgrade = request.data.get('allow_upgrade', False)
            if not allow_upgrade:
                return Response({
                    'success': False,
                    'message': f'Phòng {target_room.room_number} thuộc hạng "{target_cat_name}", khác với hạng phòng khách đặt ("{booking_cat_name}"). Vui lòng chọn đúng phòng hoặc xác nhận nâng hạng phòng.'
                }, status=status.HTTP_400_BAD_REQUEST)

        # 5.1 Kiểm tra Nhận phòng sớm (Early Check-in) & Nhận phòng trễ (Late Check-in)
        old_check_in_date = booking.check_in_date
        early_days = 0
        late_days = 0
        additional_amount = 0.0
        is_early_check_in = False
        is_late_check_in = False
        daily_rate = 0.0

        if old_check_in_date > today:
            # Sớm hơn ngày đặt ban đầu
            early_days = (old_check_in_date - today).days
            is_early_check_in = True

            # Tính đơn giá 1 ngày cho hạng phòng
            if target_room.category and target_room.category.promo_price:
                daily_rate = float(target_room.category.promo_price)
            elif target_room.category and target_room.category.base_price:
                daily_rate = float(target_room.category.base_price)
            elif booking.category and booking.category.base_price:
                daily_rate = float(booking.category.base_price)
            elif booking.total_amount:
                nights = max(1, (booking.check_out_date - booking.check_in_date).days)
                daily_rate = float(booking.total_amount) / nights

            # Kiểm tra xem lễ tân đã xác nhận Early Check-in chưa
            confirm_early = request.data.get('confirm_early_check_in', False) or request.data.get('is_early_check_in', False)
            if not confirm_early:
                est_charge = daily_rate * early_days
                return Response({
                    'success': False,
                    'require_confirmation': True,
                    'code': 'EARLY_CHECKIN_CONFIRMATION_REQUIRED',
                    'early_days': early_days,
                    'scheduled_check_in': old_check_in_date.strftime('%d/%m/%Y'),
                    'actual_check_in_date': today.strftime('%d/%m/%Y'),
                    'daily_rate': daily_rate,
                    'estimated_additional_charge': est_charge,
                    'message': f'Khách đến sớm {early_days} ngày so với ngày nhận phòng dự kiến ({old_check_in_date.strftime("%d/%m/%Y")}). Vui lòng xác nhận cho phép Nhận phòng sớm (Early Check-in).'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Kiểm tra xung đột lịch: Từ today đến old_check_in_date, phòng này có ai đặt trước không
            conflict_booking = Booking.objects.filter(
                room=target_room,
                status__in=['confirmed', 'checked_in']
            ).exclude(id=booking.id).filter(
                check_in_date__lt=old_check_in_date,
                check_out_date__gt=today
            ).first()

            if conflict_booking:
                return Response({
                    'success': False,
                    'message': f'Không thể Check-in sớm vào phòng {target_room.room_number}. Phòng này đã có khách ({conflict_booking.booking_code}) đặt trước trong khoảng thời gian {conflict_booking.check_in_date.strftime("%d/%m/%Y")} - {conflict_booking.check_out_date.strftime("%d/%m/%Y")}. Vui lòng chọn phòng trống khác.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Tính phụ thu tiền phòng nếu apply_early_charge=True (mặc định True)
            apply_charge = request.data.get('apply_early_charge', True)
            if str(apply_charge).lower() in ['true', '1', 'yes']:
                additional_amount = float(daily_rate * early_days)

        elif old_check_in_date < today:
            # Khách đến trễ hơn ngày đặt ban đầu (nhưng trước check_out_date)
            is_late_check_in = True
            late_days = (today - old_check_in_date).days
            confirm_late = request.data.get('confirm_late_check_in', False)
            if not confirm_late:
                remaining_nights = max(1, (booking.check_out_date - today).days)
                return Response({
                    'success': False,
                    'require_confirmation': True,
                    'code': 'LATE_CHECKIN_CONFIRMATION_REQUIRED',
                    'late_days': late_days,
                    'scheduled_check_in': old_check_in_date.strftime('%d/%m/%Y'),
                    'check_out_date': booking.check_out_date.strftime('%d/%m/%Y'),
                    'actual_check_in_date': today.strftime('%d/%m/%Y'),
                    'remaining_nights': remaining_nights,
                    'message': f'Khách đến trễ {late_days} ngày so với ngày nhận phòng ban đầu ({old_check_in_date.strftime("%d/%m/%Y")}). Vui lòng xác nhận thực hiện Check-in trễ cho khách lưu trú {remaining_nights} đêm còn lại đến {booking.check_out_date.strftime("%d/%m/%Y")}.'
                }, status=status.HTTP_400_BAD_REQUEST)

        # 6. THỰC HIỆN ĐỒNG THỜI DÙNG TRANSACTION.ATOMIC VÀ PESSIMISTIC LOCKING ĐẢM BẢO AN TOÀN DỮ LIỆU
        with transaction.atomic():
            # Khóa bi quan Booking để chống spam double check-in
            booking = Booking.objects.select_for_update().get(pk=booking.pk)
            if booking.status == 'checked_in':
                return Response({
                    'success': False,
                    'message': f'Đơn đặt phòng {booking.booking_code} đã hoàn tất Check-in trước đó. Không thể Check-in lại.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Khóa bi quan target_room và kiểm tra trạng thái khả dụng tức thời
            target_room = Room.objects.select_for_update().get(pk=target_room.pk)
            if target_room.status != 'available':
                return Response({
                    'success': False,
                    'message': f'Phòng {target_room.room_number} hiện không ở trạng thái sẵn sàng (vừa được gán cho đơn khác hoặc chuyển bảo trì).'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Nếu đơn đặt phòng trước đó có phòng cũ đang bị occupied, giải phóng phòng cũ về available
            old_room = booking.room
            if old_room and old_room.id != target_room.id and old_room.status == 'occupied':
                old_room.status = 'available'
                old_room.save(update_fields=['status'])

            # Việc 1: Cập nhật bảng Booking (gán room_id, status='checked_in', actual_check_in=now)
            booking.room = target_room
            booking.status = 'checked_in'
            booking.actual_check_in = now

            update_fields = ['room', 'status', 'actual_check_in', 'internal_note', 'updated_at']

            receptionist_note = request.data.get('internal_note', '').strip()
            time_str = now.strftime('%H:%M • %d/%m/%Y')
            receptionist_name = user.get_full_name() or user.username

            early_log = ""
            late_log = ""
            if is_early_check_in:
                booking.check_in_date = today
                update_fields.append('check_in_date')
                if additional_amount > 0:
                    booking.total_amount = float(booking.total_amount or 0) + additional_amount
                    update_fields.append('total_amount')
                    early_log = f"[Early Check-in sớm {early_days} ngày lúc {time_str} bởi {receptionist_name}]: Nhận phòng sớm từ ngày {today.strftime('%d/%m/%Y')} (lịch cũ {old_check_in_date.strftime('%d/%m/%Y')}). Phụ thu tiền phòng: +{additional_amount:,.0f} VND ({early_days} đêm x {daily_rate:,.0f}đ)."
                else:
                    early_log = f"[Early Check-in sớm {early_days} ngày lúc {time_str} bởi {receptionist_name}]: Nhận phòng sớm từ ngày {today.strftime('%d/%m/%Y')} (lịch cũ {old_check_in_date.strftime('%d/%m/%Y')}) - Miễn phí phụ thu."
            elif is_late_check_in:
                remaining_nights = max(1, (booking.check_out_date - today).days)
                late_log = f"[Late Check-in trễ {late_days} ngày lúc {time_str} bởi {receptionist_name}]: Khách đến nhận phòng trễ {late_days} ngày (lịch ban đầu: {old_check_in_date.strftime('%d/%m/%Y')}). Nhận phòng ở {remaining_nights} đêm còn lại đến {booking.check_out_date.strftime('%d/%m/%Y')}."

            auto_log = f"[Check-in lúc {time_str} bởi {receptionist_name}]: Nhận phòng {target_room.room_number}."
            if early_log:
                auto_log = f"{early_log}\n{auto_log}"
            if late_log:
                auto_log = f"{late_log}\n{auto_log}"
            if receptionist_note:
                auto_log += f" Ghi chú: {receptionist_note}"

            if booking.internal_note:
                booking.internal_note = f"{booking.internal_note}\n{auto_log}".strip()
            else:
                booking.internal_note = auto_log

            booking.save(update_fields=update_fields)

            # Việc 2: Cập nhật bảng Room tương ứng sang occupied (Đang có khách)
            target_room.status = 'occupied'
            target_room.save(update_fields=['status'])

            # Việc 3: Khai báo lưu trú - Lưu danh sách khách ở cùng phòng (BookingGuest)
            guests_data = request.data.get('guests', None)
            saved_guests_count = 0
            if guests_data is not None and isinstance(guests_data, list):
                # Xóa danh sách khách cũ của booking này (nếu có) và lưu mới
                BookingGuest.objects.filter(booking=booking).delete()
                guests_to_create = []
                for g in guests_data:
                    full_name = (g.get('full_name') or '').strip()
                    if not full_name:
                        continue
                    dob_val = g.get('date_of_birth')
                    if not dob_val or str(dob_val).strip() == '':
                        dob_val = None
                    guests_to_create.append(BookingGuest(
                        booking=booking,
                        full_name=full_name,
                        id_type=g.get('id_type', 'CCCD'),
                        id_number=(g.get('id_number') or '').strip() or None,
                        date_of_birth=dob_val,
                        gender=(g.get('gender') or '').strip() or None,
                        nationality=(g.get('nationality') or '').strip() or 'Việt Nam',
                        is_primary=bool(g.get('is_primary', False))
                    ))
                if guests_to_create:
                    BookingGuest.objects.bulk_create(guests_to_create)
                    saved_guests_count = len(guests_to_create)
                    # Cập nhật số CCCD của booking nếu người đại diện có CCCD
                    primary_guest = next((g for g in guests_to_create if g.is_primary and g.id_number), None)
                    if primary_guest and primary_guest.id_number and booking.identity_card != primary_guest.id_number:
                        booking.identity_card = primary_guest.id_number
                        booking.save(update_fields=['identity_card'])
            elif not booking.guests.exists() and booking.guest:
                # Nếu không gửi mảng guests và chưa có khai báo nào, tự động tạo 1 guest đại diện từ GuestProfile
                primary_name = booking.guest.get_full_name() or booking.guest.username
                profile = getattr(booking.guest, 'guest_profile', None)
                BookingGuest.objects.create(
                    booking=booking,
                    full_name=primary_name,
                    id_type=(profile.id_type if profile and profile.id_type else 'CCCD'),
                    id_number=(profile.id_card_number if profile and profile.id_card_number else booking.identity_card) or None,
                    date_of_birth=(profile.date_of_birth if profile else None),
                    gender=(profile.gender if profile and profile.gender else 'Nam'),
                    nationality=(profile.nationality if profile and profile.nationality else 'Việt Nam'),
                    is_primary=True
                )
                saved_guests_count = 1
            else:
                saved_guests_count = booking.guests.count()

        # Lấy thông tin serialize đầy đủ
        serializer = self.get_serializer(booking, context={'request': request})
        from ..rooms.serializers import RoomSerializer
        room_data = RoomSerializer(target_room).data

        guest_display = booking.guest.get_full_name() or booking.guest.username if booking.guest else "Khách hàng"

        # Ghi nhận Nhật ký thao tác hệ thống (Audit Log)
        guest_log_suffix = f" (Khai báo lưu trú: {saved_guests_count} khách)" if saved_guests_count > 0 else ""
        log_action(
            user=request.user,
            action='UPDATE',
            module='BOOKING',
            description=f"Thực hiện Check-in đơn #{booking.booking_code} cho khách {guest_display} vào phòng {target_room.room_number}{guest_log_suffix}",
            request=request
        )

        success_message = f'Hoàn tất thủ tục Check-in thành công cho khách {guest_display}! Đã gán phòng {target_room.room_number} (Tầng {target_room.floor}).'
        if is_early_check_in:
            if additional_amount > 0:
                success_message = f'⚡ Hoàn tất Nhận Phòng Sớm ({early_days} ngày) cho khách {guest_display}! Đã cập nhật ngày nhận sang {today.strftime("%d/%m/%Y")}, cộng thêm {additional_amount:,.0f}đ tiền phòng và gán phòng {target_room.room_number}.'
            else:
                success_message = f'⚡ Hoàn tất Nhận Phòng Sớm ({early_days} ngày) cho khách {guest_display}! Đã cập nhật ngày nhận sang {today.strftime("%d/%m/%Y")} (Miễn phụ thu) và gán phòng {target_room.room_number}.'
        elif is_late_check_in:
            remaining_nights = max(1, (booking.check_out_date - today).days)
            success_message = f'⏰ Hoàn tất Check-in muộn (trễ {late_days} ngày) cho khách {guest_display}! Khách nhận phòng {target_room.room_number} ở {remaining_nights} đêm còn lại đến {booking.check_out_date.strftime("%d/%m/%Y")}.'

        return Response({
            'success': True,
            'message': success_message,
            'is_early_check_in': is_early_check_in,
            'early_days': early_days,
            'is_late_check_in': is_late_check_in,
            'late_days': late_days,
            'additional_amount': additional_amount,
            'booking': serializer.data,
            'room': room_data,
            **serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='staying-guests')
    def staying_guests(self, request):
        """
        API trả về danh sách toàn bộ khách hàng (BookingGuest) của các đơn đặt phòng
        đang có trạng thái 'checked_in' (đang lưu trú thực tế tại khách sạn).
        Phục vụ việc xuất báo cáo khai báo tạm trú nộp Công an phường.
        - GET /api/bookings/staying-guests/
        """
        user = request.user
        user_role = getattr(user, 'role', '')
        if not (user.is_superuser or user.is_staff or user_role in ['admin', 'owner', 'manager', 'receptionist', 'staff', 'cashier']):
            return Response({
                'success': False,
                'message': 'Chỉ nhân viên lễ tân hoặc cấp quản lý mới có quyền xem và xuất danh sách khách lưu trú.'
            }, status=status.HTTP_403_FORBIDDEN)

        # Lấy tất cả các đơn đặt phòng đang lưu trú (status='checked_in')
        active_bookings = Booking.objects.filter(
            status='checked_in'
        ).select_related(
            'room', 'room__category', 'category', 'guest'
        ).prefetch_related('guests').order_by('room__room_number', '-actual_check_in')

        results = []
        for booking in active_bookings:
            room_num = booking.room.room_number if booking.room else 'Chưa gán'
            room_name = (
                booking.category.name if booking.category
                else (booking.room.category.name if (booking.room and booking.room.category) else 'Tiêu chuẩn')
            )
            check_in_str = (
                timezone.localtime(booking.actual_check_in).strftime('%H:%M %d/%m/%Y')
                if booking.actual_check_in
                else (booking.check_in_date.strftime('%d/%m/%Y') if booking.check_in_date else '')
            )
            check_out_str = booking.check_out_date.strftime('%d/%m/%Y') if booking.check_out_date else ''
            guest_phone = getattr(booking.guest, 'phone_number', '') or ''

            booking_guests = list(booking.guests.all())
            if booking_guests:
                for bg in booking_guests:
                    results.append({
                        'id': bg.id,
                        'booking_id': booking.id,
                        'booking_code': booking.booking_code,
                        'room_number': room_num,
                        'room_name': room_name,
                        'full_name': bg.full_name,
                        'id_type': bg.id_type,
                        'id_type_display': bg.get_id_type_display() if hasattr(bg, 'get_id_type_display') else bg.id_type,
                        'id_number': bg.id_number or '',
                        'date_of_birth': bg.date_of_birth.strftime('%d/%m/%Y') if bg.date_of_birth else '',
                        'gender': bg.gender or '',
                        'nationality': bg.nationality or 'Việt Nam',
                        'is_primary': bg.is_primary,
                        'check_in_date': booking.check_in_date.strftime('%d/%m/%Y') if booking.check_in_date else '',
                        'actual_check_in': check_in_str,
                        'check_out_date': check_out_str,
                        'guest_phone': guest_phone
                    })
            else:
                # Fallback an toàn cho đơn check-in cũ chưa có bản ghi BookingGuest
                primary_name = (
                    booking.guest.get_full_name().strip()
                    if (booking.guest and booking.guest.get_full_name())
                    else (booking.guest.username if booking.guest else 'Khách lưu trú')
                )
                results.append({
                    'id': f"bkg_{booking.id}",
                    'booking_id': booking.id,
                    'booking_code': booking.booking_code,
                    'room_number': room_num,
                    'room_name': room_name,
                    'full_name': primary_name,
                    'id_type': 'CCCD',
                    'id_type_display': 'Căn cước công dân / CMND',
                    'id_number': booking.identity_card or '',
                    'date_of_birth': '',
                    'gender': '',
                    'nationality': 'Việt Nam',
                    'is_primary': True,
                    'check_in_date': booking.check_in_date.strftime('%d/%m/%Y') if booking.check_in_date else '',
                    'actual_check_in': check_in_str,
                    'check_out_date': check_out_str,
                    'guest_phone': guest_phone
                })

        unique_rooms = set(g['room_number'] for g in results if g['room_number'] != 'Chưa gán')

        return Response({
            'success': True,
            'total_guests': len(results),
            'total_rooms': len(unique_rooms),
            'data': results
        }, status=status.HTTP_200_OK)


    @action(detail=True, methods=['post'], url_path='change-room')
    def change_room(self, request, pk=None):
        """
        API Đổi phòng (Room Move) cho khách đang lưu trú (status='checked_in'):
        - POST /api/bookings/<id>/change-room/
        - Payload:
            {
                "new_room_id": 105,
                "reason": "Hỏng điều hòa, nước rò rỉ",
                "old_room_status": "maintenance" | "cleaning",  # default 'maintenance'
                "maintenance_equipment": "Điều hòa Daikin",      # optional
                "maintenance_issue_type": "ac",                 # optional
                "maintenance_description": "Chảy nước nhiều, không lạnh" # optional
            }
        """
        booking = self.get_object()
        user = request.user

        # 1. Kiểm tra quyền theo ma trận RBAC
        if not (user.is_superuser or check_role_permission(user, 'bookings', 'update')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền thực hiện đổi phòng cho khách (Yêu cầu quyền Cập nhật đơn đặt phòng).'
            }, status=status.HTTP_403_FORBIDDEN)

        # 2. Kiểm tra trạng thái đơn: Phải là 'checked_in'
        if booking.status != 'checked_in':
            return Response({
                'success': False,
                'message': f'Đơn đặt phòng {booking.booking_code} hiện ở trạng thái "{booking.get_status_display()}". Chỉ có thể đổi phòng cho khách đang lưu trú (Checked-in).'
            }, status=status.HTTP_400_BAD_REQUEST)

        old_room = booking.room
        if not old_room:
            return Response({
                'success': False,
                'message': 'Đơn đặt phòng này hiện chưa được gán phòng cụ thể.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Lấy phòng mới
        new_room_id = request.data.get('new_room_id')
        if not new_room_id:
            return Response({
                'success': False,
                'message': 'Vui lòng chọn phòng mới cần chuyển khách tới.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_room = Room.objects.select_related('category').get(pk=int(new_room_id))
        except (Room.DoesNotExist, ValueError):
            return Response({
                'success': False,
                'message': f'Không tìm thấy phòng mới với mã ID {new_room_id}.'
            }, status=status.HTTP_404_NOT_FOUND)

        if new_room.id == old_room.id:
            return Response({
                'success': False,
                'message': f'Phòng mới trùng với phòng hiện tại (Phòng {old_room.room_number}). Vui lòng chọn phòng khác.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if new_room.status != 'available':
            return Response({
                'success': False,
                'message': f'Phòng {new_room.room_number} hiện không ở trạng thái sẵn sàng đón khách (Hiện tại: "{new_room.get_status_display()}"). Vui lòng chọn phòng trống khác.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Kiểm tra xung đột lịch: Phòng mới có bị khách khác đặt trước trong khoảng từ hôm nay đến check-out không
        today = timezone.localdate()
        conflict_move = Booking.objects.filter(
            room=new_room,
            status__in=['confirmed', 'checked_in']
        ).exclude(id=booking.id).filter(
            check_in_date__lt=booking.check_out_date,
            check_out_date__gt=today
        ).first()

        if conflict_move:
            return Response({
                'success': False,
                'message': f'Không thể chuyển sang phòng {new_room.room_number}. Phòng này đã có đơn #{conflict_move.booking_code} đặt trước từ {conflict_move.check_in_date.strftime("%d/%m/%Y")} đến {conflict_move.check_out_date.strftime("%d/%m/%Y")}.'
            }, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '').strip() or 'Thiết bị phòng bị sự cố hư hỏng'
        old_room_status = request.data.get('old_room_status', 'maintenance')
        if old_room_status not in ['maintenance', 'cleaning']:
            old_room_status = 'maintenance'

        now = timezone.now()
        time_str = now.strftime('%H:%M • %d/%m/%Y')
        staff_name = (user.get_full_name() or user.username) if user.is_authenticated else "Lễ tân"
        guest_display = (booking.guest.get_full_name() or booking.guest.username) if booking.guest else booking.guest_name

        with transaction.atomic():
            # Khóa bi quan Booking và Phòng mới
            booking = Booking.objects.select_for_update().get(pk=booking.pk)
            new_room = Room.objects.select_for_update().get(pk=new_room.pk)
            if new_room.status != 'available':
                return Response({
                    'success': False,
                    'message': f'Phòng mới {new_room.room_number} không còn ở trạng thái sẵn sàng (vừa được gán cho đơn khác).'
                }, status=status.HTTP_400_BAD_REQUEST)

            # 1. Cập nhật phòng mới sang 'occupied'
            new_room.status = 'occupied'
            new_room.save(update_fields=['status'])

            # 2. Cập nhật booking trỏ sang new_room
            log_entry = f"[Đổi phòng lúc {time_str} bởi {staff_name}]: Chuyển khách {guest_display} từ P.{old_room.room_number} sang P.{new_room.room_number}. Lý do: {reason}."
            if booking.internal_note:
                booking.internal_note = f"{booking.internal_note}\n{log_entry}".strip()
            else:
                booking.internal_note = log_entry

            booking.room = new_room
            booking.save(update_fields=['room', 'internal_note', 'updated_at'])

            # 3. Cập nhật phòng cũ sang 'maintenance' hoặc 'cleaning'
            old_room.status = old_room_status
            old_room.save(update_fields=['status'])

            # 4. Nếu chuyển phòng cũ sang maintenance: Tự động lập phiếu bảo trì nếu có thông tin thiết bị
            created_ticket = None
            if old_room_status == 'maintenance':
                from ..rooms.models import MaintenanceTicket
                from ..bookings.models import BookingExtraService
                import uuid
                eq_name = request.data.get('maintenance_equipment', '').strip() or 'Thiết bị phòng (Sự cố cần kiểm tra)'
                issue_type = request.data.get('maintenance_issue_type', 'other')
                desc = request.data.get('maintenance_description', '').strip() or reason
                parts_replaced = request.data.get('parts_replaced', '').strip()
                try:
                    raw_cost = str(request.data.get('cost', 0)).replace(',', '').replace('.', '').replace(' ', '')
                    cost = int(raw_cost) if raw_cost.isdigit() else 0
                except (ValueError, TypeError):
                    cost = 0
                is_guest_fault = bool(request.data.get('is_guest_fault', False))

                ticket_code = f"MT-{uuid.uuid4().hex[:6].upper()}"
                created_ticket = MaintenanceTicket.objects.create(
                    room=old_room,
                    ticket_code=ticket_code,
                    equipment_name=eq_name,
                    issue_type=issue_type,
                    description=f"[Đổi phòng] Khách {guest_display} chuyển phòng do: {desc}",
                    parts_replaced=parts_replaced,
                    cost=cost,
                    is_guest_fault=is_guest_fault,
                    booking=booking if is_guest_fault else None,
                    status='fixing',
                    created_by=user if user.is_authenticated else None
                )

                # NẾU DO KHÁCH LÀM HỎNG: Tự động cộng mục bồi thường vào đơn đặt phòng của khách!
                if is_guest_fault and cost > 0:
                    BookingExtraService.objects.create(
                        booking=booking,
                        service_name=f"Bồi thường hỏng thiết bị: {eq_name}",
                        quantity=1,
                        price=cost
                    )

            # 5. Ghi log kiểm toán (Audit log)
            log_action(
                user=user,
                action='UPDATE',
                module='BOOKING',
                description=f"Đổi phòng đơn #{booking.booking_code}: Chuyển khách {guest_display} từ P.{old_room.room_number} sang P.{new_room.room_number}. Lý do: {reason}",
                request=request
            )

        # 6. Gửi thông báo đến Lễ tân, Kỹ thuật và Buồng phòng
        try:
            from ..notifications.models import Notification
            notify_users = User.objects.filter(
                Q(role__in=['receptionist', 'manager', 'admin', 'technician', 'housekeeper']) | Q(is_superuser=True)
            ).distinct()

            old_status_text = "Đang bảo trì" if old_room_status == 'maintenance' else "Cần dọn dẹp"
            notif_title = f"🔄 [ĐỔI PHÒNG] Khách P.{old_room.room_number} chuyển sang P.{new_room.room_number}!"
            notif_msg = (
                f"Lễ tân ({staff_name}) đã thực hiện Đổi phòng cho khách lưu trú:\n"
                f"• Khách hàng: {guest_display} (#{booking.booking_code})\n"
                f"• Phòng cũ: P.{old_room.room_number} ➔ Trạng thái mới: {old_status_text}\n"
                f"• Phòng mới: P.{new_room.room_number} (Tầng {new_room.floor})\n"
                f"• Lý do: {reason}"
            )
            for r in notify_users:
                Notification.objects.create(
                    recipient=r,
                    title=notif_title,
                    message=notif_msg
                )
        except Exception:
            pass

        from ..rooms.serializers import RoomSerializer
        return Response({
            'success': True,
            'message': f'Đã đổi phòng thành công cho khách {guest_display}! Khách đã nhận phòng mới {new_room.room_number}. Phòng cũ {old_room.room_number} đã chuyển sang "{old_room.get_status_display()}".',
            'booking': self.get_serializer(booking).data,
            'new_room': RoomSerializer(new_room).data,
            'old_room': RoomSerializer(old_room).data,
        }, status=status.HTTP_200_OK)


    @action(detail=False, methods=['post'], url_path='walk-in')
    def walk_in(self, request):
        """
        API tiếp đón Khách vãng lai (Walk-in Guest) nhận phòng trực tiếp tại quầy Lễ tân:
        - POST /api/bookings/walk-in/
        - Thực hiện ĐỒNG THỜI trong transaction.atomic:
          1. Tìm hoặc Tạo mới User / GuestProfile dựa trên số điện thoại khách cung cấp
          2. Tạo mới đơn Booking với check_in=Today, status='checked_in', actual_check_in=now(), room=target_room
          3. Cập nhật bảng Room tương ứng sang status='occupied' (Đang có khách)
        """
        user = request.user

        if not (user.is_superuser or check_role_permission(user, 'bookings', 'create')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền thực hiện tiếp đón khách Walk-in tại quầy (Yêu cầu quyền Tạo đơn đặt phòng).'
            }, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        guest_name = str(data.get('guest_name') or '').strip()
        guest_phone = str(data.get('guest_phone') or '').strip()
        identity_card = str(data.get('identity_card') or '').strip()
        guest_email = str(data.get('guest_email') or '').strip()
        room_id = data.get('room_id') or data.get('room')
        check_out_str = data.get('check_out_date')
        note = str(data.get('note') or '').strip()
        internal_note_input = str(data.get('internal_note') or '').strip()

        # Validate dữ liệu đầu vào bắt buộc
        if not guest_name:
            return Response({
                'success': False,
                'message': 'Vui lòng nhập Họ và tên khách hàng.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not guest_phone:
            return Response({
                'success': False,
                'message': 'Vui lòng cung cấp Số điện thoại khách hàng để quản lý hồ sơ lưu trú.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not identity_card:
            return Response({
                'success': False,
                'message': 'Số CCCD / Hộ chiếu (Passport) là bắt buộc theo quy định pháp lý lưu trú.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if len(identity_card) < 8 or len(identity_card) > 20:
            return Response({
                'success': False,
                'message': 'Số CCCD / Hộ chiếu phải có độ dài từ 8 đến 20 ký tự.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not room_id:
            return Response({
                'success': False,
                'message': 'Vui lòng chọn số phòng thực tế cụ thể để bàn giao cho khách Walk-in.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_room = Room.objects.select_related('category').get(pk=int(room_id))
        except (Room.DoesNotExist, ValueError):
            return Response({
                'success': False,
                'message': f'Không tìm thấy thông tin phòng thực tế với mã ID {room_id}.'
            }, status=status.HTTP_404_NOT_FOUND)

        if target_room.status != 'available':
            return Response({
                'success': False,
                'message': f'Phòng {target_room.room_number} hiện không ở trạng thái sẵn sàng đón khách (Hiện tại: "{target_room.get_status_display()}"). Vui lòng chọn phòng trống khác.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Xử lý ngày tháng: Check-in tự động mặc định là Hôm nay
        now = timezone.now()
        check_in_date = now.date()

        if not check_out_str:
            return Response({
                'success': False,
                'message': 'Vui lòng chọn ngày trả phòng (Check-out).'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            check_out_date = datetime.strptime(str(check_out_str)[:10], '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'success': False,
                'message': 'Định dạng ngày trả phòng không hợp lệ (chuẩn YYYY-MM-DD).'
            }, status=status.HTTP_400_BAD_REQUEST)

        if check_out_date <= check_in_date:
            return Response({
                'success': False,
                'message': 'Ngày trả phòng (Check-out) bắt buộc phải sau ngày hôm nay.'
            }, status=status.HTTP_400_BAD_REQUEST)

        nights = max(1, (check_out_date - check_in_date).days)

        # Kiểm tra xung đột lịch: Phòng này có đơn nào đã đặt trước trong khoảng thời gian khách Walk-in lưu trú không
        conflict_walkin = Booking.objects.filter(
            room=target_room,
            status__in=['confirmed', 'checked_in'],
            check_in_date__lt=check_out_date,
            check_out_date__gt=check_in_date
        ).first()

        if conflict_walkin:
            return Response({
                'success': False,
                'message': f'Phòng {target_room.room_number} đã có đơn #{conflict_walkin.booking_code} đặt trước trong khoảng thời gian {conflict_walkin.check_in_date.strftime("%d/%m/%Y")} - {conflict_walkin.check_out_date.strftime("%d/%m/%Y")}. Vui lòng chọn phòng trống khác.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Tính toán tiền phòng dự kiến (Số đêm * Giá phòng)
        category_instance = target_room.category
        price_per_night = (category_instance.promo_price or category_instance.base_price) if category_instance else 0
        calculated_total = price_per_night * nights

        provided_total = data.get('total_amount')
        total_amount = calculated_total
        if provided_total is not None and str(provided_total).isdigit() and int(provided_total) > 0:
            prov_val = int(provided_total)
            min_floor = int(calculated_total * 0.5)
            is_manager = user.is_superuser or getattr(user, 'role', '') in ['admin', 'owner', 'manager']
            if prov_val < min_floor and not is_manager:
                return Response({
                    'success': False,
                    'message': f'Giá phòng điều chỉnh ({prov_val:,.0f}đ) thấp hơn 50% giá niêm yết ({calculated_total:,.0f}đ). Cần cấp Quản lý (Manager/Admin) phê duyệt.'
                }, status=status.HTTP_400_BAD_REQUEST)
            total_amount = prov_val

        # THỰC THI TRANSACTION ĐỒNG THỜI VỚI PESSIMISTIC LOCKING
        with transaction.atomic():
            # Khóa bi quan phòng mục tiêu chống 2 lễ tân cùng gán 1 phòng cho 2 khách walk-in đồng thời
            target_room = Room.objects.select_for_update().get(pk=target_room.pk)
            if target_room.status != 'available':
                return Response({
                    'success': False,
                    'message': f'Phòng {target_room.room_number} không còn ở trạng thái sẵn sàng đón khách (vừa được gán cho khách khác).'
                }, status=status.HTTP_400_BAD_REQUEST)

            # 1. Tìm hoặc Tạo mới User và GuestProfile theo số điện thoại
            clean_phone = ''.join(c for c in str(guest_phone) if c.isdigit())
            guest_user = User.objects.filter(phone_number=guest_phone).first()
            if not guest_user and clean_phone:
                guest_user = User.objects.filter(phone_number=clean_phone).first()
            if not guest_user and guest_email:
                guest_user = User.objects.filter(email=guest_email).first()

            if not guest_user:
                base_username = f"walkin_{clean_phone[-6:]}" if len(clean_phone) >= 6 else f"walkin_{uuid.uuid4().hex[:6]}"
                username = base_username
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}_{counter}"
                    counter += 1

                name_parts = guest_name.split()
                first_name = ' '.join(name_parts[:-1]) if len(name_parts) > 1 else guest_name
                last_name = name_parts[-1] if len(name_parts) > 1 else ''
                email_to_use = guest_email or f"{username}@walkin.hotel.local"

                guest_user = User.objects.create_user(
                    username=username,
                    email=email_to_use,
                    phone_number=guest_phone,
                    first_name=first_name,
                    last_name=last_name,
                    role='guest'
                )
            else:
                # Cập nhật họ tên nếu tài khoản cũ chưa có họ tên
                if guest_name and not (guest_user.first_name or guest_user.last_name):
                    name_parts = guest_name.split()
                    guest_user.first_name = ' '.join(name_parts[:-1]) if len(name_parts) > 1 else guest_name
                    guest_user.last_name = name_parts[-1] if len(name_parts) > 1 else ''
                    guest_user.save(update_fields=['first_name', 'last_name'])

            # Cập nhật hoặc tạo GuestProfile
            profile, _ = GuestProfile.objects.get_or_create(user=guest_user)
            if identity_card and profile.id_card_number != identity_card:
                profile.id_card_number = identity_card
                profile.save(update_fields=['id_card_number'])

            # 2. Tạo bản ghi Booking với status='checked_in' và actual_check_in=now()
            receptionist_name = user.get_full_name() or user.username
            time_str = now.strftime('%H:%M • %d/%m/%Y')
            cat_name = category_instance.name if category_instance else 'Phòng tiêu chuẩn'
            auto_log = f"[Khách Walk-in nhận phòng trực tiếp lúc {time_str} bởi Lễ tân {receptionist_name}]: Phòng {target_room.room_number} ({cat_name})."
            if internal_note_input:
                auto_log += f" Ghi chú: {internal_note_input}"

            booking = Booking.objects.create(
                guest=guest_user,
                category=category_instance,
                room=target_room,
                identity_card=identity_card,
                check_in_date=check_in_date,
                check_out_date=check_out_date,
                actual_check_in=now,
                status='checked_in',
                total_amount=total_amount,
                note=note or 'Khách đặt trực tiếp tại quầy Lễ tân (Walk-in)',
                internal_note=auto_log
            )

            # 3. Cập nhật bảng Room sang occupied
            target_room.status = 'occupied'
            target_room.save(update_fields=['status'])

        # Lấy thông tin serialize đầy đủ
        serializer = self.get_serializer(booking, context={'request': request})
        from ..rooms.serializers import RoomSerializer
        room_data = RoomSerializer(target_room).data

        # Ghi nhận Nhật ký thao tác hệ thống (Audit Log)
        log_action(
            user=request.user,
            action='CREATE',
            module='BOOKING',
            description=f"Tiếp đón khách Walk-in #{booking.booking_code} & Check-in ngay cho khách {guest_name} vào phòng {target_room.room_number}",
            request=request
        )

        return Response({
            'success': True,
            'message': f'Hoàn tất tiếp đón khách Walk-in thành công! Đã Check-in khách "{guest_name}" vào Phòng {target_room.room_number}.',
            'booking': serializer.data,
            'room': room_data,
            **serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='advance-reservation')
    def advance_reservation(self, request):
        """
        API tạo đơn Đặt phòng trước (Advance Reservation qua Điện thoại / Zalo / Trực tiếp)
        dành cho nhân viên Lễ tân / Quản trị viên:
        - POST /api/bookings/advance-reservation/
        - Nhận phòng vào một ngày trong tương lai (check_in_date >= today).
        - Gán hạng phòng (RoomCategory), chưa gán phòng vật lý (room=None).
        - Trạng thái mặc định là 'confirmed' (hoặc 'pending').
        """
        user = request.user

        if not (user.is_superuser or check_role_permission(user, 'bookings', 'create')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền tạo đơn đặt phòng trước (Yêu cầu quyền Tạo đơn đặt phòng).'
            }, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        guest_name = str(data.get('guest_name') or '').strip()
        guest_phone = str(data.get('guest_phone') or '').strip()
        identity_card = str(data.get('identity_card') or '').strip()
        guest_email = str(data.get('guest_email') or '').strip()
        category_id = data.get('category_id') or data.get('category') or data.get('room_id')
        check_in_str = data.get('check_in_date')
        check_out_str = data.get('check_out_date')
        initial_status = str(data.get('status') or 'confirmed').strip()
        if initial_status not in ['confirmed', 'pending']:
            initial_status = 'confirmed'
        note = str(data.get('note') or '').strip()
        internal_note_input = str(data.get('internal_note') or '').strip()

        # Validate dữ liệu đầu vào bắt buộc
        if not guest_name:
            return Response({
                'success': False,
                'message': 'Vui lòng nhập Họ và tên khách hàng.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not guest_phone:
            return Response({
                'success': False,
                'message': 'Vui lòng cung cấp Số điện thoại khách hàng để quản lý hồ sơ lưu trú.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not identity_card:
            return Response({
                'success': False,
                'message': 'Số CCCD / Hộ chiếu (Passport) là bắt buộc theo quy định pháp lý lưu trú.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if len(identity_card) < 8 or len(identity_card) > 20:
            return Response({
                'success': False,
                'message': 'Số CCCD / Hộ chiếu phải có độ dài từ 8 đến 20 ký tự.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not category_id:
            return Response({
                'success': False,
                'message': 'Vui lòng chọn Hạng phòng khách muốn đặt.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            category_instance = RoomCategory.objects.get(pk=int(category_id))
        except (RoomCategory.DoesNotExist, ValueError):
            return Response({
                'success': False,
                'message': f'Không tìm thấy thông tin hạng phòng với ID {category_id}.'
            }, status=status.HTTP_404_NOT_FOUND)

        if not check_in_str or not check_out_str:
            return Response({
                'success': False,
                'message': 'Vui lòng chọn ngày Check-in và Check-out hợp lệ.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            check_in_date = datetime.strptime(str(check_in_str)[:10], '%Y-%m-%d').date()
            check_out_date = datetime.strptime(str(check_out_str)[:10], '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'success': False,
                'message': 'Định dạng ngày tháng không hợp lệ (chuẩn YYYY-MM-DD).'
            }, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localdate()
        if check_in_date < today:
            return Response({
                'success': False,
                'message': f'Ngày Check-in không thể ở trong quá khứ (Hôm nay là {today.strftime("%d/%m/%Y")}).'
            }, status=status.HTTP_400_BAD_REQUEST)

        if check_out_date <= check_in_date:
            return Response({
                'success': False,
                'message': 'Ngày Check-out bắt buộc phải sau ngày Check-in.'
            }, status=status.HTTP_400_BAD_REQUEST)

        nights = (check_out_date - check_in_date).days
        if nights < 1:
            nights = 1

        with transaction.atomic():
            # Khóa bi quan hạng phòng
            category_instance = RoomCategory.objects.select_for_update().get(pk=category_instance.pk)

            total_rooms = category_instance.rooms.exclude(status='maintenance').count()
            booked_rooms = Booking.objects.filter(
                category=category_instance,
                check_in_date__lt=check_out_date,
                check_out_date__gt=check_in_date
            ).filter(
                Q(status__in=['confirmed', 'checked_in']) |
                Q(status__in=['pending', 'paid', 'PAID'])
            ).count()
            available_rooms = max(0, total_rooms - booked_rooms)

            if available_rooms <= 0:
                return Response({
                    'success': False,
                    'code': 'ROOM_SOLD_OUT',
                    'message': f'Hạng phòng "{category_instance.name}" đã hết phòng trống trong khoảng thời gian từ {check_in_date.strftime("%d/%m/%Y")} đến {check_out_date.strftime("%d/%m/%Y")}. Vui lòng chọn hạng phòng khác.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Tìm hoặc tạo User khách hàng theo SĐT
            clean_phone = ''.join(c for c in str(guest_phone) if c.isdigit())
            guest_user = User.objects.filter(phone_number=guest_phone).first()
            if not guest_user and clean_phone:
                guest_user = User.objects.filter(phone_number=clean_phone).first()
            if not guest_user and guest_email:
                guest_user = User.objects.filter(email=guest_email).first()

            if not guest_user:
                base_username = f"guest_{clean_phone[-6:]}" if len(clean_phone) >= 6 else f"guest_{uuid.uuid4().hex[:6]}"
                username = base_username
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}_{counter}"
                    counter += 1

                name_parts = guest_name.split()
                first_name = ' '.join(name_parts[:-1]) if len(name_parts) > 1 else guest_name
                last_name = name_parts[-1] if len(name_parts) > 1 else ''
                email_to_use = guest_email or f"{username}@guest.hotel.local"

                guest_user = User.objects.create_user(
                    username=username,
                    email=email_to_use,
                    phone_number=guest_phone,
                    first_name=first_name,
                    last_name=last_name,
                    role='guest'
                )
            else:
                if guest_name and not (guest_user.first_name or guest_user.last_name):
                    name_parts = guest_name.split()
                    guest_user.first_name = ' '.join(name_parts[:-1]) if len(name_parts) > 1 else guest_name
                    guest_user.last_name = name_parts[-1] if len(name_parts) > 1 else ''
                    guest_user.save(update_fields=['first_name', 'last_name'])

            # Cập nhật hoặc tạo GuestProfile
            profile, _ = GuestProfile.objects.get_or_create(user=guest_user)
            if identity_card and profile.id_card_number != identity_card:
                profile.id_card_number = identity_card
                profile.save(update_fields=['id_card_number'])

            # Tính toán tiền phòng
            price_per_night = Decimal(str(category_instance.promo_price or category_instance.base_price))
            total_amount = price_per_night * Decimal(str(nights))

            receptionist_name = user.get_full_name() or user.username
            now = timezone.now()
            time_str = now.strftime('%H:%M • %d/%m/%Y')
            auto_internal_log = f"[Đặt trước qua Lễ tân {receptionist_name} lúc {time_str}]: Hạng {category_instance.name} ({nights} đêm)."
            if internal_note_input:
                auto_internal_log += f" Ghi chú: {internal_note_input}"

            booking = Booking.objects.create(
                guest=guest_user,
                category=category_instance,
                room=None,
                identity_card=identity_card,
                check_in_date=check_in_date,
                check_out_date=check_out_date,
                total_amount=total_amount,
                status=initial_status,
                note=note or 'Đặt trước qua điện thoại/Zalo',
                internal_note=auto_internal_log
            )

        serializer = BookingSerializer(booking, context={'request': request})

        # Ghi nhận Nhật ký thao tác hệ thống (Audit Log)
        log_action(
            user=request.user,
            action='CREATE',
            module='BOOKING',
            description=f"Tạo đơn đặt phòng trước #{booking.booking_code} ({initial_status}) cho khách {guest_name} - Hạng {category_instance.name} ({check_in_date.strftime('%d/%m/%Y')} -> {check_out_date.strftime('%d/%m/%Y')})",
            request=request
        )

        return Response({
            'success': True,
            'message': f'Tạo đơn đặt giữ chỗ thành công! Mã đơn: #{booking.booking_code} (Hạng {category_instance.name}).',
            'booking': serializer.data,
            'data': serializer.data,
            **serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='check-availability', permission_classes=[AllowAny])
    def check_availability(self, request):
        """
        API kiểm tra tình trạng còn phòng theo Hạng phòng và khoảng ngày Check-in/Check-out.
        GET /api/bookings/check-availability/?category_id=1&check_in_date=2026-10-01&check_out_date=2026-10-03
        """
        category_id = request.query_params.get('category_id') or request.query_params.get('room_id')
        check_in_str = request.query_params.get('check_in_date')
        check_out_str = request.query_params.get('check_out_date')

        if not category_id:
            return Response({'success': False, 'message': 'Vui lòng cung cấp category_id.'}, status=status.HTTP_400_BAD_REQUEST)

        # Tìm hạng phòng
        category = None
        if str(category_id).isdigit():
            category = RoomCategory.objects.filter(pk=int(category_id)).first()
            if not category:
                room = Room.objects.filter(pk=int(category_id)).first()
                if room:
                    category = room.category
        else:
            category = RoomCategory.objects.filter(slug=str(category_id)).first()

        if not category:
            return Response({'success': False, 'message': 'Không tìm thấy thông tin hạng phòng.'}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now().date()
        try:
            check_in = datetime.strptime(str(check_in_str)[:10], '%Y-%m-%d').date() if check_in_str else now
        except ValueError:
            check_in = now

        try:
            check_out = datetime.strptime(str(check_out_str)[:10], '%Y-%m-%d').date() if check_out_str else (check_in + timezone.timedelta(days=1))
        except ValueError:
            check_out = check_in + timezone.timedelta(days=1)

        if check_out <= check_in:
            check_out = check_in + timezone.timedelta(days=1)

        def get_category_availability(cat, c_in, c_out):
            pending_timeout = timezone.now() - timedelta(minutes=15)
            # Nếu khoảng ngày bao gồm ngày hôm nay: tính cả các phòng vật lý đang bận (occupied, maintenance)
            if c_in <= now < c_out:
                busy_physical_ids = set(cat.rooms.filter(status__in=['occupied', 'maintenance']).values_list('id', flat=True))
                active_bookings = Booking.objects.filter(
                    category=cat,
                    check_in_date__lt=c_out,
                    check_out_date__gt=c_in
                ).filter(
                    Q(status__in=['confirmed', 'checked_in']) |
                    Q(status__in=['pending', 'paid', 'PAID'], created_at__gte=pending_timeout)
                )
                unassigned_or_clean_bookings = active_bookings.filter(
                    Q(room__isnull=True) | ~Q(room_id__in=busy_physical_ids)
                ).count()
                total_busy = len(busy_physical_ids) + unassigned_or_clean_bookings
                avail = max(0, cat.rooms.count() - total_busy)
                return cat.rooms.count(), total_busy, avail
            else:
                total = cat.rooms.exclude(status='maintenance').count()
                booked = Booking.objects.filter(
                    category=cat,
                    check_in_date__lt=c_out,
                    check_out_date__gt=c_in
                ).filter(
                    Q(status__in=['confirmed', 'checked_in']) |
                    Q(status__in=['pending', 'paid', 'PAID'], created_at__gte=pending_timeout)
                ).count()
                avail = max(0, total - booked)
                return total, booked, avail

        total_rooms, booked_rooms, available_rooms = get_category_availability(category, check_in, check_out)
        is_sold_out = (available_rooms <= 0)

        # Gợi ý các hạng phòng khác còn trống
        suggested = []
        if is_sold_out:
            for other_cat in RoomCategory.objects.exclude(id=category.id):
                other_total, other_booked, other_avail = get_category_availability(other_cat, check_in, check_out)
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
            'success': True,
            'category_id': category.id,
            'category_name': category.name,
            'total_rooms': total_rooms,
            'booked_rooms': booked_rooms,
            'available_rooms': available_rooms,
            'is_sold_out': is_sold_out,
            'check_in_date': str(check_in),
            'check_out_date': str(check_out),
            'suggested_categories': suggested
        })

    @action(detail=True, methods=['post'], url_path='add-extra-service')
    def add_extra_service(self, request, pk=None):
        """
        Lễ tân / Quản trị viên thêm dịch vụ phát sinh hoặc gọi món cho đơn đặt phòng:
        - Dành cho khách yêu cầu tại quầy lễ tân hoặc gọi điện thoại.
        - Khách đặt thêm món ăn / nước uống / dịch vụ khách sạn.
        - Ghi nhận phụ thu tùy chỉnh (minibar, đền bù đồ vỡ, check-in sớm, v.v.).
        POST /api/bookings/<id>/add-extra-service/
        """
        booking = self.get_object()
        user = request.user

        # 1. Kiểm tra phân quyền: Yêu cầu quyền cập nhật đơn đặt phòng hoặc tạo yêu cầu dịch vụ
        can_add = user.is_superuser or check_role_permission(user, 'bookings', 'update') or check_role_permission(user, 'services', 'create')
        if not can_add:
            return Response({
                'success': False,
                'message': 'Bạn không có quyền thêm dịch vụ vào đơn đặt phòng.'
            }, status=status.HTTP_403_FORBIDDEN)

        if booking.status == 'cancelled':
            return Response({
                'success': False,
                'message': f'Đơn đặt phòng {booking.booking_code} đã bị hủy. Không thể thêm dịch vụ phát sinh.'
            }, status=status.HTTP_400_BAD_REQUEST)

        service_id = request.data.get('service_id')
        custom_name = (request.data.get('custom_name') or request.data.get('service_name') or '').strip()

        try:
            quantity = int(request.data.get('quantity', 1))
            if quantity < 1 or quantity > 99:
                return Response({
                    'success': False,
                    'message': 'Số lượng dịch vụ phải nằm trong khoảng từ 1 đến 99.'
                }, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError):
            quantity = 1

        price_input = request.data.get('price')
        note = (request.data.get('note') or '').strip()
        service_status = request.data.get('service_status', 'completed')
        if service_status not in ['completed', 'pending', 'in_progress']:
            service_status = 'completed'

        if not service_id and not custom_name:
            return Response({
                'success': False,
                'message': 'Vui lòng chọn một dịch vụ từ danh mục hoặc nhập tên phụ phí tùy chỉnh.'
            }, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        staff_name = user.get_full_name() or user.username if user.is_authenticated else 'Lễ tân'

        with transaction.atomic():
            if service_id:
                service_item = ServiceItem.objects.filter(pk=service_id).first()
                if not service_item:
                    return Response({
                        'success': False,
                        'message': 'Dịch vụ được chọn không tồn tại trong hệ thống.'
                    }, status=status.HTTP_404_NOT_FOUND)

                try:
                    unit_price = float(price_input) if price_input is not None and str(price_input).strip() != '' else float(service_item.price)
                    if unit_price < 0:
                        raise ValueError()
                except (ValueError, TypeError):
                    return Response({
                        'success': False,
                        'message': 'Đơn giá dịch vụ không hợp lệ hoặc không được là số âm.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                total_price = unit_price * quantity
                clean_name = service_item.name.strip()

                auto_note = note or f"Lễ tân {staff_name} tiếp nhận tại quầy / qua điện thoại"

                req = ServiceRequest.objects.create(
                    booking=booking,
                    service=service_item,
                    quantity=quantity,
                    total_price=total_price,
                    status=service_status,
                    note=auto_note,
                    request_time=now
                )

                if service_status == 'completed':
                    # Đồng bộ vào BookingExtraService để tính vào hóa đơn
                    service_name_bill = f"{clean_name} [Yêu cầu #{req.id}]"
                    BookingExtraService.objects.create(
                        booking=booking,
                        service_name=service_name_bill,
                        quantity=quantity,
                        price=unit_price
                    )
                    msg = f'Đã thêm dịch vụ "{clean_name}" (x{quantity}) vào hóa đơn thanh toán thành công!'
                else:
                    msg = f'Đã tạo yêu cầu "{clean_name}" (x{quantity}) thành công! Đã gửi thông báo đến bộ phận liên quan để chuẩn bị.'

            else:
                # Custom name (phụ phí ngoài menu: minibar, đền bù, phụ thu, v.v.)
                if price_input is None or str(price_input).strip() == '':
                    return Response({
                        'success': False,
                        'message': 'Vui lòng nhập đơn giá cho khoản phụ thu này.'
                    }, status=status.HTTP_400_BAD_REQUEST)

                try:
                    unit_price = float(price_input)
                    if unit_price < 0:
                        raise ValueError()
                except ValueError:
                    return Response({
                        'success': False,
                        'message': 'Đơn giá không hợp lệ. Vui lòng nhập số tiền lớn hơn hoặc bằng 0.'
                    }, status=status.HTTP_400_BAD_REQUEST)

                bes_name = custom_name
                if note:
                    bes_name = f"{custom_name} ({note})"

                BookingExtraService.objects.create(
                    booking=booking,
                    service_name=bes_name,
                    quantity=quantity,
                    price=unit_price
                )
                msg = f'Đã ghi nhận phụ phí "{custom_name}" (x{quantity}) vào đơn đặt phòng thành công!'

        # Trả về đối tượng Booking đã cập nhật mới nhất
        booking.refresh_from_db()

        log_action(
            user=request.user,
            action='CREATE',
            module='BOOKING',
            description=f'{msg} cho đơn đặt phòng #{booking.booking_code}',
            request=request
        )

        serializer = self.get_serializer(booking, context={'request': request})
        return Response({
            'success': True,
            'message': msg,
            'booking': serializer.data,
            **serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='remove-extra-service')
    def remove_extra_service(self, request, pk=None):
        """
        Lễ tân / Quản trị viên xóa phụ phí hoặc dịch vụ khỏi đơn đặt phòng:
        POST /api/bookings/<id>/remove-extra-service/
        Payload: { "item_id": "req_9" | 3 }
        """
        booking = self.get_object()
        user = request.user

        if not (user.is_superuser or check_role_permission(user, 'bookings', 'update')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền xóa phụ phí dịch vụ của đơn đặt phòng (Yêu cầu quyền Cập nhật đơn đặt phòng).'
            }, status=status.HTTP_403_FORBIDDEN)

        item_id = str(request.data.get('item_id', '')).strip()
        if not item_id:
            return Response({
                'success': False,
                'message': 'Vui lòng cung cấp mã dịch vụ / phụ phí cần xóa.'
            }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if item_id.startswith('req_'):
                try:
                    req_id = int(item_id.replace('req_', ''))
                    ServiceRequest.objects.filter(pk=req_id, booking=booking).delete()
                    BookingExtraService.objects.filter(booking=booking, service_name__contains=f"[Yêu cầu #{req_id}]").delete()
                except (ValueError, TypeError):
                    pass
            elif item_id.isdigit():
                BookingExtraService.objects.filter(pk=int(item_id), booking=booking).delete()
            else:
                BookingExtraService.objects.filter(pk=item_id, booking=booking).delete()

        booking.refresh_from_db()

        log_action(
            user=request.user,
            action='DELETE',
            module='BOOKING',
            description=f'Xóa dịch vụ / phụ phí (Mã {item_id}) khỏi đơn đặt phòng #{booking.booking_code}',
            request=request
        )

        serializer = self.get_serializer(booking, context={'request': request})
        return Response({
            'success': True,
            'message': 'Đã xóa dịch vụ / phụ phí khỏi đơn đặt phòng thành công.',
            'booking': serializer.data,
            **serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='summary')
    def summary(self, request, pk=None):
        """
        API GET /api/bookings/{id}/summary/
        Lấy Bảng kê chi tiết trước khi thanh toán và Check-out:
        - room_charge: Tiền lưu trú (Giá phòng * Số đêm thực tế)
        - extra_services: Mảng chứa các ServiceRequest liên kết với Booking này có trạng thái completed
        - total_service_charge: Tổng tiền dịch vụ
        - grand_total: Tổng thanh toán cuối cùng (room_charge + total_service_charge)
        """
        booking = self.get_object()

        # 1. Tính toán số đêm và tiền lưu trú (room_charge)
        check_in = booking.check_in_date
        check_out = booking.check_out_date
        nights = max(1, (check_out - check_in).days) if (check_in and check_out) else 1

        # Xác định đơn giá theo đêm (daily_rate)
        daily_rate = 0.0
        if booking.category and booking.category.base_price:
            daily_rate = float(booking.category.promo_price or booking.category.base_price)
        elif booking.room and booking.room.category and booking.room.category.base_price:
            daily_rate = float(booking.room.category.promo_price or booking.room.category.base_price)

        room_subtotal = daily_rate * nights
        mem_discount = float(booking.membership_discount or 0)
        promo_discount = 0.0
        if booking.applied_promotion:
            if booking.applied_promotion.discount_type == 'percentage':
                promo_discount = (room_subtotal * float(booking.applied_promotion.discount_value)) / 100.0
                if getattr(booking.applied_promotion, 'max_discount_amount', None):
                    promo_discount = min(promo_discount, float(booking.applied_promotion.max_discount_amount))
            else:
                promo_discount = min(room_subtotal, float(booking.applied_promotion.discount_value))
        elif getattr(booking, 'promotion_discount', None):
            promo_discount = float(booking.promotion_discount)

        pure_room_charge = max(0.0, room_subtotal - mem_discount - promo_discount)
        if pure_room_charge <= 0 and booking.total_amount:
            pre_ordered_total = sum(float(r.total_price or 0) for r in booking.service_requests.all())
            pure_room_charge = max(0.0, float(booking.total_amount) - pre_ordered_total)

        room_charge = pure_room_charge

        # 2. Lấy extra_services (các ServiceRequest liên kết có status='completed')
        import re
        extra_services = []

        # 2.1. Từ ServiceRequest (Yêu cầu gọi món & dịch vụ tại phòng)
        valid_requests = booking.service_requests.exclude(
            status='cancelled'
        ).select_related('service').order_by('created_at')

        for req in valid_requests:
            s_name = (req.service.name if req.service else 'Dịch vụ phòng').strip()
            price = float(req.service.price if req.service else 0)
            total = float(req.total_price or (price * req.quantity))
            extra_services.append({
                'id': f"req_{req.id}",
                'request_id': req.id,
                'source': 'service_request',
                'service_name': s_name,
                'quantity': req.quantity,
                'price': price,
                'total_price': total,
                'status': req.status,
                'status_display': req.get_status_display(),
                'is_paid': getattr(req, 'is_paid', False),
                'note': req.note or '',
                'created_at': req.created_at.isoformat() if req.created_at else None
            })

        # 2.2. Từ BookingExtraService (Phụ phí lễ tân đã thêm tại quầy)
        for bes in booking.extra_services.all().order_by('added_time'):
            raw_name = (bes.service_name or '').strip()
            if re.search(r'\[Yêu cầu #\d+\]', raw_name, re.IGNORECASE):
                continue
            clean_name = re.sub(r'\(x\d+\)', '', raw_name)
            clean_name = re.sub(r'\[.*?\]', '', clean_name).strip()
            total = float((bes.price or 0) * (bes.quantity or 1))

            # Tránh trùng lặp với danh sách service_request đã có
            if any(s['service_name'].lower() == clean_name.lower() and s['quantity'] == bes.quantity for s in extra_services):
                continue

            extra_services.append({
                'id': f"extra_{bes.id}",
                'extra_id': bes.id,
                'source': 'extra_service',
                'service_name': clean_name or raw_name,
                'quantity': bes.quantity,
                'price': float(bes.price or 0),
                'total_price': total,
                'status': 'completed',
                'status_display': 'Đã hoàn thành',
                'is_paid': getattr(bes, 'is_paid', False),
                'note': '',
                'created_at': bes.added_time.isoformat() if bes.added_time else None
            })

        # 3. Phân tách Dịch vụ đặt trước đã thanh toán vs Dịch vụ phát sinh chưa thanh toán
        prepaid_services_total = float(sum(item['total_price'] for item in extra_services if item['is_paid']))
        unpaid_services_total = float(sum(item['total_price'] for item in extra_services if not item['is_paid']))
        total_service_charge = float(sum(item['total_price'] for item in extra_services))

        # 4. Tổng thanh toán cuối cùng (grand_total = pure_room_charge + total_service_charge)
        grand_total = float(room_charge + total_service_charge)

        # 4.1. Xác định số tiền khách đã thanh toán trước (paid_amount)
        paid_amount = 0.0
        if hasattr(booking, 'payments'):
            completed_payments = booking.payments.filter(payment_status='COMPLETED')
            if completed_payments.exists():
                paid_amount = float(sum(p.amount for p in completed_payments))

        if paid_amount <= 0:
            if booking.status in ['paid', 'PAID'] or (hasattr(booking, 'invoice') and booking.invoice and booking.invoice.status == 'paid'):
                paid_amount = float(booking.total_amount or (room_charge + prepaid_services_total))
            elif booking.note and ('vietqr: đã thanh toán' in booking.note.lower() or 'đã thanh toán thành công' in booking.note.lower()):
                paid_amount = float(booking.total_amount or (room_charge + prepaid_services_total))

        # Số tiền còn lại cần thanh toán khi check-out (remaining_amount)
        remaining_amount = max(0.0, float(grand_total - paid_amount))

        # 5. Thông tin hóa đơn đã có (nếu đơn đã từng lập hóa đơn)
        invoice_info = None
        if hasattr(booking, 'invoice') and booking.invoice:
            inv = booking.invoice
            invoice_info = {
                'invoice_code': inv.invoice_code,
                'room_charge': float(inv.room_charge),
                'service_charge': float(inv.service_charge),
                'total_amount': float(inv.total_amount),
                'payment_method': inv.payment_method,
                'payment_method_display': inv.get_payment_method_display(),
                'status': inv.status,
                'status_display': inv.get_status_display(),
                'paid_at': inv.paid_at.isoformat() if inv.paid_at else None,
                'created_at': inv.created_at.isoformat() if inv.created_at else None
            }

        return Response({
            'success': True,
            'booking_id': booking.id,
            'booking_code': booking.booking_code,
            'guest_name': booking.guest.get_full_name() or booking.guest.username,
            'guest_phone': getattr(booking.guest, 'phone_number', '') or '',
            'guest_email': booking.guest.email or '',
            'identity_card': booking.identity_card or '',
            'room_id': booking.room.id if booking.room else None,
            'room_number': booking.room.room_number if booking.room else None,
            'room_name': booking.category.name if booking.category else (booking.room.category.name if booking.room and booking.room.category else 'Phòng tiêu chuẩn'),
            'check_in_date': booking.check_in_date,
            'check_out_date': booking.check_out_date,
            'actual_check_in': booking.actual_check_in.isoformat() if booking.actual_check_in else None,
            'actual_check_out': booking.actual_check_out.isoformat() if booking.actual_check_out else None,
            'nights': nights,
            'daily_rate': daily_rate,
            'room_charge': room_charge,
            'extra_services': extra_services,
            'prepaid_services_total': prepaid_services_total,
            'unpaid_services_total': unpaid_services_total,
            'service_charge': total_service_charge,
            'total_service_charge': total_service_charge,
            'total_amount': grand_total,
            'grand_total': grand_total,
            'paid_amount': paid_amount,
            'remaining_balance': remaining_amount,
            'remaining_amount': remaining_amount,
            'status': booking.status,
            'status_display': booking.get_status_display(),
            'invoice': invoice_info
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='check-out')
    def check_out(self, request, pk=None):
        """
        API POST /api/bookings/{id}/check-out/
        Xử lý thanh toán và hoàn tất Check-out:
        - Tạo bản ghi Invoice lưu tổng số tiền
        - Cập nhật bảng Booking: Đổi trạng thái thành completed
        - Cập nhật bảng Room: Đổi trạng thái phòng thành cleaning (Đang dọn dẹp)
        """
        booking = self.get_object()
        user = request.user

        # Kiểm tra phân quyền: Yêu cầu quyền bookings.update theo ma trận RBAC
        if not (user.is_superuser or check_role_permission(user, 'bookings', 'update')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền thực hiện thủ tục Check-out trả phòng (Yêu cầu quyền Cập nhật đơn đặt phòng).'
            }, status=status.HTTP_403_FORBIDDEN)

        # Kiểm tra trạng thái hợp lệ để Check-out (chỉ khi đang checked_in hoặc confirmed)
        if booking.status not in ['checked_in', 'confirmed']:
            return Response({
                'success': False,
                'message': f"Đơn đặt phòng đang ở trạng thái '{booking.get_status_display()}', không thể thực hiện Check-out."
            }, status=status.HTTP_400_BAD_REQUEST)

        payment_method = request.data.get('payment_method', 'cash')
        note = request.data.get('note', '').strip()

        with transaction.atomic():
            # 1. Tính toán room_charge, total_service_charge, grand_total
            check_in = booking.check_in_date
            check_out = booking.check_out_date
            nights = max(1, (check_out - check_in).days) if (check_in and check_out) else 1

            daily_rate = 0.0
            if booking.category and booking.category.base_price:
                daily_rate = float(booking.category.promo_price or booking.category.base_price)
            elif booking.room and booking.room.category and booking.room.category.base_price:
                daily_rate = float(booking.room.category.promo_price or booking.room.category.base_price)

            room_subtotal = daily_rate * nights
            mem_discount = float(booking.membership_discount or 0)
            promo_discount = 0.0
            if booking.applied_promotion:
                if booking.applied_promotion.discount_type == 'percentage':
                    promo_discount = (room_subtotal * float(booking.applied_promotion.discount_value)) / 100.0
                    if getattr(booking.applied_promotion, 'max_discount_amount', None):
                        promo_discount = min(promo_discount, float(booking.applied_promotion.max_discount_amount))
                else:
                    promo_discount = min(room_subtotal, float(booking.applied_promotion.discount_value))
            elif getattr(booking, 'promotion_discount', None):
                promo_discount = float(booking.promotion_discount)

            pure_room_charge = max(0.0, room_subtotal - mem_discount - promo_discount)
            if pure_room_charge <= 0 and booking.total_amount:
                pre_ordered_total = sum(float(r.total_price or 0) for r in booking.service_requests.all())
                pure_room_charge = max(0.0, float(booking.total_amount) - pre_ordered_total)

            room_charge = pure_room_charge

            # Tính phí dịch vụ phát sinh & đặt trước
            valid_requests = booking.service_requests.exclude(status='cancelled').select_related('service')
            total_service_charge = float(sum(
                (req.total_price or ((req.service.price if req.service else 0) * req.quantity))
                for req in valid_requests
            ))

            import re
            for bes in booking.extra_services.all():
                raw_name = (bes.service_name or '').strip()
                if not re.search(r'\[Yêu cầu #\d+\]', raw_name, re.IGNORECASE):
                    clean_name = re.sub(r'\[.*?\]', '', raw_name).strip()
                    if not any((r.service.name if r.service else '').strip().lower() == clean_name.lower() for r in valid_requests):
                        total_service_charge += float((bes.price or 0) * (bes.quantity or 1))

            grand_total = float(room_charge + total_service_charge)

            # Xác định số tiền đã thanh toán trước và số tiền còn lại phải thu
            paid_amount = 0.0
            if hasattr(booking, 'payments'):
                completed_payments = booking.payments.filter(payment_status='COMPLETED')
                if completed_payments.exists():
                    paid_amount = float(sum(p.amount for p in completed_payments))
            if paid_amount <= 0:
                if booking.status in ['paid', 'PAID'] or (hasattr(booking, 'invoice') and booking.invoice and booking.invoice.status == 'paid'):
                    paid_amount = float(booking.total_amount or room_charge)
                elif booking.note and ('vietqr: đã thanh toán' in booking.note.lower() or 'đã thanh toán thành công' in booking.note.lower()):
                    paid_amount = float(booking.total_amount or room_charge)

            remaining_amount = max(0.0, float(grand_total - paid_amount))

            # 2. Tạo hoặc cập nhật bản ghi Invoice lưu tổng số tiền
            invoice, created = Invoice.objects.update_or_create(
                booking=booking,
                defaults={
                    'room_charge': room_charge,
                    'service_charge': total_service_charge,
                    'total_amount': grand_total,
                    'payment_method': payment_method,
                    'status': 'paid',
                    'paid_at': timezone.now()
                }
            )

            # 2.1 Đồng bộ bản ghi Payment
            method_code = 'TRANSFER' if str(payment_method).lower() in ['bank_transfer', 'momo', 'transfer', 'vietqr', 'credit_card'] else 'CASH'
            if remaining_amount > 0:
                Payment.objects.create(
                    booking=booking,
                    amount=remaining_amount,
                    payment_method=method_code,
                    payment_status='COMPLETED',
                    transaction_id=f"TXN-CHECKOUT-{invoice.invoice_code.replace('INV-', '')}"
                )
            elif not hasattr(booking, 'payments') or not booking.payments.filter(payment_status='COMPLETED').exists():
                Payment.objects.create(
                    booking=booking,
                    amount=grand_total,
                    payment_method=method_code,
                    payment_status='COMPLETED',
                    transaction_id=f"TXN-{invoice.invoice_code.replace('INV-', '')}"
                )

            # 3. Cập nhật bảng Booking: Đổi trạng thái thành completed
            booking.status = 'completed'
            now_dt = timezone.now()
            booking.actual_check_out = now_dt

            # Đồng bộ nếu Trả phòng sớm (Early Check-out)
            today_date = now_dt.date()
            if booking.check_out_date and today_date < booking.check_out_date:
                old_co = booking.check_out_date
                # Chỉ cập nhật check_out_date về today nếu today > check_in_date
                if today_date > booking.check_in_date:
                    booking.check_out_date = today_date
                early_log = f"[Trả phòng sớm {today_date.strftime('%d/%m/%Y')} (lịch cũ {old_co.strftime('%d/%m/%Y')} - {timezone.now().strftime('%H:%M')}]: Hoàn tất trả phòng sớm."
                booking.internal_note = f"{booking.internal_note}\n{early_log}".strip() if booking.internal_note else early_log

            if note:
                checkout_note = f"[Check-out: {invoice.get_payment_method_display() or payment_method} - {timezone.now().strftime('%d/%m/%Y %H:%M')}]: {note}"
                booking.internal_note = f"{booking.internal_note}\n{checkout_note}".strip() if booking.internal_note else checkout_note
            booking.save(update_fields=['status', 'actual_check_out', 'check_out_date', 'internal_note', 'updated_at'])

            # Đánh dấu toàn bộ dịch vụ của đơn sang is_paid = True khi check-out hoàn tất
            booking.service_requests.filter(is_paid=False).update(is_paid=True)
            booking.extra_services.filter(is_paid=False).update(is_paid=True)

            # 4. Cập nhật bảng Room: Đổi trạng thái phòng thành cleaning (Đang dọn dẹp)
            room_info = None
            if booking.room:
                booking.room.status = 'cleaning'
                booking.room.save(update_fields=['status'])
                room_info = {
                    'id': booking.room.id,
                    'room_number': booking.room.room_number,
                    'status': booking.room.status,
                    'status_display': booking.room.get_status_display()
                }

        # Ghi nhận Nhật ký thao tác hệ thống (Audit Log)
        log_action(
            user=request.user,
            action='UPDATE',
            module='BOOKING',
            description=f"Thực hiện Check-out đơn #{booking.booking_code} (Phòng {booking.room.room_number if booking.room else 'N/A'}). Tổng thu Folio: {grand_total:,.0f} VND",
            request=request
        )

        # Đảm bảo gửi thông báo Check-out cho Khách hàng & Nhân viên (Lễ tân, Buồng phòng, Quản lý)
        try:
            room_label = (booking.room.room_number if booking.room else None) or \
                         (booking.category.name if booking.category else "Chưa gán phòng")
            guest_name = (booking.guest.get_full_name() or booking.guest.username) if booking.guest else (booking.guest_name or "Khách hàng")

            # 1. Thông báo cho Khách hàng
            if booking.guest:
                guest_co_exists = Notification.objects.filter(
                    recipient=booking.guest,
                    title__icontains="trả phòng thành công",
                    message__icontains=booking.booking_code
                ).exists()
                if not guest_co_exists:
                    Notification.objects.create(
                        recipient=booking.guest,
                        title="Khách hàng trả phòng thành công!",
                        message=(
                            f"Quý khách đã trả phòng thành công cho {room_label} (Mã đơn: #{booking.booking_code}). "
                            f"Quý khách có thể đánh giá phòng và dịch vụ khách sạn để chia sẻ trải nghiệm kỳ nghỉ của mình nhé!"
                        )
                    )

            # 2. Thông báo cho Quản lý, Lễ tân & Buồng phòng
            staff_users = get_staff_and_admin_users(exclude_user_id=booking.guest_id if booking.guest else None)
            staff_co_exists = Notification.objects.filter(
                title__icontains="Khách đã Check-out",
                message__icontains=booking.booking_code
            ).exists()
            if not staff_co_exists:
                staff_notifications = [
                    Notification(
                        recipient=staff,
                        title=f"Khách đã Check-out: Phòng {room_label}",
                        message=(
                            f"Khách hàng {guest_name} đã làm thủ tục trả phòng {room_label} (Mã đơn: #{booking.booking_code}). "
                            f"Bộ phận buồng phòng chuẩn bị kiểm tra và làm sạch phòng."
                        )
                    )
                    for staff in staff_users
                ]
                if staff_notifications:
                    Notification.objects.bulk_create(staff_notifications)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Lỗi gửi thông báo check-out: {e}")

        serializer = self.get_serializer(booking, context={'request': request})
        return Response({
            'success': True,
            'message': f"Khách hàng trả phòng thành công và có thể đánh giá phòng dịch vụ khách sạn. Đã hoàn tất thanh toán cho phòng {booking.room.room_number if booking.room else ''}!",
            'invoice': {
                'invoice_code': invoice.invoice_code,
                'room_charge': float(invoice.room_charge),
                'service_charge': float(invoice.service_charge),
                'total_amount': float(invoice.total_amount),
                'payment_method': invoice.payment_method,
                'payment_method_display': invoice.get_payment_method_display(),
                'status': invoice.status,
                'paid_at': invoice.paid_at.isoformat() if invoice.paid_at else None
            },
            'booking': serializer.data,
            'room': room_info
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='no-show')
    def mark_no_show(self, request, pk=None):
        """
        API POST /api/bookings/{id}/no-show/
        Xử lý trường hợp khách hàng không đến nhận phòng quá giờ quy định (No-show):
        - Đổi trạng thái đơn Booking thành 'no_show'
        - (Quan trọng) Đảm bảo phòng (room_id) dự kiến gán cho khách này được giải phóng,
          trạng thái bảng Room phải chắc chắn là 'available' (Sẵn sàng) để lễ tân có thể gán cho khách Walk-in khác.
        - Ghi chú tự động vào đơn: "Hệ thống/Lễ tân đánh dấu No-show do quá giờ check-in"
        """
        booking = self.get_object()
        user = request.user

        # 1. Kiểm tra phân quyền: Yêu cầu quyền bookings.update theo ma trận RBAC
        if not (user.is_superuser or check_role_permission(user, 'bookings', 'update')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền đánh dấu đơn đặt phòng No-show (Yêu cầu quyền Cập nhật đơn đặt phòng).'
            }, status=status.HTTP_403_FORBIDDEN)

        # 2. Kiểm tra trạng thái đơn: Không cho phép no-show nếu đã checked_in, checked_out, completed
        if booking.status in ['checked_in', 'checked_out', 'completed']:
            return Response({
                'success': False,
                'message': f"Đơn đặt phòng đang ở trạng thái '{booking.get_status_display()}', không thể đánh dấu No-show."
            }, status=status.HTTP_400_BAD_REQUEST)

        if booking.status == 'no_show':
            return Response({
                'success': False,
                'message': f"Đơn đặt phòng {booking.booking_code} đã được đánh dấu No-show trước đó."
            }, status=status.HTTP_400_BAD_REQUEST)

        if booking.status == 'cancelled':
            return Response({
                'success': False,
                'message': f"Đơn đặt phòng {booking.booking_code} đã bị hủy bỏ trước đó."
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Kiểm tra ngày nhận phòng: Chưa tới ngày check-in không được phép đánh dấu No-show
        today = timezone.localdate()
        if booking.check_in_date and today < booking.check_in_date:
            formatted_date = booking.check_in_date.strftime('%d/%m/%Y')
            return Response({
                'success': False,
                'message': (
                    f"Chưa tới ngày nhận phòng ({formatted_date}). Theo quy định khách sạn, "
                    f"chỉ được đánh dấu No-show từ ngày nhận phòng trở đi. "
                    f"Nếu khách báo trước không đến, vui lòng thực hiện thao tác 'Hủy đơn'."
                )
            }, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '').strip()
        now = timezone.now()
        staff_name = user.get_full_name() or user.username
        time_str = now.strftime('%H:%M • %d/%m/%Y')

        with transaction.atomic():
            # 1. Đổi trạng thái (status) của đơn Booking thành no_show
            booking.status = 'no_show'

            # 2. Ghi chú tự động vào đơn
            auto_log = f"[No-show lúc {time_str} bởi {staff_name}]: Hệ thống/Lễ tân đánh dấu No-show do quá giờ check-in."
            if reason:
                auto_log += f" Lý do: {reason}"

            if booking.internal_note:
                booking.internal_note = f"{booking.internal_note}\n{auto_log}".strip()
            else:
                booking.internal_note = auto_log

            # 3. (Quan trọng) Đảm bảo phòng (room_id) dự kiến gán cho khách này được giải phóng,
            # trạng thái bảng Room chắc chắn là available (Sẵn sàng) để bán cho khách Walk-in khác.
            released_room = None
            if booking.room:
                released_room = booking.room
                if released_room.status != 'available':
                    released_room.status = 'available'
                    released_room.save(update_fields=['status'])

            booking.save(update_fields=['status', 'internal_note', 'updated_at'])

        serializer = self.get_serializer(booking, context={'request': request})
        from ..rooms.serializers import RoomSerializer
        room_data = RoomSerializer(released_room).data if released_room else None

        # Ghi nhận Nhật ký thao tác hệ thống (Audit Log)
        log_action(
            user=request.user,
            action='UPDATE',
            module='BOOKING',
            description=f"Đánh dấu Khách không đến (No-show) cho đơn #{booking.booking_code}",
            request=request
        )

        room_msg = f" Đã giải phóng phòng {released_room.room_number} về trạng thái Sẵn sàng (Available)." if released_room else ""
        return Response({
            'success': True,
            'message': f'Đã đánh dấu đơn đặt phòng {booking.booking_code} là Khách không đến (No-show) thành công!{room_msg}',
            'booking': serializer.data,
            'room': room_data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='extend-stay')
    def extend_stay(self, request, pk=None):
        """
        API POST /api/bookings/{id}/extend-stay/
        Tính năng Gia hạn thời gian lưu trú (Extend Stay) cho khách đang ở (checked_in):
        1. Quyền: Lễ tân / Quản lý HOẶC chính khách hàng sở hữu đơn.
        2. Trạng thái: Bắt buộc booking.status == 'checked_in'.
        3. Ngày gia hạn: new_check_out_date phải hợp lệ và lớn hơn check_out_date hiện tại.
        4. Kiểm tra phòng: Bắt buộc booking.room_id.
        5. Kiểm tra xung đột (Conflict Check):
           Từ check_out_date (cũ) đến new_check_out_date, phòng này có đơn nào khác (confirmed hoặc checked_in) đang giữ không.
           Nếu CÓ xung đột -> HTTP 400: "Gia hạn thất bại. Phòng này đã có khách khác đặt trước trong khoảng thời gian trên."
        6. Tính tiền & Cập nhật:
           extra_nights = (new_check_out_date - old_check_out_date).days
           extra_amount = extra_nights * nightly_rate
           check_out_date = new_check_out_date
           total_amount = total_amount + extra_amount
        7. Gửi thông báo Notification cho khách (nếu Lễ tân làm) hoặc cho Lễ tân (nếu Khách tự làm).
        """
        booking = self.get_object()
        user = request.user

        # 1. Kiểm tra phân quyền truy cập
        is_staff_or_admin = bool(
            user.is_authenticated and (
                user.is_superuser or 
                user.is_staff or
                check_role_permission(user, 'bookings', 'update')
            )
        )
        can_extend_staff = is_staff_or_admin
        is_owner_guest = bool(user.is_authenticated and (booking.guest_id == user.id))

        if not (is_staff_or_admin or is_owner_guest):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền gia hạn lưu trú cho đơn đặt phòng này (Yêu cầu quyền Cập nhật đơn đặt phòng).'
            }, status=status.HTTP_403_FORBIDDEN)

        # 2. Kiểm tra trạng thái: Bắt buộc phải là 'checked_in'
        if booking.status != 'checked_in':
            return Response({
                'success': False,
                'message': f"Chỉ có thể gia hạn cho đơn đặt phòng đang có khách ở (Checked-in). Trạng thái hiện tại: {booking.get_status_display()}."
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Lấy và kiểm tra payload new_check_out_date
        new_date_str = request.data.get('new_check_out_date')
        if not new_date_str:
            return Response({
                'success': False,
                'message': 'Vui lòng chọn ngày trả phòng mới (new_check_out_date).'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_check_out_date = datetime.strptime(str(new_date_str).strip(), '%Y-%m-%d').date()
        except ValueError:
            return Response({
                'success': False,
                'message': 'Định dạng ngày trả phòng không hợp lệ (Chuẩn YYYY-MM-DD).'
            }, status=status.HTTP_400_BAD_REQUEST)

        old_check_out_date = booking.check_out_date
        if new_check_out_date <= old_check_out_date:
            return Response({
                'success': False,
                'message': f"Ngày gia hạn mới ({new_check_out_date.strftime('%d/%m/%Y')}) phải sau ngày trả phòng hiện tại ({old_check_out_date.strftime('%d/%m/%Y')})."
            }, status=status.HTTP_400_BAD_REQUEST)

        # 4. Kiểm tra phòng thực tế
        if not booking.room:
            return Response({
                'success': False,
                'message': 'Đơn đặt phòng chưa được gán phòng thực tế trong hệ thống.'
            }, status=status.HTTP_400_BAD_REQUEST)

        room = booking.room

        # 5. Logic kiểm tra xung đột (Conflict Check):
        # Truy vấn xem từ check_out_date (cũ) đến new_check_out_date có bất kỳ đơn Đặt phòng nào khác (trạng thái confirmed hoặc checked_in) đang giữ room_id này không
        conflict_query = Booking.objects.filter(
            room=room,
            status__in=['confirmed', 'checked_in']
        ).exclude(id=booking.id).filter(
            check_in_date__lt=new_check_out_date,
            check_out_date__gt=old_check_out_date
        )

        if conflict_query.exists():
            conflicting_booking = conflict_query.first()
            conflict_info = f" (Đơn #{conflicting_booking.booking_code}: {conflicting_booking.check_in_date.strftime('%d/%m/%Y')} - {conflicting_booking.check_out_date.strftime('%d/%m/%Y')})"
            return Response({
                'success': False,
                'conflict': True,
                'conflicting_booking_code': conflicting_booking.booking_code,
                'message': f"Gia hạn thất bại. Phòng này đã có khách khác đặt trước trong khoảng thời gian trên.{conflict_info if is_staff_or_admin else ''}"
            }, status=status.HTTP_400_BAD_REQUEST)

        # 6. Tính số đêm phát sinh & số tiền phát sinh
        extra_nights = (new_check_out_date - old_check_out_date).days
        cat = booking.category or room.category
        if cat:
            nightly_rate = cat.promo_price or cat.base_price or Decimal(0)
        else:
            old_nights = max((old_check_out_date - booking.check_in_date).days, 1)
            nightly_rate = Decimal(booking.total_amount) / Decimal(old_nights) if booking.total_amount else Decimal(0)

        extra_amount = Decimal(extra_nights) * Decimal(nightly_rate)

        with transaction.atomic():
            # Cập nhật booking
            booking.check_out_date = new_check_out_date
            booking.total_amount = Decimal(booking.total_amount) + extra_amount
            
            actor_name = user.get_full_name() or user.username
            actor_role_label = "Lễ tân/Quản lý" if is_staff_or_admin else "Khách hàng"
            log_note = (
                f"\n[{timezone.now().strftime('%d/%m/%Y %H:%M')}] Gia hạn lưu trú thêm {extra_nights} đêm "
                f"đến {new_check_out_date.strftime('%d/%m/%Y')} (+{extra_amount:,.0f} VND) bởi {actor_role_label}: {actor_name}."
            )
            booking.internal_note = (booking.internal_note or '') + log_note
            booking.save()

            # Đồng bộ hóa đơn (Invoice) nếu đã có
            if hasattr(booking, 'invoice') and booking.invoice:
                inv = booking.invoice
                inv.room_charge = Decimal(inv.room_charge or 0) + extra_amount
                inv.total_amount = Decimal(inv.total_amount or 0) + extra_amount
                inv.save()

            # 7. Sinh thông báo Notification
            date_display_str = new_check_out_date.strftime('%d/%m/%Y')
            guest_name_str = booking.guest.get_full_name() or booking.guest.username if booking.guest else "Khách hàng"
            room_label_str = f"Phòng {room.room_number}" if room else "Phòng đã đặt"

            if is_staff_or_admin:
                # Lễ tân làm -> Thông báo cho Khách hàng
                if booking.guest:
                    Notification.objects.create(
                        recipient=booking.guest,
                        title=f"Gia hạn lưu trú thành công #{booking.booking_code}",
                        message=(
                            f"Đơn đặt phòng #{booking.booking_code} ({room_label_str}) của quý khách đã được gia hạn "
                            f"đến ngày {date_display_str} (thêm {extra_nights} đêm, chi phí phát sinh: {extra_amount:,.0f} VND). "
                            f"Khách sạn TA chúc quý khách tiếp tục có kỳ nghỉ tuyệt vời!"
                        )
                    )
            else:
                # Khách tự làm trên web -> Thông báo cho Lễ tân / Nhân sự
                staff_users = get_staff_and_admin_users(exclude_user_id=booking.guest_id)
                staff_notifs = [
                    Notification(
                        recipient=staff,
                        title=f"Khách gia hạn phòng: #{booking.booking_code}",
                        message=(
                            f"Khách hàng {guest_name_str} ({room_label_str}) vừa gia hạn lưu trú trên website "
                            f"đến ngày {date_display_str} (thêm {extra_nights} đêm, phát sinh: {extra_amount:,.0f} VND). "
                            f"Vui lòng kiểm tra trên PMS."
                        )
                    )
                    for staff in staff_users
                ]
                if staff_notifs:
                    Notification.objects.bulk_create(staff_notifs)

                # Đồng thời gửi thông báo xác nhận cho chính khách hàng
                if booking.guest:
                    Notification.objects.create(
                        recipient=booking.guest,
                        title=f"Gia hạn phòng thành công #{booking.booking_code}",
                        message=(
                            f"Yêu cầu gia hạn lưu trú #{booking.booking_code} ({room_label_str}) đến ngày {date_display_str} "
                            f"đã được hệ thống xác nhận thành công. Số tiền phát sinh: {extra_amount:,.0f} VND."
                        )
                    )

        # Ghi nhận Nhật ký thao tác hệ thống (Audit Log)
        log_action(
            user=user,
            action='UPDATE',
            module='BOOKING',
            description=f"Gia hạn lưu trú đơn #{booking.booking_code} thêm {extra_nights} đêm đến {new_check_out_date.strftime('%d/%m/%Y')} (+{extra_amount:,.0f} VND)",
            request=request
        )

        serializer = BookingSerializer(booking, context={'request': request})
        return Response({
            'success': True,
            'message': f"Gia hạn lưu trú thành công đến ngày {new_check_out_date.strftime('%d/%m/%Y')} (Thêm {extra_nights} đêm).",
            'extra_nights': extra_nights,
            'extra_amount': float(extra_amount),
            'new_check_out_date': str(new_check_out_date),
            'new_total_amount': float(booking.total_amount),
            'booking': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='check-in-today')
    def check_in_today(self, request):
        """
        API GET /api/bookings/check-in-today/
        Lấy các đơn có check_in_date là hôm nay và chưa check-in:
        - check_in_date == timezone.localdate()
        - status chưa check-in (pending, confirmed)
        """
        today = timezone.localdate()
        qs = Booking.objects.select_related(
            'guest', 'category', 'room', 'room__category', 'applied_promotion'
        ).prefetch_related(
            'extra_services', 'service_requests'
        ).filter(
            check_in_date=today,
            status__in=['pending', 'paid', 'PAID', 'confirmed']
        ).order_by('status', '-created_at')

        serializer = BookingSerializer(qs, many=True, context={'request': request})
        return Response({
            'success': True,
            'count': qs.count(),
            'date': today.isoformat(),
            'data': serializer.data,
            'results': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='check-out-today')
    def check_out_today(self, request):
        """
        API GET /api/bookings/check-out-today/
        Lấy các đơn có check_out_date là hôm nay và đang ở trạng thái checked_in:
        - check_out_date == timezone.localdate()
        - status == 'checked_in'
        """
        today = timezone.localdate()
        qs = Booking.objects.select_related(
            'guest', 'category', 'room', 'room__category', 'applied_promotion'
        ).prefetch_related(
            'extra_services', 'service_requests'
        ).filter(
            check_out_date=today,
            status='checked_in'
        ).order_by('-created_at')

        serializer = BookingSerializer(qs, many=True, context={'request': request})
        return Response({
            'success': True,
            'count': qs.count(),
            'date': today.isoformat(),
            'data': serializer.data,
            'results': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='timeline')
    def timeline(self, request):
        """
        API GET /api/bookings/timeline/?month=6&year=2026
        Trả về danh sách tất cả các Phòng (Rooms), và bên trong mỗi Phòng lồng ghép
        danh sách các Đơn đặt phòng (Bookings) diễn ra trong tháng đó để Frontend dễ dàng vẽ biểu đồ.
        """
        import calendar
        import datetime
        from collections import defaultdict

        today = timezone.localdate()
        month_param = request.query_params.get('month')
        year_param = request.query_params.get('year')

        try:
            month = int(month_param) if month_param else today.month
            year = int(year_param) if year_param else today.year
            if not (1 <= month <= 12):
                month = today.month
            if not (2000 <= year <= 2100):
                year = today.year
        except (ValueError, TypeError):
            month = today.month
            year = today.year

        _, num_days = calendar.monthrange(year, month)
        month_start = datetime.date(year, month, 1)
        month_end = datetime.date(year, month, num_days)

        # 1. Lấy tất cả các phòng thực tế (Room)
        rooms = Room.objects.select_related('category').all().order_by('floor', 'room_number')

        # 2. Lấy tất cả các đơn đặt phòng diễn ra trong tháng đó (check_in_date <= month_end AND check_out_date >= month_start)
        # Loại bỏ các đơn đã hủy (cancelled) hoặc vắng mặt (no_show) vì không chiếm dụng phòng trên sơ đồ
        month_bookings = Booking.objects.select_related(
            'guest', 'category', 'room', 'room__category'
        ).prefetch_related(
            'service_requests__service', 'extra_services'
        ).filter(
            check_in_date__lte=month_end,
            check_out_date__gte=month_start
        ).exclude(
            status__in=['cancelled', 'no_show']
        ).order_by('check_in_date')

        # Gom nhóm booking theo room_id
        bookings_by_room = defaultdict(list)
        unassigned_bookings = []

        import re
        for b in month_bookings:
            guest_name = ''
            if b.guest:
                guest_name = b.guest.get_full_name() or b.guest.username
            if not guest_name:
                guest_name = 'Khách vãng lai'

            # Tính tiền dịch vụ phát sinh (ServiceRequest completed + BookingExtraService)
            service_total = 0.0
            seen_services = set()
            for req in b.service_requests.all():
                if req.status == 'completed':
                    clean_name = (req.service.name if req.service else 'Dịch vụ phòng').strip()
                    price = float(req.service.price if req.service else 0)
                    qty = req.quantity or 1
                    tot = float(req.total_price or (price * qty))
                    seen_services.add((clean_name.lower(), qty, tot))
                    service_total += tot

            for bes in b.extra_services.all():
                raw_name = (bes.service_name or '').strip()
                if re.search(r'\[Yêu cầu #\d+\]', raw_name, re.IGNORECASE):
                    continue
                clean_name = re.sub(r'\(x\d+\)', '', raw_name)
                clean_name = re.sub(r'\[.*?\]', '', clean_name).strip()
                qty = bes.quantity or 1
                price = float(bes.price or 0)
                tot = float(price * qty)
                sig = (clean_name.lower(), qty, tot)
                if sig in seen_services:
                    continue
                service_total += tot

            room_amount = float(b.total_amount or 0)
            grand_total = room_amount + service_total

            booking_item = {
                'id': b.id,
                'booking_code': b.booking_code,
                'guest_name': guest_name,
                'guest_phone': getattr(b.guest, 'phone_number', '') if b.guest else '',
                'guest_email': getattr(b.guest, 'email', '') if b.guest else '',
                'identity_card': b.identity_card,
                'category_id': b.category_id,
                'category_name': b.category.name if b.category else (b.room.category.name if b.room and b.room.category else ''),
                'room_id': b.room_id,
                'room_number': b.room.room_number if b.room else None,
                'check_in_date': b.check_in_date.isoformat(),
                'check_out_date': b.check_out_date.isoformat(),
                'actual_check_in': b.actual_check_in.isoformat() if b.actual_check_in else None,
                'actual_check_out': b.actual_check_out.isoformat() if b.actual_check_out else None,
                'status': b.status,
                'status_display': b.get_status_display(),
                'room_amount': room_amount,
                'service_amount': service_total,
                'total_amount': grand_total,
                'grand_total_amount': grand_total,
                'nights': (b.check_out_date - b.check_in_date).days,
                'note': b.note or '',
                'internal_note': b.internal_note or ''
            }

            if b.room_id:
                bookings_by_room[b.room_id].append(booking_item)
            else:
                unassigned_bookings.append(booking_item)

        # 3. Lồng ghép danh sách booking vào từng phòng
        rooms_data = []
        for r in rooms:
            rooms_data.append({
                'id': r.id,
                'room_number': r.room_number,
                'floor': r.floor,
                'status': r.status,
                'status_display': r.get_status_display(),
                'category': {
                    'id': r.category.id if r.category else None,
                    'name': r.category.name if r.category else 'Tiêu chuẩn',
                    'base_price': float(r.category.base_price) if r.category and r.category.base_price else 0,
                    'bed_type': r.category.bed_type if r.category else ''
                } if r.category else None,
                'category_name': r.category.name if r.category else 'Tiêu chuẩn',
                'bookings': bookings_by_room.get(r.id, [])
            })

        return Response({
            'success': True,
            'month': month,
            'year': year,
            'days_in_month': num_days,
            'month_start': month_start.isoformat(),
            'month_end': month_end.isoformat(),
            'rooms': rooms_data,
            'unassigned_bookings': unassigned_bookings,
            'total_rooms': len(rooms_data),
            'total_bookings': month_bookings.count()
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='dashboard-stats')
    def dashboard_stats(self, request):
        """
        API GET /api/bookings/dashboard-stats/?time_filter=month
        Cung cấp toàn bộ dữ liệu thống kê thực tế, đồng bộ thời gian thực cho trang Tổng quan Admin Dashboard:
        - Doanh thu thực tế (theo thời gian: hôm nay, 7 ngày, tháng này, năm nay) & tăng trưởng so với kỳ trước
        - Thống kê công suất phòng thực tế & cơ cấu phòng (occupied, available, cleaning, maintenance)
        - Tỷ lệ lấp đầy theo từng hạng phòng thực tế
        - Thống kê đơn đặt phòng & cơ cấu đặt phòng / nguồn đặt phòng
        - Thống kê yêu cầu dịch vụ phòng & danh sách dịch vụ nóng (Concierge)
        """
        import calendar
        from datetime import datetime, timedelta
        from django.db.models import Sum, Count, Q, Case, When, Value, IntegerField

        today = timezone.localdate()
        now = timezone.now()
        time_filter = request.query_params.get('time_filter', 'month').strip().lower()
        if time_filter not in ['today', '7days', 'month', 'year']:
            time_filter = 'month'

        # 1. Xác định khoảng thời gian hiện tại và kỳ trước (để so sánh tăng trưởng)
        if time_filter == 'today':
            start_date = timezone.make_aware(datetime.combine(today, datetime.min.time()))
            end_date = timezone.make_aware(datetime.combine(today, datetime.max.time()))
            period_label = f"Hôm nay ({today.strftime('%d/%m/%Y')})"
            target_label = "Mục tiêu ngày"
            target_revenue = 10000000.0  # 10 triệu

            prev_start = start_date - timedelta(days=1)
            prev_end = start_date - timedelta(microseconds=1)
            prev_label = "so với hôm qua"

        elif time_filter == '7days':
            start_date = timezone.make_aware(datetime.combine(today - timedelta(days=6), datetime.min.time()))
            end_date = timezone.make_aware(datetime.combine(today, datetime.max.time()))
            period_label = "7 ngày qua"
            target_label = "Mục tiêu tuần"
            target_revenue = 50000000.0  # 50 triệu

            prev_start = start_date - timedelta(days=7)
            prev_end = start_date - timedelta(microseconds=1)
            prev_label = "so với 7 ngày trước"

        elif time_filter == 'year':
            start_date = timezone.make_aware(datetime.combine(datetime(today.year, 1, 1).date(), datetime.min.time()))
            end_date = timezone.make_aware(datetime.combine(datetime(today.year, 12, 31).date(), datetime.max.time()))
            period_label = f"Năm {today.year}"
            target_label = f"Mục tiêu năm {today.year}"
            target_revenue = 500000000.0  # 500 triệu

            prev_start = timezone.make_aware(datetime.combine(datetime(today.year - 1, 1, 1).date(), datetime.min.time()))
            prev_end = timezone.make_aware(datetime.combine(datetime(today.year - 1, 12, 31).date(), datetime.max.time()))
            prev_label = "so với năm trước"

        else:  # 'month'
            _, days_in_month = calendar.monthrange(today.year, today.month)
            start_date = timezone.make_aware(datetime.combine(today.replace(day=1), datetime.min.time()))
            end_date = timezone.make_aware(datetime.combine(today.replace(day=days_in_month), datetime.max.time()))
            period_label = f"Tháng {today.month:02d}/{today.year}"
            target_label = f"Mục tiêu Tháng {today.month:02d}"
            target_revenue = 50000000.0  # 50 triệu

            if today.month == 1:
                prev_m, prev_y = 12, today.year - 1
            else:
                prev_m, prev_y = today.month - 1, today.year
            _, prev_days = calendar.monthrange(prev_y, prev_m)
            prev_start = timezone.make_aware(datetime.combine(datetime(prev_y, prev_m, 1).date(), datetime.min.time()))
            prev_end = timezone.make_aware(datetime.combine(datetime(prev_y, prev_m, prev_days).date(), datetime.max.time()))
            prev_label = "so với tháng trước"

        # 2. TÍNH TOÁN DOANH THU THỰC TẾ
        # Hóa đơn thanh toán trong kỳ (Invoice status='paid')
        invoices_period = Invoice.objects.filter(
            status='paid',
            paid_at__gte=start_date,
            paid_at__lte=end_date
        )
        inv_agg = invoices_period.aggregate(
            total=Sum('total_amount'),
            room=Sum('room_charge'),
            service=Sum('service_charge'),
            discount=Sum('discount')
        )
        current_inv_revenue = float(inv_agg['total'] or 0)
        current_room_revenue = float(inv_agg['room'] or 0)
        current_service_revenue = float(inv_agg['service'] or 0)
        paid_invoices_count = invoices_period.count()

        # Kiểm tra thêm nếu có đơn đặt phòng completed trong kỳ nhưng chưa có invoice
        completed_bookings_period = Booking.objects.filter(
            status='completed',
            invoice__isnull=True
        ).filter(
            Q(actual_check_out__gte=start_date, actual_check_out__lte=end_date) |
            Q(actual_check_out__isnull=True, updated_at__gte=start_date, updated_at__lte=end_date)
        )
        comp_agg = completed_bookings_period.aggregate(total=Sum('total_amount'))
        extra_room_rev = float(comp_agg['total'] or 0)
        current_room_revenue += extra_room_rev
        current_revenue = current_inv_revenue + extra_room_rev

        # Doanh thu kỳ trước
        prev_invoices = Invoice.objects.filter(
            status='paid',
            paid_at__gte=prev_start,
            paid_at__lte=prev_end
        )
        prev_inv_agg = prev_invoices.aggregate(total=Sum('total_amount'))
        prev_extra = float(Booking.objects.filter(
            status='completed',
            invoice__isnull=True
        ).filter(
            Q(actual_check_out__gte=prev_start, actual_check_out__lte=prev_end) |
            Q(actual_check_out__isnull=True, updated_at__gte=prev_start, updated_at__lte=prev_end)
        ).aggregate(total=Sum('total_amount'))['total'] or 0)
        prev_revenue = float(prev_inv_agg['total'] or 0) + prev_extra

        # Tính tỷ lệ tăng trưởng
        if prev_revenue > 0:
            growth_rate = round(((current_revenue - prev_revenue) / prev_revenue) * 100, 1)
        elif current_revenue > 0:
            growth_rate = 100.0
        else:
            growth_rate = 0.0

        achievement_rate = min(100.0, round((current_revenue / target_revenue) * 100, 1)) if target_revenue > 0 else 0.0

        # 3. CÔNG SUẤT PHÒNG THỰC TẾ (PMS Rooms)
        all_rooms = Room.objects.select_related('category').all()
        total_rooms = all_rooms.count()
        occupied_rooms = all_rooms.filter(status='occupied').count()
        available_rooms = all_rooms.filter(status='available').count()
        cleaning_rooms = all_rooms.filter(status='cleaning').count()
        maintenance_rooms = all_rooms.filter(status='maintenance').count()

        occupancy_rate = round((occupied_rooms / total_rooms) * 100, 1) if total_rooms > 0 else 0.0

        # 4. TỶ LỆ LẤP ĐẦY THEO HẠNG PHÒNG THỰC TẾ (Category Occupancy Breakdown)
        categories = RoomCategory.objects.prefetch_related('rooms').all().order_by('base_price')
        category_breakdown = []
        palette = ['#2563eb', '#3b82f6', '#f97316', '#0ea5e9', '#8b5cf6', '#10b981']

        for idx, cat in enumerate(categories):
            cat_rooms = cat.rooms.all()
            cat_total = cat_rooms.count()
            cat_occupied = cat_rooms.filter(status='occupied').count()
            cat_available = cat_rooms.filter(status='available').count()
            cat_cleaning = cat_rooms.filter(status='cleaning').count()
            cat_maintenance = cat_rooms.filter(status='maintenance').count()
            cat_rate = round((cat_occupied / cat_total) * 100, 1) if cat_total > 0 else 0.0

            category_breakdown.append({
                'id': cat.id,
                'name': cat.name,
                'total_rooms': cat_total,
                'occupied_rooms': cat_occupied,
                'available_rooms': cat_available,
                'cleaning_rooms': cat_cleaning,
                'maintenance_rooms': cat_maintenance,
                'occupancy_rate': cat_rate,
                'base_price': float(cat.base_price or 0),
                'color': palette[idx % len(palette)]
            })

        # 5. THỐNG KÊ ĐƠN ĐẶT PHÒNG THỰC TẾ
        all_bookings = Booking.objects.all()
        total_bookings = all_bookings.count()
        pending_count = all_bookings.filter(status__in=['pending', 'paid', 'PAID']).count()
        confirmed_count = all_bookings.filter(status='confirmed').count()
        checked_in_count = all_bookings.filter(status='checked_in').count()
        completed_count = all_bookings.filter(status='completed').count()
        cancelled_count = all_bookings.filter(status='cancelled').count()
        no_show_count = all_bookings.filter(status='no_show').count()

        today_check_in = all_bookings.filter(
            check_in_date=today,
            status__in=['pending', 'paid', 'PAID', 'confirmed']
        ).count()
        today_check_out = all_bookings.filter(
            check_out_date=today,
            status='checked_in'
        ).count()

        # Cơ cấu đặt phòng (Booking breakdown / source)
        walkin_filter = (
            Q(guest__username__startswith='walkin_') |
            Q(guest__email__icontains='walkin') |
            Q(note__icontains='walk-in') |
            Q(internal_note__icontains='walk-in') |
            Q(note__icontains='quầy') |
            Q(internal_note__icontains='quầy')
        )
        walkin_count = all_bookings.filter(walkin_filter).distinct().count()
        promo_count = all_bookings.filter(applied_promotion__isnull=False).exclude(walkin_filter).distinct().count()
        direct_count = max(0, total_bookings - promo_count - walkin_count)
        if direct_count == 0 and total_bookings > 0 and promo_count == 0 and walkin_count == 0:
            direct_count = total_bookings

        def calc_pct(count, total):
            return round((count / total) * 100, 1) if total > 0 else 0.0

        booking_sources = [
            {
                'source': 'Website trực tuyến',
                'count': direct_count,
                'percentage': calc_pct(direct_count, total_bookings),
                'color': '#2563eb'
            },
            {
                'source': 'Tại quầy Lễ tân (Walk-in)',
                'count': walkin_count,
                'percentage': calc_pct(walkin_count, total_bookings),
                'color': '#0f172a'
            },
            {
                'source': 'Ưu đãi & Voucher',
                'count': promo_count,
                'percentage': calc_pct(promo_count, total_bookings),
                'color': '#f97316'
            }
        ]

        status_distribution = [
            {'status': 'completed', 'label': 'Đã hoàn tất', 'count': completed_count, 'percentage': calc_pct(completed_count, total_bookings), 'color': '#8b5cf6'},
            {'status': 'checked_in', 'label': 'Đang lưu trú', 'count': checked_in_count, 'percentage': calc_pct(checked_in_count, total_bookings), 'color': '#10b981'},
            {'status': 'confirmed', 'label': 'Đã xác nhận', 'count': confirmed_count, 'percentage': calc_pct(confirmed_count, total_bookings), 'color': '#3b82f6'},
            {'status': 'pending', 'label': 'Chờ duyệt', 'count': pending_count, 'percentage': calc_pct(pending_count, total_bookings), 'color': '#f59e0b'},
        ]

        # 6. YÊU CẦU DỊCH VỤ PHÒNG & CONCIERGE DỊCH VỤ NÓNG
        all_service_requests = ServiceRequest.objects.select_related(
            'booking', 'booking__room', 'booking__guest', 'service', 'service__category'
        ).all()
        total_requests = all_service_requests.count()
        pending_requests_count = all_service_requests.filter(status='pending').count()
        in_progress_requests_count = all_service_requests.filter(status='in_progress').count()
        completed_requests_count = all_service_requests.filter(status='completed').count()
        cancelled_requests_count = all_service_requests.filter(status='cancelled').count()
        total_service_sales = float(sum(float(sr.total_price or 0) for sr in all_service_requests.filter(status='completed')))

        # Danh sách dịch vụ nóng (ưu tiên pending, in_progress & delivering)
        status_order = Case(
            When(status='pending', then=Value(1)),
            When(status='in_progress', then=Value(2)),
            When(status='delivering', then=Value(3)),
            When(status='completed', then=Value(4)),
            default=Value(5),
            output_field=IntegerField()
        )
        recent_requests_qs = all_service_requests.order_by(status_order, '-created_at')[:6]
        recent_service_requests = []
        for sr in recent_requests_qs:
            r_num = sr.booking.room.room_number if sr.booking and sr.booking.room else None
            g_name = sr.booking.guest.get_full_name() or sr.booking.guest.username if sr.booking and sr.booking.guest else (sr.booking.guest_name if hasattr(sr.booking, 'guest_name') else 'Khách')
            cat_name = sr.service.category.name if sr.service and sr.service.category else 'Dịch vụ'

            time_str = sr.created_at.strftime('%H:%M') if sr.created_at else ''
            datetime_str = sr.created_at.strftime('%H:%M • %d/%m') if sr.created_at else ''

            recent_service_requests.append({
                'id': sr.id,
                'service_name': sr.service.name if sr.service else 'Dịch vụ phòng',
                'category_name': cat_name,
                'room_number': r_num or 'Chờ gán',
                'guest_name': g_name,
                'quantity': sr.quantity,
                'total_price': float(sr.total_price or 0),
                'status': sr.status,
                'status_display': sr.get_status_display(),
                'note': sr.note or '',
                'time_str': time_str,
                'datetime_str': datetime_str,
                'created_at': sr.created_at.isoformat() if sr.created_at else None
            })

        return Response({
            'success': True,
            'time_filter': time_filter,
            'period_label': period_label,
            'revenue': {
                'total_revenue': current_revenue,
                'room_revenue': current_room_revenue,
                'service_revenue': current_service_revenue,
                'paid_invoices_count': paid_invoices_count,
                'previous_revenue': prev_revenue,
                'growth_rate': growth_rate,
                'growth_label': prev_label,
                'target_label': target_label,
                'target_revenue': target_revenue,
                'achievement_rate': achievement_rate
            },
            'occupancy': {
                'total_rooms': total_rooms,
                'occupied_rooms': occupied_rooms,
                'available_rooms': available_rooms,
                'cleaning_rooms': cleaning_rooms,
                'maintenance_rooms': maintenance_rooms,
                'occupancy_rate': occupancy_rate,
                'category_breakdown': category_breakdown
            },
            'bookings': {
                'total_bookings': total_bookings,
                'pending_count': pending_count,
                'confirmed_count': confirmed_count,
                'checked_in_count': checked_in_count,
                'completed_count': completed_count,
                'cancelled_count': cancelled_count,
                'no_show_count': no_show_count,
                'today_check_in': today_check_in,
                'today_check_out': today_check_out,
                'booking_sources': booking_sources,
                'status_distribution': status_distribution
            },
            'services': {
                'total_requests': total_requests,
                'pending_count': pending_requests_count,
                'in_progress_count': in_progress_requests_count,
                'completed_count': completed_requests_count,
                'cancelled_count': cancelled_requests_count,
                'total_sales': total_service_sales,
                'recent_requests': recent_service_requests
            }
        }, status=status.HTTP_200_OK)


class ValidatePromoCodeView(APIView):
    """
    API kiểm tra và áp dụng mã giảm giá trực tiếp:
    POST /api/bookings/validate-promo/
    Payload: { "code": "WELCOME10", "order_value": 3600000 }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        code = request.data.get('code', '').strip().upper()
        order_value = float(request.data.get('order_value', 0))

        if not code:
            return Response({
                'valid': False,
                'message': 'Vui lòng nhập mã giảm giá.'
            }, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        promo = Promotion.objects.filter(
            code=code,
            is_active=True,
            valid_from__lte=now,
            valid_to__gte=now
        ).first()

        if not promo:
            # Hỗ trợ một số mã mặc định nếu chưa setup trong DB
            if code in ['WELCOME10', 'VIP10', 'SUMMER2026', 'TADANANG']:
                discount_val = 10  # 10%
                discount_amount = (order_value * discount_val) / 100
                return Response({
                    'valid': True,
                    'code': code,
                    'discount_type': 'percentage',
                    'discount_value': 10,
                    'discount_amount': discount_amount,
                    'message': f'Áp dụng mã {code} thành công! Giảm 10% tổng tiền phòng.'
                }, status=status.HTTP_200_OK)

            return Response({
                'valid': False,
                'message': f'Mã khuyến mãi "{code}" không tồn tại hoặc đã hết hạn sử dụng.'
            }, status=status.HTTP_404_NOT_FOUND)

        if promo.used_count >= promo.usage_limit:
            return Response({
                'valid': False,
                'message': f'Mã khuyến mãi "{code}" đã vượt quá số lượt sử dụng tối đa.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if order_value < promo.min_order_value:
            return Response({
                'valid': False,
                'message': f'Đơn hàng tối thiểu để áp dụng mã này là {promo.min_order_value:,.0f} VND.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Tính toán giá trị giảm
        if promo.discount_type == 'percentage':
            discount_amount = (order_value * float(promo.discount_value)) / 100
            if promo.max_discount_amount:
                discount_amount = min(discount_amount, float(promo.max_discount_amount))
        else:
            discount_amount = min(order_value, float(promo.discount_value))

        return Response({
            'valid': True,
            'code': promo.code,
            'discount_type': promo.discount_type,
            'discount_value': float(promo.discount_value),
            'discount_amount': discount_amount,
            'message': f'Áp dụng mã {promo.code} thành công! Tiết kiệm {discount_amount:,.0f} VND.'
        }, status=status.HTTP_200_OK)


class IsManagerOrAdminOnly(BasePermission):
    """
    Chỉ cho phép cấp Quản lý trở lên (admin, owner, manager) cấu hình khuyến mãi/voucher.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        return getattr(request.user, 'role', '') in ['admin', 'owner', 'manager']


class PromotionViewSet(viewsets.ModelViewSet):
    """
    CRUD Quản lý Khuyến mãi / Voucher cho Admin:
    - GET /api/bookings/promotions/ (hoặc /api/promotions/): Danh sách voucher
    - POST /api/bookings/promotions/: Thêm voucher mới
    - PUT /api/bookings/promotions/<id>/: Cập nhật voucher
    - DELETE /api/bookings/promotions/<id>/: Xóa voucher
    """
    queryset = Promotion.objects.all().order_by('-id')
    serializer_class = PromotionSerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsManagerOrAdminOnly()]

    def perform_create(self, serializer):
        instance = serializer.save()
        log_action(
            user=self.request.user,
            action='CREATE',
            module='PROMOTION',
            description=f'Tạo mã khuyến mãi mới "{instance.code}" (Giảm {instance.discount_value})',
            request=self.request
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        log_action(
            user=self.request.user,
            action='UPDATE',
            module='PROMOTION',
            description=f'Cập nhật thông tin mã khuyến mãi "{instance.code}"',
            request=self.request
        )

    def perform_destroy(self, instance):
        code = instance.code
        instance.delete()
        log_action(
            user=self.request.user,
            action='DELETE',
            module='PROMOTION',
            description=f'Xóa mã khuyến mãi "{code}"',
            request=self.request
        )

