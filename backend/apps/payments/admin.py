from django.contrib import admin
from .models import Invoice, Payment, PaymentConfig

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

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'booking', 'amount', 'payment_method', 'payment_status', 'transaction_id', 'created_at')
    list_filter = ('payment_status', 'payment_method', 'created_at')
    search_fields = ('transaction_id', 'booking__booking_code', 'booking__guest__username')
    readonly_fields = ('created_at',)

@admin.register(PaymentConfig)
class PaymentConfigAdmin(admin.ModelAdmin):
    list_display = ('bank_bin', 'account_no', 'account_name', 'updated_at')
    readonly_fields = ('updated_at',)

    def has_add_permission(self, request):
        # Chỉ duy trì 1 bản ghi singleton
        return not PaymentConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False