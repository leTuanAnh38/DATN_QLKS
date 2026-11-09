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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../../api/client';
import { useFocusPolling } from '../../hooks/use-focus-polling';
import {
  MAINTENANCE_ISSUE_TYPES,
  EQUIPMENT_SUGGESTIONS,
  PARTS_SUGGESTIONS,
  getRoomStatusColor,
  getRoomStatusLabel,
} from '../../constants/maintenance';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme } from '../../contexts/ThemeContext';
import NotificationBell from '../../components/NotificationBell';
import { MaintenanceListSkeleton } from '../../components/SkeletonLoader';
import { enqueueOfflineAction } from '../../services/offlineQueue';
import {
  MaintenanceTicketCard,
  MaintenanceTicket,
} from '../../components/maintenance/MaintenanceTicketCard';


export default function MaintenanceScreen() {
  const { user } = useAuth();
  const { colors, isDark, hotelStars, hotelName } = useAppTheme();
  // Khớp web (RoomManagement.canCompleteMaintenance): chỉ Kỹ thuật & quản lý mới được nghiệm thu phiếu
  const canCompleteMaintenance = Boolean(
    user?.is_superuser || ['technician', 'admin', 'owner', 'manager'].includes(user?.role || '')
  );
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('fixing');
  const [selectedIssueType, setSelectedIssueType] = useState<string>('all');
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Modal hoàn tất sửa chữa
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<MaintenanceTicket | null>(null);
  const [partsReplaced, setPartsReplaced] = useState('');
  const [cost, setCost] = useState('');
  const [note, setNote] = useState('');
  const [isGuestFault, setIsGuestFault] = useState(false);
  const [completeEvidenceImage, setCompleteEvidenceImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal Hủy phiếu bảo trì / Báo nhầm
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedCancelTicket, setSelectedCancelTicket] = useState<MaintenanceTicket | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Modal Báo hỏng thiết bị mới (Kỹ thuật viên tự tạo phiếu bảo trì)
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [roomsList, setRoomsList] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [roomFilterText, setRoomFilterText] = useState('');
  const [equipmentName, setEquipmentName] = useState('Điều hòa Daikin');
  const [issueType, setIssueType] = useState('ac');
  const [createPriority, setCreatePriority] = useState<'urgent' | 'high' | 'normal'>('normal');
  const [breakdownDesc, setBreakdownDesc] = useState('');
  const [createPartsReplaced, setCreatePartsReplaced] = useState('');
  const [createCost, setCreateCost] = useState('');
  const [createIsGuestFault, setCreateIsGuestFault] = useState(false);
  const [createEvidenceImage, setCreateEvidenceImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const selectedRoom = useMemo(() => {
    return roomsList.find((r) => r.id === selectedRoomId) || null;
  }, [roomsList, selectedRoomId]);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await apiClient.get('/rooms/maintenance-tickets/');
      const list = res.data.results || res.data.tickets || res.data.data || res.data || [];
      setTickets(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.warn('Lỗi tải phiếu bảo trì:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchTickets();
  }, [fetchTickets]);

  // Real-time polling 6 giây đồng bộ hiện trường (chỉ khi tab hiển thị & app ở foreground)
  useFocusPolling(fetchTickets, 6000);

  const onRefresh = () => {
    setRefreshing(true);
    setVisibleCount(15);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchTickets();
  };

  // KPI stats
  const stats = useMemo(() => {
    const total = tickets.length;
    const fixing = tickets.filter((t) => t.status === 'fixing').length;
    const completed = tickets.filter((t) => t.status === 'completed').length;
    const cancelled = tickets.filter((t) => t.status === 'cancelled').length;
    return { total, fixing, completed, cancelled };
  }, [tickets]);

  // Danh sách các tầng thực tế có sự cố phát sinh
  const availableFloors = useMemo(() => {
    const floorsSet = new Set<string>();
    tickets.forEach((t) => {
      const fl = t.room_floor ? String(t.room_floor) : (t.room_number && t.room_number.length >= 3 ? t.room_number.slice(0, -2) : null);
      if (fl) floorsSet.add(fl);
    });
    return Array.from(floorsSet).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [tickets]);

  // Bộ lọc
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      let matchFilter = true;
      if (filterStatus === 'fixing') {
        matchFilter = t.status === 'fixing';
      } else if (filterStatus === 'completed') {
        matchFilter = t.status === 'completed';
      } else if (filterStatus === 'cancelled') {
        matchFilter = t.status === 'cancelled';
      }

      if (selectedIssueType !== 'all') {
        if (t.issue_type !== selectedIssueType) {
          matchFilter = false;
        }
      }

      if (selectedFloor !== 'all') {
        const tFloor = t.room_floor ? String(t.room_floor) : (t.room_number && t.room_number.length >= 3 ? t.room_number.slice(0, -2) : null);
        if (tFloor !== selectedFloor) {
          matchFilter = false;
        }
      }

      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        (t.room_number && t.room_number.toLowerCase().includes(q)) ||
        (t.equipment_name && t.equipment_name.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.ticket_code && t.ticket_code.toLowerCase().includes(q)) ||
        (t.guest_name && t.guest_name.toLowerCase().includes(q));

      return matchFilter && matchSearch;
    });
  }, [tickets, filterStatus, selectedIssueType, selectedFloor, searchQuery]);

  // Infinite Scroll
  const [visibleCount, setVisibleCount] = useState(15);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setVisibleCount(15);
  }, [filterStatus, selectedIssueType, selectedFloor, searchQuery]);

  const displayedTickets = useMemo(() => {
    return filteredTickets.slice(0, visibleCount);
  }, [filteredTickets, visibleCount]);

  const handleLoadMore = () => {
    if (loadingMore || visibleCount >= filteredTickets.length) return;
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 15, filteredTickets.length));
      setLoadingMore(false);
    }, 250);
  };

  const renderFooter = () => {
    if (filteredTickets.length <= 15) return <View style={{ height: 20 }} />;
    if (loadingMore) {
      return (
        <View style={styles.loadMoreFooter}>
          <ActivityIndicator size="small" color="#F59E0B" />
          <Text style={styles.loadMoreText}>Đang tải thêm phiếu sửa chữa cũ...</Text>
        </View>
      );
    }
    if (visibleCount >= filteredTickets.length) {
      return (
        <View style={styles.endOfListFooter}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.endOfListText}>Đã hiển thị toàn bộ {filteredTickets.length} phiếu</Text>
        </View>
      );
    }
    return (
      <View style={styles.endOfListFooter}>
        <Text style={styles.loadMoreHintText}>
          Đang xem {visibleCount}/{filteredTickets.length} phiếu • Cuộn xuống để xem thêm
        </Text>
      </View>
    );
  };

  const openCompleteModal = (ticket: MaintenanceTicket) => {
    if (!canCompleteMaintenance) {
      Alert.alert('Không có quyền', 'Nghiệp vụ nghiệm thu & bàn giao phiếu bảo trì thuộc thẩm quyền của Kỹ thuật viên hoặc Quản lý.');
      return;
    }
    setSelectedTicket(ticket);
    setPartsReplaced(ticket.parts_replaced || '');
    setCost(ticket.cost ? String(ticket.cost) : '0');
    setNote('');
    setIsGuestFault(Boolean(ticket.is_guest_fault));
    setCompleteEvidenceImage(null);
    setCompleteModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const takeCompletePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Cần cấp quyền', 'Vui lòng cấp quyền Camera để chụp ảnh nghiệm thu hoàn tất.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.6,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setCompleteEvidenceImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở camera:', e);
    }
  };

  const pickCompleteLibrary = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Cần cấp quyền', 'Vui lòng cấp quyền Thư viện ảnh để chọn ảnh.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.6,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setCompleteEvidenceImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở thư viện ảnh:', e);
    }
  };

  const handleComplete = async () => {
    if (!selectedTicket || submitting) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const formData = new FormData();
      formData.append('parts_replaced', partsReplaced);
      formData.append('cost', String(parseInt(cost || '0', 10)));
      formData.append('note', note);
      formData.append('is_guest_fault', String(isGuestFault));

      if (completeEvidenceImage) {
        const uri = completeEvidenceImage.uri;
        const filename = uri.split('/').pop() || 'photo_after.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        // @ts-ignore
        formData.append('image_after', {
          uri: uri,
          name: filename,
          type: type,
        });
      }

      const res = await apiClient.post(`/rooms/maintenance-tickets/${selectedTicket.id}/complete/`, formData);

      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Đã hoàn tất sửa chữa',
          res.data.message || 'Phòng đã được chuyển sang Buồng phòng dọn dẹp để sẵn sàng đón khách!'
        );
        setCompleteModalVisible(false);
        fetchTickets();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể hoàn thành phiếu bảo trì.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Kỹ thuật viên nhận xử lý phiếu sự cố (Chống bấm đúp)
  const handleClaimTicket = async (ticket: MaintenanceTicket) => {
    if (actionLoadingId === ticket.id) return;
    setActionLoadingId(ticket.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiClient.post(`/rooms/maintenance-tickets/${ticket.id}/claim/`);
      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Nhận việc thành công', res.data.message || `Bạn đã nhận phụ trách xử lý phiếu #${ticket.ticket_code}`);
        fetchTickets();
      }
    } catch (err: any) {
      if (!err.response) {
        await enqueueOfflineAction({
          description: `Phiếu #${ticket.ticket_code} (P.${ticket.room_number || 'Khách sạn'}): Nhận sửa chữa`,
          url: `/rooms/maintenance-tickets/${ticket.id}/claim/`,
          method: 'POST',
        });

        // Optimistic UI update
        const myName = user?.first_name || user?.username || 'Tôi';
        setTickets((prev) =>
          prev.map((t) => (t.id === ticket.id ? { ...t, technician_name: myName } : t))
        );

        Alert.alert(
          'Đã lưu ngoại tuyến',
          `Mất kết nối máy chủ! Thao tác nhận phiếu #${ticket.ticket_code} đã được lưu vào Hàng đợi và sẽ tự động gửi khi có mạng trở lại.`
        );
      } else {
        const msg = err.response?.data?.message || 'Không thể nhận xử lý phiếu bảo trì.';
        Alert.alert('Lỗi', msg);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Mở modal Hủy phiếu / Báo sai
  const openCancelModal = (ticket: MaintenanceTicket) => {
    setSelectedCancelTicket(ticket);
    setCancelReason('');
    setCancelModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Xác nhận hủy phiếu bảo trì
  const handleCancelTicket = async () => {
    if (!selectedCancelTicket) return;
    setSubmittingCancel(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiClient.post(`/rooms/maintenance-tickets/${selectedCancelTicket.id}/cancel/`, {
        reason: cancelReason.trim(),
      });
      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Đã hủy phiếu bảo trì',
          res.data.message || `Phiếu #${selectedCancelTicket.ticket_code} đã được hủy và phòng đã khôi phục trạng thái ban đầu.`
        );
        setCancelModalVisible(false);
        fetchTickets();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể hủy phiếu bảo trì.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmittingCancel(false);
    }
  };

  const fetchRoomsList = async () => {
    try {
      setLoadingRooms(true);
      const res = await apiClient.get('/rooms/admin/rooms/');
      const list = res.data.results || res.data.rooms || res.data.data || res.data || [];
      const roomsArr = Array.isArray(list) ? list : [];
      setRoomsList(roomsArr);
      if (roomsArr.length > 0 && !selectedRoomId) {
        setSelectedRoomId(roomsArr[0].id);
        if (roomsArr[0].status === 'occupied') {
          setCreateIsGuestFault(true);
          setCreatePriority('urgent');
        }
      }
    } catch (e) {
      console.warn('Lỗi lấy danh sách phòng:', e);
    } finally {
      setLoadingRooms(false);
    }
  };

  const openCreateModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEquipmentName('Điều hòa Daikin');
    setIssueType('ac');
    setBreakdownDesc('');
    setCreatePartsReplaced('');
    setCreateCost('');
    setRoomFilterText('');
    setCreateEvidenceImage(null);
    setCreateModalVisible(true);
    if (roomsList.length === 0) {
      fetchRoomsList();
    } else {
      const cur = roomsList.find((r) => r.id === selectedRoomId);
      setCreateIsGuestFault(cur?.status === 'occupied');
      setCreatePriority(cur?.status === 'occupied' ? 'urgent' : 'normal');
    }
  };

  const takeCreatePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Cần cấp quyền', 'Vui lòng cấp quyền Camera để chụp ảnh hiện trường hư hại.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.6,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setCreateEvidenceImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở camera:', e);
    }
  };

  const pickCreateLibrary = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Cần cấp quyền', 'Vui lòng cấp quyền Thư viện ảnh để chọn ảnh.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.6,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setCreateEvidenceImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở thư viện ảnh:', e);
    }
  };

  const handleSelectRoom = (room: any) => {
    setSelectedRoomId(room.id);
    setCreateIsGuestFault(room.status === 'occupied');
    setCreatePriority(room.status === 'occupied' ? 'urgent' : 'normal');
    Haptics.selectionAsync();
  };

  const handleCreateTicket = async () => {
    if (!selectedRoomId) {
      Alert.alert('Chưa chọn phòng', 'Vui lòng chọn phòng cần bảo trì sửa chữa.');
      return;
    }
    if (!equipmentName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thiết bị bị hư hỏng.');
      return;
    }
    if (!breakdownDesc.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mô tả sự cố hư hỏng.');
      return;
    }

    const parsedCost = parseInt(createCost.replace(/\D/g, '') || '0', 10);
    const activeBooking = selectedRoom?.current_booking;

    setSubmittingCreate(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const formData = new FormData();
      formData.append('room_id', String(selectedRoomId));
      formData.append('equipment_name', equipmentName.trim());
      formData.append('issue_type', issueType);
      formData.append('priority', createPriority);
      formData.append('description', breakdownDesc.trim());
      formData.append('parts_replaced', createPartsReplaced.trim());
      formData.append('cost', String(parsedCost));
      formData.append('is_guest_fault', String(createIsGuestFault));
      if (createIsGuestFault && activeBooking) {
        formData.append('booking_id', String(activeBooking.id));
      }

      if (createEvidenceImage) {
        const uri = createEvidenceImage.uri;
        const filename = uri.split('/').pop() || 'photo_before.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        // @ts-ignore
        formData.append('image_before', {
          uri: uri,
          name: filename,
          type: type,
        });
      }

      const res = await apiClient.post('/rooms/maintenance-tickets/', formData);

      if (res.data.success || res.data.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Đã tạo phiếu bảo trì',
          `Phòng ${selectedRoom?.room_number || ''} đã chuyển sang trạng thái "Bảo trì" & được cách ly!${
            createIsGuestFault && parsedCost > 0
              ? `\nĐã lập mục bồi thường ${parsedCost.toLocaleString('vi-VN')} đ vào tài khoản lưu trú của khách.`
              : ''
          }`
        );
        setCreateModalVisible(false);
        fetchTickets();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể tạo phiếu bảo trì.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmittingCreate(false);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: MaintenanceTicket }) => (
      <MaintenanceTicketCard
        item={item}
        canCompleteMaintenance={canCompleteMaintenance}
        isTechnicianOrManager={canCompleteMaintenance}
        currentUserId={user?.id}
        isLoading={actionLoadingId === item.id}
        onOpenComplete={openCompleteModal}
        onClaimTicket={handleClaimTicket}
        onOpenCancel={openCancelModal}
      />
    ),
    [canCompleteMaintenance, user?.id, actionLoadingId, openCompleteModal, handleClaimTicket, openCancelModal]
  );


  return (
    <SafeAreaView style={[styles.safeContainer, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. Header Khách Sạn */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandSubtitle}>{hotelName.toUpperCase()} • {hotelStars} SAO</Text>
          <Text style={[styles.greetingTitle, { color: colors.text }]}>Kỹ Thuật & Bảo Trì</Text>
        </View>
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.createTicketBtn}
            onPress={openCreateModal}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={16} color="#0A0F1D" style={{ marginRight: 4 }} />
            <Text style={styles.createTicketBtnText}>Báo hỏng</Text>
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

      {/* 2. Dải Bộ Lọc & KPI Cố Định 100% (Không bị trôi trượt khi lướt) */}
      <View style={styles.fixedFilterBar}>
        {[
          { key: 'fixing', label: 'Cần sửa', count: stats.fixing, color: isDark ? '#F87171' : '#DC2626' },
          { key: 'completed', label: 'Đã xong', count: stats.completed, color: isDark ? '#34D399' : '#059669' },
          { key: 'cancelled', label: 'Đã hủy', count: stats.cancelled, color: isDark ? '#94A3B8' : '#64748B' },
          { key: 'all', label: 'Tất cả', count: stats.total, color: isDark ? '#F8FAFC' : '#0F172A' },
        ].map((item) => {
          const isSelected = filterStatus === item.key;
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

      {/* 3. Ô Tìm Kiếm Kết Hợp Nút [Lọc ▾] Gọn Gàng Trên 1 Dòng */}
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
            placeholder="Tìm số phòng, mã phiếu, thiết bị..."
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

        {(() => {
          const activeFilterCount = (selectedFloor !== 'all' ? 1 : 0) + (selectedIssueType !== 'all' ? 1 : 0);
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

      {/* Thanh tóm tắt lọc phụ khi đang thu gọn */}
      {!showFilters && (selectedFloor !== 'all' || selectedIssueType !== 'all') && (
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
              selectedFloor !== 'all' ? `Tầng ${selectedFloor}` : null,
              selectedIssueType !== 'all'
                ? MAINTENANCE_ISSUE_TYPES.find((c) => c.key === selectedIssueType)?.label || selectedIssueType
                : null,
            ]
              .filter(Boolean)
              .join(' • ')}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setSelectedFloor('all');
              setSelectedIssueType('all');
              Haptics.selectionAsync();
            }}
            style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}
          >
            <Ionicons name="close-circle" size={14} color={isDark ? '#FBBF24' : '#B45309'} style={{ marginRight: 3 }} />
            <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#FBBF24' : '#B45309' }}>Bỏ lọc</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 4. Khung Bộ Lọc Mở Rộng (Tầng & Phân Loại Sự Cố - Chỉ hiển thị khi bấm [Lọc ▾]) */}
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
          {/* Chips Lọc Theo Tầng */}
          {availableFloors.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.floorChipsScroll}
            >
              <TouchableOpacity
                style={[
                  styles.floorChip,
                  !isDark && {
                    backgroundColor: selectedFloor === 'all' ? '#0284C7' : '#FFFFFF',
                    borderColor: selectedFloor === 'all' ? '#0284C7' : '#E2E8F0',
                  },
                  selectedFloor === 'all' && isDark && styles.floorChipActive,
                ]}
                onPress={() => {
                  setSelectedFloor('all');
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.floorChipText,
                    !isDark && { color: selectedFloor === 'all' ? '#FFFFFF' : '#475569' },
                    selectedFloor === 'all' && isDark && styles.floorChipTextActive,
                  ]}
                >
                  Tất cả tầng
                </Text>
              </TouchableOpacity>

              {availableFloors.map((fl) => {
                const isSelected = selectedFloor === fl;
                const count = tickets.filter((t) => {
                  const tFl = t.room_floor ? String(t.room_floor) : (t.room_number && t.room_number.length >= 3 ? t.room_number.slice(0, -2) : null);
                  return tFl === fl;
                }).length;
                return (
                  <TouchableOpacity
                    key={fl}
                    style={[
                      styles.floorChip,
                      !isDark && {
                        backgroundColor: isSelected ? '#0284C7' : '#FFFFFF',
                        borderColor: isSelected ? '#0284C7' : '#E2E8F0',
                      },
                      isSelected && isDark && styles.floorChipActive,
                    ]}
                    onPress={() => {
                      setSelectedFloor(fl);
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="layers-outline"
                      size={12}
                      color={isSelected ? '#FFFFFF' : (isDark ? '#94A3B8' : '#64748B')}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.floorChipText,
                        !isDark && { color: isSelected ? '#FFFFFF' : '#475569' },
                        isSelected && { color: '#FFFFFF', fontWeight: '800' },
                      ]}
                    >
                      Tầng {fl} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Chips Phân Loại Sự Cố Thiết Bị */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.issueChipsScroll}
          >
            <TouchableOpacity
              style={[
                styles.issueChip,
                !isDark && {
                  backgroundColor: selectedIssueType === 'all' ? '#F59E0B' : '#FFFFFF',
                  borderColor: selectedIssueType === 'all' ? '#F59E0B' : '#E2E8F0',
                },
                selectedIssueType === 'all' && isDark && styles.issueChipActive,
              ]}
              onPress={() => {
                setSelectedIssueType('all');
                Haptics.selectionAsync();
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.issueChipText,
                  !isDark && { color: selectedIssueType === 'all' ? '#0A0F1D' : '#475569' },
                  selectedIssueType === 'all' && isDark && styles.issueChipTextActive,
                ]}
              >
                Tất cả ({tickets.length})
              </Text>
            </TouchableOpacity>
            {MAINTENANCE_ISSUE_TYPES.map((cat) => {
              const isSelected = selectedIssueType === cat.key;
              const count = tickets.filter((t) => t.issue_type === cat.key).length;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.issueChip,
                    !isDark && {
                      backgroundColor: isSelected ? `${cat.color}22` : '#FFFFFF',
                      borderColor: isSelected ? cat.color : '#E2E8F0',
                    },
                    isSelected && isDark && {
                      backgroundColor: `${cat.color}22`,
                      borderColor: cat.color,
                    },
                  ]}
                  onPress={() => {
                    setSelectedIssueType(cat.key);
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={13}
                    color={isSelected ? cat.color : (isDark ? '#94A3B8' : '#64748B')}
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={[
                      styles.issueChipText,
                      !isDark && { color: isSelected ? cat.color : '#475569' },
                      isSelected && { color: cat.color, fontWeight: '800' },
                    ]}
                  >
                    {cat.label} {count > 0 ? `(${count})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 5. Danh Sách Phiếu Sửa Chữa */}
      {loading ? (
        <MaintenanceListSkeleton />
      ) : filteredTickets.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="construct-outline" size={56} color="#334155" />
          <Text style={styles.emptyTitle}>Không có sự cố nào</Text>
          <Text style={styles.emptySubtitle}>
            Tất cả thiết bị phòng khách sạn đang hoạt động ổn định.
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedTickets}
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

      {/* Modal Nghiệm thu Hoàn tất sửa chữa */}
      <Modal visible={completeModalVisible} transparent animationType="slide" onRequestClose={() => setCompleteModalVisible(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={Keyboard.dismiss}
            />
            <View style={[styles.modalContent, !isDark && { backgroundColor: '#FFFFFF', borderTopColor: '#E2E8F0', shadowColor: '#64748B' }]}>
              <View style={[styles.modalHeader, !isDark && { borderBottomColor: '#F1F5F9' }]}>
                <View>
                  <Text style={[styles.modalTitle, !isDark && { color: '#0F172A' }]}>
                    Nghiệm Thu Phòng {selectedTicket?.room_number}
                  </Text>
                  <Text style={[styles.modalSubtitle, !isDark && { color: '#64748B' }]}>
                    Thiết bị: {selectedTicket?.equipment_name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.modalCloseBtn, !isDark && { backgroundColor: '#F1F5F9' }]}
                  onPress={() => setCompleteModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={20} color={isDark ? "#94A3B8" : "#64748B"} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Ảnh hiện trường ban đầu (nếu có người báo trước) */}
                {selectedTicket?.image_before && (
                  <View style={[styles.initialEvidenceBox, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                    <View style={styles.initialEvidenceHeader}>
                      <Ionicons name="image" size={14} color="#F59E0B" style={{ marginRight: 6 }} />
                      <Text style={[styles.initialEvidenceTitle, !isDark && { color: '#0F172A' }]}>
                        Ảnh hiện trường ban đầu (Buồng phòng gửi):
                      </Text>
                    </View>
                    <Image
                      source={{ uri: selectedTicket.image_before }}
                      style={styles.initialEvidenceImage}
                      resizeMode="cover"
                    />
                  </View>
                )}

                <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Linh kiện / Vật tư đã thay:</Text>
                <TextInput
                  style={[styles.modalInput, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
                  placeholder="VD: Thay tụ quạt Daikin, vòi sen tắm..."
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  value={partsReplaced}
                  onChangeText={setPartsReplaced}
                />

                {/* Gợi ý linh kiện nhanh cho Nghiệm thu */}
                {selectedTicket && PARTS_SUGGESTIONS[selectedTicket.issue_type] && (
                  <View style={[styles.suggestionRow, { marginBottom: 10 }]}>
                    <Text style={[styles.suggestionTitle, !isDark && { color: '#64748B' }]}>Gợi ý vật tư nhanh:</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 6 }}
                    >
                      {PARTS_SUGGESTIONS[selectedTicket.issue_type].map((p) => (
                        <TouchableOpacity
                          key={p}
                          style={[
                            styles.quickEquipChip,
                            !isDark && partsReplaced !== p && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
                            partsReplaced === p && styles.quickEquipChipActive,
                          ]}
                          onPress={() => {
                            setPartsReplaced(p);
                            Haptics.selectionAsync();
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.quickEquipChipText,
                              !isDark && partsReplaced !== p && { color: '#475569' },
                              partsReplaced === p && styles.quickEquipChipTextActive,
                            ]}
                          >
                            + {p}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Chi phí vật tư phát sinh (VNĐ):</Text>
                <TextInput
                  style={[styles.modalInput, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
                  placeholder="0"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  keyboardType="numeric"
                  value={cost}
                  onChangeText={setCost}
                />

                {/* Phân loại trách nhiệm chi phí: Do khách làm hỏng hay hao mòn khách sạn */}
                <TouchableOpacity
                  style={[
                    styles.guestFaultToggleRow,
                    !isDark && !isGuestFault && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                    isGuestFault && styles.guestFaultToggleRowActive,
                  ]}
                  onPress={() => {
                    setIsGuestFault(!isGuestFault);
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isGuestFault ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={isGuestFault ? '#EF4444' : (isDark ? '#64748B' : '#94A3B8')}
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.guestFaultTitle, !isDark && !isGuestFault && { color: '#0F172A' }, isGuestFault && { color: '#F87171' }]}>
                      Do khách làm hư hỏng (Tính phí bồi thường)
                    </Text>
                    <Text style={[styles.guestFaultSubtitle, !isDark && { color: '#64748B' }]}>
                      {isGuestFault
                        ? 'Lưu ý: Phụ phí bồi thường sẽ tự động cộng vào hóa đơn khách tại Lễ tân.'
                        : 'Hao mòn tự nhiên trong vận hành (Khách sạn chịu chi phí bảo trì).'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Ghi chú kiểm tra bàn giao:</Text>
                <TextInput
                  style={[styles.modalInput, { height: 60 }, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
                  placeholder="Thiết bị hoạt động êm, mát, sạch sẽ..."
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  multiline
                  value={note}
                  onChangeText={setNote}
                />

                {/* Ảnh chụp nghiệm thu sau khi sửa chữa */}
                <Text style={[styles.inputLabel, { marginTop: 10 }, !isDark && { color: '#334155' }]}>
                  Ảnh nghiệm thu sau sửa chữa (Bằng chứng hoàn thành):
                </Text>
                {completeEvidenceImage ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: completeEvidenceImage.uri }} style={styles.imagePreview} resizeMode="cover" />
                    <View style={styles.imagePreviewOverlay}>
                      <TouchableOpacity
                        style={styles.imageActionBtn}
                        onPress={takeCompletePhoto}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="camera" size={14} color="#F8FAFC" style={{ marginRight: 4 }} />
                        <Text style={styles.imageActionBtnText}>Chụp lại</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.imageActionBtn, { backgroundColor: '#EF4444' }]}
                        onPress={() => setCompleteEvidenceImage(null)}
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
                      style={[
                        styles.photoPickerBtn,
                        !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                      ]}
                      onPress={takeCompletePhoto}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera" size={20} color={isDark ? '#F59E0B' : '#D97706'} />
                      <Text style={[styles.photoPickerText, !isDark && { color: '#D97706' }]}>
                        Chụp ảnh nghiệm thu
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.photoPickerBtn,
                        !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                      ]}
                      onPress={pickCompleteLibrary}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="images" size={20} color="#0284C7" />
                      <Text style={[styles.photoPickerText, { color: '#0284C7' }]}>Chọn từ thư viện</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={[styles.alertNoteBox, !isDark && { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }]}>
                  <Ionicons name="information-circle" size={18} color="#F59E0B" style={{ marginRight: 8 }} />
                  <Text style={[styles.alertNoteText, !isDark && { color: '#B45309' }]}>
                    Sau khi xác nhận, Phòng {selectedTicket?.room_number} sẽ tự động chuyển sang trạng thái "Đang dọn dẹp" để bộ phận Buồng phòng vào lau dọn sẵn sàng đón khách.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.modalConfirmBtn, submitting && { opacity: 0.6 }]}
                  onPress={handleComplete}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <ActivityIndicator color="#0A0F1D" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="shield-checkmark" size={17} color="#0A0F1D" style={{ marginRight: 6 }} />
                      <Text style={styles.modalConfirmBtnText}>XÁC NHẬN BÀN GIAO PHÒNG</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Báo Hỏng Thiết Bị Mới (Kỹ Thuật Viên Tự Tạo Phiếu) */}
      <Modal visible={createModalVisible} transparent animationType="slide" onRequestClose={() => setCreateModalVisible(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={Keyboard.dismiss}
            />
            <View style={[styles.modalContent, { maxHeight: '90%' }, !isDark && { backgroundColor: '#FFFFFF', borderTopColor: '#E2E8F0', shadowColor: '#64748B' }]}>
              <View style={[styles.modalHeader, !isDark && { borderBottomColor: '#F1F5F9' }]}>
                <View>
                  <Text style={[styles.modalTitle, !isDark && { color: '#0F172A' }]}>Báo Sự Cố Thiết Bị</Text>
                  <Text style={[styles.modalSubtitle, !isDark && { color: '#64748B' }]}>Tạo phiếu bảo trì & cách ly phòng</Text>
                </View>
                <TouchableOpacity
                  style={[styles.modalCloseBtn, !isDark && { backgroundColor: '#F1F5F9' }]}
                  onPress={() => setCreateModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={20} color={isDark ? "#94A3B8" : "#64748B"} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* 1. Chọn phòng */}
              <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>1. Chọn phòng gặp sự cố *:</Text>
              {loadingRooms ? (
                <ActivityIndicator color="#F59E0B" style={{ marginVertical: 8 }} />
              ) : (
                <>
                  <TextInput
                    style={[styles.modalInput, { height: 38, fontSize: 12, marginBottom: 8 }, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
                    placeholder="Lọc số phòng (VD: 101, 202...)"
                    placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                    value={roomFilterText}
                    onChangeText={setRoomFilterText}
                    keyboardType="numeric"
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.roomChipsScroll}
                  >
                    {roomsList
                      .filter((r) =>
                        !roomFilterText ||
                        r.room_number.toLowerCase().includes(roomFilterText.toLowerCase())
                      )
                      .slice(0, 30)
                      .map((r) => {
                        const isSelected = selectedRoomId === r.id;
                        const statusColor = getRoomStatusColor(r.status);
                        return (
                          <TouchableOpacity
                            key={r.id}
                            style={[
                              styles.roomSelectChip,
                              !isDark && !isSelected && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                              isSelected && styles.roomSelectChipActive,
                            ]}
                            onPress={() => handleSelectRoom(r)}
                            activeOpacity={0.7}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <View
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: isSelected ? '#0A0F1D' : statusColor.dot,
                                  marginRight: 5,
                                }}
                              />
                              <Text
                                style={[
                                  styles.roomSelectChipText,
                                  !isDark && !isSelected && { color: '#0F172A' },
                                  isSelected && styles.roomSelectChipTextActive,
                                ]}
                              >
                                P.{r.room_number}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>
                </>
              )}

              {/* Thông tin phòng đã chọn & Cảnh báo khách đang ở */}
              {selectedRoom && (
                <View style={[styles.selectedRoomSummaryCard, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                  <View style={styles.selectedRoomSummaryTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 }}>
                      <View style={[styles.selectedRoomIconWrap, !isDark && { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                        <Ionicons name="bed" size={13} color="#F59E0B" />
                      </View>
                      <Text style={[styles.selectedRoomNumberText, !isDark && { color: '#0F172A' }]}>
                        Phòng {selectedRoom.room_number}
                      </Text>
                      <Text style={[styles.selectedRoomCategoryText, !isDark && { color: '#64748B' }]} numberOfLines={1}>
                        • {selectedRoom.category_name || 'Phòng'} (T.{selectedRoom.floor})
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.selectedRoomStatusBadge,
                        { backgroundColor: getRoomStatusColor(selectedRoom.status).bg },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: getRoomStatusColor(selectedRoom.status).dot },
                        ]}
                      />
                      <Text
                        style={[
                          styles.selectedRoomStatusText,
                          { color: getRoomStatusColor(selectedRoom.status).text },
                        ]}
                      >
                        {selectedRoom.status_display || getRoomStatusLabel(selectedRoom.status)}
                      </Text>
                    </View>
                  </View>

                  {selectedRoom.status === 'occupied' && selectedRoom.current_booking && (
                    <View style={[styles.guestAlertBanner, !isDark && { backgroundColor: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.25)' }]}>
                      <View style={styles.guestAlertHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 }}>
                          <Ionicons name="person" size={12} color="#0284C7" style={{ marginRight: 4 }} />
                          <Text style={[styles.guestAlertTitle, !isDark && { color: '#0369A1' }]} numberOfLines={1}>
                            Khách: {selectedRoom.current_booking.guest_name}
                          </Text>
                        </View>
                        <View style={[styles.guestBookingTag, !isDark && { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)' }]}>
                          <Text style={[styles.guestBookingTagText, !isDark && { color: '#0284C7' }]}>
                            #{selectedRoom.current_booking.booking_code}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                        <Ionicons name="information-circle-outline" size={16} color={isDark ? "#38BDF8" : "#0284C7"} style={{ marginTop: 2 }} />
                        <Text style={[styles.guestAlertNote, { flex: 1, marginTop: 0 }, !isDark && { color: '#0369A1' }]}>
                          Lưu ý: Khách đang lưu trú tại phòng. Vui lòng liên hệ Lễ tân hoặc gõ cửa xin phép trước khi vào sửa chữa.
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Mức độ ưu tiên sự cố */}
              <Text style={[styles.inputLabel, { marginTop: 14 }, !isDark && { color: '#334155' }]}>
                Mức độ khẩn cấp *:
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                {[
                  { key: 'normal', label: 'Bình thường', color: '#10B981' },
                  { key: 'high', label: 'Ưu tiên cao', color: '#F59E0B' },
                  { key: 'urgent', label: 'Khẩn cấp', color: '#EF4444' },
                ].map((p) => {
                  const isSelected = createPriority === p.key;
                  return (
                    <TouchableOpacity
                      key={p.key}
                      style={[
                        styles.prioritySelectChip,
                        !isDark && !isSelected && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                        isSelected && { backgroundColor: `${p.color}20`, borderColor: p.color, borderWidth: 1.5 },
                      ]}
                      onPress={() => {
                        setCreatePriority(p.key as any);
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.prioritySelectChipText,
                          { color: isSelected ? p.color : (isDark ? '#94A3B8' : '#64748B'), fontWeight: isSelected ? '800' : '600' },
                        ]}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 2. Loại sự cố */}
              <Text style={[styles.inputLabel, { marginTop: 14 }, !isDark && { color: '#334155' }]}>2. Phân loại sự cố kỹ thuật *:</Text>
              <View style={styles.issueTypeGrid}>
                {MAINTENANCE_ISSUE_TYPES.map((it) => {
                  const isSelected = issueType === it.key;
                  return (
                    <TouchableOpacity
                      key={it.key}
                      style={[
                        styles.issueTypeGridCard,
                        !isDark && !isSelected && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                        isSelected && { borderColor: it.color, backgroundColor: `${it.color}15` },
                      ]}
                      onPress={() => {
                        setIssueType(it.key);
                        const suggestions = EQUIPMENT_SUGGESTIONS[it.key] || [];
                        if (suggestions.length > 0) {
                          setEquipmentName(suggestions[0]);
                        }
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={it.icon as any}
                        size={14}
                        color={isSelected ? it.color : (isDark ? '#94A3B8' : '#64748B')}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.issueTypeGridLabel,
                          !isDark && !isSelected && { color: '#475569' },
                          isSelected && { color: it.color, fontWeight: '800' },
                        ]}
                        numberOfLines={1}
                      >
                        {it.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 3. Tên thiết bị */}
              <Text style={[styles.inputLabel, { marginTop: 14 }, !isDark && { color: '#334155' }]}>3. Tên thiết bị hỏng *:</Text>
              <TextInput
                style={[styles.modalInput, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
                placeholder="VD: Điều hòa Daikin, Tivi Samsung, Khóa từ..."
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={equipmentName}
                onChangeText={setEquipmentName}
              />
              <View style={styles.suggestionRow}>
                <Text style={[styles.suggestionTitle, !isDark && { color: '#64748B' }]}>Gợi ý nhanh:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {(EQUIPMENT_SUGGESTIONS[issueType] || []).map((eq) => (
                    <TouchableOpacity
                      key={eq}
                      style={[
                        styles.quickEquipChip,
                        !isDark && equipmentName !== eq && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
                        equipmentName === eq && styles.quickEquipChipActive,
                      ]}
                      onPress={() => {
                        setEquipmentName(eq);
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.quickEquipChipText,
                          !isDark && equipmentName !== eq && { color: '#475569' },
                          equipmentName === eq && styles.quickEquipChipTextActive,
                        ]}
                      >
                        + {eq}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* 4. Mô tả chi tiết hiện tượng */}
              <Text style={[styles.inputLabel, { marginTop: 14 }, !isDark && { color: '#334155' }]}>4. Mô tả chi tiết sự cố & Hiện tượng *:</Text>
              <TextInput
                style={[styles.modalInput, { height: 70 }, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
                placeholder="Hiện tượng: chảy nước, không mát, chập điện, có tiếng kêu to..."
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                multiline
                value={breakdownDesc}
                onChangeText={setBreakdownDesc}
              />

              {/* 5. Phụ tùng / Vật tư thay thế mang theo dự kiến */}
              <Text style={[styles.inputLabel, { marginTop: 14 }, !isDark && { color: '#334155' }]}>5. Phụ tùng / Dụng cụ mang theo dự kiến:</Text>
              <TextInput
                style={[styles.modalInput, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
                placeholder="VD: 1 Tụ kích 35uF, 1 Dây cấp inox, 2 Pin AAA, Cầu chì 10A..."
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={createPartsReplaced}
                onChangeText={setCreatePartsReplaced}
              />
              {PARTS_SUGGESTIONS[issueType] && (
                <View style={[styles.suggestionRow, { marginBottom: 6 }]}>
                  <Text style={[styles.suggestionTitle, !isDark && { color: '#64748B' }]}>Gợi ý vật tư:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6 }}
                  >
                    {PARTS_SUGGESTIONS[issueType].map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.quickEquipChip,
                          !isDark && createPartsReplaced !== p && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
                          createPartsReplaced === p && styles.quickEquipChipActive,
                        ]}
                        onPress={() => {
                          setCreatePartsReplaced(p);
                          Haptics.selectionAsync();
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.quickEquipChipText,
                            !isDark && createPartsReplaced !== p && { color: '#475569' },
                            createPartsReplaced === p && styles.quickEquipChipTextActive,
                          ]}
                        >
                          + {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* 6. Phân loại trách nhiệm chi phí & Đền bù */}
              <View style={[styles.costFaultBox, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                <TouchableOpacity
                  style={styles.faultCheckboxRow}
                  onPress={() => {
                    setCreateIsGuestFault(!createIsGuestFault);
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={createIsGuestFault ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={createIsGuestFault ? '#F59E0B' : (isDark ? '#64748B' : '#94A3B8')}
                  />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={[styles.faultCheckboxTitle, !isDark && { color: '#0F172A' }]}>
                      Do khách làm hư hỏng (Tính phí bồi thường)?
                    </Text>
                    <Text style={[styles.faultCheckboxSub, !isDark && { color: '#64748B' }]}>
                      {createIsGuestFault
                        ? (selectedRoom?.current_booking
                            ? `Khoản đền bù sẽ tự động cộng vào hóa đơn khách #${selectedRoom.current_booking.booking_code} tại Lễ tân.`
                            : 'Khoản đền bù sẽ ghi nhận vào phiếu để Lễ tân đối soát thu tiền.')
                        : 'Hao mòn tự nhiên trong vận hành (Khách sạn chịu chi phí bảo trì).'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {createIsGuestFault && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={[styles.costInputLabel, !isDark && { color: '#334155' }]}>Chi phí bồi thường / sửa chữa (VNĐ):</Text>
                    <View style={[styles.costInputWrapper, !isDark && { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' }]}>
                      <TextInput
                        style={[styles.costInput, !isDark && { color: '#0F172A' }]}
                        placeholder="0"
                        placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                        keyboardType="numeric"
                        value={
                          createCost
                            ? Number(createCost.replace(/\D/g, '')).toLocaleString('vi-VN')
                            : ''
                        }
                        onChangeText={(t) => setCreateCost(t.replace(/\D/g, ''))}
                      />
                      <Text style={styles.costCurrencyUnit}>VNĐ</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* 7. Ảnh hiện trường hư hại */}
              <Text style={[styles.inputLabel, { marginTop: 14 }, !isDark && { color: '#334155' }]}>
                7. Ảnh hiện trường hư hại (Bằng chứng đối soát):
              </Text>
              {createEvidenceImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: createEvidenceImage.uri }} style={styles.imagePreview} resizeMode="cover" />
                  <View style={styles.imagePreviewOverlay}>
                    <TouchableOpacity
                      style={styles.imageActionBtn}
                      onPress={takeCreatePhoto}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera" size={14} color="#F8FAFC" style={{ marginRight: 4 }} />
                      <Text style={styles.imageActionBtnText}>Chụp lại</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.imageActionBtn, { backgroundColor: '#EF4444' }]}
                      onPress={() => setCreateEvidenceImage(null)}
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
                    style={[
                      styles.photoPickerBtn,
                      !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                    ]}
                    onPress={takeCreatePhoto}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera" size={20} color={isDark ? '#F59E0B' : '#D97706'} />
                    <Text style={[styles.photoPickerText, !isDark && { color: '#D97706' }]}>
                      Chụp ảnh camera
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.photoPickerBtn,
                      !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                    ]}
                    onPress={pickCreateLibrary}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="images" size={20} color="#0284C7" />
                    <Text style={[styles.photoPickerText, { color: '#0284C7' }]}>Chọn từ thư viện</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={[styles.alertNoteBox, !isDark && { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }]}>
                <Ionicons name="information-circle" size={17} color="#F59E0B" style={{ marginRight: 8 }} />
                <Text style={[styles.alertNoteText, !isDark && { color: '#B45309' }]}>
                  Sau khi gửi phiếu, phòng sẽ tự động chuyển sang trạng thái <Text style={{ color: '#F87171', fontWeight: '800' }}>"Bảo trì"</Text> để cách ly trên sơ đồ khách sạn cho đến khi bạn hoàn tất sửa chữa.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, submittingCreate && { opacity: 0.6 }]}
                onPress={handleCreateTicket}
                disabled={submittingCreate}
                activeOpacity={0.8}
              >
                {submittingCreate ? (
                  <ActivityIndicator color="#0A0F1D" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="construct" size={17} color="#0A0F1D" style={{ marginRight: 6 }} />
                    <Text style={styles.modalConfirmBtnText}>TẠO PHIẾU BẢO TRÌ & CÁCH LY PHÒNG</Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    {/* Modal Hủy Phiếu / Báo Sai Sự Cố */}
    <Modal visible={cancelModalVisible} transparent animationType="fade" onRequestClose={() => setCancelModalVisible(false)}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={Keyboard.dismiss}
          />
          <View
            style={[
              styles.modalContent,
              !isDark && { backgroundColor: '#FFFFFF', borderTopColor: '#E2E8F0', shadowColor: '#64748B' },
            ]}
          >
            <View style={[styles.modalHeader, !isDark && { borderBottomColor: '#F1F5F9' }]}>
              <View>
                <Text style={[styles.modalTitle, !isDark && { color: '#0F172A' }]}>
                  Hủy Phiếu Bảo Trì / Báo Sai
                </Text>
                <Text style={[styles.modalSubtitle, !isDark && { color: '#64748B' }]}>
                  Mã phiếu #{selectedCancelTicket?.ticket_code} • P.{selectedCancelTicket?.room_number}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.modalCloseBtn, !isDark && { backgroundColor: '#F1F5F9' }]}
                onPress={() => setCancelModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View
                style={[
                  styles.alertNoteBox,
                  { backgroundColor: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.25)' },
                ]}
              >
                <Ionicons name="information-circle" size={18} color="#0284C7" style={{ marginRight: 8 }} />
                <Text style={[styles.alertNoteText, !isDark && { color: '#0369A1' }]}>
                  Sử dụng khi kiểm tra phát hiện thiết bị hoạt động bình thường, cắm lại phích điện hoặc khách bấm nhầm remote. Phòng sẽ tự động khôi phục lại trạng thái ban đầu và gỡ khoản đền bù (nếu có).
                </Text>
              </View>

              <Text style={[styles.inputLabel, { marginTop: 10 }, !isDark && { color: '#334155' }]}>
                Lý do hủy / Báo sai *:
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  { height: 70 },
                  !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' },
                ]}
                placeholder="VD: Khách bấm nhầm remote quạt gió / Đã cắm lại phích cắm / Báo nhầm phòng..."
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                multiline
                value={cancelReason}
                onChangeText={setCancelReason}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[
                    styles.cancelModalCloseBtn,
                    !isDark && { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
                  ]}
                  onPress={() => setCancelModalVisible(false)}
                  disabled={submittingCancel}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelModalCloseText, !isDark && { color: '#475569' }]}>Để sau</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.cancelModalConfirmBtn,
                    submittingCancel && { opacity: 0.6 },
                  ]}
                  onPress={handleCancelTicket}
                  disabled={submittingCancel}
                  activeOpacity={0.8}
                >
                  {submittingCancel ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="trash-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.cancelModalConfirmText}>XÁC NHẬN HỦY PHIẾU</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  cardFixing: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: '#18121A',
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
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  equipmentIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  equipmentIconBoxAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  equipmentName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  ticketCode: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  descBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  descText: {
    fontSize: 12,
    color: '#FCA5A5',
    flex: 1,
  },
  partsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  partsLabel: {
    fontSize: 12,
    color: '#64748B',
    marginRight: 6,
  },
  partsValue: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'column',
    marginTop: 4,
    gap: 8,
  },
  techText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    height: 42,
    borderRadius: 12,
  },
  completeBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.5,
  },
  doneTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  doneTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#34D399',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    marginTop: 12,
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
  alertNoteBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  alertNoteText: {
    fontSize: 11,
    color: '#FDE68A',
    flex: 1,
    lineHeight: 16,
  },
  modalConfirmBtn: {
    backgroundColor: '#F59E0B',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalConfirmBtnText: {
    color: '#0A0F1D',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  createTicketBtn: {
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
  createTicketBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A0F1D',
  },
  roomChipsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  roomSelectChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  roomSelectChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  roomSelectChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E2E8F0',
  },
  roomSelectChipTextActive: {
    color: '#0A0F1D',
  },
  selectedRoomSummaryCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 6,
  },
  selectedRoomSummaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedRoomIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  selectedRoomNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
    marginRight: 4,
  },
  selectedRoomCategoryText: {
    fontSize: 11,
    color: '#94A3B8',
    flexShrink: 1,
  },
  selectedRoomStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  selectedRoomStatusText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  guestAlertBanner: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    padding: 8,
    marginTop: 8,
  },
  guestAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guestAlertTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#38BDF8',
  },
  guestBookingTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  guestBookingTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
  },
  guestAlertNote: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 14,
  },
  issueTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  issueTypeGridCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  issueTypeGridLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94A3B8',
    flexShrink: 1,
  },
  suggestionRow: {
    marginTop: 6,
    marginBottom: 4,
  },
  suggestionTitle: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  quickEquipChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickEquipChipActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#F59E0B',
  },
  quickEquipChipText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  quickEquipChipTextActive: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  costFaultBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginTop: 12,
  },
  faultCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  faultCheckboxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  faultCheckboxSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 15,
  },
  costInputLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 6,
  },
  costInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
  },
  costInput: {
    flex: 1,
    height: 42,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  costCurrencyUnit: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  urgentToggleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 12,
  },
  urgentToggleBoxActive: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  urgentToggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  guestFaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
  },
  guestFaultBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F87171',
  },
  guestFaultToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  guestFaultToggleRowActive: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  guestFaultTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F1F5F9',
  },
  guestFaultSubtitle: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 14,
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
  floorChipsContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  floorChipsScroll: {
    gap: 8,
    paddingRight: 16,
  },
  floorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  floorChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  floorChipText: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  floorChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  issueChipsContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  issueChipsScroll: {
    gap: 8,
    paddingRight: 16,
  },
  issueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  issueChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  issueChipText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  issueChipTextActive: {
    color: '#0A0F1D',
    fontWeight: '800',
  },
  sopAlertBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    marginBottom: 4,
  },
  sopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  sopBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  sopBannerText: {
    fontSize: 11.5,
    color: '#FDE68A',
    lineHeight: 16,
    fontWeight: '500',
  },
  cleaningStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  cleaningStatusText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
  },
  prioritySelectChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prioritySelectChipText: {
    fontSize: 12,
  },
  cancelModalCloseBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalCloseText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  cancelModalConfirmBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  initialEvidenceBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 10,
    marginBottom: 12,
  },
  initialEvidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  initialEvidenceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  initialEvidenceImage: {
    width: '100%',
    height: 140,
    borderRadius: 8,
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
});
