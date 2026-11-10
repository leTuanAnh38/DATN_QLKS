"""Thanh toán: xác nhận, danh sách, chi tiết, cấu hình, trạng thái."""
import re
from decimal import Decimal
from django.db import models, transaction
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from ...bookings.models import Booking, GroupBooking
from ...bookings.email_service import send_booking_email_async, send_group_booking_email_async
from ...users.models import log_action
from ...users.views import check_role_permission
from ..models import Payment, Invoice, PaymentConfig, CashierShift
from ..serializers import PaymentSerializer, PaymentListSerializer, PaymentConfigSerializer
from .permissions import IsAdminOrOwnerUser


class ConfirmPaymentView(APIView):
    """
    API endpoint: POST /api/payments/confirm/
    Xác nhận thanh toán cho đơn đặt phòng lẻ hoặc đơn đoàn bởi Thu ngân / Lễ tân / Quản lý:
    Payload:
    - booking_id: ID hoặc booking_code của đơn đặt phòng
    - amount: Số tiền thanh toán (bắt buộc phải khớp với total_amount hoặc remaining_balance)
    - payment_method: Phương thức (mặc định 'TRANSFER')
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        can_confirm = (
            user.is_superuser or
            getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'cashier', 'owner'] or
            check_role_permission(user, 'finance', 'update') or
            check_role_permission(user, 'finance', 'create')
        )
        if not can_confirm:
            return Response({
                'success': False,
                'message': 'Bạn không có quyền xác nhận thu tiền (Yêu cầu vai trò Thu ngân / Lễ tân / Quản lý).'
            }, status=status.HTTP_403_FORBIDDEN)

        booking_id = request.data.get('booking_id')
        amount = request.data.get('amount')
        payment_method = request.data.get('payment_method', 'TRANSFER')

        # 1. Kiểm tra đầu vào bắt buộc
        if not booking_id:
            return Response(
                {
                    "success": False,
                    "message": "Vui lòng cung cấp booking_id."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if amount is None:
            return Response(
                {
                    "success": False,
                    "message": "Vui lòng cung cấp số tiền thanh toán (amount)."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Lấy Booking hoặc GroupBooking theo ID / Code
        from ...bookings.models import GroupBooking
        booking = None
        group_booking = None

        if str(booking_id).upper().startswith('GRP-'):
            group_booking = GroupBooking.objects.filter(group_code__iexact=str(booking_id).strip()).first()

        if not group_booking:
            try:
                if isinstance(booking_id, int) or (isinstance(booking_id, str) and booking_id.isdigit()):
                    booking = Booking.objects.get(id=int(booking_id))
                else:
                    booking = Booking.objects.get(booking_code=str(booking_id))
            except Booking.DoesNotExist:
                group_booking = GroupBooking.objects.filter(group_code__iexact=str(booking_id).strip()).first()

        if not booking and not group_booking:
            return Response(
                {
                    "success": False,
                    "message": f"Không tìm thấy đơn đặt phòng hoặc đơn đoàn với mã '{booking_id}'."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if group_booking:
            try:
                amount_dec = Decimal(str(amount))
            except (ValueError, TypeError):
                amount_dec = group_booking.deposit_amount or group_booking.total_amount

            with transaction.atomic():
                group_booking = GroupBooking.objects.select_for_update().get(pk=group_booking.pk)
                payment, _ = Payment.objects.update_or_create(
                    group_booking=group_booking,
                    defaults={
                        'amount': amount_dec,
                        'payment_method': payment_method or 'TRANSFER',
                        'payment_status': 'COMPLETED'
                    }
                )
                group_booking.is_deposit_paid = True
                if group_booking.status == 'tentative':
                    group_booking.status = 'confirmed'
                group_booking.save(update_fields=['is_deposit_paid', 'status'])

                if hasattr(group_booking, 'master_invoice') and group_booking.master_invoice:
                    inv = group_booking.master_invoice
                    inv.status = 'paid'
                    inv.paid_at = timezone.now()
                    inv.save()

                for sub_b in group_booking.sub_bookings.all():
                    if sub_b.status in ['pending', 'unconfirmed']:
                        sub_b.status = 'confirmed'
                        sub_b.save(update_fields=['status'])
                    sub_b.service_requests.filter(is_paid=False).update(is_paid=True)
                    sub_b.extra_services.filter(is_paid=False).update(is_paid=True)

            log_action(
                user=request.user if request.user.is_authenticated else None,
                action='CREATE',
                module='INVOICE',
                description=f"Xác nhận thanh toán {amount_dec:,.0f} VND cho Đơn Đoàn #{group_booking.group_code}",
                request=request
            )
            serializer = PaymentSerializer(payment)
            return Response({
                "success": True,
                "message": f"Xác nhận thanh toán cho Đơn Đoàn #{group_booking.group_code} thành công!",
                "data": serializer.data
            }, status=status.HTTP_200_OK)

        # 3. Tính toán chi phí lưu trú và số tiền còn lại cần thanh toán
        try:
            amount_dec = Decimal(str(amount))
        except (ValueError, TypeError):
            return Response(
                {
                    "success": False,
                    "message": "Số tiền truyền lên không đúng định dạng số hợp lệ."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if amount_dec <= Decimal('0'):
            return Response(
                {
                    "success": False,
                    "message": "Số tiền thanh toán phải lớn hơn 0 VND."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Tính toán tiền phòng chuẩn xác (pure_room_charge)
        check_in = booking.check_in_date
        check_out = booking.check_out_date
        nights = max(1, (check_out - check_in).days) if (check_in and check_out) else 1

        daily_rate = Decimal('0')
        if booking.category and booking.category.base_price:
            daily_rate = Decimal(str(booking.category.promo_price or booking.category.base_price))
        elif booking.room and booking.room.category and booking.room.category.base_price:
            daily_rate = Decimal(str(booking.room.category.promo_price or booking.room.category.base_price))

        room_subtotal = daily_rate * Decimal(str(nights))
        mem_discount = Decimal(str(booking.membership_discount or 0))

        promo_discount = Decimal('0')
        if booking.applied_promotion:
            if booking.applied_promotion.discount_type == 'percentage':
                calc_promo = (room_subtotal * Decimal(str(booking.applied_promotion.discount_value))) / Decimal('100')
                if getattr(booking.applied_promotion, 'max_discount_amount', None):
                    calc_promo = min(calc_promo, Decimal(str(booking.applied_promotion.max_discount_amount)))
                promo_discount = calc_promo
            else:
                promo_discount = min(room_subtotal, Decimal(str(booking.applied_promotion.discount_value)))
        elif getattr(booking, 'promotion_discount', None):
            promo_discount = Decimal(str(booking.promotion_discount))

        # Tiền phòng thuần (pure_room_charge)
        if hasattr(booking, 'invoice') and booking.invoice and booking.invoice.room_charge is not None and Decimal(str(booking.invoice.room_charge)) > Decimal('0'):
            pure_room_charge = Decimal(str(booking.invoice.room_charge))
            actual_promo = max(Decimal('0'), room_subtotal - pure_room_charge - mem_discount)
            if actual_promo > Decimal('0'):
                promo_discount = actual_promo
        elif daily_rate > Decimal('0') and nights > 0:
            pure_room_charge = max(Decimal('0'), room_subtotal - mem_discount - promo_discount)
        elif booking.total_amount:
            all_services_total = sum(Decimal(str(r.total_price or 0)) for r in booking.service_requests.exclude(status='cancelled'))
            pure_room_charge = max(Decimal('0'), Decimal(str(booking.total_amount)) - all_services_total)
        else:
            pure_room_charge = max(Decimal('0'), room_subtotal - mem_discount - promo_discount)

        room_charge = pure_room_charge

        # Tính toán tiền dịch vụ phát sinh & đặt trước
        valid_requests = booking.service_requests.exclude(status='cancelled').select_related('service')
        service_charge = Decimal(str(sum(
            (req.total_price or ((req.service.price if req.service else 0) * req.quantity))
            for req in valid_requests
        )))

        for bes in booking.extra_services.all():
            raw_name = (bes.service_name or '').strip()
            if not re.search(r'\[Yêu cầu #\d+\]', raw_name, re.IGNORECASE):
                clean_name = re.sub(r'\[.*?\]', '', raw_name).strip()
                if not any((r.service.name if r.service else '').strip().lower() == clean_name.lower() for r in valid_requests):
                    service_charge += Decimal(str((bes.price or 0) * (bes.quantity or 1)))

        grand_total = pure_room_charge + service_charge

        # Số tiền đã thanh toán trước đó (COMPLETED payments)
        paid_amount = Decimal('0')
        if hasattr(booking, 'payments'):
            completed_payments = booking.payments.filter(payment_status='COMPLETED')
            if completed_payments.exists():
                paid_amount = sum(Decimal(str(p.amount)) for p in completed_payments)
        if paid_amount <= Decimal('0'):
            if booking.status in ['paid', 'PAID'] or (hasattr(booking, 'invoice') and booking.invoice and booking.invoice.status == 'paid'):
                paid_amount = Decimal(str(booking.total_amount or pure_room_charge))
            elif booking.note and ('vietqr: đã thanh toán' in booking.note.lower() or 'đã thanh toán thành công' in booking.note.lower()):
                paid_amount = Decimal(str(booking.total_amount or pure_room_charge))

        remaining_balance = max(Decimal('0'), grand_total - paid_amount)

        # Kiểm tra vai trò theo ma trận quyền cho phân hệ tài chính (finance)
        is_staff = bool(
            request.user and request.user.is_authenticated and (
                request.user.is_superuser or 
                check_role_permission(request.user, 'finance', 'create') or
                check_role_permission(request.user, 'bookings', 'update')
            )
        )
        is_cash_payment = str(payment_method).upper() == 'CASH'

        # Nếu là khách hàng tự thanh toán trực tuyến:
        # Số tiền thanh toán không được nhỏ hơn số tiền còn lại cần thanh toán (remaining_balance)
        # Dung sai 1,000 VND để tránh lỗi làm tròn số học
        if not is_staff and not is_cash_payment:
            target_required = remaining_balance if remaining_balance > Decimal('0') else room_charge
            if amount_dec < (target_required - Decimal('1000')):
                return Response(
                    {
                        "success": False,
                        "message": f"Số tiền thanh toán ({amount_dec:,.0f} VND) không đủ so với số tiền cần thanh toán ({target_required:,.0f} VND)."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Kiểm tra trạng thái đơn: Không cho phép thanh toán đơn đã hủy hoặc khách không đến
        if booking.status in ['cancelled', 'no_show']:
            return Response(
                {
                    "success": False,
                    "message": f"Đơn đặt phòng {booking.booking_code} đang ở trạng thái '{booking.get_status_display()}', không thể thực hiện thanh toán."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 4. Bọc trong Transaction Atomic: Đảm bảo Payment được lưu thành công thì mới update Booking
        with transaction.atomic():
            # Khóa bi quan (Pessimistic Lock) bản ghi booking để tuần tự hóa các request thanh toán spam click cùng 1 đơn
            booking = Booking.objects.select_for_update().get(pk=booking.pk)

            # 4.1 Kiểm tra xem đơn đặt phòng đã thanh toán đủ hay chưa (Idempotency & Overpayment Protection)
            completed_payments = booking.payments.filter(payment_status='COMPLETED')
            total_already_paid = sum(Decimal(str(p.amount)) for p in completed_payments)

            # Nếu đơn đặt phòng đã được thanh toán đủ (hoặc vượt): trả về giao dịch gần nhất, không tạo mới trùng lặp
            if total_already_paid >= grand_total and completed_payments.exists():
                latest_payment = completed_payments.order_by('-id').first()
                return Response(
                    {
                        "success": True,
                        "message": f"Đơn đặt phòng {booking.booking_code} đã được thanh toán đủ ({total_already_paid:,.0f} VND).",
                        "data": PaymentSerializer(latest_payment).data
                    },
                    status=status.HTTP_200_OK
                )

            # Nếu số tiền thanh toán gửi lên vượt quá số dư còn nợ thực tế
            current_remaining = max(Decimal('0'), grand_total - total_already_paid)
            if total_already_paid > Decimal('0') and amount_dec > (current_remaining + Decimal('1000')):
                # Nếu đã trả đủ tiền phòng rồi và amount_dec bằng đúng tiền phòng (thao tác trùng từ modal cũ)
                if total_already_paid >= pure_room_charge:
                    latest_payment = completed_payments.order_by('-id').first()
                    return Response(
                        {
                            "success": True,
                            "message": f"Tiền phòng cho đơn {booking.booking_code} đã được ghi nhận trước đó ({latest_payment.transaction_id}). Dư nợ còn lại là {current_remaining:,.0f} VND.",
                            "data": PaymentSerializer(latest_payment).data
                        },
                        status=status.HTTP_200_OK
                    )
                return Response(
                    {
                        "success": False,
                        "message": f"Số tiền thanh toán ({amount_dec:,.0f} VND) vượt quá số dư còn thiếu của đơn ({current_remaining:,.0f} VND)."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 4.2 Kiểm tra chống trùng giao dịch kép trong 30 giây (Idempotency check)
            thirty_seconds_ago = timezone.now() - timezone.timedelta(seconds=30)
            recent_duplicate = Payment.objects.filter(
                booking=booking,
                amount=amount_dec,
                payment_status='COMPLETED',
                created_at__gte=thirty_seconds_ago
            ).first()

            if recent_duplicate:
                serializer = PaymentSerializer(recent_duplicate)
                return Response(
                    {
                        "success": True,
                        "message": f"Giao dịch thanh toán {amount_dec:,.0f} VND cho đơn {booking.booking_code} đã được ghi nhận trước đó ({recent_duplicate.transaction_id}).",
                        "data": serializer.data
                    },
                    status=status.HTTP_200_OK
                )

            # 4.2 Cập nhật bản ghi Payment PENDING nếu có khớp số tiền, hoặc tạo mới bản ghi COMPLETED
            pending_payment = Payment.objects.filter(
                booking=booking,
                payment_status='PENDING',
                amount=amount_dec
            ).first()

            # Tìm ca làm việc đang mở (ưu tiên của user, sau đó là ca chung tại quầy)
            active_shift = None
            if request.user and request.user.is_authenticated:
                active_shift = CashierShift.objects.filter(user=request.user, status='OPEN').first()
                if not active_shift:
                    active_shift = CashierShift.objects.filter(status='OPEN').order_by('-opened_at').first()

            if pending_payment:
                pending_payment.payment_method = payment_method or 'TRANSFER'
                pending_payment.payment_status = 'COMPLETED'
                if active_shift and not pending_payment.shift:
                    pending_payment.shift = active_shift
                    pending_payment.save(update_fields=['payment_method', 'payment_status', 'shift'])
                else:
                    pending_payment.save(update_fields=['payment_method', 'payment_status'])
                payment = pending_payment
            else:
                payment = Payment.objects.create(
                    booking=booking,
                    amount=amount_dec,
                    payment_method=payment_method or 'TRANSFER',
                    payment_status='COMPLETED',
                    shift=active_shift
                )

            # 4.3 Cập nhật hóa đơn nếu có
            try:
                invoice = getattr(booking, 'invoice', None)
                if invoice:
                    invoice.status = 'paid'
                    invoice.payment_method = 'bank_transfer'
                    invoice.paid_at = timezone.now()
                    invoice.save()
            except Exception:
                pass

            # 4.4 Sau khi Payment đã tạo thành công 100%: Cập nhật bảng Booking
            if booking.status == 'pending':
                booking.status = 'paid'
            note_str = (booking.note or '').strip()
            method_label = 'Tiền mặt' if str(payment_method).upper() == 'CASH' else 'VietQR'
            pay_note = f"{method_label}: Đã thanh toán ({amount_dec:,.0f} VND)"
            if pay_note not in note_str:
                booking.note = f"{note_str} | {pay_note}" if note_str else pay_note
            booking.save(update_fields=['status', 'note'])

            # 4.5 Cập nhật tất cả dịch vụ đi kèm của đơn sang is_paid = True
            booking.service_requests.filter(is_paid=False).update(is_paid=True)
            booking.extra_services.filter(is_paid=False).update(is_paid=True)

        # Ghi nhận Nhật ký thao tác hệ thống (Audit Log)
        acting_user = request.user if (request.user and request.user.is_authenticated) else getattr(booking, 'guest', None)
        log_action(
            user=acting_user,
            action='CREATE',
            module='INVOICE',
            description=f"Ghi nhận thanh toán {amount_dec:,.0f} VND ({payment_method}) cho đơn #{booking.booking_code}",
            request=request
        )

        serializer = PaymentSerializer(payment)
        return Response(
            {
                "success": True,
                "message": f"Xác nhận thanh toán cho đơn {booking.booking_code} thành công!",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )


class PaymentListView(APIView):
    """
    API endpoint: GET /api/payments/
    Lấy danh sách các giao dịch thanh toán:
    - Quản lý / Lễ tân / Thu ngân: xem toàn bộ giao dịch
    - Khách hàng: chỉ xem giao dịch của chính mình
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        is_staff_or_admin = (
            user.is_superuser or 
            check_role_permission(user, 'finance', 'read')
        )

        # 1. Tự động đồng bộ các Hóa đơn (Invoices) nếu là nhân viên (Tối ưu hóa: Tránh N+1 query lặp DB)
        if is_staff_or_admin:
            existing_booking_ids = set(
                Payment.objects.filter(booking__isnull=False).values_list('booking_id', flat=True)
            )

            # Đồng bộ các Invoice hợp lệ chưa có payment record
            missing_invoices = Invoice.objects.filter(
                booking__isnull=False
            ).exclude(
                booking_id__in=existing_booking_ids
            ).select_related('booking')

            new_payments = []
            for inv in missing_invoices:
                method_code = 'TRANSFER' if str(inv.payment_method).lower() in ['bank_transfer', 'momo', 'transfer', 'vietqr', 'credit_card'] else 'CASH'
                status_code = 'COMPLETED' if inv.status == 'paid' else ('FAILED' if inv.status == 'cancelled' else 'PENDING')
                new_payments.append(Payment(
                    booking=inv.booking,
                    amount=inv.total_amount,
                    payment_method=method_code,
                    payment_status=status_code,
                    transaction_id=f"TXN-{inv.invoice_code.replace('INV-', '')}"
                ))
                existing_booking_ids.add(inv.booking_id)

            # Đồng bộ các booking lẻ đã thanh toán hợp lệ mà chưa có payment
            paid_bookings = Booking.objects.filter(
                models.Q(status__in=['completed', 'checked_out', 'paid', 'PAID']) |
                models.Q(note__icontains='VietQR: Đã thanh toán') |
                models.Q(note__icontains='đã thanh toán thành công')
            ).filter(
                group_booking__isnull=True
            ).exclude(
                status__in=['cancelled', 'no_show']
            ).exclude(
                id__in=existing_booking_ids
            )

            for b in paid_bookings:
                note_lower = (b.note or '').lower()
                method_code = 'TRANSFER' if ('vietqr' in note_lower or 'chuyển khoản' in note_lower or 'transfer' in note_lower) else 'CASH'
                new_payments.append(Payment(
                    booking=b,
                    amount=b.total_amount or 0,
                    payment_method=method_code,
                    payment_status='COMPLETED',
                    transaction_id=f"TXN-{b.booking_code.replace('BK-', '')}"
                ))
                existing_booking_ids.add(b.id)

            if new_payments:
                Payment.objects.bulk_create(new_payments, ignore_conflicts=True)

            # Dọn dẹp các bản ghi PENDING thừa của các đơn đã có giao dịch COMPLETED
            completed_booking_ids = Payment.objects.filter(
                payment_status='COMPLETED',
                booking__isnull=False
            ).values_list('booking_id', flat=True)
            Payment.objects.filter(
                payment_status='PENDING',
                booking_id__in=completed_booking_ids
            ).delete()

        queryset = Payment.objects.select_related(
            'booking',
            'booking__guest',
            'booking__room',
            'booking__category',
            'booking__invoice',
            'group_booking',
            'group_booking__corporate_partner',
            'group_booking__master_invoice'
        ).prefetch_related(
            'group_booking__sub_bookings',
            'group_booking__sub_bookings__room'
        ).annotate(
            status_priority=models.Case(
                models.When(payment_status__in=['PENDING', 'PROCESSING'], then=models.Value(1)),
                models.When(payment_status='COMPLETED', then=models.Value(2)),
                default=models.Value(3),
                output_field=models.IntegerField()
            )
        ).all().order_by('status_priority', '-created_at')

        # Khách hàng chỉ xem giao dịch của chính mình (hoặc đoàn/doanh nghiệp do mình làm đầu mối)
        if not is_staff_or_admin:
            user_email = getattr(user, 'email', '')
            user_phone = getattr(user, 'phone', '')
            q_filter = models.Q(booking__guest=user)
            if user_email:
                q_filter |= models.Q(group_booking__leader_email__iexact=user_email)
                q_filter |= models.Q(group_booking__corporate_partner__contact_email__iexact=user_email)
            if user_phone:
                q_filter |= models.Q(group_booking__leader_phone=user_phone)
                q_filter |= models.Q(group_booking__corporate_partner__contact_phone=user_phone)
            queryset = queryset.filter(q_filter)

        # Lọc trạng thái
        payment_status = request.query_params.get('status')
        if payment_status and payment_status != 'ALL':
            queryset = queryset.filter(payment_status=payment_status)

        # Tìm kiếm từ khóa
        search = request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                models.Q(booking__booking_code__icontains=search) |
                models.Q(booking__guest__first_name__icontains=search) |
                models.Q(booking__guest__last_name__icontains=search) |
                models.Q(booking__guest__username__icontains=search) |
                models.Q(booking__company_name__icontains=search) |
                models.Q(group_booking__group_code__icontains=search) |
                models.Q(group_booking__group_name__icontains=search) |
                models.Q(group_booking__leader_name__icontains=search) |
                models.Q(group_booking__corporate_partner__company_name__icontains=search) |
                models.Q(transaction_id__icontains=search)
            )

        include_details = str(request.query_params.get('include_details', '')).lower() in ['1', 'true', 'yes']
        SerializerClass = PaymentSerializer if include_details else PaymentListSerializer
        serializer = SerializerClass(queryset, many=True, context={'request': request})
        return Response({
            "success": True,
            "count": queryset.count(),
            "results": serializer.data
        }, status=status.HTTP_200_OK)


class PaymentDetailView(APIView):
    """
    API endpoint: GET /api/payments/<payment_id>/
    Lấy chi tiết đầy đủ của 1 giao dịch thanh toán kèm booking_details phục vụ xem chi tiết và in ấn hóa đơn.
    Được tối ưu để chỉ truy vấn đúng 1 đơn đặt phòng khi cần hiển thị modal, tải tức thì (< 50ms).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, payment_id):
        try:
            payment = Payment.objects.select_related(
                'booking',
                'booking__guest',
                'booking__room',
                'booking__category',
                'booking__invoice',
                'group_booking',
                'group_booking__corporate_partner',
                'group_booking__master_invoice'
            ).prefetch_related(
                'group_booking__sub_bookings',
                'group_booking__sub_bookings__room',
                'booking__extra_services',
                'booking__payments',
                'booking__guests'
            ).get(id=payment_id)
        except Payment.DoesNotExist:
            return Response({
                "success": False,
                "message": f"Không tìm thấy giao dịch thanh toán #{payment_id}."
            }, status=status.HTTP_404_NOT_FOUND)

        # Kiểm tra quyền truy cập (IDOR Guardrail):
        # Nhân viên lễ tân, thu ngân, quản lý, admin được xem tất cả. Khách hàng chỉ xem giao dịch của chính mình/đoàn mình.
        user = request.user
        is_staff_or_admin = (
            user.is_superuser or
            getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'cashier', 'owner'] or
            check_role_permission(user, 'finance', 'read')
        )
        if not is_staff_or_admin:
            is_owner = False
            user_email = getattr(user, 'email', '')
            user_phone = getattr(user, 'phone', '')

            if payment.booking and payment.booking.guest_id == user.id:
                is_owner = True
            elif payment.group_booking:
                if user_email and (
                    (payment.group_booking.leader_email and payment.group_booking.leader_email.lower() == user_email.lower()) or
                    (payment.group_booking.corporate_partner and payment.group_booking.corporate_partner.contact_email and payment.group_booking.corporate_partner.contact_email.lower() == user_email.lower())
                ):
                    is_owner = True
                elif user_phone and (
                    payment.group_booking.leader_phone == user_phone or
                    (payment.group_booking.corporate_partner and payment.group_booking.corporate_partner.contact_phone == user_phone)
                ):
                    is_owner = True

            if not is_owner:
                return Response({
                    "success": False,
                    "message": "Bạn không có quyền truy cập thông tin giao dịch này."
                }, status=status.HTTP_403_FORBIDDEN)

        serializer = PaymentSerializer(payment, context={'request': request})
        return Response({
            "success": True,
            "data": serializer.data
        }, status=status.HTTP_200_OK)


class PaymentConfigView(APIView):
    """
    API endpoint: /api/payments/config/
    - GET (Public): Lấy bản ghi cấu hình VietQR đầu tiên. Nếu chưa có, tự động tạo cấu hình mặc định.
    - PUT / PATCH (Admin Only): Cập nhật thông tin tài khoản ngân hàng thụ hưởng VietQR.
    """
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated(), IsAdminOrOwnerUser()]

    def get(self, request):
        config = PaymentConfig.get_solo()
        serializer = PaymentConfigSerializer(config)
        return Response({
            "success": True,
            "data": serializer.data
        }, status=status.HTTP_200_OK)

    def put(self, request):
        config = PaymentConfig.get_solo()
        serializer = PaymentConfigSerializer(config, data=request.data, partial=False)
        if serializer.is_valid():
            cfg = serializer.save()
            log_action(
                user=request.user,
                action='UPDATE',
                module='SYSTEM',
                description=f"Cập nhật cấu hình thụ hưởng VietQR ({cfg.bank_id} - STK: {cfg.account_no} - {cfg.account_name})",
                request=request
            )
            return Response({
                "success": True,
                "message": "Cập nhật cấu hình thanh toán VietQR thành công!",
                "data": serializer.data
            }, status=status.HTTP_200_OK)
        return Response({
            "success": False,
            "message": "Dữ liệu cấu hình không hợp lệ.",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        config = PaymentConfig.get_solo()
        serializer = PaymentConfigSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            cfg = serializer.save()
            log_action(
                user=request.user,
                action='UPDATE',
                module='SYSTEM',
                description=f"Cập nhật cấu hình thụ hưởng VietQR ({cfg.bank_id} - STK: {cfg.account_no} - {cfg.account_name})",
                request=request
            )
            return Response({
                "success": True,
                "message": "Cập nhật cấu hình thanh toán VietQR thành công!",
                "data": serializer.data
            }, status=status.HTTP_200_OK)
        return Response({
            "success": False,
            "message": "Dữ liệu cấu hình không hợp lệ.",
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class PaymentStatusView(APIView):
    """
    API endpoint: GET /api/payments/<booking_id>/status/
    Kiểm tra trạng thái thanh toán của đơn đặt phòng hoặc đơn đặt đoàn phục vụ Long Polling từ Frontend.
    Hỗ trợ booking_id là ID (số) hoặc mã code (BK-xxxxxx hoặc GRP-xxxxxx).
    Trả về {"status": "COMPLETED"} hoặc {"status": "PENDING"}.
    """
    permission_classes = [AllowAny]

    def get(self, request, booking_id):
        from ...bookings.models import GroupBooking
        booking = None
        group_booking = None

        raw_id = str(booking_id).strip()

        # 1. Tra cứu theo GroupBooking (Mã đoàn GRP-xxxxxx hoặc ID)
        if raw_id.upper().startswith('GRP-') or 'GRP' in raw_id.upper():
            group_booking = GroupBooking.objects.filter(group_code__iexact=raw_id).first()
            if not group_booking:
                clean_grp = re.sub(r'[^A-Za-z0-9]', '', raw_id).upper()
                group_booking = GroupBooking.objects.filter(group_code__icontains=clean_grp.replace('GRP', '')).first()

        if not group_booking and raw_id.isdigit():
            group_booking = GroupBooking.objects.filter(id=int(raw_id)).first()

        # 2. Tra cứu theo Booking đơn lẻ nếu chưa thấy đơn đoàn
        if not group_booking:
            try:
                if raw_id.isdigit():
                    booking = Booking.objects.get(id=int(raw_id))
                else:
                    booking = Booking.objects.get(booking_code__iexact=raw_id)
            except Booking.DoesNotExist:
                pass

        if not booking and not group_booking:
            return Response(
                {
                    "status": "NOT_FOUND",
                    "message": f"Không tìm thấy đơn đặt phòng hoặc đơn đặt đoàn với mã '{booking_id}'."
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # Xử lý kết quả kiểm tra cho Đơn đặt đoàn
        if group_booking:
            has_completed_payment = Payment.objects.filter(group_booking=group_booking, payment_status='COMPLETED').exists()
            is_deposit_paid = bool(group_booking.is_deposit_paid)
            is_group_confirmed = group_booking.status in ['confirmed', 'checked_in', 'paid', 'completed']
            is_invoice_paid = hasattr(group_booking, 'master_invoice') and group_booking.master_invoice and group_booking.master_invoice.status == 'paid'

            if has_completed_payment or is_deposit_paid or is_group_confirmed or is_invoice_paid:
                return Response({
                    "status": "COMPLETED",
                    "group_code": group_booking.group_code,
                    "group_id": group_booking.id,
                    "is_group": True,
                    "is_deposit_paid": True,
                    "group_status": group_booking.status
                }, status=status.HTTP_200_OK)

            return Response({
                "status": "PENDING",
                "group_code": group_booking.group_code,
                "group_id": group_booking.id,
                "is_group": True,
                "is_deposit_paid": False
            }, status=status.HTTP_200_OK)

        # Xử lý kết quả kiểm tra cho Đơn phòng lẻ
        has_completed_payment = Payment.objects.filter(booking=booking, payment_status='COMPLETED').exists()
        is_invoice_paid = hasattr(booking, 'invoice') and booking.invoice.status == 'paid'
        is_booking_paid = booking.status in ['paid', 'confirmed', 'completed', 'checked_in']

        if has_completed_payment or is_invoice_paid or is_booking_paid:
            return Response({
                "status": "COMPLETED",
                "booking_code": booking.booking_code,
                "booking_id": booking.id
            }, status=status.HTTP_200_OK)

        return Response({
            "status": "PENDING",
            "booking_code": booking.booking_code,
            "booking_id": booking.id
        }, status=status.HTTP_200_OK)


class ConfirmPaymentByIdView(APIView):
    """
    API endpoint: POST /api/payments/<int:payment_id>/confirm/
    Xác nhận hoàn tất một giao dịch thanh toán (PENDING -> COMPLETED) bởi Thu ngân / Lễ tân / Quản lý:
    - Cập nhật payment_status = 'COMPLETED'
    - Cập nhật payment_method ('CASH' hoặc 'TRANSFER') nếu được cung cấp
    - Cập nhật Booking hoặc GroupBooking (status, note, dịch vụ đi kèm)
    - Cập nhật Invoice liên quan sang status = 'paid'
    - Gửi email xác nhận thanh toán tự động
    - Ghi nhận Audit Log
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, payment_id):
        user = request.user
        can_confirm = (
            user.is_superuser or
            getattr(user, 'role', '') in ['admin', 'manager', 'receptionist', 'cashier', 'owner'] or
            check_role_permission(user, 'finance', 'update') or
            check_role_permission(user, 'finance', 'create')
        )
        if not can_confirm:
            return Response({
                'success': False,
                'message': 'Bạn không có quyền xác nhận thanh toán (Yêu cầu vai trò Thu ngân / Lễ tân / Quản lý).'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            payment = Payment.objects.select_related('booking', 'group_booking').get(pk=payment_id)
        except Payment.DoesNotExist:
            return Response({
                'success': False,
                'message': f'Không tìm thấy giao dịch thanh toán #{payment_id}.'
            }, status=status.HTTP_404_NOT_FOUND)

        if payment.payment_status == 'COMPLETED':
            return Response({
                'success': True,
                'message': 'Giao dịch này đã ở trạng thái hoàn tất thành công.',
                'data': PaymentSerializer(payment).data
            }, status=status.HTTP_200_OK)

        new_method = request.data.get('payment_method')
        note = (request.data.get('note') or '').strip()

        with transaction.atomic():
            payment.payment_status = 'COMPLETED'
            if new_method:
                payment.payment_method = str(new_method).upper()
            payment.save(update_fields=['payment_status', 'payment_method'])

            # 1. Đơn đặt phòng lẻ
            if payment.booking:
                b = payment.booking
                if b.status in ['pending', 'unconfirmed']:
                    b.status = 'paid'
                method_name = 'Tiền mặt' if payment.payment_method == 'CASH' else 'VietQR'
                pay_note = f"{method_name}: Đã xác nhận thu ({payment.amount:,.0f} VND)"
                if note:
                    pay_note += f" - {note}"
                curr_note = (b.note or '').strip()
                if pay_note not in curr_note:
                    b.note = f"{curr_note} | {pay_note}" if curr_note else pay_note
                b.save(update_fields=['status', 'note'])

                # Đồng bộ invoice
                inv = getattr(b, 'invoice', None)
                if inv:
                    inv.status = 'paid'
                    inv.paid_at = timezone.now()
                    inv.save(update_fields=['status', 'paid_at'])

                # Đồng bộ dịch vụ
                b.service_requests.filter(is_paid=False).update(is_paid=True)
                b.extra_services.filter(is_paid=False).update(is_paid=True)

                # Gửi email xác nhận thanh toán
                target_email = None
                if inv and inv.invoice_recipient_email:
                    target_email = inv.invoice_recipient_email.strip()
                elif b.guest and b.guest.email:
                    target_email = b.guest.email.strip()

                try:
                    send_booking_email_async(
                        booking=b,
                        email_type='payment_success',
                        custom_subject=f"[Khách Sạn TA Đà Nẵng] Xác nhận THU TIỀN THÀNH CÔNG - Đơn #{b.booking_code}",
                        recipient_email=target_email
                    )
                except Exception:
                    pass

            # 2. Đơn đặt phòng đoàn
            elif payment.group_booking:
                grp = payment.group_booking
                grp.is_deposit_paid = True
                if grp.status == 'tentative':
                    grp.status = 'confirmed'
                grp.save(update_fields=['is_deposit_paid', 'status'])

                if hasattr(grp, 'master_invoice') and grp.master_invoice:
                    inv = grp.master_invoice
                    inv.status = 'paid'
                    inv.paid_at = timezone.now()
                    inv.save(update_fields=['status', 'paid_at'])

                for sub_b in grp.sub_bookings.all():
                    if sub_b.status in ['pending', 'unconfirmed']:
                        sub_b.status = 'confirmed'
                        sub_b.save(update_fields=['status'])
                    sub_b.service_requests.filter(is_paid=False).update(is_paid=True)
                    sub_b.extra_services.filter(is_paid=False).update(is_paid=True)

                try:
                    send_group_booking_email_async(
                        group_booking=grp,
                        email_type='group_deposit_success',
                        custom_subject=f"[Khách Sạn TA Đà Nẵng] Xác nhận thanh toán đặt đoàn #{grp.group_code}",
                        recipient_email=grp.leader_email
                    )
                except Exception:
                    pass

        log_action(
            user=user,
            action='UPDATE',
            module='INVOICE',
            description=f"Thu ngân ({user.username}) xác nhận hoàn tất thanh toán #{payment.transaction_id or payment.id} ({payment.amount:,.0f} VND) phương thức {payment.payment_method}",
            request=request
        )

        # Tự động gắn ca làm việc nếu thu ngân/lễ tân đang có ca mở hoặc quầy đang mở ca
        active_shift = CashierShift.objects.filter(user=user, status='OPEN').first()
        if not active_shift:
            active_shift = CashierShift.objects.filter(status='OPEN').order_by('-opened_at').first()
        if active_shift:
            payment.shift = active_shift
            payment.save(update_fields=['shift'])

        return Response({
            'success': True,
            'message': f'Xác nhận thanh toán cho giao dịch #{payment.transaction_id or payment.id} thành công!',
            'data': PaymentSerializer(payment).data
        }, status=status.HTTP_200_OK)
