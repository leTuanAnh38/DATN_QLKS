import React, { useEffect, useMemo, useState } from 'react';
import {
    X,
    Clock,
    Check,
    CheckCircle2,
    Minus,
    Plus,
    Zap,
    ShoppingBag,
    Sparkles,
    Receipt,
    Info,
    ArrowRight
} from 'lucide-react';
import { renderCategoryIcon } from './serviceHelpers';

const FALLBACK_IMAGE =
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80';

/**
 * Xác định nhóm dịch vụ để hiển thị nhãn thành phần & tiêu chuẩn phục vụ phù hợp
 */
const detectServiceMeta = (item, starCount) => {
    const text = `${item?.category_name || ''} ${item?.name || ''}`.toLowerCase();

    if (
        text.includes('spa') ||
        text.includes('massage') ||
        text.includes('trị liệu') ||
        text.includes('thư giãn') ||
        text.includes('wellness') ||
        text.includes('chăm sóc da')
    ) {
        return {
            ingredientsTitle: 'Liệu trình & Dược liệu bao gồm',
            defaultDuration: 'Phục vụ tại The Lotus Spa hoặc tận phòng',
            defaultHighlights: [
                'Kỹ thuật viên chuyên nghiệp đạt chuẩn đào tạo bài bản',
                'Sử dụng tinh dầu & thảo dược thiên nhiên chọn lọc',
                'Hỗ trợ đặt lịch hẹn khung giờ riêng theo yêu cầu'
            ]
        };
    }

    if (
        text.includes('xe') ||
        text.includes('đưa đón') ||
        text.includes('sân bay') ||
        text.includes('limousine') ||
        text.includes('transfer') ||
        text.includes('tour')
    ) {
        return {
            ingredientsTitle: 'Hạng mục dịch vụ bao gồm',
            defaultDuration: 'Đón tiễn đúng giờ 24/7',
            defaultHighlights: [
                'Xe đời mới sạch sẽ, điều hòa mát lạnh & nước suối miễn phí',
                'Tài xế kinh nghiệm, thông thạo tuyến đường Đà Nẵng',
                'Xác nhận lịch trình và điểm đón trực tiếp qua lễ tân'
            ]
        };
    }

    if (text.includes('giặt') || text.includes('ủi') || text.includes('laundry')) {
        return {
            ingredientsTitle: 'Quy trình & Hạng mục bao gồm',
            defaultDuration: 'Giao nhận tận phòng nhanh chóng',
            defaultHighlights: [
                'Phân loại chất liệu vải kỹ lưỡng trước khi xử lý',
                'Sử dụng dung dịch giặt xả dịu nhẹ, thơm mát',
                'Gấp gọn hoặc treo móc sang trọng khi trả đồ tận phòng'
            ]
        };
    }

    if (
        text.includes('uống') ||
        text.includes('bar') ||
        text.includes('rượu') ||
        text.includes('vang') ||
        text.includes('trà') ||
        text.includes('cà phê') ||
        text.includes('cocktail') ||
        text.includes('nước')
    ) {
        return {
            ingredientsTitle: 'Thành phần & Hương vị',
            defaultDuration: 'Pha chế & giao trong 15 - 20 phút',
            defaultHighlights: [
                'Pha chế tươi mới theo yêu cầu độ ngọt / đá riêng của khách',
                'Nguyên liệu & đồ uống chính hãng, bảo quản chuẩn nhiệt độ',
                'Phục vụ kèm ly thủy tinh cao cấp tận phòng 24/7'
            ]
        };
    }

    if (
        text.includes('ẩm thực') ||
        text.includes('ăn') ||
        text.includes('món') ||
        text.includes('bò') ||
        text.includes('súp') ||
        text.includes('phở') ||
        text.includes('dining') ||
        text.includes('bếp')
    ) {
        return {
            ingredientsTitle: 'Thành phần & Nguyên liệu',
            defaultDuration: 'Chế biến & giao nóng 20 - 30 phút',
            defaultHighlights: [
                `Chế biến nóng ngay khi nhận đơn bởi bếp trưởng chuẩn ${starCount} sao`,
                'Nguyên liệu tươi sạch tuyển chọn mỗi ngày, đảm bảo vệ sinh ATTP',
                'Hỗ trợ ghi chú khẩu vị (ít cay, không hành, dị ứng thực phẩm...)'
            ]
        };
    }

    return {
        ingredientsTitle: 'Chi tiết hạng mục bao gồm',
        defaultDuration: 'Phục vụ tận phòng 24/7',
        defaultHighlights: [
            `Tiêu chuẩn phục vụ ${starCount} sao nhanh chóng, chu đáo`,
            'Hỗ trợ hẹn giờ phục vụ linh hoạt theo lịch nghỉ dưỡng',
            'Tiện lợi thanh toán gộp vào hóa đơn phòng khi trả phòng'
        ]
    };
};

/**
 * Tách danh sách thành phần từ trường ingredients (xuống dòng, gạch đầu dòng, dấu chấm phẩy/phẩy)
 */
const parseIngredientsList = (rawText = '') => {
    const trimmed = String(rawText || '').trim();
    if (!trimmed) return [];

    const lines = trimmed
        .split(/\r?\n/)
        .map((line) => line.replace(/^[-•*✓✔▪▫+\d.)\s]+/, '').trim())
        .filter(Boolean);

    if (lines.length > 1) return lines;

    // Nếu Admin nhập trên 1 dòng cách nhau bằng dấu ; hoặc dấu ,
    const singleLine = lines[0] || trimmed;
    if (singleLine.includes(';')) {
        return singleLine
            .split(';')
            .map((part) => part.replace(/^[-•*✓✔\s]+/, '').trim())
            .filter(Boolean);
    }
    if (singleLine.includes(',')) {
        const parts = singleLine
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
        if (parts.length >= 2) return parts;
    }

    return [singleLine];
};

export default function ServiceDetailModal({
    item,
    onClose,
    onAddToCart,
    onOrderNow,
    cartQuantity = 0,
    starCount = 3,
    hotelName = 'Khách Sạn TA Đà Nẵng',
    primaryActionLabel = 'Đặt ngay'
}) {
    const [qty, setQty] = useState(1);

    useEffect(() => {
        setQty(1);
    }, [item?.id]);

    // Đóng bằng phím Escape và khóa cuộn nền khi mở modal
    useEffect(() => {
        if (!item) return undefined;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [item, onClose]);

    const meta = useMemo(() => detectServiceMeta(item, starCount), [item, starCount]);
    const ingredientItems = useMemo(() => parseIngredientsList(item?.ingredients), [item?.ingredients]);

    if (!item) return null;

    const imgSrc = item.display_image || item.image_url || FALLBACK_IMAGE;
    const categoryName = item.category_name || item.category?.name || `Dịch vụ ${starCount} sao`;
    const priceNum = Number(item.price) || 0;
    const subtotal = priceNum * qty;
    const showCartControls = typeof onAddToCart === 'function';

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-detail-title"
        >
            {/* Backdrop dismiss */}
            <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

            <div
                className="relative z-10 w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[90vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col animate-scale-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* HERO IMAGE HEADER */}
                <div className="relative h-56 sm:h-72 bg-slate-100 shrink-0 overflow-hidden">
                    <img
                        src={imgSrc}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.currentTarget.src = FALLBACK_IMAGE;
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-slate-950/40 pointer-events-none" />

                    {/* Top Bar: Category Badge & Close Button */}
                    <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/65 backdrop-blur-md text-amber-200 text-[11px] font-bold border border-white/15 shadow-sm max-w-[75%] truncate">
                            {renderCategoryIcon(categoryName, item.category_icon, 'w-3.5 h-3.5 text-amber-300 shrink-0')}
                            <span className="truncate">{categoryName}</span>
                        </span>

                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Đóng chi tiết dịch vụ"
                            className="w-10 h-10 rounded-full bg-slate-950/60 hover:bg-slate-950/80 backdrop-blur-md text-white border border-white/20 flex items-center justify-center transition cursor-pointer shrink-0 shadow-md"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Bottom Image Overlay: Duration & In-Cart Badge */}
                    <div className="absolute bottom-3.5 left-4 right-4 flex items-end justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-slate-800 text-[11px] font-bold shadow-sm max-w-[75%] truncate">
                            <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                            <span className="truncate">{item.duration?.trim() || meta.defaultDuration}</span>
                        </span>

                        {cartQuantity > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-sky-600 to-blue-700 text-white text-[11px] font-bold shadow-md border border-white/25 shrink-0">
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>Trong giỏ ({cartQuantity})</span>
                            </span>
                        )}
                    </div>
                </div>

                {/* SCROLLABLE CONTENT BODY */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                    {/* Title & Price */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 pb-4 border-b border-slate-100">
                        <div className="min-w-0">
                            <h3
                                id="service-detail-title"
                                className="font-serif text-xl sm:text-2xl font-bold text-slate-900 leading-snug"
                            >
                                {item.name}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Phục vụ bởi {hotelName} • Chuẩn {starCount} sao
                            </p>
                        </div>

                        <div className="sm:text-right shrink-0">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Đơn giá
                            </span>
                            {priceNum === 0 ? (
                                <span className="text-lg sm:text-xl font-black text-emerald-600">Miễn phí</span>
                            ) : (
                                <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight tabular-nums whitespace-nowrap">
                                    {priceNum.toLocaleString('vi-VN')}
                                    <span className="text-xs font-semibold text-slate-400 ml-1">VND</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mô tả chi tiết */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>Mô tả chi tiết</span>
                        </h4>
                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                            {item.description?.trim() ||
                                `Dịch vụ cao cấp chuẩn ${starCount} sao được chuẩn bị tỉ mỉ và phục vụ trực tiếp tận phòng cho quý khách lưu trú tại ${hotelName}.`}
                        </p>
                    </div>

                    {/* Thành phần / Hạng mục bao gồm */}
                    <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-2.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                            <span>
                                {ingredientItems.length > 0
                                    ? meta.ingredientsTitle
                                    : 'Tiêu chuẩn & Quyền lợi đi kèm'}
                            </span>
                        </h4>

                        {ingredientItems.length > 0 ? (
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {ingredientItems.map((entry, idx) => (
                                    <li
                                        key={idx}
                                        className="flex items-start gap-2 text-xs sm:text-[13px] text-slate-700 leading-snug bg-white px-3 py-2 rounded-xl border border-slate-200/70"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                                        <span>{entry}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <ul className="space-y-2">
                                {meta.defaultHighlights.map((point, idx) => (
                                    <li
                                        key={idx}
                                        className="flex items-start gap-2 text-xs sm:text-[13px] text-slate-600 leading-relaxed"
                                    >
                                        <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                                        <span>{point}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Lưu ý thanh toán & ghi chú */}
                    <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-sky-50/60 border border-sky-200/70 text-xs text-slate-700">
                        <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5 leading-relaxed">
                            <p className="font-semibold text-slate-800">
                                Hỗ trợ tùy chỉnh ghi chú & hẹn giờ phục vụ
                            </p>
                            <p className="text-[11px] sm:text-xs text-slate-600 flex items-center gap-1.5 flex-wrap">
                                <Receipt className="w-3.5 h-3.5 text-sky-600 inline shrink-0" />
                                <span>
                                    Quý khách có thể ghi chú khẩu vị, dị ứng thực phẩm hoặc hẹn giờ giao ở bước xác nhận. Chi phí sẽ được gộp tiện lợi vào hóa đơn phòng khi Check-out.
                                </span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* STICKY FOOTER ACTIONS */}
                <div className="px-4 py-3.5 sm:px-6 sm:py-4 bg-white border-t border-slate-200/80 shrink-0 space-y-3">
                    {showCartControls && (
                        <div className="flex items-center justify-between gap-3">
                            {/* Bộ chọn số lượng */}
                            <div className="flex items-center gap-2.5">
                                <span className="text-xs font-bold text-slate-600">Số lượng</span>
                                <div className="inline-flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                                        aria-label="Giảm số lượng"
                                        className="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-slate-200/70 transition cursor-pointer"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="w-9 text-center text-sm font-black text-slate-900 tabular-nums">
                                        {qty}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setQty((prev) => Math.min(99, prev + 1))}
                                        aria-label="Tăng số lượng"
                                        className="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-slate-200/70 transition cursor-pointer"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Tạm tính */}
                            <div className="text-right">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Tạm tính
                                </span>
                                <span className="text-base sm:text-lg font-black text-sky-700 tabular-nums">
                                    {priceNum === 0 ? 'Miễn phí' : `${subtotal.toLocaleString('vi-VN')} đ`}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className={`grid gap-2.5 ${showCartControls ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {showCartControls && (
                            <button
                                type="button"
                                onClick={() => {
                                    onAddToCart(item, qty);
                                    onClose?.();
                                }}
                                className="h-11 px-4 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-300 text-sky-900 text-xs sm:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-2xs active:scale-[0.98]"
                            >
                                <ShoppingBag className="w-4 h-4 text-sky-600 shrink-0" />
                                <span>Thêm vào giỏ</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => {
                                onOrderNow?.(item, qty);
                                onClose?.();
                            }}
                            className="h-11 px-4 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white text-xs sm:text-sm font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-[0_8px_20px_-6px_rgba(2,132,199,0.45)] ring-1 ring-inset ring-white/20 active:scale-[0.98]"
                        >
                            {showCartControls ? (
                                <>
                                    <Zap className="w-4 h-4 text-amber-200 fill-amber-200 shrink-0" />
                                    <span>{primaryActionLabel}</span>
                                </>
                            ) : (
                                <>
                                    <span>{primaryActionLabel}</span>
                                    <ArrowRight className="w-4 h-4 shrink-0" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

