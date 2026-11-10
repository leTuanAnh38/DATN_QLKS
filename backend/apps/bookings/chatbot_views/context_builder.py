"""Dựng ngữ cảnh khách sạn: tồn phòng, thông tin lưu trú."""
import logging
from datetime import timedelta
from django.db.models import Q
from django.utils import timezone

from ..models import Booking, Promotion, HotelSetting
from ...rooms.models import RoomCategory
from ...services.models import ServiceItem

logger = logging.getLogger(__name__)
from .nlp_parser import extract_dates_from_conversation
from .text_utils import format_currency, format_currency_multilingual, strip_html_tags


def calculate_category_availability(cat, c_in, c_out, now_date=None):
    """
    Tính toán số lượng phòng trống thực tế của một Hạng phòng (RoomCategory)
    trong khoảng ngày [c_in, c_out), đồng bộ 100% với logic BookingViewSet.check_availability:
    - Nếu khoảng ngày bao gồm hôm nay: trừ các phòng vật lý đang occupied/maintenance
      và các đơn active chưa gán phòng hoặc gán vào phòng trống.
    - Nếu khoảng ngày trong tương lai (VD: ngày mai, cuối tuần): trừ các phòng đang bảo trì (maintenance)
      và tất cả các đơn đặt phòng trùng lịch (confirmed, checked_in, paid, hoặc pending trong 15 phút).
    """
    if not now_date:
        now_date = timezone.localtime(timezone.now()).date() if timezone.is_aware(timezone.now()) else timezone.now().date()

    pending_timeout = timezone.now() - timedelta(minutes=15)
    total_physical = cat.rooms.count()

    if c_in <= now_date < c_out:
        busy_physical_ids = set(cat.rooms.filter(status__in=['occupied', 'maintenance']).values_list('id', flat=True))
        active_bookings = Booking.objects.filter(
            category=cat,
            check_in_date__lt=c_out,
            check_out_date__gt=c_in
        ).filter(
            Q(status__in=['confirmed', 'checked_in']) |
            Q(status__in=['pending', 'paid', 'PAID'], created_at__gte=pending_timeout)
        )
        unassigned_or_clean_bookings = active_bookings.filter(
            Q(room__isnull=True) | ~Q(room_id__in=busy_physical_ids)
        ).count()
        total_busy = len(busy_physical_ids) + unassigned_or_clean_bookings
        avail = max(0, total_physical - total_busy)
        return total_physical, total_busy, avail
    else:
        sellable_total = cat.rooms.exclude(status='maintenance').count()
        booked_count = Booking.objects.filter(
            category=cat,
            check_in_date__lt=c_out,
            check_out_date__gt=c_in
        ).filter(
            Q(status__in=['confirmed', 'checked_in']) |
            Q(status__in=['pending', 'paid', 'PAID'], created_at__gte=pending_timeout)
        ).count()
        avail = max(0, sellable_total - booked_count)
        return total_physical, booked_count, avail


def build_active_stay_details(bk, lang='vi'):
    """
    Tổng hợp chi tiết kỳ lưu trú hiện tại (In-House Concierge) cho khách đang CHECKED_IN
    (hoặc đơn đặt phòng cụ thể mà khách đang tra cứu):
    - Thông tin phòng, tầng, mật khẩu Wifi, giờ hồ bơi/ăn sáng
    - Bảng kê Hóa đơn tạm tính (Provisional Folio): Tiền phòng + Phụ phí/Minibar + Dịch vụ gọi thêm
    - Trạng thái các đơn đồ ăn / dịch vụ vừa đặt (ServiceRequest)
    """
    if not bk:
        return None

    room_num = bk.room.room_number if bk.room else None
    floor_num = bk.room.floor if bk.room else 3
    cat_name = bk.category.name if bk.category else (bk.room.category.name if (bk.room and bk.room.category) else 'Luxury Room')

    room_base_total = int(bk.total_amount or 0)

    # 1. Phụ phí & Minibar (BookingExtraService)
    extra_items = []
    extra_unpaid_total = 0
    extra_all_total = 0
    for ex in bk.extra_services.all():
        line_total = int(ex.price or 0) * int(ex.quantity or 1)
        extra_all_total += line_total
        if not ex.is_paid:
            extra_unpaid_total += line_total
        extra_items.append({
            'name': ex.service_name,
            'quantity': ex.quantity,
            'price': int(ex.price or 0),
            'total': line_total,
            'total_formatted': format_currency_multilingual(line_total, lang=lang),
            'is_paid': ex.is_paid
        })

    # 2. Yêu cầu Dịch vụ / Đồ ăn tại phòng (ServiceRequest)
    sr_status_labels = {
        'vi': {
            'pending': '⏳ Đã tiếp nhận - Đang chờ bộ phận chuẩn bị',
            'in_progress': 'Đầu bếp / Kỹ thuật viên đang thực hiện',
            'delivering': 'Nhân viên đang mang lên phòng cho Quý khách',
            'completed': 'Đã phục vụ hoàn tất tại phòng',
            'cancelled': 'Đã hủy'
        },
        'en': {
            'pending': '⏳ Received - Waiting for preparation',
            'in_progress': 'In Preparation by Chef / Therapist',
            'delivering': 'On the way to your room',
            'completed': 'Delivered & Completed',
            'cancelled': 'Cancelled'
        },
        'ko': {
            'pending': '⏳ 접수 완료 - 준비 대기 중',
            'in_progress': '셰프/담당자가 준비 중입니다',
            'delivering': '직원이 객실로 이동 중입니다',
            'completed': '서비스 제공 완료',
            'cancelled': '취소됨'
        },
        'zh': {
            'pending': '⏳ 已接单 - 正在等待准备',
            'in_progress': '厨师/技师正在为您准备',
            'delivering': '服务员正在送往您的客房',
            'completed': '已送达并完成服务',
            'cancelled': '已取消'
        }
    }
    st_dict = sr_status_labels.get(lang, sr_status_labels['vi'])

    service_orders = []
    service_unpaid_total = 0
    service_all_total = 0
    for sr in bk.service_requests.select_related('service', 'assigned_staff').order_by('-created_at')[:6]:
        line_total = int(sr.total_price or 0)
        if sr.status != 'cancelled':
            service_all_total += line_total
            if not sr.is_paid:
                service_unpaid_total += line_total
        service_orders.append({
            'id': sr.id,
            'service_name': sr.service.name if sr.service else 'Dịch vụ phòng',
            'quantity': sr.quantity,
            'total': line_total,
            'total_formatted': format_currency_multilingual(line_total, lang=lang),
            'status': sr.status,
            'status_label': st_dict.get(sr.status, sr.status),
            'is_paid': sr.is_paid,
            'staff_name': (sr.assigned_staff.get_full_name() or sr.assigned_staff.username) if sr.assigned_staff else None,
            'created_time': timezone.localtime(sr.created_at).strftime('%H:%M %d/%m') if sr.created_at else ''
        })

    grand_total = room_base_total + extra_all_total + service_all_total
    unpaid_extras_and_services = extra_unpaid_total + service_unpaid_total

    return {
        'booking_id': bk.id,
        'booking_code': bk.booking_code,
        'status': bk.status,
        'is_checked_in': str(bk.status).lower() == 'checked_in',
        'room_number': room_num or 'Chờ gán phòng',
        'floor': floor_num,
        'category_name': cat_name,
        'check_in_date': bk.check_in_date.strftime('%d/%m/%Y') if bk.check_in_date else '',
        'check_out_date': bk.check_out_date.strftime('%d/%m/%Y') if bk.check_out_date else '',
        'is_cleaning_requested': bk.room.is_cleaning_requested if bk.room else False,
        'room_total': room_base_total,
        'room_total_formatted': format_currency_multilingual(room_base_total, lang=lang),
        'extra_total': extra_all_total,
        'extra_total_formatted': format_currency_multilingual(extra_all_total, lang=lang),
        'service_total': service_all_total,
        'service_total_formatted': format_currency_multilingual(service_all_total, lang=lang),
        'grand_total': grand_total,
        'grand_total_formatted': format_currency_multilingual(grand_total, lang=lang),
        'unpaid_additional': unpaid_extras_and_services,
        'unpaid_additional_formatted': format_currency_multilingual(unpaid_extras_and_services, lang=lang),
        'extra_items': extra_items,
        'service_orders': service_orders,
        'wifi_ssid': f"TA_Luxury_5G_F{floor_num}" if room_num else "TA_Luxury_Resort_5G",
        'wifi_pass': "TALuxury@2026",
        'pool_hours': "06:00 – 22:00 (Hồ bơi Vô cực Tầng Thượng - Tầng 15, miễn phí khăn tắm & ghế nằm)",
        'breakfast_hours': "06:30 – 10:00 (Nhà hàng The Ocean - Tầng 2, Buffet Á-Âu thượng hạng)",
        'gym_spa_hours': "07:00 – 22:00 (TA Ocean Spa & Fitness - Tầng 3)",
    }


def build_hotel_context(request, date_info=None, lang='vi'):
    """
    Thu thập ngữ cảnh Database thời gian thực để cấp dữ liệu thực tế cho AI Prompt và Fallback:
    1. Thông tin chung khách sạn (Hotline, địa chỉ, giờ nhận/trả phòng, Wifi, Hồ bơi từ HotelSetting)
    2. Danh sách hạng phòng & đếm số phòng trống THỰC TẾ THEO LỊCH NGÀY KHÁCH HỎI (Date-Aware Availability)
    3. Danh sách dịch vụ & ẩm thực đang hoạt động kèm giá
    4. Cẩm nang Du lịch Đà Nẵng & Đội xe VIP đưa đón sân bay / tham quan
    5. Ngữ cảnh cá nhân hóa & Trợ lý khách đang lưu trú (CHECKED_IN In-House Concierge)
    """
    if not date_info:
        date_info = extract_dates_from_conversation('')

    c_in = date_info['check_in']
    c_out = date_info['check_out']

    context_data = {
        'hotel_info': {
            'name': 'Khách Sạn TA Đà Nẵng (5-Star Luxury Resort & Hotel)',
            'address': '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Quận Ngũ Hành Sơn, TP. Đà Nẵng',
            'hotline': '1900 8899',
            'phone': '+84 (0) 236 388 9900',
            'email': 'contact@tahotel.vn',
            'website': 'https://tahotel.vn',
            'check_in': '14:00',
            'check_out': '12:00',
            'vat': '8%',
            'service_charge': '5%',
            'wifi_ssid': 'TA_Luxury_Resort_5G',
            'wifi_pass': 'TALuxury@2026',
            'pool_info': 'Hồ bơi vô cực hướng biển Mỹ Khê tại Tầng 15 (Mở cửa: 06:00 - 22:00)',
            'breakfast_info': 'Buffet sáng quốc tế tại Nhà hàng The Ocean - Tầng 2 (Mở cửa: 06:30 - 10:00)',
            'spa_gym_info': 'TA Ocean Spa & Gym tại Tầng 3 (Mở cửa: 07:00 - 22:00)'
        },
        'queried_dates': date_info,
        'rooms': [],
        'services': [],
        'promotions': [],
        'danang_guide': [
            {
                'name': 'Cầu Rồng (Dragon Bridge)',
                'distance': 'Cách khách sạn 3km (~5 phút đi xe)',
                'highlight': 'Phun lửa và phun nước đặc sắc vào đúng 21:00 tối Thứ Bảy, Chủ Nhật hàng tuần và các ngày lễ lớn.'
            },
            {
                'name': 'Bãi biển Mỹ Khê (My Khe Beach)',
                'distance': 'Ngay đối diện sảnh khách sạn (chỉ 1 phút đi bộ qua đường Võ Nguyên Giáp)',
                'highlight': 'Top 6 bãi biển quyến rũ nhất hành tinh (Forbes bình chọn), lý tưởng để ngắm bình minh từ 05:15 - 06:30 sáng.'
            },
            {
                'name': 'Bán đảo Sơn Trà & Chùa Linh Ứng (Son Tra Peninsula & Lady Buddha)',
                'distance': 'Cách khách sạn 8km (~12 phút đi xe dọc đường biển)',
                'highlight': 'Chiêm bái tượng Phật Bà Quan Âm cao 67m hướng biển, ngắm toàn cảnh vịnh Đà Nẵng từ Đỉnh Bàn Cờ.'
            },
            {
                'name': 'Danh thắng Ngũ Hành Sơn (Marble Mountains)',
                'distance': 'Cách khách sạn 7km (~10 phút đi xe về hướng Nam)',
                'highlight': 'Quần thể 5 ngọn núi đá vôi cẩm thạch, động Huyền Không huyền ảo và làng đá mỹ nghệ Non Nước.'
            },
            {
                'name': 'Sun World Bà Nà Hills & Cầu Vàng (Golden Bridge)',
                'distance': 'Cách khách sạn 35km (~45 phút đi xe riêng)',
                'highlight': 'Tuyệt tác Cầu Vàng nâng đỡ bởi đôi bàn tay khổng lồ, Làng Pháp cổ kính, khí hậu 4 mùa trong một ngày (nên khởi hành lúc 07:30 - 08:00 sáng).'
            },
            {
                'name': 'Phố cổ Hội An (Hoi An Ancient Town)',
                'distance': 'Cách khách sạn 28km (~30 - 35 phút đi xe dọc cung đường biển 5 sao)',
                'highlight': 'Di sản văn hóa thế giới rực rỡ đèn lồng về đêm, thả hoa đăng trên sông Hoài, thưởng thức Cao lầu & Cơm gà (thời điểm đẹp nhất: 16:30 - 21:30).'
            }
        ],
        'membership_tiers': [
            {'tier': 'Bạc (Silver)', 'discount': '5%', 'benefit': 'Tích điểm nâng hạng, ưu đãi 5% giá phòng'},
            {'tier': 'Vàng (Gold)', 'discount': '10%', 'benefit': 'Giảm 10% giá phòng + Miễn phí nâng hạng phòng (khi còn phòng), ưu tiên nhận phòng sớm'},
            {'tier': 'Bạch Kim / Kim Cương (Platinum / Diamond VIP)', 'discount': '15%', 'benefit': 'Giảm 15% giá phòng + Trả phòng muộn đến 15:00, miễn phí xe Limousine đón sân bay, phòng chờ VIP'}
        ],
        'corporate_policy': {
            'vat_invoice': 'Hỗ trợ xuất hóa đơn tài chính điện tử VAT (8%) nhanh chóng về email doanh nghiệp.',
            'contracts': 'Hỗ trợ hợp đồng B2B với chiết khấu doanh nghiệp từ 10% - 20%.',
            'group_services': 'Tiếp nhận khai báo danh sách đoàn, tổ chức sự kiện hội nghị M.I.C.E, Gala Dinner & Team Building bãi biển.',
            'credit_terms': 'Hỗ trợ công nợ thanh toán sau 15 đến 30 ngày cho đối tác doanh nghiệp ký hợp đồng.'
        },
        'payment_methods': 'Hỗ trợ quét mã VietQR tự động gạch nợ tức thì 24/7 (kết nối trực tiếp cổng Sepay), thẻ tín dụng quốc tế Visa/Mastercard/JCB, thẻ ATM nội địa, hoặc thanh toán tại quầy lễ tân.',
        'user_context': None
    }

    # 1. Lấy thông tin từ HotelSetting
    try:
        setting = HotelSetting.get_settings()
        if setting:
            stars = getattr(setting, 'stars', 5) or 5
            slogan = setting.hotel_slogan or f"{stars}-Star Luxury Hotel & Resort"
            context_data['hotel_info']['name'] = f"{setting.hotel_name} ({slogan})"
            context_data['hotel_info']['stars'] = stars
            context_data['hotel_info']['address'] = setting.address or context_data['hotel_info']['address']
            context_data['hotel_info']['hotline'] = setting.hotline or context_data['hotel_info']['hotline']
            context_data['hotel_info']['email'] = setting.email or context_data['hotel_info']['email']
            context_data['hotel_info']['check_in'] = setting.check_in_time or '14:00'
            context_data['hotel_info']['check_out'] = setting.check_out_time or '12:00'
            context_data['hotel_info']['vat'] = f"{setting.vat_percent}%"
            context_data['hotel_info']['service_charge'] = f"{setting.service_charge_percent}%"
    except Exception as e:
        logger.warning(f"Lỗi khi đọc HotelSetting: {e}")

    # 2. Danh sách Hạng phòng & Đếm số phòng trống THỰC TẾ THEO LỊCH NGÀY KHÁCH HỎI
    try:
        now_date = timezone.localtime(timezone.now()).date() if timezone.is_aware(timezone.now()) else timezone.now().date()
        categories = RoomCategory.objects.all().prefetch_related('rooms', 'amenities', 'images')
        for cat in categories:
            total_rooms, busy_rooms, available_rooms = calculate_category_availability(cat, c_in, c_out, now_date=now_date)
            all_amenities_list = [a.name for a in cat.amenities.all()]
            top_amenities = all_amenities_list[:5]

            feat_img = cat.images.filter(is_feature=True).first() or cat.images.first()
            img_url = feat_img.image.url if (feat_img and feat_img.image) else ''
            if img_url and request:
                img_url = request.build_absolute_uri(img_url)

            clean_desc = strip_html_tags(cat.short_description or cat.description)
            effective_price = int(cat.promo_price) if cat.promo_price else int(cat.base_price)

            context_data['rooms'].append({
                'id': cat.id,
                'name': cat.name,
                'slug': cat.slug,
                'base_price': int(cat.base_price),
                'base_price_formatted': format_currency(cat.base_price),
                'promo_price': int(cat.promo_price) if cat.promo_price else None,
                'promo_price_formatted': format_currency(cat.promo_price) if cat.promo_price else None,
                'effective_price': effective_price,
                'effective_price_multilingual': format_currency_multilingual(effective_price, lang=lang),
                'capacity': cat.capacity,
                'bed_type': cat.bed_type,
                'size': cat.size,
                'available_count': available_rooms,
                'total_count': total_rooms,
                'image_url': img_url,
                'amenities': ", ".join(top_amenities) if top_amenities else "Đầy đủ tiện nghi 5 sao cao cấp",
                'all_amenities': ", ".join(all_amenities_list) if all_amenities_list else "Smart TV 4K, Bồn tắm, Ban công, Minibar, Két sắt, Wifi tốc độ cao",
                'description': clean_desc[:280] if clean_desc else f"Không gian nghỉ dưỡng sang trọng rộng {cat.size}m² với {cat.bed_type}."
            })
    except Exception as e:
        logger.warning(f"Lỗi khi truy vấn RoomCategory: {e}")

    # 3. Danh sách Dịch vụ & Ẩm thực đang phục vụ
    try:
        services = ServiceItem.objects.filter(is_active=True).select_related('category')
        for s in services:
            s_img = s.image_url or (request.build_absolute_uri(s.image.url) if (s.image and request) else '')
            context_data['services'].append({
                'id': s.id,
                'name': s.name,
                'category': s.category.name if s.category else 'Dịch vụ chung',
                'price': int(s.price),
                'price_formatted': format_currency(s.price),
                'price_multilingual': format_currency_multilingual(s.price, lang=lang),
                'description': s.description or '',
                'image_url': s_img
            })
    except Exception as e:
        logger.warning(f"Lỗi khi truy vấn ServiceItem: {e}")

    # 4. Danh sách Khuyến mãi đang kích hoạt
    try:
        now = timezone.now()
        promos = Promotion.objects.filter(is_active=True, valid_from__lte=now, valid_to__gte=now)
        for p in promos:
            discount_str = f"{p.discount_value}%" if p.discount_type == 'percentage' else format_currency(p.discount_value)
            context_data['promotions'].append({
                'code': p.code,
                'name': p.name or p.code,
                'discount': discount_str,
                'min_order': format_currency(p.min_order_value) if p.min_order_value else 'Không giới hạn'
            })
    except Exception as e:
        logger.warning(f"Lỗi khi truy vấn Promotion: {e}")

    # 5. Ngữ cảnh Cá nhân hóa & Trợ lý khách đang lưu trú (CHECKED_IN Concierge)
    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        try:
            vip_tier = "Thành viên (Member)"
            discount_rate = "0%"
            if hasattr(user, 'current_tier') and user.current_tier:
                vip_tier = user.current_tier.name
                discount_rate = f"{getattr(user.current_tier, 'discount_percent', 0)}%"
            elif hasattr(user, 'guest_profile') and user.guest_profile:
                vip_tier = user.guest_profile.vip_tier or vip_tier

            tier_low = str(vip_tier).lower()
            if 'platinum' in tier_low or 'bạch kim' in tier_low or 'diamond' in tier_low or 'kim cương' in tier_low:
                discount_rate = "15%"
            elif 'gold' in tier_low or 'vàng' in tier_low:
                discount_rate = "10%"
            elif 'silver' in tier_low or 'bạc' in tier_low:
                discount_rate = "5%"

            points = getattr(user, 'total_points', 0)
            if hasattr(user, 'guest_profile') and user.guest_profile:
                points = max(points, getattr(user.guest_profile, 'loyalty_points', 0))

            full_name = user.get_full_name() or user.username
            user_data = {
                'username': user.username,
                'full_name': full_name,
                'phone': getattr(user, 'phone_number', '') or '',
                'vip_tier': vip_tier,
                'discount_rate': discount_rate,
                'loyalty_points': points,
                'recent_bookings': [],
                'active_stay': None
            }

            # Ưu tiên tìm đơn đang lưu trú (checked_in) hoặc đơn gần nhất
            checked_in_bk = Booking.objects.filter(
                guest=user, status='checked_in'
            ).select_related('category', 'room').prefetch_related('extra_services', 'service_requests__service').order_by('-created_at').first()

            recent_bks = Booking.objects.filter(guest=user).select_related('category', 'room').prefetch_related('extra_services', 'service_requests__service').order_by('-created_at')[:3]

            status_map = {
                'pending': 'Chờ duyệt / Chờ thanh toán',
                'confirmed': 'Đã xác nhận',
                'paid': 'Đã thanh toán',
                'PAID': 'Đã thanh toán',
                'checked_in': 'Đang lưu trú tại phòng (Checked-in)',
                'checked_out': 'Đã trả phòng (Checked-out)',
                'completed': 'Đã hoàn tất',
                'no_show': 'Khách không đến',
                'cancelled': 'Đã hủy'
            }

            for bk in recent_bks:
                room_str = f"P.{bk.room.room_number}" if bk.room else (bk.category.name if bk.category else 'Hạng tiêu chuẩn')
                st_code = str(bk.status).lower()
                is_paid = st_code in ['paid', 'checked_in', 'checked_out', 'completed']
                user_data['recent_bookings'].append({
                    'id': bk.id,
                    'code': bk.booking_code,
                    'room': room_str,
                    'room_number': bk.room.room_number if bk.room else None,
                    'category_name': bk.category.name if bk.category else '',
                    'check_in': bk.check_in_date.strftime('%d/%m/%Y') if bk.check_in_date else '',
                    'check_out': bk.check_out_date.strftime('%d/%m/%Y') if bk.check_out_date else '',
                    'status': status_map.get(bk.status, bk.status),
                    'status_raw': bk.status,
                    'total_amount': format_currency(bk.total_amount),
                    'is_paid': "Đã thanh toán" if is_paid else "Chưa thanh toán (Chờ cọc/TT)"
                })

            target_stay_bk = checked_in_bk or (recent_bks[0] if recent_bks and str(recent_bks[0].status).lower() in ['confirmed', 'paid'] else None)
            if target_stay_bk:
                user_data['active_stay'] = build_active_stay_details(target_stay_bk, lang=lang)

            context_data['user_context'] = user_data
        except Exception as e:
            logger.warning(f"Lỗi khi nạp user context: {e}")

    return context_data
