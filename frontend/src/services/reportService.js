import api from './api';

export const reportService = {
    /**
     * Lấy dữ liệu báo cáo & thống kê chuyên sâu từ API /api/reports/
     * @param {Object} params - { filter: 'day' | 'week' | 'month' | 'year' }
     */
    async getReports(params = {}) {
        try {
            const response = await api.get('/reports/', { params });
            return response.data;
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu báo cáo thống kê:', error);
            throw error;
        }
    }
};

export default reportService;
