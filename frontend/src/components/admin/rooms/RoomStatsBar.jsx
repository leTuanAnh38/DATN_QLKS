import React from 'react';
import {
    Building2,
    DoorOpen,
    UserCheck,
    Sparkles,
    Wrench
} from 'lucide-react';

/**
 * KPI STATS CARDS: Bảng chỉ số trạng thái buồng phòng toàn khách sạn PMS
 */
export default function RoomStatsBar({
    stats = {
        total: 0,
        available: 0,
        occupied: 0,
        cleaning: 0,
        maintenance: 0,
        occupancy_rate: 0
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

    const occupancyRate = stats.occupancy_rate || 0;
    const availableRate = Math.round((stats.available / (stats.total || 1)) * 100);
    const occupiedRate = Math.round((stats.occupied / (stats.total || 1)) * 100);
    const cleaningRate = Math.round((stats.cleaning / (stats.total || 1)) * 100);
    const maintenanceRate = Math.round((stats.maintenance / (stats.total || 1)) * 100);

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* 1. Tổng số phòng */}
            <div
                onClick={() => handleFilterClick('all')}
                className={`rounded-2xl p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between active:scale-98 ${
                    statusFilter === 'all'
                        ? 'bg-blue-50/70 border-blue-400 shadow-sm ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200/90 hover:border-blue-300 hover:shadow-xs hover:-translate-y-0.5'
                }`}
            >
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                            Tổng số phòng
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-2xl font-black text-slate-900">{stats.total}</span>
                            <span className="text-xs text-slate-500 font-medium">phòng</span>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5" />
                    </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Công suất:</span>
                        <span className="font-bold text-blue-600">{occupancyRate}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                            className="bg-blue-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* 2. Phòng Trống (Available) */}
            <div
                onClick={() => handleFilterClick('available')}
                className={`rounded-2xl p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between active:scale-98 ${
                    statusFilter === 'available'
                        ? 'bg-emerald-50/70 border-emerald-400 shadow-sm ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200/90 hover:border-emerald-300 hover:shadow-xs hover:-translate-y-0.5'
                }`}
            >
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                            Trống (Sẵn sàng)
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-2xl font-black text-emerald-800">{stats.available}</span>
                            <span className="text-xs text-emerald-600 font-medium">phòng</span>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shrink-0">
                        <DoorOpen className="w-5 h-5" />
                    </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-emerald-100/60">
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-emerald-700 font-medium">Tỷ lệ trống:</span>
                        <span className="font-bold text-emerald-700">{availableRate}%</span>
                    </div>
                    <div className="w-full bg-emerald-100/70 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${availableRate}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* 3. Có khách (Occupied) */}
            <div
                onClick={() => handleFilterClick('occupied')}
                className={`rounded-2xl p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between active:scale-98 ${
                    statusFilter === 'occupied'
                        ? 'bg-rose-50/70 border-rose-400 shadow-sm ring-2 ring-rose-500/20'
                        : 'bg-white border-slate-200/90 hover:border-rose-300 hover:shadow-xs hover:-translate-y-0.5'
                }`}
            >
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                            Đang có khách
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-2xl font-black text-rose-800">{stats.occupied}</span>
                            <span className="text-xs text-rose-600 font-medium">phòng</span>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center shrink-0">
                        <UserCheck className="w-5 h-5" />
                    </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-rose-100/60">
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-rose-700 font-medium">Đang ở:</span>
                        <span className="font-bold text-rose-700">{occupiedRate}%</span>
                    </div>
                    <div className="w-full bg-rose-100/70 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                            className="bg-rose-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${occupiedRate}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* 4. Đang dọn dẹp (Cleaning) */}
            <div
                onClick={() => handleFilterClick('cleaning')}
                className={`rounded-2xl p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between active:scale-98 ${
                    statusFilter === 'cleaning'
                        ? 'bg-amber-50/70 border-amber-400 shadow-sm ring-2 ring-amber-500/20'
                        : 'bg-white border-slate-200/90 hover:border-amber-300 hover:shadow-xs hover:-translate-y-0.5'
                }`}
            >
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                            Đang dọn dẹp
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-2xl font-black text-amber-800">{stats.cleaning}</span>
                            <span className="text-xs text-amber-600 font-medium">phòng</span>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5" />
                    </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-amber-100/60">
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-amber-700 font-medium">Chờ dọn:</span>
                        <span className="font-bold text-amber-700">{cleaningRate}%</span>
                    </div>
                    <div className="w-full bg-amber-100/70 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                            className="bg-amber-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${cleaningRate}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* 5. Đang bảo trì (Maintenance) */}
            <div
                onClick={() => handleFilterClick('maintenance')}
                className={`rounded-2xl p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between active:scale-98 col-span-2 sm:col-span-1 ${
                    statusFilter === 'maintenance'
                        ? 'bg-slate-100 border-slate-400 shadow-sm ring-2 ring-slate-500/20'
                        : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs hover:-translate-y-0.5'
                }`}
            >
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                            Đang bảo trì
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-2xl font-black text-slate-800">{stats.maintenance}</span>
                            <span className="text-xs text-slate-500 font-medium">phòng</span>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 border border-slate-300/80 flex items-center justify-center shrink-0">
                        <Wrench className="w-5 h-5" />
                    </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Sửa chữa:</span>
                        <span className="font-bold text-slate-700">{maintenanceRate}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                            className="bg-slate-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${maintenanceRate}%` }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

