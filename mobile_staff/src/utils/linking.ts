import { Alert, Linking } from 'react-native';

/**
 * Mở URL ngoài (tel:, sms:, mailto:, bản đồ...) một cách an toàn.
 * Tránh văng unhandled rejection trên máy tính bảng hoặc thiết bị không có ứng dụng tương ứng.
 */
export async function safeOpenUrl(
  url: string,
  fallbackMessage = 'Thiết bị không hỗ trợ thao tác này.'
): Promise<void> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Không hỗ trợ', fallbackMessage);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Lỗi', fallbackMessage);
  }
}

