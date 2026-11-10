"""Dựng HTML email đơn đặt phòng đoàn."""
import urllib.parse
import logging
from decimal import Decimal

logger = logging.getLogger(__name__)


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
    from ..models import HotelSetting
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
                ĐỐI TÁC DOANH NGHIỆP: {corp.company_name}
            </div>
            <div style="font-size: 13px; color: #15803D; margin-top: 4px;">
                Mã HĐ / Ưu đãi: <strong>#{corp.corporate_code}</strong> | Chiết khấu theo hợp đồng: <strong>{corp.discount_percent}%</strong>
            </div>
        </div>
        """
        corp_discount_display = f"""
        <tr>
            <td style="padding: 10px 12px; border-bottom: 1px dashed #E2E8F0; font-size: 13px; color: #16A34A; font-weight: 600;">
                Chiết khấu Doanh nghiệp ({corp.discount_percent}%)
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
            <p style="margin: 0 0 8px 0; color: #1E293B; font-weight: bold; font-size: 14px;">THÔNG TIN XUẤT HÓA ĐƠN GTGT (VAT) DOANH NGHIỆP</p>
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
                {status_badge_title}
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
            from ...payments.models import PaymentConfig
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
                    Quét mã VietQR chuyển khoản cọc đoàn
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
                                    THÔNG TIN ĐƠN ĐẶT ĐOÀN MASTER
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
                                        DANH SÁCH HẠNG PHÒNG ĐOÀN ĐÃ ĐẶT ({total_rooms_count} PHÒNG)
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
                                <strong>LƯU Ý DÀNH CHO TRƯỞNG ĐOÀN:</strong>
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
                                Địa chỉ: {hotel_address}
                            </div>
                            <div style="color: #CBD5E1; margin-bottom: 12px;">
                                Hotline Khách Đoàn & Sự kiện: <strong>{hotel_hotline}</strong> | Email: <strong>{hotel_email}</strong>
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
