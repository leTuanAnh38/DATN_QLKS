import uuid
from decimal import Decimal
from datetime import datetime
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action

from .models import GroupBooking, CorporatePartner, Booking, BookingGuest, BookingExtraService, HotelSetting
from ..services.models import ServiceItem, ServiceRequest
from ..rooms.models import Room, RoomCategory, MinibarCheck
from ..users.models import User, GuestProfile, log_action
from ..users.views import check_role_permission
from ..payments.models import Invoice, Payment
from .serializers import GroupBookingSerializer, CorporatePartnerSerializer, BookingSerializer
from .email_service import send_group_booking_email_async
from ..notifications.services import send_group_booking_notification
from core_project.pagination import StandardResultsSetPagination


class ValidateCorporateCodeView(APIView):
    """
    API xác thực Mã Doanh Nghiệp (Corporate Code) dành cho Khách hàng / Công ty đặt qua Website:
    - POST /api/bookings/validate-corporate-code/
    Payload: { "code": "FPT2026" }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        raw_code = request.data.get('code') or request.data.get('corporate_code')
        if not raw_code:
            return Response({
                'success': False,
                'message': 'Vui lòng nhập Mã doanh nghiệp đối tác.'
            }, status=status.HTTP_400_BAD_REQUEST)

        code_clean = str(raw_code).strip().upper()
        partner = CorporatePartner.objects.filter(corporate_code__iexact=code_clean, is_active=True).first()

        if not partner:
            return Response({
                'success': False,
                'message': f'Mã doanh nghiệp "{code_clean}" không tồn tại hoặc đã hết hiệu lực.'
            }, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'success': True,
            'message': f'Áp dụng thành công ưu đãi Doanh nghiệp: {partner.company_name}',
            'partner': {
                'id': partner.id,
                'company_name': partner.company_name,
                'tax_code': partner.tax_code,
                'company_address': partner.company_address,
                'corporate_code': partner.corporate_code,
                'discount_percent': float(partner.discount_percent),
                'contact_person': partner.contact_person,
                'contact_email': partner.contact_email,
                'payment_terms_days': partner.payment_terms_days
            }
        }, status=status.HTTP_200_OK)


class CorporatePartnerViewSet(viewsets.ModelViewSet):
    """
    API Quản lý Danh bạ Khách hàng Doanh nghiệp / Đối tác B2B:
    - GET /api/corporate-partners/ : Danh sách đối tác
    - POST /api/corporate-partners/ : Thêm đối tác mới
    - PUT/PATCH /api/corporate-partners/<id>/ : Cập nhật đối tác
    - DELETE /api/corporate-partners/<id>/ : Xóa đối tác
    """
    serializer_class = CorporatePartnerSerializer
    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = CorporatePartner.objects.all().order_by('-created_at')
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(company_name__icontains=search) |
                Q(tax_code__icontains=search) |
                Q(corporate_code__icontains=search) |
                Q(contact_person__icontains=search) |
                Q(contact_phone__icontains=search)
            )
        active_only = self.request.query_params.get('active_only')
        if active_only in ['true', '1', True]:
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        partner = serializer.save()
        log_action(user, 'CREATE', 'BOOKING', f"Thêm đối tác Doanh nghiệp: {partner.company_name} (#{partner.corporate_code})", request=self.request)

    def perform_update(self, serializer):
        user = self.request.user
        partner = serializer.save()
        log_action(user, 'UPDATE', 'BOOKING', f"Cập nhật đối tác Doanh nghiệp: {partner.company_name} (#{partner.corporate_code})", request=self.request)


class GroupBookingViewSet(viewsets.ModelViewSet):
    """
    API Quản lý Đơn Đặt Đoàn (Group Bookings / M.I.C.E / Multi-room):
    - GET /api/group-bookings/ : Xem danh sách các đoàn
    - POST /api/group-bookings/ : Tạo đơn đoàn mới (Web & Quầy Lễ tân)
    - GET /api/group-bookings/<id>/ : Chi tiết đơn đoàn kèm danh sách phòng
    - POST /api/group-bookings/<id>/check-in/ : Check-in đồng loạt toàn đoàn
    - POST /api/group-bookings/<id>/check-out/ : Check-out đồng loạt toàn đoàn & xuất hóa đơn VAT
    - POST /api/group-bookings/<id>/rooming-list/ : Cập nhật danh sách lưu trú Rooming List
    - POST /api/group-bookings/<id>/confirm-deposit/ : Xác nhận nhận tiền cọc
    """
    serializer_class = GroupBookingSerializer
    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        # Cho phép tạo đơn đoàn công khai từ Web Client hoặc hủy đơn đoàn
        if self.action in ['create', 'cancel_group']:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return GroupBooking.objects.none()

        qs = GroupBooking.objects.select_related('corporate_partner').prefetch_related(
            'sub_bookings', 'sub_bookings__room', 'sub_bookings__category', 'sub_bookings__guests'
        ).all().order_by('-created_at')

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(group_code__icontains=search) |
                Q(group_name__icontains=search) |
                Q(leader_name__icontains=search) |
                Q(leader_phone__icontains=search) |
                Q(corporate_partner__company_name__icontains=search)
            )

        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all':
            if status_param == 'completed':
                qs = qs.filter(status__in=['completed', 'checked_out'])
            else:
                qs = qs.filter(status=status_param)

        return qs

    def create(self, request, *args, **kwargs):
        """
        Tạo Đơn Đặt Đoàn Master kèm danh sách các phòng con (Multi-room Booking).
        Hỗ trợ tạo từ cả Web Client (khách đặt đoàn online) lẫn Lễ tân tại quầy.
        """
        user = request.user
        # Nếu là nhân viên nội bộ đăng nhập thao tác (không phải khách đặt online), bắt buộc phải có quyền 'create' module bookings
        if user and user.is_authenticated and getattr(user, 'role', '') not in ['', 'guest']:
            if not (user.is_superuser or check_role_permission(user, 'bookings', 'create')):
                return Response({
                    'success': False,
                    'message': 'Tài khoản của bạn không có quyền tạo đơn đặt phòng theo đoàn (Yêu cầu quyền Tạo đơn đặt phòng).'
                }, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        group_name = str(data.get('group_name') or '').strip()
        leader_name = str(data.get('leader_name') or '').strip()
        leader_phone = str(data.get('leader_phone') or '').strip()
        leader_email = str(data.get('leader_email') or '').strip()
        identity_card = str(data.get('identity_card') or '').strip()
        check_in_str = data.get('check_in_date')
        check_out_str = data.get('check_out_date')
        corporate_code = str(data.get('corporate_code') or '').strip()
        partner_id = data.get('corporate_partner_id') or data.get('corporate_partner')
        rooms_data = data.get('rooms', []) # Danh sách [{ category_id: 1, quantity: 2 }, ...]
        note = str(data.get('note') or '').strip()
        internal_note = str(data.get('internal_note') or '').strip()

        # Thông tin xuất hóa đơn VAT công ty
        is_company_invoice = bool(data.get('is_company_invoice', False))
        company_name = str(data.get('company_name') or '').strip()
        company_tax_code = str(data.get('company_tax_code') or '').strip()
        company_address = str(data.get('company_address') or '').strip()
        invoice_recipient_email = str(data.get('invoice_recipient_email') or '').strip()

        # 1. Validate dữ liệu đầu vào bắt buộc
        if not group_name:
            group_name = f"Đoàn khách {leader_name}" if leader_name else "Đoàn khách đặt phòng"

        if not leader_name:
            return Response({'success': False, 'message': 'Vui lòng cung cấp Họ tên Trưởng đoàn / Người phụ trách.'}, status=status.HTTP_400_BAD_REQUEST)

        if not leader_phone:
            return Response({'success': False, 'message': 'Vui lòng cung cấp Số điện thoại người liên hệ.'}, status=status.HTTP_400_BAD_REQUEST)

        if identity_card:
            clean_id = ''.join(c for c in identity_card if c.isalnum())
            clean_phone = ''.join(c for c in leader_phone if c.isdigit())
            if clean_id and clean_id == clean_phone:
                return Response({'success': False, 'message': 'Số CCCD / Hộ chiếu không thể trùng với Số điện thoại.'}, status=status.HTTP_400_BAD_REQUEST)
            if len(identity_card) < 8 or len(identity_card) > 20:
                return Response({'success': False, 'message': 'Số CCCD / Hộ chiếu phải từ 8 đến 20 ký tự hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

        if not check_in_str or not check_out_str:
            return Response({'success': False, 'message': 'Vui lòng chọn ngày Check-in và Check-out.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            check_in = datetime.strptime(str(check_in_str)[:10], '%Y-%m-%d').date()
            check_out = datetime.strptime(str(check_out_str)[:10], '%Y-%m-%d').date()
        except ValueError:
            return Response({'success': False, 'message': 'Định dạng ngày tháng không hợp lệ (YYYY-MM-DD).'}, status=status.HTTP_400_BAD_REQUEST)

        if check_out <= check_in:
            return Response({'success': False, 'message': 'Ngày trả phòng bắt buộc phải sau ngày nhận phòng.'}, status=status.HTTP_400_BAD_REQUEST)

        nights = max(1, (check_out - check_in).days)

        if not rooms_data or not isinstance(rooms_data, list) or len(rooms_data) == 0:
            return Response({'success': False, 'message': 'Vui lòng chọn ít nhất 1 phòng trong cơ cấu đoàn.'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Xác định Đối tác Doanh nghiệp & Chiết khấu Corporate
        partner = None
        if partner_id:
            partner = CorporatePartner.objects.filter(id=partner_id, is_active=True).first()
        elif corporate_code:
            partner = CorporatePartner.objects.filter(corporate_code__iexact=corporate_code, is_active=True).first()

        corporate_discount_percent = Decimal(str(partner.discount_percent or 0)) if partner else Decimal('0')

        # Tự động đồng bộ thông tin hóa đơn từ Đối tác Doanh nghiệp nếu có
        if partner:
            if not company_name:
                company_name = partner.company_name
            if not company_tax_code:
                company_tax_code = partner.tax_code
            if not company_address:
                company_address = partner.company_address
            if not invoice_recipient_email:
                invoice_recipient_email = partner.contact_email
            is_company_invoice = True

        # 3. Tạo / Gán User đại diện cho đoàn
        is_internal_staff = bool(
            user and 
            user.is_authenticated and 
            getattr(user, 'role', '') not in ['', 'guest']
        )
        create_account = bool(data.get('create_account', False)) if is_internal_staff else bool(data.get('create_account', True))

        leader_user = None
        is_client_user = (
            request.user and 
            request.user.is_authenticated and 
            getattr(request.user, 'role', 'guest') == 'guest'
        )
        if is_client_user:
            leader_user = request.user
        else:
            clean_phone = ''.join(c for c in str(leader_phone) if c.isdigit())
            # Tìm user hiện có theo SĐT hoặc Email
            matched_user = None
            if leader_phone:
                matched_user = User.objects.filter(phone_number=leader_phone).first()
            if not matched_user and clean_phone:
                matched_user = User.objects.filter(phone_number=clean_phone).first()
            if not matched_user and leader_email:
                matched_user = User.objects.filter(email__iexact=leader_email).first()

            # Tránh gán nhầm sang tài khoản của người khác khi trùng SĐT
            is_same_person = False
            if matched_user:
                matched_name = matched_user.get_full_name().strip().lower()
                current_name = leader_name.strip().lower()
                if not matched_name:
                    is_same_person = True
                elif matched_name == current_name or matched_name in current_name or current_name in matched_name:
                    is_same_person = True

            if matched_user and is_same_person:
                leader_user = matched_user
                if create_account and not leader_user.is_active:
                    leader_user.is_active = True
                    leader_user.save(update_fields=['is_active'])
                if leader_email:
                    curr_email = (leader_user.email or '').strip().lower()
                    if not curr_email or curr_email.endswith('.local') or curr_email != leader_email.lower():
                        conflict = User.objects.filter(email__iexact=leader_email).exclude(pk=leader_user.pk).exists()
                        if not conflict:
                            leader_user.email = leader_email
                            leader_user.save(update_fields=['email'])
            else:
                phone_already_used = User.objects.filter(phone_number=leader_phone).exists() if leader_phone else False
                email_conflict = User.objects.filter(email__iexact=leader_email).exists() if leader_email else False

                name_parts = leader_name.split()
                first_name = ' '.join(name_parts[:-1]) if len(name_parts) > 1 else leader_name
                last_name = name_parts[-1] if len(name_parts) > 1 else ''

                if create_account:
                    # 1. Khách muốn đăng ký tài khoản thành viên chính thức (Active User)
                    base_username = f"group_{clean_phone[-6:]}" if len(clean_phone) >= 6 else f"group_{uuid.uuid4().hex[:6]}"
                    username = base_username
                    counter = 1
                    while User.objects.filter(username=username).exists():
                        username = f"{base_username}_{counter}"
                        counter += 1

                    email_to_use = leader_email if (leader_email and not email_conflict) else f"{username}@group.hotel.local"
                    phone_to_save = None if phone_already_used else (leader_phone or None)

                    leader_user = User.objects.create_user(
                        username=username,
                        email=email_to_use,
                        phone_number=phone_to_save,
                        first_name=first_name,
                        last_name=last_name,
                        role='guest',
                        is_active=True
                    )
                else:
                    # 2. Khách vãng lai thông thường (offline, không tạo tài khoản web)
                    unique_tag = uuid.uuid4().hex[:6]
                    username = f"walkin_group_{clean_phone[-6:]}_{unique_tag}" if len(clean_phone) >= 6 else f"walkin_group_{unique_tag}"
                    email_to_use = leader_email if (leader_email and not email_conflict) else f"{username}@walkin.hotel.local"
                    phone_to_save = None if phone_already_used else (leader_phone or None)

                    leader_user = User.objects.create(
                        username=username,
                        email=email_to_use,
                        phone_number=phone_to_save,
                        first_name=first_name,
                        last_name=last_name,
                        role='guest',
                        is_active=True
                    )
                    leader_user.set_unusable_password()
                    leader_user.save(update_fields=['password'])

        if identity_card:
            profile, _ = GuestProfile.objects.get_or_create(user=leader_user)
            if not profile.id_card_number:
                profile.id_card_number = identity_card
                profile.save(update_fields=['id_card_number'])

        # 4. Kiểm tra phòng trống và tính toán tổng tiền trong Transaction
        with transaction.atomic():
            total_rooms_count = 0
            total_group_amount = Decimal('0')
            sub_bookings_to_create = []

            # Phân tách danh sách khách lưu trú & dịch vụ (Rooming List) gửi lên theo từng hạng phòng (nếu có)
            rooming_list = data.get('rooming_list', [])
            rooming_by_cat = {}
            if isinstance(rooming_list, list):
                for item in rooming_list:
                    if not isinstance(item, dict):
                        continue
                    c_id = item.get('category_id')
                    try:
                        c_id = int(c_id)
                    except (ValueError, TypeError):
                        pass
                    if c_id not in rooming_by_cat:
                        rooming_by_cat[c_id] = []
                    rooming_by_cat[c_id].append(item)

            total_rooms_net_amount = Decimal('0')
            total_services_amount = Decimal('0')
            total_corp_discount = Decimal('0')

            for r_item in rooms_data:
                cat_id = r_item.get('category_id') or r_item.get('id')
                qty = int(r_item.get('quantity', 1))
                if qty <= 0:
                    continue

                category_obj = RoomCategory.objects.select_for_update().filter(pk=cat_id).first()
                if not category_obj:
                    return Response({
                        'success': False,
                        'message': f'Không tìm thấy hạng phòng có mã ID #{cat_id}.'
                    }, status=status.HTTP_404_NOT_FOUND)

                # Kiểm tra quỹ phòng trống
                total_cat_rooms = category_obj.rooms.exclude(status='maintenance').count()
                booked_cat_rooms = Booking.objects.filter(
                    category=category_obj,
                    check_in_date__lt=check_out,
                    check_out_date__gt=check_in
                ).filter(
                    Q(status__in=['confirmed', 'checked_in', 'paid', 'PAID']) |
                    Q(status='pending', created_at__gte=timezone.now() - timezone.timedelta(minutes=15))
                ).count()

                available_cat_rooms = max(0, total_cat_rooms - booked_cat_rooms)
                if available_cat_rooms < qty:
                    return Response({
                        'success': False,
                        'message': f'Hạng phòng "{category_obj.name}" chỉ còn {available_cat_rooms} phòng trống, không đủ đáp ứng số lượng {qty} phòng theo yêu cầu của đoàn.'
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Đơn giá 1 phòng 1 đêm
                base_price = category_obj.promo_price or category_obj.base_price
                subtotal_per_room = Decimal(str(base_price * nights))

                # Áp dụng chiết khấu Corporate nếu có
                corp_discount_per_room = Decimal('0')
                if corporate_discount_percent > 0:
                    corp_discount_per_room = (subtotal_per_room * corporate_discount_percent) / Decimal('100')

                net_price_per_room = max(Decimal('0'), subtotal_per_room - corp_discount_per_room)

                # Lấy danh sách các phòng vật lý có sẵn để gán trước (nếu có)
                available_physical_rooms = list(category_obj.rooms.filter(status='available'))

                for idx in range(qty):
                    assigned_room = available_physical_rooms[idx] if idx < len(available_physical_rooms) else None
                    
                    # Lấy thông tin phòng (khách + dịch vụ) đã khai báo trước cho phòng này (nếu có)
                    declared_item = {}
                    if cat_id in rooming_by_cat and len(rooming_by_cat[cat_id]) > 0:
                        declared_item = rooming_by_cat[cat_id].pop(0)

                    declared_guests = declared_item.get('guests', []) if isinstance(declared_item, dict) else (declared_item if isinstance(declared_item, list) else [])
                    raw_services = declared_item.get('services', []) if isinstance(declared_item, dict) else []

                    # Tính chi phí dịch vụ chọn trước cho riêng phòng này
                    room_services = []
                    room_service_total = Decimal('0')
                    if isinstance(raw_services, list):
                        for s_entry in raw_services:
                            s_id = s_entry.get('service_id') or s_entry.get('id')
                            s_qty = int(s_entry.get('quantity', 1))
                            if s_id and s_qty > 0:
                                svc_item = ServiceItem.objects.filter(pk=s_id, is_active=True).first()
                                if svc_item:
                                    s_price = Decimal(str(svc_item.price))
                                    s_total = s_price * Decimal(str(s_qty))
                                    room_services.append({
                                        'service': svc_item,
                                        'quantity': s_qty,
                                        'unit_price': s_price,
                                        'total_price': s_total
                                    })
                                    room_service_total += s_total

                    # Tổng tiền của phòng con này = Giá phòng ròng + Dịch vụ chọn kèm
                    sub_booking_total = net_price_per_room + room_service_total

                    sub_bookings_to_create.append({
                        'category': category_obj,
                        'room': assigned_room,
                        'room_net_price': net_price_per_room,
                        'service_charge': room_service_total,
                        'total_amount': sub_booking_total,
                        'membership_discount': corp_discount_per_room,
                        'guests': declared_guests,
                        'services': room_services
                    })

                    total_rooms_net_amount += net_price_per_room
                    total_services_amount += room_service_total
                    total_corp_discount += corp_discount_per_room
                    total_group_amount += sub_booking_total
                    total_rooms_count += 1

            if total_rooms_count == 0:
                return Response({'success': False, 'message': 'Vui lòng chọn số lượng phòng hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

            # Tính tiền đặt cọc quy định theo 2 lựa chọn thanh toán:
            # - 'DEPOSIT_PERCENT': Đặt cọc theo tỷ lệ quy định hệ thống (mặc định 50%)
            # - 'FULL': Thanh toán toàn bộ 100% tổng đơn
            payment_option = str(data.get('payment_option') or 'DEPOSIT_50').upper()
            input_deposit = data.get('deposit_amount')

            if payment_option in ['FULL', '100', 'ALL']:
                deposit_amount = total_group_amount
            elif input_deposit is not None and str(input_deposit).replace('.', '', 1).isdigit() and Decimal(str(input_deposit)) >= 0:
                deposit_amount = Decimal(str(input_deposit))
            else:
                setting = HotelSetting.get_settings()
                dep_rate = Decimal(str(setting.group_deposit_percent or 50)) / Decimal('100')
                deposit_amount = round(total_group_amount * dep_rate)

            is_deposit_paid = bool(data.get('is_deposit_paid', False))
            deposit_payment_method = str(data.get('deposit_payment_method') or 'TRANSFER').upper()
            if deposit_payment_method not in ['TRANSFER', 'CASH', 'POS', 'CREDIT']:
                deposit_payment_method = 'TRANSFER'

            initial_group_status = 'confirmed' if is_deposit_paid else 'tentative'

            billing_type = str(data.get('billing_type') or 'ROOM_ONLY').strip().upper()
            if billing_type not in ['ROOM_ONLY', 'ALL_INCLUSIVE']:
                billing_type = 'ROOM_ONLY'

            # 5. Tạo Master GroupBooking
            group_booking = GroupBooking.objects.create(
                group_name=group_name,
                corporate_partner=partner,
                leader_name=leader_name,
                leader_phone=leader_phone,
                leader_email=leader_email,
                check_in_date=check_in,
                check_out_date=check_out,
                total_amount=total_group_amount,
                deposit_amount=deposit_amount,
                is_deposit_paid=is_deposit_paid,
                billing_type=billing_type,
                status=initial_group_status,
                note=note,
                internal_note=internal_note
            )

            # 6. Tạo các đơn phòng con (Sub-Bookings) & Dịch vụ đi kèm
            created_sub_bookings = []
            sub_booking_status = 'confirmed' if is_deposit_paid else 'pending'
            for b_info in sub_bookings_to_create:
                cat_obj = b_info['category']
                assigned_r = b_info['room']
                raw_guests = b_info.get('guests', [])
                valid_guests = [g for g in raw_guests if (g.get('full_name') or '').strip()] if isinstance(raw_guests, list) else []

                # Giới hạn số lượng khách theo sức chứa tối đa của phòng
                room_cap = cat_obj.capacity if (cat_obj and cat_obj.capacity) else 2
                if len(valid_guests) > room_cap:
                    valid_guests = valid_guests[:room_cap]

                primary_guest = next((g for g in valid_guests if g.get('is_primary')), None)
                if not primary_guest and len(valid_guests) > 0:
                    primary_guest = valid_guests[0]

                room_guest_id_card = (primary_guest.get('id_number') or identity_card) if primary_guest else identity_card

                single_booking = Booking.objects.create(
                    guest=leader_user,
                    category=cat_obj,
                    room=assigned_r,
                    group_booking=group_booking,
                    is_master_billed=True,
                    identity_card=room_guest_id_card or '',
                    check_in_date=check_in,
                    check_out_date=check_out,
                    total_amount=b_info['total_amount'],
                    membership_discount=b_info['membership_discount'],
                    status=sub_booking_status,
                    note=f"[Đơn thuộc Đoàn #{group_booking.group_code} - {group_booking.group_name}]"
                )

                # Lưu danh sách khách lưu trú đã chỉ định
                if valid_guests:
                    for g_idx, g_data in enumerate(valid_guests):
                        is_primary_flag = bool(g_data.get('is_primary') if g_data.get('is_primary') is not None else (g_idx == 0))
                        dob_val = None
                        dob_raw = g_data.get('date_of_birth')
                        if dob_raw:
                            try:
                                dob_val = datetime.strptime(str(dob_raw)[:10], '%Y-%m-%d').date()
                            except ValueError:
                                dob_val = None

                        BookingGuest.objects.create(
                            booking=single_booking,
                            full_name=(g_data.get('full_name') or '').strip(),
                            id_type=g_data.get('id_type') or 'CCCD',
                            id_number=g_data.get('id_number') or None,
                            date_of_birth=dob_val,
                            gender=g_data.get('gender') or 'Nam',
                            nationality=g_data.get('nationality') or 'Việt Nam',
                            is_primary=is_primary_flag
                        )
                else:
                    BookingGuest.objects.create(
                        booking=single_booking,
                        full_name=f"{leader_name} (Thành viên đoàn)",
                        id_type='CCCD',
                        id_number=identity_card or None,
                        is_primary=True
                    )

                # Gắn các dịch vụ chọn kèm cho riêng phòng con này
                for s_entry in b_info.get('services', []):
                    svc = s_entry['service']
                    ServiceRequest.objects.create(
                        booking=single_booking,
                        service=svc,
                        quantity=s_entry['quantity'],
                        unit_price=s_entry['unit_price'],
                        total_price=s_entry['total_price'],
                        status='pending',
                        is_paid=is_deposit_paid,
                        note=f"Dịch vụ đặt kèm đoàn #{group_booking.group_code} ({group_booking.group_name})",
                        request_time=timezone.now()
                    )
                    BookingExtraService.objects.create(
                        booking=single_booking,
                        service_name=f"{svc.name} [Đặt kèm đoàn]",
                        quantity=s_entry['quantity'],
                        price=s_entry['unit_price'],
                        is_paid=is_deposit_paid
                    )

                created_sub_bookings.append(single_booking)

            # 7. Tạo Master Invoice cho toàn đoàn (chi tiết tiền phòng, dịch vụ, chiết khấu)
            is_full_payment = (payment_option in ['FULL', '100', 'ALL'])
            Invoice.objects.create(
                group_booking=group_booking,
                booking=None,
                room_charge=total_rooms_net_amount,
                service_charge=total_services_amount,
                discount=total_corp_discount,
                tax=Decimal('0'),
                total_amount=total_group_amount,
                status='paid' if (is_full_payment and is_deposit_paid) else 'pending',
                is_company_invoice=is_company_invoice,
                company_name=company_name or None,
                company_tax_code=company_tax_code or None,
                company_address=company_address or None,
                invoice_recipient_email=invoice_recipient_email or None
            )

            # 8. Tạo bản ghi Payment (50% tiền cọc hoặc 100% thanh toán tất cả)
            payment_amount = deposit_amount if deposit_amount > 0 else total_group_amount
            Payment.objects.create(
                group_booking=group_booking,
                booking=None,
                amount=payment_amount,
                payment_method=deposit_payment_method,
                payment_status='COMPLETED' if is_deposit_paid else 'PENDING',
                transaction_id=f"TXN-{group_booking.group_code}"
            )

        log_action(
            request.user if request.user.is_authenticated else None,
            'CREATE',
            'BOOKING',
            f"Tạo Đơn Đặt Đoàn #{group_booking.group_code} ({group_name} - {total_rooms_count} phòng).",
            request=request
        )

        # Tự động gửi email xác nhận đặt đoàn:
        # - Nếu đã thanh toán cọc: gửi email xác nhận ĐÃ THANH TOÁN TIỀN CỌC THÀNH CÔNG
        # - Nếu chưa cọc và KHÔNG phải luồng thanh toán VietQR online trên web (khách đặt tại quầy/chuyển khoản sau):
        #   gửi email tiếp nhận đơn đoàn kèm mã VietQR cọc.
        # - Nếu khách đặt trên Web và chọn VietQR online: tuân theo Phương án 1 (chờ quét VietQR xong SePay Webhook tự động gửi).
        try:
            is_vietqr_online = (
                not is_deposit_paid and
                deposit_payment_method == 'TRANSFER' and
                (not request.user.is_authenticated or getattr(request.user, 'role', '') in ['', 'guest'])
            )
            if is_deposit_paid:
                send_group_booking_email_async(
                    group_booking=group_booking,
                    email_type='payment_success'
                )
            elif not is_vietqr_online:
                send_group_booking_email_async(
                    group_booking=group_booking,
                    email_type='group_confirmation'
                )
        except Exception:
            pass

        # Gửi thông báo In-App cho đoàn mới tạo
        try:
            send_group_booking_notification(
                group_booking=group_booking,
                event_type='created',
                actor=request.user if request.user.is_authenticated else None
            )
        except Exception:
            pass

        serializer = GroupBookingSerializer(group_booking, context={'request': request})
        return Response({
            'success': True,
            'message': f'Tạo đơn đặt đoàn #{group_booking.group_code} thành công ({total_rooms_count} phòng)!',
            'group_booking': serializer.data,
            'group_code': group_booking.group_code,
            'deposit_amount': float(deposit_amount),
            'total_amount': float(total_group_amount),
            'total_rooms': total_rooms_count
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='check-in')
    def group_check_in(self, request, pk=None):
        """
        API POST /api/group-bookings/<id>/check-in/
        Check-in đồng loạt toàn bộ các phòng trong đoàn (1 chạm).
        """
        group = self.get_object()
        user = request.user

        if not (user.is_superuser or check_role_permission(user, 'bookings', 'update')):
            return Response({'success': False, 'message': 'Bạn không có quyền thực hiện Check-in đoàn.'}, status=status.HTTP_403_FORBIDDEN)

        now = timezone.now()
        sub_bookings = group.sub_bookings.exclude(status__in=['checked_out', 'completed', 'cancelled'])

        if not sub_bookings.exists():
            return Response({'success': False, 'message': 'Không có phòng nào trong đoàn khả dụng để Check-in.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            checked_in_count = 0
            for b in sub_bookings:
                # Nếu chưa có phòng vật lý, gán phòng trống thuộc hạng đó
                if not b.room:
                    avail_room = b.category.rooms.filter(status='available').first()
                    if avail_room:
                        b.room = avail_room

                if b.room:
                    b.room.status = 'occupied'
                    b.room.save(update_fields=['status'])

                b.status = 'checked_in'
                b.actual_check_in = now
                b.save(update_fields=['status', 'actual_check_in', 'room'])
                checked_in_count += 1

            group.status = 'checked_in'
            group.save(update_fields=['status'])

        log_action(user, 'UPDATE', 'BOOKING', f"Check-in đồng loạt đoàn #{group.group_code} ({checked_in_count} phòng).", request=request)

        # Gửi thông báo In-App gom toàn đoàn cho Check-in (không spam phòng lẻ)
        try:
            send_group_booking_notification(
                group_booking=group,
                event_type='check_in',
                actor=user,
                extra_data={'checked_in_count': checked_in_count}
            )
        except Exception:
            pass

        return Response({
            'success': True,
            'message': f'Check-in thành công {checked_in_count} phòng cho đoàn #{group.group_code}!',
            'group_booking': GroupBookingSerializer(group, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='check-out')
    def group_check_out(self, request, pk=None):
        """
        API POST /api/group-bookings/<id>/check-out/
        Check-out đồng loạt toàn bộ đoàn, chuyển phòng sang 'cleaning', hoàn tất hóa đơn.
        """
        group = self.get_object()
        user = request.user

        can_checkout_group = (
            user.is_superuser or
            getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'cashier'] or
            check_role_permission(user, 'bookings', 'update') or
            check_role_permission(user, 'finance', 'create') or
            check_role_permission(user, 'finance', 'update')
        )
        if not can_checkout_group:
            return Response({'success': False, 'message': 'Bạn không có quyền thực hiện Check-out đoàn.'}, status=status.HTTP_403_FORBIDDEN)

        now = timezone.now()
        sub_bookings = group.sub_bookings.exclude(status__in=['cancelled', 'completed', 'checked_out'])

        with transaction.atomic():
            checked_out_count = 0
            for b in sub_bookings:
                if b.room:
                    b.room.status = 'cleaning'
                    b.room.save(update_fields=['status'])

                b.status = 'completed'
                b.actual_check_out = now
                b.save(update_fields=['status', 'actual_check_out'])
                checked_out_count += 1

            group.status = 'completed'
            group.save(update_fields=['status'])

            # Cập nhật hoặc tạo Master Invoice thanh toán toàn bộ cho đoàn
            from ..payments.models import Invoice, Payment
            payment_method = request.data.get('payment_method', 'transfer')
            method_code = 'TRANSFER' if str(payment_method).lower() in ['bank_transfer', 'momo', 'transfer', 'vietqr', 'credit_card'] else 'CASH'
            
            # Nếu công ty chi trả toàn bộ (ALL_INCLUSIVE):
            # Tự động quét và gom toàn bộ phụ phí dịch vụ phát sinh chưa thanh toán của tất cả phòng con vào hóa đơn đoàn
            unpaid_incidental_services = 0.0
            if getattr(group, 'billing_type', 'ROOM_ONLY') == 'ALL_INCLUSIVE':
                sub_ids = list(group.sub_bookings.values_list('id', flat=True))
                unpaid_bes = BookingExtraService.objects.filter(booking_id__in=sub_ids, is_paid=False)
                unpaid_incidental_services = float(sum((b.price or 0) * (b.quantity or 1) for b in unpaid_bes))
                # Đánh dấu các dịch vụ này là đã thanh toán theo hóa đơn đoàn
                unpaid_bes.update(is_paid=True)
                ServiceRequest.objects.filter(booking_id__in=sub_ids, is_paid=False).update(is_paid=True)

            deposit_paid = float(group.deposit_amount or 0) if group.is_deposit_paid else 0.0
            total_contract = float(group.total_amount or 0) + unpaid_incidental_services
            remaining_balance = max(0.0, total_contract - deposit_paid)

            master_inv = getattr(group, 'master_invoice', None)
            if not master_inv:
                master_inv = Invoice.objects.filter(group_booking=group).first()

            corp = group.corporate_partner
            is_company_invoice = bool(request.data.get('is_company_invoice', True))
            comp_name = request.data.get('company_name') or (corp.company_name if corp else group.group_name)
            tax_code = request.data.get('company_tax_code') or (corp.tax_code if corp else '')
            addr = request.data.get('company_address') or (corp.company_address if corp else '')
            email = request.data.get('invoice_recipient_email') or (corp.contact_email if corp else group.leader_email)

            if not master_inv:
                master_inv = Invoice.objects.create(
                    group_booking=group,
                    room_charge=float(group.total_amount or 0),
                    service_charge=unpaid_incidental_services,
                    total_amount=total_contract,
                    status='paid',
                    payment_method=payment_method,
                    paid_at=now,
                    is_company_invoice=is_company_invoice,
                    company_name=comp_name,
                    company_tax_code=tax_code,
                    company_address=addr,
                    invoice_recipient_email=email
                )
            else:
                master_inv.service_charge = float(master_inv.service_charge or 0) + unpaid_incidental_services
                master_inv.total_amount = total_contract
                master_inv.status = 'paid'
                master_inv.paid_at = now
                master_inv.payment_method = payment_method
                if is_company_invoice:
                    master_inv.is_company_invoice = True
                    master_inv.company_name = comp_name
                    master_inv.company_tax_code = tax_code
                    master_inv.company_address = addr
                    master_inv.invoice_recipient_email = email
                master_inv.save()

            # Ghi nhận Payment cho số tiền còn lại (nếu có)
            if remaining_balance > 0 and request.data.get('mark_invoice_paid', True):
                Payment.objects.create(
                    group_booking=group,
                    amount=remaining_balance,
                    payment_method=method_code,
                    payment_status='COMPLETED'
                )

        log_action(user, 'UPDATE', 'BOOKING', f"Check-out đoàn #{group.group_code} ({checked_out_count} phòng). Quyết toán Master Invoice {total_contract:,.0f} đ.", request=request)

        # Gửi thông báo In-App gom toàn đoàn cho Check-out & Quyết toán Master Invoice
        try:
            send_group_booking_notification(
                group_booking=group,
                event_type='check_out',
                actor=user,
                extra_data={
                    'checked_out_count': checked_out_count,
                    'total_contract': total_contract
                }
            )
        except Exception:
            pass

        return Response({
            'success': True,
            'message': f'Hoàn tất Check-out cho đoàn #{group.group_code}!',
            'group_booking': GroupBookingSerializer(group, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='request-inspection')
    def request_group_inspection(self, request, pk=None):
        """
        API POST /api/bookings/groups/<id>/request-inspection/
        Lễ tân gửi yêu cầu kiểm tra đón đầu Minibar & Hư hại toàn bộ các phòng trong đoàn trước giờ Check-out.
        """
        group = self.get_object()
        user = request.user

        active_sub_bookings = group.sub_bookings.filter(status='checked_in').select_related('room', 'guest')
        if not active_sub_bookings.exists():
            return Response({
                'success': False,
                'message': 'Đoàn không có phòng nào đang ở (checked-in) để kiểm tra.'
            }, status=status.HTTP_400_BAD_REQUEST)

        note = request.data.get('note', '').strip() or f"Lễ tân yêu cầu kiểm phòng đón đầu trước Check-out đoàn #{group.group_code} ({group.group_name})"
        receptionist_name = (user.get_full_name() or user.username) if user.is_authenticated else "Lễ tân"

        created_checks = []
        room_numbers = []

        with transaction.atomic():
            for b in active_sub_bookings:
                if not b.room:
                    continue
                room_numbers.append(str(b.room.room_number))
                pending_check = b.room.minibar_checks.filter(status='requested').order_by('-created_at').first()
                if pending_check:
                    pending_check.requested_by = user if user.is_authenticated else None
                    pending_check.booking = b
                    pending_check.note = note
                    pending_check.save()
                    created_checks.append(pending_check)
                else:
                    check = MinibarCheck.objects.create(
                        room=b.room,
                        booking=b,
                        requested_by=user if user.is_authenticated else None,
                        status='requested',
                        items_consumed=[],
                        total_amount=0,
                        note=note
                    )
                    created_checks.append(check)

        # Gửi thông báo đến Buồng phòng và Quản lý
        try:
            from ..notifications.models import Notification
            recipients = User.objects.filter(
                Q(role__in=['housekeeper', 'manager', 'admin', 'receptionist']) | Q(is_superuser=True)
            ).distinct()
            rooms_str = ", ".join(room_numbers) if room_numbers else "các phòng"
            notif_title = f"🛎️ [KIỂM PHÒNG ĐOÀN] Đoàn #{group.group_code} chuẩn bị Check-out ({len(room_numbers)} phòng)"
            notif_message = (
                f"Lễ tân ({receptionist_name}) vừa gửi yêu cầu kiểm tra toàn đoàn: {group.group_name}.\n"
                f"Danh sách {len(room_numbers)} phòng: {rooms_str}.\n"
                f"Vui lòng tiến hành kiểm tra Minibar và Hư hại tài sản trước khi đoàn rời đi!"
            )
            for r in recipients:
                Notification.objects.create(
                    recipient=r,
                    title=notif_title,
                    message=notif_message,
                    notification_type='room',
                    action_url='/admin/rooms',
                    priority='high'
                )
        except Exception:
            pass

        log_action(
            user=user,
            action='CREATE',
            module='BOOKING',
            description=f"Lễ tân {receptionist_name} yêu cầu kiểm phòng hàng loạt cho đoàn #{group.group_code} ({len(room_numbers)} phòng).",
            request=request
        )

        return Response({
            'success': True,
            'message': f"Đã gửi yêu cầu kiểm tra {len(room_numbers)} phòng cho bộ phận Buồng phòng thành công!",
            'requested_rooms': room_numbers,
            'group_booking': GroupBookingSerializer(group, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='rooming-list')
    def update_rooming_list(self, request, pk=None):
        """
        API POST /api/group-bookings/<id>/rooming-list/
        Cập nhật danh sách khách lưu trú (Rooming List) cho từng phòng trong đoàn.
        Payload:
        {
          "rooms": [
            {
              "booking_id": 12,
              "room_id": 105, # optional (gán đổi số phòng)
              "guests": [
                { "full_name": "Nguyễn Văn A", "id_number": "001201...", "id_type": "CCCD", "is_primary": true },
                { "full_name": "Trần Thị B", "id_number": "001202...", "id_type": "CCCD", "is_primary": false }
              ]
            }
          ]
        }
        """
        group = self.get_object()
        user = request.user

        if not (user.is_superuser or check_role_permission(user, 'bookings', 'update')):
            return Response({'success': False, 'message': 'Bạn không có quyền cập nhật danh sách lưu trú (Rooming List).'}, status=status.HTTP_403_FORBIDDEN)

        rooms_data = request.data.get('rooms', [])

        if not isinstance(rooms_data, list):
            return Response({'success': False, 'message': 'Dữ liệu rooms phải là một mảng.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            updated_count = 0
            for r_item in rooms_data:
                b_id = r_item.get('booking_id')
                sub_b = group.sub_bookings.filter(pk=b_id).first()
                if not sub_b:
                    continue

                # Cập nhật phòng vật lý nếu có
                new_room_id = r_item.get('room_id')
                if new_room_id:
                    rm = Room.objects.filter(pk=new_room_id).first()
                    if rm:
                        sub_b.room = rm
                        sub_b.save(update_fields=['room'])

                # Cập nhật trực tiếp CCCD của phòng nếu có gửi kèm
                direct_id_number = (r_item.get('identity_card') or r_item.get('id_number') or '').strip()
                booking_update_fields = []
                if direct_id_number:
                    sub_b.identity_card = direct_id_number
                    booking_update_fields.append('identity_card')

                # Cập nhật danh sách khách lưu trú chi tiết (BookingGuest)
                guests_list = r_item.get('guests', [])
                if isinstance(guests_list, list) and len(guests_list) > 0:
                    cat = sub_b.category or (sub_b.room.category if sub_b.room else None)
                    room_cap = cat.capacity if (cat and cat.capacity) else 2
                    valid_guests = [g for g in guests_list if (g.get('full_name') or '').strip()]
                    if len(valid_guests) > room_cap:
                        return Response({
                            'success': False,
                            'message': f"Phòng #{sub_b.booking_code} ({sub_b.room_name or 'Phòng'}) chỉ có sức chứa tối đa {room_cap} người lớn. Bạn đang khai báo {len(valid_guests)} khách vượt quá sức chứa cho phép!"
                        }, status=status.HTTP_400_BAD_REQUEST)

                    BookingGuest.objects.filter(booking=sub_b).delete()
                    to_create = []
                    for g in guests_list:
                        fn = (g.get('full_name') or '').strip()
                        if not fn:
                            continue

                        # Parse ngày sinh an toàn hỗ trợ các định dạng phổ biến
                        dob_raw = g.get('date_of_birth')
                        dob_val = None
                        if dob_raw:
                            dob_str = str(dob_raw).strip()[:10]
                            for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y'):
                                try:
                                    dob_val = datetime.strptime(dob_str, fmt).date()
                                    break
                                except ValueError:
                                    pass

                        to_create.append(BookingGuest(
                            booking=sub_b,
                            full_name=fn,
                            id_type=g.get('id_type', 'CCCD'),
                            id_number=(g.get('id_number') or g.get('identity_card') or '').strip() or None,
                            date_of_birth=dob_val,
                            gender=(g.get('gender') or '').strip() or None,
                            nationality=(g.get('nationality') or '').strip() or 'Việt Nam',
                            is_primary=bool(g.get('is_primary', False))
                        ))
                    if to_create:
                        BookingGuest.objects.bulk_create(to_create)
                        primary_guest = next((g for g in to_create if g.is_primary), to_create[0])
                        if primary_guest and primary_guest.id_number:
                            sub_b.identity_card = primary_guest.id_number
                            booking_update_fields.append('identity_card')

                if booking_update_fields:
                    sub_b.save(update_fields=list(set(booking_update_fields)))

                updated_count += 1

        return Response({
            'success': True,
            'message': f'Cập nhật Rooming List thành công cho {updated_count} phòng!',
            'group_booking': GroupBookingSerializer(group, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='confirm-deposit')
    def confirm_deposit(self, request, pk=None):
        """
        Xác nhận đã nhận tiền cọc của đoàn -> chuyển trạng thái đoàn sang 'confirmed'.
        """
        group = self.get_object()
        user = request.user

        if not (user.is_superuser or check_role_permission(user, 'bookings', 'update') or check_role_permission(user, 'finance', 'create')):
            return Response({'success': False, 'message': 'Bạn không có quyền xác nhận tiền cọc đoàn.'}, status=status.HTTP_403_FORBIDDEN)

        group.is_deposit_paid = True
        if group.status == 'tentative':
            group.status = 'confirmed'
        group.save(update_fields=['is_deposit_paid', 'status'])

        # Cập nhật Payment cọc
        payment = Payment.objects.filter(group_booking=group, payment_status='PENDING').first()
        if payment:
            payment.payment_status = 'COMPLETED'
            payment.save(update_fields=['payment_status'])

        # Cập nhật trạng thái các đơn con
        group.sub_bookings.filter(status='pending').update(status='confirmed')
        sub_booking_ids = list(group.sub_bookings.values_list('id', flat=True))

        # Nếu số tiền thanh toán bằng hoặc lớn hơn tổng tiền (thanh toán 100%), đánh dấu hóa đơn & dịch vụ là đã thanh toán
        if group.deposit_amount and group.total_amount and group.deposit_amount >= group.total_amount:
            Invoice.objects.filter(group_booking=group).update(status='paid')
            ServiceRequest.objects.filter(booking_id__in=sub_booking_ids).update(is_paid=True)
            BookingExtraService.objects.filter(booking_id__in=sub_booking_ids).update(is_paid=True)

        # Gửi email HTML 5 sao xác nhận nhận tiền cọc đoàn thành công
        try:
            send_group_booking_email_async(
                group_booking=group,
                email_type='payment_success'
            )
        except Exception:
            pass

        # Gửi thông báo In-App xác nhận tiền cọc đoàn
        try:
            send_group_booking_notification(
                group_booking=group,
                event_type='deposit_confirmed',
                actor=user
            )
        except Exception:
            pass

        return Response({
            'success': True,
            'message': f'Xác nhận tiền cọc thành công cho đoàn #{group.group_code}!',
            'group_booking': GroupBookingSerializer(group, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='resend-email')
    def resend_email(self, request, pk=None):
        """
        API POST /api/group-bookings/<id>/resend-email/
        Cho phép Lễ tân / Quản trị viên gửi lại Email xác nhận đoàn thủ công về email Trưởng đoàn / Công ty.
        """
        group = self.get_object()
        user = request.user

        can_resend = (
            user.is_superuser or
            getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'owner', 'staff'] or
            check_role_permission(user, 'bookings', 'read') or
            check_role_permission(user, 'bookings', 'update')
        )
        if not can_resend:
            return Response({'success': False, 'message': 'Bạn không có quyền thực hiện gửi lại email đoàn.'}, status=status.HTTP_403_FORBIDDEN)

        custom_email = (request.data.get('email') or '').strip()
        recipient_target = custom_email or (group.leader_email.strip() if group.leader_email else None)
        if not recipient_target and hasattr(group, 'master_invoice') and group.master_invoice and group.master_invoice.invoice_recipient_email:
            recipient_target = group.master_invoice.invoice_recipient_email.strip()
        if not recipient_target and group.corporate_partner and group.corporate_partner.contact_email:
            recipient_target = group.corporate_partner.contact_email.strip()

        if not recipient_target:
            return Response({
                'success': False,
                'message': 'Đơn đoàn này chưa có địa chỉ email người nhận. Vui lòng cung cấp email trong request.'
            }, status=status.HTTP_400_BAD_REQUEST)

        email_type = 'payment_success' if group.is_deposit_paid else 'group_confirmation'
        send_group_booking_email_async(
            group_booking=group,
            email_type=email_type,
            recipient_email=recipient_target
        )

        log_action(user, 'SEND_EMAIL', 'BOOKING', f"Gửi lại email xác nhận cho Đơn Đoàn #{group.group_code} tới {recipient_target}", request=request)

        return Response({
            'success': True,
            'message': f"Đã kích hoạt gửi email xác nhận Đơn Đoàn #{group.group_code} tới {recipient_target}!"
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch', 'post'], url_path='billing-type')
    def update_billing_type(self, request, pk=None):
        """
        API POST/PATCH /api/bookings/groups/<id>/billing-type/
        Cập nhật Chính sách thanh toán chi phí phát sinh: ROOM_ONLY hoặc ALL_INCLUSIVE.
        """
        group = self.get_object()
        user = request.user

        if not (user.is_superuser or check_role_permission(user, 'bookings', 'update')):
            return Response({'success': False, 'message': 'Bạn không có quyền thay đổi chính sách thanh toán đoàn.'}, status=status.HTTP_403_FORBIDDEN)

        new_billing_type = str(request.data.get('billing_type') or '').strip().upper()
        if new_billing_type not in ['ROOM_ONLY', 'ALL_INCLUSIVE']:
            return Response({'success': False, 'message': 'Chính sách thanh toán không hợp lệ (Chỉ chấp nhận ROOM_ONLY hoặc ALL_INCLUSIVE).'}, status=status.HTTP_400_BAD_REQUEST)
        
        group.billing_type = new_billing_type
        group.save(update_fields=['billing_type'])

        msg = 'Công ty chi trả toàn bộ (Tiền phòng + Dịch vụ phát sinh)' if new_billing_type == 'ALL_INCLUSIVE' else 'Công ty chỉ trả tiền phòng (Khách tự trả dịch vụ phát sinh)'
        log_action(request.user if request.user.is_authenticated else None, 'UPDATE', 'BOOKING', f"Cập nhật chính sách thanh toán đoàn #{group.group_code}: {msg}", request=request)

        return Response({
            'success': True,
            'message': f'Đã cập nhật chính sách thanh toán đoàn sang: {msg}',
            'group_booking': GroupBookingSerializer(group, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='cancel', permission_classes=[AllowAny])
    def cancel_group(self, request, pk=None):
        """
        API POST /api/bookings/groups/<id>/cancel/
        Hủy toàn bộ đơn đặt đoàn Master và đồng bộ hủy toàn bộ các phòng con (sub_bookings) thuộc đoàn.
        Quyền hạn:
        - Admin / Lễ tân: Được phép hủy mọi đoàn.
        - Khách hàng (Trưởng đoàn / HR): Được phép hủy đoàn của mình trước giờ nhận phòng.
        - Khách vãng lai: Phải xác thực số điện thoại hoặc email người liên hệ của đoàn.
        """
        try:
            if str(pk).isdigit():
                group = GroupBooking.objects.prefetch_related('sub_bookings', 'sub_bookings__room').get(id=int(pk))
            else:
                group = GroupBooking.objects.prefetch_related('sub_bookings', 'sub_bookings__room').get(group_code=str(pk))
        except GroupBooking.DoesNotExist:
            return Response({'success': False, 'message': 'Không tìm thấy đơn đặt đoàn.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        is_authenticated = user and user.is_authenticated
        is_staff_or_admin = is_authenticated and (
            user.is_superuser or 
            check_role_permission(user, 'bookings', 'update') or 
            getattr(user, 'role', '') in ['admin', 'staff', 'manager', 'receptionist']
        )

        # Phân quyền bảo mật chống IDOR:
        if not is_staff_or_admin:
            if is_authenticated:
                is_leader = (
                    (user.phone_number and user.phone_number == group.leader_phone) or
                    (user.email and user.email == group.leader_email) or
                    (group.corporate_partner and group.corporate_partner.contact_email == user.email) or
                    group.sub_bookings.filter(guest=user).exists()
                )
                if not is_leader:
                    return Response({
                        'success': False,
                        'message': 'Bạn không có quyền hủy đơn đặt đoàn này.'
                    }, status=status.HTTP_403_FORBIDDEN)
            else:
                # Khách chưa đăng nhập: Phải xác thực phone hoặc email
                provided_phone = str(request.data.get('leader_phone') or request.data.get('phone', '')).strip()
                provided_email = str(request.data.get('leader_email') or request.data.get('email', '')).strip().lower()
                clean_phone = ''.join(c for c in provided_phone if c.isdigit())
                group_clean_phone = ''.join(c for c in str(group.leader_phone) if c.isdigit())

                phone_match = clean_phone and clean_phone == group_clean_phone
                email_match = provided_email and provided_email == str(group.leader_email or '').lower()

                if not (phone_match or email_match):
                    return Response({
                        'success': False,
                        'message': 'Xác thực không thành công. Vui lòng cung cấp đúng Số điện thoại hoặc Email người liên hệ của đoàn.'
                    }, status=status.HTTP_403_FORBIDDEN)

        # Chặn hủy khi đoàn hoặc bất kỳ phòng nào trong đoàn đang lưu trú (In-house)
        if group.status == 'checked_in' or group.sub_bookings.filter(status='checked_in').exists():
            return Response({
                'success': False,
                'message': 'Đoàn đang lưu trú tại khách sạn (In-house), không thể hủy. Vui lòng thực hiện thủ tục Check-out & Quyết toán (kể cả trường hợp khách trả phòng sớm).'
            }, status=status.HTTP_400_BAD_REQUEST)

        if group.status in ['completed', 'checked_out']:
            return Response({
                'success': False,
                'message': f'Đơn đoàn đã ở trạng thái "{group.get_status_display()}", không thể hủy.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if group.status == 'cancelled':
            return Response({
                'success': False,
                'message': 'Đơn đặt đoàn này đã được hủy trước đó.'
            }, status=status.HTTP_400_BAD_REQUEST)

        reason = str(request.data.get('reason', 'Khách hàng / Quản lý yêu cầu hủy đoàn')).strip()
        now_str = timezone.now().strftime('%d/%m/%Y %H:%M')
        acting_name = user.get_full_name() or user.username if is_authenticated else f"Trưởng đoàn ({group.leader_name})"

        with transaction.atomic():
            group.status = 'cancelled'
            group.note = f"{group.note or ''}\n[Hủy toàn bộ đoàn bởi {acting_name} lúc {now_str}]: {reason}".strip()
            group.save(update_fields=['status', 'note', 'updated_at'])

            sub_bookings = list(group.sub_bookings.all())
            cancelled_rooms_count = 0
            for sub in sub_bookings:
                if sub.status not in ['completed', 'checked_out', 'cancelled']:
                    if sub.room and sub.room.status == 'occupied':
                        sub.room.status = 'available'
                        sub.room.save(update_fields=['status'])
                    sub.status = 'cancelled'
                    sub.note = f"{sub.note or ''}\n[Hủy đồng loạt theo đoàn #{group.group_code} lúc {now_str}]: {reason}".strip()
                    sub.save(update_fields=['status', 'note', 'updated_at'])
                    cancelled_rooms_count += 1

            # Hủy các ServiceRequest đang chờ của các phòng con
            sub_booking_ids = [s.id for s in sub_bookings]
            ServiceRequest.objects.filter(booking_id__in=sub_booking_ids, status__in=['pending', 'in_progress']).update(
                status='cancelled'
            )

            # Hủy Master Invoice nếu chưa thanh toán hoặc đánh dấu hủy
            master_inv = getattr(group, 'master_invoice', None) or Invoice.objects.filter(group_booking=group).first()
            if master_inv and master_inv.status == 'pending':
                master_inv.status = 'cancelled'
                master_inv.save(update_fields=['status'])

            # Log audit
            log_action(
                user=user if is_authenticated else None,
                action='DELETE',
                module='BOOKING',
                description=f"Hủy toàn bộ đơn đoàn #{group.group_code} ({cancelled_rooms_count} phòng). Lý do: {reason}",
                request=request
            )

        return Response({
            'success': True,
            'message': f'Đã hủy toàn bộ đoàn #{group.group_code} và {cancelled_rooms_count} phòng con thành công.',
            'group_booking': GroupBookingSerializer(group, context={'request': request}).data
        }, status=status.HTTP_200_OK)

