from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RoomCategoryViewSet,
    AmenityViewSet,
    MaintenanceTicketViewSet,
    MinibarItemViewSet,
    MinibarCheckViewSet,
    LostAndFoundViewSet,
    AdminRoomListCreateView,
    AdminRoomDetailView,
    AdminRoomStatusUpdateView,
    AdminRoomRequestCleaningView,
    AdminRoomCompleteCleaningView
)

router = DefaultRouter()
router.register(r'categories', RoomCategoryViewSet, basename='room-category')
router.register(r'amenities', AmenityViewSet, basename='amenity')
router.register(r'maintenance-tickets', MaintenanceTicketViewSet, basename='maintenance-ticket')
router.register(r'minibar-items', MinibarItemViewSet, basename='minibar-item')
router.register(r'minibar-checks', MinibarCheckViewSet, basename='minibar-check')
router.register(r'lost-and-found', LostAndFoundViewSet, basename='lost-and-found')

urlpatterns = [
    # Router cho Hạng phòng: CRUD, upload-images, delete-image, set-feature-image
    path('', include(router.urls)),

    # Sơ đồ phòng & Tạo phòng mới
    path('admin/rooms/', AdminRoomListCreateView.as_view(), name='admin-room-list-create'),

    # Chi tiết, Sửa, Xóa phòng
    path('admin/rooms/<int:pk>/', AdminRoomDetailView.as_view(), name='admin-room-detail'),

    # Nút bấm đổi nhanh trạng thái phòng (available, occupied, cleaning, maintenance)
    path('admin/rooms/<int:pk>/status/', AdminRoomStatusUpdateView.as_view(), name='admin-room-status-update'),

    # Yêu cầu dọn phòng lưu trú (Make-up room) và Xác nhận hoàn tất dọn dẹp
    path('admin/rooms/<int:pk>/request-cleaning/', AdminRoomRequestCleaningView.as_view(), name='admin-room-request-cleaning'),
    path('admin/rooms/<int:pk>/complete-cleaning/', AdminRoomCompleteCleaningView.as_view(), name='admin-room-complete-cleaning'),
]
