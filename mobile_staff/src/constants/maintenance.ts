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
