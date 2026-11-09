/**
 * Hằng số dùng chung cho nghiệp vụ Phòng & Bảo trì.
 * Trước đây khai báo lặp ở housekeeping.tsx và maintenance.tsx (nhãn/màu lệch nhau).
 * Nhãn bám theo ROOM_ISSUE_TYPE của backend (apps/rooms/models.py).
 */

export const MAINTENANCE_ISSUE_TYPES = [
  { key: 'ac', label: 'Điều hòa / Thông gió', icon: 'snow', color: '#38BDF8' },
  { key: 'plumbing', label: 'Nước & Vệ sinh', icon: 'water', color: '#06B6D4' },
  { key: 'electric', label: 'Điện & Chiếu sáng', icon: 'flash', color: '#F59E0B' },
  { key: 'electronics', label: 'Điện tử (TV, Tủ lạnh)', icon: 'tv', color: '#A855F7' },
  { key: 'furniture', label: 'Nội thất & Khóa thẻ', icon: 'key', color: '#F97316' },
  { key: 'other', label: 'Sự cố khác', icon: 'construct', color: '#F472B6' },
] as const;

export const EQUIPMENT_SUGGESTIONS: { [key: string]: string[] } = {
  ac: ['Điều hòa Daikin', 'Điều hòa âm trần', 'Điều khiển máy lạnh', 'Quạt hút thông gió'],
  plumbing: ['Vòi sen tắm đứng', 'Bồn cầu / Vòi xịt', 'Bình nóng lạnh', 'Chậu rửa mặt (Lavabo)', 'Ống thoát nước sàn'],
  electric: ['Đèn chiếu sáng chính', 'Đèn ngủ đầu giường', 'Ổ cắm điện / Công tắc', 'Cầu dao điện (Aptomat)'],
  electronics: ['Smart TV / Remote', 'Tủ lạnh Minibar', 'Két sắt điện tử', 'Ấm siêu tốc', 'Máy sấy tóc'],
  furniture: ['Khóa thẻ từ phòng', 'Cửa phòng / Cửa ban công', 'Bàn ghế / Tủ quần áo', 'Giường / Đệm lò xo'],
  other: ['Gương kính nứt', 'Rèm cửa sổ', 'Tường ố / Thấm nước', 'Mùi lạ trong phòng'],
};

export const PARTS_SUGGESTIONS: { [key: string]: string[] } = {
  ac: ['Vệ sinh lưới lọc bụi', 'Thay tụ kích 35uF', 'Thay pin remote AAA', 'Thông ống thoát nước ngưng'],
  plumbing: ['Thay dây cấp nước inox', 'Thay củ sen tắm', 'Thay gioăng cao su vòi', 'Thay vòi xịt bồn cầu', 'Thông tắc siphon lavabo'],
  electric: ['Thay bóng đèn LED 9W', 'Thay hạt công tắc / ổ cắm', 'Thay aptomat 16A', 'Cố định lại chóa đèn'],
  electronics: ['Thay remote TV chính hãng', 'Vệ sinh giàn nóng minibar', 'Thay dây nguồn ấm đun', 'Cài đặt lại khóa két sắt'],
  furniture: ['Thay 4 pin khóa thẻ AA', 'Tra dầu bản lề cửa', 'Siết ốc chân bàn / ghế', 'Thay ray trượt ngăn kéo'],
  other: ['Trét keo silicone chống thấm', 'Cố định ray rèm cửa', 'Xử lý mùi ống thông hơi'],
};

export interface SLAStatus {
  elapsedMinutes: number;
  elapsedText: string;
  isOverdue: boolean;
  slaLimitMinutes: number;
  statusBadge: {
    label: string;
    color: string;
    bg: string;
    border: string;
  };
}

/**
 * Tính toán SLA thời gian chờ xử lý sự cố thiết bị:
 * - Khẩn cấp (urgent) hoặc Phòng có khách (occupied): SLA tối đa 30 phút.
 * - Ưu tiên cao (high): SLA tối đa 60 phút.
 * - Bình thường / Thấp: SLA tối đa 180 phút (3 giờ).
 */
export const calculateTicketSLA = (
  startDateStr?: string,
  priority?: string,
  roomStatus?: string,
  isFixing: boolean = true
): SLAStatus | null => {
  if (!startDateStr || !isFixing) return null;
  const start = new Date(startDateStr).getTime();
  if (isNaN(start)) return null;

  const now = Date.now();
  const elapsedMinutes = Math.max(0, Math.floor((now - start) / 60000));

  let slaLimitMinutes = 180;
  if (priority === 'urgent' || roomStatus === 'occupied') {
    slaLimitMinutes = 30;
  } else if (priority === 'high') {
    slaLimitMinutes = 60;
  }

  const isOverdue = elapsedMinutes > slaLimitMinutes;

  let elapsedText = '';
  if (elapsedMinutes < 60) {
    elapsedText = `${elapsedMinutes}p`;
  } else {
    const hours = Math.floor(elapsedMinutes / 60);
    const mins = elapsedMinutes % 60;
    elapsedText = mins > 0 ? `${hours}h ${mins}p` : `${hours}h`;
  }

  let statusBadge = {
    label: `Chờ ${elapsedText}`,
    color: '#38BDF8',
    bg: 'rgba(56, 189, 248, 0.12)',
    border: 'rgba(56, 189, 248, 0.3)',
  };

  if (isOverdue) {
    statusBadge = {
      label: `QUÁ HẠN SLA (${elapsedText})`,
      color: '#EF4444',
      bg: 'rgba(239, 68, 68, 0.16)',
      border: '#EF4444',
    };
  } else if (elapsedMinutes >= slaLimitMinutes * 0.7) {
    statusBadge = {
      label: `Sắp hạn (${elapsedText})`,
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.14)',
      border: 'rgba(245, 158, 11, 0.35)',
    };
  }

  return {
    elapsedMinutes,
    elapsedText,
    isOverdue,
    slaLimitMinutes,
    statusBadge,
  };
};

export const getRoomStatusColor = (status?: string) => {
  switch (status) {
    case 'occupied':
      return { bg: 'rgba(56, 189, 248, 0.15)', dot: '#38BDF8', text: '#38BDF8' };
    case 'available':
      return { bg: 'rgba(16, 185, 129, 0.15)', dot: '#10B981', text: '#10B981' };
    case 'cleaning':
      return { bg: 'rgba(245, 158, 11, 0.15)', dot: '#F59E0B', text: '#F59E0B' };
    case 'maintenance':
      return { bg: 'rgba(239, 68, 68, 0.15)', dot: '#EF4444', text: '#EF4444' };
    default:
      return { bg: 'rgba(148, 163, 184, 0.15)', dot: '#94A3B8', text: '#94A3B8' };
  }
};

export const getRoomStatusLabel = (status?: string) => {
  switch (status) {
    case 'occupied':
      return 'Có khách';
    case 'available':
      return 'Sẵn sàng';
    case 'cleaning':
      return 'Đang dọn';
    case 'maintenance':
      return 'Bảo trì';
    default:
      return status || 'Trống';
  }
};
