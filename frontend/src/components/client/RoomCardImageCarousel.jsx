import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Khung ảnh phòng có hỗ trợ vuốt tay (Mobile touch), kéo chuột (Desktop drag),
 * nút mũi tên trái/phải và chấm chuyển ảnh nhanh mượt mà.
 */
export default function RoomCardImageCarousel({
    images = [],
    fallbackImg,
    alt = 'Hình ảnh phòng nghỉ',
    to,
    linkState,
    hasPromo = false,
    discountPercent = 0,
    starCount = 3
}) {
    const safeImages = images.length > 0 ? images : [fallbackImg];
    const total = safeImages.length;
    const canSlide = total > 1;

    const [index, setIndex] = useState(0);
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const containerRef = useRef(null);
    const startXRef = useRef(0);
    const startYRef = useRef(0);
    const axisRef = useRef(null); // null | 'x' | 'y'
    const didSwipeRef = useRef(false);
    const currentOffsetRef = useRef(0);

    // Đảm bảo index không vượt quá số ảnh khi danh sách ảnh thay đổi
    useEffect(() => {
        if (index >= total) setIndex(0);
    }, [index, total]);

    const applyEdgeResistance = (dx, curIdx) => {
        if ((curIdx === 0 && dx > 0) || (curIdx === total - 1 && dx < 0)) {
            return dx * 0.28;
        }
        return dx;
    };

    const finishDrag = (dx, curIdx) => {
        const width = containerRef.current?.offsetWidth || 320;
        const threshold = Math.min(55, Math.max(32, width * 0.14));

        if (dx <= -threshold && curIdx < total - 1) {
            setIndex(curIdx + 1);
        } else if (dx >= threshold && curIdx > 0) {
            setIndex(curIdx - 1);
        }

        currentOffsetRef.current = 0;
        setDragOffset(0);
        setIsDragging(false);
        axisRef.current = null;
    };

    // --- TOUCH EVENTS (Điện thoại / Máy tính bảng) ---
    const handleTouchStart = (e) => {
        if (!canSlide || e.touches.length !== 1) return;
        startXRef.current = e.touches[0].clientX;
        startYRef.current = e.touches[0].clientY;
        axisRef.current = null;
        didSwipeRef.current = false;
        currentOffsetRef.current = 0;
    };

    const handleTouchMove = (e) => {
        if (!canSlide || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - startXRef.current;
        const dy = e.touches[0].clientY - startYRef.current;

        if (!axisRef.current) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        }

        if (axisRef.current === 'y') return;

        didSwipeRef.current = true;
        setIsDragging(true);
        const resisted = applyEdgeResistance(dx, index);
        currentOffsetRef.current = resisted;
        setDragOffset(resisted);
    };

    const handleTouchEnd = () => {
        if (axisRef.current === 'x') {
            finishDrag(currentOffsetRef.current, index);
        } else {
            axisRef.current = null;
        }
    };

    // --- MOUSE DRAG EVENTS (Kéo ngang bằng chuột trên Desktop) ---
    const handleMouseDown = (e) => {
        if (!canSlide || e.button !== 0) return;
        if (e.target.closest('button')) return;

        startXRef.current = e.clientX;
        startYRef.current = e.clientY;
        didSwipeRef.current = false;
        currentOffsetRef.current = 0;

        const curIdx = index;

        const handleMouseMove = (moveEvt) => {
            const dx = moveEvt.clientX - startXRef.current;
            if (!didSwipeRef.current && Math.abs(dx) < 8) return;

            didSwipeRef.current = true;
            setIsDragging(true);
            const resisted = applyEdgeResistance(dx, curIdx);
            currentOffsetRef.current = resisted;
            setDragOffset(resisted);
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            if (didSwipeRef.current) {
                finishDrag(currentOffsetRef.current, curIdx);
                // Reset cờ sau khi sự kiện click cùng chu kỳ chạy xong
                setTimeout(() => {
                    didSwipeRef.current = false;
                }, 80);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleLinkClick = (e) => {
        if (didSwipeRef.current) {
            e.preventDefault();
            didSwipeRef.current = false;
        }
    };

    const handlePrev = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIndex((prev) => (prev - 1 + total) % total);
    };

    const handleNext = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIndex((prev) => (prev + 1) % total);
    };

    return (
        <div
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onMouseDown={handleMouseDown}
            className={`group/gallery relative w-full lg:w-[40%] xl:w-[39%] h-60 sm:h-72 lg:h-auto lg:min-h-[290px] overflow-hidden bg-slate-900 shrink-0 select-none touch-pan-y ${
                canSlide ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
            }`}
        >
            {/* Dải ảnh trượt ngang mượt mà */}
            <Link
                to={to}
                state={linkState}
                onClick={handleLinkClick}
                draggable={false}
                className="block w-full h-full"
            >
                <div
                    className={`flex w-full h-full ${
                        isDragging ? 'transition-none' : 'transition-transform duration-300 ease-out'
                    }`}
                    style={{
                        transform: `translate3d(calc(-${index * 100}% + ${dragOffset}px), 0, 0)`
                    }}
                >
                    {safeImages.map((imgUrl, idx) => (
                        <div key={`${imgUrl}-${idx}`} className="w-full h-full shrink-0 overflow-hidden">
                            <img
                                src={imgUrl}
                                alt={`${alt} - Ảnh ${idx + 1}`}
                                draggable={false}
                                loading={idx === 0 ? 'eager' : 'lazy'}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out pointer-events-none"
                                onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = fallbackImg;
                                }}
                            />
                        </div>
                    ))}
                </div>
            </Link>

            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-black/15 pointer-events-none" />

            {/* Badges góc trên trái */}
            <div className="absolute top-4 left-4 flex flex-col items-start gap-1.5 pointer-events-none z-10">
                {hasPromo ? (
                    <>
                        <span className="px-3 py-1 rounded-full bg-rose-600/95 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                            ƯU ĐÃI ĐẶC BIỆT
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-xs text-slate-800 text-[10.5px] font-bold shadow-xs">
                            Tiết kiệm {discountPercent}%
                        </span>
                    </>
                ) : (
                    <span className="px-3 py-1 rounded-full bg-slate-950/65 backdrop-blur-md text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-white/15">
                        {starCount}-STAR LUXURY
                    </span>
                )}
            </div>

            {/* Bộ đếm ảnh góc trên phải (hiện rõ ảnh đang xem / tổng ảnh) */}
            <div className="absolute top-4 right-4 pointer-events-none z-10">
                <span className="px-2.5 py-1 rounded-full bg-slate-950/60 backdrop-blur-md text-white text-[11px] font-semibold flex items-center gap-1.5 border border-white/15 tabular-nums">
                    <Camera className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span>{canSlide ? `${index + 1}/${total} ảnh` : '1 ảnh'}</span>
                </span>
            </div>

            {/* Nút mũi tên Trái / Phải */}
            {canSlide && (
                <>
                    <button
                        type="button"
                        onClick={handlePrev}
                        aria-label="Ảnh trước"
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-slate-950/55 hover:bg-slate-950/80 text-white border border-white/20 backdrop-blur-xs flex items-center justify-center shadow-md transition-all duration-200 opacity-85 sm:opacity-0 sm:group-hover/gallery:opacity-100 cursor-pointer active:scale-95"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={handleNext}
                        aria-label="Ảnh tiếp theo"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-slate-950/55 hover:bg-slate-950/80 text-white border border-white/20 backdrop-blur-xs flex items-center justify-center shadow-md transition-all duration-200 opacity-85 sm:opacity-0 sm:group-hover/gallery:opacity-100 cursor-pointer active:scale-95"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </>
            )}

            {/* Chấm chuyển ảnh nhanh ngay dưới đáy ảnh */}
            {canSlide && (
                <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 px-2.5 py-1.5 rounded-full bg-slate-950/45 backdrop-blur-xs max-w-[85%]">
                    {safeImages.slice(0, 7).map((_, imgIdx) => (
                        <button
                            key={imgIdx}
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIndex(imgIdx);
                            }}
                            aria-label={`Xem ảnh ${imgIdx + 1}`}
                            className={`rounded-full transition-all cursor-pointer ${
                                index === imgIdx
                                    ? 'w-5 h-1.5 bg-white'
                                    : 'w-1.5 h-1.5 bg-white/55 hover:bg-white/85'
                            }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
