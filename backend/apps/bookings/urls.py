from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BookingViewSet, ValidatePromoCodeView, PromotionViewSet

router = DefaultRouter()
router.register(r'promotions', PromotionViewSet, basename='promotion')
router.register(r'', BookingViewSet, basename='booking')

urlpatterns = [
    path('validate-promo/', ValidatePromoCodeView.as_view(), name='validate-promo'),
    path('', include(router.urls)),
]
