from django.db import models
from ..bookings.models import Booking

# 1. BẢNG NHÓM DỊCH VỤ (VD: Spa, Nhà hàng, Vận chuyển)
class ServiceCategory(models.Model):
    name = models.CharField(max_length=100, verbose_name="Tên nhóm dịch vụ")
    icon = models.CharField(max_length=50, blank=True, verbose_name="Icon đại diện")
    description = models.TextField(blank=True, verbose_name="Mô tả")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Nhóm Dịch vụ"
        verbose_name_plural = "1. Nhóm Dịch vụ"


# 2. BẢNG DANH MỤC DỊCH VỤ CHI TIẾT (VD: Massage 60p, Buffet Sáng, Đưa đón Sân bay)
class ServiceItem(models.Model):
    category = models.ForeignKey(ServiceCategory, on_delete=models.CASCADE, related_name='services', verbose_name="Thuộc nhóm")
    name = models.CharField(max_length=100, verbose_name="Tên dịch vụ")
    price = models.DecimalField(max_digits=10, decimal_places=0, verbose_name="Đơn giá (VND)")
    image = models.ImageField(upload_to='services/', null=True, blank=True, verbose_name="Hình ảnh minh họa")
    is_active = models.BooleanField(default=True, verbose_name="Đang phục vụ")

    def __str__(self):
        return f"{self.name} - {self.price} đ"

    class Meta:
        verbose_name = "Dịch vụ"
        verbose_name_plural = "2. Danh sách Dịch vụ"


# 3. BẢNG TIẾP NHẬN YÊU CẦU DỊCH VỤ (TỪ KHÁCH HÀNG)
class ServiceRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Chờ xử lý (Mới)'),
        ('in_progress', 'Đang thực hiện'),
        ('completed', 'Đã hoàn thành'),
        ('cancelled', 'Đã hủy'),
    )

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='service_requests', verbose_name="Thuộc Đơn đặt phòng")
    service = models.ForeignKey(ServiceItem, on_delete=models.CASCADE, verbose_name="Dịch vụ yêu cầu")
    
    quantity = models.IntegerField(default=1, verbose_name="Số lượng")
    request_time = models.DateTimeField(verbose_name="Thời gian khách cần phục vụ")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name="Trạng thái")
    note = models.TextField(blank=True, null=True, verbose_name="Ghi chú (VD: Ít đường, Không hành...)")
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Giờ đặt lệnh")

    def __str__(self):
        return f"Yêu cầu {self.service.name} - {self.booking.booking_code}"

    class Meta:
        verbose_name = "Phiếu Yêu Cầu"
        verbose_name_plural = "3. Yêu cầu Dịch vụ (Concierge)"