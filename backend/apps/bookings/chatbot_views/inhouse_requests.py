"""Xử lý yêu cầu buồng phòng của khách đang lưu trú qua chatbot."""
import re
import logging
from django.db.models import Q
from django.utils import timezone

from ..models import Booking
from ...notifications.models import Notification
from ...users.models import User

logger = logging.getLogger(__name__)


def handle_inhouse_housekeeping_request(message, request, hotel_context):
    """
    Nếu khách hàng đang lưu trú (CHECKED_IN) nhắn tin yêu cầu dọn phòng, thay khăn, thêm nước suối...
    Hệ thống tự động bật cờ `room.is_cleaning_requested = True` và bắn Notification thời gian thực
    tới bộ phận Buồng phòng & Lễ tân trên trang Admin!
    """
    msg_low = message.strip().lower()
    cleaning_keywords = [
        'dọn phòng', 'vệ sinh phòng', 'lau phòng', 'thay khăn', 'thêm khăn', 'thay ga',
        'thêm nước', 'hết nước suối', 'mang nước', 'thêm gối', 'bàn ủi', 'sửa chữa',
        'make up room', 'make up my room', 'clean my room', 'housekeeping', 'fresh towels',
        '객실 청소', '타월 추가', '수건 교체', '하우스키핑',
        '打扫房间', '清洁客房', '换毛巾', '客房服务'
    ]
    if not any(k in msg_low for k in cleaning_keywords):
        return None

    # Tìm đơn checked_in của khách đang đăng nhập hoặc số phòng khách vừa nhắn
    active_bk = None
    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        active_bk = Booking.objects.filter(guest=user, status='checked_in', room__isnull=False).select_related('room', 'guest').first()

    if not active_bk:
        room_match = re.search(r'(?:phòng|p\.|room)\s*(\d{3,4})\b', msg_low)
        if room_match:
            r_num = room_match.group(1)
            active_bk = Booking.objects.filter(room__room_number=r_num, status='checked_in').select_related('room', 'guest').first()

    if not active_bk or not active_bk.room:
        return None

    room = active_bk.room
    note = f"[AI Concierge] Khách yêu cầu: {message.strip()[:180]}"
    try:
        room.is_cleaning_requested = True
        room.cleaning_request_note = note
        room.cleaning_requested_at = timezone.now()
        room.save(update_fields=['is_cleaning_requested', 'cleaning_request_note', 'cleaning_requested_at'])

        # Gửi thông báo realtime đến nhân viên Buồng phòng, Lễ tân & Quản lý
        staff_users = User.objects.filter(
            Q(role__in=['housekeeper', 'receptionist', 'manager', 'admin']) | Q(is_superuser=True)
        ).distinct()
        guest_name = active_bk.guest.get_full_name() or active_bk.guest.username
        notifs = [
            Notification(
                recipient=u,
                title=f"[AI Concierge] Phòng {room.room_number} yêu cầu phục vụ",
                message=f"Khách lưu trú {guest_name} (Phòng {room.room_number} - #{active_bk.booking_code}) vừa gửi yêu cầu qua AI Concierge:\n• Nội dung: {message.strip()}",
                notification_type='room',
                action_url='/admin/rooms',
                priority='high'
            )
            for u in staff_users
        ]
        Notification.objects.bulk_create(notifs)
    except Exception as e:
        logger.warning(f"Lỗi khi tạo yêu cầu dọn phòng từ AI Concierge: {e}")

    return {
        'room_number': room.room_number,
        'booking_code': active_bk.booking_code,
        'guest_name': active_bk.guest.get_full_name() or active_bk.guest.username,
        'request_note': message.strip()
    }
