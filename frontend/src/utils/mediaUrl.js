/**
 * Helper chuẩn hóa đường dẫn Backend Origin và Media URL (ảnh phòng, avatar, dịch vụ, biên lai...)
 * Tự động tương thích khi truy cập từ localhost hoặc qua IP mạng LAN (điện thoại, tablet) hoặc biến môi trường VITE_API_URL.
 */

export const getBackendOrigin = () => {
    const envBackend = import.meta.env.VITE_BACKEND_URL;
    if (envBackend) {
        return envBackend.trim().replace(/\/+$/, '');
    }

    const envApi = import.meta.env.VITE_API_URL;
    if (envApi) {
        const originFromApi = envApi.trim().replace(/\/api\/?$/, '').replace(/\/+$/, '');
        // Nếu truy cập qua mạng LAN nội bộ mà envApi đang để localhost/127.0.0.1,
        // tự động ánh xạ sang IP LAN hiện tại của trình duyệt
        if (
            typeof window !== 'undefined' &&
            window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1' &&
            !window.location.hostname.endsWith('.railway.app') &&
            (originFromApi.includes('localhost') || originFromApi.includes('127.0.0.1'))
        ) {
            return `${window.location.protocol}//${window.location.hostname}:8000`;
        }
        return originFromApi;
    }

    if (
        typeof window !== 'undefined' &&
        window.location.hostname &&
        window.location.hostname.endsWith('.railway.app')
    ) {
        return 'https://backend-production-59387ae6.up.railway.app';
    }

    if (
        typeof window !== 'undefined' &&
        window.location.hostname &&
        !window.location.hostname.endsWith('.railway.app')
    ) {
        return `${window.location.protocol}//${window.location.hostname}:8000`;
    }

    return 'http://localhost:8000';
};

export const getApiBaseUrl = () => {
    const envApi = import.meta.env.VITE_API_URL;
    if (envApi && envApi.trim()) {
        const cleanApi = envApi.trim().replace(/\/+$/, '');
        if (!cleanApi.includes('localhost') && !cleanApi.includes('127.0.0.1')) {
            return cleanApi.endsWith('/api') ? cleanApi : `${cleanApi}/api`;
        }
    }
    return `${getBackendOrigin()}/api`;
};

export const resolveMediaUrl = (url, fallback = null) => {
    if (!url || typeof url !== 'string') return fallback;
    const trimmed = url.trim();
    if (!trimmed) return fallback;

    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
        return trimmed;
    }

    const backendOrigin = getBackendOrigin();

    // Nếu Backend trả về URL tuyệt đối chứa localhost/127.0.0.1:8000 nhưng người dùng đang mở trên Cloud hoặc IP LAN,
    // tự động chuyển đổi sang origin thực tế để ảnh hiển thị được
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        if (
            typeof window !== 'undefined' &&
            window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1' &&
            (trimmed.startsWith('http://localhost:') || trimmed.startsWith('http://127.0.0.1:') || trimmed.startsWith('http://localhost/') || trimmed.startsWith('http://127.0.0.1/'))
        ) {
            return trimmed.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, backendOrigin);
        }
        // Tự động nâng cấp http -> https cho các domain Railway để tránh lỗi Mixed Content
        if (trimmed.startsWith('http://') && trimmed.includes('.up.railway.app')) {
            return trimmed.replace(/^http:\/\//, 'https://');
        }
        return trimmed;
    }

    return `${backendOrigin}/${trimmed.replace(/^\/+/, '')}`;
};

export default resolveMediaUrl;

