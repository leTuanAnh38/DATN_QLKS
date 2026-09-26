from django.contrib.auth.models import AbstractUser
from django.db import models

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
    vip_tier = models.CharField(max_length=50, default='Silver', verbose_name='Hạng Thành viên')
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
    shift = models.CharField(max_length=50, null=True, blank=True, verbose_name='Ca làm việc (Sáng/Chiều/Đêm)')
    base_salary = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True, verbose_name='Mức lương cơ bản (VND)')
    hire_date = models.DateField(null=True, blank=True, verbose_name='Ngày vào làm')

    def __str__(self):
        return f"Nhân viên: {self.user.username} ({self.employee_code})"

    class Meta:
        verbose_name = '3. Hồ sơ Nhân sự'
        verbose_name_plural = '3. Hồ sơ Nhân sự'