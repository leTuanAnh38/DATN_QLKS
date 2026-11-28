import uuid
from datetime import timedelta
from decimal import Decimal
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from ...users.models import User, GuestProfile
from ..models import GroupBooking, BookingExtraService, HotelSetting
from ...services.models import ServiceRequest
from ...payments.models import Invoice, Payment, CashOutVoucher


def _resolve_or_create_booking_guest_user(guest_name, guest_phone, guest_email, identity_card, create_account=False, is_walkin=True):
    """
    Tìm hoặc tạo tài khoản User và GuestProfile cho khách đặt phòng tại quầy (Walk-in) hoặc qua SĐT/Zalo.
    - create_account=True: Khách muốn mở tài khoản thành viên web -> Tạo User is_active=True (hoặc kích hoạt nếu đã có).
    - create_account=False: Khách vãng lai thông thường -> User offline (is_active=False) với tiền tố 'walkin_' hoặc 'phone_' để phân biệt.
    - Chống nhầm lẫn tài khoản: Nếu SĐT trùng với User có họ tên hoàn toàn khác, không gán nhầm vào tài khoản người khác.
    - Email: Nếu khách cung cấp email, kiểm tra trùng lặp minh bạch. Cho phép cập nhật email thật cho khách đang mang email tạm (.local).
    """
    clean_phone = ''.join(c for c in str(guest_phone or '') if c.isdigit())
    guest_name = (guest_name or '').strip()
    guest_email = (guest_email or '').strip()
    name_parts = guest_name.split()
    first_name = ' '.join(name_parts[:-1]) if len(name_parts) > 1 else guest_name
    last_name = name_parts[-1] if len(name_parts) > 1 else ''

    # Chỉ tìm trong nhóm tài khoản khách hàng (tuyệt đối không gắn nhầm sang tài khoản nhân sự/Admin)
    guest_qs = User.objects.filter(role='guest', is_staff=False, is_superuser=False)
    matched_user = None
    if guest_phone:
        matched_user = guest_qs.filter(phone_number=guest_phone).first()
    if not matched_user and clean_phone:
        matched_user = guest_qs.filter(phone_number=clean_phone[:15]).first()
    if not matched_user and guest_email:
        matched_user = guest_qs.filter(email__iexact=guest_email).first()

    # Kiểm tra xem có đúng là cùng một người hay không (tránh khớp chuỗi con 1 ký tự như 'a' trong 'nguyen van a')
    is_same_person = False
    if matched_user:
        matched_name = ' '.join(matched_user.get_full_name().strip().lower().split())
        current_name = ' '.join(guest_name.strip().lower().split())
        if not matched_name:
            is_same_person = True
        elif matched_name == current_name:
            is_same_person = True
        elif len(current_name) >= 4 and len(matched_name) >= 4 and (matched_name in current_name or current_name in matched_name):
            is_same_person = True

    if matched_user and is_same_person:
        guest_user = matched_user
        if create_account and not guest_user.is_active:
            guest_user.is_active = True
            guest_user.save(update_fields=['is_active'])
        if guest_name and not (guest_user.first_name or guest_user.last_name):
            guest_user.first_name = first_name
            guest_user.last_name = last_name
            guest_user.save(update_fields=['first_name', 'last_name'])

        # Bảo mật chống chiếm tài khoản (Account Takeover):
        # CHỈ bổ sung email thật cho tài khoản vãng lai chưa có mật khẩu web và đang dùng email rỗng/tạm (.local).
        # Tuyệt đối KHÔNG ghi đè email thật của tài khoản thành viên đã đăng ký.
        if guest_email:
            curr_email = (guest_user.email or '').strip().lower()
            is_placeholder_email = (not curr_email) or curr_email.endswith('.local')
            if is_placeholder_email and not guest_user.has_usable_password():
                email_conflict = User.objects.filter(email__iexact=guest_email).exclude(pk=guest_user.pk).exists()
                if email_conflict:
                    raise ValueError(f"Địa chỉ email '{guest_email}' đã được liên kết với một tài khoản khách hàng khác. Vui lòng kiểm tra lại hoặc để trống nếu khách không có email riêng.")
                guest_user.email = guest_email
                guest_user.save(update_fields=['email'])
    else:
        # Nếu không tìm thấy, hoặc SĐT bị trùng với người khác trong DB
        normalized_phone = clean_phone[:15] if clean_phone else ''
        email_conflict = User.objects.filter(email__iexact=guest_email).exists() if guest_email else False
        phone_already_used = bool(
            (guest_phone and User.objects.filter(phone_number=guest_phone).exists()) or
            (normalized_phone and User.objects.filter(phone_number=normalized_phone).exists())
        )

        if guest_email and email_conflict:
            raise ValueError(f"Địa chỉ email '{guest_email}' đã được đăng ký bởi một tài khoản khác trong hệ thống. Vui lòng kiểm tra lại hoặc để trống nếu khách không dùng email.")

        if create_account:
            # 1. Khách muốn đăng ký tài khoản thành viên chính thức (Active User)
            base_username = f"guest_{clean_phone[-6:]}" if len(clean_phone) >= 6 else f"guest_{uuid.uuid4().hex[:6]}"
            username = base_username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}_{counter}"
                counter += 1

            email_to_use = guest_email or f"{username}@guest.hotel.local"
            phone_to_save = None if phone_already_used else (normalized_phone or None)

            guest_user = User.objects.create_user(
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
            prefix = "walkin" if is_walkin else "phone"
            username = f"{prefix}_{clean_phone[-6:]}_{unique_tag}" if len(clean_phone) >= 6 else f"{prefix}_{unique_tag}"
            email_to_use = guest_email if guest_email else f"{username}@walkin.hotel.local"
            phone_to_save = None if phone_already_used else (normalized_phone or None)

            guest_user = User.objects.create(
                username=username,
                email=email_to_use,
                phone_number=phone_to_save,
                first_name=first_name,
                last_name=last_name,
                role='guest',
                is_active=True
            )
            guest_user.set_unusable_password()
            guest_user.save(update_fields=['password'])

    # Cập nhật hoặc tạo GuestProfile
    profile, _ = GuestProfile.objects.get_or_create(user=guest_user)
    if identity_card and profile.id_card_number != identity_card:
        profile.id_card_number = identity_card
        profile.save(update_fields=['id_card_number'])

    return guest_user


def sync_group_financials_after_subbooking_cancel(group, now_str=''):
    """
    Đồng bộ tài chính toàn diện cho Đơn đặt đoàn (GroupBooking) sau khi hủy 1 phòng con:
    - Nếu không còn phòng nào hoạt động -> chuyển đoàn sang 'cancelled', đóng Master Invoice (nếu pending) và Payment PENDING.
    - Nếu còn phòng hoạt động:
      1. Tính lại group.total_amount theo tổng tiền các phòng còn hoạt động.
      2. Nếu đoàn CHƯA đặt cọc -> tự động tính lại group.deposit_amount theo tỷ lệ cọc/thanh toán ban đầu (không vượt tổng mới)
         và đánh dấu FAILED các Payment PENDING cũ (tránh mã QR số tiền cũ).
      3. Nếu đoàn ĐÃ đặt cọc -> giữ nguyên group.deposit_amount (tiền thực đã thu), tính toán số tiền cọc dư (overpaid_amount)
         nếu tiền đã thanh toán > tổng hợp đồng mới và ghi chú kế toán vào internal_note.
      4. Đồng bộ lại Master Invoice nếu vẫn đang ở trạng thái 'pending' (room_charge, service_charge, discount, total_amount).
    """
    active_subs = list(group.sub_bookings.exclude(status='cancelled'))

    if not active_subs:
        group.status = 'cancelled'
        update_fields = ['status', 'updated_at']
        if now_str:
            group.note = f"{group.note or ''}\n[Toàn bộ phòng trong đoàn đã hủy lúc {now_str}]".strip()
            update_fields.append('note')
        group.save(update_fields=update_fields)

        master_inv = Invoice.objects.filter(group_booking=group).first()
        if master_inv and master_inv.status == 'pending':
            master_inv.status = 'cancelled'
            master_inv.save(update_fields=['status'])

        Payment.objects.filter(group_booking=group, payment_status='PENDING').update(payment_status='FAILED')
        return {
            'all_cancelled': True,
            'new_total': Decimal(str(group.total_amount or 0)),
            'new_deposit': Decimal(str(group.deposit_amount or 0)),
            'overpaid_amount': Decimal('0'),
        }

    old_total = Decimal(str(group.total_amount or 0))
    old_deposit = Decimal(str(group.deposit_amount or 0))
    new_total = sum((Decimal(str(b.total_amount or 0)) for b in active_subs), Decimal('0'))
    new_discount = sum((Decimal(str(b.membership_discount or 0)) for b in active_subs), Decimal('0'))

    active_ids = [b.id for b in active_subs]
    prebooked_svcs = BookingExtraService.objects.filter(
        booking_id__in=active_ids,
        service_name__icontains='[Đặt kèm đoàn]',
    )
    new_service_charge = sum(
        (Decimal(str(s.price or 0)) * Decimal(str(s.quantity or 1)) for s in prebooked_svcs),
        Decimal('0'),
    )
    new_room_charge = max(Decimal('0'), new_total - new_service_charge)

    group.total_amount = new_total
    update_fields = ['total_amount', 'updated_at']
    overpaid_amount = Decimal('0')

    if not group.is_deposit_paid:
        # Chưa thu tiền cọc -> đồng bộ lại số tiền cọc cần thu theo tổng hợp đồng mới
        if old_total > 0 and old_deposit >= old_total:
            new_deposit = new_total
        elif old_total > 0 and old_deposit > 0:
            ratio = old_deposit / old_total
            new_deposit = min(new_total, (new_total * ratio).quantize(Decimal('1')))
        else:
            setting = HotelSetting.get_settings()
            dep_rate = Decimal(str(setting.group_deposit_percent or 50)) / Decimal('100')
            new_deposit = min(new_total, (new_total * dep_rate).quantize(Decimal('1')))

        group.deposit_amount = new_deposit
        update_fields.append('deposit_amount')
        Payment.objects.filter(group_booking=group, payment_status='PENDING').update(payment_status='FAILED')
    else:
        # Đã thu cọc -> giữ nguyên deposit_amount (tiền đã thu thực tế), đối soát tiền dư cần hoàn trả khách
        completed_payments = Payment.objects.filter(group_booking=group, payment_status='COMPLETED')
        total_paid = (
            sum((Decimal(str(p.amount or 0)) for p in completed_payments), Decimal('0'))
            if completed_payments.exists()
            else old_deposit
        )
        refunded = sum(
            (
                Decimal(str(v.amount or 0))
                for v in CashOutVoucher.objects.filter(
                    group_booking=group,
                    voucher_type__in=['REFUND_DEPOSIT', 'REFUND_CANCEL'],
                )
            ),
            Decimal('0'),
        )
        net_paid = max(Decimal('0'), total_paid - refunded)
        overpaid_amount = max(Decimal('0'), net_paid - new_total)
        if overpaid_amount > 0:
            note_ts = f" lúc {now_str}" if now_str else ""
            overpay_log = (
                f"[Đối soát hủy lẻ phòng{note_ts}]: Tổng HĐ mới {new_total:,.0f} đ < "
                f"Đã thu {net_paid:,.0f} đ → Dư cọc cần hoàn lại khách: {overpaid_amount:,.0f} đ."
            )
            group.internal_note = f"{group.internal_note or ''}\n{overpay_log}".strip()
            update_fields.append('internal_note')

    group.save(update_fields=update_fields)

    # Đồng bộ lại Master Invoice nếu đang chờ thanh toán (tránh đụng Invoice đã 'paid' để bảo toàn công thức doanh thu thuần)
    master_inv = Invoice.objects.filter(group_booking=group).first()
    if master_inv and master_inv.status == 'pending':
        master_inv.room_charge = new_room_charge
        master_inv.service_charge = new_service_charge
        master_inv.discount = new_discount
        master_inv.total_amount = new_total
        master_inv.save(update_fields=['room_charge', 'service_charge', 'discount', 'total_amount'])

    return {
        'all_cancelled': False,
        'new_total': new_total,
        'new_deposit': Decimal(str(group.deposit_amount or 0)),
        'overpaid_amount': overpaid_amount,
    }


def get_group_hold_minutes():
    """Lấy thời gian giữ chỗ chờ thanh toán/cọc (phút) từ Cài đặt hệ thống (mặc định 30 phút)."""
    try:
        setting = HotelSetting.get_settings()
        val = int(getattr(setting, 'auto_cancel_minutes', 30) or 30)
        return max(1, val)
    except Exception:
        return 30


def expire_overdue_tentative_groups():
    """
    Tự động hủy các đơn đặt đoàn chưa đặt cọc (status='tentative', is_deposit_paid=False)
    đã quá thời hạn giữ chỗ (HotelSetting.auto_cancel_minutes) để nhả quỹ phòng về trống.
    - Bỏ qua tuyệt đối các đoàn đã nhận thanh toán COMPLETED hoặc đã có phòng nhận/hoàn tất.
    - Fast-path: nếu không có đoàn quá hạn sẽ trả về 0 ngay sau 1 truy vấn nhẹ.
    """
    hold_minutes = get_group_hold_minutes()
    now = timezone.now()
    cutoff = now - timedelta(minutes=hold_minutes)

    overdue_qs = (
        GroupBooking.objects.filter(
            status='tentative',
            is_deposit_paid=False,
            created_at__lt=cutoff,
        )
        .exclude(payments__payment_status='COMPLETED')
        .exclude(sub_bookings__status__in=['checked_in', 'checked_out', 'completed'])
        .distinct()
    )

    if not overdue_qs.exists():
        return 0

    now_str = now.strftime('%d/%m/%Y %H:%M')
    expired_count = 0

    with transaction.atomic():
        overdue_groups = list(overdue_qs.prefetch_related('sub_bookings', 'sub_bookings__room'))
        for group in overdue_groups:
            if group.status != 'tentative' or group.is_deposit_paid:
                continue

            group.status = 'cancelled'
            group.note = (
                f"{group.note or ''}\n"
                f"[Tự động hủy lúc {now_str}]: Quá thời hạn giữ chỗ chờ đặt cọc ({hold_minutes} phút)."
            ).strip()
            group.save(update_fields=['status', 'note', 'updated_at'])

            subs = list(group.sub_bookings.all())
            sub_ids = [s.id for s in subs]
            for sub in subs:
                if sub.status not in ['cancelled', 'completed', 'checked_out']:
                    if sub.room and sub.room.status == 'occupied':
                        sub.room.status = 'available'
                        sub.room.save(update_fields=['status'])
                    sub.status = 'cancelled'
                    sub.note = (
                        f"{sub.note or ''}\n"
                        f"[Tự động hủy theo đoàn #{group.group_code} lúc {now_str}]: "
                        f"Quá thời hạn đặt cọc ({hold_minutes} phút)."
                    ).strip()
                    sub.save(update_fields=['status', 'note', 'updated_at'])

            if sub_ids:
                ServiceRequest.objects.filter(
                    booking_id__in=sub_ids,
                    status__in=['pending', 'in_progress'],
                ).update(status='cancelled')

            master_inv = Invoice.objects.filter(group_booking=group).first()
            if master_inv and master_inv.status == 'pending':
                master_inv.status = 'cancelled'
                master_inv.save(update_fields=['status'])

            Payment.objects.filter(
                Q(group_booking=group) | Q(booking_id__in=sub_ids),
                payment_status='PENDING',
            ).update(payment_status='FAILED')

            expired_count += 1

    return expired_count


def build_active_inventory_q(single_pending_minutes=None):
    """
    Bộ lọc Q dùng chung xác định các Booking đang chiếm quỹ phòng:
    - Đơn đã xác nhận / đã thanh toán / đang lưu trú.
    - Đơn lẻ pending còn trong hạn giữ chỗ (mặc định lấy theo HotelSetting.auto_cancel_minutes).
    - Đơn con thuộc đoàn đã xác nhận / đang ở, HOẶC đoàn tentative còn trong hạn auto_cancel_minutes.
    """
    now = timezone.now()
    hold_minutes = get_group_hold_minutes()
    single_minutes = hold_minutes if single_pending_minutes is None else max(1, int(single_pending_minutes))
    single_cutoff = now - timedelta(minutes=single_minutes)
    group_cutoff = now - timedelta(minutes=hold_minutes)
    return (
        Q(status__in=['confirmed', 'checked_in', 'paid', 'PAID'])
        | Q(status='pending', group_booking__isnull=True, created_at__gte=single_cutoff)
        | Q(status='pending', group_booking__isnull=False, group_booking__status__in=['confirmed', 'checked_in'])
        | Q(
            status='pending',
            group_booking__isnull=False,
            group_booking__status='tentative',
            group_booking__created_at__gte=group_cutoff,
        )
    )
