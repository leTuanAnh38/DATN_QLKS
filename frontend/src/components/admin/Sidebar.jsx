import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/authStore';
import { useHasPermission } from '../../utils/permission';

/**
 * Component Sidebar dành cho Quản trị viên (Admin Layout)
 * Tích hợp RBAC (Role-Based Access Control) bảo vệ các phân hệ menu
 */
export default function Sidebar({
    activeTab,
    setActiveTab,
    pendingBookingsCount = 0,
    isCategoryMenuOpen: externalCatOpen,
    setIsCategoryMenuOpen: setExternalCatOpen,
    isBookingMenuOpen: externalBookingOpen,
    setIsBookingMenuOpen: setExternalBookingOpen,
    isMarketingMenuOpen: externalMarketingOpen,
    setIsMarketingMenuOpen: setExternalMarketingOpen
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    // Internal fallback states nếu không truyền từ component cha
    const [internalCatOpen, setInternalCatOpen] = useState(
        activeTab === 'categories' || activeTab === 'amenities' || location.pathname === '/admin/amenities'
    );
    const [internalBookingOpen, setInternalBookingOpen] = useState(
        ['bookings', 'booking-timeline'].includes(activeTab)
    );
    const [internalMarketingOpen, setInternalMarketingOpen] = useState(
        ['posts', 'promotions'].includes(activeTab) || location.pathname === '/admin/posts' || location.pathname === '/admin/promotions'
    );

    const isCategoryOpen = externalCatOpen !== undefined ? externalCatOpen : internalCatOpen;
    const setIsCategoryOpen = setExternalCatOpen || setInternalCatOpen;

    const isBookingOpen = externalBookingOpen !== undefined ? externalBookingOpen : internalBookingOpen;
    const setIsBookingOpen = setExternalBookingOpen || setInternalBookingOpen;

    const isMarketingOpen = externalMarketingOpen !== undefined ? externalMarketingOpen : internalMarketingOpen;
    const setIsMarketingOpen = setExternalMarketingOpen || setInternalMarketingOpen;

    // =========================================================================
    // 🛡️ BẢO VỆ PHÂN QUYỀN (RBAC) - KIỂM TRA QUYỀN XEM TRƯỚC KHI HIỂN THỊ MENU
    // =========================================================================
    const canViewOverview = useHasPermission('overview', 'read');
    const canViewRooms = useHasPermission('rooms', 'read');
    const canViewCategories = useHasPermission('categories', 'read');
    const canViewBookings = useHasPermission('bookings', 'read');
    const canViewGuests = useHasPermission('guests', 'read');
    const canViewServices = useHasPermission('services', 'read');
    const canViewFinance = useHasPermission('finance', 'read');
    const canViewReports = useHasPermission('reports', 'read');
    const canViewEmployees = useHasPermission('employees', 'read');
    const canViewMarketing = useHasPermission('marketing', 'read');
    const canViewSettings = useHasPermission('settings', 'read');

    const handleSelectTab = (tab, path = null) => {
        if (setActiveTab) setActiveTab(tab);
        if (path) navigate(path);
    };

    return (
        <aside className="w-64 bg-slate-900 border-r border-slate-800 text-white flex flex-col shrink-0 min-h-screen">
            {/* Logo Khách Sạn */}
            <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
                <Link to="/admin" className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-serif text-lg font-bold shadow-lg shadow-blue-500/30">
                        TA
                    </div>
                    <div>
                        <div className="text-sm font-bold tracking-wide">HOTEL MANAGER</div>
                        <div className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">
                            {user?.role ? `Vai trò: ${user.role}` : 'PMS & Booking'}
                        </div>
                    </div>
                </Link>
            </div>

            {/* Navigation Menu */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 text-sm">

                {/* ================================================================= */}
                {/* NHÓM 1: TỔNG QUAN & LỄ TÂN (BÀN LÀM VIỆC) */}
                {/* ================================================================= */}
                {(canViewOverview || canViewRooms) && (
                    <div className="space-y-1">
                        <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Bàn Làm Việc
                        </div>

                        {/* 1. Tổng quan */}
                        {canViewOverview && (
                            <button
                                type="button"
                                onClick={() => handleSelectTab('overview', '/admin')}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition cursor-pointer ${
                                    activeTab === 'overview'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                    </svg>
                                    <span>Tổng quan</span>
                                </div>
                            </button>
                        )}

                        {/* 2. Sơ đồ phòng PMS */}
                        {canViewRooms && (
                            <button
                                type="button"
                                onClick={() => handleSelectTab('rooms')}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition cursor-pointer ${
                                    activeTab === 'rooms'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    <span>Sơ đồ Phòng</span>
                                </div>
                                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                                    PMS
                                </span>
                            </button>
                        )}
                    </div>
                )}

                {/* ================================================================= */}
                {/* NHÓM 2: PHÒNG & GIÁ (CÓ DROPDOWN TIỆN NGHI) */}
                {/* ================================================================= */}
                {canViewCategories && (
                    <div className="space-y-1">
                        <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Buồng Phòng
                        </div>

                        {/* DROPDOWN HẠNG PHÒNG & BẢNG GIÁ */}
                        <div className="space-y-1">
                            <button
                                type="button"
                                onClick={() => {
                                    if (activeTab !== 'categories' && activeTab !== 'amenities') {
                                        handleSelectTab('categories');
                                        setIsCategoryOpen(true);
                                    } else if (activeTab === 'amenities') {
                                        handleSelectTab('categories');
                                        setIsCategoryOpen(true);
                                    } else {
                                        setIsCategoryOpen(!isCategoryOpen);
                                    }
                                }}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition cursor-pointer select-none ${
                                    activeTab === 'categories'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                        : activeTab === 'amenities'
                                            ? 'bg-slate-800 text-white'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                                title="Hạng phòng & Bảng giá"
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    <span className="truncate text-left">Hạng phòng & Bảng giá</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                    <span className="bg-amber-500/30 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
                                        Suites
                                    </span>
                                    <span
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsCategoryOpen(!isCategoryOpen);
                                        }}
                                        className="shrink-0 p-1 rounded hover:bg-slate-700/60 transition cursor-pointer"
                                        title={isCategoryOpen ? "Thu gọn menu con" : "Mở rộng menu con"}
                                    >
                                        <svg
                                            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${
                                                isCategoryOpen ? 'rotate-180 text-white' : 'rotate-0'
                                            }`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </span>
                                </div>
                            </button>

                            {/* MENU CON: TIỆN NGHI */}
                            <div
                                className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
                                    isCategoryOpen
                                        ? 'grid-rows-[1fr] opacity-100'
                                        : 'grid-rows-[0fr] opacity-0'
                                }`}
                            >
                                <div className="min-h-0">
                                    <div className="pl-6 pr-1 py-1 space-y-1 border-l-2 border-slate-700/60 ml-4 my-1">
                                        <button
                                            type="button"
                                            onClick={() => handleSelectTab('amenities', '/admin/amenities')}
                                            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-left text-xs font-semibold transition cursor-pointer ${
                                                activeTab === 'amenities' || location.pathname === '/admin/amenities'
                                                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 flex-1 min-w-0 overflow-hidden">
                                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                                </svg>
                                                <span className="truncate text-left">Tiện nghi</span>
                                            </div>
                                            <span className="shrink-0 text-[10px] font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 ml-2">
                                                Tiện ích
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ================================================================= */}
                {/* NHÓM 3: ĐẶT PHÒNG & KHÁCH HÀNG */}
                {/* ================================================================= */}
                {(canViewBookings || canViewGuests || canViewServices) && (
                    <div className="space-y-1">
                        <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Giao dịch & Khách
                        </div>

                        {/* DROPDOWN QUẢN LÝ ĐẶT PHÒNG */}
                        {canViewBookings && (
                            <div className="space-y-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (activeTab !== 'bookings') {
                                            handleSelectTab('bookings');
                                            setIsBookingOpen(true);
                                        } else {
                                            setIsBookingOpen(!isBookingOpen);
                                        }
                                    }}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition cursor-pointer select-none ${
                                        activeTab === 'bookings'
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : ['bookings', 'booking-timeline'].includes(activeTab)
                                                ? 'bg-slate-800 text-white'
                                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="truncate text-left">Quản lý Đặt phòng</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                        {pendingBookingsCount > 0 && (
                                            <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                                                {pendingBookingsCount}
                                            </span>
                                        )}
                                        <span
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsBookingOpen(!isBookingOpen);
                                            }}
                                            className="shrink-0 p-1 rounded hover:bg-slate-700/60 transition cursor-pointer"
                                        >
                                            <svg
                                                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${
                                                    isBookingOpen ? 'rotate-180 text-white' : 'rotate-0'
                                                }`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </span>
                                    </div>
                                </button>

                                {/* Menu con Lịch đặt phòng */}
                                <div
                                    className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
                                        isBookingOpen
                                            ? 'grid-rows-[1fr] opacity-100'
                                            : 'grid-rows-[0fr] opacity-0'
                                    }`}
                                >
                                    <div className="min-h-0">
                                        <div className="pl-6 pr-1 py-1 space-y-1 border-l-2 border-slate-700/60 ml-4 my-1">
                                            <button
                                                type="button"
                                                onClick={() => handleSelectTab('booking-timeline')}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs font-semibold transition cursor-pointer ${
                                                    activeTab === 'booking-timeline'
                                                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 flex-1 min-w-0 overflow-hidden">
                                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                    </svg>
                                                    <span className="truncate text-left">Lịch đặt phòng</span>
                                                </div>
                                                <span className="shrink-0 text-[10px] font-bold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30 ml-2">
                                                    Sơ đồ
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Quản lý Khách hàng */}
                        {canViewGuests && (
                            <button
                                type="button"
                                onClick={() => handleSelectTab('guests')}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition cursor-pointer ${
                                    activeTab === 'guests'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    <span>Quản lý Khách hàng</span>
                                </div>
                                <span className="bg-blue-500/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-500/30">
                                    VIP
                                </span>
                            </button>
                        )}

                        {/* Dịch vụ & Yêu cầu phòng */}
                        {canViewServices && (
                            <button
                                type="button"
                                onClick={() => handleSelectTab('services')}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition cursor-pointer ${
                                    activeTab === 'services'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                    <span>Yêu cầu Dịch vụ</span>
                                </div>
                                <span className="bg-purple-500/20 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-500/30">
                                    Kanban
                                </span>
                            </button>
                        )}
                    </div>
                )}

                {/* ================================================================= */}
                {/* NHÓM 4: DOANH NGHIỆP, TÀI CHÍNH & NHÂN SỰ */}
                {/* ================================================================= */}
                {(canViewFinance || canViewReports || canViewEmployees) && (
                    <div className="space-y-1">
                        <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Quản Trị Doanh Nghiệp
                        </div>

                        {/* 1. Hóa đơn & Thu ngân */}
                        {canViewFinance && (
                            <button
                                type="button"
                                onClick={() => handleSelectTab('invoices')}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition cursor-pointer ${
                                    activeTab === 'invoices'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                                    </svg>
                                    <span>Hóa đơn & Thu ngân</span>
                                </div>
                                <span className="bg-cyan-500/20 text-cyan-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-cyan-500/30">
                                    VietQR
                                </span>
                            </button>
                        )}

                        {/* 2. Báo cáo & Thống kê Doanh thu */}
                        {canViewReports && (
                            <button
                                type="button"
                                onClick={() => handleSelectTab('analytics', '/admin?tab=analytics')}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition cursor-pointer ${
                                    ['analytics', 'reports'].includes(activeTab)
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    <span>Báo cáo & Thống kê</span>
                                </div>
                                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                                    KPI
                                </span>
                            </button>
                        )}

                        {/* 3. Quản lý Nhân sự & Phân quyền (RBAC) */}
                        {canViewEmployees && (
                            <button
                                type="button"
                                onClick={() => handleSelectTab('employees')}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition cursor-pointer ${
                                    activeTab === 'employees'
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
                        )}
                    </div>
                )}

                {/* ================================================================= */}
                {/* NHÓM 5: MARKETING & KHUYẾN MÃI (DROPDOWN) */}
                {/* ================================================================= */}
                {canViewMarketing && (
                    <div className="space-y-1">
                        <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Truyền Thông
                        </div>

                        <div className="space-y-1">
                            <button
                                type="button"
                                onClick={() => setIsMarketingOpen(!isMarketingOpen)}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition cursor-pointer select-none ${
                                    ['posts', 'promotions'].includes(activeTab) || location.pathname === '/admin/posts' || location.pathname === '/admin/promotions'
                                        ? 'bg-slate-800 text-white'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                                title="Marketing & Khuyến mãi"
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                    </svg>
                                    <span className="truncate text-left">Marketing & Khuyến mãi</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                    <span className="bg-rose-500/30 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-400/30">
                                        PROMO
                                    </span>
                                    <span
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsMarketingOpen(!isMarketingOpen);
                                        }}
                                        className="shrink-0 p-1 rounded hover:bg-slate-700/60 transition cursor-pointer"
                                    >
                                        <svg
                                            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${
                                                isMarketingOpen ? 'rotate-180 text-white' : 'rotate-0'
                                            }`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </span>
                                </div>
                            </button>

                            {/* Menu con: Tin tức & Blog, Khuyến mãi */}
                            <div
                                className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
                                    isMarketingOpen
                                        ? 'grid-rows-[1fr] opacity-100'
                                        : 'grid-rows-[0fr] opacity-0'
                                }`}
                            >
                                <div className="min-h-0">
                                    <div className="pl-6 pr-1 py-1 space-y-1 border-l-2 border-slate-700/60 ml-4 my-1">
                                        {/* 1. Tin tức & Blog */}
                                        <button
                                            type="button"
                                            onClick={() => handleSelectTab('posts', '/admin/posts')}
                                            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-left text-xs font-semibold transition cursor-pointer ${
                                                activeTab === 'posts' || location.pathname === '/admin/posts'
                                                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 flex-1 min-w-0 overflow-hidden">
                                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                                                </svg>
                                                <span className="truncate text-left">Tin tức & Blog</span>
                                            </div>
                                            <span className="shrink-0 text-[10px] font-bold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30 ml-2">
                                                Blog
                                            </span>
                                        </button>

                                        {/* 2. Khuyến mãi */}
                                        <button
                                            type="button"
                                            onClick={() => handleSelectTab('promotions', '/admin/promotions')}
                                            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-left text-xs font-semibold transition cursor-pointer ${
                                                activeTab === 'promotions' || location.pathname === '/admin/promotions'
                                                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 flex-1 min-w-0 overflow-hidden">
                                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                </svg>
                                                <span className="truncate text-left">Khuyến mãi</span>
                                            </div>
                                            <span className="shrink-0 text-[10px] font-bold bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/30 ml-2">
                                                Voucher
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ================================================================= */}
                {/* NHÓM 6: CÀI ĐẶT HỆ THỐNG */}
                {/* ================================================================= */}
                {canViewSettings && (
                    <div className="space-y-1">
                        <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Hệ Thống
                        </div>
                        <button
                            type="button"
                            onClick={() => handleSelectTab('settings', '/admin/settings')}
                            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition cursor-pointer ${
                                activeTab === 'settings' || location.pathname === '/admin/settings'
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>Cài đặt hệ thống</span>
                            </div>
                        </button>
                    </div>
                )}
            </div>

            {/* User Profile Widget ở chân Sidebar */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/90 shrink-0">
                <div className="flex items-center justify-between text-xs">
                    <div className="truncate mr-2">
                        <div className="font-bold text-white truncate">{user?.username || 'Chưa đăng nhập'}</div>
                        <div className="text-[10px] text-blue-400 capitalize font-medium">
                            {user?.role || 'Guest'}
                        </div>
                    </div>
                    {logout && (
                        <button
                            type="button"
                            onClick={logout}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                            title="Đăng xuất"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
}
