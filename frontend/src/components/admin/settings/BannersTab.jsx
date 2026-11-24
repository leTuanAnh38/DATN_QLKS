import React, { useState, useMemo } from 'react';
import {
    Image as ImageIcon,
    Save,
    RefreshCw,
    ExternalLink,
    Upload,
    RotateCcw,
    Search,
    Home,
    Sparkles,
    BellRing,
    LayoutGrid,
    Lock,
    X
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
    const [activeGroup, setActiveGroup] = useState('all'); // 'all' | 'home_hero' | 'home_gallery' | 'subpages' | 'auth'
    const [searchQuery, setSearchQuery] = useState('');

    // Phân nhóm rõ ràng 16 hình ảnh theo đúng cấu trúc website từ trên xuống dưới
    const bannerGroups = useMemo(() => [
        {
            id: 'home_hero',
            tabGroup: 'home',
            title: 'Trang Chủ — Slider Đầu Trang (Hero Banner)',
            subtitle: '3 ảnh lớn chạy luân phiên ngay đầu Trang chủ (/) phía sau thanh tìm kiếm phòng',
            icon: Home,
            accentBg: 'bg-sky-50 border-sky-200/80 text-sky-700',
            badgeStyle: 'bg-sky-50 text-sky-700 border-sky-200',
            items: [
                {
                    key: 'banner_home',
                    title: 'Slide 1: Kỳ Nghỉ Thượng Lưu',
                    position: 'Trang Chủ • Đầu trang (Slide 1)',
                    subtitle: 'Ảnh mở màn chào đón khách hàng khi vừa truy cập website',
                    previewTag: 'Trang Chủ • Slide 1',
                    previewTitle: 'Kỳ Nghỉ Thượng Lưu',
                    previewSub: `Tại ${hotelData.hotel_name || 'Khách Sạn TA Đà Nẵng'}`,
                    route: '/',
                    defaultUrl: DEFAULT_BANNERS.banner_home,
                },
                {
                    key: 'banner_home_2',
                    title: 'Slide 2: Hồ Bơi Vô Cực Hướng Biển',
                    position: 'Trang Chủ • Đầu trang (Slide 2)',
                    subtitle: 'Slide thứ 2 giới thiệu hồ bơi chân mây, hoàng hôn Mỹ Khê và thư giãn',
                    previewTag: 'Trang Chủ • Slide 2',
                    previewTitle: 'Thiên Đường Nghỉ Dưỡng',
                    previewSub: 'Hồ Bơi Vô Cực Hướng Biển',
                    route: '/',
                    defaultUrl: DEFAULT_BANNERS.banner_home_2,
                },
                {
                    key: 'banner_home_3',
                    title: 'Slide 3: Phòng Suite Hạng Sang',
                    position: 'Trang Chủ • Đầu trang (Slide 3)',
                    subtitle: `Slide thứ 3 giới thiệu phòng Suite ${hotelData.stars || 3} sao và đặc quyền nghỉ dưỡng`,
                    previewTag: 'Trang Chủ • Slide 3',
                    previewTitle: 'Phòng Suite Hạng Sang',
                    previewSub: `Đặc Quyền Dịch Vụ ${hotelData.stars || 3} Sao`,
                    route: '/',
                    defaultUrl: DEFAULT_BANNERS.banner_home_3,
                },
            ],
        },
        {
            id: 'home_gallery',
            tabGroup: 'home',
            title: 'Trang Chủ — Không Gian Tiện Ích & Khung Concierge',
            subtitle: '4 ảnh lưới Bento mục "Tuyệt Tác Kiến Trúc & Tiện Ích" và 2 ảnh trong khung "In-Room Dining & Concierge" trên Trang chủ (/)',
            icon: Sparkles,
            accentBg: 'bg-amber-50 border-amber-200/80 text-amber-800',
            badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200',
            items: [
                {
                    key: 'gallery_pool',
                    title: 'Tiện Ích 1: Hồ Bơi Vô Cực (Ảnh lớn bên trái)',
                    position: 'Trang Chủ • Khối Kiến Trúc & Tiện Ích',
                    subtitle: 'Khung ảnh chính lớn nhất bên trái giới thiệu hồ bơi chân mây',
                    previewTag: 'Sky Infinity Pool',
                    previewTitle: 'Hồ Bơi Vô Cực Chân Mây',
                    previewSub: 'Sundeck Ngắm Hoàng Hôn Biển Mỹ Khê',
                    route: '/',
                    defaultUrl: DEFAULT_BANNERS.gallery_pool,
                },
                {
                    key: 'gallery_spa',
                    title: 'Tiện Ích 2: The Lotus Spa (Ảnh ngang bên phải)',
                    position: 'Trang Chủ • Khối Kiến Trúc & Tiện Ích',
                    subtitle: 'Khung ảnh ngang phía trên bên phải giới thiệu khu trị liệu Spa',
                    previewTag: 'The Lotus Spa & Wellness',
                    previewTitle: 'Trị Liệu Đá Nóng & Thảo Mộc',
                    previewSub: 'Phục hồi năng lượng tinh dầu sen trắng',
                    route: '/',
                    defaultUrl: DEFAULT_BANNERS.gallery_spa,
                },
                {
                    key: 'gallery_dining',
                    title: 'Tiện Ích 3: Nhà Hàng Fine Dining (Ảnh nhỏ dưới trái)',
                    position: 'Trang Chủ • Khối Kiến Trúc & Tiện Ích',
                    subtitle: 'Ô ảnh nhỏ phía dưới bên trái giới thiệu nhà hàng Á - Âu & hầm vang',
                    previewTag: 'Fine Dining',
                    previewTitle: 'Nhà Hàng Á - Âu & Hầm Rượu Vang',
                    previewSub: 'Không gian ẩm thực sang trọng',
                    route: '/',
                    defaultUrl: DEFAULT_BANNERS.gallery_dining,
                },
                {
                    key: 'gallery_beach',
                    title: 'Tiện Ích 4: Biển Mỹ Khê & Xe VIP (Ảnh nhỏ dưới phải)',
                    position: 'Trang Chủ • Khối Kiến Trúc & Tiện Ích',
                    subtitle: 'Ô ảnh nhỏ phía dưới bên phải giới thiệu bãi biển Mỹ Khê & đưa đón VIP',
                    previewTag: 'Biển Mỹ Khê & Xe VIP',
                    previewTitle: 'Bình Minh Biển Mỹ Khê',
                    previewSub: '& Dịch Vụ Xe Đón Sân Bay VIP',
                    route: '/',
                    defaultUrl: DEFAULT_BANNERS.gallery_beach,
                },
                {
                    key: 'concierge_dining_img',
                    title: 'Banner Concierge — Ảnh 1: Ẩm Thực Tại Phòng',
                    position: 'Trang Chủ • Khung Concierge (Ảnh trái)',
                    subtitle: 'Ảnh minh họa bên trái trong khối In-Room Dining & Concierge Service',
                    previewTag: 'In-Room Dining',
                    previewTitle: 'Ẩm Thực Tại Phòng',
                    previewSub: 'Giao tận cửa phòng trong 20 - 30 phút',
                    route: '/',
                    defaultUrl: DEFAULT_BANNERS.concierge_dining_img,
                },
                {
                    key: 'concierge_spa_img',
                    title: 'Banner Concierge — Ảnh 2: The Lotus Spa 24/7',
                    position: 'Trang Chủ • Khung Concierge (Ảnh phải)',
                    subtitle: 'Ảnh minh họa bên phải trong khối In-Room Dining & Concierge Service',
                    previewTag: 'The Lotus Spa',
                    previewTitle: 'The Lotus Spa 24/7',
                    previewSub: 'Đặt lịch trị liệu trực tuyến tại phòng',
                    route: '/',
                    defaultUrl: DEFAULT_BANNERS.concierge_spa_img,
                },
            ],
        },
        {
            id: 'subpages',
            tabGroup: 'subpages',
            title: 'Banner Đầu Các Trang Chuyên Mục',
            subtitle: 'Hình ảnh Hero Banner hiển thị ở phần đầu của 6 trang chức năng khách hàng',
            icon: LayoutGrid,
            accentBg: 'bg-indigo-50 border-indigo-200/80 text-indigo-700',
            badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200',
            items: [
                {
                    key: 'banner_rooms',
                    title: 'Trang Phòng Nghỉ & Suites',
                    position: 'Trang Danh Sách Phòng',
                    subtitle: 'Banner đầu trang tra cứu phòng trống, bộ lọc tiện nghi và đặt phòng',
                    previewTag: `Nghỉ Dưỡng ${hotelData.stars || 3} Sao`,
                    previewTitle: 'Tuyệt Tác Không Gian Nghỉ Dưỡng',
                    previewSub: 'Bên Bờ Biển Mỹ Khê',
                    route: '/rooms',
                    defaultUrl: DEFAULT_BANNERS.banner_rooms,
                },
                {
                    key: 'banner_services',
                    title: 'Trang Menu Dịch Vụ & Ẩm Thực',
                    position: 'Trang Dịch Vụ (F&B & Spa)',
                    subtitle: 'Banner đầu trang gọi món tại phòng, nhà hàng và The Lotus Spa',
                    previewTag: 'Dịch Vụ Đẳng Cấp',
                    previewTitle: 'Ẩm Thực Thượng Hạng & Spa',
                    previewSub: 'Phục Vụ 24/7 Chu Đáo',
                    route: '/services',
                    defaultUrl: DEFAULT_BANNERS.banner_services,
                },
                {
                    key: 'banner_promotions',
                    title: 'Trang Ưu Đãi & Khuyến Mãi',
                    position: 'Trang Khuyến Mãi',
                    subtitle: 'Banner giới thiệu chương trình ưu đãi, kho voucher và thẻ TA Club',
                    previewTag: 'Ưu Đãi Đặc Quyền',
                    previewTitle: 'Chương Trình Khuyến Mãi',
                    previewSub: 'Dành Riêng Cho Đặt Trực Tuyến',
                    route: '/promotions',
                    defaultUrl: DEFAULT_BANNERS.banner_promotions,
                },
                {
                    key: 'banner_corporate',
                    title: 'Trang Đặt Đoàn & Doanh Nghiệp (M.I.C.E)',
                    position: 'Trang Khách Đoàn B2B',
                    subtitle: 'Banner dành riêng cho khách đoàn, công ty du lịch và hội nghị',
                    previewTag: 'B2B & M.I.C.E',
                    previewTitle: 'Khách Hàng Doanh Nghiệp',
                    previewSub: '& Đặt Phòng Theo Đoàn',
                    route: '/corporate-booking',
                    defaultUrl: DEFAULT_BANNERS.banner_corporate,
                },
                {
                    key: 'banner_news',
                    title: 'Trang Tin Tức & Cẩm Nang Du Lịch',
                    position: 'Trang Tin Tức',
                    subtitle: 'Banner đầu trang tin tức, sự kiện và cẩm nang khám phá Đà Nẵng',
                    previewTag: 'Tin Tức & Cẩm Nang',
                    previewTitle: 'Khám Phá Đà Nẵng Diệu Kỳ',
                    previewSub: 'Cẩm Nang Du Lịch & Ẩm Thực',
                    route: '/news',
                    defaultUrl: DEFAULT_BANNERS.banner_news,
                },
                {
                    key: 'banner_contact',
                    title: 'Trang Liên Hệ & Bản Đồ Chỉ Đường',
                    position: 'Trang Liên Hệ',
                    subtitle: 'Banner đầu trang thông tin liên hệ, hotline và form gửi yêu cầu',
                    previewTag: 'Hỗ Trợ 24/7',
                    previewTitle: 'Kết Nối Với Chúng Tôi',
                    previewSub: hotelData.hotel_name || 'Khách Sạn TA Đà Nẵng',
                    route: '/contact',
                    defaultUrl: DEFAULT_BANNERS.banner_contact,
                },
            ],
        },
        {
            id: 'auth',
            tabGroup: 'auth',
            title: 'Cổng Đăng Nhập & Hội Viên VIP',
            subtitle: 'Ảnh nền toàn màn hình hiển thị ở trang Đăng nhập / Đăng ký tài khoản',
            icon: Lock,
            accentBg: 'bg-slate-100 border-slate-200 text-slate-700',
            badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
            items: [
                {
                    key: 'banner_login',
                    title: 'Trang Đăng Nhập & Hội Viên VIP',
                    position: 'Cổng Đăng Nhập',
                    subtitle: 'Ảnh nền Resort toàn màn hình tại cổng Đăng nhập / Đăng ký / Hội viên VIP',
                    previewTag: 'Hội Viên & Đặt Phòng',
                    previewTitle: 'Cổng Khách Hàng Thân Thiết',
                    previewSub: `${hotelData.hotel_name || 'Khách Sạn TA Đà Nẵng'} VIP Collection`,
                    route: '/login',
                    defaultUrl: DEFAULT_BANNERS.banner_login,
                },
            ],
        },
    ], [hotelData.hotel_name, hotelData.stars]);

    // Bộ lọc nhóm & từ khóa tìm kiếm tức thì
    const filteredGroups = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return bannerGroups
            .filter((group) => {
                if (activeGroup === 'all') return true;
                if (activeGroup === 'home') return group.tabGroup === 'home';
                return group.id === activeGroup;
            })
            .map((group) => {
                if (!q) return group;
                const matchedItems = group.items.filter((item) => {
                    const haystack = `${item.title} ${item.position} ${item.subtitle} ${item.route} ${group.title}`.toLowerCase();
                    return haystack.includes(q);
                });
                return { ...group, items: matchedItems };
            })
            .filter((group) => group.items.length > 0);
    }, [bannerGroups, activeGroup, searchQuery]);

    const totalVisibleCount = filteredGroups.reduce((acc, g) => acc + g.items.length, 0);

    const filterTabs = [
        { id: 'all', label: 'Tất cả ảnh', count: 16 },
        { id: 'home_hero', label: 'Trang chủ: Slider đầu trang', count: 3 },
        { id: 'home_gallery', label: 'Trang chủ: Tiện ích & Concierge', count: 6 },
        { id: 'subpages', label: 'Các trang chuyên mục', count: 6 },
        { id: 'auth', label: 'Trang Đăng nhập', count: 1 },
    ];

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden animate-fadeIn">
            {/* 1. HEADER TAB BANNER + NÚT LƯU */}
            <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-sky-50/70 via-blue-50/40 to-transparent flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-600/25 shrink-0">
                        <ImageIcon className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>Quản Lý Banner & Hình Ảnh Trang Web</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                16 vị trí • Phân nhóm theo từng trang
                            </span>
                        </h2>
                        <p className="text-[11.5px] text-slate-500 mt-0.5 truncate">
                            Chọn nhóm trang bên dưới hoặc gõ từ khóa để tìm nhanh đúng ảnh cần thay. Nhấn <strong>Lưu thay đổi</strong> sau khi chỉnh sửa.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onSaveBanners}
                        disabled={isSavingHotel || !canUpdateSettings}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-sm shadow-emerald-600/25 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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

            {/* 2. THANH LỌC NHÓM TRANG & Ô TÌM KIẾM NHANH */}
            <div className="px-4 sm:px-5 py-3 bg-slate-50/70 border-b border-slate-200/70 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
                {/* Quick Group Filter Pills */}
                <div className="flex flex-wrap items-center gap-2">
                    {filterTabs.map((tab) => {
                        const isActive = activeGroup === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveGroup(tab.id)}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    isActive
                                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                                        : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/90'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span
                                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                                        isActive
                                            ? 'bg-white/20 text-white'
                                            : 'bg-slate-100 text-slate-500'
                                    }`}
                                >
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Search Input */}
                <div className="relative w-full xl:w-72 shrink-0">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm theo trang (VD: spa, phòng, /news)..."
                        className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                            title="Xóa từ khóa"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* 3. DANH SÁCH ẢNH PHÂN THEO NHÓM RÕ RÀNG */}
            <div className="px-6 sm:px-8 py-6 space-y-9">
                {filteredGroups.length === 0 ? (
                    <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                        <ImageIcon className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="text-sm font-bold text-slate-700">
                            Không tìm thấy vị trí ảnh nào khớp với "{searchQuery}"
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('');
                                setActiveGroup('all');
                            }}
                            className="mt-2 px-4 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold hover:bg-blue-100 transition cursor-pointer"
                        >
                            Hiển thị lại tất cả 16 ảnh
                        </button>
                    </div>
                ) : (
                    filteredGroups.map((group) => {
                        const GroupIcon = group.icon;
                        return (
                            <div key={group.id} className="space-y-4">
                                {/* Tiêu đề từng khu vực / trang */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
                                    <div className="flex items-start sm:items-center gap-3">
                                        <div
                                            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${group.accentBg}`}
                                        >
                                            <GroupIcon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                                                <span>{group.title}</span>
                                                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                    {group.items.length} ảnh
                                                </span>
                                            </h3>
                                            <p className="text-[11.5px] text-slate-500 mt-0.5">
                                                {group.subtitle}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Lưới 2 cột các thẻ ảnh thuộc nhóm */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                    {group.items.map((page) => {
                                        const rawUrl = hotelData[page.key] || page.defaultUrl;
                                        const currentUrl = resolveMediaUrl(rawUrl, page.defaultUrl);
                                        const isCustom = Boolean(
                                            hotelData[page.key] && hotelData[page.key] !== page.defaultUrl
                                        );
                                        const isUploading = uploadingField === page.key;

                                        return (
                                            <div
                                                key={page.key}
                                                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-blue-300/80 hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                                            >
                                                <div className="space-y-3.5">
                                                    {/* Card Header: Tên rõ ràng + Nhãn vị trí + Route trang */}
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                                <span
                                                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${group.badgeStyle}`}
                                                                >
                                                                    {page.position}
                                                                </span>
                                                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80">
                                                                    {page.route}
                                                                </span>
                                                                {isCustom ? (
                                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                        Đã tùy chỉnh
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 border border-slate-200/60">
                                                                        Mặc định
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <h4 className="text-sm font-bold text-slate-900 leading-snug">
                                                                {page.title}
                                                            </h4>
                                                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                                                {page.subtitle}
                                                            </p>
                                                        </div>

                                                        <a
                                                            href={page.route}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="shrink-0 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100 transition"
                                                            title={`Mở xem trang ${page.route} trong tab mới`}
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                    </div>

                                                    {/* Khung Xem Trước Ảnh Giống Thực Tế */}
                                                    <div className="relative rounded-xl overflow-hidden aspect-[21/9] bg-slate-900 border border-slate-200/80 shadow-inner group">
                                                        <img
                                                            src={currentUrl}
                                                            alt={page.title}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                            onError={(e) => {
                                                                e.target.src = page.defaultUrl;
                                                            }}
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent pointer-events-none" />

                                                        <div className="absolute inset-0 p-4 flex flex-col justify-end text-white pointer-events-none">
                                                            <span className="text-[9px] font-bold tracking-widest uppercase text-amber-300">
                                                                {page.previewTag}
                                                            </span>
                                                            <h5 className="font-serif font-bold text-xs sm:text-sm text-white drop-shadow-xs line-clamp-1">
                                                                {page.previewTitle}
                                                            </h5>
                                                            <p className="text-[10px] text-gray-200 line-clamp-1">
                                                                {page.previewSub}
                                                            </p>
                                                        </div>

                                                        {isUploading && (
                                                            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center gap-2 text-white text-xs font-semibold">
                                                                <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                                                                <span>Đang tải ảnh lên...</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Thanh công cụ Tải ảnh & URL */}
                                                <div className="space-y-2 pt-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <label
                                                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition shadow-2xs ${
                                                                !canUpdateSettings
                                                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                                    : 'bg-white hover:bg-blue-50 text-blue-600 border-blue-200 cursor-pointer active:scale-95'
                                                            }`}
                                                        >
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
                                                                onClick={() =>
                                                                    setHotelData({
                                                                        ...hotelData,
                                                                        [page.key]: page.defaultUrl,
                                                                    })
                                                                }
                                                                disabled={!canUpdateSettings}
                                                                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                                title="Khôi phục ảnh mẫu ban đầu"
                                                            >
                                                                <RotateCcw className="w-3 h-3 text-slate-400" />
                                                                <span>Ảnh mẫu</span>
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-semibold text-slate-500">
                                                            Đường dẫn URL ảnh:
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={hotelData[page.key] || ''}
                                                            onChange={(e) =>
                                                                setHotelData({
                                                                    ...hotelData,
                                                                    [page.key]: e.target.value,
                                                                })
                                                            }
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
                            </div>
                        );
                    })
                )}

                {/* Thanh lưu nhanh ở cuối trang (tiện khi cuộn xuống dưới khỏi phải kéo lại lên đầu) */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-xs text-slate-500">
                        Đang hiển thị <strong className="text-slate-800">{totalVisibleCount}/16</strong> vị trí ảnh • Khuyến nghị độ phân giải từ{' '}
                        <strong className="text-slate-800">1920x800px</strong> cho Hero Banner để hiển thị sắc nét nhất.
                    </div>
                    <button
                        type="button"
                        onClick={onSaveBanners}
                        disabled={isSavingHotel || !canUpdateSettings}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
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
        </div>
    );
}
