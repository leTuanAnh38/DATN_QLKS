import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ServiceRequestItem } from './TransportCard';

export const TRANSPORT_CANCEL_REASONS = [
  'Khách đổi lịch / hủy chuyến xe',
  'Khách tự di chuyển bằng phương tiện khác',
  'Đặt nhầm loại xe / sai thông tin',
  'Không liên lạc được với khách',
  'Lý do khác',
];

export interface CancelTransportModalProps {
  visible: boolean;
  isDark: boolean;
  item: ServiceRequestItem | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export const CancelTransportModal: React.FC<CancelTransportModalProps> = ({
  visible,
  isDark,
  item,
  submitting,
  onClose,
  onConfirm,
}) => {
  const [selectedReason, setSelectedReason] = useState(TRANSPORT_CANCEL_REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedReason(TRANSPORT_CANCEL_REASONS[0]);
      setCustomReason('');
    }
  }, [visible]);

  const handleConfirm = () => {
    const finalReason =
      selectedReason === 'Lý do khác'
        ? customReason.trim() || 'Nhân viên hủy chuyến xe'
        : selectedReason;
    onConfirm(finalReason);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={Keyboard.dismiss}
          />
          <View
            style={[
              styles.content,
              !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
            ]}
          >
            <View style={[styles.header, !isDark && { borderBottomColor: '#F1F5F9' }]}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.title}>Hủy Cuốc Xe Đưa Đón</Text>
                <Text style={[styles.subtitle, !isDark && { color: '#64748B' }]} numberOfLines={1}>
                  {item
                    ? `${item.room_number ? `P.${item.room_number}` : 'Đón Sảnh'} • ${item.guest_name || 'Khách'} • ${item.service_name}`
                    : 'Xác nhận hủy chuyến xe'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.closeBtn, !isDark && { backgroundColor: '#F1F5F9' }]}
                onPress={onClose}
                disabled={submitting}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingTop: 12, paddingBottom: 16 }}
            >
              <Text style={[styles.label, !isDark && { color: '#334155' }]}>
                Chọn lý do hủy chuyến (lưu nhật ký kiểm toán) *:
              </Text>

              {TRANSPORT_CANCEL_REASONS.map((reason) => {
                const active = selectedReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.reasonRow,
                      !isDark && !active && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                      active && styles.reasonRowActive,
                    ]}
                    onPress={() => {
                      setSelectedReason(reason);
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                      {active && <View style={styles.radioInner} />}
                    </View>
                    <Text
                      style={[
                        styles.reasonText,
                        !isDark && !active && { color: '#334155' },
                        active && styles.reasonTextActive,
                      ]}
                    >
                      {reason}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {selectedReason === 'Lý do khác' && (
                <TextInput
                  style={[
                    styles.input,
                    !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' },
                  ]}
                  placeholder="Nhập chi tiết lý do hủy cuốc xe..."
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  multiline
                  value={customReason}
                  onChangeText={setCustomReason}
                />
              )}

              <View
                style={[
                  styles.warningBox,
                  !isDark && { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' },
                ]}
              >
                <Ionicons name="information-circle-outline" size={16} color="#E11D48" style={{ marginRight: 6 }} />
                <Text style={[styles.warningText, !isDark && { color: '#BE123C' }]}>
                  Cuốc xe sau khi hủy sẽ không cộng vào hóa đơn phòng và không thể khôi phục.
                </Text>
              </View>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.dismissBtn, !isDark && { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]}
                  onPress={onClose}
                  disabled={submitting}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dismissBtnText, !isDark && { color: '#475569' }]}>Quay lại</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, submitting && { opacity: 0.65 }]}
                  onPress={handleConfirm}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="trash" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.submitBtnText}>Xác nhận Hủy</Text>
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  content: {
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#EF4444',
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 10,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0F172A',
    marginBottom: 8,
  },
  reasonRowActive: {
    borderColor: 'rgba(239, 68, 68, 0.55)',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioOuterActive: {
    borderColor: '#EF4444',
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#EF4444',
  },
  reasonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
    flex: 1,
  },
  reasonTextActive: {
    color: '#EF4444',
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 68,
    fontSize: 13,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(225, 29, 72, 0.3)',
    backgroundColor: 'rgba(225, 29, 72, 0.1)',
    marginTop: 4,
  },
  warningText: {
    flex: 1,
    fontSize: 11.5,
    color: '#FDA4AF',
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  dismissBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  submitBtn: {
    flex: 1.3,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

