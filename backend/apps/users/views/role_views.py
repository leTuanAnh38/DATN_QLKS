"""API vai trò và ma trận quyền."""
import os
import logging

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.conf import settings

from ..models import log_action

User = get_user_model()
logger = logging.getLogger(__name__)

ROLE_MATRIX_FILE = os.path.join(settings.BASE_DIR, 'role_matrix.json')
from .permissions import IsManagerOrAdmin, IsOwnerOrAdminOnly
from .role_matrix import get_all_roles_matrix, load_role_matrix, save_role_matrix


class AdminRoleListView(APIView):
    permission_classes = [IsManagerOrAdmin]

    def get(self, request):
        roles_data = get_all_roles_matrix()
        matrix = load_role_matrix()
        return Response({
            'success': True,
            'count': len(roles_data),
            'roles': roles_data,
            'matrix': matrix
        }, status=status.HTTP_200_OK)


class AdminRolePermissionsView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsManagerOrAdmin()]
        return [IsOwnerOrAdminOnly()]

    def get(self, request, role=None):
        matrix = load_role_matrix()
        if role:
            return Response({
                'success': True,
                'role': role,
                'permissions': matrix.get(role, {})
            }, status=status.HTTP_200_OK)
        return Response({
            'success': True,
            'matrix': matrix
        }, status=status.HTTP_200_OK)

    def put(self, request, role):
        # 1. Admin hệ thống có quyền tối cao bất biến, không ai được phép chỉnh sửa để đảm bảo an toàn hệ thống
        if role == 'admin':
            return Response({
                'success': False,
                'message': 'Không được phép chỉnh sửa ma trận phân quyền của Quản trị viên tối cao (Admin Hệ Thống).'
            }, status=status.HTTP_403_FORBIDDEN)

        # 2. Phân quyền cho Chủ khách sạn (Owner) chỉ dành riêng cho Admin Hệ Thống
        requester_role = getattr(request.user, 'role', '')
        is_admin_or_super = request.user.is_superuser or requester_role == 'admin'

        if role == 'owner' and not is_admin_or_super:
            return Response({
                'success': False,
                'message': 'Chỉ Quản trị viên Hệ thống (Admin) mới có quyền điều chỉnh phân quyền cho Chủ Khách Sạn (Owner).'
            }, status=status.HTTP_403_FORBIDDEN)

        permissions = request.data.get('permissions', {})
        permission_codes = request.data.get('permission_codes', [])

        # 3. Lưu bền vững vào file JSON cấu hình phân quyền hệ thống
        if isinstance(permissions, dict):
            matrix = load_role_matrix()
            matrix[role] = permissions
            save_role_matrix(matrix)

        # Ghi nhận Nhật ký thao tác hệ thống (Audit Log)
        log_action(
            user=request.user,
            action='UPDATE',
            module='SYSTEM',
            description=f"Cập nhật ma trận phân quyền cho vai trò {role.upper()}",
            request=request
        )

        return Response({
            'success': True,
            'message': f'Đã cập nhật cấu hình phân quyền cho vai trò {role} thành công!',
            'role': role,
            'permissions': permissions,
            'permission_codes': permission_codes
        }, status=status.HTTP_200_OK)
