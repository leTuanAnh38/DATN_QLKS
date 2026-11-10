import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { getVehicleImage } from './TransportCard';

export interface CreateTransportModalProps {
  visible: boolean;
  isDark?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateTransportModal: React.FC<CreateTransportModalProps> = ({
  visible,
  isDark = true,
  onClose,
  onSuccess,
}) => {
  const [occupiedRooms, setOccupiedRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [transportServices, setTransportServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [pickupLocation, setPickupLocation] = useState('Sân bay quốc tế Đà Nẵng');
  const [dropoffLocation, setDropoffLocation] = useState('Sảnh TA Luxury Hotel');
  const [flightCode, setFlightCode] = useState('');
  const [pickupTime, setPickupTime] = useState('14:30');
  const [passengerCount, setPassengerCount] = useState(2);
  const [note, setNote] = useState('');
  const [loadingModalData, setLoadingModalData] = useState(false);
  const [submittingBooking, setSubmittingBooking] = useState(false);

  const fetchModalData = async () => {
    setLoadingModalData(true);
    try {
      const [resRooms, resServices] = await Promise.all([
        apiClient.get('/rooms/admin/rooms/'),
        apiClient.get('/services/items/?all=true'),
      ]);

      const rList = resRooms.data.results || resRooms.data.rooms || resRooms.data.data || resRooms.data || [];
      const occ = (Array.isArray(rList) ? rList : []).filter(
        (r: any) => r.status === 'occupied' && r.current_booking
      );
      setOccupiedRooms(occ);
      if (occ.length > 0) {
        setSelectedRoom(occ[0]);
      }

      const sList = resServices.data.results || resServices.data.items || resServices.data.data || resServices.data || [];
      const trans = (Array.isArray(sList) ? sList : []).filter((s: any) => {
        const t = `${s.name || ''} ${s.category_name || ''}`.toLowerCase();
        return (
          t.includes('xe') ||
          t.includes('sân bay') ||
          t.includes('đưa đón') ||
          t.includes('transfer') ||
          t.includes('limousine') ||
          t.includes('maybach') ||
          t.includes('shuttle') ||
          t.includes('taxi')
        );
      });
      setTransportServices(trans.length > 0 ? trans : sList.slice(0, 3));
      if (trans.length > 0) {
        setSelectedService(trans[0]);
      } else if (sList.length > 0) {
        setSelectedService(sList[0]);
      }
    } catch (e) {
      console.warn('Lỗi tải dữ liệu đặt xe:', e);
      Alert.alert('Lỗi', 'Không thể tải danh sách phòng hoặc dịch vụ xe.');
    } finally {
      setLoadingModalData(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchModalData();
    }
  }, [visible]);

  const submitTransportBooking = async () => {
    if (!selectedRoom || !selectedRoom.current_booking) {
      Alert.alert('Chưa chọn phòng', 'Vui lòng chọn phòng có khách đang ở để đặt xe.');
      return;
    }
    if (!selectedService) {
      Alert.alert('Chưa chọn xe', 'Vui lòng chọn loại xe đưa đón.');
      return;
    }
    if (!pickupLocation.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập điểm đón khách.');
      return;
    }
    if (!dropoffLocation.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập điểm đến / trả khách.');
      return;
    }

    setSubmittingBooking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const bookingId = selectedRoom.current_booking.id;
    const fullNote = [
      pickupLocation ? `Đón: ${pickupLocation}` : '',
      dropoffLocation ? `Đến: ${dropoffLocation}` : '',
      flightCode.trim() ? `Chuyến bay: ${flightCode.trim()}` : '',
      pickupTime.trim() ? `Giờ hẹn: ${pickupTime.trim()}` : '',
      passengerCount ? `Số khách: ${passengerCount}` : '',
      note.trim() ? `Ghi chú: ${note.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    try {
      const payload: any = {
        booking: bookingId,
        service_id: selectedService.id,
        quantity: 1,
        note: fullNote,
      };

      if (pickupTime.trim()) {
        const timeMatch = pickupTime.trim().match(/^(\d{1,2})[:hH](\d{2})?$/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            const target = new Date();
            target.setHours(hours, minutes, 0, 0);
            if (target.getTime() < Date.now() - 30 * 60 * 1000) {
              target.setDate(target.getDate() + 1);
            }
            payload.is_scheduled = true;
            payload.request_time = target.toISOString();
          }
        }
      }

      const res = await apiClient.post('/services/requests/', payload);

      if (res.data.success || res.data.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Đặt xe thành công',
          `Đã tạo cuốc xe đưa đón cho Phòng ${selectedRoom.room_number} (${selectedRoom.current_booking.guest_name})!\nTài xế sẽ nhận được thông báo ngay lập tức.`
        );
        onClose();
        onSuccess();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể tạo yêu cầu đặt xe.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmittingBooking(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            !isDark && {
              backgroundColor: '#FFFFFF',
              borderTopColor: '#E2E8F0',
              shadowColor: '#64748B',
            },
          ]}
        >
          {/* Modal Header */}
          <View style={[styles.modalHeaderRow, !isDark && { borderBottomColor: '#F1F5F9' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, !isDark && { color: '#0F172A' }]}>Đặt Xe Đưa Đón</Text>
              <Text style={[styles.modalSubtitle, !isDark && { color: '#64748B' }]}>
                Điều xe đưa đón sân bay, ga tàu hoặc tham quan cho khách
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.modalCloseBtn, !isDark && { backgroundColor: '#F1F5F9' }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#475569'} />
            </TouchableOpacity>
          </View>

          {loadingModalData ? (
            <View style={styles.modalLoadingBox}>
              <ActivityIndicator size="large" color="#F59E0B" />
              <Text style={[styles.modalLoadingText, !isDark && { color: '#64748B' }]}>
                Đang tải danh sách phòng & dịch vụ xe...
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* BƯỚC 1: CHỌN PHÒNG & KHÁCH HÀNG */}
              <Text style={[styles.formSectionLabel, !isDark && { color: '#B45309' }]}>
                1. CHỌN PHÒNG KHÁCH ĐANG Ở (*)
              </Text>
              {occupiedRooms.length === 0 ? (
                <View style={styles.warningBox}>
                  <Ionicons name="alert-circle" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                  <Text style={styles.warningText}>Hiện không có phòng nào đang có khách check-in.</Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.roomSelectScroll}
                  style={{ flexGrow: 0, marginBottom: 14 }}
                >
                  {occupiedRooms.map((r) => {
                    const isSel = selectedRoom?.id === r.id;
                    const bk = r.current_booking;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[
                          styles.roomSelectCard,
                          !isDark && !isSel && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                          isSel && styles.roomSelectCardActive,
                        ]}
                        onPress={() => {
                          setSelectedRoom(r);
                          Haptics.selectionAsync();
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.roomSelectTop}>
                          <Text
                            style={[
                              styles.roomSelectNum,
                              !isDark && !isSel && { color: '#0F172A' },
                              isSel && { color: '#0A0F1D' },
                            ]}
                          >
                            P.{r.room_number}
                          </Text>
                          {bk?.booking_code && (
                            <Text
                              style={[
                                styles.roomSelectCode,
                                isSel && { color: '#0A0F1D', backgroundColor: 'rgba(0,0,0,0.15)' },
                              ]}
                            >
                              #{bk.booking_code}
                            </Text>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.roomSelectGuest,
                            !isDark && !isSel && { color: '#64748B' },
                            isSel && { color: '#0A0F1D', fontWeight: '900' },
                          ]}
                          numberOfLines={1}
                        >
                          {bk?.guest_name || 'Khách lưu trú'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* BƯỚC 2: CHỌN DỊCH VỤ XE / GÓI ĐƯA ĐÓN */}
              <Text style={[styles.formSectionLabel, !isDark && { color: '#B45309' }]}>
                2. CHỌN LOẠI XE / DỊCH VỤ ĐƯA ĐÓN (*)
              </Text>
              <View style={styles.serviceSelectWrapper}>
                {transportServices.map((svc) => {
                  const isSel = selectedService?.id === svc.id;
                  const priceFmt = svc.price ? `${parseInt(svc.price, 10).toLocaleString('vi-VN')} đ` : 'Liên hệ';
                  return (
                    <TouchableOpacity
                      key={svc.id}
                      style={[
                        styles.serviceSelectCard,
                        !isDark && !isSel && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                        isSel && styles.serviceSelectCardActive,
                      ]}
                      onPress={() => {
                        setSelectedService(svc);
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.serviceCarThumbBox}>
                        <Image
                          source={{ uri: getVehicleImage(svc) }}
                          style={styles.serviceCarThumbImg}
                          resizeMode="cover"
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text
                          style={[
                            styles.serviceSelectName,
                            !isDark && { color: '#0F172A' },
                            isSel && { color: isDark ? '#F8FAFC' : '#B45309' },
                          ]}
                          numberOfLines={1}
                        >
                          {svc.name}
                        </Text>
                        <Text style={[styles.serviceSelectPrice, !isDark && { color: '#059669' }]}>{priceFmt}</Text>
                      </View>
                      {isSel && <Ionicons name="checkmark-circle" size={20} color="#F59E0B" />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* BƯỚC 3: ĐIỂM ĐÓN & ĐIỂM ĐẾN */}
              <Text style={[styles.formSectionLabel, !isDark && { color: '#B45309' }]}>3. LỘ TRÌNH ĐÓN TRẢ (*)</Text>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, !isDark && { color: '#475569' }]}>Điểm đón khách:</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' },
                  ]}
                  value={pickupLocation}
                  onChangeText={setPickupLocation}
                  placeholder="VD: Sân bay quốc tế Đà Nẵng, Ga tàu..."
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                />
                <View style={styles.quickTagsRow}>
                  {[
                    { label: 'Sân bay Đà Nẵng', icon: 'airplane-outline' as const },
                    { label: 'Sảnh khách sạn', icon: 'business-outline' as const },
                    { label: 'Ga Đà Nẵng', icon: 'train-outline' as const },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.label}
                      style={[
                        styles.quickTag,
                        !isDark && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
                      ]}
                      onPress={() => {
                        setPickupLocation(item.label);
                        Haptics.selectionAsync();
                      }}
                    >
                      <Ionicons
                        name={item.icon}
                        size={12}
                        color={isDark ? '#94A3B8' : '#475569'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.quickTagText, !isDark && { color: '#475569' }]}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={[styles.inputGroup, { marginTop: 10 }]}>
                <Text style={[styles.inputLabel, !isDark && { color: '#475569' }]}>Điểm đến / Trả khách:</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' },
                  ]}
                  value={dropoffLocation}
                  onChangeText={setDropoffLocation}
                  placeholder="VD: Sảnh khách sạn, Hội An, Bà Nà..."
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                />
                <View style={styles.quickTagsRow}>
                  {[
                    { label: 'Sảnh khách sạn', icon: 'business-outline' as const },
                    { label: 'Sân bay Đà Nẵng', icon: 'airplane-outline' as const },
                    { label: 'Phố cổ Hội An', icon: 'map-outline' as const },
                    { label: 'Bà Nà Hills', icon: 'trail-sign-outline' as const },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.label}
                      style={[
                        styles.quickTag,
                        !isDark && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
                      ]}
                      onPress={() => {
                        setDropoffLocation(item.label);
                        Haptics.selectionAsync();
                      }}
                    >
                      <Ionicons
                        name={item.icon}
                        size={12}
                        color={isDark ? '#94A3B8' : '#475569'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.quickTagText, !isDark && { color: '#475569' }]}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* BƯỚC 4: THỜI GIAN HẸN & CHUYẾN BAY */}
              <Text style={[styles.formSectionLabel, !isDark && { color: '#B45309' }]}>4. THỜI GIAN & CHUYẾN BAY</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, !isDark && { color: '#475569' }]}>Giờ hẹn đón:</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' },
                    ]}
                    value={pickupTime}
                    onChangeText={setPickupTime}
                    placeholder="VD: 14:30 hoặc 18:00"
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, !isDark && { color: '#475569' }]}>Mã chuyến bay (nếu có):</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' },
                    ]}
                    value={flightCode}
                    onChangeText={setFlightCode}
                    placeholder="VD: VN128, VJ512"
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              {/* BƯỚC 5: SỐ LƯỢNG KHÁCH & GHI CHÚ */}
              <Text style={[styles.formSectionLabel, !isDark && { color: '#B45309' }]}>5. SỐ LƯỢNG KHÁCH & GHI CHÚ</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={[styles.inputLabel, { flex: 1, marginBottom: 0 }, !isDark && { color: '#475569' }]}>
                  Số lượng hành khách:
                </Text>
                <View
                  style={[
                    styles.stepperBox,
                    !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      setPassengerCount((p) => Math.max(1, p - 1));
                      Haptics.selectionAsync();
                    }}
                  >
                    <Ionicons name="remove" size={16} color={isDark ? '#F8FAFC' : '#0F172A'} />
                  </TouchableOpacity>
                  <Text style={[styles.stepperValue, !isDark && { color: '#0F172A' }]}>{passengerCount} người</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => {
                      setPassengerCount((p) => Math.min(16, p + 1));
                      Haptics.selectionAsync();
                    }}
                  >
                    <Ionicons name="add" size={16} color={isDark ? '#F8FAFC' : '#0F172A'} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, !isDark && { color: '#475569' }]}>Ghi chú thêm cho tài xế:</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { height: 60, textAlignVertical: 'top' },
                    !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', color: '#0F172A' },
                  ]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="VD: Cần ghế em bé, 3 kiện vali lớn, khách VIP..."
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  multiline
                />
              </View>

              {/* NÚT XÁC NHẬN ĐẶT XE */}
              <TouchableOpacity
                style={[styles.submitBookBtn, submittingBooking && { opacity: 0.7 }]}
                onPress={submitTransportBooking}
                disabled={submittingBooking}
                activeOpacity={0.8}
              >
                {submittingBooking ? (
                  <ActivityIndicator size="small" color="#0A0F1D" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="car-sport" size={18} color="#0A0F1D" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.submitBookBtnText}>
                  {submittingBooking ? 'Đang điều phối xe...' : 'Xác Nhận Đặt Xe Cho Khách'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingHorizontal: 20,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    marginBottom: 14,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  modalLoadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#94A3B8',
  },
  formSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 6,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#F59E0B',
    flex: 1,
  },
  roomSelectScroll: {
    gap: 8,
  },
  roomSelectCard: {
    backgroundColor: '#0A0F1D',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#1F2937',
    minWidth: 120,
  },
  roomSelectCardActive: {
    borderColor: '#F59E0B',
    backgroundColor: '#F59E0B',
  },
  roomSelectTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  roomSelectNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  roomSelectCode: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roomSelectGuest: {
    fontSize: 11,
    color: '#94A3B8',
  },
  serviceSelectWrapper: {
    gap: 8,
    marginBottom: 14,
  },
  serviceSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0F1D',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#1F2937',
  },
  serviceSelectCardActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  serviceCarThumbBox: {
    width: 56,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
  },
  serviceCarThumbImg: {
    width: '100%',
    height: '100%',
  },
  serviceSelectName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  serviceSelectPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#0A0F1D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
  },
  quickTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  quickTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickTagText: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0F1D',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 4,
  },
  stepperBtn: {
    padding: 8,
  },
  stepperValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
    paddingHorizontal: 12,
  },
  submitBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 10,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  submitBookBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.3,
  },
});
