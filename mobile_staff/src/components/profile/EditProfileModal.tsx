import React, { useState, useEffect } from 'react';
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

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: any;
  onSuccess: () => Promise<void>;
}

export default function EditProfileModal({
  visible,
  onClose,
  user,
  onSuccess,
}: EditProfileModalProps) {
  const { colors, isDark } = useAppTheme();
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (visible && user) {
      setEditFirstName(user.first_name || '');
      setEditLastName(user.last_name || '');
      setEditPhone(user.phone_number || '');
      setEditAddress(user.address || '');
    }
  }, [visible, user]);

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
      await onSuccess();
      onClose();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Thành công', 'Hồ sơ cá nhân đã được cập nhật.');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.detail || 'Không thể lưu thay đổi.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.modalOverlay,
          { backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(15, 23, 42, 0.45)' },
        ]}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.modalHeaderRow}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Cập Nhật Hồ Sơ</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Họ đệm</Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={editFirstName}
            onChangeText={setEditFirstName}
            placeholder="VD: Nguyễn Văn"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          />

          <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Tên</Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={editLastName}
            onChangeText={setEditLastName}
            placeholder="VD: An"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          />

          <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Số điện thoại</Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={editPhone}
            onChangeText={setEditPhone}
            placeholder="VD: 0912345678"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            keyboardType="phone-pad"
          />

          <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Địa chỉ thường trú</Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={editAddress}
            onChangeText={setEditAddress}
            placeholder="VD: Hà Nội, Việt Nam"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          />

          <View style={styles.modalBtnRow}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, { backgroundColor: colors.gold }]}
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
    minWidth: 100,
  },
  modalSaveText: {
    color: '#0A0F1D',
    fontSize: 13,
    fontWeight: '800',
  },
});

