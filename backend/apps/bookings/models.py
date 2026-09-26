import uuid
from django.db import models
from ..users.models import User
from ..rooms.models import Room

class Booking(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Đang chờ duyệt'),
        ('confirmed', 'Đã xác nhận'),
        ('checked_in', 'Đã Check-in'),
        ('checked_out', 'Đã Check-out'),
        ('cancelled', 'Đã Hủy'),
    )

    booking_code = models.CharField(max_length=20, unique=True, blank=True, verbose_name="Mã Đặt Phòng")
    guest = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings', verbose_name="Khách hàng")
    room = models.ForeignKey(Room, on_delete=models.SET_NULL, null=True, related_name='bookings', verbose_name="Phòng")
    
    # Quản lý thời gian & Gia hạn
    check_in_date = models.DateField(verbose_name="Ngày Check-in (Dự kiến)")
    check_out_date = models.DateField(verbose_name="Ngày Check-out (Có thể gia hạn)")
    actual_check_in = models.DateTimeField(null=True, blank=True, verbose_name="Giờ Check-in thực tế")
    actual_check_out = models.DateTimeField(null=True, blank=True, verbose_name="Giờ Check-out thực tế")

    total_amount = models.DecimalField(max_digits=12, decimal_places=0, verbose_name="Tổng tiền phòng (VND)")
    applied_promotion = models.ForeignKey('Promotion', on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Mã KM áp dụng")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name="Trạng thái")
    
    # Ghi chú
    note = models.TextField(blank=True, null=True, verbose_name="Ghi chú của khách")
    internal_note = models.TextField(blank=True, null=True, verbose_name="Ghi chú nội bộ (Lễ tân)")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Ngày tạo đơn")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Ngày cập nhật")

    def __str__(self):
        return f"{self.booking_code} - Khách: {self.guest.username}"

    def save(self, *args, **kwargs):
        if not self.booking_code:
            self.booking_code = f"BK-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "Đơn Đặt Phòng"
        verbose_name_plural = "1. Danh sách Đặt Phòng"


# BẢNG QUẢN LÝ DỊCH VỤ PHÁT SINH KHI ĐANG LƯU TRÚ
class BookingExtraService(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='extra_services', verbose_name="Thuộc Đơn đặt phòng")
    service_name = models.CharField(max_length=100, verbose_name="Tên dịch vụ / Phụ phí (VD: Giặt ủi, Mini Bar, Đền bù)")
    quantity = models.IntegerField(default=1, verbose_name="Số lượng")
    price = models.DecimalField(max_digits=10, decimal_places=0, verbose_name="Đơn giá (VND)")
    added_time = models.DateTimeField(auto_now_add=True, verbose_name="Thời gian thêm")

    def __str__(self):
        return f"{self.service_name} (x{self.quantity})"

    class Meta:
        verbose_name = "Dịch vụ phát sinh"
        verbose_name_plural = "Dịch vụ phát sinh"

class Promotion(models.Model):
    DISCOUNT_TYPES = (
        ('percentage', 'Giảm theo phần trăm (%)'),
        ('fixed', 'Giảm số tiền cố định (VND)'),
    )

    code = models.CharField(max_length=20, unique=True, verbose_name="Mã giảm giá (VD: SUMMER2026)")
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPES, default='percentage', verbose_name="Loại khuyến mãi")
    discount_value = models.DecimalField(max_digits=12, decimal_places=0, verbose_name="Giá trị giảm")
    
    # Thiết lập thời gian
    valid_from = models.DateTimeField(verbose_name="Bắt đầu áp dụng")
    valid_to = models.DateTimeField(verbose_name="Kết thúc áp dụng")
    
    # Giới hạn sử dụng
    usage_limit = models.IntegerField(default=100, verbose_name="Tổng số lượt sử dụng tối đa")
    used_count = models.IntegerField(default=0, verbose_name="Số lượt đã dùng")
    
    # Điều kiện áp dụng
    min_order_value = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name="Giá trị đơn tối thiểu (VND)")
    max_discount_amount = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True, verbose_name="Mức giảm tối đa (VND) - Dùng cho %")
    
    is_active = models.BooleanField(default=True, verbose_name="Đang kích hoạt")

    def __str__(self):
        type_symbol = "%" if self.discount_type == 'percentage' else "VND"
        return f"{self.code} (-{self.discount_value}{type_symbol})"

    class Meta:
        verbose_name = "Mã Khuyến Mãi"
        verbose_name_plural = "2. Quản lý Khuyến Mãi"