import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../../api/client';
import { getCachedApiBaseUrl } from '../../api/config';
import { Palette } from '../../constants/theme';
import { useAppTheme, resolveMobileMediaUrl } from '../../contexts/ThemeContext';


export interface ServiceRequestItem {
  id: number;
  booking_code: string;
  room_number: string;
  guest_name: string;
  guest_phone: string;
  service_name: string;
  service_image?: string;
  quantity: number;
  total_price: string;
  request_time: string | null;
  status: string;
  status_display: string;
  is_scheduled?: boolean;
  assigned_staff: number | null;
  assigned_staff_name: string;
  note: string;
  created_at: string;
}

// Helper lấy URL ảnh xe đưa đón
export const getVehicleImage = (item: any): string => {
  const raw =
    item?.service_image ||
    item?.service?.image ||
    item?.service?.image_url ||
    item?.image_url ||
    item?.image;
  if (!raw || typeof raw !== 'string') {
    return 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=800&q=80';
  }
  return resolveMobileMediaUrl(raw, apiClient.defaults.baseURL || getCachedApiBaseUrl());
};

// Helper định dạng ngày giờ
export const formatDateTime = (dateStr?: string | null): string => {
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

export const getStatusBadgeConfig = (status: string) => {
  switch (status) {
    case 'pending':
      return {
        bg: Palette.gold.subtle,
        border: Palette.gold.border,
        text: Palette.gold.light,
        label: 'Chờ nhận',
        icon: 'time-outline' as const,
      };
    case 'in_progress':
      return {
        bg: Palette.sky.subtle,
        border: Palette.sky.border,
        text: Palette.sky.main,
        label: 'Đang chuẩn bị',
        icon: 'car-sport-outline' as const,
      };
    case 'delivering':
      return {
        bg: Palette.purple.subtle,
        border: Palette.purple.border,
        text: Palette.purple.light,
        label: 'Đang đón khách',
        icon: 'navigate-outline' as const,
      };
    case 'completed':
      return {
        bg: Palette.emerald.subtle,
        border: Palette.emerald.border,
        text: Palette.emerald.light,
        label: 'Đã hoàn tất',
        icon: 'checkmark-circle-outline' as const,
      };
    case 'cancelled':
      return {
        bg: Palette.rose.subtle,
        border: Palette.rose.border,
        text: Palette.rose.light,
        label: 'Đã hủy',
        icon: 'close-circle-outline' as const,
      };
    default:
      return {
        bg: Palette.surface.cardSecondary,
        border: Palette.border.subtle,
        text: Palette.text.muted,
        label: status,
        icon: 'ellipse-outline' as const,
      };
  }
};

export interface TransportCardProps {
  item: ServiceRequestItem;
  isMyTask: boolean;
  isActionLoading: boolean;
  canOperate?: boolean;
  canAssign?: boolean;
  onClaim: (item: ServiceRequestItem) => void;
  onOpenAssign?: (item: ServiceRequestItem) => void;
  onUpdateStatus: (item: ServiceRequestItem, newStatus: string, label: string) => void;
  onOpenCancel?: (item: ServiceRequestItem) => void;
  onCallGuest: (phone: string) => void;
  onSendSms: (phone: string, guestName: string) => void;
  onOpenMap: (destination: string) => void;
}

export const TransportCard: React.FC<TransportCardProps> = React.memo(({
  item,
  isMyTask,
  isActionLoading,
  canOperate = true,
  canAssign = false,
  onClaim,
  onOpenAssign,
  onUpdateStatus,
  onOpenCancel,
  onCallGuest,
  onSendSms,
  onOpenMap,
}) => {
  const { isDark } = useAppTheme();
  const badge = getStatusBadgeConfig(item.status);

  return (
    <View
      style={[
        styles.card,
        !isDark && {
          backgroundColor: '#FFFFFF',
          borderColor: isMyTask ? '#A855F7' : '#E2E8F0',
          shadowColor: '#64748B',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 2,
        },
        isMyTask && isDark && styles.cardMyTask,
      ]}
    >
      {/* Header cuốc xe */}
      <View style={styles.cardHeader}>
        <View style={[styles.roomTag, !isDark && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
          <Ionicons name="bed" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
          <Text style={[styles.roomTagText, !isDark && { color: '#0F172A' }]}>
            {item.room_number ? `P.${item.room_number}` : 'Đón Sảnh'}
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
          <Ionicons name={badge.icon} size={12} color={badge.text} style={{ marginRight: 4 }} />
          <Text style={[styles.statusBadgeText, { color: badge.text }]}>
            {item.status_display || badge.label}
          </Text>
        </View>
      </View>

      {/* Tiêu đề Dịch vụ xe & Ảnh xe */}
      <View style={styles.serviceRow}>
        <View style={styles.carThumbBox}>
          <Image
            source={{ uri: getVehicleImage(item) }}
            style={styles.carThumbImg}
            resizeMode="cover"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.serviceName, !isDark && { color: '#0F172A' }]}>{item.service_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            <Text style={[styles.bookingCode, !isDark && { color: '#64748B' }]}>Mã: #{item.booking_code}</Text>
            {item.total_price ? (
              <>
                <Text style={styles.dotSeparator}>•</Text>
                <Text style={styles.priceTagText}>
                  {parseInt(item.total_price, 10).toLocaleString('vi-VN')} đ
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>

      {/* Thông tin khách hàng */}
      <View style={[styles.passengerBox, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
        <View style={styles.passengerRow}>
          <Ionicons name="person" size={14} color={isDark ? '#CBD5E1' : '#475569'} />
          <Text style={[styles.passengerName, !isDark && { color: '#0F172A' }]}>{item.guest_name || 'Khách sạn'}</Text>
        </View>

        {item.guest_phone ? (
          <TouchableOpacity
            style={styles.guestPhonePill}
            onPress={() => onCallGuest(item.guest_phone)}
            activeOpacity={0.7}
          >
            <Ionicons name="call" size={12} color="#10B981" style={{ marginRight: 4 }} />
            <Text style={styles.guestPhoneText}>{item.guest_phone}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Thời gian đặt cuốc xe & Giờ hẹn đón */}
      <View style={[styles.transportTimingBox, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
        {item.created_at ? (
          <View style={styles.transportTimingItem}>
            <Ionicons name="time-outline" size={13} color="#0284C7" style={{ marginRight: 4 }} />
            <Text style={[styles.transportTimingLabel, !isDark && { color: '#64748B' }]}>Đặt lúc:</Text>
            <Text style={[styles.transportTimingValue, !isDark && { color: '#334155' }]}>{formatDateTime(item.created_at)}</Text>
          </View>
        ) : null}

        {item.is_scheduled && item.request_time ? (
          <View style={[styles.transportTimingItem, styles.transportTimingScheduled]}>
            <Ionicons name="alarm-outline" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
            <Text style={[styles.transportTimingLabel, { color: '#D97706' }]}>Giờ đón:</Text>
            <Text style={[styles.transportTimingValue, { color: '#D97706', fontWeight: '800' }]}>
              {formatDateTime(item.request_time)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Ghi chú lộ trình / chuyến bay */}
      {item.note ? (
        <View style={[styles.noteBox, !isDark && { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }]}>
          <Ionicons name="navigate-circle" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
          <Text style={[styles.noteText, !isDark && { color: '#334155' }]}>{item.note}</Text>
        </View>
      ) : null}

      {/* Tài xế phụ trách */}
      <View style={styles.driverInfoRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
          <Text style={[styles.driverLabel, !isDark && { color: '#64748B' }]}>Tài xế nhận: </Text>
          <Text
            style={[
              styles.driverValue,
              { flexShrink: 1 },
              !isDark && { color: '#334155' },
              isMyTask && { color: '#F59E0B', fontWeight: '800' },
            ]}
            numberOfLines={1}
          >
            {item.assigned_staff_name ? item.assigned_staff_name : 'Chưa có ai nhận'}
            {isMyTask ? ' (Bạn)' : ''}
          </Text>
        </View>
        {canAssign &&
          onOpenAssign &&
          item.status !== 'completed' &&
          item.status !== 'cancelled' && (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: isDark ? 'rgba(56, 189, 248, 0.14)' : '#EFF6FF',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(56, 189, 248, 0.4)' : '#93C5FD',
              }}
              onPress={() => onOpenAssign(item)}
              disabled={isActionLoading}
              activeOpacity={0.75}
            >
              <Ionicons
                name="person-add-outline"
                size={12}
                color={isDark ? '#38BDF8' : '#0284C7'}
                style={{ marginRight: 4 }}
              />
              <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#38BDF8' : '#0284C7' }}>
                {item.assigned_staff_name ? 'Đổi tài xế' : 'Phân công'}
              </Text>
            </TouchableOpacity>
          )}
      </View>

      {/* Nút hành động 2 tầng thoáng, không bị chèn ép trên màn hình nhỏ */}
      <View style={styles.actionStack}>
        {/* Tầng 1: Tiện ích Bản đồ, SMS & Gọi điện cho khách */}
        <View style={styles.utilityRow}>
          <TouchableOpacity
            style={[styles.utilityBtn, styles.utilityBtnMap, !isDark && { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}
            onPress={() => onOpenMap(item.note || item.service_name)}
            activeOpacity={0.75}
          >
            <Ionicons name="navigate-circle" size={16} color="#0284C7" style={{ marginRight: 5 }} />
            <Text style={[styles.utilityBtnText, { color: isDark ? '#38BDF8' : '#0284C7' }]} numberOfLines={1}>
              Chỉ đường
            </Text>
          </TouchableOpacity>

          {item.guest_phone ? (
            <TouchableOpacity
              style={[styles.utilityBtn, styles.utilityBtnSms, !isDark && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
              onPress={() => onSendSms(item.guest_phone, item.guest_name)}
              activeOpacity={0.75}
            >
              <Ionicons name="chatbubble-ellipses" size={14} color="#D97706" style={{ marginRight: 5 }} />
              <Text style={[styles.utilityBtnText, { color: isDark ? '#FBBF24' : '#B45309' }]} numberOfLines={1}>
                Nhắn tin
              </Text>
            </TouchableOpacity>
          ) : null}

          {item.guest_phone ? (
            <TouchableOpacity
              style={[styles.utilityBtn, styles.utilityBtnCall, !isDark && { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
              onPress={() => onCallGuest(item.guest_phone)}
              activeOpacity={0.75}
            >
              <Ionicons name="call" size={14} color="#10B981" style={{ marginRight: 5 }} />
              <Text style={[styles.utilityBtnText, { color: isDark ? '#34D399' : '#059669' }]} numberOfLines={1}>
                Gọi khách
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Tầng 2: Nút hành động chính của chuyến đi + Nút Hủy */}
        <View style={styles.actionContainer}>
          {/* Chưa có ai nhận -> Nút Tiếp nhận cuốc xe */}
          {canOperate && !item.assigned_staff && (item.status === 'pending' || item.status === 'in_progress') && (
            <TouchableOpacity
              style={[styles.claimButton, isActionLoading && { opacity: 0.65 }]}
              onPress={() => onClaim(item)}
              disabled={isActionLoading}
              activeOpacity={0.8}
            >
              {isActionLoading ? (
                <ActivityIndicator size="small" color="#0A0F1D" />
              ) : (
                <>
                  <Ionicons name="hand-right" size={15} color="#0A0F1D" style={{ marginRight: 6 }} />
                  <Text style={styles.claimButtonText} numberOfLines={1}>TIẾP NHẬN CUỐC</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Đang chuẩn bị -> Bắt đầu đi đón */}
          {canOperate && item.status === 'in_progress' && (
            <TouchableOpacity
              style={[styles.departButton, isActionLoading && { opacity: 0.65 }]}
              onPress={() => onUpdateStatus(item, 'delivering', 'Đang đi đón khách')}
              disabled={isActionLoading}
              activeOpacity={0.8}
            >
              {isActionLoading ? (
                <ActivityIndicator size="small" color="#0A0F1D" />
              ) : (
                <>
                  <Ionicons name="navigate" size={15} color="#0A0F1D" style={{ marginRight: 6 }} />
                  <Text style={styles.departButtonText} numberOfLines={1}>BẮT ĐẦU ĐÓN KHÁCH</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Đang đi đón -> Hoàn tất */}
          {canOperate && item.status === 'delivering' && (
            <TouchableOpacity
              style={[styles.completeButton, isActionLoading && { opacity: 0.65 }]}
              onPress={() => onUpdateStatus(item, 'completed', 'Hoàn tất chuyến xe')}
              disabled={isActionLoading}
              activeOpacity={0.8}
            >
              {isActionLoading ? (
                <ActivityIndicator size="small" color="#0A0F1D" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={16} color="#0A0F1D" style={{ marginRight: 6 }} />
                  <Text style={styles.completeButtonText} numberOfLines={1}>ĐÃ TRẢ KHÁCH XONG</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Nút Hủy cuốc xe (chỉ khi chờ nhận hoặc đang chuẩn bị) */}
          {canOperate &&
            onOpenCancel &&
            (item.status === 'pending' || item.status === 'in_progress') && (
              <TouchableOpacity
                style={[
                  styles.cancelTripButton,
                  !isDark && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                  isActionLoading && { opacity: 0.5 },
                ]}
                onPress={() => onOpenCancel(item)}
                disabled={isActionLoading}
                activeOpacity={0.75}
                accessibilityLabel="Hủy cuốc xe"
              >
                <Ionicons name="close-circle-outline" size={15} color="#EF4444" style={{ marginRight: 4 }} />
                <Text style={styles.cancelTripButtonText}>Hủy</Text>
              </TouchableOpacity>
            )}

          {item.status === 'completed' && (
            <View
              style={[
                styles.doneBadge,
                !isDark && {
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={15} color={isDark ? '#34D399' : '#059669'} style={{ marginRight: 5 }} />
              <Text style={[styles.doneBadgeText, !isDark && { color: '#059669' }]}>Chuyến đi hoàn tất</Text>
            </View>
          )}

          {item.status === 'cancelled' && (
            <View
              style={[
                styles.doneBadge,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
                },
              ]}
            >
              <Ionicons name="close-circle" size={15} color={isDark ? '#F87171' : '#DC2626'} style={{ marginRight: 5 }} />
              <Text style={[styles.doneBadgeText, { color: isDark ? '#F87171' : '#DC2626' }]}>Chuyến xe đã hủy</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardMyTask: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: '#131B2E',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  roomTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  roomTagText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  carThumbBox: {
    width: 60,
    height: 50,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  carThumbImg: {
    width: '100%',
    height: '100%',
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  bookingCode: {
    fontSize: 11,
    color: '#64748B',
  },
  dotSeparator: {
    color: '#475569',
    marginHorizontal: 6,
  },
  priceTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#34D399',
  },
  passengerBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0A0F1D',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  passengerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0',
    marginLeft: 6,
  },
  guestPhonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  guestPhoneText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
  },
  transportTimingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#0A0F1D',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  transportTimingItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transportTimingScheduled: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  transportTimingLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginRight: 4,
  },
  transportTimingValue: {
    fontSize: 11.5,
    color: '#F1F5F9',
    fontWeight: '700',
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  noteText: {
    fontSize: 12,
    color: '#E2E8F0',
    flex: 1,
  },
  driverInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 10,
  },
  driverLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  driverValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  actionStack: {
    marginTop: 4,
    gap: 8,
  },
  utilityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  utilityBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  utilityBtnMap: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  utilityBtnSms: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  utilityBtnCall: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  utilityBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  claimButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  claimButtonText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.4,
  },
  departButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38BDF8',
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  departButtonText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.4,
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  completeButtonText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.4,
  },
  cancelTripButton: {
    flexDirection: 'row',
    paddingHorizontal: 13,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelTripButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EF4444',
  },
  doneBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  doneBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#34D399',
  },
});
