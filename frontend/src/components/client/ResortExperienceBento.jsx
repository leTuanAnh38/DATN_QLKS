import React from 'react';
import { Link } from 'react-router-dom';
import {
    Waves,
    Flower2,
    UtensilsCrossed,
    Car,
    MapPin,
    Star,
    Clock,
    ArrowRight,
    Sparkles
} from 'lucide-react';
import { useHotelSettings, DEFAULT_BANNERS } from '../../store/hotelSettingStore';
import { resolveMediaUrl } from '../../utils/mediaUrl';

export default function ResortExperienceBento() {
    const { settings } = useHotelSettings();
    const starCount = settings?.stars || 3;
    const hotelName = settings?.hotel_name || 'Khách Sạn TA Đà Nẵng';

    // Ảnh đồng bộ trực tiếp từ Cài Đặt Hệ Thống (Admin có thể upload hoặc dán URL tùy ý)
    const BENTO_GALLERY = {
        mainPool: {
            url: resolveMediaUrl(settings?.gallery_pool, DEFAULT_BANNERS.gallery_pool),
            badge: 'Sky Infinity Pool',
            title: 'Hồ Bơi Vô Cực Chân Mây & Sundeck Ngắm Hoàng Hôn',
            desc: 'Đắm mình trong làn nước mát lành ở độ cao lý tưởng, phóng tầm mắt ôm trọn đường chân trời biển Mỹ Khê và thưởng thức cocktail nhiệt đới.'
        },
        spaSanctuary: {
            url: resolveMediaUrl(settings?.gallery_spa, DEFAULT_BANNERS.gallery_spa),
            badge: 'The Lotus Spa & Wellness',
            title: 'Trị Liệu Đá Nóng & Thảo Mộc Cung Đình',
            desc: 'Phục hồi năng lượng với tinh dầu sen trắng và liệu pháp massage chuyên sâu.'
        },
        fineDining: {
            url: resolveMediaUrl(settings?.gallery_dining, DEFAULT_BANNERS.gallery_dining),
            badge: 'Fine Dining',
            title: 'Nhà Hàng Á - Âu & Hầm Rượu Vang'
        },
        coastalView: {
            url: resolveMediaUrl(settings?.gallery_beach, DEFAULT_BANNERS.gallery_beach),
            badge: 'Biển Mỹ Khê & Xe VIP',
            title: 'Bình Minh Biển Mỹ Khê & Xe Đón Sân Bay'
        }
    };

    const stats = [
        {
            icon: MapPin,
            value: '2 Phút',
            label: 'Bước ra bãi biển Mỹ Khê',
            desc: 'Tọa lạc tại cung đường biển Võ Nguyên Giáp đắt giá nhất Đà Nẵng'
        },
        {
            icon: Waves,
            value: '180° View',
            label: 'Hồ bơi vô cực hướng biển',
            desc: 'Ngắm trọn bình minh đại dương và bán đảo Sơn Trà từ tầng thượng'
        },
        {
            icon: Star,
            value: '5.0 / 5.0',
            label: 'Điểm hài lòng thực tế',
            desc: 'Được bình chọn xuất sắc bởi du khách lưu trú trong nước và quốc tế'
        },
        {
            icon: Clock,
            value: '24 / 7',
            label: 'Concierge & Room Service',
            desc: 'Phục vụ ẩm thực tận phòng, đặt lịch Spa và hỗ trợ xe sân bay mọi lúc'
        }
    ];

    return (
        <section className="py-16 sm:py-20 bg-white border-t border-slate-100 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10 sm:mb-12">
                    <div className="max-w-2xl">
                        <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-amber-700 mb-3">
                            KHÔNG GIAN &amp; TIỆN ÍCH
                        </span>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-slate-900 tracking-tight leading-tight">
                            Tuyệt Tác Kiến Trúc & <br className="hidden sm:inline" />
                            <span className="bg-gradient-to-r from-slate-900 via-amber-800 to-amber-600 bg-clip-text text-transparent">
                                Tiện Ích Chuẩn {starCount} Sao Quốc Tế
                            </span>
                        </h2>
                        <p className="text-slate-600 text-sm sm:text-base mt-3.5 leading-relaxed">
                            Không chỉ là nơi dừng chân, {hotelName} mang đến hệ sinh thái nghỉ dưỡng ven biển trọn vẹn từ hồ bơi vô cực chân mây, tổ hợp trị liệu The Lotus Spa đến ẩm thực Á - Âu tinh tuyển.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <Link
                            to="/rooms"
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white text-xs sm:text-sm font-bold shadow-[0_8px_20px_-6px_rgba(2,132,199,0.45)] hover:shadow-[0_12px_24px_-6px_rgba(2,132,199,0.55)] ring-1 ring-inset ring-white/20 hover:-translate-y-0.5 transition-all"
                        >
                            <span>Khám phá không gian phòng</span>
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            to="/contact"
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/90 text-xs sm:text-sm font-bold transition-all"
                        >
                            <MapPin className="w-4 h-4 text-amber-600" />
                            <span>Vị trí & Chỉ đường</span>
                        </Link>
                    </div>
                </div>

                {/* BENTO PHOTO GALLERY (4 tấm ảnh độc bản, không trùng với các section khác) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
                    {/* Ảnh lớn 1 (Chiếm 7 cột, cao 2 hàng): Hồ Bơi Vô Cực Hướng Biển */}
                    <div className="lg:col-span-7 lg:row-span-2 relative group rounded-3xl overflow-hidden min-h-[320px] sm:min-h-[440px] bg-slate-900 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.15)]">
                        <img
                            src={BENTO_GALLERY.mainPool.url}
                            alt={BENTO_GALLERY.mainPool.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                        <div className="absolute top-4 left-4">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/60 backdrop-blur-md border border-white/15 text-amber-300 text-[11px] font-bold uppercase tracking-wider">
                                <Waves className="w-3.5 h-3.5" />
                                <span>{BENTO_GALLERY.mainPool.badge}</span>
                            </span>
                        </div>
                        <div className="absolute bottom-5 left-5 right-5 sm:bottom-7 sm:left-7 sm:right-7 text-white">
                            <h3 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold mb-2 leading-snug">
                                {BENTO_GALLERY.mainPool.title}
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-200/95 max-w-xl leading-relaxed line-clamp-2">
                                {BENTO_GALLERY.mainPool.desc}
                            </p>
                        </div>
                    </div>

                    {/* Ảnh 2 (Chiếm 5 cột, hàng trên): The Lotus Spa & Wellness */}
                    <div className="lg:col-span-5 relative group rounded-3xl overflow-hidden min-h-[210px] sm:min-h-[225px] bg-slate-900 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.12)]">
                        <img
                            src={BENTO_GALLERY.spaSanctuary.url}
                            alt={BENTO_GALLERY.spaSanctuary.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                        <div className="absolute top-3.5 left-3.5">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/60 backdrop-blur-md border border-white/15 text-amber-300 text-[10.5px] font-bold uppercase tracking-wider">
                                <Flower2 className="w-3.5 h-3.5" />
                                <span>{BENTO_GALLERY.spaSanctuary.badge}</span>
                            </span>
                        </div>
                        <div className="absolute bottom-4 left-4 right-4 text-white">
                            <h3 className="font-serif text-lg sm:text-xl font-bold mb-1">
                                {BENTO_GALLERY.spaSanctuary.title}
                            </h3>
                            <p className="text-xs text-slate-200/90 line-clamp-1">
                                {BENTO_GALLERY.spaSanctuary.desc}
                            </p>
                        </div>
                    </div>

                    {/* Hàng dưới bên phải chia 2 ảnh nhỏ */}
                    <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                        {/* Ảnh 3: Nhà hàng & Sky Bar */}
                        <div className="relative group rounded-3xl overflow-hidden min-h-[200px] sm:min-h-[210px] bg-slate-900 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.12)]">
                            <img
                                src={BENTO_GALLERY.fineDining.url}
                                alt={BENTO_GALLERY.fineDining.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                                loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />
                            <div className="absolute top-3 left-3">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-950/60 backdrop-blur-md border border-white/15 text-amber-300 text-[10px] font-bold">
                                    <UtensilsCrossed className="w-3 h-3" />
                                    <span>{BENTO_GALLERY.fineDining.badge}</span>
                                </span>
                            </div>
                            <div className="absolute bottom-3.5 left-3.5 right-3.5 text-white">
                                <h4 className="font-serif text-base font-bold leading-snug">
                                    {BENTO_GALLERY.fineDining.title}
                                </h4>
                            </div>
                        </div>

                        {/* Ảnh 4: Bãi biển Mỹ Khê & Đưa đón VIP */}
                        <div className="relative group rounded-3xl overflow-hidden min-h-[200px] sm:min-h-[210px] bg-slate-900 shadow-[0_10px_30px_-10px_rgba(15,23,42,0.12)]">
                            <img
                                src={BENTO_GALLERY.coastalView.url}
                                alt={BENTO_GALLERY.coastalView.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                                loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />
                            <div className="absolute top-3 left-3">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-950/60 backdrop-blur-md border border-white/15 text-amber-300 text-[10px] font-bold">
                                    <Car className="w-3 h-3" />
                                    <span>{BENTO_GALLERY.coastalView.badge}</span>
                                </span>
                            </div>
                            <div className="absolute bottom-3.5 left-3.5 right-3.5 text-white">
                                <h4 className="font-serif text-base font-bold leading-snug">
                                    {BENTO_GALLERY.coastalView.title}
                                </h4>
                            </div>
                        </div>
                    </div>
                </div>

                {/* DẢI 4 THÔNG SỐ VÀNG (KEY RESORT HIGHLIGHTS) */}
                <div className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                    {stats.map((st, idx) => {
                        const IconComp = st.icon;
                        return (
                            <div
                                key={idx}
                                className="p-5 rounded-2xl bg-gradient-to-br from-slate-50/90 via-white to-amber-50/30 border border-slate-200/80 hover:border-sky-200/90 shadow-2xs hover:shadow-md transition-all duration-300 flex items-start gap-3.5 group"
                            >
                                <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-700 group-hover:bg-gradient-to-br group-hover:from-sky-600 group-hover:to-blue-700 group-hover:text-white group-hover:border-transparent flex items-center justify-center shrink-0 transition-all duration-300 shadow-2xs">
                                    <IconComp className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-serif text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                                        {st.value}
                                    </div>
                                    <div className="text-xs font-bold text-amber-800 mt-0.5">
                                        {st.label}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                        {st.desc}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
