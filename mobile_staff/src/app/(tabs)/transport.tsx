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
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../../components/NotificationBell';

interface ServiceRequestItem {
  id: number;
  booking_code: string;
  room_number: string;
  guest_name: string;
  guest_phone: string;
  service_name: string;
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

export default function TransportScreen() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ServiceRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTransportRequests = useCallback(async () => {
    try {
      const res = await apiClient.get('/services/requests/?category_type=transport');
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

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchTransportRequests();
  };

  // Thống kê nhanh KPI
  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'pending').length;
    const active = requests.filter((r) => r.status === 'in_progress' || r.status === 'delivering').length;
    const completed = requests.filter((r) => r.status === 'completed').length;
    const myTasks = requests.filter((r) => r.assigned_staff === user?.id).length;
    return { total, pending, active, completed, myTasks };
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
        matchFilter = item.assigned_staff === user?.id;
      } else if (filterType === 'completed') {
        matchFilter = item.status === 'completed';
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

  // Tài xế tiếp nhận cuốc xe
  const handleClaim = async (item: ServiceRequestItem) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await apiClient.post(`/services/requests/${item.id}/claim/`);
      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Thành công', `Bạn đã tiếp nhận cuốc xe cho khách ${item.guest_name}!`);
        fetchTransportRequests();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể tiếp nhận cuốc xe.';
      Alert.alert('Lỗi', msg);
    }
  };

  // Cập nhật trạng thái chuyến đi
  const handleUpdateStatus = async (item: ServiceRequestItem, newStatus: string, statusLabel: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await apiClient.patch(`/services/requests/${item.id}/`, {
        status: newStatus,
      });
      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Đã cập nhật', `Cuốc xe đã chuyển sang "${statusLabel}"!`);
        fetchTransportRequests();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể cập nhật trạng thái.';
      Alert.alert('Lỗi', msg);
    }
  };

  const callGuest = (phone: string) => {
    if (!phone) {
      Alert.alert('Thông báo', 'Khách hàng chưa cung cấp số điện thoại.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const openMapNavigation = (destination: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const query = encodeURIComponent(destination || 'Sân bay quốc tế Đà Nẵng');
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });
    Linking.openURL(url || `https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  const sendSmsToGuest = (phone: string, guestName: string) => {
    if (!phone) {
      Alert.alert('Thông báo', 'Khách hàng chưa có số điện thoại.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const msg = encodeURIComponent(`Kính chào Quý khách ${guestName || ''}, xe đưa đón của TA Luxury Hotel đã sẵn sàng phục vụ. Quý khách vui lòng liên hệ tài xế khi đến điểm hẹn.`);
    Linking.openURL(`sms:${phone}?body=${msg}`);
  };

  const getStatusBadgeConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.4)',
          text: '#FBBF24',
          label: 'Chờ nhận',
          icon: 'time-outline' as const,
        };
      case 'in_progress':
        return {
          bg: 'rgba(56, 189, 248, 0.12)',
          border: 'rgba(56, 189, 248, 0.4)',
          text: '#38BDF8',
          label: 'Đang chuẩn bị',
          icon: 'car-sport-outline' as const,
        };
      case 'delivering':
        return {
          bg: 'rgba(168, 85, 247, 0.14)',
          border: 'rgba(168, 85, 247, 0.4)',
          text: '#C084FC',
          label: 'Đang đón khách',
          icon: 'navigate-outline' as const,
        };
      case 'completed':
        return {
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.4)',
          text: '#34D399',
          label: 'Đã hoàn tất',
          icon: 'checkmark-circle-outline' as const,
        };
      default:
        return {
          bg: '#1E293B',
          border: '#334155',
          text: '#94A3B8',
          label: status,
          icon: 'ellipse-outline' as const,
        };
    }
  };

  const renderItem = ({ item }: { item: ServiceRequestItem }) => {
    const badge = getStatusBadgeConfig(item.status);
    const isMyTask = item.assigned_staff === user?.id;

    return (
      <View style={[styles.card, isMyTask && styles.cardMyTask]}>
        {/* Header cuốc xe */}
        <View style={styles.cardHeader}>
          <View style={styles.roomTag}>
            <Ionicons name="bed" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
            <Text style={styles.roomTagText}>
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

        {/* Tiêu đề Dịch vụ xe */}
        <View style={styles.serviceRow}>
          <View style={styles.carIconBox}>
            <Ionicons name="car-sport" size={20} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.serviceName}>{item.service_name}</Text>
            <Text style={styles.bookingCode}>Mã đặt: #{item.booking_code}</Text>
          </View>
        </View>

        {/* Thông tin khách hàng & Giờ hẹn */}
        <View style={styles.passengerBox}>
          <View style={styles.passengerRow}>
            <Ionicons name="person" size={14} color="#CBD5E1" />
            <Text style={styles.passengerName}>{item.guest_name || 'Khách sạn'}</Text>
          </View>

          {item.request_time ? (
            <View style={styles.timeBadge}>
              <Ionicons name="alarm" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
              <Text style={styles.timeBadgeText}>
                {new Date(item.request_time).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                - {new Date(item.request_time).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Ghi chú lộ trình / chuyến bay */}
        {item.note ? (
          <View style={styles.noteBox}>
            <Ionicons name="navigate-circle" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
            <Text style={styles.noteText}>{item.note}</Text>
          </View>
        ) : null}

        {/* Tài xế phụ trách */}
        <View style={styles.driverInfoRow}>
          <Text style={styles.driverLabel}>Tài xế nhận:</Text>
          <Text style={[styles.driverValue, isMyTask && { color: '#F59E0B', fontWeight: '800' }]}>
            {item.assigned_staff_name ? item.assigned_staff_name : 'Chưa có ai nhận'}
            {isMyTask ? ' (Bạn)' : ''}
          </Text>
        </View>

        {/* Nút hành động cho tài xế */}
        <View style={styles.actionContainer}>
          {/* Nút bản đồ chỉ đường Maps */}
          <TouchableOpacity
            style={styles.mapButton}
            onPress={() => openMapNavigation(item.note || item.service_name)}
            activeOpacity={0.7}
          >
            <Ionicons name="navigate-circle" size={18} color="#38BDF8" />
          </TouchableOpacity>

          {/* Nút gửi tin nhắn SMS mẫu cho khách */}
          {item.guest_phone ? (
            <TouchableOpacity
              style={styles.smsButton}
              onPress={() => sendSmsToGuest(item.guest_phone, item.guest_name)}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-ellipses" size={16} color="#F59E0B" />
            </TouchableOpacity>
          ) : null}

          {/* Nút gọi điện cho khách */}
          {item.guest_phone ? (
            <TouchableOpacity
              style={styles.callButton}
              onPress={() => callGuest(item.guest_phone)}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={15} color="#10B981" />
              <Text style={styles.callButtonText}>Gọi</Text>
            </TouchableOpacity>
          ) : null}

          {/* Chưa có ai nhận hoặc pending -> Nút Nhận cuốc */}
          {!item.assigned_staff && item.status === 'pending' && (
            <TouchableOpacity
              style={styles.claimButton}
              onPress={() => handleClaim(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="hand-right" size={15} color="#0A0F1D" style={{ marginRight: 6 }} />
              <Text style={styles.claimButtonText}>TIẾP NHẬN CUỐC</Text>
            </TouchableOpacity>
          )}

          {/* Đang chuẩn bị -> Bắt đầu đi đón */}
          {item.status === 'in_progress' && (
            <TouchableOpacity
              style={styles.departButton}
              onPress={() => handleUpdateStatus(item, 'delivering', 'Đang đi đón khách')}
              activeOpacity={0.8}
            >
              <Ionicons name="navigate" size={15} color="#0A0F1D" style={{ marginRight: 6 }} />
              <Text style={styles.departButtonText}>BẮT ĐẦU ĐÓN KHÁCH</Text>
            </TouchableOpacity>
          )}

          {/* Đang đi đón -> Hoàn tất */}
          {item.status === 'delivering' && (
            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => handleUpdateStatus(item, 'completed', 'Hoàn tất chuyến xe')}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done" size={16} color="#0A0F1D" style={{ marginRight: 6 }} />
              <Text style={styles.completeButtonText}>ĐÃ TRẢ KHÁCH XONG ✨</Text>
            </TouchableOpacity>
          )}

          {item.status === 'completed' && (
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark-circle" size={15} color="#34D399" style={{ marginRight: 5 }} />
              <Text style={styles.doneBadgeText}>Chuyến đi hoàn tất</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      {/* 1. Header Khách Sạn & Thông Tin Đội Xe */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandSubtitle}>TA LUXURY HOTEL</Text>
          <Text style={styles.greetingTitle}>Đội Xe & Vận Chuyển 🚗</Text>
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
          { key: 'pending', label: 'Chờ nhận', count: stats.pending, color: '#F59E0B' },
          { key: 'active', label: 'Đang chạy', count: stats.active, color: '#38BDF8' },
          { key: 'my', label: 'Của tôi', count: stats.myTasks, color: '#A855F7' },
          { key: 'completed', label: 'Đã xong', count: stats.completed, color: '#34D399' },
        ].map((item) => {
          const isSelected = filterType === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.fixedFilterCard,
                isSelected && styles.fixedFilterCardSelected,
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
          placeholder="Tìm tên khách, số phòng, lộ trình..."
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

      {/* 5. Danh Sách Cuốc Xe */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingMessage}>Đang tải danh sách điều phối xe...</Text>
        </View>
      ) : filteredRequests.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="car-sport-outline" size={56} color="#334155" />
          <Text style={styles.emptyTitle}>Không có cuốc xe nào</Text>
          <Text style={styles.emptySubtitle}>
            Hiện chưa có yêu cầu đưa đón nào trong danh mục này.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
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
  carIconBox: {
    width: 40,
    height: 40,
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
  },
  bookingCode: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
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
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
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
  actionContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  mapButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  smsButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  callButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
    marginLeft: 6,
  },
  claimButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    height: 42,
    borderRadius: 12,
  },
  claimButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.5,
  },
  departButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38BDF8',
    height: 42,
    borderRadius: 12,
  },
  departButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.5,
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    height: 42,
    borderRadius: 12,
  },
  completeButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.5,
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
