import React from 'react';
import { AlertCircle, Info, Trash2 } from 'lucide-react';

export default function ServiceCancelModal({
    order,
    onClose,
    onConfirm,
    isCancelling = false
}) {
    if (!order) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-2xl max-w-md w-full border border-slate-100 space-y-5 animate-scale-up">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200/80">
                        <AlertCircle className="w-6 h-6 text-rose-600" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-800 tracking-tight">
                            Hủy Yêu Cầu Dịch Vụ
                        </h3>
                        <p className="text-xs font-semibold text-slate-400">
                            Xác nhận hủy đơn đặt món / dịch vụ tận phòng
                        </p>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                        <span className="font-medium">Dịch vụ yêu cầu:</span>
                        <span className="font-bold text-slate-800">
                            {order.service_name || order.custom_service_name || 'Dịch vụ'}
                        </span>
                    </div>
                    {order.quantity && (
                        <div className="flex justify-between items-center text-slate-600">
                            <span className="font-medium">Số lượng:</span>
                            <span className="font-bold text-slate-800">x{order.quantity}</span>
                        </div>
                    )}
                    {order.booking_code && (
                        <div className="flex justify-between items-center text-slate-600">
                            <span className="font-medium">Mã phòng / đơn:</span>
                            <span className="font-mono font-bold text-amber-700">#{order.booking_code}</span>
                        </div>
                    )}
                </div>

                <div className="text-xs text-amber-950 leading-relaxed bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                        Quý khách có chắc chắn muốn hủy yêu cầu này? Sau khi hủy, yêu cầu sẽ không được xử lý và
                        không phát sinh bất kỳ khoản phí nào.
                    </span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        disabled={isCancelling}
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                    >
                        Giữ Lại
                    </button>
                    <button
                        type="button"
                        disabled={isCancelling}
                        onClick={onConfirm}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 transition cursor-pointer flex items-center gap-1.5"
                    >
                        {isCancelling ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Đang hủy...</span>
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xác Nhận Hủy</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

