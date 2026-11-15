"""Shared accounting helpers for net settled hotel revenue."""
from decimal import Decimal
from django.db.models import Sum
from django.db.models.functions import Coalesce
from .models import Invoice, CashOutVoucher


REFUND_VOUCHER_TYPES = ('REFUND_DEPOSIT', 'REFUND_CANCEL')


def get_net_revenue_summary(start_date=None, end_date=None):
    """
    Tính doanh thu thuần đã quyết toán trong khoảng thời gian [start_date, end_date]:
    - Nguồn hóa đơn: Invoice(status='paid'), lọc theo paid_at nếu có khoảng thời gian.
    - Trừ hoàn tiền: CashOutVoucher(REFUND_DEPOSIT, REFUND_CANCEL), lọc theo created_at.
    - Bảo toàn cân bằng: room_revenue + service_revenue == total_revenue (giảm giá và hoàn cọc được khấu trừ khỏi phần tiền phòng trước).
    """
    invoices_qs = Invoice.objects.filter(status='paid')
    refunds_qs = CashOutVoucher.objects.filter(voucher_type__in=REFUND_VOUCHER_TYPES)

    if start_date is not None and end_date is not None:
        invoices_qs = invoices_qs.filter(paid_at__gte=start_date, paid_at__lte=end_date)
        refunds_qs = refunds_qs.filter(created_at__gte=start_date, created_at__lte=end_date)

    inv_agg = invoices_qs.aggregate(
        total=Coalesce(Sum('total_amount'), Decimal(0)),
        room=Coalesce(Sum('room_charge'), Decimal(0)),
        service=Coalesce(Sum('service_charge'), Decimal(0)),
        discount=Coalesce(Sum('discount'), Decimal(0)),
    )
    refunds_total = float(
        refunds_qs.aggregate(total=Coalesce(Sum('amount'), Decimal(0)))['total']
    )

    gross_total = float(inv_agg['total'])
    gross_room = float(inv_agg['room'])
    gross_service = float(inv_agg['service'])
    discount_total = float(inv_agg['discount'])

    total_revenue = max(0.0, gross_total - refunds_total)
    service_revenue = min(gross_service, total_revenue)
    room_revenue = max(0.0, total_revenue - service_revenue)

    return {
        'invoices_qs': invoices_qs,
        'paid_invoices_count': invoices_qs.count(),
        'total_revenue': total_revenue,
        'room_revenue': room_revenue,
        'service_revenue': service_revenue,
        'gross_invoice_total': gross_total,
        'gross_room_revenue': gross_room,
        'gross_service_revenue': gross_service,
        'discount_total': discount_total,
        'refunds_total': refunds_total,
    }

