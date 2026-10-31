import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import hotelService from '../../services/hotelService';
import { useAuth } from '../../store/authStore';
import { useHotelSettings } from '../../store/hotelSettingStore';
import {
    Utensils,
    Coffee,
    Sparkles,
    Clock,
    CheckCircle2,
    AlertCircle,
    X,
    RotateCw,
    Search,
    Plus,
    Minus,
    Trash2,
    History,
    ChevronRight,
    ChevronLeft,
    PhoneCall,
    BedDouble,
    Info,
    BellRing,
    Check,
    XCircle,
    Layers,
    Receipt,
    ChefHat,
    Car,
    Zap
} from 'lucide-react';

// Tiện ích format thời gian chi tiết (VD: 14:30 • 29/09/2026)
const formatDateTimeDisplay = (isoStr) => {
    if (!isoStr) return '';
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

const formatToLocalDateTimeString = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Hàm helper phân loại và trả về nhãn trạng thái, câu chúc theo loại dịch vụ:
 * 1. Đồ ăn / Đồ uống (F&B)
 * 2. Đưa đón / Xe
 * 3. Spa / Massage
 * 4. Tiện ích buồng phòng (Khăn, gối, giặt ủi...)
 */
export const getServiceLabels = (serviceName = '', categoryName = '') => {
    const text = `${categoryName || ''} ${serviceName || ''}`.trim().toLowerCase();

    // 1. Nhóm Đưa đón / Xe (Có chữ "Sân bay", "Xe", "Đưa đón"...)
    const transportKeywords = ['sân bay', 'xe', 'đưa đón', 'transfer', 'airport', 'taxi', 'shuttle', 'đón tiễn'];
    if (transportKeywords.some((k) => text.includes(k))) {
        return {
            type: 'transport',
            step1: 'Tiếp nhận',
            step2: 'Điều phối xe',
            step3: 'Xe đang di chuyển',
            step4: 'Hoàn thành chuyến',
            badgePending: 'Chờ xác nhận',
            badgeInProgress: 'Đang điều phối xe',
            badgeDelivering: 'Xe đang đón / di chuyển',
            badgeCompleted: 'Hoàn thành',
            pendingMessage: 'Bộ phận điều vận đã tiếp nhận thông tin và đang kiểm tra lộ trình.',
            inProgressMessage: 'Bộ phận điều vận đang sắp xếp tài xế và xe chuyên dụng cho phòng.',
            deliveringMessage: 'Tài xế và xe đã sẵn sàng phục vụ quý khách tại sảnh / điểm hẹn!',
            completedMessage: 'Chuyến xe đã hoàn thành trọn vẹn. Cảm ơn quý khách đã tin chọn dịch vụ!'
        };
    }

    // 2. Nhóm Spa / Massage (Có chữ "Spa", "Massage", "Trị liệu"...)
    const spaKeywords = ['spa', 'massage', 'trị liệu', 'xông hơi', 'sauna', 'thư giãn', 'wellness', 'chăm sóc da'];
    if (spaKeywords.some((k) => text.includes(k))) {
        return {
            type: 'spa',
            step1: 'Tiếp nhận',
            step2: 'Chuẩn bị liệu trình',
            step3: 'Đang trị liệu',
            step4: 'Hoàn tất liệu trình',
            badgePending: 'Chờ xác nhận',
            badgeInProgress: 'Chuẩn bị liệu trình',
            badgeDelivering: 'Đang thực hiện trị liệu',
            badgeCompleted: 'Hoàn tất',
            pendingMessage: 'Lễ tân Spa đã nhận yêu cầu và đang kiểm tra phòng trị liệu phù hợp.',
            inProgressMessage: 'Bộ phận Spa đang chuẩn bị dược liệu, phòng xông và kỹ thuật viên.',
            deliveringMessage: 'Kỹ thuật viên và phòng trị liệu đã sẵn sàng đón tiếp quý khách!',
            completedMessage: 'Liệu trình đã hoàn tất. Chúc quý khách những giây phút thư thái trọn vẹn!'
        };
    }

    // 3. Nhóm Tiện ích buồng phòng (Khăn, gối, giặt ủi...)
    const amenitiesKeywords = [
        'gối', 'khăn', 'tắm', 'giặt', 'ủi', 'buồng phòng', 'tiện ích', 'bàn chải',
        'kem đánh răng', 'dép', 'dọn phòng', 'housekeeping', 'laundry', 'amenities', 'chăn', 'nệm'
    ];
    if (amenitiesKeywords.some((k) => text.includes(k))) {
        return {
            type: 'amenities',
            step1: 'Tiếp nhận',
            step2: 'Đang chuẩn bị',
            step3: 'Đang mang lên phòng',
            step4: 'Bàn giao hoàn tất',
            badgePending: 'Chờ xác nhận',
            badgeInProgress: 'Đang chuẩn bị',
            badgeDelivering: 'Đang mang lên phòng',
            badgeCompleted: 'Hoàn thành',
            pendingMessage: 'Bộ phận Buồng phòng đã tiếp nhận yêu cầu tiện ích của quý khách.',
            inProgressMessage: 'Nhân viên Buồng phòng đang chuẩn bị các vật dụng theo yêu cầu.',
            deliveringMessage: 'Nhân viên đang mang tiện ích lên tận phòng của quý khách.',
            completedMessage: 'Đã bàn giao tiện ích tới phòng. Chúc quý khách kỳ nghỉ tuyệt vời!'
        };
    }

    // 4. Mặc định: Đồ ăn / Đồ uống (F&B)
    return {
        type: 'fnb',
        step1: 'Tiếp nhận',
        step2: 'Đang chế biến',
        step3: 'Đang giao tới phòng',
        step4: 'Phục vụ hoàn tất',
        badgePending: 'Chờ xác nhận',
        badgeInProgress: 'Đang chế biến',
        badgeDelivering: 'Đang giao tới phòng',
        badgeCompleted: 'Hoàn thành',
        pendingMessage: 'Bếp trưởng & Lễ tân đã tiếp nhận yêu cầu và kiểm tra nguyên liệu chế biến.',
        inProgressMessage: 'Bộ phận Bếp đang trực tiếp chế biến món ăn cẩn thận cho phòng của bạn.',
        deliveringMessage: 'Nhân viên Room Service đang mang món ăn nóng sốt lên tận phòng.',
        completedMessage: 'Đã phục vụ món tới tận phòng. Chúc quý khách dùng bữa thật ngon miệng!'
    };
};

export default function ServicesMenu() {
    const { user, isAuthenticated } = useAuth();
    const { settings } = useHotelSettings();
    const starCount = settings?.stars || 3;
    const hotelName = settings?.hotel_name || "Khách Sạn TA Đà Nẵng";
    const bannerServicesImg = settings?.banner_services || "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=2070&q=85";

    // 1. Data States
    const [categories, setCategories] = useState([]);
    const [serviceItems, setServiceItems] = useState([]);
    const [activeBookings, setActiveBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // 2. Filter & Search States
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // 2b. Pagination States (phân trang danh sách dịch vụ)
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 8;

    // 3. Order Modal States
    const [selectedItem, setSelectedItem] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [selectedBookingId, setSelectedBookingId] = useState('');
    const [note, setNote] = useState('');
    const [deliveryMode, setDeliveryMode] = useState('now'); // 'now' | 'scheduled'
    const [scheduledDateTime, setScheduledDateTime] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 4. Toast & Success Alert
    const [toast, setToast] = useState(null);
    const [successOrderInfo, setSuccessOrderInfo] = useState(null);

    // 5. Order History States (Xem lịch sử đặt món & trạng thái xử lý)
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [orderHistory, setOrderHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'pending' | 'in_progress' | 'completed' | 'cancelled'
    const [cancellingRequestId, setCancellingRequestId] = useState(null);
    const [orderToCancel, setOrderToCancel] = useState(null);

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    // Tải lịch sử đơn đặt món của khách
    const fetchOrderHistory = async (isSilent = false, specificBooking = null) => {
        const targetBooking = specificBooking || (!isAuthenticated ? sessionStorage.getItem('pms_guest_booking_code') : null);
        if (!isAuthenticated && !targetBooking) {
            setOrderHistory([]);
            return;
        }
        if (!isSilent) setIsLoadingHistory(true);
        try {
            const params = targetBooking ? { booking: targetBooking } : {};
            const res = await hotelService.getMyServiceRequests(params);
            if (res.success) {
                setOrderHistory(res.requests || []);
            }
        } catch (err) {
            console.error('Lỗi khi tải lịch sử đặt món:', err);
        } finally {
            if (!isSilent) setIsLoadingHistory(false);
        }
    };

    // Tải danh mục, danh sách dịch vụ và các phòng đang active
    const loadData = async () => {
        setIsLoading(true);
        try {
            const promises = [
                hotelService.getServiceCategories(),
                hotelService.getServiceItems()
            ];

            if (isAuthenticated) {
                promises.push(hotelService.getMyActiveBookings());
                promises.push(hotelService.getMyServiceRequests());
            }

            const results = await Promise.all(promises);
            const catRes = results[0];
            const itemsRes = results[1];
            const bkRes = isAuthenticated ? results[2] : null;
            const historyRes = isAuthenticated ? results[3] : null;

            if (catRes && catRes.success) setCategories(catRes.categories || []);
            if (itemsRes && itemsRes.success) setServiceItems(itemsRes.items || []);

            if (isAuthenticated && historyRes && historyRes.success) {
                setOrderHistory(historyRes.requests || []);
            } else if (!isAuthenticated) {
                const savedCode = sessionStorage.getItem('pms_guest_booking_code');
                if (savedCode) {
                    fetchOrderHistory(true, savedCode);
                } else {
                    setOrderHistory([]);
                }
            }

            if (isAuthenticated && bkRes && bkRes.success) {
                const bks = bkRes.bookings || [];
                setActiveBookings(bks);
                if (bks.length > 0) {
                    setSelectedBookingId(String(bks[0].id));
                } else {
                    setSelectedBookingId('');
                }
            } else if (!isAuthenticated) {
                setActiveBookings([]);
                const savedCode = sessionStorage.getItem('pms_guest_booking_code');
                if (savedCode) setSelectedBookingId(savedCode);
            }
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu dịch vụ:', error);
            showToast('error', 'Không thể kết nối máy chủ để tải menu dịch vụ.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        // Lắng nghe sự kiện cập nhật thực đơn hoặc đặt dịch vụ mới giữa các tab
        const handleCatalogChanged = () => {
            loadData();
        };

        const handleServiceEvent = (e) => {
            fetchOrderHistory(true);
            if (e?.detail?.status === 'delivering') {
                showToast('success', '🛎️ Đơn dịch vụ của bạn đang được phục vụ / chuyển tới phòng!');
            } else if (e?.detail?.status === 'completed') {
                showToast('success', '✅ Đơn dịch vụ của bạn đã hoàn thành!');
            }
        };

        const handleStorage = (e) => {
            if (e.key === 'pms_service_catalog_changed') {
                loadData();
            }
            if (e.key === 'pms_last_service_event') {
                fetchOrderHistory(true);
                try {
                    const data = JSON.parse(e.newValue);
                    if (data?.status === 'delivering') {
                        showToast('success', '🛎️ Đơn dịch vụ của bạn đang được phục vụ / chuyển tới phòng!');
                    } else if (data?.status === 'completed') {
                        showToast('success', '✅ Đơn dịch vụ của bạn đã hoàn thành!');
                    }
                } catch {
                    // Ignore parse error
                }
            }
        };

        const handleFocus = () => {
            fetchOrderHistory(true);
        };

        window.addEventListener('pms_service_catalog_changed', handleCatalogChanged);
        window.addEventListener('pms_service_created', handleServiceEvent);
        window.addEventListener('pms_service_updated', handleServiceEvent);
        window.addEventListener('storage', handleStorage);
        window.addEventListener('focus', handleFocus);

        return () => {
            window.removeEventListener('pms_service_catalog_changed', handleCatalogChanged);
            window.removeEventListener('pms_service_created', handleServiceEvent);
            window.removeEventListener('pms_service_updated', handleServiceEvent);
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('focus', handleFocus);
        };
    }, [isAuthenticated]);

    // Lọc danh sách món / dịch vụ
    const filteredItems = useMemo(() => {
        return serviceItems.filter((item) => {
            const matchCategory =
                selectedCategory === 'all' || String(item.category_id) === String(selectedCategory);
            const matchSearch =
                !searchQuery.trim() ||
                item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.category_name?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchCategory && matchSearch;
        });
    }, [serviceItems, selectedCategory, searchQuery]);

    // Phân trang danh sách dịch vụ
    const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const pageStartIndex = (safePage - 1) * ITEMS_PER_PAGE;
    const paginatedItems = useMemo(
        () => filteredItems.slice(pageStartIndex, pageStartIndex + ITEMS_PER_PAGE),
        [filteredItems, pageStartIndex]
    );

    // Về trang 1 mỗi khi đổi nhóm dịch vụ hoặc từ khóa tìm kiếm
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCategory, searchQuery]);

    // Chuyển trang và cuộn mượt về đầu lưới dịch vụ
    const handlePageChange = (page) => {
        if (page < 1 || page > totalPages || page === safePage) return;
        setCurrentPage(page);
        const grid = document.getElementById('services-menu-grid');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Danh sách số trang hiển thị (có dấu ... khi quá nhiều trang)
    const pageNumbers = useMemo(() => {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
        const pages = [1];
        const start = Math.max(2, safePage - 1);
        const end = Math.min(totalPages - 1, safePage + 1);
        if (start > 2) pages.push('ellipsis-left');
        for (let p = start; p <= end; p++) pages.push(p);
        if (end < totalPages - 1) pages.push('ellipsis-right');
        pages.push(totalPages);
        return pages;
    }, [totalPages, safePage]);

    // Mở modal đặt dịch vụ
    const handleOpenOrderModal = (item) => {
        setSelectedItem(item);
        setQuantity(1);
        setNote('');
        if (activeBookings.length > 0 && !selectedBookingId) {
            setSelectedBookingId(String(activeBookings[0].id));
        } else if (!selectedBookingId) {
            const savedCode = sessionStorage.getItem('pms_guest_booking_code');
            if (savedCode) setSelectedBookingId(savedCode);
        }
    };

    // Đóng modal đặt dịch vụ
    const handleCloseOrderModal = () => {
        if (isSubmitting) return;
        setSelectedItem(null);
        setQuantity(1);
        setNote('');
        setDeliveryMode('now');
        setScheduledDateTime('');
    };

    // Gửi yêu cầu đặt dịch vụ
    const handleConfirmOrder = async (e) => {
        if (e && e.preventDefault) e.preventDefault();

        if (!selectedItem) return;

        const bookingKey = (selectedBookingId || '').trim().toUpperCase();
        if (!bookingKey) {
            showToast('error', 'Vui lòng nhập Mã Đặt phòng (VD: BK-02DE4E) in trên thẻ phòng của bạn.');
            return;
        }

        if (deliveryMode === 'scheduled' && !scheduledDateTime) {
            showToast('error', 'Vui lòng chọn ngày và giờ hẹn giao món / dịch vụ.');
            return;
        }

        try {
            setIsSubmitting(true);
            const isScheduled = deliveryMode === 'scheduled';
            const payload = {
                booking_id: bookingKey,
                service_id: selectedItem.id,
                quantity: Number(quantity) || 1,
                note: note.trim(),
                is_scheduled: isScheduled,
                ...(isScheduled && scheduledDateTime ? { request_time: new Date(scheduledDateTime).toISOString() } : {})
            };

            const res = await hotelService.createServiceRequest(payload);

            if (res && res.success) {
                sessionStorage.setItem('pms_guest_booking_code', bookingKey);

                const targetBooking = activeBookings.find(
                    (b) => String(b.id) === String(selectedBookingId) || b.booking_code === bookingKey
                );
                const roomNum = res.data?.room_number || targetBooking?.room_number || 'phòng lưu trú';

                setSuccessOrderInfo({
                    serviceName: selectedItem.name,
                    quantity: Number(quantity) || 1,
                    totalPrice: Number(selectedItem.price) * (Number(quantity) || 1),
                    roomNumber: roomNum,
                    bookingCode: bookingKey
                });

                handleCloseOrderModal();
                fetchOrderHistory(true, bookingKey);
                showToast('success', res.message || 'Yêu cầu của quý khách đã được gửi đến bộ phận phục vụ!');
            } else {
                showToast('error', res?.message || 'Không thể gửi yêu cầu dịch vụ. Vui lòng kiểm tra lại mã đặt phòng.');
            }
        } catch (error) {
            console.error('Lỗi khi gửi yêu cầu:', error);
            showToast('error', error.message || 'Lỗi kết nối máy chủ.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Khách hàng hủy yêu cầu dịch vụ khi còn chờ xử lý (status === 'pending')
    const handleCancelOrder = (order) => {
        setOrderToCancel(order);
    };

    const executeCancelOrder = async () => {
        if (!orderToCancel) return;
        const requestId = orderToCancel.id;
        try {
            setCancellingRequestId(requestId);
            const res = await hotelService.cancelServiceRequest(requestId);
            if (res.success) {
                showToast('success', res.message || 'Đã hủy yêu cầu đặt món thành công.');
                setOrderHistory((prev) =>
                    prev.map((o) =>
                        o.id === requestId
                            ? { ...o, status: 'cancelled', status_display: 'Đã hủy' }
                            : o
                    )
                );
                setOrderToCancel(null);
            } else {
                showToast('error', res.message || 'Không thể hủy yêu cầu đặt món.');
            }
        } catch (err) {
            showToast('error', err.message || 'Lỗi khi hủy yêu cầu.');
        } finally {
            setCancellingRequestId(null);
        }
    };

    // Xóa phiên lưu trữ mã phòng trên thiết bị (dành cho khách chưa đăng nhập)
    const handleClearGuestSession = () => {
        sessionStorage.removeItem('pms_guest_booking_code');
        setSelectedBookingId('');
        setOrderHistory([]);
        setIsHistoryModalOpen(false);
        showToast('success', 'Đã xóa phiên lưu trữ phòng trên thiết bị này.');
    };

    // Thống kê nhanh đơn đặt món
    const activeOrdersCount = useMemo(() => {
        return orderHistory.filter((o) => o.status === 'pending' || o.status === 'in_progress' || o.status === 'delivering').length;
    }, [orderHistory]);

    const historyStats = useMemo(() => {
        const total = orderHistory.length;
        const pending = orderHistory.filter((o) => o.status === 'pending').length;
        const inProgress = orderHistory.filter((o) => o.status === 'in_progress').length;
        const delivering = orderHistory.filter((o) => o.status === 'delivering').length;
        const completed = orderHistory.filter((o) => o.status === 'completed').length;
        const cancelled = orderHistory.filter((o) => o.status === 'cancelled').length;
        return { total, pending, inProgress, delivering, completed, cancelled };
    }, [orderHistory]);

    // 5.1 Phân trang Lịch sử đặt món trong Modal
    const [historyPage, setHistoryPage] = useState(1);
    const HISTORY_ITEMS_PER_PAGE = 5; // Hiển thị 5 đơn mỗi trang theo yêu cầu

    // Tự động về trang 1 khi bấm chuyển tab bộ lọc
    useEffect(() => {
        setHistoryPage(1);
    }, [historyFilter]);

    // Sắp xếp Lịch sử: Các đơn CHƯA HOÀN THÀNH lên TRÊN, các đơn ĐÃ HOÀN THÀNH/HỦY xuống DƯỚI
    const sortedHistory = useMemo(() => {
        let list = [];
        if (historyFilter === 'all') {
            list = [...orderHistory];
        } else if (historyFilter === 'active') {
            list = orderHistory.filter((o) => ['pending', 'in_progress', 'delivering'].includes(o.status));
        } else {
            list = orderHistory.filter((o) => o.status === historyFilter);
        }

        // Độ ưu tiên: Chưa hoàn thành (1, 2, 3) lên đầu; Đã xong/Hủy (4, 5) xuống dưới
        const getStatusPriority = (status) => {
            switch (status) {
                case 'pending': return 1;     // Chờ xác nhận lên đầu
                case 'in_progress': return 2; // Đang chế biến
                case 'delivering': return 3;  // Đang giao tận phòng
                case 'completed': return 4;   // Đã phục vụ xuống dưới
                case 'cancelled': return 5;   // Đã hủy xuống cuối
                default: return 6;
            }
        };

        return list.sort((a, b) => {
            const pA = getStatusPriority(a.status);
            const pB = getStatusPriority(b.status);
            if (pA !== pB) return pA - pB;
            // Cùng nhóm trạng thái thì đơn mới nhất xếp trước
            const timeA = new Date(a.created_at || a.request_time || 0).getTime();
            const timeB = new Date(b.created_at || b.request_time || 0).getTime();
            return timeB - timeA || (b.id || 0) - (a.id || 0);
        });
    }, [orderHistory, historyFilter]);

    const totalHistoryPages = Math.max(1, Math.ceil(sortedHistory.length / HISTORY_ITEMS_PER_PAGE));

    // Danh sách đơn hiển thị trên trang hiện tại
    const paginatedHistory = useMemo(() => {
        const start = (historyPage - 1) * HISTORY_ITEMS_PER_PAGE;
        return sortedHistory.slice(start, start + HISTORY_ITEMS_PER_PAGE);
    }, [sortedHistory, historyPage]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-amber-500 selection:text-white flex flex-col justify-between">
            <div>
                <Navbar />

                {/* BREADCRUMB */}
                <div className="bg-white border-b border-slate-100 py-3">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <nav className="flex items-center space-x-2 text-xs text-slate-500">
                            <Link to="/" className="hover:text-amber-600 transition">Trang chủ</Link>
                            <span>/</span>
                            <span className="text-slate-900 font-semibold">Menu Dịch Vụ Tại Phòng</span>
                        </nav>
                    </div>
                </div>

                {/* HERO BANNER CHUẨN LUXURY HOTEL (ẢNH SẮC NÉT + GRADIENT OVERLAY) */}
                <header className="relative bg-slate-950 overflow-hidden py-16 lg:py-24 border-b border-slate-800 shadow-md">
                    {/* 1. Ảnh nền sắc nét 100% không giảm opacity, không blur */}
                    <img
                        src={bannerServicesImg}
                        alt={`Luxury ${starCount}-Star Resort & Dining`}
                        className="absolute inset-0 w-full h-full object-cover object-center"
                    />

                    {/* 2. Lớp phủ Gradient tối (Gradient Overlay) bảo vệ độ tương phản chữ */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/20" />

                    {/* 3. Nội dung chữ nổi bật tuyệt đối (relative z-10) */}
                    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="max-w-3xl flex flex-col items-start text-left">
                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-black text-white tracking-tight leading-tight drop-shadow-sm">
                                Thực Đơn Dịch Vụ Tại Phòng <br className="hidden sm:inline" />
                                <span className="text-amber-400">
                                    & Đặc Quyền Lưu Trú
                                </span>
                            </h1>
                            <p className="text-sm sm:text-base text-gray-200 mt-4 leading-relaxed font-normal max-w-2xl drop-shadow-xs">
                                Thưởng thức ẩm thực mỹ vị, set trà chiều hoàng gia, liệu trình spa thảo dược và các tiện ích buồng phòng đẳng cấp {starCount} sao phục vụ tận phòng nghỉ của bạn tại {hotelName}.
                            </p>

                            {/* Thông tin phòng đang lưu trú của khách */}
                            {isAuthenticated && activeBookings.length > 0 && (
                                <div className="mt-6 flex flex-wrap items-center gap-3">
                                    <div className="inline-flex flex-wrap items-center gap-2 p-2.5 px-4 rounded-2xl bg-white/90 backdrop-blur-md border border-amber-200/80 text-xs shadow-xs">
                                        <span className="text-amber-900 font-bold flex items-center gap-1.5">
                                            <BedDouble className="w-4 h-4 text-amber-600" />
                                            Phòng đang lưu trú:
                                        </span>
                                        {activeBookings.map((b) => (
                                            <span
                                                key={b.id}
                                                className="px-3 py-1 rounded-lg bg-amber-600 text-white font-semibold text-[11px] shadow-xs"
                                            >
                                                Phòng {b.room_number} • Mã #{b.booking_code}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* TOAST THÔNG BÁO */}
                {toast && (
                    <div className="fixed bottom-6 right-6 z-50 animate-bounce">
                        <div
                            className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-xs font-semibold backdrop-blur-md ${
                                toast.type === 'success'
                                    ? 'bg-slate-900/95 text-white border border-emerald-500/50 shadow-emerald-950/40'
                                    : 'bg-rose-950/95 text-white border border-rose-500/50 shadow-rose-950/40'
                            }`}
                        >
                            {toast.type === 'success' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <span>{toast.message}</span>
                        </div>
                    </div>
                )}

                {/* MODAL THÔNG BÁO ĐẶT THÀNH CÔNG */}
                {successOrderInfo && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-5 animate-scale-up">
                            <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-200/60 shadow-lg shadow-amber-500/10">
                                <BellRing className="w-8 h-8 text-amber-600 animate-pulse" />
                            </div>
                            <div>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold mb-2 border border-emerald-200">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    ĐÃ TIẾP NHẬN YÊU CẦU
                                </span>
                                <h3 className="text-xl font-bold text-slate-900">
                                    Phục vụ phòng đang chuẩn bị!
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Yêu cầu của quý khách đã được chuyển tới bếp & bộ phận Concierge phục vụ.
                                </p>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-left space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Giao đến:</span>
                                    <strong className="text-slate-900 font-bold text-sm flex items-center gap-1.5">
                                        <BedDouble className="w-3.5 h-3.5 text-amber-600" />
                                        Phòng {successOrderInfo.roomNumber}
                                    </strong>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Dịch vụ / Món gọi:</span>
                                    <span className="font-semibold text-slate-800">
                                        {successOrderInfo.serviceName} (x{successOrderInfo.quantity})
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                                    <span className="text-slate-500">Tạm tính (vào hóa đơn phòng):</span>
                                    <strong className="text-rose-600 font-bold text-sm">
                                        {successOrderInfo.totalPrice.toLocaleString('vi-VN')} VND
                                    </strong>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/60">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>Thời gian dự kiến phục vụ:</span>
                                <strong className="text-slate-800">15 – 30 phút</strong>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSuccessOrderInfo(null)}
                                className="w-full py-3 bg-slate-900 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-slate-900/20 cursor-pointer"
                            >
                                Đã hiểu & Tiếp tục xem Menu
                            </button>
                        </div>
                    </div>
                )}

                {/* KHU VỰC MENU CHÍNH */}
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-24 sm:pb-12 space-y-8">
                    {/* BỘ LỌC DANH MỤC & TÌM KIẾM */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                        {/* Tabs danh mục */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                            <button
                                type="button"
                                onClick={() => setSelectedCategory('all')}
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                                    selectedCategory === 'all'
                                        ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20 ring-1 ring-slate-800'
                                        : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 shadow-2xs'
                                }`}
                            >
                                <Sparkles className={`w-3.5 h-3.5 ${selectedCategory === 'all' ? 'text-amber-400' : 'text-slate-400'}`} />
                                <span>Tất cả ({serviceItems.length})</span>
                            </button>

                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                                        String(selectedCategory) === String(cat.id)
                                            ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20 ring-1 ring-slate-800'
                                            : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 shadow-2xs'
                                    }`}
                                >
                                    <span>{cat.icon || '🏷️'}</span>
                                    <span>{cat.name}</span>
                                    {cat.services_count > 0 && (
                                        <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                                            String(selectedCategory) === String(cat.id)
                                                ? 'bg-white/20 text-white'
                                                : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {cat.services_count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Ô tìm kiếm món */}
                        <div className="relative w-full md:w-80 shrink-0">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Tìm món ăn, đồ uống, spa, tiện ích..."
                                className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs transition"
                            />
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100 transition cursor-pointer"
                                    title="Xóa tìm kiếm"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* DANH SÁCH CARDS GRID */}
                    {isLoading ? (
                        <div className="py-24 text-center text-slate-400 space-y-4">
                            <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                            <p className="text-xs font-semibold text-slate-600">
                                Đang nạp thực đơn & dịch vụ khách sạn...
                            </p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center space-y-3 shadow-2xs">
                            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/60 shadow-inner">
                                <Utensils className="w-6 h-6 text-amber-600" />
                            </div>
                            <h3 className="text-base font-bold text-slate-800">
                                Không tìm thấy dịch vụ nào phù hợp
                            </h3>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                Quý khách vui lòng thử tìm kiếm với từ khóa khác hoặc chọn nhóm dịch vụ "Tất cả".
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedCategory('all');
                                    setSearchQuery('');
                                }}
                                className="mt-3 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition shadow-sm cursor-pointer"
                            >
                                Xem tất cả thực đơn
                            </button>
                        </div>
                    ) : (
                        <div id="services-menu-grid" className="scroll-mt-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {paginatedItems.map((item) => {
                                const itemImg =
                                    item.display_image ||
                                    item.image_url ||
                                    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80';
                                const priceNum = Number(item.price) || 0;

                                return (
                                    <div
                                        key={item.id}
                                        className="group bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-2xs hover:shadow-xl hover:border-amber-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                                    >
                                        <div>
                                            {/* Ảnh dịch vụ */}
                                            <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                                                <img
                                                    src={itemImg}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                    loading="lazy"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-60"></div>
                                                
                                                {/* Badge danh mục */}
                                                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md text-slate-800 text-[10px] font-bold shadow-xs flex items-center gap-1 border border-white/40">
                                                    <span>{item.category_icon || '🏷️'}</span>
                                                    <span>{item.category_name}</span>
                                                </span>
                                            </div>

                                            {/* Nội dung thông tin */}
                                            <div className="p-5">
                                                <h3 className="font-bold text-slate-900 text-sm group-hover:text-amber-700 transition leading-snug">
                                                    {item.name}
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed font-light">
                                                    {item.description || `Dịch vụ chuẩn ${starCount} sao phục vụ trực tiếp tại phòng nghỉ.`}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Phần chân Card: Giá & Nút đặt */}
                                        <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                                            <div>
                                                <span className="text-[10px] text-slate-400 block font-medium">Đơn giá</span>
                                                <div className="text-base font-black text-rose-600">
                                                    {priceNum === 0 ? (
                                                        <span className="text-emerald-600 font-bold">Miễn phí</span>
                                                    ) : (
                                                        <>
                                                            {priceNum.toLocaleString('vi-VN')}
                                                            <span className="text-[11px] font-normal text-slate-400 ml-1">VND</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleOpenOrderModal(item)}
                                                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition cursor-pointer flex items-center gap-1.5"
                                            >
                                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                                <span>Đặt dịch vụ</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* PHÂN TRANG */}
                    {!isLoading && filteredItems.length > ITEMS_PER_PAGE && (
                        <nav
                            aria-label="Phân trang dịch vụ"
                            className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200"
                        >
                            <p className="text-xs text-slate-500">
                                Hiển thị{' '}
                                <strong className="text-slate-800">
                                    {pageStartIndex + 1}–{Math.min(pageStartIndex + ITEMS_PER_PAGE, filteredItems.length)}
                                </strong>{' '}
                                trong tổng số{' '}
                                <strong className="text-slate-800">{filteredItems.length}</strong> dịch vụ
                            </p>

                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => handlePageChange(safePage - 1)}
                                    disabled={safePage === 1}
                                    aria-label="Trang trước"
                                    className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-bold flex items-center justify-center transition cursor-pointer hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>

                                {pageNumbers.map((p) =>
                                    typeof p === 'string' ? (
                                        <span key={p} className="w-9 h-9 flex items-center justify-center text-slate-400 text-xs select-none">
                                            …
                                        </span>
                                    ) : (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => handlePageChange(p)}
                                            aria-current={p === safePage ? 'page' : undefined}
                                            className={`w-9 h-9 rounded-xl text-xs font-bold transition cursor-pointer border ${
                                                p === safePage
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/20'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    )
                                )}

                                <button
                                    type="button"
                                    onClick={() => handlePageChange(safePage + 1)}
                                    disabled={safePage === totalPages}
                                    aria-label="Trang sau"
                                    className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-bold flex items-center justify-center transition cursor-pointer hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </nav>
                    )}
                </main>

                {/* MODAL FORM ĐẶT DỊCH VỤ TẠI PHÒNG */}
                {selectedItem && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-scale-up">
                            {/* Modal Header */}
                            <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white flex items-center justify-between border-b border-amber-500/20">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-400/30">
                                        <BellRing className="w-5 h-5 text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-white">Yêu Cầu Dịch Vụ Tại Phòng</h3>
                                        <span className="text-[10px] text-amber-300 font-medium tracking-wide">In-Room Dining & Concierge Service</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCloseOrderModal}
                                    disabled={isSubmitting}
                                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <form onSubmit={handleConfirmOrder} className="p-6 space-y-5">
                                {/* Preview Item đã chọn */}
                                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-3.5 shadow-2xs">
                                    <img
                                        src={
                                            selectedItem.display_image ||
                                            selectedItem.image_url ||
                                            'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80'
                                        }
                                        alt={selectedItem.name}
                                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                                            {selectedItem.category_name}
                                        </span>
                                        <h4 className="font-bold text-slate-900 text-xs truncate">
                                            {selectedItem.name}
                                        </h4>
                                        <div className="text-xs font-black text-rose-600 mt-0.5">
                                            {Number(selectedItem.price).toLocaleString('vi-VN')} VND
                                            <span className="text-[10px] font-normal text-slate-400 ml-1">/ lần</span>
                                        </div>
                                    </div>
                                </div>

                                {/* HÀNG 1: CHỌN PHÒNG / MÃ BOOKING */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Giao đến Phòng / Mã Đặt phòng <span className="text-rose-500">*</span>
                                    </label>
                                    {activeBookings.length > 0 ? (
                                        <>
                                            <select
                                                value={selectedBookingId}
                                                onChange={(e) => setSelectedBookingId(e.target.value)}
                                                required
                                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            >
                                                {activeBookings.map((b) => (
                                                    <option key={b.id} value={b.id}>
                                                        {b.display_label}
                                                    </option>
                                                ))}
                                            </select>
                                            <span className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
                                                <Check className="w-3 h-3 text-emerald-600" />
                                                Đang phục vụ tận phòng cho đơn lưu trú của quý khách.
                                            </span>
                                        </>
                                    ) : (
                                        <div className="space-y-2.5">
                                            <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-xs text-amber-950 flex items-start gap-2.5">
                                                <BedDouble className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                                <div className="space-y-0.5">
                                                    <p className="font-bold text-amber-900">Dành cho Khách lưu trú & Khách theo đoàn</p>
                                                    <p className="text-[11px] text-amber-800 leading-relaxed">
                                                        Quý khách vui lòng nhập <strong>Mã Đặt phòng (Mã Booking)</strong> in trên bìa thẻ phòng (Keycard) hoặc phiếu nhận phòng của bạn để hệ thống phục vụ trực tiếp tới phòng.
                                                    </p>
                                                </div>
                                            </div>
                                            <input
                                                type="text"
                                                value={selectedBookingId}
                                                onChange={(e) => setSelectedBookingId(e.target.value.toUpperCase())}
                                                placeholder="Nhập Mã Booking (VD: BK-02DE4E)"
                                                required
                                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 uppercase tracking-wider shadow-2xs"
                                            />
                                        </div>
                                    )}
                                    <span className="text-[10px] text-slate-400 mt-1 block">
                                        Chi phí dịch vụ sẽ được tính trực tiếp vào hóa đơn của phòng khi Check-out.
                                    </span>
                                </div>

                                {/* HÀNG 2: CHỌN SỐ LƯỢNG (QUANTITY) & TẠM TÍNH */}
                                <div className="grid grid-cols-2 gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                            Số lượng:
                                        </label>
                                        <div className="inline-flex items-center border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
                                            <button
                                                type="button"
                                                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                                className="px-3 py-2 text-slate-600 hover:bg-slate-100 font-bold transition flex items-center justify-center cursor-pointer"
                                            >
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <span className="px-4 py-1.5 text-xs font-bold text-slate-900 border-x border-slate-200">
                                                {quantity}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                                                className="px-3 py-2 text-slate-600 hover:bg-slate-100 font-bold transition flex items-center justify-center cursor-pointer"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <span className="text-[10px] text-slate-400 block font-medium">Tổng tiền dịch vụ:</span>
                                        <div className="text-lg font-black text-rose-600">
                                            {(Number(selectedItem.price) * quantity).toLocaleString('vi-VN')}
                                            <span className="text-xs font-normal text-slate-400 ml-1">VND</span>
                                        </div>
                                    </div>
                                </div>

                                {/* HÀNG 3: THỜI GIAN PHỤC VỤ (GIAO NGAY HOẶC HẸN GIỜ) */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                                        <span>Thời gian phục vụ</span>
                                        {deliveryMode === 'scheduled' && scheduledDateTime && (
                                            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                                Hẹn giao: {new Date(scheduledDateTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(scheduledDateTime).toLocaleDateString('vi-VN')}
                                            </span>
                                        )}
                                    </label>

                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDeliveryMode('now');
                                                setScheduledDateTime('');
                                            }}
                                            className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                                                deliveryMode === 'now'
                                                    ? 'bg-amber-50/90 border-amber-400 text-amber-950 font-bold ring-1 ring-amber-300'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                deliveryMode === 'now' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                <Zap className="w-3.5 h-3.5" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold leading-tight">Giao ngay</div>
                                                <div className="text-[10px] text-slate-400 font-normal">Bếp làm luôn khi nhận đơn</div>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDeliveryMode('scheduled');
                                                if (!scheduledDateTime) {
                                                    const d = new Date(Date.now() + 30 * 60 * 1000);
                                                    setScheduledDateTime(formatToLocalDateTimeString(d));
                                                }
                                            }}
                                            className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 cursor-pointer ${
                                                deliveryMode === 'scheduled'
                                                    ? 'bg-amber-50/90 border-amber-400 text-amber-950 font-bold ring-1 ring-amber-300'
                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                deliveryMode === 'scheduled' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                <Clock className="w-3.5 h-3.5" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold leading-tight">Hẹn giờ giao</div>
                                                <div className="text-[10px] text-slate-400 font-normal">Đặt trước theo giờ ăn của bạn</div>
                                            </div>
                                        </button>
                                    </div>

                                    {deliveryMode === 'scheduled' && (
                                        <div className="mt-2.5 p-3 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-2.5">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="text-[10px] text-slate-500 font-semibold">Chọn nhanh:</span>
                                                {[
                                                    { label: '+15 phút', mins: 15 },
                                                    { label: '+30 phút', mins: 30 },
                                                    { label: '+45 phút', mins: 45 },
                                                    { label: '+1 giờ', mins: 60 },
                                                    { label: '+2 giờ', mins: 120 }
                                                ].map((item) => (
                                                    <button
                                                        key={item.label}
                                                        type="button"
                                                        onClick={() => {
                                                            const d = new Date(Date.now() + item.mins * 60 * 1000);
                                                            setScheduledDateTime(formatToLocalDateTimeString(d));
                                                        }}
                                                        className="px-2 py-1 rounded-lg bg-white hover:bg-amber-100 border border-slate-200 text-slate-700 text-[10px] font-semibold transition cursor-pointer"
                                                    >
                                                        {item.label}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <label className="text-[11px] font-bold text-slate-700 shrink-0">
                                                    Thời điểm hẹn giao:
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    value={scheduledDateTime}
                                                    min={formatToLocalDateTimeString(new Date())}
                                                    onChange={(e) => setScheduledDateTime(e.target.value)}
                                                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                                />
                                            </div>

                                            <p className="text-[10px] text-amber-800/80 italic">
                                                * Nhân viên sẽ chuẩn bị và giao món tận phòng đúng theo khung giờ quý khách đã chọn.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* HÀNG 4: GHI CHÚ YÊU CẦU RIÊNG */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Ghi chú phục vụ riêng (Tùy chọn)
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        placeholder="Ví dụ: Mang lên lúc 19:30, ít đường, nhiều đá, khăn tắm thêm, sốt để riêng..."
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                    ></textarea>
                                </div>

                                {/* Modal Actions */}
                                <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={handleCloseOrderModal}
                                        disabled={isSubmitting}
                                        className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition cursor-pointer"
                                    >
                                        Đóng
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-white text-xs font-bold shadow-lg shadow-amber-500/25 transition flex items-center gap-2 cursor-pointer"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                <span>Đang gửi yêu cầu...</span>
                                            </>
                                        ) : (
                                            <>
                                                <BellRing className="w-4 h-4" />
                                                <span>Xác nhận gửi yêu cầu</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {/* FLOATING ACTION BUTTON XEM LỊCH SỬ ĐẶT MÓN & DỊCH VỤ */}
                <button
                    type="button"
                    onClick={() => {
                        const targetBooking = !isAuthenticated ? sessionStorage.getItem('pms_guest_booking_code') : null;
                        if (!isAuthenticated && !targetBooking) {
                            showToast('error', 'Quý khách vui lòng đặt dịch vụ với Mã Booking trên thẻ phòng để theo dõi lịch sử.');
                            return;
                        }
                        fetchOrderHistory(false, targetBooking);
                        setIsHistoryModalOpen(true);
                    }}
                    className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40 px-4 py-3 rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-2xl border border-slate-700/60 font-bold text-xs flex items-center gap-2.5 transition transform hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md group"
                    title="Xem lịch sử dịch vụ & tiến độ xử lý"
                >
                    <History className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
                    <span>Lịch Sử Dịch Vụ</span>
                    {activeOrdersCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black animate-bounce shadow-xs">
                            {activeOrdersCount} đang xử lý
                        </span>
                    ) : orderHistory.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-700 text-white text-[10px] font-bold">
                            {orderHistory.length}
                        </span>
                    ) : null}
                </button>

                {/* MODAL LỊCH SỬ ĐẶT MÓN & TRẠNG THÁI XỬ LÝ */}
                {isHistoryModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
                            {/* Modal Header */}
                            <div className="bg-white text-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-200/80">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-xl shrink-0 border border-amber-200/60 shadow-xs">
                                        <History className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-serif text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                                            <span>Lịch Sử Đặt Món & Dịch Vụ Tại Phòng</span>
                                            {activeOrdersCount > 0 && (
                                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase shadow-xs">
                                                    {activeOrdersCount} đang xử lý
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            Theo dõi thời gian thực tiến độ tiếp nhận, chuẩn bị và phục vụ dịch vụ tận phòng của bạn.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => fetchOrderHistory()}
                                        disabled={isLoadingHistory}
                                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        title="Làm mới trạng thái"
                                    >
                                        <RotateCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin text-amber-600' : 'text-slate-600'}`} />
                                        <span className="hidden sm:inline">Làm mới</span>
                                    </button>
                                    {!isAuthenticated && sessionStorage.getItem('pms_guest_booking_code') && (
                                        <button
                                            type="button"
                                            onClick={handleClearGuestSession}
                                            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center gap-1 transition cursor-pointer"
                                            title="Xóa phiên lưu trữ mã phòng này trên thiết bị này"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                            <span className="hidden sm:inline">Xóa phiên</span>
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setIsHistoryModalOpen(false)}
                                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center cursor-pointer"
                                        title="Đóng"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Filter Tabs */}
                            <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto scrollbar-none">
                                {[
                                    { key: 'all', label: 'Tất cả', icon: Layers, count: historyStats.total },
                                    { key: 'pending', label: 'Chờ xác nhận', icon: Clock, count: historyStats.pending },
                                    { key: 'in_progress', label: 'Đang chuẩn bị', icon: Utensils, count: historyStats.inProgress },
                                    { key: 'delivering', label: 'Đang phục vụ', icon: BellRing, count: historyStats.delivering },
                                    { key: 'completed', label: 'Hoàn thành', icon: CheckCircle2, count: historyStats.completed },
                                    { key: 'cancelled', label: 'Đã hủy', icon: XCircle, count: historyStats.cancelled }
                                ].map((tab) => {
                                    const IconComponent = tab.icon;
                                    const isActive = historyFilter === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            onClick={() => setHistoryFilter(tab.key)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                                isActive
                                                    ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-800'
                                                    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                                            }`}
                                        >
                                            <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                                            <span>{tab.label}</span>
                                            <span
                                                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                                    isActive
                                                        ? 'bg-white/20 text-white'
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {tab.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Modal Body / Request List */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                                {isLoadingHistory && orderHistory.length === 0 ? (
                                    <div className="py-16 text-center space-y-3">
                                        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                        <p className="text-xs font-semibold text-slate-500">Đang tải lịch sử dịch vụ...</p>
                                    </div>
                                ) : sortedHistory.length === 0 ? (
                                    <div className="py-16 text-center space-y-3 max-w-sm mx-auto">
                                        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/60 shadow-inner">
                                            <Receipt className="w-7 h-7 text-amber-600" />
                                        </div>
                                        <h4 className="font-serif text-base font-bold text-slate-900">
                                            {historyFilter === 'all'
                                                ? 'Bạn chưa có yêu cầu dịch vụ nào'
                                                : `Không có yêu cầu nào ở mục "${
                                                      historyFilter === 'pending'
                                                          ? 'Chờ xác nhận'
                                                          : historyFilter === 'in_progress'
                                                          ? 'Đang chuẩn bị'
                                                          : historyFilter === 'delivering'
                                                          ? 'Đang phục vụ'
                                                          : historyFilter === 'completed'
                                                          ? 'Hoàn thành'
                                                          : 'Đã hủy'
                                                  }"`}
                                        </h4>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            Khám phá danh mục dịch vụ & ẩm thực phong phú của chúng tôi để được phục vụ chu đáo tận phòng nghỉ.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setIsHistoryModalOpen(false)}
                                            className="mt-2 px-5 py-2.5 bg-slate-900 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition shadow-md shadow-slate-900/15 cursor-pointer"
                                        >
                                            Xem Menu ngay
                                        </button>
                                    </div>
                                ) : (
                                    paginatedHistory.map((item) => {
                                        const isPending = item.status === 'pending';
                                        const isInProgress = item.status === 'in_progress';
                                        const isDelivering = item.status === 'delivering';
                                        const isCompleted = item.status === 'completed';
                                        const isCancelled = item.status === 'cancelled';
                                        const priceNum = Number(item.total_price || (item.service_price * item.quantity)) || 0;
                                        const labels = getServiceLabels(item.service_name, item.category_name);

                                        // Xác định bước tiến trình (1: Tiếp nhận, 2: Chuẩn bị, 3: Đang giao, 4: Hoàn thành)
                                        const currentStep = isCompleted ? 4 : isDelivering ? 3 : isInProgress ? 2 : 1;
                                        const progressPercent = isCompleted ? 100 : isDelivering ? 68 : isInProgress ? 34 : 0;

                                        return (
                                            <div
                                                key={item.id}
                                                className="bg-white rounded-2xl border border-slate-200/90 hover:border-amber-200 hover:shadow-md transition overflow-hidden shadow-2xs"
                                            >
                                                {/* Thẻ Header: Mã đơn + Phòng + Trạng thái */}
                                                <div className="bg-slate-50/80 px-4 sm:px-5 py-2.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-slate-800">
                                                            #SRQ-{item.id}
                                                        </span>
                                                        <span className="text-slate-300">•</span>
                                                        <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-slate-200/80 flex items-center gap-1.5 shadow-2xs">
                                                            <BedDouble className="w-3.5 h-3.5 text-amber-600" />
                                                            Phòng {item.room_number || 'Lưu trú'}
                                                        </span>
                                                        {item.booking_code && (
                                                            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                                                                (Mã #{item.booking_code})
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] text-slate-400 hidden sm:inline flex items-center gap-1">
                                                            <Clock className="w-3 h-3 text-slate-400" />
                                                            {formatDateTimeDisplay(item.created_at || item.request_time)}
                                                        </span>
                                                        {/* Status Badge */}
                                                        {isPending && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                                {labels.badgePending}
                                                            </span>
                                                        )}
                                                        {isInProgress && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping"></span>
                                                                {labels.badgeInProgress}
                                                            </span>
                                                        )}
                                                        {isDelivering && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping"></span>
                                                                {labels.badgeDelivering}
                                                            </span>
                                                        )}
                                                        {isCompleted && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                                {labels.badgeCompleted}
                                                            </span>
                                                        )}
                                                        {isCancelled && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                                                Đã hủy
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Body thẻ: Dịch vụ + Chi tiết */}
                                                <div className="p-4 sm:p-5">
                                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                                        <div className="flex items-center gap-3.5 flex-1">
                                                            {item.service_image ? (
                                                                <img
                                                                    src={item.service_image}
                                                                    alt={item.service_name}
                                                                    className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                                                                    onError={(e) => {
                                                                        e.target.src =
                                                                            'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=200&q=80';
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="w-16 h-16 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl shrink-0 border border-amber-200/60 shadow-2xs">
                                                                    {item.category_icon || '🛎️'}
                                                                </div>
                                                            )}

                                                            <div className="space-y-1">
                                                                <h4 className="font-bold text-slate-900 text-sm">
                                                                    {item.service_name}
                                                                </h4>
                                                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                                                                        {item.category_name || 'Dịch vụ phòng'}
                                                                    </span>
                                                                    <span>•</span>
                                                                    <span className="font-bold text-slate-900">
                                                                        Số lượng: x{item.quantity}
                                                                    </span>
                                                                    {item.service_price && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span className="text-slate-400 text-[11px]">
                                                                                ({Number(item.service_price).toLocaleString('vi-VN')} đ/lần)
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                {item.is_scheduled && item.request_time && (
                                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-300">
                                                                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                                                                        <span>Hẹn giao: {formatDateTimeDisplay(item.request_time)}</span>
                                                                    </div>
                                                                )}
                                                                {item.note && (
                                                                    <div className="text-[11px] text-amber-900 bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-200/60 italic">
                                                                        Ghi chú: "{item.note}"
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="text-left sm:text-right shrink-0">
                                                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                                                                Thành tiền
                                                            </span>
                                                            <div className="text-base font-black text-rose-600">
                                                                {priceNum.toLocaleString('vi-VN')}{' '}
                                                                <span className="text-xs font-bold text-slate-500">VND</span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 block">
                                                                (Tính vào hóa đơn phòng)
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* THANH TIẾN ĐỘ TRẠNG THÁI XỬ LÝ (INTERACTIVE STEPPER - 4 BƯỚC) */}
                                                    <div className="mt-5 pt-4 border-t border-slate-100">
                                                        {!isCancelled ? (
                                                            <div className="space-y-3">
                                                                {/* Interactive Step Timeline */}
                                                                <div className="relative flex items-center justify-between px-2 pt-1 pb-1">
                                                                    {/* Background Track Line */}
                                                                    <div className="absolute top-4 left-6 right-6 h-1 bg-slate-100 rounded-full z-0" />
                                                                    
                                                                    {/* Active Fill Line */}
                                                                    <div 
                                                                        className="absolute top-4 left-6 h-1 bg-gradient-to-r from-amber-500 via-amber-600 to-emerald-500 rounded-full z-0 transition-all duration-700 ease-out"
                                                                        style={{ width: `calc(${progressPercent}% * (100% - 48px) / 100)` }}
                                                                    />

                                                                    {/* 4 Step Nodes */}
                                                                    {[
                                                                        { num: 1, label: labels.step1 },
                                                                        { num: 2, label: labels.step2 },
                                                                        { num: 3, label: labels.step3 },
                                                                        { num: 4, label: labels.step4 },
                                                                    ].map((step) => {
                                                                        const isPassed = currentStep > step.num;
                                                                        const isCurrent = currentStep === step.num;
                                                                        return (
                                                                            <div key={step.num} className="relative z-10 flex flex-col items-center">
                                                                                <div
                                                                                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                                                                                        isPassed
                                                                                            ? 'bg-emerald-500 text-white shadow-xs ring-4 ring-emerald-50'
                                                                                            : isCurrent
                                                                                            ? isCompleted
                                                                                                ? 'bg-emerald-500 text-white shadow-md ring-4 ring-emerald-100'
                                                                                                : 'bg-amber-500 text-white shadow-md ring-4 ring-amber-100 scale-105 font-black'
                                                                                            : 'bg-white text-slate-400 border-2 border-slate-200'
                                                                                    }`}
                                                                                >
                                                                                    {isPassed || (isCurrent && isCompleted) ? (
                                                                                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                                                                    ) : (
                                                                                        <span>{step.num}</span>
                                                                                    )}
                                                                                </div>
                                                                                <span
                                                                                    className={`mt-1.5 text-[10px] sm:text-[11px] font-semibold text-center whitespace-nowrap transition-colors ${
                                                                                        isCurrent
                                                                                            ? isCompleted
                                                                                                ? 'text-emerald-700 font-bold'
                                                                                                : 'text-amber-800 font-bold'
                                                                                            : isPassed
                                                                                            ? 'text-slate-700 font-medium'
                                                                                            : 'text-slate-400'
                                                                                    }`}
                                                                                >
                                                                                    {step.label}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>

                                                                {/* Thông báo trạng thái chi tiết & nút Hủy đơn */}
                                                                <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-all ${
                                                                    isCompleted
                                                                        ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900'
                                                                        : 'bg-amber-50/70 border-amber-200/80 text-amber-950'
                                                                }`}>
                                                                    <div className="flex items-center gap-2">
                                                                        {isCompleted ? (
                                                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                                        ) : (
                                                                            <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                                                                        )}
                                                                        <span className="font-medium text-[11px] sm:text-xs">
                                                                            {isPending && labels.pendingMessage}
                                                                            {isInProgress && labels.inProgressMessage}
                                                                            {isDelivering && labels.deliveringMessage}
                                                                            {isCompleted && labels.completedMessage}
                                                                        </span>
                                                                    </div>

                                                                    {/* Nút Hủy nếu đang Pending */}
                                                                    {isPending && (
                                                                        <button
                                                                            type="button"
                                                                            disabled={cancellingRequestId === item.id}
                                                                            onClick={() => handleCancelOrder(item)}
                                                                            className="self-end sm:self-auto px-2.5 py-1 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-100/60 border border-rose-200 text-[11px] font-bold transition cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                                                        >
                                                                            <X className="w-3 h-3" />
                                                                            <span>{cancellingRequestId === item.id ? 'Đang hủy...' : 'Hủy yêu cầu'}</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50/80 p-3 rounded-xl border border-rose-200">
                                                                <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                                                                <span>Yêu cầu đã được hủy bỏ. Dịch vụ không thực hiện và không phát sinh bất kỳ chi phí nào.</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Phân trang lịch sử đơn đặt món */}
                            {totalHistoryPages > 1 && (
                                <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                                    <div className="text-slate-500 font-medium text-[11px]">
                                        Hiển thị trang <strong className="text-slate-800">{historyPage}</strong> / {totalHistoryPages} ({sortedHistory.length} đơn)
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            disabled={historyPage <= 1}
                                            onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                                            className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1"
                                        >
                                            <ChevronLeft className="w-3 h-3" />
                                            <span>Trước</span>
                                        </button>
                                        {Array.from({ length: totalHistoryPages }, (_, i) => i + 1).map((p) => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setHistoryPage(p)}
                                                className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                                                    historyPage === p
                                                        ? 'bg-slate-900 text-white shadow-xs'
                                                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            disabled={historyPage >= totalHistoryPages}
                                            onClick={() => setHistoryPage((prev) => Math.min(totalHistoryPages, prev + 1))}
                                            className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1"
                                        >
                                            <span>Sau</span>
                                            <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Modal Footer */}
                            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2 text-slate-600 text-[11px] sm:text-xs">
                                    <PhoneCall className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>
                                        Cần hỗ trợ khẩn cấp, vui lòng bấm phím <strong className="text-slate-900 font-black">0</strong> trên điện thoại bàn phòng.
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsHistoryModalOpen(false)}
                                    className="w-full sm:w-auto px-6 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition shadow-sm cursor-pointer"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL XÁC NHẬN HỦY ĐẶT MÓN / DỊCH VỤ (MODERN WHITE MODAL) */}
                {orderToCancel && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
                        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-2xl max-w-md w-full border border-slate-100 space-y-5 animate-scale-up">
                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200/80">
                                    <AlertCircle className="w-6 h-6 text-rose-600" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-800 tracking-tight">
                                        Hủy Yêu Cầu Dịch Vụ
                                    </h3>
                                    <p className="text-xs font-semibold text-slate-400">
                                        Xác nhận hủy đơn đặt món / dịch vụ tận phòng
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                                <div className="flex justify-between items-center text-slate-600">
                                    <span className="font-medium">Dịch vụ yêu cầu:</span>
                                    <span className="font-bold text-slate-800">{orderToCancel.service_name || orderToCancel.custom_service_name || 'Dịch vụ'}</span>
                                </div>
                                {orderToCancel.quantity && (
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span className="font-medium">Số lượng:</span>
                                        <span className="font-bold text-slate-800">x{orderToCancel.quantity}</span>
                                    </div>
                                )}
                                {orderToCancel.booking_code && (
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span className="font-medium">Mã phòng / đơn:</span>
                                        <span className="font-mono font-bold text-amber-700">#{orderToCancel.booking_code}</span>
                                    </div>
                                )}
                            </div>

                            <div className="text-xs text-amber-950 leading-relaxed bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 flex items-start gap-2">
                                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <span>Quý khách có chắc chắn muốn hủy yêu cầu này? Sau khi hủy, yêu cầu sẽ không được xử lý và không phát sinh bất kỳ khoản phí nào.</span>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    disabled={cancellingRequestId === orderToCancel.id}
                                    onClick={() => setOrderToCancel(null)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                                >
                                    Giữ Lại
                                </button>
                                <button
                                    type="button"
                                    disabled={cancellingRequestId === orderToCancel.id}
                                    onClick={executeCancelOrder}
                                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 transition cursor-pointer flex items-center gap-1.5"
                                >
                                    {cancellingRequestId === orderToCancel.id ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Đang hủy...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Xác Nhận Hủy</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Footer />
        </div>
    );
}
