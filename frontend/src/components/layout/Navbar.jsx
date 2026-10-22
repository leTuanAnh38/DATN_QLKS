import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/authStore';
import { authService } from '../../services/authService';
import api from '../../services/api';
import ChangePasswordModal from '../auth/ChangePasswordModal';
import LogoutConfirmModal from '../common/LogoutConfirmModal';
import UserAvatar from '../common/UserAvatar';
import NotificationBell from '../common/NotificationBell';
import { isStaffRole, getRoleTitle } from '../../utils/permission';
import { useHotelSettings } from '../../store/hotelSettingStore';

const getAvatarUrl = (avatar) => {
    if (!avatar) return null;
    if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('data:')) {
        return avatar;
    }
    const backendBase = 'http://localhost:8000';
    return `${backendBase}${avatar.startsWith('/') ? '' : '/'}${avatar}`;
};

export default function Navbar({
    actionText = 'Đặt phòng ngay',
    actionLink = '/rooms',
    onActionClick = null
}) {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, isAuthenticated, logout } = useAuth();

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const userMenuRef = useRef(null);

    // Thông tin thương hiệu & Logo động từ cài đặt hệ thống
    const { settings } = useHotelSettings();
    const hotelNameDisplay = settings?.hotel_name ? `${settings.hotel_name.toUpperCase()} LUXURY COLLECTION` : 'KHÁCH SẠN TA ĐÀ NẴNG LUXURY COLLECTION';
    const hotlineDisplay = settings?.hotline || '1900 8899';

    // Tự động đóng dropdown khi click ra ngoài
    useEffect(() => {
        function handleClickOutside(event) {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setUserMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Lấy ký tự viết tắt của tên để tạo Avatar mặc định
    const getInitials = (name) => {
        if (!name) return 'TA';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const handleRequestLogout = () => {
        setUserMenuOpen(false);
        setMobileMenuOpen(false);
        setIsLogoutModalOpen(true);
    };

    const handleConfirmLogout = async () => {
        try {
            setIsLoggingOut(true);
            await authService.logout();
            setIsLogoutModalOpen(false);
            navigate('/');
        } catch (err) {
            console.error('Logout error:', err);
            setIsLogoutModalOpen(false);
            navigate('/');
        } finally {
            setIsLoggingOut(false);
        }
    };

    const navItems = [
        {
            name: 'Trang chủ',
            path: '/',
            isActive: (path) => path === '/'
        },
        {
            name: 'Phòng nghỉ & Suites',
            path: '/rooms',
            isActive: (path) => path === '/rooms' || path.startsWith('/rooms/') || path.startsWith('/room/')
        },
        {
            name: 'Menu Dịch vụ',
            path: '/services',
            isActive: (path) => path.startsWith('/services') || path.startsWith('/menu')
        },
        {
            name: 'Ưu đãi đặc quyền',
            path: '/promotions',
            isActive: (path) => path.startsWith('/promotions')
        },
        {
            name: 'Tin tức',
            path: '/news',
            isActive: (path) => path.startsWith('/news')
        },
        {
            name: 'Liên hệ',
            path: '/contact',
            isActive: (path) => path.startsWith('/contact')
        }
    ];

    const handleActionClick = (e) => {
        if (onActionClick) {
            e.preventDefault();
            onActionClick();
        }
    };

    return (
        <>
            {/* 1. TOP ANNOUNCEMENT BAR */}
            <div className="bg-slate-50 text-slate-600 text-xs py-2 px-4 border-b border-slate-200">
                <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center space-x-4">
                        <span className="font-semibold tracking-wider text-amber-600 uppercase text-[11px]">
                            {hotelNameDisplay}
                        </span>
                        <span className="hidden sm:inline text-slate-300">|</span>
                        <span className="hidden sm:inline flex items-center gap-1 text-slate-500">
                            <span className="text-amber-500 font-bold">{'★'.repeat(settings?.stars || 3)}</span>
                            Tiêu Chuẩn {settings?.stars || 3} Sao Quốc Tế
                        </span>
                        {isAuthenticated && (
                            <>
                                <span className="hidden md:inline text-slate-300">|</span>
                                <span className="hidden md:inline text-amber-700 font-medium">
                                     Kính chào Quý khách: <strong>{user?.full_name || user?.username}</strong>
                                </span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center space-x-4 text-slate-600">
                        <a href={`tel:${hotlineDisplay.replace(/\s+/g, '')}`} className="flex items-center gap-1.5 hover:text-blue-600 cursor-pointer transition">
                            <span className="text-orange-500">📞</span>
                            Hotline 24/7: <strong className="text-slate-900">{hotlineDisplay}</strong>
                        </a>
                        <span className="text-slate-300">|</span>
                        <div className="flex items-center space-x-2">
                            <span className="cursor-pointer hover:text-blue-600">🇻🇳 VND</span>
                            <span>/</span>
                            <span className="cursor-pointer hover:text-blue-600">Tiếng Việt</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. HEADER NAVIGATION */}
            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-3 xl:gap-8">
                    {/* Brand Logo */}
                    <Link to="/" className="flex items-center space-x-3 cursor-pointer group shrink-0">
                        {settings?.logo_url ? (
                            <img
                                src={settings.logo_url}
                                alt={settings.hotel_name || 'Khách Sạn TA Đà Nẵng'}
                                className="h-11 max-w-[170px] object-contain rounded-xl shadow-xs group-hover:scale-105 transition-transform"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/30 flex-shrink-0 group-hover:scale-105 transition-transform">
                                <span className="text-white font-serif font-black text-xl tracking-tighter">TA</span>
                            </div>
                        )}
                        <div className="flex flex-col">
                            <span className="font-serif font-bold text-slate-900 text-lg leading-tight tracking-wide whitespace-nowrap group-hover:text-blue-600 transition-colors">
                                {settings?.hotel_name ? settings.hotel_name.slice(0, 24) : 'KHÁCH SẠN TA'}
                            </span>
                            <span className="text-[10px] font-semibold text-blue-600 tracking-[0.2em] uppercase whitespace-nowrap">
                                {settings?.hotel_slogan ? settings.hotel_slogan.slice(0, 36) : `ĐÀ NẴNG ${'★'.repeat(settings?.stars || 3)}`}
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Navigation Links */}
                    <nav className="hidden lg:flex items-center space-x-3.5 xl:space-x-5 2xl:space-x-7 text-[13px] xl:text-sm font-medium shrink-0">
                        {navItems.map((item) => {
                            const active = item.isActive(location.pathname);
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`whitespace-nowrap transition-colors duration-200 py-1 ${
                                        active
                                            ? 'text-blue-600 font-bold border-b-2 border-blue-600'
                                            : 'text-slate-700 hover:text-blue-600'
                                    }`}
                                >
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Header Actions */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {/* Nút Đặt phòng ngay hiện đại, sang trọng */}
                        <Link
                            to={actionLink}
                            onClick={handleActionClick}
                            className="hidden sm:inline-flex items-center gap-2 px-3.5 xl:px-4.5 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 text-white font-bold text-xs xl:text-[13px] rounded-xl shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 whitespace-nowrap shrink-0 group cursor-pointer"
                        >
                            <svg className="w-4 h-4 text-white/95 group-hover:scale-110 transition-transform shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="tracking-wide">{actionText}</span>
                            <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] group-hover:translate-x-0.5 transition-transform shrink-0">
                                →
                            </span>
                        </Link>

                        {/* AUTH SECTION: NÚT ĐĂNG NHẬP HOẶC AVATAR MẶC ĐỊNH KHI ĐÃ ĐĂNG NHẬP */}
                        {!isAuthenticated ? (
                            // Khi CHƯA đăng nhập: Hiển thị Nút Đăng nhập hiện đại
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 px-3 xl:px-3.5 py-2 xl:py-2.5 rounded-xl text-xs xl:text-[13px] font-semibold text-slate-700 hover:text-blue-600 bg-slate-50/90 hover:bg-white border border-slate-200 hover:border-blue-400 shadow-xs hover:shadow-md hover:shadow-blue-500/10 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 whitespace-nowrap shrink-0 group cursor-pointer"
                            >
                                <div className="w-5 h-5 rounded-lg bg-white border border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-600 text-slate-600 group-hover:text-white flex items-center justify-center transition-all duration-200 shrink-0">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <span className="tracking-tight">Đăng nhập</span>
                            </Link>
                        ) : (
                            // Khi ĐÃ đăng nhập thành công: Hiển thị CHUÔNG THÔNG BÁO và AVATAR MẶC ĐỊNH
                            <div className="flex items-center gap-3">
                                <NotificationBell />
                                <div className="relative" ref={userMenuRef}>
                                    <button
                                        type="button"
                                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    className="cursor-pointer hover:scale-105 transition-all duration-200 relative focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-full"
                                    title={`Tài khoản: ${user?.full_name || user?.username}`}
                                >
                                    <UserAvatar
                                        avatar={user?.avatar}
                                        name={user?.full_name || user?.username}
                                        role={user?.role}
                                        size="md"
                                        border={true}
                                        showOnline={true}
                                    />
                                </button>

                                {/* Dropdown Menu tài khoản */}
                                {userMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2.5 z-50 animate-fadeIn divide-y divide-slate-100">
                                        {/* Header: Thông tin user */}
                                        <div className="px-4 py-2">
                                            <div className="font-bold text-slate-900 text-sm truncate">
                                                {user?.full_name || user?.username}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate">
                                                {user?.email || user?.phone_number || 'Khách hàng thân thiết'}
                                            </div>
                                            <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                ★ {getRoleTitle(user?.role, user?.current_tier?.name || user?.guest_profile?.vip_tier)}
                                            </div>
                                        </div>

                                        {/* 1. Hồ sơ của tôi, 2. Mã giảm giá của tôi, 3. Lịch sử đặt phòng, 4. Đổi mật khẩu */}
                                        <div className="py-1">
                                            {/* Mục quản trị dành cho Ban Quản Lý & Nhân Viên */}
                                            {isStaffRole(user) && (
                                                <Link
                                                    to="/admin"
                                                    onClick={() => setUserMenuOpen(false)}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-blue-600 bg-blue-50/80 hover:bg-blue-100/80 transition text-left cursor-pointer border-b border-blue-100 mb-1"
                                                >
                                                    <span className="w-5 h-5 flex items-center justify-center shrink-0 text-blue-600">
                                                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                    </span>
                                                    <span className="truncate">Cổng Quản Trị & Bàn Làm Việc</span>
                                                </Link>
                                            )}

                                            {/* Nút 1: Hồ sơ của tôi (chuyển sang trang riêng) */}
                                            <Link
                                                to="/profile"
                                                onClick={() => setUserMenuOpen(false)}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 hover:text-blue-600 transition text-left cursor-pointer"
                                            >
                                                <span className="w-5 h-5 flex items-center justify-center shrink-0 text-black">
                                                    <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                </span>
                                                <span className="truncate">Hồ sơ của tôi</span>
                                            </Link>

                                            {/* Nút 2: Mã giảm giá của tôi */}
                                            <Link
                                                to="/promotions"
                                                onClick={() => setUserMenuOpen(false)}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 hover:text-blue-600 transition text-left cursor-pointer"
                                            >
                                                <span className="w-5 h-5 flex items-center justify-center shrink-0 text-black">
                                                    <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                                                    </svg>
                                                </span>
                                                <span className="truncate">Mã giảm giá của tôi</span>
                                            </Link>

                                            {/* Nút 3: Lịch sử đặt phòng */}
                                            <Link
                                                to="/booking-history"
                                                onClick={() => setUserMenuOpen(false)}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 hover:text-blue-600 transition text-left cursor-pointer"
                                            >
                                                <span className="w-5 h-5 flex items-center justify-center shrink-0 text-black">
                                                    <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </span>
                                                <span className="truncate">Lịch sử đặt phòng</span>
                                            </Link>

                                            {/* Nút 4: Đổi mật khẩu */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setUserMenuOpen(false);
                                                    setIsChangePasswordOpen(true);
                                                }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 hover:text-blue-600 transition text-left cursor-pointer"
                                            >
                                                <span className="w-5 h-5 flex items-center justify-center shrink-0 text-black">
                                                    <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                    </svg>
                                                </span>
                                                <span className="truncate">Đổi mật khẩu</span>
                                            </button>
                                        </div>

                                        {/* Nút 5: Đăng xuất (màu đỏ) */}
                                        <div className="pt-1">
                                            <button
                                                type="button"
                                                onClick={handleRequestLogout}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition text-left cursor-pointer"
                                            >
                                                <span className="w-5 h-5 flex items-center justify-center shrink-0 text-red-600">
                                                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                    </svg>
                                                </span>
                                                <span className="truncate">Đăng xuất</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                        {/* Mobile Menu Button */}
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
                            aria-label="Toggle Menu"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {mobileMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation Dropdown */}
                {mobileMenuOpen && (
                    <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-2 shadow-lg animate-fadeIn">
                        {/* Mobile User Status */}
                        {isAuthenticated && (
                            <div className="p-3.5 bg-slate-50 rounded-2xl mb-3 border border-slate-200/90 space-y-2.5 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <Link
                                        to="/profile"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center gap-2.5 text-left min-w-0"
                                    >
                                        <UserAvatar
                                            avatar={user?.avatar}
                                            name={user?.full_name || user?.username}
                                            role={user?.role}
                                            size="md"
                                            border={true}
                                        />
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-slate-900 truncate">
                                                {user?.full_name || user?.username}
                                            </div>
                                            <div className="text-[10px] text-slate-500 truncate">
                                                {user?.email || user?.phone_number}
                                            </div>
                                        </div>
                                    </Link>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                            ★ {user?.current_tier?.name || user?.guest_profile?.vip_tier || 'Đồng (Bronze)'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleRequestLogout}
                                            className="px-2 py-1 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                                        >
                                            Thoát
                                        </button>
                                    </div>
                                </div>

                                {/* Menu tắt trên Mobile dành riêng cho khách hàng */}
                                <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
                                    <Link
                                        to="/booking-history"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center gap-1.5 p-2 rounded-xl bg-blue-50/80 hover:bg-blue-100 text-blue-700 font-bold transition"
                                    >
                                        <span className="text-sm">📋</span>
                                        <span className="truncate">Lịch sử đặt phòng</span>
                                    </Link>
                                    <Link
                                        to="/profile"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center gap-1.5 p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-200/80 transition"
                                    >
                                        <span className="text-sm">👤</span>
                                        <span className="truncate">Hồ sơ cá nhân</span>
                                    </Link>
                                    <Link
                                        to="/promotions"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-50/80 hover:bg-amber-100 text-amber-800 font-bold border border-amber-200/60 transition"
                                    >
                                        <span className="text-sm">🎟️</span>
                                        <span className="truncate">Mã ưu đãi của tôi</span>
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMobileMenuOpen(false);
                                            setIsChangePasswordOpen(true);
                                        }}
                                        className="flex items-center gap-1.5 p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold border border-slate-200/80 transition text-left cursor-pointer"
                                    >
                                        <span className="text-sm">🔑</span>
                                        <span className="truncate">Đổi mật khẩu</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {navItems.map((item) => {
                            const active = item.isActive(location.pathname);
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                                        active
                                            ? 'bg-blue-50 text-blue-600 font-semibold'
                                            : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600'
                                    }`}
                                >
                                    {item.name}
                                </Link>
                            );
                        })}

                        <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                            <Link
                                to={actionLink}
                                onClick={(e) => {
                                    setMobileMenuOpen(false);
                                    handleActionClick(e);
                                }}
                                className="w-full py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-bold text-sm rounded-xl shadow-md text-center flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4 text-white/95" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>{actionText}</span>
                            </Link>

                            {!isAuthenticated ? (
                                <Link
                                    to="/login"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="w-full py-2.5 text-center text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition flex items-center justify-center gap-2"
                                >
                                    <div className="w-5 h-5 rounded-md bg-white border border-slate-200 text-slate-600 flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <span>Đăng nhập / Đăng ký</span>
                                </Link>
                            ) : (
                                isStaffRole(user) && (
                                    <Link
                                        to="/admin"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="w-full py-2.5 text-center text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition"
                                    >
                                        ⚙️ Cổng Quản Trị & Bàn Làm Việc
                                    </Link>
                                )
                            )}
                        </div>
                    </div>
                )}
            </header>

            {/* Modal Đổi Mật Khẩu */}
            <ChangePasswordModal
                isOpen={isChangePasswordOpen}
                onClose={() => setIsChangePasswordOpen(false)}
            />

            {/* Modal Xác Nhận Đăng Xuất */}
            <LogoutConfirmModal
                isOpen={isLogoutModalOpen}
                onClose={() => !isLoggingOut && setIsLogoutModalOpen(false)}
                onConfirm={handleConfirmLogout}
                isLoading={isLoggingOut}
                title="Xác Nhận Đăng Xuất"
                userName={user?.full_name || user?.username}
                message="Quý khách có chắc chắn muốn đăng xuất khỏi tài khoản không? Bạn sẽ cần đăng nhập lại để xem lịch sử đặt phòng và quản lý kỳ nghỉ của mình."
            />
        </>
    );
}
