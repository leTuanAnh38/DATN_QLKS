from rest_framework import serializers
from .models import Review
from ..bookings.models import Booking


class ReviewSerializer(serializers.ModelSerializer):
    guest_name = serializers.SerializerMethodField()
    guest_email = serializers.CharField(source='guest.email', read_only=True)
    guest_avatar = serializers.SerializerMethodField()
    room_category_name = serializers.CharField(source='room_category.name', read_only=True)
    booking_code = serializers.CharField(source='booking.booking_code', read_only=True)

    class Meta:
        model = Review
        fields = [
            'id',
            'booking',
            'booking_code',
            'guest',
            'guest_name',
            'guest_email',
            'guest_avatar',
            'room_category',
            'room_category_name',
            'cleanliness_score',
            'service_score',
            'location_score',
            'value_score',
            'overall_rating',
            'comment',
            'admin_reply',
            'is_visible',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'guest',
            'room_category',
            'overall_rating',
            'created_at',
            'updated_at',
        ]

    def get_guest_name(self, obj):
        if obj.guest:
            full_name = obj.guest.get_full_name().strip()
            return full_name or obj.guest.username
        return "Khách hàng"

    def get_guest_avatar(self, obj):
        if obj.guest and hasattr(obj.guest, 'avatar') and obj.guest.avatar:
            try:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(obj.guest.avatar.url)
                return obj.guest.avatar.url
            except Exception:
                return str(obj.guest.avatar)
        return None


class ReviewCreateSerializer(serializers.ModelSerializer):
    booking_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Review
        fields = [
            'booking_id',
            'cleanliness_score',
            'service_score',
            'location_score',
            'value_score',
            'comment',
        ]

    def validate_booking_id(self, value):
        user = self.context['request'].user
        try:
            booking = Booking.objects.select_related('category', 'guest').get(id=value)
        except Booking.DoesNotExist:
            raise serializers.ValidationError("Đơn đặt phòng không tồn tại.")

        # Kiểm tra quyền sở hữu đơn đặt phòng
        if not (user.is_staff or user.is_superuser or booking.guest_id == user.id):
            raise serializers.ValidationError("Bạn không có quyền đánh giá đơn đặt phòng của người khác.")

        # Validate trạng thái booking phải completed
        if booking.status != 'completed':
            raise serializers.ValidationError("Chỉ có thể đánh giá những đơn đặt phòng đã hoàn tất (Completed).")

        # Kiểm tra đã đánh giá chưa
        if Review.objects.filter(booking=booking).exists() or hasattr(booking, 'review'):
            raise serializers.ValidationError("Đơn đặt phòng này đã được đánh giá trước đó.")

        if not booking.category:
            raise serializers.ValidationError("Đơn đặt phòng không xác định được hạng phòng để đánh giá.")

        self.context['validated_booking'] = booking
        return value

    def validate_score(self, value, field_name):
        if not (1 <= value <= 5):
            raise serializers.ValidationError(f"Điểm {field_name} phải nằm trong khoảng từ 1 đến 5.")
        return value

    def validate_cleanliness_score(self, value):
        return self.validate_score(value, "sạch sẽ")

    def validate_service_score(self, value):
        return self.validate_score(value, "dịch vụ")

    def validate_location_score(self, value):
        return self.validate_score(value, "vị trí")

    def validate_value_score(self, value):
        return self.validate_score(value, "giá trị")

    def validate_comment(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("Vui lòng nhập nội dung cảm nhận của bạn.")
        return str(value).strip()

    def create(self, validated_data):
        booking = self.context['validated_booking']
        user = self.context['request'].user

        validated_data.pop('booking_id', None)
        review = Review.objects.create(
            booking=booking,
            guest=booking.guest if (user.is_staff and booking.guest) else user,
            room_category=booking.category,
            **validated_data
        )
        return review
