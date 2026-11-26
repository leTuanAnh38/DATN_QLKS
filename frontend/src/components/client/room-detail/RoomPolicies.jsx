import React, { useState } from 'react';
import {
    ShieldCheck,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    Clock,
    AlertCircle,
    RotateCcw
} from 'lucide-react';

// Phân tích chính sách hủy phòng thành từng điều khoản trực quan (giữ nguyên export cho các file khác dùng chung)
export const parseCancellationPolicy = (rawText) => {
    const defaultText =
        '• Miễn phí hủy phòng trước 48 giờ so với giờ nhận phòng (14:00 ngày Check-in).\n• Hủy phòng trong vòng 24 - 48 giờ: Phí hủy tương đương 50% tiền phòng đêm đầu tiên.\n• Hủy phòng trong vòng dưới 24 giờ hoặc không đến nhận phòng (No-show): Phí hủy tương đương 100% tiền phòng đêm đầu tiên.\n• Hỗ trợ dời ngày miễn phí 01 lần nếu thông báo trước 24 giờ (tùy thuộc vào tình trạng phòng khả dụng).';
    const text = (rawText || defaultText).trim();
    return text
        .split('\n')
        .map((l) => l.replace(/^[•\-\*]\s*/, '').trim())
        .filter(Boolean);
};

// Gán nhãn và mã màu phân loại theo mức độ phạt hủy
export const getPolicyBadge = (line) => {
    const lower = line.toLowerCase();
    if (lower.includes('miễn phí hủy') || lower.includes('trước 48')) {
        return {
            label: 'Miễn phí hủy',
            badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
            dotClass: 'bg-emerald-500'
        };
    }
    if (lower.includes('50%')) {
        return {
            label: 'Phí 50%',
            badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
            dotClass: 'bg-amber-500'
        };
    }
    if (lower.includes('100%') || lower.includes('no-show') || lower.includes('không đến')) {
        return {
            label: 'Phí 100%',
            badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
            dotClass: 'bg-rose-500'
        };
    }
    if (lower.includes('dời ngày') || lower.includes('đổi lịch')) {
        return {
            label: 'Dời ngày linh hoạt',
            badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
            dotClass: 'bg-sky-500'
        };
    }
    return {
        label: 'Quy định lưu trú',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200/80',
        dotClass: 'bg-slate-400'
    };
};

export default function RoomPolicies({
    room,
    settings = {}
}) {
    const [showDetailedRules, setShowDetailedRules] = useState(false);

    if (!room) return null;

    const checkInTime = settings?.check_in_time || '14:00';
    const checkOutTime = settings?.check_out_time || '12:00';
    const freeHours = Number(settings?.cancellation_free_hours) || 48;
    const rawPolicies = parseCancellationPolicy(room.cancellation_policy);

    return (
        <section className="bg-[#f4f7fc] rounded-3xl p-6 sm:p-8 border border-slate-200/70">
            {/* Header gọn gàng theo đúng mẫu */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0" />
                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                        Chính sách nhận &amp; trả phòng minh bạch
                    </h3>
                </div>

                <button
                    type="button"
                    onClick={() => setShowDetailedRules((prev) => !prev)}
                    className="self-start sm:self-auto inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 transition cursor-pointer"
                >
                    <span>{showDetailedRules ? 'Thu gọn điều khoản' : 'Xem chi tiết biểu phí hủy'}</span>
                    {showDetailedRules ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                    )}
                </button>
            </div>

            {/* 3 Cột thông số thoáng sạch (Nhận/Trả xếp 2 cột trên mobile để tiết kiệm chiều cao) */}
            <div className="mt-5 sm:mt-6 grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-8">
                {/* Cột 1: Nhận phòng */}
                <div>
                    <span className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                        THỜI GIAN NHẬN PHÒNG
                    </span>
                    <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
                        {checkInTime}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Hỗ trợ nhận sớm theo tình trạng phòng
                    </p>
                </div>

                {/* Cột 2: Trả phòng */}
                <div>
                    <span className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                        THỜI GIAN TRẢ PHÒNG
                    </span>
                    <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
                        {checkOutTime}
                    </div>
                    <p className="text-xs font-semibold text-blue-600 mt-1 leading-relaxed">
                        Hội viên Club được trễ tới 16:00
                    </p>
                </div>

                {/* Cột 3: Chính sách hủy */}
                <div className="col-span-2 md:col-span-1 pt-3 md:pt-0 border-t md:border-t-0 border-slate-200/70">
                    <span className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                        CHÍNH SÁCH HỦY PHÒNG
                    </span>
                    <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
                        Linh hoạt {freeHours}h
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Miễn phí hủy trước {freeHours} giờ nhận phòng
                    </p>
                </div>
            </div>

            {/* Khung chi tiết điều khoản hủy & dời ngày (Mở rộng khi khách bấm xem thêm) */}
            {showDetailedRules && (
                <div className="mt-6 pt-5 border-t border-slate-200/80 space-y-2.5 animate-fadeIn">
                    {rawPolicies.map((line, idx) => {
                        const badge = getPolicyBadge(line);
                        const lower = line.toLowerCase();
                        const IconComp = lower.includes('miễn phí hủy')
                            ? CheckCircle2
                            : lower.includes('dời ngày') || lower.includes('đổi lịch')
                                ? RotateCcw
                                : lower.includes('100%') || lower.includes('no-show')
                                    ? AlertCircle
                                    : Clock;

                        return (
                            <div
                                key={idx}
                                className="flex items-start gap-2.5 bg-white/85 rounded-xl px-3.5 py-2.5 border border-slate-200/70 text-xs text-slate-600"
                            >
                                <IconComp className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                                <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                    <span className="leading-relaxed">{line}</span>
                                    <span
                                        className={`self-start sm:self-auto px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${badge.badgeClass}`}
                                    >
                                        {badge.label}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
