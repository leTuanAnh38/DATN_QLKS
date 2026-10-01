from rest_framework import serializers
from .models import Booking, BookingExtraService, Promotion
from ..rooms.models import Room, RoomCategory
from ..users.models import User
import datetime


class PromotionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Promotion
        fields = ['id', 'code', 'discount_type', 'discount_value', 'is_active', 'min_order_value']


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
    
    # Phụ phí & Dịch vụ phát sinh tại phòng (In-Room Services)
    extra_services = serializers.SerializerMethodField()
    extra_services_total = serializers.SerializerMethodField()
    pending_services = serializers.SerializerMethodField()
    room_amount = serializers.SerializerMethodField()
    grand_total_amount = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()

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
            'total_amount',
            'room_amount',
            'extra_services',
            'extra_services_total',
            'pending_services',
            'grand_total_amount',
            'status',
            'status_display',
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

    def get_room_amount(self, obj):
        return float(obj.total_amount or 0)

    def get_grand_total_amount(self, obj):
        room_tot = self.get_room_amount(obj)
        extra_tot = self.get_extra_services_total(obj)
        return float(room_tot + extra_tot)

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
            full_name = f"{obj.guest.last_name or ''} {obj.guest.first_name or ''}".strip()
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
