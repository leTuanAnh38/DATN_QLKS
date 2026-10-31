import React, { useState } from 'react';
import {
    Clock,
    Banknote,
    AlertCircle,
    CheckCircle2,
    X,
    Sun,
    Sunset,
    Moon,
    Briefcase,
    Loader2
} from 'lucide-react';
import paymentService from '../../../../services/paymentService';

/**
 * Modal Mở Ca Làm Việc (Open Shift)
 * Dành cho Thu ngân / Lễ tân khách sạn
 */
export default function OpenShiftModal({ isOpen, onClose, onShiftOpened }) {
    // Tự động gợi ý loại ca theo giờ hiện tại
    const getSuggestedShiftType = () => {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 14) return 'MORNING';
        if (hour >= 14 && hour < 22) return 'AFTERNOON';
        return 'NIGHT';
    };

    const [shiftType, setShiftType] = useState(getSuggestedShiftType());
    const [openingCash, setOpeningCash] = useState('2000000'); // Mặc định 2.000.000đ tiền lẻ thối
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    // Danh mục loại ca
    const SHIFT_TYPES = [
        {
            key: 'MORNING',
            name: 'Ca Sáng',
            time: '06:00 - 14:00',
            icon: Sun,
            color: 'text-amber-500 bg-amber-50 border-amber-200'
        },
        {
            key: 'AFTERNOON',
            name: 'Ca Chiều',
            time: '14:00 - 22:00',
            icon: Sunset,
            color: 'text-orange-500 bg-orange-50 border-orange-200'
        },
        {
            key: 'NIGHT',
            name: 'Ca Đêm',
            time: '22:00 - 06:00',
            icon: Moon,
            color: 'text-indigo-500 bg-indigo-50 border-indigo-200'
        },
        {
            key: 'ADMIN',
            name: 'Ca Hành Chính',
            time: '08:00 - 17:00',
            icon: Briefcase,
            color: 'text-emerald-500 bg-emerald-50 border-emerald-200'
        }
    ];

    // Nút chọn nhanh tiền thối ban đầu
    const QUICK_AMOUNTS = [1000000, 2000000, 3000000, 5000000];

    // Format tiền tệ hiển thị
    const formatCurrency = (val) => {
        const num = Number(val) || 0;
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
    };

    const handleOpeningCashChange = (e) => {
        const raw = e.target.value.replace(/\D/g, '');
        setOpeningCash(raw);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        const cashNum = Number(openingCash);
        if (isNaN(cashNum) || cashNum < 0) {
            setError('Vui lòng nhập số tiền mặt đầu ca hợp lệ (tối thiểu 0đ).');
            return;
        }

        setLoading(true);
        try {
            const res = await paymentService.openShift({
                shift_type: shiftType,
                opening_cash: cashNum,
                notes: notes.trim()
            });

            if (res.success) {
                const newShift = res.shift || res.active_shift || res.data;
                if (onShiftOpened) {
                    onShiftOpened(newShift);
                }
                onClose();
            } else {
                setError(res.message || 'Không thể mở ca làm việc.');
            }
        } catch (err) {
            console.error('Lỗi khi mở ca:', err);
            const msg = err.response?.data?.message || err.response?.data?.detail || err.message || 'Không thể mở ca làm việc.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in">
            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
                {/* 1. Header (Fixed non-scrolling) */}
                <div className="flex items-center justify-between p-4 sm:px-6 sm:py-5 border-b border-slate-100 bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 border border-emerald-300 text-emerald-700 flex items-center justify-center shadow-xs shrink-0">
                            <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                                Mở Ca Làm Việc Thu Ngân
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Khởi tạo ca trực & ghi nhận quỹ tiền mặt ban đầu
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition shrink-0 cursor-pointer font-bold text-sm"
                        title="Đóng"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form Wrapper */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* 2. Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 text-xs">
                        {/* Thông báo lỗi nếu có */}
                        {error && (
                            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 font-medium">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* 1. Chọn loại ca trực */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                1. Chọn Ca Trực
                            </label>
                            <div className="grid grid-cols-2 gap-2.5">
                                {SHIFT_TYPES.map((item) => {
                                    const Icon = item.icon;
                                    const isSelected = shiftType === item.key;
                                    return (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => setShiftType(item.key)}
                                            className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
                                                isSelected
                                                    ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                            }`}
                                        >
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${item.color}`}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-slate-800 leading-tight">
                                                    {item.name}
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                                                    {item.time}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 2. Tiền mặt ban đầu trong két (Tiền thối) */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                2. Tiền Mặt Bàn Giao Đầu Ca (Tiền Thối)
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <Banknote className="w-5 h-5 text-emerald-600" />
                                </div>
                                <input
                                    type="text"
                                    value={openingCash ? Number(openingCash).toLocaleString('vi-VN') : ''}
                                    onChange={handleOpeningCashChange}
                                    placeholder="0"
                                    className="w-full pl-11 pr-14 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-base font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                                />
                                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-xs font-bold text-slate-400">
                                    VNĐ
                                </div>
                            </div>

                            {/* Chọn nhanh số tiền */}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span className="text-[11px] text-slate-400 font-medium">Chọn nhanh:</span>
                                {QUICK_AMOUNTS.map((amt) => (
                                    <button
                                        key={amt}
                                        type="button"
                                        onClick={() => setOpeningCash(String(amt))}
                                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-xl border transition cursor-pointer ${
                                            Number(openingCash) === amt
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                                        }`}
                                    >
                                        {formatCurrency(amt)}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                                * Tiền lẻ dự trữ trong két sắt để thối lại cho khách khi thanh toán tiền mặt.
                            </p>
                        </div>

                        {/* 3. Ghi chú tiếp nhận ca */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                3. Ghi Chú Tiếp Nhận Ca (Tùy chọn)
                            </label>
                            <div className="relative">
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={2}
                                    placeholder="VD: Nhận đủ tiền thối từ két sắt, máy POS hoạt động bình thường, 1 biên lai hoàn cọc đang giữ..."
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. Sticky Bottom Action Bar */}
                    <div className="p-4 sm:px-6 sm:py-3.5 bg-slate-50/90 border-t border-slate-100 backdrop-blur flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 text-xs font-semibold transition text-center cursor-pointer"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-xs shadow-emerald-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Đang mở ca...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Bắt đầu ca làm việc</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

