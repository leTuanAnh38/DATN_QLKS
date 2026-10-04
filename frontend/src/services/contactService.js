import api from './api';

// Chuẩn hóa thông báo lỗi từ response DRF
const extractError = (error, fallback) => {
    const data = error.response?.data;
    if (!data) return fallback;
    if (typeof data === 'string') return data;
    if (data.message && !data.errors) return data.message;
    if (data.errors) {
        const firstKey = Object.keys(data.errors)[0];
        const val = data.errors[firstKey];
        return Array.isArray(val) ? val[0] : val;
    }
    if (data.detail) return data.detail;
    return fallback;
};

export const contactService = {
    /**
     * Client gửi liên hệ (public - không cần token)
     * @param {Object} data { name, email, subject, message }
     */
    async sendContact(data) {
        try {
            const response = await api.post('/contacts/', data);
            return { success: true, message: response.data?.message };
        } catch (error) {
            console.error('Lỗi khi gửi liên hệ:', error);
            const throttled = error.response?.status === 429;
            return {
                success: false,
                message: throttled
                    ? 'Quý khách gửi quá nhiều yêu cầu, vui lòng thử lại sau ít phút.'
                    : extractError(error, 'Không thể gửi liên hệ. Vui lòng thử lại sau.'),
            };
        }
    },

    /**
     * Admin lấy danh sách liên hệ (phân trang + tìm kiếm + lọc)
     * @param {Object} params { page, page_size, search, is_read: 'true' | 'false' }
     */
    async getContacts(params = {}) {
        try {
            const query = { ...params };
            Object.keys(query).forEach((k) => {
                if (query[k] === '' || query[k] === undefined || query[k] === null) delete query[k];
            });
            const response = await api.get('/contacts/', { params: query });
            const data = response.data;
            if (Array.isArray(data)) {
                return { success: true, results: data, count: data.length, total_pages: 1, current_page: 1 };
            }
            return {
                success: true,
                results: data.results || [],
                count: data.count || 0,
                total_pages: data.total_pages || 1,
                current_page: data.current_page || 1,
            };
        } catch (error) {
            console.error('Lỗi khi tải danh sách liên hệ:', error);
            return {
                success: false,
                results: [],
                count: 0,
                total_pages: 1,
                current_page: 1,
                message: extractError(error, 'Không thể tải danh sách liên hệ.'),
            };
        }
    },

    /** Admin đánh dấu đã đọc: PATCH /contacts/{id}/read/ */
    async markAsRead(id) {
        try {
            const response = await api.patch(`/contacts/${id}/read/`);
            return { success: true, contact: response.data?.contact };
        } catch (error) {
            console.error('Lỗi khi đánh dấu đã đọc:', error);
            return { success: false, message: extractError(error, 'Không thể cập nhật trạng thái.') };
        }
    },

    /** Admin xóa liên hệ: DELETE /contacts/{id}/ */
    async deleteContact(id) {
        try {
            const response = await api.delete(`/contacts/${id}/`);
            return { success: true, message: response.data?.message };
        } catch (error) {
            console.error('Lỗi khi xóa liên hệ:', error);
            return { success: false, message: extractError(error, 'Không thể xóa liên hệ.') };
        }
    },
};
