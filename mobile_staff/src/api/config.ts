import * as SecureStore from 'expo-secure-store';

// URL Ngrok công khai qua Internet (giúp iPhone 14 Pro dùng 4G/LTE truy cập trực tiếp mọi lúc mọi nơi)
export const DEFAULT_API_URL = 'https://unashamed-jab-bulldog.ngrok-free.dev/api';
const API_URL_KEY = 'ta_hotel_api_url';

export async function getApiBaseUrl(): Promise<string> {
  try {
    const saved = await SecureStore.getItemAsync(API_URL_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch (e) {
    console.warn('Lỗi đọc API URL từ SecureStore:', e);
  }
  return DEFAULT_API_URL;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  try {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    await SecureStore.setItemAsync(API_URL_KEY, cleanUrl);
  } catch (e) {
    console.warn('Lỗi lưu API URL vào SecureStore:', e);
  }
}
