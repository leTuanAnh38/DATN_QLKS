import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import postService from '../../services/postService';
import {
    Calendar,
    Eye,
    User,
    Share2,
    Check,
    ArrowLeft,
    Flame,
    Sparkles,
    ArrowRight,
    Image as ImageIcon,
} from 'lucide-react';

export default function NewsDetail() {
    const { slug } = useParams();
    const navigate = useNavigate();

    const [post, setPost] = useState(null);
    const [latestPosts, setLatestPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCopied, setIsCopied] = useState(false);
    const [scrollProgress, setScrollProgress] = useState(0);

    // Tính toán tiến độ đọc bài viết (Reading Progress Bar)
    useEffect(() => {
        const handleScroll = () => {
            const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (totalHeight > 0) {
                const currentScroll = window.scrollY;
                const progress = Math.min(100, Math.max(0, (currentScroll / totalHeight) * 100));
                setScrollProgress(progress);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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

    // Xử lý làm sạch nội dung bài viết: chuyển &nbsp; và ký tự non-breaking space sang khoảng trắng thường
    // giúp văn bản tự động xuống dòng chuẩn theo chiều rộng khung bài viết mà không bị tràn ra ngoài
    const formatPostContent = (html) => {
        if (!html) return '';
        return html.replace(/(&nbsp;|\u00a0)/g, ' ');
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
            {/* THANH TIẾN ĐỘ ĐỌC BÀI VIẾT (READING PROGRESS BAR) */}
            <div
                className="fixed top-0 left-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 z-50 transition-all duration-150"
                style={{ width: `${scrollProgress}%` }}
            />

            <Navbar />

            {/* BREADCRUMB THANH ĐIỀU HƯỚNG */}
            <div className="bg-slate-100/80 border-b border-slate-200/60 py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
                        <Link to="/" className="hover:text-amber-600 transition">Trang chủ</Link>
                        <span className="text-slate-300">/</span>
                        <Link to="/news" className="hover:text-amber-600 transition">Tin tức & Cẩm nang</Link>
                        <span className="text-slate-300">/</span>
                        <span className="text-slate-900 font-semibold truncate max-w-xs sm:max-w-md">
                            {post?.title || 'Chi tiết bài viết'}
                        </span>
                    </nav>
                </div>
            </div>

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                {isLoading ? (
                    <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-xs max-w-md mx-auto space-y-3">
                        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-xs text-slate-500 font-semibold">Đang tải bài viết...</p>
                    </div>
                ) : error || !post ? (
                    <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-xs max-w-md mx-auto space-y-4">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-600 flex items-center justify-center mx-auto shadow-2xs text-2xl font-bold">
                            !
                        </div>
                        <h2 className="text-lg font-bold text-slate-900">
                            Không tìm thấy bài viết
                        </h2>
                        <p className="text-xs text-slate-500">
                            {error || 'Bài viết bạn đang tìm kiếm có thể đã được gỡ xuống hoặc đường dẫn tĩnh không chính xác.'}
                        </p>
                        <Link
                            to="/news"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-md transition"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Quay lại Trang Tin Tức</span>
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                        {/* CỘT CHÍNH: NỘI DUNG BÀI VIẾT */}
                        <article className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-xs space-y-6 min-w-0 overflow-hidden break-words">

                            {/* Meta Head */}
                            <div className="space-y-4 pb-6 border-b border-slate-100">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-3 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/80 text-xs font-bold uppercase tracking-wider">
                                        {post.category_display || post.category}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                        <Calendar className="w-3.5 h-3.5 text-amber-600" />
                                        <span>{formatDate(post.created_at)}</span>
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                        <Eye className="w-3.5 h-3.5 text-amber-600" />
                                        <span>{post.view_count || 0} lượt xem</span>
                                    </span>
                                </div>

                                <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight tracking-tight">
                                    {post.title}
                                </h1>

                                <div className="flex items-center justify-between pt-2">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center text-sm font-bold shadow-xs">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 block">
                                                {post.author || 'Ban Biên Tập'}
                                            </span>
                                            <span className="text-[10px] text-slate-400 block">
                                                Khách Sạn TA Đà Nẵng • 5-Star Luxury Resort
                                            </span>
                                        </div>
                                    </div>

                                    {/* Nút chia sẻ */}
                                    <button
                                        type="button"
                                        onClick={handleCopyLink}
                                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-amber-600 hover:border-amber-200 text-xs font-semibold hover:bg-amber-50/50 transition cursor-pointer flex items-center gap-1.5"
                                    >
                                        {isCopied ? (
                                            <>
                                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                <span className="text-emerald-700 font-bold">Đã chép link</span>
                                            </>
                                        ) : (
                                            <>
                                                <Share2 className="w-3.5 h-3.5 text-slate-500" />
                                                <span>Chia sẻ bài</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Tóm tắt nổi bật (Lead Text) */}
                            {post.summary && (
                                <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-50/80 via-orange-50/30 to-amber-50/10 border-l-4 border-amber-500 text-sm sm:text-base text-slate-700 font-serif italic leading-relaxed shadow-xs">
                                    "{post.summary}"
                                </div>
                            )}

                            {/* Ảnh bìa bài viết nếu có */}
                            {post.thumbnail_url && (
                                <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-md">
                                    <img
                                        src={post.thumbnail_url}
                                        alt={post.title}
                                        className="w-full max-h-[520px] object-cover"
                                    />
                                </div>
                            )}

                            {/* NỘI DUNG CHI TIẾT (RENDER AN TOÀN BẰNG DANGEROUSLYSETINNERHTML) */}
                            <div
                                className="post-html-content prose prose-slate w-full max-w-none text-slate-700 text-sm sm:text-base leading-relaxed space-y-4 break-words overflow-hidden"
                                dangerouslySetInnerHTML={{ __html: formatPostContent(post.content) }}
                            />

                            {/* Cuối bài viết: Tag & Nút quay lại */}
                            <div className="pt-8 mt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <Link
                                    to="/news"
                                    className="px-4 py-2.5 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 border border-slate-200/80 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer shadow-2xs"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span>Quay lại Trang Tin Tức</span>
                                </Link>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCopyLink}
                                        className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-500/20 transition cursor-pointer flex items-center gap-2"
                                    >
                                        {isCopied ? (
                                            <>
                                                <Check className="w-4 h-4" />
                                                <span>Đã sao chép liên kết</span>
                                            </>
                                        ) : (
                                            <>
                                                <Share2 className="w-4 h-4" />
                                                <span>Sao chép liên kết bài viết</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </article>

                        {/* CỘT PHỤ (SIDEBAR): BÀI VIẾT MỚI NHẤT & LIÊN HỆ */}
                        <aside className="lg:col-span-4 space-y-6">
                            {/* Widget 1: Bài viết mới nhất */}
                            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                                <h3 className="font-serif font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                                    <Flame className="w-4 h-4 text-amber-500 fill-amber-500/20" />
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
                                                <div className="w-16 h-14 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/80">
                                                    {item.thumbnail_url ? (
                                                        <img
                                                            src={item.thumbnail_url}
                                                            alt={item.title}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-amber-50 text-amber-400 text-xs">
                                                            <ImageIcon className="w-4 h-4 stroke-1" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-1 min-w-0">
                                                    <h4 className="font-serif font-bold text-xs text-slate-800 group-hover:text-amber-600 transition line-clamp-2 leading-snug">
                                                        {item.title}
                                                    </h4>
                                                    <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                                                        <Calendar className="w-3 h-3 text-slate-400" />
                                                        <span>{formatDate(item.created_at)}</span>
                                                    </span>
                                                </div>
                                            </Link>
                                        ))}
                                </div>
                            </div>

                            {/* Widget 2: Đặt phòng & Ưu đãi đặc quyền */}
                            <div className="bg-gradient-to-br from-amber-50 via-white to-orange-50 text-slate-900 border border-amber-200/70 rounded-3xl p-6 shadow-sm space-y-4">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
                                    <Sparkles className="w-3 h-3 text-amber-600" />
                                    <span>Ưu Đãi Đặc Quyền</span>
                                </span>
                                <h3 className="font-serif text-lg font-bold text-slate-900 leading-snug">
                                    Sẵn Sàng Cho Kỳ Nghỉ Đẳng Cấp?
                                </h3>
                                <p className="text-xs text-slate-600 font-light leading-relaxed">
                                    Đặt phòng trực tiếp trên website để nhận ngay ưu đãi giảm 20% và miễn phí bữa sáng buffet chuẩn quốc tế.
                                </p>
                                <Link
                                    to="/rooms"
                                    className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs text-center rounded-xl shadow-md shadow-amber-500/20 transition group"
                                >
                                    <span>Khám Phá Phòng Nghỉ</span>
                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
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
