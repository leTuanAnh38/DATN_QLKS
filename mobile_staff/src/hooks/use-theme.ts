/**
 * Hook trả về bộ màu giao diện hiện tại (Light hoặc Dark).
 * Tự động đồng bộ với ThemeProvider và người dùng lựa chọn trong Tab Cá nhân.
 */

import { useAppTheme } from '@/contexts/ThemeContext';

export function useTheme() {
  const { colors } = useAppTheme();
  return colors;
}
