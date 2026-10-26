import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'ta_hotel_access_token';
const REFRESH_TOKEN_KEY = 'ta_hotel_refresh_token';
const USER_INFO_KEY = 'ta_hotel_user_info';

export interface UserInfo {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  role: string;
  avatar?: string;
  department?: string;
  employee_code?: string;
  position?: string;
  shift?: string;
  hire_date?: string;
  address?: string;
}

export async function saveAuthTokens(access: string, refresh?: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
    if (refresh) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
    }
  } catch (error) {
    console.error('Lỗi khi lưu token vào SecureStore:', error);
  }
}

export async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function saveUserInfo(user: UserInfo): Promise<void> {
  try {
    await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Lỗi lưu UserInfo:', error);
  }
}

export async function getUserInfo(): Promise<UserInfo | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_INFO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearAuthData(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_INFO_KEY);
  } catch (error) {
    console.error('Lỗi xóa AuthData:', error);
  }
}
