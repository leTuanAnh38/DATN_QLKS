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
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../../components/NotificationBell';
import { DEFAULT_API_URL } from '../../api/config';

interface ServiceRequestItem {
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
  assigned_staff: number | null;
  assigned_staff_name: string;
  note: string;
  created_at: string;
}

// Helper lấy URL ảnh xe đưa đón / vận chuyển
const getVehicleImage = (item: any): string => {
  const raw =
    item?.service_image ||
    item?.service?.image ||
    item?.service?.image_url ||
    item?.image_url ||
    item?.image;
  if (!raw || typeof raw !== 'string') {
    return 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=800&q=80';
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  const base = (apiClient.defaults.baseURL || DEFAULT_API_URL || '').replace(/\/api\/?$/, '');
  return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

// Helper định dạng ngày giờ đặt cuốc xe & giờ đón
const formatDateTime = (dateStr?: string | null): string => {
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

export default function TransportScreen() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ServiceRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Đặt xe đưa đón khách
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [occupiedRooms, setOccupiedRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [transportServices, setTransportServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [pickupLocation, setPickupLocation] = useState('Sân bay quốc tế Đà Nẵng');
  const [dropoffLocation, setDropoffLocation] = useState('Sảnh TA Luxury Hotel');
  const [flightCode, setFlightCode] = useState('');
  const [pickupTime, setPickupTime] = useState('14:30');
  const [passengerCount, setPassengerCount] = useState(2);
  const [note, setNote] = useState('');
  const [loadingModalData, setLoadingModalData] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);

  const openCreateModal = async () => {
    setCreateModalVisible(true);
    setLoadingModalData(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const [resRooms, resServices] = await Promise.all([
        apiClient.get('/rooms/admin/rooms/'),
        apiClient.get('/services/items/?all=true'),
      ]);

      const rList = resRooms.data.results || resRooms.data.rooms || resRooms.data.data || resRooms.data || [];
      const occ = (Array.isArray(rList) ? rList : []).filter(
        (r: any) => r.status === 'occupied' && r.current_booking
      );
      setOccupiedRooms(occ);
      if (occ.length > 0) {
        setSelectedRoom(occ[0]);
      }

      const sList = resServices.data.results || resServices.data.items || resServices.data.data || resServices.data || [];
      const trans = (Array.isArray(sList) ? sList : []).filter((s: any) => {
        const t = `${s.name || ''} ${s.category_name || ''}`.toLowerCase();
        return (
          t.includes('xe') ||
          t.includes('sân bay') ||
          t.includes('đưa đón') ||
          t.includes('transfer') ||
          t.includes('limousine') ||
          t.includes('maybach') ||
          t.includes('shuttle') ||
          t.includes('taxi')
        );
      });
      setTransportServices(trans.length > 0 ? trans : sList.slice(0, 3));
      if (trans.length > 0) {
        setSelectedService(trans[0]);
      } else if (sList.length > 0) {
        setSelectedService(sList[0]);
      }
    } catch (e) {
      console.warn('Lỗi tải dữ liệu đặt xe:', e);
    } finally {
      setLoadingModalData(false);
    }
  };

  const submitTransportBooking = async () => {
    if (!selectedRoom || !selectedRoom.current_booking) {
      Alert.alert('Chưa chọn phòng', 'Vui lòng chọn phòng khách đang lưu trú để đặt xe.');
      return;
    }
    if (!selectedService) {
      Alert.alert('Chưa chọn loại xe', 'Vui lòng chọn dịch vụ xe đưa đón.');
      return;
    }

    setSubmittingBooking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const bookingId = selectedRoom.current_booking.id;
    const fullNote = [
      pickupLocation ? `Đón: ${pickupLocation}` : '',
      dropoffLocation ? `Đến: ${dropoffLocation}` : '',
      flightCode.trim() ? `Chuyến bay: ${flightCode.trim()}` : '',
      pickupTime.trim() ? `Giờ hẹn: ${pickupTime.trim()}` : '',
      passengerCount ? `Số khách: ${passengerCount}` : '',
      note.trim() ? `Ghi chú: ${note.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    try {
      const payload: any = {
        booking: bookingId,
        service_id: selectedService.id,
        quantity: 1,
        note: fullNote,
      };

      const res = await apiClient.post('/services/requests/', payload);
      if (res.data.success || res.data.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Đặt xe thành công 🚗',
          `Đã tạo cuốc xe đưa đón cho Phòng ${selectedRoom.room_number} (${selectedRoom.current_booking.guest_name})!\nTài xế sẽ nhận được thông báo ngay lập tức.`
        );
        setCreateModalVisible(false);
        fetchTransportRequests();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể tạo yêu cầu đặt xe.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmittingBooking(false);
    }
  };

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

  const onRefresh = () => {
    setRefreshing(true);
    setVisibleCount(15);
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
        assigned_staff: item.assigned_staff || user?.id,
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
            <Text style={styles.serviceName}>{item.service_name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
              <Text style={styles.bookingCode}>Mã: #{item.booking_code}</Text>
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
        <View style={styles.passengerBox}>
          <View style={styles.passengerRow}>
            <Ionicons name="person" size={14} color="#CBD5E1" />
            <Text style={styles.passengerName}>{item.guest_name || 'Khách sạn'}</Text>
          </View>

          {item.guest_phone ? (
            <TouchableOpacity
              style={styles.guestPhonePill}
              onPress={() => callGuest(item.guest_phone)}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={12} color="#10B981" style={{ marginRight: 4 }} />
              <Text style={styles.guestPhoneText}>{item.guest_phone}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Thời gian đặt cuốc xe & Giờ hẹn đón */}
        <View style={styles.transportTimingBox}>
          {item.created_at ? (
            <View style={styles.transportTimingItem}>
              <Ionicons name="time-outline" size={13} color="#38BDF8" style={{ marginRight: 4 }} />
              <Text style={styles.transportTimingLabel}>Đặt lúc:</Text>
              <Text style={styles.transportTimingValue}>{formatDateTime(item.created_at)}</Text>
            </View>
          ) : null}

          {item.request_time ? (
            <View style={[styles.transportTimingItem, styles.transportTimingScheduled]}>
              <Ionicons name="alarm-outline" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
              <Text style={[styles.transportTimingLabel, { color: '#F59E0B' }]}>Giờ đón:</Text>
              <Text style={[styles.transportTimingValue, { color: '#FBBF24', fontWeight: '800' }]}>
                {formatDateTime(item.request_time)}
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

          {/* Chưa có ai nhận -> Nút Tiếp nhận cuốc xe */}
          {!item.assigned_staff && (item.status === 'pending' || item.status === 'in_progress') && (
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
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.brandSubtitle}>TA LUXURY HOTEL</Text>
          <Text style={styles.greetingTitle} numberOfLines={1}>Đội Xe & Vận Chuyển 🚗</Text>
        </View>
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerBookCarBtn}
            onPress={openCreateModal}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={15} color="#0A0F1D" />
            <Text style={styles.headerBookCarBtnText}>Đặt xe</Text>
          </TouchableOpacity>

          <NotificationBell />
          <TouchableOpacity style={styles.refreshCircleBtn} onPress={onRefresh} activeOpacity={0.7}>
            <Ionicons name="refresh" size={17} color="#F59E0B" />
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
          data={displayedRequests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
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

      {/* 6. MODAL ĐẶT XE ĐƯA ĐÓN KHÁCH HÀNG */}
      <Modal visible={createModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Đặt Xe Đưa Đón 🚗</Text>
                <Text style={styles.modalSubtitle}>Điều xe đưa đón sân bay, ga tàu hoặc tham quan cho khách</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setCreateModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {loadingModalData ? (
              <View style={styles.modalLoadingBox}>
                <ActivityIndicator size="large" color="#F59E0B" />
                <Text style={styles.modalLoadingText}>Đang tải danh sách phòng & dịch vụ xe...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                {/* BƯỚC 1: CHỌN PHÒNG & KHÁCH HÀNG */}
                <Text style={styles.formSectionLabel}>1. CHỌN PHÒNG KHÁCH ĐANG Ở (*)</Text>
                {occupiedRooms.length === 0 ? (
                  <View style={styles.warningBox}>
                    <Ionicons name="alert-circle" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                    <Text style={styles.warningText}>Hiện không có phòng nào đang có khách check-in.</Text>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.roomSelectScroll}
                    style={{ flexGrow: 0, marginBottom: 14 }}
                  >
                    {occupiedRooms.map((r) => {
                      const isSel = selectedRoom?.id === r.id;
                      const bk = r.current_booking;
                      return (
                        <TouchableOpacity
                          key={r.id}
                          style={[styles.roomSelectCard, isSel && styles.roomSelectCardActive]}
                          onPress={() => {
                            setSelectedRoom(r);
                            Haptics.selectionAsync();
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.roomSelectTop}>
                            <Text style={[styles.roomSelectNum, isSel && { color: '#0A0F1D' }]}>
                              P.{r.room_number}
                            </Text>
                            {bk?.booking_code && (
                              <Text style={[styles.roomSelectCode, isSel && { color: '#0A0F1D', backgroundColor: 'rgba(0,0,0,0.15)' }]}>
                                #{bk.booking_code}
                              </Text>
                            )}
                          </View>
                          <Text style={[styles.roomSelectGuest, isSel && { color: '#0A0F1D', fontWeight: '900' }]} numberOfLines={1}>
                            {bk?.guest_name || 'Khách lưu trú'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {/* BƯỚC 2: CHỌN DỊCH VỤ XE / GÓI ĐƯA ĐÓN */}
                <Text style={styles.formSectionLabel}>2. CHỌN LOẠI XE / DỊCH VỤ ĐƯA ĐÓN (*)</Text>
                <View style={styles.serviceSelectWrapper}>
                  {transportServices.map((svc) => {
                    const isSel = selectedService?.id === svc.id;
                    const priceFmt = svc.price ? `${parseInt(svc.price, 10).toLocaleString('vi-VN')} đ` : 'Liên hệ';
                    return (
                      <TouchableOpacity
                        key={svc.id}
                        style={[styles.serviceSelectCard, isSel && styles.serviceSelectCardActive]}
                        onPress={() => {
                          setSelectedService(svc);
                          Haptics.selectionAsync();
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.serviceCarThumbBox}>
                          <Image
                            source={{ uri: getVehicleImage(svc) }}
                            style={styles.serviceCarThumbImg}
                            resizeMode="cover"
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[styles.serviceSelectName, isSel && { color: '#F8FAFC' }]} numberOfLines={1}>
                            {svc.name}
                          </Text>
                          <Text style={styles.serviceSelectPrice}>{priceFmt}</Text>
                        </View>
                        {isSel && (
                          <Ionicons name="checkmark-circle" size={20} color="#F59E0B" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* BƯỚC 3: ĐIỂM ĐÓN & ĐIỂM ĐẾN */}
                <Text style={styles.formSectionLabel}>3. LỘ TRÌNH ĐÓN TRẢ (*)</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Điểm đón khách:</Text>
                  <TextInput
                    style={styles.textInput}
                    value={pickupLocation}
                    onChangeText={setPickupLocation}
                    placeholder="VD: Sân bay quốc tế Đà Nẵng, Ga tàu..."
                    placeholderTextColor="#64748B"
                  />
                  <View style={styles.quickTagsRow}>
                    {['✈️ Sân bay Đà Nẵng', '🏨 Sảnh khách sạn', '🚆 Ga Đà Nẵng'].map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        style={styles.quickTag}
                        onPress={() => {
                          setPickupLocation(tag.replace(/^[^\s]+\s/, ''));
                          Haptics.selectionAsync();
                        }}
                      >
                        <Text style={styles.quickTagText}>{tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={[styles.inputGroup, { marginTop: 10 }]}>
                  <Text style={styles.inputLabel}>Điểm đến / Trả khách:</Text>
                  <TextInput
                    style={styles.textInput}
                    value={dropoffLocation}
                    onChangeText={setDropoffLocation}
                    placeholder="VD: Sảnh khách sạn, Hội An, Bà Nà..."
                    placeholderTextColor="#64748B"
                  />
                  <View style={styles.quickTagsRow}>
                    {['🏨 Sảnh khách sạn', '✈️ Sân bay Đà Nẵng', '🏮 Phố cổ Hội An', '🏰 Bà Nà Hills'].map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        style={styles.quickTag}
                        onPress={() => {
                          setDropoffLocation(tag.replace(/^[^\s]+\s/, ''));
                          Haptics.selectionAsync();
                        }}
                      >
                        <Text style={styles.quickTagText}>{tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* BƯỚC 4: THỜI GIAN HẸN & CHUYẾN BAY */}
                <Text style={styles.formSectionLabel}>4. THỜI GIAN & CHUYẾN BAY</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Giờ hẹn đón:</Text>
                    <TextInput
                      style={styles.textInput}
                      value={pickupTime}
                      onChangeText={setPickupTime}
                      placeholder="VD: 14:30 hoặc 18:00"
                      placeholderTextColor="#64748B"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Mã chuyến bay (nếu có):</Text>
                    <TextInput
                      style={styles.textInput}
                      value={flightCode}
                      onChangeText={setFlightCode}
                      placeholder="VD: VN128, VJ512"
                      placeholderTextColor="#64748B"
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                {/* BƯỚC 5: GHI CHÚ BỔ SUNG */}
                <Text style={styles.formSectionLabel}>5. SỐ LƯỢNG KHÁCH & GHI CHÚ</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={[styles.inputLabel, { flex: 1, marginBottom: 0 }]}>Số lượng hành khách:</Text>
                  <View style={styles.stepperBox}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => {
                        setPassengerCount((p) => Math.max(1, p - 1));
                        Haptics.selectionAsync();
                      }}
                    >
                      <Ionicons name="remove" size={16} color="#F8FAFC" />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{passengerCount} người</Text>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => {
                        setPassengerCount((p) => Math.min(16, p + 1));
                        Haptics.selectionAsync();
                      }}
                    >
                      <Ionicons name="add" size={16} color="#F8FAFC" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Ghi chú thêm cho tài xế:</Text>
                  <TextInput
                    style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                    value={note}
                    onChangeText={setNote}
                    placeholder="VD: Cần ghế em bé, 3 kiện vali lớn, khách VIP..."
                    placeholderTextColor="#64748B"
                    multiline
                  />
                </View>

                {/* NÚT XÁC NHẬN ĐẶT XE */}
                <TouchableOpacity
                  style={[styles.submitBookBtn, submittingBooking && { opacity: 0.7 }]}
                  onPress={submitTransportBooking}
                  disabled={submittingBooking}
                  activeOpacity={0.8}
                >
                  {submittingBooking ? (
                    <ActivityIndicator size="small" color="#0A0F1D" style={{ marginRight: 8 }} />
                  ) : (
                    <Ionicons name="car-sport" size={18} color="#0A0F1D" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.submitBookBtnText}>
                    {submittingBooking ? 'Đang điều phối xe...' : 'Xác Nhận Đặt Xe Cho Khách 🚗'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoadingBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoadingText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 10,
  },
  formSectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 6,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 11,
    color: '#FBBF24',
    flex: 1,
  },
  roomSelectScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  roomSelectCard: {
    width: 140,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  roomSelectCardActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  roomSelectTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  roomSelectNum: {
    fontSize: 15,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  roomSelectCode: {
    fontSize: 9,
    fontWeight: '800',
    color: '#60A5FA',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roomSelectGuest: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
  },
  serviceSelectWrapper: {
    gap: 8,
    marginBottom: 14,
  },
  serviceSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  serviceSelectCardActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  serviceCarThumbBox: {
    width: 48,
    height: 40,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0A0F1D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  serviceCarThumbImg: {
    width: '100%',
    height: '100%',
  },
  serviceCarIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#0A0F1D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceSelectName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#E2E8F0',
  },
  serviceSelectPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#0A0F1D',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 12,
  },
  quickTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  quickTag: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickTagText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepperBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stepperValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
    paddingHorizontal: 8,
  },
  submitBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 10,
    marginBottom: 10,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  submitBookBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A0F1D',
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
