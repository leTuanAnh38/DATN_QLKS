import { useMemo } from 'react';
import { useAuth } from '../store/authStore';

/**
 * Bảng phân quyền mặc định theo 9 vai trò trong Khách Sạn (Fallback)
 * Áp dụng khi User chưa có danh sách permissions chi tiết trả về từ Backend
 */
export const DEFAULT_ROLE_PERMISSIONS = {
    // 1. Admin Hệ Thống: Toàn quyền tối cao
    admin: {
        '*': { read: true, create: true, update: true, delete: true }
    },

    // 2. Chủ Khách Sạn (Owner): Toàn quyền tài chính, xem & đổi giá phòng, giám sát
    owner: {
        overview: { read: true, create: false, update: false, delete: false },
        rooms: { read: true, create: true, update: true, delete: true },
        categories: { read: true, create: true, update: true, delete: true },
        bookings: { read: true, create: false, update: false, delete: false },
        guests: { read: true, create: false, update: false, delete: false },
        services: { read: true, create: true, update: true, delete: true },
        finance: { read: true, create: true, update: true, delete: true },
        reports: { read: true, create: true, update: true, delete: true },
        employees: { read: true, create: false, update: false, delete: false },
        marketing: { read: true, create: true, update: true, delete: false },
        settings: { read: true, create: false, update: true, delete: false },
    },

    // 3. Quản Lý Khách Sạn (Manager): Điều hành toàn diện
    manager: {
        overview: { read: true, create: true, update: true, delete: false },
        rooms: { read: true, create: true, update: true, delete: true },
        categories: { read: true, create: true, update: true, delete: true },
        bookings: { read: true, create: true, update: true, delete: true },
        guests: { read: true, create: true, update: true, delete: true },
        services: { read: true, create: true, update: true, delete: true },
        finance: { read: true, create: true, update: true, delete: false },
        reports: { read: false, create: false, update: false, delete: false },
        employees: { read: true, create: true, update: true, delete: false },
        marketing: { read: true, create: true, update: true, delete: false },
        settings: { read: false, create: false, update: false, delete: false },
    },

    // 4. Lễ Tân (Front Desk): Check-in/out, nhận phòng, quản lý giao dịch khách
    receptionist: {
        overview: { read: true, create: false, update: false, delete: false },
        rooms: { read: true, create: false, update: true, delete: false },
        categories: { read: false, create: false, update: false, delete: false },
        bookings: { read: true, create: true, update: true, delete: false },
        guests: { read: true, create: true, update: true, delete: false },
        services: { read: true, create: false, update: false, delete: false },
        finance: { read: true, create: true, update: false, delete: false },
        reports: { read: false, create: false, update: false, delete: false },
        employees: { read: false, create: false, update: false, delete: false },
        marketing: { read: true, create: false, update: false, delete: false },
        settings: { read: false, create: false, update: false, delete: false },
    },

    // 5. Thu Ngân (Cashier): Thanh toán, hóa đơn VAT, thu tiền cọc
    cashier: {
        overview: { read: true, create: false, update: false, delete: false },
        rooms: { read: true, create: false, update: false, delete: false },
        categories: { read: false, create: false, update: false, delete: false },
        bookings: { read: true, create: false, update: false, delete: false },
        guests: { read: false, create: false, update: false, delete: false },
        services: { read: false, create: false, update: false, delete: false },
        finance: { read: true, create: true, update: true, delete: false },
        reports: { read: true, create: false, update: false, delete: false },
        employees: { read: false, create: false, update: false, delete: false },
        marketing: { read: false, create: false, update: false, delete: false },
        settings: { read: false, create: false, update: false, delete: false },
    },

    // 6. Nhân Viên Buồng Phòng (Housekeeper)
    housekeeper: {
        overview: { read: false, create: false, update: false, delete: false },
        rooms: { read: true, create: false, update: true, delete: false },
        bookings: { read: true, create: false, update: false, delete: false },
        services: { read: true, create: false, update: false, delete: false },
        finance: { read: false, create: false, update: false, delete: false },
        reports: { read: false, create: false, update: false, delete: false },
        employees: { read: false, create: false, update: false, delete: false },
    },

    // 7. Nhân Viên Phục Vụ (Service Staff - F&B / Spa)
    service_staff: {
        overview: { read: false, create: false, update: false, delete: false },
        rooms: { read: true, create: false, update: false, delete: false },
        services: { read: true, create: false, update: false, delete: false },
        finance: { read: false, create: false, update: false, delete: false },
        employees: { read: false, create: false, update: false, delete: false },
    },

    // 8. Kỹ Thuật Viên (Technician)
    technician: {
        overview: { read: false, create: false, update: false, delete: false },
        rooms: { read: true, create: false, update: true, delete: false },
        services: { read: true, create: false, update: false, delete: false },
        employees: { read: false, create: false, update: false, delete: false },
    },

    // 9. Khách Hàng (Guest): Không có quyền quản trị
    guest: {}
};

/**
 * Hàm kiểm tra quyền độc lập
 * @param {Object} user - User object từ authStore / LocalStorage
 * @param {string} module - Tên module: 'rooms', 'bookings', 'finance', 'reports', 'employees', etc.
 * @param {string} action - Hành động: 'read' | 'create' | 'update' | 'delete'
 * @returns {boolean}
 */
export function hasPermission(user, module, action = 'read') {
    if (!user) return false;

    // 1. Quản trị viên tối cao luôn có toàn quyền (Bypass check)
    if (user.is_superuser || user.role === 'admin') {
        return true;
    }

    // 2. Kiểm tra permissions động trả về từ API backend
    if (user.permissions) {
        // Kiểu 1: Object map { module: { read: true, create: false } }
        if (typeof user.permissions[module] === 'object' && !Array.isArray(user.permissions[module])) {
            return Boolean(user.permissions[module]?.[action]);
        }

        // Kiểu 2: Mảng hành động { module: ['read', 'create'] }
        if (Array.isArray(user.permissions[module])) {
            return user.permissions[module].includes(action);
        }

        // Kiểu 3: Danh sách chuỗi phẳng ['rooms.read', 'bookings.create', 'reports.*']
        if (Array.isArray(user.permissions)) {
            return (
                user.permissions.includes(`${module}.${action}`) ||
                user.permissions.includes(`${module}.*`) ||
                user.permissions.includes('*')
            );
        }
    }

    // 3. Fallback: Đối chiếu theo vai trò mặc định (Role Fallback)
    const roleRules = DEFAULT_ROLE_PERMISSIONS[user.role];
    if (roleRules) {
        if (roleRules['*']) return Boolean(roleRules['*'][action]);
        if (roleRules[module]) return Boolean(roleRules[module]?.[action]);
    }

    return false;
}

/**
 * Custom Hook React dùng trong các Component & Sidebar
 * @param {string} module - Tên module
 * @param {string} action - 'read' | 'create' | 'update' | 'delete'
 */
export function useHasPermission(module, action = 'read') {
    const { user } = useAuth();
    return useMemo(() => {
        return hasPermission(user, module, action);
    }, [user, module, action]);
}

/**
 * Component Wrapper tiện ích bảo vệ thẻ con
 */
export function PermissionGate({ module, action = 'read', children, fallback = null }) {
    const allowed = useHasPermission(module, action);
    if (!allowed) return fallback;
    return children;
}

export const Can = PermissionGate;

/**
 * Kiểm tra xem người dùng có phải là nhân sự / quản lý của khách sạn hay không
 */
export function isStaffRole(user) {
    if (!user) return false;
    const staffRoles = ['admin', 'owner', 'manager', 'receptionist', 'cashier', 'housekeeper', 'service_staff', 'technician'];
    return Boolean(user.is_staff || user.is_superuser || staffRoles.includes(user.role));
}

/**
 * Lấy danh xưng chức vụ / vai trò tiếng Việt hiển thị
 */
export function getRoleTitle(role, vipTier = null) {
    switch (role) {
        case 'admin':
            return 'Admin Quản Trị';
        case 'owner':
            return 'Chủ Khách Sạn (Owner)';
        case 'manager':
            return 'Tổng Quản Lý (GM)';
        case 'receptionist':
            return 'Lễ Tân Khách Sạn';
        case 'cashier':
            return 'Kế Toán & Thu Ngân';
        case 'housekeeper':
            return 'Nhân Viên Buồng Phòng';
        case 'service_staff':
            return 'Nhân Viên Dịch Vụ / F&B';
        case 'technician':
            return 'Kỹ Thuật Viên';
        case 'staff':
            return 'Nhân Viên Khách Sạn';
        case 'guest':
        default:
            return vipTier ? `Hội viên ${vipTier}` : 'Khách hàng VIP';
    }
}
