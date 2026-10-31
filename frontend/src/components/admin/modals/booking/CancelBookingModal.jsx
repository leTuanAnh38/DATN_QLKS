import React from 'react';

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
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-100 max-w-md w-full p-6 sm:p-7 shadow-2xl text-left animate-in zoom-in-95 duration-200 relative overflow-hidden">
                {/* Nút đóng góc phải */}
                <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition cursor-pointer"
                >
                    ✕
                </button>

                {/* Icon & Tiêu đề trung tâm */}
                <div className="flex flex-col items-center text-center mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center text-2xl mb-3 shadow-xs font-bold">
                        ⚠️
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                        Xác nhận Hủy Đơn Đặt Phòng
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Mã đơn: <strong className="font-mono text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200 font-bold">#{booking.booking_code}</strong>
                    </p>
                </div>

                {/* Cảnh báo hành động */}
                <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-2xl mb-4 text-xs text-rose-900 leading-relaxed text-center">
                    Bạn có chắc chắn muốn hủy đơn đặt phòng này? <br />
                    <span className="text-rose-700 font-semibold">Hành động này sẽ giải phóng phòng và chuyển trạng thái sang Đã hủy.</span>
                </div>

                {/* Thẻ tóm tắt thông tin đơn đặt phòng */}
                <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-2 mb-5 border border-slate-200/80">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Khách hàng:</span>
                        <strong className="text-slate-900">{booking.guest_name}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Số điện thoại:</span>
                        <span className="text-slate-800 font-semibold">{booking.guest_phone || 'Không có'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Phòng lưu trú:</span>
                        <span className="text-slate-900 font-bold">
                            {booking.room_name || booking.category?.name || 'Chưa gán phòng'} {booking.room_number ? `(Phòng ${booking.room_number})` : ''}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Thời gian lưu trú:</span>
                        <span className="text-slate-800 font-medium">
                            {formatDisplay(booking.check_in_date)} → {formatDisplay(booking.check_out_date)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                        <span className="text-slate-500 font-medium">Tổng tiền đơn:</span>
                        <strong className="text-rose-600 font-bold text-sm">
                            {Number(booking.grand_total_amount || booking.total_amount || 0).toLocaleString('vi-VN')} VND
                        </strong>
                    </div>
                </div>

                {/* Nút hành động */}
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={onClose}
                        className="w-1/2 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition text-center cursor-pointer"
                    >
                        Không, giữ lại đơn
                    </button>

                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={onConfirm}
                        className="w-1/2 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Đang hủy...</span>
                            </>
                        ) : (
                            <>
                                <span>✕</span>
                                <span>Xác nhận Hủy đơn</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
