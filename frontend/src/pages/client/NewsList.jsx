import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import postService from '../../services/postService';
import { useHotelSettings } from '../../store/hotelSettingStore';
import { useScrollAfterPageChange } from '../../utils/scrollUtils';
import {
    Search,
    Eye,
    Calendar,
    LayoutGrid,
    Flame,
    Compass,
    UtensilsCrossed,
    Tag,
    BookOpen,
    ChevronLeft,
    ChevronRight,
    User,
    ArrowRight,
    Newspaper,
    X,
    Image as ImageIcon,
} from 'lucide-react';

export default function NewsList() {
    const { settings } = useHotelSettings();
    const [posts, setPosts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const fetchPosts = async () => {
        setIsLoading(true);
        const params = {};
        if (selectedCategory !== 'all') params.category = selectedCategory;
        if (searchTerm.trim()) params.q = searchTerm.trim();

        const res = await postService.getPosts(params);
        if (res.success) {
            setPosts(res.posts || []);
        }
        setIsLoading(false);
    };

    const fetchCategories = async () => {
        const res = await postService.getCategories();
        if (res.success && res.categories) {
            setCategories([
                { value: 'all', label: 'Tất cả bài viết' },
                ...res.categories,
            ]);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchPosts();
        }, 300);
        return () => clearTimeout(timer);
    }, [selectedCategory, searchTerm]);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    // Helper chọn icon đẹp mắt theo danh mục
    const getCategoryIcon = (categoryValue) => {
        const val = (categoryValue || '').toLowerCase();
        if (val === 'all') return <LayoutGrid className="w-3.5 h-3.5" />;
        if (val.includes('du-lich') || val.includes('travel') || val.includes('dia-diem')) {
            return <Compass className="w-3.5 h-3.5" />;
        }
        if (val.includes('am-thuc') || val.includes('cuisine') || val.includes('food') || val.includes('nha-hang')) {
            return <UtensilsCrossed className="w-3.5 h-3.5" />;
        }
        if (val.includes('khuyen-mai') || val.includes('promotion') || val.includes('uu-dai')) {
            return <Tag className="w-3.5 h-3.5" />;
        }
        if (val.includes('su-kien') || val.includes('event') || val.includes('le-hoi')) {
            return <Calendar className="w-3.5 h-3.5" />;
        }
        return <BookOpen className="w-3.5 h-3.5" />;
    };

    // Phân trang & Sắp xếp bài viết
    const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'popular'
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 6; // 6 bài viết mỗi trang (2 hàng x 3 cột chuẩn giao diện hiện đại)

    // Tự động quay về trang 1 khi đổi chuyên mục, sắp xếp hoặc tìm kiếm
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCategory, searchTerm, sortBy]);

    // Sắp xếp danh sách bài viết
    const sortedPosts = useMemo(() => {
        if (sortBy === 'popular') {
            return [...posts].sort((a, b) => (Number(b.view_count) || 0) - (Number(a.view_count) || 0));
        }
        return posts;
    }, [posts, sortBy]);

    // Bài viết nổi bật là bài đầu tiên nếu ở trang 1, chuyên mục 'Tất cả', mặc định Mới nhất và không tìm kiếm
    const featuredPost = sortedPosts.length > 0 && selectedCategory === 'all' && !searchTerm && sortBy === 'newest' && currentPage === 1 ? sortedPosts[0] : null;

    // Nguồn bài viết cho danh sách grid
    const regularSourcePosts = useMemo(() => {
        if (selectedCategory === 'all' && !searchTerm && sortBy === 'newest') {
            return sortedPosts.slice(1);
        }
        return sortedPosts;
    }, [sortedPosts, selectedCategory, searchTerm, sortBy]);

    const totalPages = Math.max(1, Math.ceil(regularSourcePosts.length / pageSize));
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

    const paginatedPosts = useMemo(() => {
        const start = (safeCurrentPage - 1) * pageSize;
        return regularSourcePosts.slice(start, start + pageSize);
    }, [regularSourcePosts, safeCurrentPage, pageSize]);

    const requestPageScroll = useScrollAfterPageChange(safeCurrentPage, 'news-grid-section', {
        offset: 88,
        fallbackTop: 0,
    });

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > totalPages || newPage === safeCurrentPage) return;
        requestPageScroll();
        setCurrentPage(newPage);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
            <Navbar />

            {/* BREADCRUMB ĐỒNG BỘ VỊ TRÍ 100% VỚI CÁC TRANG CLIENT */}
            <div className="bg-slate-100/80 border-b border-slate-200/60 py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500 font-medium whitespace-nowrap overflow-x-auto no-scrollbar">
                        <Link to="/" className="hover:text-sky-600 transition shrink-0">Trang chủ</Link>
                        <span className="text-slate-300 shrink-0">/</span>
                        <span className="text-slate-900 font-semibold truncate min-w-0">Tin tức & Cẩm nang</span>
                    </nav>
                </div>
            </div>

            {/* HERO BANNER CHUẨN LUXURY RESORT */}
            <header className="relative bg-slate-950 overflow-hidden py-10 lg:py-14 border-b border-slate-800 shadow-md">
                <img
                    src={settings?.banner_news || "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=2000&q=85"}
                    alt="Khách Sạn TA Đà Nẵng Resort"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                />

                {/* Gradient Overlay bảo vệ độ tương phản chữ */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30" />

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-3xl flex flex-col items-start text-left">


                        <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-sm">
                            Khám Phá Trải Nghiệm & <br className="hidden sm:inline" />
                            <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-sky-400 bg-clip-text text-transparent">
                                Cẩm Nang Tinh Hoa
                            </span>
                        </h1>

                        <p className="text-sm sm:text-base text-gray-200 mt-4 leading-relaxed font-normal max-w-2xl drop-shadow-xs">
                            Cập nhật cẩm nang du lịch Đà Nẵng, nghệ thuật ẩm thực và các sự kiện nổi bật tại {settings?.hotel_name || 'Khách Sạn TA Đà Nẵng'}.
                        </p>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <main
                className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 space-y-12"
                style={{ overflowAnchor: 'none' }}
            >
                {/* BỘ LỌC DANH MỤC, TÌM KIẾM & SẮP XẾP */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                    {/* Tabs danh mục */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
                        {categories.map((cat) => {
                            const isActive = selectedCategory === cat.value;
                            return (
                                <button
                                    key={cat.value}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat.value)}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-2 ${isActive
                                            ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md shadow-sky-900/20 ring-2 ring-sky-400/20'
                                            : 'bg-white text-slate-600 hover:text-sky-700 hover:bg-sky-50/50 border border-slate-200 hover:border-sky-200'
                                        }`}
                                >
                                    <span>{getCategoryIcon(cat.value)}</span>
                                    <span>{cat.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Thanh tìm kiếm & Sắp xếp: Xếp dọc gọn ở 375px, 1 hàng từ sm trở lên */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0">
                        <div className="relative flex-1 lg:w-64 min-w-0">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Tìm bài viết, cẩm nang..."
                                className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-base sm:text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-3 focus:ring-sky-500/15 shadow-xs transition"
                            />
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-0.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                    title="Xóa tìm kiếm"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            aria-label="Sắp xếp bài viết"
                            className="w-full sm:w-auto px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-base sm:text-xs font-semibold text-slate-700 focus:outline-none focus:border-sky-500 focus:ring-3 focus:ring-sky-500/15 shadow-xs transition cursor-pointer shrink-0"
                        >
                            <option value="newest">Mới nhất</option>
                            <option value="popular">Xem nhiều nhất</option>
                        </select>
                    </div>
                </div>

                {/* FEATURED POST (BÀI VIẾT NỔI BẬT) */}
                {featuredPost && (
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden hover:shadow-xl hover:border-sky-200/80 transition-all duration-300 group">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                            {/* Cột ảnh bìa */}
                            <div className="lg:col-span-7 relative h-64 sm:h-80 lg:h-full min-h-[320px] overflow-hidden bg-slate-100">
                                {featuredPost.thumbnail_url ? (
                                    <img
                                        src={featuredPost.thumbnail_url}
                                        alt={featuredPost.title}
                                        loading="lazy"
                                        decoding="async"
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-sky-50 to-slate-100 text-sky-400">
                                        <ImageIcon className="w-16 h-16 stroke-1" />
                                    </div>
                                )}
                                <span className="absolute top-4 left-4 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 text-white font-bold text-[11px] uppercase tracking-wider shadow-lg shadow-sky-900/25 flex items-center gap-1.5 backdrop-blur-xs">
                                    <Flame className="w-3.5 h-3.5 text-sky-200" />
                                    <span>Bài viết nổi bật</span>
                                </span>
                            </div>

                            {/* Cột nội dung */}
                            <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
                                <div className="space-y-3.5">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-semibold">
                                        <span className="px-2.5 py-0.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-200/80">
                                            {featuredPost.category_display || featuredPost.category}
                                        </span>
                                        <span className="text-slate-300">•</span>
                                        <span className="flex items-center gap-1 text-slate-500">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            <span>{formatDate(featuredPost.created_at)}</span>
                                        </span>
                                        <span className="text-slate-300">•</span>
                                        <span className="flex items-center gap-1 text-slate-500">
                                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                                            <span>{featuredPost.view_count || 0} lượt xem</span>
                                        </span>
                                    </div>

                                    <Link to={`/news/${featuredPost.slug}`}>
                                        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 group-hover:text-sky-700 transition leading-snug">
                                            {featuredPost.title}
                                        </h2>
                                    </Link>

                                    <p className="text-slate-600 text-xs sm:text-sm line-clamp-3 leading-relaxed">
                                        {featuredPost.summary || 'Khám phá chi tiết những chia sẻ và trải nghiệm hấp dẫn tại bài viết này...'}
                                    </p>
                                </div>

                                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-600 to-blue-700 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                                            <User className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 block">
                                                {featuredPost.author || 'Ban Biên Tập'}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block">
                                                {settings?.hotel_name || 'Khách Sạn TA Đà Nẵng'}
                                            </span>
                                        </div>
                                    </div>

                                    <Link
                                        to={`/news/${featuredPost.slug}`}
                                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-sky-700 hover:text-sky-800 transition group/btn"
                                    >
                                        <span>Đọc toàn bài</span>
                                        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* GRID CÁC THẺ BÀI VIẾT (CARDS) */}
                {(isLoading || !featuredPost || regularSourcePosts.length > 0) && (
                    <div id="news-grid-section" className="scroll-mt-24 min-h-[45vh]">
                        <div className="flex items-center gap-2.5 mb-6">
                            <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200/70 flex items-center justify-center text-sky-600 shadow-2xs">
                                <BookOpen className="w-4 h-4" />
                            </div>
                            <h3 className="font-serif text-xl sm:text-2xl font-bold text-slate-900">
                                {featuredPost ? (
                                    'Bài Viết Mới Nhất'
                                ) : (
                                    selectedCategory !== 'all'
                                        ? `Chuyên Mục "${categories.find(c => c.value === selectedCategory)?.label || ''}"`
                                        : searchTerm
                                            ? `Kết Quả Tìm Kiếm: "${searchTerm}"`
                                            : sortBy === 'popular'
                                                ? 'Bài Viết Xem Nhiều Nhất'
                                                : `Tất Cả Bài Viết (Trang ${safeCurrentPage} / ${totalPages})`
                                )}
                            </h3>
                        </div>

                        {isLoading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <div key={i} className="bg-white rounded-3xl p-4 border border-slate-200 animate-pulse space-y-3">
                                        <div className="h-44 bg-slate-200 rounded-2xl"></div>
                                        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                                        <div className="h-5 bg-slate-200 rounded w-3/4"></div>
                                        <div className="h-3 bg-slate-200 rounded w-full"></div>
                                    </div>
                                ))}
                            </div>
                        ) : regularSourcePosts.length === 0 ? (
                            <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-xs max-w-md mx-auto space-y-4">
                                <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200/70 text-sky-600 flex items-center justify-center mx-auto shadow-2xs">
                                    <Newspaper className="w-7 h-7" />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-slate-900 mb-1">
                                        Chưa có bài viết nào
                                    </h4>
                                    <p className="text-xs text-slate-500">
                                        {searchTerm
                                            ? `Không tìm thấy bài viết nào phù hợp với từ khóa "${searchTerm}".`
                                            : 'Hiện chưa có bài viết nào trong chuyên mục này. Vui lòng quay lại sau!'}
                                    </p>
                                </div>
                                {(searchTerm || selectedCategory !== 'all') && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchTerm('');
                                            setSelectedCategory('all');
                                        }}
                                        className="px-5 py-2.5 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white text-xs font-bold rounded-xl shadow-md shadow-sky-900/20 transition cursor-pointer"
                                    >
                                        Xem tất cả bài viết
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {paginatedPosts.map((post) => (
                                    <article
                                        key={post.id}
                                        className="bg-white rounded-3xl border border-slate-200/90 hover:border-sky-200/90 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                                    >
                                        <div>
                                            {/* Ảnh bìa */}
                                            <Link to={`/news/${post.slug}`} className="block relative h-48 overflow-hidden bg-slate-100">
                                                {post.thumbnail_url ? (
                                                    <img
                                                        src={post.thumbnail_url}
                                                        alt={post.title}
                                                        loading="lazy"
                                                        decoding="async"
                                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-sky-50/70 to-slate-100 text-sky-300">
                                                        <ImageIcon className="w-10 h-10 stroke-1" />
                                                    </div>
                                                )}
                                                {/* Chuyên mục Badge */}
                                                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-white/95 backdrop-blur-xs border border-slate-200/80 text-[10px] font-bold text-sky-800 shadow-xs">
                                                    {post.category_display || post.category}
                                                </span>
                                            </Link>

                                            {/* Nội dung tóm tắt */}
                                            <div className="p-5 space-y-2">
                                                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3 text-slate-400" />
                                                        <span>{formatDate(post.created_at)}</span>
                                                    </span>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="flex items-center gap-1">
                                                        <Eye className="w-3 h-3 text-slate-400" />
                                                        <span>{post.view_count || 0}</span>
                                                    </span>
                                                </div>

                                                {/* Tiêu đề */}
                                                <Link to={`/news/${post.slug}`}>
                                                    <h3 className="font-serif font-bold text-base text-slate-900 group-hover:text-sky-700 transition line-clamp-2 leading-snug">
                                                        {post.title}
                                                    </h3>
                                                </Link>

                                                {/* Tóm tắt */}
                                                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                                    {post.summary || 'Khám phá chi tiết những thông tin hữu ích trong bài viết...'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Footer thẻ */}
                                        <div className="px-5 pb-5 pt-3 flex items-center justify-between border-t border-slate-100 text-xs">
                                            <span className="text-[11px] text-slate-600 font-semibold truncate max-w-[150px] flex items-center gap-1.5">
                                                <User className="w-3.5 h-3.5 text-slate-400" />
                                                <span>{post.author || 'Ban Biên Tập'}</span>
                                            </span>
                                            <Link
                                                to={`/news/${post.slug}`}
                                                className="font-bold text-sky-700 hover:text-sky-800 transition flex items-center gap-1 group/link"
                                            >
                                                <span>Xem tiếp</span>
                                                <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform" />
                                            </Link>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}

                        {/* THANH ĐIỀU HƯỚNG PHÂN TRANG (PAGINATION) */}
                        {!isLoading && totalPages > 1 && (
                            <div className="mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200/80">
                                {/* Thông tin số trang & bài viết */}
                                <div className="text-xs text-slate-500 font-medium">
                                    Đang xem trang <span className="font-bold text-sky-700">{safeCurrentPage}</span> / <span className="font-bold text-slate-800">{totalPages}</span> (Tổng cộng <span className="font-semibold text-slate-700">{regularSourcePosts.length}</span> bài viết)
                                </div>

                                {/* Các nút bấm phân trang */}
                                <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Phân trang tin tức">
                                    {/* Nút Trang Trước */}
                                    <button
                                        type="button"
                                        onClick={() => handlePageChange(safeCurrentPage - 1)}
                                        disabled={safeCurrentPage === 1}
                                        className={`min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${safeCurrentPage === 1
                                                ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-60'
                                                : 'bg-white text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 border border-slate-200 shadow-2xs cursor-pointer active:scale-95'
                                            }`}
                                        title="Về trang trước"
                                    >
                                        <ChevronLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                        <span className="hidden sm:inline">Trước</span>
                                    </button>

                                    {/* Các số trang (rút gọn dấu ... nếu > 5 trang) */}
                                    {(() => {
                                        const pages = [];
                                        if (totalPages <= 5) {
                                            for (let i = 1; i <= totalPages; i++) pages.push(i);
                                        } else {
                                            pages.push(1);
                                            if (safeCurrentPage > 3) pages.push('dots-left');
                                            const start = Math.max(2, safeCurrentPage - 1);
                                            const end = Math.min(totalPages - 1, safeCurrentPage + 1);
                                            for (let i = start; i <= end; i++) pages.push(i);
                                            if (safeCurrentPage < totalPages - 2) pages.push('dots-right');
                                            pages.push(totalPages);
                                        }
                                        return pages.map((pageItem) => {
                                            if (typeof pageItem === 'string') {
                                                return (
                                                    <span key={pageItem} className="w-7 h-10 sm:h-9 flex items-center justify-center text-slate-400 text-xs select-none">
                                                        …
                                                    </span>
                                                );
                                            }
                                            const isActive = pageItem === safeCurrentPage;
                                            return (
                                                <button
                                                    key={pageItem}
                                                    type="button"
                                                    onClick={() => handlePageChange(pageItem)}
                                                    className={`w-10 h-10 sm:w-9 sm:h-9 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${isActive
                                                            ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md shadow-sky-900/20 ring-2 ring-sky-400/20'
                                                            : 'bg-white text-slate-700 hover:text-sky-700 hover:bg-sky-50/50 border border-slate-200 shadow-2xs hover:border-sky-200 active:scale-95'
                                                        }`}
                                                    aria-current={isActive ? 'page' : undefined}
                                                    title={`Trang ${pageItem}`}
                                                >
                                                    {pageItem}
                                                </button>
                                            );
                                        });
                                    })()}

                                    {/* Nút Trang Kế Tiếp */}
                                    <button
                                        type="button"
                                        onClick={() => handlePageChange(safeCurrentPage + 1)}
                                        disabled={safeCurrentPage === totalPages}
                                        className={`min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${safeCurrentPage === totalPages
                                                ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-60'
                                                : 'bg-white text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 border border-slate-200 shadow-2xs cursor-pointer active:scale-95'
                                            }`}
                                        title="Sang trang kế tiếp"
                                    >
                                        <span className="hidden sm:inline">Sau</span>
                                        <ChevronRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                    </button>
                                </nav>
                            </div>
                        )}
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
