import uuid
from ...users.models import User, GuestProfile


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
