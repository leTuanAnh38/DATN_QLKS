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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../../components/NotificationBell';
import BookingManagementModal from '../../components/BookingManagementModal';
import CustomerCrmModal from '../../components/CustomerCrmModal';

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
  is_cleaning_requested?: boolean;
  cleaning_request_note?: string;
  cleaning_requested_at?: string;
}

const MAINTENANCE_ISSUE_TYPES = [
  { key: 'ac', label: 'Điều hòa / Thông gió', icon: 'snow', color: '#38BDF8' },
  { key: 'plumbing', label: 'Nước & Vệ sinh', icon: 'water', color: '#60A5FA' },
  { key: 'electric', label: 'Điện & Chiếu sáng', icon: 'flash', color: '#FBBF24' },
  { key: 'electronics', label: 'Điện tử (TV, Tủ lạnh)', icon: 'tv', color: '#A78BFA' },
  { key: 'furniture', label: 'Nội thất & Khóa thẻ', icon: 'key', color: '#34D399' },
  { key: 'other', label: 'Sự cố khác', icon: 'construct', color: '#F472B6' },
];

const EQUIPMENT_SUGGESTIONS: { [key: string]: string[] } = {
  ac: ['Điều hòa Daikin', 'Điều hòa âm trần', 'Điều khiển máy lạnh', 'Quạt hút thông gió'],
  plumbing: ['Vòi sen tắm đứng', 'Bồn cầu / Vòi xịt', 'Bình nóng lạnh', 'Chậu rửa mặt (Lavabo)', 'Ống thoát nước sàn'],
  electric: ['Đèn chiếu sáng chính', 'Đèn ngủ đầu giường', 'Ổ cắm điện / Công tắc', 'Cầu dao điện (Aptomat)'],
  electronics: ['Smart TV / Remote', 'Tủ lạnh Minibar', 'Két sắt điện tử', 'Ấm siêu tốc', 'Máy sấy tóc'],
  furniture: ['Khóa thẻ từ phòng', 'Cửa phòng / Cửa ban công', 'Bàn ghế / Tủ quần áo', 'Giường / Đệm lò xo'],
  other: ['Gương kính nứt', 'Rèm cửa sổ', 'Tường ố / Thấm nước', 'Mùi lạ trong phòng'],
};

export default function HousekeepingScreen() {
  const { user } = useAuth();
  const userRole = user?.role || '';
  const isServiceStaff = userRole === 'service_staff';
  const isTechnician = userRole === 'technician';
  const isManagerOrAdmin = ['admin', 'manager', 'owner'].includes(userRole);

  // Phân quyền chuyên trách chuẩn PMS giống Web:
  // 1. Minibar: Buồng phòng, Lễ tân, Quản lý, Admin (Kỹ thuật & Phục vụ không có quyền)
  const canAccessMinibar = !['technician', 'service_staff', 'cashier'].includes(userRole);

  // 2. Báo đồ bỏ quên: Buồng phòng, Phục vụ phòng, Kỹ thuật viên, Lễ tân, Quản lý, Admin
  const canReportLostItem = !['cashier'].includes(userRole);

  // 3. Đã dọn xong -> Sẵn sàng: CHỈ Buồng phòng, Quản lý, Admin (Phục vụ & Kỹ thuật không được dọn)
  const canMarkCleaned = ['housekeeper', 'manager', 'owner', 'admin'].includes(userRole);

  // 4. Báo hỏng thiết bị: Buồng phòng, Phục vụ, Kỹ thuật, Lễ tân, Quản lý, Admin
  const canReportMaintenance = !['cashier'].includes(userRole);

  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFloor, setFilterFloor] = useState<number | 'all'>('all');
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

  // Modal Báo hỏng thiết bị sang Kỹ thuật (Chuẩn PMS Khách Sạn)
  const [breakdownModalVisible, setBreakdownModalVisible] = useState(false);
  const [breakdownRoom, setBreakdownRoom] = useState<RoomItem | null>(null);
  const [breakdownIssueType, setBreakdownIssueType] = useState('ac');
  const [breakdownEquipment, setBreakdownEquipment] = useState('Điều hòa Daikin');
  const [breakdownDesc, setBreakdownDesc] = useState('');
  const [breakdownPartsReplaced, setBreakdownPartsReplaced] = useState('');
  const [breakdownCost, setBreakdownCost] = useState('');
  const [isGuestFault, setIsGuestFault] = useState(false);
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

    // Tự động đồng bộ ngầm mỗi 8 giây (không kích hoạt lại spinner loading)
    const interval = setInterval(() => {
      fetchRooms();
    }, 8000);

    return () => clearInterval(interval);
  }, [fetchRooms]);

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
            try {
              const res = await apiClient.post(`/rooms/admin/rooms/${room.id}/complete-cleaning/`);
              if (res.data.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                fetchRooms();
              }
            } catch (err: any) {
              const msg = err.response?.data?.message || 'Không thể cập nhật.';
              Alert.alert('Lỗi', msg);
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
    setIsUrgent(false);
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
        priority: isUrgent ? 'high' : 'medium',
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
    const isInspectionRequested = item.latest_minibar_check?.status === 'requested';

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isCleaning && styles.cardHighlightCleaning,
          isInspectionRequested && styles.cardHighlightInspection,
        ]}
        onPress={() => openRoomDetail(item)}
        activeOpacity={0.85}
      >
        {/* Hàng 1: Số phòng to + Badge tầng (Trái) + Trạng thái phòng (Phải) */}
        <View style={styles.cardTopRow}>
          <View style={styles.roomBadge}>
            <Text style={styles.roomNumber}>P.{item.room_number}</Text>
            <View style={styles.floorPill}>
              <Text style={styles.floorPillText}>{item.floor}F</Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: config.bg, borderColor: config.border }]}>
            <View style={[styles.pulseDot, { backgroundColor: config.dot }]} />
            <Text style={[styles.statusPillText, { color: config.text }]} numberOfLines={1} ellipsizeMode="tail">
              {config.label}
            </Text>
          </View>
        </View>

        {/* Hàng 2: Hạng phòng (gọn gàng, thanh lịch) */}
        <Text style={styles.roomType} numberOfLines={1}>
          {item.category_name || 'Phòng tiêu chuẩn'}
        </Text>

        {/* Cảnh báo Lễ tân đợi kiểm tra Minibar (Check-out) - Chỉ Buồng phòng & Quản lý */}
        {canAccessMinibar && isInspectionRequested && (
          <TouchableOpacity
            style={styles.inspectionAlertBanner}
            onPress={() => openMinibarCheck(item)}
            activeOpacity={0.8}
          >
            <View style={styles.inspectionAlertHeader}>
              <View style={styles.inspectionPulseBadge}>
                <Ionicons name="notifications" size={10} color="#FFF" style={{ marginRight: 3 }} />
                <Text style={styles.inspectionPulseText}>CHECK-OUT</Text>
              </View>
              <Text style={styles.inspectionActionText}>Kiểm ngay ⚡</Text>
            </View>
            <Text style={styles.inspectionSubText} numberOfLines={1}>Lễ tân đang đợi quyết toán</Text>
          </TouchableOpacity>
        )}

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
            {item.is_cleaning_requested && (
              <View style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.5)', borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 5, flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="sparkles" size={12} color="#38BDF8" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 10, color: '#38BDF8', fontWeight: '700', flex: 1 }} numberOfLines={1}>
                  🧹 Yêu cầu dọn: {item.cleaning_request_note || 'Dọn phòng lưu trú'}
                </Text>
              </View>
            )}
          </View>
        ) : isCleaning ? (
          <View style={styles.cleaningInfoCard}>
            <View style={styles.guestNameRow}>
              <Ionicons name="sparkles" size={11} color="#FBBF24" style={{ marginRight: 4 }} />
              <Text style={styles.cleaningGuestText} numberOfLines={1}>
                {guestName ? `Khách: ${guestName}` : 'Đang chờ dọn dẹp'}
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
              {item.active_maintenance?.equipment_name || 'Đang bảo trì'}
            </Text>
          </View>
        ) : (
          <View style={styles.availableInfoCard}>
            <Ionicons name="checkmark-circle" size={11} color="#34D399" style={{ marginRight: 4 }} />
            <Text style={styles.availableInfoText} numberOfLines={1}>
              Sẵn sàng đón khách
            </Text>
          </View>
        )}

        {/* Hàng 4: Dải thao tác nghiệp vụ tinh gọn & phân quyền chính xác */}
        {isMaintenance ? (
          <View style={styles.cardToolBarSingle}>
            <View style={[styles.cardToolBtnSingle, { borderColor: 'rgba(239, 68, 68, 0.25)', backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}>
              <Ionicons name="time" size={12} color="#EF4444" />
              <Text style={[styles.cardToolBtnTextSingle, { color: '#EF4444' }]}>Kỹ thuật đang xử lý</Text>
            </View>
          </View>
        ) : isAvailable ? (
          /* PHÒNG SẠCH / TRỐNG: Chỉ hiển thị nút Báo hỏng thiết bị (Tuyệt đối không có Minibar và Đồ quên vì phòng trống không có khách!) */
          <View style={styles.cardToolBarSingle}>
            <TouchableOpacity
              style={styles.cardToolBtnSingle}
              onPress={() => openBreakdownModal(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="construct" size={12} color="#EF4444" />
              <Text style={[styles.cardToolBtnTextSingle, { color: '#EF4444' }]}>Báo hỏng thiết bị</Text>
            </TouchableOpacity>
          </View>
        ) : isCleaning && canMarkCleaned ? (
          /* BUỒNG PHÒNG ĐANG DỌN: Dọn xong 1 chạm + Hàng công cụ */
          <View style={styles.actionGroupCleaning}>
            <View style={styles.cardToolBar}>
              <TouchableOpacity
                style={styles.cardToolBtn}
                onPress={() => openMinibarCheck(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="wine" size={13} color="#F59E0B" />
                <Text style={[styles.cardToolBtnText, { color: '#F59E0B' }]} numberOfLines={1}>Minibar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardToolBtn}
                onPress={() => openLostFoundModal(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="briefcase" size={13} color="#A78BFA" />
                <Text style={[styles.cardToolBtnText, { color: '#A78BFA' }]} numberOfLines={1}>Đồ quên</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardToolBtn}
                onPress={() => openBreakdownModal(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="construct" size={13} color="#EF4444" />
                <Text style={[styles.cardToolBtnText, { color: '#EF4444' }]} numberOfLines={1}>Báo hỏng</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.actionFullBtn, { backgroundColor: '#10B981' }]}
              onPress={() => handleToggleCleaning(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={13} color="#0A0F1D" style={{ marginRight: 4 }} />
              <Text style={[styles.actionFullBtnText, { color: '#0A0F1D' }]}>Đã dọn xong ✨</Text>
            </TouchableOpacity>
          </View>
        ) : canAccessMinibar ? (
          /* BUỒNG PHÒNG (PHÒNG CÓ KHÁCH): 3 nút tiện ích chuẩn web + Nút Dọn phòng nếu khách yêu cầu */
          <View>
            <View style={styles.cardToolBar}>
              <TouchableOpacity
                style={styles.cardToolBtn}
                onPress={() => openMinibarCheck(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="wine" size={13} color="#F59E0B" />
                <Text style={[styles.cardToolBtnText, { color: '#F59E0B' }]} numberOfLines={1}>Minibar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardToolBtn}
                onPress={() => openLostFoundModal(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="briefcase" size={13} color="#A78BFA" />
                <Text style={[styles.cardToolBtnText, { color: '#A78BFA' }]} numberOfLines={1}>Đồ quên</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardToolBtn}
                onPress={() => openBreakdownModal(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="construct" size={13} color="#EF4444" />
                <Text style={[styles.cardToolBtnText, { color: '#EF4444' }]} numberOfLines={1}>Báo hỏng</Text>
              </TouchableOpacity>
            </View>
            {item.is_cleaning_requested && (
              <TouchableOpacity
                style={[styles.actionFullBtn, { backgroundColor: '#38BDF8', marginTop: 6 }]}
                onPress={() => handleCompleteMakeUpCleaning(item)}
                activeOpacity={0.8}
              >
                <Ionicons name="sparkles" size={13} color="#0A0F1D" style={{ marginRight: 4 }} />
                <Text style={[styles.actionFullBtnText, { color: '#0A0F1D', fontWeight: 'bold' }]}>
                  Đã dọn xong phòng khách ở ✨
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* PHỤC VỤ (PHÒNG CÓ KHÁCH / ĐANG DỌN): 2 Nút Báo đồ quên & Báo hỏng */
          <View style={styles.cardToolBar}>
            <TouchableOpacity
              style={styles.cardToolBtn}
              onPress={() => openLostFoundModal(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="briefcase" size={13} color="#A78BFA" />
              <Text style={[styles.cardToolBtnText, { color: '#A78BFA' }]} numberOfLines={1}>Đồ quên</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardToolBtn}
              onPress={() => openBreakdownModal(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="construct" size={13} color="#EF4444" />
              <Text style={[styles.cardToolBtnText, { color: '#EF4444' }]} numberOfLines={1}>Báo hỏng</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

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

              {/* 7. Mức độ ưu tiên khẩn cấp */}
              <TouchableOpacity
                style={[styles.urgentCheckboxCard, isUrgent && styles.urgentCheckboxCardActive]}
                onPress={() => {
                  setIsUrgent(!isUrgent);
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isUrgent ? 'alert-circle' : 'square-outline'}
                  size={20}
                  color={isUrgent ? '#EF4444' : '#64748B'}
                />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={[styles.urgentCheckboxTitle, isUrgent && { color: '#EF4444' }]}>
                    SỰ CỐ KHẨN CẤP (Ưu tiên sửa chữa ngay)
                  </Text>
                  <Text style={styles.urgentCheckboxDesc}>
                    Bắn thông báo cảnh báo đỏ âm lượng cao tới toàn bộ Kỹ thuật viên.
                  </Text>
                </View>
              </TouchableOpacity>

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
    fontSize: 20,
    fontWeight: '900',
    color: '#F8FAFC',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  refreshCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fixedFilterBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 8,
  },
  fixedFilterCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 7,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
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
    borderRadius: 16,
    padding: 10,
    margin: 5,
    borderWidth: 1,
    borderColor: '#1F2937',
    justifyContent: 'space-between',
  },
  cardHighlightCleaning: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: '#131D2E',
  },
  cardHighlightInspection: {
    borderColor: '#F59E0B',
    borderWidth: 2,
    backgroundColor: '#19150E',
  },
  urgentInspectionBar: {
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  urgentInspectionBarActive: {
    backgroundColor: '#F59E0B',
  },
  urgentInspectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  urgentBellIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  urgentInspectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FBBF24',
  },
  urgentInspectionSubtitle: {
    fontSize: 10,
    color: '#CBD5E1',
    marginTop: 1,
  },
  urgentInspectionBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  urgentInspectionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
  },
  inspectionAlertBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.6)',
    borderRadius: 10,
    padding: 7,
    marginTop: 6,
    marginBottom: 6,
  },
  inspectionAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inspectionPulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  inspectionPulseText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.3,
  },
  inspectionActionText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FBBF24',
  },
  inspectionSubText: {
    fontSize: 9,
    color: '#E2E8F0',
    marginTop: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 3,
    flexShrink: 0,
  },
  roomNumber: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.2,
  },
  floorPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 3.5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  floorPillText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FBBF24',
  },
  cardToolBar: {
    flexDirection: 'row',
    gap: 4,
  },
  cardToolBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 40,
  },
  cardToolBtnText: {
    fontSize: 8.5,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  cardToolBarSingle: {
    flexDirection: 'row',
  },
  cardToolBtnSingle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  cardToolBtnTextSingle: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  actionGroupCleaning: {
    gap: 6,
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
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 7,
    borderWidth: 1,
    flexShrink: 1,
  },
  pulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 3.5,
  },
  statusPillText: {
    fontSize: 9.5,
    fontWeight: '700',
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
  modalCardLarge: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    maxHeight: '92%',
  },
  modalIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  occupiedNoticeBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  occupiedNoticeGuest: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
  },
  occupiedNoticeCode: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FDE68A',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  occupiedNoticeSub: {
    fontSize: 10.5,
    color: '#CBD5E1',
    marginTop: 4,
    lineHeight: 14,
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
  equipmentChipText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
  },
  issueTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  issueTypeCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  issueTypeCardActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#F59E0B',
  },
  issueTypeText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    flex: 1,
  },
  modalTextInputSingle: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    marginTop: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  suggestionTitle: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '700',
  },
  suggestionChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  suggestionChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
  },
  suggestionChipText: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  suggestionChipTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  costFaultBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginTop: 14,
  },
  faultCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  faultCheckboxTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  faultCheckboxSub: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 14,
  },
  costInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 4,
  },
  costInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 10,
  },
  costInput: {
    flex: 1,
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '900',
    paddingVertical: 6,
  },
  costCurrencyUnit: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
  },
  urgentCheckboxCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 14,
  },
  urgentCheckboxCardActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#EF4444',
  },
  urgentCheckboxTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
  },
  urgentCheckboxDesc: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 14,
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
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  detailModalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 25,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  detailRoomTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginRight: 10,
  },
  detailStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  detailStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  detailRoomSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  detailCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailAlertBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  detailAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
  },
  detailAlertSub: {
    fontSize: 11,
    color: '#E2E8F0',
    marginBottom: 10,
  },
  detailAlertActionBtn: {
    backgroundColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  detailAlertActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0A0F1D',
  },
  detailSectionBox: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
    marginBottom: 14,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0',
    marginLeft: 6,
    flex: 1,
  },
  detailBkStatusBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  detailBkStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#60A5FA',
  },
  detailInfoGrid: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  detailValue: {
    fontSize: 12,
    color: '#F1F5F9',
  },
  detailValueBold: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  detailValueCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  detailDescText: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 2,
    fontStyle: 'italic',
  },
  detailEmptyText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  detailActionsHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailActionsGrid: {
    gap: 8,
    marginBottom: 10,
  },
  detailActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  detailActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  detailToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  detailToolBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  maintenanceIsolatedBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    padding: 14,
    marginBottom: 10,
  },
  maintenanceIsolatedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EF4444',
  },
  maintenanceIsolatedDesc: {
    fontSize: 11.5,
    color: '#CBD5E1',
    lineHeight: 18,
    marginTop: 4,
  },
  maintenanceGoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  maintenanceGoBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A0F1D',
  },
  floorFilterWrapper: {
    marginBottom: 8,
    marginHorizontal: 12,
  },
  floorScrollContent: {
    gap: 6,
    paddingRight: 8,
  },
  floorChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  floorChipActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
  },
  floorChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  floorChipTextActive: {
    color: '#F59E0B',
  },
  minibarTotalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    marginBottom: 10,
  },
  minibarTotalLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  minibarTotalSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  minibarTotalValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FBBF24',
  },
  headerShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    gap: 3,
  },
  headerShortcutText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#F59E0B',
  },
  detailCrmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 10,
  },
  detailCrmBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0F1D',
  },
});
