import React from 'react';
import {
    ShieldCheck,
    Star,
    Clock,
    ClipboardList,
    CheckCircle2,
    AlertCircle,
    RotateCcw
} from 'lucide-react';

// Phân tích chính sách hủy phòng thành từng điều khoản trực quan
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
    settings = {},
    starCount = 3
}) {
    if (!room) return null;

    const finalStarCount = starCount || settings?.stars || 3;
    const rawPolicies = parseCancellationPolicy(room.cancellation_policy);

    // Bóc tách các mốc chính sách hủy & hoàn tiền
    const freePolicy = rawPolicies.find(
        (l) => l.toLowerCase().includes('miễn phí') || l.toLowerCase().includes('trước 48')
    ) || 'Miễn phí hủy phòng trước 48 giờ so với giờ nhận phòng (14:00 ngày Check-in).';

    const halfPolicy = rawPolicies.find((l) => l.toLowerCase().includes('50%')) ||
        'Hủy phòng trong vòng 24 - 48 giờ: Phí hủy tương đương 50% tiền phòng đêm đầu tiên.';

    const fullPolicy = rawPolicies.find(
        (l) => l.toLowerCase().includes('100%') || l.toLowerCase().includes('no-show') || l.toLowerCase().includes('dưới 24')
    ) || 'Hủy phòng trong vòng dưới 24 giờ hoặc vắng mặt (No-show): Phí hủy tương đương 100% tiền phòng đêm đầu tiên.';

    const reschedulePolicy = rawPolicies.find(
        (l) => l.toLowerCase().includes('dời ngày') || l.toLowerCase().includes('đổi lịch')
    ) || 'Hỗ trợ dời ngày miễn phí 01 lần nếu thông báo trước 24 giờ (tùy thuộc vào tình trạng phòng khả dụng).';

    // Các điều khoản bổ sung khác nếu có
    const extraPolicies = rawPolicies.filter(
        (l) =>
            l !== freePolicy &&
            l !== halfPolicy &&
            l !== fullPolicy &&
            l !== reschedulePolicy
    );

    return (
        <div className="bg-white p-4 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-5 sm:space-y-6">
            {/* Header chính sách */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/70 text-amber-600 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-amber-600 block">
                            Quy định & Quyền lợi lưu trú
                        </span>
                        <h3 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                            Chính sách nhận, trả phòng & bảo đảm quyền lợi
                        </h3>
                    </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 self-start sm:self-auto shrink-0 shadow-2xs">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>Tiêu chuẩn {finalStarCount} sao quốc tế</span>
                </span>
            </div>

            {/* 2 Khối Nhận phòng & Trả phòng */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs">
                {/* Nhận phòng */}
                <div className="p-4 sm:p-5 bg-gradient-to-br from-emerald-50/40 via-white to-slate-50/50 rounded-2xl border border-emerald-100 hover:border-emerald-200 transition shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                            Nhận phòng (Check-in)
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <div className="text-xl sm:text-2xl font-bold font-serif text-slate-900 tracking-tight">
                            Từ {settings?.check_in_time || '14:00'}
                        </div>
                        <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                            Hỗ trợ nhận phòng sớm miễn phí tùy theo tình trạng phòng trống lúc đến.
                        </p>
                    </div>
                </div>

                {/* Trả phòng */}
                <div className="p-4 sm:p-5 bg-gradient-to-br from-amber-50/40 via-white to-slate-50/50 rounded-2xl border border-amber-100 hover:border-amber-200 transition shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-full border border-amber-200/60">
                            Trả phòng (Check-out)
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <div className="text-xl sm:text-2xl font-bold font-serif text-slate-900 tracking-tight">
                            Trước {settings?.check_out_time || '12:00'}
                        </div>
                        <p className="text-amber-800 font-medium text-xs mt-1 leading-relaxed">
                            Hội viên VIP được ưu tiên hỗ trợ check-out trễ linh hoạt đến 16:00.
                        </p>
                    </div>
                </div>
            </div>

            {/* Chi tiết chính sách hủy phòng theo dạng Timeline Stepper trực quan */}
            <div className="bg-slate-50/70 rounded-2xl border border-slate-200/80 p-3.5 sm:p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                        <ClipboardList className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Chính sách hủy phòng & hoàn tiền trực quan</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                        Áp dụng cho hạng phòng này
                    </span>
                </div>

                {/* 3 Mốc thời gian hủy phòng dạng Timeline Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
                    {/* Mốc 1: Trước 48h - Miễn phí */}
                    <div className="p-3.5 bg-white rounded-xl border border-emerald-200/80 border-l-4 border-l-emerald-500 shadow-2xs flex flex-col justify-between space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>Trước 48 giờ</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase shrink-0">
                                Miễn phí 100%
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-normal">
                            {freePolicy}
                        </p>
                        <div className="text-[10px] text-emerald-700 font-semibold pt-1 border-t border-emerald-100/60 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Hoàn trả toàn bộ tiền cọc</span>
                        </div>
                    </div>

                    {/* Mốc 2: 24h - 48h - Phí 50% */}
                    <div className="p-3.5 bg-white rounded-xl border border-amber-200/80 border-l-4 border-l-amber-500 shadow-2xs flex flex-col justify-between space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>Từ 24h - 48 giờ</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase shrink-0">
                                Phí hủy 50%
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-normal">
                            {halfPolicy}
                        </p>
                        <div className="text-[10px] text-amber-700 font-semibold pt-1 border-t border-amber-100/60 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span>Thu 50% tiền phòng đêm đầu</span>
                        </div>
                    </div>

                    {/* Mốc 3: Dưới 24h & No-show - Phí 100% */}
                    <div className="p-3.5 bg-white rounded-xl border border-rose-200/80 border-l-4 border-l-rose-500 shadow-2xs flex flex-col justify-between space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>Dưới 24h / No-show</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black uppercase shrink-0">
                                Phí hủy 100%
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-normal">
                            {fullPolicy}
                        </p>
                        <div className="text-[10px] text-rose-700 font-semibold pt-1 border-t border-rose-100/60 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            <span>Thu 100% tiền phòng đêm đầu</span>
                        </div>
                    </div>
                </div>

                {/* Hộp đặc quyền dời ngày lưu trú miễn phí */}
                <div className="p-3.5 bg-sky-50/80 rounded-xl border border-sky-200/90 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <RotateCcw className="w-3.5 h-3.5" />
                    </div>
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-sky-950">
                                Đặc quyền dời ngày lưu trú linh hoạt:
                            </span>
                            <span className="px-2 py-0.2 rounded-full bg-sky-100 text-sky-800 border border-sky-200 text-[9px] font-black uppercase">
                                Miễn phí 01 lần
                            </span>
                        </div>
                        <p className="text-xs text-sky-800 leading-relaxed font-normal">
                            {reschedulePolicy}
                        </p>
                    </div>
                </div>

                {/* Các điều khoản bổ sung khác nếu admin cấu hình thêm */}
                {extraPolicies.length > 0 && (
                    <div className="pt-2 space-y-2 border-t border-slate-200/60">
                        {extraPolicies.map((line, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                                <span className="text-amber-500 font-bold">•</span>
                                <span>{line}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

