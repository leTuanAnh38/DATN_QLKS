import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { MAINTENANCE_ISSUE_TYPES, EQUIPMENT_SUGGESTIONS } from '../../constants/maintenance';
import { styles } from './styles';
import type { RoomItem } from './types';
import { useAppTheme } from '../../contexts/ThemeContext';

interface BreakdownModalProps {
  visible: boolean;
  room: RoomItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const BreakdownModal: React.FC<BreakdownModalProps> = ({
  visible,
  room,
  onClose,
  onSuccess,
}) => {
  const { isDark } = useAppTheme();
  const [breakdownIssueType, setBreakdownIssueType] = useState('ac');
  const [breakdownEquipment, setBreakdownEquipment] = useState('Điều hòa Daikin');
  const [breakdownDesc, setBreakdownDesc] = useState('');
  const [breakdownPartsReplaced, setBreakdownPartsReplaced] = useState('');
  const [breakdownCost, setBreakdownCost] = useState('');
  const [isGuestFault, setIsGuestFault] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && room) {
      setBreakdownIssueType('ac');
      setBreakdownEquipment('Điều hòa Daikin');
      setBreakdownDesc('');
      setBreakdownPartsReplaced('');
      setBreakdownCost('');
      setIsGuestFault(room.status === 'occupied');
    }
  }, [visible, room?.id]);

  const handleSubmit = async () => {
    if (!room) return;
    if (!breakdownEquipment.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thiết bị bị hư hỏng.');
      return;
    }
    if (!breakdownDesc.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mô tả hiện tượng sự cố thiết bị.');
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const numCost = parseInt(breakdownCost.replace(/\D/g, ''), 10) || 0;
    const currentBk = room.current_booking || room.recent_booking;

    try {
      const res = await apiClient.post('/rooms/maintenance-tickets/', {
        room_id: room.id,
        equipment_name: breakdownEquipment.trim(),
        issue_type: breakdownIssueType,
        description: breakdownDesc.trim(),
        parts_replaced: breakdownPartsReplaced.trim(),
        cost: numCost,
        is_guest_fault: isGuestFault,
        booking_id: isGuestFault && currentBk ? currentBk.id : null,
      });

      if (res.data?.success || res.data?.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const ticketCode = res.data.ticket_code || res.data.ticket?.ticket_code || 'MT';
        Alert.alert(
          'Đã lập phiếu bảo trì thành công 🛠️',
          `Đã tạo phiếu #${ticketCode} cho Phòng ${room.room_number}.\nPhòng đã chuyển sang trạng thái "Bảo trì" và gửi chuông báo cho Đội Kỹ thuật!`
        );
        onClose();
        onSuccess();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể tạo phiếu sự cố kỹ thuật.';
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
            styles.modalCardLarge,
            !isDark && {
              backgroundColor: '#FFFFFF',
              borderTopColor: '#E2E8F0',
              shadowColor: '#64748B',
            },
          ]}
        >
          {/* Top Header Bar */}
          <View style={styles.modalTopBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
              <View
                style={[
                  styles.modalIconCircle,
                  !isDark && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
                ]}
              >
                <Ionicons name="construct" size={20} color="#DC2626" />
              </View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={[styles.modalRoomTitle, !isDark && { color: '#0F172A' }]}>
                  Báo Hỏng Phòng {room.room_number}
                </Text>
                <Text
                  style={[styles.modalRoomSubtitle, !isDark && { color: '#64748B' }]}
                  numberOfLines={1}
                >
                  Tầng {room.floor} • {room.category_name || 'Phòng Deluxe'}
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

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 25 }}>
            {/* 1. Banner cảnh báo nếu phòng đang có khách */}
            {room.current_booking && (
              <View
                style={[
                  styles.occupiedNoticeBanner,
                  !isDark && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 }}>
                    <Ionicons name="person" size={13} color="#D97706" style={{ marginRight: 5 }} />
                    <Text
                      style={[styles.occupiedNoticeGuest, !isDark && { color: '#B45309' }]}
                      numberOfLines={1}
                    >
                      Khách: {room.current_booking.guest_name}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.occupiedNoticeCode,
                      !isDark && { backgroundColor: 'rgba(217, 119, 6, 0.15)', color: '#B45309' },
                    ]}
                  >
                    #{room.current_booking.booking_code}
                  </Text>
                </View>
                <Text style={[styles.occupiedNoticeSub, !isDark && { color: '#78350F' }]}>
                  💡 Lưu ý: Khách đang ở trong phòng. Kỹ thuật viên cần liên hệ quầy Lễ tân hoặc gõ cửa xin phép trước khi vào sửa chữa.
                </Text>
              </View>
            )}

            {/* 2. Phân loại sự cố kỹ thuật */}
            <Text style={[styles.modalSectionLabel, !isDark && { color: '#B45309' }]}>
              1. Phân loại sự cố kỹ thuật (*):
            </Text>
            <View style={styles.issueTypeGrid}>
              {MAINTENANCE_ISSUE_TYPES.map((t) => {
                const isSelected = breakdownIssueType === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[
                      styles.issueTypeCard,
                      !isDark && !isSelected && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                      isSelected && styles.issueTypeCardActive,
                      !isDark && isSelected && { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#D97706' },
                    ]}
                    onPress={() => {
                      setBreakdownIssueType(t.key);
                      const suggestions = EQUIPMENT_SUGGESTIONS[t.key] || [];
                      if (suggestions.length > 0) {
                        setBreakdownEquipment(suggestions[0]);
                      }
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={t.icon as any}
                      size={15}
                      color={isSelected ? t.color : isDark ? '#94A3B8' : '#64748B'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.issueTypeText,
                        !isDark && !isSelected && { color: '#475569' },
                        isSelected && { color: t.color, fontWeight: '800' },
                      ]}
                      numberOfLines={1}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 3. Tên thiết bị hư hỏng */}
            <Text style={[styles.modalSectionLabel, { marginTop: 14 }, !isDark && { color: '#B45309' }]}>
              2. Tên thiết bị hư hỏng (*):
            </Text>
            <TextInput
              style={[
                styles.modalTextInputSingle,
                !isDark && {
                  backgroundColor: '#F8FAFC',
                  borderColor: '#CBD5E1',
                  color: '#0F172A',
                },
              ]}
              placeholder="VD: Điều hòa Daikin, Vòi sen tắm, Khóa từ..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={breakdownEquipment}
              onChangeText={setBreakdownEquipment}
            />

            {/* Gợi ý nhanh các thiết bị thông dụng */}
            <View style={styles.suggestionRow}>
              <Text style={[styles.suggestionTitle, !isDark && { color: '#64748B' }]}>Gợi ý nhanh:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {(EQUIPMENT_SUGGESTIONS[breakdownIssueType] || []).map((item) => {
                  const isActive = breakdownEquipment === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.suggestionChip,
                        !isDark && !isActive && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
                        isActive && styles.suggestionChipActive,
                      ]}
                      onPress={() => {
                        setBreakdownEquipment(item);
                        Haptics.selectionAsync();
                      }}
                    >
                      <Text
                        style={[
                          styles.suggestionChipText,
                          !isDark && !isActive && { color: '#475569' },
                          isActive && styles.suggestionChipTextActive,
                        ]}
                      >
                        + {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 4. Mô tả hiện tượng sự cố */}
            <Text style={[styles.modalSectionLabel, { marginTop: 14 }, !isDark && { color: '#B45309' }]}>
              3. Mô tả hiện tượng sự cố chi tiết (*):
            </Text>
            <TextInput
              style={[
                styles.modalTextInput,
                { height: 75 },
                !isDark && {
                  backgroundColor: '#F8FAFC',
                  borderColor: '#CBD5E1',
                  color: '#0F172A',
                },
              ]}
              placeholder="VD: Máy lạnh không phả hơi lạnh, quạt gió kêu to, vòi sen bị nứt cần gạt, khóa thẻ từ quét nhấp nháy đỏ không nhận..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              multiline
              value={breakdownDesc}
              onChangeText={setBreakdownDesc}
            />

            {/* 5. Phụ tùng / Vật tư thay thế cần mang theo */}
            <Text style={[styles.modalSectionLabel, { marginTop: 14 }, !isDark && { color: '#B45309' }]}>
              4. Phụ tùng / Dụng cụ mang theo dự kiến:
            </Text>
            <TextInput
              style={[
                styles.modalTextInputSingle,
                !isDark && {
                  backgroundColor: '#F8FAFC',
                  borderColor: '#CBD5E1',
                  color: '#0F172A',
                },
              ]}
              placeholder="VD: 1 Củ sen Inax, 1 Dây xịt vệ sinh, 2 Pin AAA, 1 Tụ 35uF..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={breakdownPartsReplaced}
              onChangeText={setBreakdownPartsReplaced}
            />

            {/* 6. Trách nhiệm bồi thường & Chi phí */}
            <View
              style={[
                styles.costFaultBox,
                !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
              ]}
            >
              <TouchableOpacity
                style={styles.faultCheckboxRow}
                onPress={() => {
                  setIsGuestFault(!isGuestFault);
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isGuestFault ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={isGuestFault ? '#F59E0B' : isDark ? '#64748B' : '#94A3B8'}
                />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={[styles.faultCheckboxTitle, !isDark && { color: '#0F172A' }]}>
                    Do khách làm hỏng (Khách bồi thường)?
                  </Text>
                  <Text style={[styles.faultCheckboxSub, !isDark && { color: '#64748B' }]}>
                    {isGuestFault
                      ? 'Khoản đền bù sẽ được tự động cộng vào hóa đơn thanh toán của khách.'
                      : 'Khách sạn chịu chi phí hao mòn / sửa chữa thông thường.'}
                  </Text>
                </View>
              </TouchableOpacity>

              {isGuestFault && (
                <View style={{ marginTop: 10 }}>
                  <Text style={[styles.costInputLabel, !isDark && { color: '#334155' }]}>
                    Chi phí bồi thường / sửa chữa (VND):
                  </Text>
                  <View
                    style={[
                      styles.costInputWrapper,
                      !isDark && { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' },
                    ]}
                  >
                    <TextInput
                      style={[styles.costInput, !isDark && { color: '#D97706' }]}
                      placeholder="0"
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                      keyboardType="numeric"
                      value={
                        breakdownCost
                          ? Number(breakdownCost.replace(/\D/g, '')).toLocaleString('vi-VN')
                          : ''
                      }
                      onChangeText={(t) => setBreakdownCost(t.replace(/\D/g, ''))}
                    />
                    <Text style={[styles.costCurrencyUnit, !isDark && { color: '#64748B' }]}>VNĐ</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Thông báo cách ly */}
            <View
              style={[
                styles.breakdownNoticeBox,
                !isDark && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
              ]}
            >
              <Ionicons name="information-circle" size={16} color="#D97706" style={{ marginRight: 6 }} />
              <Text style={[styles.breakdownNoticeText, !isDark && { color: '#78350F' }]}>
                Sau khi gửi phiếu, phòng sẽ tự động chuyển sang trạng thái <Text style={{ color: '#DC2626', fontWeight: '800' }}>"Bảo trì"</Text> để cách ly và thông báo Đội Kỹ thuật lập tức tiếp nhận.
              </Text>
            </View>

            {/* Nút gửi phiếu */}
            <TouchableOpacity
              style={[styles.breakdownSubmitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#0A0F1D" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="construct" size={17} color="#0A0F1D" style={{ marginRight: 6 }} />
                  <Text style={styles.breakdownSubmitBtnText}>LẬP PHIẾU BẢO TRÌ & BÁO KỸ THUẬT</Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
