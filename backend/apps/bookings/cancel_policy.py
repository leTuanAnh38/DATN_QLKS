"""Tiện ích kiểm tra chính sách hủy & lưu/đọc yêu cầu hủy đơn đoàn (không cần sửa schema DB)."""
import json
import re
from datetime import datetime, time
from django.utils import timezone

_CANCEL_REQ_PATTERN = re.compile(r'\[CANCEL_REQ_JSON\](.*?)\[/CANCEL_REQ_JSON\]', re.DOTALL)


def get_cancellation_free_hours():
    """Lấy số giờ hủy phòng miễn phí từ HotelSetting (mặc định 48 giờ)."""
    from .models import HotelSetting
    try:
        setting = HotelSetting.get_settings()
        val = int(getattr(setting, 'cancellation_free_hours', 48) or 48)
        return max(0, val)
    except Exception:
        return 48


def get_group_cancel_eligibility(group, free_hours=None):
    """
    Tính toán điều kiện hủy miễn phí / hoàn cọc của đơn đặt đoàn dựa trên mốc 14:00 ngày nhận phòng.
    """
    if not group or not getattr(group, 'check_in_date', None):
        return None

    if free_hours is None:
        free_hours = get_cancellation_free_hours()

    check_in_date = group.check_in_date
    if isinstance(check_in_date, str):
        check_in_date = datetime.strptime(check_in_date[:10], '%Y-%m-%d').date()

    tz = timezone.get_current_timezone()
    checkin_dt = timezone.make_aware(datetime.combine(check_in_date, time(14, 0)), tz)
    hours_until = (checkin_dt - timezone.now()).total_seconds() / 3600.0
    hours_rounded = round(hours_until, 1)

    return {
        'free_hours': int(free_hours),
        'hours_until_checkin': hours_rounded,
        'is_free_cancel_eligible': hours_until >= float(free_hours),
    }


def parse_group_cancel_request(group):
    """Đọc dữ liệu yêu cầu hủy đoàn & hoàn cọc từ internal_note của GroupBooking."""
    if not group:
        return None
    raw = getattr(group, 'internal_note', None) or ''
    match = _CANCEL_REQ_PATTERN.search(raw)
    if not match:
        return None
    try:
        data = json.loads(match.group(1).strip())
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def upsert_group_cancel_request(group, request_data):
    """Ghi hoặc cập nhật JSON yêu cầu hủy đoàn vào internal_note mà vẫn giữ nguyên ghi chú khác."""
    raw = (getattr(group, 'internal_note', None) or '').strip()
    cleaned = _CANCEL_REQ_PATTERN.sub('', raw).strip()
    tag = f"[CANCEL_REQ_JSON]{json.dumps(request_data, ensure_ascii=False)}[/CANCEL_REQ_JSON]"
    group.internal_note = f"{cleaned}\n{tag}".strip() if cleaned else tag


def mark_group_cancel_request_approved(group, resolved_by=None):
    """Đánh dấu yêu cầu hủy đoàn đang chờ (nếu có) đã được duyệt khi đoàn bị hủy."""
    existing = parse_group_cancel_request(group)
    if not existing or existing.get('status') != 'pending':
        return False
    existing['status'] = 'approved'
    existing['resolved_at'] = timezone.now().isoformat()
    if resolved_by:
        existing['resolved_by'] = resolved_by
    upsert_group_cancel_request(group, existing)
    return True

