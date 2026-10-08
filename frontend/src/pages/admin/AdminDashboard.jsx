import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, User as UserIcon, LogOut, ExternalLink } from 'lucide-react';
import { useAuth } from '../../store/authStore';
import { authService } from '../../services/authService';
import { useHasPermission } from '../../utils/permission';
import { bookingService } from '../../services/bookingService';
import GuestManagement from './GuestManagement';
import EmployeeManagement from './EmployeeManagement';
import RoomManagement from './RoomManagement';
import CategoryManagement from './CategoryManagement';
import BookingManagement from './BookingManagement';
import BookingTimeline from './BookingTimeline';
import ServiceRequestKanban from './ServiceRequestKanban';
import ServiceManagement from './ServiceManagement';
import ReviewManagement from './ReviewManagement';
import UserAvatar from '../../components/common/UserAvatar';
import NotificationBell from '../../components/common/NotificationBell';
import StaffProfile from './StaffProfile';
import CustomerDetail from './CustomerDetail';
import PostManagement from './PostManagement';
import ContactManagement from './ContactManagement';
import Analytics from './Analytics';
import InvoiceManagement from './InvoiceManagement';
import SystemSettings from './SystemSettings';
import AmenityManagement from './AmenityManagement';
import LogoutConfirmModal from '../../components/common/LogoutConfirmModal';
import PromotionManagement from './PromotionManagement';

// Tiện ích format ngày hiển thị DD/MM/YYYY
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

// Tiện ích format thời gian chi tiết HH:MM • DD/MM/YYYY
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

const STATUS_CONFIGS = {
    pending: { label: 'Chờ duyệt', color: 'bg-amber-50 text-amber-800 border-amber-300' },
    paid: { label: 'Chờ duyệt (Đã TT QR)', color: 'bg-amber-50 text-amber-800 border-amber-300' },
    PAID: { label: 'Chờ duyệt (Đã TT QR)', color: 'bg-amber-50 text-amber-800 border-amber-300' },
    confirmed: { label: 'Đã xác nhận', color: 'bg-blue-50 text-blue-800 border-blue-300' },
    checked_in: { label: 'Đang ở', color: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
    checked_out: { label: 'Đã trả phòng', color: 'bg-purple-50 text-purple-800 border-purple-300' },
    cancelled: { label: 'Đã Hủy', color: 'bg-rose-50 text-rose-800 border-rose-300' }
};

// Helper biểu tượng dịch vụ phòng (Concierge)
const getServiceCategoryIcon = (categoryName, serviceName) => {
    const text = `${categoryName || ''} ${serviceName || ''}`.toLowerCase();
    if (text.includes('ẩm thực') || text.includes('ăn') || text.includes('món') || text.includes('bò') || text.includes('súp') || text.includes('phở') || text.includes('dining')) return '🍽️';
    if (text.includes('uống') || text.includes('cà phê') || text.includes('trà') || text.includes('nước') || text.includes('bar')) return '🍵';
    if (text.includes('spa') || text.includes('massage') || text.includes('trị liệu') || text.includes('thư giãn')) return '💆';
    if (text.includes('giặt') || text.includes('ủi') || text.includes('laundry')) return '🧺';
    if (text.includes('xe') || text.includes('đón') || text.includes('sân bay') || text.includes('transport')) return '🚖';
    if (text.includes('dọn') || text.includes('buồng') || text.includes('cleaning')) return '🧹';
    return '🛎️';
};

// Helper nhãn trạng thái phiếu yêu cầu dịch vụ
const getServiceRequestStatusBadge = (status) => {
    switch (status) {
        case 'pending':
            return { label: 'Chờ xử lý', color: 'bg-amber-50 text-amber-700 border-amber-200' };
        case 'in_progress':
            return { label: 'Đang phục vụ', color: 'bg-blue-50 text-blue-700 border-blue-200' };
        case 'completed':
            return { label: 'Hoàn thành', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
        case 'cancelled':
            return { label: 'Đã hủy', color: 'bg-rose-50 text-rose-700 border-rose-200' };
        default:
            return { label: status, color: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
};

export default function HotelAdminDashboard({ initialTab }) {
    const { user, isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // 🛡️ Kiểm tra phân quyền RBAC cho từng phân hệ menu
    const canViewOverview = useHasPermission('overview', 'read');
    const canViewGuests = useHasPermission('guests', 'read');
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

    // Xác định tab ban đầu dựa trên route URL hoặc prop
    const getInitialTab = () => {
        if (location.pathname === '/admin/profile') return 'profile';
        if (location.pathname.startsWith('/admin/customers/')) return 'customer-detail';
        if (location.pathname === '/admin/analytics' || location.pathname === '/admin/reports') return 'analytics';
        if (location.pathname === '/admin/settings') return 'settings';
        if (location.pathname === '/admin/amenities') return 'amenities';
        if (location.pathname === '/admin/posts') return 'posts';
        if (location.pathname === '/admin/promotions') return 'promotions';
        const params = new URLSearchParams(location.search);
        return params.get('tab') || initialTab || 'overview';
    };

    const [activeTab, setActiveTab] = useState(getInitialTab);
    const [timeFilter, setTimeFilter] = useState('month');
    const [bookingFilter, setBookingFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // State quản lý Dropdown Avatar Profile trên Topbar
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef(null);

    // Đóng Dropdown Avatar khi click ra ngoài
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setIsProfileMenuOpen(false);
            }
        };

        if (isProfileMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isProfileMenuOpen]);

    // Đồng bộ activeTab khi người dùng chuyển route (VD: /admin/profile, /admin/customers/:id hoặc /admin)
    useEffect(() => {
        if (location.pathname === '/admin/profile') {
            setActiveTab('profile');
        } else if (location.pathname.startsWith('/admin/customers/')) {
            setActiveTab('customer-detail');
        } else if (location.pathname === '/admin/analytics' || location.pathname === '/admin/reports') {
            setActiveTab('analytics');
        } else if (location.pathname === '/admin/settings') {
            setActiveTab('settings');
        } else if (location.pathname === '/admin/amenities') {
            setActiveTab('amenities');
            setIsCategoryMenuOpen(true);
        } else if (location.pathname === '/admin/posts') {
            setActiveTab('posts');
            setIsMarketingMenuOpen(true);
        } else if (location.pathname === '/admin/promotions') {
            setActiveTab('promotions');
            setIsMarketingMenuOpen(true);
        } else {
            const params = new URLSearchParams(location.search);
            const tabParam = params.get('tab');
            if (tabParam) {
                setActiveTab(tabParam);
            }
        }
    }, [location.pathname, location.search]);

    // Tự động chuyển tab phù hợp nếu vai trò hiện tại không có quyền xem Tổng quan (Overview)
    useEffect(() => {
        if (!canViewOverview && activeTab === 'overview') {
            if (canViewRooms) setActiveTab('rooms');
            else if (canViewServices) setActiveTab('services');
            else if (canViewBookings) setActiveTab('bookings');
            else if (canViewInvoices) setActiveTab('invoices');
        }
    }, [canViewOverview, activeTab, canViewRooms, canViewServices, canViewBookings, canViewInvoices]);

    // Chuyển tab và đồng bộ đường dẫn URL
    const handleSwitchTab = (tab) => {
        setActiveTab(tab);
        if (tab === 'profile') {
            navigate('/admin/profile');
        } else if (location.pathname === '/admin/profile' || location.pathname.startsWith('/admin/customers/')) {
            navigate('/admin?tab=' + (tab === 'overview' ? '' : tab));
        }
    };

    // Dữ liệu phân tích thống kê thời gian thực cho trang Tổng quan
    const [dashboardData, setDashboardData] = useState(null);
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
    const [donutView, setDonutView] = useState('source'); // 'source' (Kênh) | 'status' (Trạng thái)

    // Dữ liệu đơn đặt phòng thực tế từ cơ sở dữ liệu
    const [realBookings, setRealBookings] = useState([]);
    const [isLoadingRealBookings, setIsLoadingRealBookings] = useState(false);
    const [actualBookingsCount, setActualBookingsCount] = useState(0);
    const [pendingBookingsCount, setPendingBookingsCount] = useState(0);
    const [bookingSubFilter, setBookingSubFilter] = useState('all');
    const [checkInTodayCount, setCheckInTodayCount] = useState(0);
    const [checkOutTodayCount, setCheckOutTodayCount] = useState(0);
    const [isBookingMenuOpen, setIsBookingMenuOpen] = useState(true);
    const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(true);
    const [isMarketingMenuOpen, setIsMarketingMenuOpen] = useState(true);

    // Kiểm tra phân hệ: Cho phép tài khoản Quản trị, Lễ tân và Nhân sự
    // (admin, owner, manager, receptionist, staff, cashier, housekeeper, service_staff, technician hoặc is_staff, is_superuser)
    const isManagerRole = Boolean(
        isAuthenticated &&
        user &&
        (['admin', 'owner', 'manager', 'receptionist', 'staff', 'cashier', 'housekeeper', 'service_staff', 'technician'].includes(user.role) || user.is_staff || user.is_superuser)
    );

    const isHighLevelManager = Boolean(
        user &&
        (['admin', 'owner', 'manager'].includes(user.role) || user.is_superuser)
    );

    // Tải số lượng và danh sách đơn đặt phòng thực tế từ CSDL để hiển thị bảng thời gian thực
    const loadRealBookingStats = async (isSilent = false) => {
        try {
            if (!isSilent) setIsLoadingRealBookings(true);
            const res = await bookingService.getMyBookings();
            if (res && res.success && Array.isArray(res.data)) {
                const list = res.data;
                setRealBookings(list);
                setActualBookingsCount(list.length);
                const pending = list.filter((b) => ['pending', 'paid', 'PAID'].includes(b.status)).length;
                setPendingBookingsCount(pending);
            }
        } catch (e) {
            console.error('Lỗi khi tải số lượng đơn thực tế:', e);
        } finally {
            if (!isSilent) setIsLoadingRealBookings(false);
        }
    };

    // Tải toàn bộ thống kê thực tế cho Dashboard từ backend
    const loadDashboardStats = async (isSilent = false) => {
        try {
            if (!isSilent) setIsLoadingDashboard(true);
            const res = await bookingService.getDashboardStats({ time_filter: timeFilter });
            if (res && res.success) {
                setDashboardData(res);
            }
        } catch (e) {
            console.error('Lỗi khi tải thống kê tổng quan:', e);
        } finally {
            if (!isSilent) setIsLoadingDashboard(false);
        }
    };

    // Tính toán phân đoạn biểu đồ tròn Donut Chart thời gian thực
    const activeDonutData = useMemo(() => {
        if (!dashboardData) return [];
        return donutView === 'source'
            ? (dashboardData.bookings?.booking_sources || [])
            : (dashboardData.bookings?.status_distribution || []);
    }, [dashboardData, donutView]);

    const circumference = 2 * Math.PI * 38; // 238.761

    const donutSegments = useMemo(() => {
        let accumulated = 0;
        return activeDonutData.map((item) => {
            const strokeLen = ((item.percentage || 0) / 100) * circumference;
            const strokeDasharray = `${strokeLen} ${circumference - strokeLen}`;
            const strokeDashoffset = -accumulated;
            accumulated += strokeLen;
            return {
                ...item,
                strokeDasharray,
                strokeDashoffset
            };
        });
    }, [activeDonutData, circumference]);

    // Tính toán số lượng Check-in và Check-out hôm nay để hiển thị badge ở Sidebar
    useEffect(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const ci = realBookings.filter(
            (b) => b.check_in_date === todayStr && ['pending', 'paid', 'PAID', 'confirmed'].includes(b.status)
        ).length;
        const co = realBookings.filter(
            (b) => b.check_out_date === todayStr && b.status === 'checked_in'
        ).length;
        setCheckInTodayCount(ci);
        setCheckOutTodayCount(co);
    }, [realBookings]);

    // Tải dữ liệu dashboard khi thay đổi bộ lọc thời gian
    useEffect(() => {
        if (isAuthenticated && isManagerRole) {
            loadDashboardStats(false);
        }
    }, [isAuthenticated, isManagerRole, timeFilter]);

    useEffect(() => {
        if (isAuthenticated && isManagerRole) {
            loadRealBookingStats();
            loadDashboardStats(true);

            // 1. Tự động đồng bộ khi chuyển về cửa sổ / tab Admin
            const handleFocus = () => {
                loadRealBookingStats(true);
                loadDashboardStats(true);
            };
            // 2. Nhận tín hiệu thời gian thực khi có khách đặt phòng hoặc dịch vụ ở tab khác
            const handleStorage = (e) => {
                if (e.key === 'pms_last_booking_event' || e.key === 'pms_last_service_event') {
                    loadRealBookingStats(true);
                    loadDashboardStats(true);
                }
            };
            const handleCustomBooking = () => {
                loadRealBookingStats(true);
                loadDashboardStats(true);
            };
            const handleCustomService = () => {
                loadDashboardStats(true);
            };

            window.addEventListener('focus', handleFocus);
            window.addEventListener('storage', handleStorage);
            window.addEventListener('pms_booking_created', handleCustomBooking);
            window.addEventListener('pms_service_created', handleCustomService);
            window.addEventListener('pms_service_updated', handleCustomService);

            // 3. Chu kỳ polling mỗi 8 giây để cập nhật đơn và số liệu mới
            const interval = setInterval(() => {
                loadRealBookingStats(true);
                loadDashboardStats(true);
            }, 8000);

            return () => {
                window.removeEventListener('focus', handleFocus);
                window.removeEventListener('storage', handleStorage);
                window.removeEventListener('pms_booking_created', handleCustomBooking);
                window.removeEventListener('pms_service_created', handleCustomService);
                window.removeEventListener('pms_service_updated', handleCustomService);
                clearInterval(interval);
            };
        }
    }, [isAuthenticated, isManagerRole, activeTab, timeFilter]);

    // State modal xác nhận đăng xuất
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Mở modal xác nhận đăng xuất
    const handleRequestLogout = () => {
        setIsProfileMenuOpen(false);
        setIsLogoutModalOpen(true);
    };

    // Tự động chuyển hướng về trang đăng nhập nếu chưa đăng nhập
    useEffect(() => {
        if (!isAuthenticated) {
            window.location.href = '/login';
        }
    }, [isAuthenticated]);

    // Thực hiện đăng xuất khi đã xác nhận
    const handleConfirmLogout = async () => {
        try {
            setIsLoggingOut(true);
            await authService.logout();
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            setIsLogoutModalOpen(false);
            setIsLoggingOut(false);
            window.location.href = '/login';
        }
    };

    // Helper tên vai trò hiển thị
    const getRoleDisplayName = (roleCode) => {
        switch (roleCode) {
            case 'admin':
                return 'Quản Trị Viên Hệ Thống (Admin)';
            case 'owner':
                return 'Chủ Khách Sạn & Chủ Tịch HĐQT (Owner)';
            case 'manager':
                return 'Tổng Giám Đốc Điều Hành (General Manager)';
            case 'receptionist':
                return 'Nhân Viên Lễ Tân & Tiếp Đón (Receptionist)';
            case 'cashier':
                return 'Nhân Viên Kế Toán & Thu Ngân (Cashier)';
            case 'housekeeper':
                return 'Nhân Viên Buồng Phòng & Vệ Sinh (Housekeeper)';
            case 'service_staff':
                return 'Nhân Viên Dịch Vụ & Ẩm Thực (F&B / Spa)';
            case 'technician':
                return 'Kỹ Thuật Viên Cơ Điện & Bảo Trì (Technician)';
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
        if (!isAuthenticated) {
            return (
                <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100 font-sans">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-xs text-slate-400">Đang chuyển hướng về trang đăng nhập...</p>
                    </div>
                </div>
            );
        }

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
                                    onClick={handleRequestLogout}
                                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-blue-600/30 transition cursor-pointer"
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

                {/* Modal Xác Nhận Đăng Xuất Quản Trị trong màn hình chặn bảo mật */}
                <LogoutConfirmModal
                    isOpen={isLogoutModalOpen}
                    onClose={() => !isLoggingOut && setIsLogoutModalOpen(false)}
                    onConfirm={handleConfirmLogout}
                    isLoading={isLoggingOut}
                    title="Xác Nhận Đăng Xuất"
                    userName={user?.full_name || user?.username}
                    role={getRoleDisplayName(user?.role)}
                    message="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản hiện tại?"
                />
            </div>
        );
    }

    // =========================================================================
    // DỮ LIỆU ĐẶT PHÒNG THỜI GIAN THỰC CHO TAB TỔNG QUAN
    // =========================================================================
    const filteredBookings = useMemo(() => {
        return realBookings.filter((item) => {
            const matchFilter =
                bookingFilter === 'all'
                    ? true
                    : bookingFilter === 'pending'
                        ? ['pending', 'paid', 'PAID'].includes(item.status)
                        : bookingFilter === 'checked_in'
                            ? item.status === 'checked_in'
                            : item.status === bookingFilter;

            if (!searchTerm.trim()) return matchFilter;

            const q = searchTerm.trim().toLowerCase();
            const matchCode = item.booking_code?.toLowerCase().includes(q);
            const matchGuest = item.guest_name?.toLowerCase().includes(q);
            const matchEmail = item.guest_email?.toLowerCase().includes(q);
            const matchPhone = item.guest_phone?.toLowerCase().includes(q);
            const matchRoom = item.room_name?.toLowerCase().includes(q);
            const matchRoomNum = String(item.room_number || '').toLowerCase().includes(q);
            const matchCccd = String(item.identity_card || '').toLowerCase().includes(q);

            return matchFilter && (matchCode || matchGuest || matchEmail || matchPhone || matchRoom || matchRoomNum || matchCccd);
        });
    }, [realBookings, bookingFilter, searchTerm]);

    // Hàm phụ trợ hiển thị cảnh báo phân quyền khi truy cập tab không được cấp phép
    const renderAccessDenied = (message) => (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                🛡️
            </div>
            <h2 className="text-lg font-bold text-slate-900">Giới hạn quyền truy cập</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {message || 'Tài khoản của bạn không có quyền truy cập vào phân hệ này.'} Vui lòng liên hệ Quản trị viên nếu bạn cần cấp quyền cho phân hệ này.
            </p>
            <div className="mt-6">
                <button
                    type="button"
                    onClick={() => setActiveTab('overview')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition cursor-pointer"
                >
                    Quay về Tổng quan
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white print:bg-white print:block">
            {/* ========================================================================= */}
            {/* 1. SIDEBAR CỐ ĐỊNH BÊN TRÁI (w-72 sang trọng, không xô lệch chữ dài) */}
            {/* ========================================================================= */}
            <aside className="w-72 h-screen bg-slate-900 text-slate-300 flex flex-col shrink-0 fixed inset-y-0 left-0 z-40 border-r border-slate-800 print:hidden">
                {/* Logo Brand Header (Cố định phía trên) */}
                <Link to="/" className="h-20 shrink-0 flex items-center px-6 border-b border-slate-800/80 gap-3 hover:bg-slate-800/40 transition">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-serif font-black text-xl shadow-lg shadow-blue-600/40 shrink-0">
                        TA
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-white font-bold text-base tracking-wide font-serif truncate"> TA ĐÀ NẴNG </span>
                        <span className="text-[10px] text-blue-400 uppercase tracking-widest font-semibold truncate"> Luxury Hotel Admin </span>
                    </div>
                </Link>

                {/* Nav Links (Cuộn độc lập khi menu dài ra) */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent px-4 py-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-3 block">
                        Quản trị & Phân quyền
                    </span>
                        <nav className="space-y-1">
                            {/* 1. Tổng quan */}
                            {canViewOverview && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('overview')}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-semibold transition ${activeTab === 'overview'
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                        </svg>
                                        <span className="truncate text-left">Tổng quan</span>
                                    </div>
                                </button>
                            )}

                            {/* 2. Quản lý Khách hàng (Feature 1) */}
                            {canViewGuests && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (location.pathname.startsWith('/admin/customers/')) {
                                            navigate('/admin?tab=guests');
                                        } else {
                                            setActiveTab('guests');
                                        }
                                    }}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition ${['guests', 'customer-detail'].includes(activeTab)
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                        <span className="truncate text-left">Quản lý Khách hàng</span>
                                    </div>
                                    <span className="shrink-0 bg-blue-500/30 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-400/30 ml-2">
                                        VIP
                                    </span>
                                </button>
                            )}

                            {/* 3. Quản lý Nhân sự & Phân quyền (Feature 2) */}
                            {canViewEmployees && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('employees')}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition ${activeTab === 'employees'
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <span className="truncate text-left">Quản lý Nhân sự</span>
                                    </div>
                                    <span className="shrink-0 bg-indigo-500/30 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-400/30 ml-2">
                                        RBAC
                                    </span>
                                </button>
                            )}

                            {/* 4. Sơ đồ & Quản lý Phòng (PMS Room Board) */}
                            {canViewRooms && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('rooms')}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition ${activeTab === 'rooms'
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                        </svg>
                                        <span className="truncate text-left">Sơ đồ Phòng</span>
                                    </div>
                                    <span className="shrink-0 bg-emerald-500/30 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/30 ml-2">
                                        PMS
                                    </span>
                                </button>
                            )}

                            {/* 5. Quản lý Hạng phòng & Bảng giá (Accordion / Collapsible Menu) */}
                            {canViewCategories && (
                                <div className="space-y-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (activeTab !== 'categories' && activeTab !== 'amenities') {
                                                setActiveTab('categories');
                                                setIsCategoryMenuOpen(true);
                                            } else if (activeTab === 'amenities') {
                                                setActiveTab('categories');
                                                setIsCategoryMenuOpen(true);
                                            } else {
                                                setIsCategoryMenuOpen((prev) => !prev);
                                            }
                                        }}
                                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition cursor-pointer select-none ${activeTab === 'categories'
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
                                            <span className="shrink-0 bg-amber-500/30 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
                                                Suites
                                            </span>
                                            {/* Nút ChevronDown toggle đóng/mở menu con độc lập */}
                                            <span
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsCategoryMenuOpen((prev) => !prev);
                                                }}
                                                className="shrink-0 p-1 rounded hover:bg-slate-700/60 transition cursor-pointer"
                                                title={isCategoryMenuOpen ? "Thu gọn menu con" : "Mở rộng menu con"}
                                            >
                                                <svg
                                                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${isCategoryMenuOpen ? 'rotate-180 text-white' : 'rotate-0'
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

                                    {/* Danh sách Menu Con: Tiện nghi (link tới /admin/amenities) */}
                                    <div
                                        className={`grid transition-all duration-300 ease-in-out overflow-hidden ${isCategoryMenuOpen
                                                ? 'grid-rows-[1fr] opacity-100'
                                                : 'grid-rows-[0fr] opacity-0'
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
                                                    className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-left text-xs font-semibold transition cursor-pointer ${activeTab === 'amenities'
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
                            )}

                            {/* 6. Quản lý Đặt phòng (Accordion / Collapsible Menu) */}
                            {canViewBookings && (
                                <div className="space-y-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (activeTab !== 'bookings' || bookingSubFilter !== 'all') {
                                                setActiveTab('bookings');
                                                setBookingSubFilter('all');
                                                setIsBookingMenuOpen(true);
                                            } else {
                                                setIsBookingMenuOpen((prev) => !prev);
                                            }
                                        }}
                                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition cursor-pointer select-none ${activeTab === 'bookings' && bookingSubFilter === 'all'
                                                ? 'bg-blue-600 text-white shadow-md'
                                                : ['bookings', 'booking-timeline'].includes(activeTab)
                                                    ? 'bg-slate-800 text-white'
                                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                            }`}
                                        title="Quản lý Đặt phòng"
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span className="truncate text-left">Quản lý Đặt phòng</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                            {/* Nút ChevronDown toggle đóng/mở menu con độc lập */}
                                            <span
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsBookingMenuOpen((prev) => !prev);
                                                }}
                                                className="shrink-0 p-1 rounded hover:bg-slate-700/60 transition cursor-pointer"
                                                title={isBookingMenuOpen ? "Thu gọn menu con" : "Mở rộng menu con"}
                                            >
                                                <svg
                                                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${isBookingMenuOpen ? 'rotate-180 text-white' : 'rotate-0'
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

                                    {/* Danh sách Menu Con: Dùng CSS Grid grid-rows-[0fr] -> grid-rows-[1fr] transition mượt mà */}
                                    <div
                                        className={`grid transition-all duration-300 ease-in-out overflow-hidden ${isBookingMenuOpen
                                                ? 'grid-rows-[1fr] opacity-100'
                                                : 'grid-rows-[0fr] opacity-0'
                                            }`}
                                    >
                                        <div className="min-h-0">
                                            <div className="pl-6 pr-1 py-1 space-y-1 border-l-2 border-slate-700/60 ml-4 my-1">
                                                {/* Menu con 1: Sơ đồ Timeline / Gantt Chart */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveTab('booking-timeline');
                                                        setIsBookingMenuOpen(true);
                                                    }}
                                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs font-semibold transition cursor-pointer ${activeTab === 'booking-timeline'
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

                            {/* 7. Quản lý Dịch vụ (Concierge & Kanban) */}
                            {canViewServices && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('services')}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition ${activeTab === 'services' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                        </svg>
                                        <span className="truncate text-left">Yêu cầu Dịch vụ</span>
                                    </div>
                                    <span className="shrink-0 bg-purple-500/30 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-400/30 ml-2">
                                        Kanban
                                    </span>
                                </button>
                            )}

                            {/* 8. Quản lý Danh mục Dịch vụ & Thực đơn (CRUD) */}
                            {canViewServices && isHighLevelManager && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('service-items')}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition ${activeTab === 'service-items' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                        <span className="text-sm shrink-0">🍽️</span>
                                        <span className="truncate text-left">Danh mục Dịch vụ</span>
                                    </div>
                                    <span className="shrink-0 bg-emerald-500/30 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/30 ml-2">
                                        Menu
                                    </span>
                                </button>
                            )}

                            {/* 10. Quản lý Đánh giá & Phản hồi (Review & Rating) */}
                            {canViewReviews && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('reviews')}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition ${activeTab === 'reviews' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                        </svg>
                                        <span className="truncate text-left">Quản lý Đánh giá</span>
                                    </div>
                                    <span className="shrink-0 bg-amber-500/30 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-400/30 ml-2">
                                        Review
                                    </span>
                                </button>
                            )}

                            {/* 10.1 Marketing & Khuyến mãi (Accordion Dropdown) */}
                            {canViewMarketing && (
                                <div className="space-y-1">
                                    <button
                                        type="button"
                                        onClick={() => setIsMarketingMenuOpen((prev) => !prev)}
                                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition cursor-pointer select-none ${['posts', 'promotions'].includes(activeTab)
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
                                            <span className="shrink-0 bg-rose-500/30 text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-400/30">
                                                PROMO
                                            </span>
                                            {/* Nút ChevronDown toggle đóng/mở menu con độc lập */}
                                            <span
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsMarketingMenuOpen((prev) => !prev);
                                                }}
                                                className="shrink-0 p-1 rounded hover:bg-slate-700/60 transition cursor-pointer"
                                                title={isMarketingMenuOpen ? "Thu gọn menu con" : "Mở rộng menu con"}
                                            >
                                                <svg
                                                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${isMarketingMenuOpen ? 'rotate-180 text-white' : 'rotate-0'
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

                                    {/* Danh sách Menu Con: Tin tức & Blog, Khuyến mãi */}
                                    <div
                                        className={`grid transition-all duration-300 ease-in-out overflow-hidden ${isMarketingMenuOpen
                                                ? 'grid-rows-[1fr] opacity-100'
                                                : 'grid-rows-[0fr] opacity-0'
                                            }`}
                                    >
                                        <div className="min-h-0">
                                            <div className="pl-6 pr-1 py-1 space-y-1 border-l-2 border-slate-700/60 ml-4 my-1">
                                                {/* Menu con 1: Tin tức & Blog */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveTab('posts');
                                                        setIsMarketingMenuOpen(true);
                                                        navigate('/admin/posts');
                                                    }}
                                                    className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-left text-xs font-semibold transition cursor-pointer ${activeTab === 'posts'
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

                                                {/* Menu con 2: Khuyến mãi */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveTab('promotions');
                                                        setIsMarketingMenuOpen(true);
                                                        navigate('/admin/promotions');
                                                    }}
                                                    className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-left text-xs font-semibold transition cursor-pointer ${activeTab === 'promotions'
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
                            )}

                            {/* 10.2 Quản lý Liên hệ (Contact) */}
                            {canViewContacts && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('contacts')}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition cursor-pointer ${activeTab === 'contacts' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                        <span className="truncate text-left">Quản lý Liên hệ</span>
                                    </div>
                                </button>
                            )}

                            {/* 10.2.1 Quản lý Thanh toán & Hóa đơn */}
                            {canViewInvoices && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('invoices')}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition cursor-pointer ${activeTab === 'invoices' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                                        </svg>
                                        <span className="truncate text-left">Thanh toán & Hóa đơn</span>
                                    </div>
                                    <span className="shrink-0 bg-blue-500/30 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-400/30 ml-2">
                                        VietQR
                                    </span>
                                </button>
                            )}

                            {/* 10.3 Báo cáo & Thống kê Doanh thu */}
                            {canViewAnalytics && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (location.pathname.startsWith('/admin/customers/') || location.pathname === '/admin/profile') {
                                            navigate('/admin?tab=analytics');
                                        } else {
                                            setActiveTab('analytics');
                                        }
                                    }}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition cursor-pointer ${['analytics', 'reports'].includes(activeTab)
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                        <span className="truncate text-left">Báo cáo & Thống kê</span>
                                    </div>
                                    <span className="shrink-0 bg-emerald-500/30 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/30 ml-2">
                                        KPI
                                    </span>
                                </button>
                            )}

                            {/* 11. Cài đặt hệ thống */}
                            {canViewSettings && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('settings')}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm font-medium transition ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
                                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span className="truncate text-left">Cài đặt hệ thống</span>
                                    </div>
                                </button>
                            )}
                        </nav>
                </div>

                {/* Sidebar Footer Widget: Khối tĩnh hiển thị thông tin tài khoản quản lý & Đăng xuất (Cố định phía dưới) */}
                <div className="shrink-0 p-4 border-t border-slate-800/80 space-y-2">
                    <div className="bg-slate-800/60 rounded-2xl p-3 flex items-center justify-between text-xs select-none">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden mr-2">
                            <UserAvatar
                                avatar={user?.avatar}
                                name={user?.full_name || user?.username}
                                role={user?.role}
                                size="sm"
                                border={false}
                            />
                            <div className="min-w-0 flex-1">
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
                            onClick={handleRequestLogout}
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

            {/* ========================================================================= */}
            {/* 2. KHU VỰC NỘI DUNG CHÍNH (BÊN PHẢI ml-72, min-w-0 max-w-full) */}
            {/* ========================================================================= */}
            <div className="flex-1 ml-72 flex flex-col min-h-screen min-w-0 max-w-full print:ml-0 print:w-full">
                {/* Top Navbar: Ghim cố định trên cùng với sticky top-0 z-50, nền đặc bg-white, viền và bóng phân cách */}
                <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-50 shadow-sm print:hidden">
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

                        {/* Chuông thông báo thời gian thực */}
                        <NotificationBell theme="light" />

                        {/* Profile Avatar Quản lý + Dropdown Menu */}
                        <div className="relative pl-4 border-l border-slate-200" ref={profileMenuRef}>
                            <button
                                type="button"
                                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                                className="flex items-center gap-3 p-1 rounded-xl hover:bg-slate-100 transition cursor-pointer select-none group text-left"
                                title="Tài khoản & Hồ sơ cá nhân"
                            >
                                <div className="hidden sm:flex flex-col text-right">
                                    <span className="text-xs font-bold text-slate-900 leading-tight group-hover:text-blue-600 transition">
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
                                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform duration-200 ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown Menu Hồ sơ Quản lý */}
                            {isProfileMenuOpen && (
                                <div
                                    className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-1.5 z-50 animate-fadeIn"
                                    style={{ transformOrigin: 'top right' }}
                                >
                                    {/* Header vắn tắt thông tin Admin */}
                                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl flex items-center gap-3">
                                        <UserAvatar
                                            avatar={user?.avatar}
                                            name={user?.full_name || user?.username}
                                            role={user?.role}
                                            size="md"
                                            border={false}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-bold text-slate-900 truncate">
                                                {user?.full_name || user?.username}
                                            </div>
                                            <div className="text-[11px] text-slate-500 truncate font-mono">
                                                {user?.email || 'Chưa cập nhật email'}
                                            </div>
                                            <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                                {getRoleDisplayName(user?.role)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Danh sách hành động */}
                                    <div className="p-1.5 space-y-0.5 text-xs">
                                        {/* 1. Nối luồng điều hướng sang Hồ sơ cá nhân (/admin/profile) */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsProfileMenuOpen(false);
                                                handleSwitchTab('profile');
                                            }}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium transition cursor-pointer text-left ${activeTab === 'profile'
                                                    ? 'bg-blue-50 text-blue-700 font-semibold'
                                                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                                                }`}
                                        >
                                            <UserIcon className="w-4 h-4 text-blue-600 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <span className="block truncate font-semibold">Hồ sơ cá nhân</span>
                                                <span className="block text-[10px] text-slate-400 font-normal">Xem & chỉnh sửa thông tin cá nhân</span>
                                            </div>
                                        </button>

                                        {/* 2. Về trang chủ khách hàng */}
                                        <Link
                                            to="/"
                                            onClick={() => setIsProfileMenuOpen(false)}
                                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium transition cursor-pointer text-left"
                                        >
                                            <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <span className="block truncate">Trang chủ Khách sạn</span>
                                                <span className="block text-[10px] text-slate-400 font-normal">Giao diện người dùng đặt phòng</span>
                                            </div>
                                        </Link>
                                    </div>

                                    {/* 3. Đăng xuất */}
                                    <div className="border-t border-slate-100 p-1.5">
                                        <button
                                            type="button"
                                            onClick={handleRequestLogout}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-medium transition cursor-pointer text-left text-xs"
                                        >
                                            <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
                                            <span>Đăng xuất khỏi hệ thống</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Nội dung bảng điều khiển thay đổi theo Tab */}
                <main className="p-6 lg:p-8 space-y-6 flex-1 min-w-0 max-w-full print:p-0 print:m-0 print:w-full">
                    {/* TAB 1: QUẢN LÝ KHÁCH HÀNG (FEATURE 1) */}
                    {activeTab === 'guests' && (
                        canViewGuests ? <GuestManagement /> : renderAccessDenied('Tài khoản của bạn không có quyền xem phân hệ Khách hàng.')
                    )}

                    {/* TAB 1.1: CHI TIẾT KHÁCH HÀNG / CRM PROFILE */}
                    {activeTab === 'customer-detail' && (
                        canViewGuests ? <CustomerDetail /> : renderAccessDenied('Tài khoản của bạn không có quyền xem chi tiết khách hàng.')
                    )}

                    {/* TAB 2: QUẢN LÝ NHÂN SỰ & PHÂN QUYỀN (FEATURE 2) */}
                    {activeTab === 'employees' && (
                        canViewEmployees ? <EmployeeManagement /> : renderAccessDenied('Tài khoản của bạn không có quyền truy cập Nhân sự & Phân quyền.')
                    )}

                    {/* TAB 3: QUẢN LÝ DANH SÁCH & SƠ ĐỒ PHÒNG THỰC TẾ (PMS ROOM BOARD) */}
                    {activeTab === 'rooms' && (
                        canViewRooms ? (
                            <RoomManagement
                                onNavigateToBookings={(filter) => {
                                    setActiveTab('bookings');
                                    setBookingSubFilter(filter || 'all');
                                    setIsBookingMenuOpen(true);
                                }}
                                onNavigateToCustomer={(guestId) => {
                                    navigate(`/admin/customers/${guestId}`);
                                }}
                            />
                        ) : renderAccessDenied('Tài khoản của bạn không có quyền truy cập Sơ đồ Phòng.')
                    )}

                    {/* TAB 4: QUẢN LÝ HẠNG PHÒNG & BẢNG GIÁ (CRUD + MULTI-IMAGE UPLOAD) */}
                    {activeTab === 'categories' && (
                        canViewCategories ? <CategoryManagement /> : renderAccessDenied('Tài khoản của bạn không có quyền xem Hạng phòng & Bảng giá.')
                    )}

                    {/* TAB 4.1: QUẢN LÝ TIỆN NGHI PHÒNG (AMENITIES) */}
                    {activeTab === 'amenities' && (
                        canViewCategories ? <AmenityManagement /> : renderAccessDenied('Tài khoản của bạn không có quyền xem Tiện nghi phòng.')
                    )}

                    {/* TAB 5: QUẢN LÝ DANH SÁCH ĐẶT PHÒNG (LỄ TÂN & ADMIN) */}
                    {activeTab === 'bookings' && (
                        canViewBookings ? (
                            <BookingManagement
                                initialFilter={bookingSubFilter}
                                onBookingChanged={loadRealBookingStats}
                            />
                        ) : renderAccessDenied('Tài khoản của bạn không có quyền xem Quản lý Đặt phòng.')
                    )}

                    {/* TAB 5.1: SƠ ĐỒ TRỰC QUAN GANTT / TIMELINE ĐẶT PHÒNG */}
                    {activeTab === 'booking-timeline' && (
                        canViewBookings ? (
                            <BookingTimeline
                                onNavigateToBookings={() => {
                                    setActiveTab('bookings');
                                    setBookingSubFilter('all');
                                    setIsBookingMenuOpen(true);
                                }}
                            />
                        ) : renderAccessDenied('Tài khoản của bạn không có quyền xem Lịch đặt phòng.')
                    )}

                    {/* TAB 6: QUẢN LÝ YÊU CẦU DỊCH VỤ TẠI PHÒNG (KANBAN BOARD) */}
                    {activeTab === 'services' && (
                        canViewServices ? <ServiceRequestKanban /> : renderAccessDenied('Tài khoản của bạn không có quyền xem Yêu cầu dịch vụ.')
                    )}

                    {/* TAB 7: QUẢN LÝ THỰC ĐƠN & DANH MỤC DỊCH VỤ (CRUD) */}
                    {activeTab === 'service-items' && (
                        (canViewServices && isHighLevelManager) ? <ServiceManagement /> : renderAccessDenied('Tài khoản của bạn không có quyền quản lý Danh mục thực đơn & Dịch vụ.')
                    )}

                    {/* TAB 8: QUẢN LÝ ĐÁNH GIÁ & PHẢN HỒI (REVIEW & RATING) */}
                    {activeTab === 'reviews' && (
                        canViewReviews ? <ReviewManagement /> : renderAccessDenied('Tài khoản của bạn không có quyền xem Đánh giá & Phản hồi.')
                    )}

                    {/* TAB 8.1: QUẢN LÝ TIN TỨC & BÀI VIẾT (BLOG / NEWS) */}
                    {activeTab === 'posts' && (
                        canViewMarketing ? <PostManagement /> : renderAccessDenied('Tài khoản của bạn không có quyền quản lý Tin tức & Blog.')
                    )}
                    {activeTab === 'promotions' && (
                        canViewMarketing ? <PromotionManagement /> : renderAccessDenied('Tài khoản của bạn không có quyền quản lý Khuyến mãi.')
                    )}
                    {activeTab === 'contacts' && (
                        canViewContacts ? <ContactManagement /> : renderAccessDenied('Tài khoản của bạn không có quyền xem Liên hệ khách hàng.')
                    )}

                    {/* TAB 8.2: QUẢN LÝ THANH TOÁN & HÓA ĐƠN (VIETQR / CASH) */}
                    {activeTab === 'invoices' && (
                        canViewInvoices ? <InvoiceManagement /> : renderAccessDenied('Tài khoản của bạn không có quyền xem Quản lý Hóa đơn & Thu ngân.')
                    )}

                    {/* BÁO CÁO & THỐNG KÊ DOANH THU CHUYÊN SÂU */}
                    {['analytics', 'reports'].includes(activeTab) && (
                        canViewAnalytics ? (
                            <Analytics onNavigateToCustomer={(id) => navigate(`/admin/customers/${id}`)} />
                        ) : renderAccessDenied('Tài khoản của bạn không có quyền xem Báo cáo doanh thu & Thống kê.')
                    )}

                    {/* TAB 9: HỒ SƠ NHÂN SỰ & QUẢN TRỊ VIÊN (STAFF PROFILE) */}
                    {activeTab === 'profile' && <StaffProfile />}

                    {/* TAB 10: CÀI ĐẶT HỆ THỐNG */}
                    {activeTab === 'settings' && (
                        canViewSettings ? <SystemSettings /> : renderAccessDenied('Tài khoản của bạn không có quyền Cài đặt hệ thống.')
                    )}

                    {/* TAB TỔNG QUAN HỆ THỐNG */}
                    {activeTab === 'overview' && (
                        <>
                            {/* Welcome & Time Filters Banner */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h1 className="text-2xl font-serif font-bold text-slate-900 tracking-tight">
                                        Xin chào, {user?.full_name || user?.username}
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
                                            className={`px-3 py-1.5 rounded-lg transition ${
                                                timeFilter === 'today' ? 'bg-white text-blue-600 font-bold shadow-xs' : 'hover:text-slate-900'
                                            }`}
                                        >
                                            Hôm nay
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTimeFilter('7days')}
                                            className={`px-3 py-1.5 rounded-lg transition ${
                                                timeFilter === '7days' ? 'bg-white text-blue-600 font-bold shadow-xs' : 'hover:text-slate-900'
                                            }`}
                                        >
                                            7 ngày qua
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTimeFilter('month')}
                                            className={`px-3 py-1.5 rounded-lg transition ${
                                                timeFilter === 'month' ? 'bg-white text-blue-600 font-bold shadow-xs' : 'hover:text-slate-900'
                                            }`}
                                        >
                                            Tháng này ({new Date().getMonth() + 1}/{new Date().getFullYear()})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTimeFilter('year')}
                                            className={`px-3 py-1.5 rounded-lg transition ${
                                                timeFilter === 'year' ? 'bg-white text-blue-600 font-bold shadow-xs' : 'hover:text-slate-900'
                                            }`}
                                        >
                                            Năm {new Date().getFullYear()}
                                        </button>
                                    </div>
                                    {/* Quick Actions (Ẩn/Hiện chuẩn theo phân quyền vai trò người dùng) */}
                                    {canViewGuests && (
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('guests')}
                                            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <span>👥</span>
                                            <span>Khách Hàng</span>
                                        </button>
                                    )}
                                    {canViewEmployees && (
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('employees')}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/25 transition flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <span>🛡️</span>
                                            <span>Nhân Sự & Phân Quyền</span>
                                        </button>
                                    )}
                                    {canViewRooms && (
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('rooms')}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/25 transition flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <span>🏢</span>
                                            <span>Sơ Đồ Phòng (PMS)</span>
                                        </button>
                                    )}
                                    {canViewBookings && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActiveTab('bookings');
                                                setBookingSubFilter('all');
                                                setIsBookingMenuOpen(true);
                                            }}
                                            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-orange-500/25 transition flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <span>📅</span>
                                            <span>Xử Lý Đặt Phòng</span>
                                        </button>
                                    )}
                                    {canViewServices && (
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('services')}
                                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/25 transition flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <span>🛎️</span>
                                            <span>Kanban Dịch Vụ</span>
                                        </button>
                                    )}
                                    {canViewServices && isHighLevelManager && (
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('service-items')}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/25 transition flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <span>🍽️</span>
                                            <span>Quản Lý Thực Đơn</span>
                                        </button>
                                    )}
                                    {canViewInvoices && !isHighLevelManager && (
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('invoices')}
                                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl shadow-md shadow-cyan-600/25 transition flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <span>💳</span>
                                            <span>Hóa Đơn & Thu Ngân</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* 4 Quick Stat Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                {/* 1. Doanh thu */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                DOANH THU ({dashboardData?.period_label?.toUpperCase() || 'THÁNG HIỆN TẠI'})
                                            </span>
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs"> $ </div>
                                        </div>
                                        <div className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
                                            {(dashboardData?.revenue?.total_revenue || 0).toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500">VND</span>
                                        </div>
                                        <div className="flex items-center text-xs font-bold gap-1">
                                            {(dashboardData?.revenue?.growth_rate || 0) >= 0 ? (
                                                <span className="text-emerald-600">↗ +{dashboardData?.revenue?.growth_rate || 0}%</span>
                                            ) : (
                                                <span className="text-rose-600">↘ {dashboardData?.revenue?.growth_rate || 0}%</span>
                                            )}
                                            <span className="text-[11px] text-slate-400 font-normal">
                                                {dashboardData?.revenue?.growth_label || 'so với kỳ trước'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                        <span>{dashboardData?.revenue?.target_label || 'Mục tiêu'}: {(dashboardData?.revenue?.target_revenue || 0).toLocaleString('vi-VN')} đ</span>
                                        <span className="font-semibold text-blue-600">
                                            Đạt {dashboardData?.revenue?.achievement_rate || 0}% ({dashboardData?.revenue?.paid_invoices_count || 0} HĐ)
                                        </span>
                                    </div>
                                </div>

                                {/* 2. Công suất phòng */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400"> CÔNG SUẤT PHÒNG PMS </span>
                                            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center text-xs"> 🏠 </div>
                                        </div>
                                        <div className="flex items-baseline justify-between mb-1.5">
                                            <span className="text-xl sm:text-2xl font-bold text-slate-900">
                                                {dashboardData?.occupancy?.occupied_rooms || 0}
                                                <span className="text-sm font-normal text-slate-400">/{dashboardData?.occupancy?.total_rooms || 0}</span>
                                            </span>
                                            <span className="text-xs text-slate-500">Phòng có khách</span>
                                            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                                                {dashboardData?.occupancy?.occupancy_rate || 0}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-2">
                                            <div
                                                className="bg-orange-500 h-2 rounded-full transition-all duration-700 ease-out"
                                                style={{ width: `${Math.min(100, dashboardData?.occupancy?.occupancy_rate || 0)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                        <span>Sẵn sàng đón khách</span>
                                        <strong className="text-slate-800">{dashboardData?.occupancy?.available_rooms || 0} Phòng trống</strong>
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
                                            {dashboardData?.bookings?.pending_count ?? pendingBookingsCount} <span className="text-xs font-normal text-slate-500">Đơn chờ duyệt</span>
                                        </div>
                                        <div className="text-xs text-amber-600 font-medium flex items-center gap-1">
                                            <span>
                                                {(dashboardData?.bookings?.pending_count ?? pendingBookingsCount) > 0
                                                    ? '⚠️ Cần phản hồi < 15 phút'
                                                    : ' Tất cả đơn đã được xử lý'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                        <span>Đang ở: <strong className="text-slate-700">{dashboardData?.bookings?.checked_in_count || 0}</strong> • Đã duyệt: <strong className="text-slate-700">{dashboardData?.bookings?.confirmed_count || 0}</strong></span>
                                        <strong className="text-slate-800">{dashboardData?.bookings?.total_bookings || actualBookingsCount} Đơn</strong>
                                    </div>
                                </div>

                                {/* 4. Yêu cầu dịch vụ (Concierge & In-Room Dining) */}
                                <div 
                                    onClick={() => setActiveTab('services')}
                                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition cursor-pointer group"
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-blue-600 transition"> YÊU CẦU DỊCH VỤ PHÒNG </span>
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs group-hover:bg-blue-600 group-hover:text-white transition"> 🛎️ </div>
                                        </div>
                                        <div className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
                                            {dashboardData?.services?.total_requests || 0} <span className="text-xs font-normal text-slate-500">Yêu cầu ({(dashboardData?.services?.total_sales || 0).toLocaleString('vi-VN')} đ)</span>
                                        </div>
                                        <div className="text-xs text-slate-500 flex items-center gap-2">
                                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold text-[10px]">
                                                Chờ: {dashboardData?.services?.pending_count || 0}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[10px]">
                                                Đang làm: {dashboardData?.services?.in_progress_count || 0}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
                                                Xong: {dashboardData?.services?.completed_count || 0}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                        <span>Bảng Kanban điều phối</span>
                                        <strong className="text-blue-600 group-hover:underline">Mở Kanban dịch vụ →</strong>
                                    </div>
                                </div>
                            </div>

                            {/* CÔNG SUẤT THEO HẠNG PHÒNG & NGUỒN ĐẶT PHÒNG */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* Biểu đồ thanh tiến độ công suất các hạng phòng (8 cột) */}
                                <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-6">
                                            <div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block"> GIÁM SÁT CÔNG SUẤT PMS </span>
                                                <h3 className="text-base font-bold text-slate-900"> Tỷ lệ lấp đầy theo hạng phòng thực tế </h3>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-600"></span> Đang có khách
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded-sm bg-slate-200"></span> Trống / Dọn dẹp
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-4 text-xs">
                                            {dashboardData?.occupancy?.category_breakdown && dashboardData.occupancy.category_breakdown.length > 0 ? (
                                                dashboardData.occupancy.category_breakdown.map((cat) => (
                                                    <div key={cat.id} className="group">
                                                        <div className="flex justify-between font-medium text-slate-700 mb-1">
                                                            <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></span>
                                                                {cat.name} ({cat.total_rooms} phòng)
                                                            </span>
                                                            <span>
                                                                <strong className="text-slate-900">{cat.occupied_rooms}/{cat.total_rooms} phòng</strong> ({cat.occupancy_rate}%)
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                                            <div
                                                                className="h-3 rounded-full transition-all duration-700 ease-out"
                                                                style={{
                                                                    width: `${Math.min(100, cat.occupancy_rate)}%`,
                                                                    backgroundColor: cat.color || '#2563eb'
                                                                }}
                                                            ></div>
                                                        </div>
                                                        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                                                            <span>
                                                                Sẵn sàng: <strong className="text-slate-600">{cat.available_rooms}</strong> • Dọn dẹp: <strong className="text-slate-600">{cat.cleaning_rooms}</strong>
                                                                {cat.maintenance_rooms > 0 && ` • Bảo trì: ${cat.maintenance_rooms}`}
                                                            </span>
                                                            <span className="font-medium text-slate-500">
                                                                {cat.base_price?.toLocaleString('vi-VN')} đ/đêm
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="py-8 text-center text-slate-400 text-xs">
                                                    Đang đồng bộ dữ liệu hạng phòng thực tế...
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                        <span>Tổng số phòng: <strong>{dashboardData?.occupancy?.total_rooms || 0} phòng</strong></span>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('rooms')}
                                            className="text-blue-600 font-bold hover:underline flex items-center gap-1"
                                        >
                                            <span>Xem sơ đồ buồng phòng (PMS Board)</span>
                                            <span>→</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Donut Chart Cơ cấu lưu trú */}
                                <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block"> CƠ CẤU LƯU TRÚ </span>
                                                <h3 className="text-base font-bold text-slate-900">
                                                    {donutView === 'source' ? 'Nguồn Đặt Phòng' : 'Trạng Thái Đơn'}
                                                </h3>
                                            </div>
                                            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[10px] font-semibold text-slate-600">
                                                <button
                                                    type="button"
                                                    onClick={() => setDonutView('source')}
                                                    className={`px-2 py-1 rounded-md transition ${donutView === 'source' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'}`}
                                                >
                                                    Kênh
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDonutView('status')}
                                                    className={`px-2 py-1 rounded-md transition ${donutView === 'status' ? 'bg-white text-blue-600 shadow-xs' : 'hover:text-slate-900'}`}
                                                >
                                                    Trạng thái
                                                </button>
                                            </div>
                                        </div>

                                        <div className="relative flex items-center justify-center my-4">
                                            <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 100 100">
                                                <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                                                {donutSegments.map((seg, idx) => (
                                                    <circle
                                                        key={idx}
                                                        cx="50"
                                                        cy="50"
                                                        r="38"
                                                        fill="none"
                                                        stroke={seg.color}
                                                        strokeWidth="12"
                                                        strokeDasharray={seg.strokeDasharray}
                                                        strokeDashoffset={seg.strokeDashoffset}
                                                        strokeLinecap="round"
                                                        className="transition-all duration-700 ease-out"
                                                    />
                                                ))}
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <span className="text-xl font-black text-slate-900">
                                                    {dashboardData?.bookings?.total_bookings || actualBookingsCount}
                                                </span>
                                                <span className="text-[9px] uppercase tracking-wider text-slate-400">Tổng lượt đặt</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                                        {activeDonutData.map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between">
                                                <span className="flex items-center gap-2 text-slate-600">
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                                                    <span>{item.source || item.label}</span>
                                                </span>
                                                <span className="font-bold text-slate-900">
                                                    {item.percentage}% ({item.count})
                                                </span>
                                            </div>
                                        ))}
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
                                                    <th className="py-3 px-5">HẠNG PHÒNG & SỐ PHÒNG</th>
                                                    <th className="py-3 px-5">LỊCH TRÌNH</th>
                                                    <th className="py-3 px-5">TỔNG TIỀN</th>
                                                    <th className="py-3 px-5">TRẠNG THÁI</th>
                                                    <th className="py-3 px-5 text-right">THAO TÁC</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {isLoadingRealBookings && realBookings.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="py-10 text-center text-slate-400">
                                                            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                                            <span>Đang đồng bộ dữ liệu đặt phòng...</span>
                                                        </td>
                                                    </tr>
                                                ) : filteredBookings.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="py-10 text-center text-slate-400">
                                                            <div className="text-2xl mb-1">📭</div>
                                                            <p className="font-semibold text-slate-600">Chưa có đơn đặt phòng nào</p>
                                                            <p className="text-[11px] text-slate-400 mt-0.5">Các đơn đặt phòng mới của khách hàng sẽ xuất hiện tại đây.</p>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredBookings.slice(0, 8).map((b) => {
                                                        const guestName = b.guest_name || 'Khách lưu trú';
                                                        const avatarInitial = guestName.charAt(0).toUpperCase();
                                                        const statusCfg = STATUS_CONFIGS[b.status] || { label: b.status, color: 'bg-slate-100 text-slate-700 border-slate-200' };
                                                        const totalAmountNum = Number(b.total_amount) || 0;

                                                        return (
                                                            <tr key={b.id} className="hover:bg-blue-50/20 transition cursor-pointer" onClick={() => setActiveTab('bookings')}>
                                                                <td className="py-3.5 px-5 font-mono font-bold text-blue-600 whitespace-nowrap">
                                                                    <div>#{b.booking_code}</div>
                                                                    <span className="text-[10px] text-slate-400 font-normal">{formatDateTimeDisplay(b.created_at)}</span>
                                                                </td>
                                                                <td className="py-3.5 px-5">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                                                                            {avatarInitial}
                                                                        </div>
                                                                        <div>
                                                                            <div className="font-semibold text-slate-900">{guestName}</div>
                                                                            <span className="text-[10px] text-slate-400 block">{b.guest_phone || b.guest_email || '—'}</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="py-3.5 px-5">
                                                                    <strong className="text-slate-800 block font-medium">{b.room_name || 'Hạng phòng'}</strong>
                                                                    <span className="text-[10px] text-slate-500">
                                                                        {b.room_number ? (
                                                                            <span className="text-emerald-700 font-bold">Phòng {b.room_number}</span>
                                                                        ) : (
                                                                            <span className="text-slate-400 italic">Chờ gán số phòng</span>
                                                                        )}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3.5 px-5 whitespace-nowrap">
                                                                    <span className="font-semibold text-slate-800 block">
                                                                        {formatDateDisplay(b.check_in_date)} → {formatDateDisplay(b.check_out_date)}
                                                                    </span>
                                                                    <span className="text-[10px] text-blue-600 font-bold">🌙 {b.nights || 1} đêm</span>
                                                                </td>
                                                                <td className="py-3.5 px-5 whitespace-nowrap">
                                                                    <span className="font-bold text-rose-600 block">{totalAmountNum.toLocaleString('vi-VN')} VND</span>
                                                                </td>
                                                                <td className="py-3.5 px-5 whitespace-nowrap">
                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.color}`}>
                                                                        {['pending', 'paid', 'PAID'].includes(b.status) && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping mr-1"></span>}
                                                                        {statusCfg.label}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3.5 px-5 text-right whitespace-nowrap">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActiveTab('bookings');
                                                                            setBookingSubFilter('all');
                                                                            setIsBookingMenuOpen(true);
                                                                        }}
                                                                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-bold text-[11px] transition shadow-2xs"
                                                                    >
                                                                        Xử lý →
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 px-5">
                                        <span>Đang hiển thị <strong>{filteredBookings.length}</strong> / <strong>{actualBookingsCount}</strong> đơn thực tế từ CSDL</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActiveTab('bookings');
                                                setBookingSubFilter('all');
                                                setIsBookingMenuOpen(true);
                                            }}
                                            className="text-blue-600 hover:text-blue-700 font-bold text-xs hover:underline flex items-center gap-1"
                                        >
                                            <span>Quản lý toàn bộ đơn đặt phòng</span>
                                            <span>→</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Concierge & Dịch Vụ Nóng */}
                                <div className="lg:col-span-4 space-y-6">
                                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between h-full">
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping"></span>
                                                    <h3 className="text-base font-bold text-slate-900">Concierge & Dịch Vụ Nóng</h3>
                                                </div>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200">
                                                    {((dashboardData?.services?.pending_count || 0) + (dashboardData?.services?.in_progress_count || 0)) > 0
                                                        ? `${(dashboardData?.services?.pending_count || 0) + (dashboardData?.services?.in_progress_count || 0)} đang xử lý`
                                                        : 'TẤT CẢ ỔN ĐỊNH'}
                                                </span>
                                            </div>

                                            <div className="space-y-3 text-xs">
                                                {isLoadingDashboard && !dashboardData ? (
                                                    <div className="py-8 text-center text-slate-400">
                                                        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                                        <span className="text-xs">Đang tải yêu cầu dịch vụ...</span>
                                                    </div>
                                                ) : !dashboardData?.services?.recent_requests || dashboardData.services.recent_requests.length === 0 ? (
                                                    <div className="py-8 text-center text-slate-400">
                                                        <div className="text-2xl mb-1">🛎️</div>
                                                        <p className="font-semibold text-slate-600">Không có yêu cầu nào</p>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">Hiện tại chưa có yêu cầu dịch vụ phòng phát sinh.</p>
                                                    </div>
                                                ) : (
                                                    dashboardData.services.recent_requests.slice(0, 5).map((sr) => {
                                                        const icon = getServiceCategoryIcon(sr.category_name, sr.service_name);
                                                        const statusBadge = getServiceRequestStatusBadge(sr.status);
                                                        return (
                                                            <div
                                                                key={sr.id}
                                                                onClick={() => setActiveTab('services')}
                                                                className="p-3 bg-slate-50 hover:bg-orange-50/40 rounded-xl border border-slate-100 hover:border-orange-200 transition cursor-pointer group"
                                                            >
                                                                <div className="flex items-start gap-2.5">
                                                                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-base shrink-0 shadow-2xs group-hover:scale-105 transition">
                                                                        {icon}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center justify-between gap-1">
                                                                            <strong className="text-slate-900 text-xs truncate group-hover:text-blue-600 transition">
                                                                                {sr.service_name} {sr.quantity > 1 ? `(x${sr.quantity})` : ''}
                                                                            </strong>
                                                                            <span className="text-[10px] font-bold text-slate-400 shrink-0">
                                                                                {sr.time_str || 'Hôm nay'}
                                                                            </span>
                                                                        </div>

                                                                        <div className="flex items-center justify-between mt-1 text-[11px]">
                                                                            <div className="flex items-center gap-1.5 text-slate-500 truncate">
                                                                                <span className="font-bold text-slate-700 bg-white px-1.5 py-0.2 rounded border border-slate-200 text-[10px]">
                                                                                    {sr.room_number ? `P.${sr.room_number}` : 'Chờ gán'}
                                                                                </span>
                                                                                <span className="truncate text-slate-600 font-medium">{sr.guest_name}</span>
                                                                            </div>
                                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusBadge.color}`}>
                                                                                {statusBadge.label}
                                                                            </span>
                                                                        </div>

                                                                        {sr.note && (
                                                                            <p className="text-[10px] text-slate-500 italic mt-1.5 bg-white/70 p-1.5 rounded border border-slate-100 line-clamp-1">
                                                                                💬 &ldquo;{sr.note}&rdquo;
                                                                            </p>
                                                                        )}

                                                                        {sr.total_price > 0 && (
                                                                            <div className="text-[10px] text-rose-600 font-bold mt-1 text-right">
                                                                                +{Number(sr.total_price).toLocaleString('vi-VN')} VND
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('services')}
                                            className="mt-4 w-full py-2.5 px-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-slate-700 hover:text-blue-700 font-bold text-xs transition flex items-center justify-center gap-1.5"
                                        >
                                            <span>Mở Kanban Điều Phối Dịch Vụ</span>
                                            <span>→</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* CÁC TAB KHÁC NẾU CHỌN */}
                    {!['overview', 'guests', 'customer-detail', 'employees', 'rooms', 'categories', 'amenities', 'bookings', 'booking-timeline', 'services', 'service-items', 'reviews', 'profile', 'posts', 'promotions', 'contacts', 'invoices', 'analytics', 'reports', 'settings'].includes(activeTab) && (
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
                            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                                {canViewGuests && (
                                    <button
                                        onClick={() => setActiveTab('guests')}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 cursor-pointer"
                                    >
                                        Quản lý Khách Hàng
                                    </button>
                                )}
                                {canViewEmployees && (
                                    <button
                                        onClick={() => setActiveTab('employees')}
                                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
                                    >
                                        Quản lý Nhân Sự & Phân Quyền
                                    </button>
                                )}
                                <button
                                    onClick={() => setActiveTab('overview')}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition"
                                >
                                    Quay về Tổng quan
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Modal Xác Nhận Đăng Xuất Quản Trị */}
            <LogoutConfirmModal
                isOpen={isLogoutModalOpen}
                onClose={() => !isLoggingOut && setIsLogoutModalOpen(false)}
                onConfirm={handleConfirmLogout}
                isLoading={isLoggingOut}
                title="Xác Nhận Đăng Xuất Quản Trị"
                userName={user?.full_name || user?.username}
                role={getRoleDisplayName(user?.role)}
                message="Bạn có chắc chắn muốn đăng xuất khỏi cổng Quản trị Khách Sạn TA? Mọi phiên làm việc chưa hoàn tất có thể bị gián đoạn."
            />
        </div>
    );
}