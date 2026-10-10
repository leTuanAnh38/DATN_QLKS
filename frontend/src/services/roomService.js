import api from './api';

export const roomService = {
    /**
     * Lấy danh sách phòng thực tế theo sơ đồ PMS kèm bộ lọc & thống kê
     * @param {Object} params - { q, floor, status, category }
     */
    async getAdminRooms(params = {}) {
        try {
            const response = await api.get('/rooms/admin/rooms/', { params });
            return response.data;
        } catch (error) {
            console.error('Error fetching admin rooms:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể tải danh sách phòng.',
                rooms: [],
                stats: { total: 0, available: 0, occupied: 0, cleaning: 0, maintenance: 0, occupancy_rate: 0 }
            };
        }
    },

    /**
     * Lấy danh mục các loại phòng để chọn trong Form hoặc Bộ lọc
     * @param {Object} params - { q }
     */
    async getCategories(params = {}) {
        try {
            const response = await api.get('/rooms/categories/', { params });
            return response.data;
        } catch (error) {
            console.error('Error fetching room categories:', error);
            return {
                success: false,
                categories: []
            };
        }
    },

    /**
     * Lấy toàn bộ danh sách tiện nghi phòng (Amenities)
     */
    async getAmenities() {
        try {
            const response = await api.get('/rooms/amenities/');
            const list = Array.isArray(response.data) ? response.data : (response.data?.results || []);
            return {
                success: true,
                data: list
            };
        } catch (error) {
            console.error('Error fetching amenities:', error);
            return {
                success: false,
                data: [],
                message: error.response?.data?.message || 'Không thể tải danh sách tiện nghi.'
            };
        }
    },

    /**
     * Lấy chi tiết một hạng phòng kèm danh sách ảnh
     * @param {number|string} id
     */
    async getCategoryDetail(id) {
        try {
            const response = await api.get(`/rooms/categories/${id}/`);
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.detail || error.response?.data?.message || 'Không thể tải chi tiết hạng phòng.'
            };
        }
    },

    /**
     * Tạo mới hạng phòng (hỗ trợ upload nhiều ảnh qua FormData)
     * @param {FormData} formData
     */
    async createCategory(formData) {
        try {
            const response = await api.post('/rooms/categories/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Tạo hạng phòng mới thất bại.',
                errors: error.response?.data?.errors,
            };
        }
    },

    /**
     * Cập nhật hạng phòng (hỗ trợ FormData để thêm ảnh mới hoặc xóa ảnh)
     * @param {number|string} id
     * @param {FormData|Object} data
     */
    async updateCategory(id, data) {
        try {
            const isFormData = data instanceof FormData;
            const headers = isFormData ? { 'Content-Type': 'multipart/form-data' } : {};
            const response = await api.patch(`/rooms/categories/${id}/`, data, { headers });
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Cập nhật hạng phòng thất bại.',
                errors: error.response?.data?.errors,
            };
        }
    },

    /**
     * Xóa hạng phòng (chỉ cho phép khi không có phòng thực tế nào trực thuộc)
     * @param {number|string} id
     */
    async deleteCategory(id) {
        try {
            const response = await api.delete(`/rooms/categories/${id}/`);
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Xóa hạng phòng thất bại.'
            };
        }
    },

    /**
     * Xóa 1 ảnh cụ thể của hạng phòng
     * @param {number|string} categoryId
     * @param {number|string} imageId
     */
    async deleteCategoryImage(categoryId, imageId) {
        try {
            const response = await api.post(`/rooms/categories/${categoryId}/delete-image/`, { image_id: imageId });
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Xóa ảnh thất bại.'
            };
        }
    },

    /**
     * Đặt một ảnh làm ảnh đại diện chính của hạng phòng
     * @param {number|string} categoryId
     * @param {number|string} imageId
     */
    async setCategoryFeatureImage(categoryId, imageId) {
        try {
            const response = await api.post(`/rooms/categories/${categoryId}/set-feature-image/`, { image_id: imageId });
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Đặt ảnh đại diện thất bại.'
            };
        }
    },

    /**
     * Upload thêm ảnh cho hạng phòng hiện có
     * @param {number|string} categoryId
     * @param {FormData} formData
     */
    async uploadCategoryImages(categoryId, formData) {
        try {
            const response = await api.post(`/rooms/categories/${categoryId}/upload-images/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Tải ảnh lên thất bại.'
            };
        }
    },

    /**
     * Tạo mới phòng thực tế
     * @param {Object} data - { room_number, category_id, floor, status }
     */
    async createRoom(data) {
        try {
            const response = await api.post('/rooms/admin/rooms/', data);
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Tạo phòng mới thất bại.',
                errors: error.response?.data?.errors
            };
        }
    },

    /**
     * Cập nhật thông tin phòng (số phòng, loại phòng, tầng)
     */
    async updateRoom(id, data) {
        try {
            const response = await api.patch(`/rooms/admin/rooms/${id}/`, data);
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Cập nhật phòng thất bại.',
                errors: error.response?.data?.errors
            };
        }
    },

    /**
     * Cập nhật nhanh trạng thái phòng (available, occupied, cleaning, maintenance)
     */
    async updateRoomStatus(id, statusValue) {
        try {
            const response = await api.patch(`/rooms/admin/rooms/${id}/status/`, { status: statusValue });
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Cập nhật trạng thái phòng thất bại.'
            };
        }
    },

    /**
     * Xóa phòng khỏi sơ đồ
     */
    async deleteRoom(id) {
        try {
            const response = await api.delete(`/rooms/admin/rooms/${id}/`);
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Xóa phòng thất bại.'
            };
        }
    },

    /**
     * Lập phiếu báo hỏng thiết bị & Bắt đầu bảo trì phòng
     * @param {Object} data - { room_id, equipment_name, issue_type, description, parts_replaced, cost, is_guest_fault, booking_id }
     */
    async createMaintenanceTicket(data) {
        try {
            const response = await api.post('/rooms/maintenance-tickets/', data);
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Lập phiếu bảo trì thất bại.'
            };
        }
    },

    /**
     * Hoàn tất sửa chữa thiết bị & Bàn giao buồng phòng dọn dẹp
     * @param {number|string} ticketId
     * @param {Object} data - { parts_replaced, cost, note, is_guest_fault }
     */
    async completeMaintenanceTicket(ticketId, data = {}) {
        try {
            const response = await api.post(`/rooms/maintenance-tickets/${ticketId}/complete/`, data);
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Hoàn tất bảo trì thất bại.'
            };
        }
    },

    /**
     * Lấy danh sách phiếu bảo trì phòng
     */
    async getMaintenanceTickets(params = {}) {
        try {
            const response = await api.get('/rooms/maintenance-tickets/', { params });
            const list = Array.isArray(response.data) ? response.data : (response.data?.results || []);
            return {
                success: true,
                data: list
            };
        } catch (error) {
            return {
                success: false,
                data: [],
                message: error.response?.data?.message || 'Không thể tải phiếu bảo trì.'
            };
        }
    }
};

export default roomService;