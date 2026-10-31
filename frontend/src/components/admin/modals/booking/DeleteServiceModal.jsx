import React from 'react';
import { Trash2, AlertTriangle, X, Receipt, User, Tag } from 'lucide-react';

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
            <div className="relative bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-7 shadow-2xl max-w-md w-full border border-slate-200/90 space-y-5 animate-in zoom-in-95 duration-200">
                {/* Nút đóng góc phải */}
                <button
                    type="button"
                    disabled={serviceToDelete.isDeleting}
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-3.5 pr-8">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
                        <Trash2 className="w-6 h-6 text-rose-600" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 tracking-tight">
                            Xác Nhận Xóa Dịch Vụ
                        </h3>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">
                            Xóa dịch vụ / phụ phí khỏi đơn đặt phòng
                        </p>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                        <span className="font-medium flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-slate-400" />
                            Tên dịch vụ / món:
                        </span>
                        <span className="font-bold text-rose-700">{serviceToDelete.itemName}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                        <span className="font-medium flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5 text-slate-400" />
                            Mã đặt phòng:
                        </span>
                        <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                            #{booking?.booking_code}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                        <span className="font-medium flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            Khách hàng:
                        </span>
                        <span className="font-bold text-slate-900">{booking?.guest_name}</span>
                    </div>
                </div>

                <div className="flex items-start gap-2.5 text-xs text-rose-800 bg-rose-50/80 p-3.5 rounded-xl border border-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                        Dịch vụ này sẽ được xóa hoàn toàn khỏi danh sách phụ phí của đơn đặt phòng và tự động trừ khỏi tổng tiền thanh toán của khách.
                    </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        disabled={serviceToDelete.isDeleting}
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
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
                                <Trash2 className="w-4 h-4" />
                                <span>Xác Nhận Xóa</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

