import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';

interface ServerConfigModalProps {
  visible: boolean;
  onClose: () => void;
  apiUrl: string;
  onSaveUrl: (url: string) => Promise<void>;
}

export default function ServerConfigModal({
  visible,
  onClose,
  apiUrl,
  onSaveUrl,
}: ServerConfigModalProps) {
  const { colors, isDark } = useAppTheme();
  const [tempUrl, setTempUrl] = useState(apiUrl);

  useEffect(() => {
    if (visible) {
      setTempUrl(apiUrl);
    }
  }, [visible, apiUrl]);

  const handleSave = async () => {
    if (!tempUrl.trim()) {
      Alert.alert('Lỗi', 'URL máy chủ không được để trống.');
      return;
    }
    await onSaveUrl(tempUrl.trim());
    onClose();
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
          <Text style={[styles.modalTitle, { color: colors.text }]}>Cấu Hình Máy Chủ API</Text>
          <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
            Nhập đường dẫn API backend (Railway Cloud URL hoặc IP mạng LAN):
          </Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
            value={tempUrl}
            onChangeText={setTempUrl}
            placeholder="https://backend-production-59387ae6.up.railway.app/api"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            autoCapitalize="none"
            autoCorrect={false}
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
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Text style={styles.modalSaveText}>Lưu Cài Đặt</Text>
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
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalDesc: {
    fontSize: 12,
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 13,
    marginBottom: 12,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
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
  },
  modalSaveText: {
    color: '#0A0F1D',
    fontSize: 13,
    fontWeight: '800',
  },
});

