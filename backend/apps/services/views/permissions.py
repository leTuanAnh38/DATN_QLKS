"""Permission classes cho services."""
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission

from ...users.views import check_role_permission


class IsManagerOrAdminOnly(BasePermission):
    """
    Kiểm tra phân quyền động theo ma trận quyền cho phân hệ Dịch vụ & Nhà hàng (services).
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
        return check_role_permission(request.user, 'services', action)
