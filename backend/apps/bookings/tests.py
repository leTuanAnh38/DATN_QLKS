from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Booking
from ..payments.models import Invoice
from ..rooms.models import Room, RoomCategory

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
