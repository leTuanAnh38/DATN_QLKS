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
    },

    // =========================================================================
    // QUẢN LÝ MINIBAR PHÒNG
    // =========================================================================
    /**
     * Lấy danh mục đồ minibar chuẩn trong phòng
     */
    async getMinibarItems(params = {}) {
        try {
            const response = await api.get('/rooms/minibar-items/', { params });
            const list = Array.isArray(response.data) ? response.data : (response.data?.results || []);
            return {
                success: true,
                data: list
            };
        } catch (error) {
            return {
                success: false,
                data: [],
                message: error.response?.data?.message || 'Không thể tải danh mục Minibar.'
            };
        }
    },

    /**
     * Thêm mới mặt hàng Minibar
     * @param {Object} data - { name, category, price, standard_quantity, image_url, is_active }
     */
    async createMinibarItem(data) {
        try {
            const response = await api.post('/rooms/minibar-items/', data);
            return {
                success: true,
                data: response.data,
                message: 'Thêm mặt hàng Minibar thành công.'
            };
        } catch (error) {
            const errData = error.response?.data;
            let errMsg = 'Thêm mặt hàng Minibar thất bại.';
            if (typeof errData === 'string') errMsg = errData;
            else if (errData?.message) errMsg = errData.message;
            else if (errData?.detail) errMsg = errData.detail;
            else if (typeof errData === 'object') {
                const firstKey = Object.keys(errData)[0];
                if (firstKey) errMsg = `${firstKey}: ${errData[firstKey]}`;
            }
            return {
                success: false,
                message: errMsg
            };
        }
    },

    /**
     * Cập nhật thông tin/giá mặt hàng Minibar
     * @param {number|string} id
     * @param {Object} data
     */
    async updateMinibarItem(id, data) {
        try {
            const response = await api.patch(`/rooms/minibar-items/${id}/`, data);
            return {
                success: true,
                data: response.data,
                message: 'Cập nhật mặt hàng Minibar thành công.'
            };
        } catch (error) {
            const errData = error.response?.data;
            let errMsg = 'Cập nhật mặt hàng Minibar thất bại.';
            if (typeof errData === 'string') errMsg = errData;
            else if (errData?.message) errMsg = errData.message;
            else if (errData?.detail) errMsg = errData.detail;
            return {
                success: false,
                message: errMsg
            };
        }
    },

    /**
     * Xóa mặt hàng Minibar
     * @param {number|string} id
     */
    async deleteMinibarItem(id) {
        try {
            await api.delete(`/rooms/minibar-items/${id}/`);
            return {
                success: true,
                message: 'Đã xóa mặt hàng Minibar.'
            };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Xóa mặt hàng Minibar thất bại.'
            };
        }
    },

    /**
     * Gửi phiếu kiểm kê Minibar (tự động đẩy vào Folio/BookingExtraService nếu có đơn)
     * @param {Object} data - { room_id, booking_id, items: [{ id, name, price, quantity }], note }
     */
    async createMinibarCheck(data) {
        try {
            const response = await api.post('/rooms/minibar-checks/', data);
            return response.data;
        } catch (error) {
            const errData = error.response?.data;
            let errMsg = 'Gửi kết quả kiểm kê Minibar thất bại.';
            if (typeof errData === 'string') errMsg = errData;
            else if (errData?.message) errMsg = errData.message;
            else if (errData?.detail) errMsg = errData.detail;
            return {
                success: false,
                message: errMsg
            };
        }
    },

    /**
     * Lấy lịch sử kiểm kê Minibar
     */
    async getMinibarChecks(params = {}) {
        try {
            const response = await api.get('/rooms/minibar-checks/', { params });
            const list = Array.isArray(response.data) ? response.data : (response.data?.results || []);
            return {
                success: true,
                data: list
            };
        } catch (error) {
            return {
                success: false,
                data: [],
                message: error.response?.data?.message || 'Không thể tải lịch sử kiểm kê Minibar.'
            };
        }
    },

    // =========================================================================
    // QUẢN LÝ ĐỒ THẤT LẠC (LOST & FOUND)
    // =========================================================================
    /**
     * Lấy danh sách đồ thất lạc (hỗ trợ search, filter status, category, room_id)
     */
    async getLostAndFoundItems(params = {}) {
        try {
            const response = await api.get('/rooms/lost-and-found/', { params });
            const list = Array.isArray(response.data) ? response.data : (response.data?.results || []);
            return {
                success: true,
                data: list
            };
        } catch (error) {
            return {
                success: false,
                data: [],
                message: error.response?.data?.message || 'Không thể tải danh sách đồ thất lạc.'
            };
        }
    },

    /**
     * Lấy thống kê số lượng đồ thất lạc theo trạng thái
     */
    async getLostAndFoundStats() {
        try {
            const response = await api.get('/rooms/lost-and-found/stats/');
            return response.data;
        } catch (error) {
            return {
                success: false,
                total: 0,
                stored: 0,
                contacted: 0,
                returned: 0,
                disposed: 0,
                return_rate: 0
            };
        }
    },

    /**
     * Báo nhận đồ thất lạc mới (hỗ trợ ảnh FormData hoặc JSON)
     */
    async createLostAndFoundItem(payload) {
        try {
            const isFormData = payload instanceof FormData;
            const headers = isFormData ? { 'Content-Type': 'multipart/form-data' } : {};
            const response = await api.post('/rooms/lost-and-found/', payload, { headers });
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Báo nhận đồ thất lạc thất bại.'
            };
        }
    },

    /**
     * Bàn giao trao trả đồ thất lạc cho khách
     * @param {number|string} id
     * @param {Object} data - { returned_to, return_note }
     */
    async returnLostAndFoundItem(id, data = {}) {
        try {
            const response = await api.post(`/rooms/lost-and-found/${id}/return/`, data);
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Bàn giao trao trả đồ thất lạc thất bại.'
            };
        }
    },

    /**
     * Xóa vĩnh viễn phiếu đồ thất lạc (Chỉ Quản lý / Admin)
     * @param {number|string} id
     */
    async deleteLostAndFoundItem(id) {
        try {
            const response = await api.delete(`/rooms/lost-and-found/${id}/`);
            return response.data || { success: true, message: 'Đã xóa phiếu đồ thất lạc thành công.' };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Xóa phiếu đồ thất lạc thất bại.'
            };
        }
    }
};

export default roomService;