"""Đăng ký, đăng nhập, hồ sơ cá nhân, đổi / quên / đặt lại mật khẩu."""
import os
import logging
import secrets
from datetime import timedelta

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.conf import settings
from django.utils import timezone
from django.core.mail import send_mail

from ..models import GuestProfile, log_action, PasswordResetOTP
from ..serializers import (
    UserSerializer,
    UserProfileSerializer,
    RegisterSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
    ForgotPasswordSerializer,
    ResetPasswordConfirmSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)

ROLE_MATRIX_FILE = os.path.join(settings.BASE_DIR, 'role_matrix.json')


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
                        Mã có hiệu lực trong vòng 5 phút (hết hạn lúc {expires_time_str}).
                    </p>
                </div>

                <p style="color: #64748b; font-size: 13px; line-height: 1.6;">
                    <strong>Lưu ý an toàn:</strong> Tuyệt đối không chia sẻ mã này cho bất kỳ ai, kể cả nhân viên khách sạn. Nếu quý khách không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc liên hệ ngay hotline để được hỗ trợ.
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
