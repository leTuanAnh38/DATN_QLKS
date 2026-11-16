"""Trả lời dự phòng theo luật khi không gọi được AI."""
import logging

from ..models import Booking

logger = logging.getLogger(__name__)
from .context_builder import build_active_stay_details
from .text_utils import format_currency_multilingual
from .nlp_parser import resolve_room_from_conversation


def _verification_message(hint, lang='vi'):
    reason = (hint or {}).get('reason', 'verification_required')
    if lang == 'en':
        if reason == 'ownership_mismatch':
            return (
                "For your privacy and booking security, I cannot display details of a reservation that does not belong to your signed-in account. "
                "Please sign in with the booking account or include **both your Booking Code (`BK-...` / `GRP-...`) and the registered Phone Number** in one message."
            )
        return (
            "To protect guest privacy, please **sign in** to your account OR provide **both your Booking Code (e.g. `BK-3C2E8F` or `GRP-...`) and your registered Phone Number** in the same message so I can verify and retrieve your booking immediately!"
        )
    if lang == 'ko':
        return (
            "고객님의 개인정보 보호를 위해 **로그인**하시거나, 한 번의 메시지에 **예약 번호(`BK-...` / `GRP-...`)와 예약 시 등록한 전화번호**를 함께 입력해 주시면 안전하게 조회해 드리겠습니다!"
        )
    if lang == 'zh':
        return (
            "为保障您的隐私安全，请先**登录账号**，或在同一条消息中同时提供**预订编号（如 `BK-...` / `GRP-...`）和预留手机号**，我将立即为您安全查询！"
        )
    if reason == 'ownership_mismatch':
        return (
            "Dạ để bảo mật thông tin cá nhân của Quý khách, hệ thống không thể hiển thị đơn đặt phòng không thuộc tài khoản đang đăng nhập ạ.\n\n"
            "Quý khách vui lòng **đăng nhập đúng tài khoản đã đặt**, hoặc nhắn kèm **cả Mã đơn (`BK-...`/`GRP-...`) và Số điện thoại đặt phòng** trong cùng 1 tin nhắn để em xác thực nhé ạ!"
        )
    return (
        "Dạ để bảo mật thông tin đặt phòng của Quý khách, Quý khách vui lòng:\n\n"
        "1. **Đăng nhập** tài khoản hội viên; HOẶC\n"
        "2. Nhắn đồng thời **Mã đơn + Số điện thoại** trong cùng 1 tin nhắn (ví dụ: `BK-3C2E8F 0918889999` hoặc `GRP-ABC123 0918889999`) để em xác thực và tra cứu ngay ạ!"
    )


def _promo_status_message(qp, lang='vi'):
    """Sinh phản hồi kiểm tra mã khuyến mãi cụ thể (cả hợp lệ & hết hạn/hết lượt/không tồn tại)."""
    code = qp['code']
    st = qp['status']
    if qp.get('valid'):
        rem = f" | Còn {qp['remaining_uses']} lượt" if qp.get('remaining_uses') is not None else ""
        if lang == 'en':
            return (
                f"Great news! Promo code **`{code}`** is **VALID & ACTIVE** (**{qp['discount']} off**).\n\n"
                f"• **Campaign**: {qp['name']}\n"
                f"• **Minimum Order**: {qp['min_order']}\n"
                f"Apply **`{code}`** directly on the **Checkout** page!"
            )
        if lang == 'ko':
            return (
                f"프로모션 코드 **`{code}`**는 현재 **사용 가능**합니다 (**{qp['discount']} 할인**).\n\n"
                f"• **혜택 내용**: {qp['name']}\n"
                f"• **최소 주문 금액**: {qp['min_order']}\n"
                f"결제(Checkout) 단계에서 **`{code}`**를 입력하시면 즉시 할인됩니다!"
            )
        if lang == 'zh':
            return (
                f"好消息！优惠码 **`{code}`** 当前**有效可用**（立减 **{qp['discount']}**）。\n\n"
                f"• **活动名称**: {qp['name']}\n"
                f"• **最低消费**: {qp['min_order']}\n"
                f"请在**结算 (Checkout)** 页面直接输入 **`{code}`** 即可享受优惠！"
            )
        return (
            f"Dạ tin vui ạ! Mã khuyến mãi **`{code}`** hiện **ĐANG HỢP LỆ & ÁP DỤNG ĐƯỢC** (**Giảm {qp['discount']}**) ạ:\n\n"
            f"• **Chương trình**: {qp['name']}\n"
            f"• **Đơn tối thiểu**: {qp['min_order']}{rem}\n\n"
            f"Quý khách chỉ cần nhập mã **`{code}`** tại bước **Thanh toán (Checkout)** để được giảm trừ tự động nhé ạ!"
        )

    reason_vi = {
        'inactive': 'hiện đang tạm ngưng kích hoạt',
        'not_started': f"chưa đến thời gian áp dụng (bắt đầu từ {qp.get('valid_from')})",
        'expired': f"đã hết hạn sử dụng (hết hạn ngày {qp.get('valid_to')})",
        'limit_reached': 'đã hết lượt sử dụng tối đa',
        'not_found': 'không tồn tại trên hệ thống hoặc đã hết hiệu lực',
    }.get(st, 'không hợp lệ')
    reason_en = {
        'inactive': 'is currently inactive',
        'not_started': f"is not active yet (starts on {qp.get('valid_from')})",
        'expired': f"has expired (ended on {qp.get('valid_to')})",
        'limit_reached': 'has reached its maximum usage limit',
        'not_found': 'does not exist in our system',
    }.get(st, 'is invalid')
    reason_ko = {
        'inactive': '현재 비활성화 상태입니다',
        'not_started': f"아직 시작 전입니다 ({qp.get('valid_from')}부터 적용)",
        'expired': f"유효 기간이 만료되었습니다 ({qp.get('valid_to')} 종료)",
        'limit_reached': '최대 사용 횟수가 모두 소진되었습니다',
        'not_found': '시스템에 존재하지 않는 코드입니다',
    }.get(st, '사용할 수 없습니다')
    reason_zh = {
        'inactive': '目前已暂停使用',
        'not_started': f"尚未到生效时间（{qp.get('valid_from')} 起生效）",
        'expired': f"已过期（已于 {qp.get('valid_to')} 截止）",
        'limit_reached': '已达到最大使用次数上限',
        'not_found': '系统中不存在该优惠码',
    }.get(st, '不可用')

    if lang == 'en':
        return f"I checked promo code **`{code}`**, and unfortunately it **{reason_en}**. Please ask for *promotions* to view currently active offers!"
    if lang == 'ko':
        return f"확인 결과, 프로모션 코드 **`{code}`**는 **{reason_ko}**. '할인/프로모션'을 질문하시면 현재 이용 가능한 혜택을 안내해 드립니다!"
    if lang == 'zh':
        return f"经查询，优惠码 **`{code}`** **{reason_zh}**。您可以发送“优惠/促销”查看当前有效的活动代码！"
    return (
        f"Dạ em đã kiểm tra trên hệ thống: rất tiếc mã khuyến mãi **`{code}`** **{reason_vi}** ạ.\n\n"
        f"Quý khách có thể hỏi *'khuyến mãi hiện có'* để xem các mã Voucher đang còn hiệu lực hoặc sử dụng ưu đãi Hạng thẻ Hội viên trực tiếp khi đặt phòng nhé ạ!"
    )


def _lost_found_message(lf, h_info, lang='vi'):
    """Sinh phản hồi cho tra cứu / báo đồ thất lạc (Lost & Found)."""
    if lf.get('requires_auth'):
        if lang == 'en':
            return (
                "To protect guest privacy and check our **Lost & Found** vault for the right room, please **sign in** to your account "
                "or provide **both your Booking Code (`BK-...`) and Phone Number** in the same message."
            )
        if lang == 'ko':
            return (
                "분실물 보관 내역 확인 및 보안을 위해 **로그인**하시거나 **예약 번호(`BK-...`)와 전화번호**를 함께 입력해 주세요."
            )
        if lang == 'zh':
            return (
                "为保障隐私并准确核查**失物招领**记录，请先**登录账号**，或同时提供**预订编号（`BK-...`）和手机号**。"
            )
        return (
            "Dạ để bảo mật thông tin tài sản cá nhân và kiểm tra chính xác kho **Đồ Thất Lạc (Lost & Found)** theo đúng phòng Quý khách đã lưu trú, "
            "Quý khách vui lòng **đăng nhập tài khoản** HOẶC nhắn kèm **Mã đơn (`BK-...`) + Số điện thoại** trong cùng 1 tin nhắn ạ!"
        )

    items = lf.get('matched_items') or []
    r_num = lf.get('room_number')
    b_code = lf.get('booking_code')
    if items:
        if lang == 'en':
            lines = [f"Great news, **{lf['guest_name']}**! I checked our **Lost & Found** log for **Room P.{r_num}** (`#{b_code}`) and found:\n"]
            for it in items:
                lines.append(f"• **`{it['tracking_code']}` — {it['item_name']}** | Storage: **{it['storage_location']}** ({it['status_label']})")
            lines.append(f"\nI have also notified our Front Desk & Housekeeping. Please contact Hotline **{h_info['hotline']}** or visit Reception to claim your item(s)!")
            return "\n".join(lines)
        if lang == 'ko':
            lines = [f"**{lf['guest_name']}** 고객님, **P.{r_num}호**(`#{b_code}`) 관련 **분실물 보관 내역**을 확인했습니다:\n"]
            for it in items:
                lines.append(f"• **`{it['tracking_code']}` — {it['item_name']}** | 보관 위치: **{it['storage_location']}**")
            lines.append(f"\n프런트 데스크에도 전달 완료되었으니 핫라인 **{h_info['hotline']}**으로 연락해 수령해 주세요!")
            return "\n".join(lines)
        if lang == 'zh':
            lines = [f"尊敬的 **{lf['guest_name']}**，已为您查到 **P.{r_num}号房**（`#{b_code}`）的**失物招领**记录：\n"]
            for it in items:
                lines.append(f"• **`{it['tracking_code']}` — {it['item_name']}** | 存放位置: **{it['storage_location']}**")
            lines.append(f"\n已通知前台妥善保管，请致电 **{h_info['hotline']}** 或前往前台领取！")
            return "\n".join(lines)
        lines = [f"Dạ tin vui cho Quý khách **{lf['guest_name']}**! Em đã kiểm tra kho **Đồ Thất Lạc (Lost & Found)** gắn với **Phòng P.{r_num}** (Mã đơn `#{b_code}`) và ghi nhận:\n"]
        for it in items:
            lines.append(f"• **Mã `{it['tracking_code']}` — {it['item_name']}** | Nơi tìm thấy: *{it['location_found']}* | Đang cất giữ tại: **{it['storage_location']}** (*{it['status_label']}*)")
        lines.append(f"\nEm cũng đã gửi thông báo tới Lễ tân & Buồng phòng để chuẩn bị bàn giao lại cho Quý khách. Quý khách vui lòng liên hệ Hotline **{h_info['hotline']}** hoặc Quầy Lễ tân để nhận lại đồ nhé ạ!")
        return "\n".join(lines)

    if lang == 'en':
        return (
            f"Dear **{lf['guest_name']}**, I checked our Lost & Found vault for **Room P.{r_num}** (`#{b_code}`) and no item has been logged yet. "
            f"I have immediately sent a **high-priority alert** to our Housekeeping & Front Desk team to inspect the room right away. "
            f"We will contact you shortly, or you may reach our 24/7 Hotline **{h_info['hotline']}**."
        )
    if lang == 'ko':
        return (
            f"**{lf['guest_name']}** 고객님, **P.{r_num}호**(`#{b_code}`)의 분실물 등록 내역이 아직 없어 하우스키핑과 프런트에 **긴급 확인 요청**을 전송했습니다. "
            f"확인되는 대로 바로 연락드리겠습니다 (핫라인: **{h_info['hotline']}**)."
        )
    if lang == 'zh':
        return (
            f"尊敬的 **{lf['guest_name']}**，暂未查到 **P.{r_num}号房**（`#{b_code}`）的已登记失物，我已立即向客房部与前台发送**加急排查通知**。"
            f"核实后将第一时间联系您（24小时热线：**{h_info['hotline']}**）。"
        )
    return (
        f"Dạ em đã kiểm tra kho đồ thất lạc cho **Phòng P.{r_num}** (Mã đơn `#{b_code}`) nhưng hiện chưa thấy vật phẩm nào được nhập kho ạ.\n\n"
        f"Em đã lập tức gửi **thông báo khẩn** tới bộ phận **Buồng phòng & Lễ tân** để kiểm tra lại phòng và khu vực liên quan ngay cho Quý khách **{lf['guest_name']}**. "
        f"Nhân viên sẽ liên hệ lại sớm nhất hoặc Quý khách có thể gọi Hotline 24/7 **{h_info['hotline']}** ạ!"
    )


def _cancel_eligibility_message(ce, h_info, lang='vi'):
    """Sinh phản hồi điều kiện hủy miễn phí theo thời gian thực cho đơn đã xác thực."""
    code = ce['booking_code']
    free_h = ce['free_hours']
    hrs = ce['hours_until_checkin']
    target_route = '`/corporate-booking`' if ce.get('is_group') else '`/booking-history`'

    if not ce.get('can_cancel'):
        if lang == 'en':
            return (
                f"Reservation **`#{code}`** (Check-in **{ce['check_in_date']}**) currently has status **`{ce['status']}`** and cannot be cancelled automatically online. "
                f"Please contact our Front Desk Hotline **{h_info['hotline']}** for direct assistance."
            )
        if lang == 'ko':
            return f"예약 **`#{code}`**은(는) 현재 상태(`{ce['status']}`)상 온라인 자동 취소가 불가합니다. 프런트 핫라인 **{h_info['hotline']}**으로 문의해 주세요."
        if lang == 'zh':
            return f"订单 **`#{code}`** 当前状态为 `{ce['status']}`，暂不支持线上直接取消。请联系前台热线 **{h_info['hotline']}** 协助处理。"
        return (
            f"Dạ đơn **`#{code}`** (Nhận phòng **{ce['check_in_date']}**) hiện đang ở trạng thái **`{ce['status']}`** nên không thể tự hủy trực tuyến trên hệ thống ạ. "
            f"Quý khách vui lòng liên hệ Hotline Lễ tân 24/7 **{h_info['hotline']}** để được hỗ trợ trực tiếp nhé ạ!"
        )

    if ce.get('is_free_cancel_eligible'):
        if lang == 'en':
            return (
                f"Good news! Reservation **`#{code}`** (Check-in **{ce['check_in_date']}**, ~**{hrs} hours** remaining) is **ELIGIBLE FOR FREE CANCELLATION** "
                f"(before the **{free_h}-hour** policy window).\n\n"
                f"You can review or cancel it directly on the **My Bookings** ({target_route}) page!"
            )
        if lang == 'ko':
            return (
                f"예약 **`#{code}`** (체크인 **{ce['check_in_date']}**, 약 **{hrs}시간** 남음)은(는) 체크인 **{free_h}시간** 전 기준을 충족하여 **무료 취소 가능** 대상입니다.\n\n"
                f"**예약 내역** ({target_route}) 페이지에서 직접 취소하실 수 있습니다!"
            )
        if lang == 'zh':
            return (
                f"好消息！您的订单 **`#{code}`**（入住日期 **{ce['check_in_date']}**，距离入住约 **{hrs} 小时**）符合入住前 **{free_h} 小时**政策，可享受**免费取消**。\n\n"
                f"您可直接前往**预订记录**（{target_route}）页面办理取消！"
            )
        return (
            f"Dạ tin vui ạ! Đơn **`#{code}`** (Nhận phòng **{ce['check_in_date']}**, còn khoảng **{hrs} giờ** tới giờ nhận phòng) "
            f"hiện **ĐỦ ĐIỀU KIỆN HỦY MIỄN PHÍ** (trước mốc quy định **{free_h} giờ**) ạ.\n\n"
            f"Quý khách có thể vào mục **Lịch sử đặt phòng** ({target_route}) để thao tác hủy hoặc liên hệ Hotline **{h_info['hotline']}** nếu cần hỗ trợ đổi ngày nhé ạ!"
        )

    if lang == 'en':
        return (
            f"Reservation **`#{code}`** (Check-in **{ce['check_in_date']}**, only ~**{hrs} hours** remaining) is currently **past the {free_h}-hour free cancellation window**.\n\n"
            f"Please contact our Concierge Hotline **{h_info['hotline']}** so our Duty Manager can assist you with rescheduling or special cancellation support."
        )
    if lang == 'ko':
        return (
            f"예약 **`#{code}`** (체크인 **{ce['check_in_date']}**, 약 **{hrs}시간** 남음)은(는) **무료 취소 가능 기간({free_h}시간 전)이 경과**했습니다.\n\n"
            f"일정 변경이나 취소 지원이 필요하시면 핫라인 **{h_info['hotline']}**으로 연락해 주세요."
        )
    if lang == 'zh':
        return (
            f"订单 **`#{code}`**（入住日期 **{ce['check_in_date']}**，距离入住仅剩约 **{hrs} 小时**）已超过 **{free_h} 小时免费取消**时限。\n\n"
            f"如需改期或申请协助，请联系 24 小时前台热线 **{h_info['hotline']}**。"
        )
    return (
        f"Dạ em đã kiểm tra đơn **`#{code}`** (Nhận phòng **{ce['check_in_date']}**): hiện chỉ còn khoảng **{hrs} giờ** tới giờ nhận phòng, "
        f"đã quá mốc **hủy miễn phí trước {free_h} giờ** ạ.\n\n"
        f"Nếu Quý khách muốn dời ngày lưu trú hoặc cần hỗ trợ đặc biệt, vui lòng liên hệ trực tiếp Lễ tân qua Hotline **{h_info['hotline']}** để Quản lý ca trực xem xét hỗ trợ tốt nhất nhé ạ!"
    )


def _price_estimate_message(pe, lang='vi'):
    """Sinh bảng tính tạm tính tổng tiền đặt phòng (gồm số đêm, hạng hội viên & mã giảm giá)."""
    disc_lines_vi = []
    disc_lines_en = []
    disc_lines_ko = []
    disc_lines_zh = []
    if pe.get('membership_discount_formatted'):
        disc_lines_vi.append(f"• **Ưu đãi Hội viên ({pe['tier_name']} - {int(pe['tier_percent'])}%)**: **-{pe['membership_discount_formatted']}**")
        disc_lines_en.append(f"• **Membership Discount ({pe['tier_name']} - {int(pe['tier_percent'])}%)**: **-{pe['membership_discount_formatted']}**")
        disc_lines_ko.append(f"• **멤버십 할인 ({pe['tier_name']} - {int(pe['tier_percent'])}%)**: **-{pe['membership_discount_formatted']}**")
        disc_lines_zh.append(f"• **会员折扣 ({pe['tier_name']} - {int(pe['tier_percent'])}%)**: **-{pe['membership_discount_formatted']}**")
    if pe.get('promo_discount_formatted'):
        disc_lines_vi.append(f"• **Mã khuyến mãi `{pe['promo_code']}`**: **-{pe['promo_discount_formatted']}**")
        disc_lines_en.append(f"• **Promo Code `{pe['promo_code']}`**: **-{pe['promo_discount_formatted']}**")
        disc_lines_ko.append(f"• **프로모션 코드 `{pe['promo_code']}`**: **-{pe['promo_discount_formatted']}**")
        disc_lines_zh.append(f"• **优惠码 `{pe['promo_code']}`**: **-{pe['promo_discount_formatted']}**")
    elif pe.get('promo_min_unmet'):
        disc_lines_vi.append(f"• **Mã `{pe['promo_code']}`**: Chưa áp dụng (cần đơn tối thiểu **{pe['promo_min_order_formatted']}**)")
        disc_lines_en.append(f"• **Promo `{pe['promo_code']}`**: Not applied (min order **{pe['promo_min_order_formatted']}**)")
        disc_lines_ko.append(f"• **코드 `{pe['promo_code']}`**: 최소 주문 금액(**{pe['promo_min_order_formatted']}**) 미충족")
        disc_lines_zh.append(f"• **优惠码 `{pe['promo_code']}`**: 未满足最低消费 (**{pe['promo_min_order_formatted']}**)")

    if lang == 'en':
        extra = ("\n" + "\n".join(disc_lines_en)) if disc_lines_en else ""
        return (
            f"Here is the **Estimated Total** for **{pe['room_name']}** ({pe['check_in_display']} ➔ {pe['check_out_display']}, **{pe['nights']} night(s)**):\n\n"
            f"• **Nightly Rate**: **{pe['unit_price_formatted']}**\n"
            f"• **Room Subtotal ({pe['nights']} night(s))**: **{pe['subtotal_formatted']}**"
            f"{extra}\n"
            f"• **ESTIMATED TOTAL**: **{pe['final_total_formatted']}** *(Taxes & service charge included)*\n\n"
            f"Tap **[Book Now]** on the room card below to reserve with these dates pre-filled!"
        )
    if lang == 'ko':
        extra = ("\n" + "\n".join(disc_lines_ko)) if disc_lines_ko else ""
        return (
            f"**{pe['room_name']}** ({pe['check_in_display']} ~ {pe['check_out_display']}, **{pe['nights']}박**) 예상 결제 금액입니다:\n\n"
            f"• **1박 요금**: **{pe['unit_price_formatted']}**\n"
            f"• **객실 소계 ({pe['nights']}박)**: **{pe['subtotal_formatted']}**"
            f"{extra}\n"
            f"• **예상 총 결제 금액**: **{pe['final_total_formatted']}** *(세금 및 봉사료 포함)*"
        )
    if lang == 'zh':
        extra = ("\n" + "\n".join(disc_lines_zh)) if disc_lines_zh else ""
        return (
            f"以下是 **{pe['room_name']}**（{pe['check_in_display']} 至 {pe['check_out_display']}，共 **{pe['nights']} 晚**）的费用预算明细：\n\n"
            f"• **每晚房价**: **{pe['unit_price_formatted']}**\n"
            f"• **房费小计 ({pe['nights']} 晚)**: **{pe['subtotal_formatted']}**"
            f"{extra}\n"
            f"• **预计应付总额**: **{pe['final_total_formatted']}** *（已含税费及服务费）*"
        )
    extra = ("\n" + "\n".join(disc_lines_vi)) if disc_lines_vi else ""
    return (
        f"Dạ em xin gửi Quý khách **Bảng ước tính chi phí đặt phòng** hạng **{pe['room_name']}** "
        f"({pe['check_in_display']} ➔ {pe['check_out_display']}, **{pe['nights']} đêm**) ạ:\n\n"
        f"• **Đơn giá mỗi đêm**: **{pe['unit_price_formatted']}**\n"
        f"• **Tạm tính ({pe['nights']} đêm)**: **{pe['subtotal_formatted']}**"
        f"{extra}\n"
        f"• **TỔNG THANH TOÁN DỰ KIẾN**: **{pe['final_total_formatted']}** *({pe['vat_note']})*\n\n"
        f"Quý khách có thể bấm **[Đặt ngay]** trên thẻ phòng bên dưới để giữ phòng với đúng ngày đã chọn nhé ạ!"
    )


def local_smart_fallback(
    message, user, hotel_context, tracked_bookings=None, lang='vi', history=None,
    housekeeping_action=None, maintenance_action=None, pending_action=None,
    lost_found_action=None, cancel_eligibility=None, price_estimate=None,
):
    """
    CƠ CHẾ FALLBACK THÔNG MINH ĐA NGÔN NGỮ (Offline / No Key / Quota Exceeded / Network Error):
    - Có bộ nhớ hội thoại nhiều lượt (Multi-turn Memory) nhờ tham số `history`.
    - Kiểm tra đúng số phòng trống theo ngày khách hỏi (`queried_dates`) và số lượng khách (`guest_count`).
    - Giải đáp chi tiết tiện nghi, chính sách hủy/phụ thu từ `HotelSetting`, hạng thẻ từ `MembershipTier`.
    - Phục vụ khách đang lưu trú (`CHECKED_IN`): báo hóa đơn tạm tính chuẩn xác, tiến trình đơn đồ ăn, Wifi, hồ bơi, gọi dọn phòng (đã xác thực).
    """
    msg = message.strip().lower()
    h_info = hotel_context['hotel_info']
    stars = h_info.get('stars', 5) or 5
    policies = hotel_context.get('policies', {})
    d_info = hotel_context.get('queried_dates', {})
    user_ctx = hotel_context.get('user_context')
    active_stay = user_ctx.get('active_stay') if user_ctx else None

    # Nếu khách vừa tra cứu 1 đơn cá nhân đã xác thực, lấy active_stay từ đơn đó
    if not active_stay and tracked_bookings and len(tracked_bookings) > 0 and not tracked_bookings[0].get('is_group'):
        first_bk_obj = (
            Booking.objects.filter(id=tracked_bookings[0]['id'])
            .select_related('category', 'room', 'invoice', 'group_booking', 'applied_promotion')
            .prefetch_related('extra_services', 'service_requests__service', 'service_requests__assigned_staff', 'payments')
            .first()
        )
        if first_bk_obj:
            active_stay = build_active_stay_details(first_bk_obj, lang=lang)

    # -------------------------------------------------------------------------
    # 0. XỬ LÝ BÁO HỎNG KỸ THUẬT & BUỒNG PHÒNG CHO KHÁCH ĐANG LƯU TRÚ
    # -------------------------------------------------------------------------
    if maintenance_action:
        if maintenance_action.get('requires_auth'):
            if lang == 'en':
                return (
                    "To dispatch our Engineering & Maintenance team to the right room, please **sign in** to your guest account "
                    "or provide **both your Checked-In Booking Code (`BK-...`) and Phone Number** (or dial **`0`** from your room phone)."
                )
            if lang == 'ko':
                return (
                    "정확한 객실 시설 점검 접수를 위해 **로그인**하시거나 **체크인 완료된 예약 번호(`BK-...`)와 전화번호**를 함께 입력해 주세요. (객실 내 전화 **`0`**번 가능)"
                )
            if lang == 'zh':
                return (
                    "为确保准确安排工程维修人员上门，请先**登录您的预订账号**，或同时提供**已入住订单号（`BK-...`）和手机号**（或直接拨打房间内线 **`0`**）。"
                )
            return (
                "Dạ để bảo mật và chuyển lệnh chuẩn xác tới Kỹ thuật viên đúng phòng đang lưu trú, Quý khách vui lòng **đăng nhập tài khoản đặt phòng** "
                "HOẶC nhắn kèm **Mã đơn (`BK-...`) + Số điện thoại** (ví dụ: `Hỏng điều hòa BK-3C2E8F 0918889999`) để em lập phiếu sửa chữa ngay ạ!"
            )

        r_num = maintenance_action['room_number']
        t_code = maintenance_action.get('ticket_code') or 'MT-AUTO'
        eq_name = maintenance_action.get('equipment_name', 'Thiết bị phòng')
        if lang == 'en':
            return (
                f"Dear **{maintenance_action['guest_name']}**, I apologize for the inconvenience and have immediately created Maintenance Ticket **`{t_code}`** for **Room P.{r_num}** (Booking `#{maintenance_action['booking_code']}`):\n\n"
                f"• **Category**: {eq_name}\n"
                f"• ⏱️ **Estimated Response**: Our Technician will arrive at your room within **10 minutes**."
            )
        if lang == 'ko':
            return (
                f"**{maintenance_action['guest_name']}** 고객님, 불편을 드려 죄송합니다. **P.{r_num}호**에 대한 시설 수리 접수(**`{t_code}`**)를 즉시 완료하였습니다:\n\n"
                f"• **점검 항목**: {eq_name}\n"
                f"• ⏱️ **방문 예정**: 기술 담당자가 **10분 이내**에 객실로 방문하여 조치하겠습니다."
            )
        if lang == 'zh':
            return (
                f"尊敬的 **{maintenance_action['guest_name']}**，非常抱歉给您带来不便！已立即为您的 **P.{r_num}号房** 创建工程报修单 **`{t_code}`**：\n\n"
                f"• **报修设备**: {eq_name}\n"
                f"• ⏱️ **响应时间**: 工程技术人员将在 **10 分钟内**上门为您处理。"
            )
        return (
            f"Dạ em thành thật xin lỗi Quý khách **{maintenance_action['guest_name']}** về sự bất tiện này! Em đã lập ngay **Phiếu Kỹ thuật `{t_code}`** cho **Phòng P.{r_num}** (Mã đơn `#{maintenance_action['booking_code']}`) ạ:\n\n"
            f"• **Hạng mục tiếp nhận**: {eq_name}\n"
            f"• **Nội dung**: *{maintenance_action['description']}*\n"
            f"• ⏱️ **Thời gian xử lý**: Kỹ thuật viên đang trên đường lên hỗ trợ Quý khách trong khoảng **10 phút** nữa ạ!"
        )

    if housekeeping_action:
        if housekeeping_action.get('requires_auth'):
            if lang == 'en':
                return (
                    "For in-room guest security, please **sign in** with your reservation account, OR provide **both your Checked-In Booking Code (`BK-...`) and Phone Number** in your message so I can dispatch Housekeeping immediately (or dial **`0`** from your room phone)."
                )
            if lang == 'ko':
                return (
                    "객실 보안 및 정확한 접수를 위해 **로그인**하시거나 **체크인 완료된 예약 번호(`BK-...`)와 전화번호**를 함께 입력해 주시면 즉시 하우스키핑을 배정해 드리겠습니다. (객실 내 전화 **`0`**번 이용 가능)"
                )
            if lang == 'zh':
                return (
                    "为确保客房服务准确安全，请先**登录您的预订账号**，或同时提供**已入住订单号（`BK-...`）和手机号**，我将立即为您安排客房清洁（您也可直接拨打房间内线 **`0`**）。"
                )
            return (
                "Dạ để đảm bảo an toàn và xác thực đúng phòng đang lưu trú, Quý khách vui lòng **đăng nhập tài khoản đặt phòng** "
                "HOẶC nhắn kèm **Mã đơn (`BK-...`) + Số điện thoại** (ví dụ: `Dọn phòng BK-3C2E8F 0918889999`) để em chuyển lệnh tới bộ phận Buồng phòng ngay lập tức ạ! "
                "*(Hoặc Quý khách có thể bấm phím **`0`** trên điện thoại bàn trong phòng)*."
            )

        r_num = housekeeping_action['room_number']
        if lang == 'en':
            return (
                f"Dear **{housekeeping_action['guest_name']}**, I have immediately dispatched an urgent **Housekeeping & Room Service Request** for **Room P.{r_num}** (Booking `#{housekeeping_action['booking_code']}`)!\n\n"
                f"• **Request Detail**: *{housekeeping_action['request_note']}*\n"
                f"• ⏱️ **Estimated Arrival**: Our Housekeeping attendant will arrive at your room within **5 – 10 minutes**.\n\n"
                f"If you need any additional amenities, please feel free to message me or dial **`0`** from your in-room telephone!"
            )
        if lang == 'ko':
            return (
                f"**{housekeeping_action['guest_name']}** 고객님, **P.{r_num}호** (예약 `#{housekeeping_action['booking_code']}`)의 **객실 정비 요청**이 하우스키핑 팀으로 즉시 전달되었습니다!\n\n"
                f"• **요청 내용**: *{housekeeping_action['request_note']}*\n"
                f"• ⏱️ **예상 도착**: **5 ~ 10분** 이내에 담당 직원이 객실로 방문할 예정입니다."
            )
        if lang == 'zh':
            return (
                f"尊敬的 **{housekeeping_action['guest_name']}**，已立即为您的 **P.{r_num}号房**（订单 `#{housekeeping_action['booking_code']}`）发送加急**客房清洁/服务指令**！\n\n"
                f"• **服务内容**: *{housekeeping_action['request_note']}*\n"
                f"• ⏱️ **预计到达**: 客房服务人员将在 **5 – 10 分钟**内抵达您的房间。"
            )
        return (
            f"Dạ em kính chào Quý khách **{housekeeping_action['guest_name']}**! Em đã lập tức chuyển lệnh **Yêu cầu Phục vụ Buồng phòng** cho **Phòng P.{r_num}** (Mã đơn `#{housekeeping_action['booking_code']}`) tới bộ phận Housekeeping rồi ạ:\n\n"
            f"• **Nội dung yêu cầu**: *{housekeeping_action['request_note']}*\n"
            f"• ⏱️ **Thời gian phản hồi**: Nhân viên Buồng phòng sẽ có mặt tại phòng Quý khách trong khoảng **5 – 10 phút** nữa ạ.\n"
            f"• **Trạng thái hệ thống**: Đã bật tín hiệu ưu tiên trên Sơ đồ phòng Lễ tân.\n\n"
            f"Quý khách cần thêm khăn tắm, nước suối hay bất kỳ tiện ích nào khác cứ nhắn cho em bất cứ lúc nào nhé ạ!"
        )

    if lost_found_action:
        return _lost_found_message(lost_found_action, h_info, lang=lang)

    # -------------------------------------------------------------------------
    # 0B. NHẮC XÁC THỰC KHI TRA CỨU ĐƠN KHÔNG HỢP LỆ / THIẾU XÁC MINH
    # -------------------------------------------------------------------------
    if hotel_context.get('lookup_verification_hint') and not tracked_bookings:
        return _verification_message(hotel_context['lookup_verification_hint'], lang=lang)

    # -------------------------------------------------------------------------
    # 0C. HÀNH ĐỘNG CHỜ XÁC NHẬN 2 BƯỚC (ĐẶT MÓN PHÒNG / CHUYỂN TIẾP NHÂN VIÊN)
    # -------------------------------------------------------------------------
    if pending_action:
        p_type = pending_action.get('type')
        if p_type == 'create_service_request_auth_required':
            s_name = pending_action.get('service_name', 'dịch vụ')
            if lang == 'en':
                return (
                    f"To order **{s_name}** directly to your room, please **sign in** to your guest account "
                    f"or include **both your Checked-In Booking Code (`BK-...`) and Phone Number** in your message!"
                )
            if lang == 'ko':
                return (
                    f"**{s_name}** 객실 주문을 위해 먼저 **로그인**하시거나 **체크인 완료된 예약 번호(`BK-...`)와 전화번호**를 함께 입력해 주세요!"
                )
            if lang == 'zh':
                return (
                    f"如需将 **{s_name}** 送到您的房间，请先**登录账号**或在同一消息中提供**已入住订单号（`BK-...`）和手机号**！"
                )
            return (
                f"Dạ để đặt **{s_name}** giao tận phòng chính xác và bảo mật, Quý khách vui lòng **đăng nhập tài khoản đặt phòng** "
                f"HOẶC nhắn kèm **Mã đơn đang lưu trú (`BK-...`) + Số điện thoại** trong cùng 1 tin nhắn để em tạo phiếu xác nhận ngay ạ!"
            )

        if p_type == 'create_service_request':
            if lang == 'en':
                return (
                    f"I have prepared your in-room service order for **Room P.{pending_action['room_number']}** (`#{pending_action['booking_code']}`):\n\n"
                    f"• **Service / Item**: **{pending_action['service_name']}** × **{pending_action['quantity']}**\n"
                    f"• **Total Amount**: **{pending_action['total_formatted']}**\n\n"
                    f"Please tap **[Confirm Order Now]** on the confirmation card below to submit this request to our staff!"
                )
            if lang == 'ko':
                return (
                    f"**P.{pending_action['room_number']}호** (`#{pending_action['booking_code']}`) 객실 서비스 주문을 준비했습니다:\n\n"
                    f"• **주문 항목**: **{pending_action['service_name']}** × **{pending_action['quantity']}**\n"
                    f"• **총 금액**: **{pending_action['total_formatted']}**\n\n"
                    f"아래 확인 카드에서 **[지금 주문 확정]** 버튼을 눌러 주문을 완료해 주세요!"
                )
            if lang == 'zh':
                return (
                    f"已为您准备好 **P.{pending_action['room_number']}号房**（`#{pending_action['booking_code']}`）的客房服务确认单：\n\n"
                    f"• **服务/餐品**: **{pending_action['service_name']}** × **{pending_action['quantity']}**\n"
                    f"• **合计金额**: **{pending_action['total_formatted']}**\n\n"
                    f"请点击下方确认卡片中的 **[立即确认下单]** 按钮提交给工作人员！"
                )
            return (
                f"Dạ em đã chuẩn bị phiếu xác nhận đặt dịch vụ cho **Phòng P.{pending_action['room_number']}** (Mã đơn `#{pending_action['booking_code']}`) ạ:\n\n"
                f"• **Món / Dịch vụ**: **{pending_action['service_name']}** × **{pending_action['quantity']}**\n"
                f"• **Tổng tiền tạm tính**: **{pending_action['total_formatted']}**\n\n"
                f"Quý khách vui lòng kiểm tra lại và bấm nút **[Xác nhận đặt ngay]** ở thẻ bên dưới để em chuyển lệnh tới bếp/bộ phận phục vụ nhé ạ!"
            )

        if p_type == 'human_handoff':
            if lang == 'en':
                return (
                    f"I would be happy to connect you directly with our Front Desk & Guest Relations team. "
                    f"Please review or complete the quick contact card below to send your message straight to our duty manager, or call our 24/7 Hotline **{h_info['hotline']}**."
                )
            if lang == 'ko':
                return (
                    f"프런트 데스크 및 매니저와 바로 연결해 드리겠습니다. 아래 **직원 연결 요청 카드**를 작성해 전송하시거나 24시간 핫라인 **{h_info['hotline']}**으로 연락해 주세요."
                )
            if lang == 'zh':
                return (
                    f"我将立即为您转接酒店前台及值班经理。请核对或填写下方的**转人工联系卡**提交给我们，或致电24小时客服热线 **{h_info['hotline']}**。"
                )
            return (
                f"Dạ em rất sẵn lòng chuyển yêu cầu của Quý khách tới **Lễ tân & Quản lý trực ca** ngay lập tức ạ. "
                f"Quý khách vui lòng xác nhận thông tin trên **Thẻ Chuyển Tiếp Nhân Viên** bên dưới để đội ngũ CSKH liên hệ lại ngay, hoặc gọi Hotline 24/7 **{h_info['hotline']}** nhé ạ!"
            )

    # -------------------------------------------------------------------------
    # 0D. ĐIỀU KIỆN HỦY ĐƠN / ƯỚC TÍNH TỔNG TIỀN / KIỂM TRA MÃ KHUYẾN MÃI
    # -------------------------------------------------------------------------
    if cancel_eligibility:
        return _cancel_eligibility_message(cancel_eligibility, h_info, lang=lang)

    qp = hotel_context.get('queried_promo')
    if price_estimate and not (qp and not qp.get('valid')):
        return _price_estimate_message(price_estimate, lang=lang)

    if qp:
        return _promo_status_message(qp, lang=lang)

    # -------------------------------------------------------------------------
    # 1. TRỢ LÝ CHO KHÁCH ĐANG LƯU TRÚ: HÓA ĐƠN TẠM TÍNH / TIẾN TRÌNH ĐỒ ĂN / WIFI & HỒ BƠI
    # -------------------------------------------------------------------------
    is_bill_query = any(k in msg for k in [
        'hóa đơn tạm tính', 'tạm tính', 'tiền phòng của tôi', 'tổng chi phí', 'phát sinh', 'minibar',
        'hóa đơn phòng', 'thanh toán bao nhiêu', 'hết bao nhiêu tiền', 'folio', 'my bill', 'current bill', 'charges',
        '정산서', '요금 내역', '账单'
    ])
    if is_bill_query:
        if not active_stay:
            if lang == 'en':
                return (
                    "To view your real-time **Provisional Folio**, please **sign in** to your guest account or provide **both your Booking Code (`BK-...`) and Phone Number** in one message."
                )
            if lang == 'ko':
                return (
                    "실시간 **객실 정산 내역(Provisional Folio)**을 확인하시려면 **로그인**하시거나 한 번의 메시지에 **예약 번호(`BK-...`)와 전화번호**를 함께 입력해 주세요."
                )
            if lang == 'zh':
                return (
                    "如需查看您的实时**暂估账单 (Provisional Folio)**，请先**登录账号**，或在同一条消息中同时提供**订单号（`BK-...`）和手机号**。"
                )
            return (
                "Dạ để xem **Bảng kê Hóa đơn tạm tính (Provisional Folio)** của phòng mình, Quý khách vui lòng **đăng nhập** hoặc nhắn kèm **Mã đơn + SĐT đặt phòng** (VD: `Hóa đơn BK-3C2E8F 0918889999`) ạ!"
            )

        if lang == 'en':
            return (
                f"Dear Valued Guest, here is the real-time **Provisional Folio** for **Room P.{active_stay['room_number']}** (Booking `#{active_stay['booking_code']}`):\n\n"
                f"• **Room Charge ({active_stay['category_name']}, {active_stay['check_in_date']} ➔ {active_stay['check_out_date']})**: **{active_stay['room_total_formatted']}**\n"
                f"• **Manual Extras & Minibar**: **{active_stay['extra_total_formatted']}**\n"
                f"• **In-Room Services (Dining / Spa / Transfer)**: **{active_stay['service_total_formatted']}**\n"
                f"• **GRAND TOTAL**: **{active_stay['grand_total_formatted']}**\n"
                f"• **Paid**: **{active_stay.get('paid_total_formatted', '0 đ')}** | **Remaining Balance**: **{active_stay['unpaid_additional_formatted']}**\n\n"
                f"You can settle the remaining balance quickly via **VietQR** or at the Front Desk upon check-out!"
            )
        if lang == 'ko':
            return (
                f"**P.{active_stay['room_number']}호** (예약 `#{active_stay['booking_code']}`)의 실시간 **정산 내역(Folio)**입니다:\n\n"
                f"• **객실 요금 ({active_stay['category_name']}, {active_stay['check_in_date']} ➔ {active_stay['check_out_date']})**: **{active_stay['room_total_formatted']}**\n"
                f"• **미니바 / 추가 요금**: **{active_stay['extra_total_formatted']}**\n"
                f"• **룸서비스 / 스파 / 차량 서비스**: **{active_stay['service_total_formatted']}**\n"
                f"• **총 합계**: **{active_stay['grand_total_formatted']}**\n"
                f"• **결제 완료**: **{active_stay.get('paid_total_formatted', '0 đ')}** | **잔여 결제 금액**: **{active_stay['unpaid_additional_formatted']}**\n\n"
                f"체크아웃 시 프런트 데스크 또는 **VietQR**로 간편하게 정산하실 수 있습니다!"
            )
        if lang == 'zh':
            return (
                f"为您呈现 **P.{active_stay['room_number']}号房**（订单 `#{active_stay['booking_code']}`）的实时**暂估账单明细**：\n\n"
                f"• **房费 ({active_stay['category_name']}, {active_stay['check_in_date']} ➔ {active_stay['check_out_date']})**: **{active_stay['room_total_formatted']}**\n"
                f"• **迷你吧及附加费用**: **{active_stay['extra_total_formatted']}**\n"
                f"• **客房送餐 / 水疗 / 用车服务**: **{active_stay['service_total_formatted']}**\n"
                f"• **账单总计**: **{active_stay['grand_total_formatted']}**\n"
                f"• **已支付**: **{active_stay.get('paid_total_formatted', '0 đ')}** | **待结算余额**: **{active_stay['unpaid_additional_formatted']}**\n\n"
                f"退房时您可以通过 **VietQR** 扫码或在酒店前台快速结清余额！"
            )

        extra_lines = "\n".join([
            f"  + {ex['name']} (x{ex['quantity']}): **{ex['total_formatted']}** ({'Đã TT' if ex['is_paid'] else 'Chưa TT'})"
            for ex in active_stay['extra_items']
        ]) or "  + *Chưa có phụ phí Minibar / Giặt ủi*"

        svc_lines = "\n".join([
            f"  + {sr['service_name']} (x{sr['quantity']}): **{sr['total_formatted']}** — *{sr['status_label']}*"
            for sr in active_stay['service_orders'] if sr['status'] != 'cancelled'
        ]) or "  + *Chưa có dịch vụ gọi thêm*"

        return (
            f"Dạ em xin gửi Quý khách **Bảng kê Hóa đơn tạm tính (Provisional Folio)** thời gian thực của **Phòng P.{active_stay['room_number']}** (Mã đơn `#{active_stay['booking_code']}`) ạ:\n\n"
            f"### Chi tiết chi phí lưu trú ({active_stay['check_in_date']} ➔ {active_stay['check_out_date']})\n"
            f"• **Tiền hạng phòng ({active_stay['category_name']})**: **{active_stay['room_total_formatted']}**\n"
            f"• **Phụ phí & Minibar phát sinh**: **{active_stay['extra_total_formatted']}**\n{extra_lines}\n"
            f"• **Dịch vụ Ẩm thực / Spa / Xe gọi thêm**: **{active_stay['service_total_formatted']}**\n{svc_lines}\n\n"
            f"• **TỔNG CỘNG TẠM TÍNH**: **{active_stay['grand_total_formatted']}**\n"
            f"• **Đã thanh toán**: **{active_stay.get('paid_total_formatted', '0 đ')}** | **Còn lại cần quyết toán**: **{active_stay['unpaid_additional_formatted']}**\n\n"
            f"Quý khách có thể thanh toán nhanh qua mã **VietQR tự động** tại quầy Lễ tân khi làm thủ tục trả phòng nhé ạ!"
        )

    # 1B. Hỏi về tiến trình đơn đồ ăn / dịch vụ vừa đặt
    is_service_order_status = any(k in msg for k in [
        'đơn đồ ăn', 'món ăn tôi đặt', 'đồ ăn tới đâu', 'ở bước nào', 'bao giờ có đồ ăn',
        'dịch vụ tôi đặt', 'đơn dịch vụ', 'order status', 'my food', 'room service status',
        '주문 상태', '음식 언제', '룸서비스 상태', '订单状态', '送餐进度', '点的餐'
    ])
    if is_service_order_status:
        if active_stay and active_stay['service_orders']:
            if lang == 'en':
                lines_en = [f"Here is the live progress for room service orders in **Room P.{active_stay['room_number']}**:\n"]
                for sr in active_stay['service_orders']:
                    lines_en.append(f"• **{sr['service_name']} (×{sr['quantity']})** — **{sr['total_formatted']}** | Status: **{sr['status_label']}** ({sr['created_time']})")
                return "\n".join(lines_en)
            if lang == 'ko':
                lines_ko = [f"**P.{active_stay['room_number']}호** 룸서비스 주문 진행 현황입니다:\n"]
                for sr in active_stay['service_orders']:
                    lines_ko.append(f"• **{sr['service_name']} (×{sr['quantity']})** — **{sr['total_formatted']}** | 상태: **{sr['status_label']}** ({sr['created_time']})")
                return "\n".join(lines_ko)
            if lang == 'zh':
                lines_zh = [f"以下是 **P.{active_stay['room_number']}号房** 的客房服务实时进度：\n"]
                for sr in active_stay['service_orders']:
                    lines_zh.append(f"• **{sr['service_name']} (×{sr['quantity']})** — **{sr['total_formatted']}** | 状态: **{sr['status_label']}** ({sr['created_time']})")
                return "\n".join(lines_zh)

            order_lines = []
            for sr in active_stay['service_orders']:
                staff_info = f" | Nhân viên phụ trách: **{sr['staff_name']}**" if sr['staff_name'] else ""
                order_lines.append(
                    f"• **{sr['service_name']} (x{sr['quantity']})** — Giá: **{sr['total_formatted']}**\n"
                    f"  ➔ Tiến trình: **{sr['status_label']}** *(Đặt lúc {sr['created_time']}{staff_info})*"
                )
            return (
                f"Dạ em đã kiểm tra tiến trình các yêu cầu dịch vụ tại **Phòng P.{active_stay['room_number']}** của Quý khách:\n\n"
                + "\n\n".join(order_lines) +
                f"\n\nBộ phận Ẩm thực & Dịch vụ đang phục vụ Quý khách với tốc độ ưu tiên cao nhất. Nếu cần hối đơn gấp, Quý khách vui lòng liên hệ Hotline nội bộ **{h_info['hotline']}** nhé ạ!"
            )
        if lang == 'en':
            return (
                "There are currently no pending room service or food orders under your stay. "
                "You can open **Services Menu** (`/services`) or tap a **Service Card** below to place an order 24/7!"
            )
        if lang == 'ko':
            return (
                "현재 진행 중인 룸서비스 또는 음식 주문 내역이 없습니다. 아래 **서비스 카드**를 선택하시거나 **서비스 메뉴**(`/services`)에서 24시간 주문하실 수 있습니다!"
            )
        if lang == 'zh':
            return (
                "目前暂无正在处理的客房送餐或服务订单。您可以点击下方的**服务卡片**或前往**服务菜单**（`/services`）随时下单！"
            )
        return (
            "Dạ hiện tại trên hệ thống em chưa ghi nhận đơn gọi món hoặc dịch vụ phòng nào đang chờ xử lý của Quý khách ạ.\n\n"
            "Quý khách có thể bấm vào **Thẻ Dịch vụ & Ẩm thực** bên dưới hoặc vào mục **Menu Dịch Vụ** để đặt món, Ocean Spa hoặc xe đưa đón phục vụ tận phòng 24/7 nhé ạ!"
        )

    # 1C. Hỏi về Chính sách Hủy phòng / Check-in sớm / Check-out muộn
    is_policy_query = any(k in msg for k in [
        'chính sách hủy', 'hủy phòng', 'hoàn tiền', 'check-in sớm', 'nhận phòng sớm', 'trả phòng muộn', 'check-out muộn',
        'phụ thu', 'giữ phòng', 'cancellation', 'refund', 'early check', 'late check', 'surcharge', '취소', '환불', '取消', '退款'
    ])
    if is_policy_query:
        free_h = policies.get('cancellation_free_hours', 48)
        hold_m = policies.get('auto_cancel_minutes', 30)
        e_6 = int(policies.get('early_checkin_before_6am', 100))
        e_6_9 = int(policies.get('early_checkin_6am_9am', 50))
        e_9_12 = int(policies.get('early_checkin_9am_12pm', 30))
        l_12_15 = int(policies.get('late_checkout_12pm_3pm', 30))
        l_15_18 = int(policies.get('late_checkout_3pm_6pm', 50))
        l_18 = int(policies.get('late_checkout_after_6pm', 100))
        if lang == 'en':
            return (
                f"Dear Valued Guest, here are the official booking & surcharge policies at **{h_info['name']}**:\n\n"
                f"• **Standard Hours**: Check-in from **{h_info['check_in']}** | Check-out before **{h_info['check_out']}**.\n"
                f"• **Free Cancellation**: Free cancellation up to **{free_h} hours** prior to check-in.\n"
                f"• **Online Payment Hold**: Unpaid pending reservations are held for **{hold_m} minutes**.\n"
                f"• **Early Check-in Surcharge**: Before 06:00 (**{e_6}%**), 06:00–09:00 (**{e_6_9}%**), 09:00–12:00 (**{e_9_12}%** of room rate).\n"
                f"• **Late Check-out Surcharge**: 12:00–15:00 (**{l_12_15}%**), 15:00–18:00 (**{l_15_18}%**), after 18:00 (**{l_18}%**)."
            )
        if lang == 'ko':
            return (
                f"**{h_info['name']}**의 공식 예약 취소 및 얼리 체크인/레이트 체크아웃 규정 안내입니다:\n\n"
                f"• **기본 시간**: 체크인 **{h_info['check_in']}** 이후 | 체크아웃 **{h_info['check_out']}** 이전.\n"
                f"• **무료 취소**: 체크인 **{free_h}시간** 전까지 무료 취소 가능.\n"
                f"• **결제 대기 유지**: 온라인 미결제 예약은 **{hold_m}분**간 유지됩니다.\n"
                f"• **얼리 체크인 추가 요금**: 06:00 이전 (**{e_6}%**), 06:00–09:00 (**{e_6_9}%**), 09:00–12:00 (**{e_9_12}%**).\n"
                f"• **레이트 체크아웃 추가 요금**: 12:00–15:00 (**{l_12_15}%**), 15:00–18:00 (**{l_15_18}%**), 18:00 이후 (**{l_18}%**)."
            )
        if lang == 'zh':
            return (
                f"尊敬的贵宾，以下是 **{h_info['name']}** 的官方取消及提前入住/延迟退房收费政策：\n\n"
                f"• **标准时间**: **{h_info['check_in']}** 后办理入住 | **{h_info['check_out']}** 前办理退房。\n"
                f"• **免费取消**: 入住前 **{free_h} 小时**可免费取消预订。\n"
                f"• **在线保留时间**: 未支付待付款订单保留 **{hold_m} 分钟**。\n"
                f"• **提前入住附加费**: 06:00 前 (**{e_6}%**)、06:00–09:00 (**{e_6_9}%**)、09:00–12:00 (**{e_9_12}%**)。\n"
                f"• **延迟退房附加费**: 12:00–15:00 (**{l_12_15}%**)、15:00–18:00 (**{l_15_18}%**)、18:00 后 (**{l_18}%**)。"
            )
        return (
            f"Dạ em xin thông tin tới Quý khách **Chính sách Hủy phòng & Phụ thu Nhận/Trả phòng** tại **{h_info['name']}** ạ:\n\n"
            f"• **Giờ tiêu chuẩn**: Nhận phòng từ **{h_info['check_in']}** | Trả phòng trước **{h_info['check_out']}**.\n"
            f"• **Hủy phòng miễn phí**: Trước giờ nhận phòng **{free_h} giờ**.\n"
            f"• **Thời gian giữ phòng chờ thanh toán online**: **{hold_m} phút**.\n"
            f"• **Phụ thu Nhận phòng sớm (Early Check-in)**:\n"
            f"  + Trước 06:00: **{e_6}%** giá phòng/đêm | 06:00 – 09:00: **{e_6_9}%** | 09:00 – 12:00: **{e_9_12}%**\n"
            f"• **Phụ thu Trả phòng muộn (Late Check-out)**:\n"
            f"  + 12:00 – 15:00: **{l_12_15}%** | 15:00 – 18:00: **{l_15_18}%** | Sau 18:00: **{l_18}%**"
        )

    # 1D. Hỏi về Mật khẩu Wifi / Giờ mở cửa Hồ bơi / Ăn sáng / Gym
    is_facility_info = any(k in msg for k in [
        'wifi', 'mật khẩu', 'password', 'pass wifi', 'mạng',
        'hồ bơi', 'bể bơi', 'pool', 'swimming', 'ăn sáng', 'buffet', 'breakfast',
        'gym', 'fitness', 'mấy giờ', 'giờ mở cửa', 'nhận phòng', 'trả phòng', 'check-in', 'check-out', 'check in', 'check out',
        '와이파이', '수영장', '조식', '체크인', '无线网', '泳池', '早餐', '入住'
    ])
    if is_facility_info:
        room_badge = f" (Phòng **P.{active_stay['room_number']}** - Tầng {active_stay['floor']})" if active_stay else ""
        wifi_name = active_stay['wifi_ssid'] if active_stay else h_info['wifi_ssid']
        wifi_pwd = active_stay['wifi_pass'] if active_stay else h_info['wifi_pass']
        if lang == 'en':
            return (
                f"Dear Valued Guest{room_badge}, here is the essential information for your stay at **{h_info['name']}**:\n\n"
                f"• **High-Speed Wi-Fi**: Network **`{wifi_name}`** | Password: **`{wifi_pwd}`**\n"
                f"• **Rooftop Infinity Pool**: **06:00 – 22:00** at **15th Floor** (Panoramic My Khe ocean view, free towels).\n"
                f"• **International Buffet Breakfast**: **06:30 – 10:00** at **The Ocean Restaurant – 2nd Floor**.\n"
                f"• **TA Ocean Spa & Fitness Center**: **07:00 – 22:00** at **3rd Floor**.\n"
                f"• **Check-in / Check-out Policy**: Standard Check-in from **{h_info['check_in']}** | Check-out before **{h_info['check_out']}**.\n\n"
                f"How else may I make your stay more comfortable today?"
            )
        if lang == 'ko':
            return (
                f"고객님{room_badge}, **{h_info['name']}**의 주요 시설 및 이용 안내입니다:\n\n"
                f"• **고속 와이파이(Wi-Fi)**: 네트워크 **`{wifi_name}`** | 비밀번호: **`{wifi_pwd}`**\n"
                f"• **루프탑 인피니티 풀**: **06:00 – 22:00** (15층)\n"
                f"• **조식 뷔페**: **06:30 – 10:00** (2층 The Ocean 레스토랑)\n"
                f"• **체크인 / 체크아웃**: 체크인 **{h_info['check_in']}** 이후 | 체크아웃 **{h_info['check_out']}** 이전"
            )
        if lang == 'zh':
            return (
                f"尊敬的贵宾{room_badge}，以下是 **{h_info['name']}** 的设施与入住须知：\n\n"
                f"• **高速 Wi-Fi**: 网络 **`{wifi_name}`** | 密码: **`{wifi_pwd}`**\n"
                f"• **无边泳池**: **06:00 – 22:00**（15楼）\n"
                f"• **国际自助早餐**: **06:30 – 10:00**（2楼 The Ocean 餐厅）\n"
                f"• **入住 / 退房时间**: 入住 **{h_info['check_in']}** 起 | 退房 **{h_info['check_out']}** 前"
            )
        return (
            f"Dạ em xin gửi Quý khách{room_badge} thông tin tiện ích nội khu và quy định lưu trú tại **{h_info['name']}** ạ:\n\n"
            f"• **Wifi tốc độ cao 5G**: Tên mạng **`{wifi_name}`** | Mật khẩu: **`{wifi_pwd}`**\n"
            f"• **Hồ bơi Vô cực (Infinity Pool)**: Mở cửa **06:00 – 22:00** tại **Tầng 15 (Tầng thượng)** ngắm trọn biển Mỹ Khê (miễn phí khăn tắm & ghế thư giãn).\n"
            f"• **Buffet Sáng Quốc Tế**: Phục vụ từ **06:30 – 10:00** tại **Nhà hàng The Ocean – Tầng 2**.\n"
            f"• **TA Ocean Spa & Phòng Gym**: Mở cửa **07:00 – 22:00** tại **Tầng 3**.\n"
            f"• **Giờ Nhận / Trả phòng tiêu chuẩn**: Nhận phòng từ **{h_info['check_in']}** | Trả phòng trước **{h_info['check_out']}**.\n\n"
            f"Nếu Quý khách cần gọi đồ ăn lên phòng hoặc yêu cầu dọn phòng, hãy nhắn ngay cho em nhé ạ!"
        )

    # -------------------------------------------------------------------------
    # 2. TƯ VẤN DU LỊCH ĐÀ NẴNG & ĐIỀU HƯỚNG XE ĐƯA ĐÓN SÂN BAY VIP
    # -------------------------------------------------------------------------
    is_travel_query = any(k in msg for k in [
        'du lịch', 'chơi gì', 'đi đâu', 'tham quan', 'lịch trình', 'đà nẵng',
        'cầu rồng', 'phun lửa', 'bà nà', 'cầu vàng', 'sơn trà', 'linh ứng', 'hội an', 'ngũ hành sơn', 'mỹ khê',
        'tour', 'travel', 'sightseeing', 'itinerary', 'dragon bridge', 'ba na', 'golden bridge', 'hoi an', 'marble mountain',
        '다낭 여행', '관광', '용다리', '바나힐', '호이안', '미케비치',
        '岘港旅游', '景点', '龙桥', '巴拿山', '会安', '美溪'
    ])
    if is_travel_query:
        shuttle_en = (
            "\n\n**VIP Chauffeur & Airport Transfer**: You can book our transfer service directly via the **Service Card** below!"
            if hotel_context.get('has_shuttle_service') else ""
        )
        shuttle_vi = (
            "\n\n**Đặc quyền Xe Đưa Đón VIP**: Em đã hiển thị **Thẻ Đặt Xe Đưa Đón** ngay bên dưới để Quý khách đặt nhanh 1 chạm ạ!"
            if hotel_context.get('has_shuttle_service') else ""
        )
        if lang == 'en':
            return (
                f"Dear Valued Guest, as your Local Concierge in Da Nang, I have curated the finest attractions around **{h_info['name']}**:\n\n"
                f"• **Dragon Bridge (Cầu Rồng)** *(5 mins / 3km)*: Fire & Water show at **21:00 every Saturday, Sunday** and major holidays.\n"
                f"• **My Khe Beach** *(1 min walk)*: One of the world's most beautiful beaches right across the street.\n"
                f"• **Son Tra Peninsula & Lady Buddha** *(12 mins / 8km)*: 67m Goddess of Mercy statue overlooking the sea.\n"
                f"• **Marble Mountains** *(10 mins / 7km)*: Limestone caves & Non Nuoc stone village.\n"
                f"• **Sun World Ba Na Hills & Golden Bridge** *(45 mins / 35km)*: Giant hands bridge & French Village.\n"
                f"• **Hoi An Ancient Town** *(30 mins / 28km)*: UNESCO lantern town, best visited **16:30 – 21:30**."
                f"{shuttle_en}"
            )
        if lang == 'ko':
            return (
                f"**{h_info['name']}** 주변 다낭 추천 여행 코스 안내입니다:\n\n"
                f"• **미케 비치** *(도보 1분)*: 호텔 바로 앞, 세계 6대 아름다운 해변.\n"
                f"• **용다리 (Dragon Bridge)** *(차량 5분 / 3km)*: 매주 토·일요일 **21:00** 불쇼 및 물쇼.\n"
                f"• **선짜 반도 & 영흥사** *(차량 12분 / 8km)*: 67m 해수관음상 및 오션뷰.\n"
                f"• **오행산 (Marble Mountains)** *(차량 10분 / 7km)*: 대리석 동굴 사원.\n"
                f"• **바나힐 & 골든 브릿지** *(차량 45분 / 35km)*: 오전 **07:30 – 08:00** 출발 추천.\n"
                f"• **호이안 올드타운** *(차량 30분 / 28km)*: 유네스코 등재 등불 거리 (**16:30 – 21:30** 방문 추천)."
            )
        if lang == 'zh':
            return (
                f"尊敬的贵宾，以下是 **{h_info['name']}** 周边的岘港精选旅游攻略：\n\n"
                f"• **美溪海滩** *（步行1分钟）*：酒店正对面，世界最美海滩之一。\n"
                f"• **龙桥 (Dragon Bridge)** *（车程5分钟 / 3公里）*：每周六、周日 **21:00** 喷火喷水表演。\n"
                f"• **山茶半岛 & 灵应寺** *（车程12分钟 / 8公里）*：67米高南海观音像。\n"
                f"• **五行山** *（车程10分钟 / 7公里）*：喀斯特溶洞与石雕村。\n"
                f"• **巴拿山 & 佛手金桥** *（车程45分钟 / 35公里）*：建议 **07:30 – 08:00** 出发。\n"
                f"• **会安古镇** *（车程30分钟 / 28公里）*：灯笼水乡（最佳游览时间 **16:30 – 21:30**）。"
            )
        return (
            f"Dạ với lợi thế tọa lạc ngay mặt tiền biển Mỹ Khê, từ **{h_info['name']}** Quý khách có thể dễ dàng khám phá những biểu tượng du lịch tuyệt đẹp của Đà Nẵng – Hội An ạ:\n\n"
            f"### Lịch trình & Điểm tham quan nổi bật từ Khách sạn\n"
            f"• **Bãi biển Mỹ Khê** *(Chỉ 1 phút đi bộ qua đường)*: Tuyệt đẹp để tắm biển và ngắm bình minh lúc **05:15 – 06:30**.\n"
            f"• **Cầu Rồng phun lửa & nước** *(3km – 5 phút đi xe)*: Trình diễn vào đúng **21:00 tối Thứ Bảy, Chủ Nhật** hàng tuần.\n"
            f"• **Bán đảo Sơn Trà & Chùa Linh Ứng** *(8km – 12 phút đi xe)*: Chiêm bái tượng Phật Bà Quan Âm cao 67m hướng biển.\n"
            f"• **Danh thắng Ngũ Hành Sơn** *(7km – 10 phút đi xe)*: Khám phá động Huyền Không và làng đá mỹ nghệ Non Nước.\n"
            f"• **Sun World Bà Nà Hills & Cầu Vàng** *(35km – 45 phút đi xe)*: Nên khởi hành lúc **07:30 sáng**.\n"
            f"• **Phố cổ Hội An** *(28km – 30 phút đi xe)*: Phố đèn lồng di sản lung linh bên sông Hoài (đẹp nhất **16:30 – 21:30**)."
            f"{shuttle_vi}"
        )

    # -------------------------------------------------------------------------
    # 3. TRA CỨU ĐƠN ĐẶT PHÒNG (BOOKING & GROUP TRACKER ĐÃ XÁC THỰC)
    # -------------------------------------------------------------------------
    if tracked_bookings and len(tracked_bookings) > 0:
        bk = tracked_bookings[0]
        if lang == 'en':
            return (
                f"Dear Valued Guest, I have retrieved reservation **#{bk['booking_code']}** from our system:\n\n"
                f"• **Guest / Leader**: {bk['guest_name']}\n"
                f"• **Room / Group**: {bk['room_category']} ({bk['room_name']})\n"
                f"• **Stay Period**: Check-in **{bk['check_in_date']}** ➔ Check-out **{bk['check_out_date']}**\n"
                f"• **Total Price**: **{bk['total_amount']}**\n"
                f"• **Current Status**: **{bk['status_label']}**\n\n"
                f"I have displayed the **Real-Time Booking Progress Tracker** right below!"
            )
        if lang == 'ko':
            return (
                f"고객님 안녕하십니까! 시스템에서 예약 내역 **#{bk['booking_code']}**을(를) 확인하였습니다:\n\n"
                f"• **예약자명**: {bk['guest_name']}\n"
                f"• **객실 / 단체**: {bk['room_category']} ({bk['room_name']})\n"
                f"• **투숙 기간**: 체크인 **{bk['check_in_date']}** ➔ 체크아웃 **{bk['check_out_date']}**\n"
                f"• **총 금액**: **{bk['total_amount']}**\n"
                f"• **진행 상태**: **{bk['status_label']}**\n\n"
                f"아래에 **실시간 예약 진행 카드**를 준비해 두었습니다!"
            )
        if lang == 'zh':
            return (
                f"尊敬的贵宾，您好！已为您查询到预订信息 **#{bk['booking_code']}**：\n\n"
                f"• **联系人/宾客**: {bk['guest_name']}\n"
                f"• **房型/团队**: {bk['room_category']} ({bk['room_name']})\n"
                f"• **入住时间**: 入住 **{bk['check_in_date']}** ➔ 退房 **{bk['check_out_date']}**\n"
                f"• **总计金额**: **{bk['total_amount']}**\n"
                f"• **当前状态**: **{bk['status_label']}**\n\n"
                f"下方已为您展示**实时预订进度卡片**！"
            )
        return (
            f"Dạ em đã kiểm tra và tìm thấy thông tin đơn đặt phòng **#{bk['booking_code']}** trên hệ thống ạ:\n\n"
            f"• **Khách hàng / Trưởng đoàn**: {bk['guest_name']}\n"
            f"• **Phòng / Hạng**: {bk['room_category']} ({bk['room_name']})\n"
            f"• **Thời gian**: Nhận phòng **{bk['check_in_date']}** ➔ Trả phòng **{bk['check_out_date']}**\n"
            f"• **Tổng tiền**: **{bk['total_amount']}**\n"
            f"• **Tiến trình hiện tại**: **{bk['status_label']}**\n\n"
            f"Em đã hiển thị **Thẻ tiến trình đơn hàng thời gian thực** ngay bên dưới để Quý khách tiện theo dõi ạ!"
        )

    is_booking_query = any(k in msg for k in [
        'đơn đặt phòng', 'đặt phòng của tôi', 'kiểm tra đơn', 'tra cứu đơn', 'mã đơn', 'trạng thái đơn',
        'my booking', 'check booking', 'track reservation', '예약 조회', '내 예약', '预订查询', '我的订单'
    ])
    if is_booking_query:
        if user_ctx and user_ctx.get('recent_bookings'):
            reply_lines = [
                f"Dạ em kính chào Quý khách **{user_ctx['full_name']}** (Hạng thẻ **{user_ctx['vip_tier']}**)! Em xin gửi thông tin các đơn đặt phòng gần đây của Quý khách:\n"
            ]
            for b in user_ctx['recent_bookings']:
                reply_lines.append(
                    f"**Mã đơn: #{b['code']}**\n"
                    f"  • Phòng: **{b['room']}**\n"
                    f"  • Lưu trú: **{b['check_in']}** ➔ **{b['check_out']}**\n"
                    f"  • Trạng thái: **{b['status']}** ({b['is_paid']})\n"
                    f"  • Tổng tiền: **{b['total_amount']}**"
                )
            return "\n\n".join(reply_lines)
        return _verification_message({'reason': 'verification_required'}, lang=lang)

    # -------------------------------------------------------------------------
    # 4. CÂU HỎI NỐI TIẾP VỀ 1 HẠNG PHÒNG CỤ THỂ
    # -------------------------------------------------------------------------
    rooms = hotel_context.get('rooms', [])
    specific_room = resolve_room_from_conversation(message, history, rooms)
    is_detail_followup = any(k in msg for k in [
        'phòng đó', 'phòng này', 'hạng đó', 'hạng này', 'bồn tắm', 'jacuzzi', 'ban công', 'hướng biển', 'view',
        'rộng bao nhiêu', 'diện tích', 'mấy người', 'sức chứa', 'giường gì', 'tiện nghi', 'có gì',
        'that room', 'this room', 'bathtub', 'balcony', 'sea view', 'ocean view', 'how big', 'amenities'
    ])
    if specific_room and (is_detail_followup or specific_room['name'].lower() in msg):
        avail_txt = (
            f"Còn **{specific_room['available_count']} phòng trống**"
            if specific_room['available_count'] > 0
            else "Hiện đã **kín phòng** trong khoảng ngày này"
        )
        date_label = f"từ **{d_info.get('check_in_display')}** đến **{d_info.get('check_out_display')}** ({d_info.get('nights', 1)} đêm)"
        total_est = specific_room['effective_price'] * d_info.get('nights', 1)
        total_est_str = format_currency_multilingual(total_est, lang=lang)

        if lang == 'en':
            return (
                f"Dear Valued Guest, here are the detailed specifications and real-time availability for **{specific_room['name']}**:\n\n"
                f"• **Room Size & Bed**: **{specific_room['size']} m²** | **{specific_room['bed_type']}** (Max **{specific_room['capacity']} adults**)\n"
                f"• **Luxury Amenities**: {specific_room['all_amenities']}\n"
                f"• **Highlights**: {specific_room['description']}\n"
                f"• **Availability ({d_info.get('check_in_display')} ➔ {d_info.get('check_out_display')})**: **{specific_room['available_count']} rooms available**\n"
                f"• **Rate**: **{specific_room['effective_price_multilingual']}** / night *(Total for {d_info.get('nights', 1)} night(s): **{total_est_str}**)*\n\n"
                f"You can click **[Book Now]** on the interactive card below to reserve this room with your dates pre-filled!"
            )
        return (
            f"Dạ em xin gửi Quý khách thông tin chi tiết và lịch trống thực tế của hạng phòng **{specific_room['name']}** ạ:\n\n"
            f"• **Diện tích & Giường**: Rộng **{specific_room['size']} m²** | **{specific_room['bed_type']}** (Tối đa **{specific_room['capacity']} người lớn**)\n"
            f"• **Tiện nghi cao cấp**: {specific_room['all_amenities']}\n"
            f"• **Điểm nhấn không gian**: {specific_room['description']}\n"
            f"• **Tình trạng lịch trống ({date_label})**: {avail_txt}\n"
            f"• **Giá ưu đãi**: **{specific_room['effective_price_multilingual']}** / đêm *(Tạm tính {d_info.get('nights', 1)} đêm: **{total_est_str}**)*\n\n"
            f"Em đã đính kèm **Thẻ đặt phòng nhanh** bên dưới, Quý khách bấm vào nút **[Đặt ngay]** hệ thống sẽ tự động điền sẵn ngày nhận/trả phòng cho Quý khách ạ!"
        )

    # -------------------------------------------------------------------------
    # 5. TRA CỨU PHÒNG TRỐNG THEO NGÀY, SỐ KHÁCH & BẢNG SO SÁNH GIÁ PHÒNG
    # -------------------------------------------------------------------------
    guest_count = hotel_context.get('guest_count')
    is_room_query = bool(guest_count and any(k in msg for k in ['phòng', 'room', 'đặt', 'book', '객실', '房'])) or any(k in msg for k in [
        'phòng', 'giá', 'trống', 'còn phòng', 'hạng phòng', 'loại phòng', 'room', 'đêm', 'bao nhiêu',
        'ngày mai', 'cuối tuần', 'tuần sau', 'tối nay', 'hôm nay', 'so sánh',
        'rate', 'rates', 'cost', 'available', 'availability', 'suite', 'deluxe', 'tomorrow', 'weekend',
        '객실', '방', '요금', '가격', '예약', '스위트', '디럭스', '내일',
        '房', '客房', '价格', '房价', '预订', '套房', '空房', '明天'
    ])
    if is_room_query and rooms:
        display_rooms = rooms
        if guest_count:
            matching_rooms = [r for r in rooms if int(r.get('capacity', 2)) >= int(guest_count)]
            if matching_rooms:
                display_rooms = matching_rooms

        date_header = (
            f"từ **{d_info.get('check_in_display')}** đến **{d_info.get('check_out_display')}** ({d_info.get('nights', 1)} đêm)"
            if d_info.get('is_custom_date')
            else f"hôm nay (**{d_info.get('check_in_display')}** ➔ **{d_info.get('check_out_display')}**)"
        )
        vip_note = ""
        if user_ctx and user_ctx.get('discount_rate') and user_ctx['discount_rate'] not in ['0%', '0']:
            vip_note = f"\n*Đặc quyền Hội viên **{user_ctx['vip_tier']}**: Quý khách được giảm thêm **{user_ctx['discount_rate']}** trực tiếp khi đặt phòng!*\n"

        if lang == 'en':
            guest_lbl = f" for **{guest_count} guests**" if guest_count else ""
            lines = [
                f"Dear Valued Guest, I have checked our real-time reservation calendar{guest_lbl} from **{d_info.get('check_in_display')}** to **{d_info.get('check_out_display')}** ({d_info.get('nights', 1)} night(s)):\n",
                "| Room Category | Size / Capacity | Nightly Rate | Real-Time Status |",
                "| :--- | :--- | :--- | :--- |"
            ]
            for r in display_rooms:
                avail_cell = f"**{r['available_count']} left**" if r['available_count'] > 0 else "Sold out"
                lines.append(f"| **{r['name']}** | {r['size']}m² • {r['capacity']} Guests | **{r['effective_price_multilingual']}** | {avail_cell} |")
            lines.append(f"\n**Standard Hours**: Check-in **{h_info['check_in']}** | Check-out **{h_info['check_out']}**.")
            lines.append("Select any room card below to view photos or book immediately with your dates pre-filled!")
            return "\n".join(lines)
        if lang == 'ko':
            lines = [
                f"고객님 안녕하십니까! **{d_info.get('check_in_display')} ~ {d_info.get('check_out_display')} ({d_info.get('nights', 1)}박)** 기준 실시간 잔여 객실 및 요금표입니다:\n",
                "| 객실 등급 | 면적 / 정원 | 1박 요금 (KRW) | 실시간 잔여 객실 |",
                "| :--- | :--- | :--- | :--- |"
            ]
            for r in display_rooms:
                avail_cell = f"**{r['available_count']}실 가능**" if r['available_count'] > 0 else "마감"
                lines.append(f"| **{r['name']}** | {r['size']}m² • {r['capacity']}인 | **{r['effective_price_multilingual']}** | {avail_cell} |")
            lines.append("\n아래 객실 카드를 클릭하시면 선택한 날짜로 즉시 예약하실 수 있습니다!")
            return "\n".join(lines)
        if lang == 'zh':
            lines = [
                f"尊敬的贵宾，已为您查询 **{d_info.get('check_in_display')} 至 {d_info.get('check_out_display')}（共{d_info.get('nights', 1)}晚）** 的实时房态与房价对比表：\n",
                "| 客房房型 | 面积 / 人数 | 每晚房价 (CNY) | 实时剩余空房 |",
                "| :--- | :--- | :--- | :--- |"
            ]
            for r in display_rooms:
                avail_cell = f"**剩 {r['available_count']} 间**" if r['available_count'] > 0 else "已满房"
                lines.append(f"| **{r['name']}** | {r['size']}m² • {r['capacity']}人 | **{r['effective_price_multilingual']}** | {avail_cell} |")
            lines.append("\n点击下方房型卡片即可自动带入入住日期并立即预订！")
            return "\n".join(lines)

        guest_lbl_vi = f" (phù hợp **{guest_count} khách**)" if guest_count else ""
        lines = [
            f"Dạ em đã kiểm tra lịch phòng trống thời gian thực {date_header}{guest_lbl_vi} tại **{h_info['name']}** và tổng hợp bảng so sánh bên dưới cho Quý khách ạ:\n",
            "| Hạng Phòng | Diện tích & Sức chứa | Giá Ưu Đãi / Đêm | Lịch Trống Thực Tế |",
            "| :--- | :--- | :--- | :--- |"
        ]
        for r in display_rooms:
            avail_str = f"**Còn {r['available_count']} phòng**" if r['available_count'] > 0 else "Tạm kín lịch"
            lines.append(f"| **{r['name']}** | {r['size']}m² • {r['capacity']} khách ({r['bed_type']}) | **{r['effective_price_multilingual']}** | {avail_str} |")
        if vip_note:
            lines.append(vip_note)
        lines.append(f"\n**Giờ tiêu chuẩn**: Nhận phòng từ **{h_info['check_in']}** | Trả phòng trước **{h_info['check_out']}**.")
        lines.append("Quý khách có thể bấm nút **[Đặt ngay]** trên thẻ phòng bên dưới, hệ thống sẽ tự động điền sẵn ngày nhận/trả phòng cho Quý khách ạ!")
        return "\n".join(lines)

    # -------------------------------------------------------------------------
    # 6. DỊCH VỤ ẨM THỰC, SPA & ĐƯA ĐÓN SÂN BAY
    # -------------------------------------------------------------------------
    is_svc_query = any(k in msg for k in [
        'dịch vụ', 'ăn', 'ẩm thực', 'nhà hàng', 'spa', 'massage', 'xe', 'đưa đón', 'sân bay', 'giặt', 'bar', 'service', 'menu',
        'dining', 'food', 'restaurant', 'shuttle', 'airport',
        '서비스', '식사', '레스토랑', '스파', '마사지', '공항', '픽업', '샌딩', '조식',
        '服务', '餐饮', '餐厅', '水疗', '按摩', '机场', '接送', '早餐'
    ])
    if is_svc_query:
        services = hotel_context.get('services', [])
        if lang == 'en':
            lines = [f"Dear Valued Guest, **{h_info['name']}** offers 24/7 dining, Ocean Spa, and concierge services:\n"]
            if services:
                lines.append("| Service / Dish | Category | Rate |")
                lines.append("| :--- | :--- | :--- |")
                for s in services[:8]:
                    lines.append(f"| **{s['name']}** | {s['category']} | **{s['price_multilingual']}** |")
            lines.append("\nSelect any **Service Card** below to place an order or visit our Services Menu!")
            return "\n".join(lines)
        if lang == 'ko':
            lines = [f"**{h_info['name']}**의 24시간 다이닝, 스파 & 공항 픽업 서비스 안내입니다:\n"]
            if services:
                lines.append("| 서비스 / 메뉴 | 분류 | 요금 (KRW) |")
                lines.append("| :--- | :--- | :--- |")
                for s in services[:8]:
                    lines.append(f"| **{s['name']}** | {s['category']} | **{s['price_multilingual']}** |")
            lines.append("\n아래 **서비스 카드**를 선택하여 간편하게 주문하실 수 있습니다!")
            return "\n".join(lines)
        if lang == 'zh':
            lines = [f"**{h_info['name']}** 为您提供24小时餐饮、水疗及礼宾服务：\n"]
            if services:
                lines.append("| 服务 / 餐品名称 | 类别 | 参考价格 (CNY) |")
                lines.append("| :--- | :--- | :--- |")
                for s in services[:8]:
                    lines.append(f"| **{s['name']}** | {s['category']} | **{s['price_multilingual']}** |")
            lines.append("\n点击下方**服务卡片**即可前往菜单下单或预约！")
            return "\n".join(lines)

        lines = [
            f"Dạ **{h_info['name']}** hân hạnh phục vụ Quý khách hệ sinh thái dịch vụ & ẩm thực chuẩn {stars} sao quốc tế 24/7 ạ:\n",
            "• **Ẩm thực & In-room Dining (24/7)**: Thực đơn Á - Âu thượng hạng, Hải sản tươi sống và đặc sản địa phương.",
            "• **TA Ocean Spa & Wellness (Tầng 3)**: Xông hơi, trị liệu massage thảo dược.",
            "• **Giặt ủi & Phục vụ Buồng phòng**: Giặt hấp cao cấp lấy nhanh trong ngày."
        ]
        if services:
            lines.append("\n| Dịch vụ / Món ăn tiêu biểu | Phân loại | Đơn giá niêm yết |")
            lines.append("| :--- | :--- | :--- |")
            for s in services[:8]:
                lines.append(f"| **{s['name']}** | {s['category']} | **{s['price_multilingual']}** |")
        lines.append("\nQuý khách có thể bấm vào **Thẻ Dịch Vụ** bên dưới để xem thực đơn và đặt dịch vụ ngay lập tức ạ!")
        return "\n".join(lines)

    # -------------------------------------------------------------------------
    # 7. CHÍNH SÁCH CÔNG TY / ĐẶT ĐOÀN M.I.C.E / HÓA ĐƠN VAT
    # -------------------------------------------------------------------------
    if any(k in msg for k in [
        'công ty', 'doanh nghiệp', 'vat', 'hóa đơn', 'đoàn', 'b2b', 'hợp đồng', 'corporate', 'mice', 'thuế',
        'tax', 'company', 'invoice', '단체', '법인', '세금계산서', '企业', '发票', '团队'
    ]):
        c = hotel_context['corporate_policy']
        if lang == 'en':
            return (
                f"Dear Valued Partner, here are our **Corporate, Group & M.I.C.E** policies at **{h_info['name']}**:\n\n"
                f"• **Electronic VAT Invoice**: Full VAT invoice ({h_info['vat']}) issued promptly to your company email.\n"
                f"• **B2B Contract Discounts**: Corporate rates from **10% – 20% off**.\n"
                f"• **Events & Conferences**: Dedicated group booking portal (`/corporate-booking`), Gala Dinner & Team Building.\n"
                f"• **Corporate Credit Terms**: 15–30 day net payment terms for contracted partners.\n\n"
                f"Contact our Sales Hotline **{h_info['hotline']}** for a custom quotation within 15 minutes!"
            )
        if lang == 'ko':
            return (
                f"**{h_info['name']}**의 **기업·단체(M.I.C.E) 및 세금계산서** 안내입니다:\n\n"
                f"• **전자 세금계산서(VAT {h_info['vat']})**: 기업 이메일로 신속 발행해 드립니다.\n"
                f"• **B2B 기업 할인**: 제휴 기업 대상 **10% – 20%** 우대 요금 적용.\n"
                f"• **단체 예약 & 컨퍼런스**: 단체 예약 페이지(`/corporate-booking`) 지원.\n"
                f"• **전담 핫라인**: **{h_info['hotline']}** (15분 내 맞춤 견적 제공)."
            )
        if lang == 'zh':
            return (
                f"尊敬的企业客户，以下是 **{h_info['name']}** 的**企业差旅与团队 M.I.C.E** 政策：\n\n"
                f"• **电子增值税发票 (VAT {h_info['vat']})**: 快速开具并发送至贵司财务邮箱。\n"
                f"• **B2B 协议折扣**: 企业协议客户可享 **10% – 20%** 专属优惠。\n"
                f"• **团队与会议预订**: 支持团队批量预订页面 (`/corporate-booking`) 及宴会/团建定制。\n"
                f"• **销售热线**: **{h_info['hotline']}**（15分钟内提供定制报价）。"
            )
        return (
            f"Dạ về chính sách **Đặt phòng Doanh nghiệp & Đoàn thể (M.I.C.E)** tại **{h_info['name']}**, em xin thông tin chi tiết đến Quý khách:\n\n"
            f"• **Hóa đơn tài chính VAT**: {c['vat_invoice']}\n"
            f"• **Hợp đồng & Chiết khấu B2B**: {c['contracts']}\n"
            f"• **Tổ chức Sự kiện & Hội nghị**: {c['group_services']}\n"
            f"• **Hạn mức Công nợ**: {c['credit_terms']}\n\n"
            f"Quý công ty có thể gửi yêu cầu tại mục **'Đặt Đoàn & Doanh nghiệp'** trên thanh menu hoặc liên hệ Hotline Phòng Kinh Doanh **{h_info['hotline']}** để nhận báo giá trong 15 phút ạ!"
        )

    # -------------------------------------------------------------------------
    # 8. KHUYẾN MÃI / VOUCHER / HẠNG THẺ THÀNH VIÊN VIP (TỪ DB)
    # -------------------------------------------------------------------------
    if any(k in msg for k in [
        'khuyến mãi', 'voucher', 'ưu đãi', 'giảm giá', 'coupon', 'promo', 'vip', 'thành viên', 'silver', 'gold', 'platinum', 'diamond',
        'discount', 'deal', 'membership', '할인', '프로모션', '멤버십', '쿠폰', '优惠', '折扣', '会员'
    ]):
        tiers = hotel_context.get('membership_tiers', [])
        promos = hotel_context.get('promotions', [])
        if lang == 'en':
            lines = [f"Dear Valued Guest, here are the active **Membership Tiers** and **Promo Codes** at **{h_info['name']}**:\n"]
            for t in tiers:
                lines.append(f"• **{t['name']}** ({t['min_points']}+ pts): **{t['discount']} off** — {t['benefit']}")
            if promos:
                lines.append("\n| Promo Code | Campaign | Discount | Min Order |")
                lines.append("| :--- | :--- | :--- | :--- |")
                for p in promos:
                    lines.append(f"| **`{p['code']}`** | {p['name']} | **{p['discount']}** | {p['min_order']} |")
            lines.append("\nApply any promo code directly on the **Checkout** page!")
            return "\n".join(lines)
        if lang == 'ko':
            lines = [f"**{h_info['name']}**의 **멤버십 등급** 및 **진행 중인 프로모션 코드**입니다:\n"]
            for t in tiers:
                lines.append(f"• **{t['name']}** ({t['min_points']}점 이상): **{t['discount']} 할인** — {t['benefit']}")
            if promos:
                lines.append("\n| 프로모션 코드 | 캠페인 | 할인 혜택 | 최소 주문 |")
                lines.append("| :--- | :--- | :--- | :--- |")
                for p in promos:
                    lines.append(f"| **`{p['code']}`** | {p['name']} | **{p['discount']}** | {p['min_order']} |")
            lines.append("\n결제(Checkout) 페이지에서 코드를 입력하시면 즉시 적용됩니다!")
            return "\n".join(lines)
        if lang == 'zh':
            lines = [f"为您呈现 **{h_info['name']}** 的**会员等级礼遇**及**有效优惠码**：\n"]
            for t in tiers:
                lines.append(f"• **{t['name']}**（{t['min_points']} 积分起）：专享 **{t['discount']} 优惠** — {t['benefit']}")
            if promos:
                lines.append("\n| 优惠码 | 活动名称 | 折扣力度 | 最低消费 |")
                lines.append("| :--- | :--- | :--- | :--- |")
                for p in promos:
                    lines.append(f"| **`{p['code']}`** | {p['name']} | **{p['discount']}** | {p['min_order']} |")
            lines.append("\n在**结算 (Checkout)** 页面输入以上优惠码即可自动扣减！")
            return "\n".join(lines)

        lines = [
            f"Dạ **{h_info['name']}** đang áp dụng chương trình đặc quyền **Hội viên Club** và các mã Voucher giảm giá trực tiếp:\n",
            "### Đặc quyền Hạng thẻ Hội viên"
        ]
        for t in tiers:
            lines.append(f"• **{t['name']}** *(từ {t['min_points']} điểm)*: Giảm ngay **{t['discount']}** — {t['benefit']}")
        if promos:
            lines.append("\n### Mã Voucher Khuyến Mãi Đang Hoạt Động")
            lines.append("| Mã Voucher | Chương trình Ưu đãi | Mức Giảm | Đơn tối thiểu |")
            lines.append("| :--- | :--- | :--- | :--- |")
            for p in promos:
                lines.append(f"| **`{p['code']}`** | {p['name']} | **{p['discount']}** | {p['min_order']} |")
        lines.append("\nQuý khách chỉ cần chọn hoặc nhập mã giảm giá tại trang **Thanh toán (Checkout)** để được khấu trừ tự động ạ!")
        return "\n".join(lines)

    # -------------------------------------------------------------------------
    # 9. ĐỊA CHỈ / LIÊN HỆ / THANH TOÁN VIETQR
    # -------------------------------------------------------------------------
    if any(k in msg for k in [
        'địa chỉ', 'ở đâu', 'vị trí', 'hotline', 'liên hệ', 'sđt', 'số điện thoại', 'email', 'map',
        'thanh toán', 'chuyển khoản', 'qr', 'vietqr', 'sepay', 'cọc', 'address', 'location', 'contact', 'payment',
        '위치', '주소', '연락처', '결제', '地址', '位置', '联系', '支付', '付款'
    ]):
        if lang == 'en':
            return (
                f"Dear Valued Guest, here are the contact & payment details for **{h_info['name']}**:\n\n"
                f"• **Address**: {h_info['address']}\n"
                f"• **24/7 Concierge Hotline**: **{h_info['hotline']}** | Phone: **{h_info['phone']}** | Email: {h_info['email']}\n"
                f"• **Payment Methods**: Instant 24/7 **VietQR (Sepay)**, Visa/Mastercard/JCB, domestic ATM cards, or pay at the Front Desk."
            )
        if lang == 'ko':
            return (
                f"**{h_info['name']}** 위치 및 결제 안내입니다:\n\n"
                f"• **주소**: {h_info['address']}\n"
                f"• **24시간 컨시어지 핫라인**: **{h_info['hotline']}** | 전화: **{h_info['phone']}** | 이메일: {h_info['email']}\n"
                f"• **결제 수단**: 24시간 실시간 **VietQR**, 해외 카드(Visa/Mastercard/JCB), 프런트 현장 결제."
            )
        if lang == 'zh':
            return (
                f"为您附上 **{h_info['name']}** 的地址联系与支付方式：\n\n"
                f"• **酒店地址**: {h_info['address']}\n"
                f"• **24小时礼宾热线**: **{h_info['hotline']}** | 电话: **{h_info['phone']}** | 邮箱: {h_info['email']}\n"
                f"• **支付方式**: 支持24小时秒到账 **VietQR** 扫码、国际信用卡 (Visa/Mastercard/JCB) 及前台现付。"
            )
        return (
            f"Dạ em xin gửi Quý khách thông tin liên hệ và phương thức thanh toán tự động tại **{h_info['name']}** ạ:\n\n"
            f"• **Vị trí đắc địa**: {h_info['address']} *(Đối diện bãi biển Mỹ Khê, cách Sân bay Đà Nẵng 10 phút và Cầu Rồng 5 phút di chuyển)*.\n"
            f"• **Hotline Lễ tân & Concierge 24/7**: **{h_info['hotline']}** | Điện thoại: **{h_info['phone']}**\n"
            f"• **Email CSKH**: {h_info['email']}\n"
            f"• **Thanh toán tự động 24/7**: Hỗ trợ quét mã **VietQR động (cổng Sepay)** tự động xác nhận đơn trong 3 giây, thẻ quốc tế Visa/Mastercard/JCB hoặc thanh toán tại quầy Lễ tân ạ!"
        )

    # -------------------------------------------------------------------------
    # 10. LỜI CHÀO MẶC ĐỊNH CÁ NHÂN HÓA
    # -------------------------------------------------------------------------
    greeting_name = f"Quý khách **{user_ctx['full_name']}** ({user_ctx['vip_tier']})" if user_ctx else "Quý khách"
    inhouse_banner = ""
    if active_stay and active_stay.get('is_checked_in'):
        inhouse_banner = (
            f"\n*Hệ thống ghi nhận Quý khách đang lưu trú tại **Phòng P.{active_stay['room_number']}** (Mã đơn `#{active_stay['booking_code']}`). "
            f"Quý khách có thể hỏi em về **Hóa đơn tạm tính**, **Tiến trình đồ ăn**, **Mật khẩu Wifi** hoặc nhắn **'Dọn phòng giúp tôi'** bất cứ lúc nào ạ!*\n"
        )

    if lang == 'en':
        return (
            f"Dear Valued Guest! Welcome to the {stars}-Star AI Concierge of **{h_info['name']}**.\n\n"
            f"I am at your service 24/7 to assist with:\n"
            f"• **Date-Specific Room Availability & Rates (with USD conversion)**\n"
            f"• **24/7 In-Room Dining, Ocean Spa & Concierge Services**\n"
            f"• **Da Nang – Hoi An Sightseeing Itinerary & Dragon Bridge Show**\n"
            f"• **In-House Guest Services: Live Folio Bill, Wi-Fi & Instant Housekeeping**\n\n"
            f"How may I assist your stay in Da Nang today?"
        )
    if lang == 'ko':
        return (
            f"고객님 안녕하십니까! **{h_info['name']}** ({stars}성급) AI 컨시어지입니다.\n\n"
            f"• **날짜별 실시간 잔여 객실 및 요금 조회 (KRW 환산)**\n"
            f"• **다이닝, 스파 & 공항 픽업 서비스 안내**\n"
            f"• **예약 조회 (`BK-...` + 전화번호 입력) 및 투숙객 전용 서비스**\n\n"
            f"무엇을 도와드릴까요?"
        )
    if lang == 'zh':
        return (
            f"尊敬的贵宾，您好！欢迎咨询 **{h_info['name']}**（{stars}星级）AI礼宾顾问。\n\n"
            f"• **按日期查询实时空房与房价（人民币CNY换算）**\n"
            f"• **客房送餐、SPA水疗与机场接送服务**\n"
            f"• **预订进度查询（输入 `BK-...` 订单号与手机号）及在住贵宾服务**\n\n"
            f"请问有什么可以帮您？"
        )
    return (
        f"Dạ em kính chào {greeting_name}! Em là Trợ lý ảo AI Concierge {stars} sao của **{h_info['name']}** ạ.{inhouse_banner}\n"
        f"Em luôn sẵn sàng hỗ trợ Quý khách 24/7 về mọi nghiệp vụ:\n"
        f"• **Kiểm tra lịch phòng trống theo ngày thực tế & Bảng so sánh giá**\n"
        f"• **Thực đơn Ẩm thực tại phòng, Ocean Spa & Đặt xe đưa đón**\n"
        f"• **Tư vấn lịch trình Du lịch Đà Nẵng – Hội An – Bà Nà Hills**\n"
        f"• **Trợ lý lưu trú: Xem hóa đơn tạm tính, mật khẩu Wifi, gọi dọn phòng 1 chạm**\n\n"
        f"Quý khách đang cần em kiểm tra phòng cho ngày nào hay hỗ trợ dịch vụ gì, hãy nhắn cho em ngay nhé ạ!"
    )
