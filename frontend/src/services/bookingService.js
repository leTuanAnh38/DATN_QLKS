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
                code: error.response?.data?.code,
                suggested_categories: error.response?.data?.suggested_categories || [],
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
    },

    /**
     * Lấy danh sách các phòng thực tế đang trống (status='available')
     * thuộc đúng hạng phòng của đơn đặt phòng
     * @param {number|string} bookingId
     * @param {number|string} [categoryId]
     */
    async getAvailableRoomsForBooking(bookingId, categoryId = null) {
        try {
            const params = categoryId ? { category_id: categoryId } : {};
            const response = await api.get(`/bookings/${bookingId}/available-rooms/`, { params });
            return response.data;
        } catch (error) {
            console.error('Lỗi khi tải danh sách phòng trống:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể tải danh sách phòng trống.',
                rooms: []
            };
        }
    },

    /**
     * Thực hiện thủ tục Check-in cho đơn đặt phòng (POST /api/bookings/:id/check-in/)
     * @param {number|string} bookingId
     * @param {Object} payload - { room_id, internal_note, allow_upgrade }
     */
    async checkInBooking(bookingId, payload) {
        try {
            const response = await api.post(`/bookings/${bookingId}/check-in/`, payload);
            const data = response.data?.booking || response.data?.data || response.data;
            return {
                success: true,
                message: response.data?.message || 'Thực hiện Check-in thành công!',
                data,
                room: response.data?.room
            };
        } catch (error) {
            console.error('Lỗi khi thực hiện Check-in:', error);
            return {
                success: false,
                message:
                    error.response?.data?.message ||
                    error.response?.data?.detail ||
                    'Thực hiện Check-in thất bại. Vui lòng kiểm tra lại tình trạng phòng.'
            };
        }
    },

    /**
     * Tạo đơn đặt phòng và Check-in đồng thời cho Khách vãng lai (Walk-in Guest)
     * POST /api/bookings/walk-in/
     * @param {Object} payload - { guest_name, guest_phone, identity_card, guest_email, room_id, check_out_date, note, internal_note, total_amount }
     */
    async createWalkInBooking(payload) {
        try {
            const response = await api.post('/bookings/walk-in/', payload);
            const data = response.data?.booking || response.data?.data || response.data;
            return {
                success: true,
                message: response.data?.message || 'Tiếp đón khách Walk-in thành công!',
                data,
                room: response.data?.room
            };
        } catch (error) {
            console.error('Lỗi khi tiếp đón khách Walk-in:', error);
            return {
                success: false,
                message:
                    error.response?.data?.message ||
                    error.response?.data?.detail ||
                    'Không thể thực hiện tiếp đón khách Walk-in. Vui lòng kiểm tra lại thông tin.'
            };
        }
    },

    /**
     * Kiểm tra số phòng còn trống của hạng phòng theo khoảng ngày Check-in/Check-out
     * GET /api/bookings/check-availability/?category_id=...&check_in_date=...&check_out_date=...
     */
    async checkAvailability(params) {
        try {
            const response = await api.get('/bookings/check-availability/', { params });
            return response.data;
        } catch (error) {
            console.error('Lỗi khi kiểm tra phòng trống:', error);
            return {
                success: false,
                is_sold_out: false,
                available_rooms: null,
                message: error.response?.data?.message || 'Không thể kiểm tra tình trạng phòng.'
            };
        }
    }
};

export default bookingService;