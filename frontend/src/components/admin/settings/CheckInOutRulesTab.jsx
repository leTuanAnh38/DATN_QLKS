import React, { useState } from 'react';
import {
    Clock,
    RefreshCw,
    Calendar,
    ArrowDownRight,
    ArrowUpRight,
    Edit3,
    Save,
    Calculator,
    Info
} from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

export default function CheckInOutRulesTab({
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
    // Trình mô phỏng tính phụ thu trực quan nội bộ
    const [simType, setSimType] = useState('late_checkout'); // 'early_checkin' | 'late_checkout'
    const [simHour, setSimHour] = useState('14:30');
    const [simRoomRate, setSimRoomRate] = useState(1500000);

    const calculateSimSurcharge = () => {
        const rate = Number(simRoomRate) || 0;
        const [h, m] = (simHour || '12:00').split(':').map(Number);
        const timeDecimal = (h || 0) + (m || 0) / 60;

        if (simType === 'early_checkin') {
            if (timeDecimal < 6) {
                const percent = Number(hotelData.early_checkin_before_6am) || 100;
                return { percent, amount: (rate * percent) / 100, rule: 'Trước 06:00 sáng' };
            }
            if (timeDecimal < 9) {
                const percent = Number(hotelData.early_checkin_6am_9am) || 50;
                return { percent, amount: (rate * percent) / 100, rule: '06:00 - 09:00 sáng' };
            }
            if (timeDecimal < 14) {
                const percent = Number(hotelData.early_checkin_9am_12pm) || 30;
                return { percent, amount: (rate * percent) / 100, rule: '09:00 - 14:00 trưa' };
            }
            return { percent: 0, amount: 0, rule: 'Đúng / Sau giờ Check-in chuẩn (14:00)' };
        } else {
            // Late checkout (chuẩn 12:00)
            if (timeDecimal <= 12) {
                return { percent: 0, amount: 0, rule: 'Đúng giờ Check-out chuẩn (<= 12:00)' };
            }
            if (timeDecimal <= 15) {
                const percent = Number(hotelData.late_checkout_12pm_3pm) || 30;
                return { percent, amount: (rate * percent) / 100, rule: '12:00 - 15:00 chiều' };
            }
            if (timeDecimal <= 18) {
                const percent = Number(hotelData.late_checkout_3pm_6pm) || 50;
                return { percent, amount: (rate * percent) / 100, rule: '15:00 - 18:00 chiều' };
            }
            const percent = Number(hotelData.late_checkout_after_6pm) || 100;
            return { percent, amount: (rate * percent) / 100, rule: 'Sau 18:00 tối (100% đêm)' };
        }
    };

    const simResult = calculateSimSurcharge();

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden animate-fadeIn">
            <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                            <span>Quy Định Giờ Giấc & Phụ Thu Quá Giờ</span>
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
                            Khung giờ nhận/trả phòng tiêu chuẩn và tỷ lệ % phụ thu khi khách check-in sớm hoặc check-out muộn
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
                        {/* CỘT TRÁI: FORM CẤU HÌNH (7 CỘT) */}
                        <div className="lg:col-span-7 space-y-6">
                            {/* 1. KHUNG GIỜ TIÊU CHUẨN */}
                            <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-3">
                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-blue-600" />
                                    <span>Khung Giờ Nhận & Trả Phòng Chuẩn</span>
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-slate-200">
                                        <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                                            <span>Giờ Check-in tiêu chuẩn</span>
                                            <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">Mặc định 14:00</span>
                                        </label>
                                        <input
                                            type="time"
                                            value={hotelData.check_in_time || '14:00'}
                                            onChange={(e) => setHotelData({ ...hotelData, check_in_time: e.target.value })}
                                            disabled={!isEditingHotel}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold font-mono text-slate-900"
                                        />
                                    </div>
                                    <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-slate-200">
                                        <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                                            <span>Giờ Check-out tiêu chuẩn</span>
                                            <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded">Mặc định 12:00</span>
                                        </label>
                                        <input
                                            type="time"
                                            value={hotelData.check_out_time || '12:00'}
                                            onChange={(e) => setHotelData({ ...hotelData, check_out_time: e.target.value })}
                                            disabled={!isEditingHotel}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold font-mono text-slate-900"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 2. BẢNG PHỤ THU CHECK-IN SỚM */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                                    <span>Mức Phụ Thu Nhận Phòng Sớm (Early Check-in)</span>
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200">
                                        <div className="text-xs">
                                            <strong className="text-slate-800 block">Trước 06:00 sáng</strong>
                                            <span className="text-slate-500 text-[11px]">Nhận phòng vào ban đêm</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="number"
                                                min={0}
                                                max={200}
                                                value={hotelData.early_checkin_before_6am}
                                                onChange={(e) => setHotelData({ ...hotelData, early_checkin_before_6am: Number(e.target.value) })}
                                                disabled={!isEditingHotel}
                                                className="w-20 px-3 py-1.5 text-right font-bold text-sm border rounded-lg"
                                            />
                                            <span className="text-xs font-bold text-slate-500">%</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200">
                                        <div className="text-xs">
                                            <strong className="text-slate-800 block">Từ 06:00 - 09:00 sáng</strong>
                                            <span className="text-slate-500 text-[11px]">Nhận phòng sáng sớm</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="number"
                                                min={0}
                                                max={200}
                                                value={hotelData.early_checkin_6am_9am}
                                                onChange={(e) => setHotelData({ ...hotelData, early_checkin_6am_9am: Number(e.target.value) })}
                                                disabled={!isEditingHotel}
                                                className="w-20 px-3 py-1.5 text-right font-bold text-sm border rounded-lg"
                                            />
                                            <span className="text-xs font-bold text-slate-500">%</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200">
                                        <div className="text-xs">
                                            <strong className="text-slate-800 block">Từ 09:00 - 14:00 trưa</strong>
                                            <span className="text-slate-500 text-[11px]">Nhận phòng trước giờ chuẩn</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="number"
                                                min={0}
                                                max={200}
                                                value={hotelData.early_checkin_9am_12pm}
                                                onChange={(e) => setHotelData({ ...hotelData, early_checkin_9am_12pm: Number(e.target.value) })}
                                                disabled={!isEditingHotel}
                                                className="w-20 px-3 py-1.5 text-right font-bold text-sm border rounded-lg"
                                            />
                                            <span className="text-xs font-bold text-slate-500">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. BẢNG PHỤ THU CHECK-OUT MUỘN */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <ArrowUpRight className="w-4 h-4 text-amber-600" />
                                    <span>Mức Phụ Thu Trả Phòng Muộn (Late Check-out)</span>
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200">
                                        <div className="text-xs">
                                            <strong className="text-slate-800 block">Từ 12:00 - 15:00 chiều</strong>
                                            <span className="text-slate-500 text-[11px]">Trễ dưới 3 tiếng</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="number"
                                                min={0}
                                                max={200}
                                                value={hotelData.late_checkout_12pm_3pm}
                                                onChange={(e) => setHotelData({ ...hotelData, late_checkout_12pm_3pm: Number(e.target.value) })}
                                                disabled={!isEditingHotel}
                                                className="w-20 px-3 py-1.5 text-right font-bold text-sm border rounded-lg"
                                            />
                                            <span className="text-xs font-bold text-slate-500">%</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200">
                                        <div className="text-xs">
                                            <strong className="text-slate-800 block">Từ 15:00 - 18:00 chiều</strong>
                                            <span className="text-slate-500 text-[11px]">Trễ bán ngày</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="number"
                                                min={0}
                                                max={200}
                                                value={hotelData.late_checkout_3pm_6pm}
                                                onChange={(e) => setHotelData({ ...hotelData, late_checkout_3pm_6pm: Number(e.target.value) })}
                                                disabled={!isEditingHotel}
                                                className="w-20 px-3 py-1.5 text-right font-bold text-sm border rounded-lg"
                                            />
                                            <span className="text-xs font-bold text-slate-500">%</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200">
                                        <div className="text-xs">
                                            <strong className="text-slate-800 block">Sau 18:00 tối</strong>
                                            <span className="text-slate-500 text-[11px]">Tính trọn tiền phòng 1 đêm</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="number"
                                                min={0}
                                                max={200}
                                                value={hotelData.late_checkout_after_6pm}
                                                onChange={(e) => setHotelData({ ...hotelData, late_checkout_after_6pm: Number(e.target.value) })}
                                                disabled={!isEditingHotel}
                                                className="w-20 px-3 py-1.5 text-right font-bold text-sm border rounded-lg"
                                            />
                                            <span className="text-xs font-bold text-slate-500">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* NÚT LƯU CẤU HÌNH */}
                            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                                {!isEditingHotel ? (
                                    canUpdateSettings ? (
                                        <button
                                            type="button"
                                            onClick={onStartEdit}
                                            disabled={isLoading}
                                            className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                            <span>Cập nhật giờ giấc & phụ thu</span>
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
                                            <span>Lưu quy định</span>
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

                        {/* CỘT PHẢI: LIVE SURCHARGE SIMULATOR (5 CỘT) */}
                        <div className="lg:col-span-5 bg-gradient-to-b from-indigo-50/70 via-white to-slate-50 rounded-3xl p-6 border border-indigo-100 shadow-sm space-y-5">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                                    <Calculator className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                                        Bộ Tính Thử Phụ Thu (Live Simulator)
                                    </h4>
                                    <p className="text-[11px] text-slate-500">Thử nghiệm công thức tính phụ thu tự động</p>
                                </div>
                            </div>

                            {/* Input giả lập */}
                            <div className="space-y-3 bg-white p-4 rounded-2xl border border-indigo-100 text-xs">
                                <div>
                                    <label className="block text-slate-600 font-medium mb-1">Loại tình huống:</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { setSimType('late_checkout'); setSimHour('14:30'); }}
                                            className={`py-2 px-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                                                simType === 'late_checkout'
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                            }`}
                                        >
                                            Check-out Muộn
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setSimType('early_checkin'); setSimHour('07:30'); }}
                                            className={`py-2 px-3 rounded-xl border text-center font-bold transition cursor-pointer ${
                                                simType === 'early_checkin'
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                            }`}
                                        >
                                            Check-in Sớm
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-slate-600 font-medium mb-1">Giờ khách thực tế:</label>
                                        <input
                                            type="time"
                                            value={simHour}
                                            onChange={(e) => setSimHour(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold font-mono text-slate-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-600 font-medium mb-1">Giá phòng 1 đêm:</label>
                                        <input
                                            type="number"
                                            step={100000}
                                            value={simRoomRate}
                                            onChange={(e) => setSimRoomRate(Number(e.target.value))}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-900"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* KẾT QUẢ MÔ PHỎNG */}
                            <div className="bg-white rounded-2xl p-5 border border-indigo-200/80 shadow-xs space-y-3">
                                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                                    <span className="text-slate-500">Khung giờ áp dụng:</span>
                                    <strong className="text-indigo-700 font-semibold">{simResult.rule}</strong>
                                </div>
                                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                                    <span className="text-slate-500">Tỷ lệ phụ thu:</span>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800">
                                        +{simResult.percent}%
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                    <span className="text-xs font-bold text-slate-700">Tiền phụ thu tự động:</span>
                                    <strong className="text-base font-black text-rose-600 font-mono">
                                        +{formatCurrency(simResult.amount)}
                                    </strong>
                                </div>
                            </div>

                            <div className="p-3 bg-blue-50/70 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
                                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                <span>Quy chuẩn phụ thu này giúp Lễ tân tự động tính toán phụ thu chính xác trong Modal Check-in và Check-out mà không cần tính nhẩm.</span>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

