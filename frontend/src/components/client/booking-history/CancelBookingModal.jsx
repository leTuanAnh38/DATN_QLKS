import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Modal xác nhận hủy đặt phòng (cho đơn pending / đơn đoàn)
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
    getGroupBookingInfo = () => ({ isGroup: false }),
    formatDateDisplay = (d) => d
}) {
    if (!booking) return null;

    const modalGroup = getGroupBookingInfo(booking);

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 sm:p-8 shadow-2xl text-left animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                {/* Header Modal */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 font-bold border border-rose-200">
                        <AlertCircle className="w-6 h-6 text-rose-600" />
                    </div>
                    <div>
                        <h3 className="font-serif text-lg font-bold text-slate-900">
                            Xác nhận Hủy Đặt Phòng
                        </h3>
                        <p className="text-xs text-slate-500">
                            Mã đơn: <strong className="font-mono text-slate-800">{booking.booking_code}</strong>
                        </p>
                    </div>
                </div>

                {/* Phạm vi hủy nếu là Đơn theo đoàn */}
                {modalGroup.isGroup && (
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

                {/* Tóm tắt đơn hủy */}
                <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-2 mb-4 border border-slate-200/80">
                    <div className="flex justify-between">
                        <span className="text-slate-500">Hạng phòng:</span>
                        <strong className="text-slate-900">{booking.room_name}</strong>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Thời gian:</span>
                        <span className="text-slate-800 font-medium">
                            {formatDateDisplay(booking.check_in_date)} → {formatDateDisplay(booking.check_out_date)}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-500">Tổng tiền đơn phòng:</span>
                        <strong className="text-rose-600 font-bold">
                            {Number(booking.grand_total_amount ?? booking.total_amount).toLocaleString('vi-VN')} VND
                        </strong>
                    </div>
                </div>

                {/* Chọn lý do hủy */}
                <div className="space-y-2 mb-6">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Vui lòng chọn lý do hủy phòng:
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

                    <span className="text-[11px] text-slate-400 block pt-1">
                        Sau khi hủy, đơn phòng sẽ chuyển sang trạng thái <strong>Đã Hủy</strong> và phòng sẽ được giải phóng trên hệ thống.
                    </span>
                </div>

                {/* Nút hành động */}
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        disabled={isCancelling}
                        onClick={onConfirm}
                        className="w-1/2 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                        {isCancelling ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Đang hủy đơn...</span>
                            </>
                        ) : (
                            <span>{cancelScope === 'group' ? 'Xác nhận Hủy Toàn Bộ Đoàn' : 'Xác nhận Hủy Phòng'}</span>
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

