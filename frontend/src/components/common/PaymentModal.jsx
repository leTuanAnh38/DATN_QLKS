import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2,
    X,
    Copy,
    Check,
    QrCode,
    Building2,
    CreditCard,
    ShieldCheck,
    AlertCircle,
    RefreshCw,
    Clock,
    AlertTriangle,
    Save,
    Trash2,
    Smartphone,
    Loader2
} from 'lucide-react';
import api from '../../services/api';
import { bookingService } from '../../services/bookingService';

/**
 * CẤU HÌNH DỰ PHÒNG THÔNG TIN TÀI KHOẢN NGÂN HÀNG (FALLBACK)
 */
const DEFAULT_BANK_CONFIG = {
    bank_bin: '970422', // Mã BIN MB Bank
    account_no: '0344997778',
    account_name: 'KHACH SAN TA DA NANG',
};

// Từ điển tên viết tắt các ngân hàng phổ biến theo BIN
const BANK_NAMES_BY_BIN = {
    '970422': { short: 'MB Bank', full: 'Ngân hàng TMCP Quân Đội' },
    '970436': { short: 'Vietcombank', full: 'Ngân hàng TMCP Ngoại Thương VN' },
    '970415': { short: 'VietinBank', full: 'Ngân hàng TMCP Công Thương VN' },
    '970418': { short: 'BIDV', full: 'Ngân hàng TMCP Đầu Tư & PT VN' },
    '970407': { short: 'Techcombank', full: 'Ngân hàng TMCP Kỹ Thương VN' },
    '970416': { short: 'ACB', full: 'Ngân hàng TMCP Á Châu' },
    '970432': { short: 'VPBank', full: 'Ngân hàng TMCP VN Thịnh Vượng' },
    '970423': { short: 'TPBank', full: 'Ngân hàng TMCP Tiên Phong' },
    '970403': { short: 'Sacombank', full: 'Ngân hàng TMCP Sài Gòn Thương Tín' },
    '970405': { short: 'Agribank', full: 'Ngân hàng Nông Nghiệp & PTNT' },
};

/**
 * Helper format tiền tệ VNĐ: e.g. 1,450,000 VNĐ
 */
const formatVND = (value) => {
    const num = Number(value) || 0;
    return new Intl.NumberFormat('vi-VN').format(num) + ' VNĐ';
};

/**
 * PaymentModal Component
 * Props:
 * - booking: { id, total_amount, booking_code, customer_name }
 * - onSuccess: Hàm callback gọi khi thanh toán thành công
 * - onClose: Hàm đóng modal khi khách rời đi
 * - isOpen: Trạng thái hiển thị (mặc định true)
 * - onCancelBooking: Hàm gọi khi khách xác nhận hủy hoàn toàn đơn
 */
export default function PaymentModal({
    booking,
    onSuccess,
    onClose,
    isOpen = true,
    amount,
    bookingCode,
    customerName,
    onConfirm,
    onCancelBooking
}) {
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [copiedKey, setCopiedKey] = useState(null);
    const [isImageLoading, setIsImageLoading] = useState(true);

    // State cấu hình ngân hàng VietQR động
    const [bankConfig, setBankConfig] = useState(DEFAULT_BANK_CONFIG);
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);

    // Đồng hồ đếm ngược giữ phòng 15 phút (900 giây)
    const [timeLeft, setTimeLeft] = useState(900);

    // Hộp thoại xác nhận khi khách bấm Hủy / Thoát
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [isCancellingBooking, setIsCancellingBooking] = useState(false);

    // Chuẩn hóa dữ liệu từ prop booking hoặc các props phẳng
    const bookingId = booking?.id;
    const totalAmount = Number(booking?.total_amount ?? amount ?? 0);
    const code = booking?.booking_code || bookingCode || 'BK-10293';
    const guest = booking?.customer_name || booking?.guest_name || customerName || 'Quý khách';

    // Gọi API lấy cấu hình VietQR động ngay khi Modal mở
    useEffect(() => {
        if (!isOpen) return;
        let isMounted = true;
        const fetchBankConfig = async () => {
            setIsLoadingConfig(true);
            try {
                const response = await api.get('/payments/config/');
                const data = response.data?.data || response.data;
                if (isMounted && data) {
                    setBankConfig({
                        bank_bin: data.bank_bin || DEFAULT_BANK_CONFIG.bank_bin,
                        account_no: data.account_no || DEFAULT_BANK_CONFIG.account_no,
                        account_name: (data.account_name || DEFAULT_BANK_CONFIG.account_name).toUpperCase()
                    });
                    setIsImageLoading(true);
                }
            } catch (error) {
                console.error('Không thể lấy cấu hình VietQR từ server, sử dụng cấu hình mặc định:', error);
            } finally {
                if (isMounted) setIsLoadingConfig(false);
            }
        };

        fetchBankConfig();
        return () => {
            isMounted = false;
        };
    }, [isOpen]);

    // Đếm ngược thời gian thanh toán
    useEffect(() => {
        if (!isOpen || timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [isOpen, timeLeft]);

    const navigate = useNavigate();
    const pollIntervalRef = useRef(null);
    const [isPollingCompleted, setIsPollingCompleted] = useState(false);

    // =========================================================================
    // LONG POLLING: TỰ ĐỘNG KIỂM TRA TRẠNG THÁI THANH TOÁN (SEPAY / VIETQR)
    // =========================================================================
    useEffect(() => {
        const targetId = bookingId || code;
        if (!isOpen || !targetId || isPollingCompleted) return;

        let isMounted = true;
        let isFetching = false; // Flag ngăn chặn request chồng chéo khi mạng lag

        // 1. Hàm checkPaymentStatus gọi API Backend GET /api/payments/{booking_id}/status/
        const checkPaymentStatus = async () => {
            if (isFetching || !isMounted) return;
            isFetching = true;

            try {
                const response = await api.get(`/payments/${targetId}/status/`);
                const paymentStatus = response.data?.status || response.data?.payment_status;

                if (!isMounted) return;

                // 3. Logic xử lý trạng thái
                if (paymentStatus === 'COMPLETED') {
                    // Lập tức clearInterval
                    if (pollIntervalRef.current) {
                        clearInterval(pollIntervalRef.current);
                        pollIntervalRef.current = null;
                    }
                    setIsPollingCompleted(true);

                    // Ưu tiên kích hoạt callback cha để hiển thị màn hình chúc mừng của Checkout
                    if (onSuccess) {
                        onSuccess({ status: 'COMPLETED', booking_id: targetId, booking_code: code });
                    } else if (onConfirm) {
                        onConfirm({ status: 'COMPLETED', booking_id: targetId, booking_code: code });
                    } else if (onClose) {
                        onClose({ completed: true, bookingCode: code });
                    } else {
                        navigate('/booking-success', {
                            state: {
                                bookingId: targetId,
                                bookingCode: code,
                                status: 'COMPLETED'
                            }
                        });
                    }
                }
                // Nếu status === "PENDING": Không làm gì cả, chờ lần polling tiếp theo
            } catch (err) {
                // Nuốt lỗi polling mạng tạm thời để không ngắt trải nghiệm người dùng
                console.warn('Đang chờ giao dịch VietQR:', err?.message || err);
            } finally {
                isFetching = false;
            }
        };

        // Gọi ngay 1 lần đầu khi mở modal
        checkPaymentStatus();

        // Kích hoạt setInterval gọi lặp lại mỗi 3000ms (3 giây)
        pollIntervalRef.current = setInterval(checkPaymentStatus, 3000);

        // Cleanup: Xóa bộ đếm interval khi unmount hoặc đóng modal để chống rò rỉ bộ nhớ
        return () => {
            isMounted = false;
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [isOpen, bookingId, code, isPollingCompleted, navigate, onSuccess, onConfirm, onClose]);

    const formatTimer = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (!isOpen) return null;

    // 1. LOGIC TẠO URL VIETQR ĐỘNG THEO STATE bankConfig
    const bookingCodeValue = booking?.booking_code || code;
    const bookingAmountValue = booking?.total_amount ?? totalAmount;
    const transferContent = `Thanh toan phong ${bookingCodeValue}`;
    const qrUrl = (bankConfig.bank_bin && bankConfig.account_no)
        ? `https://img.vietqr.io/image/${bankConfig.bank_bin}-${bankConfig.account_no}-compact2.jpg?amount=${bookingAmountValue}&addInfo=${encodeURIComponent('Thanh toan phong ' + bookingCodeValue)}&accountName=${encodeURIComponent(bankConfig.account_name || '')}`
        : '';

    // Sao chép nhanh
    const handleCopy = async (text, key) => {
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 2000);
        } catch (e) {
            console.error('Không thể sao chép:', e);
        }
    };

    // 2. XỬ LÝ CALL API XÁC NHẬN THANH TOÁN THÀNH CÔNG
    const handleConfirmPayment = async () => {
        setIsLoading(true);
        setErrorMessage('');

        const payload = {
            booking_id: bookingId || code,
            amount: totalAmount,
            payment_method: 'TRANSFER'
        };

        try {
            const response = await api.post('/payments/confirm/', payload);

            if (response.data && response.data.success) {
                if (onSuccess) {
                    onSuccess(response.data);
                } else if (onConfirm) {
                    onConfirm(response.data);
                } else if (onClose) {
                    onClose();
                }
            } else {
                setErrorMessage(response.data?.message || 'Xác nhận thanh toán thất bại.');
            }
        } catch (error) {
            console.error('Lỗi khi gọi API thanh toán:', error);
            const serverMsg = error.response?.data?.message || error.message || 'Lỗi kết nối máy chủ.';
            setErrorMessage(serverMsg);
        } finally {
            setIsLoading(false);
        }
    };

    // Khi người dùng bấm nút "Hủy bỏ" hoặc nút [X]: Bật dialog xác nhận
    const handleInitiateCancel = () => {
        setShowCancelDialog(true);
    };

    // Lựa chọn 1: Giữ lại đơn để thanh toán sau (tại quầy hoặc vào lại lịch sử)
    const handleSaveAndExit = () => {
        setShowCancelDialog(false);
        if (onClose) onClose({ cancelled: false, bookingCode: code });
        else if (onSuccess) onSuccess();
    };

    // Lựa chọn 2: Hủy hoàn toàn đơn đặt phòng này
    const handleCancelBookingEntirely = async () => {
        setIsCancellingBooking(true);
        const targetId = bookingId || code;
        try {
            await bookingService.cancelBooking(targetId, 'Khách hàng hủy tại bước quét mã VietQR');
        } catch (err) {
            console.warn('Lỗi khi hủy đơn đặt phòng:', err);
        } finally {
            setIsCancellingBooking(false);
            setShowCancelDialog(false);
            if (onCancelBooking) {
                onCancelBooking(code);
            } else if (onClose) {
                onClose({ cancelled: true, bookingCode: code });
            } else if (onSuccess) {
                onSuccess();
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
            {/* Backdrop click outside */}
            <div className="fixed inset-0" onClick={handleInitiateCancel} aria-hidden="true" />

            {/* Modal Box */}
            <div
                className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden z-10"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Modal - Fixed */}
                <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 shadow-xs">
                            <QrCode className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                <span>Thanh Toán Chuyển Khoản VietQR</span>
                                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <ShieldCheck className="w-3 h-3" /> Tự động 24/7
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Quét mã QR bằng ứng dụng ngân hàng hoặc chuyển khoản theo thông tin bên dưới
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Đồng hồ đếm ngược giữ phòng */}
                        <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                            timeLeft < 180
                                ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                            <Clock className="w-3.5 h-3.5" />
                            <span>Giữ phòng: {formatTimer(timeLeft)}</span>
                        </div>

                        <button
                            type="button"
                            onClick={handleInitiateCancel}
                            disabled={isLoading}
                            className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-50"
                            title="Đóng / Hủy"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Banner cảnh báo thời gian đếm ngược trên di động - Fixed under header */}
                <div className="sm:hidden px-6 py-2 bg-amber-50 border-b border-amber-100 text-amber-800 text-xs font-semibold flex items-center justify-between shrink-0">
                    <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Thời gian giữ phòng còn lại:</span>
                    </span>
                    <strong className="font-mono font-bold text-amber-900">{formatTimer(timeLeft)}</strong>
                </div>

                {/* Body: Phân chia Layout grid md:grid-cols-2 gap-6 - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-start">
                    {/* ========================================================================= */}
                    {/* CỘT TRÁI: THÔNG TIN THANH TOÁN                                             */}
                    {/* ========================================================================= */}
                    <div className="space-y-4 sm:space-y-5">
                        {/* Hộp nổi bật: Số tiền thanh toán */}
                        <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent rounded-2xl sm:rounded-3xl p-5 border border-amber-200/80 shadow-xs">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                                    <CreditCard className="w-4 h-4 text-amber-600" /> Số tiền cần thanh toán
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleCopy(totalAmount.toString(), 'amount')}
                                    className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1 transition cursor-pointer"
                                    title="Sao chép số tiền"
                                >
                                    {copiedKey === 'amount' ? (
                                        <span className="text-emerald-600 flex items-center gap-0.5 font-bold">
                                            <Check className="w-3 h-3" /> Đã chép
                                        </span>
                                    ) : (
                                        <>
                                            <Copy className="w-3 h-3" /> Chép số tiền
                                        </>
                                    )}
                                </button>
                            </div>
                            <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-rose-600 font-bold tracking-tight">
                                {formatVND(totalAmount)}
                            </div>
                            <div className="mt-2 text-xs text-slate-600 flex items-center gap-2 pt-2 border-t border-amber-200/60">
                                <span>Mã phòng:</span>
                                <strong className="font-mono text-slate-900 bg-white/80 px-2 py-0.5 rounded-md border border-amber-200 font-bold">
                                    {code}
                                </strong>
                            </div>
                        </div>

                        {/* Danh sách thông tin chi tiết */}
                        <div className="bg-slate-50/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/80 space-y-3 text-xs">
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                                Thông tin tài khoản người thụ hưởng
                            </div>

                            {/* Mã phòng / Mã đơn */}
                            <div className="flex items-center justify-between gap-3 py-1">
                                <span className="text-slate-500 shrink-0">Mã phòng / Đơn:</span>
                                <span className="font-mono font-bold text-slate-900">{code}</span>
                            </div>

                            {/* Tên khách */}
                            <div className="flex items-center justify-between gap-3 py-1 border-t border-slate-200/60 pt-2.5">
                                <span className="text-slate-500 shrink-0">Tên khách hàng:</span>
                                <strong className="text-slate-900">{guest}</strong>
                            </div>

                            {/* Ngân hàng */}
                            <div className="flex items-center justify-between gap-3 py-1 border-t border-slate-200/60 pt-2.5">
                                <span className="text-slate-500 shrink-0">Ngân hàng:</span>
                                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-right">
                                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-mono font-black">
                                        {bankConfig.bank_bin}
                                    </span>
                                    <span>
                                        {BANK_NAMES_BY_BIN[bankConfig.bank_bin]?.short || `Napas247 (BIN: ${bankConfig.bank_bin})`}
                                    </span>
                                </div>
                            </div>

                            {/* Số tài khoản */}
                            <div className="flex items-center justify-between gap-3 py-1 border-t border-slate-200/60 pt-2.5">
                                <span className="text-slate-500 shrink-0">Số tài khoản:</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-base font-black text-slate-900 tracking-wider">
                                        {bankConfig.account_no}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(bankConfig.account_no, 'accountNo')}
                                        className="p-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-600 border border-slate-200 transition cursor-pointer active:scale-95"
                                        title="Sao chép số tài khoản"
                                    >
                                        {copiedKey === 'accountNo' ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Tên chủ tài khoản */}
                            <div className="flex items-center justify-between gap-3 py-1 border-t border-slate-200/60 pt-2.5">
                                <span className="text-slate-500 shrink-0">Tên tài khoản:</span>
                                <div className="flex items-center gap-2">
                                    <strong className="text-slate-900 uppercase tracking-wide">
                                        {bankConfig.account_name}
                                    </strong>
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(bankConfig.account_name, 'accountName')}
                                        className="p-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-600 border border-slate-200 transition cursor-pointer active:scale-95"
                                        title="Sao chép tên tài khoản"
                                    >
                                        {copiedKey === 'accountName' ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Nội dung chuyển khoản */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 border-t border-slate-200/60 pt-2.5 bg-blue-50/50 -mx-2 px-3 py-2 rounded-xl border border-blue-200/60">
                                <div>
                                    <span className="text-[11px] font-bold text-blue-900 block">
                                        Nội dung chuyển khoản:
                                    </span>
                                    <span className="font-mono text-sm font-black text-blue-700 tracking-wide select-all">
                                        {transferContent}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleCopy(transferContent, 'content')}
                                    className="self-start sm:self-auto px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                                >
                                    {copiedKey === 'content' ? (
                                        <>
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Đã chép</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>Chép nội dung</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Thông báo lỗi nếu có */}
                        {errorMessage && (
                            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2 animate-fadeIn">
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>{errorMessage}</span>
                            </div>
                        )}
                    </div>

                    {/* ========================================================================= */}
                    {/* CỘT PHẢI: MÃ VIETQR VỚI HIỆU ỨNG VIỀN ĐỨT NÉT                            */}
                    {/* ========================================================================= */}
                    <div className="flex flex-col items-center justify-center p-6 bg-slate-50/70 rounded-2xl sm:rounded-3xl border border-slate-200/80 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-700 shadow-2xs mb-4">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            VietQR • Quét Mã Chuyển Khoản 24/7
                        </div>

                        {/* Thẻ <img> hiển thị qrUrl với hiệu ứng viền đứt nét */}
                        <div className="relative p-2.5 bg-white rounded-2xl border-2 border-dashed border-blue-400 shadow-md max-w-[270px] w-full aspect-square flex items-center justify-center overflow-hidden group">
                            {isLoadingConfig ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-slate-400 gap-2 z-10">
                                    <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                                    <span className="text-xs font-semibold text-slate-600">Đang tải cấu hình VietQR...</span>
                                </div>
                            ) : isImageLoading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-slate-400 gap-2">
                                    <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
                                    <span className="text-xs font-semibold">Đang nạp mã VietQR...</span>
                                </div>
                            ) : null}

                            {qrUrl ? (
                                <img
                                    src={qrUrl}
                                    alt={`VietQR thanh toán ${code}`}
                                    className={`w-full h-full object-contain rounded-xl transition-all duration-300 ${
                                        isLoadingConfig || isImageLoading ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                                    }`}
                                    onLoad={() => setIsImageLoading(false)}
                                    onError={() => setIsImageLoading(false)}
                                />
                            ) : (
                                <div className="text-xs text-slate-400 flex flex-col items-center gap-1">
                                    <AlertCircle className="w-6 h-6 text-amber-500" />
                                    <span>Chưa có thông tin QR</span>
                                </div>
                            )}
                        </div>

                        {/* Dòng chữ hướng dẫn */}
                        <div className="mt-4 space-y-1">
                            <p className="text-xs sm:text-sm font-bold text-slate-900 flex items-center justify-center gap-1.5">
                                <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
                                <span>Mở app ngân hàng và quét mã để thanh toán nhanh</span>
                            </p>
                            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                                Tự động điền số tiền <strong className="text-slate-800">{formatVND(totalAmount)}</strong> & nội dung chuyển khoản
                            </p>
                        </div>

                        {/* KHU VỰC TRẠNG THÁI TỰ ĐỘNG CHỜ NHẬN TIỀN (AUTO POLLING) & HÀNH ĐỘNG */}
                        <div className="w-full mt-6 space-y-3">
                            <div className="p-3.5 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 border border-blue-200/90 rounded-2xl flex items-center justify-center gap-2.5 text-blue-700 shadow-xs">
                                <span className="relative flex h-3 w-3 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
                                </span>
                                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                                <span className="text-xs sm:text-sm font-semibold text-blue-900 animate-pulse tracking-wide">
                                    Hệ thống đang tự động chờ nhận tiền...
                                </span>
                            </div>

                            <div className="flex flex-col gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={handleConfirmPayment}
                                    disabled={isLoading}
                                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/20 disabled:opacity-50"
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-4 h-4" />
                                    )}
                                    <span>Tôi đã chuyển khoản xong</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleInitiateCancel}
                                    disabled={isLoading}
                                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm transition cursor-pointer disabled:opacity-50 text-center"
                                >
                                    Hủy bỏ / Thanh toán sau
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

            {/* ========================================================================= */}
            {/* MODAL XÁC NHẬN KHI KHÁCH BẤM "HỦY BỎ"                                      */}
            {/* ========================================================================= */}
            {showCancelDialog && (
                <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4 animate-fadeIn backdrop-blur-xs">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 text-center space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
                            <AlertTriangle className="w-7 h-7" />
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                                Bạn muốn tạm dừng thanh toán?
                            </h3>
                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                Đơn đặt phòng <strong className="text-slate-800 font-mono">{code}</strong> đã được lưu tạm trên hệ thống. Bạn có thể chọn giữ lại để thanh toán khi Check-in hoặc hủy hoàn toàn đơn này.
                            </p>
                        </div>

                        <div className="space-y-2 pt-2">
                            {/* Nút 1: Tiếp tục quét mã */}
                            <button
                                type="button"
                                onClick={() => setShowCancelDialog(false)}
                                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/20"
                            >
                                <QrCode className="w-4 h-4" />
                                <span>Tiếp tục chuyển khoản</span>
                            </button>

                            {/* Nút 2: Lưu lại thanh toán sau */}
                            <button
                                type="button"
                                onClick={handleSaveAndExit}
                                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Save className="w-4 h-4 text-slate-500" />
                                <span>Lưu đơn, tôi sẽ thanh toán sau</span>
                            </button>

                            {/* Nút 3: Hủy bỏ hoàn toàn đơn */}
                            <button
                                type="button"
                                onClick={handleCancelBookingEntirely}
                                disabled={isCancellingBooking}
                                className="w-full py-2 px-4 rounded-xl text-rose-600 hover:bg-rose-50 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {isCancellingBooking ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                )}
                                <span>Hủy bỏ hoàn toàn đơn đặt phòng này</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Giữ lại alias PaymentSection cho các component cần nhúng inline
export function PaymentSection(props) {
    return <PaymentModal {...props} isOpen={true} />;
}
