/** Kiểu dữ liệu phòng cho màn hình Buồng phòng (tách từ app/(tabs)/housekeeping.tsx). */
export interface BookingSummary {
  id: number;
  booking_code: string;
  guest_id?: number;
  guest_name: string;
  guest_phone?: string;
  guest_email?: string;
  check_in_date?: string;
  check_out_date?: string;
  status?: string;
  status_display?: string;
}

export interface MaintenanceSummary {
  id: number;
  ticket_code: string;
  equipment_name: string;
  issue_type?: string;
  issue_type_display?: string;
  description?: string;
}

export interface RoomItem {
  id: number;
  room_number: string;
  category_name?: string;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance';
  status_display?: string;
  floor: number;
  current_booking?: BookingSummary | null;
  recent_booking?: BookingSummary | null;
  active_maintenance?: MaintenanceSummary | null;
  latest_minibar_check?: any | null;
  is_cleaning_requested?: boolean;
  cleaning_request_note?: string;
  cleaning_requested_at?: string;
}
