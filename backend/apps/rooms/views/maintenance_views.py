"""Phiếu bảo trì phòng."""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q, Case, When, Value, IntegerField
from django.utils import timezone
from ...users.models import log_action, User
from ...bookings.models import Booking, BookingExtraService
from ...notifications.models import Notification
from ..models import Room, MaintenanceTicket
from ..serializers import RoomSerializer, MaintenanceTicketSerializer
from .permissions import IsHotelStaffOrAdmin


# =========================================================================
# 5. API QUẢN LÝ PHIẾU BẢO TRÌ & THIẾT BỊ HỎNG
# =========================================================================

class MaintenanceTicketViewSet(viewsets.ModelViewSet):
    """
    API Quản lý Phiếu Bảo Trì & Sửa Chữa Thiết Bị Phòng:
    - GET /api/rooms/maintenance-tickets/: Danh sách phiếu bảo trì
    - POST /api/rooms/maintenance-tickets/: Báo hỏng thiết bị (Tự động chuyển phòng sang 'maintenance')
    - POST /api/rooms/maintenance-tickets/{id}/complete/: Hoàn thành sửa chữa (Tự động chuyển phòng sang 'cleaning' để buồng phòng dọn dẹp)
    """
    queryset = MaintenanceTicket.objects.select_related('room', 'booking', 'booking__guest', 'technician', 'created_by')
    serializer_class = MaintenanceTicketSerializer
    permission_classes = [IsHotelStaffOrAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        room_id = self.request.query_params.get('room_id') or self.request.query_params.get('room')
        status_param = self.request.query_params.get('status')
        if room_id:
            qs = qs.filter(room_id=room_id)
        if status_param:
            qs = qs.filter(status=status_param)

        # Ưu tiên phiếu Đang sửa chữa (status='fixing') lên ĐẦU danh sách, trong đó sự cố khẩn cấp (urgent/high) lên trước
        qs = qs.annotate(
            status_priority=Case(
                When(status='fixing', then=Value(0)),
                When(status='completed', then=Value(1)),
                When(status='cancelled', then=Value(2)),
                default=Value(3),
                output_field=IntegerField()
            ),
            urgency_priority=Case(
                When(priority='urgent', then=Value(0)),
                When(priority='high', then=Value(1)),
                When(priority='normal', then=Value(2)),
                When(priority='low', then=Value(3)),
                default=Value(2),
                output_field=IntegerField()
            )
        ).order_by('status_priority', 'urgency_priority', '-start_date', '-id')

        return qs

    def create(self, request, *args, **kwargs):
        room_id = request.data.get('room') or request.data.get('room_id')
        if not room_id:
            return Response({'success': False, 'message': 'Thiếu thông tin phòng cần bảo trì.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            room = Room.objects.get(pk=room_id)
        except Room.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy phòng.'}, status=status.HTTP_404_NOT_FOUND)

        equipment_name = request.data.get('equipment_name', '').strip()
        if not equipment_name:
            return Response({'success': False, 'message': 'Vui lòng nhập tên thiết bị bị hư hỏng.'}, status=status.HTTP_400_BAD_REQUEST)

        issue_type = request.data.get('issue_type', 'ac')
        priority = request.data.get('priority') or ('urgent' if room.status == 'occupied' else 'normal')
        description = request.data.get('description', '')
        parts_replaced = request.data.get('parts_replaced', '')
        cost = int(request.data.get('cost') or 0)
        is_guest_fault_val = request.data.get('is_guest_fault', False)
        is_guest_fault = is_guest_fault_val in [True, 'true', 'True', '1', 1]
        booking_id = request.data.get('booking') or request.data.get('booking_id')
        technician_id = request.data.get('technician') or request.data.get('technician_id')

        booking = None
        if booking_id:
            booking = Booking.objects.filter(pk=booking_id).first()
        else:
            booking = room.bookings.filter(status='checked_in').first()
            if not booking and is_guest_fault:
                # Dự phòng khi khách đang làm thủ tục trả phòng hoặc vừa check-out (trong 24h)
                cutoff = timezone.now() - timezone.timedelta(hours=24)
                booking = room.bookings.filter(
                    status='completed',
                    actual_check_out__gte=cutoff
                ).order_by('-actual_check_out', '-id').first()

        technician = None
        if technician_id:
            technician = User.objects.filter(pk=technician_id).first()

        image_before = request.FILES.get('image_before') or request.FILES.get('image')

        ticket = MaintenanceTicket.objects.create(
            room=room,
            equipment_name=equipment_name,
            issue_type=issue_type,
            priority=priority,
            description=description,
            parts_replaced=parts_replaced,
            cost=cost,
            is_guest_fault=is_guest_fault,
            booking=booking,
            technician=technician,
            created_by=request.user if request.user.is_authenticated else None,
            status='fixing',
            image_before=image_before
        )

        # 1. CÁCH LY PHÒNG: Tự động chuyển phòng sang 'maintenance'
        room.status = 'maintenance'
        room.save(update_fields=['status'])

        # 2. XỬ LÝ TIỀN ĐỀN BÙ: Nếu khách làm hỏng và có đơn đặt phòng + chi phí > 0 (Chống trùng lặp với MinibarCheck)
        if is_guest_fault and booking and cost > 0:
            existing_damage_bes = BookingExtraService.objects.filter(
                booking=booking,
                is_paid=False
            ).filter(
                Q(service_name__icontains=f"Bồi thường hỏng thiết bị: {equipment_name}") |
                Q(service_name__icontains=f"[Đền bù hư hại] {equipment_name}")
            ).first()
            if existing_damage_bes:
                existing_damage_bes.price = cost
                existing_damage_bes.save(update_fields=['price'])
            else:
                BookingExtraService.objects.create(
                    booking=booking,
                    service_name=f"[P.{room.room_number}] Bồi thường hỏng thiết bị: {equipment_name}",
                    quantity=1,
                    price=cost,
                    is_paid=False
                )

            # Đồng bộ sang phiếu MinibarCheck đang mở của phòng/booking (để Lễ tân thấy ngay trên CheckOutModal)
            pending_mc = room.minibar_checks.filter(booking=booking).order_by('-created_at').first()
            if pending_mc:
                pending_mc.has_damage = True
                desc_str = f"{equipment_name}: {description}".strip(': ')
                pending_mc.damage_description = (
                    f"{pending_mc.damage_description}; {desc_str}".strip('; ')
                    if pending_mc.damage_description and equipment_name not in pending_mc.damage_description
                    else desc_str
                )
                pending_mc.damage_amount = max(float(pending_mc.damage_amount or 0), float(cost))
                if pending_mc.status == 'requested':
                    pending_mc.status = 'completed'
                    pending_mc.completed_at = timezone.now()
                pending_mc.save()

        # 3. Ghi nhận Nhật ký thao tác
        fault_text = f" (Khách bồi thường {cost:,.0f} đ)" if (is_guest_fault and cost > 0) else " (Bảo dưỡng khách sạn)"
        log_action(
            user=request.user,
            action='CREATE',
            module='ROOM',
            description=f"Lập phiếu bảo trì #{ticket.ticket_code} cho phòng {room.room_number}: {equipment_name}{fault_text}",
            request=request
        )

        # 4. GỬI THÔNG BÁO TỰ ĐỘNG ĐẾN KỸ THUẬT VIÊN VÀ QUẢN LÝ
        try:
            reporter_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Nhân viên"
            tech_users = User.objects.filter(
                Q(role__in=['technician', 'receptionist', 'admin', 'manager']) |
                (Q(is_superuser=True) & ~Q(role__in=['owner', 'guest', 'housekeeper', 'service_staff', 'cashier']))
            ).distinct()
            fault_note = "Do khách làm hỏng (Bồi thường)" if is_guest_fault else "Bảo dưỡng khách sạn"
            issue_labels = {
                'ac': 'Điều hòa / Máy lạnh',
                'electric': 'Điện / Đèn / Ổ cắm',
                'water': 'Nước / Vòi / Cống / Toilet',
                'lock': 'Khóa từ / Cửa phòng',
                'tv': 'Tivi / Remote / Mạng',
                'furniture': 'Nội thất / Giường / Tủ / Ghế',
                'broken_item': 'Vật dụng bể vỡ',
                'other': 'Khác'
            }
            issue_display = issue_labels.get(issue_type, issue_type)
            notif_title = f"[BẢO TRÌ] P.{room.room_number} báo hỏng: {equipment_name}"
            notif_message = (
                f"Phòng {room.room_number} vừa được chuyển sang 'Bảo trì' cần kiểm tra gấp:\n"
                f"• Thiết bị: {equipment_name} ({issue_display})\n"
                f"• Chi tiết: {description or 'Cần kỹ thuật đến kiểm tra'}\n"
                f"• Phân loại: {fault_note}\n"
                f"• Người báo: {reporter_name}\n"
                f"• Mã phiếu: #{ticket.ticket_code}"
            )
            notifs = [
                Notification(
                    recipient=recipient,
                    title=notif_title,
                    message=notif_message,
                    notification_type='room',
                    action_url='/admin/rooms',
                    priority='high'
                )
                for recipient in tech_users
            ]
            if notifs:
                Notification.objects.bulk_create(notifs)
        except Exception as e:
            pass

        all_rooms = Room.objects.all()
        stats_data = {
            'total': all_rooms.count(),
            'available': all_rooms.filter(status='available').count(),
            'occupied': all_rooms.filter(status='occupied').count(),
            'cleaning': all_rooms.filter(status='cleaning').count(),
            'maintenance': all_rooms.filter(status='maintenance').count(),
        }

        return Response({
            'success': True,
            'message': f'Đã lập phiếu bảo trì #{ticket.ticket_code} và chuyển phòng {room.room_number} sang "Đang bảo trì".',
            'ticket': MaintenanceTicketSerializer(ticket).data,
            'room': RoomSerializer(room).data,
            'stats': stats_data
        }, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        user = request.user
        user_role = getattr(user, 'role', '')
        if not (user.is_authenticated and (user.is_superuser or user_role in ['admin', 'owner', 'manager'])):
            return Response({
                'success': False,
                'message': 'Chỉ Quản lý hoặc Quản trị viên mới có quyền xóa phiếu bảo trì.'
            }, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post', 'patch'], url_path='complete')
    def complete_maintenance(self, request, pk=None):
        user = request.user
        user_role = getattr(user, 'role', '')
        allowed_roles = ['technician', 'manager', 'admin', 'owner']
        if not (user.is_authenticated and (user.is_superuser or user_role in allowed_roles)):
            return Response({
                'success': False,
                'message': 'Chỉ Kỹ thuật viên (Technician) hoặc Quản lý mới có quyền nghiệm thu hoàn tất phiếu bảo trì.'
            }, status=status.HTTP_403_FORBIDDEN)

        ticket = self.get_object()
        if ticket.status == 'completed':
            return Response({'success': False, 'message': 'Phiếu bảo trì này đã hoàn tất trước đó.'}, status=status.HTTP_400_BAD_REQUEST)

        parts_replaced = request.data.get('parts_replaced', ticket.parts_replaced)
        cost = int(request.data.get('cost') or ticket.cost or 0)
        note = request.data.get('note', '')
        is_guest_fault_val = request.data.get('is_guest_fault')
        if is_guest_fault_val is not None:
            ticket.is_guest_fault = is_guest_fault_val in [True, 'true', 'True', '1', 1]

        ticket.parts_replaced = parts_replaced
        ticket.cost = cost
        ticket.note = note
        ticket.completed_date = timezone.now()
        ticket.status = 'completed'

        image_after = request.FILES.get('image_after') or request.FILES.get('image')
        if image_after:
            ticket.image_after = image_after

        if request.user.is_authenticated and not ticket.technician:
            ticket.technician = request.user
        ticket.save()

        # Cập nhật chi phí bồi thường nếu có
        if ticket.is_guest_fault and ticket.booking and cost > 0:
            bes = BookingExtraService.objects.filter(
                booking=ticket.booking,
                is_paid=False
            ).filter(
                Q(service_name__icontains=f"Bồi thường hỏng thiết bị: {ticket.equipment_name}") |
                Q(service_name__icontains=f"[Đền bù hư hại] {ticket.equipment_name}")
            ).first()
            if bes:
                bes.price = cost
                bes.save(update_fields=['price'])
            else:
                BookingExtraService.objects.create(
                    booking=ticket.booking,
                    service_name=f"[P.{ticket.room.room_number}] Bồi thường hỏng thiết bị: {ticket.equipment_name}",
                    quantity=1,
                    price=cost,
                    is_paid=False
                )
        elif ticket.booking:
            # Nếu nghiệm thu xác nhận không phải lỗi khách hoặc chi phí = 0: Gỡ phụ phí chưa thanh toán khỏi hóa đơn
            BookingExtraService.objects.filter(
                booking=ticket.booking,
                is_paid=False
            ).filter(
                Q(service_name__icontains=f"Bồi thường hỏng thiết bị: {ticket.equipment_name}") |
                Q(service_name__icontains=f"[Đền bù hư hại] {ticket.equipment_name}")
            ).delete()

        # 4. QUY TRÌNH BÀN GIAO:
        # Chỉ chuyển phòng từ 'maintenance' sang 'cleaning' khi phòng KHÔNG còn phiếu bảo trì nào khác đang 'fixing'
        room = ticket.room
        remaining_fixing = room.maintenance_tickets.filter(status='fixing').exclude(pk=ticket.pk).exists()
        if not remaining_fixing:
            room.status = 'cleaning'
            room.save(update_fields=['status'])

        log_action(
            user=request.user,
            action='UPDATE',
            module='ROOM',
            description=f"Hoàn tất bảo trì #{ticket.ticket_code} phòng {room.room_number} ({ticket.equipment_name}). Bàn giao Buồng phòng vệ sinh.",
            request=request
        )

        # 5. GỬI THÔNG BÁO TỰ ĐỘNG ĐẾN BUỒNG PHÒNG VÀ LỄ TÂN/QUẢN LÝ
        try:
            tech_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Kỹ thuật viên"
            housekeeping_users = User.objects.filter(
                Q(role__in=['housekeeper', 'receptionist', 'admin']) |
                (Q(is_superuser=True) & ~Q(role__in=['owner', 'manager', 'guest', 'technician', 'service_staff', 'cashier']))
            ).distinct()
            active_booking = room.bookings.filter(status='checked_in').select_related('guest').first()
            guest_display = (active_booking.guest.get_full_name() or active_booking.guest.username) if (active_booking and active_booking.guest) else "Khách lưu trú"
            guest_stay_note = f"\n• Lưu ý: Phòng đang có khách lưu trú ({guest_display} - #{active_booking.booking_code})." if active_booking else ""
            action_instruction = "Kính mời bộ phận Buồng phòng hỗ trợ lau dọn sạch sẽ để khách tiếp tục sinh hoạt!" if active_booking else "Kính mời bộ phận Buồng phòng tiến hành vệ sinh, thay ga gối để sẵn sàng đón khách!"

            parts_info = ticket.parts_replaced or "Không có (Sửa chữa/Bảo dưỡng)"
            cost_info = f"{int(ticket.cost):,} VNĐ" if ticket.cost else "0 VNĐ (Không phát sinh)"

            notif_title = f"[BÀN GIAO DỌN DẸP] Phòng {room.room_number} đã sửa xong!"
            notif_message = (
                f"Kỹ thuật viên ({tech_name}) đã hoàn tất sửa chữa thiết bị tại phòng {room.room_number}:\n"
                f"• Thiết bị: {ticket.equipment_name}\n"
                f"• Vật tư thay thế: {parts_info}\n"
                f"• Chi phí: {cost_info}\n"
                f"• Trạng thái mới: Đang dọn dẹp (Cleaning){guest_stay_note}\n"
                f"{action_instruction}"
            )
            notifs = [
                Notification(
                    recipient=recipient,
                    title=notif_title,
                    message=notif_message,
                    notification_type='room',
                    action_url='/admin/rooms',
                    priority='normal'
                )
                for recipient in housekeeping_users
            ]
            if notifs:
                Notification.objects.bulk_create(notifs)
        except Exception as e:
            pass

        all_rooms = Room.objects.all()
        stats_data = {
            'total': all_rooms.count(),
            'available': all_rooms.filter(status='available').count(),
            'occupied': all_rooms.filter(status='occupied').count(),
            'cleaning': all_rooms.filter(status='cleaning').count(),
            'maintenance': all_rooms.filter(status='maintenance').count(),
        }

        return Response({
            'success': True,
            'message': f'Đã hoàn tất sửa chữa phòng {room.room_number}! Phòng đã được chuyển giao cho bộ phận Buồng phòng dọn dẹp.',
            'ticket': MaintenanceTicketSerializer(ticket).data,
            'room': RoomSerializer(room).data,
            'stats': stats_data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='claim')
    def claim_ticket(self, request, pk=None):
        """
        Kỹ thuật viên nhận xử lý phiếu sự cố:
        POST /api/rooms/maintenance-tickets/{id}/claim/
        """
        user = request.user
        user_role = getattr(user, 'role', '')
        allowed_roles = ['technician', 'manager', 'admin', 'owner']
        if not (user.is_authenticated and (user.is_superuser or user_role in allowed_roles)):
            return Response({
                'success': False,
                'message': 'Chỉ Kỹ thuật viên (Technician) hoặc Quản lý mới có quyền nhận xử lý phiếu bảo trì.'
            }, status=status.HTTP_403_FORBIDDEN)

        ticket = self.get_object()
        if ticket.status in ['completed', 'cancelled']:
            return Response({
                'success': False,
                'message': f'Phiếu bảo trì này đã {ticket.get_status_display().lower()}, không thể nhận xử lý.'
            }, status=status.HTTP_400_BAD_REQUEST)

        tech_name = request.user.get_full_name() or request.user.username
        ticket.technician = request.user
        ticket.save(update_fields=['technician'])

        log_action(
            user=request.user,
            action='UPDATE',
            module='ROOM',
            description=f"Kỹ thuật viên {tech_name} tiếp nhận xử lý phiếu #{ticket.ticket_code} phòng {ticket.room.room_number}",
            request=request
        )

        return Response({
            'success': True,
            'message': f'Bạn ({tech_name}) đã tiếp nhận xử lý phiếu #{ticket.ticket_code} (Phòng {ticket.room.room_number}).',
            'ticket': MaintenanceTicketSerializer(ticket).data
        })

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_ticket(self, request, pk=None):
        """
        Kỹ thuật viên / Lễ tân / Quản lý hủy phiếu bảo trì (Báo nhầm, thiết bị bình thường):
        POST /api/rooms/maintenance-tickets/{id}/cancel/
        Body: { reason: "Khách bấm nhầm remote / Cắm lại phích điện" }
        """
        user = request.user
        user_role = getattr(user, 'role', '')
        allowed_roles = ['technician', 'manager', 'admin', 'owner', 'receptionist']
        if not (user.is_authenticated and (user.is_superuser or user_role in allowed_roles)):
            return Response({
                'success': False,
                'message': 'Chỉ Kỹ thuật viên, Lễ tân hoặc Quản lý mới có quyền hủy phiếu bảo trì.'
            }, status=status.HTTP_403_FORBIDDEN)

        ticket = self.get_object()
        if ticket.status == 'completed':
            return Response({
                'success': False,
                'message': 'Phiếu bảo trì này đã hoàn tất nghiệm thu trước đó, không thể hủy.'
            }, status=status.HTTP_400_BAD_REQUEST)

        cancel_reason = request.data.get('reason', '').strip()
        ticket.status = 'cancelled'
        ticket.completed_date = timezone.now()
        if cancel_reason:
            ticket.note = f"Đã hủy phiếu: {cancel_reason}"
        if not ticket.technician and request.user.is_authenticated:
            ticket.technician = request.user
        ticket.save()

        # Khôi phục trạng thái phòng phù hợp theo State Machine khách sạn 5 sao:
        # - Nếu vẫn còn phiếu bảo trì khác đang sửa ('fixing') -> giữ nguyên 'maintenance'
        # - Nếu phòng đang có khách lưu trú ('checked_in') -> về 'occupied'
        # - Nếu không có khách -> về 'cleaning' để Buồng phòng kiểm tra vệ sinh trước khi mở bán
        room = ticket.room
        has_other_fixing = room.maintenance_tickets.filter(status='fixing').exclude(id=ticket.id).exists()
        active_booking = room.bookings.filter(status='checked_in').first()
        if has_other_fixing:
            room.status = 'maintenance'
        elif active_booking:
            room.status = 'occupied'
        else:
            room.status = 'cleaning'
        room.save(update_fields=['status'])

        # Gỡ khoản bồi thường chưa thanh toán nếu có lập trước đó
        if ticket.booking:
            BookingExtraService.objects.filter(
                booking=ticket.booking,
                is_paid=False
            ).filter(
                Q(service_name__contains=f"Bồi thường hỏng thiết bị: {ticket.equipment_name}") |
                Q(service_name__contains=f"[Đền bù hư hại] {ticket.equipment_name}")
            ).delete()

        staff_name = request.user.get_full_name() or request.user.username
        log_action(
            user=request.user,
            action='UPDATE',
            module='ROOM',
            description=f"Hủy phiếu bảo trì #{ticket.ticket_code} phòng {room.room_number}. Lý do: {cancel_reason or 'Không phát sinh hỏng hóc'}",
            request=request
        )

        # Gửi thông báo đến Lễ tân & Buồng phòng
        try:
            recipients = User.objects.filter(
                Q(role__in=['receptionist', 'housekeeper', 'manager', 'admin']) |
                (Q(is_superuser=True) & ~Q(role__in=['owner', 'guest', 'service_staff', 'cashier']))
            ).distinct()
            notifs = [
                Notification(
                    recipient=r,
                    title=f"ℹ️ [HỦY BẢO TRÌ] P.{room.room_number} trở lại bình thường",
                    message=(
                        f"Phiếu bảo trì #{ticket.ticket_code} phòng {room.room_number} đã được HỦY bởi {staff_name}.\n"
                        f"• Lý do: {cancel_reason or 'Thiết bị hoạt động bình thường / Báo nhầm'}\n"
                        f"• Trạng thái phòng hiện tại: {room.get_status_display()}."
                    ),
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

        all_rooms = Room.objects.all()
        stats_data = {
            'total': all_rooms.count(),
            'available': all_rooms.filter(status='available').count(),
            'occupied': all_rooms.filter(status='occupied').count(),
            'cleaning': all_rooms.filter(status='cleaning').count(),
            'maintenance': all_rooms.filter(status='maintenance').count(),
        }

        return Response({
            'success': True,
            'message': f'Đã hủy phiếu #{ticket.ticket_code}! Phòng {room.room_number} đã khôi phục trạng thái "{room.get_status_display()}".',
            'ticket': MaintenanceTicketSerializer(ticket).data,
            'room': RoomSerializer(room).data,
            'stats': stats_data
        }, status=status.HTTP_200_OK)
