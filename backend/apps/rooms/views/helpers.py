"""Hàm tiện ích cho rooms."""
from django.utils.text import slugify
from ..models import RoomCategory



def generate_unique_slug(name, instance=None):
    """
    Tự động tạo slug không dấu, không trùng lặp cho Hạng phòng.
    """
    base_slug = slugify(name) or 'room-category'
    slug = base_slug
    counter = 1
    qs = RoomCategory.objects.filter(slug=slug)
    if instance:
        qs = qs.exclude(id=instance.id)
    while qs.exists():
        slug = f"{base_slug}-{counter}"
        counter += 1
        qs = RoomCategory.objects.filter(slug=slug)
        if instance:
            qs = qs.exclude(id=instance.id)
    return slug
