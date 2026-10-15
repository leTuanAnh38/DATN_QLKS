from django.contrib import admin
from .models import Booking, BookingExtraService, Promotion, BookingGuest, GroupBooking, CorporatePartner

# Tạo khối nhập Dịch vụ phát sinh ngay bên trong form Đặt phòng
class BookingExtraServiceInline(admin.TabularInline):
    model = BookingExtraService
    extra = 1

# Tạo khối quản lý Khách lưu trú ngay bên trong form Đặt phòng
class BookingGuestInline(admin.TabularInline):
    model = BookingGuest
    extra = 0
    fields = ('full_name', 'id_type', 'id_number', 'date_of_birth', 'gender', 'nationality', 'is_primary')

class BookingAdmin(admin.ModelAdmin):
    # 1. Xem toàn bộ danh sách & Cập nhật trạng thái nhanh
    list_display = ('booking_code', 'guest_info', 'room', 'check_in_date', 'check_out_date', 'status')
    list_editable = ('status',) # Sửa trạng thái trực tiếp không cần click vào trong
    
    # 2. Tìm kiếm theo Mã, Tên, Số điện thoại khách
    search_fields = ('booking_code', 'guest__username', 'guest__first_name', 'guest__phone_number')
    
    # 3. Lọc dữ liệu theo trạng thái và thời gian
    list_filter = ('status', 'check_in_date', 'created_at')
    
    readonly_fields = ('booking_code', 'created_at', 'updated_at')
    inlines = [BookingGuestInline, BookingExtraServiceInline] # Nhúng khối khách lưu trú & dịch vụ phát sinh vào
    
    # Nhóm các trường lại cho Lễ tân dễ nhìn
    fieldsets = (
        ('Thông tin chung', {
            'fields': ('booking_code', 'guest', 'room', 'status')
        }),
        ('Quản lý Lịch trình (Gia hạn tại đây)', {
            'fields': ('check_in_date', 'check_out_date', 'actual_check_in', 'actual_check_out')
        }),
        ('Tài chính & Ghi chú', {
            'fields': ('total_amount', 'note', 'internal_note')
        }),
        ('Hệ thống', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',) # Ẩn bớt cho gọn
        }),
    )

    # Hàm hỗ trợ gộp tên và số điện thoại ra danh sách ngoài
    def guest_info(self, obj):
        phone = obj.guest.phone_number if obj.guest.phone_number else "Không có SĐT"
        return f"{obj.guest.username} - {phone}"
    guest_info.short_description = "Khách hàng (SĐT)"

admin.site.register(Booking, BookingAdmin)

class PromotionAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount_type', 'discount_value', 'valid_from', 'valid_to', 'usage_limit', 'used_count', 'is_active')
    list_filter = ('is_active', 'discount_type')
    search_fields = ('code',)
    list_editable = ('is_active',) # Bật/tắt mã KM siêu nhanh từ ngoài danh sách
    
    fieldsets = (
        ('Cấu hình Mã & Giá trị', {
            'fields': ('code', 'discount_type', 'discount_value', 'is_active')
        }),
        ('Thời gian áp dụng', {
            'fields': ('valid_from', 'valid_to')
        }),
        ('Điều kiện & Giới hạn', {
            'fields': ('usage_limit', 'used_count', 'min_order_value', 'max_discount_amount')
        }),
    )

admin.site.register(Promotion, PromotionAdmin)


# ========================================================
# ĐỐI TÁC DOANH NGHIỆP & ĐƠN ĐẶT ĐOÀN
# ========================================================
class SubBookingInline(admin.TabularInline):
    model = Booking
    extra = 0
    fields = ('booking_code', 'category', 'room', 'check_in_date', 'check_out_date', 'total_amount', 'status')
    readonly_fields = ('booking_code',)
    show_change_link = True


class GroupBookingAdmin(admin.ModelAdmin):
    list_display = ('group_code', 'group_name', 'corporate_partner', 'leader_name', 'leader_phone', 'check_in_date', 'check_out_date', 'status', 'total_amount', 'deposit_amount', 'is_deposit_paid')
    list_filter = ('status', 'check_in_date', 'is_deposit_paid')
    search_fields = ('group_code', 'group_name', 'leader_name', 'leader_phone')
    readonly_fields = ('group_code', 'created_at', 'updated_at')
    inlines = [SubBookingInline]


class CorporatePartnerAdmin(admin.ModelAdmin):
    list_display = ('company_name', 'corporate_code', 'tax_code', 'contact_person', 'contact_phone', 'discount_percent', 'payment_terms_days', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('company_name', 'corporate_code', 'tax_code', 'contact_person')
    list_editable = ('discount_percent', 'is_active')


admin.site.register(GroupBooking, GroupBookingAdmin)
admin.site.register(CorporatePartner, CorporatePartnerAdmin)