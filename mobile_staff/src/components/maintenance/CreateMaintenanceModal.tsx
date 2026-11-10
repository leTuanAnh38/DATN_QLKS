import React, { useState, useEffect, useMemo } from 'react';
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
import {
  MAINTENANCE_ISSUE_TYPES,
  EQUIPMENT_SUGGESTIONS,
  PARTS_SUGGESTIONS,
  getRoomStatusColor,
  getRoomStatusLabel,
} from '../../constants/maintenance';

export interface CreateMaintenanceModalProps {
  visible: boolean;
  isDark?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateMaintenanceModal: React.FC<CreateMaintenanceModalProps> = ({
  visible,
  isDark = true,
  onClose,
  onSuccess,
}) => {
  const [roomsList, setRoomsList] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [roomFilterText, setRoomFilterText] = useState('');
  const [equipmentName, setEquipmentName] = useState('Điều hòa Daikin');
  const [issueType, setIssueType] = useState('ac');
  const [createPriority, setCreatePriority] = useState<'urgent' | 'high' | 'normal'>('normal');
  const [breakdownDesc, setBreakdownDesc] = useState('');
  const [createPartsReplaced, setCreatePartsReplaced] = useState('');
  const [createCost, setCreateCost] = useState('');
  const [createIsGuestFault, setCreateIsGuestFault] = useState(false);
  const [createEvidenceImage, setCreateEvidenceImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const selectedRoom = useMemo(() => {
    return roomsList.find((r) => r.id === selectedRoomId) || null;
  }, [roomsList, selectedRoomId]);

  const fetchRoomsList = async () => {
    try {
      setLoadingRooms(true);
      const res = await apiClient.get('/rooms/admin/rooms/');
      const list = res.data.results || res.data.rooms || res.data.data || res.data || [];
      const roomsArr = Array.isArray(list) ? list : [];
      setRoomsList(roomsArr);
      if (roomsArr.length > 0 && !selectedRoomId) {
        setSelectedRoomId(roomsArr[0].id);
        if (roomsArr[0].status === 'occupied') {
          setCreateIsGuestFault(true);
          setCreatePriority('urgent');
        }
      }
    } catch (e) {
      console.warn('Lỗi lấy danh sách phòng:', e);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setEquipmentName('Điều hòa Daikin');
      setIssueType('ac');
      setBreakdownDesc('');
      setCreatePartsReplaced('');
      setCreateCost('');
      setRoomFilterText('');
      setCreateEvidenceImage(null);
      setSubmittingCreate(false);

      if (roomsList.length === 0) {
        fetchRoomsList();
      } else {
        const cur = roomsList.find((r) => r.id === selectedRoomId);
        setCreateIsGuestFault(cur?.status === 'occupied');
        setCreatePriority(cur?.status === 'occupied' ? 'urgent' : 'normal');
      }
    }
  }, [visible]);

  const handleSelectRoom = (room: any) => {
    setSelectedRoomId(room.id);
    setCreateIsGuestFault(room.status === 'occupied');
    setCreatePriority(room.status === 'occupied' ? 'urgent' : 'normal');
    Haptics.selectionAsync();
  };

  const takeCreatePhoto = async () => {
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
        setCreateEvidenceImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở camera:', e);
    }
  };

  const pickCreateLibrary = async () => {
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
        setCreateEvidenceImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở thư viện ảnh:', e);
    }
  };

  const handleCreateTicket = async () => {
    if (!selectedRoomId) {
      Alert.alert('Chưa chọn phòng', 'Vui lòng chọn phòng cần bảo trì sửa chữa.');
      return;
    }
    if (!equipmentName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thiết bị bị hư hỏng.');
      return;
    }
    if (!breakdownDesc.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mô tả sự cố hư hỏng.');
      return;
    }

    const parsedCost = parseInt(createCost.replace(/\D/g, '') || '0', 10);
    const activeBooking = selectedRoom?.current_booking;

    setSubmittingCreate(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const formData = new FormData();
      formData.append('room_id', String(selectedRoomId));
      formData.append('equipment_name', equipmentName.trim());
      formData.append('issue_type', issueType);
      formData.append('priority', createPriority);
      formData.append('description', breakdownDesc.trim());
      formData.append('parts_replaced', createPartsReplaced.trim());
      formData.append('cost', String(parsedCost));
      formData.append('is_guest_fault', String(createIsGuestFault));
      if (createIsGuestFault && activeBooking) {
        formData.append('booking_id', String(activeBooking.id));
      }

      if (createEvidenceImage) {
        const uri = createEvidenceImage.uri;
        const filename = uri.split('/').pop() || 'photo_before.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        // @ts-ignore
        formData.append('image_before', {
          uri: uri,
          name: filename,
          type: type,
        });
      }

      const res = await apiClient.post('/rooms/maintenance-tickets/', formData);

      if (res.data.success || res.data.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Đã tạo phiếu bảo trì',
          `Phòng ${selectedRoom?.room_number || ''} đã chuyển sang trạng thái "Bảo trì" & được cách ly!${
            createIsGuestFault && parsedCost > 0
              ? `\nĐã lập mục bồi thường ${parsedCost.toLocaleString('vi-VN')} đ vào tài khoản lưu trú của khách.`
              : ''
          }`
        );
        onClose();
        onSuccess();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể tạo phiếu bảo trì.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmittingCreate(false);
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
          <View style={[styles.modalContent, { maxHeight: '90%' }, !isDark && { backgroundColor: '#FFFFFF', borderTopColor: '#E2E8F0', shadowColor: '#64748B' }]}>
            <View style={[styles.modalHeader, !isDark && { borderBottomColor: '#F1F5F9' }]}>
              <View>
                <Text style={[styles.modalTitle, !isDark && { color: '#0F172A' }]}>Báo Sự Cố Thiết Bị</Text>
                <Text style={[styles.modalSubtitle, !isDark && { color: '#64748B' }]}>Tạo phiếu bảo trì & cách ly phòng</Text>
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
              {/* 1. Chọn phòng */}
              <Text style={[styles.inputLabel, !isDark && { color: '#334155' }]}>1. Chọn phòng gặp sự cố *:</Text>
              {loadingRooms ? (
                <ActivityIndicator color="#F59E0B" style={{ marginVertical: 8 }} />
              ) : (
                <>
                  <TextInput
                    style={[styles.modalInput, { height: 38, fontSize: 12, marginBottom: 8 }, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
                    placeholder="Lọc số phòng (VD: 101, 202...)"
                    placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                    value={roomFilterText}
                    onChangeText={setRoomFilterText}
                    keyboardType="numeric"
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.roomChipsScroll}
                  >
                    {roomsList
                      .filter((r) =>
                        !roomFilterText ||
                        r.room_number.toLowerCase().includes(roomFilterText.toLowerCase())
                      )
                      .slice(0, 30)
                      .map((r) => {
                        const isSelected = selectedRoomId === r.id;
                        const statusColor = getRoomStatusColor(r.status);
                        return (
                          <TouchableOpacity
                            key={r.id}
                            style={[
                              styles.roomSelectChip,
                              !isDark && !isSelected && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                              isSelected && styles.roomSelectChipActive,
                            ]}
                            onPress={() => handleSelectRoom(r)}
                            activeOpacity={0.7}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <View
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: isSelected ? '#0A0F1D' : statusColor.dot,
                                  marginRight: 5,
                                }}
                              />
                              <Text
                                style={[
                                  styles.roomSelectChipText,
                                  !isDark && !isSelected && { color: '#0F172A' },
                                  isSelected && styles.roomSelectChipTextActive,
                                ]}
                              >
                                P.{r.room_number}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>
                </>
              )}

              {/* Thông tin phòng đã chọn & Cảnh báo khách đang ở */}
              {selectedRoom && (
                <View style={[styles.selectedRoomSummaryCard, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                  <View style={styles.selectedRoomSummaryTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 }}>
                      <View style={[styles.selectedRoomIconWrap, !isDark && { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                        <Ionicons name="bed" size={13} color="#F59E0B" />
                      </View>
                      <Text style={[styles.selectedRoomNumberText, !isDark && { color: '#0F172A' }]}>
                        Phòng {selectedRoom.room_number}
                      </Text>
                      <Text style={[styles.selectedRoomCategoryText, !isDark && { color: '#64748B' }]} numberOfLines={1}>
                        • {selectedRoom.category_name || 'Phòng'} (T.{selectedRoom.floor})
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.selectedRoomStatusBadge,
                        { backgroundColor: getRoomStatusColor(selectedRoom.status).bg },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: getRoomStatusColor(selectedRoom.status).dot },
                        ]}
                      />
                      <Text
                        style={[
                          styles.selectedRoomStatusText,
                          { color: getRoomStatusColor(selectedRoom.status).text },
                        ]}
                      >
                        {selectedRoom.status_display || getRoomStatusLabel(selectedRoom.status)}
                      </Text>
                    </View>
                  </View>

                  {selectedRoom.status === 'occupied' && selectedRoom.current_booking && (
                    <View style={[styles.guestAlertBanner, !isDark && { backgroundColor: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.25)' }]}>
                      <View style={styles.guestAlertHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 }}>
                          <Ionicons name="person" size={12} color="#0284C7" style={{ marginRight: 4 }} />
                          <Text style={[styles.guestAlertTitle, !isDark && { color: '#0369A1' }]} numberOfLines={1}>
                            Khách: {selectedRoom.current_booking.guest_name}
                          </Text>
                        </View>
                        <View style={[styles.guestBookingTag, !isDark && { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.3)' }]}>
                          <Text style={[styles.guestBookingTagText, !isDark && { color: '#0284C7' }]}>
                            #{selectedRoom.current_booking.booking_code}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                        <Ionicons name="information-circle-outline" size={16} color={isDark ? "#38BDF8" : "#0284C7"} style={{ marginTop: 2 }} />
                        <Text style={[styles.guestAlertNote, { flex: 1, marginTop: 0 }, !isDark && { color: '#0369A1' }]}>
                          Lưu ý: Khách đang lưu trú tại phòng. Vui lòng liên hệ Lễ tân hoặc gõ cửa xin phép trước khi vào sửa chữa.
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Mức độ ưu tiên sự cố */}
              <Text style={[styles.inputLabel, { marginTop: 14 }, !isDark && { color: '#334155' }]}>
                Mức độ khẩn cấp *:
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                {[
                  { key: 'normal', label: 'Bình thường', color: '#10B981' },
                  { key: 'high', label: 'Ưu tiên cao', color: '#F59E0B' },
                  { key: 'urgent', label: 'Khẩn cấp', color: '#EF4444' },
                ].map((p) => {
                  const isSelected = createPriority === p.key;
                  return (
                    <TouchableOpacity
                      key={p.key}
                      style={[
                        styles.prioritySelectChip,
                        !isDark && !isSelected && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                        isSelected && { backgroundColor: `${p.color}20`, borderColor: p.color, borderWidth: 1.5 },
                      ]}
                      onPress={() => {
                        setCreatePriority(p.key as any);
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.prioritySelectChipText,
                          { color: isSelected ? p.color : (isDark ? '#94A3B8' : '#64748B'), fontWeight: isSelected ? '800' : '600' },
                        ]}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 2. Loại sự cố */}
              <Text style={[styles.inputLabel, { marginTop: 14 }, !isDark && { color: '#334155' }]}>2. Phân loại sự cố kỹ thuật *:</Text>
              <View style={styles.issueTypeGrid}>
                {MAINTENANCE_ISSUE_TYPES.map((it) => {
                  const isSelected = issueType === it.key;
                  return (
                    <TouchableOpacity
                      key={it.key}
                      style={[
                        styles.issueTypeGridCard,
                        !isDark && !isSelected && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                        isSelected && { borderColor: it.color, backgroundColor: `${it.color}15` },
                      ]}
                      onPress={() => {
                        setIssueType(it.key);
                        const suggestions = EQUIPMENT_SUGGESTIONS[it.key] || [];
                        if (suggestions.length > 0) {
                          setEquipmentName(suggestions[0]);
                        }
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={it.icon as any}
                        size={14}
                        color={isSelected ? it.color : (isDark ? '#94A3B8' : '#64748B')}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.issueTypeGridLabel,
                          !isDark && !isSelected && { color: '#475569' },
                          isSelected && { color: it.color, fontWeight: '800' },
                        ]}
                        numberOfLines={1}
                      >
                        {it.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 3. Tên thiết bị */}
              <Text style={[styles.inputLabel, { marginTop: 14 }, !isDark && { color: '#334155' }]}>3. Tên thiết bị hỏng *:</Text>
              <TextInput
                style={[styles.modalInput, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
                placeholder="VD: Điều hòa Daikin, Tivi Samsung, Khóa từ..."
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={equipmentName}
                onChangeText={setEquipmentName}
              />
              <View style={styles.suggestionRow}>
                <Text style={[styles.suggestionTitle, !isDark && { color: '#64748B' }]}>Gợi ý nhanh:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {(EQUIPMENT_SUGGESTIONS[issueType] || []).map((eq) => (
                    <TouchableOpacity
                      key={eq}
                      style={[
                        styles.quickEquipChip,
                        !isDark && equipmentName !== eq && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
                        equipmentName === eq && styles.quickEquipChipActive,
                      ]}
                      onPress={() => {
                        setEquipmentName(eq);
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.quickEquipChipText,
                          !isDark && equipmentName !== eq && { color: '#475569' },
                          equipmentName === eq && styles.quickEquipChipTextActive,
                        ]}
                      >
                        + {eq}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* 4. Mô tả chi tiết hiện tượng */}
              <Text style={[styles.inputLabel, { marginTop: 14 }, !isDark && { color: '#334155' }]}>4. Mô tả chi tiết sự cố & Hiện tượng *:</Text>
              <TextInput
                style={[styles.modalInput, { height: 70 }, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
                placeholder="Hiện tượng: chảy nước, không mát, chập điện, có tiếng kêu to..."
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                multiline
                value={breakdownDesc}
                onChangeText={setBreakdownDesc}
              />

              {/* 5. Phụ tùng / Vật tư thay thế mang theo dự kiến */}
              <Text style={[styles.inputLabel, { marginTop: 14 }, !isDark && { color: '#334155' }]}>5. Phụ tùng / Dụng cụ mang theo dự kiến:</Text>
              <TextInput
                style={[styles.modalInput, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' }]}
                placeholder="VD: 1 Tụ kích 35uF, 1 Dây cấp inox, 2 Pin AAA, Cầu chì 10A..."
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                value={createPartsReplaced}
                onChangeText={setCreatePartsReplaced}
              />
              {PARTS_SUGGESTIONS[issueType] && (
                <View style={[styles.suggestionRow, { marginBottom: 6 }]}>
                  <Text style={[styles.suggestionTitle, !isDark && { color: '#64748B' }]}>Gợi ý vật tư:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6 }}
                  >
                    {PARTS_SUGGESTIONS[issueType].map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.quickEquipChip,
                          !isDark && createPartsReplaced !== p && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
                          createPartsReplaced === p && styles.quickEquipChipActive,
                        ]}
                        onPress={() => {
                          setCreatePartsReplaced(p);
                          Haptics.selectionAsync();
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.quickEquipChipText,
                            !isDark && createPartsReplaced !== p && { color: '#475569' },
                            createPartsReplaced === p && styles.quickEquipChipTextActive,
                          ]}
                        >
                          + {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* 6. Phân loại trách nhiệm chi phí & Đền bù */}
              <View style={[styles.costFaultBox, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                <TouchableOpacity
                  style={styles.faultCheckboxRow}
                  onPress={() => {
                    setCreateIsGuestFault(!createIsGuestFault);
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={createIsGuestFault ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={createIsGuestFault ? '#F59E0B' : (isDark ? '#64748B' : '#94A3B8')}
                  />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={[styles.faultCheckboxTitle, !isDark && { color: '#0F172A' }]}>
                      Do khách làm hư hỏng (Tính phí bồi thường)?
                    </Text>
                    <Text style={[styles.faultCheckboxSub, !isDark && { color: '#64748B' }]}>
                      {createIsGuestFault
                        ? (selectedRoom?.current_booking
                            ? `Khoản đền bù sẽ tự động cộng vào hóa đơn khách #${selectedRoom.current_booking.booking_code} tại Lễ tân.`
                            : 'Khoản đền bù sẽ ghi nhận vào phiếu để Lễ tân đối soát thu tiền.')
                        : 'Hao mòn tự nhiên trong vận hành (Khách sạn chịu chi phí bảo trì).'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {createIsGuestFault && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={[styles.costInputLabel, !isDark && { color: '#334155' }]}>Chi phí bồi thường / sửa chữa (VNĐ):</Text>
                    <View style={[styles.costInputWrapper, !isDark && { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' }]}>
                      <TextInput
                        style={[styles.costInput, !isDark && { color: '#0F172A' }]}
                        placeholder="0"
                        placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                        keyboardType="numeric"
                        value={
                          createCost
                            ? Number(createCost.replace(/\D/g, '')).toLocaleString('vi-VN')
                            : ''
                        }
                        onChangeText={(t) => setCreateCost(t.replace(/\D/g, ''))}
                      />
                      <Text style={styles.costCurrencyUnit}>VNĐ</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* 7. Ảnh hiện trường hư hại */}
              <Text style={[styles.inputLabel, { marginTop: 14 }, !isDark && { color: '#334155' }]}>
                7. Ảnh hiện trường hư hại (Bằng chứng đối soát):
              </Text>
              {createEvidenceImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: createEvidenceImage.uri }} style={styles.imagePreview} resizeMode="cover" />
                  <View style={styles.imagePreviewOverlay}>
                    <TouchableOpacity
                      style={styles.imageActionBtn}
                      onPress={takeCreatePhoto}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera" size={14} color="#F8FAFC" style={{ marginRight: 4 }} />
                      <Text style={styles.imageActionBtnText}>Chụp lại</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.imageActionBtn, { backgroundColor: '#EF4444' }]}
                      onPress={() => setCreateEvidenceImage(null)}
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
                    onPress={takeCreatePhoto}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera" size={20} color={isDark ? '#F59E0B' : '#D97706'} />
                    <Text style={[styles.photoPickerText, !isDark && { color: '#D97706' }]}>
                      Chụp ảnh camera
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.photoPickerBtn,
                      !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                    ]}
                    onPress={pickCreateLibrary}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="images" size={20} color="#0284C7" />
                    <Text style={[styles.photoPickerText, { color: '#0284C7' }]}>Chọn từ thư viện</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={[styles.alertNoteBox, !isDark && { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }]}>
                <Ionicons name="information-circle" size={17} color="#F59E0B" style={{ marginRight: 8 }} />
                <Text style={[styles.alertNoteText, !isDark && { color: '#B45309' }]}>
                  Sau khi gửi phiếu, phòng sẽ tự động chuyển sang trạng thái <Text style={{ color: '#F87171', fontWeight: '800' }}>"Bảo trì"</Text> để cách ly trên sơ đồ khách sạn cho đến khi bạn hoàn tất sửa chữa.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.modalConfirmBtn, submittingCreate && { opacity: 0.6 }]}
                onPress={handleCreateTicket}
                disabled={submittingCreate}
                activeOpacity={0.8}
              >
                {submittingCreate ? (
                  <ActivityIndicator color="#0A0F1D" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="construct" size={17} color="#0A0F1D" style={{ marginRight: 6 }} />
                    <Text style={styles.modalConfirmBtnText}>TẠO PHIẾU BẢO TRÌ & CÁCH LY PHÒNG</Text>
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
  roomChipsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  roomSelectChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  roomSelectChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  roomSelectChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E2E8F0',
  },
  roomSelectChipTextActive: {
    color: '#0A0F1D',
  },
  selectedRoomSummaryCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 6,
  },
  selectedRoomSummaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedRoomIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  selectedRoomNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
    marginRight: 4,
  },
  selectedRoomCategoryText: {
    fontSize: 11,
    color: '#94A3B8',
    flexShrink: 1,
  },
  selectedRoomStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  selectedRoomStatusText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  guestAlertBanner: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    padding: 8,
    marginTop: 8,
  },
  guestAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  guestAlertTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#38BDF8',
  },
  guestBookingTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  guestBookingTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
  },
  guestAlertNote: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 14,
  },
  prioritySelectChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prioritySelectChipText: {
    fontSize: 12,
  },
  issueTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  issueTypeGridCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  issueTypeGridLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94A3B8',
    flexShrink: 1,
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
  costFaultBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginTop: 12,
  },
  faultCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  faultCheckboxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  faultCheckboxSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 15,
  },
  costInputLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 6,
  },
  costInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
  },
  costInput: {
    flex: 1,
    height: 42,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  costCurrencyUnit: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
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

