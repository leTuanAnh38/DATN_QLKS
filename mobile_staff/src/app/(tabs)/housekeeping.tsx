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
  Modal,
  TextInput,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../../components/NotificationBell';

interface BookingSummary {
  id: number;
  booking_code: string;
  guest_id?: number;
  guest_name: string;
  guest_phone?: string;
  guest_email?: string;
  check_in_date?: string;
  check_out_date?: string;
  status?: string;
  status_display?: string;
}

interface MaintenanceSummary {
  id: number;
  ticket_code: string;
  equipment_name: string;
  issue_type?: string;
  issue_type_display?: string;
  description?: string;
}

interface RoomItem {
  id: number;
  room_number: string;
  category_name?: string;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance';
  status_display?: string;
  floor: number;
  current_booking?: BookingSummary | null;
  recent_booking?: BookingSummary | null;
  active_maintenance?: MaintenanceSummary | null;
  latest_minibar_check?: any | null;
}

export default function HousekeepingScreen() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Modal Báo hỏng thiết bị sang Kỹ thuật
  const [breakdownModalVisible, setBreakdownModalVisible] = useState(false);
  const [breakdownRoom, setBreakdownRoom] = useState<RoomItem | null>(null);
  const [breakdownEquipment, setBreakdownEquipment] = useState('Điều hòa Daikin');
  const [breakdownDesc, setBreakdownDesc] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
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

  const fetchRooms = useCallback(async () => {
    try {
      const res = await apiClient.get('/rooms/admin/rooms/');
      const list = res.data.results || res.data.rooms || res.data.data || res.data || [];
      setRooms(Array.isArray(list) ? list : []);
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

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchRooms();
  };

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = rooms.length;
    const cleaning = rooms.filter((r) => r.status === 'cleaning').length;
    const available = rooms.filter((r) => r.status === 'available').length;
    const occupied = rooms.filter((r) => r.status === 'occupied').length;
    const maintenance = rooms.filter((r) => r.status === 'maintenance').length;
    return { total, cleaning, available, occupied, maintenance };
  }, [rooms]);

  // Lọc phòng theo trạng thái và tìm kiếm
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchStatus = filterStatus === 'all' || r.status === filterStatus;
      const matchSearch =
        !searchQuery.trim() ||
        r.room_number.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        (r.category_name && r.category_name.toLowerCase().includes(searchQuery.trim().toLowerCase()));
      return matchStatus && matchSearch;
    });
  }, [rooms, filterStatus, searchQuery]);

  // Đổi trạng thái phòng 1 chạm
  const handleToggleCleaning = async (room: RoomItem) => {
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
          }
        },
      },
    ]);
  };

  const openMinibarCheck = async (room: RoomItem) => {
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
    setBreakdownEquipment('Điều hòa Daikin');
    setBreakdownDesc('');
    setIsUrgent(false);
    setBreakdownModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const submitBreakdownTicket = async () => {
    if (!breakdownRoom) return;
    if (!breakdownDesc.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mô tả hiện tượng sự cố thiết bị.');
      return;
    }
    setSubmittingBreakdown(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await apiClient.post('/rooms/maintenance-tickets/', {
        room_id: breakdownRoom.id,
        equipment_name: breakdownEquipment,
        description: breakdownDesc.trim(),
        issue_type: 'repair',
        priority: isUrgent ? 'high' : 'medium',
      });

      if (res.data.success || res.data.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Đã báo kỹ thuật',
          `Phòng ${breakdownRoom.room_number} đã chuyển sang trạng thái Bảo trì và bắn chuông báo cho Đội Kỹ thuật!`
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

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'available':
        return {
          label: 'Phòng sạch',
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.4)',
          text: '#34D399',
          dot: '#10B981',
          actionText: 'Dọn lại',
          actionBg: '#1E293B',
          actionColor: '#94A3B8',
          actionIcon: 'sparkles-outline',
        };
      case 'cleaning':
        return {
          label: 'Đang dọn',
          bg: 'rgba(245, 158, 11, 0.14)',
          border: 'rgba(245, 158, 11, 0.5)',
          text: '#FBBF24',
          dot: '#F59E0B',
          actionText: 'DỌN XONG ✨',
          actionBg: '#10B981',
          actionColor: '#0A0F1D',
          actionIcon: 'checkmark-circle',
        };
      case 'occupied':
        return {
          label: 'Có khách',
          bg: 'rgba(59, 130, 246, 0.12)',
          border: 'rgba(59, 130, 246, 0.4)',
          text: '#60A5FA',
          dot: '#3B82F6',
          actionText: 'Vào dọn',
          actionBg: '#1E293B',
          actionColor: '#93C5FD',
          actionIcon: 'bed-outline',
        };
      case 'maintenance':
        return {
          label: 'Bảo trì',
          bg: 'rgba(239, 68, 68, 0.14)',
          border: 'rgba(239, 68, 68, 0.4)',
          text: '#F87171',
          dot: '#EF4444',
          actionText: 'Chờ sửa',
          actionBg: 'transparent',
          actionColor: '#EF4444',
          actionIcon: 'construct-outline',
        };
      default:
        return {
          label: status,
          bg: '#1E293B',
          border: '#334155',
          text: '#94A3B8',
          dot: '#64748B',
          actionText: 'Cập nhật',
          actionBg: '#1E293B',
          actionColor: '#CBD5E1',
          actionIcon: 'create-outline',
        };
    }
  };

  const formatDateShort = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const renderRoomCard = ({ item }: { item: RoomItem }) => {
    const config = getStatusConfig(item.status);
    const isAvailable = item.status === 'available';
    const isCleaning = item.status === 'cleaning';
    const isOccupied = item.status === 'occupied';
    const isMaintenance = item.status === 'maintenance';

    const currentBk = item.current_booking;
    const recentBk = item.recent_booking;
    const guestName = isOccupied
      ? (currentBk?.guest_name || recentBk?.guest_name)
      : isCleaning
      ? (recentBk?.guest_name || currentBk?.guest_name)
      : null;
    const bookingCode = isOccupied
      ? (currentBk?.booking_code || recentBk?.booking_code)
      : isCleaning
      ? (recentBk?.booking_code || currentBk?.booking_code)
      : null;
    const checkOutDate = currentBk?.check_out_date;

    return (
      <View style={[styles.card, isCleaning && styles.cardHighlightCleaning]}>
        {/* Hàng 1: Số phòng to (Trái) + Trạng thái phòng (Phải) */}
        <View style={styles.cardTopRow}>
          <View style={styles.roomBadge}>
            <Text style={styles.roomNumber}>P.{item.room_number}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: config.bg, borderColor: config.border }]}>
            <View style={[styles.pulseDot, { backgroundColor: config.dot }]} />
            <Text style={[styles.statusPillText, { color: config.text }]}>{config.label}</Text>
          </View>
        </View>

        {/* Hàng 2: Loại phòng & Tầng */}
        <Text style={styles.roomType} numberOfLines={1}>
          Tầng {item.floor} • {item.category_name || 'Phòng tiêu chuẩn'}
        </Text>

        {/* Hàng 3: Khối thông tin khách hàng / Sự cố theo chuẩn PMS Web */}
        {isOccupied ? (
          <View style={styles.guestInfoCardOccupied}>
            <View style={styles.guestNameRow}>
              <Ionicons name="person" size={11} color="#60A5FA" style={{ marginRight: 4 }} />
              <Text style={styles.guestNameText} numberOfLines={1}>
                {guestName || 'Khách lưu trú'}
              </Text>
            </View>
            <View style={styles.guestMetaRow}>
              {bookingCode ? (
                <Text style={styles.bookingCodeBadge}>#{bookingCode}</Text>
              ) : null}
              {checkOutDate ? (
                <Text style={styles.checkoutDateText}>Trả: {formatDateShort(checkOutDate)}</Text>
              ) : null}
            </View>
          </View>
        ) : isCleaning ? (
          <View style={styles.cleaningInfoCard}>
            <View style={styles.guestNameRow}>
              <Ionicons name="sparkles" size={11} color="#FBBF24" style={{ marginRight: 4 }} />
              <Text style={styles.cleaningGuestText} numberOfLines={1}>
                {guestName ? `Khách vừa trả: ${guestName}` : 'Đang chờ dọn dẹp'}
              </Text>
            </View>
            {bookingCode ? (
              <Text style={styles.bookingCodeCleaning}>#{bookingCode}</Text>
            ) : null}
          </View>
        ) : isMaintenance ? (
          <View style={styles.maintenanceInfoCard}>
            <Ionicons name="construct" size={11} color="#EF4444" style={{ marginRight: 4 }} />
            <Text style={styles.maintenanceEquipText} numberOfLines={1}>
              {item.active_maintenance?.equipment_name || 'Đang sửa chữa'}
            </Text>
          </View>
        ) : (
          <View style={styles.availableInfoCard}>
            <Ionicons name="checkmark-circle" size={11} color="#34D399" style={{ marginRight: 4 }} />
            <Text style={styles.availableInfoText} numberOfLines={1}>
              Phòng sạch • Sẵn sàng
            </Text>
          </View>
        )}

        {/* Hàng 4: Dải công cụ tiện ích - PHÂN QUYỀN CHÍNH XÁC THEO TRẠNG THÁI */}
        {isAvailable ? (
          /* PHÒNG TRỐNG: TUYỆT ĐỐI KHÔNG HIỂN THỊ Minibar và Đồ quên! Chỉ hiển thị Báo hỏng thiết bị */
          <View style={styles.cardToolBarSingle}>
            <TouchableOpacity
              style={styles.cardToolBtnSingle}
              onPress={() => openBreakdownModal(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="construct" size={12} color="#EF4444" />
              <Text style={[styles.cardToolBtnText, { color: '#EF4444' }]}>Báo hỏng thiết bị</Text>
            </TouchableOpacity>
          </View>
        ) : isMaintenance ? (
          /* PHÒNG BẢO TRÌ: Chỉ hiện trạng thái kỹ thuật */
          <View style={styles.cardToolBarSingle}>
            <View style={[styles.cardToolBtnSingle, { borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
              <Ionicons name="time" size={12} color="#EF4444" />
              <Text style={[styles.cardToolBtnText, { color: '#EF4444' }]}>Kỹ thuật đang xử lý</Text>
            </View>
          </View>
        ) : (
          /* PHÒNG CÓ KHÁCH HOẶC ĐANG DỌN: Đầy đủ 3 tiện ích Minibar + Đồ quên + Báo hỏng */
          <View style={styles.cardToolBar}>
            <TouchableOpacity
              style={styles.cardToolBtn}
              onPress={() => openMinibarCheck(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="wine" size={12} color="#F59E0B" />
              <Text style={[styles.cardToolBtnText, { color: '#F59E0B' }]}>Minibar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cardToolBtn}
              onPress={() => openLostFoundModal(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="briefcase" size={12} color="#A78BFA" />
              <Text style={[styles.cardToolBtnText, { color: '#A78BFA' }]}>Đồ quên</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cardToolBtn}
              onPress={() => openBreakdownModal(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="construct" size={12} color="#EF4444" />
              <Text style={[styles.cardToolBtnText, { color: '#EF4444' }]}>Báo hỏng</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Hàng 5: Nút hành động 1 chạm trải rộng */}
        {isMaintenance ? (
          <View style={styles.maintenanceBadgeBox}>
            <Ionicons name="construct" size={13} color="#EF4444" style={{ marginRight: 4 }} />
            <Text style={styles.maintenanceBadgeText}>Chờ nghiệm thu</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.actionFullBtn,
              { backgroundColor: config.actionBg },
              isCleaning && styles.btnActionCleaningGlow,
            ]}
            onPress={() => handleToggleCleaning(item)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={config.actionIcon as any}
              size={15}
              color={config.actionColor}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.actionFullBtnText, { color: config.actionColor }]}>
              {config.actionText}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      {/* 1. Header Khách Sạn & Chuông Thông Báo */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandSubtitle}>TA LUXURY HOTEL</Text>
          <Text style={styles.greetingTitle}>
            {user?.first_name ? `Chào ${user.first_name}` : 'Sơ Đồ Buồng Phòng'} 👋
          </Text>
        </View>
        <View style={styles.headerRightActions}>
          <NotificationBell />
          <TouchableOpacity style={styles.refreshCircleBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={18} color="#F59E0B" />
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

      {/* 5. Lưới Phòng (2 cột hiện đại) */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingMessage}>Đang tải sơ đồ phòng...</Text>
        </View>
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

      {/* Modal Báo Hỏng Thiết Bị Sang Kỹ Thuật */}
      <Modal visible={breakdownModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalTopBar}>
              <View>
                <Text style={styles.modalRoomTitle}>Phòng {breakdownRoom?.room_number}</Text>
                <Text style={styles.modalRoomSubtitle}>Báo hỏng thiết bị sang Đội Kỹ thuật</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseCircle}
                onPress={() => setBreakdownModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionLabel}>1. Chọn nhanh thiết bị gặp sự cố:</Text>
              <View style={styles.equipmentChipsWrap}>
                {[
                  'Điều hòa Daikin',
                  'Vòi sen / Nước',
                  'Khóa thẻ từ',
                  'Tủ lạnh Minibar',
                  'Bình nóng lạnh',
                  'Đèn chiếu sáng',
                  'Tivi / Cáp',
                  'Thiết bị khác',
                ].map((eq) => (
                  <TouchableOpacity
                    key={eq}
                    style={[
                      styles.equipmentChip,
                      breakdownEquipment === eq && styles.equipmentChipActive,
                    ]}
                    onPress={() => setBreakdownEquipment(eq)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.equipmentChipText,
                        breakdownEquipment === eq && styles.equipmentChipTextActive,
                      ]}
                    >
                      {eq}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>
                2. Mô tả hiện tượng sự cố (*):
              </Text>
              <TextInput
                style={[styles.modalTextInput, { height: 60 }]}
                placeholder="VD: Điều hòa chảy nước xuống sàn, khóa từ không nhận thẻ..."
                placeholderTextColor="#64748B"
                multiline
                value={breakdownDesc}
                onChangeText={setBreakdownDesc}
              />

              <TouchableOpacity
                style={styles.urgentCheckboxRow}
                onPress={() => setIsUrgent(!isUrgent)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isUrgent ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={isUrgent ? '#EF4444' : '#64748B'}
                />
                <Text style={styles.urgentCheckboxText}>
                  Khẩn cấp (Ưu tiên sửa chữa ngay)
                </Text>
              </TouchableOpacity>

              <View style={styles.breakdownNoticeBox}>
                <Ionicons name="alert-circle" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                <Text style={styles.breakdownNoticeText}>
                  Phòng sẽ tự động chuyển sang "Bảo trì" và phát chuông báo cho Kỹ thuật viên!
                </Text>
              </View>

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
                    <Ionicons name="paper-plane" size={16} color="#0A0F1D" style={{ marginRight: 6 }} />
                    <Text style={styles.breakdownSubmitBtnText}>GỬI SANG ĐỘI KỸ THUẬT</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0A0F1D', // Nền Dark Obsidian cực sâu và sang trọng
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
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
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
  gridContainer: {
    paddingHorizontal: 12,
    paddingBottom: 28,
  },
  gridColumnWrapper: {
    justifyContent: 'space-between',
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
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 13,
    margin: 5,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardHighlightCleaning: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: '#131D2E',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  roomNumber: {
    fontSize: 17,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  cardToolBar: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 10,
  },
  cardToolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 3,
  },
  cardToolBtnText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  cardToolBarSingle: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  cardToolBtnSingle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 6.5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 5,
  },
  guestInfoCardOccupied: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 7,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.22)',
  },
  guestNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  guestNameText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#93C5FD',
    flex: 1,
  },
  guestMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookingCodeBadge: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#60A5FA',
  },
  checkoutDateText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  cleaningInfoCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 7,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  cleaningGuestText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FDE68A',
    flex: 1,
  },
  bookingCodeCleaning: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#F59E0B',
    marginTop: 1,
  },
  maintenanceInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 7,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  maintenanceEquipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FCA5A5',
    flex: 1,
  },
  availableInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 7,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.18)',
  },
  availableInfoText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6EE7B7',
    flex: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  roomType: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 8,
  },
  actionFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: 11,
  },
  btnActionCleaningGlow: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  actionFullBtnText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  maintenanceBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    height: 38,
    borderRadius: 11,
  },
  maintenanceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 22,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    maxHeight: '85%',
  },
  modalTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalRoomTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  modalRoomSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F59E0B',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  minibarItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  minibarName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  minibarPrice: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0F1D',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepperBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
  },
  stepperValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#F8FAFC',
    paddingHorizontal: 12,
  },
  damageCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  damageCheckboxText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalTextInput: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    color: '#F8FAFC',
    fontSize: 13,
    marginTop: 8,
  },
  modalConfirmBtn: {
    backgroundColor: '#F59E0B',
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalConfirmBtnText: {
    color: '#0A0F1D',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  equipmentChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  equipmentChip: {
    backgroundColor: '#0A0F1D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  equipmentChipActive: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  equipmentChipText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
  },
  equipmentChipTextActive: {
    color: '#FCA5A5',
  },
  urgentCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  urgentCheckboxText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '700',
    marginLeft: 8,
  },
  breakdownNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  breakdownNoticeText: {
    fontSize: 11,
    color: '#FDE68A',
    flex: 1,
    lineHeight: 15,
  },
  breakdownSubmitBtn: {
    backgroundColor: '#EF4444',
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  breakdownSubmitBtnText: {
    color: '#0A0F1D',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  imagePreviewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  imagePreview: {
    width: '100%',
    height: 150,
  },
  imagePreviewOverlay: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    gap: 8,
  },
  imageActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  imageActionBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  photoPickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 12,
  },
  photoPickerBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
    gap: 6,
  },
  photoPickerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A78BFA',
  },
  lostFoundSubmitBtn: {
    backgroundColor: '#8B5CF6',
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  lostFoundSubmitBtnText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
