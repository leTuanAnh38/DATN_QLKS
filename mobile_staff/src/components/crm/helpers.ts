import apiClient from '../../api/client';
import { DEFAULT_API_URL } from '../../api/config';

// Helper lấy URL ảnh dịch vụ / món ăn
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

// Helper format ngày DD/MM/YYYY
export const formatDateDisplay = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  try {
    const parts = String(dateStr).split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  } catch {}
  return String(dateStr);
};

// Helper format thời gian HH:mm • DD/MM/YYYY
export const formatDateTimeDisplay = (isoStr?: string | null): string => {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${time} • ${date}`;
  } catch {
    return String(isoStr);
  }
};

// Helper nhận diện khách vãng lai (Offline / Walk-in) hay Thành viên Web
export const isWalkinGuest = (guest: any): boolean => {
  if (!guest) return false;
  if (guest.guest_type === 'walkin') return true;
  if (guest.is_auto_created) return true;
  const username = String(guest.username || '').toLowerCase();
  const email = String(guest.email || '').toLowerCase();
  if (username.startsWith('walkin_')) return true;
  if (email.endsWith('.local') || email.includes('@walkin.')) return true;
  if (guest.has_usable_password === false) return true;
  return false;
};

// Config trạng thái đơn đặt phòng đồng bộ PMS Web
export const getBookingStatusBadge = (status: string = '', statusDisplay?: string) => {
  const s = String(status).toLowerCase();
  if (s === 'checked_in') {
    return { label: statusDisplay || 'Đang ở', bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: 'rgba(16, 185, 129, 0.35)' };
  }
  if (s === 'confirmed') {
    return { label: statusDisplay || 'Đã xác nhận', bg: 'rgba(56, 189, 248, 0.15)', text: '#0284C7', border: 'rgba(56, 189, 248, 0.35)' };
  }
  if (s === 'pending') {
    return { label: statusDisplay || 'Chờ duyệt', bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.35)' };
  }
  if (s === 'checked_out') {
    return { label: statusDisplay || 'Đã trả phòng', bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7', border: 'rgba(168, 85, 247, 0.35)' };
  }
  if (s === 'completed') {
    return { label: statusDisplay || 'Hoàn tất', bg: 'rgba(100, 116, 139, 0.15)', text: '#64748B', border: 'rgba(100, 116, 139, 0.35)' };
  }
  if (s === 'cancelled') {
    return { label: statusDisplay || 'Đã hủy', bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.35)' };
  }
  return { label: statusDisplay || status, bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', border: 'rgba(148, 163, 184, 0.35)' };
};

// Config trạng thái dịch vụ đồng bộ Web
export const getServiceStatusBadge = (status: string = '', statusDisplay?: string) => {
  const s = String(status).toLowerCase();
  if (s === 'completed') {
    return { label: statusDisplay || 'Hoàn thành', bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: 'rgba(16, 185, 129, 0.35)' };
  }
  if (s === 'in_progress') {
    return { label: statusDisplay || 'Đang phục vụ', bg: 'rgba(56, 189, 248, 0.15)', text: '#0284C7', border: 'rgba(56, 189, 248, 0.35)' };
  }
  if (s === 'pending') {
    return { label: statusDisplay || 'Chờ xử lý', bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.35)' };
  }
  if (s === 'cancelled') {
    return { label: statusDisplay || 'Đã hủy', bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.35)' };
  }
  return { label: statusDisplay || status, bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', border: 'rgba(148, 163, 184, 0.35)' };
};

// Badge hạng thẻ VIP tối ưu độ tương phản cho cả Dark và Light mode
export const getTierBadge = (tier: string = '', isDark: boolean = true) => {
  const t = String(tier).toLowerCase();
  if (t.includes('diamond') || t.includes('kim cương')) {
    return {
      label: 'Kim Cương',
      bg: isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 132, 199, 0.12)',
      text: isDark ? '#38BDF8' : '#0284C7',
      border: isDark ? 'rgba(56, 189, 248, 0.55)' : 'rgba(2, 132, 199, 0.4)',
    };
  }
  if (t.includes('gold') || t.includes('vàng')) {
    return {
      label: 'Vàng',
      bg: isDark ? 'rgba(245, 158, 11, 0.22)' : 'rgba(217, 119, 6, 0.12)',
      text: isDark ? '#FBBF24' : '#B45309',
      border: isDark ? 'rgba(245, 158, 11, 0.55)' : 'rgba(217, 119, 6, 0.4)',
    };
  }
  if (t.includes('silver') || t.includes('bạc')) {
    return {
      label: 'Bạc',
      bg: isDark ? '#334155' : '#E2E8F0',
      text: isDark ? '#FFFFFF' : '#0F172A',
      border: isDark ? '#94A3B8' : '#94A3B8',
    };
  }
  return {
    label: 'Đồng',
    bg: isDark ? 'rgba(217, 119, 6, 0.22)' : 'rgba(180, 83, 9, 0.12)',
    text: isDark ? '#F59E0B' : '#92400E',
    border: isDark ? 'rgba(217, 119, 6, 0.55)' : 'rgba(180, 83, 9, 0.4)',
  };
};

