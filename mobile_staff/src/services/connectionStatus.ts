import { useSyncExternalStore } from 'react';

/**
 * Trạng thái kết nối tới máy chủ, suy ra từ kết quả các request axios
 * (không cần thêm thư viện NetInfo):
 * - Request thất bại mà KHÔNG có response (mất mạng, timeout, ngrok sập) -> offline.
 * - Có bất kỳ response nào từ server (kể cả 4xx/5xx) -> online.
 */
let offline = false;
const listeners = new Set<() => void>();

export function setServerOffline(value: boolean) {
  if (offline === value) return;
  offline = value;
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useServerOffline(): boolean {
  return useSyncExternalStore(subscribe, () => offline, () => false);
}
