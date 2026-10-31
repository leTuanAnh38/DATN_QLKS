import React, { useState, useEffect } from 'react';
import {
    Calendar,
    Clock,
    User,
    CheckCircle2,
    AlertCircle,
    Search,
    Filter,
    FileText,
    Printer,
    RefreshCw,
    Banknote,
    ArrowRight,
    TrendingUp,
    ShieldAlert,
    Check
} from 'lucide-react';
import paymentService from '../../../services/paymentService';
import ShiftZReportModal from '../modals/shift/ShiftZReportModal';
import CloseShiftModal from '../modals/shift/CloseShiftModal';
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
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [shiftTypeFilter, setShiftTypeFilter] = useState('ALL');

    // Modals
    const [selectedReportShiftId, setSelectedReportShiftId] = useState(null);
    const [selectedClosingShift, setSelectedClosingShift] = useState(null);

    const formatCurrency = (val) => {
        const num = Number(val) || 0;
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
    };

    const formatDateTime = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' +
            d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    const fetchShifts = async () => {
        setLoading(true);
        try {
            const params = {};
            if (statusFilter !== 'ALL') params.status = statusFilter;
            if (shiftTypeFilter !== 'ALL') params.shift_type = shiftTypeFilter;
            if (searchTerm.trim()) params.search = searchTerm.trim();

            const res = await paymentService.getShifts(params);
            const list = res.shifts || res.results || res.data || [];
            setShifts(Array.isArray(list) ? list : []);
        } catch (err) {
            console.error('Lỗi khi tải danh sách ca làm việc:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchShifts();
    }, [statusFilter, shiftTypeFilter]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchShifts();
    };

    return (
        <div className="space-y-4">
            {/* Bộ lọc và thanh tìm kiếm */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Tìm theo mã ca, tên thu ngân..."
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </form>

                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                    >
                        <option value="ALL">Tất cả trạng thái</option>
                        <option value="OPEN">Đang trực ca (Mở)</option>
                        <option value="CLOSED">Đã kết ca (Đóng)</option>
                    </select>

                    <select
                        value={shiftTypeFilter}
                        onChange={(e) => setShiftTypeFilter(e.target.value)}
                        className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                    >
                        <option value="ALL">Tất cả loại ca</option>
                        <option value="MORNING">Ca Sáng</option>
                        <option value="AFTERNOON">Ca Chiều</option>
                        <option value="NIGHT">Ca Đêm</option>
                        <option value="ADMIN">Ca Hành Chính</option>
                    </select>

                    <button
                        type="button"
                        onClick={fetchShifts}
                        disabled={loading}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                        title="Tải lại danh sách"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Bảng danh sách các ca làm việc */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider">
                            <tr>
                                <th className="py-3 px-4">Mã Ca / Loại Ca</th>
                                <th className="py-3 px-4">Thu Ngân Trực</th>
                                <th className="py-3 px-4">Thời Gian Ca</th>
                                <th className="py-3 px-4 text-right">Đầu Ca</th>
                                <th className="py-3 px-4 text-right">Tổng Thu Trong Ca</th>
                                <th className="py-3 px-4 text-right">Tổng Chi Trong Ca</th>
                                <th className="py-3 px-4 text-right">Thực Kiểm Két</th>
                                <th className="py-3 px-4 text-center">Chênh Lệch</th>
                                <th className="py-3 px-4">Bàn Giao Cho</th>
                                <th className="py-3 px-4 text-center">Hành Động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="10" className="py-12 text-center text-slate-400">
                                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                        Đang tải lịch sử ca làm việc...
                                    </td>
                                </tr>
                            ) : shifts.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="py-12 text-center text-slate-400">
                                        Chưa có ca làm việc nào được ghi nhận.
                                    </td>
                                </tr>
                            ) : (
                                shifts.map((item) => {
                                    const isOpen = item.status === 'OPEN';
                                    const diff = Number(item.difference || 0);

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-50/60 transition">
                                            {/* Mã Ca & Loại ca */}
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <div className="font-mono font-bold text-slate-900">
                                                    #{item.shift_code}
                                                </div>
                                                <div className="mt-0.5">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        isOpen
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                    }`}>
                                                        {item.shift_type_display || item.shift_type} • {isOpen ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Thu ngân */}
                                            <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                                                        {item.user_name ? item.user_name[0] : 'U'}
                                                    </div>
                                                    <span>{item.user_name || 'Thu ngân'}</span>
                                                </div>
                                            </td>

                                            {/* Thời gian */}
                                            <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                                                <div className="text-[11px]">
                                                    <span className="text-slate-400">Mở:</span> {formatDateTime(item.opened_at)}
                                                </div>
                                                {item.closed_at && (
                                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                                        <span className="text-slate-400">Đóng:</span> {formatDateTime(item.closed_at)}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Tiền đầu ca */}
                                            <td className="py-3 px-4 text-right whitespace-nowrap font-mono text-slate-700">
                                                {formatCurrency(item.opening_cash)}
                                            </td>

                                            {/* Tổng thu trong ca */}
                                            <td className="py-3 px-4 text-right whitespace-nowrap">
                                                <div className="font-mono font-bold text-emerald-600">
                                                    +{formatCurrency(
                                                        item.total_revenue != null && Number(item.total_revenue) > 0
                                                            ? item.total_revenue
                                                            : (item.realtime_summary?.total_revenue ?? (Number(item.total_cash_in || item.realtime_summary?.cash_in || 0) + Number(item.total_transfer_in || item.realtime_summary?.transfer_in || 0) + Number(item.total_card_in || item.realtime_summary?.card_in || 0)))
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    Tiền mặt: {formatCurrency(item.total_cash_in != null && Number(item.total_cash_in) > 0 ? item.total_cash_in : (item.realtime_summary?.cash_in ?? 0))}
                                                </div>
                                            </td>

                                            {/* Tổng chi trong ca */}
                                            <td className="py-3 px-4 text-right whitespace-nowrap">
                                                {Number(item.total_cash_out || item.realtime_summary?.cash_out || 0) > 0 || Number(item.total_transfer_out || item.realtime_summary?.transfer_out || 0) > 0 ? (
                                                    <div>
                                                        {Number(item.total_cash_out || item.realtime_summary?.cash_out || 0) > 0 && (
                                                            <div>
                                                                <span className="font-mono font-bold text-rose-600">
                                                                    -{formatCurrency(item.total_cash_out || item.realtime_summary?.cash_out)}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-normal ml-1">(Két)</span>
                                                            </div>
                                                        )}
                                                        {Number(item.total_transfer_out || item.realtime_summary?.transfer_out || 0) > 0 && (
                                                            <div className="mt-0.5">
                                                                <span className="font-mono font-semibold text-blue-600 text-[11px]">
                                                                    -{formatCurrency(item.total_transfer_out || item.realtime_summary?.transfer_out)}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-normal ml-1">(CK)</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="font-mono text-slate-400">0 đ</span>
                                                )}
                                            </td>

                                            {/* Thực kiểm két */}
                                            <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-slate-900">
                                                {isOpen ? (
                                                    <span className="text-slate-400 italic">Đang hoạt động...</span>
                                                ) : (
                                                    formatCurrency(item.actual_cash)
                                                )}
                                            </td>

                                            {/* Chênh lệch */}
                                            <td className="py-3 px-4 text-center whitespace-nowrap">
                                                {isOpen ? (
                                                    <span className="text-slate-400">—</span>
                                                ) : diff === 0 ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <Check className="w-3 h-3" /> Khớp 100%
                                                    </span>
                                                ) : diff > 0 ? (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                                        +{formatCurrency(diff)}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                                        {formatCurrency(diff)}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Người nhận */}
                                            <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                                                {item.handover_user_name || '—'}
                                            </td>

                                            {/* Thao tác */}
                                            <td className="py-3 px-4 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {isOpen ? (
                                                        (item.user === currentUser?.id || item.user_name === currentUser?.username || isManagerRole) ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedClosingShift(item)}
                                                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold rounded-lg border border-amber-200 transition text-[11px]"
                                                            >
                                                                {isManagerRole && item.user !== currentUser?.id ? 'Đóng ca' : 'Kết ca'}
                                                            </button>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400 italic">Đang trực...</span>
                                                        )
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedReportShiftId(item.id)}
                                                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-[11px] flex items-center gap-1"
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
