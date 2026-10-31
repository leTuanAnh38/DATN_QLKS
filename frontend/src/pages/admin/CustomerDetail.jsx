import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft,
    RotateCw,
    Phone,
    Mail,
    CreditCard,
    Calendar,
    User,
    Globe,
    MapPin,
    Lightbulb,
    Building2,
    Coins,
    BedDouble,
    BellRing,
    Utensils,
    LogIn,
    LogOut,
    Inbox,
    Star,
    Crown,
    Gem,
    Award,
    ExternalLink,
    Loader2,
    AlertTriangle,
    ShieldCheck
} from 'lucide-react';
import adminUserService from '../../services/adminUserService';
import UserAvatar from '../../components/common/UserAvatar';
import Pagination from '../../components/common/Pagination';

// Helper format ngày hiển thị DD/MM/YYYY
const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const parts = String(dateStr).split('T')[0].split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    } catch {
        return dateStr;
    }
    return dateStr;
};

// Helper format thời gian chi tiết HH:MM • DD/MM/YYYY
const formatDateTimeDisplay = (isoStr) => {
    if (!isoStr) return '—';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `${time} • ${date}`;
    } catch {
        return isoStr;
    }
};

// Config trạng thái đơn đặt phòng
const BOOKING_STATUS_CONFIG = {
    pending: { label: 'Chờ duyệt', color: 'bg-amber-50 text-amber-800 border-amber-300' },
    confirmed: { label: 'Đã xác nhận', color: 'bg-blue-50 text-blue-800 border-blue-300' },
    checked_in: { label: 'Đang ở', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
    checked_out: { label: 'Đã trả phòng', color: 'bg-purple-50 text-purple-800 border-purple-300' },
    completed: { label: 'Đã hoàn tất', color: 'bg-slate-100 text-slate-800 border-slate-300' },
    no_show: { label: 'No-show', color: 'bg-zinc-100 text-zinc-700 border-zinc-300' },
    cancelled: { label: 'Đã hủy', color: 'bg-rose-50 text-rose-800 border-rose-300' }
};

// Config trạng thái yêu cầu dịch vụ
const SERVICE_STATUS_CONFIG = {
    pending: { label: 'Chờ xử lý', color: 'bg-amber-50 text-amber-700 border-amber-300' },
    in_progress: { label: 'Đang phục vụ', color: 'bg-blue-50 text-blue-700 border-blue-300' },
    completed: { label: 'Hoàn thành', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
    cancelled: { label: 'Đã hủy', color: 'bg-rose-50 text-rose-700 border-rose-300' }
};

// Config hạng VIP với vector icons
const VIP_TIER_CONFIG = {
    Diamond: { 
        label: 'Kim Cương (Diamond)', 
        badge: 'bg-purple-50 text-purple-700 border-purple-200', 
        icon: Gem, 
        iconColor: 'text-purple-600' 
    },
    Gold: { 
        label: 'Vàng (Gold)', 
        badge: 'bg-amber-50 text-amber-700 border-amber-200', 
        icon: Crown, 
        iconColor: 'text-amber-500 fill-amber-500' 
    },
    Silver: { 
        label: 'Bạc (Silver)', 
        badge: 'bg-slate-100 text-slate-700 border-slate-300', 
        icon: Award, 
        iconColor: 'text-slate-500' 
    },
    Bronze: { 
        label: 'Đồng (Bronze)', 
        badge: 'bg-amber-50 text-amber-800 border-amber-200', 
        icon: Star, 
        iconColor: 'text-amber-600 fill-amber-600' 
    }
};

const mapTierCode = (tier) => {
    if (!tier) return 'Bronze';
    const t = String(tier).toLowerCase();
    if (t.includes('diamond') || t.includes('kim')) return 'Diamond';
    if (t.includes('gold') || t.includes('vàng') || t.includes('vang')) return 'Gold';
    if (t.includes('silver') || t.includes('bạc') || t.includes('bac')) return 'Silver';
    return 'Bronze';
};

export default function CustomerDetail({ customerId: propCustomerId }) {
    const { id: routeId } = useParams();
    const navigate = useNavigate();
    const customerId = propCustomerId || routeId;

    // State hồ sơ khách hàng
    const [customer, setCustomer] = useState(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [profileError, setProfileError] = useState(null);

    // State quản lý Tabs
    const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'services'

    // State Tab 1: Lịch sử đặt phòng
    const [bookings, setBookings] = useState([]);
    const [isLoadingBookings, setIsLoadingBookings] = useState(false);
    const [bookingCurrentPage, setBookingCurrentPage] = useState(1);
    const [bookingPageSize, setBookingPageSize] = useState(5);
    const [bookingTotalPages, setBookingTotalPages] = useState(1);
    const [bookingTotalCount, setBookingTotalCount] = useState(0);

    // State Tab 2: Lịch sử dịch vụ
    const [serviceRequests, setServiceRequests] = useState([]);
    const [isLoadingServices, setIsLoadingServices] = useState(false);
    const [serviceCurrentPage, setServiceCurrentPage] = useState(1);
    const [servicePageSize, setServicePageSize] = useState(5);
    const [serviceTotalPages, setServiceTotalPages] = useState(1);
    const [serviceTotalCount, setServiceTotalCount] = useState(0);

    // 1. Tải thông tin hồ sơ chi tiết khách hàng (GET /api/users/{id}/)
    const fetchCustomerProfile = useCallback(async () => {
        if (!customerId) return;
        setIsLoadingProfile(true);
        setProfileError(null);
        try {
            const res = await adminUserService.getGuestDetail(customerId);
            if (res && res.success !== false) {
                const guestData = res.guest || res.user || res;
                setCustomer(guestData);
            } else {
                setProfileError(res.message || 'Không tìm thấy hồ sơ khách hàng.');
            }
        } catch (err) {
            setProfileError('Lỗi kết nối máy chủ khi tải hồ sơ khách hàng.');
        } finally {
            setIsLoadingProfile(false);
        }
    }, [customerId]);

    // 2. Tải lịch sử đặt phòng (GET /api/bookings/?guest_id={id}&page={page}&page_size={pageSize})
    const fetchBookings = useCallback(async (page = 1, pageSize = bookingPageSize) => {
        if (!customerId) return;
        setIsLoadingBookings(true);
        try {
            const res = await adminUserService.getGuestBookings(customerId, page, pageSize);
            if (res && (res.results || res.bookings || Array.isArray(res))) {
                const list = res.results || res.bookings || res;
                setBookings(list);
                setBookingCurrentPage(page);
                const count = res.count !== undefined ? res.count : list.length;
                setBookingTotalCount(count);
                setBookingTotalPages(res.total_pages || Math.ceil(count / pageSize) || 1);
            } else {
                setBookings([]);
                setBookingTotalCount(0);
                setBookingTotalPages(1);
            }
        } catch (err) {
            console.error('Lỗi khi tải lịch sử đặt phòng:', err);
            setBookings([]);
        } finally {
            setIsLoadingBookings(false);
        }
    }, [customerId, bookingPageSize]);

    // 3. Tải lịch sử sử dụng dịch vụ (GET /api/service-requests/?guest_id={id}&page={page}&page_size={pageSize})
    const fetchServiceRequests = useCallback(async (page = 1, pageSize = servicePageSize) => {
        if (!customerId) return;
        setIsLoadingServices(true);
        try {
            const res = await adminUserService.getGuestServiceRequests(customerId, page, pageSize);
            if (res && (res.results || res.requests || res.items || Array.isArray(res))) {
                const list = res.results || res.requests || res.items || res;
                setServiceRequests(list);
                setServiceCurrentPage(page);
                const count = res.count !== undefined ? res.count : list.length;
                setServiceTotalCount(count);
                setServiceTotalPages(res.total_pages || Math.ceil(count / pageSize) || 1);
            } else {
                setServiceRequests([]);
                setServiceTotalCount(0);
                setServiceTotalPages(1);
            }
        } catch (err) {
            console.error('Lỗi khi tải lịch sử dịch vụ:', err);
            setServiceRequests([]);
        } finally {
            setIsLoadingServices(false);
        }
    }, [customerId, servicePageSize]);

    // Tải dữ liệu ban đầu
    useEffect(() => {
        fetchCustomerProfile();
        fetchBookings(1, bookingPageSize);
        fetchServiceRequests(1, servicePageSize);
    }, [fetchCustomerProfile, fetchBookings, fetchServiceRequests, bookingPageSize, servicePageSize]);

    // Handler khi chuyển trang đặt phòng
    const handleBookingPageChange = (newPage) => {
        fetchBookings(newPage, bookingPageSize);
    };

    // Handler khi đổi số dòng / trang đặt phòng
    const handleBookingPageSizeChange = (newSize) => {
        setBookingPageSize(newSize);
        fetchBookings(1, newSize);
    };

    // Handler khi chuyển trang dịch vụ
    const handleServicePageChange = (newPage) => {
        fetchServiceRequests(newPage, servicePageSize);
    };

    // Handler khi đổi số dòng / trang dịch vụ
    const handleServicePageSizeChange = (newSize) => {
        setServicePageSize(newSize);
        fetchServiceRequests(1, newSize);
    };

    // Trích xuất thông tin định danh & lưu trú an toàn
    const idType = customer?.id_type || customer?.guest_profile?.id_type || 'CCCD';
    const idCardNumber = customer?.id_card_number || customer?.guest_profile?.id_card_number || 'Chưa cập nhật';
    const dateOfBirth = customer?.date_of_birth || customer?.guest_profile?.date_of_birth || null;
    const gender = customer?.gender || customer?.guest_profile?.gender || 'Chưa cập nhật';
    const nationality = customer?.nationality || customer?.guest_profile?.nationality || 'Việt Nam';
    const preferences = customer?.preferences || customer?.guest_profile?.preferences || '';
    const rawTier = customer?.current_tier?.name || customer?.guest_profile?.vip_tier || customer?.vip_tier || 'Bronze';
    const tierCode = mapTierCode(rawTier);
    const vipConfig = VIP_TIER_CONFIG[tierCode] || VIP_TIER_CONFIG.Bronze;
    const TierIcon = vipConfig.icon;

    return (
        <div className="space-y-6 max-w-full animate-fadeIn pb-12">
            {/* Header & Thanh Điều Hướng */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/admin?tab=guests')}
                        className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition flex items-center gap-2 text-xs font-bold cursor-pointer shadow-2xs"
                        title="Quay lại danh sách khách hàng"
                    >
                        <ArrowLeft className="w-4 h-4 text-slate-500" />
                        <span>Quay lại danh sách</span>
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            fetchCustomerProfile();
                            if (activeTab === 'bookings') fetchBookings(bookingCurrentPage);
                            else fetchServiceRequests(serviceCurrentPage);
                        }}
                        disabled={isLoadingProfile || isLoadingBookings || isLoadingServices}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-2xs"
                    >
                        <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${isLoadingProfile || isLoadingBookings || isLoadingServices ? 'animate-spin text-blue-600' : ''}`} />
                        <span>Làm mới</span>
                    </button>
                </div>
            </div>

            {/* Thông báo lỗi nếu không tải được hồ sơ */}
            {profileError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    <div className="flex-1 font-medium">{profileError}</div>
                    <button
                        type="button"
                        onClick={() => navigate('/admin?tab=guests')}
                        className="underline font-bold hover:text-rose-900"
                    >
                        Trở về danh sách
                    </button>
                </div>
            )}

            {/* ========================================================================= */}
            {/* PHẦN 1: THẺ THÔNG TIN CÁ NHÂN (PROFILE CARD) & 2 KHỐI THỐNG KÊ              */}
            {/* ========================================================================= */}
            {isLoadingProfile ? (
                <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-xs flex flex-col items-center justify-center gap-3 text-slate-400">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <span className="text-sm font-medium text-slate-600">Đang tải hồ sơ khách hàng...</span>
                </div>
            ) : customer && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Thẻ Thông Tin Khách Hàng (Avatar to, Tên, Liên hệ, CCCD) */}
                    <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-500/5 via-indigo-500/5 to-transparent rounded-bl-full pointer-events-none"></div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 relative z-10">
                            {/* Avatar to */}
                            <div className="relative shrink-0">
                                <UserAvatar
                                    avatar={customer.avatar}
                                    name={customer.full_name || customer.username}
                                    role="guest"
                                    size="2xl"
                                    className="w-20 h-20 sm:w-24 sm:h-24 text-2xl sm:text-3xl shadow-md ring-4 ring-slate-100 rounded-2xl"
                                />
                                <span className={`absolute -bottom-1 -right-1 p-1.5 rounded-full bg-white shadow-md border border-slate-100 ${vipConfig.iconColor}`} title={vipConfig.label}>
                                    <TierIcon className="w-4 h-4" />
                                </span>
                            </div>

                            {/* Chi tiết liên hệ & CCCD */}
                            <div className="space-y-2 flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                        {customer.full_name || customer.username}
                                    </h2>
                                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 shadow-2xs ${vipConfig.badge}`}>
                                        <TierIcon className={`w-3.5 h-3.5 ${vipConfig.iconColor}`} />
                                        <span>{vipConfig.label}</span>
                                    </span>
                                    {customer.is_active ? (
                                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold inline-flex items-center gap-1 shadow-2xs">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            <span>Hoạt động</span>
                                        </span>
                                    ) : (
                                        <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold inline-flex items-center gap-1 shadow-2xs">
                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                            <span>Đã khóa</span>
                                        </span>
                                    )}
                                </div>

                                <p className="text-xs text-slate-400 font-mono">
                                    Tên tài khoản: <span className="text-slate-700 font-semibold">@{customer.username}</span>
                                    {customer.date_joined && (
                                        <span className="ml-3">
                                            • Gia nhập: {formatDateDisplay(customer.date_joined)}
                                        </span>
                                    )}
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 text-xs">
                                    <div className="flex items-center gap-2.5 text-slate-700">
                                        <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                                            <Phone className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <span className="text-slate-400 text-[10px] block">Số điện thoại:</span>
                                            <span className="font-semibold text-slate-900">{customer.phone_number || 'Chưa cung cấp SĐT'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 text-slate-700 truncate">
                                        <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                                            <Mail className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="truncate">
                                            <span className="text-slate-400 text-[10px] block">Email:</span>
                                            <span className="truncate font-semibold text-slate-900">{customer.email || 'Chưa có Email'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 text-slate-700">
                                        <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                                            <CreditCard className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <span className="text-slate-400 text-[10px] block">
                                                {idType === 'PASSPORT' ? 'Hộ chiếu (Passport):' : 'Số CCCD / CMND:'}
                                            </span>
                                            <span className="font-mono font-bold text-slate-900">{idCardNumber}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 text-slate-700">
                                        <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                                            <Calendar className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <span className="text-slate-400 text-[10px] block">Ngày sinh:</span>
                                            <span className="font-medium text-slate-900">
                                                {dateOfBirth ? formatDateDisplay(dateOfBirth) : 'Chưa cập nhật'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 text-slate-700">
                                        <div className="w-7 h-7 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0">
                                            <User className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <span className="text-slate-400 text-[10px] block">Giới tính:</span>
                                            <span className="font-medium text-slate-900">{gender || 'Nam'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 text-slate-700">
                                        <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                                            <Globe className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <span className="text-slate-400 text-[10px] block">Quốc tịch:</span>
                                            <span className="font-medium text-slate-900">{nationality || 'Việt Nam'}</span>
                                        </div>
                                    </div>
                                </div>

                                {customer.address && (
                                    <p className="text-xs text-slate-600 pt-2 flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span><strong>Địa chỉ:</strong> {customer.address}</span>
                                    </p>
                                )}

                                {preferences && (
                                    <div className="mt-2.5 p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs">
                                        <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <strong className="block font-bold text-amber-950 text-[11px] uppercase tracking-wide">
                                                Sở thích & Yêu cầu lưu trú:
                                            </strong>
                                            <span className="mt-0.5 block leading-relaxed text-amber-900/90">{preferences}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2 Khối Thống Kê Nhỏ: Tổng số lần đến & Tổng chi tiêu */}
                    <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                        {/* Khối 1: Tổng số lần đến */}
                        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 flex items-center justify-between">
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                    Tổng số lần đến
                                </span>
                                <strong className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1 block">
                                    {customer.total_bookings ?? bookingTotalCount}
                                </strong>
                                <span className="text-[11px] text-blue-600 font-semibold mt-1 block">
                                    Lượt đặt phòng tại khách sạn
                                </span>
                            </div>
                            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 shadow-inner">
                                <Building2 className="w-7 h-7" />
                            </div>
                        </div>

                        {/* Khối 2: Tổng chi tiêu */}
                        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 flex items-center justify-between">
                            <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                    Tổng chi tiêu tích lũy
                                </span>
                                <strong className="text-2xl sm:text-3xl font-black text-amber-600 font-mono tracking-tight mt-1 block">
                                    {(Number(customer.total_spent) || 0).toLocaleString('vi-VN')} <span className="text-sm font-semibold text-slate-500">VNĐ</span>
                                </strong>
                                <span className="text-[11px] text-slate-500 font-medium mt-1 block">
                                    Giá trị tiêu dùng dịch vụ & phòng
                                </span>
                            </div>
                            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0 shadow-inner">
                                <Coins className="w-7 h-7" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* PHẦN 2: KHU VỰC LỊCH SỬ (TABS: ĐẶT PHÒNG & DỊCH VỤ)                       */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
                {/* Thanh Chuyển Tab */}
                <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-2xl w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setActiveTab('bookings')}
                            className={`flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                                activeTab === 'bookings'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <BedDouble className="w-4 h-4" />
                            <span>Lịch sử Đặt phòng</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                activeTab === 'bookings' ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-600'
                            }`}>
                                {bookingTotalCount}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('services')}
                            className={`flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                                activeTab === 'services'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <BellRing className="w-4 h-4" />
                            <span>Lịch sử Dịch vụ</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                activeTab === 'services' ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-600'
                            }`}>
                                {serviceTotalCount}
                            </span>
                        </button>
                    </div>

                    <div className="text-xs text-slate-400 px-1 text-center sm:text-right">
                        {activeTab === 'bookings' ? 'Dữ liệu các lượt lưu trú của khách' : 'Lịch sử gọi món & dịch vụ phòng'}
                    </div>
                </div>

                {/* ===================================================================== */}
                {/* TAB 1: LỊCH SỬ ĐẶT PHÒNG                                              */}
                {/* ===================================================================== */}
                {activeTab === 'bookings' && (
                    <div>
                        {/* A. DESKTOP / TABLET TABLE VIEW (>= md) */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                        <th className="p-4">Mã Đơn</th>
                                        <th className="p-4">Hạng Phòng & Phòng Thực Tế</th>
                                        <th className="p-4">Thời Gian (Check-in → Out)</th>
                                        <th className="p-4">Tổng Tiền</th>
                                        <th className="p-4">Trạng Thái</th>
                                        <th className="p-4 text-right">Chi Tiết</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isLoadingBookings ? (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-slate-400">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                                                    <span className="font-medium text-slate-600">Đang tải lịch sử đặt phòng của khách...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : bookings.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-slate-400">
                                                <div className="space-y-1.5 flex flex-col items-center justify-center">
                                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-1">
                                                        <Inbox className="w-6 h-6" />
                                                    </div>
                                                    <p className="font-semibold text-slate-700">Chưa có dữ liệu đặt phòng</p>
                                                    <p className="text-[11px] text-slate-400">Khách hàng này chưa thực hiện đơn đặt phòng nào trên hệ thống.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        bookings.map((b) => {
                                            const statusCfg = BOOKING_STATUS_CONFIG[b.status] || {
                                                label: b.status_display || b.status,
                                                color: 'bg-slate-100 text-slate-800 border-slate-200'
                                            };
                                            const roomNum = b.room_number || b.room?.room_number;
                                            const categoryName = b.room_name || b.category?.name || b.room?.category?.name || 'Tiêu chuẩn';

                                            return (
                                                <tr key={b.id} className="hover:bg-slate-50/70 transition">
                                                    {/* Mã đơn */}
                                                    <td className="p-4 font-mono font-bold text-blue-600">
                                                        #{b.booking_code}
                                                        <span className="block font-sans text-[10px] text-slate-400 font-normal mt-0.5">
                                                            {formatDateTimeDisplay(b.created_at)}
                                                        </span>
                                                    </td>

                                                    {/* Hạng phòng & Phòng */}
                                                    <td className="p-4">
                                                        <strong className="block font-bold text-slate-900 text-sm">
                                                            {categoryName}
                                                        </strong>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            {roomNum ? (
                                                                <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px] font-bold">
                                                                    Phòng {roomNum}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 text-[11px]">Chưa gán phòng</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Check-in / Out */}
                                                    <td className="p-4 text-slate-700">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                                                                <span className="inline-flex items-center gap-1 font-semibold text-slate-900 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/60">
                                                                    <LogIn className="w-3.5 h-3.5 text-blue-500" />
                                                                    <span>{formatDateDisplay(b.check_in_date)}</span>
                                                                </span>
                                                                <span className="text-slate-400">→</span>
                                                                <span className="inline-flex items-center gap-1 font-semibold text-slate-900 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/60">
                                                                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                                                                    <span>{formatDateDisplay(b.check_out_date)}</span>
                                                                </span>
                                                            </div>
                                                            {b.actual_check_in && (
                                                                <span className="text-[10px] text-slate-400 block">
                                                                    Check-in thực tế: {formatDateTimeDisplay(b.actual_check_in)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Tổng tiền */}
                                                    <td className="p-4">
                                                        <strong className="font-mono text-amber-600 font-bold text-sm block">
                                                            {Number(b.total_amount || 0).toLocaleString('vi-VN')} đ
                                                        </strong>
                                                        {b.applied_promotion && (
                                                            <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 font-mono">
                                                                KM áp dụng
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Trạng thái */}
                                                    <td className="p-4">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusCfg.color}`}>
                                                            {statusCfg.label}
                                                        </span>
                                                    </td>

                                                    {/* Thao tác xem */}
                                                    <td className="p-4 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate('/admin?tab=bookings')}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50 text-slate-600 hover:text-blue-700 font-bold text-xs transition cursor-pointer shadow-2xs"
                                                        >
                                                            <span>Xem tại PMS</span>
                                                            <ExternalLink className="w-3 h-3" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* B. MOBILE CARD VIEW (< md) */}
                        <div className="block md:hidden divide-y divide-slate-100">
                            {isLoadingBookings ? (
                                <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center">
                                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin mb-2" />
                                    <span className="text-xs font-medium text-slate-600">Đang tải lịch sử đặt phòng của khách...</span>
                                </div>
                            ) : bookings.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 space-y-1.5 flex flex-col items-center justify-center">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-1">
                                        <Inbox className="w-6 h-6" />
                                    </div>
                                    <p className="font-semibold text-slate-700 text-xs">Chưa có dữ liệu đặt phòng</p>
                                    <p className="text-[11px] text-slate-400">Khách hàng này chưa thực hiện đơn đặt phòng nào trên hệ thống.</p>
                                </div>
                            ) : (
                                bookings.map((b) => {
                                    const statusCfg = BOOKING_STATUS_CONFIG[b.status] || {
                                        label: b.status_display || b.status,
                                        color: 'bg-slate-100 text-slate-800 border-slate-200'
                                    };
                                    const roomNum = b.room_number || b.room?.room_number;
                                    const categoryName = b.room_name || b.category?.name || b.room?.category?.name || 'Tiêu chuẩn';

                                    return (
                                        <div key={b.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <span className="font-mono font-black text-blue-600 text-sm">#{b.booking_code}</span>
                                                    <span className="block text-[10px] text-slate-400 mt-0.5">{formatDateTimeDisplay(b.created_at)}</span>
                                                </div>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${statusCfg.color}`}>
                                                    {statusCfg.label}
                                                </span>
                                            </div>

                                            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <strong className="font-bold text-slate-900 text-xs">{categoryName}</strong>
                                                    {roomNum ? (
                                                        <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px] font-bold">
                                                            P.{roomNum}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-[10px]">Chưa gán phòng</span>
                                                    )}
                                                </div>

                                                <div className="text-[11px] text-slate-600 flex items-center justify-between pt-1 border-t border-slate-200/50">
                                                    <span>Lưu trú:</span>
                                                    <div className="font-semibold text-slate-800 text-right flex items-center gap-1">
                                                        <span className="inline-flex items-center gap-0.5">
                                                            <LogIn className="w-3 h-3 text-blue-500" />
                                                            {formatDateDisplay(b.check_in_date)}
                                                        </span>
                                                        <span className="text-slate-400 mx-1">→</span>
                                                        <span className="inline-flex items-center gap-0.5">
                                                            <LogOut className="w-3 h-3 text-rose-500" />
                                                            {formatDateDisplay(b.check_out_date)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="text-[11px] flex items-center justify-between pt-1 border-t border-slate-200/50">
                                                    <span className="text-slate-500">Tổng tiền:</span>
                                                    <strong className="font-mono text-amber-600 font-bold text-xs">
                                                        {Number(b.total_amount || 0).toLocaleString('vi-VN')} đ
                                                    </strong>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-end pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => navigate('/admin?tab=bookings')}
                                                    className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-blue-50 hover:text-blue-700 text-slate-600 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                                                >
                                                    <span>Xem tại PMS</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Phân trang Tab 1 */}
                        {bookingTotalCount > 0 && (
                            <Pagination
                                currentPage={bookingCurrentPage}
                                totalPages={bookingTotalPages}
                                totalCount={bookingTotalCount}
                                pageSize={bookingPageSize}
                                onPageChange={handleBookingPageChange}
                                onPageSizeChange={handleBookingPageSizeChange}
                                pageSizeOptions={[5, 10, 20, 50]}
                            />
                        )}
                    </div>
                )}

                {/* ===================================================================== */}
                {/* TAB 2: LỊCH SỬ DỊCH VỤ                                                */}
                {/* ===================================================================== */}
                {activeTab === 'services' && (
                    <div>
                        {/* A. DESKTOP / TABLET TABLE VIEW (>= md) */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                        <th className="p-4">Tên Dịch Vụ / Món Ăn</th>
                                        <th className="p-4">Thuộc Mã Đơn & Phòng</th>
                                        <th className="p-4 text-center">Số Lượng</th>
                                        <th className="p-4">Thành Tiền</th>
                                        <th className="p-4">Ngày Giờ Yêu Cầu</th>
                                        <th className="p-4">Trạng Thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isLoadingServices ? (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-slate-400">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                                                    <span className="font-medium text-slate-600">Đang tải lịch sử sử dụng dịch vụ...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : serviceRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-slate-400">
                                                <div className="space-y-1.5 flex flex-col items-center justify-center">
                                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-1">
                                                        <Inbox className="w-6 h-6" />
                                                    </div>
                                                    <p className="font-semibold text-slate-700">Chưa có yêu cầu dịch vụ nào</p>
                                                    <p className="text-[11px] text-slate-400">Khách hàng chưa gọi món hoặc yêu cầu dịch vụ tại phòng.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        serviceRequests.map((req) => {
                                            const statusCfg = SERVICE_STATUS_CONFIG[req.status] || {
                                                label: req.status_display || req.status,
                                                color: 'bg-slate-100 text-slate-700 border-slate-200'
                                            };
                                            const serviceName = req.service_name || req.service?.name || 'Dịch vụ phòng';
                                            const bookingCode = req.booking_code || req.booking?.booking_code || '—';
                                            const roomNum = req.room_number || req.booking?.room?.room_number || '—';

                                            return (
                                                <tr key={req.id} className="hover:bg-slate-50/70 transition">
                                                    {/* Tên dịch vụ */}
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
                                                                {req.category_icon && !['🛎️', '🍽️', '🍸'].includes(req.category_icon) ? (
                                                                    <span>{req.category_icon}</span>
                                                                ) : (
                                                                    <Utensils className="w-4 h-4 text-blue-600" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <strong className="block font-bold text-slate-900 text-sm">
                                                                    {serviceName}
                                                                </strong>
                                                                {req.note && (
                                                                    <span className="text-[11px] text-slate-400 italic block mt-0.5 line-clamp-1">
                                                                        "{req.note}"
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Thuộc mã đơn nào */}
                                                    <td className="p-4">
                                                        <span className="font-mono font-bold text-blue-600 block">
                                                            #{bookingCode}
                                                        </span>
                                                        <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px] font-bold inline-block mt-0.5">
                                                            Phòng {roomNum}
                                                        </span>
                                                    </td>

                                                    {/* Số lượng */}
                                                    <td className="p-4 text-center">
                                                        <span className="font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg text-xs">
                                                            x{req.quantity || 1}
                                                        </span>
                                                    </td>

                                                    {/* Thành tiền */}
                                                    <td className="p-4">
                                                        <strong className="font-mono text-amber-600 font-bold text-sm block">
                                                            {Number(req.total_price || 0).toLocaleString('vi-VN')} đ
                                                        </strong>
                                                        <span className="text-[10px] text-slate-400">
                                                            ({Number((req.total_price || 0) / (req.quantity || 1)).toLocaleString('vi-VN')} đ/món)
                                                        </span>
                                                    </td>

                                                    {/* Ngày giờ */}
                                                    <td className="p-4 text-slate-700">
                                                        <span className="font-semibold block text-slate-900">
                                                            {formatDateTimeDisplay(req.created_at || req.request_time)}
                                                        </span>
                                                        {req.is_scheduled && req.request_time && (
                                                            <span className="text-[10px] text-amber-600 font-semibold block">
                                                                ⏰ Hẹn giao: {formatDateTimeDisplay(req.request_time)}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Trạng thái */}
                                                    <td className="p-4">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusCfg.color}`}>
                                                            {statusCfg.label}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* B. MOBILE CARD VIEW (< md) */}
                        <div className="block md:hidden divide-y divide-slate-100">
                            {isLoadingServices ? (
                                <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center">
                                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin mb-2" />
                                    <span className="text-xs font-medium text-slate-600">Đang tải lịch sử sử dụng dịch vụ...</span>
                                </div>
                            ) : serviceRequests.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 space-y-1.5 flex flex-col items-center justify-center">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-1">
                                        <Inbox className="w-6 h-6" />
                                    </div>
                                    <p className="font-semibold text-slate-700 text-xs">Chưa có yêu cầu dịch vụ nào</p>
                                    <p className="text-[11px] text-slate-400">Khách hàng chưa gọi món hoặc yêu cầu dịch vụ tại phòng.</p>
                                </div>
                            ) : (
                                serviceRequests.map((req) => {
                                    const statusCfg = SERVICE_STATUS_CONFIG[req.status] || {
                                        label: req.status_display || req.status,
                                        color: 'bg-slate-100 text-slate-700 border-slate-200'
                                    };
                                    const serviceName = req.service_name || req.service?.name || 'Dịch vụ phòng';
                                    const bookingCode = req.booking_code || req.booking?.booking_code || '—';
                                    const roomNum = req.room_number || req.booking?.room?.room_number || '—';

                                    return (
                                        <div key={req.id} className="p-4 space-y-2.5 hover:bg-slate-50/50 transition">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
                                                        {req.category_icon && !['🛎️', '🍽️', '🍸'].includes(req.category_icon) ? (
                                                            <span>{req.category_icon}</span>
                                                        ) : (
                                                            <Utensils className="w-4 h-4 text-blue-600" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <strong className="block font-bold text-slate-900 text-xs">{serviceName}</strong>
                                                        <span className="text-[10px] text-slate-400">{formatDateTimeDisplay(req.created_at || req.request_time)}</span>
                                                    </div>
                                                </div>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${statusCfg.color}`}>
                                                    {statusCfg.label}
                                                </span>
                                            </div>

                                            {req.note && (
                                                <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                    "{req.note}"
                                                </p>
                                            )}

                                            <div className="flex items-center justify-between text-xs pt-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-blue-600 font-bold text-[11px]">#{bookingCode}</span>
                                                    <span className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px] font-bold">
                                                        P.{roomNum}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                                        x{req.quantity || 1}
                                                    </span>
                                                    <strong className="font-mono text-amber-600 font-bold text-xs">
                                                        {Number(req.total_price || 0).toLocaleString('vi-VN')} đ
                                                    </strong>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Phân trang Tab 2 */}
                        {serviceTotalCount > 0 && (
                            <Pagination
                                currentPage={serviceCurrentPage}
                                totalPages={serviceTotalPages}
                                totalCount={serviceTotalCount}
                                pageSize={servicePageSize}
                                onPageChange={handleServicePageChange}
                                onPageSizeChange={handleServicePageSizeChange}
                                pageSizeOptions={[5, 10, 20, 50]}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
