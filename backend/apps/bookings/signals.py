import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Booking
from .loyalty import award_booking_loyalty_points

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Booking)
def booking_status_changed_listener(sender, instance, created, **kwargs):
    """
    Hook lắng nghe khi Booking được lưu:
    Nếu trạng thái là 'completed' và chưa được cộng điểm -> tự động kích hoạt logic tích điểm.
    """
    if instance.status == 'completed' and not instance.is_points_awarded and instance.guest:
        try:
            points, upgraded = award_booking_loyalty_points(instance)
            if points > 0:
                logger.info(f"Signal: Đã tích {points} điểm cho khách {instance.guest.username} từ đơn {instance.booking_code}.")
        except Exception as e:
            logger.error(f"Lỗi khi thực hiện tích điểm qua Signal: {e}", exc_info=True)
