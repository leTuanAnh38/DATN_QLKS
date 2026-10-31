import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Colors, Palette, ThemeColors } from '../constants/theme';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type { ThemeColors };

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  colors: ThemeColors;
  palette: typeof Palette;
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

    // 2. Lắng nghe thay đổi theme hệ thống của thiết bị
    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme ?? 'dark');
    });

    return () => {
      listener.remove();
    };
  }, []);

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
      setThemeMode,
      toggleTheme,
    }),
    [themeMode, resolvedTheme, isDark, colors, setThemeMode, toggleTheme]
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
      setThemeMode: async () => {},
      toggleTheme: async () => {},
    };
  }
  return context;
}

export const useThemeContext = useAppTheme;
