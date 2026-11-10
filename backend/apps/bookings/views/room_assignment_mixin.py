"""Mixin: gán phòng trước, danh sách phòng trống, kiểm tra tồn phòng."""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.decorators import action
from django.utils import timezone
from datetime import datetime, timedelta
from django.db.models import Q
from ..models import Booking
from ...rooms.models import Room, RoomCategory
from ...users.views import check_role_permission


class BookingRoomAssignmentMixin:
    """Mixin: gán phòng trước, danh sách phòng trống, kiểm tra tồn phòng."""


    @action(detail=True, methods=['get'], url_path='available-rooms')
    def available_rooms(self, request, pk=None):
        """
        API lấy danh sách các phòng thực tế (Room) đang 'available' (Sẵn sàng)
        thuộc đúng Hạng phòng mà khách đã đặt để Lễ tân chọn trong Modal Check-in.
        Bắt buộc loại trừ các phòng đã được gán cho đơn đặt khác (cả đơn lẻ và đơn đoàn) trong khoảng thời gian lưu trú.
        """
        booking = self.get_object()
        category = booking.category or (booking.room.category if booking.room else None)
        param_cat = request.query_params.get('category_id')
        if param_cat and str(param_cat).isdigit():
            category_id = int(param_cat)
        else:
            category_id = category.id if category else None

        all_categories = request.query_params.get('all_categories', 'false').lower() in ['true', '1', 'yes']

        # 1. Cơ bản: Lấy danh sách phòng không bảo trì
        available_rooms_qs = Room.objects.exclude(status='maintenance').select_related('category')
        if category_id and not all_categories:
            available_rooms_qs = available_rooms_qs.filter(category_id=category_id)

        # 2. Loại trừ các phòng ĐÃ ĐƯỢC GÁN cho đơn đặt khác trong khoảng thời gian lưu trú trùng lặp
        check_in = booking.check_in_date
        check_out = booking.check_out_date

        conflicting_status_filter = (
            Q(status__in=['confirmed', 'checked_in', 'paid', 'PAID']) |
            Q(group_booking__isnull=False, group_booking__status__in=['tentative', 'confirmed', 'checked_in']) |
            Q(status='pending', created_at__gte=timezone.now() - timezone.timedelta(minutes=15))
        )

        conflicting_room_ids = Booking.objects.filter(
            room__isnull=False,
            check_in_date__lt=check_out,
            check_out_date__gt=check_in
        ).exclude(
            pk=booking.pk
        ).filter(
            conflicting_status_filter
        ).values_list('room_id', flat=True)

        available_rooms_qs = available_rooms_qs.exclude(id__in=conflicting_room_ids)

        # 3. Với các phòng còn lại: phòng phải đang 'available' (trống & sạch)
        # Hoặc nếu phòng đó chính là phòng đã gán từ trước của đơn này (booking.room_id) thì vẫn giữ lại
        if booking.room_id:
            available_rooms_qs = available_rooms_qs.filter(Q(status='available') | Q(id=booking.room_id))
        else:
            available_rooms_qs = available_rooms_qs.filter(status='available')

        from ...rooms.serializers import RoomSerializer
        serializer = RoomSerializer(available_rooms_qs.order_by('floor', 'room_number'), many=True)

        cat_display = 'Tất cả các hạng phòng' if all_categories else (category.name if category else 'Phòng tiêu chuẩn')
        return Response({
            'success': True,
            'count': available_rooms_qs.count(),
            'category_id': None if all_categories else category_id,
            'category_name': cat_display,
            'rooms': serializer.data
        }, status=status.HTTP_200_OK)


    @action(detail=True, methods=['post'], url_path='pre-assign-room')
    def pre_assign_room(self, request, pk=None):
        """
        API cho phép Lễ tân gán phòng thực tế trước (hoặc hủy/đổi phòng đã gán)
        cho đơn đặt phòng trước khi khách tới làm thủ tục Check-in.
        - POST /api/bookings/<id>/pre-assign-room/
        - Payload: { "room_id": 101 } hoặc { "room_id": null } để hủy gán.
        - Lưu ý: Không đổi status của Booking sang 'checked_in', không đổi status của Room sang 'occupied'.
        """
        booking = self.get_object()
        user = request.user

        # 1. Kiểm tra phân quyền theo ma trận quyền (Yêu cầu quyền bookings.update)
        if not (user.is_superuser or check_role_permission(user, 'bookings', 'update')):
            return Response({
                'success': False,
                'message': 'Bạn không có quyền thực hiện gán phòng trước (Yêu cầu quyền Cập nhật đơn đặt phòng).'
            }, status=status.HTTP_403_FORBIDDEN)

        # 2. Kiểm tra trạng thái đơn: Không được gán cho đơn đã check-in, check-out, completed, cancelled, no-show
        if booking.status in ['checked_in', 'checked_out', 'completed', 'cancelled', 'no_show']:
            return Response({
                'success': False,
                'message': f'Không thể gán phòng trước cho đơn đang ở trạng thái "{booking.get_status_display()}".'
            }, status=status.HTTP_400_BAD_REQUEST)

        room_id = request.data.get('room_id')

        # 3. Hủy gán phòng nếu room_id là None, rỗng, hoặc 0
        if room_id is None or room_id == '' or room_id == 0:
            old_room_number = booking.room.room_number if booking.room else None
            booking.room = None
            booking.save(update_fields=['room', 'updated_at'])
            return Response({
                'success': True,
                'message': f'Đã hủy gán phòng cho đơn {booking.booking_code}.' if old_room_number else 'Đơn chưa được gán phòng.',
                'room_id': None,
                'room_number': None,
                'room_name': booking.category.name if booking.category else 'Phòng tiêu chuẩn'
            }, status=status.HTTP_200_OK)

        # 4. Kiểm tra phòng tồn tại
        try:
            target_room = Room.objects.select_related('category').get(pk=int(room_id))
        except (Room.DoesNotExist, ValueError):
            return Response({
                'success': False,
                'message': f'Không tìm thấy phòng với mã ID {room_id}.'
            }, status=status.HTTP_404_NOT_FOUND)

        # 5. Kiểm tra trạng thái bảo trì
        if target_room.status == 'maintenance':
            return Response({
                'success': False,
                'message': f'Phòng {target_room.room_number} đang trong tình trạng bảo trì, không thể gán cho khách.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 6. Kiểm tra xung đột phòng trong khoảng thời gian lưu trú của đơn
        conflicting_status_filter = (
            Q(status__in=['confirmed', 'checked_in', 'paid', 'PAID']) |
            Q(group_booking__isnull=False, group_booking__status__in=['tentative', 'confirmed', 'checked_in']) |
            Q(status='pending', created_at__gte=timezone.now() - timezone.timedelta(minutes=15))
        )

        conflict_booking = Booking.objects.filter(
            room=target_room,
            check_in_date__lt=booking.check_out_date,
            check_out_date__gt=booking.check_in_date
        ).exclude(id=booking.id).filter(conflicting_status_filter).first()

        if conflict_booking:
            return Response({
                'success': False,
                'message': f'Phòng {target_room.room_number} đã được gán hoặc đang có đơn #{conflict_booking.booking_code} trong khoảng thời gian {conflict_booking.check_in_date.strftime("%d/%m/%Y")} - {conflict_booking.check_out_date.strftime("%d/%m/%Y")}.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 7. Gán phòng thành công (không đổi status của booking hay room)
        booking.room = target_room
        booking.save(update_fields=['room', 'updated_at'])

        return Response({
            'success': True,
            'message': f'Đã gán phòng {target_room.room_number} ({target_room.category.name if target_room.category else ""}) cho đơn {booking.booking_code}.',
            'room_id': target_room.id,
            'room_number': target_room.room_number,
            'category_name': target_room.category.name if target_room.category else ''
        }, status=status.HTTP_200_OK)


    @action(detail=False, methods=['get'], url_path='check-availability', permission_classes=[AllowAny])
    def check_availability(self, request):
        """
        API kiểm tra tình trạng còn phòng theo Hạng phòng và khoảng ngày Check-in/Check-out.
        GET /api/bookings/check-availability/?category_id=1&check_in_date=2026-10-01&check_out_date=2026-10-03
        Hoặc nếu category_id không truyền hoặc category_id='all', trả về tình trạng phòng của TẤT CẢ các hạng phòng:
        GET /api/bookings/check-availability/?check_in_date=2026-10-01&check_out_date=2026-10-03
        """
        category_id = request.query_params.get('category_id') or request.query_params.get('room_id')
        check_in_str = request.query_params.get('check_in_date')
        check_out_str = request.query_params.get('check_out_date')

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

        # Nếu không truyền category_id hoặc category_id='all', trả về tất cả
        if not category_id or str(category_id).lower() == 'all':
            availabilities = {}
            for cat in RoomCategory.objects.all():
                tot, bkd, avl = get_category_availability(cat, check_in, check_out)
                availabilities[cat.id] = {
                    'category_id': cat.id,
                    'category_name': cat.name,
                    'total_rooms': tot,
                    'booked_rooms': bkd,
                    'available_rooms': avl,
                    'is_sold_out': avl <= 0
                }
            return Response({
                'success': True,
                'check_in_date': str(check_in),
                'check_out_date': str(check_out),
                'availabilities': availabilities
            })

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
