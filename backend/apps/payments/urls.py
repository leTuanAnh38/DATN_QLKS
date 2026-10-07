from django.urls import path
from .views import ConfirmPaymentView, PaymentListView, PaymentConfigView

urlpatterns = [
    path('', PaymentListView.as_view(), name='payment-list'),
    path('confirm/', ConfirmPaymentView.as_view(), name='payment-confirm'),
    path('config/', PaymentConfigView.as_view(), name='payment-config'),
]

