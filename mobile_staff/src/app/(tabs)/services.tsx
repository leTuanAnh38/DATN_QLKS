import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../../components/NotificationBell';

interface ServiceOrder {
  id: number;
  booking_code: string;
  room_number: string;
  guest_name: string;
  service_name: string;
  category_name: string;
  category_type: string;
  quantity: number;
  total_price: string;
  request_time: string | null;
  status: string;
  status_display: string;
  assigned_staff: number | null;
  assigned_staff_name: string;
  note: string;
  created_at: string;
}

export default function ServicesScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      const res = await apiClient.get('/services/requests/');
      const data = res.data;
      const list = data.results || data.requests || data.data || [];
      // Lọc bỏ vận chuyển (vì đã có tab riêng của đội xe)
      const nonTransport = (Array.isArray(list) ? list : []).filter(
        (it: any) => it.category_type !== 'transport'
      );
      setOrders(nonTransport);
    } catch (err: any) {
      console.warn('Lỗi tải danh sách dịch vụ:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchOrders();
  };

  // KPI stats
  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.status === 'pending').length;
    const preparing = orders.filter((o) => o.status === 'in_progress').length;
    const delivering = orders.filter((o) => o.status === 'delivering').length;
    const completed = orders.filter((o) => o.status === 'completed').length;
    return { total, pending, preparing, delivering, completed };
  }, [orders]);

  // Bộ lọc
  const filteredOrders = useMemo(() => {
    return orders.filter((item) => {
      let matchTab = true;
      if (activeTab === 'pending') {
        matchTab = item.status === 'pending';
      } else if (activeTab === 'in_progress') {
        matchTab = item.status === 'in_progress' || item.status === 'delivering';
      } else if (activeTab === 'completed') {
        matchTab = item.status === 'completed';
      }

      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        (item.guest_name && item.guest_name.toLowerCase().includes(q)) ||
        (item.room_number && item.room_number.toLowerCase().includes(q)) ||
        (item.service_name && item.service_name.toLowerCase().includes(q)) ||
        (item.note && item.note.toLowerCase().includes(q));

      return matchTab && matchSearch;
    });
  }, [orders, activeTab, searchQuery]);

  const handleClaim = async (item: ServiceOrder) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await apiClient.post(`/services/requests/${item.id}/claim/`);
      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Thành công', `Bạn đã nhận chuẩn bị yêu cầu cho Phòng ${item.room_number}!`);
        fetchOrders();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể nhận đơn này.';
      Alert.alert('Lỗi', msg);
    }
  };

  const handleUpdateStatus = async (item: ServiceOrder, newStatus: string, label: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await apiClient.patch(`/services/requests/${item.id}/`, {
        status: newStatus,
      });
      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Cập nhật thành công', `Đơn phòng ${item.room_number} đã chuyển sang "${label}"!`);
        fetchOrders();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể cập nhật trạng thái.';
      Alert.alert('Lỗi', msg);
    }
  };

  const getStatusBadgeConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.4)',
          text: '#FBBF24',
          label: 'Chờ chế biến',
        };
      case 'in_progress':
        return {
          bg: 'rgba(56, 189, 248, 0.12)',
          border: 'rgba(56, 189, 248, 0.4)',
          text: '#38BDF8',
          label: 'Đang nấu / chuẩn bị',
        };
      case 'delivering':
        return {
          bg: 'rgba(168, 85, 247, 0.14)',
          border: 'rgba(168, 85, 247, 0.4)',
          text: '#C084FC',
          label: 'Đang mang lên phòng',
        };
      case 'completed':
        return {
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.4)',
          text: '#34D399',
          label: 'Đã phục vụ xong',
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

  const renderItem = ({ item }: { item: ServiceOrder }) => {
    const badge = getStatusBadgeConfig(item.status);
    const isMyTask = item.assigned_staff === user?.id;

    return (
      <View style={[styles.card, isMyTask && styles.cardMyTask]}>
        {/* Header Đơn */}
        <View style={styles.cardHeader}>
          <View style={styles.roomTag}>
            <Ionicons name="bed" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
            <Text style={styles.roomTagText}>P.{item.room_number || '?'}</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>
              {item.status_display || badge.label}
            </Text>
          </View>
        </View>

        {/* Tên Món & Số lượng */}
        <View style={styles.foodRow}>
          <View style={styles.foodIconBox}>
            <Ionicons name="restaurant" size={20} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.serviceName} numberOfLines={1}>
                {item.service_name}
              </Text>
              <View style={styles.quantityBadge}>
                <Text style={styles.quantityBadgeText}>x{item.quantity}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <Text style={styles.priceText}>
                {item.total_price ? `${parseInt(item.total_price, 10).toLocaleString('vi-VN')} đ` : 'Miễn phí'}
              </Text>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.guestInfoText}>Khách: {item.guest_name}</Text>
            </View>
          </View>
        </View>

        {/* Ghi chú yêu cầu đặc biệt của khách */}
        {item.note ? (
          <View style={styles.noteBox}>
            <Ionicons name="receipt-outline" size={15} color="#F59E0B" style={{ marginRight: 6 }} />
            <Text style={styles.noteText}>Yêu cầu: {item.note}</Text>
          </View>
        ) : null}

        {/* Nhân viên tiếp nhận */}
        <View style={styles.staffRow}>
          <Text style={styles.staffLabel}>Người phụ trách:</Text>
          <Text style={[styles.staffValue, isMyTask && { color: '#F59E0B', fontWeight: '800' }]}>
            {item.assigned_staff_name || 'Chưa ai nhận'}
            {isMyTask ? ' (Bạn)' : ''}
          </Text>
        </View>

        {/* Nút hành động 1 chạm */}
        <View style={styles.actionRow}>
          {!item.assigned_staff && item.status === 'pending' && (
            <TouchableOpacity
              style={styles.btnClaim}
              onPress={() => handleClaim(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="hand-right" size={15} color="#0A0F1D" style={{ marginRight: 6 }} />
              <Text style={styles.btnClaimText}>TIẾP NHẬN ĐƠN MÓN</Text>
            </TouchableOpacity>
          )}

          {item.status === 'in_progress' && (
            <TouchableOpacity
              style={styles.btnDeliver}
              onPress={() => handleUpdateStatus(item, 'delivering', 'Đang mang lên phòng')}
              activeOpacity={0.8}
            >
              <Ionicons name="bicycle" size={16} color="#0A0F1D" style={{ marginRight: 6 }} />
              <Text style={styles.btnDeliverText}>BẮT ĐẦU MANG LÊN PHÒNG</Text>
            </TouchableOpacity>
          )}

          {item.status === 'delivering' && (
            <TouchableOpacity
              style={styles.btnComplete}
              onPress={() => handleUpdateStatus(item, 'completed', 'Đã giao xong')}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done" size={16} color="#0A0F1D" style={{ marginRight: 6 }} />
              <Text style={styles.btnCompleteText}>XÁC NHẬN ĐÃ GIAO KHÁCH ✨</Text>
            </TouchableOpacity>
          )}

          {item.status === 'completed' && (
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark-circle" size={15} color="#34D399" style={{ marginRight: 5 }} />
              <Text style={styles.doneBadgeText}>Đã giao thành công</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      {/* 1. Header Khách Sạn */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandSubtitle}>TA LUXURY HOTEL</Text>
          <Text style={styles.greetingTitle}>Phục Vụ & Gọi Món 🍽️</Text>
        </View>
        <View style={styles.headerRightActions}>
          <NotificationBell />
          <TouchableOpacity style={styles.refreshCircleBtn} onPress={onRefresh} activeOpacity={0.7}>
            <Ionicons name="refresh" size={18} color="#F59E0B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Dải Bộ Lọc & KPI Cố Định 100% (Không bị trôi trượt khi lướt) */}
      <View style={styles.fixedFilterBar}>
        {[
          { key: 'all', label: 'Tất cả', count: stats.total, color: '#F8FAFC' },
          { key: 'pending', label: 'Chờ làm', count: stats.pending, color: '#F59E0B' },
          { key: 'in_progress', label: 'Đang giao', count: stats.preparing + stats.delivering, color: '#38BDF8' },
          { key: 'completed', label: 'Đã giao', count: stats.completed, color: '#34D399' },
        ].map((item) => {
          const isSelected = activeTab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.fixedFilterCard,
                isSelected && styles.fixedFilterCardSelected,
              ]}
              onPress={() => {
                setActiveTab(item.key);
                Haptics.selectionAsync();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.fixedFilterNumber, { color: isSelected ? '#F59E0B' : item.color }]}>
                {item.count}
              </Text>
              <Text
                style={[
                  styles.fixedFilterLabel,
                  isSelected && styles.fixedFilterLabelSelected,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. Ô Tìm Kiếm Nhanh */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo số phòng, tên món, tên khách..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 8 }}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 5. Danh Sách Đơn Món */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingMessage}>Đang tải đơn gọi món F&B...</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="restaurant-outline" size={56} color="#334155" />
          <Text style={styles.emptyTitle}>Không có yêu cầu phục vụ nào</Text>
          <Text style={styles.emptySubtitle}>
            Hiện chưa có khách gọi món hoặc yêu cầu tiện ích trong mục này.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0A0F1D',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 1.5,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2,
  },
  refreshCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fixedFilterBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 10,
  },
  fixedFilterCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1F2937',
  },
  fixedFilterCardSelected: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  fixedFilterNumber: {
    fontSize: 16,
    fontWeight: '900',
  },
  fixedFilterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
  },
  fixedFilterLabelSelected: {
    color: '#F59E0B',
    fontWeight: '800',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    marginHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    height: 42,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    paddingHorizontal: 10,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingMessage: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 13,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  foodIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
    flex: 1,
  },
  quantityBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  quantityBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0F1D',
  },
  priceText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F59E0B',
  },
  dotSeparator: {
    color: '#475569',
    marginHorizontal: 6,
  },
  guestInfoText: {
    fontSize: 12,
    color: '#94A3B8',
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
  staffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 10,
  },
  staffLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  staffValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  actionRow: {
    marginTop: 4,
  },
  btnClaim: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    height: 42,
    borderRadius: 12,
  },
  btnClaimText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.5,
  },
  btnDeliver: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38BDF8',
    height: 42,
    borderRadius: 12,
  },
  btnDeliverText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.5,
  },
  btnComplete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    height: 42,
    borderRadius: 12,
  },
  btnCompleteText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.5,
  },
  doneBadge: {
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
