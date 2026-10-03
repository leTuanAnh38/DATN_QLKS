import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import hotelService from '../../services/hotelService';
import { useAuth } from '../../store/authStore';

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

export default function ServicesMenu() {
    const { user, isAuthenticated } = useAuth();

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

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    // Tải lịch sử đơn đặt món của khách
    const fetchOrderHistory = async (isSilent = false) => {
        if (!isSilent) setIsLoadingHistory(true);
        try {
            const res = await hotelService.getMyServiceRequests();
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
            const [catRes, itemsRes, bkRes, historyRes] = await Promise.all([
                hotelService.getServiceCategories(),
                hotelService.getServiceItems(),
                hotelService.getMyActiveBookings(),
                hotelService.getMyServiceRequests()
            ]);

            if (catRes.success) setCategories(catRes.categories || []);
            if (itemsRes.success) setServiceItems(itemsRes.items || []);
            if (historyRes.success) setOrderHistory(historyRes.requests || []);
            if (bkRes.success) {
                const bks = bkRes.bookings || [];
                setActiveBookings(bks);
                if (bks.length > 0) {
                    setSelectedBookingId(String(bks[0].id));
                }
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

        const handleServiceEvent = () => {
            fetchOrderHistory(true);
        };

        const handleStorage = (e) => {
            if (e.key === 'pms_service_catalog_changed') {
                loadData();
            }
            if (e.key === 'pms_last_service_event') {
                fetchOrderHistory(true);
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
        }
    };

    // Đóng modal đặt dịch vụ
    const handleCloseOrderModal = () => {
        if (isSubmitting) return;
        setSelectedItem(null);
        setQuantity(1);
        setNote('');
    };

    // Gửi yêu cầu đặt dịch vụ
    const handleConfirmOrder = async (e) => {
        if (e && e.preventDefault) e.preventDefault();

        if (!selectedItem) return;

        if (!selectedBookingId) {
            showToast('error', 'Vui lòng chọn Số phòng / Đơn đặt phòng đang lưu trú của bạn.');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                booking_id: selectedBookingId,
                service_id: selectedItem.id,
                quantity: Number(quantity) || 1,
                note: note.trim()
            };

            const res = await hotelService.createServiceRequest(payload);

            if (res && res.success) {
                const targetBooking = activeBookings.find(
                    (b) => String(b.id) === String(selectedBookingId)
                );
                const roomNum = targetBooking?.room_number || 'đã chọn';

                setSuccessOrderInfo({
                    serviceName: selectedItem.name,
                    quantity: Number(quantity) || 1,
                    totalPrice: Number(selectedItem.price) * (Number(quantity) || 1),
                    roomNumber: roomNum,
                    bookingCode: targetBooking?.booking_code || ''
                });

                handleCloseOrderModal();
                fetchOrderHistory(true);
                showToast('success', res.message || 'Yêu cầu của quý khách đã được gửi đến bộ phận phục vụ!');
            } else {
                showToast('error', res?.message || 'Không thể gửi yêu cầu dịch vụ. Vui lòng kiểm tra lại.');
            }
        } catch (error) {
            console.error('Lỗi khi gửi yêu cầu:', error);
            showToast('error', error.message || 'Lỗi kết nối máy chủ.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Khách hàng hủy yêu cầu dịch vụ khi còn chờ xử lý (status === 'pending')
    const handleCancelOrder = async (requestId) => {
        if (!window.confirm('Quý khách có chắc chắn muốn hủy yêu cầu đặt món này không?')) return;
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
            } else {
                showToast('error', res.message || 'Không thể hủy yêu cầu đặt món.');
            }
        } catch (err) {
            showToast('error', err.message || 'Lỗi khi hủy yêu cầu.');
        } finally {
            setCancellingRequestId(null);
        }
    };

    // Thống kê nhanh đơn đặt món
    const activeOrdersCount = useMemo(() => {
        return orderHistory.filter((o) => o.status === 'pending' || o.status === 'in_progress').length;
    }, [orderHistory]);

    const historyStats = useMemo(() => {
        const total = orderHistory.length;
        const pending = orderHistory.filter((o) => o.status === 'pending').length;
        const inProgress = orderHistory.filter((o) => o.status === 'in_progress').length;
        const completed = orderHistory.filter((o) => o.status === 'completed').length;
        const cancelled = orderHistory.filter((o) => o.status === 'cancelled').length;
        return { total, pending, inProgress, completed, cancelled };
    }, [orderHistory]);

    // Danh sách lọc lịch sử
    const filteredHistory = useMemo(() => {
        if (historyFilter === 'all') return orderHistory;
        if (historyFilter === 'active') {
            return orderHistory.filter((o) => o.status === 'pending' || o.status === 'in_progress');
        }
        return orderHistory.filter((o) => o.status === historyFilter);
    }, [orderHistory, historyFilter]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white flex flex-col justify-between">
            <div>
                <Navbar />

                {/* BREADCRUMB */}
                <div className="bg-white border-b border-slate-100 py-3">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <nav className="flex items-center space-x-2 text-xs text-slate-500">
                            <Link to="/" className="hover:text-blue-600 transition">Trang chủ</Link>
                            <span>/</span>
                            <span className="text-slate-900 font-semibold">Menu Dịch Vụ Tại Phòng</span>
                        </nav>
                    </div>
                </div>

                {/* HERO BANNER CHUẨN LUXURY HOTEL (ẢNH SẮC NÉT + GRADIENT OVERLAY) */}
                <header className="relative bg-slate-950 overflow-hidden py-16 lg:py-24 border-b border-slate-800 shadow-md">
                    {/* 1. Ảnh nền sắc nét 100% không giảm opacity, không blur */}
                    <img
                        src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=2070&q=85"
                        alt="Luxury 5-Star Resort & Dining"
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
                                Thưởng thức ẩm thực mỹ vị, set trà chiều hoàng gia, liệu trình spa thảo dược và các tiện ích buồng phòng đẳng cấp 5 sao phục vụ tận phòng nghỉ của bạn tại Khách Sạn TA Đà Nẵng.
                            </p>

                            {/* Thông tin phòng đang lưu trú của khách */}
                            {activeBookings.length > 0 && (
                                <div className="mt-6 flex flex-wrap items-center gap-3">
                                    <div className="inline-flex flex-wrap items-center gap-2 p-2.5 px-4 rounded-2xl bg-white/90 backdrop-blur-md border border-amber-200/80 text-xs shadow-xs">
                                        <span className="text-amber-800 font-bold">🏨 Phòng đang ở:</span>
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
                                    ? 'bg-emerald-900/90 text-white border border-emerald-500/40 shadow-emerald-900/30'
                                    : 'bg-rose-900/90 text-white border border-rose-500/40 shadow-rose-900/30'
                            }`}
                        >
                            <span className="text-base">{toast.type === 'success' ? '✅' : '⚠️'}</span>
                            <span>{toast.message}</span>
                        </div>
                    </div>
                )}

                {/* MODAL THÔNG BÁO ĐẶT THÀNH CÔNG */}
                {successOrderInfo && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-5 animate-scale-up">
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/10">
                                🛎️
                            </div>
                            <div>
                                <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold mb-2">
                                    ĐÃ TIẾP NHẬN YÊU CẦU
                                </span>
                                <h3 className="text-xl font-bold text-slate-900">
                                    Phục vụ phòng đang chuẩn bị!
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Yêu cầu của quý khách đã được chuyển tới bếp & bộ phận Concierge.
                                </p>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-left space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Giao đến:</span>
                                    <strong className="text-slate-900 font-bold text-sm">
                                        Phòng {successOrderInfo.roomNumber}
                                    </strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Dịch vụ / Món gọi:</span>
                                    <span className="font-semibold text-slate-800">
                                        {successOrderInfo.serviceName} (x{successOrderInfo.quantity})
                                    </span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-slate-200">
                                    <span className="text-slate-500">Tạm tính (vào hóa đơn phòng):</span>
                                    <strong className="text-rose-600 font-bold text-sm">
                                        {successOrderInfo.totalPrice.toLocaleString('vi-VN')} VND
                                    </strong>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
                                <span>⏱️ Thời gian dự kiến:</span>
                                <span className="font-semibold text-slate-700">15 – 30 phút</span>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSuccessOrderInfo(null)}
                                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-slate-900/20"
                            >
                                Đã hiểu & Tiếp tục xem Menu
                            </button>
                        </div>
                    </div>
                )}

                {/* KHU VỰC MENU CHÍNH */}
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
                    {/* BỘ LỌC DANH MỤC & TÌM KIẾM */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                        {/* Tabs danh mục */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                            <button
                                type="button"
                                onClick={() => setSelectedCategory('all')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                                    selectedCategory === 'all'
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                            >
                                <span>✨</span>
                                <span>Tất cả ({serviceItems.length})</span>
                            </button>

                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                                        String(selectedCategory) === String(cat.id)
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                                >
                                    <span>{cat.icon || '🏷️'}</span>
                                    <span>{cat.name}</span>
                                    {cat.services_count > 0 && (
                                        <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                                            {cat.services_count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Ô tìm kiếm món */}
                        <div className="relative w-full md:w-72 shrink-0">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Tìm món ăn, đồ uống, spa..."
                                className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                            />
                            <span className="absolute left-3 top-3 text-slate-400 text-xs">🔍</span>
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs p-0.5 cursor-pointer"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    {/* DANH SÁCH CARDS GRID */}
                    {isLoading ? (
                        <div className="py-20 text-center text-slate-400 space-y-3">
                            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                            <p className="text-xs font-semibold text-slate-600">
                                Đang nạp thực đơn & dịch vụ khách sạn...
                            </p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center space-y-3">
                            <div className="text-4xl mb-1">🍽️</div>
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
                                className="mt-3 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
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
                                        className="group bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-xl hover:border-blue-200 transition-all duration-300 flex flex-col justify-between"
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
                                                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-slate-800 text-[10px] font-bold shadow-xs flex items-center gap-1">
                                                    <span>{item.category_icon || '🏷️'}</span>
                                                    <span>{item.category_name}</span>
                                                </span>
                                            </div>

                                            {/* Nội dung thông tin */}
                                            <div className="p-5">
                                                <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition leading-snug">
                                                    {item.name}
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed font-light">
                                                    {item.description || 'Dịch vụ chuẩn 5 sao phục vụ trực tiếp tại phòng nghỉ.'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Phần chân Card: Giá & Nút đặt */}
                                        <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                                            <div>
                                                <span className="text-[10px] text-slate-400 block font-medium">Đơn giá</span>
                                                <div className="text-base font-black text-rose-600">
                                                    {priceNum === 0 ? (
                                                        <span className="text-emerald-600">Miễn phí</span>
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
                                                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-600/25 transition cursor-pointer flex items-center gap-1"
                                            >
                                                <span>🛎️</span>
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
                                    ‹
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
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/25'
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
                                    ›
                                </button>
                            </div>
                        </nav>
                    )}
                </main>

                {/* MODAL FORM ĐẶT DỊCH VỤ TẠI PHÒNG */}
                {selectedItem && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-scale-up">
                            {/* Modal Header */}
                            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 via-blue-500 to-sky-500 text-white flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm border border-blue-500/30">
                                        🛎️
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-white">Yêu Cầu Dịch Vụ Tại Phòng</h3>
                                        <span className="text-[10px] text-slate-400">In-Room Dining & Concierge</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCloseOrderModal}
                                    disabled={isSubmitting}
                                    className="w-8 h-8 rounded-full hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Modal Body */}
                            <form onSubmit={handleConfirmOrder} className="p-6 space-y-5">
                                {/* Preview Item đã chọn */}
                                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3.5">
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
                                        <span className="text-[10px] font-bold text-blue-600 block">
                                            {selectedItem.category_name}
                                        </span>
                                        <h4 className="font-bold text-slate-900 text-xs truncate">
                                            {selectedItem.name}
                                        </h4>
                                        <div className="text-xs font-bold text-rose-600 mt-0.5">
                                            {Number(selectedItem.price).toLocaleString('vi-VN')} VND
                                            <span className="text-[10px] font-normal text-slate-400 ml-1">/ suất</span>
                                        </div>
                                    </div>
                                </div>

                                {/* HÀNG 1: CHỌN PHÒNG / MÃ BOOKING */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Giao đến Phòng / Mã Đặt phòng <span className="text-rose-500">*</span>
                                    </label>
                                    {activeBookings.length > 0 ? (
                                        <select
                                            value={selectedBookingId}
                                            onChange={(e) => setSelectedBookingId(e.target.value)}
                                            required
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {activeBookings.map((b) => (
                                                <option key={b.id} value={b.id}>
                                                    {b.display_label}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                value={selectedBookingId}
                                                onChange={(e) => setSelectedBookingId(e.target.value)}
                                                placeholder="Nhập Mã Booking (VD: BK-B38570) hoặc số ID đơn"
                                                required
                                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <p className="text-[11px] text-amber-600 italic">
                                                💡 Nếu bạn đang đăng nhập, hãy đảm bảo tài khoản đã có đơn đặt phòng ở trạng thái đang lưu trú.
                                            </p>
                                        </div>
                                    )}
                                    <span className="text-[10px] text-slate-400 mt-1 block">
                                        Chi phí dịch vụ sẽ được tính trực tiếp vào hóa đơn của phòng khi Check-out.
                                    </span>
                                </div>

                                {/* HÀNG 2: CHỌN SỐ LƯỢNG (QUANTITY) & TẠM TÍNH */}
                                <div className="grid grid-cols-2 gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                            Số lượng:
                                        </label>
                                        <div className="inline-flex items-center border border-slate-200 rounded-xl bg-white overflow-hidden shadow-xs">
                                            <button
                                                type="button"
                                                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 font-bold text-sm transition"
                                            >
                                                –
                                            </button>
                                            <span className="px-4 py-1.5 text-xs font-bold text-slate-900 border-x border-slate-200">
                                                {quantity}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                                                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 font-bold text-sm transition"
                                            >
                                                +
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

                                {/* HÀNG 3: GHI CHÚ YÊU CẦU RIÊNG */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Ghi chú phục vụ riêng (Tùy chọn)
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        placeholder="Ví dụ: Mang lên lúc 19:30, ít đường, nhiều đá, khăn tắm thêm, sốt để riêng..."
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    ></textarea>
                                </div>

                                {/* Modal Actions */}
                                <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={handleCloseOrderModal}
                                        disabled={isSubmitting}
                                        className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition"
                                    >
                                        Đóng
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition flex items-center gap-1.5"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                <span>Đang gửi yêu cầu...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>🛎️</span>
                                                <span>Xác nhận gửi yêu cầu</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {/* FLOATING ACTION BUTTON XEM LỊCH SỬ ĐẶT MÓN */}
                <button
                    type="button"
                    onClick={() => {
                        fetchOrderHistory();
                        setIsHistoryModalOpen(true);
                    }}
                    className="fixed bottom-6 left-6 z-40 px-4 py-3 rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-2xl border border-slate-700/60 font-bold text-xs flex items-center gap-2.5 transition transform hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
                    title="Xem lịch sử đặt món & tiến độ xử lý"
                >
                    <span className="text-base">🛎️</span>
                    <span>Lịch Sử Đặt Món</span>
                    {activeOrdersCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black animate-bounce">
                            {activeOrdersCount} đang làm
                        </span>
                    ) : orderHistory.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-700 text-white text-[10px] font-bold">
                            {orderHistory.length}
                        </span>
                    ) : null}
                </button>

                {/* MODAL LỊCH SỬ ĐẶT MÓN & TRẠNG THÁI XỬ LÝ */}
                {isHistoryModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
                            {/* Modal Header */}
                            <div className="bg-white text-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-200">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl shrink-0 border border-amber-200">
                                        📜
                                    </div>
                                    <div>
                                        <h3 className="font-serif text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                                            <span>Lịch Sử Đặt Món & Dịch Vụ Tại Phòng</span>
                                            {activeOrdersCount > 0 && (
                                                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase shadow-xs">
                                                    {activeOrdersCount} đang xử lý
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            Theo dõi thời gian thực tiến độ tiếp nhận, chế biến và phục vụ tận phòng của bạn.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => fetchOrderHistory()}
                                        disabled={isLoadingHistory}
                                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        title="Làm mới trạng thái"
                                    >
                                        <span className={isLoadingHistory ? 'animate-spin' : ''}>🔄</span>
                                        <span className="hidden sm:inline">Làm mới</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsHistoryModalOpen(false)}
                                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 border border-slate-200 flex items-center justify-center text-sm font-bold transition cursor-pointer"
                                        title="Đóng"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Filter Tabs */}
                            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto scrollbar-none">
                                {[
                                    { key: 'all', label: 'Tất cả', count: historyStats.total },
                                    { key: 'pending', label: '⏳ Chờ xác nhận', count: historyStats.pending },
                                    { key: 'in_progress', label: '👨‍🍳 Đang chế biến', count: historyStats.inProgress },
                                    { key: 'completed', label: '✓ Đã phục vụ', count: historyStats.completed },
                                    { key: 'cancelled', label: '✕ Đã hủy', count: historyStats.cancelled }
                                ].map((tab) => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setHistoryFilter(tab.key)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                            historyFilter === tab.key
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                        }`}
                                    >
                                        <span>{tab.label}</span>
                                        <span
                                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                                historyFilter === tab.key
                                                    ? 'bg-slate-700 text-white'
                                                    : 'bg-slate-100 text-slate-600'
                                            }`}
                                        >
                                            {tab.count}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Modal Body / Request List */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                                {isLoadingHistory && orderHistory.length === 0 ? (
                                    <div className="py-16 text-center space-y-3">
                                        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                        <p className="text-xs font-semibold text-slate-500">Đang tải lịch sử đơn món...</p>
                                    </div>
                                ) : filteredHistory.length === 0 ? (
                                    <div className="py-16 text-center space-y-3 max-w-sm mx-auto">
                                        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-3xl mx-auto shadow-inner">
                                            🍽️
                                        </div>
                                        <h4 className="font-serif text-base font-bold text-slate-900">
                                            {historyFilter === 'all'
                                                ? 'Bạn chưa có yêu cầu gọi món nào'
                                                : `Không có món nào ở mục "${
                                                      historyFilter === 'pending'
                                                          ? 'Chờ xác nhận'
                                                          : historyFilter === 'in_progress'
                                                          ? 'Đang chế biến'
                                                          : historyFilter === 'completed'
                                                          ? 'Đã phục vụ'
                                                          : 'Đã hủy'
                                                  }"`}
                                        </h4>
                                        <p className="text-xs text-slate-500">
                                            Khám phá thực đơn phong phú của chúng tôi và chọn những món ăn hấp dẫn để được phục vụ tận phòng nghỉ.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setIsHistoryModalOpen(false)}
                                            className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-600/20 cursor-pointer"
                                        >
                                            Xem Menu ngay
                                        </button>
                                    </div>
                                ) : (
                                    filteredHistory.map((item) => {
                                        const isPending = item.status === 'pending';
                                        const isInProgress = item.status === 'in_progress';
                                        const isCompleted = item.status === 'completed';
                                        const isCancelled = item.status === 'cancelled';
                                        const priceNum = Number(item.total_price || (item.service_price * item.quantity)) || 0;

                                        return (
                                            <div
                                                key={item.id}
                                                className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition overflow-hidden"
                                            >
                                                {/* Thẻ Header: Mã đơn + Phòng + Trạng thái */}
                                                <div className="bg-slate-50/80 px-4 sm:px-5 py-2.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-slate-800">
                                                            #SRQ-{item.id}
                                                        </span>
                                                        <span className="text-slate-300">•</span>
                                                        <span className="font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                            🏨 Phòng {item.room_number || 'Lưu trú'}
                                                        </span>
                                                        {item.booking_code && (
                                                            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                                                                (Mã #{item.booking_code})
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] text-slate-400 hidden sm:inline">
                                                            {formatDateTimeDisplay(item.created_at || item.request_time)}
                                                        </span>
                                                        {/* Status Badge */}
                                                        {isPending && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                                ⏳ Chờ xác nhận
                                                            </span>
                                                        )}
                                                        {isInProgress && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                                                                👨‍🍳 Đang chế biến
                                                            </span>
                                                        )}
                                                        {isCompleted && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                ✓ Đã phục vụ phòng
                                                            </span>
                                                        )}
                                                        {isCancelled && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                                                ✕ Đã hủy
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Body thẻ: Món ăn + Chi tiết */}
                                                <div className="p-4 sm:p-5">
                                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                                        <div className="flex items-center gap-3.5 flex-1">
                                                            {item.service_image ? (
                                                                <img
                                                                    src={item.service_image}
                                                                    alt={item.service_name}
                                                                    className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
                                                                    onError={(e) => {
                                                                        e.target.src =
                                                                            'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=200&q=80';
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="w-16 h-16 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl shrink-0 border border-amber-200/60">
                                                                    {item.category_icon || '🍽️'}
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
                                                                                ({Number(item.service_price).toLocaleString('vi-VN')} đ/phần)
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                {item.note && (
                                                                    <div className="text-[11px] text-amber-800 bg-amber-50/70 px-2 py-0.5 rounded border border-amber-100 italic">
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

                                                    {/* THANH TIẾN ĐỘ TRẠNG THÁI XỬ LÝ (LIVE PROCESS TRACKER) */}
                                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                                        {!isCancelled ? (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                                                                    <span className={isPending || isInProgress || isCompleted ? 'text-amber-600 font-bold' : ''}>
                                                                        1. Tiếp nhận
                                                                    </span>
                                                                    <span className={isInProgress || isCompleted ? 'text-blue-600 font-bold' : ''}>
                                                                        2. Đang chế biến
                                                                    </span>
                                                                    <span className={isCompleted ? 'text-emerald-600 font-bold' : ''}>
                                                                        3. Giao tận phòng
                                                                    </span>
                                                                </div>

                                                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                                                                    <div
                                                                        className={`h-full transition-all duration-500 ${
                                                                            isCompleted
                                                                                ? 'w-full bg-emerald-500'
                                                                                : isInProgress
                                                                                ? 'w-2/3 bg-blue-600 animate-pulse'
                                                                                : 'w-1/3 bg-amber-400'
                                                                        }`}
                                                                    ></div>
                                                                </div>

                                                                <div className="flex items-center justify-between text-[11px]">
                                                                    <span className="text-slate-500">
                                                                        {isPending && '⏳ Bếp & Lễ tân đã nhận được yêu cầu, đang kiểm tra.'}
                                                                        {isInProgress && '👨‍🍳 Đầu bếp đang nấu. Món sẽ được đưa lên phòng trong 15-20 phút.'}
                                                                        {isCompleted && '✅ Đã phục vụ tới phòng. Chúc quý khách dùng ngon miệng!'}
                                                                    </span>

                                                                    {/* Nút Hủy nếu đang Pending */}
                                                                    {isPending && (
                                                                        <button
                                                                            type="button"
                                                                            disabled={cancellingRequestId === item.id}
                                                                            onClick={() => handleCancelOrder(item.id)}
                                                                            className="text-rose-600 hover:text-rose-700 font-bold text-xs underline cursor-pointer disabled:opacity-50"
                                                                        >
                                                                            {cancellingRequestId === item.id ? 'Đang hủy...' : '✕ Hủy yêu cầu'}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-between text-xs text-rose-600 bg-rose-50/60 p-2 rounded-xl border border-rose-100">
                                                                <span>✕ Yêu cầu đã hủy. Món ăn không được chuẩn bị và không tính phí.</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between text-xs">
                                <span className="text-slate-500">
                                    💡 Cần hỗ trợ khẩn cấp, vui lòng bấm phím <strong>0</strong> trên điện thoại bàn phòng.
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsHistoryModalOpen(false)}
                                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition cursor-pointer"
                                >
                                    Đóng
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
