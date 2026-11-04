import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../../api/client';
import { Palette } from '../../constants/theme';
import { useAppTheme } from '../../contexts/ThemeContext';
import { styles } from './styles';
import type { RoomItem } from './types';

const QUICK_REASONS = [
  { label: 'Hỏng máy lạnh / điều hòa', icon: 'snow', type: 'ac', defaultStatus: 'maintenance', equipment: 'Điều hòa Daikin' },
  { label: 'Sự cố nước / vệ sinh', icon: 'water', type: 'water', defaultStatus: 'maintenance', equipment: 'Hệ thống nước / WC' },
  { label: 'Sự cố điện / mất điện', icon: 'flash', type: 'electric', defaultStatus: 'maintenance', equipment: 'Hệ thống điện' },
  { label: 'Khóa từ / Cửa hỏng', icon: 'key', type: 'lock', defaultStatus: 'maintenance', equipment: 'Khóa từ thông minh' },
  { label: 'Phòng ồn / Khách yêu cầu', icon: 'volume-mute', type: 'other', defaultStatus: 'cleaning', equipment: 'Phòng ồn ào' },
  { label: 'Sự cố kỹ thuật khác', icon: 'construct', type: 'other', defaultStatus: 'maintenance', equipment: 'Thiết bị phòng' },
];

export interface ChangeRoomModalProps {
  visible: boolean;
  room: RoomItem | null;
  booking: any | null;
  initialReason?: string;
  initialIssueType?: string;
  initialEquipment?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ChangeRoomModal: React.FC<ChangeRoomModalProps> = ({
  visible,
  room,
  booking,
  initialReason = '',
  initialIssueType = 'ac',
  initialEquipment = '',
  onClose,
  onSuccess,
}) => {
  const { isDark } = useAppTheme();

  const currentBooking = booking || room?.current_booking || room?.recent_booking;
  const bookingId = currentBooking?.id;

  const [availableRooms, setAvailableRooms] = useState<RoomItem[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const [reason, setReason] = useState('');
  const [issueType, setIssueType] = useState('ac');
  const [oldRoomStatus, setOldRoomStatus] = useState<'maintenance' | 'cleaning'>('maintenance');
  const [equipmentName, setEquipmentName] = useState('');
  const [partsReplaced, setPartsReplaced] = useState('');
  const [cost, setCost] = useState('');
  const [isGuestFault, setIsGuestFault] = useState(false);
  const [evidenceImage, setEvidenceImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Khởi tạo form khi mở modal
  useEffect(() => {
    if (visible && room) {
      setReason(initialReason || 'Hỏng máy lạnh / điều hòa');
      setIssueType(initialIssueType || 'ac');
      setEquipmentName(initialEquipment || 'Điều hòa Daikin');
      setOldRoomStatus('maintenance');
      setPartsReplaced('');
      setCost('');
      setIsGuestFault(false);
      setEvidenceImage(null);
      setShowAllCategories(false);
      setSelectedRoomId(null);
    }
  }, [visible, room?.id, initialReason, initialIssueType, initialEquipment]);

  // Tải danh sách phòng trống thực tế có thể chuyển đến
  const fetchAvailableRooms = useCallback(async (allCats: boolean) => {
    if (!bookingId) return;
    setLoadingRooms(true);
    try {
      const catId = room?.category_id || currentBooking?.category_id;
      const params: any = {};
      if (allCats) {
        params.all_categories = 'true';
      } else if (catId) {
        params.category_id = catId;
      }
      const res = await apiClient.get(`/bookings/${bookingId}/available-rooms/`, { params });
      const list = res.data?.rooms || res.data?.results || res.data || [];
      const roomsArray: RoomItem[] = Array.isArray(list) ? list : [];
      // Lọc bỏ chính phòng hiện tại nếu lọt vào
      const filtered = roomsArray.filter((r) => r.id !== room?.id);
      setAvailableRooms(filtered);
      if (filtered.length > 0) {
        setSelectedRoomId(filtered[0].id);
      } else {
        setSelectedRoomId(null);
      }
    } catch (err: any) {
      console.warn('Lỗi tải phòng trống đổi phòng:', err);
      setAvailableRooms([]);
      setSelectedRoomId(null);
    } finally {
      setLoadingRooms(false);
    }
  }, [bookingId, room?.id, room?.category_id, currentBooking?.category_id]);

  useEffect(() => {
    if (visible && bookingId) {
      fetchAvailableRooms(showAllCategories);
    }
  }, [visible, bookingId, showAllCategories, fetchAvailableRooms]);

  const handleSelectQuickReason = (item: typeof QUICK_REASONS[0]) => {
    setReason(item.label);
    setIssueType(item.type);
    setOldRoomStatus(item.defaultStatus as 'maintenance' | 'cleaning');
    setEquipmentName(item.equipment);
    Haptics.selectionAsync();
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Cần cấp quyền', 'Vui lòng cấp quyền Camera để chụp ảnh hiện trường hư hại.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.6,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setEvidenceImage(result.assets[0]);
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
        quality: 0.6,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setEvidenceImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở thư viện ảnh:', e);
    }
  };

  const handleSubmit = async () => {
    if (!room || !bookingId) return;

    if (!selectedRoomId) {
      Alert.alert('Chưa chọn phòng mới', 'Vui lòng chọn phòng trống sẵn sàng để chuyển khách sang.');
      return;
    }

    if (!reason.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập lý do đổi phòng cho khách.');
      return;
    }

    const selectedRoom = availableRooms.find((r) => r.id === selectedRoomId);
    const targetRoomText = selectedRoom ? `P.${selectedRoom.room_number}` : 'phòng mới';

    Alert.alert(
      'Xác nhận Đổi phòng',
      `Bạn có chắc chắn muốn chuyển khách ${currentBooking?.guest_name || 'này'} từ phòng P.${room.room_number} sang ${targetRoomText} không?\n\nPhòng P.${room.room_number} sẽ tự động chuyển sang trạng thái ${oldRoomStatus === 'maintenance' ? 'BẢO TRÌ' : 'CẦN DỌN'}.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đồng ý đổi phòng',
          style: 'default',
          onPress: async () => {
            setSubmitting(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const numCost = parseInt(cost.replace(/\D/g, ''), 10) || 0;

            try {
              const formData = new FormData();
              formData.append('new_room_id', String(selectedRoomId));
              formData.append('reason', reason.trim());
              formData.append('old_room_status', oldRoomStatus);
              formData.append('maintenance_equipment', equipmentName.trim() || reason.trim());
              formData.append('maintenance_issue_type', issueType);
              formData.append('maintenance_description', reason.trim());
              formData.append('parts_replaced', partsReplaced.trim());
              formData.append('cost', String(numCost));
              formData.append('is_guest_fault', String(isGuestFault));

              if (evidenceImage) {
                const uri = evidenceImage.uri;
                const filename = uri.split('/').pop() || 'change_room_photo.jpg';
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : `image/jpeg`;
                formData.append('image_before', {
                  uri,
                  name: filename,
                  type,
                } as any);
              }

              const res = await apiClient.post(`/bookings/${bookingId}/change-room/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
              });

              if (res.data?.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                  'Đổi phòng thành công! 🎉',
                  `Đã chuyển khách ${currentBooking?.guest_name || ''} sang ${targetRoomText}.\nPhòng P.${room.room_number} đã chuyển sang trạng thái ${oldRoomStatus === 'maintenance' ? 'Bảo trì' : 'Cần dọn'}.`,
                  [{ text: 'OK', onPress: () => {
                    onClose();
                    onSuccess();
                  }}]
                );
              } else {
                Alert.alert('Thất bại', res.data?.message || 'Có lỗi xảy ra khi đổi phòng.');
              }
            } catch (err: any) {
              const msg = err.response?.data?.message || err.message || 'Không thể đổi phòng cho khách.';
              Alert.alert('Lỗi đổi phòng', msg);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (!visible || !room) return null;

  const selectedRoom = availableRooms.find((r) => r.id === selectedRoomId);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={Keyboard.dismiss}
        />
        <View
          style={[
            styles.modalCardLarge,
            !isDark && {
              backgroundColor: '#FFFFFF',
              borderTopColor: '#E2E8F0',
              shadowColor: '#64748B',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.modalTopBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
              <View
                style={[
                  styles.modalIconCircle,
                  { backgroundColor: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.35)' },
                  !isDark && { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
                ]}
              >
                <Ionicons name="swap-horizontal" size={20} color="#6366F1" />
              </View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={[styles.modalRoomTitle, !isDark && { color: '#0F172A' }]}>
                  Đổi Phòng Cho Khách
                </Text>
                <Text style={[styles.modalRoomSubtitle, !isDark && { color: '#64748B' }]} numberOfLines={1}>
                  Phòng hiện tại: P.{room.room_number} (Tầng {room.floor} • {room.category_name})
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.modalCloseCircle, !isDark && { backgroundColor: '#F1F5F9' }]}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#475569'} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 25 }}
          >
            {/* 1. Thông tin khách đang lưu trú */}
            {currentBooking && (
              <View
                style={[
                  styles.occupiedNoticeBanner,
                  { backgroundColor: 'rgba(99, 102, 241, 0.08)', borderColor: 'rgba(99, 102, 241, 0.25)' },
                  !isDark && { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 }}>
                    <Ionicons name="person" size={13} color="#4F46E5" style={{ marginRight: 5 }} />
                    <Text style={[styles.occupiedNoticeGuest, { color: '#4F46E5' }]} numberOfLines={1}>
                      Khách: {currentBooking.guest_name}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.occupiedNoticeCode,
                      { backgroundColor: 'rgba(79, 70, 229, 0.15)', color: '#4F46E5' },
                    ]}
                  >
                    #{currentBooking.booking_code}
                  </Text>
                </View>
                <Text style={[styles.occupiedNoticeSub, !isDark && { color: '#3730A3' }]}>
                  ⚡ Nghiệp vụ Đổi phòng khẩn cấp: Hệ thống sẽ chuyển toàn bộ dịch vụ, tiền phòng sang phòng mới và tự động cách ly phòng P.{room.room_number} để bảo trì.
                </Text>
              </View>
            )}

            {/* 2. Chọn phòng trống mới */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 4 }}>
              <Text style={[styles.modalSectionLabel, { marginBottom: 0 }, !isDark && { color: '#0F172A' }]}>
                1. Chọn phòng sạch chuyển đến (*):
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAllCategories(!showAllCategories);
                  Haptics.selectionAsync();
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                  backgroundColor: showAllCategories ? 'rgba(99, 102, 241, 0.18)' : (isDark ? '#1E293B' : '#F1F5F9'),
                  borderWidth: 1,
                  borderColor: showAllCategories ? '#6366F1' : (isDark ? '#334155' : '#E2E8F0'),
                }}
              >
                <Ionicons
                  name={showAllCategories ? 'checkbox' : 'square-outline'}
                  size={13}
                  color={showAllCategories ? '#6366F1' : (isDark ? '#94A3B8' : '#64748B')}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: '700',
                    color: showAllCategories ? '#6366F1' : (isDark ? '#94A3B8' : '#64748B'),
                  }}
                >
                  Tất cả hạng phòng
                </Text>
              </TouchableOpacity>
            </View>

            {loadingRooms ? (
              <View style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color="#6366F1" />
                <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 6 }}>
                  Đang kiểm tra phòng trống sẵn sàng...
                </Text>
              </View>
            ) : availableRooms.length === 0 ? (
              <View
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  borderColor: 'rgba(239, 68, 68, 0.25)',
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 12,
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <Ionicons name="alert-circle" size={20} color="#EF4444" style={{ marginBottom: 4 }} />
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#EF4444', textAlign: 'center' }}>
                  Không còn phòng trống cùng hạng ({room.category_name})!
                </Text>
                <Text style={{ fontSize: 10.5, color: isDark ? '#CBD5E1' : '#64748B', textAlign: 'center', marginTop: 2 }}>
                  Vui lòng bật tùy chọn "Tất cả hạng phòng" ở trên để chuyển sang hạng khác.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4, marginBottom: 12 }}
              >
                {availableRooms.map((r) => {
                  const isSelected = selectedRoomId === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[
                        {
                          minWidth: 115,
                          padding: 10,
                          borderRadius: 12,
                          backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                          borderWidth: 1.5,
                          borderColor: isDark ? '#334155' : '#E2E8F0',
                        },
                        isSelected && {
                          borderColor: '#10B981',
                          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)',
                        },
                      ]}
                      onPress={() => {
                        setSelectedRoomId(r.id);
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: 14, fontWeight: '900', color: isDark ? '#F8FAFC' : '#0F172A' }}>
                          P.{r.room_number}
                        </Text>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        ) : (
                          <View
                            style={{
                              backgroundColor: 'rgba(16, 185, 129, 0.12)',
                              paddingHorizontal: 4,
                              paddingVertical: 1,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ fontSize: 8.5, fontWeight: '800', color: '#10B981' }}>SẠCH</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 9.5, color: isDark ? '#94A3B8' : '#64748B' }} numberOfLines={1}>
                        Tầng {r.floor}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: isSelected ? '#10B981' : (isDark ? '#CBD5E1' : '#334155'),
                          marginTop: 2,
                        }}
                        numberOfLines={1}
                      >
                        {r.category_name || 'Tiêu chuẩn'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* 3. Lý do đổi phòng (Quick reasons) */}
            <Text style={[styles.modalSectionLabel, { marginTop: 4 }, !isDark && { color: '#0F172A' }]}>
              2. Lý do đổi phòng (*):
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {QUICK_REASONS.map((qr) => {
                const isActive = reason === qr.label;
                return (
                  <TouchableOpacity
                    key={qr.label}
                    style={[
                      styles.suggestionChip,
                      !isDark && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
                      isActive && styles.suggestionChipActive,
                    ]}
                    onPress={() => handleSelectQuickReason(qr)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={qr.icon as any}
                      size={12}
                      color={isActive ? '#38BDF8' : (isDark ? '#94A3B8' : '#64748B')}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.suggestionChipText, isActive && styles.suggestionChipTextActive]}>
                      {qr.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              style={[
                styles.modalTextInputSingle,
                !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' },
              ]}
              placeholder="Nhập chi tiết hiện tượng sự cố..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={reason}
              onChangeText={setReason}
            />

            {/* 4. Trạng thái phòng cũ sau khi chuyển */}
            <Text style={[styles.modalSectionLabel, { marginTop: 14 }, !isDark && { color: '#0F172A' }]}>
              3. Chuyển phòng cũ P.{room.room_number} sang (*):
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <TouchableOpacity
                style={[
                  {
                    flex: 1,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                    borderWidth: 1.5,
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                  },
                  oldRoomStatus === 'maintenance' && {
                    borderColor: '#EF4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  },
                ]}
                onPress={() => {
                  setOldRoomStatus('maintenance');
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="construct"
                  size={15}
                  color={oldRoomStatus === 'maintenance' ? '#EF4444' : (isDark ? '#94A3B8' : '#64748B')}
                />
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: '800',
                    color: oldRoomStatus === 'maintenance' ? '#EF4444' : (isDark ? '#94A3B8' : '#64748B'),
                  }}
                >
                  Bảo trì (Tạo phiếu kỹ thuật)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  {
                    flex: 1,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                    borderWidth: 1.5,
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                  },
                  oldRoomStatus === 'cleaning' && {
                    borderColor: '#F59E0B',
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  },
                ]}
                onPress={() => {
                  setOldRoomStatus('cleaning');
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="sparkles"
                  size={15}
                  color={oldRoomStatus === 'cleaning' ? '#F59E0B' : (isDark ? '#94A3B8' : '#64748B')}
                />
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: '800',
                    color: oldRoomStatus === 'cleaning' ? '#F59E0B' : (isDark ? '#94A3B8' : '#64748B'),
                  }}
                >
                  Cần dọn dẹp lại
                </Text>
              </TouchableOpacity>
            </View>

            {oldRoomStatus === 'maintenance' && (
              <View style={{ marginBottom: 10 }}>
                <Text style={[{ fontSize: 11, fontWeight: '700', marginBottom: 4 }, !isDark ? { color: '#334155' } : { color: '#CBD5E1' }]}>
                  Tên thiết bị hỏng:
                </Text>
                <TextInput
                  style={[
                    styles.modalTextInputSingle,
                    !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' },
                  ]}
                  placeholder="VD: Điều hòa Daikin, Khóa từ, Vòi sen tắm..."
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  value={equipmentName}
                  onChangeText={setEquipmentName}
                />
              </View>
            )}

            {/* 5. Chụp ảnh hiện trường hư hại (Tùy chọn) */}
            <Text style={[styles.modalSectionLabel, { marginTop: 6 }, !isDark && { color: '#0F172A' }]}>
              4. Ảnh hiện trường sự cố (Tùy chọn):
            </Text>
            {evidenceImage ? (
              <View style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                <Image
                  source={{ uri: evidenceImage.uri }}
                  style={{ width: '100%', height: 160, borderRadius: 12 }}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    borderRadius: 14,
                    width: 28,
                    height: 28,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => setEvidenceImage(null)}
                >
                  <Ionicons name="trash" size={15} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: isDark ? '#334155' : '#CBD5E1',
                    paddingVertical: 10,
                    gap: 6,
                  }}
                  onPress={takePhoto}
                  activeOpacity={0.7}
                >
                  <Ionicons name="camera" size={16} color="#6366F1" />
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#6366F1' }}>Chụp ảnh</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: isDark ? '#334155' : '#CBD5E1',
                    paddingVertical: 10,
                    gap: 6,
                  }}
                  onPress={pickLibrary}
                  activeOpacity={0.7}
                >
                  <Ionicons name="images" size={16} color={isDark ? '#94A3B8' : '#475569'} />
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: isDark ? '#94A3B8' : '#475569' }}>Thư viện</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Nút gửi form */}
            <TouchableOpacity
              style={[
                styles.modalConfirmBtn,
                { backgroundColor: '#4F46E5', marginTop: 10 },
                (!selectedRoomId || submitting) && { opacity: 0.5 },
              ]}
              onPress={handleSubmit}
              disabled={!selectedRoomId || submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="swap-horizontal" size={18} color="#FFFFFF" />
                  <Text style={[styles.modalConfirmBtnText, { color: '#FFFFFF' }]}>
                    {selectedRoom ? `Xác nhận chuyển sang P.${selectedRoom.room_number}` : 'Vui lòng chọn phòng trống'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

