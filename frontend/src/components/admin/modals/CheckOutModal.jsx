import React, { useState, useEffect, useMemo } from 'react';
import { bookingService } from '../../../services/bookingService';
import { paymentService } from '../../../services/paymentService';
import api from '../../../services/api';

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

    // Form thanh toán & Ghi chú
    const [checkoutNote, setCheckoutNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [completedInvoice, setCompletedInvoice] = useState(null);

    // Trạng thái xử lý thanh toán phần nợ remaining_balance
    const [isProcessingDebtPayment, setIsProcessingDebtPayment] = useState(false);
    const [isDebtPaid, setIsDebtPaid] = useState(false); // Đã giải quyết xong phần nợ chưa
    const [paymentMethod, setPaymentMethod] = useState('bank_transfer'); // 'bank_transfer' | 'cash'

    // Cấu hình ngân hàng VietQR động
    const [bankConfig, setBankConfig] = useState({
        bank_bin: '970422',
        account_no: '123456789',
        account_name: 'KHACH SAN TA DA NANG'
    });

    // 1. TẢI BẢNG KÊ CHI TIẾT TỪ BACKEND
    useEffect(() => {
        if (!booking?.id) return;

        let isMounted = true;
        const fetchSummaryAndConfig = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const [summaryRes, configRes] = await Promise.allSettled([
                    bookingService.getBookingSummary(booking.id),
                    api.get('/payments/config/')
                ]);

                if (isMounted) {
                    if (summaryRes.status === 'fulfilled' && summaryRes.value?.success && summaryRes.value?.data) {
                        setSummary(summaryRes.value.data);
                    } else if (summaryRes.status === 'fulfilled' && summaryRes.value?.data) {
                        setSummary(summaryRes.value.data);
                    } else {
                        setError('Không thể tải bảng kê chi tiết thanh toán từ hệ thống.');
                    }

                    if (configRes.status === 'fulfilled') {
                        const cData = configRes.value.data?.data || configRes.value.data;
                        if (cData?.bank_bin) {
                            setBankConfig({
                                bank_bin: cData.bank_bin,
                                account_no: cData.account_no,
                                account_name: (cData.account_name || '').toUpperCase()
                            });
                        }
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

        fetchSummaryAndConfig();

        return () => {
            isMounted = false;
        };
    }, [booking?.id]);

    // 2. TÍNH TOÁN CÁC KHOẢN MỤC TÀI CHÍNH (FOLIO BALANCE) TỪ BACKEND TRẢ VỀ
    const roomCharge = useMemo(() => {
        return Number(summary?.room_charge ?? booking?.room_charge ?? booking?.total_amount ?? 0);
    }, [summary, booking]);

    const serviceCharge = useMemo(() => {
        return Number(summary?.service_charge ?? summary?.total_service_charge ?? booking?.service_charge ?? booking?.extra_services_total ?? 0);
    }, [summary, booking]);

    const totalAmount = useMemo(() => {
        if (summary?.total_amount !== undefined && summary?.total_amount !== null) {
            return Number(summary.total_amount);
        }
        if (summary?.grand_total !== undefined && summary?.grand_total !== null) {
            return Number(summary.grand_total);
        }
        return Number(roomCharge + serviceCharge);
    }, [summary, roomCharge, serviceCharge]);

    const paidAmount = useMemo(() => {
        if (summary?.paid_amount !== undefined && summary?.paid_amount !== null) {
            return Number(summary.paid_amount);
        }
        if (booking?.paid_amount !== undefined && booking?.paid_amount !== null) {
            return Number(booking.paid_amount);
        }
        return 0;
    }, [summary, booking]);

    // Số tiền còn thiếu ban đầu từ backend (Folio Balance Due)
    const initialRemainingBalance = useMemo(() => {
        if (summary?.remaining_balance !== undefined && summary?.remaining_balance !== null) {
            return Number(summary.remaining_balance);
        }
        if (summary?.remaining_amount !== undefined && summary?.remaining_amount !== null) {
            return Number(summary.remaining_amount);
        }
        return Math.max(0, totalAmount - paidAmount);
    }, [summary, totalAmount, paidAmount]);

    // Số tiền còn thiếu thực tế (sau khi lễ tân vừa bấm xác nhận thanh toán nợ)
    const currentRemainingBalance = useMemo(() => {
        if (isDebtPaid) return 0;
        return initialRemainingBalance;
    }, [isDebtPaid, initialRemainingBalance]);

    // Kiểm tra xem khách đã thanh toán đủ tiền chưa
    const isPaymentSettled = currentRemainingBalance <= 0;

    // 3. TẠO URL VIETQR ĐỘNG THEO ĐÚNG SỐ TIỀN REMAINING_BALANCE
    const qrUrl = useMemo(() => {
        if (!bankConfig.bank_bin || !bankConfig.account_no || currentRemainingBalance <= 0) return '';
        const bCode = summary?.booking_code || booking.booking_code || `BK-${booking.id}`;
        const addInfo = encodeURIComponent(`Thanh toan checkout ${bCode}`);
        return `https://img.vietqr.io/image/${bankConfig.bank_bin}-${bankConfig.account_no}-compact2.jpg?amount=${currentRemainingBalance}&addInfo=${addInfo}&accountName=${encodeURIComponent(bankConfig.account_name)}`;
    }, [bankConfig, currentRemainingBalance, summary, booking]);

    // 4. XỬ LÝ XÁC NHẬN THANH TOÁN PHẦN NỢ (REMAINING BALANCE)
    const handleConfirmDebtPayment = async () => {
        if (currentRemainingBalance <= 0) return;

        try {
            setIsProcessingDebtPayment(true);

            // Ghi nhận bản ghi thanh toán nốt phần nợ vào database
            await paymentService.confirmPayment({
                booking_id: booking.id,
                amount: currentRemainingBalance,
                payment_method: paymentMethod === 'bank_transfer' ? 'TRANSFER' : 'CASH'
            });

            // Đánh dấu đã giải quyết xong công nợ -> Nút Hoàn tất Check-out sẽ sáng lên
            setIsDebtPaid(true);
        } catch (err) {
            console.error('Lỗi khi ghi nhận thanh toán nợ Check-out:', err);
            alert(err.response?.data?.message || 'Không thể ghi nhận thanh toán. Vui lòng thử lại.');
        } finally {
            setIsProcessingDebtPayment(false);
        }
    };

    // 5. GỬI YÊU CẦU HOÀN TẤT CHECK-OUT TỚI API POST /api/bookings/:id/check-out/
    const handleConfirmCheckOut = async () => {
        if (!booking?.id || isSubmitting || !isPaymentSettled) return;

        try {
            setIsSubmitting(true);
            const res = await bookingService.checkOut(booking.id, {
                payment_method: paymentMethod,
                note: checkoutNote.trim()
            });

            if (res.success && res.data) {
                setCompletedInvoice(res.data.invoice || res.data);

                // Phát tín hiệu đồng bộ realtime
                try {
                    localStorage.setItem('pms_last_booking_event', Date.now().toString());
                    window.dispatchEvent(new CustomEvent('pms_booking_created'));
                } catch (e) {
                    console.error('Lỗi khi phát tín hiệu pms event:', e);
                }

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
                
                {/* ========================================================================= */}
                {/* 1. MODAL HEADER                                                           */}
                {/* ========================================================================= */}
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
                                {completedInvoice ? 'Hóa Đơn Thanh Toán Đã Hoàn Tất' : 'Bảng Kê Chi Tiết & Trả Phòng (Check-out)'}
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

                {/* ========================================================================= */}
                {/* 2. NỘI DUNG CHÍNH (LOADING / ERROR / THÀNH CÔNG / BẢNG KÊ)                */}
                {/* ========================================================================= */}
                {isLoading ? (
                    <div className="py-16 text-center space-y-4">
                        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-xs font-semibold text-slate-600">
                            Đang tổng hợp dữ liệu Folio tiền phòng và các dịch vụ phát sinh từ hệ thống...
                        </p>
                    </div>
                ) : error ? (
                    <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3 my-4">
                        <div className="text-3xl">⚠️</div>
                        <p className="text-sm font-bold text-rose-800">{error}</p>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer"
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
                            <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-emerald-300 font-mono text-sm font-bold text-emerald-800 shadow-xs">
                                <span>Mã hóa đơn:</span>
                                <span>{completedInvoice.invoice_code}</span>
                            </div>
                        </div>

                        {/* Tóm tắt số tiền đã thanh toán */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                            <div className="flex justify-between text-slate-600">
                                <span>Tổng tiền phòng:</span>
                                <span className="font-semibold text-slate-900">{formatCurrency(roomCharge)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                                <span>Tổng tiền dịch vụ:</span>
                                <span className="font-semibold text-slate-900">{formatCurrency(serviceCharge)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                                <span>Tổng chi phí lưu trú (Folio Total):</span>
                                <span className="font-semibold text-slate-900">{formatCurrency(totalAmount)}</span>
                            </div>
                            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-bold">
                                <span className="text-sm text-slate-800">Tổng tiền đã thanh toán hoàn tất:</span>
                                <span className="text-xl text-emerald-700 font-black">{formatCurrency(totalAmount)}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                            {onOpenInvoice && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        onOpenInvoice({
                                            ...booking,
                                            status: 'completed',
                                            room_amount: roomCharge,
                                            extra_services_total: serviceCharge,
                                            grand_total_amount: totalAmount,
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
                    /* 2B. BẢNG KÊ CHI TIẾT TRƯỚC THANH TOÁN (FOLIO ITEMIZED TABLE) */
                    <div className="space-y-6">
                        {/* THÔNG TIN KHÁCH VÀ PHÒNG */}
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <span className="text-[11px] text-slate-400 block">Khách hàng lưu trú:</span>
                                    <strong className="text-slate-900 text-sm block truncate">
                                        👤 {summary?.guest_name || booking.guest_name}
                                    </strong>
                                    <span className="text-[11px] text-slate-500 block mt-0.5">
                                        📞 {summary?.guest_phone || booking.guest_phone || 'Chưa có SĐT'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[11px] text-slate-400 block">Hạng phòng & Số phòng:</span>
                                    <strong className="text-slate-900 text-xs block text-blue-700 font-bold">
                                        🏨 {summary?.room_name || booking.room_name}
                                    </strong>
                                    <span className="text-[11px] text-slate-600 font-bold block mt-0.5">
                                        {summary?.room_number ? `🚪 Phòng số: ${summary.room_number}` : (booking.room_number ? `🚪 Phòng số: ${booking.room_number}` : 'Chưa gán số phòng')}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[11px] text-slate-400 block">Thời gian lưu trú:</span>
                                    <div className="text-[11px] text-slate-700 font-medium mt-0.5">
                                        <span>Check-in: {formatDateTime(summary?.actual_check_in || summary?.check_in_date || booking.check_in_date)}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-700 font-medium">
                                        <span>Check-out: {formatDateTime(new Date().toISOString())}</span>
                                    </div>
                                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md">
                                        🌙 {summary?.nights || booking.nights || 1} đêm lưu trú
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ================================================================= */}
                        {/* BẢNG KÊ CHI TIẾT KHOẢN MỤC (FOLIO STATEMENT)                     */}
                        {/* ================================================================= */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-serif text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                                    <span>📋</span>
                                    <span>Bảng Kê Chi Tiết Folio Thanh Toán</span>
                                </h3>
                                <span className="text-[11px] text-slate-400">Đơn vị: VNĐ</span>
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
                                        {/* 1. TIỀN PHÒNG */}
                                        <tr className="bg-white font-medium hover:bg-slate-50/50">
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-slate-900">
                                                    Tiền lưu trú phòng: {summary?.room_name || booking.room_name}
                                                </div>
                                                <div className="text-[11px] text-slate-400">
                                                    {formatDate(summary?.check_in_date || booking.check_in_date)} → {formatDate(summary?.check_out_date || booking.check_out_date)}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-center font-bold text-slate-700">
                                                {summary?.nights || booking.nights || 1} đêm
                                            </td>
                                            <td className="py-3 px-3 text-right text-slate-600">
                                                {formatCurrency(summary?.daily_rate || (roomCharge / (summary?.nights || 1)))}
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-slate-900">
                                                {formatCurrency(roomCharge)}
                                            </td>
                                        </tr>

                                        {/* 2. DỊCH VỤ PHÁT SINH */}
                                        {summary?.extra_services && summary.extra_services.length > 0 ? (
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

                                    {/* FOOTER BẢNG KÊ: BẮT BUỘC THEO YÊU CẦU ĐỀ BÀI */}
                                    <tfoot className="bg-slate-50/90 border-t border-slate-200">
                                        {/* Tổng tiền phòng */}
                                        <tr>
                                            <td colSpan={3} className="py-2 px-4 text-right font-semibold text-slate-600">
                                                Tổng tiền phòng (Room Charge):
                                            </td>
                                            <td className="py-2 px-4 text-right font-bold text-slate-800">
                                                {formatCurrency(roomCharge)}
                                            </td>
                                        </tr>

                                        {/* Tổng dịch vụ */}
                                        <tr>
                                            <td colSpan={3} className="py-2 px-4 text-right font-semibold text-slate-600">
                                                Tổng dịch vụ (Service Charge):
                                            </td>
                                            <td className="py-2 px-4 text-right font-bold text-slate-800">
                                                {formatCurrency(serviceCharge)}
                                            </td>
                                        </tr>

                                        {/* Tổng chi phí */}
                                        <tr className="border-t border-slate-200">
                                            <td colSpan={3} className="py-2 px-4 text-right font-semibold text-slate-700">
                                                Tổng chi phí lưu trú (Total Amount):
                                            </td>
                                            <td className="py-2 px-4 text-right font-bold text-slate-900">
                                                {formatCurrency(totalAmount)}
                                            </td>
                                        </tr>

                                        {/* Số tiền Đã thanh toán trước đó (chữ xanh lá) */}
                                        <tr className="bg-emerald-50/70 border-t border-emerald-200">
                                            <td colSpan={3} className="py-2.5 px-4 text-right font-bold text-emerald-800">
                                                ✓ Số tiền Đã thanh toán trước đó:
                                            </td>
                                            <td className="py-2.5 px-4 text-right font-black text-emerald-600 text-sm">
                                                -{formatCurrency(paidAmount + (isDebtPaid ? initialRemainingBalance : 0))}
                                            </td>
                                        </tr>

                                        {/* SỐ TIỀN CẦN THANH TOÁN THÊM: remaining_balance (chữ đỏ, in đậm) */}
                                        <tr className={`border-t-2 ${currentRemainingBalance > 0 ? 'bg-rose-50/80 border-rose-300' : 'bg-emerald-50 border-emerald-300'}`}>
                                            <td colSpan={3} className="py-3 px-4 text-right font-extrabold text-sm uppercase tracking-wide">
                                                <span className={currentRemainingBalance > 0 ? 'text-rose-900' : 'text-emerald-900'}>
                                                    {currentRemainingBalance > 0 ? 'SỐ TIỀN CẦN THANH TOÁN THÊM (Remaining Balance):' : 'CÔNG NỢ CÒN LẠI (Folio Balance):'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <span className={`text-xl font-black ${
                                                    currentRemainingBalance > 0 ? 'text-rose-600 font-extrabold' : 'text-emerald-700 font-black'
                                                }`}>
                                                    {currentRemainingBalance > 0 ? formatCurrency(currentRemainingBalance) : '0đ (ĐÃ THANH TOÁN ĐỦ)'}
                                                </span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* ================================================================= */}
                        {/* 3. LOGIC THANH TOÁN THÔNG MINH THEO YÊU CẦU ĐỀ BÀI                */}
                        {/* ================================================================= */}

                        {/* TRƯỜNG HỢP A: remaining_balance > 0 (Có nợ tiền phòng hoặc dịch vụ) */}
                        {/* Bắt buộc render form thanh toán VietQR yêu cầu quét ĐÚNG SỐ TIỀN remaining_balance này */}
                        {currentRemainingBalance > 0 ? (
                            <div className="p-4.5 rounded-2xl border-2 border-rose-400 bg-rose-50/20 space-y-4 animate-in fade-in duration-200">
                                <div className="flex items-center justify-between pb-2 border-b border-rose-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">⚠️</span>
                                        <h4 className="font-bold text-rose-900 text-xs sm:text-sm uppercase tracking-wide">
                                            Yêu cầu thu thêm tiền phát sinh: <span className="text-rose-600 font-black">{formatCurrency(currentRemainingBalance)}</span>
                                        </h4>
                                    </div>
                                    <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px] border border-rose-300">
                                        Chưa thanh toán
                                    </span>
                                </div>

                                <p className="text-[11px] text-slate-600">
                                    Khách có phát sinh dịch vụ hoặc chưa thanh toán đủ tiền phòng. Vui lòng quét mã VietQR hoặc thu tiền mặt trước khi bấm hoàn tất Check-out.
                                </p>

                                {/* Lựa chọn phương thức thu */}
                                <div className="flex items-center gap-3">
                                    <label className="text-[11px] font-bold text-slate-700">Hình thức thanh toán:</label>
                                    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('bank_transfer')}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                                paymentMethod === 'bank_transfer'
                                                    ? 'bg-blue-600 text-white shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            🏦 Quét mã VietQR
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('cash')}
                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                                paymentMethod === 'cash'
                                                    ? 'bg-amber-600 text-white shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            💵 Tiền mặt tại quầy
                                        </button>
                                    </div>
                                </div>

                                {/* FORM THANH TOÁN VIETQR: YÊU CẦU QUÉT ĐÚNG SỐ TIỀN remaining_balance */}
                                {paymentMethod === 'bank_transfer' && (
                                    <div className="p-4 bg-white rounded-2xl border border-blue-200 shadow-sm flex flex-col sm:flex-row items-center gap-5">
                                        {/* Mã QR với viền đứt nét nổi bật */}
                                        <div className="relative p-2 bg-white rounded-2xl border-2 border-dashed border-blue-400 max-w-[190px] w-full aspect-square flex items-center justify-center shrink-0">
                                            {qrUrl ? (
                                                <img
                                                    src={qrUrl}
                                                    alt={`VietQR thanh toán ${formatCurrency(currentRemainingBalance)}`}
                                                    className="w-full h-full object-contain rounded-xl"
                                                />
                                            ) : (
                                                <div className="text-[11px] text-slate-400 text-center">Đang nạp mã QR...</div>
                                            )}
                                        </div>

                                        {/* Chi tiết số tiền yêu cầu thanh toán */}
                                        <div className="space-y-2 text-xs text-slate-700 flex-1 w-full">
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                                VietQR Chuyển khoản tức thì
                                            </div>

                                            <div className="space-y-1 pt-1">
                                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                                    <span className="text-slate-500">Ngân hàng:</span>
                                                    <strong className="text-slate-900">{bankConfig.bank_bin}</strong>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                                    <span className="text-slate-500">Số tài khoản:</span>
                                                    <strong className="font-mono text-slate-900">{bankConfig.account_no}</strong>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                                    <span className="text-slate-500">Chủ tài khoản:</span>
                                                    <strong className="text-slate-900">{bankConfig.account_name}</strong>
                                                </div>
                                                <div className="flex justify-between items-baseline pt-1">
                                                    <span className="font-bold text-slate-800">Số tiền cần quét:</span>
                                                    <strong className="text-base text-rose-600 font-black">{formatCurrency(currentRemainingBalance)}</strong>
                                                </div>
                                            </div>

                                            {/* Nút xác nhận thanh toán nợ */}
                                            <div className="pt-2">
                                                <button
                                                    type="button"
                                                    disabled={isProcessingDebtPayment}
                                                    onClick={handleConfirmDebtPayment}
                                                    className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                                                >
                                                    {isProcessingDebtPayment ? (
                                                        <>
                                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                            <span>Đang xác nhận thanh toán...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>✓</span>
                                                            <span>Xác nhận Đã nhận {formatCurrency(currentRemainingBalance)} qua VietQR</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* FORM THU TIỀN MẶT */}
                                {paymentMethod === 'cash' && (
                                    <div className="p-4 bg-white rounded-2xl border border-amber-200 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="font-bold text-slate-900 text-xs">Thu ngân tại quầy lễ tân:</div>
                                            <p className="text-[11px] text-slate-500">
                                                Lễ tân nhận trực tiếp số tiền <strong className="text-rose-600">{formatCurrency(currentRemainingBalance)}</strong> từ khách hàng.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={isProcessingDebtPayment}
                                            onClick={handleConfirmDebtPayment}
                                            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                                        >
                                            {isProcessingDebtPayment ? (
                                                <>
                                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    <span>Đang ghi nhận...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>💵</span>
                                                    <span>Xác nhận Đã thu tiền mặt</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* TRƯỜNG HỢP B: remaining_balance <= 0 (Đã thanh toán đủ 100%, không gọi dịch vụ hoặc đã trả xong nợ) */
                            /* ẨN TOÀN BỘ KHU VỰC QUÉT QR */
                            <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center justify-between animate-in fade-in duration-200">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xl shrink-0 shadow-md shadow-emerald-500/20">
                                        ✓
                                    </div>
                                    <div>
                                        <strong className="text-sm text-emerald-950 block">Folio Đã Cân Bằng (Đã Thanh Toán Đủ 100%)</strong>
                                        <span className="text-[11px] text-emerald-700">
                                            Toàn bộ tiền phòng và phụ phí dịch vụ đã được tất toán thành công. Không phát sinh công nợ tại quầy.
                                        </span>
                                    </div>
                                </div>
                                <span className="px-3 py-1 rounded-full bg-emerald-600 text-white font-black text-xs shadow-xs">
                                    0đ CẦN THU
                                </span>
                            </div>
                        )}

                        {/* GHI CHÚ NỘI BỘ KHI CHECK-OUT */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                                <span>📝 Ghi chú trả phòng (Lễ tân):</span>
                                <span className="text-[10px] text-slate-400 font-normal">Không bắt buộc</span>
                            </label>
                            <input
                                type="text"
                                placeholder="VD: Khách đã bàn giao thẻ phòng, đồ đạc đầy đủ, hài lòng với dịch vụ..."
                                value={checkoutNote}
                                onChange={(e) => setCheckoutNote(e.target.value)}
                                disabled={isSubmitting}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition"
                            />
                        </div>

                        {/* ================================================================= */}
                        {/* 4. FOOTER BUTTONS                                                 */}
                        {/* ================================================================= */}
                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                            <div className="text-[11px] text-slate-500">
                                {!isPaymentSettled && (
                                    <span className="text-rose-600 font-bold flex items-center gap-1">
                                        <span>🔒</span>
                                        <span>Cần tất toán khoản nợ {formatCurrency(currentRemainingBalance)} để mở khóa nút Check-out</span>
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    disabled={isSubmitting}
                                    onClick={onClose}
                                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
                                >
                                    Hủy bỏ
                                </button>

                                {/* Nút "Hoàn tất Check-out": Bị vô hiệu hóa nếu còn nợ, tự động sáng lên khi remaining_balance <= 0 */}
                                <button
                                    type="button"
                                    disabled={isSubmitting || !isPaymentSettled}
                                    onClick={handleConfirmCheckOut}
                                    className={`px-6 py-2.5 font-extrabold text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95 text-white ${
                                        !isPaymentSettled
                                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                                            : 'bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600 hover:from-orange-600 hover:to-amber-600 shadow-amber-500/25 ring-2 ring-amber-400/40'
                                    }`}
                                    title={!isPaymentSettled ? 'Vui lòng hoàn tất thanh toán số tiền còn thiếu trước khi Check-out.' : 'Nhấn để hoàn tất Check-out và trả phòng'}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Đang xử lý Check-out...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>{isPaymentSettled ? '✓' : '🔒'}</span>
                                            <span>Hoàn Tất Check-out & Trả Phòng</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                    </div>
                )}

            </div>
        </div>
    );
}
