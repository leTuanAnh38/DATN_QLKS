import React, { useState, useEffect, useMemo } from 'react';
import { Star } from 'lucide-react';
import { reviewService } from '../../services/reviewService';
import { useHotelSettings } from '../../store/hotelSettingStore';
import { resolveMediaUrl } from '../../utils/mediaUrl';

const FALLBACK_REVIEWS = [
    {
        id: 'fb-1',
        guest_name: 'Trần Anh Long',
        guest_subtitle: 'CEO • Tập đoàn Tài chính SunCapital',
        overall_rating: 5,
        comment:
            'Kỳ nghỉ 5 ngày tại Presidential Suite của Khách Sạn TA Đà Nẵng vượt ngoài mọi sự kỳ vọng. Dịch vụ quản gia chăm sóc chu đáo đến từng chi tiết nhỏ nhất. Hồ bơi vô cực view hoàng hôn thực sự tuyệt mỹ!'
    },
    {
        id: 'fb-2',
        guest_name: 'Minh Hằng & David Lee',
        guest_subtitle: 'Du khách từ Singapore',
        overall_rating: 5,
        comment:
            'Kỳ nghỉ trăng mật bên bờ biển Mỹ Khê khiến vợ chồng tôi nhớ mãi. Bữa tối nến ven biển với rượu vang và hải sản hảo hạng như trong phim. Không gian cách âm yên tĩnh hoàn hảo và phòng thơm mùi hoa sen tự nhiên.'
    },
    {
        id: 'fb-3',
        guest_name: 'Nguyễn Vũ Phương',
        guest_subtitle: 'Kiến trúc sư • Hà Nội',
        overall_rating: 5,
        comment:
            'The Lotus Spa và khu trị liệu thảo dược xứng đáng là điểm nhấn số một. Trải nghiệm thư giãn xua tan hoàn toàn nhức mỏi sau chuyến bay dài. Khách Sạn TA Đà Nẵng là điểm dừng chân tuyệt vời nhất miền Trung hiện nay.'
    }
];

const getGuestDisplayName = (rev) =>
    (
        rev?.guest_name ||
        rev?.guest_full_name ||
        rev?.guest?.full_name ||
        rev?.guest?.username ||
        'Du khách lưu trú'
    ).trim();

const getInitials = (name) => {
    if (!name) return 'TA';
    const clean = name.replace(/&/g, ' ').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const AVATAR_STYLES = [
    'bg-sky-100/90 text-sky-700',
    'bg-amber-100/80 text-amber-800',
    'bg-indigo-100/80 text-indigo-700'
];

export default function GuestTestimonials() {
    const { settings } = useHotelSettings();
    const hotelName = settings?.hotel_name || 'Khách Sạn TA Đà Nẵng';
    const [rawReviews, setRawReviews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReviews = async () => {
            try {
                setLoading(true);
                const res = await reviewService.getReviews({ page: 1 });
                const list = res?.results || res?.data || [];
                if (Array.isArray(list) && list.length > 0) {
                    setRawReviews(list);
                } else {
                    setRawReviews(FALLBACK_REVIEWS);
                }
            } catch {
                setRawReviews(FALLBACK_REVIEWS);
            } finally {
                setLoading(false);
            }
        };

        fetchReviews();
    }, []);

    // Lọc lấy 3 đánh giá từ 3 khách hàng khác nhau (chống trùng 1 người nhiều đánh giá)
    const displayReviews = useMemo(() => {
        const seenGuests = new Set();
        const uniqueList = [];

        const candidates = [
            ...rawReviews.filter((r) => Number(r?.overall_rating || 5) >= 4),
            ...FALLBACK_REVIEWS
        ];

        for (const rev of candidates) {
            if (!rev?.comment) continue;
            const nameKey = getGuestDisplayName(rev).toLowerCase();
            const userIdKey = rev?.guest?.id || rev?.guest_id || nameKey;
            if (!seenGuests.has(nameKey) && !seenGuests.has(userIdKey)) {
                seenGuests.add(nameKey);
                seenGuests.add(userIdKey);
                uniqueList.push(rev);
            }
            if (uniqueList.length >= 3) break;
        }

        return uniqueList;
    }, [rawReviews]);

    return (
        <section className="py-12 sm:py-20 bg-[#f4f7fb] border-b border-slate-200/60">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header tối giản, sang trọng theo mẫu */}
                <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-14">
                    <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-amber-700 mb-3">
                        ĐÁNH GIÁ KHÁCH HÀNG
                    </span>
                    <h2 className="font-serif text-2xl sm:text-4xl lg:text-[42px] font-bold text-slate-900 leading-[1.22] tracking-tight">
                        Cảm Nhận Chân Thực Về {hotelName}
                    </h2>
                </div>

                {/* 3 Cards Grid theo đúng bố cục mẫu */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-7">
                        {[1, 2, 3].map((n) => (
                            <div
                                key={n}
                                className="bg-white rounded-3xl p-7 sm:p-8 border border-slate-100 animate-pulse space-y-5"
                            >
                                <div className="h-4 bg-slate-200 rounded w-1/3" />
                                <div className="space-y-2.5">
                                    <div className="h-3.5 bg-slate-100 rounded w-full" />
                                    <div className="h-3.5 bg-slate-100 rounded w-11/12" />
                                    <div className="h-3.5 bg-slate-100 rounded w-4/5" />
                                </div>
                                <div className="pt-4 border-t border-slate-100 flex items-center gap-3.5">
                                    <div className="w-11 h-11 rounded-full bg-slate-200" />
                                    <div className="space-y-2 flex-1">
                                        <div className="h-3.5 bg-slate-200 rounded w-1/2" />
                                        <div className="h-3 bg-slate-100 rounded w-2/3" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-7 overflow-x-auto sm:overflow-visible snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:pb-0 no-scrollbar">
                        {displayReviews.map((rev, idx) => {
                            const guestName = getGuestDisplayName(rev);
                            const subtitle =
                                rev.guest_subtitle ||
                                (rev.room_category_name || rev.room_name
                                    ? `Khách lưu trú • ${rev.room_category_name || rev.room_name}`
                                    : 'Khách lưu trú xác thực');
                            const starCount = Math.round(Number(rev.overall_rating || 5));
                            const avatarUrl = resolveMediaUrl(rev.guest_avatar, null);
                            const avatarTone = AVATAR_STYLES[idx % AVATAR_STYLES.length];
                            const cleanComment = String(rev.comment || '')
                                .replace(/^["“]+|["”]+$/g, '')
                                .trim();

                            return (
                                <article
                                    key={rev.id || idx}
                                    className="w-[84vw] max-w-[330px] sm:w-auto sm:max-w-none shrink-0 snap-center bg-white rounded-3xl p-5 sm:p-8 border border-slate-100 shadow-[0_10px_30px_-15px_rgba(15,23,42,0.06)] hover:shadow-[0_20px_40px_-15px_rgba(15,23,42,0.12)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                                >
                                    <div>
                                        {/* 5 Ngôi sao vàng nâu sang trọng ở trên cùng */}
                                        <div className="flex items-center gap-1.5 mb-5">
                                            {[1, 2, 3, 4, 5].map((s) => (
                                                <Star
                                                    key={s}
                                                    className={`w-4 h-4 ${
                                                        s <= starCount
                                                            ? 'fill-amber-600 text-amber-600'
                                                            : 'fill-slate-200 text-slate-200'
                                                    }`}
                                                />
                                            ))}
                                        </div>

                                        {/* Trích dẫn in nghiêng trong ngoặc kép */}
                                        <p className="text-slate-600 italic text-xs sm:text-[13.5px] leading-[1.75] mb-7">
                                            "{cleanComment}"
                                        </p>
                                    </div>

                                    {/* Đường kẻ mảnh + Avatar chữ viết tắt + Tên & Chức danh/Hạng phòng */}
                                    <div className="pt-5 border-t border-slate-100 flex items-center gap-3.5 mt-auto">
                                        {avatarUrl ? (
                                            <img
                                                src={avatarUrl}
                                                alt={guestName}
                                                loading="lazy"
                                                decoding="async"
                                                className="w-11 h-11 rounded-full object-cover shrink-0 border border-slate-200/80"
                                            />
                                        ) : (
                                            <div
                                                className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs tracking-wide shrink-0 ${avatarTone}`}
                                            >
                                                {getInitials(guestName)}
                                            </div>
                                        )}

                                        <div className="min-w-0">
                                            <h3 className="text-sm font-bold text-slate-900 truncate">
                                                {guestName}
                                            </h3>
                                            <p className="text-xs text-slate-500 truncate mt-0.5">
                                                {subtitle}
                                            </p>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
