"""Quản lý nhân viên (admin)."""
import os
import logging
import re

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from core_project.pagination import StandardResultsSetPagination
from django.db.models import Q
from django.contrib.auth import get_user_model
from django.conf import settings

from ..models import log_action
from ..serializers import AdminEmployeeSerializer

User = get_user_model()
logger = logging.getLogger(__name__)

ROLE_MATRIX_FILE = os.path.join(settings.BASE_DIR, 'role_matrix.json')
from .permissions import IsEmployeeManagementPermission
from .role_matrix import get_all_roles_matrix


# =========================================================================
# PHÂN HỆ QUẢN TRỊ ADMIN: QUẢN LÝ NHÂN SỰ & PHÂN QUYỀN VAI TRÒ
# =========================================================================

class AdminEmployeeListCreateView(APIView):
    permission_classes = [IsEmployeeManagementPermission]
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        queryset = User.objects.exclude(role='guest').select_related('employee_profile').order_by('-id')

        # Tìm kiếm theo từ khóa
        q = request.query_params.get('q', '').strip()
        if q:
            clean_q = re.sub(r'[\s\-\.]', '', q)
            search_filter = (
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q) |
                Q(username__icontains=q) |
                Q(email__icontains=q) |
                Q(employee_profile__employee_code__icontains=q) |
                Q(employee_profile__position__icontains=q)
            )
            if clean_q:
                search_filter |= Q(phone_number__icontains=clean_q)
            queryset = queryset.filter(search_filter)

        # Lọc theo vai trò
        role = request.query_params.get('role')
        if role and role != 'all':
            queryset = queryset.filter(role=role)

        # Lọc theo phòng ban
        department = request.query_params.get('department')
        if department and department != 'all':
            queryset = queryset.filter(employee_profile__department=department)

        # Lọc theo trạng thái
        is_active = request.query_params.get('is_active')
        if is_active is not None and is_active != 'all':
            is_active_bool = is_active.lower() in ['true', '1']
            queryset = queryset.filter(is_active=is_active_bool)

        all_employees = User.objects.exclude(role='guest')
        stats = {
            'total': all_employees.count(),
            'active': all_employees.filter(is_active=True).count(),
            'inactive': all_employees.filter(is_active=False).count(),
            'management': all_employees.filter(role__in=['admin', 'owner', 'manager']).count(),
            'operations': all_employees.exclude(role__in=['admin', 'owner', 'manager']).count(),
        }

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        if page is not None:
            serializer = AdminEmployeeSerializer(page, many=True, context={'request': request})
            return Response({
                'success': True,
                'count': paginator.page.paginator.count,
                'total_pages': paginator.page.paginator.num_pages,
                'current_page': paginator.page.number,
                'page_size': paginator.get_page_size(request),
                'next': paginator.get_next_link(),
                'previous': paginator.get_previous_link(),
                'results': serializer.data,
                'employees': serializer.data,
                'roles': get_all_roles_matrix(),
                'stats': stats,
            }, status=status.HTTP_200_OK)

        serializer = AdminEmployeeSerializer(queryset, many=True, context={'request': request})
        return Response({
            'success': True,
            'count': queryset.count(),
            'results': serializer.data,
            'employees': serializer.data,
            'roles': get_all_roles_matrix(),
            'stats': stats,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        requester_role = getattr(request.user, 'role', '')
        if requester_role == 'manager':
            new_role = request.data.get('role')
            if new_role in ['admin', 'owner', 'manager']:
                return Response({
                    'success': False,
                    'message': 'Quản lý không có quyền tạo tài khoản với vai trò Chủ khách sạn, Quản trị viên hoặc Quản lý.'
                }, status=status.HTTP_403_FORBIDDEN)

        serializer = AdminEmployeeSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            employee = serializer.save()

            log_action(
                user=request.user,
                action='CREATE',
                module='USER',
                description=f"Tạo mới tài khoản nhân viên {employee.username} ({employee.get_role_display()})",
                request=request
            )

            return Response({
                'success': True,
                'message': 'Tạo tài khoản nhân viên mới thành công!',
                'employee': AdminEmployeeSerializer(employee, context={'request': request}).data
            }, status=status.HTTP_201_CREATED)

        first_error = next(iter(serializer.errors.values()))
        error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
        return Response({
            'success': False,
            'message': error_msg,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class AdminEmployeeDetailView(APIView):
    permission_classes = [IsEmployeeManagementPermission]

    def get(self, request, pk):
        try:
            employee = User.objects.exclude(role='guest').select_related('employee_profile').get(pk=pk)
        except User.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy thông tin nhân viên.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminEmployeeSerializer(employee, context={'request': request})
        return Response({'success': True, 'employee': serializer.data}, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        try:
            employee = User.objects.exclude(role='guest').select_related('employee_profile').get(pk=pk)
        except User.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy thông tin nhân viên.'}, status=status.HTTP_404_NOT_FOUND)

        # Thẩm quyền: Manager không được chỉnh sửa Admin hoặc Owner
        requester_role = getattr(request.user, 'role', '')
        if requester_role == 'manager':
            if employee.role in ['admin', 'owner']:
                return Response({
                    'success': False,
                    'message': 'Quản lý không có quyền chỉnh sửa hồ sơ hoặc phân quyền của Chủ khách sạn và Quản trị viên.'
                }, status=status.HTTP_403_FORBIDDEN)
            new_role = request.data.get('role')
            if new_role and new_role in ['admin', 'owner', 'manager'] and new_role != employee.role:
                return Response({
                    'success': False,
                    'message': 'Quản lý không có quyền cấp quyền Chủ khách sạn, Quản trị viên hoặc thăng chức Quản lý.'
                }, status=status.HTTP_403_FORBIDDEN)

        serializer = AdminEmployeeSerializer(employee, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated_emp = serializer.save()

            log_action(
                user=request.user,
                action='UPDATE',
                module='USER',
                description=f"Cập nhật thông tin/phân quyền nhân viên {updated_emp.username} ({updated_emp.get_role_display()})",
                request=request
            )

            return Response({
                'success': True,
                'message': 'Cập nhật thông tin nhân viên & phân quyền thành công!',
                'employee': AdminEmployeeSerializer(updated_emp, context={'request': request}).data
            }, status=status.HTTP_200_OK)

        first_error = next(iter(serializer.errors.values()))
        error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
        return Response({
            'success': False,
            'message': error_msg,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        try:
            employee = User.objects.exclude(role='guest').get(pk=pk)
            # Ngăn admin tự xóa chính mình
            if employee.id == request.user.id:
                return Response({'success': False, 'message': 'Không thể xóa tài khoản quản trị đang đăng nhập hiện tại.'}, status=status.HTTP_400_BAD_REQUEST)

            # Thẩm quyền: Manager không được xóa Admin, Owner hoặc Manager khác
            requester_role = getattr(request.user, 'role', '')
            if requester_role == 'manager' and employee.role in ['admin', 'owner', 'manager']:
                return Response({
                    'success': False,
                    'message': 'Quản lý không có quyền xóa tài khoản của Chủ khách sạn, Quản trị viên hoặc cấp Quản lý khác.'
                }, status=status.HTTP_403_FORBIDDEN)

            emp_username = employee.username
            emp_role = employee.get_role_display()
            employee.delete()

            log_action(
                user=request.user,
                action='DELETE',
                module='USER',
                description=f"Xóa tài khoản nhân viên {emp_username} ({emp_role})",
                request=request
            )

            return Response({'success': True, 'message': 'Đã xóa tài khoản nhân viên thành công.'}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy nhân viên cần xóa.'}, status=status.HTTP_404_NOT_FOUND)
