import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowDownCircle,
    Banknote,
    CreditCard,
    Search,
    RefreshCw,
    Printer,
    Eye,
    X,
    Building2,
    Coins,
    Calendar,
    RotateCcw,
    PlusCircle,
    Landmark
} from 'lucide-react';
import { paymentService } from '../../../services/paymentService';
import Pagination from '../../common/Pagination';

const formatVND = (val) => `${(Number(val) || 0).toLocaleString('vi-VN')} đ`;

const formatDateTime = (isoStr) => {
    if (!isoStr) return '—';
    try {
        const d = new Date(isoStr);
        return d.toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return isoStr;
    }
};

const getVoucherTypeBadge = (type) => {
    if (type === 'REFUND_CANCEL') {
        return {
            label: 'Hoàn cọc hủy đơn',
            className: 'bg-rose-50 text-rose-700 border-rose-200'
        };
    }
    if (type === 'REFUND_DEPOSIT') {
        return {
            label: 'Hoàn cọc / Tiền thừa',
            className: 'bg-amber-50 text-amber-800 border-amber-200'
        };
    }
    return {
        label: 'Chi vặt nội bộ',
        className: 'bg-slate-100 text-slate-700 border-slate-200'
    };
};

export default function CashOutVoucherList({
    refreshKey = 0,
    canCashOut = false,
    onOpenCreateCashOut = null
}) {
    const [vouchers, setVouchers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Bộ lọc & Tìm kiếm
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [methodFilter, setMethodFilter] = useState('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Phân trang server-side
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // Thống kê tổng hợp từ server
    const [summary, setSummary] = useState({
        total_amount: 0,
        refund_cancel_total: 0,
        refund_deposit_total: 0,
        petty_cash_total: 0,
        cash_total: 0,
        transfer_total: 0,
        refund_count: 0
    });

    // Modal xem & in lại phiếu chi
    const [selectedVoucher, setSelectedVoucher] = useState(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput.trim());
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const fetchVouchers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = {
                page: currentPage,
                page_size: pageSize
            };
            if (typeFilter !== 'ALL') params.voucher_type = typeFilter;
            if (methodFilter !== 'ALL') params.payment_method = methodFilter;
            if (debouncedSearch) params.search = debouncedSearch;
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;

            const res = await paymentService.getCashOuts(params);
            const list = res?.results || res?.data || res?.vouchers || [];
            setVouchers(Array.isArray(list) ? list : []);
            setTotalCount(Number(res?.count ?? list.length ?? 0));
            setTotalPages(Math.max(1, Number(res?.total_pages ?? Math.ceil((res?.count || list.length || 1) / pageSize))));
            if (res?.summary) {
                setSummary(res.summary);
            }
        } catch (err) {
            console.error('Lỗi tải danh sách phiếu chi:', err);
            setError(err.response?.data?.message || 'Không thể tải danh sách phiếu chi hoàn tiền.');
            setVouchers([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, pageSize, typeFilter, methodFilter, debouncedSearch, dateFrom, dateTo]);

    useEffect(() => {
        fetchVouchers();
    }, [fetchVouchers, refreshKey]);

    const handleResetFilters = () => {
        setSearchInput('');
        setDebouncedSearch('');
        setTypeFilter('ALL');
        setMethodFilter('ALL');
        setDateFrom('');
        setDateTo('');
        setCurrentPage(1);
    };

    const handlePrintVoucher = (voucher) => {
        if (!voucher) return;
        const badge = getVoucherTypeBadge(voucher.voucher_type);
        const refLine = voucher.group_booking_code
            ? `<div class="row"><span>Đơn đặt đoàn:</span><strong>#${voucher.group_booking_code}</strong></div>`
            : voucher.booking_code
                ? `<div class="row"><span>Đơn đặt phòng:</span><strong>#${voucher.booking_code}${voucher.room_number ? ` (P.${voucher.room_number})` : ''}</strong></div>`
                : '';
        const bankRows = [
            voucher.recipient_bank_name
                ? `<div class="row"><span>Ngân hàng nhận:</span><strong>${voucher.recipient_bank_name}</strong></div>`
                : '',
            voucher.recipient_account_number
                ? `<div class="row"><span>Số tài khoản nhận:</span><strong style="font-family:monospace;">${voucher.recipient_account_number}</strong></div>`
                : '',
            voucher.recipient_account_holder
                ? `<div class="row"><span>Chủ tài khoản:</span><strong>${voucher.recipient_account_holder}</strong></div>`
                : ''
        ].join('');

        let iframe = document.getElementById('cash-out-reprint-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'cash-out-reprint-iframe';
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);
        }

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8" />
                <title>Phiếu Chi - #${voucher.voucher_code}</title>
                <style>
                    @page { size: A4 portrait; margin: 14mm 16mm; }
                    body { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; color: #0f172a; margin: 0; padding: 8px; }
                    .box { border: 1px solid #cbd5e1; border-radius: 14px; padding: 24px; max-width: 640px; margin: 0 auto; }
                    .header { text-align: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 14px; margin-bottom: 16px; }
                    .header h2 { margin: 0; font-size: 18px; letter-spacing: 0.04em; }
                    .code { font-family: monospace; font-size: 13px; color: #475569; margin-top: 4px; font-weight: 700; }
                    .meta { font-size: 12px; color: #64748b; margin-top: 6px; }
                    .row { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
                    .row span { color: #64748b; }
                    .row strong { text-align: right; color: #0f172a; }
                    .total { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding: 12px 14px; border: 1px solid #fecdd3; background: #fff1f2; border-radius: 10px; }
                    .total .label { font-weight: 700; font-size: 14px; }
                    .total .val { font-family: monospace; font-size: 18px; font-weight: 900; color: #e11d48; }
                    .sigs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center; margin-top: 32px; font-size: 12px; }
                    .sigs .sub { font-size: 10px; color: #94a3b8; font-style: italic; margin-top: 2px; }
                    .sigs .name { margin-top: 48px; font-weight: 700; }
                </style>
            </head>
            <body>
                <div class="box">
                    <div class="header">
                        <h2>PHIẾU CHI TIỀN &amp; HOÀN CỌC</h2>
                        <div class="code">#${voucher.voucher_code}</div>
                        <div class="meta">Loại phiếu: <b>${voucher.voucher_type_display || badge.label}</b> • Hình thức: <b>${voucher.payment_method_display || voucher.payment_method}</b></div>
                        <div class="meta">Thời gian lập: ${formatDateTime(voucher.created_at)}</div>
                    </div>
                    <div class="row"><span>Người nhận tiền:</span><strong>${voucher.recipient_name || '—'}${voucher.recipient_phone ? ` (${voucher.recipient_phone})` : ''}</strong></div>
                    ${bankRows}
                    ${refLine}
                    ${voucher.shift_code ? `<div class="row"><span>Ca trực quầy:</span><strong>#${voucher.shift_code}</strong></div>` : ''}
                    <div class="row"><span>Lý do chi tiền:</span><strong>${voucher.reason || '—'}</strong></div>
                    <div class="total">
                        <span class="label">Tổng số tiền chi:</span>
                        <span class="val">-${formatVND(voucher.amount)}</span>
                    </div>
                    <div class="sigs">
                        <div><div><b>NGƯỜI NHẬN TIỀN</b></div><div class="sub">(Ký, họ tên)</div><div class="name">${voucher.recipient_name || ''}</div></div>
                        <div><div><b>NGƯỜI LẬP PHIẾU</b></div><div class="sub">(Ký, họ tên)</div><div class="name">${voucher.user_name || ''}</div></div>
                        <div><div><b>NGƯỜI PHÊ DUYỆT</b></div><div class="sub">(Ký duyệt)</div><div class="name">${voucher.approved_by || 'Quản lý'}</div></div>
                    </div>
                </div>
            </body>
            </html>
        `);
        doc.close();
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }, 250);
    };

    const totalRefundsAmount = (summary.refund_cancel_total || 0) + (summary.refund_deposit_total || 0);
    const hasActiveFilters = Boolean(debouncedSearch || typeFilter !== 'ALL' || methodFilter !== 'ALL' || dateFrom || dateTo);

    return (
        <div className="space-y-4">
            {/* 1. THẺ THỐNG KÊ TỔNG QUAN PHIẾU CHI & HOÀN CỌC */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                    onClick={() => { setTypeFilter('ALL'); setCurrentPage(1); }}
                    className={`bg-white p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer shadow-xs ${
                        typeFilter === 'ALL'
                            ? 'border-rose-400 ring-2 ring-rose-500/15'
                            : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                        <span>Tổng chi &amp; hoàn tiền</span>
                        <ArrowDownCircle className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="text-lg sm:text-xl font-black text-rose-600 font-mono tabular-nums mt-1">
                        -{formatVND(summary.total_amount)}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                        Tổng cộng <strong className="text-slate-600">{totalCount}</strong> phiếu chi theo bộ lọc
                    </div>
                </div>

                <div
                    onClick={() => {
                        setTypeFilter(typeFilter === 'REFUND_CANCEL' ? 'REFUND_DEPOSIT' : 'REFUND_CANCEL');
                        setCurrentPage(1);
                    }}
                    className={`bg-white p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer shadow-xs ${
                        typeFilter === 'REFUND_CANCEL' || typeFilter === 'REFUND_DEPOSIT'
                            ? 'border-amber-400 ring-2 ring-amber-500/15'
                            : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                        <span>Hoàn cọc hủy &amp; tiền thừa</span>
                        <Coins className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-lg sm:text-xl font-black text-amber-700 font-mono tabular-nums mt-1">
                        -{formatVND(totalRefundsAmount)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                        <span>Hủy đơn: <strong>{formatVND(summary.refund_cancel_total)}</strong></span>
                        <span>•</span>
                        <span>Hoàn dư: <strong>{formatVND(summary.refund_deposit_total)}</strong></span>
                    </div>
                </div>

                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                        <span>Phân bổ nguồn chi</span>
                        <Banknote className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="mt-1.5 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600 flex items-center gap-1">
                                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                                <span>Chuyển khoản NH:</span>
                            </span>
                            <strong className="font-mono text-blue-700 tabular-nums">{formatVND(summary.transfer_total)}</strong>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600 flex items-center gap-1">
                                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Tiền mặt từ két:</span>
                            </span>
                            <strong className="font-mono text-slate-800 tabular-nums">{formatVND(summary.cash_total)}</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. THANH TÌM KIẾM & BỘ LỌC */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
                    <div className="relative flex-1 min-w-0">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Tìm mã phiếu (PC-...), mã đơn phòng, mã đoàn (GRP-...), tên/SĐT người nhận..."
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={typeFilter}
                            onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-rose-400 cursor-pointer"
                        >
                            <option value="ALL">Tất cả loại phiếu</option>
                            <option value="REFUND_CANCEL">Hoàn cọc hủy đơn</option>
                            <option value="REFUND_DEPOSIT">Hoàn cọc / Tiền thừa</option>
                            <option value="PETTY_CASH">Chi vặt nội bộ quầy</option>
                        </select>

                        <select
                            value={methodFilter}
                            onChange={(e) => { setMethodFilter(e.target.value); setCurrentPage(1); }}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-rose-400 cursor-pointer"
                        >
                            <option value="ALL">Mọi hình thức</option>
                            <option value="TRANSFER">Chuyển khoản NH</option>
                            <option value="CASH">Tiền mặt (Két quầy)</option>
                        </select>

                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                                className="bg-transparent text-xs text-slate-700 focus:outline-none w-28"
                                title="Từ ngày"
                            />
                            <span className="text-slate-300">→</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                                className="bg-transparent text-xs text-slate-700 focus:outline-none w-28"
                                title="Đến ngày"
                            />
                        </div>

                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Xóa lọc</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={fetchVouchers}
                            disabled={isLoading}
                            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                            title="Làm mới danh sách"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Làm mới</span>
                        </button>

                        {canCashOut && onOpenCreateCashOut && (
                            <button
                                type="button"
                                onClick={onOpenCreateCashOut}
                                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition active:scale-95"
                            >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>Lập phiếu chi</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. BẢNG DANH SÁCH PHIẾU CHI */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                {error ? (
                    <div className="p-8 text-center text-xs text-rose-600 font-semibold">{error}</div>
                ) : isLoading ? (
                    <div className="p-10 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
                        <span>Đang tải danh sách phiếu chi hoàn tiền...</span>
                    </div>
                ) : vouchers.length === 0 ? (
                    <div className="p-10 text-center space-y-2">
                        <ArrowDownCircle className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-sm font-bold text-slate-700">Chưa có phiếu chi nào</p>
                        <p className="text-xs text-slate-400">
                            {hasActiveFilters
                                ? 'Không tìm thấy phiếu chi nào phù hợp với bộ lọc hiện tại.'
                                : 'Các phiếu chi hoàn cọc hủy đơn, hoàn tiền thừa hoặc chi vặt quầy sẽ hiển thị tại đây.'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse pms-table">
                                <thead>
                                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 uppercase font-bold text-[11px]">
                                        <th className="px-4 py-3">Mã phiếu &amp; Thời gian</th>
                                        <th className="px-4 py-3">Loại phiếu</th>
                                        <th className="px-4 py-3">Đơn liên kết</th>
                                        <th className="px-4 py-3">Người nhận &amp; Lý do</th>
                                        <th className="px-4 py-3">Hình thức</th>
                                        <th className="px-4 py-3 text-right">Số tiền chi</th>
                                        <th className="px-4 py-3">Người lập / Duyệt</th>
                                        <th className="px-4 py-3 text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {vouchers.map((v) => {
                                        const badge = getVoucherTypeBadge(v.voucher_type);
                                        return (
                                            <tr key={v.id} className="hover:bg-slate-50/70 transition">
                                                <td className="px-4 py-3 align-top whitespace-nowrap">
                                                    <div className="font-mono font-bold text-slate-900">#{v.voucher_code}</div>
                                                    <div className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(v.created_at)}</div>
                                                </td>
                                                <td className="px-4 py-3 align-top whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold border ${badge.className}`}>
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 align-top whitespace-nowrap">
                                                    {v.group_booking_code ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono text-[11px] font-bold">
                                                            <Building2 className="w-3 h-3" />
                                                            #{v.group_booking_code}
                                                        </span>
                                                    ) : v.booking_code ? (
                                                        <div>
                                                            <span className="font-mono font-bold text-slate-800">#{v.booking_code}</span>
                                                            {v.room_number && (
                                                                <span className="text-[11px] text-slate-400 ml-1">(P.{v.room_number})</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 align-top max-w-xs">
                                                    <div className="font-bold text-slate-800">
                                                        {v.recipient_name}
                                                        {v.recipient_phone && (
                                                            <span className="text-slate-400 font-normal ml-1">({v.recipient_phone})</span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2" title={v.reason}>
                                                        {v.reason}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 align-top whitespace-nowrap">
                                                    {v.payment_method === 'TRANSFER' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                                                            <CreditCard className="w-3 h-3" />
                                                            Chuyển khoản
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                                                            <Banknote className="w-3 h-3" />
                                                            Tiền mặt
                                                        </span>
                                                    )}
                                                    {(v.recipient_bank_name || v.recipient_account_number) && (
                                                        <div className="text-[10.5px] text-indigo-700 font-semibold mt-1 flex items-center gap-1" title={v.recipient_bank_summary || ''}>
                                                            <Landmark className="w-3 h-3 shrink-0" />
                                                            <span className="font-mono">
                                                                {[v.recipient_bank_name, v.recipient_account_number].filter(Boolean).join(' • ')}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {v.shift_code && (
                                                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">Ca #{v.shift_code}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                                                    <span className="font-mono font-black text-rose-600 text-sm tabular-nums">
                                                        -{formatVND(v.amount)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 align-top whitespace-nowrap">
                                                    <div className="text-slate-800 font-semibold">{v.user_name || '—'}</div>
                                                    {v.approved_by && (
                                                        <div className="text-[10.5px] text-slate-400">Duyệt: {v.approved_by}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedVoucher(v)}
                                                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition"
                                                            title="Xem chi tiết phiếu chi"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            <span>Xem</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePrintVoucher(v)}
                                                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition"
                                                            title="In lại phiếu chi"
                                                        >
                                                            <Printer className="w-3.5 h-3.5" />
                                                            <span>In</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {vouchers.map((v) => {
                                const badge = getVoucherTypeBadge(v.voucher_type);
                                return (
                                    <div key={v.id} className="p-3.5 space-y-2 text-xs">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="font-mono font-bold text-slate-900">#{v.voucher_code}</div>
                                                <div className="text-[11px] text-slate-400">{formatDateTime(v.created_at)}</div>
                                            </div>
                                            <span className="font-mono font-black text-rose-600 text-sm whitespace-nowrap shrink-0 tabular-nums">
                                                -{formatVND(v.amount)}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold border ${badge.className}`}>
                                                {badge.label}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold border ${
                                                v.payment_method === 'TRANSFER'
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            }`}>
                                                {v.payment_method === 'TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt'}
                                            </span>
                                            {v.group_booking_code && (
                                                <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono text-[10.5px] font-bold">
                                                    #{v.group_booking_code}
                                                </span>
                                            )}
                                            {!v.group_booking_code && v.booking_code && (
                                                <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-mono text-[10.5px] font-bold">
                                                    #{v.booking_code}
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-slate-700">
                                            <strong className="text-slate-900">{v.recipient_name}</strong>
                                            {v.recipient_phone && <span className="text-slate-400"> ({v.recipient_phone})</span>}
                                            {(v.recipient_bank_name || v.recipient_account_number) && (
                                                <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/80 text-[11px] text-indigo-800 font-semibold">
                                                    <Landmark className="w-3 h-3 text-blue-600 shrink-0" />
                                                    <span className="font-mono">
                                                        {[v.recipient_bank_name, v.recipient_account_number, v.recipient_account_holder].filter(Boolean).join(' - ')}
                                                    </span>
                                                </div>
                                            )}
                                            <p className="text-[11px] text-slate-500 mt-0.5 break-words">{v.reason}</p>
                                        </div>

                                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                                            <span className="text-[11px] text-slate-400">Lập bởi: <strong className="text-slate-600">{v.user_name || '—'}</strong></span>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedVoucher(v)}
                                                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px] cursor-pointer"
                                                >
                                                    Chi tiết
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePrintVoucher(v)}
                                                    className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Printer className="w-3 h-3" />
                                                    <span>In</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* PHÂN TRANG */}
                        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalCount={totalCount}
                                pageSize={pageSize}
                                onPageChange={(p) => setCurrentPage(p)}
                                onPageSizeChange={(size) => {
                                    setPageSize(size);
                                    setCurrentPage(1);
                                }}
                                pageSizeOptions={[10, 20, 50]}
                            />
                        </div>
                    </>
                )}
            </div>

            {/* 4. MODAL XEM CHI TIẾT & IN LẠI PHIẾU CHI */}
            {selectedVoucher && (
                <div
                    className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
                    onClick={(e) => { if (e.target === e.currentTarget) setSelectedVoucher(null); }}
                >
                    <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90dvh] flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
                            <div className="min-w-0">
                                <h3 className="text-base font-bold text-slate-900 truncate">
                                    Chi Tiết Phiếu Chi #{selectedVoucher.voucher_code}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(selectedVoucher.created_at)}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedVoucher(null)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-3 text-xs">
                            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 flex items-center justify-between gap-2">
                                <span className="font-bold text-rose-900">Số tiền đã chi / hoàn:</span>
                                <strong className="font-mono font-black text-rose-600 text-lg tabular-nums whitespace-nowrap">
                                    -{formatVND(selectedVoucher.amount)}
                                </strong>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500 shrink-0">Loại phiếu:</span>
                                    <strong className="text-slate-900 text-right">{selectedVoucher.voucher_type_display || getVoucherTypeBadge(selectedVoucher.voucher_type).label}</strong>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500 shrink-0">Hình thức chi:</span>
                                    <strong className="text-slate-900 text-right">{selectedVoucher.payment_method_display || selectedVoucher.payment_method}</strong>
                                </div>
                                {selectedVoucher.group_booking_code && (
                                    <div className="flex justify-between gap-3">
                                        <span className="text-slate-500 shrink-0">Đơn đặt đoàn:</span>
                                        <strong className="font-mono text-indigo-700 text-right">#{selectedVoucher.group_booking_code}</strong>
                                    </div>
                                )}
                                {selectedVoucher.booking_code && (
                                    <div className="flex justify-between gap-3">
                                        <span className="text-slate-500 shrink-0">Đơn đặt phòng:</span>
                                        <strong className="font-mono text-slate-900 text-right">
                                            #{selectedVoucher.booking_code}{selectedVoucher.room_number ? ` (P.${selectedVoucher.room_number})` : ''}
                                        </strong>
                                    </div>
                                )}
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500 shrink-0">Người nhận tiền:</span>
                                    <strong className="text-slate-900 text-right break-words">
                                        {selectedVoucher.recipient_name}{selectedVoucher.recipient_phone ? ` (${selectedVoucher.recipient_phone})` : ''}
                                    </strong>
                                </div>
                                {(selectedVoucher.recipient_bank_name || selectedVoucher.recipient_account_number) && (
                                    <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/80 space-y-1">
                                        <div className="text-[10.5px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                                            <Landmark className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                            <span>Tài khoản nhận chuyển khoản</span>
                                        </div>
                                        {selectedVoucher.recipient_bank_name && (
                                            <div className="flex justify-between gap-3">
                                                <span className="text-slate-500">Ngân hàng:</span>
                                                <strong className="text-slate-900 text-right">{selectedVoucher.recipient_bank_name}</strong>
                                            </div>
                                        )}
                                        {selectedVoucher.recipient_account_number && (
                                            <div className="flex justify-between gap-3">
                                                <span className="text-slate-500">Số tài khoản:</span>
                                                <strong className="font-mono text-indigo-800 text-right">{selectedVoucher.recipient_account_number}</strong>
                                            </div>
                                        )}
                                        {selectedVoucher.recipient_account_holder && (
                                            <div className="flex justify-between gap-3">
                                                <span className="text-slate-500">Chủ tài khoản:</span>
                                                <strong className="text-slate-900 uppercase text-right">{selectedVoucher.recipient_account_holder}</strong>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {selectedVoucher.shift_code && (
                                    <div className="flex justify-between gap-3">
                                        <span className="text-slate-500 shrink-0">Ca trực:</span>
                                        <strong className="font-mono text-slate-800">#{selectedVoucher.shift_code}</strong>
                                    </div>
                                )}
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500 shrink-0">Người lập / Duyệt:</span>
                                    <strong className="text-slate-800 text-right">
                                        {selectedVoucher.user_name || '—'} / {selectedVoucher.approved_by || 'Quản lý'}
                                    </strong>
                                </div>
                                <div className="pt-2 border-t border-slate-200">
                                    <span className="text-slate-500 block mb-1">Lý do chi:</span>
                                    <p className="text-slate-800 font-medium leading-relaxed break-words">{selectedVoucher.reason}</p>
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => setSelectedVoucher(null)}
                                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePrintVoucher(selectedVoucher)}
                                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm cursor-pointer transition"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span>In Phiếu Chi</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

