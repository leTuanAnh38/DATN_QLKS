"""Đồ thất lạc (Lost & Found)."""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from django.utils import timezone
from ...users.models import log_action, User
from ...users.views import check_role_permission
from ...notifications.models import Notification
from ..models import Room, LostAndFoundItem
from ..serializers import LostAndFoundItemSerializer
from .permissions import IsHotelStaffOrAdmin


# =========================================================================
# 8. QUẢN LÝ ĐỒ THẤT LẠC (LOST & FOUND MANAGEMENT)
# =========================================================================

class LostAndFoundViewSet(viewsets.ModelViewSet):
    """
    CRUD Quản lý Đồ thất lạc / Tài sản khách bỏ quên (Lost & Found):
    - GET /api/rooms/lost-and-found/: Danh sách đồ thất lạc (tìm kiếm, lọc theo status, category, room)
    - POST /api/rooms/lost-and-found/: Buồng phòng khai báo đồ thất lạc
    - POST /api/rooms/lost-and-found/{id}/return/: Bàn giao trả khách
    - GET /api/rooms/lost-and-found/stats/: Thống kê số lượng theo trạng thái
    """
    queryset = LostAndFoundItem.objects.select_related('room', 'booking', 'finder', 'handled_by').order_by('-found_date')
    serializer_class = LostAndFoundItemSerializer
    permission_classes = [IsHotelStaffOrAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        category_param = self.request.query_params.get('category')
        room_id = self.request.query_params.get('room_id')
        search = self.request.query_params.get('search', '').strip()

        if status_param and status_param != 'all':
            qs = qs.filter(status=status_param)
        if category_param and category_param != 'all':
            qs = qs.filter(category=category_param)
        if room_id:
            qs = qs.filter(room_id=room_id)
        if search:
            qs = qs.filter(
                Q(tracking_code__icontains=search) |
                Q(item_name__icontains=search) |
                Q(location_found__icontains=search) |
                Q(guest_name__icontains=search) |
                Q(guest_phone__icontains=search) |
                Q(description__icontains=search)
            )
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        item_name = data.get('item_name', '').strip()
        if not item_name:
            return Response({'success': False, 'message': 'Vui lòng nhập tên đồ vật nhặt được.'}, status=status.HTTP_400_BAD_REQUEST)

        room_id = data.get('room_id') or data.get('room')
        room = None
        booking = None
        guest_name = data.get('guest_name', '').strip()
        guest_phone = data.get('guest_phone', '').strip()

        if room_id:
            try:
                room = Room.objects.get(pk=room_id)
                # Tự động gán booking và thông tin khách nếu không điền tay
                active_bk = room.bookings.filter(status='checked_in').first()
                if not active_bk:
                    active_bk = room.bookings.filter(status='completed').order_by('-actual_check_out', '-id').first()
                if active_bk:
                    booking = active_bk
                    if not guest_name:
                        if active_bk.guest:
                            guest_name = active_bk.guest.get_full_name() or active_bk.guest.username
                        elif getattr(active_bk, 'guest_name', None):
                            guest_name = str(active_bk.guest_name)
                        else:
                            guest_name = "Khách lưu trú"
                    if not guest_phone and active_bk.guest:
                        guest_phone = active_bk.guest.phone_number or ''
            except Room.DoesNotExist:
                pass

        location_found = data.get('location_found', '').strip()
        if not location_found:
            location_found = f"Phòng {room.room_number}" if room else "Khu vực khách sạn"

        finder = request.user if request.user.is_authenticated else None

        item = LostAndFoundItem.objects.create(
            room=room,
            location_found=location_found,
            item_name=item_name,
            category=data.get('category', 'other'),
            description=data.get('description', ''),
            image=request.FILES.get('image'),
            found_date=data.get('found_date') or timezone.now(),
            finder=finder,
            booking=booking,
            guest_name=guest_name,
            guest_phone=guest_phone,
            storage_location=data.get('storage_location', 'Két an toàn Lễ tân'),
            status='stored'
        )

        staff_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Nhân viên"
        try:
            recipients = User.objects.filter(
                Q(role__in=['receptionist', 'manager', 'admin']) |
                (Q(is_superuser=True) & ~Q(role__in=['owner', 'guest', 'housekeeper', 'technician', 'service_staff', 'cashier']))
            ).distinct()
            notif_title = f"[ĐỒ THẤT LẠC MỚI] #{item.tracking_code} - {item.item_name}"
            guest_info = f"Khách: {guest_name} ({guest_phone})" if guest_name else "Chưa xác định chủ nhân"
            notif_message = (
                f"Nhân viên ({staff_name}) vừa phát hiện tài sản khách bỏ quên:\n"
                f"• Món đồ: {item.item_name} ({item.get_category_display()})\n"
                f"• Vị trí: {location_found}\n"
                f"• {guest_info}\n"
                f"• Nơi cất giữ: {item.storage_location}\n"
                f"Lễ tân vui lòng rà soát hồ sơ để liên hệ trao trả khách."
            )
            notifs = [
                Notification(
                    recipient=r,
                    title=notif_title,
                    message=notif_message,
                    notification_type='room',
                    action_url='/admin/rooms',
                    priority='normal'
                )
                for r in recipients
            ]
            if notifs:
                Notification.objects.bulk_create(notifs)
        except Exception:
            pass

        log_action(
            user=request.user,
            action='CREATE',
            module='ROOM',
            description=f"Báo nhận đồ thất lạc #{item.tracking_code}: '{item.item_name}' tại {location_found}",
            request=request
        )

        return Response({
            'success': True,
            'message': f"Đã ghi nhận đồ thất lạc #{item.tracking_code}: {item.item_name}.",
            'item': LostAndFoundItemSerializer(item, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='return')
    def return_to_guest(self, request, pk=None):
        user = request.user
        user_role = getattr(user, 'role', '')
        allowed_roles = ['receptionist', 'manager', 'admin', 'owner']
        if not (user.is_authenticated and (user.is_superuser or user_role in allowed_roles)):
            return Response({
                'success': False,
                'message': 'Chỉ Lễ tân (Receptionist) hoặc Quản lý mới có quyền bàn giao đồ thất lạc cho khách.'
            }, status=status.HTTP_403_FORBIDDEN)

        item = self.get_object()
        if item.status == 'returned':
            return Response({'success': False, 'message': 'Món đồ này đã được trao trả cho khách trước đó.'}, status=status.HTTP_400_BAD_REQUEST)

        returned_to = request.data.get('returned_to', '').strip()
        if not returned_to:
            return Response({'success': False, 'message': 'Vui lòng nhập họ tên hoặc thông tin liên hệ của người nhận lại đồ.'}, status=status.HTTP_400_BAD_REQUEST)

        return_note = request.data.get('return_note', '').strip()

        item.status = 'returned'
        item.returned_date = timezone.now()
        item.returned_to = returned_to
        item.return_note = return_note
        item.handled_by = request.user if request.user.is_authenticated else None
        item.save()

        staff_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Lễ tân"
        try:
            recipients = User.objects.filter(
                Q(role__in=['manager', 'admin', 'housekeeper', 'receptionist']) |
                (Q(is_superuser=True) & ~Q(role__in=['owner', 'guest', 'technician', 'service_staff', 'cashier']))
            ).distinct()
            notif_title = f"[ĐÃ TRẢ ĐỒ THẤT LẠC] #{item.tracking_code} - {item.item_name}"
            notif_message = (
                f"Món đồ '{item.item_name}' (#{item.tracking_code}) đã được bàn giao thành công cho: {returned_to}.\n"
                f"• Nhân viên bàn giao: {staff_name}\n"
                f"• Ghi chú: {return_note or 'Đầy đủ chữ ký/xác nhận.'}"
            )
            notifs = [
                Notification(
                    recipient=r,
                    title=notif_title,
                    message=notif_message,
                    notification_type='room',
                    action_url='/admin/rooms',
                    priority='normal'
                )
                for r in recipients
            ]
            if notifs:
                Notification.objects.bulk_create(notifs)
        except Exception:
            pass

        log_action(
            user=request.user,
            action='UPDATE',
            module='ROOM',
            description=f"Bàn giao trao trả đồ thất lạc #{item.tracking_code} cho '{returned_to}'",
            request=request
        )

        return Response({
            'success': True,
            'message': f"Đã hoàn tất bàn giao trao trả món đồ #{item.tracking_code} cho {returned_to}!",
            'item': LostAndFoundItemSerializer(item, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='stats')
    def get_stats(self, request):
        qs = LostAndFoundItem.objects.all()
        total = qs.count()
        stored = qs.filter(status='stored').count()
        contacted = qs.filter(status='contacted').count()
        returned = qs.filter(status='returned').count()
        disposed = qs.filter(status='disposed').count()
        return Response({
            'success': True,
            'total': total,
            'stored': stored,
            'contacted': contacted,
            'returned': returned,
            'disposed': disposed,
            'return_rate': round((returned / total * 100), 1) if total > 0 else 0
        }, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_superuser or check_role_permission(request.user, 'rooms', 'delete')):
            return Response(
                {'success': False, 'message': 'Chỉ Quản lý hoặc Quản trị viên mới có quyền xóa vĩnh viễn phiếu đồ thất lạc.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)
