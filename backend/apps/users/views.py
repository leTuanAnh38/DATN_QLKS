import re

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken
from django.db.models import Q
from django.contrib.auth import get_user_model

from .models import GuestProfile, EmployeeProfile
from .serializers import (
    UserSerializer,
    UserProfileSerializer,
    RegisterSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
    UpdateProfileSerializer,
    AdminGuestSerializer,
    AdminEmployeeSerializer
)

User = get_user_model()


class IsManagerOrAdmin(BasePermission):
    """
    Cho phép tài khoản có vai trò Quản lý / Quản trị viên (admin, owner, manager hoặc is_staff)
    truy cập phân hệ quản trị.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        allowed_roles = ['admin', 'owner', 'manager']
        return request.user.role in allowed_roles or request.user.is_staff or request.user.is_superuser


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
    permission_classes = [IsManagerOrAdmin]

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

        serializer = AdminGuestSerializer(queryset, many=True, context={'request': request})
        return Response({
            'success': True,
            'count': queryset.count(),
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
    permission_classes = [IsManagerOrAdmin]

    def get(self, request, pk):
        try:
            guest = User.objects.select_related('guest_profile').get(pk=pk, role='guest')
        except User.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy thông tin khách hàng.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminGuestSerializer(guest, context={'request': request})
        return Response({'success': True, 'guest': serializer.data}, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        try:
            guest = User.objects.select_related('guest_profile').get(pk=pk, role='guest')
        except User.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy thông tin khách hàng.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminGuestSerializer(guest, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated_guest = serializer.save()
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
        try:
            guest = User.objects.get(pk=pk, role='guest')
            guest.delete()
            return Response({'success': True, 'message': 'Đã xóa tài khoản khách hàng thành công.'}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy khách hàng cần xóa.'}, status=status.HTTP_404_NOT_FOUND)


# =========================================================================
# PHÂN HỆ QUẢN TRỊ ADMIN: QUẢN LÝ NHÂN SỰ & PHÂN QUYỀN VAI TRÒ
# =========================================================================

class AdminEmployeeListCreateView(APIView):
    permission_classes = [IsManagerOrAdmin]

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

        serializer = AdminEmployeeSerializer(queryset, many=True, context={'request': request})
        return Response({
            'success': True,
            'count': queryset.count(),
            'employees': serializer.data,
            'roles': get_all_roles_matrix()
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = AdminEmployeeSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            employee = serializer.save()
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

        serializer = AdminEmployeeSerializer(employee, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated_emp = serializer.save()
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
            employee.delete()
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
            'level': 'Cấp cao',
            'badge_color': 'amber',
            'icon': '💼',
            'description': 'Giám sát hoạt động kinh doanh, xem báo cáo doanh thu tài chính, công suất phòng và chiến lược giá.',
            'scope': 'Báo cáo doanh thu, chiến lược phòng, giám sát nhân sự',
            'permissions': {
                'rooms': 'Xem & Đổi giá',
                'bookings': 'Xem chi tiết',
                'guests': 'Xem danh sách VIP',
                'employees': 'Xem báo cáo nhân sự',
                'finance': 'Toàn quyền tài chính',
                'settings': 'Xem cấu hình',
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
                'settings': 'Cấu hình dịch vụ',
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

