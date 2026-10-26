import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../api/client';

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
  action_url?: string;
}

export default function NotificationBell() {
  const [modalVisible, setModalVisible] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Tải danh sách thông báo & đếm chưa đọc
  const fetchNotifications = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await apiClient.get('/notifications/', {
        params: { page_size: 30 },
      });
      const data = res.data;
      const list = data.results || data.data || [];
      const unread = data.unread_count ?? list.filter((n: NotificationItem) => !n.is_read).length;

      setNotifications(Array.isArray(list) ? list : []);
      setUnreadCount(typeof unread === 'number' ? unread : 0);
    } catch (e) {
      console.warn('Lỗi lấy thông báo:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(true);
    // Tự động kiểm tra thông báo mới mỗi 15 giây
    const interval = setInterval(() => {
      fetchNotifications(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const onOpenModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(true);
    fetchNotifications(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchNotifications(true);
  };

  // Đánh dấu 1 thông báo đã đọc
  const markAsRead = async (item: NotificationItem) => {
    if (item.is_read) return;
    try {
      Haptics.selectionAsync();
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      await apiClient.patch(`/notifications/${item.id}/read/`);
    } catch (e) {
      console.warn('Lỗi đánh dấu đã đọc:', e);
    }
  };

  // Đánh dấu tất cả đã đọc
  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      await apiClient.patch('/notifications/read-all/');
    } catch (e) {
      console.warn('Lỗi đánh dấu tất cả đã đọc:', e);
    }
  };

  // Dọn dẹp thông báo đã đọc
  const clearRead = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await apiClient.delete('/notifications/clear-read/');
      fetchNotifications(false);
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể dọn dẹp thông báo.');
    }
  };

  const formatTimeAgo = (isoString: string) => {
    try {
      const now = new Date();
      const past = new Date(isoString);
      const diffMs = now.getTime() - past.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Vừa xong';
      if (diffMin < 60) return `${diffMin} phút trước`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours} giờ trước`;
      return past.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  const getNotificationIcon = (title: string, type: string) => {
    const t = (title + ' ' + type).toLowerCase();
    if (t.includes('bảo trì') || t.includes('hỏng') || t.includes('sửa') || type === 'maintenance') {
      return { icon: 'construct', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
    }
    if (t.includes('thất lạc') || t.includes('bỏ quên') || t.includes('đồ') || type === 'lost_found') {
      return { icon: 'briefcase', color: '#A78BFA', bg: 'rgba(167, 139, 250, 0.15)' };
    }
    if (t.includes('minibar') || t.includes('kiểm phòng') || t.includes('hóa đơn')) {
      return { icon: 'wine', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
    }
    if (t.includes('xe') || t.includes('đón') || t.includes('sân bay') || type === 'transport') {
      return { icon: 'car-sport', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.15)' };
    }
    if (t.includes('món') || t.includes('phục vụ') || t.includes('dịch vụ') || type === 'service') {
      return { icon: 'restaurant', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
    }
    return { icon: 'notifications', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
  };

  const filteredList = notifications.filter((n) => {
    if (filter === 'unread') return !n.is_read;
    return true;
  });

  return (
    <>
      {/* 1. Nút Chuông Icon Trên Góc Màn Hình */}
      <TouchableOpacity
        style={styles.bellButton}
        onPress={onOpenModal}
        activeOpacity={0.7}
      >
        <Ionicons
          name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
          size={20}
          color="#F59E0B"
        />
        {unreadCount > 0 && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* 2. Modal Hiển Thị Danh Sách Thông Báo PMS Chuẩn Web */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header Modal */}
            <View style={styles.headerRow}>
              <View style={styles.headerTitleBox}>
                <View style={styles.bellIconCircle}>
                  <Ionicons name="notifications" size={18} color="#F59E0B" />
                </View>
                <View>
                  <Text style={styles.headerTitle}>Thông Báo PMS</Text>
                  <Text style={styles.headerSubtitle}>
                    {unreadCount > 0
                      ? `${unreadCount} thông báo chưa đọc`
                      : 'Đã xem tất cả thông báo'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Dải Thao Tác & Bộ Lọc */}
            <View style={styles.filterActionBar}>
              <View style={styles.filterTabs}>
                <TouchableOpacity
                  style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
                  onPress={() => setFilter('all')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      filter === 'all' && styles.filterTabTextActive,
                    ]}
                  >
                    Tất cả ({notifications.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterTab, filter === 'unread' && styles.filterTabActive]}
                  onPress={() => setFilter('unread')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      filter === 'unread' && styles.filterTabTextActive,
                    ]}
                  >
                    Chưa đọc ({unreadCount})
                  </Text>
                </TouchableOpacity>
              </View>

              {unreadCount > 0 && (
                <TouchableOpacity
                  style={styles.markAllBtn}
                  onPress={markAllAsRead}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark-done" size={14} color="#34D399" style={{ marginRight: 3 }} />
                  <Text style={styles.markAllText}>Đã đọc hết</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Danh Sách Thông Báo */}
            {loading && notifications.length === 0 ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#F59E0B" />
                <Text style={styles.loadingText}>Đang tải thông báo...</Text>
              </View>
            ) : filteredList.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="file-tray-outline" size={48} color="#334155" />
                <Text style={styles.emptyTitle}>
                  {filter === 'unread'
                    ? 'Không có thông báo chưa đọc'
                    : 'Chưa có thông báo nào'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  Các phát sinh về buồng phòng, sửa chữa, khách hàng sẽ hiển thị ở đây.
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredList}
                keyExtractor={(item) => String(item.id)}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
                }
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => {
                  const iconConfig = getNotificationIcon(item.title, item.notification_type);

                  return (
                    <TouchableOpacity
                      style={[
                        styles.notifCard,
                        !item.is_read && styles.notifCardUnread,
                      ]}
                      onPress={() => markAsRead(item)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.notifIconCircle, { backgroundColor: iconConfig.bg }]}>
                        <Ionicons name={iconConfig.icon as any} size={18} color={iconConfig.color} />
                      </View>

                      <View style={styles.notifTextBox}>
                        <View style={styles.notifTitleRow}>
                          <Text
                            style={[
                              styles.notifTitle,
                              !item.is_read && styles.notifTitleUnread,
                            ]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          {!item.is_read && <View style={styles.unreadDot} />}
                        </View>

                        <Text style={styles.notifMessage} numberOfLines={2}>
                          {item.message}
                        </Text>

                        <Text style={styles.notifTime}>
                          {formatTimeAgo(item.created_at)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            {/* Footer Dọn Dẹp */}
            {notifications.some((n) => n.is_read) && (
              <TouchableOpacity style={styles.clearReadBtn} onPress={clearRead} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={13} color="#94A3B8" style={{ marginRight: 4 }} />
                <Text style={styles.clearReadText}>Dọn dẹp các thông báo đã đọc</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#EF4444',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0A0F1D',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '85%',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  filterTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#334155',
  },
  filterTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  filterTabTextActive: {
    color: '#F8FAFC',
    fontWeight: '800',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  markAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
    lineHeight: 16,
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'flex-start',
  },
  notifCardUnread: {
    backgroundColor: '#161F30',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  notifIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  notifTextBox: {
    flex: 1,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CBD5E1',
    flex: 1,
    paddingRight: 6,
  },
  notifTitleUnread: {
    color: '#F8FAFC',
    fontWeight: '900',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#3B82F6',
  },
  notifMessage: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
    marginBottom: 4,
  },
  notifTime: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  clearReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  clearReadText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
