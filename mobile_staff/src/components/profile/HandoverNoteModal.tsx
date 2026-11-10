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
import * as SecureStore from 'expo-secure-store';
import { useAppTheme } from '../../contexts/ThemeContext';

interface HandoverNoteModalProps {
  visible: boolean;
  onClose: () => void;
  handoverNote: string;
  onSaveSuccess: (savedNote: string) => void;
}

export default function HandoverNoteModal({
  visible,
  onClose,
  handoverNote,
  onSaveSuccess,
}: HandoverNoteModalProps) {
  const { colors, isDark } = useAppTheme();
  const [tempHandoverNote, setTempHandoverNote] = useState(handoverNote);
  const [savingHandover, setSavingHandover] = useState(false);

  useEffect(() => {
    if (visible) {
      setTempHandoverNote(handoverNote);
    }
  }, [visible, handoverNote]);

  const handleSaveHandover = async () => {
    try {
      setSavingHandover(true);
      await SecureStore.setItemAsync('staff_shift_handover_note', tempHandoverNote.trim());
      onSaveSuccess(tempHandoverNote.trim());
      onClose();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Thành công', 'Đã cập nhật sổ bàn giao ca trực!');
    } catch {
      Alert.alert('Lỗi', 'Không thể lưu ghi chú.');
    } finally {
      setSavingHandover(false);
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
            <Text style={[styles.modalTitle, { color: colors.text }]}>Sổ Bàn Giao Ca Trực</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.modalDesc, { color: colors.textMuted }]}>
            Nhập nội dung lưu ý nghiệp vụ cho ca trực tiếp theo:
          </Text>
          <TextInput
            style={[
              styles.modalInput,
              styles.handoverModalInput,
              { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text },
            ]}
            value={tempHandoverNote}
            onChangeText={setTempHandoverNote}
            placeholder="VD: Phòng 402 khách VIP yêu cầu thêm 2 gối lông vũ lúc 15h. Máy lạnh 502 đã bảo trì xong nhưng cần theo dõi..."
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
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
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalDesc: {
    fontSize: 12,
    marginBottom: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 13,
    marginBottom: 12,
  },
  handoverModalInput: {
    height: 110,
    paddingTop: 12,
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
    minWidth: 100,
  },
  modalSaveText: {
    color: '#0A0F1D',
    fontSize: 13,
    fontWeight: '800',
  },
});

