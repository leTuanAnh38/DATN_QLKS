from django.db import models
from django.conf import settings


class Notification(models.Model):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name="Người nhận"
    )
    title = models.CharField(max_length=255, verbose_name="Tiêu đề thông báo")
    message = models.TextField(verbose_name="Nội dung thông báo")
    is_read = models.BooleanField(default=False, verbose_name="Đã đọc")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Thời gian tạo")

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Thông báo"
        verbose_name_plural = "Hệ thống Thông báo"

    def __str__(self):
        status_text = "Đã đọc" if self.is_read else "Chưa đọc"
        return f"[{status_text}] {self.recipient.username} - {self.title}"
