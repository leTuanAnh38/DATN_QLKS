import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import roomService from '../../services/roomService';

/**
 * Trang Danh sách Phòng nghỉ & Suites dành cho Khách hàng (RoomsPage)
 * Sử dụng useEffect gọi API lấy danh sách RoomCategory thực tế từ Django Backend
 * Hiển thị dạng Grid layout: grid grid-cols-1 md:grid-cols-3 gap-6
 * Tích hợp trạng thái Loading (Skeleton) và xử lý ảnh đại diện chuẩn PMS
 */
export default function RoomsAndSuitesPage() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTab, setSelectedTab] = useState('all');
    const [sortBy, setSortBy] = useState('featured');

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

    // Lọc theo từ khóa tìm kiếm và tab danh mục
    const filteredCategories = categories.filter((room) => {
        const matchesSearch =
            searchQuery.trim() === '' ||
            room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            room.bed_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            room.description?.toLowerCase().includes(searchQuery.toLowerCase());

        let matchesTab = true;
        if (selectedTab === 'deluxe') {
            matchesTab = room.name.toLowerCase().includes('deluxe');
        } else if (selectedTab === 'suite') {
            matchesTab = room.name.toLowerCase().includes('suite');
        } else if (selectedTab === 'penthouse') {
            matchesTab =
                room.name.toLowerCase().includes('penthouse') ||
                room.name.toLowerCase().includes('president');
        }

        return matchesSearch && matchesTab;
    });

    // Sắp xếp danh sách
    const sortedCategories = [...filteredCategories].sort((a, b) => {
        if (sortBy === 'price-asc') return Number(a.base_price) - Number(b.base_price);
        if (sortBy === 'price-desc') return Number(b.base_price) - Number(a.base_price);
        if (sortBy === 'size-desc') return Number(b.size) - Number(a.size);
        if (sortBy === 'capacity-desc') return Number(b.capacity) - Number(a.capacity);
        return 0;
    });

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white flex flex-col">
            <Navbar />

            {/* 1. HERO BREADCRUMB & BANNER */}
            <section className="bg-white border-b border-slate-200 pt-8 pb-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500 mb-4">
                        <Link to="/" className="hover:text-blue-600 transition">Trang chủ</Link>
                        <span>/</span>
                        <span className="text-blue-600 font-medium">Phòng nghỉ & Suites</span>
                    </nav>

                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                        <div className="max-w-3xl">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-wider mb-3">
                                💎 Bộ Sưu Tập Phòng Thượng Lưu 2026
                            </span>
                            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
                                Tuyệt Tác Không Gian Nghỉ Dưỡng Biển Mỹ Khê
                            </h1>
                            <p className="text-slate-600 text-sm sm:text-base mt-3 leading-relaxed font-light">
                                Trải nghiệm các hạng phòng và suites 5 sao chuẩn quốc tế, sở hữu tầm nhìn trực diện biển xanh bao la cùng dịch vụ phòng cao cấp 24/7.
                            </p>
                        </div>

                        {/* Guarantee Badge */}
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3.5 shrink-0 shadow-xs">
                            <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-lg">
                                🛡️
                            </div>
                            <div className="text-xs">
                                <div className="font-bold text-slate-900">Cam Kết Giá Trực Tuyến Tốt Nhất</div>
                                <div className="text-slate-500">Miễn phí hủy phòng & Tặng voucher ẩm thực VIP</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 2. FILTER & SEARCH TOOLBAR */}
            <section className="sticky top-20 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 py-4 shadow-xs">
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
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                                        selectedTab === tab.id
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Search & Sort Controls */}
                        <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
                            <div className="relative flex-1 md:w-64">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Tìm tên phòng, loại giường..."
                                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none">
                                    🔍
                                </span>
                            </div>

                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
                            >
                                <option value="featured">Đề xuất hàng đầu</option>
                                <option value="price-asc">Giá: Thấp đến Cao</option>
                                <option value="price-desc">Giá: Cao đến Thấp</option>
                                <option value="size-desc">Diện tích rộng nhất</option>
                                <option value="capacity-desc">Sức chứa nhiều nhất</option>
                            </select>
                        </div>
                    </div>
                </div>
            </section>

            {/* 3. MAIN CONTENT: GRID LAYOUT CHUẨN (grid grid-cols-1 md:grid-cols-3 gap-6) */}
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
                {/* Trạng thái Loading (Skeleton) */}
                {loading && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                            <div
                                key={n}
                                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs p-0 animate-pulse space-y-4"
                            >
                                <div className="h-64 bg-slate-200"></div>
                                <div className="p-6 space-y-3">
                                    <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                                    <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                                    <div className="h-4 bg-slate-100 rounded w-full"></div>
                                    <div className="h-10 bg-slate-200 rounded-xl mt-4"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Trạng thái Lỗi */}
                {!loading && error && (
                    <div className="bg-rose-50 border border-rose-200 rounded-3xl p-10 text-center max-w-lg mx-auto">
                        <div className="text-4xl mb-3">⚠️</div>
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
                        <div className="text-5xl mb-3">🏝️</div>
                        <h3 className="text-base font-bold text-slate-900">Không tìm thấy hạng phòng phù hợp</h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Vui lòng thử tìm kiếm lại bằng từ khóa khác hoặc chọn xem tất cả hạng phòng.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('');
                                setSelectedTab('all');
                            }}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30"
                        >
                            Xem Tất Cả Hạng Phòng
                        </button>
                    </div>
                )}

                {/* Danh sách phòng dạng Grid Layout 3 cột (grid grid-cols-1 md:grid-cols-3 gap-6) */}
                {!loading && !error && sortedCategories.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {sortedCategories.map((room) => {
                            const primaryImage =
                                room.feature_image ||
                                room.images?.find((img) => img.is_feature)?.image_url ||
                                room.images?.[0]?.image_url ||
                                room.images?.[0]?.image ||
                                'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80';

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

                            return (
                                <div
                                    key={room.id}
                                    className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group"
                                >
                                    {/* Ảnh đại diện chính to ở trên */}
                                    <div className="relative h-64 w-full overflow-hidden bg-slate-900 shrink-0">
                                        <Link to={`/rooms/${room.id}`} className="block w-full h-full">
                                            <img
                                                src={primaryImage}
                                                alt={room.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition duration-500 ease-out cursor-pointer"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src =
                                                        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80';
                                                }}
                                            />
                                        </Link>

                                        {/* Overlay gradient */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/20 pointer-events-none"></div>

                                        {/* Badges góc trên */}
                                        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 pointer-events-none">
                                            {hasPromo && (
                                                <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                                                    GIẢM {discountPercent}%
                                                </span>
                                            )}
                                            <span className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold border border-white/20">
                                                5-STAR RESORT
                                            </span>
                                        </div>

                                        <div className="absolute top-3 right-3 pointer-events-none">
                                            <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-medium flex items-center gap-1 border border-white/20">
                                                📸 {room.images?.length || 1} ảnh
                                            </span>
                                        </div>

                                        {/* Thông số nhanh chân ảnh */}
                                        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white text-xs pointer-events-none">
                                            <span>📐 {room.size} m²</span>
                                            <span>👥 {room.capacity} người lớn</span>
                                            <span className="truncate max-w-[130px]">🛏️ {room.bed_type}</span>
                                        </div>
                                    </div>

                                    {/* Thân thẻ thông tin */}
                                    <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                                        <div>
                                            {/* Tên Hạng Phòng */}
                                            <h3 className="font-serif text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                                                <Link to={`/rooms/${room.id}`}>{room.name}</Link>
                                            </h3>

                                            {/* Tiện nghi kèm theo */}
                                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                                                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold">
                                                    Ban công view biển
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                                                    Buffet sáng VIP
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-semibold">
                                                    Bồn tắm thư giãn
                                                </span>
                                            </div>

                                            {/* Mô tả chi tiết */}
                                            <p className="mt-3 text-xs text-slate-600 line-clamp-2 leading-relaxed font-normal">
                                                {room.description ||
                                                    'Phòng nghỉ thượng lưu được trang bị đầy đủ nội thất nhập khẩu, view biển panorama và tiện ích 5 sao đồng bộ.'}
                                            </p>
                                        </div>

                                        {/* Giá tiền & Nút Đặt phòng ngay */}
                                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                                            <div>
                                                {hasPromo ? (
                                                    <>
                                                        <span className="block text-[11px] line-through text-slate-400">
                                                            {formattedBasePrice} VND
                                                        </span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-xl font-black text-rose-600">
                                                                {formattedPromoPrice}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                                                                VND / đêm
                                                            </span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div>
                                                        <span className="block text-[10px] text-slate-400 uppercase">
                                                            Giá phòng niêm yết
                                                        </span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-xl font-black text-slate-900">
                                                                {formattedBasePrice}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                                                                VND / đêm
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Link
                                                    to={`/rooms/${room.id}`}
                                                    className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                                                >
                                                    Xem chi tiết
                                                </Link>
                                                <Link
                                                    to={`/checkout/${room.id}`}
                                                    className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/30 transition transform active:scale-95 whitespace-nowrap"
                                                >
                                                    Đặt ngay
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}