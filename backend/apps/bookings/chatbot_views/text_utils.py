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
