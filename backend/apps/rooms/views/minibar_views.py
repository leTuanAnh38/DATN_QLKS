"""Minibar: danh mục và kiểm tra minibar."""
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from django.utils import timezone
from ...users.models import log_action, User
from ...bookings.models import Booking, BookingExtraService
from ...notifications.models import Notification
from ..models import Room, MaintenanceTicket, MinibarItem, MinibarCheck
from ..serializers import MinibarItemSerializer, MinibarCheckSerializer
from .permissions import IsHotelStaffOrAdmin, IsManagerOrAdminOnly


# =========================================================================
# 7. QUẢN LÝ MINIBAR PHÒNG (Cho Buồng phòng kiểm kê & Lễ tân quyết toán)
# =========================================================================

class MinibarItemViewSet(viewsets.ModelViewSet):
    """
    CRUD danh mục đồ minibar trang bị trong phòng (Nước khoáng, Nước ngọt, Bia, Snack...).
    """
    queryset = MinibarItem.objects.filter(is_active=True).order_by('category', 'name')
    serializer_class = MinibarItemSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        # Mọi nhân viên (Buồng phòng, Lễ tân) có thể xem danh mục minibar để kiểm kê
        if self.request.method in ['GET', 'HEAD', 'OPTIONS']:
            return [IsHotelStaffOrAdmin()]
        # Thêm mới, sửa giá, xóa món, bật/tắt bán: Chỉ Quản lý / Admin / Chủ KS
        return [IsManagerOrAdminOnly()]

    def get_queryset(self):
        qs = MinibarItem.objects.all().order_by('category', 'name')
        active_only = self.request.query_params.get('active_only')
        if active_only == 'true':
            qs = qs.filter(is_active=True)
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return qs


class MinibarCheckViewSet(viewsets.ModelViewSet):
    """
    Quản lý Phiếu Kiểm Kê Minibar:
    - GET /api/rooms/minibar-checks/?room_id=...
    - POST /api/rooms/minibar-checks/: Buồng phòng gửi kết quả kiểm tra minibar -> Tự động đồng bộ vào Folio thanh toán!
    """
    queryset = MinibarCheck.objects.select_related('room', 'booking', 'booking__guest', 'inspector', 'requested_by').order_by('-created_at')
    serializer_class = MinibarCheckSerializer
    permission_classes = [IsHotelStaffOrAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        room_id = self.request.query_params.get('room_id')
        booking_id = self.request.query_params.get('booking_id')
        if room_id:
            qs = qs.filter(room_id=room_id)
        if booking_id:
            qs = qs.filter(booking_id=booking_id)
        return qs

    @action(detail=False, methods=['post'], url_path='request-inspection')
    def request_inspection(self, request):
        """
        API Lễ tân bấm 'Yêu cầu kiểm phòng' trước khi Check-out:
        POST /api/rooms/minibar-checks/request-inspection/
        Body: { room_id, booking_id, note }
        """
        room_id = request.data.get('room_id') or request.data.get('room')
        if not room_id:
            return Response({'success': False, 'message': 'Thiếu ID phòng cần kiểm tra.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            room = Room.objects.get(pk=room_id)
        except Room.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy phòng tương ứng.'}, status=status.HTTP_404_NOT_FOUND)

        booking_id = request.data.get('booking_id') or request.data.get('booking')
        booking = None
        if booking_id:
            booking = Booking.objects.filter(pk=booking_id).first()
        if not booking:
            booking = room.bookings.filter(status='checked_in').first()

        note = request.data.get('note', '').strip() or 'Lễ tân yêu cầu kiểm phòng Check-out (Minibar & Hư hại)'

        # Kiểm tra xem phòng đã có phiếu check 'requested' nào đang chờ chưa
        pending_check = room.minibar_checks.filter(status='requested').order_by('-created_at').first()
        if pending_check:
            pending_check.requested_by = request.user if request.user.is_authenticated else None
            pending_check.note = note
            if booking:
                pending_check.booking = booking
            pending_check.save()
            check = pending_check
        else:
            check = MinibarCheck.objects.create(
                room=room,
                booking=booking,
                requested_by=request.user if request.user.is_authenticated else None,
                status='requested',
                items_consumed=[],
                total_amount=0,
                note=note
            )

        receptionist_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Lễ tân"
        guest_name_str = ""
        if booking:
            if booking.guest:
                guest_name_str = booking.guest.get_full_name() or booking.guest.username
            elif getattr(booking, 'guest_name', None):
                guest_name_str = str(booking.guest_name)
            elif getattr(booking, 'identity_card', None):
                guest_name_str = f"CCCD {booking.identity_card}"
            else:
                guest_name_str = "Khách lưu trú"
        guest_label = f" (Khách #{booking.booking_code} - {guest_name_str})" if booking else ""

        # Gửi thông báo đến Buồng phòng (housekeeper) và Quản lý (manager, admin)
        try:
            recipients = User.objects.filter(
                Q(role__in=['housekeeper', 'receptionist', 'admin']) |
                (Q(is_superuser=True) & ~Q(role__in=['owner', 'manager', 'guest', 'technician', 'service_staff', 'cashier']))
            ).distinct()
            notif_title = f"[YÊU CẦU KIỂM PHÒNG] Phòng {room.room_number}{guest_label}"
            notif_message = (
                f"Lễ tân ({receptionist_name}) vừa gửi yêu cầu kiểm tra phòng {room.room_number}.\n"
                f"Khách đang làm thủ tục trả phòng tại quầy. Vui lòng kiểm tra Minibar và Hư hại tài sản!"
            )
            notifs = [
                Notification(
                    recipient=r,
                    title=notif_title,
                    message=notif_message,
                    notification_type='room',
                    action_url='/admin/rooms',
                    priority='high'
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
            description=f"Lễ tân {receptionist_name} yêu cầu kiểm phòng {room.room_number} trước khi Check-out.",
            request=request
        )

        return Response({
            'success': True,
            'message': f"Đã gửi yêu cầu kiểm tra phòng {room.room_number} đến bộ phận Buồng phòng!",
            'check': MinibarCheckSerializer(check).data,
            'room_id': room.id,
            'booking_id': booking.id if booking else None
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='latest')
    def latest(self, request):
        """
        API Lấy phiếu kiểm tra phòng gần nhất:
        GET /api/rooms/minibar-checks/latest/?room_id=...&booking_id=...
        """
        room_id = request.query_params.get('room_id')
        booking_id = request.query_params.get('booking_id')
        qs = self.get_queryset()
        if booking_id and room_id:
            qs = qs.filter(Q(booking_id=booking_id) | Q(room_id=room_id, booking__isnull=True))
        elif booking_id:
            qs = qs.filter(booking_id=booking_id)
        elif room_id:
            qs = qs.filter(room_id=room_id)
        else:
            return Response({'success': False, 'message': 'Thiếu tham số room_id hoặc booking_id.'}, status=status.HTTP_400_BAD_REQUEST)

        latest_check = qs.order_by('-completed_at', '-created_at').first()
        if not latest_check:
            return Response({'success': True, 'check': None}, status=status.HTTP_200_OK)

        return Response({'success': True, 'check': MinibarCheckSerializer(latest_check, context={'request': request}).data}, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        room_id = request.data.get('room_id') or request.data.get('room')
        if not room_id:
            return Response({'success': False, 'message': 'Thiếu thông tin số phòng kiểm kê.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            room = Room.objects.get(pk=room_id)
        except Room.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy phòng tương ứng.'}, status=status.HTTP_404_NOT_FOUND)

        items_consumed = request.data.get('items', [])
        if isinstance(items_consumed, str):
            import json
            try:
                items_consumed = json.loads(items_consumed)
            except Exception:
                items_consumed = []

        import re
        note = re.sub(r'\s*\[DAMAGE_IMG:.*?\]', '', str(request.data.get('note', '') or '')).strip()
        booking_id = request.data.get('booking_id') or request.data.get('booking')
        has_damage_val = request.data.get('has_damage', False)
        has_damage = has_damage_val in [True, 'true', 'True', '1', 1]
        damage_desc = str(request.data.get('damage_description', '') or '').strip()
        raw_dmg_amt = str(request.data.get('damage_amount') or '0').replace(',', '').replace('.', '').replace(' ', '').strip()
        try:
            damage_amt = float(raw_dmg_amt) if raw_dmg_amt else 0.0
        except (ValueError, TypeError):
            damage_amt = float(request.data.get('damage_amount') or 0)
        check_id = request.data.get('check_id')

        booking = None
        if booking_id and str(booking_id) not in ['', 'null', 'undefined', 'None']:
            booking = Booking.objects.filter(pk=booking_id).first()
        if not booking:
            # Tự động tìm booking: ưu tiên checked_in, nếu không có lấy booking vừa completed gần nhất (trong vòng 24h)
            booking = room.bookings.filter(status='checked_in').first()
            if not booking:
                booking = room.bookings.filter(status='completed').order_by('-actual_check_out', '-id').first()

        # Tính tổng tiền và lọc các món có tiêu thụ
        valid_consumed = []
        total_amount = 0
        for it in items_consumed:
            qty = int(it.get('quantity') or 0)
            if qty > 0:
                price = float(it.get('price') or 0)
                name = it.get('name') or 'Mặt hàng minibar'
                subtotal = qty * price
                total_amount += subtotal
                valid_consumed.append({
                    'item_id': it.get('id') or it.get('item_id'),
                    'name': name,
                    'price': price,
                    'quantity': qty,
                    'total': subtotal
                })

        now = timezone.now()
        # Tìm phiếu requested đang chờ (nếu có) để hoàn tất cập nhật
        check = None
        if check_id and str(check_id) not in ['', 'null', 'undefined', 'None']:
            check = MinibarCheck.objects.filter(pk=check_id).first()
        if not check:
            check = room.minibar_checks.filter(status='requested').order_by('-created_at').first()
        if not check and booking:
            check = booking.minibar_checks.filter(status='requested').order_by('-created_at').first()

        # Giữ lại ảnh bằng chứng cũ nếu phiếu đã có và lần gửi này không đính kèm ảnh mới
        prev_damage_img_url = None
        if check and check.note:
            prev_match = re.search(r'\[DAMAGE_IMG:(.*?)\]', check.note)
            if prev_match:
                prev_damage_img_url = prev_match.group(1).strip()

        req_maint_val = request.data.get('requires_maintenance', False)
        requires_maintenance = req_maint_val in [True, 'true', 'True', '1', 1]
        image_before = request.FILES.get('image_before') or request.FILES.get('image')
        saved_damage_img_url = prev_damage_img_url if has_damage else None

        # Lưu ảnh minh chứng hiện trường ngay cả khi là hư hại đồ rời (vỡ cốc, bẩn khăn...) không cần gọi Kỹ thuật
        if has_damage and image_before and not requires_maintenance:
            try:
                from django.core.files.storage import default_storage
                import os, uuid
                ext = os.path.splitext(image_before.name)[1] or '.jpg'
                saved_path = default_storage.save(f"maintenance/before/minibar_{uuid.uuid4().hex[:8].upper()}{ext}", image_before)
                saved_damage_img_url = default_storage.url(saved_path)
            except Exception:
                pass

        stored_note = f"{note} [DAMAGE_IMG:{saved_damage_img_url}]".strip() if (has_damage and saved_damage_img_url) else note

        if check:
            check.status = 'completed'
            check.items_consumed = valid_consumed
            check.total_amount = total_amount
            check.has_damage = has_damage
            check.damage_description = damage_desc if has_damage else ''
            check.damage_amount = damage_amt if has_damage else 0
            check.note = stored_note
            check.inspector = request.user if request.user.is_authenticated else None
            check.completed_at = now
            if booking and not check.booking:
                check.booking = booking
            check.save()
        else:
            check = MinibarCheck.objects.create(
                room=room,
                booking=booking,
                inspector=request.user if request.user.is_authenticated else None,
                status='completed',
                items_consumed=valid_consumed,
                total_amount=total_amount,
                has_damage=has_damage,
                damage_description=damage_desc if has_damage else '',
                damage_amount=damage_amt if has_damage else 0,
                note=stored_note,
                completed_at=now
            )

        extra_services_created = 0
        maintenance_ticket_created = None
        room_prefix = f"[P.{room.room_number}]"
        if booking:
            # Xóa các khoản Minibar / Đền bù hư hại CHƯA THANH TOÁN của lần kiểm kê trước (tránh nhân đôi công nợ khi gửi lại phiếu)
            BookingExtraService.objects.filter(
                booking=booking,
                is_paid=False
            ).filter(
                Q(service_name__startswith='[Minibar]') |
                Q(service_name__startswith=f'{room_prefix} [Minibar]')
            ).delete()
            BookingExtraService.objects.filter(
                booking=booking,
                is_paid=False
            ).filter(
                Q(service_name__startswith='[Đền bù hư hại]') |
                Q(service_name__startswith=f'{room_prefix} [Đền bù hư hại]')
            ).delete()

            # 1. Tự động đồng bộ các món Minibar vào BookingExtraService (Gắn rõ số phòng cho Hóa đơn đoàn)
            if valid_consumed:
                for it in valid_consumed:
                    BookingExtraService.objects.create(
                        booking=booking,
                        service_name=f"{room_prefix} [Minibar] {it['name']}",
                        quantity=it['quantity'],
                        price=it['price'],
                        is_paid=False
                    )
                    extra_services_created += 1

            # 2. Tự động đồng bộ khoản Đền bù hư hại (nếu có) vào BookingExtraService
            if has_damage and damage_amt > 0:
                damage_label = damage_desc or "Bồi thường hư hại phòng"
                # Chỉ bỏ qua nếu chính hạng mục hư hại này đã được tính phí từ phiếu bảo trì trùng tên
                already_billed_by_ticket = BookingExtraService.objects.filter(
                    booking=booking,
                    service_name__icontains=f"Bồi thường hỏng thiết bị: {damage_label}"
                ).exists()
                if not already_billed_by_ticket:
                    BookingExtraService.objects.create(
                        booking=booking,
                        service_name=f"{room_prefix} [Đền bù hư hại] {damage_label}",
                        quantity=1,
                        price=damage_amt,
                        is_paid=False
                    )
                    extra_services_created += 1

        # 3. Phân tách rõ nghiệp vụ khách sạn 5 sao:
        # - Hư hại vật tư tiêu hao/đồ dùng rời (vỡ ly, cốc, bẩn khăn...): Chỉ tính phí đền bù vào Folio cho Thu ngân, Buồng phòng tự thay mới trong lúc dọn (KHÔNG chuyển sang MAINTENANCE).
        # - Chỉ khi có cờ requires_maintenance=True (hỏng thiết bị kỹ thuật cố định cần thợ sửa): Mới tạo MaintenanceTicket và báo Kỹ thuật viên.
        if has_damage and requires_maintenance and (damage_desc or damage_amt > 0):
            damage_label = damage_desc or "Thiết bị phòng hư hại khi kiểm phòng"
            existing_ticket = room.maintenance_tickets.filter(status='fixing').first()
            if not existing_ticket:
                maintenance_ticket_created = MaintenanceTicket.objects.create(
                    room=room,
                    booking=booking,
                    created_by=request.user if request.user.is_authenticated else None,
                    issue_type='other',
                    priority='urgent',
                    equipment_name=damage_label[:120],
                    description=f"Phát hiện hư hại kỹ thuật khi kiểm phòng Check-out: {damage_label}. {note}".strip(),
                    status='fixing',
                    is_guest_fault=True,
                    cost=damage_amt,
                    image_before=image_before
                )
                if maintenance_ticket_created.image_before:
                    saved_damage_img_url = maintenance_ticket_created.image_before.url
                    check.note = f"{note} [DAMAGE_IMG:{saved_damage_img_url}]".strip()
                    check.save(update_fields=['note'])
            elif image_before and not existing_ticket.image_before:
                existing_ticket.image_before = image_before
                existing_ticket.save(update_fields=['image_before'])
                if existing_ticket.image_before:
                    saved_damage_img_url = existing_ticket.image_before.url
                    check.note = f"{note} [DAMAGE_IMG:{saved_damage_img_url}]".strip()
                    check.save(update_fields=['note'])
            if room.status != 'occupied':
                room.status = 'maintenance'
                room.save(update_fields=['status'])

        staff_name = (request.user.get_full_name() or request.user.username) if request.user.is_authenticated else "Buồng phòng"
        guest_name_str = ""
        if booking:
            if booking.guest:
                guest_name_str = booking.guest.get_full_name() or booking.guest.username
            elif getattr(booking, 'guest_name', None):
                guest_name_str = str(booking.guest_name)
            elif getattr(booking, 'identity_card', None):
                guest_name_str = f"CCCD {booking.identity_card}"
            else:
                guest_name_str = "Khách lưu trú"
        guest_label = f" (Khách #{booking.booking_code} - {guest_name_str})" if booking else ""

        # Gửi thông báo đến Lễ tân, Thu ngân, Quản lý (chỉ gửi thêm Kỹ thuật khi thực sự có yêu cầu sửa chữa kỹ thuật requires_maintenance=True)
        try:
            consumed_desc = ", ".join([f"{it['name']} x{it['quantity']}" for it in valid_consumed]) if valid_consumed else "Không dùng Minibar"
            target_roles = ['receptionist', 'cashier', 'admin']
            if has_damage and (damage_amt > 0 or damage_desc):
                target_roles.append('manager')
            if maintenance_ticket_created:
                target_roles.append('technician')
            recipients = User.objects.filter(
                Q(role__in=target_roles) |
                (Q(is_superuser=True) & ~Q(role__in=['owner', 'guest', 'housekeeper', 'service_staff', 'technician']))
            ).distinct()
            notif_title = f"[HOÀN TẤT KIỂM PHÒNG] Phòng {room.room_number}{guest_label}"
            damage_text = f"\n• Hư hại / Đền bù: {damage_amt:,.0f} đ ({damage_desc})" if (has_damage and (damage_amt > 0 or damage_desc)) else "\n• Hư hại phòng: Không phát sinh"
            if maintenance_ticket_created:
                damage_text += f"\n• Đã tự động tạo phiếu bảo trì #{maintenance_ticket_created.ticket_code} cho bộ phận Kỹ thuật."
            notif_message = (
                f"Buồng phòng ({staff_name}) đã hoàn tất kiểm tra phòng {room.room_number}.\n"
                f"• Minibar: {consumed_desc} ({total_amount:,.0f} VNĐ)"
                f"{damage_text}\n"
                + (f"• Đã tự động cập nhật vào Hóa đơn thanh toán của khách." if extra_services_created > 0 else "• Phòng nguyên vẹn, sẵn sàng thanh toán.")
            )
            target_action_url = '/admin/finance' if (total_amount > 0 or has_damage) else '/admin/rooms'
            target_priority = 'high' if (has_damage or total_amount > 500000) else 'normal'
            notifs = [
                Notification(
                    recipient=r,
                    title=notif_title,
                    message=notif_message,
                    notification_type='room',
                    action_url=target_action_url,
                    priority=target_priority
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
            description=f"Kiểm tra phòng #{check.check_code} phòng {room.room_number}. Minibar: {total_amount:,.0f} đ, Hư hại: {damage_amt if has_damage else 0:,.0f} đ.",
            request=request
        )

        summary_msg = f"Đã hoàn tất kiểm tra phòng {room.room_number}!"
        if total_amount > 0 or (has_damage and damage_amt > 0):
            summary_msg += f" Tổng phụ thu: {total_amount + (damage_amt if has_damage else 0):,.0f} đ (Đã đồng bộ vào hóa đơn)."
        else:
            summary_msg += " Phòng nguyên vẹn, không phát sinh phụ phí."

        return Response({
            'success': True,
            'message': summary_msg,
            'check': MinibarCheckSerializer(check, context={'request': request}).data,
            'extra_services_created': extra_services_created,
            'booking_id': booking.id if booking else None
        }, status=status.HTTP_201_CREATED)
