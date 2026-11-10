import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { MaintenanceTicket } from './MaintenanceTicketCard';

export interface CancelMaintenanceModalProps {
  visible: boolean;
  ticket: MaintenanceTicket | null;
  isDark?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CancelMaintenanceModal: React.FC<CancelMaintenanceModalProps> = ({
  visible,
  ticket,
  isDark = true,
  onClose,
  onSuccess,
}) => {
  const [cancelReason, setCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  useEffect(() => {
    if (visible) {
      setCancelReason('');
      setSubmittingCancel(false);
    }
  }, [visible]);

  const handleCancelTicket = async () => {
    if (!ticket) return;
    if (!cancelReason.trim()) {
      Alert.alert('Thiếu lý do', 'Vui lòng nhập lý do hủy hoặc báo sai sự cố.');
      return;
    }
    setSubmittingCancel(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiClient.post(`/rooms/maintenance-tickets/${ticket.id}/cancel/`, {
        reason: cancelReason.trim(),
      });
      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Đã hủy phiếu bảo trì',
          res.data.message || `Phiếu #${ticket.ticket_code} đã được hủy và phòng đã khôi phục trạng thái ban đầu.`
        );
        onClose();
        onSuccess();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể hủy phiếu bảo trì.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmittingCancel(false);
    }
  };

  if (!ticket) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={Keyboard.dismiss}
          />
          <View
            style={[
              styles.modalContent,
              !isDark && { backgroundColor: '#FFFFFF', borderTopColor: '#E2E8F0', shadowColor: '#64748B' },
            ]}
          >
            <View style={[styles.modalHeader, !isDark && { borderBottomColor: '#F1F5F9' }]}>
              <View>
                <Text style={[styles.modalTitle, !isDark && { color: '#0F172A' }]}>
                  Hủy Phiếu Bảo Trì / Báo Sai
                </Text>
                <Text style={[styles.modalSubtitle, !isDark && { color: '#64748B' }]}>
                  Mã phiếu #{ticket.ticket_code} • P.{ticket.room_number}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.modalCloseBtn, !isDark && { backgroundColor: '#F1F5F9' }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View
                style={[
                  styles.alertNoteBox,
                  { backgroundColor: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.25)' },
                ]}
              >
                <Ionicons name="information-circle" size={18} color="#0284C7" style={{ marginRight: 8 }} />
                <Text style={[styles.alertNoteText, !isDark && { color: '#0369A1' }]}>
                  Sử dụng khi kiểm tra phát hiện thiết bị hoạt động bình thường, cắm lại phích điện hoặc khách bấm nhầm remote. Phòng sẽ tự động khôi phục lại trạng thái ban đầu và gỡ khoản đền bù (nếu có).
                </Text>
              </View>

              <Text style={[styles.inputLabel, { marginTop: 10 }, !isDark && { color: '#334155' }]}>
                Lý do hủy / Báo sai *:
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  { height: 70 },
                  !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' },
                ]}
                placeholder="VD: Khách bấm nhầm remote quạt gió / Đã cắm lại phích cắm / Báo nhầm phòng..."
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                multiline
                value={cancelReason}
                onChangeText={setCancelReason}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[
                    styles.cancelModalCloseBtn,
                    !isDark && { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' },
                  ]}
                  onPress={onClose}
                  disabled={submittingCancel}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelModalCloseText, !isDark && { color: '#475569' }]}>Để sau</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.cancelModalConfirmBtn,
                    submittingCancel && { opacity: 0.6 },
                  ]}
                  onPress={handleCancelTicket}
                  disabled={submittingCancel}
                  activeOpacity={0.8}
                >
                  {submittingCancel ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="trash-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.cancelModalConfirmText}>XÁC NHẬN HỦY PHIẾU</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    marginTop: 12,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#0A0F1D',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
    textAlignVertical: 'top',
  },
  alertNoteBox: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    marginBottom: 10,
    borderWidth: 1,
  },
  alertNoteText: {
    fontSize: 11,
    color: '#38BDF8',
    flex: 1,
    lineHeight: 16,
  },
  cancelModalCloseBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalCloseText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  cancelModalConfirmBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

