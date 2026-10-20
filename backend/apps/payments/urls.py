from django.urls import path
from .views import (
    ConfirmPaymentView,
    ConfirmPaymentByIdView,
    PaymentListView,
    PaymentConfigView,
    PaymentStatusView,
    SepayWebhookView,
    CurrentShiftView,
    OpenShiftView,
    CloseShiftView,
    ShiftSummaryView,
    ShiftListView,
    ShiftReportView,
    CreateCashOutView,
    CashOutListView
)

urlpatterns = [
    path('', PaymentListView.as_view(), name='payment-list'),
    path('confirm/', ConfirmPaymentView.as_view(), name='payment-confirm'),
    path('<int:payment_id>/confirm/', ConfirmPaymentByIdView.as_view(), name='payment-confirm-by-id'),
    path('config/', PaymentConfigView.as_view(), name='payment-config'),
    path('webhook/sepay/', SepayWebhookView.as_view(), name='sepay-webhook'),
    path('<str:booking_id>/status/', PaymentStatusView.as_view(), name='payment-status'),

    # Shift Management & Z-Report
    path('shifts/current/', CurrentShiftView.as_view(), name='shift-current'),
    path('shifts/open/', OpenShiftView.as_view(), name='shift-open'),
    path('shifts/<int:pk>/close/', CloseShiftView.as_view(), name='shift-close'),
    path('shifts/<int:pk>/summary/', ShiftSummaryView.as_view(), name='shift-summary'),
    path('shifts/<int:pk>/report/', ShiftReportView.as_view(), name='shift-report'),
    path('shifts/', ShiftListView.as_view(), name='shift-list'),

    # Cash Out & Refund Vouchers (Phiếu chi tiền mặt & Hoàn tiền cọc)
    path('cash-outs/', CreateCashOutView.as_view(), name='cash-out-create'),
    path('cash-outs/list/', CashOutListView.as_view(), name='cash-out-list'),
]


