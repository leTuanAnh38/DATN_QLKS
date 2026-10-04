from rest_framework import serializers

from .models import ContactMessage


class ContactMessageSerializer(serializers.ModelSerializer):
    """Serializer đầy đủ trả về cho Admin / Lễ tân."""

    class Meta:
        model = ContactMessage
        fields = ['id', 'name', 'email', 'subject', 'message', 'is_read', 'created_at']
        read_only_fields = fields


class ContactMessageCreateSerializer(serializers.ModelSerializer):
    """
    Serializer cho API public (khách gửi liên hệ).
    Chỉ nhận 4 trường nhập liệu; is_read / created_at do hệ thống quản lý.
    """
    name = serializers.CharField(max_length=150)
    subject = serializers.CharField(max_length=255)
    message = serializers.CharField(max_length=5000)

    class Meta:
        model = ContactMessage
        fields = ['name', 'email', 'subject', 'message']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Vui lòng nhập họ tên.')
        return value

    def validate_subject(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Vui lòng nhập chủ đề.')
        return value

    def validate_message(self, value):
        value = value.strip()
        if len(value) < 5:
            raise serializers.ValidationError('Nội dung quá ngắn, vui lòng nhập tối thiểu 5 ký tự.')
        return value
