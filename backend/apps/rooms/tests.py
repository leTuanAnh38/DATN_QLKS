from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Room, RoomCategory

User = get_user_model()


# Kiểm thử hiển thị hạng phòng công khai và phân quyền cập nhật trạng thái phòng
class RoomManagementTests(APITestCase):
    def setUp(self):
        self.guest = User.objects.create_user(
            username='room_guest',
            email='room_guest@example.com',
            password='Password123!',
            role='guest',
        )
        self.housekeeper = User.objects.create_user(
            username='room_hk',
            email='room_hk@example.com',
            password='Password123!',
            role='housekeeper',
        )
        self.category = RoomCategory.objects.create(
            name='Suite',
            slug='suite',
            size=55.0,
            bed_type='King',
            capacity=2,
            base_price=Decimal('3000000'),
        )
        self.room = Room.objects.create(
            room_number='301',
            category=self.category,
            status='cleaning',
            floor=3,
        )

    # Kiểm tra người dùng công khai xem được danh sách hạng phòng (không cần đăng nhập)
    def test_public_can_list_room_categories(self):
        res = self.client.get('/api/rooms/categories/')
        self.assertEqual(res.status_code, 200)

    # Kiểm tra khách hàng bị chặn đổi trạng thái phòng (403) trong khi nhân viên buồng phòng cập nhật được (200)
    def test_guest_cannot_update_room_status_while_housekeeper_can(self):
        self.client.force_authenticate(user=self.guest)
        res_guest = self.client.patch(
            f'/api/rooms/admin/rooms/{self.room.id}/status/',
            {'status': 'available'},
            format='json',
        )
        self.assertEqual(res_guest.status_code, 403)

        self.client.force_authenticate(user=self.housekeeper)
        res_hk = self.client.patch(
            f'/api/rooms/admin/rooms/{self.room.id}/status/',
            {'status': 'available'},
            format='json',
        )
        self.assertEqual(res_hk.status_code, 200)
        self.room.refresh_from_db()
        self.assertEqual(self.room.status, 'available')
