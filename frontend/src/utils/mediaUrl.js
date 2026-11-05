/**
 * Helper chuẩn hóa đường dẫn Backend Origin và Media URL (ảnh phòng, avatar, dịch vụ, biên lai...)
 * Tự động tương thích khi truy cập từ localhost hoặc qua IP mạng LAN (điện thoại, tablet) hoặc biến môi trường VITE_API_URL.
 */

export const getBackendOrigin = () => {
    const envBackend = import.meta.env.VITE_BACKEND_URL;
    if (envBackend) {
        return envBackend.replace(/\/+$/, '');
    }

    const envApi = import.meta.env.VITE_API_URL;
    if (envApi) {
        const originFromApi = envApi.replace(/\/api\/?$/, '').replace(/\/+$/, '');
        // Nếu truy cập qua mạng LAN (hostname không phải localhost) mà envApi lại để localhost/127.0.0.1,
        // tự động ánh xạ sang IP LAN hiện tại của trình duyệt
        if (
            typeof window !== 'undefined' &&
            window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1' &&
            (originFromApi.includes('localhost') || originFromApi.includes('127.0.0.1'))
        ) {
            return `${window.location.protocol}//${window.location.hostname}:8000`;
        }
        return originFromApi;
    }

    if (typeof window !== 'undefined' && window.location.hostname) {
        return `${window.location.protocol}//${window.location.hostname}:8000`;
    }

    return 'http://127.0.0.1:8000';
};

export const getApiBaseUrl = () => {
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

    // Nếu Backend trả về URL tuyệt đối chứa localhost/127.0.0.1:8000 nhưng người dùng đang mở qua IP LAN,
    // tự động chuyển đổi sang origin thực tế để ảnh hiển thị được trên điện thoại
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        if (
            typeof window !== 'undefined' &&
            window.location.hostname !== 'localhost' &&
            window.location.hostname !== '127.0.0.1' &&
            (trimmed.startsWith('http://localhost:8000') || trimmed.startsWith('http://127.0.0.1:8000'))
        ) {
            return trimmed.replace(/^http:\/\/(localhost|127\.0\.0\.1):8000/, backendOrigin);
        }
        return trimmed;
    }

    return `${backendOrigin}/${trimmed.replace(/^\/+/, '')}`;
};

export default resolveMediaUrl;

