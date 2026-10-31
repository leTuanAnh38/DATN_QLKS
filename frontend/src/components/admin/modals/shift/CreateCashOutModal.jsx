import React, { useState, useEffect } from 'react';
import {
    X,
    Banknote,
    ArrowDownCircle,
    Building2,
    AlertCircle,
    CheckCircle2,
    Search,
    Printer,
    Coins,
    CreditCard,
    Loader2
} from 'lucide-react';
import paymentService from '../../../../services/paymentService';
import api from '../../../../services/api';

/**
 * Modal Lập Phiếu Chi Tiền Mặt / Hoàn Cọc (Cash Out & Refund Voucher)
 * Hỗ trợ 3 trường hợp nghiệp vụ khách sạn chuẩn:
 * 1. REFUND_DEPOSIT: Hoàn cọc / Trả tiền thừa đơn phòng (Check-out hoặc giữa kỳ)
 * 2. REFUND_CANCEL: Hoàn tiền cọc khi hủy đơn phòng / đơn đoàn hợp lệ
 * 3. PETTY_CASH: Chi phí phát sinh nội bộ quầy tiếp tân (mua đá, văn phòng phẩm, taxi...)
 */
export default function CreateCashOutModal({
    isOpen,
    onClose,
    activeShift,
    initialBooking = null,
    onCashOutCreated
}) {
    // 1. Loại phiếu chi
    const [voucherType, setVoucherType] = useState(
        initialBooking ? 'REFUND_DEPOSIT' : 'REFUND_DEPOSIT'
    );

    // 2. Hình thức chi: CASH (Két quầy) | TRANSFER (Chuyển khoản)
    const [paymentMethod, setPaymentMethod] = useState('CASH');

    // 3. Số tiền chi
    const [amount, setAmount] = useState('');

    // 4. Tìm kiếm & Chọn đơn phòng (nếu là hoàn tiền phòng)
    const [bookingSearch, setBookingSearch] = useState('');
    const [selectedBooking, setSelectedBooking] = useState(initialBooking || null);
    const [searchingBookings, setSearchingBookings] = useState(false);
    const [searchResults, setSearchResults] = useState([]);

    // 5. Thông tin người nhận & Lý do
    const [recipientName, setRecipientName] = useState(
        initialBooking?.guest_name || initialBooking?.guest?.get_full_name || ''
    );
    const [recipientPhone, setRecipientPhone] = useState(
        initialBooking?.guest_phone || initialBooking?.guest?.phone || ''
    );
    const [reason, setReason] = useState('');
    const [approvedBy, setApprovedBy] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [createdVoucher, setCreatedVoucher] = useState(null);

    // Đồng bộ khi mở modal hoặc initialBooking thay đổi
    useEffect(() => {
        if (!isOpen) return;
        if (initialBooking) {
            setSelectedBooking(initialBooking);
            setRecipientName(initialBooking.guest_name || initialBooking.guest?.get_full_name || initialBooking.customer_name || '');
            setRecipientPhone(initialBooking.guest_phone || initialBooking.guest?.phone || '');
            setVoucherType('REFUND_DEPOSIT');
        } else {
            setCreatedVoucher(null);
            setError(null);
        }
    }, [isOpen, initialBooking]);

    // Số dư tiền mặt hiện tại trong két
    const shiftSummary = activeShift?.realtime_summary || activeShift?.current_summary || {};
    const openingCash = Number(shiftSummary.opening_cash ?? activeShift?.opening_cash ?? 0);
    const cashIn = Number(shiftSummary.cash_in ?? shiftSummary.total_cash_in ?? activeShift?.total_cash_in ?? 0);
    const cashOut = Number(shiftSummary.cash_out ?? shiftSummary.total_cash_out ?? activeShift?.total_cash_out ?? 0);
    const currentCashInDrawer = Number(shiftSummary.expected_cash ?? (openingCash + cashIn - cashOut));

    // Format tiền tệ VNĐ
    const formatCurrency = (val) => {
        const num = Number(val) || 0;
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
    };

    // Tìm kiếm đơn đặt phòng khi gõ từ khóa
    useEffect(() => {
        const keyword = bookingSearch.trim();
        if (!keyword || selectedBooking) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setSearchingBookings(true);
            try {
                const res = await api.get('/bookings/', {
                    params: { search: keyword, page_size: 8 }
                });
                const list = res.data?.results || res.data || [];
                const rawArray = Array.isArray(list) ? list : [];

                // Sắp xếp ưu tiên tuyệt đối: đơn nào khớp chính xác mã (có/không tiền tố BK-, dấu #) thì luôn lên số 1
                const lowerKeyword = keyword.toLowerCase().trim();
                const cleanKeyword = lowerKeyword.replace(/^#/, '').trim();
                const sorted = rawArray.slice().sort((a, b) => {
                    const codeA = (a.booking_code || '').toLowerCase().replace(/^#/, '').trim();
                    const codeB = (b.booking_code || '').toLowerCase().replace(/^#/, '').trim();

                    // 1. Khớp chính xác hoàn toàn mã đơn
                    const matchExactA = codeA === cleanKeyword || codeA === `bk-${cleanKeyword}` || `bk-${codeA}` === cleanKeyword;
                    const matchExactB = codeB === cleanKeyword || codeB === `bk-${cleanKeyword}` || `bk-${codeB}` === cleanKeyword;
                    if (matchExactA && !matchExactB) return -1;
                    if (matchExactB && !matchExactA) return 1;

                    // 2. Bắt đầu bằng từ khóa mã đơn
                    const startA = codeA.startsWith(cleanKeyword) || codeA.startsWith(`bk-${cleanKeyword}`);
                    const startB = codeB.startsWith(cleanKeyword) || codeB.startsWith(`bk-${cleanKeyword}`);
                    if (startA && !startB) return -1;
                    if (startB && !startA) return 1;

                    // 3. Chứa từ khóa
                    const containA = codeA.includes(cleanKeyword);
                    const containB = codeB.includes(cleanKeyword);
                    if (containA && !containB) return -1;
                    if (containB && !containA) return 1;

                    return 0;
                });

                setSearchResults(sorted);
            } catch (err) {
                console.warn('Lỗi tìm kiếm đơn:', err);
                setSearchResults([]);
            } finally {
                setSearchingBookings(false);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [bookingSearch, selectedBooking]);

    // Khi chọn một đơn từ kết quả tìm kiếm
    const handleSelectBooking = (bk) => {
        setSelectedBooking(bk);
        setBookingSearch('');
        setSearchResults([]);
        if (!recipientName) {
            setRecipientName(bk.guest_name || bk.guest?.get_full_name || bk.customer_name || '');
        }
        if (!recipientPhone) {
            setRecipientPhone(bk.guest_phone || bk.guest?.phone || '');
        }
    };

    // Xử lý gửi biểu mẫu
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        const numericAmount = Number(amount);
        if (!numericAmount || numericAmount <= 0) {
            setError('Vui lòng nhập số tiền chi hợp lệ (> 0 đ).');
            return;
        }

        if (paymentMethod === 'CASH') {
            if (!activeShift) {
                setError('Quầy chưa có ca làm việc nào đang mở. Không thể chi tiền mặt từ két khi chưa mở ca!');
                return;
            }
            if (numericAmount > currentCashInDrawer) {
                setError(`Số tiền mặt trong két hiện tại (${formatCurrency(currentCashInDrawer)}) không đủ để chi ${formatCurrency(numericAmount)}!`);
                return;
            }
        }

        if (!recipientName.trim()) {
            setError('Vui lòng nhập họ tên người nhận tiền.');
            return;
        }

        if (!reason.trim()) {
            setError('Vui lòng nhập lý do lập phiếu chi.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                voucher_type: voucherType,
                payment_method: paymentMethod,
                amount: numericAmount,
                recipient_name: recipientName.trim(),
                recipient_phone: recipientPhone.trim(),
                reason: reason.trim(),
                approved_by: approvedBy.trim(),
                booking_id: selectedBooking?.id || selectedBooking?.booking_code || null,
            };

            const res = await paymentService.createCashOut(payload);
            if (res.success) {
                setCreatedVoucher(res.data || res.voucher);
                if (onCashOutCreated) {
                    onCashOutCreated(res.data || res.voucher);
                }
            }
        } catch (err) {
            console.error('Lỗi khi lập phiếu chi:', err);
            const msg = err.response?.data?.message || 'Không thể lập phiếu chi. Vui lòng thử lại!';
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    // In phiếu chi bằng iframe ẩn độc lập để đảm bảo không bị lỗi trang trắng
    const handlePrintVoucher = () => {
        const reportElement = document.getElementById('cash-out-printable');
        if (!reportElement) {
            window.print();
            return;
        }

        let iframe = document.getElementById('cash-out-print-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'cash-out-print-iframe';
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = 'none';
            iframe.style.zIndex = '-9999';
            document.body.appendChild(iframe);
        }

        const doc = iframe.contentWindow.document;
        const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
            .map(el => el.outerHTML)
            .join('\n');

        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="utf-8" />
                <title>Phiếu Chi - #${createdVoucher?.voucher_code || ''}</title>
                ${styleTags}
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 12mm 15mm 12mm 15mm;
                    }
                    html, body {
                        background: #ffffff !important;
                        color: #0f172a !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    #cash-out-printable {
                        padding: 0 !important;
                        margin: 0 auto !important;
                        max-width: 100% !important;
                        overflow: visible !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                </style>
            </head>
            <body class="bg-white p-4">
                <div id="cash-out-printable">
                    ${reportElement.innerHTML}
                </div>
            </body>
            </html>
        `);
        doc.close();

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }, 300);
    };

    if (!isOpen) return null;

    return (
        <div className="cash-out-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 print:p-0 print:bg-white print:static">
            {/* CSS in phiếu chi (dự phòng) */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 10mm 15mm 10mm 15mm;
                    }
                    html, body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        height: auto !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #root,
                    .cash-out-modal-backdrop,
                    .cash-out-modal-card,
                    #cash-out-printable,
                    #cash-out-printable * {
                        visibility: visible !important;
                    }
                    .cash-out-modal-backdrop {
                        position: static !important;
                        background: transparent !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                        display: block !important;
                    }
                    .cash-out-modal-card {
                        position: static !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        border: none !important;
                        box-shadow: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        max-height: none !important;
                        display: block !important;
                    }
                    #cash-out-printable {
                        position: static !important;
                        width: 100% !important;
                        margin: 0 auto !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        display: block !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}} />

            <div className="cash-out-modal-card relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 text-left print:border-none print:shadow-none print:max-w-none print:max-h-none">
                {/* 1. HEADER (Fixed Non-Scrolling) */}
                <div className="shrink-0 flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-2xs shrink-0">
                            <ArrowDownCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                                {createdVoucher ? 'Phiếu Chi Tiền & Hoàn Cọc' : 'Lập Phiếu Chi Tiền Mặt / Hoàn Cọc'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {createdVoucher
                                    ? `Mã phiếu: #${createdVoucher.voucher_code}`
                                    : 'Xuất quỹ tiền két hoặc ghi nhận hoàn trả chuyển khoản'
                                }
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* THÀNH CÔNG: MÀN HÌNH XÁC NHẬN & IN PHIẾU CHI */}
                {createdVoucher ? (
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                            <div id="cash-out-printable" className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-slate-800 space-y-4">
                                <div className="text-center pb-3 border-b border-slate-300">
                                    <h2 className="text-base font-black uppercase text-slate-900">PHIẾU CHI TIỀN & HOÀN CỌC</h2>
                                    <p className="font-mono text-xs font-bold text-slate-600 mt-0.5">#{createdVoucher.voucher_code}</p>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        Loại phiếu: <span className="font-bold text-slate-800">{createdVoucher.voucher_type_display}</span>
                                        {' • '}Hình thức: <span className="font-bold text-rose-700">{createdVoucher.payment_method_display}</span>
                                    </p>
                                </div>

                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between py-1 border-b border-slate-200">
                                        <span className="text-slate-500">Người nhận tiền:</span>
                                        <span className="font-bold text-slate-900">{createdVoucher.recipient_name} {createdVoucher.recipient_phone && `(${createdVoucher.recipient_phone})`}</span>
                                    </div>
                                    {createdVoucher.booking_code && (
                                        <div className="flex justify-between py-1 border-b border-slate-200">
                                            <span className="text-slate-500">Đơn đặt phòng:</span>
                                            <span className="font-semibold text-slate-800">#{createdVoucher.booking_code} {createdVoucher.room_number && `(${createdVoucher.room_number})`}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between py-1 border-b border-slate-200">
                                        <span className="text-slate-500">Lý do chi:</span>
                                        <span className="font-medium text-slate-800 text-right max-w-xs">{createdVoucher.reason}</span>
                                    </div>
                                    <div className="flex justify-between py-2 bg-white px-3 rounded-xl border border-slate-200">
                                        <span className="text-slate-700 font-bold text-sm">Tổng số tiền chi:</span>
                                        <span className="font-mono font-black text-rose-600 text-base">-{formatCurrency(createdVoucher.amount)}</span>
                                    </div>
                                </div>

                                {/* Chữ ký 3 bên */}
                                <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-4">
                                    <div>
                                        <div className="font-bold uppercase">Người Nhận Tiền</div>
                                        <div className="text-[10px] text-slate-400 italic">(Ký, họ tên)</div>
                                        <div className="mt-10 font-semibold text-slate-800">{createdVoucher.recipient_name}</div>
                                    </div>
                                    <div>
                                        <div className="font-bold uppercase">Người Lập Phiếu</div>
                                        <div className="text-[10px] text-slate-400 italic">(Ký, họ tên)</div>
                                        <div className="mt-10 font-semibold text-slate-800">{createdVoucher.user_name}</div>
                                    </div>
                                    <div>
                                        <div className="font-bold uppercase">Người Phê Duyệt</div>
                                        <div className="text-[10px] text-slate-400 italic">(Ký duyệt)</div>
                                        <div className="mt-10 font-semibold text-slate-800">{createdVoucher.approved_by || 'Quản lý'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action footer (Sticky Bottom) */}
                        <div className="shrink-0 no-print px-5 sm:px-6 py-4 bg-slate-50/90 backdrop-blur-xs border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={handlePrintVoucher}
                                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                            >
                                <Printer className="w-4 h-4" />
                                <span>In Phiếu Chi (Ctrl+P)</span>
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer text-center"
                            >
                                Hoàn tất & Đóng
                            </button>
                        </div>
                    </div>
                ) : (
                    /* FORM NHẬP LIỆU LẬP PHIẾU CHI */
                    <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {/* 2. BODY (Scrollable) */}
                        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                            {error && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* 1. Chọn loại phiếu chi */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                                    1. Mục Đích Chi Tiền
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setVoucherType('REFUND_DEPOSIT')}
                                        className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                                            voucherType === 'REFUND_DEPOSIT'
                                                ? 'bg-rose-50 border-rose-400 text-rose-900 ring-1 ring-rose-400'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="font-bold text-xs flex items-center gap-1.5">
                                            <Banknote className="w-3.5 h-3.5 text-rose-600" />
                                            <span>Hoàn cọc phòng</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 line-clamp-1">Trả cọc khi Checkout / cọc thừa</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setVoucherType('REFUND_CANCEL')}
                                        className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                                            voucherType === 'REFUND_CANCEL'
                                                ? 'bg-rose-50 border-rose-400 text-rose-900 ring-1 ring-rose-400'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="font-bold text-xs flex items-center gap-1.5">
                                            <Coins className="w-3.5 h-3.5 text-amber-600" />
                                            <span>Hoàn khi hủy đơn</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 line-clamp-1">Hủy đơn lẻ / đơn đoàn hợp lệ</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setVoucherType('PETTY_CASH');
                                            setSelectedBooking(null);
                                        }}
                                        className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                                            voucherType === 'PETTY_CASH'
                                                ? 'bg-rose-50 border-rose-400 text-rose-900 ring-1 ring-rose-400'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="font-bold text-xs flex items-center gap-1.5">
                                            <Building2 className="w-3.5 h-3.5 text-blue-600" />
                                            <span>Chi vặt nội bộ quầy</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 line-clamp-1">Mua đá, giấy in bill, taxi...</span>
                                    </button>
                                </div>
                            </div>

                            {/* 2. Chọn đơn phòng liên quan nếu là Hoàn cọc */}
                            {voucherType !== 'PETTY_CASH' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Đơn đặt phòng liên quan
                                    </label>
                                    {selectedBooking ? (
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                                            <div>
                                                <div className="font-bold text-xs text-slate-900">
                                                    #{selectedBooking.booking_code} {selectedBooking.room?.room_number && `(${selectedBooking.room.room_number})`}
                                                </div>
                                                <div className="text-[11px] text-slate-500 mt-0.5">
                                                    Khách: <span className="font-semibold text-slate-700">{selectedBooking.guest_name || selectedBooking.guest?.get_full_name || 'Khách vãng lai'}</span>
                                                    {' • '}Tổng đơn: <span className="font-mono font-bold text-emerald-600">{formatCurrency(selectedBooking.total_amount)}</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedBooking(null)}
                                                className="text-xs text-slate-400 hover:text-rose-600 font-semibold px-2 py-1 rounded hover:bg-slate-200 transition cursor-pointer"
                                            >
                                                Đổi đơn khác
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                value={bookingSearch}
                                                onChange={(e) => setBookingSearch(e.target.value)}
                                                placeholder="Gõ mã đơn phòng, tên khách hoặc số phòng..."
                                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                                            />
                                            {searchingBookings && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 animate-pulse">
                                                    Đang tìm...
                                                </div>
                                            )}
                                            {searchResults.length > 0 && (
                                                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-20 max-h-56 overflow-y-auto divide-y divide-slate-100">
                                                    {searchResults.map((b) => {
                                                        const cleanInput = bookingSearch.trim().toLowerCase().replace(/^#/, '');
                                                        const cleanCode = (b.booking_code || '').toLowerCase().replace(/^#/, '');
                                                        const isExact = cleanCode === cleanInput || cleanCode === `bk-${cleanInput}` || `bk-${cleanCode}` === cleanInput;
                                                        return (
                                                            <div
                                                                key={b.id}
                                                                onClick={() => handleSelectBooking(b)}
                                                                className={`p-2.5 hover:bg-rose-50/60 cursor-pointer text-xs flex items-center justify-between transition ${
                                                                    isExact ? 'bg-emerald-50/70 border-l-4 border-l-emerald-500' : ''
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-slate-800 font-mono">#{b.booking_code}</span>
                                                                    {isExact && (
                                                                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">
                                                                            Khớp mã
                                                                        </span>
                                                                    )}
                                                                    <span className="text-slate-600 font-medium">
                                                                        {b.guest_name || b.guest?.get_full_name || 'Khách'}
                                                                    </span>
                                                                    {b.room_number && (
                                                                        <span className="text-[11px] text-slate-400 font-normal">
                                                                            (P.{b.room_number})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="font-mono text-emerald-600 font-bold block">
                                                                        {formatCurrency(b.total_amount)}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 font-normal">
                                                                        {b.status_display || b.status}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {bookingSearch.trim() && !searchingBookings && searchResults.length === 0 && (
                                                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 z-20 p-3 text-center text-xs text-slate-400">
                                                    Không tìm thấy đơn đặt phòng nào khớp với từ khóa "{bookingSearch}".
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 3. Hình thức chi tiền & Số tiền */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Hình thức xuất tiền
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('CASH')}
                                            className={`p-2 rounded-xl border text-center transition cursor-pointer text-xs font-bold flex items-center justify-center gap-1.5 ${
                                                paymentMethod === 'CASH'
                                                    ? 'bg-rose-50 border-rose-400 text-rose-900 ring-1 ring-rose-400'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <Banknote className="w-3.5 h-3.5 text-rose-600" />
                                            <span>Két tiền mặt</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('TRANSFER')}
                                            className={`p-2 rounded-xl border text-center transition cursor-pointer text-xs font-bold flex items-center justify-center gap-1.5 ${
                                                paymentMethod === 'TRANSFER'
                                                    ? 'bg-blue-50 border-blue-400 text-blue-900 ring-1 ring-blue-400'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                                            <span>Chuyển khoản</span>
                                        </button>
                                    </div>
                                    {paymentMethod === 'CASH' ? (
                                        <div className="text-[11px] text-slate-500 mt-1.5 flex items-center justify-between">
                                            <span>Tiền két hiện có:</span>
                                            <span className="font-mono font-bold text-slate-800">{formatCurrency(currentCashInDrawer)}</span>
                                        </div>
                                    ) : (
                                        <div className="text-[11px] text-blue-700 mt-1.5 p-2 rounded-xl bg-blue-50/80 border border-blue-200/60 leading-relaxed flex items-start gap-1.5">
                                            <CreditCard className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                                            <div>
                                                <b>Chi từ Tài khoản Ngân hàng KS</b>: Lập phiếu ủy nhiệm chi để Kế toán/Quản lý chuyển khoản cho khách. <b>Không làm giảm tiền mặt trong két quầy.</b>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Số tiền chi ra (VND) <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="1000"
                                            step="1000"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="VD: 500000"
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-rose-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                                            required
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">đ</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                        {[200000, 500000, 1000000].map((v) => (
                                            <button
                                                key={v}
                                                type="button"
                                                onClick={() => setAmount(String(v))}
                                                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-slate-600 cursor-pointer"
                                            >
                                                {v >= 1000000 ? `${v / 1000000}tr` : `${v / 1000}k`}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 4. Thông tin người nhận & Người duyệt */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Họ tên người nhận tiền <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={recipientName}
                                        onChange={(e) => setRecipientName(e.target.value)}
                                        placeholder="Tên khách hoặc tên nhân viên mua hàng"
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        SĐT người nhận (tùy chọn)
                                    </label>
                                    <input
                                        type="text"
                                        value={recipientPhone}
                                        onChange={(e) => setRecipientPhone(e.target.value)}
                                        placeholder="09xx..."
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                                    />
                                </div>
                            </div>

                            {/* 5. Lý do & Phê duyệt */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Lý do chi tiền <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder={
                                            voucherType === 'REFUND_DEPOSIT' ? 'Hoàn cọc chìa khóa phòng, trả cọc thừa lúc checkout...' :
                                            voucherType === 'REFUND_CANCEL' ? 'Hoàn 50% cọc hủy đoàn theo hợp đồng...' :
                                            'Mua đá lạnh khẩn cấp, mua giấy in bill...'
                                        }
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Người phê duyệt
                                    </label>
                                    <input
                                        type="text"
                                        value={approvedBy}
                                        onChange={(e) => setApprovedBy(e.target.value)}
                                        placeholder="Quản lý / Chủ KS"
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. FOOTER ACTIONS (Sticky Bottom) */}
                        <div className="shrink-0 px-5 sm:px-6 py-4 bg-slate-50/90 backdrop-blur-xs border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-100 transition cursor-pointer text-center"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-600/30 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Đang xuất quỹ...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>Xác Nhận Lập Phiếu Chi</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

