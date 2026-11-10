export interface CustomerCrmModalProps {
  visible: boolean;
  onClose: () => void;
  initialGuestId?: number | null;
}

export interface GuestListViewProps {
  guests: any[];
  loading: boolean;
  isDark: boolean;
  onSelectGuest: (guest: any) => void;
}

export interface GuestDetailViewProps {
  guest: any;
  bookingHistory: any[];
  serviceHistory: any[];
  loadingDetail: boolean;
  loadingHistory: boolean;
  isDark: boolean;
  onRefreshDetail?: () => void;
}

