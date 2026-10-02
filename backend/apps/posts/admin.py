from django.contrib import admin
from .models import Post


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'author', 'status', 'view_count', 'created_at')
    list_filter = ('category', 'status', 'created_at')
    search_fields = ('title', 'summary', 'content', 'author')
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ('view_count', 'created_at', 'updated_at')
