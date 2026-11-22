# Generated manually to standardize legacy employee shift labels and generic positions

from django.db import migrations


def normalize_employees(apps, schema_editor):
    EmployeeProfile = apps.get_model('users', 'EmployeeProfile')

    for profile in EmployeeProfile.objects.select_related('user').all():
        updated_fields = []

        # 1. Chuẩn hóa chuỗi ca làm việc về bộ HOTEL_SHIFTS thống nhất
        raw_shift = (profile.shift or '').strip()
        if raw_shift:
            low = raw_shift.lower()
            normalized_shift = raw_shift
            if 'gãy' in low:
                normalized_shift = 'Ca Gãy (10:00 - 14:00 & 18:00 - 22:00)'
            elif 'xoay' in low:
                normalized_shift = 'Ca Xoay (Linh hoạt 3 ca theo tuần)'
            elif 'hành chính' in low:
                normalized_shift = 'Ca Hành Chính (08:00 - 17:00)'
            elif 'đêm' in low:
                normalized_shift = 'Ca Đêm (22:00 - 06:00 hôm sau)'
            elif 'chiều' in low:
                normalized_shift = 'Ca Chiều (14:00 - 22:00)'
            elif 'sáng' in low:
                normalized_shift = 'Ca Sáng (06:00 - 14:00)'

            if normalized_shift != profile.shift:
                profile.shift = normalized_shift
                updated_fields.append('shift')

        # 2. Gán chức danh cụ thể nếu đang ghi chung chung là "Nhân viên" hoặc để trống
        raw_pos = (profile.position or '').strip()
        if not raw_pos or raw_pos.lower() == 'nhân viên':
            role = getattr(profile.user, 'role', '') if profile.user else ''
            dept = (profile.department or '').lower()
            if role == 'owner':
                new_pos = 'Chủ Khách Sạn & Chủ Tịch HĐQT'
            elif role == 'admin':
                new_pos = 'Quản Trị Viên Hệ Thống (System Admin)'
            elif role == 'manager':
                new_pos = 'Quản Lý Điều Hành Khách Sạn'
            elif role == 'cashier':
                new_pos = 'Nhân Viên Thu Ngân Khách Sạn (Cashier)'
            elif role == 'receptionist':
                new_pos = 'Nhân Viên Lễ Tân (Receptionist)'
            elif role == 'housekeeper':
                new_pos = 'Nhân Viên Dọn Phòng (Housekeeper)'
            elif role == 'technician':
                new_pos = 'Kỹ Thuật Viên Điện Lạnh & Điều Hòa'
            elif role == 'service_staff':
                if 'spa' in dept:
                    new_pos = 'Chuyên Viên Trị Liệu & Massage'
                elif 'an ninh' in dept or 'bảo vệ' in dept:
                    new_pos = 'Nhân Viên An Ninh Tiền Sảnh'
                else:
                    new_pos = 'Nhân Viên Phục Vụ Tại Phòng (Room Service)'
            else:
                new_pos = raw_pos

            if new_pos and new_pos != profile.position:
                profile.position = new_pos
                updated_fields.append('position')

        if updated_fields:
            profile.save(update_fields=updated_fields)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0006_passwordresetotp'),
    ]

    operations = [
        migrations.RunPython(normalize_employees, noop_reverse),
    ]
