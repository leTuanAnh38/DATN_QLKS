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
from ..rooms.models import MaintenanceTicket, Room, RoomCategory

User = get_user_model()


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
from .models import BookingExtraService, GroupBooking
from .chatbot_views import (
    build_active_stay_details,
    build_hotel_context,
    detect_language,
    extract_guest_count,
)
from ..notifications.models import Notification
from ..services.models import ServiceCategory, ServiceItem, ServiceRequest
from ..users.models import MembershipTier


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

