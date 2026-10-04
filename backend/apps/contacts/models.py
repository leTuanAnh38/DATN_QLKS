from django.db import models


class ContactMessage(models.Model):
    """
    Yêu cầu liên hệ do khách hàng gửi từ trang /contact.
    Admin / lễ tân xem, đánh dấu đã đọc và xóa trong trang quản trị.
    """
    name = models.CharField(max_length=150, verbose_name='Họ và tên')
    email = models.EmailField(verbose_name='Email')
    subject = models.CharField(max_length=255, verbose_name='Chủ đề')
    message = models.TextField(verbose_name='Nội dung')
    is_read = models.BooleanField(default=False, db_index=True, verbose_name='Đã đọc')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Ngày gửi')

    class Meta:
        verbose_name = 'Liên hệ'
        verbose_name_plural = 'Danh sách liên hệ'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} - {self.subject}'
