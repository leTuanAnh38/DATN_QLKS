import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { styles } from './styles';
import { GuestListViewProps } from './types';
import { isWalkinGuest, getTierBadge } from './helpers';

export default function GuestListView({
  guests,
  loading,
  isDark,
  onSelectGuest,
}: GuestListViewProps) {
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(15);
  const [loadingMore, setLoadingMore] = useState(false);

  const filteredGuests = useMemo(() => {
    return guests.filter((g) => {
      // 1. VIP Tier / Walk-in filter
      if (tierFilter !== 'all') {
        if (tierFilter === 'walkin') {
          if (!isWalkinGuest(g)) return false;
        } else {
          const tier = (g.vip_tier || g.current_tier?.name || g.guest_profile?.vip_tier || '').toLowerCase();
          if (!tier.includes(tierFilter.toLowerCase())) return false;
        }
      }
      // 2. Search query (Hỗ trợ Tên, SĐT, Email và cả CCCD từ guest_profile)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = g.full_name && g.full_name.toLowerCase().includes(q);
        const matchPhone = g.phone_number && g.phone_number.includes(q);
        const matchEmail = g.email && g.email.toLowerCase().includes(q);
        const idCard = g.id_card_number || g.guest_profile?.id_card_number;
        const matchId = idCard && String(idCard).toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchEmail && !matchId) return false;
      }
      return true;
    });
  }, [guests, tierFilter, searchQuery]);

  useEffect(() => {
    setVisibleCount(15);
  }, [tierFilter, searchQuery]);

  const displayedGuests = useMemo(() => {
    return filteredGuests.slice(0, visibleCount);
  }, [filteredGuests, visibleCount]);

  const handleLoadMore = () => {
    if (loadingMore || visibleCount >= filteredGuests.length) return;
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 15, filteredGuests.length));
      setLoadingMore(false);
    }, 250);
  };

  const renderFooter = () => {
    if (filteredGuests.length <= 15) return <View style={{ height: 20 }} />;
    if (loadingMore) {
      return (
        <View style={styles.loadMoreFooter}>
          <ActivityIndicator size="small" color="#F59E0B" />
          <Text style={styles.loadMoreText}>Đang tải thêm khách hàng...</Text>
        </View>
      );
    }
    if (visibleCount >= filteredGuests.length) {
      return (
        <View style={styles.endOfListFooter}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.endOfListText}>Đã hiển thị toàn bộ {filteredGuests.length} hồ sơ khách hàng</Text>
        </View>
      );
    }
    return (
      <TouchableOpacity
        style={styles.endOfListFooter}
        activeOpacity={0.7}
        onPress={handleLoadMore}
      >
        <Text style={styles.loadMoreHintText}>
          Đang xem {visibleCount}/{filteredGuests.length} khách • Cuộn hoặc chạm để tải thêm
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* VIP Tier & Khách vãng lai Pills */}
      <View style={styles.tierFilterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tierScrollContent}
          style={styles.tierScrollView}
        >
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'walkin', label: 'Vãng lai' },
            { key: 'diamond', label: 'Kim Cương' },
            { key: 'gold', label: 'Vàng' },
            { key: 'silver', label: 'Bạc' },
            { key: 'bronze', label: 'Đồng' },
          ].map((item) => {
            const isSelected = tierFilter === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.tierChip,
                  !isDark && !isSelected && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                  isSelected && styles.tierChipActive,
                ]}
                onPress={() => {
                  setTierFilter(item.key);
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tierChipText,
                    !isDark && !isSelected && { color: '#64748B' },
                    isSelected && styles.tierChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
          placeholder="Tìm theo tên, SĐT, CCCD, email khách..."
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

      {/* Dòng tóm tắt số lượng kết quả tìm thấy */}
      <View style={styles.listCounterRow}>
        <Ionicons name="people-outline" size={13} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 5 }} />
        <Text style={[styles.listCounterText, !isDark && { color: '#64748B' }]}>
          Hiển thị <Text style={{ fontWeight: '800', color: isDark ? '#F59E0B' : '#D97706' }}>{filteredGuests.length}</Text> hồ sơ khách hàng
        </Text>
      </View>

      {/* Guests List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={[styles.loadingText, !isDark && { color: '#64748B' }]}>Đang tải danh sách khách hàng...</Text>
        </View>
      ) : filteredGuests.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="people-outline" size={48} color={isDark ? '#475569' : '#CBD5E1'} />
          <Text style={[styles.emptyText, !isDark && { color: '#64748B' }]}>Không tìm thấy khách hàng nào</Text>
        </View>
      ) : (
        <FlatList
          data={displayedGuests}
          keyExtractor={(g) => String(g.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.2}
          ListFooterComponent={renderFooter}
          renderItem={({ item: g }) => {
            const tierBadge = getTierBadge(g.vip_tier || g.current_tier?.name || g.guest_profile?.vip_tier, isDark);
            const spendFormatted = g.total_spent ? `${parseInt(g.total_spent, 10).toLocaleString('vi-VN')} đ` : '0 đ';
            const pref = g.preferences || g.guest_profile?.preferences;
            const isWalkin = isWalkinGuest(g);

            return (
              <TouchableOpacity
                key={g.id}
                style={[
                  styles.guestCard,
                  !isDark && {
                    backgroundColor: '#F8FAFC',
                    borderColor: '#E2E8F0',
                  },
                ]}
                onPress={() => onSelectGuest(g)}
                activeOpacity={0.7}
              >
                <View style={[styles.avatarCircle, !isDark && { backgroundColor: '#E2E8F0' }]}>
                  {g.avatar ? (
                    <Image source={{ uri: g.avatar }} style={styles.avatarImg} />
                  ) : (
                    <Text style={[styles.avatarInitial, !isDark && { color: '#D97706' }]}>
                      {(g.full_name || g.username || 'K').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  {/* Tên khách + Huy hiệu Khách vãng lai & Hạng thẻ VIP */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <Text style={[styles.guestName, !isDark && { color: '#0F172A' }]} numberOfLines={1}>
                      {g.full_name || g.username}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      {/* Huy hiệu Khách vãng lai / Thành viên */}
                      <View
                        style={[
                          styles.guestTypeBadge,
                          isWalkin
                            ? {
                                backgroundColor: isDark ? 'rgba(249, 115, 22, 0.18)' : 'rgba(249, 115, 22, 0.12)',
                                borderColor: isDark ? 'rgba(249, 115, 22, 0.45)' : 'rgba(249, 115, 22, 0.35)',
                              }
                            : {
                                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.12)',
                                borderColor: isDark ? 'rgba(16, 185, 129, 0.45)' : 'rgba(16, 185, 129, 0.35)',
                              },
                        ]}
                      >
                        <Ionicons
                          name={isWalkin ? 'walk' : 'shield-checkmark'}
                          size={10}
                          color={isWalkin ? (isDark ? '#FB923C' : '#EA580C') : (isDark ? '#34D399' : '#059669')}
                          style={{ marginRight: 2.5 }}
                        />
                        <Text
                          style={[
                            styles.guestTypeBadgeText,
                            { color: isWalkin ? (isDark ? '#FB923C' : '#EA580C') : (isDark ? '#34D399' : '#059669') },
                          ]}
                        >
                          {isWalkin ? 'Vãng lai' : 'Thành viên'}
                        </Text>
                      </View>

                      {/* Huy hiệu Hạng thẻ VIP */}
                      <View style={[styles.tierBadge, { backgroundColor: tierBadge.bg, borderColor: tierBadge.border }]}>
                        <Text style={[styles.tierBadgeText, { color: tierBadge.text }]}>{tierBadge.label}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                    <Ionicons name="call-outline" size={12} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 3 }} />
                    <Text style={[styles.guestSubInfo, !isDark && { color: '#64748B' }]}>{g.phone_number || 'Chưa có SĐT'}</Text>
                    <Text style={[styles.dotSeparator, !isDark && { color: '#CBD5E1' }]}>•</Text>
                    <Text style={[styles.guestSpendText, !isDark && { color: '#059669' }]}>Chi: {spendFormatted}</Text>
                    {g.total_bookings ? (
                      <>
                        <Text style={[styles.dotSeparator, !isDark && { color: '#CBD5E1' }]}>•</Text>
                        <Text style={[styles.guestStayText, !isDark && { color: '#0284C7' }]}>{g.total_bookings} lượt</Text>
                      </>
                    ) : null}
                  </View>

                  {/* Huy hiệu ghi chú sở thích nhanh nếu khách có ghi chú */}
                  {pref ? (
                    <View style={[styles.guestPrefBadge, !isDark && { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                      <Ionicons name="bulb-outline" size={11} color="#F59E0B" style={{ marginRight: 4 }} />
                      <Text style={[styles.guestPrefText, !isDark && { color: '#B45309' }]} numberOfLines={1}>
                        {pref}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Ionicons name="chevron-forward" size={18} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

