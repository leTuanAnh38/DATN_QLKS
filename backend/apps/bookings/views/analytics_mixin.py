"""Mixin: tổng hợp (summary), timeline và thống kê dashboard."""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from datetime import datetime, timedelta
from django.db.models import Q
from ..models import Booking, BookingExtraService
from ...rooms.models import Room, RoomCategory
from ...services.models import ServiceRequest
from ...payments.models import Invoice, Payment


class BookingAnalyticsMixin:
    """Mixin: tổng hợp (summary), timeline và thống kê dashboard."""


    @action(detail=True, methods=['get'], url_path='summary')
    def summary(self, request, pk=None):
        """
        API GET /api/bookings/{id}/summary/
        Lấy Bảng kê chi tiết trước khi thanh toán và Check-out:
        - room_charge: Tiền lưu trú (Giá phòng * Số đêm thực tế)
        - extra_services: Mảng chứa các ServiceRequest liên kết với Booking này có trạng thái completed
        - total_service_charge: Tổng tiền dịch vụ
        - grand_total: Tổng thanh toán cuối cùng (room_charge + total_service_charge)
        """
        booking = self.get_object()

        # 1. Tính toán số đêm và tiền lưu trú (room_charge)
        check_in = booking.check_in_date
        check_out = booking.check_out_date
        nights = max(1, (check_out - check_in).days) if (check_in and check_out) else 1

        # Xác định đơn giá theo đêm (daily_rate)
        daily_rate = 0.0
        if booking.category and booking.category.base_price:
            daily_rate = float(booking.category.promo_price or booking.category.base_price)
        elif booking.room and booking.room.category and booking.room.category.base_price:
            daily_rate = float(booking.room.category.promo_price or booking.room.category.base_price)

        room_subtotal = daily_rate * nights
        mem_discount = float(booking.membership_discount or 0)

        # Số tiền giảm giá khuyến mãi thực tế của booking
        promo_discount = 0.0
        if booking.applied_promotion:
            if booking.applied_promotion.discount_type == 'percentage':
                calc_promo = (room_subtotal * float(booking.applied_promotion.discount_value)) / 100.0
                if getattr(booking.applied_promotion, 'max_discount_amount', None):
                    calc_promo = min(calc_promo, float(booking.applied_promotion.max_discount_amount))
                promo_discount = calc_promo
            else:
                promo_discount = min(room_subtotal, float(booking.applied_promotion.discount_value))
        elif getattr(booking, 'promotion_discount', None):
            promo_discount = float(booking.promotion_discount)

        # Tiền phòng thuần (pure_room_charge):
        # 1. Ưu tiên lấy từ Invoice nếu đã có hóa đơn
        if hasattr(booking, 'invoice') and booking.invoice and booking.invoice.room_charge is not None and float(booking.invoice.room_charge) > 0:
            pure_room_charge = float(booking.invoice.room_charge)
            actual_promo = max(0.0, room_subtotal - pure_room_charge - mem_discount)
            if actual_promo > 0:
                promo_discount = actual_promo
        elif daily_rate > 0 and nights > 0:
            pure_room_charge = max(0.0, room_subtotal - mem_discount - promo_discount)
        elif booking.total_amount:
            all_services_total = sum(float(r.total_price or 0) for r in booking.service_requests.exclude(status='cancelled'))
            pure_room_charge = max(0.0, float(booking.total_amount) - all_services_total)
        else:
            pure_room_charge = max(0.0, room_subtotal - mem_discount - promo_discount)

        room_charge = pure_room_charge

        # 2. Lấy extra_services (các ServiceRequest liên kết có status='completed')
        import re
        extra_services = []

        # 2.1. Từ ServiceRequest (Yêu cầu gọi món & dịch vụ tại phòng)
        valid_requests = booking.service_requests.exclude(
            status='cancelled'
        ).exclude(
            Q(service__name__icontains='Make-up') | Q(service__name__icontains='dọn dẹp')
        ).select_related('service').order_by('created_at')

        for req in valid_requests:
            s_name = (req.service.name if req.service else 'Dịch vụ phòng').strip()
            price = float(req.service.price if req.service else 0)
            total = float(req.total_price or (price * req.quantity))
            extra_services.append({
                'id': f"req_{req.id}",
                'request_id': req.id,
                'source': 'service_request',
                'service_name': s_name,
                'quantity': req.quantity,
                'price': price,
                'total_price': total,
                'status': req.status,
                'status_display': req.get_status_display(),
                'is_paid': getattr(req, 'is_paid', False),
                'note': req.note or '',
                'created_at': req.created_at.isoformat() if req.created_at else None
            })

        # 2.1.5. Tự động đồng bộ bù (Self-healing) các phiếu kiểm phòng MinibarCheck có hư hại nhưng trước đó chưa ghi vào BookingExtraService
        try:
            for mc in booking.minibar_checks.filter(status='completed', has_damage=True, damage_amount__gt=0):
                dmg_label = (mc.damage_description or 'Bồi thường hư hại phòng').strip()
                has_entry = booking.extra_services.filter(
                    Q(service_name__icontains=dmg_label) |
                    Q(service_name__icontains=f"[Đền bù hư hại] {dmg_label}")
                ).exists()
                if not has_entry:
                    r_prefix = f"[P.{mc.room.room_number}] " if mc.room else ""
                    BookingExtraService.objects.create(
                        booking=booking,
                        service_name=f"{r_prefix}[Đền bù hư hại] {dmg_label}",
                        quantity=1,
                        price=mc.damage_amount,
                        is_paid=False
                    )
        except Exception as e:
            print(f"Lỗi tự động đồng bộ đền bù hư hại từ MinibarCheck: {e}")

        # 2.2. Từ BookingExtraService (Phụ phí lễ tân đã thêm tại quầy / Minibar / Đền bù hư hại)
        for bes in booking.extra_services.all().order_by('added_time'):
            raw_name = (bes.service_name or '').strip()
            if re.search(r'\[Yêu cầu #\d+\]', raw_name, re.IGNORECASE):
                continue
            clean_name = re.sub(r'\(x\d+\)', '', raw_name)
            clean_name = re.sub(r'\[Đền bù hư hại\]\s*', 'Đền bù hư hại: ', clean_name, flags=re.IGNORECASE)
            clean_name = re.sub(r'\[Minibar\]\s*', 'Minibar: ', clean_name, flags=re.IGNORECASE)
            clean_name = re.sub(r'\[.*?\]', '', clean_name).strip()
            total = float((bes.price or 0) * (bes.quantity or 1))

            # Tránh trùng lặp với danh sách service_request đã có
            if any(s['service_name'].lower() == clean_name.lower() and s['quantity'] == bes.quantity for s in extra_services):
                continue

            extra_services.append({
                'id': f"extra_{bes.id}",
                'extra_id': bes.id,
                'source': 'extra_service',
                'service_name': clean_name or raw_name,
                'quantity': bes.quantity,
                'price': float(bes.price or 0),
                'total_price': total,
                'status': 'completed',
                'status_display': 'Đã hoàn thành',
                'is_paid': getattr(bes, 'is_paid', False),
                'note': '',
                'created_at': bes.added_time.isoformat() if bes.added_time else None
            })


        # 2.4. Lấy danh sách phiếu hư hại/bảo trì do khách làm hỏng kèm ảnh bằng chứng (gồm cả Kỹ thuật & Kiểm phòng Minibar)
        damage_tickets = []
        for mt in booking.maintenance_tickets.all().order_by('-start_date'):
            damage_tickets.append({
                'id': mt.id,
                'ticket_code': mt.ticket_code,
                'equipment_name': mt.equipment_name,
                'issue_type': mt.issue_type,
                'issue_type_display': mt.get_issue_type_display(),
                'description': mt.description,
                'cost': float(mt.cost or 0),
                'is_guest_fault': mt.is_guest_fault,
                'status': mt.status,
                'image_before': request.build_absolute_uri(mt.image_before.url) if mt.image_before else None,
                'image_after': request.build_absolute_uri(mt.image_after.url) if mt.image_after else None,
            })

        for mc in booking.minibar_checks.filter(status='completed', has_damage=True).order_by('-completed_at', '-created_at'):
            dmg_label = (mc.damage_description or 'Hư hại đồ dùng phòng').strip()
            if any((dt.get('equipment_name') or '').strip().lower() == dmg_label.lower() for dt in damage_tickets):
                continue
            dmg_img_url = None
            raw_mc_note = mc.note or ''
            img_match = re.search(r'\[DAMAGE_IMG:(.*?)\]', raw_mc_note)
            if img_match:
                extracted_path = img_match.group(1).strip()
                if extracted_path:
                    dmg_img_url = request.build_absolute_uri(extracted_path) if not extracted_path.startswith('http') else extracted_path
            clean_mc_note = re.sub(r'\s*\[DAMAGE_IMG:.*?\]', '', raw_mc_note).strip()
            damage_tickets.append({
                'id': f"mc_{mc.id}",
                'ticket_code': mc.check_code,
                'equipment_name': dmg_label,
                'issue_type': 'minibar_damage',
                'issue_type_display': 'Hư hại đồ dùng (Kiểm phòng)',
                'description': clean_mc_note or f"Buồng phòng ghi nhận khi kiểm phòng P.{mc.room.room_number if mc.room else ''}: {dmg_label}",
                'cost': float(mc.damage_amount or 0),
                'is_guest_fault': True,
                'status': 'completed',
                'image_before': dmg_img_url,
                'image_after': None,
            })

        # 3. Phân tách Dịch vụ đặt trước đã thanh toán vs Dịch vụ phát sinh chưa thanh toán
        prepaid_services_total = float(sum(item['total_price'] for item in extra_services if item['is_paid']))
        unpaid_services_total = float(sum(item['total_price'] for item in extra_services if not item['is_paid']))
        total_service_charge = float(sum(item['total_price'] for item in extra_services))

        # 4. Tổng thanh toán cuối cùng (grand_total = pure_room_charge + total_service_charge)
        grand_total = float(room_charge + total_service_charge)

        # 4.1. Xác định số tiền khách đã thanh toán trước (paid_amount)
        paid_amount = 0.0
        if hasattr(booking, 'payments'):
            completed_payments = booking.payments.filter(payment_status='COMPLETED')
            if completed_payments.exists():
                paid_amount = float(sum(p.amount for p in completed_payments))

        if paid_amount <= 0:
            if booking.status in ['paid', 'PAID'] or (hasattr(booking, 'invoice') and booking.invoice and booking.invoice.status == 'paid'):
                paid_amount = float(booking.total_amount or (room_charge + prepaid_services_total))
            elif booking.note and ('vietqr: đã thanh toán' in booking.note.lower() or 'đã thanh toán thành công' in booking.note.lower()):
                paid_amount = float(booking.total_amount or (room_charge + prepaid_services_total))

        # Đảm bảo paid_amount bao gồm cả các dịch vụ đã thu tiền (is_paid=True) nếu payments chưa ghi nhận
        if prepaid_services_total > 0 and paid_amount < (room_charge + prepaid_services_total):
            has_svc_payment = booking.payments.filter(transaction_id__startswith='SVC-').exists() if hasattr(booking, 'payments') else False
            if not has_svc_payment:
                paid_amount += prepaid_services_total

        # Xác định chính sách thanh toán nếu là phòng thuộc đoàn (Master-Billing)
        is_group_sub_room = bool(booking.group_booking_id and getattr(booking, 'is_master_billed', True))
        group = booking.group_booking
        is_company_all_inclusive = bool(is_group_sub_room and group and getattr(group, 'billing_type', 'ROOM_ONLY') == 'ALL_INCLUSIVE')

        # Số tiền còn lại cần thanh toán khi check-out (remaining_amount)
        if is_company_all_inclusive:
            # Toàn bộ tiền phòng và chi phí dịch vụ/minibar phát sinh được công ty bảo lãnh trả trên Hóa đơn đoàn
            remaining_amount = 0.0
        elif is_group_sub_room:
            # Tiền phòng chuyển HĐ đoàn, khách lẻ chỉ trả dịch vụ phát sinh cá nhân chưa thanh toán
            remaining_amount = max(0.0, float(unpaid_services_total))
        else:
            remaining_amount = max(0.0, float(grand_total - paid_amount))

        # 5. Thông tin hóa đơn đã có (nếu đơn đã từng lập hóa đơn)
        invoice_info = None
        if hasattr(booking, 'invoice') and booking.invoice:
            inv = booking.invoice
            invoice_info = {
                'invoice_code': inv.invoice_code,
                'room_charge': float(inv.room_charge),
                'service_charge': float(inv.service_charge),
                'total_amount': float(inv.total_amount),
                'payment_method': inv.payment_method,
                'payment_method_display': inv.get_payment_method_display(),
                'status': inv.status,
                'status_display': inv.get_status_display(),
                'paid_at': inv.paid_at.isoformat() if inv.paid_at else None,
                'created_at': inv.created_at.isoformat() if inv.created_at else None
            }

        return Response({
            'success': True,
            'booking_id': booking.id,
            'booking_code': booking.booking_code,
            'is_group_room': is_group_sub_room,
            'is_company_all_inclusive': is_company_all_inclusive,
            'group_booking_id': booking.group_booking_id,
            'group_booking_code': group.group_code if group else None,
            'group_booking_name': group.group_name if group else None,
            'group_billing_type': getattr(group, 'billing_type', None) if group else None,
            'guest_name': booking.guest.get_full_name() or booking.guest.username,
            'guest_phone': getattr(booking.guest, 'phone_number', '') or '',
            'guest_email': booking.guest.email or '',
            'identity_card': booking.identity_card or '',
            'room_id': booking.room.id if booking.room else None,
            'room_number': booking.room.room_number if booking.room else None,
            'room_name': booking.category.name if booking.category else (booking.room.category.name if booking.room and booking.room.category else 'Phòng tiêu chuẩn'),
            'check_in_date': booking.check_in_date,
            'check_out_date': booking.check_out_date,
            'actual_check_in': booking.actual_check_in.isoformat() if booking.actual_check_in else None,
            'actual_check_out': booking.actual_check_out.isoformat() if booking.actual_check_out else None,
            'nights': nights,
            'daily_rate': daily_rate,
            'room_subtotal': room_subtotal,
            'room_charge': room_charge,
            'membership_discount': mem_discount,
            'promotion_discount': promo_discount,
            'promotion_code': (booking.applied_promotion.code if booking.applied_promotion else (getattr(booking, 'promotion_code', None) or '')),
            'total_discount': mem_discount + promo_discount,
            'extra_services': extra_services,
            'damage_tickets': damage_tickets,
            'prepaid_services_total': prepaid_services_total,
            'unpaid_services_total': unpaid_services_total,
            'service_charge': total_service_charge,
            'total_service_charge': total_service_charge,
            'total_amount': grand_total,
            'grand_total': grand_total,
            'paid_amount': paid_amount,
            'remaining_balance': remaining_amount,
            'remaining_amount': remaining_amount,
            'status': booking.status,
            'status_display': booking.get_status_display(),
            'invoice': invoice_info
        }, status=status.HTTP_200_OK)


    @action(detail=False, methods=['get'], url_path='timeline')
    def timeline(self, request):
        """
        API GET /api/bookings/timeline/?month=6&year=2026
        Trả về danh sách tất cả các Phòng (Rooms), và bên trong mỗi Phòng lồng ghép
        danh sách các Đơn đặt phòng (Bookings) diễn ra trong tháng đó để Frontend dễ dàng vẽ biểu đồ.
        """
        import calendar
        import datetime
        from collections import defaultdict

        today = timezone.localdate()
        month_param = request.query_params.get('month')
        year_param = request.query_params.get('year')

        try:
            month = int(month_param) if month_param else today.month
            year = int(year_param) if year_param else today.year
            if not (1 <= month <= 12):
                month = today.month
            if not (2000 <= year <= 2100):
                year = today.year
        except (ValueError, TypeError):
            month = today.month
            year = today.year

        _, num_days = calendar.monthrange(year, month)
        month_start = datetime.date(year, month, 1)
        month_end = datetime.date(year, month, num_days)

        # 1. Lấy tất cả các phòng thực tế (Room)
        rooms = Room.objects.select_related('category').all().order_by('floor', 'room_number')

        # 2. Lấy tất cả các đơn đặt phòng diễn ra trong tháng đó (check_in_date <= month_end AND check_out_date >= month_start)
        # Loại bỏ các đơn đã hủy (cancelled) hoặc vắng mặt (no_show) vì không chiếm dụng phòng trên sơ đồ
        month_bookings = Booking.objects.select_related(
            'guest', 'category', 'room', 'room__category', 'group_booking'
        ).prefetch_related(
            'service_requests__service', 'extra_services', 'guests'
        ).filter(
            check_in_date__lte=month_end,
            check_out_date__gte=month_start
        ).exclude(
            status__in=['cancelled', 'no_show']
        ).order_by('check_in_date')

        # Gom nhóm booking theo room_id
        bookings_by_room = defaultdict(list)
        unassigned_bookings = []

        import re
        for b in month_bookings:
            # 1. Ưu tiên lấy tên người đại diện lưu trú của từng phòng (cho đơn đoàn công ty / MICE)
            guest_name = ''
            primary_guest = None
            try:
                primary_guest = b.guests.filter(is_primary=True).first() or b.guests.first()
                if primary_guest and primary_guest.full_name:
                    guest_name = primary_guest.full_name.strip()
            except Exception:
                pass

            if not guest_name and b.guest:
                guest_name = (b.guest.get_full_name().strip() or f"{b.guest.first_name or ''} {b.guest.last_name or ''}".strip()) or b.guest.username

            if not guest_name:
                guest_name = 'Khách vãng lai'

            # Thông tin liên hệ & người ở cùng phòng
            guest_phone = getattr(primary_guest, 'phone_number', None) or (getattr(b.guest, 'phone_number', '') if b.guest else '')
            identity_card = (primary_guest.id_number if primary_guest and primary_guest.id_number else b.identity_card) or ''
            occupants = [g.full_name for g in b.guests.all() if g.full_name]

            # Tính tiền dịch vụ phát sinh (ServiceRequest completed + BookingExtraService)
            service_total = 0.0
            seen_services = set()
            for req in b.service_requests.all():
                if req.status == 'completed':
                    clean_name = (req.service.name if req.service else 'Dịch vụ phòng').strip()
                    price = float(req.service.price if req.service else 0)
                    qty = req.quantity or 1
                    tot = float(req.total_price or (price * qty))
                    seen_services.add((clean_name.lower(), qty, tot))
                    service_total += tot

            for bes in b.extra_services.all():
                raw_name = (bes.service_name or '').strip()
                if re.search(r'\[Yêu cầu #\d+\]', raw_name, re.IGNORECASE):
                    continue
                clean_name = re.sub(r'\(x\d+\)', '', raw_name)
                clean_name = re.sub(r'\[.*?\]', '', clean_name).strip()
                qty = bes.quantity or 1
                price = float(bes.price or 0)
                tot = float(price * qty)
                sig = (clean_name.lower(), qty, tot)
                if sig in seen_services:
                    continue
                service_total += tot

            room_amount = float(b.total_amount or 0)
            grand_total = room_amount + service_total

            booking_item = {
                'id': b.id,
                'guest_id': b.guest_id,
                'booking_code': b.booking_code,
                'guest_name': guest_name,
                'booker_name': b.guest.get_full_name() if b.guest else '',
                'group_name': b.group_booking.group_name if b.group_booking else '',
                'occupants': occupants,
                'guest_phone': guest_phone,
                'guest_email': getattr(b.guest, 'email', '') if b.guest else '',
                'identity_card': identity_card,
                'category_id': b.category_id,
                'category_name': b.category.name if b.category else (b.room.category.name if b.room and b.room.category else ''),
                'room_id': b.room_id,
                'room_number': b.room.room_number if b.room else None,
                'check_in_date': b.check_in_date.isoformat(),
                'check_out_date': b.check_out_date.isoformat(),
                'actual_check_in': b.actual_check_in.isoformat() if b.actual_check_in else None,
                'actual_check_out': b.actual_check_out.isoformat() if b.actual_check_out else None,
                'status': b.status,
                'status_display': b.get_status_display(),
                'room_amount': room_amount,
                'service_amount': service_total,
                'total_amount': grand_total,
                'grand_total_amount': grand_total,
                'nights': (b.check_out_date - b.check_in_date).days,
                'note': b.note or '',
                'internal_note': b.internal_note or ''
            }

            if b.room_id:
                bookings_by_room[b.room_id].append(booking_item)
            else:
                unassigned_bookings.append(booking_item)

        # 3. Lồng ghép danh sách booking vào từng phòng
        rooms_data = []
        for r in rooms:
            rooms_data.append({
                'id': r.id,
                'room_number': r.room_number,
                'floor': r.floor,
                'status': r.status,
                'status_display': r.get_status_display(),
                'category': {
                    'id': r.category.id if r.category else None,
                    'name': r.category.name if r.category else 'Tiêu chuẩn',
                    'base_price': float(r.category.base_price) if r.category and r.category.base_price else 0,
                    'bed_type': r.category.bed_type if r.category else ''
                } if r.category else None,
                'category_name': r.category.name if r.category else 'Tiêu chuẩn',
                'bookings': bookings_by_room.get(r.id, [])
            })

        return Response({
            'success': True,
            'month': month,
            'year': year,
            'days_in_month': num_days,
            'month_start': month_start.isoformat(),
            'month_end': month_end.isoformat(),
            'rooms': rooms_data,
            'unassigned_bookings': unassigned_bookings,
            'total_rooms': len(rooms_data),
            'total_bookings': month_bookings.count()
        }, status=status.HTTP_200_OK)


    @action(detail=False, methods=['get'], url_path='dashboard-stats')
    def dashboard_stats(self, request):
        """
        API GET /api/bookings/dashboard-stats/?time_filter=month
        Cung cấp toàn bộ dữ liệu thống kê thực tế, đồng bộ thời gian thực cho trang Tổng quan Admin Dashboard:
        - Doanh thu thực tế (theo thời gian: hôm nay, 7 ngày, tháng này, năm nay) & tăng trưởng so với kỳ trước
        - Thống kê công suất phòng thực tế & cơ cấu phòng (occupied, available, cleaning, maintenance)
        - Tỷ lệ lấp đầy theo từng hạng phòng thực tế
        - Thống kê đơn đặt phòng & cơ cấu đặt phòng / nguồn đặt phòng
        - Thống kê yêu cầu dịch vụ phòng & danh sách dịch vụ nóng (Concierge)
        """
        import calendar
        from datetime import datetime, timedelta
        from django.db.models import Sum, Count, Q, Case, When, Value, IntegerField

        today = timezone.localdate()
        now = timezone.now()
        time_filter = request.query_params.get('time_filter', 'month').strip().lower()
        if time_filter not in ['today', '7days', 'month', 'year']:
            time_filter = 'month'

        # 1. Xác định khoảng thời gian hiện tại và kỳ trước (để so sánh tăng trưởng)
        if time_filter == 'today':
            start_date = timezone.make_aware(datetime.combine(today, datetime.min.time()))
            end_date = timezone.make_aware(datetime.combine(today, datetime.max.time()))
            period_label = f"Hôm nay ({today.strftime('%d/%m/%Y')})"
            target_label = "Mục tiêu ngày"
            target_revenue = 10000000.0  # 10 triệu

            prev_start = start_date - timedelta(days=1)
            prev_end = start_date - timedelta(microseconds=1)
            prev_label = "so với hôm qua"

        elif time_filter == '7days':
            start_date = timezone.make_aware(datetime.combine(today - timedelta(days=6), datetime.min.time()))
            end_date = timezone.make_aware(datetime.combine(today, datetime.max.time()))
            period_label = "7 ngày qua"
            target_label = "Mục tiêu tuần"
            target_revenue = 50000000.0  # 50 triệu

            prev_start = start_date - timedelta(days=7)
            prev_end = start_date - timedelta(microseconds=1)
            prev_label = "so với 7 ngày trước"

        elif time_filter == 'year':
            start_date = timezone.make_aware(datetime.combine(datetime(today.year, 1, 1).date(), datetime.min.time()))
            end_date = timezone.make_aware(datetime.combine(datetime(today.year, 12, 31).date(), datetime.max.time()))
            period_label = f"Năm {today.year}"
            target_label = f"Mục tiêu năm {today.year}"
            target_revenue = 500000000.0  # 500 triệu

            prev_start = timezone.make_aware(datetime.combine(datetime(today.year - 1, 1, 1).date(), datetime.min.time()))
            prev_end = timezone.make_aware(datetime.combine(datetime(today.year - 1, 12, 31).date(), datetime.max.time()))
            prev_label = "so với năm trước"

        else:  # 'month'
            _, days_in_month = calendar.monthrange(today.year, today.month)
            start_date = timezone.make_aware(datetime.combine(today.replace(day=1), datetime.min.time()))
            end_date = timezone.make_aware(datetime.combine(today.replace(day=days_in_month), datetime.max.time()))
            period_label = f"Tháng {today.month:02d}/{today.year}"
            target_label = f"Mục tiêu Tháng {today.month:02d}"
            target_revenue = 50000000.0  # 50 triệu

            if today.month == 1:
                prev_m, prev_y = 12, today.year - 1
            else:
                prev_m, prev_y = today.month - 1, today.year
            _, prev_days = calendar.monthrange(prev_y, prev_m)
            prev_start = timezone.make_aware(datetime.combine(datetime(prev_y, prev_m, 1).date(), datetime.min.time()))
            prev_end = timezone.make_aware(datetime.combine(datetime(prev_y, prev_m, prev_days).date(), datetime.max.time()))
            prev_label = "so với tháng trước"

        # 2. TÍNH TOÁN DOANH THU THỰC TẾ
        # Hóa đơn thanh toán trong kỳ (Invoice status='paid')
        invoices_period = Invoice.objects.filter(
            status='paid',
            paid_at__gte=start_date,
            paid_at__lte=end_date
        )
        inv_agg = invoices_period.aggregate(
            total=Sum('total_amount'),
            room=Sum('room_charge'),
            service=Sum('service_charge'),
            discount=Sum('discount')
        )
        current_inv_revenue = float(inv_agg['total'] or 0)
        current_room_revenue = float(inv_agg['room'] or 0)
        current_service_revenue = float(inv_agg['service'] or 0)
        paid_invoices_count = invoices_period.count()

        # Kiểm tra thêm nếu có đơn đặt phòng completed trong kỳ nhưng chưa có invoice
        completed_bookings_period = Booking.objects.filter(
            status='completed',
            invoice__isnull=True
        ).filter(
            Q(actual_check_out__gte=start_date, actual_check_out__lte=end_date) |
            Q(actual_check_out__isnull=True, updated_at__gte=start_date, updated_at__lte=end_date)
        )
        comp_agg = completed_bookings_period.aggregate(total=Sum('total_amount'))
        extra_room_rev = float(comp_agg['total'] or 0)
        current_room_revenue += extra_room_rev
        current_revenue = current_inv_revenue + extra_room_rev

        # Doanh thu kỳ trước
        prev_invoices = Invoice.objects.filter(
            status='paid',
            paid_at__gte=prev_start,
            paid_at__lte=prev_end
        )
        prev_inv_agg = prev_invoices.aggregate(total=Sum('total_amount'))
        prev_extra = float(Booking.objects.filter(
            status='completed',
            invoice__isnull=True
        ).filter(
            Q(actual_check_out__gte=prev_start, actual_check_out__lte=prev_end) |
            Q(actual_check_out__isnull=True, updated_at__gte=prev_start, updated_at__lte=prev_end)
        ).aggregate(total=Sum('total_amount'))['total'] or 0)
        prev_revenue = float(prev_inv_agg['total'] or 0) + prev_extra

        # Tính tỷ lệ tăng trưởng
        if prev_revenue > 0:
            growth_rate = round(((current_revenue - prev_revenue) / prev_revenue) * 100, 1)
        elif current_revenue > 0:
            growth_rate = 100.0
        else:
            growth_rate = 0.0

        achievement_rate = min(100.0, round((current_revenue / target_revenue) * 100, 1)) if target_revenue > 0 else 0.0

        # 3. CÔNG SUẤT PHÒNG THỰC TẾ (PMS Rooms)
        all_rooms = Room.objects.select_related('category').all()
        total_rooms = all_rooms.count()
        occupied_rooms = all_rooms.filter(status='occupied').count()
        available_rooms = all_rooms.filter(status='available').count()
        cleaning_rooms = all_rooms.filter(status='cleaning').count()
        maintenance_rooms = all_rooms.filter(status='maintenance').count()

        occupancy_rate = round((occupied_rooms / total_rooms) * 100, 1) if total_rooms > 0 else 0.0

        # 4. TỶ LỆ LẤP ĐẦY THEO HẠNG PHÒNG THỰC TẾ (Category Occupancy Breakdown)
        categories = RoomCategory.objects.prefetch_related('rooms').all().order_by('base_price')
        category_breakdown = []
        palette = ['#2563eb', '#3b82f6', '#f97316', '#0ea5e9', '#8b5cf6', '#10b981']

        for idx, cat in enumerate(categories):
            cat_rooms = cat.rooms.all()
            cat_total = cat_rooms.count()
            cat_occupied = cat_rooms.filter(status='occupied').count()
            cat_available = cat_rooms.filter(status='available').count()
            cat_cleaning = cat_rooms.filter(status='cleaning').count()
            cat_maintenance = cat_rooms.filter(status='maintenance').count()
            cat_rate = round((cat_occupied / cat_total) * 100, 1) if cat_total > 0 else 0.0

            category_breakdown.append({
                'id': cat.id,
                'name': cat.name,
                'total_rooms': cat_total,
                'occupied_rooms': cat_occupied,
                'available_rooms': cat_available,
                'cleaning_rooms': cat_cleaning,
                'maintenance_rooms': cat_maintenance,
                'occupancy_rate': cat_rate,
                'base_price': float(cat.base_price or 0),
                'color': palette[idx % len(palette)]
            })

        # 5. THỐNG KÊ ĐƠN ĐẶT PHÒNG THỰC TẾ
        all_bookings = Booking.objects.all()
        total_bookings = all_bookings.count()
        pending_count = all_bookings.filter(status__in=['pending', 'paid', 'PAID']).count()
        confirmed_count = all_bookings.filter(status='confirmed').count()
        checked_in_count = all_bookings.filter(status='checked_in').count()
        completed_count = all_bookings.filter(status='completed').count()
        cancelled_count = all_bookings.filter(status='cancelled').count()
        no_show_count = all_bookings.filter(status='no_show').count()

        today_check_in = all_bookings.filter(
            check_in_date=today,
            status__in=['pending', 'paid', 'PAID', 'confirmed']
        ).count()
        today_check_out = all_bookings.filter(
            check_out_date=today,
            status='checked_in'
        ).count()

        # Cơ cấu đặt phòng (Booking breakdown / source)
        walkin_filter = (
            Q(guest__username__startswith='walkin_') |
            Q(guest__email__icontains='walkin') |
            Q(note__icontains='walk-in') |
            Q(internal_note__icontains='walk-in') |
            Q(note__icontains='quầy') |
            Q(internal_note__icontains='quầy')
        )
        walkin_count = all_bookings.filter(walkin_filter).distinct().count()
        promo_count = all_bookings.filter(applied_promotion__isnull=False).exclude(walkin_filter).distinct().count()
        direct_count = max(0, total_bookings - promo_count - walkin_count)
        if direct_count == 0 and total_bookings > 0 and promo_count == 0 and walkin_count == 0:
            direct_count = total_bookings

        def calc_pct(count, total):
            return round((count / total) * 100, 1) if total > 0 else 0.0

        booking_sources = [
            {
                'source': 'Website trực tuyến',
                'count': direct_count,
                'percentage': calc_pct(direct_count, total_bookings),
                'color': '#2563eb'
            },
            {
                'source': 'Tại quầy Lễ tân (Walk-in)',
                'count': walkin_count,
                'percentage': calc_pct(walkin_count, total_bookings),
                'color': '#0f172a'
            },
            {
                'source': 'Ưu đãi & Voucher',
                'count': promo_count,
                'percentage': calc_pct(promo_count, total_bookings),
                'color': '#f97316'
            }
        ]

        status_distribution = [
            {'status': 'completed', 'label': 'Đã hoàn tất', 'count': completed_count, 'percentage': calc_pct(completed_count, total_bookings), 'color': '#8b5cf6'},
            {'status': 'checked_in', 'label': 'Đang lưu trú', 'count': checked_in_count, 'percentage': calc_pct(checked_in_count, total_bookings), 'color': '#10b981'},
            {'status': 'confirmed', 'label': 'Đã xác nhận', 'count': confirmed_count, 'percentage': calc_pct(confirmed_count, total_bookings), 'color': '#3b82f6'},
            {'status': 'pending', 'label': 'Chờ duyệt', 'count': pending_count, 'percentage': calc_pct(pending_count, total_bookings), 'color': '#f59e0b'},
        ]

        # 6. YÊU CẦU DỊCH VỤ PHÒNG & CONCIERGE DỊCH VỤ NÓNG
        all_service_requests = ServiceRequest.objects.select_related(
            'booking', 'booking__room', 'booking__guest', 'service', 'service__category'
        ).all()
        total_requests = all_service_requests.count()
        pending_requests_count = all_service_requests.filter(status='pending').count()
        in_progress_requests_count = all_service_requests.filter(status='in_progress').count()
        completed_requests_count = all_service_requests.filter(status='completed').count()
        cancelled_requests_count = all_service_requests.filter(status='cancelled').count()
        total_service_sales = float(sum(float(sr.total_price or 0) for sr in all_service_requests.filter(status='completed')))

        # Danh sách dịch vụ nóng (ưu tiên pending, in_progress & delivering)
        status_order = Case(
            When(status='pending', then=Value(1)),
            When(status='in_progress', then=Value(2)),
            When(status='delivering', then=Value(3)),
            When(status='completed', then=Value(4)),
            default=Value(5),
            output_field=IntegerField()
        )
        recent_requests_qs = all_service_requests.order_by(status_order, '-created_at')[:6]
        recent_service_requests = []
        for sr in recent_requests_qs:
            r_num = sr.booking.room.room_number if sr.booking and sr.booking.room else None
            g_name = sr.booking.guest.get_full_name() or sr.booking.guest.username if sr.booking and sr.booking.guest else (sr.booking.guest_name if hasattr(sr.booking, 'guest_name') else 'Khách')
            cat_name = sr.service.category.name if sr.service and sr.service.category else 'Dịch vụ'

            time_str = sr.created_at.strftime('%H:%M') if sr.created_at else ''
            datetime_str = sr.created_at.strftime('%H:%M • %d/%m') if sr.created_at else ''

            srv_image = ''
            if sr.service:
                if sr.service.image:
                    try:
                        srv_image = request.build_absolute_uri(sr.service.image.url) if request else sr.service.image.url
                    except Exception:
                        srv_image = ''
                if not srv_image:
                    srv_image = sr.service.image_url or ''

            recent_service_requests.append({
                'id': sr.id,
                'service_id': sr.service.id if sr.service else None,
                'service_name': sr.service.name if sr.service else 'Dịch vụ phòng',
                'service_image': srv_image,
                'category_name': cat_name,
                'room_number': r_num or 'Chờ gán',
                'guest_name': g_name,
                'quantity': sr.quantity,
                'total_price': float(sr.total_price or 0),
                'status': sr.status,
                'status_display': sr.get_status_display(),
                'note': sr.note or '',
                'time_str': time_str,
                'datetime_str': datetime_str,
                'created_at': sr.created_at.isoformat() if sr.created_at else None
            })

        # 7. NHỊP ĐẬP VẬN HÀNH TRONG NGÀY (TODAY'S OPERATIONS PULSE)
        ci_expected_qs = all_bookings.filter(check_in_date=today).exclude(status__in=['cancelled', 'no_show'])
        ci_expected_count = ci_expected_qs.count()
        ci_arrived_count = ci_expected_qs.filter(status__in=['checked_in', 'completed', 'checked_out']).count()
        ci_remaining_count = max(0, ci_expected_count - ci_arrived_count)

        co_expected_qs = all_bookings.filter(check_out_date=today).exclude(status='cancelled')
        co_expected_count = co_expected_qs.count()
        co_departed_count = co_expected_qs.filter(status__in=['completed', 'checked_out']).count()
        co_remaining_count = co_expected_qs.filter(status='checked_in').count()

        in_house_qs = all_bookings.filter(status='checked_in')
        in_house_rooms_count = occupied_rooms
        in_house_guests_count = in_house_qs.count() * 2

        readiness_pct = round((available_rooms / max(1, total_rooms)) * 100, 1)

        operations_pulse = {
            'today_date': today.strftime('%d/%m/%Y'),
            'check_in': {
                'total_expected': ci_expected_count,
                'arrived': ci_arrived_count,
                'remaining': ci_remaining_count,
                'progress_pct': round((ci_arrived_count / max(1, ci_expected_count)) * 100, 1) if ci_expected_count > 0 else 100.0
            },
            'check_out': {
                'total_expected': co_expected_count,
                'departed': co_departed_count,
                'remaining': co_remaining_count,
                'progress_pct': round((co_departed_count / max(1, co_expected_count)) * 100, 1) if co_expected_count > 0 else 100.0
            },
            'in_house': {
                'occupied_rooms': in_house_rooms_count,
                'total_rooms': total_rooms,
                'estimated_guests': in_house_guests_count,
                'occupancy_rate': occupancy_rate
            },
            'housekeeping': {
                'available_clean': available_rooms,
                'cleaning_dirty': cleaning_rooms,
                'maintenance': maintenance_rooms,
                'total_rooms': total_rooms,
                'readiness_pct': readiness_pct
            }
        }

        # 8. TRUNG TÂM CẢNH BÁO SỰ VỤ KHẨN (LIVE ACTION CENTER)
        urgent_vietqr_count = all_bookings.filter(status__in=['paid', 'PAID']).count()
        urgent_pending_count = all_bookings.filter(status='pending').count()
        late_checkout_qs = all_bookings.filter(check_out_date__lt=today, status='checked_in')
        late_checkout_count = late_checkout_qs.count()

        urgent_items = []
        if urgent_vietqr_count > 0:
            urgent_items.append({
                'id': 'vietqr_pending',
                'level': 'critical',
                'title': f'{urgent_vietqr_count} đơn thanh toán VietQR (SePay) cần xác nhận',
                'subtitle': 'Khách đã quét mã chuyển khoản thành công, cần duyệt và phân phòng.',
                'count': urgent_vietqr_count,
                'badge': 'VietQR SePay',
                'action_tab': 'bookings',
                'action_filter': 'paid',
                'action_label': 'Xử lý ngay'
            })

        if urgent_pending_count > 0:
            urgent_items.append({
                'id': 'new_bookings_pending',
                'level': 'warning',
                'title': f'{urgent_pending_count} đơn đặt phòng mới đang chờ duyệt',
                'subtitle': 'Cần kiểm tra tình trạng phòng trống và phản hồi cho khách trong vòng 15 phút.',
                'count': urgent_pending_count,
                'badge': 'Đơn mới',
                'action_tab': 'bookings',
                'action_filter': 'pending',
                'action_label': 'Duyệt đơn'
            })

        if pending_requests_count > 0:
            urgent_items.append({
                'id': 'service_requests_pending',
                'level': 'warning',
                'title': f'{pending_requests_count} yêu cầu dịch vụ phòng đang chờ phục vụ',
                'subtitle': 'Khách đang chờ dịch vụ F&B, dọn dẹp hoặc đồ dùng bổ sung tại phòng.',
                'count': pending_requests_count,
                'badge': 'Room Service',
                'action_tab': 'services',
                'action_filter': 'pending',
                'action_label': 'Mở Kanban'
            })

        if late_checkout_count > 0:
            urgent_items.append({
                'id': 'late_checkout',
                'level': 'alert',
                'title': f'{late_checkout_count} phòng quá giờ check-out chưa trả phòng',
                'subtitle': 'Khách đã quá ngày trả phòng dự kiến nhưng vẫn chưa thực hiện thủ tục check-out.',
                'count': late_checkout_count,
                'badge': 'Quá giờ',
                'action_tab': 'bookings',
                'action_filter': 'checked_in',
                'action_label': 'Kiểm tra'
            })

        if maintenance_rooms > 0:
            urgent_items.append({
                'id': 'maintenance_rooms',
                'level': 'info',
                'title': f'{maintenance_rooms} phòng đang bảo trì thiết bị kỹ thuật',
                'subtitle': 'Phòng tạm khóa để bảo dưỡng, kiểm tra tiến độ với bộ phận Kỹ thuật.',
                'count': maintenance_rooms,
                'badge': 'Bảo trì',
                'action_tab': 'rooms',
                'action_filter': 'maintenance',
                'action_label': 'Xem phòng'
            })

        action_center = {
            'total_urgent': len(urgent_items),
            'has_urgent': len(urgent_items) > 0,
            'items': urgent_items
        }

        return Response({
            'success': True,
            'time_filter': time_filter,
            'period_label': period_label,
            'operations_pulse': operations_pulse,
            'action_center': action_center,
            'revenue': {
                'total_revenue': current_revenue,
                'room_revenue': current_room_revenue,
                'service_revenue': current_service_revenue,
                'paid_invoices_count': paid_invoices_count,
                'previous_revenue': prev_revenue,
                'growth_rate': growth_rate,
                'growth_label': prev_label,
                'target_label': target_label,
                'target_revenue': target_revenue,
                'achievement_rate': achievement_rate
            },
            'occupancy': {
                'total_rooms': total_rooms,
                'occupied_rooms': occupied_rooms,
                'available_rooms': available_rooms,
                'cleaning_rooms': cleaning_rooms,
                'maintenance_rooms': maintenance_rooms,
                'occupancy_rate': occupancy_rate,
                'category_breakdown': category_breakdown
            },
            'bookings': {
                'total_bookings': total_bookings,
                'pending_count': pending_count,
                'confirmed_count': confirmed_count,
                'checked_in_count': checked_in_count,
                'completed_count': completed_count,
                'cancelled_count': cancelled_count,
                'no_show_count': no_show_count,
                'today_check_in': today_check_in,
                'today_check_out': today_check_out,
                'booking_sources': booking_sources,
                'status_distribution': status_distribution
            },
            'services': {
                'total_requests': total_requests,
                'pending_count': pending_requests_count,
                'in_progress_count': in_progress_requests_count,
                'completed_count': completed_requests_count,
                'cancelled_count': cancelled_requests_count,
                'total_sales': total_service_sales,
                'recent_requests': recent_service_requests
            }
        }, status=status.HTTP_200_OK)
