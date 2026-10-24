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


def get_staff_and_admin_users(exclude_user_id=None, purpose='general'):
    """
    Lấy danh sách các tài khoản Nhân viên, Lễ tân và Quản trị viên để gửi thông báo định kỳ:
    - purpose='checkin_reminder': Lễ tân, Admin và Buồng phòng (để sẵn sàng phòng).
    - purpose='checkout_reminder': Lễ tân, Admin, Buồng phòng (để dọn phòng) và Thu ngân (để chốt bill/minibar).
    - purpose='general': Toàn bộ ban quản trị, lễ tân và buồng phòng.
    """
    if purpose == 'checkin_reminder':
        target_roles = ['admin', 'receptionist', 'housekeeper']
    elif purpose == 'checkout_reminder':
        target_roles = ['admin', 'receptionist', 'housekeeper', 'cashier']
    else:
        target_roles = ['admin', 'owner', 'manager', 'receptionist', 'housekeeper']

    qs = User.objects.filter(
        models.Q(is_superuser=True) |
        models.Q(role__in=target_roles)
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
    checkin_staff_users = list(get_staff_and_admin_users(purpose='checkin_reminder'))
    checkout_staff_users = list(get_staff_and_admin_users(purpose='checkout_reminder'))

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

        # 1.1. Thông báo cho Khách hàng (chỉ gửi cho tài khoản Khách hàng / Guest thực thụ)
        is_client_guest = guest and getattr(guest, 'role', '') == 'guest' and not guest.is_staff and not guest.is_superuser
        if is_client_guest:
            new_notifications.append(
                Notification(
                    recipient=guest,
                    title="🔔 Nhắc nhở Check-in: Kỳ nghỉ của quý khách bắt đầu hôm nay!",
                    message=(
                        f"Khách sạn TA Đà Nẵng xin chào quý khách {guest_name}! Hôm nay ({date_str}) là ngày nhận phòng của quý khách "
                        f"(Mã đơn: #{booking.booking_code}, Hạng phòng: {category_name}). "
                        f"Giờ nhận phòng tiêu chuẩn bắt đầu từ 14:00. Quý khách vui lòng chuẩn bị CCCD/Hộ chiếu khi đến quầy Lễ tân để hoàn tất thủ tục nhận phòng. "
                        f"Khách sạn rất hân hạnh được đón tiếp và phục vụ quý khách!"
                    ),
                    notification_type='booking',
                    action_url="/booking-history",
                    priority='high'
                )
            )
            guest_checkin_count += 1

        # 1.2. Thông báo cho Nhân viên & Quản lý
        for staff in checkin_staff_users:
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
                    ),
                    notification_type='room' if getattr(staff, 'role', '') == 'housekeeper' else 'booking',
                    action_url='/admin/rooms' if getattr(staff, 'role', '') == 'housekeeper' else '/admin/bookings',
                    priority='normal'
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

        # 2.1. Thông báo cho Khách hàng (chỉ gửi cho tài khoản Khách hàng / Guest thực thụ)
        is_client_guest = guest and getattr(guest, 'role', '') == 'guest' and not guest.is_staff and not guest.is_superuser
        if is_client_guest:
            new_notifications.append(
                Notification(
                    recipient=guest,
                    title="🔔 Nhắc nhở Check-out: Đến hạn trả phòng hôm nay",
                    message=(
                        f"Khách sạn TA Đà Nẵng xin thông báo: Hôm nay ({date_str}) là ngày trả phòng của quý khách "
                        f"({room_label}, Mã đơn: #{booking.booking_code}). "
                        f"Giờ trả phòng tiêu chuẩn là trước 12:00 trưa. Nếu quý khách có nhu cầu gia hạn thời gian lưu trú "
                        f"hoặc cần hỗ trợ hành lý, xe đưa đón sân bay, vui lòng liên hệ quầy Lễ tân qua hotline khách sạn để được phục vụ tốt nhất!"
                    ),
                    notification_type='booking',
                    action_url="/booking-history",
                    priority='high'
                )
            )
            guest_checkout_count += 1

        # 2.2. Thông báo cho Nhân viên & Quản lý
        for staff in checkout_staff_users:
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
                    ),
                    notification_type='room' if getattr(staff, 'role', '') == 'housekeeper' else 'booking',
                    action_url='/admin/rooms' if getattr(staff, 'role', '') == 'housekeeper' else '/admin/bookings',
                    priority='normal'
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

    is_client_guest = guest and getattr(guest, 'role', '') == 'guest' and not guest.is_staff and not guest.is_superuser

    if reminder_type == 'check_in':
        if notify_guest and is_client_guest:
            Notification.objects.create(
                recipient=guest,
                title="🔔 Nhắc nhở Check-in: Kỳ nghỉ của quý khách bắt đầu hôm nay!",
                message=(
                    f"Khách sạn TA Đà Nẵng xin chào quý khách {guest_name}! Hôm nay ({date_str}) là ngày nhận phòng của quý khách "
                    f"(Mã đơn: #{booking.booking_code}, Hạng phòng: {category_name}). "
                    f"Giờ nhận phòng tiêu chuẩn bắt đầu từ 14:00. Quý khách vui lòng chuẩn bị CCCD/Hộ chiếu khi đến quầy Lễ tân để làm thủ tục nhận phòng. "
                    f"Khách sạn rất hân hạnh được đón tiếp và phục vụ quý khách!"
                ),
                notification_type='booking',
                action_url="/booking-history",
                priority='high'
            )
            created_count += 1

        if notify_staff:
            staff_users = get_staff_and_admin_users(exclude_user_id=guest.id if guest else None, purpose='checkin_reminder')
            staff_notifs = [
                Notification(
                    recipient=staff,
                    title=f"📥 Lịch Check-in hôm nay: Khách {guest_name} (#{booking.booking_code})",
                    message=(
                        f"Nhắc nhở: Khách {guest_name} (Mã đơn: #{booking.booking_code}, Hạng: {category_name}, Số phòng: {room_label}) "
                        f"có lịch nhận phòng hôm nay ({date_str}). Bộ phận Lễ tân & Buồng phòng lưu ý sẵn sàng đón khách."
                    ),
                    notification_type='room' if getattr(staff, 'role', '') == 'housekeeper' else 'booking',
                    action_url='/admin/rooms' if getattr(staff, 'role', '') == 'housekeeper' else '/admin/bookings',
                    priority='normal'
                )
                for staff in staff_users
            ]
            if staff_notifs:
                Notification.objects.bulk_create(staff_notifs)
                created_count += len(staff_notifs)

    elif reminder_type == 'check_out':
        if notify_guest and is_client_guest:
            Notification.objects.create(
                recipient=guest,
                title="🔔 Nhắc nhở Check-out: Đến hạn trả phòng hôm nay",
                message=(
                    f"Khách sạn TA Đà Nẵng xin thông báo: Hôm nay ({date_str}) là ngày trả phòng của quý khách "
                    f"({room_label}, Mã đơn: #{booking.booking_code}). "
                    f"Giờ trả phòng tiêu chuẩn là trước 12:00 trưa. Nếu quý khách có nhu cầu gia hạn lưu trú "
                    f"hoặc cần hỗ trợ hành lý, vui lòng liên hệ quầy Lễ tân qua hotline khách sạn!"
                ),
                notification_type='booking',
                action_url="/booking-history",
                priority='high'
            )
            created_count += 1

        if notify_staff:
            staff_users = get_staff_and_admin_users(exclude_user_id=guest.id if guest else None, purpose='checkout_reminder')
            staff_notifs = [
                Notification(
                    recipient=staff,
                    title=f"📤 Lịch Check-out hôm nay: {room_label} - Khách {guest_name}",
                    message=(
                        f"Nhắc nhở: {room_label} (Khách hàng: {guest_name}, Mã đơn: #{booking.booking_code}) "
                        f"có lịch trả phòng hôm nay ({date_str}, trước 12:00). Bộ phận Lễ tân rà soát dịch vụ và thông báo Buồng phòng sẵn sàng."
                    ),
                    notification_type='room' if getattr(staff, 'role', '') == 'housekeeper' else 'booking',
                    action_url='/admin/rooms' if getattr(staff, 'role', '') == 'housekeeper' else '/admin/bookings',
                    priority='normal'
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


def send_group_booking_notification(group_booking, event_type, actor=None, extra_data=None):
    """
    Xử lý thông báo In-App tập trung cho Đơn Đặt Đoàn Doanh Nghiệp (Group Booking / M.I.C.E):
    Hỗ trợ các sự kiện:
    - 'created': Khi đoàn mới được tạo
    - 'deposit_confirmed': Khi xác nhận tiền cọc thành công
    - 'check_in': Khi Check-in đồng loạt toàn đoàn (1 thông báo gom, không spam phòng con)
    - 'check_out': Khi Check-out đồng loạt toàn đoàn & Quyết toán Master Invoice
    """
    try:
        from ..bookings.models import GroupBooking
        if not isinstance(group_booking, GroupBooking):
            group_booking = GroupBooking.objects.filter(pk=group_booking).first()
        if not group_booking:
            return None

        extra_data = extra_data or {}
        new_notifications = []

        # 1. Tìm tài khoản User của Trưởng đoàn / Khách đại diện (CHỈ áp dụng cho Khách hàng / Guest thực thụ, KHÔNG gán Nhân viên)
        def is_client_user(u):
            return bool(u and getattr(u, 'role', '') == 'guest' and not u.is_staff and not u.is_superuser)

        leader_user = None
        if hasattr(group_booking, 'sub_bookings') and group_booking.sub_bookings.exists():
            first_sub = group_booking.sub_bookings.first()
            if first_sub and is_client_user(first_sub.guest):
                leader_user = first_sub.guest

        if not leader_user and group_booking.leader_email:
            matched = User.objects.filter(
                email__iexact=group_booking.leader_email,
                role='guest',
                is_staff=False,
                is_superuser=False
            ).first()
            if matched:
                leader_user = matched

        if not leader_user and group_booking.leader_phone:
            clean_p = ''.join(c for c in str(group_booking.leader_phone) if c.isdigit())
            matched = User.objects.filter(
                phone_number=group_booking.leader_phone,
                role='guest',
                is_staff=False,
                is_superuser=False
            ).first()
            if not matched and clean_p:
                matched = User.objects.filter(
                    phone_number=clean_p,
                    role='guest',
                    is_staff=False,
                    is_superuser=False
                ).first()
            if matched:
                leader_user = matched

        if leader_user and not is_client_user(leader_user):
            leader_user = None

        total_rooms = group_booking.sub_bookings.count()
        total_amount = float(group_booking.total_amount or 0)
        deposit_amount = float(group_booking.deposit_amount or 0)
        corp_name = group_booking.corporate_partner.company_name if group_booking.corporate_partner else None
        comp_display = f" ({corp_name})" if corp_name else ""

        # ==============================================================================
        # SỰ KIỆN 1: ĐOÀN ĐƯỢC TẠO MỚI ('created')
        # ==============================================================================
        if event_type == 'created':
            # 1.1. Thông báo cho Trưởng đoàn
            if leader_user:
                new_notifications.append(
                    Notification(
                        recipient=leader_user,
                        title=f"📋 Đã tiếp nhận yêu cầu đặt đoàn #{group_booking.group_code}",
                        message=(
                            f"Yêu cầu đặt đoàn cho '{group_booking.group_name}'{comp_display} ({total_rooms} phòng) "
                            f"từ {group_booking.check_in_date.strftime('%d/%m/%Y')} đến {group_booking.check_out_date.strftime('%d/%m/%Y')} "
                            f"đã được tiếp nhận. Tổng chi phí dự kiến: {total_amount:,.0f}đ (Tiền cọc: {deposit_amount:,.0f}đ). "
                            f"Khách sạn TA sẽ sớm liên hệ xác nhận và hướng dẫn hoàn tất thủ tục!"
                        ),
                        notification_type='group_booking',
                        action_url="/booking-history",
                        priority='normal'
                    )
                )

            # 1.2. Thông báo cho Lễ tân, Quản lý & Kinh doanh
            staff_users = get_staff_and_admin_users(exclude_user_id=leader_user.id if leader_user else None)
            for staff in staff_users:
                new_notifications.append(
                    Notification(
                        recipient=staff,
                        title=f"🏢 Đơn đặt đoàn mới: {group_booking.group_name} (#{group_booking.group_code})",
                        message=(
                            f"Đơn đặt đoàn '{group_booking.group_name}'{comp_display} vừa được tạo "
                            f"với quy mô {total_rooms} phòng (Tổng tiền: {total_amount:,.0f}đ, Cọc: {deposit_amount:,.0f}đ). "
                            f"Đại diện liên hệ: {group_booking.leader_name} ({group_booking.leader_phone}). "
                            f"Lễ tân/Kinh doanh vui lòng rà soát quỹ phòng và liên hệ khách."
                        ),
                        notification_type='group_booking',
                        action_url="/admin/bookings",
                        priority='high'
                    )
                )

        # ==============================================================================
        # SỰ KIỆN 2: XÁC NHẬN ĐẶT CỌC THÀNH CÔNG ('deposit_confirmed')
        # ==============================================================================
        elif event_type == 'deposit_confirmed':
            # 2.1. Thông báo cho Trưởng đoàn
            if leader_user:
                new_notifications.append(
                    Notification(
                        recipient=leader_user,
                        title=f"🎉 Xác nhận cọc thành công: Đoàn #{group_booking.group_code}",
                        message=(
                            f"Khách sạn TA đã nhận đủ số tiền cọc {deposit_amount:,.0f}đ cho đoàn '{group_booking.group_name}'. "
                            f"Quỹ phòng của quý khách đã được đảm bảo giữ chỗ thành công. "
                            f"Quý khách vui lòng hoàn thiện danh sách phân phòng (Rooming List) trước ngày nhận phòng."
                        ),
                        notification_type='group_booking',
                        action_url="/booking-history",
                        priority='high'
                    )
                )

            # 2.2. Thông báo cho Thu ngân, Lễ tân & Quản lý
            staff_users = User.objects.filter(
                models.Q(is_staff=True) | models.Q(is_superuser=True) |
                models.Q(role__in=['admin', 'owner', 'manager', 'receptionist', 'cashier'])
            )
            if leader_user:
                staff_users = staff_users.exclude(id=leader_user.id)
            staff_users = staff_users.distinct()
            for staff in staff_users:
                new_notifications.append(
                    Notification(
                        recipient=staff,
                        title=f"💰 Đã nhận cọc đoàn #{group_booking.group_code}: {deposit_amount:,.0f}đ",
                        message=(
                            f"Đã xác nhận thanh toán tiền cọc {deposit_amount:,.0f}đ cho đoàn '{group_booking.group_name}'{comp_display}. "
                            f"Trạng thái đoàn đã chuyển sang 'Đã xác nhận'. Quỹ phòng đã được khóa."
                        ),
                        notification_type='payment',
                        action_url="/admin/bookings",
                        priority='normal'
                    )
                )

        # ==============================================================================
        # SỰ KIỆN 3: CHECK-IN ĐỒNG LOẠT TOÀN ĐOÀN ('check_in')
        # ==============================================================================
        elif event_type == 'check_in':
            checked_in_count = extra_data.get('checked_in_count', total_rooms)
            # 3.1. Thông báo cho Trưởng đoàn
            if leader_user:
                new_notifications.append(
                    Notification(
                        recipient=leader_user,
                        title=f"🔑 Chào mừng đoàn {group_booking.group_name} đến với TA Hotel!",
                        message=(
                            f"Đã hoàn tất thủ tục nhận phòng đồng loạt cho {checked_in_count} phòng của đoàn '{group_booking.group_name}'. "
                            f"Thẻ phòng đã được bàn giao cho trưởng đoàn. Khách sạn TA Đà Nẵng chúc quý đoàn có kỳ nghỉ và chuyến công tác tuyệt vời!"
                        ),
                        notification_type='group_booking',
                        action_url="/booking-history",
                        priority='high'
                    )
                )

            # 3.2. Thông báo cho Lễ tân, Buồng phòng & F&B
            staff_users = User.objects.filter(
                models.Q(is_staff=True) | models.Q(is_superuser=True) |
                models.Q(role__in=['admin', 'manager', 'receptionist', 'housekeeper', 'service_staff'])
            )
            if leader_user:
                staff_users = staff_users.exclude(id=leader_user.id)
            staff_users = staff_users.distinct()
            for staff in staff_users:
                new_notifications.append(
                    Notification(
                        recipient=staff,
                        title=f"📥 Đoàn {group_booking.group_name} ({checked_in_count} phòng) đã Check-in",
                        message=(
                            f"Đoàn '{group_booking.group_name}'{comp_display} gồm {checked_in_count} phòng đã hoàn tất Check-in. "
                            f"Bộ phận Lễ tân, Buồng phòng và F&B lưu ý phục vụ các dịch vụ kèm theo theo thỏa thuận hợp đồng."
                        ),
                        notification_type='group_booking',
                        action_url="/admin/bookings",
                        priority='normal'
                    )
                )

        # ==============================================================================
        # SỰ KIỆN 4: CHECK-OUT ĐỒNG LOẠT & QUYẾT TOÁN MASTER INVOICE ('check_out')
        # ==============================================================================
        elif event_type == 'check_out':
            checked_out_count = extra_data.get('checked_out_count', total_rooms)
            contract_total = extra_data.get('total_contract', total_amount)
            # 4.1. Thông báo cho Trưởng đoàn
            if leader_user:
                new_notifications.append(
                    Notification(
                        recipient=leader_user,
                        title=f"✨ Cảm ơn Quý đoàn {group_booking.group_name} đã lưu trú!",
                        message=(
                            f"Đoàn '{group_booking.group_name}' ({checked_out_count} phòng) đã làm thủ tục trả phòng thành công. "
                            f"Hóa đơn thanh toán Master Invoice đã được xuất và gửi tới email đại diện. "
                            f"Khách sạn rất hân hạnh được đồng hành và phục vụ quý công ty!"
                        ),
                        notification_type='group_booking',
                        action_url="/booking-history",
                        priority='normal'
                    )
                )

            # 4.2. Thông báo cho Thu ngân & Kế toán (theo dõi công nợ B2B)
            finance_users = User.objects.filter(
                models.Q(is_staff=True) | models.Q(is_superuser=True) |
                models.Q(role__in=['admin', 'owner', 'manager', 'cashier'])
            )
            if leader_user:
                finance_users = finance_users.exclude(id=leader_user.id)
            finance_users = finance_users.distinct()
            for staff in finance_users:
                new_notifications.append(
                    Notification(
                        recipient=staff,
                        title=f"📑 Quyết toán đoàn #{group_booking.group_code} ({contract_total:,.0f}đ)",
                        message=(
                            f"Đoàn '{group_booking.group_name}'{comp_display} đã hoàn tất Check-out ({checked_out_count} phòng). "
                            f"Hóa đơn tổng Master Invoice giá trị {contract_total:,.0f}đ đã được tạo. "
                            f"Kế toán lưu ý theo dõi công nợ đối tác theo thời hạn hợp đồng."
                        ),
                        notification_type='payment',
                        action_url="/admin/finance",
                        priority='high'
                    )
                )

            # 4.3. Thông báo cho Buồng phòng (dọn dẹp đồng loạt các phòng)
            housekeeping_users = User.objects.filter(
                models.Q(is_staff=True) | models.Q(is_superuser=True) |
                models.Q(role__in=['admin', 'manager', 'housekeeper'])
            ).distinct()
            for staff in housekeeping_users:
                new_notifications.append(
                    Notification(
                        recipient=staff,
                        title=f"🧹 Đoàn {group_booking.group_name} đã Check-out ({checked_out_count} phòng)",
                        message=(
                            f"Đoàn '{group_booking.group_name}' vừa trả phòng. "
                            f"Toàn bộ {checked_out_count} phòng của đoàn đã chuyển sang trạng thái Đang dọn dẹp (Cleaning). "
                            f"Bộ phận Buồng phòng vui lòng phân công nhân sự dọn phòng."
                        ),
                        notification_type='room',
                        action_url="/admin/rooms",
                        priority='high'
                    )
                )

        # Lưu thông báo vào database
        if new_notifications:
            Notification.objects.bulk_create(new_notifications)
            logger.info(f"[GROUP_NOTIF] Đã tạo {len(new_notifications)} thông báo cho sự kiện '{event_type}' đoàn #{group_booking.group_code}")
            return len(new_notifications)

        return 0
    except Exception as e:
        logger.error(f"[GROUP_NOTIF] Lỗi khi tạo thông báo đoàn #{getattr(group_booking, 'group_code', 'N/A')}: {e}", exc_info=True)
        return None
