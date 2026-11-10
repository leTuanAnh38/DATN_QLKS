"""Trả lời dự phòng theo luật khi không gọi được AI."""
import logging

from ..models import Booking

logger = logging.getLogger(__name__)
from .context_builder import build_active_stay_details
from .text_utils import format_currency_multilingual
from .nlp_parser import resolve_room_from_conversation


def local_smart_fallback(message, user, hotel_context, tracked_bookings=None, lang='vi', history=None, housekeeping_action=None):
    """
    CƠ CHẾ FALLBACK THÔNG MINH ĐA NGÔN NGỮ (Offline / No Key / Quota Exceeded / Network Error):
    - Có bộ nhớ hội thoại nhiều lượt (Multi-turn Memory) nhờ tham số `history`.
    - Kiểm tra đúng số phòng trống theo ngày khách hỏi (`queried_dates`).
    - Giải đáp chi tiết tiện nghi từng hạng phòng (Jacuzzi, hướng biển, diện tích, giường).
    - Phục vụ khách đang lưu trú (`CHECKED_IN`): báo hóa đơn tạm tính, tiến trình đơn đồ ăn, mật khẩu Wifi, giờ hồ bơi, gọi dọn phòng.
    - Tư vấn du lịch Đà Nẵng (Cầu Rồng, Bà Nà, Hội An, Sơn Trà) kèm điều hướng đặt xe đưa đón VIP.
    """
    msg = message.strip().lower()
    h_info = hotel_context['hotel_info']
    d_info = hotel_context.get('queried_dates', {})
    user_ctx = hotel_context.get('user_context')
    active_stay = user_ctx.get('active_stay') if user_ctx else None

    # Nếu khách vừa tra cứu 1 đơn cụ thể mà chưa đăng nhập, lấy thông tin active_stay từ đơn đó
    if not active_stay and tracked_bookings and len(tracked_bookings) > 0:
        first_bk_obj = Booking.objects.filter(id=tracked_bookings[0]['id']).select_related('category', 'room').prefetch_related('extra_services', 'service_requests__service').first()
        if first_bk_obj:
            active_stay = build_active_stay_details(first_bk_obj, lang=lang)

    # -------------------------------------------------------------------------
    # 0. XỬ LÝ YÊU CẦU DỌN PHÒNG / BUỒNG PHÒNG CHO KHÁCH ĐANG LƯU TRÚ
    # -------------------------------------------------------------------------
    if housekeeping_action:
        r_num = housekeeping_action['room_number']
        if lang == 'en':
            return (
                f"Dear **{housekeeping_action['guest_name']}**, I have immediately dispatched an urgent **Housekeeping & Room Service Request** for **Room P.{r_num}** (Booking `#{housekeeping_action['booking_code']}`)!\n\n"
                f"• **Request Detail**: *{housekeeping_action['request_note']}*\n"
                f"• ⏱️ **Estimated Arrival**: Our Housekeeping attendant will arrive at your room within **5 – 10 minutes**.\n\n"
                f"If you need any additional amenities, please feel free to message me or dial **`0`** from your in-room telephone!"
            )
        return (
            f"Dạ em kính chào Quý khách **{housekeeping_action['guest_name']}**! Em đã lập tức chuyển lệnh **Yêu cầu Phục vụ Buồng phòng** cho **Phòng P.{r_num}** (Mã đơn `#{housekeeping_action['booking_code']}`) tới bộ phận Housekeeping rồi ạ:\n\n"
            f"• **Nội dung yêu cầu**: *{housekeeping_action['request_note']}*\n"
            f"• ⏱️ **Thời gian phản hồi**: Nhân viên Buồng phòng sẽ có mặt tại phòng Quý khách trong khoảng **5 – 10 phút** nữa ạ.\n"
            f"• **Trạng thái hệ thống**: Đã bật tín hiệu ưu tiên trên Sơ đồ phòng Lễ tân.\n\n"
            f"Quý khách cần thêm khăn tắm, nước suối hay bất kỳ tiện ích nào khác cứ nhắn cho em bất cứ lúc nào nhé ạ!"
        )

    # -------------------------------------------------------------------------
    # 1. TRỢ LÝ CHO KHÁCH ĐANG LƯU TRÚ: HÓA ĐƠN TẠM TÍNH / TIẾN TRÌNH ĐỒ ĂN / WIFI & HỒ BƠI
    # -------------------------------------------------------------------------
    # 1A. Hỏi về Hóa đơn tạm tính (Provisional Bill / Folio)
    is_bill_query = any(k in msg for k in [
        'hóa đơn tạm tính', 'tạm tính', 'tiền phòng của tôi', 'tổng chi phí', 'phát sinh', 'minibar',
        'hóa đơn phòng', 'thanh toán bao nhiêu', 'hết bao nhiêu tiền', 'folio', 'my bill', 'current bill', 'charges'
    ])
    if is_bill_query and active_stay:
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
            f"• **Khoản phát sinh chờ quyết toán khi Check-out**: **{active_stay['unpaid_additional_formatted']}**\n\n"
            f"Quý khách có thể thanh toán nhanh qua mã **VietQR tự động** tại quầy Lễ tân khi làm thủ tục trả phòng nhé ạ!"
        )

    # 1B. Hỏi về tiến trình đơn đồ ăn / dịch vụ vừa đặt
    is_service_order_status = any(k in msg for k in [
        'đơn đồ ăn', 'món ăn tôi đặt', 'đồ ăn tới đâu', 'ở bước nào', 'bao giờ có đồ ăn',
        'dịch vụ tôi đặt', 'đơn dịch vụ', 'order status', 'my food', 'room service status'
    ])
    if is_service_order_status:
        if active_stay and active_stay['service_orders']:
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
        else:
            return (
                "Dạ hiện tại trên hệ thống em chưa ghi nhận đơn gọi món hoặc dịch vụ phòng nào đang chờ xử lý của Quý khách ạ.\n\n"
                "Quý khách có thể bấm vào **Thẻ Dịch vụ & Ẩm thực** bên dưới hoặc vào mục **Menu Dịch Vụ** để đặt bò Wagyu A5, hải sản Mỹ Khê, Ocean Spa hoặc xe đưa đón sân bay phục vụ tận phòng 24/7 nhé ạ!"
            )

    # 1C. Hỏi về Mật khẩu Wifi / Giờ mở cửa Hồ bơi / Ăn sáng / Gym / Chính sách nhận trả phòng
    is_facility_info = any(k in msg for k in [
        'wifi', 'mật khẩu', 'password', 'pass wifi', 'mạng',
        'hồ bơi', 'bể bơi', 'pool', 'swimming', 'ăn sáng', 'buffet', 'breakfast',
        'gym', 'fitness', 'mấy giờ', 'giờ mở cửa', 'nhận phòng', 'trả phòng', 'check-in', 'check-out', 'check in', 'check out'
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
                f"• **Check-in / Check-out Policy**: Standard Check-in from **{h_info['check_in']}** | Check-out before **{h_info['check_out']}** (Late check-out until 15:00 complimentary for Platinum VIP members).\n\n"
                f"How else may I make your stay more comfortable today?"
            )
        return (
            f"Dạ em xin gửi Quý khách{room_badge} thông tin tiện ích nội khu và quy định lưu trú tại **{h_info['name']}** ạ:\n\n"
            f"• **Wifi tốc độ cao 5G**: Tên mạng **`{wifi_name}`** | Mật khẩu: **`{wifi_pwd}`**\n"
            f"• **Hồ bơi Vô cực (Infinity Pool)**: Mở cửa **06:00 – 22:00** tại **Tầng 15 (Tầng thượng)** ngắm trọn bình minh biển Mỹ Khê (miễn phí khăn tắm & ghế thư giãn).\n"
            f"• **Buffet Sáng Quốc Tế**: Phục vụ từ **06:30 – 10:00** tại **Nhà hàng The Ocean – Tầng 2**.\n"
            f"• **TA Ocean Spa & Phòng Gym**: Mở cửa **07:00 – 22:00** tại **Tầng 3**.\n"
            f"• **Giờ Nhận / Trả phòng tiêu chuẩn**: Nhận phòng (Check-in) từ **{h_info['check_in']}** | Trả phòng (Check-out) trước **{h_info['check_out']}** *(Hội viên Platinum VIP được miễn phí trả phòng muộn đến 15:00)*.\n\n"
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
        if lang == 'en':
            return (
                f"Dear Valued Guest, as your Local Concierge in Da Nang, I have curated the finest attractions around **{h_info['name']}**:\n\n"
                f"• **Dragon Bridge (Cầu Rồng)** *(5 mins / 3km)*: Famous Fire & Water show at **21:00 every Saturday, Sunday** and major holidays.\n"
                f"• **My Khe Beach** *(1 min walk across the street)*: Voted by Forbes as one of the world's most luxurious beaches.\n"
                f"• **Son Tra Peninsula & Lady Buddha (Chùa Linh Ứng)** *(12 mins / 8km)*: Home to the 67m tall Goddess of Mercy statue overlooking the ocean.\n"
                f"• **Marble Mountains (Ngũ Hành Sơn)** *(10 mins / 7km)*: Mystical limestone caves and ancient pagodas.\n"
                f"• **Sun World Ba Na Hills & Golden Bridge** *(45 mins / 35km)*: Iconic giant hands bridge & French Village.\n"
                f"• **Hoi An Ancient Town** *(30 mins / 28km)*: UNESCO Heritage lantern town, best visited from **16:30 – 21:30**.\n\n"
                f"**VIP Chauffeur & Airport Transfer**: Our hotel provides private **Mercedes & Luxury Limousine** transfers to the airport, Ba Na Hills, and Hoi An. You can book our transfer service directly via the **Service Card** below!"
            )
        return (
            f"Dạ với lợi thế tọa lạc ngay mặt tiền biển Mỹ Khê, từ **{h_info['name']}** Quý khách có thể dễ dàng khám phá những biểu tượng du lịch tuyệt đẹp của Đà Nẵng – Hội An ạ:\n\n"
            f"### Lịch trình & Điểm tham quan nổi bật từ Khách sạn\n"
            f"• **Bãi biển Mỹ Khê** *(Chỉ 1 phút đi bộ qua đường)*: Top 6 bãi biển quyến rũ nhất hành tinh, tuyệt đẹp để tắm biển và ngắm bình minh lúc **05:15 – 06:30**.\n"
            f"• **Cầu Rồng phun lửa & nước** *(3km – 5 phút đi xe)*: Trình diễn phun lửa và phun nước vào đúng **21:00 tối Thứ Bảy, Chủ Nhật** hàng tuần.\n"
            f"• **Bán đảo Sơn Trà & Chùa Linh Ứng** *(8km – 12 phút đi xe)*: Chiêm bái tượng Phật Bà Quan Âm cao 67m hướng biển Đông.\n"
            f"• **Danh thắng Ngũ Hành Sơn** *(7km – 10 phút đi xe)*: Khám phá động Huyền Không và làng đá mỹ nghệ Non Nước.\n"
            f"• **Sun World Bà Nà Hills & Cầu Vàng** *(35km – 45 phút đi xe)*: Trải nghiệm cáp treo kỷ lục thế giới và khí hậu 4 mùa (nên khởi hành lúc **07:30 sáng**).\n"
            f"• **Phố cổ Hội An** *(28km – 30 phút đi xe)*: Phố đèn lồng di sản lung linh bên sông Hoài (đẹp nhất từ **16:30 – 21:30**).\n\n"
            f"**Đặc quyền Xe Đưa Đón VIP**: Khách sạn có sẵn **Đội xe Limousine & Mercedes riêng** phục vụ đón/tiễn Sân bay Đà Nẵng và đưa đón tham quan Bà Nà – Hội An tận nơi. Em đã hiển thị **Thẻ Đặt Xe Đưa Đón** ngay bên dưới để Quý khách đặt nhanh 1 chạm ạ!"
        )

    # -------------------------------------------------------------------------
    # 3. TRA CỨU ĐƠN ĐẶT PHÒNG (BOOKING TRACKER)
    # -------------------------------------------------------------------------
    if tracked_bookings and len(tracked_bookings) > 0:
        bk = tracked_bookings[0]
        if lang == 'en':
            return (
                f"Dear Valued Guest, I have retrieved your reservation **#{bk['booking_code']}** from our system:\n\n"
                f"• **Guest Name**: {bk['guest_name']}\n"
                f"• **Room**: {bk['room_name']}\n"
                f"• **Stay Period**: Check-in **{bk['check_in_date']}** ➔ Check-out **{bk['check_out_date']}**\n"
                f"• **Total Price**: **{bk['total_amount']}**\n"
                f"• **Current Status**: **{bk['status_label']}**\n\n"
                f"I have displayed the **Real-Time Booking Progress Tracker** right below!"
            )
        elif lang == 'ko':
            return (
                f"고객님 안녕하십니까! 시스템에서 고객님의 예약 내역 **#{bk['booking_code']}**을(를) 확인하였습니다:\n\n"
                f"• **투숙객 성함**: {bk['guest_name']}\n"
                f"• **배정 객실**: {bk['room_name']}\n"
                f"• **투숙 기간**: 체크인 **{bk['check_in_date']}** ➔ 체크아웃 **{bk['check_out_date']}**\n"
                f"• **총 결제 금액**: **{bk['total_amount']}**\n"
                f"• **현재 진행 상태**: **{bk['status_label']}**\n\n"
                f"아래에 **실시간 예약 진행 카드**를 준비해 두었습니다!"
            )
        elif lang == 'zh':
            return (
                f"尊敬的贵宾，您好！已为您在系统中查询到预订信息 **#{bk['booking_code']}**：\n\n"
                f"• **入住宾客**: {bk['guest_name']}\n"
                f"• **预订房型**: {bk['room_name']}\n"
                f"• **入住时间**: 入住 **{bk['check_in_date']}** ➔ 退房 **{bk['check_out_date']}**\n"
                f"• **总计金额**: **{bk['total_amount']}**\n"
                f"• **当前状态**: **{bk['status_label']}**\n\n"
                f"下方已为您展示**实时预订进度卡片**！"
            )
        else:
            return (
                f"Dạ em đã kiểm tra và tìm thấy thông tin đơn đặt phòng **#{bk['booking_code']}** trên hệ thống ạ:\n\n"
                f"• **Khách lưu trú**: {bk['guest_name']}\n"
                f"• **Hạng phòng**: {bk['room_name']}\n"
                f"• **Thời gian**: Nhận phòng **{bk['check_in_date']}** ➔ Trả phòng **{bk['check_out_date']}**\n"
                f"• **Tổng tiền phòng**: **{bk['total_amount']}**\n"
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
        return (
            "Dạ để em tra cứu tiến trình đơn đặt phòng tức thì, Quý khách vui lòng:\n\n"
            "1. Nhập **Mã đơn đặt phòng** (ví dụ: `BK-3C2E8F`); HOẶC\n"
            "2. Nhập **Số điện thoại** đặt phòng (ví dụ: `0918889999`); HOẶC\n"
            "3. **Đăng nhập** tài khoản hội viên để em tự động đồng bộ toàn bộ thông tin lưu trú của Quý khách ạ!"
        )

    # -------------------------------------------------------------------------
    # 4. CÂU HỎI NỐI TIẾP VỀ 1 HẠNG PHÒNG CỤ THỂ (MULTI-TURN MEMORY: JACUZZI, DIỆN TÍCH, VIEW...)
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
    # 5. TRA CỨU PHÒNG TRỐNG THEO NGÀY & BẢNG SO SÁNH GIÁ PHÒNG
    # -------------------------------------------------------------------------
    is_room_query = any(k in msg for k in [
        'phòng', 'giá', 'trống', 'còn phòng', 'hạng phòng', 'loại phòng', 'room', 'đêm', 'bao nhiêu',
        'ngày mai', 'cuối tuần', 'tối nay', 'hôm nay', 'so sánh',
        'rate', 'rates', 'cost', 'available', 'availability', 'suite', 'deluxe', 'tomorrow', 'weekend',
        '객실', '방', '요금', '가격', '예약', '스위트', '디럭스', '내일',
        '房', '客房', '价格', '房价', '预订', '套房', '空房', '明天'
    ])
    if is_room_query and rooms:
        date_header = (
            f"từ **{d_info.get('check_in_display')}** đến **{d_info.get('check_out_display')}** ({d_info.get('nights', 1)} đêm)"
            if d_info.get('is_custom_date')
            else f"hôm nay (**{d_info.get('check_in_display')}** ➔ **{d_info.get('check_out_display')}**)"
        )
        vip_note = ""
        if user_ctx and user_ctx.get('discount_rate') and user_ctx['discount_rate'] != '0%':
            vip_note = f"\n*Đặc quyền Hội viên **{user_ctx['vip_tier']}**: Quý khách được giảm thêm **{user_ctx['discount_rate']}** trực tiếp khi đặt phòng!*\n"

        if lang == 'en':
            lines = [
                f"Dear Valued Guest, I have checked our real-time reservation calendar from **{d_info.get('check_in_display')}** to **{d_info.get('check_out_display')}** ({d_info.get('nights', 1)} night(s)):\n",
                "| Room Category | Size / Capacity | Nightly Rate | Real-Time Status |",
                "| :--- | :--- | :--- | :--- |"
            ]
            for r in rooms:
                avail_cell = f"**{r['available_count']} left**" if r['available_count'] > 0 else "Sold out"
                lines.append(f"| **{r['name']}** | {r['size']}m² • {r['capacity']} Guests | **{r['effective_price_multilingual']}** | {avail_cell} |")
            lines.append(f"\n**Standard Hours**: Check-in **{h_info['check_in']}** | Check-out **{h_info['check_out']}**.")
            lines.append("Select any room card below to view photos or book immediately with your dates pre-filled!")
            return "\n".join(lines)
        elif lang == 'ko':
            lines = [
                f"고객님 안녕하십니까! **{d_info.get('check_in_display')} ~ {d_info.get('check_out_display')} ({d_info.get('nights', 1)}박)** 기준 실시간 잔여 객실 및 요금표입니다:\n",
                "| 객실 등급 | 면적 / 정원 | 1박 요금 (KRW) | 실시간 잔여 객실 |",
                "| :--- | :--- | :--- | :--- |"
            ]
            for r in rooms:
                avail_cell = f"**{r['available_count']}실 가능**" if r['available_count'] > 0 else "마감"
                lines.append(f"| **{r['name']}** | {r['size']}m² • {r['capacity']}인 | **{r['effective_price_multilingual']}** | {avail_cell} |")
            lines.append("\n아래 객실 카드를 클릭하시면 선택한 날짜로 즉시 예약하실 수 있습니다!")
            return "\n".join(lines)
        elif lang == 'zh':
            lines = [
                f"尊敬的贵宾，已为您查询 **{d_info.get('check_in_display')} 至 {d_info.get('check_out_display')}（共{d_info.get('nights', 1)}晚）** 的实时房态与房价对比表：\n",
                "| 客房房型 | 面积 / 人数 | 每晚房价 (CNY) | 实时剩余空房 |",
                "| :--- | :--- | :--- | :--- |"
            ]
            for r in rooms:
                avail_cell = f"**剩 {r['available_count']} 间**" if r['available_count'] > 0 else "已满房"
                lines.append(f"| **{r['name']}** | {r['size']}m² • {r['capacity']}人 | **{r['effective_price_multilingual']}** | {avail_cell} |")
            lines.append("\n点击下方房型卡片即可自动带入入住日期并立即预订！")
            return "\n".join(lines)
        else:
            lines = [
                f"Dạ em đã kiểm tra lịch phòng trống thời gian thực {date_header} tại **{h_info['name']}** và tổng hợp bảng so sánh bên dưới cho Quý khách ạ:\n",
                "| Hạng Phòng | Diện tích & Sức chứa | Giá Ưu Đãi / Đêm | Lịch Trống Thực Tế |",
                "| :--- | :--- | :--- | :--- |"
            ]
            for r in rooms:
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
        lines = [
            f"Dạ **{h_info['name']}** hân hạnh phục vụ Quý khách hệ sinh thái dịch vụ & ẩm thực chuẩn 5 sao quốc tế 24/7 ạ:\n",
            "• **Ẩm thực & In-room Dining (24/7)**: Thực đơn Á - Âu thượng hạng, Hải sản tươi sống biển Mỹ Khê, Bò Wagyu A5 nướng đá.",
            "• **TA Ocean Spa & Wellness (Tầng 3)**: Xông hơi đá muối Himalaya, trị liệu massage thảo dược cung đình.",
            "• **Đội xe VIP Limousine & Mercedes Đưa Đón**: Đón/tiễn Sân bay Quốc tế Đà Nẵng và tham quan Hội An, Bà Nà Hills riêng tư.",
            "• **Giặt ủi & Phục vụ Buồng phòng**: Giặt hấp cao cấp lấy nhanh trong ngày."
        ]
        if services:
            lines.append("\n| Dịch vụ / Món ăn tiêu biểu | Phân loại | Đơn giá niêm yết |")
            lines.append("| :--- | :--- | :--- |")
            for s in services[:6]:
                lines.append(f"| **{s['name']}** | {s['category']} | **{s['price_multilingual']}** |")
        lines.append("\nQuý khách có thể bấm vào **Thẻ Dịch Vụ** bên dưới để đặt món hoặc đặt xe đưa đón ngay lập tức ạ!")
        return "\n".join(lines)

    # -------------------------------------------------------------------------
    # 7. CHÍNH SÁCH CÔNG TY / ĐẶT ĐOÀN M.I.C.E / HÓA ĐƠN VAT
    # -------------------------------------------------------------------------
    if any(k in msg for k in [
        'công ty', 'doanh nghiệp', 'vat', 'hóa đơn', 'đoàn', 'b2b', 'hợp đồng', 'corporate', 'mice', 'thuế',
        'tax', 'company', 'invoice', '단체', '법인', '세금계산서', '企业', '发票', '团队'
    ]):
        c = hotel_context['corporate_policy']
        return (
            f"Dạ về chính sách **Đặt phòng Doanh nghiệp & Đoàn thể (M.I.C.E)** tại **{h_info['name']}**, em xin thông tin chi tiết đến Quý khách:\n\n"
            f"• **Hóa đơn tài chính VAT**: {c['vat_invoice']}\n"
            f"• **Hợp đồng & Chiết khấu B2B**: {c['contracts']}\n"
            f"• **Tổ chức Sự kiện & Hội nghị**: {c['group_services']}\n"
            f"• **Hạn mức Công nợ**: {c['credit_terms']}\n\n"
            f"Quý công ty có thể gửi yêu cầu tại mục **'Đặt Đoàn & Doanh nghiệp'** trên thanh menu hoặc liên hệ Hotline Phòng Kinh Doanh **{h_info['hotline']}** để nhận báo giá trong 15 phút ạ!"
        )

    # -------------------------------------------------------------------------
    # 8. KHUYẾN MÃI / VOUCHER / HẠNG THẺ THÀNH VIÊN VIP
    # -------------------------------------------------------------------------
    if any(k in msg for k in [
        'khuyến mãi', 'voucher', 'ưu đãi', 'giảm giá', 'coupon', 'promo', 'vip', 'thành viên', 'silver', 'gold', 'platinum',
        'discount', 'deal', 'membership', '할인', '프로모션', '优惠', '折扣'
    ]):
        lines = [
            f"Dạ **{h_info['name']}** đang áp dụng chương trình đặc quyền **TA Club Membership** và các mã Voucher giảm giá trực tiếp:\n",
            "### Đặc quyền Hạng thẻ Hội viên TA Club",
            "• **Hạng Bạc (Silver)**: Giảm ngay **5%** tổng tiền phòng.",
            "• **Hạng Vàng (Gold)**: Giảm ngay **10%** + Ưu tiên nâng hạng phòng miễn phí.",
            "• **Hạng Bạch Kim (Platinum VIP)**: Giảm ngay **15%** + Trả phòng muộn đến 15:00 & Miễn phí xe Limousine đón sân bay."
        ]
        promos = hotel_context.get('promotions', [])
        if promos:
            lines.append("\n### Mã Voucher Khuyến Mãi & Ưu Đãi Đang Hoạt Động")
            lines.append("| Mã Voucher | Chương trình Ưu đãi | Mức Giảm | Đơn tối thiểu |")
            lines.append("| :--- | :--- | :--- | :--- |")
            for p in promos:
                lines.append(f"| **`{p['code']}`** | {p['name']} | **{p['discount']}** | {p['min_order']} |")
        lines.append("\nQuý khách chỉ cần chọn mã giảm giá tại trang **Thanh toán (Checkout)** để được khấu trừ tự động ạ!")
        return "\n".join(lines)

    # -------------------------------------------------------------------------
    # 9. ĐỊA CHỈ / LIÊN HỆ / THANH TOÁN VIETQR
    # -------------------------------------------------------------------------
    if any(k in msg for k in [
        'địa chỉ', 'ở đâu', 'vị trí', 'hotline', 'liên hệ', 'sđt', 'số điện thoại', 'email', 'map',
        'thanh toán', 'chuyển khoản', 'qr', 'vietqr', 'sepay', 'cọc'
    ]):
        return (
            f"Dạ em xin gửi Quý khách thông tin liên hệ và phương thức thanh toán tự động tại **{h_info['name']}** ạ:\n\n"
            f"• **Vị trí đắc địa**: {h_info['address']} *(Đối diện bãi biển Mỹ Khê, cách Sân bay Đà Nẵng 10 phút và Cầu Rồng 5 phút di chuyển)*.\n"
            f"• **Hotline Lễ tân & Concierge 24/7**: **{h_info['hotline']}** | Điện thoại: **{h_info['phone']}**\n"
            f"• **Email CSKH**: {h_info['email']}\n"
            f"• **Thanh toán tự động 24/7**: Hỗ trợ quét mã **VietQR động (cổng Sepay)** tự động xác nhận đơn trong 3 giây, thẻ quốc tế Visa/Mastercard/JCB hoặc thanh toán tại quầy Lễ tân ạ!"
        )

    # -------------------------------------------------------------------------
    # 10. LỜI CHÀO MẶC ĐỊNH CÁ NHÂN HÓA CHUẨN 5 SAO
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
            f"Dear Valued Guest! Welcome to the 5-Star AI Concierge of **{h_info['name']}**.\n\n"
            f"I am at your service 24/7 to assist with:\n"
            f"• **Date-Specific Room Availability & Rates (with USD conversion)**\n"
            f"• **24/7 In-Room Dining, Ocean Spa & Private Airport Limousine**\n"
            f"• **Da Nang – Hoi An Sightseeing Itinerary & Dragon Bridge Show**\n"
            f"• **In-House Guest Services: Live Folio Bill, Wi-Fi & Instant Housekeeping**\n\n"
            f"How may I assist your luxury stay in Da Nang today?"
        )
    return (
        f"Dạ em kính chào {greeting_name}! Em là Trợ lý ảo AI Concierge 5 sao của **{h_info['name']}** ạ.{inhouse_banner}\n"
        f"Em luôn sẵn sàng hỗ trợ Quý khách 24/7 về mọi nghiệp vụ:\n"
        f"• **Kiểm tra lịch phòng trống theo ngày thực tế & Bảng so sánh giá**\n"
        f"• **Thực đơn Ẩm thực tại phòng, Ocean Spa & Đặt xe Limousine đón sân bay**\n"
        f"• **Tư vấn lịch trình Du lịch Đà Nẵng – Hội An – Bà Nà Hills**\n"
        f"• **Trợ lý lưu trú: Xem hóa đơn tạm tính, mật khẩu Wifi, gọi dọn phòng 1 chạm**\n\n"
        f"Quý khách đang cần em kiểm tra phòng cho ngày nào hay hỗ trợ dịch vụ gì, hãy nhắn cho em ngay nhé ạ!"
    )
