import React from 'react';
import { CalendarPlus, X, AlertCircle } from 'lucide-react';

/**
 * Modal gia hạn thời gian lưu trú phòng cho khách hàng
 */
export default function ExtendStayModal({
    booking,
    onClose,
    onConfirm,
    isSubmittingExtend = false,
    newCheckOutDate = '',
    setNewCheckOutDate,
    extendMinDate = '',
    extendConflictError = null,
    setExtendConflictError,
    extendCalculation = { isValid: false, extraNights: 0, nightlyRate: 0, extraAmount: 0 },
    settings = {},
    formatDateDisplay = (d) => d
}) {
    if (!booking) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-7 shadow-2xl border border-slate-200 space-y-4 sm:space-y-5 text-left animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                {/* Header Modal */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 sm:pb-4 gap-3">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0 shadow-xs">
                            <CalendarPlus className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-sm sm:text-lg text-slate-900 truncate">
                                Gia Hạn Lưu Trú
                            </h3>
                            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                                Đơn #{booking.booking_code} • {booking.room_name || 'Phòng nghỉ'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition flex items-center justify-center font-bold text-sm cursor-pointer shrink-0"
                        title="Đóng"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Thông tin phòng hiện tại */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                        <span>Hạng phòng:</span>
                        <strong className="text-slate-900 font-semibold">{booking.room_name}</strong>
                    </div>
                    {booking.room_number && (
                        <div className="flex items-center justify-between">
                            <span>Phòng đang ở:</span>
                            <strong className="text-amber-700 font-bold font-mono">Phòng {booking.room_number}</strong>
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <span>Ngày nhận phòng (Check-in):</span>
                        <strong className="text-slate-800">{formatDateDisplay(booking.check_in_date)}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                        <span>Ngày trả phòng hiện tại:</span>
                        <strong className="text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold">
                            {formatDateDisplay(booking.check_out_date)} (trước {settings?.check_out_time || '12:00'})
                        </strong>
                    </div>
                </div>

                {/* Chọn ngày trả phòng mới */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-900 block">
                        Chọn ngày trả phòng (Check-out) mới: <span className="text-rose-500">*</span>
                    </label>
                    <input
                        type="date"
                        min={extendMinDate}
                        value={newCheckOutDate}
                        onChange={(e) => {
                            setNewCheckOutDate(e.target.value);
                            if (setExtendConflictError) setExtendConflictError(null);
                        }}
                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition cursor-pointer shadow-xs"
                    />
                    <p className="text-[11px] text-slate-400">
                        * Chỉ được chọn ngày sau ngày trả phòng hiện tại ({formatDateDisplay(booking.check_out_date)}).
                    </p>
                </div>

                {/* Xem trước chi phí phát sinh */}
                {extendCalculation.isValid && (
                    <div className="p-4 bg-gradient-to-br from-amber-50/70 via-orange-50/30 to-slate-50 rounded-2xl border border-amber-200/80 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600">Số đêm lưu trú thêm:</span>
                            <strong className="text-amber-700 font-bold">+{extendCalculation.extraNights} đêm</strong>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600">Đơn giá phòng tham khảo:</span>
                            <span className="text-slate-800 font-mono">{extendCalculation.nightlyRate.toLocaleString('vi-VN')} đ/đêm</span>
                        </div>
                        <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between">
                            <span className="font-bold text-slate-900">Số tiền dự kiến tính thêm:</span>
                            <strong className="text-amber-600 font-mono text-base font-black">
                                +{extendCalculation.extraAmount.toLocaleString('vi-VN')} đ
                            </strong>
                        </div>
                    </div>
                )}

                {/* Cảnh báo lỗi kẹt phòng nếu có */}
                {extendConflictError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                            <strong className="font-bold block">Không thể gia hạn:</strong>
                            <span className="text-[11px] leading-relaxed mt-0.5 block">{extendConflictError}</span>
                        </div>
                    </div>
                )}

                {/* Nút thao tác */}
                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmittingExtend}
                        className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-bold text-xs transition cursor-pointer"
                    >
                        Đóng
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isSubmittingExtend || !extendCalculation.isValid}
                        className="px-5 py-2.5 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-900/20 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                        {isSubmittingExtend ? (
                            <>
                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                <span>Đang kiểm tra & gia hạn...</span>
                            </>
                        ) : (
                            <>
                                <CalendarPlus className="w-3.5 h-3.5" />
                                <span>Xác nhận gia hạn</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

