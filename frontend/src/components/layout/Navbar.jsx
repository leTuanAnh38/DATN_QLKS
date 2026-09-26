import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/authStore';
import { authService } from '../../services/authService';
import ChangePasswordModal from '../auth/ChangePasswordModal';
import ProfileModal from '../auth/ProfileModal';

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
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const userMenuRef = useRef(null);

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

    const handleLogout = async () => {
        setUserMenuOpen(false);
        setMobileMenuOpen(false);
        await authService.logout();
        navigate('/');
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
            name: 'Ẩm thực & Bar',
            path: '/dining',
            isActive: (path) => path.startsWith('/dining')
        },
        {
            name: 'Dịch vụ Spa',
            path: '/spa',
            isActive: (path) => path.startsWith('/spa')
        },
        {
            name: 'Ưu đãi đặc quyền',
            path: '/promotions',
            isActive: (path) => path.startsWith('/promotions')
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
            <div className="bg-slate-900 text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
                <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center space-x-4">
                        <span className="font-semibold tracking-wider text-amber-400 uppercase text-[11px]">
                            KHÁCH SẠN TA ĐÀ NẴNG LUXURY COLLECTION
                        </span>
                        <span className="hidden sm:inline text-slate-600">|</span>
                        <span className="hidden sm:inline flex items-center gap-1 text-slate-400">
                            <span className="text-amber-400 font-bold">★</span>
                            The Leading Hotels of the World
                        </span>
                        {isAuthenticated && (
                            <>
                                <span className="hidden md:inline text-slate-600">|</span>
                                <span className="hidden md:inline text-amber-300 font-medium">
                                    👋 Kính chào Quý khách: <strong>{user?.full_name || user?.username}</strong>
                                </span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center space-x-4 text-slate-300">
                        <a href="tel:19008899" className="flex items-center gap-1.5 hover:text-white cursor-pointer transition">
                            <span className="text-orange-400">📞</span>
                            Hotline 24/7: <strong className="text-white">1900 8899</strong>
                        </a>
                        <span className="text-slate-600">|</span>
                        <div className="flex items-center space-x-2">
                            <span className="cursor-pointer hover:text-white">🇻🇳 VND</span>
                            <span>/</span>
                            <span className="cursor-pointer hover:text-white">Tiếng Việt</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. HEADER NAVIGATION */}
            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    {/* Brand Logo */}
                    <Link to="/" className="flex items-center space-x-3 cursor-pointer">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/30 flex-shrink-0">
                            <span className="text-white font-serif font-black text-xl tracking-tighter">TA</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-serif font-bold text-slate-900 text-lg leading-tight tracking-wide whitespace-nowrap">
                                KHÁCH SẠN TA
                            </span>
                            <span className="text-[10px] font-semibold text-blue-600 tracking-[0.2em] uppercase whitespace-nowrap">
                                ĐÀ NẴNG ★★★★★
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Navigation Links */}
                    <nav className="hidden lg:flex items-center space-x-7 text-sm font-medium">
                        {navItems.map((item) => {
                            const active = item.isActive(location.pathname);
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`transition-colors duration-200 ${
                                        active
                                            ? 'text-blue-600 font-semibold border-b-2 border-blue-600 pb-1'
                                            : 'text-slate-700 hover:text-blue-600'
                                    }`}
                                >
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Header Actions */}
                    <div className="flex items-center space-x-3 sm:space-x-4">
                        <Link
                            to={actionLink}
                            onClick={handleActionClick}
                            className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium text-sm rounded-lg shadow-md shadow-orange-500/20 hover:shadow-lg transition-all duration-200"
                        >
                            {actionText}
                        </Link>

                        {/* AUTH SECTION: NÚT ĐĂNG NHẬP HOẶC AVATAR MẶC ĐỊNH KHI ĐÃ ĐĂNG NHẬP */}
                        {!isAuthenticated ? (
                            // Khi CHƯA đăng nhập: Hiển thị Nút Đăng nhập
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 hover:border-blue-300 transition-all duration-200 shadow-sm"
                            >
                                <svg className="w-4 h-4 text-slate-500 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span>Đăng nhập</span>
                            </Link>
                        ) : (
                            // Khi ĐÃ đăng nhập thành công: Hiển thị AVATAR MẶC ĐỊNH kèm Menu Tài khoản
                            <div className="relative" ref={userMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    className="w-10 h-10 rounded-full border-2 border-blue-600 p-0.5 cursor-pointer hover:scale-105 transition-all duration-200 relative focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    title={`Tài khoản: ${user?.full_name || user?.username}`}
                                >
                                    {user?.avatar ? (
                                        <img
                                            src={user.avatar}
                                            alt={user?.full_name || 'User Avatar'}
                                            className="w-full h-full object-cover rounded-full"
                                        />
                                    ) : (
                                        // Avatar mặc định sang trọng
                                        <div className="w-full h-full rounded-full bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-inner">
                                            {getInitials(user?.full_name || user?.username)}
                                        </div>
                                    )}
                                    {/* Online indicator */}
                                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
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
                                                ★ {user?.role === 'admin' ? 'Admin Quản trị' : (user?.guest_profile?.vip_tier ? `Hội viên ${user.guest_profile.vip_tier}` : 'Khách hàng VIP')}
                                            </div>
                                        </div>

                                        {/* 1. Hồ sơ của tôi, 2. Mã giảm giá của tôi, 3. Lịch sử đặt phòng, 4. Đổi mật khẩu */}
                                        <div className="py-1">
                                            {/* Nút 1: Hồ sơ của tôi */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setUserMenuOpen(false);
                                                    setIsProfileOpen(true);
                                                }}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 hover:text-blue-600 transition text-left cursor-pointer"
                                            >
                                                <span className="w-5 h-5 flex items-center justify-center shrink-0 text-black">
                                                    <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                </span>
                                                <span className="truncate">Hồ sơ của tôi</span>
                                            </button>

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
                                                to="/login"
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

                                            {/* Mục quản trị nếu là Admin */}
                                            {(user?.role === 'admin' || user?.is_staff) && (
                                                <Link
                                                    to="/admin"
                                                    onClick={() => setUserMenuOpen(false)}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition text-left cursor-pointer"
                                                >
                                                    <span className="w-5 h-5 flex items-center justify-center shrink-0 text-black">
                                                        <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                    </span>
                                                    <span className="truncate">Trang quản trị khách sạn</span>
                                                </Link>
                                            )}
                                        </div>

                                        {/* Nút 5: Đăng xuất (màu đỏ) */}
                                        <div className="pt-1">
                                            <button
                                                type="button"
                                                onClick={handleLogout}
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
                            <div className="p-3 bg-slate-50 rounded-xl mb-3 flex items-center justify-between border border-slate-200">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                                        {getInitials(user?.full_name || user?.username)}
                                    </div>
                                    <div className="text-left">
                                        <div className="text-xs font-bold text-slate-900 truncate">
                                            {user?.full_name || user?.username}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                            {user?.email || user?.phone_number}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="px-2.5 py-1 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
                                >
                                    Đăng xuất
                                </button>
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
                                className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium text-sm rounded-lg shadow text-center"
                            >
                                {actionText}
                            </Link>

                            {!isAuthenticated ? (
                                <Link
                                    to="/login"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="w-full py-2.5 text-center text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                                >
                                    🔑 Đăng nhập / Đăng ký
                                </Link>
                            ) : (
                                (user?.role === 'admin' || user?.is_staff) && (
                                    <Link
                                        to="/admin"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="w-full py-2 text-center text-xs font-semibold text-blue-600 bg-blue-50 rounded-xl"
                                    >
                                        ⚙️ Trang Quản Trị Admin
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

            {/* Modal Hồ Sơ Của Tôi */}
            <ProfileModal
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                onOpenChangePassword={() => setIsChangePasswordOpen(true)}
            />
        </>
    );
}
