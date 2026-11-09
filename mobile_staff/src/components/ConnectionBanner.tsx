import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useServerOffline } from '../services/connectionStatus';
import { useOfflineQueueCount } from '../services/offlineQueue';
import OfflineQueueModal from './OfflineQueueModal';

/** Banner nổi báo mất kết nối máy chủ hoặc hàng đợi ngoại tuyến đang chờ gửi */
export default function ConnectionBanner() {
  const offline = useServerOffline();
  const queueCount = useOfflineQueueCount();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);

  if (!offline && queueCount === 0) return null;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalVisible(true);
  };

  return (
    <>
      <View style={[styles.wrap, { top: insets.top + 4 }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handlePress}
          style={[
            styles.banner,
            offline
              ? styles.offlineBanner
              : styles.queueBanner,
          ]}
        >
          <Ionicons
            name={offline ? 'cloud-offline-outline' : 'cloud-upload-outline'}
            size={16}
            color={offline ? '#FEE2E2' : '#0A0F1D'}
          />
          <Text style={[styles.text, { color: offline ? '#FEE2E2' : '#0A0F1D' }]}>
            {offline
              ? (queueCount > 0
                  ? `Mất kết nối • ${queueCount} tác vụ chờ gửi`
                  : 'Mất kết nối máy chủ • đang tự thử lại...')
              : `${queueCount} tác vụ offline đang chờ • Bấm để gửi`}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={13}
            color={offline ? '#FEE2E2' : '#0A0F1D'}
            style={{ marginLeft: 2 }}
          />
        </TouchableOpacity>
      </View>

      <OfflineQueueModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  offlineBanner: {
    backgroundColor: 'rgba(185, 28, 28, 0.95)',
  },
  queueBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.95)',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
