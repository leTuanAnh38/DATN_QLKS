from rest_framework import serializers
from .models import Payment, PaymentConfig

class PaymentSerializer(serializers.ModelSerializer):
    booking_id = serializers.IntegerField(source='booking.id', read_only=True)
    booking_code = serializers.CharField(source='booking.booking_code', read_only=True)
    guest_name = serializers.SerializerMethodField()
    room_number = serializers.SerializerMethodField()
    booking_details = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            'id',
            'booking',
            'booking_id',
            'booking_code',
            'guest_name',
            'room_number',
            'amount',
            'payment_method',
            'payment_status',
            'transaction_id',
            'created_at',
            'booking_details'
        ]
        read_only_fields = ['id', 'created_at', 'transaction_id']

    def get_guest_name(self, obj):
        if not obj.booking or not obj.booking.guest:
            return 'Khách vãng lai'
        full_name = obj.booking.guest.get_full_name()
        return full_name if full_name else obj.booking.guest.username

    def get_room_number(self, obj):
        if obj.booking and obj.booking.room:
            return obj.booking.room.room_number
        return 'Chưa gán'

    def get_booking_details(self, obj):
        b = obj.booking
        if not b:
            return None
        from ..bookings.serializers import BookingSerializer
        data = BookingSerializer(b, context=self.context).data
        invoice = getattr(b, 'invoice', None)
        if invoice:
            data['invoice_code'] = invoice.invoice_code
            data['room_amount'] = float(invoice.room_charge)
            data['extra_services_total'] = float(invoice.service_charge)
            data['grand_total_amount'] = float(invoice.total_amount)
            data['payment_method'] = invoice.payment_method
            data['invoice'] = {
                'invoice_code': invoice.invoice_code,
                'room_charge': float(invoice.room_charge),
                'service_charge': float(invoice.service_charge),
                'total_amount': float(invoice.total_amount),
                'payment_method': invoice.payment_method,
                'status': invoice.status
            }
        if not data.get('payment_method'):
            data['payment_method'] = obj.payment_method
        return data


class PaymentConfigSerializer(serializers.ModelSerializer):
    """
    Serializer cho cấu hình thanh toán VietQR động
    """
    class Meta:
        model = PaymentConfig
        fields = ['id', 'bank_bin', 'account_no', 'account_name', 'updated_at']
        read_only_fields = ['id', 'updated_at']

    def validate_bank_bin(self, value):
        val = str(value).strip() if value else ''
        if not val:
            raise serializers.ValidationError("Mã BIN ngân hàng không được để trống.")
        return val

    def validate_account_no(self, value):
        val = str(value).strip() if value else ''
        if not val:
            raise serializers.ValidationError("Số tài khoản không được để trống.")
        return val

    def validate_account_name(self, value):
        val = str(value).strip().upper() if value else ''
        if not val:
            raise serializers.ValidationError("Tên chủ tài khoản không được để trống.")
        return val

