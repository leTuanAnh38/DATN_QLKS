import api from './api';

export const amenityService = {
    /**
     * Lấy toàn bộ danh sách tiện nghi phòng
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
            console.error('Lỗi khi tải danh sách tiện nghi:', error);
            return {
                success: false,
                data: [],
                message: error.response?.data?.message || 'Không thể tải danh sách tiện nghi.'
            };
        }
    },

    /**
     * Thêm mới một tiện nghi
     * @param {{ name: string, description?: string, icon?: string }} data
     */
    async createAmenity(data) {
        try {
            const response = await api.post('/rooms/amenities/', data);
            return {
                success: true,
                data: response.data,
                message: 'Thêm tiện nghi mới thành công!'
            };
        } catch (error) {
            console.error('Lỗi khi tạo tiện nghi mới:', error);
            const errDetail = error.response?.data?.name?.[0] || error.response?.data?.message || 'Không thể tạo tiện nghi mới.';
            return {
                success: false,
                message: errDetail
            };
        }
    },

    /**
     * Cập nhật thông tin tiện nghi
     * @param {number|string} id
     * @param {{ name: string, description?: string, icon?: string }} data
     */
    async updateAmenity(id, data) {
        try {
            const response = await api.put(`/rooms/amenities/${id}/`, data);
            return {
                success: true,
                data: response.data,
                message: 'Cập nhật tiện nghi thành công!'
            };
        } catch (error) {
            console.error('Lỗi khi cập nhật tiện nghi:', error);
            const errDetail = error.response?.data?.name?.[0] || error.response?.data?.message || 'Không thể cập nhật tiện nghi.';
            return {
                success: false,
                message: errDetail
            };
        }
    },

    /**
     * Xóa một tiện nghi theo ID
     * @param {number|string} id
     */
    async deleteAmenity(id) {
        try {
            await api.delete(`/rooms/amenities/${id}/`);
            return {
                success: true,
                message: 'Xóa tiện nghi thành công!'
            };
        } catch (error) {
            console.error('Lỗi khi xóa tiện nghi:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể xóa tiện nghi này.'
            };
        }
    }
};

export default amenityService;
