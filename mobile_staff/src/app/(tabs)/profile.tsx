import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme } from '../../contexts/ThemeContext';
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
  createProfileStyles,
} from '../../components/profile';
import { useOfflineQueueCount } from '../../services/offlineQueue';

export default function ProfileScreen() {
  const { user, logout, apiUrl, updateServerUrl, refreshProfile } = useAuth();
  const { themeMode, resolvedTheme, isDark, colors, hotelStars, hotelName, refreshHotelSettings, setThemeMode } = useAppTheme();
  const offlineQueueCount = useOfflineQueueCount();
  const [offlineModalVisible, setOfflineModalVisible] = useState(false);
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

  // Sổ bàn giao ca trực (Shift Handover Note)
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverModalVisible, setHandoverModalVisible] = useState(false);

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
      const saved = await SecureStore.getItemAsync('staff_shift_handover_note');
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

  const handleRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([refreshProfile(), measureLatency(), refreshHotelSettings()]);
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
        'Máy chủ đã phát lệnh thông báo đẩy! Hãy thử vuốt ra màn hình chính hoặc khóa màn hình iPhone để kiểm tra chuông & rung.'
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
      case 'housekeeper':
        return 'Nhân viên Buồng phòng (Housekeeping)';
      case 'service_staff':
        return 'Nhân viên Phục vụ & Đội xe (Service/Driver)';
      case 'technician':
        return 'Kỹ thuật viên Bảo trì (Technician)';
      case 'receptionist':
        return 'Lễ tân Khách sạn (Receptionist)';
      case 'manager':
        return 'Quản lý Vận hành (Manager)';
      default:
        return role || 'Nhân viên Khách sạn';
    }
  };

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Nhân viên ca trực';

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      {/* 1. Header Khách Sạn & Chuông Thông Báo */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandSubtitle} numberOfLines={1} ellipsizeMode="tail">
            {hotelName.toUpperCase()} • {hotelStars} SAO
          </Text>
          <Text style={styles.greetingTitle}>Hồ Sơ Cá Nhân</Text>
        </View>
        <View style={styles.headerRightActions}>
          <NotificationBell />
          <TouchableOpacity style={styles.refreshCircleBtn} onPress={handleRefresh} activeOpacity={0.7}>
            <Ionicons name="refresh" size={18} color="#F59E0B" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. Thẻ Căn Cước Nhân Viên & Hiệu Suất Ca Trực (Master Staff Badge) */}
        <View style={styles.idCard}>
          <View style={styles.cardGoldTrim} />

          <View style={styles.idCardTop}>
            <View style={styles.avatarGlow}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.staffName} numberOfLines={1}>
                  {fullName}
                </Text>
                <TouchableOpacity onPress={openEditModal} activeOpacity={0.7} style={styles.quickEditBtn}>
                  <Ionicons name="create-outline" size={12} color={colors.gold} style={{ marginRight: 3 }} />
                  <Text style={styles.quickEditBtnText}>Sửa</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.staffUsername}>
                @{user?.username} • ID: {user?.employee_code || `NV-${user?.id || '01'}`}
              </Text>
            </View>
          </View>

          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.gold} style={{ marginRight: 6 }} />
            <Text style={styles.roleBadgeText} numberOfLines={1}>
              {getRoleDisplayName(user?.role)}
            </Text>
          </View>

          {/* Dải thông tin cơ bản: Bộ phận • Ca trực • SĐT */}
          <View style={styles.staffMetaRow}>
            <View style={styles.metaChip}>
              <Ionicons name="git-network-outline" size={12} color={colors.sky} style={{ marginRight: 4 }} />
              <Text style={styles.metaChipText} numberOfLines={1}>{user?.department || 'Khối Vận Hành'}</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={12} color={colors.emerald} style={{ marginRight: 4 }} />
              <Text style={styles.metaChipText} numberOfLines={1}>{user?.shift || 'Ca Sáng'}</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="call-outline" size={12} color={colors.gold} style={{ marginRight: 4 }} />
              <Text style={styles.metaChipText} numberOfLines={1}>{user?.phone_number || 'Chưa có SĐT'}</Text>
            </View>
          </View>

          {/* Hàng 3 chỉ số vận hành thực tế của tài khoản & kết nối */}
          <View style={styles.idKpiRow}>
            <View style={styles.idKpiCol}>
              <Text style={styles.idKpiVal}>
                {user?.employee_code || `NV-${user?.id || '01'}`}
              </Text>
              <Text style={styles.idKpiLbl}>Mã nhân sự</Text>
            </View>
            <View style={styles.idKpiDivider} />
            <View style={styles.idKpiCol}>
              <Text style={[styles.idKpiVal, { color: colors.emerald }]} numberOfLines={1}>
                {user?.shift || 'Ca Sáng'}
              </Text>
              <Text style={styles.idKpiLbl}>Ca làm việc</Text>
            </View>
            <View style={styles.idKpiDivider} />
            <View style={styles.idKpiCol}>
              <Text style={[styles.idKpiVal, { color: colors.sky }]}>
                {serverLatency !== null ? `${serverLatency}ms` : '4G/WiFi'}
              </Text>
              <Text style={styles.idKpiLbl}>Độ trễ API</Text>
            </View>
          </View>

          <View style={styles.shiftActiveBar}>
            <View style={styles.pulseDot} />
            <Text style={styles.shiftActiveText}>
              ĐANG TRỰC CA • {serverLatency !== null ? `PING ${serverLatency}ms` : 'HỆ THỐNG ĐỒNG BỘ 4G'}
            </Text>
          </View>
        </View>

        {/* 2. Bộ Chuyển Đổi Giao Diện Nhanh (Theme Segmented Bar) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Giao Diện Hệ Thống</Text>
          <View style={styles.themeSegmentedBar}>
            <TouchableOpacity
              style={[styles.themeSegmentBtn, themeMode === 'dark' && styles.themeSegmentBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setThemeMode('dark');
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="moon"
                size={14}
                color={themeMode === 'dark' ? colors.gold : colors.textMuted}
                style={{ marginRight: 5 }}
              />
              <Text style={[styles.themeSegmentText, themeMode === 'dark' && styles.themeSegmentTextActive]}>
                Tối (Obsidian)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.themeSegmentBtn, themeMode === 'light' && styles.themeSegmentBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setThemeMode('light');
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="sunny"
                size={14}
                color={themeMode === 'light' ? colors.gold : colors.textMuted}
                style={{ marginRight: 5 }}
              />
              <Text style={[styles.themeSegmentText, themeMode === 'light' && styles.themeSegmentTextActive]}>
                Sáng (Luxury)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.themeSegmentBtn, themeMode === 'system' && styles.themeSegmentBtnActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setThemeMode('system');
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="phone-portrait-outline"
                size={14}
                color={themeMode === 'system' ? colors.gold : colors.textMuted}
                style={{ marginRight: 5 }}
              />
              <Text style={[styles.themeSegmentText, themeMode === 'system' && styles.themeSegmentTextActive]}>
                Hệ Thống
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Nghiệp Vụ Vận Hành Khách Sạn & Sổ Ca (PMS / CRM) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Nghiệp Vụ & Sổ Ca Trực</Text>

          {/* Sổ Bàn Giao Ca Trực */}
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
              <Text style={styles.actionTitle}>Sổ Bàn Giao Ca Trực {hotelStars} Sao</Text>
              <Text style={styles.actionDesc} numberOfLines={1}>
                {handoverNote ? `Lưu ý: "${handoverNote}"` : 'Chạm để cập nhật ghi chú bàn giao ca tiếp theo'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </TouchableOpacity>

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
        </View>

        {/* 4. Cài Đặt Tài Khoản & Kết Nối */}
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

          {/* Thử Nghiệm Chuông iPhone */}
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
              <Text style={styles.actionTitle}>Thử Nghiệm Chuông iPhone</Text>
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
          TA Luxury PMS Mobile Staff • v2.4.0 (Build 2026)
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
        onSelectGuest={(guestId) => {
          setCrmGuestId(guestId);
          setBookingModalVisible(false);
          setCrmModalVisible(true);
        }}
      />
    </SafeAreaView>
  );
}
