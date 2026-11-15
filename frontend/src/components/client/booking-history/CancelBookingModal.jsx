import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Landmark } from 'lucide-react';

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
    cancellationFreeHours = 48,
    getGroupBookingInfo = () => ({ isGroup: false }),
    formatDateDisplay = (d) => d
}) {
    if (!booking) return null;

    const modalGroup = getGroupBookingInfo(booking);
    const isGroupDeposited = Boolean(
        modalGroup.isGroup && (booking.is_group_deposit_paid || booking.group_status === 'confirmed')
    );
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
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-4 sm:p-7 shadow-2xl text-left animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                {/* Header Modal */}
                <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
                    <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 font-bold border ${
                        isGroupDeposited
                            ? 'bg-amber-50 text-amber-600 border-amber-200'
                            : 'bg-rose-50 text-rose-600 border-rose-200'
                    }`}>
                        <AlertCircle className={`w-5 h-5 sm:w-6 sm:h-6 ${isGroupDeposited ? 'text-amber-600' : 'text-rose-600'}`} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-serif text-base sm:text-lg font-bold text-slate-900 truncate">
                            {isGroupDeposited ? 'Yêu Cầu Hủy Đoàn & Hoàn Cọc' : 'Xác nhận Hủy Đặt Phòng'}
                        </h3>
                        <p className="text-[11px] sm:text-xs text-slate-500">
                            {isGroupDeposited ? (
                                <>Mã đoàn: <strong className="font-mono text-indigo-700">#{modalGroup.groupCode}</strong> • Phòng #{booking.booking_code}</>
                            ) : (
                                <>Mã đơn: <strong className="font-mono text-slate-800">#{booking.booking_code}</strong></>
                            )}
                        </p>
                    </div>
                </div>

                {/* Phạm vi hủy nếu là Đơn theo đoàn CHƯA CỌC */}
                {modalGroup.isGroup && !isGroupDeposited && (
                    <div className="mb-4 p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2">
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
                    <div className="mb-4 space-y-2.5">
                        <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                            policy.is_free_cancel_eligible
                                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                : 'bg-amber-50/90 border-amber-200 text-amber-900'
                        }`}>
                            <div className="flex items-center gap-1.5 font-extrabold">
                                {policy.is_free_cancel_eligible ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                ) : (
                                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
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
                            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-800 font-medium">
                                Bạn đã gửi yêu cầu hủy trước đó. Bạn có thể cập nhật lại lý do hoặc thông tin tài khoản nhận hoàn cọc bên dưới.
                            </div>
                        )}
                    </div>
                )}

                {/* Tóm tắt đơn hủy */}
                <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-2 mb-4 border border-slate-200/80">
                    <div className="flex justify-between gap-2">
                        <span className="text-slate-500">{isGroupDeposited ? 'Tên đoàn:' : 'Hạng phòng:'}</span>
                        <strong className="text-slate-900 text-right">
                            {isGroupDeposited ? (modalGroup.groupName || booking.room_name) : booking.room_name}
                        </strong>
                    </div>
                    <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Thời gian:</span>
                        <span className="text-slate-800 font-medium">
                            {formatDateDisplay(booking.check_in_date)} → {formatDateDisplay(booking.check_out_date)}
                        </span>
                    </div>
                    <div className="flex justify-between gap-2">
                        <span className="text-slate-500">
                            {isGroupDeposited ? 'Số tiền đoàn đã cọc / thanh toán:' : 'Tổng tiền đơn phòng:'}
                        </span>
                        <strong className="text-rose-600 font-bold">
                            {isGroupDeposited
                                ? `${depositAmount.toLocaleString('vi-VN')} VND`
                                : `${Number(booking.grand_total_amount ?? booking.total_amount).toLocaleString('vi-VN')} VND`}
                        </strong>
                    </div>
                </div>

                {/* Chọn lý do hủy */}
                <div className="space-y-2 mb-4">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Vui lòng chọn lý do hủy:
                    </label>
                    <select
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer"
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
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 mt-2"
                        />
                    )}
                </div>

                {/* Thông tin tài khoản nhận hoàn cọc (chỉ hiện với đoàn đã cọc) */}
                {isGroupDeposited && (
                    <div className="mb-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                            <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Thông tin nhận hoàn cọc (nếu đủ điều kiện)</span>
                        </div>
                        <input
                            type="text"
                            placeholder="Tên ngân hàng (VD: MB Bank, Vietcombank...)"
                            value={refundBankName}
                            onChange={(e) => setRefundBankName && setRefundBankName(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                                type="text"
                                placeholder="Số tài khoản"
                                value={refundAccountNumber}
                                onChange={(e) => setRefundAccountNumber && setRefundAccountNumber(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                            <input
                                type="text"
                                placeholder="Tên chủ tài khoản"
                                value={refundAccountHolder}
                                onChange={(e) => setRefundAccountHolder && setRefundAccountHolder(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                        </div>
                    </div>
                )}

                <span className="text-[11px] text-slate-400 block pb-4">
                    {isGroupDeposited
                        ? 'Lưu ý: Với đơn đoàn đã cọc, phòng vẫn được giữ cho tới khi Lễ tân/Thu ngân xác nhận hủy và đối soát hoàn cọc.'
                        : 'Sau khi hủy, đơn phòng sẽ chuyển sang trạng thái Đã Hủy và phòng sẽ được giải phóng trên hệ thống.'}
                </span>

                {/* Nút hành động */}
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        disabled={isCancelling}
                        onClick={onConfirm}
                        className={`w-1/2 py-3 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
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

                    <button
                        type="button"
                        disabled={isCancelling}
                        onClick={onClose}
                        className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition text-center cursor-pointer"
                    >
                        Giữ lại đơn
                    </button>
                </div>
            </div>
        </div>
    );
}

