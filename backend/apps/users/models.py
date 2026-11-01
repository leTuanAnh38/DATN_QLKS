from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class MembershipTier(models.Model):
    """
    Bảng quản lý các Hạng thành viên (Bronze, Silver, Gold, Diamond...)
    Được cấu hình bởi Quản trị viên trong Django Admin.
    """
    name = models.CharField(max_length=50, unique=True, verbose_name="Tên hạng thẻ")
    code = models.CharField(max_length=20, unique=True, verbose_name="Mã định danh (VD: BRONZE, SILVER, GOLD, DIAMOND)")
    min_points = models.PositiveIntegerField(default=0, verbose_name="Điểm tối thiểu để đạt hạng")
    discount_percent = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0.0, 
        verbose_name="Phần trăm giảm giá (%)"
    )
    badge_color = models.CharField(
        max_length=100, 
        default="from-amber-700 via-amber-800 to-amber-950", 
        verbose_name="Class màu nền / Gradient (Tailwind CSS)"
    )
    description = models.TextField(null=True, blank=True, verbose_name="Mô tả đặc quyền")
    order = models.PositiveSmallIntegerField(default=1, verbose_name="Thứ tự ưu tiên / Cấp bậc")

    class Meta:
        verbose_name = "Hạng thành viên"
        verbose_name_plural = "Quản lý Hạng thành viên"
        ordering = ['order', 'min_points']

    def __str__(self):
        return f"{self.name} (>= {self.min_points} điểm - Giảm {self.discount_percent}%)"


class User(AbstractUser):
    # 9 Vai trò trong hệ thống khách sạn
    ROLE_CHOICES = (
        ('admin', 'Admin Hệ thống'),
        ('owner', 'Chủ Khách sạn'),
        ('manager', 'Quản lý Khách sạn'),
        ('cashier', 'Thu ngân'),
        ('receptionist', 'Lễ tân'),
        ('housekeeper', 'Nhân viên Dọn dẹp'),
        ('service_staff', 'Nhân viên Phục vụ'),
        ('technician', 'Kỹ thuật viên'),
        ('guest', 'Khách hàng'),
    )

    phone_number = models.CharField(max_length=15, unique=True, null=True, blank=True, verbose_name='Số điện thoại')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='guest', verbose_name='Vai trò')
    address = models.TextField(null=True, blank=True, verbose_name='Địa chỉ')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True, verbose_name='Ảnh đại diện')

    # Chương trình Khách hàng thân thiết (Loyalty & Membership Program)
    total_points = models.PositiveIntegerField(default=0, verbose_name="Tổng điểm tích lũy")
    current_tier = models.ForeignKey(
        MembershipTier, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='members',
        verbose_name="Hạng thành viên hiện tại"
    )

    # --- CÁCH KHẮC PHỤC LỖI E304 (Bổ sung related_name) ---
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='custom_user_set',
        blank=True,
        verbose_name='groups',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='custom_user_permissions_set',
        blank=True,
        verbose_name='user permissions',
    )

    def __str__(self):
        return f"{self.username} - {self.get_role_display()}"

    class Meta:
        verbose_name = '1. Tài khoản Đăng nhập'
        verbose_name_plural = '1. Tài khoản Đăng nhập'


# ==========================================
# BẢNG MỞ RỘNG: HỒ SƠ KHÁCH HÀNG
# ==========================================
class GuestProfile(models.Model):
    ID_TYPE_CHOICES = (
        ('CCCD', 'Căn cước công dân / CMND'),
        ('PASSPORT', 'Hộ chiếu (Passport)'),
        ('OTHER', 'Khác / Giấy khai sinh'),
    )
    GENDER_CHOICES = (
        ('Nam', 'Nam'),
        ('Nữ', 'Nữ'),
        ('Khác', 'Khác'),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='guest_profile', verbose_name='Tài khoản')
    id_type = models.CharField(max_length=20, choices=ID_TYPE_CHOICES, default='CCCD', verbose_name='Loại giấy tờ')
    id_card_number = models.CharField(max_length=20, null=True, blank=True, verbose_name='CCCD / Passport')
    date_of_birth = models.DateField(null=True, blank=True, verbose_name='Ngày sinh')
    gender = models.CharField(max_length=20, choices=GENDER_CHOICES, default='Nam', null=True, blank=True, verbose_name='Giới tính')
    nationality = models.CharField(max_length=50, default='Việt Nam', verbose_name='Quốc tịch')
    loyalty_points = models.IntegerField(default=0, verbose_name='Điểm tích lũy (TA Club)')
    vip_tier = models.CharField(max_length=50, default='Đồng (Bronze)', verbose_name='Hạng Thành viên')
    preferences = models.TextField(null=True, blank=True, verbose_name='Ghi chú sở thích (Dị ứng, gối nệm...)')

    def __str__(self):
        return f"Khách hàng: {self.user.username}"

    class Meta:
        verbose_name = '2. Hồ sơ Khách hàng'
        verbose_name_plural = '2. Hồ sơ Khách hàng'


# ==========================================
# BẢNG MỞ RỘNG: HỒ SƠ NHÂN VIÊN & QUẢN LÝ
# ==========================================
class EmployeeProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employee_profile', verbose_name='Tài khoản')
    employee_code = models.CharField(max_length=10, unique=True, verbose_name='Mã nhân viên')
    department = models.CharField(max_length=50, verbose_name='Phòng ban trực thuộc')
    position = models.CharField(max_length=100, null=True, blank=True, verbose_name='Chức danh / Vị trí công tác')
    shift = models.CharField(max_length=50, null=True, blank=True, verbose_name='Ca làm việc (Sáng/Chiều/Đêm)')
    base_salary = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True, verbose_name='Mức lương cơ bản (VND)')
    hire_date = models.DateField(null=True, blank=True, verbose_name='Ngày vào làm')

    def __str__(self):
        return f"Nhân viên: {self.user.username} ({self.employee_code})"

    class Meta:
        verbose_name = '3. Hồ sơ Nhân sự'
        verbose_name_plural = '3. Hồ sơ Nhân sự'


# ==========================================
# BẢNG 4: NHẬT KÝ THAO TÁC HỆ THỐNG (AUDIT LOG)
# ==========================================
class AuditLog(models.Model):
    """
    Nhật ký thao tác hệ thống (Audit Trail) tuân thủ Separation of Duties (SoD)
    Chỉ cho phép ghi (Write-only), không chỉnh sửa hoặc xóa.
    """
    ACTION_CHOICES = (
        ('CREATE', 'Tạo mới'),
        ('UPDATE', 'Cập nhật'),
        ('DELETE', 'Xóa'),
        ('LOGIN', 'Đăng nhập'),
        ('LOGOUT', 'Đăng xuất'),
        ('EXPORT', 'Xuất dữ liệu'),
        ('OTHER', 'Khác'),
    )

    MODULE_CHOICES = (
        ('BOOKING', 'Đặt phòng'),
        ('INVOICE', 'Hóa đơn & Thu ngân'),
        ('USER', 'Nhân sự & Người dùng'),
        ('ROOM', 'Buồng phòng'),
        ('SERVICE', 'Dịch vụ'),
        ('PROMOTION', 'Khuyến mãi'),
        ('SYSTEM', 'Cài đặt Hệ thống'),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        verbose_name='Người thực hiện'
    )
    action = models.CharField(
        max_length=20,
        choices=ACTION_CHOICES,
        db_index=True,
        verbose_name='Hành động'
    )
    module = models.CharField(
        max_length=30,
        choices=MODULE_CHOICES,
        db_index=True,
        verbose_name='Phân hệ / Module'
    )
    description = models.TextField(verbose_name='Chi tiết mô tả thao tác')
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name='Địa chỉ IP'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name='Thời gian ghi nhận'
    )

    class Meta:
        verbose_name = '4. Nhật ký thao tác hệ thống'
        verbose_name_plural = '4. Nhật ký thao tác hệ thống'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['module', '-created_at']),
            models.Index(fields=['action', '-created_at']),
        ]

    def __str__(self):
        user_name = self.user.username if self.user else "Hệ thống"
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M:%S')}] {user_name} - {self.action} ({self.module})"


# ==========================================
# BẢNG 5: MÃ XÁC THỰC QUÊN MẬT KHẨU (PASSWORD RESET OTP)
# ==========================================
class PasswordResetOTP(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='password_reset_otps',
        verbose_name='Tài khoản người dùng'
    )
    otp_code = models.CharField(max_length=6, verbose_name='Mã OTP 6 số')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Thời gian tạo')
    expires_at = models.DateTimeField(verbose_name='Thời gian hết hạn')
    attempts = models.PositiveSmallIntegerField(default=0, verbose_name='Số lần nhập sai')
    is_used = models.BooleanField(default=False, verbose_name='Đã sử dụng')

    class Meta:
        verbose_name = '5. Mã OTP Đặt lại mật khẩu'
        verbose_name_plural = '5. Mã OTP Đặt lại mật khẩu'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['otp_code', 'is_used']),
        ]

    def __str__(self):
        status = "Đã dùng" if self.is_used else ("Hết hạn" if self.is_expired() else "Khả dụng")
        return f"OTP {self.otp_code} ({self.user.username}) - {status}"

    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at

    def is_valid(self):
        return not self.is_used and not self.is_expired() and self.attempts < 5


def get_client_ip(request):
    """Trích xuất địa chỉ IP thực tế của client từ HTTP request"""
    if not request:
        return None
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def log_action(user, action, module, description, ip_address=None, request=None):
    """
    Helper function ngắn gọn để ghi log hệ thống từ bất kỳ module nào:
    Ví dụ: log_action(request.user, 'CREATE', 'BOOKING', 'Tạo đặt phòng mới #12', request=request)
    """
    try:
        if request:
            if not ip_address:
                ip_address = get_client_ip(request)
            if not user and hasattr(request, 'user') and request.user.is_authenticated:
                user = request.user

        action_clean = str(action).upper().strip()
        module_clean = str(module).upper().strip()

        return AuditLog.objects.create(
            user=user if (user and getattr(user, 'is_authenticated', True)) else None,
            action=action_clean,
            module=module_clean,
            description=description,
            ip_address=ip_address
        )
    except Exception as e:
        import logging
        logging.getLogger('audit_log').error(f"Lỗi ghi log thao tác: {str(e)}", exc_info=True)
        return None


def write_audit_log_to_jsonl(log_obj):
    """
    Ghi một bản ghi nhật ký hoạt động (AuditLog) vào file JSONL trên máy chủ.
    Đường dẫn mặc định: backend/logs/audit_logs.jsonl
    Mỗi dòng là một chuỗi JSON độc lập (JSON Lines format), chuẩn UTF-8.
    """
    try:
        from django.conf import settings
        from django.utils import timezone
        import json
        import os

        # Lấy đường dẫn file từ settings hoặc thư mục logs/ mặc định
        log_file = getattr(
            settings,
            'AUDIT_LOG_FILE',
            os.path.join(getattr(settings, 'BASE_DIR', ''), 'logs', 'audit_logs.jsonl')
        )
        os.makedirs(os.path.dirname(str(log_file)), exist_ok=True)

        user = getattr(log_obj, 'user', None)
        username = user.username if user else "Hệ thống"
        full_name = ""
        role = "SYSTEM"
        if user:
            first = getattr(user, 'first_name', '') or ''
            last = getattr(user, 'last_name', '') or ''
            full_name = f"{last} {first}".strip() or user.username
            role = (getattr(user, 'role', '') or 'STAFF').upper()

        if getattr(log_obj, 'created_at', None):
            created_dt = timezone.localtime(log_obj.created_at) if timezone.is_aware(log_obj.created_at) else log_obj.created_at
            created_str = created_dt.strftime('%Y-%m-%d %H:%M:%S')
        else:
            created_str = timezone.localtime(timezone.now()).strftime('%Y-%m-%d %H:%M:%S')

        log_data = {
            "id": log_obj.id,
            "timestamp": created_str,
            "user_id": user.id if user else None,
            "username": username,
            "full_name": full_name,
            "role": role,
            "action": log_obj.action,
            "module": log_obj.module,
            "description": log_obj.description,
            "ip_address": log_obj.ip_address or ""
        }

        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(log_data, ensure_ascii=False) + '\n')
    except Exception as e:
        import logging
        logging.getLogger('audit_log').error(f"Lỗi ghi file JSONL audit log: {str(e)}", exc_info=True)


@receiver(post_save, sender=AuditLog)
def audit_log_post_save(sender, instance, created, **kwargs):
    """
    Signal tự động ghi bản ghi AuditLog mới vào file JSONL trên máy chủ
    ngay sau khi được lưu vào cơ sở dữ liệu.
    """
    if created:
        write_audit_log_to_jsonl(instance)
