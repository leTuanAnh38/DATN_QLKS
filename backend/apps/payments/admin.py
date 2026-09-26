from django.contrib import admin
from .models import Invoice

class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_code', 'booking', 'total_amount', 'payment_method', 'status', 'created_at')
    list_filter = ('status', 'payment_method', 'created_at')
    search_fields = ('invoice_code', 'booking__booking_code', 'booking__guest__username')
    list_editable = ('status',) # Thu ngân đổi trạng thái "Đã thanh toán" trực tiếp ngoài danh sách
    readonly_fields = ('invoice_code', 'created_at')
    
    fieldsets = (
        ('Thông tin chung', {
            'fields': ('invoice_code', 'booking', 'status', 'payment_method', 'paid_at')
        }),
        ('Chi tiết tài chính', {
            'fields': ('room_charge', 'service_charge', 'discount', 'tax', 'total_amount')
        }),
        ('Hệ thống', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )

admin.site.register(Invoice, InvoiceAdmin)