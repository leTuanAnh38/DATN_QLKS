import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import FeaturedRoomCategories from '../../components/client/FeaturedRoomCategories';
import FeaturedServices from '../../components/client/FeaturedServices';
import postService from '../../services/postService';

// Tiện ích ngày tháng
const getTodayStr = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
};

const getTomorrowStr = (baseDateStr) => {
    const d = baseDateStr ? new Date(baseDateStr) : new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
};

const getWeekdayName = (dateStr) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        return days[d.getDay()];
    } catch {
        return '';
    }
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

export default function TADaNangHotelLanding() {
    const navigate = useNavigate();
    const [roomType, setRoomType] = useState('all');
    const [checkInDate, setCheckInDate] = useState(getTodayStr());
    const [checkOutDate, setCheckOutDate] = useState(getTomorrowStr());
    const [guests, setGuests] = useState('2');
    const [latestPosts, setLatestPosts] = useState([]);
    const [isLoadingNews, setIsLoadingNews] = useState(true);

    const calculateNights = () => {
        if (!checkInDate || !checkOutDate) return 1;
        const diff = Math.round((new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24));
        return diff > 0 ? diff : 1;
    };

    const handleCheckInChange = (e) => {
        const val = e.target.value;
        setCheckInDate(val);
        if (val >= checkOutDate) {
            setCheckOutDate(getTomorrowStr(val));
        }
    };

    const handleCheckOutChange = (e) => {
        const val = e.target.value;
        if (val > checkInDate) {
            setCheckOutDate(val);
        }
    };

    const handleSearchRooms = (e) => {
        if (e) e.preventDefault();
        const params = new URLSearchParams();
        if (checkInDate) params.set('checkIn', checkInDate);
        if (checkOutDate) params.set('checkOut', checkOutDate);
        if (guests) params.set('guests', guests);
        if (roomType && roomType !== 'all') params.set('category', roomType);

        navigate(`/rooms?${params.toString()}`, {
            state: {
                checkInDate,
                checkOutDate,
                guestCount: Number(guests) || 2,
                roomType
            }
        });
    };

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const res = await postService.getLatestPosts();
                if (res.success && res.posts) {
                    setLatestPosts(res.posts);
                }
            } catch (err) {
                console.error('Lỗi khi tải tin tức trang chủ:', err);
            } finally {
                setIsLoadingNews(false);
            }
        };
        fetchNews();
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white">
            <Navbar />


            {/* 3. HERO SECTION CHUẨN LUXURY HOTEL */}
            <section className="relative min-h-[560px] lg:h-[620px] flex items-center justify-center bg-slate-950 overflow-hidden">
                {/* 1. Ảnh nền sắc nét 100% không giảm opacity, không blur */}
                <img
                    src="https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1920&q=80"
                    alt="Khách Sạn TA Đà Nẵng Resort"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                />
                {/* 2. Lớp phủ Gradient Tối (phủ đều toàn bộ kết hợp gradient đáy) */}
                <div className="absolute inset-0 bg-black/50 bg-gradient-to-t from-slate-950 via-black/40 to-black/30" />

                {/* 3. Hero Content nổi bật trên cùng (relative z-10) */}
                <div className="relative z-10 max-w-5xl mx-auto px-4 text-center text-white py-16">
                    <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight sm:leading-tight mb-6">
                        Khởi Đầu Kỳ Nghỉ Thượng Lưu Đích Thực <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-sky-200 to-amber-200">
                            Tại Khách Sạn TA Đà Nẵng
                        </span>
                    </h1>

                    <p className="text-base sm:text-lg text-slate-200 max-w-2xl mx-auto mb-8 font-light leading-relaxed">
                        Nơi vẻ đẹp hùng vĩ của biển Mỹ Khê hòa quyện tinh hoa kiến trúc nghỉ dưỡng đương đại.
                        Trải nghiệm dịch vụ quản gia 24/7 và sự thanh tĩnh tuyệt đối.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-slate-300">
                        <span className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Đảm bảo giá trực tiếp tốt nhất
                        </span>
                        <span className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Miễn phí linh hoạt đổi hủy 24h
                        </span>
                        <span className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Đưa đón sân bay VIP Mercedes-Benz
                        </span>
                    </div>
                </div>
            </section>

            {/* 4. FLOATING BOOKING SEARCH BAR WIDGET */}
            <div className="relative z-20 max-w-7xl mx-auto px-4 -mt-14 sm:-mt-16">
                <div className="bg-white rounded-3xl shadow-2xl shadow-slate-900/10 border border-slate-100 p-4 sm:p-5 transition-all duration-300">
                    {/* Form Fields: 4 Input fields + Compact Magnifying Glass Search Button */}
                    <form onSubmit={handleSearchRooms} className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                        {/* Field 1: Hạng phòng */}
                        <div className="flex-1 p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl hover:border-blue-500 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition group">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                <span>🏨</span>
                                <span>Hạng phòng</span>
                            </label>
                            <select
                                value={roomType}
                                onChange={(e) => setRoomType(e.target.value)}
                                className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none cursor-pointer truncate"
                            >
                                <option value="all">Tất cả hạng phòng</option>
                                <option value="deluxe">Hạng Deluxe Biển</option>
                                <option value="suite">Executive & Grand Suite</option>
                                <option value="penthouse">Presidential & Penthouse</option>
                            </select>
                            <div className="text-[11px] text-slate-500 truncate mt-1">
                                {roomType === 'all' && ''}
                                {roomType === 'deluxe' && 'Hướng biển panorama'}
                                {roomType === 'suite' && 'Phòng khách & Ban công riêng'}
                                {roomType === 'penthouse' && 'Hồ bơi vô cực trên cao'}
                            </div>
                        </div>

                        {/* Field 2: Check-in */}
                        <div className="flex-1 p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl hover:border-blue-500 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition group cursor-pointer">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                <span>📅</span>
                                <span>Nhận phòng</span>
                            </label>
                            <input
                                type="date"
                                min={getTodayStr()}
                                value={checkInDate}
                                onChange={handleCheckInChange}
                                className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none cursor-pointer"
                            />
                            <div className="text-[11px] text-blue-600 font-semibold truncate mt-1">
                                {getWeekdayName(checkInDate)} (từ 14:00)
                            </div>
                        </div>

                        {/* Field 3: Check-out */}
                        <div className="flex-1 p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl hover:border-blue-500 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition group cursor-pointer">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                <span>🗓️</span>
                                <span>Trả phòng</span>
                            </label>
                            <input
                                type="date"
                                min={getTomorrowStr(checkInDate)}
                                value={checkOutDate}
                                onChange={handleCheckOutChange}
                                className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none cursor-pointer"
                            />
                            <div className="text-[11px] text-emerald-600 font-semibold truncate mt-1">
                                {getWeekdayName(checkOutDate)} ({calculateNights()} đêm lưu trú)
                            </div>
                        </div>

                        {/* Field 4: Guests & Rooms */}
                        <div className="flex-1 p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl hover:border-blue-500 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition group">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                <span>👥</span>
                                <span>Khách & Phòng</span>
                            </label>
                            <select
                                value={guests}
                                onChange={(e) => setGuests(e.target.value)}
                                className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none cursor-pointer truncate"
                            >
                                <option value="1">1 Khách (1 Người lớn)</option>
                                <option value="2">2 Khách (2 Người lớn)</option>
                                <option value="3">3 Khách (2 Lớn + 1 Trẻ em)</option>
                                <option value="4">4 Khách (Gia đình 4 người)</option>
                                <option value="6">5+ Khách (Đoàn du lịch)</option>
                            </select>
                            <div className="text-[11px] text-blue-600 font-medium truncate mt-1">
                                {Number(guests) === 1 && '1 Giường King / Queen'}
                                {Number(guests) === 2 && '1 Phòng Suite / Deluxe'}
                                {Number(guests) >= 3 && 'Hỗ trợ nôi & giường phụ'}
                            </div>
                        </div>

                        {/* Field 5: Action Button (Nút kính lúp nhỏ gọn) */}
                        <div className="flex items-center justify-center shrink-0">
                            <button
                                type="submit"
                                title="Tìm kiếm phòng trống"
                                className="w-full lg:w-[68px] h-12 lg:h-[72px] bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl shadow-lg shadow-orange-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition cursor-pointer"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* 5. LIVE ROOM CATEGORIES SECTION (Connected to Django Backend PMS) */}
            <div id="phong-nghi">
                <FeaturedRoomCategories />
            </div>

            {/* 6. HOTEL SERVICES & CUISINE MENU (Connected to PMS & Services API) */}
            <FeaturedServices />

            {/* 7. TIN TỨC & CẨM NANG NGHỈ DƯỠNG MỚI NHẤT */}
            <section id="tin-tuc" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header Tiêu đề */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                    <div>
                        <div className="text-xs uppercase font-bold tracking-widest text-blue-600 mb-2 flex items-center gap-1.5">
                            <span>📰</span>
                            <span>TIN TỨC & CẨM NANG NGHỈ DƯỠNG</span>
                        </div>
                        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
                            Khám Phá Trải Nghiệm Mới Nhất
                        </h2>
                        <p className="text-slate-600 text-sm sm:text-base max-w-2xl">
                            Cập nhật tin tức sự kiện, cẩm nang du lịch Đà Nẵng và những trải nghiệm ẩm thực thượng lưu độc quyền tại Khách sạn TA.
                        </p>
                    </div>

                    <Link
                        to="/news"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 hover:border-blue-600 hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-xs sm:text-sm font-bold transition shadow-xs whitespace-nowrap self-start md:self-auto group"
                    >
                        <span>Xem tất cả tin tức</span>
                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </Link>
                </div>

                {/* Danh sách bài viết */}
                {isLoadingNews ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white rounded-3xl p-5 border border-slate-200 animate-pulse space-y-4 shadow-xs">
                                <div className="h-52 bg-slate-200 rounded-2xl"></div>
                                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                                <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                                <div className="h-4 bg-slate-200 rounded w-full"></div>
                                <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                            </div>
                        ))}
                    </div>
                ) : latestPosts.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 shadow-xs max-w-md mx-auto">
                        <div className="text-4xl mb-3">📰</div>
                        <h3 className="font-bold text-slate-800 text-base mb-1">Đang cập nhật bài viết mới</h3>
                        <p className="text-xs text-slate-500 mb-5">Hệ thống đang chuẩn bị những cẩm nang nghỉ dưỡng tuyệt vời nhất cho bạn.</p>
                        <Link to="/news" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition">
                            Khám phá chuyên trang Tin tức
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {latestPosts.slice(0, 3).map((post) => (
                            <article
                                key={post.id}
                                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                            >
                                <div>
                                    {/* Ảnh bìa */}
                                    <Link to={`/news/${post.slug || post.id}`} className="block relative h-52 overflow-hidden bg-slate-100">
                                        {post.thumbnail_url ? (
                                            <img
                                                src={post.thumbnail_url}
                                                alt={post.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-slate-100 to-slate-200 text-slate-400 text-4xl">
                                                🏨
                                            </div>
                                        )}
                                        {/* Category Badge */}
                                        <span className="absolute top-3.5 left-3.5 px-3 py-1 rounded-lg bg-white/95 backdrop-blur-xs border border-slate-200/80 text-[11px] font-bold text-slate-800 shadow-xs">
                                            {post.category_display || post.category || 'Khám phá'}
                                        </span>
                                    </Link>

                                    {/* Nội dung tóm tắt */}
                                    <div className="p-6 space-y-3">
                                        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                            <span>📅 {formatDate(post.created_at || post.published_at)}</span>
                                            <span>•</span>
                                            <span>👁️ {post.view_count || 0} lượt xem</span>
                                        </div>

                                        <Link to={`/news/${post.slug || post.id}`}>
                                            <h3 className="font-serif font-bold text-lg text-slate-900 group-hover:text-blue-600 transition line-clamp-2 leading-snug">
                                                {post.title}
                                            </h3>
                                        </Link>

                                        <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed">
                                            {post.summary || 'Khám phá chi tiết những thông tin hữu ích trong bài viết cùng khách sạn TA...'}
                                        </p>
                                    </div>
                                </div>

                                {/* Footer thẻ */}
                                <div className="px-6 pb-6 pt-3 flex items-center justify-between border-t border-slate-100 text-xs">
                                    <span className="text-xs text-slate-500 font-semibold truncate max-w-[140px]">
                                        ✍️ {post.author || 'Ban Biên Tập'}
                                    </span>
                                    <Link
                                        to={`/news/${post.slug || post.id}`}
                                        className="font-bold text-blue-600 group-hover:text-blue-700 transition flex items-center gap-1.5"
                                    >
                                        <span>Chi tiết</span>
                                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <Footer />

        </div>
    );
}