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
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../../components/NotificationBell';
import CustomerCrmModal from '../../components/CustomerCrmModal';

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

// Helper lọc bỏ các dịch vụ xe / vận chuyển (đã có tab riêng của đội lái xe)
const isTransportService = (item: any) => {
  if (!item) return false;
  if (item.category_type === 'transport') return true;
  const text = `${item.name || item.service_name || ''} ${item.category_name || ''} ${item.description || ''}`.toLowerCase();
  return (
    text.includes('xe') ||
    text.includes('sân bay') ||
    text.includes('đưa đón') ||
    text.includes('transfer') ||
    text.includes('limousine') ||
    text.includes('maybach') ||
    text.includes('shuttle') ||
    text.includes('taxi') ||
    text.includes('đón tiễn')
  );
};
// Helper lấy đường dẫn ảnh đầy đủ cho dịch vụ / món ăn (đồng bộ với Web)
const getServiceItemImage = (item: any): string => {
  const raw = item?.display_image || item?.image_url || item?.image;
  if (!raw || typeof raw !== 'string') {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80';
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  const base = apiClient.defaults.baseURL ? apiClient.defaults.baseURL.replace(/\/api\/?$/, '') : '';
  return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

export default function ServicesScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Chế độ xem: Đơn phục vụ ('orders') vs Thực đơn & Danh mục ('catalog')
  const [mainViewMode, setMainViewMode] = useState<'orders' | 'catalog'>('orders');
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<any[]>([]);
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<number | 'all'>('all');
  const [catalogSearchText, setCatalogSearchText] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Modal Khách Hàng CRM
  const [crmModalVisible, setCrmModalVisible] = useState(false);
  const [crmGuestId, setCrmGuestId] = useState<number | null>(null);

  // Modal Tạo đơn gọi món / dịch vụ mới (Order hộ khách)
  const [createOrderModalVisible, setCreateOrderModalVisible] = useState(false);
  const [occupiedRooms, setOccupiedRooms] = useState<any[]>([]);
  const [serviceCategories, setServiceCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [serviceItems, setServiceItems] = useState<any[]>([]);
  const [loadingModalData, setLoadingModalData] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [serviceSearchText, setServiceSearchText] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [orderNote, setOrderNote] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await apiClient.get('/services/requests/?no_page=true');
      const data = res.data;
      const list = data.results || data.requests || data.data || [];
      // Lọc bỏ vận chuyển (vì đã có tab riêng của đội xe)
      const nonTransport = (Array.isArray(list) ? list : []).filter(
        (it: any) => !isTransportService(it)
      );
      setOrders(nonTransport);
    } catch (err: any) {
      console.warn('Lỗi tải danh sách dịch vụ:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const [resItems, resCats] = await Promise.all([
        apiClient.get('/services/items/?all=true'),
        apiClient.get('/services/categories/'),
      ]);
      const items = resItems.data.results || resItems.data.items || resItems.data.data || resItems.data || [];
      const nonTransport = (Array.isArray(items) ? items : []).filter(
        (s: any) => !isTransportService(s) && s.is_active !== false
      );
      setCatalogItems(nonTransport);

      const cats = resCats.data.categories || resCats.data.results || resCats.data.data || resCats.data || [];
      setCatalogCategories(Array.isArray(cats) ? cats : []);
    } catch (err) {
      console.warn('Lỗi tải danh mục thực đơn:', err);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchOrders();
    fetchCatalog();
  }, [fetchOrders, fetchCatalog]);

  const onRefresh = () => {
    setRefreshing(true);
    setVisibleOrdersCount(15);
    setVisibleCatalogCount(16);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchOrders();
    fetchCatalog();
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

  // Infinite Scroll cho Đơn phục vụ
  const [visibleOrdersCount, setVisibleOrdersCount] = useState(15);
  const [loadingMoreOrders, setLoadingMoreOrders] = useState(false);

  // Infinite Scroll cho Danh mục Thực đơn
  const [visibleCatalogCount, setVisibleCatalogCount] = useState(16);
  const [loadingMoreCatalog, setLoadingMoreCatalog] = useState(false);

  useEffect(() => {
    setVisibleOrdersCount(15);
  }, [activeTab, searchQuery]);

  const displayedOrders = useMemo(() => {
    return filteredOrders.slice(0, visibleOrdersCount);
  }, [filteredOrders, visibleOrdersCount]);

  const handleLoadMoreOrders = () => {
    if (loadingMoreOrders || visibleOrdersCount >= filteredOrders.length) return;
    setLoadingMoreOrders(true);
    setTimeout(() => {
      setVisibleOrdersCount((prev) => Math.min(prev + 15, filteredOrders.length));
      setLoadingMoreOrders(false);
    }, 250);
  };

  const renderOrdersFooter = () => {
    if (filteredOrders.length <= 15) return <View style={{ height: 20 }} />;
    if (loadingMoreOrders) {
      return (
        <View style={styles.loadMoreFooter}>
          <ActivityIndicator size="small" color="#F59E0B" />
          <Text style={styles.loadMoreText}>Đang tải thêm đơn cũ hơn...</Text>
        </View>
      );
    }
    if (visibleOrdersCount >= filteredOrders.length) {
      return (
        <View style={styles.endOfListFooter}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.endOfListText}>Đã hiển thị toàn bộ {filteredOrders.length} đơn</Text>
        </View>
      );
    }
    return (
      <View style={styles.endOfListFooter}>
        <Text style={styles.loadMoreHintText}>
          Đang xem {visibleOrdersCount}/{filteredOrders.length} đơn • Cuộn xuống để xem thêm
        </Text>
      </View>
    );
  };

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
        assigned_staff: item.assigned_staff || user?.id,
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

  const handleCancelOrder = (item: ServiceOrder) => {
    Alert.alert(
      'Hủy đơn dịch vụ',
      `Bạn có chắc chắn muốn hủy đơn "${item.service_name}" của Phòng ${item.room_number}?`,
      [
        { text: 'Quay lại', style: 'cancel' },
        {
          text: 'Xác nhận hủy',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const res = await apiClient.patch(`/services/requests/${item.id}/`, {
                status: 'cancelled',
              });
              if (res.data.success || res.data.id) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                Alert.alert('Đã hủy', `Yêu cầu dịch vụ cho Phòng ${item.room_number} đã được hủy.`);
                fetchOrders();
              }
            } catch (err: any) {
              const msg = err.response?.data?.message || 'Không thể hủy đơn này.';
              Alert.alert('Lỗi', msg);
            }
          },
        },
      ]
    );
  };

  const openCreateOrderModal = async (defaultServiceId?: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCreateOrderModalVisible(true);
    setQuantity(1);
    setOrderNote('');
    setServiceSearchText('');
    setSelectedCategoryId('all');
    setLoadingModalData(true);

    try {
      const [resRooms, resServices, resCategories] = await Promise.all([
        apiClient.get('/rooms/admin/rooms/'),
        apiClient.get('/services/items/?all=true'),
        apiClient.get('/services/categories/'),
      ]);

      const rList = resRooms.data.results || resRooms.data.rooms || resRooms.data.data || resRooms.data || [];
      const occ = (Array.isArray(rList) ? rList : []).filter(
        (r: any) => r.status === 'occupied' && r.current_booking
      );
      setOccupiedRooms(occ);
      if (occ.length > 0 && !selectedRoom) {
        setSelectedRoom(occ[0]);
      }

      const sList = resServices.data.results || resServices.data.items || resServices.data.data || resServices.data || [];
      const nonTransport = (Array.isArray(sList) ? sList : []).filter(
        (s: any) => !isTransportService(s) && s.is_active !== false
      );
      setServiceItems(nonTransport);
      if (defaultServiceId) {
        setSelectedServiceId(defaultServiceId);
      } else if (nonTransport.length > 0) {
        setSelectedServiceId(nonTransport[0].id);
      }

      const cList = resCategories.data.categories || resCategories.data.results || resCategories.data.data || resCategories.data || [];
      setServiceCategories(Array.isArray(cList) ? cList : []);
    } catch (e) {
      console.warn('Lỗi tải dữ liệu tạo đơn:', e);
    } finally {
      setLoadingModalData(false);
    }
  };

  const filteredCatalogItems = useMemo(() => {
    return catalogItems.filter((s) => {
      if (catalogCategoryFilter !== 'all') {
        const catId = s.category_id || (typeof s.category === 'object' ? s.category?.id : s.category);
        if (catId !== catalogCategoryFilter) return false;
      }
      if (catalogSearchText.trim()) {
        const q = catalogSearchText.trim().toLowerCase();
        const matchName = s.name && s.name.toLowerCase().includes(q);
        const matchCat = s.category_name && s.category_name.toLowerCase().includes(q);
        const matchDesc = s.description && s.description.toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchDesc) return false;
      }
      return true;
    });
  }, [catalogItems, catalogCategoryFilter, catalogSearchText]);

  useEffect(() => {
    setVisibleCatalogCount(16);
  }, [catalogCategoryFilter, catalogSearchText]);

  const displayedCatalogItems = useMemo(() => {
    return filteredCatalogItems.slice(0, visibleCatalogCount);
  }, [filteredCatalogItems, visibleCatalogCount]);

  const handleLoadMoreCatalog = () => {
    if (loadingMoreCatalog || visibleCatalogCount >= filteredCatalogItems.length) return;
    setLoadingMoreCatalog(true);
    setTimeout(() => {
      setVisibleCatalogCount((prev) => Math.min(prev + 16, filteredCatalogItems.length));
      setLoadingMoreCatalog(false);
    }, 250);
  };

  const renderCatalogFooter = () => {
    if (filteredCatalogItems.length <= 16) return <View style={{ height: 25 }} />;
    if (loadingMoreCatalog) {
      return (
        <View style={styles.loadMoreFooter}>
          <ActivityIndicator size="small" color="#F59E0B" />
          <Text style={styles.loadMoreText}>Đang tải thêm món & dịch vụ...</Text>
        </View>
      );
    }
    if (visibleCatalogCount >= filteredCatalogItems.length) {
      return (
        <View style={styles.endOfListFooter}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.endOfListText}>Đã hiển thị toàn bộ {filteredCatalogItems.length} món & dịch vụ</Text>
        </View>
      );
    }
    return (
      <View style={styles.endOfListFooter}>
        <Text style={styles.loadMoreHintText}>
          Đang xem {visibleCatalogCount}/{filteredCatalogItems.length} món • Cuộn xuống để xem thêm
        </Text>
      </View>
    );
  };

  const filteredServiceItems = useMemo(() => {
    return serviceItems.filter((s) => {
      // 1. Lọc theo danh mục đã chọn
      if (selectedCategoryId !== 'all') {
        const catId = s.category_id || (typeof s.category === 'object' ? s.category?.id : s.category);
        if (catId !== selectedCategoryId) return false;
      }
      // 2. Lọc theo từ khóa tìm kiếm (tên, danh mục, mô tả)
      if (serviceSearchText.trim()) {
        const q = serviceSearchText.trim().toLowerCase();
        const matchName = s.name && s.name.toLowerCase().includes(q);
        const matchCat = s.category_name && s.category_name.toLowerCase().includes(q);
        const matchDesc = s.description && s.description.toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchDesc) return false;
      }
      return true;
    });
  }, [serviceItems, selectedCategoryId, serviceSearchText]);

  const selectedServiceItem = useMemo(() => {
    return serviceItems.find((s) => s.id === selectedServiceId) || null;
  }, [serviceItems, selectedServiceId]);

  const handleCreateOrder = async () => {
    if (!selectedRoom || !selectedRoom.current_booking) {
      Alert.alert('Chưa chọn phòng', 'Vui lòng chọn phòng đang có khách lưu trú.');
      return;
    }
    if (!selectedServiceId) {
      Alert.alert('Chưa chọn món', 'Vui lòng chọn món ăn hoặc dịch vụ cần gọi.');
      return;
    }

    setSubmittingOrder(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await apiClient.post('/services/requests/', {
        booking: selectedRoom.current_booking.id,
        service: selectedServiceId,
        quantity: quantity,
        note: orderNote.trim(),
      });

      if (res.data.success || res.data.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const sName = selectedServiceItem?.name || 'Dịch vụ';
        Alert.alert(
          'Tạo đơn thành công',
          `Đã tiếp nhận yêu cầu "${sName}" (SL: ${quantity}) cho Phòng ${selectedRoom.room_number}!`
        );
        setCreateOrderModalVisible(false);
        fetchOrders();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể tạo đơn dịch vụ.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmittingOrder(false);
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
      case 'cancelled':
        return {
          bg: 'rgba(239, 68, 68, 0.12)',
          border: 'rgba(239, 68, 68, 0.4)',
          text: '#F87171',
          label: 'Đã hủy',
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
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center' }}
                onPress={() => {
                  setCrmGuestId(null);
                  setCrmModalVisible(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.guestInfoText, { color: '#38BDF8', fontWeight: '800' }]}>
                  Khách: {item.guest_name}
                </Text>
                <Ionicons name="person-circle-outline" size={13} color="#38BDF8" style={{ marginLeft: 3 }} />
              </TouchableOpacity>
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
          {item.status === 'pending' && (
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

          {item.status === 'cancelled' && (
            <View style={[styles.doneBadge, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
              <Ionicons name="close-circle" size={15} color="#F87171" style={{ marginRight: 5 }} />
              <Text style={[styles.doneBadgeText, { color: '#F87171' }]}>Đơn đã hủy</Text>
            </View>
          )}

          {(item.status === 'pending' || item.status === 'in_progress') && (
            <TouchableOpacity
              style={styles.btnCancelOrder}
              onPress={() => handleCancelOrder(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle-outline" size={15} color="#EF4444" style={{ marginRight: 4 }} />
              <Text style={styles.btnCancelOrderText}>Hủy</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderCatalogItem = ({ item }: { item: any }) => {
    const priceFormatted = item.price ? `${parseInt(item.price, 10).toLocaleString('vi-VN')} đ` : 'Miễn phí';
    const imageUri = getServiceItemImage(item);
    return (
      <View style={styles.catalogCard}>
        <Image
          source={{ uri: imageUri }}
          style={styles.catalogItemImg}
          resizeMode="cover"
        />
        <View style={styles.catalogItemContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.catalogItemName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.catalogCategoryTag}>
              <Text style={styles.catalogCategoryTagText}>{item.category_name || 'Dịch vụ'}</Text>
            </View>
          </View>

          {item.description ? (
            <Text style={styles.catalogItemDesc} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}

          <View style={styles.catalogItemBottomRow}>
            <Text style={styles.catalogItemPrice}>{priceFormatted}</Text>
            <TouchableOpacity
              style={styles.catalogOrderBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                openCreateOrderModal(item.id);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="cart" size={13} color="#0A0F1D" style={{ marginRight: 4 }} />
              <Text style={styles.catalogOrderBtnText}>Gọi món</Text>
            </TouchableOpacity>
          </View>
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
          <TouchableOpacity
            style={styles.headerCrmBtn}
            onPress={() => {
              setCrmGuestId(null);
              setCrmModalVisible(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="people" size={17} color="#38BDF8" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.createOrderBtn}
            onPress={() => openCreateOrderModal()}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={16} color="#0A0F1D" style={{ marginRight: 4 }} />
            <Text style={styles.createOrderBtnText}>Gọi món</Text>
          </TouchableOpacity>
          <NotificationBell />
          <TouchableOpacity style={styles.refreshCircleBtn} onPress={onRefresh} activeOpacity={0.7}>
            <Ionicons name="refresh" size={18} color="#F59E0B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 1b. Dải Chuyển Chế Độ: Đơn Phục Vụ vs Thực Đơn & Danh Mục */}
      <View style={styles.topModeBar}>
        <TouchableOpacity
          style={[styles.topModeTab, mainViewMode === 'orders' && styles.topModeTabActive]}
          onPress={() => {
            setMainViewMode('orders');
            Haptics.selectionAsync();
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="receipt"
            size={14}
            color={mainViewMode === 'orders' ? '#0A0F1D' : '#94A3B8'}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.topModeTabText, mainViewMode === 'orders' && styles.topModeTabTextActive]}>
            Đơn Phục Vụ ({orders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topModeTab, mainViewMode === 'catalog' && styles.topModeTabActive]}
          onPress={() => {
            setMainViewMode('catalog');
            Haptics.selectionAsync();
            if (catalogItems.length === 0) fetchCatalog();
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="restaurant"
            size={14}
            color={mainViewMode === 'catalog' ? '#0A0F1D' : '#94A3B8'}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.topModeTabText, mainViewMode === 'catalog' && styles.topModeTabTextActive]}>
            Thực Đơn & Dịch Vụ ({catalogItems.length || 'Menu'})
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODE 1: ORDERS LIST VIEW */}
      {mainViewMode === 'orders' ? (
        <>
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

          {/* 4. Danh Sách Đơn Món */}
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
              data={displayedOrders}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              onEndReached={handleLoadMoreOrders}
              onEndReachedThreshold={0.2}
              ListFooterComponent={renderOrdersFooter}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
              }
            />
          )}
        </>
      ) : (
        /* MODE 2: FULL SERVICE CATALOG & MENU VIEW */
        <View style={{ flex: 1 }}>
          {/* Category Filter Pills */}
          <View style={{ paddingHorizontal: 12, marginBottom: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catalogCatScroll}>
              <TouchableOpacity
                style={[styles.catalogCatChip, catalogCategoryFilter === 'all' && styles.catalogCatChipActive]}
                onPress={() => {
                  setCatalogCategoryFilter('all');
                  Haptics.selectionAsync();
                }}
              >
                <Text style={[styles.catalogCatChipText, catalogCategoryFilter === 'all' && styles.catalogCatChipTextActive]}>
                  Tất cả ({catalogItems.length})
                </Text>
              </TouchableOpacity>

              {catalogCategories
                .filter((c: any) => c.type !== 'transport' && !c.name.toLowerCase().includes('xe'))
                .map((cat: any) => {
                  const isSelected = catalogCategoryFilter === cat.id;
                  const count = catalogItems.filter(
                    (s: any) => (s.category_id || (typeof s.category === 'object' ? s.category?.id : s.category)) === cat.id
                  ).length;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catalogCatChip, isSelected && styles.catalogCatChipActive]}
                      onPress={() => {
                        setCatalogCategoryFilter(cat.id);
                        Haptics.selectionAsync();
                      }}
                    >
                      <Text style={[styles.catalogCatChipText, isSelected && styles.catalogCatChipTextActive]}>
                        {cat.name} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>

          {/* Search Box */}
          <View style={styles.searchWrapper}>
            <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm tên món ăn, đồ uống, spa, dịch vụ..."
              placeholderTextColor="#64748B"
              value={catalogSearchText}
              onChangeText={setCatalogSearchText}
              clearButtonMode="while-editing"
            />
            {catalogSearchText ? (
              <TouchableOpacity onPress={() => setCatalogSearchText('')} style={{ padding: 8 }}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Catalog List */}
          {loadingCatalog ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#F59E0B" />
              <Text style={styles.loadingMessage}>Đang tải thực đơn & bảng giá...</Text>
            </View>
          ) : filteredCatalogItems.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="book-outline" size={56} color="#334155" />
              <Text style={styles.emptyTitle}>Không tìm thấy món hoặc dịch vụ nào</Text>
              <Text style={styles.emptySubtitle}>Hãy thử chọn danh mục khác hoặc xóa từ khóa tìm kiếm.</Text>
            </View>
          ) : (
            <FlatList
              data={displayedCatalogItems}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderCatalogItem}
              contentContainerStyle={[styles.listContainer, { paddingBottom: 25 }]}
              showsVerticalScrollIndicator={false}
              onEndReached={handleLoadMoreCatalog}
              onEndReachedThreshold={0.2}
              ListFooterComponent={renderCatalogFooter}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
              }
            />
          )}
        </View>
      )}

      {/* Modal Tạo Yêu Cầu Dịch Vụ / Gọi Món Hộ Khách */}
      <Modal visible={createOrderModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Gọi Món & Đặt Dịch Vụ Mới 🛎️</Text>
                <Text style={styles.modalSubtitle}>Tạo đơn ẩm thực, spa, tiện ích cho khách đang ở</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setCreateOrderModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {loadingModalData ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator color="#F59E0B" size="large" />
                <Text style={{ color: '#94A3B8', marginTop: 12, fontSize: 13 }}>
                  Đang tải danh sách phòng & menu dịch vụ...
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 35 }}>
                {/* 1. Chọn phòng đang có khách */}
                <Text style={styles.inputLabel}>1. Chọn phòng đang có khách *:</Text>
                {occupiedRooms.length === 0 ? (
                  <View style={styles.noRoomsWarning}>
                    <Ionicons name="alert-circle-outline" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                    <Text style={styles.noRoomsText}>
                      Hiện không có phòng nào có khách đã nhận phòng (Check-in).
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.roomChipsScroll}
                  >
                    {occupiedRooms.map((r) => {
                      const isSelected = selectedRoom?.id === r.id;
                      return (
                        <TouchableOpacity
                          key={r.id}
                          style={[
                            styles.roomSelectChip,
                            isSelected && styles.roomSelectChipActive,
                          ]}
                          onPress={() => {
                            setSelectedRoom(r);
                            Haptics.selectionAsync();
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.roomSelectChipText,
                              isSelected && styles.roomSelectChipTextActive,
                            ]}
                          >
                            P.{r.room_number}
                          </Text>
                          <Text
                            style={[
                              styles.roomGuestSubText,
                              isSelected && { color: '#0A0F1D', fontWeight: '700' },
                            ]}
                            numberOfLines={1}
                          >
                            {r.current_booking?.guest_name || 'Khách'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {/* 2. Chọn món ăn / dịch vụ tiện ích */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 4 }}>
                  <Text style={[styles.inputLabel, { marginTop: 0, marginBottom: 0 }]}>
                    2. Chọn Món ăn & Dịch vụ ({filteredServiceItems.length}) *:
                  </Text>
                </View>

                {/* Dải Phân Loại Danh Mục (Ẩm thực, Đồ uống, Spa, Tiện ích & Giặt ủi) */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryPillsScroll}
                >
                  <TouchableOpacity
                    style={[
                      styles.categoryFilterChip,
                      selectedCategoryId === 'all' && styles.categoryFilterChipActive,
                    ]}
                    onPress={() => {
                      setSelectedCategoryId('all');
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.categoryFilterChipText,
                        selectedCategoryId === 'all' && styles.categoryFilterChipTextActive,
                      ]}
                    >
                      Tất cả ({serviceItems.length})
                    </Text>
                  </TouchableOpacity>

                  {serviceCategories
                    .filter((c) => !isTransportService(c))
                    .map((c) => {
                      const isSelected = selectedCategoryId === c.id;
                      const countInCat = serviceItems.filter(
                        (s) => s.category_id === c.id || s.category === c.id
                      ).length;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[
                            styles.categoryFilterChip,
                            isSelected && styles.categoryFilterChipActive,
                          ]}
                          onPress={() => {
                            setSelectedCategoryId(c.id);
                            Haptics.selectionAsync();
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.categoryFilterChipText,
                              isSelected && styles.categoryFilterChipTextActive,
                            ]}
                          >
                            {c.icon || '🏷️'} {c.name} ({countInCat})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>

                {/* Ô tìm kiếm nhanh món/dịch vụ */}
                <View style={styles.modalSearchBox}>
                  <Ionicons name="search-outline" size={16} color="#64748B" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Tìm nhanh: Wagyu, Trà chiều, Massage, Giặt hấp, Gối..."
                    placeholderTextColor="#64748B"
                    value={serviceSearchText}
                    onChangeText={setServiceSearchText}
                  />
                  {serviceSearchText ? (
                    <TouchableOpacity onPress={() => setServiceSearchText('')}>
                      <Ionicons name="close-circle" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Danh sách thẻ dịch vụ - Không dùng maxHeight để tránh đè giao diện */}
                <View style={styles.serviceItemsGrid}>
                  {filteredServiceItems.length === 0 ? (
                    <View style={styles.emptyServiceNotice}>
                      <Ionicons name="search-outline" size={24} color="#64748B" style={{ marginBottom: 6 }} />
                      <Text style={styles.emptyServiceNoticeText}>
                        Không tìm thấy dịch vụ hoặc món ăn phù hợp.
                      </Text>
                    </View>
                  ) : (
                    filteredServiceItems.map((s) => {
                      const isSelected = selectedServiceId === s.id;
                      const priceNum = s.price ? parseInt(s.price, 10) : 0;
                      return (
                        <TouchableOpacity
                          key={s.id}
                          style={[
                            styles.serviceSelectCard,
                            isSelected && styles.serviceSelectCardActive,
                          ]}
                          onPress={() => {
                            setSelectedServiceId(s.id);
                            Haptics.selectionAsync();
                          }}
                          activeOpacity={0.7}
                        >
                          <Image
                            source={{ uri: getServiceItemImage(s) }}
                            style={styles.modalItemThumbnail}
                            resizeMode="cover"
                          />
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <View style={styles.serviceCatTag}>
                              <Text style={styles.serviceCatTagText}>
                                {s.category_icon || '🏷️'} {s.category_name || 'Dịch vụ'}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.serviceCardTitle,
                                isSelected && styles.serviceCardTitleActive,
                              ]}
                              numberOfLines={2}
                            >
                              {s.name}
                            </Text>
                            {s.description ? (
                              <Text style={styles.serviceCardDesc} numberOfLines={1}>
                                {s.description}
                              </Text>
                            ) : null}
                            <Text style={styles.serviceCardPrice}>
                              {priceNum > 0 ? `${priceNum.toLocaleString('vi-VN')} đ` : 'Miễn phí'}
                            </Text>
                          </View>
                          <View style={[styles.selectRadioCircle, isSelected && styles.selectRadioCircleActive]}>
                            {isSelected && <Ionicons name="checkmark" size={13} color="#0A0F1D" />}
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>

                {/* Banner xem trước dịch vụ đang chọn & Tổng tiền */}
                {selectedServiceItem && (
                  <View style={styles.selectedItemBanner}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectedBannerLabel}>ĐANG CHỌN PHỤC VỤ:</Text>
                      <Text style={styles.selectedBannerName} numberOfLines={1}>
                        {selectedServiceItem.name}
                      </Text>
                      <Text style={styles.selectedBannerMath}>
                        {selectedServiceItem.price && parseInt(selectedServiceItem.price, 10) > 0
                          ? `${parseInt(selectedServiceItem.price, 10).toLocaleString('vi-VN')} đ  ×  ${quantity} suất  =  ${(parseInt(selectedServiceItem.price, 10) * quantity).toLocaleString('vi-VN')} đ`
                          : 'Dịch vụ miễn phí setup phòng lưu trú'}
                      </Text>
                    </View>
                  </View>
                )}

                {/* 3. Số lượng */}
                <Text style={[styles.inputLabel, { marginTop: 14 }]}>3. Số lượng suất / dịch vụ:</Text>
                <View style={styles.quantityCounterRow}>
                  <TouchableOpacity
                    style={styles.quantityStepBtn}
                    onPress={() => {
                      setQuantity((q) => Math.max(1, q - 1));
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="remove" size={18} color="#F8FAFC" />
                  </TouchableOpacity>

                  <View style={styles.quantityNumberBox}>
                    <Text style={styles.quantityNumberText}>{quantity}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.quantityStepBtn}
                    onPress={() => {
                      setQuantity((q) => q + 1);
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={18} color="#F8FAFC" />
                  </TouchableOpacity>
                </View>

                {/* 4. Ghi chú yêu cầu của khách */}
                <Text style={[styles.inputLabel, { marginTop: 14 }]}>4. Yêu cầu phục vụ / Ghi chú đặc biệt:</Text>
                <TextInput
                  style={[styles.modalInput, { height: 60, paddingTop: 8 }]}
                  placeholder="VD: Không hành, ít đá, mang lên phòng lúc 20:30, gối thêm..."
                  placeholderTextColor="#64748B"
                  multiline
                  value={orderNote}
                  onChangeText={setOrderNote}
                />

                <TouchableOpacity
                  style={[
                    styles.modalConfirmBtn,
                    (!selectedRoom || !selectedServiceId || submittingOrder) && { opacity: 0.6 },
                  ]}
                  onPress={handleCreateOrder}
                  disabled={!selectedRoom || !selectedServiceId || submittingOrder}
                  activeOpacity={0.8}
                >
                  {submittingOrder ? (
                    <ActivityIndicator color="#0A0F1D" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="paper-plane" size={17} color="#0A0F1D" style={{ marginRight: 6 }} />
                      <Text style={styles.modalConfirmBtnText}>
                        {selectedServiceItem && parseInt(selectedServiceItem.price, 10) > 0
                          ? `ĐẶT DỊCH VỤ • ${(parseInt(selectedServiceItem.price, 10) * quantity).toLocaleString('vi-VN')} đ`
                          : 'TẠO YÊU CẦU PHỤC VỤ'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Hồ Sơ Khách Hàng (CRM & Lịch Sử) */}
      <CustomerCrmModal
        visible={crmModalVisible}
        onClose={() => setCrmModalVisible(false)}
        initialGuestId={crmGuestId}
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
  createOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 14,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  createOrderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A0F1D',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    marginTop: 10,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#0A0F1D',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    color: '#F8FAFC',
    fontSize: 13,
  },
  noRoomsWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginVertical: 4,
  },
  noRoomsText: {
    fontSize: 11,
    color: '#FBBF24',
    flex: 1,
  },
  roomChipsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  roomSelectChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    minWidth: 70,
  },
  roomSelectChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  roomSelectChipText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#E2E8F0',
  },
  roomSelectChipTextActive: {
    color: '#0A0F1D',
  },
  roomGuestSubText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  categoryPillsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  categoryFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryFilterChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  categoryFilterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  categoryFilterChipTextActive: {
    color: '#0A0F1D',
    fontWeight: '900',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0F1D',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 10,
  },
  modalSearchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 12.5,
  },
  serviceItemsGrid: {
    gap: 8,
    marginBottom: 10,
  },
  serviceSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  serviceSelectCardActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  serviceCatTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  serviceCatTagText: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '700',
  },
  serviceCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  serviceCardTitleActive: {
    color: '#F59E0B',
    fontWeight: '800',
  },
  serviceCardDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  serviceCardPrice: {
    fontSize: 12,
    color: '#34D399',
    fontWeight: '800',
    marginTop: 4,
  },
  selectRadioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  selectRadioCircleActive: {
    borderColor: '#F59E0B',
    backgroundColor: '#F59E0B',
  },
  selectedItemBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    marginBottom: 10,
  },
  selectedBannerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  selectedBannerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2,
  },
  selectedBannerMath: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34D399',
    marginTop: 3,
  },
  emptyServiceNotice: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyServiceNoticeText: {
    fontSize: 12.5,
    color: '#94A3B8',
  },
  quantityCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    alignSelf: 'flex-start',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 4,
  },
  quantityStepBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityNumberBox: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityNumberText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  modalConfirmBtn: {
    backgroundColor: '#F59E0B',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 20,
  },
  modalConfirmBtnText: {
    color: '#0A0F1D',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  btnCancelOrder: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelOrderText: {
    color: '#F87171',
    fontSize: 11.5,
    fontWeight: '700',
  },
  headerCrmBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topModeBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  topModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#1F2937',
  },
  topModeTabActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  topModeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  topModeTabTextActive: {
    color: '#0A0F1D',
    fontWeight: '900',
  },
  catalogCatScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  catalogCatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  catalogCatChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  catalogCatChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#94A3B8',
    includeFontPadding: false,
  },
  catalogCatChipTextActive: {
    color: '#0A0F1D',
    fontWeight: '900',
  },
  catalogCard: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#1F2937',
  },
  catalogItemImg: {
    width: 76,
    height: 76,
    borderRadius: 14,
    backgroundColor: '#1E293B',
  },
  modalItemThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    marginRight: 10,
  },
  catalogItemIconBox: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  catalogItemContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  catalogItemName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
    flex: 1,
  },
  catalogCategoryTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  catalogCategoryTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
  },
  catalogItemDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
    lineHeight: 15,
  },
  catalogItemBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  catalogItemPrice: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#34D399',
  },
  catalogOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  catalogOrderBtnText: {
    fontSize: 11,
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
