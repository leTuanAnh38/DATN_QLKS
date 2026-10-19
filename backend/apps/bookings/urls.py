from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BookingViewSet, ValidatePromoCodeView, PromotionViewSet, HotelSettingView
from .group_views import GroupBookingViewSet, CorporatePartnerViewSet, ValidateCorporateCodeView
from .chatbot_views import ChatbotAskView

router = DefaultRouter()
router.register(r'promotions', PromotionViewSet, basename='promotion')
router.register(r'groups', GroupBookingViewSet, basename='group-booking')
router.register(r'corporate-partners', CorporatePartnerViewSet, basename='corporate-partner')
router.register(r'', BookingViewSet, basename='booking')

urlpatterns = [
    path('chatbot/ask/', ChatbotAskView.as_view(), name='bookings-chatbot-ask'),
    path('settings/', HotelSettingView.as_view(), name='hotel-settings'),
    path('validate-promo/', ValidatePromoCodeView.as_view(), name='validate-promo'),
    path('validate-corporate-code/', ValidateCorporateCodeView.as_view(), name='validate-corporate-code'),
    path('', include(router.urls)),
]
