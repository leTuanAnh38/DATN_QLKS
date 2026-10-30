import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './styles';
import type { RoomItem } from './types';

export const getStatusConfig = (status: string) => {
  switch (status) {
    case 'available':
      return {
        label: 'Phòng sạch',
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.4)',
        text: '#34D399',
        dot: '#10B981',
        actionText: 'Dọn lại',
        actionBg: '#1E293B',
        actionColor: '#94A3B8',
        actionIcon: 'sparkles-outline',
      };
    case 'cleaning':
      return {
        label: 'Đang dọn',
        bg: 'rgba(245, 158, 11, 0.14)',
        border: 'rgba(245, 158, 11, 0.5)',
        text: '#FBBF24',
        dot: '#F59E0B',
        actionText: 'DỌN XONG ✨',
        actionBg: '#10B981',
        actionColor: '#0A0F1D',
        actionIcon: 'checkmark-circle',
      };
    case 'occupied':
      return {
        label: 'Có khách',
        bg: 'rgba(59, 130, 246, 0.12)',
        border: 'rgba(59, 130, 246, 0.4)',
        text: '#60A5FA',
        dot: '#3B82F6',
        actionText: 'Vào dọn',
        actionBg: '#1E293B',
        actionColor: '#93C5FD',
        actionIcon: 'bed-outline',
      };
    case 'maintenance':
      return {
        label: 'Bảo trì',
        bg: 'rgba(239, 68, 68, 0.14)',
        border: 'rgba(239, 68, 68, 0.4)',
        text: '#F87171',
        dot: '#EF4444',
        actionText: 'Chờ sửa',
        actionBg: 'transparent',
        actionColor: '#EF4444',
        actionIcon: 'construct-outline',
      };
    default:
      return {
        label: status,
        bg: '#1E293B',
        border: '#334155',
        text: '#94A3B8',
        dot: '#64748B',
        actionText: 'Cập nhật',
        actionBg: '#1E293B',
        actionColor: '#CBD5E1',
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
}: RoomCardProps) {  const config = getStatusConfig(item.status);
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
        isCleaning && styles.cardHighlightCleaning,
        isInspectionRequested && styles.cardHighlightInspection,
      ]}
      onPress={() => onOpenDetail(item)}
      activeOpacity={0.85}
    >
      {/* Hàng 1: Số phòng to + Badge tầng (Trái) + Trạng thái phòng (Phải) */}
      <View style={styles.cardTopRow}>
        <View style={styles.roomBadge}>
          <Text style={styles.roomNumber}>P.{item.room_number}</Text>
          <View style={styles.floorPill}>
            <Text style={styles.floorPillText}>{item.floor}F</Text>
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
      <Text style={styles.roomType} numberOfLines={1}>
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
        <View style={styles.guestInfoCardOccupied}>
          <View style={styles.guestNameRow}>
            <Ionicons name="person" size={11} color="#60A5FA" style={{ marginRight: 4 }} />
            <Text style={styles.guestNameText} numberOfLines={1}>
              {guestName || 'Khách lưu trú'}
            </Text>
          </View>
          <View style={styles.guestMetaRow}>
            {bookingCode ? (
              <Text style={styles.bookingCodeBadge}>#{bookingCode}</Text>
            ) : null}
            {checkOutDate ? (
              <Text style={styles.checkoutDateText}>Trả: {formatDateShort(checkOutDate)}</Text>
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
        <View style={styles.cleaningInfoCard}>
          <View style={styles.guestNameRow}>
            <Ionicons name="sparkles" size={11} color="#FBBF24" style={{ marginRight: 4 }} />
            <Text style={styles.cleaningGuestText} numberOfLines={1}>
              {guestName ? `Khách: ${guestName}` : 'Đang chờ dọn dẹp'}
            </Text>
          </View>
          {bookingCode ? (
            <Text style={styles.bookingCodeCleaning}>#{bookingCode}</Text>
          ) : null}
        </View>
      ) : isMaintenance ? (
        <View style={styles.maintenanceInfoCard}>
          <Ionicons name="construct" size={11} color="#EF4444" style={{ marginRight: 4 }} />
          <Text style={styles.maintenanceEquipText} numberOfLines={1}>
            {item.active_maintenance?.equipment_name || 'Đang bảo trì'}
          </Text>
        </View>
      ) : (
        <View style={styles.availableInfoCard}>
          <Ionicons name="checkmark-circle" size={11} color="#34D399" style={{ marginRight: 4 }} />
          <Text style={styles.availableInfoText} numberOfLines={1}>
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
        /* PHÒNG SẠCH / TRỐNG: Chỉ hiển thị nút Báo hỏng thiết bị (Tuyệt đối không có Minibar và Đồ quên vì phòng trống không có khách!) */
        <View style={styles.cardToolBarSingle}>
          <TouchableOpacity
            style={styles.cardToolBtnSingle}
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
              style={styles.cardToolBtn}
              onPress={() => onOpenMinibar(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="wine" size={13} color="#F59E0B" />
              <Text style={[styles.cardToolBtnText, { color: '#F59E0B' }]} numberOfLines={1}>Minibar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardToolBtn}
              onPress={() => onOpenLostFound(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="briefcase" size={13} color="#A78BFA" />
              <Text style={[styles.cardToolBtnText, { color: '#A78BFA' }]} numberOfLines={1}>Đồ quên</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardToolBtn}
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
              <ActivityIndicator size="small" color="#0A0F1D" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={13} color="#0A0F1D" style={{ marginRight: 4 }} />
                <Text style={[styles.actionFullBtnText, { color: '#0A0F1D' }]}>Đã dọn xong ✨</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : canAccessMinibar ? (
        /* BUỒNG PHÒNG (PHÒNG CÓ KHÁCH): 3 nút tiện ích chuẩn web + Nút Dọn phòng nếu khách yêu cầu */
        <View>
          <View style={styles.cardToolBar}>
            <TouchableOpacity
              style={styles.cardToolBtn}
              onPress={() => onOpenMinibar(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="wine" size={13} color="#F59E0B" />
              <Text style={[styles.cardToolBtnText, { color: '#F59E0B' }]} numberOfLines={1}>Minibar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardToolBtn}
              onPress={() => onOpenLostFound(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="briefcase" size={13} color="#A78BFA" />
              <Text style={[styles.cardToolBtnText, { color: '#A78BFA' }]} numberOfLines={1}>Đồ quên</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardToolBtn}
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
                { backgroundColor: '#38BDF8', marginTop: 6 },
                actionLoading && { opacity: 0.65 },
              ]}
              onPress={() => onCompleteMakeUp(item)}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#0A0F1D" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={13} color="#0A0F1D" style={{ marginRight: 4 }} />
                  <Text style={[styles.actionFullBtnText, { color: '#0A0F1D', fontWeight: 'bold' }]}>
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
            style={styles.cardToolBtn}
            onPress={() => onOpenLostFound(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="briefcase" size={13} color="#A78BFA" />
            <Text style={[styles.cardToolBtnText, { color: '#A78BFA' }]} numberOfLines={1}>Đồ quên</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cardToolBtn}
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
