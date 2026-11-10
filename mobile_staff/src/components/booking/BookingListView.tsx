import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { styles } from './styles';
import { BookingListViewProps, getStatusBadge } from './types';

export default function BookingListView({
  bookings,
  loading,
  isDark,
  onSelectGuest,
}: BookingListViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(15);
  const [loadingMore, setLoadingMore] = useState(false);

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

  return (
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
              style={[
                styles.kpiCard,
                !isDark && !isSelected && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                isSelected && styles.kpiCardActive,
              ]}
              onPress={() => {
                setStatusFilter(item.key);
                Haptics.selectionAsync();
              }}
            >
              <Text
                style={[
                  styles.kpiNumber,
                  { color: isSelected ? '#F59E0B' : (!isDark && item.color === '#F8FAFC' ? '#0F172A' : item.color) },
                ]}
              >
                {item.count}
              </Text>
              <Text
                style={[
                  styles.kpiLabel,
                  !isDark && !isSelected && { color: '#64748B' },
                  isSelected && styles.kpiLabelActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search Box */}
      <View
        style={[
          styles.searchBox,
          !isDark && { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' },
        ]}
      >
        <Ionicons name="search-outline" size={17} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, !isDark && { color: '#0F172A' }]}
          placeholder="Tìm mã đặt phòng, tên khách, số phòng, SĐT..."
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={isDark ? '#94A3B8' : '#64748B'} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={[styles.loadingText, !isDark && { color: '#64748B' }]}>Đang tải danh sách đặt phòng...</Text>
        </View>
      ) : filteredBookings.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="document-text-outline" size={48} color={isDark ? '#475569' : '#CBD5E1'} />
          <Text style={[styles.emptyText, !isDark && { color: '#64748B' }]}>Không tìm thấy đơn đặt phòng phù hợp</Text>
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
              <View
                key={b.id || b.booking_code}
                style={[
                  styles.bookingCard,
                  !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                ]}
              >
                {/* Top Card Line */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.bookingCode, !isDark && { color: '#0284C7' }]}>#{b.booking_code}</Text>
                    {b.room_number ? (
                      <View
                        style={[
                          styles.roomBadge,
                          !isDark && { backgroundColor: 'rgba(2, 132, 199, 0.12)' },
                        ]}
                      >
                        <Text style={[styles.roomBadgeText, !isDark && { color: '#0284C7' }]}>P.{b.room_number}</Text>
                      </View>
                    ) : (
                      <View style={[styles.roomBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                        <Text style={[styles.roomBadgeText, { color: '#DC2626' }]}>Chưa xếp</Text>
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
                <Text style={[styles.roomNameText, !isDark && { color: '#0F172A' }]}>
                  {b.room_name || b.category_name || 'Phòng tiêu chuẩn'}
                </Text>

                {/* Guest Info Row */}
                <View style={styles.guestRow}>
                  <Ionicons name="person" size={14} color="#0284C7" style={{ marginRight: 6 }} />
                  <Text style={[styles.guestNameText, !isDark && { color: '#0284C7' }]}>{b.guest_name || 'Khách vãng lai'}</Text>
                  {b.guest_phone ? (
                    <TouchableOpacity
                      style={styles.phonePill}
                      onPress={() => Linking.openURL(`tel:${b.guest_phone}`)}
                    >
                      <Ionicons name="call" size={12} color="#059669" style={{ marginRight: 4 }} />
                      <Text style={styles.phonePillText}>{b.guest_phone}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Stay Dates */}
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={13} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 6 }} />
                  <Text style={[styles.dateText, !isDark && { color: '#64748B' }]}>
                    {b.check_in_date} → {b.check_out_date}
                  </Text>
                </View>

                {/* Bottom Row: Total amount & Quick CRM shortcut */}
                <View style={[styles.bottomCardRow, !isDark && { borderTopColor: '#E2E8F0' }]}>
                  <View>
                    <Text style={[styles.priceLabel, !isDark && { color: '#64748B' }]}>Tổng tiền:</Text>
                    <Text style={[styles.priceValue, !isDark && { color: '#059669' }]}>{priceFormatted}</Text>
                  </View>

                  {guestId && onSelectGuest ? (
                    <TouchableOpacity
                      style={styles.crmShortcutBtn}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onSelectGuest(guestId);
                      }}
                    >
                      <Ionicons name="person-circle-outline" size={15} color="#D97706" />
                      <Text style={[styles.crmShortcutText, !isDark && { color: '#B45309' }]}>Hồ sơ CRM</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

