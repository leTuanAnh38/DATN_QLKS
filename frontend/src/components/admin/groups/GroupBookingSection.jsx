import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
    Building2,
    Users,
    BedDouble,
    CheckCircle2,
    Clock,
    ShieldCheck,
    RotateCw,
    Plus,
    Search,
    X,
    Printer,
    ArrowRight,
    Phone,
    User,
    Calendar,
    CreditCard,
    Briefcase,
    Check,
    Key,
    XCircle,
    FileText,
    TrendingUp,
    AlertCircle,
    Copy,
    LayoutGrid,
    LayoutList,
    Receipt,
    Mail,
    ChevronRight
} from 'lucide-react';
import { bookingService } from '../../../services/bookingService';
import CreateGroupModal from '../modals/group/CreateGroupModal';
import GroupDetailModal from '../modals/group/GroupDetailModal';
import HotelInvoiceModal from '../modals/shared/HotelInvoiceModal';
import Pagination from '../../common/Pagination';
import { useHasPermission } from '../../../utils/permission';

const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return `${num.toLocaleString('vi-VN')}đ`;
};

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

const GroupBookingSection = forwardRef(function GroupBookingSection({ onOpenCreateModal }, ref) {
    const canCreateBookings = useHasPermission('bookings', 'create');
    const [groups, setGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | 'this_week' | 'this_month'
    const [viewMode, setViewMode] = useState('card'); // 'card' | 'table'
    const [copiedCode, setCopiedCode] = useState(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [invoiceBooking, setInvoiceBooking] = useState(null);
    const [isPreparingInvoice, setIsPreparingInvoice] = useState(false);

    // Copy handler with feedback
    const handleCopyCode = (code, e) => {
        if (e) e.stopPropagation();
        if (!code) return;
        navigator.clipboard?.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    // Expose methods to parent component (BookingManagement)
    useImperativeHandle(ref, () => ({
        openCreateModal: () => setIsCreateModalOpen(true),
        refresh: async () => {
            await fetchGroups();
        },
        isLoading
    }), [isLoading]);

    // Fetch list of group bookings
    const fetchGroups = async () => {
        try {
            setIsLoading(true);
            const res = await bookingService.getGroupBookings({
                search: searchKeyword,
                status: statusFilter
            });
            if (res.success) {
                setGroups(res.data);
            }
        } catch (err) {
            console.error('Lỗi khi tải danh sách đoàn:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, [statusFilter]);

    // Filter by keyword and date locally
    const filteredGroups = useMemo(() => {
        let result = groups;

        if (searchKeyword.trim()) {
            const kw = searchKeyword.toLowerCase();
            result = result.filter((g) =>
                (g.group_code || '').toLowerCase().includes(kw) ||
                (g.group_name || '').toLowerCase().includes(kw) ||
                (g.leader_name || '').toLowerCase().includes(kw) ||
                (g.leader_phone || '').toLowerCase().includes(kw) ||
                (g.corporate_partner_details?.company_name || '').toLowerCase().includes(kw)
            );
        }

        if (dateFilter !== 'all') {
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];

            if (dateFilter === 'today') {
                result = result.filter((g) => {
                    const ci = (g.check_in_date || '').split('T')[0];
                    const co = (g.check_out_date || '').split('T')[0];
                    return ci === todayStr || co === todayStr || (ci <= todayStr && co >= todayStr);
                });
            } else if (dateFilter === 'this_week') {
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0, 0, 0, 0);
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 7);

                result = result.filter((g) => {
                    if (!g.check_in_date) return false;
                    const ci = new Date(g.check_in_date);
                    return ci >= startOfWeek && ci <= endOfWeek;
                });
            } else if (dateFilter === 'this_month') {
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();

                result = result.filter((g) => {
                    if (!g.check_in_date) return false;
                    const ci = new Date(g.check_in_date);
                    return ci.getMonth() === currentMonth && ci.getFullYear() === currentYear;
                });
            }
        }

        return result;
    }, [groups, searchKeyword, dateFilter]);

    // Pagination calculations
    const totalCount = filteredGroups.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    const paginatedGroups = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredGroups.slice(start, start + pageSize);
    }, [filteredGroups, currentPage, pageSize]);

    // Reset current page when filters or search change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchKeyword, statusFilter, dateFilter]);

    // Ensure currentPage is valid if totalPages shrinks
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    // Handler mở hóa đơn đoàn dùng chung HotelInvoiceModal
    const handleOpenInvoice = async (group) => {
        try {
            setIsPreparingInvoice(true);
            let detailGroup = group;
            try {
                const res = await bookingService.getGroupBookingDetail(group.id);
                if (res.success && res.data) {
                    detailGroup = res.data;
                }
            } catch (err) {
                console.warn('Dùng dữ liệu danh sách cho hóa đơn:', err);
            }

            const partner = detailGroup.corporate_partner_details || detailGroup.corporate_partner;
            const isCompleted = ['checked_out', 'completed'].includes(detailGroup.status);
            const totalAmount = Number(detailGroup.total_amount) || 0;
            const depositAmount = Number(detailGroup.deposit_amount) || 0;

            const mappedBooking = {
                ...detailGroup,
                id: detailGroup.id,
                is_group_master: true,
                booking_code: detailGroup.group_code,
                group_code: detailGroup.group_code,
                group_name: detailGroup.group_name,
                guest_name: detailGroup.leader_name,
                customer_name: detailGroup.leader_name,
                guest_phone: detailGroup.leader_phone,
                guest_email: detailGroup.leader_email,
                customer_type: 'CORPORATE',
                company_name: partner?.company_name || detailGroup.company_name || detailGroup.group_name,
                company_tax_code: partner?.tax_code || detailGroup.company_tax_code || '—',
                company_address: partner?.address || detailGroup.company_address || '—',
                room_name: detailGroup.group_name,
                room_number: `Đoàn ${detailGroup.total_rooms || (detailGroup.sub_bookings ? detailGroup.sub_bookings.length : 0)} phòng`,
                check_in_date: detailGroup.check_in_date,
                check_out_date: detailGroup.check_out_date,
                nights: detailGroup.nights || 1,
                total_amount: totalAmount,
                room_amount: totalAmount,
                grand_total_amount: totalAmount,
                deposit_amount: depositAmount,
                is_deposit_paid: Boolean(detailGroup.is_deposit_paid || isCompleted),
                status: detailGroup.status,
                is_paid: isCompleted,
                sub_bookings: detailGroup.sub_bookings || [],
                payment_method: 'Hợp đồng Doanh nghiệp B2B (VietQR / Chuyển khoản)',
                note: detailGroup.note || ''
            };

            setInvoiceBooking(mappedBooking);
        } catch (error) {
            console.error('Lỗi khi mở hóa đơn đoàn:', error);
        } finally {
            setIsPreparingInvoice(false);
        }
    };

    // Quick stats
    const stats = useMemo(() => {
        return {
            total: groups.length,
            in_house: groups.filter((g) => g.status === 'checked_in').length,
            tentative: groups.filter((g) => g.status === 'tentative').length,
            confirmed: groups.filter((g) => g.status === 'confirmed').length,
            completed: groups.filter((g) => ['checked_out', 'completed'].includes(g.status)).length
        };
    }, [groups]);

    // Helper tính toán các chỉ số chi tiết cho một đơn đoàn
    const getGroupMetrics = (group) => {
        const partner = group.corporate_partner_details;
        const subBookings = group.sub_bookings || [];
        const totalRooms = group.total_rooms || subBookings.length || 0;

        // Xếp phòng
        const assignedSubBookings = subBookings.filter(
            (b) => Boolean(b.room?.room_number || b.room_number || (b.room && typeof b.room !== 'object'))
        );
        let assignedCount = assignedSubBookings.length;
        if (assignedCount === 0 && group.rooms_summary) {
            const summaryValues = Object.values(group.rooms_summary);
            const summaryAssigned = summaryValues.reduce(
                (sum, item) => sum + (item.assigned_rooms?.length || 0),
                0
            );
            if (summaryAssigned > 0) assignedCount = summaryAssigned;
        }

        const assignedRoomNumbers = assignedSubBookings
            .map((b) => b.room?.room_number || b.room_number || (typeof b.room === 'string' ? b.room : ''))
            .filter(Boolean);

        // Tổng số khách (Pax)
        const totalGuests =
            subBookings.reduce(
                (sum, b) => sum + (Number(b.adults) || 1) + (Number(b.children) || 0),
                0
            ) || group.total_guests || null;

        // Trạng thái đơn
        const isCheckedIn = group.status === 'checked_in';
        const isCompleted = ['checked_out', 'completed'].includes(group.status);
        const isCancelled = group.status === 'cancelled';
        const isConfirmed = group.status === 'confirmed';
        const isTentative = group.status === 'tentative';

        // Tài chính & Công nợ
        const totalAmount = Number(group.total_amount) || 0;
        const depositAmount = Number(group.deposit_amount) || 0;
        const isDepositPaid = Boolean(group.is_deposit_paid || isCompleted);
        const remainingBalance = isCompleted
            ? 0
            : group.remaining_balance !== undefined
            ? Number(group.remaining_balance)
            : Math.max(0, totalAmount - (isDepositPaid ? depositAmount : 0));

        // Kiểm tra xem tên đoàn có chứa sẵn tên công ty không (tránh lặp)
        const isNameRedundant = Boolean(
            partner?.company_name &&
            group.group_name &&
            group.group_name.toLowerCase().includes(partner.company_name.toLowerCase())
        );

        return {
            partner,
            subBookings,
            totalRooms,
            assignedCount,
            assignedRoomNumbers,
            totalGuests,
            isCheckedIn,
            isCompleted,
            isCancelled,
            isConfirmed,
            isTentative,
            totalAmount,
            depositAmount,
            isDepositPaid,
            remainingBalance,
            isNameRedundant
        };
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* QUICK STATS - 5-STAR HOTEL KPI STYLE */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
                {/* 1. Tổng số đoàn */}
                <div
                    onClick={() => setStatusFilter('all')}
                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer group ${
                        statusFilter === 'all'
                            ? 'bg-gradient-to-b from-indigo-50/80 to-white text-indigo-950 border-indigo-300 ring-2 ring-indigo-500/20 shadow-sm'
                            : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-2xs'
                    }`}
                >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">TỔNG SỐ ĐOÀN</span>
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                            <Building2 className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 tracking-tight">{stats.total}</div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                        <span>Tất cả trạng thái</span>
                        <span className="font-bold text-indigo-600">100%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                        <div className="bg-indigo-600 h-1 rounded-full w-full"></div>
                    </div>
                </div>

                {/* 2. Đang ở (In-house) */}
                <div
                    onClick={() => setStatusFilter('checked_in')}
                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer group ${
                        statusFilter === 'checked_in'
                            ? 'bg-gradient-to-b from-emerald-50/80 to-white text-emerald-950 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm'
                            : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-2xs'
                    }`}
                >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">ĐANG Ở (IN-HOUSE)</span>
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                            <BedDouble className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-emerald-700 tracking-tight">{stats.in_house}</div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                        <span>Đang lưu trú</span>
                        <span className="font-bold text-emerald-600">
                            {stats.total > 0 ? Math.round((stats.in_house / stats.total) * 100) : 0}%
                        </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                        <div
                            className="bg-emerald-500 h-1 rounded-full transition-all duration-500"
                            style={{ width: `${stats.total > 0 ? (stats.in_house / stats.total) * 100 : 0}%` }}
                        ></div>
                    </div>
                </div>

                {/* 3. Đã xác nhận / Đã cọc */}
                <div
                    onClick={() => setStatusFilter('confirmed')}
                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer group ${
                        statusFilter === 'confirmed'
                            ? 'bg-gradient-to-b from-blue-50/80 to-white text-blue-950 border-blue-300 ring-2 ring-blue-500/20 shadow-sm'
                            : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-2xs'
                    }`}
                >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700">ĐÃ XÁC NHẬN</span>
                        <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-blue-700 tracking-tight">{stats.confirmed}</div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                        <span>Sẵn sàng check-in</span>
                        <span className="font-bold text-blue-600">
                            {stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0}%
                        </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                        <div
                            className="bg-blue-500 h-1 rounded-full transition-all duration-500"
                            style={{ width: `${stats.total > 0 ? (stats.confirmed / stats.total) * 100 : 0}%` }}
                        ></div>
                    </div>
                </div>

                {/* 4. Chờ đặt cọc */}
                <div
                    onClick={() => setStatusFilter('tentative')}
                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer group ${
                        statusFilter === 'tentative'
                            ? 'bg-gradient-to-b from-amber-50/80 to-white text-amber-950 border-amber-300 ring-2 ring-amber-500/20 shadow-sm'
                            : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-2xs'
                    }`}
                >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">CHỜ ĐẶT CỌC</span>
                        <div className="relative w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                            <Clock className="w-3.5 h-3.5" />
                            {stats.tentative > 0 && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                            )}
                        </div>
                    </div>
                    <div className="text-2xl font-black text-amber-700 tracking-tight">{stats.tentative}</div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                        <span>Cần theo dõi cọc</span>
                        <span className="font-bold text-amber-600">
                            {stats.total > 0 ? Math.round((stats.tentative / stats.total) * 100) : 0}%
                        </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                        <div
                            className="bg-amber-500 h-1 rounded-full transition-all duration-500"
                            style={{ width: `${stats.total > 0 ? (stats.tentative / stats.total) * 100 : 0}%` }}
                        ></div>
                    </div>
                </div>

                {/* 5. Đã hoàn thành */}
                <div
                    onClick={() => setStatusFilter('completed')}
                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer group ${
                        statusFilter === 'completed'
                            ? 'bg-gradient-to-b from-purple-50/80 to-white text-purple-950 border-purple-300 ring-2 ring-purple-500/20 shadow-sm'
                            : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-2xs'
                    }`}
                >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700">ĐÃ HOÀN TẤT</span>
                        <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                            <ShieldCheck className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-purple-700 tracking-tight">{stats.completed}</div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                        <span>Đã quyết toán</span>
                        <span className="font-bold text-purple-600">
                            {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                        </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1 mt-1 overflow-hidden">
                        <div
                            className="bg-purple-500 h-1 rounded-full transition-all duration-500"
                            style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* TOOLBAR: SEARCH, DATE FILTER, VIEW MODE */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
                {/* Search Input */}
                <div className="flex-1 flex items-center gap-2.5 px-2 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200/80 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 focus-within:bg-white transition-all">
                    <Search className="w-4 h-4 text-indigo-500 shrink-0" />
                    <input
                        type="text"
                        placeholder="Tìm theo Mã đoàn (GRP-...), Tên đoàn, Tên công ty đối tác, Trưởng đoàn, SĐT..."
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        className="w-full py-2 bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-medium"
                    />
                    {searchKeyword && (
                        <button
                            type="button"
                            onClick={() => setSearchKeyword('')}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
                            title="Xóa tìm kiếm"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Right controls: Date filter & View mode */}
                <div className="flex items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 justify-between lg:justify-end shrink-0 flex-wrap">
                    {/* Quick Date Filters */}
                    <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/80 text-[11px] font-semibold text-slate-600">
                        {[
                            { key: 'all', label: 'Tất cả ngày' },
                            { key: 'today', label: 'Hôm nay' },
                            { key: 'this_week', label: 'Tuần này' },
                            { key: 'this_month', label: 'Tháng này' }
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setDateFilter(tab.key)}
                                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                    dateFilter === tab.key
                                        ? 'bg-white text-indigo-700 shadow-2xs font-black'
                                        : 'hover:text-slate-900 text-slate-600'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Counter */}
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200/60 shrink-0">
                        {filteredGroups.length} đoàn
                    </span>

                    {/* View mode toggle */}
                    <div className="flex items-center bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/80 shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewMode('card')}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                viewMode === 'card'
                                    ? 'bg-white text-indigo-600 shadow-2xs'
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                            title="Chế độ xem dạng Thẻ"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                viewMode === 'table'
                                    ? 'bg-white text-indigo-600 shadow-2xs'
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                            title="Chế độ xem dạng Bảng"
                        >
                            <LayoutList className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* LIST OF GROUPS */}
            {isLoading ? (
                <div className="py-20 text-center space-y-3 bg-white rounded-3xl border border-slate-200/90 shadow-2xs">
                    <div className="w-9 h-9 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs text-slate-500 font-semibold">Đang tải danh sách hợp đồng khách đoàn...</p>
                </div>
            ) : filteredGroups.length === 0 ? (
                <div className="py-16 text-center space-y-3 bg-white rounded-3xl border border-slate-200/90 p-8 shadow-2xs">
                    <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 mx-auto shadow-inner">
                        <Building2 className="w-8 h-8" />
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm">Chưa có đơn đặt đoàn nào phù hợp</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                        {canCreateBookings
                            ? <>Bấm nút <strong>"+ Tạo Đặt Phòng Theo Đoàn"</strong> để bắt đầu tiếp nhận và phân bổ phòng cho đoàn khách.</>
                            : 'Hiện tại chưa có đơn đặt đoàn nào được ghi nhận trong hệ thống.'}
                    </p>
                </div>
            ) : viewMode === 'table' ? (
                /* CHẾ ĐỘ XEM BẢNG (TABLE VIEW) CHO CAO ĐIỂM / TRA CỨU NHANH */
                <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-700 border-collapse">
                            <thead className="bg-slate-50/90 border-b border-slate-200 text-[10px] uppercase font-black tracking-wider text-slate-500">
                                <tr>
                                    <th className="py-3.5 px-4">Mã & Tên Đoàn</th>
                                    <th className="py-3.5 px-4">Đối Tác B2B</th>
                                    <th className="py-3.5 px-4">Trưởng Đoàn</th>
                                    <th className="py-3.5 px-4">Quy Mô & Lưu Trú</th>
                                    <th className="py-3.5 px-4">Phân Phòng</th>
                                    <th className="py-3.5 px-4">Hợp Đồng & Cọc</th>
                                    <th className="py-3.5 px-4">Công Nợ</th>
                                    <th className="py-3.5 px-4">Trạng Thái</th>
                                    <th className="py-3.5 px-4 text-right">Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {paginatedGroups.map((group) => {
                                    const m = getGroupMetrics(group);
                                    return (
                                        <tr
                                            key={group.id}
                                            className="hover:bg-indigo-50/30 transition-colors group cursor-pointer"
                                            onClick={() => setSelectedGroup(group)}
                                        >
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-[11px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/80">
                                                        #{group.group_code}
                                                    </span>
                                                </div>
                                                <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors mt-0.5 max-w-[220px] truncate" title={group.group_name}>
                                                    {group.group_name}
                                                </div>
                                            </td>

                                            <td className="py-3 px-4">
                                                {m.partner ? (
                                                    <div className="space-y-0.5">
                                                        <div className="font-bold text-purple-900 text-[11px] max-w-[160px] truncate" title={m.partner.company_name}>
                                                            {m.partner.company_name}
                                                        </div>
                                                        <span className="inline-block px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 text-[9px] font-black">
                                                            -{m.partner.discount_percent}% B2B
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-[11px]">Đoàn tự do</span>
                                                )}
                                            </td>

                                            <td className="py-3 px-4">
                                                <div className="font-bold text-slate-800">{group.leader_name}</div>
                                                <div className="text-[11px] text-slate-500 font-mono">{group.leader_phone}</div>
                                            </td>

                                            <td className="py-3 px-4">
                                                <div className="font-bold text-slate-900">
                                                    {m.totalRooms} phòng {m.totalGuests ? `• ${m.totalGuests} khách` : ''}
                                                </div>
                                                <div className="text-[11px] text-slate-500">
                                                    {formatDate(group.check_in_date)} → {formatDate(group.check_out_date)} ({group.nights} đêm)
                                                </div>
                                            </td>

                                            <td className="py-3 px-4">
                                                {m.totalRooms > 0 && m.assignedCount === 0 ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                                        <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                                        <span>Chưa phân ({m.assignedCount}/{m.totalRooms})</span>
                                                    </span>
                                                ) : m.totalRooms > 0 && m.assignedCount < m.totalRooms ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                                        <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                                        <span>Đã phân {m.assignedCount}/{m.totalRooms}</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                                        <span>Đã đủ {m.assignedCount}/{m.totalRooms}</span>
                                                    </span>
                                                )}
                                            </td>

                                            <td className="py-3 px-4">
                                                <div className="font-black text-indigo-700">{formatCurrency(m.totalAmount)}</div>
                                                <div className="text-[10px] text-slate-500">Cọc: {formatCurrency(m.depositAmount)}</div>
                                            </td>

                                            <td className="py-3 px-4">
                                                {m.isCompleted ? (
                                                    <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                                        Đã quyết toán
                                                    </span>
                                                ) : m.remainingBalance > 0 ? (
                                                    <div className="text-[11px] font-black text-rose-600">
                                                        Còn nợ: {formatCurrency(m.remainingBalance)}
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                        Đã thu 100%
                                                    </span>
                                                )}
                                            </td>

                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 border shadow-2xs ${
                                                    m.isCancelled
                                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                        : m.isCheckedIn
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : m.isCompleted
                                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                        : m.isConfirmed
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                    {m.isCancelled
                                                        ? 'Đã hủy'
                                                        : m.isCheckedIn
                                                        ? 'Đang ở'
                                                        : m.isCompleted
                                                        ? 'Hoàn tất'
                                                        : (group.status_display || group.status)}
                                                </span>
                                            </td>

                                            <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenInvoice(group)}
                                                        disabled={isPreparingInvoice}
                                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-indigo-600 transition cursor-pointer"
                                                        title="In chứng từ / hóa đơn"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedGroup(group)}
                                                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition cursor-pointer flex items-center gap-1"
                                                    >
                                                        <span>Chi tiết</span>
                                                        <ArrowRight className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* CHẾ ĐỘ XEM THẺ (CARD VIEW) - HIỆN ĐẠI & TỐI ƯU CỰC KỲ CHI TIẾT */
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        {paginatedGroups.map((group) => {
                            const m = getGroupMetrics(group);

                            return (
                                <div
                                    key={group.id}
                                    className="bg-white p-5 rounded-3xl border border-slate-200/80 hover:border-indigo-300 hover:shadow-lg transition-all duration-200 space-y-4 group"
                                >
                                    {/* CARD HEADER */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-start sm:items-center gap-3.5">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100/70 border border-indigo-200/70 flex items-center justify-center text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                                                <Building2 className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {/* Mã đoàn có nút sao chép nhanh */}
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleCopyCode(group.group_code, e)}
                                                            className="group/code font-mono text-xs font-black text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100/90 px-2.5 py-0.5 rounded-lg border border-indigo-200/80 shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                                                            title="Nhấp để sao chép mã đoàn"
                                                        >
                                                            <span>#{group.group_code}</span>
                                                            <Copy className="w-3 h-3 text-indigo-400 group-hover/code:text-indigo-600 transition-colors" />
                                                        </button>
                                                        {copiedCode === group.group_code && (
                                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 animate-in fade-in duration-200">
                                                                Đã sao chép!
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Trạng thái đoàn */}
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border shadow-2xs ${
                                                        m.isCancelled
                                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                            : m.isCheckedIn
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : m.isCompleted
                                                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                            : m.isConfirmed
                                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                    }`}>
                                                        {m.isCancelled && <XCircle className="w-3 h-3" />}
                                                        {m.isCheckedIn && <Key className="w-3 h-3" />}
                                                        {m.isCompleted && <ShieldCheck className="w-3 h-3" />}
                                                        {m.isConfirmed && <CheckCircle2 className="w-3 h-3" />}
                                                        {m.isTentative && <Clock className="w-3 h-3" />}
                                                        <span>
                                                            {m.isCancelled
                                                                ? 'ĐÃ HỦY ĐOÀN'
                                                                : m.isCheckedIn
                                                                ? 'ĐANG Ở (IN-HOUSE)'
                                                                : m.isCompleted
                                                                ? 'HOÀN TẤT & QUYẾT TOÁN'
                                                                : (group.status_display || group.status)}
                                                        </span>
                                                    </span>

                                                    {/* Badge đối tác Doanh nghiệp B2B (tinh chỉnh không lặp tên công ty nếu tiêu đề đã có) */}
                                                    {m.partner && (
                                                        <span className="px-2.5 py-0.5 rounded-lg bg-purple-50 text-purple-800 text-[11px] font-bold border border-purple-200/80 flex items-center gap-1.5 shadow-2xs">
                                                            <Briefcase className="w-3 h-3 text-purple-600 shrink-0" />
                                                            <span>
                                                                {m.isNameRedundant ? 'Đối tác B2B' : m.partner.company_name}
                                                            </span>
                                                            <span className="px-1.5 py-0.2 rounded bg-purple-200/60 text-purple-950 text-[10px] font-black">
                                                                -{m.partner.discount_percent}%
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>

                                                <h4 className="font-bold text-slate-900 text-base sm:text-lg mt-1 group-hover:text-indigo-600 transition-colors">
                                                    {group.group_name}
                                                </h4>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenInvoice(group)}
                                                disabled={isPreparingInvoice}
                                                className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 shadow-2xs group/btn"
                                                title="In chứng từ / hóa đơn đoàn"
                                            >
                                                <Printer className="w-3.5 h-3.5 text-slate-500 group-hover/btn:text-indigo-600 transition-colors" />
                                                <span>{m.isCompleted ? 'In Hóa Đơn' : 'In Phiếu Đặt Đoàn'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedGroup(group)}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow-indigo-500/25 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                            >
                                                <span>
                                                    {m.isCompleted
                                                        ? 'Xem Chi Tiết Đoàn'
                                                        : m.isCheckedIn
                                                        ? 'Quản Lý & Quyết Toán'
                                                        : 'Chi tiết & Phân phòng'}
                                                </span>
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* 4 CỘT THÔNG TIN CHI TIẾT - CHUẨN PMS 5 SAO */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-3.5 border-t border-slate-100 text-xs">
                                        {/* CỘT 1: ĐẠI DIỆN ĐOÀN */}
                                        <div className="space-y-1">
                                            <span className="text-slate-400 block text-[10px] uppercase font-extrabold tracking-wider">
                                                Trưởng đoàn / Đại diện
                                            </span>
                                            <div className="flex items-center gap-1.5 text-slate-900 font-bold truncate">
                                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="truncate">{group.leader_name}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
                                                <Phone className="w-3 h-3 text-indigo-500 shrink-0" />
                                                <a
                                                    href={`tel:${group.leader_phone}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="hover:text-indigo-600 transition-colors font-mono"
                                                >
                                                    {group.leader_phone}
                                                </a>
                                            </div>
                                            {group.leader_email && (
                                                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] truncate">
                                                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                                    <span className="truncate">{group.leader_email}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* CỘT 2: QUY MÔ & PHÂN BỔ PHÒNG */}
                                        <div className="space-y-1">
                                            <span className="text-slate-400 block text-[10px] uppercase font-extrabold tracking-wider">
                                                Quy mô & Phân bổ phòng
                                            </span>
                                            <div className="flex items-center gap-1.5 text-slate-900 font-bold flex-wrap">
                                                <BedDouble className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                                <span>{m.totalRooms} phòng</span>
                                                {m.totalGuests && (
                                                    <>
                                                        <span className="text-slate-300">•</span>
                                                        <span className="text-slate-700 flex items-center gap-0.5">
                                                            <Users className="w-3 h-3 text-slate-400" />
                                                            {m.totalGuests} khách
                                                        </span>
                                                    </>
                                                )}
                                                <span className="text-slate-300">•</span>
                                                <span className="text-slate-600">{group.nights} đêm</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-slate-500 text-[11px] font-medium">
                                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                                <span>{formatDate(group.check_in_date)} → {formatDate(group.check_out_date)}</span>
                                            </div>
                                            {/* Trạng thái phân phòng chi tiết */}
                                            <div className="pt-0.5">
                                                {m.totalRooms > 0 && m.assignedCount === 0 ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
                                                        <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                                        <span>Chưa phân phòng (0/{m.totalRooms})</span>
                                                    </span>
                                                ) : m.totalRooms > 0 && m.assignedCount < m.totalRooms ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
                                                        <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                                        <span>Đã xếp {m.assignedCount}/{m.totalRooms} phòng</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                                        <span>
                                                            Đã phân đủ {m.assignedCount}/{m.totalRooms} phòng
                                                            {m.assignedRoomNumbers.length > 0 && m.assignedRoomNumbers.length <= 4
                                                                ? ` (${m.assignedRoomNumbers.join(', ')})`
                                                                : ''}
                                                        </span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* CỘT 3: TÀI CHÍNH HỢP ĐỒNG */}
                                        <div className="space-y-1">
                                            <span className="text-slate-400 block text-[10px] uppercase font-extrabold tracking-wider">
                                                Tài chính hợp đồng
                                            </span>
                                            <div className="text-indigo-700 font-black text-sm whitespace-nowrap">
                                                {formatCurrency(m.totalAmount)}
                                            </div>
                                            <div className="text-slate-500 text-[11px] font-medium flex items-center gap-1 flex-wrap">
                                                <span>Cọc: <strong className="text-slate-700">{formatCurrency(m.depositAmount)}</strong></span>
                                                {m.totalAmount > 0 && (
                                                    <span className="text-slate-400 text-[10px]">
                                                        ({Math.round((m.depositAmount / m.totalAmount) * 100)}%)
                                                    </span>
                                                )}
                                            </div>
                                            {/* Gói thanh toán công ty */}
                                            <div className="pt-0.5">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                                    group.billing_type === 'ROOM_ONLY'
                                                        ? 'bg-slate-50 text-slate-700 border-slate-200'
                                                        : 'bg-indigo-50/80 text-indigo-700 border-indigo-200/70'
                                                }`}>
                                                    <Receipt className="w-2.5 h-2.5" />
                                                    <span>{group.billing_type === 'ROOM_ONLY' ? 'Chỉ tiền phòng' : 'Trọn gói All-Inclusive'}</span>
                                                </span>
                                            </div>
                                        </div>

                                        {/* CỘT 4: CÔNG NỢ & QUYẾT TOÁN */}
                                        <div className="space-y-1">
                                            <span className="text-slate-400 block text-[10px] uppercase font-extrabold tracking-wider">
                                                Công nợ & Quyết toán
                                            </span>
                                            {m.isCompleted ? (
                                                <>
                                                    <div className="text-emerald-700 font-black text-sm">
                                                        Còn lại: 0đ
                                                    </div>
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs">
                                                        <Check className="w-3 h-3 text-purple-600 stroke-[3]" />
                                                        <span>Đã quyết toán 100%</span>
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="text-xs font-bold">
                                                        {m.remainingBalance > 0 ? (
                                                            <span className="text-rose-600 font-extrabold flex items-center gap-1">
                                                                Còn nợ: {formatCurrency(m.remainingBalance)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                                                                Còn lại: 0đ
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border shadow-2xs ${
                                                            m.isDepositPaid
                                                                ? m.remainingBalance <= 0
                                                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                                    : 'bg-blue-50 text-blue-800 border-blue-200'
                                                                : 'bg-amber-50 text-amber-800 border-amber-200'
                                                        }`}>
                                                            {m.remainingBalance <= 0 ? (
                                                                <>
                                                                    <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                                                    <span>Đã thanh toán đủ</span>
                                                                </>
                                                            ) : m.isDepositPaid ? (
                                                                <>
                                                                    <Check className="w-3 h-3 text-blue-600 stroke-[3]" />
                                                                    <span>Đã cọc • Chờ tất toán</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Clock className="w-3 h-3 text-amber-600" />
                                                                    <span>Chờ thanh toán cọc</span>
                                                                </>
                                                            )}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Phân trang */}
                    {filteredGroups.length > 0 && (
                        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalCount={totalCount}
                                pageSize={pageSize}
                                pageSizeOptions={[5, 10, 15, 20]}
                                onPageChange={(page) => setCurrentPage(page)}
                                onPageSizeChange={(newSize) => {
                                    setPageSize(newSize);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* CREATE GROUP MODAL */}
            <CreateGroupModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={(newGroup) => {
                    setIsCreateModalOpen(false);
                    fetchGroups();
                }}
            />

            {/* GROUP DETAIL MODAL */}
            {selectedGroup && (
                <GroupDetailModal
                    group={selectedGroup}
                    isOpen={Boolean(selectedGroup)}
                    onClose={() => setSelectedGroup(null)}
                    onRefresh={(updatedGroup, shouldClose = false) => {
                        fetchGroups();
                        if (shouldClose) {
                            setSelectedGroup(null);
                        } else if (updatedGroup) {
                            setSelectedGroup(updatedGroup);
                        }
                    }}
                />
            )}

            {/* HOTEL INVOICE MODAL (DÙNG CHUNG CHO CẢ ĐOÀN KHÁCH B2B) */}
            {invoiceBooking && (
                <HotelInvoiceModal
                    booking={invoiceBooking}
                    onClose={() => setInvoiceBooking(null)}
                />
            )}
        </div>
    );
});

export default GroupBookingSection;
