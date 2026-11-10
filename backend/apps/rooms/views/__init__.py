"""Package views của rooms. Re-export để giữ nguyên `from .views import ...`."""
from .helpers import generate_unique_slug
from .permissions import IsHotelStaffOrAdmin, IsManagerOrAdminOnly
from .category_views import RoomCategoryViewSet, AmenityViewSet, RoomCategoryListView
from .room_views import AdminRoomListCreateView, AdminRoomDetailView, AdminRoomStatusUpdateView, AdminRoomRequestCleaningView, AdminRoomCompleteCleaningView
from .maintenance_views import MaintenanceTicketViewSet
from .minibar_views import MinibarItemViewSet, MinibarCheckViewSet
from .lost_found_views import LostAndFoundViewSet

__all__ = [
    "generate_unique_slug",
    "IsHotelStaffOrAdmin",
    "IsManagerOrAdminOnly",
    "RoomCategoryViewSet",
    "AdminRoomListCreateView",
    "AdminRoomDetailView",
    "AdminRoomStatusUpdateView",
    "AdminRoomRequestCleaningView",
    "AdminRoomCompleteCleaningView",
    "AmenityViewSet",
    "MaintenanceTicketViewSet",
    "MinibarItemViewSet",
    "MinibarCheckViewSet",
    "LostAndFoundViewSet",
]
