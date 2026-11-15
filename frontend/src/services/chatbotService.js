import api from './api';

/**
 * Gửi tin nhắn câu hỏi tới Trợ lý ảo AI Concierge (Backend Django /api/chatbot/ask/)
 * @param {string} message - Câu hỏi của khách hàng
 * @param {Array} history - Lịch sử tối đa 8 tin nhắn gần nhất trong phiên trò chuyện [{role: 'user'|'model', text: '...'}]
 * @param {string} lang - Ngôn ngữ giao diện hiện tại ('vi' | 'en' | 'ko' | 'zh')
 * @returns {Promise<Object>} { success: true, reply: '...', source: '...' }
 */
export const askChatbot = async (message, history = [], lang = 'vi') => {
    const response = await api.post('/chatbot/ask/', {
        message,
        history,
        lang,
    });
    return response.data;
};

/**
 * Xác nhận thực thi hành động 2 bước từ AI Concierge (/api/chatbot/confirm-action/)
 * @param {Object} payload - { action_type: 'create_service_request' | 'human_handoff', ... }
 */
export const confirmChatbotAction = async (payload) => {
    const response = await api.post('/chatbot/confirm-action/', payload);
    return response.data;
};

export default {
    askChatbot,
    confirmChatbotAction,
};
