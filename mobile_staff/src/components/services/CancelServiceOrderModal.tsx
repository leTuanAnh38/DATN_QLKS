import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ServiceOrder, CANCEL_REASONS } from './types';
import { styles } from './styles';

export interface CancelServiceOrderModalProps {
  visible: boolean;
  isDark: boolean;
  itemToCancel: ServiceOrder | null;
  cancelReasonOption: string;
  setCancelReasonOption: (reason: string) => void;
  customCancelReason: string;
  setCustomCancelReason: (reason: string) => void;
  cancellingOrder: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const CancelServiceOrderModal: React.FC<CancelServiceOrderModalProps> = ({
  visible,
  isDark,
  itemToCancel,
  cancelReasonOption,
  setCancelReasonOption,
  customCancelReason,
  setCustomCancelReason,
  cancellingOrder,
  onClose,
  onConfirm,
}) => {
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
              { maxHeight: '85%' },
              !isDark && { backgroundColor: '#FFFFFF', borderTopColor: '#E2E8F0' },
            ]}
          >
            <View style={[styles.modalHeader, !isDark && { borderBottomColor: '#F1F5F9' }]}>
              <View>
                <Text style={[styles.modalTitle, { color: '#EF4444' }]}>Hủy Yêu Cầu Dịch Vụ</Text>
                <Text style={[styles.modalSubtitle, !isDark && { color: '#64748B' }]}>
                  {itemToCancel
                    ? `Phòng ${itemToCancel.room_number || '---'} • ${itemToCancel.service_name} (SL: ${itemToCancel.quantity || 1})`
                    : 'Xác nhận hủy đơn phục vụ'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.modalCloseBtn, !isDark && { backgroundColor: '#F1F5F9' }]}
                onPress={onClose}
                activeOpacity={0.7}
                disabled={cancellingOrder}
              >
                <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 25, paddingTop: 10 }}
            >
            <Text style={[styles.inputLabel, { marginTop: 0, marginBottom: 10 }, !isDark && { color: '#334155' }]}>
              Vui lòng chọn lý do hủy (Lưu nhật ký kiểm toán hệ thống) *:
            </Text>

            {CANCEL_REASONS.map((reason) => {
              const isSelected = cancelReasonOption === reason;
              return (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.cancelReasonOptionRow,
                    !isDark && !isSelected && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                    isSelected && styles.cancelReasonOptionRowActive,
                  ]}
                  onPress={() => {
                    setCancelReasonOption(reason);
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.cancelRadioOuter, isSelected && styles.cancelRadioOuterActive]}>
                    {isSelected && <View style={styles.cancelRadioInner} />}
                  </View>
                  <Text
                    style={[
                      styles.cancelReasonOptionText,
                      !isDark && !isSelected && { color: '#334155' },
                      isSelected && styles.cancelReasonOptionTextActive,
                    ]}
                  >
                    {reason}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {cancelReasonOption === 'Lý do khác' && (
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.scheduledSubLabel, !isDark && { color: '#64748B' }]}>
                  Nhập chi tiết lý do hủy *:
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    { height: 60, paddingTop: 8 },
                    !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' },
                  ]}
                  placeholder="Mô tả cụ thể lý do hủy đơn này..."
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  multiline
                  value={customCancelReason}
                  onChangeText={setCustomCancelReason}
                />
              </View>
            )}

            <View style={[styles.cancelWarningBanner, !isDark && { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }]}>
              <Ionicons name="information-circle-outline" size={16} color="#E11D48" style={{ marginRight: 6 }} />
              <Text style={[styles.cancelWarningText, !isDark && { color: '#BE123C' }]}>
                Đơn sau khi hủy sẽ không được cộng vào hóa đơn phòng và không thể phục hồi.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.btnCancelModalDismiss, !isDark && { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]}
                onPress={onClose}
                disabled={cancellingOrder}
                activeOpacity={0.7}
              >
                <Text style={[styles.btnCancelModalDismissText, !isDark && { color: '#475569' }]}>Quay lại</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnCancelModalSubmit, cancellingOrder && { opacity: 0.6 }]}
                onPress={onConfirm}
                disabled={cancellingOrder}
                activeOpacity={0.8}
              >
                {cancellingOrder ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="trash" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.btnCancelModalSubmitText}>Xác nhận Hủy Đơn</Text>
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
