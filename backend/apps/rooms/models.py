from django.db import models

# 1. BẢNG TIỆN NGHI (Amenities)
class Amenity(models.Model):
    name = models.CharField(max_length=100, verbose_name="Tên tiện nghi (VD: Wifi, Smart TV, Ban công)")
    description = models.TextField(blank=True, default='', verbose_name="Mô tả tiện nghi")
    icon = models.CharField(max_length=50, blank=True, verbose_name="Icon (Mã CSS hoặc Emoji)")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Tiện nghi"
        verbose_name_plural = "1. Quản lý Tiện nghi"


# 2. BẢNG LOẠI PHÒNG (Room Categories)
class RoomCategory(models.Model):
    name = models.CharField(max_length=100, verbose_name="Tên loại phòng")
    slug = models.SlugField(unique=True, help_text="Tạo URL tự động")
    short_description = models.CharField(max_length=255, blank=True, default='', verbose_name="Mô tả ngắn")
    description = models.TextField(verbose_name="Mô tả chi tiết (HTML)", blank=True, default='')
    cancellation_policy = models.TextField(verbose_name="Chính sách hủy phòng", blank=True, default='')
    
    # Thiết lập cơ bản
    size = models.FloatField(verbose_name="Diện tích (m2)", help_text="VD: 45.5")
    bed_type = models.CharField(max_length=100, verbose_name="Loại giường", help_text="VD: 1 Giường Đôi King")
    capacity = models.IntegerField(default=2, verbose_name="Sức chứa (Người lớn)")
    
    # Quản lý giá
    base_price = models.DecimalField(max_digits=12, decimal_places=0, verbose_name="Giá phòng gốc (VND)")
    promo_price = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True, verbose_name="Giá khuyến mãi (VND)")
    
    # Tiện nghi đi kèm (Quan hệ Nhiều - Nhiều)
    amenities = models.ManyToManyField(Amenity, blank=True, related_name='room_categories', verbose_name="Tiện nghi đi kèm")

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Loại phòng"
        verbose_name_plural = "2. Quản lý Loại phòng"


# 3. BẢNG HÌNH ẢNH (Room Images) - Cho phép up nhiều ảnh cho 1 phòng
class RoomImage(models.Model):
    room_category = models.ForeignKey(RoomCategory, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='rooms/', verbose_name="Hình ảnh")
    is_feature = models.BooleanField(default=False, verbose_name="Là ảnh đại diện chính")

    class Meta:
        verbose_name = "Hình ảnh"
        verbose_name_plural = "Hình ảnh Phòng"


# 4. BẢNG DANH SÁCH PHÒNG THỰC TẾ (Rooms)
class Room(models.Model):
    STATUS_CHOICES = (
        ('available', 'Phòng trống'),
        ('occupied', 'Đang có khách'),
        ('cleaning', 'Đang dọn dẹp'),
        ('maintenance', 'Bảo trì'),
    )
    
    room_number = models.CharField(max_length=10, unique=True, verbose_name="Số phòng (VD: 101)")
    category = models.ForeignKey(RoomCategory, on_delete=models.CASCADE, related_name='rooms', verbose_name="Thuộc loại phòng")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available', verbose_name="Trạng thái")
    floor = models.IntegerField(verbose_name="Tầng")

    def __str__(self):
        return f"Phòng {self.room_number}"

    class Meta:
        verbose_name = "Phòng thực tế"
        verbose_name_plural = "3. Danh sách Phòng thực tế"


# 5. BẢNG PHIẾU BẢO TRÌ & SỬA CHỮA THIẾT BỊ PHÒNG
class MaintenanceTicket(models.Model):
    ROOM_ISSUE_TYPE = (
        ('electric', 'Hệ thống điện / Chiếu sáng'),
        ('ac', 'Điều hòa / Thông gió'),
        ('plumbing', 'Hệ thống nước / Thiết bị vệ sinh'),
        ('furniture', 'Nội thất / Bàn ghế / Khóa cửa'),
        ('electronics', 'Tivi / Tủ lạnh / Két sắt'),
        ('other', 'Khác'),
    )

    STATUS_CHOICES = (
        ('fixing', 'Đang bảo trì / Sửa chữa'),
        ('completed', 'Đã sửa xong & Bàn giao dọn dẹp'),
        ('cancelled', 'Đã hủy phiếu'),
    )

    ticket_code = models.CharField(max_length=20, unique=True, blank=True, verbose_name="Mã phiếu bảo trì")
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='maintenance_tickets', verbose_name="Phòng bảo trì")
    equipment_name = models.CharField(max_length=150, verbose_name="Tên thiết bị hư hỏng")
    issue_type = models.CharField(max_length=30, choices=ROOM_ISSUE_TYPE, default='ac', verbose_name="Phân loại sự cố")
    description = models.TextField(blank=True, default='', verbose_name="Mô tả sự cố chi tiết")

    # Thời gian
    start_date = models.DateTimeField(auto_now_add=True, verbose_name="Ngày tiếp nhận & Bắt đầu sửa")
    completed_date = models.DateTimeField(null=True, blank=True, verbose_name="Ngày hoàn tất sửa chữa")

    # Vật tư & Chi phí
    parts_replaced = models.CharField(max_length=255, blank=True, default='', verbose_name="Vật tư thay thế (VD: 1 Củ sen Inax, Tụ quạt 35uF)")
    cost = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name="Chi phí thay thế / sửa chữa (VND)")

    # Trách nhiệm chi trả
    is_guest_fault = models.BooleanField(default=False, verbose_name="Do khách làm hỏng (Khách bồi thường)?")
    booking = models.ForeignKey(
        'bookings.Booking',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='maintenance_tickets',
        verbose_name="Đơn đặt phòng bồi thường (nếu có)"
    )

    technician = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_maintenance_tickets',
        verbose_name="Kỹ thuật viên thực hiện"
    )
    created_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_maintenance_tickets',
        verbose_name="Người lập phiếu"
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='fixing', verbose_name="Trạng thái")
    note = models.TextField(blank=True, default='', verbose_name="Ghi chú hoàn tất")

    def save(self, *args, **kwargs):
        if not self.ticket_code:
            import uuid
            self.ticket_code = f"MT-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.ticket_code} - P.{self.room.room_number}: {self.equipment_name} ({self.get_status_display()})"

    class Meta:
        verbose_name = "Phiếu Bảo Trì & Sửa Chữa"
        verbose_name_plural = "4. Phiếu Bảo Trì Thiết Bị"
        ordering = ['-start_date']