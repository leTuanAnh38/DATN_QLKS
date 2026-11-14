import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { useAppTheme } from '../../contexts/ThemeContext';
import { styles } from './styles';
import { CustomerCrmModalProps } from './types';
import GuestListView from './GuestListView';
import GuestDetailView from './GuestDetailView';

export default function CustomerCrmModal({
  visible,
  onClose,
  initialGuestId,
}: CustomerCrmModalProps) {
  const { isDark } = useAppTheme();
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Selected Guest Detail View
  const [selectedGuest, setSelectedGuest] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
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

  // Kéo thanh dragHandle xuống để đóng modal
  const translateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 4,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          translateY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 90 || gs.vy > 0.8) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          Animated.timing(translateY, {
            toValue: 600,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            onCloseRef.current();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
      fetchGuests();
      if (initialGuestId) {
        openGuestDetail({ id: initialGuestId });
      } else {
        setSelectedGuest(null);
      }
    }
  }, [visible, initialGuestId, fetchGuests, translateY]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ translateY }] },
            !isDark && {
              backgroundColor: '#FFFFFF',
              borderTopColor: '#E2E8F0',
              shadowColor: '#64748B',
            },
          ]}
        >
          {/* Thanh kéo vuốt xuống (Drag Handle Indicator) */}
          <View style={styles.dragHandleWrapper} {...panResponder.panHandlers}>
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

          {/* Views */}
          {!selectedGuest ? (
            <GuestListView
              guests={guests}
              loading={loading}
              isDark={isDark}
              onSelectGuest={openGuestDetail}
            />
          ) : (
            <GuestDetailView
              guest={selectedGuest}
              bookingHistory={bookingHistory}
              serviceHistory={serviceHistory}
              loadingDetail={loadingDetail}
              loadingHistory={loadingHistory}
              isDark={isDark}
              onRefreshDetail={() => openGuestDetail(selectedGuest)}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

