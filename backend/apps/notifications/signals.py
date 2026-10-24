import logging
from django.db import models
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

from ..bookings.models import Booking
from ..services.models import ServiceRequest
from ..payments.models import Payment, Invoice, CashOutVoucher
from .models import Notification

logger = logging.getLogger(__name__)
User = get_user_model()


def get_staff_and_admin_users(exclude_user_id=None, category_type=None, event_type=None):
    """
    Lấy danh sách các tài khoản Nhân viên, Lễ tân và Quản trị viên theo đúng vai trò nghiệp vụ:
    - event_type:
      * 'booking_manage' (Tạo mới, xác nhận duyệt đơn, hủy đơn, no-show):
          Lễ tân, Quản lý, Chủ khách sạn, Admin. (Loại bỏ Kỹ thuật, Buồng phòng, Phục vụ, Thu ngân để tránh spam)
      * 'booking_checkin':
          Lễ tân, Admin. (Khách check-in phòng lẻ do Lễ tân tiếp đón, không spam Quản lý)
      * 'booking_checkout':
          Lễ tân, Buồng phòng (để chuẩn bị dọn phòng), Admin.
    - category_type (Dịch vụ):
      * 'fnb': Lễ tân và Nhân viên phục vụ ẩm thực (service_staff)
      * 'transport': Lễ tân và Nhân viên phục vụ/điều vận (service_staff)
      * 'spa': Lễ tân, Nhân viên phục vụ (service_staff) và Kỹ thuật viên (technician)
      * 'laundry': Lễ tân, Buồng phòng (housekeeper) và Nhân viên phục vụ (service_staff)
      * 'amenities': Lễ tân, Buồng phòng (housekeeper) và Nhân viên phục vụ (service_staff)
      * 'maintenance': Kỹ thuật viên (technician), Lễ tân, Quản lý, Chủ khách sạn, Admin
    """
    if event_type == 'booking_manage':
        target_roles = ['admin', 'owner', 'manager', 'receptionist']
    elif event_type == 'booking_checkin':
        target_roles = ['admin', 'receptionist']
    elif event_type == 'booking_checkout':
        target_roles = ['admin', 'receptionist', 'housekeeper']
    elif category_type == 'amenities':
        target_roles = ['admin', 'receptionist', 'housekeeper', 'service_staff']
    elif category_type == 'laundry':
        target_roles = ['admin', 'receptionist', 'housekeeper', 'service_staff']
    elif category_type == 'spa':
        target_roles = ['admin', 'receptionist', 'service_staff', 'technician']
    elif category_type in ['fnb', 'transport']:
        target_roles = ['admin', 'receptionist', 'service_staff']
    elif category_type == 'maintenance':
        target_roles = ['admin', 'manager', 'receptionist', 'technician']
    else:
        # Mặc định an toàn cho ban quản trị và lễ tân
        target_roles = ['admin', 'receptionist']

    qs = User.objects.filter(
        models.Q(is_superuser=True) |
        models.Q(role__in=target_roles)
    )
    if exclude_user_id:
        qs = qs.exclude(id=exclude_user_id)
    return qs.distinct()


def get_finance_and_cashier_users(exclude_user_id=None):
    """
    Lấy danh sách các tài khoản phụ trách Tài chính / Thu ngân để gửi thông báo dòng tiền:
    - Thu ngân (cashier)
    - Lễ tân (receptionist)
    - Quản lý (manager)
    - Chủ khách sạn (owner)
    - Admin hệ thống (admin / is_superuser)
    """
    target_roles = ['cashier', 'receptionist', 'manager', 'owner', 'admin']
    qs = User.objects.filter(
        models.Q(is_superuser=True) |
        models.Q(role__in=target_roles)
    )
    if exclude_user_id:
        qs = qs.exclude(id=exclude_user_id)
    return qs.distinct()


def format_payment_method(method_code):
    """
    Chuyển đổi mã phương thức thanh toán sang chuỗi tiếng Việt thân thiện.
    """
    if not method_code:
        return "Chuyển khoản"
    code = str(method_code).strip().upper()
    if code in ['CASH', 'TIỀN MẶT']:
        return "Tiền mặt tại quầy"
    elif code in ['TRANSFER', 'BANK_TRANSFER', 'VIETQR']:
        return "Chuyển khoản VietQR"
    elif code in ['CARD', 'CREDIT_CARD', 'POS']:
        return "Quẹt thẻ POS"
    elif code in ['MOMO', 'ZALOPAY']:
        return "Ví điện tử"
    return method_code


# ==============================================================================
# 1. SIGNAL CHO BOOKING: THEO DÕI TẠO MỚI & THAY ĐỔI TRẠNG THÁI (CHECK-IN, CHECK-OUT...)
# ==============================================================================
@receiver(pre_save, sender=Booking)
def track_booking_previous_status(sender, instance, **kwargs):
    """
    Lưu lại status cũ trước khi lưu để phát hiện thay đổi trạng thái Check-in, Check-out...
    """
    update_fields = kwargs.get('update_fields')
    # Nếu lần lưu này chỉ cập nhật các trường cụ thể mà không cập nhật status,
    # và instance đã có sẵn _previous_status, giữ nguyên _previous_status đó
    if update_fields is not None and 'status' not in update_fields and hasattr(instance, '_previous_status'):
        return

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
        guest_url = "/booking-history"
        staff_url = f"/admin/bookings"

        # Nếu phòng này thuộc Đơn Đặt Đoàn (GroupBooking), bỏ qua thông báo đơn lẻ
        # để tránh spam hàng chục thông báo cho nhân viên. Quy trình đã có send_group_booking_notification gom nhóm!
        if instance.group_booking_id:
            return

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
                    ),
                    notification_type='booking',
                    action_url=guest_url,
                    priority='normal'
                )

            # 2. Thông báo cho Quản lý / Lễ tân / Nhân sự
            staff_users = get_staff_and_admin_users(exclude_user_id=instance.guest_id if instance.guest else None, event_type='booking_manage')
            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=f"Có đơn đặt phòng mới: #{instance.booking_code}",
                    message=(
                        f"Khách hàng {guest_name} vừa tạo đơn đặt phòng #{instance.booking_code}{room_desc}{time_desc}. "
                        f"Vui lòng kiểm tra và duyệt đơn."
                    ),
                    notification_type='booking',
                    action_url=staff_url,
                    priority='high'
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
                    ),
                    notification_type='booking',
                    action_url=guest_url,
                    priority='high'
                )

            # 2. Thông báo cho Quản lý & Lễ tân
            staff_users = get_staff_and_admin_users(exclude_user_id=instance.guest_id if instance.guest else None, event_type='booking_manage')
            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=f"✅ Đơn đặt phòng đã duyệt: #{instance.booking_code}",
                    message=(
                        f"Đơn đặt phòng #{instance.booking_code} của khách {guest_name}{room_desc}{time_desc} "
                        f"đã được duyệt sang trạng thái Đã xác nhận."
                    ),
                    notification_type='booking',
                    action_url=staff_url,
                    priority='normal'
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
                    ),
                    notification_type='booking',
                    action_url=guest_url,
                    priority='high'
                )

            # 2. Thông báo cho Quản lý & Lễ tân
            staff_users = get_staff_and_admin_users(exclude_user_id=instance.guest_id if instance.guest else None, event_type='booking_checkin')
            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=f"📥 Khách đã Check-in: {room_label}",
                    message=(
                        f"Khách hàng {guest_name} đã hoàn tất thủ tục Check-in nhận phòng {room_label} "
                        f"(Mã đơn đặt phòng: #{instance.booking_code})."
                    ),
                    notification_type='booking',
                    action_url=staff_url,
                    priority='normal'
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
                    ),
                    notification_type='booking',
                    action_url=guest_url,
                    priority='normal'
                )

            # Thông báo cho Quản lý, Lễ tân & Buồng phòng
            staff_users = get_staff_and_admin_users(exclude_user_id=instance.guest_id if instance.guest else None, event_type='booking_checkout')
            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=f"Khách đã Check-out: Phòng {room_label}",
                    message=(
                        f"Khách hàng {guest_name} đã làm thủ tục trả phòng {room_label} (Mã đơn: #{instance.booking_code}). "
                        f"Bộ phận buồng phòng chuẩn bị kiểm tra và làm sạch phòng."
                    ),
                    notification_type='room' if getattr(staff, 'role', '') == 'housekeeper' else 'booking',
                    action_url='/admin/rooms' if getattr(staff, 'role', '') == 'housekeeper' else staff_url,
                    priority='normal'
                )
                for staff in staff_users
            ]
            if staff_notifications:
                Notification.objects.bulk_create(staff_notifications)

        # 2.3. Đánh dấu NO-SHOW (status đổi sang 'no_show')
        elif instance.status == 'no_show':
            staff_users = get_staff_and_admin_users(exclude_user_id=instance.guest_id if instance.guest else None, event_type='booking_manage')
            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=f"Đơn No-show: #{instance.booking_code}",
                    message=(
                        f"Đơn đặt phòng #{instance.booking_code} của khách {guest_name} đã được đánh dấu No-show. "
                        f"Phòng {room_label} đã được giải phóng về trạng thái Sẵn sàng."
                    ),
                    notification_type='booking',
                    action_url=staff_url,
                    priority='high'
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
                    ),
                    notification_type='booking',
                    action_url=guest_url,
                    priority='normal'
                )

            # Thông báo cho Quản lý & Lễ tân
            staff_users = get_staff_and_admin_users(exclude_user_id=instance.guest_id if instance.guest else None, event_type='booking_manage')
            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=f"Đơn đặt phòng đã bị hủy: #{instance.booking_code}",
                    message=(
                        f"Đơn đặt phòng #{instance.booking_code} của khách {guest_name}{room_desc} đã được hủy. "
                        f"Phòng và lịch lưu trú đã được giải phóng trên hệ thống."
                    ),
                    notification_type='booking',
                    action_url=staff_url,
                    priority='high'
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
def get_service_category_type(service_name="", category_name=""):
    """
    Phân loại nhóm dịch vụ để tùy biến thông báo chuẩn mực ngành khách sạn:
    1. 'transport': Đưa đón sân bay, xe đưa đón, thuê xe
    2. 'spa': Spa, massage, trị liệu, chăm sóc sức khỏe
    3. 'amenities': Tiện ích & buồng phòng (khăn, gối, giặt ủi...)
    4. 'fnb': Ẩm thực & đồ uống (F&B)
    """
    s_text = (service_name or "").strip().lower()
    c_text = (category_name or "").strip().lower()
    full_text = f"{c_text} {s_text}"

    # Nhóm 1: Vận chuyển / Đưa đón sân bay (Có chữ "Sân bay", "Xe", "Đưa đón")
    if any(k in full_text for k in ['sân bay', 'xe', 'đưa đón', 'transfer', 'airport', 'taxi', 'shuttle', 'đón tiễn']):
        return 'transport'

    # Nhóm 2: Spa / Chăm sóc sức khỏe (Có chữ "Spa", "Massage", "Trị liệu")
    if any(k in full_text for k in ['spa', 'massage', 'trị liệu', 'xông hơi', 'sauna', 'thư giãn', 'wellness', 'chăm sóc da']):
        return 'spa'

    # Nhóm 3: Giặt ủi (Phải kiểm tra theo TÊN DỊCH VỤ vì danh mục chung có thể là "Tiện ích & Giặt ủi")
    if any(k in s_text for k in ['giặt', 'ủi', 'laundry', 'giặt sấy', 'giặt hấp']):
        return 'laundry'

    # Nhóm 4: Ẩm thực / Đồ uống (F&B)
    if any(k in full_text for k in ['ẩm thực', 'đồ ăn', 'món ăn', 'thức ăn', 'bữa ăn', 'ăn uống', 'đồ uống', 'món', 'f&b', 'dining', 'food', 'drink', 'beverage', 'thực đơn', 'bếp', 'nhà hàng', 'bar', 'cà phê', 'coffee', 'trà', 'bánh', 'buffet', 'nước', 'rượu', 'bia', 'hải sản']):
        return 'fnb'

    # Nhóm 5: Tiện ích & buồng phòng (Setup phòng: Gối, khăn, giường phụ, dọn phòng, amenities...)
    return 'amenities'


def get_service_notification_data(service_name, category_name, room_label, status_key, quantity=1, guest_name=""):
    """
    Sinh tiêu đề và nội dung thông báo chuẩn mực theo loại dịch vụ và bước trạng thái
    """
    cat_type = get_service_category_type(service_name, category_name)

    if status_key == 'in_progress':
        # BƯỚC 2: PREPARING (Đang chuẩn bị / Đang chế biến)
        if cat_type == 'fnb':
            guest_title = "👨‍🍳 Bếp đang chế biến món ăn"
            guest_msg = f"Bếp đang chế biến món {service_name} cho phòng {room_label}."
        elif cat_type == 'transport':
            guest_title = "🚗 Đang sắp xếp phương tiện"
            guest_msg = f"Bộ phận điều vận đang sắp xếp xe cho dịch vụ {service_name} của phòng {room_label}."
        elif cat_type == 'spa':
            guest_title = "💆 Đang chuẩn bị phòng trị liệu Spa"
            guest_msg = f"Bộ phận Spa đang chuẩn bị phòng trị liệu và kỹ thuật viên cho yêu cầu {service_name} (Phòng {room_label})."
        elif cat_type == 'laundry':
            guest_title = "🧺 Đang tiến hành giặt ủi đồ"
            guest_msg = f"Bộ phận Giặt là đang tiến hành giặt sấy / ủi đồ cho phòng {room_label}."
        else:  # amenities / other
            guest_title = "⚙️ Buồng phòng đang chuẩn bị yêu cầu"
            guest_msg = f"Bộ phận Buồng phòng đang chuẩn bị yêu cầu {service_name} cho phòng {room_label}."

        return {
            'guest_title': guest_title,
            'guest_msg': guest_msg,
            'staff_title': None,
            'staff_msg': None
        }

    elif status_key == 'delivering':
        # BƯỚC 3: DELIVERING / SERVING (Đang phục vụ / Đang giao)
        if cat_type == 'fnb':
            guest_title = "🛵 Món ăn đang mang lên phòng"
            guest_msg = f"Nhân viên đang mang món {service_name} lên phòng {room_label}. Quý khách vui lòng chú ý nhận món nhé!"
            staff_title = f"🍽️ Món ăn đã làm xong - Sẵn sàng giao: Phòng {room_label}"
            staff_msg = (
                f"Món ăn / Đồ uống \"{service_name}\" (Số lượng: {quantity}) cho phòng {room_label} "
                f"(Khách: {guest_name}) đã được chế biến xong và sẵn sàng được giao. "
                f"Nhân viên phục vụ vui lòng nhận món tại bếp và giao lên phòng cho khách!"
            )
        elif cat_type == 'transport':
            guest_title = "🚖 Xe đã sẵn sàng đón quý khách"
            guest_msg = f"Tài xế và xe cho dịch vụ {service_name} đã sẵn sàng phục vụ quý khách tại sảnh / điểm hẹn!"
            staff_title = f"🚗 Phương tiện đã sẵn sàng: Phòng {room_label}"
            staff_msg = (
                f"Tài xế và xe cho dịch vụ \"{service_name}\" của phòng {room_label} "
                f"(Khách: {guest_name}) đã sẵn sàng phục vụ tại sảnh / điểm hẹn."
            )
        elif cat_type == 'spa':
            guest_title = "🌿 Liệu trình Spa đã sẵn sàng"
            guest_msg = f"Kỹ thuật viên và liệu trình {service_name} đã sẵn sàng phục vụ quý khách!"
            staff_title = f"💆 Phòng Spa & KTV đã sẵn sàng: Phòng {room_label}"
            staff_msg = (
                f"Kỹ thuật viên và liệu trình \"{service_name}\" cho khách phòng {room_label} "
                f"({guest_name}) đã sẵn sàng đón tiếp quý khách."
            )
        elif cat_type == 'laundry':
            guest_title = "🧺 Đồ giặt đã xong, đang mang lên phòng"
            guest_msg = f"Đồ giặt ủi của quý khách ({service_name}) đã hoàn tất và đang được nhân viên mang lên phòng {room_label}."
            staff_title = f"🧺 Đồ giặt đã sẵn sàng giao: Phòng {room_label}"
            staff_msg = (
                f"Đồ giặt ủi \"{service_name}\" (Số lượng: {quantity}) của phòng {room_label} "
                f"(Khách: {guest_name}) đã giặt sấy xong. Nhân viên vui lòng giao lên phòng cho khách!"
            )
        else:  # amenities / other
            guest_title = "🛎️ Tiện ích đang chuyển tới phòng"
            guest_msg = f"Nhân viên đang thực hiện / chuyển {service_name} đến phòng {room_label} của quý khách."
            staff_title = f"🛎️ Tiện ích buồng phòng sẵn sàng chuyển: Phòng {room_label}"
            staff_msg = (
                f"Yêu cầu tiện ích \"{service_name}\" (Số lượng: {quantity}) cho phòng {room_label} "
                f"(Khách: {guest_name}) đã chuẩn bị xong. Nhân viên vui lòng chuyển đến phòng cho khách!"
            )

        return {
            'guest_title': guest_title,
            'guest_msg': guest_msg,
            'staff_title': staff_title,
            'staff_msg': staff_msg
        }

    elif status_key == 'completed':
        # BƯỚC 4: COMPLETED (Đã hoàn thành)
        if cat_type == 'fnb':
            guest_title = "✅ Món ăn đã phục vụ thành công"
            guest_msg = f"Món {service_name} đã được phục vụ tại phòng {room_label}. Chúc quý khách dùng bữa ngon miệng!"
        elif cat_type == 'transport':
            guest_title = "✅ Chuyến xe đã hoàn tất"
            guest_msg = f"Dịch vụ {service_name} cho phòng {room_label} đã hoàn tất. Chúc quý khách một hành trình thượng lộ bình an!"
        elif cat_type == 'spa':
            guest_title = "✅ Liệu trình Spa đã hoàn tất"
            guest_msg = f"Liệu trình {service_name} đã hoàn tất. Chúc quý khách có những giây phút thư giãn tuyệt vời!"
        elif cat_type == 'laundry':
            guest_title = "✅ Đồ giặt ủi đã giao thành công"
            guest_msg = f"Dịch vụ giặt ủi {service_name} cho phòng {room_label} đã được bàn giao đầy đủ. Cảm ơn quý khách!"
        else:  # amenities / other
            guest_title = "✅ Yêu cầu dịch vụ đã hoàn tất"
            guest_msg = f"Yêu cầu dịch vụ {service_name} cho phòng {room_label} đã hoàn tất. Chúc quý khách kỳ nghỉ trọn vẹn tại TA Đà Nẵng!"

        return {
            'guest_title': guest_title,
            'guest_msg': guest_msg,
            'staff_title': f"Dịch vụ phòng {room_label} đã xong",
            'staff_msg': f"Yêu cầu dịch vụ \"{service_name}\" tại phòng {room_label} đã được hoàn thành."
        }

    return None


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
    2. Khi đổi sang in_progress (Bước 2): Thông báo theo nhóm dịch vụ (F&B, Xe, Spa, Buồng phòng)
    3. Khi đổi sang delivering (Bước 3): Báo Khách & Báo Nhân viên theo loại dịch vụ
    4. Khi đổi sang completed (Bước 4): Báo Khách lời chúc phù hợp & Báo Lễ tân
    """
    try:
        booking = instance.booking
        guest = booking.guest if booking else None
        guest_name = guest.get_full_name() or guest.username if guest else "Khách hàng"
        room_label = (booking.room.room_number if booking and booking.room else None) or \
                     (booking.category.name if booking and booking.category else "Chưa xếp phòng")
        service_name = instance.service.name if instance.service else "Dịch vụ"
        category_name = instance.service.category.name if (instance.service and instance.service.category) else ""
        cat_type = get_service_category_type(service_name, category_name)

        guest_url = "/booking-history"
        staff_url = "/admin/services"

        # ----------------------------------------------------------------------
        # TRƯỜNG HỢP 1: KHÁCH ĐẶT DỊCH VỤ MỚI (created == True)
        # ----------------------------------------------------------------------
        if created:
            # 1. Báo cho Quản lý & Lễ tân / Nhân viên phục vụ theo đúng nhóm nghiệp vụ
            staff_users = get_staff_and_admin_users(
                exclude_user_id=guest.id if guest else None,
                category_type=cat_type
            )

            if cat_type == 'fnb':
                staff_title = f"🍽️ Đơn gọi món mới: Phòng {room_label}"
                staff_message = (
                    f"Phòng {room_label} (Khách: {guest_name}) vừa đặt món: \"{service_name}\" "
                    f"(Số lượng: {instance.quantity}, Mã đơn: #{booking.booking_code if booking else 'N/A'}). "
                    f"Bộ phận Bếp / F&B vui lòng tiếp nhận và chế biến."
                )
            elif cat_type == 'transport':
                staff_title = f"🚗 Yêu cầu đặt xe mới: Phòng {room_label}"
                staff_message = (
                    f"Phòng {room_label} (Khách: {guest_name}) vừa đặt dịch vụ xe: \"{service_name}\" "
                    f"(Số lượng: {instance.quantity}, Mã đơn: #{booking.booking_code if booking else 'N/A'}). "
                    f"Bộ phận Điều vận vui lòng tiếp nhận và sắp xếp phương tiện."
                )
            elif cat_type == 'spa':
                staff_title = f"💆 Đặt lịch Spa mới: Phòng {room_label}"
                staff_message = (
                    f"Phòng {room_label} (Khách: {guest_name}) vừa đặt liệu trình: \"{service_name}\" "
                    f"(Số lượng: {instance.quantity}, Mã đơn: #{booking.booking_code if booking else 'N/A'}). "
                    f"Bộ phận Spa vui lòng tiếp nhận và chuẩn bị kỹ thuật viên."
                )
            elif cat_type == 'laundry':
                staff_title = f"🧺 Yêu cầu giặt ủi mới: Phòng {room_label}"
                staff_message = (
                    f"Phòng {room_label} (Khách: {guest_name}) vừa gửi yêu cầu giặt ủi: \"{service_name}\" "
                    f"(Số lượng: {instance.quantity}, Mã đơn: #{booking.booking_code if booking else 'N/A'}). "
                    f"Bộ phận Buồng phòng / Giặt là vui lòng tiếp nhận và thu gom đồ giặt."
                )
            else:  # amenities / other
                staff_title = f"🛎️ Yêu cầu tiện ích mới: Phòng {room_label}"
                staff_message = (
                    f"Phòng {room_label} (Khách: {guest_name}) vừa yêu cầu tiện ích: \"{service_name}\" "
                    f"(Số lượng: {instance.quantity}, Mã đơn: #{booking.booking_code if booking else 'N/A'}). "
                    f"Bộ phận Buồng phòng vui lòng kiểm tra và hỗ trợ."
                )

            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=staff_title,
                    message=staff_message,
                    notification_type='service',
                    action_url=staff_url,
                    priority='high'
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
                    ),
                    notification_type='service',
                    action_url=guest_url,
                    priority='normal'
                )
            return

        # ----------------------------------------------------------------------
        # TRƯỜNG HỢP 2: THAY ĐỔI TRẠNG THÁI TIẾN ĐỘ DỊCH VỤ
        # ----------------------------------------------------------------------
        prev_status = getattr(instance, '_previous_status', None)
        if prev_status == instance.status:
            return

        notif_data = get_service_notification_data(
            service_name=service_name,
            category_name=category_name,
            room_label=room_label,
            status_key=instance.status,
            quantity=instance.quantity,
            guest_name=guest_name
        )

        if instance.status == 'in_progress':
            # Thông báo cho khách hàng
            if guest and notif_data:
                Notification.objects.create(
                    recipient=guest,
                    title=notif_data['guest_title'],
                    message=notif_data['guest_msg'],
                    notification_type='service',
                    action_url=guest_url,
                    priority='normal'
                )

        elif instance.status == 'delivering':
            # 1. Thông báo cho khách hàng
            if guest and notif_data:
                Notification.objects.create(
                    recipient=guest,
                    title=notif_data['guest_title'],
                    message=notif_data['guest_msg'],
                    notification_type='service',
                    action_url=guest_url,
                    priority='high'
                )

            # 2. Thông báo cho Nhân viên phục vụ theo bộ phận & Quản trị / Lễ tân
            if notif_data and notif_data.get('staff_title'):
                staff_users = get_staff_and_admin_users(
                    exclude_user_id=guest.id if guest else None,
                    category_type=cat_type
                )
                staff_notifications = [
                    Notification(
                        recipient=staff,
                        title=notif_data['staff_title'],
                        message=notif_data['staff_msg'],
                        notification_type='service',
                        action_url=staff_url,
                        priority='normal'
                    )
                    for staff in staff_users
                ]
                if staff_notifications:
                    Notification.objects.bulk_create(staff_notifications)

        elif instance.status == 'completed':
            # 1. Báo cho khách hàng kèm lời chúc phù hợp từng loại dịch vụ
            if guest and notif_data:
                Notification.objects.create(
                    recipient=guest,
                    title=notif_data['guest_title'],
                    message=notif_data['guest_msg'],
                    notification_type='service',
                    action_url=guest_url,
                    priority='normal'
                )

            # 2. Báo cho Quản trị viên / Lễ tân & Bộ phận phụ trách
            staff_users = get_staff_and_admin_users(
                exclude_user_id=guest.id if guest else None,
                category_type=cat_type
            )
            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=f"Dịch vụ phòng {room_label} đã xong",
                    message=(
                        f"Yêu cầu dịch vụ \"{service_name}\" (Đơn đặt phòng #{booking.booking_code if booking else 'N/A'}) "
                        f"tại phòng {room_label} đã được hoàn thành."
                    ),
                    notification_type='service',
                    action_url=staff_url,
                    priority='normal'
                )
                for staff in staff_users
            ]
            if staff_notifications:
                Notification.objects.bulk_create(staff_notifications)

        elif instance.status == 'cancelled' and prev_status != 'cancelled':
            if guest:
                Notification.objects.create(
                    recipient=guest,
                    title="✕ Yêu cầu dịch vụ đã bị hủy",
                    message=(
                        f"Yêu cầu dịch vụ \"{service_name}\" cho phòng {room_label} đã bị hủy."
                    ),
                    notification_type='service',
                    action_url=guest_url,
                    priority='normal'
                )

    except Exception as e:
        logger.error(f"Lỗi khi tạo thông báo cho ServiceRequest #{getattr(instance, 'pk', 'N/A')}: {e}")


# ==============================================================================
# 3. SIGNAL CHO PAYMENT: THEO DÕI THANH TOÁN THÀNH CÔNG (VIETQR, TIỀN MẶT, HOÀN CỌC...)
# ==============================================================================
@receiver(pre_save, sender=Payment)
def track_payment_previous_status(sender, instance, **kwargs):
    """
    Lưu lại payment_status cũ trước khi lưu để phát hiện khi giao dịch chuyển sang COMPLETED.
    """
    update_fields = kwargs.get('update_fields')
    if update_fields is not None and 'payment_status' not in update_fields and hasattr(instance, '_previous_payment_status'):
        return

    if instance.pk:
        try:
            old_obj = Payment.objects.get(pk=instance.pk)
            instance._previous_payment_status = old_obj.payment_status
        except Payment.DoesNotExist:
            instance._previous_payment_status = None
    else:
        instance._previous_payment_status = None


@receiver(post_save, sender=Payment)
def notify_on_payment_events(sender, instance, created, **kwargs):
    """
    Gửi thông báo In-App khi có giao dịch thanh toán thành công (COMPLETED):
    - Đơn phòng lẻ: Báo Khách hàng & Báo Thu ngân, Lễ tân, Quản lý
    - Đơn đoàn doanh nghiệp: Báo Đại diện đoàn & Báo Thu ngân, Lễ tân, Quản lý
    """
    try:
        prev_status = getattr(instance, '_previous_payment_status', None)
        is_completed = (instance.payment_status == 'COMPLETED')
        status_just_completed = is_completed and (created or prev_status != 'COMPLETED')

        if not status_just_completed:
            return

        amount_str = f"{instance.amount:,.0f} VND" if instance.amount else "0 VND"
        method_str = format_payment_method(instance.payment_method)
        txn_str = f"Mã GD: {instance.transaction_id}" if instance.transaction_id else ""

        # ----------------------------------------------------------------------
        # TRƯỜNG HỢP 1: THANH TOÁN CHO ĐƠN PHÒNG LẺ (Booking)
        # ----------------------------------------------------------------------
        if instance.booking:
            booking = instance.booking
            room_label = (booking.room.room_number if booking.room else None) or \
                         (booking.category.name if booking.category else "")
            room_info = f" (Phòng {room_label})" if room_label else ""
            guest_name = booking.guest.get_full_name() or booking.guest.username if booking.guest else "Khách hàng"

            # 1. Thông báo cho Khách hàng
            if booking.guest:
                Notification.objects.create(
                    recipient=booking.guest,
                    title=f"💰 Thanh toán thành công: #{booking.booking_code}",
                    message=(
                        f"Giao dịch thanh toán {amount_str} cho đơn đặt phòng #{booking.booking_code}{room_info} "
                        f"qua {method_str} đã được ghi nhận thành công. Khách sạn TA Đà Nẵng cảm ơn quý khách!"
                    ),
                    notification_type='payment',
                    action_url='/booking-history',
                    priority='normal'
                )

            # 2. Thông báo cho Thu ngân, Lễ tân, Quản lý
            finance_staff = get_finance_and_cashier_users(
                exclude_user_id=booking.guest_id if booking.guest else None
            )
            priority = 'high' if (instance.amount and instance.amount >= 10000000) else 'normal'
            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=f"💵 Đã nhận thanh toán: #{booking.booking_code}",
                    message=(
                        f"Đã nhận thanh toán {amount_str} ({method_str}) cho đơn đặt phòng #{booking.booking_code}{room_info} "
                        f"từ khách {guest_name}. {txn_str}".strip()
                    ),
                    notification_type='payment',
                    action_url='/admin/finance',
                    priority=priority
                )
                for staff in finance_staff
            ]
            if staff_notifications:
                Notification.objects.bulk_create(staff_notifications)

        # ----------------------------------------------------------------------
        # TRƯỜNG HỢP 2: THANH TOÁN CHO ĐƠN ĐẶT ĐOÀN (GroupBooking)
        # ----------------------------------------------------------------------
        elif instance.group_booking:
            group = instance.group_booking
            leader_name = group.leader_name or (group.corporate_partner.company_name if group.corporate_partner else "Trưởng đoàn")

            # 1. Tìm tài khoản người nhận đại diện đoàn (nếu có tài khoản)
            leader_user = None
            if hasattr(group, 'leader_user') and group.leader_user:
                leader_user = group.leader_user
            else:
                first_sub = group.sub_bookings.first()
                if first_sub and first_sub.guest:
                    leader_user = first_sub.guest

            if leader_user:
                Notification.objects.create(
                    recipient=leader_user,
                    title=f"💰 Xác nhận thanh toán Đơn đoàn: #{group.group_code}",
                    message=(
                        f"Giao dịch thanh toán {amount_str} qua {method_str} cho đoàn \"{group.group_name}\" "
                        f"(Mã đoàn: #{group.group_code}) đã được ghi nhận thành công."
                    ),
                    notification_type='payment',
                    action_url='/booking-history',
                    priority='high'
                )

            # 2. Thông báo cho Thu ngân, Quản lý, Lễ tân
            finance_staff = get_finance_and_cashier_users(
                exclude_user_id=leader_user.id if leader_user else None
            )
            staff_notifications = [
                Notification(
                    recipient=staff,
                    title=f"💵 Đã nhận thanh toán Đơn đoàn: #{group.group_code}",
                    message=(
                        f"Đã ghi nhận thanh toán {amount_str} qua {method_str} cho đoàn \"{group.group_name}\" "
                        f"(Đại diện: {leader_name} - #{group.group_code}). {txn_str}".strip()
                    ),
                    notification_type='payment',
                    action_url='/admin/finance',
                    priority='high'
                )
                for staff in finance_staff
            ]
            if staff_notifications:
                Notification.objects.bulk_create(staff_notifications)

    except Exception as e:
        logger.error(f"Lỗi khi gửi thông báo thanh toán Payment #{getattr(instance, 'pk', 'N/A')}: {e}")


# ==============================================================================
# 4. SIGNAL CHO INVOICE: THÔNG BÁO YÊU CẦU XUẤT HÓA ĐƠN VAT DOANH NGHIỆP
# ==============================================================================
@receiver(pre_save, sender=Invoice)
def track_invoice_previous_state(sender, instance, **kwargs):
    """
    Lưu lại cờ is_company_invoice trước khi lưu để phát hiện yêu cầu xuất hóa đơn đỏ mới.
    """
    if instance.pk:
        try:
            old_obj = Invoice.objects.get(pk=instance.pk)
            instance._previous_is_company_invoice = old_obj.is_company_invoice
        except Invoice.DoesNotExist:
            instance._previous_is_company_invoice = False
    else:
        instance._previous_is_company_invoice = False


@receiver(post_save, sender=Invoice)
def notify_on_invoice_events(sender, instance, created, **kwargs):
    """
    Gửi thông báo In-App cho Thu ngân & Quản lý:
    Khi có yêu cầu xuất Hóa Đơn Đỏ Doanh Nghiệp (VAT) cho đơn phòng hoặc đơn đoàn.
    """
    try:
        prev_is_company = getattr(instance, '_previous_is_company_invoice', False)
        # Chỉ kích hoạt khi is_company_invoice được bật mới (created hoặc vừa chuyển từ False sang True)
        if instance.is_company_invoice and (created or not prev_is_company):
            if instance.company_name or instance.company_tax_code:
                code_ref = (
                    instance.booking.booking_code if instance.booking else (
                        instance.group_booking.group_code if instance.group_booking else instance.invoice_code
                    )
                )
                total_str = f"{instance.total_amount:,.0f} VND" if instance.total_amount else ""
                total_info = f" ({total_str})" if total_str else ""

                finance_staff = get_finance_and_cashier_users()
                staff_notifications = [
                    Notification(
                        recipient=staff,
                        title=f"🧾 Yêu cầu xuất hóa đơn VAT: #{code_ref}",
                        message=(
                            f"Đơn #{code_ref}{total_info} yêu cầu xuất hóa đơn VAT Doanh nghiệp cho: "
                            f"\"{instance.company_name or 'Chưa rõ'}\" (MST: {instance.company_tax_code or 'Chưa có'}). "
                            f"Vui lòng kiểm tra thông tin và xuất hóa đơn điện tử."
                        ),
                        notification_type='payment',
                        action_url='/admin/invoices',
                        priority='high'
                    )
                    for staff in finance_staff
                ]
                if staff_notifications:
                    Notification.objects.bulk_create(staff_notifications)

    except Exception as e:
        logger.error(f"Lỗi khi gửi thông báo Invoice #{getattr(instance, 'pk', 'N/A')}: {e}")


# ==============================================================================
# 5. SIGNAL CHO CASHOUTVOUCHER: THÔNG BÁO PHIẾU CHI KÉT & HOÀN CỌC
# ==============================================================================
@receiver(post_save, sender=CashOutVoucher)
def notify_on_cash_out_voucher(sender, instance, created, **kwargs):
    """
    Gửi thông báo In-App cho Thu ngân, Quản lý, Chủ khách sạn khi có phiếu chi két / hoàn cọc mới.
    """
    try:
        if not created:
            return

        creator_name = instance.user.get_full_name() or instance.user.username if instance.user else "Nhân viên"
        amount_str = f"{instance.amount:,.0f} VND" if instance.amount else "0 VND"
        voucher_type_name = instance.get_voucher_type_display() if hasattr(instance, 'get_voucher_type_display') else instance.voucher_type

        code_ref = ""
        if instance.booking:
            code_ref = f" (Đơn #{instance.booking.booking_code})"
        elif instance.group_booking:
            code_ref = f" (Đoàn #{instance.group_booking.group_code})"

        finance_staff = get_finance_and_cashier_users(
            exclude_user_id=instance.user_id if instance.user else None
        )
        priority = 'high' if (instance.amount and instance.amount >= 5000000) else 'normal'

        staff_notifications = [
            Notification(
                recipient=staff,
                title=f"💸 Phiếu chi két: #{instance.voucher_code}",
                message=(
                    f"{creator_name} vừa lập phiếu chi #{instance.voucher_code} số tiền {amount_str} "
                    f"({voucher_type_name}){code_ref} cho \"{instance.recipient_name}\". "
                    f"Lý do: {instance.reason}."
                ),
                notification_type='payment',
                action_url='/admin/finance',
                priority=priority
            )
            for staff in finance_staff
        ]
        if staff_notifications:
            Notification.objects.bulk_create(staff_notifications)

    except Exception as e:
        logger.error(f"Lỗi khi gửi thông báo CashOutVoucher #{getattr(instance, 'pk', 'N/A')}: {e}")
