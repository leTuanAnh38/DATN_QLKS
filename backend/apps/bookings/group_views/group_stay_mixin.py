"""Mixin: check-in/out cả đoàn, kiểm tra phòng đoàn, cập nhật rooming list."""
from datetime import datetime
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import action

from ..models import BookingGuest, BookingExtraService
from ...services.models import ServiceRequest
from ...rooms.models import Room, MinibarCheck
from ...users.models import User, log_action
from ...users.views import check_role_permission
from ...payments.models import Invoice, Payment
from ..serializers import GroupBookingSerializer
from ...notifications.services import send_group_booking_notification


class GroupBookingStayMixin:
    """Mixin: check-in/out cả đoàn, kiểm tra phòng đoàn, cập nhật rooming list."""


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
            # Cập nhật hoặc tạo Master Invoice thanh toán toàn bộ cho đoàn
            from ...payments.models import Invoice, Payment, CashierShift
            payment_method = request.data.get('payment_method', 'transfer')
            method_code = 'TRANSFER' if str(payment_method).lower() in ['bank_transfer', 'momo', 'transfer', 'vietqr', 'credit_card'] else 'CASH'
            
            # Nếu công ty chi trả toàn bộ (ALL_INCLUSIVE):
            # Tự động quét và gom toàn bộ phụ phí dịch vụ phát sinh chưa thanh toán của tất cả phòng con vào hóa đơn đoàn
            unpaid_incidental_services = 0.0
            sub_ids = list(group.sub_bookings.values_list('id', flat=True))
            unpaid_bes = None
            if getattr(group, 'billing_type', 'ROOM_ONLY') == 'ALL_INCLUSIVE':
                unpaid_bes = BookingExtraService.objects.filter(booking_id__in=sub_ids, is_paid=False)
                unpaid_incidental_services = float(sum((b.price or 0) * (b.quantity or 1) for b in unpaid_bes))

            # Tính toán chính xác số tiền đã thanh toán (Cọc + các đợt thanh toán trước)
            completed_payments = Payment.objects.filter(group_booking=group, payment_status='COMPLETED')
            total_paid = float(sum(p.amount for p in completed_payments)) if completed_payments.exists() else 0.0
            if total_paid <= 0 and group.is_deposit_paid:
                total_paid = float(group.deposit_amount or 0)

            total_contract = float(group.total_amount or 0) + unpaid_incidental_services
            remaining_balance = max(0.0, total_contract - total_paid)

            corp = group.corporate_partner
            payment_terms_days = getattr(corp, 'payment_terms_days', 0) if corp else 0
            has_credit_terms = bool(payment_terms_days > 0)
            confirm_settle = bool(
                request.data.get('confirm_settle', False) or 
                request.data.get('mark_invoice_paid', False)
            )

            # Chốt chặn tài chính (Financial Guardrail):
            # Nếu còn công nợ chưa thanh toán VÀ đối tác không có hạn mức công nợ trả sau (payment_terms_days == 0):
            # Bắt buộc phải có xác nhận thanh toán nốt phần nợ. Nếu không, chặn Check-out!
            if remaining_balance > 0 and not has_credit_terms and not confirm_settle:
                return Response({
                    'success': False,
                    'code': 'UNSETTLED_GROUP_DEBT',
                    'message': f"Chốt chặn tài chính: Đoàn #{group.group_code} vẫn còn công nợ chưa thanh toán ({remaining_balance:,.0f} VND). Doanh nghiệp không có hạn mức công nợ trả sau. Vui lòng quyết toán trước khi hoàn tất Check-out!",
                    'remaining_balance': remaining_balance
                }, status=status.HTTP_400_BAD_REQUEST)

            checked_out_count = 0
            for b in sub_bookings:
                if b.room:
                    has_active_maintenance = b.room.maintenance_tickets.filter(status='fixing').exists()
                    b.room.status = 'maintenance' if has_active_maintenance else 'cleaning'
                    b.room.save(update_fields=['status'])

                b.status = 'completed'
                b.actual_check_out = now
                b.save(update_fields=['status', 'actual_check_out'])
                checked_out_count += 1

            group.status = 'completed'
            group.save(update_fields=['status'])

            # Đánh dấu các dịch vụ này là đã thanh toán theo hóa đơn đoàn
            if unpaid_bes:
                unpaid_bes.update(is_paid=True)
                ServiceRequest.objects.filter(booking_id__in=sub_ids, is_paid=False).update(is_paid=True)

            master_inv = getattr(group, 'master_invoice', None)
            if not master_inv:
                master_inv = Invoice.objects.filter(group_booking=group).first()

            is_company_invoice = bool(request.data.get('is_company_invoice', True))
            comp_name = request.data.get('company_name') or (corp.company_name if corp else group.group_name)
            tax_code = request.data.get('company_tax_code') or (corp.tax_code if corp else '')
            addr = request.data.get('company_address') or (corp.company_address if corp else '')
            email = request.data.get('invoice_recipient_email') or (corp.contact_email if corp else group.leader_email)

            # Nếu có bảo lãnh công nợ trả sau B2B và chưa thanh toán: hóa đơn để pending
            is_settled = bool(remaining_balance <= 0 or confirm_settle)
            inv_status = 'paid' if is_settled else 'pending'
            inv_paid_at = now if is_settled else None

            if not master_inv:
                master_inv = Invoice.objects.create(
                    group_booking=group,
                    room_charge=float(group.total_amount or 0),
                    service_charge=unpaid_incidental_services,
                    total_amount=total_contract,
                    status=inv_status,
                    payment_method=payment_method,
                    paid_at=inv_paid_at,
                    is_company_invoice=is_company_invoice,
                    company_name=comp_name,
                    company_tax_code=tax_code,
                    company_address=addr,
                    invoice_recipient_email=email
                )
            else:
                master_inv.service_charge = float(master_inv.service_charge or 0) + unpaid_incidental_services
                master_inv.total_amount = total_contract
                master_inv.status = inv_status
                master_inv.paid_at = inv_paid_at
                master_inv.payment_method = payment_method
                if is_company_invoice:
                    master_inv.is_company_invoice = True
                    master_inv.company_name = comp_name
                    master_inv.company_tax_code = tax_code
                    master_inv.company_address = addr
                    master_inv.invoice_recipient_email = email
                master_inv.save()

            # Lấy ca thu ngân hiện tại để liên kết giao dịch thanh toán
            active_shift = CashierShift.objects.filter(user=user, status='OPEN').first()
            if not active_shift:
                active_shift = CashierShift.objects.filter(status='OPEN').order_by('-opened_at').first()

            # Ghi nhận Payment cho số tiền còn lại (nếu có thanh toán)
            if remaining_balance > 0 and confirm_settle:
                Payment.objects.create(
                    group_booking=group,
                    amount=remaining_balance,
                    payment_method=method_code,
                    payment_status='COMPLETED',
                    shift=active_shift,
                    transaction_id=f"TXN-GRP-CO-{master_inv.invoice_code.replace('INV-', '')}"
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
            from ...notifications.models import Notification
            recipients = User.objects.filter(
                Q(role__in=['housekeeper', 'manager', 'admin', 'receptionist']) | Q(is_superuser=True)
            ).distinct()
            rooms_str = ", ".join(room_numbers) if room_numbers else "các phòng"
            notif_title = f"[KIỂM PHÒNG ĐOÀN] Đoàn #{group.group_code} chuẩn bị Check-out ({len(room_numbers)} phòng)"
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
