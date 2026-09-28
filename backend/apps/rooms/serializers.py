from rest_framework import serializers
from .models import Room, RoomCategory, Amenity, RoomImage


class AmenitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Amenity
        fields = ['id', 'name', 'icon']


class RoomImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = RoomImage
        fields = ['id', 'image', 'image_url', 'is_feature']

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url


class RoomCategorySerializer(serializers.ModelSerializer):
    amenities = AmenitySerializer(many=True, read_only=True)
    images = RoomImageSerializer(many=True, read_only=True)
    feature_image = serializers.SerializerMethodField()
    total_rooms_count = serializers.SerializerMethodField()

    class Meta:
        model = RoomCategory
        fields = [
            'id', 'name', 'slug', 'description', 'size',
            'bed_type', 'capacity', 'base_price', 'promo_price',
            'amenities', 'images', 'feature_image', 'total_rooms_count'
        ]
        read_only_fields = ['id', 'slug', 'total_rooms_count']

    def get_feature_image(self, obj):
        # Lấy ảnh có is_feature=True trước, nếu không có thì lấy ảnh đầu tiên
        feature_img = obj.images.filter(is_feature=True).first()
        if not feature_img:
            feature_img = obj.images.first()
        if feature_img and feature_img.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(feature_img.image.url)
            return feature_img.image.url
        return None

    def get_total_rooms_count(self, obj):
        return obj.rooms.count()

    def validate_base_price(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Giá gốc phòng phải lớn hơn 0.")
        return value

    def validate_promo_price(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Giá khuyến mãi phải lớn hơn 0.")
        return value

    def validate_capacity(self, value):
        if value is None or value < 1:
            raise serializers.ValidationError("Sức chứa phòng tối thiểu là 1 người lớn.")
        return value

    def validate_size(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError("Diện tích phòng phải lớn hơn 0 m².")
        return value


class RoomSerializer(serializers.ModelSerializer):
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=RoomCategory.objects.all(),
        source='category',
        write_only=True
    )
    category = RoomCategorySerializer(read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_base_price = serializers.DecimalField(
        source='category.base_price',
        max_digits=12,
        decimal_places=0,
        read_only=True
    )
    category_bed_type = serializers.CharField(source='category.bed_type', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Room
        fields = [
            'id', 'room_number', 'floor', 'status', 'status_display',
            'category', 'category_id', 'category_name',
            'category_base_price', 'category_bed_type'
        ]

    def validate_room_number(self, value):
        room_number = str(value).strip()
        if not room_number:
            raise serializers.ValidationError("Số phòng không được để trống.")
        
        # Kiểm tra trùng lặp nếu tạo mới hoặc sửa sang số phòng khác
        instance = getattr(self, 'instance', None)
        query = Room.objects.filter(room_number__iexact=room_number)
        if instance:
            query = query.exclude(id=instance.id)
        if query.exists():
            raise serializers.ValidationError(f"Phòng số '{room_number}' đã tồn tại trong hệ thống.")
        return room_number

    def validate_floor(self, value):
        if value < 1 or value > 100:
            raise serializers.ValidationError("Số tầng phải nằm trong khoảng từ tầng 1 đến tầng 100.")
        return value


class RoomStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['status']

    def validate_status(self, value):
        valid_statuses = [choice[0] for choice in Room.STATUS_CHOICES]
        if value not in valid_statuses:
            raise serializers.ValidationError(f"Trạng thái '{value}' không hợp lệ. Chỉ chấp nhận: {', '.join(valid_statuses)}.")
        return value
