import api from './api';

export const notificationService = {
    /**
     * Lấy danh sách thông báo của người dùng
     * @param {Object} params - { unread_only: true, is_read: false, ... }
     */
    getNotifications: async (params = {}) => {
        try {
            const response = await api.get('/notifications/', { params });
            // Chuẩn hóa dữ liệu trả về từ backend (hỗ trợ cả DRF array hoặc custom response object)
            const rawData = response.data;
            let list = [];
            let unreadCount = 0;

            if (Array.isArray(rawData)) {
                list = rawData;
                unreadCount = list.filter((n) => !n.is_read).length;
            } else if (rawData && Array.isArray(rawData.results)) {
                list = rawData.results;
                unreadCount = rawData.unread_count !== undefined
                    ? rawData.unread_count
                    : list.filter((n) => !n.is_read).length;
            } else if (rawData && Array.isArray(rawData.data)) {
                list = rawData.data;
                unreadCount = rawData.unread_count !== undefined
                    ? rawData.unread_count
                    : list.filter((n) => !n.is_read).length;
            }

            return {
                success: true,
                data: list,
                unread_count: unreadCount,
                raw: rawData
            };
        } catch (error) {
            console.error('Lỗi khi tải thông báo:', error);
            return {
                success: false,
                data: [],
                unread_count: 0,
                message: error.response?.data?.detail || error.message
            };
        }
    },

    /**
     * Đánh dấu một thông báo đã đọc
     * @param {number|string} id 
     */
    markAsRead: async (id) => {
        try {
            const response = await api.patch(`/notifications/${id}/read/`);
            return {
                success: true,
                data: response.data?.data || response.data,
                unread_count: response.data?.unread_count
            };
        } catch (error) {
            console.error(`Lỗi khi đánh dấu đã đọc thông báo #${id}:`, error);
            return {
                success: false,
                message: error.response?.data?.detail || error.message
            };
        }
    },

    /**
     * Đánh dấu tất cả thông báo của người dùng là đã đọc
     */
    markAllAsRead: async () => {
        try {
            const response = await api.patch('/notifications/read-all/');
            return {
                success: true,
                data: response.data,
                updated_count: response.data?.updated_count || 0
            };
        } catch (error) {
            console.error('Lỗi khi đánh dấu đọc tất cả thông báo:', error);
            return {
                success: false,
                message: error.response?.data?.detail || error.message
            };
        }
    },

    /**
     * Lấy nhanh số lượng thông báo chưa đọc
     */
    getUnreadCount: async () => {
        try {
            const response = await api.get('/notifications/unread-count/');
            return {
                success: true,
                unread_count: response.data?.unread_count || 0
            };
        } catch (error) {
            return {
                success: false,
                unread_count: 0
            };
        }
    }
};

export default notificationService;
