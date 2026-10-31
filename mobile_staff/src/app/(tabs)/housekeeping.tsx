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

import type { RoomItem } from '../../components/housekeeping/types';
import RoomCard, { getStatusConfig } from '../../components/housekeeping/RoomCard';
import {
  MinibarModal,
  BreakdownModal,
  LostFoundModal,
  RoomDetailModal,
} from '../../components/housekeeping';

export default function HousekeepingScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
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
          <Text style={styles.brandSubtitle}>TA LUXURY HOTEL</Text>
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
      <View style={[styles.searchWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.textSubtle} style={{ marginLeft: 12 }} />
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
        onOpenCrm={(guestId) => {
          setCrmGuestId(guestId);
          setCrmModalVisible(true);
        }}
        onNavigateServices={() => router.navigate('/(tabs)/services')}
        onNavigateTransport={() => router.navigate('/(tabs)/transport')}
        onNavigateMaintenance={() => router.navigate('/(tabs)/maintenance')}
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
