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
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                  {timelineData.rooms.map((room: any) => {
                    const roomBookings = room.bookings || [];
                    return (
                      <View key={room.id} style={styles.timelineRoomCard}>
                        {/* Room Info Header */}
                        <View style={styles.timelineRoomHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={styles.timelineRoomBadge}>
                              <Text style={styles.timelineRoomBadgeText}>P.{room.room_number}</Text>
                            </View>
                            <View style={{ marginLeft: 8 }}>
                              <Text style={styles.timelineRoomName}>
                                {room.category_name || room.category?.name || 'Phòng Deluxe'}
                              </Text>
                              <Text style={styles.timelineRoomSub}>Tầng {room.floor} • Trạng thái: {room.status_display || room.status}</Text>
                            </View>
                          </View>
                          <Text style={styles.bookingCountBadge}>
                            {roomBookings.length} lịch đặt
                          </Text>
                        </View>

                        {/* Stays in this room */}
                        {roomBookings.length === 0 ? (
                          <View style={styles.timelineEmptyBox}>
                            <Text style={styles.timelineEmptyText}>Phòng trống suốt tháng {timelineMonth}</Text>
                          </View>
                        ) : (
                          roomBookings.map((bk: any) => {
                            const badge = getStatusBadge(bk.status);
                            return (
                              <View key={bk.id || bk.booking_code} style={styles.stayItemCard}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Text style={styles.stayGuestName}>
                                    👤 {bk.guest_name}
                                  </Text>
                                  <View style={[styles.statusBadgeSmall, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                                    <Text style={[styles.statusBadgeSmallText, { color: badge.text }]}>
                                      {bk.status_display || badge.label}
                                    </Text>
                                  </View>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                  <Ionicons name="time-outline" size={12} color="#94A3B8" style={{ marginRight: 4 }} />
                                  <Text style={styles.stayDates}>
                                    {bk.check_in_date} ➔ {bk.check_out_date} ({bk.nights} đêm)
                                  </Text>
                                </View>

                                {bk.guest_phone ? (
                                  <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
                                    onPress={() => Linking.openURL(`tel:${bk.guest_phone}`)}
                                  >
                                    <Ionicons name="call" size={11} color="#34D399" style={{ marginRight: 4 }} />
                                    <Text style={[styles.stayDates, { color: '#38BDF8' }]}>
                                      {bk.guest_phone}
                                    </Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                            );
                          })
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
    fontSize: 10.5,
    fontWeight: '700',
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timelineEmptyBox: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  timelineEmptyText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
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
    fontSize: 12,
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
    fontSize: 11,
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
