import api from './api';

export const postService = {
    /**
     * Lấy danh sách bài viết kèm bộ lọc, tìm kiếm và phân trang
     * @param {Object} params - { q, category, status, all: 1 }
     */
    async getPosts(params = {}) {
        try {
            const response = await api.get('/posts/', { params });
            const data = response.data;
            const list = Array.isArray(data) ? data : (data?.results || []);
            return {
                success: true,
                posts: list,
                count: data?.count || list.length
            };
        } catch (error) {
            console.error('Lỗi khi tải danh sách bài viết:', error);
            return {
                success: false,
                posts: [],
                count: 0,
                message: error.response?.data?.message || 'Không thể tải danh sách bài viết.'
            };
        }
    },

    /**
     * Lấy chi tiết bài viết theo Slug hoặc ID (tự động tăng view_count)
     * @param {string|number} slugOrId
     */
    async getPostDetail(slugOrId) {
        try {
            const response = await api.get(`/posts/${slugOrId}/`);
            return {
                success: true,
                post: response.data
            };
        } catch (error) {
            console.error('Lỗi khi tải chi tiết bài viết:', error);
            return {
                success: false,
                post: null,
                message: error.response?.data?.detail || error.response?.data?.message || 'Không tìm thấy bài viết.'
            };
        }
    },

    /**
     * Lấy danh sách chuyên mục có sẵn
     */
    async getCategories() {
        try {
            const response = await api.get('/posts/categories/');
            return response.data;
        } catch (error) {
            console.error('Lỗi khi tải chuyên mục:', error);
            return {
                success: false,
                categories: [
                    { value: 'du_lich', label: 'Du lịch' },
                    { value: 'am_thuc', label: 'Ẩm thực' },
                    { value: 'khuyen_mai', label: 'Khuyến mãi' },
                    { value: 'su_kien', label: 'Sự kiện' },
                    { value: 'khach_san', label: 'Khách sạn' }
                ]
            };
        }
    },

    /**
     * Lấy top 5 bài viết mới nhất
     */
    async getLatestPosts() {
        try {
            const response = await api.get('/posts/latest/');
            return response.data;
        } catch (error) {
            console.error('Lỗi khi tải bài viết mới nhất:', error);
            return { success: false, posts: [] };
        }
    },

    /**
     * Tạo mới bài viết (hỗ trợ upload ảnh bìa qua FormData)
     * @param {FormData|Object} data
     */
    async createPost(data) {
        try {
            const isFormData = data instanceof FormData;
            const headers = isFormData ? { 'Content-Type': 'multipart/form-data' } : {};
            const response = await api.post('/posts/', data, { headers });
            return response.data;
        } catch (error) {
            console.error('Lỗi khi tạo bài viết mới:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Tạo bài viết mới thất bại.',
                errors: error.response?.data?.errors
            };
        }
    },

    /**
     * Chỉnh sửa bài viết
     * @param {string|number} id
     * @param {FormData|Object} data
     */
    async updatePost(id, data) {
        try {
            const isFormData = data instanceof FormData;
            const headers = isFormData ? { 'Content-Type': 'multipart/form-data' } : {};
            const response = await api.patch(`/posts/${id}/`, data, { headers });
            return response.data;
        } catch (error) {
            console.error('Lỗi khi cập nhật bài viết:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Cập nhật bài viết thất bại.',
                errors: error.response?.data?.errors
            };
        }
    },

    /**
     * Xóa bài viết
     * @param {string|number} id
     */
    async deletePost(id) {
        try {
            const response = await api.delete(`/posts/${id}/`);
            return response.data;
        } catch (error) {
            console.error('Lỗi khi xóa bài viết:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Xóa bài viết thất bại.'
            };
        }
    },

    /**
     * Tải ảnh độc lập vào nội dung bài viết (tránh Base64)
     * @param {File} file
     */
    async uploadContentImage(file) {
        try {
            const formData = new FormData();
            formData.append('image', file);
            const response = await api.post('/upload-image/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data;
        } catch (error) {
            console.error('Lỗi khi tải ảnh bài viết:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Không thể tải ảnh lên máy chủ.'
            };
        }
    }
};

export default postService;
