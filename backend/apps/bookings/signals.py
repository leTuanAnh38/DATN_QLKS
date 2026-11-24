import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Booking
from ..payments.models import Invoice
from .loyalty import award_booking_loyalty_points

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Booking)
def booking_status_changed_listener(sender, instance, created, **kwargs):
    """
    Hook lắng nghe khi Booking được lưu:
    Nếu trạng thái là 'completed' và chưa được cộng điểm -> tự động kích hoạt logic tích điểm
    (chỉ cộng thực tế khi đơn / hóa đơn tổng đoàn đã thanh toán).
    """
    if instance.status == 'completed' and not instance.is_points_awarded and instance.guest:
        try:
            points, upgraded = award_booking_loyalty_points(instance)
            if points > 0:
                logger.info(f"Signal: Đã tích {points} điểm cho khách {instance.guest.username} từ đơn {instance.booking_code}.")
        except Exception as e:
            logger.error(f"Lỗi khi thực hiện tích điểm qua Signal: {e}", exc_info=True)


@receiver(post_save, sender=Invoice)
def invoice_paid_loyalty_listener(sender, instance, created, **kwargs):
    """
    Khi Hóa đơn (đặc biệt là Master Invoice của đoàn B2B trả sau hoặc đơn lẻ) được chuyển sang 'paid',
    tự động kích hoạt cộng điểm tích lũy cho các đơn đã completed nhưng chưa được cộng điểm.
    """
    if instance.status != 'paid':
        return
    try:
        if instance.group_booking_id:
            subs = instance.group_booking.sub_bookings.filter(
                status='completed',
                is_points_awarded=False,
                guest__isnull=False
            ).select_related('guest')
            for sub in subs:
                award_booking_loyalty_points(sub)
        elif instance.booking_id:
            b = instance.booking
            if b and b.status == 'completed' and not b.is_points_awarded and b.guest_id:
                award_booking_loyalty_points(b)
    except Exception as e:
        logger.error(f"Lỗi khi tích điểm từ Invoice #{instance.id}: {e}", exc_info=True)
