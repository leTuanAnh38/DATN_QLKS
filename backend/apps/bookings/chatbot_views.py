import os
import re
import json
import logging
import requests
from django.conf import settings
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

from .models import Booking, Promotion, HotelSetting
from ..rooms.models import Room, RoomCategory
from ..services.models import ServiceItem
from ..users.models import User

logger = logging.getLogger(__name__)


def format_currency(amount):
    """Định dạng số tiền sang chuẩn VNĐ (VD: 1.800.000 đ)"""
    try:
        val = int(amount)
        return f"{val:,.0f} đ".replace(",", ".")
    except (ValueError, TypeError):
        return f"{amount} đ"


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
        'track', 'status', 'my booking', 'reservation status', 'cancel', 'refund'
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


def build_hotel_context(request):
    """
    Thu thập ngữ cảnh Database thời gian thực để cấp dữ liệu thực tế cho AI Prompt và Fallback:
    1. Thông tin chung khách sạn (Hotline, địa chỉ, giờ nhận/trả phòng từ HotelSetting)
    2. Danh sách hạng phòng & đếm số phòng trống AVAILABLE
    3. Danh sách dịch vụ & ẩm thực đang hoạt động kèm giá
    4. Chính sách cá nhân, doanh nghiệp B2B (VAT), thanh toán VietQR
    5. Ngữ cảnh cá nhân hóa (nếu khách hàng đã đăng nhập)
    """
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
            'service_charge': '5%'
        },
        'rooms': [],
        'services': [],
        'promotions': [],
        'membership_tiers': [
            {'tier': 'Bạc (Silver)', 'discount': '5%', 'benefit': 'Tích điểm nâng hạng, ưu đãi giá phòng'},
            {'tier': 'Vàng (Gold)', 'discount': '10%', 'benefit': 'Miễn phí nâng hạng phòng (khi còn phòng), ưu tiên nhận phòng'},
            {'tier': 'Bạch Kim (Platinum)', 'discount': '15%', 'benefit': 'Trả phòng muộn đến 15:00, miễn phí xe đón sân bay, phòng chờ VIP'}
        ],
        'corporate_policy': {
            'vat_invoice': 'Hỗ trợ xuất hóa đơn tài chính VAT (8%) nhanh chóng về email doanh nghiệp.',
            'contracts': 'Hỗ trợ hợp đồng B2B với chiết khấu doanh nghiệp từ 10% - 20%.',
            'group_services': 'Tiếp nhận khai báo danh sách đoàn, tổ chức sự kiện hội nghị M.I.C.E & Team Building.',
            'credit_terms': 'Hỗ trợ công nợ thanh toán sau 15 đến 30 ngày cho đối tác doanh nghiệp ký hợp đồng.'
        },
        'payment_methods': 'Hỗ trợ quét mã VietQR tự động gạch nợ tức thì 24/7 (kết nối trực tiếp Sepay), thẻ tín dụng Visa/Mastercard/JCB, thẻ ATM nội địa, hoặc thanh toán trực tiếp tại quầy lễ tân.',
        'user_context': None
    }

    # 1. Lấy thông tin từ HotelSetting
    try:
        setting = HotelSetting.get_settings()
        if setting:
            stars = getattr(setting, 'stars', 3) or 3
            slogan = setting.hotel_slogan or f"{stars}-Star Hotel & Resort"
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

    # 2. Danh sách Hạng phòng & Đếm số phòng trống thực tế
    try:
        categories = RoomCategory.objects.all().prefetch_related('rooms', 'amenities', 'images')
        for cat in categories:
            available_rooms = cat.rooms.filter(status='available').count()
            total_rooms = cat.rooms.count()
            amenities_list = [a.name for a in cat.amenities.all()[:4]]
            
            feat_img = cat.images.filter(is_feature=True).first() or cat.images.first()
            img_url = feat_img.image.url if (feat_img and feat_img.image) else ''
            if img_url and request:
                img_url = request.build_absolute_uri(img_url)

            context_data['rooms'].append({
                'id': cat.id,
                'name': cat.name,
                'slug': cat.slug,
                'base_price': int(cat.base_price),
                'base_price_formatted': format_currency(cat.base_price),
                'promo_price': int(cat.promo_price) if cat.promo_price else None,
                'promo_price_formatted': format_currency(cat.promo_price) if cat.promo_price else None,
                'capacity': cat.capacity,
                'bed_type': cat.bed_type,
                'size': cat.size,
                'available_count': available_rooms,
                'total_count': total_rooms,
                'image_url': img_url,
                'amenities': ", ".join(amenities_list) if amenities_list else "Đầy đủ tiện nghi cao cấp"
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

    # 5. Ngữ cảnh Cá nhân hóa (Nếu khách đã đăng nhập)
    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        try:
            # Hạng VIP và điểm
            vip_tier = "Đồng (Bronze)"
            if hasattr(user, 'current_tier') and user.current_tier:
                vip_tier = user.current_tier.name
            elif hasattr(user, 'guest_profile') and user.guest_profile:
                vip_tier = user.guest_profile.vip_tier or vip_tier

            points = getattr(user, 'total_points', 0)
            if hasattr(user, 'guest_profile') and user.guest_profile:
                points = max(points, getattr(user.guest_profile, 'loyalty_points', 0))

            full_name = user.get_full_name() or user.username
            user_data = {
                'username': user.username,
                'full_name': full_name,
                'phone': getattr(user, 'phone_number', '') or '',
                'vip_tier': vip_tier,
                'loyalty_points': points,
                'recent_bookings': []
            }

            # 3 đơn đặt phòng gần nhất
            recent_bks = Booking.objects.filter(guest=user).order_by('-created_at')[:3]
            status_map = {
                'pending': 'Chờ duyệt / Chờ thanh toán',
                'confirmed': 'Đã xác nhận',
                'paid': 'Đã thanh toán',
                'PAID': 'Đã thanh toán',
                'checked_in': 'Đang lưu trú (Checked-in)',
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
                    'code': bk.booking_code,
                    'room': room_str,
                    'check_in': str(bk.check_in_date),
                    'check_out': str(bk.check_out_date),
                    'status': status_map.get(bk.status, bk.status),
                    'status_raw': bk.status,
                    'total_amount': format_currency(bk.total_amount),
                    'is_paid': "Đã thanh toán" if is_paid else "Chưa thanh toán (Chờ cọc/TT)"
                })

            context_data['user_context'] = user_data
        except Exception as e:
            logger.warning(f"Lỗi khi nạp user context: {e}")

    return context_data


def generate_system_prompt(hotel_context):
    """
    Sinh System Prompt chuẩn mực cho AI Gemini:
    Đóng vai Trợ lý ảo lễ tân 5 sao của Khách sạn TA Đà Nẵng,
    Xưng 'Em' - gọi 'Quý khách', phong cách lịch sự, nhã nhặn, sang trọng,
    chỉ căn cứ vào số liệu có thật từ hệ thống khách sạn.
    """
    h_info = hotel_context['hotel_info']
    
    # Chuỗi phòng
    room_lines = []
    for r in hotel_context['rooms']:
        price_text = f"Giá gốc: {r['base_price_formatted']}"
        if r.get('promo_price_formatted'):
            price_text += f" (Giá ưu đãi: {r['promo_price_formatted']})"
        avail = f"Hiện còn {r['available_count']} phòng trống" if r['available_count'] > 0 else "Tạm hết phòng trực tuyến"
        room_lines.append(f"- {r['name']}: {price_text} | Sức chứa: {r['capacity']} khách | Giường: {r['bed_type']} | {avail}")
    rooms_text = "\n".join(room_lines) if room_lines else "Tất cả các hạng phòng đang được phục vụ."

    # Chuỗi dịch vụ
    svc_lines = []
    for s in hotel_context['services'][:15]:  # Lấy 15 dịch vụ tiêu biểu
        svc_lines.append(f"- [{s['category']}] {s['name']}: {s['price_formatted']} ({s['description']})")
    services_text = "\n".join(svc_lines) if svc_lines else "Phục vụ 24/7 ẩm thực, spa, xe đưa đón."

    # Chuỗi khuyến mãi
    promo_lines = []
    for p in hotel_context['promotions']:
        promo_lines.append(f"- Mã {p['code']} ({p['name']}): Giảm {p['discount']} (Đơn tối thiểu: {p['min_order']})")
    promos_text = "\n".join(promo_lines) if promo_lines else "Hiện tại có ưu đãi thẻ thành viên Silver 5%, Gold 10%, Platinum 15%."

    # Chuỗi cá nhân hóa
    user_str = "Khách hàng hiện tại: Khách vãng lai (Chưa đăng nhập)."
    if hotel_context.get('user_context'):
        u = hotel_context['user_context']
        bks_str = ""
        for b in u['recent_bookings']:
            bks_str += f"\n  + Mã đơn: {b['code']} | Phòng: {b['room']} | Nhận: {b['check_in']} - Trả: {b['check_out']} | Trạng thái: {b['status']} | Tổng tiền: {b['total_amount']} ({b['is_paid']})"
        user_str = (
            f"Thông tin Khách hàng đang trò chuyện:\n"
            f"- Họ tên: {u['full_name']} (Tài khoản: {u['username']})\n"
            f"- Hạng thẻ hội viên: {u['vip_tier']} | Điểm tích lũy: {u['loyalty_points']} điểm\n"
            f"- Đơn đặt phòng gần nhất của khách:{bks_str if bks_str else ' Chưa có đơn đặt phòng nào gần đây.'}"
        )

    system_prompt = f"""Bạn là Trợ lý ảo AI Concierge cao cấp của {h_info['name']}.
NGUYÊN TẮC GIAO TIẾP VÀ XƯNG HÔ:
1. Luôn xưng "Em" và gọi người dùng là "Quý khách" (khi nói Tiếng Việt).
2. Giọng điệu chuyên nghiệp, cực kỳ lịch thiệp, chu đáo, tinh tế chuẩn khách sạn nghỉ dưỡng {h_info.get('stars', 3)} sao quốc tế ({h_info.get('stars', 3)}-Star Luxury Resort).
3. Câu trả lời ngắn gọn, rõ ràng, định dạng đẹp mắt (sử dụng in đậm, gạch đầu dòng, icon lịch sự).
4. TUYỆT ĐỐI CHỈ cung cấp dữ liệu thực tế dựa trên thông tin hệ thống được cung cấp dưới đây, không bịa đặt số liệu hay giá phòng.

QUY TẮC ĐA NGÔN NGỮ TỰ ĐỘNG (AUTOMATIC MULTILINGUAL CONCIERGE):
- Đà Nẵng đón lượng lớn khách quốc tế (Đặc biệt là Hàn Quốc, Trung Quốc, Âu Mỹ / Khách nói Tiếng Anh).
- TỰ ĐỘNG nhận diện ngôn ngữ của câu hỏi và trả lời bằng CHÍNH NGÔN NGỮ ĐÓ:
  + Nếu khách hỏi bằng Tiếng Anh (English): Trả lời bằng Tiếng Anh sang trọng, chuẩn {h_info.get('stars', 3)} sao ("Dear Valued Guest", "Warmest greetings from TA Da Nang Hotel").
  + Nếu khách hỏi bằng Tiếng Hàn (한국어): Trả lời bằng Tiếng Hàn kính ngữ 존댓말 ("안녕하십니까, 고객님", "TA 다낭 {h_info.get('stars', 3)}성급 호텔에 오신 것을 진심으로 환영합니다").
  + Nếu khách hỏi bằng Tiếng Trung (中文): Trả lời bằng Tiếng Trung nhã nhặn, tôn trọng ("尊敬的贵宾，您好", "欢迎来到TA岘港{h_info.get('stars', 3)}星级度假酒店").
  + Nếu khách hỏi bằng Tiếng Việt: Trả lời bằng Tiếng Việt ấm áp, hiếu khách.
- QUY ĐỔI GIÁ TIỀN CHO KHÁCH QUỐC TẾ (CURRENCY CONVERSION):
  Khi đề cập đến giá phòng hoặc dịch vụ cho khách quốc tế (Anh/Hàn/Trung), hãy luôn hiển thị song song giá gốc VND và giá quy đổi tương đương:
  + Tiếng Anh (English): VND (~$XX USD) [Tỷ giá: 1 USD ≈ 25.400 VND]
  + Tiếng Hàn (한국어): VND (~₩XX,XXX KRW) [Tỷ giá: 1 KRW ≈ 18.5 VND]
  + Tiếng Trung (中文): VND (~¥XX CNY hoặc ~$XX USD) [Tỷ giá: 1 CNY ≈ 3.500 VND]
- Giữ nguyên các thuật ngữ thương hiệu và địa danh: TA Da Nang Hotel, My Khe Beach, Ba Na Hills, VietQR.

THÔNG TIN KHÁCH SẠN HIỆN TẠI:
- Tên khách sạn: {h_info['name']}
- Địa chỉ: {h_info['address']}
- Hotline lễ tân 24/7: {h_info['hotline']} | Email: {h_info['email']} | Website: {h_info['website']}
- Quy định nhận / trả phòng: Check-in từ {h_info['check_in']}, Check-out trước {h_info['check_out']}.
- Thuế & Phí: Thuế VAT {h_info['vat']}, Phí dịch vụ {h_info['service_charge']}.

DANH SÁCH HẠNG PHÒNG & TÌNH TRẠNG PHÒNG TRỐNG:
{rooms_text}

DANH MỤC DỊCH VỤ & ẨM THỰC TIÊU BIỂU:
{services_text}

CHƯƠNG TRÌNH KHUYẾN MÃI & THÀNH VIÊN:
{promos_text}
- Hạng Bạc (Silver): Giảm 5% giá phòng.
- Hạng Vàng (Gold): Giảm 10% giá phòng + Miễn phí nâng hạng phòng (tùy phòng trống).
- Hạng Bạch Kim (Platinum): Giảm 15% giá phòng + Trả phòng muộn đến 15:00 & Miễn phí đón sân bay.

CHÍNH SÁCH DOANH NGHIỆP & ĐẶT ĐOÀN B2B:
- {hotel_context['corporate_policy']['vat_invoice']}
- {hotel_context['corporate_policy']['contracts']}
- {hotel_context['corporate_policy']['group_services']}
- {hotel_context['corporate_policy']['credit_terms']}

PHƯƠNG THỨC THANH TOÁN:
- {hotel_context['payment_methods']}

{user_str}

Khi Quý khách hỏi về đơn đặt phòng của mình, hãy tra cứu ngay thông tin đơn của Quý khách ở trên để trả lời đầy đủ và thân thiện nhất!
"""
    return system_prompt


def local_smart_fallback(message, user, hotel_context, tracked_bookings=None, lang='vi'):
    """
    CƠ CHẾ FALLBACK THÔNG MINH ĐA NGÔN NGỮ (Offline / No Key / Network Error):
    Tự động phân tích từ khóa câu hỏi và phản hồi bằng Tiếng Việt, Tiếng Anh, Tiếng Hàn hoặc Tiếng Trung
    kèm quy đổi tỷ giá tương đương USD / KRW / CNY chuẩn 5 sao.
    """
    msg = message.strip().lower()
    h_info = hotel_context['hotel_info']
    user_ctx = hotel_context.get('user_context')

    # 1. Đã tìm thấy đơn đặt phòng từ mã hoặc SĐT (Booking Lookup)
    if tracked_bookings and len(tracked_bookings) > 0:
        bk = tracked_bookings[0]
        if lang == 'en':
            return (
                f"Dear Valued Guest, I have retrieved your reservation **#{bk['booking_code']}** from our system:\n\n"
                f"• 👤 **Guest Name**: {bk['guest_name']}\n"
                f"• 🏨 **Room**: {bk['room_name']}\n"
                f"• 📅 **Stay Period**: Check-in **{bk['check_in_date']}** ➔ Check-out **{bk['check_out_date']}**\n"
                f"• 💰 **Total Price**: **{bk['total_amount']}**\n"
                f"• 📌 **Current Status**: **{bk['status_label']}**\n\n"
                f"I have displayed the **Real-Time Booking Progress Tracker** right below. If you need airport transfer or early check-in, please contact our 24/7 Concierge Hotline at **{h_info['hotline']}**!"
            )
        elif lang == 'ko':
            return (
                f"고객님 안녕하십니까! 시스템에서 고객님의 예약 내역 **#{bk['booking_code']}**을(를) 확인하였습니다:\n\n"
                f"• 👤 **투숙객 성함**: {bk['guest_name']}\n"
                f"• 🏨 **배정 객실**: {bk['room_name']}\n"
                f"• 📅 **투숙 기간**: 체크인 **{bk['check_in_date']}** ➔ 체크아웃 **{bk['check_out_date']}**\n"
                f"• 💰 **총 결제 금액**: **{bk['total_amount']}**\n"
                f"• 📌 **현재 진행 상태**: **{bk['status_label']}**\n\n"
                f"아래에 **실시간 예약 진행 카드**를 준비해 두었습니다. 공항 픽업이나 특별 요청 사항은 24시간 핫라인 **{h_info['hotline']}**으로 언제든 편하게 문의해 주시기 바랍니다."
            )
        elif lang == 'zh':
            return (
                f"尊敬的贵宾，您好！已为您在系统中查询到预订信息 **#{bk['booking_code']}**：\n\n"
                f"• 👤 **入住宾客**: {bk['guest_name']}\n"
                f"• 🏨 **预订房型**: {bk['room_name']}\n"
                f"• 📅 **入住时间**: 入住 **{bk['check_in_date']}** ➔ 退房 **{bk['check_out_date']}**\n"
                f"• 💰 **总计金额**: **{bk['total_amount']}**\n"
                f"• 📌 **当前状态**: **{bk['status_label']}**\n\n"
                f"下方已为您展示**实时预订进度卡片**。如需机场豪华专车接送或任何特殊安排，欢迎随时致电前台热线 **{h_info['hotline']}**！"
            )
        else:
            return (
                f"Dạ em đã kiểm tra và tìm thấy thông tin đơn đặt phòng **#{bk['booking_code']}** trên hệ thống ạ:\n\n"
                f"• 👤 **Khách lưu trú**: {bk['guest_name']}\n"
                f"• 🏨 **Hạng phòng**: {bk['room_name']}\n"
                f"• 📅 **Thời gian**: Nhận phòng **{bk['check_in_date']}** ➔ Trả phòng **{bk['check_out_date']}**\n"
                f"• 💰 **Tổng tiền thanh toán**: **{bk['total_amount']}**\n"
                f"• 📌 **Tiến trình hiện tại**: **{bk['status_label']}**\n\n"
                f"Em đã hiển thị **Thẻ tiến trình đơn hàng trực quan** ngay bên dưới để Quý khách tiện theo dõi. "
                f"Nếu Quý khách cần hỗ trợ thêm về dịch vụ đưa đón sân bay hoặc yêu cầu đặc biệt, vui lòng liên hệ Hotline **{h_info['hotline']}** nhé ạ!"
            )

    # Hỏi về đơn đặt phòng nhưng chưa có mã
    is_booking_query = any(k in msg for k in [
        'đơn', 'đặt phòng của tôi', 'booking', 'kiểm tra đơn', 'tra cứu đơn', 'mã đơn', 'trạng thái đơn',
        'reservation', 'my booking', 'check booking', 'track', 'status',
        '예약', '조회', '내역', '예약번호',
        '预订', '查询', '订单', '预订号'
    ])
    if is_booking_query:
        if lang == 'en':
            return (
                "Dear Valued Guest, to look up your booking progress immediately, please:\n\n"
                "1. 📝 Provide your **Booking Code** (e.g., `BK-3C2E8F` or `BK-DADD55`); OR\n"
                "2. 📱 Provide your **Phone Number** used during reservation (e.g., `0918889999`); OR\n"
                "3. **Sign In** to your account to automatically synchronize all your stays!"
            )
        elif lang == 'ko':
            return (
                "고객님, 실시간 예약 진행 상태를 조회하시려면 아래 방법 중 하나를 이용해 주세요:\n\n"
                "1. 📝 **예약 번호**를 입력해 주세요 (예: `BK-3C2E8F` 또는 `BK-DADD55`); 또는\n"
                "2. 📱 예약 시 등록하신 **전화번호**를 입력해 주세요 (예: `0918889999`); 또는\n"
                "3. TA Club 회원 계정으로 **로그인**하시면 모든 예약 내역이 자동으로 동기화됩니다!"
            )
        elif lang == 'zh':
            return (
                "尊敬的贵宾，如需实时查询您的预订进度，请选择以下方式之一：\n\n"
                "1. 📝 输入您的**预订编号**（例如：`BK-3C2E8F` 或 `BK-DADD55`）；或者\n"
                "2. 📱 输入预订时填写的**手机号码**（例如：`0918889999`）；或者\n"
                "3. **登录**您的TA Club会员账户，系统将自动同步您的所有订单！"
            )
        else:
            if user_ctx and user_ctx.get('recent_bookings'):
                reply_lines = [
                    f"Dạ em kính chào Quý khách **{user_ctx['full_name']}**! Em xin phép gửi thông tin các đơn đặt phòng gần đây của Quý khách tại {h_info['name']}:\n"
                ]
                for b in user_ctx['recent_bookings']:
                    reply_lines.append(
                        f"📌 **Mã đơn: {b['code']}**\n"
                        f"  • Phòng: **{b['room']}**\n"
                        f"  • Lưu trú: **{b['check_in']}** ➔ **{b['check_out']}**\n"
                        f"  • Trạng thái: **{b['status']}** ({b['is_paid']})\n"
                        f"  • Tổng thanh toán: **{b['total_amount']}**\n"
                    )
                reply_lines.append(f"Quý khách có thể xem chi tiết hóa đơn tại mục **Lịch sử đặt phòng** trên tài khoản hoặc liên hệ lễ tân Hotline **{h_info['hotline']}** khi cần hỗ trợ nhé ạ!")
                return "\n".join(reply_lines)
            elif user_ctx:
                return (
                    f"Dạ em chào Quý khách **{user_ctx['full_name']}** (Hạng thẻ {user_ctx['vip_tier']}) ạ!\n\n"
                    f"Hiện tại em chưa ghi nhận đơn đặt phòng nào đang hoạt động trên tài khoản của Quý khách. "
                    f"Quý khách có thể bấm vào mục **'Phòng & Suites'** để lựa chọn không gian nghỉ dưỡng tuyệt hảo với ưu đãi hội viên giảm giá trực tiếp nhé ạ!"
                )
            else:
                return (
                    "Dạ để em hỗ trợ tra cứu tiến trình đơn đặt phòng tức thì cho Quý khách, Quý khách vui lòng:\n\n"
                    "1. 📝 Nhập **Mã đơn đặt phòng** (ví dụ: `BK-3C2E8F` hoặc `BK-DADD55`); HOẶC\n"
                    "2. 📱 Nhập **Số điện thoại** Quý khách đã dùng khi đặt phòng (ví dụ: `0918889999`); HOẶC\n"
                    "3. **Đăng nhập** tài khoản hội viên để em tự động đồng bộ đơn của Quý khách nhé ạ!"
                )

    # 2. Phòng trống & Giá phòng
    is_room_query = any(k in msg for k in [
        'phòng', 'giá', 'trống', 'còn phòng', 'hạng phòng', 'loại phòng', 'room', 'đêm', 'bao nhiêu',
        'rate', 'rates', 'cost', 'available', 'availability', 'suite', 'deluxe',
        '객실', '방', '요금', '가격', '예약', '스위트', '디럭스',
        '房', '客房', '价格', '房价', '预订', '套房', '空房'
    ])
    if is_room_query:
        rooms = hotel_context.get('rooms', [])
        if rooms:
            if lang == 'en':
                lines = [f"Dear Valued Guest, here are today's available luxury rooms & rates at **{h_info['name']}**:\n"]
                for r in rooms:
                    p = r['promo_price'] if r.get('promo_price') else r['base_price']
                    price_str = format_currency_multilingual(p, lang='en')
                    avail = f"**{r['available_count']} rooms available**" if r['available_count'] > 0 else "Fully booked online"
                    lines.append(f"• 🏨 **{r['name']}**: **{price_str}** / night ({r['capacity']} guests, {r['bed_type']}) — {avail}")
                lines.append(f"\n🕒 **Standard Hours**: Check-in from **{h_info['check_in']}** | Check-out before **{h_info['check_out']}**.")
                lines.append("You can explore room details and book directly via the interactive cards below!")
                return "\n".join(lines)
            elif lang == 'ko':
                lines = [f"고객님 안녕하십니까! **{h_info['name']}**의 오늘 이용 가능한 럭셔리 객실 및 1박 요금 안내드립니다:\n"]
                for r in rooms:
                    p = r['promo_price'] if r.get('promo_price') else r['base_price']
                    price_str = format_currency_multilingual(p, lang='ko')
                    avail = f"현재 **{r['available_count']}개 객실 이용 가능**" if r['available_count'] > 0 else "온라인 예약 마감"
                    lines.append(f"• 🏨 **{r['name']}**: **{price_str}** / 1박 ({r['capacity']}인 기준, {r['bed_type']}) — {avail}")
                lines.append(f"\n🕒 **체크인/아웃**: 체크인 **{h_info['check_in']}**부터 | 체크아웃 **{h_info['check_out']}**까지.")
                lines.append("아래 인터랙티브 객실 카드를 통해 즉시 예약 및 상세 정보를 확인하실 수 있습니다!")
                return "\n".join(lines)
            elif lang == 'zh':
                lines = [f"尊敬的贵宾，您好！以下为您提供**{h_info['name']}**今日可预订的豪华客房与参考房价：\n"]
                for r in rooms:
                    p = r['promo_price'] if r.get('promo_price') else r['base_price']
                    price_str = format_currency_multilingual(p, lang='zh')
                    avail = f"当前**剩余 {r['available_count']} 间空房**" if r['available_count'] > 0 else "线上已售罄"
                    lines.append(f"• 🏨 **{r['name']}**: **{price_str}** / 晚 (可容纳{r['capacity']}人, {r['bed_type']}) — {avail}")
                lines.append(f"\n🕒 **入住时间**: **{h_info['check_in']}**起 | 退房时间 **{h_info['check_out']}**前。")
                lines.append("您可以直接点击下方卡片查看详情或立即预订！")
                return "\n".join(lines)
            else:
                lines = [f"Dạ em xin gửi Quý khách bảng giá và tình trạng phòng trống hôm nay tại **{h_info['name']}**:\n"]
                for r in rooms:
                    price = r['promo_price_formatted'] if r.get('promo_price_formatted') else r['base_price_formatted']
                    avail = f"Còn **{r['available_count']} phòng trống**" if r['available_count'] > 0 else "Hết phòng trực tuyến"
                    lines.append(f"• 🏨 **{r['name']}**: **{price}** / đêm ({r['capacity']} người lớn, {r['bed_type']}) — {avail}")
                lines.append(f"\n🕒 **Giờ tiêu chuẩn**: Check-in **{h_info['check_in']}** | Check-out **{h_info['check_out']}**.")
                lines.append("Quý khách có thể xem hình ảnh và đặt phòng trực tiếp tại các thẻ phòng bên dưới ạ!")
                return "\n".join(lines)

    # 3. Dịch vụ & Ẩm thực / Spa
    is_svc_query = any(k in msg for k in [
        'dịch vụ', 'ăn', 'ẩm thực', 'nhà hàng', 'spa', 'massage', 'xe', 'đưa đón', 'sân bay', 'giặt', 'bar', 'service', 'menu',
        'dining', 'food', 'restaurant', 'shuttle', 'airport',
        '서비스', '식사', '레스토랑', '스파', '마사지', '공항', '픽업', '샌딩', '조식',
        '服务', '餐饮', '餐厅', '水疗', '按摩', '机场', '接送', '早餐'
    ])
    if is_svc_query:
        if lang == 'en':
            return (
                f"Dear Valued Guest, {h_info['name']} is delighted to offer 5-star international luxury amenities:\n\n"
                f"• 🍽️ **24/7 In-Room Dining**: Exquisite Asian & Western cuisine, fresh My Khe seafood, premium A5 Wagyu beef.\n"
                f"• 💆 **TA Ocean Spa & Wellness**: Himalayan salt sauna, herbal aroma massage therapy.\n"
                f"• 🚗 **Da Nang International Airport Transfer**: Private luxury Limousine & Mercedes transfer service.\n"
                f"• 👔 **Express Laundry & Valet**: Same-day premium dry cleaning service.\n\n"
                f"Feel free to explore our menu cards below or dial Concierge **{h_info['hotline']}** for instant service!"
            )
        elif lang == 'ko':
            return (
                f"고객님, {h_info['name']}에서는 최고급 5성급 편의 서비스를 제공하고 있습니다:\n\n"
                f"• 🍽️ **24시간 인룸 다이닝 (룸서비스)**: 동서양 셰프 특선 요리, 미케 비치 신선한 해산물, 최상급 A5 와규.\n"
                f"• 💆 **TA 오션 스파 & 웰니스**: 히말라야 핑크솔트 사우나, 한방 아로마 마사지 테라피.\n"
                f"• 🚗 **다낭 국제공항 리무진 픽업/샌딩**: 벤츠 및 최고급 VIP 리무진 프라이빗 의전 차량.\n"
                f"• 👔 **특급 세탁 & 드라이클리닝**: 당일 완성 프리미엄 세탁 서비스.\n\n"
                f"아래 서비스 카드를 통해 메뉴를 확인하시거나 핫라인 **{h_info['hotline']}**으로 즉시 주문하실 수 있습니다."
            )
        elif lang == 'zh':
            return (
                f"尊敬的贵宾，{h_info['name']}竭诚为您提供五星级国际奢华体验：\n\n"
                f"• 🍽️ **24小时客房送餐**: 精致亚欧料理、美溪沙滩鲜活海鲜、顶级A5和牛盛宴。\n"
                f"• 💆 **TA海景水疗SPA养生**: 喜马拉雅粉盐桑拿、天然草本精油舒压按摩。\n"
                f"• 🚗 **岘港国际机场贵宾接送**: 奔驰与豪华商务车私人专属接送机服务。\n"
                f"• 👔 **特快洗衣服务**: 当日立取的顶级干洗与熨烫服务。\n\n"
                f"您可以点击下方菜单卡片浏览详情，或拨打前台热线 **{h_info['hotline']}** 随时获取服务！"
            )
        else:
            services = hotel_context.get('services', [])
            stars_val = h_info.get('stars', 3)
            lines = [
                f"Dạ {h_info['name']} hân hạnh phục vụ Quý khách các dịch vụ đẳng cấp {stars_val} sao quốc tế:\n",
                "• 🍽️ **Ẩm thực & In-room Dining (24/7)**: Thực đơn Á - Âu, hải sản tươi sống Mỹ Khê, Bò Wagyu A5 thượng hạng.",
                "• 💆 **TA Ocean Spa & Wellness**: Xông hơi đá muối Himalaya, massage bấm huyệt thảo dược phục hồi năng lượng.",
                "• 🚗 **Xe đưa đón Sân bay Quốc tế Đà Nẵng**: Dòng xe Limousine & Mercedes sang trọng đón tiễn tận nơi.",
                "• 👔 **Dịch vụ Giặt ủi & Buồng phòng**: Giặt hấp cao cấp lấy nhanh trong ngày."
            ]
            if services:
                lines.append("\n📋 **Một số món & dịch vụ tiêu biểu trong thực đơn**:")
                for s in services[:5]:
                    lines.append(f"  + **{s['name']}**: **{s['price_formatted']}** ({s['category']})")
            lines.append(f"\nQuý khách có thể yêu cầu phục vụ trực tiếp qua mục **Menu Dịch Vụ** trên website hoặc gọi Hotline nội bộ **{h_info['hotline']}** ạ!")
            return "\n".join(lines)

    # 4. Chính sách Công ty / Đặt đoàn / Hóa đơn VAT
    if any(k in msg for k in [
        'công ty', 'doanh nghiệp', 'vat', 'hóa đơn', 'đoàn', 'b2b', 'hợp đồng', 'corporate', 'mice', 'thuế',
        'tax', 'company', 'invoice', '단체', '법인', '세금계산서', '회사', '企业', '发票', '团队', '会议'
    ]):
        c = hotel_context['corporate_policy']
        if lang == 'en':
            return (
                f"Dear Valued Guest, here is the Corporate & M.I.C.E Booking Policy at **{h_info['name']}**:\n\n"
                f"• 📄 **VAT Tax Invoice**: Fast electronic VAT invoice (8%) delivered directly to your corporate email.\n"
                f"• 🤝 **B2B Contracts & Rates**: 10% to 20% corporate discount for contracted partners.\n"
                f"• 👥 **Group & Event Services**: Tailored M.I.C.E events, conferences, and Team Building programs.\n"
                f"• 💳 **Credit Terms**: Flexible credit settlement terms (15 to 30 days) for contracted corporate clients.\n\n"
                f"Please contact our Sales Department via Hotline **{h_info['hotline']}** or Email **{h_info['email']}** for an exclusive quotation within 30 minutes!"
            )
        elif lang == 'ko':
            return (
                f"고객님, **{h_info['name']}**의 기업(B2B) 및 단체(M.I.C.E) 예약 정책을 안내해 드립니다:\n\n"
                f"• 📄 **공식 VAT 세금계산서**: 기업 이메일로 8% 전자 세금계산서 신속 발행 지원.\n"
                f"• 🤝 **B2B 법인 제휴 할인**: 기업 제휴 계약 체결 시 10% ~ 20% 특별 우대 할인 제공.\n"
                f"• 👥 **단체 & M.I.C.E 행사**: 단체 투숙객 명단 등록, 국제회의 및 팀빌딩 맞춤 진행.\n"
                f"• 💳 **법인 신용 결제**: 계약 기업 파트너 대상 15~30일 후불 정산 지원.\n\n"
                f"웹사이트의 '기업/단체 예약' 메뉴 또는 핫라인 **{h_info['hotline']}**, 이메일 **{h_info['email']}**로 문의해 주시면 30분 이내에 맞춤 견적서를 송부해 드립니다!"
            )
        elif lang == 'zh':
            return (
                f"尊敬的贵宾，以下为您介绍**{h_info['name']}**的企业（B2B）与团队（M.I.C.E）预订政策：\n\n"
                f"• 📄 **官方增值税发票（VAT）**: 支持开具8%正规电子增值税发票直接发送至企业邮箱。\n"
                f"• 🤝 **企业合同折扣**: 签约企业可享受10%至20%的专属协议优惠价。\n"
                f"• 👥 **团队与会奖服务**: 提供团队名单接待、商务会议及团建活动一站式服务。\n"
                f"• 💳 **信用账期支持**: 为签约合作企业提供15至30天的灵活挂账结账周期。\n\n"
                f"欢迎通过官网'企业团队预订'通道，或拨打热线 **{h_info['hotline']}**、发送邮件至 **{h_info['email']}**，我们将在30分钟内为您出具专属方案！"
            )
        else:
            return (
                f"Dạ về chính sách Đặt phòng Doanh nghiệp & Đoàn thể (M.I.C.E) tại **{h_info['name']}**, em xin thông tin đến Quý khách:\n\n"
                f"• 📄 **Hóa đơn tài chính VAT**: {c['vat_invoice']}\n"
                f"• 🤝 **Hợp đồng & Chiết khấu B2B**: {c['contracts']}\n"
                f"• 👥 **Dịch vụ Khách đoàn**: {c['group_services']}\n"
                f"• 💳 **Bảo lãnh công nợ**: {c['credit_terms']}\n\n"
                f"Quý công ty có thể gửi yêu cầu đặt phòng nhanh tại mục **'Đặt Đoàn & Doanh nghiệp'** trên website hoặc liên hệ Phòng Kinh Doanh qua Hotline: **{h_info['hotline']}** hoặc Email: **{h_info['email']}** để nhận báo giá chiết khấu tốt nhất trong 30 phút ạ!"
            )

    # 5. Khuyến mãi / Ưu đãi / Thẻ thành viên
    if any(k in msg for k in [
        'khuyến mãi', 'voucher', 'ưu đãi', 'giảm giá', 'coupon', 'promo', 'vip', 'thành viên', 'silver', 'gold', 'platinum',
        'discount', 'deal', 'membership', '할인', '프로모션', '쿠폰', '멤버십', '优惠', '折扣', '促销', '会员'
    ]):
        if lang == 'en':
            lines = [
                f"Dear Valued Guest, **{h_info['name']}** offers exclusive privileges:\n",
                "🌟 **TA Club Membership Privileges**:",
                "• 🥈 **Silver Tier**: 5% discount on total room rates.",
                "• 🥇 **Gold Tier**: 10% discount + Complimentary room upgrade (subject to availability).",
                "• 💎 **Platinum Tier**: 15% discount + Late check-out until 15:00 & Free airport luxury transfer."
            ]
            promos = hotel_context.get('promotions', [])
            if promos:
                lines.append("\n🎁 **Active Promotional Codes Today**:")
                for p in promos:
                    lines.append(f"• Code **{p['code']}**: {p['discount']} OFF (Min order: {p['min_order']})")
            lines.append("\nEnter promo codes at checkout for instant booking discount!")
            return "\n".join(lines)
        elif lang == 'ko':
            lines = [
                f"고객님, **{h_info['name']}**에서는 특별한 멤버십 우대 혜택을 제공하고 있습니다:\n",
                "🌟 **TA Club 멤버십 등급 혜택**:",
                "• 🥈 **실버 (Silver)**: 객실 요금 즉시 **5%** 할인.",
                "• 🥇 **골드 (Gold)**: 객실 요금 즉시 **10%** 할인 + 무료 객실 업그레이드 우선권 제공.",
                "• 💎 **플래티넘 (Platinum)**: 객실 요금 즉시 **15%** 할인 + 15:00 레이트 체크아웃 & 무료 공항 리무진 픽업."
            ]
            promos = hotel_context.get('promotions', [])
            if promos:
                lines.append("\n🎁 **오늘 사용 가능한 프로모션 코드**:")
                for p in promos:
                    lines.append(f"• 코드 **{p['code']}**: **{p['discount']}** 할인 (최소 주문 {p['min_order']})")
            lines.append("\n온라인 결제 시 코드를 입력하시면 즉시 할인이 적용됩니다!")
            return "\n".join(lines)
        elif lang == 'zh':
            lines = [
                f"尊敬的贵宾，**{h_info['name']}**为您提供专属会员特权：\n",
                "🌟 **TA Club 会员专享礼遇**:",
                "• 🥈 **银卡会员 (Silver)**: 尊享客房总价 **9.5折** (减免5%)。",
                "• 🥇 **金卡会员 (Gold)**: 尊享客房 **9折** (减免10%) + 免费优先升级房型。",
                "• 💎 **白金卡会员 (Platinum)**: 尊享客房 **8.5折** (减免15%) + 延迟退房至15:00 & 免费机场专车接送。"
            ]
            promos = hotel_context.get('promotions', [])
            if promos:
                lines.append("\n🎁 **今日可用优惠码**:")
                for p in promos:
                    lines.append(f"• 优惠码 **{p['code']}**: 立减 **{p['discount']}** (消费满 {p['min_order']})")
            lines.append("\n在线结账时输入优惠券代码即可享受立减优惠！")
            return "\n".join(lines)
        else:
            lines = [
                f"Dạ {h_info['name']} đang áp dụng các chương trình ưu đãi đặc quyền:\n",
                "🌟 **Chính sách Thẻ Hội Viên TA Club**:",
                "• 🥈 **Hạng Bạc (Silver)**: Giảm ngay **5%** tổng tiền phòng.",
                "• 🥇 **Hạng Vàng (Gold)**: Giảm ngay **10%** + Ưu tiên nâng hạng phòng miễn phí.",
                "• 💎 **Hạng Bạch Kim (Platinum)**: Giảm ngay **15%** + Trả phòng muộn đến 15:00 & Miễn phí đưa đón sân bay."
            ]
            promos = hotel_context.get('promotions', [])
            if promos:
                lines.append("\n🎁 **Mã Khuyến Mãi Đang Kích Hoạt Hôm Nay**:")
                for p in promos:
                    lines.append(f"• Mã **{p['code']}**: Giảm **{p['discount']}** (Đơn từ {p['min_order']})")
            lines.append("\nQuý khách chỉ cần nhập mã tại bước thanh toán để được áp dụng giảm trừ trực tiếp nhé ạ!")
            return "\n".join(lines)

    # 6. Địa chỉ / Liên hệ / Hotline
    if any(k in msg for k in [
        'địa chỉ', 'ở đâu', 'vị trí', 'hotline', 'liên hệ', 'sđt', 'số điện thoại', 'email', 'map',
        'address', 'location', 'contact', 'phone', 'where', '주소', '위치', '연락처', '전화번호', '지도', '어디',
        '地址', '位置', '电话', '联系方式', '地图'
    ]):
        if lang == 'en':
            return (
                f"Dear Valued Guest, **{h_info['name']}** is nestled in a prime beachside location along My Khe Beach:\n\n"
                f"• 📍 **Address**: {h_info['address']}\n"
                f"• 📞 **24/7 Concierge Hotline**: **{h_info['hotline']}**\n"
                f"• ☎️ **Telephone**: {h_info['phone']}\n"
                f"• 📧 **Email**: {h_info['email']}\n"
                f"• 🌐 **Website**: {h_info['website']}\n\n"
                f"The hotel is conveniently located just 10 minutes from Da Nang International Airport and 5 minutes from the Dragon Bridge. We look forward to welcoming you!"
            )
        elif lang == 'ko':
            return (
                f"고객님, **{h_info['name']}**은 세계적인 미케 비치(My Khe Beach) 해변가에 위치하고 있습니다:\n\n"
                f"• 📍 **호텔 주소**: {h_info['address']}\n"
                f"• 📞 **24시간 컨시어지 핫라인**: **{h_info['hotline']}**\n"
                f"• ☎️ **대표 전화**: {h_info['phone']}\n"
                f"• 📧 **고객 센터 이메일**: {h_info['email']}\n"
                f"• 🌐 **공식 웹사이트**: {h_info['website']}\n\n"
                f"다낭 국제공항에서 차량으로 단 10분, 용다리(Dragon Bridge)에서 5분 거리에 위치해 있습니다. 정성을 다해 모시겠습니다!"
            )
        elif lang == 'zh':
            return (
                f"尊敬的贵宾，**{h_info['name']}**坐落于美溪沙滩黄金海岸线：\n\n"
                f"• 📍 **酒店地址**: {h_info['address']}\n"
                f"• 📞 **24小时礼宾热线**: **{h_info['hotline']}**\n"
                f"• ☎️ **总机电话**: {h_info['phone']}\n"
                f"• 📧 **客服邮箱**: {h_info['email']}\n"
                f"• 🌐 **官方网址**: {h_info['website']}\n\n"
                f"酒店距离岘港国际机场仅10分钟车程，距离龙桥仅5分钟车程。非常荣幸能为您服务！"
            )
        else:
            return (
                f"Dạ Khách sạn TA Đà Nẵng tọa lạc tại vị trí tuyệt đẹp ven bãi biển Mỹ Khê:\n\n"
                f"• 📍 **Địa chỉ**: {h_info['address']}\n"
                f"• 📞 **Hotline lễ tân (24/7)**: **{h_info['hotline']}**\n"
                f"• ☎️ **Điện thoại bàn**: {h_info['phone']}\n"
                f"• 📧 **Email CSKH**: {h_info['email']}\n"
                f"• 🌐 **Website**: {h_info['website']}\n\n"
                f"Khách sạn cách Sân bay Quốc tế Đà Nẵng chỉ 10 phút lái xe và cách Cầu Rồng 5 phút di chuyển. Em rất hân hạnh được đón tiếp Quý khách ạ!"
            )

    # 7. Thanh toán / VietQR
    if any(k in msg for k in [
        'thanh toán', 'chuyển khoản', 'qr', 'vietqr', 'ngân hàng', 'cọc', 'sepay',
        'pay', 'payment', 'credit card', 'visa', 'mastercard', '결제', '카드', '송금', '계좌', '지불', '支付', '付款', '刷卡'
    ]):
        if lang == 'en':
            return (
                f"Dear Valued Guest, **{h_info['name']}** supports 100% secure, instant payment methods:\n\n"
                f"• ⚡ **Instant VietQR Code**: Dynamic QR code with auto-reconciliation in 3 seconds via Sepay gateway.\n"
                f"• 💳 **International & Local Cards**: Visa, MasterCard, JCB, and Napas cards.\n"
                f"• 🏨 **Front Desk Cash / POS**: Settle payment upon check-in at the reception desk.\n\n"
                f"Rest assured your transactions are fully encrypted and guaranteed."
            )
        elif lang == 'ko':
            return (
                f"고객님, **{h_info['name']}**은 안전하고 신속한 100% 보안 결제 시스템을 지원합니다:\n\n"
                f"• ⚡ **VietQR 자동 결제**: 동적 QR코드로 3초 만에 실시간 자동 입금 확인 (Sepay 연동).\n"
                f"• 💳 **해외/국내 신용카드**: Visa, MasterCard, JCB, Napas 완벽 지원.\n"
                f"• 🏨 **프론트 데스크 결제**: 체크인 시 현금 또는 POS 카드 단말기 결제 가능합니다.\n\n"
                f"안심하고 공식 웹사이트에서 편리하게 예약하시기 바랍니다!"
            )
        elif lang == 'zh':
            return (
                f"尊敬的贵宾，**{h_info['name']}**支持安全便捷的多种支付方式：\n\n"
                f"• ⚡ **VietQR 极速扫码支付**: 动态二维码，3秒内自动到账并极速确认预订（Sepay系统）。\n"
                f"• 💳 **国际及本地银行卡**: 支持 Visa、MasterCard、JCB、Napas。\n"
                f"• 🏨 **前台现场支付**: 办理入住时支持现金或POS机刷卡。\n\n"
                f"您的每笔交易均受最高级别加密保护，请放心在线预订！"
            )
        else:
            return (
                f"Dạ Khách sạn hỗ trợ các hình thức thanh toán an toàn, tức thì và bảo mật 100%:\n\n"
                f"• ⚡ **Quét mã VietQR tự động**: Mã QR động kèm số tiền chính xác, hệ thống tự động gạch nợ và xác nhận đơn đặt phòng tức thì trong 3 giây (thông qua cổng Sepay).\n"
                f"• 💳 **Thẻ quốc tế & Thẻ nội địa**: Visa, MasterCard, JCB hoặc Napas.\n"
                f"• 🏨 **Thanh toán tại quầy lễ tân**: Tiền mặt hoặc quẹt thẻ POS khi Quý khách làm thủ tục Check-in.\n\n"
                f"Quý khách hoàn toàn yên tâm khi thực hiện đặt phòng trực tuyến tại website của chúng em ạ!"
            )

    # 8. Mặc định / Lời chào hỏi lịch sự
    greeting_name = f"Quý khách {user_ctx['full_name']}" if user_ctx else "Quý khách"
    if lang == 'en':
        return (
            f"Dear Valued Guest! I am the AI Concierge of **{h_info['name']}**.\n\n"
            f"I am pleased to assist you 24/7 with:\n"
            f"• 🏨 **Available Rooms & Today's Rates (with USD conversion)**\n"
            f"• 🍽️ **Fine Dining Menus, Ocean Spa & Luxury Airport Transfers**\n"
            f"• 🏢 **Corporate & Group (M.I.C.E) Bookings**\n"
            f"• 🔍 **Real-Time Reservation Status Tracking**\n\n"
            f"How may I assist your stay in Da Nang today?"
        )
    elif lang == 'ko':
        return (
            f"고객님 안녕하십니까! **{h_info['name']}**의 5성급 AI 컨시어지입니다.\n\n"
            f"24시간 언제든 다음과 같은 정보를 친절하게 안내해 드립니다:\n"
            f"• 🏨 **오늘의 실시간 공실 및 객실 요금 (원화 KRW 환산 표시)**\n"
            f"• 🍽️ **인룸 다이닝 메뉴, 오션 스파 & 다낭 공항 리무진 픽업/샌딩**\n"
            f"• 🏢 **기업/단체 예약 및 세금계산서 발행 안내**\n"
            f"• 🔍 **실시간 예약 진행 상태 조회**\n\n"
            f"궁금하신 점을 편하게 말씀해 주시면 즉시 정성껏 도와드리겠습니다!"
        )
    elif lang == 'zh':
        return (
            f"尊敬的贵宾，您好！我是**{h_info['name']}**的五星级AI礼宾专员。\n\n"
            f"我将24小时竭诚为您提供以下专业咨询服务：\n"
            f"• 🏨 **今日空房查询与实时优惠房价 (人民币 CNY 自动换算)**\n"
            f"• 🍽️ **精致餐饮菜单、海景水疗SPA与豪华机场接送服务**\n"
            f"• 🏢 **商务会奖（M.I.C.E）与企业团队预订政策**\n"
            f"• 🔍 **实时预订订单进度追踪**\n\n"
            f"请问今天有什么可以为您效劳的吗？"
        )
    else:
        return (
            f"Dạ em chào {greeting_name}! Em là Trợ lý ảo AI của **{h_info['name']}**.\n\n"
            f"Em luôn sẵn sàng hỗ trợ Quý khách 24/7 về các thông tin:\n"
            f"• 🏨 **Tra cứu phòng trống & Bảng giá phòng hôm nay**\n"
            f"• 🍽️ **Thực đơn ẩm thực, Spa & Dịch vụ đưa đón sân bay**\n"
            f"• 🏢 **Chính sách đặt phòng Doanh nghiệp (hóa đơn VAT)**\n"
            f"• 🔍 **Kiểm tra trạng thái đơn đặt phòng của Quý khách**\n\n"
            f"Quý khách đang quan tâm đến thông tin nào, hãy nhắn cho em biết để em hỗ trợ Quý khách ngay nhé ạ!"
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


def extract_suggestions(message, hotel_context, lang='vi'):
    """
    Trích xuất danh sách Interactive Cards (phòng nghỉ hoặc dịch vụ) phù hợp với ý định câu hỏi
    để hiển thị trực quan kèm nút [Xem chi tiết] và [Đặt ngay] trên giao diện Chatbot.
    Tự động hiển thị giá quy đổi đa ngôn ngữ (VND + USD/KRW/CNY).
    """
    msg_lower = message.strip().lower()
    suggested_rooms = []
    suggested_services = []

    # 1. Phát hiện câu hỏi liên quan đến phòng
    is_room_query = any(k in msg_lower for k in [
        'phòng', 'giá', 'trống', 'còn phòng', 'hạng phòng', 'loại phòng',
        'room', 'rooms', 'rate', 'rates', 'price', 'cost', 'available', 'availability',
        'đêm', 'bao nhiêu', 'đặt phòng', 'suite', 'deluxe', 'penthouse', 'view', 'ngủ', 'ở',
        '객실', '방', '요금', '가격', '예약', '스위트', '디럭스',
        '房', '客房', '价格', '房价', '预订', '套房', '空房'
    ])
    if is_room_query:
        def score_room(r):
            name_lower = r.get('name', '').lower()
            matched = any(w in name_lower for w in msg_lower.split() if len(w) >= 3 and w in name_lower)
            has_avail = 1 if r.get('available_count', 0) > 0 else 0
            return (1 if matched else 0, has_avail, -r.get('base_price', 0))

        sorted_rooms = sorted(hotel_context.get('rooms', []), key=score_room, reverse=True)
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
                'available_count': r.get('available_count', 0),
                'image_url': r.get('image_url') or fallback_img
            })

    # 2. Phát hiện câu hỏi liên quan đến dịch vụ / ẩm thực
    is_service_query = any(k in msg_lower for k in [
        'dịch vụ', 'ăn', 'ẩm thực', 'nhà hàng', 'spa', 'massage',
        'xe', 'đưa đón', 'sân bay', 'giặt', 'bar', 'service', 'menu', 'món',
        'dining', 'food', 'restaurant', 'shuttle', 'airport', 'transfer', 'laundry',
        '서비스', '식사', '레스토랑', '스파', '마사지', '공항', '픽업', '샌딩', '조식',
        '服务', '餐饮', '餐厅', '水疗', '按摩', '机场', '接送', '早餐', '菜单'
    ])
    if is_service_query:
        for idx, s in enumerate(hotel_context.get('services', [])[:3]):
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
    3. Hoặc người dùng đã đăng nhập và hỏi về đơn đặt phòng / lịch sử đặt phòng.
    Hỗ trợ đa ngôn ngữ (EN, KO, ZH, VI) và tiền tệ quy đổi.
    """
    msg = message.strip()
    msg_lower = msg.lower()
    tracked_bookings = []
    
    # Map trạng thái đa ngôn ngữ: (nhãn hiển thị, step_index, badge_color)
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

    # 3. Nếu là hội viên đã đăng nhập và hỏi về đơn đặt phòng
    if not found_bookings and request and getattr(request, 'user', None) and request.user.is_authenticated:
        if any(k in msg_lower for k in [
            'đơn', 'đặt phòng của tôi', 'booking', 'kiểm tra đơn', 'tra cứu đơn', 'lịch sử', 'phòng của tôi',
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
    Nhận message và history từ khách hàng.
    Tự động nhận diện ngôn ngữ (Tiếng Việt, Tiếng Anh, Hàn, Trung).
    Gọi trực tiếp Google Gemini REST API (gemini-2.5-flash).
    Nếu lỗi mạng hoặc chưa điền API Key, tự động chuyển sang Fallback thông minh đa ngôn ngữ.
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

        # 0. Tự động nhận diện ngôn ngữ của khách
        detected_lang = detect_language(message)

        # 1. Thu thập ngữ cảnh Database thời gian thực, gợi ý phòng/dịch vụ & tra cứu đơn hàng
        hotel_context = build_hotel_context(request)
        system_prompt = generate_system_prompt(hotel_context)
        suggested_rooms, suggested_services = extract_suggestions(message, hotel_context, lang=detected_lang)
        tracked_bookings = extract_booking_tracker(message, request, hotel_context, lang=detected_lang)

        # Nếu tìm thấy đơn đặt phòng tra cứu, bổ sung vào system prompt cho AI
        if tracked_bookings:
            bk = tracked_bookings[0]
            system_prompt += (
                f"\n\n[DỮ LIỆU ĐƠN ĐẶT PHÒNG KHÁCH TRA CỨU]:\n"
                f"- Mã đơn: #{bk['booking_code']}\n"
                f"- Khách hàng: {bk['guest_name']} (SĐT: {bk['guest_phone']})\n"
                f"- Hạng phòng: {bk['room_name']}\n"
                f"- Thời gian lưu trú: {bk['check_in_date']} đến {bk['check_out_date']}\n"
                f"- Tổng thanh toán: {bk['total_amount']}\n"
                f"- Trạng thái hiện tại: {bk['status_label']} (Bước {bk['step_index']}/4)\n"
                f"Hãy phản hồi đầy đủ thông tin này một cách ân cần, sang trọng chuẩn {hotel_context['hotel_info'].get('stars', 3)} sao và chúc khách có kỳ nghỉ thoải mái."
            )

        # 2. Kiểm tra Gemini API Key
        gemini_api_key = getattr(settings, 'GEMINI_API_KEY', '') or os.getenv('GEMINI_API_KEY', '')
        gemini_api_key = gemini_api_key.strip()

        # Kiểm tra nếu API Key rỗng hoặc là placeholder mẫu
        is_key_valid = (
            gemini_api_key and 
            'your_gemini_api_key' not in gemini_api_key.lower() and 
            'your_api_key' not in gemini_api_key.lower()
        )

        if not is_key_valid:
            logger.info("Chưa cấu hình GEMINI_API_KEY hoặc là placeholder -> Sử dụng Local Smart Fallback")
            fallback_reply = local_smart_fallback(message, request.user, hotel_context, tracked_bookings=tracked_bookings, lang=detected_lang)
            return Response({
                'success': True,
                'reply': fallback_reply,
                'source': 'local_smart_fallback',
                'detected_lang': detected_lang,
                'suggested_rooms': suggested_rooms,
                'suggested_services': suggested_services,
                'tracked_bookings': tracked_bookings
            })

        # 3. Chuẩn bị nội dung gửi Gemini REST API
        # Model theo yêu cầu đề bài: gemini-2.5-flash
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_api_key}"

        # Xử lý history (tối đa 5 tin nhắn gần nhất)
        contents = []
        if isinstance(history, list):
            valid_history = history[-5:]  # Lấy 5 tin nhắn gần nhất
            for item in valid_history:
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
                'temperature': 0.7,
                'maxOutputTokens': 1000
            }
        }

        try:
            headers = {'Content-Type': 'application/json'}
            response = requests.post(
                gemini_url,
                json=payload,
                headers=headers,
                timeout=12
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
                            'suggested_rooms': suggested_rooms,
                            'suggested_services': suggested_services,
                            'tracked_bookings': tracked_bookings
                        })

            logger.warning(f"Gemini API phản hồi mã lỗi {response.status_code}: {response.text[:200]}")
            if response.status_code in [404, 400]:
                alt_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_api_key}"
                alt_resp = requests.post(alt_url, json=payload, headers=headers, timeout=10)
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
                                'suggested_rooms': suggested_rooms,
                                'suggested_services': suggested_services,
                                'tracked_bookings': tracked_bookings
                            })

        except Exception as ex:
            logger.error(f"Lỗi kết nối Gemini API: {ex}")

        # 4. Khi gặp sự cố, tự động kích hoạt Local Smart Fallback
        fallback_reply = local_smart_fallback(message, request.user, hotel_context, tracked_bookings=tracked_bookings, lang=detected_lang)
        return Response({
            'success': True,
            'reply': fallback_reply,
            'source': 'local_smart_fallback',
            'detected_lang': detected_lang,
            'suggested_rooms': suggested_rooms,
            'suggested_services': suggested_services,
            'tracked_bookings': tracked_bookings
        })

