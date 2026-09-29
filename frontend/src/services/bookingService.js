import api from './api';

export const bookingService = {
    /**
     * Gửi yêu cầu đặt phòng mới tới API /api/bookings/
     * @param {Object} payload - { room, check_in_date, check_out_date, guest_name, guest_phone, guest_email, promo_code, note }
     */
    async createBooking(payload) {
        try {
            const response = await api.post('/bookings/', payload);
            return response.data;
        } catch (error) {
            console.error('Lỗi khi tạo đơn đặt phòng:', error);
            return {
                success: false,
                message:
                    error.response?.data?.message ||
                    error.response?.data?.detail ||
                    'Không thể gửi yêu cầu đặt phòng. Vui lòng kiểm tra lại thông tin.'
            };
        }
    },

    /**
     * Kiểm tra tính hợp lệ của mã giảm giá (Promo Code)
     * @param {string} code 
     * @param {number} orderValue 
     */
    async validatePromoCode(code, orderValue) {
        try {
            const response = await api.post('/bookings/validate-promo/', {
                code,
                order_value: orderValue
            });
            return response.data;
        } catch (error) {
            return {
                valid: false,
                message: error.response?.data?.message || 'Mã giảm giá không hợp lệ hoặc đã hết hạn.'
            };
        }
    },

    /**
     * Lấy danh sách lịch sử đặt phòng của tài khoản đang đăng nhập
     */
    async getMyBookings() {
        try {
            const response = await api.get('/bookings/');
            let list = [];
            if (Array.isArray(response.data)) {
                list = response.data;
            } else if (response.data && Array.isArray(response.data.results)) {
                list = response.data.results;
            } else if (response.data && Array.isArray(response.data.data)) {
                list = response.data.data;
            }
            return { success: true, data: list };
        } catch (error) {
            console.error('Lỗi khi tải lịch sử đặt phòng:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể tải danh sách đơn đặt phòng.',
                data: []
            };
        }
    },

    /**
     * Hủy đơn đặt phòng khi đang chờ duyệt (PATCH /api/bookings/:id/)
     * @param {number|string} id 
     * @param {string} cancelReason
     */
    async cancelBooking(id, cancelReason = '') {
        try {
            const response = await api.patch(`/bookings/${id}/`, {
                status: 'cancelled',
                cancel_reason: cancelReason || 'Khách hàng yêu cầu hủy đơn'
            });
            return response.data;
        } catch (error) {
            console.error('Lỗi khi hủy đơn đặt phòng:', error);
            return {
                success: false,
                message:
                    error.response?.data?.message ||
                    error.response?.data?.detail ||
                    'Không thể hủy đơn đặt phòng. Vui lòng thử lại sau.'
            };
        }
    },

    /**
     * Cập nhật trạng thái đơn đặt phòng nhanh cho Lễ tân / Quản trị (PATCH /api/bookings/:id/)
     * @param {number|string} id 
     * @param {string} status ('pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled')
     */
    async updateBookingStatus(id, status) {
        try {
            const response = await api.patch(`/bookings/${id}/`, { status });
            const data = response.data?.booking || response.data?.data || response.data;
            return { success: true, data, message: response.data?.message };
        } catch (error) {
            console.error('Lỗi khi cập nhật trạng thái đơn đặt phòng:', error);
            return {
                success: false,
                message:
                    error.response?.data?.message ||
                    error.response?.data?.detail ||
                    'Không thể cập nhật trạng thái đơn đặt phòng.'
            };
        }
    },

    /**
     * Cập nhật thông tin đơn đặt phòng (PATCH /api/bookings/:id/)
     * @param {number|string} id 
     * @param {Object} payload
     */
    async updateBooking(id, payload) {
        try {
            const response = await api.patch(`/bookings/${id}/`, payload);
            return { success: true, data: response.data };
        } catch (error) {
            console.error('Lỗi khi cập nhật đơn đặt phòng:', error);
            return {
                success: false,
                message:
                    error.response?.data?.message ||
                    error.response?.data?.detail ||
                    'Không thể cập nhật đơn đặt phòng.'
            };
        }
    },

    /**
     * Lấy chi tiết một đơn đặt phòng theo ID hoặc booking_code
     * @param {number|string} id 
     */
    async getBookingDetail(id) {
        try {
            const response = await api.get(`/bookings/${id}/`);
            return response.data;
        } catch (error) {
            console.error('Lỗi khi tải chi tiết đơn đặt phòng:', error);
            return null;
        }
    }
};

export default bookingService;