import api from './api';

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
                    message: error.response?.data?.message || 'Không thể tải danh sách khuyến mãi.'
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
            const errDetail =
                error.response?.data?.code?.[0] ||
                error.response?.data?.name?.[0] ||
                error.response?.data?.message ||
                'Không thể tạo khuyến mãi mới.';
            return {
                success: false,
                message: errDetail
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
            const errDetail =
                error.response?.data?.code?.[0] ||
                error.response?.data?.name?.[0] ||
                error.response?.data?.message ||
                'Không thể cập nhật khuyến mãi.';
            return {
                success: false,
                message: errDetail
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
                message: error.response?.data?.message || 'Không thể xóa voucher khuyến mãi.'
            };
        }
    }
};

export default promotionService;
