import api from './api';

export const hotelService = {
    /**
     * Lấy danh sách nhóm dịch vụ (GET /api/services/categories/)
     */
    async getServiceCategories() {
        try {
            const res = await api.get('/services/categories/');
            return {
                success: true,
                categories: res.data?.categories || res.data?.data || []
            };
        } catch (error) {
            console.error('Lỗi khi tải nhóm dịch vụ:', error);
            return {
                success: false,
                categories: [],
                message: error.response?.data?.message || 'Không thể tải danh mục nhóm dịch vụ.'
            };
        }
    },

    /**
     * Lấy danh sách món / dịch vụ Menu (GET /api/services/items/)
     * @param {Object} params - { category_id, q }
     */
    async getServiceItems(params = {}) {
        try {
            const res = await api.get('/services/items/', { params });
            return {
                success: true,
                items: res.data?.items || res.data?.data || []
            };
        } catch (error) {
            console.error('Lỗi khi tải thực đơn dịch vụ:', error);
            return {
                success: false,
                items: [],
                message: error.response?.data?.message || 'Không thể tải danh sách dịch vụ.'
            };
        }
    },

    /**
     * Lấy danh sách phòng / đơn đặt phòng đang lưu trú của khách (GET /api/services/my-active-bookings/)
     */
    async getMyActiveBookings() {
        try {
            const res = await api.get('/services/my-active-bookings/');
            return {
                success: true,
                bookings: res.data?.bookings || res.data?.data || []
            };
        } catch (error) {
            console.error('Lỗi khi tải đơn phòng lưu trú:', error);
            return {
                success: false,
                bookings: [],
                message: error.response?.data?.message || 'Không thể tải thông tin phòng lưu trú.'
            };
        }
    },

    /**
     * Khách hàng gửi yêu cầu dịch vụ tại phòng (POST /api/services/requests/)
     * @param {Object} payload - { booking_id, service_id, quantity, note }
     */
    async createServiceRequest(payload) {
        try {
            const res = await api.post('/services/requests/', payload);
            
            // Kích hoạt sự kiện đa tab để Kanban của Lễ tân nhảy thẻ ngay tức thì
            try {
                localStorage.setItem('pms_last_service_event', JSON.stringify({
                    type: 'service_created',
                    timestamp: Date.now(),
                    id: res.data?.data?.id
                }));
                window.dispatchEvent(new CustomEvent('pms_service_created', { detail: res.data }));
            } catch (e) {
                // Ignore storage error
            }

            return {
                success: true,
                data: res.data?.data || res.data?.request,
                message: res.data?.message || 'Yêu cầu dịch vụ đã được gửi thành công!'
            };
        } catch (error) {
            console.error('Lỗi khi gửi yêu cầu dịch vụ:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể gửi yêu cầu dịch vụ. Vui lòng thử lại.'
            };
        }
    },

    /**
     * Lấy danh sách lịch sử đặt món / dịch vụ của khách hàng (GET /api/services/requests/)
     * @param {Object} params - { booking_id, status }
     */
    async getMyServiceRequests(params = {}) {
        try {
            const res = await api.get('/services/requests/', { params });
            const list = res.data?.requests || res.data?.items || res.data?.data || (Array.isArray(res.data) ? res.data : []);
            return {
                success: true,
                requests: list,
                count: res.data?.count || list.length
            };
        } catch (error) {
            console.error('Lỗi khi tải lịch sử đặt món dịch vụ:', error);
            return {
                success: false,
                requests: [],
                count: 0,
                message: error.response?.data?.message || 'Không thể tải lịch sử đặt món.'
            };
        }
    },

    /**
     * Khách hàng hủy yêu cầu dịch vụ khi còn chờ xử lý (PATCH /api/services/requests/:id/)
     * @param {number|string} id 
     */
    async cancelServiceRequest(id) {
        try {
            const res = await api.patch(`/services/requests/${id}/`, { status: 'cancelled' });
            
            // Broadcast sự kiện để Kanban và Menu cập nhật ngay lập tức
            try {
                localStorage.setItem('pms_last_service_event', JSON.stringify({
                    type: 'service_cancelled',
                    timestamp: Date.now(),
                    id
                }));
                window.dispatchEvent(new CustomEvent('pms_service_updated', { detail: { id, status: 'cancelled' } }));
            } catch (e) {}

            return {
                success: true,
                message: res.data?.message || 'Đã hủy yêu cầu đặt món thành công.',
                data: res.data?.data
            };
        } catch (error) {
            console.error('Lỗi khi hủy yêu cầu đặt món:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể hủy yêu cầu dịch vụ này.'
            };
        }
    },

    /**
     * Lấy dữ liệu Kanban cho Admin / Lễ tân (GET /api/services/requests/kanban/)
     */
    async getKanbanRequests() {
        try {
            const res = await api.get('/services/requests/kanban/');
            const kanban = res.data?.kanban || res.data?.data || {
                pending: [],
                in_progress: [],
                completed: [],
                cancelled: [],
                stats: { total: 0, pending_count: 0, in_progress_count: 0, completed_count: 0, total_revenue: 0 }
            };
            return {
                success: true,
                kanban
            };
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu Kanban dịch vụ:', error);
            return {
                success: false,
                kanban: {
                    pending: [],
                    in_progress: [],
                    completed: [],
                    cancelled: [],
                    stats: { total: 0, pending_count: 0, in_progress_count: 0, completed_count: 0, total_revenue: 0 }
                },
                message: error.response?.data?.message || 'Không thể tải bảng Kanban dịch vụ.'
            };
        }
    },

    /**
     * Cập nhật trạng thái yêu cầu dịch vụ (PATCH /api/services/requests/:id/)
     * @param {number|string} id 
     * @param {string} status ('pending' | 'in_progress' | 'completed' | 'cancelled')
     * @param {string} note 
     */
    async updateServiceRequestStatus(id, status, note = '') {
        try {
            const payload = { status };
            if (note) payload.note = note;
            const res = await api.patch(`/services/requests/${id}/`, payload);
            
            // Broadcast sự kiện
            try {
                localStorage.setItem('pms_last_service_event', JSON.stringify({
                    type: 'service_updated',
                    timestamp: Date.now(),
                    id,
                    status
                }));
                window.dispatchEvent(new CustomEvent('pms_service_updated', { detail: { id, status } }));
            } catch (e) {
                // Ignore storage error
            }

            return {
                success: true,
                data: res.data?.data,
                message: res.data?.message || 'Cập nhật trạng thái thành công.'
            };
        } catch (error) {
            console.error('Lỗi khi cập nhật trạng thái yêu cầu dịch vụ:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể cập nhật trạng thái yêu cầu dịch vụ.'
            };
        }
    },

    /**
     * Dành cho Admin: Lấy danh sách toàn bộ dịch vụ (cả Đang phục vụ & Tạm ngưng)
     * @param {Object} params - { category_id, q, status }
     */
    async getAllServiceItems(params = {}) {
        try {
            const queryParams = { ...params, all: true };
            const res = await api.get('/services/items/', { params: queryParams });
            return {
                success: true,
                items: res.data?.items || res.data?.data || []
            };
        } catch (error) {
            console.error('Lỗi khi tải danh sách dịch vụ quản lý:', error);
            return {
                success: false,
                items: [],
                message: error.response?.data?.message || 'Không thể tải danh sách dịch vụ.'
            };
        }
    },

    /**
     * Admin: Thêm mới 1 dịch vụ / món ăn vào thực đơn
     * @param {FormData|Object} data 
     */
    async createServiceItem(data) {
        try {
            const isFormData = data instanceof FormData;
            const res = await api.post('/services/items/', data, {
                headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {}
            });

            // Kích hoạt sự kiện thay đổi danh mục dịch vụ để màn hình khách hàng tự update
            try {
                localStorage.setItem('pms_service_catalog_changed', Date.now().toString());
                window.dispatchEvent(new CustomEvent('pms_service_catalog_changed', { detail: res.data }));
            } catch (e) {}

            return {
                success: true,
                item: res.data?.item || res.data?.data,
                message: res.data?.message || 'Thêm dịch vụ mới thành công!'
            };
        } catch (error) {
            console.error('Lỗi khi thêm dịch vụ mới:', error);
            const errDetail = error.response?.data?.errors;
            let errMsg = error.response?.data?.message || 'Không thể thêm dịch vụ mới.';
            if (errDetail && typeof errDetail === 'object') {
                const firstErrKey = Object.keys(errDetail)[0];
                if (firstErrKey) {
                    errMsg += ` (${firstErrKey}: ${Array.isArray(errDetail[firstErrKey]) ? errDetail[firstErrKey].join(', ') : errDetail[firstErrKey]})`;
                }
            }
            return {
                success: false,
                message: errMsg,
                errors: errDetail
            };
        }
    },

    /**
     * Admin: Cập nhật thông tin dịch vụ
     * @param {number|string} id 
     * @param {FormData|Object} data 
     */
    async updateServiceItem(id, data) {
        try {
            const isFormData = data instanceof FormData;
            const res = await api.patch(`/services/items/${id}/`, data, {
                headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {}
            });

            try {
                localStorage.setItem('pms_service_catalog_changed', Date.now().toString());
                window.dispatchEvent(new CustomEvent('pms_service_catalog_changed', { detail: res.data }));
            } catch (e) {}

            return {
                success: true,
                item: res.data?.item || res.data?.data,
                message: res.data?.message || 'Cập nhật dịch vụ thành công!'
            };
        } catch (error) {
            console.error('Lỗi khi cập nhật dịch vụ:', error);
            const errDetail = error.response?.data?.errors;
            let errMsg = error.response?.data?.message || 'Không thể cập nhật dịch vụ.';
            if (errDetail && typeof errDetail === 'object') {
                const firstErrKey = Object.keys(errDetail)[0];
                if (firstErrKey) {
                    errMsg += ` (${firstErrKey}: ${Array.isArray(errDetail[firstErrKey]) ? errDetail[firstErrKey].join(', ') : errDetail[firstErrKey]})`;
                }
            }
            return {
                success: false,
                message: errMsg,
                errors: errDetail
            };
        }
    },

    /**
     * Admin: Xóa một dịch vụ khỏi hệ thống
     * @param {number|string} id 
     */
    async deleteServiceItem(id) {
        try {
            const res = await api.delete(`/services/items/${id}/`);

            try {
                localStorage.setItem('pms_service_catalog_changed', Date.now().toString());
                window.dispatchEvent(new CustomEvent('pms_service_catalog_changed', { detail: { id } }));
            } catch (e) {}

            return {
                success: true,
                message: res.data?.message || 'Đã xóa dịch vụ thành công.'
            };
        } catch (error) {
            console.error('Lỗi khi xóa dịch vụ:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể xóa dịch vụ này.'
            };
        }
    },

    /**
     * Admin: Bật/Tắt nhanh trạng thái Đang phục vụ / Tạm ngưng
     * @param {number|string} id 
     */
    async toggleServiceItemStatus(id) {
        try {
            const res = await api.patch(`/services/items/${id}/toggle-active/`);

            try {
                localStorage.setItem('pms_service_catalog_changed', Date.now().toString());
                window.dispatchEvent(new CustomEvent('pms_service_catalog_changed', { detail: res.data }));
            } catch (e) {}

            return {
                success: true,
                is_active: res.data?.is_active,
                item: res.data?.item,
                message: res.data?.message || 'Đã thay đổi trạng thái dịch vụ.'
            };
        } catch (error) {
            console.error('Lỗi khi chuyển trạng thái dịch vụ:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể thay đổi trạng thái dịch vụ.'
            };
        }
    },

    /**
     * Admin: Thêm nhóm danh mục mới
     * @param {Object} data - { name, icon, description }
     */
    async createServiceCategory(data) {
        try {
            const res = await api.post('/services/categories/', data);
            return {
                success: true,
                category: res.data?.category,
                message: res.data?.message || 'Đã tạo nhóm dịch vụ thành công.'
            };
        } catch (error) {
            console.error('Lỗi khi tạo nhóm dịch vụ:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể tạo nhóm dịch vụ.'
            };
        }
    }
};

export default hotelService;
