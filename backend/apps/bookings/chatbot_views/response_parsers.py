"""Trích gợi ý và tiến trình đặt phòng từ câu trả lời."""
import re
import logging

from ..models import Booking

logger = logging.getLogger(__name__)
from .constants import DEFAULT_ROOM_IMAGES, DEFAULT_SERVICE_IMAGES
from .text_utils import format_currency_multilingual
from .nlp_parser import resolve_room_from_conversation


def extract_suggestions(message, hotel_context, lang='vi', history=None):
    """
    Trích xuất danh sách Interactive Cards (phòng nghỉ hoặc dịch vụ) phù hợp với ý định câu hỏi:
    - Tự động đính kèm `check_in`, `check_out`, `nights` từ `queried_dates` vào từng thẻ phòng
      để nút [Đặt ngay] trên Frontend truyền thẳng ngày sang trang Checkout!
    - Tự động gợi ý thẻ Xe đưa đón VIP khi khách hỏi về du lịch Đà Nẵng / sân bay.
    """
    msg_lower = message.strip().lower()
    suggested_rooms = []
    suggested_services = []
    d_info = hotel_context.get('queried_dates', {})
    rooms = hotel_context.get('rooms', [])

    # 1. Phát hiện câu hỏi liên quan đến phòng hoặc câu hỏi nối tiếp về phòng
    specific_room = resolve_room_from_conversation(message, history, rooms)
    is_room_query = bool(specific_room) or any(k in msg_lower for k in [
        'phòng', 'giá', 'trống', 'còn phòng', 'hạng phòng', 'loại phòng',
        'room', 'rooms', 'rate', 'rates', 'price', 'cost', 'available', 'availability',
        'đêm', 'bao nhiêu', 'đặt phòng', 'suite', 'deluxe', 'penthouse', 'view', 'ngủ', 'ở',
        'ngày mai', 'cuối tuần', 'bồn tắm', 'jacuzzi', 'ban công',
        '객실', '방', '요금', '가격', '예약', '스위트', '디럭스',
        '房', '客房', '价格', '房价', '预订', '套房', '空房'
    ])
    if is_room_query and rooms:
        def score_room(r):
            is_exact = 1 if (specific_room and r.get('id') == specific_room.get('id')) else 0
            name_lower = r.get('name', '').lower()
            matched = any(w in name_lower for w in msg_lower.split() if len(w) >= 3 and w in name_lower)
            has_avail = 1 if r.get('available_count', 0) > 0 else 0
            return (is_exact, 1 if matched else 0, has_avail, -r.get('base_price', 0))

        sorted_rooms = sorted(rooms, key=score_room, reverse=True)
        for idx, r in enumerate(sorted_rooms[:4]):
            fallback_img = DEFAULT_ROOM_IMAGES[idx % len(DEFAULT_ROOM_IMAGES)]
            price_val = r.get('promo_price') or r.get('base_price', 0)
            price_str = format_currency_multilingual(price_val, lang=lang) if price_val else (r.get('promo_price_formatted') or r.get('base_price_formatted'))

            suggested_rooms.append({
                'id': r.get('id'),
                'name': r.get('name'),
                'slug': r.get('slug'),
                'price_formatted': price_str,
                'capacity': r.get('capacity', 2),
                'bed_type': r.get('bed_type', '1 Giường Đôi King'),
                'size': r.get('size', 40),
                'available_count': r.get('available_count', 0),
                'image_url': r.get('image_url') or fallback_img,
                'check_in': d_info.get('check_in_str'),
                'check_out': d_info.get('check_out_str'),
                'check_in_display': d_info.get('check_in_display'),
                'check_out_display': d_info.get('check_out_display'),
                'nights': d_info.get('nights', 1)
            })

    # 2. Phát hiện câu hỏi liên quan đến dịch vụ / ẩm thực / du lịch Đà Nẵng / xe đưa đón
    is_travel_or_shuttle = any(k in msg_lower for k in [
        'du lịch', 'chơi gì', 'đi đâu', 'tham quan', 'lịch trình', 'cầu rồng', 'bà nà', 'cầu vàng',
        'sơn trà', 'linh ứng', 'hội an', 'ngũ hành sơn', 'xe', 'đưa đón', 'sân bay', 'airport', 'shuttle', 'transfer', 'tour'
    ])
    is_service_query = is_travel_or_shuttle or any(k in msg_lower for k in [
        'dịch vụ', 'ăn', 'ẩm thực', 'nhà hàng', 'spa', 'massage',
        'giặt', 'bar', 'service', 'menu', 'món', 'bò', 'hải sản',
        'dining', 'food', 'restaurant', 'laundry',
        '서비스', '식사', '레스토랑', '스파', '마사지', '공항', '픽업', '샌딩', '조식',
        '服务', '餐饮', '餐厅', '水疗', '按摩', '机场', '接送', '早餐', '菜单'
    ])
    if is_service_query:
        all_services = hotel_context.get('services', [])
        if is_travel_or_shuttle:
            # Ưu tiên đưa các dịch vụ Xe đưa đón / Sân bay lên đầu danh sách gợi ý
            def score_service(s):
                txt = f"{s.get('name', '')} {s.get('category', '')} {s.get('description', '')}".lower()
                is_transport = any(k in txt for k in ['xe', 'sân bay', 'đưa đón', 'airport', 'transfer', 'limousine', 'shuttle'])
                return 1 if is_transport else 0
            sorted_services = sorted(all_services, key=score_service, reverse=True)
        else:
            sorted_services = all_services

        for idx, s in enumerate(sorted_services[:3]):
            fallback_img = DEFAULT_SERVICE_IMAGES[idx % len(DEFAULT_SERVICE_IMAGES)]
            price_val = s.get('price', 0)
            price_str = format_currency_multilingual(price_val, lang=lang) if price_val else s.get('price_formatted')

            suggested_services.append({
                'id': s.get('id'),
                'name': s.get('name'),
                'category': s.get('category'),
                'price_formatted': price_str,
                'description': s.get('description'),
                'image_url': s.get('image_url') or fallback_img
            })

    return suggested_rooms, suggested_services


def extract_booking_tracker(message, request, hotel_context, lang='vi'):
    """
    Tự động nhận diện ý định tra cứu đơn đặt phòng thông qua:
    1. Mã đơn đặt phòng (VD: BK-3C2E8F, BK123456, GRP-ABC12)
    2. Số điện thoại đặt phòng (VD: 0918889999, 0901234567)
    3. Hoặc người dùng đã đăng nhập và hỏi về đơn đặt phòng / hóa đơn tạm tính.
    """
    msg = message.strip()
    msg_lower = msg.lower()
    tracked_bookings = []

    status_map_i18n = {
        'vi': {
            'pending': ('Chờ duyệt / Chờ thanh toán VietQR', 1, 'amber'),
            'confirmed': ('Đã xác nhận giữ phòng', 2, 'emerald'),
            'paid': ('Đã thanh toán cọc / Toàn phần', 2, 'emerald'),
            'PAID': ('Đã thanh toán cọc / Toàn phần', 2, 'emerald'),
            'checked_in': ('Đang lưu trú tại khách sạn', 3, 'blue'),
            'checked_out': ('Đã hoàn tất trả phòng', 4, 'emerald'),
            'completed': ('Đã hoàn tất kỳ nghỉ', 4, 'emerald'),
            'no_show': ('Khách không đến', -1, 'rose'),
            'cancelled': ('Đã hủy đơn đặt phòng', -1, 'rose'),
        },
        'en': {
            'pending': ('Pending Approval / Payment', 1, 'amber'),
            'confirmed': ('Booking Confirmed', 2, 'emerald'),
            'paid': ('Deposit / Full Payment Received', 2, 'emerald'),
            'PAID': ('Deposit / Full Payment Received', 2, 'emerald'),
            'checked_in': ('Currently In-House (Checked In)', 3, 'blue'),
            'checked_out': ('Checked Out', 4, 'emerald'),
            'completed': ('Stay Completed', 4, 'emerald'),
            'no_show': ('No Show', -1, 'rose'),
            'cancelled': ('Booking Cancelled', -1, 'rose'),
        },
        'ko': {
            'pending': ('예약 승인 대기 / 결제 대기', 1, 'amber'),
            'confirmed': ('예약 확정 완료', 2, 'emerald'),
            'paid': ('보증금/전액 결제 완료', 2, 'emerald'),
            'PAID': ('보증금/전액 결제 완료', 2, 'emerald'),
            'checked_in': ('호텔 투숙 중 (체크인 완료)', 3, 'blue'),
            'checked_out': ('체크아웃 완료', 4, 'emerald'),
            'completed': ('숙박 이용 완료', 4, 'emerald'),
            'no_show': ('노쇼 (미도착)', -1, 'rose'),
            'cancelled': ('예약 취소됨', -1, 'rose'),
        },
        'zh': {
            'pending': ('等待审核 / 等待支付', 1, 'amber'),
            'confirmed': ('预订已确认', 2, 'emerald'),
            'paid': ('定金/全额已支付', 2, 'emerald'),
            'PAID': ('定金/全额已支付', 2, 'emerald'),
            'checked_in': ('在住状态 (已办理入住)', 3, 'blue'),
            'checked_out': ('已办理退房', 4, 'emerald'),
            'completed': ('行程已顺利结束', 4, 'emerald'),
            'no_show': ('未入住 (No-Show)', -1, 'rose'),
            'cancelled': ('预订已取消', -1, 'rose'),
        }
    }
    status_map = status_map_i18n.get(lang, status_map_i18n['vi'])
    found_bookings = []

    # 1. Tìm theo Mã đơn (BK-... hoặc GRP-...)
    code_match = re.search(r'\b((?:BK|GRP)[-_]?[A-Z0-9]{4,10})\b', msg, re.IGNORECASE)
    if code_match:
        raw_code = code_match.group(1).upper()
        norm_code = raw_code
        if raw_code.startswith('BK') and not raw_code.startswith('BK-'):
            norm_code = f"BK-{raw_code[2:]}"
        elif raw_code.startswith('GRP') and not raw_code.startswith('GRP-'):
            norm_code = f"GRP-{raw_code[3:]}"

        bks = Booking.objects.filter(booking_code__in=[raw_code, norm_code]).select_related('guest', 'category', 'room')
        found_bookings.extend(list(bks))

    # 2. Tìm theo Số điện thoại (0[3|5|7|8|9]xxxxxxxx)
    if not found_bookings:
        phone_match = re.search(r'\b(0[35789]\d{8})\b', msg)
        if phone_match:
            phone_num = phone_match.group(1)
            bks = Booking.objects.filter(guest__phone_number=phone_num).select_related('guest', 'category', 'room').order_by('-created_at')[:2]
            found_bookings.extend(list(bks))

    # 3. Nếu là hội viên đã đăng nhập và hỏi về đơn đặt phòng / hóa đơn
    if not found_bookings and request and getattr(request, 'user', None) and request.user.is_authenticated:
        if any(k in msg_lower for k in [
            'đơn', 'đặt phòng của tôi', 'booking', 'kiểm tra đơn', 'tra cứu đơn', 'lịch sử', 'phòng của tôi',
            'hóa đơn tạm tính', 'tạm tính',
            'my booking', 'reservation', 'my room', 'check reservation', 'status',
            '내 예약', '예약 내역', '예약 확인', '예약 상태',
            '我的预订', '预订查询', '订单', '预订状态'
        ]):
            bks = Booking.objects.filter(guest=request.user).select_related('guest', 'category', 'room').order_by('-created_at')[:2]
            found_bookings.extend(list(bks))

    for bk in found_bookings:
        st_info = status_map.get(bk.status, (bk.get_status_display() or bk.status, 1, 'amber'))

        feat_img = None
        if bk.category:
            f = bk.category.images.filter(is_feature=True).first() or bk.category.images.first()
            if f and f.image:
                feat_img = request.build_absolute_uri(f.image.url) if request else f.image.url

        if lang == 'en':
            room_str = f"Room {bk.room.room_number}" if bk.room else (bk.category.name if bk.category else "Standard Room")
            cat_name = bk.category.name if bk.category else 'Standard Category'
        elif lang == 'ko':
            room_str = f"{bk.room.room_number}호 객실" if bk.room else (bk.category.name if bk.category else "스탠다드 객실")
            cat_name = bk.category.name if bk.category else '스탠다드'
        elif lang == 'zh':
            room_str = f"{bk.room.room_number}号房" if bk.room else (bk.category.name if bk.category else "标准客房")
            cat_name = bk.category.name if bk.category else '标准客房'
        else:
            room_str = f"Phòng {bk.room.room_number}" if bk.room else (bk.category.name if bk.category else "Tiêu chuẩn")
            cat_name = bk.category.name if bk.category else 'Hạng tiêu chuẩn'

        tracked_bookings.append({
            'id': bk.id,
            'booking_code': bk.booking_code,
            'guest_name': bk.guest.get_full_name() or bk.guest.username,
            'guest_phone': getattr(bk.guest, 'phone_number', '') or '',
            'room_category': cat_name,
            'room_name': room_str,
            'room_number': bk.room.room_number if bk.room else None,
            'check_in_date': bk.check_in_date.strftime('%d/%m/%Y'),
            'check_out_date': bk.check_out_date.strftime('%d/%m/%Y'),
            'total_amount': format_currency_multilingual(bk.total_amount, lang=lang),
            'status': bk.status,
            'status_label': st_info[0],
            'step_index': st_info[1],
            'badge_color': st_info[2],
            'image_url': feat_img or DEFAULT_ROOM_IMAGES[0]
        })

    return tracked_bookings
