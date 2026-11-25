import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// URL Production Backend trên Railway (đồng bộ thời gian thực với Web Client & Cổng Lễ Tân PMS)
export const DEFAULT_API_URL = 'https://backend-production-59387ae6.up.railway.app/api';
const API_URL_KEY = 'ta_hotel_api_url';

let cachedApiUrl: string = DEFAULT_API_URL;
let apiUrlLoaded = false;

async function readStorage(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function writeStorage(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export function getCachedApiBaseUrl(): string {
  return cachedApiUrl || DEFAULT_API_URL;
}

export async function getApiBaseUrl(): Promise<string> {
  if (apiUrlLoaded && cachedApiUrl) {
    return cachedApiUrl;
  }
  try {
    const saved = await readStorage(API_URL_KEY);
    if (saved && saved.trim()) {
      cachedApiUrl = saved.trim().replace(/\/+$/, '');
      apiUrlLoaded = true;
      return cachedApiUrl;
    }
  } catch (e) {
    console.warn('Lỗi đọc API URL từ bộ nhớ:', e);
  }
  cachedApiUrl = DEFAULT_API_URL;
  apiUrlLoaded = true;
  return cachedApiUrl;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  try {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    cachedApiUrl = cleanUrl || DEFAULT_API_URL;
    apiUrlLoaded = true;
    await writeStorage(API_URL_KEY, cachedApiUrl);
  } catch (e) {
    console.warn('Lỗi lưu API URL vào bộ nhớ:', e);
  }
}
