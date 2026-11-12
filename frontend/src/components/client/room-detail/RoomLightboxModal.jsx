import React, { useEffect, useRef } from 'react';
import { Camera, X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function RoomLightboxModal({
    lightboxIndex,
    gallery = [],
    onClose,
    setLightboxIndex
}) {
    const isLightboxSwiping = useRef(false);
    const lightboxTouchStartX = useRef(0);
    const lightboxTouchStartY = useRef(0);
    const lightboxTouchEndX = useRef(0);
    const lightboxTouchEndY = useRef(0);

    // Điều khiển phím tắt ESC, Left, Right trong Lightbox modal
    useEffect(() => {
        if (lightboxIndex === null) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') {
                setLightboxIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
            }
            if (e.key === 'ArrowRight') {
                setLightboxIndex((prev) => (prev + 1) % gallery.length);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxIndex, gallery.length, onClose, setLightboxIndex]);

    if (lightboxIndex === null || !gallery[lightboxIndex]) return null;

    // Điều khiển cảm ứng vuốt trên điện thoại
    const handleTouchStart = (e) => {
        isLightboxSwiping.current = false;
        lightboxTouchStartX.current = e.touches[0].clientX;
        lightboxTouchStartY.current = e.touches[0].clientY;
        lightboxTouchEndX.current = e.touches[0].clientX;
        lightboxTouchEndY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
        lightboxTouchEndX.current = e.touches[0].clientX;
        lightboxTouchEndY.current = e.touches[0].clientY;
        if (Math.abs(lightboxTouchEndX.current - lightboxTouchStartX.current) > 10) {
            isLightboxSwiping.current = true;
        }
    };

    const handleTouchEnd = () => {
        const diffX = lightboxTouchStartX.current - lightboxTouchEndX.current;
        const diffY = lightboxTouchStartY.current - lightboxTouchEndY.current;
        if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0) {
                setLightboxIndex((prev) => (prev + 1) % gallery.length);
            } else {
                setLightboxIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
            }
        }
        setTimeout(() => {
            isLightboxSwiping.current = false;
        }, 150);
    };

    return (
        <div
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col justify-between p-3 sm:p-6 backdrop-blur-md select-none"
            onClick={onClose}
        >
            {/* Thanh tiêu đề trên cùng: Đếm số ảnh & nút đóng */}
            <div
                className="flex items-center justify-between text-white z-10 w-full max-w-5xl mx-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-bold text-sm sm:text-base flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-amber-400" /> Ảnh {lightboxIndex + 1} / {gallery.length}
                    </span>
                    <span className="text-slate-400 text-xs sm:text-sm hidden sm:inline">
                        • {gallery[lightboxIndex]?.title}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center transition active:scale-95 cursor-pointer"
                    aria-label="Đóng"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Vùng ảnh chính với vuốt cảm ứng và nút Mũi tên */}
            <div
                className="relative flex-1 flex items-center justify-center my-2 max-w-5xl mx-auto w-full overflow-hidden touch-pan-y"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <img
                    key={lightboxIndex}
                    src={gallery[lightboxIndex]?.url}
                    alt={gallery[lightboxIndex]?.title || 'Ảnh phóng to'}
                    className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl transition duration-300"
                />

                {gallery.length > 1 && (
                    <>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setLightboxIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
                            }}
                            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center backdrop-blur-md transition border border-white/20 active:scale-95 cursor-pointer"
                            aria-label="Ảnh trước"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setLightboxIndex((prev) => (prev + 1) % gallery.length);
                            }}
                            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center backdrop-blur-md transition border border-white/20 active:scale-95 cursor-pointer"
                            aria-label="Ảnh tiếp theo"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    </>
                )}
            </div>

            {/* Dải thumbnail xem nhanh bên dưới modal Lightbox */}
            {gallery.length > 1 && (
                <div
                    className="w-full max-w-5xl mx-auto z-10 flex items-center justify-center gap-2 overflow-x-auto py-2"
                    onClick={(e) => e.stopPropagation()}
                >
                    {gallery.map((img, idx) => (
                        <button
                            key={img.id || idx}
                            type="button"
                            onClick={() => setLightboxIndex(idx)}
                            className={`relative shrink-0 w-14 h-11 sm:w-16 sm:h-12 rounded-lg overflow-hidden border-2 transition cursor-pointer ${
                                lightboxIndex === idx
                                    ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105'
                                    : 'border-white/20 opacity-50 hover:opacity-100'
                            }`}
                        >
                            <img src={img.url} alt="" className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

