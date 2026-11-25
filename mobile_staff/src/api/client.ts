import axios from 'axios';
import { getApiBaseUrl } from './config';
import { getAccessToken, getRefreshToken, saveAuthTokens, clearAuthData } from '../services/authStorage';
import { setServerOffline } from '../services/connectionStatus';

const authExpiredListeners = new Set<() => void>();

/** Đăng ký callback khi phiên đăng nhập hết hạn hoàn toàn (refresh token thất bại) */
export function subscribeAuthExpired(listener: () => void): () => void {
  authExpiredListeners.add(listener);
  return () => {
    authExpiredListeners.delete(listener);
  };
}

function notifyAuthExpired() {
  authExpiredListeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

// Single-flight mutex tránh gọi /token/refresh/ song song khi nhiều polling cùng dính 401
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessTokenOnce(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return null;

      const baseURL = await getApiBaseUrl();
      const refreshRes = await axios.post(
        `${baseURL}/users/token/refresh/`,
        { refresh: refreshToken },
        { timeout: 10000 }
      );
      const newAccess = refreshRes.data?.access;
      const newRefresh = refreshRes.data?.refresh;
      if (newAccess) {
        await saveAuthTokens(newAccess, newRefresh);
        return newAccess;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

const apiClient = axios.create({
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// Request Interceptor: Luôn cập nhật baseURL động và gắn token
apiClient.interceptors.request.use(
  async (config) => {
    const baseURL = await getApiBaseUrl();
    config.baseURL = baseURL;
    apiClient.defaults.baseURL = baseURL;

    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Nếu gửi FormData (upload ảnh), xóa Content-Type mặc định để runtime tự gắn multipart/form-data kèm boundary chuẩn
    if (config.data instanceof FormData) {
      if (typeof (config.headers as any)?.delete === 'function') {
        (config.headers as any).delete('Content-Type');
      } else {
        delete config.headers['Content-Type'];
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Tự động refresh token nếu 401 (có mutex chống race condition + thông báo AuthContext khi hết hạn)
apiClient.interceptors.response.use(
  (response) => {
    setServerOffline(false);
    return response;
  },
  async (error) => {
    // Không có response = mất mạng / timeout / server không phản hồi
    setServerOffline(!error.response);
    const originalRequest = error.config;
    const isAuthEndpoint =
      typeof originalRequest?.url === 'string' &&
      (originalRequest.url.includes('/users/login/') || originalRequest.url.includes('/users/token/refresh/'));

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      const newAccess = await refreshAccessTokenOnce();
      if (newAccess) {
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return apiClient(originalRequest);
      }

      // Refresh thất bại -> Xóa phiên đăng nhập và thông báo AuthContext chuyển về màn hình Login
      const hadToken = Boolean(await getAccessToken() || await getRefreshToken());
      await clearAuthData();
      if (hadToken) {
        notifyAuthExpired();
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
