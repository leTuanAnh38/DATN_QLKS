import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../../components/NotificationBell';

interface MaintenanceTicket {
  id: number;
  ticket_code: string;
  room_number: string;
  equipment_name: string;
  issue_type: string;
  description: string;
  status: string;
  status_display: string;
  parts_replaced: string;
  cost: number;
  technician_name: string;
  start_date: string;
}

export default function MaintenanceScreen() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('fixing');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal hoàn tất sửa chữa
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<MaintenanceTicket | null>(null);
  const [partsReplaced, setPartsReplaced] = useState('');
  const [cost, setCost] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await apiClient.get('/rooms/maintenance-tickets/');
      const list = res.data.results || res.data.tickets || res.data.data || res.data || [];
      setTickets(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.warn('Lỗi tải phiếu bảo trì:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchTickets();
  }, [fetchTickets]);

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchTickets();
  };

  // KPI stats
  const stats = useMemo(() => {
    const total = tickets.length;
    const fixing = tickets.filter((t) => t.status === 'fixing').length;
    const completed = tickets.filter((t) => t.status === 'completed').length;
    return { total, fixing, completed };
  }, [tickets]);

  // Bộ lọc
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      let matchFilter = true;
      if (filterStatus === 'fixing') {
        matchFilter = t.status === 'fixing';
      } else if (filterStatus === 'completed') {
        matchFilter = t.status === 'completed';
      }

      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        (t.room_number && t.room_number.toLowerCase().includes(q)) ||
        (t.equipment_name && t.equipment_name.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.ticket_code && t.ticket_code.toLowerCase().includes(q));

      return matchFilter && matchSearch;
    });
  }, [tickets, filterStatus, searchQuery]);

  const openCompleteModal = (ticket: MaintenanceTicket) => {
    setSelectedTicket(ticket);
    setPartsReplaced(ticket.parts_replaced || '');
    setCost(ticket.cost ? String(ticket.cost) : '0');
    setNote('');
    setCompleteModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleComplete = async () => {
    if (!selectedTicket) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await apiClient.post(`/rooms/maintenance-tickets/${selectedTicket.id}/complete/`, {
        parts_replaced: partsReplaced,
        cost: parseInt(cost || '0', 10),
        note: note,
      });

      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Đã hoàn tất sửa chữa',
          res.data.message || 'Phòng đã được chuyển sang Buồng phòng dọn dẹp để sẵn sàng đón khách!'
        );
        setCompleteModalVisible(false);
        fetchTickets();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể hoàn thành phiếu bảo trì.';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: MaintenanceTicket }) => {
    const isFixing = item.status === 'fixing';

    return (
      <View style={[styles.card, isFixing && styles.cardFixing]}>
        {/* Header phiếu */}
        <View style={styles.cardHeader}>
          <View style={styles.roomTag}>
            <Ionicons name="bed" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
            <Text style={styles.roomTagText}>Phòng {item.room_number}</Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isFixing ? 'rgba(239, 68, 68, 0.14)' : 'rgba(16, 185, 129, 0.12)',
                borderColor: isFixing ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)',
              },
            ]}
          >
            <Ionicons
              name={isFixing ? 'alert-circle' : 'checkmark-circle'}
              size={12}
              color={isFixing ? '#F87171' : '#34D399'}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.statusBadgeText,
                { color: isFixing ? '#F87171' : '#34D399' },
              ]}
            >
              {isFixing ? 'Sửa chữa gấp' : 'Đã nghiệm thu'}
            </Text>
          </View>
        </View>

        {/* Thiết bị sự cố */}
        <View style={styles.equipmentRow}>
          <View style={[styles.equipmentIconBox, isFixing && styles.equipmentIconBoxAlert]}>
            <Ionicons name="construct" size={20} color={isFixing ? '#EF4444' : '#10B981'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.equipmentName}>{item.equipment_name || 'Thiết bị buồng phòng'}</Text>
            <Text style={styles.ticketCode}>Mã phiếu: #{item.ticket_code}</Text>
          </View>
        </View>

        {/* Mô tả sự cố */}
        {item.description ? (
          <View style={styles.descBox}>
            <Ionicons name="warning-outline" size={15} color="#F59E0B" style={{ marginRight: 6 }} />
            <Text style={styles.descText}>Hiện tượng: {item.description}</Text>
          </View>
        ) : null}

        {/* Vật tư đã thay */}
        {item.parts_replaced ? (
          <View style={styles.partsRow}>
            <Text style={styles.partsLabel}>Linh kiện:</Text>
            <Text style={styles.partsValue}>{item.parts_replaced}</Text>
          </View>
        ) : null}

        {/* Footer: Kỹ thuật viên & Nút hoàn thành */}
        <View style={styles.cardFooter}>
          <Text style={styles.techText}>
            Phụ trách: {item.technician_name || 'Đội kỹ thuật'}
          </Text>

          {isFixing ? (
            <TouchableOpacity
              style={styles.completeBtn}
              onPress={() => openCompleteModal(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done" size={16} color="#0A0F1D" style={{ marginRight: 6 }} />
              <Text style={styles.completeBtnText}>NGHIỆM THU & BÀN GIAO</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.doneTag}>
              <Ionicons name="shield-checkmark" size={14} color="#34D399" style={{ marginRight: 4 }} />
              <Text style={styles.doneTagText}>Đã bàn giao buồng phòng</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      {/* 1. Header Khách Sạn */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandSubtitle}>TA LUXURY HOTEL</Text>
          <Text style={styles.greetingTitle}>Kỹ Thuật & Bảo Trì 🛠️</Text>
        </View>
        <View style={styles.headerRightActions}>
          <NotificationBell />
          <TouchableOpacity style={styles.refreshCircleBtn} onPress={onRefresh} activeOpacity={0.7}>
            <Ionicons name="refresh" size={18} color="#F59E0B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Dải Bộ Lọc & KPI Cố Định 100% (Không bị trôi trượt khi lướt) */}
      <View style={styles.fixedFilterBar}>
        {[
          { key: 'fixing', label: 'Cần sửa gấp', count: stats.fixing, color: '#F87171' },
          { key: 'completed', label: 'Đã xong', count: stats.completed, color: '#34D399' },
          { key: 'all', label: 'Tất cả', count: stats.total, color: '#F8FAFC' },
        ].map((item) => {
          const isSelected = filterStatus === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.fixedFilterCard,
                isSelected && styles.fixedFilterCardSelected,
              ]}
              onPress={() => {
                setFilterStatus(item.key);
                Haptics.selectionAsync();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.fixedFilterNumber, { color: isSelected ? '#F59E0B' : item.color }]}>
                {item.count}
              </Text>
              <Text
                style={[
                  styles.fixedFilterLabel,
                  isSelected && styles.fixedFilterLabelSelected,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. Ô Tìm Kiếm Nhanh */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo số phòng, mã phiếu, tên thiết bị..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 8 }}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 5. Danh Sách Phiếu Sửa Chữa */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingMessage}>Đang tải phiếu kỹ thuật...</Text>
        </View>
      ) : filteredTickets.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="construct-outline" size={56} color="#334155" />
          <Text style={styles.emptyTitle}>Không có sự cố nào</Text>
          <Text style={styles.emptySubtitle}>
            Tất cả thiết bị phòng khách sạn đang hoạt động ổn định.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
          }
        />
      )}

      {/* Modal Nghiệm thu Hoàn tất sửa chữa */}
      <Modal visible={completeModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Nghiệm Thu Phòng {selectedTicket?.room_number}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Thiết bị: {selectedTicket?.equipment_name}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setCompleteModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Linh kiện / Vật tư đã thay:</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="VD: Thay tụ quạt Daikin, vòi sen tắm..."
                placeholderTextColor="#64748B"
                value={partsReplaced}
                onChangeText={setPartsReplaced}
              />

              <Text style={styles.inputLabel}>Chi phí vật tư phát sinh (VNĐ):</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                value={cost}
                onChangeText={setCost}
              />

              <Text style={styles.inputLabel}>Ghi chú kiểm tra bàn giao:</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }]}
                placeholder="Thiết bị hoạt động êm, mát, sạch sẽ..."
                placeholderTextColor="#64748B"
                multiline
                value={note}
                onChangeText={setNote}
              />

              <View style={styles.alertNoteBox}>
                <Ionicons name="information-circle" size={18} color="#F59E0B" style={{ marginRight: 8 }} />
                <Text style={styles.alertNoteText}>
                  Sau khi xác nhận, Phòng {selectedTicket?.room_number} sẽ tự động chuyển sang trạng thái "Đang dọn dẹp" để bộ phận Buồng phòng vào lau dọn sẵn sàng đón khách.
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
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0A0F1D',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 1.5,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 2,
  },
  refreshCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fixedFilterBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 10,
  },
  fixedFilterCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1F2937',
  },
  fixedFilterCardSelected: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  fixedFilterNumber: {
    fontSize: 16,
    fontWeight: '900',
  },
  fixedFilterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
  },
  fixedFilterLabelSelected: {
    color: '#F59E0B',
    fontWeight: '800',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    marginHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    height: 42,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    paddingHorizontal: 10,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingMessage: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 13,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardFixing: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: '#18121A',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  roomTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  roomTagText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  equipmentIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  equipmentIconBoxAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  equipmentName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  ticketCode: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  descBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  descText: {
    fontSize: 12,
    color: '#FCA5A5',
    flex: 1,
  },
  partsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  partsLabel: {
    fontSize: 12,
    color: '#64748B',
    marginRight: 6,
  },
  partsValue: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'column',
    marginTop: 4,
    gap: 8,
  },
  techText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    height: 42,
    borderRadius: 12,
  },
  completeBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0F1D',
    letterSpacing: 0.5,
  },
  doneTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  doneTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#34D399',
  },
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
