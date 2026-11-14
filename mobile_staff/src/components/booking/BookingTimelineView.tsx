import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { safeOpenUrl } from '../../utils/linking';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { styles } from './styles';
import { BookingTimelineViewProps, getStatusBadge } from './types';

export default function BookingTimelineView({
  isDark,
  onSelectGuest,
}: BookingTimelineViewProps) {
  const now = new Date();
  const [timelineMonth, setTimelineMonth] = useState<number>(now.getMonth() + 1);
  const [timelineYear, setTimelineYear] = useState<number>(now.getFullYear());
  const [timelineData, setTimelineData] = useState<any | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelineSearchText, setTimelineSearchText] = useState('');
  const [timelineFloorFilter, setTimelineFloorFilter] = useState<number | 'all'>('all');
  const [timelineStatusFilter, setTimelineStatusFilter] = useState<'all' | 'occupied' | 'has_booking' | 'empty'>('all');
  const [isTimelineFilterExpanded, setIsTimelineFilterExpanded] = useState<boolean>(false);
  const [expandedRoomIds, setExpandedRoomIds] = useState<number[]>([]);

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
    fetchTimeline(timelineMonth, timelineYear);
  }, [timelineMonth, timelineYear, fetchTimeline]);

  // Reset expanded rooms on month/year change
  useEffect(() => {
    setExpandedRoomIds([]);
  }, [timelineMonth, timelineYear]);

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

  const hasActiveTimelineFilter = timelineFloorFilter !== 'all' || timelineStatusFilter !== 'all';

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

  return (
    <View style={{ flex: 1 }}>
      {/* Month Selector Bar */}
      <View
        style={[
          styles.monthPickerBar,
          !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
        ]}
      >
        <TouchableOpacity
          style={[styles.monthNavBtn, !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderWidth: 1 }]}
          onPress={() => changeTimelineMonth(-1)}
        >
          <Ionicons name="chevron-back" size={20} color="#D97706" />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.monthPickerTitle, !isDark && { color: '#0F172A' }]}>
            Tháng {timelineMonth} / {timelineYear}
          </Text>
          <Text style={[styles.monthPickerSub, !isDark && { color: '#64748B' }]}>
            {timelineData ? `${timelineData.total_rooms} phòng • ${timelineData.total_bookings} lịch đặt` : 'Đang đồng bộ...'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.monthNavBtn, !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderWidth: 1 }]}
          onPress={() => changeTimelineMonth(1)}
        >
          <Ionicons name="chevron-forward" size={20} color="#D97706" />
        </TouchableOpacity>
      </View>

      {/* Quick Search & Filter Toggle Bar */}
      <View style={styles.searchAndFilterRow}>
        <View
          style={[
            styles.timelineSearchBox,
            { flex: 1, marginBottom: 0 },
            !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' },
          ]}
        >
          <Ionicons name="search-outline" size={16} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.timelineSearchInput, !isDark && { color: '#0F172A' }]}
            placeholder="Tìm số phòng, tên khách, loại phòng, mã..."
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            value={timelineSearchText}
            onChangeText={setTimelineSearchText}
          />
          {timelineSearchText ? (
            <TouchableOpacity onPress={() => setTimelineSearchText('')}>
              <Ionicons name="close-circle" size={16} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[
            styles.filterToggleBtn,
            !isDark && {
              backgroundColor: hasActiveTimelineFilter ? '#FEF3C7' : '#F8FAFC',
              borderColor: hasActiveTimelineFilter ? '#F59E0B' : '#CBD5E1',
            },
            hasActiveTimelineFilter && styles.filterToggleBtnActive,
          ]}
          onPress={() => {
            setIsTimelineFilterExpanded((prev) => !prev);
            Haptics.selectionAsync();
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="options-outline"
            size={15}
            color={hasActiveTimelineFilter ? (isDark ? '#FBBF24' : '#B45309') : (isDark ? '#94A3B8' : '#64748B')}
          />
          <Text
            style={[
              styles.filterToggleBtnText,
              !isDark && { color: hasActiveTimelineFilter ? '#B45309' : '#64748B' },
              hasActiveTimelineFilter && styles.filterToggleBtnTextActive,
            ]}
          >
            Bộ lọc
          </Text>
          <Ionicons
            name={isTimelineFilterExpanded ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={hasActiveTimelineFilter ? (isDark ? '#FBBF24' : '#B45309') : (isDark ? '#94A3B8' : '#64748B')}
          />
          {hasActiveTimelineFilter && <View style={styles.filterActiveDot} />}
        </TouchableOpacity>
      </View>

      {/* Dải tóm tắt khi đang lọc nhưng khối bộ lọc đang đóng */}
      {hasActiveTimelineFilter && !isTimelineFilterExpanded && (
        <View style={[styles.activeFilterSummaryBar, !isDark && { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 5 }}>
            <Ionicons name="funnel-outline" size={12} color="#D97706" />
            <Text style={[styles.activeFilterSummaryText, !isDark && { color: '#B45309' }]} numberOfLines={1}>
              Đang lọc: {timelineFloorFilter !== 'all' ? `Tầng ${timelineFloorFilter}` : 'Mọi tầng'} • {
                timelineStatusFilter === 'occupied' ? 'Đang ở' :
                timelineStatusFilter === 'has_booking' ? 'Có lịch' :
                timelineStatusFilter === 'empty' ? 'Trống' : 'Mọi trạng thái'
              }
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setTimelineFloorFilter('all');
              setTimelineStatusFilter('all');
              Haptics.selectionAsync();
            }}
            style={styles.resetFilterSmallBtn}
            activeOpacity={0.7}
          >
            <Text style={[styles.resetFilterSmallText, !isDark && { color: '#DC2626' }]}>Đặt lại</Text>
            <Ionicons name="close-circle" size={12} color="#EF4444" />
          </TouchableOpacity>
        </View>
      )}

      {/* Khối Bộ Lọc Mở Rộng: Floors & Status (Thu gọn khi không cần) */}
      {isTimelineFilterExpanded && (
        <View style={[styles.filterBarContainer, !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
          <View style={styles.filterCardHeader}>
            <Text style={[styles.filterCardTitle, !isDark && { color: '#334155' }]}>
              Lọc theo tầng & trạng thái phòng:
            </Text>
            {hasActiveTimelineFilter && (
              <TouchableOpacity
                onPress={() => {
                  setTimelineFloorFilter('all');
                  setTimelineStatusFilter('all');
                  Haptics.selectionAsync();
                }}
                style={{ paddingVertical: 2, paddingHorizontal: 4 }}
              >
                <Text style={styles.filterCardResetText}>Đặt lại</Text>
              </TouchableOpacity>
            )}
          </View>

          {timelineFloors.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScrollView}
              contentContainerStyle={{ paddingHorizontal: 2 }}
            >
              <TouchableOpacity
                style={[
                  styles.floorChip,
                  !isDark && timelineFloorFilter !== 'all' && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
                  timelineFloorFilter === 'all' && styles.floorChipActive,
                ]}
                onPress={() => {
                  setTimelineFloorFilter('all');
                  Haptics.selectionAsync();
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name="business-outline"
                    size={12}
                    color={timelineFloorFilter === 'all' ? '#0A0F1D' : (isDark ? '#94A3B8' : '#64748B')}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.floorChipText,
                      !isDark && timelineFloorFilter !== 'all' && { color: '#64748B' },
                      timelineFloorFilter === 'all' && styles.floorChipTextActive,
                    ]}
                  >
                    Tất cả tầng
                  </Text>
                </View>
              </TouchableOpacity>
              {timelineFloors.map((floor) => (
                <TouchableOpacity
                  key={`floor-${floor}`}
                  style={[
                    styles.floorChip,
                    !isDark && timelineFloorFilter !== floor && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
                    timelineFloorFilter === floor && styles.floorChipActive,
                  ]}
                  onPress={() => {
                    setTimelineFloorFilter(floor);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text
                    style={[
                      styles.floorChipText,
                      !isDark && timelineFloorFilter !== floor && { color: '#64748B' },
                      timelineFloorFilter === floor && styles.floorChipTextActive,
                    ]}
                  >
                    Tầng {floor}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.statusChipRow}>
            {[
              { key: 'all', label: `Tất cả (${timelineStats.total})`, dot: null },
              { key: 'occupied', label: `Đang ở (${timelineStats.occupied})`, dot: '#10B981' },
              { key: 'has_booking', label: `Có lịch (${timelineStats.hasBooking})`, dot: '#F59E0B' },
              { key: 'empty', label: `Trống (${timelineStats.empty})`, dot: '#94A3B8' },
            ].map((item) => {
              const isSelected = timelineStatusFilter === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.statusChip,
                    !isDark && !isSelected && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
                    isSelected && styles.statusChipActive,
                    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
                  ]}
                  onPress={() => {
                    setTimelineStatusFilter(item.key as any);
                    Haptics.selectionAsync();
                  }}
                >
                  {item.dot && (
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: item.dot,
                      }}
                    />
                  )}
                  <Text
                    style={[
                      styles.statusChipText,
                      !isDark && !isSelected && { color: '#64748B' },
                      isSelected && styles.statusChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Sub-bar: Room counter and Expand/Collapse All toggle */}
      <View style={styles.timelineSubBar}>
        <Text style={[styles.timelineCountSummary, !isDark && { color: '#64748B' }]}>
          Hiển thị <Text style={{ color: isDark ? '#F8FAFC' : '#0F172A', fontWeight: '800' }}>{filteredTimelineRooms.length}</Text> / {timelineData?.rooms?.length || 0} phòng
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
              color="#0284C7"
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.expandAllBtnText, !isDark && { color: '#0284C7' }]}>
              {areAllExpanded ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Timeline Content */}
      {loadingTimeline ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={[styles.loadingText, !isDark && { color: '#64748B' }]}>Đang tải sơ đồ lịch lưu trú...</Text>
        </View>
      ) : !timelineData || !timelineData.rooms || timelineData.rooms.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="calendar-outline" size={48} color={isDark ? '#475569' : '#CBD5E1'} />
          <Text style={[styles.emptyText, !isDark && { color: '#64748B' }]}>Chưa có dữ liệu lịch đặt phòng tháng này.</Text>
        </View>
      ) : filteredTimelineRooms.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="search-outline" size={48} color={isDark ? '#475569' : '#CBD5E1'} />
          <Text style={[styles.emptyText, !isDark && { color: '#64748B' }]}>Không tìm thấy phòng phù hợp với bộ lọc.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 35 }}>
          {filteredTimelineRooms.map((room: any) => {
            const roomBookings = room.bookings || [];
            const { activeBooking, otherBookings } = getCategorizedBookings(roomBookings);
            const isExpanded = expandedRoomIds.includes(room.id);
            const canExpand = otherBookings.length > 0;

            return (
              <View
                key={room.id}
                style={[
                  styles.timelineRoomCard,
                  !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                ]}
              >
                {/* Room Info Header */}
                <TouchableOpacity
                  style={[styles.timelineRoomHeader, !isDark && { borderBottomColor: '#E2E8F0' }]}
                  activeOpacity={canExpand ? 0.7 : 1}
                  onPress={() => {
                    if (canExpand) toggleRoomExpand(room.id);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                    <View
                      style={[
                        styles.timelineRoomBadge,
                        !isDark && { backgroundColor: '#E0F2FE', borderColor: '#7DD3FC' },
                      ]}
                    >
                      <Text style={[styles.timelineRoomBadgeText, !isDark && { color: '#0284C7' }]}>P.{room.room_number}</Text>
                    </View>
                    <View style={{ marginLeft: 8, flex: 1 }}>
                      <Text style={[styles.timelineRoomName, !isDark && { color: '#0F172A' }]} numberOfLines={1}>
                        {room.category_name || room.category?.name || 'Phòng Deluxe'}
                      </Text>
                      <Text style={[styles.timelineRoomSub, !isDark && { color: '#64748B' }]} numberOfLines={1}>
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
                          roomBookings.length > 1 && { color: '#0284C7' },
                        ]}
                      >
                        {roomBookings.length === 0 ? 'Trống' : `${roomBookings.length} lịch đặt`}
                      </Text>
                    </View>

                    {canExpand && (
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={15}
                        color={isDark ? '#38BDF8' : '#0284C7'}
                        style={{ marginLeft: 6 }}
                      />
                    )}
                  </View>
                </TouchableOpacity>

                {/* Stays in this room */}
                {roomBookings.length === 0 ? (
                  <View style={styles.timelineEmptyBox}>
                    <Ionicons name="sparkles" size={12} color="#059669" style={{ marginRight: 6 }} />
                    <Text style={[styles.timelineEmptyText, !isDark && { color: '#64748B' }]}>Phòng trống trong suốt tháng {timelineMonth}</Text>
                  </View>
                ) : (
                  <View>
                    {/* Primary Active Stay */}
                    {activeBooking && (
                      <View
                        style={[
                          styles.activeBookingWrapper,
                          !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
                        ]}
                      >
                        <View style={[styles.priorityBanner, !isDark && { backgroundColor: '#F1F5F9', borderBottomColor: '#E2E8F0' }]}>
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
                                  ? '#059669'
                                  : activeBooking.status === 'confirmed'
                                  ? '#D97706'
                                  : '#0284C7'
                              }
                              style={{ marginRight: 5 }}
                            />
                            <Text
                              style={[
                                styles.priorityBannerText,
                                activeBooking.status === 'checked_in' && { color: '#059669' },
                                activeBooking.status === 'confirmed' && { color: '#D97706' },
                                activeBooking.status !== 'checked_in' && activeBooking.status !== 'confirmed' && { color: '#0284C7' },
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
                              <Ionicons name="person-outline" size={13} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 4 }} />
                              <Text style={[styles.primaryGuestName, !isDark && { color: '#0F172A' }]} numberOfLines={1}>
                                {activeBooking.guest_name}
                              </Text>
                              {activeBooking.booking_code && (
                                <Text style={[styles.stayBookingCode, !isDark && { color: '#64748B' }]}>#{activeBooking.booking_code}</Text>
                              )}
                            </View>

                            {activeBooking.group_name ? (
                              <View style={styles.groupTag}>
                                <Ionicons name="people" size={10} color="#D97706" style={{ marginRight: 3 }} />
                                <Text style={[styles.groupTagText, !isDark && { color: '#B45309' }]} numberOfLines={1}>
                                  {activeBooking.group_name}
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, justifyContent: 'space-between' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="calendar-outline" size={12} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 4 }} />
                              <Text style={[styles.stayDates, !isDark && { color: '#64748B' }]}>
                                {activeBooking.check_in_date} → {activeBooking.check_out_date} ({activeBooking.nights} đêm)
                              </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              {activeBooking.guest_phone ? (
                                <TouchableOpacity
                                  style={styles.phonePillSmall}
                                  onPress={() => safeOpenUrl(`tel:${activeBooking.guest_phone}`, 'Thiết bị không hỗ trợ thực hiện cuộc gọi.')}
                                >
                                  <Ionicons name="call" size={10} color="#059669" style={{ marginRight: 3 }} />
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
                                  <Ionicons name="person-circle-outline" size={12} color="#D97706" />
                                  <Text style={[styles.crmShortcutTextSmall, !isDark && { color: '#B45309' }]}>CRM</Text>
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
                          <Text style={[styles.otherBookingsHeaderText, !isDark && { color: '#64748B' }]}>
                            Các lịch đặt khác trong tháng ({otherBookings.length}):
                          </Text>
                        </View>
                        {otherBookings.map((bk: any) => {
                          const badge = getStatusBadge(bk.status);
                          return (
                            <View
                              key={bk.id || bk.booking_code}
                              style={[
                                styles.stayItemCard,
                                !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
                              ]}
                            >
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                                  <Ionicons name="person-outline" size={12} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 4 }} />
                                  <Text style={[styles.stayGuestName, !isDark && { color: '#0F172A' }]} numberOfLines={1}>
                                    {bk.guest_name}
                                  </Text>
                                  {bk.booking_code ? (
                                    <Text style={[styles.stayBookingCode, !isDark && { color: '#64748B' }]}>#{bk.booking_code}</Text>
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
                                  <Ionicons name="calendar-outline" size={11} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 4 }} />
                                  <Text style={[styles.stayDates, !isDark && { color: '#64748B' }]}>
                                    {bk.check_in_date} → {bk.check_out_date} ({bk.nights} đêm)
                                  </Text>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  {bk.guest_phone ? (
                                    <TouchableOpacity
                                      style={{ flexDirection: 'row', alignItems: 'center' }}
                                      onPress={() => safeOpenUrl(`tel:${bk.guest_phone}`, 'Thiết bị không hỗ trợ thực hiện cuộc gọi.')}
                                    >
                                      <Ionicons name="call" size={10} color="#059669" style={{ marginRight: 3 }} />
                                      <Text style={[styles.stayDates, { color: '#0284C7', fontSize: 10.5 }]}>
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
                                      <Ionicons name="person-circle-outline" size={11} color="#D97706" />
                                      <Text style={[styles.crmShortcutTextSmall, !isDark && { color: '#B45309' }]}>CRM</Text>
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
                          color={isExpanded ? (isDark ? '#94A3B8' : '#64748B') : '#0284C7'}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.roomExpandToggleText, isExpanded && { color: isDark ? '#94A3B8' : '#64748B' }, !isDark && !isExpanded && { color: '#0284C7' }]}>
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
  );
}

