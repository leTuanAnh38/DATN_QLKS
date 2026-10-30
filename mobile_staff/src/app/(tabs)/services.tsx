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
import { useFocusPolling } from '../../hooks/use-focus-polling';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../../components/NotificationBell';
import CustomerCrmModal from '../../components/CustomerCrmModal';
import { DEFAULT_API_URL } from '../../api/config';
import { ServiceListSkeleton } from '../../components/SkeletonLoader';

interface ServiceOrder {
  id: number;
  booking_code: string;
  room_number: string;
  guest_name: string;
  service_name: string;
  service_image?: string;
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
  booking_status?: string;
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

// Helper kiểm tra tác vụ dọn dẹp phòng lưu trú (Make-up room) thuộc nghiệp vụ riêng của Buồng phòng (đã có tab Buồng phòng riêng)
const isHousekeepingService = (item: any) => {
  if (!item) return false;
  const text = `${item.name || item.service_name || ''} ${item.category_name || ''} ${item.description || ''}`.toLowerCase();
  return text.includes('make-up') || text.includes('dọn dẹp phòng lưu trú') || text.includes('dọn phòng');
};

// Helper lấy đường dẫn ảnh đầy đủ cho dịch vụ / món ăn (đồng bộ với Web)
const getServiceItemImage = (item: any): string => {
  const raw =
    item?.service_image ||
    item?.service?.image ||
    item?.service?.image_url ||
    item?.display_image ||
    item?.image_url ||
    item?.image;
  if (!raw || typeof raw !== 'string') {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80';
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  const base = (apiClient.defaults.baseURL || DEFAULT_API_URL || '').replace(/\/api\/?$/, '');
  return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

// Helper định dạng ngày giờ đặt đơn & giờ hẹn giao
const formatOrderTime = (dateStr?: string | null): string => {
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

// Helper phân loại nhóm dịch vụ chuẩn nghiệp vụ khách sạn 5 sao
export const getServiceCategoryType = (item: any): 'fnb' | 'spa' | 'laundry' | 'amenities' => {
  if (!item) return 'amenities';
  const catType = (item.category_type || '').toLowerCase();
  if (catType === 'spa') return 'spa';
  if (catType === 'laundry') return 'laundry';
  if (catType === 'fnb') return 'fnb';
  // Backend (get_service_category_type) đã phân loại là tiện ích/buồng phòng thì tin kết quả đó,
  // không đoán lại bằng từ khóa (vd danh mục "Tiện ích & Giặt ủi" chứa chữ "giặt" nhưng dịch vụ là tiện ích).
  if (catType === 'amenities' || catType === 'room_amenity') return 'amenities';

  const text = `${item.name || item.service_name || ''} ${item.category_name || ''} ${item.description || ''}`.toLowerCase();
  if (
    text.includes('spa') ||
    text.includes('massage') ||
    text.includes('trị liệu') ||
    text.includes('xông hơi') ||
    text.includes('sauna') ||
    text.includes('wellness')
  ) {
    return 'spa';
  }
  if (
    text.includes('giặt') ||
    text.includes('ủi') ||
    text.includes('laundry') ||
    text.includes('giặt sấy') ||
    text.includes('giặt hấp')
  ) {
    return 'laundry';
  }
  if (
    text.includes('ẩm thực') ||
    text.includes('đồ ăn') ||
    text.includes('món') ||
    text.includes('bếp') ||
    text.includes('dining') ||
    text.includes('f&b') ||
    text.includes('nhà hàng') ||
    text.includes('nước') ||
    text.includes('rượu') ||
    text.includes('bia') ||
    text.includes('cà phê') ||
    text.includes('trà') ||
    text.includes('bánh') ||
    text.includes('ăn uống')
  ) {
    return 'fnb';
  }
  return 'amenities';
};

// Helper cấu hình nội dung và nút bấm hành động chuẩn từng loại dịch vụ
export const getServiceActionConfig = (item: ServiceOrder) => {
  const cat = getServiceCategoryType(item);
  switch (cat) {
    case 'spa':
      return {
        catLabel: 'Spa & Trị liệu',
        catIcon: 'leaf',
        catColor: '#A855F7',
        pendingBadge: 'Chờ nhận lịch Spa',
        inProgressBadge: 'Đang chuẩn bị phòng Spa',
        deliveringBadge: 'KTV đang phục vụ',
        completedBadge: 'Đã hoàn tất liệu trình',
        claimText: 'TIẾP NHẬN ĐẶT LỊCH SPA',
        claimIcon: 'leaf',
        nextStepLabel: 'KTV ĐÃ SẴN SÀNG ĐÓN KHÁCH',
        nextStepIcon: 'sparkles',
        completeStepLabel: 'XÁC NHẬN HOÀN TẤT LIỆU TRÌNH ✨',
        deliveringLabel: 'KTV đang phục vụ',
        completeSuccessMsg: 'Liệu trình Spa đã hoàn tất!',
      };
    case 'laundry':
      return {
        catLabel: 'Giặt ủi cao cấp',
        catIcon: 'shirt',
        catColor: '#06B6D4',
        pendingBadge: 'Chờ thu gom đồ',
        inProgressBadge: 'Đang giặt sấy / ủi',
        deliveringBadge: 'Đang mang đồ lên phòng',
        completedBadge: 'Đã giao đồ sạch',
        claimText: 'TIẾP NHẬN GIẶT ỦI',
        claimIcon: 'shirt',
        nextStepLabel: 'BẮT ĐẦU MANG ĐỒ LÊN PHÒNG',
        nextStepIcon: 'arrow-up-circle',
        completeStepLabel: 'XÁC NHẬN ĐÃ BÀN GIAO ĐỒ CHO KHÁCH ✨',
        deliveringLabel: 'Đang mang đồ lên phòng',
        completeSuccessMsg: 'Đồ giặt ủi đã bàn giao thành công!',
      };
    case 'amenities':
      return {
        catLabel: 'Tiện ích phòng',
        catIcon: 'gift',
        catColor: '#EC4899',
        pendingBadge: 'Chờ chuẩn bị tiện ích',
        inProgressBadge: 'Buồng phòng đang chuẩn bị',
        deliveringBadge: 'Đang chuyển tới phòng',
        completedBadge: 'Đã bàn giao tiện ích',
        claimText: 'TIẾP NHẬN TIỆN ÍCH',
        claimIcon: 'gift',
        nextStepLabel: 'BẮT ĐẦU CHUYỂN TỚI PHÒNG',
        nextStepIcon: 'walk',
        completeStepLabel: 'XÁC NHẬN ĐÃ BÀN GIAO ✨',
        deliveringLabel: 'Đang chuyển tới phòng',
        completeSuccessMsg: 'Tiện ích phòng đã được bàn giao!',
      };
    case 'fnb':
    default:
      return {
        catLabel: 'Ẩm thực & Đồ uống',
        catIcon: 'restaurant',
        catColor: '#F59E0B',
        pendingBadge: 'Chờ chế biến',
        inProgressBadge: 'Bếp đang chế biến',
        deliveringBadge: 'Đang mang lên phòng',
        completedBadge: 'Đã phục vụ xong',
        claimText: 'TIẾP NHẬN CHẾ BIẾN',
        claimIcon: 'restaurant',
        nextStepLabel: 'BẮT ĐẦU MANG LÊN PHÒNG',
        nextStepIcon: 'bicycle',
        completeStepLabel: 'XÁC NHẬN ĐÃ PHỤC VỤ MÓN ✨',
        deliveringLabel: 'Đang mang lên phòng',
        completeSuccessMsg: 'Món ăn đã được phục vụ tại phòng!',
      };
  }
};

// Khóa thực hiện dịch vụ theo ngữ cảnh — khớp backend (ServiceRequestViewSet, 'ROOM_ASSIGNMENT_REQUIRED' /
// 'CHECKIN_REQUIRED') và Kanban Web (getServiceLockReason):
// - null: được phép làm
// - 'NO_ROOM': đơn chưa được gán phòng cụ thể
// - 'WAIT_CHECKIN': đã gán phòng nhưng khách chưa check-in và dịch vụ là Ẩm thực / Spa / Giặt ủi
//   (tiện ích buồng phòng như gối, khăn, setup phòng vẫn được làm trước khi khách tới)
export type ServiceLockReason = 'NO_ROOM' | 'WAIT_CHECKIN' | null;

export const getServiceLockReason = (item: ServiceOrder): ServiceLockReason => {
  if (!item || isTransportService(item)) return null;
  const room = (item.room_number || '').trim();
  const hasRoom = room !== '' && room !== 'Chưa gán phòng' && room !== 'Chờ xếp';
  if (!hasRoom) return 'NO_ROOM';
  if (item.booking_status === 'checked_in') return null;
  const cat = getServiceCategoryType(item);
  return cat === 'fnb' || cat === 'spa' || cat === 'laundry' ? 'WAIT_CHECKIN' : null;
};

const getServiceLockMessage = (item: ServiceOrder, reason: Exclude<ServiceLockReason, null>) =>
  reason === 'NO_ROOM'
    ? `Đơn #${item.booking_code} chưa được gán phòng cụ thể. Vui lòng liên hệ Lễ tân gán phòng trước khi thực hiện dịch vụ!`
    : `Khách đơn #${item.booking_code} chưa làm thủ tục nhận phòng (Check-in). Dịch vụ ẩm thực / spa / giặt ủi yêu cầu khách có mặt tại phòng để phục vụ!`;

export default function ServicesScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Bộ lọc danh mục nghiệp vụ cho Đơn phục vụ
  const [orderCategoryFilter, setOrderCategoryFilter] = useState<'all' | 'fnb' | 'spa' | 'laundry' | 'amenities'>('all');

  // Khóa nút chống bấm đúp khi mạng lag / 4G (Double-tap Mutex)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

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
      // Lọc bỏ vận chuyển (đã có tab riêng của đội xe) và dọn dẹp phòng (đã có tab riêng của Buồng phòng)
      const validOrders = (Array.isArray(list) ? list : []).filter(
        (it: any) => !isTransportService(it) && !isHousekeepingService(it)
      );
      setOrders(validOrders);
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
      const validCatalog = (Array.isArray(items) ? items : []).filter(
        (s: any) => !isTransportService(s) && !isHousekeepingService(s) && s.is_active !== false
      );
      setCatalogItems(validCatalog);

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

  // Tự động đồng bộ ngầm mỗi 6 giây (nhận đơn mới khi khách đặt trên Web hoặc Lễ tân tạo đơn)
  // Chỉ chạy khi tab hiển thị & app ở foreground
  useFocusPolling(fetchOrders, 6000);

  const onRefresh = () => {
    setRefreshing(true);
    setVisibleOrdersCount(15);
    setVisibleCatalogCount(16);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchOrders();
    fetchCatalog();
  };

  // KPI stats: Tách bạch 4 bước chuẩn mực
  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.status === 'pending').length;
    const preparing = orders.filter((o) => o.status === 'in_progress').length;
    const delivering = orders.filter((o) => o.status === 'delivering').length;
    const completed = orders.filter((o) => o.status === 'completed').length;
    return { total, pending, preparing, delivering, completed };
  }, [orders]);

  // Bộ lọc kết hợp: Trạng thái 4 bước + Danh mục 4 nhóm + Tìm kiếm
  const filteredOrders = useMemo(() => {
    return orders.filter((item) => {
      let matchTab = true;
      if (activeTab === 'pending') {
        matchTab = item.status === 'pending';
      } else if (activeTab === 'in_progress') {
        matchTab = item.status === 'in_progress';
      } else if (activeTab === 'delivering') {
        matchTab = item.status === 'delivering';
      } else if (activeTab === 'completed') {
        matchTab = item.status === 'completed';
      }

      let matchCat = true;
      if (orderCategoryFilter !== 'all') {
        matchCat = getServiceCategoryType(item) === orderCategoryFilter;
      }

      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        (item.guest_name && item.guest_name.toLowerCase().includes(q)) ||
        (item.room_number && item.room_number.toLowerCase().includes(q)) ||
        (item.service_name && item.service_name.toLowerCase().includes(q)) ||
        (item.note && item.note.toLowerCase().includes(q));

      return matchTab && matchCat && matchSearch;
    });
  }, [orders, activeTab, orderCategoryFilter, searchQuery]);

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
    if (actionLoadingId === item.id) return;
    // Nhận việc = chuyển sang "Đang thực hiện" nên phải qua cùng điều kiện khóa như Web
    const lock = getServiceLockReason(item);
    if (lock) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Chưa thể thực hiện', getServiceLockMessage(item, lock));
      return;
    }
    try {
      setActionLoadingId(item.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await apiClient.post(`/services/requests/${item.id}/claim/`);
      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Tiếp nhận thành công ✨', `Bạn đã nhận phụ trách yêu cầu cho Phòng ${item.room_number}!`);
        await fetchOrders();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể nhận đơn này.';
      Alert.alert('Lỗi', msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUpdateStatus = async (item: ServiceOrder, newStatus: string, label: string) => {
    if (actionLoadingId === item.id) return;
    const lock = getServiceLockReason(item);
    if (lock && ['in_progress', 'delivering', 'completed'].includes(newStatus)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Chưa thể thực hiện', getServiceLockMessage(item, lock));
      return;
    }
    try {
      setActionLoadingId(item.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await apiClient.patch(`/services/requests/${item.id}/`, {
        status: newStatus,
        assigned_staff: item.assigned_staff || user?.id,
      });
      if (res.data.success || res.data.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Cập nhật thành công ✨', `Đơn phòng ${item.room_number} đã chuyển sang "${label}"!`);
        await fetchOrders();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể cập nhật trạng thái.';
      Alert.alert('Lỗi', msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelOrder = (item: ServiceOrder) => {
    if (actionLoadingId === item.id) return;
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
              setActionLoadingId(item.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const res = await apiClient.patch(`/services/requests/${item.id}/`, {
                status: 'cancelled',
              });
              if (res.data.success || res.data.id) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                Alert.alert('Đã hủy', `Yêu cầu dịch vụ cho Phòng ${item.room_number} đã được hủy.`);
                await fetchOrders();
              }
            } catch (err: any) {
              const msg = err.response?.data?.message || 'Không thể hủy đơn này.';
              Alert.alert('Lỗi', msg);
            } finally {
              setActionLoadingId(null);
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

  const getStatusBadgeConfig = (status: string, item?: ServiceOrder) => {
    const actionConfig = item ? getServiceActionConfig(item) : null;
    switch (status) {
      case 'pending':
        return {
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.45)',
          text: '#FBBF24',
          label: actionConfig ? actionConfig.pendingBadge : 'Chờ xử lý',
        };
      case 'in_progress':
        return {
          bg: 'rgba(56, 189, 248, 0.12)',
          border: 'rgba(56, 189, 248, 0.45)',
          text: '#38BDF8',
          label: actionConfig ? actionConfig.inProgressBadge : 'Đang chuẩn bị',
        };
      case 'delivering':
        return {
          bg: 'rgba(168, 85, 247, 0.14)',
          border: 'rgba(168, 85, 247, 0.45)',
          text: '#C084FC',
          label: actionConfig ? actionConfig.deliveringBadge : 'Đang giao tận phòng',
        };
      case 'completed':
        return {
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.45)',
          text: '#34D399',
          label: actionConfig ? actionConfig.completedBadge : 'Đã phục vụ xong',
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
    const badge = getStatusBadgeConfig(item.status, item);
    const actionConfig = getServiceActionConfig(item);
    const isMyTask = item.assigned_staff === user?.id;
    const lockReason = ['pending', 'in_progress', 'delivering'].includes(item.status)
      ? getServiceLockReason(item)
      : null;
    const isActionLoading = actionLoadingId === item.id;

    return (
      <View style={[styles.card, isMyTask && styles.cardMyTask]}>
        {/* Header Đơn */}
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
            <View style={styles.roomTag}>
              <Ionicons name="bed" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
              <Text style={styles.roomTagText}>P.{item.room_number || '?'}</Text>
            </View>
            {item.booking_code ? (
              <View style={styles.bookingCodeTag}>
                <Text style={styles.bookingCodeTagText}>#{item.booking_code}</Text>
              </View>
            ) : null}
            {/* Nhãn phân loại nghiệp vụ F&B / Spa / Giặt là / Tiện ích */}
            <View style={[styles.categoryPill, { borderColor: actionConfig.catColor }]}>
              <Ionicons name={actionConfig.catIcon as any} size={11} color={actionConfig.catColor} style={{ marginRight: 3 }} />
              <Text style={[styles.categoryPillText, { color: actionConfig.catColor }]}>{actionConfig.catLabel}</Text>
            </View>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>
              {badge.label}
            </Text>
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

        {/* Thời gian đặt & Giờ hẹn giao */}
        <View style={styles.orderTimingBox}>
          {item.created_at ? (
            <View style={styles.orderTimingItem}>
              <Ionicons name="time-outline" size={13} color="#38BDF8" style={{ marginRight: 4 }} />
              <Text style={styles.orderTimingLabel}>Đặt lúc:</Text>
              <Text style={styles.orderTimingValue}>{formatOrderTime(item.created_at)}</Text>
            </View>
          ) : null}

          {item.request_time ? (
            <View style={[styles.orderTimingItem, styles.orderTimingScheduled]}>
              <Ionicons name="alarm-outline" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
              <Text style={[styles.orderTimingLabel, { color: '#F59E0B' }]}>Hẹn giao:</Text>
              <Text style={[styles.orderTimingValue, { color: '#FBBF24', fontWeight: '800' }]}>
                {formatOrderTime(item.request_time)}
              </Text>
            </View>
          ) : null}
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

        {/* Nút hành động 1 chạm - Tối ưu One-handed 50px & Chống Double-Tap */}
        <View style={styles.actionRow}>
          {item.status === 'pending' && (
            <TouchableOpacity
              style={[styles.btnClaim, (isActionLoading || lockReason) && { opacity: isActionLoading ? 0.65 : 0.45 }]}
              onPress={() => handleClaim(item)}
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
              onPress={() => handleUpdateStatus(item, 'delivering', actionConfig.deliveringLabel)}
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
              onPress={() => handleUpdateStatus(item, 'completed', actionConfig.completeSuccessMsg)}
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
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#34D399" style={{ marginRight: 6 }} />
              <Text style={styles.doneBadgeText}>{actionConfig.completedBadge}</Text>
            </View>
          )}

          {item.status === 'cancelled' && (
            <View style={[styles.doneBadge, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
              <Ionicons name="close-circle" size={16} color="#F87171" style={{ marginRight: 6 }} />
              <Text style={[styles.doneBadgeText, { color: '#F87171' }]}>Đơn đã hủy</Text>
            </View>
          )}

          {(item.status === 'pending' || item.status === 'in_progress') && (
            <TouchableOpacity
              style={[styles.btnCancelOrder, isActionLoading && { opacity: 0.5 }]}
              onPress={() => handleCancelOrder(item)}
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
          {/* 2. Dải Bộ Lọc Trạng Thái & KPI Cố Định 5 Cột Chuẩn Mực */}
          <View style={styles.fixedFilterBar}>
            {[
              { key: 'all', label: 'Tất cả', count: stats.total, color: '#F8FAFC' },
              { key: 'pending', label: 'Chờ làm', count: stats.pending, color: '#F59E0B' },
              { key: 'in_progress', label: 'Chuẩn bị', count: stats.preparing, color: '#38BDF8' },
              { key: 'delivering', label: 'Đang giao', count: stats.delivering, color: '#C084FC' },
              { key: 'completed', label: 'Đã xong', count: stats.completed, color: '#34D399' },
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

          {/* 2b. Dải Lọc Theo Nhóm Nghiệp Vụ (F&B / Spa / Giặt là / Tiện ích) */}
          <View style={{ marginBottom: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orderCategoryScroll}>
              {[
                { key: 'all', label: 'Tất cả danh mục', icon: 'grid-outline' },
                { key: 'fnb', label: 'Ẩm thực (F&B) 🍽️', icon: 'restaurant-outline' },
                { key: 'spa', label: 'Spa Trị liệu 🌿', icon: 'leaf-outline' },
                { key: 'laundry', label: 'Giặt ủi 🧺', icon: 'shirt-outline' },
                { key: 'amenities', label: 'Tiện ích phòng 🛎️', icon: 'gift-outline' },
              ].map((cat) => {
                const isSelected = orderCategoryFilter === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.orderCategoryChip, isSelected && styles.orderCategoryChipActive]}
                    onPress={() => {
                      setOrderCategoryFilter(cat.key as any);
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={13}
                      color={isSelected ? '#0A0F1D' : '#94A3B8'}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[styles.orderCategoryChipText, isSelected && styles.orderCategoryChipTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
            <ServiceListSkeleton />
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
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={7}
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
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={7}
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
    paddingHorizontal: 10,
    gap: 5,
    marginBottom: 10,
  },
  fixedFilterCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1F2937',
  },
  fixedFilterCardSelected: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  fixedFilterNumber: {
    fontSize: 15,
    fontWeight: '900',
  },
  fixedFilterLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  fixedFilterLabelSelected: {
    color: '#F59E0B',
    fontWeight: '800',
  },
  orderCategoryScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  orderCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  orderCategoryChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  orderCategoryChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  orderCategoryChipTextActive: {
    color: '#0A0F1D',
    fontWeight: '800',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 10.5,
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
  bookingCodeTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bookingCodeTagText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  foodThumbBox: {
    width: 54,
    height: 54,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  foodThumbImg: {
    width: '100%',
    height: '100%',
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
  orderTimingBox: {
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
  orderTimingItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderTimingScheduled: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  orderTimingLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginRight: 4,
  },
  orderTimingValue: {
    fontSize: 11.5,
    color: '#F1F5F9',
    fontWeight: '700',
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
    height: 48,
    borderRadius: 14,
  },
  btnClaimText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.5,
  },
  btnDeliver: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38BDF8',
    height: 48,
    borderRadius: 14,
  },
  btnDeliverText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.5,
  },
  btnComplete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    height: 48,
    borderRadius: 14,
  },
  btnCompleteText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.5,
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    height: 48,
    borderRadius: 14,
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
