import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import adminUserService from '../../services/adminUserService';
import UserAvatar from '../../components/common/UserAvatar';
import Pagination from '../../components/common/Pagination';
import { useAuth } from '../../store/authStore';
import { useHasPermission } from '../../utils/permission';

export default function GuestManagement() {
    const { user } = useAuth();
    const canCreateGuest = useHasPermission('guests', 'create');
    const canUpdateGuest = useHasPermission('guests', 'update');
    const canDeleteGuest = useHasPermission('guests', 'delete');
    const isManagerOrAdmin = Boolean(user && (['admin', 'owner', 'manager'].includes(user.role) || user.is_superuser));

    const [guests, setGuests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [vipFilter, setVipFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    // Phân trang
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const currentPageRef = useRef(currentPage);
    useEffect(() => {
        currentPageRef.current = currentPage;
    }, [currentPage]);

    // Modals
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedGuest, setSelectedGuest] = useState(null);

    // Form data for Edit
    const [editFormData, setEditFormData] = useState({
        full_name: '',
        email: '',
        phone_number: '',
        address: '',
        id_card_number: '',
        vip_tier: 'Silver',
        loyalty_points: 0,
        preferences: '',
        is_active: true,
    });

    // Form data for Create
    const [createFormData, setCreateFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        password: 'Password123',
        id_card_number: '',
        vip_tier: 'Silver',
        loyalty_points: 0,
    });

    const [alertMessage, setAlertMessage] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Tải danh sách khách hàng từ API (có phân trang)
    const fetchGuests = async (page = null) => {
        setIsLoading(true);
        const targetPage = page !== null ? page : currentPageRef.current;
        const params = { page: targetPage };
        if (searchTerm) params.q = searchTerm;
        if (vipFilter !== 'all') params.vip_tier = vipFilter;
        if (statusFilter !== 'all') params.is_active = statusFilter;

        const res = await adminUserService.getGuests(params);
        if (res.success) {
            const list = res.results || res.guests || [];
            setGuests(list);
            setTotalCount(res.count !== undefined ? res.count : list.length);
            setTotalPages(res.total_pages || Math.ceil((res.count || list.length) / 10) || 1);
        }
        setIsLoading(false);
    };

    // Khi đổi bộ lọc -> reset về trang 1
    useEffect(() => {
        setCurrentPage(1);
        fetchGuests(1);
    }, [vipFilter, statusFilter]);

    // Chuyển trang
    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        fetchGuests(newPage);
    };

    // Handle search with debounce/Enter
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setCurrentPage(1);
        fetchGuests(1);
    };

    // Mở modal sửa
    const handleOpenEdit = (guest) => {
        setSelectedGuest(guest);
        setEditFormData({
            full_name: guest.full_name || '',
            email: guest.email || '',
            phone_number: guest.phone_number || '',
            address: guest.address || '',
            id_card_number: guest.guest_profile?.id_card_number || '',
            vip_tier: guest.guest_profile?.vip_tier || 'Silver',
            loyalty_points: guest.guest_profile?.loyalty_points || 0,
            preferences: guest.guest_profile?.preferences || '',
            is_active: guest.is_active,
        });
        setIsEditModalOpen(true);
    };

    // Mở modal xem chi tiết
    const handleOpenDetail = (guest) => {
        setSelectedGuest(guest);
        setIsDetailModalOpen(true);
    };

    // Lưu chỉnh sửa khách hàng
    const handleSaveEdit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const res = await adminUserService.updateGuest(selectedGuest.id, editFormData);
        setIsSubmitting(false);

        if (res.success) {
            setAlertMessage({ type: 'success', text: 'Cập nhật thông tin khách hàng thành công!' });
            setIsEditModalOpen(false);
            fetchGuests();
            setTimeout(() => setAlertMessage(null), 3000);
        } else {
            setAlertMessage({ type: 'error', text: res.message || 'Cập nhật thất bại.' });
        }
    };

    // Tạo khách hàng mới
    const handleSaveCreate = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const res = await adminUserService.createGuest(createFormData);
        setIsSubmitting(false);

        if (res.success) {
            setAlertMessage({ type: 'success', text: 'Tạo tài khoản khách hàng mới thành công!' });
            setIsCreateModalOpen(false);
            setCreateFormData({
                fullName: '',
                email: '',
                phone: '',
                password: 'Password123',
                id_card_number: '',
                vip_tier: 'Silver',
                loyalty_points: 0,
            });
            fetchGuests();
            setTimeout(() => setAlertMessage(null), 3000);
        } else {
            setAlertMessage({ type: 'error', text: res.message || 'Tạo tài khoản thất bại.' });
        }
    };

    // Đổi nhanh trạng thái Khóa / Mở khóa
    const handleToggleStatus = async (guest) => {
        const nextStatus = !guest.is_active;
        const confirmMsg = nextStatus
            ? `Quý khách có chắc chắn muốn MỞ KHÓA tài khoản "${guest.full_name || guest.username}"?`
            : `Quý khách có chắc chắn muốn TẠM KHÓA tài khoản "${guest.full_name || guest.username}"?`;

        if (!window.confirm(confirmMsg)) return;

        const res = await adminUserService.updateGuest(guest.id, { is_active: nextStatus });
        if (res.success) {
            setAlertMessage({
                type: 'success',
                text: `Đã ${nextStatus ? 'mở khóa' : 'tạm khóa'} tài khoản thành công!`
            });
            fetchGuests();
            setTimeout(() => setAlertMessage(null), 3000);
        } else {
            setAlertMessage({ type: 'error', text: res.message || 'Thao tác thất bại.' });
        }
    };

    // Xóa khách hàng với modal xác nhận an toàn
    const handleDelete = (guest) => {
        setSelectedGuest(guest);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedGuest) return;
        setIsSubmitting(true);

        const res = await adminUserService.deleteGuest(selectedGuest.id);
        setIsSubmitting(false);

        if (res.success) {
            setIsDeleteModalOpen(false);
            setAlertMessage({
                type: 'success',
                text: `Đã xóa vĩnh viễn tài khoản khách hàng "${selectedGuest.full_name || selectedGuest.username}" thành công!`,
            });
            fetchGuests();
            setTimeout(() => setAlertMessage(null), 3500);
        } else {
            setAlertMessage({
                type: 'error',
                text: res.message || 'Xóa tài khoản thất bại.',
            });
        }
    };

    const getInitials = (name) => {
        if (!name) return 'KH';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    // Stats calculations
    const totalGuests = guests.length;
    const vipDiamondCount = guests.filter(g => g.guest_profile?.vip_tier === 'Diamond').length;
    const vipPlatinumCount = guests.filter(g => g.guest_profile?.vip_tier === 'Platinum').length;
    const activeCount = guests.filter(g => g.is_active).length;

    return (
        <div className="space-y-6">
            {/* Header & Quick stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-serif font-bold text-slate-900 tracking-tight">
                        Quản Lý Hồ Sơ Khách Hàng (Guests)
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Danh sách hội viên lưu trú, quản lý điểm tích lũy TA Club và phân hạng VIP
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => fetchGuests()}
                        className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                        <span>🔄</span> Tải lại
                    </button>
                    {canCreateGuest && (
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/25 transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <span>＋</span> Thêm Khách Hàng Mới
                        </button>
                    )}
                </div>
            </div>

            {/* Alert Notification */}
            {alertMessage && (
                <div className={`p-4 rounded-2xl text-xs sm:text-sm font-medium border flex items-center gap-2 animate-fadeIn ${
                    alertMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                    <span>{alertMessage.type === 'success' ? '✅' : '⚠️'}</span>
                    <span>{alertMessage.text}</span>
                </div>
            )}

            {/* 4 Thẻ Thống Kê Nhanh */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Tổng khách hàng</span>
                        <strong className="text-2xl font-bold text-slate-900 mt-1 block">{totalGuests}</strong>
                        <span className="text-[11px] text-blue-600 font-medium">Hội viên đăng ký</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
                        👥
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Khách VIP Diamond</span>
                        <strong className="text-2xl font-bold text-slate-900 mt-1 block">{vipDiamondCount}</strong>
                        <span className="text-[11px] text-purple-600 font-medium">Hạng thẻ cao cấp nhất</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg">
                        💎
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Khách VIP Platinum</span>
                        <strong className="text-2xl font-bold text-slate-900 mt-1 block">{vipPlatinumCount}</strong>
                        <span className="text-[11px] text-amber-600 font-medium">Đặc quyền quản gia</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg">
                        👑
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Tài khoản hoạt động</span>
                        <strong className="text-2xl font-bold text-slate-900 mt-1 block">{activeCount}/{totalGuests}</strong>
                        <span className="text-[11px] text-emerald-600 font-medium">Tỷ lệ {totalGuests > 0 ? Math.round((activeCount / totalGuests) * 100) : 0}%</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                        🟢
                    </div>
                </div>
            </div>

            {/* Bộ Lọc & Tìm Kiếm */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[280px]">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        🔍
                    </span>
                    <input
                        type="text"
                        placeholder="Tìm theo Tên, Email, Số điện thoại, CCCD/Passport..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                    />
                    <button
                        type="submit"
                        className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                    >
                        Tìm
                    </button>
                </form>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                    {/* Hạng thẻ */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-semibold">Hạng VIP:</span>
                        <select
                            value={vipFilter}
                            onChange={(e) => setVipFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-none focus:border-blue-600 cursor-pointer"
                        >
                            <option value="all">Tất cả hạng thẻ</option>
                            <option value="Diamond">💎 Diamond (Kim Cương)</option>
                            <option value="Platinum">👑 Platinum (Bạch Kim)</option>
                            <option value="Gold">🏆 Gold (Vàng)</option>
                            <option value="Silver">🥈 Silver (Bạc)</option>
                        </select>
                    </div>

                    {/* Trạng thái */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-semibold">Trạng thái:</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-none focus:border-blue-600 cursor-pointer"
                        >
                            <option value="all">Tất cả trạng thái</option>
                            <option value="true">Đang hoạt động</option>
                            <option value="false">Tạm khóa</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Bảng Danh Sách Khách Hàng */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                <th className="p-4">Khách Hàng</th>
                                <th className="p-4">Liên Hệ</th>
                                <th className="p-4">CCCD / Passport</th>
                                <th className="p-4">Hạng Thẻ & Điểm</th>
                                <th className="p-4">Trạng Thái</th>
                                <th className="p-4 text-right">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400">
                                        <div className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Đang tải danh sách khách hàng...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : guests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400">
                                        Không tìm thấy khách hàng nào phù hợp với bộ lọc.
                                    </td>
                                </tr>
                            ) : (
                                guests.map((g) => {
                                    const tierStyles = {
                                        Diamond: 'bg-purple-50 text-purple-700 border-purple-200',
                                        Platinum: 'bg-amber-50 text-amber-700 border-amber-200',
                                        Gold: 'bg-yellow-50 text-yellow-800 border-yellow-200',
                                        Silver: 'bg-slate-100 text-slate-700 border-slate-200',
                                    }[g.guest_profile?.vip_tier] || 'bg-slate-100 text-slate-700 border-slate-200';

                                    return (
                                        <tr key={g.id} className="hover:bg-slate-50/70 transition">
                                            {/* Khách hàng */}
                                            <td className="p-4">
                                                <Link
                                                    to={`/admin/customers/${g.id}`}
                                                    className="flex items-center gap-3 group"
                                                    title={`Bấm để xem hồ sơ chi tiết và lịch sử của ${g.full_name || g.username}`}
                                                >
                                                    <UserAvatar
                                                        avatar={g.avatar}
                                                        name={g.full_name || g.username}
                                                        role="guest"
                                                        size="md"
                                                        border={false}
                                                    />
                                                    <div>
                                                        <strong className="block font-bold text-blue-600 hover:underline cursor-pointer text-sm">
                                                            {g.full_name || g.username}
                                                        </strong>
                                                        <span className="text-[11px] text-slate-400 group-hover:text-slate-600">@{g.username}</span>
                                                    </div>
                                                </Link>
                                            </td>

                                            {/* Liên hệ */}
                                            <td className="p-4">
                                                <div className="space-y-0.5">
                                                    <div className="font-semibold text-slate-800">
                                                        📞 {g.phone_number || 'Chưa có SĐT'}
                                                    </div>
                                                    <div className="text-slate-500 text-[11px]">
                                                        ✉️ {g.email || 'Chưa có Email'}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* CCCD / Passport */}
                                            <td className="p-4">
                                                <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-md text-[11px]">
                                                    {g.guest_profile?.id_card_number || 'Chưa cập nhật'}
                                                </span>
                                            </td>

                                            {/* Hạng thẻ & Điểm */}
                                            <td className="p-4">
                                                <div className="space-y-1">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${tierStyles}`}>
                                                        ★ {g.guest_profile?.vip_tier || 'Silver'}
                                                    </span>
                                                    <div className="text-[11px] font-semibold text-amber-600">
                                                        {g.guest_profile?.loyalty_points || 0} pts
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Trạng thái */}
                                            <td className="p-4">
                                                {g.is_active ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                        Hoạt động
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                        Tạm khóa
                                                    </span>
                                                )}
                                            </td>

                                            {/* Thao tác */}
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenDetail(g)}
                                                        className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition"
                                                        title="Xem chi tiết hồ sơ"
                                                    >
                                                        👁️
                                                    </button>
                                                    {canUpdateGuest && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEdit(g)}
                                                            className="p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition"
                                                            title="Chỉnh sửa thông tin"
                                                        >
                                                            ✏️
                                                        </button>
                                                    )}
                                                    {isManagerOrAdmin && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleStatus(g)}
                                                            className={`p-1.5 rounded-lg transition ${g.is_active ? 'text-slate-600 hover:text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                                            title={g.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                                                        >
                                                            {g.is_active ? '🔒' : '🔓'}
                                                        </button>
                                                    )}
                                                    {canDeleteGuest && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(g)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                                                            title="Xóa tài khoản"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Phân trang (Table Footer) */}
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    pageSize={10}
                    onPageChange={handlePageChange}
                />
            </div>

            {/* ========================================================================= */}
            {/* MODAL 1: CHỈNH SỬA THÔNG TIN KHÁCH HÀNG */}
            {/* ========================================================================= */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header: Tone nền trắng trang nhã, hiện đại */}
                        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-xl shadow-xs">
                                    ✏️
                                </div>
                                <div>
                                    <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                                        Chỉnh Sửa Thông Tin Khách Hàng
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {selectedGuest?.full_name || selectedGuest?.username} • Mã ID #{selectedGuest?.id} (@{selectedGuest?.username})
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsEditModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm"
                                title="Đóng cửa sổ"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-4 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Họ và tên đầy đủ *</label>
                                    <input
                                        type="text"
                                        required
                                        value={editFormData.full_name}
                                        onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Số điện thoại di động *</label>
                                    <input
                                        type="tel"
                                        required
                                        value={editFormData.phone_number}
                                        onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Địa chỉ Email *</label>
                                    <input
                                        type="email"
                                        required
                                        value={editFormData.email}
                                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Số CCCD / Hộ chiếu (Passport)</label>
                                    <input
                                        type="text"
                                        value={editFormData.id_card_number}
                                        onChange={(e) => setEditFormData({ ...editFormData, id_card_number: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Hạng thành viên VIP *</label>
                                    <select
                                        value={editFormData.vip_tier}
                                        onChange={(e) => setEditFormData({ ...editFormData, vip_tier: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white font-medium cursor-pointer"
                                    >
                                        <option value="Silver">🥈 Silver Member</option>
                                        <option value="Gold">🏆 Gold Member</option>
                                        <option value="Platinum">👑 Platinum Member</option>
                                        <option value="Diamond">💎 Diamond Member</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Điểm tích lũy TA Club</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={editFormData.loyalty_points}
                                        onChange={(e) => setEditFormData({ ...editFormData, loyalty_points: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white font-bold text-amber-600"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Địa chỉ thường trú</label>
                                <input
                                    type="text"
                                    value={editFormData.address}
                                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Ghi chú sở thích & Yêu cầu lưu trú</label>
                                <textarea
                                    rows={2}
                                    value={editFormData.preferences}
                                    onChange={(e) => setEditFormData({ ...editFormData, preferences: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                                />
                            </div>

                            <div className="pt-2 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="guest_active_toggle"
                                    checked={editFormData.is_active}
                                    onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                                    className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                                />
                                <label htmlFor="guest_active_toggle" className="font-bold text-slate-800 cursor-pointer">
                                    Tài khoản đang hoạt động (Bỏ chọn để tạm khóa tài khoản)
                                </label>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition disabled:opacity-75"
                                >
                                    {isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 2: XEM CHI TIẾT HỒ SƠ KHÁCH HÀNG */}
            {/* ========================================================================= */}
            {isDetailModalOpen && selectedGuest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header: Tone nền trắng thanh lịch, loại bỏ dải banner tối */}
                        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-xl shadow-xs">
                                    👤
                                </div>
                                <div>
                                    <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                                        Hồ Sơ Chi Tiết Khách Hàng
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Khách Sạn TA Đà Nẵng • Mã ID #{selectedGuest.id}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsDetailModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm"
                                title="Đóng cửa sổ"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4 text-xs">
                            {/* Profile Card Header */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                <div className="flex items-center gap-3.5">
                                    <UserAvatar
                                        avatar={selectedGuest.avatar}
                                        name={selectedGuest.full_name || selectedGuest.username}
                                        role="guest"
                                        size="lg"
                                        border={true}
                                    />
                                    <div>
                                        <h4 className="font-bold text-base text-slate-900">
                                            {selectedGuest.full_name || selectedGuest.username}
                                        </h4>
                                        <p className="text-xs text-slate-500">
                                            Username: @{selectedGuest.username} • ID #{selectedGuest.id}
                                        </p>
                                    </div>
                                </div>
                                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1 shadow-xs">
                                    <span>★</span> Hạng {selectedGuest.guest_profile?.vip_tier || 'Silver'}
                                </span>
                            </div>

                            {/* Grid 4 thông tin cốt lõi */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Số điện thoại</span>
                                    <strong className="text-slate-800 text-sm mt-0.5 block">{selectedGuest.phone_number || 'Chưa cập nhật'}</strong>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">CCCD / Passport</span>
                                    <strong className="text-slate-800 text-sm font-mono mt-0.5 block">{selectedGuest.guest_profile?.id_card_number || 'Chưa có'}</strong>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Email liên hệ</span>
                                    <strong className="text-slate-800 text-xs truncate mt-0.5 block">{selectedGuest.email || 'Chưa có email'}</strong>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Điểm TA Club</span>
                                    <strong className="text-amber-600 text-sm mt-0.5 block">{selectedGuest.guest_profile?.loyalty_points || 0} điểm</strong>
                                </div>
                            </div>

                            {/* Địa chỉ & Sở thích */}
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">Địa chỉ thường trú</span>
                                    <p className="text-slate-700 font-medium">{selectedGuest.address || 'Chưa có thông tin địa chỉ.'}</p>
                                </div>
                                <div className="pt-2 border-t border-slate-200/60">
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">Sở thích lưu trú / Ghi chú</span>
                                    <p className="text-slate-700 italic">{selectedGuest.guest_profile?.preferences || 'Chưa có ghi chú sở thích đặc biệt.'}</p>
                                </div>
                            </div>

                            {/* Footer Modal Actions */}
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsDetailModalOpen(false);
                                        handleOpenEdit(selectedGuest);
                                    }}
                                    className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                                >
                                    <span>✏️</span> Chỉnh sửa hồ sơ này
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsDetailModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 3: THÊM MỚI KHÁCH HÀNG */}
            {/* ========================================================================= */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header: Tone nền trắng trang nhã, hiện đại */}
                        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-xl font-bold shadow-xs">
                                    ＋
                                </div>
                                <div>
                                    <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                                        Thêm Tài Khoản Khách Hàng Mới
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Đăng ký hồ sơ hội viên mới tại quầy hoặc qua điện thoại
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm"
                                title="Đóng cửa sổ"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveCreate} className="p-6 space-y-4 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Họ và tên đầy đủ *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ví dụ: Lê Tuấn Anh"
                                    value={createFormData.fullName}
                                    onChange={(e) => setCreateFormData({ ...createFormData, fullName: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Số điện thoại *</label>
                                    <input
                                        type="tel"
                                        required
                                        placeholder="0912345678"
                                        value={createFormData.phone}
                                        onChange={(e) => setCreateFormData({ ...createFormData, phone: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Địa chỉ Email *</label>
                                    <input
                                        type="email"
                                        required
                                        placeholder="email@example.com"
                                        value={createFormData.email}
                                        onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Mật khẩu ban đầu *</label>
                                    <input
                                        type="text"
                                        required
                                        value={createFormData.password}
                                        onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Số CCCD / Passport</label>
                                    <input
                                        type="text"
                                        placeholder="048099012345"
                                        value={createFormData.id_card_number}
                                        onChange={(e) => setCreateFormData({ ...createFormData, id_card_number: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Hạng thành viên</label>
                                    <select
                                        value={createFormData.vip_tier}
                                        onChange={(e) => setCreateFormData({ ...createFormData, vip_tier: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
                                    >
                                        <option value="Silver">🥈 Silver Member</option>
                                        <option value="Gold">🏆 Gold Member</option>
                                        <option value="Platinum">👑 Platinum Member</option>
                                        <option value="Diamond">💎 Diamond Member</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Điểm ban đầu</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={createFormData.loyalty_points}
                                        onChange={(e) => setCreateFormData({ ...createFormData, loyalty_points: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white font-bold text-amber-600"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition disabled:opacity-75"
                                >
                                    {isSubmitting ? 'Đang tạo...' : 'Tạo Khách Hàng'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* ========================================================================= */}
            {/* MODAL 4: XÁC NHẬN XÓA KHÁCH HÀNG */}
            {/* ========================================================================= */}
            {isDeleteModalOpen && selectedGuest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-3xl mx-auto shadow-inner border border-rose-200">
                                🗑️
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900">
                                    Xác Nhận Xóa Khách Hàng?
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Hành động này sẽ xóa vĩnh viễn tài khoản hội viên và toàn bộ dữ liệu liên quan. Thao tác không thể hoàn tác.
                                </p>
                            </div>

                            {/* Card tóm tắt khách hàng sắp bị xóa */}
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-left flex items-center gap-3">
                                <UserAvatar
                                    avatar={selectedGuest.avatar}
                                    name={selectedGuest.full_name || selectedGuest.username}
                                    role="guest"
                                    size="md"
                                    border={false}
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold text-slate-900 text-xs truncate">
                                        {selectedGuest.full_name || selectedGuest.username}
                                    </div>
                                    <div className="text-[11px] text-slate-500 truncate">
                                        Mã ID #{selectedGuest.id} • {selectedGuest.phone_number || selectedGuest.email || `@${selectedGuest.username}`}
                                    </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    {selectedGuest.guest_profile?.vip_tier || 'Silver'}
                                </span>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                >
                                    Hủy Bỏ
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/30 transition disabled:opacity-50 cursor-pointer"
                                >
                                    {isSubmitting ? 'Đang xóa...' : 'Xác Nhận Xóa'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
