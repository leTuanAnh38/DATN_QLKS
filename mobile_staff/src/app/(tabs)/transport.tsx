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
  Linking,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { useFocusPolling } from '../../hooks/use-focus-polling';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme } from '../../contexts/ThemeContext';
import NotificationBell from '../../components/NotificationBell';
import { TransportListSkeleton } from '../../components/SkeletonLoader';
import { enqueueOfflineAction } from '../../services/offlineQueue';
import {
  TransportCard,
  ServiceRequestItem,
  CreateTransportModal,
} from '../../components/transport';

export default function TransportScreen() {
  const { user } = useAuth();
  const { colors, isDark, hotelStars, hotelName } = useAppTheme();
  const [requests, setRequests] = useState<ServiceRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Modal Đặt xe đưa đón khách
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const fetchTransportRequests = useCallback(async () => {
    try {
      const res = await apiClient.get('/services/requests/?category_type=transport&no_page=true');
      const data = res.data;
      const list = data.results || data.requests || data.data || [];
      setRequests(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.warn('Lỗi tải cuốc xe vận chuyển:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchTransportRequests();
  }, [fetchTransportRequests]);

  // Real-time polling 6 giây đồng bộ hiện trường đội xe (chỉ khi tab hiển thị & app ở foreground)
  useFocusPolling(fetchTransportRequests, 6000);

  const onRefresh = () => {
    setRefreshing(true);
    setVisibleCount(15);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchTransportRequests();
  };

  // Thống kê nhanh KPI (Lọc bỏ các cuốc xe đã bị hủy)
  const stats = useMemo(() => {
    const valid = requests.filter((r) => r.status !== 'cancelled');
    const total = valid.length;
    const pending = valid.filter((r) => r.status === 'pending').length;
    const active = valid.filter((r) => r.status === 'in_progress' || r.status === 'delivering').length;
    const completed = valid.filter((r) => r.status === 'completed').length;
    const cancelled = requests.filter((r) => r.status === 'cancelled').length;
    const myTasks = valid.filter((r) => r.assigned_staff === user?.id).length;
    return { total, pending, active, completed, cancelled, myTasks };
  }, [requests, user?.id]);

  // Bộ lọc dữ liệu
  const filteredRequests = useMemo(() => {
    return requests.filter((item) => {
      let matchFilter = true;
      if (filterType === 'pending') {
        matchFilter = item.status === 'pending';
      } else if (filterType === 'active') {
        matchFilter = item.status === 'in_progress' || item.status === 'delivering';
      } else if (filterType === 'my') {
        matchFilter = item.assigned_staff === user?.id && item.status !== 'cancelled';
      } else if (filterType === 'completed') {
        matchFilter = item.status === 'completed';
      } else if (filterType === 'cancelled') {
        matchFilter = item.status === 'cancelled';
      } else {
        // Tab "Tất cả" mặc định chỉ hiển thị các cuốc xe còn hiệu lực
        matchFilter = item.status !== 'cancelled';
      }

      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        (item.guest_name && item.guest_name.toLowerCase().includes(q)) ||
        (item.room_number && item.room_number.toLowerCase().includes(q)) ||
        (item.service_name && item.service_name.toLowerCase().includes(q)) ||
        (item.note && item.note.toLowerCase().includes(q)) ||
        (item.booking_code && item.booking_code.toLowerCase().includes(q));

      return matchFilter && matchSearch;
    });
  }, [requests, filterType, searchQuery, user?.id]);

  // Infinite Scroll cho Cuốc xe
  const [visibleCount, setVisibleCount] = useState(15);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setVisibleCount(15);
  }, [filterType, searchQuery]);

  const displayedRequests = useMemo(() => {
    return filteredRequests.slice(0, visibleCount);
  }, [filteredRequests, visibleCount]);

  const handleLoadMore = () => {
    if (loadingMore || visibleCount >= filteredRequests.length) return;
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 15, filteredRequests.length));
      setLoadingMore(false);
    }, 250);
  };

  const renderFooter = () => {
    if (filteredRequests.length <= 15) return <View style={{ height: 20 }} />;
    if (loadingMore) {
      return (
        <View style={styles.loadMoreFooter}>
          <ActivityIndicator size="small" color="#F59E0B" />
          <Text style={styles.loadMoreText}>Đang tải thêm cuốc xe cũ hơn...</Text>
        </View>
      );
    }
    if (visibleCount >= filteredRequests.length) {
      return (
        <View style={styles.endOfListFooter}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.endOfListText}>Đã hiển thị toàn bộ {filteredRequests.length} cuốc xe</Text>
        </View>
      );
    }
    return (
      <View style={styles.endOfListFooter}>
        <Text style={styles.loadMoreHintText}>
          Đang xem {visibleCount}/{filteredRequests.length} cuốc xe • Cuộn xuống để xem thêm
        </Text>
      </View>
    );
  };

  // Tài xế tiếp nhận cuốc xe (Khóa chống double tap + Hỗ trợ Ngoại tuyến)
  const handleClaim = async (item: ServiceRequestItem) => {
    if (actionLoadingId) return;
    setActionLoadingId(item.id);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await apiClient.post(`/services/requests/${item.id}/claim/`);
      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Thành công', `Bạn đã tiếp nhận cuốc xe cho khách ${item.guest_name}!`);
        fetchTransportRequests();
      }
    } catch (err: any) {
      if (!err.response) {
        await enqueueOfflineAction({
          description: `Cuốc xe #${item.booking_code} (${item.guest_name}): Tiếp nhận cuốc xe`,
          url: `/services/requests/${item.id}/claim/`,
          method: 'POST',
        });
        setRequests((prev) =>
          prev.map((r) =>
            r.id === item.id
              ? { ...r, assigned_staff: user?.id || null, assigned_staff_name: user?.first_name || 'Bạn' }
              : r
          )
        );
        Alert.alert(
          'Đã lưu ngoại tuyến',
          `Mất kết nối máy chủ! Thao tác tiếp nhận cuốc xe #${item.booking_code} đã được lưu vào hàng đợi và sẽ tự động đồng bộ khi có mạng lại.`
        );
      } else {
        const msg = err.response?.data?.message || 'Không thể tiếp nhận cuốc xe.';
        Alert.alert('Lỗi', msg);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Cập nhật trạng thái chuyến đi (Khóa chống double tap + Hỗ trợ Ngoại tuyến)
  const handleUpdateStatus = async (item: ServiceRequestItem, newStatus: string, statusLabel: string) => {
    if (actionLoadingId) return;
    setActionLoadingId(item.id);
    const payload = {
      status: newStatus,
      assigned_staff: item.assigned_staff || user?.id,
    };
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await apiClient.patch(`/services/requests/${item.id}/`, payload);
      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Đã cập nhật', `Cuốc xe đã chuyển sang "${statusLabel}"!`);
        fetchTransportRequests();
      }
    } catch (err: any) {
      if (!err.response) {
        await enqueueOfflineAction({
          description: `Cuốc xe #${item.booking_code} (${item.guest_name}): Chuyển sang "${statusLabel}"`,
          url: `/services/requests/${item.id}/`,
          method: 'PATCH',
          data: payload,
        });
        setRequests((prev) =>
          prev.map((r) =>
            r.id === item.id ? { ...r, status: newStatus, status_display: statusLabel } : r
          )
        );
        Alert.alert(
          'Đã lưu ngoại tuyến',
          `Mất kết nối máy chủ! Trạng thái "${statusLabel}" của cuốc xe #${item.booking_code} đã được lưu vào hàng đợi và sẽ tự động đồng bộ khi có mạng lại.`
        );
      } else {
        const msg = err.response?.data?.message || 'Không thể cập nhật trạng thái.';
        Alert.alert('Lỗi', msg);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const safeOpenUrl = async (url: string, fallbackError: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Không hỗ trợ', fallbackError);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Lỗi', fallbackError);
    }
  };

  const callGuest = (phone: string) => {
    if (!phone) {
      Alert.alert('Thông báo', 'Khách hàng chưa cung cấp số điện thoại.');
      return;
    }
    safeOpenUrl(`tel:${phone}`, 'Thiết bị không hỗ trợ thực hiện cuộc gọi.');
  };

  // Chỉ đường GPS bản đồ tối ưu cho iPhone (Apple Maps) & Android (Google Maps)
  const openMapNavigation = (destination: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const query = encodeURIComponent(destination || 'Sân bay quốc tế Đà Nẵng');
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${query}`,
      android: `google.navigation:q=${query}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${query}`,
    });
    safeOpenUrl(
      url || `https://www.google.com/maps/dir/?api=1&destination=${query}`,
      'Không thể mở ứng dụng bản đồ trên thiết bị này.'
    );
  };

  const sendSmsToGuest = (phone: string, guestName: string) => {
    if (!phone) {
      Alert.alert('Thông báo', 'Khách hàng chưa có số điện thoại.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const msg = encodeURIComponent(
      `Kính chào Quý khách ${guestName || ''}, xe đưa đón của TA Luxury Hotel đã sẵn sàng phục vụ. Quý khách vui lòng liên hệ tài xế khi đến điểm hẹn.`
    );
    safeOpenUrl(`sms:${phone}?body=${msg}`, 'Thiết bị không hỗ trợ nhắn tin SMS.');
  };

  const renderItem = useCallback(
    ({ item }: { item: ServiceRequestItem }) => (
      <TransportCard
        item={item}
        isMyTask={item.assigned_staff === user?.id}
        isActionLoading={actionLoadingId === item.id}
        onClaim={handleClaim}
        onUpdateStatus={handleUpdateStatus}
        onCallGuest={callGuest}
        onSendSms={sendSmsToGuest}
        onOpenMap={openMapNavigation}
      />
    ),
    [user?.id, actionLoadingId, handleClaim, handleUpdateStatus]
  );

  return (
    <SafeAreaView style={[styles.safeContainer, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. Header Khách Sạn & Thông Tin Đội Xe */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.brandSubtitle} numberOfLines={1} ellipsizeMode="tail">
            {hotelName.toUpperCase()} • {hotelStars} SAO
          </Text>
          <Text style={[styles.greetingTitle, { color: colors.text, fontSize: 18 }]} numberOfLines={1}>
            Đội Xe & Vận Chuyển
          </Text>
        </View>
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerBookCarBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCreateModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={15} color="#0A0F1D" />
            <Text style={styles.headerBookCarBtnText}>Đặt xe</Text>
          </TouchableOpacity>

          <NotificationBell />
          <TouchableOpacity
            style={[
              styles.refreshCircleBtn,
              !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
            ]}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={17} color="#F59E0B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Dải Bộ Lọc & KPI Cố Định 100% */}
      <View style={styles.fixedFilterBar}>
        {[
          { key: 'all', label: 'Tất cả', count: stats.total, color: isDark ? '#F8FAFC' : '#0F172A' },
          { key: 'pending', label: 'Chờ nhận', count: stats.pending, color: '#F59E0B' },
          { key: 'active', label: 'Đang chạy', count: stats.active, color: isDark ? '#38BDF8' : '#0284C7' },
          { key: 'my', label: 'Của tôi', count: stats.myTasks, color: '#A855F7' },
          { key: 'completed', label: 'Đã xong', count: stats.completed, color: isDark ? '#34D399' : '#059669' },
        ].map((item) => {
          const isSelected = filterType === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.fixedFilterCard,
                !isDark && {
                  backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.12)' : '#FFFFFF',
                  borderColor: isSelected ? '#F59E0B' : '#E2E8F0',
                  shadowColor: '#64748B',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.06,
                  shadowRadius: 3,
                  elevation: 1,
                },
                isSelected && isDark && styles.fixedFilterCardSelected,
              ]}
              onPress={() => {
                setFilterType(item.key);
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
                  !isDark && { color: isSelected ? '#D97706' : '#64748B' },
                  isSelected && isDark && styles.fixedFilterLabelSelected,
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
      <View style={[styles.searchWrapper, !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
        <Ionicons name="search-outline" size={18} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginLeft: 12 }} />
        <TextInput
          style={[styles.searchInput, !isDark && { color: '#0F172A' }]}
          placeholder="Tìm tên khách, số phòng, lộ trình..."
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
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

      {/* 4. Danh Sách Cuốc Xe */}
      {loading ? (
        <TransportListSkeleton />
      ) : filteredRequests.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="car-sport-outline" size={56} color={isDark ? '#334155' : '#CBD5E1'} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Không có cuốc xe nào</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Hiện chưa có yêu cầu đưa đón nào trong danh mục này.
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedRequests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.2}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
          }
        />
      )}

      {/* Modal Đặt Xe Đưa Đón Khách Hàng */}
      <CreateTransportModal
        visible={createModalVisible}
        isDark={isDark}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={fetchTransportRequests}
      />
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
    fontSize: 10.5,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
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
  headerBookCarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 3,
  },
  headerBookCarBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0A0F1D',
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
    fontSize: 10.5,
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
  loadMoreFooter: {
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadMoreText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  endOfListFooter: {
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endOfListText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  loadMoreHintText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
});
