from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RoomCategoryViewSet,
    AmenityViewSet,
    AdminRoomListCreateView,
    AdminRoomDetailView,
    AdminRoomStatusUpdateView
)

router = DefaultRouter()
router.register(r'categories', RoomCategoryViewSet, basename='room-category')
router.register(r'amenities', AmenityViewSet, basename='amenity')

urlpatterns = [
    # Router cho Hạng phòng: CRUD, upload-images, delete-image, set-feature-image
    path('', include(router.urls)),

    # Sơ đồ phòng & Tạo phòng mới
    path('admin/rooms/', AdminRoomListCreateView.as_view(), name='admin-room-list-create'),

    # Chi tiết, Sửa, Xóa phòng
    path('admin/rooms/<int:pk>/', AdminRoomDetailView.as_view(), name='admin-room-detail'),

    # Nút bấm đổi nhanh trạng thái phòng (available, occupied, cleaning, maintenance)
    path('admin/rooms/<int:pk>/status/', AdminRoomStatusUpdateView.as_view(), name='admin-room-status-update'),
]
