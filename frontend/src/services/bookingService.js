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
     * Lấy danh sách lịch sử đặt phòng của tài khoản đang đăng nhập (có hỗ trợ phân trang params: { page, page_size })
     */
    async getMyBookings(params = {}) {
        try {
            const response = await api.get('/bookings/', { params });
            let list = [];
            let count = 0;
            let totalPages = 1;

            if (Array.isArray(response.data)) {
                list = response.data;
                count = list.length;
                totalPages = Math.ceil(count / 10) || 1;
            } else if (response.data && Array.isArray(response.data.results)) {
                list = response.data.results;
                count = response.data.count || list.length;
                totalPages = response.data.total_pages || Math.ceil(count / 10) || 1;
            } else if (response.data && Array.isArray(response.data.data)) {
                list = response.data.data;
                count = list.length;
                totalPages = Math.ceil(count / 10) || 1;
            }

            return {
                success: true,
                data: list,
                results: list,
                count: count,
                totalPages: totalPages,
                currentPage: response.data?.current_page || params.page || 1
            };
        } catch (error) {
            console.error('Lỗi khi tải lịch sử đặt phòng:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể tải danh sách đơn đặt phòng.',
                data: [],
                results: [],
                count: 0,
                totalPages: 1
            };
        }
    },

    /**
     * Lấy toàn bộ số liệu thống kê thực tế, đồng bộ cho Dashboard
     * @param {Object} params - { time_filter: 'today' | '7days' | 'month' | 'year' }
     */
    async getDashboardStats(params = {}) {
        try {
            const response = await api.get('/bookings/dashboard-stats/', { params });
            return response.data;
        } catch (error) {
            console.error('Lỗi khi tải số liệu thống kê Dashboard:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể tải số liệu thống kê Dashboard.'
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
            // Thử gọi endpoint cancel-booking (hỗ trợ cả id lẫn booking_code)
            const response = await api.post('/bookings/cancel-booking/', {
                booking_id: id,
                reason: cancelReason || 'Khách hàng yêu cầu hủy đơn'
            });
            try {
                localStorage.setItem('pms_last_booking_event', Date.now().toString());
                window.dispatchEvent(new Event('pms_booking_created'));
            } catch {}
            return response.data;
        } catch (error) {
            // Fallback sang PATCH /bookings/:id/ nếu cần
            try {
                const response = await api.patch(`/bookings/${id}/`, {
                    status: 'cancelled',
                    cancel_reason: cancelReason || 'Khách hàng yêu cầu hủy đơn'
                });
                try {
                    localStorage.setItem('pms_last_booking_event', Date.now().toString());
                    window.dispatchEvent(new Event('pms_booking_created'));
                } catch {}
                return response.data;
            } catch (err2) {
                console.error('Lỗi khi hủy đơn đặt phòng:', err2);
                return {
                    success: false,
                    message:
                        err2.response?.data?.message ||
                        error.response?.data?.message ||
                        'Không thể hủy đơn đặt phòng. Vui lòng thử lại.'
                };
            }
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
     * @param {number|string} bookingId
     * @param {number|string} [categoryId]
     * @param {boolean} [allCategories]
     */
    async getAvailableRoomsForBooking(bookingId, categoryId = null, allCategories = false) {
        try {
            const params = {};
            if (allCategories) {
                params.all_categories = 'true';
            } else if (categoryId) {
                params.category_id = categoryId;
            }
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
     * Thực hiện Đổi phòng (Room Move) cho khách đang lưu trú
     * POST /api/bookings/:id/change-room/
     * @param {number|string} bookingId
     * @param {Object} payload - { new_room_id, reason, old_room_status, maintenance_equipment, maintenance_issue_type, maintenance_description }
     */
    async changeRoom(bookingId, payload) {
        try {
            const response = await api.post(`/bookings/${bookingId}/change-room/`, payload);
            return {
                success: true,
                message: response.data?.message || 'Đổi phòng thành công!',
                data: response.data
            };
        } catch (error) {
            console.error('Lỗi khi đổi phòng:', error);
            return {
                success: false,
                message:
                    error.response?.data?.message ||
                    error.response?.data?.detail ||
                    'Đổi phòng thất bại. Vui lòng kiểm tra lại trạng thái phòng.'
            };
        }
    },

    /**
     * Đánh dấu khách không đến (No-Show) và giải phóng phòng
     * POST /api/bookings/:id/no-show/
     * @param {number|string} bookingId
     * @param {Object} [payload] - { reason }
     */
    async markNoShow(bookingId, payload = {}) {
        try {
            const response = await api.post(`/bookings/${bookingId}/no-show/`, payload);
            return {
                success: true,
                message: response.data?.message || 'Đã đánh dấu Khách không đến (No-Show) thành công.',
                data: response.data
            };
        } catch (error) {
            console.error('Lỗi khi đánh dấu No-Show:', error);
            return {
                success: false,
                message:
                    error.response?.data?.message ||
                    error.response?.data?.detail ||
                    'Không thể thực hiện đánh dấu No-Show.'
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
     * Gia hạn thời gian lưu trú (POST /api/bookings/:id/extend-stay/)
     * @param {number|string} bookingId
     * @param {string} newCheckOutDate - Định dạng YYYY-MM-DD
     */
    async extendStay(bookingId, newCheckOutDate) {
        try {
            const response = await api.post(`/bookings/${bookingId}/extend-stay/`, {
                new_check_out_date: newCheckOutDate
            });
            return response.data;
        } catch (error) {
            console.error('Lỗi khi gia hạn thời gian lưu trú:', error);
            const errData = error.response?.data;
            return {
                success: false,
                conflict: errData?.conflict || false,
                conflicting_booking_code: errData?.conflicting_booking_code || null,
                message: errData?.message || errData?.detail || 'Không thể gia hạn phòng. Vui lòng liên hệ lễ tân để được hỗ trợ.'
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
    },

    /**
     * Nhân viên thêm dịch vụ phát sinh hoặc gọi món cho khách (tại quầy / gọi điện thoại)
     * POST /api/bookings/:id/add-extra-service/
     * @param {number|string} bookingId 
     * @param {Object} payload - { service_id, custom_name, quantity, price, note, service_status }
     */
    async addExtraService(bookingId, payload) {
        try {
            const response = await api.post(`/bookings/${bookingId}/add-extra-service/`, payload);
            return {
                success: true,
                message: response.data?.message || 'Đã thêm dịch vụ thành công!',
                booking: response.data?.booking || response.data?.data || response.data
            };
        } catch (error) {
            console.error('Lỗi khi thêm dịch vụ cho khách:', error);
            return {
                success: false,
                message:
                    error.response?.data?.message ||
                    error.response?.data?.detail ||
                    'Không thể thêm dịch vụ. Vui lòng kiểm tra lại thông tin.'
            };
        }
    },

    /**
     * Nhân viên xóa dịch vụ / phụ phí khỏi đơn đặt phòng
     * POST /api/bookings/:id/remove-extra-service/
     * @param {number|string} bookingId 
     * @param {string|number} itemId 
     */
    async removeExtraService(bookingId, itemId) {
        try {
            const response = await api.post(`/bookings/${bookingId}/remove-extra-service/`, { item_id: itemId });
            return {
                success: true,
                message: response.data?.message || 'Đã xóa dịch vụ thành công!',
                booking: response.data?.booking || response.data?.data || response.data
            };
        } catch (error) {
            console.error('Lỗi khi xóa dịch vụ:', error);
            return {
                success: false,
                message:
                    error.response?.data?.message ||
                    error.response?.data?.detail ||
                    'Không thể xóa dịch vụ. Vui lòng thử lại.'
            };
        }
    },
    /**
     * Lấy Bảng kê chi tiết tiền phòng và dịch vụ trước khi thanh toán Check-out
     * GET /api/bookings/:id/summary/
     * @param {number|string} bookingId 
     */
    async getBookingSummary(bookingId) {
        try {
            const response = await api.get(`/bookings/${bookingId}/summary/`);
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Lỗi khi lấy bảng kê thanh toán:', error);
            return {
                success: false,
                message:
                    error.response?.data?.message ||
                    error.response?.data?.detail ||
                    'Không thể lấy bảng kê chi tiết thanh toán.'
            };
        }
    },

    /**
     * Thực hiện Check-out và Lập hóa đơn thanh toán tổng
     * POST /api/bookings/:id/check-out/
     * @param {number|string} bookingId 
     * @param {Object} payload - { payment_method: 'cash'|'credit_card'|'bank_transfer'|'momo', note: '' }
     */
    async checkOut(bookingId, payload = {}) {
        try {
            const response = await api.post(`/bookings/${bookingId}/check-out/`, payload);
            return {
                success: true,
                message: response.data?.message || 'Check-out và lập hóa đơn thành công!',
                data: response.data
            };
        } catch (error) {
            console.error('Lỗi khi thực hiện Check-out:', error);
            return {
                success: false,
                message:
                    error.response?.data?.message ||
                    error.response?.data?.detail ||
                    'Không thể thực hiện Check-out. Vui lòng thử lại.'
            };
        }
    },

    /**
     * Đánh dấu khách không đến nhận phòng (No-show) để giải phóng phòng
     * POST /api/bookings/:id/no-show/
     * @param {number|string} bookingId 
     * @param {Object} payload - { reason: string }
     */
    async markNoShow(bookingId, payload = {}) {
        try {
            const response = await api.post(`/bookings/${bookingId}/no-show/`, payload);
            return {
                success: true,
                message: response.data?.message || 'Đã đánh dấu No-show và giải phóng phòng thành công!',
                data: response.data
            };
        } catch (error) {
            console.error('Lỗi khi đánh dấu No-show:', error);
            return {
                success: false,
                message:
                    error.response?.data?.message ||
                    error.response?.data?.detail ||
                    'Không thể đánh dấu No-show. Vui lòng thử lại sau.'
            };
        }
    },

    /**
     * Lấy danh sách các đơn đặt phòng Check-in hôm nay (GET /api/bookings/check-in-today/)
     */
    async getCheckInToday() {
        try {
            const response = await api.get('/bookings/check-in-today/');
            let list = [];
            if (Array.isArray(response.data)) {
                list = response.data;
            } else if (response.data && Array.isArray(response.data.results)) {
                list = response.data.results;
            } else if (response.data && Array.isArray(response.data.data)) {
                list = response.data.data;
            }
            return {
                success: true,
                count: response.data?.count || list.length,
                date: response.data?.date,
                data: list
            };
        } catch (error) {
            console.error('Lỗi khi tải danh sách check-in hôm nay:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể tải danh sách check-in hôm nay.',
                data: []
            };
        }
    },

    /**
     * Lấy danh sách các đơn đặt phòng Check-out hôm nay (GET /api/bookings/check-out-today/)
     */
    async getCheckOutToday() {
        try {
            const response = await api.get('/bookings/check-out-today/');
            let list = [];
            if (Array.isArray(response.data)) {
                list = response.data;
            } else if (response.data && Array.isArray(response.data.results)) {
                list = response.data.results;
            } else if (response.data && Array.isArray(response.data.data)) {
                list = response.data.data;
            }
            return {
                success: true,
                count: response.data?.count || list.length,
                date: response.data?.date,
                data: list
            };
        } catch (error) {
            console.error('Lỗi khi tải danh sách check-out hôm nay:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể tải danh sách check-out hôm nay.',
                data: []
            };
        }
    },

    /**
     * Lấy dữ liệu Sơ đồ trực quan Gantt / Timeline đặt phòng theo tháng & năm
     * GET /api/bookings/timeline/?month=6&year=2026
     * @param {Object} params - { month, year }
     */
    async getTimeline(params = {}) {
        try {
            const response = await api.get('/bookings/timeline/', { params });
            return {
                success: true,
                month: response.data?.month,
                year: response.data?.year,
                days_in_month: response.data?.days_in_month,
                month_start: response.data?.month_start,
                month_end: response.data?.month_end,
                rooms: response.data?.rooms || [],
                unassigned_bookings: response.data?.unassigned_bookings || [],
                total_rooms: response.data?.total_rooms || 0,
                total_bookings: response.data?.total_bookings || 0
            };
        } catch (error) {
            console.error('Lỗi khi tải sơ đồ đặt phòng timeline:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể tải dữ liệu sơ đồ đặt phòng.',
                rooms: []
            };
        }
    }
};

export default bookingService;