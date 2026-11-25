import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'ta_hotel_access_token';
const REFRESH_TOKEN_KEY = 'ta_hotel_refresh_token';
const USER_INFO_KEY = 'ta_hotel_user_info';
const USER_PERMS_KEY = 'ta_hotel_user_permissions';
const PUSH_TOKEN_KEY = 'ta_hotel_expo_push_token';

// Cache trong RAM để tránh đọc SecureStore lặp đi lặp lại trên mỗi HTTP request
let cachedAccessToken: string | null | undefined = undefined;
let cachedRefreshToken: string | null | undefined = undefined;

async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function storageDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export type RolePermissionsMap = Record<
  string,
  { read?: boolean; create?: boolean; update?: boolean; delete?: boolean }
>;

export interface UserInfo {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  role: string;
  is_superuser?: boolean;
  avatar?: string;
  department?: string;
  employee_code?: string;
  position?: string;
  shift?: string;
  hire_date?: string;
  address?: string;
  permissions?: RolePermissionsMap | null;
}

export async function saveAuthTokens(access: string, refresh?: string): Promise<void> {
  cachedAccessToken = access;
  if (refresh) {
    cachedRefreshToken = refresh;
  }
  try {
    await storageSet(ACCESS_TOKEN_KEY, access);
    if (refresh) {
      await storageSet(REFRESH_TOKEN_KEY, refresh);
    }
  } catch (error) {
    console.error('Lỗi khi lưu token vào bộ nhớ:', error);
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (cachedAccessToken !== undefined) {
    return cachedAccessToken;
  }
  try {
    cachedAccessToken = await storageGet(ACCESS_TOKEN_KEY);
    return cachedAccessToken;
  } catch {
    return null;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  if (cachedRefreshToken !== undefined) {
    return cachedRefreshToken;
  }
  try {
    cachedRefreshToken = await storageGet(REFRESH_TOKEN_KEY);
    return cachedRefreshToken;
  } catch {
    return null;
  }
}

export async function saveUserInfo(user: UserInfo): Promise<void> {
  try {
    const { permissions, ...baseUser } = user;
    await storageSet(USER_INFO_KEY, JSON.stringify(baseUser));
    if (permissions && typeof permissions === 'object') {
      await storageSet(USER_PERMS_KEY, JSON.stringify(permissions));
    } else {
      await storageDelete(USER_PERMS_KEY);
    }
  } catch (error) {
    console.error('Lỗi lưu UserInfo:', error);
  }
}

export async function getUserInfo(): Promise<UserInfo | null> {
  try {
    const raw = await storageGet(USER_INFO_KEY);
    if (!raw) return null;
    const user: UserInfo = JSON.parse(raw);
    try {
      const permsRaw = await storageGet(USER_PERMS_KEY);
      if (permsRaw) {
        user.permissions = JSON.parse(permsRaw);
      }
    } catch {}
    return user;
  } catch {
    return null;
  }
}

export async function savePushToken(token: string): Promise<void> {
  try {
    await storageSet(PUSH_TOKEN_KEY, token);
  } catch {}
}

export async function getPushToken(): Promise<string | null> {
  try {
    return await storageGet(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function clearPushToken(): Promise<void> {
  try {
    await storageDelete(PUSH_TOKEN_KEY);
  } catch {}
}

export async function clearAuthData(): Promise<void> {
  cachedAccessToken = null;
  cachedRefreshToken = null;
  try {
    await storageDelete(ACCESS_TOKEN_KEY);
    await storageDelete(REFRESH_TOKEN_KEY);
    await storageDelete(USER_INFO_KEY);
    await storageDelete(USER_PERMS_KEY);
  } catch (error) {
    console.error('Lỗi xóa AuthData:', error);
  }
}
