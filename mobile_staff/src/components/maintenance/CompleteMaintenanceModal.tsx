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
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../../api/client';
import { PARTS_SUGGESTIONS } from '../../constants/maintenance';
import { MaintenanceTicket } from './MaintenanceTicketCard';

export interface CompleteMaintenanceModalProps {
  visible: boolean;
  ticket: MaintenanceTicket | null;
  isDark?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CompleteMaintenanceModal: React.FC<CompleteMaintenanceModalProps> = ({
  visible,
  ticket,
  isDark = true,
  onClose,
  onSuccess,
}) => {
  const [partsReplaced, setPartsReplaced] = useState('');
  const [cost, setCost] = useState('');
  const [note, setNote] = useState('');
  const [isGuestFault, setIsGuestFault] = useState(false);
  const [completeEvidenceImage, setCompleteEvidenceImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && ticket) {
      setPartsReplaced(ticket.parts_replaced || '');
      setCost(ticket.cost ? String(ticket.cost) : '0');
      setNote('');
      setIsGuestFault(Boolean(ticket.is_guest_fault));
      setCompleteEvidenceImage(null);
      setSubmitting(false);
    }
  }, [visible, ticket]);

  const takeCompletePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Cần cấp quyền', 'Vui lòng cấp quyền Camera để chụp ảnh nghiệm thu hoàn tất.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.6,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setCompleteEvidenceImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở camera:', e);
    }
  };

  const pickCompleteLibrary = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Cần cấp quyền', 'Vui lòng cấp quyền Thư viện ảnh để chọn ảnh.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.6,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setCompleteEvidenceImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở thư viện ảnh:', e);
    }
  };

  const handleComplete = async () => {
    if (!ticket || submitting) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const formData = new FormData();
      formData.append('parts_replaced', partsReplaced);
      formData.append('cost', String(parseInt(cost || '0', 10)));
      formData.append('note', note);
      formData.append('is_guest_fault', String(isGuestFault));

      if (completeEvidenceImage) {
        const uri = completeEvidenceImage.uri;
        const filename = uri.split('/').pop() || 'photo_after.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        // @ts-ignore
        formData.append('image_after', {
          uri: uri,
          name: filename,
          type: type,
        });
      }

      const res = await apiClient.post(`/rooms/maintenance-tickets/${ticket.id}/complete/`, formData);

      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Đã hoàn tất sửa chữa',
          res.data.message || 'Phòng đã được chuyển sang Buồng phòng dọn dẹp để sẵn sàng đón khách!'
        );
        onClose();
        onSuccess();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể hoàn thành phiếu bảo trì.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!ticket) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
          <View style={[styles.modalContent, !isDark && { backgroundColor: '#FFFFFF', borderTopColor: '#E2E8F0', shadowColor: '#64748B' }]}>
            <View style={[styles.modalHeader, !isDark && { borderBottomColor: '#F1F5F9' }]}>
              <View>
                <Text style={[styles.modalTitle, !isDark && { color: '#0F172A' }]}>
                  Nghiệm Thu Phòng {ticket.room_number}
                </Text>
                <Text style={[styles.modalSubtitle, !isDark && { color: '#64748B' }]}>
                  Thiết bị: {ticket.equipment_name}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.modalCloseBtn, !isDark && { backgroundColor: '#F1F5F9' }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={isDark ? "#94A3B8" : "#64748B"} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Ảnh hiện trường ban đầu (nếu có người báo trước) */}
              {ticket.image_before && (
                <View style={[styles.initialEvidenceBox, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                  <View style={styles.initialEvidenceHeader}>
                    <Ionicons name="image" size={14} color="#F59E0B" style={{ marginRight: 6 }} />
                    <Text style={[styles.initialEvidenceTitle, !isDark && { color: '#0F172A' }]}>
                      Ảnh hiện trường ban đầu (Buồng phòng gửi):
                    </Text>
                  </View>
                  <Image
                    source={{ uri: ticket.image_before }}
                    style={styles.initialEvidenceImage}
                    resizeMode="cover"
                  />
                </View>
              )}

              <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Linh kiện / Vật tư đã thay:</Text>
              <TextInput
                style={[styles.modalInput, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
                placeholder="VD: Thay tụ quạt Daikin, vòi sen tắm..."
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={partsReplaced}
                onChangeText={setPartsReplaced}
              />

              {/* Gợi ý linh kiện nhanh cho Nghiệm thu */}
              {PARTS_SUGGESTIONS[ticket.issue_type] && (
                <View style={[styles.suggestionRow, { marginBottom: 10 }]}>
                  <Text style={[styles.suggestionTitle, !isDark && { color: '#64748B' }]}>Gợi ý vật tư nhanh:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6 }}
                  >
                    {PARTS_SUGGESTIONS[ticket.issue_type].map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.quickEquipChip,
                          !isDark && partsReplaced !== p && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
                          partsReplaced === p && styles.quickEquipChipActive,
                        ]}
                        onPress={() => {
                          setPartsReplaced(p);
                          Haptics.selectionAsync();
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.quickEquipChipText,
                            !isDark && partsReplaced !== p && { color: '#475569' },
                            partsReplaced === p && styles.quickEquipChipTextActive,
                          ]}
                        >
                          + {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Chi phí vật tư phát sinh (VNĐ):</Text>
              <TextInput
                style={[styles.modalInput, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
                placeholder="0"
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                keyboardType="numeric"
                value={cost}
                onChangeText={setCost}
              />

              {/* Phân loại trách nhiệm chi phí: Do khách làm hỏng hay hao mòn khách sạn */}
              <TouchableOpacity
                style={[
                  styles.guestFaultToggleRow,
                  !isDark && !isGuestFault && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                  isGuestFault && styles.guestFaultToggleRowActive,
                ]}
                onPress={() => {
                  setIsGuestFault(!isGuestFault);
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isGuestFault ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={isGuestFault ? '#EF4444' : (isDark ? '#64748B' : '#94A3B8')}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.guestFaultTitle, !isDark && !isGuestFault && { color: '#0F172A' }, isGuestFault && { color: '#F87171' }]}>
                    Do khách làm hư hỏng (Tính phí bồi thường)
                  </Text>
                  <Text style={[styles.guestFaultSubtitle, !isDark && { color: '#64748B' }]}>
                    {isGuestFault
                      ? 'Lưu ý: Phụ phí bồi thường sẽ tự động cộng vào hóa đơn khách tại Lễ tân.'
                      : 'Hao mòn tự nhiên trong vận hành (Khách sạn chịu chi phí bảo trì).'}
                  </Text>
                </View>
              </TouchableOpacity>

              <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Ghi chú kiểm tra bàn giao:</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
                placeholder="Thiết bị hoạt động êm, mát, sạch sẽ..."
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                multiline
                value={note}
                onChangeText={setNote}
              />

              {/* Ảnh chụp nghiệm thu sau khi sửa chữa */}
              <Text style={[styles.inputLabel, { marginTop: 10 }, !isDark && { color: '#334155' }]}>
                Ảnh nghiệm thu sau sửa chữa (Bằng chứng hoàn thành):
              </Text>
              {completeEvidenceImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: completeEvidenceImage.uri }} style={styles.imagePreview} resizeMode="cover" />
                  <View style={styles.imagePreviewOverlay}>
                    <TouchableOpacity
                      style={styles.imageActionBtn}
                      onPress={takeCompletePhoto}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera" size={14} color="#F8FAFC" style={{ marginRight: 4 }} />
                      <Text style={styles.imageActionBtnText}>Chụp lại</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.imageActionBtn, { backgroundColor: '#EF4444' }]}
                      onPress={() => setCompleteEvidenceImage(null)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash" size={14} color="#F8FAFC" style={{ marginRight: 4 }} />
                      <Text style={styles.imageActionBtnText}>Xóa ảnh</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.photoPickerRow}>
                  <TouchableOpacity
                    style={[
                      styles.photoPickerBtn,
                      !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                    ]}
                    onPress={takeCompletePhoto}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera" size={20} color={isDark ? '#F59E0B' : '#D97706'} />
                    <Text style={[styles.photoPickerText, !isDark && { color: '#D97706' }]}>
                      Chụp ảnh nghiệm thu
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.photoPickerBtn,
                      !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                    ]}
                    onPress={pickCompleteLibrary}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="images" size={20} color="#0284C7" />
                    <Text style={[styles.photoPickerText, { color: '#0284C7' }]}>Chọn từ thư viện</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={[styles.alertNoteBox, !isDark && { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }]}>
                <Ionicons name="information-circle" size={18} color="#F59E0B" style={{ marginRight: 8 }} />
                <Text style={[styles.alertNoteText, !isDark && { color: '#B45309' }]}>
                  Sau khi xác nhận, Phòng {ticket.room_number} sẽ tự động chuyển sang trạng thái "Đang dọn dẹp" để bộ phận Buồng phòng vào lau dọn sẵn sàng đón khách.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, submitting && { opacity: 0.6 }]}
                onPress={handleComplete}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#0A0F1D" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="shield-checkmark" size={17} color="#0A0F1D" style={{ marginRight: 6 }} />
                    <Text style={styles.modalConfirmBtnText}>XÁC NHẬN BÀN GIAO PHÒNG</Text>
                  </View>
                )}
              </TouchableOpacity>
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
    height: 44,
    color: '#F8FAFC',
    fontSize: 13,
  },
  suggestionRow: {
    marginTop: 6,
    marginBottom: 4,
  },
  suggestionTitle: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  quickEquipChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickEquipChipActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#F59E0B',
  },
  quickEquipChipText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  quickEquipChipTextActive: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  guestFaultToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginTop: 12,
    marginBottom: 6,
  },
  guestFaultToggleRowActive: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  guestFaultTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F1F5F9',
  },
  guestFaultSubtitle: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 14,
  },
  initialEvidenceBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 10,
    marginBottom: 12,
  },
  initialEvidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  initialEvidenceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  initialEvidenceImage: {
    width: '100%',
    height: 140,
    borderRadius: 8,
  },
  imagePreviewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  imagePreview: {
    width: '100%',
    height: 150,
  },
  imagePreviewOverlay: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    gap: 8,
  },
  imageActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  imageActionBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  photoPickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 12,
  },
  photoPickerBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
    gap: 6,
  },
  photoPickerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A78BFA',
  },
  alertNoteBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  alertNoteText: {
    fontSize: 11,
    color: '#FDE68A',
    flex: 1,
    lineHeight: 16,
  },
  modalConfirmBtn: {
    backgroundColor: '#F59E0B',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalConfirmBtnText: {
    color: '#0A0F1D',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

