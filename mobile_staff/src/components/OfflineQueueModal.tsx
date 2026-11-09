import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../contexts/ThemeContext';
import {
  useOfflineQueue,
  removeQueueItem,
  clearOfflineQueue,
  processOfflineQueue,
  isOfflineQueueProcessing,
  OfflineQueueItem,
} from '../services/offlineQueue';

interface OfflineQueueModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function OfflineQueueModal({ visible, onClose }: OfflineQueueModalProps) {
  const { colors, isDark } = useAppTheme();
  const queue = useOfflineQueue();
  const [syncing, setSyncing] = useState(false);

  const handleSyncAll = async () => {
    setSyncing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await processOfflineQueue();
      if (res.success > 0) {
        Alert.alert(
          'Đồng bộ hoàn tất',
          `Đã gửi thành công ${res.success} tác vụ lên máy chủ!\n${
            res.failed > 0 ? `Còn ${res.failed} tác vụ chưa gửi được do lỗi mạng hoặc xác thực.` : ''
          }`
        );
      } else if (res.failed > 0) {
        Alert.alert('Không thể kết nối', 'Máy chủ hiện chưa phản hồi. Vui lòng kiểm tra lại mạng Wi-Fi/4G.');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Xóa toàn bộ hàng đợi?',
      'Các tác vụ chưa được gửi lên máy chủ sẽ bị hủy bỏ vĩnh viễn.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa hết',
          style: 'destructive',
          onPress: async () => {
            await clearOfflineQueue();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  const handleDeleteItem = (item: OfflineQueueItem) => {
    Alert.alert('Hủy tác vụ này?', item.description, [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Hủy',
        style: 'destructive',
        onPress: async () => {
          await removeQueueItem(item.id);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: OfflineQueueItem }) => {
    let statusColor = '#F59E0B';
    let statusText = 'Chờ gửi';
    let statusIcon: any = 'time-outline';

    if (item.status === 'syncing') {
      statusColor = '#38BDF8';
      statusText = 'Đang gửi...';
      statusIcon = 'sync-outline';
    } else if (item.status === 'failed') {
      statusColor = '#EF4444';
      statusText = `Thử lại (${item.retryCount})`;
      statusIcon = 'alert-circle-outline';
    }

    const timeAgo = formatTimeAgo(item.createdAt);

    return (
      <View
        style={[
          styles.itemCard,
          {
            backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
            borderColor: isDark ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.itemHeader}>
          <View style={[styles.methodBadge, { backgroundColor: getMethodBg(item.method) }]}>
            <Text style={styles.methodText}>{item.method}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Ionicons name={statusIcon} size={12} color={statusColor} style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          </View>
          <Text style={[styles.timeText, { color: colors.textMuted }]}>{timeAgo}</Text>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDeleteItem(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <Text style={[styles.descriptionText, { color: colors.text }]}>{item.description}</Text>
        <Text style={[styles.urlText, { color: colors.textMuted }]} numberOfLines={1}>
          {item.url}
        </Text>

        {item.lastError ? (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={13} color="#EF4444" style={{ marginRight: 4 }} />
            <Text style={styles.errorText} numberOfLines={2}>
              {item.lastError}
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="cloud-offline" size={20} color="#F59E0B" style={{ marginRight: 8 }} />
                <Text style={[styles.title, { color: colors.text }]}>Hàng Đợi Ngoại Tuyến</Text>
              </View>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                {queue.length > 0
                  ? `${queue.length} tác vụ đang chờ mạng để tự động gửi`
                  : 'Không có tác vụ nào đang chờ'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* List */}
          <FlatList
            data={queue}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-done-circle-outline" size={56} color="#10B981" />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Tất cả đã đồng bộ!</Text>
                <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
                  Mọi thao tác hiện trường của bạn đã được cập nhật thành công lên máy chủ khách sạn.
                </Text>
              </View>
            }
          />

          {/* Bottom Actions */}
          {queue.length > 0 && (
            <View
              style={[
                styles.footer,
                {
                  borderTopColor: isDark ? '#1E293B' : '#F1F5F9',
                },
              ]}
            >
              <TouchableOpacity
                style={styles.clearAllBtn}
                onPress={handleClearAll}
                activeOpacity={0.7}
              >
                <Text style={styles.clearAllText}>Xóa tất cả</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.syncBtn, syncing && { opacity: 0.7 }]}
                onPress={handleSyncAll}
                disabled={syncing || isOfflineQueueProcessing()}
                activeOpacity={0.8}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color="#0A0F1D" />
                ) : (
                  <>
                    <Ionicons name="sync" size={17} color="#0A0F1D" style={{ marginRight: 6 }} />
                    <Text style={styles.syncBtnText}>Đồng bộ ngay ({queue.length})</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function getMethodBg(method: string) {
  switch (method) {
    case 'POST':
      return '#059669';
    case 'PATCH':
      return '#2563EB';
    case 'PUT':
      return '#7C3AED';
    case 'DELETE':
      return '#DC2626';
    default:
      return '#64748B';
  }
}

function formatTimeAgo(isoString: string) {
  try {
    const d = new Date(isoString);
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return 'Vừa xong';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}p trước`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h trước`;
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Vừa xong';
  }
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
    minHeight: '45%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(156, 163, 175, 0.2)',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12.5,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  itemCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  methodBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  methodText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 11,
    flex: 1,
  },
  deleteBtn: {
    padding: 4,
  },
  descriptionText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  urlText: {
    fontSize: 11.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11.5,
    flex: 1,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 12,
  },
  clearAllBtn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  clearAllText: {
    color: '#EF4444',
    fontSize: 13.5,
    fontWeight: '700',
  },
  syncBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 13,
    borderRadius: 12,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  syncBtnText: {
    color: '#0A0F1D',
    fontSize: 14,
    fontWeight: '800',
  },
});

