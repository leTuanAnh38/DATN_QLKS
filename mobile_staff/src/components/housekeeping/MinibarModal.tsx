import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
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
import { styles } from './styles';
import type { RoomItem } from './types';
import { useAppTheme } from '../../contexts/ThemeContext';

interface MinibarItem {
  id: number;
  name: string;
  price: string;
  standard_quantity?: number;
}

interface MinibarModalProps {
  visible: boolean;
  room: RoomItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const MinibarModal: React.FC<MinibarModalProps> = ({
  visible,
  room,
  onClose,
  onSuccess,
}) => {
  const { isDark } = useAppTheme();
  const [minibarItems, setMinibarItems] = useState<MinibarItem[]>([]);
  const [consumedCounts, setConsumedCounts] = useState<Record<number, number>>({});
  const [hasDamage, setHasDamage] = useState(false);
  const [damageDesc, setDamageDesc] = useState('');
  const [damageAmount, setDamageAmount] = useState('');
  const [requiresMaintenance, setRequiresMaintenance] = useState(false);
  const [damageImage, setDamageImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [checkNote, setCheckNote] = useState('');
  const [isRestocked, setIsRestocked] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (visible && room) {
      const latestCheck = room.latest_minibar_check;
      const isExistingCompleted = latestCheck?.status === 'completed';
      const initialCounts: Record<number, number> = {};
      if (isExistingCompleted && Array.isArray(latestCheck?.items_consumed)) {
        latestCheck.items_consumed.forEach((it: any) => {
          const id = Number(it.item_id || it.id);
          const qty = Number(it.quantity || 0);
          if (id && qty > 0) initialCounts[id] = qty;
        });
      }
      setConsumedCounts(initialCounts);
      setHasDamage(Boolean(isExistingCompleted && latestCheck?.has_damage));
      setDamageDesc(isExistingCompleted && latestCheck?.damage_description ? String(latestCheck.damage_description) : '');
      setDamageAmount(
        isExistingCompleted && latestCheck?.damage_amount && Number(latestCheck.damage_amount) > 0
          ? String(Math.round(Number(latestCheck.damage_amount)))
          : ''
      );
      setRequiresMaintenance(false);
      setDamageImage(null);
      setCheckNote('');
      setIsRestocked(true);
      fetchMinibarItems();
    }
  }, [visible, room?.id]);

  const fetchMinibarItems = async () => {
    setLoadingItems(true);
    try {
      const res = await apiClient.get('/rooms/minibar-items/?active_only=true');
      const list = res.data?.results || res.data?.items || res.data?.data || res.data || [];
      setMinibarItems(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn('Lỗi lấy minibar items:', e);
    } finally {
      setLoadingItems(false);
    }
  };

  const takeDamagePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Cần cấp quyền', 'Vui lòng cấp quyền Camera để chụp ảnh minh chứng hư hại.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.6,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setDamageImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở camera:', e);
    }
  };

  const pickDamagePhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Cần cấp quyền', 'Vui lòng cấp quyền Thư viện ảnh để chọn ảnh minh chứng.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.6,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setDamageImage(result.assets[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Lỗi mở thư viện ảnh:', e);
    }
  };

  const handleQuantityChange = (itemId: number, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConsumedCounts((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [itemId]: next };
    });
  };

  const parsedDamageAmount = useMemo(() => {
    if (!hasDamage) return 0;
    const cleaned = String(damageAmount || '0').replace(/[.,\s]/g, '');
    return parseFloat(cleaned) || 0;
  }, [hasDamage, damageAmount]);

  const totalMinibarCost = useMemo(() => {
    let sum = 0;
    minibarItems.forEach((it) => {
      const q = consumedCounts[it.id] || 0;
      sum += q * (parseFloat(it.price) || 0);
    });
    return sum + parsedDamageAmount;
  }, [minibarItems, consumedCounts, parsedDamageAmount]);

  const totalRestockCount = useMemo(() => {
    return Object.values(consumedCounts).reduce((sum, count) => sum + count, 0);
  }, [consumedCounts]);

  const handleSubmit = async () => {
    if (!room) return;
    setSubmitting(true);

    const itemsPayload = minibarItems
      .filter((it) => (consumedCounts[it.id] || 0) > 0)
      .map((it) => ({
        id: it.id,
        name: it.name,
        price: it.price,
        quantity: consumedCounts[it.id],
      }));

    // Gắn nhãn trạng thái bù tủ lạnh vào phiếu kiểm tra để Lễ tân & Tổ trưởng buồng phòng đối soát
    const restockNote = totalRestockCount > 0
      ? (isRestocked
          ? `[ĐÃ BÙ ${totalRestockCount} MÓN VÀO TỦ LẠNH]`
          : `[CHƯA BÙ TỦ LẠNH - CẦN BỔ SUNG ${totalRestockCount} MÓN]`)
      : '';
    const finalNote = [checkNote.trim(), restockNote].filter(Boolean).join(' • ');

    // Xác định chính xác booking_id và check_id đang hoạt động của phòng
    const activeBookingId =
      room.current_booking?.id ||
      room.recent_booking?.id ||
      room.latest_minibar_check?.booking_id ||
      room.latest_minibar_check?.booking ||
      undefined;
    const activeCheckId = room.latest_minibar_check?.id || undefined;

    try {
      let res;
      if (hasDamage && damageImage) {
        const formData = new FormData();
        formData.append('room_id', String(room.id));
        if (activeBookingId) formData.append('booking_id', String(activeBookingId));
        if (activeCheckId) formData.append('check_id', String(activeCheckId));
        formData.append('items', JSON.stringify(itemsPayload));
        formData.append('has_damage', String(hasDamage));
        formData.append('damage_description', damageDesc.trim());
        formData.append('damage_amount', String(parsedDamageAmount));
        formData.append('requires_maintenance', String(Boolean(hasDamage && requiresMaintenance)));
        formData.append('is_restocked', String(isRestocked));
        formData.append('note', finalNote);

        const uri = damageImage.uri;
        const filename = uri.split('/').pop() || 'damage_evidence.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        // @ts-ignore
        formData.append('image_before', {
          uri,
          name: filename,
          type,
        });
        res = await apiClient.post('/rooms/minibar-checks/', formData);
      } else {
        res = await apiClient.post('/rooms/minibar-checks/', {
          room_id: room.id,
          booking_id: activeBookingId,
          check_id: activeCheckId,
          items: itemsPayload,
          has_damage: hasDamage,
          damage_description: damageDesc.trim(),
          damage_amount: parsedDamageAmount,
          requires_maintenance: Boolean(hasDamage && requiresMaintenance),
          is_restocked: isRestocked,
          note: finalNote,
        });
      }

      if (res.data?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Kiểm kê thành công', res.data.message || 'Đã đồng bộ vào hóa đơn Lễ tân!');
        onClose();
        onSuccess();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể lưu phiếu kiểm phòng.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!room) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={Keyboard.dismiss}
          />
          <View
            style={[
              styles.modalCard,
              !isDark && {
                backgroundColor: '#FFFFFF',
                borderTopColor: '#E2E8F0',
                shadowColor: '#64748B',
              },
            ]}
          >
            <View style={styles.modalTopBar}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.modalRoomTitle, !isDark && { color: '#0F172A' }]}>
                  Phòng {room.room_number}
                </Text>
                <Text style={[styles.modalRoomSubtitle, !isDark && { color: '#64748B' }]} numberOfLines={1}>
                  {(room.current_booking || room.recent_booking)
                    ? `Khách: ${(room.current_booking || room.recent_booking)?.guest_name} (#${(room.current_booking || room.recent_booking)?.booking_code})`
                    : 'Kiểm kê Minibar & Hư hại trước Check-out'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.modalCloseCircle, !isDark && { backgroundColor: '#F1F5F9' }]}
                onPress={onClose}
              >
                <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#475569'} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: Platform.OS === 'ios' ? 320 : 360 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.modalSectionLabel, !isDark && { color: '#B45309' }]}>
                1. Danh mục Minibar đã dùng:
              </Text>
              {loadingItems ? (
                <ActivityIndicator color="#F59E0B" style={{ marginVertical: 12 }} />
              ) : minibarItems.length === 0 ? (
                <Text style={{ color: isDark ? '#64748B' : '#94A3B8', fontSize: 13, marginVertical: 8 }}>
                  Không có danh mục minibar khả dụng.
                </Text>
              ) : (
                minibarItems.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.minibarItemRow,
                      !isDark && {
                        backgroundColor: '#F8FAFC',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                      },
                    ]}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.minibarName, !isDark && { color: '#0F172A' }]}>
                        {item.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        <Text style={[styles.minibarPrice, !isDark && { color: '#64748B' }, { marginTop: 0 }]}>
                          {parseInt(item.price).toLocaleString('vi-VN')} đ/lon
                        </Text>
                        <View style={[styles.minibarParBadge, !isDark && { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]}>
                          <Ionicons name="cube-outline" size={10} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 3 }} />
                          <Text style={[styles.minibarParText, !isDark && { color: '#475569' }]}>
                            Định mức: {item.standard_quantity || 2}
                          </Text>
                        </View>
                        {(consumedCounts[item.id] || 0) > 0 && (
                          <View style={[styles.minibarRestockBadge, !isDark && { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                            <Ionicons name="flash" size={10} color="#D97706" style={{ marginRight: 2 }} />
                            <Text style={[styles.minibarRestockText, !isDark && { color: '#B45309' }]}>
                              Cần bù tủ: {consumedCounts[item.id]}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View
                      style={[
                        styles.stepperContainer,
                        !isDark && { backgroundColor: '#FFFFFF', borderColor: '#CBD5E1' },
                      ]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.stepperBtn,
                          !isDark && { backgroundColor: '#F1F5F9' },
                        ]}
                        onPress={() => handleQuantityChange(item.id, -1)}
                      >
                        <Ionicons name="remove" size={16} color={isDark ? '#FFF' : '#0F172A'} />
                      </TouchableOpacity>
                      <Text style={[styles.stepperValue, !isDark && { color: '#0F172A' }]}>
                        {consumedCounts[item.id] || 0}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.stepperBtn,
                          !isDark && { backgroundColor: '#F1F5F9' },
                        ]}
                        onPress={() => handleQuantityChange(item.id, 1)}
                      >
                        <Ionicons name="add" size={16} color={isDark ? '#FFF' : '#0F172A'} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}

              <Text style={[styles.modalSectionLabel, { marginTop: 16 }, !isDark && { color: '#B45309' }]}>
                2. Hư hại tài sản phòng (nếu có):
              </Text>
              <TouchableOpacity
                style={styles.damageCheckboxRow}
                onPress={() => setHasDamage(!hasDamage)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={hasDamage ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={hasDamage ? '#EF4444' : isDark ? '#64748B' : '#94A3B8'}
                />
                <Text style={[styles.damageCheckboxText, !isDark && { color: '#1E293B' }]}>
                  Có vỡ đồ / hư hại cần bồi thường
                </Text>
              </TouchableOpacity>

              {hasDamage && (
                <View style={{ marginTop: 8 }}>
                  <TextInput
                    style={[
                      styles.modalTextInput,
                      !isDark && {
                        backgroundColor: '#F8FAFC',
                        borderColor: '#CBD5E1',
                        color: '#0F172A',
                      },
                    ]}
                    placeholder="Mô tả hư hại (VD: Vỡ 1 cốc thủy tinh, rách khăn tắm...)"
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    value={damageDesc}
                    onChangeText={setDamageDesc}
                  />
                  <TextInput
                    style={[
                      styles.modalTextInput,
                      !isDark && {
                        backgroundColor: '#F8FAFC',
                        borderColor: '#CBD5E1',
                        color: '#0F172A',
                      },
                    ]}
                    placeholder="Số tiền đền bù (VNĐ) - VD: 50000"
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    keyboardType="numeric"
                    value={damageAmount}
                    onChangeText={setDamageAmount}
                  />

                  {/* Đính kèm ảnh minh chứng hiện trường hư hại */}
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#CBD5E1' : '#334155', marginBottom: 6 }}>
                      Ảnh minh chứng hiện trường (Đối chiếu tại quầy Lễ tân):
                    </Text>
                    {damageImage ? (
                      <View style={{ position: 'relative', alignSelf: 'flex-start', marginBottom: 8 }}>
                        <Image
                          source={{ uri: damageImage.uri }}
                          style={{ width: 110, height: 82, borderRadius: 10, borderWidth: 1, borderColor: '#EF4444' }}
                        />
                        <TouchableOpacity
                          style={{
                            position: 'absolute',
                            top: -6,
                            right: -6,
                            backgroundColor: '#EF4444',
                            borderRadius: 12,
                            width: 22,
                            height: 22,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onPress={() => setDamageImage(null)}
                        >
                          <Ionicons name="close" size={14} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                            borderWidth: 1,
                            borderColor: isDark ? '#334155' : '#CBD5E1',
                            borderRadius: 10,
                            paddingVertical: 9,
                          }}
                          onPress={takeDamagePhoto}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="camera" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#F8FAFC' : '#0F172A' }}>
                            Chụp ảnh
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                            borderWidth: 1,
                            borderColor: isDark ? '#334155' : '#CBD5E1',
                            borderRadius: 10,
                            paddingVertical: 9,
                          }}
                          onPress={pickDamagePhoto}
                          activeOpacity={0.75}
                        >
                          <Ionicons name="images-outline" size={16} color="#38BDF8" style={{ marginRight: 6 }} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#F8FAFC' : '#0F172A' }}>
                            Thư viện
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Phân tách Hư hại đồ rời vs Hỏng thiết bị kỹ thuật cố định */}
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: requiresMaintenance
                        ? (isDark ? 'rgba(239, 68, 68, 0.14)' : '#FEF2F2')
                        : (isDark ? '#1E293B' : '#F8FAFC'),
                      borderColor: requiresMaintenance ? '#EF4444' : (isDark ? '#334155' : '#CBD5E1'),
                      borderWidth: 1.2,
                      borderRadius: 10,
                      padding: 10,
                      marginTop: 4,
                    }}
                    onPress={() => {
                      setRequiresMaintenance((prev) => !prev);
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={requiresMaintenance ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={requiresMaintenance ? '#EF4444' : (isDark ? '#94A3B8' : '#64748B')}
                    />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: '800',
                          color: requiresMaintenance ? '#EF4444' : (isDark ? '#E2E8F0' : '#1E293B'),
                        }}
                      >
                        Cần Kỹ thuật viên sửa chữa (Thiết bị cố định)
                      </Text>
                      <Text style={{ fontSize: 11, color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                        {requiresMaintenance
                          ? 'Sẽ tự động lập phiếu Bảo trì & khóa phòng chờ Kỹ thuật sửa.'
                          : 'Chỉ tính phí đền bù đồ rời (ly, khăn...), Buồng phòng tự thay mới.'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {/* 3. Xác nhận Bù đồ tủ lạnh Minibar (Hotel SOP Restock Verification) */}
              {totalRestockCount > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={[styles.modalSectionLabel, !isDark && { color: '#B45309' }]}>
                    3. Xác nhận bù tủ lạnh ({totalRestockCount} món):
                  </Text>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isRestocked
                        ? (isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5')
                        : (isDark ? 'rgba(239, 68, 68, 0.14)' : '#FEF2F2'),
                      borderColor: isRestocked ? '#10B981' : '#EF4444',
                      borderWidth: 1.5,
                      borderRadius: 12,
                      padding: 12,
                      marginTop: 6,
                    }}
                    onPress={() => {
                      setIsRestocked((prev) => !prev);
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={isRestocked ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={isRestocked ? '#10B981' : '#EF4444'}
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '800',
                          color: isRestocked
                            ? (isDark ? '#34D399' : '#059669')
                            : (isDark ? '#F87171' : '#DC2626'),
                        }}
                      >
                        {isRestocked
                          ? `Đã bù đủ ${totalRestockCount} đồ vào tủ lạnh phòng`
                          : `Chưa bù đồ tủ lạnh (Cần xe Trolley bổ sung gấp)`}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: isDark ? '#94A3B8' : '#64748B',
                          marginTop: 2,
                        }}
                      >
                        {isRestocked
                          ? 'Đã lấy đồ từ xe đẩy bù đầy đủ theo định mức minibar.'
                          : 'Xe đẩy hết hàng, hệ thống sẽ lưu cảnh báo để ca sau bổ sung.'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={[styles.modalSectionLabel, { marginTop: 16 }, !isDark && { color: '#B45309' }]}>
                {totalRestockCount > 0 ? '4. Ghi chú kiểm tra:' : '3. Ghi chú kiểm tra:'}
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
                placeholder="Ghi chú thêm cho lễ tân (nếu có)..."
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                multiline
                value={checkNote}
                onChangeText={setCheckNote}
              />
            </ScrollView>

            {/* Thanh tổng tiền tạm tính Minibar & Bồi thường */}
            <View
              style={[
                styles.minibarTotalBar,
                !isDark && {
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  borderColor: 'rgba(245, 158, 11, 0.35)',
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.minibarTotalLabel, !isDark && { color: '#B45309' }]}>
                  TỔNG TIỀN PHÁT SINH
                </Text>
                <Text style={[styles.minibarTotalSub, !isDark && { color: '#78350F' }]}>
                  {totalRestockCount > 0
                    ? isRestocked
                      ? `Cần bù ${totalRestockCount} đồ (ĐÃ BÙ ĐỦ TỦ LẠNH) • Đồng bộ bill`
                      : `Chưa bù ${totalRestockCount} đồ tủ lạnh • Cần bổ sung • Đồng bộ bill`
                    : 'Đồng bộ tự động vào bill Lễ tân'}
                </Text>
              </View>
              <Text style={[styles.minibarTotalValue, !isDark && { color: '#D97706' }]}>
                {totalMinibarCost.toLocaleString('vi-VN')} đ
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.modalConfirmBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#0A0F1D" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="receipt-outline" size={18} color="#0A0F1D" style={{ marginRight: 6 }} />
                  <Text style={styles.modalConfirmBtnText}>LƯU & ĐỒNG BỘ HÓA ĐƠN</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
