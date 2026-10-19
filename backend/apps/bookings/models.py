import uuid
from django.db import models
from ..users.models import User
from ..rooms.models import Room

# ========================================================
# BẢNG 1: ĐỐI TÁC DOANH NGHIỆP (B2B CORPORATE PARTNERS)
# ========================================================
class CorporatePartner(models.Model):
    """
    Quản lý Danh bạ Khách hàng Doanh nghiệp / Đối tác B2B (Công ty du lịch, Tập đoàn ký hợp đồng).
    """
    company_name = models.CharField(max_length=255, verbose_name="Tên công ty / Doanh nghiệp")
    tax_code = models.CharField(max_length=30, unique=True, verbose_name="Mã số thuế (MST)")
    company_address = models.CharField(max_length=255, verbose_name="Địa chỉ đăng ký kinh doanh")
    corporate_code = models.CharField(max_length=30, unique=True, verbose_name="Mã Doanh nghiệp / Mã ưu đãi (VD: FPT2026)")
    contact_person = models.CharField(max_length=100, verbose_name="Người phụ trách / Đại diện liên hệ")
    contact_phone = models.CharField(max_length=20, verbose_name="Số điện thoại liên hệ")
    contact_email = models.EmailField(verbose_name="Email nhận hóa đơn / Báo giá")
    contract_number = models.CharField(max_length=50, blank=True, null=True, verbose_name="Số hợp đồng")
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=10.0, verbose_name="Tỷ lệ chiết khấu hợp đồng (%)")
    payment_terms_days = models.PositiveIntegerField(default=0, verbose_name="Hạn mức công nợ (Số ngày: 0 = TT ngay, 15, 30)")
    is_active = models.BooleanField(default=True, verbose_name="Đang hợp tác")
    note = models.TextField(blank=True, null=True, verbose_name="Ghi chú điều khoản hợp đồng")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Ngày ký kết / Thêm mới")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Ngày cập nhật")

    def __str__(self):
        return f"{self.company_name} ({self.corporate_code} - Giảm {self.discount_percent}%)"

    class Meta:
        verbose_name = "Đối tác Doanh nghiệp"
        verbose_name_plural = "4. Đối tác Doanh nghiệp (B2B)"
        ordering = ['-created_at']


# ========================================================
# BẢNG 2: ĐƠN ĐẶT ĐOÀN MASTER (GROUP BOOKINGS)
# ========================================================
class GroupBooking(models.Model):
    """
    Đơn đặt đoàn Master (Quản lý gộp nhiều phòng cho Khách đoàn du lịch / Công ty M.I.C.E).
    """
    STATUS_CHOICES = (
        ('tentative', 'Giữ chỗ tạm thời (Chờ cọc)'),
        ('confirmed', 'Đã xác nhận (Đã cọc)'),
        ('checked_in', 'Đang lưu trú (In-house)'),
        ('checked_out', 'Đã trả phòng (Check-out)'),
        ('completed', 'Đã quyết toán & Hoàn tất'),
        ('cancelled', 'Đã Hủy'),
    )

    group_code = models.CharField(max_length=20, unique=True, blank=True, verbose_name="Mã Đơn Đoàn")
    group_name = models.CharField(max_length=200, verbose_name="Tên đoàn / Mục đích (VD: FPT Telecom Team Building)")
    corporate_partner = models.ForeignKey(
        CorporatePartner, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='group_bookings',
        verbose_name="Thuộc Doanh nghiệp đối tác"
    )
    
    # Đại diện liên hệ
    leader_name = models.CharField(max_length=100, verbose_name="Trưởng đoàn / Người phụ trách")
    leader_phone = models.CharField(max_length=20, verbose_name="SĐT Trưởng đoàn")
    leader_email = models.EmailField(blank=True, null=True, verbose_name="Email Trưởng đoàn")

    # Thời gian lưu trú chung
    check_in_date = models.DateField(verbose_name="Ngày Check-in chung")
    check_out_date = models.DateField(verbose_name="Ngày Check-out chung")

    # Tài chính & Đặt cọc
    total_amount = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name="Tổng tiền dự kiến toàn đoàn (VND)")
    deposit_amount = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name="Tiền đặt cọc (VND)")
    is_deposit_paid = models.BooleanField(default=False, verbose_name="Đã thanh toán tiền cọc")
    
    BILLING_TYPE_CHOICES = (
        ('ROOM_ONLY', 'Công ty chỉ trả tiền phòng (Khách tự trả phát sinh)'),
        ('ALL_INCLUSIVE', 'Công ty chi trả toàn bộ (Tiền phòng + Dịch vụ phát sinh)'),
    )
    billing_type = models.CharField(
        max_length=20,
        choices=BILLING_TYPE_CHOICES,
        default='ROOM_ONLY',
        verbose_name="Chính sách thanh toán chi phí phát sinh"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='tentative', verbose_name="Trạng thái")
    note = models.TextField(blank=True, null=True, verbose_name="Ghi chú yêu cầu đặc biệt của đoàn")
    internal_note = models.TextField(blank=True, null=True, verbose_name="Ghi chú nội bộ (Lễ tân/Kinh doanh)")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Ngày tạo đoàn")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Ngày cập nhật")

    def __str__(self):
        return f"{self.group_code} - {self.group_name} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        if not self.group_code:
            self.group_code = f"GRP-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "Đơn Đặt Đoàn"
        verbose_name_plural = "5. Quản lý Đặt Đoàn (Groups)"
        ordering = ['-created_at']


class Booking(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Đang chờ duyệt'),
        ('confirmed', 'Đã xác nhận'),
        ('paid', 'Đã thanh toán'),
        ('PAID', 'Đã thanh toán'),
        ('checked_in', 'Đã Check-in'),
        ('checked_out', 'Đã Check-out'),
        ('completed', 'Đã hoàn tất'),
        ('no_show', 'Khách không đến (No-show)'),
        ('cancelled', 'Đã Hủy'),
    )

    booking_code = models.CharField(max_length=20, unique=True, blank=True, verbose_name="Mã Đặt Phòng")
    guest = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings', verbose_name="Khách hàng")
    category = models.ForeignKey('rooms.RoomCategory', on_delete=models.SET_NULL, null=True, blank=True, related_name='bookings', verbose_name="Hạng phòng đã đặt")
    room = models.ForeignKey(Room, on_delete=models.SET_NULL, null=True, blank=True, related_name='bookings', verbose_name="Phòng thực tế (Gán khi Check-in)")

    # Liên kết Khách đoàn / Doanh nghiệp
    CUSTOMER_TYPE_CHOICES = (
        ('MEMBER', 'Cá nhân / Gia đình'),
        ('CORPORATE', 'Doanh nghiệp / Đoàn thể'),
    )
    customer_type = models.CharField(
        max_length=20, 
        choices=CUSTOMER_TYPE_CHOICES, 
        default='MEMBER', 
        verbose_name="Phân loại đối tượng khách hàng"
    )
    company_name = models.CharField(
        max_length=255, 
        blank=True, 
        null=True, 
        verbose_name="Tên công ty / Doanh nghiệp"
    )
    company_tax_code = models.CharField(
        max_length=30, 
        blank=True, 
        null=True, 
        verbose_name="Mã số thuế (MST)"
    )
    company_address = models.CharField(
        max_length=255, 
        blank=True, 
        null=True, 
        verbose_name="Địa chỉ xuất hóa đơn GTGT"
    )
    group_booking = models.ForeignKey(
        GroupBooking, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='sub_bookings', 
        verbose_name="Thuộc Đơn đặt đoàn"
    )
    is_master_billed = models.BooleanField(
        default=True, 
        verbose_name="Tính tiền vào Hóa đơn tổng của đoàn"
    )
    
    # Thông tin định danh pháp lý
    identity_card = models.CharField(max_length=20, default='', verbose_name="Số CCCD / Hộ chiếu")

    # Quản lý thời gian & Gia hạn
    check_in_date = models.DateField(verbose_name="Ngày Check-in (Dự kiến)")
    check_out_date = models.DateField(verbose_name="Ngày Check-out (Có thể gia hạn)")
    actual_check_in = models.DateTimeField(null=True, blank=True, verbose_name="Giờ Check-in thực tế")
    actual_check_out = models.DateTimeField(null=True, blank=True, verbose_name="Giờ Check-out thực tế")

    total_amount = models.DecimalField(max_digits=12, decimal_places=0, verbose_name="Tổng tiền phòng (VND)")
    membership_discount = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name="Giảm giá Hạng thành viên (VND)")
    applied_promotion = models.ForeignKey('Promotion', on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Mã KM áp dụng")
    is_points_awarded = models.BooleanField(default=False, verbose_name="Đã cộng điểm tích lũy")
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
    is_paid = models.BooleanField(default=False, verbose_name="Đã thanh toán")
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
    name = models.CharField(max_length=200, default='', blank=True, verbose_name="Tên chương trình khuyến mãi")
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


# BẢNG QUẢN LÝ KHÁCH LƯU TRÚ (KHAI BÁO LƯU TRÚ KHI CHECK-IN)
class BookingGuest(models.Model):
    ID_TYPE_CHOICES = (
        ('CCCD', 'Căn cước công dân / CMND'),
        ('PASSPORT', 'Hộ chiếu (Passport)'),
        ('OTHER', 'Khác / Giấy khai sinh'),
    )

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='guests', verbose_name="Thuộc Đơn đặt phòng")
    full_name = models.CharField(max_length=100, verbose_name="Họ và tên")
    id_type = models.CharField(max_length=20, choices=ID_TYPE_CHOICES, default='CCCD', verbose_name="Loại giấy tờ")
    id_number = models.CharField(max_length=50, blank=True, null=True, verbose_name="Số CCCD / Hộ chiếu")
    date_of_birth = models.DateField(null=True, blank=True, verbose_name="Ngày sinh")
    gender = models.CharField(max_length=20, null=True, blank=True, verbose_name="Giới tính")
    nationality = models.CharField(max_length=50, default='Việt Nam', verbose_name="Quốc tịch")
    is_primary = models.BooleanField(default=False, verbose_name="Là người đại diện đặt phòng")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Thời gian khai báo")

    def __str__(self):
        primary_label = " (Đại diện)" if self.is_primary else ""
        return f"{self.full_name}{primary_label} - #{self.booking.booking_code}"

    class Meta:
        verbose_name = "Khách lưu trú"
        verbose_name_plural = "3. Khai báo Lưu trú (Guests)"
        ordering = ['-is_primary', 'created_at']


# ========================================================
# BẢNG CÀI ĐẶT THÔNG TIN KHÁCH SẠN & VẬN HÀNH (SINGLETON)
# ========================================================
class HotelSetting(models.Model):
    """
    Cấu hình Thông tin Khách sạn, Quy định Nhận/Trả phòng, Phụ thu & Chính sách vận hành (Singleton - PK=1).
    Admin/Owner có thể chỉnh sửa tại trang Cài Đặt Hệ Thống.
    """
    # 1. Thông tin thương hiệu & Liên hệ
    hotel_name = models.CharField(max_length=200, default='Khách Sạn TA Đà Nẵng', verbose_name="Tên khách sạn")
    hotel_slogan = models.CharField(max_length=255, default='5-Star Luxury Resort & Hotel', verbose_name="Khẩu hiệu / Slogan")
    stars = models.PositiveIntegerField(default=5, verbose_name="Tiêu chuẩn số sao")
    address = models.CharField(max_length=255, default='08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Quận Ngũ Hành Sơn, TP. Đà Nẵng', verbose_name="Địa chỉ khách sạn")
    hotline = models.CharField(max_length=50, default='1900 8899', verbose_name="Hotline lễ tân")
    phone_number = models.CharField(max_length=50, default='+84 (0) 236 388 9900', verbose_name="Điện thoại bàn")
    email = models.EmailField(default='contact@tahotel.vn', verbose_name="Email liên hệ / CSKH")
    website = models.CharField(max_length=200, default='https://tahotel.vn', verbose_name="Website chính thức")
    tax_code = models.CharField(max_length=50, default='0401234567', verbose_name="Mã số thuế (MST)")
    description = models.TextField(
        default='Kiệt tác nghỉ dưỡng 5 sao giao hòa giữa vẻ đẹp di sản truyền thống và kiến trúc hiện đại chuẩn quốc tế. Nơi tái định nghĩa chuẩn mực sang trọng và sự thư thái tinh khiết.',
        verbose_name="Giới thiệu khách sạn"
    )

    # 2. Quy định Giờ Nhận / Trả phòng
    check_in_time = models.CharField(max_length=10, default='14:00', verbose_name="Giờ Check-in tiêu chuẩn")
    check_out_time = models.CharField(max_length=10, default='12:00', verbose_name="Giờ Check-out tiêu chuẩn")

    # 3. Phụ thu Check-in sớm (%)
    early_checkin_before_6am = models.DecimalField(max_digits=5, decimal_places=2, default=100.0, verbose_name="Phụ thu nhận phòng trước 06:00 (%)")
    early_checkin_6am_9am = models.DecimalField(max_digits=5, decimal_places=2, default=50.0, verbose_name="Phụ thu nhận phòng 06:00 - 09:00 (%)")
    early_checkin_9am_12pm = models.DecimalField(max_digits=5, decimal_places=2, default=30.0, verbose_name="Phụ thu nhận phòng 09:00 - 12:00 (%)")

    # 4. Phụ thu Check-out muộn (%)
    late_checkout_12pm_3pm = models.DecimalField(max_digits=5, decimal_places=2, default=30.0, verbose_name="Phụ thu trả phòng 12:00 - 15:00 (%)")
    late_checkout_3pm_6pm = models.DecimalField(max_digits=5, decimal_places=2, default=50.0, verbose_name="Phụ thu trả phòng 15:00 - 18:00 (%)")
    late_checkout_after_6pm = models.DecimalField(max_digits=5, decimal_places=2, default=100.0, verbose_name="Phụ thu trả phòng sau 18:00 (%)")

    # 5. Chính sách Thuế VAT, Phí Dịch Vụ & Đặt Cọc
    vat_percent = models.DecimalField(max_digits=5, decimal_places=2, default=8.0, verbose_name="Thuế GTGT / VAT (%)")
    service_charge_percent = models.DecimalField(max_digits=5, decimal_places=2, default=5.0, verbose_name="Phí dịch vụ khách sạn (%)")
    group_deposit_percent = models.DecimalField(max_digits=5, decimal_places=2, default=50.0, verbose_name="Tỷ lệ cọc đặt đoàn (%)")
    auto_cancel_minutes = models.PositiveIntegerField(default=30, verbose_name="Thời gian giữ phòng chờ thanh toán (phút)")
    cancellation_free_hours = models.PositiveIntegerField(default=48, verbose_name="Hủy phòng miễn phí trước (giờ)")

    # 6. Logo & Favicon thương hiệu
    logo_url = models.CharField(max_length=500, blank=True, null=True, verbose_name="Logo thương hiệu (URL / File)")
    favicon_url = models.CharField(max_length=500, blank=True, null=True, verbose_name="Favicon website (URL / File)")

    # 7. Banner của từng trang (Hero Banners)
    banner_home = models.CharField(max_length=500, blank=True, null=True, verbose_name="Banner Trang Chủ (Slide 1)")
    banner_home_2 = models.CharField(max_length=500, blank=True, null=True, verbose_name="Banner Trang Chủ (Slide 2)")
    banner_home_3 = models.CharField(max_length=500, blank=True, null=True, verbose_name="Banner Trang Chủ (Slide 3)")
    banner_rooms = models.CharField(max_length=500, blank=True, null=True, verbose_name="Banner Trang Phòng & Suites")
    banner_services = models.CharField(max_length=500, blank=True, null=True, verbose_name="Banner Trang Dịch Vụ")
    banner_promotions = models.CharField(max_length=500, blank=True, null=True, verbose_name="Banner Trang Khuyến Mãi")
    banner_news = models.CharField(max_length=500, blank=True, null=True, verbose_name="Banner Trang Tin Tức")
    banner_contact = models.CharField(max_length=500, blank=True, null=True, verbose_name="Banner Trang Liên Hệ")
    banner_corporate = models.CharField(max_length=500, blank=True, null=True, verbose_name="Banner Trang Đặt Đoàn (MICE)")

    updated_at = models.DateTimeField(auto_now=True, verbose_name="Thời gian cập nhật")

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        pass

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(
            pk=1,
            defaults={
                'hotel_name': 'Khách Sạn TA Đà Nẵng',
                'hotel_slogan': '5-Star Luxury Resort & Hotel',
                'stars': 5,
                'address': '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Quận Ngũ Hành Sơn, TP. Đà Nẵng',
                'hotline': '1900 8899',
                'phone_number': '+84 (0) 236 388 9900',
                'email': 'contact@tahotel.vn',
                'website': 'https://tahotel.vn',
                'tax_code': '0401234567',
                'logo_url': '',
                'favicon_url': '',
                'banner_home': 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1920&q=80',
                'banner_home_2': 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1920&q=80',
                'banner_home_3': 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1920&q=80',
                'banner_rooms': 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=2074&q=85',
                'banner_services': 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=2070&q=85',
                'banner_promotions': 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
                'banner_news': 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=2000&q=85',
                'banner_contact': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2070&q=90',
                'banner_corporate': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
                'check_in_time': '14:00',
                'check_out_time': '12:00',
                'early_checkin_before_6am': 100.0,
                'early_checkin_6am_9am': 50.0,
                'early_checkin_9am_12pm': 30.0,
                'late_checkout_12pm_3pm': 30.0,
                'late_checkout_3pm_6pm': 50.0,
                'late_checkout_after_6pm': 100.0,
                'vat_percent': 8.0,
                'service_charge_percent': 5.0,
                'group_deposit_percent': 50.0,
                'auto_cancel_minutes': 30,
                'cancellation_free_hours': 48,
            }
        )
        return obj

    @classmethod
    def get_settings(cls):
        return cls.get_solo()

    def __str__(self):
        return f"{self.hotel_name} - Cấu hình Hệ thống"

    class Meta:
        verbose_name = "Cài đặt Khách Sạn & Vận Hành"
        verbose_name_plural = "Cài đặt Khách Sạn & Vận Hành"