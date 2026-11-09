import os
import re
import json
import logging
import requests
from datetime import datetime, timedelta
from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

from .models import Booking, BookingExtraService, Promotion, HotelSetting
from ..rooms.models import Room, RoomCategory
from ..services.models import ServiceItem, ServiceRequest
from ..notifications.models import Notification
from ..users.models import User

logger = logging.getLogger(__name__)


def format_currency(amount):
    """Định dạng số tiền sang chuẩn VNĐ (VD: 1.800.000 đ)"""
    try:
        val = int(amount)
        return f"{val:,.0f} đ".replace(",", ".")
    except (ValueError, TypeError):
        return f"{amount} đ"


def strip_html_tags(text):
    """Làm sạch thẻ HTML trong mô tả hạng phòng"""
    if not text:
        return ''
    clean = re.sub(r'<[^>]+>', ' ', str(text))
    return re.sub(r'\s+', ' ', clean).strip()


def detect_language(text):
    """
    Tự động nhận diện ngôn ngữ của tin nhắn khách hàng:
    - 'ko': Tiếng Hàn (chứa ký tự Hangul)
    - 'zh': Tiếng Trung (chứa ký tự Hanzi)
    - 'en': Tiếng Anh
    - 'vi': Tiếng Việt (mặc định)
    """
    if not text:
        return 'vi'

    # 1. Tiếng Hàn: Ký tự Hangul [\uac00-\ud7a3\u1100-\u11ff]
    if re.search(r'[\uac00-\ud7a3\u1100-\u11ff]', text):
        return 'ko'

    # 2. Tiếng Trung: Ký tự Hanzi [\u4e00-\u9fff]
    if re.search(r'[\u4e00-\u9fff]', text):
        return 'zh'

    # 3. Tiếng Anh: các từ khóa phổ biến trong giao tiếp khách sạn quốc tế
    text_lower = text.lower()
    english_keywords = [
        'hello', 'hi', 'good morning', 'good afternoon', 'good evening',
        'room', 'rooms', 'price', 'prices', 'rate', 'rates', 'cost', 'available', 'availability',
        'hotel', 'booking', 'reservation', 'check in', 'check out', 'how much',
        'spa', 'massage', 'restaurant', 'airport', 'shuttle', 'dinner', 'breakfast',
        'swimming', 'pool', 'suite', 'deluxe', 'what is', 'do you have', 'can i',
        'track', 'status', 'my booking', 'reservation status', 'cancel', 'refund',
        'tomorrow', 'tonight', 'weekend', 'wifi', 'password', 'bill', 'invoice', 'clean',
        'tour', 'travel', 'dragon bridge', 'ba na', 'hoi an', 'jacuzzi', 'bathtub', 'sea view', 'ocean view'
    ]
    vietnamese_accents = re.search(r'[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]', text_lower)
    if not vietnamese_accents and any(re.search(rf'\b{re.escape(kw)}\b', text_lower) for kw in english_keywords):
        return 'en'

    return 'vi'


def format_currency_multilingual(amount, lang='vi'):
    """
    Định dạng số tiền sang chuẩn VNĐ và quy đổi tự động sang USD / KRW / CNY cho khách quốc tế:
    - 1 USD ≈ 25.400 VND
    - 1 KRW ≈ 18.5 VND
    - 1 CNY ≈ 3.500 VND
    """
    try:
        val = int(amount)
        vnd_str = f"{val:,.0f} đ".replace(",", ".")
        if lang == 'en':
            usd = round(val / 25400)
            return f"{vnd_str} (~${usd} USD)"
        elif lang == 'ko':
            krw = int(round(val / 18.5, -2))
            return f"{vnd_str} (~₩{krw:,} KRW)"
        elif lang == 'zh':
            cny = round(val / 3500)
            return f"{vnd_str} (~¥{cny} CNY)"
        return vnd_str
    except (ValueError, TypeError):
        return f"{amount} đ"


def extract_dates_from_conversation(message, history=None):
    """
    Phân tích ngôn ngữ tự nhiên để bóc tách ngày Check-in và Check-out từ câu hỏi của khách
    (hoặc kế thừa từ các câu hỏi liền trước trong history):
    - Hỗ trợ: 'hôm nay', 'tối nay', 'ngày mai', 'mai', 'ngày kia', 'mốt', 'cuối tuần này',
      'tomorrow', 'tonight', 'this weekend', '내일', '모레', '주말', '明天', '后天', '周末'
    - Hỗ trợ định dạng ngày cụ thể: DD/MM/YYYY, DD-MM-YYYY, DD/MM (VD: 15/11 đến 17/11)
    - Hỗ trợ số đêm: '2 đêm', '3 đêm', '2 nights', '2박', '2晚'
    """
    now_date = timezone.localtime(timezone.now()).date() if timezone.is_aware(timezone.now()) else timezone.now().date()

    def _parse_single_text(text):
        if not text:
            return None, None, False
        t_low = text.lower()
        c_in = None
        c_out = None
        found_custom = False

        # 1. Tìm số đêm lưu trú nếu khách đề cập (VD: "2 đêm", "3 nights", "2박", "2晚")
        nights_count = 1
        nights_match = re.search(r'(\d{1,2})\s*(?:đêm|ngày đêm|nights?|박|晚)', t_low)
        if nights_match:
            try:
                nights_count = max(1, min(30, int(nights_match.group(1))))
            except ValueError:
                nights_count = 1

        # 2. Tìm các biểu thức ngày cụ thể dạng DD/MM(/YYYY) hoặc DD-MM(-YYYY)
        date_matches = re.findall(r'\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b', t_low)
        parsed_dates = []
        for d_str, m_str, y_str in date_matches:
            try:
                day_val = int(d_str)
                month_val = int(m_str)
                if not (1 <= day_val <= 31 and 1 <= month_val <= 12):
                    continue
                if y_str:
                    year_val = int(y_str)
                    if year_val < 100:
                        year_val += 2000
                else:
                    year_val = now_date.year
                    candidate = datetime(year_val, month_val, day_val).date()
                    if candidate < now_date:
                        year_val += 1
                dt_obj = datetime(year_val, month_val, day_val).date()
                if dt_obj >= now_date:
                    parsed_dates.append(dt_obj)
            except ValueError:
                continue

        if len(parsed_dates) >= 2:
            c_in = parsed_dates[0]
            c_out = parsed_dates[1] if parsed_dates[1] > c_in else (c_in + timedelta(days=nights_count))
            found_custom = True
        elif len(parsed_dates) == 1:
            c_in = parsed_dates[0]
            c_out = c_in + timedelta(days=nights_count)
            found_custom = True
        else:
            # 3. Nhận diện từ khóa thời gian tương đối
            if any(k in t_low for k in ['ngày kia', 'ngày mốt', 'bữa kia', 'day after tomorrow', '모레', '后天']):
                c_in = now_date + timedelta(days=2)
                c_out = c_in + timedelta(days=nights_count)
                found_custom = True
            elif any(k in t_low for k in ['ngày mai', 'tối mai', 'sáng mai', 'trưa mai', 'chiều mai', 'tomorrow', '내일', '明天']) or re.search(r'\bmai\b', t_low):
                c_in = now_date + timedelta(days=1)
                c_out = c_in + timedelta(days=nights_count)
                found_custom = True
            elif any(k in t_low for k in ['cuối tuần', 'thứ 7', 'thứ bảy', 'weekend', '주말', '周末']):
                # Tính ngày Thứ 7 gần nhất
                days_ahead = (5 - now_date.weekday()) % 7
                if days_ahead == 0 and now_date.weekday() == 5:
                    c_in = now_date
                else:
                    c_in = now_date + timedelta(days=days_ahead)
                c_out = c_in + timedelta(days=max(nights_count, 1))
                found_custom = True
            elif any(k in t_low for k in ['hôm nay', 'tối nay', 'đêm nay', 'bây giờ', 'today', 'tonight', '오늘', '오늘 밤', '今天', '今晚']):
                c_in = now_date
                c_out = c_in + timedelta(days=nights_count)
                found_custom = False  # Hôm nay là mặc định nhưng có thể kèm số đêm

        return c_in, c_out, found_custom

    # Ưu tiên tìm ngày trong câu hỏi hiện tại
    c_in, c_out, is_custom = _parse_single_text(message)

    # Nếu câu hiện tại chưa nói rõ ngày, kiểm tra ngược lại 3 tin nhắn gần nhất của khách trong history
    if not c_in and isinstance(history, list):
        for item in reversed(history[-4:]):
            if isinstance(item, dict) and item.get('role') in ['user', None]:
                prev_text = item.get('text') or item.get('content') or ''
                p_in, p_out, p_custom = _parse_single_text(prev_text)
                if p_in:
                    c_in, c_out, is_custom = p_in, p_out, p_custom
                    break

    if not c_in:
        c_in = now_date
        c_out = now_date + timedelta(days=1)
        is_custom = False

    if not c_out or c_out <= c_in:
        c_out = c_in + timedelta(days=1)

    nights = max(1, (c_out - c_in).days)
    return {
        'check_in': c_in,
        'check_out': c_out,
        'check_in_str': c_in.strftime('%Y-%m-%d'),
        'check_out_str': c_out.strftime('%Y-%m-%d'),
        'check_in_display': c_in.strftime('%d/%m/%Y'),
        'check_out_display': c_out.strftime('%d/%m/%Y'),
        'nights': nights,
        'is_custom_date': is_custom,
        'is_tomorrow': c_in == (now_date + timedelta(days=1)),
    }


def calculate_category_availability(cat, c_in, c_out, now_date=None):
    """
    Tính toán số lượng phòng trống thực tế của một Hạng phòng (RoomCategory)
    trong khoảng ngày [c_in, c_out), đồng bộ 100% với logic BookingViewSet.check_availability:
    - Nếu khoảng ngày bao gồm hôm nay: trừ các phòng vật lý đang occupied/maintenance
      và các đơn active chưa gán phòng hoặc gán vào phòng trống.
    - Nếu khoảng ngày trong tương lai (VD: ngày mai, cuối tuần): trừ các phòng đang bảo trì (maintenance)
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
            Q(status__in=['confirmed', 'checked_in']) |
            Q(status__in=['pending', 'paid', 'PAID'], created_at__gte=pending_timeout)
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
            Q(status__in=['confirmed', 'checked_in']) |
            Q(status__in=['pending', 'paid', 'PAID'], created_at__gte=pending_timeout)
        ).count()
        avail = max(0, sellable_total - booked_count)
        return total_physical, booked_count, avail


def build_active_stay_details(bk, lang='vi'):
    """
    Tổng hợp chi tiết kỳ lưu trú hiện tại (In-House Concierge) cho khách đang CHECKED_IN
    (hoặc đơn đặt phòng cụ thể mà khách đang tra cứu):
    - Thông tin phòng, tầng, mật khẩu Wifi, giờ hồ bơi/ăn sáng
    - Bảng kê Hóa đơn tạm tính (Provisional Folio): Tiền phòng + Phụ phí/Minibar + Dịch vụ gọi thêm
    - Trạng thái các đơn đồ ăn / dịch vụ vừa đặt (ServiceRequest)
    """
    if not bk:
        return None

    room_num = bk.room.room_number if bk.room else None
    floor_num = bk.room.floor if bk.room else 3
    cat_name = bk.category.name if bk.category else (bk.room.category.name if (bk.room and bk.room.category) else 'Luxury Room')

    room_base_total = int(bk.total_amount or 0)

    # 1. Phụ phí & Minibar (BookingExtraService)
    extra_items = []
    extra_unpaid_total = 0
    extra_all_total = 0
    for ex in bk.extra_services.all():
        line_total = int(ex.price or 0) * int(ex.quantity or 1)
        extra_all_total += line_total
        if not ex.is_paid:
            extra_unpaid_total += line_total
        extra_items.append({
            'name': ex.service_name,
            'quantity': ex.quantity,
            'price': int(ex.price or 0),
            'total': line_total,
            'total_formatted': format_currency_multilingual(line_total, lang=lang),
            'is_paid': ex.is_paid
        })

    # 2. Yêu cầu Dịch vụ / Đồ ăn tại phòng (ServiceRequest)
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
    service_unpaid_total = 0
    service_all_total = 0
    for sr in bk.service_requests.select_related('service', 'assigned_staff').order_by('-created_at')[:6]:
        line_total = int(sr.total_price or 0)
        if sr.status != 'cancelled':
            service_all_total += line_total
            if not sr.is_paid:
                service_unpaid_total += line_total
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

    grand_total = room_base_total + extra_all_total + service_all_total
    unpaid_extras_and_services = extra_unpaid_total + service_unpaid_total

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
        'unpaid_additional': unpaid_extras_and_services,
        'unpaid_additional_formatted': format_currency_multilingual(unpaid_extras_and_services, lang=lang),
        'extra_items': extra_items,
        'service_orders': service_orders,
        'wifi_ssid': f"TA_Luxury_5G_F{floor_num}" if room_num else "TA_Luxury_Resort_5G",
        'wifi_pass': "TALuxury@2026",
        'pool_hours': "06:00 – 22:00 (Hồ bơi Vô cực Tầng Thượng - Tầng 15, miễn phí khăn tắm & ghế nằm)",
        'breakfast_hours': "06:30 – 10:00 (Nhà hàng The Ocean - Tầng 2, Buffet Á-Âu thượng hạng)",
        'gym_spa_hours': "07:00 – 22:00 (TA Ocean Spa & Fitness - Tầng 3)",
    }


def build_hotel_context(request, date_info=None, lang='vi'):
    """
    Thu thập ngữ cảnh Database thời gian thực để cấp dữ liệu thực tế cho AI Prompt và Fallback:
    1. Thông tin chung khách sạn (Hotline, địa chỉ, giờ nhận/trả phòng, Wifi, Hồ bơi từ HotelSetting)
    2. Danh sách hạng phòng & đếm số phòng trống THỰC TẾ THEO LỊCH NGÀY KHÁCH HỎI (Date-Aware Availability)
    3. Danh sách dịch vụ & ẩm thực đang hoạt động kèm giá
    4. Cẩm nang Du lịch Đà Nẵng & Đội xe VIP đưa đón sân bay / tham quan
    5. Ngữ cảnh cá nhân hóa & Trợ lý khách đang lưu trú (CHECKED_IN In-House Concierge)
    """
    if not date_info:
        date_info = extract_dates_from_conversation('')

    c_in = date_info['check_in']
    c_out = date_info['check_out']

    context_data = {
        'hotel_info': {
            'name': 'Khách Sạn TA Đà Nẵng (5-Star Luxury Resort & Hotel)',
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
        'queried_dates': date_info,
        'rooms': [],
        'services': [],
        'promotions': [],
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
        'membership_tiers': [
            {'tier': 'Bạc (Silver)', 'discount': '5%', 'benefit': 'Tích điểm nâng hạng, ưu đãi 5% giá phòng'},
            {'tier': 'Vàng (Gold)', 'discount': '10%', 'benefit': 'Giảm 10% giá phòng + Miễn phí nâng hạng phòng (khi còn phòng), ưu tiên nhận phòng sớm'},
            {'tier': 'Bạch Kim / Kim Cương (Platinum / Diamond VIP)', 'discount': '15%', 'benefit': 'Giảm 15% giá phòng + Trả phòng muộn đến 15:00, miễn phí xe Limousine đón sân bay, phòng chờ VIP'}
        ],
        'corporate_policy': {
            'vat_invoice': 'Hỗ trợ xuất hóa đơn tài chính điện tử VAT (8%) nhanh chóng về email doanh nghiệp.',
            'contracts': 'Hỗ trợ hợp đồng B2B với chiết khấu doanh nghiệp từ 10% - 20%.',
            'group_services': 'Tiếp nhận khai báo danh sách đoàn, tổ chức sự kiện hội nghị M.I.C.E, Gala Dinner & Team Building bãi biển.',
            'credit_terms': 'Hỗ trợ công nợ thanh toán sau 15 đến 30 ngày cho đối tác doanh nghiệp ký hợp đồng.'
        },
        'payment_methods': 'Hỗ trợ quét mã VietQR tự động gạch nợ tức thì 24/7 (kết nối trực tiếp cổng Sepay), thẻ tín dụng quốc tế Visa/Mastercard/JCB, thẻ ATM nội địa, hoặc thanh toán tại quầy lễ tân.',
        'user_context': None
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
            context_data['hotel_info']['email'] = setting.email or context_data['hotel_info']['email']
            context_data['hotel_info']['check_in'] = setting.check_in_time or '14:00'
            context_data['hotel_info']['check_out'] = setting.check_out_time or '12:00'
            context_data['hotel_info']['vat'] = f"{setting.vat_percent}%"
            context_data['hotel_info']['service_charge'] = f"{setting.service_charge_percent}%"
    except Exception as e:
        logger.warning(f"Lỗi khi đọc HotelSetting: {e}")

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
                'amenities': ", ".join(top_amenities) if top_amenities else "Đầy đủ tiện nghi 5 sao cao cấp",
                'all_amenities': ", ".join(all_amenities_list) if all_amenities_list else "Smart TV 4K, Bồn tắm, Ban công, Minibar, Két sắt, Wifi tốc độ cao",
                'description': clean_desc[:280] if clean_desc else f"Không gian nghỉ dưỡng sang trọng rộng {cat.size}m² với {cat.bed_type}."
            })
    except Exception as e:
        logger.warning(f"Lỗi khi truy vấn RoomCategory: {e}")

    # 3. Danh sách Dịch vụ & Ẩm thực đang phục vụ
    try:
        services = ServiceItem.objects.filter(is_active=True).select_related('category')
        for s in services:
            s_img = s.image_url or (request.build_absolute_uri(s.image.url) if (s.image and request) else '')
            context_data['services'].append({
                'id': s.id,
                'name': s.name,
                'category': s.category.name if s.category else 'Dịch vụ chung',
                'price': int(s.price),
                'price_formatted': format_currency(s.price),
                'price_multilingual': format_currency_multilingual(s.price, lang=lang),
                'description': s.description or '',
                'image_url': s_img
            })
    except Exception as e:
        logger.warning(f"Lỗi khi truy vấn ServiceItem: {e}")

    # 4. Danh sách Khuyến mãi đang kích hoạt
    try:
        now = timezone.now()
        promos = Promotion.objects.filter(is_active=True, valid_from__lte=now, valid_to__gte=now)
        for p in promos:
            discount_str = f"{p.discount_value}%" if p.discount_type == 'percentage' else format_currency(p.discount_value)
            context_data['promotions'].append({
                'code': p.code,
                'name': p.name or p.code,
                'discount': discount_str,
                'min_order': format_currency(p.min_order_value) if p.min_order_value else 'Không giới hạn'
            })
    except Exception as e:
        logger.warning(f"Lỗi khi truy vấn Promotion: {e}")

    # 5. Ngữ cảnh Cá nhân hóa & Trợ lý khách đang lưu trú (CHECKED_IN Concierge)
    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        try:
            vip_tier = "Thành viên (Member)"
            discount_rate = "0%"
            if hasattr(user, 'current_tier') and user.current_tier:
                vip_tier = user.current_tier.name
                discount_rate = f"{getattr(user.current_tier, 'discount_percent', 0)}%"
            elif hasattr(user, 'guest_profile') and user.guest_profile:
                vip_tier = user.guest_profile.vip_tier or vip_tier

            tier_low = str(vip_tier).lower()
            if 'platinum' in tier_low or 'bạch kim' in tier_low or 'diamond' in tier_low or 'kim cương' in tier_low:
                discount_rate = "15%"
            elif 'gold' in tier_low or 'vàng' in tier_low:
                discount_rate = "10%"
            elif 'silver' in tier_low or 'bạc' in tier_low:
                discount_rate = "5%"

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

            # Ưu tiên tìm đơn đang lưu trú (checked_in) hoặc đơn gần nhất
            checked_in_bk = Booking.objects.filter(
                guest=user, status='checked_in'
            ).select_related('category', 'room').prefetch_related('extra_services', 'service_requests__service').order_by('-created_at').first()

            recent_bks = Booking.objects.filter(guest=user).select_related('category', 'room').prefetch_related('extra_services', 'service_requests__service').order_by('-created_at')[:3]

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


def resolve_room_from_conversation(message, history, rooms_list):
    """
    Hỗ trợ Bộ nhớ hội thoại nhiều lượt (Multi-turn Memory):
    Khi khách hỏi câu nối tiếp như 'Phòng đó có bồn tắm jacuzzi không?', 'Phòng này rộng bao nhiêu m2?',
    tự động tìm hạng phòng đang được nhắc tới trong câu hiện tại hoặc trong các tin nhắn trước đó.
    """
    if not rooms_list:
        return None

    def _match_room_in_text(txt):
        if not txt:
            return None
        t_low = txt.lower()
        # Khớp chính xác tên phòng hoặc từ khóa đặc trưng của hạng phòng
        best_room = None
        best_score = 0
        for r in rooms_list:
            r_name = r.get('name', '').lower()
            if r_name and r_name in t_low:
                return r
            words = [w for w in re.split(r'\s+', r_name) if len(w) >= 3 and w not in ['phòng', 'hạng', 'room']]
            score = sum(1 for w in words if w in t_low)
            if score > best_score:
                best_score = score
                best_room = r
        return best_room if best_score > 0 else None

    # 1. Tìm ngay trong tin nhắn hiện tại
    matched = _match_room_in_text(message)
    if matched:
        return matched

    # 2. Nếu câu hiện tại dùng đại từ ('phòng đó', 'phòng này', 'hạng đó', 'it', 'that room', 'this room') hoặc hỏi tiện ích chi tiết, quét ngược history
    if isinstance(history, list):
        for item in reversed(history[-5:]):
            if not isinstance(item, dict):
                continue
            prev_text = item.get('text') or item.get('content') or ''
            matched = _match_room_in_text(prev_text)
            if matched:
                return matched

    return None


def generate_system_prompt(hotel_context, housekeeping_action=None):
    """
    Sinh System Prompt chuẩn mực cho AI Gemini:
    Đóng vai Trợ lý ảo Lễ tân & Concierge 5 sao của Khách sạn TA Đà Nẵng,
    nắm rõ lịch phòng trống thực tế theo ngày khách hỏi, thông tin lưu trú CHECKED_IN,
    hóa đơn tạm tính, trạng thái đồ ăn và cẩm nang du lịch Đà Nẵng.
    """
    h_info = hotel_context['hotel_info']
    d_info = hotel_context.get('queried_dates', {})
    date_range_str = f"Nhận phòng {d_info.get('check_in_display')} - Trả phòng {d_info.get('check_out_display')} ({d_info.get('nights', 1)} đêm)"

    # 1. Chuỗi phòng kèm lịch trống thực tế & tiện nghi chi tiết
    room_lines = []
    for r in hotel_context['rooms']:
        price_text = f"Giá gốc: {r['base_price_formatted']}"
        if r.get('promo_price_formatted'):
            price_text += f" (Giá ưu đãi: {r['promo_price_formatted']})"
        avail = f"Còn {r['available_count']}/{r['total_count']} phòng trống" if r['available_count'] > 0 else "HẾT PHÒNG trong khoảng ngày này"
        room_lines.append(
            f"- {r['name']} (Diện tích: {r['size']}m² | Sức chứa: {r['capacity']} khách | Giường: {r['bed_type']}):\n"
            f"  + {price_text} | Tình trạng ({date_range_str}): {avail}\n"
            f"  + Tiện nghi & Đặc điểm: {r['all_amenities']} | {r['description']}"
        )
    rooms_text = "\n".join(room_lines) if room_lines else "Tất cả các hạng phòng đang được phục vụ."

    # 2. Chuỗi dịch vụ
    svc_lines = []
    for s in hotel_context['services'][:18]:
        svc_lines.append(f"- [{s['category']}] {s['name']}: {s['price_formatted']} ({s['description']})")
    services_text = "\n".join(svc_lines) if svc_lines else "Phục vụ 24/7 ẩm thực, spa, xe đưa đón sân bay."

    # 3. Chuỗi khuyến mãi
    promo_lines = []
    for p in hotel_context['promotions']:
        promo_lines.append(f"- Mã `{p['code']}` ({p['name']}): Giảm {p['discount']} (Đơn tối thiểu: {p['min_order']})")
    promos_text = "\n".join(promo_lines) if promo_lines else "Ưu đãi thẻ hội viên Silver 5%, Gold 10%, Platinum 15%."

    # 4. Cẩm nang Du lịch Đà Nẵng
    guide_lines = []
    for g in hotel_context.get('danang_guide', []):
        guide_lines.append(f"- {g['name']} ({g['distance']}): {g['highlight']}")
    guide_text = "\n".join(guide_lines)

    # 5. Chuỗi cá nhân hóa & Trợ lý khách đang lưu trú (CHECKED_IN Concierge)
    user_str = "Khách hàng hiện tại: Khách vãng lai (Chưa đăng nhập)."
    if hotel_context.get('user_context'):
        u = hotel_context['user_context']
        bks_str = ""
        for b in u['recent_bookings']:
            bks_str += f"\n  + Mã đơn: #{b['code']} | Phòng: {b['room']} ({b['category_name']}) | Nhận: {b['check_in']} - Trả: {b['check_out']} | Trạng thái: {b['status']} | Tiền phòng: {b['total_amount']} ({b['is_paid']})"

        active_stay_str = ""
        if u.get('active_stay'):
            st = u['active_stay']
            extra_str = ", ".join([f"{ex['name']} x{ex['quantity']} ({ex['total_formatted']})" for ex in st['extra_items']]) or "Chưa phát sinh"
            orders_str = "\n".join([
                f"    * Món/Dịch vụ: {sr['service_name']} x{sr['quantity']} ({sr['total_formatted']}) -> Trạng thái: {sr['status_label']} (Đặt lúc {sr['created_time']})"
                for sr in st['service_orders']
            ]) or "    * Hiện chưa có đơn gọi món/dịch vụ nào."
            active_stay_str = (
                f"\n[ĐẶC QUYỀN KHÁCH ĐANG LƯU TRÚ (IN-HOUSE GUEST CONCIERGE)]:\n"
                f"- Phòng đang ở: Phòng {st['room_number']} (Tầng {st['floor']} - {st['category_name']}) | Mã đơn: #{st['booking_code']}\n"
                f"- Wifi riêng tốc độ cao: Tên mạng `{st['wifi_ssid']}` | Mật khẩu: `{st['wifi_pass']}`\n"
                f"- HÓA ĐƠN TẠM TÍNH HIỆN TẠI (PROVISIONAL FOLIO):\n"
                f"  + Tiền phòng ({st['check_in_date']} - {st['check_out_date']}): {st['room_total_formatted']}\n"
                f"  + Phụ phí & Minibar: {st['extra_total_formatted']} ({extra_str})\n"
                f"  + Dịch vụ gọi thêm tại phòng (F&B/Spa/Xe): {st['service_total_formatted']}\n"
                f"  + TỔNG HÓA ĐƠN TẠM TÍNH: {st['grand_total_formatted']} (Phát sinh chưa thanh toán: {st['unpaid_additional_formatted']})\n"
                f"- TIẾN TRÌNH ĐƠN ĐỒ ĂN / DỊCH VỤ VỪA ĐẶT:\n{orders_str}"
            )

        user_str = (
            f"Thông tin Khách hàng đang trò chuyện:\n"
            f"- Họ tên: {u['full_name']} (Tài khoản: {u['username']} | SĐT: {u['phone']})\n"
            f"- Hạng thẻ hội viên: {u['vip_tier']} (Ưu đãi giảm giá: {u['discount_rate']}) | Điểm tích lũy: {u['loyalty_points']} điểm\n"
            f"- Đơn đặt phòng gần nhất:{bks_str if bks_str else ' Chưa có đơn đặt phòng nào.'}"
            f"{active_stay_str}"
        )

    hk_str = ""
    if housekeeping_action:
        hk_str = (
            f"\n[HÀNH ĐỘNG TỰ ĐỘNG VỪA KÍCH HOẠT]: Hệ thống đã tự động gửi phiếu yêu cầu dọn phòng/buồng phòng khẩn cấp "
            f"cho Phòng {housekeeping_action['room_number']} (#{housekeeping_action['booking_code']}) tới bộ phận Housekeeping. "
            f"Hãy xác nhận ngay với Quý khách rằng nhân viên buồng phòng sẽ có mặt trong 5-10 phút tới!"
        )

    system_prompt = f"""Bạn là Trợ lý ảo AI Concierge 5 sao cao cấp của {h_info['name']}.
NGUYÊN TẮC GIAO TIẾP & ĐỊNH DẠNG (CHUẨN 5 SAO LUXURY):
1. Luôn xưng "Em" và gọi người dùng là "Quý khách" (hoặc tên khách nếu đã đăng nhập).
2. Giọng điệu thượng lưu, lễ phép, ấm áp, tinh tế chuẩn khách sạn nghỉ dưỡng 5 sao quốc tế.
3. Trình bày câu trả lời rõ ràng bằng Markdown: dùng **in đậm** cho giá tiền/tên phòng, gạch đầu dòng `•`, hoặc lập Bảng Markdown (`| Hạng phòng | Giá/đêm | Phòng trống |`) khi khách muốn so sánh nhiều phòng.
4. TUYỆT ĐỐI CHỈ dựa vào số liệu thực tế từ hệ thống bên dưới, không tự bịa đặt giá hay số lượng phòng trống.

QUY TẮC ĐA NGÔN NGỮ & QUY ĐỔI TỶ GIÁ:
- Tự động trả lời bằng đúng ngôn ngữ khách dùng (Việt / Anh / Hàn / Trung).
- Với khách quốc tế, luôn hiển thị giá gốc VND kèm quy đổi tương đương (~$USD, ~₩KRW, ~¥CNY).

THÔNG TIN KHÁCH SẠN & TIỆN ÍCH NỘI KHU:
- Tên: {h_info['name']} | Địa chỉ: {h_info['address']}
- Hotline Lễ tân & Concierge 24/7: {h_info['hotline']} | Email: {h_info['email']}
- Giờ Check-in: từ {h_info['check_in']} | Giờ Check-out: trước {h_info['check_out']}
- Wifi miễn phí: `{h_info['wifi_ssid']}` | Mật khẩu: `{h_info['wifi_pass']}`
- Hồ bơi: {h_info['pool_info']}
- Ăn sáng: {h_info['breakfast_info']}
- Spa & Gym: {h_info['spa_gym_info']}

TÌNH TRẠNG PHÒNG TRỐNG & BẢNG GIÁ THỰC TẾ (KHOẢNG NGÀY ĐANG KIỂM TRA: {date_range_str}):
{rooms_text}

DANH MỤC DỊCH VỤ ẨM THỰC, SPA & XE ĐƯA ĐÓN SÂN BAY:
{services_text}

MÃ KHUYẾN MÃI & ĐẶC QUYỀN HỘI VIÊN:
{promos_text}
- Hạng Bạc (Silver): Giảm 5% giá phòng.
- Hạng Vàng (Gold): Giảm 10% giá phòng + Ưu tiên nâng hạng phòng miễn phí.
- Hạng Bạch Kim (Platinum): Giảm 15% giá phòng + Trả phòng muộn đến 15:00 & Miễn phí xe đón sân bay.

CẨM NANG DU LỊCH ĐÀ NẴNG & ĐIỀU HƯỚNG ĐẶT XE VIP:
{guide_text}
* Lưu ý: Khi tư vấn lịch trình tham quan hoặc sân bay, hãy luôn khéo léo giới thiệu Đội xe VIP Limousine & Mercedes đưa đón riêng của khách sạn TA Đà Nẵng để khách đặt ngay bên dưới.

{user_str}{hk_str}
"""
    return system_prompt


def local_smart_fallback(message, user, hotel_context, tracked_bookings=None, lang='vi', history=None, housekeeping_action=None):
    """
    CƠ CHẾ FALLBACK THÔNG MINH ĐA NGÔN NGỮ (Offline / No Key / Quota Exceeded / Network Error):
    - Có bộ nhớ hội thoại nhiều lượt (Multi-turn Memory) nhờ tham số `history`.
    - Kiểm tra đúng số phòng trống theo ngày khách hỏi (`queried_dates`).
    - Giải đáp chi tiết tiện nghi từng hạng phòng (Jacuzzi, hướng biển, diện tích, giường).
    - Phục vụ khách đang lưu trú (`CHECKED_IN`): báo hóa đơn tạm tính, tiến trình đơn đồ ăn, mật khẩu Wifi, giờ hồ bơi, gọi dọn phòng.
    - Tư vấn du lịch Đà Nẵng (Cầu Rồng, Bà Nà, Hội An, Sơn Trà) kèm điều hướng đặt xe đưa đón VIP.
    """
    msg = message.strip().lower()
    h_info = hotel_context['hotel_info']
    d_info = hotel_context.get('queried_dates', {})
    user_ctx = hotel_context.get('user_context')
    active_stay = user_ctx.get('active_stay') if user_ctx else None

    # Nếu khách vừa tra cứu 1 đơn cụ thể mà chưa đăng nhập, lấy thông tin active_stay từ đơn đó
    if not active_stay and tracked_bookings and len(tracked_bookings) > 0:
        first_bk_obj = Booking.objects.filter(id=tracked_bookings[0]['id']).select_related('category', 'room').prefetch_related('extra_services', 'service_requests__service').first()
        if first_bk_obj:
            active_stay = build_active_stay_details(first_bk_obj, lang=lang)

    # -------------------------------------------------------------------------
    # 0. XỬ LÝ YÊU CẦU DỌN PHÒNG / BUỒNG PHÒNG CHO KHÁCH ĐANG LƯU TRÚ
    # -------------------------------------------------------------------------
    if housekeeping_action:
        r_num = housekeeping_action['room_number']
        if lang == 'en':
            return (
                f"Dear **{housekeeping_action['guest_name']}**, I have immediately dispatched an urgent **Housekeeping & Room Service Request** for **Room P.{r_num}** (Booking `#{housekeeping_action['booking_code']}`)!\n\n"
                f"• **Request Detail**: *{housekeeping_action['request_note']}*\n"
                f"• ⏱️ **Estimated Arrival**: Our Housekeeping attendant will arrive at your room within **5 – 10 minutes**.\n\n"
                f"If you need any additional amenities, please feel free to message me or dial **`0`** from your in-room telephone!"
            )
        return (
            f"Dạ em kính chào Quý khách **{housekeeping_action['guest_name']}**! Em đã lập tức chuyển lệnh **Yêu cầu Phục vụ Buồng phòng** cho **Phòng P.{r_num}** (Mã đơn `#{housekeeping_action['booking_code']}`) tới bộ phận Housekeeping rồi ạ:\n\n"
            f"• **Nội dung yêu cầu**: *{housekeeping_action['request_note']}*\n"
            f"• ⏱️ **Thời gian phản hồi**: Nhân viên Buồng phòng sẽ có mặt tại phòng Quý khách trong khoảng **5 – 10 phút** nữa ạ.\n"
            f"• **Trạng thái hệ thống**: Đã bật tín hiệu ưu tiên trên Sơ đồ phòng Lễ tân.\n\n"
            f"Quý khách cần thêm khăn tắm, nước suối hay bất kỳ tiện ích nào khác cứ nhắn cho em bất cứ lúc nào nhé ạ!"
        )

    # -------------------------------------------------------------------------
    # 1. TRỢ LÝ CHO KHÁCH ĐANG LƯU TRÚ: HÓA ĐƠN TẠM TÍNH / TIẾN TRÌNH ĐỒ ĂN / WIFI & HỒ BƠI
    # -------------------------------------------------------------------------
    # 1A. Hỏi về Hóa đơn tạm tính (Provisional Bill / Folio)
    is_bill_query = any(k in msg for k in [
        'hóa đơn tạm tính', 'tạm tính', 'tiền phòng của tôi', 'tổng chi phí', 'phát sinh', 'minibar',
        'hóa đơn phòng', 'thanh toán bao nhiêu', 'hết bao nhiêu tiền', 'folio', 'my bill', 'current bill', 'charges'
    ])
    if is_bill_query and active_stay:
        extra_lines = "\n".join([
            f"  + {ex['name']} (x{ex['quantity']}): **{ex['total_formatted']}** ({'Đã TT' if ex['is_paid'] else 'Chưa TT'})"
            for ex in active_stay['extra_items']
        ]) or "  + *Chưa có phụ phí Minibar / Giặt ủi*"

        svc_lines = "\n".join([
            f"  + {sr['service_name']} (x{sr['quantity']}): **{sr['total_formatted']}** — *{sr['status_label']}*"
            for sr in active_stay['service_orders'] if sr['status'] != 'cancelled'
        ]) or "  + *Chưa có dịch vụ gọi thêm*"

        return (
            f"Dạ em xin gửi Quý khách **Bảng kê Hóa đơn tạm tính (Provisional Folio)** thời gian thực của **Phòng P.{active_stay['room_number']}** (Mã đơn `#{active_stay['booking_code']}`) ạ:\n\n"
            f"### Chi tiết chi phí lưu trú ({active_stay['check_in_date']} ➔ {active_stay['check_out_date']})\n"
            f"• **Tiền hạng phòng ({active_stay['category_name']})**: **{active_stay['room_total_formatted']}**\n"
            f"• **Phụ phí & Minibar phát sinh**: **{active_stay['extra_total_formatted']}**\n{extra_lines}\n"
            f"• **Dịch vụ Ẩm thực / Spa / Xe gọi thêm**: **{active_stay['service_total_formatted']}**\n{svc_lines}\n\n"
            f"• **TỔNG CỘNG TẠM TÍNH**: **{active_stay['grand_total_formatted']}**\n"
            f"• **Khoản phát sinh chờ quyết toán khi Check-out**: **{active_stay['unpaid_additional_formatted']}**\n\n"
            f"Quý khách có thể thanh toán nhanh qua mã **VietQR tự động** tại quầy Lễ tân khi làm thủ tục trả phòng nhé ạ!"
        )

    # 1B. Hỏi về tiến trình đơn đồ ăn / dịch vụ vừa đặt
    is_service_order_status = any(k in msg for k in [
        'đơn đồ ăn', 'món ăn tôi đặt', 'đồ ăn tới đâu', 'ở bước nào', 'bao giờ có đồ ăn',
        'dịch vụ tôi đặt', 'đơn dịch vụ', 'order status', 'my food', 'room service status'
    ])
    if is_service_order_status:
        if active_stay and active_stay['service_orders']:
            order_lines = []
            for sr in active_stay['service_orders']:
                staff_info = f" | Nhân viên phụ trách: **{sr['staff_name']}**" if sr['staff_name'] else ""
                order_lines.append(
                    f"• **{sr['service_name']} (x{sr['quantity']})** — Giá: **{sr['total_formatted']}**\n"
                    f"  ➔ Tiến trình: **{sr['status_label']}** *(Đặt lúc {sr['created_time']}{staff_info})*"
                )
            return (
                f"Dạ em đã kiểm tra tiến trình các yêu cầu dịch vụ tại **Phòng P.{active_stay['room_number']}** của Quý khách:\n\n"
                + "\n\n".join(order_lines) +
                f"\n\nBộ phận Ẩm thực & Dịch vụ đang phục vụ Quý khách với tốc độ ưu tiên cao nhất. Nếu cần hối đơn gấp, Quý khách vui lòng liên hệ Hotline nội bộ **{h_info['hotline']}** nhé ạ!"
            )
        else:
            return (
                "Dạ hiện tại trên hệ thống em chưa ghi nhận đơn gọi món hoặc dịch vụ phòng nào đang chờ xử lý của Quý khách ạ.\n\n"
                "Quý khách có thể bấm vào **Thẻ Dịch vụ & Ẩm thực** bên dưới hoặc vào mục **Menu Dịch Vụ** để đặt bò Wagyu A5, hải sản Mỹ Khê, Ocean Spa hoặc xe đưa đón sân bay phục vụ tận phòng 24/7 nhé ạ!"
            )

    # 1C. Hỏi về Mật khẩu Wifi / Giờ mở cửa Hồ bơi / Ăn sáng / Gym / Chính sách nhận trả phòng
    is_facility_info = any(k in msg for k in [
        'wifi', 'mật khẩu', 'password', 'pass wifi', 'mạng',
        'hồ bơi', 'bể bơi', 'pool', 'swimming', 'ăn sáng', 'buffet', 'breakfast',
        'gym', 'fitness', 'mấy giờ', 'giờ mở cửa', 'nhận phòng', 'trả phòng', 'check-in', 'check-out', 'check in', 'check out'
    ])
    if is_facility_info:
        room_badge = f" (Phòng **P.{active_stay['room_number']}** - Tầng {active_stay['floor']})" if active_stay else ""
        wifi_name = active_stay['wifi_ssid'] if active_stay else h_info['wifi_ssid']
        wifi_pwd = active_stay['wifi_pass'] if active_stay else h_info['wifi_pass']
        if lang == 'en':
            return (
                f"Dear Valued Guest{room_badge}, here is the essential information for your stay at **{h_info['name']}**:\n\n"
                f"• **High-Speed Wi-Fi**: Network **`{wifi_name}`** | Password: **`{wifi_pwd}`**\n"
                f"• **Rooftop Infinity Pool**: **06:00 – 22:00** at **15th Floor** (Panoramic My Khe ocean view, free towels).\n"
                f"• **International Buffet Breakfast**: **06:30 – 10:00** at **The Ocean Restaurant – 2nd Floor**.\n"
                f"• **TA Ocean Spa & Fitness Center**: **07:00 – 22:00** at **3rd Floor**.\n"
                f"• **Check-in / Check-out Policy**: Standard Check-in from **{h_info['check_in']}** | Check-out before **{h_info['check_out']}** (Late check-out until 15:00 complimentary for Platinum VIP members).\n\n"
                f"How else may I make your stay more comfortable today?"
            )
        return (
            f"Dạ em xin gửi Quý khách{room_badge} thông tin tiện ích nội khu và quy định lưu trú tại **{h_info['name']}** ạ:\n\n"
            f"• **Wifi tốc độ cao 5G**: Tên mạng **`{wifi_name}`** | Mật khẩu: **`{wifi_pwd}`**\n"
            f"• **Hồ bơi Vô cực (Infinity Pool)**: Mở cửa **06:00 – 22:00** tại **Tầng 15 (Tầng thượng)** ngắm trọn bình minh biển Mỹ Khê (miễn phí khăn tắm & ghế thư giãn).\n"
            f"• **Buffet Sáng Quốc Tế**: Phục vụ từ **06:30 – 10:00** tại **Nhà hàng The Ocean – Tầng 2**.\n"
            f"• **TA Ocean Spa & Phòng Gym**: Mở cửa **07:00 – 22:00** tại **Tầng 3**.\n"
            f"• **Giờ Nhận / Trả phòng tiêu chuẩn**: Nhận phòng (Check-in) từ **{h_info['check_in']}** | Trả phòng (Check-out) trước **{h_info['check_out']}** *(Hội viên Platinum VIP được miễn phí trả phòng muộn đến 15:00)*.\n\n"
            f"Nếu Quý khách cần gọi đồ ăn lên phòng hoặc yêu cầu dọn phòng, hãy nhắn ngay cho em nhé ạ!"
        )

    # -------------------------------------------------------------------------
    # 2. TƯ VẤN DU LỊCH ĐÀ NẴNG & ĐIỀU HƯỚNG XE ĐƯA ĐÓN SÂN BAY VIP
    # -------------------------------------------------------------------------
    is_travel_query = any(k in msg for k in [
        'du lịch', 'chơi gì', 'đi đâu', 'tham quan', 'lịch trình', 'đà nẵng',
        'cầu rồng', 'phun lửa', 'bà nà', 'cầu vàng', 'sơn trà', 'linh ứng', 'hội an', 'ngũ hành sơn', 'mỹ khê',
        'tour', 'travel', 'sightseeing', 'itinerary', 'dragon bridge', 'ba na', 'golden bridge', 'hoi an', 'marble mountain',
        '다낭 여행', '관광', '용다리', '바나힐', '호이안', '미케비치',
        '岘港旅游', '景点', '龙桥', '巴拿山', '会安', '美溪'
    ])
    if is_travel_query:
        if lang == 'en':
            return (
                f"Dear Valued Guest, as your Local Concierge in Da Nang, I have curated the finest attractions around **{h_info['name']}**:\n\n"
                f"• **Dragon Bridge (Cầu Rồng)** *(5 mins / 3km)*: Famous Fire & Water show at **21:00 every Saturday, Sunday** and major holidays.\n"
                f"• **My Khe Beach** *(1 min walk across the street)*: Voted by Forbes as one of the world's most luxurious beaches.\n"
                f"• **Son Tra Peninsula & Lady Buddha (Chùa Linh Ứng)** *(12 mins / 8km)*: Home to the 67m tall Goddess of Mercy statue overlooking the ocean.\n"
                f"• **Marble Mountains (Ngũ Hành Sơn)** *(10 mins / 7km)*: Mystical limestone caves and ancient pagodas.\n"
                f"• **Sun World Ba Na Hills & Golden Bridge** *(45 mins / 35km)*: Iconic giant hands bridge & French Village.\n"
                f"• **Hoi An Ancient Town** *(30 mins / 28km)*: UNESCO Heritage lantern town, best visited from **16:30 – 21:30**.\n\n"
                f"**VIP Chauffeur & Airport Transfer**: Our hotel provides private **Mercedes & Luxury Limousine** transfers to the airport, Ba Na Hills, and Hoi An. You can book our transfer service directly via the **Service Card** below!"
            )
        return (
            f"Dạ với lợi thế tọa lạc ngay mặt tiền biển Mỹ Khê, từ **{h_info['name']}** Quý khách có thể dễ dàng khám phá những biểu tượng du lịch tuyệt đẹp của Đà Nẵng – Hội An ạ:\n\n"
            f"### Lịch trình & Điểm tham quan nổi bật từ Khách sạn\n"
            f"• **Bãi biển Mỹ Khê** *(Chỉ 1 phút đi bộ qua đường)*: Top 6 bãi biển quyến rũ nhất hành tinh, tuyệt đẹp để tắm biển và ngắm bình minh lúc **05:15 – 06:30**.\n"
            f"• **Cầu Rồng phun lửa & nước** *(3km – 5 phút đi xe)*: Trình diễn phun lửa và phun nước vào đúng **21:00 tối Thứ Bảy, Chủ Nhật** hàng tuần.\n"
            f"• **Bán đảo Sơn Trà & Chùa Linh Ứng** *(8km – 12 phút đi xe)*: Chiêm bái tượng Phật Bà Quan Âm cao 67m hướng biển Đông.\n"
            f"• **Danh thắng Ngũ Hành Sơn** *(7km – 10 phút đi xe)*: Khám phá động Huyền Không và làng đá mỹ nghệ Non Nước.\n"
            f"• **Sun World Bà Nà Hills & Cầu Vàng** *(35km – 45 phút đi xe)*: Trải nghiệm cáp treo kỷ lục thế giới và khí hậu 4 mùa (nên khởi hành lúc **07:30 sáng**).\n"
            f"• **Phố cổ Hội An** *(28km – 30 phút đi xe)*: Phố đèn lồng di sản lung linh bên sông Hoài (đẹp nhất từ **16:30 – 21:30**).\n\n"
            f"**Đặc quyền Xe Đưa Đón VIP**: Khách sạn có sẵn **Đội xe Limousine & Mercedes riêng** phục vụ đón/tiễn Sân bay Đà Nẵng và đưa đón tham quan Bà Nà – Hội An tận nơi. Em đã hiển thị **Thẻ Đặt Xe Đưa Đón** ngay bên dưới để Quý khách đặt nhanh 1 chạm ạ!"
        )

    # -------------------------------------------------------------------------
    # 3. TRA CỨU ĐƠN ĐẶT PHÒNG (BOOKING TRACKER)
    # -------------------------------------------------------------------------
    if tracked_bookings and len(tracked_bookings) > 0:
        bk = tracked_bookings[0]
        if lang == 'en':
            return (
                f"Dear Valued Guest, I have retrieved your reservation **#{bk['booking_code']}** from our system:\n\n"
                f"• **Guest Name**: {bk['guest_name']}\n"
                f"• **Room**: {bk['room_name']}\n"
                f"• **Stay Period**: Check-in **{bk['check_in_date']}** ➔ Check-out **{bk['check_out_date']}**\n"
                f"• **Total Price**: **{bk['total_amount']}**\n"
                f"• **Current Status**: **{bk['status_label']}**\n\n"
                f"I have displayed the **Real-Time Booking Progress Tracker** right below!"
            )
        elif lang == 'ko':
            return (
                f"고객님 안녕하십니까! 시스템에서 고객님의 예약 내역 **#{bk['booking_code']}**을(를) 확인하였습니다:\n\n"
                f"• **투숙객 성함**: {bk['guest_name']}\n"
                f"• **배정 객실**: {bk['room_name']}\n"
                f"• **투숙 기간**: 체크인 **{bk['check_in_date']}** ➔ 체크아웃 **{bk['check_out_date']}**\n"
                f"• **총 결제 금액**: **{bk['total_amount']}**\n"
                f"• **현재 진행 상태**: **{bk['status_label']}**\n\n"
                f"아래에 **실시간 예약 진행 카드**를 준비해 두었습니다!"
            )
        elif lang == 'zh':
            return (
                f"尊敬的贵宾，您好！已为您在系统中查询到预订信息 **#{bk['booking_code']}**：\n\n"
                f"• **入住宾客**: {bk['guest_name']}\n"
                f"• **预订房型**: {bk['room_name']}\n"
                f"• **入住时间**: 入住 **{bk['check_in_date']}** ➔ 退房 **{bk['check_out_date']}**\n"
                f"• **总计金额**: **{bk['total_amount']}**\n"
                f"• **当前状态**: **{bk['status_label']}**\n\n"
                f"下方已为您展示**实时预订进度卡片**！"
            )
        else:
            return (
                f"Dạ em đã kiểm tra và tìm thấy thông tin đơn đặt phòng **#{bk['booking_code']}** trên hệ thống ạ:\n\n"
                f"• **Khách lưu trú**: {bk['guest_name']}\n"
                f"• **Hạng phòng**: {bk['room_name']}\n"
                f"• **Thời gian**: Nhận phòng **{bk['check_in_date']}** ➔ Trả phòng **{bk['check_out_date']}**\n"
                f"• **Tổng tiền phòng**: **{bk['total_amount']}**\n"
                f"• **Tiến trình hiện tại**: **{bk['status_label']}**\n\n"
                f"Em đã hiển thị **Thẻ tiến trình đơn hàng thời gian thực** ngay bên dưới để Quý khách tiện theo dõi ạ!"
            )

    is_booking_query = any(k in msg for k in [
        'đơn đặt phòng', 'đặt phòng của tôi', 'kiểm tra đơn', 'tra cứu đơn', 'mã đơn', 'trạng thái đơn',
        'my booking', 'check booking', 'track reservation', '예약 조회', '내 예약', '预订查询', '我的订单'
    ])
    if is_booking_query:
        if user_ctx and user_ctx.get('recent_bookings'):
            reply_lines = [
                f"Dạ em kính chào Quý khách **{user_ctx['full_name']}** (Hạng thẻ **{user_ctx['vip_tier']}**)! Em xin gửi thông tin các đơn đặt phòng gần đây của Quý khách:\n"
            ]
            for b in user_ctx['recent_bookings']:
                reply_lines.append(
                    f"**Mã đơn: #{b['code']}**\n"
                    f"  • Phòng: **{b['room']}**\n"
                    f"  • Lưu trú: **{b['check_in']}** ➔ **{b['check_out']}**\n"
                    f"  • Trạng thái: **{b['status']}** ({b['is_paid']})\n"
                    f"  • Tổng tiền: **{b['total_amount']}**"
                )
            return "\n\n".join(reply_lines)
        return (
            "Dạ để em tra cứu tiến trình đơn đặt phòng tức thì, Quý khách vui lòng:\n\n"
            "1. Nhập **Mã đơn đặt phòng** (ví dụ: `BK-3C2E8F`); HOẶC\n"
            "2. Nhập **Số điện thoại** đặt phòng (ví dụ: `0918889999`); HOẶC\n"
            "3. **Đăng nhập** tài khoản hội viên để em tự động đồng bộ toàn bộ thông tin lưu trú của Quý khách ạ!"
        )

    # -------------------------------------------------------------------------
    # 4. CÂU HỎI NỐI TIẾP VỀ 1 HẠNG PHÒNG CỤ THỂ (MULTI-TURN MEMORY: JACUZZI, DIỆN TÍCH, VIEW...)
    # -------------------------------------------------------------------------
    rooms = hotel_context.get('rooms', [])
    specific_room = resolve_room_from_conversation(message, history, rooms)
    is_detail_followup = any(k in msg for k in [
        'phòng đó', 'phòng này', 'hạng đó', 'hạng này', 'bồn tắm', 'jacuzzi', 'ban công', 'hướng biển', 'view',
        'rộng bao nhiêu', 'diện tích', 'mấy người', 'sức chứa', 'giường gì', 'tiện nghi', 'có gì',
        'that room', 'this room', 'bathtub', 'balcony', 'sea view', 'ocean view', 'how big', 'amenities'
    ])
    if specific_room and (is_detail_followup or specific_room['name'].lower() in msg):
        avail_txt = (
            f"Còn **{specific_room['available_count']} phòng trống**"
            if specific_room['available_count'] > 0
            else "Hiện đã **kín phòng** trong khoảng ngày này"
        )
        date_label = f"từ **{d_info.get('check_in_display')}** đến **{d_info.get('check_out_display')}** ({d_info.get('nights', 1)} đêm)"
        total_est = specific_room['effective_price'] * d_info.get('nights', 1)
        total_est_str = format_currency_multilingual(total_est, lang=lang)

        if lang == 'en':
            return (
                f"Dear Valued Guest, here are the detailed specifications and real-time availability for **{specific_room['name']}**:\n\n"
                f"• **Room Size & Bed**: **{specific_room['size']} m²** | **{specific_room['bed_type']}** (Max **{specific_room['capacity']} adults**)\n"
                f"• **Luxury Amenities**: {specific_room['all_amenities']}\n"
                f"• **Highlights**: {specific_room['description']}\n"
                f"• **Availability ({d_info.get('check_in_display')} ➔ {d_info.get('check_out_display')})**: **{specific_room['available_count']} rooms available**\n"
                f"• **Rate**: **{specific_room['effective_price_multilingual']}** / night *(Total for {d_info.get('nights', 1)} night(s): **{total_est_str}**)*\n\n"
                f"You can click **[Book Now]** on the interactive card below to reserve this room with your dates pre-filled!"
            )
        return (
            f"Dạ em xin gửi Quý khách thông tin chi tiết và lịch trống thực tế của hạng phòng **{specific_room['name']}** ạ:\n\n"
            f"• **Diện tích & Giường**: Rộng **{specific_room['size']} m²** | **{specific_room['bed_type']}** (Tối đa **{specific_room['capacity']} người lớn**)\n"
            f"• **Tiện nghi cao cấp**: {specific_room['all_amenities']}\n"
            f"• **Điểm nhấn không gian**: {specific_room['description']}\n"
            f"• **Tình trạng lịch trống ({date_label})**: {avail_txt}\n"
            f"• **Giá ưu đãi**: **{specific_room['effective_price_multilingual']}** / đêm *(Tạm tính {d_info.get('nights', 1)} đêm: **{total_est_str}**)*\n\n"
            f"Em đã đính kèm **Thẻ đặt phòng nhanh** bên dưới, Quý khách bấm vào nút **[Đặt ngay]** hệ thống sẽ tự động điền sẵn ngày nhận/trả phòng cho Quý khách ạ!"
        )

    # -------------------------------------------------------------------------
    # 5. TRA CỨU PHÒNG TRỐNG THEO NGÀY & BẢNG SO SÁNH GIÁ PHÒNG
    # -------------------------------------------------------------------------
    is_room_query = any(k in msg for k in [
        'phòng', 'giá', 'trống', 'còn phòng', 'hạng phòng', 'loại phòng', 'room', 'đêm', 'bao nhiêu',
        'ngày mai', 'cuối tuần', 'tối nay', 'hôm nay', 'so sánh',
        'rate', 'rates', 'cost', 'available', 'availability', 'suite', 'deluxe', 'tomorrow', 'weekend',
        '객실', '방', '요금', '가격', '예약', '스위트', '디럭스', '내일',
        '房', '客房', '价格', '房价', '预订', '套房', '空房', '明天'
    ])
    if is_room_query and rooms:
        date_header = (
            f"từ **{d_info.get('check_in_display')}** đến **{d_info.get('check_out_display')}** ({d_info.get('nights', 1)} đêm)"
            if d_info.get('is_custom_date')
            else f"hôm nay (**{d_info.get('check_in_display')}** ➔ **{d_info.get('check_out_display')}**)"
        )
        vip_note = ""
        if user_ctx and user_ctx.get('discount_rate') and user_ctx['discount_rate'] != '0%':
            vip_note = f"\n*Đặc quyền Hội viên **{user_ctx['vip_tier']}**: Quý khách được giảm thêm **{user_ctx['discount_rate']}** trực tiếp khi đặt phòng!*\n"

        if lang == 'en':
            lines = [
                f"Dear Valued Guest, I have checked our real-time reservation calendar from **{d_info.get('check_in_display')}** to **{d_info.get('check_out_display')}** ({d_info.get('nights', 1)} night(s)):\n",
                "| Room Category | Size / Capacity | Nightly Rate | Real-Time Status |",
                "| :--- | :--- | :--- | :--- |"
            ]
            for r in rooms:
                avail_cell = f"**{r['available_count']} left**" if r['available_count'] > 0 else "Sold out"
                lines.append(f"| **{r['name']}** | {r['size']}m² • {r['capacity']} Guests | **{r['effective_price_multilingual']}** | {avail_cell} |")
            lines.append(f"\n**Standard Hours**: Check-in **{h_info['check_in']}** | Check-out **{h_info['check_out']}**.")
            lines.append("Select any room card below to view photos or book immediately with your dates pre-filled!")
            return "\n".join(lines)
        elif lang == 'ko':
            lines = [
                f"고객님 안녕하십니까! **{d_info.get('check_in_display')} ~ {d_info.get('check_out_display')} ({d_info.get('nights', 1)}박)** 기준 실시간 잔여 객실 및 요금표입니다:\n",
                "| 객실 등급 | 면적 / 정원 | 1박 요금 (KRW) | 실시간 잔여 객실 |",
                "| :--- | :--- | :--- | :--- |"
            ]
            for r in rooms:
                avail_cell = f"**{r['available_count']}실 가능**" if r['available_count'] > 0 else "마감"
                lines.append(f"| **{r['name']}** | {r['size']}m² • {r['capacity']}인 | **{r['effective_price_multilingual']}** | {avail_cell} |")
            lines.append("\n아래 객실 카드를 클릭하시면 선택한 날짜로 즉시 예약하실 수 있습니다!")
            return "\n".join(lines)
        elif lang == 'zh':
            lines = [
                f"尊敬的贵宾，已为您查询 **{d_info.get('check_in_display')} 至 {d_info.get('check_out_display')}（共{d_info.get('nights', 1)}晚）** 的实时房态与房价对比表：\n",
                "| 客房房型 | 面积 / 人数 | 每晚房价 (CNY) | 实时剩余空房 |",
                "| :--- | :--- | :--- | :--- |"
            ]
            for r in rooms:
                avail_cell = f"**剩 {r['available_count']} 间**" if r['available_count'] > 0 else "已满房"
                lines.append(f"| **{r['name']}** | {r['size']}m² • {r['capacity']}人 | **{r['effective_price_multilingual']}** | {avail_cell} |")
            lines.append("\n点击下方房型卡片即可自动带入入住日期并立即预订！")
            return "\n".join(lines)
        else:
            lines = [
                f"Dạ em đã kiểm tra lịch phòng trống thời gian thực {date_header} tại **{h_info['name']}** và tổng hợp bảng so sánh bên dưới cho Quý khách ạ:\n",
                "| Hạng Phòng | Diện tích & Sức chứa | Giá Ưu Đãi / Đêm | Lịch Trống Thực Tế |",
                "| :--- | :--- | :--- | :--- |"
            ]
            for r in rooms:
                avail_str = f"**Còn {r['available_count']} phòng**" if r['available_count'] > 0 else "Tạm kín lịch"
                lines.append(f"| **{r['name']}** | {r['size']}m² • {r['capacity']} khách ({r['bed_type']}) | **{r['effective_price_multilingual']}** | {avail_str} |")
            if vip_note:
                lines.append(vip_note)
            lines.append(f"\n**Giờ tiêu chuẩn**: Nhận phòng từ **{h_info['check_in']}** | Trả phòng trước **{h_info['check_out']}**.")
            lines.append("Quý khách có thể bấm nút **[Đặt ngay]** trên thẻ phòng bên dưới, hệ thống sẽ tự động điền sẵn ngày nhận/trả phòng cho Quý khách ạ!")
            return "\n".join(lines)

    # -------------------------------------------------------------------------
    # 6. DỊCH VỤ ẨM THỰC, SPA & ĐƯA ĐÓN SÂN BAY
    # -------------------------------------------------------------------------
    is_svc_query = any(k in msg for k in [
        'dịch vụ', 'ăn', 'ẩm thực', 'nhà hàng', 'spa', 'massage', 'xe', 'đưa đón', 'sân bay', 'giặt', 'bar', 'service', 'menu',
        'dining', 'food', 'restaurant', 'shuttle', 'airport',
        '서비스', '식사', '레스토랑', '스파', '마사지', '공항', '픽업', '샌딩', '조식',
        '服务', '餐饮', '餐厅', '水疗', '按摩', '机场', '接送', '早餐'
    ])
    if is_svc_query:
        services = hotel_context.get('services', [])
        lines = [
            f"Dạ **{h_info['name']}** hân hạnh phục vụ Quý khách hệ sinh thái dịch vụ & ẩm thực chuẩn 5 sao quốc tế 24/7 ạ:\n",
            "• **Ẩm thực & In-room Dining (24/7)**: Thực đơn Á - Âu thượng hạng, Hải sản tươi sống biển Mỹ Khê, Bò Wagyu A5 nướng đá.",
            "• **TA Ocean Spa & Wellness (Tầng 3)**: Xông hơi đá muối Himalaya, trị liệu massage thảo dược cung đình.",
            "• **Đội xe VIP Limousine & Mercedes Đưa Đón**: Đón/tiễn Sân bay Quốc tế Đà Nẵng và tham quan Hội An, Bà Nà Hills riêng tư.",
            "• **Giặt ủi & Phục vụ Buồng phòng**: Giặt hấp cao cấp lấy nhanh trong ngày."
        ]
        if services:
            lines.append("\n| Dịch vụ / Món ăn tiêu biểu | Phân loại | Đơn giá niêm yết |")
            lines.append("| :--- | :--- | :--- |")
            for s in services[:6]:
                lines.append(f"| **{s['name']}** | {s['category']} | **{s['price_multilingual']}** |")
        lines.append("\nQuý khách có thể bấm vào **Thẻ Dịch Vụ** bên dưới để đặt món hoặc đặt xe đưa đón ngay lập tức ạ!")
        return "\n".join(lines)

    # -------------------------------------------------------------------------
    # 7. CHÍNH SÁCH CÔNG TY / ĐẶT ĐOÀN M.I.C.E / HÓA ĐƠN VAT
    # -------------------------------------------------------------------------
    if any(k in msg for k in [
        'công ty', 'doanh nghiệp', 'vat', 'hóa đơn', 'đoàn', 'b2b', 'hợp đồng', 'corporate', 'mice', 'thuế',
        'tax', 'company', 'invoice', '단체', '법인', '세금계산서', '企业', '发票', '团队'
    ]):
        c = hotel_context['corporate_policy']
        return (
            f"Dạ về chính sách **Đặt phòng Doanh nghiệp & Đoàn thể (M.I.C.E)** tại **{h_info['name']}**, em xin thông tin chi tiết đến Quý khách:\n\n"
            f"• **Hóa đơn tài chính VAT**: {c['vat_invoice']}\n"
            f"• **Hợp đồng & Chiết khấu B2B**: {c['contracts']}\n"
            f"• **Tổ chức Sự kiện & Hội nghị**: {c['group_services']}\n"
            f"• **Hạn mức Công nợ**: {c['credit_terms']}\n\n"
            f"Quý công ty có thể gửi yêu cầu tại mục **'Đặt Đoàn & Doanh nghiệp'** trên thanh menu hoặc liên hệ Hotline Phòng Kinh Doanh **{h_info['hotline']}** để nhận báo giá trong 15 phút ạ!"
        )

    # -------------------------------------------------------------------------
    # 8. KHUYẾN MÃI / VOUCHER / HẠNG THẺ THÀNH VIÊN VIP
    # -------------------------------------------------------------------------
    if any(k in msg for k in [
        'khuyến mãi', 'voucher', 'ưu đãi', 'giảm giá', 'coupon', 'promo', 'vip', 'thành viên', 'silver', 'gold', 'platinum',
        'discount', 'deal', 'membership', '할인', '프로모션', '优惠', '折扣'
    ]):
        lines = [
            f"Dạ **{h_info['name']}** đang áp dụng chương trình đặc quyền **TA Club Membership** và các mã Voucher giảm giá trực tiếp:\n",
            "### Đặc quyền Hạng thẻ Hội viên TA Club",
            "• **Hạng Bạc (Silver)**: Giảm ngay **5%** tổng tiền phòng.",
            "• **Hạng Vàng (Gold)**: Giảm ngay **10%** + Ưu tiên nâng hạng phòng miễn phí.",
            "• **Hạng Bạch Kim (Platinum VIP)**: Giảm ngay **15%** + Trả phòng muộn đến 15:00 & Miễn phí xe Limousine đón sân bay."
        ]
        promos = hotel_context.get('promotions', [])
        if promos:
            lines.append("\n### Mã Voucher Khuyến Mãi & Ưu Đãi Đang Hoạt Động")
            lines.append("| Mã Voucher | Chương trình Ưu đãi | Mức Giảm | Đơn tối thiểu |")
            lines.append("| :--- | :--- | :--- | :--- |")
            for p in promos:
                lines.append(f"| **`{p['code']}`** | {p['name']} | **{p['discount']}** | {p['min_order']} |")
        lines.append("\nQuý khách chỉ cần chọn mã giảm giá tại trang **Thanh toán (Checkout)** để được khấu trừ tự động ạ!")
        return "\n".join(lines)

    # -------------------------------------------------------------------------
    # 9. ĐỊA CHỈ / LIÊN HỆ / THANH TOÁN VIETQR
    # -------------------------------------------------------------------------
    if any(k in msg for k in [
        'địa chỉ', 'ở đâu', 'vị trí', 'hotline', 'liên hệ', 'sđt', 'số điện thoại', 'email', 'map',
        'thanh toán', 'chuyển khoản', 'qr', 'vietqr', 'sepay', 'cọc'
    ]):
        return (
            f"Dạ em xin gửi Quý khách thông tin liên hệ và phương thức thanh toán tự động tại **{h_info['name']}** ạ:\n\n"
            f"• **Vị trí đắc địa**: {h_info['address']} *(Đối diện bãi biển Mỹ Khê, cách Sân bay Đà Nẵng 10 phút và Cầu Rồng 5 phút di chuyển)*.\n"
            f"• **Hotline Lễ tân & Concierge 24/7**: **{h_info['hotline']}** | Điện thoại: **{h_info['phone']}**\n"
            f"• **Email CSKH**: {h_info['email']}\n"
            f"• **Thanh toán tự động 24/7**: Hỗ trợ quét mã **VietQR động (cổng Sepay)** tự động xác nhận đơn trong 3 giây, thẻ quốc tế Visa/Mastercard/JCB hoặc thanh toán tại quầy Lễ tân ạ!"
        )

    # -------------------------------------------------------------------------
    # 10. LỜI CHÀO MẶC ĐỊNH CÁ NHÂN HÓA CHUẨN 5 SAO
    # -------------------------------------------------------------------------
    greeting_name = f"Quý khách **{user_ctx['full_name']}** ({user_ctx['vip_tier']})" if user_ctx else "Quý khách"
    inhouse_banner = ""
    if active_stay and active_stay.get('is_checked_in'):
        inhouse_banner = (
            f"\n*Hệ thống ghi nhận Quý khách đang lưu trú tại **Phòng P.{active_stay['room_number']}** (Mã đơn `#{active_stay['booking_code']}`). "
            f"Quý khách có thể hỏi em về **Hóa đơn tạm tính**, **Tiến trình đồ ăn**, **Mật khẩu Wifi** hoặc nhắn **'Dọn phòng giúp tôi'** bất cứ lúc nào ạ!*\n"
        )

    if lang == 'en':
        return (
            f"Dear Valued Guest! Welcome to the 5-Star AI Concierge of **{h_info['name']}**.\n\n"
            f"I am at your service 24/7 to assist with:\n"
            f"• **Date-Specific Room Availability & Rates (with USD conversion)**\n"
            f"• **24/7 In-Room Dining, Ocean Spa & Private Airport Limousine**\n"
            f"• **Da Nang – Hoi An Sightseeing Itinerary & Dragon Bridge Show**\n"
            f"• **In-House Guest Services: Live Folio Bill, Wi-Fi & Instant Housekeeping**\n\n"
            f"How may I assist your luxury stay in Da Nang today?"
        )
    return (
        f"Dạ em kính chào {greeting_name}! Em là Trợ lý ảo AI Concierge 5 sao của **{h_info['name']}** ạ.{inhouse_banner}\n"
        f"Em luôn sẵn sàng hỗ trợ Quý khách 24/7 về mọi nghiệp vụ:\n"
        f"• **Kiểm tra lịch phòng trống theo ngày thực tế & Bảng so sánh giá**\n"
        f"• **Thực đơn Ẩm thực tại phòng, Ocean Spa & Đặt xe Limousine đón sân bay**\n"
        f"• **Tư vấn lịch trình Du lịch Đà Nẵng – Hội An – Bà Nà Hills**\n"
        f"• **Trợ lý lưu trú: Xem hóa đơn tạm tính, mật khẩu Wifi, gọi dọn phòng 1 chạm**\n\n"
        f"Quý khách đang cần em kiểm tra phòng cho ngày nào hay hỗ trợ dịch vụ gì, hãy nhắn cho em ngay nhé ạ!"
    )


DEFAULT_ROOM_IMAGES = [
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=600&q=80'
]

DEFAULT_SERVICE_IMAGES = [
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80'
]


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


class ChatbotAskView(APIView):
    """
    API POST /api/chatbot/ask/
    - Nhận message và history từ khách hàng.
    - Bóc tách ngày nhận/trả phòng từ câu hỏi tự nhiên để kiểm tra lịch trống thực tế (Date-Aware Availability).
    - Hỗ trợ đầy đủ nghiệp vụ In-House Concierge cho khách đang lưu trú (CHECKED_IN).
    - Gọi Google Gemini REST API với timeout tối ưu (6s) và tự động chuyển sang Smart Fallback đa ngôn ngữ khi lỗi.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        message = request.data.get('message', '').strip()
        history = request.data.get('history', [])

        if not message:
            return Response(
                {'error': 'Vui lòng cung cấp nội dung tin nhắn (message).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 0. Tự động nhận diện ngôn ngữ và trích xuất khoảng ngày khách quan tâm
        detected_lang = detect_language(message)
        date_info = extract_dates_from_conversation(message, history=history)

        # 1. Thu thập ngữ cảnh Database thời gian thực theo đúng ngày khách hỏi
        hotel_context = build_hotel_context(request, date_info=date_info, lang=detected_lang)
        housekeeping_action = handle_inhouse_housekeeping_request(message, request, hotel_context)
        system_prompt = generate_system_prompt(hotel_context, housekeeping_action=housekeeping_action)
        suggested_rooms, suggested_services = extract_suggestions(message, hotel_context, lang=detected_lang, history=history)
        tracked_bookings = extract_booking_tracker(message, request, hotel_context, lang=detected_lang)

        active_stay_summary = None
        if hotel_context.get('user_context') and hotel_context['user_context'].get('active_stay'):
            st = hotel_context['user_context']['active_stay']
            active_stay_summary = {
                'booking_code': st['booking_code'],
                'room_number': st['room_number'],
                'category_name': st['category_name'],
                'is_checked_in': st['is_checked_in'],
                'grand_total_formatted': st['grand_total_formatted']
            }

        # Nếu tìm thấy đơn đặt phòng tra cứu, bổ sung vào system prompt cho AI
        if tracked_bookings:
            bk = tracked_bookings[0]
            system_prompt += (
                f"\n\n[DỮ LIỆU ĐƠN ĐẶT PHÒNG KHÁCH VỪA TRA CỨU]:\n"
                f"- Mã đơn: #{bk['booking_code']} | Khách hàng: {bk['guest_name']} (SĐT: {bk['guest_phone']})\n"
                f"- Phòng: {bk['room_name']} | Lưu trú: {bk['check_in_date']} đến {bk['check_out_date']}\n"
                f"- Tổng tiền phòng: {bk['total_amount']} | Trạng thái: {bk['status_label']} (Bước {bk['step_index']}/4)\n"
                f"Hãy phản hồi đầy đủ thông tin này một cách ân cần, sang trọng chuẩn 5 sao."
            )

        # 2. Kiểm tra Gemini API Key
        gemini_api_key = getattr(settings, 'GEMINI_API_KEY', '') or os.getenv('GEMINI_API_KEY', '')
        gemini_api_key = gemini_api_key.strip()

        is_key_valid = (
            gemini_api_key and
            'your_gemini_api_key' not in gemini_api_key.lower() and
            'your_api_key' not in gemini_api_key.lower()
        )

        if not is_key_valid:
            fallback_reply = local_smart_fallback(
                message, request.user, hotel_context,
                tracked_bookings=tracked_bookings, lang=detected_lang,
                history=history, housekeeping_action=housekeeping_action
            )
            return Response({
                'success': True,
                'reply': fallback_reply,
                'source': 'local_smart_fallback',
                'detected_lang': detected_lang,
                'queried_dates': {
                    'check_in': date_info['check_in_str'],
                    'check_out': date_info['check_out_str'],
                    'check_in_display': date_info['check_in_display'],
                    'check_out_display': date_info['check_out_display'],
                    'nights': date_info['nights'],
                    'is_custom_date': date_info['is_custom_date']
                },
                'active_stay': active_stay_summary,
                'housekeeping_triggered': bool(housekeeping_action),
                'suggested_rooms': suggested_rooms,
                'suggested_services': suggested_services,
                'tracked_bookings': tracked_bookings
            })

        # 3. Chuẩn bị nội dung gửi Gemini REST API (nhớ tối đa 8 tin nhắn gần nhất)
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_api_key}"

        contents = []
        if isinstance(history, list):
            for item in history[-8:]:
                if not isinstance(item, dict):
                    continue
                role = item.get('role', 'user')
                gemini_role = 'model' if role in ['model', 'assistant', 'bot'] else 'user'
                text_content = item.get('text', '') or item.get('content', '') or ''
                if text_content.strip():
                    contents.append({
                        'role': gemini_role,
                        'parts': [{'text': text_content.strip()}]
                    })

        contents.append({
            'role': 'user',
            'parts': [{'text': message}]
        })

        payload = {
            'system_instruction': {
                'parts': [{'text': system_prompt}]
            },
            'contents': contents,
            'generationConfig': {
                'temperature': 0.65,
                'maxOutputTokens': 1100
            }
        }

        try:
            headers = {'Content-Type': 'application/json'}
            response = requests.post(
                gemini_url,
                json=payload,
                headers=headers,
                timeout=6
            )

            if response.status_code == 200:
                res_data = response.json()
                candidates = res_data.get('candidates', [])
                if candidates and 'content' in candidates[0]:
                    parts = candidates[0]['content'].get('parts', [])
                    if parts and 'text' in parts[0]:
                        reply_text = parts[0]['text'].strip()
                        return Response({
                            'success': True,
                            'reply': reply_text,
                            'source': 'gemini_ai',
                            'detected_lang': detected_lang,
                            'queried_dates': {
                                'check_in': date_info['check_in_str'],
                                'check_out': date_info['check_out_str'],
                                'check_in_display': date_info['check_in_display'],
                                'check_out_display': date_info['check_out_display'],
                                'nights': date_info['nights'],
                                'is_custom_date': date_info['is_custom_date']
                            },
                            'active_stay': active_stay_summary,
                            'housekeeping_triggered': bool(housekeeping_action),
                            'suggested_rooms': suggested_rooms,
                            'suggested_services': suggested_services,
                            'tracked_bookings': tracked_bookings
                        })

            logger.warning(f"Gemini API phản hồi mã lỗi {response.status_code}: {response.text[:200]}")
            if response.status_code in [404, 400]:
                alt_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_api_key}"
                alt_resp = requests.post(alt_url, json=payload, headers=headers, timeout=5)
                if alt_resp.status_code == 200:
                    alt_data = alt_resp.json()
                    alt_cand = alt_data.get('candidates', [])
                    if alt_cand and 'content' in alt_cand[0]:
                        alt_parts = alt_cand[0]['content'].get('parts', [])
                        if alt_parts and 'text' in alt_parts[0]:
                            return Response({
                                'success': True,
                                'reply': alt_parts[0]['text'].strip(),
                                'source': 'gemini_ai_fallback_model',
                                'detected_lang': detected_lang,
                                'queried_dates': {
                                    'check_in': date_info['check_in_str'],
                                    'check_out': date_info['check_out_str'],
                                    'check_in_display': date_info['check_in_display'],
                                    'check_out_display': date_info['check_out_display'],
                                    'nights': date_info['nights'],
                                    'is_custom_date': date_info['is_custom_date']
                                },
                                'active_stay': active_stay_summary,
                                'housekeeping_triggered': bool(housekeeping_action),
                                'suggested_rooms': suggested_rooms,
                                'suggested_services': suggested_services,
                                'tracked_bookings': tracked_bookings
                            })

        except Exception as ex:
            logger.error(f"Lỗi kết nối Gemini API: {ex}")

        # 4. Khi gặp sự cố, tự động kích hoạt Local Smart Fallback (có Multi-turn Memory)
        fallback_reply = local_smart_fallback(
            message, request.user, hotel_context,
            tracked_bookings=tracked_bookings, lang=detected_lang,
            history=history, housekeeping_action=housekeeping_action
        )
        return Response({
            'success': True,
            'reply': fallback_reply,
            'source': 'local_smart_fallback',
            'detected_lang': detected_lang,
            'queried_dates': {
                'check_in': date_info['check_in_str'],
                'check_out': date_info['check_out_str'],
                'check_in_display': date_info['check_in_display'],
                'check_out_display': date_info['check_out_display'],
                'nights': date_info['nights'],
                'is_custom_date': date_info['is_custom_date']
            },
            'active_stay': active_stay_summary,
            'housekeeping_triggered': bool(housekeeping_action),
            'suggested_rooms': suggested_rooms,
            'suggested_services': suggested_services,
            'tracked_bookings': tracked_bookings
        })
