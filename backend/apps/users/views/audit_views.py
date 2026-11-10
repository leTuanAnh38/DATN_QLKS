"""Nhật ký hoạt động (audit log)."""
import os
import logging

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from core_project.pagination import StandardResultsSetPagination
from django.db.models import Q
from django.contrib.auth import get_user_model
from django.conf import settings

from rest_framework.exceptions import PermissionDenied
from ..models import AuditLog
from ..serializers import AuditLogSerializer

User = get_user_model()
logger = logging.getLogger(__name__)

ROLE_MATRIX_FILE = os.path.join(settings.BASE_DIR, 'role_matrix.json')


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API Nhật ký thao tác hệ thống (Audit Log): GET /api/audit-logs/
    - ReadOnlyModelViewSet: Chỉ cho phép GET (list, retrieve), ngăn chặn hoàn toàn sửa/xóa log.
    - Logic Phân quyền theo cấp bậc (Separation of Duties):
        * ADMIN / Superuser: AuditLog.objects.all()
        * OWNER: Ẩn toàn bộ thao tác của Admin (exclude user__role='ADMIN')
        * MANAGER: Chỉ xem cấp dưới, ẩn thao tác của cả Admin và Owner (exclude user__role__in=['ADMIN', 'OWNER'])
        * Các role khác: Quăng lỗi 403 Forbidden
    - Hỗ trợ Query Params:
        * role: Lọc theo vai trò người thực hiện (admin, owner, receptionist, ...)
        * module: Lọc theo phân hệ (BOOKING, INVOICE, USER, ...)
        * action: Lọc theo hành động (CREATE, UPDATE, DELETE, ...)
        * search: Tìm kiếm theo họ tên, username hoặc chi tiết mô tả
    """
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            raise PermissionDenied("Yêu cầu xác thực tài khoản.")

        role = (getattr(user, 'role', '') or '').upper()

        if role == 'ADMIN' or user.is_superuser:
            queryset = AuditLog.objects.all()
        elif role == 'OWNER':
            # Ẩn thao tác của Admin
            queryset = AuditLog.objects.exclude(user__role__in=['admin', 'ADMIN'])
        elif role == 'MANAGER':
            # Chỉ trả về thao tác cấp dưới, ẩn thao tác của Admin và Owner
            queryset = AuditLog.objects.exclude(user__role__in=['admin', 'ADMIN', 'owner', 'OWNER'])
        else:
            raise PermissionDenied("Bạn không có quyền truy cập Nhật ký hệ thống.")

        queryset = queryset.select_related('user').order_by('-created_at')

        # Bộ lọc Query Params
        filter_role = self.request.query_params.get('role')
        if filter_role:
            r = filter_role.strip().lower()
            if role == 'MANAGER' and r in ['admin', 'owner']:
                return queryset.none()
            if role == 'OWNER' and r == 'admin':
                return queryset.none()
            queryset = queryset.filter(user__role__iexact=r)

        filter_module = self.request.query_params.get('module')
        if filter_module:
            queryset = queryset.filter(module__iexact=filter_module.strip())

        filter_action = self.request.query_params.get('action')
        if filter_action:
            queryset = queryset.filter(action__iexact=filter_action.strip())

        search_query = self.request.query_params.get('search')
        if search_query:
            q = search_query.strip()
            queryset = queryset.filter(
                Q(user__username__icontains=q) |
                Q(user__first_name__icontains=q) |
                Q(user__last_name__icontains=q) |
                Q(description__icontains=q)
            )

        return queryset
