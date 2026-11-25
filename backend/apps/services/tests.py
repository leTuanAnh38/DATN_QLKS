from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import ServiceCategory, ServiceItem, ServiceRequest
from ..bookings.models import Booking
from ..rooms.models import Room, RoomCategory

User = get_user_model()


# Kiểm thử tạo và xử lý phiếu yêu cầu dịch vụ phòng
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

    # Kiểm tra chỉ chủ đơn đặt phòng mới được gọi dịch vụ cho phòng mình, chặn khách khác đặt hộ (chống IDOR)
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

    # Kiểm tra nhân viên phục vụ cập nhật được trạng thái xử lý yêu cầu dịch vụ (pending -> in_progress)
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


# Kiểm thử quản lý danh mục dịch vụ và cơ chế bảo vệ xóa an toàn (Safe Delete)
class ServiceCategoryManagementTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='svc_admin',
            email='svc_admin@example.com',
            password='Password123!',
            role='admin',
            is_superuser=True,
        )
        self.cat_food = ServiceCategory.objects.create(name='Ẩm thực', icon='dining', description='Đồ ăn')
        self.cat_drink = ServiceCategory.objects.create(name='Đồ uống', icon='bar', description='Nước uống')
        self.cat_empty = ServiceCategory.objects.create(name='Nhóm trống', icon='tag')
        self.item = ServiceItem.objects.create(
            category=self.cat_food,
            name='Bò Wagyu',
            price=Decimal('700000'),
            is_active=True,
        )

    # Kiểm tra Admin cập nhật tên, mô tả nhóm dịch vụ và trả về đúng số lượng dịch vụ trực thuộc
    def test_admin_can_update_service_category(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(
            f'/api/services/categories/{self.cat_food.id}/',
            {'name': 'Ẩm thực tại phòng', 'description': 'Phục vụ 24/7'},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.cat_food.refresh_from_db()
        self.assertEqual(self.cat_food.name, 'Ẩm thực tại phòng')
        self.assertEqual(res.data['category']['total_services_count'], 1)

    # Kiểm tra xóa nhóm dịch vụ còn món bên trong bắt buộc chuyển sang nhóm đích trước khi xóa
    def test_delete_non_empty_category_requires_reassign_then_moves_items(self):
        self.client.force_authenticate(user=self.admin)

        # Chặn xóa nếu chưa chọn nhóm đích để chuyển dịch vụ
        blocked = self.client.delete(f'/api/services/categories/{self.cat_food.id}/')
        self.assertEqual(blocked.status_code, 400)
        self.assertTrue(blocked.data.get('requires_reassign'))
        self.assertTrue(ServiceCategory.objects.filter(pk=self.cat_food.id).exists())
        self.assertTrue(ServiceItem.objects.filter(pk=self.item.id).exists())

        # Cho phép chuyển dịch vụ sang nhóm đích rồi mới xóa
        ok = self.client.delete(
            f'/api/services/categories/{self.cat_food.id}/?reassign_to={self.cat_drink.id}'
        )
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.data.get('moved_count'), 1)
        self.assertFalse(ServiceCategory.objects.filter(pk=self.cat_food.id).exists())
        self.item.refresh_from_db()
        self.assertEqual(self.item.category_id, self.cat_drink.id)

    # Kiểm tra xóa trực tiếp nhóm dịch vụ trống thành công
    def test_delete_empty_category_succeeds_directly(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.delete(f'/api/services/categories/{self.cat_empty.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(ServiceCategory.objects.filter(pk=self.cat_empty.id).exists())

    # Kiểm tra cơ chế chống xóa vĩnh viễn khi dịch vụ/khách/nhân viên/phòng đang có dữ liệu lịch sử ràng buộc
    def test_safe_delete_guards_for_service_guest_employee_and_room(self):
        from django.urls import reverse
        from ..payments.models import CashierShift

        self.client.force_authenticate(user=self.admin)

        guest = User.objects.create_user(
            username='safe_del_guest',
            email='safe_del_guest@example.com',
            password='Password123!',
            role='guest',
        )
        cashier = User.objects.create_user(
            username='safe_del_cashier',
            email='safe_del_cashier@example.com',
            password='Password123!',
            role='receptionist',
        )
        room_cat = RoomCategory.objects.create(
            name='Safe Guard Suite',
            slug='safe-guard-suite',
            size=40.0,
            bed_type='King',
            capacity=2,
            base_price=Decimal('2000000'),
        )
        room = Room.objects.create(
            room_number='909',
            category=room_cat,
            status='occupied',
            floor=9,
        )
        today = timezone.localdate()
        booking = Booking.objects.create(
            guest=guest,
            category=room_cat,
            room=room,
            check_in_date=today,
            check_out_date=today + timedelta(days=1),
            total_amount=Decimal('2000000'),
            status='checked_in',
        )
        ServiceRequest.objects.create(
            booking=booking,
            service=self.item,
            quantity=1,
            unit_price=self.item.price,
            status='completed',
        )
        CashierShift.objects.create(
            user=cashier,
            opening_cash=Decimal('1000000'),
        )

        # 1. Dịch vụ đã có đơn completed -> chặn xóa vĩnh viễn
        res_svc = self.client.delete(f'/api/services/items/{self.item.id}/')
        self.assertEqual(res_svc.status_code, 400)
        self.assertTrue(ServiceItem.objects.filter(pk=self.item.id).exists())

        # 2. Khách hàng đã có booking -> chặn xóa
        res_guest = self.client.delete(reverse('admin-guest-detail', args=[guest.id]))
        self.assertEqual(res_guest.status_code, 400)
        self.assertTrue(User.objects.filter(pk=guest.id).exists())

        # 3. Nhân viên đã có ca thu ngân -> chặn xóa
        res_emp = self.client.delete(reverse('admin-employee-detail', args=[cashier.id]))
        self.assertEqual(res_emp.status_code, 400)
        self.assertTrue(User.objects.filter(pk=cashier.id).exists())

        # 4. Phòng đang có khách lưu trú -> chặn xóa
        res_room = self.client.delete(reverse('admin-room-detail', args=[room.id]))
        self.assertEqual(res_room.status_code, 400)
        self.assertTrue(Room.objects.filter(pk=room.id).exists())
