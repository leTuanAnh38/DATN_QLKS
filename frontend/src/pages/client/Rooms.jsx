import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import RoomsComparisonAndStandards from '../../components/client/RoomsComparisonAndStandards';
import RoomCardImageCarousel from '../../components/client/RoomCardImageCarousel';
import roomService from '../../services/roomService';
import { useHotelSettings } from '../../store/hotelSettingStore';
import { formatDate as formatDateDisplay, formatDateToInput, getNextDayString } from '../../utils/formatters';
import { 
    Search, 
    Building2, 
    Camera, 
    Maximize2, 
    Users, 
    BedDouble, 
    ArrowRight, 
    SlidersHorizontal,
    X,
    RotateCcw,
    AlertTriangle,
    Compass,
    Star,
    CheckCircle2,
    Sparkles
} from 'lucide-react';

/**
 * Trang Danh sách Phòng nghỉ & Suites dành cho Khách hàng (RoomsPage)
 * Sử dụng useEffect gọi API lấy danh sách RoomCategory thực tế từ Django Backend
 * Hiển thị dạng Grid layout: grid grid-cols-1 md:grid-cols-3 gap-6
 * Tích hợp trạng thái Loading (Skeleton) và xử lý ảnh đại diện chuẩn PMS
 */
export default function RoomsAndSuitesPage() {
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { settings } = useHotelSettings();
    const hotelName = settings?.hotel_name || "Khách Sạn TA Đà Nẵng";
    const bannerRoomsImg = settings?.banner_rooms || "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=2074&q=85";

    // Nhận các tham số tìm kiếm từ thanh tìm phòng trang chủ
    const checkInParam = searchParams.get('checkIn') || location.state?.checkInDate || '';
    const checkOutParam = searchParams.get('checkOut') || location.state?.checkOutDate || '';
    const guestsParam = searchParams.get('guests') || (location.state?.guestCount ? String(location.state.guestCount) : '');
    const categoryParam = searchParams.get('category') || location.state?.roomType || 'all';

    const defaultToday = formatDateToInput(new Date());
    const defaultTomorrow = getNextDayString(defaultToday);

    const effectiveCheckIn = (checkInParam && checkInParam.trim() !== '') ? checkInParam : defaultToday;
    const effectiveCheckOut = (checkOutParam && checkOutParam.trim() !== '') ? checkOutParam : getNextDayString(effectiveCheckIn) || defaultTomorrow;
    const effectiveGuests = (guestsParam && guestsParam.trim() !== '') ? guestsParam : '2';

    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTab, setSelectedTab] = useState(categoryParam || 'all');
    const [sortBy, setSortBy] = useState('featured');
    const [priceRange, setPriceRange] = useState('all'); // 'all' | 'under-2m' | '2m-4m' | 'over-4m'
    const [capacityFilter, setCapacityFilter] = useState(guestsParam ? String(guestsParam) : 'all');
    const [viewFilter, setViewFilter] = useState('all'); // 'all' | 'sea' | 'city'
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    const activeAdvancedCount =
        (priceRange !== 'all' ? 1 : 0) +
        (capacityFilter !== 'all' ? 1 : 0) +
        (viewFilter !== 'all' ? 1 : 0);

    const searchNights = (checkInParam && checkOutParam)
        ? Math.max(1, Math.round((new Date(checkOutParam) - new Date(checkInParam)) / (1000 * 60 * 60 * 24)))
        : 0;

    const hasActiveSearch = Boolean(checkInParam || checkOutParam || (guestsParam && guestsParam !== '0'));
    const hasAnyFilter = Boolean(
        hasActiveSearch ||
        searchQuery.trim() !== '' ||
        selectedTab !== 'all' ||
        priceRange !== 'all' ||
        capacityFilter !== 'all' ||
        viewFilter !== 'all'
    );

    const handleClearSearch = () => {
        setSearchParams({});
        setSelectedTab('all');
        setSearchQuery('');
        setPriceRange('all');
        setCapacityFilter('all');
        setViewFilter('all');
        setSortBy('featured');
    };

    // Gọi API lấy toàn bộ danh sách Hạng phòng từ Backend
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await roomService.getCategories();
                if (res.success && res.categories) {
                    setCategories(res.categories);
                } else if (Array.isArray(res)) {
                    setCategories(res);
                } else if (res.results) {
                    setCategories(res.results);
                }
            } catch (err) {
                console.error('Error fetching room categories:', err);
                setError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, []);

    // Đồng bộ categoryParam & guestsParam khi URL thay đổi
    useEffect(() => {
        if (categoryParam && categoryParam !== 'all') {
            setSelectedTab(categoryParam);
        }
    }, [categoryParam]);

    useEffect(() => {
        if (guestsParam && Number(guestsParam) > 0) {
            setCapacityFilter(String(guestsParam));
        }
    }, [guestsParam]);

    // Lọc theo từ khóa tìm kiếm, tab/ID danh mục, sức chứa, khoảng giá và hướng nhìn
    const filteredCategories = categories.filter((room) => {
        const matchesSearch =
            searchQuery.trim() === '' ||
            room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            room.bed_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            room.short_description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            room.description?.toLowerCase().includes(searchQuery.toLowerCase());

        let matchesTab = true;
        if (selectedTab && selectedTab !== 'all') {
            if (selectedTab === 'deluxe') {
                matchesTab = room.name.toLowerCase().includes('deluxe');
            } else if (selectedTab === 'suite') {
                matchesTab = room.name.toLowerCase().includes('suite');
            } else if (selectedTab === 'penthouse') {
                matchesTab =
                    room.name.toLowerCase().includes('penthouse') ||
                    room.name.toLowerCase().includes('president');
            } else {
                // Hỗ trợ lọc chính xác theo ID hoặc slug hạng phòng được chọn từ Trang chủ
                matchesTab =
                    String(room.id) === String(selectedTab) ||
                    (room.slug && String(room.slug) === String(selectedTab));
            }
        }

        let matchesCapacity = true;
        const requiredCapacity = capacityFilter !== 'all' ? Number(capacityFilter) : Number(guestsParam || 0);
        if (requiredCapacity > 0) {
            matchesCapacity = Number(room.capacity || 2) >= requiredCapacity;
        }

        const effectivePrice =
            room.promo_price && Number(room.promo_price) > 0 && Number(room.promo_price) < Number(room.base_price)
                ? Number(room.promo_price)
                : Number(room.base_price || 0);
        let matchesPrice = true;
        if (priceRange === 'under-2m') matchesPrice = effectivePrice < 2000000;
        else if (priceRange === '2m-4m') matchesPrice = effectivePrice >= 2000000 && effectivePrice <= 4000000;
        else if (priceRange === 'over-4m') matchesPrice = effectivePrice > 4000000;

        let matchesView = true;
        if (viewFilter !== 'all') {
            const viewBlob = `${room.view_type || ''} ${room.name || ''} ${room.short_description || ''} ${room.description || ''}`.toLowerCase();
            if (viewFilter === 'sea') {
                matchesView = /(biển|ocean|sea|mỹ khê|vịnh)/.test(viewBlob);
            } else if (viewFilter === 'city') {
                matchesView = /(thành phố|city|phố|sông|river|cầu rồng)/.test(viewBlob);
            }
        }

        return matchesSearch && matchesTab && matchesCapacity && matchesPrice && matchesView;
    });

    const selectedCategoryLabel =
        categories.find((c) => String(c.id) === String(selectedTab) || (c.slug && String(c.slug) === String(selectedTab)))?.name ||
        selectedTab;

    // Sắp xếp danh sách
    const sortedCategories = [...filteredCategories].sort((a, b) => {
        if (sortBy === 'price-asc') return Number(a.base_price) - Number(b.base_price);
        if (sortBy === 'price-desc') return Number(b.base_price) - Number(a.base_price);
        if (sortBy === 'size-desc') return Number(b.size) - Number(a.size);
        if (sortBy === 'capacity-desc') return Number(b.capacity) - Number(a.capacity);
        return 0;
    });

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-amber-600 selection:text-white flex flex-col">
            <Navbar />

            {/* BREADCRUMB */}
            <div className="bg-white border-b border-slate-100 py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500 whitespace-nowrap overflow-x-auto no-scrollbar">
                        <Link to="/" className="hover:text-amber-700 transition shrink-0">Trang chủ</Link>
                        <span className="text-slate-300 shrink-0">/</span>
                        <span className="text-slate-900 font-semibold truncate min-w-0">Phòng nghỉ & Suites</span>
                    </nav>
                </div>
            </div>

            {/* 1. HERO BANNER CHUẨN LUXURY HOTEL (ẢNH SẮC NÉT + GRADIENT OVERLAY) */}
            <header className="relative bg-slate-950 overflow-hidden py-10 lg:py-14 border-b border-slate-800 shadow-md">
                {/* 1. Ảnh nền sắc nét 100% không blur, không giảm opacity */}
                <img
                    src={bannerRoomsImg}
                    alt="Phòng nghỉ & Suites Khách Sạn TA Đà Nẵng"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                />

                {/* 2. Lớp phủ Gradient tối (Gradient Overlay) bảo vệ độ tương phản chữ */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25" />

                {/* 3. Nội dung chữ nổi bật tuyệt đối (relative z-10) */}
                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                        <div className="max-w-3xl flex flex-col items-start text-left">
                            <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-sm">
                                Không Gian Nghỉ Dưỡng <br className="hidden sm:inline" />
                                <span className="text-amber-400">
                                    Bên Bờ Biển Mỹ Khê
                                </span>
                            </h1>
                            <p className="text-sm sm:text-base text-gray-200 mt-4 leading-relaxed font-normal max-w-2xl drop-shadow-xs">
                                Khám phá các hạng phòng và suites chuẩn {settings?.stars || 3} sao tầm nhìn hướng biển, tiện nghi hiện đại tại {hotelName}.
                            </p>
                        </div>

                        <div className="mt-2 lg:mt-0 shrink-0">
                            <Link
                                to="/corporate-booking"
                                className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-amber-300/40 text-white hover:text-amber-300 font-bold text-xs sm:text-sm transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 group"
                            >
                                <Building2 className="w-4 h-4 text-amber-400" />
                                <span>Cổng Đặt Phòng Đoàn & Hợp Đồng B2B</span>
                                <ArrowRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* 2. FILTER & SEARCH TOOLBAR */}
            <section className="bg-white border-b border-slate-200 py-3.5 shadow-xs">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                        {/* Tab Pills */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                            {[
                                { id: 'all', label: 'Tất Cả Hạng Phòng' },
                                { id: 'deluxe', label: 'Deluxe Hướng Biển' },
                                { id: 'suite', label: 'Suites Cao Cấp' },
                                { id: 'penthouse', label: 'Penthouse Hoàng Gia' },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setSelectedTab(tab.id)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                        selectedTab === tab.id
                                            ? 'bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 text-white shadow-md shadow-sky-900/20 scale-[1.02]'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                            {!['all', 'deluxe', 'suite', 'penthouse'].includes(selectedTab) && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedTab('all')}
                                    className="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 text-white shadow-md shadow-sky-900/20 flex items-center gap-1.5"
                                    title="Bấm để bỏ chọn hạng phòng này"
                                >
                                    <span>{selectedCategoryLabel}</span>
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Search, Sort & Toggle Advanced Filter Controls */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5">
                            <div className="relative flex-1 md:w-52">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Tìm tên phòng, loại giường..."
                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                                />
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                                    <Search className="w-3.5 h-3.5" />
                                </span>
                            </div>

                            <div className="flex items-center gap-2 min-w-0">
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="flex-1 min-w-0 w-full sm:w-auto sm:flex-initial bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-base sm:text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition cursor-pointer"
                                >
                                    <option value="featured">Đề xuất hàng đầu</option>
                                    <option value="price-asc">Giá: Thấp đến Cao</option>
                                    <option value="price-desc">Giá: Cao đến Thấp</option>
                                    <option value="size-desc">Diện tích rộng nhất</option>
                                    <option value="capacity-desc">Sức chứa nhiều nhất</option>
                                </select>

                                <button
                                    type="button"
                                    onClick={() => setShowAdvancedFilters((prev) => !prev)}
                                    aria-expanded={showAdvancedFilters}
                                    className={`shrink-0 min-h-[40px] sm:min-h-0 px-3 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                        showAdvancedFilters || activeAdvancedCount > 0
                                            ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs'
                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                >
                                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>Bộ lọc</span>
                                    {activeAdvancedCount > 0 && (
                                        <span className="min-w-4 h-4 px-1 rounded-full bg-amber-600 text-white text-[10px] font-extrabold flex items-center justify-center tabular-nums">
                                            {activeAdvancedCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Khay Bộ lọc nâng cao (chỉ xổ ra khi bấm nút "Bộ lọc") */}
                    {showAdvancedFilters && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5 animate-in fade-in duration-150">
                            <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 flex-1">
                                <select
                                    value={priceRange}
                                    onChange={(e) => setPriceRange(e.target.value)}
                                    aria-label="Lọc theo khoảng giá"
                                    className="w-full sm:w-auto bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 sm:py-1.5 text-base sm:text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition cursor-pointer"
                                >
                                    <option value="all">Mọi mức giá</option>
                                    <option value="under-2m">Dưới 2.000.000đ / đêm</option>
                                    <option value="2m-4m">2.000.000đ – 4.000.000đ</option>
                                    <option value="over-4m">Trên 4.000.000đ / đêm</option>
                                </select>

                                <select
                                    value={capacityFilter}
                                    onChange={(e) => setCapacityFilter(e.target.value)}
                                    aria-label="Lọc theo sức chứa"
                                    className="w-full sm:w-auto bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 sm:py-1.5 text-base sm:text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition cursor-pointer"
                                >
                                    <option value="all">Mọi sức chứa</option>
                                    <option value="1">Từ 1 người lớn</option>
                                    <option value="2">Từ 2 người lớn</option>
                                    <option value="3">Từ 3 người lớn</option>
                                    <option value="4">Từ 4 người lớn</option>
                                    <option value="6">Từ 6 người lớn</option>
                                </select>

                                <select
                                    value={viewFilter}
                                    onChange={(e) => setViewFilter(e.target.value)}
                                    aria-label="Lọc theo hướng nhìn"
                                    className="w-full sm:w-auto bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 sm:py-1.5 text-base sm:text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition cursor-pointer"
                                >
                                    <option value="all">Tất cả hướng nhìn</option>
                                    <option value="sea">Hướng biển / Mỹ Khê</option>
                                    <option value="city">Hướng thành phố / Sông Hàn</option>
                                </select>
                            </div>

                            {hasAnyFilter && (
                                <button
                                    type="button"
                                    onClick={handleClearSearch}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition cursor-pointer"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Xóa bộ lọc</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* 3. MAIN CONTENT: GRID LAYOUT CHUẨN (grid grid-cols-1 md:grid-cols-3 gap-6) */}
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
                {/* Active Search Banner nếu có tham số tìm kiếm từ trang chủ */}
                {hasActiveSearch && (
                    <div className="mb-8 p-4 sm:p-5 bg-gradient-to-r from-amber-50/70 via-slate-50 to-amber-50/40 border border-amber-200/90 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-700 text-white flex items-center justify-center font-bold shadow-md shadow-amber-900/20 shrink-0">
                                <Search className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <div className="text-[11px] text-amber-800 font-extrabold uppercase tracking-wider flex items-center gap-2">
                                    <span>Yêu cầu tìm kiếm của Quý khách</span>
                                    {searchNights > 0 && (
                                        <span className="px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-950 font-bold text-[10px]">
                                            {searchNights} đêm lưu trú
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                                    {guestsParam ? `${guestsParam} khách` : 'Tất cả khách'}
                                    {checkInParam && ` • Nhận: ${formatDateDisplay(checkInParam)}`}
                                    {checkOutParam && ` • Trả: ${formatDateDisplay(checkOutParam)}`}
                                    {categoryParam && categoryParam !== 'all' && ` • Hạng: ${selectedCategoryLabel}`}
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleClearSearch}
                            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                            <span>Đặt lại bộ lọc</span>
                        </button>
                    </div>
                )}

                {/* Trạng thái Loading (Skeleton dạng thẻ ngang rộng) */}
                {loading && (
                    <div className="space-y-6">
                        {[1, 2, 3].map((n) => (
                            <div
                                key={n}
                                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs animate-pulse flex flex-col lg:flex-row"
                            >
                                <div className="w-full lg:w-[40%] h-60 lg:h-72 bg-slate-200 shrink-0" />
                                <div className="flex-1 p-6 sm:p-7 space-y-4">
                                    <div className="h-3 bg-slate-200 rounded w-1/4" />
                                    <div className="h-7 bg-slate-200 rounded w-1/2" />
                                    <div className="h-11 bg-slate-100 rounded-2xl w-full" />
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="h-4 bg-slate-100 rounded w-3/4" />
                                        <div className="h-4 bg-slate-100 rounded w-2/3" />
                                    </div>
                                    <div className="pt-4 flex justify-between items-center">
                                        <div className="h-8 bg-slate-200 rounded w-1/3" />
                                        <div className="h-10 bg-slate-200 rounded-xl w-1/3" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Trạng thái Lỗi */}
                {!loading && error && (
                    <div className="bg-rose-50 border border-rose-200 rounded-3xl p-10 text-center max-w-lg mx-auto">
                        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-rose-800">Đã xảy ra sự cố</h3>
                        <p className="text-xs text-rose-600 mt-1">{error}</p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="mt-4 px-5 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-rose-700 transition"
                        >
                            Thử tải lại trang
                        </button>
                    </div>
                )}

                {/* Trạng thái Không tìm thấy kết quả */}
                {!loading && !error && sortedCategories.length === 0 && (
                    <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto shadow-xs">
                        <Compass className="w-12 h-12 text-slate-300 mx-auto mb-3 stroke-1" />
                        <h3 className="text-base font-bold text-slate-900">Không tìm thấy hạng phòng phù hợp</h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Vui lòng thử tìm kiếm lại bằng từ khóa khác hoặc chọn xem tất cả hạng phòng.
                        </p>
                        <button
                            type="button"
                            onClick={handleClearSearch}
                            className="mt-4 px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-900/20 cursor-pointer"
                        >
                            Xóa Bộ Lọc & Xem Tất Cả
                        </button>
                    </div>
                )}

                {/* Danh sách phòng xếp dọc dạng thẻ ngang rộng chuẩn Booking / Resort cao cấp (Mobile tự gập thẻ đứng) */}
                {!loading && !error && sortedCategories.length > 0 && (
                    <div className="space-y-6">
                        {sortedCategories.map((room) => {
                            const fallbackImg =
                                'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80';
                            const galleryList = [];
                            if (room.feature_image) galleryList.push(room.feature_image);
                            if (Array.isArray(room.images)) {
                                room.images.forEach((img) => {
                                    const u = img?.image_url || img?.image;
                                    if (u && !galleryList.includes(u)) galleryList.push(u);
                                });
                            }
                            if (galleryList.length === 0) galleryList.push(fallbackImg);

                            const hasPromo =
                                room.promo_price &&
                                Number(room.promo_price) > 0 &&
                                Number(room.promo_price) < Number(room.base_price);

                            const discountPercent = hasPromo
                                ? Math.round(
                                      ((Number(room.base_price) - Number(room.promo_price)) /
                                          Number(room.base_price)) *
                                          100
                                  )
                                : 0;

                            const formattedBasePrice = Number(room.base_price).toLocaleString('vi-VN');
                            const formattedPromoPrice = hasPromo
                                ? Number(room.promo_price).toLocaleString('vi-VN')
                                : null;

                            // Phân hạng phòng hiển thị phía trên tiêu đề
                            const lowerName = (room.name || '').toLowerCase();
                            const tierLabel = lowerName.includes('penthouse') || lowerName.includes('president')
                                ? 'DINH THỰ & PENTHOUSE HOÀNG GIA'
                                : lowerName.includes('suite')
                                    ? 'HẠNG SUITE CAO CẤP'
                                    : lowerName.includes('deluxe')
                                        ? 'HẠNG DELUXE TIÊU CHUẨN'
                                        : `HẠNG PHÒNG ${settings?.stars || 3} SAO`;

                            // Danh sách 4 tiện ích nổi bật lấy từ API (fallback tự động nếu chưa gán tiện ích)
                            const rawAmenities = Array.isArray(room.amenities)
                                ? room.amenities
                                      .map((a) => (typeof a === 'string' ? a : a?.name))
                                      .filter(Boolean)
                                : [];
                            const defaultHighlights = [
                                room.view_type ? `Tầm nhìn ${room.view_type}` : 'Ban công & ánh sáng tự nhiên',
                                'Wifi tốc độ cao & Smart TV',
                                'Phục vụ ẩm thực tận phòng 24/7',
                                'Miễn phí hồ bơi vô cực & gym'
                            ];
                            const highlights = (rawAmenities.length > 0 ? rawAmenities : defaultHighlights).slice(0, 4);

                            const avgRating = room.average_rating
                                ? Number(room.average_rating).toFixed(1)
                                : '5.0';
                            const reviewCount = Number(room.review_count) || 0;

                            return (
                                <article
                                    key={room.id}
                                    className="bg-white rounded-3xl overflow-hidden border border-slate-200/85 shadow-[0_6px_25px_-10px_rgba(15,23,42,0.08)] hover:shadow-[0_20px_45px_-15px_rgba(15,23,42,0.16)] hover:border-sky-200/90 transition-all duration-300 flex flex-col lg:flex-row group"
                                >
                                    {/* CỘT TRÁI: ẢNH PHÒNG RỘNG + VUỐT TAY / KÉO CHUỘT / MŨI TÊN CHUYỂN ẢNH */}
                                    <RoomCardImageCarousel
                                        images={galleryList}
                                        fallbackImg={fallbackImg}
                                        alt={room.name}
                                        to={`/rooms/${room.id}`}
                                        linkState={{
                                            checkInDate: effectiveCheckIn,
                                            checkOutDate: effectiveCheckOut,
                                            guestCount: effectiveGuests
                                        }}
                                        hasPromo={hasPromo}
                                        discountPercent={discountPercent}
                                        starCount={settings?.stars || 3}
                                    />

                                    {/* CỘT PHẢI: THÔNG TIN CHI TIẾT, THÔNG SỐ, TIỆN ÍCH & GIÁ */}
                                    <div className="flex-1 p-5 sm:p-7 flex flex-col justify-between gap-5">
                                        <div className="space-y-4">
                                            {/* Tầng 1: Phân hạng + Tên phòng Serif + Huy hiệu sao */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <span className="block text-[10.5px] font-bold uppercase tracking-[0.16em] text-amber-700 mb-1">
                                                        {tierLabel}
                                                    </span>
                                                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 group-hover:text-sky-700 transition-colors leading-snug">
                                                        <Link
                                                            to={`/rooms/${room.id}`}
                                                            state={{ checkInDate: effectiveCheckIn, checkOutDate: effectiveCheckOut, guestCount: effectiveGuests }}
                                                        >
                                                            {room.name}
                                                        </Link>
                                                    </h3>
                                                </div>

                                                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-800 shrink-0 tabular-nums">
                                                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                                    <span>{avgRating}</span>
                                                    {reviewCount > 0 && (
                                                        <span className="text-slate-400 font-medium">({reviewCount})</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Tầng 2A: Thanh thông số nền xanh phấn nhạt (Diện tích • Giường • Sức chứa) */}
                                            <div className="bg-[#f4f7fc] border border-slate-200/60 rounded-2xl px-3 sm:px-4 py-2.5 flex flex-wrap sm:grid sm:grid-cols-3 gap-x-3.5 gap-y-2 sm:gap-2 text-[11.5px] sm:text-xs font-semibold text-slate-700">
                                                <span className="flex items-center gap-1.5 min-w-0">
                                                    <Maximize2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                                    <span className="truncate">{room.size || 35} m²</span>
                                                </span>
                                                <span className="flex items-center gap-1.5 min-w-0" title={room.bed_type || '1 Giường King'}>
                                                    <BedDouble className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                                    <span className="truncate">{room.bed_type || '1 Giường King'}</span>
                                                </span>
                                                <span className="flex items-center gap-1.5 min-w-0">
                                                    <Users className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                                    <span className="truncate">{room.capacity || 2} người lớn</span>
                                                </span>
                                            </div>

                                            {/* Tầng 2B: 4 Tiện ích nổi bật (xếp 2 cột thoáng mắt, không cắt chữ) */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600">
                                                {highlights.map((hl, idx) => (
                                                    <span key={idx} className="flex items-center gap-2 min-w-0">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                                        <span className="truncate">{hl}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Tầng 3: Giá tiền & 2 Nút hành động (Mobile tự chia 50/50) */}
                                        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-auto">
                                            <div>
                                                {hasPromo ? (
                                                    <>
                                                        <span className="block text-xs line-through text-slate-400 tabular-nums">
                                                            {formattedBasePrice} VND
                                                        </span>
                                                        <div className="flex items-baseline gap-1.5">
                                                            <span className="text-2xl font-black text-rose-600 tracking-tight tabular-nums">
                                                                {formattedPromoPrice}
                                                            </span>
                                                            <span className="text-xs font-bold text-slate-500">
                                                                VND / đêm
                                                            </span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex items-baseline gap-1.5">
                                                        <span className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">
                                                            {formattedBasePrice}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-500">
                                                            VND / đêm
                                                        </span>
                                                    </div>
                                                )}
                                                <span className="block text-[11px] text-slate-400 mt-0.5">
                                                    Giá trực tiếp tốt nhất • Miễn phí tiện ích hồ bơi &amp; Wifi
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5 shrink-0">
                                                <Link
                                                    to={`/rooms/${room.id}`}
                                                    state={{ checkInDate: effectiveCheckIn, checkOutDate: effectiveCheckOut, guestCount: effectiveGuests }}
                                                    className="min-h-[42px] px-2.5 sm:px-5 py-2.5 sm:py-3 text-[11px] sm:text-xs font-bold text-slate-700 bg-slate-100/90 hover:bg-slate-200/80 rounded-xl transition whitespace-nowrap text-center flex items-center justify-center cursor-pointer active:scale-95"
                                                >
                                                    Xem Chi Tiết
                                                </Link>
                                                <Link
                                                    to={`/checkout/${room.id}`}
                                                    state={{ checkInDate: effectiveCheckIn, checkOutDate: effectiveCheckOut, guestCount: effectiveGuests }}
                                                    className="min-h-[42px] px-2.5 sm:px-6 py-2.5 sm:py-3 text-[11px] sm:text-xs font-bold text-white bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 rounded-xl shadow-[0_8px_20px_-6px_rgba(2,132,199,0.45)] hover:shadow-[0_12px_24px_-6px_rgba(2,132,199,0.55)] ring-1 ring-inset ring-white/20 transition-all transform active:scale-95 whitespace-nowrap text-center flex items-center justify-center gap-1 sm:gap-1.5 hover:-translate-y-0.5"
                                                >
                                                    <span>Đặt Phòng Ngay</span>
                                                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* 4. BẢNG SO SÁNH HẠNG PHÒNG & TIÊU CHUẨN TIỆN NGHI THỰC TẾ TỪ DATABASE */}
            {!loading && !error && categories.length > 0 && (
                <RoomsComparisonAndStandards
                    categories={categories}
                    settings={settings}
                    effectiveCheckIn={effectiveCheckIn}
                    effectiveCheckOut={effectiveCheckOut}
                    effectiveGuests={effectiveGuests}
                />
            )}

            <Footer />
        </div>
    );
}