from django.contrib import admin
from .models import ServiceCategory, ServiceItem, ServiceRequest

class ServiceItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'is_active')
    list_filter = ('category', 'is_active')
    search_fields = ('name',)

class ServiceRequestAdmin(admin.ModelAdmin):
    # Hiển thị rõ Booking nào đang gọi dịch vụ gì, giờ nào, trạng thái ra sao, ai tiếp nhận
    list_display = ('id', 'booking', 'service', 'quantity', 'assigned_staff', 'request_time', 'status')
    list_filter = ('status', 'service__category', 'assigned_staff')
    search_fields = ('booking__booking_code', 'service__name', 'assigned_staff__username')
    list_editable = ('status',)

admin.site.register(ServiceCategory)
admin.site.register(ServiceItem, ServiceItemAdmin)
admin.site.register(ServiceRequest, ServiceRequestAdmin)