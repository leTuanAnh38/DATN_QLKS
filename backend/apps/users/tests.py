from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .views.role_matrix import check_role_permission

User = get_user_model()


class RBACPermissionTests(APITestCase):
    def setUp(self):
        self.guest = User.objects.create_user(
            username='rbac_guest',
            email='rbac_guest@example.com',
            password='Password123!',
            role='guest',
        )
        self.receptionist = User.objects.create_user(
            username='rbac_rec',
            email='rbac_rec@example.com',
            password='Password123!',
            role='receptionist',
        )
        self.cashier = User.objects.create_user(
            username='rbac_cashier',
            email='rbac_cashier@example.com',
            password='Password123!',
            role='cashier',
        )
        self.manager = User.objects.create_user(
            username='rbac_manager',
            email='rbac_manager@example.com',
            password='Password123!',
            role='manager',
        )

    def test_role_matrix_defaults(self):
        with patch('apps.users.views.role_matrix.load_role_matrix', return_value={}):
            self.assertFalse(check_role_permission(self.guest, 'bookings', 'read'))
            self.assertTrue(check_role_permission(self.receptionist, 'bookings', 'update'))
            self.assertFalse(check_role_permission(self.receptionist, 'bookings', 'delete'))
            self.assertTrue(check_role_permission(self.cashier, 'finance', 'create'))
            self.assertFalse(check_role_permission(self.cashier, 'bookings', 'update'))
            self.assertTrue(check_role_permission(self.manager, 'bookings', 'update'))

    def test_reports_analytics_requires_staff_or_manager(self):
        with patch('apps.users.views.role_matrix.load_role_matrix', return_value={}):
            self.client.force_authenticate(user=self.guest)
            res_guest = self.client.get('/api/reports/')
            self.assertEqual(res_guest.status_code, 403)

            self.client.force_authenticate(user=self.manager)
            res_mgr = self.client.get('/api/reports/')
            self.assertEqual(res_mgr.status_code, 200)

    def test_promotions_create_restricted_to_manager_or_admin(self):
        now = timezone.now()
        payload = {
            'code': 'TESTVIP10',
            'name': 'Giảm 10%',
            'discount_type': 'percentage',
            'discount_value': 10,
            'valid_from': now.isoformat(),
            'valid_to': (now + timedelta(days=7)).isoformat(),
            'is_active': True,
        }
        self.client.force_authenticate(user=self.receptionist)
        res_rec = self.client.post('/api/promotions/', payload, format='json')
        self.assertEqual(res_rec.status_code, 403)

        self.client.force_authenticate(user=self.manager)
        res_mgr = self.client.post('/api/promotions/', payload, format='json')
        self.assertIn(res_mgr.status_code, [200, 201])
