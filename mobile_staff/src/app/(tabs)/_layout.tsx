import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme } from '../../contexts/ThemeContext';
import ConnectionBanner from '../../components/ConnectionBanner';

export default function TabLayout() {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const role = user?.role || '';
  const isManagerOrAdmin =
    Boolean(user?.is_superuser) ||
    ['admin', 'owner', 'manager', 'receptionist', 'cashier'].includes(role);

  // Phân quyền hiển thị Tab Bar thích ứng thông minh (Adaptive RBAC):
  // 1. Buồng phòng (housekeeper): Sơ đồ phòng + Đồ thất lạc + Dịch vụ (yêu cầu buồng phòng) + Cá nhân
  // 2. Phục vụ (service_staff): Sơ đồ phòng (báo hỏng/đồ bỏ quên như Web) + Dịch vụ F&B/Spa + Đội xe + Cá nhân
  // 3. Kỹ thuật (technician): Bảo trì sự cố + Sơ đồ phòng + Cá nhân
  // 4. Quản lý / Lễ tân / Admin: Xem toàn diện các phân hệ điều hành
  const canAccessHousekeeping = isManagerOrAdmin || ['housekeeper', 'technician', 'service_staff'].includes(role);
  const canAccessLostFound = isManagerOrAdmin || role === 'housekeeper';
  const canAccessTransport = isManagerOrAdmin || role === 'service_staff';
  const canAccessServices = isManagerOrAdmin || ['service_staff', 'housekeeper'].includes(role);
  const canAccessMaintenance = isManagerOrAdmin || role === 'technician';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.tabBarActive, // Vàng hoàng gia TA Luxury (#F59E0B)
          tabBarInactiveTintColor: colors.tabBarInactive,
          tabBarStyle: {
            backgroundColor: colors.tabBarBackground,
            borderTopColor: colors.tabBarBorder,
            borderTopWidth: 1,
            height: Platform.OS === 'ios' ? 92 : 68,
            paddingBottom: Platform.OS === 'ios' ? 34 : 10, // Vùng đệm chuẩn xác cho Home Indicator của iPhone 14 Pro
            paddingTop: 8,
            elevation: 12,
            shadowColor: colors.shadowColor,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: isDark ? 0.4 : 0.08,
            shadowRadius: 12,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.3,
            marginTop: 3,
          },
        }}
        screenListeners={{
          tabPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        }}
      >
        {/* Tab 1: Sơ đồ Buồng phòng (Housekeeping) */}
        <Tabs.Screen
          name="housekeeping"
          options={{
            title: role === 'technician' ? 'Sơ đồ phòng' : 'Phòng',
            href: canAccessHousekeeping ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'bed' : 'bed-outline'}
                size={24}
                color={(color as string) || colors.tabBarInactive}
              />
            ),
          }}
        />

        {/* Tab 2: Quản lý Đồ thất lạc (Lost & Found - Cho Buồng phòng & Lễ tân) */}
        <Tabs.Screen
          name="lost_found"
          options={{
            title: 'Thất lạc',
            href: canAccessLostFound ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'archive' : 'archive-outline'}
                size={23}
                color={(color as string) || colors.tabBarInactive}
              />
            ),
          }}
        />

        {/* Tab 3: Đội xe / Vận chuyển đón tiễn sân bay (Tài xế / Phục vụ) */}
        <Tabs.Screen
          name="transport"
          options={{
            title: 'Đội xe',
            href: canAccessTransport ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'car-sport' : 'car-sport-outline'}
                size={24}
                color={(color as string) || colors.tabBarInactive}
              />
            ),
          }}
        />

        {/* Tab 4: Phục vụ F&B, Spa & Tiện ích tại phòng */}
        <Tabs.Screen
          name="services"
          options={{
            title: 'Dịch vụ',
            href: canAccessServices ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'restaurant' : 'restaurant-outline'}
                size={23}
                color={(color as string) || colors.tabBarInactive}
              />
            ),
          }}
        />

        {/* Tab 5: Kỹ thuật / Sửa chữa thiết bị */}
        <Tabs.Screen
          name="maintenance"
          options={{
            title: 'Kỹ thuật',
            href: canAccessMaintenance ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'construct' : 'construct-outline'}
                size={23}
                color={(color as string) || colors.tabBarInactive}
              />
            ),
          }}
        />

        {/* Tab 6: Hồ sơ Ca trực & Thiết lập cá nhân (Tất cả nhân viên) */}
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Cá nhân',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'person-circle' : 'person-circle-outline'}
                size={24}
                color={(color as string) || colors.tabBarInactive}
              />
            ),
          }}
        />
      </Tabs>
      <ConnectionBanner />
    </View>
  );
}
