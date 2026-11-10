"""Gửi email đơn đoàn (thread nền)."""
import logging
import threading
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)
from .config import _is_email_configured
from .group_template import render_group_booking_email_html


def _send_group_booking_email_worker(group_booking_id, email_type='payment_success', custom_subject=None, recipient_email=None):
    """
    Hàm worker thực thi ngầm trong luồng background threading cho Đơn Đặt Phòng Theo Đoàn:
    - Reload GroupBooking từ Database cùng sub_bookings, master_invoice, corporate_partner.
    - Tìm email người nhận (ưu tiên recipient_email -> master_invoice email -> leader_email -> corporate contact_email).
    - Kiểm tra cấu hình .env an toàn.
    - Gửi HTML Email qua Gmail SMTP.
    - Bắt mọi ngoại lệ an toàn không crash hệ thống.
    """
    try:
        from ..models import GroupBooking
        group_booking = GroupBooking.objects.select_related(
            'corporate_partner', 'master_invoice'
        ).prefetch_related(
            'sub_bookings',
            'sub_bookings__category',
            'sub_bookings__room',
            'sub_bookings__guests',
            'sub_bookings__service_requests',
            'sub_bookings__extra_services'
        ).filter(id=group_booking_id).first()

        if not group_booking:
            logger.warning(f"[EMAIL_SERVICE] Không tìm thấy GroupBooking id={group_booking_id} để gửi email.")
            return

        # 1. Xác định địa chỉ email người nhận
        # Trưởng đoàn (leader_email) là người nhận tiên quyết nhất để nhận mã VietQR & thông báo cọc.
        # Nếu có email xuất hóa đơn công ty (invoice_recipient_email) hoặc email đối tác khác với Trưởng đoàn,
        # hệ thống sẽ tự động gửi kèm (CC) để phòng kế toán / doanh nghiệp cùng nắm thông tin.
        to_list = []
        cc_list = []

        if recipient_email and str(recipient_email).strip():
            to_list.append(str(recipient_email).strip())

        # Email Trưởng đoàn / Người đại diện
        leader_mail = getattr(group_booking, 'leader_email', None)
        if leader_mail and str(leader_mail).strip():
            clean_leader = str(leader_mail).strip()
            if clean_leader not in to_list:
                to_list.append(clean_leader)

        # Email xuất hóa đơn công ty / đối tác doanh nghiệp
        company_mail = None
        if hasattr(group_booking, 'master_invoice') and group_booking.master_invoice and group_booking.master_invoice.invoice_recipient_email:
            company_mail = str(group_booking.master_invoice.invoice_recipient_email).strip()
        elif group_booking.corporate_partner and group_booking.corporate_partner.contact_email:
            company_mail = str(group_booking.corporate_partner.contact_email).strip()

        if company_mail and company_mail not in to_list and company_mail not in cc_list:
            # Nếu đã có người nhận chính trong to_list thì đưa company_mail vào cc_list
            if to_list:
                cc_list.append(company_mail)
            else:
                to_list.append(company_mail)

        if not to_list:
            logger.info(f"[EMAIL_SERVICE] Đơn đoàn #{group_booking.group_code} không có địa chỉ email người nhận. Bỏ qua gửi email.")
            return

        # 2. Kiểm tra cấu hình email .env
        if not _is_email_configured():
            logger.warning(
                f"[EMAIL_SERVICE] Chưa cấu hình EMAIL_HOST_USER / EMAIL_HOST_PASSWORD hợp lệ trong .env (hoặc đang để mẫu). "
                f"Bỏ qua gửi email thực tế cho Đơn Đoàn #{group_booking.group_code} tới {to_list}."
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
            is_full = group_booking.is_deposit_paid and (group_booking.deposit_amount >= group_booking.total_amount)
            if is_full:
                subject = f"[{h_name}] Xác nhận ĐÃ THANH TOÁN 100% TOÀN BỘ - Đơn Đoàn #{group_booking.group_code} ({group_booking.group_name})"
            elif group_booking.is_deposit_paid:
                subject = f"[{h_name}] Xác nhận ĐÃ THANH TOÁN TIỀN CỌC THÀNH CÔNG - Đơn Đoàn #{group_booking.group_code} ({group_booking.group_name})"
            else:
                subject = f"[{h_name}] Tiếp nhận Đơn Đặt Đoàn #{group_booking.group_code} ({group_booking.group_name}) - Chờ cọc"

        # 4. Render HTML và gửi
        html_content = render_group_booking_email_html(group_booking)
        text_content = strip_tags(html_content)

        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or f"{h_name} <{settings.EMAIL_HOST_USER}>"

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=to_list,
            cc=cc_list
        )
        msg.attach_alternative(html_content, "text/html")
        try:
            msg.send(fail_silently=False)
        except Exception as send_err:
            if cc_list:
                logger.warning(f"[EMAIL_SERVICE] Gửi email có CC thất bại ({str(send_err)}), thử gửi riêng cho {to_list}...")
                msg_direct = EmailMultiAlternatives(
                    subject=subject,
                    body=text_content,
                    from_email=from_email,
                    to=to_list
                )
                msg_direct.attach_alternative(html_content, "text/html")
                msg_direct.send(fail_silently=False)
            else:
                raise send_err

        logger.info(f"[EMAIL_SERVICE] Gửi email Đơn Đoàn thành công tới {', '.join(to_list)} (CC: {', '.join(cc_list) if cc_list else 'Không'}) cho đoàn #{group_booking.group_code} (Tiêu đề: '{subject}')")

    except Exception as e:
        logger.error(f"[EMAIL_SERVICE] Lỗi ngoại lệ khi gửi email Đơn Đoàn id={group_booking_id}: {str(e)}", exc_info=True)


def send_group_booking_email_async(group_booking, email_type='payment_success', custom_subject=None, recipient_email=None):
    """
    Hàm công khai gọi từ Views / Webhooks cho Đơn Đặt Phòng Theo Đoàn:
    Chạy trong Background Thread riêng biệt, trả quyền kiểm soát ngay lập tức cho API.
    """
    try:
        group_id = group_booking.id if hasattr(group_booking, 'id') else group_booking
        thread = threading.Thread(
            target=_send_group_booking_email_worker,
            args=(group_id, email_type, custom_subject, recipient_email)
        )
        thread.daemon = True
        thread.start()
    except Exception as e:
        logger.error(f"[EMAIL_SERVICE] Không thể khởi tạo Thread gửi mail Đơn Đoàn: {str(e)}")
