import React from 'react';
import { Building2, X, AlertCircle, CalendarDays, Receipt, ShieldCheck } from 'lucide-react';

/**
 * Modal rà soát và xác nhận hợp đồng đặt phòng đoàn B2B trước khi tạo đơn
 */
export default function CorporateConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    isSubmitting = false,
    modalError = null,
    groupName = '',
    leaderName = '',
    leaderPhone = '',
    leaderEmail = '',
    appliedPartner = null,
    discountPercent = 0,
    nights = 1,
    checkInDate = '',
    checkOutDate = '',
    hotelSettings = {},
    formatDateDisplay = (d) => d,
    categories = [],
    selectedRooms = {},
    formatCurrency = (val) => `${(Number(val) || 0).toLocaleString('vi-VN')} VND`,
    isCompanyInvoice = false,
    companyName = '',
    companyTaxCode = '',
    companyAddress = '',
    invoiceRecipientEmail = '',
    subtotalAmount = 0,
    totalRoomsCount = 0,
    totalDiscount = 0,
    totalServicesAmount = 0,
    grandTotal = 0,
    paymentOption = 'DEPOSIT_50',
    depositAmount = 0
}) {
    if (!isOpen) return null;

    return (
        <div
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
        >
            <div className="bg-white rounded-3xl border border-slate-200/80 max-w-2xl w-full shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-white border-b border-slate-100 p-5 sm:p-6 relative flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0 shadow-xs">
                            <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900">
                                Xác Nhận Hợp Đồng Đặt Phòng Đoàn
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Vui lòng rà soát lại thông tin đoàn và chi phí trước khi thanh toán
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition p-2 rounded-xl cursor-pointer"
                        title="Đóng"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 sm:p-6 space-y-4 max-h-[calc(85vh-160px)] overflow-y-auto text-xs sm:text-sm">
                    {/* Thông báo lỗi nếu có khi gọi API */}
                    {modalError && (
                        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2.5 animate-in fade-in duration-150">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <strong className="font-bold block text-rose-800">Không thể tạo đơn đặt đoàn:</strong>
                                <span className="mt-0.5 block">{modalError}</span>
                            </div>
                        </div>
                    )}

                    {/* 1. Thông tin đoàn & Người phụ trách */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                Thông tin đoàn & Trưởng đoàn
                            </span>
                            {appliedPartner && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                    Đối tác: {appliedPartner.partner_name} (-{discountPercent}%)
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                            <div>
                                <span className="text-slate-400 block text-[11px]">Tên đoàn:</span>
                                <strong className="text-slate-800 text-sm">{groupName.trim() || `Đoàn khách ${leaderName.trim()}`}</strong>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Trưởng đoàn / Phụ trách:</span>
                                <strong className="text-slate-800">{leaderName}</strong>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Số điện thoại:</span>
                                <strong className="text-slate-800">{leaderPhone}</strong>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px]">Email nhận hợp đồng:</span>
                                <strong className="text-slate-800">{leaderEmail || 'Chưa cung cấp'}</strong>
                            </div>
                        </div>
                    </div>

                    {/* 2. Thời gian đoàn lưu trú */}
                    <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-200/70 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                                Lịch trình lưu trú
                            </span>
                            <span className="font-black text-amber-800 text-sm">{nights} đêm</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
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

                    {/* 3. Danh sách phòng đã chọn */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                Danh sách hạng phòng đoàn
                            </span>
                            <span className="font-bold text-amber-700 text-xs">
                                Tổng cộng: {totalRoomsCount} phòng
                            </span>
                        </div>
                        <div className="divide-y divide-slate-200/70">
                            {categories.filter((cat) => Number(selectedRooms[cat.id]) > 0).map((cat) => {
                                const qty = Number(selectedRooms[cat.id]);
                                const unitPrice = Number(cat.promo_price || cat.base_price || 0);
                                const roomSubtotal = unitPrice * nights * qty;
                                return (
                                    <div key={cat.id} className="flex justify-between items-center py-2 text-xs">
                                        <div>
                                            <span className="font-bold text-slate-800">{cat.name}</span>
                                            <span className="text-slate-500 block text-[11px]">
                                                {qty} phòng × {nights} đêm × {formatCurrency(unitPrice)}/đêm
                                            </span>
                                        </div>
                                        <span className="font-bold text-slate-900 font-sans tabular-nums">
                                            {formatCurrency(roomSubtotal)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 4. Hóa đơn VAT (nếu có) */}
                    {isCompanyInvoice && (
                        <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-200/70 space-y-2 text-xs">
                            <div className="flex items-center gap-1.5 text-blue-900 font-bold uppercase tracking-wider text-[11px]">
                                <Receipt className="w-3.5 h-3.5" />
                                <span>Thông tin xuất hóa đơn VAT doanh nghiệp</span>
                            </div>
                            <div className="space-y-1 text-slate-700">
                                <div>Công ty: <strong className="text-slate-900">{companyName}</strong></div>
                                <div>Mã số thuế: <strong className="text-slate-900">{companyTaxCode}</strong></div>
                                <div>Địa chỉ: <span className="text-slate-800">{companyAddress}</span></div>
                                {invoiceRecipientEmail && (
                                    <div>Email nhận HĐĐT: <span className="text-slate-800">{invoiceRecipientEmail}</span></div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 5. Tóm tắt tài chính & Tiền cọc */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                            Chi tiết tài chính hợp đồng
                        </span>
                        <div className="space-y-1.5 text-xs font-sans tabular-nums">
                            <div className="flex justify-between text-slate-600">
                                <span>Tổng tiền phòng gốc ({totalRoomsCount} phòng × {nights} đêm):</span>
                                <span className="font-semibold text-slate-800">{formatCurrency(subtotalAmount)}</span>
                            </div>
                            {totalDiscount > 0 && (
                                <div className="flex justify-between text-emerald-600 font-medium">
                                    <span>Chiết khấu đối tác ({discountPercent}%):</span>
                                    <span>-{formatCurrency(totalDiscount)}</span>
                                </div>
                            )}
                            {totalServicesAmount > 0 && (
                                <div className="flex justify-between text-amber-700 font-medium">
                                    <span>Phí dịch vụ chọn kèm các phòng:</span>
                                    <span>+{formatCurrency(totalServicesAmount)}</span>
                                </div>
                            )}
                            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                                <span className="font-bold text-slate-900 text-sm">Tổng giá trị hợp đồng toàn đoàn:</span>
                                <span className="text-lg font-black text-slate-900">{formatCurrency(grandTotal)}</span>
                            </div>
                        </div>

                        {/* Khối tiền cọc cần thanh toán ngay */}
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 flex justify-between items-baseline">
                            <div>
                                <span className="font-bold text-amber-900 text-xs block">
                                    {paymentOption === 'FULL'
                                        ? 'Số tiền thanh toán ngay (100% Trọn gói):'
                                        : `Tiền đặt cọc giữ chỗ (${hotelSettings.group_deposit_percent || 50}% Tổng đơn):`}
                                </span>
                                {paymentOption !== 'FULL' && (
                                    <span className="text-[11px] text-amber-700">
                                        Còn lại {formatCurrency(grandTotal - depositAmount)} thanh toán khi nhận phòng
                                    </span>
                                )}
                            </div>
                            <span className="text-xl font-black text-amber-600 font-sans tabular-nums">
                                {formatCurrency(depositAmount)}
                            </span>
                        </div>
                    </div>

                    {/* 6. Hướng dẫn VietQR */}
                    <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-amber-900 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Quy trình thanh toán & Xác nhận tự động</span>
                        </div>
                        <p className="text-amber-800/90 pl-5.5">
                            {paymentOption === 'FULL'
                                ? 'Sau khi bấm xác nhận, hệ thống sẽ mở mã QR VietQR để Doanh nghiệp quét thanh toán toàn bộ 100%. Khách sạn sẽ liên hệ xác nhận trong vòng 15 phút.'
                                : `Sau khi bấm xác nhận, hệ thống sẽ mở mã QR VietQR để Doanh nghiệp quét thanh toán tiền cọc ${hotelSettings.group_deposit_percent || 50}%. Khách sạn sẽ liên hệ xác nhận trong vòng 15 phút.`}
                        </p>
                    </div>
                </div>

                {/* Modal Actions */}
                <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
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
                                <span>Đang xử lý đơn đoàn...</span>
                            </>
                        ) : (
                            <>
                                <Building2 className="w-4 h-4" />
                                <span>
                                    {paymentOption === 'FULL'
                                        ? `Xác Nhận & Thanh Toán 100% (${totalRoomsCount} phòng)`
                                        : `Xác Nhận & Đặt Cọc ${hotelSettings.group_deposit_percent || 50}% (${totalRoomsCount} phòng)`}
                                </span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

