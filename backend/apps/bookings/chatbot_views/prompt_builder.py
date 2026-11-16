"""Dựng system prompt cho Gemini."""
import logging


logger = logging.getLogger(__name__)


def generate_system_prompt(
    hotel_context,
    housekeeping_action=None,
    maintenance_action=None,
    pending_action=None,
    lost_found_action=None,
    cancel_eligibility=None,
    price_estimate=None,
):
    """
    Sinh System Prompt chuẩn mực cho AI Gemini:
    Đóng vai Trợ lý ảo Lễ tân & Concierge cao cấp của khách sạn,
    nắm rõ lịch phòng trống thực tế theo ngày khách hỏi, thông tin lưu trú CHECKED_IN,
    hóa đơn tạm tính chuẩn xác, chính sách vận hành từ HotelSetting, hạng hội viên MembershipTier,
    trạng thái đồ ăn và cẩm nang du lịch Đà Nẵng.
    """
    h_info = hotel_context['hotel_info']
    stars = h_info.get('stars', 5) or 5
    policies = hotel_context.get('policies', {})
    d_info = hotel_context.get('queried_dates', {})
    date_range_str = f"Nhận phòng {d_info.get('check_in_display')} - Trả phòng {d_info.get('check_out_display')} ({d_info.get('nights', 1)} đêm)"
    guest_count = hotel_context.get('guest_count')
    guest_note = f" | Số khách yêu cầu: {guest_count} khách" if guest_count else ""

    # 1. Chuỗi phòng kèm lịch trống thực tế & tiện nghi chi tiết
    room_lines = []
    for r in hotel_context['rooms']:
        price_text = f"Giá gốc: {r['base_price_formatted']}"
        if r.get('promo_price_formatted'):
            price_text += f" (Giá ưu đãi: {r['promo_price_formatted']})"
        avail = f"Còn {r['available_count']}/{r['total_count']} phòng trống" if r['available_count'] > 0 else "HẾT PHÒNG trong khoảng ngày này"
        cancel_txt = f" | Chính sách hủy: {r['cancellation_policy']}" if r.get('cancellation_policy') else ""
        room_lines.append(
            f"- {r['name']} (Diện tích: {r['size']}m² | Sức chứa: {r['capacity']} khách | Giường: {r['bed_type']}):\n"
            f"  + {price_text} | Tình trạng ({date_range_str}): {avail}\n"
            f"  + Tiện nghi & Đặc điểm: {r['all_amenities']} | {r['description']}{cancel_txt}"
        )
    rooms_text = "\n".join(room_lines) if room_lines else "Tất cả các hạng phòng đang được phục vụ."

    # 2. Chuỗi dịch vụ (nạp tối đa 40 dịch vụ đang kích hoạt)
    svc_lines = []
    for s in hotel_context['services'][:40]:
        svc_lines.append(f"- [{s['category']}] {s['name']}: {s['price_formatted']} ({s['description']})")
    services_text = "\n".join(svc_lines) if svc_lines else "Phục vụ 24/7 ẩm thực, spa, tiện ích khách sạn."

    # 3. Chuỗi khuyến mãi & Hạng thẻ hội viên từ DB
    promo_lines = []
    for p in hotel_context['promotions']:
        rem_txt = f" | Còn {p['remaining_uses']} lượt" if p.get('remaining_uses') is not None else ""
        promo_lines.append(f"- Mã `{p['code']}` ({p['name']}): Giảm {p['discount']} (Đơn tối thiểu: {p['min_order']}{rem_txt})")
    promos_text = "\n".join(promo_lines) if promo_lines else "Hiện chưa có mã khuyến mãi công khai; áp dụng ưu đãi trực tiếp theo hạng thẻ hội viên."

    tier_lines = []
    for t in hotel_context.get('membership_tiers', []):
        tier_lines.append(f"- {t['name']} (từ {t['min_points']} điểm): Giảm {t['discount']} — {t['benefit']}")
    tiers_text = "\n".join(tier_lines)

    # 4. Cẩm nang Du lịch Đà Nẵng & Tin tức / Đánh giá
    guide_lines = []
    for g in hotel_context.get('danang_guide', []):
        guide_lines.append(f"- {g['name']} ({g['distance']}): {g['highlight']}")
    guide_text = "\n".join(guide_lines)

    posts_text = ""
    if hotel_context.get('recent_posts'):
        post_lines = [f"- [{p['category']}] {p['title']}: {p['summary']}" for p in hotel_context['recent_posts']]
        posts_text = "\nTIN TỨC & SỰ KIỆN MỚI:\n" + "\n".join(post_lines)

    reviews_text = ""
    if hotel_context.get('reviews_summary'):
        rv = hotel_context['reviews_summary']
        reviews_text = f"\nĐÁNH GIÁ KHÁCH HÀNG THỰC TẾ: {rv['average_rating']}/5.0 sao (từ {rv['count']} đánh giá đã xác thực)."

    # 5. Chuỗi cá nhân hóa & Trợ lý khách đang lưu trú (CHECKED_IN Concierge)
    user_str = "Khách hàng hiện tại: Khách vãng lai (Chưa đăng nhập)."
    if hotel_context.get('user_context'):
        u = hotel_context['user_context']
        bks_str = ""
        for b in u['recent_bookings']:
            bks_str += f"\n  + Mã đơn: #{b['code']} | Phòng: {b['room']} ({b['category_name']}) | Nhận: {b['check_in']} - Trả: {b['check_out']} | Trạng thái: {b['status']} | Tiền phòng: {b['total_amount']} ({b['is_paid']})"

        active_stay_str = ""
        if u.get('active_stay'):
            st = u['active_stay']
            extra_str = ", ".join([f"{ex['name']} x{ex['quantity']} ({ex['total_formatted']})" for ex in st['extra_items']]) or "Chưa phát sinh"
            orders_str = "\n".join([
                f"    * Món/Dịch vụ: {sr['service_name']} x{sr['quantity']} ({sr['total_formatted']}) -> Trạng thái: {sr['status_label']} (Đặt lúc {sr['created_time']})"
                for sr in st['service_orders']
            ]) or "    * Hiện chưa có đơn gọi món/dịch vụ nào."
            active_stay_str = (
                f"\n[ĐẶC QUYỀN KHÁCH ĐANG LƯU TRÚ (IN-HOUSE GUEST CONCIERGE)]:\n"
                f"- Phòng đang ở: Phòng {st['room_number']} (Tầng {st['floor']} - {st['category_name']}) | Mã đơn: #{st['booking_code']}\n"
                f"- Wifi riêng tốc độ cao: Tên mạng `{st['wifi_ssid']}` | Mật khẩu: `{st['wifi_pass']}`\n"
                f"- HÓA ĐƠN TẠM TÍNH HIỆN TẠI (PROVISIONAL FOLIO):\n"
                f"  + Tiền phòng thuần ({st['check_in_date']} - {st['check_out_date']}): {st['room_total_formatted']}\n"
                f"  + Phụ phí & Minibar thủ công: {st['extra_total_formatted']} ({extra_str})\n"
                f"  + Dịch vụ gọi thêm tại phòng (F&B/Spa/Xe): {st['service_total_formatted']}\n"
                f"  + TỔNG HÓA ĐƠN TẠM TÍNH: {st['grand_total_formatted']} | Đã thanh toán: {st.get('paid_total_formatted', '0 đ')} | Còn cần thanh toán: {st['unpaid_additional_formatted']}\n"
                f"- TIẾN TRÌNH ĐƠN ĐỒ ĂN / DỊCH VỤ VỪA ĐẶT:\n{orders_str}"
            )

        user_str = (
            f"Thông tin Khách hàng đang trò chuyện:\n"
            f"- Họ tên: {u['full_name']} (Tài khoản: {u['username']} | SĐT: {u['phone']})\n"
            f"- Hạng thẻ hội viên: {u['vip_tier']} (Ưu đãi giảm giá: {u['discount_rate']}) | Điểm tích lũy: {u['loyalty_points']} điểm\n"
            f"- Đơn đặt phòng gần nhất:{bks_str if bks_str else ' Chưa có đơn đặt phòng nào.'}"
            f"{active_stay_str}"
        )

    hk_str = ""
    if housekeeping_action:
        if housekeeping_action.get('requires_auth'):
            hk_str = (
                "\n[BẢO MẬT YÊU CẦU BUỒNG PHÒNG]: Khách vừa yêu cầu dọn phòng/buồng phòng nhưng CHƯA đăng nhập hoặc chưa xác thực chủ phòng. "
                "KHÔNG được xác nhận đã gửi nhân viên. Hãy lịch sự mời Quý khách đăng nhập tài khoản đã đặt phòng, hoặc nhắn kèm Mã đơn (VD: `BK-XXXXXX`) và Số điện thoại đặt phòng để hệ thống xác thực và điều phối nhân viên ngay, hoặc bấm phím `0` trên điện thoại bàn trong phòng."
            )
        else:
            hk_str = (
                f"\n[HÀNH ĐỘNG TỰ ĐỘNG VỪA KÍCH HOẠT]: Hệ thống đã tự động gửi phiếu yêu cầu dọn phòng/buồng phòng khẩn cấp "
                f"cho Phòng {housekeeping_action['room_number']} (#{housekeeping_action['booking_code']}) tới bộ phận Housekeeping. "
                f"Hãy xác nhận ngay với Quý khách rằng nhân viên buồng phòng sẽ có mặt trong 5-10 phút tới!"
            )

    lookup_hint_str = ""
    if hotel_context.get('lookup_verification_hint'):
        hint = hotel_context['lookup_verification_hint']
        if hint.get('reason') == 'ownership_mismatch':
            lookup_hint_str = (
                "\n[CẢNH BÁO BẢO MẬT TRA CỨU ĐƠN]: Khách đang hỏi thông tin một mã đơn không thuộc tài khoản đang đăng nhập và chưa cung cấp SĐT khớp với chủ đơn. "
                "TUYỆT ĐỐI KHÔNG tiết lộ thông tin đơn này. Hãy lịch sự giải thích vì lý do bảo mật thông tin khách hàng, vui lòng đăng nhập đúng tài khoản đặt đơn hoặc cung cấp kèm Số điện thoại đặt phòng."
            )
        else:
            lookup_hint_str = (
                "\n[YÊU CẦU XÁC THỰC TRA CỨU ĐƠN]: Khách chưa đăng nhập và mới chỉ cung cấp mã đơn hoặc SĐT đơn lẻ. "
                "Vì bảo mật thông tin riêng tư, hãy hướng dẫn Quý khách **đăng nhập tài khoản** HOẶC nhập đồng thời **cả Mã đơn (BK-... / GRP-...) và Số điện thoại đặt phòng** trong cùng 1 tin nhắn để hệ thống tra cứu ngay."
            )

    promo_check_str = ""
    qp = hotel_context.get('queried_promo')
    if qp:
        if qp.get('valid'):
            promo_check_str = (
                f"\n[KIỂM TRA MÃ KHUYẾN MÃI]: Mã `{qp['code']}` ĐANG HỢP LỆ "
                f"(Giảm {qp['discount']}, đơn tối thiểu {qp['min_order']}). Hãy xác nhận cho khách."
            )
        else:
            promo_check_str = (
                f"\n[KIỂM TRA MÃ KHUYẾN MÃI]: Mã `{qp['code']}` KHÔNG HỢP LỆ (Lý do: `{qp['status']}`). "
                "TUYỆT ĐỐI không nói mã này áp dụng được; hãy giải thích đúng lý do (hết hạn / tạm khóa / hết lượt / không tồn tại) và gợi ý các mã đang hoạt động ở trên."
            )

    maint_str = ""
    if maintenance_action:
        if maintenance_action.get('requires_auth'):
            maint_str = (
                "\n[BẢO MẬT BÁO HỎNG KỸ THUẬT]: Khách báo hỏng thiết bị nhưng chưa xác thực tài khoản/phòng đang lưu trú. "
                "KHÔNG được xác nhận đã tạo phiếu kỹ thuật. Mời khách đăng nhập hoặc nhắn `BK-... + SĐT` để lập phiếu ngay."
            )
        else:
            maint_str = (
                f"\n[PHIẾU BẢO TRÌ ĐÃ LẬP]: Hệ thống vừa tạo phiếu `{maintenance_action.get('ticket_code')}` "
                f"cho Phòng {maintenance_action['room_number']} ({maintenance_action['equipment_name']}, mức `{maintenance_action['priority']}`) "
                "và thông báo cho Kỹ thuật viên. Hãy xác nhận mã phiếu và báo kỹ thuật viên sẽ lên hỗ trợ trong 10 phút."
            )

    pending_str = ""
    if pending_action:
        p_type = pending_action.get('type')
        if p_type == 'create_service_request_auth_required':
            pending_str = (
                f"\n[XÁC THỰC ĐẶT DỊCH VỤ PHÒNG]: Khách muốn đặt `{pending_action.get('service_name')}` nhưng chưa đăng nhập hoặc chưa xác thực đơn `checked_in`. "
                "Hãy mời khách đăng nhập hoặc cung cấp `BK-... + SĐT`."
            )
        elif p_type == 'create_service_request':
            pending_str = (
                f"\n[CHỜ XÁC NHẬN ĐẶT DỊCH VỤ]: Hệ thống đã chuẩn bị thẻ xác nhận cho **{pending_action['service_name']}** x{pending_action['quantity']} "
                f"(Tổng: {pending_action['total_formatted']}) giao tới Phòng {pending_action['room_number']}. "
                "Mời khách bấm nút **Xác nhận đặt ngay** trên thẻ hiển thị bên dưới để hoàn tất đơn."
            )
        elif p_type == 'human_handoff':
            pending_str = (
                "\n[CHUYỂN TIẾP NHÂN VIÊN]: Khách muốn trao đổi trực tiếp với nhân viên/khiếu nại. "
                "Hãy xin lỗi/trấn an lịch sự và mời khách điền hoặc bấm nút **Gửi yêu cầu tới Lễ tân** trên thẻ bên dưới (hoặc gọi Hotline)."
            )

    lost_found_str = ""
    if lost_found_action:
        if lost_found_action.get('requires_auth'):
            lost_found_str = (
                "\n[BẢO MẬT ĐỒ THẤT LẠC (LOST & FOUND)]: Khách vừa hỏi tìm hoặc báo quên đồ nhưng chưa xác thực tài khoản/mã đơn. "
                "TUYỆT ĐỐI KHÔNG tiết lộ đồ thất lạc của phòng nào. Hãy mời khách đăng nhập hoặc nhắn kèm `BK-... + SĐT` để kiểm tra kho đồ thất lạc ngay."
            )
        else:
            items = lost_found_action.get('matched_items') or []
            if items:
                item_desc = "; ".join([
                    f"{it['tracking_code']} - {it['item_name']} (Vị trí: {it['location_found']}, Cất giữ: {it['storage_location']}, Trạng thái: {it['status_label']})"
                    for it in items
                ])
                lost_found_str = (
                    f"\n[KHO ĐỒ THẤT LẠC ĐÃ TÌM THẤY (Đơn #{lost_found_action['booking_code']} - P.{lost_found_action['room_number']})]: "
                    f"{item_desc}. Đã đồng thời gửi thông báo tới Lễ tân & Buồng phòng. Hãy báo tin vui và hướng dẫn khách liên hệ Quầy Lễ tân hoặc Hotline nhận lại đồ."
                )
            else:
                lost_found_str = (
                    f"\n[ĐÃ BÁO TÌM ĐỒ THẤT LẠC (Đơn #{lost_found_action['booking_code']} - P.{lost_found_action['room_number']})]: "
                    "Hệ thống chưa thấy vật phẩm ghi nhận sẵn trong kho nhưng đã gửi thông báo khẩn tới Buồng phòng & Lễ tân kiểm tra lại phòng ngay. Hãy trấn an khách và hẹn phản hồi sớm."
                )

    cancel_elig_str = ""
    if cancel_eligibility:
        ce = cancel_eligibility
        if not ce.get('can_cancel'):
            cancel_elig_str = (
                f"\n[ĐIỀU KIỆN HỦY ĐƠN #{ce['booking_code']}]: Đơn hiện có trạng thái `{ce['status']}` (`{ce['reason']}`) "
                "nên không thể tự hủy online. Hãy giải thích lịch sự và mời khách liên hệ Lễ tân nếu cần hỗ trợ đặc biệt."
            )
        elif ce.get('is_free_cancel_eligible'):
            cancel_elig_str = (
                f"\n[ĐIỀU KIỆN HỦY ĐƠN #{ce['booking_code']}]: Nhận phòng `{ce['check_in_date']}` (còn khoảng **{ce['hours_until_checkin']} giờ**). "
                f"Đủ điều kiện **HỦY MIỄN PHÍ** (trước mốc {ce['free_hours']} giờ). Hãy hướng dẫn khách vào `/booking-history` (hoặc `/corporate-booking` nếu đơn đoàn) để thao tác."
            )
        else:
            cancel_elig_str = (
                f"\n[ĐIỀU KIỆN HỦY ĐƠN #{ce['booking_code']}]: Nhận phòng `{ce['check_in_date']}` (chỉ còn **{ce['hours_until_checkin']} giờ**, "
                f"đã quá mốc miễn phí {ce['free_hours']} giờ). Hãy thông báo rõ quy định và mời khách liên hệ Lễ tân {h_info['hotline']} để được hỗ trợ đổi ngày/giải quyết."
            )

    price_est_str = ""
    if price_estimate:
        pe = price_estimate
        disc_parts = []
        if pe.get('membership_discount_formatted'):
            disc_parts.append(f"Hội viên {pe['tier_name']} (-{pe['membership_discount_formatted']})")
        if pe.get('promo_discount_formatted'):
            disc_parts.append(f"Mã `{pe['promo_code']}` (-{pe['promo_discount_formatted']})")
        elif pe.get('promo_min_unmet'):
            disc_parts.append(f"Mã `{pe['promo_code']}` chưa đủ đơn tối thiểu {pe['promo_min_order_formatted']}")
        disc_txt = " | ".join(disc_parts) if disc_parts else "Chưa áp dụng giảm giá"
        price_est_str = (
            f"\n[ƯỚC TÍNH TỔNG TIỀN ĐẶT PHÒNG CHÍNH XÁC]: Hạng **{pe['room_name']}** ({pe['check_in_display']} -> {pe['check_out_display']}, {pe['nights']} đêm):\n"
            f"- Đơn giá: {pe['unit_price_formatted']}/đêm | Tạm tính: {pe['subtotal_formatted']}\n"
            f"- Giảm giá: {disc_txt}\n"
            f"- **TỔNG THANH TOÁN DỰ KIẾN**: **{pe['final_total_formatted']}** ({pe['vat_note']}). Hãy trình bày bảng tính rõ ràng cho khách."
        )

    shuttle_note = (
        "\n* Lưu ý: Khi tư vấn lịch trình tham quan hoặc sân bay, hãy giới thiệu dịch vụ xe đưa đón VIP của khách sạn ở thẻ dịch vụ bên dưới."
        if hotel_context.get('has_shuttle_service')
        else ""
    )

    system_prompt = f"""Bạn là Trợ lý ảo AI Concierge {stars} sao cao cấp của {h_info['name']}.
NGUYÊN TẮC GIAO TIẾP & BẢO MẬT:
1. Luôn xưng "Em" và gọi người dùng là "Quý khách" (hoặc tên khách nếu đã đăng nhập).
2. Giọng điệu thượng lưu, lễ phép, ấm áp, tinh tế chuẩn khách sạn nghỉ dưỡng {stars} sao quốc tế.
3. Trình bày câu trả lời rõ ràng bằng Markdown: dùng **in đậm** cho giá tiền/tên phòng, gạch đầu dòng `•`, hoặc lập Bảng Markdown (`| Hạng phòng | Giá/đêm | Phòng trống |`) khi so sánh nhiều phòng.
4. TUYỆT ĐỐI CHỈ dựa vào số liệu thực tế từ hệ thống bên dưới, không tự bịa đặt giá, số phòng trống, mã đơn hay thông tin đặt phòng.
5. Nếu khách yêu cầu thao tác chưa hỗ trợ trực tiếp (ví dụ đổi ngày/hủy đơn/đặt món trực tiếp trong chat), hãy hướng dẫn rõ ràng vào trang Lịch sử đặt phòng (`/booking-history`) hoặc Menu Dịch vụ (`/services`) hoặc gọi Hotline {h_info['hotline']}.

QUY TẮC ĐA NGÔN NGỮ & QUY ĐỔI TỶ GIÁ:
- Tự động trả lời bằng đúng ngôn ngữ khách dùng (Việt / Anh / Hàn / Trung).
- Với khách quốc tế, luôn hiển thị giá gốc VND kèm quy đổi tương đương (~$USD, ~₩KRW, ~¥CNY).

THÔNG TIN KHÁCH SẠN & CHÍNH SÁCH VẬN HÀNH:
- Tên: {h_info['name']} | Địa chỉ: {h_info['address']}
- Hotline Lễ tân & Concierge 24/7: {h_info['hotline']} | ĐT: {h_info['phone']} | Email: {h_info['email']}
- Giờ Check-in: từ {h_info['check_in']} | Giờ Check-out: trước {h_info['check_out']}
- Thuế VAT: {h_info['vat']} | Phí dịch vụ: {h_info['service_charge']}
- Chính sách hủy phòng miễn phí: trước {policies.get('cancellation_free_hours', 48)} giờ | Thời gian giữ đơn chờ thanh toán online: {policies.get('auto_cancel_minutes', 30)} phút | Cọc đặt đoàn: {policies.get('group_deposit_percent', 50)}%
- Phụ thu Check-in sớm: trước 06:00 ({policies.get('early_checkin_before_6am', 100)}%), 06:00–09:00 ({policies.get('early_checkin_6am_9am', 50)}%), 09:00–12:00 ({policies.get('early_checkin_9am_12pm', 30)}%)
- Phụ thu Check-out muộn: 12:00–15:00 ({policies.get('late_checkout_12pm_3pm', 30)}%), 15:00–18:00 ({policies.get('late_checkout_3pm_6pm', 50)}%), sau 18:00 ({policies.get('late_checkout_after_6pm', 100)}%)
- Thanh toán: {hotel_context.get('payment_methods', '')}
- Wifi miễn phí: `{h_info['wifi_ssid']}` | Mật khẩu: `{h_info['wifi_pass']}`
- Hồ bơi: {h_info['pool_info']} | Ăn sáng: {h_info['breakfast_info']} | Spa & Gym: {h_info['spa_gym_info']}{reviews_text}

TÌNH TRẠNG PHÒNG TRỐNG & BẢNG GIÁ THỰC TẾ (KHOẢNG NGÀY ĐANG KIỂM TRA: {date_range_str}{guest_note}):
{rooms_text}

DANH MỤC DỊCH VỤ ẨM THỰC, SPA & TIỆN ÍCH ĐANG PHỤC VỤ:
{services_text}

MÃ KHUYẾN MÃI & ĐẶC QUYỀN HỘI VIÊN:
{promos_text}
{tiers_text}

CẨM NANG DU LỊCH ĐÀ NẴNG:
{guide_text}{shuttle_note}{posts_text}

{user_str}{hk_str}{maint_str}{pending_str}{lost_found_str}{cancel_elig_str}{price_est_str}{promo_check_str}{lookup_hint_str}
"""
    return system_prompt
