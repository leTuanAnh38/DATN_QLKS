import React from 'react';

export default function DeleteServiceModal({
    isOpen,
    serviceToDelete,
    booking,
    onClose,
    onConfirm
}) {
    if (!isOpen || !serviceToDelete) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-2xl max-w-md w-full border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 text-xl font-bold">
                        🗑️
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-800 tracking-tight">
                            Xác Nhận Xóa Dịch Vụ
                        </h3>
                        <p className="text-xs font-semibold text-slate-400">
                            Xóa dịch vụ/phụ phí khỏi đơn đặt phòng
                        </p>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                        <span className="font-medium">Tên dịch vụ / món:</span>
                        <span className="font-bold text-rose-700">{serviceToDelete.itemName}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                        <span className="font-medium">Mã đặt phòng:</span>
                        <span className="font-mono font-bold text-slate-800">#{booking?.booking_code}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                        <span className="font-medium">Khách hàng:</span>
                        <span className="font-bold text-slate-800">{booking?.guest_name}</span>
                    </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                    ⚠️ Dịch vụ này sẽ được xóa hoàn toàn khỏi danh sách phụ phí của đơn đặt phòng và tự động trừ khỏi tổng tiền thanh toán của khách.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        disabled={serviceToDelete.isDeleting}
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                    >
                        Hủy Bỏ
                    </button>
                    <button
                        type="button"
                        disabled={serviceToDelete.isDeleting}
                        onClick={onConfirm}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 transition cursor-pointer flex items-center gap-1.5"
                    >
                        {serviceToDelete.isDeleting ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Đang xóa...</span>
                            </>
                        ) : (
                            <>
                                <span>🗑️</span>
                                <span>Xác Nhận Xóa</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
