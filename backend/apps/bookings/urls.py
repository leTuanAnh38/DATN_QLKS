from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BookingViewSet, ValidatePromoCodeView, PromotionViewSet
from .group_views import GroupBookingViewSet, CorporatePartnerViewSet, ValidateCorporateCodeView

router = DefaultRouter()
router.register(r'promotions', PromotionViewSet, basename='promotion')
router.register(r'groups', GroupBookingViewSet, basename='group-booking')
router.register(r'corporate-partners', CorporatePartnerViewSet, basename='corporate-partner')
router.register(r'', BookingViewSet, basename='booking')

urlpatterns = [
    path('validate-promo/', ValidatePromoCodeView.as_view(), name='validate-promo'),
    path('validate-corporate-code/', ValidateCorporateCodeView.as_view(), name='validate-corporate-code'),
    path('', include(router.urls)),
]
