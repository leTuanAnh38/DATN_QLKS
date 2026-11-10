"""Package group_views. Re-export để giữ nguyên `from .group_views import ...`."""
from .corporate_views import ValidateCorporateCodeView, CorporatePartnerViewSet
from .group_booking_viewset import GroupBookingViewSet

__all__ = [
    "ValidateCorporateCodeView",
    "CorporatePartnerViewSet",
    "GroupBookingViewSet",
]
