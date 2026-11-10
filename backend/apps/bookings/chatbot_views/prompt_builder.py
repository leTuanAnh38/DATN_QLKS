"""Dựng system prompt cho Gemini."""
import logging


logger = logging.getLogger(__name__)


def generate_system_prompt(hotel_context, housekeeping_action=None):
    """
    Sinh System Prompt chuẩn mực cho AI Gemini:
    Đóng vai Trợ lý ảo Lễ tân & Concierge 5 sao của Khách sạn TA Đà Nẵng,
    nắm rõ lịch phòng trống thực tế theo ngày khách hỏi, thông tin lưu trú CHECKED_IN,
    hóa đơn tạm tính, trạng thái đồ ăn và cẩm nang du lịch Đà Nẵng.
    """
    h_info = hotel_context['hotel_info']
    d_info = hotel_context.get('queried_dates', {})
    date_range_str = f"Nhận phòng {d_info.get('check_in_display')} - Trả phòng {d_info.get('check_out_display')} ({d_info.get('nights', 1)} đêm)"

    # 1. Chuỗi phòng kèm lịch trống thực tế & tiện nghi chi tiết
    room_lines = []
    for r in hotel_context['rooms']:
        price_text = f"Giá gốc: {r['base_price_formatted']}"
        if r.get('promo_price_formatted'):
            price_text += f" (Giá ưu đãi: {r['promo_price_formatted']})"
        avail = f"Còn {r['available_count']}/{r['total_count']} phòng trống" if r['available_count'] > 0 else "HẾT PHÒNG trong khoảng ngày này"
        room_lines.append(
            f"- {r['name']} (Diện tích: {r['size']}m² | Sức chứa: {r['capacity']} khách | Giường: {r['bed_type']}):\n"
            f"  + {price_text} | Tình trạng ({date_range_str}): {avail}\n"
            f"  + Tiện nghi & Đặc điểm: {r['all_amenities']} | {r['description']}"
        )
    rooms_text = "\n".join(room_lines) if room_lines else "Tất cả các hạng phòng đang được phục vụ."

    # 2. Chuỗi dịch vụ
    svc_lines = []
    for s in hotel_context['services'][:18]:
        svc_lines.append(f"- [{s['category']}] {s['name']}: {s['price_formatted']} ({s['description']})")
    services_text = "\n".join(svc_lines) if svc_lines else "Phục vụ 24/7 ẩm thực, spa, xe đưa đón sân bay."

    # 3. Chuỗi khuyến mãi
    promo_lines = []
    for p in hotel_context['promotions']:
        promo_lines.append(f"- Mã `{p['code']}` ({p['name']}): Giảm {p['discount']} (Đơn tối thiểu: {p['min_order']})")
    promos_text = "\n".join(promo_lines) if promo_lines else "Ưu đãi thẻ hội viên Silver 5%, Gold 10%, Platinum 15%."

    # 4. Cẩm nang Du lịch Đà Nẵng
    guide_lines = []
    for g in hotel_context.get('danang_guide', []):
        guide_lines.append(f"- {g['name']} ({g['distance']}): {g['highlight']}")
    guide_text = "\n".join(guide_lines)

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
                f"  + Tiền phòng ({st['check_in_date']} - {st['check_out_date']}): {st['room_total_formatted']}\n"
                f"  + Phụ phí & Minibar: {st['extra_total_formatted']} ({extra_str})\n"
                f"  + Dịch vụ gọi thêm tại phòng (F&B/Spa/Xe): {st['service_total_formatted']}\n"
                f"  + TỔNG HÓA ĐƠN TẠM TÍNH: {st['grand_total_formatted']} (Phát sinh chưa thanh toán: {st['unpaid_additional_formatted']})\n"
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
        hk_str = (
            f"\n[HÀNH ĐỘNG TỰ ĐỘNG VỪA KÍCH HOẠT]: Hệ thống đã tự động gửi phiếu yêu cầu dọn phòng/buồng phòng khẩn cấp "
            f"cho Phòng {housekeeping_action['room_number']} (#{housekeeping_action['booking_code']}) tới bộ phận Housekeeping. "
            f"Hãy xác nhận ngay với Quý khách rằng nhân viên buồng phòng sẽ có mặt trong 5-10 phút tới!"
        )

    system_prompt = f"""Bạn là Trợ lý ảo AI Concierge 5 sao cao cấp của {h_info['name']}.
NGUYÊN TẮC GIAO TIẾP & ĐỊNH DẠNG (CHUẨN 5 SAO LUXURY):
1. Luôn xưng "Em" và gọi người dùng là "Quý khách" (hoặc tên khách nếu đã đăng nhập).
2. Giọng điệu thượng lưu, lễ phép, ấm áp, tinh tế chuẩn khách sạn nghỉ dưỡng 5 sao quốc tế.
3. Trình bày câu trả lời rõ ràng bằng Markdown: dùng **in đậm** cho giá tiền/tên phòng, gạch đầu dòng `•`, hoặc lập Bảng Markdown (`| Hạng phòng | Giá/đêm | Phòng trống |`) khi khách muốn so sánh nhiều phòng.
4. TUYỆT ĐỐI CHỈ dựa vào số liệu thực tế từ hệ thống bên dưới, không tự bịa đặt giá hay số lượng phòng trống.

QUY TẮC ĐA NGÔN NGỮ & QUY ĐỔI TỶ GIÁ:
- Tự động trả lời bằng đúng ngôn ngữ khách dùng (Việt / Anh / Hàn / Trung).
- Với khách quốc tế, luôn hiển thị giá gốc VND kèm quy đổi tương đương (~$USD, ~₩KRW, ~¥CNY).

THÔNG TIN KHÁCH SẠN & TIỆN ÍCH NỘI KHU:
- Tên: {h_info['name']} | Địa chỉ: {h_info['address']}
- Hotline Lễ tân & Concierge 24/7: {h_info['hotline']} | Email: {h_info['email']}
- Giờ Check-in: từ {h_info['check_in']} | Giờ Check-out: trước {h_info['check_out']}
- Wifi miễn phí: `{h_info['wifi_ssid']}` | Mật khẩu: `{h_info['wifi_pass']}`
- Hồ bơi: {h_info['pool_info']}
- Ăn sáng: {h_info['breakfast_info']}
- Spa & Gym: {h_info['spa_gym_info']}

TÌNH TRẠNG PHÒNG TRỐNG & BẢNG GIÁ THỰC TẾ (KHOẢNG NGÀY ĐANG KIỂM TRA: {date_range_str}):
{rooms_text}

DANH MỤC DỊCH VỤ ẨM THỰC, SPA & XE ĐƯA ĐÓN SÂN BAY:
{services_text}

MÃ KHUYẾN MÃI & ĐẶC QUYỀN HỘI VIÊN:
{promos_text}
- Hạng Bạc (Silver): Giảm 5% giá phòng.
- Hạng Vàng (Gold): Giảm 10% giá phòng + Ưu tiên nâng hạng phòng miễn phí.
- Hạng Bạch Kim (Platinum): Giảm 15% giá phòng + Trả phòng muộn đến 15:00 & Miễn phí xe đón sân bay.

CẨM NANG DU LỊCH ĐÀ NẴNG & ĐIỀU HƯỚNG ĐẶT XE VIP:
{guide_text}
* Lưu ý: Khi tư vấn lịch trình tham quan hoặc sân bay, hãy luôn khéo léo giới thiệu Đội xe VIP Limousine & Mercedes đưa đón riêng của khách sạn TA Đà Nẵng để khách đặt ngay bên dưới.

{user_str}{hk_str}
"""
    return system_prompt
