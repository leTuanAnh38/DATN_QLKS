import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { useFocusPolling } from '../../hooks/use-focus-polling';
import { styles } from '../../components/housekeeping/styles';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme } from '../../contexts/ThemeContext';
import NotificationBell from '../../components/NotificationBell';
import BookingManagementModal from '../../components/BookingManagementModal';
import CustomerCrmModal from '../../components/CustomerCrmModal';
import { RoomGridSkeleton } from '../../components/SkeletonLoader';
import { enqueueOfflineAction } from '../../services/offlineQueue';

import type { RoomItem } from '../../components/housekeeping/types';
import RoomCard, { getStatusConfig } from '../../components/housekeeping/RoomCard';
import {
  MinibarModal,
  BreakdownModal,
  LostFoundModal,
  RoomDetailModal,
  ChangeRoomModal,
} from '../../components/housekeeping';

export default function HousekeepingScreen() {
  const { user } = useAuth();
  const { colors, isDark, hotelStars, hotelName } = useAppTheme();
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
  const [showFloors, setShowFloors] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Modal kiểm kê Minibar & Hư hại
  const [minibarModalVisible, setMinibarModalVisible] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomItem | null>(null);

  // Modal Báo hỏng thiết bị sang Kỹ thuật
  const [breakdownModalVisible, setBreakdownModalVisible] = useState(false);
  const [breakdownRoom, setBreakdownRoom] = useState<RoomItem | null>(null);

  // Modal Khai Báo Đồ Bỏ Quên (Lost & Found)
  const [lostFoundModalVisible, setLostFoundModalVisible] = useState(false);
  const [lostFoundRoom, setLostFoundRoom] = useState<RoomItem | null>(null);

  // Modal Chi tiết Phòng & Khách Lưu Trú (Đồng bộ PMS Web)
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailRoom, setDetailRoom] = useState<RoomItem | null>(null);

  // Modal Quản Lý Đặt Phòng & Lịch Lưu Trú (Timeline)
  const [bookingModalVisible, setBookingModalVisible] = useState(false);

  // Modal Đổi Phòng Cho Khách Lưu Trú (Room Move khi có sự cố nặng)
  const [changeRoomModalVisible, setChangeRoomModalVisible] = useState(false);
  const [changeRoomData, setChangeRoomData] = useState<{
    room: RoomItem | null;
    booking: any | null;
    initialReason?: string;
    initialIssueType?: string;
    initialEquipment?: string;
  }>({
    room: null,
    booking: null,
  });

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
    const makeupRequested = rooms.filter(
      (r) => Boolean(r.is_cleaning_requested)
    ).length;
    return { total, cleaning, available, occupied, maintenance, inspectionRequested, makeupRequested };
  }, [rooms]);

  // Lọc phòng theo trạng thái, tầng và tìm kiếm
  const filteredRooms = useMemo(() => {
    const list = rooms.filter((r) => {
      let matchStatus = true;
      if (filterStatus === 'inspection') {
        matchStatus = r.latest_minibar_check?.status === 'requested';
      } else if (filterStatus === 'makeup') {
        matchStatus = Boolean(r.is_cleaning_requested);
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

    // Tự động ưu tiên đưa các phòng Lễ tân đang đợi kiểm tra check-out và khách yêu cầu dọn lên ĐẦU danh sách
    return list.sort((a, b) => {
      const aWeight = a.latest_minibar_check?.status === 'requested' ? 2 : (a.is_cleaning_requested ? 1 : 0);
      const bWeight = b.latest_minibar_check?.status === 'requested' ? 2 : (b.is_cleaning_requested ? 1 : 0);
      return bWeight - aWeight;
    });
  }, [rooms, filterStatus, filterFloor, searchQuery]);

  // Đổi trạng thái phòng 1 chạm (Chống bấm đúp khi đang xử lý)
  const handleToggleCleaning = async (room: RoomItem) => {
    if (actionLoadingId === room.id) return;
    if (!canMarkCleaned) {
      Alert.alert('Không có quyền', 'Nghiệp vụ xác nhận dọn phòng thuộc thẩm quyền của nhân viên Buồng phòng.');
      return;
    }
    const isCleaning = room.status === 'cleaning';
    const hasActiveGuest = Boolean(room.current_booking);

    // Nếu phòng đang dọn dẹp:
    // - Nếu phòng có khách đang ở -> Chuyển về 'occupied' (Khách tiếp tục ở)
    // - Nếu phòng trống -> Chuyển về 'available' (Phòng sạch đón khách mới)
    const nextStatus = isCleaning ? (hasActiveGuest ? 'occupied' : 'available') : 'cleaning';

    const actionTitle = isCleaning
      ? (hasActiveGuest ? 'Hoàn tất dọn phòng khách ở' : 'Xác nhận ĐÃ DỌN SẠCH')
      : 'Bắt đầu DỌN DẸP';

    const actionDesc = isCleaning
      ? (hasActiveGuest
          ? `Phòng ${room.room_number} hiện đang có khách lưu trú (${room.current_booking?.guest_name || 'Khách'}). Xác nhận đã lau dọn sạch sẽ để phòng trở lại trạng thái "Có khách"?`
          : `Phòng ${room.room_number} đã được lau dọn, thay ga gối sạch sẽ và sẵn sàng đón khách mới?`)
      : `Bắt đầu ca dọn dẹp cho Phòng ${room.room_number}?`;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(actionTitle, actionDesc, [
      { text: 'Để sau', style: 'cancel' },
      {
        text: isCleaning ? (hasActiveGuest ? 'Khách tiếp tục ở' : 'Xác nhận đã dọn') : 'Bắt đầu dọn',
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
            if (!err.response) {
              const statusLabel =
                nextStatus === 'cleaning'
                  ? 'Đang dọn dẹp'
                  : hasActiveGuest
                  ? 'Có khách lưu trú'
                  : 'Sẵn sàng đón khách';

              await enqueueOfflineAction({
                description: `Phòng ${room.room_number}: Chuyển trạng thái sang "${statusLabel}"`,
                url: `/rooms/admin/rooms/${room.id}/status/`,
                method: 'PATCH',
                data: { status: nextStatus },
              });

              // Cập nhật giao diện lạc quan (Optimistic Update)
              setRooms((prev) =>
                prev.map((r) => (r.id === room.id ? { ...r, status: nextStatus } : r))
              );

              Alert.alert(
                'Đã lưu ngoại tuyến',
                `Mất kết nối máy chủ! Thao tác đổi trạng thái Phòng ${room.room_number} đã được lưu vào Hàng đợi và sẽ tự động gửi khi có mạng trở lại.`
              );
            } else {
              const msg = err.response?.data?.message || 'Không thể đổi trạng thái phòng.';
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Thông báo', msg);
            }
          } finally {
            setActionLoadingId(null);
          }
        },
      },
    ]);
  };

  // Xác nhận hoàn tất dọn dẹp phòng lưu trú (Make-up room) cho khách đang ở
  const handleCompleteMakeUpCleaning = async (room: RoomItem) => {
    if (actionLoadingId === room.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Hoàn tất dọn phòng khách ở',
      `Xác nhận đã lau dọn, thay ga gối sạch sẽ cho Phòng ${room.room_number}? Trạng thái phòng tiếp tục là Có khách.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Hoàn tất',
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
              if (!err.response) {
                await enqueueOfflineAction({
                  description: `Phòng ${room.room_number}: Hoàn tất dọn phòng khách ở`,
                  url: `/rooms/admin/rooms/${room.id}/complete-cleaning/`,
                  method: 'POST',
                });

                setRooms((prev) =>
                  prev.map((r) =>
                    r.id === room.id
                      ? { ...r, is_cleaning_requested: false, cleaning_request_note: '' }
                      : r
                  )
                );

                Alert.alert(
                  'Đã lưu ngoại tuyến',
                  `Mất kết nối máy chủ! Thao tác hoàn tất dọn Phòng ${room.room_number} đã được lưu vào Hàng đợi và sẽ tự động gửi khi có mạng trở lại.`
                );
              } else {
                const msg = err.response?.data?.message || 'Không thể cập nhật.';
                Alert.alert('Lỗi', msg);
              }
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  };

  const openMinibarCheck = (room: RoomItem) => {
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
    setMinibarModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openBreakdownModal = (room: RoomItem) => {
    setBreakdownRoom(room);
    setBreakdownModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openLostFoundModal = (room: RoomItem) => {
    if (room.status === 'available') {
      Alert.alert(
        'Phòng đã dọn sạch',
        `Phòng ${room.room_number} hiện đang trống và đã được dọn sạch sẽ, sẵn sàng đón khách.`
      );
      return;
    }
    setLostFoundRoom(room);
    setLostFoundModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openChangeRoomModal = (
    room: RoomItem,
    booking: any,
    initialData?: { reason?: string; issueType?: string; equipment?: string }
  ) => {
    setChangeRoomData({
      room,
      booking: booking || room.current_booking || room.recent_booking,
      initialReason: initialData?.reason,
      initialIssueType: initialData?.issueType,
      initialEquipment: initialData?.equipment,
    });
    setChangeRoomModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    <SafeAreaView style={[styles.safeContainer, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. Header Khách Sạn & Chuông Thông Báo */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.brandSubtitle}>{hotelName.toUpperCase()} • {hotelStars} SAO</Text>
          <Text style={[styles.greetingTitle, { color: colors.text }]} numberOfLines={1}>
            {user?.role === 'service_staff'
              ? 'Sơ Đồ Phòng'
              : (user?.first_name ? `Chào ${user.first_name}` : 'Sơ Đồ Buồng Phòng')}
          </Text>
        </View>
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[
              styles.headerShortcutBtn,
              !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
            ]}
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
            style={[
              styles.headerShortcutBtn,
              { borderColor: 'rgba(56, 189, 248, 0.4)' },
              !isDark && { backgroundColor: '#FFFFFF', borderColor: 'rgba(56, 189, 248, 0.3)' },
            ]}
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
          <TouchableOpacity
            style={[
              styles.refreshCircleBtn,
              !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
            ]}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={16} color="#F59E0B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Dải Bộ Lọc & KPI Cố Định 100% (Không bị trôi trượt khi lướt) */}
      <View style={styles.fixedFilterBar}>
        {[
          { key: 'all', label: 'Tất cả', count: stats.total, color: isDark ? '#F8FAFC' : '#0F172A' },
          { key: 'cleaning', label: 'Cần dọn', count: stats.cleaning, color: '#F59E0B' },
          { key: 'available', label: 'Trống', count: stats.available, color: isDark ? '#34D399' : '#059669' },
          { key: 'occupied', label: 'Có khách', count: stats.occupied, color: isDark ? '#60A5FA' : '#0284C7' },
          { key: 'maintenance', label: 'Bảo trì', count: stats.maintenance, color: isDark ? '#F87171' : '#DC2626' },
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
                  !isDark && { color: isSelected ? '#F59E0B' : '#64748B' },
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

      {/* 2b. Dải Cảnh Báo Khẩn Cấp Tinh Gọn Trên 1 Dòng (Check-out & Yêu cầu dọn phòng) */}
      {((canAccessMinibar && stats.inspectionRequested > 0) || stats.makeupRequested > 0) && (
        <View style={{ flexDirection: 'row', marginHorizontal: 12, marginBottom: 8, gap: 8 }}>
          {canAccessMinibar && stats.inspectionRequested > 0 && (
            <TouchableOpacity
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: 11,
                backgroundColor: filterStatus === 'inspection' ? '#F59E0B' : 'rgba(245, 158, 11, 0.14)',
                borderWidth: 1,
                borderColor: '#F59E0B',
              }}
              onPress={() => {
                setFilterStatus((prev) => (prev === 'inspection' ? 'all' : 'inspection'));
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons
                  name="notifications"
                  size={13}
                  color={filterStatus === 'inspection' ? '#0A0F1D' : '#F59E0B'}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: filterStatus === 'inspection' ? '#0A0F1D' : (isDark ? '#FBBF24' : '#B45309'),
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {stats.inspectionRequested} phòng chờ Check-out
                </Text>
              </View>
              <Ionicons
                name={filterStatus === 'inspection' ? 'close-circle' : 'chevron-forward'}
                size={14}
                color={filterStatus === 'inspection' ? '#0A0F1D' : '#F59E0B'}
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          )}

          {stats.makeupRequested > 0 && (
            <TouchableOpacity
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: 11,
                backgroundColor: filterStatus === 'makeup' ? '#0284C7' : 'rgba(2, 132, 199, 0.14)',
                borderWidth: 1,
                borderColor: '#0284C7',
              }}
              onPress={() => {
                setFilterStatus((prev) => (prev === 'makeup' ? 'all' : 'makeup'));
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons
                  name="sparkles"
                  size={13}
                  color={filterStatus === 'makeup' ? '#FFFFFF' : '#38BDF8'}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    color: filterStatus === 'makeup' ? '#FFFFFF' : (isDark ? '#38BDF8' : '#0284C7'),
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {stats.makeupRequested} phòng yêu cầu dọn
                </Text>
              </View>
              <Ionicons
                name={filterStatus === 'makeup' ? 'close-circle' : 'chevron-forward'}
                size={14}
                color={filterStatus === 'makeup' ? '#FFFFFF' : (isDark ? '#38BDF8' : '#0284C7')}
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 3. Ô Tìm Kiếm Kết Hợp Nút [Tầng ▾] Gọn Gàng Trên 1 Dòng */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 8, gap: 8 }}>
        <View
          style={[
            styles.searchWrapper,
            { flex: 1, marginHorizontal: 0, marginBottom: 0, backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search-outline" size={17} color={colors.textSubtle} style={{ marginLeft: 10 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Tìm nhanh số phòng (VD: 101, 202...)"
            placeholderTextColor={colors.textSubtle}
            value={searchQuery}
            onChangeText={setSearchQuery}
            keyboardType="numeric"
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 6 }}>
              <Ionicons name="close-circle" size={17} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {availableFloors.length > 1 && (
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              height: 40,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              backgroundColor:
                showFloors || filterFloor !== 'all'
                  ? 'rgba(245, 158, 11, 0.16)'
                  : (isDark ? '#1E293B' : '#FFFFFF'),
              borderColor: showFloors || filterFloor !== 'all' ? '#F59E0B' : (isDark ? '#334155' : '#E2E8F0'),
            }}
            onPress={() => {
              setShowFloors((prev) => !prev);
              Haptics.selectionAsync();
            }}
            activeOpacity={0.75}
          >
            <Ionicons
              name="layers-outline"
              size={15}
              color={showFloors || filterFloor !== 'all' ? '#F59E0B' : (isDark ? '#CBD5E1' : '#475569')}
              style={{ marginRight: 5 }}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: '800',
                color:
                  showFloors || filterFloor !== 'all'
                    ? (isDark ? '#FBBF24' : '#B45309')
                    : (isDark ? '#CBD5E1' : '#475569'),
              }}
            >
              {filterFloor === 'all' ? 'Tầng' : `Tầng ${filterFloor}`}
            </Text>
            <Ionicons
              name={showFloors ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={showFloors || filterFloor !== 'all' ? '#F59E0B' : (isDark ? '#94A3B8' : '#64748B')}
              style={{ marginLeft: 3 }}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* 4. Bộ Lọc Theo Tầng Mở Rộng (Chỉ hiện khi bấm [Tầng ▾]) */}
      {showFloors && availableFloors.length > 1 && (
        <View style={styles.floorFilterWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.floorScrollContent}
          >
            <TouchableOpacity
              style={[
                styles.floorChip,
                !isDark && {
                  backgroundColor: filterFloor === 'all' ? 'rgba(245, 158, 11, 0.12)' : '#FFFFFF',
                  borderColor: filterFloor === 'all' ? '#F59E0B' : '#E2E8F0',
                },
                filterFloor === 'all' && isDark && styles.floorChipActive,
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
                  !isDark && { color: filterFloor === 'all' ? '#D97706' : '#64748B' },
                  filterFloor === 'all' && isDark && styles.floorChipTextActive,
                ]}
              >
                Tất cả tầng ({rooms.length})
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
                    !isDark && {
                      backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.12)' : '#FFFFFF',
                      borderColor: isSelected ? '#F59E0B' : '#E2E8F0',
                    },
                    isSelected && isDark && styles.floorChipActive,
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
                      !isDark && { color: isSelected ? '#D97706' : '#64748B' },
                      isSelected && isDark && styles.floorChipTextActive,
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
      <MinibarModal
        visible={minibarModalVisible}
        room={selectedRoom}
        onClose={() => setMinibarModalVisible(false)}
        onSuccess={fetchRooms}
      />

      {/* Modal Báo Hỏng Thiết Bị Sang Kỹ Thuật */}
      <BreakdownModal
        visible={breakdownModalVisible}
        room={breakdownRoom}
        onClose={() => setBreakdownModalVisible(false)}
        onSuccess={fetchRooms}
        onOpenChangeRoom={openChangeRoomModal}
      />

      {/* Modal Khai Báo Đồ Khách Bỏ Quên */}
      <LostFoundModal
        visible={lostFoundModalVisible}
        room={lostFoundRoom}
        onClose={() => setLostFoundModalVisible(false)}
        onSuccess={fetchRooms}
      />

      {/* Modal Chi Tiết Phòng */}
      <RoomDetailModal
        visible={detailModalVisible}
        room={detailRoom}
        onClose={() => setDetailModalVisible(false)}
        canMarkCleaned={canMarkCleaned}
        canAccessMinibar={canAccessMinibar}
        canReportLostItem={canReportLostItem}
        canReportMaintenance={canReportMaintenance}
        isTechnician={isTechnician}
        isManagerOrAdmin={isManagerOrAdmin}
        onToggleCleaning={handleToggleCleaning}
        onOpenMinibar={openMinibarCheck}
        onOpenLostFound={openLostFoundModal}
        onOpenBreakdown={openBreakdownModal}
        onOpenChangeRoom={openChangeRoomModal}
        onOpenCrm={(guestId) => {
          setCrmGuestId(guestId);
          setCrmModalVisible(true);
        }}
        onNavigateServices={() => router.navigate('/(tabs)/services')}
        onNavigateTransport={() => router.navigate('/(tabs)/transport')}
        onNavigateMaintenance={() => router.navigate('/(tabs)/maintenance')}
      />

      {/* Modal Đổi Phòng Cho Khách Lưu Trú (Sự cố nặng) */}
      <ChangeRoomModal
        visible={changeRoomModalVisible}
        room={changeRoomData.room}
        booking={changeRoomData.booking}
        initialReason={changeRoomData.initialReason}
        initialIssueType={changeRoomData.initialIssueType}
        initialEquipment={changeRoomData.initialEquipment}
        onClose={() => setChangeRoomModalVisible(false)}
        onSuccess={fetchRooms}
      />

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
