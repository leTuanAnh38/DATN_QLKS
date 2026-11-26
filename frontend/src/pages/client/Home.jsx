import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    BedDouble,
    Calendar,
    CalendarDays,
    Users,
    Search,
    Building2,
    ChevronLeft,
    ChevronRight,
    ArrowRight,
    Newspaper,
    Eye,
    PenLine,
    ShieldCheck,
    Clock,
    Car
} from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import FeaturedRoomCategories from '../../components/client/FeaturedRoomCategories';
import ResortExperienceBento from '../../components/client/ResortExperienceBento';
import FeaturedServices from '../../components/client/FeaturedServices';
import FeaturedPromotions from '../../components/client/FeaturedPromotions';
import GuestTestimonials from '../../components/client/GuestTestimonials';
import postService from '../../services/postService';
import roomService from '../../services/roomService';
import { useHotelSettings, DEFAULT_BANNERS } from '../../store/hotelSettingStore';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { formatDateToInput, getNextDayString } from '../../utils/formatters';

// Helper chuẩn hóa URL hình ảnh (hỗ trợ cả link tuyệt đối, local media và tự động nâng cấp ảnh mờ)
const resolveBannerUrl = (url, fallback) => {
    if (!url) return fallback || '';
    // Nếu đang trỏ vào ảnh cũ bị mờ hạt (photo-1571896349842-33c89424de2d), tự động nâng cấp sang ảnh 4K sắc nét
    if (typeof url === 'string' && url.includes('photo-1571896349842-33c89424de2d')) {
        return fallback || 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=2070&q=90';
    }
    return resolveMediaUrl(url, fallback || '');
};

// Tiện ích ngày tháng (tính theo giờ địa phương để tránh lệch ngày UTC)
const getTodayStr = () => formatDateToInput(new Date());

const getTomorrowStr = (baseDateStr) => {
    const base = baseDateStr || getTodayStr();
    return getNextDayString(base);
};

const getWeekdayName = (dateStr) => {
    if (!dateStr) return '';
    try {
        const match = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const d = match
            ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
            : new Date(dateStr);
        if (isNaN(d.getTime())) return '';
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
    const checkInRef = useRef(null);
    const checkOutRef = useRef(null);
    const [roomType, setRoomType] = useState('all');
    const [checkInDate, setCheckInDate] = useState(getTodayStr());
    const [checkOutDate, setCheckOutDate] = useState(getTomorrowStr());
    const [guests, setGuests] = useState('2');
    const [roomCategories, setRoomCategories] = useState([]);
    const [latestPosts, setLatestPosts] = useState([]);
    const [isLoadingNews, setIsLoadingNews] = useState(true);

    const { settings } = useHotelSettings();
    const bannerHome1 = resolveBannerUrl(settings?.banner_home, DEFAULT_BANNERS.banner_home);
    const bannerHome2 = resolveBannerUrl(settings?.banner_home_2, DEFAULT_BANNERS.banner_home_2);
    const bannerHome3 = resolveBannerUrl(settings?.banner_home_3, DEFAULT_BANNERS.banner_home_3);
    const hotelName = settings?.hotel_name || "Khách Sạn TA Đà Nẵng";

    // Danh sách ảnh banner chạy luân phiên (Slider 3 ảnh)
    const bannerImages = [
        {
            url: bannerHome1,
            title: "Kỳ Nghỉ Thượng Lưu",
            subtitle: `Tại ${hotelName}`,
            desc: "Nghỉ dưỡng đẳng cấp bên bờ biển Mỹ Khê với dịch vụ chu đáo và không gian thư thái tuyệt đối."
        },
        {
            url: bannerHome2,
            title: "Thiên Đường Nghỉ Dưỡng",
            subtitle: "Hồ Bơi Vô Cực Hướng Biển",
            desc: "Thưởng ngoạn hoàng hôn biển lãng mạn cùng ly cocktail tinh tế bên hồ bơi chân mây."
        },
        {
            url: bannerHome3,
            title: "Phòng Suite Hạng Sang",
            subtitle: `Đặc Quyền Dịch Vụ ${settings?.stars || 3} Sao`,
            desc: "Nội thất cao cấp, ban công ngắm trọn đại dương và trải nghiệm ẩm thực thượng hạng."
        }
    ];
    const [currentBanner, setCurrentBanner] = useState(0);

    // Touch gesture tracking cho Hero Banner trên thiết bị di động
    const bannerTouchStartX = useRef(0);
    const bannerTouchStartY = useRef(0);
    const bannerTouchEndX = useRef(0);
    const bannerTouchEndY = useRef(0);
    const isBannerSwiping = useRef(false);

    const handleBannerTouchStart = (e) => {
        if (!e.touches || e.touches.length === 0) return;
        isBannerSwiping.current = false;
        bannerTouchStartX.current = e.touches[0].clientX;
        bannerTouchStartY.current = e.touches[0].clientY;
        bannerTouchEndX.current = e.touches[0].clientX;
        bannerTouchEndY.current = e.touches[0].clientY;
    };

    const handleBannerTouchMove = (e) => {
        if (!e.touches || e.touches.length === 0) return;
        bannerTouchEndX.current = e.touches[0].clientX;
        bannerTouchEndY.current = e.touches[0].clientY;
        if (Math.abs(bannerTouchEndX.current - bannerTouchStartX.current) > 10) {
            isBannerSwiping.current = true;
        }
    };

    const handleBannerTouchEnd = () => {
        const diffX = bannerTouchStartX.current - bannerTouchEndX.current;
        const diffY = bannerTouchStartY.current - bannerTouchEndY.current;
        // Kiểm tra vuốt ngang: khoảng cách > 35px và phương ngang rõ rệt hơn phương dọc
        if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0) {
                // Vuốt sang trái -> Xem banner tiếp theo
                setCurrentBanner((prev) => (prev + 1) % bannerImages.length);
            } else {
                // Vuốt sang phải -> Xem banner trước đó
                setCurrentBanner((prev) => (prev - 1 + bannerImages.length) % bannerImages.length);
            }
        }
        setTimeout(() => {
            isBannerSwiping.current = false;
        }, 150);
    };

    // Tự động chuyển ảnh banner sau mỗi 6 giây
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentBanner((prev) => (prev + 1) % bannerImages.length);
        }, 6000);
        return () => clearInterval(timer);
    }, [bannerImages.length]);

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

        // Nếu khách chọn 5+ Khách (Đoàn du lịch) -> chuyển thẳng sang Cổng Đặt Phòng Đoàn kèm ngày đã chọn
        if (Number(guests) >= 5) {
            navigate(`/corporate-booking?${params.toString()}`, {
                state: {
                    checkInDate,
                    checkOutDate,
                    guestCount: Number(guests) || 6,
                    roomType
                }
            });
            return;
        }

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

        const fetchCategories = async () => {
            try {
                const res = await roomService.getCategories();
                const list = res?.categories || res?.results || (Array.isArray(res) ? res : []);
                if (list.length > 0) {
                    setRoomCategories(list);
                }
            } catch (err) {
                console.error('Lỗi khi tải hạng phòng trang chủ:', err);
            }
        };

        fetchNews();
        fetchCategories();
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-amber-600 selection:text-white w-full max-w-full">
            <Navbar />


            {/* 3. HERO SECTION CHUẨN LUXURY HOTEL - SLIDER CHẠY QUA LẠI */}
            <section 
                onTouchStart={handleBannerTouchStart}
                onTouchMove={handleBannerTouchMove}
                onTouchEnd={handleBannerTouchEnd}
                className="relative w-full min-h-[440px] lg:h-[470px] xl:h-[520px] flex items-center justify-center bg-slate-950 overflow-hidden group touch-pan-y select-none"
            >
                {/* Danh sách ảnh nền chạy luân phiên với hiệu ứng cross-fade mềm mại */}
                {bannerImages.map((b, idx) => (
                    <div
                        key={idx}
                        className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                            currentBanner === idx ? 'opacity-100 z-0' : 'opacity-0 -z-10'
                        }`}
                    >
                        <img
                            src={b.url}
                            alt={b.title}
                            loading={idx === 0 ? "eager" : "lazy"}
                            decoding="async"
                            className={`w-full h-full object-cover object-center transition-transform duration-7000 ease-out ${
                                currentBanner === idx ? 'scale-105' : 'scale-100'
                            }`}
                        />
                    </div>
                ))}

                {/* Lớp phủ 2 tầng cân bằng: giữ trọn vẻ lung linh hoàng hôn & hồ bơi nhưng tăng độ sắc nét cho chữ */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/45 via-slate-900/25 to-slate-950/75 z-1" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.38)_0%,transparent_70%)] z-1 pointer-events-none" />

                {/* Hero Content nổi bật trên cùng (relative z-10) */}
                <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-14 text-center text-white pt-8 pb-16 sm:pb-20">
                    <h1 className="font-serif text-2xl xs:text-3xl sm:text-4xl lg:text-[52px] font-bold tracking-tight text-white leading-[1.2] mb-4 drop-shadow-[0_4px_16px_rgba(0,0,0,0.45)] transition-all duration-700">
                        {bannerImages[currentBanner].title} <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]">
                            {bannerImages[currentBanner].subtitle}
                        </span>
                    </h1>

                    <p className="text-sm sm:text-base text-white/95 max-w-xl mx-auto mb-6 font-normal leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-all duration-700">
                        {bannerImages[currentBanner].desc}
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:gap-x-7 text-xs sm:text-[13px] font-medium text-white/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]">
                        <span className="inline-flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-amber-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Giá trực tiếp tốt nhất</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-amber-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Linh hoạt đổi hủy 24h</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-amber-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Đưa đón sân bay VIP</span>
                        </span>
                    </div>

                    {/* Dấu chấm chuyển slide (Dots Indicators) */}
                    <div className="flex items-center justify-center gap-1 mt-4">
                        {bannerImages.map((_, dotIdx) => (
                            <button
                                key={dotIdx}
                                type="button"
                                onClick={() => setCurrentBanner(dotIdx)}
                                onTouchStart={(e) => e.stopPropagation()}
                                className="p-2 flex items-center justify-center cursor-pointer"
                                aria-label={`Xem banner ${dotIdx + 1}`}
                            >
                                <span
                                    className={`block transition-all duration-300 rounded-full ${
                                        currentBanner === dotIdx
                                            ? 'w-7 h-2 bg-amber-300 shadow-sm'
                                            : 'w-2 h-2 bg-white/55 hover:bg-white/85'
                                    }`}
                                />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Nút Previous & Next chuyển banner (ẩn trên mobile < sm để không đè chữ, mobile vuốt ngang & bấm chấm) */}
                <button
                    type="button"
                    onClick={() => setCurrentBanner((prev) => (prev - 1 + bannerImages.length) % bannerImages.length)}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/35 hover:bg-black/60 text-white items-center justify-center backdrop-blur-xs transition sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer shadow-md active:scale-90"
                    aria-label="Banner trước"
                >
                    <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <button
                    type="button"
                    onClick={() => setCurrentBanner((prev) => (prev + 1) % bannerImages.length)}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/35 hover:bg-black/60 text-white items-center justify-center backdrop-blur-xs transition sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer shadow-md active:scale-90"
                    aria-label="Banner kế tiếp"
                >
                    <ChevronRight className="w-5 h-5 text-white" />
                </button>
            </section>

            {/* 4. FLOATING BOOKING SEARCH BAR WIDGET (Thanh tìm kiếm nguyên khối cao cấp) */}
            <div className="relative z-20 w-full max-w-6xl mx-auto px-3 sm:px-4 -mt-10 sm:-mt-14">
                <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-[0_20px_50px_-12px_rgba(15,23,42,0.16)] border border-slate-200/75 ring-1 ring-slate-900/5 overflow-hidden transition-all duration-300">
                    {/* Form Fields: 4 Input fields ngăn cách bằng đường kẻ mảnh + Nút Tìm phòng */}
                    <form onSubmit={handleSearchRooms} className="p-2.5 sm:p-3.5 flex flex-col lg:flex-row items-stretch lg:items-center gap-2 lg:gap-0">
                        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-2 lg:gap-0 lg:divide-x lg:divide-slate-200/80">
                            {/* Field 1: Hạng phòng */}
                            <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50/70 lg:bg-transparent hover:bg-sky-50/40 border border-slate-200/70 lg:border-0 rounded-xl lg:rounded-2xl transition-colors group">
                                <label className="text-[9.5px] sm:text-[10px] font-bold text-slate-400 group-hover:text-sky-700 uppercase tracking-wider mb-0.5 flex items-center gap-1.5 transition-colors">
                                    <BedDouble className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>Hạng phòng</span>
                                </label>
                                <select
                                    value={roomType}
                                    onChange={(e) => setRoomType(e.target.value)}
                                    className="w-full bg-transparent text-base sm:text-sm font-bold text-slate-900 focus:outline-none cursor-pointer truncate leading-snug"
                                >
                                    <option value="all">Tất cả hạng phòng</option>
                                    {roomCategories.length > 0 ? (
                                        roomCategories.map((cat) => (
                                            <option key={cat.id} value={String(cat.id)}>
                                                {cat.name}
                                            </option>
                                        ))
                                    ) : (
                                        <>
                                            <option value="deluxe">Hạng Deluxe Biển</option>
                                            <option value="suite">Executive & Grand Suite</option>
                                            <option value="penthouse">Presidential & Penthouse</option>
                                        </>
                                    )}
                                </select>
                                <div className="hidden sm:block text-[10.5px] text-amber-700/90 font-medium truncate mt-0.5">
                                    {(() => {
                                        if (roomType === 'all') return 'Tất cả các loại phòng';
                                        const matchedCat = roomCategories.find((cat) => String(cat.id) === String(roomType));
                                        if (matchedCat) {
                                            return `${matchedCat.capacity || 2} khách • ${matchedCat.view_type || matchedCat.bed_type || 'Không gian cao cấp'}`;
                                        }
                                        if (roomType === 'deluxe') return 'Hướng biển panorama';
                                        if (roomType === 'suite') return 'Phòng khách & Ban công';
                                        if (roomType === 'penthouse') return 'Hồ bơi vô cực trên cao';
                                        return 'Hạng phòng đã chọn';
                                    })()}
                                </div>
                            </div>

                            {/* Field 2 & 3: Check-in & Check-out */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:col-span-2 gap-2 lg:gap-0 lg:divide-x lg:divide-slate-200/80">
                                {/* Field 2: Check-in */}
                                <div
                                    onClick={() => {
                                        try {
                                            checkInRef.current?.showPicker();
                                        } catch {
                                            checkInRef.current?.focus();
                                        }
                                    }}
                                    className="px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50/70 lg:bg-transparent hover:bg-sky-50/40 border border-slate-200/70 lg:border-0 rounded-xl lg:rounded-2xl transition-colors group cursor-pointer min-w-0"
                                >
                                    <label className="text-[9.5px] sm:text-[10px] font-bold text-slate-400 group-hover:text-sky-700 uppercase tracking-wider mb-0.5 flex items-center gap-1.5 transition-colors cursor-pointer">
                                        <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        <span>Nhận phòng</span>
                                    </label>
                                    <input
                                        ref={checkInRef}
                                        type="date"
                                        min={getTodayStr()}
                                        value={checkInDate}
                                        onChange={handleCheckInChange}
                                        className="w-full bg-transparent text-base sm:text-sm font-bold text-slate-900 focus:outline-none cursor-pointer min-w-0 leading-snug tabular-nums"
                                    />
                                    <div className="text-[10px] sm:text-[10.5px] text-amber-800/90 font-semibold truncate mt-0.5">
                                        {getWeekdayName(checkInDate)} (từ {settings?.check_in_time || '14:00'})
                                    </div>
                                </div>

                                {/* Field 3: Check-out */}
                                <div
                                    onClick={() => {
                                        try {
                                            checkOutRef.current?.showPicker();
                                        } catch {
                                            checkOutRef.current?.focus();
                                        }
                                    }}
                                    className="px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50/70 lg:bg-transparent hover:bg-sky-50/40 border border-slate-200/70 lg:border-0 rounded-xl lg:rounded-2xl transition-colors group cursor-pointer min-w-0"
                                >
                                    <label className="text-[9.5px] sm:text-[10px] font-bold text-slate-400 group-hover:text-sky-700 uppercase tracking-wider mb-0.5 flex items-center gap-1.5 transition-colors cursor-pointer">
                                        <CalendarDays className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        <span>Trả phòng</span>
                                    </label>
                                    <input
                                        ref={checkOutRef}
                                        type="date"
                                        min={getTomorrowStr(checkInDate)}
                                        value={checkOutDate}
                                        onChange={handleCheckOutChange}
                                        className="w-full bg-transparent text-base sm:text-sm font-bold text-slate-900 focus:outline-none cursor-pointer min-w-0 leading-snug tabular-nums"
                                    />
                                    <div className="text-[10px] sm:text-[10.5px] text-emerald-700 font-semibold truncate mt-0.5">
                                        {getWeekdayName(checkOutDate)} ({calculateNights()} đêm)
                                    </div>
                                </div>
                            </div>

                            {/* Field 4: Guests & Rooms */}
                            <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-50/70 lg:bg-transparent hover:bg-sky-50/40 border border-slate-200/70 lg:border-0 rounded-xl lg:rounded-2xl transition-colors group">
                                <label className="text-[9.5px] sm:text-[10px] font-bold text-slate-400 group-hover:text-sky-700 uppercase tracking-wider mb-0.5 flex items-center gap-1.5 transition-colors">
                                    <Users className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>Khách & Phòng</span>
                                </label>
                                <select
                                    value={guests}
                                    onChange={(e) => setGuests(e.target.value)}
                                    className="w-full bg-transparent text-base sm:text-sm font-bold text-slate-900 focus:outline-none cursor-pointer truncate leading-snug"
                                >
                                    <option value="1">1 Khách (1 Người lớn)</option>
                                    <option value="2">2 Khách (2 Người lớn)</option>
                                    <option value="3">3 Khách (2 Lớn + 1 Trẻ)</option>
                                    <option value="4">4 Khách (Gia đình)</option>
                                    <option value="6">5+ Khách (Đoàn du lịch)</option>
                                </select>
                                <div className="hidden sm:block text-[10.5px] text-amber-800/90 font-medium truncate mt-0.5">
                                    {Number(guests) === 1 && '1 Giường King / Queen'}
                                    {Number(guests) === 2 && '1 Phòng Suite / Deluxe'}
                                    {(Number(guests) === 3 || Number(guests) === 4) && 'Hỗ trợ thêm nôi / giường phụ'}
                                    {Number(guests) >= 5 && 'Chuyển tới Cổng Đặt Phòng Đoàn'}
                                </div>
                            </div>
                        </div>

                        {/* Field 5: Action Button (Giữ nguyên tông Xanh dương biển) */}
                        <div className="flex items-center justify-center shrink-0 lg:pl-3">
                            <button
                                type="submit"
                                title={Number(guests) >= 5 ? 'Chuyển sang Cổng Đặt Phòng Đoàn & Doanh Nghiệp' : 'Tìm kiếm phòng trống phù hợp'}
                                className="w-full lg:w-auto px-6 lg:px-7 min-h-[44px] h-11 lg:h-[58px] bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl sm:rounded-2xl shadow-[0_8px_20px_-6px_rgba(2,132,199,0.45)] hover:shadow-[0_12px_24px_-6px_rgba(2,132,199,0.55)] ring-1 ring-inset ring-white/20 flex items-center justify-center gap-2 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 cursor-pointer"
                            >
                                {Number(guests) >= 5 ? (
                                    <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                                ) : (
                                    <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                                )}
                                <span className="whitespace-nowrap">
                                    {Number(guests) >= 5 ? 'Đặt phòng đoàn' : 'Tìm phòng'}
                                </span>
                            </button>
                        </div>
                    </form>

                    {/* Quick banner: Khách đoàn & Doanh nghiệp (Tích hợp liền khối thanh thoát) */}
                    <div className="px-3.5 sm:px-5 py-2.5 bg-gradient-to-r from-slate-50/90 via-amber-50/35 to-slate-50/90 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 text-slate-600 text-[11px] sm:text-xs leading-snug">
                            <span className="p-1 rounded-lg bg-amber-100/90 text-amber-800 flex items-center justify-center shrink-0">
                                <Building2 className="w-3.5 h-3.5" />
                            </span>
                            <span>Quý khách đặt phòng cho <strong className="text-slate-800">Công ty, Doanh nghiệp hoặc Đoàn đông người</strong>?</span>
                        </div>
                        <Link
                            to="/corporate-booking"
                            className="w-full sm:w-auto justify-center font-bold text-amber-800 hover:text-amber-950 bg-white/90 hover:bg-amber-50 border border-amber-200/90 min-h-[40px] sm:min-h-0 px-3.5 py-2 sm:py-1.5 rounded-full shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer text-[11px] sm:text-xs group"
                        >
                            <span>Cổng Đặt Phòng Đoàn &amp; Hợp Đồng B2B</span>
                            <ArrowRight className="w-3 h-3 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* 5. LIVE ROOM CATEGORIES SECTION (Connected to Django Backend PMS) */}
            <div id="phong-nghi">
                <FeaturedRoomCategories />
            </div>

            {/* 5B. RESORT EXPERIENCE BENTO GALLERY & KEY HIGHLIGHTS */}
            <ResortExperienceBento />

            {/* 6. HOTEL SERVICES & CUISINE MENU (Connected to PMS & Services API) */}
            <FeaturedServices />

            {/* 6B. FEATURED PROMOTIONS & VOUCHERS (Connected to Promotions API) */}
            <FeaturedPromotions />

            {/* 6C. VERIFIED GUEST REVIEWS & TESTIMONIALS (Connected to Reviews API) */}
            <GuestTestimonials />

            {/* 7. TIN TỨC & CẨM NANG NGHỈ DƯỠNG MỚI NHẤT */}
            <section id="tin-tuc" className="bg-white py-10 sm:py-18">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header Tiêu đề */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 sm:mb-11 gap-4 sm:gap-6">
                    <div>
                        <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-amber-700 mb-3">
                            TIN TỨC &amp; CẨM NANG
                        </span>
                        <h2 className="font-serif text-2xl sm:text-4xl font-bold text-slate-900 mb-2.5 tracking-tight">
                            Khám Phá Trải Nghiệm Mới Nhất
                        </h2>
                        <p className="text-slate-600 text-sm sm:text-base max-w-2xl leading-relaxed">
                            Cập nhật tin tức sự kiện, cẩm nang du lịch Đà Nẵng và những trải nghiệm ẩm thực thượng lưu độc quyền tại Khách sạn TA.
                        </p>
                    </div>

                    <Link
                        to="/news"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-sky-300 hover:bg-sky-50/60 text-slate-700 hover:text-sky-700 text-xs sm:text-sm font-bold transition-all shadow-xs whitespace-nowrap self-start md:self-auto group"
                    >
                        <span>Xem tất cả tin tức</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>

                {/* Danh sách bài viết */}
                {isLoadingNews ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
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
                    <div className="text-center py-16 bg-slate-50/70 rounded-3xl border border-slate-200/80 shadow-xs max-w-md mx-auto">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center mx-auto mb-3">
                            <Newspaper className="w-7 h-7" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-base mb-1">Đang cập nhật bài viết mới</h3>
                        <p className="text-xs text-slate-500 mb-5">Hệ thống đang chuẩn bị những cẩm nang nghỉ dưỡng tuyệt vời nhất cho bạn.</p>
                        <Link to="/news" className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white text-xs font-bold rounded-xl shadow-[0_8px_20px_-6px_rgba(2,132,199,0.45)] transition">
                            Khám phá chuyên trang Tin tức
                        </Link>
                    </div>
                ) : (
                    <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-7 overflow-x-auto sm:overflow-visible snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:pb-0 no-scrollbar">
                        {latestPosts.slice(0, 3).map((post) => (
                            <article
                                key={post.id}
                                className="w-[84vw] max-w-[330px] sm:w-auto sm:max-w-none shrink-0 snap-center bg-white rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.08)] hover:shadow-[0_18px_40px_-14px_rgba(15,23,42,0.14)] hover:border-sky-200/80 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                            >
                                <div>
                                    {/* Ảnh bìa */}
                                    <Link to={`/news/${post.slug || post.id}`} className="block relative h-52 overflow-hidden bg-slate-100">
                                        {post.thumbnail_url ? (
                                            <img
                                                src={post.thumbnail_url}
                                                alt={post.title}
                                                loading="lazy"
                                                decoding="async"
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-slate-100 to-slate-200 text-slate-400">
                                                <Building2 className="w-10 h-10 text-slate-300" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/30 via-transparent to-transparent pointer-events-none" />
                                        {/* Category Badge */}
                                        <span className="absolute top-3.5 left-3.5 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md border border-white/60 text-[11px] font-bold text-slate-800 shadow-sm">
                                            {post.category_display || post.category || 'Khám phá'}
                                        </span>
                                    </Link>

                                    {/* Nội dung tóm tắt */}
                                    <div className="p-4 sm:p-6 space-y-2.5">
                                        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3 text-slate-400" />
                                                {formatDate(post.created_at || post.published_at)}
                                            </span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <Eye className="w-3 h-3 text-slate-400" />
                                                {post.view_count || 0} lượt xem
                                            </span>
                                        </div>

                                        <Link to={`/news/${post.slug || post.id}`} className="block">
                                            <h3 className="font-serif font-bold text-lg text-slate-900 group-hover:text-sky-700 transition-colors line-clamp-2 leading-snug">
                                                {post.title}
                                            </h3>
                                        </Link>

                                        <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed">
                                            {post.summary || 'Khám phá chi tiết những thông tin hữu ích trong bài viết cùng khách sạn TA...'}
                                        </p>
                                    </div>
                                </div>

                                {/* Footer thẻ */}
                                <div className="px-4 sm:px-6 pb-4 sm:pb-5 pt-3.5 flex items-center justify-between gap-2 border-t border-slate-100 text-xs">
                                    <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 min-w-0 max-w-[160px]">
                                        <PenLine className="w-3 h-3 text-amber-600/80 shrink-0" />
                                        <span className="truncate">{post.author || 'Ban Biên Tập'}</span>
                                    </span>
                                    <Link
                                        to={`/news/${post.slug || post.id}`}
                                        className="font-bold text-sky-700 group-hover:text-sky-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                                    >
                                        <span>Chi tiết</span>
                                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
                </div>
            </section>

            <Footer />

        </div>
    );
}