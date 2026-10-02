import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import postService from '../../services/postService';

export default function NewsList() {
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

    // Bài viết nổi bật là bài đầu tiên nếu có
    const featuredPost = posts.length > 0 && selectedCategory === 'all' && !searchTerm ? posts[0] : null;
    const regularPosts = featuredPost ? posts.slice(1) : posts;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
            <Navbar />

            {/* BREADCRUMB ĐỒNG BỘ VỊ TRÍ 100% VỚI TRANG MENU DỊCH VỤ */}
            <div className="bg-white border-b border-slate-100 py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500">
                        <Link to="/" className="hover:text-blue-600 transition">Trang chủ</Link>
                        <span>/</span>
                        <span className="text-slate-900 font-semibold">Tin tức & Cẩm nang</span>
                    </nav>
                </div>
            </div>

            {/* HERO BANNER CHUẨN LUXURY HOTEL (ẢNH SẮC NÉT + GRADIENT OVERLAY) */}
            <header className="relative bg-slate-950 overflow-hidden py-16 lg:py-24 border-b border-slate-800 shadow-md">
                {/* 1. Ảnh nền sắc nét 100% không giảm opacity, không blur */}
                <img
                    src="https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=2000&q=85"
                    alt="Khách Sạn TA Đà Nẵng Resort"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                />

                {/* 2. Lớp phủ Gradient tối (Gradient Overlay) bảo vệ độ tương phản chữ */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/20" />

                {/* 3. Nội dung chữ nổi bật tuyệt đối (relative z-10) */}
                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-3xl flex flex-col items-start text-left">
                        {/* Tiêu đề trắng nổi bật với từ khóa vàng Gold */}
                        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-sm">
                            Khám Phá Trải Nghiệm & <br className="hidden sm:inline" />
                            <span className="text-amber-400">
                                Cẩm Nang Nghỉ Dưỡng Tinh Hoa
                            </span>
                        </h1>

                        {/* Mô tả chữ xám trắng sắc nét */}
                        <p className="text-sm sm:text-base text-gray-200 mt-4 leading-relaxed font-normal max-w-2xl drop-shadow-xs">
                            Cập nhật những thông tin mới nhất về văn hóa du lịch, nghệ thuật ẩm thực tinh tế và các sự kiện, ưu đãi đặc quyền tại Khách Sạn TA Đà Nẵng.
                        </p>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 space-y-12">
                {/* BỘ LỌC DANH MỤC & TÌM KIẾM (ĐỒNG BỘ 100% VỚI MENU DỊCH VỤ) */}
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
                                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                                        isActive
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                                >
                                    <span>{cat.value === 'all' ? '✨' : '🏷️'}</span>
                                    <span>{cat.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Ô tìm kiếm nhỏ gọn y hệt trang Menu Dịch Vụ */}
                    <div className="relative w-full md:w-72 shrink-0">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm bài viết, cẩm nang, ẩm thực..."
                            className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                        />
                        <span className="absolute left-3 top-3 text-slate-400 text-xs">🔍</span>
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs p-0.5 cursor-pointer"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* FEATURED POST (NẾU CÓ) */}
                {featuredPost && (
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden hover:shadow-xl transition duration-300">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                            {/* Cột ảnh bìa */}
                            <div className="lg:col-span-7 relative h-64 sm:h-80 lg:h-full min-h-[300px] overflow-hidden bg-slate-100">
                                {featuredPost.thumbnail_url ? (
                                    <img
                                        src={featuredPost.thumbnail_url}
                                        alt={featuredPost.title}
                                        className="w-full h-full object-cover hover:scale-105 transition duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-slate-800 to-slate-900 text-slate-400 text-4xl">
                                        📰
                                    </div>
                                )}
                                <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md">
                                    ★ Bài viết nổi bật
                                </span>
                            </div>

                            {/* Cột nội dung */}
                            <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                                        <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                                            {featuredPost.category_display || featuredPost.category}
                                        </span>
                                        <span>•</span>
                                        <span>{formatDate(featuredPost.created_at)}</span>
                                        <span>•</span>
                                        <span>👁️ {featuredPost.view_count || 0} lượt xem</span>
                                    </div>

                                    <Link to={`/news/${featuredPost.slug}`}>
                                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 hover:text-blue-600 transition leading-snug">
                                            {featuredPost.title}
                                        </h2>
                                    </Link>

                                    <p className="text-slate-600 text-xs sm:text-sm line-clamp-3 leading-relaxed">
                                        {featuredPost.summary || 'Khám phá chi tiết những chia sẻ và trải nghiệm hấp dẫn tại bài viết này...'}
                                    </p>
                                </div>

                                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold">
                                            ✍️
                                        </div>
                                        <span className="text-xs font-bold text-slate-700">
                                            {featuredPost.author || 'Ban Biên Tập'}
                                        </span>
                                    </div>

                                    <Link
                                        to={`/news/${featuredPost.slug}`}
                                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-800 transition"
                                    >
                                        <span>Đọc toàn bài</span>
                                        <span>→</span>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* GRID CÁC THẺ BÀI VIẾT (CARDS) */}
                <div>
                    {featuredPost && (
                        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <span>📚</span>
                            <span>Bài Viết Mới Nhất</span>
                        </h3>
                    )}

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
                    ) : regularPosts.length === 0 ? (
                        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-xs max-w-md mx-auto">
                            <div className="text-4xl mb-3">📰</div>
                            <h4 className="text-base font-bold text-slate-900 mb-1">
                                Chưa có bài viết nào
                            </h4>
                            <p className="text-xs text-slate-500 mb-4">
                                {searchTerm
                                    ? `Không tìm thấy bài viết nào phù hợp với từ khóa "${searchTerm}".`
                                    : 'Hiện chưa có bài viết nào trong chuyên mục này. Vui lòng quay lại sau!'}
                            </p>
                            {(searchTerm || selectedCategory !== 'all') && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setSelectedCategory('all');
                                    }}
                                    className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer"
                                >
                                    Xem tất cả bài viết
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {regularPosts.map((post) => (
                                <article
                                    key={post.id}
                                    className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between overflow-hidden group"
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
                                                <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 text-3xl">
                                                    🖼️
                                                </div>
                                            )}
                                            {/* Chuyên mục Badge */}
                                            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur-xs border border-slate-200 text-[10px] font-bold text-slate-800 shadow-xs">
                                                {post.category_display || post.category}
                                            </span>
                                        </Link>

                                        {/* Nội dung tóm tắt */}
                                        <div className="p-5 space-y-2">
                                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                                                <span>{formatDate(post.created_at)}</span>
                                                <span>•</span>
                                                <span>👁️ {post.view_count || 0}</span>
                                            </div>

                                            {/* Tiêu đề */}
                                            <Link to={`/news/${post.slug}`}>
                                                <h3 className="font-bold text-base text-slate-900 group-hover:text-blue-600 transition line-clamp-2 leading-snug">
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
                                    <div className="px-5 pb-5 pt-2 flex items-center justify-between border-t border-slate-50 text-xs">
                                        <span className="text-[11px] text-slate-500 font-semibold truncate max-w-[150px]">
                                            ✍️ {post.author || 'Ban Biên Tập'}
                                        </span>
                                        <Link
                                            to={`/news/${post.slug}`}
                                            className="font-bold text-blue-600 hover:text-blue-800 transition flex items-center gap-1"
                                        >
                                            <span>Xem tiếp</span>
                                            <span>→</span>
                                        </Link>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}
