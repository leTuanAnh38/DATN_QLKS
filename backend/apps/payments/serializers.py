from rest_framework import serializers
from .models import Payment

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
        nights = 1
        if b.check_in_date and b.check_out_date:
            nights = max(1, (b.check_out_date - b.check_in_date).days)

        invoice = getattr(b, 'invoice', None)
        guest_name = self.get_guest_name(obj)
        room_charge = float(invoice.room_charge) if invoice else float(b.total_amount or 0)
        service_charge = float(invoice.service_charge) if invoice else 0
        grand_total = float(invoice.total_amount) if invoice else float(obj.amount or b.total_amount or 0)

        return {
            'id': b.id,
            'booking_code': b.booking_code,
            'customer_name': guest_name,
            'guest_name': guest_name,
            'guest': {
                'get_full_name': guest_name,
                'username': b.guest.username if b.guest else '',
                'phone': getattr(b.guest, 'phone', '') if b.guest else '',
                'email': getattr(b.guest, 'email', '') if b.guest else ''
            },
            'room': {
                'room_number': b.room.room_number if b.room else 'Chưa gán',
                'room_type_name': b.category.name if b.category else ''
            },
            'category': {
                'name': b.category.name if b.category else ''
            },
            'check_in_date': str(b.check_in_date) if b.check_in_date else None,
            'check_out_date': str(b.check_out_date) if b.check_out_date else None,
            'actual_check_in': str(b.actual_check_in) if b.actual_check_in else None,
            'actual_check_out': str(b.actual_check_out) if b.actual_check_out else None,
            'nights': nights,
            'daily_rate': float(b.category.base_price) if (b.category and b.category.base_price) else (room_charge / nights),
            'room_amount': room_charge,
            'extra_services_total': service_charge,
            'total_amount': grand_total,
            'grand_total_amount': grand_total,
            'status': b.status,
            'note': b.note or '',
            'created_at': str(b.created_at) if b.created_at else None,
            'invoice_code': invoice.invoice_code if invoice else None
        }
