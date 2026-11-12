import * as SecureStore from 'expo-secure-store';

// URL Production Backend trên Railway (đồng bộ thời gian thực với Web Client & Cổng Lễ Tân PMS)
export const DEFAULT_API_URL = 'https://backend-production-59387ae6.up.railway.app/api';
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
