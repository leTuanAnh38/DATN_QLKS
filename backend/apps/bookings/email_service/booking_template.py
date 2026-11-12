"""Dựng HTML email đơn đặt phòng."""
import urllib.parse
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)


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
    from ..models import HotelSetting
    try:
        hotel_settings = HotelSetting.get_settings()
        hotel_stars = getattr(hotel_settings, 'stars', 3) or 3
        hotel_name = hotel_settings.hotel_name or 'Khách Sạn TA Đà Nẵng'
        hotel_slogan = hotel_settings.hotel_slogan or f'{hotel_stars}-Star Luxury Resort & Hotel'
        if hotel_slogan and hotel_stars:
            import re
            hotel_slogan = re.sub(r'\b\d+[- ]*(?:Star|star)\b', f"{hotel_stars}-Star", hotel_slogan)
        hotel_address = hotel_settings.address or '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Quận Ngũ Hành Sơn, TP. Đà Nẵng'
        hotel_hotline = hotel_settings.hotline or '1900 8899'
        hotel_phone = hotel_settings.phone_number or '0236 388 9999'
        hotel_email = hotel_settings.email or 'contact@tahotel.vn'
        check_in_time = hotel_settings.check_in_time or '14:00'
        check_out_time = hotel_settings.check_out_time or '12:00'
    except Exception:
        hotel_stars = 3
        hotel_name = 'Khách Sạn TA Đà Nẵng'
        hotel_slogan = '3-Star Luxury Resort & Hotel'
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
            # Bỏ qua các tiện ích dọn phòng miễn phí (0đ / Make-up Room) khỏi hóa đơn email
            if tot == 0 and unit_price == 0 and ('make-up' in svc_name.lower() or 'dọn dẹp' in svc_name.lower() or 'dọn phòng' in svc_name.lower()):
                continue

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
            from ...payments.models import PaymentConfig
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
            <p style="margin: 0 0 8px 0; color: #1E293B; font-weight: bold; font-size: 14px;">THÔNG TIN HÓA ĐƠN DOANH NGHIỆP (VAT)</p>
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
                Ưu đãi Hạng Thành viên VIP
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
                {coupon_label}
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
                ĐÃ THANH TOÁN THÀNH CÔNG
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
                    Quét mã VietQR chuyển khoản tức thì
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
                <em>Nếu đã chọn thanh toán tiền mặt tại quầy lễ tân khi nhận phòng, quý khách có thể bỏ qua mã QR này.</em>
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
                                    Địa chỉ: {hotel_address}<br/>
                                    Hotline: <strong style="color: #FBBF24 !important;"><font color="#FBBF24">{hotel_hotline}</font></strong> | Email: <strong style="color: #FBBF24 !important;"><font color="#FBBF24">{hotel_email}</font></strong>
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
                                        Chi tiết đặt phòng
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
                                        Bảng kê chi phí &amp; Thanh toán
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
                                <p style="margin: 0 0 6px 0; color: #1E293B; font-weight: bold; font-size: 13px;">QUY ĐỊNH NHẬN PHÒNG &amp; LƯU Ý QUAN TRỌNG:</p>
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
