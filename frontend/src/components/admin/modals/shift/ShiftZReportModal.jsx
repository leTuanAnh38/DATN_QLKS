import React, { useState, useEffect, useRef } from 'react';
import {
    Printer,
    X,
    FileText,
    AlertCircle,
    Banknote,
    Coins,
    ShieldCheck,
    ArrowDownCircle,
    CreditCard,
    Loader2
} from 'lucide-react';
import api from '../../../../services/api';
import paymentService from '../../../../services/paymentService';

/**
 * Modal & Phiếu In Báo Cáo Kết Ca Bàn Giao Quỹ (Z-Report)
 * Tương thích in ấn chuẩn khổ giấy A4 hoặc máy in hóa đơn nhiệt A5/80mm
 */
export default function ShiftZReportModal({ shiftId, shiftData, onClose }) {
    const [report, setReport] = useState(shiftData || null);
    const [loading, setLoading] = useState(!shiftData);
    const [error, setError] = useState(null);

    // Thông tin khách sạn
    const [hotelInfo, setHotelInfo] = useState({
        hotel_name: 'Khách Sạn TA Đà Nẵng',
        hotel_slogan: 'Khách Sạn & Khu Nghỉ Dưỡng',
        address: '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Quận Ngũ Hành Sơn, TP. Đà Nẵng',
        hotline: '1900 8899',
        email: 'contact@tahotel.vn',
        tax_code: '0401234567'
    });

    const reportRef = useRef(null);

    // Format tiền tệ VNĐ
    const formatCurrency = (val) => {
        const num = Number(val) || 0;
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
    };

    // Format thời gian
    const formatDateTime = (iso) => {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' +
            d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Tải thông tin cài đặt khách sạn và dữ liệu Report
    useEffect(() => {
        let isMounted = true;

        api.get('/hotel-settings/')
            .then(res => {
                const data = res.data?.data || res.data;
                if (data && isMounted) {
                    setHotelInfo(prev => ({
                        ...prev,
                        hotel_name: data.hotel_name || prev.hotel_name,
                        hotel_slogan: data.hotel_slogan || prev.hotel_slogan,
                        address: data.address || prev.address,
                        hotline: data.hotline || prev.hotline,
                        email: data.email || prev.email,
                        tax_code: data.tax_code || prev.tax_code,
                    }));
                }
            })
            .catch(() => {});

        if (shiftId) {
            setLoading(true);
            paymentService.getShiftReport(shiftId)
                .then(res => {
                    const data = res?.report || res?.data || res?.shift || res;
                    if (isMounted && data) {
                        setReport(data);
                        if (data.hotel) {
                            setHotelInfo(prev => ({
                                ...prev,
                                hotel_name: data.hotel.name || prev.hotel_name,
                                address: data.hotel.address || prev.address,
                                hotline: data.hotel.hotline || prev.hotline,
                            }));
                        }
                    }
                })
                .catch(err => {
                    console.error('Lỗi khi tải Z-Report:', err);
                    if (isMounted) setError('Không thể tải dữ liệu báo cáo Z-Report.');
                })
                .finally(() => {
                    if (isMounted) setLoading(false);
                });
        }

        return () => { isMounted = false; };
    }, [shiftId]);

    // Lệnh In chuyên dụng dùng iframe ẩn để tránh lỗi render trang trắng trên Chromium/Edge
    const handlePrint = () => {
        const reportElement = document.getElementById('z-report-printable');
        if (!reportElement) {
            window.print();
            return;
        }

        // Tạo hoặc tái sử dụng iframe ẩn chuyên dụng cho việc in
        let iframe = document.getElementById('z-report-print-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'z-report-print-iframe';
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

        // Thu thập toàn bộ style và font của ứng dụng
        const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
            .map(el => el.outerHTML)
            .join('\n');

        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="utf-8" />
                <title>Báo Cáo Kết Ca (Z-Report) - #${shift?.shift_code || shiftId}</title>
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
                    #z-report-printable {
                        padding: 0 !important;
                        margin: 0 auto !important;
                        max-width: 100% !important;
                        overflow: visible !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    table {
                        border-collapse: collapse !important;
                        width: 100% !important;
                    }
                    tr {
                        page-break-inside: avoid !important;
                    }
                </style>
            </head>
            <body class="bg-white p-2">
                <div id="z-report-printable">
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

    // Bắt phím tắt Ctrl+P hoặc Cmd+P để in trực tiếp phiếu Z-Report khi modal đang mở
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                handlePrint();
            }
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [shiftId, report, shiftData]);

    if (!shiftId && !shiftData) return null;

    const rawShift = report?.shift || (report?.shift_code ? report : null) || shiftData || {};
    const summary = report?.summary || rawShift?.realtime_summary || rawShift?.summary || {};

    const shift = {
        ...rawShift,
        shift_code: rawShift.shift_code || shiftId,
        opening_cash: rawShift.opening_cash ?? summary.opening_cash ?? 0,
        total_cash_in: rawShift.total_cash_in && Number(rawShift.total_cash_in) > 0 ? rawShift.total_cash_in : (summary.cash_in ?? summary.total_cash_in ?? 0),
        total_transfer_in: rawShift.total_transfer_in && Number(rawShift.total_transfer_in) > 0 ? rawShift.total_transfer_in : (summary.transfer_in ?? summary.total_transfer_in ?? 0),
        total_card_in: rawShift.total_card_in && Number(rawShift.total_card_in) > 0 ? rawShift.total_card_in : (summary.card_in ?? summary.total_card_in ?? 0),
        total_cash_out: rawShift.total_cash_out ?? summary.cash_out ?? 0,
        expected_cash: rawShift.expected_cash ?? summary.expected_cash ?? (Number(rawShift.opening_cash || 0) + Number(summary.cash_in || 0)),
        actual_cash: rawShift.actual_cash != null ? rawShift.actual_cash : (summary.expected_cash ?? rawShift.opening_cash),
        difference: rawShift.difference ?? 0,
        total_revenue: rawShift.total_revenue ?? summary.total_revenue ?? (Number(rawShift.total_cash_in || summary.cash_in || 0) + Number(rawShift.total_transfer_in || summary.transfer_in || 0) + Number(rawShift.total_card_in || summary.card_in || 0)),
    };

    return (
        <div className="z-report-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 print:p-0 print:bg-white print:static">
            {/* CSS chuyên dụng cho lệnh in window.print() (khi gọi trực tiếp) */}
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
                    .z-report-modal-backdrop,
                    .z-report-modal-card,
                    #z-report-printable,
                    #z-report-printable * {
                        visibility: visible !important;
                    }
                    .z-report-modal-backdrop {
                        position: static !important;
                        background: transparent !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                        display: block !important;
                    }
                    .z-report-modal-card {
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
                    #z-report-printable {
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

            <div className="z-report-modal-card relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 text-left print:max-h-none print:shadow-none print:border-none print:rounded-none">
                {/* 1. HEADER (Fixed Non-Scrolling, Ẩn khi in) */}
                <div className="no-print shrink-0 flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs shrink-0">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                                Báo Cáo Kết Ca (Z-Report)
                            </h3>
                            <p className="text-xs text-slate-500">Mã ca: #{shift?.shift_code || shiftId}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
                        >
                            <Printer className="w-4 h-4 shrink-0" />
                            <span>In Phiếu <span className="hidden sm:inline">(Ctrl+P)</span></span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer shrink-0"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* 2. BODY (Scrollable, In ấn) */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 print:overflow-visible print:p-0" id="z-report-printable" ref={reportRef}>
                    {loading ? (
                        <div className="py-20 text-center">
                            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
                            <p className="text-sm text-slate-500">Đang chuẩn bị dữ liệu Z-Report...</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            <span>{error}</span>
                        </div>
                    ) : shift ? (
                        <div className="space-y-6 font-sans text-slate-800">
                            {/* Tiêu đề & Thông tin Khách sạn */}
                            <div className="text-center pb-4 border-b-2 border-slate-800">
                                <h2 className="text-lg font-black uppercase tracking-wider text-slate-900">
                                    {hotelInfo.hotel_name}
                                </h2>
                                <p className="text-xs text-slate-600 mt-0.5">{hotelInfo.address}</p>
                                <p className="text-xs text-slate-500">
                                    Hotline: {hotelInfo.hotline} • MST: {hotelInfo.tax_code}
                                </p>

                                <div className="mt-4 pt-3 border-t border-dashed border-slate-300">
                                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                                        PHIẾU KẾT CA & BÀN GIAO QUỸ TIỀN MẶT
                                    </h1>
                                    <div className="inline-block mt-1 text-xs font-mono font-bold px-3 py-0.5 bg-slate-100 rounded-md border border-slate-300">
                                        Z-REPORT: #{shift.shift_code}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-1">
                                        Loại ca: <span className="font-bold text-slate-800">{shift.shift_type_display || shift.shift_type}</span> • Trạng thái: <span className="font-bold text-emerald-700">{shift.status === 'CLOSED' ? 'ĐÃ KẾT CA' : 'ĐANG MỞ'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Thông tin ca trực */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200">
                                <div>
                                    <div className="text-slate-500">Thu ngân trực ca:</div>
                                    <div className="font-bold text-slate-900 text-sm mt-0.5">
                                        {shift.user_name || 'Thu ngân'}
                                    </div>
                                    <div className="text-slate-500 mt-2">Giờ mở ca:</div>
                                    <div className="font-semibold text-slate-800 mt-0.5">
                                        {formatDateTime(shift.opened_at)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-slate-500">Nhân viên nhận bàn giao:</div>
                                    <div className="font-bold text-slate-900 text-sm mt-0.5">
                                        {shift.handover_user_name || 'Chưa bàn giao'}
                                    </div>
                                    <div className="text-slate-500 mt-2">Giờ đóng ca:</div>
                                    <div className="font-semibold text-slate-800 mt-0.5">
                                        {shift.closed_at ? formatDateTime(shift.closed_at) : 'Chưa đóng ca'}
                                    </div>
                                </div>
                            </div>

                            {/* BẢNG 1: CÂN ĐỐI DÒNG TIỀN MẶT */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Banknote className="w-4 h-4 text-emerald-600" />
                                    <span>I. Cân Đối Quỹ Tiền Mặt Trong Két</span>
                                </h3>
                                <div className="border border-slate-300 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs">
                                        <tbody className="divide-y divide-slate-200">
                                            <tr className="bg-slate-50">
                                                <td className="py-2 px-3 font-semibold text-slate-600">1. Tiền mặt bàn giao đầu ca (Float):</td>
                                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                                    {formatCurrency(shift.opening_cash)}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 px-3 font-semibold text-emerald-700">(+) 2. Tiền mặt thu vào trong ca:</td>
                                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                                                    +{formatCurrency(shift.total_cash_in)}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 px-3 font-semibold text-rose-700">(-) 3. Tiền mặt chi ra / Hoàn cọc trong ca:</td>
                                                <td className="py-2 px-3 text-right font-mono font-bold text-rose-700">
                                                    -{formatCurrency(shift.total_cash_out || 0)}
                                                </td>
                                            </tr>
                                            <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                                                <td className="py-2.5 px-3 text-slate-900">(=) 4. Tiền mặt lý thuyết trong két (1 + 2 - 3):</td>
                                                <td className="py-2.5 px-3 text-right font-mono text-sm text-slate-900">
                                                    {formatCurrency(shift.expected_cash)}
                                                </td>
                                            </tr>
                                            <tr className="bg-amber-50/50 font-bold">
                                                <td className="py-2.5 px-3 text-slate-900">(=) 5. Tiền mặt thực tế kiểm đếm bàn giao:</td>
                                                <td className="py-2.5 px-3 text-right font-mono text-sm text-amber-900">
                                                    {formatCurrency(shift.actual_cash ?? shift.expected_cash)}
                                                </td>
                                            </tr>
                                            <tr className={`font-bold ${Number(shift.difference) === 0 ? 'bg-emerald-50 text-emerald-800' : Number(shift.difference) > 0 ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-800'}`}>
                                                <td className="py-2.5 px-3">
                                                    (±) 6. Chênh lệch kiểm quỹ két:
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-mono text-sm">
                                                    {Number(shift.difference) === 0
                                                        ? '0 đ (Khớp 100%)'
                                                        : (Number(shift.difference) > 0 ? `+${formatCurrency(shift.difference)} (Thừa)` : `${formatCurrency(shift.difference)} (Thiếu)`)
                                                    }
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* BẢNG CHI TIẾT CÁC PHIẾU CHI TIỀN MẶT TRONG CA */}
                            {Array.isArray(report?.cash_outs) && report.cash_outs.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <ArrowDownCircle className="w-4 h-4 text-rose-600" />
                                        <span>Bảng Kê Chi Tiết Phiếu Chi & Hoàn Cọc Trong Ca</span>
                                    </h3>
                                    <div className="border border-slate-300 rounded-xl overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-100 font-semibold text-slate-600 border-b border-slate-200">
                                                <tr>
                                                    <th className="py-1.5 px-3 text-left">Mã Phiếu</th>
                                                    <th className="py-1.5 px-3 text-left">Mục Đích / Lý Do</th>
                                                    <th className="py-1.5 px-3 text-left">Người Nhận</th>
                                                    <th className="py-1.5 px-3 text-center">Hình Thức</th>
                                                    <th className="py-1.5 px-3 text-right">Số Tiền</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {report.cash_outs.map((v) => (
                                                    <tr key={v.id}>
                                                        <td className="py-1.5 px-3 font-mono font-bold text-slate-800">
                                                            #{v.voucher_code}
                                                        </td>
                                                        <td className="py-1.5 px-3 text-slate-700">
                                                            <div className="font-semibold">{v.voucher_type_display}</div>
                                                            <div className="text-[10px] text-slate-400">{v.reason}</div>
                                                        </td>
                                                        <td className="py-1.5 px-3 text-slate-700 font-medium">
                                                            {v.recipient_name}
                                                        </td>
                                                        <td className="py-1.5 px-3 text-center whitespace-nowrap">
                                                            {v.payment_method === 'TRANSFER' ? (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                                    <CreditCard className="w-3 h-3 text-blue-600" />
                                                                    <span>Chuyển khoản (TK KS)</span>
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    <Banknote className="w-3 h-3 text-emerald-600" />
                                                                    <span>Tiền mặt (Két quầy)</span>
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-1.5 px-3 text-right font-mono font-bold text-rose-600">
                                                            -{formatCurrency(v.amount)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* BẢNG 2: CHI TIẾT MỆNH GIÁ NẾU CÓ */}
                            {Array.isArray(shift.denominations) && shift.denominations.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Coins className="w-4 h-4 text-amber-600" />
                                        <span>II. Bảng Kê Chi Tiết Mệnh Giá Tiền Kiểm Đếm</span>
                                    </h3>
                                    <div className="border border-slate-300 rounded-xl overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-100 font-semibold text-slate-600 border-b border-slate-200">
                                                <tr>
                                                    <th className="py-1.5 px-3 text-left">Mệnh giá</th>
                                                    <th className="py-1.5 px-3 text-center">Số tờ</th>
                                                    <th className="py-1.5 px-3 text-right">Thành tiền</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {shift.denominations.map((d, idx) => (
                                                    <tr key={idx}>
                                                        <td className="py-1.5 px-3 font-medium text-slate-800">
                                                            {Number(d.denomination).toLocaleString('vi-VN')} đ
                                                        </td>
                                                        <td className="py-1.5 px-3 text-center font-bold text-slate-700">
                                                            {d.count}
                                                        </td>
                                                        <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-800">
                                                            {formatCurrency(d.total)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* BẢNG 3: DOANH THU THEO PHƯƠNG THỨC */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                                    <span>III. Tổng Kết Doanh Thu Theo Phương Thức Thanh Toán</span>
                                </h3>
                                <div className="border border-slate-300 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs">
                                        <tbody className="divide-y divide-slate-200">
                                            <tr>
                                                <td className="py-2 px-3 font-semibold text-slate-700">Tiền mặt tại quầy (Cash):</td>
                                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                                    {formatCurrency(shift.total_cash_in)}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 px-3 font-semibold text-slate-700">Chuyển khoản VietQR:</td>
                                                <td className="py-2 px-3 text-right font-mono font-bold text-blue-700">
                                                    {formatCurrency(shift.total_transfer_in)}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="py-2 px-3 font-semibold text-slate-700">Thẻ ngân hàng / POS:</td>
                                                <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700">
                                                    {formatCurrency(shift.total_card_in)}
                                                </td>
                                            </tr>
                                            <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                                                <td className="py-2.5 px-3 text-slate-900 text-sm">
                                                    TỔNG DOANH THU PHÁT SINH TRONG CA:
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-mono text-base text-emerald-700">
                                                    {formatCurrency(shift.total_revenue || (Number(shift.total_cash_in) + Number(shift.total_transfer_in) + Number(shift.total_card_in)))}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Ghi chú bàn giao ca */}
                            {shift.notes && (
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                                    <span className="font-bold text-slate-700 block mb-1">Ghi chú & Bàn giao:</span>
                                    <p className="text-slate-600 italic whitespace-pre-line">{shift.notes}</p>
                                </div>
                            )}

                            {/* CHỮ KÝ XÁC NHẬN */}
                            <div className="pt-6 grid grid-cols-3 gap-2 sm:gap-4 text-center text-[10px] sm:text-xs text-slate-700">
                                <div>
                                    <div className="font-bold uppercase">Thu Ngân Trực Ca</div>
                                    <div className="text-[11px] text-slate-400 italic">(Ký, ghi rõ họ tên)</div>
                                    <div className="mt-14 font-semibold text-slate-900">
                                        {shift.user_name || '................................'}
                                    </div>
                                </div>

                                <div>
                                    <div className="font-bold uppercase">Người Nhận Bàn Giao</div>
                                    <div className="text-[11px] text-slate-400 italic">(Ký, ghi rõ họ tên)</div>
                                    <div className="mt-14 font-semibold text-slate-900">
                                        {shift.handover_user_name || '................................'}
                                    </div>
                                </div>

                                <div>
                                    <div className="font-bold uppercase">Quản Lý / Kế Toán</div>
                                    <div className="text-[11px] text-slate-400 italic">(Ký duyệt)</div>
                                    <div className="mt-14 font-semibold text-slate-900">
                                        ................................
                                    </div>
                                </div>
                            </div>

                            <div className="text-center text-[10px] text-slate-400 pt-6 border-t border-dashed border-slate-300">
                                Phiếu Z-Report được trích xuất tự động từ Hệ thống Quản trị Khách sạn (PMS) lúc {new Date().toLocaleString('vi-VN')}
                            </div>
                        </div>
                    ) : (
                        <div className="py-16 text-center text-slate-400">
                            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-slate-600">Không tìm thấy thông tin ca làm việc này.</p>
                            <p className="text-xs text-slate-400 mt-1">Vui lòng kiểm tra lại mã ca hoặc thử tải lại trang.</p>
                        </div>
                    )}
                </div>

                {/* 3. FOOTER (Sticky Bottom, Ẩn khi in) */}
                <div className="no-print shrink-0 px-5 sm:px-6 py-3.5 bg-slate-50/90 backdrop-blur-xs border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="font-medium">Hệ thống Quản trị Khách sạn (PMS)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            <span>In Ngay</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-100 transition cursor-pointer"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
