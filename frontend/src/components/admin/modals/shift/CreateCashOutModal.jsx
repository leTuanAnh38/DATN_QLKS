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
    Loader2,
    Landmark,
    Copy,
    Check
} from 'lucide-react';
import paymentService from '../../../../services/paymentService';
import api from '../../../../services/api';

const POPULAR_VN_BANKS = [
    'MB Bank',
    'Vietcombank',
    'Techcombank',
    'BIDV',
    'VietinBank',
    'ACB',
    'VPBank',
    'TPBank',
    'Sacombank',
    'Agribank',
    'HDBank',
    'VIB',
    'SHB',
    'OCB',
    'MSB',
    'SeABank',
    'Eximbank',
    'LPBank',
    'Cake by VPBank',
    'Timo'
];

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
    initialGroup = null,
    initialVoucherType = null,
    initialAmount = '',
    initialPaymentMethod = null,
    initialReason = '',
    onCashOutCreated
}) {
    // 1. Loại phiếu chi
    const [voucherType, setVoucherType] = useState(
        initialVoucherType || (initialGroup ? 'REFUND_CANCEL' : 'REFUND_DEPOSIT')
    );

    // 2. Hình thức chi: CASH (Két quầy) | TRANSFER (Chuyển khoản)
    const [paymentMethod, setPaymentMethod] = useState(
        initialPaymentMethod || (initialGroup ? 'TRANSFER' : 'CASH')
    );

    // 3. Số tiền chi
    const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : '');

    // 4. Phạm vi liên kết đơn: 'single' (Đơn lẻ) | 'group' (Đơn đặt đoàn)
    const [targetScope, setTargetScope] = useState(initialGroup ? 'group' : 'single');

    // 4a. Tìm kiếm & Chọn đơn phòng lẻ
    const [bookingSearch, setBookingSearch] = useState('');
    const [selectedBooking, setSelectedBooking] = useState(initialBooking || null);
    const [searchingBookings, setSearchingBookings] = useState(false);
    const [searchResults, setSearchResults] = useState([]);

    // 4b. Tìm kiếm & Chọn đơn đặt đoàn
    const [groupSearch, setGroupSearch] = useState('');
    const [selectedGroup, setSelectedGroup] = useState(initialGroup || null);
    const [searchingGroups, setSearchingGroups] = useState(false);
    const [groupSearchResults, setGroupSearchResults] = useState([]);

    // 5. Thông tin người nhận & Lý do
    const [recipientName, setRecipientName] = useState(
        initialGroup?.leader_name || initialBooking?.guest_name || initialBooking?.guest?.get_full_name || ''
    );
    const [recipientPhone, setRecipientPhone] = useState(
        initialGroup?.leader_phone || initialBooking?.guest_phone || initialBooking?.guest?.phone || ''
    );
    const [recipientBankName, setRecipientBankName] = useState(
        initialGroup?.cancel_request?.refund_bank_name || initialBooking?.refund_bank_info?.bank_name || ''
    );
    const [recipientAccountNumber, setRecipientAccountNumber] = useState(
        initialGroup?.cancel_request?.refund_account_number || initialBooking?.refund_bank_info?.account_number || ''
    );
    const [recipientAccountHolder, setRecipientAccountHolder] = useState(
        initialGroup?.cancel_request?.refund_account_holder ||
        initialBooking?.refund_bank_info?.account_holder ||
        (initialGroup?.leader_name || initialBooking?.guest_name || '').toUpperCase()
    );
    const [reason, setReason] = useState(initialReason || '');
    const [approvedBy, setApprovedBy] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [createdVoucher, setCreatedVoucher] = useState(null);
    const [copiedBankNo, setCopiedBankNo] = useState(false);

    const handleCopyBankValue = (val) => {
        if (!val || !navigator?.clipboard) return;
        navigator.clipboard.writeText(val).then(() => {
            setCopiedBankNo(true);
            setTimeout(() => setCopiedBankNo(false), 1800);
        }).catch(() => {});
    };

    // Đồng bộ khi mở modal hoặc initialBooking / initialGroup thay đổi
    useEffect(() => {
        if (!isOpen) return;
        setCreatedVoucher(null);
        setError(null);
        if (initialGroup) {
            setTargetScope('group');
            setSelectedGroup(initialGroup);
            setSelectedBooking(null);
            setRecipientName(initialGroup.leader_name || '');
            setRecipientPhone(initialGroup.leader_phone || '');
            setRecipientBankName(initialGroup.cancel_request?.refund_bank_name || '');
            setRecipientAccountNumber(initialGroup.cancel_request?.refund_account_number || '');
            setRecipientAccountHolder(
                initialGroup.cancel_request?.refund_account_holder ||
                (initialGroup.leader_name || '').toUpperCase()
            );
            setVoucherType(initialVoucherType || (Number(initialGroup.overpaid_amount || 0) > 0 ? 'REFUND_DEPOSIT' : 'REFUND_CANCEL'));
            setPaymentMethod(initialPaymentMethod || 'TRANSFER');
            setAmount(initialAmount ? String(Math.round(Number(initialAmount))) : '');
            setReason(initialReason || '');
        } else if (initialBooking) {
            setTargetScope('single');
            setSelectedBooking(initialBooking);
            setSelectedGroup(null);
            setRecipientName(initialBooking.guest_name || initialBooking.guest?.get_full_name || initialBooking.customer_name || '');
            setRecipientPhone(initialBooking.guest_phone || initialBooking.guest?.phone || '');
            setRecipientBankName(initialBooking.refund_bank_info?.bank_name || '');
            setRecipientAccountNumber(initialBooking.refund_bank_info?.account_number || '');
            setRecipientAccountHolder(
                initialBooking.refund_bank_info?.account_holder ||
                (initialBooking.guest_name || initialBooking.guest?.get_full_name || '').toUpperCase()
            );
            setVoucherType(initialVoucherType || 'REFUND_DEPOSIT');
            if (initialPaymentMethod) setPaymentMethod(initialPaymentMethod);
            if (initialAmount) setAmount(String(Math.round(Number(initialAmount))));
            if (initialReason) setReason(initialReason);
        } else {
            setRecipientBankName('');
            setRecipientAccountNumber('');
            setRecipientAccountHolder('');
        }
    }, [isOpen, initialBooking, initialGroup, initialVoucherType, initialAmount, initialPaymentMethod, initialReason]);

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

    // Tìm kiếm đơn đặt đoàn khi gõ từ khóa
    useEffect(() => {
        const keyword = groupSearch.trim();
        if (targetScope !== 'group' || !keyword || selectedGroup) {
            setGroupSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setSearchingGroups(true);
            try {
                const res = await api.get('/bookings/groups/', {
                    params: { search: keyword, page_size: 8 }
                });
                const list = res.data?.results || res.data || [];
                setGroupSearchResults(Array.isArray(list) ? list : []);
            } catch (err) {
                console.warn('Lỗi tìm kiếm đơn đoàn:', err);
                setGroupSearchResults([]);
            } finally {
                setSearchingGroups(false);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [groupSearch, selectedGroup, targetScope]);

    // Khi chọn một đơn từ kết quả tìm kiếm
    const handleSelectBooking = (bk) => {
        setSelectedBooking(bk);
        setSelectedGroup(null);
        setBookingSearch('');
        setSearchResults([]);
        const gName = bk.guest_name || bk.guest?.get_full_name || bk.customer_name || '';
        if (!recipientName) {
            setRecipientName(gName);
        }
        if (!recipientPhone) {
            setRecipientPhone(bk.guest_phone || bk.guest?.phone || '');
        }
        if (bk.refund_bank_info) {
            if (bk.refund_bank_info.bank_name) setRecipientBankName(bk.refund_bank_info.bank_name);
            if (bk.refund_bank_info.account_number) setRecipientAccountNumber(bk.refund_bank_info.account_number);
            if (bk.refund_bank_info.account_holder) setRecipientAccountHolder(bk.refund_bank_info.account_holder);
        } else if (!recipientAccountHolder && gName) {
            setRecipientAccountHolder(gName.toUpperCase());
        }
        if (!reason) {
            setReason(`Hoàn tiền đơn phòng #${bk.booking_code} (${gName || 'Khách hàng'})`);
        }
    };

    // Khi chọn một đơn đặt đoàn từ kết quả tìm kiếm
    const handleSelectGroup = (grp) => {
        setSelectedGroup(grp);
        setSelectedBooking(null);
        setGroupSearch('');
        setGroupSearchResults([]);
        setRecipientName(grp.leader_name || '');
        setRecipientPhone(grp.leader_phone || '');
        if (grp.cancel_request) {
            if (grp.cancel_request.refund_bank_name) setRecipientBankName(grp.cancel_request.refund_bank_name);
            if (grp.cancel_request.refund_account_number) setRecipientAccountNumber(grp.cancel_request.refund_account_number);
            if (grp.cancel_request.refund_account_holder) {
                setRecipientAccountHolder(grp.cancel_request.refund_account_holder);
            } else if (grp.leader_name) {
                setRecipientAccountHolder(grp.leader_name.toUpperCase());
            }
        } else if (grp.leader_name) {
            setRecipientAccountHolder(grp.leader_name.toUpperCase());
        }
        if (!amount) {
            const suggested = Number(grp.overpaid_amount || 0) > 0
                ? Math.round(Number(grp.overpaid_amount))
                : Math.round(Number(grp.deposit_amount || 0));
            if (suggested > 0) setAmount(String(suggested));
        }
        if (!reason) {
            setReason(`Hoàn cọc đơn đoàn #${grp.group_code} (${grp.group_name || ''})`);
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

        if (paymentMethod === 'TRANSFER') {
            if (!recipientBankName.trim() || !recipientAccountNumber.trim()) {
                setError('Vui lòng nhập đầy đủ Tên ngân hàng và Số tài khoản người nhận khi chọn hình thức Chuyển khoản.');
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
                booking_id: targetScope === 'single' ? (selectedBooking?.id || selectedBooking?.booking_code || null) : null,
                group_booking_id: targetScope === 'group' ? (selectedGroup?.id || selectedGroup?.group_code || null) : null,
                ...(paymentMethod === 'TRANSFER'
                    ? {
                        recipient_bank_name: recipientBankName.trim(),
                        recipient_account_number: recipientAccountNumber.trim(),
                        recipient_account_holder: (recipientAccountHolder.trim() || recipientName.trim()).toUpperCase()
                    }
                    : {})
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
                        font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
                        font-variant-numeric: tabular-nums;
                        font-feature-settings: "tnum" 1;
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
        <div
            className="cash-out-modal-backdrop fixed inset-0 z-[70] flex items-center justify-center p-2.5 sm:p-5 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 print:p-0 print:bg-white print:static"
            onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose?.(); }}
        >
            {/* CSS in phiếu chi (dự phòng) */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 10mm 15mm 10mm 15mm;
                    }
                    html, body {
                        font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
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

            <div className="cash-out-modal-card relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200 text-left print:border-none print:shadow-none print:max-w-none print:max-h-none">
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
                                    {createdVoucher.group_booking_code && (
                                        <div className="flex justify-between py-1 border-b border-slate-200">
                                            <span className="text-slate-500">Đơn đặt đoàn:</span>
                                            <span className="font-semibold text-indigo-700 font-mono">#{createdVoucher.group_booking_code}</span>
                                        </div>
                                    )}
                                    {(createdVoucher.recipient_bank_name || createdVoucher.recipient_account_number) && (
                                        <>
                                            {createdVoucher.recipient_bank_name && (
                                                <div className="flex justify-between py-1 border-b border-slate-200">
                                                    <span className="text-slate-500">Ngân hàng nhận:</span>
                                                    <span className="font-bold text-slate-900">{createdVoucher.recipient_bank_name}</span>
                                                </div>
                                            )}
                                            {createdVoucher.recipient_account_number && (
                                                <div className="flex justify-between py-1 border-b border-slate-200">
                                                    <span className="text-slate-500">Số tài khoản nhận:</span>
                                                    <span className="font-mono font-bold text-indigo-800">{createdVoucher.recipient_account_number}</span>
                                                </div>
                                            )}
                                            {createdVoucher.recipient_account_holder && (
                                                <div className="flex justify-between py-1 border-b border-slate-200">
                                                    <span className="text-slate-500">Chủ tài khoản:</span>
                                                    <span className="font-bold text-slate-900 uppercase">{createdVoucher.recipient_account_holder}</span>
                                                </div>
                                            )}
                                        </>
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
                                            setSelectedGroup(null);
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

                            {/* 2. Chọn đơn phòng lẻ hoặc đơn đặt đoàn liên quan nếu là Hoàn cọc */}
                            {voucherType !== 'PETTY_CASH' && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <label className="block text-xs font-bold text-slate-700">
                                            Liên kết đơn hoàn tiền
                                        </label>
                                        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-bold">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTargetScope('single');
                                                    setSelectedGroup(null);
                                                }}
                                                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                                                    targetScope === 'single'
                                                        ? 'bg-white text-slate-900 shadow-2xs'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                Đơn lẻ
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTargetScope('group');
                                                    setSelectedBooking(null);
                                                }}
                                                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                                                    targetScope === 'group'
                                                        ? 'bg-white text-indigo-700 shadow-2xs'
                                                        : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                Đơn đoàn
                                            </button>
                                        </div>
                                    </div>

                                    {targetScope === 'group' ? (
                                        selectedGroup ? (
                                            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-xs text-indigo-950 flex flex-wrap items-center gap-1.5">
                                                            <span className="font-mono text-indigo-700">#{selectedGroup.group_code}</span>
                                                            <span className="truncate">{selectedGroup.group_name}</span>
                                                        </div>
                                                        <div className="text-[11px] text-slate-600 mt-0.5">
                                                            Trưởng đoàn: <span className="font-semibold text-slate-800">{selectedGroup.leader_name}</span>
                                                            {' • '}Đã cọc: <span className="font-mono font-bold text-emerald-700">{formatCurrency(selectedGroup.deposit_amount)}</span>
                                                            {Number(selectedGroup.overpaid_amount || 0) > 0 && (
                                                                <> • Dư cọc: <span className="font-mono font-bold text-rose-600">{formatCurrency(selectedGroup.overpaid_amount)}</span></>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedGroup(null)}
                                                        className="shrink-0 text-xs text-slate-500 hover:text-rose-600 font-semibold px-2 py-1 rounded hover:bg-white transition cursor-pointer"
                                                    >
                                                        Đổi đoàn
                                                    </button>
                                                </div>
                                                {selectedGroup.cancel_request?.refund_info && (
                                                    <div className="pt-2 border-t border-indigo-200/70 flex items-center justify-between gap-2 text-[11px]">
                                                        <div className="flex items-center gap-1.5 text-indigo-900 min-w-0">
                                                            <Landmark className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                                            <span className="truncate">
                                                                TK nhận hoàn: <strong className="font-mono">{selectedGroup.cancel_request.refund_info}</strong>
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopyBankValue(selectedGroup.cancel_request.refund_account_number || selectedGroup.cancel_request.refund_info)}
                                                            className="shrink-0 px-2 py-0.5 rounded bg-white border border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-100 transition inline-flex items-center gap-1 cursor-pointer"
                                                        >
                                                            {copiedBankNo ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                                            <span>{copiedBankNo ? 'Đã copy' : 'Copy STK'}</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <input
                                                    type="text"
                                                    value={groupSearch}
                                                    onChange={(e) => setGroupSearch(e.target.value)}
                                                    placeholder="Gõ mã đoàn (GRP-...), tên đoàn, tên hoặc SĐT trưởng đoàn..."
                                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                />
                                                {searchingGroups && (
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 animate-pulse">
                                                        Đang tìm...
                                                    </div>
                                                )}
                                                {groupSearchResults.length > 0 && (
                                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-20 max-h-56 overflow-y-auto divide-y divide-slate-100">
                                                        {groupSearchResults.map((g) => (
                                                            <div
                                                                key={g.id}
                                                                onClick={() => handleSelectGroup(g)}
                                                                className="p-2.5 hover:bg-indigo-50/70 cursor-pointer text-xs flex items-center justify-between gap-2 transition"
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="font-bold text-indigo-700 font-mono">#{g.group_code}</span>
                                                                        <span className="font-semibold text-slate-800 truncate">{g.group_name}</span>
                                                                    </div>
                                                                    <div className="text-[11px] text-slate-500 truncate">
                                                                        {g.leader_name} {g.leader_phone ? `• ${g.leader_phone}` : ''}
                                                                    </div>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <span className="font-mono text-emerald-600 font-bold block">
                                                                        Cọc: {formatCurrency(g.deposit_amount)}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400">
                                                                        {g.status_display || g.status}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {groupSearch.trim() && !searchingGroups && groupSearchResults.length === 0 && (
                                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 z-20 p-3 text-center text-xs text-slate-400">
                                                        Không tìm thấy đơn đoàn nào khớp với "{groupSearch}".
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    ) : selectedBooking ? (
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                                            <div className="flex items-center justify-between gap-2">
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
                                            {selectedBooking.refund_bank_info?.summary && (
                                                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2 text-[11px]">
                                                    <div className="flex items-center gap-1.5 text-indigo-900 min-w-0">
                                                        <Landmark className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                                        <span className="truncate">
                                                            TK nhận hoàn: <strong className="font-mono">{selectedBooking.refund_bank_info.summary}</strong>
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyBankValue(selectedBooking.refund_bank_info.account_number || selectedBooking.refund_bank_info.summary)}
                                                        className="shrink-0 px-2 py-0.5 rounded bg-white border border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-100 transition inline-flex items-center gap-1 cursor-pointer"
                                                    >
                                                        {copiedBankNo ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                                        <span>{copiedBankNo ? 'Đã copy' : 'Copy STK'}</span>
                                                    </button>
                                                </div>
                                            )}
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

                            {/* 3b. Thông tin Ngân hàng & Số tài khoản khi chọn Chuyển khoản */}
                            {paymentMethod === 'TRANSFER' && (
                                <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950">
                                            <Landmark className="w-4 h-4 text-blue-600 shrink-0" />
                                            <span>Thông tin Tài khoản Ngân hàng nhận chuyển khoản</span>
                                        </div>
                                        {recipientAccountNumber.trim() && (
                                            <button
                                                type="button"
                                                onClick={() => handleCopyBankValue(recipientAccountNumber.trim())}
                                                className="px-2 py-0.5 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 font-bold text-[11px] inline-flex items-center gap-1 transition cursor-pointer shrink-0"
                                            >
                                                {copiedBankNo ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                                <span>{copiedBankNo ? 'Đã copy STK' : 'Copy STK'}</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                Ngân hàng <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                list="cashout-vn-banks"
                                                value={recipientBankName}
                                                onChange={(e) => setRecipientBankName(e.target.value)}
                                                placeholder="VD: MB Bank, Vietcombank..."
                                                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                                required
                                            />
                                            <datalist id="cashout-vn-banks">
                                                {POPULAR_VN_BANKS.map((bank) => (
                                                    <option key={bank} value={bank} />
                                                ))}
                                            </datalist>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                Số tài khoản <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={recipientAccountNumber}
                                                onChange={(e) => setRecipientAccountNumber(e.target.value)}
                                                placeholder="Nhập số tài khoản"
                                                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-mono font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                Tên chủ tài khoản
                                            </label>
                                            <input
                                                type="text"
                                                value={recipientAccountHolder}
                                                onChange={(e) => setRecipientAccountHolder(e.target.value)}
                                                placeholder="NGUYEN VAN A"
                                                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

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

