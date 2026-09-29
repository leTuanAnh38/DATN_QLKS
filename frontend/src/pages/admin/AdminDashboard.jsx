import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/authStore';
import { bookingService } from '../../services/bookingService';
import GuestManagement from '../../components/admin/GuestManagement';
import EmployeeManagement from '../../components/admin/EmployeeManagement';
import RoomManagement from '../../components/admin/RoomManagement';
import CategoryManagement from '../../components/admin/CategoryManagement';
import BookingManagement from '../../components/admin/BookingManagement';
import UserAvatar from '../../components/common/UserAvatar';

export default function HotelAdminDashboard() {
    const { user, isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('overview');
    const [timeFilter, setTimeFilter] = useState('month');
    const [bookingFilter, setBookingFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Số lượng đơn đặt phòng thực tế từ cơ sở dữ liệu
    const [actualBookingsCount, setActualBookingsCount] = useState(0);
    const [pendingBookingsCount, setPendingBookingsCount] = useState(0);

    // Kiểm tra phân hệ: Cho phép tài khoản Quản trị, Lễ tân và Nhân sự
    // (admin, owner, manager, receptionist, staff, cashier hoặc is_staff, is_superuser)
    const isManagerRole = Boolean(
        isAuthenticated &&
        user &&
        (['admin', 'owner', 'manager', 'receptionist', 'staff', 'cashier'].includes(user.role) || user.is_staff || user.is_superuser)
    );

    // Tải số lượng đơn đặt phòng thực tế từ CSDL để hiển thị badge và thống kê
    const loadRealBookingStats = async () => {
        try {
            const res = await bookingService.getMyBookings();
            if (res && res.success && Array.isArray(res.data)) {
                const list = res.data;
                setActualBookingsCount(list.length);
                const pending = list.filter((b) => b.status === 'pending').length;
                setPendingBookingsCount(pending);
            }
        } catch (e) {
            console.error('Lỗi khi tải số lượng đơn thực tế:', e);
        }
    };

    useEffect(() => {
        if (isAuthenticated && isManagerRole) {
            loadRealBookingStats();
        }
    }, [isAuthenticated, isManagerRole, activeTab]);

    // Xử lý đăng xuất
    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Helper tên vai trò hiển thị
    const getRoleDisplayName = (roleCode) => {
        switch (roleCode) {
            case 'admin':
                return 'Quản Trị Viên Hệ Thống (Admin)';
            case 'owner':
                return 'Chủ Sở Hữu / Cấp Cao (Owner)';
            case 'manager':
                return 'Tổng Giám Đốc Điều Hành (General Manager)';
            case 'receptionist':
                return 'Nhân Viên Lễ Tân & Tiếp Đón (Receptionist)';
            case 'staff':
                return 'Nhân Viên Khách Sạn (Staff)';
            default:
                return 'Cán Bộ Nhân Viên Khách Sạn';
        }
    };

    // =========================================================================
    // NẾU CHƯA ĐĂNG NHẬP HOẶC KHÔNG PHẢI PHÂN HỆ QUẢN LÝ -> HIỂN THỊ CHẶN BẢO MẬT
    // =========================================================================
    if (!isAuthenticated || !isManagerRole) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
                {/* Background decorative glow */}
                <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-center space-y-6">
                    {/* Security Badge */}
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500/20 to-rose-500/20 border border-amber-500/30 flex items-center justify-center text-4xl shadow-lg shadow-amber-500/10">
                        🛡️
                    </div>

                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-bold uppercase tracking-wider mb-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                            TRUY CẬP ĐƯỢC BẢO VỆ
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                            Phân Hệ Quản Lý Nội Bộ
                        </h1>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                            Cổng quản trị <strong>AdminDashboard</strong> của Khách Sạn TA Đà Nẵng chỉ dành riêng cho các tài khoản có phân hệ là Quản Lý (Admin, Chủ đầu tư, Tổng Giám Đốc).
                        </p>
                    </div>

                    {/* Trường hợp: Đã đăng nhập nhưng là tài khoản Khách hàng (role = 'guest') */}
                    {isAuthenticated && user && !isManagerRole && (
                        <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/60 text-left space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">Tài khoản đang đăng nhập:</span>
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                                    HỘI VIÊN KHÁCH HÀNG
                                </span>
                            </div>
                            <div className="font-bold text-white text-sm">
                                {user.full_name || user.username}
                            </div>
                            <div className="text-xs text-slate-400">
                                Email: {user.email || '—'}
                            </div>
                            <div className="text-[11px] text-rose-300 pt-1 border-t border-slate-700/50">
                                ⚠️ Tài khoản khách hàng thường không có thẩm quyền truy cập cơ sở dữ liệu và vận hành hệ thống.
                            </div>
                        </div>
                    )}

                    {/* Nút hành động */}
                    <div className="space-y-3 pt-2">
                        {isAuthenticated ? (
                            <>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/30 transition"
                                >
                                    Đăng xuất & Đăng nhập Tài khoản Quản lý
                                </button>
                                <Link
                                    to="/"
                                    className="block w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs rounded-xl transition text-center"
                                >
                                    ← Về lại Trang chủ Khách hàng
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="block w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/30 transition text-center"
                                >
                                    Đăng Nhập Tài Khoản Quản Lý
                                </Link>
                                <Link
                                    to="/"
                                    className="block w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs rounded-xl transition text-center"
                                >
                                    ← Quay về Trang chủ Khách sạn
                                </Link>
                            </>
                        )}
                    </div>

                    <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800">
                        Hệ thống Kiểm soát Truy cập Phân quyền (RBAC) • TA Da Nang Luxury Hotel
                    </div>
                </div>
            </div>
        );
    }

    // =========================================================================
    // DỮ LIỆU ĐẶT PHÒNG CHO TAB TỔNG QUAN
    // =========================================================================
    const bookings = [
        {
            id: '#BK-9281',
            guest: { name: 'Trần Hoàng Cường', email: 'cuong.tran@gmail.com', avatarText: 'TC', isVip: true },
            room: { name: 'Executive Club Seafront Suite', detail: '3 Đêm • 2 Khách lớn' },
            schedule: { dates: '25/09 - 28/09/2026', note: 'Nhận: 14:00 (VIP check-in)' },
            payment: { amount: '28.500.000 ₫', status: 'Đã thanh toán (Visa)' },
            status: 'confirmed'
        },
        {
            id: '#BK-9280',
            guest: { name: 'Emma Watson', email: '+44 7911 123456', avatarText: 'EW', isVip: false },
            room: { name: 'Deluxe Ocean King', detail: '2 Đêm • 1 Khách' },
            schedule: { dates: '26/09 - 28/09/2026', note: 'Nhận: 15:00 dự kiến' },
            payment: { amount: '9.600.000 ₫', status: 'Chờ thanh toán tại Cổng' },
            status: 'pending'
        },
        {
            id: '#BK-9279',
            guest: { name: 'Nguyễn Lan Hương', email: 'lanhuong.danang@gmail.com', avatarText: 'NL', isVip: true },
            room: { name: 'Beachfront Villa', detail: '4 Đêm • 4 Khách lớn' },
            schedule: { dates: '27/09 - 01/10/2026', note: 'Nhận: 14:00' },
            payment: { amount: '64.000.000 ₫', status: 'Thanh toán trực tuyến 100%' },
            status: 'confirmed'
        },
        {
            id: '#BK-9278',
            guest: { name: 'Takashi Kato', email: 'kato.tokyo@resort.jp', avatarText: 'TK', isVip: false },
            room: { name: 'Ocean Penthouse', detail: '2 Đêm • 2 Khách' },
            schedule: { dates: '25/09 - 27/09/2026', note: 'Hủy ngày 23/09' },
            payment: { amount: '32.000.000 ₫', status: 'Hoàn tiền thẻ thành công' },
            status: 'cancelled'
        },
        {
            id: '#BK-9277',
            guest: { name: 'Lê Minh Tuấn', email: '0905 128 999', avatarText: 'LM', isVip: false },
            room: { name: 'Deluxe Ocean King', detail: '1 Đêm • 2 Khách' },
            schedule: { dates: '25/09 - 26/09/2026', note: 'Nhận phòng sớm 12:00' },
            payment: { amount: '4.800.000 ₫', status: 'Đã thanh toán (Trực tuyến)' },
            status: 'checked_in'
        },
        {
            id: '#BK-9276',
            guest: { name: 'David Smith', email: 'd.smith@auscorp.au', avatarText: 'DS', isVip: false },
            room: { name: 'Executive Club Suite', detail: '5 Đêm • 1 Khách' },
            schedule: { dates: '28/09 - 03/10/2026', note: 'Nhận: 14:00' },
            payment: { amount: '47.500.000 ₫', status: 'Cọc 50% qua Booking.com' },
            status: 'pending'
        }
    ];

    const filteredBookings = bookings.filter((item) => {
        const matchFilter =
            bookingFilter === 'all'
                ? true
                : bookingFilter === 'pending'
                    ? item.status === 'pending'
                    : item.status === 'checked_in';
        const matchSearch =
            item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.guest.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.room.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchFilter && matchSearch;
    });

    return (
        <div className="flex min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white">
            {/* ========================================================================= */}
            {/* 1. SIDEBAR CỐ ĐỊNH BÊN TRÁI */}
            {/* ========================================================================= */}
            <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 fixed inset-y-0 left-0 z-40 border-r border-slate-800">
                <div>
                    {/* Logo Brand Header */}
                    <Link to="/" className="h-20 flex items-center px-6 border-b border-slate-800/80 gap-3 hover:bg-slate-800/40 transition">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-serif font-black text-xl shadow-lg shadow-blue-600/40">
                            TA
                        </div>
                        <div className="flex flex-col">
                            <span className="text-white font-bold text-base tracking-wide font-serif"> TA ĐÀ NẴNG </span>
                            <span className="text-[10px] text-blue-400 uppercase tracking-widest font-semibold"> Luxury Hotel Admin </span>
                        </div>
                    </Link>

                    {/* Nav Links */}
                    <div className="px-4 py-6">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-3 block">
                            Quản trị & Phân quyền
                        </span>
                        <nav className="space-y-1">
                            {/* 1. Tổng quan */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('overview')}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${activeTab === 'overview'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                                <span>Tổng quan</span>
                            </button>

                            {/* 2. Quản lý Khách hàng (Feature 1) */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('guests')}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${activeTab === 'guests'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    <span>Quản lý Khách hàng</span>
                                </div>
                                <span className="bg-blue-500/30 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-400/30">
                                    VIP
                                </span>
                            </button>

                            {/* 3. Quản lý Nhân sự & Phân quyền (Feature 2) */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('employees')}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${activeTab === 'employees'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <span>Quản lý Nhân sự</span>
                                </div>
                                <span className="bg-indigo-500/30 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-400/30">
                                    RBAC
                                </span>
                            </button>

                            {/* 4. Sơ đồ & Quản lý Phòng (PMS Room Board) */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('rooms')}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${activeTab === 'rooms'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                    </svg>
                                    <span>Sơ đồ Phòng</span>
                                </div>
                                <span className="bg-emerald-500/30 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
                                    PMS
                                </span>
                            </button>

                            {/* 5. Quản lý Hạng phòng & Bảng giá (Room Categories & Multi-Images) */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('categories')}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${activeTab === 'categories'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    <span>Hạng phòng & Bảng giá</span>
                                </div>
                                <span className="bg-amber-500/30 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
                                    Suites
                                </span>
                            </button>

                            {/* 5. Quản lý Đặt phòng */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('bookings')}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${activeTab === 'bookings' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span>Quản lý Đặt phòng</span>
                                </div>
                                <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    {actualBookingsCount}
                                </span>
                            </button>

                            {/* 6. Quản lý Dịch vụ */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('services')}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${activeTab === 'services' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                <span>Quản lý Dịch vụ</span>
                            </button>

                            {/* 7. Thanh toán & Hóa đơn */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('finance')}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${activeTab === 'finance' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                                </svg>
                                <span>Thanh toán & Hóa đơn</span>
                            </button>

                            {/* 8. Cài đặt hệ thống */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('settings')}
                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                            >
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>Cài đặt hệ thống</span>
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Sidebar Footer Widget: Thông tin tài khoản quản lý & Đăng xuất */}
                <div className="p-4 border-t border-slate-800/80 space-y-2">
                    <div className="bg-slate-800/60 rounded-2xl p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar
                                avatar={user?.avatar}
                                name={user?.full_name || user?.username}
                                role={user?.role}
                                size="sm"
                                border={false}
                            />
                            <div className="min-w-0">
                                <strong className="text-white block font-semibold truncate text-[11px]">
                                    {user?.full_name || user?.username}
                                </strong>
                                <span className="text-[10px] text-blue-400 block truncate">
                                    {user?.role?.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 rounded-lg transition"
                            title="Đăng xuất khỏi hệ thống"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                    <Link
                        to="/"
                        className="block text-center py-1.5 text-[11px] text-slate-400 hover:text-white transition"
                    >
                        ← Xem trang chủ khách hàng
                    </Link>
                </div>
            </aside>

            {/* ========================================================================= */}
            {/* 2. KHU VỰC NỘI DUNG CHÍNH (BÊN PHẢI ml-64) */}
            {/* ========================================================================= */}
            <div className="flex-1 ml-64 flex flex-col min-h-screen">
                {/* Top Navbar */}
                <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
                    {/* Search bar */}
                    <div className="relative w-96">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            placeholder="Tìm kiếm phòng, khách hàng, mã đặt chỗ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                        />
                    </div>

                    {/* Right Status + Notifications + Avatar */}
                    <div className="flex items-center space-x-6">
                        <div className="hidden lg:flex flex-col text-right">
                            <span className="text-xs font-bold text-slate-900">
                                {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                            <span className="text-[11px] text-emerald-600 font-medium flex items-center justify-end gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Hệ thống máy chủ ổn định
                            </span>
                        </div>

                        {/* Chuông thông báo */}
                        <div className="relative cursor-pointer">
                            <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </div>
                            <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                                5
                            </span>
                        </div>

                        {/* Profile Avatar Quản lý */}
                        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                            <div className="flex flex-col text-right">
                                <span className="text-xs font-bold text-slate-900 leading-tight">
                                    {user?.full_name || user?.username}
                                </span>
                                <span className="text-[10px] text-blue-600 font-semibold">
                                    {getRoleDisplayName(user?.role)}
                                </span>
                            </div>
                            <UserAvatar
                                avatar={user?.avatar}
                                name={user?.full_name || user?.username}
                                role={user?.role}
                                size="md"
                                border={true}
                                showOnline={true}
                            />
                        </div>
                    </div>
                </header>

                {/* Nội dung bảng điều khiển thay đổi theo Tab */}
                <main className="p-8 space-y-6 flex-1">
                    {/* TAB 1: QUẢN LÝ KHÁCH HÀNG (FEATURE 1) */}
                    {activeTab === 'guests' && <GuestManagement />}

                    {/* TAB 2: QUẢN LÝ NHÂN SỰ & PHÂN QUYỀN (FEATURE 2) */}
                    {activeTab === 'employees' && <EmployeeManagement />}

                    {/* TAB 3: QUẢN LÝ DANH SÁCH & SƠ ĐỒ PHÒNG THỰC TẾ (PMS ROOM BOARD) */}
                    {activeTab === 'rooms' && <RoomManagement />}

                    {/* TAB 4: QUẢN LÝ HẠNG PHÒNG & BẢNG GIÁ (CRUD + MULTI-IMAGE UPLOAD) */}
                    {activeTab === 'categories' && <CategoryManagement />}

                    {/* TAB 5: QUẢN LÝ DANH SÁCH ĐẶT PHÒNG (LỄ TÂN & ADMIN) */}
                    {activeTab === 'bookings' && <BookingManagement onBookingChanged={loadRealBookingStats} />}

                    {/* TAB TỔNG QUAN HỆ THỐNG */}
                    {activeTab === 'overview' && (
                        <>
                            {/* Welcome & Time Filters Banner */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase tracking-wider">
                                            LIVE PMS 5-STAR PORTAL
                                        </span>
                                        <span className="text-xs text-slate-400">•</span>
                                        <span className="text-xs text-slate-500">Đồng bộ PMS thời gian thực</span>
                                    </div>
                                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                                        Xin chào, {user?.full_name || user?.username} 👋
                                    </h1>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Bảng điều khiển vận hành khách sạn & giám sát công suất phòng thực tế tại Khách Sạn TA Đà Nẵng.
                                    </p>
                                </div>

                                {/* Filter buttons & CTA */}
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold text-slate-600">
                                        <button
                                            type="button"
                                            onClick={() => setTimeFilter('today')}
                                            className={`px-3 py-1.5 rounded-lg transition ${timeFilter === 'today' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                                                }`}
                                        >
                                            Hôm nay
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTimeFilter('7days')}
                                            className={`px-3 py-1.5 rounded-lg transition ${timeFilter === '7days' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                                                }`}
                                        >
                                            7 ngày qua
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTimeFilter('month')}
                                            className={`px-3 py-1.5 rounded-lg transition ${timeFilter === 'month' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'
                                                }`}
                                        >
                                            Tháng này (9/2026)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTimeFilter('year')}
                                            className={`px-3 py-1.5 rounded-lg transition ${timeFilter === 'year' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                                                }`}
                                        >
                                            Năm 2026
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('guests')}
                                        className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5"
                                    >
                                        <span>👥</span>
                                        <span>Khách Hàng</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('employees')}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/25 transition flex items-center gap-1.5"
                                    >
                                        <span>🛡️</span>
                                        <span>Nhân Sự & Phân Quyền</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('rooms')}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/25 transition flex items-center gap-1.5"
                                    >
                                        <span>🏢</span>
                                        <span>Sơ Đồ Phòng (PMS)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('bookings')}
                                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/25 transition flex items-center gap-1.5"
                                    >
                                        <span>📅</span>
                                        <span>Xử Lý Đặt Phòng</span>
                                    </button>
                                </div>
                            </div>

                            {/* 4 Quick Stat Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                {/* 1. Doanh thu */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400"> DOANH THU THÁNG 09 </span>
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs"> $ </div>
                                        </div>
                                        <div className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
                                            3.845.000.000 <span className="text-xs font-normal text-slate-500">VND</span>
                                        </div>
                                        <div className="flex items-center text-xs text-emerald-600 font-bold gap-1">
                                            <span>↗ +18.4%</span>
                                            <span className="text-[11px] text-slate-400 font-normal">so với tháng trước</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                        <span>Mục tiêu Q3: 4.2 tỷ</span>
                                        <span className="font-semibold text-blue-600">Đạt 91.5%</span>
                                    </div>
                                </div>

                                {/* 2. Công suất phòng */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400"> CÔNG SUẤT PHÒNG </span>
                                            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center text-xs"> 🏠 </div>
                                        </div>
                                        <div className="flex items-baseline justify-between mb-1.5">
                                            <span className="text-xl sm:text-2xl font-bold text-slate-900">
                                                88<span className="text-sm font-normal text-slate-400">/112</span>
                                            </span>
                                            <span className="text-xs text-slate-500">Phòng có khách</span>
                                            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full"> 78.5% </span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-2">
                                            <div className="bg-orange-500 h-2 rounded-full" style={{ width: '78.5%' }}></div>
                                        </div>
                                    </div>
                                    <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                        <span>Sẵn sàng đón khách</span>
                                        <strong className="text-slate-800">24 Phòng trống</strong>
                                    </div>
                                </div>

                                {/* 3. Chờ xác nhận */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400"> CHỜ XÁC NHẬN </span>
                                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xs"> 🕒 </div>
                                        </div>
                                        <div className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
                                            {pendingBookingsCount} <span className="text-xs font-normal text-slate-500">Đơn chờ duyệt</span>
                                        </div>
                                        <div className="text-xs text-amber-600 font-medium flex items-center gap-1">
                                            <span>⚠️ {pendingBookingsCount > 0 ? 'Cần phản hồi < 15 phút' : 'Tất cả đơn đã được xử lý'}</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                        <span>Tổng đơn trong hệ thống</span>
                                        <strong className="text-slate-800">{actualBookingsCount} Đơn thực tế</strong>
                                    </div>
                                </div>

                                {/* 4. Yêu cầu dịch vụ */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400"> YÊU CẦU DỊCH VỤ </span>
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs"> 🔔 </div>
                                        </div>
                                        <div className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
                                            28 <span className="text-xs font-normal text-slate-500">Yêu cầu nóng</span>
                                        </div>
                                        <div className="text-xs text-slate-500 flex items-center gap-3">
                                            <span>Spa: <strong className="text-slate-800">12</strong></span>
                                            <span>F&B: <strong className="text-slate-800">10</strong></span>
                                            <span>Shuttle: <strong className="text-slate-800">6</strong></span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                        <span>Trạng thái phân bổ</span>
                                        <strong className="text-blue-600">8 Chưa điều phối</strong>
                                    </div>
                                </div>
                            </div>

                            {/* CÔNG SUẤT THEO HẠNG PHÒNG & NGUỒN ĐẶT PHÒNG */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* Biểu đồ thanh tiến độ công suất các hạng phòng (8 cột) */}
                                <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block"> GIÁM SÁT CÔNG SUẤT </span>
                                            <h3 className="text-base font-bold text-slate-900"> Tỷ lệ lấp đầy theo hạng phòng </h3>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-500">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-2.5 h-2.5 rounded-sm bg-blue-600"></span> Đang ở
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-2.5 h-2.5 rounded-sm bg-slate-200"></span> Trống
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-4 text-xs">
                                        <div>
                                            <div className="flex justify-between font-medium text-slate-700 mb-1">
                                                <span>Deluxe Ocean King (48 phòng)</span>
                                                <span>
                                                    <strong className="text-slate-900">42/48 phòng</strong> (87.5%)
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                                <div className="bg-blue-600 h-3 rounded-full" style={{ width: '87.5%' }}></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between font-medium text-slate-700 mb-1">
                                                <span>Executive Club Suite (32 phòng)</span>
                                                <span>
                                                    <strong className="text-slate-900">25/32 phòng</strong> (78.1%)
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                                <div className="bg-blue-600 h-3 rounded-full" style={{ width: '78.1%' }}></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between font-medium text-slate-700 mb-1">
                                                <span>Beachfront Presidential Villa (16 căn)</span>
                                                <span>
                                                    <strong className="text-slate-900">14/16 căn</strong> (87.5%)
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                                <div className="bg-orange-500 h-3 rounded-full" style={{ width: '87.5%' }}></div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between font-medium text-slate-700 mb-1">
                                                <span>Ocean Penthouse Signature (16 phòng)</span>
                                                <span>
                                                    <strong className="text-slate-900">7/16 phòng</strong> (43.7%)
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                                <div className="bg-blue-400 h-3 rounded-full" style={{ width: '43.7%' }}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Donut Chart Cơ cấu lưu trú */}
                                <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block"> CƠ CẤU LƯU TRÚ </span>
                                        <h3 className="text-base font-bold text-slate-900 mb-4"> Nguồn Đặt Phòng </h3>
                                        <div className="relative flex items-center justify-center my-4">
                                            <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 100 100">
                                                <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                                                <circle cx="50" cy="50" r="38" fill="none" stroke="#2563eb" strokeWidth="12" strokeDasharray="238.76" strokeDashoffset="90.72" strokeLinecap="round" />
                                                <circle cx="50" cy="50" r="38" fill="none" stroke="#f97316" strokeWidth="12" strokeDasharray="238.76" strokeDashoffset="181.45" transform="rotate(223.2 50 50)" />
                                                <circle cx="50" cy="50" r="38" fill="none" stroke="#0f172a" strokeWidth="12" strokeDasharray="238.76" strokeDashoffset="205.33" transform="rotate(309.6 50 50)" />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <span className="text-xl font-black text-slate-900">142</span>
                                                <span className="text-[9px] uppercase tracking-wider text-slate-400">Lượt đặt / tuần</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                                        <div className="flex items-center justify-between">
                                            <span className="flex items-center gap-2 text-slate-600">
                                                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> TA Direct Website
                                            </span>
                                            <span className="font-bold text-slate-900">62% (88)</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="flex items-center gap-2 text-slate-600">
                                                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> OTA Booking/Agoda
                                            </span>
                                            <span className="font-bold text-slate-900">24% (34)</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="flex items-center gap-2 text-slate-600">
                                                <span className="w-2.5 h-2.5 rounded-full bg-slate-900"></span> Hội Viên VIP Club
                                            </span>
                                            <span className="font-bold text-slate-900">14% (20)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BẢNG DỮ LIỆU ĐẶT PHÒNG MỚI NHẤT */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900"> Danh sách Đặt phòng mới nhất </h3>
                                            <p className="text-xs text-slate-500 mt-0.5"> Dữ liệu đặt phòng thời gian thực đồng bộ tự động </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs">
                                                <button
                                                    type="button"
                                                    onClick={() => setBookingFilter('all')}
                                                    className={`px-3 py-1 rounded-lg font-semibold transition ${bookingFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                                                        }`}
                                                >
                                                    Tất cả
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setBookingFilter('pending')}
                                                    className={`px-3 py-1 rounded-lg font-semibold transition ${bookingFilter === 'pending' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-600'
                                                        }`}
                                                >
                                                    Chờ duyệt
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setBookingFilter('checked_in')}
                                                    className={`px-3 py-1 rounded-lg font-semibold transition ${bookingFilter === 'checked_in' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600'
                                                        }`}
                                                >
                                                    Đã check-in
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Table */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                    <th className="py-3 px-5">MÃ BOOKING</th>
                                                    <th className="py-3 px-5">KHÁCH HÀNG</th>
                                                    <th className="py-3 px-5">HẠNG PHÒNG & THỜI GIAN</th>
                                                    <th className="py-3 px-5">LỊCH TRÌNH</th>
                                                    <th className="py-3 px-5">TỔNG TIỀN & KÊNH</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredBookings.map((b) => (
                                                    <tr key={b.id} className="hover:bg-blue-50/20 transition">
                                                        <td className="py-3.5 px-5 font-mono font-bold text-blue-600"> {b.id} </td>
                                                        <td className="py-3.5 px-5">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                                                                    {b.guest.avatarText}
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="font-semibold text-slate-900">{b.guest.name}</span>
                                                                        {b.guest.isVip && (
                                                                            <span className="bg-amber-100 text-amber-800 text-[8px] font-extrabold px-1 rounded"> VIP </span>
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[10px] text-slate-400 block">{b.guest.email}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-3.5 px-5">
                                                            <strong className="text-slate-800 block font-medium">{b.room.name}</strong>
                                                            <span className="text-[10px] text-slate-400">{b.room.detail}</span>
                                                        </td>
                                                        <td className="py-3.5 px-5">
                                                            <span className="font-semibold text-slate-800 block">{b.schedule.dates}</span>
                                                            <span className="text-[10px] text-slate-400">{b.schedule.note}</span>
                                                        </td>
                                                        <td className="py-3.5 px-5">
                                                            <span className="font-bold text-slate-900 block">{b.payment.amount}</span>
                                                            <span className="text-[10px] text-blue-600">{b.payment.status}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Concierge & Dịch Vụ Nóng */}
                                <div className="lg:col-span-4 space-y-6">
                                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
                                                <h3 className="text-base font-bold text-slate-900"> Concierge & Dịch Vụ Nóng </h3>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">HÔM NAY</span>
                                        </div>
                                        <div className="space-y-3.5 text-xs">
                                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                                                <span className="text-lg">🚖</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <strong className="text-slate-900 text-xs">Maybach S-Class đón sân bay</strong>
                                                        <span className="text-[10px] text-orange-600 font-bold">14:00</span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 mt-1">
                                                        Khách VIP Robert Chen (VN-128). Lái xe: Nguyễn Văn An đã sẵn sàng.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                                                <span className="text-lg">🍵</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <strong className="text-slate-900 text-xs">Trà Chiều Hoàng Gia</strong>
                                                        <span className="text-[10px] text-slate-400">Phòng 1802</span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 mt-1">
                                                        02 set High-Tea kiểu Anh cùng bánh scone tươi tại ban công tầng 18.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* CÁC TAB KHÁC NẾU CHỌN */}
                    {!['overview', 'guests', 'employees', 'rooms', 'categories', 'bookings'].includes(activeTab) && (
                        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                                🛠️
                            </div>
                            <h2 className="text-lg font-bold text-slate-900">
                                Phân hệ {activeTab.toUpperCase()} đang được kết nối dữ liệu PMS
                            </h2>
                            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                                Chức năng đang hoạt động trong tiến trình mở rộng. Bạn có thể sử dụng đầy đủ <strong>Quản lý Khách hàng</strong> và <strong>Quản lý Nhân sự & Phân quyền</strong>.
                            </p>
                            <div className="mt-6 flex items-center justify-center gap-3">
                                <button
                                    onClick={() => setActiveTab('guests')}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30"
                                >
                                    Quản lý Khách Hàng
                                </button>
                                <button
                                    onClick={() => setActiveTab('employees')}
                                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
                                >
                                    Quản lý Nhân Sự & Phân Quyền
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}