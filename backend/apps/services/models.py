from django.db import models
from django.utils import timezone
from ..bookings.models import Booking

# 1. BẢNG NHÓM DỊCH VỤ (VD: Ẩm thực tại phòng, Spa & Trị liệu, Đồ uống & Bar, Tiện ích phòng)
class ServiceCategory(models.Model):
    name = models.CharField(max_length=100, verbose_name="Tên nhóm dịch vụ")
    icon = models.CharField(max_length=50, blank=True, verbose_name="Icon đại diện (Emoji hoặc Icon Class)")
    description = models.TextField(blank=True, verbose_name="Mô tả nhóm dịch vụ")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Nhóm Dịch vụ"
        verbose_name_plural = "1. Nhóm Dịch vụ"


# 2. BẢNG DANH MỤC DỊCH VỤ CHI TIẾT (VD: Bò Wagyu A5, Trà chiều hoàng gia, Massage đá nóng...)
class ServiceItem(models.Model):
    category = models.ForeignKey(ServiceCategory, on_delete=models.CASCADE, related_name='services', verbose_name="Thuộc nhóm")
    name = models.CharField(max_length=100, verbose_name="Tên dịch vụ / Món ăn")
    description = models.TextField(blank=True, default='', verbose_name="Mô tả chi tiết")
    price = models.DecimalField(max_digits=10, decimal_places=0, verbose_name="Đơn giá (VND)")
    image = models.ImageField(upload_to='services/', null=True, blank=True, verbose_name="Hình ảnh tải lên")
    image_url = models.CharField(max_length=500, blank=True, default='', verbose_name="Đường dẫn ảnh trực tuyến (URL)")
    is_active = models.BooleanField(default=True, verbose_name="Đang phục vụ")

    def __str__(self):
        return f"{self.name} - {self.price} đ"

    class Meta:
        verbose_name = "Dịch vụ"
        verbose_name_plural = "2. Danh sách Dịch vụ"


# 3. BẢNG TIẾP NHẬN YÊU CẦU DỊCH VỤ (TỪ KHÁCH HÀNG / IN-ROOM DINING & CONCIERGE)
class ServiceRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Chờ xử lý (Pending)'),
        ('in_progress', 'Đang thực hiện (In Progress)'),
        ('completed', 'Đã hoàn thành (Completed)'),
        ('cancelled', 'Đã hủy (Cancelled)'),
    )

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='service_requests', verbose_name="Thuộc Đơn đặt phòng")
    service = models.ForeignKey(ServiceItem, on_delete=models.CASCADE, related_name='requests', verbose_name="Dịch vụ yêu cầu")
    
    quantity = models.IntegerField(default=1, verbose_name="Số lượng")
    request_time = models.DateTimeField(null=True, blank=True, verbose_name="Thời gian khách cần phục vụ")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name="Trạng thái")
    note = models.TextField(blank=True, null=True, verbose_name="Ghi chú (VD: Ít đường, Không hành...)")
    total_price = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name="Tổng tiền (VND)")
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Giờ đặt lệnh")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Giờ cập nhật")

    def save(self, *args, **kwargs):
        if self.service and self.quantity:
            self.total_price = self.service.price * self.quantity
        if not self.request_time:
            self.request_time = timezone.now()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Yêu cầu {self.service.name} x{self.quantity} - {self.booking.booking_code}"

    class Meta:
        verbose_name = "Phiếu Yêu Cầu Dịch Vụ"
        verbose_name_plural = "3. Yêu cầu Dịch vụ (Concierge)"
        ordering = ['-created_at']