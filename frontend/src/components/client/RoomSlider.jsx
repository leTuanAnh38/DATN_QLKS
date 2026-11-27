import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useHotelSettings } from '../../store/hotelSettingStore';
import { useInViewOnce } from '../../hooks/useMotion';
import { Camera, Maximize2, Users, BedDouble, ChevronLeft, ChevronRight } from 'lucide-react';

const formatDateToInput = (date) => {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
};

/**
 * Component Carousel/Slider hiển thị danh sách phòng cho Trang chủ
 * Quản lý currentIndex bằng useState, hiển thị tối đa 3 thẻ trên 1 hàng (Desktop)
 * Có 2 nút bấm mũi tên (< và >) kèm hiệu ứng trượt transition mượt mà
 */
export default function RoomSlider({ rooms = [] }) {
    const { settings } = useHotelSettings();
    const starCount = settings?.stars || 3;
    const [currentIndex, setCurrentIndex] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(() => {
        if (typeof window === 'undefined') return 3;
        if (window.innerWidth < 640) return 1;
        if (window.innerWidth < 1024) return 2;
        return 3;
    });
    const [isHovered, setIsHovered] = useState(false);
    const [slideDirection, setSlideDirection] = useState('forward'); // 'forward' | 'backward'
    const [sliderRef, sliderVisible] = useInViewOnce({ threshold: 0.08 });

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = formatDateToInput(today);
    const tomorrowStr = formatDateToInput(tomorrow);

    // Tính toán số lượng thẻ hiển thị theo kích thước màn hình
    // Desktop: 3 cards, Tablet: 2 cards, Mobile: 1 card
    useEffect(() => {
        const updateItemsPerPage = () => {
            if (window.innerWidth < 640) {
                setItemsPerPage(1);
            } else if (window.innerWidth < 1024) {
                setItemsPerPage(2);
            } else {
                setItemsPerPage(3);
            }
        };

        updateItemsPerPage();
        window.addEventListener('resize', updateItemsPerPage);
        return () => window.removeEventListener('resize', updateItemsPerPage);
    }, []);

    // Chỉ số tối đa có thể trượt đến
    const maxIndex = Math.max(0, rooms.length - itemsPerPage);

    // Tự động chạy đi chạy lại (Auto-slide qua lại, dừng khi hover)
    useEffect(() => {
        if (maxIndex <= 0 || isHovered) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => {
                if (slideDirection === 'forward') {
                    if (prev >= maxIndex) {
                        setSlideDirection('backward');
                        return Math.max(0, prev - 1);
                    }
                    return prev + 1;
                } else {
                    if (prev <= 0) {
                        setSlideDirection('forward');
                        return Math.min(maxIndex, prev + 1);
                    }
                    return prev - 1;
                }
            });
        }, 4000);

        return () => clearInterval(interval);
    }, [maxIndex, isHovered, slideDirection]);

    // Điều chỉnh lại currentIndex nếu resize màn hình làm tràn giới hạn
    useEffect(() => {
        if (currentIndex > maxIndex) {
            setCurrentIndex(maxIndex);
        }
    }, [maxIndex]);

    // Xử lý trượt lùi (<)
    const handlePrev = () => {
        setSlideDirection('backward');
        setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
    };

    // Xử lý trượt tới (>)
    const handleNext = () => {
        setSlideDirection('forward');
        setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    };

    // Touch & Mouse gestures tracking cho thao tác vuốt lướt thẻ phòng trên điện thoại và máy tính
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const touchEndX = useRef(0);
    const touchEndY = useRef(0);
    const isSwiping = useRef(false);

    const handleTouchStart = (e) => {
        if (!e.touches || e.touches.length === 0) return;
        isSwiping.current = false;
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        touchEndX.current = e.touches[0].clientX;
        touchEndY.current = e.touches[0].clientY;
        setIsHovered(true); // Tạm dừng auto-slide khi người dùng chạm
    };

    const handleTouchMove = (e) => {
        if (!e.touches || e.touches.length === 0) return;
        touchEndX.current = e.touches[0].clientX;
        touchEndY.current = e.touches[0].clientY;
        if (Math.abs(touchEndX.current - touchStartX.current) > 10) {
            isSwiping.current = true;
        }
    };

    const handleTouchEnd = () => {
        const diffX = touchStartX.current - touchEndX.current;
        const diffY = touchStartY.current - touchEndY.current;
        // Kiểm tra vuốt ngang: khoảng cách > 35px và phương ngang rõ hơn dọc
        if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0) {
                // Vuốt sang trái -> Xem phòng tiếp theo
                handleNext();
            } else {
                // Vuốt sang phải -> Xem phòng trước đó
                handlePrev();
            }
        }
        setTimeout(() => {
            isSwiping.current = false;
            setIsHovered(false);
        }, 200);
    };

    const handleMouseDown = (e) => {
        if (e.button !== 0) return;
        isSwiping.current = false;
        touchStartX.current = e.clientX;
        touchStartY.current = e.clientY;
        touchEndX.current = e.clientX;
        touchEndY.current = e.clientY;
        setIsHovered(true);
    };

    const handleMouseMove = (e) => {
        if (e.buttons !== 1) return;
        touchEndX.current = e.clientX;
        touchEndY.current = e.clientY;
        if (Math.abs(touchEndX.current - touchStartX.current) > 10) {
            isSwiping.current = true;
        }
    };

    const handleMouseUp = () => {
        if (touchStartX.current === 0) return;
        const diffX = touchStartX.current - touchEndX.current;
        if (Math.abs(diffX) > 35) {
            if (diffX > 0) {
                handleNext();
            } else {
                handlePrev();
            }
        }
        touchStartX.current = 0;
        setTimeout(() => {
            isSwiping.current = false;
            setIsHovered(false);
        }, 200);
    };

    // Chặn click nhầm vào link hoặc nút đặt phòng khi người dùng đang thực hiện động tác vuốt
    const handleClickCapture = (e) => {
        if (isSwiping.current) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    if (!rooms || rooms.length === 0) {
        return null;
    }

    return (
        <div
            ref={sliderRef}
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Header thanh điều hướng: Nút mũi tên < và > */}
            <div className="flex items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-6">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                        <span className="sm:hidden">Vuốt xem ({currentIndex + 1}/{maxIndex + 1})</span>
                        <span className="hidden sm:inline">Trượt để xem thêm các hạng phòng ({currentIndex + 1}/{maxIndex + 1})</span>
                    </span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={handlePrev}
                        onTouchStart={(e) => e.stopPropagation()}
                        aria-label="Phòng trước đó"
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-sky-600 hover:text-white hover:border-sky-600 shadow-sm transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>

                    <button
                        type="button"
                        onClick={handleNext}
                        onTouchStart={(e) => e.stopPropagation()}
                        aria-label="Phòng tiếp theo"
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-sky-600 hover:text-white hover:border-sky-600 shadow-sm transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer"
                    >
                        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </div>
            </div>

            {/* Slider Viewport với hiệu ứng transition trượt mượt mà */}
            <div 
                className="overflow-hidden py-2 -mx-3 touch-pan-y select-none cursor-grab active:cursor-grabbing"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClickCapture={handleClickCapture}
            >
                <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{
                        transform: `translateX(-${currentIndex * (100 / itemsPerPage)}%)`,
                    }}
                >
                    {rooms.map((room, roomIdx) => {
                        const primaryImage =
                            room.feature_image ||
                            room.images?.find((img) => img.is_feature)?.image_url ||
                            room.images?.[0]?.image_url ||
                            room.images?.[0]?.image ||
                            'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';

                        const hasPromo =
                            room.promo_price &&
                            Number(room.promo_price) > 0 &&
                            Number(room.promo_price) < Number(room.base_price);

                        const discountPercent = hasPromo
                            ? Math.round(
                                  ((Number(room.base_price) - Number(room.promo_price)) /
                                      Number(room.base_price)) *
                                      100
                              )
                            : 0;

                        const formattedBasePrice = Number(room.base_price).toLocaleString('vi-VN');
                        const formattedPromoPrice = hasPromo
                            ? Number(room.promo_price).toLocaleString('vi-VN')
                            : null;

                        return (
                            <div
                                key={room.id}
                                className="w-full sm:w-1/2 lg:w-1/3 shrink-0 px-3"
                            >
                                <div
                                    className={`${
                                        roomIdx < 3
                                            ? (sliderVisible ? 'reveal-card-in' : 'reveal-card-hidden')
                                            : ''
                                    } bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.08)] hover:shadow-[0_18px_40px_-14px_rgba(15,23,42,0.16)] hover:border-sky-200/80 hover:-translate-y-1.5 transition-all duration-300 flex flex-col h-full group`}
                                    style={sliderVisible && roomIdx < 3 ? { animationDelay: `${roomIdx * 100}ms` } : undefined}
                                >
                                    {/* Ảnh đại diện chính thoáng mắt, không che ảnh bằng nhiều nhãn */}
                                    <div className="relative h-48 sm:h-64 w-full overflow-hidden bg-slate-900 shrink-0">
                                        <Link to={`/rooms/${room.id}`} className="block w-full h-full">
                                            <img
                                                src={primaryImage}
                                                alt={room.name}
                                                loading="lazy"
                                                decoding="async"
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out cursor-pointer"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src =
                                                        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';
                                                }}
                                            />
                                        </Link>

                                        {/* Overlay gradient tinh tế */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-black/15 pointer-events-none"></div>

                                        {/* Badge khuyến mãi góc trên trái (chỉ hiện khi có giảm giá) */}
                                        {hasPromo && (
                                            <div className="absolute top-3.5 left-3.5 pointer-events-none">
                                                <span className="px-2.5 py-1 rounded-full bg-rose-600/95 backdrop-blur-xs text-white text-[10px] font-black tracking-wider uppercase shadow-sm">
                                                    GIẢM {discountPercent}%
                                                </span>
                                            </div>
                                        )}

                                        {/* Bộ đếm ảnh góc trên phải */}
                                        <div className="absolute top-3.5 right-3.5 pointer-events-none">
                                            <span className="px-2.5 py-1 rounded-full bg-slate-950/55 backdrop-blur-md text-white text-[11px] font-medium flex items-center gap-1.5 border border-white/15">
                                                <Camera className="w-3.5 h-3.5 text-amber-300" />
                                                <span>{room.images?.length || 1} ảnh</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Thân thẻ thông tin */}
                                    <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between space-y-3 sm:space-y-4">
                                        <div>
                                            <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900 group-hover:text-sky-700 transition-colors line-clamp-1 min-h-[1.75rem]">
                                                <Link to={`/rooms/${room.id}`}>{room.name}</Link>
                                            </h3>

                                            {/* Dải thông số phòng (tự xuống dòng gọn trên mobile 375px) */}
                                            <div className="mt-2.5 flex flex-wrap sm:flex-nowrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-600 font-medium">
                                                <span className="inline-flex items-center gap-1 shrink-0">
                                                    <Maximize2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                    <span>{room.size} m²</span>
                                                </span>
                                                <span className="w-px h-3 bg-slate-200 shrink-0" />
                                                <span className="inline-flex items-center gap-1 shrink-0">
                                                    <Users className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                    <span>{room.capacity} người lớn</span>
                                                </span>
                                                {room.bed_type && (
                                                    <>
                                                        <span className="hidden sm:inline-block w-px h-3 bg-slate-200 shrink-0" />
                                                        <span
                                                            className="inline-flex items-center gap-1 min-w-0"
                                                            title={room.bed_type}
                                                        >
                                                            <BedDouble className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                            <span className="truncate">{room.bed_type}</span>
                                                        </span>
                                                    </>
                                                )}
                                            </div>

                                            <p className="mt-2 sm:mt-2.5 text-xs text-slate-500 line-clamp-2 leading-relaxed font-normal sm:min-h-[2.5rem]">
                                                {room.short_description ||
                                                    room.description?.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim() ||
                                                    `Không gian nghỉ dưỡng sang trọng view biển trọn vẹn, trang bị đầy đủ tiện nghi cao cấp ${starCount} sao.`}
                                            </p>
                                        </div>

                                        {/* Giá tiền và Nút "Đặt ngay" được ghim thẳng hàng ở đáy thẻ */}
                                        <div className="pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-auto">
                                            <div className="min-w-0 flex-1">
                                                {hasPromo ? (
                                                    <>
                                                        <span className="block text-[11px] line-through text-slate-400 tabular-nums">
                                                            {formattedBasePrice} VND
                                                        </span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-xl font-black text-rose-600 tracking-tight whitespace-nowrap tabular-nums">
                                                                {formattedPromoPrice}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">
                                                                VND / đêm
                                                            </span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div>
                                                        <span className="block text-[10px] text-slate-400 uppercase tracking-wide">
                                                            Giá phòng niêm yết
                                                        </span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-xl font-black text-slate-900 tracking-tight whitespace-nowrap tabular-nums">
                                                                {formattedBasePrice}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">
                                                                VND / đêm
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
                                                <Link
                                                    to={`/rooms/${room.id}`}
                                                    state={{ checkInDate: todayStr, checkOutDate: tomorrowStr, guestCount: 2 }}
                                                    onTouchStart={(e) => e.stopPropagation()}
                                                    className="px-3 py-2.5 min-h-[42px] sm:min-h-0 text-xs font-semibold text-slate-700 bg-slate-100/90 hover:bg-slate-200/90 rounded-xl transition whitespace-nowrap text-center flex items-center justify-center cursor-pointer active:scale-95"
                                                >
                                                    Xem chi tiết
                                                </Link>
                                                <Link
                                                    to={`/checkout/${room.id}`}
                                                    state={{ checkInDate: todayStr, checkOutDate: tomorrowStr, guestCount: 2 }}
                                                    onTouchStart={(e) => e.stopPropagation()}
                                                    className="btn-luxury-shine px-3.5 py-2.5 min-h-[42px] sm:min-h-0 text-xs font-bold text-white bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 rounded-xl shadow-[0_8px_20px_-6px_rgba(2,132,199,0.45)] hover:shadow-[0_12px_24px_-6px_rgba(2,132,199,0.55)] ring-1 ring-inset ring-white/20 transition-all transform active:scale-95 whitespace-nowrap text-center flex items-center justify-center hover:-translate-y-0.5"
                                                >
                                                    Đặt ngay
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Pagination Dots (tăng vùng chạm mobile p-2) */}
            {maxIndex > 0 && (
                <div className="flex items-center justify-center gap-0.5 mt-5">
                    {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => setCurrentIndex(idx)}
                            onTouchStart={(e) => e.stopPropagation()}
                            aria-label={`Trang ${idx + 1}`}
                            className="p-2 flex items-center justify-center cursor-pointer"
                        >
                            <span
                                className={`block h-2 rounded-full transition-all duration-300 ${
                                    currentIndex === idx
                                        ? 'w-7 bg-gradient-to-r from-sky-600 to-blue-700 shadow-xs'
                                        : 'w-2 bg-slate-300 hover:bg-slate-400'
                                }`}
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
