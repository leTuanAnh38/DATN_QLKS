import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../../api/client';
import { useFocusPolling } from '../../hooks/use-focus-polling';
import { MAINTENANCE_ISSUE_TYPES, EQUIPMENT_SUGGESTIONS } from '../../constants/maintenance';
import { styles } from '../../components/housekeeping/styles';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../../components/NotificationBell';
import BookingManagementModal from '../../components/BookingManagementModal';
import CustomerCrmModal from '../../components/CustomerCrmModal';
import { RoomGridSkeleton } from '../../components/SkeletonLoader';

import type { RoomItem } from '../../components/housekeeping/types';
import RoomCard, { getStatusConfig } from '../../components/housekeeping/RoomCard';

export default function HousekeepingScreen() {
  const { user } = useAuth();
  const userRole = user?.role || '';
  const isServiceStaff = userRole === 'service_staff';
  const isTechnician = userRole === 'technician';
  const isManagerOrAdmin = Boolean(user?.is_superuser || ['admin', 'manager', 'owner'].includes(userRole));

  // Phân quyền chuyên trách chuẩn PMS giống Web:
  // 1. Minibar: Buồng phòng, Lễ tân, Quản lý, Admin (Kỹ thuật & Phục vụ không có quyền)
  const canAccessMinibar = !['technician', 'service_staff', 'cashier'].includes(userRole);

  // 2. Báo đồ bỏ quên: Buồng phòng, Phục vụ phòng, Kỹ thuật viên, Lễ tân, Quản lý, Admin
  const canReportLostItem = !['cashier'].includes(userRole);

  // 3. Đã dọn xong -> Sẵn sàng: CHỈ Buồng phòng, Quản lý, Admin (Phục vụ & Kỹ thuật không được dọn)
  const canMarkCleaned = ['housekeeper', 'manager', 'owner', 'admin'].includes(userRole) || isManagerOrAdmin;

  // 4. Báo hỏng thiết bị: Buồng phòng, Phục vụ, Kỹ thuật, Lễ tân, Quản lý, Admin
  const canReportMaintenance = !['cashier'].includes(userRole);

  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFloor, setFilterFloor] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Modal kiểm kê Minibar & Hư hại
  const [minibarModalVisible, setMinibarModalVisible] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomItem | null>(null);
  const [minibarItems, setMinibarItems] = useState<any[]>([]);
  const [consumedCounts, setConsumedCounts] = useState<{ [key: number]: number }>({});
  const [hasDamage, setHasDamage] = useState(false);
  const [damageDesc, setDamageDesc] = useState('');
  const [damageAmount, setDamageAmount] = useState('');
  const [checkNote, setCheckNote] = useState('');
  const [submittingCheck, setSubmittingCheck] = useState(false);

  // Modal Báo hỏng thiết bị sang Kỹ thuật (Chuẩn PMS Khách Sạn)
  const [breakdownModalVisible, setBreakdownModalVisible] = useState(false);
  const [breakdownRoom, setBreakdownRoom] = useState<RoomItem | null>(null);
  const [breakdownIssueType, setBreakdownIssueType] = useState('ac');
  const [breakdownEquipment, setBreakdownEquipment] = useState('Điều hòa Daikin');
  const [breakdownDesc, setBreakdownDesc] = useState('');
  const [breakdownPartsReplaced, setBreakdownPartsReplaced] = useState('');
  const [breakdownCost, setBreakdownCost] = useState('');
  const [isGuestFault, setIsGuestFault] = useState(false);
  const [submittingBreakdown, setSubmittingBreakdown] = useState(false);

  // Modal Khai Báo Đồ Bỏ Quên (Lost & Found) ngay trên thẻ phòng
  const [lostFoundModalVisible, setLostFoundModalVisible] = useState(false);
  const [lostFoundRoom, setLostFoundRoom] = useState<RoomItem | null>(null);
  const [lfItemName, setLfItemName] = useState('');
  const [lfCategory, setLfCategory] = useState('valuable');
  const [lfLocationDetail, setLfLocationDetail] = useState('');
  const [lfDescription, setLfDescription] = useState('');
  const [lfImage, setLfImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submittingLostFound, setSubmittingLostFound] = useState(false);

  // Modal Chi tiết Phòng & Khách Lưu Trú (Đồng bộ PMS Web)
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailRoom, setDetailRoom] = useState<RoomItem | null>(null);

  // Modal Quản Lý Đặt Phòng & Lịch Lưu Trú (Timeline)
  const [bookingModalVisible, setBookingModalVisible] = useState(false);

  // Modal Hồ Sơ Khách Hàng CRM & Lịch Sử
  const [crmModalVisible, setCrmModalVisible] = useState(false);
  const [crmGuestId, setCrmGuestId] = useState<number | null>(null);

  const openRoomDetail = (room: RoomItem) => {
    setDetailRoom(room);
    setDetailModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const fetchRooms = useCallback(async () => {
    try {
      const res = await apiClient.get('/rooms/admin/rooms/');
      const list = res.data.results || res.data.rooms || res.data.data || res.data || [];
      const next: RoomItem[] = Array.isArray(list) ? list : [];
      // Giữ nguyên object của phòng không đổi (so sánh nội dung) để RoomCard (React.memo)
      // không render lại; nếu toàn bộ không đổi thì trả về state cũ (không render lại màn hình).
      setRooms((prev) => {
        const prevById = new Map(prev.map((r) => [r.id, r]));
        const merged = next.map((n) => {
          const old = prevById.get(n.id);
          return old && JSON.stringify(old) === JSON.stringify(n) ? old : n;
        });
        const unchanged = merged.length === prev.length && merged.every((m, i) => m === prev[i]);
        return unchanged ? prev : merged;
      });
    } catch (err: any) {
      console.warn('Lỗi tải danh sách phòng:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchRooms();
  }, [fetchRooms]);

  // Tự động đồng bộ ngầm mỗi 8 giây (không kích hoạt lại spinner loading)
  // Chỉ chạy khi tab hiển thị & app ở foreground
  useFocusPolling(fetchRooms, 8000);

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchRooms();
  };

  // Danh sách các tầng thực tế trong khách sạn
  const availableFloors = useMemo(() => {
    const s = new Set<number>();
    rooms.forEach((r) => {
      if (r.floor !== undefined && r.floor !== null) s.add(r.floor);
    });
    return Array.from(s).sort((a, b) => a - b);
  }, [rooms]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = rooms.length;
    const cleaning = rooms.filter((r) => r.status === 'cleaning').length;
    const available = rooms.filter((r) => r.status === 'available').length;
    const occupied = rooms.filter((r) => r.status === 'occupied').length;
    const maintenance = rooms.filter((r) => r.status === 'maintenance').length;
    const inspectionRequested = rooms.filter(
      (r) => r.latest_minibar_check?.status === 'requested'
    ).length;
    return { total, cleaning, available, occupied, maintenance, inspectionRequested };
  }, [rooms]);

  // Lọc phòng theo trạng thái, tầng và tìm kiếm
  const filteredRooms = useMemo(() => {
    const list = rooms.filter((r) => {
      let matchStatus = true;
      if (filterStatus === 'inspection') {
        matchStatus = r.latest_minibar_check?.status === 'requested';
      } else if (filterStatus !== 'all') {
        matchStatus = r.status === filterStatus;
      }

      const matchFloor = filterFloor === 'all' || r.floor === filterFloor;

      const matchSearch =
        !searchQuery.trim() ||
        r.room_number.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        (r.category_name && r.category_name.toLowerCase().includes(searchQuery.trim().toLowerCase()));

      return matchStatus && matchFloor && matchSearch;
    });

    // Tự động ưu tiên đưa các phòng Lễ tân đang đợi kiểm tra check-out lên ĐẦU danh sách
    return list.sort((a, b) => {
      const aReq = a.latest_minibar_check?.status === 'requested' ? 1 : 0;
      const bReq = b.latest_minibar_check?.status === 'requested' ? 1 : 0;
      return bReq - aReq;
    });
  }, [rooms, filterStatus, filterFloor, searchQuery]);

  // Đổi trạng thái phòng 1 chạm
  const handleToggleCleaning = async (room: RoomItem) => {
    if (!canMarkCleaned) {
      Alert.alert('Không có quyền', 'Nghiệp vụ xác nhận dọn phòng thuộc thẩm quyền của nhân viên Buồng phòng.');
      return;
    }
    const isCleaning = room.status === 'cleaning';
    const nextStatus = isCleaning ? 'available' : 'cleaning';
    const actionTitle = isCleaning ? 'Xác nhận ĐÃ DỌN SẠCH' : 'Bắt đầu DỌN DẸP';
    const actionDesc = isCleaning
      ? `Phòng ${room.room_number} đã được lau dọn, thay ga gối sạch sẽ và sẵn sàng đón khách?`
      : `Bắt đầu ca dọn dẹp cho Phòng ${room.room_number}?`;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(actionTitle, actionDesc, [
      { text: 'Để sau', style: 'cancel' },
      {
        text: isCleaning ? 'Đã xong ✨' : 'Vào dọn 🧹',
        style: 'default',
        onPress: async () => {
          setActionLoadingId(room.id);
          try {
            const res = await apiClient.patch(`/rooms/admin/rooms/${room.id}/status/`, {
              status: nextStatus,
            });
            if (res.data.success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              fetchRooms();
            }
          } catch (err: any) {
            const msg = err.response?.data?.message || 'Không thể đổi trạng thái phòng.';
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Thông báo', msg);
          } finally {
            setActionLoadingId(null);
          }
        },
      },
    ]);
  };

  // Xác nhận hoàn tất dọn dẹp phòng lưu trú (Make-up room) cho khách đang ở
  const handleCompleteMakeUpCleaning = async (room: RoomItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Hoàn tất dọn phòng khách ở',
      `Xác nhận đã lau dọn, thay ga gối sạch sẽ cho Phòng ${room.room_number}? Trạng thái phòng tiếp tục là Có khách.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đã xong ✨',
          style: 'default',
          onPress: async () => {
            setActionLoadingId(room.id);
            try {
              const res = await apiClient.post(`/rooms/admin/rooms/${room.id}/complete-cleaning/`);
              if (res.data.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                fetchRooms();
              }
            } catch (err: any) {
              const msg = err.response?.data?.message || 'Không thể cập nhật.';
              Alert.alert('Lỗi', msg);
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  };

  const openMinibarCheck = async (room: RoomItem) => {
    if (!canAccessMinibar) {
      Alert.alert('Không có quyền', 'Nghiệp vụ kiểm kê Minibar thuộc thẩm quyền của nhân viên Buồng phòng.');
      return;
    }
    if (room.status === 'available') {
      Alert.alert(
        'Phòng đang trống',
        `Phòng ${room.room_number} hiện đang trống và chưa có khách lưu trú nên không phát sinh kiểm kê Minibar.`
      );
      return;
    }
    setSelectedRoom(room);
    setConsumedCounts({});
    setHasDamage(false);
    setDamageDesc('');
    setDamageAmount('');
    setCheckNote('');
    setMinibarModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const res = await apiClient.get('/rooms/minibar-items/?active_only=true');
      const list = res.data.results || res.data.items || res.data.data || res.data || [];
      setMinibarItems(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn('Lỗi lấy minibar items:', e);
    }
  };

  const handleQuantityChange = (itemId: number, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConsumedCounts((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [itemId]: next };
    });
  };

  const totalMinibarCost = useMemo(() => {
    let sum = 0;
    minibarItems.forEach((it) => {
      const q = consumedCounts[it.id] || 0;
      sum += q * (parseFloat(it.price) || 0);
    });
    const dmg = hasDamage ? parseFloat(damageAmount || '0') || 0 : 0;
    return sum + dmg;
  }, [minibarItems, consumedCounts, hasDamage, damageAmount]);

  const submitMinibarCheck = async () => {
    if (!selectedRoom) return;
    setSubmittingCheck(true);

    const itemsPayload = minibarItems
      .filter((it) => (consumedCounts[it.id] || 0) > 0)
      .map((it) => ({
        id: it.id,
        name: it.name,
        price: it.price,
        quantity: consumedCounts[it.id],
      }));

    try {
      const res = await apiClient.post('/rooms/minibar-checks/', {
        room_id: selectedRoom.id,
        items: itemsPayload,
        has_damage: hasDamage,
        damage_description: damageDesc,
        damage_amount: parseFloat(damageAmount || '0'),
        note: checkNote,
      });

      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Kiểm kê thành công', res.data.message || 'Đã đồng bộ vào hóa đơn Lễ tân!');
        setMinibarModalVisible(false);
        fetchRooms();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể lưu phiếu kiểm phòng.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmittingCheck(false);
    }
  };

  const openBreakdownModal = (room: RoomItem) => {
    setBreakdownRoom(room);
    setBreakdownIssueType('ac');
    setBreakdownEquipment('Điều hòa Daikin');
    setBreakdownDesc('');
    setBreakdownPartsReplaced('');
    setBreakdownCost('');
    setIsGuestFault(room.status === 'occupied');
    setBreakdownModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const submitBreakdownTicket = async () => {
    if (!breakdownRoom) return;
    if (!breakdownEquipment.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thiết bị bị hư hỏng.');
      return;
    }
    if (!breakdownDesc.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mô tả hiện tượng sự cố thiết bị.');
      return;
    }

    setSubmittingBreakdown(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const numCost = parseInt(breakdownCost.replace(/\D/g, ''), 10) || 0;
    const currentBk = breakdownRoom.current_booking || breakdownRoom.recent_booking;

    try {
      const res = await apiClient.post('/rooms/maintenance-tickets/', {
        room_id: breakdownRoom.id,
        equipment_name: breakdownEquipment.trim(),
        issue_type: breakdownIssueType,
        description: breakdownDesc.trim(),
        parts_replaced: breakdownPartsReplaced.trim(),
        cost: numCost,
        is_guest_fault: isGuestFault,
        booking_id: isGuestFault && currentBk ? currentBk.id : null,
      });

      if (res.data.success || res.data.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const ticketCode = res.data.ticket_code || res.data.ticket?.ticket_code || 'MT';
        Alert.alert(
          'Đã lập phiếu bảo trì thành công 🛠️',
          `Đã tạo phiếu #${ticketCode} cho Phòng ${breakdownRoom.room_number}.\nPhòng đã chuyển sang trạng thái "Bảo trì" và gửi chuông báo cho Đội Kỹ thuật!`
        );
        setBreakdownModalVisible(false);
        fetchRooms();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể tạo phiếu sự cố kỹ thuật.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmittingBreakdown(false);
    }
  };

  const LF_CATEGORIES = [
    { key: 'electronics', label: 'Điện tử (Điện thoại, Laptop, Sạc)' },
    { key: 'valuable', label: 'Giá trị (Ví, Tiền, Trang sức)' },
    { key: 'documents', label: 'Giấy tờ / CCCD / Hộ chiếu' },
    { key: 'clothing', label: 'Quần áo / Giày dép / Túi xách' },
    { key: 'accessories', label: 'Phụ kiện / Kính mắt / Mỹ phẩm' },
    { key: 'other', label: 'Đồ dùng khác' },
  ];

  const openLostFoundModal = (room: RoomItem) => {
    if (room.status === 'available') {
      Alert.alert(
        'Phòng đã dọn sạch',
        `Phòng ${room.room_number} hiện đang trống và đã được dọn sạch sẽ, sẵn sàng đón khách.`
      );
      return;
    }
    setLostFoundRoom(room);
    setLfItemName('');
    setLfCategory('valuable');
    setLfLocationDetail('');
    setLfDescription('');
    setLfImage(null);
    setLostFoundModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const takePhotoForLostFound = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Cần cấp quyền', 'Vui lòng cấp quyền Camera để chụp ảnh hiện vật.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLfImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở camera:', e);
    }
  };

  const pickLibraryForLostFound = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Cần cấp quyền', 'Vui lòng cấp quyền Thư viện ảnh để chọn ảnh.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLfImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở thư viện ảnh:', e);
    }
  };

  const submitLostFoundReport = async () => {
    if (!lostFoundRoom) return;
    if (!lfItemName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên đồ vật nhặt được.');
      return;
    }

    setSubmittingLostFound(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const formData = new FormData();
      formData.append('item_name', lfItemName.trim());
      formData.append('category', lfCategory);
      formData.append('room_id', String(lostFoundRoom.id));
      formData.append(
        'location_found',
        lfLocationDetail.trim()
          ? `Phòng ${lostFoundRoom.room_number} - ${lfLocationDetail.trim()}`
          : `Phòng ${lostFoundRoom.room_number}`
      );
      formData.append('description', lfDescription.trim());

      if (lfImage) {
        const uri = lfImage.uri;
        const filename = uri.split('/').pop() || 'photo.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        // @ts-ignore
        formData.append('image', {
          uri: uri,
          name: filename,
          type: type,
        });
      }

      const res = await apiClient.post('/rooms/lost-and-found/', formData);
      if (res.data.success || res.data.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Đã ghi nhận đồ bỏ quên',
          `Đã tạo mã #${res.data.tracking_code || 'LF'} tại Phòng ${lostFoundRoom.room_number} và gửi thông báo Lễ tân tiếp nhận!`
        );
        setLostFoundModalVisible(false);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể tạo phiếu đồ thất lạc.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmittingLostFound(false);
    }
  };

  // Handler được giữ trong ref và bọc wrapper ổn định để RoomCard (React.memo) không
  // bị render lại mỗi khi state của màn hình đổi (nhập ô tìm kiếm, mở modal...).
  const handlersRef = useRef({
    openRoomDetail,
    openMinibarCheck,
    openLostFoundModal,
    openBreakdownModal,
    handleToggleCleaning,
    handleCompleteMakeUpCleaning,
  });
  useEffect(() => {
    handlersRef.current = {
      openRoomDetail,
      openMinibarCheck,
      openLostFoundModal,
      openBreakdownModal,
      handleToggleCleaning,
      handleCompleteMakeUpCleaning,
    };
  });
  const roomActions = useMemo(
    () => ({
      onOpenDetail: (r: RoomItem) => handlersRef.current.openRoomDetail(r),
      onOpenMinibar: (r: RoomItem) => handlersRef.current.openMinibarCheck(r),
      onOpenLostFound: (r: RoomItem) => handlersRef.current.openLostFoundModal(r),
      onOpenBreakdown: (r: RoomItem) => handlersRef.current.openBreakdownModal(r),
      onToggleCleaning: (r: RoomItem) => handlersRef.current.handleToggleCleaning(r),
      onCompleteMakeUp: (r: RoomItem) => handlersRef.current.handleCompleteMakeUpCleaning(r),
    }),
    []
  );

  const renderRoomCard = useCallback(
    ({ item }: { item: RoomItem }) => (
      <RoomCard
        item={item}
        canAccessMinibar={canAccessMinibar}
        canMarkCleaned={canMarkCleaned}
        actionLoading={actionLoadingId === item.id}
        {...roomActions}
      />
    ),
    [canAccessMinibar, canMarkCleaned, actionLoadingId, roomActions]
  );

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      {/* 1. Header Khách Sạn & Chuông Thông Báo */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.brandSubtitle}>TA LUXURY HOTEL</Text>
          <Text style={styles.greetingTitle} numberOfLines={1}>
            {user?.role === 'service_staff'
              ? 'Sơ Đồ Phòng'
              : (user?.first_name ? `Chào ${user.first_name}` : 'Sơ Đồ Buồng Phòng')}
          </Text>
        </View>
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerShortcutBtn}
            onPress={() => {
              setBookingModalVisible(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={13} color="#F59E0B" />
            <Text style={styles.headerShortcutText}>Lịch</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerShortcutBtn, { borderColor: 'rgba(56, 189, 248, 0.4)' }]}
            onPress={() => {
              setCrmGuestId(null);
              setCrmModalVisible(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="people-outline" size={13} color="#38BDF8" />
            <Text style={[styles.headerShortcutText, { color: '#38BDF8' }]}>CRM</Text>
          </TouchableOpacity>

          <NotificationBell />
          <TouchableOpacity style={styles.refreshCircleBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={16} color="#F59E0B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Dải Bộ Lọc & KPI Cố Định 100% (Không bị trôi trượt khi lướt) */}
      <View style={styles.fixedFilterBar}>
        {[
          { key: 'all', label: 'Tất cả', count: stats.total, color: '#F8FAFC' },
          { key: 'cleaning', label: 'Cần dọn', count: stats.cleaning, color: '#F59E0B' },
          { key: 'available', label: 'Trống', count: stats.available, color: '#34D399' },
          { key: 'occupied', label: 'Có khách', count: stats.occupied, color: '#60A5FA' },
          { key: 'maintenance', label: 'Bảo trì', count: stats.maintenance, color: '#F87171' },
        ].map((item) => {
          const isSelected = filterStatus === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.fixedFilterCard,
                isSelected && styles.fixedFilterCardSelected,
              ]}
              onPress={() => {
                setFilterStatus(item.key);
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

      {/* 2b. Banner Cảnh Báo Lễ Tân Đợi Kiểm Tra (Chỉ Buồng phòng & Quản lý) */}
      {canAccessMinibar && stats.inspectionRequested > 0 && (
        <TouchableOpacity
          style={[
            styles.urgentInspectionBar,
            filterStatus === 'inspection' && styles.urgentInspectionBarActive,
          ]}
          onPress={() => {
            setFilterStatus((prev) => (prev === 'inspection' ? 'all' : 'inspection'));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
          activeOpacity={0.8}
        >
          <View style={styles.urgentInspectionLeft}>
            <View
              style={[
                styles.urgentBellIconBox,
                filterStatus === 'inspection' && { backgroundColor: '#0A0F1D' },
              ]}
            >
              <Ionicons
                name="notifications"
                size={14}
                color={filterStatus === 'inspection' ? '#F59E0B' : '#FFF'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.urgentInspectionTitle,
                  filterStatus === 'inspection' && { color: '#0A0F1D' },
                ]}
              >
                {stats.inspectionRequested} phòng cần kiểm tra Check-out gấp!
              </Text>
              <Text
                style={[
                  styles.urgentInspectionSubtitle,
                  filterStatus === 'inspection' && { color: '#1E293B', fontWeight: '600' },
                ]}
                numberOfLines={1}
              >
                Lễ tân đang đợi kiểm Minibar & Hư hại để chốt bill
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.urgentInspectionBadge,
              filterStatus === 'inspection' && { backgroundColor: '#0A0F1D', borderColor: '#0A0F1D' },
            ]}
          >
            <Text
              style={[
                styles.urgentInspectionBadgeText,
                filterStatus === 'inspection' && { color: '#F59E0B' },
              ]}
            >
              {filterStatus === 'inspection' ? 'Hiện tất cả' : 'Lọc ngay ➔'}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* 3. Ô Tìm Kiếm Nhanh */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm nhanh số phòng (VD: 101, 202...)"
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
          keyboardType="numeric"
          clearButtonMode="while-editing"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 8 }}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 4. Bộ Lọc Theo Tầng (Tối ưu nghiệp vụ Buồng phòng) */}
      {availableFloors.length > 1 && (
        <View style={styles.floorFilterWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.floorScrollContent}
          >
            <TouchableOpacity
              style={[
                styles.floorChip,
                filterFloor === 'all' && styles.floorChipActive,
              ]}
              onPress={() => {
                setFilterFloor('all');
                Haptics.selectionAsync();
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.floorChipText,
                  filterFloor === 'all' && styles.floorChipTextActive,
                ]}
              >
                Tất cả các tầng ({rooms.length})
              </Text>
            </TouchableOpacity>

            {availableFloors.map((fl) => {
              const countOnFloor = rooms.filter((r) => r.floor === fl).length;
              const isSelected = filterFloor === fl;
              return (
                <TouchableOpacity
                  key={fl}
                  style={[
                    styles.floorChip,
                    isSelected && styles.floorChipActive,
                  ]}
                  onPress={() => {
                    setFilterFloor(fl);
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.floorChipText,
                      isSelected && styles.floorChipTextActive,
                    ]}
                  >
                    Tầng {fl} ({countOnFloor})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 5. Lưới Phòng (2 cột hiện đại) */}
      {loading ? (
        <RoomGridSkeleton />
      ) : filteredRooms.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="bed-outline" size={56} color="#334155" />
          <Text style={styles.emptyTitle}>Không tìm thấy phòng phù hợp</Text>
          <Text style={styles.emptySubtitle}>Hãy thử chọn bộ lọc khác hoặc xóa từ khóa tìm kiếm.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRoomCard}
          numColumns={2}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={7}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.gridColumnWrapper}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
          }
        />
      )}

      {/* Modal Kiểm kê Minibar & Đền bù */}
      <Modal visible={minibarModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalTopBar}>
              <View>
                <Text style={styles.modalRoomTitle}>Phòng {selectedRoom?.room_number}</Text>
                <Text style={styles.modalRoomSubtitle}>Kiểm kê Minibar & Hư hại trước Check-out</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseCircle}
                onPress={() => setMinibarModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionLabel}>1. Danh mục Minibar đã dùng:</Text>
              {minibarItems.map((item) => (
                <View key={item.id} style={styles.minibarItemRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.minibarName}>{item.name}</Text>
                    <Text style={styles.minibarPrice}>
                      {parseInt(item.price).toLocaleString('vi-VN')} đ/lon
                    </Text>
                  </View>
                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleQuantityChange(item.id, -1)}
                    >
                      <Ionicons name="remove" size={16} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{consumedCounts[item.id] || 0}</Text>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleQuantityChange(item.id, 1)}
                    >
                      <Ionicons name="add" size={16} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <Text style={[styles.modalSectionLabel, { marginTop: 16 }]}>2. Hư hại tài sản phòng (nếu có):</Text>
              <TouchableOpacity
                style={styles.damageCheckboxRow}
                onPress={() => setHasDamage(!hasDamage)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={hasDamage ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={hasDamage ? '#EF4444' : '#64748B'}
                />
                <Text style={styles.damageCheckboxText}>Có vỡ đồ / hư hại cần bồi thường</Text>
              </TouchableOpacity>

              {hasDamage && (
                <View style={{ marginTop: 8 }}>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="Mô tả hư hại (VD: Vỡ 1 cốc thủy tinh, rách khăn tắm...)"
                    placeholderTextColor="#64748B"
                    value={damageDesc}
                    onChangeText={setDamageDesc}
                  />
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="Số tiền đền bù (VNĐ) - VD: 50000"
                    placeholderTextColor="#64748B"
                    keyboardType="numeric"
                    value={damageAmount}
                    onChangeText={setDamageAmount}
                  />
                </View>
              )}

              <Text style={[styles.modalSectionLabel, { marginTop: 16 }]}>3. Ghi chú kiểm tra:</Text>
              <TextInput
                style={[styles.modalTextInput, { height: 60 }]}
                placeholder="Ghi chú thêm cho lễ tân (nếu có)..."
                placeholderTextColor="#64748B"
                multiline
                value={checkNote}
                onChangeText={setCheckNote}
              />
            </ScrollView>

            {/* Thanh tổng tiền tạm tính Minibar & Bồi thường */}
            <View style={styles.minibarTotalBar}>
              <View>
                <Text style={styles.minibarTotalLabel}>TỔNG TIỀN PHÁT SINH</Text>
                <Text style={styles.minibarTotalSub}>Đồng bộ tự động vào bill Lễ tân</Text>
              </View>
              <Text style={styles.minibarTotalValue}>
                {totalMinibarCost.toLocaleString('vi-VN')} đ
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.modalConfirmBtn, submittingCheck && { opacity: 0.6 }]}
              onPress={submitMinibarCheck}
              disabled={submittingCheck}
              activeOpacity={0.8}
            >
              {submittingCheck ? (
                <ActivityIndicator color="#0A0F1D" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="receipt-outline" size={18} color="#0A0F1D" style={{ marginRight: 6 }} />
                  <Text style={styles.modalConfirmBtnText}>LƯU & ĐỒNG BỘ HÓA ĐƠN</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Báo Hỏng Thiết Bị Sang Kỹ Thuật (Chuẩn PMS Khách Sạn) */}
      <Modal visible={breakdownModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCardLarge}>
            {/* Top Header Bar */}
            <View style={styles.modalTopBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                <View style={styles.modalIconCircle}>
                  <Ionicons name="construct" size={20} color="#EF4444" />
                </View>
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.modalRoomTitle}>Báo Hỏng Phòng {breakdownRoom?.room_number}</Text>
                  <Text style={styles.modalRoomSubtitle} numberOfLines={1}>
                    Tầng {breakdownRoom?.floor} • {breakdownRoom?.category_name || 'Phòng Deluxe'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseCircle}
                onPress={() => setBreakdownModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 25 }}>
              {/* 1. Banner cảnh báo nếu phòng đang có khách */}
              {breakdownRoom?.current_booking && (
                <View style={styles.occupiedNoticeBanner}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 }}>
                      <Ionicons name="person" size={13} color="#F59E0B" style={{ marginRight: 5 }} />
                      <Text style={styles.occupiedNoticeGuest} numberOfLines={1}>
                        Khách: {breakdownRoom.current_booking.guest_name}
                      </Text>
                    </View>
                    <Text style={styles.occupiedNoticeCode}>#{breakdownRoom.current_booking.booking_code}</Text>
                  </View>
                  <Text style={styles.occupiedNoticeSub}>
                    💡 Lưu ý: Khách đang ở trong phòng. Kỹ thuật viên cần liên hệ quầy Lễ tân hoặc gõ cửa xin phép trước khi vào sửa chữa.
                  </Text>
                </View>
              )}

              {/* 2. Phân loại sự cố kỹ thuật */}
              <Text style={styles.modalSectionLabel}>1. Phân loại sự cố kỹ thuật (*):</Text>
              <View style={styles.issueTypeGrid}>
                {MAINTENANCE_ISSUE_TYPES.map((t) => {
                  const isSelected = breakdownIssueType === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[
                        styles.issueTypeCard,
                        isSelected && styles.issueTypeCardActive,
                      ]}
                      onPress={() => {
                        setBreakdownIssueType(t.key);
                        const suggestions = EQUIPMENT_SUGGESTIONS[t.key] || [];
                        if (suggestions.length > 0) {
                          setBreakdownEquipment(suggestions[0]);
                        }
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={t.icon as any}
                        size={15}
                        color={isSelected ? t.color : '#94A3B8'}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.issueTypeText,
                          isSelected && { color: t.color, fontWeight: '800' },
                        ]}
                        numberOfLines={1}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 3. Tên thiết bị hư hỏng */}
              <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>
                2. Tên thiết bị hư hỏng (*):
              </Text>
              <TextInput
                style={styles.modalTextInputSingle}
                placeholder="VD: Điều hòa Daikin, Vòi sen tắm, Khóa từ..."
                placeholderTextColor="#64748B"
                value={breakdownEquipment}
                onChangeText={setBreakdownEquipment}
              />

              {/* Gợi ý nhanh các thiết bị thông dụng */}
              <View style={styles.suggestionRow}>
                <Text style={styles.suggestionTitle}>Gợi ý nhanh:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {(EQUIPMENT_SUGGESTIONS[breakdownIssueType] || []).map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.suggestionChip,
                        breakdownEquipment === item && styles.suggestionChipActive,
                      ]}
                      onPress={() => {
                        setBreakdownEquipment(item);
                        Haptics.selectionAsync();
                      }}
                    >
                      <Text
                        style={[
                          styles.suggestionChipText,
                          breakdownEquipment === item && styles.suggestionChipTextActive,
                        ]}
                      >
                        + {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* 4. Mô tả hiện tượng sự cố */}
              <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>
                3. Mô tả hiện tượng sự cố chi tiết (*):
              </Text>
              <TextInput
                style={[styles.modalTextInput, { height: 75 }]}
                placeholder="VD: Máy lạnh không phả hơi lạnh, quạt gió kêu to, vòi sen bị nứt cần gạt, khóa thẻ từ quét nhấp nháy đỏ không nhận..."
                placeholderTextColor="#64748B"
                multiline
                value={breakdownDesc}
                onChangeText={setBreakdownDesc}
              />

              {/* 5. Phụ tùng / Vật tư thay thế cần mang theo */}
              <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>
                4. Phụ tùng / Dụng cụ mang theo dự kiến:
              </Text>
              <TextInput
                style={styles.modalTextInputSingle}
                placeholder="VD: 1 Củ sen Inax, 1 Dây xịt vệ sinh, 2 Pin AAA, 1 Tụ 35uF..."
                placeholderTextColor="#64748B"
                value={breakdownPartsReplaced}
                onChangeText={setBreakdownPartsReplaced}
              />

              {/* 6. Trách nhiệm bồi thường & Chi phí */}
              <View style={styles.costFaultBox}>
                <TouchableOpacity
                  style={styles.faultCheckboxRow}
                  onPress={() => {
                    setIsGuestFault(!isGuestFault);
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isGuestFault ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={isGuestFault ? '#F59E0B' : '#64748B'}
                  />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={styles.faultCheckboxTitle}>
                      Do khách làm hỏng (Khách bồi thường)?
                    </Text>
                    <Text style={styles.faultCheckboxSub}>
                      {isGuestFault
                        ? 'Khoản đền bù sẽ được tự động cộng vào hóa đơn thanh toán của khách.'
                        : 'Khách sạn chịu chi phí hao mòn / sửa chữa thông thường.'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {isGuestFault && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.costInputLabel}>Chi phí bồi thường / sửa chữa (VND):</Text>
                    <View style={styles.costInputWrapper}>
                      <TextInput
                        style={styles.costInput}
                        placeholder="0"
                        placeholderTextColor="#64748B"
                        keyboardType="numeric"
                        value={
                          breakdownCost
                            ? Number(breakdownCost.replace(/\D/g, '')).toLocaleString('vi-VN')
                            : ''
                        }
                        onChangeText={(t) => setBreakdownCost(t.replace(/\D/g, ''))}
                      />
                      <Text style={styles.costCurrencyUnit}>VNĐ</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Thông báo cách ly */}
              <View style={styles.breakdownNoticeBox}>
                <Ionicons name="information-circle" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                <Text style={styles.breakdownNoticeText}>
                  Sau khi gửi phiếu, phòng sẽ tự động chuyển sang trạng thái <Text style={{ color: '#F87171', fontWeight: '800' }}>"Bảo trì"</Text> để cách ly và thông báo Đội Kỹ thuật lập tức tiếp nhận.
                </Text>
              </View>

              {/* Nút gửi phiếu */}
              <TouchableOpacity
                style={[styles.breakdownSubmitBtn, submittingBreakdown && { opacity: 0.6 }]}
                onPress={submitBreakdownTicket}
                disabled={submittingBreakdown}
                activeOpacity={0.8}
              >
                {submittingBreakdown ? (
                  <ActivityIndicator color="#0A0F1D" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="construct" size={17} color="#0A0F1D" style={{ marginRight: 6 }} />
                    <Text style={styles.breakdownSubmitBtnText}>LẬP PHIẾU BẢO TRÌ & BÁO KỸ THUẬT</Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 6. Modal Khai Báo Đồ Khách Bỏ Quên (Lost & Found) */}
      <Modal
        visible={lostFoundModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLostFoundModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalTopBar}>
              <View>
                <Text style={styles.modalRoomTitle}>Phòng {lostFoundRoom?.room_number}</Text>
                <Text style={styles.modalRoomSubtitle}>Khai Báo Đồ Khách Bỏ Quên 🧳</Text>
              </View>
              <TouchableOpacity
                onPress={() => setLostFoundModalVisible(false)}
                style={styles.modalCloseCircle}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Phân loại tài sản */}
              <Text style={styles.modalSectionLabel}>1. Phân loại tài sản:</Text>
              <View style={styles.equipmentChipsWrap}>
                {LF_CATEGORIES.map((cat) => {
                  const isSel = lfCategory === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[styles.equipmentChip, isSel && { borderColor: '#8B5CF6', backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}
                      onPress={() => {
                        setLfCategory(cat.key);
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.equipmentChipText, isSel && { color: '#DDD6FE', fontWeight: '800' }]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Tên đồ vật */}
              <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>2. Tên đồ vật nhặt được *:</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="VD: Ví da nam, Sạc iPhone, Tai nghe Sony..."
                placeholderTextColor="#64748B"
                value={lfItemName}
                onChangeText={setLfItemName}
              />

              {/* Vị trí trong phòng */}
              <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>3. Vị trí phát hiện trong phòng:</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="VD: Dưới gầm giường, Ngăn kéo bàn trang điểm..."
                placeholderTextColor="#64748B"
                value={lfLocationDetail}
                onChangeText={setLfLocationDetail}
              />

              {/* Mô tả nhận dạng */}
              <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>4. Mô tả chi tiết / Đặc điểm nhận dạng:</Text>
              <TextInput
                style={[styles.modalTextInput, { height: 60 }]}
                placeholder="Màu sắc, nhãn hiệu, tình trạng (còn mới, trầy xước...)"
                placeholderTextColor="#64748B"
                multiline
                value={lfDescription}
                onChangeText={setLfDescription}
              />

              {/* Chụp ảnh hiện vật */}
              <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>5. Ảnh chụp hiện vật (Camera hoặc Thư viện):</Text>
              {lfImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: lfImage.uri }} style={styles.imagePreview} resizeMode="cover" />
                  <View style={styles.imagePreviewOverlay}>
                    <TouchableOpacity
                      style={styles.imageActionBtn}
                      onPress={takePhotoForLostFound}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera" size={14} color="#F8FAFC" style={{ marginRight: 4 }} />
                      <Text style={styles.imageActionBtnText}>Chụp lại</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.imageActionBtn, { backgroundColor: '#EF4444' }]}
                      onPress={() => setLfImage(null)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash" size={14} color="#F8FAFC" style={{ marginRight: 4 }} />
                      <Text style={styles.imageActionBtnText}>Xóa ảnh</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.photoPickerRow}>
                  <TouchableOpacity
                    style={styles.photoPickerBtn}
                    onPress={takePhotoForLostFound}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera" size={20} color="#A78BFA" />
                    <Text style={styles.photoPickerText}>Chụp ảnh camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.photoPickerBtn}
                    onPress={pickLibraryForLostFound}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="images" size={20} color="#60A5FA" />
                    <Text style={[styles.photoPickerText, { color: '#60A5FA' }]}>Chọn từ thư viện</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Thông báo tự động */}
              <View style={[styles.breakdownNoticeBox, { borderColor: 'rgba(167, 139, 250, 0.3)', backgroundColor: 'rgba(167, 139, 250, 0.08)' }]}>
                <Ionicons name="information-circle" size={16} color="#A78BFA" style={{ marginRight: 6 }} />
                <Text style={[styles.breakdownNoticeText, { color: '#DDD6FE' }]}>
                  Hệ thống tự động liên kết khách lưu trú phòng này và phát thông báo Lễ tân tiếp nhận lưu kho!
                </Text>
              </View>

              {/* Nút gửi */}
              <TouchableOpacity
                style={[styles.lostFoundSubmitBtn, submittingLostFound && { opacity: 0.6 }]}
                onPress={submitLostFoundReport}
                disabled={submittingLostFound}
                activeOpacity={0.8}
              >
                {submittingLostFound ? (
                  <ActivityIndicator color="#0A0F1D" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="paper-plane" size={16} color="#0A0F1D" style={{ marginRight: 6 }} />
                    <Text style={styles.lostFoundSubmitBtnText}>LƯU ĐỒ THẤT LẠC & BÁO LỄ TÂN</Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 4. MODAL CHI TIẾT PHÒNG & THÔNG TIN LƯU TRÚ (Chuẩn PMS Web) */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.detailModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setDetailModalVisible(false)}
            activeOpacity={1}
          />
          <View style={styles.detailModalCard}>
            {detailRoom && (() => {
              const config = getStatusConfig(detailRoom.status);
              const bk = detailRoom.current_booking || detailRoom.recent_booking;
              const isInspectReq = detailRoom.latest_minibar_check?.status === 'requested';

              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Header */}
                  <View style={styles.detailHeader}>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.detailRoomTitle}>Phòng {detailRoom.room_number}</Text>
                        <View
                          style={[
                            styles.detailStatusBadge,
                            { backgroundColor: config.bg, borderColor: config.border },
                          ]}
                        >
                          <View style={[styles.pulseDot, { backgroundColor: config.dot }]} />
                          <Text style={[styles.detailStatusText, { color: config.text }]}>
                            {config.label}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.detailRoomSub}>
                        Tầng {detailRoom.floor} • {detailRoom.category_name || 'Phòng tiêu chuẩn'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setDetailModalVisible(false)}
                      style={styles.detailCloseBtn}
                    >
                      <Ionicons name="close" size={20} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>

                  {/* Banner Lễ tân cần kiểm check-out (Chỉ Buồng phòng & Quản lý) */}
                  {canAccessMinibar && isInspectReq && (
                    <View style={styles.detailAlertBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Ionicons name="warning" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                        <Text style={styles.detailAlertTitle}>LỄ TÂN ĐỢI KIỂM CHECK-OUT</Text>
                      </View>
                      <Text style={styles.detailAlertSub}>
                        Khách đang tại quầy lễ tân chờ trả phòng. Vui lòng kiểm tra minibar và hiện trạng đồ đạc ngay.
                      </Text>
                      <TouchableOpacity
                        style={styles.detailAlertActionBtn}
                        onPress={() => {
                          setDetailModalVisible(false);
                          openMinibarCheck(detailRoom);
                        }}
                      >
                        <Ionicons name="wine" size={14} color="#0A0F1D" style={{ marginRight: 4 }} />
                        <Text style={styles.detailAlertActionText}>KIỂM TRA MINIBAR NGAY</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Thông tin khách & Lưu trú */}
                  <View style={styles.detailSectionBox}>
                    <View style={styles.detailSectionHeader}>
                      <Ionicons name="person-circle-outline" size={18} color="#60A5FA" />
                      <Text style={styles.detailSectionTitle}>Thông tin lưu trú</Text>
                      {bk?.status_display ? (
                        <View style={styles.detailBkStatusBadge}>
                          <Text style={styles.detailBkStatusText}>{bk.status_display}</Text>
                        </View>
                      ) : null}
                    </View>

                    {bk ? (
                      <View style={styles.detailInfoGrid}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Họ tên khách:</Text>
                          <Text style={styles.detailValueBold}>{bk.guest_name || 'Khách lưu trú'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Mã đặt phòng:</Text>
                          <Text style={styles.detailValueCode}>#{bk.booking_code}</Text>
                        </View>
                        {bk.guest_phone ? (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Số điện thoại:</Text>
                            <TouchableOpacity
                              style={{ flexDirection: 'row', alignItems: 'center' }}
                              onPress={() => Linking.openURL(`tel:${bk.guest_phone}`)}
                            >
                              <Ionicons name="call" size={13} color="#34D399" style={{ marginRight: 4 }} />
                              <Text style={[styles.detailValueBold, { color: '#34D399' }]}>
                                {bk.guest_phone}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                        {bk.check_in_date ? (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Nhận phòng:</Text>
                            <Text style={styles.detailValue}>{bk.check_in_date}</Text>
                          </View>
                        ) : null}
                        {bk.check_out_date ? (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Trả phòng:</Text>
                            <Text style={styles.detailValue}>{bk.check_out_date}</Text>
                          </View>
                        ) : null}

                        {(bk.guest_id || (bk as any).guest) ? (
                          <TouchableOpacity
                            style={styles.detailCrmBtn}
                            onPress={() => {
                              const gid = bk.guest_id || (typeof (bk as any).guest === 'object' ? (bk as any).guest?.id : (bk as any).guest);
                              setCrmGuestId(gid);
                              setDetailModalVisible(false);
                              setCrmModalVisible(true);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                          >
                            <Ionicons name="person-circle" size={16} color="#0A0F1D" style={{ marginRight: 6 }} />
                            <Text style={styles.detailCrmBtnText}>Xem Hồ Sơ CRM & Lịch Sử Khách</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : (
                      <Text style={styles.detailEmptyText}>Hiện không có thông tin khách lưu trú.</Text>
                    )}
                  </View>

                  {/* Sự cố kỹ thuật nếu có */}
                  {detailRoom.active_maintenance && (
                    <View style={[styles.detailSectionBox, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                      <View style={styles.detailSectionHeader}>
                        <Ionicons name="construct-outline" size={18} color="#EF4444" />
                        <Text style={[styles.detailSectionTitle, { color: '#EF4444' }]}>
                          Phiếu bảo trì đang xử lý
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Mã sự cố:</Text>
                        <Text style={[styles.detailValueCode, { color: '#F87171' }]}>
                          #{detailRoom.active_maintenance.ticket_code}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Thiết bị:</Text>
                        <Text style={styles.detailValueBold}>
                          {detailRoom.active_maintenance.equipment_name}
                        </Text>
                      </View>
                      {detailRoom.active_maintenance.description ? (
                        <View style={{ marginTop: 6 }}>
                          <Text style={styles.detailLabel}>Mô tả lỗi:</Text>
                          <Text style={styles.detailDescText}>
                            {detailRoom.active_maintenance.description}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  )}

                  {/* Hành động nhanh theo phân quyền */}
                  {detailRoom.status === 'maintenance' ? (
                    <View style={styles.maintenanceIsolatedBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Ionicons name="construct" size={18} color="#EF4444" style={{ marginRight: 6 }} />
                        <Text style={styles.maintenanceIsolatedTitle}>Phòng đang cách ly sửa chữa 🛠️</Text>
                      </View>
                      <Text style={styles.maintenanceIsolatedDesc}>
                        Thiết bị trong phòng đang được Đội Kỹ thuật khắc phục theo phiếu #{detailRoom.active_maintenance?.ticket_code || 'Bảo trì'}.
                        {isTechnician || isManagerOrAdmin
                          ? ' Bạn có thể chuyển sang tab Kỹ thuật để nghiệm thu hoặc hoàn tất sửa chữa.'
                          : ' Sau khi kỹ thuật viên sửa xong, phòng sẽ tự động chuyển sang "Đang dọn dẹp" để buồng phòng vào làm vệ sinh đón khách.'}
                      </Text>

                      {(isTechnician || isManagerOrAdmin) && (
                        <TouchableOpacity
                          style={styles.maintenanceGoBtn}
                          onPress={() => {
                            setDetailModalVisible(false);
                            router.navigate('/(tabs)/maintenance');
                          }}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="build" size={15} color="#0A0F1D" style={{ marginRight: 6 }} />
                          <Text style={styles.maintenanceGoBtnText}>Đi đến Phiếu bảo trì & Nghiệm thu 🛠️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <>
                      <Text style={styles.detailActionsHeading}>
                        {isTechnician
                          ? 'Thao tác cho Kỹ thuật viên'
                          : canMarkCleaned
                          ? 'Thao tác nhanh cho Buồng phòng'
                          : 'Thao tác cho Phục vụ phòng'}
                      </Text>
                      <View style={styles.detailActionsGrid}>
                        {/* 1. Nút Đổi trạng thái Dọn phòng: CHỈ HIỆN khi phòng đang 'cleaning' hoặc 'available' */}
                        {canMarkCleaned && (detailRoom.status === 'cleaning' || detailRoom.status === 'available') && (
                          <TouchableOpacity
                            style={[styles.detailActionBtn, { backgroundColor: config.actionBg }]}
                            onPress={() => {
                              setDetailModalVisible(false);
                              handleToggleCleaning(detailRoom);
                            }}
                          >
                            <Ionicons
                              name={config.actionIcon as any}
                              size={18}
                              color={config.actionColor}
                              style={{ marginRight: 6 }}
                            />
                            <Text style={[styles.detailActionBtnText, { color: config.actionColor }]}>
                              {config.actionText}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* 2. Kiểm Minibar: CHỈ khi phòng có khách (occupied) hoặc vừa trả phòng đang dọn (cleaning) */}
                        {canAccessMinibar && (detailRoom.status === 'occupied' || detailRoom.status === 'cleaning') && (
                          <TouchableOpacity
                            style={styles.detailToolBtn}
                            onPress={() => {
                              setDetailModalVisible(false);
                              openMinibarCheck(detailRoom);
                            }}
                          >
                            <Ionicons name="wine" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                            <Text style={[styles.detailToolBtnText, { color: '#F59E0B' }]}>Kiểm Minibar</Text>
                          </TouchableOpacity>
                        )}

                        {/* 3. Thêm dịch vụ & Đặt xe: CHỈ cho phòng có khách và KHÔNG PHẢI Kỹ thuật */}
                        {!isTechnician && detailRoom.status === 'occupied' && (
                          <TouchableOpacity
                            style={[
                              styles.detailToolBtn,
                              { borderColor: 'rgba(56, 189, 248, 0.4)', backgroundColor: 'rgba(56, 189, 248, 0.08)' },
                            ]}
                            onPress={() => {
                              setDetailModalVisible(false);
                              router.navigate('/(tabs)/services');
                            }}
                          >
                            <Ionicons name="restaurant" size={16} color="#38BDF8" style={{ marginRight: 6 }} />
                            <Text style={[styles.detailToolBtnText, { color: '#38BDF8' }]}>Thêm dịch vụ & Gọi món 🍽️</Text>
                          </TouchableOpacity>
                        )}

                        {!isTechnician && detailRoom.status === 'occupied' && (
                          <TouchableOpacity
                            style={[
                              styles.detailToolBtn,
                              { borderColor: 'rgba(245, 158, 11, 0.4)', backgroundColor: 'rgba(245, 158, 11, 0.08)' },
                            ]}
                            onPress={() => {
                              setDetailModalVisible(false);
                              router.navigate('/(tabs)/transport');
                            }}
                          >
                            <Ionicons name="car-sport" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                            <Text style={[styles.detailToolBtnText, { color: '#F59E0B' }]}>Đặt xe đưa đón 🚗</Text>
                          </TouchableOpacity>
                        )}

                        {/* 4. Báo đồ bỏ quên: CHỈ cho phòng có khách hoặc đang dọn (tránh phòng trống/bảo trì) */}
                        {canReportLostItem && (detailRoom.status === 'occupied' || detailRoom.status === 'cleaning') && (
                          <TouchableOpacity
                            style={styles.detailToolBtn}
                            onPress={() => {
                              setDetailModalVisible(false);
                              openLostFoundModal(detailRoom);
                            }}
                          >
                            <Ionicons name="briefcase" size={16} color="#A78BFA" style={{ marginRight: 6 }} />
                            <Text style={[styles.detailToolBtnText, { color: '#A78BFA' }]}>Báo đồ bỏ quên</Text>
                          </TouchableOpacity>
                        )}

                        {/* 5. Báo hỏng thiết bị: Phòng chưa ở trạng thái Bảo trì */}
                        {canReportMaintenance && (
                          <TouchableOpacity
                            style={styles.detailToolBtn}
                            onPress={() => {
                              setDetailModalVisible(false);
                              openBreakdownModal(detailRoom);
                            }}
                          >
                            <Ionicons name="construct" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                            <Text style={[styles.detailToolBtnText, { color: '#EF4444' }]}>Báo hỏng thiết bị</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </>
                  )}
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Modal Quản Lý Đặt Phòng & Lịch Trình */}
      <BookingManagementModal
        visible={bookingModalVisible}
        onClose={() => setBookingModalVisible(false)}
        onSelectGuest={(guestId) => {
          setCrmGuestId(guestId);
          setBookingModalVisible(false);
          setCrmModalVisible(true);
        }}
      />

      {/* Modal Khách Hàng CRM & Lịch Sử */}
      <CustomerCrmModal
        visible={crmModalVisible}
        onClose={() => setCrmModalVisible(false)}
        initialGuestId={crmGuestId}
      />
    </SafeAreaView>
  );
}
