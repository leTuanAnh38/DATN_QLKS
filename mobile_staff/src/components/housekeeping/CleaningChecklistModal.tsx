import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../../contexts/ThemeContext';
import type { RoomItem } from './types';

export const CLEANING_SOP_ITEMS = [
  {
    key: 'bedding',
    label: 'Thay ga trải giường, vỏ gối & khăn tắm sạch',
    icon: 'bed-outline' as const,
  },
  {
    key: 'bathroom',
    label: 'Vệ sinh phòng tắm, sàn nhà & khử mùi phòng',
    icon: 'water-outline' as const,
  },
  {
    key: 'amenities',
    label: 'Bổ sung nước suối, trà/cà phê & đồ dùng tiêu hao',
    icon: 'cafe-outline' as const,
  },
  {
    key: 'equipment',
    label: 'Kiểm tra thiết bị (điều hòa, tivi, đèn, khóa cửa)',
    icon: 'shield-checkmark-outline' as const,
  },
];

export interface CleaningChecklistModalProps {
  visible: boolean;
  room: RoomItem | null;
  mode: 'checkout_clean' | 'stayover_clean' | 'makeup';
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const CleaningChecklistModal: React.FC<CleaningChecklistModalProps> = ({
  visible,
  room,
  mode,
  submitting,
  onClose,
  onConfirm,
}) => {
  const { isDark } = useAppTheme();
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setCheckedKeys([]);
    }
  }, [visible, room?.id]);

  if (!room) return null;

  const allChecked = checkedKeys.length === CLEANING_SOP_ITEMS.length;

  const toggleItem = (key: string) => {
    Haptics.selectionAsync();
    setCheckedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (allChecked) {
      setCheckedKeys([]);
    } else {
      setCheckedKeys(CLEANING_SOP_ITEMS.map((i) => i.key));
    }
  };

  const isGuestStayover = mode === 'stayover_clean' || mode === 'makeup';
  const titleText = isGuestStayover
    ? `Hoàn tất dọn P.${room.room_number}`
    : `Nghiệm thu phòng sạch P.${room.room_number}`;
  const subtitleText = isGuestStayover
    ? `Khách đang lưu trú (${room.current_booking?.guest_name || 'Khách'}) • Giữ trạng thái Có khách`
    : 'Kiểm tra đủ 4 tiêu chuẩn SOP trước khi chuyển sang Sẵn sàng đón khách';
  const confirmLabel = isGuestStayover ? 'Xác nhận đã dọn xong' : 'Xác nhận phòng sạch';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={submitting ? undefined : onClose}
        />
        <View
          style={[
            styles.card,
            !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, !isDark && { borderBottomColor: '#F1F5F9' }]}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles" size={17} color="#10B981" />
                <Text style={[styles.title, !isDark && { color: '#0F172A' }]} numberOfLines={1}>
                  {titleText}
                </Text>
              </View>
              <Text style={[styles.subtitle, !isDark && { color: '#64748B' }]}>
                {subtitleText}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.closeBtn, !isDark && { backgroundColor: '#F1F5F9' }]}
              onPress={onClose}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 12, paddingBottom: 6 }}>
            {/* Quick select all bar */}
            <View style={styles.progressRow}>
              <Text style={[styles.progressText, !isDark && { color: '#475569' }]}>
                Đã kiểm tra:{' '}
                <Text style={{ color: allChecked ? '#10B981' : '#F59E0B', fontWeight: '900' }}>
                  {checkedKeys.length}/{CLEANING_SOP_ITEMS.length}
                </Text>{' '}
                hạng mục
              </Text>
              <TouchableOpacity
                style={[
                  styles.selectAllBtn,
                  allChecked && styles.selectAllBtnActive,
                  !isDark && !allChecked && { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
                ]}
                onPress={toggleAll}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={allChecked ? 'checkbox' : 'checkmark-done-outline'}
                  size={13}
                  color={allChecked ? '#059669' : '#D97706'}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.selectAllText,
                    { color: allChecked ? '#059669' : '#D97706' },
                  ]}
                >
                  {allChecked ? 'Bỏ chọn hết' : 'Tick nhanh tất cả'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 4 SOP checklist items */}
            {CLEANING_SOP_ITEMS.map((item) => {
              const checked = checkedKeys.includes(item.key);
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.checkRow,
                    !isDark && !checked && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                    checked && (isDark ? styles.checkRowCheckedDark : styles.checkRowCheckedLight),
                  ]}
                  onPress={() => toggleItem(item.key)}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.checkboxBox,
                      !isDark && !checked && { borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' },
                      checked && styles.checkboxBoxChecked,
                    ]}
                  >
                    {checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Ionicons
                    name={item.icon}
                    size={16}
                    color={checked ? '#10B981' : isDark ? '#94A3B8' : '#64748B'}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.checkLabel,
                      !isDark && { color: '#334155' },
                      checked && { color: isDark ? '#ECFDF5' : '#065F46', fontWeight: '700' },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Footer Actions */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, !isDark && { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }]}
                onPress={onClose}
                disabled={submitting}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelBtnText, !isDark && { color: '#475569' }]}>Để sau</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  { backgroundColor: isGuestStayover ? '#0284C7' : '#10B981' },
                  (!allChecked || submitting) && { opacity: 0.45 },
                ]}
                onPress={onConfirm}
                disabled={!allChecked || submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    flex: 1,
  },
  subtitle: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 16,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  selectAllBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  selectAllText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0F172A',
    marginBottom: 8,
  },
  checkRowCheckedDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  checkRowCheckedLight: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  checkboxBox: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxBoxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkLabel: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#CBD5E1',
    lineHeight: 17,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  confirmBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

