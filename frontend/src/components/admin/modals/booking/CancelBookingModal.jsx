import React from 'react';
import { X, AlertTriangle, User, Phone, BedDouble, Calendar, Ban } from 'lucide-react';

export default function CancelBookingModal({
    isOpen,
    booking,
    isSubmitting = false,
    onClose,
    onConfirm,
    formatDateDisplay
}) {
    if (!isOpen || !booking) return null;

    const formatDisplay = (d) => (formatDateDisplay ? formatDateDisplay(d) : (d || '—'));

    return (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200/90 max-w-md w-full p-6 shadow-2xl text-left animate-in zoom-in-95 duration-200 relative overflow-hidden">
                {/* Nút đóng góc phải */}
                <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer disabled:opacity-50"
                    title="Đóng modal"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Icon & Tiêu đề trung tâm */}
                <div className="flex flex-col items-center text-center mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-2.5 shadow-2xs">
                        <AlertTriangle className="w-6 h-6 text-rose-600" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                        Xác Nhận Hủy Đơn Đặt Phòng
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Mã đơn: <strong className="font-mono text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 font-bold">#{booking.booking_code}</strong>
                    </p>
                </div>

                {/* Cảnh báo hành động */}
                <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl mb-4 text-xs text-rose-900 leading-relaxed text-center">
                    Bạn có chắc chắn muốn hủy đơn đặt phòng này? <br />
                    <span className="text-rose-700 font-semibold">Hành động này sẽ giải phóng phòng và chuyển trạng thái sang Đã hủy.</span>
                </div>

                {/* Thẻ tóm tắt thông tin đơn đặt phòng */}
                <div className="bg-slate-50/80 rounded-xl p-3.5 text-xs space-y-2 mb-5 border border-slate-200/80">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>Khách hàng:</span>
                        </span>
                        <strong className="text-slate-900 truncate max-w-[200px]">{booking.guest_name}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>Số điện thoại:</span>
                        </span>
                        <span className="text-slate-800 font-semibold">{booking.guest_phone || 'Không có'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 flex items-center gap-1.5">
                            <BedDouble className="w-3.5 h-3.5 text-slate-400" />
                            <span>Phòng lưu trú:</span>
                        </span>
                        <span className="text-slate-900 font-bold">
                            {booking.room_name || booking.category?.name || 'Chưa gán phòng'} {booking.room_number ? `(P.${booking.room_number})` : ''}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>Thời gian lưu trú:</span>
                        </span>
                        <span className="text-slate-800 font-medium font-mono text-[11px]">
                            {formatDisplay(booking.check_in_date)} → {formatDisplay(booking.check_out_date)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200/80">
                        <span className="text-slate-500 font-medium">Tổng tiền đơn:</span>
                        <strong className="text-rose-600 font-bold text-sm font-mono">
                            {Number(booking.grand_total_amount || booking.total_amount || 0).toLocaleString('vi-VN')} VND
                        </strong>
                    </div>
                </div>

                {/* Nút hành động */}
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={onClose}
                        className="w-1/2 py-2.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition text-center cursor-pointer disabled:opacity-50"
                    >
                        Không, giữ lại
                    </button>

                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={onConfirm}
                        className="w-1/2 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Đang hủy...</span>
                            </>
                        ) : (
                            <>
                                <Ban className="w-4 h-4" />
                                <span>Xác nhận Hủy đơn</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
