import React, { useState, useEffect } from 'react';
import { X, UserX, AlertTriangle, User, Phone, BedDouble, Calendar } from 'lucide-react';
import { bookingService } from '../../../../services/bookingService';

export default function NoShowModal({
    isOpen,
    booking,
    onClose,
    onSuccess,
    isCheckInDateReached,
    formatDateDisplay,
    showToast
}) {
    const [reason, setReason] = useState('Quá giờ check-in quy định không liên lạc được');
    const [customReason, setCustomReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setReason('Quá giờ check-in quy định không liên lạc được');
            setCustomReason('');
            setIsSubmitting(false);
        }
    }, [isOpen]);

    if (!isOpen || !booking) return null;

    const canMarkNoShow = isCheckInDateReached ? isCheckInDateReached(booking.check_in_date) : true;
    const formatDisplay = (d) => (formatDateDisplay ? formatDateDisplay(d) : (d || '—'));

    const handleConfirm = async () => {
        if (!canMarkNoShow) {
            showToast?.('error', `Chưa tới ngày nhận phòng (${formatDisplay(booking.check_in_date)}). Không thể đánh dấu No-show. Vui lòng chọn Hủy đơn nếu khách báo hủy.`);
            return;
        }
        const finalReason = reason === 'Khác' ? (customReason.trim() || 'Lý do khác') : reason;
        try {
            setIsSubmitting(true);
            const res = await bookingService.markNoShow(booking.id, { reason: finalReason });
            if (res && res.success) {
                showToast?.('success', res.message || 'Đã đánh dấu No-show và giải phóng phòng thành công!');
                onSuccess?.(booking.id);
                onClose?.();
            } else {
                showToast?.('error', res?.message || 'Không thể đánh dấu No-show.');
            }
        } catch (err) {
            showToast?.('error', err.message || 'Lỗi khi xử lý No-show.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200/90 max-w-lg w-full p-6 shadow-2xl text-left animate-in zoom-in-95 duration-200 relative">
                {/* Header Modal */}
                <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
                            <UserX className="w-5 h-5 text-slate-700" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                    #{booking.booking_code}
                                </span>
                                <span className="text-xs text-slate-300">•</span>
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200 uppercase">
                                    Khách không đến (No-show)
                                </span>
                            </div>
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 tracking-tight">
                                Xác Nhận Khách Không Đến (No-show)
                            </h3>
                        </div>
                    </div>

                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                        title="Đóng modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Cảnh báo kiểm tra ngày nhận phòng */}
                {!canMarkNoShow ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl mb-3.5 text-xs text-rose-900 leading-relaxed space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-rose-800">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>CHƯA TỚI NGÀY NHẬN PHÒNG (KHÔNG THỂ NO-SHOW)</span>
                        </div>
                        <p className="font-medium text-[11px]">
                            Đơn đặt phòng này có ngày check-in là <strong>{formatDisplay(booking.check_in_date)}</strong>. Trạng thái No-show chỉ áp dụng từ ngày nhận phòng trở đi. Nếu khách báo trước, vui lòng chọn <strong>Từ chối / Hủy đơn</strong>.
                        </p>
                    </div>
                ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-3.5 text-xs text-amber-900 leading-relaxed space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-amber-800">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>CẢNH BÁO QUAN TRỌNG</span>
                        </div>
                        <p className="font-medium text-[11px]">
                            Hành động này sẽ hủy giữ chỗ và giải phóng phòng để bán cho khách khác. Tiền cọc (nếu có) sẽ được xử lý theo quy định không hoàn tiền.
                        </p>
                    </div>
                )}

                {/* Tóm tắt thông tin đơn đặt phòng */}
                <div className="bg-slate-50/80 rounded-xl p-3.5 text-xs space-y-2 mb-4 border border-slate-200/80">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>Khách hàng:</span>
                        </span>
                        <strong className="text-slate-900 truncate max-w-[200px]">{booking.guest_name}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>Số điện thoại:</span>
                        </span>
                        <span className="text-slate-800 font-semibold">{booking.guest_phone || 'Không có'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 flex items-center gap-1.5">
                            <BedDouble className="w-3.5 h-3.5 text-slate-400" />
                            <span>Hạng phòng & Số phòng:</span>
                        </span>
                        <span className="text-slate-900 font-bold">
                            {booking.room_name} {booking.room_number ? `(P.${booking.room_number})` : ''}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>Thời gian lưu trú:</span>
                        </span>
                        <span className="text-slate-800 font-medium font-mono text-[11px]">
                            {formatDisplay(booking.check_in_date)} → {formatDisplay(booking.check_out_date)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200/80">
                        <span className="text-slate-500 font-medium">Tổng tiền đơn:</span>
                        <strong className="text-rose-600 font-bold text-sm font-mono">
                            {Number(booking.grand_total_amount || booking.total_amount || 0).toLocaleString('vi-VN')} VND
                        </strong>
                    </div>
                </div>

                {/* Chọn lý do No-show */}
                <div className="space-y-1.5 mb-5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Lý do ghi nhận No-show:
                    </label>
                    <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 cursor-pointer"
                    >
                        <option value="Quá giờ check-in quy định không liên lạc được">Quá giờ check-in quy định không liên lạc được</option>
                        <option value="Khách chủ động gọi điện báo không đến nhận phòng">Khách chủ động gọi điện báo không đến nhận phòng</option>
                        <option value="Khách hủy đột xuất sát giờ nhận phòng (Late Cancellation)">Khách hủy đột xuất sát giờ nhận phòng (Late Cancellation)</option>
                        <option value="Khách không cung cấp giấy tờ tùy thân hợp lệ khi đến">Khách không cung cấp giấy tờ tùy thân hợp lệ khi đến</option>
                        <option value="Khác">Lý do khác...</option>
                    </select>

                    {reason === 'Khác' && (
                        <textarea
                            rows={2}
                            placeholder="Nhập lý do cụ thể..."
                            value={customReason}
                            onChange={(e) => setCustomReason(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 mt-1.5"
                        />
                    )}
                </div>

                {/* Nút hành động */}
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={onClose}
                        className="w-1/2 py-2.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition text-center cursor-pointer disabled:opacity-50"
                    >
                        Giữ lại đơn
                    </button>

                    <button
                        type="button"
                        disabled={isSubmitting || !canMarkNoShow}
                        onClick={handleConfirm}
                        className="w-1/2 py-2.5 px-3 bg-slate-900 hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Đang xử lý...</span>
                            </>
                        ) : (
                            <>
                                <UserX className="w-4 h-4" />
                                <span>Xác nhận No-show</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
