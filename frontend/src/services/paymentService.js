import api from './api';

export const paymentService = {
    /**
     * Xác nhận thanh toán chuyển khoản VietQR cho đơn đặt phòng
     * @param {Object} payload - { booking_id, amount, payment_method }
     */
    async confirmPayment(payload) {
        try {
            const response = await api.post('/payments/confirm/', payload);
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('pms_payment_completed'));
                try { localStorage.setItem('pms_last_payment_event', Date.now().toString()); } catch { }
            }
            return response.data;
        } catch (error) {
            console.error('Lỗi khi xác nhận thanh toán:', error);
            throw error;
        }
    },

    /**
     * Xác nhận thanh toán cho một giao dịch theo paymentId (PENDING -> COMPLETED)
     * @param {number|string} paymentId
     * @param {Object} payload - { payment_method, note }
     */
    async confirmPaymentById(paymentId, payload = {}) {
        try {
            const response = await api.post(`/payments/${paymentId}/confirm/`, payload);
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('pms_payment_completed'));
                try { localStorage.setItem('pms_last_payment_event', Date.now().toString()); } catch { }
            }
            return response.data;
        } catch (error) {
            console.error(`Lỗi khi xác nhận thanh toán #${paymentId}:`, error);
            throw error;
        }
    },

    /**
     * Thu tiền mặt hoặc thanh toán trực tiếp tại quầy cho đơn đặt phòng
     * @param {Object} payload - { booking_id, amount, payment_method, note }
     */
    async collectCash(payload) {
        try {
            const response = await api.post('/payments/confirm/', {
                payment_method: 'CASH',
                ...payload
            });
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('pms_payment_completed'));
                try { localStorage.setItem('pms_last_payment_event', Date.now().toString()); } catch { }
            }
            return response.data;
        } catch (error) {
            console.error('Lỗi khi thu tiền mặt tại quầy:', error);
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
    },

    /**
     * Lấy ca làm việc đang mở hiện tại của người dùng
     */
    async getCurrentShift() {
        try {
            const response = await api.get('/payments/shifts/current/');
            return response.data;
        } catch (error) {
            console.error('Lỗi khi lấy thông tin ca hiện tại:', error);
            throw error;
        }
    },

    /**
     * Mở ca làm việc mới
     * @param {Object} payload - { shift_type, opening_cash, notes }
     */
    async openShift(payload) {
        try {
            const response = await api.post('/payments/shifts/open/', payload);
            return response.data;
        } catch (error) {
            console.error('Lỗi khi mở ca làm việc:', error);
            throw error;
        }
    },

    /**
     * Đóng ca làm việc và kiểm đếm tiền mặt
     * @param {number|string} shiftId
     * @param {Object} payload - { actual_cash, handover_user_id, notes, denominations }
     */
    async closeShift(shiftId, payload) {
        try {
            const response = await api.post(`/payments/shifts/${shiftId}/close/`, payload);
            return response.data;
        } catch (error) {
            console.error(`Lỗi khi đóng ca #${shiftId}:`, error);
            throw error;
        }
    },

    /**
     * Lấy tóm tắt tài chính và danh sách giao dịch trong ca
     * @param {number|string} shiftId
     */
    async getShiftSummary(shiftId) {
        try {
            const response = await api.get(`/payments/shifts/${shiftId}/summary/`);
            return response.data;
        } catch (error) {
            console.error(`Lỗi khi lấy tóm tắt ca #${shiftId}:`, error);
            throw error;
        }
    },

    /**
     * Lấy danh sách lịch sử các ca làm việc
     * @param {Object} params - { status, shift_type, start_date, end_date, search }
     */
    async getShifts(params = {}) {
        try {
            const response = await api.get('/payments/shifts/', { params });
            return response.data;
        } catch (error) {
            console.error('Lỗi khi lấy danh sách ca làm việc:', error);
            throw error;
        }
    },

    /**
     * Lấy báo cáo kết ca chuẩn Z-Report
     * @param {number|string} shiftId
     */
    async getShiftReport(shiftId) {
        try {
            const response = await api.get(`/payments/shifts/${shiftId}/report/`);
            return response.data;
        } catch (error) {
            console.error(`Lỗi khi lấy báo cáo Z-Report ca #${shiftId}:`, error);
            throw error;
        }
    },

    /**
     * Lập phiếu chi tiền mặt hoặc hoàn tiền (Refund / Petty Cash Out)
     * @param {Object} payload - { voucher_type, payment_method, amount, recipient_name, recipient_phone, reason, approved_by, booking_id, group_booking_id }
     */
    async createCashOut(payload) {
        try {
            const response = await api.post('/payments/cash-outs/', payload);
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('pms_payment_completed'));
                try { localStorage.setItem('pms_last_payment_event', Date.now().toString()); } catch { }
            }
            return response.data;
        } catch (error) {
            console.error('Lỗi khi lập phiếu chi:', error);
            throw error;
        }
    },

    /**
     * Lấy danh sách phiếu chi tiền & hoàn cọc
     * @param {Object} params - { shift_id, voucher_type, payment_method, search }
     */
    async getCashOuts(params = {}) {
        try {
            const response = await api.get('/payments/cash-outs/list/', { params });
            return response.data;
        } catch (error) {
            console.error('Lỗi khi lấy danh sách phiếu chi:', error);
            throw error;
        }
    }
};

export default paymentService;
