import React, { useState, useEffect, useMemo } from 'react';
import {
    RotateCw,
    MessageSquare,
    Star,
    Reply,
    Eye,
    EyeOff,
    Trash2,
    Search,
    X,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    Building2,
    Inbox,
    ArrowUpDown
} from 'lucide-react';
import { reviewService } from '../../../services/reviewService';
import UserAvatar from '../../../components/common/UserAvatar';
import Pagination from '../../../components/common/Pagination';

// Tiện ích format ngày giờ chi tiết
const formatDateTimeDisplay = (isoStr) => {
    if (!isoStr) return '—';
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

export default function ReviewManagement() {
    const [reviews, setReviews] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'visible' | 'hidden'
    const [ratingFilter, setRatingFilter] = useState('all'); // 'all' | '5' | '4' | '3' | 'under3'
    const [roomCategoryFilter, setRoomCategoryFilter] = useState('all');
    const [sortBy, setSortBy] = useState('unreplied_first'); // 'unreplied_first' | 'newest' | 'rating_asc' | 'rating_desc'

    // Phân trang
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    // Reset về trang 1 khi thay đổi điều kiện lọc hoặc tìm kiếm
    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, ratingFilter, roomCategoryFilter, searchTerm, sortBy]);

    // State Toast Alert
    const [alertMessage, setAlertMessage] = useState(null);

    // State Xóa Review (Confirm Dialog)
    const [deleteConfirmReview, setDeleteConfirmReview] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // State Phản hồi đánh giá (Inline reply trong Cột 4)
    const [replyingReviewId, setReplyingReviewId] = useState(null);
    const [replyDraft, setReplyDraft] = useState('');
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);

    const showAlert = (type, text) => {
        setAlertMessage({ type, text });
        setTimeout(() => setAlertMessage(null), 3500);
    };

    // Tải danh sách đánh giá từ API GET /api/reviews/
    const fetchReviews = async () => {
        try {
            setIsLoading(true);
            const res = await reviewService.getReviews();
            if (res.success) {
                setReviews(res.data || []);
            } else {
                showAlert('error', res.message || 'Không thể tải danh sách đánh giá.');
            }
        } catch (err) {
            showAlert('error', err.message || 'Lỗi kết nối khi tải đánh giá.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, []);

    // Danh sách các hạng phòng độc nhất để làm filter
    const roomCategoriesList = useMemo(() => {
        const set = new Set();
        reviews.forEach((r) => {
            if (r.room_category_name) set.add(r.room_category_name);
        });
        return Array.from(set);
    }, [reviews]);

    // Thống kê nhanh KPI
    const stats = useMemo(() => {
        const total = reviews.length;
        if (total === 0) return { total: 0, avgRating: 5.0, repliedCount: 0, visibleCount: 0 };

        const totalScore = reviews.reduce((sum, r) => sum + (Number(r.overall_rating) || 5), 0);
        const avg = (totalScore / total).toFixed(1);
        const replied = reviews.filter((r) => r.admin_reply && r.admin_reply.trim()).length;
        const visible = reviews.filter((r) => r.is_visible).length;

        return {
            total,
            avgRating: avg,
            repliedCount: replied,
            visibleCount: visible,
        };
    }, [reviews]);

    // Bộ lọc & sắp xếp danh sách
    const filteredReviews = useMemo(() => {
        const filtered = reviews.filter((r) => {
            // Lọc theo trạng thái hiển thị
            if (statusFilter === 'visible' && !r.is_visible) return false;
            if (statusFilter === 'hidden' && r.is_visible) return false;

            // Lọc theo hạng phòng
            if (roomCategoryFilter !== 'all' && r.room_category_name !== roomCategoryFilter) return false;

            // Lọc theo số sao
            if (ratingFilter !== 'all') {
                const roundedScore = Math.round(Number(r.overall_rating) || 0);
                if (ratingFilter === '5' && roundedScore !== 5) return false;
                if (ratingFilter === '4' && roundedScore !== 4) return false;
                if (ratingFilter === '3' && roundedScore !== 3) return false;
                if (ratingFilter === 'under3' && roundedScore >= 3) return false;
            }

            // Tìm kiếm theo từ khóa (Khách, Email, Hạng phòng, Nội dung, Mã booking)
            if (searchTerm.trim()) {
                const q = searchTerm.trim().toLowerCase();
                const matchName = r.guest_name?.toLowerCase().includes(q);
                const matchEmail = r.guest_email?.toLowerCase().includes(q);
                const matchComment = r.comment?.toLowerCase().includes(q);
                const matchRoom = r.room_category_name?.toLowerCase().includes(q);
                const matchCode = r.booking_code?.toLowerCase().includes(q);
                const matchReply = r.admin_reply?.toLowerCase().includes(q);
                return matchName || matchEmail || matchComment || matchRoom || matchCode || matchReply;
            }

            return true;
        });

        const getTime = (item) => new Date(item.created_at || 0).getTime();
        const getRating = (item) => Number(item.overall_rating) || 0;
        const isReplied = (item) => Boolean(item.admin_reply && item.admin_reply.trim());

        return filtered.sort((a, b) => {
            if (sortBy === 'unreplied_first') {
                const repA = isReplied(a) ? 1 : 0;
                const repB = isReplied(b) ? 1 : 0;
                if (repA !== repB) return repA - repB;
                return getTime(b) - getTime(a);
            }
            if (sortBy === 'rating_asc') {
                const diff = getRating(a) - getRating(b);
                return diff !== 0 ? diff : getTime(b) - getTime(a);
            }
            if (sortBy === 'rating_desc') {
                const diff = getRating(b) - getRating(a);
                return diff !== 0 ? diff : getTime(b) - getTime(a);
            }
            return getTime(b) - getTime(a);
        });
    }, [reviews, statusFilter, ratingFilter, roomCategoryFilter, searchTerm, sortBy]);

    // Phân trang danh sách đánh giá sau khi đã lọc & tìm kiếm
    const totalPages = Math.ceil(filteredReviews.length / pageSize) || 1;
    const paginatedReviews = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredReviews.slice(start, start + pageSize);
    }, [filteredReviews, currentPage, pageSize]);

    // Bắt đầu viết phản hồi
    const handleStartReply = (review) => {
        setReplyingReviewId(review.id);
        setReplyDraft(review.admin_reply || '');
    };

    // Hủy viết phản hồi
    const handleCancelReply = () => {
        setReplyingReviewId(null);
        setReplyDraft('');
    };

    // Lưu phản hồi (PATCH /api/reviews/{id}/reply/)
    const handleSaveReply = async (reviewId) => {
        if (!replyDraft.trim()) {
            showAlert('error', 'Vui lòng nhập nội dung phản hồi.');
            return;
        }

        try {
            setIsSubmittingReply(true);
            const res = await reviewService.replyReview(reviewId, replyDraft.trim());

            if (res.success || res.admin_reply) {
                showAlert('success', 'Đã lưu phản hồi khách hàng thành công.');
                setReviews((prev) =>
                    prev.map((r) =>
                        r.id === reviewId ? { ...r, admin_reply: replyDraft.trim() } : r
                    )
                );
                handleCancelReply();
            } else {
                showAlert('error', res.message || 'Không thể lưu phản hồi.');
            }
        } catch (err) {
            showAlert('error', err.message || 'Lỗi khi lưu phản hồi.');
        } finally {
            setIsSubmittingReply(false);
        }
    };

    // Chuyển đổi Ẩn/Hiện (PATCH /api/reviews/{id}/toggle-visibility/)
    const handleToggleVisibility = async (review) => {
        try {
            const nextVisibility = !review.is_visible;
            const res = await reviewService.toggleVisibility(review.id, nextVisibility);

            if (res.success || typeof res.is_visible === 'boolean') {
                const stateText = nextVisibility ? 'Hiển thị' : 'Đã ẩn';
                showAlert('success', `Đã chuyển đánh giá #${review.id} sang trạng thái "${stateText}".`);
                setReviews((prev) =>
                    prev.map((r) =>
                        r.id === review.id ? { ...r, is_visible: nextVisibility } : r
                    )
                );
            } else {
                showAlert('error', res.message || 'Không thể thay đổi trạng thái.');
            }
        } catch (err) {
            showAlert('error', err.message || 'Lỗi khi thay đổi trạng thái.');
        }
    };

    // Xóa đánh giá (DELETE /api/reviews/{id}/)
    const handleConfirmDelete = async () => {
        if (!deleteConfirmReview) return;

        try {
            setIsDeleting(true);
            const res = await reviewService.deleteReview(deleteConfirmReview.id);
            setDeleteConfirmReview(null);

            if (res.success || !res.message?.includes('error')) {
                showAlert('success', `Đã xóa đánh giá của "${deleteConfirmReview.guest_name}" thành công.`);
                setReviews((prev) => prev.filter((r) => r.id !== deleteConfirmReview.id));
            } else {
                showAlert('error', res.message || 'Không thể xóa đánh giá.');
            }
        } catch (err) {
            setDeleteConfirmReview(null);
            showAlert('error', err.message || 'Lỗi khi xóa đánh giá.');
        } finally {
            setIsDeleting(false);
        }
    };

    // Render Ngôi sao vàng dựa trên điểm overall_rating
    const renderStarIcons = (rating) => {
        const rounded = Math.round(Number(rating) || 0);
        return (
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${
                            star <= rounded
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-200 fill-slate-100'
                        }`}
                    />
                ))}
                <span className="font-bold text-xs text-slate-800 ml-1.5 font-mono">
                    {Number(rating).toFixed(1)}
                </span>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* ALERT NOTIFICATION - Luôn hiển thị trên cùng (z-[99999]) */}
            {alertMessage && (
                <div
                    className={`fixed top-5 right-5 z-[99999] max-w-md p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xl border animate-in fade-in duration-300 ${
                        alertMessage.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {alertMessage.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>{alertMessage.text}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAlertMessage(null)}
                        className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-black/5 ml-3"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg sm:text-xl font-sans font-bold text-slate-900 tracking-tight">
                        Quản lý Đánh giá & Phản hồi Khách hàng
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Theo dõi mức độ hài lòng, quản lý hiển thị và phản hồi trực tiếp với du khách.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={fetchReviews}
                    disabled={isLoading}
                    className="self-start sm:self-auto px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                    <RotateCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                    <span>Tải lại</span>
                </button>
            </div>

            {/* 4 THẺ CHỈ SỐ KPI COMPACT */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Tổng đánh giá</span>
                        <div className="text-xl font-black text-slate-900 tabular-nums mt-0.5">{stats.total}</div>
                        <span className="text-[11px] text-slate-400">Từ đơn hoàn tất</span>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-4 h-4" />
                    </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Điểm trung bình</span>
                        <div className="text-xl font-black text-amber-500 flex items-baseline gap-1 tabular-nums mt-0.5">
                            <span>{stats.avgRating}</span>
                            <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
                        </div>
                        <span className="text-[11px] text-emerald-600 font-semibold">Chất lượng 5 sao</span>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                        <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                    </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Đã phản hồi</span>
                        <div className="text-xl font-black text-purple-600 tabular-nums mt-0.5">
                            {stats.repliedCount} <span className="text-xs text-slate-400 font-normal">/ {stats.total}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                            Tỷ lệ {stats.total > 0 ? Math.round((stats.repliedCount / stats.total) * 100) : 0}%
                        </span>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
                        <Reply className="w-4 h-4" />
                    </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Đang hiển thị</span>
                        <div className="text-xl font-black text-emerald-600 tabular-nums mt-0.5">
                            {stats.visibleCount} <span className="text-xs text-slate-400 font-normal">/ {stats.total}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">Công khai trên web</span>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                        <Eye className="w-4 h-4" />
                    </div>
                </div>
            </div>

            {/* BỘ LỌC & TÌM KIẾM */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs overflow-x-auto max-w-full scrollbar-none">
                        {[
                            { key: 'all', label: 'Tất cả' },
                            { key: 'visible', label: 'Hiển thị' },
                            { key: 'hidden', label: 'Đã ẩn' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setStatusFilter(tab.key)}
                                className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                                    statusFilter === tab.key
                                        ? 'bg-white text-blue-600 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <select
                        value={ratingFilter}
                        onChange={(e) => setRatingFilter(e.target.value)}
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    >
                        <option value="all">Tất cả số sao</option>
                        <option value="5">5 sao (Xuất sắc)</option>
                        <option value="4">4 sao (Rất tốt)</option>
                        <option value="3">3 sao (Hài lòng)</option>
                        <option value="under3">Dưới 3 sao</option>
                    </select>

                    {roomCategoriesList.length > 0 && (
                        <select
                            value={roomCategoryFilter}
                            onChange={(e) => setRoomCategoryFilter(e.target.value)}
                            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20 max-w-[180px]"
                        >
                            <option value="all">Tất cả hạng phòng</option>
                            {roomCategoriesList.map((catName) => (
                                <option key={catName} value={catName}>
                                    {catName}
                                </option>
                            ))}
                        </select>
                    )}

                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            aria-label="Sắp xếp đánh giá"
                            className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                        >
                            <option value="unreplied_first">Ưu tiên chưa phản hồi</option>
                            <option value="newest">Mới nhất trước</option>
                            <option value="rating_asc">Sao thấp → cao</option>
                            <option value="rating_desc">Sao cao → thấp</option>
                        </select>
                    </div>
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Tìm khách, email, nội dung..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* BẢNG DỮ LIỆU COMPACT 6 CỘT (KHÔNG TRÀN NGANG) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="py-2.5 px-3">Khách hàng & Phòng</th>
                                <th className="py-2.5 px-3">Điểm số</th>
                                <th className="py-2.5 px-3">Nội dung & Phản hồi</th>
                                <th className="py-2.5 px-3 whitespace-nowrap">Ngày gửi</th>
                                <th className="py-2.5 px-3 whitespace-nowrap">Trạng thái</th>
                                <th className="py-2.5 px-3 text-right whitespace-nowrap">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                            {isLoading && (
                                <tr>
                                    <td colSpan="6" className="py-10 text-center text-slate-400">
                                        <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                                        <div className="text-xs font-medium text-slate-600">Đang tải dữ liệu đánh giá...</div>
                                    </td>
                                </tr>
                            )}

                            {!isLoading && filteredReviews.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="py-10 text-center text-slate-400">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 mx-auto mb-2">
                                            <Inbox className="w-6 h-6" />
                                        </div>
                                        <div className="font-bold text-slate-700">Chưa có đánh giá nào phù hợp</div>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {searchTerm || statusFilter !== 'all' || ratingFilter !== 'all'
                                                ? 'Hãy thử thay đổi điều kiện tìm kiếm hoặc bộ lọc.'
                                                : 'Khi khách trả phòng và gửi đánh giá, nội dung sẽ lập tức xuất hiện tại đây.'}
                                        </p>
                                    </td>
                                </tr>
                            )}

                            {!isLoading &&
                                paginatedReviews.map((review) => {
                                    const isReplying = replyingReviewId === review.id;

                                    return (
                                        <tr
                                            key={review.id}
                                            className="group hover:bg-slate-50/60 transition-colors duration-150 align-top"
                                        >
                                            {/* CỘT 1: KHÁCH HÀNG + LOẠI PHÒNG */}
                                            <td className="py-2.5 px-3 max-w-[220px]">
                                                <div className="flex items-start gap-2.5">
                                                    <UserAvatar
                                                        avatar={review.guest_avatar}
                                                        name={review.guest_name}
                                                        size="sm"
                                                    />
                                                    <div className="min-w-0">
                                                        <strong className="block font-bold text-slate-900 text-[13px] leading-tight truncate">
                                                            {review.guest_name}
                                                        </strong>
                                                        <span className="block text-blue-700 text-[11px] font-semibold mt-0.5 truncate">
                                                            {review.room_category_name || 'Hạng phòng tiêu chuẩn'}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                            {review.booking_code && (
                                                                <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-mono font-semibold">
                                                                    #{review.booking_code}
                                                                </span>
                                                            )}
                                                            {review.guest_email && (
                                                                <span className="text-slate-400 text-[10.5px] font-mono truncate max-w-[140px]" title={review.guest_email}>
                                                                    {review.guest_email}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* CỘT 2: ĐIỂM SỐ COMPACT */}
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                <div className="space-y-1">
                                                    <div>{renderStarIcons(review.overall_rating)}</div>
                                                    <div className="text-[10.5px] text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 leading-tight tabular-nums">
                                                        <div>Sạch <strong className="text-slate-700">{review.cleanliness_score}</strong> • DV <strong className="text-slate-700">{review.service_score}</strong></div>
                                                        <div>Vị trí <strong className="text-slate-700">{review.location_score}</strong> • GT <strong className="text-slate-700">{review.value_score}</strong></div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* CỘT 3: NỘI DUNG & PHẢN HỒI */}
                                            <td className="py-2.5 px-3 max-w-[360px]">
                                                <div className="space-y-1.5">
                                                    <p className="text-[12.5px] text-slate-800 leading-relaxed font-normal">
                                                        "{review.comment}"
                                                    </p>

                                                    {review.admin_reply && !isReplying && (
                                                        <div className="p-2.5 bg-amber-50/70 border-l-3 border-amber-500 rounded-r-xl text-xs space-y-1 group relative">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="font-bold text-amber-950 text-[11px] flex items-center gap-1">
                                                                    <Building2 className="w-3 h-3 text-amber-600" />
                                                                    <span>Phản hồi KS:</span>
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStartReply(review)}
                                                                    className="text-[10.5px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                                                                    title="Chỉnh sửa câu trả lời"
                                                                >
                                                                    Sửa
                                                                </button>
                                                            </div>
                                                            <p className="text-slate-800 leading-snug text-xs">
                                                                {review.admin_reply}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {!review.admin_reply && !isReplying && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStartReply(review)}
                                                            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline transition cursor-pointer"
                                                        >
                                                            <Reply className="w-3 h-3" />
                                                            <span>Viết phản hồi</span>
                                                        </button>
                                                    )}

                                                    {isReplying && (
                                                        <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2 animate-in fade-in duration-200">
                                                            <label className="block text-[11px] font-bold text-blue-900">
                                                                Nhập câu trả lời của Khách Sạn:
                                                            </label>
                                                            <textarea
                                                                rows={2}
                                                                value={replyDraft}
                                                                onChange={(e) => setReplyDraft(e.target.value)}
                                                                placeholder="Kính chào quý khách, khách sạn chân thành cảm ơn quý khách..."
                                                                className="w-full p-2 bg-white border border-blue-300 focus:border-blue-600 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 transition leading-relaxed"
                                                            />
                                                            <div className="flex items-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    disabled={isSubmittingReply}
                                                                    onClick={() => handleSaveReply(review.id)}
                                                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    {isSubmittingReply ? (
                                                                        <>
                                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                                            <span>Lưu...</span>
                                                                        </>
                                                                    ) : (
                                                                        <span>Lưu</span>
                                                                    )}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={isSubmittingReply}
                                                                    onClick={handleCancelReply}
                                                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg transition cursor-pointer"
                                                                >
                                                                    Hủy
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* CỘT 4: NGÀY GỬI */}
                                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px] tabular-nums">
                                                {formatDateTimeDisplay(review.created_at)}
                                            </td>

                                            {/* CỘT 5: TRẠNG THÁI */}
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                {review.is_visible ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                        <span>Hiển thị</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                        <span>Đã ẩn</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* CỘT 6: HÀNH ĐỘNG */}
                                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleVisibility(review)}
                                                        className={`w-7 h-7 rounded-lg border transition inline-flex items-center justify-center cursor-pointer ${
                                                            review.is_visible
                                                                ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                                                                : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                                                        }`}
                                                        title={review.is_visible ? 'Ẩn đánh giá khỏi trang khách' : 'Hiển thị công khai'}
                                                    >
                                                        {review.is_visible ? (
                                                            <EyeOff className="w-3.5 h-3.5" />
                                                        ) : (
                                                            <Eye className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteConfirmReview(review)}
                                                        className="w-7 h-7 rounded-lg text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition inline-flex items-center justify-center cursor-pointer"
                                                        title="Xóa đánh giá này"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>

                {/* GIAO DIỆN MOBILE CARDS (Hiển thị mượt mà trên điện thoại, ẩn trên tablet/desktop) */}
                <div className="block md:hidden divide-y divide-slate-100">
                    {isLoading && (
                        <div className="py-12 text-center text-slate-400">
                            <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                            <div className="text-xs font-medium text-slate-600">Đang tải dữ liệu đánh giá...</div>
                        </div>
                    )}

                    {!isLoading && filteredReviews.length === 0 && (
                        <div className="py-12 px-4 text-center text-slate-400">
                            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 mx-auto mb-2">
                                <Inbox className="w-6 h-6" />
                            </div>
                            <div className="font-bold text-slate-700 text-sm">Chưa có đánh giá nào phù hợp</div>
                            <p className="text-xs text-slate-400 mt-1">
                                {searchTerm || statusFilter !== 'all' || ratingFilter !== 'all'
                                    ? 'Hãy thử thay đổi điều kiện tìm kiếm hoặc bộ lọc.'
                                    : 'Khi khách trả phòng và gửi đánh giá, nội dung sẽ lập tức xuất hiện tại đây.'}
                            </p>
                        </div>
                    )}

                    {!isLoading &&
                        paginatedReviews.map((review) => {
                            const isReplying = replyingReviewId === review.id;

                            return (
                                <div key={review.id} className="p-4 space-y-3 hover:bg-slate-50/60 transition-colors">
                                    {/* Hàng trên: Khách hàng + Badge trạng thái */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-start gap-2.5 min-w-0">
                                            <UserAvatar
                                                avatar={review.guest_avatar}
                                                name={review.guest_name}
                                                size="sm"
                                            />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-bold text-slate-900 text-sm truncate">
                                                        {review.guest_name}
                                                    </span>
                                                    {review.booking_code && (
                                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono font-medium">
                                                            #{review.booking_code}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-slate-400 text-[11px] font-mono truncate">
                                                    {review.guest_email || 'Chưa cung cấp email'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="shrink-0">
                                            {review.is_visible ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    <span>Hiển thị</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                    <span>Đã ẩn</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Hạng phòng & Ngày gửi */}
                                    <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                        <span className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span>{review.room_category_name || 'Hạng phòng tiêu chuẩn'}</span>
                                        </span>
                                        <span className="text-[11px] font-mono shrink-0 text-slate-400">
                                            {formatDateTimeDisplay(review.created_at)}
                                        </span>
                                    </div>

                                    {/* Điểm số & Đánh giá chi tiết */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <div>{renderStarIcons(review.overall_rating)}</div>
                                            <span className="text-xs font-bold text-slate-800">
                                                {review.overall_rating}/5
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                                            <div>Sạch sẽ: <strong className="text-slate-800">{review.cleanliness_score}/5</strong></div>
                                            <div>Dịch vụ: <strong className="text-slate-800">{review.service_score}/5</strong></div>
                                            <div>Vị trí: <strong className="text-slate-800">{review.location_score}/5</strong></div>
                                            <div>Giá trị: <strong className="text-slate-800">{review.value_score}/5</strong></div>
                                        </div>
                                    </div>

                                    {/* Lời nhận xét của khách */}
                                    <div className="text-xs text-slate-800 leading-relaxed bg-white p-3 rounded-xl border border-slate-200 italic">
                                        "{review.comment}"
                                    </div>

                                    {/* Phản hồi từ khách sạn */}
                                    {review.admin_reply && !isReplying && (
                                        <div className="p-3 bg-amber-50/70 border-l-4 border-amber-500 rounded-r-2xl text-xs space-y-1.5 shadow-2xs">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-amber-950 text-[11px] flex items-center gap-1.5">
                                                    <Building2 className="w-3.5 h-3.5 text-amber-600" />
                                                    <span>Khách sạn phản hồi:</span>
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartReply(review)}
                                                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                                                >
                                                    Chỉnh sửa
                                                </button>
                                            </div>
                                            <p className="text-slate-800 leading-relaxed font-normal">
                                                {review.admin_reply}
                                            </p>
                                        </div>
                                    )}

                                    {!review.admin_reply && !isReplying && (
                                        <div>
                                            <button
                                                type="button"
                                                onClick={() => handleStartReply(review)}
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline transition cursor-pointer"
                                            >
                                                <Reply className="w-3.5 h-3.5" />
                                                <span>Viết phản hồi cho khách</span>
                                            </button>
                                        </div>
                                    )}

                                    {isReplying && (
                                        <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-200 space-y-2.5 animate-in fade-in duration-200">
                                            <label className="block text-[11px] font-bold text-blue-900">
                                                Nhập câu trả lời của Khách Sạn:
                                            </label>
                                            <textarea
                                                rows={3}
                                                value={replyDraft}
                                                onChange={(e) => setReplyDraft(e.target.value)}
                                                placeholder="Kính chào quý khách, khách sạn chân thành cảm ơn quý khách..."
                                                className="w-full p-2.5 bg-white border border-blue-300 focus:border-blue-600 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 transition leading-relaxed"
                                            />
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    disabled={isSubmittingReply}
                                                    onClick={() => handleSaveReply(review.id)}
                                                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                                                >
                                                    {isSubmittingReply ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            <span>Đang lưu...</span>
                                                        </>
                                                    ) : (
                                                        <span>Lưu phản hồi</span>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isSubmittingReply}
                                                    onClick={handleCancelReply}
                                                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
                                                >
                                                    Hủy
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action buttons (Ẩn/Hiện & Xóa) */}
                                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleVisibility(review)}
                                            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
                                                review.is_visible
                                                    ? 'text-amber-800 bg-amber-50 border-amber-200 hover:bg-amber-100'
                                                    : 'text-emerald-800 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                                            }`}
                                        >
                                            {review.is_visible ? (
                                                <>
                                                    <EyeOff className="w-3.5 h-3.5" />
                                                    <span>Ẩn khỏi web</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>Hiện công khai</span>
                                                </>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setDeleteConfirmReview(review)}
                                            className="py-2 px-3.5 rounded-xl text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 transition text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Xóa</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                </div>

                {/* Phân trang (Table Footer) */}
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalCount={filteredReviews.length}
                    pageSize={pageSize}
                    onPageChange={(page) => setCurrentPage(page)}
                />
            </div>

            {/* CONFIRM DIALOG XÓA ĐÁNH GIÁ (Cột 7) */}
            {deleteConfirmReview && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
                    onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirmReview(null); }}
                >
                    <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shadow-inner">
                            <Trash2 className="w-6 h-6" />
                        </div>

                        <div>
                            <h3 className="text-base font-bold text-slate-900">
                                Xác nhận xóa đánh giá?
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                Bạn có chắc chắn muốn xóa vĩnh viễn đánh giá của du khách{' '}
                                <strong className="text-slate-900">{deleteConfirmReview.guest_name}</strong>{' '}
                                cho hạng phòng{' '}
                                <strong className="text-slate-900">{deleteConfirmReview.room_category_name}</strong>?
                            </p>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 italic">
                            "{deleteConfirmReview.comment}"
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={handleConfirmDelete}
                                className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        <span>Đang xóa...</span>
                                    </>
                                ) : (
                                    <span>Xác nhận Xóa</span>
                                )}
                            </button>

                            <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => setDeleteConfirmReview(null)}
                                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition text-center cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
