import React from 'react';
import { Star, X } from 'lucide-react';

/**
 * Modal khách hàng gửi đánh giá & chấm sao tiêu chí kỳ nghỉ
 */
export default function ReviewModal({
    booking,
    onClose,
    onSubmit,
    isSubmittingReview = false,
    cleanlinessScore = 5,
    setCleanlinessScore,
    serviceScore = 5,
    setServiceScore,
    locationScore = 5,
    setLocationScore,
    valueScore = 5,
    setValueScore,
    reviewComment = '',
    setReviewComment
}) {
    if (!booking) return null;

    const avgScore = ((cleanlinessScore + serviceScore + locationScore + valueScore) / 4);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-7 shadow-2xl border border-slate-200 space-y-4 sm:space-y-5 max-h-[90vh] overflow-y-auto">
                {/* Header Modal */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-500 border border-amber-200/80 flex items-center justify-center shrink-0">
                            <Star className="w-4 h-4 sm:w-6 sm:h-6 fill-amber-500 text-amber-500" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm sm:text-lg font-bold text-slate-900 leading-tight truncate">
                                Đánh giá kỳ nghỉ của bạn
                            </h3>
                            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                                {booking.room_name} • Mã:{' '}
                                <strong className="font-mono text-slate-700">
                                    #{booking.booking_code}
                                </strong>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition flex items-center justify-center cursor-pointer shrink-0"
                        title="Đóng"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Điểm trung bình tự động tính */}
                <div className="p-3.5 bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50 rounded-2xl border border-amber-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Star className="w-6 h-6 text-amber-500 fill-amber-400" />
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                                Điểm đánh giá tổng quan
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xl font-black text-amber-600">
                                    {avgScore.toFixed(1)}
                                </span>
                                <span className="text-xs text-slate-400 font-medium">/ 5.0</span>
                                <span className="text-xs text-amber-800 font-bold ml-1">
                                    {avgScore >= 4.5
                                        ? '• Tuyệt vời'
                                        : avgScore >= 4.0
                                        ? '• Rất tốt'
                                        : '• Hài lòng'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                                key={star}
                                className={`w-4 h-4 ${
                                    star <= Math.round(avgScore)
                                        ? 'fill-amber-400 text-amber-400'
                                        : 'text-slate-200 fill-slate-200'
                                }`}
                            />
                        ))}
                    </div>
                </div>

                {/* 4 Tiêu chí đánh giá sao */}
                <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Chấm điểm các tiêu chí dịch vụ:
                    </label>

                    {[
                        { key: 'cleanliness', label: 'Mức độ Sạch sẽ (Cleanliness)', val: cleanlinessScore, set: setCleanlinessScore },
                        { key: 'service', label: 'Chất lượng Dịch vụ (Service)', val: serviceScore, set: setServiceScore },
                        { key: 'location', label: 'Vị trí & Cảnh quan (Location)', val: locationScore, set: setLocationScore },
                        { key: 'value', label: 'Giá trị tương xứng (Value)', val: valueScore, set: setValueScore },
                    ].map((criterion) => (
                        <div
                            key={criterion.key}
                            className="p-3 bg-slate-50 hover:bg-slate-100/70 transition rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                            <div>
                                <span className="text-xs font-bold text-slate-800">
                                    {criterion.label}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => criterion.set(star)}
                                            className="p-1 hover:scale-125 transition-transform select-none cursor-pointer"
                                            title={`${star}/5 sao`}
                                        >
                                            <Star
                                                className={`w-4 h-4 ${
                                                    star <= criterion.val
                                                        ? 'fill-amber-400 text-amber-400'
                                                        : 'text-slate-200 fill-slate-200'
                                                }`}
                                            />
                                        </button>
                                    ))}
                                </div>
                                <span className="font-mono font-bold text-xs text-amber-700 w-8 text-right">
                                    {criterion.val}/5
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Ô nhập nội dung cảm nhận */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Cảm nhận chi tiết của bạn <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                        rows={3}
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Hãy chia sẻ trải nghiệm thực tế về phòng nghỉ, nhân viên phục vụ, ẩm thực và tiện nghi tại khách sạn..."
                        className="w-full p-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-500 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition leading-relaxed"
                    />
                    <span className="text-[11px] text-slate-400 block">
                        Đánh giá của bạn giúp khách sạn không ngừng nâng cao chất lượng dịch vụ và hỗ trợ du khách khác tham khảo.
                    </span>
                </div>

                {/* Nút thao tác */}
                <div className="flex items-center gap-3 pt-2">
                    <button
                        type="button"
                        disabled={isSubmittingReview}
                        onClick={onSubmit}
                        className="w-1/2 py-3 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-900/20 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                        {isSubmittingReview ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Đang gửi đánh giá...</span>
                            </>
                        ) : (
                            <>
                                <Star className="w-3.5 h-3.5 fill-white text-white" />
                                <span>Gửi Đánh Giá</span>
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        disabled={isSubmittingReview}
                        onClick={onClose}
                        className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition text-center cursor-pointer"
                    >
                        Để sau
                    </button>
                </div>
            </div>
        </div>
    );
}

