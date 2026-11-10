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
  Keyboard,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { LostFoundItem } from './LostFoundCard';

export interface ReturnLostFoundModalProps {
  visible: boolean;
  item: LostFoundItem | null;
  isDark?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReturnLostFoundModal: React.FC<ReturnLostFoundModalProps> = ({
  visible,
  item,
  isDark = true,
  onClose,
  onSuccess,
}) => {
  const [returnedTo, setReturnedTo] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    if (visible) {
      setReturnedTo('');
      setReturnNote('');
      setReturning(false);
    }
  }, [visible]);

  const handleReturn = async () => {
    if (!item) return;
    if (!returnedTo.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên người nhận lại đồ (Khách hàng).');
      return;
    }

    setReturning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await apiClient.post(`/rooms/lost-and-found/${item.id}/return/`, {
        returned_to: returnedTo.trim(),
        return_note: returnNote.trim(),
      });

      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Thành công', 'Đã cập nhật biên bản trao trả đồ cho khách!');
        onClose();
        onSuccess();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể cập nhật trao trả đồ.';
      Alert.alert('Lỗi', msg);
    } finally {
      setReturning(false);
    }
  };

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <View style={styles.modalOverlayCenter}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={Keyboard.dismiss}
          />
          <View style={[styles.modalCenterContent, !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', shadowColor: '#64748B' }]}>
            <Text style={[styles.modalTitle, !isDark && { color: '#0F172A' }]}>Bàn Giao Trả Khách</Text>
            <Text style={[styles.modalSubtitle, !isDark && { color: '#64748B' }]}>
              Vật phẩm: {item.item_name} (#{item.tracking_code})
            </Text>

            <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Họ tên người nhận lại (*):</Text>
            <TextInput
              style={[styles.modalInput, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
              placeholder="VD: Anh Tuấn (SĐT: 0912...)"
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={returnedTo}
              onChangeText={setReturnedTo}
            />

            <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Ghi chú biên bản bàn giao:</Text>
            <TextInput
              style={[styles.modalInput, { height: 50 }, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
              placeholder="Khách đã kiểm tra đủ tài sản..."
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              value={returnNote}
              onChangeText={setReturnNote}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, !isDark && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalCancelText, !isDark && { color: '#64748B' }]}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleReturn}
                disabled={returning}
                activeOpacity={0.8}
              >
                {returning ? (
                  <ActivityIndicator color="#0A0F1D" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Xác Nhận Đã Trả</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCenterContent: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    marginTop: 10,
    marginBottom: 6,
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
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalCancelText: {
    color: '#CBD5E1',
    fontSize: 12.5,
    fontWeight: '700',
  },
  modalSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F59E0B',
  },
  modalSaveText: {
    color: '#0A0F1D',
    fontSize: 12.5,
    fontWeight: '800',
  },
});

