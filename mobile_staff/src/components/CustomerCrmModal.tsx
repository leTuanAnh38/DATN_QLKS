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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../api/client';
import { DEFAULT_API_URL } from '../api/config';
import { useAppTheme } from '../contexts/ThemeContext';

// Helper lấy URL ảnh dịch vụ / món ăn
const getServiceItemImage = (item: any): string => {
  const raw =
    item?.service_image ||
    item?.service?.image ||
    item?.service?.image_url ||
    item?.display_image ||
    item?.image_url ||
    item?.image;
  if (!raw || typeof raw !== 'string') {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80';
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  const base = (apiClient.defaults.baseURL || DEFAULT_API_URL || '').replace(/\/api\/?$/, '');
  return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

interface CustomerCrmModalProps {
  visible: boolean;
  onClose: () => void;
  initialGuestId?: number | null;
}

export default function CustomerCrmModal({
  visible,
  onClose,
  initialGuestId,
}: CustomerCrmModalProps) {
  const { isDark } = useAppTheme();
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');

  // Selected Guest Detail View
  const [selectedGuest, setSelectedGuest] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<'bookings' | 'services'>('bookings');
  const [bookingHistory, setBookingHistory] = useState<any[]>([]);
  const [serviceHistory, setServiceHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchGuests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/auth/admin/guests/?no_page=true');
      const list = res.data.guests || res.data.results || res.data.data || res.data || [];
      setGuests(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.warn('Lỗi tải danh sách khách hàng CRM:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const openGuestDetail = async (guestItem: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGuest(guestItem);
    setActiveTab('bookings');
    setVisibleHistoryBookingsCount(10);
    setVisibleHistoryServicesCount(10);
    setLoadingDetail(true);
    setLoadingHistory(true);

    try {
      const [resDetail, resBookings, resServices] = await Promise.all([
        apiClient.get(`/users/${guestItem.id}/`).catch(() => null),
        apiClient.get(`/bookings/?guest_id=${guestItem.id}&no_page=true`).catch(() => null),
        apiClient.get(`/services/requests/?guest_id=${guestItem.id}&no_page=true`).catch(() => null),
      ]);

      if (resDetail && resDetail.data) {
        const d = resDetail.data.user || resDetail.data.guest || resDetail.data;
        setSelectedGuest((prev: any) => ({ ...prev, ...d }));
      }

      const bList = resBookings?.data?.results || resBookings?.data?.bookings || resBookings?.data || [];
      setBookingHistory(Array.isArray(bList) ? bList : []);

      const sList = resServices?.data?.results || resServices?.data?.requests || resServices?.data || [];
      setServiceHistory(Array.isArray(sList) ? sList : []);
    } catch (e) {
      console.warn('Lỗi tải chi tiết khách hàng:', e);
    } finally {
      setLoadingDetail(false);
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchGuests();
      if (initialGuestId) {
        openGuestDetail({ id: initialGuestId });
      } else {
        setSelectedGuest(null);
      }
    }
  }, [visible, initialGuestId, fetchGuests]);

  const filteredGuests = useMemo(() => {
    return guests.filter((g) => {
      // 1. VIP Tier filter
      if (tierFilter !== 'all') {
        const tier = (g.vip_tier || g.current_tier?.name || '').toLowerCase();
        if (!tier.includes(tierFilter.toLowerCase())) return false;
      }
      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = g.full_name && g.full_name.toLowerCase().includes(q);
        const matchPhone = g.phone_number && g.phone_number.includes(q);
        const matchEmail = g.email && g.email.toLowerCase().includes(q);
        const matchId = g.id_card_number && g.id_card_number.includes(q);
        if (!matchName && !matchPhone && !matchEmail && !matchId) return false;
      }
      return true;
    });
  }, [guests, tierFilter, searchQuery]);

  // Infinite Scroll cho Danh sách khách hàng
  const [visibleCount, setVisibleCount] = useState(15);
  const [loadingMore, setLoadingMore] = useState(false);

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
          <Text style={styles.loadMoreText}>Đang tải thêm khách hàng cũ...</Text>
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

  // Infinite Scroll cho Lịch sử Đặt phòng & Dịch vụ trong chi tiết khách
  const [visibleHistoryBookingsCount, setVisibleHistoryBookingsCount] = useState(10);
  const [visibleHistoryServicesCount, setVisibleHistoryServicesCount] = useState(10);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);

  const displayedBookingHistory = useMemo(() => {
    return bookingHistory.slice(0, visibleHistoryBookingsCount);
  }, [bookingHistory, visibleHistoryBookingsCount]);

  const displayedServiceHistory = useMemo(() => {
    return serviceHistory.slice(0, visibleHistoryServicesCount);
  }, [serviceHistory, visibleHistoryServicesCount]);

  const handleLoadMoreHistory = () => {
    if (loadingMoreHistory) return;

    if (activeTab === 'bookings') {
      if (visibleHistoryBookingsCount >= bookingHistory.length) return;
      setLoadingMoreHistory(true);
      setTimeout(() => {
        setVisibleHistoryBookingsCount((prev) => Math.min(prev + 10, bookingHistory.length));
        setLoadingMoreHistory(false);
      }, 250);
    } else {
      if (visibleHistoryServicesCount >= serviceHistory.length) return;
      setLoadingMoreHistory(true);
      setTimeout(() => {
        setVisibleHistoryServicesCount((prev) => Math.min(prev + 10, serviceHistory.length));
        setLoadingMoreHistory(false);
      }, 250);
    }
  };

  const renderHistoryFooter = (visibleCount: number, totalCount: number, label: string) => {
    if (totalCount <= 10) return <View style={{ height: 15 }} />;
    if (loadingMoreHistory) {
      return (
        <View style={styles.loadMoreFooter}>
          <ActivityIndicator size="small" color="#F59E0B" />
          <Text style={styles.loadMoreText}>Đang tải thêm {label} cũ hơn...</Text>
        </View>
      );
    }
    if (visibleCount >= totalCount) {
      return (
        <View style={styles.endOfListFooter}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.endOfListText}>Đã hiển thị toàn bộ {totalCount} {label}</Text>
        </View>
      );
    }
    return (
      <TouchableOpacity
        style={styles.endOfListFooter}
        activeOpacity={0.7}
        onPress={handleLoadMoreHistory}
      >
        <Text style={styles.loadMoreHintText}>
          Đang xem {visibleCount}/{totalCount} {label} • Cuộn hoặc chạm để tải thêm
        </Text>
      </TouchableOpacity>
    );
  };

  const callPhone = (phone: string) => {
    if (!phone) {
      Alert.alert('Chưa có số', 'Khách hàng này chưa cập nhật số điện thoại.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const getTierBadge = (tier: string = '') => {
    const t = tier.toLowerCase();
    if (t.includes('diamond') || t.includes('kim cương')) {
      return { label: 'Kim Cương 💎', bg: 'rgba(56, 189, 248, 0.15)', text: '#38BDF8', border: 'rgba(56, 189, 248, 0.4)' };
    }
    if (t.includes('gold') || t.includes('vàng')) {
      return { label: 'Vàng 🥇', bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.4)' };
    }
    if (t.includes('silver') || t.includes('bạc')) {
      return { label: 'Bạc 🥈', bg: 'rgba(148, 163, 184, 0.15)', text: '#CBD5E1', border: 'rgba(148, 163, 184, 0.4)' };
    }
    return { label: 'Đồng 🥉', bg: 'rgba(180, 83, 9, 0.15)', text: '#D97706', border: 'rgba(180, 83, 9, 0.4)' };
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            !isDark && {
              backgroundColor: '#FFFFFF',
              borderTopColor: '#E2E8F0',
              shadowColor: '#64748B',
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.headerRow, !isDark && { borderBottomColor: '#F1F5F9' }]}>
            {selectedGuest ? (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  setSelectedGuest(null);
                  Haptics.selectionAsync();
                }}
              >
                <Ionicons name="arrow-back" size={20} color="#D97706" />
                <Text style={[styles.backBtnText, !isDark && { color: '#B45309' }]}>Danh sách khách</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <Text style={[styles.headerTitle, !isDark && { color: '#0F172A' }]}>Hồ Sơ Khách Hàng (CRM) 👥</Text>
                <Text style={[styles.headerSubtitle, !isDark && { color: '#64748B' }]}>Tra cứu thông tin, lịch sử đặt phòng & dịch vụ</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.closeBtn, !isDark && { backgroundColor: '#F1F5F9' }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#475569'} />
            </TouchableOpacity>
          </View>

          {/* VIEW 1: GUEST LIST DIRECTORY */}
          {!selectedGuest ? (
            <View style={{ flex: 1 }}>
              {/* VIP Tier Pills */}
              <View style={styles.tierFilterWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tierScrollContent}
                  style={styles.tierScrollView}
                >
                  {[
                    { key: 'all', label: 'Tất cả' },
                    { key: 'diamond', label: '💎 Kim Cương' },
                    { key: 'gold', label: '🥇 Vàng' },
                    { key: 'silver', label: '🥈 Bạc' },
                    { key: 'bronze', label: '🥉 Đồng' },
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
                    const tierBadge = getTierBadge(g.vip_tier || g.current_tier?.name);
                    const spendFormatted = g.total_spent ? `${parseInt(g.total_spent, 10).toLocaleString('vi-VN')} đ` : '0 đ';
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
                        onPress={() => openGuestDetail(g)}
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
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={[styles.guestName, !isDark && { color: '#0F172A' }]} numberOfLines={1}>
                              {g.full_name || g.username}
                            </Text>
                            <View style={[styles.tierBadge, { backgroundColor: tierBadge.bg, borderColor: tierBadge.border }]}>
                              <Text style={[styles.tierBadgeText, { color: tierBadge.text }]}>{tierBadge.label}</Text>
                            </View>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <Ionicons name="call-outline" size={13} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 4 }} />
                            <Text style={[styles.guestSubInfo, !isDark && { color: '#64748B' }]}>{g.phone_number || 'Chưa có SĐT'}</Text>
                            <Text style={[styles.dotSeparator, !isDark && { color: '#CBD5E1' }]}>•</Text>
                            <Text style={[styles.guestSpendText, !isDark && { color: '#059669' }]}>Chi: {spendFormatted}</Text>
                          </View>
                        </View>

                        <Ionicons name="chevron-forward" size={18} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginLeft: 6 }} />
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>
          ) : (
            /* VIEW 2: GUEST PROFILE DETAIL & HISTORY */
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 35 }}
              onScroll={({ nativeEvent }) => {
                const paddingToBottom = 80;
                const isCloseToBottom =
                  nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >=
                  nativeEvent.contentSize.height - paddingToBottom;
                if (isCloseToBottom) {
                  handleLoadMoreHistory();
                }
              }}
              scrollEventThrottle={200}
            >
              {/* Profile Header Card */}
              <View
                style={[
                  styles.profileHeaderCard,
                  !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.avatarCircle, { width: 56, height: 56, borderRadius: 28 }, !isDark && { backgroundColor: '#E2E8F0' }]}>
                    {selectedGuest.avatar ? (
                      <Image source={{ uri: selectedGuest.avatar }} style={{ width: 56, height: 56, borderRadius: 28 }} />
                    ) : (
                      <Text style={[styles.avatarInitial, { fontSize: 22 }, !isDark && { color: '#D97706' }]}>
                        {(selectedGuest.full_name || selectedGuest.username || 'K').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.profileName, !isDark && { color: '#0F172A' }]} numberOfLines={1}>
                      {selectedGuest.full_name || selectedGuest.username}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <View style={[styles.tierBadge, { backgroundColor: getTierBadge(selectedGuest.vip_tier).bg, borderColor: getTierBadge(selectedGuest.vip_tier).border }]}>
                        <Text style={[styles.tierBadgeText, { color: getTierBadge(selectedGuest.vip_tier).text }]}>
                          {getTierBadge(selectedGuest.vip_tier).label}
                        </Text>
                      </View>
                      {selectedGuest.loyalty_points || selectedGuest.total_points ? (
                        <Text style={[styles.pointsText, !isDark && { color: '#D97706' }]}>
                          ⭐ {selectedGuest.loyalty_points || selectedGuest.total_points} điểm
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Quick Info Grid */}
                <View style={[styles.profileInfoGrid, !isDark && { borderTopColor: '#E2E8F0' }]}>
                  <TouchableOpacity
                    style={styles.infoRow}
                    onPress={() => selectedGuest.phone_number && callPhone(selectedGuest.phone_number)}
                  >
                    <Ionicons name="call" size={15} color="#059669" style={{ marginRight: 8 }} />
                    <Text style={[styles.infoValue, { color: '#0284C7', fontWeight: '700' }]}>
                      {selectedGuest.phone_number || 'Chưa cập nhật SĐT'}
                    </Text>
                    {selectedGuest.phone_number && (
                      <View style={styles.quickCallPill}>
                        <Text style={styles.quickCallPillText}>Gọi ngay</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.infoRow}>
                    <Ionicons name="mail" size={15} color="#0284C7" style={{ marginRight: 8 }} />
                    <Text style={[styles.infoValue, !isDark && { color: '#334155' }]} numberOfLines={1}>
                      {selectedGuest.email || 'Chưa cập nhật email'}
                    </Text>
                  </View>

                  {selectedGuest.id_card_number ? (
                    <View style={styles.infoRow}>
                      <Ionicons name="card" size={15} color="#D97706" style={{ marginRight: 8 }} />
                      <Text style={[styles.infoValue, !isDark && { color: '#334155' }]}>
                        CCCD/Hộ chiếu: {selectedGuest.id_card_number}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.infoRow}>
                    <Ionicons name="cash" size={15} color="#059669" style={{ marginRight: 8 }} />
                    <Text style={[styles.infoValue, { color: '#059669', fontWeight: '800' }]}>
                      Tổng chi tiêu tích lũy: {selectedGuest.total_spent ? `${parseInt(selectedGuest.total_spent, 10).toLocaleString('vi-VN')} đ` : '0 đ'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* History Switcher Tabs */}
              <View style={styles.historyTabRow}>
                <TouchableOpacity
                  style={[
                    styles.historyTabBtn,
                    !isDark && activeTab !== 'bookings' && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                    activeTab === 'bookings' && styles.historyTabBtnActive,
                  ]}
                  onPress={() => {
                    setActiveTab('bookings');
                    Haptics.selectionAsync();
                  }}
                >
                  <Ionicons
                    name="bed"
                    size={15}
                    color={activeTab === 'bookings' ? '#0A0F1D' : isDark ? '#94A3B8' : '#64748B'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.historyTabText,
                      !isDark && activeTab !== 'bookings' && { color: '#64748B' },
                      activeTab === 'bookings' && styles.historyTabTextActive,
                    ]}
                  >
                    Lịch sử đặt phòng ({bookingHistory.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.historyTabBtn,
                    !isDark && activeTab !== 'services' && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                    activeTab === 'services' && styles.historyTabBtnActive,
                  ]}
                  onPress={() => {
                    setActiveTab('services');
                    Haptics.selectionAsync();
                  }}
                >
                  <Ionicons
                    name="restaurant"
                    size={15}
                    color={activeTab === 'services' ? '#0A0F1D' : isDark ? '#94A3B8' : '#64748B'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.historyTabText,
                      !isDark && activeTab !== 'services' && { color: '#64748B' },
                      activeTab === 'services' && styles.historyTabTextActive,
                    ]}
                  >
                    Dịch vụ & Món ({serviceHistory.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* History Content */}
              {loadingHistory ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator size="small" color="#F59E0B" />
                  <Text style={[styles.loadingText, !isDark && { color: '#64748B' }]}>Đang tải lịch sử...</Text>
                </View>
              ) : activeTab === 'bookings' ? (
                displayedBookingHistory.length === 0 ? (
                  <View style={styles.centerBox}>
                    <Text style={[styles.emptyText, !isDark && { color: '#64748B' }]}>Chưa có lịch sử đặt phòng nào.</Text>
                  </View>
                ) : (
                  <>
                    {displayedBookingHistory.map((b) => (
                      <View
                        key={b.id || b.booking_code}
                        style={[
                          styles.historyCard,
                          !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={[styles.historyCode, !isDark && { color: '#0284C7' }]}>#{b.booking_code}</Text>
                          <View
                            style={[
                              styles.historyStatusBadge,
                              !isDark && { backgroundColor: 'rgba(2, 132, 199, 0.12)' },
                            ]}
                          >
                            <Text style={[styles.historyStatusText, !isDark && { color: '#0284C7' }]}>{b.status_display || b.status}</Text>
                          </View>
                        </View>
                        <Text style={[styles.historyRoomName, !isDark && { color: '#0F172A' }]}>
                          Phòng: {b.room_number ? `P.${b.room_number}` : 'Chưa xếp'} • {b.room_name || 'Phòng Deluxe'}
                        </Text>
                        <Text style={[styles.historyDates, !isDark && { color: '#64748B' }]}>
                          📅 {b.check_in_date} ➔ {b.check_out_date}
                        </Text>
                        <Text style={[styles.historyPrice, !isDark && { color: '#059669' }]}>
                          Tổng tiền: {b.total_amount ? `${parseInt(b.total_amount, 10).toLocaleString('vi-VN')} đ` : '—'}
                        </Text>
                      </View>
                    ))}
                    {renderHistoryFooter(visibleHistoryBookingsCount, bookingHistory.length, 'lịch đặt')}
                  </>
                )
              ) : (
                displayedServiceHistory.length === 0 ? (
                  <View style={styles.centerBox}>
                    <Text style={[styles.emptyText, !isDark && { color: '#64748B' }]}>Chưa có lịch sử dùng dịch vụ nào.</Text>
                  </View>
                ) : (
                  <>
                    {displayedServiceHistory.map((s) => (
                      <View
                        key={s.id}
                        style={[
                          styles.historyCard,
                          !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View
                            style={[
                              styles.historyThumbBox,
                              !isDark && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
                            ]}
                          >
                            <Image
                              source={{ uri: getServiceItemImage(s) }}
                              style={styles.historyThumbImg}
                              resizeMode="cover"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={[styles.historyServiceName, !isDark && { color: '#0F172A' }]}>{s.service_name}</Text>
                              <Text style={[styles.historyQty, !isDark && { color: '#D97706' }]}>x{s.quantity}</Text>
                            </View>
                            <Text style={[styles.historySub, !isDark && { color: '#64748B' }]}>
                              Phòng: P.{s.room_number || '—'} • {s.category_name || 'Dịch vụ'}
                            </Text>
                            {s.created_at ? (
                              <Text style={[styles.historyDates, !isDark && { color: '#64748B' }]}>
                                ⏰ Đặt: {new Date(s.created_at).toLocaleString('vi-VN')}
                              </Text>
                            ) : null}
                            {s.is_scheduled && s.request_time ? (
                              <Text style={[styles.historyDates, { color: '#D97706', fontWeight: '700' }]}>
                                📅 Hẹn giao: {new Date(s.request_time).toLocaleString('vi-VN')}
                              </Text>
                            ) : null}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                              <Text style={[styles.historyPrice, !isDark && { color: '#059669' }]}>
                                {s.total_price ? `${parseInt(s.total_price, 10).toLocaleString('vi-VN')} đ` : 'Miễn phí'}
                              </Text>
                              <Text style={[styles.historyStatusText, { color: '#059669' }]}>
                                {s.status_display || s.status}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    ))}
                    {renderHistoryFooter(visibleHistoryServicesCount, serviceHistory.length, 'dịch vụ')}
                  </>
                )
              )}
            </ScrollView>
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
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 10,
  },
  backBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#F59E0B',
    marginLeft: 6,
  },
  tierFilterWrapper: {
    height: 44,
    marginBottom: 10,
    justifyContent: 'center',
  },
  tierScrollView: {
    flexGrow: 0,
  },
  tierScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  tierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tierChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  tierChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  tierChipTextActive: {
    color: '#0A0F1D',
    fontWeight: '900',
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
  guestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F59E0B',
  },
  guestName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#F8FAFC',
    flex: 1,
  },
  guestSubInfo: {
    fontSize: 11,
    color: '#94A3B8',
  },
  dotSeparator: {
    fontSize: 11,
    color: '#475569',
    marginHorizontal: 5,
  },
  guestSpendText: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '700',
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  profileHeaderCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  pointsText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '700',
    marginLeft: 8,
  },
  profileInfoGrid: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoValue: {
    fontSize: 12,
    color: '#CBD5E1',
    flex: 1,
  },
  quickCallPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  quickCallPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
  },
  historyTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  historyTabBtn: {
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
  historyTabBtnActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  historyTabText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  historyTabTextActive: {
    color: '#0A0F1D',
    fontWeight: '900',
  },
  historyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyCode: {
    fontSize: 12,
    fontWeight: '900',
    color: '#38BDF8',
  },
  historyStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  historyStatusText: {
    fontSize: 10.5,
    color: '#CBD5E1',
    fontWeight: '700',
  },
  historyRoomName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 4,
  },
  historyDates: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  historyPrice: {
    fontSize: 12,
    color: '#34D399',
    fontWeight: '800',
    marginTop: 4,
  },
  historyThumbBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  historyThumbImg: {
    width: '100%',
    height: '100%',
  },
  historyServiceName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  historyQty: {
    fontSize: 12,
    fontWeight: '900',
    color: '#F59E0B',
  },
  historySub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
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
