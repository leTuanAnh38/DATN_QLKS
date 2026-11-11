"""Gửi email đơn đặt phòng (thread nền)."""
import logging
import threading
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)
from .config import _is_email_configured
from .booking_template import render_booking_email_html


def _send_booking_email_worker(booking_id, email_type='booking_confirmation', custom_subject=None, recipient_email=None):
    """
    Hàm worker thực thi ngầm trong luồng background threading:
    - Reload booking từ Database.
    - Tìm email người nhận.
    - Kiểm tra cấu hình .env an toàn.
    - Gửi HTML Email qua Gmail SMTP.
    - Bắt mọi ngoại lệ (try...except) để không bao giờ làm gián đoạn hệ thống.
    """
    try:
        from ..models import Booking
        booking = Booking.objects.select_related(
            'guest', 'category', 'room', 'applied_promotion', 'invoice'
        ).prefetch_related(
            'extra_services', 'service_requests', 'service_requests__service', 'guests', 'payments'
        ).filter(id=booking_id).first()

        if not booking:
            logger.warning(f"[EMAIL_SERVICE] Không tìm thấy Booking id={booking_id} để gửi email.")
            return

        # 1. Xác định địa chỉ email người nhận (gộp cả email nhập trên form và email tài khoản người dùng)
        recipient_set = set()
        if recipient_email and str(recipient_email).strip():
            recipient_set.add(str(recipient_email).strip())
        if hasattr(booking, 'invoice') and booking.invoice and booking.invoice.invoice_recipient_email:
            recipient_set.add(str(booking.invoice.invoice_recipient_email).strip())
        if booking.guest and booking.guest.email:
            guest_mail = str(booking.guest.email).strip()
            if '@walkin.hotel.local' not in guest_mail and '@guest.hotel.local' not in guest_mail:
                recipient_set.add(guest_mail)

        valid_recipients = [e for e in recipient_set if e and '@' in e and not e.endswith('.local')]
        if not valid_recipients:
            logger.info(f"[EMAIL_SERVICE] Đơn đặt phòng #{booking.booking_code} không có email người nhận hợp lệ (khách vãng lai tại quầy). Tự động bỏ qua.")
            return

        # 2. Kiểm tra an toàn cấu hình EMAIL trong .env
        if not _is_email_configured():
            logger.warning(
                f"[EMAIL_SERVICE] Chưa cấu hình EMAIL_HOST_USER / EMAIL_HOST_PASSWORD hợp lệ trong .env (hoặc đang để mật khẩu mẫu). "
                f"Bỏ qua bước gửi email thực tế cho đơn #{booking.booking_code} tới {to_email}."
            )
            return

        # 3. Tiêu đề email & Tên thương hiệu
        from ..models import HotelSetting
        try:
            h_name = HotelSetting.get_settings().hotel_name or 'Khách Sạn TA Đà Nẵng'
        except Exception:
            h_name = 'Khách Sạn TA Đà Nẵng'

        if custom_subject:
            subject = custom_subject
        else:
            is_paid = (
                booking.status in ['paid', 'PAID', 'checked_in', 'checked_out', 'completed'] or
                (hasattr(booking, 'invoice') and booking.invoice and booking.invoice.status == 'paid')
            )
            if email_type == 'payment_success' or is_paid:
                subject = f"[{h_name}] Xác nhận ĐÃ THANH TOÁN THÀNH CÔNG - Đơn #{booking.booking_code}"
            else:
                subject = f"[{h_name}] Xác nhận đặt phòng #{booking.booking_code} - Trạng thái thanh toán"

        # 4. Tạo nội dung HTML và Text thuần
        html_content = render_booking_email_html(booking)
        text_content = strip_tags(html_content)

        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or f"{h_name} <{settings.EMAIL_HOST_USER}>"

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=valid_recipients
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)

        logger.info(f"[EMAIL_SERVICE] Gửi email thành công tới {valid_recipients} cho đơn #{booking.booking_code} (Tiêu đề: '{subject}')")

    except Exception as e:
        logger.error(f"[EMAIL_SERVICE] Lỗi ngoại lệ khi gửi email đơn #{booking_id}: {str(e)}", exc_info=True)


def send_booking_email_async(booking, email_type='booking_confirmation', custom_subject=None, recipient_email=None):
    """
    Hàm công khai gọi từ Views / Webhooks cho Đơn Đặt Phòng Đơn Lẻ:
    Chạy trong Background Thread riêng biệt, trả quyền kiểm soát ngay lập tức cho API.
    """
    try:
        booking_id = booking.id if hasattr(booking, 'id') else booking
        thread = threading.Thread(
            target=_send_booking_email_worker,
            args=(booking_id, email_type, custom_subject, recipient_email)
        )
        thread.daemon = True
        thread.start()
    except Exception as e:
        logger.error(f"[EMAIL_SERVICE] Không thể khởi tạo Thread gửi mail đơn lẻ: {str(e)}")
