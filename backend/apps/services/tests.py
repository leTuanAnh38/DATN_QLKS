from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import ServiceCategory, ServiceItem, ServiceRequest
from ..bookings.models import Booking
from ..rooms.models import Room, RoomCategory

User = get_user_model()


class ServiceRequestTests(APITestCase):
    def setUp(self):
        self.guest_a = User.objects.create_user(
            username='svc_guest_a',
            email='svc_a@example.com',
            password='Password123!',
            role='guest',
        )
        self.guest_b = User.objects.create_user(
            username='svc_guest_b',
            email='svc_b@example.com',
            password='Password123!',
            role='guest',
        )
        self.service_staff = User.objects.create_user(
            username='svc_staff',
            email='svc_staff@example.com',
            password='Password123!',
            role='service_staff',
        )
        room_cat = RoomCategory.objects.create(
            name='Svc Standard',
            slug='svc-standard',
            size=30.0,
            bed_type='Queen',
            capacity=2,
            base_price=Decimal('1000000'),
        )
        room = Room.objects.create(
            room_number='401',
            category=room_cat,
            status='occupied',
            floor=4,
        )
        today = timezone.localdate()
        self.booking = Booking.objects.create(
            guest=self.guest_a,
            category=room_cat,
            room=room,
            check_in_date=today,
            check_out_date=today + timedelta(days=2),
            total_amount=Decimal('2000000'),
            status='checked_in',
        )
        svc_cat = ServiceCategory.objects.create(name='Ẩm thực')
        self.service_item = ServiceItem.objects.create(
            category=svc_cat,
            name='Phở Bò',
            price=Decimal('120000'),
            is_active=True,
        )

    def test_owner_can_create_service_request_and_other_guest_blocked(self):
        payload = {
            'booking': self.booking.id,
            'service': self.service_item.id,
            'quantity': 2,
        }
        self.client.force_authenticate(user=self.guest_b)
        res_b = self.client.post('/api/service-requests/', payload, format='json')
        self.assertIn(res_b.status_code, [400, 403])

        self.client.force_authenticate(user=self.guest_a)
        res_a = self.client.post('/api/service-requests/', payload, format='json')
        self.assertEqual(res_a.status_code, 201)
        self.assertEqual(ServiceRequest.objects.filter(booking=self.booking).count(), 1)

    def test_service_staff_can_update_service_request_status(self):
        sr = ServiceRequest.objects.create(
            booking=self.booking,
            service=self.service_item,
            quantity=1,
            unit_price=Decimal('120000'),
            status='pending',
        )
        self.client.force_authenticate(user=self.service_staff)
        res = self.client.patch(
            f'/api/service-requests/{sr.id}/',
            {'status': 'in_progress'},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        sr.refresh_from_db()
        self.assertEqual(sr.status, 'in_progress')
