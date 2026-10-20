from django.contrib import admin
from .models import Invoice, Payment, PaymentConfig, CashierShift

class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_code', 'booking', 'group_booking', 'is_company_invoice', 'company_name', 'company_tax_code', 'total_amount', 'payment_method', 'status', 'created_at')
    list_filter = ('status', 'is_company_invoice', 'payment_method', 'created_at')
    search_fields = ('invoice_code', 'company_name', 'company_tax_code', 'booking__booking_code', 'group_booking__group_code')
    list_editable = ('status',) # Thu ngân đổi trạng thái "Đã thanh toán" trực tiếp ngoài danh sách
    readonly_fields = ('invoice_code', 'created_at')
    
    fieldsets = (
        ('Thông tin chung', {
            'fields': ('invoice_code', 'booking', 'group_booking', 'status', 'payment_method', 'paid_at')
        }),
        ('Hóa đơn Doanh nghiệp (VAT)', {
            'fields': ('is_company_invoice', 'company_name', 'company_tax_code', 'company_address', 'invoice_recipient_email')
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
    list_display = ('id', 'booking', 'shift', 'amount', 'payment_method', 'payment_status', 'transaction_id', 'created_at')
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

@admin.register(CashierShift)
class CashierShiftAdmin(admin.ModelAdmin):
    list_display = ('shift_code', 'shift_type', 'user', 'status', 'opening_cash', 'actual_cash', 'difference', 'opened_at', 'closed_at')
    list_filter = ('status', 'shift_type', 'opened_at')
    search_fields = ('shift_code', 'user__username', 'user__first_name', 'user__last_name')
    readonly_fields = ('shift_code', 'opened_at')
