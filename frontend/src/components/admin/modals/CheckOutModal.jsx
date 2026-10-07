import React, { useState, useEffect } from 'react';
import { bookingService } from '../../../services/bookingService';
import { PaymentSection } from '../../common/PaymentModal';

// Helper format tiền tệ VNĐ
const formatCurrency = (amount) => {
    const num = Number(amount) || 0;
    return `${num.toLocaleString('vi-VN')}đ`;
};

// Helper format ngày giờ
const formatDateTime = (isoStr) => {
    if (!isoStr) return '—';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `${time} • ${date}`;
    } catch {
        return isoStr;
    }
};

// Helper format ngày ngắn
const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const parts = String(dateStr).split('T')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    } catch {
        return dateStr;
    }
    return dateStr;
};

export default function CheckOutModal({ booking, onClose, onSuccess, onOpenInvoice }) {
    const [summary, setSummary] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Form thanh toán
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [checkoutNote, setCheckoutNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [completedInvoice, setCompletedInvoice] = useState(null);

    // Tải bảng kê chi tiết từ API /api/bookings/:id/summary/
    useEffect(() => {
        if (!booking?.id) return;

        let isMounted = true;
        const fetchSummary = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const res = await bookingService.getBookingSummary(booking.id);
                if (isMounted) {
                    if (res.success && res.data) {
                        setSummary(res.data);
                    } else {
                        setError(res.message || 'Không thể tải bảng kê chi tiết thanh toán.');
                    }
                }
            } catch (err) {
                if (isMounted) {
                    setError('Lỗi kết nối máy chủ khi lấy bảng kê thanh toán.');
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchSummary();

        return () => {
            isMounted = false;
        };
    }, [booking?.id]);

    // Xử lý gửi yêu cầu Check-out tới API POST /api/bookings/:id/check-out/
    const handleConfirmCheckOut = async () => {
        if (!booking?.id || isSubmitting) return;

        try {
            setIsSubmitting(true);
            const res = await bookingService.checkOut(booking.id, {
                payment_method: paymentMethod,
                note: checkoutNote
            });

            if (res.success && res.data) {
                setCompletedInvoice(res.data.invoice || res.data);
                // Bắn tín hiệu đồng bộ realtime sang tất cả tab/cửa sổ khác (kể cả tab Lịch sử đặt phòng của khách)
                try {
                    localStorage.setItem('pms_last_booking_event', Date.now().toString());
                    window.dispatchEvent(new CustomEvent('pms_booking_created'));
                } catch (e) {
                    console.error('Lỗi khi phát tín hiệu pms event:', e);
                }
                // Thông báo ra component cha để reload dữ liệu
                if (typeof onSuccess === 'function') {
                    onSuccess(res.data);
                }
            } else {
                alert(res.message || 'Check-out thất bại. Vui lòng kiểm tra lại.');
            }
        } catch (err) {
            console.error('Lỗi khi thực hiện Check-out:', err);
            alert('Đã xảy ra lỗi khi kết nối máy chủ để thực hiện Check-out.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!booking) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 flex items-center justify-center p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 max-w-3xl w-full p-6 sm:p-8 shadow-2xl text-left max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200 flex flex-col justify-between">
                
                {/* 1. MODAL HEADER */}
                <div className="flex items-start justify-between pb-4 border-b border-slate-200 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-orange-500/20 shrink-0">
                            🧾
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-black text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                                    #{summary?.booking_code || booking.booking_code}
                                </span>
                                <span className="text-xs text-slate-300">•</span>
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-300 uppercase tracking-wide">
                                    {summary?.room_number ? `Phòng ${summary.room_number}` : (booking.room_number ? `Phòng ${booking.room_number}` : 'Đang lưu trú')}
                                </span>
                            </div>
                            <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                                {completedInvoice ? 'Hóa Đơn Thanh Toán Đã Hoàn Tất' : 'Bảng Kê Thanh Toán & Trả Phòng (Check-out)'}
                            </h2>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center font-bold text-base cursor-pointer shrink-0"
                    >
                        ✕
                    </button>
                </div>

                {/* 2. NỘI DUNG CHÍNH (LOADING / ERROR / THÀNH CÔNG / BẢNG KÊ) */}
                {isLoading ? (
                    <div className="py-16 text-center space-y-4">
                        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-xs font-semibold text-slate-600">
                            Đang tổng hợp tiền phòng và các dịch vụ phát sinh từ hệ thống...
                        </p>
                    </div>
                ) : error ? (
                    <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3 my-4">
                        <div className="text-3xl">⚠️</div>
                        <p className="text-sm font-bold text-rose-800">{error}</p>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
                        >
                            Đóng cửa sổ
                        </button>
                    </div>
                ) : completedInvoice ? (
                    /* 2A. MÀN HÌNH HOÀN TẤT CHECK-OUT THÀNH CÔNG */
                    <div className="space-y-6 my-2">
                        <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl text-center space-y-3">
                            <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-500/30">
                                ✓
                            </div>
                            <h3 className="font-serif text-2xl font-bold text-slate-900">
                                Khách Hàng Trả Phòng Thành Công!
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                                Phòng <strong>{summary?.room_number || booking.room_number}</strong> đã hoàn tất thủ tục trả phòng và chuyển sang trạng thái <strong>Đang dọn dẹp (Cleaning)</strong>.
                            </p>
                            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-amber-900 text-xs font-semibold flex items-center justify-center gap-2 max-w-lg mx-auto">
                                <span>⭐</span>
                                <span>Khách hàng trả phòng thành công và có thể đánh giá phòng, dịch vụ khách sạn.</span>
                            </div>
                            <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-emerald-300 font-mono text-sm font-bold text-emerald-800 shadow-xs">
                                <span>Mã hóa đơn:</span>
                                <span>{completedInvoice.invoice_code}</span>
                            </div>
                        </div>

                        {/* Tóm tắt số tiền đã thanh toán */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                            <div className="flex justify-between text-slate-600">
                                <span>Tiền lưu trú phòng ({summary?.nights || 1} đêm):</span>
                                <span className="font-semibold text-slate-900">{formatCurrency(completedInvoice.room_charge || summary?.room_charge)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                                <span>Tổng phí dịch vụ phát sinh:</span>
                                <span className="font-semibold text-slate-900">{formatCurrency(completedInvoice.service_charge || summary?.total_service_charge)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                                <span>Tổng giá trị hóa đơn lưu trú:</span>
                                <span className="font-semibold text-slate-900">{formatCurrency(completedInvoice.total_amount || summary?.grand_total)}</span>
                            </div>
                            {Number(summary?.paid_amount) > 0 && (
                                <div className="flex justify-between text-emerald-700 font-semibold">
                                    <span>✓ Đã thanh toán trước (Tiền phòng VietQR):</span>
                                    <span>-{formatCurrency(summary.paid_amount)}</span>
                                </div>
                            )}
                            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-bold">
                                <span className="text-sm text-slate-800">
                                    {Number(summary?.paid_amount) > 0 ? 'Thực thu khi trả phòng:' : 'Tổng tiền đã thu:'}
                                </span>
                                <span className="text-xl text-emerald-700 font-black">
                                    {formatCurrency(Number(summary?.paid_amount) > 0 ? (summary?.remaining_amount ?? 0) : (completedInvoice.total_amount || summary?.grand_total))}
                                </span>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                                <span>Phương thức thanh toán:</span>
                                <span className="font-semibold text-slate-700 uppercase">{completedInvoice.payment_method_display || completedInvoice.payment_method || paymentMethod}</span>
                            </div>
                        </div>

                        {/* Nút hành động sau khi Check-out xong */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                            {onOpenInvoice && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        onOpenInvoice({
                                            ...booking,
                                            status: 'completed',
                                            room_amount: completedInvoice.room_charge || summary?.room_charge,
                                            extra_services_total: completedInvoice.service_charge || summary?.total_service_charge,
                                            grand_total_amount: completedInvoice.total_amount || summary?.grand_total,
                                            paid_amount: summary?.paid_amount,
                                            remaining_amount: summary?.remaining_amount,
                                            invoice: completedInvoice
                                        });
                                    }}
                                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>🖨️</span>
                                    <span>In Hóa Đơn Chuẩn A4</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                            >
                                Đóng Cửa Sổ
                            </button>
                        </div>
                    </div>
                ) : (
                    /* 2B. BẢNG KÊ CHI TIẾT TRƯỚC THANH TOÁN (YÊU CẦU CHÍNH) */
                    <div className="space-y-6">
                        {/* THÔNG TIN KHÁCH VÀ PHÒNG */}
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <span className="text-[11px] text-slate-400 block">Khách hàng lưu trú:</span>
                                    <strong className="text-slate-900 text-sm block truncate">
                                        👤 {summary.guest_name}
                                    </strong>
                                    <span className="text-[11px] text-slate-500 block mt-0.5">
                                        📞 {summary.guest_phone || 'Chưa có SĐT'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[11px] text-slate-400 block">Hạng phòng & Số phòng:</span>
                                    <strong className="text-slate-900 text-xs block text-blue-700 font-bold">
                                        🏨 {summary.room_name}
                                    </strong>
                                    <span className="text-[11px] text-slate-600 font-bold block mt-0.5">
                                        {summary.room_number ? `🚪 Phòng số: ${summary.room_number}` : 'Chưa gán số phòng'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[11px] text-slate-400 block">Thời gian lưu trú:</span>
                                    <div className="text-[11px] text-slate-700 font-medium mt-0.5">
                                        <span>Check-in: {formatDateTime(summary.actual_check_in || summary.check_in_date)}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-700 font-medium">
                                        <span>Check-out: {formatDateTime(new Date().toISOString())}</span>
                                    </div>
                                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md">
                                        🌙 {summary.nights} đêm thực tế
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* BẢNG KÊ CHI TIẾT CHI PHÍ (ITEMIZED TABLE) */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-serif text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                                    <span>📋</span>
                                    <span>Bảng Kê Chi Tiết Trước Khi Thanh Toán</span>
                                </h3>
                                <span className="text-[11px] text-slate-400">Đơn vị tính: VNĐ</span>
                            </div>

                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                                        <tr>
                                            <th className="py-2.5 px-4">Khoản mục thanh toán</th>
                                            <th className="py-2.5 px-3 text-center">Số lượng</th>
                                            <th className="py-2.5 px-3 text-right">Đơn giá</th>
                                            <th className="py-2.5 px-4 text-right">Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {/* 1. TIỀN PHÒNG (ROOM CHARGE) */}
                                        <tr className="bg-white font-medium hover:bg-slate-50/50">
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-slate-900">
                                                    Tiền lưu trú: {summary.room_name}
                                                </div>
                                                <div className="text-[11px] text-slate-400">
                                                    {formatDate(summary.check_in_date)} → {formatDate(summary.check_out_date)}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-center font-bold text-slate-700">
                                                {summary.nights} đêm
                                            </td>
                                            <td className="py-3 px-3 text-right text-slate-600">
                                                {formatCurrency(summary.daily_rate)}
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-slate-900">
                                                {formatCurrency(summary.room_charge)}
                                            </td>
                                        </tr>

                                        {/* 2. CÁC DỊCH VỤ PHÁT SINH (EXTRA SERVICES COMPLETED) */}
                                        {summary.extra_services && summary.extra_services.length > 0 ? (
                                            summary.extra_services.map((svc, idx) => (
                                                <tr key={svc.id || idx} className="bg-amber-50/20 hover:bg-amber-50/40">
                                                    <td className="py-2.5 px-4">
                                                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                                            <span className="text-amber-600">🍽️</span>
                                                            <span>{svc.service_name}</span>
                                                        </div>
                                                        {svc.created_at && (
                                                            <div className="text-[10px] text-slate-400">
                                                                Gọi lúc: {formatDateTime(svc.created_at)}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center text-slate-700 font-semibold">
                                                        x{svc.quantity}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right text-slate-600">
                                                        {formatCurrency(svc.price)}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                                                        {formatCurrency(svc.total_price)}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr className="bg-white">
                                                <td colSpan={4} className="py-3 px-4 text-center text-slate-400 italic text-[11px]">
                                                    Không phát sinh dịch vụ ăn uống, spa hoặc phụ phí tại phòng.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot className="bg-slate-50/90 border-t border-slate-200">
                                        <tr>
                                            <td colSpan={3} className="py-2.5 px-4 text-right font-semibold text-slate-600">
                                                Tiền lưu trú (Room Charge):
                                            </td>
                                            <td className="py-2.5 px-4 text-right font-bold text-slate-800">
                                                {formatCurrency(summary.room_charge)}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={3} className="py-2.5 px-4 text-right font-semibold text-slate-600">
                                                Tổng tiền dịch vụ (Total Service Charge):
                                            </td>
                                            <td className="py-2.5 px-4 text-right font-bold text-slate-800">
                                                {formatCurrency(summary.total_service_charge)}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colSpan={3} className="py-2 px-4 text-right font-semibold text-slate-700">
                                                Tổng chi phí lưu trú (Grand Total):
                                            </td>
                                            <td className="py-2 px-4 text-right font-bold text-slate-900">
                                                {formatCurrency(summary.grand_total)}
                                            </td>
                                        </tr>
                                        {Number(summary.paid_amount) > 0 && (
                                            <tr className="bg-emerald-50/70 border-t border-emerald-200 text-emerald-800">
                                                <td colSpan={3} className="py-2 px-4 text-right font-bold">
                                                    ✓ Đã thanh toán trước (Tiền phòng VietQR):
                                                </td>
                                                <td className="py-2 px-4 text-right font-extrabold text-emerald-700">
                                                    -{formatCurrency(summary.paid_amount)}
                                                </td>
                                            </tr>
                                        )}
                                        <tr className="bg-amber-100/70 border-t-2 border-amber-300">
                                            <td colSpan={3} className="py-3 px-4 text-right font-extrabold text-slate-900 text-sm uppercase tracking-wide">
                                                {Number(summary.paid_amount) > 0 ? 'Còn lại cần thu khi trả phòng (Balance Due):' : 'Tổng thanh toán cuối cùng (Grand Total):'}
                                            </td>
                                            <td className="py-3 px-4 text-right font-black text-amber-800 text-xl">
                                                {formatCurrency(summary.remaining_amount != null ? summary.remaining_amount : (summary.grand_total - (summary.paid_amount || 0)))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* 3. CHỌN PHƯƠNG THỨC THANH TOÁN (PAYMENT METHOD SELECTOR) */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <span>💳</span>
                                <span>Chọn phương thức thanh toán phát sinh:</span>
                                <span className="text-rose-500">*</span>
                            </label>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {[
                                    { id: 'cash', label: 'Tiền mặt', icon: '💵', desc: 'Thu ngân tại quầy' },
                                    { id: 'bank_transfer', label: 'Chuyển khoản', icon: '🏦', desc: 'Quét mã VietQR / Chuyển khoản' },
                                    { id: 'credit_card', label: 'Thẻ tín dụng', icon: '💳', desc: 'Quẹt máy POS (Visa/Master)' },
                                    { id: 'momo', label: 'Ví điện tử', icon: '📱', desc: 'Momo / ZaloPay' },
                                ].map((m) => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => setPaymentMethod(m.id)}
                                        className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                                            paymentMethod === m.id
                                                ? 'bg-amber-50/80 border-2 border-amber-500 text-slate-900 shadow-sm ring-2 ring-amber-500/20'
                                                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-lg">{m.icon}</span>
                                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                                paymentMethod === m.id ? 'border-amber-600 bg-amber-600' : 'border-slate-300'
                                            }`}>
                                                {paymentMethod === m.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                        </div>
                                        <div className="font-bold text-xs text-slate-900">{m.label}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">{m.desc}</div>
                                    </button>
                                ))}
                            </div>

                            {/* Thông báo nếu đã thanh toán đủ 100% không phát sinh dịch vụ */}
                            {Number(summary?.paid_amount) > 0 && (summary?.remaining_amount === 0 || (summary?.remaining_amount == null && summary?.grand_total <= summary?.paid_amount)) && (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                                    <span className="text-base">✅</span>
                                    <div>
                                        <strong>Đã thanh toán đủ:</strong> Tiền phòng đã được thanh toán trước qua VietQR và khách không phát sinh thêm dịch vụ. Số tiền cần thu tại quầy là <strong>0đ</strong>.
                                    </div>
                                </div>
                            )}

                            {/* Hiển thị mã VietQR động khi chọn phương thức Chuyển khoản */}
                            {paymentMethod === 'bank_transfer' && (summary?.remaining_amount != null ? summary.remaining_amount : summary.grand_total) > 0 && (
                                <div className="mt-3 rounded-2xl border border-blue-200 bg-white overflow-hidden shadow-sm animate-fadeIn">
                                    <PaymentSection
                                        amount={summary.remaining_amount != null ? summary.remaining_amount : summary.grand_total}
                                        bookingCode={booking.booking_code || `BK-${booking.id}`}
                                        customerName={booking.guest_name}
                                        isModalView={false}
                                    />
                                </div>
                            )}
                        </div>

                        {/* 4. GHI CHÚ NỘI BỘ KHI CHECK-OUT (OPTIONAL) */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                    📝 Ghi chú thanh toán / Trả phòng:
                                </label>
                                <span className="text-[10px] text-slate-400">Không bắt buộc</span>
                            </div>
                            <input
                                type="text"
                                placeholder="VD: Khách đã thanh toán đủ tiền mặt, hài lòng với dịch vụ, đã nhận lại thẻ phòng..."
                                value={checkoutNote}
                                onChange={(e) => setCheckoutNote(e.target.value)}
                                disabled={isSubmitting}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
                            />
                        </div>

                        {/* THÔNG BÁO TỰ ĐỘNG CỦA HỆ THỐNG */}
                        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-950 flex items-start gap-2">
                            <span className="text-sm">ℹ️</span>
                            <div>
                                Khi bấm <strong>"Xác nhận Thanh toán & Trả phòng"</strong>, hệ thống sẽ:
                                <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[10px] text-amber-900">
                                    <li>Tự động tạo bản ghi <strong>Hóa đơn (Invoice)</strong> lưu tổng số tiền <strong>{formatCurrency(summary.grand_total)}</strong>.</li>
                                    <li>Cập nhật đơn đặt phòng sang trạng thái <strong>Đã hoàn tất (completed)</strong>.</li>
                                    <li>Giải phóng phòng <strong>{summary.room_number || booking.room_number}</strong> và chuyển sang trạng thái <strong>Đang dọn dẹp (cleaning)</strong>.</li>
                                </ul>
                            </div>
                        </div>

                        {/* 5. FOOTER BUTTONS */}
                        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={onClose}
                                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
                            >
                                Hủy bỏ
                            </button>

                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={handleConfirmCheckOut}
                                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/25 transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang xử lý thanh toán...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>✓</span>
                                        <span>Xác nhận Thanh toán & Trả phòng</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
