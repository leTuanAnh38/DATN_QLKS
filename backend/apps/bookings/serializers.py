from rest_framework import serializers
from .models import Booking, BookingExtraService, Promotion
from ..rooms.models import Room, RoomCategory
from ..users.models import User
import datetime


class PromotionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Promotion
        fields = ['id', 'code', 'discount_type', 'discount_value', 'is_active', 'min_order_value']


class BookingSerializer(serializers.ModelSerializer):
    room_name = serializers.SerializerMethodField()
    room_number = serializers.CharField(source='room.room_number', read_only=True)
    room_image = serializers.SerializerMethodField()
    category_id = serializers.SerializerMethodField()
    nights = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    guest_name = serializers.SerializerMethodField()
    guest_phone = serializers.CharField(source='guest.phone_number', read_only=True)
    guest_email = serializers.CharField(source='guest.email', read_only=True)

    class Meta:
        model = Booking
        fields = [
            'id',
            'booking_code',
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
            'nights',
            'total_amount',
            'status',
            'status_display',
            'note',
            'internal_note',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'booking_code', 'created_at', 'updated_at']

    def validate_identity_card(self, value):
        val = str(value or '').strip()
        if not val:
            raise serializers.ValidationError("Số CCCD / Hộ chiếu là bắt buộc theo quy định lưu trú.")
        if len(val) < 8 or len(val) > 20:
            raise serializers.ValidationError("Số CCCD / Hộ chiếu phải có độ dài từ 8 đến 20 ký tự.")
        return val

    def get_room_name(self, obj):
        if obj.room and obj.room.category:
            return obj.room.category.name
        return "Phòng tiêu chuẩn"

    def get_room_image(self, obj):
        if obj.room and obj.room.category:
            cat = obj.room.category
            feature_img = cat.images.filter(is_feature=True).first() or cat.images.first()
            if feature_img and feature_img.image:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(feature_img.image.url)
                return feature_img.image.url
        return None

    def get_category_id(self, obj):
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
