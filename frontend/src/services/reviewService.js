import api from './api';

export const reviewService = {
    /**
     * Khách hàng gửi đánh giá mới
     * @param {Object} data { booking_id, cleanliness_score, service_score, location_score, value_score, comment }
     */
    async createReview(data) {
        try {
            const response = await api.post('/reviews/', data);
            return response.data;
        } catch (error) {
            console.error('Lỗi khi gửi đánh giá:', error);
            const resData = error.response?.data;
            let errMsg = 'Không thể gửi đánh giá. Vui lòng thử lại sau.';
            if (resData) {
                if (typeof resData === 'string') errMsg = resData;
                else if (resData.message) errMsg = resData.message;
                else if (resData.detail) errMsg = resData.detail;
                else {
                    const firstKey = Object.keys(resData)[0];
                    if (firstKey) {
                        const val = resData[firstKey];
                        errMsg = Array.isArray(val) ? val[0] : val;
                    }
                }
            }
            return {
                success: false,
                message: errMsg,
            };
        }
    },

    /**
     * Lấy danh sách đánh giá
     * @param {Object} params { room_category, booking, page... }
     */
    async getReviews(params = {}) {
        try {
            const response = await api.get('/reviews/', { params });
            // DRF ModelViewSet trả về array hoặc { results: [...] } nếu có pagination
            if (Array.isArray(response.data)) {
                return {
                    success: true,
                    data: response.data,
                    results: response.data,
                    count: response.data.length,
                    total_pages: 1,
                    current_page: 1
                };
            }
            if (response.data?.results) {
                return {
                    success: true,
                    data: response.data.results,
                    results: response.data.results,
                    count: response.data.count,
                    total_pages: response.data.total_pages || Math.ceil((response.data.count || 0) / 10) || 1,
                    current_page: response.data.current_page || 1
                };
            }
            return { success: true, data: response.data || [], results: response.data || [] };
        } catch (error) {
            console.error('Lỗi khi tải danh sách đánh giá:', error);
            return {
                success: false,
                data: [],
                results: [],
                count: 0,
                total_pages: 1,
                current_page: 1,
                message: error.response?.data?.detail || error.response?.data?.message || 'Không thể tải danh sách đánh giá.'
            };
        }
    },

    /**
     * Admin gửi hoặc cập nhật phản hồi đánh giá
     * @param {number|string} reviewId
     * @param {string} adminReply
     */
    async replyReview(reviewId, adminReply) {
        try {
            const response = await api.patch(`/reviews/${reviewId}/reply/`, {
                admin_reply: adminReply,
            });
            return response.data;
        } catch (error) {
            console.error('Lỗi khi gửi phản hồi đánh giá:', error);
            return {
                success: false,
                message: error.response?.data?.message || error.response?.data?.detail || 'Không thể gửi phản hồi.'
            };
        }
    },

    /**
     * Admin chuyển đổi trạng thái ẩn/hiện đánh giá
     * @param {number|string} reviewId
     * @param {boolean} [isVisible]
     */
    async toggleVisibility(reviewId, isVisible) {
        try {
            const payload = typeof isVisible === 'boolean' ? { is_visible: isVisible } : {};
            const response = await api.patch(`/reviews/${reviewId}/toggle-visibility/`, payload);
            return response.data;
        } catch (error) {
            console.error('Lỗi khi thay đổi trạng thái ẩn/hiện:', error);
            return {
                success: false,
                message: error.response?.data?.message || error.response?.data?.detail || 'Không thể thay đổi trạng thái.'
            };
        }
    },

    /**
     * Admin xóa đánh giá
     * @param {number|string} reviewId
     */
    async deleteReview(reviewId) {
        try {
            const response = await api.delete(`/reviews/${reviewId}/`);
            return response.data || { success: true };
        } catch (error) {
            console.error('Lỗi khi xóa đánh giá:', error);
            return {
                success: false,
                message: error.response?.data?.message || error.response?.data?.detail || 'Không thể xóa đánh giá.'
            };
        }
    }
};
