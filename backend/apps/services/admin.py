from django.contrib import admin
from .models import ServiceCategory, ServiceItem, ServiceRequest

class ServiceItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'is_active')
    list_filter = ('category', 'is_active')
    search_fields = ('name',)

class ServiceRequestAdmin(admin.ModelAdmin):
    # Hiển thị rõ Booking nào đang gọi dịch vụ gì, giờ nào, trạng thái ra sao
    list_display = ('booking', 'service', 'quantity', 'request_time', 'status')
    list_filter = ('status', 'service__category')
    search_fields = ('booking__booking_code', 'service__name')
    list_editable = ('status',) # Cho phép nhân viên đổi nhanh trạng thái thành "Đã hoàn thành"

admin.site.register(ServiceCategory)
admin.site.register(ServiceItem, ServiceItemAdmin)
admin.site.register(ServiceRequest, ServiceRequestAdmin)