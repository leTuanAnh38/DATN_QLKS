"""Trích xuất ngày, số khách và phòng từ hội thoại."""
import re
import logging
from datetime import datetime, timedelta
from django.utils import timezone


logger = logging.getLogger(__name__)


def extract_guest_count(message, history=None):
    """
    Nhận diện số lượng khách (người lớn) trong câu hỏi hoặc lịch sử gần đây.
    VD: 'phòng cho 4 người', '3 khách', '2 adults', '4 guests', '4명', '3位'
    """
    pattern = r'\b(\d{1,2})\s*(?:người\s*lớn|người|khách|adults?|guests?|people|persons?|pax|명|인|人|位)\b'

    def _parse(txt):
        if not txt:
            return None
        m = re.search(pattern, str(txt).lower())
        if m:
            try:
                val = int(m.group(1))
                if 1 <= val <= 20:
                    return val
            except ValueError:
                pass
        return None

    count = _parse(message)
    if count:
        return count

    if isinstance(history, list):
        for item in reversed(history[-4:]):
            if isinstance(item, dict) and item.get('role') in ['user', None]:
                prev = item.get('text') or item.get('content') or ''
                count = _parse(prev)
                if count:
                    return count
    return None


def extract_dates_from_conversation(message, history=None):
    """
    Phân tích ngôn ngữ tự nhiên để bóc tách ngày Check-in và Check-out từ câu hỏi của khách
    (hoặc kế thừa từ các câu hỏi liền trước trong history):
    - Hỗ trợ: 'hôm nay', 'tối nay', 'ngày mai', 'mai', 'ngày kia', 'mốt', 'cuối tuần này', 'tuần sau',
      'tomorrow', 'tonight', 'this weekend', 'next week', '내일', '모레', '주말', '明天', '后天', '周末'
    - Hỗ trợ định dạng ngày cụ thể: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD/MM, 'ngày DD tháng MM'
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
        nights_match = re.search(r'(\d{1,2})\s*(?:đêm|ngày\s*đêm|nights?|박|晚)', t_low)
        if nights_match:
            try:
                nights_count = max(1, min(30, int(nights_match.group(1))))
            except ValueError:
                nights_count = 1

        parsed_dates = []

        # 2a. Tìm định dạng ISO YYYY-MM-DD
        iso_matches = re.findall(r'\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b', t_low)
        for y_str, m_str, d_str in iso_matches:
            try:
                dt_obj = datetime(int(y_str), int(m_str), int(d_str)).date()
                if dt_obj >= now_date:
                    parsed_dates.append(dt_obj)
            except ValueError:
                continue

        # 2b. Tìm định dạng DD/MM(/YYYY) hoặc DD-MM(-YYYY) (tránh trùng ISO đã bắt)
        if not parsed_dates:
            date_matches = re.findall(r'\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b', t_low)
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

        # 2c. Tìm định dạng "ngày DD tháng MM"
        if not parsed_dates:
            vn_matches = re.findall(r'(?:ngày\s*)?(\d{1,2})\s*tháng\s*(\d{1,2})(?:\s*năm\s*(\d{4}))?', t_low)
            for d_str, m_str, y_str in vn_matches:
                try:
                    day_val = int(d_str)
                    month_val = int(m_str)
                    if not (1 <= day_val <= 31 and 1 <= month_val <= 12):
                        continue
                    year_val = int(y_str) if y_str else now_date.year
                    if not y_str and datetime(year_val, month_val, day_val).date() < now_date:
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
            elif any(k in t_low for k in ['tuần sau', 'tuần tới', 'next week', '다음 주', '下周']):
                days_to_next_mon = (7 - now_date.weekday()) % 7 or 7
                c_in = now_date + timedelta(days=days_to_next_mon)
                c_out = c_in + timedelta(days=max(nights_count, 1))
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

    # 2. Nếu câu hiện tại dùng đại từ hoặc hỏi tiện ích chi tiết, quét ngược history
    if isinstance(history, list):
        for item in reversed(history[-5:]):
            if not isinstance(item, dict):
                continue
            prev_text = item.get('text') or item.get('content') or ''
            matched = _match_room_in_text(prev_text)
            if matched:
                return matched

    return None
