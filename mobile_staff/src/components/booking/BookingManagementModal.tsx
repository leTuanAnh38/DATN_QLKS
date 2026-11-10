import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../api/client';
import { useAppTheme } from '../../contexts/ThemeContext';
import { styles } from './styles';
import { BookingManagementModalProps } from './types';
import BookingListView from './BookingListView';
import BookingTimelineView from './BookingTimelineView';

export default function BookingManagementModal({
  visible,
  onClose,
  onSelectGuest,
}: BookingManagementModalProps) {
  const { isDark } = useAppTheme();
  const [activeMainTab, setActiveMainTab] = useState<'list' | 'timeline'>('list');

  // Bookings for Tab 1
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);

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

  useEffect(() => {
    if (visible && activeMainTab === 'list') {
      fetchBookings();
    }
  }, [visible, activeMainTab, fetchBookings]);

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
            <View>
              <Text style={[styles.headerTitle, !isDark && { color: '#0F172A' }]}>
                Quản Lý Đặt Phòng & Lịch Trình
              </Text>
              <Text style={[styles.headerSubtitle, !isDark && { color: '#64748B' }]}>
                Tra cứu đơn phòng, lịch lưu trú và thông tin khách
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.closeBtn, !isDark && { backgroundColor: '#F1F5F9' }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={isDark ? '#94A3B8' : '#475569'} />
            </TouchableOpacity>
          </View>

          {/* Top Mode Switcher */}
          <View style={styles.modeSwitcher}>
            <TouchableOpacity
              style={[
                styles.modeBtn,
                !isDark && activeMainTab !== 'list' && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                activeMainTab === 'list' && styles.modeBtnActive,
              ]}
              onPress={() => {
                setActiveMainTab('list');
                Haptics.selectionAsync();
              }}
            >
              <Ionicons
                name="list"
                size={16}
                color={activeMainTab === 'list' ? '#0A0F1D' : isDark ? '#94A3B8' : '#64748B'}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.modeBtnText,
                  !isDark && activeMainTab !== 'list' && { color: '#64748B' },
                  activeMainTab === 'list' && styles.modeBtnTextActive,
                ]}
              >
                Danh Sách Đặt Phòng ({bookings.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeBtn,
                !isDark && activeMainTab !== 'timeline' && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                activeMainTab === 'timeline' && styles.modeBtnActive,
              ]}
              onPress={() => {
                setActiveMainTab('timeline');
                Haptics.selectionAsync();
              }}
            >
              <Ionicons
                name="calendar"
                size={16}
                color={activeMainTab === 'timeline' ? '#0A0F1D' : isDark ? '#94A3B8' : '#64748B'}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.modeBtnText,
                  !isDark && activeMainTab !== 'timeline' && { color: '#64748B' },
                  activeMainTab === 'timeline' && styles.modeBtnTextActive,
                ]}
              >
                Lịch Lưu Trú (Timeline)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Body Tabs */}
          {activeMainTab === 'list' ? (
            <BookingListView
              bookings={bookings}
              loading={loadingList}
              isDark={isDark}
              onSelectGuest={onSelectGuest}
            />
          ) : (
            <BookingTimelineView
              isDark={isDark}
              onSelectGuest={onSelectGuest}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

