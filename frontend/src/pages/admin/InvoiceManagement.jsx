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
    Banknote,
    Building2,
    Users,
    PlusCircle,
    ArrowDownCircle,
    X
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../store/authStore';
import { paymentService } from '../../services/paymentService';
import HotelInvoiceModal from '../../components/admin/modals/HotelInvoiceModal';
import CollectCashModal from '../../components/admin/modals/CollectCashModal';
import CreateCashOutModal from '../../components/admin/modals/CreateCashOutModal';
import Pagination from '../../components/common/Pagination';
import ShiftStatusWidget from '../../components/admin/shifts/ShiftStatusWidget';
import ShiftHistoryList from '../../components/admin/shifts/ShiftHistoryList';
import OpenShiftModal from '../../components/admin/modals/OpenShiftModal';
import CloseShiftModal from '../../components/admin/modals/CloseShiftModal';
import ShiftZReportModal from '../../components/admin/modals/ShiftZReportModal';

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
    // Phân quyền: Chỉ Thu ngân (Cashier), Quản lý (Manager), Chủ KS (Owner) và Admin mới có quyền Chi tiền / Hoàn cọc
    // Lễ tân (Receptionist) chỉ có quyền Thu tiền tại quầy, không được phép lập phiếu chi
    const { user: currentUser } = useAuth();
    const currentUserRole = currentUser?.role || '';
    const canCreateCashOut = ['admin', 'owner', 'manager', 'cashier'].includes(currentUserRole);

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

    // 5. STATE NGHIỆP VỤ THU NGÂN: THU TIỀN TẠI QUẦY & CHI TIỀN / HOÀN CỌC
    const [isCollectCashOpen, setIsCollectCashOpen] = useState(false);
    const [isCashOutOpen, setIsCashOutOpen] = useState(false);
    const [confirmingPayment, setConfirmingPayment] = useState(null);
    const [confirmPaymentMethod, setConfirmPaymentMethod] = useState('TRANSFER');
    const [confirmNote, setConfirmNote] = useState('');
    const [isConfirmingLoading, setIsConfirmingLoading] = useState(false);

    // 6. STATE THÔNG BÁO TỨC THÌ (TOAST)
    const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: '' }
    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    // 7. STATE QUẢN LÝ CA LÀM VIỆC & KẾT CA BÀN GIAO QUỸ (GIAI ĐOẠN 3)
    const [activeShift, setActiveShift] = useState(null);
    const [isLoadingShift, setIsLoadingShift] = useState(false);
    const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
    const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
    const [selectedClosingShift, setSelectedClosingShift] = useState(null);
    const [selectedZReportShiftId, setSelectedZReportShiftId] = useState(null);
    const [activeTab, setActiveTab] = useState('TRANSACTIONS'); // 'TRANSACTIONS' | 'SHIFTS'

    // Lấy thông tin ca làm việc đang mở hiện tại của thu ngân
    const fetchCurrentShift = async () => {
        setIsLoadingShift(true);
        try {
            const res = await paymentService.getCurrentShift();
            const currentShift = res?.active_shift || res?.shift || res?.data;
            if (res?.success && currentShift) {
                setActiveShift(currentShift);
            } else {
                setActiveShift(null);
            }
        } catch (err) {
            console.warn('Lỗi khi lấy ca hiện tại:', err);
            setActiveShift(null);
        } finally {
            setIsLoadingShift(false);
        }
    };

    // Xử lý xác nhận thu tiền cho giao dịch PENDING
    const handleConfirmPayment = async () => {
        if (!confirmingPayment) return;
        setIsConfirmingLoading(true);
        try {
            const res = await paymentService.confirmPaymentById(confirmingPayment.id, {
                payment_method: confirmPaymentMethod,
                note: confirmNote.trim()
            });
            showToast('success', res.message || `Đã xác nhận thu tiền cho giao dịch #${confirmingPayment.transaction_id || confirmingPayment.id} thành công!`);
            setConfirmingPayment(null);
            fetchPayments();
            fetchCurrentShift();
        } catch (err) {
            console.error('Lỗi khi xác nhận thanh toán:', err);
            const msg = err.response?.data?.message || err.response?.data?.detail || 'Không thể xác nhận thanh toán.';
            showToast('error', msg);
        } finally {
            setIsConfirmingLoading(false);
        }
    };

    // Callback khi thu tiền mặt thành công từ CollectCashModal
    const handleCollectCashSuccess = (createdPayment, booking) => {
        const bCode = booking?.booking_code || createdPayment?.booking_code || '';
        showToast('success', `Đã ghi nhận thu ${formatVND(createdPayment?.amount || 0)} cho đơn #${bCode} thành công!`);
        fetchPayments();
        fetchCurrentShift();
        // Tự động mở Modal in phiếu hóa đơn
        if (createdPayment) {
            setSelectedPayment({
                ...createdPayment,
                guest_name: booking?.guest_name || booking?.guest?.get_full_name || createdPayment.guest_name,
                room_number: booking?.room?.room_number || createdPayment.room_number,
                booking: booking || createdPayment.booking
            });
        }
    };

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
        fetchCurrentShift();
    }, []);

    // Tự động trở về trang 1 khi thay đổi điều kiện tìm kiếm, bộ lọc hoặc kích thước trang
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, methodFilter, pageSize]);

    // =========================================================================
    // LỌC VÀ SẮP XẾP DỮ LIỆU: ƯU TIÊN CHỜ XỬ LÝ (PENDING) LÊN TRÊN HẾT
    // =========================================================================
    const getStatusPriority = (status) => {
        const s = String(status || '').toUpperCase();
        if (s === 'PENDING' || s === 'PROCESSING') return 1; // 1: Chờ xử lý (Ưu tiên cao nhất)
        if (s === 'COMPLETED') return 2;                     // 2: Thành công (Xuống dưới)
        return 3;                                            // 3: Thất bại / Đã hủy
    };

    const filteredPayments = useMemo(() => {
        const list = payments.filter((item) => {
            // Lọc theo từ khóa (Mã đặt phòng, Mã đoàn, Tên khách hàng, Tên công ty, SĐT, Mã giao dịch)
            const keyword = searchTerm.trim().toLowerCase();
            const matchSearch =
                !keyword ||
                (item.booking_code && item.booking_code.toLowerCase().includes(keyword)) ||
                (item.group_booking_code && item.group_booking_code.toLowerCase().includes(keyword)) ||
                (item.guest_name && item.guest_name.toLowerCase().includes(keyword)) ||
                (item.company_name && item.company_name.toLowerCase().includes(keyword)) ||
                (item.guest_phone && item.guest_phone.toLowerCase().includes(keyword)) ||
                (item.transaction_id && item.transaction_id.toLowerCase().includes(keyword));

            // Lọc theo Trạng thái (Thành công, Chờ xử lý, Thất bại)
            const matchStatus =
                statusFilter === 'ALL' || item.payment_status === statusFilter;

            // Lọc theo Phương thức
            const matchMethod =
                methodFilter === 'ALL' || item.payment_method === methodFilter;

            return matchSearch && matchStatus && matchMethod;
        });

        // Sắp xếp: Chờ xử lý (PENDING) lên trước, Hoàn tất (COMPLETED) xuống sau
        return list.slice().sort((a, b) => {
            const prioA = getStatusPriority(a.payment_status);
            const prioB = getStatusPriority(b.payment_status);
            if (prioA !== prioB) {
                return prioA - prioB;
            }
            // Cùng nhóm trạng thái: Ưu tiên ngày tạo mới nhất (created_at giảm dần)
            const timeA = new Date(a.created_at || 0).getTime();
            const timeB = new Date(b.created_at || 0).getTime();
            if (timeA !== timeB) {
                return timeB - timeA;
            }
            return (b.id || 0) - (a.id || 0);
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

    // Format thời gian chuẩn HH:mm DD/MM/YYYY
    const formatDateTime = (isoStr) => {
        if (!isoStr) return '—';
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${hours}:${minutes} ${day}/${month}/${year}`;
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
        <div className="space-y-3.5 sm:space-y-4">
            {/* ================================================================= */}
            {/* 1. HEADER TRANG: TITLE & THỐNG KÊ NHANH                          */}
            {/* ================================================================= */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-5 py-3.5 sm:px-6 sm:py-4 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <span>Thanh toán & Hóa đơn</span>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                PMS Quản lý
                            </span>
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Theo dõi các giao dịch thanh toán VietQR, tiền mặt và xuất/in phiếu hóa đơn
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
                    {/* Nút Thu tiền mặt tại quầy */}
                    <button
                        type="button"
                        onClick={() => setIsCollectCashOpen(true)}
                        className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                        title="Lập phiếu thu tiền mặt hoặc thu tiền trực tiếp tại quầy lễ tân"
                    >
                        <Banknote className="w-4 h-4" />
                        <span>Thu tiền tại quầy</span>
                    </button>

                    {/* Nút Chi tiền / Hoàn cọc (Chỉ hiển thị cho Thu ngân, Quản lý, Chủ KS và Admin) */}
                    {canCreateCashOut && (
                        <button
                            type="button"
                            onClick={() => setIsCashOutOpen(true)}
                            className="px-3.5 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs shadow-rose-600/20 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                            title="Lập phiếu chi tiền mặt từ két hoặc hoàn trả cọc cho khách (Dành cho Thu ngân & Quản lý)"
                        >
                            <ArrowDownCircle className="w-4 h-4" />
                            <span>Chi tiền / Hoàn cọc</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={fetchPayments}
                        disabled={isLoading}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Tải lại danh sách"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                        <span>Làm mới</span>
                    </button>
                </div>
            </div>

            {/* ================================================================= */}
            {/* 1.1 WIDGET TRẠNG THÁI CA LÀM VIỆC & KẾT CA BÀN GIAO QUỸ (GIAI ĐOẠN 3) */}
            {/* ================================================================= */}
            <ShiftStatusWidget
                activeShift={activeShift}
                isLoading={isLoadingShift}
                onOpenShift={() => setIsOpenShiftModalOpen(true)}
                onCloseShift={(shift) => {
                    setSelectedClosingShift(shift);
                    setIsCloseShiftModalOpen(true);
                }}
                onViewZReport={(shiftId) => setSelectedZReportShiftId(shiftId)}
            />

            {/* ================================================================= */}
            {/* 1.2 THANH CHUYỂN ĐỔI TAB: GIAO DỊCH vs LỊCH SỬ CA TRỰC (Z-REPORT)   */}
            {/* ================================================================= */}
            <div className="flex items-center gap-2 border-b border-slate-200/80 pb-1.5 overflow-x-auto scrollbar-none max-w-full">
                <button
                    type="button"
                    onClick={() => setActiveTab('TRANSACTIONS')}
                    className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                        activeTab === 'TRANSACTIONS'
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                    }`}
                >
                    <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Giao Dịch Thanh Toán & Thu Tiền</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('SHIFTS')}
                    className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                        activeTab === 'SHIFTS'
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                    }`}
                >
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Lịch Sử Ca Trực & Sổ Quỹ Z-Report</span>
                </button>
            </div>

            {/* NỘI DUNG THEO TAB */}
            {activeTab === 'SHIFTS' ? (
                <ShiftHistoryList onRefreshActiveShift={fetchCurrentShift} />
            ) : (
                <>
            {/* THẺ THỐNG KÊ TỔNG QUAN (KPIs) - BẤM ĐỂ LỌC NHANH */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div 
                    onClick={() => setStatusFilter('ALL')}
                    className={`bg-white p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer shadow-xs ${
                        statusFilter === 'ALL'
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                            : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                    title="Bấm để xem tất cả giao dịch"
                >
                    <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                        <span>Tổng tiền đã thu (Thực thu)</span>
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1 font-serif">
                        {formatVND(stats.totalRevenue)}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Từ {stats.completedCount} giao dịch thành công</p>
                </div>

                <div 
                    onClick={() => setStatusFilter('COMPLETED')}
                    className={`bg-white p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer shadow-xs ${
                        statusFilter === 'COMPLETED'
                            ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm bg-blue-50/20'
                            : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                    title="Bấm để lọc các giao dịch đã hoàn tất"
                >
                    <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                        <span>Giao dịch thành công</span>
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                        {stats.completedCount} <span className="text-xs font-normal text-slate-400">/ {stats.totalCount}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Đã đối soát & lưu vào hệ thống</p>
                </div>

                <div 
                    onClick={() => setStatusFilter('PENDING')}
                    className={`bg-white p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer shadow-xs ${
                        statusFilter === 'PENDING'
                            ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-sm bg-amber-50/20'
                            : 'border-slate-200/80 hover:border-amber-300'
                    }`}
                    title="Bấm để lọc các giao dịch Chờ xử lý cần xác nhận"
                >
                    <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                        <span className="font-bold text-amber-900">Chờ xử lý / Đang chuyển</span>
                        <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center animate-pulse">
                            <Clock className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-amber-600 mt-1 flex items-center gap-2">
                        <span>{stats.pendingCount}</span>
                        {stats.pendingCount > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                Cần xử lý ngay
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Cần đối soát hoặc xác nhận lại</p>
                </div>
            </div>

            {/* ================================================================= */}
            {/* 2. THANH BỘ LỌC (FILTERS): SEARCH INPUT & STATUS DROPDOWN         */}
            {/* ================================================================= */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
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
                {/* BẢNG DỮ LIỆU GIAO DỊCH (CHỈ HIỂN THỊ TRÊN DESKTOP/TABLET) */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                                <th className="py-4 px-4 sm:px-6">Mã Giao dịch</th>
                                <th className="py-4 px-4 min-w-[200px]">Khách hàng</th>
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
                                            <td className="py-3.5 px-4 sm:px-6 font-mono text-xs whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-slate-800">
                                                        {payment.transaction_id || `TXN-${payment.id}`}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyTxn(payment.transaction_id || `TXN-${payment.id}`)}
                                                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition shrink-0"
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
                                            <td className="py-3.5 px-4 min-w-[200px]">
                                                {(() => {
                                                    const isGroupOrCorp = Boolean(
                                                        payment.is_group || 
                                                        payment.group_booking_code || 
                                                        payment.company_name || 
                                                        (payment.transaction_id && payment.transaction_id.includes('GRP-'))
                                                    );
                                                    const phoneDisplay = payment.guest_phone || payment.booking?.guest?.phone;

                                                    return (
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                                                                isGroupOrCorp 
                                                                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs' 
                                                                    : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                                {isGroupOrCorp ? (
                                                                    <Building2 className="w-4 h-4 text-indigo-600" />
                                                                ) : (
                                                                    payment.guest_name ? payment.guest_name[0] : 'K'
                                                                )}
                                                            </div>
                                                            <div>
                                                                {isGroupOrCorp && (
                                                                    <div className="mb-0.5">
                                                                        <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider whitespace-nowrap">
                                                                            🏢 Doanh nghiệp / Đoàn
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <div className="font-bold text-slate-900 leading-snug">
                                                                    {payment.guest_name || payment.company_name || 'Khách vãng lai'}
                                                                </div>
                                                                {phoneDisplay && (
                                                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                                                        {phoneDisplay}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </td>

                                            {/* 3. Mã Phòng (Booking Code) */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                {(() => {
                                                    const isGroupOrCorp = Boolean(
                                                        payment.is_group || 
                                                        payment.group_booking_code || 
                                                        payment.company_name || 
                                                        (payment.transaction_id && payment.transaction_id.includes('GRP-'))
                                                    );
                                                    const codeDisplay = payment.group_booking_code || payment.booking_code || (
                                                        payment.transaction_id && payment.transaction_id.includes('GRP-')
                                                            ? payment.transaction_id.replace('TXN-', '')
                                                            : (payment.booking_id ? `BK-${payment.booking_id}` : '—')
                                                    );

                                                    return (
                                                        <div className="space-y-1">
                                                            {isGroupOrCorp ? (
                                                                <>
                                                                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-xs inline-block shadow-2xs whitespace-nowrap">
                                                                        #{codeDisplay}
                                                                    </span>
                                                                    <div className="text-[11px] text-slate-600 flex items-center gap-1 font-medium whitespace-nowrap">
                                                                        <Users className="w-3 h-3 text-indigo-600 shrink-0" />
                                                                        <span>{payment.room_number || 'Đơn đặt đoàn'}</span>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 text-xs inline-block whitespace-nowrap">
                                                                        #{codeDisplay}
                                                                    </span>
                                                                    {payment.room_number && (
                                                                        <div className="text-[11px] text-slate-500 flex items-center gap-1 whitespace-nowrap">
                                                                            <DoorOpen className="w-3 h-3 text-slate-400 shrink-0" />
                                                                            <span>Phòng {payment.room_number}</span>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </td>

                                            {/* 4. Số tiền (VND) */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <span className="font-mono font-black text-slate-900 text-sm whitespace-nowrap">
                                                    {formatVND(payment.amount)}
                                                </span>
                                            </td>

                                            {/* 5. Hình thức (VietQR / Tiền mặt) */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                {isVietQR ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap shrink-0">
                                                        <QrCode className="w-3 h-3 text-blue-600 shrink-0" />
                                                        <span>VietQR</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap shrink-0">
                                                        <Banknote className="w-3 h-3 text-amber-600 shrink-0" />
                                                        <span>Tiền mặt</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* 6. Trạng thái */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                {isCompleted && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shrink-0">
                                                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                                                        <span>Thành công</span>
                                                    </span>
                                                )}
                                                {isPending && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap shrink-0">
                                                        <Clock className="w-3 h-3 shrink-0" />
                                                        <span>Chờ xử lý</span>
                                                    </span>
                                                )}
                                                {isFailed && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap shrink-0">
                                                        <XCircle className="w-3 h-3 shrink-0" />
                                                        <span>Thất bại</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* 7. Ngày tạo */}
                                            <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <span className="whitespace-nowrap">{formatDateTime(payment.created_at)}</span>
                                                </div>
                                            </td>

                                            {/* 8. Cột Hành động: Nút "Xác nhận thu" & "Xem / In Hóa đơn" */}
                                            <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {isPending && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setConfirmingPayment(payment);
                                                                setConfirmPaymentMethod(payment.payment_method || 'TRANSFER');
                                                                setConfirmNote('');
                                                            }}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs shadow-emerald-600/20 transition cursor-pointer active:scale-95"
                                                            title="Xác nhận đã nhận tiền cho giao dịch này"
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            <span>Xác nhận thu</span>
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            // Gán dòng dữ liệu được chọn vào state để mở modal
                                                            setSelectedPayment(payment);
                                                        }}
                                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer active:scale-95 ${
                                                            isPending
                                                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs shadow-blue-600/20'
                                                        }`}
                                                        title="Xem và In Hóa đơn"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                        <span>{isPending ? 'Xem' : 'In Hóa đơn'}</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ================================================================= */}
                {/* 3B. CHẾ ĐỘ THẺ GIAO DỊCH DI ĐỘNG (MOBILE CARD VIEW)               */}
                {/* ================================================================= */}
                <div className="block md:hidden divide-y divide-slate-100">
                    {isLoading ? (
                        <div className="py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-2">
                                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                                <span>Đang tải dữ liệu giao dịch...</span>
                            </div>
                        </div>
                    ) : filteredPayments.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 p-4">
                            <div className="flex flex-col items-center justify-center gap-2">
                                <Receipt className="w-8 h-8 text-slate-300" />
                                <span className="font-medium text-slate-600">Không tìm thấy giao dịch nào</span>
                                <span className="text-xs text-slate-400">Thử thay đổi bộ lọc tìm kiếm hoặc từ khóa</span>
                            </div>
                        </div>
                    ) : (
                        paginatedPayments.map((payment) => {
                            const isCompleted = payment.payment_status === 'COMPLETED';
                            const isPending = payment.payment_status === 'PENDING';
                            const isFailed = payment.payment_status === 'FAILED';

                            const isVietQR =
                                payment.payment_method === 'TRANSFER' ||
                                payment.payment_method === 'vietqr' ||
                                payment.payment_method === 'bank_transfer';

                            const isGroupOrCorp = Boolean(
                                payment.is_group || 
                                payment.group_booking_code || 
                                payment.company_name || 
                                (payment.transaction_id && payment.transaction_id.includes('GRP-'))
                            );
                            const phoneDisplay = payment.guest_phone || payment.booking?.guest?.phone;
                            const codeDisplay = payment.group_booking_code || payment.booking_code || (
                                payment.transaction_id && payment.transaction_id.includes('GRP-')
                                    ? payment.transaction_id.replace('TXN-', '')
                                    : (payment.booking_id ? `BK-${payment.booking_id}` : '—')
                            );

                            return (
                                <div
                                    key={payment.id}
                                    className="p-3.5 sm:p-4 hover:bg-blue-50/20 transition space-y-2.5"
                                >
                                    {/* 1. Header: Mã giao dịch & Trạng thái */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 font-mono text-xs">
                                            <span className="font-bold text-slate-800">
                                                {payment.transaction_id || `TXN-${payment.id}`}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyTxn(payment.transaction_id || `TXN-${payment.id}`)}
                                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition shrink-0 cursor-pointer"
                                                title="Sao chép mã"
                                            >
                                                {copiedTxn === (payment.transaction_id || `TXN-${payment.id}`) ? (
                                                    <Check className="w-3 h-3 text-emerald-600" />
                                                ) : (
                                                    <Copy className="w-3 h-3" />
                                                )}
                                            </button>
                                        </div>

                                        <div>
                                            {isCompleted && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                                                    <span>Thành công</span>
                                                </span>
                                            )}
                                            {isPending && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                    <Clock className="w-3 h-3 shrink-0" />
                                                    <span>Chờ xử lý</span>
                                                </span>
                                            )}
                                            {isFailed && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                    <XCircle className="w-3 h-3 shrink-0" />
                                                    <span>Thất bại</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 2. Khách hàng & Mã phòng */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            {isGroupOrCorp && (
                                                <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider mb-0.5">
                                                    🏢 Doanh nghiệp / Đoàn
                                                </span>
                                            )}
                                            <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                                                {payment.guest_name || payment.company_name || 'Khách vãng lai'}
                                            </div>
                                            {phoneDisplay && (
                                                <div className="text-[11px] text-slate-500 mt-0.5">
                                                    📞 {phoneDisplay}
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-right shrink-0">
                                            {isGroupOrCorp ? (
                                                <div>
                                                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-xs inline-block shadow-2xs">
                                                        #{codeDisplay}
                                                    </span>
                                                    <div className="text-[10px] text-slate-600 font-medium mt-0.5">
                                                        {payment.room_number || 'Đơn đặt đoàn'}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 text-xs inline-block">
                                                        #{codeDisplay}
                                                    </span>
                                                    {payment.room_number && (
                                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                                            Phòng {payment.room_number}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 3. Số tiền, Hình thức & Ngày tạo */}
                                    <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/80 flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] text-slate-400 block font-medium">Số tiền thu</span>
                                            <span className="font-mono font-black text-slate-900 text-sm">
                                                {formatVND(payment.amount)}
                                            </span>
                                        </div>

                                        <div className="text-right space-y-1">
                                            <div>
                                                {isVietQR ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                        <QrCode className="w-2.5 h-2.5 text-blue-600" />
                                                        <span>VietQR</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                        <Banknote className="w-2.5 h-2.5 text-amber-600" />
                                                        <span>Tiền mặt</span>
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                                {formatDateTime(payment.created_at)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4. Cụm nút hành động */}
                                    <div className="pt-1.5 flex items-center justify-end gap-2">
                                        {isPending && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setConfirmingPayment(payment);
                                                    setConfirmPaymentMethod(payment.payment_method || 'TRANSFER');
                                                    setConfirmNote('');
                                                }}
                                                className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>Xác nhận thu</span>
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => setSelectedPayment(payment)}
                                            className={`py-2 px-3.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                                                isPending
                                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                                    : 'flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                                            }`}
                                        >
                                            <Printer className="w-3.5 h-3.5" />
                                            <span>{isPending ? 'Xem' : 'In Hóa đơn'}</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
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
            </>
            )}

            {/* ================================================================= */}
            {/* 4. MODAL THU TIỀN TẠI QUẦY (COLLECT CASH MODAL)                   */}
            {/* ================================================================= */}
            <CollectCashModal
                isOpen={isCollectCashOpen}
                onClose={() => setIsCollectCashOpen(false)}
                onSuccess={handleCollectCashSuccess}
            />

            {/* ================================================================= */}
            {/* 5. MODAL XÁC NHẬN GIAO DỊCH PENDING                               */}
            {/* ================================================================= */}
            {confirmingPayment && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-7 shadow-2xl text-left animate-in zoom-in-95 duration-200">
                        <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
                                    ✓
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-base">Xác Nhận Đã Nhận Tiền</h3>
                                    <p className="text-xs text-slate-500">Chuyển giao dịch sang trạng thái Hoàn tất (COMPLETED)</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setConfirmingPayment(null)}
                                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Khối tóm tắt giao dịch */}
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Mã giao dịch:</span>
                                    <span className="font-mono font-bold text-slate-800">#{confirmingPayment.transaction_id || confirmingPayment.id}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Khách hàng / Đơn:</span>
                                    <span className="font-bold text-slate-900">{confirmingPayment.guest_name || confirmingPayment.company_name || 'Khách vãng lai'} ({confirmingPayment.booking_code || confirmingPayment.group_booking_code || '—'})</span>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                                    <span className="font-bold text-slate-700">Số tiền cần xác nhận:</span>
                                    <span className="font-mono font-black text-emerald-600 text-sm">{formatVND(confirmingPayment.amount)}</span>
                                </div>
                            </div>

                            {/* Phương thức thực nhận */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Hình thức tiền đã vào quỹ / tài khoản
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setConfirmPaymentMethod('TRANSFER')}
                                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer text-xs font-semibold ${
                                            confirmPaymentMethod === 'TRANSFER'
                                                ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        💳 Đã chuyển VietQR
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmPaymentMethod('CASH')}
                                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer text-xs font-semibold ${
                                            confirmPaymentMethod === 'CASH'
                                                ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        💵 Đã thu tiền mặt
                                    </button>
                                </div>
                            </div>

                            {/* Ghi chú xác nhận */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Ghi chú đối soát (tùy chọn)
                                </label>
                                <input
                                    type="text"
                                    value={confirmNote}
                                    onChange={(e) => setConfirmNote(e.target.value)}
                                    placeholder="VD: Đã kiểm tra sao kê ngân hàng, Nhận tiền mặt tại quầy..."
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                                />
                            </div>

                            {/* Footer hành động */}
                            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setConfirmingPayment(null)}
                                    disabled={isConfirmingLoading}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                                >
                                    Đóng
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmPayment}
                                    disabled={isConfirmingLoading}
                                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                >
                                    {isConfirmingLoading ? 'Đang xác nhận...' : '✓ Xác nhận thu tiền'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================= */}
            {/* 6. TOAST THÔNG BÁO TỨC THÌ (FLOATING TOAST)                       */}
            {/* ================================================================= */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-bold animate-in slide-in-from-bottom-5 duration-200 ${
                    toast.type === 'success'
                        ? 'bg-slate-900 text-white border border-emerald-500/30 shadow-emerald-950/20'
                        : 'bg-rose-600 text-white shadow-rose-950/20'
                }`}>
                    <span>{toast.type === 'success' ? '✅' : '⚠️'}</span>
                    <span>{toast.message}</span>
                </div>
            )}

            {/* ================================================================= */}
            {/* 7. LOGIC TÁI SỬ DỤNG: GẮN COMPONENT HÓA ĐƠN CÓ SẴN CỦA BẠN        */}
            {/* ================================================================= */}
            {selectedPayment && (
                <HotelInvoiceModal
                    booking={
                        selectedPayment.is_group
                            ? {
                                ...(selectedPayment.booking_details || {}),
                                id: selectedPayment.group_booking_id || selectedPayment.booking_details?.id,
                                is_group_master: true,
                                is_group_booking: true,
                                booking_code: selectedPayment.group_booking_code || selectedPayment.booking_details?.booking_code || selectedPayment.booking_details?.group_code,
                                group_code: selectedPayment.group_booking_code || selectedPayment.booking_details?.group_code,
                                group_name: selectedPayment.booking_details?.group_name || selectedPayment.company_name,
                                customer_name: selectedPayment.guest_name || selectedPayment.booking_details?.customer_name || selectedPayment.booking_details?.leader_name,
                                guest_name: selectedPayment.guest_name || selectedPayment.booking_details?.guest_name || selectedPayment.booking_details?.leader_name,
                                guest_phone: selectedPayment.guest_phone || selectedPayment.booking_details?.guest_phone || selectedPayment.booking_details?.leader_phone,
                                customer_type: 'CORPORATE',
                                company_name: selectedPayment.company_name || selectedPayment.booking_details?.company_name,
                                company_tax_code: selectedPayment.booking_details?.company_tax_code,
                                company_address: selectedPayment.booking_details?.company_address,
                                total_rooms: selectedPayment.booking_details?.total_rooms || selectedPayment.booking_details?.sub_bookings?.length,
                                sub_bookings: selectedPayment.booking_details?.sub_bookings || [],
                                billing_type: selectedPayment.booking_details?.billing_type || 'ALL_INCLUSIVE',
                                is_all_inclusive: Boolean(selectedPayment.booking_details?.billing_type === 'ALL_INCLUSIVE' || selectedPayment.booking_details?.is_all_inclusive),
                                deposit_amount: selectedPayment.booking_details?.deposit_amount,
                                is_deposit_paid: selectedPayment.booking_details?.is_deposit_paid ?? true,
                                status: selectedPayment.booking_details?.status || (selectedPayment.payment_status === 'COMPLETED' ? 'checked_out' : 'tentative'),
                                total_amount: selectedPayment.booking_details?.total_amount,
                                room_amount: selectedPayment.booking_details?.room_amount || selectedPayment.booking_details?.total_amount,
                                payment_method: selectedPayment.payment_method ? (
                                    selectedPayment.payment_method === 'TRANSFER' ? 'Chuyển khoản VietQR' :
                                    selectedPayment.payment_method === 'CASH' ? 'Tiền mặt (Tại quầy lễ tân)' :
                                    'Hợp đồng Doanh nghiệp B2B (VietQR / Chuyển khoản)'
                                ) : 'Hợp đồng Doanh nghiệp B2B (VietQR / Chuyển khoản)'
                            }
                            : (selectedPayment.booking_details || selectedPayment.booking || {
                                id: selectedPayment.booking_id,
                                booking_code: selectedPayment.booking_code || (selectedPayment.transaction_id ? selectedPayment.transaction_id.replace('TXN-', '') : ''),
                                customer_name: selectedPayment.guest_name,
                                guest_name: selectedPayment.guest_name,
                                guest_phone: selectedPayment.guest_phone,
                                customer_type: 'MEMBER',
                                company_name: selectedPayment.company_name,
                                room_number: selectedPayment.room_number,
                                guest: { get_full_name: selectedPayment.guest_name },
                                total_amount: selectedPayment.amount,
                                room_amount: selectedPayment.amount,
                                status: selectedPayment.payment_status === 'COMPLETED' ? 'paid' : 'pending',
                                payment_method: selectedPayment.payment_method
                            })
                    }
                    payment={selectedPayment}
                    paymentMethod={selectedPayment.payment_method}
                    onClose={() => setSelectedPayment(null)}
                />
            )}

            {/* ================================================================= */}
            {/* 8. CÁC MODAL QUẢN LÝ CA LÀM VIỆC & BÀN GIAO QUỸ (GIAI ĐOẠN 3)     */}
            {/* ================================================================= */}

            {/* Modal Mở ca làm việc */}
            <OpenShiftModal
                isOpen={isOpenShiftModalOpen}
                onClose={() => setIsOpenShiftModalOpen(false)}
                onShiftOpened={(newShift) => {
                    setActiveShift(newShift);
                    showToast('success', `Đã mở ca làm việc #${newShift.shift_code} thành công!`);
                }}
            />

            {/* Modal Kết ca làm việc & Kiểm đếm quỹ */}
            <CloseShiftModal
                isOpen={isCloseShiftModalOpen}
                shift={selectedClosingShift || activeShift}
                onClose={() => {
                    setIsCloseShiftModalOpen(false);
                    setSelectedClosingShift(null);
                }}
                onShiftClosed={(closedShift) => {
                    setActiveShift(null);
                    showToast('success', `Đã kết ca #${closedShift.shift_code} và bàn giao quỹ thành công!`);
                    setSelectedZReportShiftId(closedShift.id);
                }}
            />

            {/* Modal Báo cáo Z-Report & In ấn */}
            {selectedZReportShiftId && (
                <ShiftZReportModal
                    shiftId={selectedZReportShiftId}
                    onClose={() => setSelectedZReportShiftId(null)}
                />
            )}

            {/* Modal Lập Phiếu Chi Tiền Mặt / Hoàn Cọc */}
            <CreateCashOutModal
                isOpen={isCashOutOpen}
                onClose={() => setIsCashOutOpen(false)}
                activeShift={activeShift}
                onCashOutCreated={(voucher) => {
                    fetchPayments();
                    fetchCurrentShift();
                    showToast('success', `Đã lập phiếu chi #${voucher.voucher_code} (${formatVND(voucher.amount)}) thành công!`);
                }}
            />
        </div>
    );
}
