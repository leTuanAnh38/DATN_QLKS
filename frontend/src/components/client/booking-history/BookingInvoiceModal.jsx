import React from 'react';
import {
    Receipt,
    BedDouble,
    Calendar,
    User,
    Hotel,
    CheckCircle2,
    AlertCircle,
    CreditCard,
    Building2,
    Tag
} from 'lucide-react';
import ModalDialog from '../../common/ModalDialog';
import StatusBadge from '../../common/StatusBadge';

/**
 * Modal xem Hóa đơn chi tiết của từng đơn đặt phòng (tiền phòng, dịch vụ, bồi thường, chiết khấu, cọc & còn lại)
 */
export default function BookingInvoiceModal({
    booking,
    onClose,
    hotelName = 'Khách Sạn TA Đà Nẵng',
    settings = {},
    formatDateDisplay,
    getGroupBookingInfo
}) {
    if (!booking) return null;

    const groupInfo = getGroupBookingInfo ? getGroupBookingInfo(booking) : { isGroup: false };
    const isCancelled = ['cancelled', 'no_show'].includes(booking.status);

    const nights = Math.max(1, Number(booking.nights || 1));
    const roomAmountNum = Number(booking.room_amount ?? booking.total_amount) || 0;
    const grandTotalNum = Number(booking.grand_total_amount ?? booking.total_amount) || 0;
    const paidAmountNum = Number(booking.paid_amount || 0);
    const remainingBalanceNum = Number(
        booking.remaining_balance != null
            ? booking.remaining_balance
            : booking.remaining_amount != null
                ? booking.remaining_amount
                : Math.max(0, grandTotalNum - paidAmountNum)
    );

    const discountAmountNum = Number(booking.discount_amount || 0);
    const tierDiscountAmountNum = Number(booking.tier_discount_amount || 0);
    const totalSavedNum = discountAmountNum + tierDiscountAmountNum;

    const rawServices =
        (Array.isArray(booking.extra_services) && booking.extra_services.length > 0 && booking.extra_services) ||
        (Array.isArray(booking.selected_services) && booking.selected_services.length > 0 && booking.selected_services) ||
        (Array.isArray(booking.service_requests) ? booking.service_requests : []);

    const normalizedServices = rawServices.map((srv, idx) => {
        const cleanName = (srv.service_name || srv.name || `Dịch vụ #${idx + 1}`)
            .replace(/\[Yêu cầu #\d+\]/gi, '')
            .replace(/\(x\d+\)/gi, '')
            .trim();
        const qty = Number(srv.quantity || 1);
        const total = Number(srv.total_price != null ? srv.total_price : (Number(srv.price || 0) * qty));
        const isDamage = cleanName.toLowerCase().includes('bồi thường');
        return { id: srv.id || idx, name: cleanName, quantity: qty, total, isDamage };
    });

    const regularServices = normalizedServices.filter((s) => !s.isDamage);
    const damageFees = normalizedServices.filter((s) => s.isDamage);
    const regularServicesTotal = regularServices.reduce((sum, s) => sum + s.total, 0);
    const damageFeesTotal = damageFees.reduce((sum, s) => sum + s.total, 0);

    const completedPayments = Array.isArray(booking.payments)
        ? booking.payments.filter((p) => p.payment_status === 'COMPLETED')
        : [];

    const isGroupMasterBilled = Boolean(groupInfo.isGroup && groupInfo.isMasterBilled);

    return (
        <ModalDialog
            isOpen={Boolean(booking)}
            onClose={onClose}
            title={`Chi Tiết Hóa Đơn #${booking.booking_code}`}
            subtitle={`${hotelName} • ${booking.room_name || 'Phòng nghỉ'}`}
            icon={Receipt}
            maxWidth="max-w-2xl"
        >
            <div className="space-y-5 text-xs sm:text-sm text-slate-700 tabular-nums">
                {/* 1. THÔNG TIN ĐƠN & LƯU TRÚ */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-slate-900 text-sm">
                                #{booking.booking_code}
                            </span>
                            <StatusBadge type="booking" status={booking.status} />
                            {groupInfo.isGroup && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                    <Building2 className="w-3 h-3" />
                                    <span>Đoàn {groupInfo.groupCode ? `#${groupInfo.groupCode}` : 'B2B'}</span>
                                </span>
                            )}
                        </div>
                        <span className="text-[11px] text-slate-500">
                            {nights} đêm lưu trú
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div className="flex items-center gap-2 text-slate-600">
                            <BedDouble className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                                Hạng phòng: <strong className="text-slate-900">{booking.room_name}</strong>
                                {booking.room_number && <span className="text-slate-500"> (P.{booking.room_number})</span>}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                            <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                                {formatDateDisplay ? formatDateDisplay(booking.check_in_date) : booking.check_in_date}
                                {' → '}
                                {formatDateDisplay ? formatDateDisplay(booking.check_out_date) : booking.check_out_date}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                            <User className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>
                                Khách: <strong className="text-slate-900">{booking.guest_name}</strong>
                                {booking.guest_phone ? ` • ${booking.guest_phone}` : ''}
                            </span>
                        </div>
                        {booking.room_number && (
                            <div className="flex items-center gap-2 text-slate-600">
                                <Hotel className="w-4 h-4 text-slate-400 shrink-0" />
                                <span>Phòng số: <strong className="text-slate-900">{booking.room_number}</strong></span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. BẢNG KÊ CHI TIẾT KHOẢN THU */}
                <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <span>Khoản mục</span>
                        <span>Thành tiền (VND)</span>
                    </div>

                    <div className="divide-y divide-slate-100 text-xs">
                        {/* Tiền phòng */}
                        <div className="px-4 py-3 flex items-center justify-between gap-3">
                            <div>
                                <div className="font-bold text-slate-900">
                                    Tiền phòng ({nights} đêm)
                                </div>
                                {booking.daily_rate > 0 && (
                                    <div className="text-[11px] text-slate-400">
                                        Đơn giá tham khảo: {Number(booking.daily_rate).toLocaleString('vi-VN')} đ/đêm
                                    </div>
                                )}
                                {isGroupMasterBilled && (
                                    <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        Thanh toán theo hợp đồng đoàn
                                    </span>
                                )}
                            </div>
                            <span className="font-bold text-slate-900 whitespace-nowrap">
                                {roomAmountNum.toLocaleString('vi-VN')} đ
                            </span>
                        </div>

                        {/* Dịch vụ phát sinh */}
                        {regularServices.length > 0 && (
                            <div className="px-4 py-3 space-y-2 bg-slate-50/40">
                                <div className="flex items-center justify-between font-bold text-slate-800">
                                    <span>Dịch vụ & Tiện ích ({regularServices.length} mục)</span>
                                    <span className="whitespace-nowrap">
                                        {regularServicesTotal > 0 ? `+${regularServicesTotal.toLocaleString('vi-VN')} đ` : 'Miễn phí'}
                                    </span>
                                </div>
                                <div className="space-y-1 pl-3 border-l-2 border-amber-200">
                                    {regularServices.map((srv) => (
                                        <div key={srv.id} className="flex items-center justify-between gap-3 text-[11px] text-slate-600">
                                            <span>
                                                {srv.name} <span className="text-slate-400">×{srv.quantity}</span>
                                            </span>
                                            <span className="font-semibold text-slate-800 whitespace-nowrap">
                                                {srv.total > 0 ? `${srv.total.toLocaleString('vi-VN')} đ` : 'Miễn phí'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Phí đền bù / Hư hại */}
                        {damageFees.length > 0 && (
                            <div className="px-4 py-3 space-y-2 bg-rose-50/50">
                                <div className="flex items-center justify-between font-bold text-rose-800">
                                    <span className="inline-flex items-center gap-1.5">
                                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                        <span>Phí đền bù / Phụ thu hư hại ({damageFees.length} mục)</span>
                                    </span>
                                    <span className="whitespace-nowrap">+{damageFeesTotal.toLocaleString('vi-VN')} đ</span>
                                </div>
                                <div className="space-y-1 pl-3 border-l-2 border-rose-300">
                                    {damageFees.map((fee) => (
                                        <div key={fee.id} className="flex items-center justify-between gap-3 text-[11px] text-rose-900">
                                            <span>
                                                {fee.name} <span className="text-rose-500">×{fee.quantity}</span>
                                            </span>
                                            <span className="font-bold whitespace-nowrap">
                                                {fee.total.toLocaleString('vi-VN')} đ
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Giảm giá / Chiết khấu */}
                        {totalSavedNum > 0 && (
                            <div className="px-4 py-2.5 flex items-center justify-between gap-3 text-emerald-700 bg-emerald-50/30">
                                <span className="inline-flex items-center gap-1.5 font-semibold">
                                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>
                                        Chiết khấu & Mã giảm giá{booking.promo_code ? ` (${booking.promo_code})` : ''}
                                    </span>
                                </span>
                                <span className="font-bold whitespace-nowrap">
                                    -{totalSavedNum.toLocaleString('vi-VN')} đ
                                </span>
                            </div>
                        )}

                        {/* Tổng hóa đơn */}
                        <div className="px-4 py-3.5 bg-slate-50 flex items-center justify-between gap-3">
                            <div>
                                <div className="font-bold text-slate-900 text-sm">Tổng giá trị hóa đơn</div>
                                <div className="text-[10px] text-slate-400">
                                    Đã bao gồm VAT ({settings?.vat_percent || 8}%) & phí phục vụ ({settings?.service_charge_percent || 5}%)
                                </div>
                            </div>
                            <span className={`font-black text-base sm:text-lg whitespace-nowrap ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                {grandTotalNum.toLocaleString('vi-VN')} VND
                            </span>
                        </div>

                        {/* Tiền cọc / Đã thanh toán */}
                        <div className="px-4 py-3 flex items-center justify-between gap-3 text-emerald-700">
                            <span className="inline-flex items-center gap-1.5 font-semibold">
                                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Đã thanh toán / Đặt cọc</span>
                            </span>
                            <span className="font-bold whitespace-nowrap">
                                {paidAmountNum.toLocaleString('vi-VN')} VND
                            </span>
                        </div>

                        {/* Số tiền còn lại */}
                        {!isCancelled && (
                            <div className="px-4 py-3.5 bg-amber-50/60 flex items-center justify-between gap-3">
                                <span className="font-bold text-slate-900">
                                    {isGroupMasterBilled && remainingBalanceNum === 0
                                        ? 'Khách cần thanh toán thêm'
                                        : 'Số tiền còn lại cần thanh toán'}
                                </span>
                                {remainingBalanceNum <= 0 ? (
                                    <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700 whitespace-nowrap">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        <span>0 VND (Đã tất toán)</span>
                                    </span>
                                ) : (
                                    <span className="font-black text-base text-rose-600 whitespace-nowrap">
                                        {remainingBalanceNum.toLocaleString('vi-VN')} VND
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. LỊCH SỬ GIAO DỊCH ĐÃ GHI NHẬN (NẾU CÓ) */}
                {completedPayments.length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                        <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                            Giao dịch đã ghi nhận ({completedPayments.length})
                        </div>
                        <div className="space-y-1.5">
                            {completedPayments.map((p, idx) => (
                                <div key={p.id || idx} className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
                                    <span>
                                        • {p.payment_method_display || p.payment_method || 'Thanh toán'}
                                        {p.created_at ? ` (${formatDateDisplay ? formatDateDisplay(p.created_at) : p.created_at})` : ''}
                                    </span>
                                    <strong className="text-emerald-700 whitespace-nowrap">
                                        +{Number(p.amount || 0).toLocaleString('vi-VN')} VND
                                    </strong>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
                    >
                        Đóng hóa đơn
                    </button>
                </div>
            </div>
        </ModalDialog>
    );
}

