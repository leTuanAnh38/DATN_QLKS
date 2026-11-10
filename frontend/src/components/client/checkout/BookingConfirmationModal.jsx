import React from 'react';
import {
    ShieldCheck,
    X,
    AlertCircle,
    CalendarDays,
    Building2,
    CreditCard,
    CheckCircle2
} from 'lucide-react';

export default function BookingConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    isSubmitting = false,
    modalError = null,
    room,
    nights = 1,
    checkInDate,
    checkOutDate,
    guestName,
    guestPhone,
    guestEmail,
    identityCard = '',
    customerType = 'MEMBER',
    companyName = '',
    companyTaxCode = '',
    selectedServicesArray = [],
    roomNetTotal = 0,
    totalServicesAmount = 0,
    appliedPromo = null,
    discountAmount = 0,
    finalTotal = 0,
    paymentMethod = 'reception',
    hotelSettings = {},
    formatDateDisplay = (d) => d
}) {
    if (!isOpen) return null;

    return (
        <div
            onClick={(e) => {
                if (e.target === e.currentTarget && !isSubmitting) {
                    onClose();
                }
            }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
        >
            <div className="bg-white rounded-3xl border border-slate-200/80 max-w-xl w-full shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-white border-b border-slate-100 p-5 sm:p-6 relative flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0 shadow-xs">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900">
                                Xác Nhận Đơn Đặt Phòng
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Quý khách vui lòng kiểm tra lại thông tin chi tiết trước khi hoàn tất
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition p-2 rounded-xl cursor-pointer disabled:opacity-50"
                        title="Đóng"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 sm:p-6 space-y-4 max-h-[calc(85vh-160px)] overflow-y-auto text-xs sm:text-sm">
                    {/* Thông báo lỗi nếu có */}
                    {modalError && (
                        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2.5 animate-in fade-in duration-150">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <strong className="font-bold block text-rose-800">Không thể tạo đơn đặt phòng:</strong>
                                <span className="mt-0.5 block">{modalError}</span>
                            </div>
                        </div>
                    )}

                    {/* 1. Thông tin phòng & Lưu trú */}
                    <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-200/70 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                                    {room?.category_name || 'Hạng phòng tiêu chuẩn'}
                                </span>
                                <h4 className="font-serif text-base sm:text-lg font-bold text-slate-900 mt-1">
                                    {room?.name || 'Phòng nghỉ'}
                                </h4>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="text-xs text-slate-500 block">Thời gian lưu trú</span>
                                <span className="font-black text-amber-700 text-sm">{nights} đêm</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-200/60 text-xs">
                            <div className="flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-amber-600 shrink-0" />
                                <div>
                                    <span className="text-slate-500 text-[11px] block">Nhận phòng ({hotelSettings.check_in_time || '14:00'})</span>
                                    <strong className="text-slate-800">{formatDateDisplay(checkInDate)}</strong>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-amber-600 shrink-0" />
                                <div>
                                    <span className="text-slate-500 text-[11px] block">Trả phòng ({hotelSettings.check_out_time || '12:00'})</span>
                                    <strong className="text-slate-800">{formatDateDisplay(checkOutDate)}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Thông tin khách đặt & Người lưu trú */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Thông tin khách lưu trú
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                            <div>
                                <span className="text-slate-400 block text-[11px]">Khách đặt phòng:</span>
                                <span className="font-bold text-slate-800">{guestName}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Số điện thoại:</span>
                                <span className="font-bold text-slate-800">{guestPhone}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Email xác nhận:</span>
                                <span className="font-bold text-slate-800">{guestEmail}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">CCCD / Hộ chiếu:</span>
                                <span className="font-bold text-slate-800">{identityCard.trim().toUpperCase()}</span>
                            </div>
                        </div>

                        {customerType === 'CORPORATE' && (
                            <div className="pt-2.5 mt-2 border-t border-slate-200 text-xs space-y-1">
                                <div className="flex items-center gap-1.5 text-blue-700 font-bold">
                                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>Doanh nghiệp: {companyName}</span>
                                </div>
                                <div className="text-slate-600 text-[11px]">
                                    Mã số thuế: <strong className="text-slate-800">{companyTaxCode}</strong>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3. Dịch vụ đã chọn kèm (nếu có) */}
                    {selectedServicesArray.length > 0 && (
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                Dịch vụ chọn kèm ({selectedServicesArray.length})
                            </span>
                            <div className="space-y-1 text-xs">
                                {selectedServicesArray.map((svc) => (
                                    <div key={svc.service_id} className="flex justify-between items-center text-slate-700">
                                        <span>{svc.name} × {svc.quantity}</span>
                                        <span className="font-bold text-slate-800">{Number(svc.total_price).toLocaleString('vi-VN')} VND</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 4. Hình thức thanh toán & Chi tiết tài chính */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                            Chi tiết thanh toán
                        </span>
                        <div className="space-y-1.5 text-xs font-sans tabular-nums">
                            <div className="flex justify-between text-slate-600">
                                <span>Tiền phòng ({nights} đêm):</span>
                                <span className="font-semibold text-slate-800">{Number(roomNetTotal).toLocaleString('vi-VN')} VND</span>
                            </div>
                            {totalServicesAmount > 0 && (
                                <div className="flex justify-between text-slate-600">
                                    <span>Phí dịch vụ chọn kèm:</span>
                                    <span className="font-semibold text-slate-800">+{Number(totalServicesAmount).toLocaleString('vi-VN')} VND</span>
                                </div>
                            )}
                            {appliedPromo && discountAmount > 0 && (
                                <div className="flex justify-between text-emerald-600 font-medium">
                                    <span>Mã giảm giá ({appliedPromo.code}):</span>
                                    <span>-{Number(discountAmount).toLocaleString('vi-VN')} VND</span>
                                </div>
                            )}
                            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                                <span className="font-bold text-slate-900 text-sm">Tổng cộng thanh toán:</span>
                                <span className="text-xl font-black text-rose-600">
                                    {Number(finalTotal).toLocaleString('vi-VN')} VND
                                </span>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                            <span className="text-slate-500">Hình thức thanh toán:</span>
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                {paymentMethod === 'vietqr' ? (
                                    <>
                                        <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Chuyển khoản VietQR</span>
                                    </>
                                ) : (
                                    <>
                                        <Building2 className="w-3.5 h-3.5 text-slate-600" />
                                        <span>Thanh toán tại quầy lễ tân</span>
                                    </>
                                )}
                            </span>
                        </div>
                    </div>

                    {/* 5. Ghi chú chính sách */}
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-xl text-[11px] text-emerald-800 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Chính sách: {room?.cancellation_policy ? 'Áp dụng theo quy định của phòng' : 'Miễn phí hủy trước 24 giờ'}</span>
                        </div>
                        <p className="text-emerald-700/90 pl-5.5">
                            {paymentMethod === 'vietqr'
                                ? 'Sau khi bấm xác nhận, hệ thống sẽ mở mã QR VietQR để quý khách quét thanh toán.'
                                : 'Đơn đặt phòng sẽ được tiếp nhận ngay. Quý khách vui lòng thanh toán trực tiếp tại quầy khi nhận phòng.'}
                        </p>
                    </div>
                </div>

                {/* Modal Actions */}
                <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                    >
                        Kiểm tra lại
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-900/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Đang xử lý đơn đặt phòng...</span>
                            </>
                        ) : (
                            <>
                                <ShieldCheck className="w-4 h-4" />
                                <span>Xác Nhận & Đặt Phòng Ngay</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

