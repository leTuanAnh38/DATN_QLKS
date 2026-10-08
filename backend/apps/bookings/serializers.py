from rest_framework import serializers
from .models import Booking, BookingExtraService, Promotion
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


class BookingSerializer(serializers.ModelSerializer):
    room_name = serializers.SerializerMethodField()
    room_number = serializers.SerializerMethodField()
    room_image = serializers.SerializerMethodField()
    category_id = serializers.SerializerMethodField()
    nights = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    guest_name = serializers.SerializerMethodField()
    guest_phone = serializers.CharField(source='guest.phone_number', read_only=True)
    guest_email = serializers.CharField(source='guest.email', read_only=True)
    promotion_code = serializers.CharField(source='applied_promotion.code', read_only=True, default=None)
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
    room_amount = serializers.SerializerMethodField()
    grand_total_amount = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()
    is_paid = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    payment_method = serializers.SerializerMethodField()
    payment_method_display = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            'id',
            'booking_code',
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
            'identity_card',
            'check_in_date',
            'check_out_date',
            'actual_check_in',
            'actual_check_out',
            'nights',
            'daily_rate',
            'promotion_code',
            'room_charge',
            'service_charge',
            'total_amount',
            'paid_amount',
            'remaining_balance',
            'room_amount',
            'extra_services',
            'extra_services_total',
            'pending_services',
            'grand_total_amount',
            'status',
            'status_display',
            'is_paid',
            'payment_status',
            'payment_method',
            'payment_method_display',
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
        # Xác định dịch vụ phát sinh đã được thanh toán chưa (Khi checkout thành công có invoice paid)
        services_is_paid = bool(
            obj.status in ['completed', 'checked_out'] and 
            hasattr(obj, 'invoice') and 
            obj.invoice and 
            obj.invoice.status == 'paid'
        )

        for req in obj.service_requests.filter(status='completed').select_related('service').order_by('created_at'):
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
                'is_paid': services_is_paid,
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
                'is_paid': services_is_paid,
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
                'note': req.note,
                'request_time': req.request_time.isoformat() if req.request_time else (req.created_at.isoformat() if req.created_at else None)
            })
        return pending_list

    # =========================================================================
    # FOLIO BALANCE & FINANCIAL CALCULATIONS (THANH TOÁN LẤP ĐẦY PMS)
    # =========================================================================
    def get_room_charge(self, obj):
        """
        room_charge: Tiền phòng (Giá phòng * Số đêm).
        Ưu tiên lấy total_amount đã lưu ở booking nếu có, hoặc tính động (daily_rate * nights).
        """
        # Nếu model booking đã lưu trường total_amount gốc cho tiền phòng
        raw_val = getattr(obj, '_state', None)
        # Sử dụng giá trị booking.total_amount từ database nếu hợp lệ
        try:
            from django.db import connection
            # Lấy trường total_amount trực tiếp từ DB model Booking
            db_total = obj._total_amount if hasattr(obj, '_total_amount') else None
        except Exception:
            db_total = None

        # Kiểm tra tiền phòng trong model Booking (obj.total_amount)
        # Lưu ý: Vì ta override serializer field total_amount, cần đọc trực tiếp thuộc tính model:
        model_total = None
        try:
            # Truy cập giá trị ban đầu từ database instance
            model_total = obj.__dict__.get('total_amount', None)
        except Exception:
            pass

        if model_total is not None and float(model_total) > 0:
            return float(model_total)

        nights = self.get_nights(obj)
        daily_rate = self.get_daily_rate(obj)
        return float(daily_rate * nights)

    def get_service_charge(self, obj):
        """
        service_charge: Tổng tiền dịch vụ phát sinh (Room service, giặt ủi...).
        """
        return float(self.get_extra_services_total(obj))

    def get_total_amount(self, obj):
        """
        total_amount: room_charge + service_charge.
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

    def get_remaining_balance(self, obj):
        """
        remaining_balance: total_amount - paid_amount.
        Số tiền dương là khách nợ cần thu thêm, số 0 là hòa, số âm là phải thối lại.
        """
        total = self.get_total_amount(obj)
        paid = self.get_paid_amount(obj)
        return float(total - paid)

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

    def get_guest_name(self, obj):
        if obj.guest:
            full_name = obj.guest.get_full_name().strip()
            if not full_name:
                full_name = f"{obj.guest.first_name or ''} {obj.guest.last_name or ''}".strip()
            return full_name or obj.guest.username
        return "Khách vãng lai"

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

    def get_payment_method(self, obj):
        # 1. Kiểm tra trực tiếp bảng Payment
        try:
            completed_payment = obj.payments.filter(payment_status='COMPLETED').order_by('-created_at').first()
            if completed_payment and completed_payment.payment_method:
                return completed_payment.payment_method
            any_payment = obj.payments.first()
            if any_payment and any_payment.payment_method:
                return any_payment.payment_method
        except Exception:
            pass

        # 2. Kiểm tra hóa đơn Invoice
        try:
            if hasattr(obj, 'invoice') and obj.invoice and obj.invoice.payment_method:
                inv_m = str(obj.invoice.payment_method).lower()
                if inv_m in ['cash', 'tiền mặt', 'tien_mat']:
                    return 'CASH'
                if inv_m in ['bank_transfer', 'vietqr', 'transfer', 'chuyển khoản', 'momo']:
                    return 'TRANSFER'
                if inv_m in ['credit_card', 'thẻ tín dụng']:
                    return 'CREDIT_CARD'
                return obj.invoice.payment_method.upper()
        except Exception:
            pass

        # 3. Phân tích ghi chú note
        note_lower = (obj.note or '').lower()
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
        if method == 'CASH':
            return 'Tiền mặt'
        if method == 'TRANSFER':
            return 'VietQR'
        if method == 'CREDIT_CARD':
            return 'Thẻ tín dụng'
        return 'Chưa xác định'

