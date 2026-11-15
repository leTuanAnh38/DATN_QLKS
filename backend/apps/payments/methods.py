"""Shared payment method normalization helpers across Payment and Invoice flows."""


def normalize_payment_method_code(raw_method):
    """Chuẩn hóa mã phương thức thanh toán cho bảng Payment: 'TRANSFER' | 'CREDIT_CARD' | 'CASH'."""
    raw = str(raw_method or '').strip().lower()
    if raw in ('credit_card', 'card', 'pos', 'the_tin_dung', 'thẻ tín dụng'):
        return 'CREDIT_CARD'
    if raw in ('bank_transfer', 'transfer', 'vietqr', 'momo', 'zalopay'):
        return 'TRANSFER'
    return 'CASH'


def normalize_invoice_payment_method(raw_method):
    """Chuẩn hóa mã phương thức từ Payment/API sang Invoice.METHOD_CHOICES."""
    m = str(raw_method or 'TRANSFER').strip().upper()
    if m == 'CASH':
        return 'cash'
    if m in ('CARD', 'CREDIT_CARD', 'POS'):
        return 'credit_card'
    if m in ('MOMO', 'ZALOPAY'):
        return 'momo'
    if m == 'MIXED':
        return 'mixed'
    return 'bank_transfer'


_CHANNEL_LABELS = {
    'CASH': 'Tiền mặt',
    'TRANSFER': 'VietQR',
    'CREDIT_CARD': 'Quẹt thẻ POS',
    'MOMO': 'Ví MoMo',
}


def canonical_payment_channel(raw_method):
    """Đưa chuỗi phương thức bất kỳ về kênh chuẩn ('CASH' | 'TRANSFER' | 'CREDIT_CARD' | 'MOMO' | '')."""
    m = str(raw_method or '').strip().lower()
    if not m:
        return ''
    if m in ('cash', 'tiền mặt', 'tien_mat', 'reception', 'tai_quay', 'tại quầy', 'tại lễ tân'):
        return 'CASH'
    if m in ('credit_card', 'card', 'pos', 'the_tin_dung', 'thẻ tín dụng'):
        return 'CREDIT_CARD'
    if m in ('momo', 'zalopay'):
        return 'MOMO'
    if m in ('transfer', 'bank_transfer', 'vietqr', 'chuyen_khoan', 'chuyển khoản', 'qr'):
        return 'TRANSFER'
    return m.upper()


def format_payment_methods_display(payments_iterable, resolved_method=None):
    """Trả về nhãn hiển thị động cho đơn/hóa đơn từ danh sách Payment thực tế (vd: 'Hỗn hợp (Tiền mặt & Quẹt thẻ POS)')."""
    completed = sorted(
        (p for p in (payments_iterable or []) if getattr(p, 'payment_status', None) == 'COMPLETED'),
        key=lambda p: p.created_at.timestamp() if getattr(p, 'created_at', None) else 0,
    )
    ordered_labels = []
    seen = set()
    for p in completed:
        ch = canonical_payment_channel(getattr(p, 'payment_method', None))
        if ch and ch not in seen:
            seen.add(ch)
            ordered_labels.append(_CHANNEL_LABELS.get(ch, ch))

    if len(ordered_labels) > 1:
        return f"Hỗn hợp ({' & '.join(ordered_labels)})"
    if len(ordered_labels) == 1:
        return ordered_labels[0]

    code = str(resolved_method or '').strip().upper()
    if code == 'MIXED':
        return 'Thanh toán hỗn hợp'
    if code in _CHANNEL_LABELS:
        return _CHANNEL_LABELS[code]
    return 'Chưa xác định'

