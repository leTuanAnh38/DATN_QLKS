from datetime import timedelta
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import GuestProfile
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


class GoogleLoginTests(APITestCase):
    CLIENT_ID = 'test-client-id.apps.googleusercontent.com'

    def _mock_response(self, status_code, payload):
        resp = MagicMock()
        resp.status_code = status_code
        resp.json.return_value = payload
        return resp

    @override_settings(GOOGLE_CLIENT_ID=CLIENT_ID)
    def test_google_login_creates_new_guest_and_returns_tokens(self):
        tokeninfo_resp = self._mock_response(200, {'aud': self.CLIENT_ID})
        userinfo_resp = self._mock_response(200, {
            'email': 'NewGuest@gmail.com',
            'email_verified': True,
            'name': 'Nguyễn Văn An',
        })
        with patch('apps.users.views.auth_views.requests.get', side_effect=[tokeninfo_resp, userinfo_resp]):
            res = self.client.post('/api/auth/google-login/', {'access_token': 'fake-google-token'}, format='json')

        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['success'])
        self.assertTrue(res.data['is_new_user'])
        self.assertIn('access', res.data['tokens'])
        user = User.objects.get(email='newguest@gmail.com')
        self.assertEqual(user.role, 'guest')
        self.assertEqual(user.first_name, 'Nguyễn Văn')
        self.assertEqual(user.last_name, 'An')
        self.assertFalse(user.has_usable_password())
        self.assertTrue(GuestProfile.objects.filter(user=user).exists())

    @override_settings(GOOGLE_CLIENT_ID=CLIENT_ID)
    def test_google_login_blocks_staff_account(self):
        User.objects.create_user(
            username='staff_user',
            email='staff@gmail.com',
            password='Password123!',
            role='receptionist',
        )
        tokeninfo_resp = self._mock_response(200, {'aud': self.CLIENT_ID})
        userinfo_resp = self._mock_response(200, {
            'email': 'staff@gmail.com',
            'email_verified': True,
            'name': 'Staff Member',
        })
        with patch('apps.users.views.auth_views.requests.get', side_effect=[tokeninfo_resp, userinfo_resp]):
            res = self.client.post('/api/auth/google-login/', {'access_token': 'fake-google-token'}, format='json')

        self.assertEqual(res.status_code, 403)
        self.assertFalse(res.data['success'])

    @override_settings(GOOGLE_CLIENT_ID=CLIENT_ID)
    def test_google_login_rejects_mismatched_audience(self):
        id_token_resp = self._mock_response(200, {
            'aud': 'other-app.apps.googleusercontent.com',
            'iss': 'https://accounts.google.com',
            'email': 'hacker@gmail.com',
            'email_verified': 'true',
        })
        with patch('apps.users.views.auth_views.requests.get', return_value=id_token_resp):
            res = self.client.post('/api/auth/google-login/', {'credential': 'bad-id-token'}, format='json')

        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.data['success'])


class EmployeeDirectoryHierarchyAndMaskingTests(APITestCase):
    def setUp(self):
        from decimal import Decimal
        from .models import EmployeeProfile

        self.owner = User.objects.create_user(
            username='dir_owner',
            email='dir_owner@example.com',
            password='Password123!',
            role='owner',
        )
        EmployeeProfile.objects.create(
            user=self.owner,
            employee_code='NV-OWN01',
            department='Ban Quản Lý & Điều Hành',
            position='Chủ Khách Sạn',
            shift='Ca Hành Chính (08:00 - 17:00)',
            base_salary=Decimal('50000000'),
        )

        self.manager = User.objects.create_user(
            username='dir_manager',
            email='dir_manager@example.com',
            password='Password123!',
            role='manager',
        )
        EmployeeProfile.objects.create(
            user=self.manager,
            employee_code='NV-MGR01',
            department='Ban Quản Lý & Điều Hành',
            position='Tổng Giám Đốc Điều Hành',
            shift='Ca Hành Chính (08:00 - 17:00)',
            base_salary=Decimal('25000000'),
        )

        self.admin_staff = User.objects.create_user(
            username='dir_admin',
            email='dir_admin@example.com',
            password='Password123!',
            role='admin',
        )
        EmployeeProfile.objects.create(
            user=self.admin_staff,
            employee_code='NV-ADM01',
            department='Ban Quản Lý & Điều Hành',
            position='Quản Trị Viên Hệ Thống (System Admin)',
            shift='Ca Hành Chính (08:00 - 17:00)',
            base_salary=Decimal('18000000'),
        )

        self.cashier = User.objects.create_user(
            username='dir_cashier',
            email='dir_cashier@example.com',
            password='Password123!',
            role='cashier',
        )
        EmployeeProfile.objects.create(
            user=self.cashier,
            employee_code='NV-CAS01',
            department='Kế Toán & Thu Ngân',
            position='Thu Ngân',
            shift='Ca Sáng (06:00 - 14:00)',
            base_salary=Decimal('12000000'),
        )

    def test_hierarchy_sorting_and_manager_salary_masking(self):
        self.client.force_authenticate(user=self.manager)
        res = self.client.get('/api/users/admin/employees/')
        self.assertEqual(res.status_code, 200)
        rows = res.data.get('results') or res.data.get('employees')
        roles_order = [r['role'] for r in rows]
        self.assertEqual(roles_order, ['owner', 'admin', 'manager', 'cashier'])

        by_role = {r['role']: r for r in rows}
        # Lương Chủ KS bị ẩn với Manager
        self.assertTrue(by_role['owner']['employee_profile']['salary_hidden'])
        self.assertIsNone(by_role['owner']['employee_profile']['base_salary'])
        # Manager vẫn thấy lương của IT Admin, chính mình và nhân viên cấp dưới
        self.assertFalse(by_role['admin']['employee_profile']['salary_hidden'])
        self.assertEqual(by_role['admin']['employee_profile']['base_salary'], '18000000')
        self.assertFalse(by_role['manager']['employee_profile']['salary_hidden'])
        self.assertEqual(by_role['manager']['employee_profile']['base_salary'], '25000000')
        self.assertFalse(by_role['cashier']['employee_profile']['salary_hidden'])
        self.assertEqual(by_role['cashier']['employee_profile']['base_salary'], '12000000')

        # Bộ lọc theo ca làm việc hoạt động chính xác từ Backend
        res_shift = self.client.get('/api/users/admin/employees/?shift=Ca Sáng (06:00 - 14:00)')
        self.assertEqual(res_shift.status_code, 200)
        shift_rows = res_shift.data.get('results') or res_shift.data.get('employees')
        self.assertEqual(len(shift_rows), 1)
        self.assertEqual(shift_rows[0]['role'], 'cashier')

    def test_owner_cannot_modify_or_assign_admin_role(self):
        self.client.force_authenticate(user=self.owner)

        # Owner không được chỉnh sửa / hạ quyền tài khoản Admin
        res_patch_admin = self.client.patch(
            f'/api/users/admin/employees/{self.admin_staff.id}/',
            {'role': 'receptionist'},
            format='json',
        )
        self.assertEqual(res_patch_admin.status_code, 403)

        # Owner không được nâng quyền nhân viên khác lên Admin
        res_promote = self.client.patch(
            f'/api/users/admin/employees/{self.cashier.id}/',
            {'role': 'admin'},
            format='json',
        )
        self.assertEqual(res_promote.status_code, 403)

        # Owner không được tạo mới tài khoản Admin
        res_create_admin = self.client.post(
            '/api/users/admin/employees/',
            {
                'fullName': 'Fake Admin',
                'email': 'fake_admin@example.com',
                'phone': '0909888777',
                'password': 'Password123!',
                'role': 'admin',
            },
            format='json',
        )
        self.assertEqual(res_create_admin.status_code, 403)

        # Owner không được xóa tài khoản Admin
        res_delete_admin = self.client.delete(f'/api/users/admin/employees/{self.admin_staff.id}/')
        self.assertEqual(res_delete_admin.status_code, 403)
        self.assertTrue(User.objects.filter(pk=self.admin_staff.id).exists())
