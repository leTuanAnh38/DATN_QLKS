import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar({
    actionText = 'Đặt phòng ngay',
    actionLink = '/rooms',
    onActionClick = null
}) {
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

                        {/* User / Login Avatar */}
                        <Link
                            to="/login"
                            title="Tài khoản / Đăng nhập"
                            className="w-10 h-10 rounded-full border-2 border-blue-600 p-0.5 cursor-pointer hover:scale-105 transition"
                        >
                            <img
                                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                                alt="VIP Guest Avatar"
                                className="w-full h-full object-cover rounded-full"
                            />
                        </Link>

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
                            <Link
                                to="/login"
                                onClick={() => setMobileMenuOpen(false)}
                                className="w-full py-2 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg text-center hover:bg-slate-50"
                            >
                                Đăng nhập / Hội viên VIP
                            </Link>
                        </div>
                    </div>
                )}
            </header>
        </>
    );
}
