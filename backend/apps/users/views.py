import os
import json
import logging
import re
import secrets
from datetime import timedelta

from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, BasePermission
from core_project.pagination import StandardResultsSetPagination
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken
from django.db.models import Q
from django.contrib.auth import get_user_model
from django.conf import settings
from django.utils import timezone
from django.core.mail import send_mail

from rest_framework.exceptions import PermissionDenied
from .models import GuestProfile, EmployeeProfile, AuditLog, log_action, MembershipTier, PasswordResetOTP
from .serializers import (
    UserSerializer,
    UserProfileSerializer,
    RegisterSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
    ForgotPasswordSerializer,
    ResetPasswordConfirmSerializer,
    UpdateProfileSerializer,
    AdminGuestSerializer,
    AdminEmployeeSerializer,
    AuditLogSerializer
)

User = get_user_model()
logger = logging.getLogger(__name__)

ROLE_MATRIX_FILE = os.path.join(settings.BASE_DIR, 'role_matrix.json')


def load_role_matrix():
    if os.path.exists(ROLE_MATRIX_FILE):
        try:
            with open(ROLE_MATRIX_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Error loading role matrix: {e}")
    return {}


def save_role_matrix(matrix):
    try:
        with open(ROLE_MATRIX_FILE, 'w', encoding='utf-8') as f:
            json.dump(matrix, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving role matrix: {e}")


def check_role_permission(user, module, action='read'):
    if not (user and user.is_authenticated):
        return False
    if user.is_superuser or getattr(user, 'role', '') in ['admin', 'owner']:
        return True

    # Chuẩn hóa các alias hành động: 'view' -> 'read', 'edit' -> 'update'
    if action == 'view':
        action = 'read'
    elif action == 'edit':
        action = 'update'

    user_role = getattr(user, 'role', '')
    if not user_role or user_role == 'guest':
        return False

    # 1. Tra cứu ma trận phân quyền đã lưu động từ hệ thống
    matrix = load_role_matrix()
    if user_role in matrix and module in matrix[user_role]:
        mod_perms = matrix[user_role][module]
        if isinstance(mod_perms, dict) and action in mod_perms:
            return bool(mod_perms[action])

    # 2. Quy tắc mặc định (Default fallback) khi chưa cấu hình chi tiết
    DEFAULT_STAFF_PERMS = {
        'manager': {'*': {'read': True, 'create': True, 'update': True, 'delete': False}},
        'receptionist': {
            'guests': {'read': True, 'create': True, 'update': True, 'delete': False},
            'bookings': {'read': True, 'create': True, 'update': True, 'delete': False},
            'rooms': {'read': True, 'create': False, 'update': True, 'delete': False},
        },
        'cashier': {
            'overview': {'read': True, 'create': False, 'update': False, 'delete': False},
            'rooms': {'read': True, 'create': False, 'update': False, 'delete': False},
            'categories': {'read': True, 'create': False, 'update': False, 'delete': False},
            'bookings': {'read': True, 'create': False, 'update': False, 'delete': False},
            'guests': {'read': True, 'create': False, 'update': False, 'delete': False},
            'services': {'read': True, 'create': False, 'update': False, 'delete': False},
            'finance': {'read': True, 'create': True, 'update': True, 'delete': False},
            'reports': {'read': True, 'create': False, 'update': False, 'delete': False},
        },
        'housekeeper': {
            'guests': {'read': True, 'create': False, 'update': False, 'delete': False},
            'rooms': {'read': True, 'create': False, 'update': True, 'delete': False},
            'bookings': {'read': True, 'create': False, 'update': False, 'delete': False},
        },
        'service_staff': {
            'guests': {'read': True, 'create': False, 'update': False, 'delete': False},
            'services': {'read': True, 'create': True, 'update': True, 'delete': False},
        },
        'technician': {
            'guests': {'read': True, 'create': False, 'update': False, 'delete': False},
            'rooms': {'read': True, 'create': False, 'update': True, 'delete': False},
        },
    }

    role_rules = DEFAULT_STAFF_PERMS.get(user_role, {})
    if '*' in role_rules:
        return bool(role_rules['*'].get(action, False))
    if module in role_rules:
        return bool(role_rules[module].get(action, False))

    # Mặc định cho phép nhân sự nội bộ xem (read) thông tin khách hàng phục vụ vận hành
    if action == 'read' and user_role in ['cashier', 'housekeeper', 'service_staff', 'technician', 'receptionist', 'manager']:
        return True

    return False


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

            access_token_str = str(refresh.access_token)
            refresh_token_str = str(refresh)
            return Response({
                'success': True,
                'message': f'Đăng nhập thành công! Kính chào {user.get_full_name() or user.username}'.strip(),
                'user': UserSerializer(user, context={'request': request}).data,
                'access': access_token_str,
                'refresh': refresh_token_str,
                'tokens': {
                    'access': access_token_str,
                    'refresh': refresh_token_str,
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


class ForgotPasswordView(APIView):
    """
    API Gửi mã OTP khôi phục mật khẩu qua Email: POST /api/auth/forgot-password/
    - Nhận email từ client.
    - Rate limit: Chỉ gửi lại sau tối thiểu 60s.
    - Tạo OTP 6 chữ số ngẫu nhiên, hiệu lực 5 phút.
    - Gửi email HTML qua SMTP Gmail (hoặc log console nếu môi trường dev).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            first_err = next(iter(serializer.errors.values()))[0] if serializer.errors else 'Dữ liệu không hợp lệ.'
            return Response({
                'success': False,
                'message': first_err,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        user = User.objects.filter(email__iexact=email, is_active=True).first()

        if not user:
            # Bảo mật chống lộ thông tin tài khoản (User Enumeration Protection)
            return Response({
                'success': True,
                'message': 'Nếu email của quý khách tồn tại trên hệ thống, mã xác thực OTP (6 chữ số) đã được gửi đến hòm thư. Vui lòng kiểm tra hộp thư đến hoặc thư rác (Spam).'
            }, status=status.HTTP_200_OK)

        # Kiểm tra Rate Limit: Có OTP nào tạo trong 60 giây qua không?
        now = timezone.now()
        recent_otp = PasswordResetOTP.objects.filter(
            user=user,
            created_at__gte=now - timedelta(seconds=60),
            is_used=False
        ).first()

        if recent_otp:
            seconds_left = 60 - int((now - recent_otp.created_at).total_seconds())
            return Response({
                'success': False,
                'message': f'Quý khách vui lòng đợi thêm {max(seconds_left, 1)} giây trước khi yêu cầu gửi lại mã mới.'
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        # Vô hiệu hóa các mã OTP cũ chưa dùng của user này
        PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)

        # Sinh mã OTP 6 chữ số ngẫu nhiên
        otp_code = f"{secrets.randbelow(900000) + 100000}"
        expires_at = now + timedelta(minutes=5)

        PasswordResetOTP.objects.create(
            user=user,
            otp_code=otp_code,
            expires_at=expires_at
        )

        # Soạn thảo nội dung Email HTML thương hiệu khách sạn
        hotel_name = "Khách Sạn TA Đà Nẵng"
        subject = f"[{hotel_name}] Mã xác nhận khôi phục mật khẩu: {otp_code}"
        full_name = getattr(user, 'get_full_name', lambda: '')() or user.username
        
        expires_time_str = timezone.localtime(expires_at).strftime('%H:%M:%S')

        html_message = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
            <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
                <h2 style="color: #d97706; margin: 0; font-size: 24px; letter-spacing: 0.5px;">{hotel_name}</h2>
                <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Dịch vụ Lưu trú & Nghỉ dưỡng Đẳng cấp</p>
            </div>
            
            <div style="padding: 24px 0;">
                <p style="color: #334155; font-size: 15px; margin-bottom: 16px;">
                    Xin chào <strong>{full_name}</strong>,
                </p>
                <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
                    Chúng tôi nhận được yêu cầu khôi phục mật khẩu cho tài khoản liên kết với địa chỉ email này. Dưới đây là mã xác thực <strong>OTP</strong> của quý khách:
                </p>
                
                <div style="text-align: center; margin: 28px 0;">
                    <div style="display: inline-block; background: #fef3c7; border: 2px dashed #d97706; border-radius: 12px; padding: 14px 32px;">
                        <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #b45309; font-family: 'Courier New', monospace;">{otp_code}</span>
                    </div>
                    <p style="color: #dc2626; font-size: 13px; font-weight: 600; margin-top: 10px;">
                        ⏱ Mã có hiệu lực trong vòng 5 phút (hết hạn lúc {expires_time_str}).
                    </p>
                </div>

                <p style="color: #64748b; font-size: 13px; line-height: 1.6;">
                    🔒 <strong>Lưu ý an toàn:</strong> Tuyệt đối không chia sẻ mã này cho bất kỳ ai, kể cả nhân viên khách sạn. Nếu quý khách không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc liên hệ ngay hotline để được hỗ trợ.
                </p>
            </div>

            <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
                <p style="margin: 0;">Khách Sạn TA Đà Nẵng — Hotline Hỗ Trợ 24/7: 1900 8888</p>
                <p style="margin: 4px 0 0 0;">Email gửi tự động từ hệ thống, vui lòng không phản hồi thư này.</p>
            </div>
        </div>
        """

        plain_message = f"Xin chào {full_name},\nMã OTP khôi phục mật khẩu của quý khách là: {otp_code}\nMã có hiệu lực trong vòng 5 phút (hết hạn lúc {expires_time_str}). Vui lòng không chia sẻ mã này cho người khác."

        try:
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or settings.EMAIL_HOST_USER
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=from_email,
                recipient_list=[user.email],
                html_message=html_message,
                fail_silently=False
            )
        except Exception as e:
            logger.error(f"Lỗi gửi email OTP quên mật khẩu tới {user.email}: {str(e)}", exc_info=True)
            print(f"\n==========================================")
            print(f"[OTP QUÊN MẬT KHẨU] Email: {user.email}")
            print(f"Mã OTP: {otp_code} (Hết hạn lúc: {expires_time_str})")
            print(f"==========================================\n")

        return Response({
            'success': True,
            'message': 'Mã xác thực OTP (6 chữ số) đã được gửi đến email của quý khách. Vui lòng kiểm tra hộp thư đến hoặc thư rác (Spam).'
        }, status=status.HTTP_200_OK)


class ResetPasswordConfirmView(APIView):
    """
    API Xác thực OTP và Đặt lại mật khẩu mới: POST /api/auth/reset-password/
    - Nhận: email, otp_code, new_password, confirm_password
    - Kiểm tra OTP còn hạn, chưa dùng, chưa vượt quá 5 lần sai.
    - Cập nhật mật khẩu mới cho tài khoản.
    - Ghi log hệ thống AuditLog.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordConfirmSerializer(data=request.data)
        if not serializer.is_valid():
            first_err = next(iter(serializer.errors.values()))[0] if serializer.errors else 'Dữ liệu không hợp lệ.'
            return Response({
                'success': False,
                'message': first_err,
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        otp_code = serializer.validated_data['otp_code']
        new_password = serializer.validated_data['new_password']

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return Response({
                'success': False,
                'message': 'Tài khoản không tồn tại hoặc đã bị khóa.'
            }, status=status.HTTP_404_NOT_FOUND)

        # Lấy OTP gần nhất chưa dùng của user này
        otp_entry = PasswordResetOTP.objects.filter(
            user=user,
            is_used=False
        ).order_by('-created_at').first()

        if not otp_entry:
            return Response({
                'success': False,
                'message': 'Không tìm thấy yêu cầu đặt lại mật khẩu. Vui lòng gửi yêu cầu lấy mã mới.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if otp_entry.is_expired():
            return Response({
                'success': False,
                'message': 'Mã xác thực OTP đã hết hạn (chỉ có hiệu lực 5 phút). Vui lòng gửi lại mã mới.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if otp_entry.attempts >= 5:
            otp_entry.is_used = True
            otp_entry.save(update_fields=['is_used'])
            return Response({
                'success': False,
                'message': 'Quý khách đã nhập sai mã xác thực quá 5 lần. Mã OTP này đã bị hủy vì lý do an toàn.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # So khớp mã OTP
        if otp_entry.otp_code != otp_code:
            otp_entry.attempts += 1
            otp_entry.save(update_fields=['attempts'])
            remaining = 5 - otp_entry.attempts
            return Response({
                'success': False,
                'message': f'Mã xác thực OTP không chính xác. Quý khách còn {remaining} lần thử lại.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Hợp lệ -> Cập nhật mật khẩu mới
        user.set_password(new_password)
        user.save()

        # Đánh dấu OTP đã sử dụng
        otp_entry.is_used = True
        otp_entry.save(update_fields=['is_used'])

        # Ghi log thao tác hệ thống AuditLog
        log_action(
            user=user,
            action='UPDATE',
            module='USER',
            description=f"Khách hàng {user.username} ({email}) đã khôi phục mật khẩu thành công qua mã OTP Email",
            request=request
        )

        return Response({
            'success': True,
            'message': 'Đặt lại mật khẩu thành công! Quý khách có thể sử dụng mật khẩu mới để đăng nhập ngay.'
        }, status=status.HTTP_200_OK)


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

        # Lọc theo trạng thái hoạt động / Phân loại khách
        is_active = request.query_params.get('is_active') or request.query_params.get('status')
        if is_active is not None and is_active != 'all':
            val = str(is_active).strip().lower()
            walkin_q = Q(username__startswith='walkin_') | Q(email__endswith='.local') | Q(password__startswith='!')
            if val in ['true', '1', 'active']:
                queryset = queryset.filter(is_active=True).exclude(walkin_q)
            elif val == 'walkin':
                queryset = queryset.filter(walkin_q)
            elif val in ['false', '0', 'locked']:
                queryset = queryset.filter(is_active=False).exclude(walkin_q)

        # Tính toán thống kê trên toàn bộ tập dữ liệu (không bị giới hạn bởi phân trang)
        total_guests = queryset.count()
        active_guests = queryset.filter(is_active=True).count()
        diamond_guests = queryset.filter(
            Q(current_tier__name__icontains='Diamond') | Q(guest_profile__vip_tier__icontains='Diamond')
        ).count()
        gold_silver_guests = queryset.filter(
            Q(current_tier__name__icontains='Gold') | Q(guest_profile__vip_tier__icontains='Gold') |
            Q(current_tier__name__icontains='Silver') | Q(guest_profile__vip_tier__icontains='Silver') |
            Q(current_tier__name__icontains='Vàng') | Q(guest_profile__vip_tier__icontains='Vàng') |
            Q(current_tier__name__icontains='Bạc') | Q(guest_profile__vip_tier__icontains='Bạc')
        ).count()

        stats = {
            'total_guests': total_guests,
            'active_guests': active_guests,
            'diamond_guests': diamond_guests,
            'gold_silver_guests': gold_silver_guests,
        }

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
                'guests': serializer.data,
                'stats': stats,
            }, status=status.HTTP_200_OK)

        serializer = AdminGuestSerializer(queryset, many=True, context={'request': request})
        return Response({
            'success': True,
            'count': queryset.count(),
            'results': serializer.data,
            'guests': serializer.data,
            'stats': stats,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # Cập nhật thêm nếu có CCCD, VIP tier từ form admin
            profile = getattr(user, 'guest_profile', None)
            if profile:
                user_updated_fields = []
                if 'vip_tier' in request.data:
                    clean_tier = str(request.data['vip_tier']).strip()
                    tier_obj = MembershipTier.objects.filter(
                        Q(code__iexact=clean_tier) | Q(name__icontains=clean_tier)
                    ).first()
                    if tier_obj:
                        user.current_tier = tier_obj
                        profile.vip_tier = tier_obj.name
                    else:
                        profile.vip_tier = clean_tier
                    user_updated_fields.append('current_tier')
                if 'id_card_number' in request.data:
                    profile.id_card_number = request.data['id_card_number']
                if 'loyalty_points' in request.data:
                    pts = int(request.data.get('loyalty_points', 0))
                    profile.loyalty_points = pts
                    user.total_points = pts
                    user_updated_fields.append('total_points')
                if user_updated_fields:
                    user.save(update_fields=user_updated_fields)
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


# =========================================================================
# DANH MỤC VAI TRÒ & CHI TIẾT MA TRẬN PHÂN QUYỀN RBAC CHUẨN KHÁCH SẠN
# =========================================================================

def get_all_roles_matrix():
    matrix_list = [
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
    for r in matrix_list:
        r['code'] = r['role']
        r['name'] = r['title']
    return matrix_list


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


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet quản lý User có tích hợp StandardResultsSetPagination
    """
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        if self.action == 'retrieve':
            return [IsAuthenticated()]
        return [IsManagerOrAdmin()]


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


class MembershipTierListView(APIView):
    """
    API GET /api/users/membership-tiers/
    Lấy danh sách các Hạng thành viên và đặc quyền tương ứng.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        from .models import MembershipTier
        from .serializers import MembershipTierSerializer
        tiers = MembershipTier.objects.all().order_by('order', 'min_points')
        serializer = MembershipTierSerializer(tiers, many=True)
        return Response({
            'success': True,
            'tiers': serializer.data
        }, status=status.HTTP_200_OK)



