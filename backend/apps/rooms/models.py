from django.db import models

# 1. BẢNG TIỆN NGHI (Amenities)
class Amenity(models.Model):
    name = models.CharField(max_length=100, verbose_name="Tên tiện nghi (VD: Wifi, Smart TV, Ban công)")
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
    description = models.TextField(verbose_name="Mô tả chi tiết", blank=True)
    
    # Thiết lập cơ bản
    size = models.FloatField(verbose_name="Diện tích (m2)", help_text="VD: 45.5")
    bed_type = models.CharField(max_length=100, verbose_name="Loại giường", help_text="VD: 1 Giường Đôi King")
    capacity = models.IntegerField(default=2, verbose_name="Sức chứa (Người lớn)")
    
    # Quản lý giá
    base_price = models.DecimalField(max_digits=12, decimal_places=0, verbose_name="Giá phòng gốc (VND)")
    promo_price = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True, verbose_name="Giá khuyến mãi (VND)")
    
    # Tiện nghi đi kèm (Quan hệ Nhiều - Nhiều)
    amenities = models.ManyToManyField(Amenity, blank=True, verbose_name="Tiện nghi đi kèm")

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