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


def normalize_phone(phone):
    """Chuẩn hóa số điện thoại về dạng chữ số (chuyển +84/84 đầu số về 0) để so sánh linh hoạt."""
    if not phone:
        return ''
    digits = re.sub(r'\D', '', str(phone))
    if digits.startswith('84') and len(digits) >= 11:
        digits = '0' + digits[2:]
    return digits


def phones_match(phone_a, phone_b):
    """So sánh 2 số điện thoại sau khi chuẩn hóa."""
    na = normalize_phone(phone_a)
    nb = normalize_phone(phone_b)
    return bool(na and nb and na == nb)


def extract_code_and_phone(text):
    """
    Trích xuất Mã đơn (BK-... / GRP-...) và Số điện thoại (VN hoặc quốc tế 8-15 chữ số) từ tin nhắn.
    Trả về `(raw_code, norm_code, phone_num)` hoặc `(None, None, None)` cho phần không tìm thấy.
    """
    if not text:
        return None, None, None

    msg = str(text)
    code_match = re.search(r'\b((?:BK|GRP)[-_]?[A-Z0-9]{4,10})\b', msg, re.IGNORECASE)
    raw_code = code_match.group(1).upper() if code_match else None
    norm_code = raw_code
    if raw_code:
        if raw_code.startswith('BK') and not raw_code.startswith('BK-'):
            norm_code = f"BK-{raw_code[2:]}"
        elif raw_code.startswith('GRP') and not raw_code.startswith('GRP-'):
            norm_code = f"GRP-{raw_code[3:]}"

    # Loại bỏ ngày tháng và mã đơn trước khi bắt số điện thoại để tránh nhận nhầm
    cleaned_for_phone = re.sub(r'\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b', ' ', msg)
    cleaned_for_phone = re.sub(r'\b\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?\b', ' ', cleaned_for_phone)
    if raw_code:
        cleaned_for_phone = cleaned_for_phone.replace(code_match.group(0), ' ')

    phone_num = None
    vn_match = re.search(r'(?<!\d)(?:\+?84|0)[\s.\-]?([35789])(?:[\s.\-]?\d){8}(?!\d)', cleaned_for_phone)
    if vn_match:
        phone_num = normalize_phone(vn_match.group(0))
    else:
        intl_match = re.search(r'(?<!\d)\+?\d(?:[\s.\-]?\d){7,14}(?!\d)', cleaned_for_phone)
        if intl_match:
            candidate = normalize_phone(intl_match.group(0))
            if 8 <= len(candidate) <= 15:
                phone_num = candidate

    return raw_code, norm_code, phone_num


def find_code_phone_pair_in_history(history):
    """
    Tìm cặp (Mã đơn, SĐT) đã được người dùng cung cấp đồng thời trong một lượt hội thoại trước đó.
    Chỉ quét các tin nhắn có role == 'user'.
    """
    if not isinstance(history, list):
        return None, None, None
    for item in reversed(history[-8:]):
        if not isinstance(item, dict) or item.get('role') not in ('user', None):
            continue
        prev_text = item.get('text') or item.get('content') or ''
        raw_code, norm_code, phone_num = extract_code_and_phone(prev_text)
        if raw_code and phone_num:
            return raw_code, norm_code, phone_num
    return None, None, None


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
