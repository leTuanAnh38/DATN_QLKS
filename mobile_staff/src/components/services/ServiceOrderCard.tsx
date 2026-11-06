import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ServiceOrder, ServiceLockReason, SlaStatus, StatusBadgeConfig } from './types';
import { getServiceItemImage, formatOrderTime, getServiceActionConfig, detectAllergyWarning } from './serviceHelpers';
import { styles } from './styles';

export interface ServiceOrderCardProps {
  item: ServiceOrder;
  isDark: boolean;
  isMyTask: boolean;
  isActionLoading: boolean;
  badge: StatusBadgeConfig;
  actionConfig: ReturnType<typeof getServiceActionConfig>;
  lockReason: ServiceLockReason;
  sla: SlaStatus | null;
  onClaim: (item: ServiceOrder) => void;
  onUpdateStatus: (item: ServiceOrder, status: string, label: string) => void;
  onPromptComplete: (item: ServiceOrder, label: string) => void;
  onOpenCancelModal: (item: ServiceOrder) => void;
  onOpenCrm: () => void;
  onCallGuest: (phone?: string, name?: string, room?: string) => void;
}

export const ServiceOrderCard: React.FC<ServiceOrderCardProps> = React.memo(({
  item,
  isDark,
  isMyTask,
  isActionLoading,
  badge,
  actionConfig,
  lockReason,
  sla,
  onClaim,
  onUpdateStatus,
  onPromptComplete,
  onOpenCancelModal,
  onOpenCrm,
  onCallGuest,
}) => {
  const allergyInfo = detectAllergyWarning(item.note);
  const cleanNoteText = item.note
    ? item.note.replace(/\[ĐÃ HỦY:.*?\]\s*/, '').trim() || item.note
    : '';
  const floorLabel = item.room_floor
    ? String(item.room_floor)
    : (item.room_number && /^\d{3,}$/.test(item.room_number.trim()) ? item.room_number.trim().slice(0, -2) : null);

  // Tính khoảng thời gian còn lại tới giờ hẹn giao (để cảnh báo không chế biến quá sớm)
  const scheduledCountdown = (() => {
    if (!item.is_scheduled || !item.request_time || item.status === 'completed' || item.status === 'cancelled') {
      return null;
    }
    const schedTime = new Date(item.request_time);
    if (isNaN(schedTime.getTime())) return null;
    const diffMins = Math.floor((schedTime.getTime() - Date.now()) / 60000);
    if (diffMins <= 0) return null;
    const waitText =
      diffMins >= 60 ? `${Math.floor(diffMins / 60)}h ${diffMins % 60}p` : `${diffMins} phút`;
    return {
      diffMins,
      isTooEarly: diffMins > 30,
      text: `Còn ${waitText} nữa đến giờ hẹn`,
    };
  })();

  return (
    <View
      style={[
        styles.card,
        !isDark && {
          backgroundColor: '#FFFFFF',
          borderColor: isMyTask ? '#F59E0B' : '#E2E8F0',
          shadowColor: '#64748B',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 2,
        },
        isMyTask && isDark && styles.cardMyTask,
        sla?.isOverdue && { borderColor: sla.borderColor, borderWidth: 1.5 },
        allergyInfo?.hasAllergy && { borderColor: '#EF4444', borderWidth: 1.5 },
      ]}
    >
      {/* Header Đơn */}
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
          <View style={[styles.roomTag, !isDark && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
            <Ionicons name="bed" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
            <Text style={[styles.roomTagText, !isDark && { color: '#0F172A' }]}>
              P.{item.room_number || '?'}{floorLabel ? ` • T.${floorLabel}` : ''}
            </Text>
          </View>
          {item.booking_code ? (
            <View style={[styles.bookingCodeTag, !isDark && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
              <Text style={[styles.bookingCodeTagText, !isDark && { color: '#64748B' }]}>#{item.booking_code}</Text>
            </View>
          ) : null}
          {/* Nhãn phân loại nghiệp vụ F&B / Spa / Giặt là / Tiện ích */}
          <View style={[styles.categoryPill, { borderColor: actionConfig.catColor }]}>
            <Ionicons name={actionConfig.catIcon as any} size={11} color={actionConfig.catColor} style={{ marginRight: 3 }} />
            <Text style={[styles.categoryPillText, { color: actionConfig.catColor }]}>{actionConfig.catLabel}</Text>
          </View>

          {/* Huy hiệu Cảnh Báo Dị Ứng / Ăn Kiêng Nổi Bật */}
          {allergyInfo && (
            <View style={[styles.allergyBadgePill, !isDark && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
              <Ionicons name="warning" size={10} color="#DC2626" style={{ marginRight: 3 }} />
              <Text style={[styles.allergyBadgePillText, !isDark && { color: '#B91C1C' }]}>
                {allergyInfo.title === 'CẢNH BÁO DỊ ỨNG THỰC PHẨM' ? '⚠️ DỊ ỨNG' : '🥗 ĂN KIÊNG'}
              </Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {sla?.isOverdue ? (
            <View
              style={[
                styles.slaBadge,
                { backgroundColor: sla.badgeBg, borderColor: sla.badgeBorderColor, marginRight: 6 },
              ]}
            >
              <Ionicons name="alert-circle" size={11} color={sla.badgeTextColor} style={{ marginRight: 3 }} />
              <Text style={[styles.slaBadgeText, { color: sla.badgeTextColor }]}>
                {sla.label}
              </Text>
            </View>
          ) : null}

          <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>
              {badge.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Tên Món, Ảnh Món & Số lượng */}
      <View style={styles.foodRow}>
        <View style={styles.foodThumbBox}>
          <Image
            source={{ uri: getServiceItemImage(item) }}
            style={styles.foodThumbImg}
            resizeMode="cover"
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.serviceName, !isDark && { color: '#0F172A' }]} numberOfLines={1}>
              {item.service_name}
            </Text>
            <View style={styles.quantityBadge}>
              <Text style={styles.quantityBadgeText}>x{item.quantity}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, flexWrap: 'wrap', gap: 6 }}>
            <Text style={styles.priceText}>
              {item.total_price ? `${parseInt(item.total_price, 10).toLocaleString('vi-VN')} đ` : 'Miễn phí'}
            </Text>
            <Text style={styles.dotSeparator}>•</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center' }}
              onPress={onOpenCrm}
              activeOpacity={0.7}
            >
              <Text style={[styles.guestInfoText, { color: '#0284C7', fontWeight: '800' }]}>
                Khách: {item.guest_name}
              </Text>
              <Ionicons name="person-circle-outline" size={13} color="#0284C7" style={{ marginLeft: 3 }} />
            </TouchableOpacity>

            {/* Huy hiệu Khách VIP (Gold / Diamond) */}
            {item.is_vip ? (
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
                  borderColor: '#F59E0B',
                  borderWidth: 1,
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 1.5,
                }}
              >
                <Text style={{ fontSize: 9.5, fontWeight: '900', color: isDark ? '#FBBF24' : '#B45309' }}>
                  {item.guest_tier_code === 'DIAMOND' ? '👑 VIP KIM CƯƠNG' : '⭐ VIP VÀNG'}
                </Text>
              </View>
            ) : null}

            {/* Nút Gọi điện thoại nhanh cho khách phòng */}
            <TouchableOpacity
              style={[
                styles.quickPhoneBtn,
                !isDark && { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
              ]}
              onPress={() => onCallGuest(item.guest_phone, item.guest_name, item.room_number)}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={11} color="#059669" style={{ marginRight: 3 }} />
              <Text style={styles.quickPhoneBtnText}>
                {item.guest_phone ? item.guest_phone : 'Gọi khách'}
              </Text>
            </TouchableOpacity>

            {/* Huy hiệu đã thanh toán */}
            {item.is_paid ? (
              <View style={[styles.paidBadge, !isDark && { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <Ionicons name="checkmark-circle" size={11} color="#059669" style={{ marginRight: 2 }} />
                <Text style={styles.paidBadgeText}>Đã thu tiền</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Thời gian đặt & Giờ hẹn giao */}
      <View style={[styles.orderTimingBox, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
        {item.created_at ? (
          <View style={styles.orderTimingItem}>
            <Ionicons name="time-outline" size={13} color="#0284C7" style={{ marginRight: 4 }} />
            <Text style={[styles.orderTimingLabel, !isDark && { color: '#64748B' }]}>Đặt lúc:</Text>
            <Text style={[styles.orderTimingValue, !isDark && { color: '#334155' }]}>{formatOrderTime(item.created_at)}</Text>
          </View>
        ) : null}

        {/* Giờ hẹn giao: Chỉ hiển thị khi đơn THỰC SỰ có hẹn giờ (is_scheduled) */}
        {item.is_scheduled && item.request_time ? (
          <View style={[styles.orderTimingItem, styles.orderTimingScheduled]}>
            <Ionicons name="alarm-outline" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
            <Text style={[styles.orderTimingLabel, { color: '#D97706' }]}>Hẹn giao:</Text>
            <Text style={[styles.orderTimingValue, { color: '#D97706', fontWeight: '800' }]}>
              {formatOrderTime(item.request_time)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Banner nhắc nhở đơn hẹn giờ chưa tới lúc chế biến */}
      {scheduledCountdown && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: scheduledCountdown.isTooEarly
              ? (isDark ? 'rgba(245, 158, 11, 0.14)' : '#FEF3C7')
              : (isDark ? 'rgba(56, 189, 248, 0.14)' : '#E0F2FE'),
            borderColor: scheduledCountdown.isTooEarly ? '#F59E0B' : '#0284C7',
            borderWidth: 1,
            borderRadius: 9,
            paddingHorizontal: 10,
            paddingVertical: 6,
            marginBottom: 8,
          }}
        >
          <Ionicons
            name="alarm"
            size={14}
            color={scheduledCountdown.isTooEarly ? '#D97706' : '#0284C7'}
            style={{ marginRight: 6 }}
          />
          <Text
            style={{
              flex: 1,
              fontSize: 11.5,
              fontWeight: '800',
              color: scheduledCountdown.isTooEarly
                ? (isDark ? '#FBBF24' : '#B45309')
                : (isDark ? '#38BDF8' : '#0369A1'),
            }}
          >
            ⏰ {scheduledCountdown.text}
            {scheduledCountdown.isTooEarly ? ' • Tránh làm món quá sớm!' : ' • Chuẩn bị phục vụ!'}
          </Text>
        </View>
      )}

      {/* Lý do hủy nếu đơn bị hủy */}
      {item.status === 'cancelled' && item.note && item.note.includes('[ĐÃ HỦY:') ? (
        <View style={[styles.cancelReasonBox, !isDark && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
          <Ionicons name="alert-circle" size={15} color="#EF4444" style={{ marginRight: 6 }} />
          <Text style={[styles.cancelReasonText, !isDark && { color: '#B91C1C' }]}>
            {item.note.match(/\[ĐÃ HỦY:\s*(.*?)\]/)?.[1]
              ? `Lý do hủy: ${item.note.match(/\[ĐÃ HỦY:\s*(.*?)\]/)?.[1]}`
              : item.note}
          </Text>
        </View>
      ) : null}

      {/* Ghi chú yêu cầu đặc biệt của khách (Phân tách nổi bật nếu có CẢNH BÁO DỊ ỨNG) */}
      {cleanNoteText ? (
        allergyInfo ? (
          <View style={[styles.allergyBanner, !isDark && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <View style={styles.allergyBannerTitleRow}>
              <Ionicons name="warning" size={15} color="#DC2626" style={{ marginRight: 6 }} />
              <Text style={[styles.allergyBannerTitle, !isDark && { color: '#B91C1C' }]}>
                {allergyInfo.title}
              </Text>
            </View>
            <Text style={[styles.allergyBannerText, !isDark && { color: '#991B1B' }]}>
              Lưu ý Bếp & Phục vụ: {cleanNoteText}
            </Text>
          </View>
        ) : (
          <View style={[styles.noteBox, !isDark && { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }]}>
            <Ionicons name="receipt-outline" size={15} color="#F59E0B" style={{ marginRight: 6 }} />
            <Text style={[styles.noteText, !isDark && { color: '#334155' }]}>
              Yêu cầu: {cleanNoteText}
            </Text>
          </View>
        )
      ) : null}

      {/* Nhân viên tiếp nhận */}
      <View style={styles.staffRow}>
        <Text style={[styles.staffLabel, !isDark && { color: '#64748B' }]}>Người phụ trách:</Text>
        <Text style={[styles.staffValue, !isDark && { color: '#334155' }, isMyTask && { color: '#F59E0B', fontWeight: '800' }]}>
          {item.assigned_staff_name || 'Chưa ai nhận'}
          {isMyTask ? ' (Bạn)' : ''}
        </Text>
      </View>

      {/* Cảnh báo khóa thao tác: chưa gán phòng / khách chưa check-in */}
      {lockReason ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.4)', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 8 }}>
          <Ionicons name="lock-closed" size={14} color="#F59E0B" style={{ marginRight: 6 }} />
          <Text style={{ flex: 1, fontSize: 11.5, color: '#FBBF24', fontWeight: '700' }}>
            {lockReason === 'NO_ROOM'
              ? 'Chưa gán phòng — chờ Lễ tân xếp phòng'
              : 'Khách chưa check-in — chờ khách nhận phòng'}
          </Text>
        </View>
      ) : null}

      {/* Nút hành động 1 chạm */}
      <View style={styles.actionRow}>
        {item.status === 'pending' && (
          <TouchableOpacity
            style={[styles.btnClaim, (isActionLoading || lockReason) && { opacity: isActionLoading ? 0.65 : 0.45 }]}
            onPress={() => onClaim(item)}
            activeOpacity={0.8}
            disabled={isActionLoading}
          >
            {isActionLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#0A0F1D" style={{ marginRight: 6 }} />
                <Text style={styles.btnClaimText}>ĐANG TIẾP NHẬN...</Text>
              </View>
            ) : (
              <>
                <Ionicons name={actionConfig.claimIcon as any} size={16} color="#0A0F1D" style={{ marginRight: 6 }} />
                <Text style={styles.btnClaimText}>{actionConfig.claimText}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {item.status === 'in_progress' && (
          <TouchableOpacity
            style={[styles.btnDeliver, (isActionLoading || lockReason) && { opacity: isActionLoading ? 0.65 : 0.45 }]}
            onPress={() => onUpdateStatus(item, 'delivering', actionConfig.deliveringLabel)}
            activeOpacity={0.8}
            disabled={isActionLoading}
          >
            {isActionLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#0A0F1D" style={{ marginRight: 6 }} />
                <Text style={styles.btnDeliverText}>ĐANG CẬP NHẬT...</Text>
              </View>
            ) : (
              <>
                <Ionicons name={actionConfig.nextStepIcon as any} size={16} color="#0A0F1D" style={{ marginRight: 6 }} />
                <Text style={styles.btnDeliverText}>{actionConfig.nextStepLabel}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {item.status === 'delivering' && (
          <TouchableOpacity
            style={[styles.btnComplete, (isActionLoading || lockReason) && { opacity: isActionLoading ? 0.65 : 0.45 }]}
            onPress={() => onPromptComplete(item, actionConfig.completeSuccessMsg)}
            activeOpacity={0.8}
            disabled={isActionLoading}
          >
            {isActionLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#0A0F1D" style={{ marginRight: 6 }} />
                <Text style={styles.btnCompleteText}>ĐANG HOÀN TẤT...</Text>
              </View>
            ) : (
              <>
                <Ionicons name="checkmark-done" size={17} color="#0A0F1D" style={{ marginRight: 6 }} />
                <Text style={styles.btnCompleteText}>{actionConfig.completeStepLabel}</Text>
              </>
            )}
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
            <Ionicons name="checkmark-circle" size={16} color={isDark ? '#34D399' : '#059669'} style={{ marginRight: 6 }} />
            <Text style={[styles.doneBadgeText, !isDark && { color: '#059669' }]}>{actionConfig.completedBadge}</Text>
          </View>
        )}

        {item.status === 'cancelled' && (
          <View
            style={[
              styles.doneBadge,
              { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)' },
              !isDark && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
            ]}
          >
            <Ionicons name="close-circle" size={16} color={isDark ? '#F87171' : '#DC2626'} style={{ marginRight: 6 }} />
            <Text style={[styles.doneBadgeText, { color: isDark ? '#F87171' : '#DC2626' }]}>Đơn đã hủy</Text>
          </View>
        )}

        {(item.status === 'pending' || item.status === 'in_progress') && (
          <TouchableOpacity
            style={[styles.btnCancelOrder, isActionLoading && { opacity: 0.5 }]}
            onPress={() => onOpenCancelModal(item)}
            activeOpacity={0.7}
            disabled={isActionLoading}
          >
            <Ionicons name="close-circle-outline" size={15} color="#EF4444" style={{ marginRight: 4 }} />
            <Text style={styles.btnCancelOrderText}>Hủy</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});
