import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme, resolveMobileMediaUrl } from '../../contexts/ThemeContext';
import apiClient from '../../api/client';
import NotificationBell from '../../components/NotificationBell';
import CustomerCrmModal from '../../components/CustomerCrmModal';
import BookingManagementModal from '../../components/BookingManagementModal';
import OfflineQueueModal from '../../components/OfflineQueueModal';
import {
  EditProfileModal,
  ChangePasswordModal,
  ServerConfigModal,
  HandoverNoteModal,
  ExecutiveDashboardModal,
  StaffDirectoryModal,
  createProfileStyles,
} from '../../components/profile';
import { useOfflineQueueCount, clearOfflineQueue } from '../../services/offlineQueue';
import { hasStaffPermission } from '../../utils/permissions';

export default function ProfileScreen() {
  const { user, logout, apiUrl, updateServerUrl, refreshProfile } = useAuth();
  const { isDark, colors, hotelStars, hotelName, refreshHotelSettings, setThemeMode } = useAppTheme();
  const userRole = user?.role || '';
  const isExecutive = Boolean(
    user?.is_superuser || ['admin', 'owner', 'manager'].includes(userRole)
  );
  const canViewStaffDirectory = Boolean(
    user?.is_superuser || ['admin', 'owner', 'manager', 'receptionist'].includes(userRole)
  );
  // Tách riêng quyền CRM (guests.read) và Lịch lưu trú (bookings.read) đồng bộ trực tiếp theo role_matrix.json
  const canAccessCrm = hasStaffPermission(user, 'guests', 'read');
  const canAccessBookings = hasStaffPermission(user, 'bookings', 'read');
  const offlineQueueCount = useOfflineQueueCount();
  const [offlineModalVisible, setOfflineModalVisible] = useState(false);
  const [executiveModalVisible, setExecutiveModalVisible] = useState(false);
  const [staffDirModalVisible, setStaffDirModalVisible] = useState(false);
  const styles = useMemo(() => createProfileStyles(colors, isDark), [colors, isDark]);
  const [refreshing, setRefreshing] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  // Modal Hồ Sơ Khách Hàng (CRM & Lịch Sử)
  const [crmModalVisible, setCrmModalVisible] = useState(false);
  const [crmGuestId, setCrmGuestId] = useState<number | null>(null);

  // Modal Quản Lý Đặt Phòng & Lịch Lưu Trú
  const [bookingModalVisible, setBookingModalVisible] = useState(false);

  // Modal Đổi Mật Khẩu
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);

  // Modal Chỉnh Sửa Thông Tin Cá Nhân
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Đo độ trễ máy chủ API (ms)
  const [serverLatency, setServerLatency] = useState<number | null>(null);

  // Thống kê hiệu suất / công việc ca hôm nay theo vai trò
  const [shiftKpi, setShiftKpi] = useState<{
    title: string;
    targetRoute: '/(tabs)/housekeeping' | '/(tabs)/services' | '/(tabs)/maintenance';
    items: { label: string; value: string; color: string }[];
  } | null>(null);
  const [loadingKpi, setLoadingKpi] = useState(false);

  // Sổ ghi chú ca trực cá nhân
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverModalVisible, setHandoverModalVisible] = useState(false);

  const isSameLocalDay = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  const fetchShiftKpi = async () => {
    const role = user?.role || '';
    if (!role) return;
    setLoadingKpi(true);
    try {
      if (role === 'service_staff') {
        const res = await apiClient.get('/services/requests/?no_page=true');
        const list = res.data?.results || res.data?.requests || res.data?.data || res.data || [];
        const orders = Array.isArray(list) ? list : [];
        const isMine = (o: any) => Boolean(user?.id && o.assigned_staff === user.id);
        const doneToday = orders.filter(
          (o: any) => isMine(o) && o.status === 'completed' && isSameLocalDay(o.updated_at || o.created_at)
        ).length;
        const activeMine = orders.filter(
          (o: any) => isMine(o) && ['pending', 'in_progress', 'delivering'].includes(o.status)
        ).length;
        const unassigned = orders.filter(
          (o: any) => !o.assigned_staff && ['pending', 'in_progress'].includes(o.status)
        ).length;
        setShiftKpi({
          title: 'Hiệu Suất Phục Vụ Hôm Nay',
          targetRoute: '/(tabs)/services',
          items: [
            { label: 'Đã xong hôm nay', value: String(doneToday), color: colors.emerald },
            { label: 'Đang phụ trách', value: String(activeMine), color: colors.sky },
            { label: 'Chưa ai nhận', value: String(unassigned), color: colors.gold },
          ],
        });
      } else if (role === 'technician') {
        const res = await apiClient.get('/rooms/maintenance-tickets/');
        const list = res.data?.results || res.data?.tickets || res.data?.data || res.data || [];
        const tickets = Array.isArray(list) ? list : [];
        const doneToday = tickets.filter(
          (t: any) =>
            Boolean(user?.id && t.technician === user.id) &&
            t.status === 'completed' &&
            isSameLocalDay(t.completed_date || t.updated_at)
        ).length;
        const activeMine = tickets.filter(
          (t: any) => Boolean(user?.id && t.technician === user.id) && t.status === 'fixing'
        ).length;
        const unassigned = tickets.filter(
          (t: any) => !t.technician && !t.technician_name && t.status === 'fixing'
        ).length;
        setShiftKpi({
          title: 'Hiệu Suất Kỹ Thuật Hôm Nay',
          targetRoute: '/(tabs)/maintenance',
          items: [
            { label: 'Sửa xong hôm nay', value: String(doneToday), color: colors.emerald },
            { label: 'Đang xử lý', value: String(activeMine), color: colors.sky },
            { label: 'Chưa ai nhận', value: String(unassigned), color: colors.rose },
          ],
        });
      } else if (role === 'housekeeper') {
        const res = await apiClient.get('/rooms/admin/rooms/');
        const list = res.data?.results || res.data?.rooms || res.data?.data || res.data || [];
        const rooms = Array.isArray(list) ? list : [];
        const needClean = rooms.filter((r: any) => r.status === 'cleaning' || r.is_cleaning_requested).length;
        const inspectReq = rooms.filter((r: any) => r.latest_minibar_check?.status === 'requested').length;
        const readyClean = rooms.filter((r: any) => r.status === 'available').length;
        setShiftKpi({
          title: 'Tình Hình Buồng Phòng Hôm Nay',
          targetRoute: '/(tabs)/housekeeping',
          items: [
            { label: 'Cần dọn', value: String(needClean), color: colors.gold },
            { label: 'Chờ Check-out', value: String(inspectReq), color: colors.rose },
            { label: 'Phòng sạch', value: String(readyClean), color: colors.emerald },
          ],
        });
      } else {
        const res = await apiClient.get('/rooms/admin/rooms/');
        const list = res.data?.results || res.data?.rooms || res.data?.data || res.data || [];
        const rooms = Array.isArray(list) ? list : [];
        const total = rooms.length;
        const occupied = rooms.filter((r: any) => r.status === 'occupied').length;
        const needOps = rooms.filter((r: any) => r.status === 'cleaning' || r.status === 'maintenance').length;
        const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
        setShiftKpi({
          title: 'Tổng Quan Vận Hành Hôm Nay',
          targetRoute: '/(tabs)/housekeeping',
          items: [
            { label: 'Công suất phòng', value: `${occupancyRate}%`, color: colors.emerald },
            { label: 'Đang có khách', value: `${occupied}/${total}`, color: colors.sky },
            { label: 'Dọn / Bảo trì', value: String(needOps), color: colors.gold },
          ],
        });
      }
    } catch {
      // Giữ nguyên KPI cũ nếu mạng yếu
    } finally {
      setLoadingKpi(false);
    }
  };

  const measureLatency = async () => {
    try {
      const start = Date.now();
      await apiClient.get('/users/me/');
      const diff = Date.now() - start;
      setServerLatency(diff);
    } catch {
      setServerLatency(null);
    }
  };

  const loadHandoverNote = async () => {
    try {
      const saved =
        Platform.OS === 'web'
          ? typeof window !== 'undefined' && window.localStorage
            ? window.localStorage.getItem('staff_shift_handover_note')
            : null
          : await SecureStore.getItemAsync('staff_shift_handover_note');
      if (saved) setHandoverNote(saved);
    } catch {}
  };

  // Modal Cấu Hình Máy Chủ API
  const [serverModalVisible, setServerModalVisible] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const uploadAvatar = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      const uri = asset.uri;
      const filename = uri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;
      // @ts-ignore
      formData.append('avatar', {
        uri,
        name: filename,
        type,
      });

      await apiClient.patch('/users/me/', formData);
      await refreshProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện mới!');
    } catch (err: any) {
      Alert.alert('Lỗi', 'Không thể tải lên ảnh đại diện.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangeAvatar = () => {
    Alert.alert('Đổi ảnh đại diện', 'Chọn phương thức cập nhật ảnh:', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Chụp ảnh mới',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Cần cấp quyền', 'Vui lòng cấp quyền Camera để chụp ảnh.');
            return;
          }
          const res = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!res.canceled && res.assets && res.assets.length > 0) {
            uploadAvatar(res.assets[0]);
          }
        },
      },
      {
        text: 'Chọn từ Thư viện',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Cần cấp quyền', 'Vui lòng cấp quyền Thư viện ảnh để chọn ảnh.');
            return;
          }
          const res = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!res.canceled && res.assets && res.assets.length > 0) {
            uploadAvatar(res.assets[0]);
          }
        },
      },
    ]);
  };

  useEffect(() => {
    refreshProfile();
    measureLatency();
    loadHandoverNote();
  }, []);

  useEffect(() => {
    if (user?.role) {
      fetchShiftKpi();
    }
  }, [user?.id, user?.role]);

  const handleRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([refreshProfile(), measureLatency(), refreshHotelSettings(), fetchShiftKpi()]);
    setRefreshing(false);
  };

  // Mở modal sửa thông tin cá nhân
  const openEditModal = () => {
    setEditModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Nút thử nghiệm chuông iPhone
  const handleTestPush = async () => {
    setTestingPush(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await apiClient.post('/notifications/test-push/');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Đã gửi lệnh thử nghiệm',
        'Máy chủ đã phát lệnh thông báo đẩy! Hãy thử vuốt ra màn hình chính hoặc khóa màn hình điện thoại để kiểm tra chuông & rung.'
      );
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể gửi thông báo thử nghiệm.';
      Alert.alert('Lỗi', msg);
    } finally {
      setTestingPush(false);
    }
  };

  // Đăng xuất
  const handleLogout = () => {
    if (offlineQueueCount > 0) {
      Alert.alert(
        'Còn tác vụ ngoại tuyến chưa đồng bộ',
        `Hiện có ${offlineQueueCount} tác vụ đang nằm trong hàng đợi ngoại tuyến. Nếu đăng xuất ngay, nhân viên ca sau đăng nhập trên máy này có thể bị đồng bộ nhầm tác vụ của bạn.`,
        [
          { text: 'Ở lại để đồng bộ', style: 'cancel' },
          {
            text: 'Xóa hàng đợi & Đăng xuất',
            style: 'destructive',
            onPress: async () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await clearOfflineQueue();
              await logout();
              router.replace('/login');
            },
          },
        ]
      );
      return;
    }

    Alert.alert('Xác nhận kết thúc ca', 'Bạn có chắc chắn muốn kết thúc ca trực và đăng xuất khỏi hệ thống?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };


  const getRoleDisplayName = (role: string | undefined) => {
    switch (role) {
      case 'owner':
        return 'Chủ Khách Sạn (Owner)';
      case 'admin':
        return 'Quản trị Hệ thống (Admin)';
      case 'manager':
        return 'Quản lý Vận hành (Manager)';
      case 'receptionist':
        return 'Lễ tân Khách sạn (Receptionist)';
      case 'cashier':
        return 'Thu ngân (Cashier)';
      case 'housekeeper':
        return 'Nhân viên Buồng phòng (Housekeeping)';
      case 'service_staff':
        return 'Nhân viên Phục vụ & Đội xe (Service/Driver)';
      case 'technician':
        return 'Kỹ thuật viên Bảo trì (Technician)';
      default:
        return role || 'Nhân viên Khách sạn';
    }
  };

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Nhân viên ca trực';
  const resolvedAvatarUrl = resolveMobileMediaUrl(user?.avatar, apiUrl);

  // Rút gọn Bộ phận & tách Tên ca / Khung giờ để không bị cắt chữ trong ô 3 cột
  const shortDepartment = (() => {
    const raw = (user?.department || '').trim();
    if (!raw) return 'Vận hành';
    return raw.replace(/^Bộ phận\s+/i, '').replace(/^Phòng\s+/i, '');
  })();

  const parsedShift = (() => {
    const raw = (user?.shift || '').trim();
    if (!raw) return { shortLabel: 'Ca Sáng', hours: '' };
    const match = raw.match(/^(.+?)\s*\((.+)\)$/);
    const rawTitle = match ? match[1].trim() : raw;
    const hours = match ? match[2].trim() : '';
    const shortLabel = rawTitle.replace(/^Ca\s+Hành\s+Chính$/i, 'Hành chính');
    return { shortLabel, hours };
  })();

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      {/* 1. Header Khách Sạn & Chuông Thông Báo */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.brandSubtitle} numberOfLines={1} ellipsizeMode="tail">
            {hotelName.toUpperCase()} • {hotelStars} SAO
          </Text>
          <Text style={styles.greetingTitle} numberOfLines={1}>Hồ Sơ Cá Nhân</Text>
        </View>
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.refreshCircleBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setThemeMode(isDark ? 'light' : 'dark');
            }}
            onLongPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setThemeMode('system');
              Alert.alert('Giao diện hệ thống', 'Đã chuyển về chế độ tự động theo thiết bị.');
            }}
            delayLongPress={450}
            activeOpacity={0.7}
            accessibilityLabel={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          >
            <Ionicons
              name={isDark ? 'sunny' : 'moon'}
              size={17}
              color={isDark ? '#F59E0B' : '#475569'}
            />
          </TouchableOpacity>
          <NotificationBell />
          <TouchableOpacity
            style={styles.refreshCircleBtn}
            onPress={handleRefresh}
            disabled={refreshing}
            activeOpacity={0.7}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#F59E0B" />
            ) : (
              <Ionicons name="refresh" size={17} color="#F59E0B" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#F59E0B" />
        }
      >
        {/* 1. Thẻ Căn Cước Nhân Viên & Hiệu Suất Ca Trực (Master Staff Badge) */}
        <View style={styles.idCard}>
          <View style={styles.cardGoldTrim} />

          <View style={styles.idCardTop}>
            <View style={styles.avatarGlow}>
              {resolvedAvatarUrl ? (
                <Image source={{ uri: resolvedAvatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons name="person" size={32} color={colors.gold} />
                </View>
              )}
              <TouchableOpacity
                style={styles.changeAvatarBtn}
                onPress={handleChangeAvatar}
                disabled={uploadingAvatar}
                activeOpacity={0.8}
              >
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#0A0F1D" />
                ) : (
                  <Ionicons name="camera" size={13} color="#0A0F1D" />
                )}
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1, marginLeft: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text style={[styles.staffName, { flex: 1 }]} numberOfLines={1}>
                  {fullName}
                </Text>
                <TouchableOpacity onPress={openEditModal} activeOpacity={0.7} style={styles.quickEditBtn}>
                  <Ionicons name="create-outline" size={12} color={colors.gold} style={{ marginRight: 3 }} />
                  <Text style={styles.quickEditBtnText}>Sửa</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.staffUsername} numberOfLines={1}>
                @{user?.username} • ID: {user?.employee_code || `NV-${user?.id || '01'}`}
                {user?.phone_number ? ` • ${user.phone_number}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.gold} style={{ marginRight: 6 }} />
            <Text style={styles.roleBadgeText} numberOfLines={1}>
              {getRoleDisplayName(user?.role)}
            </Text>
          </View>

          {/* Hàng 3 chỉ số vận hành thực tế của tài khoản & kết nối */}
          <View style={styles.idKpiRow}>
            <View style={styles.idKpiCol}>
              <Text style={styles.idKpiVal} numberOfLines={1}>
                {shortDepartment}
              </Text>
              <Text style={styles.idKpiLbl}>Bộ phận</Text>
            </View>
            <View style={styles.idKpiDivider} />
            <View style={styles.idKpiCol}>
              <Text style={[styles.idKpiVal, { color: colors.emerald }]} numberOfLines={1}>
                {parsedShift.shortLabel}
              </Text>
              <Text style={styles.idKpiLbl}>Ca làm việc</Text>
            </View>
            <View style={styles.idKpiDivider} />
            <View style={styles.idKpiCol}>
              <Text style={[styles.idKpiVal, { color: colors.sky }]} numberOfLines={1}>
                {serverLatency !== null ? `${serverLatency}ms` : '4G/WiFi'}
              </Text>
              <Text style={styles.idKpiLbl}>Độ trễ API</Text>
            </View>
          </View>

          <View style={styles.shiftActiveBar}>
            <View style={styles.pulseDot} />
            <Text style={[styles.shiftActiveText, { flex: 1 }]} numberOfLines={1}>
              ĐANG TRỰC CA{parsedShift.hours ? ` • ${parsedShift.hours}` : ''}
              {serverLatency !== null ? ` • PING ${serverLatency}ms` : ''}
            </Text>
          </View>
        </View>

        {/* 1b. Thẻ Hiệu Suất & Công Việc Ca Hôm Nay (Thích ứng theo vai trò) */}
        {shiftKpi && (
          <TouchableOpacity
            style={styles.sectionCard}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.navigate(shiftKpi.targetRoute);
            }}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
                <Ionicons name="stats-chart" size={14} color={colors.gold} />
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]} numberOfLines={1}>
                  {shiftKpi.title}
                </Text>
              </View>
              {loadingKpi ? (
                <ActivityIndicator size="small" color={colors.gold} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.gold, marginRight: 2 }}>
                    Mở việc
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.gold} />
                </View>
              )}
            </View>

            <View style={[styles.idKpiRow, { marginTop: 0, marginBottom: 0 }]}>
              {shiftKpi.items.map((kpi, idx) => (
                <React.Fragment key={kpi.label}>
                  {idx > 0 && <View style={styles.idKpiDivider} />}
                  <View style={styles.idKpiCol}>
                    <Text style={[styles.idKpiVal, { fontSize: 17, fontWeight: '900', color: kpi.color }]} numberOfLines={1}>
                      {kpi.value}
                    </Text>
                    <Text style={styles.idKpiLbl} numberOfLines={1}>
                      {kpi.label}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </TouchableOpacity>
        )}

        {/* 2. Nghiệp Vụ Vận Hành Khách Sạn & Điều Hành (Ưu tiên trên cùng) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            {isExecutive ? 'Điều Hành & Quản Trị Nhanh' : 'Nghiệp Vụ & Ghi Chú Ca'}
          </Text>

          {/* Bảng Điều Hành & Doanh Thu + Điểm nóng hiện trường (Chủ KS / Quản lý / Admin) */}
          {isExecutive && (
            <>
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  setExecutiveModalVisible(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.16)' }]}>
                  <Ionicons name="analytics-outline" size={17} color={colors.gold} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.actionTitle}>Bảng Điều Hành & Doanh Thu</Text>
                  <Text style={styles.actionDesc} numberOfLines={1}>
                    Doanh thu ngày/tuần/tháng, công suất & điểm nóng hiện trường
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </TouchableOpacity>
              <View style={styles.detailDivider} />
            </>
          )}

          {/* Danh Bạ & Ca Trực Nhân Sự (Quản lý / Chủ KS / Admin / Lễ tân) */}
          {canViewStaffDirectory && (
            <>
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  setStaffDirModalVisible(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.14)' }]}>
                  <Ionicons name="id-card-outline" size={17} color="#A855F7" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.actionTitle}>Danh Bạ & Ca Trực Nhân Sự</Text>
                  <Text style={styles.actionDesc} numberOfLines={1}>
                    Lọc theo bộ phận, ca làm việc & gọi điều phối 1 chạm
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </TouchableOpacity>
              <View style={styles.detailDivider} />
            </>
          )}

          {/* Ghi Chú Ca Trực Cá Nhân (Lưu cục bộ trên thiết bị) */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              setHandoverModalVisible(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Ionicons name="clipboard-outline" size={17} color={colors.gold} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionTitle}>Ghi Chú Ca Trực Cá Nhân</Text>
              <Text style={styles.actionDesc} numberOfLines={1}>
                {handoverNote ? `Lưu ý: "${handoverNote}"` : 'Lưu nhắc việc cá nhân trên thiết bị trong ca trực'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </TouchableOpacity>

          {canAccessCrm && (
            <>
              <View style={styles.detailDivider} />

              {/* Tra cứu khách hàng CRM */}
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  setCrmGuestId(null);
                  setCrmModalVisible(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.12)' }]}>
                  <Ionicons name="people-outline" size={17} color={colors.sky} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.actionTitle}>Tra Cứu Khách Hàng (CRM & Lịch Sử)</Text>
                  <Text style={styles.actionDesc}>Hạng thẻ VIP, lịch sử lưu trú & dùng dịch vụ</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </TouchableOpacity>
            </>
          )}

          {canAccessBookings && (
            <>
              <View style={styles.detailDivider} />

              {/* Quản lý đặt phòng & Lịch lưu trú */}
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  setBookingModalVisible(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                  <Ionicons name="calendar-outline" size={17} color={colors.emerald} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.actionTitle}>Quản Lý Đặt Phòng & Lịch Lưu Trú</Text>
                  <Text style={styles.actionDesc}>Danh sách đơn đặt phòng & sơ đồ timeline tháng</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* 3. Cài Đặt Tài Khoản & Kết Nối */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Tài Khoản & Kết Nối</Text>

          {/* Đổi Mật Khẩu */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => setPasswordModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Ionicons name="key-outline" size={17} color={colors.gold} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionTitle}>Đổi Mật Khẩu</Text>
              <Text style={styles.actionDesc}>Cập nhật mật khẩu bảo mật tài khoản</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </TouchableOpacity>

          <View style={styles.detailDivider} />

          {/* Thử Nghiệm Thông Báo Đẩy */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleTestPush}
            disabled={testingPush}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(96, 165, 250, 0.12)' }]}>
              <Ionicons name="notifications-outline" size={17} color={colors.sky} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionTitle}>Thử Nghiệm Thông Báo Đẩy</Text>
              <Text style={styles.actionDesc}>Phát lệnh thông báo đẩy để kiểm tra chuông & rung</Text>
            </View>
            {testingPush ? (
              <ActivityIndicator size="small" color={colors.sky} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
            )}
          </TouchableOpacity>

          <View style={styles.detailDivider} />

          {/* Hàng Đợi Ngoại Tuyến (Offline Queue) */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setOfflineModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Ionicons name="cloud-offline-outline" size={17} color={colors.gold} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.actionTitle}>Hàng Đợi Ngoại Tuyến</Text>
                {offlineQueueCount > 0 && (
                  <View
                    style={{
                      backgroundColor: '#F59E0B',
                      borderRadius: 10,
                      paddingHorizontal: 7,
                      paddingVertical: 1.5,
                      marginLeft: 8,
                    }}
                  >
                    <Text style={{ color: '#0A0F1D', fontSize: 11, fontWeight: '800' }}>
                      {offlineQueueCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.actionDesc}>
                {offlineQueueCount > 0
                  ? `Có ${offlineQueueCount} tác vụ đang chờ mạng để tự động gửi`
                  : 'Tự động lưu và gửi bù tác vụ khi mạng chập chờn'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </TouchableOpacity>

          <View style={styles.detailDivider} />

          {/* Cấu hình Máy Chủ API */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => setServerModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Ionicons name="server-outline" size={17} color={colors.emerald} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionTitle}>Máy Chủ API Khách Sạn</Text>
              <Text style={styles.actionDesc} numberOfLines={1}>
                {apiUrl} {serverLatency !== null ? `• Ping ${serverLatency}ms` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </TouchableOpacity>
        </View>

        {/* 5. Nút Đăng Xuất & Kết Thúc Ca */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={colors.rose} style={{ marginRight: 8 }} />
          <Text style={styles.logoutButtonText}>KẾT THÚC CA TRỰC & ĐĂNG XUẤT</Text>
        </TouchableOpacity>

        {/* Thông tin phiên bản */}
        <Text style={styles.versionText}>
          {hotelName || 'TA Luxury'} PMS Mobile Staff • v{Constants.expoConfig?.version || '1.0.0'}
        </Text>
      </ScrollView>

      {/* Modal Chỉnh Sửa Thông Tin Cá Nhân */}
      <EditProfileModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        user={user}
        onSuccess={refreshProfile}
      />

      {/* Modal Đổi Mật Khẩu */}
      <ChangePasswordModal
        visible={passwordModalVisible}
        onClose={() => setPasswordModalVisible(false)}
      />

      {/* Modal Cấu Hình IP Máy Chủ */}
      <ServerConfigModal
        visible={serverModalVisible}
        onClose={() => setServerModalVisible(false)}
        apiUrl={apiUrl}
        onSaveUrl={async (url) => {
          await updateServerUrl(url);
          await Promise.all([refreshHotelSettings(), measureLatency()]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Thành công', `Đã cập nhật máy chủ:\n${url}`);
        }}
      />

      {/* Modal Cập Nhật Sổ Bàn Giao Ca Trực */}
      <HandoverNoteModal
        visible={handoverModalVisible}
        onClose={() => setHandoverModalVisible(false)}
        handoverNote={handoverNote}
        onSaveSuccess={(saved) => setHandoverNote(saved)}
      />

      {/* Modal Hồ Sơ Khách Hàng (CRM & Lịch Sử) */}
      <CustomerCrmModal
        visible={crmModalVisible}
        onClose={() => setCrmModalVisible(false)}
        initialGuestId={crmGuestId}
      />

      {/* Modal Hàng Đợi Ngoại Tuyến */}
      <OfflineQueueModal
        visible={offlineModalVisible}
        onClose={() => setOfflineModalVisible(false)}
      />

      {/* Modal Quản Lý Đặt Phòng & Lịch Lưu Trú (Timeline) */}
      <BookingManagementModal
        visible={bookingModalVisible}
        onClose={() => setBookingModalVisible(false)}
        onSelectGuest={
          canAccessCrm
            ? (guestId) => {
                setCrmGuestId(guestId);
                setBookingModalVisible(false);
                setCrmModalVisible(true);
              }
            : undefined
        }
      />

      {/* Modal Bảng Điều Hành & Doanh Thu + Điểm Nóng Hiện Trường */}
      <ExecutiveDashboardModal
        visible={executiveModalVisible}
        onClose={() => setExecutiveModalVisible(false)}
        onNavigateTab={(route) => router.navigate(route)}
        onSelectVipGuest={(guestId) => {
          setCrmGuestId(guestId);
          setCrmModalVisible(true);
        }}
      />

      {/* Modal Danh Bạ & Ca Trực Nhân Sự */}
      <StaffDirectoryModal
        visible={staffDirModalVisible}
        onClose={() => setStaffDirModalVisible(false)}
      />
    </SafeAreaView>
  );
}
