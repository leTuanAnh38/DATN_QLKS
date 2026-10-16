import React, { useState, useEffect, useMemo } from 'react';
import { bookingService } from '../../../services/bookingService';
import CreateGroupModal from '../modals/CreateGroupModal';
import GroupDetailModal from '../modals/GroupDetailModal';
import HotelInvoiceModal from '../modals/HotelInvoiceModal';
import Pagination from '../../common/Pagination';

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

export default function GroupBookingSection({ onOpenCreateModal }) {
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
            {/* TOOLBAR & BUTTONS */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xl shrink-0">
                        🏢
                    </div>
                    <div>
                        <h3 className="font-serif text-lg font-bold text-slate-900">
                            Danh Sách Đoàn Lưu Trú & Hợp Đồng B2B
                        </h3>
                        <p className="text-xs text-slate-500">
                            Quản lý các đoàn du lịch, hội thảo M.I.C.E và khách hàng doanh nghiệp ký hợp đồng.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={fetchGroups}
                        className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                        title="Tải lại danh sách"
                    >
                        🔄
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/25 transition flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                        <span>+ Tạo Đặt Phòng Theo Đoàn</span>
                    </button>
                </div>
            </div>

            {/* QUICK STATS */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div
                    onClick={() => setStatusFilter('all')}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                        statusFilter === 'all' ? 'bg-indigo-50 text-indigo-900 border-indigo-300 ring-1 ring-indigo-200 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">TỔNG SỐ ĐOÀN</span>
                    <div className="text-xl font-black mt-1 text-slate-900">{stats.total}</div>
                </div>

                <div
                    onClick={() => setStatusFilter('checked_in')}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                        statusFilter === 'checked_in' ? 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-1 ring-emerald-200 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">ĐANG Ở (IN-HOUSE)</span>
                    <div className="text-xl font-black mt-1 text-emerald-700">{stats.in_house}</div>
                </div>

                <div
                    onClick={() => setStatusFilter('confirmed')}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                        statusFilter === 'confirmed' ? 'bg-blue-50 text-blue-900 border-blue-300 ring-1 ring-blue-200 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">ĐÃ XÁC NHẬN / ĐÃ CỌC</span>
                    <div className="text-xl font-black mt-1 text-blue-700">{stats.confirmed}</div>
                </div>

                <div
                    onClick={() => setStatusFilter('tentative')}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                        statusFilter === 'tentative' ? 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-200 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">CHỜ ĐẶT CỌC</span>
                    <div className="text-xl font-black mt-1 text-amber-700">{stats.tentative}</div>
                </div>

                <div
                    onClick={() => setStatusFilter('completed')}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                        statusFilter === 'completed' ? 'bg-purple-50 text-purple-900 border-purple-300 ring-1 ring-purple-200 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">ĐÃ HOÀN THÀNH</span>
                    <div className="text-xl font-black mt-1 text-purple-700">{stats.completed}</div>
                </div>
            </div>

            {/* SEARCH BAR */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center gap-3">
                <span className="text-slate-400 pl-2">🔍</span>
                <input
                    type="text"
                    placeholder="Tìm theo Mã đoàn (GRP-...), Tên đoàn, Tên công ty, Trưởng đoàn, SĐT..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                />
                {searchKeyword && (
                    <button
                        type="button"
                        onClick={() => setSearchKeyword('')}
                        className="text-xs text-slate-400 hover:text-slate-600 pr-2"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* LIST OF GROUPS */}
            {isLoading ? (
                <div className="py-20 text-center space-y-3 bg-white rounded-3xl border border-slate-200">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs text-slate-500 font-semibold">Đang tải danh sách các đoàn khách...</p>
                </div>
            ) : filteredGroups.length === 0 ? (
                <div className="py-16 text-center space-y-3 bg-white rounded-3xl border border-slate-200 p-8">
                    <div className="text-4xl">🏢</div>
                    <h4 className="font-bold text-slate-800 text-sm">Chưa có đơn đặt đoàn nào phù hợp</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Bấm nút <strong>"+ Tạo Đặt Phòng Theo Đoàn"</strong> để bắt đầu tiếp nhận và phân bổ phòng cho đoàn khách.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        {paginatedGroups.map((group) => {
                            const partner = group.corporate_partner_details;
                            const isCheckedIn = group.status === 'checked_in';
                            const isCompleted = ['checked_out', 'completed'].includes(group.status);

                            return (
                                <div
                                    key={group.id}
                                    className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition space-y-4"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-start sm:items-center gap-3">
                                            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xl shrink-0 font-bold text-indigo-700">
                                                🏢
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                                                        #{group.group_code}
                                                    </span>
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                                                        isCheckedIn
                                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                            : isCompleted
                                                            ? 'bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs'
                                                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                                                    }`}>
                                                        <span>{isCompleted ? '✓' : isCheckedIn ? '🔑' : '📋'}</span>
                                                        <span>{isCompleted ? 'ĐÃ HOÀN THÀNH & QUYẾT TOÁN' : (group.status_display || group.status)}</span>
                                                    </span>
                                                    {partner && (
                                                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 text-[11px] font-bold border border-purple-200">
                                                            🏢 {partner.company_name} (-{partner.discount_percent}%)
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className="font-bold text-slate-900 text-base mt-1">
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
                                                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                                title="In hóa đơn thanh toán cho toàn bộ đoàn"
                                            >
                                                <span>🖨️ In Hóa Đơn</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedGroup(group)}
                                                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition cursor-pointer"
                                            >
                                                Chi tiết & Phân phòng →
                                            </button>
                                        </div>
                                    </div>

                                    {/* Details bar */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
                                        <div>
                                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Người phụ trách / Trưởng đoàn</span>
                                            <strong className="text-slate-800 block truncate">{group.leader_name}</strong>
                                            <span className="text-slate-500 text-[11px]">📞 {group.leader_phone}</span>
                                        </div>

                                        <div>
                                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Quy mô lưu trú</span>
                                            <strong className="text-slate-800">{group.total_rooms} phòng • {group.nights} đêm</strong>
                                            <span className="text-slate-500 block text-[11px]">
                                                {formatDate(group.check_in_date)} - {formatDate(group.check_out_date)}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Tổng tiền hợp đồng</span>
                                            <strong className="text-indigo-700 font-black text-sm block">{formatCurrency(group.total_amount)}</strong>
                                            <span className="text-slate-500 text-[11px]">Cọc: {formatCurrency(group.deposit_amount)}</span>
                                        </div>

                                        <div>
                                            <span className="text-slate-400 block text-[10px] uppercase font-bold">
                                                {isCompleted ? 'Quyết toán hợp đồng' : 'Tình trạng cọc'}
                                            </span>
                                            {isCompleted ? (
                                                <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                                    ✓ Đã quyết toán 100%
                                                </span>
                                            ) : (
                                                <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                                                    group.is_deposit_paid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {group.is_deposit_paid ? '✓ Đã thanh toán cọc' : '⏳ Chờ thanh toán cọc'}
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
}
