import React from 'react';
import {
    Calendar,
    LogIn,
    LogOut,
    Bell,
    ChevronDown,
    Search,
    X
} from 'lucide-react';

/**
 * THANH FILTER DROPDOWN & TÌM KIẾM NHANH CHO QUẢN LÝ ĐẶT PHÒNG
 */
export default function BookingFilterToolbar({
    quickFilterMode = 'all',
    onQuickFilterChange,
    statusFilter = 'all',
    onStatusFilterChange,
    stats = {},
    searchKeyword = '',
    onSearchKeywordChange,
    isSendingReminders = false,
    onTriggerDailyReminders
}) {
    return (
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-slate-50/60">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
                {/* Thanh Lọc Nhanh Phân Hệ: Tất cả / Check-in hôm nay / Check-out hôm nay */}
                <div className="flex items-center p-1 bg-slate-200/70 rounded-xl max-w-full overflow-x-auto scrollbar-none shrink-0 gap-0.5">
                    <button
                        type="button"
                        onClick={() => onQuickFilterChange && onQuickFilterChange('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                            quickFilterMode === 'all'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>Tất cả</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onQuickFilterChange && onQuickFilterChange('check-in-today')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                            quickFilterMode === 'check-in-today'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-emerald-700 hover:text-emerald-800'
                        }`}
                    >
                        <LogIn className="w-3.5 h-3.5 shrink-0" />
                        <span>Check-in hôm nay</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onQuickFilterChange && onQuickFilterChange('check-out-today')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                            quickFilterMode === 'check-out-today'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'text-purple-700 hover:text-purple-800'
                        }`}
                    >
                        <LogOut className="w-3.5 h-3.5 shrink-0" />
                        <span>Check-out hôm nay</span>
                    </button>
                </div>

                {/* Nút gửi thông báo Check-in / Check-out hôm nay */}
                {onTriggerDailyReminders && (
                    <button
                        type="button"
                        onClick={onTriggerDailyReminders}
                        disabled={isSendingReminders}
                        title="Quét và gửi thông báo nhắc nhở đến Khách hàng và Nhân viên/Quản lý về lịch Check-in và Check-out hôm nay"
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs cursor-pointer whitespace-nowrap shrink-0 ${
                            isSendingReminders
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 hover:border-amber-400'
                        }`}
                    >
                        <Bell className={`w-3.5 h-3.5 shrink-0 ${isSendingReminders ? 'animate-spin' : ''}`} />
                        <span>{isSendingReminders ? 'Đang gửi...' : 'Gửi thông báo Check-in/out'}</span>
                    </button>
                )}

                {/* 1. Thanh Filter (Dropdown) theo Trạng thái */}
                <div className="flex items-center gap-1.5">
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => onStatusFilterChange && onStatusFilterChange(e.target.value)}
                            className="pl-3 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 cursor-pointer hover:border-slate-300 transition appearance-none"
                        >
                            <option value="all">Tất cả trạng thái ({stats.total || 0})</option>
                            <option value="pending">⏳ Chờ duyệt ({stats.pending || 0})</option>
                            <option value="confirmed">Đã xác nhận ({stats.confirmed || 0})</option>
                            <option value="checked_in">Đang lưu trú ({stats.checkedIn || 0})</option>
                            <option value="checked_out">Đã trả phòng ({stats.checkedOut || 0})</option>
                            <option value="no_show">Khách không đến ({stats.noShow || 0})</option>
                            <option value="cancelled">Đã hủy ({stats.cancelled || 0})</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                </div>

                {statusFilter !== 'all' && (
                    <button
                        type="button"
                        onClick={() => onStatusFilterChange && onStatusFilterChange('all')}
                        className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold rounded-lg cursor-pointer shrink-0 transition"
                    >
                        Đặt lại
                    </button>
                )}
            </div>

            {/* 2. Ô tìm kiếm nhanh */}
            <div className="relative w-full xl:w-72 shrink-0">
                <input
                    type="text"
                    placeholder="Tìm mã, khách, CCCD, SĐT, phòng..."
                    value={searchKeyword}
                    onChange={(e) => onSearchKeywordChange && onSearchKeywordChange(e.target.value)}
                    className="w-full pl-8 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition shadow-2xs hover:border-slate-300"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                {searchKeyword && (
                    <button
                        type="button"
                        onClick={() => onSearchKeywordChange && onSearchKeywordChange('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}

