"""Package views của bookings. Re-export để giữ nguyên `from .views import ...`."""
from .helpers import _resolve_or_create_booking_guest_user
from .permissions import IsManagerOrAdminOnly
from .booking_viewset import BookingViewSet
from .promotion_views import ValidatePromoCodeView, PromotionViewSet
from .hotel_setting_views import HotelSettingView

__all__ = [
    "BookingViewSet",
    "ValidatePromoCodeView",
    "PromotionViewSet",
    "HotelSettingView",
    "IsManagerOrAdminOnly",
    "_resolve_or_create_booking_guest_user",
]
