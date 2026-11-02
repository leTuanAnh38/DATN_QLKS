import React, { useState, useEffect, useMemo } from 'react';
import {
    CalendarCheck,
    Building2,
    Search,
    X,
    Clock,
    BedDouble,
    Eye,
    RotateCw,
    Filter,
    DollarSign,
    CheckCircle2,
    Users,
    ArrowRight
} from 'lucide-react';
import { bookingService } from '../../../../services/bookingService';
import Pagination from '../../../common/Pagination';
import GroupDetailModal from '../group/GroupDetailModal';

// Helper định dạng ngày Việt Nam chuẩn DD/MM/YYYY
const formatDateVN = (dateStr) => {
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

export default function CorporatePartnerHistoryModal({
    isOpen,
    partner,
    onClose
}) {
    if (!isOpen || !partner) return null;

    const [bookings, setBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Phân trang nội bộ trong modal
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    // Modal chi tiết đơn đoàn
    const [selectedGroupForDetail, setSelectedGroupForDetail] = useState(null);

    // Tải danh sách đơn đoàn của đối tác từ backend
    const fetchHistory = async () => {
        setIsLoading(true);
        const res = await bookingService.getCorporatePartnerBookings(partner.id);
        if (res.success) {
            setBookings(res.data || []);
        } else {
            setBookings([]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (partner?.id) {
            fetchHistory();
            setCurrentPage(1);
            setSearchKeyword('');
            setStatusFilter('all');
        }
    }, [partner?.id]);

    // Lọc theo từ khóa tìm kiếm và trạng thái
    const filteredBookings = useMemo(() => {
        let result = bookings;

        // Lọc từ khóa
        if (searchKeyword.trim()) {
            const kw = searchKeyword.trim().toLowerCase();
            result = result.filter((b) =>
                (b.group_code && b.group_code.toLowerCase().includes(kw)) ||
                (b.group_name && b.group_name.toLowerCase().includes(kw)) ||
                (b.leader_name && b.leader_name.toLowerCase().includes(kw)) ||
                (b.leader_phone && b.leader_phone.toLowerCase().includes(kw))
            );
        }

        // Lọc trạng thái
        if (statusFilter !== 'all') {
            if (statusFilter === 'completed') {
                result = result.filter((b) => ['completed', 'checked_out'].includes(b.status));
            } else {
                result = result.filter((b) => b.status === statusFilter);
            }
        }

        return result;
    }, [bookings, searchKeyword, statusFilter]);

    // Phân trang dữ liệu đã lọc
    const totalCount = filteredBookings.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const paginatedBookings = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredBookings.slice(start, start + pageSize);
    }, [filteredBookings, currentPage, pageSize]);

    // Thống kê nhanh
    const totalRevenue = useMemo(() => {
        return bookings
            .filter((b) => b.status !== 'cancelled')
            .reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0);
    }, [bookings]);

    const totalRooms = useMemo(() => {
        return bookings
            .filter((b) => b.status !== 'cancelled')
            .reduce((sum, b) => sum + (parseInt(b.total_rooms, 10) || 0), 0);
    }, [bookings]);

    // Format phần trăm chiết khấu không thừa số .00
    const displayDiscount = parseFloat(partner.discount_percent) || 0;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl xl:max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header: Tone trắng trang nhã, không xuống dòng */}
                <div className="px-6 py-4.5 bg-white border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200/80 text-indigo-600 flex items-center justify-center shadow-xs shrink-0">
                            <CalendarCheck className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5">
                                <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight whitespace-nowrap">
                                    Lịch sử Đơn đặt Đoàn (MICE)
                                </h3>
                                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap shrink-0">
                                    #{partner.corporate_code}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                                Doanh nghiệp: <strong className="text-slate-800">{partner.company_name}</strong> • Chiết khấu hợp đồng: <strong className="text-emerald-600 font-bold">{displayDiscount}%</strong>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                        <button
                            type="button"
                            onClick={fetchHistory}
                            disabled={isLoading}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            title="Tải lại lịch sử"
                        >
                            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            title="Đóng modal"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* 3 Thẻ thống kê nhanh của đối tác */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng số đơn đoàn</p>
                            <p className="text-xl font-black text-slate-900 mt-0.5">
                                {isLoading ? '...' : bookings.length} <span className="text-xs font-normal text-slate-500">đoàn</span>
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Building2 className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng doanh thu B2B</p>
                            <p className="text-xl font-black text-indigo-600 mt-0.5">
                                {isLoading ? '...' : new Intl.NumberFormat('vi-VN').format(totalRevenue)} <span className="text-xs font-normal text-slate-500">đ</span>
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <DollarSign className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng phòng đã đặt</p>
                            <p className="text-xl font-black text-emerald-600 mt-0.5">
                                {isLoading ? '...' : totalRooms} <span className="text-xs font-normal text-slate-500">phòng</span>
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <BedDouble className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Thanh tìm kiếm & Bộ lọc trạng thái */}
                <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full sm:w-80">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchKeyword}
                            onChange={(e) => {
                                setSearchKeyword(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Tìm mã đoàn, tên đoàn, đại diện..."
                            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                        />
                        {searchKeyword && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchKeyword('');
                                    setCurrentPage(1);
                                }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Bộ lọc trạng thái */}
                    <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 text-xs font-semibold">
                        {[
                            { key: 'all', label: `Tất cả (${bookings.length})` },
                            { key: 'confirmed', label: 'Đã xác nhận' },
                            { key: 'checked_in', label: 'Đang ở' },
                            { key: 'completed', label: 'Hoàn tất' },
                            { key: 'cancelled', label: 'Đã hủy' }
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => {
                                    setStatusFilter(tab.key);
                                    setCurrentPage(1);
                                }}
                                className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap cursor-pointer text-xs ${
                                    statusFilter === tab.key
                                        ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Bảng danh sách đơn đoàn (Body) */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="py-16 text-center text-slate-400">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                <span className="text-xs">Đang tải lịch sử các đơn đặt đoàn...</span>
                            </div>
                        </div>
                    ) : filteredBookings.length === 0 ? (
                        <div className="py-14 text-center text-slate-400">
                            <CalendarCheck className="w-12 h-12 text-slate-300 mx-auto mb-2.5" />
                            <p className="font-semibold text-slate-700 text-sm">
                                {searchKeyword || statusFilter !== 'all'
                                    ? 'Không tìm thấy đơn đặt đoàn phù hợp với bộ lọc'
                                    : 'Chưa có đơn đặt phòng / đặt đoàn nào'}
                            </p>
                            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                                {searchKeyword || statusFilter !== 'all'
                                    ? 'Thử xóa từ khóa tìm kiếm hoặc chọn lọc trạng thái "Tất cả".'
                                    : `Đối tác ${partner.company_name} chưa phát sinh đơn đoàn nào trong hệ thống.`}
                            </p>
                        </div>
                    ) : (
                        <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-2xs">
                            <table className="w-full text-left text-xs whitespace-nowrap">
                                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                                    <tr>
                                        <th className="px-5 py-3.5 min-w-[260px] whitespace-normal">Mã & Tên đoàn</th>
                                        <th className="px-4 py-3.5 whitespace-nowrap min-w-[190px]">Thời gian lưu trú</th>
                                        <th className="px-4 py-3.5 text-center whitespace-nowrap min-w-[110px]">Quy mô</th>
                                        <th className="px-4 py-3.5 text-right whitespace-nowrap min-w-[160px]">Tổng tiền & Cọc</th>
                                        <th className="px-4 py-3.5 text-center whitespace-nowrap min-w-[130px]">Trạng thái</th>
                                        <th className="px-5 py-3.5 text-right whitespace-nowrap min-w-[100px]">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paginatedBookings.map((booking) => {
                                        const statusMap = {
                                            draft: { label: 'Chờ cọc', color: 'bg-slate-100 text-slate-700 border-slate-200' },
                                            confirmed: { label: 'Đã xác nhận', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                                            checked_in: { label: 'Đang lưu trú', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                                            checked_out: { label: 'Đã trả phòng', color: 'bg-slate-100 text-slate-700 border-slate-200' },
                                            completed: { label: 'Hoàn tất', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                                            cancelled: { label: 'Đã hủy', color: 'bg-rose-50 text-rose-700 border-rose-200' }
                                        };
                                        const st = statusMap[booking.status] || {
                                            label: booking.status_display || booking.status,
                                            color: 'bg-slate-100 text-slate-700 border-slate-200'
                                        };

                                        return (
                                            <tr key={booking.id} className="hover:bg-slate-50/80 transition group">
                                                {/* Cột 1: Mã & Tên đoàn (đầy đủ, không bị cụt) */}
                                                <td className="px-5 py-3.5 whitespace-normal">
                                                    <div className="font-mono font-bold text-indigo-600 text-xs">
                                                        #{booking.group_code}
                                                    </div>
                                                    <div className="font-bold text-slate-900 text-xs mt-0.5 line-clamp-2" title={booking.group_name}>
                                                        {booking.group_name}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 mt-0.5 whitespace-nowrap">
                                                        Đại diện: <strong className="text-slate-700">{booking.leader_name}</strong> {booking.leader_phone ? `(${booking.leader_phone})` : ''}
                                                    </div>
                                                </td>

                                                {/* Cột 2: Thời gian lưu trú (Định dạng DD/MM/YYYY chuẩn, không bị gãy dòng) */}
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    <div className="font-medium text-slate-800 flex items-center gap-1.5">
                                                        <span className="font-mono">{formatDateVN(booking.check_in_date)}</span>
                                                        <ArrowRight className="w-3 h-3 text-slate-400" />
                                                        <span className="font-mono">{formatDateVN(booking.check_out_date)}</span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                                                        <Clock className="w-3 h-3 text-slate-400" />
                                                        <span>{booking.nights || 1} đêm lưu trú</span>
                                                    </div>
                                                </td>

                                                {/* Cột 3: Quy mô phòng (Ngang 1 dòng, badge gọn) */}
                                                <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 shrink-0">
                                                        <BedDouble className="w-3.5 h-3.5 text-slate-500" />
                                                        <span>{booking.total_rooms || 0} phòng</span>
                                                    </span>
                                                </td>

                                                {/* Cột 4: Tổng tiền & Cọc (Không xuống dòng số tiền) */}
                                                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                    <div className="font-bold text-slate-900 text-xs font-mono">
                                                        {new Intl.NumberFormat('vi-VN').format(booking.total_amount)} đ
                                                    </div>
                                                    <div className="text-[11px] mt-0.5">
                                                        {booking.is_deposit_paid ? (
                                                            <span className="text-emerald-600 font-semibold font-mono">
                                                                Đã cọc: {new Intl.NumberFormat('vi-VN').format(booking.deposit_amount)}đ
                                                            </span>
                                                        ) : (
                                                            <span className="text-amber-600 font-semibold">Chưa đặt cọc</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Cột 5: Trạng thái (Ngang 1 dòng chữ, không bị vỡ Hoàn / tất) */}
                                                <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border shrink-0 ${st.color}`}>
                                                        {st.label}
                                                    </span>
                                                </td>

                                                {/* Cột 6: Nút hành động (Ngang 1 dòng, không bị vỡ Chi / tiết) */}
                                                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedGroupForDetail(booking)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition cursor-pointer shadow-2xs shrink-0 ml-auto"
                                                        title="Xem chi tiết danh sách phòng và khách trong đoàn"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                        <span>Chi tiết</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Chân Modal: Thanh Phân Trang Chuẩn */}
                <div className="bg-white border-t border-slate-200">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalCount={totalCount}
                        pageSize={pageSize}
                        pageSizeOptions={[5, 10, 20]}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setCurrentPage(1);
                        }}
                        onPageChange={(page) => setCurrentPage(page)}
                    />
                </div>
            </div>

            {/* MODAL CHI TIẾT ĐƠN ĐOÀN CỤ THỂ (GROUP DETAIL MODAL) */}
            {selectedGroupForDetail && (
                <GroupDetailModal
                    group={selectedGroupForDetail}
                    isOpen={Boolean(selectedGroupForDetail)}
                    onClose={() => setSelectedGroupForDetail(null)}
                    onRefresh={fetchHistory}
                />
            )}
        </div>
    );
}
