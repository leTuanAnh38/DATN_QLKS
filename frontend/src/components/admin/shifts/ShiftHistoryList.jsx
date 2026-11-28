import React, { useState, useEffect, useCallback } from 'react';
import {
    Search,
    Printer,
    RefreshCw,
    ArrowRight,
    Check
} from 'lucide-react';
import paymentService from '../../../services/paymentService';
import ShiftZReportModal from '../modals/shift/ShiftZReportModal';
import CloseShiftModal from '../modals/shift/CloseShiftModal';
import Pagination from '../../common/Pagination';
import { authStore } from '../../../store/authStore';

export default function ShiftHistoryList({ onRefreshActiveShift }) {
    const currentUser = authStore.getUser();
    const isManagerRole = Boolean(
        currentUser?.role === 'admin' ||
        currentUser?.role === 'owner' ||
        currentUser?.role === 'manager' ||
        currentUser?.is_superuser
    );

    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [appliedSearch, setAppliedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [shiftTypeFilter, setShiftTypeFilter] = useState('ALL');

    // Phân trang server-side
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // Modals
    const [selectedReportShiftId, setSelectedReportShiftId] = useState(null);
    const [selectedClosingShift, setSelectedClosingShift] = useState(null);

    const formatCurrency = (val) => {
        const num = Number(val) || 0;
        return `${num.toLocaleString('vi-VN')}₫`;
    };

    const formatDateTime = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' +
            d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    const fetchShifts = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page: currentPage,
                page_size: pageSize
            };
            if (statusFilter !== 'ALL') params.status = statusFilter;
            if (shiftTypeFilter !== 'ALL') params.shift_type = shiftTypeFilter;
            if (appliedSearch) params.search = appliedSearch;

            const res = await paymentService.getShifts(params);
            const list = res.shifts || res.results || res.data || [];
            setShifts(Array.isArray(list) ? list : []);
            const countVal = Number(res.count ?? list.length ?? 0);
            setTotalCount(countVal);
            setTotalPages(Math.max(1, Number(res.total_pages ?? Math.ceil((countVal || 1) / pageSize))));
        } catch (err) {
            console.error('Lỗi khi tải danh sách ca làm việc:', err);
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, statusFilter, shiftTypeFilter, appliedSearch]);

    useEffect(() => {
        fetchShifts();
    }, [fetchShifts]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setCurrentPage(1);
        setAppliedSearch(searchTerm.trim());
    };

    return (
        <div className="space-y-3">
            {/* Bộ lọc và thanh tìm kiếm */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Tìm theo mã ca, tên thu ngân..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </form>

                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                        className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
                    >
                        <option value="ALL">Tất cả trạng thái</option>
                        <option value="OPEN">Đang trực ca (Mở)</option>
                        <option value="CLOSED">Đã kết ca (Đóng)</option>
                    </select>

                    <select
                        value={shiftTypeFilter}
                        onChange={(e) => { setShiftTypeFilter(e.target.value); setCurrentPage(1); }}
                        className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
                    >
                        <option value="ALL">Tất cả loại ca</option>
                        <option value="MORNING">Ca Sáng</option>
                        <option value="AFTERNOON">Ca Chiều</option>
                        <option value="NIGHT">Ca Đêm</option>
                        <option value="STANDARD">Ca Hành Chính</option>
                    </select>

                    <button
                        type="button"
                        onClick={fetchShifts}
                        disabled={loading}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                        title="Tải lại danh sách"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Bảng danh sách các ca làm việc (7 cột gọn chuẩn Compact PMS) */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                            <tr>
                                <th className="py-2.5 px-3">Mã & Loại Ca</th>
                                <th className="py-2.5 px-3">Thu Ngân / Bàn Giao</th>
                                <th className="py-2.5 px-3">Thời Gian</th>
                                <th className="py-2.5 px-3 text-right">Đầu Ca</th>
                                <th className="py-2.5 px-3 text-right">Thu / Chi Trong Ca</th>
                                <th className="py-2.5 px-3 text-right">Thực Kiểm & Lệch</th>
                                <th className="py-2.5 px-3 text-center">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="py-10 text-center text-slate-400">
                                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                        Đang tải lịch sử ca làm việc...
                                    </td>
                                </tr>
                            ) : shifts.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="py-10 text-center text-slate-400">
                                        Chưa có ca làm việc nào được ghi nhận.
                                    </td>
                                </tr>
                            ) : (
                                shifts.map((item) => {
                                    const isOpen = item.status === 'OPEN';
                                    const diff = Number(item.difference || 0);
                                    const totalRev = item.total_revenue != null && Number(item.total_revenue) > 0
                                        ? item.total_revenue
                                        : (item.realtime_summary?.total_revenue ?? (Number(item.total_cash_in || item.realtime_summary?.cash_in || 0) + Number(item.total_transfer_in || item.realtime_summary?.transfer_in || 0) + Number(item.total_card_in || item.realtime_summary?.card_in || 0)));
                                    const cashOut = Number(item.total_cash_out || item.realtime_summary?.cash_out || 0);
                                    const transferOut = Number(item.total_transfer_out || item.realtime_summary?.transfer_out || 0);
                                    const totalOut = cashOut + transferOut;

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/60 transition">
                                            {/* 1. Mã Ca & Loại ca */}
                                            <td className="py-2 px-3 whitespace-nowrap">
                                                <div className="font-mono font-bold text-slate-900">
                                                    #{item.shift_code}
                                                </div>
                                                <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                    isOpen
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                }`}>
                                                    {item.shift_type_display || item.shift_type} • {isOpen ? 'MỞ' : 'ĐÓNG'}
                                                </span>
                                            </td>

                                            {/* 2. Thu ngân & Người nhận bàn giao */}
                                            <td className="py-2 px-3 min-w-[140px]">
                                                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                                                    <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                                                        {item.user_name ? item.user_name[0] : 'U'}
                                                    </div>
                                                    <span className="truncate">{item.user_name || 'Thu ngân'}</span>
                                                </div>
                                                {item.handover_user_name && (
                                                    <div className="text-[10.5px] text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                                                        <ArrowRight className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                                        <span className="truncate">{item.handover_user_name}</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* 3. Thời gian */}
                                            <td className="py-2 px-3 whitespace-nowrap text-slate-600 tabular-nums">
                                                <div className="text-[11px]">
                                                    <span className="text-slate-400">Mở:</span> {formatDateTime(item.opened_at)}
                                                </div>
                                                {item.closed_at && (
                                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                                        <span className="text-slate-400">Đóng:</span> {formatDateTime(item.closed_at)}
                                                    </div>
                                                )}
                                            </td>

                                            {/* 4. Tiền đầu ca */}
                                            <td className="py-2 px-3 text-right whitespace-nowrap font-mono font-medium text-slate-700 tabular-nums">
                                                {formatCurrency(item.opening_cash)}
                                            </td>

                                            {/* 5. Tổng Thu / Chi trong ca */}
                                            <td className="py-2 px-3 text-right whitespace-nowrap tabular-nums">
                                                <div
                                                    className="font-mono font-bold text-emerald-600"
                                                    title={`Tiền mặt: ${formatCurrency(item.total_cash_in != null && Number(item.total_cash_in) > 0 ? item.total_cash_in : (item.realtime_summary?.cash_in ?? 0))}`}
                                                >
                                                    +{formatCurrency(totalRev)}
                                                </div>
                                                <div className="text-[11px] mt-0.5">
                                                    {totalOut > 0 ? (
                                                        <span
                                                            className="font-mono font-semibold text-rose-600"
                                                            title={`Chi két: ${formatCurrency(cashOut)} • Chi CK: ${formatCurrency(transferOut)}`}
                                                        >
                                                            -{formatCurrency(totalOut)}
                                                        </span>
                                                    ) : (
                                                        <span className="font-mono text-slate-400 text-[10.5px]">Chi: 0₫</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* 6. Thực kiểm két & Chênh lệch */}
                                            <td className="py-2 px-3 text-right whitespace-nowrap tabular-nums">
                                                {isOpen ? (
                                                    <span className="text-slate-400 italic text-[11px]">Đang hoạt động</span>
                                                ) : (
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        <span className="font-mono font-bold text-slate-900">
                                                            {formatCurrency(item.actual_cash)}
                                                        </span>
                                                        {diff === 0 ? (
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                <Check className="w-2.5 h-2.5" /> Khớp 100%
                                                            </span>
                                                        ) : diff > 0 ? (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                                                +{formatCurrency(diff)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                                                {formatCurrency(diff)}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* 7. Thao tác */}
                                            <td className="py-2 px-3 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1">
                                                    {isOpen ? (
                                                        (item.user === currentUser?.id || item.user_name === currentUser?.username || isManagerRole) ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedClosingShift(item)}
                                                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-lg border border-amber-200 transition text-[11px] cursor-pointer"
                                                            >
                                                                {isManagerRole && item.user !== currentUser?.id ? 'Đóng ca' : 'Kết ca'}
                                                            </button>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400 italic">Đang trực</span>
                                                        )
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedReportShiftId(item.id)}
                                                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                                            title="Xem & in Z-Report"
                                                        >
                                                            <Printer className="w-3.5 h-3.5" />
                                                            <span>Z-Report</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PHÂN TRANG LỊCH SỬ CA TRỰC */}
                {!loading && totalCount > 0 && (
                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalCount={totalCount}
                            pageSize={pageSize}
                            onPageChange={(p) => setCurrentPage(p)}
                            onPageSizeChange={(size) => {
                                setPageSize(size);
                                setCurrentPage(1);
                            }}
                            pageSizeOptions={[10, 20, 50]}
                        />
                    </div>
                )}
            </div>

            {/* Modal In Z-Report */}
            {selectedReportShiftId && (
                <ShiftZReportModal
                    shiftId={selectedReportShiftId}
                    onClose={() => setSelectedReportShiftId(null)}
                />
            )}

            {/* Modal Đóng ca từ bảng */}
            {selectedClosingShift && (
                <CloseShiftModal
                    isOpen={true}
                    shift={selectedClosingShift}
                    onClose={() => setSelectedClosingShift(null)}
                    onShiftClosed={() => {
                        fetchShifts();
                        if (onRefreshActiveShift) onRefreshActiveShift();
                    }}
                />
            )}
        </div>
    );
}
