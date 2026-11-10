import React from 'react';
import {
    Percent,
    RefreshCw,
    Edit3,
    Save,
    FileText
} from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

export default function PoliciesTab({
    hotelData,
    setHotelData,
    isEditingHotel,
    isSavingHotel,
    isLoading,
    canUpdateSettings,
    onStartEdit,
    onCancelEdit,
    onSubmit,
}) {
    const mockRoomPrice = 2000000;
    const mockServiceFee = (mockRoomPrice * (Number(hotelData.service_charge_percent) || 0)) / 100;
    const mockVatFee = (mockRoomPrice * (Number(hotelData.vat_percent) || 0)) / 100;
    const mockTotal = mockRoomPrice + mockServiceFee + mockVatFee;

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden animate-fadeIn">
            <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
                        <Percent className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                            <span>Chính Sách Thuế VAT, Phí Dịch Vụ & Đặt Cọc</span>
                            {isEditingHotel ? (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                    Đang chỉnh sửa
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                    Chế độ xem
                                </span>
                            )}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Các thông số tài chính áp dụng cho Hóa đơn thanh toán, đơn đặt đoàn và điều khoản hủy phòng
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-6 sm:p-8">
                {isLoading ? (
                    <div className="py-16 text-center text-slate-400">
                        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-slate-600">Đang tải cấu hình...</p>
                    </div>
                ) : (
                    <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* CỘT TRÁI: FORM CHÍNH SÁCH (7 CỘT) */}
                        <div className="lg:col-span-7 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* THUẾ VAT */}
                                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-800">Thuế GTGT / VAT (%)</label>
                                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">Theo luật Thuế</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            max={30}
                                            step={0.5}
                                            value={hotelData.vat_percent}
                                            onChange={(e) => setHotelData({ ...hotelData, vat_percent: Number(e.target.value) })}
                                            disabled={!isEditingHotel}
                                            className="w-full px-3 py-2 text-base font-bold font-mono rounded-xl border border-slate-200"
                                        />
                                        <span className="font-bold text-slate-500 text-sm">%</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400">Hiện tại theo chính sách thuế là 8% hoặc 10%.</p>
                                </div>

                                {/* PHÍ PHỤC VỤ (SERVICE CHARGE) */}
                                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-800">Phí Phục Vụ (Service %)</label>
                                        <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-semibold">Chuẩn {hotelData.stars || 5} Sao</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            max={20}
                                            step={0.5}
                                            value={hotelData.service_charge_percent}
                                            onChange={(e) => setHotelData({ ...hotelData, service_charge_percent: Number(e.target.value) })}
                                            disabled={!isEditingHotel}
                                            className="w-full px-3 py-2 text-base font-bold font-mono rounded-xl border border-slate-200"
                                        />
                                        <span className="font-bold text-slate-500 text-sm">%</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400">Phí phục vụ khách sạn {hotelData.stars || 5} sao thông thường là {hotelData.service_charge_percent}%.</p>
                                </div>

                                {/* TỶ LỆ CỌC ĐOÀN */}
                                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-800">Tỷ Lệ Cọc Đặt Đoàn (%)</label>
                                        <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-semibold">Khách đoàn B2B</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={10}
                                            max={100}
                                            value={hotelData.group_deposit_percent}
                                            onChange={(e) => setHotelData({ ...hotelData, group_deposit_percent: Number(e.target.value) })}
                                            disabled={!isEditingHotel}
                                            className="w-full px-3 py-2 text-base font-bold font-mono rounded-xl border border-slate-200"
                                        />
                                        <span className="font-bold text-slate-500 text-sm">%</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400">Mức tiền cọc tối thiểu để chốt giữ chỗ đoàn (Thường 50%).</p>
                                </div>

                                {/* THỜI GIAN GIỮ PHÒNG CHỜ THANH TOÁN */}
                                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-800">Hạn Giữ Chỗ Tự Động</label>
                                        <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-semibold">Timeout</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={5}
                                            max={120}
                                            value={hotelData.auto_cancel_minutes}
                                            onChange={(e) => setHotelData({ ...hotelData, auto_cancel_minutes: Number(e.target.value) })}
                                            disabled={!isEditingHotel}
                                            className="w-full px-3 py-2 text-base font-bold font-mono rounded-xl border border-slate-200"
                                        />
                                        <span className="text-xs font-bold text-slate-500 shrink-0">Phút</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400">Hủy đơn tự động nếu khách không quét mã VietQR thanh toán.</p>
                                </div>

                                {/* HỦY PHÒNG MIỄN PHÍ TRƯỚC (GIỜ) */}
                                <div className="sm:col-span-2 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-800">Thời Hạn Hủy Phòng Miễn Phí (Cancellation Policy)</label>
                                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold">Chính sách linh hoạt</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={12}
                                            max={168}
                                            value={hotelData.cancellation_free_hours}
                                            onChange={(e) => setHotelData({ ...hotelData, cancellation_free_hours: Number(e.target.value) })}
                                            disabled={!isEditingHotel}
                                            className="w-32 px-3 py-2 text-base font-bold font-mono rounded-xl border border-slate-200"
                                        />
                                        <span className="text-xs font-bold text-slate-500">Giờ trước ngày nhận phòng (VD: 48 giờ = 2 ngày)</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400">Sau thời gian này nếu khách hủy đơn sẽ bị tính phí cọc đêm đầu tiên.</p>
                                </div>
                            </div>

                            {/* NÚT LƯU */}
                            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                                {!isEditingHotel ? (
                                    canUpdateSettings ? (
                                        <button
                                            type="button"
                                            onClick={onStartEdit}
                                            disabled={isLoading}
                                            className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                            <span>Cập nhật chính sách thuế & cọc</span>
                                        </button>
                                    ) : (
                                        <div className="text-xs text-slate-500">Chế độ xem</div>
                                    )
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="submit"
                                            disabled={isSavingHotel}
                                            className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                        >
                                            <Save className="w-4 h-4" />
                                            <span>Lưu chính sách</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={onCancelEdit}
                                            className="px-5 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold transition cursor-pointer"
                                        >
                                            Hủy
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* CỘT PHẢI: TỔNG QUAN TÀI CHÍNH MẪU (5 CỘT) */}
                        <div className="lg:col-span-5 bg-slate-50/70 border border-slate-200/80 rounded-3xl p-6 space-y-4">
                            <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                <FileText className="w-4 h-4 text-emerald-600" />
                                <span>Cơ Cấu Giá Hóa Đơn Chuẩn (Mô Phỏng 2,000,000đ)</span>
                            </h4>

                            <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2.5 text-xs">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <span className="text-slate-500">Tiền phòng thuần:</span>
                                    <strong className="text-slate-900 font-mono">2,000,000đ</strong>
                                </div>
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <span className="text-slate-500">Phí phục vụ ({hotelData.service_charge_percent}%):</span>
                                    <span className="text-slate-700 font-mono">
                                        +{formatCurrency(mockServiceFee)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <span className="text-slate-500">Thuế GTGT / VAT ({hotelData.vat_percent}%):</span>
                                    <span className="text-slate-700 font-mono">
                                        +{formatCurrency(mockVatFee)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                    <span className="font-bold text-slate-900">Tổng thanh toán:</span>
                                    <strong className="text-sm font-black text-emerald-700 font-mono">
                                        {formatCurrency(mockTotal)}
                                    </strong>
                                </div>
                            </div>

                            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                                <p className="font-bold">Đơn Đoàn Master (Corporate Booking):</p>
                                <p className="text-[11px] text-emerald-800 leading-relaxed">
                                    Với mức cọc <strong>{hotelData.group_deposit_percent}%</strong>, doanh nghiệp sẽ quét mã VietQR đặt cọc trước một nửa để giữ phòng, số còn lại quyết toán khi Check-out.
                                </p>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

