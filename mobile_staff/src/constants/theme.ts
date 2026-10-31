/**
 * Hệ thống màu và Design Tokens chuẩn nhận diện khách sạn 5 sao TA Luxury Hotel.
 * Tương thích cả Light mode, Dark mode và cung cấp Palette trực tiếp cho StyleSheet.
 */

import { Platform } from 'react-native';

export const Palette = {
  surface: {
    background: '#0A0F1D',       // Nền Obsidian siêu sâu và sang trọng
    card: '#111827',             // Thẻ nội dung chính
    cardSecondary: '#1E293B',    // Thẻ phụ / Badge nền xám slate
    cardSelected: '#131B2E',     // Thẻ được chọn / active
    cardDanger: '#13192B',       // Thẻ cảnh báo sự cố
    darkOverlay: '#0A0F1D',      // Nền phụ trong các box con
    backdrop: 'rgba(10, 15, 29, 0.85)', // Nền mờ Modal
  },
  border: {
    default: '#1F2937',          // Viền thẻ mặc định
    subtle: '#334155',           // Viền rõ nét
    light: '#475569',            // Viền phân tách nhạt
  },
  text: {
    primary: '#F8FAFC',          // Chữ tiêu đề chính (trắng sáng)
    secondary: '#CBD5E1',        // Chữ phụ cấp 1
    muted: '#94A3B8',            // Chữ phụ cấp 2 / nhãn
    subtle: '#64748B',           // Chữ chú thích mờ / placeholder
  },
  gold: {
    main: '#F59E0B',             // Vàng Amber thương hiệu khách sạn
    light: '#FBBF24',            // Vàng sáng hiển thị text
    extraLight: '#FCD34D',       // Vàng nhạt SOP
    subtle: 'rgba(245, 158, 11, 0.12)', // Nền mờ vàng
    border: 'rgba(245, 158, 11, 0.4)',  // Viền mờ vàng
  },
  emerald: {
    main: '#10B981',             // Xanh ngọc lục bảo (Thành công / Phòng sạch)
    light: '#34D399',            // Xanh ngọc sáng
    subtle: 'rgba(16, 185, 129, 0.12)', // Nền mờ xanh
    border: 'rgba(16, 185, 129, 0.4)',  // Viền mờ xanh
  },
  rose: {
    main: '#EF4444',             // Đỏ Ruby (Bảo trì / Hư hại / Bồi thường)
    light: '#F87171',            // Đỏ hồng sáng
    extraLight: '#FCA5A5',       // Đỏ nhạt
    subtle: 'rgba(239, 68, 68, 0.14)',  // Nền mờ đỏ
    border: 'rgba(239, 68, 68, 0.4)',   // Viền mờ đỏ
  },
  sky: {
    main: '#38BDF8',             // Xanh da trời (Chuyến xe / Khách lưu trú)
    light: '#60A5FA',            // Xanh dương sáng
    extraLight: '#BAE6FD',       // Xanh dương nhạt
    subtle: 'rgba(56, 189, 248, 0.12)', // Nền mờ xanh da trời
    border: 'rgba(56, 189, 248, 0.4)',  // Viền mờ xanh da trời
  },
  purple: {
    main: '#8B5CF6',             // Tím thạch anh (Đồ thất lạc / Quý giá)
    light: '#A78BFA',            // Tím sáng
    extraLight: '#DDD6FE',       // Tím nhạt
    subtle: 'rgba(139, 92, 246, 0.15)', // Nền mờ tím
    border: 'rgba(139, 92, 246, 0.4)',  // Viền mờ tím
  },
} as const;

export const Colors = {
  light: {
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#64748B',
    textSubtle: '#94A3B8',
    background: '#F8FAFC',
    backgroundElement: '#F1F5F9',
    backgroundSelected: '#E2E8F0',
    card: '#FFFFFF',
    cardSecondary: '#F1F5F9',
    cardBorder: '#E2E8F0',
    border: '#E2E8F0',
    borderSubtle: '#CBD5E1',
    inputBackground: '#F1F5F9',
    inputBorder: '#CBD5E1',
    tabBarBackground: '#FFFFFF',
    tabBarBorder: '#E2E8F0',
    tabBarActive: Palette.gold.main,
    tabBarInactive: '#94A3B8',
    statusBar: 'dark' as const,
    shadowColor: '#64748B',
    gold: Palette.gold.main,
    emerald: Palette.emerald.main,
    rose: Palette.rose.main,
    sky: Palette.sky.main,
    purple: Palette.purple.main,
  },
  dark: {
    text: Palette.text.primary,
    textSecondary: Palette.text.secondary,
    textMuted: Palette.text.muted,
    textSubtle: Palette.text.subtle,
    background: Palette.surface.background,
    backgroundElement: Palette.surface.cardSecondary,
    backgroundSelected: Palette.surface.cardSelected,
    card: Palette.surface.card,
    cardSecondary: Palette.surface.cardSecondary,
    cardBorder: Palette.border.default,
    border: Palette.border.default,
    borderSubtle: Palette.border.subtle,
    inputBackground: Palette.surface.background,
    inputBorder: Palette.border.default,
    tabBarBackground: Palette.surface.background,
    tabBarBorder: 'rgba(212, 175, 55, 0.18)',
    tabBarActive: Palette.gold.main,
    tabBarInactive: Palette.text.subtle,
    statusBar: 'light' as const,
    shadowColor: '#000000',
    gold: Palette.gold.main,
    emerald: Palette.emerald.main,
    rose: Palette.rose.main,
    sky: Palette.sky.main,
    purple: Palette.purple.main,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export type ThemeColors = {
  [K in ThemeColor]: string;
} & {
  statusBar: 'light' | 'dark';
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
