from django.contrib.auth.models import AbstractUser
from django.db import models

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
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='guest_profile', verbose_name='Tài khoản')
    id_card_number = models.CharField(max_length=20, null=True, blank=True, verbose_name='CCCD / Passport')
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