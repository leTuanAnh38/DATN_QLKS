/**
 * Các hằng số, bảng mã và cấu hình màu sắc dùng chung cho toàn bộ Frontend
 */

// =========================================================================
// CẤU HÌNH TRẠNG THÁI PHÒNG (ROOM STATUSES) CHUẨN PMS KHÁCH SẠN
// =========================================================================
export const ROOM_STATUSES = {
    available: {
        key: 'available',
        label: 'Phòng trống (Sẵn sàng)',
        shortLabel: 'Trống',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/90 font-bold',
        cardClass: 'bg-white hover:bg-emerald-50/20 border-slate-200/90 hover:border-emerald-400 text-slate-800 shadow-2xs hover:shadow-md transition-all duration-200',
        indicatorColor: 'bg-emerald-500',
        btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
    occupied: {
        key: 'occupied',
        label: 'Đang có khách lưu trú',
        shortLabel: 'Có khách',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/90 font-bold',
        cardClass: 'bg-rose-50/30 hover:bg-rose-50/50 border-rose-200/90 hover:border-rose-400 text-slate-800 shadow-2xs hover:shadow-md transition-all duration-200',
        indicatorColor: 'bg-rose-500',
        btnClass: 'bg-rose-600 hover:bg-rose-700 text-white',
    },
    cleaning: {
        key: 'cleaning',
        label: 'Đang dọn dẹp (Housekeeping)',
        shortLabel: 'Đang dọn',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/90 font-bold',
        cardClass: 'bg-amber-50/30 hover:bg-amber-50/50 border-amber-200/90 hover:border-amber-400 text-slate-800 shadow-2xs hover:shadow-md transition-all duration-200',
        indicatorColor: 'bg-amber-500',
        btnClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    },
    maintenance: {
        key: 'maintenance',
        label: 'Đang bảo trì / Hỏng hóc',
        shortLabel: 'Bảo trì',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 font-bold',
        cardClass: 'bg-slate-50/80 hover:bg-slate-100/80 border-slate-300 hover:border-slate-400 text-slate-800 shadow-2xs hover:shadow-md transition-all duration-200',
        indicatorColor: 'bg-slate-400',
        btnClass: 'bg-slate-600 hover:bg-slate-700 text-white',
    },
};

// =========================================================================
// CẤU HÌNH TRẠNG THÁI ĐẶT PHÒNG (BOOKING STATUSES)
// =========================================================================
export const BOOKING_STATUSES = {
    pending: {
        key: 'pending',
        label: 'Chờ duyệt',
        shortLabel: 'Chờ duyệt',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
        indicatorColor: 'bg-amber-500',
    },
    paid: {
        key: 'paid',
        label: 'Chờ duyệt (Đã TT QR)',
        shortLabel: 'Đã TT QR',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
        indicatorColor: 'bg-amber-500',
    },
    PAID: {
        key: 'PAID',
        label: 'Chờ duyệt (Đã TT QR)',
        shortLabel: 'Đã TT QR',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
        indicatorColor: 'bg-amber-500',
    },
    confirmed: {
        key: 'confirmed',
        label: 'Đã xác nhận',
        shortLabel: 'Đã xác nhận',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-300 font-semibold',
        indicatorColor: 'bg-blue-500',
    },
    checked_in: {
        key: 'checked_in',
        label: 'Đang ở',
        shortLabel: 'Đang ở',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold',
        indicatorColor: 'bg-emerald-500',
    },
    checked_out: {
        key: 'checked_out',
        label: 'Đã trả phòng',
        shortLabel: 'Đã trả phòng',
        badgeClass: 'bg-purple-50 text-purple-800 border-purple-300 font-semibold',
        indicatorColor: 'bg-purple-500',
    },
    cancelled: {
        key: 'cancelled',
        label: 'Đã hủy',
        shortLabel: 'Đã hủy',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 font-semibold',
        indicatorColor: 'bg-rose-500',
    },
    no_show: {
        key: 'no_show',
        label: 'Vắng mặt (No-show)',
        shortLabel: 'No-show',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 font-semibold',
        indicatorColor: 'bg-slate-400',
    },
};

// =========================================================================
// CẤU HÌNH TRẠNG THÁI YÊU CẦU DỊCH VỤ / KANBAN
// =========================================================================
export const SERVICE_REQUEST_STATUSES = {
    pending: {
        key: 'pending',
        label: 'Chờ xử lý',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 font-semibold',
        indicatorColor: 'bg-amber-500',
    },
    in_progress: {
        key: 'in_progress',
        label: 'Đang chuẩn bị',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 font-semibold',
        indicatorColor: 'bg-blue-500',
    },
    delivering: {
        key: 'delivering',
        label: 'Đang giao món',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 font-semibold',
        indicatorColor: 'bg-purple-500',
    },
    completed: {
        key: 'completed',
        label: 'Hoàn thành',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
        indicatorColor: 'bg-emerald-500',
    },
    cancelled: {
        key: 'cancelled',
        label: 'Đã hủy',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 font-semibold',
        indicatorColor: 'bg-rose-500',
    },
};

// =========================================================================
// DANH SÁCH NGÂN HÀNG VIỆT NAM (VIETQR NAPAS 247)
// =========================================================================
export const POPULAR_BANKS = [
    { bin: '970422', shortName: 'MB Bank', fullName: 'Ngân hàng TMCP Quân Đội' },
    { bin: '970436', shortName: 'Vietcombank', fullName: 'Ngân hàng TMCP Ngoại Thương Việt Nam' },
    { bin: '970415', shortName: 'VietinBank', fullName: 'Ngân hàng TMCP Công Thương Việt Nam' },
    { bin: '970418', shortName: 'BIDV', fullName: 'Ngân hàng TMCP Đầu Tư và Phát Triển Việt Nam' },
    { bin: '970407', shortName: 'Techcombank', fullName: 'Ngân hàng TMCP Kỹ Thương Việt Nam' },
    { bin: '970416', shortName: 'ACB', fullName: 'Ngân hàng TMCP Á Châu' },
    { bin: '970432', shortName: 'VPBank', fullName: 'Ngân hàng TMCP Việt Nam Thịnh Vượng' },
    { bin: '970423', shortName: 'TPBank', fullName: 'Ngân hàng TMCP Tiên Phong' },
    { bin: '970403', shortName: 'Sacombank', fullName: 'Ngân hàng TMCP Sài Gòn Thương Tín' },
    { bin: '970405', shortName: 'Agribank', fullName: 'Ngân hàng Nông Nghiệp và Phát Triển Nông Thôn' },
    { bin: '970443', shortName: 'SHB', fullName: 'Ngân hàng TMCP Sài Gòn - Hà Nội' },
    { bin: '970437', shortName: 'HDBank', fullName: 'Ngân hàng TMCP Phát Triển TP.HCM' },
    { bin: '970426', shortName: 'MSB', fullName: 'Ngân hàng TMCP Hàng Hải Việt Nam' },
    { bin: '970448', shortName: 'OCB', fullName: 'Ngân hàng TMCP Phương Đông' },
    { bin: '970441', shortName: 'VIB', fullName: 'Ngân hàng TMCP Quốc Tế Việt Nam' },
];

/**
 * Lấy tên hiển thị ngân hàng từ mã BIN
 * @param {string|number} bin 
 * @returns {string}
 */
export const getBankDisplayName = (bin) => {
    const bank = POPULAR_BANKS.find(b => String(b.bin) === String(bin));
    return bank ? `${bank.shortName} (${bank.fullName})` : `Ngân hàng (${bin})`;
};

// =========================================================================
// DANH MỤC HỎNG HÓC BẢO TRÌ PHÒNG
// =========================================================================
export const ISSUE_TYPE_MAP = {
    ac: 'Điều hòa / Thông gió',
    plumbing: 'Hệ thống nước / Thiết bị vệ sinh',
    electric: 'Điện / Chiếu sáng',
    electronics: 'Điện tử (TV, Tủ lạnh, Két)',
    furniture: 'Nội thất & Khóa cửa',
    other: 'Khác',
};

export default {
    ROOM_STATUSES,
    BOOKING_STATUSES,
    SERVICE_REQUEST_STATUSES,
    POPULAR_BANKS,
    getBankDisplayName,
    ISSUE_TYPE_MAP,
};
