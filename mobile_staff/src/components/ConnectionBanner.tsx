import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useServerOffline } from '../services/connectionStatus';

/** Banner nổi báo mất kết nối máy chủ. Dữ liệu sẽ tự đồng bộ lại khi có mạng. */
export default function ConnectionBanner() {
  const offline = useServerOffline();
  const insets = useSafeAreaInsets();

  if (!offline) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 4 }]}>
      <View style={styles.banner}>
        <Ionicons name="cloud-offline-outline" size={16} color="#FEE2E2" />
        <Text style={styles.text}>Mất kết nối máy chủ • đang tự thử lại...</Text>
      </View>
    </View>
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
    backgroundColor: 'rgba(185, 28, 28, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  text: {
    color: '#FEE2E2',
    fontSize: 12,
    fontWeight: '700',
  },
});
