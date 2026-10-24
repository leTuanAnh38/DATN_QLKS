import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings
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
        ('mixed', 'Thanh toán hỗn hợp'),
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


class CashierShift(models.Model):
    """
    Quản lý Ca làm việc & Két tiền mặt của Thu ngân / Lễ tân (Cashier Shift & Cash Drawer).
    Theo dõi chi tiết số tiền mở ca, dòng tiền thu/chi trong ca và đối soát kết ca (Z-Report).
    """
    SHIFT_TYPE_CHOICES = (
        ('MORNING', 'Ca Sáng (06:00 - 14:00)'),
        ('AFTERNOON', 'Ca Chiều (14:00 - 22:00)'),
        ('NIGHT', 'Ca Đêm (22:00 - 06:00)'),
        ('STANDARD', 'Ca Hành Chính (08:00 - 17:00)'),
    )

    STATUS_CHOICES = (
        ('OPEN', 'Đang mở (Hoạt động)'),
        ('CLOSED', 'Đã kết ca & Bàn giao'),
    )

    shift_code = models.CharField(max_length=30, unique=True, blank=True, verbose_name="Mã ca làm việc")
    shift_type = models.CharField(max_length=20, choices=SHIFT_TYPE_CHOICES, default='MORNING', verbose_name="Loại ca làm việc")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='cashier_shifts',
        verbose_name="Nhân viên trực ca"
    )
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='OPEN', verbose_name="Trạng thái ca")
    opened_at = models.DateTimeField(auto_now_add=True, verbose_name="Thời gian mở ca")
    closed_at = models.DateTimeField(null=True, blank=True, verbose_name="Thời gian đóng ca")

    # Quỹ tiền mặt
    opening_cash = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name="Tiền mặt đầu ca (Float)")
    actual_cash = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True, verbose_name="Tiền mặt thực tế kiểm đếm")
    expected_cash = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True, verbose_name="Tiền mặt dự kiến theo hệ thống")
    difference = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True, verbose_name="Chênh lệch tiền mặt (Thừa/Thiếu)")

    # Doanh thu ghi nhận trong ca
    total_cash_in = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name="Tổng tiền mặt thu vào")
    total_transfer_in = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name="Tổng chuyển khoản VietQR")
    total_card_in = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name="Tổng quẹt thẻ POS")
    total_cash_out = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name="Tổng chi tiền mặt")

    handover_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='received_shifts',
        verbose_name="Nhân viên nhận bàn giao ca"
    )
    notes = models.TextField(blank=True, null=True, verbose_name="Ghi chú mở/kết ca")
    denominations = models.JSONField(blank=True, null=True, verbose_name="Chi tiết số lượng từng mệnh giá tiền")

    def save(self, *args, **kwargs):
        if not self.shift_code:
            from django.utils import timezone
            now = timezone.now()
            self.shift_code = f"SHIFT-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        super().save(*args, **kwargs)

    def calculate_current_summary(self):
        """
        Tính toán số liệu dòng tiền theo thời gian thực (real-time) của ca này.
        """
        from django.utils import timezone
        end_time = self.closed_at or timezone.now()

        # Payments gắn trực tiếp với ca HOẶC phát sinh trong khung giờ ca nếu chưa gắn
        shift_payments = Payment.objects.filter(
            models.Q(shift=self) | (
                models.Q(shift__isnull=True) &
                models.Q(created_at__gte=self.opened_at) &
                models.Q(created_at__lte=end_time)
            ),
            payment_status='COMPLETED'
        )

        cash_in = Decimal('0')
        transfer_in = Decimal('0')
        card_in = Decimal('0')

        for p in shift_payments:
            pm = str(p.payment_method).upper()
            amt = Decimal(str(p.amount or 0))
            if pm == 'CASH':
                cash_in += amt
            elif pm in ['TRANSFER', 'VIETQR', 'BANK_TRANSFER']:
                transfer_in += amt
            elif pm in ['CARD', 'CREDIT_CARD', 'POS']:
                card_in += amt
            else:
                transfer_in += amt

        # Phiếu chi tiền mặt và chuyển khoản gắn trực tiếp với ca
        cash_out = Decimal('0')
        transfer_out = Decimal('0')
        all_shift_vouchers = self.cash_outs.all() if hasattr(self, 'cash_outs') else []
        for v in all_shift_vouchers:
            amt = Decimal(str(v.amount or 0))
            if str(v.payment_method).upper() == 'TRANSFER':
                transfer_out += amt
            else:
                cash_out += amt

        if cash_out == Decimal('0') and self.total_cash_out:
            cash_out = Decimal(str(self.total_cash_out))

        expected = Decimal(str(self.opening_cash or 0)) + cash_in - cash_out

        return {
            'opening_cash': float(self.opening_cash or 0),
            'cash_in': float(cash_in),
            'total_cash_in': float(cash_in),
            'transfer_in': float(transfer_in),
            'total_transfer_in': float(transfer_in),
            'card_in': float(card_in),
            'total_card_in': float(card_in),
            'cash_out': float(cash_out),
            'total_cash_out': float(cash_out),
            'transfer_out': float(transfer_out),
            'total_transfer_out': float(transfer_out),
            'expected_cash': float(expected),
            'total_revenue': float(cash_in + transfer_in + card_in),
            'net_transfer': float(transfer_in - transfer_out),
            'payments_count': shift_payments.count(),
            'cash_outs_count': len(all_shift_vouchers),
        }

    def __str__(self):
        return f"{self.shift_code} - {self.get_shift_type_display()} ({self.user.username})"

    class Meta:
        verbose_name = "Ca làm việc thu ngân"
        verbose_name_plural = "Quản lý Ca làm việc & Két tiền"
        ordering = ['-opened_at']


class Payment(models.Model):
    STATUS_CHOICES = (
        ('PENDING', 'Chờ xử lý'),
        ('COMPLETED', 'Đã hoàn tất'),
        ('FAILED', 'Thất bại'),
    )

    shift = models.ForeignKey(
        CashierShift,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments',
        verbose_name="Ca làm việc"
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


class CashOutVoucher(models.Model):
    """
    Phiếu Chi Tiền Mặt & Hoàn Tiền (Cash Out & Refund Voucher)
    Quản lý các khoản chi tiền trực tiếp từ két ca quầy hoặc hoàn chuyển khoản:
    1. REFUND_DEPOSIT: Hoàn cọc / Trả tiền thừa đơn phòng khi Checkout hoặc trả cọc bảo đảm
    2. REFUND_CANCEL: Hoàn tiền cọc khi hủy đơn phòng / đơn đoàn hợp lệ
    3. PETTY_CASH: Chi phí phát sinh nội bộ quầy tiếp tân (mua đá, văn phòng phẩm, taxi...)
    """
    VOUCHER_TYPES = (
        ('REFUND_DEPOSIT', 'Hoàn cọc / Trả tiền thừa đơn phòng'),
        ('REFUND_CANCEL', 'Hoàn cọc hủy đơn phòng/đoàn'),
        ('PETTY_CASH', 'Chi phí nội bộ quầy tiếp tân'),
    )
    METHOD_CHOICES = (
        ('CASH', 'Tiền mặt (Két quầy)'),
        ('TRANSFER', 'Chuyển khoản ngân hàng'),
    )

    voucher_code = models.CharField(max_length=50, unique=True, blank=True, verbose_name="Mã phiếu chi")
    shift = models.ForeignKey(
        CashierShift,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cash_outs',
        verbose_name="Ca trực quầy"
    )
    voucher_type = models.CharField(
        max_length=30,
        choices=VOUCHER_TYPES,
        default='REFUND_DEPOSIT',
        verbose_name="Loại phiếu chi"
    )
    payment_method = models.CharField(
        max_length=20,
        choices=METHOD_CHOICES,
        default='CASH',
        verbose_name="Hình thức chi"
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name="Số tiền chi (VND)"
    )
    booking = models.ForeignKey(
        Booking,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cash_outs',
        verbose_name="Đơn đặt phòng liên quan"
    )
    group_booking = models.ForeignKey(
        'bookings.GroupBooking',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cash_outs',
        verbose_name="Đơn đoàn liên quan"
    )
    recipient_name = models.CharField(max_length=150, verbose_name="Người nhận tiền")
    recipient_phone = models.CharField(max_length=20, blank=True, null=True, verbose_name="SĐT người nhận")
    reason = models.TextField(verbose_name="Lý do chi tiền")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_cash_outs',
        verbose_name="Nhân viên lập phiếu"
    )
    approved_by = models.CharField(max_length=150, blank=True, null=True, verbose_name="Người phê duyệt")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Thời gian lập phiếu")

    def save(self, *args, **kwargs):
        if not self.voucher_code:
            from django.utils import timezone
            now = timezone.now()
            self.voucher_code = f"PC-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.voucher_code} - {self.get_voucher_type_display()} - {self.amount:,.0f} đ"

    class Meta:
        verbose_name = "Phiếu chi & Hoàn tiền"
        verbose_name_plural = "Quản lý Phiếu chi & Hoàn tiền"
        ordering = ['-created_at']