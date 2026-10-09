import re
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Q
from .models import GuestProfile, EmployeeProfile, AuditLog

User = get_user_model()


class GuestProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = GuestProfile
        fields = ('id_card_number', 'loyalty_points', 'vip_tier', 'preferences')


class EmployeeProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeProfile
        fields = (
            'id',
            'employee_code',
            'department',
            'position',
            'shift',
            'base_salary',
            'hire_date',
        )


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    guest_profile = GuestProfileSerializer(read_only=True)
    employee_profile = EmployeeProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'phone_number',
            'role',
            'role_display',
            'address',
            'avatar',
            'guest_profile',
            'employee_profile',
            'is_staff',
            'is_superuser',
        )
        read_only_fields = ('id', 'role', 'is_staff', 'is_superuser')

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name if name else obj.username

    def get_avatar(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get('request')
        if request:
            try:
                return request.build_absolute_uri(obj.avatar.url)
            except Exception:
                pass
        return obj.avatar.url

    def to_representation(self, instance):
        data = super().to_representation(instance)
        profile = getattr(instance, 'guest_profile', None)
        id_card = profile.id_card_number if profile and profile.id_card_number else ''
        prefs = profile.preferences if profile and profile.preferences else ''
        data['id_card_number'] = id_card
        data['identity_card'] = id_card
        data['preferences'] = prefs
        return data


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer chuyên biệt cho trang Hồ sơ cá nhân (Khách hàng & Nhân sự)
    - Editable: first_name, last_name, phone_number, email, avatar, address, id_card_number, preferences
    - Read-only: role, role_display, department, employee_code, position, shift, hire_date
    """
    full_name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    department = serializers.SerializerMethodField()
    employee_code = serializers.SerializerMethodField()
    position = serializers.SerializerMethodField()
    shift = serializers.SerializerMethodField()
    hire_date = serializers.SerializerMethodField()
    avatar = serializers.ImageField(required=False, allow_null=True)
    guest_profile = GuestProfileSerializer(read_only=True)
    employee_profile = EmployeeProfileSerializer(read_only=True)
    id_card_number = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    identity_card = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    preferences = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'phone_number',
            'role',
            'role_display',
            'department',
            'employee_code',
            'position',
            'shift',
            'hire_date',
            'address',
            'avatar',
            'guest_profile',
            'employee_profile',
            'is_staff',
            'is_superuser',
            'id_card_number',
            'identity_card',
            'preferences',
        )
        read_only_fields = (
            'id',
            'username',
            'role',
            'role_display',
            'department',
            'employee_code',
            'position',
            'shift',
            'hire_date',
            'guest_profile',
            'employee_profile',
            'is_staff',
            'is_superuser',
        )

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name if name else obj.username

    def get_department(self, obj):
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            return obj.employee_profile.department
        return None

    def get_employee_code(self, obj):
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            return obj.employee_profile.employee_code
        return None

    def get_position(self, obj):
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            return obj.employee_profile.position
        return None

    def get_shift(self, obj):
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            return obj.employee_profile.shift
        return None

    def get_hire_date(self, obj):
        if hasattr(obj, 'employee_profile') and obj.employee_profile:
            return obj.employee_profile.hire_date
        return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        profile = getattr(instance, 'guest_profile', None)
        id_card = profile.id_card_number if profile and profile.id_card_number else ''
        prefs = profile.preferences if profile and profile.preferences else ''
        data['id_card_number'] = id_card
        data['identity_card'] = id_card
        data['preferences'] = prefs
        return data

    def validate_email(self, value):
        if not value:
            return value
        email = value.strip().lower()
        user = self.instance
        if user and User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("Địa chỉ email này đã được liên kết với một tài khoản khác.")
        return email

    def validate_phone_number(self, value):
        if not value:
            return value
        phone = re.sub(r'[\s\-\.]', '', str(value).strip())
        if not re.match(r'^(0|\+84)[0-9]{9,10}$', phone):
            raise serializers.ValidationError("Số điện thoại không hợp lệ (Vui lòng nhập đúng định dạng Việt Nam).")
        user = self.instance
        if user and User.objects.filter(phone_number=phone).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("Số điện thoại này đã được liên kết với một tài khoản khác.")
        return phone

    def update(self, instance, validated_data):
        request = self.context.get('request')

        # Hỗ trợ tách Họ & Tên nếu client gửi full_name
        if request and 'full_name' in request.data:
            full_name = str(request.data.get('full_name', '')).strip()
            if full_name and not ('first_name' in validated_data or 'last_name' in validated_data):
                parts = full_name.split()
                if len(parts) > 1:
                    instance.first_name = " ".join(parts[:-1])
                    instance.last_name = parts[-1]
                else:
                    instance.first_name = full_name
                    instance.last_name = ""

        if 'first_name' in validated_data:
            instance.first_name = validated_data['first_name']
        if 'last_name' in validated_data:
            instance.last_name = validated_data['last_name']
        if 'phone_number' in validated_data:
            instance.phone_number = validated_data['phone_number']
        if 'email' in validated_data and validated_data['email']:
            instance.email = validated_data['email']
        if 'address' in validated_data:
            instance.address = validated_data['address']

        # Xử lý cập nhật Avatar ảnh đại diện
        if 'avatar' in validated_data:
            new_avatar = validated_data['avatar']
            if new_avatar:
                instance.avatar = new_avatar

        # Xóa avatar nếu có cờ remove_avatar
        if request and str(request.data.get('remove_avatar', '')).lower() in ['true', '1']:
            if instance.avatar:
                instance.avatar.delete(save=False)
            instance.avatar = None

        instance.save()

        # Cập nhật thông tin GuestProfile (CCCD / Passport, sở thích)
        id_card = validated_data.pop('id_card_number', None)
        if id_card is None:
            id_card = validated_data.pop('identity_card', None)
        if id_card is None and request:
            if 'id_card_number' in request.data:
                id_card = request.data.get('id_card_number')
            elif 'identity_card' in request.data:
                id_card = request.data.get('identity_card')

        prefs = validated_data.pop('preferences', None)
        if prefs is None and request and 'preferences' in request.data:
            prefs = request.data.get('preferences')

        if id_card is not None or prefs is not None:
            guest_profile, _ = GuestProfile.objects.get_or_create(user=instance)
            if id_card is not None:
                guest_profile.id_card_number = str(id_card).strip()
            if prefs is not None:
                guest_profile.preferences = str(prefs).strip()
            guest_profile.save()
            instance.guest_profile = guest_profile

        return instance


class RegisterSerializer(serializers.Serializer):
    fullName = serializers.CharField(max_length=150, required=True)
    phone = serializers.CharField(max_length=20, required=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(min_length=6, write_only=True, required=True)

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Địa chỉ email này đã được đăng ký tài khoản.")
        return email

    def validate_phone(self, value):
        phone = re.sub(r'[\s\-\.]', '', value.strip())
        if not re.match(r'^(0|\+84)[0-9]{9,10}$', phone):
            raise serializers.ValidationError("Số điện thoại không hợp lệ (Vui lòng nhập đúng số điện thoại Việt Nam).")
        if User.objects.filter(phone_number=phone).exists():
            raise serializers.ValidationError("Số điện thoại này đã được liên kết với một tài khoản khác.")
        return phone

    def create(self, validated_data):
        full_name = validated_data['fullName'].strip()
        phone = validated_data['phone']
        email = validated_data['email']
        password = validated_data['password']

        # Tách Họ và Tên
        parts = full_name.split()
        if len(parts) > 1:
            first_name = " ".join(parts[:-1])
            last_name = parts[-1]
        else:
            first_name = full_name
            last_name = ""

        # Tạo username duy nhất từ email hoặc phone
        base_username = email.split('@')[0]
        # Xóa các ký tự đặc biệt khỏi username
        base_username = re.sub(r'[^a-zA-Z0-9_]', '', base_username) or f"user_{phone[-4:]}"
        username = base_username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{counter}"
            counter += 1

        user = User(
            username=username,
            email=email,
            phone_number=phone,
            first_name=first_name,
            last_name=last_name,
            role='guest',
        )
        user.set_password(password)
        user.save()

        # Tạo hồ sơ khách hàng mặc định
        GuestProfile.objects.create(
            user=user,
            vip_tier='Silver',
            loyalty_points=0
        )

        return user


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        identifier = attrs.get('identifier', '').strip()
        password = attrs.get('password', '')

        if not identifier or not password:
            raise serializers.ValidationError("Vui lòng điền đầy đủ thông tin tài khoản và mật khẩu.")

        # Chuẩn hóa phone nếu là số điện thoại
        clean_phone = re.sub(r'[\s\-\.]', '', identifier)

        # Tìm user theo email, số điện thoại hoặc username
        user = User.objects.filter(
            Q(email__iexact=identifier) |
            Q(phone_number=clean_phone) |
            Q(phone_number=identifier) |
            Q(username__iexact=identifier)
        ).first()

        if not user:
            raise serializers.ValidationError("Tài khoản (Email hoặc Số điện thoại) không tồn tại trên hệ thống.")

        if not user.check_password(password):
            raise serializers.ValidationError("Mật khẩu không chính xác. Vui lòng kiểm tra lại.")

        if not user.is_active:
            raise serializers.ValidationError("Tài khoản của quý khách hiện đang bị tạm khóa.")

        attrs['user'] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(min_length=6, required=True, write_only=True)
    confirm_password = serializers.CharField(min_length=6, required=True, write_only=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Mật khẩu hiện tại không chính xác.")
        return value

    def validate(self, attrs):
        old_password = attrs.get('old_password')
        new_password = attrs.get('new_password')
        confirm_password = attrs.get('confirm_password')

        if new_password != confirm_password:
            raise serializers.ValidationError({"confirm_password": "Mật khẩu xác nhận không trùng khớp với mật khẩu mới."})

        if old_password == new_password:
            raise serializers.ValidationError({"new_password": "Mật khẩu mới không được trùng với mật khẩu hiện tại."})

        return attrs

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class UpdateProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(required=False, allow_blank=True)
    id_card_number = serializers.CharField(required=False, allow_blank=True)
    preferences = serializers.CharField(required=False, allow_blank=True)
    remove_avatar = serializers.BooleanField(required=False, default=False)

    class Meta:
        model = User
        fields = (
            'full_name',
            'email',
            'phone_number',
            'address',
            'avatar',
            'remove_avatar',
            'id_card_number',
            'preferences',
        )

    def validate_email(self, value):
        user = self.instance
        if not value:
            return value
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("Địa chỉ email này đã được sử dụng bởi tài khoản khác.")
        return email

    def validate_phone_number(self, value):
        if not value:
            return value
        user = self.instance
        phone = re.sub(r'[\s\-\.]', '', value.strip())
        if not re.match(r'^(0|\+84)[0-9]{9,10}$', phone):
            raise serializers.ValidationError("Số điện thoại không hợp lệ (Vui lòng nhập đúng số điện thoại Việt Nam).")
        if User.objects.filter(phone_number=phone).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("Số điện thoại này đã được liên kết với một tài khoản khác.")
        return phone

    def update(self, instance, validated_data):
        full_name = validated_data.pop('full_name', None)
        id_card_number = validated_data.pop('id_card_number', None)
        preferences = validated_data.pop('preferences', None)
        remove_avatar = validated_data.pop('remove_avatar', False)

        if full_name is not None:
            parts = full_name.strip().split()
            if len(parts) > 1:
                instance.first_name = " ".join(parts[:-1])
                instance.last_name = parts[-1]
            elif len(parts) == 1:
                instance.first_name = parts[0]
                instance.last_name = ""

        if remove_avatar:
            if instance.avatar:
                instance.avatar.delete(save=False)
            instance.avatar = None
        elif 'avatar' in validated_data and validated_data['avatar']:
            instance.avatar = validated_data['avatar']

        if 'email' in validated_data:
            instance.email = validated_data['email']
        if 'phone_number' in validated_data:
            instance.phone_number = validated_data['phone_number']
        if 'address' in validated_data:
            instance.address = validated_data['address']

        instance.save()

        # Cập nhật hoặc tạo GuestProfile
        guest_profile, _ = GuestProfile.objects.get_or_create(user=instance)
        if id_card_number is not None:
            guest_profile.id_card_number = id_card_number
        if preferences is not None:
            guest_profile.preferences = preferences
        guest_profile.save()

        return instance


# =========================================================================
# PHÂN HỆ QUẢN TRỊ ADMIN: QUẢN LÝ KHÁCH HÀNG & NHÂN SỰ
# =========================================================================

class AdminGuestSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    guest_profile = GuestProfileSerializer(read_only=True)
    total_bookings = serializers.SerializerMethodField()
    total_spent = serializers.SerializerMethodField()
    id_card_number = serializers.CharField(write_only=True, required=False, allow_blank=True)
    vip_tier = serializers.CharField(write_only=True, required=False, allow_blank=True)
    loyalty_points = serializers.IntegerField(write_only=True, required=False)
    preferences = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'phone_number',
            'address',
            'avatar',
            'role',
            'is_active',
            'date_joined',
            'last_login',
            'guest_profile',
            'total_bookings',
            'total_spent',
            'id_card_number',
            'vip_tier',
            'loyalty_points',
            'preferences',
        )
        read_only_fields = ('id', 'role', 'date_joined', 'last_login')

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name if name else obj.username

    def get_total_bookings(self, obj):
        if hasattr(obj, 'annotated_total_bookings') and obj.annotated_total_bookings is not None:
            return obj.annotated_total_bookings
        try:
            from ..bookings.models import Booking
            return Booking.objects.filter(guest=obj).count()
        except Exception:
            return 0

    def get_total_spent(self, obj):
        if hasattr(obj, 'annotated_total_spent') and obj.annotated_total_spent is not None:
            return float(obj.annotated_total_spent)
        try:
            from ..bookings.models import Booking
            from django.db.models import Sum
            val = Booking.objects.filter(
                guest=obj,
                status__in=['confirmed', 'checked_in', 'checked_out', 'completed']
            ).aggregate(total=Sum('total_amount'))['total']
            return float(val) if val else 0.0
        except Exception:
            return 0.0

    def update(self, instance, validated_data):
        id_card = validated_data.pop('id_card_number', None)
        vip_tier = validated_data.pop('vip_tier', None)
        points = validated_data.pop('loyalty_points', None)
        prefs = validated_data.pop('preferences', None)

        full_name = validated_data.pop('full_name', None)
        if full_name:
            parts = full_name.strip().split()
            if len(parts) > 1:
                instance.first_name = " ".join(parts[:-1])
                instance.last_name = parts[-1]
            else:
                instance.first_name = parts[0]
                instance.last_name = ""

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        profile, _ = GuestProfile.objects.get_or_create(user=instance)
        if id_card is not None:
            profile.id_card_number = id_card
        if vip_tier is not None:
            profile.vip_tier = vip_tier
        if points is not None:
            profile.loyalty_points = points
        if prefs is not None:
            profile.preferences = prefs
        profile.save()

        return instance


class AdminEmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    employee_profile = EmployeeProfileSerializer(read_only=True)
    password = serializers.CharField(write_only=True, required=False, min_length=6)
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    employee_code = serializers.CharField(write_only=True, required=False, allow_blank=True)
    department = serializers.CharField(write_only=True, required=False, allow_blank=True)
    position = serializers.CharField(write_only=True, required=False, allow_blank=True)
    shift = serializers.CharField(write_only=True, required=False, allow_blank=True)
    base_salary = serializers.DecimalField(write_only=True, required=False, max_digits=12, decimal_places=0, allow_null=True)
    hire_date = serializers.DateField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'phone_number',
            'role',
            'role_display',
            'address',
            'avatar',
            'is_active',
            'is_staff',
            'date_joined',
            'last_login',
            'password',
            'employee_profile',
            'employee_code',
            'department',
            'position',
            'shift',
            'base_salary',
            'hire_date',
        )
        read_only_fields = ('id', 'date_joined', 'last_login')

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name if name else obj.username

    def create(self, validated_data):
        password = validated_data.pop('password', 'Password123')
        code = validated_data.pop('employee_code', '')
        dept = validated_data.pop('department', 'Lễ Tân & Tiền Sảnh')
        pos = validated_data.pop('position', 'Nhân viên')
        shift = validated_data.pop('shift', 'Ca Sáng (06:00 - 14:00)')
        salary = validated_data.pop('base_salary', 10000000)
        hire = validated_data.pop('hire_date', None)

        user = User(**validated_data)
        user.set_password(password)
        if user.role != 'guest':
            user.is_staff = True
        user.save()

        if not code:
            code = f"NV{user.id:04d}"

        EmployeeProfile.objects.create(
            user=user,
            employee_code=code,
            department=dept or 'Lễ Tân & Tiền Sảnh',
            position=pos or 'Nhân viên',
            shift=shift or 'Ca Sáng (06:00 - 14:00)',
            base_salary=salary or 10000000,
            hire_date=hire
        )
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        code = validated_data.pop('employee_code', None)
        dept = validated_data.pop('department', None)
        pos = validated_data.pop('position', None)
        shift = validated_data.pop('shift', None)
        salary = validated_data.pop('base_salary', None)
        hire = validated_data.pop('hire_date', None)

        if password:
            instance.set_password(password)

        full_name = validated_data.pop('full_name', None)
        if full_name:
            parts = full_name.strip().split()
            if len(parts) > 1:
                instance.first_name = " ".join(parts[:-1])
                instance.last_name = parts[-1]
            else:
                instance.first_name = parts[0]
                instance.last_name = ""

        role = validated_data.get('role', instance.role)
        if role != 'guest':
            instance.is_staff = True
        else:
            instance.is_staff = False

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        profile, _ = EmployeeProfile.objects.get_or_create(
            user=instance,
            defaults={'employee_code': f"NV{instance.id:04d}", 'department': 'Lễ Tân & Tiền Sảnh'}
        )
        if code is not None and code.strip():
            profile.employee_code = code
        if dept is not None:
            profile.department = dept
        if pos is not None:
            profile.position = pos
        if shift is not None:
            profile.shift = shift
        if salary is not None:
            profile.base_salary = salary
        if hire is not None:
            profile.hire_date = hire
        profile.save()

        return instance


class AuditLogSerializer(serializers.ModelSerializer):
    """
    Serializer cho Nhật ký thao tác hệ thống (Audit Log)
    Cung cấp thông tin chi tiết người thực hiện (tên, vai trò, hiển thị vai trò)
    """
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    user_full_name = serializers.SerializerMethodField()
    user_role = serializers.CharField(source='user.role', read_only=True)
    user_role_display = serializers.CharField(source='user.get_role_display', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    module_display = serializers.CharField(source='get_module_display', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'user_id',
            'username',
            'user_full_name',
            'user_role',
            'user_role_display',
            'action',
            'action_display',
            'module',
            'module_display',
            'description',
            'ip_address',
            'created_at',
        ]
        read_only_fields = fields

    def get_user_full_name(self, obj):
        if not obj.user:
            return "Hệ thống"
        full_name = f"{obj.user.last_name or ''} {obj.user.first_name or ''}".strip()
        return full_name if full_name else obj.user.username



