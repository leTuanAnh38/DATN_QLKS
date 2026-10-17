from rest_framework import serializers
from .models import Payment, PaymentConfig

class PaymentSerializer(serializers.ModelSerializer):
    booking_id = serializers.IntegerField(source='booking.id', read_only=True)
    booking_code = serializers.CharField(source='booking.booking_code', read_only=True)
    group_booking_id = serializers.IntegerField(source='group_booking.id', read_only=True)
    group_booking_code = serializers.CharField(source='group_booking.group_code', read_only=True)
    is_group = serializers.SerializerMethodField()
    company_name = serializers.SerializerMethodField()
    guest_name = serializers.SerializerMethodField()
    guest_phone = serializers.SerializerMethodField()
    room_number = serializers.SerializerMethodField()
    booking_details = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            'id',
            'booking',
            'booking_id',
            'booking_code',
            'group_booking',
            'group_booking_id',
            'group_booking_code',
            'is_group',
            'company_name',
            'guest_name',
            'guest_phone',
            'room_number',
            'amount',
            'payment_method',
            'payment_status',
            'transaction_id',
            'created_at',
            'booking_details'
        ]
        read_only_fields = ['id', 'created_at', 'transaction_id']

    def get_is_group(self, obj):
        return bool(obj.group_booking)

    def get_company_name(self, obj):
        if obj.group_booking:
            gb = obj.group_booking
            if gb.corporate_partner and gb.corporate_partner.company_name:
                return gb.corporate_partner.company_name
            master_inv = getattr(gb, 'master_invoice', None)
            if master_inv and master_inv.company_name:
                return master_inv.company_name
            return gb.group_name
        if obj.booking:
            b = obj.booking
            if b.company_name:
                return b.company_name
            inv = getattr(b, 'invoice', None)
            if inv and inv.company_name:
                return inv.company_name
        return None

    def get_guest_name(self, obj):
        # 1. Trường hợp giao dịch cho Đơn đoàn / Công ty (GroupBooking)
        if obj.group_booking:
            gb = obj.group_booking
            leader = gb.leader_name or 'Trưởng đoàn'
            comp = (
                (gb.corporate_partner.company_name if gb.corporate_partner else None) or
                (getattr(gb, 'master_invoice', None).company_name if getattr(gb, 'master_invoice', None) else None) or
                gb.group_name
            )
            if comp:
                return f"{comp} ({leader})"
            return leader

        # 2. Trường hợp giao dịch cho Đơn đặt phòng lẻ (Booking)
        if not obj.booking:
            return 'Khách vãng lai'
        
        b = obj.booking
        guest_name_val = ''
        if b.guest:
            full_name = b.guest.get_full_name()
            guest_name_val = full_name if full_name else b.guest.username
        else:
            guest_name_val = getattr(b, 'guest_name', None) or getattr(b, 'customer_name', None) or 'Khách vãng lai'

        if b.customer_type == 'CORPORATE' and b.company_name:
            return f"{b.company_name} ({guest_name_val})"
        return guest_name_val

    def get_guest_phone(self, obj):
        if obj.group_booking:
            return obj.group_booking.leader_phone or ''
        if obj.booking:
            b = obj.booking
            if hasattr(b, 'guest_phone') and b.guest_phone:
                return b.guest_phone
            if b.guest and hasattr(b.guest, 'phone'):
                return b.guest.phone or ''
        return ''

    def get_room_number(self, obj):
        if obj.group_booking:
            count = obj.group_booking.sub_bookings.count()
            return f"Đoàn {count} phòng" if count > 0 else 'Đơn đặt đoàn'
        if obj.booking and obj.booking.room:
            return obj.booking.room.room_number
        return 'Chưa gán'

    def get_booking_details(self, obj):
        # 1. Nếu là Đơn đoàn / Công ty: Tổng hợp cấu trúc tương thích HotelInvoiceModal
        if obj.group_booking:
            gb = obj.group_booking
            from ..bookings.serializers import GroupBookingSerializer
            data = GroupBookingSerializer(gb, context=self.context).data
            
            # Đảm bảo các cờ nhận diện Group Master cho HotelInvoiceModal
            data['is_group_master'] = True
            data['is_group_booking'] = True
            data['booking_code'] = gb.group_code
            data['customer_name'] = gb.leader_name
            data['guest_name'] = gb.leader_name
            data['guest_phone'] = gb.leader_phone
            data['guest_email'] = gb.leader_email or ''
            data['customer_type'] = 'CORPORATE'
            data['payment_method'] = obj.payment_method or data.get('payment_method')
            data['paid_amount'] = float(obj.amount)
            data['payment_status'] = obj.payment_status

            master_inv = getattr(gb, 'master_invoice', None)
            comp_name = (
                (gb.corporate_partner.company_name if gb.corporate_partner else None) or
                (master_inv.company_name if master_inv else None) or
                gb.group_name
            )
            comp_tax = (
                (gb.corporate_partner.tax_code if gb.corporate_partner else None) or
                (master_inv.company_tax_code if master_inv else None) or
                ''
            )
            comp_addr = (
                (getattr(gb.corporate_partner, 'company_address', None) if gb.corporate_partner else None) or
                (getattr(master_inv, 'company_address', None) if master_inv else None) or
                ''
            )
            data['company_name'] = comp_name
            data['company_tax_code'] = comp_tax
            data['company_address'] = comp_addr

            if master_inv:
                data['invoice_code'] = master_inv.invoice_code
                data['invoice'] = {
                    'invoice_code': master_inv.invoice_code,
                    'room_charge': float(master_inv.room_charge),
                    'service_charge': float(master_inv.service_charge),
                    'total_amount': float(master_inv.total_amount),
                    'tax': float(master_inv.tax),
                    'discount': float(master_inv.discount),
                    'payment_method': master_inv.payment_method or obj.payment_method,
                    'status': master_inv.status,
                    'is_company_invoice': True,
                    'company_name': comp_name,
                    'company_tax_code': comp_tax,
                    'company_address': comp_addr,
                    'invoice_recipient_email': master_inv.invoice_recipient_email or gb.leader_email or '',
                }
            return data

        # 2. Nếu là Đơn phòng lẻ thông thường
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
                'tax': float(invoice.tax),
                'discount': float(invoice.discount),
                'payment_method': invoice.payment_method,
                'status': invoice.status,
                'is_company_invoice': invoice.is_company_invoice,
                'company_name': invoice.company_name,
                'company_tax_code': invoice.company_tax_code,
                'company_address': invoice.company_address,
                'invoice_recipient_email': invoice.invoice_recipient_email,
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

