import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../api/client';
import {
  UserInfo,
  saveAuthTokens,
  saveUserInfo,
  getUserInfo,
  clearAuthData,
  getAccessToken,
} from '../services/authStorage';
import { registerForPushNotifications } from '../services/notificationService';
import { getApiBaseUrl, setApiBaseUrl } from '../api/config';

interface AuthContextType {
  user: UserInfo | null;
  role: string | null;
  token: string | null;
  isLoading: boolean;
  apiUrl: string;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string; user?: UserInfo }>;
  logout: () => Promise<void>;
  updateServerUrl: (url: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiUrl, setApiUrlState] = useState('');

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      const currentUrl = await getApiBaseUrl();
      setApiUrlState(currentUrl);

      const savedToken = await getAccessToken();
      const savedUser = await getUserInfo();

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(savedUser);
        // Kích hoạt lại push token cho thiết bị
        registerForPushNotifications().catch(() => {});
      }
    } catch (e) {
      console.warn('Lỗi khởi tạo Auth:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const cleanIdentifier = username.trim();
      const res = await apiClient.post('/users/login/', {
        identifier: cleanIdentifier,
        username: cleanIdentifier,
        password: password,
      });

      const data = res.data;
      const accessToken = data.access || data.tokens?.access;
      const refreshToken = data.refresh || data.tokens?.refresh;

      if (accessToken) {
        await saveAuthTokens(accessToken, refreshToken);
        setToken(accessToken);

        const u = data.user || data;
        const userData: UserInfo = {
          id: u.id,
          username: u.username || cleanIdentifier,
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name,
          phone_number: u.phone_number,
          role: u.role || 'service_staff',
          avatar: u.avatar,
          department: u.department,
          employee_code: u.employee_code,
          position: u.position,
          shift: u.shift,
          hire_date: u.hire_date,
          address: u.address,
        };

        await saveUserInfo(userData);
        setUser(userData);

        // Đăng ký nhận push notifications về iPhone
        registerForPushNotifications().catch(() => {});

        return { success: true, user: userData };
      } else {
        return { success: false, message: data.message || 'Đăng nhập không thành công.' };
      }
    } catch (err: any) {
      console.warn('Lỗi gọi API đăng nhập:', err);
      const msg = err.response?.data?.message || err.response?.data?.detail || 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra địa chỉ IP mạng.';
      return { success: false, message: msg };
    }
  };

  const logout = async () => {
    await clearAuthData();
    setUser(null);
    setToken(null);
  };

  const updateServerUrl = async (newUrl: string) => {
    await setApiBaseUrl(newUrl);
    setApiUrlState(newUrl);
  };

  const refreshProfile = async () => {
    try {
      const res = await apiClient.get('/users/me/');
      if (res.data) {
        const u = res.data.user || res.data;
        const updated: UserInfo = {
          id: u.id,
          username: u.username,
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name,
          phone_number: u.phone_number,
          role: u.role,
          avatar: u.avatar,
          department: u.department,
          employee_code: u.employee_code,
          position: u.position,
          shift: u.shift,
          hire_date: u.hire_date,
          address: u.address,
        };
        await saveUserInfo(updated);
        setUser(updated);
      }
    } catch (e) {
      console.warn('Lỗi refresh profile:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        token,
        isLoading,
        apiUrl,
        login,
        logout,
        updateServerUrl,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
