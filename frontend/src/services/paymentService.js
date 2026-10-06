import api from './api';

export const paymentService = {
    /**
     * Xác nhận thanh toán chuyển khoản VietQR cho đơn đặt phòng
     * @param {Object} payload - { booking_id, amount, payment_method }
     */
    async confirmPayment(payload) {
        try {
            const response = await api.post('/payments/confirm/', payload);
            return response.data;
        } catch (error) {
            console.error('Lỗi khi xác nhận thanh toán:', error);
            throw error;
        }
    },

    /**
     * Lấy danh sách giao dịch thanh toán (Admin)
     * @param {Object} params - { search, status }
     */
    async getPayments(params = {}) {
        try {
            const response = await api.get('/payments/', { params });
            return response.data;
        } catch (error) {
            console.error('Lỗi khi lấy danh sách thanh toán:', error);
            throw error;
        }
    }
};
