"""Mixin: nghiệp vụ lễ tân - check-in/out, đổi phòng, walk-in, đặt trước, gia hạn, no-show."""
import uuid
from decimal import Decimal
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from datetime import datetime
from django.db.models import Q
from django.db import transaction
from ..models import Booking, BookingExtraService, BookingGuest
from ...rooms.models import Room
from ...users.models import User, log_action
from ...users.views import check_role_permission
from ...payments.models import Invoice, Payment
from ...notifications.models import Notification
from ...notifications.signals import get_staff_and_admin_users
from ..serializers import BookingSerializer, optimize_booking_queryset


class BookingFrontDeskMixin:
    """Mixin: nghiệp vụ lễ tân - check-in/out, đổi phòng, walk-in, đặt trước, gia hạn, no-show."""


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
            check_in_date__lt=stay_end_date,
            check_out_date__gt=today
        ).exclude(id=booking.id).filter(
            Q(status__in=['confirmed', 'checked_in', 'paid', 'PAID']) |
            Q(group_booking__isnull=False, group_booking__status__in=['tentative', 'confirmed', 'checked_in']) |
            Q(status='pending', created_at__gte=timezone.now() - timezone.timedelta(minutes=15))
        ).first()

        if conflict_booking:
            return Response({
                'success': False,
                'message': f'Không thể gán phòng {target_room.room_number}. Phòng này đã có đơn #{conflict_booking.booking_code} đặt trước trong khoảng thời gian {conflict_booking.check_in_date.strftime("%d/%m/%Y")} - {conflict_booking.check_out_date.strftime("%d/%m/%Y")}. Vui lòng chọn phòng trống khác.'
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

            # Xử lý phụ thu nhận phòng sớm trong ngày (Same-day Early Check-in Surcharge)
            same_day_surcharge = float(request.data.get('same_day_early_surcharge', 0) or 0)
            if same_day_surcharge > 0:
                booking.total_amount = float(booking.total_amount or 0) + same_day_surcharge
                if 'total_amount' not in update_fields:
                    update_fields.append('total_amount')

                # Kiểm tra xem khoản thanh toán đã nhận có đủ trả cả phụ thu này không
                # (Trường hợp lễ tân bấm "Thu tiền & Check-in", Payment đã ghi nhận đủ tiền trước khi check-in)
                completed_payments_sum = sum(
                    float(p.amount) for p in booking.payments.filter(payment_status='COMPLETED')
                )
                is_surcharge_paid = completed_payments_sum >= float(booking.total_amount)

                BookingExtraService.objects.create(
                    booking=booking,
                    service_name='Phụ thu nhận phòng sớm trong ngày (Early Check-in)',
                    quantity=1,
                    price=same_day_surcharge,
                    is_paid=is_surcharge_paid
                )
                if is_surcharge_paid:
                    booking.extra_services.filter(is_paid=False).update(is_paid=True)
                auto_log = f"[Phụ thu nhận phòng sớm trong ngày lúc {time_str}]: +{same_day_surcharge:,.0f} VND.\n{auto_log}"

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
        from ...rooms.serializers import RoomSerializer
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
                success_message = f'Hoàn tất Nhận Phòng Sớm ({early_days} ngày) cho khách {guest_display}! Đã cập nhật ngày nhận sang {today.strftime("%d/%m/%Y")}, cộng thêm {additional_amount:,.0f}đ tiền phòng và gán phòng {target_room.room_number}.'
            else:
                success_message = f'Hoàn tất Nhận Phòng Sớm ({early_days} ngày) cho khách {guest_display}! Đã cập nhật ngày nhận sang {today.strftime("%d/%m/%Y")} (Miễn phụ thu) và gán phòng {target_room.room_number}.'
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

        # 1. Kiểm tra quyền theo ma trận RBAC (Hỗ trợ đổi phòng khẩn cấp cho nhân viên khách sạn)
        can_change_room = (
            user.is_superuser or 
            check_role_permission(user, 'bookings', 'update') or
            getattr(user, 'role', '') in ['admin', 'manager', 'owner', 'receptionist', 'housekeeper', 'technician']
        )
        if not can_change_room:
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
                from ...rooms.models import MaintenanceTicket
                from ...bookings.models import BookingExtraService
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
                raw_guest_fault = request.data.get('is_guest_fault', False)
                is_guest_fault = bool(raw_guest_fault is True or str(raw_guest_fault).lower() in ['true', '1'])

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
                if 'image_before' in request.FILES:
                    created_ticket.image_before = request.FILES['image_before']
                    created_ticket.save(update_fields=['image_before'])

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
            from ...notifications.models import Notification
            notify_users = User.objects.filter(
                Q(role__in=['receptionist', 'manager', 'admin', 'technician', 'housekeeper']) |
                (Q(is_superuser=True) & ~Q(role__in=['owner', 'guest', 'service_staff', 'cashier']))
            ).distinct()

            old_status_text = "Đang bảo trì" if old_room_status == 'maintenance' else "Cần dọn dẹp"
            from ...users.models import User as UserModel
            role_display = dict(UserModel.ROLE_CHOICES).get(getattr(user, 'role', ''), "Nhân viên")
            notif_title = f"[ĐỔI PHÒNG] Khách P.{old_room.room_number} chuyển sang P.{new_room.room_number}!"
            notif_msg = (
                f"{role_display} ({staff_name}) đã thực hiện Đổi phòng cho khách lưu trú:\n"
                f"• Khách hàng: {guest_display} (#{booking.booking_code})\n"
                f"• Phòng cũ: P.{old_room.room_number} ➔ Trạng thái mới: {old_status_text}\n"
                f"• Phòng mới: P.{new_room.room_number} (Tầng {new_room.floor})\n"
                f"• Lý do: {reason}"
            )
            notifs = [
                Notification(
                    recipient=r,
                    title=notif_title,
                    message=notif_msg,
                    notification_type='room',
                    action_url='/admin/rooms',
                    priority='normal'
                )
                for r in notify_users
            ]
            if notifs:
                Notification.objects.bulk_create(notifs)
        except Exception:
            pass

        from ...rooms.serializers import RoomSerializer
        return Response({
            'success': True,
            'message': f'Đã đổi phòng thành công cho khách {guest_display}! Khách đã nhận phòng mới {new_room.room_number}. Phòng cũ {old_room.room_number} đã chuyển sang "{old_room.get_status_display()}".',
            'booking': self.get_serializer(booking).data,
            'new_room': RoomSerializer(new_room).data,
            'old_room': RoomSerializer(old_room).data,
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

        # Kiểm tra phân quyền: Yêu cầu quyền bookings.update theo Ma trận phân quyền RBAC (Lễ tân, Quản lý, Admin)
        can_checkout = (
            user.is_superuser or
            getattr(user, 'role', '') in ['admin', 'manager', 'owner'] or
            check_role_permission(user, 'bookings', 'update')
        )
        if not can_checkout:
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
                    calc_promo = (room_subtotal * float(booking.applied_promotion.discount_value)) / 100.0
                    if getattr(booking.applied_promotion, 'max_discount_amount', None):
                        calc_promo = min(calc_promo, float(booking.applied_promotion.max_discount_amount))
                    promo_discount = calc_promo
                else:
                    promo_discount = min(room_subtotal, float(booking.applied_promotion.discount_value))
            elif getattr(booking, 'promotion_discount', None):
                promo_discount = float(booking.promotion_discount)

            # Tiền phòng thuần (pure_room_charge)
            if hasattr(booking, 'invoice') and booking.invoice and booking.invoice.room_charge is not None and float(booking.invoice.room_charge) > 0:
                pure_room_charge = float(booking.invoice.room_charge)
                actual_promo = max(0.0, room_subtotal - pure_room_charge - mem_discount)
                if actual_promo > 0:
                    promo_discount = actual_promo
            elif daily_rate > 0 and nights > 0:
                pure_room_charge = max(0.0, room_subtotal - mem_discount - promo_discount)
            elif booking.total_amount:
                all_services_total = sum(float(r.total_price or 0) for r in booking.service_requests.exclude(status='cancelled'))
                pure_room_charge = max(0.0, float(booking.total_amount) - all_services_total)
            else:
                pure_room_charge = max(0.0, room_subtotal - mem_discount - promo_discount)

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

            # Phụ thu Trả phòng muộn (Late Check-out Surcharge)
            late_checkout_surcharge = float(request.data.get('late_checkout_surcharge', 0) or 0)
            if late_checkout_surcharge > 0:
                BookingExtraService.objects.create(
                    booking=booking,
                    service_name='Phụ thu trả phòng muộn (Late Check-out)',
                    quantity=1,
                    price=late_checkout_surcharge,
                    # Chưa thu tiền: khoản này nằm trong remaining_amount và sẽ được ghi nhận
                    # thành Payment ở bước thanh toán checkout; is_paid sẽ được bật sau đó.
                    is_paid=False
                )
                total_service_charge += late_checkout_surcharge

            grand_total = float(room_charge + total_service_charge)


            # Phân tách dịch vụ đã thanh toán trước (is_paid=True)
            prepaid_svc_total = float(sum(
                (req.total_price or ((req.service.price if req.service else 0) * req.quantity))
                for req in valid_requests if getattr(req, 'is_paid', False)
            ))
            for bes in booking.extra_services.filter(is_paid=True):
                raw_name = (bes.service_name or '').strip()
                if not re.search(r'\[Yêu cầu #\d+\]', raw_name, re.IGNORECASE):
                    clean_name = re.sub(r'\[.*?\]', '', raw_name).strip()
                    if not any((r.service.name if r.service else '').strip().lower() == clean_name.lower() for r in valid_requests):
                        prepaid_svc_total += float((bes.price or 0) * (bes.quantity or 1))

            # Xác định số tiền đã thanh toán trước và số tiền còn lại phải thu
            paid_amount = 0.0
            if hasattr(booking, 'payments'):
                completed_payments = booking.payments.filter(payment_status='COMPLETED')
                if completed_payments.exists():
                    paid_amount = float(sum(p.amount for p in completed_payments))
            if paid_amount <= 0:
                if booking.status in ['paid', 'PAID'] or (hasattr(booking, 'invoice') and booking.invoice and booking.invoice.status == 'paid'):
                    paid_amount = float(booking.total_amount or (room_charge + prepaid_svc_total))
                elif booking.note and ('vietqr: đã thanh toán' in booking.note.lower() or 'đã thanh toán thành công' in booking.note.lower()):
                    paid_amount = float(booking.total_amount or (room_charge + prepaid_svc_total))

            if prepaid_svc_total > 0 and paid_amount < (room_charge + prepaid_svc_total):
                has_svc_payment = booking.payments.filter(transaction_id__startswith='SVC-').exists() if hasattr(booking, 'payments') else False
                if not has_svc_payment:
                    paid_amount += prepaid_svc_total

            is_group_sub_room = bool(booking.group_booking_id and getattr(booking, 'is_master_billed', True))
            group = booking.group_booking
            is_company_all_inclusive = bool(is_group_sub_room and group and getattr(group, 'billing_type', 'ROOM_ONLY') == 'ALL_INCLUSIVE')

            if is_company_all_inclusive:
                # Công ty chi trả toàn bộ (Cả tiền phòng lẫn mọi chi phí dịch vụ phát sinh)
                # Khách trả phòng lẻ tại quầy không phải trả tiền, toàn bộ kết chuyển vào Master Folio của đoàn
                remaining_amount = 0.0
                sub_room_charge = 0.0
                sub_invoice_total = 0.0
            elif is_group_sub_room:
                # Tiền phòng chuyển vào Master Folio của đoàn, số tiền khách lẻ tại quầy phải trả chỉ là dịch vụ phát sinh chưa thanh toán
                remaining_amount = max(0.0, float(total_service_charge - paid_amount))
                sub_room_charge = 0.0
                sub_invoice_total = float(total_service_charge)
            else:
                remaining_amount = max(0.0, float(grand_total - paid_amount))
                sub_room_charge = float(room_charge)
                sub_invoice_total = float(grand_total)

            # Chốt chặn tài chính (Financial Guardrail):
            # Nếu phòng vẫn còn nợ (remaining_amount > 0) và không thuộc diện công ty ALL_INCLUSIVE:
            # Bắt buộc phải có xác nhận thanh toán (confirm_settle hoặc settle_remaining). Nếu không, từ chối Check-out!
            if remaining_amount > 0 and not is_company_all_inclusive:
                confirm_settle = bool(
                    request.data.get('confirm_settle', False) or 
                    request.data.get('settle_remaining', False)
                )
                if not confirm_settle:
                    return Response({
                        'success': False,
                        'code': 'UNSETTLED_DEBT',
                        'message': f"Chốt chặn tài chính: Đơn #{booking.booking_code} vẫn còn công nợ chưa thanh toán ({remaining_amount:,.0f} VND). Vui lòng thu tiền hoặc xác nhận thanh toán trước khi hoàn tất trả phòng!",
                        'remaining_amount': remaining_amount
                    }, status=status.HTTP_400_BAD_REQUEST)

            # 2. Tạo hoặc cập nhật bản ghi Invoice lưu tổng số tiền & thông tin VAT công ty
            is_company_invoice = bool(request.data.get('is_company_invoice', False))
            company_name = str(request.data.get('company_name') or '').strip() or None
            company_tax_code = str(request.data.get('company_tax_code') or '').strip() or None
            company_address = str(request.data.get('company_address') or '').strip() or None
            invoice_recipient_email = str(request.data.get('invoice_recipient_email') or '').strip() or None

            # 2. Tạo hoặc cập nhật bản ghi Invoice lưu tổng số tiền & thông tin VAT công ty
            method_code = 'TRANSFER' if str(payment_method).lower() in ['bank_transfer', 'momo', 'transfer', 'vietqr', 'credit_card'] else 'CASH'

            # Kiểm tra xem đơn đã có đợt thanh toán trước đó với phương thức khác hay không (Thanh toán hỗn hợp)
            inv_payment_method = payment_method
            if hasattr(booking, 'payments') and booking.payments.filter(payment_status='COMPLETED').exists():
                prior_methods = set()
                for p in booking.payments.filter(payment_status='COMPLETED'):
                    pm = 'TRANSFER' if str(p.payment_method).upper() in ['TRANSFER', 'VIETQR', 'BANK_TRANSFER'] else 'CASH'
                    prior_methods.add(pm)
                if remaining_amount > 0 and (method_code not in prior_methods or len(prior_methods) > 1):
                    inv_payment_method = 'mixed'
                elif len(prior_methods) > 1:
                    inv_payment_method = 'mixed'

            inv_defaults = {
                'room_charge': sub_room_charge,
                'service_charge': total_service_charge,
                'total_amount': sub_invoice_total,
                'payment_method': inv_payment_method,
                'status': 'paid',
                'paid_at': timezone.now()
            }
            if is_company_invoice or company_name or company_tax_code:
                inv_defaults.update({
                    'is_company_invoice': True,
                    'company_name': company_name,
                    'company_tax_code': company_tax_code,
                    'company_address': company_address,
                    'invoice_recipient_email': invoice_recipient_email
                })

            invoice, created = Invoice.objects.update_or_create(
                booking=booking,
                defaults=inv_defaults
            )

            # 2.1 Đồng bộ bản ghi Payment & gán vào Ca làm việc thu ngân hiện tại
            from ...payments.models import CashierShift
            active_shift = CashierShift.objects.filter(user=user, status='OPEN').first()
            if not active_shift:
                active_shift = CashierShift.objects.filter(status='OPEN').order_by('-opened_at').first()

            if remaining_amount > 0:
                Payment.objects.create(
                    booking=booking,
                    amount=remaining_amount,
                    payment_method=method_code,
                    payment_status='COMPLETED',
                    shift=active_shift,
                    transaction_id=f"TXN-CHECKOUT-{invoice.invoice_code.replace('INV-', '')}"
                )
            elif not is_group_sub_room and (not hasattr(booking, 'payments') or not booking.payments.filter(payment_status='COMPLETED').exists()):
                Payment.objects.create(
                    booking=booking,
                    amount=grand_total,
                    payment_method=method_code,
                    payment_status='COMPLETED',
                    shift=active_shift,
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
            # (Ngoại trừ trường hợp phòng thuộc đoàn ALL_INCLUSIVE: các dịch vụ này được bảo lãnh chuyển vào Master Invoice đoàn)
            if not is_company_all_inclusive:
                booking.service_requests.filter(is_paid=False).update(is_paid=True)
                booking.extra_services.filter(is_paid=False).update(is_paid=True)

            # 4. Cập nhật bảng Room: Nếu phòng đang có phiếu bảo trì chờ sửa ('fixing') thì chuyển sang 'maintenance',
            # ngược lại chuyển sang 'cleaning' (Đang dọn dẹp) để Buồng phòng xử lý
            room_info = None
            if booking.room:
                has_active_maintenance = booking.room.maintenance_tickets.filter(status='fixing').exists()
                booking.room.status = 'maintenance' if has_active_maintenance else 'cleaning'
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
        from ...rooms.serializers import RoomSerializer
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
                        ),
                        notification_type='booking',
                        action_url='/booking-history',
                        priority='normal'
                    )
            else:
                # Khách tự làm trên web -> Thông báo cho Lễ tân / Quản lý
                staff_users = get_staff_and_admin_users(exclude_user_id=booking.guest_id, event_type='booking_manage')
                staff_notifs = [
                    Notification(
                        recipient=staff,
                        title=f"Khách gia hạn phòng: #{booking.booking_code}",
                        message=(
                            f"Khách hàng {guest_name_str} ({room_label_str}) vừa gia hạn lưu trú trên website "
                            f"đến ngày {date_display_str} (thêm {extra_nights} đêm, phát sinh: {extra_amount:,.0f} VND). "
                            f"Vui lòng kiểm tra trên PMS."
                        ),
                        notification_type='booking',
                        action_url='/admin/bookings',
                        priority='high'
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
                        ),
                        notification_type='booking',
                        action_url='/booking-history',
                        priority='normal'
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
        qs = optimize_booking_queryset(Booking.objects.all()).filter(
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
        qs = optimize_booking_queryset(Booking.objects.all()).filter(
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
