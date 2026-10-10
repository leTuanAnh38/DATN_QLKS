import api from './api';

// Helper trích xuất thông báo lỗi chi tiết từ backend (DRF)
const extractErrorMessage = (error, defaultMsg) => {
    if (!error.response) return error.message || defaultMsg;
    const { status, data } = error.response;
    if (status === 403) {
        return data?.detail || 'Tài khoản của bạn không có quyền thực hiện thao tác này. Chỉ Quản lý (Manager) hoặc Admin mới có quyền tạo/sửa/xóa khuyến mãi.';
    }
    if (typeof data === 'string') return data;
    if (data?.detail) return data.detail;
    if (data?.message) return data.message;
    if (typeof data === 'object' && data !== null) {
        // DRF validation error format: { field: ["error1"] }
        const keys = Object.keys(data);
        if (keys.length > 0) {
            const firstKey = keys[0];
            const firstVal = data[firstKey];
            if (Array.isArray(firstVal) && firstVal.length > 0) {
                return `${firstKey}: ${firstVal[0]}`;
            }
            if (typeof firstVal === 'string') {
                return `${firstKey}: ${firstVal}`;
            }
        }
    }
    return defaultMsg;
};

export const promotionService = {
    /**
     * Lấy toàn bộ danh sách khuyến mãi / voucher
     */
    async getPromotions() {
        try {
            const response = await api.get('/promotions/');
            const list = Array.isArray(response.data) ? response.data : (response.data?.results || response.data?.data || []);
            return {
                success: true,
                data: list
            };
        } catch (error) {
            console.error('Lỗi khi tải danh sách khuyến mãi:', error);
            // Fallback thử endpoint phụ nếu có
            try {
                const fallbackRes = await api.get('/bookings/promotions/');
                const list = Array.isArray(fallbackRes.data) ? fallbackRes.data : (fallbackRes.data?.results || fallbackRes.data?.data || []);
                return {
                    success: true,
                    data: list
                };
            } catch (fbErr) {
                return {
                    success: false,
                    data: [],
                    message: extractErrorMessage(error, 'Không thể tải danh sách khuyến mãi.')
                };
            }
        }
    },

    /**
     * Thêm mới một voucher khuyến mãi
     * @param {Object} data
     */
    async createPromotion(data) {
        try {
            const response = await api.post('/promotions/', data);
            return {
                success: true,
                data: response.data,
                message: 'Tạo voucher khuyến mãi mới thành công!'
            };
        } catch (error) {
            console.error('Lỗi khi tạo khuyến mãi:', error);
            return {
                success: false,
                message: extractErrorMessage(error, 'Không thể tạo khuyến mãi mới.')
            };
        }
    },

    /**
     * Cập nhật thông tin voucher khuyến mãi
     * @param {number|string} id
     * @param {Object} data
     */
    async updatePromotion(id, data) {
        try {
            const response = await api.put(`/promotions/${id}/`, data);
            return {
                success: true,
                data: response.data,
                message: 'Cập nhật voucher khuyến mãi thành công!'
            };
        } catch (error) {
            console.error('Lỗi khi cập nhật khuyến mãi:', error);
            return {
                success: false,
                message: extractErrorMessage(error, 'Không thể cập nhật khuyến mãi.')
            };
        }
    },

    /**
     * Xóa một voucher khuyến mãi
     * @param {number|string} id
     */
    async deletePromotion(id) {
        try {
            await api.delete(`/promotions/${id}/`);
            return {
                success: true,
                message: 'Đã xóa voucher khuyến mãi thành công!'
            };
        } catch (error) {
            console.error('Lỗi khi xóa khuyến mãi:', error);
            return {
                success: false,
                message: extractErrorMessage(error, 'Không thể xóa voucher khuyến mãi.')
            };
        }
    }
};

export default promotionService;
