from django.db import models
from django.conf import settings


class Notification(models.Model):
    TYPE_CHOICES = (
        ('booking', 'Đơn đặt phòng cá nhân'),
        ('group_booking', 'Đơn đặt đoàn doanh nghiệp'),
        ('service', 'Dịch vụ phòng'),
        ('payment', 'Thanh toán & Hóa đơn'),
        ('room', 'Buồng phòng & Kỹ thuật'),
        ('system', 'Hệ thống & Cảnh báo'),
    )

    PRIORITY_CHOICES = (
        ('low', 'Thấp'),
        ('normal', 'Bình thường'),
        ('high', 'Quan trọng'),
        ('urgent', 'Khẩn cấp'),
    )

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name="Người nhận"
    )
    title = models.CharField(max_length=255, verbose_name="Tiêu đề thông báo")
    message = models.TextField(verbose_name="Nội dung thông báo")
    notification_type = models.CharField(
        max_length=30,
        choices=TYPE_CHOICES,
        default='system',
        verbose_name="Loại thông báo"
    )
    priority = models.CharField(
        max_length=20,
        choices=PRIORITY_CHOICES,
        default='normal',
        verbose_name="Mức độ ưu tiên"
    )
    action_url = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Đường dẫn điều hướng"
    )
    is_read = models.BooleanField(default=False, verbose_name="Đã đọc")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Thời gian tạo")

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Thông báo"
        verbose_name_plural = "Hệ thống Thông báo"
        indexes = [
            models.Index(fields=['recipient', '-created_at']),
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['recipient', 'notification_type']),
        ]

    def __str__(self):
        status_text = "Đã đọc" if self.is_read else "Chưa đọc"
        return f"[{status_text}][{self.notification_type}] {self.recipient.username} - {self.title}"


class UserDevice(models.Model):
    """
    Quản lý danh sách thiết bị di động (iPhone 14 Pro, Android...) đăng ký nhận Push Notification qua Expo
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='devices',
        verbose_name="Người dùng"
    )
    expo_push_token = models.CharField(max_length=255, unique=True, verbose_name="Expo Push Token")
    device_name = models.CharField(max_length=150, blank=True, default='', verbose_name="Tên thiết bị (VD: iPhone 14 Pro)")
    platform = models.CharField(max_length=30, blank=True, default='ios', verbose_name="Hệ điều hành (ios/android/web)")
    is_active = models.BooleanField(default=True, verbose_name="Đang kích hoạt nhận thông báo")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Thiết bị nhận thông báo"
        verbose_name_plural = "Danh sách thiết bị (Push Tokens)"
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['expo_push_token']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.device_name or self.platform} ({self.expo_push_token[:20]}...)"

