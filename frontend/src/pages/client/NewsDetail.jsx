import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import postService from '../../services/postService';

export default function NewsDetail() {
    const { slug } = useParams();
    const navigate = useNavigate();

    const [post, setPost] = useState(null);
    const [latestPosts, setLatestPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        const fetchDetail = async () => {
            setIsLoading(true);
            setError(null);

            const res = await postService.getPostDetail(slug);
            if (res.success && res.post) {
                setPost(res.post);
                // Cập nhật thẻ Title của trình duyệt cho SEO
                document.title = `${res.post.title} | Khách Sạn & Nghỉ Dưỡng`;
            } else {
                setError(res.message || 'Không tìm thấy bài viết hoặc bài viết đã bị gỡ bỏ.');
            }
            setIsLoading(false);
        };

        const fetchLatest = async () => {
            const res = await postService.getLatestPosts();
            if (res.success && res.posts) {
                setLatestPosts(res.posts);
            }
        };

        fetchDetail();
        fetchLatest();
        window.scrollTo(0, 0);
    }, [slug]);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
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

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
            <Navbar />

            {/* BREADCRUMB & HEADER TOP SPACER */}
            <div className="pt-28 md:pt-32 pb-4 bg-slate-900 border-b border-slate-800 text-slate-400 text-xs">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-2 overflow-x-auto">
                    <Link to="/" className="hover:text-white transition">Trang chủ</Link>
                    <span>/</span>
                    <Link to="/news" className="hover:text-white transition">Tin tức</Link>
                    <span>/</span>
                    <span className="text-slate-200 truncate">{post?.title || 'Chi tiết bài viết'}</span>
                </div>
            </div>

            <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                {isLoading ? (
                    <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-xs max-w-md mx-auto">
                        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-xs text-slate-500 font-semibold">Đang tải bài viết...</p>
                    </div>
                ) : error || !post ? (
                    <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-xs max-w-md mx-auto space-y-4">
                        <div className="text-4xl">⚠️</div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Không tìm thấy bài viết
                        </h2>
                        <p className="text-xs text-slate-500">
                            {error || 'Bài viết bạn đang tìm kiếm có thể đã được gỡ xuống hoặc đường dẫn tĩnh không chính xác.'}
                        </p>
                        <Link
                            to="/news"
                            className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition"
                        >
                            ← Quay lại Trang Tin Tức
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                        {/* CỘT CHÍNH: NỘI DUNG BÀI VIẾT */}
                        <article className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-xs space-y-6">
                            {/* Meta Head */}
                            <div className="space-y-3 pb-6 border-b border-slate-100">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold uppercase tracking-wider">
                                        {post.category_display || post.category}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-xs text-slate-500 font-medium">
                                        📅 {formatDate(post.created_at)}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-xs text-slate-500 font-medium">
                                        👁️ {post.view_count || 0} lượt xem
                                    </span>
                                </div>

                                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight tracking-tight">
                                    {post.title}
                                </h1>

                                <div className="flex items-center justify-between pt-2">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold shadow-xs">
                                            ✍️
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 block">
                                                {post.author || 'Ban Biên Tập'}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block">
                                                Khách sạn & Khu nghỉ dưỡng cao cấp
                                            </span>
                                        </div>
                                    </div>

                                    {/* Nút chia sẻ */}
                                    <button
                                        type="button"
                                        onClick={handleCopyLink}
                                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-blue-600 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5"
                                    >
                                        <span>{isCopied ? '✓ Đã chép link' : '🔗 Chia sẻ bài'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Tóm tắt nổi bật (Lead Text) */}
                            {post.summary && (
                                <div className="p-4 rounded-2xl bg-slate-50 border-l-4 border-amber-500 text-xs sm:text-sm text-slate-700 italic leading-relaxed">
                                    {post.summary}
                                </div>
                            )}

                            {/* Ảnh bìa bài viết nếu có */}
                            {post.thumbnail_url && (
                                <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-xs">
                                    <img
                                        src={post.thumbnail_url}
                                        alt={post.title}
                                        className="w-full max-h-[460px] object-cover"
                                    />
                                </div>
                            )}

                            {/* NỘI DUNG CHI TIẾT (RENDER AN TOÀN BẰNG DANGEROUSLYSETINNERHTML) */}
                            <div
                                className="post-html-content prose prose-slate max-w-none text-slate-700 text-sm sm:text-base leading-relaxed space-y-4"
                                dangerouslySetInnerHTML={{ __html: post.content }}
                            />

                            {/* Cuối bài viết: Tag & Nút quay lại */}
                            <div className="pt-8 mt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <Link
                                    to="/news"
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>←</span>
                                    <span>Quay lại Trang Tin Tức</span>
                                </Link>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCopyLink}
                                        className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition cursor-pointer"
                                    >
                                        {isCopied ? '✓ Đã sao chép liên kết' : '🔗 Sao chép liên kết bài viết'}
                                    </button>
                                </div>
                            </div>
                        </article>

                        {/* CỘT PHỤ (SIDEBAR): BÀI VIẾT MỚI NHẤT & LIÊN HỆ */}
                        <aside className="lg:col-span-4 space-y-6">
                            {/* Widget 1: Bài viết mới nhất */}
                            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                                    <span>🔥</span>
                                    <span>Bài Viết Mới Nhất</span>
                                </h3>

                                <div className="space-y-3.5">
                                    {latestPosts
                                        .filter((p) => p.slug !== post.slug)
                                        .slice(0, 4)
                                        .map((item) => (
                                            <Link
                                                key={item.id}
                                                to={`/news/${item.slug}`}
                                                className="flex items-start gap-3 group"
                                            >
                                                <div className="w-16 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                                                    {item.thumbnail_url ? (
                                                        <img
                                                            src={item.thumbnail_url}
                                                            alt={item.title}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">
                                                            📰
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-0.5 min-w-0">
                                                    <h4 className="font-bold text-xs text-slate-800 group-hover:text-blue-600 transition line-clamp-2 leading-snug">
                                                        {item.title}
                                                    </h4>
                                                    <span className="text-[10px] text-slate-400 block">
                                                        {formatDate(item.created_at)}
                                                    </span>
                                                </div>
                                            </Link>
                                        ))}
                                </div>
                            </div>

                            {/* Widget 2: Đặt phòng & Hotline hỗ trợ */}
                            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-md space-y-4">
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold uppercase tracking-wider">
                                    ƯU ĐÃI ĐẶC QUYỀN
                                </span>
                                <h3 className="text-base font-bold text-white leading-snug">
                                    Sẵn Sàng Cho Kỳ Nghỉ Đẳng Cấp?
                                </h3>
                                <p className="text-xs text-slate-300 font-light leading-relaxed">
                                    Đặt phòng trực tiếp trên website để nhận ngay ưu đãi giảm 20% và miễn phí bữa sáng buffet.
                                </p>
                                <Link
                                    to="/rooms"
                                    className="block w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs text-center rounded-xl shadow-md transition"
                                >
                                    Khám Phá Phòng Nghỉ →
                                </Link>
                            </div>
                        </aside>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
