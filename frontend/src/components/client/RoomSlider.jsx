import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useHotelSettings } from '../../store/hotelSettingStore';
import { Camera, Maximize2, Users, BedDouble, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Component Carousel/Slider hiển thị danh sách phòng cho Trang chủ
 * Quản lý currentIndex bằng useState, hiển thị tối đa 3 thẻ trên 1 hàng (Desktop)
 * Có 2 nút bấm mũi tên (< và >) kèm hiệu ứng trượt transition mượt mà
 */
export default function RoomSlider({ rooms = [] }) {
    const { settings } = useHotelSettings();
    const starCount = settings?.stars || 3;
    const [currentIndex, setCurrentIndex] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(3);
    const [isHovered, setIsHovered] = useState(false);
    const [slideDirection, setSlideDirection] = useState('forward'); // 'forward' | 'backward'

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

    if (!rooms || rooms.length === 0) {
        return null;
    }

    return (
        <div 
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Header thanh điều hướng: Nút mũi tên < và > */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Trượt để xem thêm các hạng phòng ({currentIndex + 1}/{maxIndex + 1})
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handlePrev}
                        aria-label="Phòng trước đó"
                        className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-gradient-to-r hover:from-amber-500 hover:to-orange-500 hover:text-white hover:border-amber-500 shadow-sm transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    <button
                        type="button"
                        onClick={handleNext}
                        aria-label="Phòng tiếp theo"
                        className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-gradient-to-r hover:from-amber-500 hover:to-orange-500 hover:text-white hover:border-amber-500 shadow-sm transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Slider Viewport với hiệu ứng transition trượt mượt mà */}
            <div className="overflow-hidden py-2 -mx-3">
                <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{
                        transform: `translateX(-${currentIndex * (100 / itemsPerPage)}%)`,
                    }}
                >
                    {rooms.map((room) => {
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
                                <div className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full group">
                                    {/* Ảnh đại diện chính to ở trên */}
                                    <div className="relative h-60 sm:h-64 w-full overflow-hidden bg-slate-900 shrink-0">
                                        <Link to={`/rooms/${room.id}`} className="block w-full h-full">
                                            <img
                                                src={primaryImage}
                                                alt={room.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out cursor-pointer"
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.src =
                                                        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';
                                                }}
                                            />
                                        </Link>

                                        {/* Overlay gradient */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/20 pointer-events-none"></div>

                                        {/* Badges góc trên */}
                                        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 pointer-events-none">
                                            {hasPromo && (
                                                <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[10px] font-black tracking-wider uppercase shadow-sm">
                                                    GIẢM {discountPercent}%
                                                </span>
                                            )}
                                            <span className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold border border-white/20">
                                                {starCount}-STAR RESORT
                                            </span>
                                        </div>

                                        <div className="absolute top-3 right-3 pointer-events-none">
                                            <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-medium flex items-center gap-1.5 border border-white/20">
                                                <Camera className="w-3.5 h-3.5 text-amber-300" />
                                                <span>{room.images?.length || 1} ảnh</span>
                                            </span>
                                        </div>

                                        {/* Thông số nhanh chân ảnh */}
                                        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white text-xs pointer-events-none">
                                            <span className="flex items-center gap-1 drop-shadow-xs">
                                                <Maximize2 className="w-3 h-3 text-amber-300" />
                                                <span>{room.size} m²</span>
                                            </span>
                                            <span className="flex items-center gap-1 drop-shadow-xs">
                                                <Users className="w-3 h-3 text-amber-300" />
                                                <span>{room.capacity} người lớn</span>
                                            </span>
                                            <span className="flex items-center gap-1 truncate max-w-[120px] drop-shadow-xs">
                                                <BedDouble className="w-3 h-3 text-amber-300 shrink-0" />
                                                <span className="truncate">{room.bed_type}</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Thân thẻ thông tin */}
                                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                                        <div>
                                            <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900 group-hover:text-amber-600 transition-colors line-clamp-1">
                                                <Link to={`/rooms/${room.id}`}>{room.name}</Link>
                                            </h3>

                                            <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed font-normal">
                                                {room.short_description ||
                                                    room.description?.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim() ||
                                                    `Không gian nghỉ dưỡng sang trọng view biển trọn vẹn, trang bị đầy đủ tiện nghi cao cấp ${starCount} sao.`}
                                            </p>
                                        </div>

                                        {/* Giá tiền và Nút "Đặt ngay" */}
                                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                {hasPromo ? (
                                                    <>
                                                        <span className="block text-[11px] line-through text-slate-400">
                                                            {formattedBasePrice} VND
                                                        </span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-lg sm:text-xl font-black text-rose-600 tracking-tight whitespace-nowrap">
                                                                {formattedPromoPrice}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">
                                                                VND / đêm
                                                            </span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div>
                                                        <span className="block text-[10px] text-slate-400 uppercase">
                                                            Giá phòng niêm yết
                                                        </span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight whitespace-nowrap">
                                                                {formattedBasePrice}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">
                                                                VND / đêm
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <Link
                                                    to={`/rooms/${room.id}`}
                                                    className="px-2.5 sm:px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition whitespace-nowrap shrink-0"
                                                >
                                                    Xem chi tiết
                                                </Link>
                                                <Link
                                                    to={`/checkout/${room.id}`}
                                                    className="px-3 sm:px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 rounded-xl shadow-md shadow-orange-500/25 transition-all transform active:scale-95 whitespace-nowrap shrink-0 hover:scale-[1.02]"
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

            {/* Pagination Dots */}
            {maxIndex > 0 && (
                <div className="flex items-center justify-center gap-1.5 mt-6">
                    {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => setCurrentIndex(idx)}
                            aria-label={`Trang ${idx + 1}`}
                            className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                                currentIndex === idx
                                    ? 'w-8 bg-gradient-to-r from-amber-500 to-orange-500 shadow-xs'
                                    : 'w-2 bg-slate-300 hover:bg-slate-400'
                            }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
