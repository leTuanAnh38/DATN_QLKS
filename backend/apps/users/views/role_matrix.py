"""Ma trận phân quyền theo vai trò (file JSON) và kiểm tra quyền."""
import os
import json
import logging

from django.contrib.auth import get_user_model
from django.conf import settings


User = get_user_model()
logger = logging.getLogger(__name__)

ROLE_MATRIX_FILE = os.path.join(settings.BASE_DIR, 'role_matrix.json')


def load_role_matrix():
    if os.path.exists(ROLE_MATRIX_FILE):
        try:
            with open(ROLE_MATRIX_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Error loading role matrix: {e}")
    return {}


def save_role_matrix(matrix):
    try:
        with open(ROLE_MATRIX_FILE, 'w', encoding='utf-8') as f:
            json.dump(matrix, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving role matrix: {e}")


def check_role_permission(user, module, action='read'):
    if not (user and user.is_authenticated):
        return False
    if user.is_superuser or getattr(user, 'role', '') in ['admin', 'owner']:
        return True

    # Chuẩn hóa các alias hành động: 'view' -> 'read', 'edit' -> 'update'
    if action == 'view':
        action = 'read'
    elif action == 'edit':
        action = 'update'

    user_role = getattr(user, 'role', '')
    if not user_role or user_role == 'guest':
        return False

    # 1. Tra cứu ma trận phân quyền đã lưu động từ hệ thống
    matrix = load_role_matrix()
    if user_role in matrix and module in matrix[user_role]:
        mod_perms = matrix[user_role][module]
        if isinstance(mod_perms, dict) and action in mod_perms:
            return bool(mod_perms[action])

    # 2. Quy tắc mặc định (Default fallback) khi chưa cấu hình chi tiết
    DEFAULT_STAFF_PERMS = {
        'manager': {'*': {'read': True, 'create': True, 'update': True, 'delete': False}},
        'receptionist': {
            'guests': {'read': True, 'create': True, 'update': True, 'delete': False},
            'bookings': {'read': True, 'create': True, 'update': True, 'delete': False},
            'rooms': {'read': True, 'create': False, 'update': True, 'delete': False},
            'corporate_partners': {'read': True, 'create': False, 'update': False, 'delete': False},
        },
        'cashier': {
            'overview': {'read': True, 'create': False, 'update': False, 'delete': False},
            'rooms': {'read': True, 'create': False, 'update': False, 'delete': False},
            'categories': {'read': True, 'create': False, 'update': False, 'delete': False},
            'bookings': {'read': True, 'create': False, 'update': False, 'delete': False},
            'guests': {'read': True, 'create': False, 'update': False, 'delete': False},
            'corporate_partners': {'read': True, 'create': False, 'update': False, 'delete': False},
            'services': {'read': True, 'create': False, 'update': False, 'delete': False},
            'finance': {'read': True, 'create': True, 'update': True, 'delete': False},
            'reports': {'read': True, 'create': False, 'update': False, 'delete': False},
        },
        'housekeeper': {
            'guests': {'read': True, 'create': False, 'update': False, 'delete': False},
            'rooms': {'read': True, 'create': False, 'update': True, 'delete': False},
            'bookings': {'read': True, 'create': False, 'update': False, 'delete': False},
        },
        'service_staff': {
            'guests': {'read': True, 'create': False, 'update': False, 'delete': False},
            'services': {'read': True, 'create': True, 'update': True, 'delete': False},
        },
        'technician': {
            'guests': {'read': True, 'create': False, 'update': False, 'delete': False},
            'rooms': {'read': True, 'create': False, 'update': True, 'delete': False},
        },
    }

    role_rules = DEFAULT_STAFF_PERMS.get(user_role, {})
    if '*' in role_rules:
        return bool(role_rules['*'].get(action, False))
    if module in role_rules:
        return bool(role_rules[module].get(action, False))

    # Mặc định cho phép nhân sự nội bộ xem (read) thông tin khách hàng phục vụ vận hành
    if action == 'read' and user_role in ['cashier', 'housekeeper', 'service_staff', 'technician', 'receptionist', 'manager']:
        return True

    return False


# =========================================================================
# DANH MỤC VAI TRÒ & CHI TIẾT MA TRẬN PHÂN QUYỀN RBAC CHUẨN KHÁCH SẠN
# =========================================================================

def get_all_roles_matrix():
    matrix_list = [
        {
            'role': 'admin',
            'title': 'Admin Hệ Thống',
            'level': 'Toàn quyền',
            'badge_color': 'purple',
            'icon': 'Crown',
            'description': 'Quản trị tối cao toàn bộ hệ thống, phân quyền người dùng, cấu hình khách sạn và cơ sở dữ liệu.',
            'scope': 'Cấp quyền, tạo nhân sự, quản lý dữ liệu, kiểm toán hệ thống',
            'permissions': {
                'rooms': 'Toàn quyền cấu hình',
                'bookings': 'Toàn quyền duyệt/hủy',
                'guests': 'Toàn quyền xem/sửa',
                'employees': 'Toàn quyền phân quyền',
                'finance': 'Toàn quyền doanh thu',
                'settings': 'Cấu hình hệ thống',
            }
        },
        {
            'role': 'owner',
            'title': 'Chủ Khách Sạn (Owner)',
            'level': 'Toàn quyền',
            'badge_color': 'amber',
            'icon': 'Briefcase',
            'description': 'Sở hữu khách sạn, quản lý toàn diện kinh doanh, nhân sự, tài chính, công suất phòng và chiến lược giá.',
            'scope': 'Toàn quyền vận hành, doanh thu, nhân sự và báo cáo',
            'permissions': {
                'rooms': 'Toàn quyền cấu hình',
                'bookings': 'Toàn quyền quản lý',
                'guests': 'Toàn quyền quản lý',
                'employees': 'Toàn quyền nhân sự',
                'finance': 'Toàn quyền tài chính',
                'settings': 'Toàn quyền cấu hình',
            }
        },
        {
            'role': 'manager',
            'title': 'Quản Lý Khách Sạn (Manager)',
            'level': 'Điều hành',
            'badge_color': 'blue',
            'icon': 'ShieldCheck',
            'description': 'Điều hành vận hành thường nhật: duyệt đặt phòng, phân công ca làm nhân viên, quản lý chất lượng dịch vụ.',
            'scope': 'Điều phối nhân sự, duyệt phòng, giải quyết sự vụ',
            'permissions': {
                'rooms': 'Toàn quyền điều phối',
                'bookings': 'Toàn quyền duyệt/đổi',
                'guests': 'Toàn quyền quản lý',
                'employees': 'Phân ca & Chấm công',
                'finance': 'Xem & Xuất hóa đơn',
                'reports': 'Xem báo cáo doanh thu',
                'settings': 'Xem cấu hình',
            }
        },
        {
            'role': 'receptionist',
            'title': 'Lễ Tân (Front Desk)',
            'level': 'Tiếp đón',
            'badge_color': 'emerald',
            'icon': 'Headphones',
            'description': 'Check-in, check-out, gán phòng, tiếp nhận đặt phòng trực tiếp tại quầy, hỗ trợ yêu cầu khách lưu trú.',
            'scope': 'Thủ tục phòng, tra cứu khách, gán chìa khóa phòng',
            'permissions': {
                'rooms': 'Xem & Gán phòng',
                'bookings': 'Tạo & Check-in/out',
                'guests': 'Xem & Cập nhật nhanh',
                'employees': 'Chỉ xem ca trực',
                'finance': 'Thu cọc & Tiền phòng',
                'settings': 'Không có quyền',
            }
        },
        {
            'role': 'cashier',
            'title': 'Thu Ngân (Cashier)',
            'level': 'Tài chính',
            'badge_color': 'cyan',
            'icon': 'CreditCard',
            'description': 'Xác nhận thanh toán, quản lý hóa đơn VAT, thu tiền cọc và đối soát giao dịch thanh toán trực tuyến.',
            'scope': 'Thu chi, xuất hóa đơn VAT, kết ca thu ngân',
            'permissions': {
                'rooms': 'Xem bảng giá phòng',
                'bookings': 'Xem trạng thái tiền',
                'guests': 'Xem hóa đơn khách',
                'employees': 'Không có quyền',
                'finance': 'Toàn quyền thu chi',
                'settings': 'Không có quyền',
            }
        },
        {
            'role': 'housekeeper',
            'title': 'Nhân Viên Buồng Phòng',
            'level': 'Vận hành buồng',
            'badge_color': 'orange',
            'icon': 'Sparkles',
            'description': 'Cập nhật trạng thái vệ sinh phòng (Đang dọn, Đã khử khuẩn, Sẵn sàng đón khách), kiểm kê mini bar.',
            'scope': 'Trạng thái dọn phòng, báo vật tư, báo đồ thất lạc',
            'permissions': {
                'rooms': 'Cập nhật dọn phòng',
                'bookings': 'Xem giờ trả phòng',
                'guests': 'Không có quyền',
                'employees': 'Xem ca làm việc',
                'finance': 'Không có quyền',
                'settings': 'Không có quyền',
            }
        },
        {
            'role': 'service_staff',
            'title': 'Nhân Viên Phục Vụ (F&B / Spa)',
            'level': 'Dịch vụ',
            'badge_color': 'rose',
            'icon': 'Utensils',
            'description': 'Tiếp nhận order ẩm thực tận phòng, phục vụ nhà hàng, dịch vụ spa thư giãn và đưa đón hành lý.',
            'scope': 'Order dịch vụ, giao đồ ăn phòng, phục vụ khách',
            'permissions': {
                'rooms': 'Xem số phòng order',
                'bookings': 'Không có quyền',
                'guests': 'Xem sở thích ăn uống',
                'employees': 'Xem ca làm việc',
                'finance': 'Ghi chi phí dịch vụ',
                'settings': 'Không có quyền',
            }
        },
        {
            'role': 'technician',
            'title': 'Kỹ Thuật Viên (Technician)',
            'level': 'Bảo trì',
            'badge_color': 'indigo',
            'icon': 'Wrench',
            'description': 'Bảo dưỡng và sửa chữa hệ thống cơ điện, điều hòa nhiệt độ, internet wifi, thang máy và thiết bị trong phòng.',
            'scope': 'Bảo trì trang thiết bị, sửa chữa kỹ thuật',
            'permissions': {
                'rooms': 'Báo trạng thái hỏng',
                'bookings': 'Không có quyền',
                'guests': 'Không có quyền',
                'employees': 'Xem ca làm việc',
                'finance': 'Không có quyền',
                'settings': 'Không có quyền',
            }
        }
    ]
    for r in matrix_list:
        r['code'] = r['role']
        r['name'] = r['title']
    return matrix_list
