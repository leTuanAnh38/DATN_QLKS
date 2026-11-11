import React, { useState, useEffect, useMemo } from 'react';
import {
    Star,
    CheckCircle2,
    AlertCircle,
    X,
    Crown,
    ChevronLeft,
    ChevronRight,
    SlidersHorizontal
} from 'lucide-react';
import UserAvatar from '../../common/UserAvatar';
import { reviewService } from '../../../services/reviewService';

const REVIEWS_PER_PAGE = 4;

export default function RoomReviewsSection({
    room,
    settings = {},
    reviews = [],
    isLoadingReviews = false,
    reviewStats = {
        total: 0,
        average: '5.0',
        cleanliness: '5.0',
        service: '5.0',
        location: '5.0',
        value: '5.0'
    },
    bookingToReview = null,
    setBookingToReview = () => {},
    eligibleBooking = null,
    setEligibleBooking = () => {},
    reviewToast = null,
    setReviewToast = () => {},
    onReviewSubmitted = () => {}
}) {
    // State cục bộ cho Form viết đánh giá
    const [cleanlinessScore, setCleanlinessScore] = useState(5);
    const [serviceScore, setServiceScore] = useState(5);
    const [locationScore, setLocationScore] = useState(5);
    const [valueScore, setValueScore] = useState(5);
    const [reviewComment, setReviewComment] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    // State phân trang & bộ lọc số sao
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedStarFilter, setSelectedStarFilter] = useState('all');

    // Lọc danh sách đánh giá theo số sao
    const filteredReviews = useMemo(() => {
        if (!reviews || !Array.isArray(reviews)) return [];
        if (selectedStarFilter === 'all') return reviews;
        return reviews.filter((rev) => {
            const score = Math.round(parseFloat(rev.overall_rating) || 5);
            if (selectedStarFilter === '5') return score === 5;
            if (selectedStarFilter === '4') return score === 4;
            if (selectedStarFilter === 'below4') return score < 4;
            return true;
        });
    }, [reviews, selectedStarFilter]);

    // Reset về trang 1 khi danh sách hoặc bộ lọc thay đổi
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedStarFilter, reviews.length]);

    const totalPages = Math.ceil(filteredReviews.length / REVIEWS_PER_PAGE) || 1;

    // Danh sách đánh giá được cắt cho trang hiện tại
    const paginatedReviews = useMemo(() => {
        const start = (currentPage - 1) * REVIEWS_PER_PAGE;
        return filteredReviews.slice(start, start + REVIEWS_PER_PAGE);
    }, [filteredReviews, currentPage]);

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
        setCurrentPage(newPage);
        const el = document.getElementById('danh-gia');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const getPageNumbers = () => {
        if (totalPages <= 5) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        if (currentPage <= 3) {
            return [1, 2, 3, 4, '...', totalPages];
        }
        if (currentPage >= totalPages - 2) {
            return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        }
        return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
    };

    const showReviewToast = (type, text) => {
        setReviewToast({ type, text });
        setTimeout(() => {
            setReviewToast(null);
        }, 5000);
    };

    const handleSubmitReview = async (e) => {
        if (e) e.preventDefault();
        if (!bookingToReview?.id) {
            showReviewToast('error', 'Không tìm thấy thông tin đơn đặt phòng để đánh giá.');
            return;
        }
        if (!reviewComment.trim()) {
            showReviewToast('error', 'Vui lòng nhập nội dung nhận xét hoặc chia sẻ trải nghiệm của bạn.');
            return;
        }

        try {
            setIsSubmittingReview(true);
            const payload = {
                booking_id: bookingToReview.id,
                cleanliness_score: cleanlinessScore,
                service_score: serviceScore,
                location_score: locationScore,
                value_score: valueScore,
                comment: reviewComment.trim()
            };

            const res = await reviewService.createReview(payload);
            if (res && res.success) {
                showReviewToast('success', 'Cảm ơn quý khách đã gửi đánh giá trải nghiệm nghỉ dưỡng!');
                setReviewComment('');
                setBookingToReview(null);
                setEligibleBooking(null);
                if (onReviewSubmitted) {
                    await onReviewSubmitted();
                }
            } else {
                showReviewToast('error', res?.message || 'Không thể gửi đánh giá. Vui lòng thử lại sau.');
            }
        } catch (err) {
            console.error('Lỗi khi gửi đánh giá:', err);
            showReviewToast(
                'error',
                err?.response?.data?.message || err?.message || 'Đã xảy ra lỗi khi gửi đánh giá.'
            );
        } finally {
            setIsSubmittingReview(false);
        }
    };

    return (
        <div
            id="danh-gia"
            className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-8 scroll-mt-24"
        >
            {/* 1. TIÊU ĐỀ & ĐIỂM TỔNG QUAN */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs uppercase font-bold tracking-widest text-amber-600">
                            Trải nghiệm khách hàng
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                            ✓ Đã xác thực
                        </span>
                    </div>
                    <h3 className="font-serif text-2xl font-bold text-slate-900 mt-1">
                        Đánh giá & Trải nghiệm thực tế
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Được đóng góp bởi những du khách đã hoàn tất kỳ nghỉ tại {room?.name}
                    </p>
                </div>

                <div className="flex items-center gap-3.5 bg-white border border-slate-200 px-5 py-3 rounded-2xl shadow-xs shrink-0">
                    <div className="text-right">
                        <div className="text-xs text-slate-800 font-bold uppercase tracking-wider">
                            {parseFloat(reviewStats.average) >= 4.8
                                ? 'Tuyệt hảo'
                                : parseFloat(reviewStats.average) >= 4.0
                                ? 'Rất tốt'
                                : 'Hài lòng'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium">
                            {reviewStats.total} lượt đánh giá
                        </div>
                    </div>
                    <div className="border-l border-slate-200 pl-3.5 flex items-baseline gap-1">
                        <span className="font-black text-3xl text-slate-900">
                            {reviewStats.average}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">/5.0</span>
                    </div>
                </div>
            </div>

            {/* 2. THỐNG KÊ 4 TIÊU CHÍ ĐÁNH GIÁ (SẠCH SẼ, DỊCH VỤ, VỊ TRÍ, GIÁ TRỊ) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-1.5 p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">Sạch sẽ</span>
                        <span className="font-bold text-slate-900">{reviewStats.cleanliness}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                            className="bg-amber-500 h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${(parseFloat(reviewStats.cleanliness) / 5) * 100}%`
                            }}
                        />
                    </div>
                </div>

                <div className="space-y-1.5 p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">Dịch vụ</span>
                        <span className="font-bold text-slate-900">{reviewStats.service}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                            className="bg-amber-500 h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${(parseFloat(reviewStats.service) / 5) * 100}%`
                            }}
                        />
                    </div>
                </div>

                <div className="space-y-1.5 p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">Vị trí</span>
                        <span className="font-bold text-slate-900">{reviewStats.location}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                            className="bg-amber-500 h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${(parseFloat(reviewStats.location) / 5) * 100}%`
                            }}
                        />
                    </div>
                </div>

                <div className="space-y-1.5 p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">Giá trị</span>
                        <span className="font-bold text-slate-900">{reviewStats.value}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                            className="bg-amber-500 h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${(parseFloat(reviewStats.value) / 5) * 100}%`
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* 3. TOAST THÔNG BÁO GỬI ĐÁNH GIÁ */}
            {reviewToast && (
                <div
                    className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold animate-in fade-in duration-300 ${
                        reviewToast.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-50 text-rose-800 border border-rose-300'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {reviewToast.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>{reviewToast.text}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setReviewToast(null)}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* 4. FORM VIẾT ĐÁNH GIÁ (KHI CÓ BOOKING CẦN ĐÁNH GIÁ) */}
            {bookingToReview && (
                <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-lg shadow-xs">
                                <Star className="w-5 h-5 fill-white text-white" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 text-sm sm:text-base">
                                        Đánh giá kỳ nghỉ của quý khách
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono text-[11px] font-bold">
                                        #{bookingToReview.booking_code}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {bookingToReview.room_name || room?.name}
                                    {bookingToReview.room_number
                                        ? ` • Phòng ${bookingToReview.room_number}`
                                        : ''}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setBookingToReview(null)}
                            className="self-end sm:self-auto text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition flex items-center gap-1.5"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>Thu gọn</span>
                        </button>
                    </div>

                    {/* Điểm tổng quan dự kiến */}
                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-2xs">
                        <div>
                            <span className="text-xs font-semibold text-slate-500 block">
                                Điểm đánh giá trung bình:
                            </span>
                            <span className="font-serif text-xl font-bold text-slate-900">
                                {(
                                    (cleanlinessScore +
                                        serviceScore +
                                        locationScore +
                                        valueScore) /
                                    4
                                ).toFixed(1)}{' '}
                                / 5.0
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <svg
                                    key={s}
                                    className={`w-5 h-5 ${
                                        s <=
                                        Math.round(
                                            (cleanlinessScore +
                                                serviceScore +
                                                locationScore +
                                                valueScore) /
                                                4
                                        )
                                            ? 'text-amber-400 fill-amber-400'
                                            : 'text-slate-200 fill-slate-200'
                                    }`}
                                    viewBox="0 0 20 20"
                                >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                            ))}
                        </div>
                    </div>

                    {/* 4 Tiêu chí đánh giá sao */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Tiêu chí 1: Sạch sẽ */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200">
                            <div>
                                <span className="text-xs font-semibold text-slate-700">Mức độ sạch sẽ</span>
                            </div>
                            <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setCleanlinessScore(star)}
                                        className="p-1 hover:scale-125 transition-transform cursor-pointer"
                                        title={`${star} sao`}
                                    >
                                        <svg
                                            className={`w-6 h-6 ${
                                                star <= cleanlinessScore
                                                    ? 'text-amber-400 fill-amber-400'
                                                    : 'text-slate-200 fill-slate-200'
                                            } transition-colors`}
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    </button>
                                ))}
                                <span className="text-xs font-bold text-slate-800 ml-1.5 w-6 text-right">
                                    {cleanlinessScore}.0
                                </span>
                            </div>
                        </div>

                        {/* Tiêu chí 2: Dịch vụ */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200">
                            <div>
                                <span className="text-xs font-semibold text-slate-700">Chất lượng phục vụ</span>
                            </div>
                            <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setServiceScore(star)}
                                        className="p-1 hover:scale-125 transition-transform cursor-pointer"
                                        title={`${star} sao`}
                                    >
                                        <svg
                                            className={`w-6 h-6 ${
                                                star <= serviceScore
                                                    ? 'text-amber-400 fill-amber-400'
                                                    : 'text-slate-200 fill-slate-200'
                                            } transition-colors`}
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    </button>
                                ))}
                                <span className="text-xs font-bold text-slate-800 ml-1.5 w-6 text-right">
                                    {serviceScore}.0
                                </span>
                            </div>
                        </div>

                        {/* Tiêu chí 3: Vị trí */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200">
                            <div>
                                <span className="text-xs font-semibold text-slate-700">Vị trí & Cảnh quan</span>
                            </div>
                            <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setLocationScore(star)}
                                        className="p-1 hover:scale-125 transition-transform cursor-pointer"
                                        title={`${star} sao`}
                                    >
                                        <svg
                                            className={`w-6 h-6 ${
                                                star <= locationScore
                                                    ? 'text-amber-400 fill-amber-400'
                                                    : 'text-slate-200 fill-slate-200'
                                            } transition-colors`}
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    </button>
                                ))}
                                <span className="text-xs font-bold text-slate-800 ml-1.5 w-6 text-right">
                                    {locationScore}.0
                                </span>
                            </div>
                        </div>

                        {/* Tiêu chí 4: Giá trị */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200">
                            <div>
                                <span className="text-xs font-semibold text-slate-700">
                                    Giá trị tương xứng chi phí
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setValueScore(star)}
                                        className="p-1 hover:scale-125 transition-transform cursor-pointer"
                                        title={`${star} sao`}
                                    >
                                        <svg
                                            className={`w-6 h-6 ${
                                                star <= valueScore
                                                    ? 'text-amber-400 fill-amber-400'
                                                    : 'text-slate-200 fill-slate-200'
                                            } transition-colors`}
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    </button>
                                ))}
                                <span className="text-xs font-bold text-slate-800 ml-1.5 w-6 text-right">
                                    {valueScore}.0
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Nhận xét cảm nhận */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-700">
                            Chia sẻ chi tiết cảm nhận của quý khách:
                        </label>
                        <textarea
                            rows={4}
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            placeholder="Phòng nghỉ, dịch vụ phòng, tầm nhìn và sự chu đáo của nhân viên đáp ứng kỳ vọng của bạn như thế nào?..."
                            className="w-full p-4 rounded-2xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-xs sm:text-sm text-slate-800 outline-none transition bg-white"
                        />
                    </div>

                    {/* Nút gửi */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setBookingToReview(null)}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmitReview}
                            disabled={isSubmittingReview}
                            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-xs transition shadow-md shadow-sky-900/20 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSubmittingReview ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    <span>Đang gửi đánh giá...</span>
                                </>
                            ) : (
                                <>
                                    <Star className="w-4 h-4 fill-white" />
                                    <span>Gửi Đánh Giá Của Bạn</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* 5. GỢI Ý ĐÁNH GIÁ NẾU KHÁCH CÓ ĐƠN COMPLETED CHƯA REVIEW */}
            {!bookingToReview && eligibleBooking && (
                <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50/70 via-slate-50 to-orange-50/40 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center text-lg shrink-0 shadow-xs">
                            <Star className="w-5 h-5 text-white fill-white" />
                        </div>
                        <div>
                            <strong className="text-xs sm:text-sm text-slate-900 block font-bold">
                                Quý khách vừa hoàn tất kỳ nghỉ tại phòng này (Mã đơn: #{eligibleBooking.booking_code})!
                            </strong>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                                Hãy chia sẻ cảm nhận trải nghiệm của bạn để giúp cộng đồng du khách và hỗ trợ khách sạn hoàn thiện hơn.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setBookingToReview(eligibleBooking)}
                        className="px-4 py-2.5 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-xs rounded-xl shadow-xs transition shrink-0 cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                    >
                        <Star className="w-3.5 h-3.5 fill-white" />
                        <span>Viết Đánh Giá Ngay</span>
                    </button>
                </div>
            )}

            {/* 6. DANH SÁCH ĐÁNH GIÁ THỰC TẾ TỪ CƠ SỞ DỮ LIỆU */}
            <div className="space-y-4">
                {/* BỘ LỌC ĐÁNH GIÁ THEO SỐ SAO (Chỉ hiện khi có từ 3 đánh giá trở lên) */}
                {reviews.length >= 3 && (
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                            <span>Lọc:</span>
                        </span>
                        {[
                            { id: 'all', label: `Tất cả (${reviews.length})` },
                            { id: '5', label: `5 sao (${reviews.filter(r => Math.round(parseFloat(r.overall_rating) || 5) === 5).length})` },
                            { id: '4', label: `4 sao (${reviews.filter(r => Math.round(parseFloat(r.overall_rating) || 5) === 4).length})` },
                            { id: 'below4', label: `< 4 sao (${reviews.filter(r => Math.round(parseFloat(r.overall_rating) || 5) < 4).length})` },
                        ].filter(f => f.id === 'all' || !f.label.endsWith('(0)'))
                        .map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setSelectedStarFilter(tab.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                    selectedStarFilter === tab.id
                                        ? 'bg-slate-900 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                {isLoadingReviews ? (
                    <div className="py-12 text-center space-y-3">
                        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-xs text-slate-500">Đang tải danh sách đánh giá thực tế...</p>
                    </div>
                ) : reviews.length === 0 ? (
                    <div className="py-12 px-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl mx-auto">
                            <Star className="w-6 h-6 fill-amber-500 text-amber-500" />
                        </div>
                        <h4 className="font-serif text-base font-bold text-slate-800">
                            Chưa có đánh giá nào cho hạng phòng này
                        </h4>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                            Hãy là một trong những vị khách đầu tiên trải nghiệm không gian nghỉ dưỡng tuyệt hảo này và để lại cảm nhận của bạn!
                        </p>
                    </div>
                ) : filteredReviews.length === 0 ? (
                    <div className="py-10 px-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-center space-y-2">
                        <p className="text-xs text-slate-500 font-medium">Không có đánh giá nào phù hợp với bộ lọc số sao đã chọn.</p>
                        <button
                            type="button"
                            onClick={() => setSelectedStarFilter('all')}
                            className="text-xs font-bold text-sky-700 hover:underline cursor-pointer"
                        >
                            Xem tất cả {reviews.length} đánh giá
                        </button>
                    </div>
                ) : (
                    paginatedReviews.map((rev) => {
                        const guestFullName =
                            rev.guest_name ||
                            rev.guest_full_name ||
                            rev.guest?.username ||
                            'Du khách lưu trú';
                        const reviewDateStr = rev.created_at
                            ? new Date(rev.created_at).toLocaleDateString('vi-VN', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                              })
                            : '';
                        return (
                            <div
                                key={rev.id}
                                className="p-5 sm:p-6 bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-200/80 transition space-y-3"
                            >
                                {/* Header đánh giá */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                        <UserAvatar
                                            avatar={rev.guest_avatar}
                                            name={guestFullName}
                                            size="md"
                                            role="guest"
                                        />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <strong className="text-xs sm:text-sm text-slate-900 block font-bold">
                                                    {guestFullName}
                                                </strong>
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold">
                                                    ✓ Đã lưu trú
                                                </span>
                                            </div>
                                            <span className="text-[11px] text-slate-400">
                                                {reviewDateStr
                                                    ? `Đánh giá ngày ${reviewDateStr}`
                                                    : 'Đánh giá đã xác thực'}{' '}
                                                • {room?.name}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 self-start sm:self-auto bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                                        <div className="flex items-center gap-0.5">
                                            {[1, 2, 3, 4, 5].map((s) => (
                                                <svg
                                                    key={s}
                                                    className={`w-3.5 h-3.5 ${
                                                        s <=
                                                        Math.round(
                                                            parseFloat(rev.overall_rating) || 5
                                                        )
                                                            ? 'text-amber-400 fill-amber-400'
                                                            : 'text-slate-200 fill-slate-200'
                                                    }`}
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                            ))}
                                        </div>
                                        <span className="font-bold text-xs text-slate-800">
                                            {parseFloat(rev.overall_rating || 5).toFixed(1)}
                                        </span>
                                    </div>
                                </div>

                                {/* Điểm 4 tiêu chí mini tags */}
                                <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 pt-1">
                                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">
                                        Sạch sẽ:{' '}
                                        <strong className="text-slate-800">
                                            {rev.cleanliness_score || 5}/5
                                        </strong>
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">
                                        Dịch vụ:{' '}
                                        <strong className="text-slate-800">
                                            {rev.service_score || 5}/5
                                        </strong>
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">
                                        Vị trí:{' '}
                                        <strong className="text-slate-800">
                                            {rev.location_score || 5}/5
                                        </strong>
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">
                                        Giá trị:{' '}
                                        <strong className="text-slate-800">
                                            {rev.value_score || 5}/5
                                        </strong>
                                    </span>
                                </div>

                                {/* Nội dung đánh giá */}
                                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal pt-1">
                                    "{rev.comment}"
                                </p>

                                {/* Phản hồi từ Ban quản lý khách sạn nếu có */}
                                {rev.admin_reply && (
                                    <div className="mt-3 p-4 bg-amber-50/60 border border-amber-200/70 rounded-2xl space-y-1.5 ml-4 sm:ml-6">
                                        <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                                            <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center">
                                                <Crown className="w-3 h-3 text-white" />
                                            </div>
                                            <span>
                                                Phản hồi từ Ban Quản Lý{' '}
                                                {settings?.hotel_name || 'Khách Sạn TA Đà Nẵng'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-800 leading-relaxed italic pl-7">
                                            "{rev.admin_reply}"
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}

                {/* 7. PHÂN TRANG DANH SÁCH ĐÁNH GIÁ (PAGINATION) */}
                {totalPages > 1 && (
                    <div className="pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        <span className="text-slate-500 text-[11px] order-2 sm:order-1 font-medium">
                            Hiển thị <strong>{(currentPage - 1) * REVIEWS_PER_PAGE + 1} - {Math.min(currentPage * REVIEWS_PER_PAGE, filteredReviews.length)}</strong> trên tổng số <strong>{filteredReviews.length}</strong> đánh giá
                        </span>

                        <div className="flex items-center gap-1.5 order-1 sm:order-2">
                            <button
                                type="button"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="w-8 h-8 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer flex items-center justify-center shrink-0"
                                aria-label="Trang trước"
                                title="Trang trước"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            {getPageNumbers().map((pageNum, idx) => (
                                pageNum === '...' ? (
                                    <span key={`dots-${idx}`} className="px-1 text-slate-400 select-none">
                                        ...
                                    </span>
                                ) : (
                                    <button
                                        key={pageNum}
                                        type="button"
                                        onClick={() => handlePageChange(pageNum)}
                                        className={`min-w-[32px] h-8 px-2 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center shrink-0 ${
                                            currentPage === pageNum
                                                ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md shadow-sky-900/20'
                                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                )
                            ))}

                            <button
                                type="button"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="w-8 h-8 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer flex items-center justify-center shrink-0"
                                aria-label="Trang sau"
                                title="Trang sau"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

