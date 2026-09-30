from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ServiceCategoryListView,
    ServiceItemViewSet,
    ActiveGuestBookingsView,
    ServiceRequestViewSet,
)

router = DefaultRouter()
router.register(r'items', ServiceItemViewSet, basename='service-item')
router.register(r'requests', ServiceRequestViewSet, basename='service-request')

urlpatterns = [
    path('categories/', ServiceCategoryListView.as_view(), name='service-categories'),
    path('my-active-bookings/', ActiveGuestBookingsView.as_view(), name='service-active-bookings'),
    path('', include(router.urls)),
]
