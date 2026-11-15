"""Tiện ích văn bản: định dạng tiền, bỏ HTML, nhận diện ngôn ngữ."""
import re
import logging


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


def detect_language(text, preferred_lang=None):
    """
    Tự động nhận diện ngôn ngữ của tin nhắn khách hàng:
    - 'ko': Tiếng Hàn (chứa ký tự Hangul)
    - 'zh': Tiếng Trung (chứa ký tự Hanzi)
    - 'en': Tiếng Anh
    - 'vi': Tiếng Việt (mặc định)
    Có tham khảo `preferred_lang` từ UI đối với các câu ngắn/trung tính (VD: chỉ có mã đơn BK-...).
    """
    if not text:
        return preferred_lang if preferred_lang in ['vi', 'en', 'ko', 'zh'] else 'vi'

    # 1. Tiếng Hàn: Ký tự Hangul [\uac00-\ud7a3\u1100-\u11ff]
    if re.search(r'[\uac00-\ud7a3\u1100-\u11ff]', text):
        return 'ko'

    # 2. Tiếng Trung: Ký tự Hanzi [\u4e00-\u9fff]
    if re.search(r'[\u4e00-\u9fff]', text):
        return 'zh'

    text_lower = text.lower().strip()

    # 3. Nếu có dấu tiếng Việt -> chắc chắn là tiếng Việt
    vietnamese_accents = re.search(
        r'[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]',
        text_lower,
    )
    if vietnamese_accents:
        return 'vi'

    # 4. Kiểm tra các từ tiếng Việt không dấu phổ biến
    unaccented_vi_keywords = [
        'phong', 'gia', 'dat', 'khach', 'ngay', 'hom nay', 'ngay mai', 'cuoi tuan',
        'xin chao', 'cam on', 'bao nhieu', 'con khong', 'don', 'dich vu',
        'hoa don', 'tam tinh', 'don phong', 'ho boi', 'an sang', 'da nang',
        'cau rong', 'hoi an', 'ba na', 'thanh toan', 'khuyen mai', 'uu dai',
        'tra cuu', 'kiem tra', 'giup toi', 'cho toi', 'nhan phong', 'tra phong',
        'mat khau', 'may gio', 'huy phong'
    ]
    if any(re.search(rf'\b{re.escape(kw)}\b', text_lower) for kw in unaccented_vi_keywords):
        return 'vi'

    # 5. Kiểm tra từ khóa tiếng Anh phổ biến
    english_keywords = [
        'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
        'thank', 'thanks', 'please', 'yes', 'no', 'okay', 'sure', 'help',
        'room', 'rooms', 'price', 'prices', 'rate', 'rates', 'cost', 'available', 'availability',
        'hotel', 'booking', 'bookings', 'reservation', 'reservations', 'book', 'reserve',
        'check in', 'check out', 'check-in', 'check-out', 'how much', 'how many',
        'spa', 'massage', 'restaurant', 'airport', 'shuttle', 'transfer', 'car', 'limousine',
        'dinner', 'breakfast', 'lunch', 'food', 'menu', 'order', 'service', 'services',
        'swimming', 'pool', 'gym', 'fitness', 'suite', 'deluxe', 'penthouse',
        'what', 'where', 'when', 'which', 'tell me', 'show me', 'do you have', 'can i', 'could you',
        'track', 'status', 'my booking', 'reservation status', 'cancel', 'cancellation', 'refund',
        'early', 'late', 'policy', 'policies', 'discount', 'promo', 'voucher', 'vip', 'member',
        'tomorrow', 'tonight', 'today', 'weekend', 'night', 'nights', 'guest', 'guests', 'adult', 'adults', 'people',
        'wifi', 'wi-fi', 'password', 'bill', 'invoice', 'folio', 'charges', 'clean', 'housekeeping', 'towel', 'towels', 'water',
        'tour', 'travel', 'dragon bridge', 'ba na', 'hoi an', 'jacuzzi', 'bathtub', 'sea view', 'ocean view',
        'group', 'corporate', 'company', 'tax'
    ]
    if any(re.search(rf'\b{re.escape(kw)}\b', text_lower) for kw in english_keywords):
        return 'en'

    # 6. Câu trung tính (chỉ chứa mã đơn BK-..., số ĐT, ký tự số) -> giữ ngôn ngữ UI đang chọn
    if preferred_lang in ['vi', 'en', 'ko', 'zh']:
        return preferred_lang

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
