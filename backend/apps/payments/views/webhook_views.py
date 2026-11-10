"""Webhook SePay."""
import os
import re
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from ...bookings.models import Booking, GroupBooking
from ...bookings.email_service import send_booking_email_async, send_group_booking_email_async
from ...users.models import log_action
from ..models import Payment


class SepayWebhookView(APIView):
    """
    API endpoint: POST /api/payments/webhook/sepay/
    Nhận Webhook từ SePay khi có biến động số dư chuyển khoản VietQR thành công.
    Tự động cập nhật trạng thái đơn đặt phòng sang COMPLETED.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        # 1. Xác thực API Key từ SePay (nếu có cấu hình SEPAY_WEBHOOK_SECRET)
        secret = os.getenv('SEPAY_WEBHOOK_SECRET', '').strip().strip('"').strip("'")
        auth_header = request.headers.get('Authorization', '')
        
        if secret and auth_header:
            token = auth_header.replace('Apikey', '').strip()
            if token != secret:
                return Response(
                    {"success": False, "message": "Sai API Key xác thực SePay."},
                    status=status.HTTP_401_UNAUTHORIZED
                )

        data = request.data
        transfer_type = data.get('transferType', 'in')
        if transfer_type and str(transfer_type).lower() != 'in':
            return Response({"success": True, "message": "Bỏ qua giao dịch không phải tiền vào."}, status=status.HTTP_200_OK)

        content = str(data.get('content', '') or data.get('description', ''))
        amount_val = data.get('transferAmount') or data.get('amount')
        sepay_id = data.get('id', '')
        reference_code = data.get('referenceCode', '')

        # 2. Tìm mã đơn booking_code hoặc group_code trong nội dung chuyển khoản bằng Regex
        # Hỗ trợ mọi biến thể ngân hàng: có gạch ngang (BK-DA5F79, GRP-912A34) hoặc nuốt gạch ngang
        booking = None
        group_booking = None

        match_grp = re.search(r'GRP-?([A-Za-z0-9]{4,10})', content, re.IGNORECASE)
        if match_grp:
            clean_grp = match_grp.group(1).upper()
            group_booking = GroupBooking.objects.filter(group_code__iexact=f"GRP-{clean_grp}").first()
            if not group_booking:
                group_booking = GroupBooking.objects.filter(group_code__icontains=clean_grp).first()
        else:
            match_doan = re.search(r'(?:doan|group)\s*#?([A-Za-z0-9]{4,10})', content, re.IGNORECASE)
            if match_doan:
                suffix = match_doan.group(1).upper()
                group_booking = GroupBooking.objects.filter(group_code__iexact=f"GRP-{suffix}").first()
                if not group_booking:
                    group_booking = GroupBooking.objects.filter(group_code__icontains=suffix).first()

        if not group_booking:
            match = re.search(r'BK-?([A-Za-z0-9]{4,10})', content, re.IGNORECASE)
            if match:
                clean_suffix = match.group(1).upper()
                booking = Booking.objects.filter(booking_code__iexact=f"BK-{clean_suffix}").first()
                if not booking:
                    booking = Booking.objects.filter(booking_code__icontains=clean_suffix).first()

        # Fallback: nếu không thấy BK-xxx hay GRP-xxx, thử tìm theo ID số trong content
        if not booking and not group_booking:
            id_match = re.search(r'\b(\d{1,6})\b', content)
            if id_match:
                booking = Booking.objects.filter(id=int(id_match.group(1))).first()

        if not booking and not group_booking:
            return Response(
                {"success": False, "message": f"Không tìm thấy đơn đặt phòng hoặc đơn đặt đoàn từ nội dung: '{content}'"},
                status=status.HTTP_200_OK
            )

        # 3. Chuyển đổi số tiền
        try:
            transfer_amount = Decimal(str(amount_val or 0))
        except (ValueError, TypeError):
            transfer_amount = Decimal('0')

        # Kiểm tra tính Idempotent (Chống gọi trùng lặp Webhook SePay gây nhân bản thanh toán / spam email)
        txn_id = f"SEPAY-{sepay_id}" if sepay_id else (f"SEPAY-{reference_code}" if reference_code else None)
        if txn_id and Payment.objects.filter(transaction_id=txn_id, payment_status='COMPLETED').exists():
            return Response({
                "success": True,
                "message": f"Webhook SePay: Giao dịch {txn_id} đã được xử lý và ghi nhận thành công trước đó (Idempotency).",
                "data": {"transaction_id": txn_id}
            }, status=status.HTTP_200_OK)

        # Xử lý đơn Đặt Đoàn (Group Booking)
        if group_booking:
            with transaction.atomic():
                group_booking = GroupBooking.objects.select_for_update().get(pk=group_booking.pk)
                txn_id = f"SEPAY-{sepay_id}" if sepay_id else (f"SEPAY-{reference_code}" if reference_code else None)
                defaults = {
                    'group_booking': group_booking,
                    'amount': transfer_amount or group_booking.deposit_amount or group_booking.total_amount,
                    'payment_method': 'TRANSFER',
                    'payment_status': 'COMPLETED'
                }
                pending_payment = Payment.objects.filter(
                    group_booking=group_booking,
                    payment_status='PENDING'
                ).order_by('-created_at').first()

                if pending_payment:
                    pending_payment.transaction_id = txn_id or pending_payment.transaction_id
                    pending_payment.amount = transfer_amount or pending_payment.amount
                    pending_payment.payment_method = 'TRANSFER'
                    pending_payment.payment_status = 'COMPLETED'
                    pending_payment.save(update_fields=['transaction_id', 'amount', 'payment_method', 'payment_status'])
                    payment = pending_payment
                else:
                    if txn_id:
                        payment, _ = Payment.objects.update_or_create(
                            transaction_id=txn_id,
                            defaults=defaults
                        )
                    else:
                        payment = Payment.objects.create(**defaults)

                Payment.objects.filter(group_booking=group_booking, payment_status='PENDING').delete()

                group_booking.is_deposit_paid = True
                if group_booking.status == 'tentative':
                    group_booking.status = 'confirmed'
                grp_note = (group_booking.note or '').strip()
                pay_note = f"SePay VietQR Auto ({transfer_amount:,.0f} VND)"
                if 'SePay VietQR' not in grp_note:
                    group_booking.note = f"{grp_note} | {pay_note}" if grp_note else pay_note
                group_booking.save(update_fields=['is_deposit_paid', 'status', 'note'])

                if hasattr(group_booking, 'master_invoice') and group_booking.master_invoice:
                    inv = group_booking.master_invoice
                    inv.status = 'paid'
                    inv.payment_method = 'bank_transfer'
                    inv.paid_at = timezone.now()
                    inv.save()

                for sub_b in group_booking.sub_bookings.all():
                    if sub_b.status in ['pending', 'unconfirmed']:
                        sub_b.status = 'confirmed'
                        sub_b.save(update_fields=['status'])
                    sub_b.service_requests.filter(is_paid=False).update(is_paid=True)
                    sub_b.extra_services.filter(is_paid=False).update(is_paid=True)

            log_action(
                user=None,
                action='CREATE',
                module='INVOICE',
                description=f"SePay Webhook tự động xác nhận thanh toán {transfer_amount:,.0f} VND cho Đơn Đoàn #{group_booking.group_code}",
                request=request
            )

            # Gửi email HTML 5 sao xác nhận thanh toán/đặt cọc thành công cho toàn đoàn
            try:
                send_group_booking_email_async(
                    group_booking=group_booking,
                    email_type='payment_success'
                )
            except Exception:
                pass

            return Response({
                "success": True,
                "message": f"Webhook SePay: Thanh toán cho Đơn Đoàn {group_booking.group_code} thành công!",
                "data": {"group_code": group_booking.group_code, "amount": float(transfer_amount)}
            }, status=status.HTTP_200_OK)

        # 4. Cập nhật thanh toán và trạng thái Booking đơn lẻ trong Database
        with transaction.atomic():
            booking = Booking.objects.select_for_update().get(pk=booking.pk)

            txn_id = f"SEPAY-{sepay_id}" if sepay_id else (f"SEPAY-{reference_code}" if reference_code else None)
            defaults = {
                'booking': booking,
                'amount': transfer_amount or booking.total_amount,
                'payment_method': 'TRANSFER',
                'payment_status': 'COMPLETED'
            }

            # Tìm và cập nhật bản ghi PENDING trước đó của booking này (được tạo lúc khách bấm Đặt phòng)
            pending_payment = Payment.objects.filter(
                booking=booking,
                payment_status='PENDING'
            ).order_by('-created_at').first()

            if pending_payment:
                pending_payment.transaction_id = txn_id or pending_payment.transaction_id
                pending_payment.amount = transfer_amount or pending_payment.amount
                pending_payment.payment_method = 'TRANSFER'
                pending_payment.payment_status = 'COMPLETED'
                pending_payment.save(update_fields=['transaction_id', 'amount', 'payment_method', 'payment_status'])
                payment = pending_payment
            else:
                if txn_id:
                    payment, _ = Payment.objects.update_or_create(
                        transaction_id=txn_id,
                        defaults=defaults
                    )
                else:
                    payment = Payment.objects.create(**defaults)

            # Dọn dẹp các bản ghi PENDING thừa khác nếu có của booking này (tránh bị trùng 2 dòng trên màn hình Hóa đơn)
            Payment.objects.filter(booking=booking, payment_status='PENDING').delete()

            # Cập nhật hóa đơn
            if hasattr(booking, 'invoice') and booking.invoice:
                invoice = booking.invoice
                invoice.status = 'paid'
                invoice.payment_method = 'bank_transfer'
                invoice.paid_at = timezone.now()
                invoice.save()

            # Cập nhật đơn đặt phòng sang paid
            if booking.status in ['pending', 'unconfirmed']:
                booking.status = 'paid'
            note_str = (booking.note or '').strip()
            if 'SePay VietQR' not in note_str:
                booking.note = f"{note_str} | SePay VietQR Auto ({transfer_amount:,.0f} VND)" if note_str else f"SePay VietQR Auto ({transfer_amount:,.0f} VND)"
            booking.save(update_fields=['status', 'note'])

            # Tự động cập nhật tất cả các dịch vụ đặt kèm sang is_paid = True
            booking.service_requests.filter(is_paid=False).update(is_paid=True)
            booking.extra_services.filter(is_paid=False).update(is_paid=True)

        log_action(
            user=getattr(booking, 'guest', None),
            action='UPDATE',
            module='PAYMENT',
            description=f"SePay Webhook tự động xác nhận thanh toán {transfer_amount:,.0f} VND cho đơn {booking.booking_code}",
            request=request
        )

        # TRIGGER 2 - Khi khách quét mã VietQR và Webhook SePay báo tiền về thành công:
        # Ngay sau khi cập nhật trạng thái đơn sang đã thanh toán, tự động gọi lại hàm gửi email chạy ngầm
        recipient_target = None
        if hasattr(booking, 'invoice') and booking.invoice and booking.invoice.invoice_recipient_email:
            recipient_target = booking.invoice.invoice_recipient_email.strip()
        elif booking.guest and booking.guest.email:
            recipient_target = booking.guest.email.strip()

        send_booking_email_async(
            booking=booking,
            email_type='payment_success',
            custom_subject=f"[Khách Sạn TA Đà Nẵng] Xác nhận ĐÃ THANH TOÁN THÀNH CÔNG - Đơn #{booking.booking_code}",
            recipient_email=recipient_target
        )

        return Response({
            "success": True,
            "message": f"Đã cập nhật trạng thái COMPLETED cho đơn {booking.booking_code} thành công!",
            "booking_code": booking.booking_code
        }, status=status.HTTP_200_OK)
