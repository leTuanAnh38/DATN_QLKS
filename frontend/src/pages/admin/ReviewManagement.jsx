import React, { useState, useEffect, useMemo } from 'react';
import { reviewService } from '../../services/reviewService';
import UserAvatar from '../../components/common/UserAvatar';
import Pagination from '../../components/common/Pagination';

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

    // Phân trang
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    // Reset về trang 1 khi thay đổi điều kiện lọc hoặc tìm kiếm
    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, ratingFilter, roomCategoryFilter, searchTerm]);

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

    // Bộ lọc danh sách
    const filteredReviews = useMemo(() => {
        return reviews.filter((r) => {
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
    }, [reviews, statusFilter, ratingFilter, roomCategoryFilter, searchTerm]);

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

            if (res.success || !res.message?.includes('error')) {
                showAlert('success', `Đã xóa đánh giá của "${deleteConfirmReview.guest_name}" thành công.`);
                setReviews((prev) => prev.filter((r) => r.id !== deleteConfirmReview.id));
                setDeleteConfirmReview(null);
            } else {
                showAlert('error', res.message || 'Không thể xóa đánh giá.');
            }
        } catch (err) {
            showAlert('error', err.message || 'Lỗi khi xóa đánh giá.');
        } finally {
            setIsDeleting(false);
        }
    };

    // Render Ngôi sao vàng dựa trên điểm overall_rating
    const renderStarIcons = (rating) => {
        const rounded = Math.round(Number(rating) || 0);
        return (
            <div className="flex items-center gap-0.5 text-amber-400">
                {[1, 2, 3, 4, 5].map((star) => (
                    <span
                        key={star}
                        className={`text-base select-none ${
                            star <= rounded ? 'text-amber-400' : 'text-slate-200'
                        }`}
                    >
                        ★
                    </span>
                ))}
                <span className="font-bold text-xs text-slate-800 ml-1.5 font-mono">
                    {Number(rating).toFixed(1)}
                </span>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* ALERT NOTIFICATION */}
            {alertMessage && (
                <div
                    className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-300 ${
                        alertMessage.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <span>{alertMessage.type === 'success' ? '✓' : '⚠️'}</span>
                        <span>{alertMessage.text}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAlertMessage(null)}
                        className="text-xs hover:opacity-70 cursor-pointer"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* HEADER & KPI STATS CARDS */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-serif font-bold text-slate-900 tracking-tight">
                        Quản lý Đánh giá & Phản hồi Khách hàng
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Theo dõi mức độ hài lòng, quản lý hiển thị và tương tác phản hồi trực tiếp với du khách.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={fetchReviews}
                    disabled={isLoading}
                    className="self-start sm:self-auto px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                    <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
                    <span>Tải lại</span>
                </button>
            </div>

            {/* 4 THẺ CHỈ SỐ KPI CHUẨN RESORT */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Tổng đánh giá
                        </span>
                        <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">
                            💬
                        </span>
                    </div>
                    <div className="text-2xl font-black text-slate-900">{stats.total}</div>
                    <span className="text-[11px] text-slate-400">Từ các đơn hoàn tất</span>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Điểm trung bình
                        </span>
                        <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm font-bold">
                            ★
                        </span>
                    </div>
                    <div className="text-2xl font-black text-amber-500 flex items-center gap-1.5">
                        <span>{stats.avgRating}</span>
                        <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
                    </div>
                    <span className="text-[11px] text-emerald-600 font-semibold">Chất lượng 5 sao</span>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Đã phản hồi
                        </span>
                        <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-sm font-bold">
                            ↪
                        </span>
                    </div>
                    <div className="text-2xl font-black text-purple-600">
                        {stats.repliedCount} <span className="text-xs text-slate-400 font-normal">/ {stats.total}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                        Tỷ lệ {stats.total > 0 ? Math.round((stats.repliedCount / stats.total) * 100) : 0}%
                    </span>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Đang hiển thị
                        </span>
                        <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold">
                            👁️
                        </span>
                    </div>
                    <div className="text-2xl font-black text-emerald-600">
                        {stats.visibleCount} <span className="text-xs text-slate-400 font-normal">/ {stats.total}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Công khai trên trang khách hàng</span>
                </div>
            </div>

            {/* BỘ LỌC & TÌM KIẾM */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Lọc Trạng thái */}
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
                        {[
                            { key: 'all', label: 'Tất cả' },
                            { key: 'visible', label: 'Đang hiển thị' },
                            { key: 'hidden', label: 'Đã ẩn' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setStatusFilter(tab.key)}
                                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                                    statusFilter === tab.key
                                        ? 'bg-white text-blue-600 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Lọc Số sao */}
                    <select
                        value={ratingFilter}
                        onChange={(e) => setRatingFilter(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    >
                        <option value="all">Tất cả số sao</option>
                        <option value="5">⭐⭐⭐⭐⭐ 5 sao</option>
                        <option value="4">⭐⭐⭐⭐ 4 sao</option>
                        <option value="3">⭐⭐⭐ 3 sao</option>
                        <option value="under3">Dưới 3 sao</option>
                    </select>

                    {/* Lọc Hạng phòng */}
                    {roomCategoriesList.length > 0 && (
                        <select
                            value={roomCategoryFilter}
                            onChange={(e) => setRoomCategoryFilter(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20 max-w-[200px]"
                        >
                            <option value="all">Tất cả hạng phòng</option>
                            {roomCategoriesList.map((catName) => (
                                <option key={catName} value={catName}>
                                    {catName}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Ô tìm kiếm */}
                <div className="relative min-w-[260px]">
                    <input
                        type="text"
                        placeholder="Tìm khách hàng, email, nội dung..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition"
                    />
                    <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* BẢNG TABLE LAYOUT THEO SÁT THIẾT KẾ CỦA USER */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="py-4 px-6 min-w-[200px]">Khách hàng</th>
                                <th className="py-4 px-5 min-w-[160px]">Loại phòng</th>
                                <th className="py-4 px-5 min-w-[240px]">Điểm số</th>
                                <th className="py-4 px-6 min-w-[320px]">Nội dung & Phản hồi</th>
                                <th className="py-4 px-5 min-w-[140px]">Ngày gửi</th>
                                <th className="py-4 px-4 min-w-[120px]">Trạng thái</th>
                                <th className="py-4 px-5 text-right min-w-[110px]">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                            {isLoading && (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-slate-400">
                                        <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                                        <div>Đang tải dữ liệu đánh giá...</div>
                                    </td>
                                </tr>
                            )}

                            {!isLoading && filteredReviews.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-slate-400">
                                        <div className="text-4xl mb-2">⭐</div>
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
                                            className="hover:bg-slate-50/60 transition-colors duration-150 align-top"
                                        >
                                            {/* CỘT 1: KHÁCH HÀNG (Hiển thị Tên in đậm và Email nhỏ ở dưới) */}
                                            <td className="py-4 px-6">
                                                <div className="flex items-start gap-3">
                                                    <UserAvatar
                                                        avatar={review.guest_avatar}
                                                        name={review.guest_name}
                                                        size="sm"
                                                    />
                                                    <div>
                                                        <strong className="block font-bold text-slate-900 text-sm leading-tight">
                                                            {review.guest_name}
                                                        </strong>
                                                        <span className="block text-slate-400 text-xs font-mono mt-0.5">
                                                            {review.guest_email || 'Chưa cung cấp email'}
                                                        </span>
                                                        {review.booking_code && (
                                                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono font-medium">
                                                                #{review.booking_code}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* CỘT 2: LOẠI PHÒNG (Tên Hạng phòng) */}
                                            <td className="py-4 px-5">
                                                <div className="space-y-1">
                                                    <span className="font-semibold text-slate-900 block leading-tight">
                                                        {review.room_category_name || 'Hạng phòng tiêu chuẩn'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium block">
                                                        Phòng nghỉ cao cấp
                                                    </span>
                                                </div>
                                            </td>

                                            {/* CỘT 3: ĐIỂM SỐ (Render 5 sao vàng + 2 dòng text nhỏ chi tiết theo đúng mô tả) */}
                                            <td className="py-4 px-5">
                                                <div className="space-y-1.5">
                                                    {/* Render 5 Ngôi sao màu vàng dựa trên overall_rating */}
                                                    <div>{renderStarIcons(review.overall_rating)}</div>

                                                    {/* 2 dòng text nhỏ hiển thị chi tiết */}
                                                    <div className="text-[11px] text-slate-500 font-medium space-y-0.5 leading-tight bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                                                        <div className="flex items-center gap-1.5">
                                                            <span>
                                                                Sạch sẽ: <strong className="text-slate-700">{review.cleanliness_score}/5</strong>
                                                            </span>
                                                            <span className="text-slate-300">|</span>
                                                            <span>
                                                                Dịch vụ: <strong className="text-slate-700">{review.service_score}/5</strong>
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 pt-0.5">
                                                            <span>
                                                                Vị trí: <strong className="text-slate-700">{review.location_score}/5</strong>
                                                            </span>
                                                            <span className="text-slate-300">|</span>
                                                            <span>
                                                                Giá trị: <strong className="text-slate-700">{review.value_score}/5</strong>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* CỘT 4: NỘI DUNG & PHẢN HỒI (Theo đúng UI/UX mô tả) */}
                                            <td className="py-4 px-6">
                                                <div className="space-y-2">
                                                    {/* Nội dung khách viết */}
                                                    <p className="text-xs text-slate-800 leading-relaxed font-normal">
                                                        "{review.comment}"
                                                    </p>

                                                    {/* TRƯỜNG HỢP 1: NẾU ĐÃ CÓ ADMIN_REPLY */}
                                                    {review.admin_reply && !isReplying && (
                                                        <div className="p-3 bg-gray-50 border-l-4 border-yellow-500 rounded-r-xl text-xs space-y-1 group relative">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-bold text-slate-900 text-[11px] flex items-center gap-1.5">
                                                                    <span>🏨</span>
                                                                    <span>Khách sạn phản hồi:</span>
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStartReply(review)}
                                                                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline opacity-80 group-hover:opacity-100 transition cursor-pointer"
                                                                    title="Chỉnh sửa câu trả lời"
                                                                >
                                                                    Chỉnh sửa
                                                                </button>
                                                            </div>
                                                            <p className="text-slate-700 leading-relaxed font-normal">
                                                                {review.admin_reply}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* TRƯỜNG HỢP 2: NẾU ADMIN_REPLY RỖNG VÀ CHƯA BẤM NÚT */}
                                                    {!review.admin_reply && !isReplying && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStartReply(review)}
                                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline transition cursor-pointer pt-1"
                                                        >
                                                            <span className="text-sm">↪</span>
                                                            <span>Viết phản hồi</span>
                                                        </button>
                                                    )}

                                                    {/* Ô INPUT NHẬP PHẢN HỒI KHI CLICK */}
                                                    {isReplying && (
                                                        <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-200 space-y-2.5 animate-in fade-in duration-200">
                                                            <label className="block text-[11px] font-bold text-blue-900">
                                                                Nhập câu trả lời của Khách Sạn:
                                                            </label>
                                                            <textarea
                                                                rows={3}
                                                                value={replyDraft}
                                                                onChange={(e) => setReplyDraft(e.target.value)}
                                                                placeholder="Kính chào quý khách, khách sạn TA Đà Nẵng chân thành cảm ơn quý khách..."
                                                                className="w-full p-2.5 bg-white border border-blue-300 focus:border-blue-600 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 transition leading-relaxed"
                                                            />
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    disabled={isSubmittingReply}
                                                                    onClick={() => handleSaveReply(review.id)}
                                                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    {isSubmittingReply ? (
                                                                        <>
                                                                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
                                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
                                                                >
                                                                    Hủy
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* CỘT 5: NGÀY GỬI */}
                                            <td className="py-4 px-5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                                                {formatDateTimeDisplay(review.created_at)}
                                            </td>

                                            {/* CỘT 6: TRẠNG THÁI (Badge "Hiển thị" màu xanh ngọc / "Đã ẩn" màu xám) */}
                                            <td className="py-4 px-4 whitespace-nowrap">
                                                {review.is_visible ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                        <span>Hiển thị</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                        <span>Đã ẩn</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* CỘT 7: HÀNH ĐỘNG (2 nút icon: Nút "Ẩn/Hiện" màu cam và Nút "Xóa" màu đỏ) */}
                                            <td className="py-4 px-5 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* Nút Ẩn / Hiện (Màu cam) */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleVisibility(review)}
                                                        className={`p-2 rounded-xl border transition shadow-2xs cursor-pointer ${
                                                            review.is_visible
                                                                ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                                                                : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                                                        }`}
                                                        title={
                                                            review.is_visible
                                                                ? 'Bấm để Ẩn đánh giá này khỏi trang khách'
                                                                : 'Bấm để Cho phép Hiển thị đánh giá công khai'
                                                        }
                                                    >
                                                        {review.is_visible ? (
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                                            </svg>
                                                        ) : (
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                        )}
                                                    </button>

                                                    {/* Nút Xóa (Màu đỏ) */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteConfirmReview(review)}
                                                        className="p-2 rounded-xl text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 transition shadow-2xs cursor-pointer"
                                                        title="Xóa đánh giá này"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl font-bold">
                            🗑️
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
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
