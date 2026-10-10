import React from 'react';
import { Award, Sparkles, ChevronRight, Zap, ShieldCheck, Gift, CheckCircle2 } from 'lucide-react';

export default function MembershipCard({ user }) {
    if (!user) return null;

    // Lấy thông tin Hạng thẻ hiện tại và điểm
    const currentTier = user.current_tier || {
        name: user.guest_profile?.vip_tier || 'Đồng (Bronze)',
        code: 'BRONZE',
        min_points: 0,
        discount_percent: 0,
        badge_color: 'from-amber-700 via-amber-800 to-amber-950',
    };

    const totalPoints = Number(user.total_points ?? user.guest_profile?.loyalty_points ?? 0);
    const nextTier = user.next_tier_info;

    // Tính % hoàn thành của thanh tiến trình
    const calculateProgress = () => {
        if (!nextTier) return 100;
        const currentMin = currentTier.min_points || 0;
        const nextMin = nextTier.min_points || 100;
        if (nextMin <= currentMin) return 100;
        const progress = ((totalPoints - currentMin) / (nextMin - currentMin)) * 100;
        return Math.min(Math.max(Math.round(progress), 8), 100);
    };

    // Định dạng giao diện thẻ ATM theo từng hạng
    const getCardTheme = (code) => {
        const c = String(code || '').toUpperCase();
        if (c.includes('DIAMOND') || c.includes('KIM CƯƠNG')) {
            return {
                bg: 'bg-gradient-to-tr from-slate-950 via-cyan-900 to-indigo-950 border-cyan-400/40 text-cyan-50 shadow-cyan-950/50',
                chip: 'from-cyan-200 to-cyan-400 border-cyan-300',
                badgeBg: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/30',
                glow: 'bg-cyan-400/20',
                tierLabel: 'DIAMOND MEMBER',
                discountColor: 'text-cyan-300'
            };
        }
        if (c.includes('GOLD') || c.includes('VÀNG')) {
            return {
                bg: 'bg-gradient-to-tr from-amber-700 via-amber-500 to-yellow-600 border-amber-300/50 text-amber-50 shadow-amber-950/50',
                chip: 'from-yellow-200 to-amber-300 border-yellow-300',
                badgeBg: 'bg-amber-900/30 text-yellow-200 border-yellow-300/40',
                glow: 'bg-yellow-300/20',
                tierLabel: 'GOLD MEMBER',
                discountColor: 'text-yellow-200'
            };
        }
        if (c.includes('SILVER') || c.includes('BẠC')) {
            return {
                bg: 'bg-gradient-to-tr from-slate-700 via-gray-600 to-slate-900 border-slate-300/40 text-slate-100 shadow-slate-950/50',
                chip: 'from-slate-200 to-gray-300 border-slate-300',
                badgeBg: 'bg-white/15 text-slate-100 border-white/20',
                glow: 'bg-white/15',
                tierLabel: 'SILVER MEMBER',
                discountColor: 'text-slate-200'
            };
        }
        // Mặc định: Bronze (Đồng)
        return {
            bg: 'bg-gradient-to-tr from-amber-900 via-stone-800 to-orange-950 border-amber-600/40 text-amber-100 shadow-orange-950/50',
            chip: 'from-amber-300 to-orange-400 border-amber-400',
            badgeBg: 'bg-amber-500/20 text-amber-200 border-amber-500/30',
            glow: 'bg-amber-500/15',
            tierLabel: 'BRONZE MEMBER',
            discountColor: 'text-amber-300'
        };
    };

    const theme = getCardTheme(currentTier.code || currentTier.name);
    const progressPercent = calculateProgress();

    return (
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-100 relative overflow-hidden mb-8 sm:mb-10">
            {/* Tiêu đề Box */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-slate-100 mb-6">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                            <Award className="w-5 h-5" />
                        </span>
                        <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900">
                            Thẻ Khách Hàng Thân Thiết (Loyalty Club)
                        </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Tích 1 điểm cho mỗi 100.000 VNĐ thanh toán thành công. Tự động thăng hạng thẻ và nhận chiết khấu phòng.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100/70 text-amber-800 border border-amber-200">
                        <Sparkles className="w-3.5 h-3.5" />
                        Ưu đãi -{currentTier.discount_percent}% phòng
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-center">
                {/* 1. THẺ THÀNH VIÊN ẢO (VIRTUAL ATM MEMBERSHIP CARD) */}
                <div className="lg:col-span-5 flex justify-center">
                    <div
                        className={`w-full max-w-[370px] h-[225px] rounded-2xl p-6 ${theme.bg} border shadow-2xl relative flex flex-col justify-between overflow-hidden select-none transition-all duration-300 hover:scale-[1.02] hover:shadow-3xl`}
                    >
                        {/* Hiệu ứng tia sáng phản quang kim loại */}
                        <div className={`absolute -right-16 -top-16 w-52 h-52 rounded-full blur-3xl pointer-events-none ${theme.glow}`} />
                        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

                        {/* Top: Hotel Brand & Tier Badge */}
                        <div className="flex justify-between items-start z-10">
                            <div>
                                <span className="text-[10px] tracking-[0.25em] font-extrabold uppercase opacity-85 block text-white/90">
                                    HOTEL LUXURY RESORT
                                </span>
                                <h3 className="text-base font-black tracking-wider flex items-center gap-1.5 mt-0.5 uppercase drop-shadow-sm">
                                    <Sparkles className="w-4 h-4 text-yellow-300" />
                                    {currentTier.name}
                                </h3>
                            </div>

                            {/* Chip ATM giả lập mạ kim loại */}
                            <div className="flex items-center gap-2">
                                <div className={`w-11 h-8 rounded-md bg-gradient-to-tr ${theme.chip} border flex items-center justify-center shadow-md relative overflow-hidden`}>
                                    <div className="w-7 h-5 border border-black/20 rounded-xs grid grid-cols-2 gap-0.5 p-0.5">
                                        <div className="bg-black/10 rounded-xs" />
                                        <div className="bg-black/10 rounded-xs" />
                                    </div>
                                </div>
                                {/* Biểu tượng sóng Contactless */}
                                <div className="text-white/60">
                                    <svg className="w-5 h-5 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 2a10 10 0 0 1 10 10" />
                                        <path d="M12 6a6 6 0 0 1 6 6" />
                                        <path d="M12 10a2 2 0 0 1 2 2" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Middle: Điểm tích lũy & Mã thẻ dập nổi */}
                        <div className="my-auto z-10">
                            <div className="flex justify-between items-end">
                                <div>
                                    <span className="text-[10px] uppercase tracking-widest opacity-75 block">
                                        Tổng điểm tích lũy
                                    </span>
                                    <div className="text-3xl font-black tracking-tight flex items-baseline gap-1.5">
                                        {totalPoints.toLocaleString('vi-VN')}
                                        <span className="text-xs font-semibold tracking-wider opacity-80">PTS</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border backdrop-blur-md ${theme.badgeBg}`}>
                                        Giảm {currentTier.discount_percent}% giá phòng
                                    </span>
                                </div>
                            </div>
                            <div className="font-mono text-[11px] tracking-[0.25em] opacity-60 mt-1">
                                TA-{String(user.id || '0001').padStart(4, '0')} •••• {new Date().getFullYear()}
                            </div>
                        </div>

                        {/* Bottom: Tên chủ thẻ & Loại thẻ */}
                        <div className="flex justify-between items-end z-10 border-t border-white/20 pt-2.5">
                            <div>
                                <span className="text-[9px] uppercase tracking-widest opacity-70 block">
                                    Chủ thẻ thành viên
                                </span>
                                <span className="font-bold text-xs sm:text-sm tracking-wider uppercase drop-shadow-sm">
                                    {user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-extrabold tracking-widest opacity-80">
                                    {theme.tierLabel}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. THANH TIẾN TRÌNH & THÔNG TIN LÊN HẠNG KẾ TIẾP */}
                <div className="lg:col-span-7 space-y-5">
                    {/* Hộp tiến trình */}
                    <div className="bg-slate-50/90 rounded-2xl p-5 border border-slate-200/70">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 text-sm">
                                    Cấp bậc hội viên:
                                </span>
                                <span className="font-bold text-amber-600 text-sm">
                                    {currentTier.name}
                                </span>
                            </div>

                            {nextTier ? (
                                <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-800 rounded-full border border-amber-300/60 inline-flex items-center gap-1 self-start sm:self-auto">
                                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                                    Cần thêm {nextTier.points_needed} điểm nữa để thăng hạng {nextTier.name}
                                </span>
                            ) : (
                                <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300 inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Hạng thành viên tối đa (VIP Diamond)
                                </span>
                            )}
                        </div>

                        {/* Thanh Progress Bar */}
                        <div className="w-full bg-slate-200 h-3.5 rounded-full overflow-hidden shadow-inner relative p-0.5">
                            <div
                                className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 h-full rounded-full transition-all duration-700 ease-out shadow-sm"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>

                        {/* Câu thông báo tiến trình nổi bật */}
                        <div className="mt-3 text-xs text-slate-600 leading-relaxed">
                            {nextTier ? (
                                <>
                                    💡 Bạn đang có <strong className="text-slate-900 font-bold">{totalPoints}</strong> điểm. 
                                    Cần thêm <strong className="text-amber-600 font-bold">{nextTier.points_needed}</strong> điểm nữa 
                                    để thăng hạng <strong className="text-amber-700 font-bold">{nextTier.name}</strong> (Hưởng ưu đãi giảm {nextTier.discount_percent}% cho các lần đặt phòng tiếp theo).
                                </>
                            ) : (
                                <>
                                    🎉 Chúc mừng quý khách đã đạt mức điểm cao nhất trong hệ thống và nhận toàn bộ quyền lợi giảm giá 15% trọn đời!
                                </>
                            )}
                        </div>
                    </div>

                    {/* Lưới đặc quyền & Quy tắc */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                                <Zap className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-800">Cơ chế tích điểm 100k = 1 pt</h4>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Cứ mỗi 100.000 VNĐ thanh toán thành công lúc trả phòng sẽ tự động cộng 1 điểm.
                                </p>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-xl border border-slate-200/80 bg-white flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-800">
                                    Giảm trực tiếp {currentTier.discount_percent}% phòng
                                </h4>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Áp dụng tự động trừ vào tổng tiền phòng tại bước xác nhận thanh toán đặt phòng.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
