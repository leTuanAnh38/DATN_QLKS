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
