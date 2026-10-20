import React, { useState, useEffect } from 'react';
import roomService from '../../../services/roomService';

export default function MinibarModal({ isOpen, onClose, room, onSuccess }) {
    const [items, setItems] = useState([]);
    const [consumedMap, setConsumedMap] = useState({});
    const [note, setNote] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');

    const booking = room?.current_booking || room?.recent_booking || null;

    useEffect(() => {
        if (isOpen) {
            loadMinibarItems();
            setConsumedMap({});
            setNote('');
            setErrorMessage('');
            setActiveCategory('all');
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorMessage('');

        try {
            const payload = {
                room_id: room.id,
                booking_id: booking?.id || null,
                items: consumedList,
                note: note.trim()
            };

            const res = await roomService.createMinibarCheck(payload);
            if (res && res.success) {
                if (onSuccess) {
                    onSuccess(res);
                }
                onClose();
            } else {
                setErrorMessage(res?.message || 'Không thể lưu kiểm kê Minibar.');
            }
        } catch (error) {
            setErrorMessage('Đã xảy ra lỗi khi gửi dữ liệu kiểm kê.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
            <div
                className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-3.5 bg-white border-b border-slate-200 text-slate-900 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl shrink-0 shadow-xs">
                            🍾
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-base text-slate-900">Kiểm Kê Minibar Phòng {room.room_number}</h3>
                                {room.category_name && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                        {room.category_name}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {booking ? (
                                    <span>
                                        Khách: <strong className="text-slate-800">{booking.guest_name}</strong>{' '}
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
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer text-base"
                    >
                        ✕
                    </button>
                </div>

                {/* Sub-header Tabs & Filter */}
                <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
                    <div className="flex items-center gap-1.5">
                        {categories.map((c) => (
                            <button
                                key={c.key}
                                type="button"
                                onClick={() => setActiveCategory(c.key)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
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
                        Đã chọn: <strong className="text-indigo-600">{totalItemsCount}</strong> món
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {errorMessage && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                            <span>⚠️</span>
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="py-12 text-center text-slate-400 text-sm">
                            <span className="inline-block animate-spin mr-2">⏳</span>
                            Đang tải danh mục Minibar phòng...
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
                                        className={`p-3 rounded-xl border transition-all ${
                                            isSelected
                                                ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-400/40 shadow-xs'
                                                : 'bg-white border-slate-200 hover:border-slate-300'
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
                                                    <span className="text-[10px] text-slate-400">
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
                                                    -
                                                </button>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={qty}
                                                    onChange={(e) => handleSetQty(item.id, parseInt(e.target.value) || 0)}
                                                    className="w-9 h-7 text-center font-bold text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleQtyChange(item.id, 1)}
                                                    className="w-7 h-7 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center transition cursor-pointer"
                                                >
                                                    +
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

                    {/* Note Input */}
                    <div className="pt-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Ghi chú tình trạng Minibar / Tủ lạnh (nếu có):
                        </label>
                        <textarea
                            rows={2}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="VD: Khách đã dùng 2 bia, nước ngọt còn nguyên seal, tủ lạnh hoạt động tốt..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Notice */}
                    {booking ? (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2">
                            <span className="text-base shrink-0">💡</span>
                            <div>
                                <strong>Tự động đồng bộ Hóa đơn:</strong> Khi bấm xác nhận, số tiền{' '}
                                <strong className="text-blue-900 underline">{formatCurrency(totalAmount)}</strong> sẽ tự động được thêm vào
                                Folio thanh toán của đơn <strong className="font-mono">#{booking.booking_code}</strong> để Lễ tân quyết toán ngay!
                            </div>
                        </div>
                    ) : (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                            <span className="text-base shrink-0">ℹ️</span>
                            <div>
                                <strong>Lưu ý:</strong> Phòng hiện không có đơn lưu trú. Kết quả kiểm kê sẽ được lưu vào Nhật ký buồng phòng để làm căn cứ bàn giao ca trực.
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
                    <div>
                        <div className="text-[11px] text-slate-500">Tổng phụ phí Minibar:</div>
                        <div className="text-lg font-bold text-amber-800">
                            {formatCurrency(totalAmount)}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="inline-block animate-spin">⏳</span>
                                    <span>Đang lưu...</span>
                                </>
                            ) : (
                                <>
                                    <span>✓</span>
                                    <span>Xác nhận kiểm kê {totalItemsCount > 0 ? `(${totalItemsCount} món)` : ''}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
