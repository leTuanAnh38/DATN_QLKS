from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    LoginView,
    CurrentUserView,
    LogoutView,
    ChangePasswordView,
    AdminGuestListCreateView,
    AdminGuestDetailView,
    AdminEmployeeListCreateView,
    AdminEmployeeDetailView,
    AdminRoleListView
)

urlpatterns = [
    # Auth endpoints
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('me/', CurrentUserView.as_view(), name='auth-me'),
    path('change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),

    # Admin Management: Quản lý khách hàng
    path('admin/guests/', AdminGuestListCreateView.as_view(), name='admin-guest-list'),
    path('admin/guests/<int:pk>/', AdminGuestDetailView.as_view(), name='admin-guest-detail'),

    # Admin Management: Quản lý nhân sự & Phân quyền vai trò
    path('admin/employees/', AdminEmployeeListCreateView.as_view(), name='admin-employee-list'),
    path('admin/employees/<int:pk>/', AdminEmployeeDetailView.as_view(), name='admin-employee-detail'),
    path('admin/roles/', AdminRoleListView.as_view(), name='admin-role-list'),
]
