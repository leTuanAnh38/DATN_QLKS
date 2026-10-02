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
        fetchPosts();
    }, [selectedCategory]);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchPosts();
    };

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

            {/* HERO BANNER SÁNG SỦA & SANG TRỌNG */}
            <section className="relative py-16 md:py-24 overflow-hidden border-b border-slate-200">
                {/* Ảnh nền Resort Nắng Sáng Rực Rỡ */}
                <div className="absolute inset-0 z-0">
                    <img
                        src="https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=2000&q=85"
                        alt="Khách Sạn TA Đà Nẵng Resort"
                        className="w-full h-full object-cover object-center"
                    />
                    {/* Lớp phủ sáng mượt mà giúp chữ rõ nét, giữ trọn ánh sáng tự nhiên của biển và hồ bơi */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/85 via-white/70 to-slate-50 backdrop-blur-[1px]" />
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-800 text-xs font-bold uppercase tracking-widest mb-4 shadow-xs backdrop-blur-md">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        TIN TỨC & CẨM NANG NGHỈ DƯỠNG
                    </span>
                    <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
                        Khám Phá Trải Nghiệm & <span className="text-amber-600">Cẩm Nang Tinh Hoa</span>
                    </h1>
                    <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
                        Cập nhật những thông tin mới nhất về văn hóa du lịch, nghệ thuật ẩm thực tinh tế và các sự kiện, ưu đãi đặc quyền tại khách sạn.
                    </p>

                    {/* SEARCH FORM TRÊN HERO SÁNG SỦA */}
                    <form onSubmit={handleSearch} className="mt-8 max-w-xl mx-auto flex items-center bg-white/95 backdrop-blur-md rounded-2xl p-1.5 border border-slate-200 shadow-xl shadow-slate-900/5">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm kiếm bài viết, cẩm nang, ẩm thực..."
                            className="flex-1 bg-transparent px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
                        />
                        <button
                            type="submit"
                            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1.5"
                        >
                            <span>🔍</span>
                            <span>Tìm kiếm</span>
                        </button>
                    </form>
                </div>
            </section>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 space-y-12">
                {/* CATEGORY TABS BAR */}
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4 overflow-x-auto">
                    <div className="flex items-center gap-2">
                        {categories.map((cat) => {
                            const isActive = selectedCategory === cat.value;
                            return (
                                <button
                                    key={cat.value}
                                    type="button"
                                    onClick={() => setSelectedCategory(cat.value)}
                                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
                                        isActive
                                            ? 'bg-slate-900 text-white shadow-md'
                                            : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                                    }`}
                                >
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>

                    <span className="text-xs text-slate-500 font-medium hidden sm:inline whitespace-nowrap">
                        Hiển thị <strong>{posts.length}</strong> bài viết
                    </span>
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
