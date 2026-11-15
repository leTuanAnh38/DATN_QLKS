"""Dựng ngữ cảnh khách sạn: tồn phòng, thông tin lưu trú, chính sách & khuyến mãi."""
import re
import logging
from datetime import timedelta
from django.db.models import Q, F, Avg
from django.utils import timezone

from ..models import Booking, Promotion, HotelSetting
from ...rooms.models import RoomCategory
from ...services.models import ServiceItem
from ...users.models import MembershipTier

logger = logging.getLogger(__name__)
from .nlp_parser import extract_dates_from_conversation
from .text_utils import format_currency, format_currency_multilingual, strip_html_tags


def calculate_category_availability(cat, c_in, c_out, now_date=None):
    """
    Tính toán số lượng phòng trống thực tế của một Hạng phòng (RoomCategory)
    trong khoảng ngày [c_in, c_out), đồng bộ 100% với logic BookingViewSet.check_availability:
    - Nếu khoảng ngày bao gồm hôm nay: trừ các phòng vật lý đang occupied/maintenance
      và các đơn active chưa gán phòng hoặc gán vào phòng trống.
    - Nếu khoảng ngày trong tương lai: trừ các phòng đang bảo trì (maintenance)
      và tất cả các đơn đặt phòng trùng lịch (confirmed, checked_in, paid, hoặc pending trong 15 phút).
    """
    if not now_date:
        now_date = timezone.localtime(timezone.now()).date() if timezone.is_aware(timezone.now()) else timezone.now().date()

    pending_timeout = timezone.now() - timedelta(minutes=15)
    total_physical = cat.rooms.count()

    if c_in <= now_date < c_out:
        busy_physical_ids = set(cat.rooms.filter(status__in=['occupied', 'maintenance']).values_list('id', flat=True))
        active_bookings = Booking.objects.filter(
            category=cat,
            check_in_date__lt=c_out,
            check_out_date__gt=c_in
        ).filter(
            Q(status__in=['confirmed', 'checked_in', 'paid', 'PAID']) |
            Q(status='pending', created_at__gte=pending_timeout)
        )
        unassigned_or_clean_bookings = active_bookings.filter(
            Q(room__isnull=True) | ~Q(room_id__in=busy_physical_ids)
        ).count()
        total_busy = len(busy_physical_ids) + unassigned_or_clean_bookings
        avail = max(0, total_physical - total_busy)
        return total_physical, total_busy, avail
    else:
        sellable_total = cat.rooms.exclude(status='maintenance').count()
        booked_count = Booking.objects.filter(
            category=cat,
            check_in_date__lt=c_out,
            check_out_date__gt=c_in
        ).filter(
            Q(status__in=['confirmed', 'checked_in', 'paid', 'PAID']) |
            Q(status='pending', created_at__gte=pending_timeout)
        ).count()
        avail = max(0, sellable_total - booked_count)
        return total_physical, booked_count, avail


def build_active_stay_details(bk, lang='vi'):
    """
    Tổng hợp chi tiết kỳ lưu trú hiện tại (In-House Concierge) cho khách đang CHECKED_IN
    hoặc đơn đặt phòng đang tra cứu:
    - Đồng bộ hoàn toàn logic tài chính từ BookingSerializer (tránh cộng trùng `[Yêu cầu #ID]`).
    - Bảng kê Hóa đơn tạm tính (Provisional Folio): Tiền phòng thuần + Phụ phí/Minibar + Dịch vụ gọi thêm.
    - Trạng thái các đơn đồ ăn / dịch vụ vừa đặt (ServiceRequest).
    """
    if not bk:
        return None

    from ..serializers import BookingSerializer

    room_num = bk.room.room_number if bk.room else None
    floor_num = bk.room.floor if bk.room else 3
    cat_name = bk.category.name if bk.category else (bk.room.category.name if (bk.room and bk.room.category) else 'Luxury Room')

    serializer = BookingSerializer(bk)
    room_base_total = int(round(serializer.get_room_charge(bk)))
    computed_extras = serializer.get_extra_services(bk)
    grand_total = int(round(serializer.get_total_amount(bk)))
    paid_total = int(round(serializer.get_paid_amount(bk)))
    remaining_balance = int(round(serializer.get_remaining_balance(bk)))

    # 1. Phụ phí & Minibar thủ công (đã được BookingSerializer lọc bỏ [Yêu cầu #ID] trùng lặp)
    extra_items = []
    extra_all_total = 0
    service_all_total = 0
    for item in computed_extras:
        line_total = int(round(float(item.get('total_price') or 0)))
        if item.get('source') == 'extra_service':
            extra_all_total += line_total
            extra_items.append({
                'name': item.get('service_name', 'Phụ phí'),
                'quantity': item.get('quantity', 1),
                'price': int(round(float(item.get('price') or 0))),
                'total': line_total,
                'total_formatted': format_currency_multilingual(line_total, lang=lang),
                'is_paid': bool(item.get('is_paid', False))
            })
        elif item.get('source') == 'service_request':
            service_all_total += line_total

    # 2. Yêu cầu Dịch vụ / Đồ ăn tại phòng (hiển thị tối đa 8 đơn gần nhất)
    sr_status_labels = {
        'vi': {
            'pending': '⏳ Đã tiếp nhận - Đang chờ bộ phận chuẩn bị',
            'in_progress': 'Đầu bếp / Kỹ thuật viên đang thực hiện',
            'delivering': 'Nhân viên đang mang lên phòng cho Quý khách',
            'completed': 'Đã phục vụ hoàn tất tại phòng',
            'cancelled': 'Đã hủy'
        },
        'en': {
            'pending': '⏳ Received - Waiting for preparation',
            'in_progress': 'In Preparation by Chef / Therapist',
            'delivering': 'On the way to your room',
            'completed': 'Delivered & Completed',
            'cancelled': 'Cancelled'
        },
        'ko': {
            'pending': '⏳ 접수 완료 - 준비 대기 중',
            'in_progress': '셰프/담당자가 준비 중입니다',
            'delivering': '직원이 객실로 이동 중입니다',
            'completed': '서비스 제공 완료',
            'cancelled': '취소됨'
        },
        'zh': {
            'pending': '⏳ 已接单 - 正在等待准备',
            'in_progress': '厨师/技师正在为您准备',
            'delivering': '服务员正在送往您的客房',
            'completed': '已送达并完成服务',
            'cancelled': '已取消'
        }
    }
    st_dict = sr_status_labels.get(lang, sr_status_labels['vi'])

    service_orders = []
    for sr in bk.service_requests.select_related('service', 'assigned_staff').order_by('-created_at')[:8]:
        line_total = int(sr.total_price or 0)
        service_orders.append({
            'id': sr.id,
            'service_name': sr.service.name if sr.service else 'Dịch vụ phòng',
            'quantity': sr.quantity,
            'total': line_total,
            'total_formatted': format_currency_multilingual(line_total, lang=lang),
            'status': sr.status,
            'status_label': st_dict.get(sr.status, sr.status),
            'is_paid': sr.is_paid,
            'staff_name': (sr.assigned_staff.get_full_name() or sr.assigned_staff.username) if sr.assigned_staff else None,
            'created_time': timezone.localtime(sr.created_at).strftime('%H:%M %d/%m') if sr.created_at else ''
        })

    return {
        'booking_id': bk.id,
        'booking_code': bk.booking_code,
        'status': bk.status,
        'is_checked_in': str(bk.status).lower() == 'checked_in',
        'room_number': room_num or 'Chờ gán phòng',
        'floor': floor_num,
        'category_name': cat_name,
        'check_in_date': bk.check_in_date.strftime('%d/%m/%Y') if bk.check_in_date else '',
        'check_out_date': bk.check_out_date.strftime('%d/%m/%Y') if bk.check_out_date else '',
        'is_cleaning_requested': bk.room.is_cleaning_requested if bk.room else False,
        'room_total': room_base_total,
        'room_total_formatted': format_currency_multilingual(room_base_total, lang=lang),
        'extra_total': extra_all_total,
        'extra_total_formatted': format_currency_multilingual(extra_all_total, lang=lang),
        'service_total': service_all_total,
        'service_total_formatted': format_currency_multilingual(service_all_total, lang=lang),
        'grand_total': grand_total,
        'grand_total_formatted': format_currency_multilingual(grand_total, lang=lang),
        'paid_total': paid_total,
        'paid_total_formatted': format_currency_multilingual(paid_total, lang=lang),
        'unpaid_additional': remaining_balance,
        'unpaid_additional_formatted': format_currency_multilingual(remaining_balance, lang=lang),
        'extra_items': extra_items,
        'service_orders': service_orders,
        'wifi_ssid': f"TA_Luxury_5G_F{floor_num}" if room_num else "TA_Luxury_Resort_5G",
        'wifi_pass': "TALuxury@2026",
        'pool_hours': "06:00 – 22:00 (Hồ bơi Vô cực Tầng Thượng - Tầng 15, miễn phí khăn tắm & ghế nằm)",
        'breakfast_hours': "06:30 – 10:00 (Nhà hàng The Ocean - Tầng 2, Buffet Á-Âu thượng hạng)",
        'gym_spa_hours': "07:00 – 22:00 (TA Ocean Spa & Fitness - Tầng 3)",
    }


def _resolve_user_tier_info(user):
    """Đọc hạng hội viên và mức giảm giá thực tế từ MembershipTier trong DB."""
    vip_tier = "Thành viên (Member)"
    discount_pct = 0.0

    if hasattr(user, 'current_tier') and user.current_tier:
        vip_tier = user.current_tier.name
        discount_pct = float(getattr(user.current_tier, 'discount_percent', 0) or 0)
    elif hasattr(user, 'guest_profile') and user.guest_profile and user.guest_profile.vip_tier:
        vip_tier = user.guest_profile.vip_tier
        tier_obj = MembershipTier.objects.filter(
            Q(name__iexact=vip_tier) | Q(code__iexact=vip_tier)
        ).first()
        if tier_obj:
            discount_pct = float(tier_obj.discount_percent or 0)
        else:
            tier_low = str(vip_tier).lower()
            if 'diamond' in tier_low or 'kim cương' in tier_low or 'platinum' in tier_low or 'bạch kim' in tier_low:
                discount_pct = 15.0
            elif 'gold' in tier_low or 'vàng' in tier_low:
                discount_pct = 10.0
            elif 'silver' in tier_low or 'bạc' in tier_low:
                discount_pct = 5.0

    disc_str = f"{int(discount_pct)}%" if discount_pct == int(discount_pct) else f"{discount_pct}%"
    return vip_tier, disc_str


DEFAULT_SYSTEM_PROMO_CODES = {'WELCOME10', 'VIP10', 'SUMMER2026', 'TADANANG'}
_PROMO_CONTEXT_KEYWORDS = [
    'mã', 'khuyến mãi', 'giảm giá', 'voucher', 'coupon', 'promo', 'code',
    'ưu đãi', 'discount', 'áp dụng', 'còn hạn', 'hết hạn', '할인', '코드', '쿠폰', '优惠', '折扣', '优惠码'
]


def evaluate_queried_promo(message):
    """
    Kiểm tra nếu khách hàng đang hỏi về một mã khuyến mãi cụ thể (kể cả mã đã hết hạn/hết lượt/không tồn tại).
    Đồng bộ quy tắc với `ValidatePromoCodeView`.
    """
    msg = (message or '').strip()
    if not msg:
        return None

    msg_low = msg.lower()
    has_promo_context = any(k in msg_low for k in _PROMO_CONTEXT_KEYWORDS)

    # Tìm các token dạng mã chữ hoa + số (vd: WELCOME10, SUMMER2026, VIP500K, TEST10...)
    raw_tokens = re.findall(r'\b([A-Za-z0-9_-]{4,20})\b', msg)
    candidates = []
    seen = set()
    for tok in raw_tokens:
        up = tok.upper()
        if up.startswith(('BK-', 'BK_', 'GRP-', 'GRP_', 'MT-')):
            continue
        if up in seen:
            continue
        seen.add(up)
        # Chấp nhận nếu là token toàn chữ HOA có >= 4 ký tự / hoặc nằm sau từ khóa promo / hoặc khớp mã hệ thống mặc định
        is_explicit_upper = tok.isupper() and any(ch.isalpha() for ch in tok)
        if is_explicit_upper or up in DEFAULT_SYSTEM_PROMO_CODES or (has_promo_context and any(ch.isdigit() for ch in tok) and any(ch.isalpha() for ch in tok)):
            candidates.append(up)

    # Nếu chưa có candidate nhưng tin nhắn hỏi đích danh mã (vd: "mã testcode có dùng được không")
    if not candidates and has_promo_context:
        after_kw = re.search(r'(?:mã|code|voucher|coupon|promo)\s*(?:giảm\s*giá|khuyến\s*mãi)?\s*[:#`"]?\s*([A-Za-z0-9_-]{4,20})', msg, re.IGNORECASE)
        if after_kw:
            tok = after_kw.group(1).upper()
            if not tok.startswith(('BK-', 'GRP-', 'MT-')) and tok not in {'GIẢM', 'PHÒNG', 'KHUYẾN', 'DÙNG', 'ĐƯỢC'}:
                candidates.append(tok)

    if not candidates:
        return None

    now = timezone.now()
    # Ưu tiên tìm mã khớp thực sự trong DB hoặc mã hệ thống mặc định
    matched_promo = None
    matched_code = None
    for cand in candidates:
        promo = Promotion.objects.filter(code__iexact=cand).first()
        if promo:
            matched_promo = promo
            matched_code = promo.code
            break
        if cand in DEFAULT_SYSTEM_PROMO_CODES:
            matched_code = cand
            break

    if not matched_promo and not matched_code:
        if has_promo_context:
            matched_code = candidates[0]
        else:
            return None

    if matched_promo:
        discount_str = (
            f"{int(matched_promo.discount_value) if matched_promo.discount_value == int(matched_promo.discount_value) else matched_promo.discount_value}%"
            if matched_promo.discount_type == 'percentage'
            else format_currency(matched_promo.discount_value)
        )
        if matched_promo.discount_type == 'percentage' and matched_promo.max_discount_amount:
            discount_str += f" (tối đa {format_currency(matched_promo.max_discount_amount)})"
        min_order_str = format_currency(matched_promo.min_order_value) if matched_promo.min_order_value else 'Không giới hạn'
        valid_to_disp = timezone.localtime(matched_promo.valid_to).strftime('%d/%m/%Y') if matched_promo.valid_to else ''
        valid_from_disp = timezone.localtime(matched_promo.valid_from).strftime('%d/%m/%Y') if matched_promo.valid_from else ''

        if not matched_promo.is_active:
            status_code = 'inactive'
            valid = False
        elif matched_promo.valid_from and now < matched_promo.valid_from:
            status_code = 'not_started'
            valid = False
        elif matched_promo.valid_to and now > matched_promo.valid_to:
            status_code = 'expired'
            valid = False
        elif matched_promo.used_count >= matched_promo.usage_limit:
            status_code = 'limit_reached'
            valid = False
        else:
            status_code = 'active'
            valid = True

        return {
            'code': matched_promo.code,
            'name': matched_promo.name or matched_promo.code,
            'valid': valid,
            'status': status_code,
            'discount': discount_str,
            'min_order': min_order_str,
            'min_order_value': float(matched_promo.min_order_value or 0),
            'remaining_uses': max(0, int(matched_promo.usage_limit - matched_promo.used_count)),
            'valid_from': valid_from_disp,
            'valid_to': valid_to_disp,
        }

    if matched_code in DEFAULT_SYSTEM_PROMO_CODES:
        return {
            'code': matched_code,
            'name': f'Ưu đãi hệ thống {matched_code}',
            'valid': True,
            'status': 'default_system',
            'discount': '10%',
            'min_order': 'Không giới hạn',
            'min_order_value': 0,
            'remaining_uses': None,
            'valid_from': '',
            'valid_to': '',
        }

    return {
        'code': matched_code,
        'name': matched_code,
        'valid': False,
        'status': 'not_found',
        'discount': '',
        'min_order': '',
        'min_order_value': 0,
        'remaining_uses': 0,
        'valid_from': '',
        'valid_to': '',
    }


def build_hotel_context(request, date_info=None, lang='vi', guest_count=None, message=''):
    """
    Thu thập ngữ cảnh Database thời gian thực để cấp dữ liệu thực tế cho AI Prompt và Fallback:
    1. Thông tin chung & Chính sách vận hành từ HotelSetting (giờ nhận/trả, phụ thu, hủy miễn phí, số sao).
    2. Danh sách hạng phòng & đếm số phòng trống THỰC TẾ THEO LỊCH NGÀY KHÁCH HỎI (Date-Aware Availability).
    3. Danh sách dịch vụ & ẩm thực đang hoạt động kèm giá.
    4. Khuyến mãi còn lượt sử dụng & Hạng thẻ thành viên từ MembershipTier DB.
    5. Cẩm nang Du lịch, Tin tức (Post) & Đánh giá (Review) thực tế.
    6. Ngữ cảnh cá nhân hóa & Trợ lý khách đang lưu trú (CHECKED_IN In-House Concierge).
    """
    if not date_info:
        date_info = extract_dates_from_conversation('')

    c_in = date_info['check_in']
    c_out = date_info['check_out']

    context_data = {
        'hotel_info': {
            'name': 'Khách Sạn TA Đà Nẵng (5-Star Luxury Resort & Hotel)',
            'stars': 5,
            'address': '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Quận Ngũ Hành Sơn, TP. Đà Nẵng',
            'hotline': '1900 8899',
            'phone': '+84 (0) 236 388 9900',
            'email': 'contact@tahotel.vn',
            'website': 'https://tahotel.vn',
            'check_in': '14:00',
            'check_out': '12:00',
            'vat': '8%',
            'service_charge': '5%',
            'wifi_ssid': 'TA_Luxury_Resort_5G',
            'wifi_pass': 'TALuxury@2026',
            'pool_info': 'Hồ bơi vô cực hướng biển Mỹ Khê tại Tầng 15 (Mở cửa: 06:00 - 22:00)',
            'breakfast_info': 'Buffet sáng quốc tế tại Nhà hàng The Ocean - Tầng 2 (Mở cửa: 06:30 - 10:00)',
            'spa_gym_info': 'TA Ocean Spa & Gym tại Tầng 3 (Mở cửa: 07:00 - 22:00)'
        },
        'policies': {
            'early_checkin_before_6am': 100.0,
            'early_checkin_6am_9am': 50.0,
            'early_checkin_9am_12pm': 30.0,
            'late_checkout_12pm_3pm': 30.0,
            'late_checkout_3pm_6pm': 50.0,
            'late_checkout_after_6pm': 100.0,
            'cancellation_free_hours': 48,
            'auto_cancel_minutes': 30,
            'group_deposit_percent': 50.0,
        },
        'queried_dates': date_info,
        'guest_count': guest_count,
        'rooms': [],
        'services': [],
        'has_shuttle_service': False,
        'promotions': [],
        'queried_promo': evaluate_queried_promo(message),
        'danang_guide': [
            {
                'name': 'Cầu Rồng (Dragon Bridge)',
                'distance': 'Cách khách sạn 3km (~5 phút đi xe)',
                'highlight': 'Phun lửa và phun nước đặc sắc vào đúng 21:00 tối Thứ Bảy, Chủ Nhật hàng tuần và các ngày lễ lớn.'
            },
            {
                'name': 'Bãi biển Mỹ Khê (My Khe Beach)',
                'distance': 'Ngay đối diện sảnh khách sạn (chỉ 1 phút đi bộ qua đường Võ Nguyên Giáp)',
                'highlight': 'Top 6 bãi biển quyến rũ nhất hành tinh (Forbes bình chọn), lý tưởng để ngắm bình minh từ 05:15 - 06:30 sáng.'
            },
            {
                'name': 'Bán đảo Sơn Trà & Chùa Linh Ứng (Son Tra Peninsula & Lady Buddha)',
                'distance': 'Cách khách sạn 8km (~12 phút đi xe dọc đường biển)',
                'highlight': 'Chiêm bái tượng Phật Bà Quan Âm cao 67m hướng biển, ngắm toàn cảnh vịnh Đà Nẵng từ Đỉnh Bàn Cờ.'
            },
            {
                'name': 'Danh thắng Ngũ Hành Sơn (Marble Mountains)',
                'distance': 'Cách khách sạn 7km (~10 phút đi xe về hướng Nam)',
                'highlight': 'Quần thể 5 ngọn núi đá vôi cẩm thạch, động Huyền Không huyền ảo và làng đá mỹ nghệ Non Nước.'
            },
            {
                'name': 'Sun World Bà Nà Hills & Cầu Vàng (Golden Bridge)',
                'distance': 'Cách khách sạn 35km (~45 phút đi xe riêng)',
                'highlight': 'Tuyệt tác Cầu Vàng nâng đỡ bởi đôi bàn tay khổng lồ, Làng Pháp cổ kính, khí hậu 4 mùa trong một ngày (nên khởi hành lúc 07:30 - 08:00 sáng).'
            },
            {
                'name': 'Phố cổ Hội An (Hoi An Ancient Town)',
                'distance': 'Cách khách sạn 28km (~30 - 35 phút đi xe dọc cung đường biển 5 sao)',
                'highlight': 'Di sản văn hóa thế giới rực rỡ đèn lồng về đêm, thả hoa đăng trên sông Hoài, thưởng thức Cao lầu & Cơm gà (thời điểm đẹp nhất: 16:30 - 21:30).'
            }
        ],
        'recent_posts': [],
        'reviews_summary': None,
        'membership_tiers': [],
        'corporate_policy': {
            'vat_invoice': 'Hỗ trợ xuất hóa đơn tài chính điện tử VAT (8%) nhanh chóng về email doanh nghiệp.',
            'contracts': 'Hỗ trợ hợp đồng B2B với chiết khấu doanh nghiệp từ 10% - 20%.',
            'group_services': 'Tiếp nhận khai báo danh sách đoàn, tổ chức sự kiện hội nghị M.I.C.E, Gala Dinner & Team Building bãi biển.',
            'credit_terms': 'Hỗ trợ công nợ thanh toán sau 15 đến 30 ngày cho đối tác doanh nghiệp ký hợp đồng.'
        },
        'payment_methods': 'Hỗ trợ quét mã VietQR tự động gạch nợ tức thì 24/7 (kết nối trực tiếp cổng Sepay), thẻ tín dụng quốc tế Visa/Mastercard/JCB, thẻ ATM nội địa, hoặc thanh toán tại quầy lễ tân.',
        'user_context': None,
        'lookup_verification_hint': None
    }

    # 1. Lấy thông tin từ HotelSetting
    try:
        setting = HotelSetting.get_settings()
        if setting:
            stars = getattr(setting, 'stars', 5) or 5
            slogan = setting.hotel_slogan or f"{stars}-Star Luxury Hotel & Resort"
            context_data['hotel_info']['name'] = f"{setting.hotel_name} ({slogan})"
            context_data['hotel_info']['stars'] = stars
            context_data['hotel_info']['address'] = setting.address or context_data['hotel_info']['address']
            context_data['hotel_info']['hotline'] = setting.hotline or context_data['hotel_info']['hotline']
            context_data['hotel_info']['phone'] = getattr(setting, 'phone_number', '') or context_data['hotel_info']['phone']
            context_data['hotel_info']['email'] = setting.email or context_data['hotel_info']['email']
            context_data['hotel_info']['website'] = getattr(setting, 'website', '') or context_data['hotel_info']['website']
            context_data['hotel_info']['check_in'] = setting.check_in_time or '14:00'
            context_data['hotel_info']['check_out'] = setting.check_out_time or '12:00'
            context_data['hotel_info']['vat'] = f"{setting.vat_percent}%"
            context_data['hotel_info']['service_charge'] = f"{setting.service_charge_percent}%"
            context_data['corporate_policy']['vat_invoice'] = (
                f"Hỗ trợ xuất hóa đơn tài chính điện tử VAT ({setting.vat_percent}%) nhanh chóng về email doanh nghiệp."
            )
            context_data['policies'] = {
                'early_checkin_before_6am': float(getattr(setting, 'early_checkin_before_6am', 100) or 100),
                'early_checkin_6am_9am': float(getattr(setting, 'early_checkin_6am_9am', 50) or 50),
                'early_checkin_9am_12pm': float(getattr(setting, 'early_checkin_9am_12pm', 30) or 30),
                'late_checkout_12pm_3pm': float(getattr(setting, 'late_checkout_12pm_3pm', 30) or 30),
                'late_checkout_3pm_6pm': float(getattr(setting, 'late_checkout_3pm_6pm', 50) or 50),
                'late_checkout_after_6pm': float(getattr(setting, 'late_checkout_after_6pm', 100) or 100),
                'cancellation_free_hours': int(getattr(setting, 'cancellation_free_hours', 48) or 48),
                'auto_cancel_minutes': int(getattr(setting, 'auto_cancel_minutes', 30) or 30),
                'group_deposit_percent': float(getattr(setting, 'group_deposit_percent', 50) or 50),
            }
    except Exception as e:
        logger.warning(f"Lỗi khi đọc HotelSetting: {e}")

    # 1b. Lấy Hạng thẻ hội viên từ MembershipTier DB
    try:
        tiers = MembershipTier.objects.all().order_by('order', 'min_points')
        for t in tiers:
            pct = float(t.discount_percent or 0)
            pct_str = f"{int(pct)}%" if pct == int(pct) else f"{pct}%"
            context_data['membership_tiers'].append({
                'name': t.name,
                'code': t.code,
                'min_points': t.min_points,
                'discount': pct_str,
                'benefit': t.description or f"Ưu đãi giảm {pct_str} giá phòng"
            })
    except Exception as e:
        logger.warning(f"Lỗi khi đọc MembershipTier: {e}")

    if not context_data['membership_tiers']:
        context_data['membership_tiers'] = [
            {'name': 'Bạc (Silver)', 'code': 'SILVER', 'min_points': 1000, 'discount': '5%', 'benefit': 'Tích điểm nâng hạng, ưu đãi 5% giá phòng'},
            {'name': 'Vàng (Gold)', 'code': 'GOLD', 'min_points': 5000, 'discount': '10%', 'benefit': 'Giảm 10% giá phòng + Ưu tiên nâng hạng phòng miễn phí'},
            {'name': 'Bạch Kim / Kim Cương (Platinum / Diamond VIP)', 'code': 'DIAMOND', 'min_points': 15000, 'discount': '15%', 'benefit': 'Giảm 15% giá phòng + Trả phòng muộn đến 15:00, ưu đãi đặc quyền VIP'}
        ]

    # 2. Danh sách Hạng phòng & Đếm số phòng trống THỰC TẾ THEO LỊCH NGÀY KHÁCH HỎI
    try:
        now_date = timezone.localtime(timezone.now()).date() if timezone.is_aware(timezone.now()) else timezone.now().date()
        categories = RoomCategory.objects.all().prefetch_related('rooms', 'amenities', 'images')
        for cat in categories:
            total_rooms, busy_rooms, available_rooms = calculate_category_availability(cat, c_in, c_out, now_date=now_date)
            all_amenities_list = [a.name for a in cat.amenities.all()]
            top_amenities = all_amenities_list[:5]

            feat_img = cat.images.filter(is_feature=True).first() or cat.images.first()
            img_url = feat_img.image.url if (feat_img and feat_img.image) else ''
            if img_url and request:
                img_url = request.build_absolute_uri(img_url)

            clean_desc = strip_html_tags(cat.short_description or cat.description)
            effective_price = int(cat.promo_price) if cat.promo_price else int(cat.base_price)
            cancel_policy = strip_html_tags(getattr(cat, 'cancellation_policy', '') or '')

            context_data['rooms'].append({
                'id': cat.id,
                'name': cat.name,
                'slug': cat.slug,
                'base_price': int(cat.base_price),
                'base_price_formatted': format_currency(cat.base_price),
                'promo_price': int(cat.promo_price) if cat.promo_price else None,
                'promo_price_formatted': format_currency(cat.promo_price) if cat.promo_price else None,
                'effective_price': effective_price,
                'effective_price_multilingual': format_currency_multilingual(effective_price, lang=lang),
                'capacity': cat.capacity,
                'bed_type': cat.bed_type,
                'size': cat.size,
                'available_count': available_rooms,
                'total_count': total_rooms,
                'image_url': img_url,
                'amenities': ", ".join(top_amenities) if top_amenities else "Đầy đủ tiện nghi cao cấp",
                'all_amenities': ", ".join(all_amenities_list) if all_amenities_list else "Smart TV 4K, Bồn tắm, Ban công, Minibar, Két sắt, Wifi tốc độ cao",
                'cancellation_policy': cancel_policy[:200] if cancel_policy else '',
                'description': clean_desc[:280] if clean_desc else f"Không gian nghỉ dưỡng sang trọng rộng {cat.size}m² với {cat.bed_type}."
            })
    except Exception as e:
        logger.warning(f"Lỗi khi truy vấn RoomCategory: {e}")

    # 3. Danh sách Dịch vụ & Ẩm thực đang phục vụ
    try:
        services = ServiceItem.objects.filter(is_active=True).select_related('category')
        for s in services:
            s_img = s.image_url or (request.build_absolute_uri(s.image.url) if (s.image and request) else '')
            cat_name = s.category.name if s.category else 'Dịch vụ chung'
            txt_check = f"{s.name} {cat_name} {s.description or ''}".lower()
            if any(k in txt_check for k in ['xe', 'sân bay', 'đưa đón', 'airport', 'transfer', 'limousine', 'shuttle']):
                context_data['has_shuttle_service'] = True
            context_data['services'].append({
                'id': s.id,
                'name': s.name,
                'category': cat_name,
                'price': int(s.price),
                'price_formatted': format_currency(s.price),
                'price_multilingual': format_currency_multilingual(s.price, lang=lang),
                'description': s.description or '',
                'image_url': s_img
            })
    except Exception as e:
        logger.warning(f"Lỗi khi truy vấn ServiceItem: {e}")

    # 4. Danh sách Khuyến mãi đang kích hoạt & còn lượt sử dụng
    try:
        now = timezone.now()
        promos = Promotion.objects.filter(
            is_active=True,
            valid_from__lte=now,
            valid_to__gte=now,
            used_count__lt=F('usage_limit')
        )
        for p in promos:
            discount_str = f"{p.discount_value}%" if p.discount_type == 'percentage' else format_currency(p.discount_value)
            if p.discount_type == 'percentage' and p.max_discount_amount:
                discount_str += f" (tối đa {format_currency(p.max_discount_amount)})"
            context_data['promotions'].append({
                'code': p.code,
                'name': p.name or p.code,
                'discount': discount_str,
                'min_order': format_currency(p.min_order_value) if p.min_order_value else 'Không giới hạn',
                'remaining_uses': max(0, int(p.usage_limit - p.used_count))
            })
    except Exception as e:
        logger.warning(f"Lỗi khi truy vấn Promotion: {e}")

    # 4b. Đọc thêm Tin tức / Cẩm nang mới nhất (Post) & Thống kê đánh giá (Review)
    try:
        from ...posts.models import Post
        posts = Post.objects.filter(status='published').order_by('-created_at')[:3]
        for post in posts:
            context_data['recent_posts'].append({
                'title': post.title,
                'category': post.get_category_display(),
                'summary': strip_html_tags(post.summary or post.content)[:180]
            })
    except Exception:
        pass

    try:
        from ...reviews.models import Review
        visible_reviews = Review.objects.filter(is_visible=True)
        rev_count = visible_reviews.count()
        if rev_count > 0:
            avg_score = visible_reviews.aggregate(avg=Avg('overall_rating'))['avg'] or 5.0
            context_data['reviews_summary'] = {
                'count': rev_count,
                'average_rating': round(float(avg_score), 1)
            }
    except Exception:
        pass

    # 5. Ngữ cảnh Cá nhân hóa & Trợ lý khách đang lưu trú (CHECKED_IN Concierge)
    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        try:
            vip_tier, discount_rate = _resolve_user_tier_info(user)
            points = getattr(user, 'total_points', 0)
            if hasattr(user, 'guest_profile') and user.guest_profile:
                points = max(points, getattr(user.guest_profile, 'loyalty_points', 0))

            full_name = user.get_full_name() or user.username
            user_data = {
                'username': user.username,
                'full_name': full_name,
                'phone': getattr(user, 'phone_number', '') or '',
                'vip_tier': vip_tier,
                'discount_rate': discount_rate,
                'loyalty_points': points,
                'recent_bookings': [],
                'active_stay': None
            }

            prefetch_fields = (
                'extra_services',
                'service_requests__service',
                'service_requests__assigned_staff',
                'payments',
            )
            checked_in_bk = Booking.objects.filter(
                guest=user, status='checked_in'
            ).select_related('category', 'room', 'invoice', 'group_booking', 'applied_promotion').prefetch_related(*prefetch_fields).order_by('-created_at').first()

            recent_bks = list(
                Booking.objects.filter(guest=user)
                .select_related('category', 'room', 'invoice', 'group_booking', 'applied_promotion')
                .prefetch_related(*prefetch_fields)
                .order_by('-created_at')[:3]
            )

            status_map = {
                'pending': 'Chờ duyệt / Chờ thanh toán',
                'confirmed': 'Đã xác nhận',
                'paid': 'Đã thanh toán',
                'PAID': 'Đã thanh toán',
                'checked_in': 'Đang lưu trú tại phòng (Checked-in)',
                'checked_out': 'Đã trả phòng (Checked-out)',
                'completed': 'Đã hoàn tất',
                'no_show': 'Khách không đến',
                'cancelled': 'Đã hủy'
            }

            for bk in recent_bks:
                room_str = f"P.{bk.room.room_number}" if bk.room else (bk.category.name if bk.category else 'Hạng tiêu chuẩn')
                st_code = str(bk.status).lower()
                is_paid = st_code in ['paid', 'checked_in', 'checked_out', 'completed']
                user_data['recent_bookings'].append({
                    'id': bk.id,
                    'code': bk.booking_code,
                    'room': room_str,
                    'room_number': bk.room.room_number if bk.room else None,
                    'category_name': bk.category.name if bk.category else '',
                    'check_in': bk.check_in_date.strftime('%d/%m/%Y') if bk.check_in_date else '',
                    'check_out': bk.check_out_date.strftime('%d/%m/%Y') if bk.check_out_date else '',
                    'status': status_map.get(bk.status, bk.status),
                    'status_raw': bk.status,
                    'total_amount': format_currency(bk.total_amount),
                    'is_paid': "Đã thanh toán" if is_paid else "Chưa thanh toán (Chờ cọc/TT)"
                })

            target_stay_bk = checked_in_bk or (recent_bks[0] if recent_bks and str(recent_bks[0].status).lower() in ['confirmed', 'paid'] else None)
            if target_stay_bk:
                user_data['active_stay'] = build_active_stay_details(target_stay_bk, lang=lang)

            context_data['user_context'] = user_data
        except Exception as e:
            logger.warning(f"Lỗi khi nạp user context: {e}")

    return context_data
