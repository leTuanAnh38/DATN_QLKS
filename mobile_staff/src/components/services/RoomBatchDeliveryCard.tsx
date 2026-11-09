import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ServiceOrder } from './types';

interface RoomBatchDeliveryCardProps {
  roomNumber: string;
  guestName?: string;
  inProgressItems: ServiceOrder[];
  deliveringItems: ServiceOrder[];
  totalDeliveringPrice: number;
  isDark: boolean;
  isActionLoading: boolean;
  onStartBatchDelivery: (roomNumber: string, items: ServiceOrder[]) => void;
  onCompleteBatchDelivery: (roomNumber: string, items: ServiceOrder[]) => void;
}

export const RoomBatchDeliveryCard: React.FC<RoomBatchDeliveryCardProps> = ({
  roomNumber,
  guestName,
  inProgressItems,
  deliveringItems,
  totalDeliveringPrice,
  isDark,
  isActionLoading,
  onStartBatchDelivery,
  onCompleteBatchDelivery,
}) => {
  const totalItems = inProgressItems.length + deliveringItems.length;

  const priceFormatted =
    totalDeliveringPrice > 0
      ? `${totalDeliveringPrice.toLocaleString('vi-VN')} đ`
      : 'Miễn phí';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          borderColor: isDark ? '#334155' : '#E2E8F0',
        },
      ]}
    >
      {/* Header phòng và số lượng món cùng mâm */}
      <View style={styles.headerRow}>
        <View style={styles.roomBadge}>
          <Ionicons name="bed" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
          <Text style={styles.roomBadgeText}>PHÒNG {roomNumber}</Text>
        </View>

        {guestName ? (
          <Text style={[styles.guestNameText, { color: isDark ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
            Khách: <Text style={{ fontWeight: '700' }}>{guestName}</Text>
          </Text>
        ) : null}

        <View style={styles.countBadge}>
          <Ionicons name="restaurant" size={11} color="#0A0F1D" style={{ marginRight: 3 }} />
          <Text style={styles.countBadgeText}>{totalItems} món cùng mâm</Text>
        </View>
      </View>

      {/* Danh sách tóm tắt các món của phòng */}
      <View style={styles.itemsSummaryBox}>
        {deliveringItems.map((it) => (
          <View key={`delivering-${it.id}`} style={styles.itemRow}>
            <View style={[styles.statusDot, { backgroundColor: '#38BDF8' }]} />
            <Text style={[styles.itemName, { color: isDark ? '#F1F5F9' : '#0F172A' }]} numberOfLines={1}>
              {it.service_name} <Text style={{ fontWeight: '800' }}>x{it.quantity}</Text>
            </Text>
            <Text style={styles.deliveringLabel}>Đang giao</Text>
          </View>
        ))}

        {inProgressItems.map((it) => (
          <View key={`progress-${it.id}`} style={styles.itemRow}>
            <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={[styles.itemName, { color: isDark ? '#F1F5F9' : '#0F172A' }]} numberOfLines={1}>
              {it.service_name} <Text style={{ fontWeight: '800' }}>x{it.quantity}</Text>
            </Text>
            <Text style={styles.inProgressLabel}>Đang nấu</Text>
          </View>
        ))}
      </View>

      {/* Các nút bấm thao tác gom nhanh */}
      <View style={styles.actionRow}>
        {/* Nút 1: Xuất xe đẩy giao hàng loạt nếu có món đang chuẩn bị */}
        {inProgressItems.length > 0 && (
          <TouchableOpacity
            style={[styles.btnStartDelivery, isActionLoading && { opacity: 0.65 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onStartBatchDelivery(roomNumber, inProgressItems);
            }}
            disabled={isActionLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="bicycle" size={14} color="#0A0F1D" style={{ marginRight: 4 }} />
            <Text style={styles.btnStartDeliveryText}>
              XUẤT XE GIAO ({inProgressItems.length} MÓN)
            </Text>
          </TouchableOpacity>
        )}

        {/* Nút 2: Bàn giao toàn bộ và ghi nợ phòng nếu có món đang giao */}
        {deliveringItems.length > 0 && (
          <TouchableOpacity
            style={[
              styles.btnCompleteAll,
              isActionLoading && { opacity: 0.65 },
              inProgressItems.length > 0 && { marginTop: 6 },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              onCompleteBatchDelivery(roomNumber, deliveringItems);
            }}
            disabled={isActionLoading}
            activeOpacity={0.8}
          >
            {isActionLoading ? (
              <ActivityIndicator size="small" color="#0A0F1D" />
            ) : (
              <>
                <Ionicons name="checkmark-done-circle" size={17} color="#0A0F1D" style={{ marginRight: 6 }} />
                <Text style={styles.btnCompleteAllText}>
                  BÀN GIAO TOÀN BỘ ({deliveringItems.length} MÓN • {priceFormatted})
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  roomBadgeText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  guestNameText: {
    fontSize: 12,
    flex: 1,
    marginHorizontal: 8,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
  },
  countBadgeText: {
    color: '#0A0F1D',
    fontSize: 11,
    fontWeight: '800',
  },
  itemsSummaryBox: {
    paddingVertical: 6,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(156, 163, 175, 0.2)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(156, 163, 175, 0.2)',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  itemName: {
    fontSize: 12.5,
    flex: 1,
  },
  deliveringLabel: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
  },
  inProgressLabel: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '700',
  },
  actionRow: {
    marginTop: 2,
  },
  btnStartDelivery: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38BDF8',
    paddingVertical: 9,
    borderRadius: 10,
  },
  btnStartDeliveryText: {
    color: '#0A0F1D',
    fontSize: 12,
    fontWeight: '800',
  },
  btnCompleteAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  btnCompleteAllText: {
    color: '#0A0F1D',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

