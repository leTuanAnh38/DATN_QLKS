import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import postService from '../../services/postService';
import { useHotelSettings } from '../../store/hotelSettingStore';
import {
    Search,
    Eye,
    Calendar,
    Sparkles,
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
        if (val === 'all') return <Sparkles className="w-3.5 h-3.5" />;
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

    // Phân trang bài viết
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 6; // 6 bài viết mỗi trang (2 hàng x 3 cột chuẩn giao diện hiện đại)

    // Tự động quay về trang 1 khi đổi chuyên mục hoặc tìm kiếm
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCategory, searchTerm]);

    // Bài viết nổi bật là bài đầu tiên nếu ở trang 1, chuyên mục 'Tất cả' và không tìm kiếm
    const featuredPost = posts.length > 0 && selectedCategory === 'all' && !searchTerm && currentPage === 1 ? posts[0] : null;

    // Nguồn bài viết cho danh sách grid:
    // Khi ở chuyên mục 'Tất cả' và không tìm kiếm, bài đầu tiên được dùng làm Hero Featured nên grid lấy từ bài thứ 2 trở đi
    const regularSourcePosts = useMemo(() => {
        if (selectedCategory === 'all' && !searchTerm) {
            return posts.slice(1);
        }
        return posts;
    }, [posts, selectedCategory, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(regularSourcePosts.length / pageSize));
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

    const paginatedPosts = useMemo(() => {
        const start = (safeCurrentPage - 1) * pageSize;
        return regularSourcePosts.slice(start, start + pageSize);
    }, [regularSourcePosts, safeCurrentPage, pageSize]);

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > totalPages || newPage === safeCurrentPage) return;
        setCurrentPage(newPage);
        const section = document.getElementById('news-grid-section');
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            window.scrollTo({ top: 380, behavior: 'smooth' });
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
            <Navbar />

            {/* BREADCRUMB ĐỒNG BỘ VỊ TRÍ 100% VỚI CÁC TRANG CLIENT */}
            <div className="bg-slate-100/80 border-b border-slate-200/60 py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
                        <Link to="/" className="hover:text-amber-600 transition">Trang chủ</Link>
                        <span className="text-slate-300">/</span>
                        <span className="text-slate-900 font-semibold">Tin tức & Cẩm nang</span>
                    </nav>
                </div>
            </div>

            {/* HERO BANNER CHUẨN LUXURY RESORT */}
            <header className="relative bg-slate-950 overflow-hidden py-16 lg:py-24 border-b border-slate-800 shadow-md">
                <img
                    src={settings?.banner_news || "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=2000&q=85"}
                    alt="Khách Sạn TA Đà Nẵng Resort"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                />

                {/* Gradient Overlay bảo vệ độ tương phản chữ */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30" />

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-3xl flex flex-col items-start text-left">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/30 backdrop-blur-md mb-4 text-amber-300 text-xs font-bold tracking-wider uppercase">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Góc Nhìn Nghỉ Dưỡng & Trải Nghiệm</span>
                        </div>

                        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-sm">
                            Khám Phá Trải Nghiệm & <br className="hidden sm:inline" />
                            <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">
                                Cẩm Nang Tinh Hoa
                            </span>
                        </h1>

                        <p className="text-sm sm:text-base text-gray-200 mt-4 leading-relaxed font-normal max-w-2xl drop-shadow-xs">
                            Cập nhật những thông tin mới nhất về văn hóa du lịch, nghệ thuật ẩm thực tinh tế và các sự kiện, ưu đãi đặc quyền tại Khách Sạn TA Đà Nẵng.
                        </p>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 space-y-12">
                {/* BỘ LỌC DANH MỤC & TÌM KIẾM SANG TRỌNG */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                    {/* Tabs danh mục */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                        {categories.map((cat) => {
                            const isActive = selectedCategory === cat.value;
                            return (
                                <button
                                    key={cat.value}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat.value)}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-2 ${
                                        isActive
                                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-400/20'
                                            : 'bg-white text-slate-600 hover:text-amber-600 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-200'
                                    }`}
                                >
                                    <span>{getCategoryIcon(cat.value)}</span>
                                    <span>{cat.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Ô tìm kiếm sang trọng với icon Search */}
                    <div className="relative w-full md:w-80 shrink-0">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm bài viết, cẩm nang, ẩm thực..."
                            className="w-full pl-9 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-500/15 shadow-xs transition"
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100 transition cursor-pointer"
                                title="Xóa tìm kiếm"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* FEATURED POST (BÀI VIẾT NỔI BẬT) */}
                {featuredPost && (
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden hover:shadow-xl hover:border-amber-200/70 transition-all duration-300 group">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                            {/* Cột ảnh bìa */}
                            <div className="lg:col-span-7 relative h-64 sm:h-80 lg:h-full min-h-[320px] overflow-hidden bg-slate-100">
                                {featuredPost.thumbnail_url ? (
                                    <img
                                        src={featuredPost.thumbnail_url}
                                        alt={featuredPost.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-amber-50 to-orange-50 text-amber-400">
                                        <ImageIcon className="w-16 h-16 stroke-1" />
                                    </div>
                                )}
                                <span className="absolute top-4 left-4 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-[11px] uppercase tracking-wider shadow-lg shadow-amber-500/30 flex items-center gap-1.5 backdrop-blur-xs">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Bài viết nổi bật</span>
                                </span>
                            </div>

                            {/* Cột nội dung */}
                            <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
                                <div className="space-y-3.5">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-semibold">
                                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
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
                                        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 group-hover:text-amber-600 transition leading-snug">
                                            {featuredPost.title}
                                        </h2>
                                    </Link>

                                    <p className="text-slate-600 text-xs sm:text-sm line-clamp-3 leading-relaxed">
                                        {featuredPost.summary || 'Khám phá chi tiết những chia sẻ và trải nghiệm hấp dẫn tại bài viết này...'}
                                    </p>
                                </div>

                                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                                            <User className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 block">
                                                {featuredPost.author || 'Ban Biên Tập'}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block">
                                                Khách Sạn TA Đà Nẵng
                                            </span>
                                        </div>
                                    </div>

                                    <Link
                                        to={`/news/${featuredPost.slug}`}
                                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-600 hover:text-amber-700 transition group/btn"
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
                <div id="news-grid-section" className="scroll-mt-8">
                    <div className="flex items-center gap-2.5 mb-6">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shadow-2xs">
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
                            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-600 flex items-center justify-center mx-auto shadow-2xs">
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
                                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
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
                                    className="bg-white rounded-3xl border border-slate-200/90 hover:border-amber-200/80 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                                >
                                    <div>
                                        {/* Ảnh bìa */}
                                        <Link to={`/news/${post.slug}`} className="block relative h-48 overflow-hidden bg-slate-100">
                                            {post.thumbnail_url ? (
                                                <img
                                                    src={post.thumbnail_url}
                                                    alt={post.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-amber-50/50 to-orange-50/50 text-amber-300">
                                                    <ImageIcon className="w-10 h-10 stroke-1" />
                                                </div>
                                            )}
                                            {/* Chuyên mục Badge */}
                                            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-white/95 backdrop-blur-xs border border-amber-100 text-[10px] font-bold text-amber-900 shadow-xs">
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
                                                <h3 className="font-serif font-bold text-base text-slate-900 group-hover:text-amber-600 transition line-clamp-2 leading-snug">
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
                                            className="font-bold text-amber-600 hover:text-amber-700 transition flex items-center gap-1 group/link"
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
                                Đang xem trang <span className="font-bold text-amber-600">{safeCurrentPage}</span> / <span className="font-bold text-slate-800">{totalPages}</span> (Tổng cộng <span className="font-semibold text-slate-700">{regularSourcePosts.length}</span> bài viết)
                            </div>

                            {/* Các nút bấm phân trang */}
                            <nav className="flex items-center gap-1.5" aria-label="Phân trang tin tức">
                                {/* Nút Trang Trước */}
                                <button
                                    type="button"
                                    onClick={() => handlePageChange(safeCurrentPage - 1)}
                                    disabled={safeCurrentPage === 1}
                                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                                        safeCurrentPage === 1
                                            ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-60'
                                            : 'bg-white text-slate-700 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 border border-slate-200 shadow-2xs cursor-pointer active:scale-95'
                                    }`}
                                    title="Về trang trước"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Trước</span>
                                </button>

                                {/* Các số trang */}
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                                    const isActive = pageNum === safeCurrentPage;
                                    return (
                                        <button
                                            key={pageNum}
                                            type="button"
                                            onClick={() => handlePageChange(pageNum)}
                                            className={`w-9 h-9 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                                                isActive
                                                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-400/20'
                                                    : 'bg-white text-slate-700 hover:text-amber-600 hover:bg-amber-50/50 border border-slate-200 shadow-2xs hover:border-amber-200 active:scale-95'
                                            }`}
                                            aria-current={isActive ? 'page' : undefined}
                                            title={`Trang ${pageNum}`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}

                                {/* Nút Trang Kế Tiếp */}
                                <button
                                    type="button"
                                    onClick={() => handlePageChange(safeCurrentPage + 1)}
                                    disabled={safeCurrentPage === totalPages}
                                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                                        safeCurrentPage === totalPages
                                            ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-60'
                                            : 'bg-white text-slate-700 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 border border-slate-200 shadow-2xs cursor-pointer active:scale-95'
                                    }`}
                                    title="Sang trang kế tiếp"
                                >
                                    <span className="hidden sm:inline">Sau</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </nav>
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}
