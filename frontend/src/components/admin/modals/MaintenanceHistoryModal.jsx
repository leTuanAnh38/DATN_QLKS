import React, { useState, useEffect, useMemo } from 'react';
import roomService from '../../../services/roomService';

export default function MaintenanceHistoryModal({
    isOpen,
    onClose,
    filterRoomId = null,
    filterRoomNumber = null,
    formatCurrency = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`,
    formatDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—',
}) {
    const [tickets, setTickets] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'fixing', 'completed'
    const [isGuestFaultFilter, setIsGuestFaultFilter] = useState('all'); // 'all', 'guest', 'hotel'

    // Phân trang
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(6);

    useEffect(() => {
        if (isOpen) {
            fetchTickets();
        }
    }, [isOpen, filterRoomId]);

    // Reset về trang 1 khi thay đổi điều kiện lọc hoặc tìm kiếm
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, isGuestFaultFilter, filterRoomId]);

    const fetchTickets = async () => {
        setIsLoading(true);
        try {
            const params = {};
            if (filterRoomId) {
                params.room = filterRoomId;
            }
            const res = await roomService.getMaintenanceTickets(params);
            if (res && res.data) {
                // Hỗ trợ trường hợp phân trang pagination results hoặc mảng
                const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
                setTickets(list);
            }
        } catch (err) {
            console.error('Lỗi tải lịch sử bảo trì:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Lọc dữ liệu theo search và bộ lọc
    const filteredTickets = useMemo(() => {
        return tickets.filter((t) => {
            const matchSearch =
                !searchTerm ||
                (t.ticket_code && t.ticket_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (t.room_number && String(t.room_number).includes(searchTerm)) ||
                (t.equipment_name && t.equipment_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (t.parts_replaced && t.parts_replaced.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchStatus =
                statusFilter === 'all' ||
                (statusFilter === 'fixing' && (t.status === 'fixing' || t.status === 'pending' || t.status === 'in_progress')) ||
                (statusFilter === 'completed' && t.status === 'completed');

            const matchFault =
                isGuestFaultFilter === 'all' ||
                (isGuestFaultFilter === 'guest' && t.is_guest_fault) ||
                (isGuestFaultFilter === 'hotel' && !t.is_guest_fault);

            return matchSearch && matchStatus && matchFault;
        });
    }, [tickets, searchTerm, statusFilter, isGuestFaultFilter]);

    // Tính toán phân trang
    const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);

    const paginatedTickets = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return filteredTickets.slice(start, start + pageSize);
    }, [filteredTickets, safePage, pageSize]);

    // Tạo danh sách số trang hiển thị
    const pageNumbers = useMemo(() => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const pages = [1];
        if (safePage > 3) pages.push('...');
        const start = Math.max(2, safePage - 1);
        const end = Math.min(totalPages - 1, safePage + 1);
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        if (safePage < totalPages - 2) pages.push('...');
        pages.push(totalPages);
        return pages;
    }, [totalPages, safePage]);

    // Thống kê tổng hợp
    const stats = useMemo(() => {
        const totalCount = tickets.length;
        const fixingCount = tickets.filter((t) => t.status === 'fixing' || t.status === 'pending' || t.status === 'in_progress').length;
        const completedCount = tickets.filter((t) => t.status === 'completed').length;
        const totalCost = tickets.reduce((sum, t) => sum + Number(t.cost || 0), 0);
        const guestCost = tickets.filter((t) => t.is_guest_fault).reduce((sum, t) => sum + Number(t.cost || 0), 0);
        const hotelCost = totalCost - guestCost;

        return { totalCount, fixingCount, completedCount, totalCost, guestCost, hotelCost };
    }, [tickets]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div
                className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-xl font-bold shadow-xs">
                            📋
                        </div>
                        <div>
                            <h3 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
                                <span>Lịch Sử Sửa Chữa & Bảo Trì Thiết Bị</span>
                                {filterRoomNumber && (
                                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                                        Phòng {filterRoomNumber}
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Theo dõi chi tiết hỏng hóc, ngày bắt đầu sửa, vật tư thay thế và chi phí bảo trì
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-bold transition cursor-pointer"
                        title="Đóng"
                    >
                        ✕
                    </button>
                </div>

                {/* KPI Metrics Cards */}
                <div className="p-5 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                    <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng số lượt</div>
                        <div className="text-xl font-black text-slate-900 mt-0.5">{stats.totalCount} phiếu</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <span className="text-amber-600 font-bold">{stats.fixingCount} đang sửa</span>
                            <span>•</span>
                            <span className="text-emerald-600 font-bold">{stats.completedCount} đã xong</span>
                        </div>
                    </div>

                    <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng chi phí phát sinh</div>
                        <div className="text-xl font-black text-blue-700 mt-0.5">{formatCurrency(stats.totalCost)}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Bao gồm vật tư & công thợ</div>
                    </div>

                    <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Khách sạn chịu</div>
                        <div className="text-xl font-black text-slate-700 mt-0.5">{formatCurrency(stats.hotelCost)}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Bảo dưỡng hao mòn tự nhiên</div>
                    </div>

                    <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Khách bồi thường</div>
                        <div className="text-xl font-black text-rose-600 mt-0.5">{formatCurrency(stats.guestCost)}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Tính vào Hóa đơn Checkout</div>
                    </div>
                </div>

                {/* Filters & Search Toolbar */}
                <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                        <div className="relative flex-1 min-w-[200px]">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                            <input
                                type="text"
                                placeholder="Tìm mã phiếu, số phòng, tên thiết bị, vật tư..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                            />
                        </div>

                        {/* Bộ lọc trạng thái */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                        >
                            <option value="all">Tất cả trạng thái</option>
                            <option value="fixing">⚙️ Đang bảo trì</option>
                            <option value="completed">✓ Đã hoàn tất</option>
                        </select>

                        {/* Bộ lọc bồi thường */}
                        <select
                            value={isGuestFaultFilter}
                            onChange={(e) => setIsGuestFaultFilter(e.target.value)}
                            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                        >
                            <option value="all">Tất cả nguồn chi phí</option>
                            <option value="hotel">🏢 Khách sạn bảo dưỡng</option>
                            <option value="guest">⚠️ Khách đền bù</option>
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={fetchTickets}
                        disabled={isLoading}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <span>🔄</span>
                        <span>Làm mới</span>
                    </button>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                    {isLoading ? (
                        <div className="p-16 text-center">
                            <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            <span className="text-xs text-slate-500 font-bold">Đang tải nhật ký bảo trì...</span>
                        </div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="p-16 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <span className="text-3xl block mb-2">📦</span>
                            <h4 className="text-sm font-bold text-slate-800">Không có dữ liệu bảo trì phù hợp</h4>
                            <p className="text-xs text-slate-400 mt-1">Chưa có phiếu bảo trì nào được ghi nhận hoặc không khớp với bộ lọc.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold uppercase text-[10px] tracking-wider">
                                        <th className="py-3 px-3.5">Mã phiếu</th>
                                        <th className="py-3 px-3">Phòng</th>
                                        <th className="py-3 px-3.5">Thiết bị & Sự cố</th>
                                        <th className="py-3 px-3.5">Thời gian sửa chữa</th>
                                        <th className="py-3 px-3.5">Vật tư thay thế</th>
                                        <th className="py-3 px-3.5 text-right">Chi phí</th>
                                        <th className="py-3 px-3.5 text-center">Nguồn chi phí</th>
                                        <th className="py-3 px-3.5 text-center">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {paginatedTickets.map((t) => {
                                        const isDone = t.status === 'completed';
                                        return (
                                            <tr key={t.id} className="hover:bg-slate-50/80 transition">
                                                {/* Mã phiếu */}
                                                <td className="py-3 px-3.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                                                    #{t.ticket_code}
                                                </td>

                                                {/* Phòng */}
                                                <td className="py-3 px-3 whitespace-nowrap">
                                                    <span className="font-black text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                                        P.{t.room_number}
                                                    </span>
                                                </td>

                                                {/* Thiết bị & Sự cố */}
                                                <td className="py-3 px-3.5">
                                                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                                        <span>🛠️</span>
                                                        <span>{t.equipment_name}</span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                                        {t.issue_type_display || t.issue_type}
                                                        {t.description && ` — ${t.description}`}
                                                    </div>
                                                </td>

                                                {/* Thời gian */}
                                                <td className="py-3 px-3.5 whitespace-nowrap text-slate-600 text-[11px]">
                                                    <div>Bắt đầu: {formatDate(t.start_date)}</div>
                                                    {t.completed_date ? (
                                                        <div className="text-emerald-700 font-medium">Xong: {formatDate(t.completed_date)}</div>
                                                    ) : (
                                                        <div className="text-amber-600 font-bold italic animate-pulse">Đang khắc phục...</div>
                                                    )}
                                                </td>

                                                {/* Vật tư thay thế */}
                                                <td className="py-3 px-3.5 max-w-[200px]">
                                                    {t.parts_replaced ? (
                                                        <span className="font-medium text-slate-800 bg-slate-50 px-2 py-1 rounded-md border border-slate-200 inline-block line-clamp-2" title={t.parts_replaced}>
                                                            {t.parts_replaced}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 italic">Không thay vật tư</span>
                                                    )}
                                                </td>

                                                {/* Chi phí */}
                                                <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                                    <span className="font-black text-sm text-slate-900">
                                                        {formatCurrency(t.cost)}
                                                    </span>
                                                </td>

                                                {/* Nguồn chi phí */}
                                                <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                                    {t.is_guest_fault ? (
                                                        <div className="space-y-0.5">
                                                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                                Khách bồi thường
                                                            </span>
                                                            {t.booking_code && (
                                                                <div className="text-[10px] font-mono text-slate-400">
                                                                    #{t.booking_code}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                            Khách sạn chịu
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Trạng thái */}
                                                <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                                    {isDone ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                            Đã hoàn thành
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                            Đang sửa chữa
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer với Phân Trang */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    {/* Thông tin số lượng & Chọn kích thước trang */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>
                            Hiển thị{' '}
                            <strong className="text-slate-800 font-bold">
                                {filteredTickets.length === 0 ? 0 : (safePage - 1) * pageSize + 1}
                                {' - '}
                                {Math.min(safePage * pageSize, filteredTickets.length)}
                            </strong>{' '}
                            / <strong className="text-slate-800 font-bold">{filteredTickets.length}</strong> phiếu
                        </span>

                        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                            <span className="text-[11px] text-slate-400 font-medium">Mỗi trang:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                            >
                                <option value={5}>5 phiếu</option>
                                <option value={6}>6 phiếu</option>
                                <option value={10}>10 phiếu</option>
                                <option value={20}>20 phiếu</option>
                            </select>
                        </div>
                    </div>

                    {/* Điều khiển chuyển trang */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            disabled={safePage <= 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Trang trước"
                        >
                            ‹ Trước
                        </button>

                        {pageNumbers.map((p, idx) => {
                            if (p === '...') {
                                return (
                                    <span key={`dots-${idx}`} className="px-1.5 text-slate-400 text-xs font-bold">
                                        ...
                                    </span>
                                );
                            }
                            const isActive = p === safePage;
                            return (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setCurrentPage(p)}
                                    className={`min-w-[32px] h-8 px-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                                        isActive
                                            ? 'bg-amber-600 text-white shadow-xs'
                                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                    }`}
                                >
                                    {p}
                                </button>
                            );
                        })}

                        <button
                            type="button"
                            disabled={safePage >= totalPages}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Trang sau"
                        >
                            Sau ›
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="ml-2 px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
