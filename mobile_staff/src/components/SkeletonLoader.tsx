import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  DimensionValue,
  StyleProp,
  ViewStyle,
} from 'react-native';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Khối Skeleton Shimmer cơ bản với hiệu ứng nhịp thở mượt mà 60fps/120fps ProMotion
 */
export function SkeletonBlock({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#334155',
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
}

/**
 * Skeleton dạng Lưới 2 cột cho màn hình Buồng phòng (Housekeeping)
 */
export function RoomGridSkeleton() {
  return (
    <View style={styles.gridContainer}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={styles.roomCardSkeleton}>
          {/* Header phòng: Số phòng + Status badge */}
          <View style={styles.rowBetween}>
            <SkeletonBlock width={52} height={24} borderRadius={8} />
            <SkeletonBlock width={64} height={20} borderRadius={10} />
          </View>

          {/* Loại phòng & Tầng */}
          <SkeletonBlock width="80%" height={12} borderRadius={4} style={{ marginTop: 10 }} />
          <SkeletonBlock width="50%" height={10} borderRadius={4} style={{ marginTop: 6 }} />

          {/* Dải thông tin giữa phòng */}
          <View style={styles.roomMiddleBox}>
            <SkeletonBlock width="100%" height={32} borderRadius={8} />
          </View>

          {/* Nút hành động dọn phòng */}
          <SkeletonBlock width="100%" height={38} borderRadius={10} style={{ marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton dạng Danh sách cho màn hình Đơn dịch vụ F&B / Spa / Laundry (Services)
 */
export function ServiceListSkeleton() {
  return (
    <View style={styles.listContainer}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.cardSkeleton}>
          {/* Header: Phòng + Status Pill */}
          <View style={styles.rowBetween}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <SkeletonBlock width={65} height={22} borderRadius={8} />
              <SkeletonBlock width={90} height={14} borderRadius={4} />
            </View>
            <SkeletonBlock width={80} height={22} borderRadius={12} />
          </View>

          {/* Ảnh món ăn/dịch vụ + Tên dịch vụ & Giá */}
          <View style={styles.serviceRowSkeleton}>
            <SkeletonBlock width={56} height={56} borderRadius={12} />
            <View style={{ flex: 1, marginLeft: 12, justifyContent: 'space-around' }}>
              <SkeletonBlock width="85%" height={16} borderRadius={6} />
              <SkeletonBlock width="50%" height={12} borderRadius={4} />
              <SkeletonBlock width="40%" height={14} borderRadius={4} />
            </View>
          </View>

          {/* Hộp ghi chú khách hàng */}
          <SkeletonBlock width="100%" height={34} borderRadius={10} style={{ marginTop: 12 }} />

          {/* Nút hành động nhận đơn / hoàn thành */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <SkeletonBlock width={48} height={48} borderRadius={14} />
            <SkeletonBlock width="78%" height={48} borderRadius={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton dạng Danh sách cho màn hình Kỹ thuật & Bảo trì (Maintenance)
 */
export function MaintenanceListSkeleton() {
  return (
    <View style={styles.listContainer}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.cardSkeleton}>
          {/* Header: Phòng + Mức độ gấp */}
          <View style={styles.rowBetween}>
            <SkeletonBlock width={80} height={22} borderRadius={8} />
            <SkeletonBlock width={88} height={22} borderRadius={10} />
          </View>

          {/* Thiết bị hỏng */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <SkeletonBlock width={40} height={40} borderRadius={10} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <SkeletonBlock width="70%" height={16} borderRadius={6} />
              <SkeletonBlock width="45%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
            </View>
          </View>

          {/* Mô tả sự cố */}
          <SkeletonBlock width="100%" height={38} borderRadius={10} style={{ marginTop: 12 }} />

          {/* Kỹ thuật viên & Nút bàn giao */}
          <View style={[styles.rowBetween, { marginTop: 14 }]}>
            <SkeletonBlock width={120} height={14} borderRadius={4} />
            <SkeletonBlock width={140} height={44} borderRadius={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton dạng Danh sách cho màn hình Đội xe (Transport)
 */
export function TransportListSkeleton() {
  return (
    <View style={styles.listContainer}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.cardSkeleton}>
          {/* Header */}
          <View style={styles.rowBetween}>
            <SkeletonBlock width={70} height={22} borderRadius={8} />
            <SkeletonBlock width={95} height={22} borderRadius={12} />
          </View>

          {/* Ảnh xe + Tên chuyến */}
          <View style={styles.serviceRowSkeleton}>
            <SkeletonBlock width={64} height={52} borderRadius={10} />
            <View style={{ flex: 1, marginLeft: 12, justifyContent: 'space-around' }}>
              <SkeletonBlock width="80%" height={16} borderRadius={6} />
              <SkeletonBlock width="55%" height={12} borderRadius={4} />
            </View>
          </View>

          {/* Lộ trình đón trả */}
          <SkeletonBlock width="100%" height={42} borderRadius={10} style={{ marginTop: 12 }} />

          {/* Cụm nút hành động */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <SkeletonBlock width={48} height={48} borderRadius={14} />
            <SkeletonBlock width={48} height={48} borderRadius={14} />
            <SkeletonBlock width="62%" height={48} borderRadius={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton dạng Danh sách cho màn hình Đồ Thất Lạc (Lost & Found)
 */
export function LostFoundListSkeleton() {
  return (
    <View style={styles.listContainer}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.cardSkeleton}>
          <View style={styles.rowBetween}>
            <SkeletonBlock width={80} height={22} borderRadius={8} />
            <SkeletonBlock width={90} height={22} borderRadius={10} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <SkeletonBlock width={56} height={56} borderRadius={12} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <SkeletonBlock width="75%" height={16} borderRadius={6} />
              <SkeletonBlock width="50%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
              <SkeletonBlock width="40%" height={11} borderRadius={4} style={{ marginTop: 6 }} />
            </View>
          </View>

          <SkeletonBlock width="100%" height={32} borderRadius={8} style={{ marginTop: 12 }} />
          <SkeletonBlock width="100%" height={48} borderRadius={14} style={{ marginTop: 14 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  cardSkeleton: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    marginBottom: 14,
  },
  roomCardSkeleton: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomMiddleBox: {
    marginTop: 10,
    marginBottom: 4,
  },
  serviceRowSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
});
