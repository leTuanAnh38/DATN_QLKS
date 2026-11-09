import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { useFocusPolling } from '../../hooks/use-focus-polling';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme } from '../../contexts/ThemeContext';
import NotificationBell from '../../components/NotificationBell';
import CustomerCrmModal from '../../components/CustomerCrmModal';
import { ServiceListSkeleton } from '../../components/SkeletonLoader';
import { enqueueOfflineAction } from '../../services/offlineQueue';
import {
  ServiceOrder,
  CartItem,
  ServiceLockReason,
  isTransportService,
  isHousekeepingService,
  getServiceCategoryType,
  getServiceActionConfig,
  getServiceLockReason,
  getServiceLockMessage,
  getSlaStatus,
  getStatusBadgeConfig,
  formatOrderTime,
  styles,
  ServiceOrderCard,
  CatalogItemCard,
  CreateServiceOrderModal,
  CancelServiceOrderModal,
  RoomBatchDeliveryCard,
} from '../../components/services';

export default function ServicesScreen() {
  const { user } = useAuth();
  const { colors, isDark, hotelStars, hotelName } = useAppTheme();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Bộ lọc danh mục nghiệp vụ cho Đơn phục vụ
  const [orderCategoryFilter, setOrderCategoryFilter] = useState<'all' | 'fnb' | 'spa' | 'laundry' | 'amenities'>('all');

  // Bộ lọc theo Tầng (Floor Filter) giúp nhân viên đẩy xe giao món cuốn chiếu theo tầng
  const [selectedFloor, setSelectedFloor] = useState<string>('all');

  // Bộ lọc phạm vi nhiệm vụ: 'all' (Tất cả) | 'my_tasks' (Việc của tôi) | 'unassigned' (Chưa ai nhận)
  const [scopeFilter, setScopeFilter] = useState<'all' | 'my_tasks' | 'unassigned'>('all');

  // Ẩn/hiện bộ lọc nâng cao (Phạm vi, Danh mục, Tầng) để tiết kiệm diện tích màn hình
  const [showFilters, setShowFilters] = useState(false);

  // State ID món đang gạt toggle hết món / mở phục vụ
  const [togglingCatalogId, setTogglingCatalogId] = useState<number | null>(null);

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

  // Modal Hủy Đơn với Lý Do (Food Waste & SOP)
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [itemToCancel, setItemToCancel] = useState<ServiceOrder | null>(null);
  const [cancelReasonOption, setCancelReasonOption] = useState<string>('Khách yêu cầu hủy / đổi món khác');
  const [customCancelReason, setCustomCancelReason] = useState<string>('');
  const [cancellingOrder, setCancellingOrder] = useState<boolean>(false);

  // Modal Tạo đơn gọi món / dịch vụ mới (Hỗ trợ Giỏ hàng chọn nhiều món - Multi-item Cart)
  const [createOrderModalVisible, setCreateOrderModalVisible] = useState(false);
  const [occupiedRooms, setOccupiedRooms] = useState<any[]>([]);
  const [serviceCategories, setServiceCategories] = useState<any[]>([]);
  const [serviceItems, setServiceItems] = useState<any[]>([]);
  const [loadingModalData, setLoadingModalData] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [orderNote, setOrderNote] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Giỏ hàng chọn nhiều món
  const [cart, setCart] = useState<CartItem[]>([]);

  // Hẹn giờ giao hàng trong Modal Tạo đơn
  const [deliveryMode, setDeliveryMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledTime, setScheduledTime] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    return d;
  });
  const [customTimeText, setCustomTimeText] = useState('');

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
      // Lấy toàn bộ món active lẫn inactive để nhân viên phục vụ có thể kiểm soát và gạt bật/tắt (toggle) còn món / hết món
      const validCatalog = (Array.isArray(items) ? items : []).filter(
        (s: any) => !isTransportService(s) && !isHousekeepingService(s)
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
  useFocusPolling(fetchOrders, 6000);

  const onRefresh = () => {
    setRefreshing(true);
    setVisibleOrdersCount(15);
    setVisibleCatalogCount(16);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchOrders();
    fetchCatalog();
  };

  // Helper kiểm tra đơn có thuộc quyền phụ trách của nhân viên đang đăng nhập hay không
  const checkIsMyTask = useCallback(
    (o: ServiceOrder | any) => {
      if (!o) return false;
      const myUserId = user?.id;
      if (Boolean(myUserId) && o.assigned_staff === myUserId) return true;

      const myFirstName = (user?.first_name || '').trim();
      const myUsername = (user?.username || '').trim();
      const staffName = (o.assigned_staff_name || '').trim();

      if (Boolean(myUsername) && staffName === myUsername) return true;
      if (Boolean(myFirstName) && staffName.includes(myFirstName)) return true;
      return false;
    },
    [user]
  );

  // KPI stats: Tách bạch 4 bước chuẩn mực + số đơn trễ hạn SLA + đơn của tôi + đơn chưa ai nhận
  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.status === 'pending').length;
    const preparing = orders.filter((o) => o.status === 'in_progress').length;
    const delivering = orders.filter((o) => o.status === 'delivering').length;
    const completed = orders.filter((o) => o.status === 'completed').length;
    const overdue = orders.filter((o) => getSlaStatus(o)?.isOverdue).length;

    // Đơn của tôi CẦN XỬ LÝ (chỉ tính đơn đang hoạt động: pending, in_progress, delivering - loại trừ completed và cancelled)
    const myTasks = orders.filter((o) => {
      return (
        checkIsMyTask(o) &&
        (o.status === 'in_progress' || o.status === 'delivering' || o.status === 'pending')
      );
    }).length;

    // Đơn chưa ai nhận (chỉ tính đơn chờ xử lý, loại trừ đơn đã hoàn thành hoặc đã hủy)
    const unassigned = orders.filter(
      (o) => !o.assigned_staff && o.status !== 'completed' && o.status !== 'cancelled'
    ).length;

    return { total, pending, preparing, delivering, completed, overdue, myTasks, unassigned };
  }, [orders, checkIsMyTask]);

  // Thống kê động cho 5 ô lọc trạng thái thích ứng theo phạm vi nhiệm vụ (Scope)
  const scopeStats = useMemo(() => {
    if (scopeFilter === 'my_tasks') {
      const myOrders = orders.filter((o) => checkIsMyTask(o));
      const pending = myOrders.filter((o) => o.status === 'pending').length;
      const preparing = myOrders.filter((o) => o.status === 'in_progress').length;
      const delivering = myOrders.filter((o) => o.status === 'delivering').length;
      const completed = myOrders.filter((o) => o.status === 'completed').length;
      const total = pending + preparing + delivering;

      return { total, pending, preparing, delivering, completed };
    }

    if (scopeFilter === 'unassigned') {
      const unassignedOrders = orders.filter(
        (o) => !o.assigned_staff && o.status !== 'completed' && o.status !== 'cancelled'
      );
      const pending = unassignedOrders.filter((o) => o.status === 'pending').length;
      return {
        total: unassignedOrders.length,
        pending,
        preparing: 0,
        delivering: 0,
        completed: 0,
      };
    }

    // scopeFilter === 'all': Thống kê toàn khách sạn
    return {
      total: orders.length,
      pending: orders.filter((o) => o.status === 'pending').length,
      preparing: orders.filter((o) => o.status === 'in_progress').length,
      delivering: orders.filter((o) => o.status === 'delivering').length,
      completed: orders.filter((o) => o.status === 'completed').length,
    };
  }, [orders, scopeFilter, checkIsMyTask]);

  // Danh sách các tầng thực tế có đơn dịch vụ phát sinh
  const availableFloors = useMemo(() => {
    const floorsSet = new Set<string>();
    orders.forEach((o) => {
      const fl = o.room_floor
        ? String(o.room_floor)
        : (o.room_number && /^\d{3,}$/.test(o.room_number.trim()) ? o.room_number.trim().slice(0, -2) : null);
      if (fl) floorsSet.add(fl);
    });
    return Array.from(floorsSet).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [orders]);

  // Bộ lọc kết hợp: Phạm vi nhiệm vụ + Trạng thái 4 bước + Danh mục 4 nhóm + Tầng + Tìm kiếm + Sắp xếp thông minh
  const filteredOrders = useMemo(() => {
    const list = orders.filter((item) => {
      // 1. Lọc theo Scope (Tất cả / Việc của tôi / Chưa ai nhận)
      if (scopeFilter === 'my_tasks') {
        const isMy = checkIsMyTask(item);
        if (!isMy) return false;

        // Đơn đã hủy không bao giờ hiển thị trong Việc của tôi
        if (item.status === 'cancelled') return false;

        // Nếu ở tab "Tất cả", chỉ hiển thị đơn CẦN LÀM (in_progress, delivering, pending)
        if (activeTab === 'all' && item.status === 'completed') return false;
      } else if (scopeFilter === 'unassigned') {
        // Đơn chưa ai nhận: không hiển thị đơn có người nhận, đơn đã hủy hoặc đơn đã hoàn thành
        if (Boolean(item.assigned_staff) || item.status === 'cancelled' || item.status === 'completed') {
          return false;
        }
      }

      // 2. Lọc theo Trạng thái
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

      // 3. Lọc theo Phân loại nghiệp vụ
      let matchCat = true;
      if (orderCategoryFilter !== 'all') {
        matchCat = getServiceCategoryType(item) === orderCategoryFilter;
      }

      // 4. Lọc theo Tầng
      let matchFloor = true;
      if (selectedFloor !== 'all') {
        const itemFloor = item.room_floor
          ? String(item.room_floor)
          : (item.room_number && /^\d{3,}$/.test(item.room_number.trim()) ? item.room_number.trim().slice(0, -2) : '');
        matchFloor = itemFloor === selectedFloor;
      }

      // 5. Tìm kiếm
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        (item.guest_name && item.guest_name.toLowerCase().includes(q)) ||
        (item.guest_phone && item.guest_phone.toLowerCase().includes(q)) ||
        (item.room_number && item.room_number.toLowerCase().includes(q)) ||
        (item.service_name && item.service_name.toLowerCase().includes(q)) ||
        (item.note && item.note.toLowerCase().includes(q));

      return matchTab && matchCat && matchFloor && matchSearch;
    });

    // Sắp xếp hợp lý:
    // 1. Đơn trễ hạn SLA lên TOP 1 tuyệt đối để ưu tiên xử lý khẩn cấp
    // 2. Đơn chờ làm (pending) -> Đang giao (delivering) -> Đang chuẩn bị (in_progress)
    // 3. Đơn đã hoàn thành (completed) và Đã hủy (cancelled) xuống DƯỚI CÙNG
    return list.slice().sort((a, b) => {
      const slaA = getSlaStatus(a);
      const slaB = getSlaStatus(b);
      const isOverdueA = Boolean(slaA?.isOverdue);
      const isOverdueB = Boolean(slaB?.isOverdue);

      if (isOverdueA !== isOverdueB) {
        return isOverdueA ? -1 : 1;
      }

      const getStatusWeight = (status: string) => {
        switch (status) {
          case 'pending': return 1;
          case 'delivering': return 2;
          case 'in_progress': return 3;
          case 'completed': return 8;
          case 'cancelled': return 9;
          default: return 5;
        }
      };

      const wA = getStatusWeight(a.status);
      const wB = getStatusWeight(b.status);
      if (wA !== wB) {
        return wA - wB;
      }

      // Nhóm đã hoàn thành / hủy: LIFO
      if (wA >= 8) {
        const tA = new Date(a.updated_at || a.created_at || 0).getTime();
        const tB = new Date(b.updated_at || b.created_at || 0).getTime();
        return tB - tA;
      }

      // Nhóm đang hoạt động / cùng trễ hạn SLA: FIFO
      const tA = new Date(a.request_time || a.created_at || 0).getTime();
      const tB = new Date(b.request_time || b.created_at || 0).getTime();
      return tA - tB;
    });
  }, [orders, activeTab, orderCategoryFilter, selectedFloor, searchQuery, scopeFilter, checkIsMyTask]);

  // Đếm số lượng món đang xử lý theo từng phòng để gắn nhãn "Cùng mâm"
  const orderCountByRoom = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      if (['pending', 'in_progress', 'delivering'].includes(o.status) && o.room_number) {
        counts[o.room_number] = (counts[o.room_number] || 0) + 1;
      }
    });
    return counts;
  }, [orders]);

  // Gom các món đang hoạt động (Đang nấu hoặc Đang giao) theo từng phòng để phục vụ cùng mâm
  const roomBatches = useMemo(() => {
    const map: Record<
      string,
      {
        roomNumber: string;
        guestName?: string;
        inProgressItems: ServiceOrder[];
        deliveringItems: ServiceOrder[];
        totalDeliveringPrice: number;
      }
    > = {};

    filteredOrders.forEach((o) => {
      if (['in_progress', 'delivering'].includes(o.status) && o.room_number) {
        const rn = o.room_number;
        if (!map[rn]) {
          map[rn] = {
            roomNumber: rn,
            guestName: o.guest_name,
            inProgressItems: [],
            deliveringItems: [],
            totalDeliveringPrice: 0,
          };
        }
        if (o.status === 'in_progress') {
          map[rn].inProgressItems.push(o);
        } else if (o.status === 'delivering') {
          map[rn].deliveringItems.push(o);
          map[rn].totalDeliveringPrice += parseInt(o.total_price || '0', 10) || 0;
        }
      }
    });

    // Chỉ hiển thị phòng nào có từ 2 món trở lên đang cùng mâm
    return Object.values(map).filter(
      (b) => b.inProgressItems.length + b.deliveringItems.length >= 2
    );
  }, [filteredOrders]);

  const [batchLoadingRoom, setBatchLoadingRoom] = useState<string | null>(null);

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

  const executeClaim = async (item: ServiceOrder) => {
    try {
      setActionLoadingId(item.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await apiClient.post(`/services/requests/${item.id}/claim/`);
      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Tiếp nhận thành công', `Bạn đã nhận phụ trách yêu cầu cho Phòng ${item.room_number}!`);
        await fetchOrders();
      }
    } catch (err: any) {
      if (!err.response) {
        await enqueueOfflineAction({
          description: `Đơn ${item.service_name} (P.${item.room_number}): Tiếp nhận thực hiện`,
          url: `/services/requests/${item.id}/claim/`,
          method: 'POST',
        });

        // Optimistic UI update
        const myName = user?.first_name || user?.username || 'Tôi';
        setOrders((prev) =>
          prev.map((o) =>
            o.id === item.id ? { ...o, assigned_staff_name: myName, status: 'in_progress' } : o
          )
        );

        Alert.alert(
          'Đã lưu ngoại tuyến',
          `Mất kết nối máy chủ! Thao tác tiếp nhận đơn Phòng ${item.room_number} đã được lưu vào Hàng đợi và sẽ tự động gửi bù khi có mạng.`
        );
      } else {
        const msg = err.response?.data?.message || 'Không thể nhận đơn này.';
        Alert.alert('Thông báo', msg);
        await fetchOrders();
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleClaim = async (item: ServiceOrder) => {
    if (actionLoadingId === item.id) return;
    const lock = getServiceLockReason(item);
    if (lock) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Chưa thể thực hiện', getServiceLockMessage(item, lock));
      return;
    }

    // Cảnh báo thông minh nếu đơn có hẹn giờ giao và còn cách giờ hẹn > 30 phút
    if (item.is_scheduled && item.request_time) {
      const schedDate = new Date(item.request_time);
      if (!isNaN(schedDate.getTime())) {
        const diffMinutes = Math.floor((schedDate.getTime() - Date.now()) / 60000);
        if (diffMinutes > 30) {
          const waitStr =
            diffMinutes >= 60
              ? `${Math.floor(diffMinutes / 60)} giờ ${diffMinutes % 60} phút`
              : `${diffMinutes} phút`;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Alert.alert(
            'Đơn hẹn giờ phục vụ',
            `Khách Phòng ${item.room_number} hẹn giao lúc ${formatOrderTime(item.request_time)} (còn khoảng ${waitStr} nữa).\n\nNếu báo Bếp chế biến quá sớm món ăn có thể bị nguội. Bạn có chắc chắn muốn tiếp nhận chuẩn bị ngay từ bây giờ không?`,
            [
              { text: 'Để gần giờ hẹn', style: 'cancel' },
              {
                text: 'Vẫn tiếp nhận ngay',
                style: 'default',
                onPress: () => executeClaim(item),
              },
            ]
          );
          return;
        }
      }
    }

    await executeClaim(item);
  };

  const executeUpdateStatus = async (
    item: ServiceOrder,
    newStatus: string,
    label: string,
    extraPayload?: { is_paid?: boolean; payment_method?: string }
  ) => {
    const payload: any = {
      status: newStatus,
      assigned_staff: item.assigned_staff || user?.id,
    };
    if (extraPayload) {
      if (typeof extraPayload.is_paid === 'boolean') {
        payload.is_paid = extraPayload.is_paid;
      }
      if (extraPayload.payment_method) {
        payload.payment_method = extraPayload.payment_method;
      }
    }

    try {
      setActionLoadingId(item.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await apiClient.patch(`/services/requests/${item.id}/`, payload);
      if (res.data.success || res.data.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const priceText = item.total_price && parseInt(item.total_price, 10) > 0
          ? `${parseInt(item.total_price, 10).toLocaleString('vi-VN')} đ`
          : null;
        const folioMsg = newStatus === 'completed' && priceText
          ? `\nChi phí (${priceText}) đã được tự động ghi nợ vào hóa đơn phòng.`
          : '';
        Alert.alert('Bàn giao thành công', `Đơn phòng ${item.room_number} đã chuyển sang "${label}"!${folioMsg}`);
        await fetchOrders();
      }
    } catch (err: any) {
      if (!err.response) {
        await enqueueOfflineAction({
          description: `Đơn ${item.service_name} (P.${item.room_number}): Đổi trạng thái -> "${label}"`,
          url: `/services/requests/${item.id}/`,
          method: 'PATCH',
          data: payload,
        });

        // Optimistic UI update
        setOrders((prev) =>
          prev.map((o) =>
            o.id === item.id
              ? {
                  ...o,
                  status: newStatus as any,
                  is_paid: typeof extraPayload?.is_paid === 'boolean' ? extraPayload.is_paid : o.is_paid,
                }
              : o
          )
        );

        Alert.alert(
          'Đã lưu ngoại tuyến',
          `Mất kết nối máy chủ! Thao tác chuyển đơn Phòng ${item.room_number} sang "${label}" đã được lưu vào Hàng đợi và sẽ tự động gửi khi có mạng trở lại.`
        );
      } else {
        const msg = err.response?.data?.message || 'Không thể cập nhật trạng thái.';
        Alert.alert('Lỗi', msg);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUpdateStatus = async (
    item: ServiceOrder,
    newStatus: string,
    label: string,
    extraPayload?: { is_paid?: boolean; payment_method?: string },
    skipOwnershipCheck?: boolean
  ) => {
    if (actionLoadingId === item.id) return;
    const lock = getServiceLockReason(item);
    if (lock && ['in_progress', 'delivering', 'completed'].includes(newStatus)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Chưa thể thực hiện', getServiceLockMessage(item, lock));
      return;
    }

    // Khóa bảo vệ chống bấm nhầm đơn đang do đồng nghiệp khác phụ trách
    if (!skipOwnershipCheck && Boolean(item.assigned_staff) && !checkIsMyTask(item)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Đơn do đồng nghiệp phụ trách',
        `Đơn Phòng ${item.room_number} (${item.service_name}) hiện đang do nhân viên "${item.assigned_staff_name || 'Đồng nghiệp'}" phụ trách.\n\nBạn có chắc chắn muốn hỗ trợ cập nhật trạng thái thay đồng nghiệp không?`,
        [
          { text: 'Hủy bỏ', style: 'cancel' },
          {
            text: 'Xác nhận hỗ trợ',
            onPress: () => executeUpdateStatus(item, newStatus, label, extraPayload),
          },
        ]
      );
      return;
    }

    await executeUpdateStatus(item, newStatus, label, extraPayload);
  };

  // Hộp thoại xác nhận hoàn tất bàn giao (Tự động ghi nợ vào hóa đơn phòng)
  const handlePromptComplete = (item: ServiceOrder, label: string) => {
    if (actionLoadingId === item.id) return;
    const lock = getServiceLockReason(item);
    if (lock) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Chưa thể thực hiện', getServiceLockMessage(item, lock));
      return;
    }

    const showConfirmationAlert = () => {
      const priceText = item.total_price && parseInt(item.total_price, 10) > 0
        ? `${parseInt(item.total_price, 10).toLocaleString('vi-VN')} đ`
        : 'Miễn phí';

      Alert.alert(
        `Xác nhận bàn giao Phòng ${item.room_number}`,
        `• Dịch vụ: ${item.service_name} (x${item.quantity})\n• Tổng chi phí: ${priceText}\n\nChi phí sẽ tự động được ghi nợ vào Folio hóa đơn phòng để Lễ tân quyết toán khi khách làm thủ tục Check-out.`,
        [
          {
            text: 'Để sau',
            style: 'cancel',
          },
          {
            text: 'Xác nhận bàn giao',
            style: 'default',
            onPress: () => handleUpdateStatus(item, 'completed', label, { is_paid: false }, true),
          },
        ]
      );
    };

    if (Boolean(item.assigned_staff) && !checkIsMyTask(item)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Đơn do đồng nghiệp phụ trách',
        `Đơn Phòng ${item.room_number} (${item.service_name}) hiện đang do nhân viên "${item.assigned_staff_name || 'Đồng nghiệp'}" phụ trách.\n\nBạn có chắc chắn muốn xác nhận bàn giao hoàn tất thay đồng nghiệp không?`,
        [
          { text: 'Hủy bỏ', style: 'cancel' },
          {
            text: 'Tiếp tục bàn giao',
            onPress: showConfirmationAlert,
          },
        ]
      );
      return;
    }

    showConfirmationAlert();
  };

  // Gọi điện / Nhắn tin nhanh cho khách phòng
  const handleCallGuest = (phone?: string, guestName?: string, roomNumber?: string) => {
    if (phone && phone.trim()) {
      const cleanPhone = phone.trim();
      Alert.alert(
        `Liên hệ khách Phòng ${roomNumber || ''}`,
        `Khách hàng: ${guestName || 'Khách lưu trú'}\nSố điện thoại: ${cleanPhone}`,
        [
          { text: 'Đóng', style: 'cancel' },
          {
            text: 'Nhắn tin SMS',
            onPress: () => {
              Linking.openURL(`sms:${cleanPhone}?body=${encodeURIComponent(`Dạ em chào anh/chị phòng ${roomNumber || ''}, em từ bộ phận Phục vụ khách sạn TA Luxury...`)}`);
            },
          },
          {
            text: 'Gọi điện ngay',
            onPress: () => {
              Linking.openURL(`tel:${cleanPhone}`);
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Không có số điện thoại khách',
        `Đơn đặt phòng ${roomNumber || ''} (${guestName || 'Khách lưu trú'}) chưa lưu số điện thoại cá nhân.\n\nNhân viên vui lòng bấm chuông/gõ cửa phòng trực tiếp hoặc liên hệ quầy Lễ tân qua máy bàn nội bộ để được hỗ trợ.`
      );
    }
  };

  // Xuất xe đẩy giao toàn bộ các món của phòng (in_progress -> delivering)
  const handleStartBatchDelivery = async (roomNumber: string, items: ServiceOrder[]) => {
    if (batchLoadingRoom || items.length === 0) return;

    Alert.alert(
      `Xuất xe đẩy Phòng ${roomNumber}`,
      `Bếp và Bar đã chuẩn bị đủ ${items.length} món cho Phòng ${roomNumber}.\n\nBắt đầu chuyển toàn bộ sang trạng thái "Đang giao" (Delivering)?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: `Xuất xe (${items.length} món)`,
          onPress: async () => {
            setBatchLoadingRoom(roomNumber);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            let successCount = 0;
            let queuedCount = 0;

            for (const item of items) {
              const payload = {
                status: 'delivering',
                assigned_staff: item.assigned_staff || user?.id,
              };

              try {
                const res = await apiClient.patch(`/services/requests/${item.id}/`, payload);
                if (res.data?.success || res.data?.id) {
                  successCount++;
                }
              } catch (err: any) {
                if (!err.response) {
                  await enqueueOfflineAction({
                    description: `Đơn ${item.service_name} (P.${roomNumber}): Chuyển sang "Đang giao"`,
                    url: `/services/requests/${item.id}/`,
                    method: 'PATCH',
                    data: payload,
                  });
                  queuedCount++;
                }
              }
            }

            // Cập nhật giao diện lạc quan (Optimistic update)
            setOrders((prev) =>
              prev.map((o) =>
                items.some((it) => it.id === o.id) ? { ...o, status: 'delivering' as any } : o
              )
            );

            setBatchLoadingRoom(null);

            if (queuedCount > 0 && successCount === 0) {
              Alert.alert(
                'Đã lưu ngoại tuyến',
                `Mất kết nối máy chủ! Thao tác xuất xe ${items.length} món Phòng ${roomNumber} đã được lưu vào Hàng đợi ngoại tuyến.`
              );
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                'Đã xuất xe đẩy',
                `Đã chuyển toàn bộ ${items.length} món của Phòng ${roomNumber} sang trạng thái Đang giao!`
              );
              fetchOrders();
            }
          },
        },
      ]
    );
  };

  // Bàn giao toàn bộ các món của phòng tại cửa (delivering -> completed, ghi nợ phòng)
  const handleCompleteBatchDelivery = async (roomNumber: string, items: ServiceOrder[]) => {
    if (batchLoadingRoom || items.length === 0) return;

    const totalPrice = items.reduce(
      (sum, it) => sum + (parseInt(it.total_price || '0', 10) || 0),
      0
    );
    const priceFormatted =
      totalPrice > 0 ? `${totalPrice.toLocaleString('vi-VN')} đ` : 'Miễn phí';

    const itemSummary = items
      .map(
        (it, idx) =>
          `• ${it.service_name} (x${it.quantity})${
            it.total_price && parseInt(it.total_price, 10) > 0
              ? `: ${parseInt(it.total_price, 10).toLocaleString('vi-VN')} đ`
              : ''
          }`
      )
      .join('\n');

    Alert.alert(
      `Bàn giao toàn bộ Phòng ${roomNumber}`,
      `Chi tiết ${items.length} món cùng mâm:\n${itemSummary}\n\nTổng chi phí: ${priceFormatted}\n\nChi phí sẽ được tự động ghi nợ vào Folio hóa đơn phòng để Lễ tân quyết toán khi Check-out.`,
      [
        { text: 'Để sau', style: 'cancel' },
        {
          text: `Xác nhận bàn giao cả ${items.length} món`,
          style: 'default',
          onPress: async () => {
            setBatchLoadingRoom(roomNumber);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

            let successCount = 0;
            let queuedCount = 0;

            for (const item of items) {
              const payload = {
                status: 'completed',
                assigned_staff: item.assigned_staff || user?.id,
                is_paid: false,
              };

              try {
                const res = await apiClient.patch(`/services/requests/${item.id}/`, payload);
                if (res.data?.success || res.data?.id) {
                  successCount++;
                }
              } catch (err: any) {
                if (!err.response) {
                  await enqueueOfflineAction({
                    description: `Đơn ${item.service_name} (P.${roomNumber}): Hoàn tất & Ghi nợ phòng`,
                    url: `/services/requests/${item.id}/`,
                    method: 'PATCH',
                    data: payload,
                  });
                  queuedCount++;
                }
              }
            }

            // Cập nhật giao diện lạc quan (Optimistic update)
            setOrders((prev) =>
              prev.map((o) =>
                items.some((it) => it.id === o.id)
                  ? { ...o, status: 'completed' as any, is_paid: false }
                  : o
              )
            );

            setBatchLoadingRoom(null);

            if (queuedCount > 0 && successCount === 0) {
              Alert.alert(
                'Đã lưu ngoại tuyến',
                `Mất kết nối máy chủ! Thao tác bàn giao toàn bộ ${items.length} món Phòng ${roomNumber} đã được lưu vào Hàng đợi ngoại tuyến.`
              );
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                'Bàn giao mâm thành công',
                `Đã bàn giao thành công toàn bộ ${items.length} món cho Phòng ${roomNumber}!\nTổng chi phí ${priceFormatted} đã được tự động ghi nợ vào hóa đơn phòng.`
              );
              fetchOrders();
            }
          },
        },
      ]
    );
  };

  // Bật/Tắt trạng thái phục vụ món ăn trên Tab Thực đơn (Catalog)
  const handleToggleCatalogActive = async (item: any) => {
    if (togglingCatalogId === item.id) return;
    const isCurrentlyActive = item.is_active !== false;
    const nextStatusText = isCurrentlyActive ? 'Tạm hết món / Ngưng phục vụ' : 'Mở phục vụ lại';

    Alert.alert(
      'Chuyển trạng thái thực đơn',
      `Bạn có chắc chắn muốn chuyển món "${item.name}" sang: "${nextStatusText}"?`,
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        {
          text: isCurrentlyActive ? 'Báo hết món' : 'Mở phục vụ',
          style: isCurrentlyActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              setTogglingCatalogId(item.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const res = await apiClient.patch(`/services/items/${item.id}/toggle-active/`);
              if (res.data?.success) {
                const updatedActive = res.data?.is_active ?? !isCurrentlyActive;
                setCatalogItems((prev) =>
                  prev.map((it) => (it.id === item.id ? { ...it, is_active: updatedActive } : it))
                );
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                  'Thành công',
                  `Món "${item.name}" hiện đã ${updatedActive ? 'sẵn sàng phục vụ' : 'chuyển sang TẠM HẾT MÓN'}.`
                );
              }
            } catch (err: any) {
              const msg = err.response?.data?.message || 'Không thể cập nhật trạng thái món.';
              Alert.alert('Lỗi', msg);
            } finally {
              setTogglingCatalogId(null);
            }
          },
        },
      ]
    );
  };

  // Mở modal xác nhận hủy đơn và chọn lý do (SOP & Food waste audit)
  const handleOpenCancelModal = (item: ServiceOrder) => {
    if (actionLoadingId === item.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItemToCancel(item);
    setCancelReasonOption('Khách yêu cầu hủy / đổi món khác');
    setCustomCancelReason('');
    setCancelModalVisible(true);
  };

  // Xác nhận hủy đơn với lý do cụ thể gửi lên backend
  const handleConfirmCancelOrder = async () => {
    if (!itemToCancel) return;
    const finalReason = cancelReasonOption === 'Lý do khác'
      ? (customCancelReason.trim() || 'Nhân viên hủy đơn')
      : cancelReasonOption;

    try {
      setCancellingOrder(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await apiClient.patch(`/services/requests/${itemToCancel.id}/`, {
        status: 'cancelled',
        reason: finalReason,
      });
      if (res.data.success || res.data.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Đã hủy đơn thành công', `Đơn phòng ${itemToCancel.room_number} đã được hủy.\nLý do: ${finalReason}`);
        setCancelModalVisible(false);
        setItemToCancel(null);
        await fetchOrders();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể hủy đơn này.';
      Alert.alert('Lỗi', msg);
    } finally {
      setCancellingOrder(false);
    }
  };

  const openCreateOrderModal = async (defaultServiceId?: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCreateOrderModalVisible(true);
    setOrderNote('');
    setLoadingModalData(true);
    setDeliveryMode('now');
    const defaultSched = new Date();
    defaultSched.setMinutes(defaultSched.getMinutes() + 30);
    setScheduledTime(defaultSched);
    setCustomTimeText('');

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
        const found = nonTransport.find((s: any) => s.id === defaultServiceId);
        if (found) {
          setCart([{ service: found, quantity: 1, note: '' }]);
        } else {
          setCart([]);
        }
      } else {
        setCart([]);
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

  // Cart helpers
  const handleAddToCart = (service: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.service.id === service.id);
      if (idx >= 0) {
        return prev.map((item, i) =>
          i === idx ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { service, quantity: 1, note: '' }];
    });
  };

  const handleUpdateCartQuantity = (serviceId: number, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.service.id === serviceId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleUpdateCartItemNote = (serviceId: number, note: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.service.id === serviceId ? { ...item, note } : item
      )
    );
  };

  const handleRemoveFromCart = (serviceId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCart((prev) => prev.filter((item) => item.service.id !== serviceId));
  };

  const totalCartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const totalCartPrice = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = parseFloat(item.service.price || '0');
      return sum + (isNaN(price) ? 0 : price * item.quantity);
    }, 0);
  }, [cart]);

  const handleCreateOrder = async () => {
    if (!selectedRoom || !selectedRoom.current_booking) {
      Alert.alert('Chưa chọn phòng', 'Vui lòng chọn phòng đang có khách lưu trú.');
      return;
    }
    if (cart.length === 0) {
      Alert.alert('Giỏ hàng trống', 'Vui lòng chọn ít nhất một món ăn hoặc dịch vụ vào giỏ hàng.');
      return;
    }

    setSubmittingOrder(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const isScheduled = deliveryMode === 'scheduled';
      const payload: any = {
        booking: selectedRoom.current_booking.id,
        items: cart.map((i) => ({
          service_id: i.service.id,
          quantity: i.quantity,
          note: i.note ? i.note.trim() : '',
        })),
        note: orderNote.trim(),
        is_scheduled: isScheduled,
      };
      if (isScheduled && scheduledTime) {
        payload.request_time = scheduledTime.toISOString();
      }

      const res = await apiClient.post('/services/requests/', payload);

      if (res.data.success || res.data.created_count || res.data.id || Array.isArray(res.data)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const itemCount = totalCartCount;
        const timeNote = isScheduled
          ? ` (Hẹn giao: ${scheduledTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`
          : '';
        Alert.alert(
          'Tạo đơn thành công',
          `Đã tiếp nhận ${itemCount} món/dịch vụ cho Phòng ${selectedRoom.room_number}!${timeNote}`
        );
        setCreateOrderModalVisible(false);
        setCart([]);
        fetchOrders();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.detail || 'Không thể tạo đơn dịch vụ.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const renderOrderItem = useCallback(
    ({ item }: { item: ServiceOrder }) => {
      const isMyTask = checkIsMyTask(item);
      const lockReason = ['pending', 'in_progress', 'delivering'].includes(item.status)
        ? getServiceLockReason(item)
        : null;
      return (
        <ServiceOrderCard
          item={item}
          isDark={isDark}
          isMyTask={isMyTask}
          isActionLoading={actionLoadingId === item.id}
          badge={getStatusBadgeConfig(item.status, item)}
          actionConfig={getServiceActionConfig(item)}
          lockReason={lockReason}
          sla={getSlaStatus(item)}
          onClaim={handleClaim}
          onUpdateStatus={handleUpdateStatus}
          onPromptComplete={handlePromptComplete}
          onOpenCancelModal={handleOpenCancelModal}
          onOpenCrm={() => {
            setCrmGuestId(item.guest_id || null);
            setCrmModalVisible(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          onCallGuest={handleCallGuest}
          sameRoomCount={orderCountByRoom[item.room_number] || 1}
        />
      );
    },
    [isDark, checkIsMyTask, actionLoadingId, handleClaim, handleUpdateStatus, handlePromptComplete, handleOpenCancelModal, handleCallGuest, orderCountByRoom]
  );

  const renderCatalogCard = useCallback(
    ({ item }: { item: any }) => (
      <CatalogItemCard
        item={item}
        isDark={isDark}
        isToggling={togglingCatalogId === item.id}
        onToggleActive={handleToggleCatalogActive}
        onOrder={(it) => openCreateOrderModal(it.id)}
      />
    ),
    [isDark, togglingCatalogId, handleToggleCatalogActive, openCreateOrderModal]
  );

  return (
    <SafeAreaView style={[styles.safeContainer, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. Header Khách Sạn (Tinh gọn trên 1 dòng) */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1, marginRight: 6 }}>
          <Text style={styles.brandSubtitle}>{hotelName.toUpperCase()} • {hotelStars} SAO</Text>
          <Text style={[styles.greetingTitle, { color: colors.text, fontSize: 18 }]} numberOfLines={1}>
            Phục Vụ & Dịch Vụ
          </Text>
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
          <TouchableOpacity
            style={[
              styles.refreshCircleBtn,
              !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
            ]}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color="#F59E0B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 1b. Dải Chuyển Chế Độ: Đơn Phục Vụ vs Thực Đơn & Danh Mục */}
      <View style={styles.topModeBar}>
        <TouchableOpacity
          style={[
            styles.topModeTab,
            !isDark && {
              backgroundColor: mainViewMode === 'orders' ? '#F59E0B' : '#FFFFFF',
              borderColor: mainViewMode === 'orders' ? '#F59E0B' : '#E2E8F0',
            },
            mainViewMode === 'orders' && isDark && styles.topModeTabActive,
          ]}
          onPress={() => {
            setMainViewMode('orders');
            Haptics.selectionAsync();
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="receipt"
            size={14}
            color={mainViewMode === 'orders' ? '#0A0F1D' : (isDark ? '#94A3B8' : '#64748B')}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.topModeTabText,
              !isDark && { color: mainViewMode === 'orders' ? '#0A0F1D' : '#475569' },
              mainViewMode === 'orders' && styles.topModeTabTextActive,
            ]}
          >
            Đơn Phục Vụ ({orders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.topModeTab,
            !isDark && {
              backgroundColor: mainViewMode === 'catalog' ? '#F59E0B' : '#FFFFFF',
              borderColor: mainViewMode === 'catalog' ? '#F59E0B' : '#E2E8F0',
            },
            mainViewMode === 'catalog' && isDark && styles.topModeTabActive,
          ]}
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
            color={mainViewMode === 'catalog' ? '#0A0F1D' : (isDark ? '#94A3B8' : '#64748B')}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.topModeTabText,
              !isDark && { color: mainViewMode === 'catalog' ? '#0A0F1D' : '#475569' },
              mainViewMode === 'catalog' && styles.topModeTabTextActive,
            ]}
          >
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
              { key: 'all', label: 'Tất cả', count: scopeStats.total, color: isDark ? '#F8FAFC' : '#0F172A' },
              { key: 'pending', label: 'Chờ làm', count: scopeStats.pending, color: '#F59E0B' },
              { key: 'in_progress', label: 'Chuẩn bị', count: scopeStats.preparing, color: isDark ? '#38BDF8' : '#0284C7' },
              { key: 'delivering', label: 'Đang giao', count: scopeStats.delivering, color: isDark ? '#C084FC' : '#9333EA' },
              { key: 'completed', label: 'Đã xong', count: scopeStats.completed, color: isDark ? '#34D399' : '#059669' },
            ].map((item) => {
              const isSelected = activeTab === item.key;
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

          {/* 3. Ô Tìm Kiếm Kết Hợp Nút [Bộ Lọc ▾] Gọn Gàng Trên 1 Dòng */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginBottom: 8, gap: 8 }}>
            <View
              style={[
                styles.searchWrapper,
                { flex: 1, marginHorizontal: 0, marginBottom: 0 },
                !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
              ]}
            >
              <Ionicons name="search-outline" size={17} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginLeft: 10 }} />
              <TextInput
                style={[styles.searchInput, !isDark && { color: '#0F172A' }]}
                placeholder="Tìm phòng, tên món, tên khách..."
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 6 }}>
                  <Ionicons name="close-circle" size={17} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Nút Bật/Tắt Bộ Lọc Nâng Cao (Phạm vi, Danh mục, Tầng) */}
            {(() => {
              const activeFilterCount =
                (scopeFilter !== 'all' ? 1 : 0) +
                (orderCategoryFilter !== 'all' ? 1 : 0) +
                (selectedFloor !== 'all' ? 1 : 0);
              const isHighlighted = showFilters || activeFilterCount > 0;
              return (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    height: 40,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    backgroundColor: isHighlighted
                      ? 'rgba(245, 158, 11, 0.16)'
                      : (isDark ? '#1E293B' : '#FFFFFF'),
                    borderColor: isHighlighted ? '#F59E0B' : (isDark ? '#334155' : '#E2E8F0'),
                  }}
                  onPress={() => {
                    setShowFilters((prev) => !prev);
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={showFilters ? 'options' : 'options-outline'}
                    size={16}
                    color={isHighlighted ? '#F59E0B' : (isDark ? '#CBD5E1' : '#475569')}
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '800',
                      color: isHighlighted ? (isDark ? '#FBBF24' : '#B45309') : (isDark ? '#CBD5E1' : '#475569'),
                    }}
                  >
                    Lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                  </Text>
                  <Ionicons
                    name={showFilters ? 'chevron-up' : 'chevron-down'}
                    size={13}
                    color={isHighlighted ? '#F59E0B' : (isDark ? '#94A3B8' : '#64748B')}
                    style={{ marginLeft: 3 }}
                  />
                </TouchableOpacity>
              );
            })()}
          </View>

          {/* Nếu đang thu gọn bộ lọc nhưng có tiêu chí lọc phụ đang bật -> Hiện thanh tóm tắt nhỏ kèm nút Xóa lọc */}
          {!showFilters && (scopeFilter !== 'all' || orderCategoryFilter !== 'all' || selectedFloor !== 'all') && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginHorizontal: 14,
                marginBottom: 8,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 9,
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7',
                borderWidth: 1,
                borderColor: 'rgba(245, 158, 11, 0.35)',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#FBBF24' : '#B45309', flex: 1 }} numberOfLines={1}>
                Đang lọc:{' '}
                {[
                  scopeFilter === 'my_tasks' ? 'Việc của tôi' : scopeFilter === 'unassigned' ? 'Chưa ai nhận' : null,
                  orderCategoryFilter === 'fnb'
                    ? 'Ẩm thực'
                    : orderCategoryFilter === 'spa'
                    ? 'Spa'
                    : orderCategoryFilter === 'laundry'
                    ? 'Giặt ủi'
                    : orderCategoryFilter === 'amenities'
                    ? 'Tiện ích'
                    : null,
                  selectedFloor !== 'all' ? `Tầng ${selectedFloor}` : null,
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setScopeFilter('all');
                  setOrderCategoryFilter('all');
                  setSelectedFloor('all');
                  Haptics.selectionAsync();
                }}
                style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}
              >
                <Ionicons name="close-circle" size={14} color={isDark ? '#FBBF24' : '#B45309'} style={{ marginRight: 3 }} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#FBBF24' : '#B45309' }}>Bỏ lọc</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Khung Bộ Lọc Mở Rộng (Chỉ hiển thị khi bấm nút [Lọc ▾]) */}
          {showFilters && (
            <View
              style={{
                marginHorizontal: 14,
                marginBottom: 10,
                paddingVertical: 8,
                borderRadius: 14,
                backgroundColor: isDark ? '#111827' : '#F8FAFC',
                borderWidth: 1,
                borderColor: isDark ? '#1E293B' : '#E2E8F0',
                gap: 8,
              }}
            >
              {/* Dải 1: Phạm vi nhiệm vụ */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopeFilterScroll}>
                {[
                  { key: 'all', label: 'Tất cả đơn', count: stats.total, icon: 'layers-outline' },
                  { key: 'my_tasks', label: 'Việc của tôi', count: stats.myTasks, icon: 'person-outline' },
                  { key: 'unassigned', label: 'Chưa ai nhận', count: stats.unassigned, icon: 'hand-left-outline' },
                ].map((sc) => {
                  const isSelected = scopeFilter === sc.key;
                  return (
                    <TouchableOpacity
                      key={sc.key}
                      style={[
                        styles.scopeFilterBtn,
                        isSelected && styles.scopeFilterBtnActive,
                        !isDark && {
                          backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.15)' : '#FFFFFF',
                          borderColor: isSelected ? '#F59E0B' : '#E2E8F0',
                        },
                      ]}
                      onPress={() => {
                        setScopeFilter(sc.key as any);
                        setActiveTab('all');
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={sc.icon as any}
                        size={12}
                        color={isSelected ? '#F59E0B' : (!isDark ? '#64748B' : '#94A3B8')}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.scopeFilterBtnText,
                          isSelected && styles.scopeFilterBtnTextActive,
                          !isDark && { color: isSelected ? '#B45309' : '#475569' },
                        ]}
                      >
                        {sc.label} ({sc.count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Dải 2: Nhóm nghiệp vụ (F&B / Spa / Giặt là / Tiện ích) */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orderCategoryScroll}>
                {[
                  { key: 'all', label: 'Mọi danh mục', icon: 'grid-outline' },
                  { key: 'fnb', label: 'Ẩm thực (F&B)', icon: 'restaurant-outline' },
                  { key: 'spa', label: 'Spa Trị liệu', icon: 'leaf-outline' },
                  { key: 'laundry', label: 'Giặt ủi', icon: 'shirt-outline' },
                  { key: 'amenities', label: 'Tiện ích phòng', icon: 'gift-outline' },
                ].map((cat) => {
                  const isSelected = orderCategoryFilter === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.orderCategoryChip,
                        !isDark && {
                          backgroundColor: isSelected ? '#F59E0B' : '#FFFFFF',
                          borderColor: isSelected ? '#F59E0B' : '#E2E8F0',
                        },
                        isSelected && isDark && styles.orderCategoryChipActive,
                      ]}
                      onPress={() => {
                        setOrderCategoryFilter(cat.key as any);
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={cat.icon as any}
                        size={12}
                        color={isSelected ? '#0A0F1D' : (isDark ? '#94A3B8' : '#64748B')}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.orderCategoryChipText,
                          !isDark && { color: isSelected ? '#0A0F1D' : '#475569' },
                          isSelected && styles.orderCategoryChipTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Dải 3: Lọc theo Tầng */}
              {availableFloors.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orderCategoryScroll}>
                  {[{ key: 'all', label: 'Mọi tầng' }, ...availableFloors.map((fl) => ({ key: fl, label: `Tầng ${fl}` }))].map((flItem) => {
                    const isSelected = selectedFloor === flItem.key;
                    return (
                      <TouchableOpacity
                        key={flItem.key}
                        style={[
                          styles.orderCategoryChip,
                          !isDark && {
                            backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.15)' : '#FFFFFF',
                            borderColor: isSelected ? '#0284C7' : '#E2E8F0',
                          },
                          isSelected && isDark && {
                            backgroundColor: 'rgba(56, 189, 248, 0.2)',
                            borderColor: '#38BDF8',
                          },
                        ]}
                        onPress={() => {
                          setSelectedFloor(flItem.key);
                          Haptics.selectionAsync();
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="layers-outline"
                          size={12}
                          color={isSelected ? (isDark ? '#38BDF8' : '#0284C7') : (isDark ? '#94A3B8' : '#64748B')}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.orderCategoryChipText,
                            !isDark && { color: isSelected ? '#0284C7' : '#475569' },
                            isSelected && { color: isDark ? '#38BDF8' : '#0284C7', fontWeight: '800' },
                          ]}
                        >
                          {flItem.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          {/* Cảnh báo đơn trễ hạn SLA nếu có */}
          {stats.overdue > 0 && (
            <View style={styles.overdueAlertBanner}>
              <Ionicons name="warning" size={15} color="#F87171" style={{ marginRight: 8 }} />
              <Text style={styles.overdueAlertText}>
                Có <Text style={{ fontWeight: '900', color: '#FCA5A5' }}>{stats.overdue}</Text> đơn đang trễ hạn SLA — Đã tự động ưu tiên lên đầu danh sách!
              </Text>
            </View>
          )}

          {/* 4. Danh Sách Đơn Món */}
          {loading ? (
            <ServiceListSkeleton />
          ) : filteredOrders.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons
                name={
                  scopeFilter === 'my_tasks' && activeTab === 'all'
                    ? 'checkmark-done-circle-outline'
                    : scopeFilter === 'unassigned'
                    ? 'hand-left-outline'
                    : 'restaurant-outline'
                }
                size={56}
                color={
                  scopeFilter === 'my_tasks' && activeTab === 'all'
                    ? '#10B981'
                    : scopeFilter === 'unassigned'
                    ? '#38BDF8'
                    : '#334155'
                }
              />
              <Text style={styles.emptyTitle}>
                {scopeFilter === 'my_tasks' && activeTab === 'all'
                  ? 'Bạn không có đơn nào cần xử lý'
                  : scopeFilter === 'unassigned'
                  ? 'Không có đơn nào chưa nhận'
                  : activeTab === 'completed'
                  ? 'Chưa có đơn hoàn tất trong mục này'
                  : 'Không có yêu cầu phục vụ nào'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {scopeFilter === 'my_tasks' && activeTab === 'all'
                  ? scopeStats.completed > 0
                    ? `Tuyệt vời! Bạn đã hoàn thành ${scopeStats.completed} đơn. Bấm vào ô "Đã xong" để xem lại hoặc qua tab "Chưa ai nhận" để nhận thêm việc.`
                    : 'Hiện bạn chưa có nhiệm vụ nào cần làm. Hãy qua tab "Chưa ai nhận" để tiếp nhận đơn của khách nhé!'
                  : scopeFilter === 'unassigned'
                  ? 'Tất cả yêu cầu phục vụ hiện tại đã được nhân viên tiếp nhận hoặc đã hoàn tất.'
                  : 'Hiện chưa có khách gọi món hoặc yêu cầu tiện ích trong mục này.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={displayedOrders}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderOrderItem}
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={7}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              onEndReached={handleLoadMoreOrders}
              onEndReachedThreshold={0.2}
              ListHeaderComponent={
                roomBatches.length > 0 && activeTab !== 'completed' ? (
                  <View style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 2 }}>
                      <Ionicons name="cart" size={15} color="#F59E0B" style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#FBBF24' : '#B45309' }}>
                        GOM XE ĐẨY THEO PHÒNG ({roomBatches.length} PHÒNG CÙNG MÂM)
                      </Text>
                    </View>
                    {roomBatches.map((batch) => (
                      <RoomBatchDeliveryCard
                        key={batch.roomNumber}
                        roomNumber={batch.roomNumber}
                        guestName={batch.guestName}
                        inProgressItems={batch.inProgressItems}
                        deliveringItems={batch.deliveringItems}
                        totalDeliveringPrice={batch.totalDeliveringPrice}
                        isDark={isDark}
                        isActionLoading={batchLoadingRoom === batch.roomNumber}
                        onStartBatchDelivery={handleStartBatchDelivery}
                        onCompleteBatchDelivery={handleCompleteBatchDelivery}
                      />
                    ))}
                  </View>
                ) : undefined
              }
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
                style={[
                  styles.catalogCatChip,
                  !isDark && {
                    backgroundColor: catalogCategoryFilter === 'all' ? '#F59E0B' : '#FFFFFF',
                    borderColor: catalogCategoryFilter === 'all' ? '#F59E0B' : '#E2E8F0',
                    shadowColor: '#64748B',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1,
                  },
                  catalogCategoryFilter === 'all' && isDark && styles.catalogCatChipActive,
                ]}
                onPress={() => {
                  setCatalogCategoryFilter('all');
                  Haptics.selectionAsync();
                }}
              >
                <Text
                  style={[
                    styles.catalogCatChipText,
                    !isDark && { color: catalogCategoryFilter === 'all' ? '#0A0F1D' : '#475569' },
                    catalogCategoryFilter === 'all' && isDark && styles.catalogCatChipTextActive,
                  ]}
                >
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
                      style={[
                        styles.catalogCatChip,
                        !isDark && {
                          backgroundColor: isSelected ? '#F59E0B' : '#FFFFFF',
                          borderColor: isSelected ? '#F59E0B' : '#E2E8F0',
                          shadowColor: '#64748B',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.05,
                          shadowRadius: 2,
                          elevation: 1,
                        },
                        isSelected && isDark && styles.catalogCatChipActive,
                      ]}
                      onPress={() => {
                        setCatalogCategoryFilter(cat.id);
                        Haptics.selectionAsync();
                      }}
                    >
                      <Text
                        style={[
                          styles.catalogCatChipText,
                          !isDark && { color: isSelected ? '#0A0F1D' : '#475569' },
                          isSelected && isDark && styles.catalogCatChipTextActive,
                        ]}
                      >
                        {cat.name} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>

          {/* Search Box */}
          <View style={[styles.searchWrapper, !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
            <Ionicons name="search-outline" size={18} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginLeft: 12 }} />
            <TextInput
              style={[styles.searchInput, !isDark && { color: '#0F172A' }]}
              placeholder="Tìm tên món ăn, đồ uống, spa, dịch vụ..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={catalogSearchText}
              onChangeText={setCatalogSearchText}
              clearButtonMode="while-editing"
            />
            {catalogSearchText ? (
              <TouchableOpacity onPress={() => setCatalogSearchText('')} style={{ padding: 8 }}>
                <Ionicons name="close-circle" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
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
              renderItem={renderCatalogCard}
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
      <CreateServiceOrderModal
        visible={createOrderModalVisible}
        onClose={() => setCreateOrderModalVisible(false)}
        isDark={isDark}
        loadingModalData={loadingModalData}
        occupiedRooms={occupiedRooms}
        selectedRoom={selectedRoom}
        setSelectedRoom={setSelectedRoom}
        serviceItems={serviceItems}
        serviceCategories={serviceCategories}
        cart={cart}
        setCart={setCart}
        handleAddToCart={handleAddToCart}
        handleUpdateCartQuantity={handleUpdateCartQuantity}
        handleRemoveFromCart={handleRemoveFromCart}
        handleUpdateCartItemNote={handleUpdateCartItemNote}
        totalCartCount={totalCartCount}
        totalCartPrice={totalCartPrice}
        deliveryMode={deliveryMode}
        setDeliveryMode={setDeliveryMode}
        scheduledTime={scheduledTime}
        setScheduledTime={setScheduledTime}
        customTimeText={customTimeText}
        setCustomTimeText={setCustomTimeText}
        orderNote={orderNote}
        setOrderNote={setOrderNote}
        submittingOrder={submittingOrder}
        handleCreateOrder={handleCreateOrder}
      />

      {/* Modal Chọn Lý Do Hủy Đơn (SOP & Food Waste Management) */}
      <CancelServiceOrderModal
        visible={cancelModalVisible}
        isDark={isDark}
        itemToCancel={itemToCancel}
        cancelReasonOption={cancelReasonOption}
        setCancelReasonOption={setCancelReasonOption}
        customCancelReason={customCancelReason}
        setCustomCancelReason={setCustomCancelReason}
        cancellingOrder={cancellingOrder}
        onClose={() => setCancelModalVisible(false)}
        onConfirm={handleConfirmCancelOrder}
      />

      {/* Modal Hồ Sơ Khách Hàng (CRM & Lịch Sử) */}
      <CustomerCrmModal
        visible={crmModalVisible}
        onClose={() => setCrmModalVisible(false)}
        initialGuestId={crmGuestId}
      />
    </SafeAreaView>
  );
}
