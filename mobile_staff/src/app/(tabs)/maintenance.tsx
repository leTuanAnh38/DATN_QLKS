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
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { useFocusPolling } from '../../hooks/use-focus-polling';
import { MAINTENANCE_ISSUE_TYPES } from '../../constants/maintenance';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme } from '../../contexts/ThemeContext';
import NotificationBell from '../../components/NotificationBell';
import { MaintenanceListSkeleton } from '../../components/SkeletonLoader';
import { enqueueOfflineAction } from '../../services/offlineQueue';
import {
  MaintenanceTicket,
  MaintenanceTicketCard,
  CompleteMaintenanceModal,
  CreateMaintenanceModal,
  CancelMaintenanceModal,
} from '../../components/maintenance';

export default function MaintenanceScreen() {
  const { user } = useAuth();
  const { colors, isDark, hotelStars, hotelName } = useAppTheme();
  // Khớp web (RoomManagement.canCompleteMaintenance): chỉ Kỹ thuật & quản lý mới được nghiệm thu phiếu
  const canCompleteMaintenance = Boolean(
    user?.is_superuser || ['technician', 'admin', 'owner', 'manager'].includes(user?.role || '')
  );

  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('fixing');
  const [selectedIssueType, setSelectedIssueType] = useState<string>('all');
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Modals state
  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<MaintenanceTicket | null>(null);

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedCancelTicket, setSelectedCancelTicket] = useState<MaintenanceTicket | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);

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

  // Real-time polling 6 giây đồng bộ hiện trường (chỉ khi tab hiển thị & app ở foreground)
  useFocusPolling(fetchTickets, 6000);

  const onRefresh = () => {
    setRefreshing(true);
    setVisibleCount(15);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchTickets();
  };

  // KPI stats
  const stats = useMemo(() => {
    const total = tickets.length;
    const fixing = tickets.filter((t) => t.status === 'fixing').length;
    const completed = tickets.filter((t) => t.status === 'completed').length;
    const cancelled = tickets.filter((t) => t.status === 'cancelled').length;
    return { total, fixing, completed, cancelled };
  }, [tickets]);

  // Danh sách các tầng thực tế có sự cố phát sinh
  const availableFloors = useMemo(() => {
    const floorsSet = new Set<string>();
    tickets.forEach((t) => {
      const fl = t.room_floor ? String(t.room_floor) : (t.room_number && t.room_number.length >= 3 ? t.room_number.slice(0, -2) : null);
      if (fl) floorsSet.add(fl);
    });
    return Array.from(floorsSet).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [tickets]);

  // Bộ lọc
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      let matchFilter = true;
      if (filterStatus === 'fixing') {
        matchFilter = t.status === 'fixing';
      } else if (filterStatus === 'completed') {
        matchFilter = t.status === 'completed';
      } else if (filterStatus === 'cancelled') {
        matchFilter = t.status === 'cancelled';
      }

      if (selectedIssueType !== 'all') {
        if (t.issue_type !== selectedIssueType) {
          matchFilter = false;
        }
      }

      if (selectedFloor !== 'all') {
        const tFloor = t.room_floor ? String(t.room_floor) : (t.room_number && t.room_number.length >= 3 ? t.room_number.slice(0, -2) : null);
        if (tFloor !== selectedFloor) {
          matchFilter = false;
        }
      }

      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        (t.room_number && t.room_number.toLowerCase().includes(q)) ||
        (t.equipment_name && t.equipment_name.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.ticket_code && t.ticket_code.toLowerCase().includes(q)) ||
        (t.guest_name && t.guest_name.toLowerCase().includes(q));

      return matchFilter && matchSearch;
    });
  }, [tickets, filterStatus, selectedIssueType, selectedFloor, searchQuery]);

  // Infinite Scroll
  const [visibleCount, setVisibleCount] = useState(15);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setVisibleCount(15);
  }, [filterStatus, selectedIssueType, selectedFloor, searchQuery]);

  const displayedTickets = useMemo(() => {
    return filteredTickets.slice(0, visibleCount);
  }, [filteredTickets, visibleCount]);

  const handleLoadMore = () => {
    if (loadingMore || visibleCount >= filteredTickets.length) return;
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 15, filteredTickets.length));
      setLoadingMore(false);
    }, 250);
  };

  const renderFooter = () => {
    if (filteredTickets.length <= 15) return <View style={{ height: 20 }} />;
    if (loadingMore) {
      return (
        <View style={styles.loadMoreFooter}>
          <ActivityIndicator size="small" color="#F59E0B" />
          <Text style={styles.loadMoreText}>Đang tải thêm phiếu sửa chữa cũ...</Text>
        </View>
      );
    }
    if (visibleCount >= filteredTickets.length) {
      return (
        <View style={styles.endOfListFooter}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.endOfListText}>Đã hiển thị toàn bộ {filteredTickets.length} phiếu</Text>
        </View>
      );
    }
    return (
      <View style={styles.endOfListFooter}>
        <Text style={styles.loadMoreHintText}>
          Đang xem {visibleCount}/{filteredTickets.length} phiếu • Cuộn xuống để xem thêm
        </Text>
      </View>
    );
  };

  const openCompleteModal = (ticket: MaintenanceTicket) => {
    if (!canCompleteMaintenance) {
      Alert.alert('Không có quyền', 'Nghiệp vụ nghiệm thu & bàn giao phiếu bảo trì thuộc thẩm quyền của Kỹ thuật viên hoặc Quản lý.');
      return;
    }
    setSelectedTicket(ticket);
    setCompleteModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Kỹ thuật viên nhận xử lý phiếu sự cố (Chống bấm đúp)
  const handleClaimTicket = async (ticket: MaintenanceTicket) => {
    if (actionLoadingId === ticket.id) return;
    setActionLoadingId(ticket.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await apiClient.post(`/rooms/maintenance-tickets/${ticket.id}/claim/`);
      if (res.data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Nhận việc thành công', res.data.message || `Bạn đã nhận phụ trách xử lý phiếu #${ticket.ticket_code}`);
        fetchTickets();
      }
    } catch (err: any) {
      if (!err.response) {
        await enqueueOfflineAction({
          description: `Phiếu #${ticket.ticket_code} (P.${ticket.room_number || 'Khách sạn'}): Nhận sửa chữa`,
          url: `/rooms/maintenance-tickets/${ticket.id}/claim/`,
          method: 'POST',
        });

        // Optimistic UI update
        const myName = user?.first_name || user?.username || 'Tôi';
        setTickets((prev) =>
          prev.map((t) => (t.id === ticket.id ? { ...t, technician_name: myName } : t))
        );

        Alert.alert(
          'Đã lưu ngoại tuyến',
          `Mất kết nối máy chủ! Thao tác nhận phiếu #${ticket.ticket_code} đã được lưu vào Hàng đợi và sẽ tự động gửi khi có mạng trở lại.`
        );
      } else {
        const msg = err.response?.data?.message || 'Không thể nhận xử lý phiếu bảo trì.';
        Alert.alert('Lỗi', msg);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Mở modal Hủy phiếu / Báo sai
  const openCancelModal = (ticket: MaintenanceTicket) => {
    setSelectedCancelTicket(ticket);
    setCancelModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderItem = useCallback(
    ({ item }: { item: MaintenanceTicket }) => (
      <MaintenanceTicketCard
        item={item}
        canCompleteMaintenance={canCompleteMaintenance}
        isTechnicianOrManager={canCompleteMaintenance}
        currentUserId={user?.id}
        isLoading={actionLoadingId === item.id}
        onOpenComplete={openCompleteModal}
        onClaimTicket={handleClaimTicket}
        onOpenCancel={openCancelModal}
      />
    ),
    [canCompleteMaintenance, user?.id, actionLoadingId, openCompleteModal, handleClaimTicket, openCancelModal]
  );

  return (
    <SafeAreaView style={[styles.safeContainer, { backgroundColor: colors.background }]} edges={['top']}>
      {/* 1. Header Khách Sạn */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandSubtitle}>{hotelName.toUpperCase()} • {hotelStars} SAO</Text>
          <Text style={[styles.greetingTitle, { color: colors.text }]}>Kỹ Thuật & Bảo Trì</Text>
        </View>
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.createTicketBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCreateModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={16} color="#0A0F1D" style={{ marginRight: 4 }} />
            <Text style={styles.createTicketBtnText}>Báo hỏng</Text>
          </TouchableOpacity>
          <NotificationBell />
          <TouchableOpacity
            style={[
              styles.refreshCircleBtn,
              !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
            ]}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color="#F59E0B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Dải Bộ Lọc & KPI Cố Định 100% */}
      <View style={styles.fixedFilterBar}>
        {[
          { key: 'fixing', label: 'Cần sửa', count: stats.fixing, color: isDark ? '#F87171' : '#DC2626' },
          { key: 'completed', label: 'Đã xong', count: stats.completed, color: isDark ? '#34D399' : '#059669' },
          { key: 'cancelled', label: 'Đã hủy', count: stats.cancelled, color: isDark ? '#94A3B8' : '#64748B' },
          { key: 'all', label: 'Tất cả', count: stats.total, color: isDark ? '#F8FAFC' : '#0F172A' },
        ].map((item) => {
          const isSelected = filterStatus === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.fixedFilterCard,
                !isDark && {
                  backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.12)' : '#FFFFFF',
                  borderColor: isSelected ? '#F59E0B' : '#E2E8F0',
                  shadowColor: '#64748B',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.06,
                  shadowRadius: 3,
                  elevation: 1,
                },
                isSelected && isDark && styles.fixedFilterCardSelected,
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
                  !isDark && { color: isSelected ? '#D97706' : '#64748B' },
                  isSelected && isDark && styles.fixedFilterLabelSelected,
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. Ô Tìm Kiếm Kết Hợp Nút [Lọc ▾] Gọn Gàng Trên 1 Dòng */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginBottom: 8, gap: 8 }}>
        <View
          style={[
            styles.searchWrapper,
            { flex: 1, marginHorizontal: 0, marginBottom: 0 },
            !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
          ]}
        >
          <Ionicons name="search-outline" size={17} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginLeft: 10 }} />
          <TextInput
            style={[styles.searchInput, !isDark && { color: '#0F172A' }]}
            placeholder="Tìm số phòng, mã phiếu, thiết bị..."
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 6 }}>
              <Ionicons name="close-circle" size={17} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {(() => {
          const activeFilterCount = (selectedFloor !== 'all' ? 1 : 0) + (selectedIssueType !== 'all' ? 1 : 0);
          const isHighlighted = showFilters || activeFilterCount > 0;
          return (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                height: 40,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                backgroundColor: isHighlighted
                  ? 'rgba(245, 158, 11, 0.16)'
                  : (isDark ? '#1E293B' : '#FFFFFF'),
                borderColor: isHighlighted ? '#F59E0B' : (isDark ? '#334155' : '#E2E8F0'),
              }}
              onPress={() => {
                setShowFilters((prev) => !prev);
                Haptics.selectionAsync();
              }}
              activeOpacity={0.75}
            >
              <Ionicons
                name={showFilters ? 'options' : 'options-outline'}
                size={16}
                color={isHighlighted ? '#F59E0B' : (isDark ? '#CBD5E1' : '#475569')}
                style={{ marginRight: 5 }}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: isHighlighted ? (isDark ? '#FBBF24' : '#B45309') : (isDark ? '#CBD5E1' : '#475569'),
                }}
              >
                Lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </Text>
              <Ionicons
                name={showFilters ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={isHighlighted ? '#F59E0B' : (isDark ? '#94A3B8' : '#64748B')}
                style={{ marginLeft: 3 }}
              />
            </TouchableOpacity>
          );
        })()}
      </View>

      {/* Thanh tóm tắt lọc phụ khi đang thu gọn */}
      {!showFilters && (selectedFloor !== 'all' || selectedIssueType !== 'all') && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginHorizontal: 14,
            marginBottom: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 9,
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'wrap', gap: 6 }}>
            <Ionicons name="filter" size={13} color="#F59E0B" />
            <Text style={{ fontSize: 11, color: isDark ? '#FBBF24' : '#B45309', fontWeight: '700' }}>
              Đang lọc:
            </Text>
            {selectedFloor !== 'all' && (
              <View style={{ backgroundColor: isDark ? '#1E293B' : '#FFFFFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 }}>
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: isDark ? '#F8FAFC' : '#0F172A' }}>
                  Tầng {selectedFloor}
                </Text>
              </View>
            )}
            {selectedIssueType !== 'all' && (
              <View style={{ backgroundColor: isDark ? '#1E293B' : '#FFFFFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 }}>
                <Text style={{ fontSize: 10.5, fontWeight: '700', color: isDark ? '#F8FAFC' : '#0F172A' }}>
                  {MAINTENANCE_ISSUE_TYPES.find((x) => x.key === selectedIssueType)?.label || selectedIssueType}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => {
              setSelectedFloor('all');
              setSelectedIssueType('all');
              Haptics.selectionAsync();
            }}
            style={{ paddingHorizontal: 6, paddingVertical: 2 }}
          >
            <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '800' }}>Xóa lọc</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Panel Bộ Lọc Mở Rộng: Tầng & Phân Loại Sự Cố */}
      {showFilters && (
        <View style={{ marginBottom: 4 }}>
          {/* Lọc theo Tầng */}
          {availableFloors.length > 0 && (
            <View style={styles.floorChipsContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.floorChipsScroll}
              >
                <TouchableOpacity
                  style={[
                    styles.floorChip,
                    !isDark && {
                      backgroundColor: selectedFloor === 'all' ? '#0284C7' : '#FFFFFF',
                      borderColor: selectedFloor === 'all' ? '#0284C7' : '#E2E8F0',
                    },
                    selectedFloor === 'all' && isDark && styles.floorChipActive,
                  ]}
                  onPress={() => {
                    setSelectedFloor('all');
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.floorChipText,
                      !isDark && { color: selectedFloor === 'all' ? '#FFFFFF' : '#475569' },
                      selectedFloor === 'all' && styles.floorChipTextActive,
                    ]}
                  >
                    Tất cả tầng ({tickets.length})
                  </Text>
                </TouchableOpacity>

                {availableFloors.map((floor) => {
                  const isSelected = selectedFloor === floor;
                  const count = tickets.filter((t) => {
                    const fl = t.room_floor ? String(t.room_floor) : (t.room_number && t.room_number.length >= 3 ? t.room_number.slice(0, -2) : null);
                    return fl === floor;
                  }).length;
                  return (
                    <TouchableOpacity
                      key={floor}
                      style={[
                        styles.floorChip,
                        !isDark && {
                          backgroundColor: isSelected ? '#0284C7' : '#FFFFFF',
                          borderColor: isSelected ? '#0284C7' : '#E2E8F0',
                        },
                        isSelected && isDark && styles.floorChipActive,
                      ]}
                      onPress={() => {
                        setSelectedFloor(floor);
                        Haptics.selectionAsync();
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="layers-outline"
                        size={12}
                        color={isSelected ? '#FFFFFF' : (isDark ? '#94A3B8' : '#64748B')}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.floorChipText,
                          !isDark && { color: isSelected ? '#FFFFFF' : '#475569' },
                          isSelected && styles.floorChipTextActive,
                        ]}
                      >
                        Tầng {floor} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Lọc theo Phân loại Sự Cố Kỹ Thuật */}
          <View style={styles.issueChipsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.issueChipsScroll}
            >
              <TouchableOpacity
                style={[
                  styles.issueChip,
                  !isDark && {
                    backgroundColor: selectedIssueType === 'all' ? '#F59E0B' : '#FFFFFF',
                    borderColor: selectedIssueType === 'all' ? '#F59E0B' : '#E2E8F0',
                  },
                  selectedIssueType === 'all' && isDark && styles.issueChipActive,
                ]}
                onPress={() => {
                  setSelectedIssueType('all');
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.issueChipText,
                    !isDark && { color: selectedIssueType === 'all' ? '#0A0F1D' : '#475569' },
                    selectedIssueType === 'all' && styles.issueChipTextActive,
                  ]}
                >
                  Tất cả sự cố
                </Text>
              </TouchableOpacity>

              {MAINTENANCE_ISSUE_TYPES.map((it) => {
                const isSelected = selectedIssueType === it.key;
                const count = tickets.filter((t) => t.issue_type === it.key).length;
                return (
                  <TouchableOpacity
                    key={it.key}
                    style={[
                      styles.issueChip,
                      !isDark && {
                        backgroundColor: isSelected ? '#F59E0B' : '#FFFFFF',
                        borderColor: isSelected ? '#F59E0B' : '#E2E8F0',
                      },
                      isSelected && isDark && styles.issueChipActive,
                    ]}
                    onPress={() => {
                      setSelectedIssueType(it.key);
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={it.icon as any}
                      size={13}
                      color={isSelected ? '#0A0F1D' : (isDark ? '#94A3B8' : '#64748B')}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.issueChipText,
                        !isDark && { color: isSelected ? '#0A0F1D' : '#475569' },
                        isSelected && styles.issueChipTextActive,
                      ]}
                    >
                      {it.label} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}

      {/* 4. Danh Sách Phiếu Bảo Trì */}
      {loading ? (
        <MaintenanceListSkeleton />
      ) : filteredTickets.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="construct-outline" size={56} color="#334155" />
          <Text style={[styles.emptyTitle, !isDark && { color: '#0F172A' }]}>
            Không có phiếu bảo trì nào
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery || selectedIssueType !== 'all' || selectedFloor !== 'all'
              ? 'Thử thay đổi từ khóa hoặc bộ lọc để xem kết quả khác.'
              : 'Hiện tại toàn bộ trang thiết bị đang vận hành ổn định.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedTickets}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.2}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
          }
        />
      )}

      {/* Modal Nghiệm thu Hoàn tất sửa chữa */}
      <CompleteMaintenanceModal
        visible={completeModalVisible}
        ticket={selectedTicket}
        isDark={isDark}
        onClose={() => setCompleteModalVisible(false)}
        onSuccess={fetchTickets}
      />

      {/* Modal Báo Hỏng Thiết Bị Mới (Kỹ Thuật Viên Tự Tạo Phiếu) */}
      <CreateMaintenanceModal
        visible={createModalVisible}
        isDark={isDark}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={fetchTickets}
      />

      {/* Modal Hủy Phiếu / Báo Sai Sự Cố */}
      <CancelMaintenanceModal
        visible={cancelModalVisible}
        ticket={selectedCancelTicket}
        isDark={isDark}
        onClose={() => setCancelModalVisible(false)}
        onSuccess={fetchTickets}
      />
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
  createTicketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 14,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  createTicketBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A0F1D',
  },
  fixedFilterBar: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 6,
    marginBottom: 8,
  },
  fixedFilterCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 7,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1F2937',
  },
  fixedFilterCardSelected: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  fixedFilterNumber: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  fixedFilterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 1,
  },
  fixedFilterLabelSelected: {
    color: '#F59E0B',
    fontWeight: '800',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 12.5,
    paddingHorizontal: 8,
  },
  floorChipsContainer: {
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  floorChipsScroll: {
    gap: 6,
    paddingRight: 14,
  },
  floorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  floorChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  floorChipText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  floorChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  issueChipsContainer: {
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  issueChipsScroll: {
    gap: 6,
    paddingRight: 14,
  },
  issueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  issueChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  issueChipText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  issueChipTextActive: {
    color: '#0A0F1D',
    fontWeight: '800',
  },
  listContainer: {
    paddingHorizontal: 14,
    paddingBottom: 28,
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
  loadMoreFooter: {
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadMoreText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  endOfListFooter: {
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endOfListText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  loadMoreHintText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
});
