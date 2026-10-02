import re
import unicodedata
from django.db import models
from django.utils.text import slugify


def vietnamese_slugify(text):
    """
    Chuyển đổi chuỗi tiếng Việt có dấu thành slug không dấu dùng cho URL thân thiện chuẩn SEO.
    Ví dụ: 'Top 5 Trải Nghiệm Nghỉ Dưỡng' -> 'top-5-trai-nghiem-nghi-duong'
    """
    if not text:
        return ""
    # Chuyển đổi thủ công ký tự đ, Đ
    text = text.replace('đ', 'd').replace('Đ', 'd')
    # Tách dấu unicode và loại bỏ các ký tự dấu
    text = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('utf-8')
    # Thay thế các ký tự không phải chữ/số thành gạch nối
    text = re.sub(r'[^\w\s-]', '', text).strip().lower()
    return slugify(text)


class Post(models.Model):
    CATEGORY_CHOICES = [
        ('du_lich', 'Du lịch'),
        ('am_thuc', 'Ẩm thực'),
        ('khuyen_mai', 'Khuyến mãi'),
        ('su_kien', 'Sự kiện'),
        ('khach_san', 'Khách sạn'),
    ]

    STATUS_CHOICES = [
        ('published', 'Hiển thị'),
        ('draft', 'Bản nháp'),
    ]

    title = models.CharField(max_length=255, verbose_name="Tiêu đề bài viết")
    slug = models.SlugField(
        max_length=255,
        unique=True,
        blank=True,
        verbose_name="Đường dẫn tĩnh (Slug)"
    )
    category = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        default='du_lich',
        verbose_name="Chuyên mục"
    )
    author = models.CharField(
        max_length=150,
        default="Ban Biên Tập",
        verbose_name="Tác giả biên soạn"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='published',
        verbose_name="Trạng thái"
    )
    thumbnail = models.ImageField(
        upload_to='posts/',
        null=True,
        blank=True,
        verbose_name="Ảnh bìa bài viết"
    )
    summary = models.TextField(
        blank=True,
        default='',
        verbose_name="Tóm tắt nội dung"
    )
    content = models.TextField(
        verbose_name="Nội dung chi tiết (HTML)"
    )
    view_count = models.PositiveIntegerField(
        default=0,
        verbose_name="Lượt xem"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Ngày tạo"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Ngày cập nhật"
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Bài viết & Tin tức"
        verbose_name_plural = "Quản lý Tin tức & Bài viết"

    def save(self, *args, **kwargs):
        """
        Tự động tạo slug từ title nếu slug bị bỏ trống, đảm bảo unique không trùng lặp.
        """
        if not self.slug:
            base_slug = vietnamese_slugify(self.title) or 'bai-viet'
            slug = base_slug
            counter = 1
            qs = Post.objects.filter(slug=slug)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            while qs.exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
                qs = Post.objects.filter(slug=slug)
                if self.pk:
                    qs = qs.exclude(pk=self.pk)
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.get_category_display()}] {self.title}"


import uuid

def upload_image_path(instance, filename):
    ext = filename.split('.')[-1].lower() if '.' in filename else 'jpg'
    unique_name = f"{uuid.uuid4().hex[:12]}.{ext}"
    return f"uploads/{unique_name}"


class ImageUpload(models.Model):
    """
    Model lưu trữ độc lập các ảnh tải lên từ trình soạn thảo Quill
    Tránh lưu chuỗi Base64 nặng hàng megabytes vào Database.
    """
    image = models.ImageField(upload_to=upload_image_path, verbose_name="File ảnh")
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name="Thời gian tải lên")

    class Meta:
        ordering = ['-uploaded_at']
        verbose_name = "Ảnh tải lên trình soạn thảo"
        verbose_name_plural = "Quản lý Ảnh soạn thảo"

    def __str__(self):
        return f"Image #{self.id} ({self.image.name})"

