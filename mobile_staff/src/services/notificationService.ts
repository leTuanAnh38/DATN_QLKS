import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import apiClient from '../api/client';

// Cấu hình hiển thị notification khi app đang mở (Foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('hotel-staff-alerts', {
      name: 'Khách sạn TA - Báo động tác nghiệp',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D97706',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Người dùng chưa cấp quyền nhận thông báo Push!');
      return null;
    }

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      if (!projectId) {
        console.log('[PUSH_SERVICE] Đang chạy Expo Go (chưa liên kết EAS Project ID). Bỏ qua push token.');
        return null;
      }

      // Lấy Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      token = tokenData.data;

      if (token) {
        // Gửi token lên Backend Django
        await apiClient.post('/notifications/register-device/', {
          expo_push_token: token,
          device_name: `${Device.modelName || 'iPhone'} (${Device.osName || 'iOS'} ${Device.osVersion || ''})`,
          platform: Platform.OS,
        });
        console.log('[PUSH_SERVICE] Đăng ký Push Token thành công:', token);
      }
    } catch (err) {
      console.log('[PUSH_SERVICE] Không lấy được Push Token:', err);
    }
  } else {
    console.log('[PUSH_SERVICE] Cần chạy trên thiết bị vật lý thật (iPhone 14 Pro) để nhận Push Notification.');
  }

  return token;
}

export async function unregisterPushNotification(token: string): Promise<void> {
  try {
    if (token) {
      await apiClient.post('/notifications/unregister-device/', {
        expo_push_token: token,
      });
    }
  } catch (err) {
    console.warn('[PUSH_SERVICE] Lỗi hủy đăng ký push token:', err);
  }
}
