from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, GuestProfile, EmployeeProfile

# Tùy chỉnh hiển thị cột trong trang Admin
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'phone_number', 'role', 'is_staff')
    list_filter = ('role', 'is_staff')
    # Hiển thị thêm các trường tùy chỉnh khi bấm vào xem chi tiết
    fieldsets = UserAdmin.fieldsets + (
        ('Thông tin Khách sạn', {'fields': ('phone_number', 'role', 'address', 'avatar')}),
    )

admin.site.register(User, CustomUserAdmin)
admin.site.register(GuestProfile)
admin.site.register(EmployeeProfile)