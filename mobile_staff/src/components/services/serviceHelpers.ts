import apiClient from '../../api/client';
import { DEFAULT_API_URL } from '../../api/config';
import { ServiceOrder, ServiceLockReason, SlaStatus, StatusBadgeConfig } from './types';

// Helper lọc bỏ các dịch vụ xe / vận chuyển (đã có tab riêng của đội lái xe)
export const isTransportService = (item: any): boolean => {
  if (!item) return false;
  if (item.category_type === 'transport') return true;
  const text = `${item.name || item.service_name || ''} ${item.category_name || ''} ${item.description || ''}`.toLowerCase();
  return (
    text.includes('xe') ||
    text.includes('sân bay') ||
    text.includes('đưa đón') ||
    text.includes('transfer') ||
    text.includes('limousine') ||
    text.includes('maybach') ||
    text.includes('shuttle') ||
    text.includes('taxi') ||
    text.includes('đón tiễn')
  );
};

// Helper kiểm tra tác vụ dọn dẹp phòng lưu trú (Make-up room) thuộc nghiệp vụ riêng của Buồng phòng (đã có tab Buồng phòng riêng)
export const isHousekeepingService = (item: any): boolean => {
  if (!item) return false;
  const text = `${item.name || item.service_name || ''} ${item.category_name || ''} ${item.description || ''}`.toLowerCase();
  return text.includes('make-up') || text.includes('dọn dẹp phòng lưu trú') || text.includes('dọn phòng');
};

// Helper lấy đường dẫn ảnh đầy đủ cho dịch vụ / món ăn (đồng bộ với Web)
export const getServiceItemImage = (item: any): string => {
  const raw =
    item?.service_image ||
    item?.service?.image ||
    item?.service?.image_url ||
    item?.display_image ||
    item?.image_url ||
    item?.image;
  if (!raw || typeof raw !== 'string') {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80';
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  const base = (apiClient.defaults.baseURL || DEFAULT_API_URL || '').replace(/\/api\/?$/, '');
  return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

// Helper định dạng ngày giờ đặt đơn & giờ hẹn giao
export const formatOrderTime = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const dateFormatted = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    return `${timeStr} • ${dateFormatted}`;
  } catch {
    return dateStr;
  }
};

// Helper phân loại nhóm dịch vụ chuẩn nghiệp vụ khách sạn 5 sao
export const getServiceCategoryType = (item: any): 'fnb' | 'spa' | 'laundry' | 'amenities' => {
  if (!item) return 'amenities';
  const catType = (item.category_type || '').toLowerCase();
  if (catType === 'spa') return 'spa';
  if (catType === 'laundry') return 'laundry';
  if (catType === 'fnb') return 'fnb';
  // Backend (get_service_category_type) đã phân loại là tiện ích/buồng phòng thì tin kết quả đó,
  // không đoán lại bằng từ khóa (vd danh mục "Tiện ích & Giặt ủi" chứa chữ "giặt" nhưng dịch vụ là tiện ích).
  if (catType === 'amenities' || catType === 'room_amenity') return 'amenities';

  const text = `${item.name || item.service_name || ''} ${item.category_name || ''} ${item.description || ''}`.toLowerCase();
  if (
    text.includes('spa') ||
    text.includes('massage') ||
    text.includes('trị liệu') ||
    text.includes('xông hơi') ||
    text.includes('sauna') ||
    text.includes('wellness')
  ) {
    return 'spa';
  }
  if (
    text.includes('giặt') ||
    text.includes('ủi') ||
    text.includes('laundry') ||
    text.includes('giặt sấy') ||
    text.includes('giặt hấp')
  ) {
    return 'laundry';
  }
  if (
    text.includes('ẩm thực') ||
    text.includes('đồ ăn') ||
    text.includes('món') ||
    text.includes('bếp') ||
    text.includes('dining') ||
    text.includes('f&b') ||
    text.includes('nhà hàng') ||
    text.includes('nước') ||
    text.includes('rượu') ||
    text.includes('bia') ||
    text.includes('cà phê') ||
    text.includes('trà') ||
    text.includes('bánh') ||
    text.includes('ăn uống')
  ) {
    return 'fnb';
  }
  return 'amenities';
};

// Helper cấu hình nội dung và nút bấm hành động chuẩn từng loại dịch vụ
export const getServiceActionConfig = (item: ServiceOrder) => {
  const cat = getServiceCategoryType(item);
  switch (cat) {
    case 'spa':
      return {
        catLabel: 'Spa & Trị liệu',
        catIcon: 'leaf',
        catColor: '#A855F7',
        pendingBadge: 'Chờ nhận lịch Spa',
        inProgressBadge: 'Đang chuẩn bị phòng Spa',
        deliveringBadge: 'KTV đang phục vụ',
        completedBadge: 'Đã hoàn tất liệu trình',
        claimText: 'TIẾP NHẬN ĐẶT LỊCH SPA',
        claimIcon: 'leaf',
        nextStepLabel: 'KTV ĐÃ SẴN SÀNG ĐÓN KHÁCH',
        nextStepIcon: 'sparkles',
        completeStepLabel: 'XÁC NHẬN HOÀN TẤT LIỆU TRÌNH',
        deliveringLabel: 'KTV đang phục vụ',
        completeSuccessMsg: 'Liệu trình Spa đã hoàn tất!',
      };
    case 'laundry':
      return {
        catLabel: 'Giặt ủi cao cấp',
        catIcon: 'shirt',
        catColor: '#06B6D4',
        pendingBadge: 'Chờ thu gom đồ',
        inProgressBadge: 'Đang giặt sấy / ủi',
        deliveringBadge: 'Đang mang đồ lên phòng',
        completedBadge: 'Đã giao đồ sạch',
        claimText: 'TIẾP NHẬN GIẶT ỦI',
        claimIcon: 'shirt',
        nextStepLabel: 'BẮT ĐẦU MANG ĐỒ LÊN PHÒNG',
        nextStepIcon: 'arrow-up-circle',
        completeStepLabel: 'XÁC NHẬN ĐÃ BÀN GIAO ĐỒ CHO KHÁCH',
        deliveringLabel: 'Đang mang đồ lên phòng',
        completeSuccessMsg: 'Đồ giặt ủi đã bàn giao thành công!',
      };
    case 'amenities':
      return {
        catLabel: 'Tiện ích phòng',
        catIcon: 'gift',
        catColor: '#EC4899',
        pendingBadge: 'Chờ chuẩn bị tiện ích',
        inProgressBadge: 'Buồng phòng đang chuẩn bị',
        deliveringBadge: 'Đang chuyển tới phòng',
        completedBadge: 'Đã bàn giao tiện ích',
        claimText: 'TIẾP NHẬN TIỆN ÍCH',
        claimIcon: 'gift',
        nextStepLabel: 'BẮT ĐẦU CHUYỂN TỚI PHÒNG',
        nextStepIcon: 'walk',
        completeStepLabel: 'XÁC NHẬN ĐÃ BÀN GIAO',
        deliveringLabel: 'Đang chuyển tới phòng',
        completeSuccessMsg: 'Tiện ích phòng đã được bàn giao!',
      };
    case 'fnb':
    default:
      return {
        catLabel: 'Ẩm thực & Đồ uống',
        catIcon: 'restaurant',
        catColor: '#F59E0B',
        pendingBadge: 'Chờ chế biến',
        inProgressBadge: 'Bếp đang chế biến',
        deliveringBadge: 'Đang mang lên phòng',
        completedBadge: 'Đã phục vụ xong',
        claimText: 'TIẾP NHẬN CHẾ BIẾN',
        claimIcon: 'restaurant',
        nextStepLabel: 'BẮT ĐẦU MANG LÊN PHÒNG',
        nextStepIcon: 'bicycle',
        completeStepLabel: 'XÁC NHẬN ĐÃ PHỤC VỤ MÓN',
        deliveringLabel: 'Đang mang lên phòng',
        completeSuccessMsg: 'Món ăn đã được phục vụ tại phòng!',
      };
  }
};

// Khóa thực hiện dịch vụ theo ngữ cảnh — khớp backend và Kanban Web
export const getServiceLockReason = (item: ServiceOrder): ServiceLockReason => {
  if (!item || isTransportService(item)) return null;
  const room = (item.room_number || '').trim();
  const hasRoom = room !== '' && room !== 'Chưa gán phòng' && room !== 'Chờ xếp';
  if (!hasRoom) return 'NO_ROOM';
  if (item.booking_status === 'checked_in') return null;
  const cat = getServiceCategoryType(item);
  return cat === 'fnb' || cat === 'spa' || cat === 'laundry' ? 'WAIT_CHECKIN' : null;
};

export const getServiceLockMessage = (item: ServiceOrder, reason: Exclude<ServiceLockReason, null>): string =>
  reason === 'NO_ROOM'
    ? `Đơn #${item.booking_code} chưa được gán phòng cụ thể. Vui lòng liên hệ Lễ tân gán phòng trước khi thực hiện dịch vụ!`
    : `Khách đơn #${item.booking_code} chưa làm thủ tục nhận phòng (Check-in). Dịch vụ ẩm thực / spa / giặt ủi yêu cầu khách có mặt tại phòng để phục vụ!`;

// Helper kiểm tra và tính toán thời gian quá hạn SLA phục vụ phòng
export const getSlaStatus = (item: ServiceOrder): SlaStatus | null => {
  if (!item || item.status === 'completed' || item.status === 'cancelled') {
    return null;
  }

  // 1. Khách CHƯA Check-in: Đơn đặt kèm khi book phòng (Pre-order), khách chưa tới phòng nên không tính SLA
  const isCheckedIn = item.booking_status ? item.booking_status === 'checked_in' : false;
  if (!isCheckedIn) {
    return null;
  }

  // 2. Đơn chưa được gán phòng: Chưa thể phục vụ vào phòng, không tính SLA
  const room = (item.room_number || '').trim();
  const hasRoom = room !== '' && room !== 'Chưa gán phòng' && room !== 'Chờ xếp';
  if (!hasRoom) {
    return null;
  }

  // 3. Nếu đơn có hẹn giờ cụ thể (Scheduled request time)
  if (item.is_scheduled && item.request_time) {
    const scheduledTime = new Date(item.request_time);
    if (!isNaN(scheduledTime.getTime())) {
      const diffMinutes = Math.floor((Date.now() - scheduledTime.getTime()) / 60000);
      // Chưa đến giờ hẹn phục vụ -> Không tính quá hạn
      if (diffMinutes < 0) return null;

      // Đã quá giờ hẹn từ 15 phút trở lên mà vẫn chờ xử lý
      if (item.status === 'pending' && diffMinutes >= 15) {
        return {
          isOverdue: true,
          label: `Trễ hẹn >${diffMinutes}p`,
          badgeBg: 'rgba(239, 68, 68, 0.18)',
          badgeTextColor: '#F87171',
          badgeBorderColor: 'rgba(239, 68, 68, 0.45)',
          borderColor: '#EF4444',
        };
      }
      if (item.status === 'in_progress' && diffMinutes >= 30) {
        return {
          isOverdue: true,
          label: `Làm trễ >${diffMinutes}p`,
          badgeBg: 'rgba(239, 68, 68, 0.18)',
          badgeTextColor: '#F87171',
          badgeBorderColor: 'rgba(239, 68, 68, 0.45)',
          borderColor: '#EF4444',
        };
      }
      if (item.status === 'delivering') {
        const updatedD = item.updated_at ? new Date(item.updated_at) : null;
        const deliveringMinutes =
          updatedD && !isNaN(updatedD.getTime())
            ? Math.max(0, Math.floor((Date.now() - updatedD.getTime()) / 60000))
            : diffMinutes;
        if (deliveringMinutes >= 20) {
          return {
            isOverdue: true,
            label: `Giao trễ >${deliveringMinutes}p`,
            badgeBg: 'rgba(192, 132, 252, 0.18)',
            badgeTextColor: '#C084FC',
            badgeBorderColor: 'rgba(192, 132, 252, 0.45)',
            borderColor: '#A855F7',
          };
        }
      }
      return null;
    }
  }

  // 4. Đơn phục vụ phòng trực tiếp (In-room service) hoặc đơn kích hoạt sau khi Check-in
  const baseTimeStr = item.updated_at || item.created_at;
  if (!baseTimeStr) return null;
  const d = new Date(baseTimeStr);
  if (isNaN(d.getTime())) return null;

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));

  if (item.status === 'pending' && elapsedMinutes >= 15) {
    return {
      isOverdue: true,
      label: `Chờ >${elapsedMinutes}p`,
      badgeBg: 'rgba(245, 158, 11, 0.18)',
      badgeTextColor: '#FBBF24',
      badgeBorderColor: 'rgba(245, 158, 11, 0.45)',
      borderColor: '#F59E0B',
    };
  }
  if (item.status === 'in_progress' && elapsedMinutes >= 30) {
    return {
      isOverdue: true,
      label: `Làm >${elapsedMinutes}p`,
      badgeBg: 'rgba(239, 68, 68, 0.18)',
      badgeTextColor: '#F87171',
      badgeBorderColor: 'rgba(239, 68, 68, 0.45)',
      borderColor: '#EF4444',
    };
  }
  if (item.status === 'delivering' && elapsedMinutes >= 20) {
    return {
      isOverdue: true,
      label: `Giao >${elapsedMinutes}p`,
      badgeBg: 'rgba(192, 132, 252, 0.18)',
      badgeTextColor: '#C084FC',
      badgeBorderColor: 'rgba(192, 132, 252, 0.45)',
      borderColor: '#A855F7',
    };
  }

  return null;
};

// Cấu hình giao diện huy hiệu trạng thái
export const getStatusBadgeConfig = (status: string, item?: ServiceOrder): StatusBadgeConfig => {
  const actionConfig = item ? getServiceActionConfig(item) : null;
  switch (status) {
    case 'pending':
      return {
        bg: 'rgba(245, 158, 11, 0.12)',
        border: 'rgba(245, 158, 11, 0.45)',
        text: '#FBBF24',
        label: actionConfig ? actionConfig.pendingBadge : 'Chờ xử lý',
      };
    case 'in_progress':
      return {
        bg: 'rgba(56, 189, 248, 0.12)',
        border: 'rgba(56, 189, 248, 0.45)',
        text: '#38BDF8',
        label: actionConfig ? actionConfig.inProgressBadge : 'Đang chuẩn bị',
      };
    case 'delivering':
      return {
        bg: 'rgba(168, 85, 247, 0.14)',
        border: 'rgba(168, 85, 247, 0.45)',
        text: '#C084FC',
        label: actionConfig ? actionConfig.deliveringBadge : 'Đang giao tận phòng',
      };
    case 'completed':
      return {
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.45)',
        text: '#34D399',
        label: actionConfig ? actionConfig.completedBadge : 'Đã phục vụ xong',
      };
    case 'cancelled':
      return {
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.4)',
        text: '#F87171',
        label: 'Đã hủy',
      };
    default:
      return {
        bg: '#1E293B',
        border: '#334155',
        text: '#94A3B8',
        label: status,
      };
  }
};

export interface AllergyWarningInfo {
  hasAllergy: boolean;
  title: string;
  matchedKeywords: string[];
}

/**
 * Helper phát hiện tự động yêu cầu Dị ứng thực phẩm / Ăn kiêng đặc biệt trong ghi chú đơn
 * Chuẩn khách sạn 5 sao: Bếp & Phục vụ không bao giờ được bỏ sót cảnh báo dị ứng!
 */
export const detectAllergyWarning = (note?: string | null): AllergyWarningInfo | null => {
  if (!note || typeof note !== 'string') return null;
  const lower = note.toLowerCase();

  // Bỏ tiền tố lý do hủy nếu có
  const clean = lower.replace(/\[đã hủy:.*?\]/g, '').trim();
  if (!clean) return null;

  const allergyKeywords = [
    'dị ứng', 'di ung', 'allergy', 'allergic', 'allergies',
    'hải sản', 'hai san', 'seafood', 'tôm', 'cua', 'mực', 'shrimp', 'crab', 'squid',
    'đậu phộng', 'dau phong', 'đậu phụng', 'dau phung', 'lạc', 'peanut', 'peanuts', 'nuts',
    'ăn chay', 'an chay', 'chay', 'vegetarian', 'vegan', 'halal', 'kosher',
    'không cay', 'khong cay', 'không ớt', 'khong ot', 'no spicy', 'ít cay', 'it cay',
    'không hành', 'khong hanh', 'không tỏi', 'khong toi', 'no onion', 'no garlic',
    'không sữa', 'khong sua', 'lactose', 'dairy', 'gluten', 'trứng', 'egg', 'kiêng'
  ];

  const matched = allergyKeywords.filter((kw) => clean.includes(kw));
  if (matched.length === 0) return null;

  const isDietary = matched.some((k) => k.includes('chay') || k.includes('vegan') || k.includes('halal') || k.includes('kiêng'));

  return {
    hasAllergy: true,
    title: isDietary ? 'YÊU CẦU ĂN KIÊNG / CHAY' : 'CẢNH BÁO DỊ ỨNG THỰC PHẨM',
    matchedKeywords: matched,
  };
};
