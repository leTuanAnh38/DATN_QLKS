import os
import re
import urllib.parse
import logging
import threading
from decimal import Decimal
from datetime import datetime
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)


def _is_email_configured():
    """
    Kiểm tra xem thông tin EMAIL_HOST_USER và EMAIL_HOST_PASSWORD trong .env đã được cấu hình thật hay chưa.
    Tránh timeout hoặc lỗi kết nối SMTP khi đang dùng giá trị mẫu.
    """
    user = getattr(settings, 'EMAIL_HOST_USER', '') or ''
    pwd = getattr(settings, 'EMAIL_HOST_PASSWORD', '') or ''
    
    user = str(user).strip()
    pwd = str(pwd).strip()

    if not user or not pwd:
        return False
    
    # Kiểm tra các giá trị placeholder mẫu
    if user in ['your_email@gmail.com', 'example@gmail.com', '']:
        return False
    if pwd in ['xxxx xxxx xxxx xxxx', 'xxxx-xxxx-xxxx-xxxx', '']:
        return False
    if 'xxxx' in pwd.lower():
        return False

    return True


def render_booking_email_html(booking, custom_message=None):
    """
    Thiết kế mẫu Email HTML chuẩn 5 sao cho Khách sạn TA Đà Nẵng:
    - Header sang trọng với thương hiệu 5-Star Luxury Resort & Hotel.
    - Khung trạng thái thanh toán linh hoạt:
      + Xanh lá nếu ĐÃ THANH TOÁN (hiển thị số tiền đã TT và 0 VNĐ còn lại).
      + Cam nổi bật nếu CHƯA THANH TOÁN (kèm mã VietQR động để quét thanh toán ngay).
    - Bảng thông tin chi tiết đặt phòng & Khách hàng Doanh nghiệp (nếu có).
    - Bảng kê chi phí minh bạch: Tiền phòng + Dịch vụ đặt kèm - Giảm giá VIP / Khuyến mãi = Tổng cộng.
    """
    # 0. Tải thông tin thương hiệu & cấu hình vận hành từ Database (HotelSetting)
    from .models import HotelSetting
    try:
        hotel_settings = HotelSetting.get_settings()
        hotel_name = hotel_settings.hotel_name or 'Khách Sạn TA Đà Nẵng'
        hotel_slogan = hotel_settings.hotel_slogan or '5-Star Luxury Resort & Hotel'
        hotel_address = hotel_settings.address or '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Quận Ngũ Hành Sơn, TP. Đà Nẵng'
        hotel_hotline = hotel_settings.hotline or '1900 8899'
        hotel_phone = hotel_settings.phone_number or '0236 388 9999'
        hotel_email = hotel_settings.email or 'contact@tahotel.vn'
        check_in_time = hotel_settings.check_in_time or '14:00'
        check_out_time = hotel_settings.check_out_time or '12:00'
    except Exception:
        hotel_name = 'Khách Sạn TA Đà Nẵng'
        hotel_slogan = '5-Star Luxury Resort & Hotel'
        hotel_address = '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Quận Ngũ Hành Sơn, TP. Đà Nẵng'
        hotel_hotline = '1900 8899'
        hotel_phone = '0236 388 9999'
        hotel_email = 'contact@tahotel.vn'
        check_in_time = '14:00'
        check_out_time = '12:00'
    hotel_name_upper = hotel_name.upper()
    hotel_slogan_upper = hotel_slogan.upper()

    # 1. Xác định trạng thái thanh toán thực tế của đơn
    note_str = (booking.note or '').lower()
    is_paid = (
        booking.status in ['paid', 'PAID', 'checked_in', 'checked_out', 'completed'] or
        (hasattr(booking, 'invoice') and booking.invoice and booking.invoice.status == 'paid') or
        (hasattr(booking, 'payments') and booking.payments.filter(payment_status='COMPLETED').exists()) or
        ('sepay vietqr' in note_str or 'đã thanh toán' in note_str)
    )

    # 2. Tính toán số đêm & chi phí
    check_in = booking.check_in_date
    check_out = booking.check_out_date
    nights = 1
    if check_in and check_out:
        diff = (check_out - check_in).days
        nights = diff if diff > 0 else 1

    check_in_str = check_in.strftime('%d/%m/%Y') if check_in else ''
    check_out_str = check_out.strftime('%d/%m/%Y') if check_out else ''

    # Xác định giá phòng
    cat_name = booking.category.name if booking.category else 'Phòng Tiêu chuẩn'
    room_number_display = booking.room.room_number if booking.room else 'Sắp xếp khi nhận phòng'

    total_amount = Decimal(str(booking.total_amount or 0))
    membership_discount = Decimal(str(booking.membership_discount or 0))

    # Lấy danh sách dịch vụ đi kèm (Add-on Services)
    services_list = []
    total_services_amount = Decimal('0')

    # Ưu tiên lấy từ ServiceRequest liên kết với Booking
    if hasattr(booking, 'service_requests'):
        for sr in booking.service_requests.select_related('service').all():
            svc_name = sr.service.name if sr.service else 'Dịch vụ tiện ích'
            unit_price = Decimal(str(sr.unit_price or 0))
            qty = sr.quantity or 1
            tot = Decimal(str(sr.total_price or (unit_price * qty)))
            total_services_amount += tot
            services_list.append({
                'name': svc_name,
                'qty': qty,
                'unit_price': unit_price,
                'total_price': tot
            })

    # Nếu không có từ ServiceRequest, kiểm tra trong BookingExtraService
    if not services_list and hasattr(booking, 'extra_services'):
        for es in booking.extra_services.all():
            unit_price = Decimal(str(es.price or 0))
            qty = es.quantity or 1
            tot = unit_price * qty
            total_services_amount += tot
            services_list.append({
                'name': es.service_name,
                'qty': qty,
                'unit_price': unit_price,
                'total_price': tot
            })

    # Tính tiền phòng cơ sở (tiền phòng trước giảm giá)
    if booking.category:
        price_per_night = booking.category.promo_price or booking.category.base_price
        room_base_amount = Decimal(str(price_per_night)) * Decimal(str(nights))
    else:
        room_base_amount = max(Decimal('0'), total_amount - total_services_amount + membership_discount)

    # Tính số tiền giảm giá khuyến mãi coupon
    coupon_code = ''
    coupon_discount = Decimal('0')
    if booking.applied_promotion:
        coupon_code = booking.applied_promotion.code
        # Số tiền chênh lệch sau khi trừ phòng, dịch vụ, giảm VIP
        expected_total = (room_base_amount - membership_discount) + total_services_amount
        if expected_total > total_amount:
            coupon_discount = expected_total - total_amount

    # Thông tin khách hàng
    primary_guest = None
    if hasattr(booking, 'guests'):
        primary_guest = booking.guests.filter(is_primary=True).first() or booking.guests.first()
    
    guest_name = (primary_guest.full_name if primary_guest else None) or \
                 (booking.guest.get_full_name() if booking.guest and booking.guest.get_full_name() else None) or \
                 (booking.guest.username if booking.guest else 'Quý khách')
    guest_phone = getattr(booking.guest, 'phone_number', '') or 'Chưa cập nhật'
    identity_card = booking.identity_card or (primary_guest.id_number if primary_guest else '') or 'Đã lưu hệ thống'

    # 3. Tạo URL mã VietQR động nếu chưa thanh toán
    vietqr_url = ''
    bank_info_text = ''
    if not is_paid:
        try:
            from ..payments.models import PaymentConfig
            payment_cfg = PaymentConfig.get_solo()
            bank_bin = payment_cfg.bank_bin or '970422'
            account_no = payment_cfg.account_no or '123456789'
            account_name = payment_cfg.account_name or 'KHACH SAN TA DA NANG'
        except Exception:
            bank_bin = '970422'
            account_no = '123456789'
            account_name = 'KHACH SAN TA DA NANG'

        qr_note = booking.booking_code
        enc_note = urllib.parse.quote(qr_note)
        enc_acc = urllib.parse.quote(account_name)
        amt_int = int(total_amount)
        vietqr_url = f"https://img.vietqr.io/image/{bank_bin}-{account_no}-compact2.jpg?amount={amt_int}&addInfo={enc_note}&accountName={enc_acc}"
        bank_info_text = f"Mã BIN: {bank_bin} | STK: {account_no} | Chủ TK: {account_name}"

    # 4. Tạo khối thông tin Doanh nghiệp nếu là đơn CORPORATE
    corporate_html = ''
    if booking.customer_type == 'CORPORATE' or booking.company_name:
        corporate_html = f"""
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 18px; margin-top: 15px;">
            <p style="margin: 0 0 8px 0; color: #1E293B; font-weight: bold; font-size: 14px;">🏢 THÔNG TIN HÓA ĐƠN DOANH NGHIỆP (VAT)</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #475569;">
                <tr>
                    <td style="padding: 4px 0; width: 35%; font-weight: 600;">Đơn vị (Công ty):</td>
                    <td style="padding: 4px 0; color: #0F172A; font-weight: bold;">{booking.company_name or 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Mã số thuế (MST):</td>
                    <td style="padding: 4px 0; color: #0F172A; font-family: monospace; font-size: 14px;">{booking.company_tax_code or 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Địa chỉ xuất HĐ:</td>
                    <td style="padding: 4px 0; color: #0F172A;">{booking.company_address or 'N/A'}</td>
                </tr>
            </table>
        </div>
        """

    # 5. Dòng bảng kê dịch vụ đi kèm
    services_rows_html = ''
    if services_list:
        for s in services_list:
            services_rows_html += f"""
            <tr>
                <td style="padding: 10px 12px; border-bottom: 1px dashed #E2E8F0; font-size: 13px; color: #334155;">
                    ✦ {s['name']} <span style="color: #64748B;">(x{s['qty']})</span>
                </td>
                <td style="padding: 10px 12px; border-bottom: 1px dashed #E2E8F0; text-align: right; font-size: 13px; color: #0F172A; font-weight: 600;">
                    +{s['total_price']:,.0f} VNĐ
                </td>
            </tr>
            """

    # Dòng giảm giá thành viên
    vip_discount_row = ''
    if membership_discount > 0:
        vip_discount_row = f"""
        <tr>
            <td style="padding: 10px 12px; border-bottom: 1px dashed #E2E8F0; font-size: 13px; color: #059669; font-weight: 600;">
                🎁 Ưu đãi Hạng Thành viên VIP
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px dashed #E2E8F0; text-align: right; font-size: 13px; color: #059669; font-weight: bold;">
                -{membership_discount:,.0f} VNĐ
            </td>
        </tr>
        """

    # Dòng giảm giá coupon
    coupon_row = ''
    if coupon_discount > 0:
        coupon_label = f"Mã khuyến mãi ({coupon_code})" if coupon_code else "Mã khuyến mãi"
        coupon_row = f"""
        <tr>
            <td style="padding: 10px 12px; border-bottom: 1px dashed #E2E8F0; font-size: 13px; color: #EA580C; font-weight: 600;">
                🏷️ {coupon_label}
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px dashed #E2E8F0; text-align: right; font-size: 13px; color: #EA580C; font-weight: bold;">
                -{coupon_discount:,.0f} VNĐ
            </td>
        </tr>
        """

    # 6. Khung Trạng Thái Thanh Toán (Xanh lá nếu ĐÃ TT / Cam nếu CHỜ TT)
    if is_paid:
        payment_box_html = f"""
        <div style="background-color: #ECFDF5; border: 2px solid #10B981; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
            <div style="display: inline-block; background-color: #10B981; color: #FFFFFF; font-size: 12px; font-weight: 800; letter-spacing: 1px; padding: 4px 14px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 10px;">
                TRẠNG THÁI THANH TOÁN
            </div>
            <h2 style="margin: 6px 0; color: #065F46; font-size: 20px; font-weight: 800;">
                ✅ ĐÃ THANH TOÁN THÀNH CÔNG
            </h2>
            <p style="margin: 8px 0 14px 0; color: #047857; font-size: 14px;">
                Đơn đặt phòng của quý khách đã được bảo đảm và ghi nhận hoàn tất trên hệ thống PMS.
            </p>
            <div style="background: #FFFFFF; border-radius: 8px; padding: 12px 18px; display: inline-block; min-width: 280px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr>
                        <td style="text-align: left; color: #64748B; padding: 4px 0;">Số tiền đã thanh toán:</td>
                        <td style="text-align: right; color: #065F46; font-weight: 800; font-size: 16px; padding: 4px 0;">{total_amount:,.0f} VNĐ</td>
                    </tr>
                    <tr>
                        <td style="text-align: left; color: #64748B; padding: 4px 0; border-top: 1px dashed #E2E8F0;">Số tiền còn phải trả:</td>
                        <td style="text-align: right; color: #10B981; font-weight: 800; font-size: 15px; padding: 4px 0; border-top: 1px dashed #E2E8F0;">0 VNĐ</td>
                    </tr>
                </table>
            </div>
        </div>
        """
    else:
        payment_box_html = f"""
        <div style="background-color: #FFFBEB; border: 2px solid #F59E0B; border-radius: 12px; padding: 22px 18px; margin: 24px 0; text-align: center;">
            <div style="display: inline-block; background-color: #F59E0B; color: #FFFFFF; font-size: 12px; font-weight: 800; letter-spacing: 1px; padding: 4px 14px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 10px;">
                TRẠNG THÁI THANH TOÁN
            </div>
            <h2 style="margin: 6px 0; color: #92400E; font-size: 20px; font-weight: 800;">
                ⏳ CHƯA THANH TOÁN / CHỜ THANH TOÁN
            </h2>
            <p style="margin: 6px 0 16px 0; color: #B45309; font-size: 14px;">
                Tổng số tiền cần thanh toán: <strong style="color: #92400E; font-size: 18px;">{total_amount:,.0f} VNĐ</strong>
            </p>

            <!-- KHỐI QUÉT MÃ VIETQR TỰ ĐỘNG -->
            <div style="background-color: #FFFFFF; border-radius: 12px; padding: 18px; display: inline-block; max-width: 320px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15); border: 1px solid #FDE68A;">
                <p style="margin: 0 0 10px 0; color: #1E293B; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
                    ⚡ Quét mã VietQR chuyển khoản tức thì
                </p>
                <div style="background: #F8FAFC; padding: 8px; border-radius: 8px; display: inline-block; border: 1px solid #E2E8F0;">
                    <img src="{vietqr_url}" alt="Mã VietQR thanh toán #{booking.booking_code}" style="width: 240px; height: auto; display: block; margin: 0 auto; border-radius: 6px;" />
                </div>
                <div style="margin-top: 12px; text-align: left; font-size: 12px; color: #475569; line-height: 1.6; background-color: #FFFDF5; padding: 10px; border-radius: 6px; border: 1px dashed #FCD34D;">
                    <div>• <strong>Nội dung CK:</strong> <span style="font-family: monospace; font-size: 13px; font-weight: bold; color: #B45309;">{booking.booking_code}</span></div>
                    <div>• <strong>Số tiền:</strong> <strong style="color: #0F172A;">{total_amount:,.0f} VNĐ</strong></div>
                    <div style="font-size: 11px; color: #78350F; margin-top: 4px;"><em>(Hệ thống tự động kích hoạt ĐÃ THANH TOÁN ngay sau khi nhận tiền)</em></div>
                </div>
            </div>
            
            <p style="margin: 14px 0 0 0; color: #78350F; font-size: 12px;">
                💡 <em>Nếu đã chọn thanh toán tiền mặt tại quầy lễ tân khi nhận phòng, quý khách có thể bỏ qua mã QR này.</em>
            </p>
        </div>
        """

    # 7. Ghép toàn bộ template HTML
    html_template = f"""
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Xác nhận Đặt phòng - {hotel_name}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; line-height: 1.5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #F1F5F9; padding: 30px 10px;">
        <tr>
            <td align="center">
                <table role="presentation" style="width: 100%; max-width: 650px; border-collapse: collapse; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);">
                    
                    <!-- HEADER 5 SAO -->
                    <tr>
                        <td bgcolor="#0F172A" style="background-color: #0F172A !important; background: linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%); padding: 36px 30px; text-align: center; border-bottom: 4px solid #D97706;">
                            <div style="color: #F59E0B !important; font-size: 20px; letter-spacing: 5px; margin-bottom: 8px;">
                                <font color="#F59E0B">★★★★★</font>
                            </div>
                            <h1 style="margin: 0; padding: 0; color: #F59E0B !important; font-size: 26px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.3;">
                                <font color="#F59E0B">
                                    <span style="color: #F59E0B !important; font-size: 26px; font-weight: 900; letter-spacing: 1.5px;">
                                        {hotel_name_upper}
                                    </span>
                                </font>
                            </h1>
                            <p style="margin: 6px 0 0 0; color: #FCD34D !important; font-size: 13px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;">
                                <font color="#FCD34D">
                                    <span style="color: #FCD34D !important; letter-spacing: 2.5px;">{hotel_slogan_upper}</span>
                                </font>
                            </p>
                            <table role="presentation" align="center" style="margin: 14px auto 14px auto; border-collapse: collapse;">
                                <tr>
                                    <td style="height: 2px; width: 80px; background-color: #D97706;" bgcolor="#D97706"></td>
                                </tr>
                            </table>
                            <p style="margin: 0; color: #E2E8F0 !important; font-size: 12px; line-height: 1.6;">
                                <font color="#E2E8F0">
                                    📍 {hotel_address}<br/>
                                    📞 Hotline: <strong style="color: #FBBF24 !important;"><font color="#FBBF24">{hotel_hotline}</font></strong> | ✉ Email: <strong style="color: #FBBF24 !important;"><font color="#FBBF24">{hotel_email}</font></strong>
                                </font>
                            </p>
                        </td>
                    </tr>

                    <!-- NỘI DUNG CHÍNH -->
                    <tr>
                        <td style="padding: 32px 30px;">
                            
                            <!-- LỜI CHÀO -->
                            <div style="margin-bottom: 22px;">
                                <h3 style="margin: 0 0 10px 0; color: #0F172A; font-size: 18px; font-weight: 800;">
                                    Kính gửi Quý khách <span style="color: #D97706; font-weight: 800;">{guest_name}</span>,
                                </h3>
                                <p style="margin: 0; color: #334155; font-size: 14px; line-height: 1.7;">
                                    <strong style="color: #B45309; font-weight: 800;">{hotel_name}</strong> trân trọng cảm ơn Quý khách đã tin tưởng và lựa chọn kỳ nghỉ dưỡng tại khách sạn chúng tôi. Dưới đây là thông tin chi tiết và biên lai xác nhận đặt phòng của Quý khách.
                                </p>
                            </div>

                            <!-- KHUNG TRẠNG THÁI THANH TOÁN -->
                            {payment_box_html}

                            <!-- BẢNG CHI TIẾT ĐẶT PHÒNG -->
                            <div style="margin-top: 26px;">
                                <div style="display: flex; align-items: center; border-bottom: 2px solid #E2E8F0; padding-bottom: 8px; margin-bottom: 14px;">
                                    <h4 style="margin: 0; color: #0F172A; font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                                        📋 Chi tiết đặt phòng
                                    </h4>
                                </div>
                                <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
                                    <tr style="background-color: #F8FAFC;">
                                        <td style="padding: 10px 12px; width: 38%; color: #64748B; font-weight: 600;">Mã đặt phòng:</td>
                                        <td style="padding: 10px 12px; color: #0F172A; font-weight: 800; font-family: monospace; font-size: 15px;">
                                            #{booking.booking_code}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 12px; color: #64748B; font-weight: 600; border-top: 1px solid #F1F5F9;">Khách hàng đại diện:</td>
                                        <td style="padding: 10px 12px; color: #0F172A; font-weight: bold; border-top: 1px solid #F1F5F9;">{guest_name}</td>
                                    </tr>
                                    <tr style="background-color: #F8FAFC;">
                                        <td style="padding: 10px 12px; color: #64748B; font-weight: 600;">Số điện thoại:</td>
                                        <td style="padding: 10px 12px; color: #0F172A;">{guest_phone}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 12px; color: #64748B; font-weight: 600; border-top: 1px solid #F1F5F9;">CCCD / Hộ chiếu:</td>
                                        <td style="padding: 10px 12px; color: #0F172A; border-top: 1px solid #F1F5F9;">{identity_card}</td>
                                    </tr>
                                    <tr style="background-color: #F8FAFC;">
                                        <td style="padding: 10px 12px; color: #64748B; font-weight: 600;">Hạng phòng nghỉ:</td>
                                        <td style="padding: 10px 12px; color: #0F172A; font-weight: 700;">{cat_name}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 12px; color: #64748B; font-weight: 600; border-top: 1px solid #F1F5F9;">Phòng lưu trú:</td>
                                        <td style="padding: 10px 12px; color: #0F172A; border-top: 1px solid #F1F5F9;">
                                            <span style="background-color: #E2E8F0; padding: 2px 8px; border-radius: 4px; font-weight: bold;">{room_number_display}</span>
                                        </td>
                                    </tr>
                                    <tr style="background-color: #F8FAFC;">
                                        <td style="padding: 10px 12px; color: #64748B; font-weight: 600;">Thời gian Check-in:</td>
                                        <td style="padding: 10px 12px; color: #0F172A; font-weight: 600;">
                                            {check_in_str} <span style="font-size: 12px; color: #64748B;">(Sau {check_in_time})</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 12px; color: #64748B; font-weight: 600; border-top: 1px solid #F1F5F9;">Thời gian Check-out:</td>
                                        <td style="padding: 10px 12px; color: #0F172A; font-weight: 600; border-top: 1px solid #F1F5F9;">
                                            {check_out_str} <span style="font-size: 12px; color: #64748B;">(Trước {check_out_time})</span>
                                        </td>
                                    </tr>
                                    <tr style="background-color: #F8FAFC;">
                                        <td style="padding: 10px 12px; color: #64748B; font-weight: 600;">Tổng số đêm:</td>
                                        <td style="padding: 10px 12px; color: #0F172A; font-weight: bold;">{nights} đêm</td>
                                    </tr>
                                </table>
                            </div>

                            <!-- THÔNG TIN DOANH NGHIỆP NẾU CÓ -->
                            {corporate_html}

                            <!-- BẢNG KÊ CHI PHÍ THANH TOÁN -->
                            <div style="margin-top: 28px;">
                                <div style="border-bottom: 2px solid #E2E8F0; padding-bottom: 8px; margin-bottom: 12px;">
                                    <h4 style="margin: 0; color: #0F172A; font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                                        💳 Bảng kê chi phí &amp; Thanh toán
                                    </h4>
                                </div>
                                <table style="width: 100%; border-collapse: collapse;">
                                    <thead>
                                        <tr style="background-color: #F1F5F9;">
                                            <th style="padding: 8px 12px; text-align: left; font-size: 12px; color: #475569; text-transform: uppercase; font-weight: 700;">Khoản mục</th>
                                            <th style="padding: 8px 12px; text-align: right; font-size: 12px; color: #475569; text-transform: uppercase; font-weight: 700;">Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td style="padding: 10px 12px; border-bottom: 1px dashed #E2E8F0; font-size: 13.5px; color: #334155;">
                                                Tiền phòng nghỉ <span style="color: #64748B;">({nights} đêm)</span>
                                            </td>
                                            <td style="padding: 10px 12px; border-bottom: 1px dashed #E2E8F0; text-align: right; font-size: 13.5px; color: #0F172A; font-weight: 600;">
                                                {room_base_amount:,.0f} VNĐ
                                            </td>
                                        </tr>
                                        {services_rows_html}
                                        {vip_discount_row}
                                        {coupon_row}
                                        <tr style="background-color: #F8FAFC;">
                                            <td style="padding: 14px 12px; font-size: 15px; font-weight: 800; color: #0F172A; text-transform: uppercase;">
                                                TỔNG CỘNG THANH TOÁN:
                                            </td>
                                            <td style="padding: 14px 12px; text-align: right; font-size: 18px; font-weight: 800; color: #D97706;">
                                                {total_amount:,.0f} VNĐ
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <!-- LƯU Ý KHI LƯU TRÚ -->
                            <div style="margin-top: 28px; background-color: #F8FAFC; border-left: 4px solid #D97706; padding: 14px 18px; border-radius: 0 8px 8px 0;">
                                <p style="margin: 0 0 6px 0; color: #1E293B; font-weight: bold; font-size: 13px;">📌 QUY ĐỊNH NHẬN PHÒNG &amp; LƯU Ý QUAN TRỌNG:</p>
                                <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #475569; line-height: 1.6;">
                                    <li>Giờ nhận phòng (Check-in) từ <strong>{check_in_time}</strong> và Giờ trả phòng (Check-out) trước <strong>{check_out_time}</strong> trưa.</li>
                                    <li>Quý khách vui lòng xuất trình <strong>CCCD / Hộ chiếu bản gốc</strong> tại quầy Lễ tân để làm thủ tục khai báo tạm trú theo quy định.</li>
                                    <li>Nếu Quý khách có yêu cầu đặc biệt về nhận phòng sớm hoặc đưa đón sân bay, vui lòng gọi trực tiếp hotline <strong>{hotel_hotline}</strong> để được phục vụ chu đáo nhất.</li>
                                </ul>
                            </div>

                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td bgcolor="#0F172A" style="background-color: #0F172A !important; padding: 28px 30px; text-align: center; color: #E2E8F0 !important; font-size: 12px; line-height: 1.6; border-top: 2px solid #D97706;">
                            <p style="margin: 0 0 8px 0; color: #F59E0B !important; font-weight: 800; font-size: 13.5px; letter-spacing: 0.5px; text-transform: uppercase;">
                                <font color="#F59E0B">
                                    <span style="color: #F59E0B !important;">{hotel_name_upper} HÂN HẠNH ĐƯỢC CHÀO ĐÓN QUÝ KHÁCH!</span>
                                </font>
                            </p>
                            <p style="margin: 0 0 6px 0; color: #CBD5E1 !important;">
                                <font color="#CBD5E1">
                                    Hotline: <strong style="color: #FBBF24 !important;"><font color="#FBBF24">{hotel_hotline}</font></strong> | Lễ tân 24/7: <strong style="color: #FBBF24 !important;"><font color="#FBBF24">{hotel_phone}</font></strong> | Email: <strong style="color: #FBBF24 !important;"><font color="#FBBF24">{hotel_email}</font></strong>
                                </font>
                            </p>
                            <p style="margin: 8px 0 0 0; font-size: 11px; color: #94A3B8 !important;">
                                <font color="#94A3B8">
                                    <em>* Đây là thư điện tử gửi tự động từ hệ sinh thái quản lý khách sạn {hotel_name}. Quý khách vui lòng không trả lời trực tiếp email này.</em>
                                </font>
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    """
    return html_template


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
        from .models import Booking
        booking = Booking.objects.select_related(
            'guest', 'category', 'room', 'applied_promotion', 'invoice'
        ).prefetch_related(
            'extra_services', 'service_requests', 'service_requests__service', 'guests', 'payments'
        ).filter(id=booking_id).first()

        if not booking:
            logger.warning(f"[EMAIL_SERVICE] Không tìm thấy Booking id={booking_id} để gửi email.")
            return

        # 1. Xác định địa chỉ email người nhận
        to_email = recipient_email
        if not to_email and hasattr(booking, 'invoice') and booking.invoice and booking.invoice.invoice_recipient_email:
            to_email = booking.invoice.invoice_recipient_email.strip()

        if not to_email and booking.guest and booking.guest.email:
            to_email = booking.guest.email.strip()

        if not to_email:
            logger.info(f"[EMAIL_SERVICE] Đơn đặt phòng #{booking.booking_code} không có email người nhận (khách vãng lai tại quầy). Tự động bỏ qua.")
            return

        # 2. Kiểm tra an toàn cấu hình EMAIL trong .env
        if not _is_email_configured():
            logger.warning(
                f"[EMAIL_SERVICE] Chưa cấu hình EMAIL_HOST_USER / EMAIL_HOST_PASSWORD hợp lệ trong .env (hoặc đang để mật khẩu mẫu). "
                f"Bỏ qua bước gửi email thực tế cho đơn #{booking.booking_code} tới {to_email}."
            )
            return

        # 3. Tiêu đề email & Tên thương hiệu
        from .models import HotelSetting
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
            to=[to_email]
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send(fail_silently=False)

        logger.info(f"[EMAIL_SERVICE] Gửi email thành công tới {to_email} cho đơn #{booking.booking_code} (Tiêu đề: '{subject}')")

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


# ==============================================================================
# PHẦN 2: DỊCH VỤ EMAIL CHO ĐƠN ĐẶT PHÒNG THEO ĐOÀN DOANH NGHIỆP (GROUP BOOKING)
# ==============================================================================

def render_group_booking_email_html(group_booking, custom_message=None):
    """
    Thiết kế mẫu Email HTML chuẩn 5 sao Luxury dành riêng cho Đơn Đặt Phòng Theo Đoàn Doanh Nghiệp:
    - Header Vàng Kim Gold Luxury thương hiệu Khách Sạn TA Đà Nẵng.
    - Banner Trạng thái Thanh toán & Cọc hợp đồng đoàn (Xanh lá khi đã cọc/toàn bộ; Cam kèm VietQR khi chờ cọc).
    - Khối Thông tin Đoàn, Người đại diện / Trưởng đoàn, Doanh nghiệp đối tác B2B.
    - Bảng tổng hợp chi tiết các phòng trong đoàn (Multi-room breakdown theo Hạng phòng & Số phòng).
    - Bảng kê chi phí minh bạch: Tiền phòng + Chiết khấu Doanh nghiệp + Dịch vụ đoàn = Tổng giá trị hợp đồng.
    - Khối Thông tin Xuất Hóa đơn GTGT (VAT) Công ty đầy đủ hợp lệ.
    """
    # 0. Tải thông tin thương hiệu & cấu hình từ HotelSetting
    from .models import HotelSetting
    try:
        hotel_settings = HotelSetting.get_settings()
        stars = getattr(hotel_settings, 'stars', 3) or 3
        hotel_name = hotel_settings.hotel_name or 'Khách Sạn TA Đà Nẵng'
        hotel_slogan = hotel_settings.hotel_slogan or f'{stars}-Star Hotel & Resort'
        hotel_address = hotel_settings.address or '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Quận Ngũ Hành Sơn, TP. Đà Nẵng'
        hotel_hotline = hotel_settings.hotline or '1900 8899'
        hotel_phone = hotel_settings.phone_number or '0236 388 9999'
        hotel_email = hotel_settings.email or 'contact@tahotel.vn'
        check_in_time = hotel_settings.check_in_time or '14:00'
        check_out_time = hotel_settings.check_out_time or '12:00'
    except Exception:
        stars = 3
        hotel_name = 'Khách Sạn TA Đà Nẵng'
        hotel_slogan = '3-Star Hotel & Resort'
        hotel_address = '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Quận Ngũ Hành Sơn, TP. Đà Nẵng'
        hotel_hotline = '1900 8899'
        hotel_phone = '0236 388 9999'
        hotel_email = 'contact@tahotel.vn'
        check_in_time = '14:00'
        check_out_time = '12:00'
    hotel_name_upper = hotel_name.upper()
    hotel_slogan_upper = hotel_slogan.upper()
    stars_display = ' '.join(['★'] * stars)

    # 1. Tính toán thời gian lưu trú
    check_in = group_booking.check_in_date
    check_out = group_booking.check_out_date
    nights = 1
    if check_in and check_out:
        diff = (check_out - check_in).days
        nights = diff if diff > 0 else 1

    check_in_str = check_in.strftime('%d/%m/%Y') if check_in else ''
    check_out_str = check_out.strftime('%d/%m/%Y') if check_out else ''

    # 2. Tài chính & Trạng thái thanh toán
    total_amount = Decimal(str(group_booking.total_amount or 0))
    deposit_amount = Decimal(str(group_booking.deposit_amount or 0))
    is_deposit_paid = bool(group_booking.is_deposit_paid)
    is_full_paid = is_deposit_paid and (deposit_amount >= total_amount)
    remaining_balance = max(Decimal('0'), total_amount - deposit_amount) if is_deposit_paid else total_amount

    # 3. Tổng hợp danh sách phòng trong đoàn theo Hạng phòng
    sub_bookings = list(group_booking.sub_bookings.select_related('category', 'room').prefetch_related('guests').all())
    total_rooms_count = len(sub_bookings)

    category_groups = {}
    for sb in sub_bookings:
        cat_id = sb.category_id or 0
        cat_name = sb.category.name if sb.category else 'Phòng Tiêu Chuẩn'
        if cat_id not in category_groups:
            category_groups[cat_id] = {
                'name': cat_name,
                'count': 0,
                'subtotal': Decimal('0'),
                'room_numbers': []
            }
        category_groups[cat_id]['count'] += 1
        category_groups[cat_id]['subtotal'] += Decimal(str(sb.total_amount or 0))
        if sb.room and sb.room.room_number:
            category_groups[cat_id]['room_numbers'].append(f"#{sb.room.room_number}")

    # Bảng danh sách các hạng phòng HTML
    rooms_table_rows = ''
    for cat_id, info in category_groups.items():
        room_nums_text = f" (Phòng: {', '.join(info['room_numbers'])})" if info['room_numbers'] else " (Sắp xếp phòng khi Check-in)"
        rooms_table_rows += f"""
        <tr>
            <td style="padding: 10px 12px; border-bottom: 1px dashed #E2E8F0; font-size: 13px; color: #1E293B;">
                <strong>{info['name']}</strong>
                <div style="font-size: 12px; color: #64748B; margin-top: 2px;">{room_nums_text}</div>
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px dashed #E2E8F0; text-align: center; font-size: 13px; color: #0F172A; font-weight: bold;">
                {info['count']} phòng
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px dashed #E2E8F0; text-align: right; font-size: 13px; color: #0F172A; font-weight: 600;">
                {info['subtotal']:,.0f} VNĐ
            </td>
        </tr>
        """

    # 4. Doanh nghiệp đối tác & Chiết khấu Corporate
    corp = group_booking.corporate_partner
    corp_info_html = ''
    corp_discount_display = ''
    if corp:
        corp_info_html = f"""
        <div style="margin-top: 14px; background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 12px 16px;">
            <div style="font-size: 12px; color: #166534; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                🤝 ĐỐI TÁC DOANH NGHIỆP: {corp.company_name}
            </div>
            <div style="font-size: 13px; color: #15803D; margin-top: 4px;">
                Mã HĐ / Ưu đãi: <strong>#{corp.corporate_code}</strong> | Chiết khấu theo hợp đồng: <strong>{corp.discount_percent}%</strong>
            </div>
        </div>
        """
        corp_discount_display = f"""
        <tr>
            <td style="padding: 10px 12px; border-bottom: 1px dashed #E2E8F0; font-size: 13px; color: #16A34A; font-weight: 600;">
                🏷️ Chiết khấu Doanh nghiệp ({corp.discount_percent}%)
            </td>
            <td colspan="2" style="padding: 10px 12px; border-bottom: 1px dashed #E2E8F0; text-align: right; font-size: 13px; color: #16A34A; font-weight: bold;">
                Đã áp dụng theo hợp đồng
            </td>
        </tr>
        """

    # 5. Thông tin Hóa đơn VAT Công ty
    master_inv = getattr(group_booking, 'master_invoice', None)
    vat_company_name = (master_inv.company_name if master_inv and master_inv.company_name else None) or (corp.company_name if corp else None)
    vat_tax_code = (master_inv.company_tax_code if master_inv and master_inv.company_tax_code else None) or (corp.tax_code if corp else None)
    vat_address = (master_inv.company_address if master_inv and master_inv.company_address else None) or (corp.company_address if corp else None)
    vat_email = (master_inv.invoice_recipient_email if master_inv and master_inv.invoice_recipient_email else None) or (corp.contact_email if corp else group_booking.leader_email)

    vat_box_html = ''
    if vat_company_name or vat_tax_code or (master_inv and master_inv.is_company_invoice):
        vat_box_html = f"""
        <div style="background-color: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; padding: 14px 18px; margin-top: 18px;">
            <p style="margin: 0 0 8px 0; color: #1E293B; font-weight: bold; font-size: 14px;">🏢 THÔNG TIN XUẤT HÓA ĐƠN GTGT (VAT) DOANH NGHIỆP</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #475569;">
                <tr>
                    <td style="padding: 4px 0; width: 35%; font-weight: 600;">Tên Doanh nghiệp:</td>
                    <td style="padding: 4px 0; color: #0F172A; font-weight: bold;">{vat_company_name or 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Mã số thuế (MST):</td>
                    <td style="padding: 4px 0; color: #0F172A; font-family: monospace; font-size: 14px; font-weight: bold;">{vat_tax_code or 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Địa chỉ công ty:</td>
                    <td style="padding: 4px 0; color: #0F172A;">{vat_address or 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Email nhận HĐĐT:</td>
                    <td style="padding: 4px 0; color: #2563EB; font-weight: 600;">{vat_email or 'N/A'}</td>
                </tr>
            </table>
        </div>
        """

    # 6. Khung Trạng Thái Thanh Toán (Xanh lá nếu ĐÃ CỌC/ĐÃ TT - Cam nếu CHỜ CỌC)
    if is_deposit_paid:
        status_badge_title = "XÁC NHẬN ĐÃ THANH TOÁN 100% TOÀN BỘ ĐƠN ĐOÀN" if is_full_paid else "XÁC NHẬN ĐÃ THANH TOÁN TIỀN CỌC THÀNH CÔNG"
        status_sub_msg = (
            f"Hệ thống đã ghi nhận thanh toán hoàn tất 100% cho hợp đồng đoàn <strong>#{group_booking.group_code}</strong>. Phòng đã được bảo đảm tuyệt đối."
            if is_full_paid else
            f"Khách sạn đã nhận được số tiền đặt cọc quy định cho đoàn <strong>#{group_booking.group_code}</strong>. Các phòng đã được khóa và xác nhận trên hệ thống PMS."
        )
        payment_box_html = f"""
        <div style="background-color: #ECFDF5; border: 2px solid #10B981; border-radius: 12px; padding: 22px 18px; margin: 24px 0; text-align: center;">
            <div style="display: inline-block; background-color: #10B981; color: #FFFFFF; font-size: 12px; font-weight: 800; letter-spacing: 1px; padding: 4px 14px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 10px;">
                TRẠNG THÁI HỢP ĐỒNG ĐOÀN
            </div>
            <h2 style="margin: 6px 0; color: #065F46; font-size: 20px; font-weight: 800;">
                ✅ {status_badge_title}
            </h2>
            <p style="margin: 8px 0 16px 0; color: #047857; font-size: 14px; line-height: 1.5;">
                {status_sub_msg}
            </p>
            <div style="background: #FFFFFF; border-radius: 8px; padding: 14px 20px; display: inline-block; min-width: 320px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr>
                        <td style="text-align: left; color: #64748B; padding: 5px 0;">Tổng giá trị hợp đồng đoàn:</td>
                        <td style="text-align: right; color: #0F172A; font-weight: bold; font-size: 15px; padding: 5px 0;">{total_amount:,.0f} VNĐ</td>
                    </tr>
                    <tr>
                        <td style="text-align: left; color: #64748B; padding: 5px 0; border-top: 1px dashed #E2E8F0;">Số tiền đã thanh toán (Tiền cọc):</td>
                        <td style="text-align: right; color: #065F46; font-weight: 800; font-size: 16px; padding: 5px 0; border-top: 1px dashed #E2E8F0;">{deposit_amount:,.0f} VNĐ</td>
                    </tr>
                    <tr>
                        <td style="text-align: left; color: #64748B; padding: 5px 0; border-top: 1px dashed #E2E8F0;">Số tiền còn lại khi Check-in:</td>
                        <td style="text-align: right; color: {'#10B981' if remaining_balance == 0 else '#B45309'}; font-weight: 800; font-size: 15px; padding: 5px 0; border-top: 1px dashed #E2E8F0;">
                            {remaining_balance:,.0f} VNĐ
                        </td>
                    </tr>
                </table>
            </div>
        </div>
        """
    else:
        # Tạo mã QR VietQR cọc nếu chưa thanh toán
        try:
            from ..payments.models import PaymentConfig
            payment_cfg = PaymentConfig.get_solo()
            bank_bin = payment_cfg.bank_bin or '970422'
            account_no = payment_cfg.account_no or '123456789'
            account_name = payment_cfg.account_name or 'KHACH SAN TA DA NANG'
        except Exception:
            bank_bin = '970422'
            account_no = '123456789'
            account_name = 'KHACH SAN TA DA NANG'

        qr_note = f"Coc doan {group_booking.group_code}"
        enc_note = urllib.parse.quote(qr_note)
        enc_acc = urllib.parse.quote(account_name)
        deposit_amt_int = int(deposit_amount)
        vietqr_url = f"https://img.vietqr.io/image/{bank_bin}-{account_no}-compact2.jpg?amount={deposit_amt_int}&addInfo={enc_note}&accountName={enc_acc}"

        payment_box_html = f"""
        <div style="background-color: #FFFBEB; border: 2px solid #F59E0B; border-radius: 12px; padding: 22px 18px; margin: 24px 0; text-align: center;">
            <div style="display: inline-block; background-color: #F59E0B; color: #FFFFFF; font-size: 12px; font-weight: 800; letter-spacing: 1px; padding: 4px 14px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 10px;">
                TRẠNG THÁI HỢP ĐỒNG ĐOÀN
            </div>
            <h2 style="margin: 6px 0; color: #92400E; font-size: 20px; font-weight: 800;">
                ⏳ ĐƠN ĐẶT ĐOÀN ĐANG CHỜ THANH TOÁN CỌC
            </h2>
            <p style="margin: 6px 0 16px 0; color: #B45309; font-size: 14px;">
                Số tiền đặt cọc quy định: <strong style="color: #92400E; font-size: 18px;">{deposit_amount:,.0f} VNĐ</strong> (Tổng hợp đồng: {total_amount:,.0f} VNĐ)
            </p>

            <!-- KHỐI QUÉT MÃ VIETQR CỌC ĐOÀN TỰ ĐỘNG -->
            <div style="background-color: #FFFFFF; border-radius: 12px; padding: 18px; display: inline-block; max-width: 320px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15); border: 1px solid #FDE68A;">
                <p style="margin: 0 0 10px 0; color: #1E293B; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
                    ⚡ Quét mã VietQR chuyển khoản cọc đoàn
                </p>
                <div style="background: #F8FAFC; padding: 8px; border-radius: 8px; display: inline-block; border: 1px solid #E2E8F0;">
                    <img src="{vietqr_url}" alt="Mã VietQR cọc đoàn #{group_booking.group_code}" style="width: 240px; height: auto; display: block; margin: 0 auto; border-radius: 6px;" />
                </div>
                <div style="margin-top: 12px; text-align: left; font-size: 12px; color: #475569; line-height: 1.6; background-color: #FFFDF5; padding: 10px; border-radius: 6px; border: 1px dashed #FCD34D;">
                    <div>• <strong>Nội dung CK:</strong> <span style="font-family: monospace; font-size: 13px; font-weight: bold; color: #B45309;">{qr_note}</span></div>
                    <div>• <strong>Số tiền cọc:</strong> <strong style="color: #0F172A;">{deposit_amount:,.0f} VNĐ</strong></div>
                    <div style="font-size: 11px; color: #78350F; margin-top: 4px;"><em>(Hệ thống tự động kích hoạt ĐÃ ĐẶT CỌC ngay khi nhận tiền chuyển khoản)</em></div>
                </div>
            </div>
        </div>
        """

    billing_policy_text = (
        "Công ty chi trả toàn bộ (Tiền phòng + Toàn bộ dịch vụ phát sinh)"
        if getattr(group_booking, 'billing_type', 'ROOM_ONLY') == 'ALL_INCLUSIVE' else
        "Công ty chỉ chi trả tiền phòng (Khách tự thanh toán dịch vụ phát sinh)"
    )

    # 7. Ghép nối HTML hoàn chỉnh
    html_template = f"""
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Xác nhận Đặt Phòng Theo Đoàn Doanh Nghiệp - {hotel_name}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B; -webkit-font-smoothing: antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F1F5F9; padding: 30px 10px;">
        <tr>
            <td align="center">
                <table width="650" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); max-width: 650px; width: 100%;">
                    
                    <!-- 1. HEADER LUXURY 5 SAO -->
                    <tr>
                        <td align="center" style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%); padding: 36px 24px 30px 24px; text-align: center; border-bottom: 3px solid #F59E0B;">
                            <div style="display: inline-block; padding: 8px 14px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 50px; margin-bottom: 12px;">
                                <span style="color: #FCD34D; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">
                                    ✦ KHÁCH HÀNG DOANH NGHIỆP & ĐẶT PHÒNG THEO ĐOÀN ✦
                                </span>
                            </div>
                            <h1 style="margin: 0; font-family: 'Playfair Display', 'Georgia', serif; font-size: 26px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">
                                <font color="#F59E0B">{hotel_name_upper}</font>
                            </h1>
                            <p style="margin: 6px 0 0 0; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; font-weight: 600;">
                                <font color="#FCD34D">{stars_display} &nbsp; {hotel_slogan_upper} &nbsp; {stars_display}</font>
                            </p>
                        </td>
                    </tr>

                    <!-- 2. NỘI DUNG CHÍNH -->
                    <tr>
                        <td style="padding: 32px 30px;">
                            
                            <!-- Lời chào Trưởng đoàn & Tên đoàn -->
                            <p style="margin: 0 0 12px 0; font-size: 16px; color: #334155;">
                                Kính gửi Quý đại diện: <strong style="color: #0F172A; font-size: 17px;">{group_booking.leader_name}</strong>,
                            </p>
                            <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                                {hotel_name} xin trân trọng gửi thư xác nhận đặt phòng theo đoàn công ty cho: <strong style="color: #2563EB;">{group_booking.group_name}</strong>. Cảm ơn Quý khách và Quý Doanh nghiệp đã tin tưởng lựa chọn dịch vụ lưu trú {stars} sao của chúng tôi.
                            </p>

                            <!-- Khung Trạng thái Đặt cọc / Thanh toán -->
                            {payment_box_html}

                            <!-- Thông tin chi tiết Đơn Đoàn -->
                            <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin-bottom: 22px;">
                                <h3 style="margin: 0 0 14px 0; font-size: 15px; color: #0F172A; border-bottom: 2px solid #E2E8F0; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                                    📋 THÔNG TIN ĐƠN ĐẶT ĐOÀN MASTER
                                </h3>
                                
                                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                    <tr>
                                        <td style="padding: 6px 0; width: 45%; color: #64748B;">Mã đơn đoàn:</td>
                                        <td style="padding: 6px 0; font-weight: 800; font-family: monospace; color: #2563EB; font-size: 15px;">
                                            #{group_booking.group_code}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748B;">Tên đoàn / Mục đích:</td>
                                        <td style="padding: 6px 0; font-weight: bold; color: #0F172A;">{group_booking.group_name}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748B;">Trưởng đoàn / Đại diện:</td>
                                        <td style="padding: 6px 0; color: #0F172A;">{group_booking.leader_name} ({group_booking.leader_phone})</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748B;">Thời gian lưu trú chung:</td>
                                        <td style="padding: 6px 0; font-weight: 600; color: #0F172A;">
                                            {check_in_str} <span style="color: #64748B;">({check_in_time})</span> ➔ {check_out_str} <span style="color: #64748B;">({check_out_time})</span>
                                            <span style="color: #2563EB; font-weight: bold;">({nights} đêm)</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748B;">Tổng quy mô phòng:</td>
                                        <td style="padding: 6px 0; font-weight: bold; color: #0F172A;">{total_rooms_count} phòng nghỉ cao cấp</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748B;">Chính sách phí phát sinh:</td>
                                        <td style="padding: 6px 0; color: #0F172A; font-weight: 600;">{billing_policy_text}</td>
                                    </tr>
                                </table>

                                {corp_info_html}
                            </div>

                            <!-- Bảng Danh Sách Phòng Theo Hạng (Multi-room Breakdown) -->
                            <div style="background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; margin-bottom: 22px;">
                                <div style="background-color: #F1F5F9; padding: 12px 16px; border-bottom: 1px solid #E2E8F0;">
                                    <h3 style="margin: 0; font-size: 14px; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px;">
                                        🏨 DANH SÁCH HẠNG PHÒNG ĐOÀN ĐÃ ĐẶT ({total_rooms_count} PHÒNG)
                                    </h3>
                                </div>
                                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                    <thead>
                                        <tr style="background-color: #F8FAFC; color: #64748B; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #E2E8F0;">
                                            <th style="padding: 8px 12px; text-align: left;">Hạng Phòng Nghỉ</th>
                                            <th style="padding: 8px 12px; text-align: center;">Số Lượng</th>
                                            <th style="padding: 8px 12px; text-align: right;">Thành Tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rooms_table_rows}
                                        {corp_discount_display}
                                        <tr style="background-color: #F8FAFC;">
                                            <td colspan="2" style="padding: 12px; font-weight: bold; font-size: 14px; color: #0F172A; text-align: right;">
                                                TỔNG GIÁ TRỊ HỢP ĐỒNG ĐOÀN:
                                            </td>
                                            <td style="padding: 12px; font-weight: 800; font-size: 16px; color: #2563EB; text-align: right;">
                                                {total_amount:,.0f} VNĐ
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <!-- Thông tin hóa đơn VAT Doanh nghiệp nếu có -->
                            {vat_box_html}

                            <!-- Lời nhắc nhận phòng & Điều khoản đoàn -->
                            <div style="background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 14px 16px; border-radius: 4px; margin-top: 24px; font-size: 13px; color: #1E40AF; line-height: 1.6;">
                                <strong>📌 LƯU Ý DÀNH CHO TRƯỞNG ĐOÀN:</strong>
                                <ul style="margin: 6px 0 0 0; padding-left: 18px;">
                                    <li>Trưởng đoàn có thể cập nhật danh sách khách lưu trú (Rooming List) và CCCD từng phòng trực tiếp trên hệ thống hoặc gửi danh sách qua email bộ phận Lễ tân.</li>
                                    <li>Giờ nhận phòng tiêu chuẩn: <strong>{check_in_time}</strong> | Giờ trả phòng: <strong>{check_out_time}</strong>.</li>
                                    <li>Đối với trường hợp trả phòng trễ hoặc nhận phòng sớm theo đoàn, vui lòng báo trước Hotline Lễ tân để sắp xếp quỹ phòng tốt nhất.</li>
                                </ul>
                            </div>

                        </td>
                    </tr>

                    <!-- 3. FOOTER LIÊN HỆ 5 SAO -->
                    <tr>
                        <td style="background-color: #0F172A; color: #94A3B8; padding: 26px 30px; text-align: center; font-size: 12px; line-height: 1.6; border-top: 1px solid #1E293B;">
                            <div style="color: #F59E0B; font-size: 15px; font-weight: bold; margin-bottom: 6px; letter-spacing: 1px;">
                                {hotel_name_upper}
                            </div>
                            <div style="color: #CBD5E1; margin-bottom: 4px;">
                                📍 Địa chỉ: {hotel_address}
                            </div>
                            <div style="color: #CBD5E1; margin-bottom: 12px;">
                                ☎ Hotline Khách Đoàn & Sự kiện: <strong>{hotel_hotline}</strong> | ✉ Email: <strong>{hotel_email}</strong>
                            </div>
                            <div style="font-size: 11px; color: #64748B; border-top: 1px solid #1E293B; padding-top: 12px;">
                                © 2026 {hotel_name}. Mọi quyền được bảo lưu. Email này được gửi tự động từ hệ thống quản lý khách sạn PMS.
                            </div>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    """
    return html_template


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
        from .models import GroupBooking
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
        from .models import HotelSetting
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

