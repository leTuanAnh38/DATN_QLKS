"""Permission classes cho payments."""
from rest_framework.permissions import BasePermission



class IsAdminOrOwnerUser(BasePermission):
    """
    Chỉ cho phép tài khoản có quyền Admin Hệ Thống hoặc Chủ Khách Sạn (Owner) truy cập để sửa đổi cấu hình tài khoản thụ hưởng ngân hàng.
    Quản lý (Manager) chỉ có quyền Xem (GET), không được phép sửa đổi (PUT / PATCH).
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        allowed_roles = ['admin', 'owner']
        return getattr(request.user, 'role', None) in allowed_roles
