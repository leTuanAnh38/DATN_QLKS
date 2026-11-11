import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    CheckCircle2,
    Check,
    Copy,
    BellRing,
    ArrowRight
} from 'lucide-react';
import PaymentModal from '../../common/PaymentModal';

export default function BookingSuccessModal({
    booking,
    hotelSettings = {},
    onPaymentClose,
    onPaymentSuccess,
    formatDateDisplay = (d) => d
}) {
    const navigate = useNavigate();
    const [copiedCode, setCopiedCode] = useState(false);

    if (!booking) return null;

    if (booking.payment_method === 'vietqr') {
        return (
            <PaymentModal
                isOpen={true}
                booking={booking}
                amount={booking.total_amount}
                bookingCode={booking.booking_code}
                customerName={booking.guest_name}
                onClose={(meta) => {
                    const code = meta?.bookingCode || booking.booking_code;
                    if (onPaymentClose) onPaymentClose();
                    if (meta?.cancelled) {
                        navigate('/booking-history', {
                            state: {
                                toast: {
                                    type: 'info',
                                    text: `Đã hủy đơn đặt phòng ${code} thành công.`
                                }
                            }
                        });
                    } else {
                        navigate('/booking-history', {
                            state: {
                                toast: {
                                    type: 'info',
                                    text: `Đơn đặt phòng ${code} đã được lưu tạm. Quý khách có thể thanh toán sau.`
                                }
                            }
                        });
                    }
                }}
                onCancelBooking={(cancelCode) => {
                    const code = cancelCode || booking.booking_code;
                    if (onPaymentClose) onPaymentClose();
                    navigate('/booking-history', {
                        state: {
                            toast: {
                                type: 'info',
                                text: `Đã hủy đơn đặt phòng ${code} thành công.`
                            }
                        }
                    });
                }}
                onSuccess={() => {
                    try {
                        localStorage.setItem('pms_last_booking_event', Date.now().toString());
                        window.dispatchEvent(new Event('pms_booking_created'));
                    } catch { }
                    if (onPaymentSuccess) onPaymentSuccess();
                }}
                onConfirm={() => {
                    try {
                        localStorage.setItem('pms_last_booking_event', Date.now().toString());
                        window.dispatchEvent(new Event('pms_booking_created'));
                    } catch { }
                    if (onPaymentSuccess) onPaymentSuccess();
                }}
            />
        );
    }

    const isPaid = booking.is_paid || booking.payment_method === 'vietqr_success';

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-10 text-center shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
                {/* Icon thành công */}
                <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-4xl mb-6 shadow-inner">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>

                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                    {isPaid ? 'Thanh toán & Đặt phòng thành công!' : 'Đặt phòng thành công!'}
                </span>

                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-3 mb-2">
                    Cảm ơn quý khách {booking.guest_name}!
                </h2>

                <p className="text-xs sm:text-sm text-slate-500 mb-6">
                    Đơn đặt phòng của quý khách tại <strong>{hotelSettings.hotel_name || 'Khách Sạn TA Đà Nẵng'}</strong> đã được tiếp nhận và xử lý thành công.
                </p>

                {/* Mã đặt phòng & Hộp sao chép */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-6">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Mã đơn đặt phòng (Booking Code)
                    </span>
                    <div className="flex items-center justify-center gap-2">
                        <span className="font-mono text-xl sm:text-2xl font-black text-amber-600 tracking-wider">
                            {booking.booking_code}
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                if (navigator.clipboard) {
                                    navigator.clipboard.writeText(booking.booking_code);
                                    setCopiedCode(true);
                                    setTimeout(() => setCopiedCode(false), 2500);
                                }
                            }}
                            className="p-1.5 px-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 hover:text-amber-600 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="Sao chép mã"
                        >
                            {copiedCode ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-emerald-700 font-bold">Đã sao chép</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Chép</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Tóm tắt thông tin */}
                <div className="bg-slate-50 rounded-2xl p-4 text-xs text-slate-600 space-y-2 text-left mb-6 border border-slate-100">
                    <div className="flex justify-between">
                        <span>Hạng phòng:</span>
                        <strong className="text-slate-900">{booking.room_name}</strong>
                    </div>
                    <div className="flex justify-between">
                        <span>Thời gian:</span>
                        <strong className="text-slate-900">
                            {formatDateDisplay(booking.check_in_date)} → {formatDateDisplay(booking.check_out_date)} ({booking.nights} đêm)
                        </strong>
                    </div>
                    {booking.selected_services?.length > 0 && (
                        <div className="flex justify-between items-start pt-1 border-t border-slate-200">
                            <span className="text-amber-800 font-semibold flex items-center gap-1.5">
                                <BellRing className="w-3 h-3 text-amber-600" />
                                <span>Dịch vụ đặt kèm ({booking.selected_services.length}):</span>
                            </span>
                            <div className="text-right space-y-0.5">
                                {booking.selected_services.map((s, idx) => (
                                    <div key={idx} className="font-semibold text-slate-900 text-[11px]">
                                        {s.service_name || s.name} <strong className="text-orange-600">×{s.quantity}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span>Tổng tiền thanh toán:</span>
                        <strong className="text-rose-600 font-bold">
                            {Number(booking.total_amount).toLocaleString('vi-VN')} VND
                        </strong>
                    </div>
                    <div className="flex justify-between">
                        <span>Phương thức:</span>
                        <strong className={isPaid ? "text-emerald-700 font-bold" : "text-slate-800"}>
                            {isPaid ? 'Đã thanh toán VietQR' : 'Thanh toán khi nhận phòng (Reception)'}
                        </strong>
                    </div>
                    <div className="flex justify-between">
                        <span>Số CCCD / Hộ chiếu:</span>
                        <strong className="text-slate-900 font-mono">{booking.identity_card}</strong>
                    </div>
                    <div className="flex justify-between">
                        <span>Email xác nhận:</span>
                        <span className="text-slate-800">{booking.guest_email}</span>
                    </div>
                </div>

                {/* Nút hành động */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <Link
                        to="/booking-history"
                        className="w-full sm:w-1/2 py-3 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-900/20 transition transform active:scale-95 text-center flex items-center justify-center gap-1.5"
                    >
                        <span>Xem lịch sử đặt phòng</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                        to="/"
                        className="w-full sm:w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition text-center"
                    >
                        Về Trang chủ
                    </Link>
                </div>
            </div>
        </div>
    );
}

