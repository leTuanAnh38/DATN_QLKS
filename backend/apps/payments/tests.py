import os
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from ..bookings.models import Booking
from ..rooms.models import RoomCategory

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
