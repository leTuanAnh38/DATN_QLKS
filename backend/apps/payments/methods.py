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

