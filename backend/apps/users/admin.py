from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, GuestProfile, EmployeeProfile, AuditLog

# Tùy chỉnh hiển thị cột trong trang Admin
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'phone_number', 'role', 'is_staff')
    list_filter = ('role', 'is_staff')
    # Hiển thị thêm các trường tùy chỉnh khi bấm vào xem chi tiết
    fieldsets = UserAdmin.fieldsets + (
        ('Thông tin Khách sạn', {'fields': ('phone_number', 'role', 'address', 'avatar')}),
    )

class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'user', 'action', 'module', 'ip_address')
    list_filter = ('action', 'module', 'created_at')
    search_fields = ('user__username', 'description', 'ip_address')
    readonly_fields = ('user', 'action', 'module', 'description', 'ip_address', 'created_at')

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

admin.site.register(User, CustomUserAdmin)
admin.site.register(GuestProfile)
admin.site.register(EmployeeProfile)
admin.site.register(AuditLog, AuditLogAdmin)