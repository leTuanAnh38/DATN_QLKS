from rest_framework import serializers
from django.utils import timezone
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    created_at_display = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id',
            'title',
            'message',
            'is_read',
            'created_at',
            'created_at_display'
        ]
        read_only_fields = ['id', 'title', 'message', 'created_at', 'created_at_display']

    def get_created_at_display(self, obj):
        if not obj.created_at:
            return ''
        local_time = timezone.localtime(obj.created_at)
        return local_time.strftime('%H:%M • %d/%m/%Y')
