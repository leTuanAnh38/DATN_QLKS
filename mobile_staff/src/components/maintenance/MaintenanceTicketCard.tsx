import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MAINTENANCE_ISSUE_TYPES, calculateTicketSLA } from '../../constants/maintenance';
import { Palette } from '../../constants/theme';
import { useAppTheme } from '../../contexts/ThemeContext';

export interface MaintenanceTicket {
  id: number;
  ticket_code: string;
  room_number: string;
  room_status?: string;
  room_floor?: number;
  guest_name?: string;
  booking_code?: string;
  equipment_name: string;
  issue_type: string;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  priority_display?: string;
  description: string;
  status: string;
  status_display: string;
  parts_replaced: string;
  cost: number;
  is_guest_fault?: boolean;
  technician?: number | null;
  technician_name: string;
  start_date: string;
  note?: string;
  image_before?: string | null;
  image_after?: string | null;
}

export interface MaintenanceTicketCardProps {
  item: MaintenanceTicket;
  canCompleteMaintenance: boolean;
  isTechnicianOrManager?: boolean;
  currentUserId?: number;
  isLoading: boolean;
  isClaiming?: boolean;
  onOpenComplete: (item: MaintenanceTicket) => void;
  onClaimTicket?: (item: MaintenanceTicket) => void;
  onOpenCancel?: (item: MaintenanceTicket) => void;
}

export const MaintenanceTicketCard: React.FC<MaintenanceTicketCardProps> = React.memo(({
  item,
  canCompleteMaintenance,
  isTechnicianOrManager = true,
  currentUserId,
  isLoading,
  isClaiming = false,
  onOpenComplete,
  onClaimTicket,
  onOpenCancel,
}) => {
  const { isDark, hotelStars } = useAppTheme();
  const isFixing = item.status === 'fixing';
  const isCancelled = item.status === 'cancelled';
  const isCompleted = item.status === 'completed';
  const isUrgent = item.priority === 'urgent';
  const isHigh = item.priority === 'high';
  const isMyTicket = Boolean(currentUserId && item.technician === currentUserId);

  const issueMeta = MAINTENANCE_ISSUE_TYPES.find((it) => it.key === item.issue_type) || {
    icon: 'construct',
    color: isFixing ? Palette.rose.main : Palette.emerald.main,
    label: 'Sự cố',
  };
  const isOccupied = item.room_status === 'occupied';
  const isCleaning = item.room_status === 'cleaning';
  const floor = item.room_floor || (item.room_number && item.room_number.length >= 3 ? item.room_number.slice(0, -2) : undefined);

  const [previewImage, setPreviewImage] = useState<{ uri: string; title: string } | null>(null);

  const slaStatus = useMemo(
    () => calculateTicketSLA(item.start_date, item.priority, item.room_status, isFixing),
    [item.start_date, item.priority, item.room_status, isFixing]
  );

  return (
    <View
      style={[
        styles.card,
        !isDark && {
          backgroundColor: '#FFFFFF',
          borderColor: slaStatus?.isOverdue ? '#EF4444' : isUrgent ? '#EF4444' : isFixing ? 'rgba(239, 68, 68, 0.4)' : '#E2E8F0',
          shadowColor: '#64748B',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 2,
        },
        isFixing && isDark && styles.cardFixing,
        (isUrgent || slaStatus?.isOverdue) && { borderWidth: 1.5, borderColor: '#EF4444' },
      ]}
    >
      {/* Header phiếu */}
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[styles.roomTag, !isDark && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
            <Ionicons name="bed" size={13} color={Palette.gold.main} style={{ marginRight: 4 }} />
            <Text style={[styles.roomTagText, !isDark && { color: '#0F172A' }]}>
              Phòng {item.room_number}{floor ? ` • T.${floor}` : ''}
            </Text>
          </View>

          {isUrgent ? (
            <View style={styles.urgentPriorityBadge}>
              <Ionicons name="flash" size={10} color="#FFFFFF" style={{ marginRight: 2 }} />
              <Text style={styles.urgentPriorityText}>KHẨN CẤP</Text>
            </View>
          ) : isHigh ? (
            <View style={styles.highPriorityBadge}>
              <Text style={styles.highPriorityText}>Ưu tiên cao</Text>
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isCancelled
                ? (isDark ? '#1E293B' : '#F1F5F9')
                : isFixing
                ? (isDark ? Palette.rose.subtle : 'rgba(239, 68, 68, 0.1)')
                : (isDark ? Palette.emerald.subtle : 'rgba(16, 185, 129, 0.1)'),
              borderColor: isCancelled
                ? (isDark ? '#334155' : '#CBD5E1')
                : isFixing
                ? (isDark ? Palette.rose.border : 'rgba(239, 68, 68, 0.3)')
                : (isDark ? Palette.emerald.border : 'rgba(16, 185, 129, 0.3)'),
            },
          ]}
        >
          <Ionicons
            name={isCancelled ? 'close-circle' : isFixing ? 'alert-circle' : 'checkmark-circle'}
            size={12}
            color={
              isCancelled
                ? (isDark ? '#94A3B8' : '#64748B')
                : isFixing
                ? (isDark ? Palette.rose.light : '#DC2626')
                : (isDark ? Palette.emerald.light : '#059669')
            }
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.statusBadgeText,
              {
                color: isCancelled
                  ? (isDark ? '#94A3B8' : '#64748B')
                  : isFixing
                  ? (isDark ? Palette.rose.light : '#DC2626')
                  : (isDark ? Palette.emerald.light : '#059669'),
              },
            ]}
          >
            {isCancelled ? 'Đã hủy' : isFixing ? 'Cần sửa chữa' : 'Đã nghiệm thu'}
          </Text>
        </View>
      </View>

      {/* SLA đếm thời gian chờ xử lý sự cố thiết bị */}
      {isFixing && slaStatus && (
        <View
          style={[
            styles.slaContainer,
            {
              backgroundColor: slaStatus.statusBadge.bg,
              borderColor: slaStatus.statusBadge.border,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons
              name={slaStatus.isOverdue ? 'alert-circle' : 'time-outline'}
              size={13}
              color={slaStatus.statusBadge.color}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.slaText, { color: slaStatus.statusBadge.color }]}>
              {slaStatus.statusBadge.label}
            </Text>
          </View>
          <Text style={[styles.slaSubText, { color: slaStatus.statusBadge.color }]}>
            {slaStatus.isOverdue
              ? `Vượt chuẩn ${slaStatus.slaLimitMinutes}p`
              : `Chuẩn SLA: ${slaStatus.slaLimitMinutes}p`}
          </Text>
        </View>
      )}

      {/* Cảnh báo SOP theo tiêu chuẩn sao khách sạn: Phòng có khách lưu trú */}
      {isOccupied && !isCancelled && (
        <View style={styles.sopAlertBanner}>
          <View style={styles.sopBadge}>
            <Ionicons name="warning" size={12} color="#F59E0B" style={{ marginRight: 4 }} />
            <Text style={styles.sopBadgeText}>SOP {hotelStars} SAO • CÓ KHÁCH</Text>
          </View>
          <Text style={styles.sopBannerText}>
            Phòng có khách lưu trú{item.guest_name ? ` (${item.guest_name})` : ''} • Tuân thủ SOP: Gõ cửa 3 lần, xưng "Kỹ thuật phòng" trước khi vào!
          </Text>
        </View>
      )}

      {isCleaning && !isOccupied && !isCancelled && (
        <View style={styles.cleaningStatusBanner}>
          <Ionicons name="sparkles" size={12} color="#F59E0B" style={{ marginRight: 5 }} />
          <Text style={styles.cleaningStatusText}>Buồng phòng đang dọn dẹp</Text>
        </View>
      )}

      {/* Thiết bị sự cố */}
      <View style={styles.equipmentRow}>
        <View style={[styles.equipmentIconBox, { backgroundColor: `${issueMeta.color}20` }]}>
          <Ionicons name={issueMeta.icon as any} size={20} color={issueMeta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.equipmentName, !isDark && { color: '#0F172A' }]}>{item.equipment_name || 'Thiết bị buồng phòng'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            <Text style={[styles.ticketCode, !isDark && { color: '#64748B' }]}>Mã: #{item.ticket_code}</Text>
            {item.booking_code ? (
              <>
                <Text style={{ color: isDark ? '#475569' : '#94A3B8', marginHorizontal: 4 }}>•</Text>
                <Text style={{ fontSize: 11, color: '#0284C7', fontWeight: '600' }}>#{item.booking_code}</Text>
              </>
            ) : null}
          </View>
        </View>
      </View>

      {/* Mô tả sự cố */}
      {item.description ? (
        <View style={[styles.descBox, !isDark && { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }]}>
          <Ionicons name="warning-outline" size={15} color="#F59E0B" style={{ marginRight: 6 }} />
          <Text style={[styles.descText, !isDark && { color: '#334155' }]}>Hiện tượng: {item.description}</Text>
        </View>
      ) : null}

      {/* Ghi chú hủy nếu có */}
      {isCancelled && item.note ? (
        <View style={[styles.descBox, { backgroundColor: 'rgba(100, 116, 139, 0.1)', borderColor: 'rgba(100, 116, 139, 0.3)' }]}>
          <Ionicons name="information-circle-outline" size={15} color="#94A3B8" style={{ marginRight: 6 }} />
          <Text style={[styles.descText, !isDark && { color: '#475569' }]}>{item.note}</Text>
        </View>
      ) : null}

      {/* Vật tư đã thay */}
      {item.parts_replaced ? (
        <View style={[styles.partsRow, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
          <Text style={[styles.partsLabel, !isDark && { color: '#64748B' }]}>Linh kiện:</Text>
          <Text style={[styles.partsValue, !isDark && { color: '#334155' }]}>{item.parts_replaced}</Text>
        </View>
      ) : null}

      {/* Cờ trách nhiệm: Khách làm hỏng */}
      {item.is_guest_fault ? (
        <View style={[styles.guestFaultBadge, !isDark && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
          <Ionicons name="receipt" size={12} color="#EF4444" style={{ marginRight: 4 }} />
          <Text style={[styles.guestFaultBadgeText, !isDark && { color: '#DC2626' }]}>
            Khách làm hư hỏng • {item.cost ? `Bồi thường: ${Number(item.cost).toLocaleString('vi-VN')} đ` : 'Đã lập biên bản'}
          </Text>
        </View>
      ) : null}

      {/* Bằng chứng hình ảnh hiện trường (Before & After) */}
      {(item.image_before || item.image_after) ? (
        <View style={styles.evidenceContainer}>
          <Text style={[styles.evidenceHeaderTitle, !isDark && { color: '#64748B' }]}>
            Bằng chứng hình ảnh hiện trường:
          </Text>
          <View style={styles.evidenceRow}>
            {item.image_before ? (
              <TouchableOpacity
                style={[styles.evidenceThumbWrapper, !isDark && { borderColor: '#E2E8F0' }]}
                onPress={() => setPreviewImage({ uri: item.image_before!, title: 'Ảnh hiện trường hư hại (Trước sửa)' })}
                activeOpacity={0.8}
              >
                <Image source={{ uri: item.image_before }} style={styles.evidenceThumb} />
                <View style={[styles.evidenceBadge, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.evidenceBadgeText}>Hiện trường</Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {item.image_after ? (
              <TouchableOpacity
                style={[styles.evidenceThumbWrapper, !isDark && { borderColor: '#E2E8F0' }]}
                onPress={() => setPreviewImage({ uri: item.image_after!, title: 'Ảnh sau khi sửa chữa (Nghiệm thu)' })}
                activeOpacity={0.8}
              >
                <Image source={{ uri: item.image_after }} style={styles.evidenceThumb} />
                <View style={[styles.evidenceBadge, { backgroundColor: '#10B981' }]}>
                  <Text style={styles.evidenceBadgeText}>Đã sửa xong</Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Footer: Kỹ thuật viên & Các nút hành động */}
      <View style={[styles.cardFooter, !isDark && { borderTopColor: '#F1F5F9' }]}>
        {/* Hàng 1: Người phụ trách & Nút Nhận việc (Không bị chèn ép) */}
        <View style={styles.footerTopRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
            {item.technician_name ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                <Ionicons name="hammer-outline" size={13} color={isMyTicket ? '#10B981' : '#F59E0B'} />
                <Text style={[styles.techText, !isDark && { color: '#475569' }, isMyTicket && { color: '#10B981', fontWeight: '700' }]}>
                  {item.technician_name} {isMyTicket ? '(Bạn)' : ''}
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="alert-circle-outline" size={13} color="#EF4444" style={{ marginRight: 4 }} />
                <Text style={[styles.techText, { color: '#EF4444', fontStyle: 'italic' }]}>
                  Chưa có người nhận
                </Text>
              </View>
            )}
          </View>

          {isFixing && !item.technician_name && isTechnicianOrManager && onClaimTicket && (
            <TouchableOpacity
              style={[styles.claimBtn, isClaiming && { opacity: 0.6 }]}
              onPress={() => onClaimTicket(item)}
              disabled={isClaiming}
              activeOpacity={0.7}
            >
              <Ionicons name="hand-right" size={13} color="#0A0F1D" style={{ marginRight: 4 }} />
              <Text style={styles.claimBtnText}>Nhận việc</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Hàng 2: Các nút hành động (Báo sai / Nghiệm thu) */}
        {isFixing ? (
          <View style={styles.footerActionRow}>
            {isTechnicianOrManager && onOpenCancel && (
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  !isDark && { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
                ]}
                onPress={() => onOpenCancel(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle-outline" size={14} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 4 }} />
                <Text style={[styles.cancelBtnText, !isDark && { color: '#475569' }]}>Báo sai</Text>
              </TouchableOpacity>
            )}

            {canCompleteMaintenance ? (
              <TouchableOpacity
                style={[styles.completeBtn, isLoading && { opacity: 0.65 }]}
                onPress={() => onOpenComplete(item)}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#0A0F1D" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={15} color="#0A0F1D" style={{ marginRight: 5 }} />
                    <Text style={styles.completeBtnText}>NGHIỆM THU</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={[styles.doneTag, !isDark && { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
                <Ionicons name="construct" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
                <Text style={[styles.doneTagText, { color: '#D97706' }]}>Đang xử lý</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
            {isCancelled ? (
              <View style={[styles.doneTag, !isDark && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
                <Ionicons name="close" size={13} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 4 }} />
                <Text style={[styles.doneTagText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Đã hủy</Text>
              </View>
            ) : (
              <View style={[styles.doneTag, !isDark && { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                <Ionicons name="shield-checkmark" size={13} color={isDark ? '#34D399' : '#059669'} style={{ marginRight: 4 }} />
                <Text style={[styles.doneTagText, !isDark && { color: '#059669' }]}>Đã bàn giao buồng phòng</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Lightbox Modal xem ảnh toàn màn hình */}
      {previewImage ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
          <View style={styles.lightboxOverlay}>
            <SafeAreaView style={{ flex: 1, width: '100%' }}>
              <View style={styles.lightboxHeader}>
                <Text style={styles.lightboxTitle} numberOfLines={1}>
                  {previewImage.title} • P.{item.room_number}
                </Text>
                <TouchableOpacity
                  style={styles.lightboxCloseBtn}
                  onPress={() => setPreviewImage(null)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <View style={styles.lightboxBody}>
                <Image
                  source={{ uri: previewImage.uri }}
                  style={styles.lightboxImage}
                  resizeMode="contain"
                />
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      ) : null}
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
  cardFixing: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: '#13192B',
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
  slaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
    borderWidth: 1,
  },
  slaText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  slaSubText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  sopAlertBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 10,
    padding: 9,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  sopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  sopBadgeText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sopBannerText: {
    color: '#FCD34D',
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '600',
  },
  cleaningStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  cleaningStatusText: {
    color: '#FBBF24',
    fontSize: 11.5,
    fontWeight: '700',
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  equipmentIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  equipmentName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  ticketCode: {
    fontSize: 11,
    color: '#64748B',
  },
  descBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0A0F1D',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  descText: {
    fontSize: 12,
    color: '#CBD5E1',
    flex: 1,
    lineHeight: 17,
  },
  partsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  partsLabel: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
    marginRight: 6,
  },
  partsValue: {
    fontSize: 11.5,
    color: '#BAE6FD',
    fontWeight: '600',
    flex: 1,
  },
  guestFaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  guestFaultBadgeText: {
    fontSize: 11,
    color: '#FCA5A5',
    fontWeight: '700',
  },
  cardFooter: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  footerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 28,
  },
  footerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  techText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  completeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  completeBtnText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.3,
  },
  doneTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  doneTagText: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '700',
  },
  urgentPriorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  urgentPriorityText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  highPriorityBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  highPriorityText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  claimBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A0F1D',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  evidenceContainer: {
    marginBottom: 10,
    marginTop: 2,
  },
  evidenceHeaderTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  evidenceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  evidenceThumbWrapper: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  evidenceThumb: {
    width: 80,
    height: 80,
    borderRadius: 9,
  },
  evidenceBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidenceBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'space-between',
  },
  lightboxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lightboxTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 10,
  },
  lightboxCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  lightboxImage: {
    width: '100%',
    height: '85%',
  },
});
