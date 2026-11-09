import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../../store/authStore';
import { authService } from '../../services/authService';
import { useHasPermission } from '../../utils/permission';
import UserAvatar from '../common/UserAvatar';
import LogoutConfirmModal from '../common/LogoutConfirmModal';

/**
 * Component Sidebar dành cho Quản trị viên (Admin Layout)
 * - Hỗ trợ RBAC (Role-Based Access Control) bảo vệ các phân hệ menu
 * - Hỗ trợ chế độ Thu gọn Desktop (Mini-Sidebar w-20) & Mở rộng (w-80)
 * - Hỗ trợ Floating Tooltip / Popover Menu con khi ở chế độ thu gọn
 */
export default function Sidebar({
    activeTab,
    setActiveTab,
    bookingSubFilter = 'all',
    setBookingSubFilter,
    pendingBookingsCount = 0,
    isBookingMenuOpen: externalBookingOpen,
    setIsBookingMenuOpen: setExternalBookingOpen,
    isCategoryMenuOpen: externalCatOpen,
    setIsCategoryMenuOpen: setExternalCatOpen,
    isMarketingMenuOpen: externalMarketingOpen,
    setIsMarketingMenuOpen: setExternalMarketingOpen,
    isMobileSidebarOpen = false,
    setIsMobileSidebarOpen,
    isCollapsed: externalCollapsed,
    setIsCollapsed: setExternalCollapsed,
    onSwitchTab,
    onRequestLogout
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    // State thu gọn Sidebar trên Desktop (lưu vào localStorage nếu dùng internal state)
    const [internalCollapsed, setInternalCollapsed] = useState(() => {
        try {
            return localStorage.getItem('pms_sidebar_collapsed') === 'true';
        } catch {
            return false;
        }
    });

    const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
    const handleToggleCollapse = () => {
        const nextVal = !isCollapsed;
        if (setExternalCollapsed) {
            setExternalCollapsed(nextVal);
        } else {
            setInternalCollapsed(nextVal);
        }
        try {
            localStorage.setItem('pms_sidebar_collapsed', String(nextVal));
        } catch {
            // Ignore storage errors
        }
        setHoveredFlyout(null);
    };

    // Khi mở Drawer trên Mobile (< lg), luôn hiển thị đầy đủ nhãn chữ
    const effectiveCollapsed = Boolean(isCollapsed && !isMobileSidebarOpen);

    // Internal fallback states cho các nhóm Accordion nếu không truyền từ component cha
    const [internalBookingOpen, setInternalBookingOpen] = useState(true);
    const [internalCatOpen, setInternalCatOpen] = useState(true);
    const [internalMarketingOpen, setInternalMarketingOpen] = useState(true);

    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const isBookingMenuOpen = externalBookingOpen !== undefined ? externalBookingOpen : internalBookingOpen;
    const setIsBookingMenuOpen = setExternalBookingOpen || setInternalBookingOpen;

    const isCategoryMenuOpen = externalCatOpen !== undefined ? externalCatOpen : internalCatOpen;
    const setIsCategoryMenuOpen = setExternalCatOpen || setInternalCatOpen;

    const isMarketingMenuOpen = externalMarketingOpen !== undefined ? externalMarketingOpen : internalMarketingOpen;
    const setIsMarketingMenuOpen = setExternalMarketingOpen || setInternalMarketingOpen;

    // Floating Tooltip / Flyout Menu khi hover ở chế độ Mini-Sidebar (w-20)
    const [hoveredFlyout, setHoveredFlyout] = useState(null);
    const closeTimerRef = useRef(null);

    const openFlyout = (e, config) => {
        if (!effectiveCollapsed) return;
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        const rect = e.currentTarget.getBoundingClientRect();
        setHoveredFlyout({
            ...config,
            top: Math.max(12, Math.min(rect.top, window.innerHeight - 180))
        });
    };

    const scheduleCloseFlyout = () => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => {
            setHoveredFlyout(null);
        }, 120);
    };

    const cancelCloseFlyout = () => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };

    useEffect(() => {
        return () => {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        };
    }, []);

    // =========================================================================
    // 🛡️ BẢO VỆ PHÂN QUYỀN (RBAC) - KIỂM TRA QUYỀN XEM TRƯỚC KHI HIỂN THỊ MENU
    // =========================================================================
    const canViewOverview = useHasPermission('overview', 'read');
    const canViewGuests = useHasPermission('guests', 'read');
    const canViewCorporatePartners = useHasPermission('corporate_partners', 'read');
    const canViewEmployees = useHasPermission('employees', 'read');
    const canViewRooms = useHasPermission('rooms', 'read');
    const canViewCategories = useHasPermission('categories', 'read');
    const canViewBookings = useHasPermission('bookings', 'read');
    const canViewServices = useHasPermission('services', 'read');
    const canViewReviews = useHasPermission('reviews', 'read');
    const canViewMarketing = useHasPermission('marketing', 'read');
    const canViewContacts = useHasPermission('contacts', 'read');
    const canViewInvoices = useHasPermission('finance', 'read');
    const canViewAnalytics = useHasPermission('reports', 'read');
    const canViewSettings = useHasPermission('settings', 'read');

    const isHighLevelManager = Boolean(
        user &&
        (['admin', 'owner', 'manager'].includes(user.role) || user.is_superuser)
    );

    const triggerSwitchTab = (tab) => {
        if (onSwitchTab) {
            onSwitchTab(tab);
        } else if (setActiveTab) {
            setActiveTab(tab);
        }
        setHoveredFlyout(null);
    };

    const handleLogoutClick = () => {
        setHoveredFlyout(null);
        if (onRequestLogout) {
            onRequestLogout();
        } else {
            setIsLogoutModalOpen(true);
        }
    };

    return (
        <>
            <style>{`
                .custom-sidebar-scroll {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(148, 163, 184, 0.25) transparent;
                }
                .custom-sidebar-scroll::-webkit-scrollbar {
                    width: 5px;
                }
                .custom-sidebar-scroll::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-sidebar-scroll::-webkit-scrollbar-thumb {
                    background: rgba(148, 163, 184, 0.25);
                    border-radius: 9999px;
                }
                .custom-sidebar-scroll::-webkit-scrollbar-thumb:hover {
                    background: rgba(148, 163, 184, 0.45);
                }
            `}</style>
            <aside
                className={`${
                    effectiveCollapsed ? 'lg:w-20' : 'lg:w-80'
                } w-80 h-screen bg-slate-900 text-slate-300 flex flex-col shrink-0 fixed inset-y-0 left-0 z-50 border-r border-slate-800 transition-all duration-300 ease-in-out print:hidden ${
                    isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
                }`}
            >
                {/* Logo Brand Header (Cố định phía trên) */}
                <div
                    className={`h-20 shrink-0 flex items-center border-b border-slate-800/80 transition-all duration-300 ${
                        effectiveCollapsed ? 'lg:justify-center lg:px-2 px-6 justify-between' : 'justify-between px-6'
                    }`}
                >
                    <Link
                        to="/"
                        onClick={() => setIsMobileSidebarOpen && setIsMobileSidebarOpen(false)}
                        className="flex items-center gap-3 hover:bg-slate-800/40 transition rounded-xl"
                        title="TA ĐÀ NẴNG - Luxury Hotel Admin"
                    >
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-serif font-black text-xl shadow-lg shadow-blue-600/40 shrink-0">
                            TA
                        </div>
                        <div className={`flex flex-col min-w-0 ${effectiveCollapsed ? 'lg:hidden' : ''}`}>
                            <span className="text-white font-bold text-base tracking-wide font-sans truncate"> TA ĐÀ NẴNG </span>
                            <span className="text-[10px] text-blue-400 uppercase tracking-widest font-semibold truncate"> Luxury Hotel Admin </span>
                        </div>
                    </Link>

                    {/* Nút thu gọn Sidebar trên Desktop (khi đang mở rộng) */}
                    {!effectiveCollapsed && (
                        <button
                            type="button"
                            onClick={handleToggleCollapse}
                            className="hidden lg:flex w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white items-center justify-center transition cursor-pointer shrink-0"
                            title="Thu gọn thanh điều hướng (Mini-Sidebar)"
                            aria-label="Thu gọn thanh điều hướng"
                        >
                            <PanelLeftClose className="w-4 h-4" />
                        </button>
                    )}

                    {/* Nút đóng Sidebar chỉ hiện trên mobile */}
                    <button
                        type="button"
                        onClick={() => setIsMobileSidebarOpen && setIsMobileSidebarOpen(false)}
                        className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center lg:hidden transition cursor-pointer"
                        title="Đóng thanh điều hướng"
                        aria-label="Đóng thanh điều hướng"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Nút mở rộng nhanh khi ở chế độ Mini-Sidebar trên Desktop */}
                {effectiveCollapsed && (
                    <div className="hidden lg:flex justify-center py-2.5 border-b border-slate-800/60 shrink-0">
                        <button
                            type="button"
                            onClick={handleToggleCollapse}
                            className="w-10 h-9 rounded-xl bg-slate-800/90 hover:bg-blue-600 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer shadow-xs"
                            title="Mở rộng thanh điều hướng"
                            aria-label="Mở rộng thanh điều hướng"
                        >
                            <PanelLeftOpen className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Nav Links (Cuộn độc lập khi menu dài ra) */}
                <div
                    className={`flex-1 min-h-0 overflow-y-auto custom-sidebar-scroll py-2.5 pb-12 space-y-3.5 ${effectiveCollapsed ? 'lg:px-2 px-3' : 'px-3'}`}
                >
                    {/* ========================================================================= */}
                    {/* NHÓM 1: VẬN HÀNH TIỀN SẢNH (FRONT OFFICE) */}
                    {/* ========================================================================= */}
                    {(canViewOverview || canViewRooms || canViewBookings || canViewServices || canViewInvoices) && (
                        <div className="space-y-1">
                            <span
                                className={`text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 pt-2 mb-1 block select-none ${
                                    effectiveCollapsed ? 'lg:hidden' : ''
                                }`}
                            >
                                Vận hành & Tiền sảnh
                            </span>
                            <nav className="space-y-1">
                                {/* 1. Tổng quan */}
                                {canViewOverview && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('overview');
                                            setHoveredFlyout(null);
                                        }}
                                        onMouseEnter={(e) =>
                                            openFlyout(e, {
                                                title: 'Tổng quan',
                                                group: 'Vận hành & Tiền sảnh'
                                            })
                                        }
                                        onMouseLeave={scheduleCloseFlyout}
                                        className={`w-full flex items-center ${
                                            effectiveCollapsed ? 'lg:justify-center lg:px-0 px-3.5 justify-between' : 'justify-between px-3.5'
                                        } py-2 rounded-xl text-left text-xs sm:text-[13px] font-semibold transition cursor-pointer ${
                                            activeTab === 'overview'
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'lg:flex-none' : 'flex-1 min-w-0 overflow-hidden'}`}>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                            </svg>
                                            <span className={`truncate text-left ${effectiveCollapsed ? 'lg:hidden' : ''}`}>Tổng quan</span>
                                        </div>
                                    </button>
                                )}

                                {/* 2. Sơ đồ & Quản lý Phòng (PMS Room Board) */}
                                {canViewRooms && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('rooms');
                                            setHoveredFlyout(null);
                                        }}
                                        onMouseEnter={(e) =>
                                            openFlyout(e, {
                                                title: 'Sơ đồ Phòng',
                                                group: 'Vận hành & Tiền sảnh'
                                            })
                                        }
                                        onMouseLeave={scheduleCloseFlyout}
                                        className={`w-full flex items-center ${
                                            effectiveCollapsed ? 'lg:justify-center lg:px-0 px-3.5 justify-between' : 'justify-between px-3.5'
                                        } py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium transition cursor-pointer ${
                                            activeTab === 'rooms'
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'lg:flex-none' : 'flex-1 min-w-0 overflow-hidden'}`}>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                            </svg>
                                            <span className={`truncate text-left ${effectiveCollapsed ? 'lg:hidden' : ''}`}>Sơ đồ Phòng</span>
                                        </div>
                                        
                                    </button>
                                )}

                                {/* 3. Quản lý Đặt phòng (Accordion / Collapsible Menu) */}
                                {canViewBookings && (
                                    <div className="space-y-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (activeTab !== 'bookings' || bookingSubFilter !== 'all') {
                                                    setActiveTab('bookings');
                                                    if (setBookingSubFilter) setBookingSubFilter('all');
                                                    setIsBookingMenuOpen(true);
                                                } else {
                                                    setIsBookingMenuOpen((prev) => !prev);
                                                }
                                            }}
                                            onMouseEnter={(e) =>
                                                openFlyout(e, {
                                                    title: 'Quản lý Đặt phòng',
                                                    badge: pendingBookingsCount > 0 ? `${pendingBookingsCount} chờ` : null,
                                                    badgeClass: 'bg-rose-500 text-white border-rose-400 shadow-sm',
                                                    group: 'Vận hành & Tiền sảnh',
                                                    items: [
                                                        {
                                                            label: 'Danh sách Đặt phòng',
                                                            active: activeTab === 'bookings',
                                                            onClick: () => {
                                                                setActiveTab('bookings');
                                                                if (setBookingSubFilter) setBookingSubFilter('all');
                                                                setHoveredFlyout(null);
                                                            }
                                                        },
                                                        {
                                                            label: 'Lịch đặt phòng (Sơ đồ)',
                                                            active: activeTab === 'booking-timeline',
                                                            onClick: () => {
                                                                setActiveTab('booking-timeline');
                                                                setHoveredFlyout(null);
                                                            }
                                                        }
                                                    ]
                                                })
                                            }
                                            onMouseLeave={scheduleCloseFlyout}
                                            className={`relative w-full flex items-center ${
                                                effectiveCollapsed ? 'lg:justify-center lg:px-0 px-3.5 justify-between' : 'justify-between px-3.5'
                                            } py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium transition cursor-pointer select-none ${
                                                activeTab === 'bookings' && bookingSubFilter === 'all'
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : ['bookings', 'booking-timeline'].includes(activeTab)
                                                        ? 'bg-slate-800 text-white'
                                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                            }`}
                                        >
                                            <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'lg:flex-none' : 'flex-1 min-w-0 overflow-hidden'}`}>
                                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                <span className={`truncate text-left ${effectiveCollapsed ? 'lg:hidden' : ''}`}>Quản lý Đặt phòng</span>
                                            </div>
                                            {pendingBookingsCount > 0 && effectiveCollapsed && (
                                                <span className="hidden lg:flex absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-900 animate-pulse" />
                                            )}
                                            <div className={`flex items-center gap-1.5 shrink-0 ml-2 ${effectiveCollapsed ? 'lg:hidden' : ''}`}>
                                                {pendingBookingsCount > 0 && (
                                                    <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs shadow-rose-500/40">
                                                        {pendingBookingsCount}
                                                    </span>
                                                )}
                                                <span
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsBookingMenuOpen((prev) => !prev);
                                                    }}
                                                    className="shrink-0 p-1 rounded hover:bg-slate-700/60 transition cursor-pointer"
                                                    title={isBookingMenuOpen ? 'Thu gọn menu con' : 'Mở rộng menu con'}
                                                >
                                                    <svg
                                                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${
                                                            isBookingMenuOpen ? 'rotate-180 text-white' : 'rotate-0'
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

                                        {/* Danh sách Menu Con: Lịch đặt phòng (Timeline) */}
                                        <div
                                            className={`${effectiveCollapsed ? 'lg:hidden' : ''} grid transition-all duration-300 ease-in-out overflow-hidden ${
                                                isBookingMenuOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                                            }`}
                                        >
                                            <div className="min-h-0">
                                                <div className="pl-6 pr-1 py-1 space-y-1 border-l-2 border-slate-700/60 ml-4 my-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveTab('booking-timeline');
                                                            setIsBookingMenuOpen(true);
                                                        }}
                                                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left text-xs font-medium transition cursor-pointer ${
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
                                                        
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 4. Quản lý Dịch vụ (Concierge & Kanban) */}
                                {canViewServices && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('services');
                                            setHoveredFlyout(null);
                                        }}
                                        onMouseEnter={(e) =>
                                            openFlyout(e, {
                                                title: 'Yêu cầu Dịch vụ',
                                                group: 'Vận hành & Tiền sảnh'
                                            })
                                        }
                                        onMouseLeave={scheduleCloseFlyout}
                                        className={`w-full flex items-center ${
                                            effectiveCollapsed ? 'lg:justify-center lg:px-0 px-3.5 justify-between' : 'justify-between px-3.5'
                                        } py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium transition cursor-pointer ${
                                            activeTab === 'services' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'lg:flex-none' : 'flex-1 min-w-0 overflow-hidden'}`}>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                            </svg>
                                            <span className={`truncate text-left ${effectiveCollapsed ? 'lg:hidden' : ''}`}>Yêu cầu Dịch vụ</span>
                                        </div>
                                        
                                    </button>
                                )}

                                {/* 5. Hóa đơn & Thu ngân */}
                                {canViewInvoices && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('invoices');
                                            setHoveredFlyout(null);
                                        }}
                                        onMouseEnter={(e) =>
                                            openFlyout(e, {
                                                title: 'Hóa đơn & Thu ngân',
                                                group: 'Vận hành & Tiền sảnh'
                                            })
                                        }
                                        onMouseLeave={scheduleCloseFlyout}
                                        className={`w-full flex items-center ${
                                            effectiveCollapsed ? 'lg:justify-center lg:px-0 px-3.5 justify-between' : 'justify-between px-3.5'
                                        } py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium transition cursor-pointer ${
                                            activeTab === 'invoices' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'lg:flex-none' : 'flex-1 min-w-0 overflow-hidden'}`}>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                                            </svg>
                                            <span className={`truncate text-left ${effectiveCollapsed ? 'lg:hidden' : ''}`}>Hóa đơn & Thu ngân</span>
                                        </div>
                                        
                                    </button>
                                )}
                            </nav>
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* NHÓM 2: BUỒNG PHÒNG & DỊCH VỤ (HOUSEKEEPING & SERVICES) */}
                    {/* ========================================================================= */}
                    {(canViewCategories || canViewRooms || canViewServices) && (
                        <div className={`space-y-1 ${effectiveCollapsed ? 'lg:pt-2 lg:border-t lg:border-slate-800/80' : ''}`}>
                            <span
                                className={`text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 pt-2 mb-1 block select-none ${
                                    effectiveCollapsed ? 'lg:hidden' : ''
                                }`}
                            >
                                Buồng phòng & Dịch vụ
                            </span>
                            <nav className="space-y-1">
                                {/* 6. Hạng phòng & Giá (Accordion / Collapsible Menu) */}
                                {canViewCategories && (
                                    <div className="space-y-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (activeTab !== 'categories' && activeTab !== 'amenities' && activeTab !== 'minibar') {
                                                    setActiveTab('categories');
                                                    setIsCategoryMenuOpen(true);
                                                } else if (activeTab === 'amenities' || activeTab === 'minibar') {
                                                    setActiveTab('categories');
                                                    setIsCategoryMenuOpen(true);
                                                } else {
                                                    setIsCategoryMenuOpen((prev) => !prev);
                                                }
                                            }}
                                            onMouseEnter={(e) =>
                                                openFlyout(e, {
                                                    title: 'Hạng phòng & Giá',
                                                    group: 'Buồng phòng & Dịch vụ',
                                                    items: [
                                                        {
                                                            label: 'Danh sách Hạng phòng',
                                                            active: activeTab === 'categories',
                                                            onClick: () => {
                                                                setActiveTab('categories');
                                                                setHoveredFlyout(null);
                                                            }
                                                        },
                                                        {
                                                            label: 'Tiện nghi phòng',
                                                            active: activeTab === 'amenities',
                                                            onClick: () => {
                                                                setActiveTab('amenities');
                                                                navigate('/admin/amenities');
                                                                setHoveredFlyout(null);
                                                            }
                                                        },
                                                        {
                                                            label: 'Đồ Minibar',
                                                            active: activeTab === 'minibar',
                                                            onClick: () => {
                                                                setActiveTab('minibar');
                                                                navigate('/admin/minibar');
                                                                setHoveredFlyout(null);
                                                            }
                                                        }
                                                    ]
                                                })
                                            }
                                            onMouseLeave={scheduleCloseFlyout}
                                            className={`w-full flex items-center ${
                                                effectiveCollapsed ? 'lg:justify-center lg:px-0 px-3.5 justify-between' : 'justify-between px-3.5'
                                            } py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium transition cursor-pointer select-none ${
                                                activeTab === 'categories'
                                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                                    : activeTab === 'amenities' || activeTab === 'minibar'
                                                        ? 'bg-slate-800 text-white'
                                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                            }`}
                                        >
                                            <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'lg:flex-none' : 'flex-1 min-w-0 overflow-hidden'}`}>
                                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </svg>
                                                <span className={`truncate text-left ${effectiveCollapsed ? 'lg:hidden' : ''}`}>Hạng phòng & Giá</span>
                                            </div>
                                            <div className={`flex items-center gap-1.5 shrink-0 ml-2 ${effectiveCollapsed ? 'lg:hidden' : ''}`}>
                                                
                                                <span
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsCategoryMenuOpen((prev) => !prev);
                                                    }}
                                                    className="shrink-0 p-1 rounded hover:bg-slate-700/60 transition cursor-pointer"
                                                    title={isCategoryMenuOpen ? 'Thu gọn menu con' : 'Mở rộng menu con'}
                                                >
                                                    <svg
                                                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${
                                                            isCategoryMenuOpen ? 'rotate-180 text-white' : 'rotate-0'
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

                                        {/* Danh sách Menu Con: Tiện nghi & Minibar */}
                                        <div
                                            className={`${effectiveCollapsed ? 'lg:hidden' : ''} grid transition-all duration-300 ease-in-out overflow-hidden ${
                                                isCategoryMenuOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                                            }`}
                                        >
                                            <div className="min-h-0">
                                                <div className="pl-6 pr-1 py-1 space-y-1 border-l-2 border-slate-700/60 ml-4 my-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveTab('amenities');
                                                            setIsCategoryMenuOpen(true);
                                                            navigate('/admin/amenities');
                                                        }}
                                                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left text-xs font-medium transition cursor-pointer ${
                                                            activeTab === 'amenities'
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
                                                        
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveTab('minibar');
                                                            setIsCategoryMenuOpen(true);
                                                            navigate('/admin/minibar');
                                                        }}
                                                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left text-xs font-medium transition cursor-pointer ${
                                                            activeTab === 'minibar'
                                                                ? 'bg-blue-600 text-white font-bold shadow-xs'
                                                                : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 flex-1 min-w-0 overflow-hidden">
                                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                            </svg>
                                                            <span className="truncate text-left">Đồ Minibar</span>
                                                        </div>
                                                        
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 7. Quản lý Đồ thất lạc (Lost & Found) */}
                                {canViewRooms && (
                                    <button
                                        type="button"
                                        onClick={() => triggerSwitchTab('lost-and-found')}
                                        onMouseEnter={(e) =>
                                            openFlyout(e, {
                                                title: 'Đồ thất lạc',
                                                group: 'Buồng phòng & Dịch vụ'
                                            })
                                        }
                                        onMouseLeave={scheduleCloseFlyout}
                                        className={`w-full flex items-center ${
                                            effectiveCollapsed ? 'lg:justify-center lg:px-0 px-3.5 justify-between' : 'justify-between px-3.5'
                                        } py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium transition cursor-pointer ${
                                            activeTab === 'lost-and-found'
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'lg:flex-none' : 'flex-1 min-w-0 overflow-hidden'}`}>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <rect x="3" y="7" width="18" height="13" rx="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                <path d="M9 11v5m6-5v5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                            <span className={`truncate text-left ${effectiveCollapsed ? 'lg:hidden' : ''}`}>Đồ thất lạc</span>
                                        </div>
                                        
                                    </button>
                                )}

                                {/* 8. Danh mục Dịch vụ & Thực đơn (CRUD) */}
                                {canViewServices && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('service-items');
                                            setHoveredFlyout(null);
                                        }}
                                        onMouseEnter={(e) =>
                                            openFlyout(e, {
                                                title: 'Danh mục Dịch vụ',
                                                group: 'Buồng phòng & Dịch vụ'
                                            })
                                        }
                                        onMouseLeave={scheduleCloseFlyout}
                                        className={`w-full flex items-center ${
                                            effectiveCollapsed ? 'lg:justify-center lg:px-0 px-3.5 justify-between' : 'justify-between px-3.5'
                                        } py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium transition cursor-pointer ${
                                            activeTab === 'service-items' ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'lg:flex-none' : 'flex-1 min-w-0 overflow-hidden'}`}>
                                            <span className="text-sm shrink-0">🍽️</span>
                                            <span className={`truncate text-left ${effectiveCollapsed ? 'lg:hidden' : ''}`}>Danh mục Dịch vụ</span>
                                        </div>
                                        
                                    </button>
                                )}
                            </nav>
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* NHÓM 3: KHÁCH HÀNG & TIẾP THỊ (CRM & MARKETING) */}
                    {/* ========================================================================= */}
                    {(canViewGuests || canViewCorporatePartners || canViewReviews || canViewMarketing || canViewContacts) && (
                        <div className={`space-y-1 ${effectiveCollapsed ? 'lg:pt-2 lg:border-t lg:border-slate-800/80' : ''}`}>
                            <span
                                className={`text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 pt-2 mb-1 block select-none ${
                                    effectiveCollapsed ? 'lg:hidden' : ''
                                }`}
                            >
                                Khách hàng & Tiếp thị
                            </span>
                            <nav className="space-y-1">
                                {/* 9. Quản lý Khách hàng */}
                                {canViewGuests && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (location.pathname.startsWith('/admin/customers/')) {
                                                navigate('/admin?tab=guests');
                                            } else {
                                                setActiveTab('guests');
                                            }
                                            setHoveredFlyout(null);
                                        }}
                                        onMouseEnter={(e) =>
                                            openFlyout(e, {
                                                title: 'Quản lý Khách hàng',
                                                group: 'Khách hàng & Tiếp thị'
                                            })
                                        }
                                        onMouseLeave={scheduleCloseFlyout}
                                        className={`w-full flex items-center ${
                                            effectiveCollapsed ? 'lg:justify-center lg:px-0 px-3.5 justify-between' : 'justify-between px-3.5'
                                        } py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium transition cursor-pointer ${
                                            ['guests', 'customer-detail'].includes(activeTab)
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'lg:flex-none' : 'flex-1 min-w-0 overflow-hidden'}`}>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                            </svg>
                                            <span className={`truncate text-left ${effectiveCollapsed ? 'lg:hidden' : ''}`}>Quản lý Khách hàng</span>
                                        </div>
                                        
                                    </button>
                                )}

                                {/* 9.1. Quản lý Đối tác Doanh nghiệp (B2B) */}
                                {canViewCorporatePartners && (
                                    <button
                                        type="button"
                                        onClick={() => triggerSwitchTab('corporate-partners')}
                                        onMouseEnter={(e) =>
                                            openFlyout(e, {
                                                title: 'Đối tác Doanh nghiệp',
                                                group: 'Khách hàng & Tiếp thị'
                                            })
                                        }
                                        onMouseLeave={scheduleCloseFlyout}
                                        className={`w-full flex items-center ${
                                            effectiveCollapsed ? 'lg:justify-center lg:px-0 px-3.5 justify-between' : 'justify-between px-3.5'
                                        } py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium transition cursor-pointer ${
                                            activeTab === 'corporate-partners'
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'lg:flex-none' : 'flex-1 min-w-0 overflow-hidden'}`}>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                            <span className={`truncate text-left ${effectiveCollapsed ? 'lg:hidden' : ''}`}>Đối tác Doanh nghiệp</span>
                                        </div>
                                        
                                    </button>
                                )}

                                {/* 10. Quản lý Đánh giá & Phản hồi */}
                                {canViewReviews && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('reviews');
                                            setHoveredFlyout(null);
                                        }}
                                        onMouseEnter={(e) =>
                                            openFlyout(e, {
                                                title: 'Quản lý Đánh giá',
                                                group: 'Khách hàng & Tiếp thị'
                                            })
                                        }
                                        onMouseLeave={scheduleCloseFlyout}
                                        className={`w-full flex items-center ${
                                            effectiveCollapsed ? 'lg:justify-center lg:px-0 px-3.5 justify-between' : 'justify-between px-3.5'
                                        } py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium transition cursor-pointer ${
                                            activeTab === 'reviews' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'lg:flex-none' : 'flex-1 min-w-0 overflow-hidden'}`}>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                            </svg>
                                            <span className={`truncate text-left ${effectiveCollapsed ? 'lg:hidden' : ''}`}>Quản lý Đánh giá</span>
                                        </div>
                                        
                                    </button>
                                )}

                                {/* 11. Marketing & Ưu đãi (Accordion Dropdown) */}
                                {canViewMarketing && (
                                    <div className="space-y-1">
                                        <button
                                            type="button"
                                            onClick={() => setIsMarketingMenuOpen((prev) => !prev)}
                                            onMouseEnter={(e) =>
                                                openFlyout(e, {
                                                    title: 'Marketing & Ưu đãi',
                                                    group: 'Khách hàng & Tiếp thị',
                                                    items: [
                                                        {
                                                            label: 'Khuyến mãi',
                                                            active: activeTab === 'promotions',
                                                            onClick: () => {
                                                                setActiveTab('promotions');
                                                                navigate('/admin/promotions');
                                                                setHoveredFlyout(null);
                                                            }
                                                        },
                                                        {
                                                            label: 'Tin tức & Blog',
                                                            active: activeTab === 'posts',
                                                            onClick: () => {
                                                                setActiveTab('posts');
                                                                navigate('/admin/posts');
                                                                setHoveredFlyout(null);
                                                            }
                                                        }
                                                    ]
                                                })
                                            }
                                            onMouseLeave={scheduleCloseFlyout}
                                            className={`w-full flex items-center ${
                                                effectiveCollapsed ? 'lg:justify-center lg:px-0 px-3.5 justify-between' : 'justify-between px-3.5'
                                            } py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium transition cursor-pointer select-none ${
                                                ['posts', 'promotions'].includes(activeTab)
                                                    ? 'bg-slate-800 text-white'
                                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                            }`}
                                        >
                                            <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'lg:flex-none' : 'flex-1 min-w-0 overflow-hidden'}`}>
                                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                                </svg>
                                                <span className={`truncate text-left ${effectiveCollapsed ? 'lg:hidden' : ''}`}>Marketing & Ưu đãi</span>
                                            </div>
                                            <div className={`flex items-center gap-1.5 shrink-0 ml-2 ${effectiveCollapsed ? 'lg:hidden' : ''}`}>
                                                
                                                <span
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsMarketingMenuOpen((prev) => !prev);
                                                    }}
                                                    className="shrink-0 p-1 rounded hover:bg-slate-700/60 transition cursor-pointer"
                                                    title={isMarketingMenuOpen ? 'Thu gọn menu con' : 'Mở rộng menu con'}
                                                >
                                                    <svg
                                                        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${
                                                            isMarketingMenuOpen ? 'rotate-180 text-white' : 'rotate-0'
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

                                        {/* Danh sách Menu Con: Khuyến mãi, Tin tức & Blog */}
                                        <div
                                            className={`${effectiveCollapsed ? 'lg:hidden' : ''} grid transition-all duration-300 ease-in-out overflow-hidden ${
                                                isMarketingMenuOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                                            }`}
                                        >
                                            <div className="min-h-0">
                                                <div className="pl-6 pr-1 py-1 space-y-1 border-l-2 border-slate-700/60 ml-4 my-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveTab('promotions');
                                                            setIsMarketingMenuOpen(true);
                                                            navigate('/admin/promotions');
                                                        }}
                                                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left text-xs font-medium transition cursor-pointer ${
                                                            activeTab === 'promotions'
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
                                                        
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveTab('posts');
                                                            setIsMarketingMenuOpen(true);
                                                            navigate('/admin/posts');
                                                        }}
                                                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left text-xs font-medium transition cursor-pointer ${
                                                            activeTab === 'posts'
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
                                                        
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 12. Quản lý Liên hệ */}
                                {canViewContacts && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('contacts');
                                            setHoveredFlyout(null);
                                        }}
                                        onMouseEnter={(e) =>
                                            openFlyout(e, {
                                                title: 'Quản lý Liên hệ',
                                                group: 'Khách hàng & Tiếp thị'
                                            })
                                        }
                                        onMouseLeave={scheduleCloseFlyout}
                                        className={`w-full flex items-center ${
                                            effectiveCollapsed ? 'lg:justify-center lg:px-0 px-3.5 justify-between' : 'justify-between px-3.5'
                                        } py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium transition cursor-pointer ${
                                            activeTab === 'contacts' ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'lg:flex-none' : 'flex-1 min-w-0 overflow-hidden'}`}>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                            <span className={`truncate text-left ${effectiveCollapsed ? 'lg:hidden' : ''}`}>Quản lý Liên hệ</span>
                                        </div>
                                    </button>
                                )}
                            </nav>
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* NHÓM 4: HỆ THỐNG & BÁO CÁO (ADMINISTRATION & REPORTS) */}
                    {/* ========================================================================= */}
                    {(canViewAnalytics || canViewEmployees || canViewSettings || isHighLevelManager) && (
                        <div className={`space-y-1 ${effectiveCollapsed ? 'lg:pt-2 lg:border-t lg:border-slate-800/80' : ''}`}>
                            <span
                                className={`text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 pt-2 mb-1 block select-none ${
                                    effectiveCollapsed ? 'lg:hidden' : ''
                                }`}
                            >
                                Hệ thống & Báo cáo
                            </span>
                            <nav className="space-y-1">
                                {/* 13. Báo cáo & Thống kê Doanh thu */}
                                {canViewAnalytics && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (location.pathname.startsWith('/admin/customers/') || location.pathname === '/admin/profile') {
                                                navigate('/admin?tab=analytics');
                                            } else {
                                                setActiveTab('analytics');
                                            }
                                            setHoveredFlyout(null);
                                        }}
                                        onMouseEnter={(e) =>
                                            openFlyout(e, {
                                                title: 'Báo cáo & Thống kê',
                                                group: 'Hệ thống & Báo cáo'
                                            })
                                        }
                                        onMouseLeave={scheduleCloseFlyout}
                                        className={`w-full flex items-center ${
                                            effectiveCollapsed ? 'lg:justify-center lg:px-0 px-3.5 justify-between' : 'justify-between px-3.5'
                                        } py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium transition cursor-pointer ${
                                            ['analytics', 'reports'].includes(activeTab)
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'lg:flex-none' : 'flex-1 min-w-0 overflow-hidden'}`}>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            <span className={`truncate text-left ${effectiveCollapsed ? 'lg:hidden' : ''}`}>Báo cáo & Thống kê</span>
                                        </div>
                                        
                                    </button>
                                )}

                                {/* 14. Quản lý Nhân sự & Phân quyền */}
                                {canViewEmployees && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('employees');
                                            setHoveredFlyout(null);
                                        }}
                                        onMouseEnter={(e) =>
                                            openFlyout(e, {
                                                title: 'Quản lý Nhân sự',
                                                group: 'Hệ thống & Báo cáo'
                                            })
                                        }
                                        onMouseLeave={scheduleCloseFlyout}
                                        className={`w-full flex items-center ${
                                            effectiveCollapsed ? 'lg:justify-center lg:px-0 px-3.5 justify-between' : 'justify-between px-3.5'
                                        } py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium transition cursor-pointer ${
                                            activeTab === 'employees'
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'lg:flex-none' : 'flex-1 min-w-0 overflow-hidden'}`}>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            <span className={`truncate text-left ${effectiveCollapsed ? 'lg:hidden' : ''}`}>Quản lý Nhân sự</span>
                                        </div>
                                        
                                    </button>
                                )}

                                {/* 15. Cài đặt hệ thống */}
                                {canViewSettings && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('settings');
                                            setHoveredFlyout(null);
                                        }}
                                        onMouseEnter={(e) =>
                                            openFlyout(e, {
                                                title: 'Cài đặt hệ thống',
                                                group: 'Hệ thống & Báo cáo'
                                            })
                                        }
                                        onMouseLeave={scheduleCloseFlyout}
                                        className={`w-full flex items-center ${
                                            effectiveCollapsed ? 'lg:justify-center lg:px-0 px-3.5 justify-between' : 'justify-between px-3.5'
                                        } py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium transition cursor-pointer ${
                                            activeTab === 'settings' ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'lg:flex-none' : 'flex-1 min-w-0 overflow-hidden'}`}>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <span className={`truncate text-left ${effectiveCollapsed ? 'lg:hidden' : ''}`}>Cài đặt hệ thống</span>
                                        </div>
                                    </button>
                                )}

                                {/* 16. Nhật ký thao tác hệ thống (Audit Log) - Dành riêng cho ADMIN, OWNER, MANAGER */}
                                {isHighLevelManager && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveTab('audit-logs');
                                            setHoveredFlyout(null);
                                        }}
                                        onMouseEnter={(e) =>
                                            openFlyout(e, {
                                                title: 'Nhật ký hệ thống',
                                                group: 'Hệ thống & Báo cáo'
                                            })
                                        }
                                        onMouseLeave={scheduleCloseFlyout}
                                        className={`w-full flex items-center ${
                                            effectiveCollapsed ? 'lg:justify-center lg:px-0 px-3.5 justify-between' : 'justify-between px-3.5'
                                        } py-2 rounded-xl text-left text-xs sm:text-[13px] font-medium transition cursor-pointer ${
                                            activeTab === 'audit-logs' ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                    >
                                        <div className={`flex items-center gap-3 ${effectiveCollapsed ? 'lg:flex-none' : 'flex-1 min-w-0 overflow-hidden'}`}>
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span className={`truncate text-left ${effectiveCollapsed ? 'lg:hidden' : ''}`}>Nhật ký hệ thống</span>
                                        </div>
                                    </button>
                                )}
                            </nav>
                        </div>
                    )}
                </div>

                {/* Sidebar Footer Widget: Khối tĩnh hiển thị thông tin tài khoản quản lý & Đăng xuất (Cố định phía dưới) */}
                <div className={`shrink-0 border-t border-slate-800/80 ${effectiveCollapsed ? 'lg:p-2.5 p-4' : 'p-4'} space-y-2`}>
                    <div
                        className={`bg-slate-800/60 rounded-2xl flex items-center text-xs select-none ${
                            effectiveCollapsed ? 'lg:flex-col lg:gap-2 lg:p-2 justify-between p-3' : 'justify-between p-3'
                        }`}
                    >
                        <div
                            className={`flex items-center gap-2.5 ${
                                effectiveCollapsed ? 'lg:mr-0 lg:justify-center' : 'min-w-0 flex-1 overflow-hidden mr-2'
                            }`}
                            title={`${user?.full_name || user?.username || ''} (${user?.role?.toUpperCase() || ''})`}
                        >
                            <UserAvatar
                                avatar={user?.avatar}
                                name={user?.full_name || user?.username}
                                role={user?.role}
                                size="sm"
                                border={false}
                            />
                            <div className={`min-w-0 flex-1 ${effectiveCollapsed ? 'lg:hidden' : ''}`}>
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
                            onClick={handleLogoutClick}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 rounded-lg transition shrink-0 cursor-pointer"
                            title="Đăng xuất khỏi hệ thống"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Floating Tooltip / Popover Menu con khi ở chế độ Mini-Sidebar (w-20) */}
            {effectiveCollapsed && hoveredFlyout && (
                <div
                    onMouseEnter={cancelCloseFlyout}
                    onMouseLeave={scheduleCloseFlyout}
                    style={{ top: `${hoveredFlyout.top}px` }}
                    className="hidden lg:block fixed left-20 ml-2.5 z-[60] min-w-[210px] bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700/90 p-2.5 animate-fadeIn print:hidden"
                >
                    {hoveredFlyout.group && (
                        <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 px-2 pb-1">
                            {hoveredFlyout.group}
                        </div>
                    )}
                    <div className="flex items-center justify-between gap-2 px-2 py-1">
                        <span className="text-xs font-bold text-white">{hoveredFlyout.title}</span>
                        {hoveredFlyout.badge && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${hoveredFlyout.badgeClass || 'bg-blue-500/30 text-blue-300 border-blue-400/30'}`}>
                                {hoveredFlyout.badge}
                            </span>
                        )}
                    </div>
                    {Array.isArray(hoveredFlyout.items) && hoveredFlyout.items.length > 0 && (
                        <div className="mt-1.5 pt-1.5 border-t border-slate-800 space-y-1">
                            {hoveredFlyout.items.map((sub, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={sub.onClick}
                                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs font-semibold transition cursor-pointer ${
                                        sub.active
                                            ? 'bg-blue-600 text-white font-bold shadow-xs'
                                            : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                    }`}
                                >
                                    <span className="truncate">{sub.label}</span>
                                    {sub.badge && (
                                        <span className="text-[9.5px] font-bold bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 ml-2 shrink-0">
                                            {sub.badge}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Fallback Modal Xác Nhận Đăng Xuất (Khi dùng độc lập không truyền onRequestLogout) */}
            {!onRequestLogout && (
                <LogoutConfirmModal
                    isOpen={isLogoutModalOpen}
                    onClose={() => !isLoggingOut && setIsLogoutModalOpen(false)}
                    onConfirm={async () => {
                        try {
                            setIsLoggingOut(true);
                            await authService.logout();
                        } catch (e) {
                            console.error('Sidebar logout error:', e);
                        } finally {
                            setIsLogoutModalOpen(false);
                            setIsLoggingOut(false);
                            window.location.href = '/login';
                        }
                    }}
                    isLoading={isLoggingOut}
                    title="Xác Nhận Đăng Xuất Quản Trị"
                    userName={user?.full_name || user?.username}
                    role={user?.role}
                    message="Bạn có chắc chắn muốn đăng xuất khỏi hệ thống Quản trị Khách Sạn TA?"
                />
            )}
        </>
    );
}
