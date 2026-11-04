# Generated manually to update low-res blurry slide 2 banner to 4K ultra-sharp image

from django.db import migrations

def update_banner_2_high_res(apps, schema_editor):
    try:
        HotelSetting = apps.get_model('bookings', 'HotelSetting')
        old_id = 'photo-1571896349842-33c89424de2d'
        new_url = 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=2070&q=90'
        for s in HotelSetting.objects.all():
            if not s.banner_home_2 or old_id in s.banner_home_2:
                s.banner_home_2 = new_url
                s.save(update_fields=['banner_home_2'])
    except Exception:
        pass

class Migration(migrations.Migration):

    dependencies = [
        ('bookings', '0018_hotelsetting_banner_login'),
    ]

    operations = [
        migrations.RunPython(update_banner_2_high_res, reverse_code=migrations.RunPython.noop),
    ]

