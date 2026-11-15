import os
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from ..bookings.models import Booking
from ..rooms.models import RoomCategory
from .models import Invoice, CashOutVoucher

User = get_user_model()


class SepayWebhookSecurityTests(APITestCase):
    def setUp(self):
        self.guest = User.objects.create_user(
            username='webhook_guest',
            email='wh@example.com',
            password='Password123!',
            role='guest',
        )
        self.cat = RoomCategory.objects.create(
            name='Webhook Cat',
            slug='webhook-cat',
            size=30.0,
            bed_type='Queen',
            capacity=2,
            base_price=Decimal('1000000'),
        )
        today = timezone.localdate()
        self.booking = Booking.objects.create(
            guest=self.guest,
            category=self.cat,
            check_in_date=today + timedelta(days=1),
            check_out_date=today + timedelta(days=2),
            total_amount=Decimal('1000000'),
            status='pending',
        )

    def test_webhook_rejects_when_secret_not_configured(self):
        with patch.dict(os.environ, {'SEPAY_WEBHOOK_SECRET': ''}):
            res = self.client.post('/api/payments/webhook/sepay/', {
                'transferType': 'in',
                'content': self.booking.booking_code,
                'transferAmount': 1000000,
                'id': 999001,
            }, format='json')
        self.assertEqual(res.status_code, 503)

    def test_webhook_rejects_wrong_api_key(self):
        with patch.dict(os.environ, {'SEPAY_WEBHOOK_SECRET': 'super-secret-123'}):
            res = self.client.post(
                '/api/payments/webhook/sepay/',
                {
                    'transferType': 'in',
                    'content': self.booking.booking_code,
                    'transferAmount': 1000000,
                    'id': 999002,
                },
                format='json',
                HTTP_AUTHORIZATION='Apikey wrong-key',
            )
        self.assertEqual(res.status_code, 401)

    def test_webhook_does_not_match_arbitrary_numeric_id(self):
        with patch.dict(os.environ, {'SEPAY_WEBHOOK_SECRET': 'super-secret-123'}):
            res = self.client.post(
                '/api/payments/webhook/sepay/',
                {
                    'transferType': 'in',
                    'content': f'Chuyen tien ca phe {self.booking.id}',
                    'transferAmount': 1000000,
                    'id': 999003,
                },
                format='json',
                HTTP_AUTHORIZATION='Apikey super-secret-123',
            )
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data.get('success'))
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, 'pending')


class RevenueConsistencyTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='rev_admin',
            email='revadmin@example.com',
            password='Password123!',
            role='admin',
            is_superuser=True,
        )
        self.guest = User.objects.create_user(
            username='rev_guest',
            email='revguest@example.com',
            password='Password123!',
            role='guest',
        )
        self.cat = RoomCategory.objects.create(
            name='Rev Cat',
            slug='rev-cat',
            size=30.0,
            bed_type='Queen',
            capacity=2,
            base_price=Decimal('1000000'),
        )
        today = timezone.localdate()
        self.booking_paid = Booking.objects.create(
            guest=self.guest,
            category=self.cat,
            check_in_date=today - timedelta(days=2),
            check_out_date=today,
            total_amount=Decimal('2000000'),
            status='completed',
        )
        # Paid invoice with 180k discount: 2,000,000 + 300,000 - 180,000 = 2,120,000
        Invoice.objects.create(
            booking=self.booking_paid,
            room_charge=Decimal('2000000'),
            service_charge=Decimal('300000'),
            discount=Decimal('180000'),
            total_amount=Decimal('2120000'),
            status='paid',
            paid_at=timezone.now(),
        )
        # Orphan completed booking without invoice (should not diverge dashboard vs reports)
        Booking.objects.create(
            guest=self.guest,
            category=self.cat,
            check_in_date=today - timedelta(days=3),
            check_out_date=today - timedelta(days=1),
            total_amount=Decimal('500000'),
            status='completed',
        )
        # Refund deposit voucher reduces net revenue by 120,000 -> expected 2,000,000
        CashOutVoucher.objects.create(
            voucher_type='REFUND_DEPOSIT',
            payment_method='CASH',
            amount=Decimal('120000'),
            recipient_name='Guest',
            reason='Refund excess deposit',
        )
        # Petty cash does not subtract from customer invoice revenue
        CashOutVoucher.objects.create(
            voucher_type='PETTY_CASH',
            payment_method='CASH',
            amount=Decimal('50000'),
            recipient_name='Staff',
            reason='Buy ice',
        )

    def test_dashboard_and_reports_net_revenue_match_exactly(self):
        self.client.force_authenticate(user=self.admin)
        dash_res = self.client.get('/api/bookings/dashboard-stats/?time_filter=year')
        rep_res = self.client.get('/api/reports/?filter=year')

        self.assertEqual(dash_res.status_code, 200)
        self.assertEqual(rep_res.status_code, 200)

        dash_rev = dash_res.data['revenue']
        rep_sum = rep_res.data['summary']

        # 2,120,000 invoice - 120,000 refund = 2,000,000 net revenue
        self.assertEqual(float(dash_rev['total_revenue']), 2000000.0)
        self.assertEqual(float(rep_sum['total_revenue']), 2000000.0)
        self.assertEqual(float(dash_rev['room_revenue']), float(rep_sum['room_revenue']))
        self.assertEqual(float(dash_rev['service_revenue']), float(rep_sum['service_revenue']))
        # Breakdown sums cleanly to total_revenue
        self.assertEqual(
            float(dash_rev['room_revenue']) + float(dash_rev['service_revenue']),
            float(dash_rev['total_revenue']),
        )
