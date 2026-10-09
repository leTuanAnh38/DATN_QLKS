import api from './api';

export const auditLogService = {
  /**
   * Lấy danh sách nhật ký thao tác hệ thống (Audit Logs)
   * Hỗ trợ các query params: role, module, action, search, page...
   */
  getLogs: async (params = {}) => {
    const response = await api.get('/audit-logs/', { params });
    return response.data;
  },

  /**
   * Lấy chi tiết một bản ghi nhật ký
   */
  getLogDetail: async (id) => {
    const response = await api.get(`/audit-logs/${id}/`);
    return response.data;
  },
};

export default auditLogService;
