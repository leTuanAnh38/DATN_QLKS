import React, { useState, useEffect } from 'react';
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
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 shadow-2xl text-left animate-in zoom-in-95 duration-200">
                {/* Header Modal */}
                <div className="flex items-center gap-3.5 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center text-2xl shrink-0 font-bold">
                        🚫
                    </div>
                    <div>
                        <h3 className="font-serif text-lg font-bold text-slate-900">
                            Xác nhận Khách Không Đến (No-show)
                        </h3>
                        <p className="text-xs text-slate-500">
                            Mã đơn: <strong className="font-mono text-slate-900">{booking.booking_code}</strong>
                        </p>
                    </div>
                </div>

                {/* Cảnh báo kiểm tra ngày nhận phòng */}
                {!canMarkNoShow ? (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl mb-4 text-xs text-rose-900 leading-relaxed space-y-1.5">
                        <div className="font-bold flex items-center gap-1.5 text-rose-800">
                            <span>⛔ CHƯA TỚI NGÀY NHẬN PHÒNG (KHÔNG THỂ NO-SHOW):</span>
                        </div>
                        <p className="font-medium">
                            Đơn đặt phòng này có ngày check-in là <strong>{formatDisplay(booking.check_in_date)}</strong>. Theo quy chuẩn khách sạn, trạng thái No-show chỉ được ghi nhận từ ngày nhận phòng trở đi. Nếu khách chủ động báo trước là không đến, vui lòng đóng cửa sổ này và chọn thao tác <strong>Từ chối / Hủy đơn</strong>.
                        </p>
                    </div>
                ) : (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-4 text-xs text-amber-900 leading-relaxed space-y-1.5">
                        <div className="font-bold flex items-center gap-1.5 text-amber-800">
                            <span>⚠️ CẢNH BÁO QUAN TRỌNG:</span>
                        </div>
                        <p className="font-medium">
                            Bạn có chắc chắn muốn đánh dấu đơn này là <strong>Khách không đến (No-show)</strong>? Hành động này sẽ hủy giữ chỗ và giải phóng phòng để bán cho khách khác. Tiền cọc (nếu có) sẽ không được hoàn lại.
                        </p>
                    </div>
                )}

                {/* Tóm tắt thông tin đơn đặt phòng */}
                <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-2 mb-4 border border-slate-200/80">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Khách hàng:</span>
                        <strong className="text-slate-900">{booking.guest_name}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Số điện thoại:</span>
                        <span className="text-slate-800 font-semibold">{booking.guest_phone || 'Không có'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Hạng phòng & Số phòng:</span>
                        <span className="text-slate-900 font-bold">
                            {booking.room_name} {booking.room_number ? `(Phòng ${booking.room_number})` : ''}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">Thời gian lưu trú:</span>
                        <span className="text-slate-800">
                            {formatDisplay(booking.check_in_date)} → {formatDisplay(booking.check_out_date)}
                        </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                        <span className="text-slate-500">Tổng tiền đơn:</span>
                        <strong className="text-rose-600 font-bold text-sm">
                            {Number(booking.grand_total_amount || booking.total_amount || 0).toLocaleString('vi-VN')} VND
                        </strong>
                    </div>
                </div>

                {/* Chọn lý do No-show */}
                <div className="space-y-2 mb-6">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Lý do ghi nhận No-show:
                    </label>
                    <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 cursor-pointer"
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
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 mt-2"
                        />
                    )}
                </div>

                {/* Nút hành động */}
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        disabled={isSubmitting || !canMarkNoShow}
                        onClick={handleConfirm}
                        className="w-1/2 py-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Đang xử lý...</span>
                            </>
                        ) : (
                            <>
                                <span>🚫</span>
                                <span>Xác nhận No-show</span>
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        disabled={isSubmitting}
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
