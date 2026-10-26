import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../contexts/AuthContext';

interface DemoAccount {
  label: string;
  role: string;
  username: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: 'Hoa (Buồng phòng)', role: 'Dọn phòng', username: 'buongphong_hoa', icon: 'bed' },
  { label: 'An (Đội xe & Phục vụ)', role: 'Tài xế / F&B', username: 'phucvu_an', icon: 'car-sport' },
  { label: 'Dũng (Kỹ thuật)', role: 'Bảo trì', username: 'kythuat_dung', icon: 'construct' },
];

export default function LoginScreen() {
  const { login, apiUrl, updateServerUrl } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Modal cấu hình IP máy chủ
  const [modalVisible, setModalVisible] = useState(false);
  const [tempUrl, setTempUrl] = useState(apiUrl);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      Alert.alert('Thông báo', 'Vui lòng nhập tài khoản và mật khẩu.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const res = await login(username, password);
    setLoading(false);

    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const role = res.user?.role;
      if (role === 'technician') {
        router.replace('/(tabs)/maintenance');
      } else if (role === 'service_staff') {
        router.replace('/(tabs)/services');
      } else {
        router.replace('/(tabs)/housekeeping');
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Đăng nhập thất bại', res.message || 'Sai thông tin đăng nhập.');
    }
  };

  const selectDemoAccount = (acc: DemoAccount) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUsername(acc.username);
    setPassword('123456');
  };

  const handleSaveUrl = async () => {
    if (!tempUrl.trim()) return;
    await updateServerUrl(tempUrl.trim());
    setModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Thành công', `Đã cập nhật máy chủ:\n${tempUrl.trim()}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header Nút cấu hình IP góc trên phải */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.serverButton}
              onPress={() => {
                setTempUrl(apiUrl);
                setModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="wifi" size={15} color="#F59E0B" />
              <Text style={styles.serverButtonText}>Máy chủ API</Text>
            </TouchableOpacity>
          </View>

          {/* Logo & Tiêu đề Khách sạn */}
          <View style={styles.logoSection}>
            <View style={styles.logoOuterGlow}>
              <View style={styles.logoBadge}>
                <Ionicons name="business" size={38} color="#F59E0B" />
              </View>
            </View>
            <Text style={styles.brandTitle}>TA LUXURY HOTEL</Text>
            <Text style={styles.brandSubtitle}>HỆ THỐNG ĐIỀU HÀNH HIỆN TRƯỜNG</Text>
            <Text style={styles.brandDescription}>
              Buồng phòng • Đội xe • Phục vụ • Kỹ thuật
            </Text>
          </View>

          {/* Form đăng nhập */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Đăng Nhập Ca Trực</Text>

            {/* Input Tài khoản */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tên tài khoản / Mã nhân viên</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nhập tên đăng nhập nhân viên..."
                  placeholderTextColor="#475569"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Input Mật khẩu */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mật khẩu bảo mật</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Nhập mật khẩu..."
                  placeholderTextColor="#475569"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Nút bấm Đăng nhập */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#0A0F1D" />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.loginButtonText}>BẮT ĐẦU CA TRỰC</Text>
                  <Ionicons name="arrow-forward" size={17} color="#0A0F1D" />
                </View>
              )}
            </TouchableOpacity>

            {/* Chọn nhanh tài khoản mẫu */}
            <View style={styles.demoSection}>
              <Text style={styles.demoSectionTitle}>Chọn nhanh ca trực thử nghiệm (1 chạm):</Text>
              <View style={styles.demoChipsContainer}>
                {DEMO_ACCOUNTS.map((acc) => (
                  <TouchableOpacity
                    key={acc.username}
                    style={[
                      styles.demoChip,
                      username === acc.username && styles.demoChipActive,
                    ]}
                    onPress={() => selectDemoAccount(acc)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={acc.icon}
                      size={14}
                      color={username === acc.username ? '#F59E0B' : '#94A3B8'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.demoChipText,
                        username === acc.username && styles.demoChipTextActive,
                      ]}
                    >
                      {acc.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.apiUrlNote} numberOfLines={1}>
              Kết nối: {apiUrl}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal Cấu hình IP Máy chủ */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="cloud-done-outline" size={24} color="#F59E0B" />
              <Text style={styles.modalTitle}>Máy Chủ API Khách Sạn</Text>
            </View>
            <Text style={styles.modalDesc}>
              Nhập địa chỉ Backend (Tunnel Ngrok HTTPS để chạy 4G hoặc IP Wi-Fi nội bộ):
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

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveUrl}
                activeOpacity={0.8}
              >
                <Text style={styles.modalSaveText}>Lưu & Kết Nối</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1D', // Obsidian cao cấp sâu thẳm
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  topBar: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  serverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  serverButtonText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoOuterGlow: {
    padding: 6,
    borderRadius: 50,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    marginBottom: 14,
  },
  logoBadge: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#111827',
    borderWidth: 2,
    borderColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 2.5,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 1.8,
    marginTop: 4,
  },
  brandDescription: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
  },
  formCard: {
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1F2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 18,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0F1D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 14,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
  },
  eyeButton: {
    padding: 6,
  },
  loginButton: {
    backgroundColor: '#F59E0B',
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#0A0F1D',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    marginRight: 6,
  },
  demoSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  demoSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 10,
  },
  demoChipsContainer: {
    gap: 8,
  },
  demoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0F1D',
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  demoChipActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  demoChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  demoChipTextActive: {
    color: '#F59E0B',
  },
  apiUrlNote: {
    fontSize: 10,
    color: '#475569',
    textAlign: 'center',
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
    marginLeft: 10,
  },
  modalDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 14,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: '#0A0F1D',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    color: '#F8FAFC',
    fontSize: 13,
    marginBottom: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
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
  },
  modalSaveText: {
    color: '#0A0F1D',
    fontSize: 13,
    fontWeight: '900',
  },
});
