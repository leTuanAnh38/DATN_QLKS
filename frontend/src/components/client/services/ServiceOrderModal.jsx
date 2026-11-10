import React from 'react';
import {
    BellRing,
    X,
    BedDouble,
    Check,
    Minus,
    Plus,
    Zap,
    Clock,
    Loader2
} from 'lucide-react';

export default function ServiceOrderModal({
    selectedItem,
    onClose,
    onSubmit,
    isSubmitting = false,
    activeBookings = [],
    selectedBookingId,
    setSelectedBookingId,
    quantity = 1,
    setQuantity,
    deliveryMode = 'now',
    setDeliveryMode,
    scheduledDateTime = '',
    setScheduledDateTime,
    note = '',
    setNote,
    formatToLocalDateTimeString = (d) => d.toISOString().slice(0, 16)
}) {
    if (!selectedItem) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
            {/* Backdrop dismiss */}
            <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

            <div
                className="relative bg-white rounded-3xl max-w-lg w-full max-h-[90vh] shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-scale-up z-10"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="px-6 py-4.5 bg-white text-slate-900 flex items-center justify-between border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-200/60 shadow-xs">
                            <BellRing className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-slate-900">Yêu Cầu Dịch Vụ Tại Phòng</h3>
                            <span className="text-[10px] text-amber-700 font-medium tracking-wide">
                                In-Room Dining & Concierge Service
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer disabled:opacity-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Form wrapping Tier 2 & Tier 3 */}
                <form onSubmit={onSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* Modal Body (Scrollable Tier 2) */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 sm:space-y-5">
                        {/* Preview Item đã chọn */}
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-3.5 shadow-2xs">
                            <img
                                src={
                                    selectedItem.display_image ||
                                    selectedItem.image_url ||
                                    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80'
                                }
                                alt={selectedItem.name}
                                className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                                    {selectedItem.category_name}
                                </span>
                                <h4 className="font-bold text-slate-900 text-xs truncate">
                                    {selectedItem.name}
                                </h4>
                                <div className="text-xs font-black text-rose-600 mt-0.5">
                                    {Number(selectedItem.price).toLocaleString('vi-VN')} VND
                                    <span className="text-[10px] font-normal text-slate-400 ml-1">/ lần</span>
                                </div>
                            </div>
                        </div>

                        {/* HÀNG 1: CHỌN PHÒNG / MÃ BOOKING */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                Giao đến Phòng / Mã Đặt phòng <span className="text-rose-500">*</span>
                            </label>
                            {activeBookings.length > 0 ? (
                                <>
                                    <select
                                        value={selectedBookingId}
                                        onChange={(e) => setSelectedBookingId(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
                                    >
                                        {activeBookings.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.display_label}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
                                        <Check className="w-3 h-3 text-emerald-600" />
                                        Đang phục vụ tận phòng cho đơn lưu trú của quý khách.
                                    </span>
                                </>
                            ) : (
                                <div className="space-y-2.5">
                                    <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-xs text-amber-950 flex items-start gap-2.5">
                                        <BedDouble className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                        <div className="space-y-0.5">
                                            <p className="font-bold text-amber-900">
                                                Dành cho Khách lưu trú & Khách theo đoàn
                                            </p>
                                            <p className="text-[11px] text-amber-800 leading-relaxed">
                                                Quý khách vui lòng nhập <strong>Mã Đặt phòng (Mã Booking)</strong> in
                                                trên bìa thẻ phòng (Keycard) hoặc phiếu nhận phòng của bạn để hệ thống
                                                phục vụ trực tiếp tới phòng.
                                            </p>
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        value={selectedBookingId}
                                        onChange={(e) => setSelectedBookingId(e.target.value.toUpperCase())}
                                        placeholder="Nhập Mã Booking (VD: BK-02DE4E)"
                                        required
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 uppercase tracking-wider shadow-2xs"
                                    />
                                </div>
                            )}
                            <span className="text-[10px] text-slate-400 mt-1 block">
                                Chi phí dịch vụ sẽ được tính trực tiếp vào hóa đơn của phòng khi Check-out.
                            </span>
                        </div>

                        {/* HÀNG 2: CHỌN SỐ LƯỢNG (QUANTITY) & TẠM TÍNH */}
                        <div className="grid grid-cols-2 gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Số lượng:
                                </label>
                                <div className="inline-flex items-center border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
                                    <button
                                        type="button"
                                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                        className="px-3 py-2 text-slate-600 hover:bg-slate-100 font-bold transition flex items-center justify-center cursor-pointer"
                                    >
                                        <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="px-4 py-1.5 text-xs font-bold text-slate-900 border-x border-slate-200">
                                        {quantity}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                                        className="px-3 py-2 text-slate-600 hover:bg-slate-100 font-bold transition flex items-center justify-center cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className="text-right">
                                <span className="text-[10px] text-slate-400 block font-medium">
                                    Tổng tiền dịch vụ:
                                </span>
                                <div className="text-lg font-black text-rose-600 font-bold tracking-tight">
                                    {(Number(selectedItem.price) * quantity).toLocaleString('vi-VN')}
                                    <span className="text-xs font-normal text-slate-400 ml-1">VND</span>
                                </div>
                            </div>
                        </div>

                        {/* HÀNG 3: THỜI GIAN PHỤC VỤ (GIAO NGAY HOẶC HẸN GIỜ) */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                                <span>Thời gian phục vụ</span>
                                {deliveryMode === 'scheduled' && scheduledDateTime && (
                                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                        Hẹn giao:{' '}
                                        {new Date(scheduledDateTime).toLocaleTimeString('vi-VN', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}{' '}
                                        - {new Date(scheduledDateTime).toLocaleDateString('vi-VN')}
                                    </span>
                                )}
                            </label>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDeliveryMode('now');
                                        setScheduledDateTime('');
                                    }}
                                    className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                                        deliveryMode === 'now'
                                            ? 'bg-amber-50/90 border-amber-400 text-amber-950 font-bold ring-1 ring-amber-300'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <div
                                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                            deliveryMode === 'now'
                                                ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}
                                    >
                                        <Zap className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold leading-tight">Giao ngay</div>
                                        <div className="text-[10px] text-slate-400 font-normal">
                                            Bếp làm luôn khi nhận đơn
                                        </div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setDeliveryMode('scheduled');
                                        if (!scheduledDateTime) {
                                            const d = new Date(Date.now() + 30 * 60 * 1000);
                                            setScheduledDateTime(formatToLocalDateTimeString(d));
                                        }
                                    }}
                                    className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                                        deliveryMode === 'scheduled'
                                            ? 'bg-amber-50/90 border-amber-400 text-amber-950 font-bold ring-1 ring-amber-300'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <div
                                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                            deliveryMode === 'scheduled'
                                                ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}
                                    >
                                        <Clock className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold leading-tight">Hẹn giờ giao</div>
                                        <div className="text-[10px] text-slate-400 font-normal">
                                            Đặt trước theo giờ ăn của bạn
                                        </div>
                                    </div>
                                </button>
                            </div>

                            {deliveryMode === 'scheduled' && (
                                <div className="mt-2.5 p-3 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-2.5">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[10px] text-slate-500 font-semibold">Chọn nhanh:</span>
                                        {[
                                            { label: '+15 phút', mins: 15 },
                                            { label: '+30 phút', mins: 30 },
                                            { label: '+45 phút', mins: 45 },
                                            { label: '+1 giờ', mins: 60 },
                                            { label: '+2 giờ', mins: 120 }
                                        ].map((item) => (
                                            <button
                                                key={item.label}
                                                type="button"
                                                onClick={() => {
                                                    const d = new Date(Date.now() + item.mins * 60 * 1000);
                                                    setScheduledDateTime(formatToLocalDateTimeString(d));
                                                }}
                                                className="px-2 py-1 rounded-lg bg-white hover:bg-sky-100 border border-slate-200 text-slate-700 text-[10px] font-semibold transition cursor-pointer"
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <label className="text-[11px] font-bold text-slate-700 shrink-0">
                                            Thời điểm hẹn giao:
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={scheduledDateTime}
                                            min={formatToLocalDateTimeString(new Date())}
                                            onChange={(e) => setScheduledDateTime(e.target.value)}
                                            className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                                        />
                                    </div>

                                    <p className="text-[10px] text-amber-800/80 italic">
                                        * Nhân viên sẽ chuẩn bị và giao món tận phòng đúng theo khung giờ quý khách đã chọn.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* HÀNG 4: GHI CHÚ YÊU CẦU RIÊNG */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                Ghi chú phục vụ riêng (Tùy chọn)
                            </label>
                            <textarea
                                rows={3}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Ví dụ: Mang lên lúc 19:30, ít đường, nhiều đá, khăn tắm thêm, sốt để riêng..."
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs resize-none"
                            ></textarea>
                        </div>
                    </div>

                    {/* Modal Actions */}
                    <div className="px-5 sm:px-6 py-3.5 bg-slate-50/90 backdrop-blur-xs border-t border-slate-200/80 flex items-center justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                        >
                            Đóng
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 active:scale-95 text-white text-xs font-bold shadow-md shadow-sky-900/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Đang gửi yêu cầu...</span>
                                </>
                            ) : (
                                <>
                                    <BellRing className="w-4 h-4" />
                                    <span>Xác nhận gửi yêu cầu</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

