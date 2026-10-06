"""
URL configuration for core_project project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from apps.services.views import ServiceRequestViewSet
from apps.posts.views import ImageUploadView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.users.urls')),
    path('api/users/', include('apps.users.urls')),
    path('api/rooms/', include('apps.rooms.urls')),
    path('api/bookings/', include('apps.bookings.urls')),
    path('api/services/', include('apps.services.urls')),
    path('api/service-requests/', ServiceRequestViewSet.as_view({'get': 'list', 'post': 'create'}), name='service-requests-direct'),
    path('api/service-requests/<int:pk>/', ServiceRequestViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='service-request-detail-direct'),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/reviews/', include('apps.reviews.urls')),
    path('api/posts/', include('apps.posts.urls')),
    path('api/contacts/', include('apps.contacts.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/upload-image/', ImageUploadView.as_view(), name='upload-image'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
