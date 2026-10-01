from django.contrib import admin
from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('id', 'guest', 'room_category', 'overall_rating', 'is_visible', 'created_at')
    list_filter = ('is_visible', 'overall_rating', 'room_category', 'created_at')
    search_fields = ('guest__username', 'guest__email', 'guest__full_name', 'comment', 'booking__booking_code')
    readonly_fields = ('overall_rating', 'created_at', 'updated_at')
