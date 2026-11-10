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

// Helper format ngày DD/MM/YYYY
const formatDateDisplay = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  try {
    const parts = String(dateStr).split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  } catch {}
  return String(dateStr);
};

// Helper format thời gian HH:mm • DD/MM/YYYY
const formatDateTimeDisplay = (isoStr?: string | null): string => {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr);
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${time} • ${date}`;
  } catch {
    return String(isoStr);
  }
};

// Helper nhận diện khách vãng lai (Offline / Walk-in) hay Thành viên Web
const isWalkinGuest = (guest: any): boolean => {
  if (!guest) return false;
  if (guest.guest_type === 'walkin') return true;
  if (guest.is_auto_created) return true;
  const username = String(guest.username || '').toLowerCase();
  const email = String(guest.email || '').toLowerCase();
  if (username.startsWith('walkin_')) return true;
  if (email.endsWith('.local') || email.includes('@walkin.')) return true;
  if (guest.has_usable_password === false) return true;
  return false;
};

// Config trạng thái đơn đặt phòng đồng bộ PMS Web
const getBookingStatusBadge = (status: string = '', statusDisplay?: string) => {
  const s = String(status).toLowerCase();
  if (s === 'checked_in') {
    return { label: statusDisplay || 'Đang ở', bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: 'rgba(16, 185, 129, 0.35)' };
  }
  if (s === 'confirmed') {
    return { label: statusDisplay || 'Đã xác nhận', bg: 'rgba(56, 189, 248, 0.15)', text: '#0284C7', border: 'rgba(56, 189, 248, 0.35)' };
  }
  if (s === 'pending') {
    return { label: statusDisplay || 'Chờ duyệt', bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.35)' };
  }
  if (s === 'checked_out') {
    return { label: statusDisplay || 'Đã trả phòng', bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7', border: 'rgba(168, 85, 247, 0.35)' };
  }
  if (s === 'completed') {
    return { label: statusDisplay || 'Hoàn tất', bg: 'rgba(100, 116, 139, 0.15)', text: '#64748B', border: 'rgba(100, 116, 139, 0.35)' };
  }
  if (s === 'cancelled') {
    return { label: statusDisplay || 'Đã hủy', bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.35)' };
  }
  return { label: statusDisplay || status, bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', border: 'rgba(148, 163, 184, 0.35)' };
};

// Config trạng thái dịch vụ đồng bộ Web
const getServiceStatusBadge = (status: string = '', statusDisplay?: string) => {
  const s = String(status).toLowerCase();
  if (s === 'completed') {
    return { label: statusDisplay || 'Hoàn thành', bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981', border: 'rgba(16, 185, 129, 0.35)' };
  }
  if (s === 'in_progress') {
    return { label: statusDisplay || 'Đang phục vụ', bg: 'rgba(56, 189, 248, 0.15)', text: '#0284C7', border: 'rgba(56, 189, 248, 0.35)' };
  }
  if (s === 'pending') {
    return { label: statusDisplay || 'Chờ xử lý', bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B', border: 'rgba(245, 158, 11, 0.35)' };
  }
  if (s === 'cancelled') {
    return { label: statusDisplay || 'Đã hủy', bg: 'rgba(239, 68, 68, 0.15)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.35)' };
  }
  return { label: statusDisplay || status, bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', border: 'rgba(148, 163, 184, 0.35)' };
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
        const d = resDetail.data.user || resDetail.data.guest || resDetail.data.customer || resDetail.data;
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

  const renderHistoryFooter = (visibleCnt: number, totalCnt: number, label: string) => {
    if (totalCnt <= 10) return <View style={{ height: 15 }} />;
    if (loadingMoreHistory) {
      return (
        <View style={styles.loadMoreFooter}>
          <ActivityIndicator size="small" color="#F59E0B" />
          <Text style={styles.loadMoreText}>Đang tải thêm {label} cũ hơn...</Text>
        </View>
      );
    }
    if (visibleCnt >= totalCnt) {
      return (
        <View style={styles.endOfListFooter}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.endOfListText}>Đã hiển thị toàn bộ {totalCnt} {label}</Text>
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
          Đang xem {visibleCnt}/{totalCnt} {label} • Cuộn hoặc chạm để tải thêm
        </Text>
      </TouchableOpacity>
    );
  };

  // Hành động nhanh: Gọi điện thoại
  const callPhone = (phone: string) => {
    if (!phone) {
      Alert.alert('Chưa có số', 'Khách hàng này chưa cập nhật số điện thoại.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  // Hành động nhanh: Gửi tin nhắn SMS
  const sendSms = (phone: string) => {
    if (!phone) {
      Alert.alert('Chưa có số', 'Khách hàng này chưa cập nhật số điện thoại.');
      return;
    }
    Linking.openURL(`sms:${phone}`);
  };

  // Hành động nhanh: Gửi email
  const sendEmail = (email: string) => {
    if (!email) {
      Alert.alert('Chưa có email', 'Khách hàng này chưa cập nhật địa chỉ email.');
      return;
    }
    Linking.openURL(`mailto:${email}`);
  };

  // Badge hạng thẻ VIP tối ưu độ tương phản cho cả Dark và Light mode
  const getTierBadge = (tier: string = '') => {
    const t = String(tier).toLowerCase();
    if (t.includes('diamond') || t.includes('kim cương')) {
      return {
        label: 'Kim Cương',
        bg: isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 132, 199, 0.12)',
        text: isDark ? '#38BDF8' : '#0284C7',
        border: isDark ? 'rgba(56, 189, 248, 0.55)' : 'rgba(2, 132, 199, 0.4)',
      };
    }
    if (t.includes('gold') || t.includes('vàng')) {
      return {
        label: 'Vàng',
        bg: isDark ? 'rgba(245, 158, 11, 0.22)' : 'rgba(217, 119, 6, 0.12)',
        text: isDark ? '#FBBF24' : '#B45309',
        border: isDark ? 'rgba(245, 158, 11, 0.55)' : 'rgba(217, 119, 6, 0.4)',
      };
    }
    if (t.includes('silver') || t.includes('bạc')) {
      return {
        label: 'Bạc',
        // Tối ưu tương phản tuyệt đối cho Bạc (Silver) cả Dark & Light mode không bao giờ bị mờ:
        bg: isDark ? '#334155' : '#E2E8F0',
        text: isDark ? '#FFFFFF' : '#0F172A',
        border: isDark ? '#94A3B8' : '#94A3B8',
      };
    }
    return {
      label: 'Đồng',
      bg: isDark ? 'rgba(217, 119, 6, 0.22)' : 'rgba(180, 83, 9, 0.12)',
      text: isDark ? '#F59E0B' : '#92400E',
      border: isDark ? 'rgba(217, 119, 6, 0.55)' : 'rgba(180, 83, 9, 0.4)',
    };
  };

  // Trích xuất an toàn các thuộc tính hồ sơ chi tiết khách hàng
  const idCard = selectedGuest?.id_card_number || selectedGuest?.guest_profile?.id_card_number || '';
  const idType = selectedGuest?.id_type || selectedGuest?.guest_profile?.id_type || 'CCCD';
  const preferences = selectedGuest?.preferences || selectedGuest?.guest_profile?.preferences || '';
  const nationality = selectedGuest?.nationality || selectedGuest?.guest_profile?.nationality || '';
  const dateOfBirth = selectedGuest?.date_of_birth || selectedGuest?.guest_profile?.date_of_birth || '';
  const gender = selectedGuest?.gender || selectedGuest?.guest_profile?.gender || '';
  const address = selectedGuest?.address || '';
  const totalBookingsCount = selectedGuest?.total_bookings ?? bookingHistory.length;
  const totalSpentFormatted = selectedGuest?.total_spent
    ? `${parseInt(selectedGuest.total_spent, 10).toLocaleString('vi-VN')} đ`
    : '0 đ';
  const loyaltyPoints = selectedGuest?.loyalty_points ?? selectedGuest?.total_points ?? selectedGuest?.guest_profile?.loyalty_points ?? 0;
  const isSelectedWalkin = isWalkinGuest(selectedGuest);
  const hasRealEmail = selectedGuest?.email && !selectedGuest.email.toLowerCase().endsWith('.local') && !selectedGuest.email.toLowerCase().includes('@walkin.');

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
          {/* Thanh kéo vuốt xuống (Drag Handle Indicator) */}
          <View style={styles.dragHandleWrapper}>
            <View style={[styles.dragHandle, !isDark && { backgroundColor: '#CBD5E1' }]} />
          </View>

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
                <Ionicons name="arrow-back" size={18} color="#D97706" />
                <Text style={[styles.backBtnText, !isDark && { color: '#B45309' }]}>Danh sách khách</Text>
              </TouchableOpacity>
            ) : (
              <View>
                <Text style={[styles.headerTitle, !isDark && { color: '#0F172A' }]}>Hồ Sơ Khách Hàng (CRM)</Text>
                <Text style={[styles.headerSubtitle, !isDark && { color: '#64748B' }]}>Tra cứu thông tin, lịch sử đặt phòng & dịch vụ</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {selectedGuest && (
                <TouchableOpacity
                  style={[styles.closeBtn, !isDark && { backgroundColor: '#F1F5F9' }]}
                  onPress={() => openGuestDetail(selectedGuest)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="reload" size={16} color={isDark ? '#F59E0B' : '#D97706'} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.closeBtn, !isDark && { backgroundColor: '#F1F5F9' }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#475569'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* VIEW 1: GUEST LIST DIRECTORY */}
          {!selectedGuest ? (
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
                    const tierBadge = getTierBadge(g.vip_tier || g.current_tier?.name || g.guest_profile?.vip_tier);
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
              {loadingDetail ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator size="small" color="#F59E0B" />
                  <Text style={[styles.loadingText, !isDark && { color: '#64748B' }]}>Đang cập nhật hồ sơ khách...</Text>
                </View>
              ) : null}

              {/* 1. Thẻ Thông Tin Khách Hàng (Avatar to, Tên, Hạng VIP, Khách vãng lai, Điểm) */}
              <View
                style={[
                  styles.profileHeaderCard,
                  !isDark && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.avatarCircle, { width: 58, height: 58, borderRadius: 29 }, !isDark && { backgroundColor: '#E2E8F0' }]}>
                    {selectedGuest.avatar ? (
                      <Image source={{ uri: selectedGuest.avatar }} style={{ width: 58, height: 58, borderRadius: 29 }} />
                    ) : (
                      <Text style={[styles.avatarInitial, { fontSize: 24 }, !isDark && { color: '#D97706' }]}>
                        {(selectedGuest.full_name || selectedGuest.username || 'K').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.profileName, !isDark && { color: '#0F172A' }]} numberOfLines={1}>
                      {selectedGuest.full_name || selectedGuest.username}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, flexWrap: 'wrap', gap: 6 }}>
                      {/* Huy hiệu Phân loại Khách vãng lai / Thành viên */}
                      <View
                        style={[
                          styles.guestTypeBadgeDetail,
                          isSelectedWalkin
                            ? {
                                backgroundColor: isDark ? 'rgba(249, 115, 22, 0.2)' : 'rgba(249, 115, 22, 0.12)',
                                borderColor: isDark ? 'rgba(249, 115, 22, 0.5)' : 'rgba(249, 115, 22, 0.35)',
                              }
                            : {
                                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.12)',
                                borderColor: isDark ? 'rgba(16, 185, 129, 0.5)' : 'rgba(16, 185, 129, 0.35)',
                              },
                        ]}
                      >
                        <Ionicons
                          name={isSelectedWalkin ? 'walk' : 'shield-checkmark'}
                          size={11}
                          color={isSelectedWalkin ? (isDark ? '#FB923C' : '#EA580C') : (isDark ? '#34D399' : '#059669')}
                          style={{ marginRight: 3.5 }}
                        />
                        <Text
                          style={[
                            styles.guestTypeBadgeTextDetail,
                            { color: isSelectedWalkin ? (isDark ? '#FB923C' : '#EA580C') : (isDark ? '#34D399' : '#059669') },
                          ]}
                        >
                          {isSelectedWalkin ? 'Khách vãng lai (Tại quầy)' : 'Thành viên hệ thống'}
                        </Text>
                      </View>

                      {/* Huy hiệu Hạng thẻ VIP */}
                      <View style={[styles.tierBadge, { backgroundColor: getTierBadge(selectedGuest.vip_tier || selectedGuest.current_tier?.name).bg, borderColor: getTierBadge(selectedGuest.vip_tier || selectedGuest.current_tier?.name).border }]}>
                        <Text style={[styles.tierBadgeText, { color: getTierBadge(selectedGuest.vip_tier || selectedGuest.current_tier?.name).text }]}>
                          {getTierBadge(selectedGuest.vip_tier || selectedGuest.current_tier?.name).label}
                        </Text>
                      </View>

                      {loyaltyPoints > 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="star" size={12} color="#F59E0B" />
                          <Text style={[styles.pointsText, !isDark && { color: '#D97706' }]}>
                            {loyaltyPoints} điểm
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* 2 Khối Tóm Tắt Thống Kê Nhỏ: Lượt lưu trú & Tổng chi tiêu */}
                <View style={[styles.statBoxesRow, !isDark && { borderTopColor: '#E2E8F0' }]}>
                  <View style={[styles.statBox, !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="bed" size={15} color="#0284C7" />
                      <Text style={[styles.statBoxLabel, !isDark && { color: '#64748B' }]}>Lượt lưu trú</Text>
                    </View>
                    <Text style={[styles.statBoxValue, !isDark && { color: '#0F172A' }]}>
                      {totalBookingsCount} <Text style={styles.statBoxUnit}>lần</Text>
                    </Text>
                  </View>

                  <View style={[styles.statBox, !isDark && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="cash" size={15} color="#059669" />
                      <Text style={[styles.statBoxLabel, !isDark && { color: '#64748B' }]}>Tổng chi tiêu</Text>
                    </View>
                    <Text style={[styles.statBoxValue, { color: '#059669' }]}>
                      {totalSpentFormatted}
                    </Text>
                  </View>
                </View>

                {/* Khối Thông Tin Liên Hệ & Định Danh */}
                <View style={[styles.profileInfoGrid, !isDark && { borderTopColor: '#E2E8F0' }]}>
                  {/* Số điện thoại + Hành động Gọi / SMS */}
                  <View style={styles.infoRowBetween}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                      <Ionicons name="call" size={15} color="#059669" style={{ marginRight: 8 }} />
                      <Text style={[styles.infoValue, { color: '#0284C7', fontWeight: '800' }]}>
                        {selectedGuest.phone_number || 'Chưa cập nhật SĐT'}
                      </Text>
                    </View>
                    {selectedGuest.phone_number ? (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          style={styles.quickCallPill}
                          onPress={() => callPhone(selectedGuest.phone_number)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="call" size={11} color="#10B981" style={{ marginRight: 3 }} />
                          <Text style={styles.quickCallPillText}>Gọi</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickSmsPill}
                          onPress={() => sendSms(selectedGuest.phone_number)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="chatbubble" size={11} color="#0284C7" style={{ marginRight: 3 }} />
                          <Text style={styles.quickSmsPillText}>SMS</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>

                  {/* Email (Xử lý thông minh cho khách vãng lai) */}
                  <View style={styles.infoRowBetween}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                      <Ionicons name="mail" size={15} color="#0284C7" style={{ marginRight: 8 }} />
                      <Text
                        style={[
                          styles.infoValue,
                          !hasRealEmail && { fontStyle: 'italic', color: isDark ? '#94A3B8' : '#64748B' },
                          !isDark && hasRealEmail && { color: '#334155' },
                        ]}
                        numberOfLines={1}
                      >
                        {hasRealEmail ? selectedGuest.email : 'Chưa có Email (Khách vãng lai)'}
                      </Text>
                    </View>
                    {hasRealEmail ? (
                      <TouchableOpacity
                        style={styles.quickMailPill}
                        onPress={() => sendEmail(selectedGuest.email)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="mail" size={11} color="#6366F1" style={{ marginRight: 3 }} />
                        <Text style={styles.quickMailPillText}>Gửi mail</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* CCCD / Hộ chiếu */}
                  {idCard ? (
                    <View style={styles.infoRow}>
                      <Ionicons name="card" size={15} color="#D97706" style={{ marginRight: 8 }} />
                      <Text style={[styles.infoValue, !isDark && { color: '#334155' }]}>
                        {idType === 'PASSPORT' ? 'Hộ chiếu (Passport)' : 'CCCD / CMND'}: <Text style={{ fontWeight: '800', fontFamily: 'monospace' }}>{idCard}</Text>
                      </Text>
                    </View>
                  ) : null}

                  {/* Quốc tịch & Ngày sinh & Giới tính */}
                  <View style={styles.infoRow}>
                    <Ionicons name="globe-outline" size={15} color="#0284C7" style={{ marginRight: 8 }} />
                    <Text style={[styles.infoValue, !isDark && { color: '#334155' }]}>
                      Quốc tịch: {nationality || 'Việt Nam'}
                      {gender ? ` • Giới tính: ${gender}` : ''}
                      {dateOfBirth ? ` • Sinh: ${formatDateDisplay(dateOfBirth)}` : ''}
                    </Text>
                  </View>

                  {/* Địa chỉ */}
                  {address ? (
                    <View style={styles.infoRow}>
                      <Ionicons name="location-outline" size={15} color="#EF4444" style={{ marginRight: 8 }} />
                      <Text style={[styles.infoValue, !isDark && { color: '#334155' }]} numberOfLines={2}>
                        Địa chỉ: {address}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* 2. KHỐI SỞ THÍCH & LƯU Ý LƯU TRÚ (CRM PREFERENCES - ĐẶC QUYỀN VIP) */}
              {preferences ? (
                <View style={[styles.preferencesCard, !isDark && { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <Ionicons name="bulb" size={16} color="#D97706" style={{ marginRight: 6 }} />
                    <Text style={[styles.preferencesHeader, !isDark && { color: '#92400E' }]}>
                      SỞ THÍCH & LƯU Ý LƯU TRÚ (CRM VIP)
                    </Text>
                  </View>
                  <Text style={[styles.preferencesContent, !isDark && { color: '#78350F' }]}>
                    {preferences}
                  </Text>
                </View>
              ) : null}

              {/* 3. History Switcher Tabs */}
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

              {/* 4. History Content */}
              {loadingHistory ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator size="small" color="#F59E0B" />
                  <Text style={[styles.loadingText, !isDark && { color: '#64748B' }]}>Đang tải lịch sử...</Text>
                </View>
              ) : activeTab === 'bookings' ? (
                displayedBookingHistory.length === 0 ? (
                  <View style={styles.centerBox}>
                    <Ionicons name="bed-outline" size={36} color={isDark ? '#475569' : '#CBD5E1'} style={{ marginBottom: 6 }} />
                    <Text style={[styles.emptyText, !isDark && { color: '#64748B' }]}>Chưa có lịch sử đặt phòng nào.</Text>
                  </View>
                ) : (
                  <>
                    {displayedBookingHistory.map((b) => {
                      const statusBadge = getBookingStatusBadge(b.status, b.status_display);
                      const isCompletedOrCheckedOut =
                        b.status === 'completed' ||
                        b.status === 'checked_out' ||
                        b.status === 'paid' ||
                        b.status === 'PAID';
                      const pStatus = String(b.payment_status || '').toUpperCase();
                      const isPaid = Boolean(
                        isCompletedOrCheckedOut ||
                        b.is_paid === true ||
                        pStatus === 'PAID' ||
                        pStatus === 'COMPLETED'
                      );
                      const isCancelled = b.status === 'cancelled' || b.status === 'no_show';

                      return (
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
                                { backgroundColor: statusBadge.bg, borderColor: statusBadge.border },
                              ]}
                            >
                              <Text style={[styles.historyStatusText, { color: statusBadge.text }]}>{statusBadge.label}</Text>
                            </View>
                          </View>

                          <Text style={[styles.historyRoomName, !isDark && { color: '#0F172A' }]}>
                            Phòng: {b.room_number ? `P.${b.room_number}` : 'Chưa xếp'} • {b.room_name || 'Phòng Deluxe'}
                          </Text>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 3 }}>
                            <Ionicons name="calendar-outline" size={12} color={isDark ? '#94A3B8' : '#64748B'} />
                            <Text style={[styles.historyDates, !isDark && { color: '#64748B' }]}>
                              {formatDateDisplay(b.check_in_date)} → {formatDateDisplay(b.check_out_date)}
                              {b.nights ? ` (${b.nights} đêm)` : ''}
                            </Text>
                          </View>

                          {/* Dòng Khách & Tình Trạng Thanh Toán */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Ionicons name="people-outline" size={12} color={isDark ? '#94A3B8' : '#64748B'} />
                              <Text style={[styles.historySub, !isDark && { color: '#64748B' }]}>
                                {b.num_adults || b.adults || 1} người lớn{b.num_children || b.children ? ` • ${b.num_children || b.children} trẻ` : ''}
                              </Text>
                            </View>
                            {!isCancelled && (
                              <View
                                style={[
                                  styles.paymentPill,
                                  isPaid
                                    ? { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' }
                                    : { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.3)' },
                                ]}
                              >
                                <Text style={[styles.paymentPillText, { color: isPaid ? '#10B981' : '#F59E0B' }]}>
                                  {isPaid
                                    ? (isCompletedOrCheckedOut ? 'Đã quyết toán đủ' : 'Đã thanh toán đủ')
                                    : (b.status === 'checked_in' ? 'Chưa thanh toán' : 'Chờ thanh toán')}
                                </Text>
                              </View>
                            )}
                          </View>

                          <Text style={[styles.historyPrice, !isDark && { color: '#059669' }]}>
                            Tổng tiền: {b.total_amount ? `${parseInt(b.total_amount, 10).toLocaleString('vi-VN')} đ` : '—'}
                          </Text>
                        </View>
                      );
                    })}
                    {renderHistoryFooter(visibleHistoryBookingsCount, bookingHistory.length, 'lịch đặt')}
                  </>
                )
              ) : (
                displayedServiceHistory.length === 0 ? (
                  <View style={styles.centerBox}>
                    <Ionicons name="restaurant-outline" size={36} color={isDark ? '#475569' : '#CBD5E1'} style={{ marginBottom: 6 }} />
                    <Text style={[styles.emptyText, !isDark && { color: '#64748B' }]}>Chưa có lịch sử dùng dịch vụ nào.</Text>
                  </View>
                ) : (
                  <>
                    {displayedServiceHistory.map((s) => {
                      const statusBadge = getServiceStatusBadge(s.status, s.status_display);

                      return (
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
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                  <Ionicons name="time-outline" size={12} color={isDark ? '#94A3B8' : '#64748B'} />
                                  <Text style={[styles.historyDates, !isDark && { color: '#64748B' }]}>
                                    Đặt: {formatDateTimeDisplay(s.created_at)}
                                  </Text>
                                </View>
                              ) : null}

                              {s.is_scheduled && s.request_time ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                  <Ionicons name="calendar-outline" size={12} color="#D97706" />
                                  <Text style={[styles.historyDates, { color: '#D97706', fontWeight: '700' }]}>
                                    Hẹn giao: {formatDateTimeDisplay(s.request_time)}
                                  </Text>
                                </View>
                              ) : null}

                              {/* Ghi chú đặc biệt của khách khi gọi món/dịch vụ */}
                              {s.note ? (
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 3 }}>
                                  <Ionicons name="chatbox-ellipses-outline" size={12} color="#D97706" style={{ marginTop: 2 }} />
                                  <Text style={[styles.serviceNoteText, !isDark && { color: '#B45309' }]} numberOfLines={2}>
                                    Lưu ý: "{s.note}"
                                  </Text>
                                </View>
                              ) : null}

                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
                                <Text style={[styles.historyPrice, !isDark && { color: '#059669' }]}>
                                  {s.total_price ? `${parseInt(s.total_price, 10).toLocaleString('vi-VN')} đ` : 'Miễn phí'}
                                </Text>
                                <View
                                  style={[
                                    styles.historyStatusBadge,
                                    { backgroundColor: statusBadge.bg, borderColor: statusBadge.border },
                                  ]}
                                >
                                  <Text style={[styles.historyStatusText, { color: statusBadge.text }]}>
                                    {statusBadge.label}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
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
    paddingTop: 8,
  },
  dragHandleWrapper: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
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
    width: 34,
    height: 34,
    borderRadius: 17,
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
    marginBottom: 8,
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
    height: 34,
    borderRadius: 17,
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
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 12.5,
  },
  listCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  listCounterText: {
    fontSize: 11.5,
    color: '#94A3B8',
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
  guestTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  guestTypeBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  guestTypeBadgeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  guestTypeBadgeTextDetail: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 7,
    borderWidth: 1,
  },
  tierBadgeText: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.2,
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
  guestStayText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
  },
  guestPrefBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  guestPrefText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
    maxWidth: 220,
  },
  profileHeaderCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
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
  },
  statBoxesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  statBox: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statBoxLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  statBoxValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#F8FAFC',
    marginTop: 3,
  },
  statBoxUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  profileInfoGrid: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoValue: {
    fontSize: 12,
    color: '#CBD5E1',
    flex: 1,
  },
  quickCallPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  quickCallPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#10B981',
  },
  quickSmsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  quickSmsPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0284C7',
  },
  quickMailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  quickMailPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#6366F1',
  },
  preferencesCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    marginBottom: 12,
  },
  preferencesHeader: {
    fontSize: 11,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  preferencesContent: {
    fontSize: 12,
    lineHeight: 18,
    color: '#FDE68A',
    fontWeight: '600',
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
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  historyStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  paymentPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  paymentPillText: {
    fontSize: 9.5,
    fontWeight: '800',
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
  },
  serviceNoteText: {
    fontSize: 11,
    color: '#FCD34D',
    fontStyle: 'italic',
    flex: 1,
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
