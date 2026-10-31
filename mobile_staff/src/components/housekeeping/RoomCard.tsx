import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../../constants/theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { styles } from './styles';
import type { RoomItem } from './types';

export const getStatusConfig = (status: string, isDark: boolean = true) => {
  switch (status) {
    case 'available':
      return {
        label: 'Phòng sạch',
        bg: isDark ? Palette.emerald.subtle : 'rgba(16, 185, 129, 0.12)',
        border: isDark ? Palette.emerald.border : 'rgba(16, 185, 129, 0.35)',
        text: isDark ? Palette.emerald.light : '#059669',
        dot: Palette.emerald.main,
        actionText: 'Dọn lại',
        actionBg: isDark ? Palette.surface.cardSecondary : '#F1F5F9',
        actionColor: isDark ? Palette.text.muted : '#475569',
        actionIcon: 'sparkles-outline',
      };
    case 'cleaning':
      return {
        label: 'Đang dọn',
        bg: isDark ? Palette.gold.subtle : 'rgba(245, 158, 11, 0.12)',
        border: isDark ? Palette.gold.border : 'rgba(245, 158, 11, 0.4)',
        text: isDark ? Palette.gold.light : '#D97706',
        dot: Palette.gold.main,
        actionText: 'DỌN XONG ✨',
        actionBg: Palette.emerald.main,
        actionColor: '#FFFFFF',
        actionIcon: 'checkmark-circle',
      };
    case 'occupied':
      return {
        label: 'Có khách',
        bg: isDark ? Palette.sky.subtle : 'rgba(56, 189, 248, 0.12)',
        border: isDark ? Palette.sky.border : 'rgba(56, 189, 248, 0.35)',
        text: isDark ? Palette.sky.light : '#0284C7',
        dot: Palette.sky.main,
        actionText: 'Vào dọn',
        actionBg: isDark ? Palette.surface.cardSecondary : '#F1F5F9',
        actionColor: isDark ? Palette.sky.extraLight : '#0369A1',
        actionIcon: 'bed-outline',
      };
    case 'maintenance':
      return {
        label: 'Bảo trì',
        bg: isDark ? Palette.rose.subtle : 'rgba(239, 68, 68, 0.12)',
        border: isDark ? Palette.rose.border : 'rgba(239, 68, 68, 0.35)',
        text: isDark ? Palette.rose.light : '#DC2626',
        dot: Palette.rose.main,
        actionText: 'Chờ sửa',
        actionBg: 'transparent',
        actionColor: Palette.rose.main,
        actionIcon: 'construct-outline',
      };
    default:
      return {
        label: status,
        bg: isDark ? Palette.surface.cardSecondary : '#F1F5F9',
        border: isDark ? Palette.border.subtle : '#E2E8F0',
        text: isDark ? Palette.text.muted : '#64748B',
        dot: isDark ? Palette.text.subtle : '#94A3B8',
        actionText: 'Cập nhật',
        actionBg: isDark ? Palette.surface.cardSecondary : '#F1F5F9',
        actionColor: isDark ? Palette.text.secondary : '#334155',
        actionIcon: 'create-outline',
      };
  }
};

const formatDateShort = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateStr;
  } catch {
    return dateStr;
  }
};

interface RoomCardProps {
  item: RoomItem;
  canAccessMinibar: boolean;
  canMarkCleaned: boolean;
  /** true khi phòng này đang xử lý 1 thao tác (hiện spinner, khóa nút) */
  actionLoading: boolean;
  onOpenDetail: (room: RoomItem) => void;
  onOpenMinibar: (room: RoomItem) => void;
  onOpenLostFound: (room: RoomItem) => void;
  onOpenBreakdown: (room: RoomItem) => void;
  onToggleCleaning: (room: RoomItem) => void;
  onCompleteMakeUp: (room: RoomItem) => void;
}

/**
 * Thẻ phòng (tách từ renderRoomCard). Bọc React.memo: chỉ render lại khi dữ liệu phòng
 * hoặc trạng thái loading của CHÍNH phòng đó đổi, không render lại cả lưới mỗi lần polling.
 */
function RoomCard({
  item,
  canAccessMinibar,
  canMarkCleaned,
  actionLoading,
  onOpenDetail,
  onOpenMinibar,
  onOpenLostFound,
  onOpenBreakdown,
  onToggleCleaning,
  onCompleteMakeUp,
}: RoomCardProps) {
  const { isDark } = useAppTheme();
  const config = getStatusConfig(item.status, isDark);
  const isAvailable = item.status === 'available';
  const isCleaning = item.status === 'cleaning';
  const isOccupied = item.status === 'occupied';
  const isMaintenance = item.status === 'maintenance';

  const currentBk = item.current_booking;
  const recentBk = item.recent_booking;
  const guestName = isOccupied
    ? (currentBk?.guest_name || recentBk?.guest_name)
    : isCleaning
    ? (recentBk?.guest_name || currentBk?.guest_name)
    : null;
  const bookingCode = isOccupied
    ? (currentBk?.booking_code || recentBk?.booking_code)
    : isCleaning
    ? (recentBk?.booking_code || currentBk?.booking_code)
    : null;
  const checkOutDate = currentBk?.check_out_date;
  const isInspectionRequested = item.latest_minibar_check?.status === 'requested';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        !isDark && {
          backgroundColor: '#FFFFFF',
          borderColor: '#E2E8F0',
          shadowColor: '#64748B',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 2,
        },
        isCleaning && (isDark ? styles.cardHighlightCleaning : {
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.05)',
        }),
        isInspectionRequested && (isDark ? styles.cardHighlightInspection : {
          borderColor: '#F59E0B',
          borderWidth: 2,
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
        }),
      ]}
      onPress={() => onOpenDetail(item)}
      activeOpacity={0.85}
    >
      {/* Hàng 1: Số phòng to + Badge tầng (Trái) + Trạng thái phòng (Phải) */}
      <View style={styles.cardTopRow}>
        <View
          style={[
            styles.roomBadge,
            !isDark && {
              backgroundColor: '#F1F5F9',
              borderColor: '#CBD5E1',
            },
          ]}
        >
          <Text style={[styles.roomNumber, !isDark && { color: '#0F172A', fontWeight: '900' }]}>
            P.{item.room_number}
          </Text>
          <View
            style={[
              styles.floorPill,
              !isDark && {
                backgroundColor: 'rgba(245, 158, 11, 0.18)',
                borderColor: 'rgba(245, 158, 11, 0.45)',
              },
            ]}
          >
            <Text style={[styles.floorPillText, !isDark && { color: '#B45309', fontWeight: '900' }]}>
              {item.floor}F
            </Text>
          </View>
        </View>
        <View style={[styles.statusPill, { backgroundColor: config.bg, borderColor: config.border }]}>
          <View style={[styles.pulseDot, { backgroundColor: config.dot }]} />
          <Text style={[styles.statusPillText, { color: config.text }]} numberOfLines={1} ellipsizeMode="tail">
            {config.label}
          </Text>
        </View>
      </View>

      {/* Hàng 2: Hạng phòng (gọn gàng, thanh lịch) */}
      <Text style={[styles.roomType, !isDark && { color: '#64748B' }]} numberOfLines={1}>
        {item.category_name || 'Phòng tiêu chuẩn'}
      </Text>

      {/* Cảnh báo Lễ tân đợi kiểm tra Minibar (Check-out) - Chỉ Buồng phòng & Quản lý */}
      {canAccessMinibar && isInspectionRequested && (
        <TouchableOpacity
          style={styles.inspectionAlertBanner}
          onPress={() => onOpenMinibar(item)}
          activeOpacity={0.8}
        >
          <View style={styles.inspectionAlertHeader}>
            <View style={styles.inspectionPulseBadge}>
              <Ionicons name="notifications" size={10} color="#FFF" style={{ marginRight: 3 }} />
              <Text style={styles.inspectionPulseText}>CHECK-OUT</Text>
            </View>
            <Text style={styles.inspectionActionText}>Kiểm ngay ⚡</Text>
          </View>
          <Text style={styles.inspectionSubText} numberOfLines={1}>Lễ tân đang đợi quyết toán</Text>
        </TouchableOpacity>
      )}

      {/* Hàng 3: Khối thông tin khách hàng / Sự cố theo chuẩn PMS Web */}
      {isOccupied ? (
        <View style={[styles.guestInfoCardOccupied, !isDark && { backgroundColor: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.22)' }]}>
          <View style={styles.guestNameRow}>
            <Ionicons name="person" size={11} color={!isDark ? '#2563EB' : '#60A5FA'} style={{ marginRight: 4 }} />
            <Text style={[styles.guestNameText, !isDark && { color: '#1D4ED8' }]} numberOfLines={1}>
              {guestName || 'Khách lưu trú'}
            </Text>
          </View>
          <View style={styles.guestMetaRow}>
            {bookingCode ? (
              <Text style={[styles.bookingCodeBadge, !isDark && { color: '#2563EB' }]}>#{bookingCode}</Text>
            ) : null}
            {checkOutDate ? (
              <Text style={[styles.checkoutDateText, !isDark && { color: '#64748B' }]}>Trả: {formatDateShort(checkOutDate)}</Text>
            ) : null}
          </View>
          {item.is_cleaning_requested && (
            <View style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.5)', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 5, flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="sparkles" size={12} color="#38BDF8" style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 10, color: '#38BDF8', fontWeight: '700', flex: 1 }} numberOfLines={1}>
                🧹 Yêu cầu dọn: {item.cleaning_request_note || 'Dọn phòng lưu trú'}
              </Text>
            </View>
          )}
        </View>
      ) : isCleaning ? (
        <View style={[styles.cleaningInfoCard, !isDark && { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }]}>
          <View style={styles.guestNameRow}>
            <Ionicons name="sparkles" size={11} color={!isDark ? '#D97706' : '#FBBF24'} style={{ marginRight: 4 }} />
            <Text style={[styles.cleaningGuestText, !isDark && { color: '#B45309' }]} numberOfLines={1}>
              {guestName ? `Khách: ${guestName}` : 'Đang chờ dọn dẹp'}
            </Text>
          </View>
          {bookingCode ? (
            <Text style={[styles.bookingCodeCleaning, !isDark && { color: '#D97706' }]}>#{bookingCode}</Text>
          ) : null}
        </View>
      ) : isMaintenance ? (
        <View style={[styles.maintenanceInfoCard, !isDark && { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.22)' }]}>
          <Ionicons name="construct" size={11} color="#EF4444" style={{ marginRight: 4 }} />
          <Text style={[styles.maintenanceEquipText, !isDark && { color: '#B91C1C' }]} numberOfLines={1}>
            {item.active_maintenance?.equipment_name || 'Đang bảo trì'}
          </Text>
        </View>
      ) : (
        <View style={[styles.availableInfoCard, !isDark && { backgroundColor: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.22)' }]}>
          <Ionicons name="checkmark-circle" size={11} color={!isDark ? '#059669' : '#34D399'} style={{ marginRight: 4 }} />
          <Text style={[styles.availableInfoText, !isDark && { color: '#047857' }]} numberOfLines={1}>
            Sẵn sàng đón khách
          </Text>
        </View>
      )}

      {/* Hàng 4: Dải thao tác nghiệp vụ tinh gọn & phân quyền chính xác */}
      {isMaintenance ? (
        <View style={styles.cardToolBarSingle}>
          <View style={[styles.cardToolBtnSingle, { borderColor: 'rgba(239, 68, 68, 0.25)', backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}>
            <Ionicons name="time" size={12} color="#EF4444" />
            <Text style={[styles.cardToolBtnTextSingle, { color: '#EF4444' }]}>Kỹ thuật đang xử lý</Text>
          </View>
        </View>
      ) : isAvailable ? (
        /* PHÒNG SẠCH / TRỐNG: Chỉ hiển thị nút Báo hỏng thiết bị */
        <View style={styles.cardToolBarSingle}>
          <TouchableOpacity
            style={[styles.cardToolBtnSingle, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
            onPress={() => onOpenBreakdown(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="construct" size={12} color="#EF4444" />
            <Text style={[styles.cardToolBtnTextSingle, { color: '#EF4444' }]}>Báo hỏng thiết bị</Text>
          </TouchableOpacity>
        </View>
      ) : isCleaning && canMarkCleaned ? (
        /* BUỒNG PHÒNG ĐANG DỌN: Dọn xong 1 chạm + Hàng công cụ */
        <View style={styles.actionGroupCleaning}>
          <View style={styles.cardToolBar}>
            <TouchableOpacity
              style={[styles.cardToolBtn, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
              onPress={() => onOpenMinibar(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="wine" size={13} color="#F59E0B" />
              <Text style={[styles.cardToolBtnText, { color: '#F59E0B' }]} numberOfLines={1}>Minibar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardToolBtn, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
              onPress={() => onOpenLostFound(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="briefcase" size={13} color="#8B5CF6" />
              <Text style={[styles.cardToolBtnText, { color: '#8B5CF6' }]} numberOfLines={1}>Đồ quên</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardToolBtn, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
              onPress={() => onOpenBreakdown(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="construct" size={13} color="#EF4444" />
              <Text style={[styles.cardToolBtnText, { color: '#EF4444' }]} numberOfLines={1}>Báo hỏng</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[
              styles.actionFullBtn,
              { backgroundColor: '#10B981' },
              actionLoading && { opacity: 0.65 },
            ]}
            onPress={() => onToggleCleaning(item)}
            disabled={actionLoading}
            activeOpacity={0.8}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={[styles.actionFullBtnText, { color: '#FFFFFF' }]}>Đã dọn xong ✨</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : canAccessMinibar ? (
        /* BUỒNG PHÒNG (PHÒNG CÓ KHÁCH): 3 nút tiện ích chuẩn web + Nút Dọn phòng nếu khách yêu cầu */
        <View>
          <View style={styles.cardToolBar}>
            <TouchableOpacity
              style={[styles.cardToolBtn, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
              onPress={() => onOpenMinibar(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="wine" size={13} color="#F59E0B" />
              <Text style={[styles.cardToolBtnText, { color: '#F59E0B' }]} numberOfLines={1}>Minibar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardToolBtn, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
              onPress={() => onOpenLostFound(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="briefcase" size={13} color="#8B5CF6" />
              <Text style={[styles.cardToolBtnText, { color: '#8B5CF6' }]} numberOfLines={1}>Đồ quên</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardToolBtn, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
              onPress={() => onOpenBreakdown(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="construct" size={13} color="#EF4444" />
              <Text style={[styles.cardToolBtnText, { color: '#EF4444' }]} numberOfLines={1}>Báo hỏng</Text>
            </TouchableOpacity>
          </View>
          {item.is_cleaning_requested && (
            <TouchableOpacity
              style={[
                styles.actionFullBtn,
                { backgroundColor: '#0284C7', marginTop: 6 },
                actionLoading && { opacity: 0.65 },
              ]}
              onPress={() => onCompleteMakeUp(item)}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={[styles.actionFullBtnText, { color: '#FFFFFF', fontWeight: 'bold' }]}>
                    Đã dọn xong phòng khách ở ✨
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      ) : (
        /* PHỤC VỤ (PHÒNG CÓ KHÁCH / ĐANG DỌN): 2 Nút Báo đồ quên & Báo hỏng */
        <View style={styles.cardToolBar}>
          <TouchableOpacity
            style={[styles.cardToolBtn, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
            onPress={() => onOpenLostFound(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="briefcase" size={13} color="#8B5CF6" />
            <Text style={[styles.cardToolBtnText, { color: '#8B5CF6' }]} numberOfLines={1}>Đồ quên</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cardToolBtn, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
            onPress={() => onOpenBreakdown(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="construct" size={13} color="#EF4444" />
            <Text style={[styles.cardToolBtnText, { color: '#EF4444' }]} numberOfLines={1}>Báo hỏng</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default React.memo(RoomCard);
