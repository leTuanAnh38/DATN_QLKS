import logging
from decimal import Decimal
from django.db import transaction
from ..users.models import MembershipTier, log_action

logger = logging.getLogger(__name__)

POINTS_PER_VND_UNIT = 100_000  # Cứ 100.000 VNĐ thanh toán thành công = 1 điểm tích lũy


def calculate_points_from_amount(amount):
    """
    Tính điểm thưởng dựa trên tổng tiền thanh toán:
    Ví dụ: 1.250.000 VNĐ -> 12 điểm
    """
    if not amount:
        return 0
    try:
        dec_amount = Decimal(str(amount))
        return int(dec_amount // Decimal(str(POINTS_PER_VND_UNIT)))
    except Exception as e:
        logger.error(f"Lỗi tính điểm thưởng từ số tiền {amount}: {e}")
        return 0


def upgrade_user_membership_tier(user):
    """
    Kiểm tra và cập nhật hạng thẻ cao nhất phù hợp với số điểm tích lũy của user.
    Trả về (new_tier, is_upgraded)
    """
    if not user:
        return None, False

    eligible_tier = MembershipTier.objects.filter(
        min_points__lte=user.total_points
    ).order_by('-min_points', '-order').first()

    if not eligible_tier:
        return user.current_tier, False

    is_upgraded = False
    if user.current_tier != eligible_tier:
        old_tier_name = user.current_tier.name if user.current_tier else "Chưa có hạng"
        user.current_tier = eligible_tier
        user.save(update_fields=['current_tier'])
        is_upgraded = True
        logger.info(f"User {user.username} được nâng hạng từ '{old_tier_name}' lên '{eligible_tier.name}'.")

    # Đồng bộ sang GuestProfile nếu có
    if hasattr(user, 'guest_profile') and user.guest_profile:
        user.guest_profile.loyalty_points = user.total_points
        user.guest_profile.vip_tier = eligible_tier.name
        user.guest_profile.save(update_fields=['loyalty_points', 'vip_tier'])

    return eligible_tier, is_upgraded


def award_booking_loyalty_points(booking):
    """
    Logic tích điểm khi đơn đặt phòng chuyển sang COMPLETED (lúc check-out):
    - Cứ 100.000 VNĐ thanh toán thành công -> cộng 1 điểm.
    - Cập nhật total_points của User.
    - Tự động nâng hạng thẻ nếu đủ điểm.
    - Gửi thông báo chúc mừng & tạo Audit Log.
    """
    if not booking or not booking.guest:
        return 0, False

    # Chỉ tích điểm nếu đơn đã hoàn tất (completed) và chưa từng được cộng điểm
    if booking.status != 'completed':
        return 0, False

    if booking.is_points_awarded:
        return 0, False

    with transaction.atomic():
        user = booking.guest
        points_to_award = calculate_points_from_amount(booking.total_amount)

        if points_to_award <= 0:
            # Vẫn đánh dấu để tránh tính lại
            booking.is_points_awarded = True
            booking.save(update_fields=['is_points_awarded'])
            return 0, False

        # 1. Cộng điểm tích lũy
        user.total_points += points_to_award
        user.save(update_fields=['total_points'])

        # 2. Kiểm tra thăng hạng thẻ
        new_tier, is_upgraded = upgrade_user_membership_tier(user)

        # 3. Đánh dấu booking đã cộng điểm
        booking.is_points_awarded = True
        booking.save(update_fields=['is_points_awarded'])

        # 4. Gửi thông báo đến người dùng
        try:
            from ..notifications.models import Notification
            notify_content = f"Quý khách vừa được cộng +{points_to_award} điểm tích lũy từ đơn đặt phòng #{booking.booking_code}."
            if is_upgraded and new_tier:
                notify_content += f" 🎉 Chúc mừng quý khách đã thăng hạng thành viên: {new_tier.name} (Hưởng giảm giá {new_tier.discount_percent}% cho các lần đặt phòng tiếp theo)!"

            Notification.objects.create(
                recipient=user,
                title="Tích lũy điểm thưởng thành viên",
                message=notify_content,
                type="general"
            )
        except Exception as e:
            logger.warning(f"Không thể gửi thông báo tích điểm: {e}")

        # 5. Ghi Audit Log
        try:
            log_action(
                user=user,
                action='UPDATE',
                module='LOYALTY',
                description=f"Cộng {points_to_award} điểm thưởng từ đơn {booking.booking_code}. Tổng điểm hiện tại: {user.total_points}."
            )
        except Exception:
            pass

        return points_to_award, is_upgraded


def recalculate_customer_loyalty_points(user):
    """
    Tính toán lại toàn bộ số tiền khách hàng đã thanh toán thành công (Completed Bookings & Payments),
    quy đổi điểm thưởng (100.000 VNĐ = 1 điểm) và tự động thăng hạng thẻ thành viên tương ứng.
    """
    if not user:
        return 0, None, Decimal('0')

    from .models import Booking
    from ..payments.models import Payment

    with transaction.atomic():
        # Tìm các booking của khách có trạng thái thanh toán hoặc hoàn tất
        completed_bookings = Booking.objects.filter(
            guest=user, 
            status__in=['completed', 'checked_out', 'paid', 'PAID']
        )

        # Tìm các giao dịch Payment COMPLETED
        completed_payments = Payment.objects.filter(
            booking__guest=user,
            payment_status='COMPLETED'
        )

        total_spent = Decimal('0')
        if completed_payments.exists():
            for p in completed_payments:
                total_spent += Decimal(str(p.amount or 0))
        elif completed_bookings.exists():
            for b in completed_bookings:
                total_spent += Decimal(str(b.total_amount or 0))

        # Đánh dấu các đơn này là đã tính điểm
        completed_bookings.update(is_points_awarded=True)

        # Tính tổng điểm tích lũy: Cứ 100.000 VNĐ = 1 điểm
        points = calculate_points_from_amount(total_spent)
        user.total_points = points
        user.save(update_fields=['total_points'])

        # Cập nhật hạng thẻ cao nhất phù hợp
        new_tier, is_upgraded = upgrade_user_membership_tier(user)

        try:
            log_action(
                user=user,
                action='UPDATE',
                module='LOYALTY',
                description=f"Đồng bộ tích điểm lịch sử chi tiêu: Tổng chi {total_spent:,.0f} VND -> {points} điểm -> Hạng {new_tier.name if new_tier else 'N/A'}."
            )
        except Exception:
            pass

        return points, new_tier, total_spent

