from django.contrib import admin
from .models import Amenity, RoomCategory, RoomImage, Room

# Khối hỗ trợ up nhiều ảnh cùng lúc
class RoomImageInline(admin.TabularInline):
    model = RoomImage
    extra = 3 # Mặc định hiển thị sẵn 3 ô để up ảnh

class RoomCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'base_price', 'promo_price', 'capacity', 'size')
    prepopulated_fields = {'slug': ('name',)} # Tự động điền slug theo tên
    filter_horizontal = ('amenities',) # Giao diện chọn tiện nghi dạng 2 cột đẹp mắt
    inlines = [RoomImageInline] # Nhúng khối up ảnh vào trong Loại phòng

class RoomAdmin(admin.ModelAdmin):
    list_display = ('room_number', 'category', 'status', 'floor')
    list_filter = ('status', 'category', 'floor')
    search_fields = ('room_number',)
    list_editable = ('status',) # Cho phép Lễ tân đổi trạng thái nhanh ngoài danh sách mà không cần bấm vào trong

# Đăng ký lên Admin
admin.site.register(Amenity)
admin.site.register(RoomCategory, RoomCategoryAdmin)
admin.site.register(Room, RoomAdmin)