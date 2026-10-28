import React, { useState, useEffect } from 'react';
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
import apiClient from '../../api/client';
import NotificationBell from '../../components/NotificationBell';
import CustomerCrmModal from '../../components/CustomerCrmModal';
import BookingManagementModal from '../../components/BookingManagementModal';

export default function ProfileScreen() {
  const { user, logout, apiUrl, updateServerUrl, refreshProfile } = useAuth();
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
        {/* 2. Thẻ Căn Cước Nhân Viên Cao Cấp (Staff Identity Badge) */}
        <View style={styles.idCard}>
          <View style={styles.cardGoldTrim} />

          <View style={styles.idCardTop}>
            <View style={styles.avatarGlow}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons name="person" size={32} color="#F59E0B" />
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
              <Text style={styles.staffName} numberOfLines={1}>
                {fullName}
              </Text>
              <Text style={styles.staffUsername}>@{user?.username} • ID: NV-{user?.employee_code || user?.id || '01'}</Text>
            </View>
          </View>

          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#F59E0B" style={{ marginRight: 6 }} />
            <Text style={styles.roleBadgeText} numberOfLines={1}>
              {getRoleDisplayName(user?.role)}
            </Text>
          </View>

          <View style={styles.shiftActiveBar}>
            <View style={styles.pulseDot} />
            <Text style={styles.shiftActiveText}>
              ĐANG TRỰC CA • {serverLatency !== null ? `PING ${serverLatency}ms` : 'HỆ THỐNG ĐỒNG BỘ 4G'}
            </Text>
          </View>
        </View>

        {/* 3. Khối Thông Tin Chi Tiết Nhân Sự */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>📋 Chi Tiết Hồ Sơ Nhân Sự</Text>
            <TouchableOpacity onPress={openEditModal} activeOpacity={0.7} style={styles.editBtn}>
              <Ionicons name="create-outline" size={14} color="#F59E0B" style={{ marginRight: 3 }} />
              <Text style={styles.editBtnText}>Chỉnh sửa</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.detailItem}>
            <View style={styles.detailIconBox}>
              <Ionicons name="business" size={16} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Đơn vị công tác</Text>
              <Text style={styles.detailValue}>TA Luxury Hotel & Resort</Text>
            </View>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailItem}>
            <View style={styles.detailIconBox}>
              <Ionicons name="git-network" size={16} color="#60A5FA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Phòng ban / Bộ phận</Text>
              <Text style={styles.detailValue}>{user?.department || 'Khối Vận Hành Khách Sạn'}</Text>
            </View>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailItem}>
            <View style={styles.detailIconBox}>
              <Ionicons name="time" size={16} color="#34D399" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Ca làm việc hôm nay</Text>
              <Text style={styles.detailValue}>{user?.shift || 'Ca Sáng (06:00 - 14:30)'}</Text>
            </View>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailItem}>
            <View style={styles.detailIconBox}>
              <Ionicons name="call" size={16} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Số điện thoại liên lạc</Text>
              <Text style={styles.detailValue}>{user?.phone_number || 'Chưa cập nhật'}</Text>
            </View>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailItem}>
            <View style={styles.detailIconBox}>
              <Ionicons name="mail" size={16} color="#A78BFA" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Email công vụ</Text>
              <Text style={styles.detailValue}>{user?.email || 'Chưa cập nhật'}</Text>
            </View>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailItem}>
            <View style={styles.detailIconBox}>
              <Ionicons name="location" size={16} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Địa chỉ thường trú</Text>
              <Text style={styles.detailValue}>{user?.address || 'Hà Nội, Việt Nam'}</Text>
            </View>
          </View>
        </View>

        {/* 4. Chỉ Số Năng Suất & Hiệu Suất Ca Trực */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>⚡ Năng Suất & Hiệu Suất Ca Trực</Text>
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiNumber}>4.98<Text style={styles.kpiUnit}>/5</Text></Text>
              <Text style={styles.kpiLabel}>Đánh giá dịch vụ</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={[styles.kpiNumber, { color: '#34D399' }]}>99.4%</Text>
              <Text style={styles.kpiLabel}>Tỉ lệ hoàn thành</Text>
            </View>

            <View style={styles.kpiCard}>
              <Text style={[styles.kpiNumber, { color: '#60A5FA' }]}>100%</Text>
              <Text style={styles.kpiLabel}>Đúng giờ ca trực</Text>
            </View>
          </View>
        </View>

        {/* 4b. Nghiệp Vụ Vận Hành Khách Sạn (PMS & CRM) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🏛️ Vận Hành Khách Sạn & Tra Cứu (PMS / CRM)</Text>

          {/* Hồ sơ khách hàng CRM */}
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
              <Ionicons name="people-outline" size={18} color="#38BDF8" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionTitle}>Tra Cứu Khách Hàng (CRM & Lịch Sử)</Text>
              <Text style={styles.actionDesc}>Tra cứu hạng thẻ VIP, lịch sử lưu trú & dùng dịch vụ</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
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
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Ionicons name="calendar-outline" size={18} color="#F59E0B" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionTitle}>Quản Lý Đặt Phòng & Lịch Lưu Trú</Text>
              <Text style={styles.actionDesc}>Xem danh sách đơn phòng & sơ đồ timeline tháng</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* 4c. Sổ Bàn Giao Ca Trực 5 Sao (Shift Handover Logbook) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>📝 Sổ Bàn Giao Ca Trực 5 Sao</Text>
            <TouchableOpacity
              onPress={() => {
                setTempHandoverNote(handoverNote);
                setHandoverModalVisible(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
              style={styles.editBtn}
            >
              <Ionicons name="create-outline" size={14} color="#F59E0B" style={{ marginRight: 3 }} />
              <Text style={styles.editBtnText}>Cập nhật ghi chú</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.handoverDesc}>
            Lưu ý nghiệp vụ, phòng VIP hoặc sự cố cần bàn giao cho nhân viên ca tiếp theo:
          </Text>
          <TouchableOpacity
            style={styles.handoverBox}
            onPress={() => {
              setTempHandoverNote(handoverNote);
              setHandoverModalVisible(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name={handoverNote ? 'clipboard' : 'clipboard-outline'}
              size={18}
              color={handoverNote ? '#F59E0B' : '#64748B'}
              style={{ marginRight: 10, marginTop: 2 }}
            />
            <Text style={handoverNote ? styles.handoverText : styles.handoverPlaceholder} numberOfLines={3}>
              {handoverNote || 'Chưa có ghi chú bàn giao ca nào. Hãy chạm để thêm lưu ý quan trọng cho ca tiếp theo...'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 5. Cài Đặt Tài Khoản & Tiện Ích */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>⚙️ Cài Đặt Tài Khoản & Kết Nối</Text>

          {/* Đổi Mật Khẩu */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => setPasswordModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Ionicons name="key-outline" size={18} color="#F59E0B" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionTitle}>Đổi Mật Khẩu</Text>
              <Text style={styles.actionDesc}>Cập nhật mật khẩu bảo mật tài khoản</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
          </TouchableOpacity>

          <View style={styles.detailDivider} />

          {/* Thử Nghiệm Chuông iPhone 14 Pro */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleTestPush}
            disabled={testingPush}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconBox, { backgroundColor: 'rgba(96, 165, 250, 0.12)' }]}>
              <Ionicons name="notifications-outline" size={18} color="#60A5FA" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionTitle}>Thử Nghiệm Chuông iPhone</Text>
              <Text style={styles.actionDesc}>Bắn thông báo đẩy tức thời để kiểm tra chuông & rung</Text>
            </View>
            {testingPush ? (
              <ActivityIndicator size="small" color="#60A5FA" />
            ) : (
              <Ionicons name="chevron-forward" size={18} color="#64748B" />
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
              <Ionicons name="server-outline" size={18} color="#34D399" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.actionTitle}>Máy Chủ API Khách Sạn</Text>
              <Text style={styles.actionDesc} numberOfLines={1}>
                {apiUrl} {serverLatency !== null ? `• Ping ${serverLatency}ms` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* 6. Nút Đăng Xuất & Kết Thúc Ca */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
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
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Họ đệm</Text>
            <TextInput
              style={styles.modalInput}
              value={editFirstName}
              onChangeText={setEditFirstName}
              placeholder="VD: Nguyễn Văn"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.inputLabel}>Tên</Text>
            <TextInput
              style={styles.modalInput}
              value={editLastName}
              onChangeText={setEditLastName}
              placeholder="VD: An"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.inputLabel}>Số điện thoại</Text>
            <TextInput
              style={styles.modalInput}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="VD: 0912345678"
              placeholderTextColor="#64748B"
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Địa chỉ thường trú</Text>
            <TextInput
              style={styles.modalInput}
              value={editAddress}
              onChangeText={setEditAddress}
              placeholder="VD: Hà Nội, Việt Nam"
              placeholderTextColor="#64748B"
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
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Mật khẩu hiện tại</Text>
            <TextInput
              style={styles.modalInput}
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="Nhập mật khẩu đang dùng"
              placeholderTextColor="#64748B"
              secureTextEntry
            />

            <Text style={styles.inputLabel}>Mật khẩu mới (tối thiểu 6 ký tự)</Text>
            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Nhập mật khẩu mới"
              placeholderTextColor="#64748B"
              secureTextEntry
            />

            <Text style={styles.inputLabel}>Xác nhận mật khẩu mới</Text>
            <TextInput
              style={styles.modalInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Nhập lại mật khẩu mới"
              placeholderTextColor="#64748B"
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
              placeholderTextColor="#64748B"
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
                <Ionicons name="close" size={22} color="#94A3B8" />
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
              placeholderTextColor="#64748B"
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 120 : 80,
  },
  idCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 18,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#1F2937',
    overflow: 'hidden',
  },
  cardGoldTrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3.5,
    backgroundColor: '#F59E0B',
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
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#111827',
  },
  avatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  staffName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  staffUsername: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 3,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
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
    color: '#F59E0B',
    flex: 1,
  },
  shiftActiveBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  shiftActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
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
    color: '#E2E8F0',
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
    color: '#F59E0B',
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
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    color: '#F8FAFC',
    fontWeight: '700',
    marginTop: 2,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#1F2937',
    marginVertical: 4,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  kpiNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F59E0B',
  },
  kpiUnit: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
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
    color: '#F8FAFC',
  },
  actionDesc: {
    fontSize: 11,
    color: '#64748B',
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
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  versionText: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 11,
    marginTop: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 22,
  },
  modalContent: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1F2937',
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
    color: '#F8FAFC',
  },
  modalDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 5,
    marginTop: 8,
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
    borderColor: '#1F2937',
  },
  modalCancelText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  modalSaveBtn: {
    backgroundColor: '#F59E0B',
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
    color: '#94A3B8',
    marginBottom: 10,
    lineHeight: 18,
  },
  handoverBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0A0F1D',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 14,
    padding: 14,
    minHeight: 64,
  },
  handoverText: {
    flex: 1,
    fontSize: 13,
    color: '#F8FAFC',
    lineHeight: 20,
    fontWeight: '500',
  },
  handoverPlaceholder: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  handoverModalInput: {
    height: 110,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
});
