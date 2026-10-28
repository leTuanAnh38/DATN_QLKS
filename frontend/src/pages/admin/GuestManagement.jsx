import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    Users,
    Gem,
    Crown,
    UserCheck,
    RotateCw,
    UserPlus,
    Search,
    X,
    Phone,
    Mail,
    Star,
    Eye,
    EyeOff,
    Edit2,
    Lock,
    Unlock,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    User,
    Sparkles
} from 'lucide-react';
import adminUserService from '../../services/adminUserService';
import UserAvatar from '../../components/common/UserAvatar';
import Pagination from '../../components/common/Pagination';
import { useAuth } from '../../store/authStore';
import { useHasPermission } from '../../utils/permission';

// Helper chuẩn hóa mã hạng thẻ
const mapTierCode = (tierStr) => {
    if (!tierStr) return 'Bronze';
    const s = String(tierStr).toLowerCase();
    if (s.includes('diamond') || s.includes('kim cương')) return 'Diamond';
    if (s.includes('gold') || s.includes('vàng')) return 'Gold';
    if (s.includes('silver') || s.includes('bạc')) return 'Silver';
    return 'Bronze';
};

export default function GuestManagement() {
    const { user } = useAuth();
    const canCreateGuest = useHasPermission('guests', 'create');
    const canUpdateGuest = useHasPermission('guests', 'update');
    const canDeleteGuest = useHasPermission('guests', 'delete');
    const isManagerOrAdmin = canUpdateGuest;

    const [guests, setGuests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [vipFilter, setVipFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    // Phân trang & Thống kê toàn hệ thống
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [stats, setStats] = useState({
        total_guests: 0,
        active_guests: 0,
        diamond_guests: 0,
        gold_silver_guests: 0,
    });
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
    const [statusModalGuest, setStatusModalGuest] = useState(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // Form data for Edit
    const [editFormData, setEditFormData] = useState({
        full_name: '',
        email: '',
        phone_number: '',
        address: '',
        id_card_number: '',
        vip_tier: 'Bronze',
        loyalty_points: 0,
        preferences: '',
        is_active: true,
        new_password: '',
    });
    const [showEditPassword, setShowEditPassword] = useState(false);

    // Form data for Create
    const [createFormData, setCreateFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        password: 'Password123',
        id_card_number: '',
        vip_tier: 'Bronze',
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
            if (res.stats) {
                setStats(res.stats);
            }
        } else {
            setGuests([]);
            setTotalCount(0);
            setTotalPages(1);
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
        setShowEditPassword(false);
        setEditFormData({
            full_name: guest.full_name || '',
            email: guest.email?.endsWith('.local') ? '' : (guest.email || ''),
            phone_number: guest.phone_number || '',
            address: guest.address || '',
            id_type: guest.id_type || guest.guest_profile?.id_type || 'CCCD',
            id_card_number: guest.id_card_number || guest.guest_profile?.id_card_number || '',
            date_of_birth: guest.date_of_birth || guest.guest_profile?.date_of_birth || '',
            gender: guest.gender || guest.guest_profile?.gender || 'Nam',
            nationality: guest.nationality || guest.guest_profile?.nationality || 'Việt Nam',
            vip_tier: mapTierCode(guest.current_tier?.name || guest.guest_profile?.vip_tier || guest.vip_tier),
            loyalty_points: guest.total_points ?? guest.guest_profile?.loyalty_points ?? 0,
            preferences: guest.preferences || guest.guest_profile?.preferences || '',
            is_active: guest.is_active,
            new_password: '',
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
        const payload = { ...editFormData };
        if (!payload.new_password || !payload.new_password.trim()) {
            delete payload.new_password;
        } else {
            payload.new_password = payload.new_password.trim();
        }
        if (!payload.email || !payload.email.trim()) {
            if (selectedGuest?.email?.endsWith('.local')) {
                delete payload.email;
            }
        }
        const res = await adminUserService.updateGuest(selectedGuest.id, payload);
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
                vip_tier: 'Bronze',
                loyalty_points: 0,
            });
            fetchGuests();
            setTimeout(() => setAlertMessage(null), 3000);
        } else {
            setAlertMessage({ type: 'error', text: res.message || 'Tạo tài khoản thất bại.' });
        }
    };

    // Mở modal xác nhận đổi trạng thái (Khóa / Mở khóa / Kích hoạt)
    const handleToggleStatus = (guest) => {
        setStatusModalGuest(guest);
    };

    // Xác nhận đổi trạng thái và cập nhật CỤC BỘ dòng đó (KHÔNG tải lại cả trang/bảng)
    const handleConfirmStatusChange = async () => {
        if (!statusModalGuest) return;
        const guest = statusModalGuest;
        const isWalkin = guest.guest_type === 'walkin' || 
                         (guest.email && guest.email.endsWith('.local')) || 
                         (guest.username && guest.username.startsWith('walkin_'));
        const nextStatus = !guest.is_active;

        setIsUpdatingStatus(true);
        const res = await adminUserService.updateGuest(guest.id, { is_active: nextStatus });
        setIsUpdatingStatus(false);
        setStatusModalGuest(null);

        if (res.success) {
            // Cập nhật TRỰC TIẾP dòng đó trong state guests (KHÔNG gọi fetchGuests để không load lại cả bảng)
            setGuests(prevGuests => prevGuests.map(item => {
                if (item.id === guest.id) {
                    return {
                        ...item,
                        is_active: nextStatus,
                        // Nếu vừa kích hoạt từ vãng lai -> chuyển thành member
                        guest_type: nextStatus ? 'member' : item.guest_type,
                    };
                }
                return item;
            }));

            // Cập nhật bộ đếm thống kê cục bộ
            setStats(prevStats => {
                if (!prevStats) return prevStats;
                return {
                    ...prevStats,
                    active_guests: nextStatus 
                        ? (prevStats.active_guests || 0) + 1 
                        : Math.max(0, (prevStats.active_guests || 0) - 1)
                };
            });

            setAlertMessage({
                type: 'success',
                text: nextStatus 
                    ? (isWalkin ? 'Đã kích hoạt tài khoản thành viên thành công!' : 'Đã mở khóa tài khoản thành công!')
                    : 'Đã tạm khóa tài khoản thành công!'
            });
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

    // Stats calculations (Ưu tiên lấy thống kê tổng thể từ API để không bị giới hạn bởi trang hiện tại)
    const totalGuests = stats.total_guests || (totalCount !== undefined && totalCount > 0 ? totalCount : guests.length);
    const activeCount = stats.total_guests > 0 ? stats.active_guests : guests.filter(g => g.is_active).length;
    const vipDiamondCount = stats.total_guests > 0
        ? stats.diamond_guests
        : guests.filter(g => mapTierCode(g.current_tier?.name || g.guest_profile?.vip_tier) === 'Diamond').length;
    const vipGoldSilverCount = stats.total_guests > 0
        ? stats.gold_silver_guests
        : (guests.filter(g => mapTierCode(g.current_tier?.name || g.guest_profile?.vip_tier) === 'Gold').length +
           guests.filter(g => mapTierCode(g.current_tier?.name || g.guest_profile?.vip_tier) === 'Silver').length);

    return (
        <div className="space-y-6">
            {/* Header & Quick stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-serif font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                        <Users className="w-6 h-6 text-blue-600" />
                        <span>Quản Lý Hồ Sơ Khách Hàng (Guests)</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Danh sách hội viên lưu trú, quản lý điểm tích lũy TA Club và phân hạng VIP
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => fetchGuests()}
                        className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                        title="Tải lại danh sách"
                    >
                        <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                        <span>Tải lại</span>
                    </button>
                    {canCreateGuest && (
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/25 transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <UserPlus className="w-4 h-4" />
                            <span>Thêm Khách Hàng Mới</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Alert Notification */}
            {alertMessage && (
                <div className={`p-4 rounded-2xl text-xs sm:text-sm font-medium border flex items-center gap-2.5 animate-fadeIn ${
                    alertMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                    {alertMessage.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    )}
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
                    <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                        <Users className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Khách VIP Diamond</span>
                        <strong className="text-2xl font-bold text-slate-900 mt-1 block">{vipDiamondCount}</strong>
                        <span className="text-[11px] text-purple-600 font-medium">Hạng thẻ cao cấp nhất</span>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                        <Gem className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Khách VIP Gold / Silver</span>
                        <strong className="text-2xl font-bold text-slate-900 mt-1 block">{vipGoldSilverCount}</strong>
                        <span className="text-[11px] text-amber-600 font-medium">Hội viên hạng Vàng & Bạc</span>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                        <Crown className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Tài khoản hoạt động</span>
                        <strong className="text-2xl font-bold text-slate-900 mt-1 block">{activeCount}/{totalGuests}</strong>
                        <span className="text-[11px] text-emerald-600 font-medium">Tỷ lệ {totalGuests > 0 ? Math.round((activeCount / totalGuests) * 100) : 0}%</span>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                        <UserCheck className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Bộ Lọc & Tìm Kiếm */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[280px]">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                        <Search className="w-4 h-4" />
                    </span>
                    <input
                        type="text"
                        placeholder="Tìm theo Tên, Email, Số điện thoại, CCCD/Passport..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-24 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchTerm('');
                                fetchGuests(1);
                            }}
                            className="absolute right-16 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                            title="Xóa tìm kiếm"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        type="submit"
                        className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition cursor-pointer"
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
                            <option value="Diamond">💎 Kim Cương (Diamond)</option>
                            <option value="Gold">🏆 Vàng (Gold)</option>
                            <option value="Silver">🥈 Bạc (Silver)</option>
                            <option value="Bronze">🥉 Đồng (Bronze)</option>
                        </select>
                    </div>

                    {/* Phân loại & Trạng thái */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-semibold">Phân loại & Trạng thái:</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-none focus:border-blue-600 cursor-pointer"
                        >
                            <option value="all">Tất cả khách hàng</option>
                            <option value="true">Thành viên đang hoạt động</option>
                            <option value="walkin">Khách vãng lai (Tại quầy)</option>
                            <option value="false">Tài khoản bị tạm khóa</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Bảng Danh Sách Khách Hàng */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="hidden md:block overflow-x-auto">
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
                                    <td colSpan={6} className="p-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="h-7 w-7 text-blue-600 animate-spin" />
                                            <span className="text-xs font-semibold text-slate-600">Đang tải danh sách khách hàng...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : guests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-400 text-xs">
                                        Không tìm thấy khách hàng nào phù hợp với bộ lọc.
                                    </td>
                                </tr>
                            ) : (
                                guests.map((g) => {
                                    const tierCode = mapTierCode(g.current_tier?.name || g.guest_profile?.vip_tier);
                                    const tierStyles = {
                                        Diamond: 'bg-purple-50 text-purple-700 border-purple-200',
                                        Gold: 'bg-yellow-50 text-yellow-800 border-yellow-200',
                                        Silver: 'bg-slate-100 text-slate-700 border-slate-200',
                                        Bronze: 'bg-amber-50 text-amber-900 border-amber-300',
                                    }[tierCode] || 'bg-amber-50 text-amber-900 border-amber-300';

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
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs">
                                                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                        <span>{g.phone_number || <span className="text-slate-400 font-normal italic">Chưa có SĐT</span>}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px] truncate max-w-[200px]" title={g.email}>
                                                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                        {g.email && !g.email.endsWith('.local') ? (
                                                            <span>{g.email}</span>
                                                        ) : (
                                                            <span className="text-slate-400 italic">Chưa có Email (Vãng lai)</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* CCCD / Passport */}
                                            <td className="p-4">
                                                {g.guest_profile?.id_card_number ? (
                                                    <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-md text-[11px]">
                                                        {g.guest_profile.id_card_number}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-[11px]">Chưa cập nhật</span>
                                                )}
                                            </td>

                                            {/* Hạng thẻ & Điểm */}
                                            <td className="p-4">
                                                <div className="space-y-1">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${tierStyles}`}>
                                                        <Star className="w-3 h-3 fill-current" />
                                                        <span>{g.current_tier?.name || g.guest_profile?.vip_tier || 'Đồng (Bronze)'}</span>
                                                    </span>
                                                    <div className="text-[11px] font-semibold text-amber-600">
                                                        {Number(g.total_points ?? g.guest_profile?.loyalty_points ?? 0).toLocaleString('vi-VN')} pts
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Trạng thái */}
                                            <td className="p-4">
                                                {(() => {
                                                    const isWalkin = g.guest_type === 'walkin' || 
                                                                     (g.email && g.email.endsWith('.local')) || 
                                                                     (g.username && g.username.startsWith('walkin_')) ||
                                                                     (!g.has_usable_password && Boolean(g.is_auto_created));

                                                    if (isWalkin) {
                                                        if (!g.is_active) {
                                                            return (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200" title="Khách vãng lai tại quầy (tài khoản đang tạm khóa)">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                                    Khách vãng lai (Tạm khóa)
                                                                </span>
                                                            );
                                                        }
                                                        return (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200" title="Khách lưu trú trực tiếp tại quầy (chưa kích hoạt tài khoản web)">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                                Khách vãng lai
                                                            </span>
                                                        );
                                                    }

                                                    if (g.is_active) {
                                                        return (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                Hoạt động
                                                            </span>
                                                        );
                                                    }

                                                    return (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200" title="Tài khoản bị Quản trị viên tạm khóa">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                            Tạm khóa
                                                        </span>
                                                    );
                                                })()}
                                            </td>

                                            {/* Thao tác */}
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenDetail(g)}
                                                        className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 shadow-2xs transition cursor-pointer"
                                                        title="Xem chi tiết hồ sơ"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                    {canUpdateGuest && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEdit(g)}
                                                            className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 shadow-2xs transition cursor-pointer"
                                                            title="Chỉnh sửa thông tin"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {canUpdateGuest && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleStatus(g)}
                                                            className={`p-1.5 rounded-lg transition shadow-2xs cursor-pointer ${
                                                                g.is_active
                                                                    ? 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600'
                                                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                            }`}
                                                            title={g.is_active ? 'Khóa tài khoản' : (g.guest_type === 'walkin' || g.email?.endsWith('.local') ? 'Kích hoạt tài khoản thành viên' : 'Mở khóa tài khoản')}
                                                        >
                                                            {g.is_active ? (
                                                                <Lock className="w-3.5 h-3.5" />
                                                            ) : (
                                                                <Unlock className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                    )}
                                                    {canDeleteGuest && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(g)}
                                                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 shadow-2xs transition cursor-pointer"
                                                            title="Xóa tài khoản"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
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

                {/* GIAO DIỆN MOBILE CARDS (Hiển thị mượt mà trên điện thoại, ẩn trên tablet/desktop) */}
                <div className="block md:hidden divide-y divide-slate-100">
                    {isLoading ? (
                        <div className="p-8 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-2">
                                <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                                <span className="text-xs font-semibold text-slate-600">Đang tải danh sách khách hàng...</span>
                            </div>
                        </div>
                    ) : guests.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs">
                            Không tìm thấy khách hàng nào phù hợp với bộ lọc.
                        </div>
                    ) : (
                        guests.map((g) => {
                            const tierCode = mapTierCode(g.current_tier?.name || g.guest_profile?.vip_tier);
                            const tierStyles = {
                                Diamond: 'bg-purple-50 text-purple-700 border-purple-200',
                                Gold: 'bg-yellow-50 text-yellow-800 border-yellow-200',
                                Silver: 'bg-slate-100 text-slate-700 border-slate-200',
                                Bronze: 'bg-amber-50 text-amber-900 border-amber-300',
                            }[tierCode] || 'bg-amber-50 text-amber-900 border-amber-300';

                            return (
                                <div key={g.id} className="p-4 space-y-3 hover:bg-slate-50/60 transition">
                                    {/* Hàng 1: Avatar + Tên khách + Trạng thái */}
                                    <div className="flex items-start justify-between gap-2">
                                        <Link
                                            to={`/admin/customers/${g.id}`}
                                            className="flex items-center gap-2.5 min-w-0 group"
                                        >
                                            <UserAvatar
                                                avatar={g.avatar}
                                                name={g.full_name || g.username}
                                                role="guest"
                                                size="md"
                                                border={false}
                                            />
                                            <div className="min-w-0">
                                                <strong className="block font-bold text-blue-600 group-hover:underline text-sm truncate">
                                                    {g.full_name || g.username}
                                                </strong>
                                                <span className="text-[11px] text-slate-400 block truncate">
                                                    @{g.username} • #{g.id}
                                                </span>
                                            </div>
                                        </Link>

                                        <div className="shrink-0">
                                            {(() => {
                                                const isWalkin = g.guest_type === 'walkin' || 
                                                                 (g.email && g.email.endsWith('.local')) || 
                                                                 (g.username && g.username.startsWith('walkin_')) ||
                                                                 (!g.has_usable_password && Boolean(g.is_auto_created));

                                                if (isWalkin) {
                                                    return (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                            {g.is_active ? 'Khách vãng lai' : 'Vãng lai (Khóa)'}
                                                        </span>
                                                    );
                                                }
                                                if (g.is_active) {
                                                    return (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                            Hoạt động
                                                        </span>
                                                    );
                                                }
                                                return (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                        Tạm khóa
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {/* Hàng 2: Hạng thẻ VIP & Điểm thưởng */}
                                    <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${tierStyles}`}>
                                            <Star className="w-3 h-3 fill-current" />
                                            <span>{g.current_tier?.name || g.guest_profile?.vip_tier || 'Đồng (Bronze)'}</span>
                                        </span>
                                        <div className="text-[11px] font-bold text-amber-600">
                                            {Number(g.total_points ?? g.guest_profile?.loyalty_points ?? 0).toLocaleString('vi-VN')} pts (TA Club)
                                        </div>
                                    </div>

                                    {/* Hàng 3: Liên hệ & CCCD */}
                                    <div className="space-y-1.5 text-xs text-slate-600">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-slate-400 text-[11px] flex items-center gap-1">
                                                <Phone className="w-3 h-3" /> Điện thoại:
                                            </span>
                                            {g.phone_number ? (
                                                <a href={`tel:${g.phone_number}`} className="font-semibold text-blue-600 hover:underline">
                                                    {g.phone_number}
                                                </a>
                                            ) : (
                                                <span className="text-slate-400 italic">Chưa có SĐT</span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-slate-400 text-[11px] flex items-center gap-1">
                                                <Mail className="w-3 h-3" /> Email:
                                            </span>
                                            {g.email && !g.email.endsWith('.local') ? (
                                                <a href={`mailto:${g.email}`} className="font-medium text-slate-700 truncate max-w-[200px] hover:text-blue-600">
                                                    {g.email}
                                                </a>
                                            ) : (
                                                <span className="text-slate-400 italic">Chưa có email (Vãng lai)</span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-slate-400 text-[11px]">CCCD / Passport:</span>
                                            {g.guest_profile?.id_card_number ? (
                                                <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                                    {g.guest_profile.id_card_number}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 italic text-[11px]">Chưa cập nhật</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Hàng 4: Nút thao tác ngón tay */}
                                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenDetail(g)}
                                            className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>Xem hồ sơ</span>
                                        </button>
                                        {canUpdateGuest && (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEdit(g)}
                                                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                                <span>Sửa</span>
                                            </button>
                                        )}
                                        {canUpdateGuest && (
                                            <button
                                                type="button"
                                                onClick={() => handleToggleStatus(g)}
                                                className={`px-3 py-1.5 rounded-xl border font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                                    g.is_active
                                                        ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                }`}
                                            >
                                                {g.is_active ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                                <span>{g.is_active ? 'Khóa' : 'Mở khóa'}</span>
                                            </button>
                                        )}
                                        {canDeleteGuest && (
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(g)}
                                                className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition cursor-pointer shadow-2xs"
                                                title="Xóa tài khoản"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
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
                                <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
                                    <Edit2 className="w-5 h-5" />
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
                                <X className="w-4 h-4" />
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
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Địa chỉ Email {selectedGuest?.email?.endsWith('.local') ? <span className="text-slate-400 font-normal">(Chưa có)</span> : <span className="text-rose-500">*</span>}
                                    </label>
                                    <input
                                        type="email"
                                        required={!selectedGuest?.email?.endsWith('.local')}
                                        placeholder={selectedGuest?.email?.endsWith('.local') ? 'VD: khachhang@gmail.com (Tùy chọn)' : 'VD: khachhang@gmail.com'}
                                        value={editFormData.email}
                                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                                    />
                                    {selectedGuest?.email?.endsWith('.local') && (
                                        <span className="text-[10px] text-amber-600 mt-1 block">
                                            Khách vãng lai chưa đăng ký email riêng. Bạn có thể nhập email thật tại đây để cập nhật cho khách.
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Giấy tờ định danh</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={editFormData.id_type}
                                            onChange={(e) => setEditFormData({ ...editFormData, id_type: e.target.value })}
                                            className="w-28 px-2.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white text-xs font-semibold cursor-pointer"
                                        >
                                            <option value="CCCD">CCCD</option>
                                            <option value="PASSPORT">Hộ chiếu</option>
                                            <option value="OTHER">Khác</option>
                                        </select>
                                        <input
                                            type="text"
                                            value={editFormData.id_card_number}
                                            onChange={(e) => setEditFormData({ ...editFormData, id_card_number: e.target.value })}
                                            placeholder="Số CCCD / Hộ chiếu"
                                            className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Ngày sinh</label>
                                    <input
                                        type="date"
                                        value={editFormData.date_of_birth}
                                        onChange={(e) => setEditFormData({ ...editFormData, date_of_birth: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Giới tính</label>
                                    <select
                                        value={editFormData.gender}
                                        onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white font-medium cursor-pointer"
                                    >
                                        <option value="Nam">Nam</option>
                                        <option value="Nữ">Nữ</option>
                                        <option value="Khác">Khác</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Quốc tịch</label>
                                    <input
                                        type="text"
                                        value={editFormData.nationality}
                                        onChange={(e) => setEditFormData({ ...editFormData, nationality: e.target.value })}
                                        placeholder="Ví dụ: Việt Nam"
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
                                        <option value="Bronze">🥉 Đồng (Bronze)</option>
                                        <option value="Silver">🥈 Bạc (Silver)</option>
                                        <option value="Gold">🏆 Vàng (Gold)</option>
                                        <option value="Diamond">💎 Kim Cương (Diamond)</option>
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

                            {/* KHỐI CẬP NHẬT MẬT KHẨU (ĐẶC BIỆT CHO KHÁCH TẠO TỰ ĐỘNG / CHƯA ĐĂNG KÝ QUA WEB) */}
                            {(() => {
                                const isNotWebRegistered = Boolean(
                                    selectedGuest?.guest_type === 'walkin' ||
                                    selectedGuest?.username?.startsWith('walkin_') ||
                                    selectedGuest?.email?.includes('@walkin.') ||
                                    selectedGuest?.has_usable_password === false
                                );

                                return (
                                    <div className={`p-4 rounded-2xl border transition ${isNotWebRegistered ? 'bg-white border-amber-300/80 shadow-2xs' : 'bg-white border-slate-200 shadow-2xs'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Lock className="w-4 h-4 text-amber-600" />
                                                <div>
                                                    <label className="font-bold text-slate-800 text-xs">
                                                        {isNotWebRegistered ? 'Thiết lập mật khẩu đăng nhập web' : 'Cập nhật mật khẩu mới'}
                                                    </label>
                                                    {isNotWebRegistered && (
                                                        <span className="ml-2 px-2 py-0.5 rounded-md bg-white text-amber-800 font-bold text-[10px] border border-amber-300">
                                                            Chưa đăng ký qua web
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setEditFormData({ ...editFormData, new_password: 'Password123' })}
                                                className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold hover:underline cursor-pointer"
                                            >
                                                Gợi ý: Password123
                                            </button>
                                        </div>

                                        {isNotWebRegistered && (
                                            <p className="text-[11px] text-amber-800 mb-2.5 leading-relaxed">
                                                Khách hàng này được tạo qua đơn đặt phòng / tại quầy (chưa có tài khoản web). Bạn có thể thiết lập mật khẩu tại đây để cấp tài khoản đăng nhập website cho khách (khách có thể dùng Số điện thoại hoặc Email để đăng nhập).
                                            </p>
                                        )}

                                        <div className="relative">
                                            <input
                                                type={showEditPassword ? 'text' : 'password'}
                                                placeholder={isNotWebRegistered ? 'Nhập mật khẩu mới để cấp cho khách (VD: Password123)...' : 'Để trống nếu không muốn đổi mật khẩu khách hàng...'}
                                                value={editFormData.new_password}
                                                onChange={(e) => setEditFormData({ ...editFormData, new_password: e.target.value })}
                                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white pr-10 font-mono text-xs"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowEditPassword(!showEditPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                                                title={showEditPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                            >
                                                {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        {editFormData.new_password && (
                                            <p className="text-[11px] text-emerald-600 font-semibold mt-1.5 flex items-center gap-1.5">
                                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                                <span>Mật khẩu sẽ được lưu khi bấm &ldquo;Lưu Thay Đổi&rdquo;. Khách có thể dùng SĐT/Email và mật khẩu này để đăng nhập web.</span>
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}

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
                                    className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl cursor-pointer"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/25 transition disabled:opacity-75 cursor-pointer flex items-center gap-2"
                                >
                                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    <span>{isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
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
                                <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
                                    <User className="w-5 h-5" />
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
                                <X className="w-4 h-4" />
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
                                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1.5 shadow-xs">
                                    <Star className="w-3.5 h-3.5 fill-current" />
                                    <span>Hạng {selectedGuest.current_tier?.name || selectedGuest.guest_profile?.vip_tier || 'Đồng (Bronze)'}</span>
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
                                <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
                                    <UserPlus className="w-5 h-5" />
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
                                <X className="w-4 h-4" />
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
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white font-medium cursor-pointer"
                                    >
                                        <option value="Bronze">Đồng (Bronze)</option>
                                        <option value="Silver">Bạc (Silver)</option>
                                        <option value="Gold">Vàng (Gold)</option>
                                        <option value="Diamond">Kim Cương (Diamond)</option>
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
                                    className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-xl cursor-pointer"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/25 transition disabled:opacity-75 cursor-pointer flex items-center gap-2"
                                >
                                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    <span>{isSubmitting ? 'Đang tạo...' : 'Tạo Khách Hàng'}</span>
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
                            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-inner border border-rose-200">
                                <Trash2 className="w-8 h-8" />
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
                                    {selectedGuest.current_tier?.name || selectedGuest.guest_profile?.vip_tier || 'Đồng (Bronze)'}
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
                                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/30 transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                                >
                                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    <span>{isSubmitting ? 'Đang xóa...' : 'Xác Nhận Xóa'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 5: XÁC NHẬN KHÓA / MỞ KHÓA / KÍCH HOẠT TÀI KHOẢN (MÀU TRẮNG HIỆN ĐẠI) */}
            {/* ========================================================================= */}
            {statusModalGuest && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
                    onClick={() => !isUpdatingStatus && setStatusModalGuest(null)}
                >
                    <div
                        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {(() => {
                            const isWalkin = statusModalGuest.guest_type === 'walkin' || 
                                             (statusModalGuest.email && statusModalGuest.email.endsWith('.local')) || 
                                             (statusModalGuest.username && statusModalGuest.username.startsWith('walkin_'));
                            const willBeActive = !statusModalGuest.is_active;

                            let icon = <Lock className="w-8 h-8" />;
                            let iconBg = 'bg-rose-50 text-rose-600 border-rose-200';
                            let title = 'Xác Nhận Tạm Khóa Tài Khoản?';
                            let desc = `Bạn có chắc chắn muốn TẠM KHÓA tài khoản của khách hàng "${statusModalGuest.full_name || statusModalGuest.username}"? Khách sẽ tạm thời không thể đăng nhập vào hệ thống website.`;
                            let confirmBtnText = 'Xác Nhận Tạm Khóa';
                            let confirmBtnClass = 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30';

                            if (willBeActive) {
                                if (isWalkin) {
                                    icon = <Sparkles className="w-8 h-8" />;
                                    iconBg = 'bg-blue-50 text-blue-600 border-blue-200';
                                    title = 'Kích Hoạt Tài Khoản Thành Viên?';
                                    desc = `Khách hàng "${statusModalGuest.full_name || statusModalGuest.username}" đang là Khách vãng lai (Offline). Bạn có muốn KÍCH HOẠT tài khoản thành viên web để khách có thể tích điểm và đăng nhập không?`;
                                    confirmBtnText = 'Xác Nhận Kích Hoạt';
                                    confirmBtnClass = 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30';
                                } else {
                                    icon = <Unlock className="w-8 h-8" />;
                                    iconBg = 'bg-emerald-50 text-emerald-600 border-emerald-200';
                                    title = 'Xác Nhận Mở Khóa Tài Khoản?';
                                    desc = `Bạn có chắc chắn muốn MỞ KHÓA tài khoản cho khách hàng "${statusModalGuest.full_name || statusModalGuest.username}"? Tài khoản sẽ hoạt động trở lại bình thường.`;
                                    confirmBtnText = 'Xác Nhận Mở Khóa';
                                    confirmBtnClass = 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30';
                                }
                            }

                            return (
                                <div className="p-6 text-center space-y-4">
                                    {/* Icon tròn */}
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-inner border ${iconBg}`}>
                                        {icon}
                                    </div>

                                    {/* Tiêu đề & Mô tả */}
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 tracking-tight">
                                            {title}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed px-2">
                                            {desc}
                                        </p>
                                    </div>

                                    {/* Card tóm tắt thông tin khách hàng */}
                                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-left flex items-center gap-3">
                                        <UserAvatar
                                            avatar={statusModalGuest.avatar}
                                            name={statusModalGuest.full_name || statusModalGuest.username}
                                            role="guest"
                                            size="md"
                                            border={false}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-slate-900 text-xs truncate">
                                                {statusModalGuest.full_name || statusModalGuest.username}
                                            </div>
                                            <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-2 flex-wrap">
                                                {statusModalGuest.phone_number ? (
                                                    <span className="inline-flex items-center gap-1">
                                                        <Phone className="w-3 h-3 text-slate-400" />
                                                        {statusModalGuest.phone_number}
                                                    </span>
                                                ) : `@${statusModalGuest.username}`}
                                                {statusModalGuest.email && !statusModalGuest.email.endsWith('.local') && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <span>•</span>
                                                        <Mail className="w-3 h-3 text-slate-400" />
                                                        {statusModalGuest.email}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                            {statusModalGuest.current_tier?.name || statusModalGuest.guest_profile?.vip_tier || 'Đồng (Bronze)'}
                                        </span>
                                    </div>

                                    {/* Nút hành động */}
                                    <div className="flex items-center justify-end gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setStatusModalGuest(null)}
                                            disabled={isUpdatingStatus}
                                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
                                        >
                                            Hủy Bỏ
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleConfirmStatusChange}
                                            disabled={isUpdatingStatus}
                                            className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5 ${confirmBtnClass}`}
                                        >
                                            {isUpdatingStatus ? (
                                                <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    <span>Đang xử lý...</span>
                                                </>
                                            ) : (
                                                confirmBtnText
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}
