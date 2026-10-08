import datetime
import logging
from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model

from ..bookings.models import Booking
from .models import Notification

logger = logging.getLogger(__name__)
User = get_user_model()

# Biến bộ nhớ lưu mốc thời gian lần quét tự động gần nhất
_LAST_REMINDER_CHECK = None


def get_staff_and_admin_users(exclude_user_id=None):
    """
    Lấy danh sách các tài khoản Nhân viên, Lễ tân và Quản trị viên để gửi thông báo
    """
    qs = User.objects.filter(
        models.Q(is_staff=True) |
        models.Q(is_superuser=True) |
        models.Q(role__in=['admin', 'owner', 'manager', 'receptionist', 'service_staff', 'staff'])
    )
    if exclude_user_id:
        qs = qs.exclude(id=exclude_user_id)
    return qs.distinct()


def send_checkin_checkout_reminders(target_date=None, force=False):
    """
    Gửi thông báo nhắc nhở Check-in và Check-out đến Khách hàng và Nhân viên/Quản lý:
    1. Check-in hôm nay:
       - Các đơn có check_in_date == target_date và status in ['pending', 'confirmed']
       - Gửi thông báo đến Khách hàng: Giờ check-in tiêu chuẩn (14:00), giấy tờ tùy thân CCCD/Hộ chiếu.
       - Gửi thông báo đến Nhân viên & Quản lý: Lịch đón khách, kiểm tra phòng ốc sẵn sàng.
    2. Check-out hôm nay:
       - Các đơn có check_out_date == target_date và status == 'checked_in'
       - Gửi thông báo đến Khách hàng: Giờ check-out tiêu chuẩn (trước 12:00 trưa), hỗ trợ hành lý / gia hạn.
       - Gửi thông báo đến Nhân viên & Quản lý: Rà soát phụ phí, minibar, chuẩn bị hóa đơn và báo Buồng phòng dọn dẹp.
    
    Ngăn chặn spam (Cách 1): Kiểm tra .exists() trong bảng Notification theo ngày.
    Nếu hôm nay đã gửi thông báo cho đơn này rồi thì lập tức bỏ qua (continue).
    """
    if target_date is None:
        target_date = timezone.localdate()

    # Tính khoảng thời gian 00:00:00 -> 23:59:59 của ngày target theo múi giờ hệ thống
    tz = timezone.get_current_timezone()
    start_of_day = timezone.make_aware(datetime.datetime.combine(target_date, datetime.time.min), tz)
    end_of_day = timezone.make_aware(datetime.datetime.combine(target_date, datetime.time.max), tz)

    date_str = target_date.strftime('%d/%m/%Y')
    staff_users = list(get_staff_and_admin_users())

    guest_checkin_count = 0
    staff_checkin_count = 0
    guest_checkout_count = 0
    staff_checkout_count = 0

    new_notifications = []

    # ==============================================================================
    # 1. XỬ LÝ NHẮC NHỞ CHECK-IN HÔM NAY
    # ==============================================================================
    checkin_bookings = Booking.objects.filter(
        check_in_date=target_date,
        status__in=['pending', 'confirmed']
    ).select_related('guest', 'category', 'room')

    for booking in checkin_bookings:
        # CÁCH 1: KIỂM TRA TỒN TẠI TRONG BẢNG NOTIFICATION ĐỂ CHỐNG SPAM
        already_notified_checkin = Notification.objects.filter(
            title__icontains="Check-in",
            message__contains=booking.booking_code,
            created_at__range=(start_of_day, end_of_day)
        ).exists()

        if already_notified_checkin and not force:
            logger.debug(f"[Check-in Reminder] Bỏ qua đơn #{booking.booking_code}: Đã gửi thông báo trong ngày {date_str}.")
            continue

        guest = booking.guest
        guest_name = guest.get_full_name() or guest.username if guest else "Quý khách"
        category_name = booking.category.name if booking.category else "Tiêu chuẩn"
        room_label = f"Phòng {booking.room.room_number}" if booking.room else "Chờ gán số phòng"

        # 1.1. Thông báo cho Khách hàng
        if guest:
            new_notifications.append(
                Notification(
                    recipient=guest,
                    title="🔔 Nhắc nhở Check-in: Kỳ nghỉ của quý khách bắt đầu hôm nay!",
                    message=(
                        f"Khách sạn TA Đà Nẵng xin chào quý khách {guest_name}! Hôm nay ({date_str}) là ngày nhận phòng của quý khách "
                        f"(Mã đơn: #{booking.booking_code}, Hạng phòng: {category_name}). "
                        f"Giờ nhận phòng tiêu chuẩn bắt đầu từ 14:00. Quý khách vui lòng chuẩn bị CCCD/Hộ chiếu khi đến quầy Lễ tân để hoàn tất thủ tục nhận phòng. "
                        f"Khách sạn rất hân hạnh được đón tiếp và phục vụ quý khách!"
                    )
                )
            )
            guest_checkin_count += 1

        # 1.2. Thông báo cho Nhân viên & Quản lý
        for staff in staff_users:
            if guest and staff.id == guest.id:
                continue
            new_notifications.append(
                Notification(
                    recipient=staff,
                    title=f"📥 Lịch Check-in hôm nay: Khách {guest_name} (#{booking.booking_code})",
                    message=(
                        f"Hôm nay ({date_str}) có lịch đón khách {guest_name} đến nhận phòng "
                        f"(Mã đơn: #{booking.booking_code}, Hạng: {category_name}, Số phòng: {room_label}). "
                        f"Giờ check-in tiêu chuẩn từ 14:00. Bộ phận Lễ tân & Buồng phòng vui lòng kiểm tra phòng ốc sẵn sàng đón khách chu đáo."
                    )
                )
            )
            staff_checkin_count += 1

    # ==============================================================================
    # 2. XỬ LÝ NHẮC NHỞ CHECK-OUT HÔM NAY (QUY TẮC CHỐNG SPAM MỖI 15 PHÚT)
    # ==============================================================================
    checkout_bookings = Booking.objects.filter(
        check_out_date=target_date,
        status='checked_in'
    ).select_related('guest', 'category', 'room')

    for booking in checkout_bookings:
        # CÁCH 1: KIỂM TRA TỒN TẠI TRONG BẢNG NOTIFICATION ĐỂ CHỐNG SPAM
        already_notified_checkout = Notification.objects.filter(
            title__icontains="Check-out",
            message__contains=booking.booking_code,
            created_at__range=(start_of_day, end_of_day)
        ).exists()

        if already_notified_checkout and not force:
            logger.debug(f"[Check-out Reminder] Bỏ qua đơn #{booking.booking_code}: Đã gửi thông báo trong ngày {date_str}.")
            continue

        guest = booking.guest
        guest_name = guest.get_full_name() or guest.username if guest else "Quý khách"
        room_label = f"Phòng {booking.room.room_number}" if booking.room else "Phòng lưu trú"

        # 2.1. Thông báo cho Khách hàng
        if guest:
            new_notifications.append(
                Notification(
                    recipient=guest,
                    title="🔔 Nhắc nhở Check-out: Đến hạn trả phòng hôm nay",
                    message=(
                        f"Khách sạn TA Đà Nẵng xin thông báo: Hôm nay ({date_str}) là ngày trả phòng của quý khách "
                        f"({room_label}, Mã đơn: #{booking.booking_code}). "
                        f"Giờ trả phòng tiêu chuẩn là trước 12:00 trưa. Nếu quý khách có nhu cầu gia hạn thời gian lưu trú "
                        f"hoặc cần hỗ trợ hành lý, xe đưa đón sân bay, vui lòng liên hệ quầy Lễ tân qua hotline khách sạn để được phục vụ tốt nhất!"
                    )
                )
            )
            guest_checkout_count += 1

        # 2.2. Thông báo cho Nhân viên & Quản lý
        for staff in staff_users:
            if guest and staff.id == guest.id:
                continue
            new_notifications.append(
                Notification(
                    recipient=staff,
                    title=f"📤 Lịch Check-out hôm nay: {room_label} - Khách {guest_name}",
                    message=(
                        f"{room_label} (Khách hàng: {guest_name}, Mã đơn: #{booking.booking_code}) "
                        f"có lịch trả phòng trong ngày hôm nay ({date_str}, tiêu chuẩn trước 12:00 trưa). "
                        f"Bộ phận Lễ tân rà soát phụ phí/minibar, chuẩn bị hóa đơn thanh toán và thông báo Buồng phòng sẵn sàng dọn phòng sau khi khách trả phòng."
                    )
                )
            )
            staff_checkout_count += 1

    # Lưu tất cả thông báo mới tạo vào database
    if new_notifications:
        Notification.objects.bulk_create(new_notifications)
        logger.info(f"Đã tạo {len(new_notifications)} thông báo Check-in/Check-out ngày {date_str}")

    return {
        'date': str(target_date),
        'checkin_bookings_count': checkin_bookings.count(),
        'checkout_bookings_count': checkout_bookings.count(),
        'guest_checkin_sent': guest_checkin_count,
        'staff_checkin_sent': staff_checkin_count,
        'guest_checkout_sent': guest_checkout_count,
        'staff_checkout_sent': staff_checkout_count,
        'total_notifications_created': len(new_notifications)
    }


def send_single_booking_reminder(booking_id, reminder_type='auto', notify_guest=True, notify_staff=False):
    """
    Gửi thông báo nhắc nhở tức thì cho một đơn đặt phòng cụ thể (dành cho Lễ tân chủ động gửi).
    """
    try:
        booking = Booking.objects.select_related('guest', 'category', 'room').get(id=booking_id)
    except Booking.DoesNotExist:
        return {'success': False, 'message': 'Không tìm thấy đơn đặt phòng'}

    today = timezone.localdate()
    guest = booking.guest
    guest_name = guest.get_full_name() or guest.username if guest else "Quý khách"
    category_name = booking.category.name if booking.category else "Tiêu chuẩn"
    room_label = f"Phòng {booking.room.room_number}" if booking.room else "Chờ gán số phòng"
    date_str = today.strftime('%d/%m/%Y')

    # Xác định loại nhắc nhở
    if reminder_type == 'auto':
        if booking.status in ['pending', 'confirmed']:
            reminder_type = 'check_in'
        elif booking.status == 'checked_in':
            reminder_type = 'check_out'
        else:
            reminder_type = 'check_in'

    created_count = 0

    if reminder_type == 'check_in':
        if notify_guest and guest:
            Notification.objects.create(
                recipient=guest,
                title="🔔 Nhắc nhở Check-in: Kỳ nghỉ của quý khách bắt đầu hôm nay!",
                message=(
                    f"Khách sạn TA Đà Nẵng xin chào quý khách {guest_name}! Hôm nay ({date_str}) là ngày nhận phòng của quý khách "
                    f"(Mã đơn: #{booking.booking_code}, Hạng phòng: {category_name}). "
                    f"Giờ nhận phòng tiêu chuẩn bắt đầu từ 14:00. Quý khách vui lòng chuẩn bị CCCD/Hộ chiếu khi đến quầy Lễ tân để làm thủ tục nhận phòng. "
                    f"Khách sạn rất hân hạnh được đón tiếp và phục vụ quý khách!"
                )
            )
            created_count += 1

        if notify_staff:
            staff_users = get_staff_and_admin_users(exclude_user_id=guest.id if guest else None)
            staff_notifs = [
                Notification(
                    recipient=staff,
                    title=f"📥 Lịch Check-in hôm nay: Khách {guest_name} (#{booking.booking_code})",
                    message=(
                        f"Nhắc nhở: Khách {guest_name} (Mã đơn: #{booking.booking_code}, Hạng: {category_name}, Số phòng: {room_label}) "
                        f"có lịch nhận phòng hôm nay ({date_str}). Bộ phận Lễ tân & Buồng phòng lưu ý sẵn sàng đón khách."
                    )
                )
                for staff in staff_users
            ]
            if staff_notifs:
                Notification.objects.bulk_create(staff_notifs)
                created_count += len(staff_notifs)

    elif reminder_type == 'check_out':
        if notify_guest and guest:
            Notification.objects.create(
                recipient=guest,
                title="🔔 Nhắc nhở Check-out: Đến hạn trả phòng hôm nay",
                message=(
                    f"Khách sạn TA Đà Nẵng xin thông báo: Hôm nay ({date_str}) là ngày trả phòng của quý khách "
                    f"({room_label}, Mã đơn: #{booking.booking_code}). "
                    f"Giờ trả phòng tiêu chuẩn là trước 12:00 trưa. Nếu quý khách có nhu cầu gia hạn lưu trú "
                    f"hoặc cần hỗ trợ hành lý, vui lòng liên hệ quầy Lễ tân qua hotline khách sạn!"
                )
            )
            created_count += 1

        if notify_staff:
            staff_users = get_staff_and_admin_users(exclude_user_id=guest.id if guest else None)
            staff_notifs = [
                Notification(
                    recipient=staff,
                    title=f"📤 Lịch Check-out hôm nay: {room_label} - Khách {guest_name}",
                    message=(
                        f"Nhắc nhở: {room_label} (Khách hàng: {guest_name}, Mã đơn: #{booking.booking_code}) "
                        f"có lịch trả phòng hôm nay ({date_str}, trước 12:00). Bộ phận Lễ tân rà soát dịch vụ và thông báo Buồng phòng sẵn sàng."
                    )
                )
                for staff in staff_users
            ]
            if staff_notifs:
                Notification.objects.bulk_create(staff_notifs)
                created_count += len(staff_notifs)

    return {
        'success': True,
        'message': f"Đã gửi thông báo nhắc nhở thành công ({created_count} thông báo)",
        'created_count': created_count
    }


def run_daily_reminders_if_needed():
    """
    Kiểm tra và kích hoạt thông báo tự động (chạy tối đa 1 lần mỗi 15 phút để đảm bảo hiệu năng).
    Hàm này được gọi ngầm khi người dùng truy cập hoặc polling thông báo.
    """
    global _LAST_REMINDER_CHECK
    now = timezone.now()

    # Nếu đã chạy trong vòng 15 phút qua thì bỏ qua
    if _LAST_REMINDER_CHECK and (now - _LAST_REMINDER_CHECK).total_seconds() < 900:
        return None

    _LAST_REMINDER_CHECK = now
    try:
        return send_checkin_checkout_reminders()
    except Exception as e:
        logger.error(f"Lỗi khi tự động gửi nhắc nhở checkin/checkout: {e}")
        return None
