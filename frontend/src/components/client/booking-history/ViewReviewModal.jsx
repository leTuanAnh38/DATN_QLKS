import React from 'react';
import { Star, X, Hotel, Clock } from 'lucide-react';

/**
 * Modal xem lại đánh giá của khách hàng và phản hồi của ban quản lý khách sạn
 */
export default function ViewReviewModal({
    booking,
    onClose,
    hotelName = 'Khách Sạn TA Đà Nẵng',
    formatDateTimeDisplay = (d) => d
}) {
    if (!booking || !booking.review) return null;

    const review = booking.review;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
                {/* Header Modal */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-500 border border-amber-200/80 flex items-center justify-center">
                            <Star className="w-6 h-6 fill-amber-500 text-amber-500" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                                Đánh giá của bạn
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {booking.room_name} • Mã đơn:{' '}
                                <strong className="font-mono text-slate-700">
                                    {booking.booking_code}
                                </strong>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                        title="Đóng"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Điểm tổng quan */}
                <div className="p-4 bg-gradient-to-r from-amber-50 via-orange-50/40 to-slate-50 rounded-2xl border border-amber-200/80 flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                            Điểm đánh giá trung bình
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-2xl font-black text-amber-600">
                                {Number(review.overall_rating || 5).toFixed(1)}
                            </span>
                            <span className="text-xs text-slate-400">/ 5.0</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                                key={star}
                                className={`w-5 h-5 ${
                                    star <= Math.round(Number(review.overall_rating || 5))
                                        ? 'fill-amber-400 text-amber-400'
                                        : 'text-slate-200 fill-slate-200'
                                }`}
                            />
                        ))}
                    </div>
                </div>

                {/* 4 Tiêu chí chi tiết */}
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                        <span className="text-slate-600">Sạch sẽ:</span>
                        <strong className="text-slate-900 font-mono flex items-center gap-1">
                            <span>{review.cleanliness_score}/5</span>
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        </strong>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                        <span className="text-slate-600">Dịch vụ:</span>
                        <strong className="text-slate-900 font-mono flex items-center gap-1">
                            <span>{review.service_score}/5</span>
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        </strong>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                        <span className="text-slate-600">Vị trí:</span>
                        <strong className="text-slate-900 font-mono flex items-center gap-1">
                            <span>{review.location_score}/5</span>
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        </strong>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                        <span className="text-slate-600">Giá trị:</span>
                        <strong className="text-slate-900 font-mono flex items-center gap-1">
                            <span>{review.value_score}/5</span>
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        </strong>
                    </div>
                </div>

                {/* Nội dung đánh giá của khách */}
                <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Nội dung nhận xét:
                    </span>
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs sm:text-sm text-slate-800 leading-relaxed font-normal">
                        "{review.comment}"
                    </div>
                    <span className="text-[10px] text-slate-400 block pt-0.5">
                        Gửi lúc: {formatDateTimeDisplay(review.created_at)}
                    </span>
                </div>

                {/* Phản hồi từ khách sạn (theo thiết kế viền trái hổ phách) */}
                {review.admin_reply ? (
                    <div className="p-4 bg-amber-50/40 border-l-4 border-amber-500 rounded-r-2xl space-y-1.5 shadow-2xs">
                        <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <Hotel className="w-3.5 h-3.5 text-amber-600" />
                            <span>{hotelName} phản hồi:</span>
                        </span>
                        <p className="text-xs text-slate-700 leading-relaxed font-normal">
                            {review.admin_reply}
                        </p>
                    </div>
                ) : (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-500 italic flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Khách sạn đã ghi nhận đánh giá của quý khách và sẽ sớm phản hồi.</span>
                    </div>
                )}

                {/* Nút đóng */}
                <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                    Đóng
                </button>
            </div>
        </div>
    );
}

