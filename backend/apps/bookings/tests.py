from datetime import timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Booking, Promotion
from ..contacts.models import ContactMessage
from ..payments.models import Invoice
from ..rooms.models import LostAndFoundItem, MaintenanceTicket, Room, RoomCategory

User = get_user_model()


# Kiểm thử bảo mật và nghiệp vụ đặt phòng cá nhân
class BookingSecurityAndLogicTests(APITestCase):
    def setUp(self):
        self.guest_a = User.objects.create_user(
            username='guest_a',
            email='guesta@example.com',
            password='Password123!',
            role='guest',
        )
        self.guest_b = User.objects.create_user(
            username='guest_b',
            email='guestb@example.com',
            password='Password123!',
            role='guest',
        )
        self.receptionist = User.objects.create_user(
            username='receptionist1',
            email='rec@example.com',
            password='Password123!',
            role='receptionist',
        )
        self.cat_std = RoomCategory.objects.create(
            name='Standard',
            slug='standard',
            size=30.0,
            bed_type='1 Giường Đôi',
            capacity=2,
            base_price=Decimal('1000000'),
        )
        self.cat_dlx = RoomCategory.objects.create(
            name='Deluxe',
            slug='deluxe',
            size=45.0,
            bed_type='1 Giường King',
            capacity=2,
            base_price=Decimal('2000000'),
        )
        self.room_101 = Room.objects.create(
            room_number='101',
            category=self.cat_std,
            status='available',
            floor=1,
        )
        self.room_201 = Room.objects.create(
            room_number='201',
            category=self.cat_dlx,
            status='available',
            floor=2,
        )
        self.today = timezone.localdate()

    # Kiểm tra tìm kiếm theo mã đặt phòng không làm lộ đơn của khách khác (chống IDOR)
    def test_search_query_does_not_bypass_guest_idor(self):
        bk_b = Booking.objects.create(
            guest=self.guest_b,
            category=self.cat_std,
            room=self.room_101,
            check_in_date=self.today + timedelta(days=2),
            check_out_date=self.today + timedelta(days=4),
            total_amount=Decimal('2000000'),
            status='confirmed',
        )
        self.client.force_authenticate(user=self.guest_a)
        res = self.client.get(f'/api/bookings/?search={bk_b.booking_code}')
        self.assertEqual(res.status_code, 200)
        results = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
        self.assertEqual(len(results), 0)

        self.client.force_authenticate(user=self.receptionist)
        res_staff = self.client.get(f'/api/bookings/?search={bk_b.booking_code}')
        self.assertEqual(res_staff.status_code, 200)
        staff_results = res_staff.data.get('results', res_staff.data) if isinstance(res_staff.data, dict) else res_staff.data
        self.assertEqual(len(staff_results), 1)

    # Kiểm tra đơn đã thanh toán quá 15 phút vẫn giữ phòng để chống đặt trùng (overbooking)
    def test_paid_booking_older_than_15_minutes_still_blocks_overbooking(self):
        c_in = self.today + timedelta(days=5)
        c_out = self.today + timedelta(days=7)
        old_paid = Booking.objects.create(
            guest=self.guest_b,
            category=self.cat_std,
            room=self.room_101,
            check_in_date=c_in,
            check_out_date=c_out,
            total_amount=Decimal('2000000'),
            status='paid',
        )
        Booking.objects.filter(pk=old_paid.pk).update(
            created_at=timezone.now() - timedelta(hours=2)
        )

        self.client.force_authenticate(user=self.guest_a)
        res = self.client.post('/api/bookings/', {
            'category_id': self.cat_std.id,
            'check_in_date': c_in.isoformat(),
            'check_out_date': c_out.isoformat(),
            'guest_name': 'Nguyen Van A',
            'guest_phone': '0901234567',
            'guest_email': 'guesta@example.com',
            'identity_card': '012345678901',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data.get('code'), 'ROOM_SOLD_OUT')

    # Kiểm tra khách vãng lai chưa đăng nhập đặt phòng không bị gán nhầm vào tài khoản khách có sẵn
    def test_unauthenticated_guest_not_assigned_to_existing_guest_a(self):
        c_in = self.today + timedelta(days=10)
        c_out = self.today + timedelta(days=11)
        res = self.client.post('/api/bookings/', {
            'category_id': self.cat_std.id,
            'check_in_date': c_in.isoformat(),
            'check_out_date': c_out.isoformat(),
            'guest_name': 'Khach Vang Lai',
            'guest_phone': '0987654321',
            'guest_email': 'brandnew_walkin@example.com',
            'identity_card': '098765432109',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        created_bk = Booking.objects.get(id=res.data['booking']['id'])
        self.assertNotEqual(created_bk.guest_id, self.guest_a.id)
        self.assertFalse(created_bk.guest.is_active)

    # Kiểm tra đổi phòng khẩn cấp giữ nguyên tiền phòng gốc trong hóa đơn (không tính phụ thu hạng phòng mới)
    def test_change_room_locks_original_room_charge_in_invoice(self):
        bk = Booking.objects.create(
            guest=self.guest_a,
            category=self.cat_std,
            room=self.room_101,
            check_in_date=self.today,
            check_out_date=self.today + timedelta(days=2),
            total_amount=Decimal('2000000'),
            status='checked_in',
        )
        self.room_101.status = 'occupied'
        self.room_101.save(update_fields=['status'])

        self.client.force_authenticate(user=self.receptionist)
        res = self.client.post(f'/api/bookings/{bk.id}/change-room/', {
            'new_room_id': self.room_201.id,
            'reason': 'Hỏng điều hòa',
            'old_room_status': 'maintenance',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        bk.refresh_from_db()
        self.assertEqual(bk.category_id, self.cat_dlx.id)
        inv = Invoice.objects.get(booking=bk)
        self.assertEqual(inv.room_charge, Decimal('2000000'))


from django.test import override_settings
from .models import BookingExtraService, ChatbotInteractionLog, GroupBooking
from .chatbot_views import (
    build_active_stay_details,
    build_hotel_context,
    detect_language,
    extract_guest_count,
)
from ..notifications.models import Notification
from ..services.models import ServiceCategory, ServiceItem, ServiceRequest
from ..users.models import MembershipTier


# Kiểm thử bảo mật, nghiệp vụ và thống kê của Trợ lý AI (Chatbot)
@override_settings(GEMINI_API_KEY='')
class ChatbotSecurityAndLogicTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.tier_gold = MembershipTier.objects.create(
            name='Vàng (Gold)',
            code='GOLD',
            min_points=5000,
            discount_percent=Decimal('12.00'),
            order=2,
        )
        self.guest_a = User.objects.create_user(
            username='cb_guest_a',
            email='cb_a@example.com',
            password='Password123!',
            role='guest',
            phone_number='0901112222',
            current_tier=self.tier_gold,
        )
        self.guest_b = User.objects.create_user(
            username='cb_guest_b',
            email='cb_b@example.com',
            password='Password123!',
            role='guest',
            phone_number='0909998888',
        )
        self.cat_std = RoomCategory.objects.create(
            name='Standard Ocean',
            slug='standard-ocean',
            size=32.0,
            bed_type='1 Giường Đôi',
            capacity=2,
            base_price=Decimal('1000000'),
        )
        self.cat_fam = RoomCategory.objects.create(
            name='Family Suite',
            slug='family-suite',
            size=65.0,
            bed_type='2 Giường King',
            capacity=4,
            base_price=Decimal('2500000'),
        )
        self.room_101 = Room.objects.create(
            room_number='101',
            category=self.cat_std,
            status='occupied',
            floor=1,
        )
        self.today = timezone.localdate()
        self.bk_b = Booking.objects.create(
            guest=self.guest_b,
            category=self.cat_std,
            room=self.room_101,
            check_in_date=self.today,
            check_out_date=self.today + timedelta(days=2),
            total_amount=Decimal('2000000'),
            status='checked_in',
            booking_code='BK-TEST99',
        )

    # Kiểm tra tra cứu đơn trên Chatbot yêu cầu xác thực 2 yếu tố (mã đơn + SĐT), không lộ PII khách khác
    def test_unauthenticated_phone_or_code_alone_does_not_leak_booking_pii(self):
        res_phone = self.client.post('/api/chatbot/ask/', {'message': '0909998888'}, format='json')
        self.assertEqual(res_phone.status_code, 200)
        self.assertEqual(res_phone.data['tracked_bookings'], [])
        self.assertTrue(res_phone.data['lookup_verification_required'])
        self.assertNotIn('cb_guest_b', res_phone.data['reply'])

        res_code = self.client.post('/api/chatbot/ask/', {'message': 'Kiểm tra đơn BK-TEST99'}, format='json')
        self.assertEqual(res_code.status_code, 200)
        self.assertEqual(res_code.data['tracked_bookings'], [])
        self.assertTrue(res_code.data['lookup_verification_required'])

        # Cross-guest IDOR check when logged in as guest_a
        self.client.force_authenticate(user=self.guest_a)
        res_idor = self.client.post('/api/chatbot/ask/', {'message': 'Xem đơn BK-TEST99'}, format='json')
        self.assertEqual(res_idor.status_code, 200)
        self.assertEqual(res_idor.data['tracked_bookings'], [])
        self.assertTrue(res_idor.data['lookup_verification_required'])

        # 2-factor verification (code + phone) succeeds for unauthenticated user
        self.client.force_authenticate(user=None)
        res_2fa = self.client.post('/api/chatbot/ask/', {
            'message': 'Tra cứu BK-TEST99 0909998888'
        }, format='json')
        self.assertEqual(res_2fa.status_code, 200)
        self.assertEqual(len(res_2fa.data['tracked_bookings']), 1)
        self.assertEqual(res_2fa.data['tracked_bookings'][0]['booking_code'], 'BK-TEST99')

    # Kiểm tra tra cứu đơn đặt đoàn (GRP) trên Chatbot hoạt động đúng với xác thực 2 yếu tố
    def test_group_booking_lookup_with_2fa_works(self):
        grp = GroupBooking.objects.create(
            group_code='GRP-889900',
            group_name='Tech Retreat',
            leader_name='Tran Leader',
            leader_phone='0912345678',
            check_in_date=self.today + timedelta(days=3),
            check_out_date=self.today + timedelta(days=5),
            total_amount=Decimal('15000000'),
            status='confirmed',
        )
        res_no_phone = self.client.post('/api/chatbot/ask/', {'message': f'Tra đơn {grp.group_code}'}, format='json')
        self.assertEqual(res_no_phone.data['tracked_bookings'], [])
        self.assertTrue(res_no_phone.data['lookup_verification_required'])

        res_ok = self.client.post('/api/chatbot/ask/', {'message': f'Tra đơn {grp.group_code} 0912345678'}, format='json')
        self.assertEqual(len(res_ok.data['tracked_bookings']), 1)
        self.assertTrue(res_ok.data['tracked_bookings'][0]['is_group'])
        self.assertEqual(res_ok.data['tracked_bookings'][0]['booking_code'], 'GRP-889900')

    # Kiểm tra chặn khách ẩn danh yêu cầu dọn phòng theo số phòng; chỉ chủ đơn đã check-in mới được yêu cầu
    def test_unauthenticated_housekeeping_by_room_number_is_blocked(self):
        before_room_notifs = Notification.objects.filter(notification_type='room').count()
        res_anon = self.client.post('/api/chatbot/ask/', {'message': 'Dọn phòng 101 giúp tôi'}, format='json')
        self.assertEqual(res_anon.status_code, 200)
        self.assertFalse(res_anon.data['housekeeping_triggered'])
        self.room_101.refresh_from_db()
        self.assertFalse(self.room_101.is_cleaning_requested)
        self.assertEqual(Notification.objects.filter(notification_type='room').count(), before_room_notifs)

        # Authenticated owner of checked-in booking CAN trigger housekeeping
        self.client.force_authenticate(user=self.guest_b)
        res_auth = self.client.post('/api/chatbot/ask/', {'message': 'Dọn phòng giúp tôi'}, format='json')
        self.assertEqual(res_auth.status_code, 200)
        self.assertTrue(res_auth.data['housekeeping_triggered'])
        self.room_101.refresh_from_db()
        self.assertTrue(self.room_101.is_cleaning_requested)

    # Kiểm tra hóa đơn tạm tính không cộng trùng dịch vụ đã đồng bộ từ ServiceRequest sang BookingExtraService
    def test_active_stay_folio_does_not_double_count_synced_service_requests(self):
        svc_cat = ServiceCategory.objects.create(name='Dining')
        svc = ServiceItem.objects.create(category=svc_cat, name='Wagyu Steak', price=Decimal('500000'))
        sr = ServiceRequest.objects.create(
            booking=self.bk_b,
            service=svc,
            quantity=1,
            unit_price=Decimal('500000'),
            total_price=Decimal('500000'),
            status='completed',
            is_paid=False,
        )
        # Simulated sync entry created when ServiceRequest completes
        BookingExtraService.objects.create(
            booking=self.bk_b,
            service_name=f'Wagyu Steak [Yêu cầu #{sr.id}]',
            quantity=1,
            price=Decimal('500000'),
            is_paid=False,
        )
        # Additional manual extra service (Minibar)
        BookingExtraService.objects.create(
            booking=self.bk_b,
            service_name='[Minibar] Nước suối',
            quantity=2,
            price=Decimal('50000'),
            is_paid=False,
        )

        stay = build_active_stay_details(self.bk_b, lang='vi')
        self.assertEqual(stay['room_total'], 2000000)
        self.assertEqual(stay['service_total'], 500000)
        self.assertEqual(stay['extra_total'], 100000)
        self.assertEqual(stay['grand_total'], 2600000)

    # Kiểm tra nhận diện hạng thành viên, số lượng khách, ngôn ngữ và gợi ý đúng hạng phòng phù hợp
    def test_dynamic_tier_guest_count_and_language_detection(self):
        self.client.force_authenticate(user=self.guest_a)
        ctx = build_hotel_context(
            type('Req', (), {'user': self.guest_a, 'build_absolute_uri': lambda self, u: u})(),
            guest_count=4,
        )
        self.assertEqual(ctx['user_context']['discount_rate'], '12%')
        self.assertTrue(any(t['code'] == 'GOLD' and t['discount'] == '12%' for t in ctx['membership_tiers']))

        self.assertEqual(extract_guest_count('Tìm phòng cho 4 người lớn cuối tuần'), 4)
        self.assertEqual(detect_language('Yes, please help me'), 'en')
        self.assertEqual(detect_language('BK-TEST99', preferred_lang='en'), 'en')

        res = self.client.post('/api/chatbot/ask/', {'message': 'Phòng cho 4 người ngày mai'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.data['suggested_rooms']), 1)
        self.assertEqual(res.data['suggested_rooms'][0]['id'], self.cat_fam.id)

    # Kiểm tra Chatbot kiểm định mã khuyến mãi (còn hạn, hết hạn và mã mặc định WELCOME10)
    def test_promo_code_context_validation_handles_active_expired_and_default(self):
        now = timezone.now()
        Promotion.objects.create(
            code='EXP2025',
            name='Old Promo',
            discount_type='percentage',
            discount_value=Decimal('20'),
            valid_from=now - timedelta(days=30),
            valid_to=now - timedelta(days=1),
            is_active=True,
        )
        Promotion.objects.create(
            code='VIP500K',
            name='VIP Fixed',
            discount_type='fixed',
            discount_value=Decimal('500000'),
            valid_from=now - timedelta(days=1),
            valid_to=now + timedelta(days=10),
            is_active=True,
        )

        res_exp = self.client.post('/api/chatbot/ask/', {'message': 'Mã EXP2025 còn dùng được không?'}, format='json')
        self.assertEqual(res_exp.status_code, 200)
        self.assertIn('EXP2025', res_exp.data['reply'])
        self.assertIn('hết hạn', res_exp.data['reply'])

        res_valid = self.client.post('/api/chatbot/ask/', {'message': 'Kiểm tra mã VIP500K giúp tôi'}, format='json')
        self.assertEqual(res_valid.status_code, 200)
        self.assertIn('VIP500K', res_valid.data['reply'])
        self.assertIn('HỢP LỆ', res_valid.data['reply'])

        res_default = self.client.post('/api/chatbot/ask/', {'message': 'Check promo WELCOME10'}, format='json')
        self.assertEqual(res_default.status_code, 200)
        self.assertIn('WELCOME10', res_default.data['reply'])
        self.assertIn('VALID', res_default.data['reply'])

    # Kiểm tra báo hỏng thiết bị qua Chatbot yêu cầu đăng nhập và tạo phiếu bảo trì kèm thông báo cho kỹ thuật viên
    def test_maintenance_reporting_requires_auth_and_creates_ticket_when_verified(self):
        tech = User.objects.create_user(username='tech1', email='tech1@example.com', password='Password123!', role='technician')
        res_anon = self.client.post('/api/chatbot/ask/', {'message': 'Điều hòa phòng 101 bị hỏng không lạnh'}, format='json')
        self.assertEqual(res_anon.status_code, 200)
        self.assertIsNone(res_anon.data['maintenance_ticket'])
        self.assertEqual(MaintenanceTicket.objects.count(), 0)

        self.client.force_authenticate(user=self.guest_b)
        res_auth = self.client.post('/api/chatbot/ask/', {'message': 'Điều hòa phòng tôi bị hỏng không lạnh'}, format='json')
        self.assertEqual(res_auth.status_code, 200)
        self.assertIsNotNone(res_auth.data['maintenance_ticket'])
        self.assertEqual(MaintenanceTicket.objects.count(), 1)
        ticket = MaintenanceTicket.objects.first()
        self.assertEqual(ticket.issue_type, 'ac')
        self.assertEqual(ticket.room_id, self.room_101.id)
        self.assertEqual(ticket.booking_id, self.bk_b.id)
        self.assertTrue(Notification.objects.filter(recipient=tech, notification_type='room').exists())

    # Kiểm tra đặt dịch vụ 2 bước xác nhận (chống IDOR) và chuyển tiếp yêu cầu gặp lễ tân qua Chatbot
    def test_two_tap_service_order_and_human_handoff_confirm_endpoints(self):
        svc_cat = ServiceCategory.objects.create(name='Dining')
        svc = ServiceItem.objects.create(category=svc_cat, name='Cà Phê Sữa Đá', price=Decimal('80000'), is_active=True)

        self.client.force_authenticate(user=self.guest_b)
        res_ask = self.client.post('/api/chatbot/ask/', {'message': 'Đặt 2 Cà Phê Sữa Đá lên phòng giúp tôi'}, format='json')
        self.assertEqual(res_ask.status_code, 200)
        pending = res_ask.data.get('pending_action')
        self.assertIsNotNone(pending)
        self.assertEqual(pending['type'], 'create_service_request')
        self.assertEqual(pending['quantity'], 2)
        self.assertEqual(ServiceRequest.objects.count(), 0)  # Must wait for user tap

        # Guest A cannot confirm Guest B's booking action
        self.client.force_authenticate(user=self.guest_a)
        res_idor = self.client.post('/api/chatbot/confirm-action/', {
            'action_type': 'create_service_request',
            'booking_id': pending['booking_id'],
            'service_id': pending['service_id'],
            'quantity': 2,
        }, format='json')
        self.assertEqual(res_idor.status_code, 403)

        # Guest B confirms -> creates ServiceRequest
        self.client.force_authenticate(user=self.guest_b)
        res_ok = self.client.post('/api/chatbot/confirm-action/', {
            'action_type': 'create_service_request',
            'booking_id': pending['booking_id'],
            'service_id': pending['service_id'],
            'quantity': 2,
            'note': 'Ít đường',
        }, format='json')
        self.assertEqual(res_ok.status_code, 201)
        self.assertEqual(ServiceRequest.objects.count(), 1)
        self.assertEqual(ServiceRequest.objects.first().total_price, Decimal('160000'))

        # Human handoff intent & confirmation
        res_handoff = self.client.post('/api/chatbot/ask/', {'message': 'Tôi muốn gặp nhân viên lễ tân'}, format='json')
        self.assertEqual(res_handoff.status_code, 200)
        self.assertEqual(res_handoff.data['pending_action']['type'], 'human_handoff')

        res_contact = self.client.post('/api/chatbot/confirm-action/', {
            'action_type': 'human_handoff',
            'message': 'Cần hỗ trợ check-in đoàn sớm',
        }, format='json')
        self.assertEqual(res_contact.status_code, 201)
        self.assertEqual(ContactMessage.objects.count(), 1)

    # Kiểm tra phản hồi ngoại tuyến tiếng Hàn/Trung và cơ chế fallback sang model Gemini dự phòng khi lỗi 404
    def test_korean_and_chinese_offline_fallback_and_gemini_http_mock(self):
        res_ko = self.client.post('/api/chatbot/ask/', {'message': '취소 및 환불 규정 알려주세요', 'lang': 'ko'}, format='json')
        self.assertEqual(res_ko.status_code, 200)
        self.assertIn('무료 취소', res_ko.data['reply'])

        res_zh = self.client.post('/api/chatbot/ask/', {'message': '有哪些优惠码和折扣', 'lang': 'zh'}, format='json')
        self.assertEqual(res_zh.status_code, 200)
        self.assertIn('会员', res_zh.data['reply'])

        mock_404 = MagicMock(status_code=404, text='Not found')
        mock_200 = MagicMock(status_code=200)
        mock_200.json.return_value = {'candidates': [{'content': {'parts': [{'text': 'Hello from Gemini 2.0 fallback!'}]}}]}

        with override_settings(GEMINI_API_KEY='fake-key-for-unit-test'):
            with patch('apps.bookings.chatbot_views.views.requests.post', side_effect=[mock_404, mock_200]) as mocked_post:
                res_ai = self.client.post('/api/chatbot/ask/', {'message': 'Xin chào'}, format='json')
                self.assertEqual(res_ai.status_code, 200)
                self.assertEqual(res_ai.data['source'], 'gemini_ai_fallback_model')
                self.assertEqual(res_ai.data['reply'], 'Hello from Gemini 2.0 fallback!')
                self.assertEqual(mocked_post.call_count, 2)

    # Kiểm tra giới hạn tần suất (rate limit) cho khách ẩn danh trên Chatbot trả về mã 429
    def test_chatbot_anon_rate_limit_returns_429(self):
        self.client.force_authenticate(user=None)
        cache.clear()
        with patch('apps.bookings.chatbot_views.views.ChatbotAnonThrottle.get_rate', return_value='2/minute'):
            r1 = self.client.post('/api/chatbot/ask/', {'message': 'Xin chào 1'}, format='json')
            r2 = self.client.post('/api/chatbot/ask/', {'message': 'Xin chào 2'}, format='json')
            r3 = self.client.post('/api/chatbot/ask/', {'message': 'Xin chào 3'}, format='json')
            self.assertEqual(r1.status_code, 200)
            self.assertEqual(r2.status_code, 200)
            self.assertEqual(r3.status_code, 429)

    # Kiểm tra câu hỏi tham khảo thông tin (hỏi giá, giờ dọn, liên hệ) không tự ý ghi thay đổi vào CSDL
    def test_informational_questions_do_not_trigger_inhouse_db_mutations(self):
        svc_cat = ServiceCategory.objects.create(name='Drinks')
        ServiceItem.objects.create(category=svc_cat, name='Cà Phê Sữa Đá', price=Decimal('80000'), is_active=True)

        self.client.force_authenticate(user=self.guest_b)
        res_maint = self.client.post('/api/chatbot/ask/', {
            'message': 'Nếu điều hòa phòng bị hỏng thì liên hệ ai?'
        }, format='json')
        self.assertEqual(res_maint.status_code, 200)
        self.assertIsNone(res_maint.data['maintenance_ticket'])
        self.assertEqual(MaintenanceTicket.objects.count(), 0)

        res_clean = self.client.post('/api/chatbot/ask/', {
            'message': 'Mấy giờ nhân viên dọn phòng và có mất phí không?'
        }, format='json')
        self.assertEqual(res_clean.status_code, 200)
        self.assertFalse(res_clean.data['housekeeping_triggered'])
        self.room_101.refresh_from_db()
        self.assertFalse(self.room_101.is_cleaning_requested)

        res_price = self.client.post('/api/chatbot/ask/', {
            'message': 'Đặt Cà Phê Sữa Đá giá bao nhiêu?'
        }, format='json')
        self.assertEqual(res_price.status_code, 200)
        self.assertIsNone(res_price.data['pending_action'])

    # Kiểm tra ghi nhớ xác thực 2FA nhiều lượt hội thoại, chuẩn hóa SĐT +84 và đính kèm trích đoạn hội thoại khi gặp lễ tân
    def test_guest_2fa_multi_turn_memory_intl_phone_and_handoff_excerpt(self):
        svc_cat = ServiceCategory.objects.create(name='Drinks')
        ServiceItem.objects.create(category=svc_cat, name='Cà Phê Sữa Đá', price=Decimal('80000'), is_active=True)

        self.client.force_authenticate(user=None)
        # +84 phone format in turn 1
        res_1 = self.client.post('/api/chatbot/ask/', {
            'message': 'Tra cứu BK-TEST99 +84 909 998 888'
        }, format='json')
        self.assertEqual(res_1.status_code, 200)
        self.assertEqual(len(res_1.data['tracked_bookings']), 1)
        self.assertIsNotNone(res_1.data['active_stay'])

        history = [
            {'role': 'user', 'text': 'Tra cứu BK-TEST99 +84 909 998 888'},
            {'role': 'model', 'text': res_1.data['reply']},
        ]

        # Turn 2 follow-up bill query without repeating code/phone
        res_2 = self.client.post('/api/chatbot/ask/', {
            'message': 'Hóa đơn tạm tính của phòng tôi?',
            'history': history,
        }, format='json')
        self.assertEqual(res_2.status_code, 200)
        self.assertEqual(len(res_2.data['tracked_bookings']), 1)
        self.assertIn('2.000.000', res_2.data['reply'])

        # Turn 3 service order & 2FA confirm using verified_phone
        res_3 = self.client.post('/api/chatbot/ask/', {
            'message': 'Đặt 2 Cà Phê Sữa Đá lên phòng 101',
            'history': history,
        }, format='json')
        self.assertEqual(res_3.status_code, 200)
        pending = res_3.data['pending_action']
        self.assertIsNotNone(pending)
        self.assertEqual(pending['quantity'], 2)
        self.assertTrue(pending.get('verified_phone'))

        res_confirm = self.client.post('/api/chatbot/confirm-action/', {
            'action_type': 'create_service_request',
            'booking_id': pending['booking_id'],
            'booking_code': pending['booking_code'],
            'phone_number': pending['verified_phone'],
            'service_id': pending['service_id'],
            'quantity': pending['quantity'],
        }, format='json')
        self.assertEqual(res_confirm.status_code, 201)
        self.assertEqual(ServiceRequest.objects.count(), 1)

        # Handoff with conversation_excerpt
        res_handoff = self.client.post('/api/chatbot/confirm-action/', {
            'action_type': 'human_handoff',
            'name': 'Guest B',
            'email': 'guestb@example.com',
            'message': 'Cần gặp lễ tân',
            'conversation_excerpt': history,
        }, format='json')
        self.assertEqual(res_handoff.status_code, 201)
        cm = ContactMessage.objects.latest('id')
        self.assertIn('Ngữ cảnh hội thoại AI trước đó', cm.message)
        self.assertIn('BK-TEST99', cm.message)

    # Kiểm tra tra cứu đồ thất lạc qua Chatbot chống dò tìm ẩn danh và gửi cảnh báo cho buồng phòng khi chính chủ hỏi
    def test_lost_and_found_lookup_and_alert_security(self):
        hk = User.objects.create_user(username='hk1', email='hk1@example.com', password='Password123!', role='housekeeper')
        lf_item = LostAndFoundItem.objects.create(
            room=self.room_101,
            booking=self.bk_b,
            location_found='Phòng 101',
            item_name='Sạc dự phòng Anker',
            category='electronics',
            storage_location='Két an toàn Lễ tân',
            status='stored',
        )

        # Anonymous user cannot probe room 101 lost items
        self.client.force_authenticate(user=None)
        res_anon = self.client.post('/api/chatbot/ask/', {
            'message': 'Tôi để quên sạc dự phòng ở phòng 101'
        }, format='json')
        self.assertEqual(res_anon.status_code, 200)
        self.assertIsNone(res_anon.data['lost_found_info'])
        self.assertFalse(Notification.objects.filter(recipient=hk, action_url='/admin/lost-and-found').exists())

        # Authenticated booking owner gets item tracking code & notifies housekeeping
        self.client.force_authenticate(user=self.guest_b)
        res_auth = self.client.post('/api/chatbot/ask/', {
            'message': 'Tôi để quên sạc dự phòng ở phòng'
        }, format='json')
        self.assertEqual(res_auth.status_code, 200)
        lf_info = res_auth.data['lost_found_info']
        self.assertIsNotNone(lf_info)
        self.assertEqual(len(lf_info['matched_items']), 1)
        self.assertEqual(lf_info['matched_items'][0]['tracking_code'], lf_item.tracking_code)
        self.assertIn(lf_item.tracking_code, res_auth.data['reply'])
        self.assertTrue(Notification.objects.filter(recipient=hk, action_url='/admin/lost-and-found').exists())

    # Kiểm tra tính điều kiện hủy phòng thời gian thực (miễn phí >48h, sát giờ <48h, và chặn hủy khi đã check-in)
    def test_real_time_booking_cancellation_eligibility(self):
        # Free cancel (> 48h before check-in)
        bk_far = Booking.objects.create(
            guest=self.guest_a,
            category=self.cat_fam,
            check_in_date=self.today + timedelta(days=5),
            check_out_date=self.today + timedelta(days=7),
            total_amount=Decimal('5000000'),
            status='confirmed',
            booking_code='BK-FAR999',
        )
        self.client.force_authenticate(user=self.guest_a)
        res_far = self.client.post('/api/chatbot/ask/', {
            'message': f'Đơn {bk_far.booking_code} hủy bây giờ có mất phí không?'
        }, format='json')
        self.assertEqual(res_far.status_code, 200)
        ce_far = res_far.data['cancel_eligibility']
        self.assertIsNotNone(ce_far)
        self.assertTrue(ce_far['can_cancel'])
        self.assertTrue(ce_far['is_free_cancel_eligible'])
        self.assertIn('MIỄN PHÍ', res_far.data['reply'])

        # Late cancel (< 48h before check-in)
        bk_near = Booking.objects.create(
            guest=self.guest_a,
            category=self.cat_std,
            check_in_date=self.today + timedelta(days=1),
            check_out_date=self.today + timedelta(days=2),
            total_amount=Decimal('1000000'),
            status='confirmed',
            booking_code='BK-NEAR11',
        )
        res_near = self.client.post('/api/chatbot/ask/', {
            'message': f'Hủy đơn {bk_near.booking_code} có được hoàn tiền không?'
        }, format='json')
        self.assertEqual(res_near.status_code, 200)
        ce_near = res_near.data['cancel_eligibility']
        self.assertTrue(ce_near['can_cancel'])
        self.assertFalse(ce_near['is_free_cancel_eligible'])

        # Checked-in booking cannot cancel online
        self.client.force_authenticate(user=self.guest_b)
        res_in = self.client.post('/api/chatbot/ask/', {
            'message': f'Tôi muốn hủy đơn {self.bk_b.booking_code}'
        }, format='json')
        self.assertEqual(res_in.status_code, 200)
        self.assertFalse(res_in.data['cancel_eligibility']['can_cancel'])
        self.assertEqual(res_in.data['cancel_eligibility']['reason'], 'already_checked_in')

    # Kiểm tra ước tính giá phòng tự động áp dụng đồng thời ưu đãi hạng thành viên và mã giảm giá
    def test_booking_price_estimator_with_tier_and_promo(self):
        now = timezone.now()
        Promotion.objects.create(
            code='VIP500K',
            name='VIP Fixed',
            discount_type='fixed',
            discount_value=Decimal('500000'),
            valid_from=now - timedelta(days=1),
            valid_to=now + timedelta(days=10),
            is_active=True,
        )
        # guest_a has Gold tier (12%)
        self.client.force_authenticate(user=self.guest_a)
        res = self.client.post('/api/chatbot/ask/', {
            'message': 'Tính tiền phòng Family Suite 2 đêm ngày mai áp mã VIP500K hết bao nhiêu?'
        }, format='json')
        self.assertEqual(res.status_code, 200)
        pe = res.data['price_estimate']
        self.assertIsNotNone(pe)
        self.assertEqual(pe['nights'], 2)
        self.assertEqual(pe['subtotal'], 5000000)
        self.assertEqual(pe['membership_discount'], 600000)
        self.assertEqual(pe['promo_discount'], 500000)
        self.assertEqual(pe['final_total'], 3900000)
        self.assertIn('3.900.000', res.data['reply'])

    # Kiểm tra ghi nhật ký tương tác Chatbot (che SĐT) và đồng bộ thống kê vào API báo cáo cho Admin
    def test_chatbot_interaction_logging_and_reports_analytics(self):
        self.client.force_authenticate(user=None)
        self.client.post('/api/chatbot/ask/', {
            'message': 'Tra cứu BK-TEST99 0909998888'
        }, format='json')
        self.client.post('/api/chatbot/ask/', {
            'message': 'What rooms are available tomorrow?'
        }, format='json')
        self.client.force_authenticate(user=self.guest_b)
        self.client.post('/api/chatbot/ask/', {
            'message': 'Dọn phòng giúp tôi'
        }, format='json')

        self.assertEqual(ChatbotInteractionLog.objects.count(), 3)
        masked_log = ChatbotInteractionLog.objects.filter(intent_category='booking_lookup').first()
        self.assertIsNotNone(masked_log)
        self.assertNotIn('0909998888', masked_log.user_message)
        self.assertIn('[SĐT]', masked_log.user_message)

        # Guest cannot view /api/reports/
        res_guest = self.client.get('/api/reports/?filter=month')
        self.assertEqual(res_guest.status_code, 403)

        # Admin gets chatbot_analytics summary, intents, languages, and recent_logs
        admin_user = User.objects.create_user(
            username='cb_admin',
            email='cb_admin@example.com',
            password='Password123!',
            role='admin',
            is_superuser=True,
        )
        self.client.force_authenticate(user=admin_user)
        res_rep = self.client.get('/api/reports/?filter=month')
        self.assertEqual(res_rep.status_code, 200)
        cb = res_rep.data.get('chatbot_analytics')
        self.assertIsNotNone(cb)
        self.assertEqual(cb['summary']['total_interactions'], 3)
        self.assertEqual(cb['summary']['inhouse_actions_count'], 1)
        self.assertTrue(any(l['code'] == 'en' for l in cb['language_breakdown']))
        self.assertEqual(len(cb['recent_logs']), 3)

    # Kiểm tra đồng bộ thành phần/thời lượng dịch vụ, API trạng thái lưu trú, xác nhận đa ngôn ngữ và đánh giá hữu ích Chatbot
    def test_service_ingredients_duration_status_feedback_and_multilingual_confirm(self):
        # 1. ServiceItem ingredients & duration synced into context & offline detail response
        svc_cat = ServiceCategory.objects.create(name='Ocean Spa & Wellness')
        svc_item = ServiceItem.objects.create(
            category=svc_cat,
            name='Massage Đá Nóng Thảo Mộc',
            description='Liệu trình thư giãn toàn thân chuyên sâu',
            duration='60 phút',
            ingredients='Tinh dầu sả chanh, đá nóng bazan, trà thảo mộc',
            price=Decimal('650000'),
            is_active=True,
        )

        self.client.force_authenticate(user=None)
        res_svc = self.client.post('/api/chatbot/ask/', {
            'message': f'{svc_item.name} có thành phần gì và làm trong bao lâu?'
        }, format='json')
        self.assertEqual(res_svc.status_code, 200)
        self.assertIsNotNone(res_svc.data.get('interaction_id'))
        self.assertIn('60 phút', res_svc.data['reply'])
        self.assertIn('Tinh dầu sả chanh', res_svc.data['reply'])

        # 2. GET /api/chatbot/status/ returns active_stay immediately for checked-in user
        res_anon_status = self.client.get('/api/chatbot/status/')
        self.assertEqual(res_anon_status.status_code, 200)
        self.assertIsNone(res_anon_status.data.get('active_stay'))

        self.client.force_authenticate(user=self.guest_b)
        res_auth_status = self.client.get('/api/chatbot/status/?lang=en')
        self.assertEqual(res_auth_status.status_code, 200)
        self.assertIsNotNone(res_auth_status.data.get('active_stay'))
        self.assertEqual(res_auth_status.data['active_stay']['room_number'], self.room_101.room_number)

        # 3. Multilingual confirm-action (EN) with custom qty & note
        res_confirm_en = self.client.post('/api/chatbot/confirm-action/', {
            'action_type': 'create_service_request',
            'lang': 'en',
            'booking_id': self.bk_b.id,
            'service_id': svc_item.id,
            'quantity': 3,
            'note': 'Deliver at 19:00 please',
        }, format='json')
        self.assertEqual(res_confirm_en.status_code, 201)
        self.assertEqual(res_confirm_en.data['quantity'], 3)
        self.assertEqual(res_confirm_en.data['detected_lang'], 'en')
        self.assertIn('Confirmed 3x', res_confirm_en.data['message'])

        # 4. Feedback endpoint (👍 / 👎) with ownership check + Reports analytics
        res_ask_auth = self.client.post('/api/chatbot/ask/', {
            'message': 'What is my current provisional bill?'
        }, format='json')
        auth_log_id = res_ask_auth.data['interaction_id']
        self.assertIsNotNone(auth_log_id)

        # Other user cannot rate guest_b's log
        self.client.force_authenticate(user=self.guest_a)
        res_fb_forbidden = self.client.post('/api/chatbot/feedback/', {
            'interaction_id': auth_log_id,
            'feedback': 'unhelpful',
        }, format='json')
        self.assertEqual(res_fb_forbidden.status_code, 403)

        # Owner rates helpful
        self.client.force_authenticate(user=self.guest_b)
        res_fb_ok = self.client.post('/api/chatbot/feedback/', {
            'interaction_id': auth_log_id,
            'feedback': 'helpful',
        }, format='json')
        self.assertEqual(res_fb_ok.status_code, 200)
        self.assertEqual(res_fb_ok.data['feedback'], 'helpful')

        # Anonymous guest rates anonymous interaction unhelpful
        self.client.force_authenticate(user=None)
        res_fb_anon = self.client.post('/api/chatbot/feedback/', {
            'interaction_id': res_svc.data['interaction_id'],
            'feedback': 'unhelpful',
        }, format='json')
        self.assertEqual(res_fb_anon.status_code, 200)

        # Admin Analytics reflects 50% satisfaction (1 helpful / 2 total)
        admin_user = User.objects.create_user(
            username='cb_admin_fb',
            email='cb_admin_fb@example.com',
            password='Password123!',
            role='admin',
            is_superuser=True,
        )
        self.client.force_authenticate(user=admin_user)
        res_rep = self.client.get('/api/reports/?filter=month')
        self.assertEqual(res_rep.status_code, 200)
        cb_sum = res_rep.data['chatbot_analytics']['summary']
        self.assertEqual(cb_sum['helpful_count'], 1)
        self.assertEqual(cb_sum['unhelpful_count'], 1)
        self.assertEqual(cb_sum['feedback_total'], 2)
        self.assertEqual(cb_sum['satisfaction_rate'], 50.0)


# Kiểm thử nghiệp vụ hủy đơn đặt đoàn (Group Booking) và yêu cầu hoàn cọc
class GroupBookingCancellationTests(APITestCase):
    def setUp(self):
        self.leader = User.objects.create_user(
            username='group_leader',
            email='leader@example.com',
            password='Password123!',
            phone_number='0905556666',
            role='guest',
        )
        self.other_guest = User.objects.create_user(
            username='other_guest',
            email='other@example.com',
            password='Password123!',
            phone_number='0907778888',
            role='guest',
        )
        self.receptionist = User.objects.create_user(
            username='grp_rec',
            email='grprec@example.com',
            password='Password123!',
            role='receptionist',
        )
        self.cat_std = RoomCategory.objects.create(
            name='Standard Group',
            slug='standard-group',
            size=30.0,
            bed_type='1 Giường Đôi',
            capacity=2,
            base_price=Decimal('1000000'),
        )
        self.today = timezone.localdate()

    def _create_group_with_subs(self, *, is_deposit_paid=False, status='tentative', days_until=5, count=2):
        c_in = self.today + timedelta(days=days_until)
        c_out = c_in + timedelta(days=2)
        group = GroupBooking.objects.create(
            group_name='Đoàn Test',
            leader_name='Nguyen Leader',
            leader_phone='0905556666',
            leader_email='leader@example.com',
            check_in_date=c_in,
            check_out_date=c_out,
            total_amount=Decimal('4000000'),
            deposit_amount=Decimal('2000000'),
            is_deposit_paid=is_deposit_paid,
            status=status,
        )
        sub_status = 'confirmed' if is_deposit_paid else 'pending'
        subs = []
        for _ in range(count):
            subs.append(
                Booking.objects.create(
                    guest=self.leader,
                    category=self.cat_std,
                    group_booking=group,
                    is_master_billed=True,
                    check_in_date=c_in,
                    check_out_date=c_out,
                    total_amount=Decimal('2000000'),
                    status=sub_status,
                )
            )
        return group, subs

    # Kiểm tra trưởng đoàn được hủy trực tiếp đơn đoàn chưa đặt cọc (tentative) và hủy toàn bộ phòng con
    def test_tentative_group_can_be_cancelled_directly_by_leader(self):
        group, subs = self._create_group_with_subs(is_deposit_paid=False, status='tentative', days_until=5)
        self.client.force_authenticate(user=self.leader)
        res = self.client.post(f'/api/bookings/groups/{group.id}/cancel/', {'reason': 'Đổi lịch'}, format='json')
        self.assertEqual(res.status_code, 200)
        group.refresh_from_db()
        self.assertEqual(group.status, 'cancelled')
        for s in subs:
            s.refresh_from_db()
            self.assertEqual(s.status, 'cancelled')

    # Kiểm tra đơn đoàn đã cọc chặn hủy thẳng/lách phòng con, cho gửi yêu cầu hoàn cọc và chờ nhân viên duyệt
    def test_deposited_group_blocks_direct_and_single_subbooking_bypass_but_allows_request_cancel(self):
        group, subs = self._create_group_with_subs(is_deposit_paid=True, status='confirmed', days_until=5)

        # Other guest cannot request cancel (IDOR protection)
        self.client.force_authenticate(user=self.other_guest)
        res_idor = self.client.post(f'/api/bookings/groups/{group.id}/request-cancel/', {'reason': 'Test'}, format='json')
        self.assertEqual(res_idor.status_code, 403)

        # Leader cannot bypass via direct group cancel, cancel-booking, or PATCH
        self.client.force_authenticate(user=self.leader)
        res_direct = self.client.post(f'/api/bookings/groups/{group.id}/cancel/', {'reason': 'Hủy thẳng'}, format='json')
        self.assertEqual(res_direct.status_code, 403)

        res_single = self.client.post('/api/bookings/cancel-booking/', {'booking_id': subs[0].id, 'reason': 'Lách'}, format='json')
        self.assertEqual(res_single.status_code, 403)

        res_patch = self.client.patch(f'/api/bookings/{subs[0].id}/', {'status': 'cancelled'}, format='json')
        self.assertEqual(res_patch.status_code, 403)

        # Leader CAN submit a cancellation & refund request (>= 48h -> eligible)
        res_req = self.client.post(
            f'/api/bookings/groups/{group.id}/request-cancel/',
            {
                'reason': 'Hoãn chuyến công tác',
                'refund_bank_name': 'MB Bank',
                'refund_account_number': '0123456789',
                'refund_account_holder': 'NGUYEN LEADER',
            },
            format='json',
        )
        self.assertEqual(res_req.status_code, 200)
        self.assertTrue(res_req.data['success'])
        self.assertEqual(res_req.data['cancel_request']['status'], 'pending')
        self.assertTrue(res_req.data['cancel_request']['is_free_cancel_eligible'])

        # Group remains confirmed (rooms still held) until staff approves
        group.refresh_from_db()
        self.assertEqual(group.status, 'confirmed')

        # Notifications created for both leader and receptionist
        self.assertTrue(Notification.objects.filter(recipient=self.receptionist, notification_type='group_booking').exists())
        self.assertTrue(Notification.objects.filter(recipient=self.leader, notification_type='group_booking').exists())

        # Booking list API exposes group_cancel_request & group_cancel_policy
        res_list = self.client.get('/api/bookings/')
        self.assertEqual(res_list.status_code, 200)
        items = res_list.data.get('results', res_list.data)
        self.assertEqual(items[0]['group_cancel_request']['status'], 'pending')
        self.assertTrue(items[0]['group_cancel_policy']['is_free_cancel_eligible'])

        # Staff approves cancellation -> group & subs become cancelled, request marked approved
        self.client.force_authenticate(user=self.receptionist)
        res_approve = self.client.post(f'/api/bookings/groups/{group.id}/cancel/', {'reason': 'Duyệt hoàn cọc'}, format='json')
        self.assertEqual(res_approve.status_code, 200)
        self.assertEqual(res_approve.data['group_booking']['status'], 'cancelled')
        self.assertEqual(res_approve.data['group_booking']['cancel_request']['status'], 'approved')

    # Kiểm tra đơn đoàn đã cọc hủy sát giờ nhận phòng (<48h) bị đánh dấu không đủ điều kiện hoàn miễn phí
    def test_deposited_group_near_checkin_marks_not_free_cancel_eligible(self):
        group, _ = self._create_group_with_subs(is_deposit_paid=True, status='confirmed', days_until=1)
        self.client.force_authenticate(user=self.leader)
        res_req = self.client.post(
            f'/api/bookings/groups/{group.id}/request-cancel/',
            {'reason': 'Hủy sát giờ'},
            format='json',
        )
        self.assertEqual(res_req.status_code, 200)
        self.assertFalse(res_req.data['cancel_request']['is_free_cancel_eligible'])


