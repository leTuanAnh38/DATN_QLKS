from rest_framework import serializers
from .models import Room, RoomCategory, Amenity, RoomImage, MaintenanceTicket, MinibarItem, MinibarCheck, LostAndFoundItem


class MaintenanceTicketSerializer(serializers.ModelSerializer):
    room_number = serializers.CharField(source='room.room_number', read_only=True)
    technician_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    booking_code = serializers.CharField(source='booking.booking_code', read_only=True)
    guest_name = serializers.SerializerMethodField()
    issue_type_display = serializers.CharField(source='get_issue_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = MaintenanceTicket
        fields = [
            'id', 'ticket_code', 'room', 'room_number', 'equipment_name',
            'issue_type', 'issue_type_display', 'description', 'start_date', 'completed_date',
            'parts_replaced', 'cost', 'is_guest_fault', 'booking', 'booking_code',
            'guest_name', 'technician', 'technician_name', 'created_by', 'created_by_name',
            'status', 'status_display', 'note'
        ]
        read_only_fields = ['id', 'ticket_code', 'start_date']

    def get_technician_name(self, obj):
        if obj.technician:
            return obj.technician.get_full_name() or obj.technician.username
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_guest_name(self, obj):
        if obj.booking and obj.booking.guest:
            return obj.booking.guest.get_full_name() or obj.booking.guest.username
        return None


class AmenitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Amenity
        fields = ['id', 'name', 'description', 'icon']


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
    amenities = serializers.PrimaryKeyRelatedField(
        queryset=Amenity.objects.all(),
        many=True,
        required=False
    )
    images = RoomImageSerializer(many=True, read_only=True)
    feature_image = serializers.SerializerMethodField()
    total_rooms_count = serializers.SerializerMethodField()

    class Meta:
        model = RoomCategory
        fields = [
            'id', 'name', 'slug', 'short_description', 'description',
            'cancellation_policy', 'size', 'bed_type', 'capacity',
            'base_price', 'promo_price', 'amenities', 'images',
            'feature_image', 'total_rooms_count'
        ]
        read_only_fields = ['id', 'slug', 'total_rooms_count']

    def to_internal_value(self, data):
        # Hỗ trợ parse amenities linh hoạt khi gửi qua FormData hoặc JSON
        mutable_data = data.copy() if hasattr(data, 'copy') else dict(data)
        
        raw_amenities = None
        if hasattr(data, 'getlist') and len(data.getlist('amenities')) > 0:
            raw_amenities = data.getlist('amenities')
        elif hasattr(data, 'getlist') and len(data.getlist('amenity_ids')) > 0:
            raw_amenities = data.getlist('amenity_ids')
        elif 'amenities' in mutable_data:
            raw_amenities = mutable_data['amenities']
        elif 'amenity_ids' in mutable_data:
            raw_amenities = mutable_data['amenity_ids']

        if raw_amenities is not None:
            parsed_ids = []
            if isinstance(raw_amenities, str):
                import json
                try:
                    loaded = json.loads(raw_amenities)
                    if isinstance(loaded, list):
                        parsed_ids = [int(x) for x in loaded if str(x).isdigit()]
                    elif str(loaded).isdigit():
                        parsed_ids = [int(loaded)]
                except Exception:
                    parsed_ids = [int(x.strip()) for x in raw_amenities.split(',') if x.strip().isdigit()]
            elif isinstance(raw_amenities, (list, tuple)):
                for item in raw_amenities:
                    if isinstance(item, str) and (',' in item or item.startswith('[')):
                        import json
                        try:
                            loaded = json.loads(item)
                            if isinstance(loaded, list):
                                parsed_ids.extend([int(x) for x in loaded if str(x).isdigit()])
                            else:
                                parsed_ids.append(int(loaded))
                        except Exception:
                            parsed_ids.extend([int(x.strip()) for x in item.split(',') if x.strip().isdigit()])
                    elif str(item).isdigit():
                        parsed_ids.append(int(item))
                    elif isinstance(item, (int, float)):
                        parsed_ids.append(int(item))

            if hasattr(mutable_data, 'setlist'):
                mutable_data.setlist('amenities', parsed_ids)
            else:
                mutable_data['amenities'] = parsed_ids

        return super().to_internal_value(mutable_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Trả về danh sách chi tiết các tiện nghi kèm id, name, icon
        data['amenities'] = AmenitySerializer(instance.amenities.all(), many=True).data
        return data

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
    current_booking = serializers.SerializerMethodField()
    recent_booking = serializers.SerializerMethodField()
    active_maintenance = serializers.SerializerMethodField()
    latest_minibar_check = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = [
            'id', 'room_number', 'floor', 'status', 'status_display',
            'category', 'category_id', 'category_name',
            'category_base_price', 'category_bed_type',
            'current_booking', 'recent_booking', 'active_maintenance',
            'latest_minibar_check'
        ]

    def get_latest_minibar_check(self, obj):
        try:
            check = obj.minibar_checks.order_by('-created_at').first()
            if check:
                inspector_name = (check.inspector.get_full_name() or check.inspector.username) if check.inspector else 'Nhân viên buồng'
                requested_by_name = (check.requested_by.get_full_name() or check.requested_by.username) if check.requested_by else None
                return {
                    'id': check.id,
                    'check_code': check.check_code,
                    'status': check.status,
                    'status_display': check.get_status_display(),
                    'total_amount': float(check.total_amount),
                    'has_damage': check.has_damage,
                    'damage_description': check.damage_description,
                    'damage_amount': float(check.damage_amount),
                    'items_consumed': check.items_consumed,
                    'note': check.note,
                    'created_at': check.created_at,
                    'completed_at': check.completed_at,
                    'inspector_name': inspector_name,
                    'requested_by_name': requested_by_name,
                }
            return None
        except Exception:
            return None

    def get_active_maintenance(self, obj):
        try:
            ticket = obj.maintenance_tickets.filter(status='fixing').first()
            if ticket:
                return MaintenanceTicketSerializer(ticket).data
            return None
        except Exception:
            return None

    def _format_booking_data(self, bk, obj):
        if not bk:
            return None
        guest = bk.guest
        guest_name = f"{guest.first_name or ''} {guest.last_name or ''}".strip() if guest else "Khách lưu trú"
        if not guest_name and guest:
            guest_name = guest.username

        id_card = bk.identity_card or ''
        if not id_card and guest and hasattr(guest, 'guest_profile') and guest.guest_profile:
            id_card = guest.guest_profile.id_card_number or ''

        return {
            'id': bk.id,
            'booking_code': bk.booking_code,
            'guest_id': bk.guest_id,
            'guest_name': guest_name or (bk.guest_name or 'Khách lưu trú'),
            'guest_phone': (guest.phone_number if guest else '') or (bk.guest_phone or ''),
            'guest_email': (guest.email if guest else '') or (bk.guest_email or ''),
            'identity_card': id_card,
            'check_in_date': bk.check_in_date,
            'check_out_date': bk.check_out_date,
            'actual_check_in': bk.actual_check_in,
            'actual_check_out': bk.actual_check_out,
            'total_amount': float(bk.total_amount) if bk.total_amount else 0,
            'status': bk.status,
            'status_display': bk.get_status_display(),
            'room_number': obj.room_number,
            'room_name': obj.category.name if obj.category else 'Phòng tiêu chuẩn'
        }

    def get_current_booking(self, obj):
        try:
            # Lấy đơn đặt phòng đang lưu trú (status='checked_in')
            bk = obj.bookings.filter(status='checked_in').select_related('guest', 'category').first()
            return self._format_booking_data(bk, obj)
        except Exception:
            return None

    def get_recent_booking(self, obj):
        try:
            # Ưu tiên đơn đang ở, nếu không có lấy đơn vừa hoàn tất gần nhất (cho buồng phòng dọn kiểm kê)
            bk = obj.bookings.filter(status='checked_in').select_related('guest', 'category').first()
            if not bk:
                bk = obj.bookings.filter(status__in=['completed', 'checked_in']).select_related('guest', 'category').order_by('-updated_at', '-id').first()
            return self._format_booking_data(bk, obj)
        except Exception:
            return None

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


class MinibarItemSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = MinibarItem
        fields = ['id', 'name', 'category', 'category_display', 'price', 'standard_quantity', 'image_url', 'is_active', 'created_at']


class MinibarCheckSerializer(serializers.ModelSerializer):
    room_number = serializers.CharField(source='room.room_number', read_only=True)
    inspector_name = serializers.SerializerMethodField()
    requested_by_name = serializers.SerializerMethodField()
    booking_code = serializers.CharField(source='booking.booking_code', read_only=True)
    guest_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = MinibarCheck
        fields = [
            'id', 'check_code', 'room', 'room_number', 'booking', 'booking_code',
            'guest_name', 'inspector', 'inspector_name', 'requested_by', 'requested_by_name',
            'status', 'status_display', 'items_consumed', 'total_amount',
            'has_damage', 'damage_description', 'damage_amount',
            'note', 'created_at', 'completed_at'
        ]
        read_only_fields = ['id', 'check_code', 'created_at']

    def get_inspector_name(self, obj):
        if obj.inspector:
            return obj.inspector.get_full_name() or obj.inspector.username
        return None

    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return obj.requested_by.get_full_name() or obj.requested_by.username
        return None

    def get_guest_name(self, obj):
        if obj.booking:
            if obj.booking.guest:
                return obj.booking.guest.get_full_name() or obj.booking.guest.username
            elif getattr(obj.booking, 'guest_name', None):
                return str(obj.booking.guest_name)
            return "Khách lưu trú"
        return None


class LostAndFoundItemSerializer(serializers.ModelSerializer):
    room_number = serializers.CharField(source='room.room_number', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    finder_name = serializers.SerializerMethodField()
    handled_by_name = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = LostAndFoundItem
        fields = [
            'id', 'tracking_code', 'room', 'room_number', 'location_found',
            'item_name', 'category', 'category_display', 'description',
            'image', 'image_url', 'found_date', 'finder', 'finder_name',
            'booking', 'guest_name', 'guest_phone', 'storage_location',
            'status', 'status_display', 'returned_date', 'returned_to',
            'return_note', 'handled_by', 'handled_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'tracking_code', 'created_at', 'updated_at']

    def get_finder_name(self, obj):
        if obj.finder:
            return obj.finder.get_full_name() or obj.finder.username
        return None

    def get_handled_by_name(self, obj):
        if obj.handled_by:
            return obj.handled_by.get_full_name() or obj.handled_by.username
        return None

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url

