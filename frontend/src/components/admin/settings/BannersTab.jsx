import React from 'react';
import {
    Image as ImageIcon,
    Save,
    RefreshCw,
    ExternalLink,
    Upload,
    RotateCcw
} from 'lucide-react';
import { DEFAULT_BANNERS } from '../../../store/hotelSettingStore';
import { resolveMediaUrl } from '../../../utils/mediaUrl';

export default function BannersTab({
    hotelData,
    setHotelData,
    isSavingHotel,
    canUpdateSettings,
    uploadingField,
    onSaveBanners,
    onUploadImage,
}) {
    const bannerList = [
        {
            key: 'banner_home',
            title: '1. Trang Chủ — Slide 1: Kỳ Nghỉ Thượng Lưu',
            badge: 'Trang Chủ • Slide 1',
            subtitle: 'Hero Banner chính đầu tiên chào đón khách hàng khi vừa vào website',
            previewTag: 'Trang Chủ • Slide 1',
            previewTitle: 'Kỳ Nghỉ Thượng Lưu',
            previewSub: 'Tại Khách Sạn TA Đà Nẵng',
            route: '/',
            defaultUrl: DEFAULT_BANNERS.banner_home,
        },
        {
            key: 'banner_home_2',
            title: '2. Trang Chủ — Slide 2: Hồ Bơi Vô Cực Hướng Biển',
            badge: 'Trang Chủ • Slide 2',
            subtitle: 'Slide thứ 2 giới thiệu hồ bơi chân mây, hoàng hôn Mỹ Khê và thư giãn',
            previewTag: 'Trang Chủ • Slide 2',
            previewTitle: 'Thiên Đường Nghỉ Dưỡng',
            previewSub: 'Hồ Bơi Vô Cực Hướng Biển',
            route: '/',
            defaultUrl: DEFAULT_BANNERS.banner_home_2,
        },
        {
            key: 'banner_home_3',
            title: '3. Trang Chủ — Slide 3: Phòng Suite Hạng Sang',
            badge: 'Trang Chủ • Slide 3',
            subtitle: `Slide thứ 3 giới thiệu phòng Suite ${hotelData.stars || 5} sao, ẩm thực thượng hạng và đặc quyền`,
            previewTag: 'Trang Chủ • Slide 3',
            previewTitle: 'Phòng Suite Hạng Sang',
            previewSub: `Đặc Quyền Dịch Vụ ${hotelData.stars || 5} Sao`,
            route: '/',
            defaultUrl: DEFAULT_BANNERS.banner_home_3,
        },
        {
            key: 'banner_rooms',
            title: '4. Trang Danh Sách Phòng & Suites',
            badge: 'Trang Chuyên Mục',
            subtitle: 'Banner đầu trang tra cứu phòng trống, bộ lọc tiện nghi và đặt phòng',
            previewTag: `Nghỉ Dưỡng ${hotelData.stars || 5} Sao`,
            previewTitle: 'Tuyệt Tác Không Gian Nghỉ Dưỡng',
            previewSub: 'Bên Bờ Biển Mỹ Khê',
            route: '/rooms',
            defaultUrl: DEFAULT_BANNERS.banner_rooms,
        },
        {
            key: 'banner_services',
            title: '5. Trang Dịch Vụ & Menu Ẩm Thực (F&B)',
            badge: 'Trang Chuyên Mục',
            subtitle: 'Banner đầu trang ẩm thực tại phòng, nhà hàng và The Lotus Spa',
            previewTag: 'Dịch Vụ Đẳng Cấp',
            previewTitle: 'Ẩm Thực Thượng Hạng & Spa',
            previewSub: 'Phục Vụ 24/7 Chu Đáo',
            route: '/services',
            defaultUrl: DEFAULT_BANNERS.banner_services,
        },
        {
            key: 'banner_corporate',
            title: '6. Trang Đặt Đoàn & Doanh Nghiệp (M.I.C.E)',
            badge: 'Trang Chuyên Mục',
            subtitle: 'Banner dành riêng cho khách đoàn, công ty du lịch và hội nghị',
            previewTag: 'B2B & M.I.C.E',
            previewTitle: 'Khách Hàng Doanh Nghiệp',
            previewSub: '& Đặt Phòng Theo Đoàn',
            route: '/corporate-booking',
            defaultUrl: DEFAULT_BANNERS.banner_corporate,
        },
        {
            key: 'banner_news',
            title: '7. Trang Tin Tức & Cẩm Nang Du Lịch',
            badge: 'Trang Chuyên Mục',
            subtitle: 'Banner đầu trang tin tức, sự kiện và cẩm nang khám phá',
            previewTag: 'Tin Tức & Cẩm Nang',
            previewTitle: 'Khám Phá Đà Nẵng Diệu Kỳ',
            previewSub: 'Cẩm Nang Du Lịch & Ẩm Thực',
            route: '/news',
            defaultUrl: DEFAULT_BANNERS.banner_news,
        },
        {
            key: 'banner_promotions',
            title: '8. Trang Khuyến Mãi & Ưu Đãi',
            badge: 'Trang Chuyên Mục',
            subtitle: 'Banner giới thiệu ưu đãi mùa hè, voucher và đặc quyền hội viên',
            previewTag: 'Ưu Đãi Đặc Quyền',
            previewTitle: 'Chương Trình Khuyến Mãi',
            previewSub: 'Dành Riêng Cho Đặt Trực Tuyến',
            route: '/promotions',
            defaultUrl: DEFAULT_BANNERS.banner_promotions,
        },
        {
            key: 'banner_contact',
            title: '9. Trang Liên Hệ & Chăm Sóc Khách Hàng',
            badge: 'Trang Chuyên Mục',
            subtitle: 'Banner đầu trang thông tin liên hệ, hotline và địa chỉ bản đồ',
            previewTag: 'Hỗ Trợ 24/7',
            previewTitle: 'Kết Nối Với Chúng Tôi',
            previewSub: 'Khách Sạn TA Đà Nẵng',
            route: '/contact',
            defaultUrl: DEFAULT_BANNERS.banner_contact,
        },
        {
            key: 'banner_login',
            title: '10. Trang Đăng Nhập & Hội Viên VIP',
            badge: 'Trang Đăng Nhập',
            subtitle: 'Ảnh nền Resort toàn màn hình tại cổng Đăng nhập / Tra cứu / Hội viên VIP',
            previewTag: 'Hội Viên & Đặt Phòng',
            previewTitle: 'Cổng Khách Hàng Thân Thiết',
            previewSub: `${hotelData.hotel_name || 'Khách Sạn TA Đà Nẵng'} VIP Collection`,
            route: '/login',
            defaultUrl: DEFAULT_BANNERS.banner_login,
        },
    ];

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden animate-fadeIn space-y-6">
            {/* Header Tab Banner */}
            <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-sky-50/70 via-blue-50/40 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
                        <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                            <span>Banner Các Trang Web Công Khai</span>
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                10 Banner (3 Slide Trang chủ + 7 Trang chuyên mục & Đăng nhập)
                            </span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Tùy biến hình ảnh Hero Banner xuất hiện trên đầu từng trang web của khách hàng. Trang chủ hỗ trợ trọn bộ 3 ảnh Slider chuyển động luân phiên.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={onSaveBanners}
                        disabled={isSavingHotel || !canUpdateSettings}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        {isSavingHotel ? (
                            <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Đang lưu...</span>
                            </>
                        ) : (
                            <>
                                <Save className="w-3.5 h-3.5" />
                                <span>Lưu thay đổi Banner</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Danh sách 10 Banner */}
            <div className="px-6 sm:px-8 pb-8 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {bannerList.map((page) => {
                        const rawUrl = hotelData[page.key] || page.defaultUrl;
                        const currentUrl = resolveMediaUrl(rawUrl, page.defaultUrl);
                        const isCustom = Boolean(hotelData[page.key] && hotelData[page.key] !== page.defaultUrl);
                        const isUploading = uploadingField === page.key;

                        return (
                            <div
                                key={page.key}
                                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
                            >
                                {/* Card Title & Badges */}
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                                            <span>{page.title}</span>
                                            {page.badge && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                                    {page.badge}
                                                </span>
                                            )}
                                            {isCustom ? (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    Ảnh tùy chỉnh
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                                    Ảnh mặc định
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                            {page.subtitle}
                                        </p>
                                    </div>

                                    <a
                                        href={page.route}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="shrink-0 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                        title="Mở xem trang thực tế trong tab mới"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                </div>

                                {/* Khung Xem Trước Hero Banner Giống Thực Tế */}
                                <div className="relative rounded-xl overflow-hidden aspect-[21/9] bg-slate-900 border border-slate-200/80 shadow-inner group">
                                    <img
                                        src={currentUrl}
                                        alt={page.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        onError={(e) => {
                                            e.target.src = page.defaultUrl;
                                        }}
                                    />
                                    {/* Gradient Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent pointer-events-none" />

                                    {/* Mock text overlay */}
                                    <div className="absolute inset-0 p-4 flex flex-col justify-end text-white pointer-events-none">
                                        <span className="text-[9px] font-bold tracking-widest uppercase text-amber-300">
                                            {page.previewTag}
                                        </span>
                                        <h4 className="font-serif font-bold text-xs sm:text-sm text-white drop-shadow-xs line-clamp-1">
                                            {page.previewTitle}
                                        </h4>
                                        <p className="text-[10px] text-gray-200 line-clamp-1">
                                            {page.previewSub}
                                        </p>
                                    </div>

                                    {/* Overlay khi đang tải ảnh lên */}
                                    {isUploading && (
                                        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center gap-2 text-white text-xs font-semibold">
                                            <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                                            <span>Đang tải ảnh lên...</span>
                                        </div>
                                    )}
                                </div>

                                {/* Thanh công cụ Tải ảnh & Khôi phục */}
                                <div className="space-y-2 pt-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <label className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition shadow-2xs ${
                                            !canUpdateSettings
                                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                : 'bg-white hover:bg-blue-50 text-blue-600 border-blue-200 cursor-pointer active:scale-95'
                                        }`}>
                                            <Upload className="w-3.5 h-3.5" />
                                            <span>Tải ảnh từ máy tính</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                disabled={!canUpdateSettings || isUploading}
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) {
                                                        onUploadImage(e.target.files[0], page.key);
                                                    }
                                                }}
                                                className="hidden"
                                            />
                                        </label>

                                        {isCustom && (
                                            <button
                                                type="button"
                                                onClick={() => setHotelData({ ...hotelData, [page.key]: page.defaultUrl })}
                                                disabled={!canUpdateSettings}
                                                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                title="Khôi phục ảnh mẫu ban đầu"
                                            >
                                                <RotateCcw className="w-3 h-3 text-slate-400" />
                                                <span>Ảnh mẫu</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Ô nhập link URL ảnh trực tiếp */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-semibold text-slate-500">
                                            Đường dẫn URL ảnh:
                                        </label>
                                        <input
                                            type="text"
                                            value={hotelData[page.key] || ''}
                                            onChange={(e) => setHotelData({ ...hotelData, [page.key]: e.target.value })}
                                            disabled={!canUpdateSettings}
                                            placeholder={page.defaultUrl}
                                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-800 focus:outline-hidden focus:border-blue-500 bg-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Sticky Bottom Actions */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">Lưu ý:</span> Khuyến nghị ảnh có độ phân giải từ <strong className="text-slate-800">1920x800px</strong> trở lên để hiển thị sắc nét nhất trên màn hình lớn.
                    </div>
                </div>
            </div>
        </div>
    );
}

