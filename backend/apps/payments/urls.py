from django.urls import path
from .views import ConfirmPaymentView, PaymentListView

urlpatterns = [
    path('', PaymentListView.as_view(), name='payment-list'),
    path('confirm/', ConfirmPaymentView.as_view(), name='payment-confirm'),
]
