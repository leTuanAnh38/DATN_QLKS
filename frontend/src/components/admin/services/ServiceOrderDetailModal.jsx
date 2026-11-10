import React from 'react';
import {
    BellRing,
    X,
    Clock,
    MessageSquare,
    Printer,
    ArrowRight,
    CheckCircle2,
    ChefHat,
    XCircle,
    RotateCcw
} from 'lucide-react';
import { formatTimeAgo, formatCurrency } from '../../../utils/formatters';

const STATUS_META = {
    pending: { label: 'Chờ xử lý', pill: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock },
    in_progress: { label: 'Đang chuẩn bị', pill: 'bg-blue-100 text-blue-800 border-blue-300', icon: ChefHat },
    delivering: { label: 'Đang giao món', pill: 'bg-purple-100 text-purple-800 border-purple-300', icon: BellRing },
    completed: { label: 'Hoàn thành', pill: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle2 },
    cancelled: { label: 'Đã hủy', pill: 'bg-rose-100 text-rose-800 border-rose-300', icon: XCircle }
};

export default function ServiceOrderDetailModal({
    item,
    onClose,
    onUpdateStatus,
    onPrintSlip,
    getSlaStatus,
}) {
    if (!item) return null;

    const StatusIcon = STATUS_META[item.status]?.icon || Clock;
    const sla = getSlaStatus ? getSlaStatus(item) : null;

    return (
        <div
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                            <BellRing className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-900 text-base">
                                    Yêu Cầu Phục Vụ #{item.id}
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
                                    Phòng {item.room_number || 'Chờ xếp'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Đơn đặt #{item.booking_code} • Khách: {item.guest_name || 'Khách lưu trú'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-4 text-xs">
                    {/* SLA Overdue Banner if applicable */}
                    {sla && (
                        <div className={`p-3 rounded-2xl border flex items-center gap-2.5 ${sla.pill}`}>
                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                            <div>
                                <strong className="font-bold">Cảnh báo SLA:</strong> {sla.label} — Yêu cầu đang vượt thời gian tiêu chuẩn phục vụ phòng.
                            </div>
                        </div>
                    )}

                    {/* Service Item Summary Card */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                    {item.category_name || 'Dịch vụ'}
                                </span>
                                <h4 className="font-bold text-slate-900 text-sm mt-0.5">
                                    {item.service_name}
                                </h4>
                            </div>
                            <span
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border inline-flex items-center gap-1.5 ${
                                    STATUS_META[item.status]?.pill || 'bg-slate-100 text-slate-600'
                                }`}
                            >
                                <StatusIcon className="w-3.5 h-3.5" />
                                <span>{STATUS_META[item.status]?.label || item.status}</span>
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200/60 text-center">
                            <div className="bg-white p-2 rounded-xl border border-slate-100">
                                <span className="text-[10px] text-slate-400 block">Số lượng</span>
                                <strong className="text-xs text-slate-800 font-bold">x{item.quantity || 1}</strong>
                            </div>
                            <div className="bg-white p-2 rounded-xl border border-slate-100">
                                <span className="text-[10px] text-slate-400 block">Đơn giá</span>
                                <strong className="text-xs text-slate-800 font-bold">
                                    {formatCurrency(item.unit_price || 0)}
                                </strong>
                            </div>
                            <div className="bg-white p-2 rounded-xl border border-slate-100">
                                <span className="text-[10px] text-slate-400 block">Thành tiền</span>
                                <strong className="text-xs text-rose-600 font-bold">
                                    {formatCurrency(item.total_price || 0)}
                                </strong>
                            </div>
                        </div>
                    </div>

                    {/* Payment & Room Status */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Trạng thái thanh toán</span>
                            <div className="mt-1 flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${item.is_paid ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                <strong className={`text-xs ${item.is_paid ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {item.is_paid ? 'Đã thanh toán' : 'Chưa thu (Tính vào phòng)'}
                                </strong>
                            </div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Thời gian gửi yêu cầu</span>
                            <strong className="text-xs text-slate-800 mt-1 block">
                                {formatTimeAgo(item.created_at)}
                            </strong>
                        </div>
                    </div>

                    {/* Scheduled Delivery Banner */}
                    {item.is_scheduled && item.request_time && (
                        <div className="p-3 bg-blue-50/80 rounded-2xl border border-blue-200 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                    <Clock className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider block">
                                        Lịch hẹn phục vụ khách
                                    </span>
                                    <strong className="text-xs font-black text-blue-950">
                                        {new Date(item.request_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • {new Date(item.request_time).toLocaleDateString('vi-VN')}
                                    </strong>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-lg border border-blue-200">
                                Hẹn giờ giao
                            </span>
                        </div>
                    )}

                    {/* Guest Special Request Note */}
                    <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/70">
                        <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px] mb-1">
                            <MessageSquare className="w-3.5 h-3.5 text-amber-700" />
                            <span>Ghi chú của khách hàng</span>
                        </div>
                        <p className="text-xs text-amber-900 italic">
                            {item.note ? `"${item.note}"` : 'Không có ghi chú đặc biệt.'}
                        </p>
                    </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                    <button
                        type="button"
                        onClick={() => onPrintSlip && onPrintSlip(item)}
                        className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="In phiếu phục vụ phòng cho bộ phận bếp / chạy món"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        <span>In Phiếu Order</span>
                    </button>

                    <div className="flex items-center gap-2">
                        {item.status === 'pending' && (
                            <button
                                type="button"
                                onClick={() => onUpdateStatus && onUpdateStatus(item.id, 'in_progress')}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                            >
                                <span>Bắt đầu làm</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {item.status === 'in_progress' && (
                            <button
                                type="button"
                                onClick={() => onUpdateStatus && onUpdateStatus(item.id, 'delivering')}
                                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                            >
                                <BellRing className="w-3.5 h-3.5" />
                                <span>Giao phòng</span>
                            </button>
                        )}
                        {item.status === 'delivering' && (
                            <button
                                type="button"
                                onClick={() => onUpdateStatus && onUpdateStatus(item.id, 'completed')}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Hoàn tất</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

