export interface ServiceOrder {
  id: number;
  booking_code: string;
  room_number: string;
  room_floor?: number | null;
  guest_id?: number | null;
  guest_name: string;
  guest_phone?: string;
  guest_tier_name?: string | null;
  guest_tier_code?: string | null;
  is_vip?: boolean;
  service_name: string;
  service_image?: string;
  category_name: string;
  category_type: string;
  quantity: number;
  total_price: string;
  request_time: string | null;
  status: string;
  status_display: string;
  assigned_staff: number | null;
  assigned_staff_name: string;
  note: string;
  created_at: string;
  updated_at?: string;
  booking_status?: string;
  is_scheduled?: boolean;
  is_paid?: boolean;
}

export interface CartItem {
  service: any;
  quantity: number;
  note: string;
}

export const CANCEL_REASONS = [
  'Khách yêu cầu hủy / đổi món khác',
  'Bếp / Quầy bar hết món (nguyên liệu)',
  'Khách không có trong phòng / không liên lạc được',
  'Chờ quá lâu / trễ giờ phục vụ',
  'Lý do khác',
];

export type ServiceLockReason = 'NO_ROOM' | 'WAIT_CHECKIN' | null;

export interface SlaStatus {
  isOverdue: boolean;
  label: string;
  badgeBg: string;
  badgeTextColor: string;
  badgeBorderColor: string;
  borderColor: string;
}

export interface StatusBadgeConfig {
  bg: string;
  border: string;
  text: string;
  label: string;
}
