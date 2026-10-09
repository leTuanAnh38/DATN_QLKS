import re

from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from core_project.pagination import StandardResultsSetPagination
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken
from django.db.models import Q
from django.contrib.auth import get_user_model

from rest_framework.exceptions import PermissionDenied
from .models import GuestProfile, EmployeeProfile, AuditLog, log_action
from .serializers import (
    UserSerializer,
    UserProfileSerializer,
    RegisterSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
    UpdateProfileSerializer,
    AdminGuestSerializer,
    AdminEmployeeSerializer,
    AuditLogSerializer
)

User = get_user_model()


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


class IsFrontDeskOrManager(BasePermission):
    """
    Cho phép Lễ tân, Quản lý, Chủ và Admin xem, tạo hoặc cập nhật hồ sơ khách hàng.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        allowed_roles = ['admin', 'owner', 'manager', 'receptionist']
        return getattr(request.user, 'role', '') in allowed_roles


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)

            return Response({
                'success': True,
                'message': 'Đăng ký tài khoản thành công! Chào mừng Quý khách đến với Khách Sạn TA.',
                'user': UserSerializer(user, context={'request': request}).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            }, status=status.HTTP_201_CREATED)

        first_error = next(iter(serializer.errors.values()))
        error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
        return Response({
            'success': False,
            'message': error_msg,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            refresh = RefreshToken.for_user(user)

            log_action(
                user=user,
                action='LOGIN',
                module='USER',
                description=f"Tài khoản {user.username} ({user.get_role_display()}) đăng nhập thành công",
                request=request
            )

            return Response({
                'success': True,
                'message': f'Đăng nhập thành công! Kính chào Quý khách {user.first_name} {user.last_name}'.strip(),
                'user': UserSerializer(user, context={'request': request}).data,
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            }, status=status.HTTP_200_OK)

        first_error = next(iter(serializer.errors.values()))
        error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
        return Response({
            'success': False,
            'message': error_msg,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class CurrentUserView(APIView):
    """
    API endpoint dành riêng cho user đang đăng nhập: GET & PATCH /api/users/me/
    - GET: Trả về thông tin hồ sơ chi tiết (first_name, last_name, email, role, department, employee_code, avatar...)
    - PATCH / PUT: Cập nhật thông tin cá nhân (first_name, last_name, phone_number, avatar, address)
    - MultiPartParser và FormParser: Xử lý upload file ảnh avatar
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        serializer = UserProfileSerializer(request.user, context={'request': request})
        return Response({
            'success': True,
            'user': serializer.data
        }, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = UserProfileSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        if serializer.is_valid():
            user = serializer.save()

            # Đảm bảo guest_profile được đồng bộ nếu có trong request.data
            id_card = request.data.get('id_card_number')
            if id_card is None:
                id_card = request.data.get('identity_card')
            prefs = request.data.get('preferences')
            if id_card is not None or prefs is not None:
                profile, _ = GuestProfile.objects.get_or_create(user=user)
                if id_card is not None:
                    profile.id_card_number = str(id_card).strip()
                if prefs is not None:
                    profile.preferences = str(prefs).strip()
                profile.save()
                user.guest_profile = profile

            return Response({
                'success': True,
                'message': 'Cập nhật thông tin hồ sơ thành công!',
                'user': UserProfileSerializer(user, context={'request': request}).data
            }, status=status.HTTP_200_OK)

        first_error = next(iter(serializer.errors.values()))
        error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
        return Response({
            'success': False,
            'message': error_msg,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request):
        return self.patch(request)



class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except Exception:
            # Nếu blacklist không cấu hình hoặc token hết hạn thì vẫn cho logout phía client
            pass

        if request.user and request.user.is_authenticated:
            log_action(
                user=request.user,
                action='LOGOUT',
                module='USER',
                description=f"Tài khoản {request.user.username} ({request.user.get_role_display()}) đăng xuất khỏi hệ thống",
                request=request
            )

        return Response({
            'success': True,
            'message': 'Đăng xuất tài khoản thành công.'
        }, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)

            log_action(
                user=user,
                action='UPDATE',
                module='USER',
                description=f"Đổi mật khẩu tài khoản {user.username}",
                request=request
            )

            return Response({
                'success': True,
                'message': 'Đổi mật khẩu thành công! Mật khẩu mới đã được lưu an toàn.',
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            }, status=status.HTTP_200_OK)

        first_error = next(iter(serializer.errors.values()))
        error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
        return Response({
            'success': False,
            'message': error_msg,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


# =========================================================================
# PHÂN HỆ QUẢN TRỊ ADMIN: QUẢN LÝ KHÁCH HÀNG
# =========================================================================

class AdminGuestListCreateView(APIView):
    permission_classes = [IsFrontDeskOrManager]
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        queryset = User.objects.filter(role='guest').select_related('guest_profile').order_by('-date_joined')

        # Tìm kiếm theo từ khóa
        q = request.query_params.get('q', '').strip()
        if q:
            clean_q = re.sub(r'[\s\-\.]', '', q)
            search_filter = (
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q) |
                Q(username__icontains=q) |
                Q(email__icontains=q) |
                Q(guest_profile__id_card_number__icontains=q)
            )
            if clean_q:
                search_filter |= Q(phone_number__icontains=clean_q)
            queryset = queryset.filter(search_filter)

        # Lọc theo hạng thành viên VIP
        vip_tier = request.query_params.get('vip_tier')
        if vip_tier and vip_tier != 'all':
            queryset = queryset.filter(guest_profile__vip_tier=vip_tier)

        # Lọc theo trạng thái hoạt động
        is_active = request.query_params.get('is_active')
        if is_active is not None and is_active != 'all':
            is_active_bool = is_active.lower() in ['true', '1']
            queryset = queryset.filter(is_active=is_active_bool)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        if page is not None:
            serializer = AdminGuestSerializer(page, many=True, context={'request': request})
            return Response({
                'success': True,
                'count': paginator.page.paginator.count,
                'total_pages': paginator.page.paginator.num_pages,
                'current_page': paginator.page.number,
                'page_size': paginator.get_page_size(request),
                'next': paginator.get_next_link(),
                'previous': paginator.get_previous_link(),
                'results': serializer.data,
                'guests': serializer.data
            }, status=status.HTTP_200_OK)

        serializer = AdminGuestSerializer(queryset, many=True, context={'request': request})
        return Response({
            'success': True,
            'count': queryset.count(),
            'results': serializer.data,
            'guests': serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # Cập nhật thêm nếu có CCCD, VIP tier từ form admin
            profile = getattr(user, 'guest_profile', None)
            if profile:
                if 'vip_tier' in request.data:
                    profile.vip_tier = request.data['vip_tier']
                if 'id_card_number' in request.data:
                    profile.id_card_number = request.data['id_card_number']
                if 'loyalty_points' in request.data:
                    profile.loyalty_points = int(request.data.get('loyalty_points', 0))
                profile.save()

            log_action(
                user=request.user,
                action='CREATE',
                module='USER',
                description=f"Tạo hồ sơ khách hàng mới {user.username} ({user.get_full_name() or user.email})",
                request=request
            )

            return Response({
                'success': True,
                'message': 'Tạo tài khoản khách hàng mới thành công!',
                'guest': AdminGuestSerializer(user, context={'request': request}).data
            }, status=status.HTTP_201_CREATED)

        first_error = next(iter(serializer.errors.values()))
        error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
        return Response({
            'success': False,
            'message': error_msg,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class AdminGuestDetailView(APIView):
    permission_classes = [IsFrontDeskOrManager]

    def get(self, request, pk):
        try:
            guest = User.objects.select_related('guest_profile').get(pk=pk)
        except User.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy thông tin khách hàng.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminGuestSerializer(guest, context={'request': request})
        data = dict(serializer.data)

        # Trích xuất CCCD nếu có từ guest_profile hoặc đơn đặt phòng
        id_card = ''
        if hasattr(guest, 'guest_profile') and guest.guest_profile and guest.guest_profile.id_card_number:
            id_card = guest.guest_profile.id_card_number
        else:
            try:
                from ..bookings.models import Booking
                latest_bk = Booking.objects.filter(guest=guest).exclude(identity_card='').order_by('-created_at').first()
                if latest_bk:
                    id_card = latest_bk.identity_card
            except Exception:
                pass
        data['id_card_number'] = id_card

        return Response({
            'success': True,
            'guest': data,
            'user': data,
            'customer': data,
            **data
        }, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        try:
            guest = User.objects.select_related('guest_profile').get(pk=pk, role='guest')
        except User.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy thông tin khách hàng.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminGuestSerializer(guest, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated_guest = serializer.save()

            log_action(
                user=request.user,
                action='UPDATE',
                module='USER',
                description=f"Cập nhật hồ sơ khách hàng {updated_guest.username}",
                request=request
            )

            return Response({
                'success': True,
                'message': 'Cập nhật thông tin khách hàng thành công!',
                'guest': AdminGuestSerializer(updated_guest, context={'request': request}).data
            }, status=status.HTTP_200_OK)

        first_error = next(iter(serializer.errors.values()))
        error_msg = first_error[0] if isinstance(first_error, list) else str(first_error)
        return Response({
            'success': False,
            'message': error_msg,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not (request.user.is_superuser or getattr(request.user, 'role', '') in ['admin', 'owner', 'manager']):
            return Response({
                'success': False,
                'message': 'Chỉ Quản lý hoặc Quản trị viên mới có quyền xóa tài khoản khách hàng.'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            guest = User.objects.get(pk=pk, role='guest')
            guest_uname = guest.username
            guest.delete()

            log_action(
                user=request.user,
                action='DELETE',
                module='USER',
                description=f"Xóa tài khoản khách hàng {guest_uname}",
                request=request
            )

            return Response({'success': True, 'message': 'Đã xóa tài khoản khách hàng thành công.'}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy khách hàng cần xóa.'}, status=status.HTTP_404_NOT_FOUND)


# =========================================================================
# PHÂN HỆ QUẢN TRỊ ADMIN: QUẢN LÝ NHÂN SỰ & PHÂN QUYỀN VAI TRÒ
# =========================================================================

class AdminEmployeeListCreateView(APIView):
    permission_classes = [IsManagerOrAdmin]
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
                'roles': get_all_roles_matrix()
            }, status=status.HTTP_200_OK)

        serializer = AdminEmployeeSerializer(queryset, many=True, context={'request': request})
        return Response({
            'success': True,
            'count': queryset.count(),
            'results': serializer.data,
            'employees': serializer.data,
            'roles': get_all_roles_matrix()
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
    permission_classes = [IsManagerOrAdmin]

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


# =========================================================================
# DANH MỤC VAI TRÒ & CHI TIẾT MA TRẬN PHÂN QUYỀN RBAC CHUẨN KHÁCH SẠN
# =========================================================================

def get_all_roles_matrix():
    return [
        {
            'role': 'admin',
            'title': 'Admin Hệ Thống',
            'level': 'Toàn quyền',
            'badge_color': 'purple',
            'icon': '👑',
            'description': 'Quản trị tối cao toàn bộ hệ thống, phân quyền người dùng, cấu hình khách sạn và cơ sở dữ liệu.',
            'scope': 'Cấp quyền, tạo nhân sự, quản lý dữ liệu, kiểm toán hệ thống',
            'permissions': {
                'rooms': 'Toàn quyền cấu hình',
                'bookings': 'Toàn quyền duyệt/hủy',
                'guests': 'Toàn quyền xem/sửa',
                'employees': 'Toàn quyền phân quyền',
                'finance': 'Toàn quyền doanh thu',
                'settings': 'Cấu hình hệ thống',
            }
        },
        {
            'role': 'owner',
            'title': 'Chủ Khách Sạn (Owner)',
            'level': 'Toàn quyền',
            'badge_color': 'amber',
            'icon': '💼',
            'description': 'Sở hữu khách sạn, quản lý toàn diện kinh doanh, nhân sự, tài chính, công suất phòng và chiến lược giá.',
            'scope': 'Toàn quyền vận hành, doanh thu, nhân sự và báo cáo',
            'permissions': {
                'rooms': 'Toàn quyền cấu hình',
                'bookings': 'Toàn quyền quản lý',
                'guests': 'Toàn quyền quản lý',
                'employees': 'Toàn quyền nhân sự',
                'finance': 'Toàn quyền tài chính',
                'settings': 'Toàn quyền cấu hình',
            }
        },
        {
            'role': 'manager',
            'title': 'Quản Lý Khách Sạn (Manager)',
            'level': 'Điều hành',
            'badge_color': 'blue',
            'icon': '👔',
            'description': 'Điều hành vận hành thường nhật: duyệt đặt phòng, phân công ca làm nhân viên, quản lý chất lượng dịch vụ.',
            'scope': 'Điều phối nhân sự, duyệt phòng, giải quyết sự vụ',
            'permissions': {
                'rooms': 'Toàn quyền điều phối',
                'bookings': 'Toàn quyền duyệt/đổi',
                'guests': 'Toàn quyền quản lý',
                'employees': 'Phân ca & Chấm công',
                'finance': 'Xem & Xuất hóa đơn',
                'reports': 'Xem báo cáo doanh thu',
                'settings': 'Xem cấu hình',
            }
        },
        {
            'role': 'receptionist',
            'title': 'Lễ Tân (Front Desk)',
            'level': 'Tiếp đón',
            'badge_color': 'emerald',
            'icon': '🛎️',
            'description': 'Check-in, check-out, gán phòng, tiếp nhận đặt phòng trực tiếp tại quầy, hỗ trợ yêu cầu khách lưu trú.',
            'scope': 'Thủ tục phòng, tra cứu khách, gán chìa khóa phòng',
            'permissions': {
                'rooms': 'Xem & Gán phòng',
                'bookings': 'Tạo & Check-in/out',
                'guests': 'Xem & Cập nhật nhanh',
                'employees': 'Chỉ xem ca trực',
                'finance': 'Thu cọc & Tiền phòng',
                'settings': 'Không có quyền',
            }
        },
        {
            'role': 'cashier',
            'title': 'Thu Ngân (Cashier)',
            'level': 'Tài chính',
            'badge_color': 'cyan',
            'icon': '💳',
            'description': 'Xác nhận thanh toán, quản lý hóa đơn VAT, thu tiền cọc và đối soát giao dịch thanh toán trực tuyến.',
            'scope': 'Thu chi, xuất hóa đơn VAT, kết ca thu ngân',
            'permissions': {
                'rooms': 'Xem bảng giá phòng',
                'bookings': 'Xem trạng thái tiền',
                'guests': 'Xem hóa đơn khách',
                'employees': 'Không có quyền',
                'finance': 'Toàn quyền thu chi',
                'settings': 'Không có quyền',
            }
        },
        {
            'role': 'housekeeper',
            'title': 'Nhân Viên Buồng Phòng',
            'level': 'Vận hành buồng',
            'badge_color': 'orange',
            'icon': '🧹',
            'description': 'Cập nhật trạng thái vệ sinh phòng (Đang dọn, Đã khử khuẩn, Sẵn sàng đón khách), kiểm kê mini bar.',
            'scope': 'Trạng thái dọn phòng, báo vật tư, báo đồ thất lạc',
            'permissions': {
                'rooms': 'Cập nhật dọn phòng',
                'bookings': 'Xem giờ trả phòng',
                'guests': 'Không có quyền',
                'employees': 'Xem ca làm việc',
                'finance': 'Không có quyền',
                'settings': 'Không có quyền',
            }
        },
        {
            'role': 'service_staff',
            'title': 'Nhân Viên Phục Vụ (F&B / Spa)',
            'level': 'Dịch vụ',
            'badge_color': 'rose',
            'icon': '🍽️',
            'description': 'Tiếp nhận order ẩm thực tận phòng, phục vụ nhà hàng, dịch vụ spa thư giãn và đưa đón hành lý.',
            'scope': 'Order dịch vụ, giao đồ ăn phòng, phục vụ khách',
            'permissions': {
                'rooms': 'Xem số phòng order',
                'bookings': 'Không có quyền',
                'guests': 'Xem sở thích ăn uống',
                'employees': 'Xem ca làm việc',
                'finance': 'Ghi chi phí dịch vụ',
                'settings': 'Không có quyền',
            }
        },
        {
            'role': 'technician',
            'title': 'Kỹ Thuật Viên (Technician)',
            'level': 'Bảo trì',
            'badge_color': 'indigo',
            'icon': '🔧',
            'description': 'Bảo dưỡng và sửa chữa hệ thống cơ điện, điều hòa nhiệt độ, internet wifi, thang máy và thiết bị trong phòng.',
            'scope': 'Bảo trì trang thiết bị, sửa chữa kỹ thuật',
            'permissions': {
                'rooms': 'Báo trạng thái hỏng',
                'bookings': 'Không có quyền',
                'guests': 'Không có quyền',
                'employees': 'Xem ca làm việc',
                'finance': 'Không có quyền',
                'settings': 'Không có quyền',
            }
        }
    ]


class AdminRoleListView(APIView):
    permission_classes = [IsManagerOrAdmin]

    def get(self, request):
        roles_data = get_all_roles_matrix()
        return Response({'success': True, 'count': len(roles_data), 'roles': roles_data}, status=status.HTTP_200_OK)


class AdminRolePermissionsView(APIView):
    permission_classes = [IsManagerOrAdmin]

    def put(self, request, role):
        # 1. Admin hệ thống có quyền tối cao bất biến, không ai được phép chỉnh sửa để đảm bảo an toàn hệ thống
        if role == 'admin':
            return Response({
                'success': False,
                'message': 'Không được phép chỉnh sửa ma trận phân quyền của Quản trị viên tối cao (Admin Hệ Thống).'
            }, status=status.HTTP_403_FORBIDDEN)

        # 2. Quản lý (Manager) chỉ được sửa quyền cho nhân viên cấp dưới (không được sửa quyền Quản lý, Chủ khách sạn, Admin)
        requester_role = getattr(request.user, 'role', '')
        is_admin_or_super = request.user.is_superuser or requester_role == 'admin'

        if requester_role == 'manager' and role in ['manager', 'owner', 'admin']:
            return Response({
                'success': False,
                'message': 'Quản lý (Manager) chỉ có quyền điều chỉnh phân quyền cho nhân viên cấp dưới (Lễ tân, Thu ngân, Buồng phòng, Phục vụ, Kỹ thuật).'
            }, status=status.HTTP_403_FORBIDDEN)

        # 3. Phân quyền cho Chủ khách sạn (Owner) chỉ dành riêng cho Admin Hệ Thống
        if role == 'owner' and not is_admin_or_super:
            return Response({
                'success': False,
                'message': 'Chỉ Quản trị viên Hệ thống (Admin) mới có quyền điều chỉnh phân quyền cho Chủ Khách Sạn (Owner).'
            }, status=status.HTTP_403_FORBIDDEN)

        permissions = request.data.get('permissions', {})
        permission_codes = request.data.get('permission_codes', [])

        # 4. Quản lý (Manager) tuyệt đối không có quyền cấp phát hoặc thay đổi quyền phân hệ Cài đặt hệ thống (settings)
        if requester_role == 'manager':
            if isinstance(permissions, dict) and 'settings' in permissions:
                permissions['settings'] = {'read': False, 'create': False, 'update': False, 'delete': False}
            if isinstance(permission_codes, list):
                permission_codes = [code for code in permission_codes if not str(code).startswith('settings.')]

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


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet quản lý User có tích hợp StandardResultsSetPagination
    """
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [IsManagerOrAdmin]
    pagination_class = StandardResultsSetPagination


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


