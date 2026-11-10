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

export const LOST_FOUND_CATEGORIES = [
  { key: 'electronics', label: 'Điện tử (Điện thoại, Laptop, Sạc)', icon: 'phone-portrait' },
  { key: 'valuable', label: 'Giá trị (Ví, Tiền mặt, Trang sức)', icon: 'diamond' },
  { key: 'documents', label: 'Giấy tờ / Hộ chiếu / CCCD', icon: 'document-text' },
  { key: 'clothing', label: 'Quần áo / Giày dép / Túi xách', icon: 'shirt' },
  { key: 'accessories', label: 'Phụ kiện / Kính mắt / Mỹ phẩm', icon: 'glasses' },
  { key: 'other', label: 'Đồ dùng khác', icon: 'cube' },
];

export interface CreateLostFoundModalProps {
  visible: boolean;
  isDark?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateLostFoundModal: React.FC<CreateLostFoundModalProps> = ({
  visible,
  isDark = true,
  onClose,
  onSuccess,
}) => {
  const [itemName, setItemName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [category, setCategory] = useState('valuable');
  const [description, setDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setItemName('');
      setRoomNumber('');
      setCategory('valuable');
      setDescription('');
      setSelectedImage(null);
      setSubmitting(false);
    }
  }, [visible]);

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Cần cấp quyền', 'Ứng dụng cần quyền Camera để chụp ảnh hiện vật.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.6,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở camera:', e);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Cần cấp quyền', 'Ứng dụng cần quyền Thư viện ảnh để chọn ảnh.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.6,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở thư viện ảnh:', e);
    }
  };

  const handleCreate = async () => {
    if (!itemName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên đồ vật nhặt được.');
      return;
    }
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const formData = new FormData();
      formData.append('item_name', itemName.trim());
      formData.append('category', category);
      if (roomNumber.trim()) {
        formData.append('room_number', roomNumber.trim());
      }
      if (description.trim()) {
        formData.append('description', description.trim());
      }

      if (selectedImage) {
        const uri = selectedImage.uri;
        const filename = uri.split('/').pop() || 'lost_item.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        // @ts-ignore
        formData.append('image', {
          uri: uri,
          name: filename,
          type: type,
        });
      }

      const res = await apiClient.post('/rooms/lost-and-found/', formData);

      if (res.data.success || res.data.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Thành công', 'Đã lưu vật phẩm vào sổ Lost & Found để Lễ tân đối soát.');
        onClose();
        onSuccess();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể tạo hồ sơ thất lạc.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmitting(false);
    }
  };

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
                <Text style={[styles.modalTitle, !isDark && { color: '#0F172A' }]}>Khai Báo Đồ Khách Bỏ Quên</Text>
                <Text style={[styles.modalSubtitle, !isDark && { color: '#64748B' }]}>Ghi nhận vào sổ Lost & Found để Lễ tân quản lý</Text>
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
              <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Tên vật phẩm nhặt được (*):</Text>
              <TextInput
                style={[styles.modalInput, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
                placeholder="VD: Ví nam cầm tay, Tai nghe AirPods, Hộ chiếu..."
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={itemName}
                onChangeText={setItemName}
              />

              <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Số phòng phát hiện (hoặc khu vực):</Text>
              <TextInput
                style={[styles.modalInput, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
                placeholder="VD: 204 (hoặc Hồ bơi tầng 3, Ghế sảnh...)"
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={roomNumber}
                onChangeText={setRoomNumber}
              />

              <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Phân loại tài sản:</Text>
              <View style={styles.categoryChipsRow}>
                {LOST_FOUND_CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    style={[
                      styles.categoryChip,
                      !isDark && category !== c.key && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                      category === c.key && styles.categoryChipActive,
                    ]}
                    onPress={() => setCategory(c.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={c.icon as any}
                      size={13}
                      color={category === c.key ? '#0A0F1D' : (isDark ? '#94A3B8' : '#64748B')}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        !isDark && category !== c.key && { color: '#475569' },
                        category === c.key && styles.categoryChipTextActive,
                      ]}
                    >
                      {c.label.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>Mô tả đặc điểm / Vị trí tìm thấy:</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
                placeholder="VD: Nhặt được dưới chân giường, màu đen da bò..."
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                multiline
                value={description}
                onChangeText={setDescription}
              />

              {/* Chụp ảnh hiện vật */}
              <Text style={[styles.inputLabel, { marginTop: 14 }, !isDark && { color: '#334155' }]}>
                Ảnh chụp hiện vật (Camera hoặc Thư viện):
              </Text>
              {selectedImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} resizeMode="cover" />
                  <View style={styles.imagePreviewOverlay}>
                    <TouchableOpacity
                      style={styles.imageActionBtn}
                      onPress={takePhoto}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera" size={14} color="#F8FAFC" style={{ marginRight: 4 }} />
                      <Text style={styles.imageActionBtnText}>Chụp lại</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.imageActionBtn, { backgroundColor: '#EF4444' }]}
                      onPress={() => setSelectedImage(null)}
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
                    style={[styles.photoPickerBtn, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' }]}
                    onPress={takePhoto}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera" size={20} color="#F59E0B" />
                    <Text style={[styles.photoPickerText, !isDark && { color: '#475569' }]}>Chụp ảnh camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.photoPickerBtn, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' }]}
                    onPress={pickImage}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="images" size={20} color="#3B82F6" />
                    <Text style={[styles.photoPickerText, { color: '#3B82F6' }]}>Chọn từ thư viện</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[styles.modalConfirmBtn, submitting && { opacity: 0.6 }]}
                onPress={handleCreate}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#0A0F1D" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="cloud-upload" size={17} color="#0A0F1D" style={{ marginRight: 6 }} />
                    <Text style={styles.modalConfirmBtnText}>LƯU VÀO SỔ LỄ TÂN</Text>
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
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  categoryChipText: {
    fontSize: 11.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#0A0F1D',
    fontWeight: '800',
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
    color: '#94A3B8',
  },
  modalConfirmBtn: {
    backgroundColor: '#F59E0B',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 20,
  },
  modalConfirmBtnText: {
    color: '#0A0F1D',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

