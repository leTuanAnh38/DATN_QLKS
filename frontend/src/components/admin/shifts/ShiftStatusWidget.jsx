import React from 'react';
import {
    Clock,
    Banknote,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    Printer,
    LogOut,
    PlusCircle,
    Coins,
    CreditCard,
    ShieldCheck
} from 'lucide-react';
import { authStore } from '../../../store/authStore';

export default function ShiftStatusWidget({
    activeShift,
    isLoading,
    onOpenShift,
    onCloseShift,
    onViewZReport
}) {
    const formatCurrency = (val) => {
        const num = Number(val) || 0;
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
    };

    const formatDateTime = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' +
            d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    };

    if (isLoading) {
        return (
            <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between animate-pulse">
                <div className="h-6 w-48 bg-slate-200 rounded-lg" />
                <div className="h-8 w-28 bg-slate-200 rounded-xl" />
            </div>
        );
    }

    // Lấy thông tin user đăng nhập hiện tại
    const currentUser = authStore.getUser();
    const isManagerRole = Boolean(
        currentUser?.role === 'admin' ||
        currentUser?.role === 'owner' ||
        currentUser?.role === 'manager' ||
        currentUser?.is_superuser
    );

    // Trường hợp 1: Chưa mở ca
    if (!activeShift) {
        return (
            <div className="bg-white px-5 py-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 border border-slate-200">
                        <Clock className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                                {isManagerRole ? 'Quầy Thu Ngân Hiện Chưa Có Ca Trực Nào Mở' : 'Chưa Có Ca Làm Việc Nào Đang Mở'}
                            </h3>
                            <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                {isManagerRole ? 'Trống ca trực' : 'Cần mở ca'}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            {isManagerRole
                                ? 'Hiện chưa có nhân viên nào mở ca trực tại quầy. Bạn có thể mở ca trực tiếp hoặc đợi nhân viên nhận ca.'
                                : 'Mở ca trực để quản lý quỹ tiền mặt thối ban đầu, ghi nhận thu chi và kết xuất báo cáo Z-Report khi bàn giao.'
                            }
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onOpenShift}
                    className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-emerald-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                >
                    <PlusCircle className="w-4 h-4" />
                    <span>Mở Ca Trực Thu Ngân</span>
                </button>
            </div>
        );
    }

    // Trường hợp 2: Đang có ca trực hoạt động (Thiết kế thanh ngang trắng gọn gàng, tiết kiệm diện tích)
    const summary = activeShift.realtime_summary || activeShift.current_summary || {};
    const openingCash = Number(summary.opening_cash ?? activeShift.opening_cash ?? 0);
    const cashIn = Number(summary.cash_in ?? summary.total_cash_in ?? activeShift.total_cash_in ?? 0);
    const cashOut = Number(summary.cash_out ?? summary.total_cash_out ?? activeShift.total_cash_out ?? 0);
    const expectedCash = Number(summary.expected_cash ?? (openingCash + cashIn - cashOut));
    const transferIn = Number(summary.transfer_in ?? summary.total_transfer_in ?? activeShift.total_transfer_in ?? 0);
    const cardIn = Number(summary.card_in ?? summary.total_card_in ?? activeShift.total_card_in ?? 0);

    const isSupervisorView = Boolean(activeShift.is_manager_view && !activeShift.is_own_shift);

    return (
        <div className="bg-white px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            {/* 1. Thông tin ca trực */}
            <div className="flex items-center gap-3 shrink-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                    isSupervisorView
                        ? 'bg-blue-50 text-blue-600 border-blue-200'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                }`}>
                    <Clock className="w-4 h-4" />
                </div>
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-900">
                            {activeShift.shift_type_display || activeShift.shift_type}
                        </span>
                        <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
                            #{activeShift.shift_code}
                        </span>
                        {isSupervisorView ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                Giám sát quầy trực
                            </span>
                        ) : activeShift.is_own_shift ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Ca trực của bạn
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.2 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                                Ca quầy đang trực
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                        {activeShift.is_own_shift
                            ? <>Thu ngân: <span className="text-slate-800 font-semibold">Bạn ({activeShift.user_name})</span></>
                            : <>Trực quầy: <span className="text-slate-800 font-semibold">{activeShift.user_name || 'Thu ngân'}</span></>
                        }
                        {' • '}Mở: {formatDateTime(activeShift.opened_at)}
                    </p>
                </div>
            </div>

            {/* 2. Dòng tiền tóm tắt thời gian thực (Gọn nhẹ trên 1 hàng) */}
            <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-1 xl:py-0 text-xs border-y xl:border-y-0 xl:border-x border-slate-100 xl:px-4">
                <div className="whitespace-nowrap">
                    <span className="text-slate-400 text-[11px] block">Tiền đầu ca:</span>
                    <span className="font-mono font-bold text-slate-800">{formatCurrency(openingCash)}</span>
                </div>
                <div className="text-slate-300 hidden sm:block">|</div>
                <div className="whitespace-nowrap">
                    <span className="text-slate-400 text-[11px] block">Thu tiền mặt:</span>
                    <span className="font-mono font-bold text-emerald-600">+{formatCurrency(cashIn)}</span>
                </div>
                {cashOut > 0 && (
                    <>
                        <div className="text-slate-300 hidden sm:block">|</div>
                        <div className="whitespace-nowrap">
                            <span className="text-slate-400 text-[11px] block">Chi tiền mặt:</span>
                            <span className="font-mono font-bold text-rose-600">-{formatCurrency(cashOut)}</span>
                        </div>
                    </>
                )}
                <div className="text-slate-300 hidden sm:block">|</div>
                <div className="whitespace-nowrap px-2.5 py-1 rounded-xl bg-emerald-50/80 border border-emerald-200/60">
                    <span className="text-emerald-700 text-[11px] font-semibold block">Tiền trong két:</span>
                    <span className="font-mono font-black text-emerald-700 text-sm">{formatCurrency(expectedCash)}</span>
                </div>
                <div className="text-slate-300 hidden sm:block">|</div>
                <div className="whitespace-nowrap">
                    <span className="text-slate-400 text-[11px] block">VietQR & Thẻ:</span>
                    <span className="font-mono font-bold text-blue-600">{formatCurrency(transferIn + cardIn)}</span>
                </div>
            </div>

            {/* 3. Nút hành động */}
            <div className="flex items-center gap-2 shrink-0 self-end xl:self-auto">
                <button
                    type="button"
                    onClick={() => onViewZReport(activeShift.id)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                    title="Xem trước tình hình ca & báo cáo Z-Report"
                >
                    <Printer className="w-3.5 h-3.5 text-blue-600" />
                    <span>Z-Report</span>
                </button>

                {/* Chỉ người mở ca hoặc Quản lý / Admin mới có quyền bấm Kết ca bàn giao */}
                {(activeShift.is_own_shift || isManagerRole) ? (
                    <button
                        type="button"
                        onClick={() => onCloseShift(activeShift)}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                        title={isManagerRole && !activeShift.is_own_shift ? "Quyền Quản lý: Can thiệp đóng ca quầy" : "Kiểm đếm tiền két và bàn giao ca làm việc"}
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>{isManagerRole && !activeShift.is_own_shift ? "Đóng Ca (Quản lý)" : "Kết Ca Bàn Giao"}</span>
                    </button>
                ) : (
                    <span className="text-[11px] text-slate-400 italic px-2 py-1 bg-slate-50 rounded-lg border border-slate-200">
                        {activeShift.user_name || 'Thu ngân'} phụ trách kết ca
                    </span>
                )}
            </div>
        </div>
    );
}
