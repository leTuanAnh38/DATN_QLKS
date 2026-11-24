"""Xử lý yêu cầu buồng phòng, báo sự cố kỹ thuật, gợi ý đặt dịch vụ và chuyển tiếp nhân viên qua chatbot."""
import re
import logging
from django.db.models import Q
from django.utils import timezone

from ..models import Booking
from ...rooms.models import MaintenanceTicket, LostAndFoundItem
from ...notifications.models import Notification
from ...users.models import User
from .text_utils import (
    format_currency_multilingual,
    extract_code_and_phone,
    find_code_phone_pair_in_history,
    phones_match,
)

logger = logging.getLogger(__name__)


INHOUSE_BOOKING_ROLES = ['admin', 'owner', 'manager', 'receptionist', 'housekeeper', 'service_staff', 'technician']

__all__ = [
    'INHOUSE_BOOKING_ROLES',
    'handle_inhouse_housekeeping_request',
    'handle_inhouse_maintenance_request',
    'detect_inhouse_pending_action',
    'handle_lost_and_found_inquiry',
]


def _is_informational_question(msg_low):
    """
    Nhận diện câu hỏi mang tính giả định hoặc hỏi thông tin/giá cả/giờ giấc
    để tránh tự động tạo phiếu kỹ thuật, bật cờ dọn phòng hoặc tạo thẻ đặt món nhầm.
    """
    hypothetical_markers = [
        'nếu ', 'giả sử', 'trường hợp ', 'lỡ ', 'what if', 'in case', 'if my', 'if the',
        '만약', '혹시', '如果', '要是', '假如'
    ]
    if any(k in msg_low for k in hypothetical_markers):
        return True

    info_question_markers = [
        'giá bao nhiêu', 'bao nhiêu tiền', 'mất phí không', 'có tính phí', 'có miễn phí',
        'mấy giờ', 'giờ nào', 'khi nào', 'bao lâu', 'bao giờ', 'liên hệ ai', 'gọi số nào',
        'chính sách', 'quy định', 'xem thực đơn', 'xem menu', 'thực đơn có gì',
        'how much', 'what time', 'what is the price', 'price of', 'cost of', 'who do i',
        'which number', 'is housekeeping', 'do you clean', 'view menu', 'see the menu',
        '얼마', '몇 시', '무료', '메뉴 보여', '가격',
        '多少钱', '价格', '几点', '怎么收费', '免费吗', '菜单'
    ]
    return any(k in msg_low for k in info_question_markers)


def _resolve_verified_checked_in_booking(
    message, request, staff_roles=None, history=None, allowed_statuses=('checked_in',), require_room=True
):
    """
    Xác thực quyền truy cập đơn lưu trú cho các thao tác In-House / Lost & Found:
    - Người dùng đã đăng nhập là chủ đơn thuộc `allowed_statuses` hoặc nhân viên có vai trò phù hợp.
    - Khách vãng lai cung cấp đồng thời cả Mã đơn `BK-...` và đúng Số điện thoại đặt đơn
      (trong tin nhắn hiện tại hoặc đã xác thực trong lượt hội thoại trước đó).
    Trả về `(active_bk, requested_room_num, is_authenticated, verified_phone)`.
    """
    msg_low = message.strip().lower()
    user = getattr(request, 'user', None)
    is_authenticated = bool(user and user.is_authenticated)
    allowed_roles = staff_roles or INHOUSE_BOOKING_ROLES
    is_staff = bool(
        is_authenticated and (
            user.is_superuser or getattr(user, 'role', '') in allowed_roles
        )
    )

    room_match = re.search(r'(?:phòng|p\.|room)\s*(\d{3,4})\b', msg_low)
    requested_room_num = room_match.group(1) if room_match else None
    active_bk = None
    verified_phone = None
    base_filters = {'status__in': list(allowed_statuses)}
    if require_room:
        base_filters['room__isnull'] = False

    if is_authenticated:
        if is_staff and requested_room_num:
            active_bk = Booking.objects.filter(
                room__room_number=requested_room_num,
                **base_filters,
            ).select_related('room', 'guest').order_by('-created_at').first()
        else:
            qs = Booking.objects.filter(guest=user, **base_filters).select_related('room', 'guest').order_by('-created_at')
            if requested_room_num:
                active_bk = qs.filter(room__room_number=requested_room_num).first() or qs.first()
            else:
                active_bk = qs.first()
    else:
        raw_code, norm_code, phone_num = extract_code_and_phone(message)
        if not (raw_code and phone_num) and history:
            h_raw, h_norm, h_phone = find_code_phone_pair_in_history(history)
            if h_raw and h_phone:
                raw_code = raw_code or h_raw
                norm_code = norm_code or h_norm
                phone_num = phone_num or h_phone

        if raw_code and phone_num and raw_code.startswith('BK'):
            candidates = Booking.objects.filter(
                booking_code__in=[raw_code, norm_code],
                **base_filters,
            ).select_related('room', 'guest').order_by('-created_at')
            for cand in candidates:
                guest_phone = getattr(cand.guest, 'phone_number', '') if cand.guest else ''
                if phones_match(guest_phone, phone_num):
                    active_bk = cand
                    verified_phone = phone_num
                    break

    return active_bk, requested_room_num, is_authenticated, verified_phone


def _classify_maintenance_issue(msg_low):
    """Phân loại thiết bị hư hỏng, issue_type và mức độ ưu tiên từ mô tả sự cố."""
    rules = [
        ('ac', 'Điều hòa / Máy lạnh', ['điều hòa', 'máy lạnh', 'aircon', 'air conditioner', 'a/c', ' ac ', 'không lạnh', '에어컨', '空调', '不制冷']),
        ('plumbing', 'Thiết bị vệ sinh / Đường ống nước', ['vòi nước', 'vòi sen', 'bồn cầu', 'bồn tắm', 'ống nước', 'chậu rửa', 'rò rỉ', 'chảy nước', 'nghẹt', 'tắc', 'nước nóng', 'shower', 'toilet', 'faucet', 'sink', 'plumbing', 'leak', '수도', '변기', '漏水', '马桶', '淋浴']),
        ('electric', 'Hệ thống điện / Chiếu sáng', ['ổ cắm', 'công tắc', 'bóng đèn', 'đèn ngủ', 'đèn phòng', 'mất điện', 'chập điện', 'điện phòng', 'electric', 'power', 'outlet', 'light', 'bulb', '전기', '조명', '电源', '插座', '电灯']),
        ('electronics', 'Thiết bị điện tử / TV / Wifi / Khóa từ', ['tivi', 'tv', 'wifi', 'mạng', 'tủ lạnh', 'minibar', 'két sắt', 'khóa từ', 'thẻ từ', 'remote', 'điều khiển', 'fridge', 'safe', 'lock', '티비', '와이파이', '电视', '无线网', '门锁']),
        ('furniture', 'Nội thất / Cửa / Kính', ['giường', 'cửa phòng', 'cửa sổ', 'ban công', 'tủ đồ', 'ghế', 'bàn', 'rèm', 'kính', 'bed', 'door', 'window', 'curtain', 'furniture', '침대', '문', '床', '门窗']),
    ]
    issue_type = 'other'
    equipment_name = 'Thiết bị trong phòng'
    for code, label, keywords in rules:
        if any(k in msg_low for k in keywords):
            issue_type = code
            equipment_name = label
            break

    is_urgent = any(k in msg_low for k in [
        'mất điện', 'chập', 'nước tràn', 'rò rỉ', 'ngập', 'khẩn', 'gấp', 'nguy hiểm',
        'leak', 'flooding', 'no power', 'urgent', 'emergency', 'spark', '누수', '정전', '漏水', '停电', '紧急'
    ])
    priority = 'urgent' if is_urgent else 'high'
    return issue_type, equipment_name, priority


def handle_inhouse_maintenance_request(message, request, history=None):
    """
    Tự động tiếp nhận báo hỏng thiết bị từ khách đang lưu trú (`checked_in`) có xác thực:
    - Tạo phiếu `MaintenanceTicket` gắn đúng `room` & `booking`.
    - Bắn `Notification` ưu tiên cao tới Kỹ thuật viên, Lễ tân và Quản lý.
    - Yêu cầu xác thực nếu khách chưa đăng nhập và chưa nhập `BK-... + SĐT`.
    """
    msg_low = f" {message.strip().lower()} "
    if _is_informational_question(msg_low):
        return None

    fault_keywords = [
        'bị hỏng', 'hỏng rồi', 'bị hư', 'hư rồi', 'không lạnh', 'không nóng', 'rò rỉ', 'chảy nước',
        'bị nghẹt', 'bị tắc', 'mất điện', 'chập điện', 'nhấp nháy', 'báo sửa', 'sửa chữa', 'sửa giúp',
        'kêu to', 'không hoạt động', 'bị gãy', 'bị kẹt', 'hư máy lạnh', 'hư điều hòa', 'hỏng điều hòa',
        'hỏng tv', 'hỏng tivi', 'mất nước', 'không mở được cửa', 'khóa cửa hỏng',
        'broken', 'not working', 'does not work', "doesn't work", 'leaking', 'leak', 'malfunction',
        'no hot water', 'no power', 'fix my', 'repair', 'aircon issue', 'ac not cooling',
        '고장', '수리', '안 나와요', '물 새', '누수', '안 됨',
        '坏了', '维修', '漏水', '不制冷', '用不了', '停水', '停电'
    ]
    if not any(k in msg_low for k in fault_keywords):
        return None

    active_bk, requested_room_num, is_authenticated, _ = _resolve_verified_checked_in_booking(
        message, request, staff_roles=['admin', 'owner', 'manager', 'receptionist', 'technician'], history=history
    )
    if not active_bk or not active_bk.room:
        return {
            'requires_auth': True,
            'room_number': requested_room_num,
            'is_authenticated': is_authenticated,
        }

    room = active_bk.room
    issue_type, equipment_name, priority = _classify_maintenance_issue(msg_low)
    guest_name = active_bk.guest.get_full_name() or active_bk.guest.username
    ticket_code = None

    try:
        ticket = MaintenanceTicket.objects.create(
            room=room,
            equipment_name=equipment_name,
            issue_type=issue_type,
            priority=priority,
            description=f"[AI Concierge - #{active_bk.booking_code}] Khách {guest_name}: {message.strip()[:400]}",
            booking=active_bk,
            created_by=request.user if (request.user and request.user.is_authenticated) else active_bk.guest,
            status='fixing'
        )
        ticket_code = ticket.ticket_code

        staff_users = User.objects.filter(
            Q(role__in=['technician', 'manager', 'receptionist', 'admin']) | Q(is_superuser=True)
        ).distinct()
        notifs = [
            Notification(
                recipient=u,
                title=f"[AI Kỹ thuật] Phòng {room.room_number} báo sự cố: {equipment_name}",
                message=f"Phiếu {ticket_code} | Khách {guest_name} (Phòng {room.room_number} - #{active_bk.booking_code}): {message.strip()[:250]}",
                notification_type='room',
                action_url='/admin/rooms',
                priority='urgent' if priority == 'urgent' else 'high'
            )
            for u in staff_users
        ]
        Notification.objects.bulk_create(notifs)
    except Exception as e:
        logger.warning(f"Lỗi khi tạo phiếu bảo trì từ AI Concierge: {e}")

    return {
        'requires_auth': False,
        'ticket_code': ticket_code,
        'equipment_name': equipment_name,
        'issue_type': issue_type,
        'priority': priority,
        'room_number': room.room_number,
        'booking_code': active_bk.booking_code,
        'guest_name': guest_name,
        'description': message.strip()
    }


def detect_inhouse_pending_action(message, request, hotel_context, lang='vi', history=None):
    """
    Phát hiện hành động cần xác nhận 2 bước (2-Tap Confirmation) trước khi ghi DB:
    1) Đặt món / dịch vụ tại phòng (`create_service_request`) cho khách `checked_in` đã xác thực.
    2) Chuyển tiếp nhân viên trực tiếp / khiếu nại (`human_handoff`) tạo `ContactMessage`.
    """
    msg = (message or '').strip()
    msg_low = f" {msg.lower()} "

    # 1. Kiểm tra yêu cầu gặp nhân viên trực tiếp / khiếu nại -> Ưu tiên Human Handoff
    handoff_keywords = [
        'gặp nhân viên', 'gặp lễ tân', 'nói chuyện với người', 'người thật', 'nhân viên hỗ trợ',
        'khiếu nại', 'phàn nàn', 'báo quản lý', 'gặp quản lý', 'chuyển nhân viên', 'tư vấn trực tiếp',
        'talk to human', 'speak to staff', 'live agent', 'human support', 'complaint', 'speak to manager',
        'real person', '직원 연결', '상담원', '매니저', '불만', '人工客服', '转人工', '投诉', '经理'
    ]
    if any(k in msg_low for k in handoff_keywords):
        user = getattr(request, 'user', None)
        is_auth = bool(user and user.is_authenticated)
        full_name = (user.get_full_name() or user.username) if is_auth else ''
        email = (getattr(user, 'email', '') or '') if is_auth else ''
        return {
            'type': 'human_handoff',
            'subject': '[AI Concierge Handoff] Yêu cầu hỗ trợ từ khách hàng',
            'suggested_message': msg[:500],
            'default_name': full_name,
            'default_email': email,
            'requires_contact_info': not (is_auth and bool(email)),
        }

    # 2. Kiểm tra ý định gọi món / đặt dịch vụ lên phòng (bỏ qua nếu chỉ hỏi giá/menu)
    if _is_informational_question(msg_low):
        return None

    order_verbs = [
        'đặt ', 'gọi ', 'mang lên', 'giao lên', 'cho tôi ', 'cho em ', 'order ', 'bring ',
        'send ', 'deliver ', '주문', '보내', '点一份', '点餐', '送餐', '送到房间'
    ]
    if not any(v in msg_low for v in order_verbs):
        return None

    services = hotel_context.get('services', [])
    matched_svc = None
    best_score = 0
    for svc in services:
        s_name = (svc.get('name') or '').strip().lower()
        if not s_name:
            continue
        if s_name in msg_low:
            score = len(s_name) + 10
        else:
            words = [w for w in s_name.split() if len(w) >= 3]
            hits = sum(1 for w in words if w in msg_low)
            score = hits if hits >= 2 else 0
        if score > best_score:
            best_score = score
            matched_svc = svc

    if not matched_svc:
        return None

    # Loại bỏ số phòng, mã đơn, số điện thoại trước khi tách số lượng món
    qty_text = re.sub(r'(?:phòng|p\.|room)\s*\d+\b', ' ', msg_low)
    qty_text = re.sub(r'\b(?:bk|grp)[-_]?[a-z0-9]{4,10}\b', ' ', qty_text)
    qty_text = re.sub(r'\b\+?\d[\d\s.\-]{7,14}\d\b', ' ', qty_text)

    qty_match = re.search(
        r'\b(\d{1,2})\s*(?:phần|ly|cốc|chai|lon|suất|bát|tô|đĩa|vé|lượt|giờ|bộ|cái|x|items?|servings?|bottles?|cups?)?\s*(?:'
        + re.escape(matched_svc['name'].lower()[:8])
        + r'|\b)',
        qty_text,
    )
    if not qty_match:
        qty_match = re.search(r'\b(\d{1,2})\b', qty_text)
    quantity = 1
    if qty_match:
        parsed_q = int(qty_match.group(1))
        if 1 <= parsed_q <= 20:
            quantity = parsed_q

    active_bk, requested_room_num, is_authenticated, verified_phone = _resolve_verified_checked_in_booking(
        message, request, history=history
    )
    if not active_bk or not active_bk.room:
        return {
            'requires_auth': True,
            'type': 'create_service_request_auth_required',
            'service_name': matched_svc['name'],
            'room_number': requested_room_num,
            'is_authenticated': is_authenticated,
        }

    unit_price = int(matched_svc.get('price') or 0)
    total_price = unit_price * quantity
    result = {
        'type': 'create_service_request',
        'booking_id': active_bk.id,
        'booking_code': active_bk.booking_code,
        'room_number': active_bk.room.room_number,
        'service_id': matched_svc['id'],
        'service_name': matched_svc['name'],
        'quantity': quantity,
        'unit_price': unit_price,
        'unit_price_formatted': format_currency_multilingual(unit_price, lang=lang),
        'total_price': total_price,
        'total_formatted': format_currency_multilingual(total_price, lang=lang),
        'note': msg[:200],
    }
    if verified_phone:
        result['verified_phone'] = verified_phone
    return result


def handle_inhouse_housekeeping_request(message, request, hotel_context, history=None):
    """
    Nếu khách hàng đang lưu trú (CHECKED_IN) nhắn tin yêu cầu dọn phòng, thay khăn, thêm nước suối...
    Hệ thống tự động bật cờ `room.is_cleaning_requested = True` và bắn Notification thời gian thực
    tới bộ phận Buồng phòng & Lễ tân trên trang Admin!

    Bảo mật:
    - Chỉ kích hoạt khi người dùng đã đăng nhập đúng chủ đơn `checked_in` (hoặc nhân viên khách sạn),
      HOẶC khách vãng lai cung cấp đồng thời cả Mã đơn `BK-...` đang `checked_in` và đúng Số điện thoại đặt đơn.
    - Nếu người lạ chỉ nhắn số phòng (VD: 'dọn phòng 301') mà không xác thực -> từ chối thực thi
      và trả về `{requires_auth: True}` để tránh spam / giả mạo từ bên ngoài.
    """
    msg_low = f" {message.strip().lower()} "
    if _is_informational_question(msg_low):
        return None

    cleaning_keywords = [
        'dọn phòng', 'vệ sinh phòng', 'lau phòng', 'thay khăn', 'thêm khăn', 'thay ga',
        'thêm nước', 'hết nước suối', 'mang nước', 'thêm gối', 'bàn ủi',
        'make up room', 'make up my room', 'clean my room', 'housekeeping', 'fresh towels',
        '객실 청소', '타월 추가', '수건 교체', '하우스키핑',
        '打扫房间', '清洁客房', '换毛巾', '客房服务'
    ]
    if not any(k in msg_low for k in cleaning_keywords):
        return None

    active_bk, requested_room_num, is_authenticated, _ = _resolve_verified_checked_in_booking(
        message, request, staff_roles=['admin', 'owner', 'manager', 'receptionist', 'housekeeper'], history=history
    )

    if not active_bk or not active_bk.room:
        return {
            'requires_auth': True,
            'room_number': requested_room_num,
            'is_authenticated': is_authenticated,
        }

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
        'requires_auth': False,
        'room_number': room.room_number,
        'booking_code': active_bk.booking_code,
        'guest_name': active_bk.guest.get_full_name() or active_bk.guest.username,
        'request_note': message.strip()
    }


def handle_lost_and_found_inquiry(message, request, history=None):
    """
    Hỗ trợ khách hàng báo quên / tìm đồ thất lạc (`LostAndFoundItem`):
    - Xác thực quyền sở hữu đơn (`checked_in`, `checked_out`, `completed`) qua tài khoản hoặc `BK-... + SĐT`.
    - Kiểm tra kho `LostAndFoundItem` (trạng thái `stored` / `contacted`) gắn với đơn hoặc phòng lưu trú.
    - Gửi `Notification` tới Buồng phòng, Lễ tân & Quản lý (`/admin/lost-and-found`) để kiểm tra hỗ trợ ngay.
    """
    msg_low = f" {message.strip().lower()} "
    lost_keywords = [
        'để quên', 'quên đồ', 'bỏ quên', 'thất lạc', 'làm rơi', 'bị mất', 'mất đồ', 'tìm đồ',
        'nhặt được', 'đồ bỏ quên', 'đồ thất lạc', 'quên sạc', 'quên ví', 'quên điện thoại', 'quên kính',
        'lost and found', 'lost item', 'left behind', 'forgot my', 'forgotten', 'misplaced', 'found my',
        '분실', '두고 왔', '놓고 왔', '잃어버렸', '분실물',
        '遗落', '落下了', '忘在房间', '失物', '丢了', '找回'
    ]
    if not any(k in msg_low for k in lost_keywords):
        return None

    # Bỏ qua nếu chỉ hỏi giả định về quy trình chung
    if any(k in msg_low for k in ['nếu ', 'what if', 'quy trình', '만약', '如果']):
        return None

    active_bk, requested_room_num, is_authenticated, _ = _resolve_verified_checked_in_booking(
        message,
        request,
        staff_roles=['admin', 'owner', 'manager', 'receptionist', 'housekeeper'],
        history=history,
        allowed_statuses=('checked_in', 'checked_out', 'completed'),
        require_room=False,
    )
    if not active_bk:
        return {
            'requires_auth': True,
            'room_number': requested_room_num,
            'is_authenticated': is_authenticated,
        }

    room_obj = active_bk.room
    # Chỉ trả về đồ thất lạc gắn đúng booking của khách hiện tại (hoặc đồ chưa gắn booking nhặt trong thời gian lưu trú của khách)
    # Tuyệt đối không lộ tài sản bỏ quên của khách ở lượt trước trong cùng phòng
    q_filter = Q(booking=active_bk)
    if room_obj and active_bk.check_in_date:
        q_filter |= Q(
            room=room_obj,
            booking__isnull=True,
            found_date__date__gte=active_bk.check_in_date,
        )

    stored_items = list(
        LostAndFoundItem.objects.filter(q_filter, status__in=['stored', 'contacted'])
        .order_by('-found_date')[:5]
    )

    matched_items = [
        {
            'tracking_code': item.tracking_code,
            'item_name': item.item_name,
            'location_found': item.location_found,
            'storage_location': item.storage_location,
            'status': item.status,
            'status_label': item.get_status_display(),
        }
        for item in stored_items
    ]

    guest_name = active_bk.guest.get_full_name() or active_bk.guest.username if active_bk.guest else 'Quý khách'
    room_label = room_obj.room_number if room_obj else (requested_room_num or 'Chưa gán phòng')
    notified = False
    try:
        staff_users = User.objects.filter(
            Q(role__in=['housekeeper', 'receptionist', 'manager', 'admin']) | Q(is_superuser=True)
        ).distinct()
        Notification.objects.bulk_create([
            Notification(
                recipient=u,
                title=f"[AI Lost & Found] Khách báo tìm đồ thất lạc (P.{room_label})",
                message=(
                    f"Khách {guest_name} (Đơn #{active_bk.booking_code} - Phòng {room_label}) "
                    f"vừa nhắn tìm đồ thất lạc qua AI Concierge:\n• Nội dung: {message.strip()[:250]}"
                ),
                notification_type='room',
                action_url='/admin/lost-and-found',
                priority='high',
            )
            for u in staff_users
        ])
        notified = True
    except Exception as e:
        logger.warning(f"Lỗi gửi thông báo Lost & Found từ AI Concierge: {e}")

    return {
        'requires_auth': False,
        'booking_code': active_bk.booking_code,
        'room_number': room_label,
        'guest_name': guest_name,
        'matched_items': matched_items,
        'staff_notified': notified,
        'query_note': message.strip()[:200],
    }
