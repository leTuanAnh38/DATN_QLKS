import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2,
    Users,
    Award,
    AlertCircle,
    ShieldCheck,
    ArrowRight,
    PhoneCall
} from 'lucide-react';

export default function RoomBookingWidget({
    room,
    settings = {},
    totalPricePerNight = 0,
    hasPromo = false,
    discountPercent = 0,
    basePriceNum = 0,
    checkInDate,
    setCheckInDate,
    checkOutDate,
    setCheckOutDate,
    guestCount = 1,
    setGuestCount,
    nights = 1,
    roomSubtotal = 0,
    earnedPoints = 0,
    finalTotal = 0,
    availability = null,
    selectedPackage = 'standard',
    formatDateToInput,
    getNextDayString
}) {
    const navigate = useNavigate();

    const handleGoToCheckout = () => {
        const validatedCheckOut =
            checkOutDate > checkInDate ? checkOutDate : getNextDayString(checkInDate);
        navigate(`/checkout/${room.id}`, {
            state: {
                checkInDate,
                checkOutDate: validatedCheckOut,
                guestCount,
                selectedPackage
            }
        });
    };

    return (
        <>
            {/* CỘT PHẢI: STICKY BOOKING WIDGET (4 COLS TRÊN DESKTOP) */}
            <div className="lg:col-span-4" id="dat-phong">
                <div className="sticky top-28 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-900/5 p-6 space-y-6">
                    {/* Khối giá hiển thị động */}
                    <div className="pb-5 border-b border-slate-100">
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span className="uppercase font-bold tracking-wider text-amber-600">
                                Giá ưu đãi đặt trực tiếp
                            </span>
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Giá tốt nhất
                            </span>
                        </div>

                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-slate-900">
                                {totalPricePerNight.toLocaleString('vi-VN')}
                            </span>
                            <span className="text-xs font-bold text-slate-500 uppercase">VND / đêm</span>
                        </div>

                        {hasPromo && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-slate-400 line-through">
                                    {basePriceNum.toLocaleString('vi-VN')} VND
                                </span>
                                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                                    Tiết kiệm {discountPercent}%
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Ngày lưu trú */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Thời gian lưu trú
                        </label>
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                            <div className="border-r border-slate-200 pr-2">
                                <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                                    Nhận phòng
                                </span>
                                <input
                                    type="date"
                                    min={formatDateToInput ? formatDateToInput(new Date()) : undefined}
                                    value={checkInDate}
                                    onChange={(e) => {
                                        const newIn = e.target.value;
                                        setCheckInDate(newIn);
                                        if (newIn >= checkOutDate && getNextDayString) {
                                            setCheckOutDate(getNextDayString(newIn));
                                        }
                                    }}
                                    className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer mt-0.5"
                                />
                            </div>
                            <div className="pl-2">
                                <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                                    Trả phòng
                                </span>
                                <input
                                    type="date"
                                    min={getNextDayString ? getNextDayString(checkInDate) : undefined}
                                    value={checkOutDate}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val > checkInDate) {
                                            setCheckOutDate(val);
                                        } else if (getNextDayString) {
                                            setCheckOutDate(getNextDayString(checkInDate));
                                        }
                                    }}
                                    className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer mt-0.5"
                                />
                            </div>
                        </div>
                        <span className="block text-right text-[11px] text-amber-600 font-semibold mt-1">
                            Thời gian: {nights} đêm lưu trú
                        </span>
                    </div>

                    {/* Số lượng khách */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Số lượng khách
                        </label>
                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                                <Users className="w-4 h-4 text-slate-500" />
                                <span>
                                    {guestCount} Người lớn (Tối đa {room.capacity || 2} người)
                                </span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    type="button"
                                    onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                >
                                    -
                                </button>
                                <span className="text-xs font-bold">{guestCount}</span>
                                <button
                                    type="button"
                                    onClick={() => setGuestCount(Math.min(room.capacity || 4, guestCount + 1))}
                                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Bảng chiết tính chi phí minh bạch */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                        <div className="flex justify-between text-slate-600">
                            <span>
                                {totalPricePerNight.toLocaleString('vi-VN')} VND x {nights} đêm
                            </span>
                            <span>{roomSubtotal.toLocaleString('vi-VN')} VND</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                            <span>Thuế VAT & Phí phục vụ</span>
                            <span className="text-emerald-600 font-semibold">Đã bao gồm</span>
                        </div>
                        <div className="flex justify-between text-amber-700 font-semibold pt-1 border-t border-slate-200">
                            <span className="flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5 text-amber-600" /> Tích lũy điểm thưởng
                            </span>
                            <span>+{earnedPoints.toLocaleString('vi-VN')} điểm</span>
                        </div>
                        <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                            <span className="font-bold text-slate-900 text-sm">Tổng thanh toán dự kiến</span>
                            <div className="text-right">
                                <span className="font-black text-xl text-orange-600">
                                    {finalTotal.toLocaleString('vi-VN')}
                                </span>
                                <span className="text-[11px] text-slate-500 font-bold block">VND</span>
                            </div>
                        </div>
                    </div>

                    {/* Thông báo tình trạng phòng trống */}
                    {availability && (
                        <div>
                            {availability.is_sold_out ? (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
                                    <div className="font-bold flex items-center gap-1.5">
                                        <AlertCircle className="w-4 h-4 text-rose-500" />
                                        <span>Hạng phòng này hiện đã kín chỗ cho hôm nay!</span>
                                    </div>
                                    <p className="text-[11px] text-rose-700">
                                        Quý khách có thể bấm Tiến hành đặt phòng để chọn ngày lưu trú khác còn trống.
                                    </p>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between text-xs text-emerald-800 bg-emerald-50/80 px-3 py-2 rounded-xl border border-emerald-200">
                                    <span className="font-medium flex items-center gap-1.5">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Sẵn sàng đón khách
                                    </span>
                                    <span className="font-bold text-emerald-700 bg-emerald-100/60 px-2.5 py-0.5 rounded-full border border-emerald-300 inline-flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Còn {availability.available_rooms} phòng trống
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Nút bấm Đặt phòng */}
                    <button
                        type="button"
                        onClick={handleGoToCheckout}
                        className="group relative w-full py-4 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-sm rounded-2xl shadow-xl shadow-sky-900/20 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all overflow-hidden cursor-pointer"
                    >
                        <span className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-out pointer-events-none" />
                        <ShieldCheck className="w-4 h-4 text-white/90" />
                        <span>Tiến Hành Đặt Phòng Ngay</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>

                    {/* Cam kết tin cậy */}
                    <div className="space-y-2 pt-2 text-[11px] text-slate-500">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>
                                Cam kết giá tốt nhất trực tiếp từ {settings?.hotel_name || 'Khách Sạn TA Đà Nẵng'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>
                                Miễn phí hủy phòng trước {settings?.cancellation_free_hours || 24} giờ nhận phòng
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="flex items-center gap-1">
                                Hỗ trợ tư vấn phòng VIP:{' '}
                                <PhoneCall className="w-3 h-3 text-amber-500 inline" />{' '}
                                <strong className="text-slate-700">{settings?.hotline || '1900 8899'}</strong>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* STICKY BOTTOM BAR DÀNH RIÊNG CHO ĐIỆN THOẠI DI ĐỘNG */}
            <aside
                aria-label="Thanh đặt phòng di động"
                className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 shadow-[0_-8px_25px_-5px_rgba(0,0,0,0.1)] flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom duration-300"
            >
                <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                        Giá phòng trực tiếp
                    </span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-black text-orange-600 truncate">
                            {totalPricePerNight.toLocaleString('vi-VN')}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">VND/đêm</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            const el = document.getElementById('dat-phong');
                            if (el) {
                                el.scrollIntoView({ behavior: 'smooth' });
                            } else {
                                handleGoToCheckout();
                            }
                        }}
                        className="group relative px-5 py-2.5 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-sky-900/20 active:scale-95 transition-all flex items-center gap-2 overflow-hidden cursor-pointer"
                    >
                        <ShieldCheck className="w-4 h-4 text-white/90" />
                        <span>Đặt phòng ngay</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </aside>
        </>
    );
}

