import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Image,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme, ThemeColors } from '../../contexts/ThemeContext';
import apiClient from '../../api/client';
import NotificationBell from '../../components/NotificationBell';
import CustomerCrmModal from '../../components/CustomerCrmModal';
import BookingManagementModal from '../../components/BookingManagementModal';

export default function ProfileScreen() {
  const { user, logout, apiUrl, updateServerUrl, refreshProfile } = useAuth();
  const { themeMode, resolvedTheme, isDark, colors, setThemeMode } = useAppTheme();
  const styles = useMemo(() => createThemedStyles(colors, isDark), [colors, isDark]);
  const [refreshing, setRefreshing] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  // Modal Hồ Sơ Khách Hàng (CRM & Lịch Sử)
  const [crmModalVisible, setCrmModalVisible] = useState(false);
  const [crmGuestId, setCrmGuestId] = useState<number | null>(null);

  // Modal Quản Lý Đặt Phòng & Lịch Lưu Trú
  const [bookingModalVisible, setBookingModalVisible] = useState(false);

  // Modal Đổi Mật Khẩu
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Modal Chỉnh Sửa Thông Tin Cá Nhân
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Đo độ trễ máy chủ API (ms)
  const [serverLatency, setServerLatency] = useState<number | null>(null);

  // Sổ bàn giao ca trực (Shift Handover Note)
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverModalVisible, setHandoverModalVisible] = useState(false);
  const [tempHandoverNote, setTempHandoverNote] = useState('');
  const [savingHandover, setSavingHandover] = useState(false);

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

  const handleSaveHandover = async () => {
    try {
      setSavingHandover(true);
      await SecureStore.setItemAsync('staff_shift_handover_note', tempHandoverNote.trim());
      setHandoverNote(tempHandoverNote.trim());
      setHandoverModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Thành công', 'Đã cập nhật sổ bàn giao ca trực!');
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu ghi chú.');
    } finally {
      setSavingHandover(false);
    }
  };

  // Modal Cấu Hình Máy Chủ API
  const [serverModalVisible, setServerModalVisible] = useState(false);
  const [tempUrl, setTempUrl] = useState(apiUrl);
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
    Alert.alert('Đổi ảnh đại diện 📸', 'Chọn phương thức cập nhật ảnh:', [
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
    await Promise.all([refreshProfile(), measureLatency()]);
    setRefreshing(false);
  };

  // Mở modal sửa thông tin cá nhân
  const openEditModal = () => {
    setEditFirstName(user?.first_name || '');
    setEditLastName(user?.last_name || '');
    setEditPhone(user?.phone_number || '');
    setEditAddress(user?.address || '');
    setEditModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Lưu thông tin cá nhân lên backend
  const handleSaveProfile = async () => {
    if (!editFirstName.trim() && !editLastName.trim()) {
      Alert.alert('Lưu ý', 'Vui lòng nhập họ và tên.');
      return;
    }
    setSavingEdit(true);
    try {
      await apiClient.patch('/users/me/', {
        first_name: editFirstName.trim(),
        last_name: editLastName.trim(),
        phone_number: editPhone.trim(),
        address: editAddress.trim(),
      });
      await refreshProfile();
      setEditModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Thành công', 'Hồ sơ cá nhân đã được cập nhật.');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.detail || 'Không thể lưu thay đổi.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSavingEdit(false);
    }
  };

  // Thực hiện đổi mật khẩu
  const handleChangePassword = async () => {
    if (!oldPassword.trim()) {
      Alert.alert('Lưu ý', 'Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (!newPassword.trim() || newPassword.length < 6) {
      Alert.alert('Lưu ý', 'Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Lưu ý', 'Xác nhận mật khẩu mới không trùng khớp.');
      return;
    }

    setChangingPassword(true);
    try {
      await apiClient.post('/users/change-password/', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Thành công', 'Đổi mật khẩu thành công. Vui lòng ghi nhớ mật khẩu mới!');
      setPasswordModalVisible(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.old_password?.[0] || 'Mật khẩu cũ không chính xác.';
      Alert.alert('Lỗi', msg);
    } finally {
      setChangingPassword(false);
    }
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

  // Lưu cấu hình máy chủ API
  const handleSaveUrl = async () => {
    if (!tempUrl.trim()) return;
    await updateServerUrl(tempUrl.trim());
    setServerModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Thành công', `Đã cập nhật máy chủ:\n${tempUrl.trim()}`);
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
          <Text style={styles.brandSubtitle}>TA LUXURY HOTEL</Text>
          <Text style={styles.greetingTitle}>Hồ Sơ Cá Nhân 👤</Text>
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
              <Text style={styles.staffUsername}>@{user?.username} • ID: NV-{user?.employee_code || user?.id || '01'}</Text>
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

          {/* Hàng 3 chỉ số KPI mini tích hợp */}
          <View style={styles.idKpiRow}>
            <View style={styles.idKpiCol}>
              <Text style={styles.idKpiVal}>4.98<Text style={styles.idKpiUnit}>/5</Text></Text>
              <Text style={styles.idKpiLbl}>⭐ Đánh giá</Text>
            </View>
            <View style={styles.idKpiDivider} />
            <View style={styles.idKpiCol}>
              <Text style={[styles.idKpiVal, { color: colors.emerald }]}>99.4%</Text>
              <Text style={styles.idKpiLbl}>🎯 Hoàn thành</Text>
            </View>
            <View style={styles.idKpiDivider} />
            <View style={styles.idKpiCol}>
              <Text style={[styles.idKpiVal, { color: colors.sky }]}>100%</Text>
              <Text style={styles.idKpiLbl}>⏱️ Đúng giờ</Text>
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
          <Text style={styles.sectionTitle}>🎨 Giao Diện Hệ Thống</Text>
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
          <Text style={styles.sectionTitle}>🏛️ Nghiệp Vụ & Sổ Ca Trực</Text>

          {/* Sổ Bàn Giao Ca Trực */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              setTempHandoverNote(handoverNote);
              setHandoverModalVisible(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Ionicons name="clipboard-outline" size={17} color={colors.gold} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionTitle}>Sổ Bàn Giao Ca Trực 5 Sao</Text>
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
          <Text style={styles.sectionTitle}>⚙️ Tài Khoản & Kết Nối</Text>

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

          {/* Cấu hình Máy Chủ API */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              setTempUrl(apiUrl);
              setServerModalVisible(true);
            }}
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
      <Modal visible={editModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Cập Nhật Hồ Sơ</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={22} color={isDark ? "#94A3B8" : "#64748B"} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Họ đệm</Text>
            <TextInput
              style={styles.modalInput}
              value={editFirstName}
              onChangeText={setEditFirstName}
              placeholder="VD: Nguyễn Văn"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
            />

            <Text style={styles.inputLabel}>Tên</Text>
            <TextInput
              style={styles.modalInput}
              value={editLastName}
              onChangeText={setEditLastName}
              placeholder="VD: An"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
            />

            <Text style={styles.inputLabel}>Số điện thoại</Text>
            <TextInput
              style={styles.modalInput}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="VD: 0912345678"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Địa chỉ thường trú</Text>
            <TextInput
              style={styles.modalInput}
              value={editAddress}
              onChangeText={setEditAddress}
              placeholder="VD: Hà Nội, Việt Nam"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveProfile}
                disabled={savingEdit}
                activeOpacity={0.8}
              >
                {savingEdit ? (
                  <ActivityIndicator color="#0A0F1D" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Lưu Hồ Sơ</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Đổi Mật Khẩu */}
      <Modal visible={passwordModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Đổi Mật Khẩu Tài Khoản</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <Ionicons name="close" size={22} color={isDark ? "#94A3B8" : "#64748B"} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Mật khẩu hiện tại</Text>
            <TextInput
              style={styles.modalInput}
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="Nhập mật khẩu đang dùng"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              secureTextEntry
            />

            <Text style={styles.inputLabel}>Mật khẩu mới (tối thiểu 6 ký tự)</Text>
            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Nhập mật khẩu mới"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              secureTextEntry
            />

            <Text style={styles.inputLabel}>Xác nhận mật khẩu mới</Text>
            <TextInput
              style={styles.modalInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Nhập lại mật khẩu mới"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              secureTextEntry
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPasswordModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleChangePassword}
                disabled={changingPassword}
                activeOpacity={0.8}
              >
                {changingPassword ? (
                  <ActivityIndicator color="#0A0F1D" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Đổi Mật Khẩu</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Cấu Hình IP Máy Chủ */}
      <Modal visible={serverModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cấu Hình Máy Chủ API</Text>
            <Text style={styles.modalDesc}>
              Nhập đường dẫn API backend (Ngrok HTTPS URL khi dùng 4G):
            </Text>
            <TextInput
              style={styles.modalInput}
              value={tempUrl}
              onChangeText={setTempUrl}
              placeholder="https://...ngrok-free.dev/api"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setServerModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveUrl}
                activeOpacity={0.8}
              >
                <Text style={styles.modalSaveText}>Lưu Cài Đặt</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Cập Nhật Sổ Bàn Giao Ca Trực */}
      <Modal visible={handoverModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Sổ Bàn Giao Ca Trực</Text>
              <TouchableOpacity onPress={() => setHandoverModalVisible(false)}>
                <Ionicons name="close" size={22} color={isDark ? "#94A3B8" : "#64748B"} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDesc}>
              Nhập nội dung lưu ý nghiệp vụ cho ca trực tiếp theo:
            </Text>
            <TextInput
              style={[styles.modalInput, styles.handoverModalInput]}
              value={tempHandoverNote}
              onChangeText={setTempHandoverNote}
              placeholder="VD: Phòng 402 khách VIP yêu cầu thêm 2 gối lông vũ lúc 15h. Máy lạnh 502 đã bảo trì xong nhưng cần theo dõi..."
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setHandoverModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveHandover}
                disabled={savingHandover}
                activeOpacity={0.8}
              >
                {savingHandover ? (
                  <ActivityIndicator color="#0A0F1D" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Lưu Sổ Ca</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Hồ Sơ Khách Hàng (CRM & Lịch Sử) */}
      <CustomerCrmModal
        visible={crmModalVisible}
        onClose={() => setCrmModalVisible(false)}
        initialGuestId={crmGuestId}
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

const createThemedStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    safeContainer: {
      flex: 1,
      backgroundColor: colors.background,
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
      color: colors.gold,
      letterSpacing: 1.5,
    },
    greetingTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      marginTop: 2,
    },
    headerRightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    refreshCircleBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: Platform.OS === 'ios' ? 120 : 80,
    },
    idCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 18,
      marginTop: 6,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    cardGoldTrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3.5,
      backgroundColor: colors.gold,
    },
    idCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    avatarGlow: {
      padding: 3,
      borderRadius: 32,
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      position: 'relative',
    },
    changeAvatarBtn: {
      position: 'absolute',
      bottom: -1,
      right: -1,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.card,
    },
    avatarFallback: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.backgroundElement,
      borderWidth: 1.5,
      borderColor: colors.gold,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarImage: {
      width: 58,
      height: 58,
      borderRadius: 29,
      borderWidth: 1.5,
      borderColor: colors.gold,
    },
    staffName: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: 0.3,
    },
    staffUsername: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 3,
    },
    roleBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.3)',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      marginBottom: 10,
    },
    roleBadgeText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.gold,
      flex: 1,
    },
    quickEditBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.15)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    quickEditBtnText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.gold,
    },
    staffMetaRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 12,
    },
    metaChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundElement,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    metaChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
    },
    idKpiRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      marginBottom: 12,
    },
    idKpiCol: {
      flex: 1,
      alignItems: 'center',
    },
    idKpiVal: {
      fontSize: 15,
      fontWeight: '900',
      color: colors.gold,
    },
    idKpiUnit: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
    },
    idKpiLbl: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textMuted,
      marginTop: 2,
    },
    idKpiDivider: {
      width: 1,
      height: 24,
      backgroundColor: colors.border,
    },
    shiftActiveBar: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    pulseDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.emerald,
      marginRight: 6,
    },
    shiftActiveText: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#34D399' : '#059669',
      letterSpacing: 0.5,
    },
    sectionCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      marginTop: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 10,
    },
    editBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    editBtnText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.gold,
    },
    detailItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },
    detailIconBox: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.backgroundElement,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    detailLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
    detailValue: {
      fontSize: 13,
      color: colors.text,
      fontWeight: '700',
      marginTop: 2,
    },
    detailDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    themeSegmentedBar: {
      flexDirection: 'row',
      backgroundColor: colors.backgroundElement,
      borderRadius: 12,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      gap: 6,
    },
    themeSegmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderRadius: 9,
    },
    themeSegmentBtnActive: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.4)',
      shadowColor: colors.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    themeSegmentText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
    },
    themeSegmentTextActive: {
      color: colors.gold,
      fontWeight: '800',
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
    },
    actionIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
    },
    actionDesc: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(239, 68, 68, 0.3)',
      borderRadius: 14,
      height: 48,
      marginTop: 18,
    },
    logoutButtonText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.rose,
      letterSpacing: 0.5,
    },
    versionText: {
      textAlign: 'center',
      color: colors.textSubtle,
      fontSize: 11,
      marginTop: 16,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(15, 23, 42, 0.45)',
      justifyContent: 'center',
      padding: 22,
    },
    modalContent: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 22,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadowColor,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.35 : 0.08,
      shadowRadius: 18,
      elevation: 8,
    },
    modalHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    modalDesc: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 14,
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 5,
      marginTop: 8,
    },
    modalInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 44,
      color: colors.text,
      fontSize: 13,
    },
    modalBtnRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 18,
    },
    modalCancelBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? 'transparent' : '#F1F5F9',
    },
    modalCancelText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    modalSaveBtn: {
      backgroundColor: colors.gold,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      minWidth: 90,
      alignItems: 'center',
    },
    modalSaveText: {
      color: '#0A0F1D',
      fontSize: 13,
      fontWeight: '900',
    },
    handoverDesc: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 10,
      lineHeight: 18,
    },
    handoverBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.backgroundElement,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      minHeight: 64,
    },
    handoverText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
      lineHeight: 20,
      fontWeight: '500',
    },
    handoverPlaceholder: {
      flex: 1,
      fontSize: 12,
      color: colors.textSubtle,
      fontStyle: 'italic',
      lineHeight: 18,
    },
    handoverModalInput: {
      height: 110,
      paddingTop: 12,
      textAlignVertical: 'top',
    },
  });
