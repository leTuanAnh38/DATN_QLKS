export interface BookingManagementModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectGuest?: (guestId: number) => void;
}

export interface BookingListViewProps {
  bookings: any[];
  loading: boolean;
  isDark: boolean;
  onSelectGuest?: (guestId: number) => void;
}

export interface BookingTimelineViewProps {
  isDark: boolean;
  onSelectGuest?: (guestId: number) => void;
}

export const getStatusBadge = (status: string) => {
  switch (status) {
    case 'checked_in':
      return { label: 'Đang ở', bg: 'rgba(16, 185, 129, 0.15)', text: '#34D399', border: 'rgba(16, 185, 129, 0.4)' };
    case 'confirmed':
      return { label: 'Sắp nhận', bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.4)' };
    case 'completed':
    case 'checked_out':
      return { label: 'Đã trả phòng', bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', border: 'rgba(148, 163, 184, 0.3)' };
    case 'cancelled':
      return { label: 'Đã hủy', bg: 'rgba(239, 68, 68, 0.15)', text: '#F87171', border: 'rgba(239, 68, 68, 0.4)' };
    default:
      return { label: status || 'Khác', bg: 'rgba(255, 255, 255, 0.08)', text: '#CBD5E1', border: 'rgba(255, 255, 255, 0.15)' };
  }
};

