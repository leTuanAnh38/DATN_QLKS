import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { useAppTheme } from '../../contexts/ThemeContext';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({
  visible,
  onClose,
}: ChangePasswordModalProps) {
  const { colors, isDark } = useAppTheme();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const resetFields = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleClose = () => {
    resetFields();
    onClose();
  };

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
      handleClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.old_password?.[0] || 'Mật khẩu cũ không chính xác.';
      Alert.alert('Lỗi', msg);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.modalOverlay,
          { backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(15, 23, 42, 0.45)' },
        ]}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.modalHeaderRow}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Đổi Mật Khẩu Tài Khoản</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Mật khẩu hiện tại</Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={oldPassword}
            onChangeText={setOldPassword}
            placeholder="Nhập mật khẩu đang dùng"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            secureTextEntry
          />

          <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Mật khẩu mới (tối thiểu 6 ký tự)</Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Nhập mật khẩu mới"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            secureTextEntry
          />

          <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Xác nhận mật khẩu mới</Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Nhập lại mật khẩu mới"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            secureTextEntry
          />

          <View style={styles.modalBtnRow}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, { backgroundColor: colors.gold }]}
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
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 13,
    marginBottom: 10,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalSaveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  modalSaveText: {
    color: '#0A0F1D',
    fontSize: 13,
    fontWeight: '800',
  },
});

