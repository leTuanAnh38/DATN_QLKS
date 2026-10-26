import axios from 'axios';
import { getApiBaseUrl } from './config';
import { getAccessToken, getRefreshToken, saveAuthTokens, clearAuthData } from '../services/authStorage';

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

    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Nếu gửi FormData (upload ảnh đồ thất lạc), xóa Content-Type mặc định để axios/runtime tự gắn multipart/form-data với boundary chuẩn
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Tự động refresh token nếu 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await getRefreshToken();
        if (refreshToken) {
          const baseURL = await getApiBaseUrl();
          const refreshRes = await axios.post(`${baseURL}/users/token/refresh/`, {
            refresh: refreshToken,
          });
          const newAccess = refreshRes.data.access;
          if (newAccess) {
            await saveAuthTokens(newAccess);
            originalRequest.headers.Authorization = `Bearer ${newAccess}`;
            return apiClient(originalRequest);
          }
        }
      } catch (refreshErr) {
        // Token refresh thất bại -> Clear auth để logout
        await clearAuthData();
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
