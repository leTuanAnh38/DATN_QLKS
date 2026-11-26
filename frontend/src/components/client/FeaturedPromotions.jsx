import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Gift,
    Copy,
    Check,
    ArrowRight,
    Calendar
} from 'lucide-react';
import { promotionService } from '../../services/promotionService';
import Reveal from '../common/Reveal';
import { useInViewOnce } from '../../hooks/useMotion';

const FALLBACK_HOME_PROMOS = [
    {
        id: 1,
        code: 'WELCOME10',
        name: 'Ưu đãi Chào mừng Khách mới',
        discount_type: 'percentage',
        discount_value: 10,
        min_order_value: 1500000,
        max_discount_amount: 500000,
        valid_to: '2026-12-31T23:59:59Z',
        usage_limit: 500,
        used_count: 128,
        is_active: true
    },
    {
        id: 2,
        code: 'SUMMER2026',
        name: 'Tuyệt tác Nghỉ Dưỡng Mùa Lễ Hội 2026',
        discount_type: 'percentage',
        discount_value: 15,
        min_order_value: 2000000,
        max_discount_amount: 800000,
        valid_to: '2026-12-31T23:59:59Z',
        usage_limit: 200,
        used_count: 85,
        is_active: true
    },
    {
        id: 3,
        code: 'VIP10',
        name: 'Đặc quyền Thành viên TA Club',
        discount_type: 'percentage',
        discount_value: 10,
        min_order_value: 0,
        max_discount_amount: null,
        valid_to: '2026-12-31T23:59:59Z',
        usage_limit: 1000,
        used_count: 312,
        is_active: true
    },
    {
        id: 4,
        code: 'TADANANG',
        name: 'Tri ân Kỳ nghỉ Biển Đà Nẵng',
        discount_type: 'fixed',
        discount_value: 300000,
        min_order_value: 3000000,
        max_discount_amount: null,
        valid_to: '2026-12-31T23:59:59Z',
        usage_limit: 150,
        used_count: 64,
        is_active: true
    }
];

const formatDate = (dateStr) => {
    if (!dateStr) return '31/12/2026';
    try {
        return new Date(dateStr).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return '31/12/2026';
    }
};

export default function FeaturedPromotions() {
    const navigate = useNavigate();
    const [promotions, setPromotions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copiedCode, setCopiedCode] = useState(null);
    const [promosGridRef, promosGridVisible] = useInViewOnce({ threshold: 0.08 });

    useEffect(() => {
        const fetchPromos = async () => {
            try {
                setLoading(true);
                const res = await promotionService.getPromotions();
                if (res.success && Array.isArray(res.data) && res.data.length > 0) {
                    const activeList = res.data.filter((p) => p.is_active !== false);
                    setPromotions(activeList.length > 0 ? activeList : res.data);
                } else {
                    setPromotions(FALLBACK_HOME_PROMOS);
                }
            } catch {
                setPromotions(FALLBACK_HOME_PROMOS);
            } finally {
                setLoading(false);
            }
        };

        fetchPromos();
    }, []);

    const displayPromos =
        promotions.length > 0 ? promotions.slice(0, 4) : FALLBACK_HOME_PROMOS;

    const handleCopyCode = (code) => {
        if (!code) return;
        try {
            navigator.clipboard.writeText(code);
        } catch {
            // fallback
        }
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2500);
    };

    const handleApplyAndBook = (code) => {
        if (code) {
            try {
                navigator.clipboard.writeText(code);
                sessionStorage.setItem('ta_selected_promo_code', code);
            } catch {
                // ignore
            }
        }
        navigate('/rooms');
    };

    return (
        <section className="py-10 sm:py-18 bg-white border-b border-slate-200/60 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <Reveal className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 mb-5 sm:mb-11">
                    <div className="max-w-2xl">
                        <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-amber-700 mb-3">
                            ƯU ĐÃI ĐẶC QUYỀN
                        </span>
                        <h2 className="text-2xl sm:text-4xl font-serif font-bold text-slate-900 tracking-tight leading-tight">
                            Ưu Đãi Đặt Phòng{' '}
                            <span className="bg-gradient-to-r from-slate-900 via-amber-800 to-amber-600 bg-clip-text text-transparent">
                                Độc Quyền Hôm Nay
                            </span>
                        </h2>
                        <p className="text-slate-600 text-sm sm:text-base mt-2.5 leading-relaxed">
                            Sao chép mã voucher bên dưới và áp dụng tại bước Thanh toán đặt phòng để hưởng chiết khấu trực tiếp trên website chính thức.
                        </p>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
                        <Link
                            to="/promotions"
                            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-white border border-slate-200 hover:border-sky-300 hover:bg-sky-50/60 text-slate-700 hover:text-sky-700 text-xs sm:text-sm font-bold transition-all shadow-xs whitespace-nowrap group"
                        >
                            <span>Xem tất cả ưu đãi</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <span className="sm:hidden text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                            Vuốt ngang →
                        </span>
                    </div>
                </Reveal>

                {/* Grid Voucher Cards (Ticket Stub Design nổi khối giấy vé trên nền trắng) */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map((n) => (
                            <div
                                key={n}
                                className="h-64 rounded-3xl bg-slate-100 animate-pulse border border-slate-200"
                            />
                        ))}
                    </div>
                ) : (
                    <div
                        ref={promosGridRef}
                        className={`flex sm:grid sm:grid-cols-2 ${
                            displayPromos.length >= 4
                                ? 'lg:grid-cols-4'
                                : 'lg:grid-cols-3'
                        } gap-4 sm:gap-6 overflow-x-auto sm:overflow-visible snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:pb-0 no-scrollbar`}
                    >
                        {displayPromos.map((promo, idx) => {
                            const isPercentage = promo.discount_type === 'percentage';
                            const isCopied = copiedCode === promo.code;

                            return (
                                <div
                                    key={promo.id || promo.code}
                                    className={`${promosGridVisible ? 'reveal-card-in' : 'reveal-card-hidden'} w-[84vw] max-w-[330px] sm:w-auto sm:max-w-none shrink-0 snap-center relative bg-gradient-to-b from-slate-50/85 via-[#fafbfd] to-white rounded-3xl border border-slate-200/90 hover:border-amber-400 p-5 sm:p-6 flex flex-col justify-between shadow-[0_4px_20px_-8px_rgba(15,23,42,0.08)] hover:shadow-[0_18px_40px_-14px_rgba(15,23,42,0.16)] hover:-translate-y-1.5 transition-all duration-300 group overflow-hidden`}
                                    style={promosGridVisible ? { animationDelay: `${idx * 90}ms` } : undefined}
                                >
                                    {/* Răng cưa vé (Perforated ticket cutout circle) nổi rõ tương phản với nền giấy vé */}
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full border border-slate-200/90" />
                                    <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-6 bg-white rounded-full border border-slate-200/90" />
                                    <div className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 bg-white rounded-full border border-slate-200/90" />

                                    {/* Card Header & Discount Value */}
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-3">
                                            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold uppercase tracking-wider">
                                                {isPercentage ? 'Giảm %' : 'Tiền mặt'}
                                            </span>
                                            <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                <span>Hạn: {formatDate(promo.valid_to)}</span>
                                            </span>
                                        </div>

                                        {/* Mức giảm to bản ấn tượng */}
                                        <div className="mb-3">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-rose-600 to-orange-500 tabular-nums">
                                                    {isPercentage
                                                        ? `-${promo.discount_value}%`
                                                        : `-${Number(promo.discount_value).toLocaleString('vi-VN')}đ`}
                                                </span>
                                            </div>
                                            <h3 className="text-sm font-bold text-slate-900 line-clamp-1 mt-1 group-hover:text-amber-700 transition-colors">
                                                {promo.name || `Khuyến mãi ${promo.code}`}
                                            </h3>
                                        </div>

                                        {/* Điều kiện áp dụng */}
                                        <div className="space-y-1.5 text-[11px] text-slate-600 border-t border-slate-100 pt-3 mb-4">
                                            {Number(promo.min_order_value) > 0 ? (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Đơn tối thiểu:</span>
                                                    <strong className="text-slate-900 font-semibold tabular-nums">
                                                        {Number(promo.min_order_value).toLocaleString('vi-VN')} đ
                                                    </strong>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Đơn tối thiểu:</span>
                                                    <strong className="text-emerald-600 font-bold">
                                                        Không giới hạn
                                                    </strong>
                                                </div>
                                            )}

                                            {isPercentage && Number(promo.max_discount_amount) > 0 ? (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Giảm tối đa:</span>
                                                    <strong className="text-slate-900 font-semibold tabular-nums">
                                                        {Number(promo.max_discount_amount).toLocaleString('vi-VN')} đ
                                                    </strong>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Áp dụng:</span>
                                                    <strong className="text-slate-800 font-semibold">
                                                        Mọi hạng phòng
                                                    </strong>
                                                </div>
                                            )}

                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Lượt đã dùng:</span>
                                                <span className="text-amber-700 font-bold tabular-nums">
                                                    {promo.used_count || 0}/{promo.usage_limit || 100}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Coupon Code Block & Action Buttons */}
                                    <div className="pt-2">
                                        <div className="flex items-center justify-between gap-2 bg-amber-50/80 border border-dashed border-amber-300 rounded-2xl px-3.5 py-2.5 mb-3">
                                            <div className="min-w-0">
                                                <span className="text-[9px] uppercase tracking-wider text-amber-800 block font-bold">
                                                    Mã Voucher:
                                                </span>
                                                <span className="font-mono text-sm font-extrabold text-amber-900 tracking-wider truncate block">
                                                    {promo.code}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyCode(promo.code)}
                                                className={`shrink-0 min-h-[40px] px-3 py-2 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer flex items-center gap-1 text-xs font-bold ${
                                                    isCopied
                                                        ? 'bg-emerald-600 text-white shadow-xs scale-[1.03]'
                                                        : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-200'
                                                }`}
                                                title="Sao chép mã voucher"
                                            >
                                                {isCopied ? (
                                                    <>
                                                        <Check className="w-3.5 h-3.5" />
                                                        <span className="text-[10px]">Đã chép</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-3.5 h-3.5" />
                                                        <span className="text-[10px]">Chép</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleApplyAndBook(promo.code)}
                                            className="btn-luxury-shine group/btn w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 hover:-translate-y-0.5 active:scale-95 text-white font-bold text-xs shadow-[0_8px_20px_-6px_rgba(2,132,199,0.45)] hover:shadow-[0_12px_24px_-6px_rgba(2,132,199,0.55)] ring-1 ring-inset ring-white/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                        >
                                            <span>Sử Dụng Ngay</span>
                                            <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
