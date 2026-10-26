import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../contexts/AuthContext';

export default function TabLayout() {
  const { user } = useAuth();
  const role = user?.role || '';
  const isManagerOrAdmin = ['admin', 'owner', 'manager', 'receptionist', 'cashier'].includes(role);

  // Phân quyền truy cập các Tab theo từng vai trò nhân viên:
  const canAccessHousekeeping = isManagerOrAdmin || role === 'housekeeper';
  const canAccessLostFound = isManagerOrAdmin || role === 'housekeeper';
  const canAccessTransport = isManagerOrAdmin || role === 'service_staff';
  const canAccessServices = isManagerOrAdmin || role === 'service_staff';
  const canAccessMaintenance = isManagerOrAdmin || role === 'technician';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#F59E0B', // Vàng hoàng gia sang trọng
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#0A0F1D',
          borderTopColor: '#1E293B',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 26 : 8,
          paddingTop: 8,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.2,
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
              size={22}
              color={(color as string) || '#64748B'}
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
              size={22}
              color={(color as string) || '#64748B'}
            />
          ),
        }}
      />

      {/* Tab 3: Đội xe / Vận chuyển đón tiễn sân bay (Tài xế) */}
      <Tabs.Screen
        name="transport"
        options={{
          title: 'Đội xe',
          href: canAccessTransport ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'car-sport' : 'car-sport-outline'}
              size={22}
              color={(color as string) || '#64748B'}
            />
          ),
        }}
      />

      {/* Tab 4: Phục vụ F&B & Gọi món tại phòng */}
      <Tabs.Screen
        name="services"
        options={{
          title: 'Dịch vụ',
          href: canAccessServices ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'restaurant' : 'restaurant-outline'}
              size={22}
              color={(color as string) || '#64748B'}
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
              size={22}
              color={(color as string) || '#64748B'}
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
              size={23}
              color={(color as string) || '#64748B'}
            />
          ),
        }}
      />
    </Tabs>
  );
}
