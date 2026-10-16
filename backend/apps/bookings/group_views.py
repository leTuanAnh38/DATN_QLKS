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

from .models import GroupBooking, CorporatePartner, Booking, BookingGuest
from ..rooms.models import Room, RoomCategory
from ..users.models import User, GuestProfile, log_action
from ..users.views import check_role_permission
from ..payments.models import Invoice, Payment
from .serializers import GroupBookingSerializer, CorporatePartnerSerializer, BookingSerializer
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
        # Cho phép tạo đơn đoàn công khai từ Web Client
        if self.action in ['create']:
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

        # 3. Tạo User đại diện cho đoàn
        clean_phone = ''.join(c for c in str(leader_phone) if c.isdigit())
        leader_user = User.objects.filter(phone_number=leader_phone).first()
        if not leader_user and clean_phone:
            leader_user = User.objects.filter(phone_number=clean_phone).first()
        if not leader_user and leader_email:
            leader_user = User.objects.filter(email=leader_email).first()

        if not leader_user:
            base_username = f"group_{clean_phone[-6:]}" if len(clean_phone) >= 6 else f"group_{uuid.uuid4().hex[:6]}"
            username = base_username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}_{counter}"
                counter += 1

            name_parts = leader_name.split()
            first_name = ' '.join(name_parts[:-1]) if len(name_parts) > 1 else leader_name
            last_name = name_parts[-1] if len(name_parts) > 1 else ''
            email_to_use = leader_email or f"{username}@group.hotel.local"

            leader_user = User.objects.create_user(
                username=username,
                email=email_to_use,
                phone_number=leader_phone,
                first_name=first_name,
                last_name=last_name,
                role='guest'
            )

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

            # Phân tách danh sách khách lưu trú (Rooming List) gửi lên theo từng hạng phòng (nếu có)
            rooming_list = data.get('rooming_list', [])
            rooming_by_cat = {}
            if isinstance(rooming_list, list):
                for item in rooming_list:
                    c_id = item.get('category_id')
                    try:
                        c_id = int(c_id)
                    except (ValueError, TypeError):
                        pass
                    if c_id not in rooming_by_cat:
                        rooming_by_cat[c_id] = []
                    rooming_by_cat[c_id].append(item.get('guests', []))

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
                    
                    # Lấy danh sách khách đã khai báo trước cho phòng này (nếu có)
                    declared_guests = []
                    if cat_id in rooming_by_cat and len(rooming_by_cat[cat_id]) > 0:
                        declared_guests = rooming_by_cat[cat_id].pop(0)

                    sub_bookings_to_create.append({
                        'category': category_obj,
                        'room': assigned_room,
                        'total_amount': net_price_per_room,
                        'membership_discount': corp_discount_per_room,
                        'guests': declared_guests
                    })
                    total_group_amount += net_price_per_room
                    total_rooms_count += 1

            if total_rooms_count == 0:
                return Response({'success': False, 'message': 'Vui lòng chọn số lượng phòng hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

            # Tính tiền đặt cọc quy định (mặc định 50% hoặc theo yêu cầu)
            input_deposit = data.get('deposit_amount')
            if input_deposit is not None and str(input_deposit).isdigit() and int(input_deposit) >= 0:
                deposit_amount = Decimal(str(input_deposit))
            else:
                deposit_amount = total_group_amount * Decimal('0.5') # 50% tổng đơn đoàn

            is_deposit_paid = bool(data.get('is_deposit_paid', False))
            deposit_payment_method = str(data.get('deposit_payment_method') or 'TRANSFER').upper()
            if deposit_payment_method not in ['TRANSFER', 'CASH', 'POS', 'CREDIT']:
                deposit_payment_method = 'TRANSFER'

            initial_group_status = 'confirmed' if is_deposit_paid else 'tentative'

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
                status=initial_group_status,
                note=note,
                internal_note=internal_note
            )

            # 6. Tạo các đơn phòng con (Sub-Bookings)
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

                if valid_guests:
                    # Lưu danh sách khách do người đặt phòng đã khai báo
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
                    # Mặc định tạo 1 đại diện lưu trú theo Trưởng đoàn
                    BookingGuest.objects.create(
                        booking=single_booking,
                        full_name=f"{leader_name} (Thành viên đoàn)",
                        id_type='CCCD',
                        id_number=identity_card or None,
                        is_primary=True
                    )

                created_sub_bookings.append(single_booking)

            # 7. Tạo Master Invoice cho toàn đoàn
            Invoice.objects.create(
                group_booking=group_booking,
                booking=None,
                room_charge=total_group_amount,
                service_charge=Decimal('0'),
                discount=Decimal(str(total_group_amount * (corporate_discount_percent / Decimal('100')))) if corporate_discount_percent > 0 else Decimal('0'),
                tax=Decimal('0'),
                total_amount=total_group_amount,
                status='pending',
                is_company_invoice=is_company_invoice,
                company_name=company_name or None,
                company_tax_code=company_tax_code or None,
                company_address=company_address or None,
                invoice_recipient_email=invoice_recipient_email or None
            )

            # 8. Tạo bản ghi Payment đặt cọc (phục vụ thanh toán VietQR / Tiền mặt / POS)
            payment_amount = deposit_amount if deposit_amount > 0 else total_group_amount
            Payment.objects.create(
                group_booking=group_booking,
                booking=None,
                amount=payment_amount,
                payment_method=deposit_payment_method,
                payment_status='COMPLETED' if is_deposit_paid else 'PENDING',
                transaction_id=f"TXN-{group_booking.group_code}",
                paid_at=timezone.now() if is_deposit_paid else None
            )

        log_action(
            request.user if request.user.is_authenticated else None,
            'CREATE',
            'BOOKING',
            f"Tạo Đơn Đặt Đoàn #{group_booking.group_code} ({group_name} - {total_rooms_count} phòng).",
            request=request
        )

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

        if not (user.is_superuser or check_role_permission(user, 'bookings', 'update')):
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
                b.is_paid = True
                b.actual_check_out = now
                b.save(update_fields=['status', 'is_paid', 'actual_check_out'])
                checked_out_count += 1

            group.status = 'completed'
            group.save(update_fields=['status'])

            # Cập nhật hoặc tạo Master Invoice thanh toán toàn bộ cho đoàn
            from ..payments.models import Invoice, Payment
            payment_method = request.data.get('payment_method', 'transfer')
            method_code = 'TRANSFER' if str(payment_method).lower() in ['bank_transfer', 'momo', 'transfer', 'vietqr', 'credit_card'] else 'CASH'
            
            deposit_paid = float(group.deposit_amount or 0) if group.is_deposit_paid else 0.0
            total_contract = float(group.total_amount or 0)
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
                    room_charge=total_contract,
                    service_charge=0,
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

        return Response({
            'success': True,
            'message': f'Hoàn tất Check-out cho đoàn #{group.group_code}!',
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

        return Response({
            'success': True,
            'message': f'Xác nhận tiền cọc thành công cho đoàn #{group.group_code}!',
            'group_booking': GroupBookingSerializer(group, context={'request': request}).data
        }, status=status.HTTP_200_OK)
