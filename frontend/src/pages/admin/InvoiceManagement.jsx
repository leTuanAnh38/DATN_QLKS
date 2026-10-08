import React, { useState, useEffect, useMemo } from 'react';
import {
    Receipt,
    Search,
    Filter,
    Printer,
    RefreshCw,
    CreditCard,
    CheckCircle2,
    Clock,
    XCircle,
    ArrowUpRight,
    User,
    Calendar,
    DoorOpen,
    Copy,
    Check,
    AlertCircle,
    SlidersHorizontal,
    QrCode,
    Banknote
} from 'lucide-react';
import api from '../../services/api';

// =========================================================================
// HƯỚNG DẪN IMPORT COMPONENT HÓA ĐƠN CÓ SẴN CỦA BẠN:
// Nếu bạn có component <InvoiceModal /> hoặc <HotelInvoiceModal /> từ trước,
// hãy mở comment import dưới đây:
// =========================================================================
import HotelInvoiceModal from '../../components/admin/modals/HotelInvoiceModal';
import Pagination from '../../components/common/Pagination';
// import InvoiceModal from './InvoiceModal'; // <-- Hoặc đường dẫn component của bạn

/**
 * Dữ liệu mẫu dự phòng (Mock data) khi Backend chưa có nhiều giao dịch
 */
const MOCK_PAYMENTS = [
    {
        id: 1,
        transaction_id: 'TXN-98FA1201',
        guest_name: 'Nguyễn Văn An',
        booking_id: 101,
        booking_code: 'BK-89012',
        room_number: 'P.302',
        amount: 2450000,
        payment_method: 'TRANSFER', // VietQR Chuyển khoản
        payment_status: 'COMPLETED',
        created_at: '2026-10-06T08:30:00Z',
        booking: {
            id: 101,
            booking_code: 'BK-89012',
            guest: { get_full_name: 'Nguyễn Văn An', username: 'nguyenvanan', phone: '0905123456' },
            room: { room_number: 'P.302', room_type_name: 'Phòng Deluxe Hướng Biển' },
            category: { name: 'Deluxe Ocean View' },
            check_in_date: '2026-10-06',
            check_out_date: '2026-10-08',
            total_amount: 2450000,
            status: 'paid'
        }
    },
    {
        id: 2,
        transaction_id: 'TXN-7B32CD99',
        guest_name: 'Trần Thị Thu Hà',
        booking_id: 102,
        booking_code: 'BK-89015',
        room_number: 'P.405',
        amount: 1800000,
        payment_method: 'CASH', // Tiền mặt
        payment_status: 'COMPLETED',
        created_at: '2026-10-06T09:15:00Z',
        booking: {
            id: 102,
            booking_code: 'BK-89015',
            guest: { get_full_name: 'Trần Thị Thu Hà', username: 'thuha_tran' },
            room: { room_number: 'P.405', room_type_name: 'Phòng Suite Gia Đình' },
            check_in_date: '2026-10-06',
            check_out_date: '2026-10-07',
            total_amount: 1800000,
            status: 'paid'
        }
    },
    {
        id: 3,
        transaction_id: 'TXN-45E99A10',
        guest_name: 'Lê Hoàng Nam',
        booking_id: 103,
        booking_code: 'BK-89020',
        room_number: 'P.201',
        amount: 3200000,
        payment_method: 'TRANSFER',
        payment_status: 'PENDING',
        created_at: '2026-10-06T10:45:00Z',
        booking: {
            id: 103,
            booking_code: 'BK-89020',
            guest: { get_full_name: 'Lê Hoàng Nam', username: 'namle' },
            room: { room_number: 'P.201' },
            total_amount: 3200000,
            status: 'pending'
        }
    },
    {
        id: 4,
        transaction_id: 'TXN-11A02E84',
        guest_name: 'Phạm Minh Tuấn',
        booking_id: 104,
        booking_code: 'BK-89028',
        room_number: 'P.501',
        amount: 5500000,
        payment_method: 'TRANSFER',
        payment_status: 'FAILED',
        created_at: '2026-10-05T14:20:00Z',
        booking: {
            id: 104,
            booking_code: 'BK-89028',
            guest: { get_full_name: 'Phạm Minh Tuấn' },
            room: { room_number: 'P.501' },
            total_amount: 5500000,
            status: 'cancelled'
        }
    }
];

export default function InvoiceManagement() {
    // 1. STATE QUẢN LÝ DỮ LIỆU
    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // 2. STATE BỘ LỌC
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, COMPLETED, PENDING, FAILED
    const [methodFilter, setMethodFilter] = useState('ALL'); // ALL, TRANSFER, CASH

    // 3. STATE TÁI SỬ DỤNG: LƯU BẢN GHI ĐƯỢC CHỌN ĐỂ IN HÓA ĐƠN
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [copiedTxn, setCopiedTxn] = useState(null);

    // 4. STATE PHÂN TRANG (PAGINATION)
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // =========================================================================
    // HÀM FETCH DỮ LIỆU TỪ BACKEND
    // =========================================================================
    const fetchPayments = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get('/payments/');
            const data = res.data?.results || res.data || [];
            if (Array.isArray(data) && data.length > 0) {
                setPayments(data);
            } else {
                // Nếu backend chưa có dữ liệu giao dịch thì dùng dữ liệu mẫu
                setPayments(MOCK_PAYMENTS);
            }
        } catch (err) {
            console.warn('Không thể kết nối API /payments/, chuyển sang dữ liệu mẫu:', err);
            setPayments(MOCK_PAYMENTS);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPayments();
    }, []);

    // Tự động trở về trang 1 khi thay đổi điều kiện tìm kiếm, bộ lọc hoặc kích thước trang
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, methodFilter, pageSize]);

    // =========================================================================
    // LỌC DỮ LIỆU THEO TÌM KIẾM VÀ TRẠNG THÁI
    // =========================================================================
    const filteredPayments = useMemo(() => {
        return payments.filter((item) => {
            // Lọc theo từ khóa (Mã đặt phòng, Tên khách hàng, Mã giao dịch)
            const keyword = searchTerm.trim().toLowerCase();
            const matchSearch =
                !keyword ||
                (item.booking_code && item.booking_code.toLowerCase().includes(keyword)) ||
                (item.guest_name && item.guest_name.toLowerCase().includes(keyword)) ||
                (item.transaction_id && item.transaction_id.toLowerCase().includes(keyword));

            // Lọc theo Trạng thái (Thành công, Chờ xử lý, Thất bại)
            const matchStatus =
                statusFilter === 'ALL' || item.payment_status === statusFilter;

            // Lọc theo Phương thức
            const matchMethod =
                methodFilter === 'ALL' || item.payment_method === methodFilter;

            return matchSearch && matchStatus && matchMethod;
        });
    }, [payments, searchTerm, statusFilter, methodFilter]);

    // Tính toán phân trang
    const totalPages = Math.ceil(filteredPayments.length / pageSize) || 1;
    const paginatedPayments = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredPayments.slice(start, start + pageSize);
    }, [filteredPayments, currentPage, pageSize]);

    // Thống kê nhanh các chỉ số
    const stats = useMemo(() => {
        const completed = payments.filter((p) => p.payment_status === 'COMPLETED');
        const pending = payments.filter((p) => p.payment_status === 'PENDING');
        const totalRevenue = completed.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        return {
            totalRevenue,
            completedCount: completed.length,
            pendingCount: pending.length,
            totalCount: payments.length
        };
    }, [payments]);

    // Format tiền VND
    const formatVND = (val) => {
        const num = Number(val) || 0;
        return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
    };

    // Format thời gian
    const formatDateTime = (isoStr) => {
        if (!isoStr) return '—';
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            return d.toLocaleString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return isoStr;
        }
    };

    // Sao chép nhanh mã giao dịch
    const handleCopyTxn = (text) => {
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(text);
            setCopiedTxn(text);
            setTimeout(() => setCopiedTxn(null), 2000);
        }
    };

    return (
        <div className="space-y-6">
            {/* ================================================================= */}
            {/* 1. HEADER TRANG: TITLE & THỐNG KÊ NHANH                          */}
            {/* ================================================================= */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-3.5">
                   
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <span>Thanh toán & Hóa đơn</span>
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                PMS Quản lý
                            </span>
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                            Theo dõi các giao dịch thanh toán VietQR, tiền mặt và xuất/in phiếu hóa đơn
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={fetchPayments}
                        disabled={isLoading}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Tải lại danh sách"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                        <span>Làm mới</span>
                    </button>
                </div>
            </div>

            {/* THẺ THỐNG KÊ TỔNG QUAN (KPIs) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                        <span>Tổng tiền đã thu (VND)</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <ArrowUpRight className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-emerald-600 mt-2 font-serif">
                        {formatVND(stats.totalRevenue)}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Từ {stats.completedCount} giao dịch thành công</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                        <span>Giao dịch thành công</span>
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 mt-2">
                        {stats.completedCount} <span className="text-xs font-normal text-slate-400">/ {stats.totalCount}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Đã đối soát & lưu vào hệ thống</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                        <span>Chờ xử lý / Đang chuyển</span>
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-amber-600 mt-2">
                        {stats.pendingCount}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Cần đối soát hoặc xác nhận lại</p>
                </div>
            </div>

            {/* ================================================================= */}
            {/* 2. THANH BỘ LỌC (FILTERS): SEARCH INPUT & STATUS DROPDOWN         */}
            {/* ================================================================= */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
                {/* Input Tìm kiếm (mã đặt phòng, tên khách, mã giao dịch) */}
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Tìm theo mã phòng (BK-...), tên khách, mã TXN..."
                        className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <XCircle className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Các Dropdown lọc */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Dropdown lọc Trạng thái: Thành công, Chờ xử lý, Thất bại */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                        <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="text-slate-500 font-medium">Trạng thái:</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
                        >
                            <option value="ALL">Tất cả</option>
                            <option value="COMPLETED">Thành công</option>
                            <option value="PENDING">Chờ xử lý</option>
                            <option value="FAILED">Thất bại</option>
                        </select>
                    </div>

                    {/* Dropdown lọc Phương thức */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                        <CreditCard className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="text-slate-500 font-medium">Hình thức:</span>
                        <select
                            value={methodFilter}
                            onChange={(e) => setMethodFilter(e.target.value)}
                            className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
                        >
                            <option value="ALL">Tất cả</option>
                            <option value="TRANSFER">VietQR / Chuyển khoản</option>
                            <option value="CASH">Tiền mặt</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* ================================================================= */}
            {/* 3. BẢNG DỮ LIỆU GIAO DỊCH (DATA TABLE)                            */}
            {/* ================================================================= */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                <th className="py-4 px-4 sm:px-6">Mã Giao dịch</th>
                                <th className="py-4 px-4">Khách hàng</th>
                                <th className="py-4 px-4">Mã Phòng / Đơn</th>
                                <th className="py-4 px-4">Số tiền (VND)</th>
                                <th className="py-4 px-4">Hình thức</th>
                                <th className="py-4 px-4">Trạng thái</th>
                                <th className="py-4 px-4">Ngày tạo</th>
                                <th className="py-4 px-4 sm:px-6 text-center">Hành động</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                                            <span>Đang tải dữ liệu giao dịch...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredPayments.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Receipt className="w-8 h-8 text-slate-300" />
                                            <span className="font-medium text-slate-600">Không tìm thấy giao dịch nào</span>
                                            <span className="text-xs text-slate-400">Thử thay đổi bộ lọc tìm kiếm hoặc từ khóa</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedPayments.map((payment) => {
                                    const isCompleted = payment.payment_status === 'COMPLETED';
                                    const isPending = payment.payment_status === 'PENDING';
                                    const isFailed = payment.payment_status === 'FAILED';

                                    const isVietQR =
                                        payment.payment_method === 'TRANSFER' ||
                                        payment.payment_method === 'vietqr' ||
                                        payment.payment_method === 'bank_transfer';

                                    return (
                                        <tr
                                            key={payment.id}
                                            className="hover:bg-blue-50/30 transition duration-150"
                                        >
                                            {/* 1. Mã Giao dịch */}
                                            <td className="py-3.5 px-4 sm:px-6 font-mono text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-slate-800">
                                                        {payment.transaction_id || `TXN-${payment.id}`}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyTxn(payment.transaction_id || `TXN-${payment.id}`)}
                                                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition"
                                                        title="Sao chép mã giao dịch"
                                                    >
                                                        {copiedTxn === (payment.transaction_id || `TXN-${payment.id}`) ? (
                                                            <Check className="w-3 h-3 text-emerald-600" />
                                                        ) : (
                                                            <Copy className="w-3 h-3" />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>

                                            {/* 2. Khách hàng */}
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                                        {payment.guest_name ? payment.guest_name[0] : 'K'}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900">
                                                            {payment.guest_name || 'Khách vãng lai'}
                                                        </div>
                                                        {payment.booking?.guest?.phone && (
                                                            <div className="text-[11px] text-slate-400">
                                                                {payment.booking.guest.phone}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* 3. Mã Phòng (Booking Code) */}
                                            <td className="py-3.5 px-4">
                                                <div className="space-y-0.5">
                                                    <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 text-xs inline-block">
                                                        {payment.booking_code || `BK-${payment.booking_id}`}
                                                    </span>
                                                    {payment.room_number && (
                                                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                                            <DoorOpen className="w-3 h-3 text-slate-400" />
                                                            <span>{payment.room_number}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* 4. Số tiền (VND) */}
                                            <td className="py-3.5 px-4">
                                                <span className="font-mono font-black text-slate-900 text-sm">
                                                    {formatVND(payment.amount)}
                                                </span>
                                            </td>

                                            {/* 5. Hình thức (VietQR / Tiền mặt) */}
                                            <td className="py-3.5 px-4">
                                                {isVietQR ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                        <QrCode className="w-3 h-3 text-blue-600" />
                                                        <span>VietQR</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                        <Banknote className="w-3 h-3 text-amber-600" />
                                                        <span>Tiền mặt</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* 6. Trạng thái */}
                                            <td className="py-3.5 px-4">
                                                {isCompleted && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        <span>Thành công</span>
                                                    </span>
                                                )}
                                                {isPending && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                        <Clock className="w-3 h-3" />
                                                        <span>Chờ xử lý</span>
                                                    </span>
                                                )}
                                                {isFailed && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                        <XCircle className="w-3 h-3" />
                                                        <span>Thất bại</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* 7. Ngày tạo */}
                                            <td className="py-3.5 px-4 text-xs text-slate-500">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <span>{formatDateTime(payment.created_at)}</span>
                                                </div>
                                            </td>

                                            {/* 8. Cột Hành động: Nút "Xem / In Hóa đơn" */}
                                            <td className="py-3.5 px-4 sm:px-6 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        // Gán dòng dữ liệu được chọn vào state để mở modal
                                                        setSelectedPayment(payment);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-blue-600/20 transition cursor-pointer active:scale-95"
                                                    title="Xem và In Hóa đơn"
                                                >
                                                    <Printer className="w-3.5 h-3.5" />
                                                    <span>Xem / In Hóa đơn</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer bảng dữ liệu: Phân trang chuẩn */}
                <div className="border-t border-slate-200/80 bg-white">
                    {/* Thanh chọn số hàng mỗi trang & tóm tắt */}
                    <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-3 bg-slate-50/70 border-b border-slate-100 gap-3 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                            <span>Số hàng mỗi trang:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value={5}>5 hàng</option>
                                <option value={10}>10 hàng</option>
                                <option value={20}>20 hàng</option>
                                <option value={50}>50 hàng</option>
                            </select>
                        </div>
                        <span className="text-[11px] text-slate-400">
                            Hiển thị <strong>{paginatedPayments.length}</strong> / <strong>{filteredPayments.length}</strong> giao dịch phù hợp (Tổng {payments.length})
                        </span>
                    </div>

                    {filteredPayments.length > 0 && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            totalCount={filteredPayments.length}
                            pageSize={pageSize}
                        />
                    )}
                </div>
            </div>

            {/* ================================================================= */}
            {/* 4. LOGIC TÁI SỬ DỤNG: GẮN COMPONENT HÓA ĐƠN CÓ SẴN CỦA BẠN        */}
            {/* ================================================================= */}
            {selectedPayment && (
                /**
                 * CÁCH 1: Nếu component Hóa đơn nhận prop `booking` (như HotelInvoiceModal sẵn có):
                 */
                <HotelInvoiceModal
                    booking={selectedPayment.booking_details || selectedPayment.booking || {
                        id: selectedPayment.booking_id,
                        booking_code: selectedPayment.booking_code,
                        customer_name: selectedPayment.guest_name,
                        guest: { get_full_name: selectedPayment.guest_name },
                        total_amount: selectedPayment.amount,
                        room_amount: selectedPayment.amount,
                        status: 'paid',
                        payment_method: selectedPayment.payment_method
                    }}
                    payment={selectedPayment}
                    paymentMethod={selectedPayment.payment_method}
                    onClose={() => setSelectedPayment(null)}
                />

                /**
                 * CÁCH 2: Nếu component của bạn nhận `paymentId` hoặc `bookingId`:
                 * 
                 * <InvoiceModal
                 *     paymentId={selectedPayment.id}
                 *     bookingId={selectedPayment.booking_id}
                 *     onClose={() => setSelectedPayment(null)}
                 * />
                 */
            )}
        </div>
    );
}
