import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../api/client';

interface BookingManagementModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectGuest?: (guestId: number) => void;
}

export default function BookingManagementModal({
  visible,
  onClose,
  onSelectGuest,
}: BookingManagementModalProps) {
  const [activeMainTab, setActiveMainTab] = useState<'list' | 'timeline'>('list');

  // TAB 1: LIST STATE
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // TAB 2: TIMELINE STATE
  const now = new Date();
  const [timelineMonth, setTimelineMonth] = useState<number>(now.getMonth() + 1);
  const [timelineYear, setTimelineYear] = useState<number>(now.getFullYear());
  const [timelineData, setTimelineData] = useState<any | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelineSearchText, setTimelineSearchText] = useState('');
  const [timelineFloorFilter, setTimelineFloorFilter] = useState<number | 'all'>('all');
  const [timelineStatusFilter, setTimelineStatusFilter] = useState<'all' | 'occupied' | 'has_booking' | 'empty'>('all');
  const [expandedRoomIds, setExpandedRoomIds] = useState<number[]>([]);

  // Fetch Booking List
  const fetchBookings = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await apiClient.get('/bookings/?no_page=true');
      const list = res.data.results || res.data.bookings || res.data.data || res.data || [];
      setBookings(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.warn('Lỗi tải danh sách đặt phòng:', err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Fetch Timeline
  const fetchTimeline = useCallback(async (month: number, year: number) => {
    setLoadingTimeline(true);
    try {
      const res = await apiClient.get(`/bookings/timeline/?month=${month}&year=${year}`);
      if (res.data) {
        setTimelineData(res.data);
      }
    } catch (err: any) {
      console.warn('Lỗi tải lịch đặt phòng (timeline):', err);
    } finally {
      setLoadingTimeline(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      if (activeMainTab === 'list') {
        fetchBookings();
      } else {
        fetchTimeline(timelineMonth, timelineYear);
      }
    }
  }, [visible, activeMainTab, timelineMonth, timelineYear, fetchBookings, fetchTimeline]);

  // Reset expanded rooms on month/year change
  useEffect(() => {
    setExpandedRoomIds([]);
  }, [timelineMonth, timelineYear]);

  // Quick stats
  const stats = useMemo(() => {
    const total = bookings.length;
    const checkedIn = bookings.filter((b) => b.status === 'checked_in').length;
    const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
    const completed = bookings.filter((b) => b.status === 'completed' || b.status === 'checked_out').length;
    return { total, checkedIn, confirmed, completed };
  }, [bookings]);

  // Filtered List
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // 1. Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'completed') {
          if (b.status !== 'completed' && b.status !== 'checked_out') return false;
        } else if (b.status !== statusFilter) {
          return false;
        }
      }

      // 2. Search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const code = (b.booking_code || '').toLowerCase();
        const name = (b.guest_name || b.guest?.full_name || '').toLowerCase();
        const phone = (b.guest_phone || b.guest?.phone_number || '');
        const room = String(b.room_number || '');
        if (!code.includes(q) && !name.includes(q) && !phone.includes(q) && !room.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [bookings, statusFilter, searchQuery]);

  // Infinite Scroll cho Danh sách đặt phòng
  const [visibleCount, setVisibleCount] = useState(15);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setVisibleCount(15);
  }, [statusFilter, searchQuery]);

  const displayedBookings = useMemo(() => {
    return filteredBookings.slice(0, visibleCount);
  }, [filteredBookings, visibleCount]);

  const handleLoadMore = () => {
    if (loadingMore || visibleCount >= filteredBookings.length) return;
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 15, filteredBookings.length));
      setLoadingMore(false);
    }, 250);
  };

  const renderFooter = () => {
    if (filteredBookings.length <= 15) return <View style={{ height: 20 }} />;
    if (loadingMore) {
      return (
        <View style={styles.loadMoreFooter}>
          <ActivityIndicator size="small" color="#F59E0B" />
          <Text style={styles.loadMoreText}>Đang tải thêm đơn đặt phòng cũ...</Text>
        </View>
      );
    }
    if (visibleCount >= filteredBookings.length) {
      return (
        <View style={styles.endOfListFooter}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.endOfListText}>Đã hiển thị toàn bộ {filteredBookings.length} đơn đặt phòng</Text>
        </View>
      );
    }
    return (
      <View style={styles.endOfListFooter}>
        <Text style={styles.loadMoreHintText}>
          Đang xem {visibleCount}/{filteredBookings.length} đơn • Cuộn xuống để xem thêm
        </Text>
      </View>
    );
  };

  const changeTimelineMonth = (delta: number) => {
    Haptics.selectionAsync();
    let m = timelineMonth + delta;
    let y = timelineYear;
    if (m > 12) {
      m = 1;
      y += 1;
    } else if (m < 1) {
      m = 12;
      y -= 1;
    }
    setTimelineMonth(m);
    setTimelineYear(y);
  };

  // Timeline unique floors
  const timelineFloors = useMemo(() => {
    if (!timelineData?.rooms) return [];
    const floors = new Set<number>();
    timelineData.rooms.forEach((r: any) => {
      if (r.floor !== undefined && r.floor !== null) {
        floors.add(Number(r.floor));
      }
    });
    return Array.from(floors).sort((a, b) => a - b);
  }, [timelineData]);

  // Timeline room statistics
  const timelineStats = useMemo(() => {
    if (!timelineData?.rooms) return { total: 0, occupied: 0, hasBooking: 0, empty: 0 };
    let total = timelineData.rooms.length;
    let occupied = 0;
    let hasBooking = 0;
    let empty = 0;
    timelineData.rooms.forEach((r: any) => {
      const bks = r.bookings || [];
      if (bks.some((b: any) => b.status === 'checked_in')) {
        occupied++;
      }
      if (bks.length > 0) {
        hasBooking++;
      } else {
        empty++;
      }
    });
    return { total, occupied, hasBooking, empty };
  }, [timelineData]);

  // Filtered Timeline rooms
  const filteredTimelineRooms = useMemo(() => {
    if (!timelineData?.rooms) return [];
    return timelineData.rooms.filter((room: any) => {
      // 1. Floor filter
      if (timelineFloorFilter !== 'all' && Number(room.floor) !== timelineFloorFilter) {
        return false;
      }

      // 2. Status filter
      const bks = room.bookings || [];
      const hasCheckedIn = bks.some((b: any) => b.status === 'checked_in');
      const hasBookings = bks.length > 0;
      if (timelineStatusFilter === 'occupied' && !hasCheckedIn) return false;
      if (timelineStatusFilter === 'has_booking' && !hasBookings) return false;
      if (timelineStatusFilter === 'empty' && hasBookings) return false;

      // 3. Search query
      if (timelineSearchText.trim()) {
        const q = timelineSearchText.trim().toLowerCase();
        const roomNum = String(room.room_number || '').toLowerCase();
        const cat = (room.category_name || room.category?.name || '').toLowerCase();
        const guestNames = bks.map((b: any) => (b.guest_name || '').toLowerCase()).join(' ');
        const bookingCodes = bks.map((b: any) => (b.booking_code || '').toLowerCase()).join(' ');
        if (!roomNum.includes(q) && !cat.includes(q) && !guestNames.includes(q) && !bookingCodes.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [timelineData, timelineFloorFilter, timelineStatusFilter, timelineSearchText]);

  // Accordion Expand/Collapse Helpers
  const toggleRoomExpand = (roomId: number) => {
    Haptics.selectionAsync();
    setExpandedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  const areAllExpanded = useMemo(() => {
    const roomsWithMulti = filteredTimelineRooms.filter((r: any) => (r.bookings?.length || 0) > 1);
    if (roomsWithMulti.length === 0) return false;
    return roomsWithMulti.every((r: any) => expandedRoomIds.includes(r.id));
  }, [filteredTimelineRooms, expandedRoomIds]);

  const handleToggleExpandAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (areAllExpanded) {
      setExpandedRoomIds([]);
    } else {
      const multiIds = filteredTimelineRooms
        .filter((r: any) => (r.bookings?.length || 0) > 1)
        .map((r: any) => r.id);
      setExpandedRoomIds(multiIds);
    }
  };

  const getCategorizedBookings = (bookings: any[]) => {
    if (!bookings || bookings.length === 0) return { activeBooking: null, otherBookings: [] };
    if (bookings.length === 1) return { activeBooking: bookings[0], otherBookings: [] };

    let activeIdx = bookings.findIndex((b: any) => b.status === 'checked_in');
    if (activeIdx === -1) {
      activeIdx = bookings.findIndex((b: any) => b.status === 'confirmed');
    }
    if (activeIdx === -1) {
      activeIdx = 0;
    }

    const activeBooking = bookings[activeIdx];
    const otherBookings = bookings.filter((_: any, idx: number) => idx !== activeIdx);
    return { activeBooking, otherBookings };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'checked_in':
        return { label: 'Đang ở 🟢', bg: 'rgba(16, 185, 129, 0.15)', text: '#34D399', border: 'rgba(16, 185, 129, 0.4)' };
      case 'confirmed':
        return { label: 'Sắp nhận 🟡', bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.4)' };
      case 'completed':
      case 'checked_out':
        return { label: 'Đã trả phòng ⚪', bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', border: 'rgba(148, 163, 184, 0.3)' };
      case 'cancelled':
        return { label: 'Đã hủy 🔴', bg: 'rgba(239, 68, 68, 0.15)', text: '#F87171', border: 'rgba(239, 68, 68, 0.4)' };
      default:
        return { label: status || 'Khác', bg: 'rgba(255, 255, 255, 0.08)', text: '#CBD5E1', border: 'rgba(255, 255, 255, 0.15)' };
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Quản Lý Đặt Phòng & Lịch Trình 📋</Text>
              <Text style={styles.headerSubtitle}>Tra cứu đơn phòng, lịch lưu trú và thông tin khách</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Top Mode Switcher */}
          <View style={styles.modeSwitcher}>
            <TouchableOpacity
              style={[styles.modeBtn, activeMainTab === 'list' && styles.modeBtnActive]}
              onPress={() => {
                setActiveMainTab('list');
                Haptics.selectionAsync();
              }}
            >
              <Ionicons
                name="list"
                size={16}
                color={activeMainTab === 'list' ? '#0A0F1D' : '#94A3B8'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.modeBtnText, activeMainTab === 'list' && styles.modeBtnTextActive]}>
                Danh Sách Đặt Phòng ({bookings.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeBtn, activeMainTab === 'timeline' && styles.modeBtnActive]}
              onPress={() => {
                setActiveMainTab('timeline');
                Haptics.selectionAsync();
              }}
            >
              <Ionicons
                name="calendar"
                size={16}
                color={activeMainTab === 'timeline' ? '#0A0F1D' : '#94A3B8'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.modeBtnText, activeMainTab === 'timeline' && styles.modeBtnTextActive]}>
                Lịch Lưu Trú (Timeline)
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: LIST VIEW */}
          {activeMainTab === 'list' ? (
            <View style={{ flex: 1 }}>
              {/* KPI Filter Bar */}
              <View style={styles.kpiRow}>
                {[
                  { key: 'all', label: 'Tất cả', count: stats.total, color: '#F8FAFC' },
                  { key: 'checked_in', label: 'Đang ở', count: stats.checkedIn, color: '#34D399' },
                  { key: 'confirmed', label: 'Sắp nhận', count: stats.confirmed, color: '#F59E0B' },
                  { key: 'completed', label: 'Đã trả', count: stats.completed, color: '#94A3B8' },
                ].map((item) => {
                  const isSelected = statusFilter === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.kpiCard, isSelected && styles.kpiCardActive]}
                      onPress={() => {
                        setStatusFilter(item.key);
                        Haptics.selectionAsync();
                      }}
                    >
                      <Text style={[styles.kpiNumber, { color: isSelected ? '#F59E0B' : item.color }]}>
                        {item.count}
                      </Text>
                      <Text style={[styles.kpiLabel, isSelected && styles.kpiLabelActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Search Box */}
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={17} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm mã đặt phòng, tên khách, số phòng, SĐT..."
                  placeholderTextColor="#64748B"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* List */}
              {loadingList ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator size="large" color="#F59E0B" />
                  <Text style={styles.loadingText}>Đang tải danh sách đặt phòng...</Text>
                </View>
              ) : filteredBookings.length === 0 ? (
                <View style={styles.centerBox}>
                  <Ionicons name="document-text-outline" size={48} color="#475569" />
                  <Text style={styles.emptyText}>Không tìm thấy đơn đặt phòng phù hợp</Text>
                </View>
              ) : (
                <FlatList
                  data={displayedBookings}
                  keyExtractor={(b) => String(b.id || b.booking_code)}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 25 }}
                  onEndReached={handleLoadMore}
                  onEndReachedThreshold={0.2}
                  ListFooterComponent={renderFooter}
                  renderItem={({ item: b }) => {
                    const badge = getStatusBadge(b.status);
                    const grandTotal = b.grand_total_amount || b.total_amount;
                    const priceFormatted = grandTotal
                      ? `${parseInt(grandTotal, 10).toLocaleString('vi-VN')} đ`
                      : '—';
                    const guestId = b.guest || b.guest_id || (typeof b.guest === 'object' ? b.guest?.id : null);

                    return (
                      <View key={b.id || b.booking_code} style={styles.bookingCard}>
                        {/* Top Card Line */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.bookingCode}>#{b.booking_code}</Text>
                            {b.room_number ? (
                              <View style={styles.roomBadge}>
                                <Text style={styles.roomBadgeText}>P.{b.room_number}</Text>
                              </View>
                            ) : (
                              <View style={[styles.roomBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                                <Text style={[styles.roomBadgeText, { color: '#F87171' }]}>Chưa xếp</Text>
                              </View>
                            )}
                          </View>

                          <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                            <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                              {b.status_display || badge.label}
                            </Text>
                          </View>
                        </View>

                        {/* Room & Category */}
                        <Text style={styles.roomNameText}>
                          {b.room_name || b.category_name || 'Phòng tiêu chuẩn'}
                        </Text>

                        {/* Guest Info Row */}
                        <View style={styles.guestRow}>
                          <Ionicons name="person" size={14} color="#60A5FA" style={{ marginRight: 6 }} />
                          <Text style={styles.guestNameText}>{b.guest_name || 'Khách vãng lai'}</Text>
                          {b.guest_phone ? (
                            <TouchableOpacity
                              style={styles.phonePill}
                              onPress={() => Linking.openURL(`tel:${b.guest_phone}`)}
                            >
                              <Ionicons name="call" size={12} color="#10B981" style={{ marginRight: 4 }} />
                              <Text style={styles.phonePillText}>{b.guest_phone}</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>

                        {/* Stay Dates */}
                        <View style={styles.dateRow}>
                          <Ionicons name="calendar-outline" size={13} color="#94A3B8" style={{ marginRight: 6 }} />
                          <Text style={styles.dateText}>
                            {b.check_in_date} ➔ {b.check_out_date}
                          </Text>
                        </View>

                        {/* Bottom Row: Total amount & Quick CRM shortcut */}
                        <View style={styles.bottomCardRow}>
                          <View>
                            <Text style={styles.priceLabel}>Tổng tiền:</Text>
                            <Text style={styles.priceValue}>{priceFormatted}</Text>
                          </View>

                          {guestId && onSelectGuest ? (
                            <TouchableOpacity
                              style={styles.crmShortcutBtn}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                onSelectGuest(guestId);
                              }}
                            >
                              <Ionicons name="person-circle-outline" size={15} color="#F59E0B" />
                              <Text style={styles.crmShortcutText}>Hồ sơ CRM 👤</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    );
                  }}
                />
              )}
            </View>
          ) : (
            /* TAB 2: TIMELINE / SCHEDULE VIEW */
            <View style={{ flex: 1 }}>
              {/* Month Selector Bar */}
              <View style={styles.monthPickerBar}>
                <TouchableOpacity style={styles.monthNavBtn} onPress={() => changeTimelineMonth(-1)}>
                  <Ionicons name="chevron-back" size={20} color="#F59E0B" />
                </TouchableOpacity>

                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.monthPickerTitle}>
                    Tháng {timelineMonth} / {timelineYear}
                  </Text>
                  <Text style={styles.monthPickerSub}>
                    {timelineData ? `${timelineData.total_rooms} phòng • ${timelineData.total_bookings} lịch đặt` : 'Đang đồng bộ...'}
                  </Text>
                </View>

                <TouchableOpacity style={styles.monthNavBtn} onPress={() => changeTimelineMonth(1)}>
                  <Ionicons name="chevron-forward" size={20} color="#F59E0B" />
                </TouchableOpacity>
              </View>

              {/* Quick Search in Timeline */}
              <View style={styles.timelineSearchBox}>
                <Ionicons name="search-outline" size={16} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.timelineSearchInput}
                  placeholder="Tìm số phòng, tên khách, loại phòng, mã đơn..."
                  placeholderTextColor="#64748B"
                  value={timelineSearchText}
                  onChangeText={setTimelineSearchText}
                />
                {timelineSearchText ? (
                  <TouchableOpacity onPress={() => setTimelineSearchText('')}>
                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Filter Row: Floors & Status */}
              <View style={styles.filterBarContainer}>
                {timelineFloors.length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScrollView}
                    contentContainerStyle={{ paddingHorizontal: 2 }}
                  >
                    <TouchableOpacity
                      style={[styles.floorChip, timelineFloorFilter === 'all' && styles.floorChipActive]}
                      onPress={() => {
                        setTimelineFloorFilter('all');
                        Haptics.selectionAsync();
                      }}
                    >
                      <Text style={[styles.floorChipText, timelineFloorFilter === 'all' && styles.floorChipTextActive]}>
                        🏢 Tất cả tầng
                      </Text>
                    </TouchableOpacity>
                    {timelineFloors.map((floor) => (
                      <TouchableOpacity
                        key={`floor-${floor}`}
                        style={[styles.floorChip, timelineFloorFilter === floor && styles.floorChipActive]}
                        onPress={() => {
                          setTimelineFloorFilter(floor);
                          Haptics.selectionAsync();
                        }}
                      >
                        <Text style={[styles.floorChipText, timelineFloorFilter === floor && styles.floorChipTextActive]}>
                          Tầng {floor}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                <View style={styles.statusChipRow}>
                  {[
                    { key: 'all', label: `Tất cả (${timelineStats.total})` },
                    { key: 'occupied', label: `🟢 Đang ở (${timelineStats.occupied})` },
                    { key: 'has_booking', label: `🟡 Có lịch (${timelineStats.hasBooking})` },
                    { key: 'empty', label: `⚪ Trống (${timelineStats.empty})` },
                  ].map((item) => {
                    const isSelected = timelineStatusFilter === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[styles.statusChip, isSelected && styles.statusChipActive]}
                        onPress={() => {
                          setTimelineStatusFilter(item.key as any);
                          Haptics.selectionAsync();
                        }}
                      >
                        <Text style={[styles.statusChipText, isSelected && styles.statusChipTextActive]}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Sub-bar: Room counter and Expand/Collapse All toggle */}
              <View style={styles.timelineSubBar}>
                <Text style={styles.timelineCountSummary}>
                  Hiển thị <Text style={{ color: '#F8FAFC', fontWeight: '800' }}>{filteredTimelineRooms.length}</Text> / {timelineData?.rooms?.length || 0} phòng
                </Text>
                {filteredTimelineRooms.some((r: any) => (r.bookings?.length || 0) > 1) && (
                  <TouchableOpacity
                    style={styles.expandAllBtn}
                    onPress={handleToggleExpandAll}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={areAllExpanded ? 'contract-outline' : 'expand-outline'}
                      size={13}
                      color="#38BDF8"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.expandAllBtnText}>
                      {areAllExpanded ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Timeline Content */}
              {loadingTimeline ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator size="large" color="#F59E0B" />
                  <Text style={styles.loadingText}>Đang tải sơ đồ lịch lưu trú...</Text>
                </View>
              ) : !timelineData || !timelineData.rooms || timelineData.rooms.length === 0 ? (
                <View style={styles.centerBox}>
                  <Ionicons name="calendar-outline" size={48} color="#475569" />
                  <Text style={styles.emptyText}>Chưa có dữ liệu lịch đặt phòng tháng này.</Text>
                </View>
              ) : filteredTimelineRooms.length === 0 ? (
                <View style={styles.centerBox}>
                  <Ionicons name="search-outline" size={48} color="#475569" />
                  <Text style={styles.emptyText}>Không tìm thấy phòng phù hợp với bộ lọc.</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 35 }}>
                  {filteredTimelineRooms.map((room: any) => {
                    const roomBookings = room.bookings || [];
                    const { activeBooking, otherBookings } = getCategorizedBookings(roomBookings);
                    const isExpanded = expandedRoomIds.includes(room.id);
                    const canExpand = otherBookings.length > 0;

                    return (
                      <View key={room.id} style={styles.timelineRoomCard}>
                        {/* Room Info Header */}
                        <TouchableOpacity
                          style={styles.timelineRoomHeader}
                          activeOpacity={canExpand ? 0.7 : 1}
                          onPress={() => {
                            if (canExpand) toggleRoomExpand(room.id);
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                            <View style={styles.timelineRoomBadge}>
                              <Text style={styles.timelineRoomBadgeText}>P.{room.room_number}</Text>
                            </View>
                            <View style={{ marginLeft: 8, flex: 1 }}>
                              <Text style={styles.timelineRoomName} numberOfLines={1}>
                                {room.category_name || room.category?.name || 'Phòng Deluxe'}
                              </Text>
                              <Text style={styles.timelineRoomSub} numberOfLines={1}>
                                Tầng {room.floor} • Trạng thái: {room.status_display || room.status}
                              </Text>
                            </View>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View
                              style={[
                                styles.bookingCountBadge,
                                roomBookings.length === 0 && styles.bookingCountBadgeEmpty,
                                roomBookings.length > 1 && styles.bookingCountBadgeMulti,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.bookingCountBadgeText,
                                  roomBookings.length === 0 && { color: '#64748B' },
                                  roomBookings.length > 1 && { color: '#38BDF8' },
                                ]}
                              >
                                {roomBookings.length === 0 ? 'Trống' : `${roomBookings.length} lịch đặt`}
                              </Text>
                            </View>

                            {canExpand && (
                              <Ionicons
                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                size={15}
                                color="#38BDF8"
                                style={{ marginLeft: 6 }}
                              />
                            )}
                          </View>
                        </TouchableOpacity>

                        {/* Stays in this room */}
                        {roomBookings.length === 0 ? (
                          <View style={styles.timelineEmptyBox}>
                            <Ionicons name="sparkles" size={12} color="#10B981" style={{ marginRight: 6 }} />
                            <Text style={styles.timelineEmptyText}>Phòng trống trong suốt tháng {timelineMonth}</Text>
                          </View>
                        ) : (
                          <View>
                            {/* Primary Active Stay */}
                            {activeBooking && (
                              <View style={styles.activeBookingWrapper}>
                                <View style={styles.priorityBanner}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons
                                      name={
                                        activeBooking.status === 'checked_in'
                                          ? 'radio-button-on'
                                          : activeBooking.status === 'confirmed'
                                          ? 'time'
                                          : 'calendar'
                                      }
                                      size={12}
                                      color={
                                        activeBooking.status === 'checked_in'
                                          ? '#34D399'
                                          : activeBooking.status === 'confirmed'
                                          ? '#F59E0B'
                                          : '#38BDF8'
                                      }
                                      style={{ marginRight: 5 }}
                                    />
                                    <Text
                                      style={[
                                        styles.priorityBannerText,
                                        activeBooking.status === 'checked_in' && { color: '#34D399' },
                                        activeBooking.status === 'confirmed' && { color: '#F59E0B' },
                                        activeBooking.status !== 'checked_in' && activeBooking.status !== 'confirmed' && { color: '#38BDF8' },
                                      ]}
                                    >
                                      {activeBooking.status === 'checked_in'
                                        ? 'ĐANG LƯU TRÚ HÔM NAY'
                                        : activeBooking.status === 'confirmed'
                                        ? 'SẮP NHẬN PHÒNG'
                                        : 'LỊCH ĐẶT GẦN NHẤT'}
                                    </Text>
                                  </View>

                                  <View
                                    style={[
                                      styles.statusBadgeSmall,
                                      {
                                        backgroundColor: getStatusBadge(activeBooking.status).bg,
                                        borderColor: getStatusBadge(activeBooking.status).border,
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.statusBadgeSmallText,
                                        { color: getStatusBadge(activeBooking.status).text },
                                      ]}
                                    >
                                      {activeBooking.status_display || getStatusBadge(activeBooking.status).label}
                                    </Text>
                                  </View>
                                </View>

                                <View style={styles.primaryStayBody}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 }}>
                                      <Text style={styles.primaryGuestName} numberOfLines={1}>
                                        👤 {activeBooking.guest_name}
                                      </Text>
                                      {activeBooking.booking_code && (
                                        <Text style={styles.stayBookingCode}>#{activeBooking.booking_code}</Text>
                                      )}
                                    </View>

                                    {activeBooking.group_name ? (
                                      <View style={styles.groupTag}>
                                        <Ionicons name="people" size={10} color="#F59E0B" style={{ marginRight: 3 }} />
                                        <Text style={styles.groupTagText} numberOfLines={1}>
                                          {activeBooking.group_name}
                                        </Text>
                                      </View>
                                    ) : null}
                                  </View>

                                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, justifyContent: 'space-between' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                      <Ionicons name="calendar-outline" size={12} color="#94A3B8" style={{ marginRight: 4 }} />
                                      <Text style={styles.stayDates}>
                                        {activeBooking.check_in_date} ➔ {activeBooking.check_out_date} ({activeBooking.nights} đêm)
                                      </Text>
                                    </View>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                      {activeBooking.guest_phone ? (
                                        <TouchableOpacity
                                          style={styles.phonePillSmall}
                                          onPress={() => Linking.openURL(`tel:${activeBooking.guest_phone}`)}
                                        >
                                          <Ionicons name="call" size={10} color="#34D399" style={{ marginRight: 3 }} />
                                          <Text style={styles.phonePillSmallText}>{activeBooking.guest_phone}</Text>
                                        </TouchableOpacity>
                                      ) : null}

                                      {activeBooking.guest_id && onSelectGuest ? (
                                        <TouchableOpacity
                                          style={styles.crmShortcutBtnSmall}
                                          onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            onSelectGuest(activeBooking.guest_id);
                                          }}
                                        >
                                          <Ionicons name="person-circle-outline" size={12} color="#F59E0B" />
                                          <Text style={styles.crmShortcutTextSmall}>CRM</Text>
                                        </TouchableOpacity>
                                      ) : null}
                                    </View>
                                  </View>
                                </View>
                              </View>
                            )}

                            {/* Expanded Other Stays */}
                            {canExpand && isExpanded && (
                              <View style={styles.otherBookingsContainer}>
                                <View style={styles.otherBookingsHeader}>
                                  <Text style={styles.otherBookingsHeaderText}>
                                    Các lịch đặt khác trong tháng ({otherBookings.length}):
                                  </Text>
                                </View>
                                {otherBookings.map((bk: any) => {
                                  const badge = getStatusBadge(bk.status);
                                  return (
                                    <View key={bk.id || bk.booking_code} style={styles.stayItemCard}>
                                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                                          <Text style={styles.stayGuestName} numberOfLines={1}>
                                            👤 {bk.guest_name}
                                          </Text>
                                          {bk.booking_code ? (
                                            <Text style={styles.stayBookingCode}>#{bk.booking_code}</Text>
                                          ) : null}
                                        </View>
                                        <View style={[styles.statusBadgeSmall, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                                          <Text style={[styles.statusBadgeSmallText, { color: badge.text }]}>
                                            {bk.status_display || badge.label}
                                          </Text>
                                        </View>
                                      </View>

                                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, justifyContent: 'space-between' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                          <Ionicons name="calendar-outline" size={11} color="#94A3B8" style={{ marginRight: 4 }} />
                                          <Text style={styles.stayDates}>
                                            {bk.check_in_date} ➔ {bk.check_out_date} ({bk.nights} đêm)
                                          </Text>
                                        </View>

                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                          {bk.guest_phone ? (
                                            <TouchableOpacity
                                              style={{ flexDirection: 'row', alignItems: 'center' }}
                                              onPress={() => Linking.openURL(`tel:${bk.guest_phone}`)}
                                            >
                                              <Ionicons name="call" size={10} color="#34D399" style={{ marginRight: 3 }} />
                                              <Text style={[styles.stayDates, { color: '#38BDF8', fontSize: 10.5 }]}>
                                                {bk.guest_phone}
                                              </Text>
                                            </TouchableOpacity>
                                          ) : null}

                                          {bk.guest_id && onSelectGuest ? (
                                            <TouchableOpacity
                                              style={styles.crmShortcutBtnSmall}
                                              onPress={() => {
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                onSelectGuest(bk.guest_id);
                                              }}
                                            >
                                              <Ionicons name="person-circle-outline" size={11} color="#F59E0B" />
                                              <Text style={styles.crmShortcutTextSmall}>CRM</Text>
                                            </TouchableOpacity>
                                          ) : null}
                                        </View>
                                      </View>
                                    </View>
                                  );
                                })}
                              </View>
                            )}

                            {/* Accordion Toggle Button for other bookings */}
                            {canExpand && (
                              <TouchableOpacity
                                style={[styles.roomExpandToggle, isExpanded && styles.roomExpandToggleExpanded]}
                                onPress={() => toggleRoomExpand(room.id)}
                                activeOpacity={0.7}
                              >
                                <Ionicons
                                  name={isExpanded ? 'chevron-up-circle-outline' : 'chevron-down-circle-outline'}
                                  size={14}
                                  color={isExpanded ? '#94A3B8' : '#38BDF8'}
                                  style={{ marginRight: 6 }}
                                />
                                <Text style={[styles.roomExpandToggleText, isExpanded && { color: '#94A3B8' }]}>
                                  {isExpanded
                                    ? `Thu gọn (ẩn ${otherBookings.length} đơn khác)`
                                    : `Xem thêm ${otherBookings.length} lịch đặt khác trong tháng`}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '92%',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeSwitcher: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modeBtnActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  modeBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  modeBtnTextActive: {
    color: '#0A0F1D',
    fontWeight: '900',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  kpiCardActive: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  kpiNumber: {
    fontSize: 15,
    fontWeight: '900',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
  },
  kpiLabelActive: {
    color: '#F59E0B',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0F1D',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 12.5,
  },
  centerBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 8,
  },
  bookingCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bookingCode: {
    fontSize: 13,
    fontWeight: '900',
    color: '#38BDF8',
  },
  roomBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  roomBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  roomNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 6,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  guestNameText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#93C5FD',
    flex: 1,
  },
  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  phonePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#34D399',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  dateText: {
    fontSize: 11.5,
    color: '#94A3B8',
  },
  bottomCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  priceLabel: {
    fontSize: 10,
    color: '#94A3B8',
  },
  priceValue: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#34D399',
  },
  crmShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    gap: 4,
  },
  crmShortcutText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
  },
  monthPickerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthPickerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  monthPickerSub: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  timelineSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timelineSearchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 12.5,
  },
  filterBarContainer: {
    marginBottom: 6,
  },
  chipScrollView: {
    marginBottom: 6,
  },
  floorChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  floorChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
  },
  floorChipText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  floorChipTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  statusChipRow: {
    flexDirection: 'row',
    gap: 5,
  },
  statusChip: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusChipActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#F59E0B',
  },
  statusChipText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  statusChipTextActive: {
    color: '#F59E0B',
    fontWeight: '800',
  },
  timelineSubBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  timelineCountSummary: {
    fontSize: 11,
    color: '#94A3B8',
  },
  expandAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  expandAllBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#38BDF8',
  },
  timelineRoomCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timelineRoomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  timelineRoomBadge: {
    backgroundColor: '#0A0F1D',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timelineRoomBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#38BDF8',
  },
  timelineRoomName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  timelineRoomSub: {
    fontSize: 10.5,
    color: '#94A3B8',
  },
  bookingCountBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  bookingCountBadgeMulti: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  bookingCountBadgeEmpty: {
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  bookingCountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
  },
  timelineEmptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  timelineEmptyText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  activeBookingWrapper: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    marginBottom: 4,
  },
  priorityBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#172033',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  priorityBannerText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  primaryStayBody: {
    padding: 10,
  },
  primaryGuestName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
    marginRight: 6,
  },
  stayBookingCode: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  phonePillSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  phonePillSmallText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34D399',
  },
  groupTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  groupTagText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#F59E0B',
    maxWidth: 90,
  },
  crmShortcutBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    gap: 3,
  },
  crmShortcutTextSmall: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#F59E0B',
  },
  otherBookingsContainer: {
    marginTop: 6,
    marginBottom: 4,
  },
  otherBookingsHeader: {
    paddingVertical: 3,
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  otherBookingsHeaderText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  roomExpandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    marginTop: 4,
  },
  roomExpandToggleExpanded: {
    backgroundColor: 'rgba(148, 163, 184, 0.06)',
    borderColor: 'rgba(148, 163, 184, 0.18)',
  },
  roomExpandToggleText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#38BDF8',
  },
  stayItemCard: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  stayGuestName: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#CBD5E1',
  },
  statusBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeSmallText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  stayDates: {
    fontSize: 10.5,
    color: '#94A3B8',
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
