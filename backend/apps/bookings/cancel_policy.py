"""Tiện ích kiểm tra chính sách hủy & lưu/đọc yêu cầu hủy đơn đoàn (không cần sửa schema DB)."""
import json
import re
from datetime import datetime, time
from django.utils import timezone

_CANCEL_REQ_PATTERN = re.compile(r'\[CANCEL_REQ_JSON\](.*?)\[/CANCEL_REQ_JSON\]', re.DOTALL)
_REFUND_BANK_PATTERN = re.compile(r'\[REFUND_BANK_JSON\](.*?)\[/REFUND_BANK_JSON\]', re.DOTALL)


def get_cancellation_free_hours():
    """Lấy số giờ hủy phòng miễn phí từ HotelSetting (mặc định 48 giờ)."""
    from .models import HotelSetting
    try:
        setting = HotelSetting.get_settings()
        val = int(getattr(setting, 'cancellation_free_hours', 48) or 48)
        return max(0, val)
    except Exception:
        return 48


def _compute_hours_until_checkin(check_in_date, free_hours=None):
    """Tính số giờ còn lại tới 14:00 ngày nhận phòng và điều kiện hủy miễn phí."""
    if not check_in_date:
        return None
    if free_hours is None:
        free_hours = get_cancellation_free_hours()

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


def get_group_cancel_eligibility(group, free_hours=None):
    """
    Tính toán điều kiện hủy miễn phí / hoàn cọc của đơn đặt đoàn dựa trên mốc 14:00 ngày nhận phòng.
    """
    if not group or not getattr(group, 'check_in_date', None):
        return None
    return _compute_hours_until_checkin(group.check_in_date, free_hours=free_hours)


def get_booking_cancel_eligibility(booking, free_hours=None):
    """
    Tính toán điều kiện hủy miễn phí cho đơn đặt phòng cá nhân (Booking).
    Đồng bộ mốc 14:00 ngày nhận phòng và quy tắc phân quyền/trạng thái của BookingViewSet.cancel_booking.
    """
    if not booking:
        return None

    st = str(getattr(booking, 'status', '') or '').lower()
    if free_hours is None:
        free_hours = get_cancellation_free_hours()

    base = _compute_hours_until_checkin(getattr(booking, 'check_in_date', None), free_hours=free_hours) or {
        'free_hours': int(free_hours),
        'hours_until_checkin': 0.0,
        'is_free_cancel_eligible': False,
    }

    if st in ('cancelled', 'checked_out', 'completed', 'no_show'):
        return {**base, 'can_cancel': False, 'reason': f'status_{st}', 'is_group_managed': False}
    if st == 'checked_in':
        return {**base, 'can_cancel': False, 'reason': 'already_checked_in', 'is_group_managed': False}
    if getattr(booking, 'group_booking_id', None):
        return {**base, 'can_cancel': False, 'reason': 'group_managed', 'is_group_managed': True}

    # Đơn pending (chưa thanh toán) luôn được hủy tự do; đơn confirmed/paid xét theo mốc free_hours
    is_free = True if st == 'pending' else base['is_free_cancel_eligible']
    return {
        **base,
        'can_cancel': True,
        'is_free_cancel_eligible': is_free,
        'reason': 'free_window' if is_free else 'late_window',
        'is_group_managed': False,
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


def strip_refund_bank_tag(raw_note):
    """Loại bỏ thẻ JSON thông tin tài khoản hoàn tiền khỏi ghi chú nội bộ hiển thị."""
    if not raw_note:
        return ''
    return _REFUND_BANK_PATTERN.sub('', str(raw_note)).strip()


def parse_booking_refund_bank_info(booking):
    """Đọc thông tin ngân hàng nhận hoàn tiền của đơn đặt phòng lẻ từ internal_note."""
    if not booking:
        return None
    raw = getattr(booking, 'internal_note', None) or ''
    match = _REFUND_BANK_PATTERN.search(raw)
    if not match:
        return None
    try:
        data = json.loads(match.group(1).strip())
        if not isinstance(data, dict):
            return None
        bank_name = str(data.get('bank_name') or '').strip()
        account_number = str(data.get('account_number') or '').strip()
        account_holder = str(data.get('account_holder') or '').strip()
        if not (bank_name or account_number or account_holder):
            return None
        parts = [p for p in [bank_name, account_number, account_holder] if p]
        return {
            'bank_name': bank_name,
            'account_number': account_number,
            'account_holder': account_holder,
            'summary': ' - '.join(parts),
            'submitted_at': data.get('submitted_at'),
        }
    except Exception:
        return None


def upsert_booking_refund_bank_info(booking, bank_name='', account_number='', account_holder=''):
    """
    Lưu thông tin tài khoản ngân hàng nhận hoàn tiền vào internal_note của Booking
    mà vẫn giữ nguyên nội dung ghi chú nội bộ khác (không cần sửa schema DB).
    """
    b_name = str(bank_name or '').strip()
    acc_no = str(account_number or '').strip()
    acc_holder = str(account_holder or '').strip()
    if not (b_name or acc_no or acc_holder):
        return None

    parts = [p for p in [b_name, acc_no, acc_holder] if p]
    payload = {
        'bank_name': b_name,
        'account_number': acc_no,
        'account_holder': acc_holder,
        'summary': ' - '.join(parts),
        'submitted_at': timezone.now().isoformat(),
    }
    raw = getattr(booking, 'internal_note', None) or ''
    cleaned = strip_refund_bank_tag(raw)
    tag = f"[REFUND_BANK_JSON]{json.dumps(payload, ensure_ascii=False)}[/REFUND_BANK_JSON]"
    booking.internal_note = f"{cleaned}\n{tag}".strip() if cleaned else tag
    return payload


