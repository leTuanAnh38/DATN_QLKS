from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, GuestProfile, EmployeeProfile, AuditLog, MembershipTier

# Tùy chỉnh hiển thị cột trong trang Admin
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'phone_number', 'role', 'current_tier', 'total_points', 'is_staff')
    list_filter = ('role', 'current_tier', 'is_staff')
    # Hiển thị thêm các trường tùy chỉnh khi bấm vào xem chi tiết
    fieldsets = UserAdmin.fieldsets + (
        ('Thông tin Khách sạn', {'fields': ('phone_number', 'role', 'address', 'avatar')}),
        ('Chương trình Thành viên (Loyalty)', {'fields': ('current_tier', 'total_points')}),
    )

class MembershipTierAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'min_points', 'discount_percent', 'order')
    list_editable = ('min_points', 'discount_percent', 'order')
    search_fields = ('name', 'code')
    ordering = ('order', 'min_points')

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
admin.site.register(MembershipTier, MembershipTierAdmin)