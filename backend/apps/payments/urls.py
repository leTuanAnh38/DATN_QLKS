from django.urls import path
from .views import (
    ConfirmPaymentView,
    PaymentListView,
    PaymentConfigView,
    PaymentStatusView,
    SepayWebhookView
)

urlpatterns = [
    path('', PaymentListView.as_view(), name='payment-list'),
    path('confirm/', ConfirmPaymentView.as_view(), name='payment-confirm'),
    path('config/', PaymentConfigView.as_view(), name='payment-config'),
    path('webhook/sepay/', SepayWebhookView.as_view(), name='sepay-webhook'),
    path('<str:booking_id>/status/', PaymentStatusView.as_view(), name='payment-status'),
]

