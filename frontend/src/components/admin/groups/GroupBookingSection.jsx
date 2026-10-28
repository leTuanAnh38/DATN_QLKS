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
    TrendingUp
} from 'lucide-react';
import { bookingService } from '../../../services/bookingService';
import CreateGroupModal from '../modals/CreateGroupModal';
import GroupDetailModal from '../modals/GroupDetailModal';
import HotelInvoiceModal from '../modals/HotelInvoiceModal';
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

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [invoiceBooking, setInvoiceBooking] = useState(null);
    const [isPreparingInvoice, setIsPreparingInvoice] = useState(false);

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

    // Filter by keyword locally
    const filteredGroups = useMemo(() => {
        if (!searchKeyword.trim()) return groups;
        const kw = searchKeyword.toLowerCase();
        return groups.filter((g) =>
            (g.group_code || '').toLowerCase().includes(kw) ||
            (g.group_name || '').toLowerCase().includes(kw) ||
            (g.leader_name || '').toLowerCase().includes(kw) ||
            (g.leader_phone || '').toLowerCase().includes(kw) ||
            (g.corporate_partner_details?.company_name || '').toLowerCase().includes(kw)
        );
    }, [groups, searchKeyword]);

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
    }, [searchKeyword, statusFilter]);

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

            {/* SEARCH BAR */}
            <div className="bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition-all">
                <Search className="w-4 h-4 text-indigo-500 ml-2.5 shrink-0" />
                <input
                    type="text"
                    placeholder="Tìm theo Mã đoàn (GRP-...), Tên đoàn, Tên công ty đối tác, Trưởng đoàn, Số điện thoại..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-medium"
                />
                <div className="flex items-center gap-2 pr-2 shrink-0">
                    <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        {filteredGroups.length} đoàn
                    </span>
                    {searchKeyword && (
                        <button
                            type="button"
                            onClick={() => setSearchKeyword('')}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            title="Xóa tìm kiếm"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
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
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        {paginatedGroups.map((group) => {
                            const partner = group.corporate_partner_details;
                            const isCheckedIn = group.status === 'checked_in';
                            const isCompleted = ['checked_out', 'completed'].includes(group.status);
                            const isCancelled = group.status === 'cancelled';
                            const isConfirmed = group.status === 'confirmed';
                            const isTentative = group.status === 'tentative';

                            return (
                                <div
                                    key={group.id}
                                    className="bg-white p-5 rounded-3xl border border-slate-200/80 hover:border-indigo-300 hover:shadow-lg transition-all duration-200 space-y-4 group"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-start sm:items-center gap-3.5">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100/70 border border-indigo-200/70 flex items-center justify-center text-indigo-600 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                                                <Building2 className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50/80 px-2.5 py-0.5 rounded-lg border border-indigo-200/80 shadow-2xs">
                                                        #{group.group_code}
                                                    </span>

                                                    {/* Trạng thái đoàn với icon SVG sắc nét */}
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border shadow-2xs ${
                                                        isCancelled
                                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                            : isCheckedIn
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : isCompleted
                                                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                            : isConfirmed
                                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                    }`}>
                                                        {isCancelled && <XCircle className="w-3 h-3" />}
                                                        {isCheckedIn && <Key className="w-3 h-3" />}
                                                        {isCompleted && <ShieldCheck className="w-3 h-3" />}
                                                        {isConfirmed && <CheckCircle2 className="w-3 h-3" />}
                                                        {isTentative && <Clock className="w-3 h-3" />}
                                                        <span>
                                                            {isCancelled
                                                                ? 'ĐÃ HỦY ĐOÀN'
                                                                : isCheckedIn
                                                                ? 'ĐANG Ở (IN-HOUSE)'
                                                                : isCompleted
                                                                ? 'HOÀN TẤT & QUYẾT TOÁN'
                                                                : (group.status_display || group.status)}
                                                        </span>
                                                    </span>

                                                    {partner && (
                                                        <span className="px-2.5 py-0.5 rounded-lg bg-purple-50 text-purple-800 text-[11px] font-bold border border-purple-200/80 flex items-center gap-1.5 shadow-2xs">
                                                            <Briefcase className="w-3 h-3 text-purple-600" />
                                                            <span>{partner.company_name}</span>
                                                            <span className="px-1.5 py-0.2 rounded bg-purple-200/60 text-purple-950 text-[10px] font-black">
                                                                -{partner.discount_percent}%
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
                                                title="In hóa đơn thanh toán cho toàn bộ đoàn"
                                            >
                                                <Printer className="w-3.5 h-3.5 text-slate-500 group-hover/btn:text-indigo-600 transition-colors" />
                                                <span>In Hóa Đơn</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedGroup(group)}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow-indigo-500/25 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                            >
                                                <span>Chi tiết & Phân phòng</span>
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Details bar - 4 Cột hiển thị sắc nét */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-3.5 border-t border-slate-100 text-xs">
                                        <div className="space-y-0.5">
                                            <span className="text-slate-400 block text-[10px] uppercase font-extrabold tracking-wider">
                                                Trưởng đoàn / Đại diện
                                            </span>
                                            <div className="flex items-center gap-1 text-slate-900 font-bold truncate">
                                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="truncate">{group.leader_name}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-slate-500 text-[11px] font-medium">
                                                <Phone className="w-3 h-3 text-indigo-500 shrink-0" />
                                                <span>{group.leader_phone}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-0.5">
                                            <span className="text-slate-400 block text-[10px] uppercase font-extrabold tracking-wider">
                                                Quy mô & Lưu trú
                                            </span>
                                            <div className="flex items-center gap-1 text-slate-900 font-bold">
                                                <BedDouble className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                                <span>{group.total_rooms} phòng • {group.nights} đêm</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-slate-500 text-[11px] font-medium">
                                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                                <span>{formatDate(group.check_in_date)} → {formatDate(group.check_out_date)}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-0.5">
                                            <span className="text-slate-400 block text-[10px] uppercase font-extrabold tracking-wider">
                                                Tổng tiền hợp đồng
                                            </span>
                                            <div className="text-indigo-700 font-black text-sm whitespace-nowrap">
                                                {formatCurrency(group.total_amount)}
                                            </div>
                                            <span className="text-slate-500 text-[11px] font-medium block">
                                                Cọc: <strong className="text-slate-700">{formatCurrency(group.deposit_amount)}</strong>
                                            </span>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-slate-400 block text-[10px] uppercase font-extrabold tracking-wider">
                                                {isCompleted ? 'Quyết toán hợp đồng' : (group.is_deposit_paid && Number(group.deposit_amount || 0) >= Number(group.total_amount || 0) && Number(group.total_amount || 0) > 0 ? 'Thanh toán' : 'Tình trạng cọc')}
                                            </span>
                                            {isCompleted ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs">
                                                    <Check className="w-3 h-3 text-purple-600 stroke-[3]" />
                                                    <span>Đã quyết toán 100%</span>
                                                </span>
                                            ) : (
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border shadow-2xs ${
                                                    group.is_deposit_paid
                                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                                }`}>
                                                    {group.is_deposit_paid && Number(group.deposit_amount || 0) >= Number(group.total_amount || 0) && Number(group.total_amount || 0) > 0 ? (
                                                        <>
                                                            <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                                            <span>Đã thanh toán 100%</span>
                                                        </>
                                                    ) : group.is_deposit_paid ? (
                                                        <>
                                                            <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                                            <span>Đã thanh toán cọc</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Clock className="w-3 h-3 text-amber-600" />
                                                            <span>Chờ thanh toán cọc</span>
                                                        </>
                                                    )}
                                                </span>
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
