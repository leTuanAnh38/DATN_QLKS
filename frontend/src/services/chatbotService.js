import api from './api';

/**
 * Gửi tin nhắn câu hỏi tới Trợ lý ảo AI Concierge (Backend Django /api/chatbot/ask/)
 * @param {string} message - Câu hỏi của khách hàng
 * @param {Array} history - Lịch sử 5 tin nhắn gần nhất trong phiên trò chuyện [{role: 'user'|'model', text: '...'}]
 * @returns {Promise<Object>} { success: true, reply: '...', source: '...' }
 */
export const askChatbot = async (message, history = []) => {
    const response = await api.post('/chatbot/ask/', {
        message,
        history,
    });
    return response.data;
};

export default {
    askChatbot,
};
