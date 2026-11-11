import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import hotelService from '../../services/hotelService';
import { useAuth } from '../../store/authStore';
import { useHotelSettings } from '../../store/hotelSettingStore';
import {
    ServiceSuccessModal,
    ServiceOrderModal,
    ServiceCartModal,
    ServiceHistoryModal,
    ServiceCancelModal
} from '../../components/client/services';
import {
    Utensils,
    LayoutGrid,
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
    Zap,
    Loader2,
    ShoppingBag,
    ShoppingCart,
    UtensilsCrossed,
    Wine,
    Flower2,
    Car,
    Shirt,
    Tag
} from 'lucide-react';

// Helper hiển thị icon đại diện chuẩn 5 sao cho danh mục dịch vụ khách sạn
const renderCategoryIcon = (categoryName, iconStr, className = 'w-3.5 h-3.5') => {
    const text = `${categoryName || ''} ${iconStr || ''}`.toLowerCase();
    if (text.includes('ẩm thực') || text.includes('ăn') || text.includes('dining') || text.includes('món') || text.includes('bò') || text.includes('súp') || text.includes('phở') || text.includes('fnb') || text.includes('buffet') || text.includes('bếp')) {
        return <UtensilsCrossed className={className} />;
    }
    if (text.includes('uống') || text.includes('bar') || text.includes('rượu') || text.includes('trà') || text.includes('cà phê') || text.includes('nước') || text.includes('cocktail') || text.includes('beverage')) {
        return <Wine className={className} />;
    }
    if (text.includes('spa') || text.includes('massage') || text.includes('trị liệu') || text.includes('thư giãn') || text.includes('sức khỏe') || text.includes('wellness')) {
        return <Flower2 className={className} />;
    }
    if (text.includes('xe') || text.includes('đưa đón') || text.includes('sân bay') || text.includes('tour') || text.includes('du lịch') || text.includes('transport') || text.includes('limousine')) {
        return <Car className={className} />;
    }
    if (text.includes('giặt') || text.includes('ủi') || text.includes('laundry')) {
        return <Shirt className={className} />;
    }
    if (text.includes('phòng') || text.includes('buồng') || text.includes('concierge') || text.includes('tiện ích') || text.includes('room')) {
        return <BellRing className={className} />;
    }
    return <Tag className={className} />;
};

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
    const location = useLocation();
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

    // 3b. Giỏ dịch vụ đặt nhiều món cùng lúc (Multi-item Cart)
    const [cart, setCart] = useState(() => {
        try {
            const saved = sessionStorage.getItem('pms_service_cart');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [isCartModalOpen, setIsCartModalOpen] = useState(false);
    const [cartBookingId, setCartBookingId] = useState('');
    const [cartDeliveryMode, setCartDeliveryMode] = useState('now'); // 'now' | 'scheduled'
    const [cartScheduledDateTime, setCartScheduledDateTime] = useState('');
    const [cartGeneralNote, setCartGeneralNote] = useState('');
    const [isSubmittingCart, setIsSubmittingCart] = useState(false);

    // Lưu giỏ hàng vào sessionStorage khi thay đổi
    useEffect(() => {
        try {
            sessionStorage.setItem('pms_service_cart', JSON.stringify(cart));
        } catch {}
    }, [cart]);

    // Đồng bộ phòng/mã booking cho giỏ hàng
    useEffect(() => {
        if (activeBookings.length > 0 && !cartBookingId) {
            setCartBookingId(String(activeBookings[0].id));
        } else if (!cartBookingId) {
            const savedCode = sessionStorage.getItem('pms_guest_booking_code');
            if (savedCode) setCartBookingId(savedCode);
        }
    }, [activeBookings]);

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
                showToast('success', 'Đơn dịch vụ của bạn đang được phục vụ / chuyển tới phòng!');
            } else if (e?.detail?.status === 'completed') {
                showToast('success', 'Đơn dịch vụ của bạn đã hoàn thành!');
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
                        showToast('success', 'Đơn dịch vụ của bạn đang được phục vụ / chuyển tới phòng!');
                    } else if (data?.status === 'completed') {
                        showToast('success', 'Đơn dịch vụ của bạn đã hoàn thành!');
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

    // Tự động mở modal lịch sử dịch vụ hoặc tự động chọn món khi điều hướng từ AI Chatbot / Chuông thông báo
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('history') === 'true' || params.get('tab') === 'history' || location.state?.openHistory) {
            const targetBooking = !isAuthenticated ? sessionStorage.getItem('pms_guest_booking_code') : null;
            fetchOrderHistory(false, targetBooking);
            setIsHistoryModalOpen(true);
        }
        const qParam = params.get('q') || location.state?.serviceName;
        if (qParam) {
            setSearchQuery(qParam);
        }
        const srvId = params.get('serviceId') || location.state?.serviceId;
        if (srvId && serviceItems.length > 0) {
            const matched = serviceItems.find((it) => String(it.id) === String(srvId));
            if (matched) {
                setSelectedItem(matched);
                setQuantity(1);
            }
        }
    }, [location.search, location.state, isAuthenticated, serviceItems]);

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

    // Các hàm thao tác Giỏ dịch vụ (Multi-item Cart)
    const addToCart = (item, qty = 1) => {
        setCart((prevCart) => {
            const existingIndex = prevCart.findIndex((ci) => ci.id === item.id);
            if (existingIndex > -1) {
                const updated = [...prevCart];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    quantity: Math.min(99, updated[existingIndex].quantity + qty)
                };
                return updated;
            }
            return [
                ...prevCart,
                {
                    id: item.id,
                    name: item.name,
                    price: Number(item.price) || 0,
                    category_name: item.category_name,
                    display_image: item.display_image || item.image_url,
                    quantity: qty,
                    note: ''
                }
            ];
        });
        showToast('success', `Đã thêm "${item.name}" vào giỏ dịch vụ!`);
    };

    const updateCartQuantity = (itemId, val, isDelta = false) => {
        setCart((prevCart) => {
            return prevCart
                .map((ci) => {
                    if (ci.id === itemId) {
                        const newQty = isDelta ? ci.quantity + val : val;
                        return { ...ci, quantity: Math.min(99, newQty) };
                    }
                    return ci;
                })
                .filter((ci) => ci.quantity > 0);
        });
    };

    const removeFromCart = (itemId) => {
        setCart((prevCart) => prevCart.filter((ci) => ci.id !== itemId));
        showToast('info', 'Đã xóa món khỏi giỏ.');
    };

    const updateCartItemNote = (itemId, noteText) => {
        setCart((prevCart) => {
            return prevCart.map((ci) => (ci.id === itemId ? { ...ci, note: noteText } : ci));
        });
    };

    const clearCart = () => {
        setCart([]);
        try {
            sessionStorage.removeItem('pms_service_cart');
        } catch {}
    };

    const totalCartCount = useMemo(
        () => cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0),
        [cart]
    );

    const totalCartPrice = useMemo(
        () => cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0),
        [cart]
    );

    // Gửi toàn bộ đơn dịch vụ trong Giỏ hàng một lúc (Multi-item batch order)
    const handleConfirmCartOrder = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (cart.length === 0) {
            showToast('error', 'Giỏ dịch vụ của quý khách đang trống.');
            return;
        }

        const bookingKey = (cartBookingId || selectedBookingId || '').trim().toUpperCase();
        if (!bookingKey) {
            showToast('error', 'Vui lòng chọn hoặc nhập Mã Đặt phòng (VD: BK-02DE4E) in trên thẻ phòng.');
            return;
        }

        if (cartDeliveryMode === 'scheduled' && !cartScheduledDateTime) {
            showToast('error', 'Vui lòng chọn ngày và giờ hẹn giao món / dịch vụ.');
            return;
        }

        try {
            setIsSubmittingCart(true);
            const isScheduled = cartDeliveryMode === 'scheduled';
            const itemsPayload = cart.map((ci) => ({
                service_id: ci.id,
                quantity: ci.quantity,
                note: ci.note?.trim() || ''
            }));

            const payload = {
                booking_id: bookingKey,
                items: itemsPayload,
                note: cartGeneralNote.trim(),
                is_scheduled: isScheduled,
                ...(isScheduled && cartScheduledDateTime ? { request_time: new Date(cartScheduledDateTime).toISOString() } : {})
            };

            const res = await hotelService.createServiceRequest(payload);

            if (res && res.success) {
                sessionStorage.setItem('pms_guest_booking_code', bookingKey);

                const targetBooking = activeBookings.find(
                    (b) => String(b.id) === String(cartBookingId) || b.booking_code === bookingKey
                );
                const roomNum = res.data?.room_number || res.room_number || targetBooking?.room_number || 'phòng lưu trú';

                setSuccessOrderInfo({
                    serviceName: cart.map((c) => `${c.name} (x${c.quantity})`).join(', '),
                    quantity: totalCartCount,
                    totalPrice: totalCartPrice,
                    roomNumber: roomNum,
                    bookingCode: bookingKey,
                    isBatch: true,
                    itemsList: [...cart]
                });

                clearCart();
                setIsCartModalOpen(false);
                fetchOrderHistory(true, bookingKey);
                showToast('success', res.message || `Đã gửi thành công ${cart.length} món/dịch vụ tới phòng ${roomNum}!`);
            } else {
                showToast('error', res?.message || 'Không thể gửi đơn dịch vụ. Vui lòng kiểm tra lại mã phòng.');
            }
        } catch (error) {
            console.error('Lỗi khi gửi đơn giỏ hàng:', error);
            showToast('error', 'Đã xảy ra lỗi khi gửi yêu cầu. Vui lòng kiểm tra lại kết nối mạng.');
        } finally {
            setIsSubmittingCart(false);
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
            const bookingCodeArg = orderToCancel.booking_code || sessionStorage.getItem('pms_guest_booking_code') || null;
            const res = await hotelService.cancelServiceRequest(requestId, bookingCodeArg);
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
                fetchOrderHistory(true);
                setOrderToCancel(null);
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

    // Tự động đồng bộ 2 chiều (Polling 6s) khi có đơn đang xử lý hoặc đang mở Modal theo dõi tiến trình
    // Giúp thanh tiến trình 4 bước và nút Hủy cập nhật tức thì khi Nhân viên thao tác trên App Mobile
    useEffect(() => {
        if (!isHistoryModalOpen && activeOrdersCount === 0) return;
        const interval = setInterval(() => {
            if (!document.hidden) {
                fetchOrderHistory(true);
            }
        }, 6000);
        return () => clearInterval(interval);
    }, [isHistoryModalOpen, activeOrdersCount, isAuthenticated]);

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
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-sky-600 selection:text-white flex flex-col justify-between">
            <div>
                <Navbar />

                {/* BREADCRUMB */}
                <div className="bg-white border-b border-slate-100 py-3">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <nav className="flex items-center space-x-2 text-xs text-slate-500 whitespace-nowrap overflow-x-auto no-scrollbar">
                            <Link to="/" className="hover:text-amber-600 transition shrink-0">Trang chủ</Link>
                            <span className="text-slate-300 shrink-0">/</span>
                            <span className="text-slate-900 font-semibold truncate min-w-0">Menu Dịch Vụ Tại Phòng</span>
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
                                                className="px-3 py-1 rounded-lg bg-gradient-to-r from-sky-600 to-blue-700 text-white font-semibold text-[11px] shadow-xs"
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

                {/* TOAST THÔNG BÁO (Đưa lên góc trên, không che đè lên AI Chatbot ở góc dưới) */}
                {toast && (
                    <div className="fixed top-20 left-4 right-4 sm:left-auto sm:right-6 z-50 max-w-md animate-in fade-in slide-in-from-top-3 duration-300">
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
                <ServiceSuccessModal
                    orderInfo={successOrderInfo}
                    onClose={() => setSuccessOrderInfo(null)}
                />

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
                                        ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md shadow-sky-900/20 ring-1 ring-sky-500'
                                        : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 shadow-2xs'
                                }`}
                            >
                                <LayoutGrid className={`w-3.5 h-3.5 ${selectedCategory === 'all' ? 'text-white' : 'text-slate-400'}`} />
                                <span>Tất cả ({serviceItems.length})</span>
                            </button>

                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                                        String(selectedCategory) === String(cat.id)
                                            ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md shadow-sky-900/20 ring-1 ring-sky-500'
                                            : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 shadow-2xs'
                                    }`}
                                >
                                    {renderCategoryIcon(cat.name, cat.icon, `w-3.5 h-3.5 ${String(selectedCategory) === String(cat.id) ? 'text-amber-200' : 'text-slate-400'}`)}
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

                        {/* Ô tìm kiếm món & Nút Giỏ hàng */}
                        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
                            <div className="relative flex-1 md:w-72">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Tìm món ăn, đồ uống, spa, tiện ích..."
                                    className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-2xs transition"
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
                                className="mt-3 px-5 py-2.5 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 active:scale-95 text-white rounded-xl text-xs font-bold transition shadow-md shadow-sky-900/20 cursor-pointer"
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
                                const inCart = cart.find((c) => c.id === item.id);

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
                                                    {renderCategoryIcon(item.category_name, item.category_icon, 'w-3 h-3 text-amber-600')}
                                                    <span>{item.category_name}</span>
                                                </span>

                                                {/* Badge trạng thái đã thêm vào giỏ */}
                                                {inCart && (
                                                    <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black shadow-md border border-amber-300 flex items-center gap-1 animate-scale-up">
                                                        <Check className="w-3 h-3 text-slate-950 stroke-[3]" />
                                                        <span>Đã chọn ({inCart.quantity})</span>
                                                    </span>
                                                )}
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
                                        <div className="px-5 pb-5 pt-3.5 border-t border-slate-100 space-y-2.5">
                                            {/* Hàng 1: Đơn giá & Trạng thái giỏ */}
                                            <div className="flex items-baseline justify-between gap-2">
                                                <div>
                                                    <span className="text-[10px] text-slate-400 block font-medium">Đơn giá</span>
                                                    <div className="text-base font-black text-rose-600 tracking-tight">
                                                        {priceNum === 0 ? (
                                                            <span className="text-emerald-600 font-bold text-sm">Miễn phí</span>
                                                        ) : (
                                                            <>
                                                                {priceNum.toLocaleString('vi-VN')}
                                                                <span className="text-[11px] font-semibold text-slate-400 ml-1">VND</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {inCart && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-300 text-sky-900 text-[11px] font-bold shadow-2xs shrink-0">
                                                        <Check className="w-3 h-3 text-sky-600 stroke-[3]" />
                                                        Trong giỏ: {inCart.quantity}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Hàng 2: Nút thao tác (Không bao giờ bị tràn lề) */}
                                            {inCart ? (
                                                <div className="grid grid-cols-2 gap-2 pt-0.5">
                                                    <div className="inline-flex items-center justify-between border border-sky-300 rounded-xl bg-sky-50/80 shadow-2xs overflow-hidden h-9">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateCartQuantity(item.id, -1, true)}
                                                            className="w-8 h-full flex items-center justify-center text-sky-900 hover:bg-sky-200/60 transition cursor-pointer"
                                                            title="Giảm 1"
                                                        >
                                                            <Minus className="w-3.5 h-3.5" />
                                                        </button>
                                                        <span className="text-xs font-black text-sky-950 px-1 text-center">
                                                            {inCart.quantity}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateCartQuantity(item.id, 1, true)}
                                                            className="w-8 h-full flex items-center justify-center text-sky-900 hover:bg-sky-200/60 transition cursor-pointer"
                                                            title="Tăng 1"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenOrderModal(item)}
                                                        className="h-9 px-2.5 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 active:scale-95 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-sky-900/20 cursor-pointer"
                                                        title="Gọi riêng món này ngay"
                                                    >
                                                        <Zap className="w-3.5 h-3.5 text-amber-200 fill-amber-200" />
                                                        <span>Đặt ngay</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-2 pt-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => addToCart(item, 1)}
                                                        className="h-9 px-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-300 text-sky-900 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs active:scale-95"
                                                        title="Thêm món này vào giỏ để gọi nhiều món một lúc"
                                                    >
                                                        <Plus className="w-3.5 h-3.5 text-sky-600 stroke-[2.5]" />
                                                        <span>Thêm giỏ</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenOrderModal(item)}
                                                        className="h-9 px-2 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 active:scale-95 text-white text-xs font-bold shadow-md shadow-sky-900/20 transition cursor-pointer flex items-center justify-center gap-1"
                                                        title="Gọi riêng món này ngay lập tức"
                                                    >
                                                        <Zap className="w-3.5 h-3.5 text-amber-200 fill-amber-200" />
                                                        <span>Đặt ngay</span>
                                                    </button>
                                                </div>
                                            )}
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
                                                    ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white border-sky-600 shadow-md shadow-sky-900/20'
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
                <ServiceOrderModal
                    selectedItem={selectedItem}
                    onClose={handleCloseOrderModal}
                    onSubmit={handleConfirmOrder}
                    isSubmitting={isSubmitting}
                    activeBookings={activeBookings}
                    selectedBookingId={selectedBookingId}
                    setSelectedBookingId={setSelectedBookingId}
                    quantity={quantity}
                    setQuantity={setQuantity}
                    deliveryMode={deliveryMode}
                    setDeliveryMode={setDeliveryMode}
                    scheduledDateTime={scheduledDateTime}
                    setScheduledDateTime={setScheduledDateTime}
                    note={note}
                    setNote={setNote}
                    formatToLocalDateTimeString={formatToLocalDateTimeString}
                />

                {/* FLOATING ACTION BUTTON GIỎ DỊCH VỤ (Nhiều món cùng lúc) */}
                {cart.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setIsCartModalOpen(true)}
                        className="fixed bottom-[4.5rem] left-4 sm:bottom-[5.25rem] sm:left-6 z-40 px-4 py-3 rounded-full bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 text-white shadow-xl shadow-sky-900/30 border border-sky-300/40 font-bold text-xs flex items-center gap-2.5 transition transform hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md group"
                        title="Xem giỏ dịch vụ và gửi yêu cầu nhiều món cùng lúc"
                    >
                        <ShoppingBag className="w-4 h-4 text-sky-100 group-hover:rotate-12 transition-transform" />
                        <span>Giỏ Dịch Vụ</span>
                        <span className="px-2 py-0.5 rounded-full bg-white text-sky-800 text-[10px] font-black shadow-xs">
                            {totalCartCount}
                        </span>
                    </button>
                )}

                {/* MODAL GIỎ DỊCH VỤ ĐẶT NHIỀU MÓN CÙNG LÚC */}
                <ServiceCartModal
                    isOpen={isCartModalOpen}
                    onClose={() => setIsCartModalOpen(false)}
                    onSubmit={handleConfirmCartOrder}
                    cart={cart}
                    totalCartCount={totalCartCount}
                    totalCartPrice={totalCartPrice}
                    isSubmittingCart={isSubmittingCart}
                    clearCart={clearCart}
                    updateCartQuantity={updateCartQuantity}
                    removeFromCart={removeFromCart}
                    updateCartItemNote={updateCartItemNote}
                    activeBookings={activeBookings}
                    cartBookingId={cartBookingId}
                    setCartBookingId={setCartBookingId}
                    cartDeliveryMode={cartDeliveryMode}
                    setCartDeliveryMode={setCartDeliveryMode}
                    cartScheduledDateTime={cartScheduledDateTime}
                    setCartScheduledDateTime={setCartScheduledDateTime}
                    cartGeneralNote={cartGeneralNote}
                    setCartGeneralNote={setCartGeneralNote}
                    formatToLocalDateTimeString={formatToLocalDateTimeString}
                />

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
                    className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40 px-4 py-3 rounded-full bg-white text-slate-800 hover:bg-slate-50 shadow-xl border border-slate-200/90 font-bold text-xs flex items-center gap-2.5 transition transform hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md group"
                    title="Xem lịch sử dịch vụ & tiến độ xử lý"
                >
                    <History className="w-4 h-4 text-amber-600 group-hover:rotate-45 transition-transform" />
                    <span>Lịch Sử Dịch Vụ</span>
                    {activeOrdersCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black animate-bounce shadow-xs">
                            {activeOrdersCount} đang xử lý
                        </span>
                    ) : orderHistory.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                            {orderHistory.length}
                        </span>
                    ) : null}
                </button>

                {/* MODAL LỊCH SỬ ĐẶT MÓN & TRẠNG THÁI XỬ LÝ */}
                <ServiceHistoryModal
                    isOpen={isHistoryModalOpen}
                    onClose={() => setIsHistoryModalOpen(false)}
                    activeOrdersCount={activeOrdersCount}
                    fetchOrderHistory={fetchOrderHistory}
                    isLoadingHistory={isLoadingHistory}
                    isAuthenticated={isAuthenticated}
                    handleClearGuestSession={handleClearGuestSession}
                    historyFilter={historyFilter}
                    setHistoryFilter={setHistoryFilter}
                    historyStats={historyStats}
                    orderHistory={orderHistory}
                    sortedHistory={sortedHistory}
                    paginatedHistory={paginatedHistory}
                    totalHistoryPages={totalHistoryPages}
                    historyPage={historyPage}
                    setHistoryPage={setHistoryPage}
                    cancellingRequestId={cancellingRequestId}
                    onCancelOrder={handleCancelOrder}
                />

                {/* MODAL XÁC NHẬN HỦY ĐẶT MÓN / DỊCH VỤ (MODERN WHITE MODAL) */}
                <ServiceCancelModal
                    order={orderToCancel}
                    onClose={() => setOrderToCancel(null)}
                    onConfirm={executeCancelOrder}
                    isCancelling={cancellingRequestId === orderToCancel?.id}
                />
            </div>

            <Footer />
        </div>
    );
}
