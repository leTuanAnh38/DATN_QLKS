import calendar
from datetime import datetime, timedelta
from decimal import Decimal
from django.db.models import Sum, Count, Q, F, Value
from django.db.models.functions import TruncDay, TruncMonth, TruncDate, TruncHour, Coalesce
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, BasePermission

from ..bookings.models import Booking
from ..payments.models import Invoice
from ..rooms.models import Room, RoomCategory
from ..users.models import User


class IsHotelStaffOrManager(BasePermission):
    """
    Quyền truy cập API Báo cáo & Thống kê:
    Dành cho Admin, Quản lý, Chủ khách sạn, Thu ngân và Lễ tân.
    """
    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_staff or user.is_superuser:
            return True
        allowed_roles = ['admin', 'owner', 'manager', 'cashier', 'receptionist']
        return getattr(user, 'role', '') in allowed_roles


class ReportsAnalyticsView(APIView):
    """
    API GET /api/reports/
    Cung cấp toàn bộ dữ liệu thống kê, báo cáo chuyên sâu và trực quan hóa doanh thu cho Admin:
    - Tham số lọc thời gian: ?filter=day|week|month|year (hoặc alias ?time_range=today|7days|month|year)
    - Trả về:
        1. summary: Tổng doanh thu, Số booking, Công suất phòng, Tăng trưởng, ADR
        2. revenue_chart: Mảng dữ liệu doanh thu theo ngày/tháng sử dụng TruncDay, TruncMonth
        3. room_status: Thống kê cơ cấu trạng thái phòng (Trống, Đang ở, Đang dọn, Bảo trì)
        4. revenue_by_category: Thống kê doanh thu theo từng Hạng phòng
        5. top_rooms: Top 5 phòng được đặt nhiều nhất
        6. top_vip_customers: Top 5 khách hàng có tổng chi tiêu cao nhất
    """
    permission_classes = [IsHotelStaffOrManager]

    def get(self, request):
        today = timezone.localdate()
        now = timezone.now()

        # 1. Chuẩn hóa tham số bộ lọc thời gian
        raw_filter = (
            request.query_params.get('filter') or
            request.query_params.get('time_range') or
            'month'
        ).strip().lower()

        # Mapping alias
        filter_map = {
            'day': 'day',
            'today': 'day',
            'week': 'week',
            '7days': 'week',
            'month': 'month',
            '30days': 'month',
            'year': 'year',
        }
        filter_type = filter_map.get(raw_filter, 'month')

        # 2. Xác định khoảng thời gian hiện tại và kỳ trước (để so sánh tăng trưởng)
        if filter_type == 'day':
            start_date = timezone.make_aware(datetime.combine(today, datetime.min.time()))
            end_date = timezone.make_aware(datetime.combine(today, datetime.max.time()))
            filter_label = f"Hôm nay ({today.strftime('%d/%m/%Y')})"
            prev_start = start_date - timedelta(days=1)
            prev_end = start_date - timedelta(microseconds=1)
            prev_label = "so với hôm qua"

        elif filter_type == 'week':
            # 7 ngày gần nhất tính đến hôm nay
            start_date = timezone.make_aware(datetime.combine(today - timedelta(days=6), datetime.min.time()))
            end_date = timezone.make_aware(datetime.combine(today, datetime.max.time()))
            filter_label = "7 ngày gần đây"
            prev_start = start_date - timedelta(days=7)
            prev_end = start_date - timedelta(microseconds=1)
            prev_label = "so với 7 ngày trước"

        elif filter_type == 'year':
            start_date = timezone.make_aware(datetime.combine(datetime(today.year, 1, 1).date(), datetime.min.time()))
            end_date = timezone.make_aware(datetime.combine(datetime(today.year, 12, 31).date(), datetime.max.time()))
            filter_label = f"Năm {today.year}"
            prev_start = timezone.make_aware(datetime.combine(datetime(today.year - 1, 1, 1).date(), datetime.min.time()))
            prev_end = timezone.make_aware(datetime.combine(datetime(today.year - 1, 12, 31).date(), datetime.max.time()))
            prev_label = "so với năm ngoái"

        else:  # 'month'
            _, days_in_month = calendar.monthrange(today.year, today.month)
            start_date = timezone.make_aware(datetime.combine(today.replace(day=1), datetime.min.time()))
            end_date = timezone.make_aware(datetime.combine(today.replace(day=days_in_month), datetime.max.time()))
            filter_label = f"Tháng {today.month:02d}/{today.year}"

            if today.month == 1:
                prev_m, prev_y = 12, today.year - 1
            else:
                prev_m, prev_y = today.month - 1, today.year
            _, prev_days = calendar.monthrange(prev_y, prev_m)
            prev_start = timezone.make_aware(datetime.combine(datetime(prev_y, prev_m, 1).date(), datetime.min.time()))
            prev_end = timezone.make_aware(datetime.combine(datetime(prev_y, prev_m, prev_days).date(), datetime.max.time()))
            prev_label = "so với tháng trước"

        # =====================================================================
        # PHẦN 1: TỔNG QUAN (KPIs)
        # =====================================================================
        # Doanh thu trong kỳ (Hóa đơn đã thanh toán)
        period_invoices = Invoice.objects.filter(
            status='paid',
            paid_at__gte=start_date,
            paid_at__lte=end_date
        )
        period_rev_agg = period_invoices.aggregate(
            total=Coalesce(Sum('total_amount'), Decimal(0)),
            count=Count('id')
        )
        period_revenue = float(period_rev_agg['total'])

        # Doanh thu kỳ trước (để tính tăng trưởng)
        prev_invoices = Invoice.objects.filter(
            status='paid',
            paid_at__gte=prev_start,
            paid_at__lte=prev_end
        )
        prev_rev_agg = prev_invoices.aggregate(
            total=Coalesce(Sum('total_amount'), Decimal(0))
        )
        prev_revenue = float(prev_rev_agg['total'])

        if prev_revenue > 0:
            growth_rate = round(((period_revenue - prev_revenue) / prev_revenue) * 100, 1)
        elif period_revenue > 0:
            growth_rate = 100.0
        else:
            growth_rate = 0.0

        # Tổng doanh thu toàn thời gian
        all_time_rev_agg = Invoice.objects.filter(status='paid').aggregate(
            total=Coalesce(Sum('total_amount'), Decimal(0))
        )
        all_time_revenue = float(all_time_rev_agg['total'])

        # Tổng số booking trong kỳ (tính theo ngày tạo hoặc ngày lưu trú trong kỳ)
        period_bookings = Booking.objects.filter(
            Q(created_at__gte=start_date, created_at__lte=end_date) |
            Q(check_in_date__gte=start_date.date(), check_in_date__lte=end_date.date())
        ).exclude(status='cancelled').distinct()
        period_bookings_count = period_bookings.count()

        # Tổng booking toàn thời gian
        all_time_bookings_count = Booking.objects.exclude(status='cancelled').count()

        # Công suất phòng (Occupancy Rate): Tổng phòng đang ở / Tổng số phòng * 100
        total_rooms_count = Room.objects.count()
        occupied_rooms_count = Room.objects.filter(status='occupied').count()
        available_rooms_count = Room.objects.filter(status='available').count()
        cleaning_rooms_count = Room.objects.filter(status='cleaning').count()
        maintenance_rooms_count = Room.objects.filter(status='maintenance').count()

        occupancy_rate = 0.0
        if total_rooms_count > 0:
            occupancy_rate = round((occupied_rooms_count / total_rooms_count) * 100, 1)

        # Giá trị đơn trung bình (AOV - Average Order Value)
        average_order_value = 0.0
        if period_bookings_count > 0:
            average_order_value = round(period_revenue / period_bookings_count, 0)
        elif all_time_bookings_count > 0 and period_revenue == 0:
            average_order_value = round(all_time_revenue / all_time_bookings_count, 0)

        # =====================================================================
        # PHẦN 2: BIỂU ĐỒ DOANH THU THEO THỜI GIAN (TruncDay, TruncMonth, TruncHour)
        # =====================================================================
        revenue_chart_data = []

        if filter_type == 'day':
            # Biểu đồ theo các khung giờ trong ngày (00h, 04h, 08h, 12h, 16h, 20h)
            time_slots = [
                ('00:00 - 04:00', 0, 4),
                ('04:00 - 08:00', 4, 8),
                ('08:00 - 12:00', 8, 12),
                ('12:00 - 16:00', 12, 16),
                ('16:00 - 20:00', 16, 20),
                ('20:00 - 24:00', 20, 24),
            ]
            hour_agg = (
                period_invoices.annotate(hour=TruncHour('paid_at'))
                .values('hour')
                .annotate(
                    slot_revenue=Coalesce(Sum('total_amount'), Decimal(0)),
                    slot_count=Count('id')
                )
            )
            hour_dict = {item['hour'].hour if item['hour'] else 0: item for item in hour_agg}

            for label, start_h, end_h in time_slots:
                slot_rev = 0
                slot_cnt = 0
                for h in range(start_h, end_h):
                    if h in hour_dict:
                        slot_rev += float(hour_dict[h]['slot_revenue'])
                        slot_cnt += hour_dict[h]['slot_count']
                revenue_chart_data.append({
                    'date': label,
                    'full_date': f"{today.strftime('%d/%m/%Y')} {label}",
                    'revenue': int(slot_rev),
                    'booking_count': slot_cnt,
                })

        elif filter_type == 'week':
            # Biểu đồ theo 7 ngày liên tiếp TruncDate('paid_at')
            daily_agg = (
                period_invoices.annotate(day_date=TruncDate('paid_at'))
                .values('day_date')
                .annotate(
                    day_revenue=Coalesce(Sum('total_amount'), Decimal(0)),
                    day_count=Count('id')
                )
            )
            daily_dict = {item['day_date']: item for item in daily_agg if item['day_date']}

            weekday_names = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
            for i in range(7):
                curr_date = (today - timedelta(days=6 - i))
                match = daily_dict.get(curr_date)
                rev = float(match['day_revenue']) if match else 0
                cnt = match['day_count'] if match else 0
                revenue_chart_data.append({
                    'date': f"{weekday_names[curr_date.weekday()]} ({curr_date.strftime('%d/%m')})",
                    'full_date': curr_date.strftime('%Y-%m-%d'),
                    'revenue': int(rev),
                    'booking_count': cnt,
                })

        elif filter_type == 'year':
            # Biểu đồ theo 12 tháng TruncMonth('paid_at')
            monthly_agg = (
                Invoice.objects.filter(
                    status='paid',
                    paid_at__gte=start_date,
                    paid_at__lte=end_date
                )
                .annotate(month_date=TruncMonth('paid_at'))
                .values('month_date')
                .annotate(
                    month_revenue=Coalesce(Sum('total_amount'), Decimal(0)),
                    month_count=Count('id')
                )
            )
            monthly_dict = {item['month_date'].month: item for item in monthly_agg if item['month_date']}

            for m in range(1, 13):
                match = monthly_dict.get(m)
                rev = float(match['month_revenue']) if match else 0
                cnt = match['month_count'] if match else 0
                revenue_chart_data.append({
                    'date': f"Tháng {m}",
                    'full_date': f"{today.year}-{m:02d}",
                    'revenue': int(rev),
                    'booking_count': cnt,
                })

        else:  # 'month'
            # Biểu đồ theo từng ngày trong tháng TruncDate('paid_at')
            daily_agg = (
                period_invoices.annotate(day_date=TruncDate('paid_at'))
                .values('day_date')
                .annotate(
                    day_revenue=Coalesce(Sum('total_amount'), Decimal(0)),
                    day_count=Count('id')
                )
            )
            daily_dict = {item['day_date']: item for item in daily_agg if item['day_date']}

            _, days_in_month = calendar.monthrange(today.year, today.month)
            for d in range(1, days_in_month + 1):
                curr_date = today.replace(day=d)
                match = daily_dict.get(curr_date)
                rev = float(match['day_revenue']) if match else 0
                cnt = match['day_count'] if match else 0
                revenue_chart_data.append({
                    'date': f"{d:02d}/{today.month:02d}",
                    'full_date': curr_date.strftime('%Y-%m-%d'),
                    'revenue': int(rev),
                    'booking_count': cnt,
                })

        # =====================================================================
        # PHẦN 3: THỐNG KÊ TRẠNG THÁI PHÒNG (Room Status Stats)
        # =====================================================================
        status_colors = {
            'available': '#10b981',    # Emerald 500
            'occupied': '#3b82f6',     # Blue 500
            'cleaning': '#f59e0b',     # Amber 500
            'maintenance': '#ef4444',  # Red 500
        }
        status_labels = {
            'available': 'Phòng trống',
            'occupied': 'Đang có khách',
            'cleaning': 'Đang dọn dẹp',
            'maintenance': 'Bảo trì',
        }

        room_counts_agg = Room.objects.values('status').annotate(total=Count('id'))
        room_counts_dict = {item['status']: item['total'] for item in room_counts_agg}

        room_status_data = []
        for s_code, s_label in status_labels.items():
            cnt = room_counts_dict.get(s_code, 0)
            pct = round((cnt / total_rooms_count * 100), 1) if total_rooms_count > 0 else 0.0
            room_status_data.append({
                'status': s_code,
                'name': s_label,
                'label': s_label,
                'count': cnt,
                'percentage': pct,
                'color': status_colors.get(s_code, '#64748b'),
            })

        # =====================================================================
        # PHẦN 4: THỐNG KÊ DOANH THU THEO LOẠI PHÒNG (Revenue by Room Category)
        # =====================================================================
        category_palette = [
            '#2563eb',  # Blue 600
            '#059669',  # Emerald 600
            '#d97706',  # Amber 600
            '#7c3aed',  # Violet 600
            '#db2777',  # Pink 600
            '#0891b2',  # Cyan 600
        ]

        # Thống kê doanh thu theo loại phòng từ hóa đơn đã thanh toán
        cat_rev_qs = (
            Invoice.objects.filter(status='paid', booking__category__isnull=False)
            .values('booking__category__id', 'booking__category__name')
            .annotate(
                total_rev=Coalesce(Sum('total_amount'), Decimal(0)),
                booking_count=Count('id')
            )
            .order_by('-total_rev')
        )

        total_cat_rev = sum([float(item['total_rev']) for item in cat_rev_qs]) or 1.0

        revenue_by_category_data = []
        for idx, item in enumerate(cat_rev_qs):
            rev_val = float(item['total_rev'])
            pct = round((rev_val / total_cat_rev) * 100, 1)
            revenue_by_category_data.append({
                'category_id': item['booking__category__id'],
                'category_name': item['booking__category__name'],
                'name': item['booking__category__name'],
                'revenue': int(rev_val),
                'booking_count': item['booking_count'],
                'percentage': pct,
                'color': category_palette[idx % len(category_palette)],
            })

        # =====================================================================
        # PHẦN 5: TOP PHÒNG (Top 5 phòng được đặt nhiều nhất)
        # =====================================================================
        top_rooms_qs = (
            Booking.objects.filter(room__isnull=False)
            .exclude(status='cancelled')
            .values(
                'room__id',
                'room__room_number',
                'room__category__name',
                'room__floor'
            )
            .annotate(
                booking_count=Count('id'),
                total_rev=Coalesce(Sum('total_amount'), Decimal(0))
            )
            .order_by('-booking_count', '-total_rev')[:5]
        )

        top_rooms_data = []
        for item in top_rooms_qs:
            top_rooms_data.append({
                'room_id': item['room__id'],
                'room_number': f"P.{item['room__room_number']}",
                'name': f"Phòng {item['room__room_number']}",
                'category_name': item['room__category__name'] or 'Tiêu chuẩn',
                'floor': item['room__floor'] or 1,
                'booking_count': item['booking_count'],
                'total_revenue': int(float(item['total_rev'])),
            })

        # =====================================================================
        # PHẦN 6: TOP KHÁCH HÀNG VIP (Top 5 khách có chi tiêu cao nhất)
        # =====================================================================
        top_vip_qs = (
            User.objects.annotate(
                total_spent=Coalesce(
                    Sum(
                        'bookings__invoice__total_amount',
                        filter=Q(bookings__invoice__status='paid')
                    ),
                    Decimal(0)
                ),
                booking_count=Count(
                    'bookings',
                    filter=~Q(bookings__status='cancelled')
                )
            )
            .filter(Q(total_spent__gt=0) | Q(booking_count__gt=0))
            .order_by('-total_spent', '-booking_count')[:5]
        )

        top_vip_data = []
        for rank, u in enumerate(top_vip_qs, start=1):
            full_name = u.get_full_name() or u.username
            avatar_url = None
            if u.avatar:
                try:
                    avatar_url = request.build_absolute_uri(u.avatar.url)
                except Exception:
                    avatar_url = str(u.avatar)

            vip_tier = 'Silver'
            if hasattr(u, 'guest_profile') and u.guest_profile:
                vip_tier = u.guest_profile.vip_tier or 'Silver'
            elif float(u.total_spent) >= 20000000:
                vip_tier = 'Diamond'
            elif float(u.total_spent) >= 10000000:
                vip_tier = 'Platinum'
            elif float(u.total_spent) >= 5000000:
                vip_tier = 'Gold'

            top_vip_data.append({
                'rank': rank,
                'id': u.id,
                'username': u.username,
                'full_name': full_name,
                'email': u.email or '—',
                'phone_number': u.phone_number or '—',
                'avatar': avatar_url,
                'vip_tier': vip_tier,
                'total_spent': int(float(u.total_spent)),
                'booking_count': u.booking_count,
            })

        # =====================================================================
        # PHẢN HỒI JSON TỔNG HỢP TOÀN BỘ DỮ LIỆU THỐNG KÊ
        # =====================================================================
        return Response({
            'success': True,
            'filter': filter_type,
            'filter_label': filter_label,
            'summary': {
                'total_revenue': int(period_revenue),
                'all_time_revenue': int(all_time_revenue),
                'total_bookings': period_bookings_count,
                'all_time_bookings': all_time_bookings_count,
                'occupancy_rate': occupancy_rate,
                'occupied_rooms': occupied_rooms_count,
                'available_rooms': available_rooms_count,
                'cleaning_rooms': cleaning_rooms_count,
                'maintenance_rooms': maintenance_rooms_count,
                'total_rooms': total_rooms_count,
                'average_order_value': int(average_order_value),
                'growth_rate': growth_rate,
                'prev_label': prev_label,
            },
            'revenue_chart': revenue_chart_data,
            'room_status': room_status_data,
            'revenue_by_category': revenue_by_category_data,
            'top_rooms': top_rooms_data,
            'top_vip_customers': top_vip_data,
            'server_time': now.isoformat(),
        }, status=status.HTTP_200_OK)
