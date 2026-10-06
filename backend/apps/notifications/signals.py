import logging
from django.db import models
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

from ..bookings.models import Booking
from ..services.models import ServiceRequest
from .models import Notification

logger = logging.getLogger(__name__)
User = get_user_model()


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


# ==============================================================================
# 1. SIGNAL CHO BOOKING: THEO DÕI TẠO MỚI & THAY ĐỔI TRẠNG THÁI (CHECK-IN, CHECK-OUT...)
# ==============================================================================
@receiver(pre_save, sender=Booking)
def track_booking_previous_status(sender, instance, **kwargs):
    """
    Lưu lại status cũ trước khi lưu để phát hiện thay đổi trạng thái Check-in, Check-out...
    """
    if instance.pk:
        try:
            old_obj = Booking.objects.get(pk=instance.pk)
            instance._previous_status = old_obj.status
        except Booking.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_save, sender=Booking)
def notify_on_booking_events(sender, instance, created, **kwargs):
    """
    Xử lý thông báo cho Đơn Đặt Phòng (Booking):
    1. Khi đơn được tạo mới: Báo Khách ("Đặt phòng thành công") & Báo Admin ("Có đơn mới")
    2. Khi đơn đổi status sang checked_in: Báo Khách ("Check-in thành công") & Báo Lễ tân
    3. Khi đơn đổi status sang checked_out: Báo Khách & Báo Lễ tân / Buồng phòng
    4. Khi đơn đổi sang no_show: Báo Admin / Lễ tân
    """
    try:
        room_label = (instance.room.room_number if instance.room else None) or \
                     (instance.category.name if instance.category else "Chưa gán phòng")
        room_desc = f" ({instance.category.name})" if instance.category else ""
        checkin_str = instance.check_in_date.strftime('%d/%m/%Y') if instance.check_in_date else ''
        checkout_str = instance.check_out_date.strftime('%d/%m/%Y') if instance.check_out_date else ''
        time_desc = f" từ ngày {checkin_str} đến ngày {checkout_str}" if checkin_str and checkout_str else ""
        guest_name = instance.guest.get_full_name() or instance.guest.username if instance.guest else "Khách hàng"

        # ----------------------------------------------------------------------
        # TRƯỜNG HỢP 1: ĐƠN ĐẶT PHÒNG TẠO MỚI (created == True)
        # ----------------------------------------------------------------------
        if created:
            # 1. Thông báo cho Khách hàng
            if instance.guest:
                Notification.objects.create(
                    recipient=instance.guest,
                    title="Đặt phòng thành công!",
                    message=(
                        f"Đơn đặt phòng #{instance.booking_code}{room_desc}{time_desc} "
                        f"đã được gửi thành công. Khách sạn TA Đà Nẵng rất hân hạnh được đón tiếp và phục vụ quý khách."
                    )
                )

            # 2. Thông báo cho Quản lý / Lễ tân / Nhân sự
            staff_users = get_staff_and_admin_users(exclude_user_id=instance.guest_id if instance.guest else None)
            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=f"Có đơn đặt phòng mới: #{instance.booking_code}",
                    message=(
                        f"Khách hàng {guest_name} vừa tạo đơn đặt phòng #{instance.booking_code}{room_desc}{time_desc}. "
                        f"Vui lòng kiểm tra và duyệt đơn."
                    )
                )
                for staff in staff_users
            ]
            if staff_notifications:
                Notification.objects.bulk_create(staff_notifications)
            return

        # ----------------------------------------------------------------------
        # TRƯỜNG HỢP 2: ĐƠN ĐẶT PHÒNG CẬP NHẬT TRẠNG THÁI (Check-in, Check-out...)
        # ----------------------------------------------------------------------
        prev_status = getattr(instance, '_previous_status', None)
        if prev_status == instance.status:
            return

        # 2.0. ĐƠN ĐẶT PHÒNG ĐƯỢC DUYỆT / XÁC NHẬN (status đổi sang 'confirmed')
        if instance.status == 'confirmed' and prev_status != 'confirmed':
            # 1. Thông báo cho Khách hàng
            if instance.guest:
                Notification.objects.create(
                    recipient=instance.guest,
                    title="🎉 Đơn đặt phòng đã được xác nhận!",
                    message=(
                        f"Khách sạn TA Đà Nẵng xin thông báo: Đơn đặt phòng #{instance.booking_code}{room_desc}{time_desc} "
                        f"của quý khách đã được phê duyệt và xác nhận thành công. "
                        f"Khách sạn đã sẵn sàng đón tiếp quý khách vào ngày nhận phòng!"
                    )
                )

            # 2. Thông báo cho Quản lý & Lễ tân
            staff_users = get_staff_and_admin_users(exclude_user_id=instance.guest_id if instance.guest else None)
            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=f"✅ Đơn đặt phòng đã duyệt: #{instance.booking_code}",
                    message=(
                        f"Đơn đặt phòng #{instance.booking_code} của khách {guest_name}{room_desc}{time_desc} "
                        f"đã được duyệt sang trạng thái Đã xác nhận."
                    )
                )
                for staff in staff_users
            ]
            if staff_notifications:
                Notification.objects.bulk_create(staff_notifications)

        # 2.1. Khách CHECK-IN thành công (status đổi sang 'checked_in')
        elif instance.status == 'checked_in' and prev_status != 'checked_in':
            # 1. Thông báo cho Khách hàng
            if instance.guest:
                room_display = f"Phòng {instance.room.room_number}" if instance.room else room_label
                Notification.objects.create(
                    recipient=instance.guest,
                    title="🔑 Check-in thành công! Chào mừng quý khách",
                    message=(
                        f"Quý khách đã hoàn tất thủ tục nhận {room_display} thành công (Mã đơn: #{instance.booking_code}). "
                        f"Khách sạn TA Đà Nẵng chúc quý khách có một kỳ nghỉ dưỡng tuyệt vời và trọn vẹn!"
                    )
                )

            # 2. Thông báo cho Quản lý & Lễ tân
            staff_users = get_staff_and_admin_users(exclude_user_id=instance.guest_id if instance.guest else None)
            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=f"📥 Khách đã Check-in: {room_label}",
                    message=(
                        f"Khách hàng {guest_name} đã hoàn tất thủ tục Check-in nhận phòng {room_label} "
                        f"(Mã đơn đặt phòng: #{instance.booking_code})."
                    )
                )
                for staff in staff_users
            ]
            if staff_notifications:
                Notification.objects.bulk_create(staff_notifications)

        # 2.2. Khách CHECK-OUT thành công (status đổi sang 'checked_out' hoặc 'completed')
        elif instance.status in ['checked_out', 'completed'] and prev_status not in ['checked_out', 'completed']:
            # Thông báo cho Khách hàng
            if instance.guest:
                Notification.objects.create(
                    recipient=instance.guest,
                    title="Khách hàng trả phòng thành công!",
                    message=(
                        f"Quý khách đã trả phòng thành công cho {room_label} (Mã đơn: #{instance.booking_code}). "
                        f"Quý khách có thể đánh giá phòng và dịch vụ khách sạn để chia sẻ trải nghiệm kỳ nghỉ của mình nhé!"
                    )
                )

            # Thông báo cho Quản lý, Lễ tân & Buồng phòng
            staff_users = get_staff_and_admin_users(exclude_user_id=instance.guest_id if instance.guest else None)
            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=f"Khách đã Check-out: Phòng {room_label}",
                    message=(
                        f"Khách hàng {guest_name} đã làm thủ tục trả phòng {room_label} (Mã đơn: #{instance.booking_code}). "
                        f"Bộ phận buồng phòng chuẩn bị kiểm tra và làm sạch phòng."
                    )
                )
                for staff in staff_users
            ]
            if staff_notifications:
                Notification.objects.bulk_create(staff_notifications)

        # 2.3. Đánh dấu NO-SHOW (status đổi sang 'no_show')
        elif instance.status == 'no_show':
            staff_users = get_staff_and_admin_users(exclude_user_id=instance.guest_id if instance.guest else None)
            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=f"Đơn No-show: #{instance.booking_code}",
                    message=(
                        f"Đơn đặt phòng #{instance.booking_code} của khách {guest_name} đã được đánh dấu No-show. "
                        f"Phòng {room_label} đã được giải phóng về trạng thái Sẵn sàng."
                    )
                )
                for staff in staff_users
            ]
            if staff_notifications:
                Notification.objects.bulk_create(staff_notifications)

        # 2.4. HỦY ĐƠN ĐẶT PHÒNG (status đổi sang 'cancelled')
        elif instance.status == 'cancelled' and prev_status != 'cancelled':
            # Thông báo cho Khách hàng
            if instance.guest:
                Notification.objects.create(
                    recipient=instance.guest,
                    title="Hủy đơn đặt phòng thành công!",
                    message=(
                        f"Đơn đặt phòng #{instance.booking_code}{room_desc} đã được hủy thành công. "
                        f"Khách sạn TA Đà Nẵng hy vọng sẽ có cơ hội được đón tiếp quý khách vào dịp lưu trú khác."
                    )
                )

            # Thông báo cho Quản lý & Lễ tân
            staff_users = get_staff_and_admin_users(exclude_user_id=instance.guest_id if instance.guest else None)
            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=f"Đơn đặt phòng đã bị hủy: #{instance.booking_code}",
                    message=(
                        f"Đơn đặt phòng #{instance.booking_code} của khách {guest_name}{room_desc} đã được hủy. "
                        f"Phòng và lịch lưu trú đã được giải phóng trên hệ thống."
                    )
                )
                for staff in staff_users
            ]
            if staff_notifications:
                Notification.objects.bulk_create(staff_notifications)

    except Exception as e:
        logger.error(f"Lỗi khi xử lý thông báo cho Booking #{getattr(instance, 'booking_code', 'N/A')}: {e}")


# ==============================================================================
# 2. SIGNAL CHO SERVICEREQUEST: ĐẶT DỊCH VỤ MỚI & THAY ĐỔI STATUS
# ==============================================================================
@receiver(pre_save, sender=ServiceRequest)
def track_service_request_previous_status(sender, instance, **kwargs):
    """
    Lưu lại status cũ trước khi lưu để phát hiện thay đổi trạng thái
    """
    if instance.pk:
        try:
            old_obj = ServiceRequest.objects.get(pk=instance.pk)
            instance._previous_status = old_obj.status
        except ServiceRequest.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_save, sender=ServiceRequest)
def notify_on_service_request_events(sender, instance, created, **kwargs):
    """
    Xử lý thông báo cho Phiếu Yêu Cầu Dịch Vụ (ServiceRequest):
    1. Khi khách ĐẶT DỊCH VỤ MỚI (created == True): Báo Admin / Lễ tân & Báo Khách ("Đã nhận yêu cầu")
    2. Khi đổi sang in_progress: Báo Khách ("Dịch vụ đang được chuẩn bị")
    3. Khi đổi sang completed: Báo Khách ("Dịch vụ đã sẵn sàng/đang giao") & Báo Lễ tân ("Dịch vụ phòng X đã xong")
    """
    try:
        booking = instance.booking
        guest = booking.guest if booking else None
        guest_name = guest.get_full_name() or guest.username if guest else "Khách hàng"
        room_label = (booking.room.room_number if booking and booking.room else None) or \
                     (booking.category.name if booking and booking.category else "Chưa xếp phòng")
        service_name = instance.service.name if instance.service else "Dịch vụ"

        # ----------------------------------------------------------------------
        # TRƯỜNG HỢP 1: KHÁCH ĐẶT DỊCH VỤ MỚI (created == True)
        # ----------------------------------------------------------------------
        if created:
            # 1. Báo cho Quản lý & Lễ tân / Nhân viên phục vụ
            staff_users = get_staff_and_admin_users(exclude_user_id=guest.id if guest else None)
            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=f"Yêu cầu dịch vụ mới: Phòng {room_label}",
                    message=(
                        f"Phòng {room_label} (Khách: {guest_name}) vừa đặt dịch vụ: \"{service_name}\" "
                        f"(Số lượng: {instance.quantity}, Mã đơn: #{booking.booking_code if booking else 'N/A'}). "
                        f"Vui lòng tiếp nhận và xử lý."
                    )
                )
                for staff in staff_users
            ]
            if staff_notifications:
                Notification.objects.bulk_create(staff_notifications)

            # 2. Báo cho Khách hàng
            if guest:
                Notification.objects.create(
                    recipient=guest,
                    title="Đã tiếp nhận yêu cầu dịch vụ",
                    message=(
                        f"Yêu cầu dịch vụ \"{service_name}\" (Số lượng: {instance.quantity}) cho phòng {room_label} "
                        f"của quý khách đã được chuyển tới bộ phận phục vụ. Chúng tôi sẽ chuẩn bị ngay!"
                    )
                )
            return

        # ----------------------------------------------------------------------
        # TRƯỜNG HỢP 2: THAY ĐỔI TRẠNG THÁI TIẾN ĐỘ DỊCH VỤ
        # ----------------------------------------------------------------------
        prev_status = getattr(instance, '_previous_status', None)
        if prev_status == instance.status:
            return

        if instance.status == 'in_progress':
            # Thông báo cho khách hàng
            if guest:
                Notification.objects.create(
                    recipient=guest,
                    title="Dịch vụ đang được chuẩn bị",
                    message=(
                        f"Yêu cầu dịch vụ \"{service_name}\" (Số lượng: {instance.quantity}) cho phòng {room_label} "
                        f"đang được nhân viên bộ phận chuẩn bị và thực hiện."
                    )
                )

        elif instance.status == 'completed':
            # 1. Báo cho khách hàng
            if guest:
                Notification.objects.create(
                    recipient=guest,
                    title="Dịch vụ đã sẵn sàng / Đang giao",
                    message=(
                        f"Dịch vụ \"{service_name}\" cho phòng {room_label} đã được hoàn tất / đang trên đường giao tới quý khách. "
                        f"Chúc quý khách trải nghiệm dịch vụ trọn vẹn!"
                    )
                )

            # 2. Báo cho Quản trị viên / Lễ tân
            staff_users = get_staff_and_admin_users(exclude_user_id=guest.id if guest else None)
            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=f"Dịch vụ phòng {room_label} đã xong",
                    message=(
                        f"Yêu cầu dịch vụ \"{service_name}\" (Đơn đặt phòng #{booking.booking_code if booking else 'N/A'}) "
                        f"tại phòng {room_label} đã được hoàn thành."
                    )
                )
                for staff in staff_users
            ]
            if staff_notifications:
                Notification.objects.bulk_create(staff_notifications)

    except Exception as e:
        logger.error(f"Lỗi khi tạo thông báo cho ServiceRequest #{getattr(instance, 'pk', 'N/A')}: {e}")
