"""Permission classes cho users."""
import os
import logging

from rest_framework.permissions import BasePermission
from django.contrib.auth import get_user_model
from django.conf import settings


User = get_user_model()
logger = logging.getLogger(__name__)

ROLE_MATRIX_FILE = os.path.join(settings.BASE_DIR, 'role_matrix.json')
from .role_matrix import check_role_permission


class IsManagerOrAdmin(BasePermission):
    """
    Cho phép tài khoản có vai trò Quản lý / Quản trị viên (admin, owner, manager)
    truy cập phân hệ quản trị.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        allowed_roles = ['admin', 'owner', 'manager']
        return getattr(request.user, 'role', '') in allowed_roles


class IsOwnerOrAdminOnly(BasePermission):
    """
    Chỉ cho phép Chủ khách sạn (Owner) hoặc Quản trị viên (Admin / superuser)
    được xem và cấu hình Ma trận phân quyền vai trò (Role-Based Access Control Matrix).
    Quản lý (Manager) và nhân viên cấp dưới tuyệt đối không có quyền truy cập endpoint này.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        return getattr(request.user, 'role', '') in ['admin', 'owner']


class IsFrontDeskOrManager(BasePermission):
    """
    Cho phép Lễ tân, Quản lý, Chủ, Admin hoặc nhân viên đã được phân quyền
    xem, tạo hoặc cập nhật hồ sơ khách hàng.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True

        action_map = {
            'GET': 'read',
            'HEAD': 'read',
            'OPTIONS': 'read',
            'POST': 'create',
            'PUT': 'update',
            'PATCH': 'update',
            'DELETE': 'delete'
        }
        action = action_map.get(request.method, 'read')
        return check_role_permission(request.user, 'guests', action)


class IsEmployeeManagementPermission(BasePermission):
    """
    Kiểm tra phân quyền động theo ma trận quyền cho phân hệ Nhân sự (employees).
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True

        action_map = {
            'GET': 'read',
            'HEAD': 'read',
            'OPTIONS': 'read',
            'POST': 'create',
            'PUT': 'update',
            'PATCH': 'update',
            'DELETE': 'delete'
        }
        action = action_map.get(request.method, 'read')

        # Cho phép nhân sự nội bộ (Thu ngân, Lễ tân, Quản lý) đọc danh sách nhân sự để phục vụ bàn giao ca & điều phối
        if action == 'read' and getattr(request.user, 'role', '') in ['cashier', 'receptionist', 'manager']:
            return True

        return check_role_permission(request.user, 'employees', action)
