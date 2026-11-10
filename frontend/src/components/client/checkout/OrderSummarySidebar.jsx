import React from 'react';
import {
    Maximize2,
    Users,
    BellRing,
    Star,
    AlertCircle,
    ShieldCheck,
    ArrowRight,
    CheckCircle2,
    PhoneCall
} from 'lucide-react';

export default function OrderSummarySidebar({
    room,
    primaryImage,
    starCount = 5,
    checkInDate,
    checkOutDate,
    nights = 1,
    pricePerNight = 0,
    subtotal = 0,
    selectedServicesArray = [],
    totalServicesAmount = 0,
    userTier = null,
    tierDiscountAmount = 0,
    tierDiscountPercent = 0,
    appliedPromo = null,
    discountAmount = 0,
    hotelSettings = {},
    earnedPoints = 0,
    finalTotal = 0,
    bookingError = null,
    availability = null,
    isSubmitting = false,
    formatDateDisplay = (d) => d
}) {
    return (
        <div className="lg:col-span-4 h-full">
            <div className="lg:sticky lg:top-24 bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-900/5 p-5 sm:p-6 space-y-4 sm:space-y-5 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
                {/* Thẻ phòng thu nhỏ */}
                <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                        Chi tiết phòng đã chọn
                    </span>
                    <div className="flex gap-4">
                        <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 relative border border-slate-100">
                            <img
                                src={primaryImage}
                                alt={room?.name || 'Phòng'}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold uppercase block w-fit mb-1 border border-amber-200/80">
                                {starCount}-STAR SUITE
                            </span>
                            <h3 className="font-serif font-bold text-base text-slate-900 leading-snug line-clamp-2">
                                {room?.name}
                            </h3>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5">
                                <span className="flex items-center gap-1">
                                    <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{room?.size || 40} m²</span>
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{room?.capacity || 2} khách</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Thông tin Lịch lưu trú tóm tắt */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                        <span>Nhận phòng:</span>
                        <strong className="text-slate-900">
                            {formatDateDisplay(checkInDate)} ({hotelSettings.check_in_time || '14:00'})
                        </strong>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                        <span>Trả phòng:</span>
                        <strong className="text-slate-900">
                            {formatDateDisplay(checkOutDate)} ({hotelSettings.check_out_time || '12:00'})
                        </strong>
                    </div>
                    <div className="flex justify-between items-center text-amber-800 font-semibold pt-1 border-t border-slate-200">
                        <span>Tổng thời gian:</span>
                        <span>{nights} đêm lưu trú</span>
                    </div>
                </div>

                {/* BẢNG KÊ CHI TIẾT TỔNG TIỀN (ORDER SUMMARY) */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs">
                    {/* 1. Tiền phòng gốc */}
                    <div className="flex justify-between text-slate-700">
                        <span>
                            Tiền phòng ({pricePerNight.toLocaleString('vi-VN')} ₫ × {nights} đêm)
                        </span>
                        <span className="font-bold text-slate-900">
                            {subtotal.toLocaleString('vi-VN')} VND
                        </span>
                    </div>

                    {/* 2. Dịch vụ tiện ích gợi ý đi kèm (Liệt kê chi tiết từng món x số lượng) */}
                    {selectedServicesArray.length > 0 && (
                        <div className="pt-2 pb-1 border-t border-dashed border-amber-200/80 space-y-1.5 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60">
                            <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                                <span className="flex items-center gap-1.5">
                                    <BellRing className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Dịch vụ đi kèm ({selectedServicesArray.length}):</span>
                                </span>
                                <span className="text-orange-600 font-extrabold">
                                    +{totalServicesAmount.toLocaleString('vi-VN')} VND
                                </span>
                            </div>

                            <div className="space-y-1 pl-2 text-[11px] text-slate-600">
                                {selectedServicesArray.map((item) => (
                                    <div key={item.service_id} className="flex justify-between items-center">
                                        <span className="truncate max-w-[170px]" title={item.name}>
                                            • {item.name} <strong className="text-slate-800">×{item.quantity}</strong>
                                        </span>
                                        <span className="font-semibold text-slate-800 shrink-0">
                                            {item.total_price.toLocaleString('vi-VN')} ₫
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 3. Chiết khấu hạng thành viên */}
                    {tierDiscountAmount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-semibold">
                            <span>Chiết khấu hạng {userTier?.name} ({tierDiscountPercent}%)</span>
                            <span>-{tierDiscountAmount.toLocaleString('vi-VN')} VND</span>
                        </div>
                    )}

                    {/* 4. Mã khuyến mãi (Promo Code) */}
                    {discountAmount > 0 && (
                        <div className="flex justify-between text-amber-600 font-semibold">
                            <span>Mã khuyến mãi ({appliedPromo?.code})</span>
                            <span>-{discountAmount.toLocaleString('vi-VN')} VND</span>
                        </div>
                    )}

                    <div className="flex justify-between text-slate-500">
                        <span>Thuế VAT ({hotelSettings.vat_percent || 8}%) & Phí phục vụ ({hotelSettings.service_charge_percent || 5}%)</span>
                        <span className="text-emerald-600 font-medium">Đã bao gồm</span>
                    </div>

                    <div className="flex items-center justify-between text-amber-700 font-semibold pt-1 border-t border-slate-100">
                        <span className="flex items-center gap-1.5">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            <span>Tích lũy điểm thưởng (+1 pt / 100.000đ)</span>
                        </span>
                        <span>+{earnedPoints.toLocaleString('vi-VN')} điểm</span>
                    </div>

                    {/* Tổng cộng cần thanh toán */}
                    <div className="flex justify-between items-baseline pt-3 border-t border-slate-200">
                        <div>
                            <span className="font-bold text-slate-900 text-sm block">
                                Tổng cộng cần thanh toán
                            </span>
                            <span className="text-[10px] text-slate-400">
                                (Phòng + Dịch vụ đi kèm)
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="font-black text-2xl text-rose-600">
                                {finalTotal.toLocaleString('vi-VN')}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 block">VND</span>
                            {tierDiscountAmount > 0 && (
                                <span className="text-[10px] font-semibold text-emerald-600 block mt-0.5">
                                    (Đã tiết kiệm {tierDiscountAmount.toLocaleString('vi-VN')} VND)
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Thông báo lỗi khi submit nếu có */}
                {bookingError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>{bookingError}</span>
                    </div>
                )}

                {/* Cảnh báo hết phòng ở cột tóm tắt */}
                {availability?.is_sold_out && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>Hạng phòng đã hết chỗ cho ngày bạn chọn.</span>
                    </div>
                )}

                {/* NÚT BẤM XÁC NHẬN ĐẶT PHÒNG */}
                <button
                    type="submit"
                    disabled={isSubmitting || availability?.is_sold_out}
                    className={`w-full py-4 text-white font-bold text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all duration-300 relative overflow-hidden group ${
                        availability?.is_sold_out
                            ? 'bg-slate-400 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 shadow-sky-900/20 hover:shadow-lg hover:shadow-sky-500/25 hover:scale-[1.01] active:scale-[0.99] cursor-pointer'
                    }`}
                >
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform pointer-events-none" />
                    {isSubmitting ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Đang xử lý đơn đặt phòng...</span>
                        </>
                    ) : availability?.is_sold_out ? (
                        <span>Hạng Phòng Đã Hết (Vui Lòng Chọn Ngày Khác)</span>
                    ) : (
                        <>
                            <ShieldCheck className="w-5 h-5 shrink-0" />
                            <span>Xác Nhận Đặt Phòng Ngay</span>
                            <ArrowRight className="w-5 h-5 shrink-0 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>

                {/* Cam kết tin cậy */}
                <div className="space-y-1.5 pt-2 text-[11px] text-slate-500">
                    <div className="flex items-center gap-2 text-emerald-700 font-medium">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Chính sách hủy: {room?.cancellation_policy ? 'Áp dụng theo quy định riêng của hạng phòng' : 'Miễn phí hủy trước 24 giờ'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Nhận phòng nhanh chóng tại quầy Lễ tân</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <PhoneCall className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Hotline hỗ trợ 24/7: <strong className="text-slate-700">{hotelSettings.hotline || '1900 8899'}</strong></span>
                    </div>
                </div>
            </div>
        </div>
    );
}

