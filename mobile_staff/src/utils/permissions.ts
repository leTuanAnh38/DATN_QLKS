import { UserInfo, RolePermissionsMap } from '../services/authStorage';

export type PermissionAction = 'read' | 'create' | 'update' | 'delete';

// Fallback khi app chưa kịp tải permissions mới từ /users/me/ (khớp role_matrix.json)
const DEFAULT_MOBILE_PERMISSIONS: Record<string, RolePermissionsMap> = {
  manager: {
    overview: { read: true, create: true, update: true, delete: false },
    rooms: { read: true, create: true, update: true, delete: false },
    bookings: { read: true, create: false, update: false, delete: false },
    guests: { read: true, create: false, update: false, delete: false },
    services: { read: true, create: true, update: true, delete: false },
    reports: { read: true, create: false, update: false, delete: false },
    employees: { read: true, create: true, update: true, delete: false },
  },
  receptionist: {
    overview: { read: true, create: false, update: false, delete: false },
    rooms: { read: true, create: false, update: true, delete: false },
    bookings: { read: true, create: true, update: true, delete: false },
    guests: { read: true, create: true, update: true, delete: false },
    services: { read: true, create: true, update: true, delete: false },
    finance: { read: true, create: false, update: false, delete: false },
  },
  cashier: {
    overview: { read: true, create: false, update: false, delete: false },
    rooms: { read: true, create: false, update: false, delete: false },
    bookings: { read: true, create: false, update: false, delete: false },
    guests: { read: true, create: false, update: false, delete: false },
    services: { read: true, create: false, update: false, delete: false },
    finance: { read: true, create: true, update: true, delete: false },
    reports: { read: true, create: false, update: false, delete: false },
  },
  housekeeper: {
    rooms: { read: true, create: false, update: true, delete: false },
    bookings: { read: true, create: false, update: false, delete: false },
    guests: { read: true, create: false, update: false, delete: false },
    services: { read: true, create: false, update: true, delete: false },
  },
  service_staff: {
    rooms: { read: true, create: false, update: false, delete: false },
    bookings: { read: true, create: false, update: false, delete: false },
    guests: { read: true, create: false, update: false, delete: false },
    services: { read: true, create: false, update: true, delete: false },
  },
  technician: {
    rooms: { read: true, create: false, update: true, delete: false },
    bookings: { read: true, create: false, update: false, delete: false },
    guests: { read: false, create: false, update: false, delete: false },
    services: { read: false, create: false, update: false, delete: false },
  },
};

/**
 * Kiểm tra quyền động theo Ma trận phân quyền (role_matrix.json trả về từ Backend).
 * Đồng bộ trực tiếp với trang Phân quyền trên Web Admin.
 */
export function hasStaffPermission(
  user: UserInfo | null | undefined,
  module: string,
  action: PermissionAction = 'read'
): boolean {
  if (!user) return false;
  if (user.is_superuser || user.role === 'admin' || user.role === 'owner') {
    return true;
  }

  const perms = user.permissions;
  if (perms && typeof perms === 'object') {
    if (perms['*'] && typeof perms['*'][action] === 'boolean') {
      return Boolean(perms['*'][action]);
    }
    if (perms[module] && typeof perms[module][action] === 'boolean') {
      return Boolean(perms[module][action]);
    }
  }

  const fallback = DEFAULT_MOBILE_PERMISSIONS[user.role];
  if (fallback && fallback[module] && typeof fallback[module][action] === 'boolean') {
    return Boolean(fallback[module][action]);
  }

  return false;
}

