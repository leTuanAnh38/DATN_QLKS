import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
    ChevronDown,
    User as UserIcon,
    LogOut,
    ExternalLink,
    Calendar,
    Clock,
    CheckCircle2,
    AlertTriangle,
    AlertCircle,
    BedDouble,
    Users,
    ArrowUpRight,
    ArrowRight,
    ShieldAlert,
    RefreshCw,
    PlusCircle,
    Compass,
    ShieldCheck,
    Zap,
    DoorOpen,
    Check,
    Sparkles,
    SlidersHorizontal,
    BellRing,
    Flame,
    DollarSign,
    Receipt,
    Utensils,
    TrendingUp,
    TrendingDown,
    Menu,
    X,
    Inbox,
    Moon,
    MessageSquare,
    Wrench
} from 'lucide-react';
import { useAuth } from '../../store/authStore';
import { authService } from '../../services/authService';
import { useHasPermission } from '../../utils/permission';
import { bookingService } from '../../services/bookingService';
import { resolveMediaUrl } from '../../utils/mediaUrl';
// Lazy-load các tab quản trị: chỉ tải code của tab khi người dùng mở tab đó
const GuestManagement = lazy(() => import('./GuestManagement'));
const EmployeeManagement = lazy(() => import('./EmployeeManagement'));
const RoomManagement = lazy(() => import('./RoomManagement'));
const LostAndFoundManagement = lazy(() => import('./LostAndFoundManagement'));
const MinibarManagement = lazy(() => import('./MinibarManagement'));
const CategoryManagement = lazy(() => import('./CategoryManagement'));
const BookingManagement = lazy(() => import('./BookingManagement'));
const BookingTimeline = lazy(() => import('./BookingTimeline'));
const ServiceRequestKanban = lazy(() => import('./ServiceRequestKanban'));
const ServiceManagement = lazy(() => import('./ServiceManagement'));
const ReviewManagement = lazy(() => import('./ReviewManagement'));
import UserAvatar from '../../components/common/UserAvatar';
import NotificationBell from '../../components/common/NotificationBell';
import Sidebar from '../../components/admin/Sidebar';
const StaffProfile = lazy(() => import('./StaffProfile'));
const CustomerDetail = lazy(() => import('./CustomerDetail'));
const PostManagement = lazy(() => import('./PostManagement'));
const ContactManagement = lazy(() => import('./ContactManagement'));
const Analytics = lazy(() => import('./Analytics'));
const InvoiceManagement = lazy(() => import('./InvoiceManagement'));
const SystemSettings = lazy(() => import('./SystemSettings'));
const AmenityManagement = lazy(() => import('./AmenityManagement'));
import LogoutConfirmModal from '../../components/common/LogoutConfirmModal';
const PromotionManagement = lazy(() => import('./PromotionManagement'));
const SystemLog = lazy(() => import('./SystemLog'));
const CorporatePartnerManagement = lazy(() => import('./CorporatePartnerManagement'));

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
const renderServiceCategoryIcon = (categoryName, serviceName) => {
    const text = `${categoryName || ''} ${serviceName || ''}`.toLowerCase();
    if (text.includes('ẩm thực') || text.includes('ăn') || text.includes('món') || text.includes('bò') || text.includes('súp') || text.includes('phở') || text.includes('dining')) return <Utensils className="w-5 h-5 text-amber-600" />;
    if (text.includes('uống') || text.includes('cà phê') || text.includes('trà') || text.includes('nước') || text.includes('bar')) return <Utensils className="w-5 h-5 text-blue-600" />;
    if (text.includes('spa') || text.includes('massage') || text.includes('trị liệu') || text.includes('thư giãn')) return <Sparkles className="w-5 h-5 text-rose-500" />;
    if (text.includes('giặt') || text.includes('ủi') || text.includes('laundry')) return <Sparkles className="w-5 h-5 text-indigo-500" />;
    if (text.includes('xe') || text.includes('đón') || text.includes('sân bay') || text.includes('transport')) return <Compass className="w-5 h-5 text-emerald-600" />;
    if (text.includes('dọn') || text.includes('buồng') || text.includes('cleaning')) return <Sparkles className="w-5 h-5 text-cyan-600" />;
    return <BellRing className="w-5 h-5 text-amber-600" />;
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

// Helper lấy ảnh đại diện của món ăn / dịch vụ (ưu tiên ảnh từ CSDL, fallback sang ảnh minh họa chất lượng cao theo tên món)
const getServiceItemImage = (sr) => {
    if (!sr) return null;
    const rawImg = sr.service_image || sr.image_url || sr.image;
    if (rawImg) {
        return resolveMediaUrl(rawImg);
    }

    const text = `${sr.category_name || ''} ${sr.service_name || ''}`.toLowerCase();

    // 1. Phở bò / Bún bò / Bắp hoa
    if (text.includes('phở') || text.includes('bún') || text.includes('bắp hoa')) {
        return 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=400&q=80';
    }
    // 2. Cà phê trứng / Đồ uống / Trà
    if (text.includes('cà phê') || text.includes('coffee') || text.includes('trứng')) {
        return 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80';
    }
    // 3. Súp tôm hùm / Hải sản / Tôm
    if (text.includes('tôm hùm') || text.includes('súp') || text.includes('lobster') || text.includes('saffron')) {
        return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80';
    }
    // 4. Bò Wagyu / Bò bít tết / Steak
    if (text.includes('bò') || text.includes('wagyu') || text.includes('steak')) {
        return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80';
    }
    // 5. Thêm gối lông vũ / Khăn tắm / Tiện ích buồng phòng
    if (text.includes('gối') || text.includes('khăn') || text.includes('tắm') || text.includes('lông vũ') || text.includes('linen')) {
        return 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=400&q=80';
    }
    // 6. Spa / Massage / Thư giãn
    if (text.includes('spa') || text.includes('massage') || text.includes('trị liệu') || text.includes('đá nóng')) {
        return 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=400&q=80';
    }
    // 7. Đưa đón VIP / Đặt xe sân bay
    if (text.includes('xe') || text.includes('đưa đón') || text.includes('sân bay') || text.includes('limousine')) {
        return 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=400&q=80';
    }
    // 8. Dọn phòng / Housekeeping
    if (text.includes('dọn') || text.includes('buồng') || text.includes('cleaning')) {
        return 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=400&q=80';
    }
    // 9. Ẩm thực / Món ăn chung
    if (text.includes('ẩm thực') || text.includes('món') || text.includes('ăn') || text.includes('dining')) {
        return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80';
    }
    // 10. Trà chiều / Nước ngọt / Mocktail
    if (text.includes('trà') || text.includes('bar') || text.includes('nước') || text.includes('uống')) {
        return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80';
    }

    return 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=400&q=80';
};

export default function HotelAdminDashboard({ initialTab }) {
    const { user, isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Kiểm tra phân quyền RBAC cho từng phân hệ menu
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

    // Xác định tab ban đầu dựa trên route URL hoặc prop
    const getInitialTab = () => {
        if (location.pathname === '/admin/profile') return 'profile';
        if (location.pathname.startsWith('/admin/customers/')) return 'customer-detail';
        if (location.pathname === '/admin/analytics' || location.pathname === '/admin/reports') return 'analytics';
        if (location.pathname === '/admin/settings') return 'settings';
        if (location.pathname === '/admin/amenities') return 'amenities';
        if (location.pathname === '/admin/posts') return 'posts';
        if (location.pathname === '/admin/promotions') return 'promotions';
        if (location.pathname === '/admin/lost-and-found' || location.pathname === '/admin/lost-found') return 'lost-and-found';
        if (location.pathname === '/admin/minibar' || location.pathname === '/admin/minibar-items') return 'minibar';
        const params = new URLSearchParams(location.search);
        return params.get('tab') || initialTab || 'overview';
    };

    const [activeTab, setActiveTab] = useState(getInitialTab);
    const [timeFilter, setTimeFilter] = useState('month');
    const [bookingFilter, setBookingFilter] = useState('all');

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
        } else if (location.pathname === '/admin/lost-and-found' || location.pathname === '/admin/lost-found') {
            setActiveTab('lost-and-found');
        } else if (location.pathname === '/admin/minibar' || location.pathname === '/admin/minibar-items') {
            setActiveTab('minibar');
            setIsCategoryMenuOpen(true);
        } else if (location.pathname === '/admin/audit-logs' || location.pathname === '/admin/logs') {
            setActiveTab('audit-logs');
        } else if (location.pathname === '/admin/corporate-partners' || location.pathname === '/admin/b2b') {
            setActiveTab('corporate-partners');
        } else if (location.pathname === '/admin/bookings' || location.pathname === '/admin/groups') {
            setActiveTab('bookings');
        } else if (location.pathname === '/admin/services') {
            setActiveTab('services');
        } else if (location.pathname === '/admin/rooms') {
            setActiveTab('rooms');
        } else if (location.pathname === '/admin/finance' || location.pathname === '/admin/invoices') {
            setActiveTab('invoices');
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
            if (user?.role === 'service_staff' && canViewServices) {
                setActiveTab('services');
            } else if (canViewRooms) {
                setActiveTab('rooms');
            } else if (canViewServices) {
                setActiveTab('services');
            } else if (canViewBookings) {
                setActiveTab('bookings');
            } else if (canViewInvoices) {
                setActiveTab('invoices');
            }
        }
    }, [canViewOverview, activeTab, canViewRooms, canViewServices, canViewBookings, canViewInvoices, user?.role]);

    // Chuyển tab và đồng bộ đường dẫn URL
    const handleSwitchTab = (tab) => {
        setActiveTab(tab);
        if (tab === 'profile') {
            navigate('/admin/profile');
        } else if (tab === 'lost-and-found') {
            navigate('/admin/lost-and-found');
        } else if (tab === 'minibar') {
            navigate('/admin/minibar');
        } else if (tab === 'corporate-partners') {
            navigate('/admin/corporate-partners');
        } else if (location.pathname === '/admin/profile' || location.pathname.startsWith('/admin/customers/') || location.pathname.startsWith('/admin/lost-and-found') || location.pathname.startsWith('/admin/minibar') || location.pathname.startsWith('/admin/corporate-partners')) {
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
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
        try {
            return localStorage.getItem('pms_sidebar_collapsed') === 'true';
        } catch {
            return false;
        }
    });

    // Tự động đóng Sidebar trên Mobile khi chuyển tab hoặc chuyển URL
    useEffect(() => {
        setIsMobileSidebarOpen(false);
    }, [activeTab, location.pathname]);

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
    // DỮ LIỆU ĐẶT PHÒNG THỜI GIAN THỰC CHO TAB TỔNG QUAN
    // =========================================================================
    const filteredBookings = useMemo(() => {
        return realBookings.filter((item) => {
            if (bookingFilter === 'all') return true;
            if (bookingFilter === 'pending') {
                return ['pending', 'paid', 'PAID'].includes(item.status);
            }
            if (bookingFilter === 'checked_in') {
                return item.status === 'checked_in';
            }
            return item.status === bookingFilter;
        });
    }, [realBookings, bookingFilter]);

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
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500/20 to-rose-500/20 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10">
                        <ShieldAlert className="w-10 h-10 text-amber-400" />
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
                                Tài khoản khách hàng thường không có thẩm quyền truy cập cơ sở dữ liệu và vận hành hệ thống.
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



    // Hàm phụ trợ hiển thị cảnh báo phân quyền khi truy cập tab không được cấp phép
    const renderAccessDenied = (message) => (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8 text-rose-600" />
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
            {/* Backdrop làm mờ khi mở Sidebar trên Mobile */}
            {isMobileSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden animate-fadeIn"
                    onClick={() => setIsMobileSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* ========================================================================= */}
            {/* 1. SIDEBAR CỐ ĐỊNH BÊN TRÁI (Hỗ trợ Mini-Sidebar w-20 & Drawer Mobile)    */}
            {/* ========================================================================= */}
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                bookingSubFilter={bookingSubFilter}
                setBookingSubFilter={setBookingSubFilter}
                pendingBookingsCount={pendingBookingsCount}
                isBookingMenuOpen={isBookingMenuOpen}
                setIsBookingMenuOpen={setIsBookingMenuOpen}
                isCategoryMenuOpen={isCategoryMenuOpen}
                setIsCategoryMenuOpen={setIsCategoryMenuOpen}
                isMarketingMenuOpen={isMarketingMenuOpen}
                setIsMarketingMenuOpen={setIsMarketingMenuOpen}
                isMobileSidebarOpen={isMobileSidebarOpen}
                setIsMobileSidebarOpen={setIsMobileSidebarOpen}
                isCollapsed={isSidebarCollapsed}
                setIsCollapsed={setIsSidebarCollapsed}
                onSwitchTab={handleSwitchTab}
                onRequestLogout={handleRequestLogout}
            />

            {/* ========================================================================= */}
            {/* 2. KHU VỰC NỘI DUNG CHÍNH (ml-0 trên Mobile, ml-20 / ml-80 trên Desktop)  */}
            {/* ========================================================================= */}
            <div
                className={`flex-1 ml-0 ${
                    isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-80'
                } transition-all duration-300 ease-in-out flex flex-col min-h-screen min-w-0 max-w-full print:ml-0 print:w-full`}
            >
                {/* Top Navbar: Ghim cố định trên cùng với sticky top-0 z-30, nền đặc bg-white, viền và bóng phân cách */}
                <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm print:hidden">
                    <div className="flex items-center gap-3">
                        {/* Nút Hamburger mở Sidebar trên Mobile */}
                        <button
                            type="button"
                            onClick={() => setIsMobileSidebarOpen(true)}
                            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center lg:hidden transition cursor-pointer shrink-0"
                            title="Mở menu quản trị"
                            aria-label="Mở menu quản trị"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
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
                <main className="p-3.5 sm:p-6 lg:p-8 space-y-6 flex-1 min-w-0 max-w-full print:p-0 print:m-0 print:w-full">
                    <Suspense fallback={
                        <div className="flex items-center justify-center py-24">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-9 h-9 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                                <span className="text-xs text-slate-500">Đang tải dữ liệu...</span>
                            </div>
                        </div>
                    }>
                    {/* TAB 1: QUẢN LÝ KHÁCH HÀNG (FEATURE 1) */}
                    {activeTab === 'guests' && (
                        canViewGuests ? <GuestManagement /> : renderAccessDenied('Tài khoản của bạn không có quyền xem phân hệ Khách hàng.')
                    )}

                    {/* TAB 1.1: CHI TIẾT KHÁCH HÀNG / CRM PROFILE */}
                    {activeTab === 'customer-detail' && (
                        canViewGuests ? <CustomerDetail /> : renderAccessDenied('Tài khoản của bạn không có quyền xem chi tiết khách hàng.')
                    )}

                    {/* TAB 1.2: QUẢN LÝ ĐỐI TÁC DOANH NGHIỆP (B2B CORPORATE PARTNERS) */}
                    {activeTab === 'corporate-partners' && (
                        canViewCorporatePartners ? <CorporatePartnerManagement /> : renderAccessDenied('Tài khoản của bạn không có quyền xem Đối tác Doanh nghiệp.')
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

                    {/* TAB 3.1: QUẢN LÝ ĐỒ THẤT LẠC (LOST & FOUND) */}
                    {activeTab === 'lost-and-found' && (
                        canViewRooms ? <LostAndFoundManagement /> : renderAccessDenied('Tài khoản của bạn không có quyền xem Quản lý Đồ thất lạc.')
                    )}

                    {/* TAB 4: QUẢN LÝ HẠNG PHÒNG & BẢNG GIÁ (CRUD + MULTI-IMAGE UPLOAD) */}
                    {activeTab === 'categories' && (
                        canViewCategories ? <CategoryManagement /> : renderAccessDenied('Tài khoản của bạn không có quyền xem Hạng phòng & Bảng giá.')
                    )}

                    {/* TAB 4.1: QUẢN LÝ TIỆN NGHI PHÒNG (AMENITIES) */}
                    {activeTab === 'amenities' && (
                        canViewCategories ? <AmenityManagement /> : renderAccessDenied('Tài khoản của bạn không có quyền xem Tiện nghi phòng.')
                    )}

                    {/* TAB 4.2: QUẢN LÝ DANH MỤC MINIBAR & BẢNG GIÁ */}
                    {activeTab === 'minibar' && (
                        (canViewCategories || canViewRooms) ? <MinibarManagement /> : renderAccessDenied('Tài khoản của bạn không có quyền xem Danh mục Minibar.')
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
                        canViewServices ? <ServiceManagement /> : renderAccessDenied('Tài khoản của bạn không có quyền xem Danh mục thực đơn & Dịch vụ.')
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

                    {/* TAB 11: NHẬT KÝ THAO TÁC HỆ THỐNG (AUDIT LOGS) */}
                    {activeTab === 'audit-logs' && (
                        isHighLevelManager ? <SystemLog /> : renderAccessDenied('Tài khoản của bạn không có quyền xem Nhật ký hệ thống.')
                    )}

                    {/* TAB TỔNG QUAN HỆ THỐNG */}
                    {activeTab === 'overview' && (
                        <>
                            {/* Welcome & Time Filters Banner */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h1 className="text-2xl font-sans font-extrabold text-slate-900 tracking-tight">
                                        Xin chào, {user?.full_name || user?.username}
                                    </h1>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Bảng điều khiển vận hành khách sạn & giám sát công suất phòng thực tế tại Khách Sạn TA Đà Nẵng.
                                    </p>
                                </div>

                                {/* Filter buttons & CTA */}
                                <div className="flex items-center gap-3 max-w-full">
                                    <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold text-slate-600 max-w-full overflow-x-auto scrollbar-none shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setTimeFilter('today')}
                                            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer ${
                                                timeFilter === 'today' ? 'bg-white text-blue-600 font-bold shadow-xs' : 'hover:text-slate-900'
                                            }`}
                                        >
                                            Hôm nay
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTimeFilter('7days')}
                                            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer ${
                                                timeFilter === '7days' ? 'bg-white text-blue-600 font-bold shadow-xs' : 'hover:text-slate-900'
                                            }`}
                                        >
                                            7 ngày qua
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTimeFilter('month')}
                                            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer ${
                                                timeFilter === 'month' ? 'bg-white text-blue-600 font-bold shadow-xs' : 'hover:text-slate-900'
                                            }`}
                                        >
                                            Tháng này ({new Date().getMonth() + 1}/{new Date().getFullYear()})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTimeFilter('year')}
                                            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer ${
                                                timeFilter === 'year' ? 'bg-white text-blue-600 font-bold shadow-xs' : 'hover:text-slate-900'
                                            }`}
                                        >
                                            Năm {new Date().getFullYear()}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* ========================================================================= */}
                            {/* TẦNG 1: 4 THẺ TÀI CHÍNH & HIỆU SUẤT KINH DOANH (ĐỔI THEO BỘ LỌC THỜI GIAN) */}
                            {/* ========================================================================= */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                                {/* Thẻ 1: Tổng Doanh thu */}
                                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between hover:border-blue-400 hover:shadow-md transition">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                Tổng Doanh Thu ({dashboardData?.period_label?.toUpperCase() || 'KỲ HIỆN TẠI'})
                                            </span>
                                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-200/60">
                                                <DollarSign className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-1 font-sans tabular-nums tracking-tight">
                                            {(dashboardData?.revenue?.total_revenue || 0).toLocaleString('vi-VN')} <span className="text-xs font-semibold text-slate-500 font-sans ml-1">VND</span>
                                        </div>
                                        <div className="flex items-center text-xs font-bold gap-1.5 pt-0.5">
                                            {(dashboardData?.revenue?.growth_rate || 0) >= 0 ? (
                                                <span className="inline-flex items-center gap-0.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 text-[11px]">
                                                    <TrendingUp className="w-3 h-3" /> +{dashboardData?.revenue?.growth_rate || 0}%
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-0.5 text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60 text-[11px]">
                                                    <TrendingDown className="w-3 h-3" /> {dashboardData?.revenue?.growth_rate || 0}%
                                                </span>
                                            )}
                                            <span className="text-[11px] text-slate-400 font-normal truncate">
                                                {dashboardData?.revenue?.growth_label || 'so với kỳ trước'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                        <span>Tiến độ kỳ:</span>
                                        <span className="font-semibold text-blue-600">
                                            Đạt {dashboardData?.revenue?.achievement_rate || 0}% chỉ tiêu
                                        </span>
                                    </div>
                                </div>

                                {/* Thẻ 2: Doanh thu Tiền phòng */}
                                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between hover:border-emerald-400 hover:shadow-md transition">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                Doanh Thu Tiền Phòng
                                            </span>
                                            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs border border-emerald-200/60">
                                                <BedDouble className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-1 font-sans tabular-nums tracking-tight">
                                            {(dashboardData?.revenue?.room_revenue || 0).toLocaleString('vi-VN')} <span className="text-xs font-semibold text-slate-500 font-sans ml-1">VND</span>
                                        </div>
                                        <div className="text-xs text-slate-500 pt-0.5 flex items-center gap-1.5">
                                            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 text-[10px]">
                                                {dashboardData?.revenue?.total_revenue > 0
                                                    ? `Chiếm ${Math.round(((dashboardData.revenue.room_revenue || 0) / dashboardData.revenue.total_revenue) * 100)}% tổng thu`
                                                    : 'Chiếm 82%'}
                                            </span>
                                            <span className="text-[11px] text-slate-400 truncate">Lưu trú buồng phòng</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                        <span>Nguồn thu cốt lõi</span>
                                        <strong className="text-emerald-700 font-semibold">PMS Room Charge</strong>
                                    </div>
                                </div>

                                {/* Thẻ 3: Doanh thu Dịch vụ & F&B */}
                                <div 
                                    onClick={() => setActiveTab('services')}
                                    className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between hover:border-purple-400 hover:shadow-md transition cursor-pointer group"
                                    title="Mở phân hệ Dịch vụ phòng"
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-purple-600 transition">
                                                Doanh Thu Dịch Vụ & F&B
                                            </span>
                                            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xs border border-purple-200/60 group-hover:bg-purple-600 group-hover:text-white transition">
                                                <Utensils className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-1 font-sans tabular-nums tracking-tight">
                                            {(dashboardData?.revenue?.service_revenue || 0).toLocaleString('vi-VN')} <span className="text-xs font-semibold text-slate-500 font-sans ml-1">VND</span>
                                        </div>
                                        <div className="text-xs text-slate-500 pt-0.5 flex items-center gap-1.5">
                                            <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/60 text-[10px]">
                                                {dashboardData?.services?.completed_count || 0} yêu cầu xong
                                            </span>
                                            <span className="text-[11px] text-slate-400 truncate">Ẩm thực, minibar, tour</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                        <span>Điều phối Kanban</span>
                                        <strong className="text-purple-600 group-hover:underline">Xem dịch vụ →</strong>
                                    </div>
                                </div>

                                {/* Thẻ 4: Hóa đơn Quyết toán & Tiến độ Mục tiêu */}
                                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between hover:border-amber-400 hover:shadow-md transition">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                Hóa Đơn Đã Quyết Toán
                                            </span>
                                            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xs border border-amber-200/60">
                                                <Receipt className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <div className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-1 font-sans tabular-nums tracking-tight">
                                            {dashboardData?.revenue?.paid_invoices_count || 0} <span className="text-xs font-semibold text-slate-500 font-sans ml-1">Hóa đơn</span>
                                        </div>
                                        {/* Progress bar đạt chỉ tiêu */}
                                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-2">
                                            <div
                                                className="bg-amber-500 h-1.5 rounded-full transition-all duration-700"
                                                style={{ width: `${Math.min(100, dashboardData?.revenue?.achievement_rate || 0)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                        <span>Mục tiêu kỳ:</span>
                                        <strong className="text-slate-800 font-bold tabular-nums">
                                            {(dashboardData?.revenue?.target_revenue || 0).toLocaleString('vi-VN')} đ
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            {/* ========================================================================= */}
                            {/* TẦNG 2: VẬN HÀNH TIỀN SẢNH THỜI GIAN THỰC (TODAY'S OPERATIONS PULSE)       */}
                            {/* ========================================================================= */}
                            {(() => {
                                const pulse = dashboardData?.operations_pulse || {
                                    today_date: new Date().toLocaleDateString('vi-VN'),
                                    check_in: { total_expected: checkInTodayCount, arrived: 0, remaining: checkInTodayCount, progress_pct: 0 },
                                    check_out: { total_expected: checkOutTodayCount, departed: 0, remaining: checkOutTodayCount, progress_pct: 0 },
                                    in_house: {
                                        occupied_rooms: dashboardData?.occupancy?.occupied_rooms || 0,
                                        total_rooms: dashboardData?.occupancy?.total_rooms || 0,
                                        estimated_guests: (dashboardData?.occupancy?.occupied_rooms || 0) * 2,
                                        occupancy_rate: dashboardData?.occupancy?.occupancy_rate || 0
                                    },
                                    housekeeping: {
                                        available_clean: dashboardData?.occupancy?.available_rooms || 0,
                                        cleaning_dirty: dashboardData?.occupancy?.cleaning_rooms || 0,
                                        maintenance: dashboardData?.occupancy?.maintenance_rooms || 0,
                                        readiness_pct: 0
                                    }
                                };

                                return (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
                                                    Nhịp Đập Vận Hành Hôm Nay • {pulse.today_date}
                                                </h2>
                                            </div>
                                            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                                                Dữ liệu buồng phòng & luân chuyển khách thời gian thực
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                            {/* Thẻ 1: Check-in hôm nay */}
                                            <div
                                                onClick={() => {
                                                    setActiveTab('bookings');
                                                    setBookingSubFilter('all');
                                                    setIsBookingMenuOpen(true);
                                                }}
                                                className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:border-blue-400 hover:shadow-md transition cursor-pointer group"
                                                title="Xem danh sách đặt phòng check-in hôm nay"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                        Check-in Hôm Nay
                                                    </span>
                                                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
                                                        <DoorOpen className="w-4 h-4" />
                                                    </div>
                                                </div>
                                                <div className="flex items-baseline justify-between mb-1">
                                                    <div className="text-xl font-bold text-slate-900 font-sans tabular-nums">
                                                        {pulse.check_in.arrived}
                                                        <span className="text-xs font-normal text-slate-400 font-sans">/{pulse.check_in.total_expected} phòng</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60 font-sans">
                                                        {pulse.check_in.remaining} phòng chưa đến
                                                    </span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-2">
                                                    <div
                                                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-700"
                                                        style={{ width: `${Math.min(100, pulse.check_in.progress_pct || 0)}%` }}
                                                    ></div>
                                                </div>
                                                <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                                                    <span>Đã hoàn tất check-in:</span>
                                                    <strong className="text-slate-700">{pulse.check_in.progress_pct}%</strong>
                                                </div>
                                            </div>

                                            {/* Thẻ 2: Check-out hôm nay */}
                                            <div
                                                onClick={() => {
                                                    setActiveTab('bookings');
                                                    setBookingSubFilter('checked_in');
                                                    setIsBookingMenuOpen(true);
                                                }}
                                                className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:border-purple-400 hover:shadow-md transition cursor-pointer group"
                                                title="Xem danh sách phòng check-out hôm nay"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                        Check-out Hôm Nay
                                                    </span>
                                                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition">
                                                        <Clock className="w-4 h-4" />
                                                    </div>
                                                </div>
                                                <div className="flex items-baseline justify-between mb-1">
                                                    <div className="text-xl font-bold text-slate-900 font-sans tabular-nums">
                                                        {pulse.check_out.departed}
                                                        <span className="text-xs font-normal text-slate-400 font-sans">/{pulse.check_out.total_expected} phòng</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/60 font-sans">
                                                        {pulse.check_out.remaining} phòng đang ở
                                                    </span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-2">
                                                    <div
                                                        className="bg-purple-600 h-1.5 rounded-full transition-all duration-700"
                                                        style={{ width: `${Math.min(100, pulse.check_out.progress_pct || 0)}%` }}
                                                    ></div>
                                                </div>
                                                <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                                                    <span>Đã hoàn tất trả phòng:</span>
                                                    <strong className="text-slate-700">{pulse.check_out.progress_pct}%</strong>
                                                </div>
                                            </div>

                                            {/* Thẻ 3: Khách đang lưu trú In-house */}
                                            <div
                                                onClick={() => setActiveTab('rooms')}
                                                className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:border-emerald-400 hover:shadow-md transition cursor-pointer group"
                                                title="Mở sơ đồ phòng xem các phòng đang có khách"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                        Đang Lưu Trú (In-House)
                                                    </span>
                                                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition">
                                                        <Users className="w-4 h-4" />
                                                    </div>
                                                </div>
                                                <div className="flex items-baseline justify-between mb-1">
                                                    <div className="text-xl font-bold text-slate-900 font-sans tabular-nums">
                                                        {pulse.in_house.occupied_rooms}
                                                        <span className="text-xs font-normal text-slate-400 font-sans">/{pulse.in_house.total_rooms} phòng</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 font-sans">
                                                        Lấp đầy {pulse.in_house.occupancy_rate}%
                                                    </span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-2">
                                                    <div
                                                        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-700"
                                                        style={{ width: `${Math.min(100, pulse.in_house.occupancy_rate || 0)}%` }}
                                                    ></div>
                                                </div>
                                                <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                                                    <span>Số khách thực tế:</span>
                                                    <strong className="text-emerald-700 font-bold">~{pulse.in_house.estimated_guests} khách</strong>
                                                </div>
                                            </div>

                                            {/* Thẻ 4: Tình trạng Buồng phòng Housekeeping */}
                                            <div
                                                onClick={() => setActiveTab('rooms')}
                                                className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:border-amber-400 hover:shadow-md transition cursor-pointer group"
                                                title="Mở sơ đồ phòng theo dõi công tác dọn phòng buồng"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                        Buồng Phòng Sẵn Sàng
                                                    </span>
                                                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition">
                                                        <Sparkles className="w-4 h-4" />
                                                    </div>
                                                </div>
                                                <div className="flex items-baseline justify-between mb-1">
                                                    <div className="text-xl font-bold text-slate-900 font-sans tabular-nums">
                                                        {pulse.housekeeping.available_clean}
                                                        <span className="text-xs font-normal text-slate-400 font-sans"> phòng sạch</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60 font-sans">
                                                        {pulse.housekeeping.cleaning_dirty} đang dọn
                                                    </span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mt-2">
                                                    <div
                                                        className="bg-amber-500 h-1.5 rounded-full transition-all duration-700"
                                                        style={{ width: `${Math.min(100, pulse.housekeeping.readiness_pct || 0)}%` }}
                                                    ></div>
                                                </div>
                                                <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                                                    <span>Phòng hỏng / Bảo trì:</span>
                                                    <strong className="text-rose-600 font-bold">{pulse.housekeeping.maintenance} phòng</strong>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* ========================================================================= */}
                            {/* PHẦN 2 & 3: TRUNG TÂM CẢNH BÁO KHẨN & THAO TÁC NHANH LỄ TÂN (GRID 2 CỘT)  */}
                            {/* ========================================================================= */}
                            {(() => {
                                const actionCenter = dashboardData?.action_center || {
                                    total_urgent: 0,
                                    has_urgent: false,
                                    items: []
                                };

                                return (
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                        {/* CỘT TRÁI (8 CỘT): TRUNG TÂM CẢNH BÁO KHẨN (LIVE ACTION CENTER) */}
                                        <div className="lg:col-span-8 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-1.5 rounded-lg border ${
                                                            actionCenter.has_urgent
                                                                ? 'bg-rose-50 text-rose-600 border-rose-200/80 animate-pulse'
                                                                : 'bg-emerald-50 text-emerald-600 border-emerald-200/80'
                                                        }`}>
                                                            {actionCenter.has_urgent ? (
                                                                <BellRing className="w-4 h-4" />
                                                            ) : (
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h3 className="text-base font-bold text-slate-900 tracking-tight">
                                                                Trung Tâm Cảnh Báo & Xử Lý Sự Vụ
                                                            </h3>
                                                            <p className="text-xs text-slate-500">
                                                                Tự động phát hiện các yêu cầu nóng, đơn cọc và quá hạn cần giải quyết
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                                                        actionCenter.has_urgent
                                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    }`}>
                                                        {actionCenter.has_urgent ? `${actionCenter.total_urgent} sự vụ cần xử lý` : 'VẬN HÀNH ỔN ĐỊNH'}
                                                    </span>
                                                </div>

                                                {/* Danh sách các việc khẩn */}
                                                {!actionCenter.has_urgent || actionCenter.items.length === 0 ? (
                                                    <div className="py-6 px-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center gap-3.5">
                                                        <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                                                            <Check className="w-5 h-5 stroke-[2.5]" />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-bold text-emerald-900">
                                                                Tuyệt vời! Không có sự vụ tồn đọng cần can thiệp khẩn cấp
                                                            </h4>
                                                            <p className="text-[11px] text-emerald-700/80 mt-0.5">
                                                                Mọi đơn đặt phòng đã được xác nhận, yêu cầu dịch vụ phòng đang được xử lý đúng tiến độ và buồng phòng luôn sẵn sàng.
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2.5">
                                                        {actionCenter.items.map((item, idx) => {
                                                            const isCritical = item.level === 'critical';
                                                            const isWarning = item.level === 'warning';
                                                            const isAlert = item.level === 'alert';

                                                            const cardBg = isCritical
                                                                ? 'bg-rose-50/60 border-rose-200/80 hover:bg-rose-50'
                                                                : isAlert
                                                                    ? 'bg-amber-50/60 border-amber-200/80 hover:bg-amber-50'
                                                                    : 'bg-blue-50/60 border-blue-200/80 hover:bg-blue-50';

                                                            const badgeColor = isCritical
                                                                ? 'bg-rose-100 text-rose-800'
                                                                : isAlert
                                                                    ? 'bg-amber-100 text-amber-800'
                                                                    : 'bg-blue-100 text-blue-800';

                                                            const btnColor = isCritical
                                                                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                                                : isAlert
                                                                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                                                    : 'bg-blue-600 hover:bg-blue-700 text-white';

                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    className={`p-3 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${cardBg}`}
                                                                >
                                                                    <div className="flex items-start gap-3 min-w-0">
                                                                        <div className="mt-0.5 shrink-0">
                                                                            {isCritical && <Zap className="w-4 h-4 text-rose-600 animate-pulse" />}
                                                                            {isAlert && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                                                                            {isWarning && <Clock className="w-4 h-4 text-blue-600" />}
                                                                            {item.level === 'info' && <SlidersHorizontal className="w-4 h-4 text-slate-600" />}
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <div className="flex items-center gap-2">
                                                                                <strong className="text-xs font-bold text-slate-900 block truncate">
                                                                                    {item.title}
                                                                                </strong>
                                                                                <span className={`text-[10px] font-extrabold px-2 py-0.2 rounded-full shrink-0 ${badgeColor}`}>
                                                                                    {item.badge}
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                                                                {item.subtitle}
                                                                            </p>
                                                                        </div>
                                                                    </div>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (item.action_tab) {
                                                                                setActiveTab(item.action_tab);
                                                                                if (item.action_filter) setBookingSubFilter(item.action_filter);
                                                                                if (item.action_tab === 'bookings') setIsBookingMenuOpen(true);
                                                                            }
                                                                        }}
                                                                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer self-end sm:self-auto shrink-0 flex items-center gap-1 ${btnColor}`}
                                                                    >
                                                                        <span>{item.action_label || 'Xử lý'}</span>
                                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                                                <span className="flex items-center gap-1.5">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                                                    Tự động làm mới mỗi khi có booking mới hoặc webhook SePay
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => loadDashboardStats(true)}
                                                    className="text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                                                >
                                                    <RefreshCw className="w-3 h-3" />
                                                    <span>Quét lại</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* CỘT PHẢI (4 CỘT): CỤM THAO TÁC NHANH LỄ TÂN (FRONT-DESK FAST ACTIONS) */}
                                        <div className="lg:col-span-4 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200/80">
                                                            <Zap className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-base font-bold text-slate-900 tracking-tight">
                                                                Thao Tác Nhanh
                                                            </h3>
                                                            <p className="text-xs text-slate-500">
                                                                Phím tắt nghiệp vụ tiền sảnh
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                        1 Chạm
                                                    </span>
                                                </div>

                                                <div className="space-y-2.5">
                                                    {/* Phím 1: Đặt phòng tại quầy Walk-in */}
                                                    {canViewBookings && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setActiveTab('bookings');
                                                                setBookingSubFilter('all');
                                                                setIsBookingMenuOpen(true);
                                                            }}
                                                            className="w-full p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-blue-600/20 hover:from-blue-700 hover:to-indigo-700 transition flex items-center justify-between cursor-pointer group"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <PlusCircle className="w-4 h-4" />
                                                                <span>Đặt Phòng Tại Quầy (Walk-in)</span>
                                                            </div>
                                                            <ArrowRight className="w-3.5 h-3.5 opacity-80 group-hover:translate-x-0.5 transition-transform" />
                                                        </button>
                                                    )}

                                                    {/* Phím 2: Sơ đồ phòng PMS */}
                                                    {canViewRooms && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveTab('rooms')}
                                                            className="w-full p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 border border-emerald-200 font-bold text-xs transition flex items-center justify-between cursor-pointer group"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <BedDouble className="w-4 h-4 text-emerald-700" />
                                                                <span>Sơ Đồ Buồng Phòng (PMS Board)</span>
                                                            </div>
                                                            <ArrowRight className="w-3.5 h-3.5 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
                                                        </button>
                                                    )}

                                                    {/* Phím 3: Kanban Dịch vụ Concierge */}
                                                    {canViewServices && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveTab('services')}
                                                            className="w-full p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100/80 text-purple-900 border border-purple-200 font-bold text-xs transition flex items-center justify-between cursor-pointer group"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <BellRing className="w-4 h-4 text-purple-700" />
                                                                <span>Điều Phối Dịch Vụ Phòng (Concierge)</span>
                                                            </div>
                                                            <ArrowRight className="w-3.5 h-3.5 text-purple-600 group-hover:translate-x-0.5 transition-transform" />
                                                        </button>
                                                    )}

                                                    {/* Phím 4: Báo cáo & Thống kê Chuyên sâu */}
                                                    {canViewAnalytics && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveTab('analytics')}
                                                            className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-xs transition flex items-center justify-between cursor-pointer group"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <ArrowUpRight className="w-4 h-4 text-slate-600" />
                                                                <span>Báo Cáo & Phân Tích Chuyên Sâu</span>
                                                            </div>
                                                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                                                <span>Ca trực hiện tại:</span>
                                                <strong className="text-slate-700 font-medium">Lễ tân & Điều hành PMS</strong>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

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
                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                                <div className="xl:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                                    <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                        <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                                            <thead>
                                                <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                    <th className="py-3 px-3 pl-4 sm:pl-5 whitespace-nowrap">MÃ BOOKING</th>
                                                    <th className="py-3 px-3 whitespace-nowrap">KHÁCH HÀNG</th>
                                                    <th className="py-3 px-3 whitespace-nowrap">HẠNG PHÒNG & SỐ PHÒNG</th>
                                                    <th className="py-3 px-3 whitespace-nowrap">LỊCH TRÌNH</th>
                                                    <th className="py-3 px-3 whitespace-nowrap">TỔNG TIỀN</th>
                                                    <th className="py-3 px-3 whitespace-nowrap">TRẠNG THÁI</th>
                                                    <th className="py-3 px-3 pr-4 sm:pr-5 text-right whitespace-nowrap">THAO TÁC</th>
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
                                                            <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-1" />
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
                                                                <td className="py-3 px-3 pl-4 sm:pl-5 font-mono font-bold text-blue-600 whitespace-nowrap">
                                                                    <div>#{b.booking_code}</div>
                                                                    <span className="text-[10px] text-slate-400 font-normal">{formatDateTimeDisplay(b.created_at)}</span>
                                                                </td>
                                                                <td className="py-3 px-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                                                                            {avatarInitial}
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <div className="font-semibold text-slate-900 truncate max-w-[130px]">{guestName}</div>
                                                                            <span className="text-[10px] text-slate-400 block truncate max-w-[130px]">{b.guest_phone || b.guest_email || '—'}</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="py-3 px-3">
                                                                    <strong className="text-slate-800 block font-medium truncate max-w-[160px]" title={b.room_name}>{b.room_name || 'Hạng phòng'}</strong>
                                                                    <span className="text-[10px] text-slate-500">
                                                                        {b.room_number ? (
                                                                            <span className="text-emerald-700 font-bold">Phòng {b.room_number}</span>
                                                                        ) : (
                                                                            <span className="text-slate-400 italic">Chờ gán số phòng</span>
                                                                        )}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 px-3 whitespace-nowrap">
                                                                    <span className="font-semibold text-slate-800 block text-[11px]">
                                                                        {formatDateDisplay(b.check_in_date)} → {formatDateDisplay(b.check_out_date)}
                                                                    </span>
                                                                    <span className="text-[10px] text-blue-600 font-bold inline-flex items-center gap-1"><Moon className="w-2.5 h-2.5" />{b.nights || 1} đêm</span>
                                                                </td>
                                                                <td className="py-3 px-3 whitespace-nowrap">
                                                                    <span className="font-bold text-rose-600 block">{totalAmountNum.toLocaleString('vi-VN')} VND</span>
                                                                </td>
                                                                <td className="py-3 px-3 whitespace-nowrap">
                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.color}`}>
                                                                        {['pending', 'paid', 'PAID'].includes(b.status) && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping mr-1"></span>}
                                                                        {statusCfg.label}
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 px-3 pr-4 sm:pr-5 text-right whitespace-nowrap">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActiveTab('bookings');
                                                                            setBookingSubFilter('all');
                                                                            setIsBookingMenuOpen(true);
                                                                        }}
                                                                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-bold text-[11px] transition shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                                                    >
                                                                        <span>Xử lý</span>
                                                                        <span>→</span>
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 px-4 sm:px-5">
                                        <span>Đang hiển thị <strong>{filteredBookings.length}</strong> / <strong>{actualBookingsCount}</strong> đơn thực tế từ CSDL</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActiveTab('bookings');
                                                setBookingSubFilter('all');
                                                setIsBookingMenuOpen(true);
                                            }}
                                            className="text-blue-600 hover:text-blue-700 font-bold text-xs hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                            <span>Quản lý toàn bộ đơn đặt phòng</span>
                                            <span>→</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Concierge & Dịch Vụ Nóng */}
                                <div className="xl:col-span-4 space-y-6">
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
                                                        <BellRing className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                                                        <p className="font-semibold text-slate-600">Không có yêu cầu nào</p>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">Hiện tại chưa có yêu cầu dịch vụ phòng phát sinh.</p>
                                                    </div>
                                                ) : (
                                                    dashboardData.services.recent_requests.slice(0, 5).map((sr) => {
                                                        const serviceImg = getServiceItemImage(sr);
                                                        const icon = renderServiceCategoryIcon(sr.category_name, sr.service_name);
                                                        const statusBadge = getServiceRequestStatusBadge(sr.status);
                                                        return (
                                                            <div
                                                                key={sr.id}
                                                                onClick={() => setActiveTab('services')}
                                                                className="p-3 bg-slate-50 hover:bg-orange-50/40 rounded-xl border border-slate-100 hover:border-orange-200 transition cursor-pointer group"
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-white border border-slate-200/90 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-200 relative">
                                                                        {serviceImg ? (
                                                                            <img
                                                                                src={serviceImg}
                                                                                alt={sr.service_name}
                                                                                loading="lazy"
                                                                                onError={(e) => {
                                                                                    e.target.onerror = null;
                                                                                    e.target.style.display = 'none';
                                                                                    const fallbackEl = e.target.parentElement?.querySelector('.fallback-service-icon');
                                                                                    if (fallbackEl) fallbackEl.style.display = 'flex';
                                                                                }}
                                                                                className="w-full h-full object-cover"
                                                                            />
                                                                        ) : null}
                                                                        <span
                                                                            className={`fallback-service-icon flex items-center justify-center ${serviceImg ? 'hidden' : ''}`}
                                                                            aria-hidden="true"
                                                                        >
                                                                            {icon}
                                                                        </span>
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
                                                                            <p className="text-[10px] text-slate-500 italic mt-1.5 bg-white/70 p-1.5 rounded border border-slate-100 line-clamp-1 flex items-center gap-1">
                                                                                <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                                                                                <span>&ldquo;{sr.note}&rdquo;</span>
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
                    {!['overview', 'guests', 'customer-detail', 'corporate-partners', 'employees', 'rooms', 'lost-and-found', 'categories', 'amenities', 'minibar', 'bookings', 'booking-timeline', 'services', 'service-items', 'reviews', 'profile', 'posts', 'promotions', 'contacts', 'invoices', 'analytics', 'reports', 'settings', 'audit-logs'].includes(activeTab) && (
                        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Wrench className="w-8 h-8 text-blue-600" />
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
                    </Suspense>
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