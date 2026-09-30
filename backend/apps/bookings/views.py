import uuid
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action
from django.utils import timezone
from datetime import datetime
from django.db.models import Q
from django.db import transaction
from .models import Booking, Promotion, BookingExtraService
from ..rooms.models import Room, RoomCategory
from ..users.models import User, GuestProfile
from ..services.models import ServiceItem, ServiceRequest
from ..payments.models import Invoice
from .serializers import BookingSerializer, PromotionSerializer


class BookingViewSet(viewsets.ModelViewSet):
    """
    API xử lý Đặt phòng cho Khách hàng & Quản lý đơn:
    - POST /api/bookings/: Đặt phòng mới (Công khai / Khách vãng lai & Thành viên)
    - GET /api/bookings/: Xem danh sách đơn (Thành viên xem đơn của mình, Staff xem tất cả)
    - GET /api/bookings/<id>/: Chi tiết đơn đặt phòng
    """
    serializer_class = BookingSerializer

    def get_permissions(self):
        # Cho phép mọi khách hàng (kể cả chưa đăng nhập) có thể kiểm tra phòng và tạo đơn đặt phòng
        if self.action in ['create', 'check_availability']:
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

        # Nếu là nhân viên, lễ tân, quản lý, admin -> xem tất cả đơn mới nhất từ CSDL
        is_staff_or_admin = (
            user.is_staff or 
            user.is_superuser or 
            getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'owner', 'staff', 'cashier', 'housekeeper', 'service_staff', 'technician'] or
            getattr(user, 'role', '') != 'guest'
        )
        if is_staff_or_admin:
            return base_qs

        # Nếu là khách hàng -> chỉ xem đơn của chính họ
        user_email = user.email.strip() if user.email else ''
        if user_email:
            return base_qs.filter(Q(guest=user) | Q(guest__email=user_email))
        return base_qs.filter(guest=user)

    def perform_update(self, serializer):
        instance = serializer.instance
        old_status = instance.status
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

        # 2. Nếu hủy đơn (cancelled): Nếu phòng thực tế đang bị giữ (occupied) -> giải phóng về available (sẵn sàng)
        elif new_status == 'cancelled':
            if updated_booking.room and updated_booking.room.status == 'occupied':
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

        # 2.1 Kiểm tra tình trạng phòng trống (Chống Overbooking)
        total_rooms = category_instance.rooms.exclude(status='maintenance').count()
        booked_rooms = Booking.objects.filter(
            category=category_instance,
            status__in=['pending', 'confirmed', 'checked_in'],
            check_in_date__lt=check_out,
            check_out_date__gt=check_in
        ).count()
        available_rooms = max(0, total_rooms - booked_rooms)

        if available_rooms <= 0:
            suggested = []
            for other_cat in RoomCategory.objects.exclude(id=category_instance.id):
                other_total = other_cat.rooms.exclude(status='maintenance').count()
                other_booked = Booking.objects.filter(
                    category=other_cat,
                    status__in=['pending', 'confirmed', 'checked_in'],
                    check_in_date__lt=check_out,
                    check_out_date__gt=check_in
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
        subtotal = price_per_night * nights

        # 4. Xử lý Mã khuyến mãi (nếu có)
        promotion_obj = None
        discount_amount = 0
        if promo_code:
            now = timezone.now()
            promo = Promotion.objects.filter(
                code=promo_code,
                is_active=True,
                valid_from__lte=now,
                valid_to__gte=now
            ).first()

            if promo and promo.used_count < promo.usage_limit and subtotal >= promo.min_order_value:
                promotion_obj = promo
                if promo.discount_type == 'percentage':
                    calc_discount = (subtotal * promo.discount_value) / 100
                    if promo.max_discount_amount:
                        calc_discount = min(calc_discount, promo.max_discount_amount)
                    discount_amount = calc_discount
                else:
                    discount_amount = min(subtotal, promo.discount_value)

                # Tăng lượt dùng khuyến mãi
                promo.used_count += 1
                promo.save(update_fields=['used_count'])

        total_amount = max(0, subtotal - discount_amount)

        # 5. Xác định User đặt phòng (Nếu đã đăng nhập hoặc tìm/tạo tài khoản khách)
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

        # 6. Tạo Đơn đặt phòng mới:
        # Khách hàng đặt phòng theo Hạng phòng (RoomCategory).
        # Số phòng thực tế (Room) để trống (None) để Lễ tân chọn và gán phòng trống khi làm thủ tục Check-in.
        booking = Booking.objects.create(
            guest=guest_user,
            category=category_instance,
            room=None,
            identity_card=identity_card,
            check_in_date=check_in,
            check_out_date=check_out,
            total_amount=total_amount,
            applied_promotion=promotion_obj,
            status='pending',
            note=note
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
            'summary': {
                'nights': nights,
                'subtotal': float(subtotal),
                'discount_amount': float(discount_amount),
                'total_amount': float(total_amount),
            }
        }, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        """
        API cập nhật đơn đặt phòng (PATCH /api/bookings/<id>/):
        - Khách hàng: Cho phép hủy đơn (chuyển status='cancelled') nếu đơn đang ở trạng thái 'pending'.
        - Nhân viên / Quản trị: Có quyền cập nhật trạng thái (status), ghi chú nội bộ (internal_note) và thông tin nghiệp vụ.
        """
        booking = self.get_object()
        user = request.user
        is_staff_or_admin = (
            user.is_authenticated and (
                user.is_staff or 
                user.is_superuser or 
                getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'owner', 'staff', 'cashier', 'housekeeper', 'service_staff', 'technician'] or
                getattr(user, 'role', '') != 'guest'
            )
        )

        new_status = request.data.get('status')

        # Xử lý trường hợp tài khoản là khách hàng
        if not is_staff_or_admin:
            if new_status == 'cancelled':
                if booking.status != 'pending':
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
            elif booking.status == 'cancelled' and booking.room.status == 'occupied':
                booking.room.status = 'available'
                booking.room.save(update_fields=['status'])

        serializer = self.get_serializer(booking, context={'request': request})
        return Response({
            'success': True,
            'message': f'Cập nhật đơn đặt phòng {booking.booking_code} thành công.',
            'booking': serializer.data,
            **serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='available-rooms')
    def available_rooms(self, request, pk=None):
        """
        API lấy danh sách các phòng thực tế (Room) đang 'available' (Sẵn sàng)
        thuộc đúng Hạng phòng mà khách đã đặt để Lễ tân chọn trong Modal Check-in.
        """
        booking = self.get_object()
        category = booking.category or (booking.room.category if booking.room else None)
        category_id = category.id if category else None
        if not category_id:
            param_cat = request.query_params.get('category_id')
            if param_cat and str(param_cat).isdigit():
                category_id = int(param_cat)

        available_rooms_qs = Room.objects.filter(status='available').select_related('category')
        if category_id:
            available_rooms_qs = available_rooms_qs.filter(category_id=category_id)

        from ..rooms.serializers import RoomSerializer
        serializer = RoomSerializer(available_rooms_qs.order_by('floor', 'room_number'), many=True)

        return Response({
            'success': True,
            'count': available_rooms_qs.count(),
            'category_id': category_id,
            'category_name': category.name if category else 'Phòng tiêu chuẩn',
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

        # 1. Kiểm tra phân quyền nhân sự khách sạn
        is_staff_or_admin = (
            user.is_authenticated and (
                user.is_staff or 
                user.is_superuser or 
                getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'owner', 'staff', 'cashier', 'housekeeper', 'service_staff', 'technician'] or
                getattr(user, 'role', '') != 'guest'
            )
        )
        if not is_staff_or_admin:
            return Response({
                'success': False,
                'message': 'Chỉ nhân viên lễ tân hoặc cấp quản lý mới có quyền thực hiện thủ tục Check-in nhận phòng.'
            }, status=status.HTTP_403_FORBIDDEN)

        # 2. Kiểm tra trạng thái hợp lệ của đơn đặt phòng
        if booking.status == 'checked_in':
            actual_str = booking.actual_check_in.strftime('%H:%M %d/%m/%Y') if booking.actual_check_in else ''
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

        # 6. THỰC HIỆN ĐỒNG THỜI 2 VIỆC DÙNG TRANSACTION.ATOMIC ĐẢM BẢO AN TOÀN DỮ LIỆU
        now = timezone.now()
        with transaction.atomic():
            # Nếu đơn đặt phòng trước đó có phòng cũ đang bị occupied, giải phóng phòng cũ về available
            old_room = booking.room
            if old_room and old_room.id != target_room.id and old_room.status == 'occupied':
                old_room.status = 'available'
                old_room.save(update_fields=['status'])

            # Việc 1: Cập nhật bảng Booking (gán room_id, status='checked_in', actual_check_in=now)
            booking.room = target_room
            booking.status = 'checked_in'
            booking.actual_check_in = now

            # Thêm ghi chú lễ tân nếu có
            receptionist_note = request.data.get('internal_note', '').strip()
            time_str = now.strftime('%H:%M • %d/%m/%Y')
            receptionist_name = user.get_full_name() or user.username
            auto_log = f"[Check-in lúc {time_str} bởi {receptionist_name}]: Nhận phòng {target_room.room_number}."
            if receptionist_note:
                auto_log += f" Ghi chú: {receptionist_note}"

            if booking.internal_note:
                booking.internal_note = f"{booking.internal_note}\n{auto_log}".strip()
            else:
                booking.internal_note = auto_log

            booking.save(update_fields=['room', 'status', 'actual_check_in', 'internal_note', 'updated_at'])

            # Việc 2: Cập nhật bảng Room tương ứng sang occupied (Đang có khách)
            target_room.status = 'occupied'
            target_room.save(update_fields=['status'])

        # Lấy thông tin serialize đầy đủ
        serializer = self.get_serializer(booking, context={'request': request})
        from ..rooms.serializers import RoomSerializer
        room_data = RoomSerializer(target_room).data

        guest_display = booking.guest.get_full_name() or booking.guest.username if booking.guest else "Khách hàng"
        return Response({
            'success': True,
            'message': f'Hoàn tất thủ tục Check-in thành công cho khách {guest_display}! Đã gán phòng {target_room.room_number} (Tầng {target_room.floor}).',
            'booking': serializer.data,
            'room': room_data,
            **serializer.data
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

        # 1. Kiểm tra phân quyền Lễ tân / Quản trị
        is_staff_or_admin = (
            user.is_authenticated and (
                user.is_staff or 
                user.is_superuser or 
                getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'owner', 'staff', 'cashier', 'housekeeper', 'service_staff', 'technician'] or
                getattr(user, 'role', '') != 'guest'
            )
        )
        if not is_staff_or_admin:
            return Response({
                'success': False,
                'message': 'Chỉ nhân viên lễ tân hoặc cấp quản lý mới có quyền thực hiện tiếp đón khách Walk-in tại quầy.'
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

        # Tính toán tiền phòng dự kiến (Số đêm * Giá phòng)
        category_instance = target_room.category
        price_per_night = (category_instance.promo_price or category_instance.base_price) if category_instance else 0
        calculated_total = price_per_night * nights

        provided_total = data.get('total_amount')
        total_amount = calculated_total
        if provided_total is not None and str(provided_total).isdigit() and int(provided_total) > 0:
            total_amount = int(provided_total)

        # THỰC THI TRANSACTION ĐỒNG THỜI
        with transaction.atomic():
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
                last_name = name_parts[0] if len(name_parts) > 1 else ''
                first_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else guest_name
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
                    guest_user.last_name = name_parts[0] if len(name_parts) > 1 else ''
                    guest_user.first_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else guest_name
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

        return Response({
            'success': True,
            'message': f'Hoàn tất tiếp đón khách Walk-in thành công! Đã Check-in khách "{guest_name}" vào Phòng {target_room.room_number}.',
            'booking': serializer.data,
            'room': room_data,
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

        total_rooms = category.rooms.exclude(status='maintenance').count()
        booked_rooms = Booking.objects.filter(
            category=category,
            status__in=['pending', 'confirmed', 'checked_in'],
            check_in_date__lt=check_out,
            check_out_date__gt=check_in
        ).count()

        available_rooms = max(0, total_rooms - booked_rooms)
        is_sold_out = (available_rooms <= 0)

        # Gợi ý các hạng phòng khác còn trống
        suggested = []
        if is_sold_out:
            for other_cat in RoomCategory.objects.exclude(id=category.id):
                other_total = other_cat.rooms.exclude(status='maintenance').count()
                other_booked = Booking.objects.filter(
                    category=other_cat,
                    status__in=['pending', 'confirmed', 'checked_in'],
                    check_in_date__lt=check_out,
                    check_out_date__gt=check_in
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

        # 1. Kiểm tra phân quyền nhân viên / lễ tân / quản trị
        is_staff_or_admin = (
            user.is_authenticated and (
                user.is_staff or 
                user.is_superuser or 
                getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'owner', 'staff', 'cashier', 'housekeeper', 'service_staff', 'technician'] or
                getattr(user, 'role', '') != 'guest'
            )
        )
        if not is_staff_or_admin:
            return Response({
                'success': False,
                'message': 'Chỉ nhân viên khách sạn hoặc quản lý mới có quyền thêm dịch vụ vào đơn đặt phòng.'
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
            if quantity < 1:
                quantity = 1
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

                unit_price = float(price_input) if price_input is not None and str(price_input).strip() != '' else float(service_item.price)
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

        is_staff_or_admin = (
            user.is_authenticated and (
                user.is_staff or 
                user.is_superuser or 
                getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'owner', 'staff', 'cashier', 'housekeeper', 'service_staff', 'technician'] or
                getattr(user, 'role', '') != 'guest'
            )
        )
        if not is_staff_or_admin:
            return Response({
                'success': False,
                'message': 'Chỉ nhân viên khách sạn hoặc quản lý mới có quyền xóa phụ phí.'
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
            daily_rate = float(booking.category.base_price)
        elif booking.room and booking.room.category and booking.room.category.base_price:
            daily_rate = float(booking.room.category.base_price)

        if booking.total_amount and float(booking.total_amount) > 0:
            room_charge = float(booking.total_amount)
            if daily_rate <= 0:
                daily_rate = round(room_charge / nights)
        else:
            room_charge = float(daily_rate * nights)

        # 2. Lấy extra_services (các ServiceRequest liên kết có status='completed')
        import re
        extra_services = []

        # 2.1. Từ ServiceRequest (Yêu cầu gọi món & dịch vụ tại phòng)
        completed_requests = booking.service_requests.filter(
            status='completed'
        ).select_related('service').order_by('created_at')

        for req in completed_requests:
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
                'note': '',
                'created_at': bes.added_time.isoformat() if bes.added_time else None
            })

        # 3. Tổng tiền dịch vụ (total_service_charge)
        total_service_charge = float(sum(item['total_price'] for item in extra_services))

        # 4. Tổng thanh toán cuối cùng (grand_total)
        grand_total = float(room_charge + total_service_charge)

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
            'total_service_charge': total_service_charge,
            'grand_total': grand_total,
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
                daily_rate = float(booking.category.base_price)
            elif booking.room and booking.room.category and booking.room.category.base_price:
                daily_rate = float(booking.room.category.base_price)

            if booking.total_amount and float(booking.total_amount) > 0:
                room_charge = float(booking.total_amount)
            else:
                room_charge = float(daily_rate * nights)

            # Tính phí dịch vụ hoàn thành
            completed_requests = booking.service_requests.filter(status='completed').select_related('service')
            total_service_charge = float(sum(
                (req.total_price or ((req.service.price if req.service else 0) * req.quantity))
                for req in completed_requests
            ))

            import re
            for bes in booking.extra_services.all():
                raw_name = (bes.service_name or '').strip()
                if not re.search(r'\[Yêu cầu #\d+\]', raw_name, re.IGNORECASE):
                    total_service_charge += float((bes.price or 0) * (bes.quantity or 1))

            grand_total = float(room_charge + total_service_charge)

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

            # 3. Cập nhật bảng Booking: Đổi trạng thái thành completed
            booking.status = 'completed'
            booking.actual_check_out = timezone.now()
            if note:
                checkout_note = f"[Check-out: {invoice.get_payment_method_display() or payment_method} - {timezone.now().strftime('%d/%m/%Y %H:%M')}]: {note}"
                booking.internal_note = f"{booking.internal_note}\n{checkout_note}".strip() if booking.internal_note else checkout_note
            booking.save(update_fields=['status', 'actual_check_out', 'internal_note', 'updated_at'])

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

        serializer = self.get_serializer(booking, context={'request': request})
        return Response({
            'success': True,
            'message': f"Đã hoàn tất thanh toán và Check-out thành công cho phòng {booking.room.room_number if booking.room else ''}!",
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
