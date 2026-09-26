import re
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Q
from .models import GuestProfile

User = get_user_model()


class GuestProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = GuestProfile
        fields = ('id_card_number', 'loyalty_points', 'vip_tier', 'preferences')


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    guest_profile = GuestProfileSerializer(read_only=True)

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
            'address',
            'avatar',
            'guest_profile',
            'is_staff',
            'is_superuser',
        )
        read_only_fields = ('id', 'role', 'is_staff', 'is_superuser')

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name if name else obj.username


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
