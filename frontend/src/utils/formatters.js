/**
 * Tiện ích định dạng ngày giờ, tiền tệ và chuỗi dùng chung cho toàn bộ Frontend
 */

/**
 * Định dạng tiền tệ Việt Nam (VD: 1.500.000đ hoặc 1.500.000 VND)
 * @param {number|string} amount Số tiền cần format
 * @param {string} suffix Đơn vị tiền tệ (mặc định 'đ')
 * @returns {string} Chuỗi tiền tệ đã format
 */
export const formatCurrency = (amount, suffix = 'đ') => {
    const num = Number(amount) || 0;
    const formatted = num.toLocaleString('vi-VN');
    if (!suffix) return formatted;
    return suffix === 'VND' ? `${formatted} VND` : `${formatted}${suffix}`;
};

/**
 * Định dạng ngày ngắn DD/MM/YYYY (VD: 2026-11-10 -> 10/11/2026)
 * @param {string|Date} dateStr Chuỗi ngày ISO hoặc đối tượng Date
 * @param {string} fallback Giá trị hiển thị khi ngày rỗng
 * @returns {string}
 */
export const formatDate = (dateStr, fallback = '—') => {
    if (!dateStr) return fallback;
    try {
        const str = String(dateStr);
        const parts = str.split('T')[0].split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
    } catch {
        return dateStr;
    }
    return dateStr;
};

/**
 * Alias của formatDate dùng cho giao diện hiển thị
 */
export const formatDateDisplay = (dateStr, fallback = '') => formatDate(dateStr, fallback);

/**
 * Định dạng ngày giờ chi tiết HH:mm • DD/MM/YYYY (VD: 14:30 • 10/11/2026)
 * @param {string|Date} isoStr Chuỗi ngày giờ ISO
 * @param {string} fallback Giá trị khi rỗng
 * @returns {string}
 */
export const formatDateTime = (isoStr, fallback = '—') => {
    if (!isoStr) return fallback;
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `${time} • ${date}`;
    } catch {
        return isoStr;
    }
};

/**
 * Alias của formatDateTime
 */
export const formatDateTimeDisplay = formatDateTime;

/**
 * Định dạng ngày sang định dạng YYYY-MM-DD cho thẻ <input type="date" />
 * @param {string|Date} date Đối tượng Date hoặc chuỗi ngày
 * @returns {string} YYYY-MM-DD
 */
export const formatDateToInput = (date) => {
    if (!date) return '';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch {
        return '';
    }
};

/**
 * Lấy ngày kế tiếp định dạng YYYY-MM-DD (dùng cho trường Check-out luôn sau Check-in)
 * @param {string|Date} dateStr Chuỗi ngày hiện tại
 * @returns {string} YYYY-MM-DD
 */
export const getNextDayString = (dateStr) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        d.setDate(d.getDate() + 1);
        return formatDateToInput(d);
    } catch {
        return '';
    }
};

/**
 * Định dạng thời gian trôi qua thân thiện (VD: "Vừa xong", "5 phút trước", "2 giờ trước")
 * @param {string|Date} dateStr Chuỗi thời gian
 * @returns {string}
 */
export const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const now = new Date();
        const diffMs = now - d;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHours = Math.floor(diffMin / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSec < 60) return 'Vừa xong';
        if (diffMin < 60) return `${diffMin} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays < 7) return `${diffDays} ngày trước`;
        return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • ${d.toLocaleDateString('vi-VN')}`;
    } catch {
        return dateStr;
    }
};

export default {
    formatCurrency,
    formatDate,
    formatDateDisplay,
    formatDateTime,
    formatDateTimeDisplay,
    formatDateToInput,
    getNextDayString,
    formatTimeAgo,
};
