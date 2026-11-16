"""Trích gợi ý phòng/dịch vụ và tra cứu tiến trình đặt phòng (cá nhân & đoàn) có kiểm soát quyền."""
import re
import logging
from django.db.models import Q

from ..models import Booking, GroupBooking
from ..cancel_policy import get_booking_cancel_eligibility, get_group_cancel_eligibility

logger = logging.getLogger(__name__)
from .constants import DEFAULT_ROOM_IMAGES, DEFAULT_SERVICE_IMAGES
from .text_utils import (
    format_currency_multilingual,
    extract_code_and_phone,
    find_code_phone_pair_in_history,
    phones_match,
)
from .nlp_parser import resolve_room_from_conversation


STAFF_LOOKUP_ROLES = {'admin', 'owner', 'manager', 'receptionist', 'cashier'}


def extract_suggestions(message, hotel_context, lang='vi', history=None):
    """
    Trích xuất danh sách Interactive Cards (phòng nghỉ hoặc dịch vụ) phù hợp với ý định câu hỏi:
    - Ưu tiên hạng phòng khớp tên hoặc đáp ứng đủ số lượng khách (`guest_count`) & còn phòng trống.
    - Tự động đính kèm `check_in`, `check_out`, `nights` từ `queried_dates` vào từng thẻ phòng.
    - Tự động sắp xếp thẻ dịch vụ theo chủ đề (Xe đưa đón / Spa / Ẩm thực).
    """
    msg_lower = message.strip().lower()
    suggested_rooms = []
    suggested_services = []
    d_info = hotel_context.get('queried_dates', {})
    rooms = hotel_context.get('rooms', [])
    guest_count = hotel_context.get('guest_count')

    # 1. Phát hiện câu hỏi liên quan đến phòng hoặc câu hỏi nối tiếp về phòng
    specific_room = resolve_room_from_conversation(message, history, rooms)
    is_room_query = bool(specific_room) or bool(guest_count and any(k in msg_lower for k in ['phòng', 'room', 'đặt', 'book', 'ngủ', 'ở', '객실', '房'])) or any(k in msg_lower for k in [
        'phòng', 'giá', 'trống', 'còn phòng', 'hạng phòng', 'loại phòng',
        'room', 'rooms', 'rate', 'rates', 'price', 'cost', 'available', 'availability',
        'đêm', 'bao nhiêu', 'đặt phòng', 'suite', 'deluxe', 'penthouse', 'view', 'ngủ', 'ở',
        'ngày mai', 'cuối tuần', 'tuần sau', 'bồn tắm', 'jacuzzi', 'ban công',
        '객실', '방', '요금', '가격', '예약', '스위트', '디럭스',
        '房', '客房', '价格', '房价', '预订', '套房', '空房'
    ])
    if is_room_query and rooms:
        def score_room(r):
            is_exact = 1 if (specific_room and r.get('id') == specific_room.get('id')) else 0
            name_lower = r.get('name', '').lower()
            matched = any(w in name_lower for w in msg_lower.split() if len(w) >= 3 and w in name_lower)
            fits_guests = 1 if (not guest_count or int(r.get('capacity', 2)) >= int(guest_count)) else 0
            has_avail = 1 if r.get('available_count', 0) > 0 else 0
            return (is_exact, 1 if matched else 0, fits_guests, has_avail, -r.get('base_price', 0))

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
        'sơn trà', 'linh ứng', 'hội an', 'ngũ hành sơn', 'xe', 'đưa đón', 'sân bay', 'airport', 'shuttle', 'transfer', 'tour', 'limousine'
    ])
    is_spa_query = any(k in msg_lower for k in ['spa', 'massage', 'xông hơi', 'trị liệu', 'wellness', '스파', '마사지', '水疗', '按摩'])
    is_dining_query = any(k in msg_lower for k in ['ăn', 'ẩm thực', 'nhà hàng', 'menu', 'món', 'bò', 'hải sản', 'dining', 'food', 'restaurant', 'breakfast', 'dinner', '식사', '레스토랑', '餐饮', '餐厅'])
    is_service_query = is_travel_or_shuttle or is_spa_query or is_dining_query or any(k in msg_lower for k in [
        'dịch vụ', 'giặt', 'bar', 'service', 'laundry', '서비스', '공항', '픽업', '샌딩', '조식', '服务', '机场', '接送', '早餐', '菜单'
    ])

    if is_service_query:
        all_services = hotel_context.get('services', [])

        def score_service(s):
            txt = f"{s.get('name', '')} {s.get('category', '')} {s.get('description', '')}".lower()
            s_score = 0
            if is_travel_or_shuttle and any(k in txt for k in ['xe', 'sân bay', 'đưa đón', 'airport', 'transfer', 'limousine', 'shuttle']):
                s_score += 3
            if is_spa_query and any(k in txt for k in ['spa', 'massage', 'xông hơi', 'trị liệu', 'wellness']):
                s_score += 3
            if is_dining_query and any(k in txt for k in ['ăn', 'bò', 'hải sản', 'nhà hàng', 'buffet', 'trà', 'rượu', 'ẩm thực', 'dining', 'food']):
                s_score += 3
            return s_score

        sorted_services = sorted(all_services, key=score_service, reverse=True)
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


def _format_booking_tracker_item(bk, request, status_map, lang='vi'):
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

    return {
        'id': bk.id,
        'is_group': False,
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
    }


def _format_group_tracker_item(grp, lang='vi'):
    group_status_i18n = {
        'vi': {
            'tentative': ('Giữ chỗ đoàn (Chờ cọc)', 1, 'amber'),
            'confirmed': ('Đã xác nhận đoàn (Đã cọc)', 2, 'emerald'),
            'checked_in': ('Đoàn đang lưu trú (In-house)', 3, 'blue'),
            'checked_out': ('Đoàn đã trả phòng', 4, 'emerald'),
            'completed': ('Đoàn đã quyết toán hoàn tất', 4, 'emerald'),
            'cancelled': ('Đã hủy đơn đoàn', -1, 'rose'),
        },
        'en': {
            'tentative': ('Group Tentative (Awaiting Deposit)', 1, 'amber'),
            'confirmed': ('Group Confirmed (Deposit Paid)', 2, 'emerald'),
            'checked_in': ('Group In-House', 3, 'blue'),
            'checked_out': ('Group Checked Out', 4, 'emerald'),
            'completed': ('Group Settled & Completed', 4, 'emerald'),
            'cancelled': ('Group Booking Cancelled', -1, 'rose'),
        },
        'ko': {
            'tentative': ('단체 임시 예약 (계약금 대기)', 1, 'amber'),
            'confirmed': ('단체 예약 확정', 2, 'emerald'),
            'checked_in': ('단체 투숙 중', 3, 'blue'),
            'checked_out': ('단체 체크아웃 완료', 4, 'emerald'),
            'completed': ('단체 정산 완료', 4, 'emerald'),
            'cancelled': ('단체 예약 취소됨', -1, 'rose'),
        },
        'zh': {
            'tentative': ('团队暂留 (待付定金)', 1, 'amber'),
            'confirmed': ('团队预订已确认', 2, 'emerald'),
            'checked_in': ('团队在住中', 3, 'blue'),
            'checked_out': ('团队已退房', 4, 'emerald'),
            'completed': ('团队已结清完成', 4, 'emerald'),
            'cancelled': ('团队预订已取消', -1, 'rose'),
        }
    }
    g_map = group_status_i18n.get(lang, group_status_i18n['vi'])
    st_info = g_map.get(grp.status, (grp.get_status_display() or grp.status, 1, 'amber'))
    sub_count = grp.sub_bookings.count()

    if lang == 'en':
        room_str = f"Group ({sub_count} rooms)"
    elif lang == 'ko':
        room_str = f"단체 ({sub_count}객실)"
    elif lang == 'zh':
        room_str = f"团队 ({sub_count}间房)"
    else:
        room_str = f"Đoàn ({sub_count} phòng)"

    return {
        'id': f"grp-{grp.id}",
        'is_group': True,
        'booking_code': grp.group_code,
        'guest_name': grp.leader_name,
        'guest_phone': grp.leader_phone or '',
        'room_category': grp.group_name,
        'room_name': room_str,
        'room_number': None,
        'check_in_date': grp.check_in_date.strftime('%d/%m/%Y'),
        'check_out_date': grp.check_out_date.strftime('%d/%m/%Y'),
        'total_amount': format_currency_multilingual(grp.total_amount, lang=lang),
        'status': grp.status,
        'status_label': st_info[0],
        'step_index': st_info[1],
        'badge_color': st_info[2],
        'image_url': DEFAULT_ROOM_IMAGES[1]
    }


def extract_booking_tracker(message, request, hotel_context, lang='vi', history=None):
    """
    Nhận diện và tra cứu đơn đặt phòng (BK-...) hoặc đơn đặt đoàn (GRP-...) với kiểm soát quyền chặt chẽ:
    1. Nhân viên / Quản lý (role staff/admin): tra cứu được mọi đơn theo mã hoặc SĐT.
    2. Khách đã đăng nhập: tự động xem đơn của chính mình; nếu nhập mã đơn/SĐT khác phải trùng tài khoản.
    3. Khách vãng lai (chưa đăng nhập): CHỈ được tra cứu khi nhập ĐỒNG THỜI Mã đơn (BK-... / GRP-...)
       VÀ đúng Số điện thoại đặt đơn trong cùng tin nhắn (hoặc đã xác thực cặp này ở lượt hội thoại trước);
       nếu thiếu 1 trong 2 -> không lộ dữ liệu và gắn `hotel_context['lookup_verification_hint']`.
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

    user = getattr(request, 'user', None) if request else None
    is_authenticated = bool(user and user.is_authenticated)
    is_staff = bool(
        is_authenticated and (user.is_superuser or getattr(user, 'role', '') in STAFF_LOOKUP_ROLES)
    )

    raw_code, norm_code, phone_num = extract_code_and_phone(msg)
    has_explicit_booking_intent = any(k in msg_lower for k in [
        'đơn', 'đặt phòng của tôi', 'booking', 'kiểm tra đơn', 'tra cứu đơn', 'lịch sử', 'phòng của tôi',
        'hóa đơn tạm tính', 'tạm tính', 'hóa đơn phòng', 'tiền phòng của tôi', 'folio', 'my bill', 'current bill',
        'my booking', 'reservation', 'my room', 'check reservation', 'status', 'progress',
        '내 예약', '예약 내역', '예약 확인', '예약 상태', '정산서',
        '我的预订', '预订查询', '订单', '预订状态', '账单'
    ])

    # Nếu chưa đăng nhập và tin nhắn hiện tại không nhập mã/SĐT nhưng hỏi nối tiếp về đơn/hóa đơn,
    # kiểm tra xem lượt trước người dùng đã xác thực cặp (Mã đơn + SĐT) chưa.
    if not is_authenticated and not raw_code and not phone_num and has_explicit_booking_intent and history:
        h_raw, h_norm, h_phone = find_code_phone_pair_in_history(history)
        if h_raw and h_phone:
            raw_code, norm_code, phone_num = h_raw, h_norm, h_phone

    # 1. Tra cứu theo Mã đơn (BK-... hoặc GRP-...)
    if raw_code:
        if raw_code.startswith('GRP'):
            grp = GroupBooking.objects.filter(
                group_code__in=[raw_code, norm_code]
            ).select_related('corporate_partner').prefetch_related('sub_bookings').first()
            if grp:
                user_phone = getattr(user, 'phone_number', '') if is_authenticated else ''
                user_email = getattr(user, 'email', '') if is_authenticated else ''
                is_owner = is_authenticated and (
                    phones_match(user_phone, grp.leader_phone) or
                    (user_email and grp.leader_email and user_email.lower() == grp.leader_email.lower()) or
                    grp.sub_bookings.filter(guest=user).exists()
                )
                has_phone_match = phones_match(phone_num, grp.leader_phone)
                if is_staff or is_owner or has_phone_match:
                    tracked_bookings.append(_format_group_tracker_item(grp, lang=lang))
                else:
                    hotel_context['lookup_verification_hint'] = {
                        'reason': 'ownership_mismatch' if is_authenticated else 'verification_required',
                        'code': norm_code
                    }
        else:
            bks = list(
                Booking.objects.filter(booking_code__in=[raw_code, norm_code])
                .select_related('guest', 'category', 'room')
            )
            if bks:
                authorized_bks = []
                for bk in bks:
                    guest_phone = getattr(bk.guest, 'phone_number', '') or ''
                    is_owner = is_authenticated and bk.guest_id == user.id
                    has_phone_match = phones_match(phone_num, guest_phone)
                    if is_staff or is_owner or has_phone_match:
                        authorized_bks.append(bk)

                if authorized_bks:
                    for bk in authorized_bks:
                        tracked_bookings.append(_format_booking_tracker_item(bk, request, status_map, lang=lang))
                else:
                    hotel_context['lookup_verification_hint'] = {
                        'reason': 'ownership_mismatch' if is_authenticated else 'verification_required',
                        'code': norm_code
                    }
        return tracked_bookings

    # 2. Chỉ nhập Số điện thoại (không kèm Mã đơn)
    if phone_num:
        if is_staff:
            all_bks = Booking.objects.select_related('guest', 'category', 'room').order_by('-created_at')[:100]
            bks = [b for b in all_bks if b.guest and phones_match(getattr(b.guest, 'phone_number', ''), phone_num)][:2]
            for bk in bks:
                tracked_bookings.append(_format_booking_tracker_item(bk, request, status_map, lang=lang))
            if not tracked_bookings:
                all_grps = GroupBooking.objects.prefetch_related('sub_bookings').order_by('-created_at')[:50]
                grp = next((g for g in all_grps if phones_match(g.leader_phone, phone_num)), None)
                if grp:
                    tracked_bookings.append(_format_group_tracker_item(grp, lang=lang))
        elif is_authenticated and phones_match(getattr(user, 'phone_number', ''), phone_num):
            bks = Booking.objects.filter(guest=user).select_related('guest', 'category', 'room').order_by('-created_at')[:2]
            for bk in bks:
                tracked_bookings.append(_format_booking_tracker_item(bk, request, status_map, lang=lang))
        else:
            hotel_context['lookup_verification_hint'] = {
                'reason': 'phone_only_not_allowed',
                'phone': phone_num
            }
        return tracked_bookings

    # 3. Hội viên đã đăng nhập hỏi chung về đơn đặt phòng / hóa đơn của tôi
    if is_authenticated and has_explicit_booking_intent:
        bks = Booking.objects.filter(guest=user).select_related('guest', 'category', 'room').order_by('-created_at')[:2]
        for bk in bks:
            tracked_bookings.append(_format_booking_tracker_item(bk, request, status_map, lang=lang))

    return tracked_bookings


def evaluate_booking_cancel_context(message, request, tracked_bookings=None):
    """
    Kiểm tra điều kiện hủy phòng miễn phí / đổi lịch theo thời gian thực cho đơn đã xác thực
    khi khách hỏi về hủy đơn, hoàn tiền, mất phí hoặc đổi ngày.
    """
    msg_low = f" {(message or '').strip().lower()} "
    cancel_intent_keywords = [
        'hủy', 'huỷ', 'hoàn tiền', 'hoàn cọc', 'mất phí', 'phí hủy', 'đổi ngày', 'đổi lịch',
        'cancel', 'cancellation', 'refund', 'penalty', 'reschedule', 'change date',
        '취소', '환불', '위약금', '일정 변경', '取消', '退款', '扣费', '改期'
    ]
    if not any(k in msg_low for k in cancel_intent_keywords):
        return None

    target_item = tracked_bookings[0] if tracked_bookings else None
    bk_obj = None
    grp_obj = None

    if target_item:
        if target_item.get('is_group'):
            raw_id = str(target_item.get('id', '')).replace('grp-', '')
            if raw_id.isdigit():
                grp_obj = GroupBooking.objects.filter(pk=int(raw_id)).first()
        else:
            bk_obj = Booking.objects.filter(pk=target_item.get('id')).first()
    else:
        user = getattr(request, 'user', None) if request else None
        if user and user.is_authenticated:
            bk_obj = (
                Booking.objects.filter(
                    guest=user,
                    status__in=['pending', 'confirmed', 'paid', 'PAID'],
                )
                .order_by('check_in_date', '-created_at')
                .first()
            )

    if grp_obj:
        elig = get_group_cancel_eligibility(grp_obj)
        if not elig:
            return None
        st = str(grp_obj.status or '').lower()
        can_cancel = st in ('tentative', 'confirmed')
        return {
            'booking_code': grp_obj.group_code,
            'is_group': True,
            'status': grp_obj.status,
            'check_in_date': grp_obj.check_in_date.strftime('%d/%m/%Y') if grp_obj.check_in_date else '',
            'can_cancel': can_cancel,
            'is_free_cancel_eligible': elig['is_free_cancel_eligible'] if can_cancel else False,
            'free_hours': elig['free_hours'],
            'hours_until_checkin': elig['hours_until_checkin'],
            'reason': 'free_window' if (can_cancel and elig['is_free_cancel_eligible']) else ('late_window' if can_cancel else f'status_{st}'),
            'is_group_managed': True,
        }

    if bk_obj:
        elig = get_booking_cancel_eligibility(bk_obj)
        if not elig:
            return None
        return {
            'booking_code': bk_obj.booking_code,
            'is_group': False,
            'status': bk_obj.status,
            'check_in_date': bk_obj.check_in_date.strftime('%d/%m/%Y') if bk_obj.check_in_date else '',
            **elig,
        }

    return None
