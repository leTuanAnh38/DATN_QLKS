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

            const totalCount = rawData?.total_count !== undefined
                ? rawData.total_count
                : (rawData?.count !== undefined ? rawData.count : list.length);
            const allCount = rawData?.all_count !== undefined ? rawData.all_count : totalCount;
            const hasNext = Boolean(rawData?.next || rawData?.has_next);

            return {
                success: true,
                data: list,
                unread_count: unreadCount,
                total_count: totalCount,
                all_count: allCount,
                has_next: hasNext,
                raw: rawData
            };
        } catch (error) {
            console.error('Lỗi khi tải thông báo:', error);
            return {
                success: false,
                data: [],
                unread_count: 0,
                total_count: 0,
                has_next: false,
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
     * Xóa tất cả thông báo đã đọc của người dùng
     */
    clearRead: async () => {
        try {
            const response = await api.delete('/notifications/clear-read/');
            return {
                success: true,
                data: response.data,
                deleted_count: response.data?.deleted_count || 0,
                unread_count: response.data?.unread_count || 0
            };
        } catch (error) {
            console.error('Lỗi khi dọn dẹp thông báo đã đọc:', error);
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
    },

    /**
     * Kích hoạt quét và gửi nhắc nhở Check-in & Check-out hôm nay
     * @param {boolean} force - true nếu muốn gửi lại kể cả khi đã gửi hôm nay
     */
    triggerReminders: async (force = false) => {
        try {
            const response = await api.post('/notifications/trigger-reminders/', { force });
            return {
                success: true,
                message: response.data?.message || 'Đã kích hoạt quét thông báo thành công',
                data: response.data?.data
            };
        } catch (error) {
            console.error('Lỗi khi kích hoạt thông báo checkin/checkout:', error);
            return {
                success: false,
                message: error.response?.data?.message || error.message
            };
        }
    },

    /**
     * Gửi thông báo nhắc nhở riêng cho 1 đơn đặt phòng cụ thể
     * @param {number|string} bookingId 
     * @param {string} reminderType - 'check_in' | 'check_out' | 'auto'
     */
    remindBooking: async (bookingId, reminderType = 'auto', notifyGuest = true, notifyStaff = false) => {
        try {
            const response = await api.post('/notifications/remind-booking/', {
                booking_id: bookingId,
                reminder_type: reminderType,
                notify_guest: notifyGuest,
                notify_staff: notifyStaff
            });
            return {
                success: true,
                message: response.data?.message || 'Đã gửi thông báo nhắc nhở thành công',
                created_count: response.data?.created_count
            };
        } catch (error) {
            console.error(`Lỗi khi gửi nhắc nhở cho đơn #${bookingId}:`, error);
            return {
                success: false,
                message: error.response?.data?.message || error.message
            };
        }
    }
};

export default notificationService;
