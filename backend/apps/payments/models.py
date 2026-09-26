import uuid
from django.db import models
from ..bookings.models import Booking

class Invoice(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Chờ thanh toán'),
        ('paid', 'Đã thanh toán'),
        ('refunded', 'Đã hoàn tiền'),
        ('cancelled', 'Đã hủy'),
    )
    
    METHOD_CHOICES = (
        ('cash', 'Tiền mặt'),
        ('credit_card', 'Thẻ tín dụng / Ghi nợ'),
        ('bank_transfer', 'Chuyển khoản ngân hàng'),
        ('momo', 'Ví điện tử (Momo/ZaloPay)'),
    )

    invoice_code = models.CharField(max_length=20, unique=True, blank=True, verbose_name="Mã Hóa Đơn")
    # Liên kết 1-1 với Đơn đặt phòng (Mỗi booking có 1 hóa đơn tổng)
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='invoice', verbose_name="Đơn đặt phòng")
    
    # Chi tiết dòng tiền
    room_charge = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name="Tổng tiền phòng")
    service_charge = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name="Tổng tiền dịch vụ phát sinh")
    discount = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name="Giảm giá / Voucher")
    tax = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name="Thuế VAT")
    total_amount = models.DecimalField(max_digits=12, decimal_places=0, verbose_name="TỔNG THANH TOÁN (VND)")

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name="Trạng thái")
    payment_method = models.CharField(max_length=50, choices=METHOD_CHOICES, null=True, blank=True, verbose_name="Phương thức thanh toán")
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Ngày lập hóa đơn")
    paid_at = models.DateTimeField(null=True, blank=True, verbose_name="Thời gian thanh toán thành công")

    def __str__(self):
        return f"{self.invoice_code} - {self.booking.booking_code}"

    # Tự động sinh mã hóa đơn (VD: INV-9A8B7C)
    def save(self, *args, **kwargs):
        if not self.invoice_code:
            self.invoice_code = f"INV-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "Hóa Đơn Thanh Toán"
        verbose_name_plural = "Quản lý Hóa Đơn"