import React from 'react';
import { BellRing, CheckCircle2, BedDouble, Clock } from 'lucide-react';

export default function ServiceSuccessModal({ orderInfo, onClose }) {
    if (!orderInfo) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-5 animate-scale-up">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-200/60 shadow-lg shadow-amber-500/10">
                    <BellRing className="w-8 h-8 text-amber-600 animate-pulse" />
                </div>
                <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold mb-2 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ĐÃ TIẾP NHẬN YÊU CẦU
                    </span>
                    <h3 className="text-xl font-bold text-slate-900">
                        Phục vụ phòng đang chuẩn bị!
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Yêu cầu của quý khách đã được chuyển tới bếp & bộ phận Concierge phục vụ.
                    </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-left space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400">Giao đến:</span>
                        <strong className="text-slate-900 font-bold text-sm flex items-center gap-1.5">
                            <BedDouble className="w-3.5 h-3.5 text-amber-600" />
                            Phòng {orderInfo.roomNumber}
                        </strong>
                    </div>
                    {orderInfo.itemsList && orderInfo.itemsList.length > 0 ? (
                        <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                            <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <span>Danh sách món ({orderInfo.itemsList.length}):</span>
                                <span>Số lượng</span>
                            </div>
                            <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                                {orderInfo.itemsList.map((it, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs">
                                        <span className="text-slate-700 font-medium truncate pr-2">
                                            • {it.name}
                                        </span>
                                        <span className="font-bold text-slate-900 shrink-0">
                                            x{it.quantity} ({(it.price * it.quantity).toLocaleString('vi-VN')} đ)
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Dịch vụ / Món gọi:</span>
                            <span className="font-semibold text-slate-800">
                                {orderInfo.serviceName} (x{orderInfo.quantity})
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                        <span className="text-slate-500">Tạm tính (vào hóa đơn phòng):</span>
                        <strong className="text-rose-600 font-bold text-sm">
                            {orderInfo.totalPrice.toLocaleString('vi-VN')} VND
                        </strong>
                    </div>
                </div>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/60">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Thời gian dự kiến phục vụ:</span>
                    <strong className="text-slate-800">15 – 30 phút</strong>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 active:scale-95 text-white rounded-xl text-xs font-bold transition shadow-md shadow-sky-900/20 cursor-pointer"
                >
                    Đã hiểu & Tiếp tục xem Menu
                </button>
            </div>
        </div>
    );
}

