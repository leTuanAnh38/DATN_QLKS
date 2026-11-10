import React, { useState, useMemo } from 'react';
import {
    KeyRound,
    X,
    Search,
    Inbox,
    AlertTriangle,
    Zap,
    Clock,
    Check,
    Phone,
    Calendar,
    ClipboardList
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../../utils/formatters';

export default function AssignRoomModal({
    room,
    onClose,
    eligibleBookings = [],
    isLoadingEligible = false,
    isSubmitting = false,
    onConfirmAssign,
    onGoToBookings
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMode, setFilterMode] = useState('match_category'); // 'match_category' | 'all'

    const filteredBookings = useMemo(() => {
        if (!room) return [];
        return eligibleBookings.filter((b) => {
            const matchesSearch =
                !searchTerm.trim() ||
                (b.guest_name && b.guest_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (b.guest_phone && b.guest_phone.includes(searchTerm)) ||
                (b.booking_code && b.booking_code.toLowerCase().includes(searchTerm.toLowerCase()));

            if (!matchesSearch) return false;

            if (filterMode === 'match_category') {
                const isCatMatch =
                    String(b.category?.id || b.category_id || b.room?.category?.id) ===
                    String(room.category?.id || room.category_id) ||
                    (b.category_name || b.room_type || '').toLowerCase() === (room.category_name || '').toLowerCase();
                return isCatMatch;
            }

            return true;
        });
    }, [eligibleBookings, searchTerm, filterMode, room]);

    if (!room) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div
                className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-xs">
                            <KeyRound className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-lg text-slate-900 tracking-tight">
                                    Gán Phòng {room.room_number} & Check-in Đón Khách
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    Sẵn sàng đón khách
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Tầng {room.floor} • Hạng phòng: {room.category_name} ({formatCurrency(room.category_base_price)}/đêm)
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm"
                        title="Đóng cửa sổ"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Thanh tìm kiếm & Bộ lọc cùng hạng phòng */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        {/* Search input */}
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Tìm kiếm theo tên khách, số điện thoại hoặc mã đơn..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-600 text-slate-900"
                            />
                            <Search className="absolute left-3 top-2.5 text-slate-400 w-3.5 h-3.5" />
                        </div>

                        {/* Filter tabs */}
                        <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold shrink-0">
                            <button
                                type="button"
                                onClick={() => setFilterMode('match_category')}
                                className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-[11px] ${
                                    filterMode === 'match_category'
                                        ? 'bg-white text-emerald-800 font-bold shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Cùng hạng phòng
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterMode('all')}
                                className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-[11px] ${
                                    filterMode === 'all'
                                        ? 'bg-white text-blue-800 font-bold shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Tất cả đơn chờ nhận
                            </button>
                        </div>
                    </div>
                </div>

                {/* Danh sách các đơn chờ nhận phòng */}
                <div className="p-6 space-y-3 text-xs overflow-y-auto flex-1">
                    {isLoadingEligible ? (
                        <div className="py-12 text-center">
                            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            <span className="text-slate-500 font-medium">Đang tải danh sách đơn đặt phòng chờ nhận...</span>
                        </div>
                    ) : filteredBookings.length === 0 ? (
                        <div className="py-12 text-center space-y-3">
                            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                                <Inbox className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">
                                    {filterMode === 'match_category'
                                        ? `Không có đơn nào thuộc hạng "${room.category_name}" đang chờ nhận phòng.`
                                        : 'Không tìm thấy đơn đặt phòng nào phù hợp.'}
                                </h4>
                                <p className="text-slate-500 text-xs mt-1">
                                    Bạn có thể thử chuyển sang xem "Tất cả đơn chờ nhận" hoặc tiếp đón khách vãng lai (Walk-in).
                                </p>
                            </div>
                            {filterMode === 'match_category' && (
                                <button
                                    type="button"
                                    onClick={() => setFilterMode('all')}
                                    className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-bold text-xs transition cursor-pointer"
                                >
                                    Hiển thị tất cả đơn chờ nhận phòng &rarr;
                                </button>
                            )}
                        </div>
                    ) : (
                        filteredBookings.map((b) => {
                            const isCatMatch =
                                String(b.category?.id || b.category_id || b.room?.category?.id) ===
                                String(room.category?.id || room.category_id) ||
                                (b.category_name || b.room_type || '').toLowerCase() === (room.category_name || '').toLowerCase();

                            const todayStr = new Date().toISOString().split('T')[0];
                            const bookingCheckInStr = b.check_in_date ? String(b.check_in_date).split('T')[0] : '';
                            const bookingCheckOutStr = b.check_out_date ? String(b.check_out_date).split('T')[0] : '';
                            const isExpired = Boolean(bookingCheckOutStr && bookingCheckOutStr <= todayStr);
                            const isEarly = Boolean(!isExpired && bookingCheckInStr && bookingCheckInStr > todayStr);
                            const isLate = Boolean(!isExpired && bookingCheckInStr && bookingCheckInStr < todayStr);
                            let earlyDays = 0;
                            let lateDays = 0;
                            if (isEarly) {
                                const d1 = new Date(bookingCheckInStr);
                                const d2 = new Date(todayStr);
                                d1.setHours(0, 0, 0, 0);
                                d2.setHours(0, 0, 0, 0);
                                earlyDays = Math.max(1, Math.round((d1 - d2) / (1000 * 60 * 60 * 24)));
                            } else if (isLate) {
                                const d1 = new Date(todayStr);
                                const d2 = new Date(bookingCheckInStr);
                                d1.setHours(0, 0, 0, 0);
                                d2.setHours(0, 0, 0, 0);
                                lateDays = Math.max(1, Math.round((d1 - d2) / (1000 * 60 * 60 * 24)));
                            }

                            return (
                                <div
                                    key={b.id}
                                    className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                        isExpired
                                            ? 'bg-rose-50/40 border-rose-200'
                                            : isEarly
                                                ? 'bg-amber-50/40 hover:bg-amber-50 border-amber-200'
                                                : isLate
                                                    ? 'bg-orange-50/40 hover:bg-orange-50 border-orange-200'
                                                    : isCatMatch
                                                        ? 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200'
                                                        : 'bg-white hover:bg-slate-50 border-slate-200'
                                    }`}
                                >
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-black text-sm text-slate-900">
                                                {b.guest_name}
                                            </span>
                                            <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                #{b.booking_code}
                                            </span>
                                            {isExpired && (
                                                <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300 flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" /> Quá hạn trả
                                                </span>
                                            )}
                                            {isEarly && (
                                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                                                    <Zap className="w-3 h-3" /> Sớm {earlyDays} ngày
                                                </span>
                                            )}
                                            {isLate && (
                                                <span className="text-[10px] font-bold text-orange-800 bg-orange-100 px-2.5 py-0.5 rounded-full border border-orange-300 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> Trễ {lateDays} ngày
                                                </span>
                                            )}
                                            {isCatMatch ? (
                                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 inline-flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Đúng hạng phòng
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                                    Hạng đặt: {b.category_name || b.room_type || 'Khác'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-slate-500 text-[11px]">
                                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {b.guest_phone || '—'}</span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" /> {formatDate(b.check_in_date)} &rarr; {formatDate(b.check_out_date)}
                                            </span>
                                            <span>•</span>
                                            <span className="font-bold text-slate-700">
                                                {formatCurrency(b.total_amount)}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={isSubmitting || isExpired}
                                        onClick={() => onConfirmAssign && onConfirmAssign(b)}
                                        className={`px-4 py-2 font-bold rounded-xl text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 text-white ${
                                            isExpired
                                                ? 'bg-slate-400 cursor-not-allowed'
                                                : isEarly
                                                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                                                    : isLate
                                                        ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/20'
                                                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                                        }`}
                                    >
                                        <span>
                                            {isExpired ? (
                                                <AlertTriangle className="w-3.5 h-3.5" />
                                            ) : isEarly ? (
                                                <Zap className="w-3.5 h-3.5" />
                                            ) : isLate ? (
                                                <Clock className="w-3.5 h-3.5" />
                                            ) : (
                                                <KeyRound className="w-3.5 h-3.5" />
                                            )}
                                        </span>
                                        <span>
                                            {isExpired
                                                ? 'Quá hạn lưu trú'
                                                : isEarly
                                                    ? `Check-in sớm (${earlyDays}N)`
                                                    : isLate
                                                        ? `Check-in trễ (${lateDays}N)`
                                                        : 'Gán phòng & Check-in ngay'}
                                        </span>
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    {onGoToBookings ? (
                        <button
                            type="button"
                            onClick={onGoToBookings}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                        >
                            <span className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Đi tới Quản lý Đặt phòng</span>
                        </button>
                    ) : <div />}
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition cursor-pointer text-xs"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}

