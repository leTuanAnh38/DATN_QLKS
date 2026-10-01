from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from ..users.models import User
from ..bookings.models import Booking
from ..rooms.models import RoomCategory


class Review(models.Model):
    booking = models.OneToOneField(
        Booking,
        on_delete=models.CASCADE,
        related_name='review',
        verbose_name="Đơn đặt phòng"
    )
    guest = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='reviews',
        verbose_name="Khách hàng"
    )
    room_category = models.ForeignKey(
        RoomCategory,
        on_delete=models.CASCADE,
        related_name='reviews',
        verbose_name="Hạng phòng"
    )

    cleanliness_score = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=5,
        verbose_name="Điểm vệ sinh (1-5)"
    )
    service_score = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=5,
        verbose_name="Điểm dịch vụ (1-5)"
    )
    location_score = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=5,
        verbose_name="Điểm vị trí (1-5)"
    )
    value_score = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        default=5,
        verbose_name="Điểm giá trị (1-5)"
    )
    overall_rating = models.FloatField(
        default=5.0,
        verbose_name="Điểm trung bình"
    )

    comment = models.TextField(verbose_name="Nội dung đánh giá")
    admin_reply = models.TextField(
        blank=True,
        null=True,
        verbose_name="Phản hồi của khách sạn"
    )
    is_visible = models.BooleanField(
        default=True,
        verbose_name="Trạng thái hiển thị"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Ngày gửi đánh giá"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Ngày cập nhật"
    )

    class Meta:
        verbose_name = "Đánh giá & Phản hồi"
        verbose_name_plural = "Quản lý Đánh giá"
        ordering = ['-created_at']

    def __str__(self):
        guest_name = (self.guest.get_full_name().strip() or self.guest.username) if self.guest else "Khách"
        return f"Review #{self.id} - {guest_name} ({self.overall_rating}★)"

    def calculate_overall_rating(self):
        scores = [self.cleanliness_score, self.service_score, self.location_score, self.value_score]
        valid_scores = [s for s in scores if s is not None and 1 <= s <= 5]
        if valid_scores:
            return round(sum(valid_scores) / len(valid_scores), 1)
        return 5.0

    def save(self, *args, **kwargs):
        # Tự động tính điểm trung bình
        self.overall_rating = self.calculate_overall_rating()

        # Tự động đồng bộ room_category và guest từ booking nếu chưa có
        if self.booking:
            if not self.room_category_id and self.booking.category:
                self.room_category = self.booking.category
            if not self.guest_id and self.booking.guest:
                self.guest = self.booking.guest

        super().save(*args, **kwargs)
