import React from 'react';
import {
    Hotel,
    X,
    ArrowRight,
    ClipboardList,
    RefreshCw,
    Receipt
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '../../../utils/formatters';

export default function OccupiedRoomDetailModal({
    room,
    onClose,
    onGoToCustomer,
    onGoToBookings,
    canManageBookings = false,
    onOpenChangeRoom,
    onOpenCheckOut
}) {
    if (!room || !room.current_booking) return null;
    const bk = room.current_booking;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div
                className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs">
                            <Hotel className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-lg text-slate-900 tracking-tight">
                                    Phòng {room.room_number}
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                    Đang lưu trú
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Tầng {room.floor} • {room.category_name} ({formatCurrency(room.category_base_price)}/đêm)
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

                {/* Body */}
                <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
                    {/* Card 1: Khách hàng */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                            <span className="font-bold uppercase text-[10px] text-slate-400 tracking-wider">
                                Hồ sơ khách hàng
                            </span>
                            {bk.guest_id && onGoToCustomer && (
                                <button
                                    type="button"
                                    onClick={() => onGoToCustomer(bk.guest_id)}
                                    className="text-blue-600 hover:text-blue-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                >
                                    <span className="flex items-center gap-1">Xem hồ sơ CRM <ArrowRight className="w-3.5 h-3.5" /></span>
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-slate-800">
                            <div>
                                <span className="text-[10px] text-slate-400 block">Họ và tên:</span>
                                <span className="font-bold text-sm text-slate-900">
                                    {bk.guest_name}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 block">Số điện thoại:</span>
                                <span className="font-bold text-slate-900">
                                    {bk.guest_phone || '—'}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 block">Email:</span>
                                <span className="font-medium text-slate-700 truncate block">
                                    {bk.guest_email || '—'}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 block">CCCD / Hộ chiếu:</span>
                                <span className="font-mono font-bold text-slate-900">
                                    {bk.identity_card || 'Chưa cập nhật'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Thông tin Đặt phòng */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                            <span className="font-bold uppercase text-[10px] text-slate-400 tracking-wider">
                                Thông tin lưu trú & Booking
                            </span>
                            <span className="font-mono font-bold text-xs bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-300">
                                #{bk.booking_code}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-slate-800">
                            <div>
                                <span className="text-[10px] text-slate-400 block">Ngày nhận (Check-in):</span>
                                <span className="font-bold text-slate-900">
                                    {formatDate(bk.check_in_date)}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 block">Ngày trả (Check-out):</span>
                                <span className="font-bold text-rose-700">
                                    {formatDate(bk.check_out_date)}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 block">Check-in thực tế:</span>
                                <span className="font-medium text-slate-700">
                                    {formatDateTime(bk.actual_check_in)}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 block">Tổng tiền phòng:</span>
                                <span className="font-black text-sm text-emerald-700">
                                    {formatCurrency(bk.total_amount)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onGoToBookings}
                        className="px-3 py-2 text-slate-600 hover:text-blue-700 font-bold text-xs rounded-xl hover:bg-slate-200/60 transition flex items-center gap-1.5 cursor-pointer"
                        title="Đi tới trang Quản lý Đặt phòng"
                    >
                        <ClipboardList className="w-3.5 h-3.5" />
                        <span>Quản lý Đặt phòng</span>
                    </button>
                    {canManageBookings && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    if (onOpenChangeRoom) {
                                        onOpenChangeRoom(room, bk);
                                    }
                                }}
                                className="px-3.5 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 text-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                                title="Chuyển khách sang phòng trống mới"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Đổi phòng</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (onOpenCheckOut) {
                                        onOpenCheckOut(bk);
                                    }
                                }}
                                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold rounded-xl shadow-md shadow-rose-600/20 text-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                                title="Thực hiện thủ tục Check-out trả phòng"
                            >
                                <Receipt className="w-3.5 h-3.5" />
                                <span>Check-out</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

