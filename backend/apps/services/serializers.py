from rest_framework import serializers
from .models import ServiceCategory, ServiceItem, ServiceRequest
from ..bookings.models import Booking


class ServiceCategorySerializer(serializers.ModelSerializer):
    services_count = serializers.SerializerMethodField()

    class Meta:
        model = ServiceCategory
        fields = ['id', 'name', 'icon', 'description', 'services_count']

    def get_services_count(self, obj):
        return obj.services.filter(is_active=True).count()


class ServiceItemSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=ServiceCategory.objects.all(),
        required=False
    )
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_icon = serializers.CharField(source='category.icon', read_only=True)
    category_id = serializers.IntegerField(source='category.id', read_only=True)
    display_image = serializers.SerializerMethodField()

    class Meta:
        model = ServiceItem
        fields = [
            'id',
            'category',
            'category_id',
            'category_name',
            'category_icon',
            'name',
            'description',
            'price',
            'image',
            'image_url',
            'display_image',
            'is_active',
        ]

    def to_internal_value(self, data):
        # Hỗ trợ cả category_id hoặc category khi gửi từ FormData hoặc JSON
        if hasattr(data, '_mutable'):
            data = data.copy()
            if 'category_id' in data and not data.get('category'):
                data['category'] = data['category_id']
        elif isinstance(data, dict):
            data = data.copy()
            if 'category_id' in data and not data.get('category'):
                data['category'] = data['category_id']
        return super().to_internal_value(data)

    def get_display_image(self, obj):
        request = self.context.get('request')
        if obj.image:
            try:
                if request:
                    return request.build_absolute_uri(obj.image.url)
                return obj.image.url
            except Exception:
                pass
        return obj.image_url or ''


class ServiceRequestSerializer(serializers.ModelSerializer):
    # Thông tin mở rộng về đơn đặt phòng và phòng gọi
    booking_code = serializers.CharField(source='booking.booking_code', read_only=True)
    room_number = serializers.SerializerMethodField()
    room_name = serializers.SerializerMethodField()
    guest_name = serializers.SerializerMethodField()
    guest_phone = serializers.SerializerMethodField()

    # Thông tin chi tiết về dịch vụ
    service_id = serializers.PrimaryKeyRelatedField(
        queryset=ServiceItem.objects.all(),
        source='service',
        write_only=False
    )
    service_name = serializers.CharField(source='service.name', read_only=True)
    service_price = serializers.DecimalField(source='service.price', max_digits=10, decimal_places=0, read_only=True)
    service_image = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='service.category.name', read_only=True)
    category_icon = serializers.CharField(source='service.category.icon', read_only=True)

    status_display = serializers.CharField(source='get_status_display', read_only=True)
    total_price = serializers.DecimalField(max_digits=12, decimal_places=0, read_only=True)

    class Meta:
        model = ServiceRequest
        fields = [
            'id',
            'booking',
            'booking_code',
            'room_number',
            'room_name',
            'guest_name',
            'guest_phone',
            'service_id',
            'service_name',
            'service_price',
            'service_image',
            'category_name',
            'category_icon',
            'quantity',
            'total_price',
            'request_time',
            'status',
            'status_display',
            'note',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'total_price', 'created_at', 'updated_at']

    def get_room_number(self, obj):
        if obj.booking and obj.booking.room:
            return obj.booking.room.room_number
        return 'Chưa gán phòng'

    def get_room_name(self, obj):
        if obj.booking and obj.booking.category:
            return obj.booking.category.name
        if obj.booking and obj.booking.room and obj.booking.room.category:
            return obj.booking.room.category.name
        return 'Phòng tiêu chuẩn'

    def get_guest_name(self, obj):
        if obj.booking and obj.booking.guest:
            full_name = f"{obj.booking.guest.last_name or ''} {obj.booking.guest.first_name or ''}".strip()
            return full_name or obj.booking.guest.username
        return 'Khách lưu trú'

    def get_guest_phone(self, obj):
        if obj.booking and obj.booking.guest:
            return getattr(obj.booking.guest, 'phone_number', '') or ''
        return ''

    def get_service_image(self, obj):
        if not obj.service:
            return ''
        request = self.context.get('request')
        if obj.service.image:
            try:
                if request:
                    return request.build_absolute_uri(obj.service.image.url)
                return obj.service.image.url
            except Exception:
                pass
        return obj.service.image_url or ''

    def validate_quantity(self, value):
        if value < 1 or value > 99:
            raise serializers.ValidationError("Số lượng yêu cầu phải từ 1 đến 99.")
        return value
