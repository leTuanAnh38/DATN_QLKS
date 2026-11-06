import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Appearance, AppState, ColorSchemeName } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Colors, Palette, ThemeColors } from '../constants/theme';
import apiClient from '../api/client';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type { ThemeColors };

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  colors: ThemeColors;
  palette: typeof Palette;
  hotelStars: number;
  hotelName: string;
  refreshHotelSettings: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = 'ta_hotel_theme_mode';

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Mặc định là 'dark' - tông màu đen Obsidian thương hiệu TA Luxury Hotel
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme() ?? 'dark'
  );
  const [hotelStars, setHotelStars] = useState<number>(5);
  const [hotelName, setHotelName] = useState<string>('TA LUXURY HOTEL');

  const refreshHotelSettings = useCallback(async () => {
    try {
      const res = await apiClient.get('/hotel-settings/');
      const data = res.data?.data || res.data;
      if (data) {
        if (data.stars !== undefined && data.stars !== null) {
          const parsedStars = Number(data.stars);
          if (!isNaN(parsedStars) && parsedStars >= 1 && parsedStars <= 5) {
            setHotelStars(parsedStars);
          }
        }
        if (data.hotel_name && typeof data.hotel_name === 'string') {
          setHotelName(data.hotel_name.trim());
        }
      }
    } catch {
      // Giữ nguyên giá trị mặc định nếu mất kết nối tạm thời
    }
  }, []);

  useEffect(() => {
    // 1. Khôi phục theme đã lưu
    SecureStore.getItemAsync(THEME_STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeModeState(saved);
        }
      })
      .catch((err) => {
        console.warn('Lỗi đọc cấu hình theme từ SecureStore:', err);
      });

    // 2. Đồng bộ số sao & tên khách sạn từ Cài đặt hệ thống
    refreshHotelSettings();

    // 3. Lắng nghe thay đổi theme hệ thống & khi mở lại ứng dụng
    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme ?? 'dark');
    });
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshHotelSettings();
      }
    });

    return () => {
      listener.remove();
      appStateSub.remove();
    };
  }, [refreshHotelSettings]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await SecureStore.setItemAsync(THEME_STORAGE_KEY, mode);
    } catch (e) {
      console.warn('Lỗi lưu cấu hình theme:', e);
    }
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (themeMode === 'system') {
      return systemScheme === 'light' ? 'light' : 'dark';
    }
    return themeMode;
  }, [themeMode, systemScheme]);

  const isDark = resolvedTheme === 'dark';
  const colors: ThemeColors = Colors[resolvedTheme];

  const toggleTheme = useCallback(async () => {
    const nextMode: ThemeMode = isDark ? 'light' : 'dark';
    await setThemeMode(nextMode);
  }, [isDark, setThemeMode]);

  const value = useMemo(
    () => ({
      themeMode,
      resolvedTheme,
      isDark,
      colors,
      palette: Palette,
      hotelStars,
      hotelName,
      refreshHotelSettings,
      setThemeMode,
      toggleTheme,
    }),
    [themeMode, resolvedTheme, isDark, colors, hotelStars, hotelName, refreshHotelSettings, setThemeMode, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useAppTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    // Dự phòng an toàn nếu component được render ngoài ThemeProvider
    return {
      themeMode: 'dark',
      resolvedTheme: 'dark',
      isDark: true,
      colors: Colors.dark,
      palette: Palette,
      hotelStars: 5,
      hotelName: 'TA LUXURY HOTEL',
      refreshHotelSettings: async () => {},
      setThemeMode: async () => {},
      toggleTheme: async () => {},
    };
  }
  return context;
}

export const useThemeContext = useAppTheme;
