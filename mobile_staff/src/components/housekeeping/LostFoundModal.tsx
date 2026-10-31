import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../../api/client';
import { styles } from './styles';
import type { RoomItem } from './types';
import { useAppTheme } from '../../contexts/ThemeContext';

export const LF_CATEGORIES = [
  { key: 'electronics', label: 'Điện tử (Điện thoại, Laptop, Sạc)' },
  { key: 'valuable', label: 'Giá trị (Ví, Tiền, Trang sức)' },
  { key: 'documents', label: 'Giấy tờ / CCCD / Hộ chiếu' },
  { key: 'clothing', label: 'Quần áo / Giày dép / Túi xách' },
  { key: 'accessories', label: 'Phụ kiện / Kính mắt / Mỹ phẩm' },
  { key: 'other', label: 'Đồ dùng khác' },
];

interface LostFoundModalProps {
  visible: boolean;
  room: RoomItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const LostFoundModal: React.FC<LostFoundModalProps> = ({
  visible,
  room,
  onClose,
  onSuccess,
}) => {
  const { isDark } = useAppTheme();
  const [lfItemName, setLfItemName] = useState('');
  const [lfCategory, setLfCategory] = useState('valuable');
  const [lfLocationDetail, setLfLocationDetail] = useState('');
  const [lfDescription, setLfDescription] = useState('');
  const [lfImage, setLfImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && room) {
      setLfItemName('');
      setLfCategory('valuable');
      setLfLocationDetail('');
      setLfDescription('');
      setLfImage(null);
    }
  }, [visible, room?.id]);

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Cần cấp quyền', 'Vui lòng cấp quyền Camera để chụp ảnh hiện vật.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLfImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở camera:', e);
    }
  };

  const pickLibrary = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Cần cấp quyền', 'Vui lòng cấp quyền Thư viện ảnh để chọn ảnh.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLfImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở thư viện ảnh:', e);
    }
  };

  const handleSubmit = async () => {
    if (!room) return;
    if (!lfItemName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên đồ vật nhặt được.');
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const formData = new FormData();
      formData.append('item_name', lfItemName.trim());
      formData.append('category', lfCategory);
      formData.append('room_id', String(room.id));
      formData.append(
        'location_found',
        lfLocationDetail.trim()
          ? `Phòng ${room.room_number} - ${lfLocationDetail.trim()}`
          : `Phòng ${room.room_number}`
      );
      formData.append('description', lfDescription.trim());

      if (lfImage) {
        const uri = lfImage.uri;
        const filename = uri.split('/').pop() || 'photo.jpg';
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
      if (res.data?.success || res.data?.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Đã ghi nhận đồ bỏ quên',
          `Đã tạo mã #${res.data.tracking_code || 'LF'} tại Phòng ${room.room_number} và gửi thông báo Lễ tân tiếp nhận!`
        );
        onClose();
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể tạo phiếu đồ thất lạc.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!room) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.modalCard,
            { maxHeight: '90%' },
            !isDark && {
              backgroundColor: '#FFFFFF',
              borderTopColor: '#E2E8F0',
              shadowColor: '#64748B',
            },
          ]}
        >
          <View style={styles.modalTopBar}>
            <View>
              <Text style={[styles.modalRoomTitle, !isDark && { color: '#0F172A' }]}>
                Phòng {room.room_number}
              </Text>
              <Text style={[styles.modalRoomSubtitle, !isDark && { color: '#64748B' }]}>
                Khai Báo Đồ Khách Bỏ Quên 🧳
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.modalCloseCircle, !isDark && { backgroundColor: '#F1F5F9' }]}
            >
              <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#475569'} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Phân loại tài sản */}
            <Text style={[styles.modalSectionLabel, !isDark && { color: '#B45309' }]}>
              1. Phân loại tài sản:
            </Text>
            <View style={styles.equipmentChipsWrap}>
              {LF_CATEGORIES.map((cat) => {
                const isSel = lfCategory === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.equipmentChip,
                      !isDark && !isSel && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                      isSel && { borderColor: '#8B5CF6', backgroundColor: 'rgba(139, 92, 246, 0.15)' },
                    ]}
                    onPress={() => {
                      setLfCategory(cat.key);
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.equipmentChipText,
                        !isDark && !isSel && { color: '#475569' },
                        isSel && { color: isDark ? '#DDD6FE' : '#6D28D9', fontWeight: '800' },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tên đồ vật */}
            <Text style={[styles.modalSectionLabel, { marginTop: 14 }, !isDark && { color: '#B45309' }]}>
              2. Tên đồ vật nhặt được *:
            </Text>
            <TextInput
              style={[
                styles.modalTextInput,
                !isDark && {
                  backgroundColor: '#F8FAFC',
                  borderColor: '#CBD5E1',
                  color: '#0F172A',
                },
              ]}
              placeholder="VD: Ví da nam, Sạc iPhone, Tai nghe Sony..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={lfItemName}
              onChangeText={setLfItemName}
            />

            {/* Vị trí trong phòng */}
            <Text style={[styles.modalSectionLabel, { marginTop: 14 }, !isDark && { color: '#B45309' }]}>
              3. Vị trí phát hiện trong phòng:
            </Text>
            <TextInput
              style={[
                styles.modalTextInput,
                !isDark && {
                  backgroundColor: '#F8FAFC',
                  borderColor: '#CBD5E1',
                  color: '#0F172A',
                },
              ]}
              placeholder="VD: Dưới gầm giường, Ngăn kéo bàn trang điểm..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={lfLocationDetail}
              onChangeText={setLfLocationDetail}
            />

            {/* Mô tả nhận dạng */}
            <Text style={[styles.modalSectionLabel, { marginTop: 14 }, !isDark && { color: '#B45309' }]}>
              4. Mô tả chi tiết / Đặc điểm nhận dạng:
            </Text>
            <TextInput
              style={[
                styles.modalTextInput,
                { height: 60 },
                !isDark && {
                  backgroundColor: '#F8FAFC',
                  borderColor: '#CBD5E1',
                  color: '#0F172A',
                },
              ]}
              placeholder="Màu sắc, nhãn hiệu, tình trạng (còn mới, trầy xước...)"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              multiline
              value={lfDescription}
              onChangeText={setLfDescription}
            />

            {/* Chụp ảnh hiện vật */}
            <Text style={[styles.modalSectionLabel, { marginTop: 14 }, !isDark && { color: '#B45309' }]}>
              5. Ảnh chụp hiện vật (Camera hoặc Thư viện):
            </Text>
            {lfImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: lfImage.uri }} style={styles.imagePreview} resizeMode="cover" />
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
                    onPress={() => setLfImage(null)}
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
                  onPress={takePhoto}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={20} color={isDark ? '#A78BFA' : '#7C3AED'} />
                  <Text style={[styles.photoPickerText, !isDark && { color: '#7C3AED' }]}>
                    Chụp ảnh camera
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.photoPickerBtn,
                    !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                  ]}
                  onPress={pickLibrary}
                  activeOpacity={0.8}
                >
                  <Ionicons name="images" size={20} color="#0284C7" />
                  <Text style={[styles.photoPickerText, { color: '#0284C7' }]}>Chọn từ thư viện</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Thông báo tự động */}
            <View
              style={[
                styles.breakdownNoticeBox,
                { borderColor: 'rgba(167, 139, 250, 0.3)', backgroundColor: 'rgba(167, 139, 250, 0.08)' },
                !isDark && { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' },
              ]}
            >
              <Ionicons
                name="information-circle"
                size={16}
                color={isDark ? '#A78BFA' : '#7C3AED'}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.breakdownNoticeText,
                  { color: isDark ? '#DDD6FE' : '#6D28D9' },
                ]}
              >
                Hệ thống tự động liên kết khách lưu trú phòng này và phát thông báo Lễ tân tiếp nhận lưu kho!
              </Text>
            </View>

            {/* Nút gửi */}
            <TouchableOpacity
              style={[styles.lostFoundSubmitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#0A0F1D" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="paper-plane" size={16} color="#0A0F1D" style={{ marginRight: 6 }} />
                  <Text style={styles.lostFoundSubmitBtnText}>LƯU ĐỒ THẤT LẠC & BÁO LỄ TÂN</Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
