import api from './api';

export const adminUserService = {
    /**
     * Lấy danh sách khách hàng
     * @param {Object} params - { q, vip_tier, is_active }
     */
    async getGuests(params = {}) {
        try {
            const response = await api.get('/auth/admin/guests/', { params });
            return response.data;
        } catch (error) {
            console.error('Error fetching guests:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể tải danh sách khách hàng.',
                guests: []
            };
        }
    },

    /**
     * Lấy chi tiết hồ sơ 1 khách hàng (CRM Profile)
     * GET /api/users/{id}/ hoặc /api/auth/admin/guests/{id}/
     */
    async getGuestDetail(id) {
        try {
            const response = await api.get(`/users/${id}/`);
            return response.data;
        } catch (error) {
            console.error('Error fetching guest detail:', error);
            // Fallback sang endpoint admin guests nếu cần
            try {
                const fallbackRes = await api.get(`/auth/admin/guests/${id}/`);
                return fallbackRes.data;
            } catch (err2) {
                return {
                    success: false,
                    message: error.response?.data?.message || 'Không thể tải thông tin chi tiết khách hàng.'
                };
            }
        }
    },

    /**
     * Lấy Lịch sử Đặt phòng của khách hàng (có phân trang)
     * GET /api/bookings/?guest_id={id}&page={page}&page_size={pageSize}
     */
    async getGuestBookings(guestId, page = 1, pageSize = 5) {
        try {
            const response = await api.get('/bookings/', {
                params: {
                    guest_id: guestId,
                    page: page,
                    page_size: pageSize
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching guest bookings:', error);
            return {
                success: false,
                count: 0,
                results: [],
                message: error.response?.data?.message || 'Không thể tải lịch sử đặt phòng.'
            };
        }
    },

    /**
     * Lấy Lịch sử Sử dụng Dịch vụ của khách hàng (có phân trang)
     * GET /api/service-requests/?guest_id={id}&page={page}&page_size={pageSize}
     */
    async getGuestServiceRequests(guestId, page = 1, pageSize = 5) {
        try {
            const response = await api.get('/service-requests/', {
                params: {
                    guest_id: guestId,
                    page: page,
                    page_size: pageSize
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching guest service requests:', error);
            // Fallback sang /services/requests/ nếu cần
            try {
                const fb = await api.get('/services/requests/', {
                    params: { guest_id: guestId, page, page_size: pageSize }
                });
                return fb.data;
            } catch (err2) {
                return {
                    success: false,
                    count: 0,
                    results: [],
                    message: error.response?.data?.message || 'Không thể tải lịch sử dịch vụ.'
                };
            }
        }
    },

    /**
     * Tạo mới tài khoản khách hàng từ trang admin
     */
    async createGuest(data) {
        try {
            const response = await api.post('/auth/admin/guests/', data);
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Tạo khách hàng thất bại.',
                errors: error.response?.data?.errors
            };
        }
    },

    /**
     * Cập nhật thông tin khách hàng
     */
    async updateGuest(id, data) {
        try {
            const response = await api.patch(`/auth/admin/guests/${id}/`, data);
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Cập nhật khách hàng thất bại.',
                errors: error.response?.data?.errors
            };
        }
    },

    /**
     * Xóa tài khoản khách hàng
     */
    async deleteGuest(id) {
        try {
            const response = await api.delete(`/auth/admin/guests/${id}/`);
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Xóa tài khoản khách hàng thất bại.'
            };
        }
    },

    /**
     * Lấy danh sách nhân viên
     * @param {Object} params - { q, role, department, is_active }
     */
    async getEmployees(params = {}) {
        try {
            const response = await api.get('/auth/admin/employees/', { params });
            return response.data;
        } catch (error) {
            console.error('Error fetching employees:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể tải danh sách nhân viên.',
                employees: []
            };
        }
    },

    /**
     * Tạo tài khoản nhân viên mới
     */
    async createEmployee(data) {
        try {
            const response = await api.post('/auth/admin/employees/', data);
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Tạo tài khoản nhân viên thất bại.',
                errors: error.response?.data?.errors
            };
        }
    },

    /**
     * Cập nhật thông tin nhân viên & phân quyền vai trò
     */
    async updateEmployee(id, data) {
        try {
            const response = await api.patch(`/auth/admin/employees/${id}/`, data);
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Cập nhật nhân viên thất bại.',
                errors: error.response?.data?.errors
            };
        }
    },

    /**
     * Xóa tài khoản nhân viên
     */
    async deleteEmployee(id) {
        try {
            const response = await api.delete(`/auth/admin/employees/${id}/`);
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Xóa nhân viên thất bại.'
            };
        }
    },

    /**
     * Lấy danh mục 9 vai trò và bảng chi tiết phân quyền
     */
    async getRoles() {
        try {
            const response = await api.get('/auth/admin/roles/');
            return response.data;
        } catch (error) {
            console.error('Error fetching roles:', error);
            return { success: false, roles: [] };
        }
    }
};

export default adminUserService;
