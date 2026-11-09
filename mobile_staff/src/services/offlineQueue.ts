import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import * as Haptics from 'expo-haptics';

const QUEUE_STORAGE_KEY = 'ta_hotel_offline_queue_v1';

export interface OfflineQueueItem {
  id: string;
  description: string;
  url: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  data?: any;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  status: 'pending' | 'syncing' | 'failed';
}

let queueCache: OfflineQueueItem[] = [];
let isProcessing = false;
let isLoaded = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

/** Lưu danh sách hàng đợi vào SecureStore */
async function persistQueue(): Promise<void> {
  try {
    await SecureStore.setItemAsync(QUEUE_STORAGE_KEY, JSON.stringify(queueCache));
  } catch (err) {
    console.warn('[OFFLINE_QUEUE] Không thể lưu queue vào SecureStore:', err);
  }
}

/** Tải danh sách hàng đợi từ SecureStore vào bộ nhớ */
export async function loadOfflineQueue(): Promise<OfflineQueueItem[]> {
  try {
    const raw = await SecureStore.getItemAsync(QUEUE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Reset trạng thái 'syncing' về 'pending' nếu app bị đóng đột ngột
        queueCache = parsed.map((item) => ({
          ...item,
          status: item.status === 'syncing' ? 'pending' : item.status,
        }));
      }
    } else {
      queueCache = [];
    }
  } catch (err) {
    console.warn('[OFFLINE_QUEUE] Lỗi tải queue từ SecureStore:', err);
    queueCache = [];
  } finally {
    isLoaded = true;
    notifyListeners();
  }
  return queueCache;
}

// Tự động nạp queue khi file được nạp
loadOfflineQueue();

/** Lấy danh sách hàng đợi hiện tại */
export function getOfflineQueue(): OfflineQueueItem[] {
  return queueCache;
}

/** Thêm một tác vụ vào hàng đợi ngoại tuyến */
export async function enqueueOfflineAction(action: {
  description: string;
  url: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  data?: any;
}): Promise<OfflineQueueItem> {
  if (!isLoaded) {
    await loadOfflineQueue();
  }

  const newItem: OfflineQueueItem = {
    id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    description: action.description,
    url: action.url,
    method: action.method,
    data: action.data,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  };

  queueCache = [...queueCache, newItem];
  await persistQueue();
  notifyListeners();
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

  return newItem;
}

/** Xóa một tác vụ khỏi hàng đợi */
export async function removeQueueItem(id: string): Promise<void> {
  queueCache = queueCache.filter((item) => item.id !== id);
  await persistQueue();
  notifyListeners();
}

/** Xóa toàn bộ hàng đợi ngoại tuyến */
export async function clearOfflineQueue(): Promise<void> {
  queueCache = [];
  await persistQueue();
  notifyListeners();
}

/**
 * Xử lý tuần tự các tác vụ trong hàng đợi ngoại tuyến và gửi lên máy chủ
 */
export async function processOfflineQueue(
  onProgress?: (synced: number, total: number) => void
): Promise<{ success: number; failed: number; remaining: number }> {
  if (isProcessing) {
    return { success: 0, failed: 0, remaining: queueCache.length };
  }

  if (!isLoaded) {
    await loadOfflineQueue();
  }

  if (queueCache.length === 0) {
    return { success: 0, failed: 0, remaining: 0 };
  }

  isProcessing = true;
  notifyListeners();

  let successCount = 0;
  let failedCount = 0;
  const itemsToProcess = [...queueCache];

  // Tránh import vòng: import dynamic apiClient
  const { default: apiClient } = await import('../api/client');

  for (let i = 0; i < itemsToProcess.length; i++) {
    const item = itemsToProcess[i];

    // Cập nhật trạng thái đang gửi
    queueCache = queueCache.map((it) =>
      it.id === item.id ? { ...it, status: 'syncing' as const } : it
    );
    notifyListeners();

    try {
      const response = await apiClient.request({
        url: item.url,
        method: item.method,
        data: item.data,
        timeout: 10000,
      });

      if (response.status >= 200 && response.status < 300) {
        successCount++;
        // Gỡ bỏ tác vụ đã gửi thành công
        queueCache = queueCache.filter((it) => it.id !== item.id);
        await persistQueue();
        notifyListeners();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err: any) {
      failedCount++;
      const isNetworkError = !err.response;
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        err.message ||
        'Không thể kết nối máy chủ';

      queueCache = queueCache.map((it) =>
        it.id === item.id
          ? {
              ...it,
              status: 'failed' as const,
              retryCount: it.retryCount + 1,
              lastError: errorMsg,
            }
          : it
      );
      await persistQueue();
      notifyListeners();

      // Nếu là lỗi mất mạng, tạm dừng xử lý các tác vụ tiếp theo để tránh gọi thừa
      if (isNetworkError) {
        break;
      }
    }

    if (onProgress) {
      onProgress(i + 1, itemsToProcess.length);
    }
  }

  isProcessing = false;
  notifyListeners();

  if (successCount > 0) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return {
    success: successCount,
    failed: failedCount,
    remaining: queueCache.length,
  };
}

/** Kiểm tra trạng thái đang xử lý đồng bộ */
export function isOfflineQueueProcessing(): boolean {
  return isProcessing;
}

/** Hook React theo dõi danh sách hàng đợi ngoại tuyến (Reactive) */
export function useOfflineQueue(): OfflineQueueItem[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => queueCache,
    () => []
  );
}

/** Hook React theo dõi số lượng tác vụ đang chờ */
export function useOfflineQueueCount(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => queueCache.length,
    () => 0
  );
}

