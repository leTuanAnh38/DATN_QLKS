import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * Component Carousel/Slider hiển thị danh sách phòng cho Trang chủ
 * Quản lý currentIndex bằng useState, hiển thị tối đa 3 thẻ trên 1 hàng (Desktop)
 * Có 2 nút bấm mũi tên (< và >) kèm hiệu ứng trượt transition mượt mà
 */
export default function RoomSlider({ rooms = [] }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(3);

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

    // Điều chỉnh lại currentIndex nếu resize màn hình làm tràn giới hạn
    useEffect(() => {
        if (currentIndex > maxIndex) {
            setCurrentIndex(maxIndex);
        }
    }, [maxIndex]);

    // Xử lý trượt lùi (<)
    const handlePrev = () => {
        setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
    };

    // Xử lý trượt tới (>)
    const handleNext = () => {
        setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    };

    if (!rooms || rooms.length === 0) {
        return null;
    }

    return (
        <div className="relative">
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
                        className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm transition-all duration-200 transform hover:scale-105 active:scale-95"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>

                    <button
                        type="button"
                        onClick={handleNext}
                        aria-label="Phòng tiếp theo"
                        className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm transition-all duration-200 transform hover:scale-105 active:scale-95"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                        </svg>
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

                        return (
                            <div
                                key={room.id}
                                className="w-full sm:w-1/2 lg:w-1/3 shrink-0 px-3"
                            >
                                <div className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full group">
                                    {/* Ảnh đại diện chính to ở trên */}
                                    <div className="relative h-60 sm:h-64 w-full overflow-hidden bg-slate-900 shrink-0">
                                        <img
                                            src={primaryImage}
                                            alt={room.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src =
                                                    'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';
                                            }}
                                        />

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
                                                5-STAR
                                            </span>
                                        </div>

                                        <div className="absolute top-3 right-3 pointer-events-none">
                                            <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-medium flex items-center gap-1 border border-white/20">
                                                📷 {room.images?.length || 1} ảnh
                                            </span>
                                        </div>

                                        {/* Thông số nhanh chân ảnh */}
                                        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white text-xs pointer-events-none">
                                            <span>📐 {room.size} m²</span>
                                            <span>👥 {room.capacity} người lớn</span>
                                            <span className="truncate max-w-[120px]">🛏️ {room.bed_type}</span>
                                        </div>
                                    </div>

                                    {/* Thân thẻ thông tin */}
                                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                                        <div>
                                            <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                                                <Link to={`/rooms/${room.id}`}>{room.name}</Link>
                                            </h3>

                                            <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed font-normal">
                                                {room.description ||
                                                    'Không gian nghỉ dưỡng sang trọng view biển trọn vẹn, trang bị đầy đủ tiện nghi cao cấp 5 sao.'}
                                            </p>
                                        </div>

                                        {/* Giá tiền và Nút "Đặt phòng ngay" */}
                                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                            <div>
                                                {hasPromo ? (
                                                    <>
                                                        <span className="block text-[11px] line-through text-slate-400">
                                                            {Number(room.base_price).toLocaleString('vi-VN')} đ
                                                        </span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-lg sm:text-xl font-black text-rose-600">
                                                                {Number(room.promo_price).toLocaleString('vi-VN')}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                                                                đ/đêm
                                                            </span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div>
                                                        <span className="block text-[10px] text-slate-400 uppercase">
                                                            Giá phòng
                                                        </span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-lg sm:text-xl font-black text-slate-900">
                                                                {Number(room.base_price).toLocaleString('vi-VN')}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                                                                đ/đêm
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <Link
                                                    to={`/rooms/${room.id}`}
                                                    className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                                                >
                                                    Chi tiết
                                                </Link>
                                                <Link
                                                    to={`/rooms/${room.id}`}
                                                    className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/30 transition transform active:scale-95 whitespace-nowrap"
                                                >
                                                    Đặt phòng ngay
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
                            className={`h-2 rounded-full transition-all duration-300 ${
                                currentIndex === idx
                                    ? 'w-8 bg-blue-600'
                                    : 'w-2 bg-slate-300 hover:bg-slate-400'
                            }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
