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
    # Liên kết 1-1 với Đơn đặt phòng lẻ HOẶC Đơn đặt đoàn
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='invoice', null=True, blank=True, verbose_name="Đơn đặt phòng lẻ")
    group_booking = models.OneToOneField(
        'bookings.GroupBooking',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='master_invoice',
        verbose_name="Hóa đơn tổng cho Đơn đoàn (Master Invoice)"
    )

    # Thông tin Hóa đơn VAT Doanh nghiệp
    is_company_invoice = models.BooleanField(default=False, verbose_name="Yêu cầu xuất hóa đơn công ty (VAT)")
    company_name = models.CharField(max_length=255, blank=True, null=True, verbose_name="Tên công ty xuất hóa đơn")
    company_tax_code = models.CharField(max_length=30, blank=True, null=True, verbose_name="Mã số thuế (MST)")
    company_address = models.CharField(max_length=255, blank=True, null=True, verbose_name="Địa chỉ công ty")
    invoice_recipient_email = models.EmailField(blank=True, null=True, verbose_name="Email nhận hóa đơn điện tử")
    
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
        code_ref = self.booking.booking_code if self.booking else (self.group_booking.group_code if self.group_booking else "N/A")
        return f"{self.invoice_code} - {code_ref}"

    # Tự động sinh mã hóa đơn (VD: INV-9A8B7C)
    def save(self, *args, **kwargs):
        if not self.invoice_code:
            self.invoice_code = f"INV-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "Hóa Đơn Thanh Toán"
        verbose_name_plural = "Quản lý Hóa Đơn"


class Payment(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Chờ xử lý'),
        ('COMPLETED', 'Đã hoàn tất'),
        ('FAILED', 'Thất bại'),
    )

    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='payments',
        null=True,
        blank=True,
        verbose_name="Đơn đặt phòng lẻ"
    )
    group_booking = models.ForeignKey(
        'bookings.GroupBooking',
        on_delete=models.CASCADE,
        related_name='payments',
        null=True,
        blank=True,
        verbose_name="Đơn đặt đoàn"
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name="Số tiền thanh toán"
    )
    payment_method = models.CharField(
        max_length=50,
        default='TRANSFER',
        verbose_name="Phương thức thanh toán"
    )
    payment_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING',
        verbose_name="Trạng thái thanh toán"
    )
    transaction_id = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Mã giao dịch"
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Thời gian thanh toán"
    )

    def save(self, *args, **kwargs):
        if not self.transaction_id:
            self.transaction_id = f"TXN-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        code_ref = self.booking.booking_code if self.booking else (self.group_booking.group_code if self.group_booking else "N/A")
        return f"Payment #{self.id} - {code_ref} - {self.amount} ({self.payment_status})"

    class Meta:
        verbose_name = "Thanh Toán"
        verbose_name_plural = "Danh sách Thanh Toán"
        ordering = ['-created_at']


class PaymentConfig(models.Model):
    """
    Cấu hình thông tin thanh toán VietQR (Mô hình Singleton - duy nhất 1 bản ghi).
    Admin có thể thay đổi số tài khoản, mã BIN ngân hàng và tên chủ thẻ trong Cài đặt hệ thống.
    """
    bank_bin = models.CharField(
        max_length=20,
        default='970422',
        verbose_name="Mã BIN ngân hàng"
    )
    account_no = models.CharField(
        max_length=50,
        default='123456789',
        verbose_name="Số tài khoản"
    )
    account_name = models.CharField(
        max_length=100,
        default='KHACH SAN TA DA NANG',
        verbose_name="Tên chủ tài khoản"
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name="Thời gian cập nhật gần nhất"
    )

    def save(self, *args, **kwargs):
        # Đảm bảo Singleton: Luôn cố định id=1
        self.pk = 1
        if self.account_name:
            self.account_name = self.account_name.strip().upper()
        if self.bank_bin:
            self.bank_bin = self.bank_bin.strip()
        if self.account_no:
            self.account_no = self.account_no.strip()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Không xóa cấu hình duy nhất
        pass

    @classmethod
    def get_solo(cls):
        """
        Lấy bản ghi cấu hình duy nhất. Nếu chưa có thì tự động tạo với giá trị mặc định.
        """
        obj, _ = cls.objects.get_or_create(
            pk=1,
            defaults={
                'bank_bin': '970422',
                'account_no': '123456789',
                'account_name': 'KHACH SAN TA DA NANG'
            }
        )
        return obj

    def __str__(self):
        return f"VietQR Config ({self.bank_bin} - {self.account_no} - {self.account_name})"

    class Meta:
        verbose_name = "Cấu hình Thanh toán VietQR"
        verbose_name_plural = "Cấu hình Thanh toán VietQR"