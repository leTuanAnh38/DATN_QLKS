import React, { useState, useEffect } from 'react';
import {
    Wine,
    BellRing,
    X,
    AlertTriangle,
    AlertCircle,
    Lightbulb,
    Info,
    Check,
    Loader2,
    Plus,
    Minus,
    ShieldAlert
} from 'lucide-react';
import roomService from '../../../../services/roomService';

export default function MinibarModal({ isOpen, onClose, room, onSuccess }) {
    const [items, setItems] = useState([]);
    const [consumedMap, setConsumedMap] = useState({});
    const [note, setNote] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');

    const [hasDamage, setHasDamage] = useState(false);
    const [damageDescription, setDamageDescription] = useState('');
    const [damageAmount, setDamageAmount] = useState(0);

    const booking = room?.current_booking || room?.recent_booking || null;
    const isInspectionRequested = room?.latest_minibar_check?.status === 'requested';

    useEffect(() => {
        if (isOpen) {
            loadMinibarItems();
            setConsumedMap({});
            setNote('');
            setErrorMessage('');
            setActiveCategory('all');
            setHasDamage(false);
            setDamageDescription('');
            setDamageAmount(0);
        }
    }, [isOpen, room?.id]);

    const loadMinibarItems = async () => {
        setIsLoading(true);
        try {
            const res = await roomService.getMinibarItems({ active_only: 'true' });
            if (res.success && Array.isArray(res.data)) {
                setItems(res.data);
            }
        } catch (error) {
            console.error('Error loading minibar items:', error);
            setErrorMessage('Không thể tải danh sách đồ Minibar.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen || !room) return null;

    const handleQtyChange = (itemId, change) => {
        setConsumedMap((prev) => {
            const current = prev[itemId] || 0;
            const updated = Math.max(0, current + change);
            if (updated === 0) {
                const next = { ...prev };
                delete next[itemId];
                return next;
            }
            return { ...prev, [itemId]: updated };
        });
    };

    const handleSetQty = (itemId, qty) => {
        setConsumedMap((prev) => {
            if (qty <= 0) {
                const next = { ...prev };
                delete next[itemId];
                return next;
            }
            return { ...prev, [itemId]: qty };
        });
    };

    // Tính tổng tiền & số lượng đã chọn
    let totalItemsCount = 0;
    let totalAmount = 0;
    const consumedList = [];

    items.forEach((item) => {
        const qty = consumedMap[item.id] || 0;
        if (qty > 0) {
            totalItemsCount += qty;
            const subtotal = qty * Number(item.price);
            totalAmount += subtotal;
            consumedList.push({
                id: item.id,
                name: item.name,
                price: Number(item.price),
                quantity: qty,
                total: subtotal
            });
        }
    });

    const formatCurrency = (val) => Number(val || 0).toLocaleString('vi-VN') + ' ₫';

    const categories = [
        { key: 'all', label: 'Tất cả' },
        { key: 'drink', label: 'Nước ngọt & Nước khoáng' },
        { key: 'alcohol', label: 'Bia & Rượu' },
        { key: 'snack', label: 'Đồ ăn vặt' },
        { key: 'other', label: 'Khác' },
    ];

    const filteredItems = items.filter((it) => {
        if (activeCategory === 'all') return true;
        return it.category === activeCategory;
    });

    const totalInspectionSurcharge = totalAmount + (hasDamage ? (Number(damageAmount) || 0) : 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorMessage('');

        if (hasDamage && (!damageDescription.trim() || Number(damageAmount) <= 0)) {
            setErrorMessage('Vui lòng nhập mô tả tài sản hư hại và số tiền bồi thường hợp lệ.');
            setIsSubmitting(false);
            return;
        }

        try {
            const payload = {
                room_id: room.id,
                booking_id: booking?.id || null,
                items: consumedList,
                has_damage: hasDamage,
                damage_description: hasDamage ? damageDescription.trim() : '',
                damage_amount: hasDamage ? Number(damageAmount) || 0 : 0,
                note: note.trim()
            };

            const res = await roomService.createMinibarCheck(payload);
            if (res && res.success) {
                // Phát tín hiệu đồng bộ realtime
                try {
                    localStorage.setItem('pms_last_room_inspection_event', Date.now().toString());
                    window.dispatchEvent(new CustomEvent('pms_minibar_updated'));
                    window.dispatchEvent(new CustomEvent('pms_booking_created'));
                } catch (err) {
                    console.error('Lỗi dispatch event:', err);
                }

                if (onSuccess) {
                    onSuccess(res);
                }
                onClose();
            } else {
                setErrorMessage(res?.message || 'Không thể lưu kiểm kê Minibar.');
            }
        } catch (error) {
            console.error('Error submitting minibar check:', error);
            setErrorMessage('Đã xảy ra lỗi khi gửi dữ liệu kiểm kê.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
            <div
                className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. Header (Fixed non-scrolling) */}
                <div className="p-4 sm:px-6 sm:py-5 bg-white border-b border-slate-100 text-slate-900 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/10 border border-amber-300 text-amber-700 flex items-center justify-center text-xl shrink-0 shadow-xs">
                            {isInspectionRequested ? (
                                <BellRing className="w-5 h-5 sm:w-6 sm:h-6" />
                            ) : (
                                <Wine className="w-5 h-5 sm:w-6 sm:h-6" />
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                                    {isInspectionRequested
                                        ? `Kiểm Tra Phòng & Minibar Check-out (P.${room.room_number})`
                                        : `Kiểm Kê Minibar Phòng ${room.room_number}`}
                                </h3>
                                {room.category_name && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                        {room.category_name}
                                    </span>
                                )}
                                {isInspectionRequested && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                                        Lễ tân đang đợi Check-out
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {booking ? (
                                    <span>
                                        Khách: <strong className="text-slate-800 font-semibold">{booking.guest_name}</strong>{' '}
                                        <span className="text-slate-400 font-mono">({booking.booking_code ? `#${booking.booking_code}` : ''})</span>
                                    </span>
                                ) : (
                                    <span className="italic text-slate-400">Chưa có thông tin khách gần nhất</span>
                                )}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm shrink-0"
                        title="Đóng"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Cảnh báo Lễ tân đang đợi kiểm phòng Check-out */}
                {isInspectionRequested && (
                    <div className="px-5 py-2.5 bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 border-b border-amber-200 flex items-center gap-2.5 text-xs text-amber-900 shrink-0">
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                        <div>
                            <strong className="font-bold">Lễ tân đang đợi kiểm phòng trả khách:</strong> Vui lòng kiểm tra kỹ số lượng đồ Minibar đã dùng và phát hiện hư hại tài sản (nếu có) để Lễ tân quyết toán chính xác.
                        </div>
                    </div>
                )}

                {/* Sub-header Tabs & Filter */}
                <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
                    <div className="flex items-center gap-1.5">
                        {categories.map((c) => (
                            <button
                                key={c.key}
                                type="button"
                                onClick={() => setActiveCategory(c.key)}
                                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                                    activeCategory === c.key
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
                                }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>

                    <div className="text-xs text-slate-500 shrink-0 font-medium">
                        Đã chọn: <strong className="text-indigo-600 font-bold">{totalItemsCount}</strong> món
                    </div>
                </div>

                {/* 2. Body Content (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
                    {errorMessage && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Section 1: Danh sách Minibar */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                1. Danh sách đồ uống & snack Minibar
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                                {totalItemsCount === 0 ? 'Chưa chọn món nào (Minibar nguyên seal)' : `Tiêu thụ: ${formatCurrency(totalAmount)}`}
                            </span>
                        </div>

                        {isLoading ? (
                            <div className="py-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                                <span>Đang tải danh mục Minibar phòng...</span>
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-sm">
                                Không có mặt hàng Minibar nào trong nhóm này.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {filteredItems.map((item) => {
                                    const qty = consumedMap[item.id] || 0;
                                    const isSelected = qty > 0;
                                    return (
                                        <div
                                            key={item.id}
                                            className={`p-3 rounded-2xl border transition-all ${
                                                isSelected
                                                    ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/40 shadow-xs'
                                                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-xs text-slate-800 line-clamp-1" title={item.name}>
                                                        {item.name}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs font-bold text-amber-700">
                                                            {formatCurrency(item.price)}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            (Định mức: {item.standard_quantity})
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Quantity Controls */}
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        disabled={qty === 0}
                                                        onClick={() => handleQtyChange(item.id, -1)}
                                                        className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center transition cursor-pointer ${
                                                            qty > 0
                                                                ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                                                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        <Minus className="w-3.5 h-3.5" />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={qty}
                                                        onChange={(e) => handleSetQty(item.id, parseInt(e.target.value) || 0)}
                                                        className="w-10 h-7 text-center font-bold text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleQtyChange(item.id, 1)}
                                                        className="w-7 h-7 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center transition cursor-pointer shadow-xs"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {isSelected && (
                                                <div className="mt-2 pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px]">
                                                    <span className="text-slate-500">Thành tiền ({qty} x):</span>
                                                    <strong className="text-amber-800 font-bold">
                                                        {formatCurrency(qty * Number(item.price))}
                                                    </strong>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Section 2: Kiểm tra Hư hại tài sản phòng (Damage) */}
                    <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/90 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                                <span className="text-xs font-bold text-rose-950">
                                    Kiểm tra hư hỏng / tổn hại tài sản phòng (Damage Inspection)
                                </span>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer select-none bg-white px-2.5 py-1 rounded-xl border border-rose-200 shadow-2xs">
                                <input
                                    type="checkbox"
                                    checked={hasDamage}
                                    onChange={(e) => setHasDamage(e.target.checked)}
                                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-rose-800">
                                    {hasDamage ? 'Có hư hại (Bồi thường)' : 'Không có hư hại'}
                                </span>
                            </label>
                        </div>

                        {hasDamage && (
                            <div className="space-y-3 pt-3 border-t border-rose-200/70 animate-fadeIn">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                            Mô tả tài sản hư hại / vỡ đồ: <span className="text-rose-600">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={damageDescription}
                                            onChange={(e) => setDamageDescription(e.target.value)}
                                            placeholder="VD: Vỡ 2 ly thủy tinh, cháy ga trải giường..."
                                            className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                            Số tiền bồi thường (VNĐ): <span className="text-rose-600">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="10000"
                                            value={damageAmount || ''}
                                            onChange={(e) => setDamageAmount(e.target.value)}
                                            placeholder="VD: 100000"
                                            className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl text-xs text-rose-700 font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        />
                                    </div>
                                </div>

                                {/* Gợi ý nhanh */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    <span className="text-[10px] text-slate-500 font-semibold">Gợi ý nhanh:</span>
                                    {[
                                        { label: 'Vỡ ly nước', amount: 50000 },
                                        { label: 'Hỏng khăn tắm', amount: 100000 },
                                        { label: 'Bẩn ga giường nặng', amount: 150000 },
                                        { label: 'Vỡ bình hoa', amount: 200000 },
                                        { label: 'Hỏng điều khiển TV/AC', amount: 150000 }
                                    ].map((suggest) => (
                                        <button
                                            key={suggest.label}
                                            type="button"
                                            onClick={() => {
                                                setDamageDescription((prev) => (prev ? `${prev}, ${suggest.label}` : suggest.label));
                                                setDamageAmount((prev) => Number(prev || 0) + suggest.amount);
                                            }}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-semibold transition cursor-pointer"
                                        >
                                            <Plus className="w-2.5 h-2.5" />
                                            <span>{suggest.label} ({suggest.amount.toLocaleString('vi-VN')}đ)</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section 3: Ghi chú */}
                    <div className="pt-1">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            2. Ghi chú tình trạng phòng / thiết bị (nếu có):
                        </label>
                        <textarea
                            rows={2}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="VD: Phòng sạch sẽ bình thường, tủ lạnh hoạt động tốt, không để quên đồ..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Notice */}
                    {booking ? (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2.5">
                            <Lightbulb className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                            <div className="leading-relaxed">
                                <strong>Tự động đồng bộ Hóa đơn Check-out:</strong> Khi bấm xác nhận, tổng tiền{' '}
                                <strong className="text-blue-900 underline">{formatCurrency(totalInspectionSurcharge)}</strong> (Minibar: {formatCurrency(totalAmount)} + Hư hại: {formatCurrency(hasDamage ? damageAmount : 0)}) sẽ được đẩy ngay vào
                                Hóa đơn thanh toán của đơn <strong className="font-mono">#{booking.booking_code}</strong> và gửi thông báo tới Lễ tân!
                            </div>
                        </div>
                    ) : (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
                            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="leading-relaxed">
                                <strong>Lưu ý:</strong> Phòng hiện không có đơn lưu trú. Kết quả kiểm kê sẽ được lưu vào Nhật ký buồng phòng để làm căn cứ bàn giao ca trực.
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Footer (Sticky Bottom Action Bar) */}
                <div className="px-5 py-3.5 bg-slate-50/90 border-t border-slate-100 backdrop-blur flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                    <div>
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                            <span>Minibar: <strong className="text-amber-800 font-bold">{formatCurrency(totalAmount)}</strong></span>
                            <span>•</span>
                            <span>Hư hại: <strong className="text-rose-700 font-bold">{formatCurrency(hasDamage ? damageAmount : 0)}</strong></span>
                        </div>
                        <div className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                            Tổng phụ thu: <span className="text-rose-600 font-bold">{formatCurrency(totalInspectionSurcharge)}</span>
                        </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-200/70 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer text-center justify-center"
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Đang lưu...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>Xác nhận & Báo kết quả cho Lễ tân</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

