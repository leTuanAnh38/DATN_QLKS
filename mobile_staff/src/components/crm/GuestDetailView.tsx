import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { styles } from './styles';
import { GuestDetailViewProps } from './types';
import {
  getServiceItemImage,
  formatDateDisplay,
  formatDateTimeDisplay,
  isWalkinGuest,
  getBookingStatusBadge,
  getServiceStatusBadge,
  getTierBadge,
} from './helpers';

export default function GuestDetailView({
  guest,
  bookingHistory,
  serviceHistory,
  loadingDetail,
  loadingHistory,
  isDark,
}: GuestDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'bookings' | 'services'>('bookings');
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

  // Trích xuất an toàn các thuộc tính hồ sơ chi tiết khách hàng
  const idCard = guest?.id_card_number || guest?.guest_profile?.id_card_number || '';
  const idType = guest?.id_type || guest?.guest_profile?.id_type || 'CCCD';
  const preferences = guest?.preferences || guest?.guest_profile?.preferences || '';
  const nationality = guest?.nationality || guest?.guest_profile?.nationality || '';
  const dateOfBirth = guest?.date_of_birth || guest?.guest_profile?.date_of_birth || '';
  const gender = guest?.gender || guest?.guest_profile?.gender || '';
  const address = guest?.address || '';
  const totalBookingsCount = guest?.total_bookings ?? bookingHistory.length;
  const totalSpentFormatted = guest?.total_spent
    ? `${parseInt(guest.total_spent, 10).toLocaleString('vi-VN')} đ`
    : '0 đ';
  const loyaltyPoints = guest?.loyalty_points ?? guest?.total_points ?? guest?.guest_profile?.loyalty_points ?? 0;
  const isSelectedWalkin = isWalkinGuest(guest);
  const hasRealEmail = guest?.email && !guest.email.toLowerCase().endsWith('.local') && !guest.email.toLowerCase().includes('@walkin.');

  return (
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
            {guest.avatar ? (
              <Image source={{ uri: guest.avatar }} style={{ width: 58, height: 58, borderRadius: 29 }} />
            ) : (
              <Text style={[styles.avatarInitial, { fontSize: 24 }, !isDark && { color: '#D97706' }]}>
                {(guest.full_name || guest.username || 'K').charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[styles.profileName, !isDark && { color: '#0F172A' }]} numberOfLines={1}>
              {guest.full_name || guest.username}
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
              <View style={[styles.tierBadge, { backgroundColor: getTierBadge(guest.vip_tier || guest.current_tier?.name, isDark).bg, borderColor: getTierBadge(guest.vip_tier || guest.current_tier?.name, isDark).border }]}>
                <Text style={[styles.tierBadgeText, { color: getTierBadge(guest.vip_tier || guest.current_tier?.name, isDark).text }]}>
                  {getTierBadge(guest.vip_tier || guest.current_tier?.name, isDark).label}
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
                {guest.phone_number || 'Chưa cập nhật SĐT'}
              </Text>
            </View>
            {guest.phone_number ? (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={styles.quickCallPill}
                  onPress={() => callPhone(guest.phone_number)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call" size={11} color="#10B981" style={{ marginRight: 3 }} />
                  <Text style={styles.quickCallPillText}>Gọi</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickSmsPill}
                  onPress={() => sendSms(guest.phone_number)}
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
                {hasRealEmail ? guest.email : 'Chưa có Email (Khách vãng lai)'}
              </Text>
            </View>
            {hasRealEmail ? (
              <TouchableOpacity
                style={styles.quickMailPill}
                onPress={() => sendEmail(guest.email)}
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
  );
}

