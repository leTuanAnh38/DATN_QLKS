import React, { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, Clock, Landmark, X } from 'lucide-react';

const QUICK_VN_BANKS = [
    'MB Bank',
    'Vietcombank',
    'Techcombank',
    'BIDV',
    'VietinBank',
    'ACB',
    'VPBank',
    'TPBank'
];

const POPULAR_VN_BANKS = [
    ...QUICK_VN_BANKS,
    'Sacombank',
    'Agribank',
    'HDBank',
    'VIB',
    'SHB',
    'OCB',
    'MSB',
    'SeABank',
    'Eximbank',
    'LPBank',
    'Cake by VPBank',
    'Timo'
];

/**
 * Modal xác nhận hủy đặt phòng hoặc gửi yêu cầu hủy đoàn & hoàn cọc
 */
export default function CancelBookingModal({
    booking,
    onClose,
    onConfirm,
    isCancelling = false,
    cancelReason = 'Thay đổi lịch trình chuyến đi',
    setCancelReason,
    customReason = '',
    setCustomReason,
    cancelScope = 'single',
    setCancelScope,
    refundBankName = '',
    setRefundBankName,
    refundAccountNumber = '',
    setRefundAccountNumber,
    refundAccountHolder = '',
    setRefundAccountHolder,
    refundBankError = '',
    setRefundBankError,
    cancellationFreeHours = 48,
    getGroupBookingInfo = () => ({ isGroup: false }),
    formatDateDisplay = (d) => d
}) {
    const bankSectionRef = useRef(null);

    useEffect(() => {
        if (refundBankError && bankSectionRef.current) {
            bankSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [refundBankError]);

    if (!booking) return null;

    const modalGroup = getGroupBookingInfo(booking);
    const isGroupDeposited = Boolean(
        modalGroup.isGroup && (booking.is_group_deposit_paid || booking.group_status === 'confirmed')
    );
    const isSinglePaid = Boolean(
        !modalGroup.isGroup && (
            ['paid', 'PAID'].includes(booking.status) ||
            booking.is_paid ||
            Number(booking.paid_amount || 0) > 0
        )
    );
    const showRefundBankForm = isGroupDeposited || isSinglePaid;
    const paidSingleAmount = Number(booking.paid_amount || booking.grand_total_amount || booking.total_amount || 0);
    const existingCancelReq = booking.group_cancel_request;
    const isPendingCancelReq = Boolean(existingCancelReq && existingCancelReq.status === 'pending');

    // Đối chiếu chính sách hủy miễn phí theo mốc giờ nhận phòng (14:00)
    const policy = booking.group_cancel_policy || (() => {
        const freeH = Number(cancellationFreeHours || 48);
        if (!booking.check_in_date) return { free_hours: freeH, hours_until_checkin: 0, is_free_cancel_eligible: false };
        const checkinDt = new Date(`${String(booking.check_in_date).slice(0, 10)}T14:00:00`);
        const hoursUntil = (checkinDt.getTime() - Date.now()) / 3600000;
        return {
            free_hours: freeH,
            hours_until_checkin: Math.round(hoursUntil * 10) / 10,
            is_free_cancel_eligible: hoursUntil >= freeH
        };
    })();

    const depositAmount = Number(booking.group_deposit_amount || 0);

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={(e) => { if (e.target === e.currentTarget && !isCancelling) onClose?.(); }}
        >
            <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl text-left animate-in zoom-in-95 duration-200 max-h-[92dvh] sm:max-h-[90dvh] flex flex-col overflow-hidden">
                {/* Mobile Drag Handle */}
                <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
                    <div className="w-10 h-1 rounded-full bg-slate-300/80" />
                </div>

                {/* 1. FIXED HEADER */}
                <div className="shrink-0 px-4 pt-2 pb-3 sm:px-6 sm:pt-5 sm:pb-4 border-b border-slate-100 flex items-start justify-between gap-2.5 sm:gap-3 bg-white">
                    <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 font-bold border ${
                            isGroupDeposited
                                ? 'bg-amber-50 text-amber-600 border-amber-200'
                                : 'bg-rose-50 text-rose-600 border-rose-200'
                        }`}>
                            <AlertCircle className={`w-5 h-5 sm:w-6 sm:h-6 ${isGroupDeposited ? 'text-amber-600' : 'text-rose-600'}`} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-serif text-[15px] sm:text-lg font-bold text-slate-900 leading-snug">
                                {isGroupDeposited ? 'Yêu Cầu Hủy Đoàn & Hoàn Cọc' : 'Xác nhận Hủy Đặt Phòng'}
                            </h3>
                            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 break-words">
                                {isGroupDeposited ? (
                                    <>Mã đoàn: <strong className="font-mono text-indigo-700">#{modalGroup.groupCode}</strong> • Phòng #{booking.booking_code}</>
                                ) : (
                                    <>Mã đơn: <strong className="font-mono text-slate-800">#{booking.booking_code}</strong></>
                                )}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isCancelling}
                        className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition flex items-center justify-center cursor-pointer shrink-0"
                        title="Đóng"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* 2. SCROLLABLE BODY */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3.5 sm:px-6 sm:py-4 space-y-3.5">
                    {/* Phạm vi hủy nếu là Đơn theo đoàn CHƯA CỌC */}
                    {modalGroup.isGroup && !isGroupDeposited && (
                        <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2">
                            <label className="block text-xs font-bold text-indigo-950 uppercase tracking-wider">
                                Phạm vi hủy (Đoàn #{modalGroup.groupCode}):
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <label className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition ${
                                    cancelScope === 'single'
                                        ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/20 shadow-xs'
                                        : 'border-indigo-100 bg-white/70 hover:bg-white'
                                }`}>
                                    <input
                                        type="radio"
                                        name="cancelScope"
                                        value="single"
                                        checked={cancelScope === 'single'}
                                        onChange={() => setCancelScope('single')}
                                        className="accent-indigo-600"
                                    />
                                    <div>
                                        <strong className="block text-slate-800">Chỉ hủy phòng này</strong>
                                        <span className="text-[11px] text-slate-500 font-mono">#{booking.booking_code}</span>
                                    </div>
                                </label>

                                <label className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition ${
                                    cancelScope === 'group'
                                        ? 'border-rose-600 bg-rose-50/70 ring-2 ring-rose-500/20 shadow-xs'
                                        : 'border-indigo-100 bg-white/70 hover:bg-white'
                                }`}>
                                    <input
                                        type="radio"
                                        name="cancelScope"
                                        value="group"
                                        checked={cancelScope === 'group'}
                                        onChange={() => setCancelScope('group')}
                                        className="accent-rose-600"
                                    />
                                    <div>
                                        <strong className="block text-rose-700">Hủy toàn bộ đoàn</strong>
                                        <span className="text-[11px] text-rose-500">Đồng bộ hủy tất cả phòng</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Thông báo chính sách hoàn cọc nếu là Đơn đoàn ĐÃ CỌC / XÁC NHẬN */}
                    {isGroupDeposited && (
                        <div className="space-y-2.5">
                            <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                                policy.is_free_cancel_eligible
                                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                    : 'bg-amber-50/90 border-amber-200 text-amber-900'
                            }`}>
                                <div className="flex items-start gap-1.5 font-extrabold leading-snug">
                                    {policy.is_free_cancel_eligible ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                    ) : (
                                        <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    )}
                                    <span>
                                        {policy.is_free_cancel_eligible
                                            ? `Đủ điều kiện xem xét hoàn cọc (trước ≥ ${policy.free_hours} giờ)`
                                            : `Cận ngày nhận phòng (dưới ${policy.free_hours} giờ)`}
                                    </span>
                                </div>
                                <p className="text-[11px] leading-relaxed opacity-90">
                                    {policy.is_free_cancel_eligible
                                        ? `Đoàn đã thanh toán ${depositAmount.toLocaleString('vi-VN')} VND. Yêu cầu hủy toàn bộ đoàn sẽ được chuyển tới Lễ tân & Thu ngân đối soát hoàn cọc.`
                                        : `Đoàn đã thanh toán ${depositAmount.toLocaleString('vi-VN')} VND. Do hủy sát giờ nhận phòng, mức hoàn/phạt cọc sẽ được Lễ tân & Quản lý đối soát theo quy định hợp đồng.`}
                                </p>
                            </div>

                            {isPendingCancelReq && (
                                <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-800 font-medium leading-relaxed">
                                    Bạn đã gửi yêu cầu hủy trước đó. Bạn có thể cập nhật lại lý do hoặc thông tin tài khoản nhận hoàn cọc bên dưới.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Thông báo hoàn tiền cho Đơn lẻ ĐÃ THANH TOÁN */}
                    {isSinglePaid && (
                        <div className="p-3.5 rounded-2xl border bg-emerald-50/80 border-emerald-200 text-emerald-900 text-xs space-y-1.5">
                            <div className="flex items-start gap-1.5 font-extrabold leading-snug">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span>
                                    Đã thanh toán {paidSingleAmount.toLocaleString('vi-VN')} VND — Hỗ trợ hoàn tiền
                                    {policy.is_free_cancel_eligible ? ` (trước ≥ ${policy.free_hours}h)` : ''}
                                </span>
                            </div>
                            <p className="text-[11px] leading-relaxed opacity-90">
                                Nhập chính xác tài khoản ngân hàng bên dưới để Thu ngân chuyển khoản hoàn tiền và gửi thông báo về tài khoản của bạn sau khi hoàn tất.
                            </p>
                        </div>
                    )}

                    {/* Tóm tắt đơn hủy */}
                    <div className="bg-slate-50 rounded-2xl p-3.5 text-xs space-y-2 border border-slate-200/80">
                        <div className="flex justify-between items-start gap-2">
                            <span className="text-slate-500 shrink-0">{isGroupDeposited ? 'Tên đoàn:' : 'Hạng phòng:'}</span>
                            <strong className="text-slate-900 text-right min-w-0 break-words">
                                {isGroupDeposited ? (modalGroup.groupName || booking.room_name) : booking.room_name}
                            </strong>
                        </div>
                        <div className="flex flex-wrap justify-between items-center gap-x-2 gap-y-0.5">
                            <span className="text-slate-500 shrink-0">Thời gian:</span>
                            <span className="text-slate-800 font-medium text-right whitespace-nowrap ml-auto tabular-nums">
                                {formatDateDisplay(booking.check_in_date)} → {formatDateDisplay(booking.check_out_date)}
                            </span>
                        </div>
                        <div className="flex flex-wrap justify-between items-baseline gap-1.5">
                            <span className="text-slate-500 min-w-0">
                                {isGroupDeposited ? 'Đã cọc / thanh toán:' : isSinglePaid ? 'Số tiền đã thanh toán:' : 'Tổng tiền đơn phòng:'}
                            </span>
                            <strong className="text-rose-600 font-bold whitespace-nowrap shrink-0 ml-auto tabular-nums">
                                {isGroupDeposited
                                    ? `${depositAmount.toLocaleString('vi-VN')} VND`
                                    : isSinglePaid
                                    ? `${paidSingleAmount.toLocaleString('vi-VN')} VND`
                                    : `${Number(booking.grand_total_amount ?? booking.total_amount).toLocaleString('vi-VN')} VND`}
                            </strong>
                        </div>
                    </div>

                    {/* Chọn lý do hủy */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Vui lòng chọn lý do hủy:
                        </label>
                        <select
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer"
                        >
                            <option value="Thay đổi lịch trình chuyến đi">Thay đổi lịch trình chuyến đi</option>
                            <option value="Đặt nhầm ngày hoặc thông tin phòng">Đặt nhầm ngày hoặc thông tin phòng</option>
                            <option value="Tìm thấy mức giá hoặc nơi ở khác phù hợp hơn">Tìm thấy mức giá hoặc nơi ở khác phù hợp hơn</option>
                            <option value="Khác">Lý do cá nhân khác...</option>
                        </select>

                        {cancelReason === 'Khác' && (
                            <textarea
                                rows={2}
                                placeholder="Nhập lý do cụ thể của bạn..."
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 mt-2"
                            />
                        )}
                    </div>

                    {/* Thông tin tài khoản nhận hoàn tiền (hiện cho đoàn đã cọc & đơn lẻ đã thanh toán) */}
                    {showRefundBankForm && (
                        <div
                            ref={bankSectionRef}
                            className={`p-3.5 rounded-2xl border space-y-2.5 transition ${
                                refundBankError
                                    ? 'bg-rose-50/40 border-rose-300 ring-2 ring-rose-500/15'
                                    : 'bg-slate-50 border-slate-200'
                            }`}
                        >
                            <div className="flex items-start gap-1.5 text-xs font-bold text-slate-800">
                                <Landmark className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                                <span>
                                    {isSinglePaid
                                        ? 'Thông tin tài khoản nhận hoàn tiền'
                                        : 'Thông tin nhận hoàn cọc (nếu đủ điều kiện)'}
                                    {isSinglePaid && <span className="text-rose-500 ml-1">*</span>}
                                </span>
                            </div>

                            {/* Chip chọn nhanh ngân hàng phổ biến cho điện thoại (tránh hạn chế datalist trên iOS) */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5 scrollbar-none">
                                {QUICK_VN_BANKS.map((bank) => {
                                    const isSelected = refundBankName.trim().toLowerCase() === bank.toLowerCase();
                                    return (
                                        <button
                                            key={bank}
                                            type="button"
                                            onClick={() => {
                                                setRefundBankName && setRefundBankName(bank);
                                                setRefundBankError && setRefundBankError('');
                                            }}
                                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border whitespace-nowrap shrink-0 transition cursor-pointer active:scale-95 ${
                                                isSelected
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                                    : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'
                                            }`}
                                        >
                                            {bank}
                                        </button>
                                    );
                                })}
                            </div>

                            <input
                                type="text"
                                list="vn-refund-banks"
                                placeholder="Hoặc nhập tên ngân hàng khác..."
                                value={refundBankName}
                                onChange={(e) => {
                                    setRefundBankName && setRefundBankName(e.target.value);
                                    setRefundBankError && setRefundBankError('');
                                }}
                                className="w-full px-3 py-2.5 sm:py-2 bg-white border border-slate-200 rounded-xl text-base sm:text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                            <datalist id="vn-refund-banks">
                                {POPULAR_VN_BANKS.map((bank) => (
                                    <option key={bank} value={bank} />
                                ))}
                            </datalist>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Số tài khoản nhận tiền"
                                    value={refundAccountNumber}
                                    onChange={(e) => {
                                        setRefundAccountNumber && setRefundAccountNumber(e.target.value);
                                        setRefundBankError && setRefundBankError('');
                                    }}
                                    className="w-full px-3 py-2.5 sm:py-2 bg-white border border-slate-200 rounded-xl text-base sm:text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Tên chủ tài khoản (không dấu)"
                                    value={refundAccountHolder}
                                    onChange={(e) => {
                                        setRefundAccountHolder && setRefundAccountHolder(e.target.value);
                                        setRefundBankError && setRefundBankError('');
                                    }}
                                    className="w-full px-3 py-2.5 sm:py-2 bg-white border border-slate-200 rounded-xl text-base sm:text-xs text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>
                            {refundBankError && (
                                <p className="text-[11px] font-semibold text-rose-600 flex items-start gap-1 pt-0.5 leading-snug">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span>{refundBankError}</span>
                                </p>
                            )}
                        </div>
                    )}

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                        {isGroupDeposited
                            ? 'Lưu ý: Với đơn đoàn đã cọc, phòng vẫn được giữ cho tới khi Lễ tân/Thu ngân xác nhận hủy và đối soát hoàn cọc.'
                            : isSinglePaid
                            ? 'Sau khi hủy, thông tin tài khoản nhận hoàn tiền sẽ được gửi trực tiếp tới Thu ngân để xử lý hoàn khoản.'
                            : 'Sau khi hủy, đơn phòng sẽ chuyển sang trạng thái Đã Hủy và phòng sẽ được giải phóng trên hệ thống.'}
                    </p>
                </div>

                {/* 3. FIXED FOOTER ACTIONS (luôn hiển thị trên điện thoại khi cuộn form) */}
                <div className="shrink-0 px-4 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-4 bg-white border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center gap-2 sm:gap-3">
                    <button
                        type="button"
                        disabled={isCancelling}
                        onClick={onClose}
                        className="w-full sm:w-1/2 py-3 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition text-center cursor-pointer"
                    >
                        Giữ lại đơn
                    </button>

                    <button
                        type="button"
                        disabled={isCancelling}
                        onClick={onConfirm}
                        className={`w-full sm:w-1/2 py-3 min-h-[44px] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                            isGroupDeposited
                                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                        }`}
                    >
                        {isCancelling ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Đang xử lý...</span>
                            </>
                        ) : (
                            <span>
                                {isGroupDeposited
                                    ? (isPendingCancelReq ? 'Cập nhật YC Hủy' : 'Gửi YC Hủy Đoàn')
                                    : (cancelScope === 'group' ? 'Xác nhận Hủy Toàn Bộ Đoàn' : 'Xác nhận Hủy Phòng')}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

