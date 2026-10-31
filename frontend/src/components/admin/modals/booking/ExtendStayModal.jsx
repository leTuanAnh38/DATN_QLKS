import React from 'react';

export default function ExtendStayModal({
    isOpen,
    booking,
    newDate,
    calc = {},
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
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center text-2xl mb-3 shadow-xs font-bold">
                        🗓️
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                        Xác nhận Gia Hạn Lưu Trú
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Mã đơn: <strong className="font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 font-bold">#{booking.booking_code}</strong>
                    </p>
                </div>

                {/* Cảnh báo / Thông báo mô tả */}
                <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl mb-4 text-xs text-blue-900 leading-relaxed text-center">
                    Bạn có chắc chắn muốn gia hạn lưu trú cho khách hàng này? <br />
                    <span className="text-blue-700 font-semibold">Hệ thống sẽ cập nhật ngày trả phòng và tính thêm phụ phí tiền phòng.</span>
                </div>

                {/* Thẻ tóm tắt thông tin gia hạn */}
                <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-2.5 mb-5 border border-slate-200/80">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Khách hàng:</span>
                        <strong className="text-slate-900">{booking.guest_name}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Phòng lưu trú:</span>
                        <span className="text-slate-900 font-bold">
                            {booking.assigned_room_number || booking.room_number ? `Phòng ${booking.assigned_room_number || booking.room_number}` : ''}
                            {booking.room_category_name || booking.room_category?.name ? ` (${booking.room_category_name || booking.room_category?.name})` : ''}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Ngày Check-out hiện tại:</span>
                        <span className="text-slate-700 font-medium">
                            {formatDisplay(booking.check_out_date)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Ngày Check-out mới:</span>
                        <strong className="text-blue-600 font-bold">
                            {formatDisplay(newDate)} (+{calc.extraNights || 0} đêm)
                        </strong>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Tiền phòng phát sinh:</span>
                        <strong className="text-amber-600 font-bold font-mono">
                            +{(calc.extraAmount || 0).toLocaleString('vi-VN')} VND
                        </strong>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                        <span className="text-slate-500 font-medium">Tổng tiền phòng mới:</span>
                        <strong className="text-emerald-700 font-black text-sm font-mono">
                            {(Number(booking.total_amount || 0) + (calc.extraAmount || 0)).toLocaleString('vi-VN')} VND
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
                        Hủy bỏ
                    </button>

                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={onConfirm}
                        className="w-1/2 py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/25 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Đang gia hạn...</span>
                            </>
                        ) : (
                            <>
                                <span>✨</span>
                                <span>Đồng ý Gia hạn</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
