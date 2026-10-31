import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MAINTENANCE_ISSUE_TYPES } from '../../constants/maintenance';
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
  description: string;
  status: string;
  status_display: string;
  parts_replaced: string;
  cost: number;
  is_guest_fault?: boolean;
  technician_name: string;
  start_date: string;
}

export interface MaintenanceTicketCardProps {
  item: MaintenanceTicket;
  canCompleteMaintenance: boolean;
  isLoading: boolean;
  onOpenComplete: (item: MaintenanceTicket) => void;
}

export const MaintenanceTicketCard: React.FC<MaintenanceTicketCardProps> = React.memo(({
  item,
  canCompleteMaintenance,
  isLoading,
  onOpenComplete,
}) => {
  const { isDark } = useAppTheme();
  const isFixing = item.status === 'fixing';
  const issueMeta = MAINTENANCE_ISSUE_TYPES.find((it) => it.key === item.issue_type) || {
    icon: 'construct',
    color: isFixing ? Palette.rose.main : Palette.emerald.main,
    label: 'Sự cố',
  };
  const isOccupied = item.room_status === 'occupied';
  const isCleaning = item.room_status === 'cleaning';

  return (
    <View
      style={[
        styles.card,
        !isDark && {
          backgroundColor: '#FFFFFF',
          borderColor: isFixing ? 'rgba(239, 68, 68, 0.4)' : '#E2E8F0',
          shadowColor: '#64748B',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 2,
        },
        isFixing && isDark && styles.cardFixing,
      ]}
    >
      {/* Header phiếu */}
      <View style={styles.cardHeader}>
        <View style={[styles.roomTag, !isDark && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
          <Ionicons name="bed" size={13} color={Palette.gold.main} style={{ marginRight: 4 }} />
          <Text style={[styles.roomTagText, !isDark && { color: '#0F172A' }]}>
            Phòng {item.room_number}{item.room_floor ? ` • T.${item.room_floor}` : ''}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isFixing
                ? (isDark ? Palette.rose.subtle : 'rgba(239, 68, 68, 0.1)')
                : (isDark ? Palette.emerald.subtle : 'rgba(16, 185, 129, 0.1)'),
              borderColor: isFixing
                ? (isDark ? Palette.rose.border : 'rgba(239, 68, 68, 0.3)')
                : (isDark ? Palette.emerald.border : 'rgba(16, 185, 129, 0.3)'),
            },
          ]}
        >
          <Ionicons
            name={isFixing ? 'alert-circle' : 'checkmark-circle'}
            size={12}
            color={isFixing ? (isDark ? Palette.rose.light : '#DC2626') : (isDark ? Palette.emerald.light : '#059669')}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.statusBadgeText,
              { color: isFixing ? (isDark ? Palette.rose.light : '#DC2626') : (isDark ? Palette.emerald.light : '#059669') },
            ]}
          >
            {isFixing ? 'Sửa chữa gấp' : 'Đã nghiệm thu'}
          </Text>
        </View>
      </View>

      {/* Cảnh báo SOP 5 sao: Phòng có khách lưu trú */}
      {isOccupied && (
        <View style={styles.sopAlertBanner}>
          <View style={styles.sopBadge}>
            <Ionicons name="warning" size={12} color="#F59E0B" style={{ marginRight: 4 }} />
            <Text style={styles.sopBadgeText}>SOP 5 SAO • CÓ KHÁCH</Text>
          </View>
          <Text style={styles.sopBannerText}>
            Phòng có khách lưu trú{item.guest_name ? ` (${item.guest_name})` : ''} • Tuân thủ SOP: Gõ cửa 3 lần, xưng "Kỹ thuật phòng" trước khi vào!
          </Text>
        </View>
      )}

      {isCleaning && !isOccupied && (
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

      {/* Footer: Kỹ thuật viên & Nút hoàn thành */}
      <View style={[styles.cardFooter, !isDark && { borderTopColor: '#F1F5F9' }]}>
        <Text style={[styles.techText, !isDark && { color: '#64748B' }]}>
          Phụ trách: {item.technician_name || 'Đội kỹ thuật'}
        </Text>

        {isFixing && canCompleteMaintenance ? (
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
                <Ionicons name="checkmark-done" size={16} color="#0A0F1D" style={{ marginRight: 6 }} />
                <Text style={styles.completeBtnText}>NGHIỆM THU & BÀN GIAO</Text>
              </>
            )}
          </TouchableOpacity>
        ) : isFixing ? (
          <View style={[styles.doneTag, !isDark && { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
            <Ionicons name="construct" size={14} color="#F59E0B" style={{ marginRight: 4 }} />
            <Text style={[styles.doneTagText, { color: '#D97706' }]}>Đang chờ Kỹ thuật xử lý</Text>
          </View>
        ) : (
          <View style={[styles.doneTag, !isDark && { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
            <Ionicons name="shield-checkmark" size={14} color={isDark ? '#34D399' : '#059669'} style={{ marginRight: 4 }} />
            <Text style={[styles.doneTagText, !isDark && { color: '#059669' }]}>Đã bàn giao buồng phòng</Text>
          </View>
        )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  techText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  completeBtn: {
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
});
