import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

/**
 * Polling chỉ chạy khi màn hình đang được hiển thị (focus) VÀ app đang ở foreground.
 * - Chuyển tab khác hoặc đưa app xuống nền: dừng gọi API (tiết kiệm pin, mạng).
 * - Quay lại màn hình / mở lại app: gọi làm mới ngay rồi tiếp tục theo chu kỳ.
 * Lần focus đầu tiên không gọi ngay (màn hình tự tải dữ liệu lúc mount).
 */
export function useFocusPolling(callback: () => void, intervalMs: number) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;
  const isFirstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setInterval> | null = null;

      const stop = () => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      };
      const start = () => {
        stop();
        timer = setInterval(() => savedCallback.current(), intervalMs);
      };

      if (isFirstFocus.current) {
        isFirstFocus.current = false;
      } else {
        savedCallback.current();
      }
      start();

      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          savedCallback.current();
          start();
        } else {
          stop();
        }
      });

      return () => {
        stop();
        sub.remove();
      };
    }, [intervalMs])
  );
}
