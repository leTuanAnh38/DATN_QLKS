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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { styles } from './styles';
import type { RoomItem } from './types';
import { useAppTheme } from '../../contexts/ThemeContext';

interface MinibarItem {
  id: number;
  name: string;
  price: string;
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
  const [checkNote, setCheckNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (visible && room) {
      setConsumedCounts({});
      setHasDamage(false);
      setDamageDesc('');
      setDamageAmount('');
      setCheckNote('');
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

  const handleQuantityChange = (itemId: number, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConsumedCounts((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [itemId]: next };
    });
  };

  const totalMinibarCost = useMemo(() => {
    let sum = 0;
    minibarItems.forEach((it) => {
      const q = consumedCounts[it.id] || 0;
      sum += q * (parseFloat(it.price) || 0);
    });
    const dmg = hasDamage ? parseFloat(damageAmount || '0') || 0 : 0;
    return sum + dmg;
  }, [minibarItems, consumedCounts, hasDamage, damageAmount]);

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

    try {
      const res = await apiClient.post('/rooms/minibar-checks/', {
        room_id: room.id,
        items: itemsPayload,
        has_damage: hasDamage,
        damage_description: damageDesc,
        damage_amount: parseFloat(damageAmount || '0'),
        note: checkNote,
      });

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
      <View style={styles.modalBackdrop}>
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
            <View>
              <Text style={[styles.modalRoomTitle, !isDark && { color: '#0F172A' }]}>
                Phòng {room.room_number}
              </Text>
              <Text style={[styles.modalRoomSubtitle, !isDark && { color: '#64748B' }]}>
                Kiểm kê Minibar & Hư hại trước Check-out
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.modalCloseCircle, !isDark && { backgroundColor: '#F1F5F9' }]}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#475569'} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
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
                    <Text style={[styles.minibarPrice, !isDark && { color: '#64748B' }]}>
                      {parseInt(item.price).toLocaleString('vi-VN')} đ/lon
                    </Text>
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
              </View>
            )}

            <Text style={[styles.modalSectionLabel, { marginTop: 16 }, !isDark && { color: '#B45309' }]}>
              3. Ghi chú kiểm tra:
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
            <View>
              <Text style={[styles.minibarTotalLabel, !isDark && { color: '#B45309' }]}>
                TỔNG TIỀN PHÁT SINH
              </Text>
              <Text style={[styles.minibarTotalSub, !isDark && { color: '#78350F' }]}>
                Đồng bộ tự động vào bill Lễ tân
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
    </Modal>
  );
};
