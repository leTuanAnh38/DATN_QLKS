import React from 'react';
import {
    ShoppingBag,
    Trash2,
    X,
    Minus,
    Plus,
    Zap,
    Clock,
    Loader2,
    BellRing
} from 'lucide-react';

export default function ServiceCartModal({
    isOpen = false,
    onClose,
    onSubmit,
    cart = [],
    totalCartCount = 0,
    totalCartPrice = 0,
    isSubmittingCart = false,
    clearCart,
    updateCartQuantity,
    removeFromCart,
    updateCartItemNote,
    activeBookings = [],
    cartBookingId = '',
    setCartBookingId,
    cartDeliveryMode = 'now',
    setCartDeliveryMode,
    cartScheduledDateTime = '',
    setCartScheduledDateTime,
    cartGeneralNote = '',
    setCartGeneralNote,
    formatToLocalDateTimeString = (d) => d.toISOString().slice(0, 16)
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
            <div
                className="fixed inset-0"
                onClick={() => !isSubmittingCart && onClose()}
                aria-hidden="true"
            />
            <div
                className="relative bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-scale-up z-10"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header (Clean White Theme) */}
                <div className="px-6 py-4 bg-white text-slate-900 flex items-center justify-between border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-200/60 shadow-xs">
                            <ShoppingBag className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-sm sm:text-base text-slate-900">
                                    Giỏ Dịch Vụ & Món Ăn
                                </h3>
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                                    {totalCartCount} món
                                </span>
                            </div>
                            <span className="text-[10px] text-amber-700 font-medium tracking-wide">
                                Gọi nhiều món một lúc • Phục vụ trực tiếp tại phòng
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {cart.length > 0 && (
                            <button
                                type="button"
                                onClick={clearCart}
                                disabled={isSubmittingCart}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 border border-rose-200 disabled:opacity-50"
                                title="Xóa toàn bộ món trong giỏ"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Xóa hết</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => !isSubmittingCart && onClose()}
                            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                {cart.length === 0 ? (
                    <div className="p-12 text-center space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                            <ShoppingBag className="w-8 h-8 text-amber-600" />
                        </div>
                        <div>
                            <h4 className="font-bold text-base text-slate-900">
                                Giỏ dịch vụ của bạn đang trống
                            </h4>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                Hãy lướt thực đơn và nhấn "Thêm giỏ" vào các món ăn, đồ uống hoặc tiện ích mà quý khách muốn gọi!
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 active:scale-95 text-white text-xs font-bold transition shadow-md shadow-sky-900/20 cursor-pointer"
                        >
                            Khám phá Menu dịch vụ
                        </button>
                    </div>
                ) : (
                    <form onSubmit={onSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                            {/* 1. Danh sách món trong giỏ */}
                            <div className="space-y-2.5">
                                <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                                    <span>Danh sách món đã chọn ({cart.length})</span>
                                    <span className="text-[11px] font-semibold text-slate-500">
                                        Tổng: {totalCartPrice.toLocaleString('vi-VN')} VND
                                    </span>
                                </label>

                                <div className="space-y-2.5 max-h-60 sm:max-h-68 overflow-y-auto pr-1">
                                    {cart.map((ci) => (
                                        <div
                                            key={ci.id}
                                            className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 transition hover:border-amber-300"
                                        >
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={
                                                        ci.display_image ||
                                                        'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80'
                                                    }
                                                    alt={ci.name}
                                                    className="w-13 h-13 rounded-xl object-cover border border-slate-200 shrink-0"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wider block">
                                                        {ci.category_name}
                                                    </span>
                                                    <h5 className="font-bold text-slate-900 text-xs truncate">
                                                        {ci.name}
                                                    </h5>
                                                    <div className="text-xs font-bold text-rose-600 mt-0.5">
                                                        {ci.price === 0
                                                            ? 'Miễn phí'
                                                            : `${ci.price.toLocaleString('vi-VN')} VND`}
                                                    </div>
                                                </div>

                                                {/* Quantity Stepper & Remove */}
                                                <div className="flex items-center gap-2.5 shrink-0">
                                                    <div className="inline-flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden shadow-2xs">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateCartQuantity(ci.id, -1, true)}
                                                            className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                                            title="Giảm 1"
                                                        >
                                                            <Minus className="w-3 h-3" />
                                                        </button>
                                                        <span className="px-2 text-xs font-bold text-slate-900 min-w-[20px] text-center">
                                                            {ci.quantity}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateCartQuantity(ci.id, 1, true)}
                                                            className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                                            title="Tăng 1"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                        </button>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => removeFromCart(ci.id)}
                                                        className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                                                        title="Xóa món này"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Input ghi chú riêng cho món này */}
                                            <div className="pt-1.5 border-t border-slate-200/50 flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={ci.note || ''}
                                                    onChange={(e) => updateCartItemNote(ci.id, e.target.value)}
                                                    placeholder="Ghi chú món này (VD: ít đá, không hành, sốt để riêng...)"
                                                    className="w-full px-2.5 py-1 text-[11px] bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 2. Giao đến phòng / Mã Booking */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Giao đến Phòng / Mã Đặt phòng <span className="text-rose-500">*</span>
                                </label>
                                {activeBookings.length > 0 ? (
                                    <select
                                        value={cartBookingId}
                                        onChange={(e) => setCartBookingId(e.target.value)}
                                        required
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
                                    >
                                        {activeBookings.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.display_label}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={cartBookingId}
                                        onChange={(e) => setCartBookingId(e.target.value.toUpperCase())}
                                        placeholder="Nhập Mã Booking (VD: BK-02DE4E in trên bìa thẻ phòng)"
                                        required
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 uppercase tracking-wider shadow-2xs"
                                    />
                                )}
                                <span className="text-[10px] text-slate-400 mt-1 block">
                                    Chi phí toàn bộ dịch vụ sẽ được kết chuyển tự động vào hóa đơn phòng khi Check-out.
                                </span>
                            </div>

                            {/* 3. Thời gian phục vụ */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Thời gian phục vụ
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCartDeliveryMode('now');
                                            setCartScheduledDateTime('');
                                        }}
                                        className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                                            cartDeliveryMode === 'now'
                                                ? 'bg-amber-50/90 border-amber-400 text-amber-950 font-bold ring-1 ring-amber-300'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                cartDeliveryMode === 'now'
                                                    ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white'
                                                    : 'bg-slate-100 text-slate-500'
                                            }`}
                                        >
                                            <Zap className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold leading-tight">Giao ngay</div>
                                            <div className="text-[10px] text-slate-400 font-normal">
                                                Các bộ phận chuẩn bị luôn
                                            </div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCartDeliveryMode('scheduled');
                                            if (!cartScheduledDateTime) {
                                                const d = new Date(Date.now() + 30 * 60 * 1000);
                                                setCartScheduledDateTime(formatToLocalDateTimeString(d));
                                            }
                                        }}
                                        className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                                            cartDeliveryMode === 'scheduled'
                                                ? 'bg-amber-50/90 border-amber-400 text-amber-950 font-bold ring-1 ring-amber-300'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                cartDeliveryMode === 'scheduled'
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

                                {cartDeliveryMode === 'scheduled' && (
                                    <div className="mt-2.5 p-3 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-2.5">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-[10px] text-slate-500 font-semibold">Chọn nhanh:</span>
                                            {[
                                                { label: '+15 phút', mins: 15 },
                                                { label: '+30 phút', mins: 30 },
                                                { label: '+45 phút', mins: 45 },
                                                { label: '+1 giờ', mins: 60 }
                                            ].map((item) => (
                                                <button
                                                    key={item.label}
                                                    type="button"
                                                    onClick={() => {
                                                        const d = new Date(Date.now() + item.mins * 60 * 1000);
                                                        setCartScheduledDateTime(formatToLocalDateTimeString(d));
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
                                                value={cartScheduledDateTime}
                                                min={formatToLocalDateTimeString(new Date())}
                                                onChange={(e) => setCartScheduledDateTime(e.target.value)}
                                                className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 4. Ghi chú chung cho đơn */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Ghi chú chung cho toàn bộ đơn (Tùy chọn)
                                </label>
                                <input
                                    type="text"
                                    value={cartGeneralNote}
                                    onChange={(e) => setCartGeneralNote(e.target.value)}
                                    placeholder="Ví dụ: Giao cùng lúc khi các món đã nấu xong, mang thêm 2 bộ chén đĩa..."
                                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs"
                                />
                            </div>

                            {/* 5. Tóm tắt chi phí */}
                            <div className="p-3.5 bg-slate-100 rounded-2xl flex items-center justify-between border border-slate-200">
                                <div>
                                    <span className="text-[11px] text-slate-500 block font-medium">
                                        Tổng cộng ({totalCartCount} phần của {cart.length} món)
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        Tự động ghi nhận vào Folio phòng
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-base sm:text-lg font-black text-rose-600">
                                        {totalCartPrice.toLocaleString('vi-VN')} VND
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 sm:px-6 py-3.5 bg-slate-50/90 backdrop-blur-xs border-t border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmittingCart}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                            >
                                Chọn thêm món khác
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmittingCart}
                                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 active:scale-95 text-white text-xs font-bold shadow-md shadow-sky-900/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {isSubmittingCart ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Đang gửi {cart.length} yêu cầu...</span>
                                    </>
                                ) : (
                                    <>
                                        <BellRing className="w-4 h-4" />
                                        <span>Xác nhận gửi tất cả ({totalCartCount} món)</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

