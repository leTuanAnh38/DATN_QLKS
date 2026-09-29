from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action
from django.utils import timezone
from datetime import datetime
from django.db.models import Q
from django.db import transaction
from .models import Booking, Promotion
from ..rooms.models import Room, RoomCategory
from ..users.models import User, GuestProfile
from .serializers import BookingSerializer, PromotionSerializer


class BookingViewSet(viewsets.ModelViewSet):
    """
    API xử lý Đặt phòng cho Khách hàng & Quản lý đơn:
    - POST /api/bookings/: Đặt phòng mới (Công khai / Khách vãng lai & Thành viên)
    - GET /api/bookings/: Xem danh sách đơn (Thành viên xem đơn của mình, Staff xem tất cả)
    - GET /api/bookings/<id>/: Chi tiết đơn đặt phòng
    """
    queryset = Booking.objects.select_related('guest', 'category', 'room', 'room__category', 'applied_promotion').all().order_by('-created_at')
    serializer_class = BookingSerializer

    def get_permissions(self):
        # Cho phép mọi khách hàng (kể cả chưa đăng nhập) có thể tạo đơn đặt phòng
        if self.action in ['create']:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Booking.objects.none()
        # Nếu là nhân viên, lễ tân, quản lý, admin -> xem tất cả đơn
        is_staff_or_admin = (
            user.is_staff or 
            user.is_superuser or 
            getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'owner', 'staff', 'cashier', 'housekeeper', 'service_staff', 'technician'] or
            getattr(user, 'role', '') != 'guest'
        )
        if is_staff_or_admin:
            return self.queryset
        # Nếu là khách hàng -> chỉ xem đơn của chính họ
        user_email = user.email.strip() if user.email else ''
        if user_email:
            return self.queryset.filter(Q(guest=user) | Q(guest__email=user_email))
        return self.queryset.filter(guest=user)

    def perform_update(self, serializer):
        instance = serializer.instance
        old_status = instance.status
        updated_booking = serializer.save()
        new_status = updated_booking.status

        # 1. Nếu chuyển sang checked_out: Tự động ghi nhận actual_check_out và chuyển phòng sang cleaning (đang dọn dẹp)
        if old_status != 'checked_out' and new_status == 'checked_out':
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
