import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme } from '../../contexts/ThemeContext';
import ConnectionBanner from '../../components/ConnectionBanner';

export default function TabLayout() {
  const { user, token, isLoading } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Auth Guard: Nếu phiên đăng nhập hết hạn hoặc chưa đăng nhập -> tự động điều hướng về màn hình Login
  if (!isLoading && (!token || !user)) {
    return <Redirect href="/login" />;
  }

  const role = user?.role || '';
  const isFullOpsRole =
    Boolean(user?.is_superuser) ||
    ['admin', 'owner', 'manager', 'receptionist'].includes(role);

  // Phân quyền hiển thị Tab Bar thích ứng thông minh (Adaptive RBAC):
  // 1. Buồng phòng (housekeeper): Sơ đồ phòng + Đồ thất lạc + Dịch vụ (tiện ích phòng) + Cá nhân
  // 2. Phục vụ (service_staff): Sơ đồ phòng + Đồ thất lạc + Đội xe + Dịch vụ F&B/Spa + Cá nhân
  // 3. Kỹ thuật (technician): Sơ đồ phòng + Kỹ thuật bảo trì + Cá nhân
  // 4. Thu ngân (cashier): Chế độ đối chiếu gọn nhẹ (Sơ đồ phòng + Dịch vụ + Cá nhân)
  // 5. Quản lý / Chủ / Lễ tân / Admin: Xem toàn diện cả 6 phân hệ điều hành
  const canAccessHousekeeping = isFullOpsRole || ['housekeeper', 'technician', 'service_staff', 'cashier'].includes(role);
  const canAccessLostFound = isFullOpsRole || ['housekeeper', 'service_staff'].includes(role);
  const canAccessTransport = isFullOpsRole || role === 'service_staff';
  const canAccessServices = isFullOpsRole || ['service_staff', 'housekeeper', 'cashier'].includes(role);
  const canAccessMaintenance = isFullOpsRole || role === 'technician';

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
            height: 58 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 8), // Tự động thích ứng Home Indicator iOS & Navigation Bar Android
            paddingTop: 8,
            elevation: 12,
            shadowColor: colors.shadowColor,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: isDark ? 0.4 : 0.08,
            shadowRadius: 12,
          },
          tabBarLabelStyle: {
            fontSize: isFullOpsRole ? 10 : 11.5,
            fontWeight: '700',
            letterSpacing: isFullOpsRole ? 0 : 0.2,
            marginTop: 2,
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
            title: 'Phòng',
            href: canAccessHousekeeping ? undefined : null,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? 'bed' : 'bed-outline'}
                size={isFullOpsRole ? 21 : 24}
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
                size={isFullOpsRole ? 21 : 23}
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
                size={isFullOpsRole ? 21 : 24}
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
                size={isFullOpsRole ? 21 : 23}
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
                size={isFullOpsRole ? 21 : 23}
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
                size={isFullOpsRole ? 21 : 24}
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
