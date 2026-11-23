import React from 'react';
import {
    CalendarCheck,
    Clock,
    CheckCircle2,
    BedDouble,
    XCircle,
    WalletCards
} from 'lucide-react';

/**
 * HÀNG THỐNG KÊ NHANH (QUICK STATS CARDS) CỦA ĐẶT PHÒNG
 */
export default function BookingStatsBar({
    stats = {
        total: 0,
        pending: 0,
        confirmed: 0,
        checkedIn: 0,
        cancelled: 0,
        totalRevenue: 0,
        validCount: 0
    },
    statusFilter = 'all',
    onStatusFilterChange
}) {
    const handleFilterClick = (status) => {
        if (!onStatusFilterChange) return;
        if (status === 'all') {
            onStatusFilterChange('all');
        } else {
            onStatusFilterChange(statusFilter === status ? 'all' : status);
        }
    };

    const total = stats.total || 1;
    const pendingPct = Math.round((stats.pending / total) * 100);
    const confirmedPct = Math.round((stats.confirmed / total) * 100);
    const checkedInPct = Math.round((stats.checkedIn / total) * 100);
    const cancelledPct = Math.round((stats.cancelled / total) * 100);

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
            {/* 1. Tổng đơn */}
            <div
                onClick={() => handleFilterClick('all')}
                className={`rounded-xl p-3 border transition-all duration-150 cursor-pointer flex flex-col justify-between active:scale-98 ${
                    statusFilter === 'all'
                        ? 'bg-blue-50/70 border-blue-400 shadow-xs ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200/90 hover:border-blue-300'
                }`}
            >
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                            Tổng đơn
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5 tabular-nums">
                            <span className="text-xl font-black text-slate-900">{stats.total}</span>
                            <span className="text-[11px] text-slate-500 font-medium">đơn</span>
                        </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shrink-0">
                        <CalendarCheck className="w-4 h-4" />
                    </div>
                </div>
                <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full" style={{ width: '100%' }}></div>
                </div>
            </div>

            {/* 2. Chờ duyệt */}
            <div
                onClick={() => handleFilterClick('pending')}
                className={`rounded-xl p-3 border transition-all duration-150 cursor-pointer flex flex-col justify-between active:scale-98 ${
                    statusFilter === 'pending'
                        ? 'bg-amber-50/70 border-amber-400 shadow-xs ring-2 ring-amber-500/20'
                        : 'bg-white border-slate-200/90 hover:border-amber-300'
                }`}
            >
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                                Chờ duyệt
                            </span>
                            {stats.pending > 0 && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                            )}
                        </div>
                        <div className="flex items-baseline gap-1 mt-0.5 tabular-nums">
                            <span className="text-xl font-black text-amber-800">{stats.pending}</span>
                            <span className="text-[10.5px] text-amber-600 font-semibold">({pendingPct}%)</span>
                        </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4" />
                    </div>
                </div>
                <div className="w-full bg-amber-100/70 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${pendingPct}%` }}></div>
                </div>
            </div>

            {/* 3. Đã xác nhận */}
            <div
                onClick={() => handleFilterClick('confirmed')}
                className={`rounded-xl p-3 border transition-all duration-150 cursor-pointer flex flex-col justify-between active:scale-98 ${
                    statusFilter === 'confirmed'
                        ? 'bg-indigo-50/70 border-indigo-400 shadow-xs ring-2 ring-indigo-500/20'
                        : 'bg-white border-slate-200/90 hover:border-indigo-300'
                }`}
            >
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                            Đã xác nhận
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5 tabular-nums">
                            <span className="text-xl font-black text-indigo-800">{stats.confirmed}</span>
                            <span className="text-[10.5px] text-indigo-600 font-semibold">({confirmedPct}%)</span>
                        </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200/60 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                </div>
                <div className="w-full bg-indigo-100/70 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${confirmedPct}%` }}></div>
                </div>
            </div>

            {/* 4. Đang lưu trú */}
            <div
                onClick={() => handleFilterClick('checked_in')}
                className={`rounded-xl p-3 border transition-all duration-150 cursor-pointer flex flex-col justify-between active:scale-98 ${
                    statusFilter === 'checked_in'
                        ? 'bg-emerald-50/70 border-emerald-400 shadow-xs ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200/90 hover:border-emerald-300'
                }`}
            >
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                            Đang ở
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5 tabular-nums">
                            <span className="text-xl font-black text-emerald-800">{stats.checkedIn}</span>
                            <span className="text-[10.5px] text-emerald-600 font-semibold">({checkedInPct}%)</span>
                        </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shrink-0">
                        <BedDouble className="w-4 h-4" />
                    </div>
                </div>
                <div className="w-full bg-emerald-100/70 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${checkedInPct}%` }}></div>
                </div>
            </div>

            {/* 5. Đã hủy */}
            <div
                onClick={() => handleFilterClick('cancelled')}
                className={`rounded-xl p-3 border transition-all duration-150 cursor-pointer flex flex-col justify-between active:scale-98 ${
                    statusFilter === 'cancelled'
                        ? 'bg-rose-50/70 border-rose-400 shadow-xs ring-2 ring-rose-500/20'
                        : 'bg-white border-slate-200/90 hover:border-rose-300'
                }`}
            >
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                            Đã hủy
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5 tabular-nums">
                            <span className="text-xl font-black text-rose-800">{stats.cancelled}</span>
                            <span className="text-[10.5px] text-rose-600 font-semibold">({cancelledPct}%)</span>
                        </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center shrink-0">
                        <XCircle className="w-4 h-4" />
                    </div>
                </div>
                <div className="w-full bg-rose-100/70 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${cancelledPct}%` }}></div>
                </div>
            </div>

            {/* 6. Tổng giá trị đơn */}
            <div
                className="rounded-xl p-3 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-white border border-emerald-200/90 shadow-2xs flex flex-col justify-between min-w-0"
                title={`Tổng doanh thu: ${(stats.totalRevenue || 0).toLocaleString('vi-VN')} VND từ ${stats.validCount || 0} đơn hợp lệ`}
            >
                <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 truncate">
                        Tổng giá trị ({stats.validCount || 0})
                    </span>
                    <WalletCards className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                </div>
                <div className="flex items-baseline gap-0.5 mt-1 min-w-0 tabular-nums">
                    <span className="text-[15px] font-black text-emerald-900 tracking-tight truncate">
                        {(stats.totalRevenue || 0).toLocaleString('vi-VN')}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 shrink-0">₫</span>
                </div>
                <div className="w-full bg-emerald-100/70 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '100%' }}></div>
                </div>
            </div>
        </div>
    );
}

