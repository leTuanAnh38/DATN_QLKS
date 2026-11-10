"""Permission classes dùng chung cho rooms."""
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission
from ...users.views import check_role_permission



class IsHotelStaffOrAdmin(BasePermission):
    """
    Cho phép nhân viên khách sạn (Lễ tân, Buồng phòng, Quản lý, Admin)
    truy cập và thao tác trên sơ đồ phòng. Khách hàng thông thường (role='guest') bị chặn.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        # Mọi tài khoản nhân viên nội bộ (khác 'guest')
        return getattr(request.user, 'role', '') != 'guest'


class IsManagerOrAdminOnly(BasePermission):
    """
    Kiểm tra phân quyền động theo ma trận quyền cho Hạng phòng (categories).
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        action_map = {
            'GET': 'read',
            'POST': 'create',
            'PUT': 'update',
            'PATCH': 'update',
            'DELETE': 'delete'
        }
        action = action_map.get(request.method, 'read')
        return check_role_permission(request.user, 'categories', action)
