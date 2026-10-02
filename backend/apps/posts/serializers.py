from rest_framework import serializers
from .models import Post


class PostSerializer(serializers.ModelSerializer):
    """
    Serializer đầy đủ cho CRUD Bài viết & Chi tiết bài viết
    """
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id',
            'title',
            'slug',
            'category',
            'category_display',
            'author',
            'status',
            'status_display',
            'thumbnail',
            'thumbnail_url',
            'summary',
            'content',
            'view_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'view_count', 'created_at', 'updated_at']

    def get_thumbnail_url(self, obj):
        if obj.thumbnail:
            name = str(obj.thumbnail)
            if name.startswith(('http://', 'https://')):
                return name
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.thumbnail.url)
            return obj.thumbnail.url
        return None


class PostListSerializer(serializers.ModelSerializer):
    """
    Serializer rút gọn (loại bỏ trường content HTML lớn) phục vụ danh sách bài viết tải siêu nhanh
    """
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id',
            'title',
            'slug',
            'category',
            'category_display',
            'author',
            'status',
            'status_display',
            'thumbnail',
            'thumbnail_url',
            'summary',
            'view_count',
            'created_at',
            'updated_at',
        ]

    def get_thumbnail_url(self, obj):
        if obj.thumbnail:
            name = str(obj.thumbnail)
            if name.startswith(('http://', 'https://')):
                return name
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.thumbnail.url)
            return obj.thumbnail.url
        return None
