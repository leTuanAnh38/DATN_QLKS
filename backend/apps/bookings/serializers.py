from rest_framework import serializers
from .models import Booking, BookingExtraService, Promotion, BookingGuest, CorporatePartner, GroupBooking, HotelSetting
from ..rooms.models import Room, RoomCategory
from ..users.models import User
import datetime


class PromotionSerializer(serializers.ModelSerializer):
    is_expired = serializers.SerializerMethodField()
    status_label = serializers.SerializerMethodField()

    class Meta:
        model = Promotion
        fields = [
            'id', 'code', 'name', 'discount_type', 'discount_value',
            'valid_from', 'valid_to', 'usage_limit', 'used_count',
            'min_order_value', 'max_discount_amount', 'is_active',
            'is_expired', 'status_label'
        ]

    def get_is_expired(self, obj):
        from django.utils import timezone
        if obj.valid_to and obj.valid_to < timezone.now():
            return True
        return False

    def get_status_label(self, obj):
        from django.utils import timezone
        now = timezone.now()
        if not obj.is_active:
            return 'Đã tạm dừng'
        if obj.valid_to and obj.valid_to < now:
            return 'Hết hạn'
        if obj.valid_from and obj.valid_from > now:
            return 'Sắp diễn ra'
        if obj.used_count >= obj.usage_limit:
            return 'Hết lượt dùng'
        return 'Đang diễn ra'


class BookingExtraServiceSerializer(serializers.ModelSerializer):
    total_price = serializers.SerializerMethodField()

    class Meta:
        model = BookingExtraService
        fields = ['id', 'service_name', 'quantity', 'price', 'total_price', 'added_time']

    def get_total_price(self, obj):
        return float((obj.price or 0) * (obj.quantity or 1))


class BookingGuestSerializer(serializers.ModelSerializer):
    id_type_display = serializers.CharField(source='get_id_type_display', read_only=True)

    class Meta:
        model = BookingGuest
        fields = [
            'id', 'booking', 'full_name', 'id_type', 'id_type_display',
            'id_number', 'date_of_birth', 'gender', 'nationality',
            'is_primary', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class BookingSerializer(serializers.ModelSerializer):
    room_name = serializers.SerializerMethodField()
    room_number = serializers.SerializerMethodField()
    room_image = serializers.SerializerMethodField()
    category_id = serializers.SerializerMethodField()
    nights = serializers.SerializerMethodField()
    capacity = serializers.SerializerMethodField()
    guests = BookingGuestSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    guest_name = serializers.SerializerMethodField()
    guest_phone = serializers.CharField(source='guest.phone_number', read_only=True)
    guest_email = serializers.CharField(source='guest.email', read_only=True)
    guest_details = serializers.SerializerMethodField()
    promotion_code = serializers.CharField(source='applied_promotion.code', read_only=True, default=None)
    promotion_discount = serializers.SerializerMethodField()
    guest_tier_name = serializers.SerializerMethodField()
    guest_tier_percent = serializers.SerializerMethodField()
    daily_rate = serializers.SerializerMethodField()
    
    # Folio Balance & Financial Fields (Thanh Toán Lấp Đầy)
    room_charge = serializers.SerializerMethodField()
    service_charge = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()
    paid_amount = serializers.SerializerMethodField()
    remaining_balance = serializers.SerializerMethodField()

    # Phụ phí & Dịch vụ phát sinh tại phòng (In-Room Services)
    extra_services = serializers.SerializerMethodField()
    extra_services_total = serializers.SerializerMethodField()
    pending_services = serializers.SerializerMethodField()
    selected_services = serializers.SerializerMethodField()
    room_amount = serializers.SerializerMethodField()
    grand_total_amount = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()
    is_paid = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    payment_method = serializers.SerializerMethodField()
    payment_method_display = serializers.SerializerMethodField()
    payments = serializers.SerializerMethodField()
    customer_type_display = serializers.CharField(source='get_customer_type_display', read_only=True)
    group_booking_code = serializers.CharField(source='group_booking.group_code', read_only=True, default=None)
    group_booking_name = serializers.CharField(source='group_booking.group_name', read_only=True, default=None)
    group_billing_type = serializers.CharField(source='group_booking.billing_type', read_only=True, default=None)
    is_company_all_inclusive = serializers.SerializerMethodField()
    is_group_deposit_paid = serializers.BooleanField(source='group_booking.is_deposit_paid', read_only=True, default=False)
    is_group_fully_paid = serializers.SerializerMethodField()
    group_deposit_amount = serializers.DecimalField(source='group_booking.deposit_amount', max_digits=12, decimal_places=0, read_only=True, default=0)
    group_total_amount = serializers.DecimalField(source='group_booking.total_amount', max_digits=12, decimal_places=0, read_only=True, default=0)
    group_deposit_status = serializers.SerializerMethodField()
    group_status = serializers.CharField(source='group_booking.status', read_only=True, default=None)

    class Meta:
        model = Booking
        fields = [
            'id',
            'booking_code',
            'customer_type',
            'customer_type_display',
            'company_name',
            'company_tax_code',
            'company_address',
            'group_booking',
            'group_booking_code',
            'group_booking_name',
            'group_billing_type',
            'is_company_all_inclusive',
            'is_master_billed',
            'is_group_deposit_paid',
            'is_group_fully_paid',
            'group_deposit_amount',
            'group_total_amount',
            'group_deposit_status',
            'group_status',
            'review',
            'category',
            'room',
            'room_name',
            'room_number',
            'room_image',
            'category_id',
            'guest',
            'guest_name',
            'guest_phone',
            'guest_email',
            'guest_details',
            'identity_card',
            'check_in_date',
            'check_out_date',
            'actual_check_in',
            'actual_check_out',
            'nights',
            'capacity',
            'daily_rate',
            'guests',
            'promotion_code',
            'promotion_discount',
            'membership_discount',
            'guest_tier_name',
            'guest_tier_percent',
            'room_charge',
            'service_charge',
            'total_amount',
            'paid_amount',
            'remaining_balance',
            'room_amount',
            'extra_services',
            'extra_services_total',
            'pending_services',
            'selected_services',
            'grand_total_amount',
            'status',
            'status_display',
            'is_paid',
            'payment_status',
            'payment_method',
            'payment_method_display',
            'payments',
            'note',
            'internal_note',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'booking_code', 'actual_check_in', 'actual_check_out', 'created_at', 'updated_at']

    def get_extra_services(self, obj):
        import re
        services_list = []
        synced_service_signatures = set()

        # 1. Nguồn chuẩn xác nhất cho các món gọi tại phòng: các ServiceRequest đã hoàn thành (completed)
        # Xác định dịch vụ phát sinh đã được thanh toán chưa:
        # Khi checkout thành công có invoice status == 'paid'
        services_is_paid = bool(
            obj.status in ['completed', 'checked_out'] and 
            hasattr(obj, 'invoice') and 
            obj.invoice and 
            obj.invoice.status == 'paid'
        )

        for req in obj.service_requests.exclude(status='cancelled').select_related('service').order_by('created_at'):
            clean_item_name = (req.service.name if req.service else 'Dịch vụ phòng').strip()
            total = float(req.total_price or ((req.service.price if req.service else 0) * req.quantity))
            
            # Ghi nhớ signature để chống trùng lặp với BookingExtraService
            sig = (clean_item_name.lower(), req.quantity, total)
            synced_service_signatures.add(sig)

            services_list.append({
                'id': f"req_{req.id}",
                'source': 'service_request',
                'service_name': clean_item_name,
                'quantity': req.quantity,
                'price': float(req.service.price if req.service else 0),
                'total_price': total,
                'status': req.status,
                'status_display': req.get_status_display(),
                'is_paid': bool(getattr(req, 'is_paid', False) or services_is_paid),
                'added_time': req.updated_at.isoformat() if req.updated_at else (req.created_at.isoformat() if req.created_at else None)
            })

        # 2. Lấy thêm các phụ phí phát sinh thủ công từ BookingExtraService (VD: Giặt ủi, đền bù, minibar)
        # Bỏ qua hoàn toàn các dòng trùng lặp đã được tính từ ServiceRequest
        for bes in obj.extra_services.all().order_by('added_time'):
            raw_name = (bes.service_name or '').strip()

            # Nếu dòng này được sinh tự động từ ServiceRequest (chứa [Yêu cầu #ID]) -> bỏ qua vì đã nạp ở bước 1
            if re.search(r'\[Yêu cầu #\d+\]', raw_name, re.IGNORECASE):
                continue

            # Chuẩn hóa tên: bỏ các đuôi phụ trợ như '(x2)' hoặc '[...]'
            clean_name = re.sub(r'\(x\d+\)', '', raw_name)
            clean_name = re.sub(r'\[.*?\]', '', clean_name).strip()
            total = float((bes.price or 0) * (bes.quantity or 1))

            # Kiểm tra nếu tên món, số lượng hoặc tổng tiền khớp với món đã có trong danh sách
            is_duplicate = False
            for existing in services_list:
                if existing['service_name'].lower() == clean_name.lower():
                    if existing['quantity'] == bes.quantity or abs(existing['total_price'] - total) < 1.0:
                        is_duplicate = True
                        break

            if is_duplicate:
                continue

            services_list.append({
                'id': bes.id,
                'source': 'extra_service',
                'service_name': clean_name or raw_name,
                'quantity': bes.quantity,
                'price': float(bes.price or 0),
                'total_price': total,
                'is_paid': bool(getattr(bes, 'is_paid', False) or services_is_paid),
                'added_time': bes.added_time.isoformat() if bes.added_time else None
            })

        return services_list

    def get_extra_services_total(self, obj):
        extra_list = self.get_extra_services(obj)
        return float(sum(item.get('total_price', 0) for item in extra_list))

    def get_pending_services(self, obj):
        # Lấy các yêu cầu dịch vụ đang chuẩn bị hoặc chờ phục vụ để Lễ tân theo dõi tiến độ
        pending_list = []
        for req in obj.service_requests.filter(status__in=['pending', 'in_progress']).select_related('service').order_by('created_at'):
            clean_item_name = (req.service.name if req.service else 'Dịch vụ phòng').strip()
            pending_list.append({
                'id': f"req_{req.id}",
                'raw_id': req.id,
                'service_name': clean_item_name,
                'quantity': req.quantity,
                'price': float(req.service.price if req.service else 0),
                'total_price': float(req.total_price or ((req.service.price if req.service else 0) * req.quantity)),
                'status': req.status,
                'status_display': req.get_status_display(),
                'is_paid': getattr(req, 'is_paid', False),
                'note': req.note,
                'request_time': req.request_time.isoformat() if req.request_time else (req.created_at.isoformat() if req.created_at else None)
            })
        return pending_list

    def get_selected_services(self, obj):
        """
        Danh sách tất cả dịch vụ đi kèm / đặt kèm của đơn đặt phòng.
        Bao gồm cả các dịch vụ được khách chọn trong lúc booking trực tuyến.
        """
        services_list = []
        request = self.context.get('request')
        for req in obj.service_requests.select_related('service', 'service__category').all().order_by('created_at'):
            svc = req.service
            if not svc:
                continue
            img_url = ''
            if svc.image:
                try:
                    img_url = request.build_absolute_uri(svc.image.url) if request else svc.image.url
                except Exception:
                    img_url = ''
            if not img_url:
                img_url = svc.image_url or ''
            
            unit_price = float(getattr(req, 'unit_price', 0) or (svc.price if svc else 0) or 0)
            total = float(req.total_price or (unit_price * req.quantity))
            services_list.append({
                'id': req.id,
                'service_id': svc.id,
                'service_name': svc.name,
                'category_name': svc.category.name if svc.category else '',
                'category_icon': svc.category.icon if svc.category else '',
                'unit_price': unit_price,
                'quantity': req.quantity,
                'total_price': total,
                'status': req.status,
                'status_display': req.get_status_display(),
                'is_paid': getattr(req, 'is_paid', False),
                'request_time': req.request_time.isoformat() if req.request_time else None,
                'image': img_url,
                'note': req.note or ''
            })
        return services_list

    # =========================================================================
    # FOLIO BALANCE & FINANCIAL CALCULATIONS (THANH TOÁN LẤP ĐẦY PMS)
    # =========================================================================
    def get_room_charge(self, obj):
        """
        room_charge: Tiền phòng thuần túy (Giá phòng * Số đêm - Giảm giá nếu có).
        Tuyệt đối không lấy nhầm model.total_amount khi chưa trừ tiền dịch vụ đặt kèm.
        """
        # 1. Ưu tiên lấy từ Invoice nếu đã có hóa đơn
        try:
            if hasattr(obj, 'invoice') and obj.invoice and obj.invoice.room_charge is not None:
                return float(obj.invoice.room_charge)
        except Exception:
            pass

        # 2. Tính trực tiếp từ đơn giá hạng phòng và số đêm lưu trú
        nights = self.get_nights(obj)
        daily_rate = self.get_daily_rate(obj)
        if daily_rate > 0 and nights > 0:
            subtotal = float(daily_rate * nights)
            membership_disc = float(obj.membership_discount or 0)
            promo_disc = float(self.get_promotion_discount(obj) or 0)
            return max(0.0, float(subtotal - membership_disc - promo_disc))

        # 3. Fallback: Nếu không có daily_rate, lấy model.total_amount trừ đi toàn bộ dịch vụ đặt kèm
        all_services_total = float(sum(
            float(r.total_price or ((getattr(r, 'unit_price', 0) or (r.service.price if r.service else 0)) * r.quantity))
            for r in obj.service_requests.exclude(status='cancelled')
        ))
        model_total = getattr(obj, 'total_amount', None)
        if model_total is not None and float(model_total) > 0:
            val = float(model_total)
            if all_services_total > 0 and val >= all_services_total:
                return float(val - all_services_total)
            return val

        return 0.0

    def get_service_charge(self, obj):
        """
        service_charge: Tổng tiền toàn bộ dịch vụ phát sinh & dịch vụ đặt kèm (gồm cả ServiceRequest và BookingExtraService).
        """
        return float(self.get_extra_services_total(obj))

    def get_total_amount(self, obj):
        """
        total_amount: room_charge + service_charge (tổng tiền cuối cùng bao gồm tiền phòng và dịch vụ).
        """
        return float(self.get_room_charge(obj) + self.get_service_charge(obj))

    def get_paid_amount(self, obj):
        """
        paid_amount: CỰC KỲ QUAN TRỌNG.
        Query SUM cột amount từ bảng Payment liên kết với booking này
        NHƯNG chỉ lấy những record có status là COMPLETED.
        """
        from django.db.models import Sum
        try:
            completed_payments = obj.payments.filter(payment_status='COMPLETED')
            total = completed_payments.aggregate(total=Sum('amount'))['total']
            if total is not None:
                return float(total)
        except Exception:
            pass

        # Fallback an toàn cho dữ liệu cũ (chưa sinh bản ghi Payment)
        if obj.status in ['paid', 'PAID']:
            return float(self.get_room_charge(obj))
        try:
            if hasattr(obj, 'invoice') and obj.invoice and obj.invoice.status == 'paid':
                return float(self.get_room_charge(obj))
        except Exception:
            pass
        note_lower = (obj.note or '').lower()
        if 'vietqr: đã thanh toán' in note_lower or 'đã thanh toán thành công' in note_lower:
            return float(self.get_room_charge(obj))

        return 0.0

    def get_is_company_all_inclusive(self, obj):
        return bool(obj.group_booking and getattr(obj.group_booking, 'billing_type', 'ROOM_ONLY') == 'ALL_INCLUSIVE')

    def get_remaining_balance(self, obj):
        """
        remaining_balance: total_amount - paid_amount.
        Số tiền dương là khách nợ cần thu thêm, số 0 là hòa, số âm là phải thối lại.
        Đối với phòng thuộc đoàn có tính tiền vào hóa đơn tổng (is_master_billed=True hoặc group_booking),
        tiền phòng do đoàn/công ty thanh toán tập trung:
        - Nếu ALL_INCLUSIVE: Công ty trả toàn bộ (cả phòng & dịch vụ phát sinh), khách lẻ còn nợ = 0đ.
        - Nếu ROOM_ONLY: Công ty chỉ trả tiền phòng, khách lẻ tự trả dịch vụ phát sinh tại phòng.
        """
        if obj.group_booking_id and getattr(obj, 'is_master_billed', True):
            if self.get_is_company_all_inclusive(obj):
                return 0.0
            service_charge = self.get_service_charge(obj)
            direct_paid = self.get_paid_amount(obj)
            return float(max(0.0, service_charge - direct_paid))

        if obj.status in ['completed', 'checked_out']:
            return 0.0

        total = self.get_total_amount(obj)
        paid = self.get_paid_amount(obj)
        return float(max(0.0, total - paid))

    def get_promotion_discount(self, obj):
        if not obj.applied_promotion:
            return 0.0
        nights = self.get_nights(obj)
        daily_rate = self.get_daily_rate(obj)
        subtotal = float(daily_rate * nights)
        membership_disc = float(obj.membership_discount or 0)
        raw_total = None
        try:
            raw_total = obj.__dict__.get('total_amount', None)
        except Exception:
            pass
        if raw_total is None:
            raw_total = obj.total_amount
        room_charge = float(raw_total or 0)
        promo_disc = max(0.0, round(subtotal - room_charge - membership_disc))
        return float(promo_disc)

    def get_guest_tier_name(self, obj):
        if obj.guest and getattr(obj.guest, 'current_tier', None):
            return obj.guest.current_tier.name
        return None

    def get_guest_tier_percent(self, obj):
        if obj.guest and getattr(obj.guest, 'current_tier', None):
            return float(obj.guest.current_tier.discount_percent or 0)
        return 0.0

    # Tương thích ngược với các components cũ
    def get_room_amount(self, obj):
        return self.get_room_charge(obj)

    def get_grand_total_amount(self, obj):
        return self.get_total_amount(obj)

    def validate_identity_card(self, value):
        val = str(value or '').strip()
        if not val:
            raise serializers.ValidationError("Số CCCD / Hộ chiếu là bắt buộc theo quy định lưu trú.")
        if len(val) < 8 or len(val) > 20:
            raise serializers.ValidationError("Số CCCD / Hộ chiếu phải có độ dài từ 8 đến 20 ký tự.")
        return val

    def get_room_name(self, obj):
        if obj.category:
            return obj.category.name
        if obj.room and obj.room.category:
            return obj.room.category.name
        return "Phòng tiêu chuẩn"

    def get_room_number(self, obj):
        if obj.room:
            return obj.room.room_number
        return None

    def get_room_image(self, obj):
        cat = obj.category or (obj.room.category if obj.room else None)
        if cat:
            feature_img = cat.images.filter(is_feature=True).first() or cat.images.first()
            if feature_img and feature_img.image:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(feature_img.image.url)
                return feature_img.image.url
        return None

    def get_category_id(self, obj):
        if obj.category:
            return obj.category.id
        if obj.room and obj.room.category:
            return obj.room.category.id
        return None

    def get_nights(self, obj):
        if obj.check_in_date and obj.check_out_date:
            try:
                delta = (obj.check_out_date - obj.check_in_date).days
                return max(1, delta)
            except Exception:
                return 1
        return 1

    def get_capacity(self, obj):
        cat = obj.category or (obj.room.category if obj.room else None)
        if cat and cat.capacity:
            return cat.capacity
        return 2

    def get_guest_name(self, obj):
        # 1. Ưu tiên lấy tên khách đại diện phòng từ danh sách BookingGuest
        try:
            primary_guest = obj.guests.filter(is_primary=True).first() or obj.guests.first()
            if primary_guest and primary_guest.full_name:
                return primary_guest.full_name
        except Exception:
            pass

        # 2. Lấy tên từ User tài khoản đặt phòng
        if obj.guest:
            full_name = obj.guest.get_full_name().strip()
            if not full_name:
                full_name = f"{obj.guest.first_name or ''} {obj.guest.last_name or ''}".strip()
            return full_name or obj.guest.username
        return "Khách vãng lai"

    def get_guest_details(self, obj):
        if not obj.guest:
            return None
        profile = getattr(obj.guest, 'guest_profile', None)
        return {
            'id': obj.guest.id,
            'full_name': self.get_guest_name(obj),
            'phone_number': obj.guest.phone_number or '',
            'email': obj.guest.email or '',
            'id_type': (profile.id_type if profile and profile.id_type else 'CCCD'),
            'id_number': (profile.id_card_number if profile and profile.id_card_number else obj.identity_card) or '',
            'date_of_birth': (profile.date_of_birth.strftime('%Y-%m-%d') if profile and profile.date_of_birth else ''),
            'gender': (profile.gender if profile and profile.gender else 'Nam'),
            'nationality': (profile.nationality if profile and profile.nationality else 'Việt Nam'),
            'preferences': (profile.preferences if profile and profile.preferences else ''),
        }

    def get_daily_rate(self, obj):
        cat = obj.category or (obj.room.category if obj.room else None)
        if cat:
            return float(cat.promo_price or cat.base_price or 0)
        nights = self.get_nights(obj)
        if obj.total_amount and nights > 0:
            return float(obj.total_amount / nights)
        return float(obj.total_amount or 0)

    def get_review(self, obj):
        try:
            if hasattr(obj, 'review') and obj.review:
                rev = obj.review
                return {
                    'id': rev.id,
                    'cleanliness_score': rev.cleanliness_score,
                    'service_score': rev.service_score,
                    'location_score': rev.location_score,
                    'value_score': rev.value_score,
                    'overall_rating': rev.overall_rating,
                    'comment': rev.comment,
                    'admin_reply': rev.admin_reply,
                    'is_visible': rev.is_visible,
                    'created_at': rev.created_at,
                }
        except Exception:
            pass
        return None

    def get_is_paid(self, obj):
        # Đơn đã hủy hoặc không đến không được coi là đã thanh toán
        if obj.status in ['cancelled', 'no_show']:
            return False
        if obj.status in ['paid', 'PAID']:
            return True
        try:
            if hasattr(obj, 'invoice') and obj.invoice and obj.invoice.status == 'paid':
                return True
        except Exception:
            pass
        try:
            if obj.payments.filter(payment_status='COMPLETED').exists():
                return True
        except Exception:
            pass
        note_lower = (obj.note or '').lower()
        if 'vietqr: đã thanh toán' in note_lower or 'đã thanh toán thành công' in note_lower:
            return True
        return False

    def get_payment_status(self, obj):
        # Đơn đã hủy hoặc không đến trả về trạng thái tương ứng, không được coi là COMPLETED
        if obj.status == 'cancelled':
            return 'CANCELLED'
        if obj.status == 'no_show':
            return 'NO_SHOW'
        # 1. Kiểm tra trực tiếp bảng Payment
        try:
            if obj.payments.filter(payment_status='COMPLETED').exists():
                return 'COMPLETED'
            if obj.payments.filter(payment_status='PENDING').exists():
                return 'PENDING'
        except Exception:
            pass
        # 2. Kiểm tra hóa đơn
        try:
            if hasattr(obj, 'invoice') and obj.invoice and obj.invoice.status == 'paid':
                return 'COMPLETED'
        except Exception:
            pass
        # 3. Kiểm tra trạng thái đơn đặt phòng
        if obj.status in ['paid', 'PAID']:
            return 'COMPLETED'
        # 4. Kiểm tra ghi chú xác nhận thanh toán thành công thực tế
        note_lower = (obj.note or '').lower()
        if 'vietqr: đã thanh toán' in note_lower or 'đã thanh toán thành công' in note_lower:
            return 'COMPLETED'
        return 'UNPAID'

    def get_payments(self, obj):
        try:
            return [
                {
                    'id': p.id,
                    'amount': float(p.amount),
                    'payment_method': p.payment_method,
                    'payment_status': p.payment_status,
                    'transaction_id': p.transaction_id,
                    'created_at': p.created_at.isoformat() if p.created_at else None,
                }
                for p in obj.payments.all().order_by('created_at')
            ]
        except Exception:
            return []

    def get_payment_method(self, obj):
        # 1. Kiểm tra trực tiếp bảng Payment: phát hiện thanh toán hỗn hợp (MIXED)
        try:
            completed_payments = list(obj.payments.filter(payment_status='COMPLETED').order_by('created_at'))
            if completed_payments:
                distinct_methods = set()
                for p in completed_payments:
                    m = str(p.payment_method or '').strip().upper()
                    if m in ['CASH', 'TIEN_MAT']:
                        distinct_methods.add('CASH')
                    elif m in ['TRANSFER', 'VIETQR', 'BANK_TRANSFER', 'CHUYEN_KHOAN']:
                        distinct_methods.add('TRANSFER')
                    elif m in ['CARD', 'CREDIT_CARD', 'POS']:
                        distinct_methods.add('CREDIT_CARD')
                    elif m in ['MOMO', 'ZALOPAY']:
                        distinct_methods.add('MOMO')
                    elif m:
                        distinct_methods.add(m)
                
                if len(distinct_methods) > 1:
                    return 'MIXED'
                return completed_payments[-1].payment_method
            any_payment = obj.payments.first()
            if any_payment and any_payment.payment_method:
                return any_payment.payment_method
        except Exception:
            pass

        # 2. Kiểm tra hóa đơn Invoice
        try:
            if hasattr(obj, 'invoice') and obj.invoice and obj.invoice.payment_method:
                inv_m = str(obj.invoice.payment_method).lower()
                if inv_m in ['mixed', 'hỗn hợp', 'hon_hop']:
                    return 'MIXED'
                if inv_m in ['cash', 'tiền mặt', 'tien_mat']:
                    return 'CASH'
                if inv_m in ['bank_transfer', 'vietqr', 'transfer', 'chuyển khoản']:
                    return 'TRANSFER'
                if inv_m in ['credit_card', 'thẻ tín dụng']:
                    return 'CREDIT_CARD'
                if inv_m in ['momo']:
                    return 'MOMO'
                return obj.invoice.payment_method.upper()
        except Exception:
            pass

        # 3. Phân tích ghi chú note
        note_lower = (obj.note or '').lower()
        if (('vietqr' in note_lower or 'chuyển khoản' in note_lower) and 
            ('tiền mặt' in note_lower or 'tại quầy' in note_lower or 'reception' in note_lower or 'cash' in note_lower)):
            return 'MIXED'
        if 'vietqr' in note_lower or 'chuyển khoản' in note_lower or 'transfer' in note_lower:
            return 'TRANSFER'
        if 'reception' in note_lower or 'tiền mặt' in note_lower or 'cash' in note_lower or 'tại lễ tân' in note_lower or 'tại quầy' in note_lower:
            return 'CASH'

        # 4. Nếu đơn đã hoàn thành hoặc check-out mà không có thông tin VietQR, mặc định là thanh toán tại quầy (CASH)
        if obj.status in ['completed', 'checked_out']:
            return 'CASH'

        return None

    def get_payment_method_display(self, obj):
        method = self.get_payment_method(obj)
        if method == 'MIXED':
            return 'Hỗn hợp (Tiền mặt & VietQR)'
        if method == 'CASH':
            return 'Tiền mặt'
        if method == 'TRANSFER':
            return 'VietQR'
        if method == 'CREDIT_CARD':
            return 'Thẻ tín dụng'
        if method == 'MOMO':
            return 'Ví MoMo'
        return 'Chưa xác định'

    def get_is_company_all_inclusive(self, obj):
        if obj.group_booking:
            return obj.group_booking.billing_type == 'ALL_INCLUSIVE'
        return False

    def get_is_group_fully_paid(self, obj):
        if obj.group_booking and obj.group_booking.is_deposit_paid:
            deposit = float(obj.group_booking.deposit_amount or 0)
            total = float(obj.group_booking.total_amount or 0)
            return total > 0 and deposit >= total
        return False

    def get_group_deposit_status(self, obj):
        if not obj.group_booking:
            return None
        if obj.group_booking.is_deposit_paid:
            deposit = float(obj.group_booking.deposit_amount or 0)
            total = float(obj.group_booking.total_amount or 0)
            if total > 0 and deposit >= total:
                return '✓ Đã thanh toán 100% đoàn'
            return '✓ Đã cọc đoàn'
        return 'Chờ cọc đoàn'


# ========================================================
# SERIALIZERS CHO ĐỐI TÁC DOANH NGHIỆP & ĐƠN ĐẶT ĐOÀN
# ========================================================
class CorporatePartnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = CorporatePartner
        fields = [
            'id', 'company_name', 'tax_code', 'company_address',
            'corporate_code', 'contact_person', 'contact_phone',
            'contact_email', 'contract_number', 'discount_percent',
            'payment_terms_days', 'is_active', 'note',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class GroupBookingSerializer(serializers.ModelSerializer):
    corporate_partner_details = CorporatePartnerSerializer(source='corporate_partner', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    billing_type_display = serializers.CharField(source='get_billing_type_display', read_only=True)
    total_rooms = serializers.SerializerMethodField()
    sub_bookings = serializers.SerializerMethodField()
    rooms_summary = serializers.SerializerMethodField()
    nights = serializers.SerializerMethodField()
    deposit_status = serializers.SerializerMethodField()
    remaining_balance = serializers.SerializerMethodField()

    class Meta:
        model = GroupBooking
        fields = [
            'id', 'group_code', 'group_name', 'corporate_partner',
            'corporate_partner_details', 'leader_name', 'leader_phone',
            'leader_email', 'check_in_date', 'check_out_date', 'nights',
            'total_amount', 'deposit_amount', 'is_deposit_paid',
            'deposit_status', 'remaining_balance',
            'billing_type', 'billing_type_display',
            'status', 'status_display', 'note', 'internal_note',
            'total_rooms', 'sub_bookings', 'rooms_summary',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'group_code', 'created_at', 'updated_at']

    def get_nights(self, obj):
        if obj.check_in_date and obj.check_out_date:
            return max(1, (obj.check_out_date - obj.check_in_date).days)
        return 1

    def get_total_rooms(self, obj):
        return obj.sub_bookings.count()

    def get_deposit_status(self, obj):
        if obj.is_deposit_paid:
            deposit = float(obj.deposit_amount or 0)
            total = float(obj.total_amount or 0)
            if total > 0 and deposit >= total:
                return 'Đã thanh toán 100%'
            return 'Đã thanh toán cọc'
        if obj.deposit_amount and obj.deposit_amount > 0:
            return 'Chờ thanh toán cọc'
        return 'Chưa yêu cầu cọc'

    def get_remaining_balance(self, obj):
        deposit = float(obj.deposit_amount or 0) if obj.is_deposit_paid else 0.0
        return max(0.0, float(obj.total_amount or 0) - deposit)

    def get_sub_bookings(self, obj):
        bookings = obj.sub_bookings.select_related('category', 'room', 'guest').prefetch_related('guests').all()
        return BookingSerializer(bookings, many=True, context=self.context).data

    def get_rooms_summary(self, obj):
        summary = {}
        for b in obj.sub_bookings.select_related('category', 'room').all():
            cat_name = b.category.name if b.category else "Chưa phân loại"
            if cat_name not in summary:
                summary[cat_name] = {'category_name': cat_name, 'count': 0, 'assigned_rooms': []}
            summary[cat_name]['count'] += 1
            if b.room:
                summary[cat_name]['assigned_rooms'].append(b.room.room_number)
        return list(summary.values())


class HotelSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = HotelSetting
        fields = '__all__'



