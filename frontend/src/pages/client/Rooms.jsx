import React, { useState } from 'react';
import { Link } from 'react-router-dom';

// Dữ liệu chi tiết các hạng phòng & Suites
const ROOM_ITEMS = [
    {
        id: 'deluxe-ocean-king',
        name: 'Deluxe Ocean View King',
        category: 'Deluxe Ocean',
        tag: 'ƯU ĐÃI ĐẶC BIỆT',
        tagColor: 'bg-orange-500',
        subTag: 'Tiết kiệm 25%',
        rating: 4.92,
        reviewCount: 340,
        area: '65 m²',
        bed: '1 King Bed',
        capacity: '2 Người lớn + 1 Trẻ em',
        highlights: [
            'Ban công trực diện biển',
            'Bồn tắm cẩm thạch Ý',
            "Buffet L'Océan mỗi sáng",
            'Nespresso & Trà TWG miễn phí'
        ],
        priceOld: '5.650.000',
        priceCurrent: '4.238.000',
        image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
        ctaText: 'Đặt Phòng Ngay',
        isVilla: false
    },
    {
        id: 'executive-club-suite',
        name: 'Executive Club Seafront Suite',
        category: 'Executive Suite',
        tag: 'BÁN CHẠY NHẤT',
        tagColor: 'bg-blue-600',
        subTag: 'Club Lounge Access',
        rating: 4.98,
        reviewCount: 512,
        area: '110 m²',
        bed: '1 Khách + 1 Ngủ',
        capacity: '3 Người lớn',
        highlights: [
            'Đặc quyền TA Club Lounge tầng 25',
            'Tiệc trà chiều & Sunset Cocktail miễn phí',
            'Đưa đón sân bay Đà Nẵng 2 chiều',
            'Giặt ủi 02 món cao cấp mỗi ngày'
        ],
        priceOld: '7.450.000',
        priceCurrent: '7.450.000',
        image: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80',
        ctaText: 'Đặt Phòng Ngay',
        isVilla: false
    },
    {
        id: 'grand-premier-suite',
        name: 'Grand Premier Oceanfront Suite',
        category: 'Executive Suite',
        tag: 'KHÔNG GIAN GIA ĐÌNH VIP',
        tagColor: 'bg-slate-900',
        subTag: '270° Ocean View',
        rating: 4.95,
        reviewCount: 210,
        area: '145 m²',
        bed: '2 Phòng Ngủ VIP',
        capacity: '4 Người lớn + 2 Trẻ em',
        highlights: [
            'Ban công góc panorama 270°',
            'Quản gia cá nhân riêng hỗ trợ 24/7',
            '60 phút massage toàn thân cho 2 khách',
            'Đưa đón xe Mercedes-Benz E-Class'
        ],
        priceOld: '13.800.000',
        priceCurrent: '11.200.000',
        image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
        ctaText: 'Đặt Phòng Ngay',
        isVilla: false
    },
    {
        id: 'presidential-villa',
        name: 'Presidential Beachfront Pool Villa',
        category: 'Presidential Beachfront Villa',
        tag: 'BIỆT THỰ ĐỘC BẢN',
        tagColor: 'bg-amber-600',
        subTag: 'Hồ Bơi Tràn 45m²',
        rating: 5.0,
        reviewCount: 189,
        area: '350 m²',
        bed: 'Hồ bơi riêng biệt',
        capacity: 'Lối ra biển riêng',
        highlights: [
            'Đầu bếp tư gia phục vụ tiệc BBQ hải sản',
            'Dịch vụ Butler riêng phục vụ 24/7',
            'Xe Maybach đưa đón tận ga/sân bay',
            'Không gian tiệc cocktail bãi biển tư nhân'
        ],
        priceOld: '20.000.000',
        priceCurrent: '16.800.000',
        image: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
        ctaText: 'Đặt Biệt Thự',
        isVilla: true
    },
    {
        id: 'sky-penthouse',
        name: 'Sky Royal Penthouse 360°',
        category: 'Sky Royal Penthouse',
        tag: 'ĐỈNH CAO XA HOA',
        tagColor: 'bg-gradient-to-r from-amber-600 to-orange-500',
        subTag: 'Tầng 28 Cao Nhất',
        rating: 5.0,
        reviewCount: 98,
        area: '420 m²',
        bed: 'Sân bay trực thăng',
        capacity: 'Sauna & Onsen riêng',
        highlights: [
            'Quầy bar rượu vang và Champagne quý hiếm',
            'Hồ Onsen nước khoáng nóng ngoài trời tầng 28',
            'Bảo vệ chuyên trách & Lối đi thang máy độc lập',
            'Đội ngũ 02 Quản gia và Bếp trưởng thường trực'
        ],
        priceOld: '34.000.000',
        priceCurrent: '28.500.000',
        image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
        ctaText: 'Đặt Penthouse',
        isVilla: true
    }
];

// Bảng dữ liệu ma trận so sánh đặc quyền
const COMPARISON_ROWS = [
    {
        service: 'Đưa đón sân bay quốc tế',
        deluxe: 'Phụ thu (Xe tiêu chuẩn)',
        suite: 'Miễn phí 2 chiều (Mercedes E-Class)',
        villa: 'Miễn phí 2 chiều (Maybach / S-Class)'
    },
    {
        service: 'Thủ tục Check-in riêng biệt',
        deluxe: 'Quầy VIP Tiền Sảnh',
        suite: 'Tại TA Club Lounge Tầng 25',
        villa: 'Trực tiếp tại Villa / Sân bay'
    },
    {
        service: 'Đặc quyền TA Club Lounge VIP',
        deluxe: '—',
        suite: '✓ (Đặc quyền toàn phần)',
        villa: '✓ (Toàn quyền + Khách mời)'
    },
    {
        service: 'Quản gia cá nhân (Butler Service)',
        deluxe: '—',
        suite: 'Theo yêu cầu đặc biệt',
        villa: 'Quản gia thường trực 24/7'
    },
    {
        service: 'Dịch vụ Giặt ủi cao cấp',
        deluxe: 'Tính theo bảng giá',
        suite: 'Miễn phí 2 món / ngày',
        villa: 'Miễn phí không giới hạn'
    },
    {
        service: 'Bữa sáng & Ẩm thực ẩm thực',
        deluxe: "Buffet Nhà Hàng L'Océan",
        suite: "L'Océan hoặc Club Lounge VIP",
        villa: 'Bếp trưởng phục vụ tại Villa'
    }
];

export default function RoomsAndSuitesPage() {
    const [activeTab, setActiveTab] = useState('Tất cả (18)');
    const [viewFilter, setViewFilter] = useState('all');
    const [sortOption, setSortOption] = useState('featured');

    // Form state
    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        roomType: 'Executive Club Seafront Suite',
        occasion: 'Kỳ nghỉ gia đình / Thư giãn',
        notes: ''
    });

    const categories = [
        'Tất cả (18)',
        'Deluxe Ocean',
        'Executive Seafront Suite',
        'Presidential Beachfront Villa',
        'Sky Royal Penthouse'
    ];

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        alert(`Cảm ơn Quý khách ${formData.fullName || ''}! Yêu cầu tư vấn đã được gửi đến Quản gia trưởng Khách Sạn TA Đà Nẵng.`);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white">
            {/* 1. TOP ANNOUNCEMENT BAR */}
            <div className="bg-slate-900 text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
                <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center space-x-4">
                        <span className="font-semibold tracking-wider text-amber-400 uppercase text-[11px]">
                            KHÁCH SẠN TA ĐÀ NẴNG LUXURY COLLECTION
                        </span>
                        <span className="hidden sm:inline text-slate-600">|</span>
                        <span className="hidden sm:inline flex items-center gap-1 text-slate-400">
                            <span className="text-amber-400 font-bold">★</span>
                            The Leading Hotels of the World
                        </span>
                    </div>
                    <div className="flex items-center space-x-4 text-slate-300">
                        <span className="flex items-center gap-1.5 hover:text-white cursor-pointer transition">
                            <span className="text-orange-400">📞</span>
                            Hotline 24/7: <strong className="text-white">1900 8899</strong>
                        </span>
                        <span className="text-slate-600">|</span>
                        <div className="flex items-center space-x-2">
                            <span className="cursor-pointer hover:text-white">🇻🇳 VND</span>
                            <span>/</span>
                            <span className="cursor-pointer hover:text-white">Tiếng Việt</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. HEADER NAVIGATION */}
            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    {/* Logo */}
                    <Link to="/" className="flex items-center space-x-3 cursor-pointer">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/30">
                            <span className="text-white font-serif font-black text-xl tracking-tighter">TA</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-serif font-bold text-slate-900 text-lg leading-tight tracking-wide">
                                KHÁCH SẠN TA
                            </span>
                            <span className="text-[10px] font-semibold text-blue-600 tracking-[0.2em] uppercase">
                                ĐÀ NẴNG ★★★★★
                            </span>
                        </div>
                    </Link>
                    {/* Navigation Links */}
                    <nav className="hidden lg:flex items-center space-x-8 text-sm font-medium text-slate-700">
                        <Link to="/" className="hover:text-blue-600 transition">Trang chủ</Link>
                        <Link to="/rooms" className="text-blue-600 font-semibold border-b-2 border-blue-600 pb-1">Phòng nghỉ & Suites</Link>
                        <a href="/#am-thuc" className="hover:text-blue-600 transition">Ẩm thực & Bar</a>
                        <a href="/#dich-vu-spa" className="hover:text-blue-600 transition">Dịch vụ Spa</a>
                        <a href="/#uu-dai" className="hover:text-blue-600 transition">Ưu đãi đặc quyền</a>
                        <a href="/#lien-he" className="hover:text-blue-600 transition">Liên hệ</a>
                    </nav>
                    {/* Actions */}
                    <div className="flex items-center space-x-4">
                        <a href="#danh-sach-phong" className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium text-sm rounded-lg shadow-md shadow-orange-500/20 hover:shadow-lg transition-all duration-200">
                            Đặt phòng ngay
                        </a>
                        <div className="w-10 h-10 rounded-full border-2 border-blue-600 p-0.5 cursor-pointer">
                            <img
                                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                                alt="VIP Guest Avatar"
                                className="w-full h-full object-cover rounded-full"
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* 3. HERO & BREADCRUMB */}
            <section className="bg-white border-b border-slate-200 pt-8 pb-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500 mb-4">
                        <Link to="/" className="hover:text-blue-600 transition">Trang chủ</Link>
                        <span>/</span>
                        <span className="text-blue-600 font-medium">Phòng nghỉ & Suites</span>
                    </nav>
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                        <div className="max-w-3xl">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-wider mb-3">
                                💎 Bộ Sưu Tập Phòng Thượng Lưu 2025
                            </span>
                            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
                                Tuyệt Tác Không Gian Nghỉ Dưỡng Biển Mỹ Khê
                            </h1>
                            <p className="text-slate-600 text-sm sm:text-base mt-3 leading-relaxed font-light">
                                Bộ sưu tập 120 phòng nghỉ và Sky Suites thượng lưu, sở hữu tầm nhìn vô cực ôm trọn vịnh Đà Nẵng cùng dịch vụ quản gia cá nhân phục vụ 24/7.
                            </p>
                        </div>
                        {/* Quick Guarantee Badge */}
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3.5 flex-shrink-0 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                                🛡️
                            </div>
                            <div className="text-xs">
                                <div className="font-bold text-slate-900">Đảm bảo giá tốt nhất</div>
                                <div className="text-slate-500">Miễn phí hủy đến 24h & Tặng credit ẩm thực 1M</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. FILTER TOOLBAR */}
            <section className="sticky top-20 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 py-4 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                        {/* Category Pills */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveTab(cat)}
                                    className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition ${activeTab === cat
                                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        {/* Filter Dropdowns */}
                        <div className="flex items-center gap-3 text-xs">
                            <select
                                value={viewFilter}
                                onChange={(e) => setViewFilter(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-medium focus:outline-none focus:border-blue-600"
                            >
                                <option value="all">Tất cả hướng nhìn</option>
                                <option value="sea-180">Hướng Biển 180°</option>
                                <option value="city">Hướng Bán Đảo Sơn Trà</option>
                                <option value="garden">Hướng Vườn Sinh Thái</option>
                            </select>
                            <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-medium focus:outline-none focus:border-blue-600">
                                <option>Tiện ích nổi bật</option>
                                <option>Hồ bơi riêng biệt</option>
                                <option>Bồn tắm cẩm thạch Ý</option>
                                <option>Đặc quyền Club Lounge</option>
                            </select>
                            <select
                                value={sortOption}
                                onChange={(e) => setSortOption(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-blue-600 font-semibold focus:outline-none focus:border-blue-600"
                            >
                                <option value="featured">Đề xuất hàng đầu</option>
                                <option value="price-asc">Giá: Thấp đến Cao</option>
                                <option value="price-desc">Giá: Cao đến Thấp</option>
                                <option value="rating">Đánh giá cao nhất</option>
                            </select>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. ROOMS DETAILED LIST */}
            <section id="phong-nghi" className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="space-y-10">
                    {ROOM_ITEMS.map((room) => (
                        <div
                            key={room.id}
                            className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col lg:flex-row group"
                        >
                            {/* Image Preview Container */}
                            <Link
                                to={`/rooms/${room.id}`}
                                className="block relative lg:w-5/12 h-72 lg:h-auto min-h-[300px] overflow-hidden cursor-pointer"
                            >
                                <img
                                    src={room.image}
                                    alt={room.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-700 ease-out"
                                />
                                <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                                    <span className={`px-3.5 py-1 rounded-full text-white text-[11px] font-bold tracking-wider uppercase shadow-md ${room.tagColor}`}>
                                        {room.tag}
                                    </span>
                                    {room.subTag && (
                                        <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-medium shadow-sm">
                                            {room.subTag}
                                        </span>
                                    )}
                                </div>
                                {/* Slider Dots */}
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full">
                                    <span className="w-2 h-2 rounded-full bg-white" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                                </div>
                            </Link>
                            {/* Room Details & Pricing */}
                            <div className="p-6 lg:p-8 lg:w-7/12 flex flex-col justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                                            {room.category}
                                        </span>
                                        <div className="flex items-center text-xs font-bold text-amber-500">
                                            ★ {room.rating} <span className="text-slate-400 font-normal ml-1">({room.reviewCount})</span>
                                        </div>
                                    </div>
                                    <h2 className="font-serif text-2xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition">
                                        <Link to={`/rooms/${room.id}`} className="hover:text-blue-600 transition">
                                            {room.name}
                                        </Link>
                                    </h2>
                                    {/* Specs Row */}
                                    <div className="flex flex-wrap gap-4 py-2 border-y border-slate-100 text-xs text-slate-600 mb-4 font-medium">
                                        <span className="flex items-center gap-1.5">📐 {room.area}</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1.5">🛏️ {room.bed}</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1.5">👥 {room.capacity}</span>
                                    </div>
                                    {/* Highlights Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-600 mb-6">
                                        {room.highlights.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Price and CTA Buttons */}
                                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <span className="block text-xs text-slate-400 line-through">
                                            {room.priceOld} VND
                                        </span>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-2xl font-black text-slate-900">{room.priceCurrent}</span>
                                            <span className="text-xs font-bold text-slate-500 uppercase">VND / đêm</span>
                                        </div>
                                        <span className="text-[11px] text-emerald-600 font-medium">
                                            Đã bao gồm thuế, phí & toàn bộ dịch vụ ăn sáng
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <Link
                                            to={`/rooms/${room.id}`}
                                            className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition inline-flex items-center justify-center"
                                        >
                                            Xem Chi Tiết
                                        </Link>
                                        <Link
                                            to={`/rooms/${room.id}`}
                                            className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-xl shadow-md shadow-orange-500/25 flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition"
                                        >
                                            {room.ctaText}
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 6. PRIVILEGES COMPARISON MATRIX */}
            <section className="py-16 bg-white border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-12">
                        <span className="text-xs font-bold uppercase tracking-widest text-blue-600">Minh Bạch & Rõ Ràng</span>
                        <h3 className="font-serif text-3xl font-bold text-slate-900 mt-2">Bảng So Sánh Đặc Quyền Nghỉ Dưỡng</h3>
                        <p className="text-xs sm:text-sm text-slate-500 mt-2">
                            Khám phá chi tiết các đặc quyền cao cấp được thiết kế riêng biệt cho từng hạng phòng nghỉ tại Khách Sạn TA Đà Nẵng.
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[720px]">
                            <thead>
                                <tr className="border-b-2 border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-800">
                                    <th className="py-4 px-4 w-1/4">Đặc Quyền Dịch Vụ</th>
                                    <th className="py-4 px-4 w-1/4 text-center">Deluxe Ocean View</th>
                                    <th className="py-4 px-4 w-1/4 text-center text-blue-600 bg-blue-50/70 rounded-t-xl">
                                        Executive Club Suite
                                    </th>
                                    <th className="py-4 px-4 w-1/4 text-center text-orange-600">Presidential Villa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                                {COMPARISON_ROWS.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                                        <td className="py-4 px-4 font-semibold text-slate-900">{row.service}</td>
                                        <td className="py-4 px-4 text-center text-slate-600">{row.deluxe}</td>
                                        <td className="py-4 px-4 text-center font-semibold text-blue-700 bg-blue-50/40">
                                            {row.suite}
                                        </td>
                                        <td className="py-4 px-4 text-center font-semibold text-orange-600">{row.villa}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* 7. 5-STAR AMENITIES STANDARDS */}
            <section className="py-16 bg-slate-50 border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-12">
                        <span className="text-xs font-bold uppercase tracking-widest text-orange-600">Chất Lượng Tinh Tuyển</span>
                        <h3 className="font-serif text-3xl font-bold text-slate-900 mt-2">Tiêu Chuẩn Tiện Nghi 5 Sao Quốc Tế</h3>
                        <p className="text-xs sm:text-sm text-slate-500 mt-2">
                            Mọi căn phòng tại Khách Sạn TA Đà Nẵng đều được trang bị những vật phẩm và công nghệ hàng đầu thế giới nhằm nâng niu từng giác quan của quý khách.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center hover:shadow-md transition">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mx-auto mb-4">
                                🌿
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-base mb-2">Dưỡng Thể Hữu Cơ Pháp</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Bộ sưu tập dầu gội, sữa tắm và dưỡng thể cao cấp từ thương hiệu Diptyque Paris hoặc L'Occitane en Provence chiết xuất 100% tự nhiên.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center hover:shadow-md transition">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mx-auto mb-4">
                                🛏️
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-base mb-2">Menu Gối & Nệm Lông Vũ</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Đệm nệm đúc độc quyền Simmons Beautyrest kết hợp bộ sưu tập 6 tùy chọn gối tự nhiên (gối lông ngỗng, gối memory foam, gối oải hương thư giãn).
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center hover:shadow-md transition">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mx-auto mb-4">
                                📱
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-base mb-2">Smart Room Automation</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Hệ thống cảm biến thông minh tự điều chỉnh ánh sáng hoàng hôn, điều hòa ion lọc không khí và rèm tự động đón bình minh chỉ bằng một nút chạm.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center hover:shadow-md transition">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mx-auto mb-4">
                                ☕
                            </div>
                            <h4 className="font-serif font-bold text-slate-900 text-base mb-2">Nespresso & Bar Cao Cấp</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Máy pha cà phê Nespresso Gran Lattissima chính hãng, các viên nén tuyển chọn từ Nam Mỹ và quầy minibar được làm mới mỗi ngày.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 8. VIP CONCIERGE BOOKING REQUEST FORM */}
            <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-10">
                    <div className="max-w-xl">
                        <span className="px-3 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-bold uppercase tracking-wider mb-4 inline-block">
                            VIP Concierge 24/7
                        </span>
                        <h3 className="font-serif text-2xl sm:text-4xl font-bold leading-tight mb-4">
                            Yêu Cầu Kỳ Nghỉ Riêng Tư Hoặc Sự Kiện Đặc Biệt
                        </h3>
                        <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6 font-light">
                            Quý khách lên kế hoạch trăng mật lãng mạn, kỳ nghỉ kỷ niệm gia đình, hoặc phái đoàn cấp cao? Đội ngũ Quản gia Concierge chuyên biệt của Khách Sạn TA Đà Nẵng luôn sẵn sàng tư vấn chi tiết 24/7.
                        </p>
                        <div className="space-y-3 text-xs text-slate-200">
                            <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-amber-400">📞</span>
                                <span>Đường dây nóng trực tiếp: <strong className="text-white text-sm">1900 8899 / +84 236 388 9900</strong></span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-amber-400">✉️</span>
                                <span>Email Ban Quản Lý: <strong className="text-white">vip.reservations@tahoteldanang.com</strong></span>
                            </div>
                        </div>
                    </div>
                    {/* Form */}
                    <form onSubmit={handleSubmit} className="w-full lg:w-96 bg-white p-6 rounded-2xl text-slate-800 shadow-xl">
                        <h4 className="font-serif font-bold text-base text-slate-900 mb-4">Gửi Yêu Cầu Tư Vấn Nhanh</h4>
                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="block font-semibold text-slate-600 mb-1">Họ và tên Quý khách *</label>
                                <input
                                    type="text"
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="Nguyễn Văn A"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                                />
                            </div>
                            <div>
                                <label className="block font-semibold text-slate-600 mb-1">Số điện thoại liên hệ *</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="0901 234 567"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                                />
                            </div>
                            <div>
                                <label className="block font-semibold text-slate-600 mb-1">Hạng phòng quan tâm</label>
                                <select
                                    name="roomType"
                                    value={formData.roomType}
                                    onChange={handleInputChange}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 text-slate-700"
                                >
                                    <option>Executive Club Seafront Suite</option>
                                    <option>Presidential Beachfront Pool Villa</option>
                                    <option>Sky Royal Penthouse 360°</option>
                                    <option>Deluxe Ocean View King</option>
                                    <option>Grand Premier Oceanfront Suite</option>
                                </select>
                            </div>
                            <div>
                                <label className="block font-semibold text-slate-600 mb-1">Dịp nghỉ dưỡng</label>
                                <select
                                    name="occasion"
                                    value={formData.occasion}
                                    onChange={handleInputChange}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 text-slate-700"
                                >
                                    <option>Kỳ nghỉ gia đình / Thư giãn</option>
                                    <option>Tuần trăng mật (Honeymoon)</option>
                                    <option>Kỷ niệm ngày cưới</option>
                                    <option>Hội nghị / Công tác cao cấp</option>
                                </select>
                            </div>
                            <div>
                                <label className="block font-semibold text-slate-600 mb-1">Yêu cầu đặc biệt</label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleInputChange}
                                    rows="2"
                                    placeholder="Ngày dự kiến, số khách, xe đưa đón..."
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full mt-2 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-md transition"
                            >
                                Gửi Yêu Cầu Đến Quản Gia Trưởng
                            </button>
                        </div>
                    </form>
                </div>
            </section>

            {/* 9. FOOTER */}
            <footer className="bg-white border-t border-slate-200 pt-16 pb-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
                        {/* Col 1 */}
                        <div>
                            <Link to="/" className="flex items-center space-x-3 mb-4 inline-flex">
                                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-serif font-black text-base">
                                    TA
                                </div>
                                <span className="font-serif font-bold text-slate-900 text-base tracking-wide">
                                    KHÁCH SẠN TA ĐÀ NẴNG
                                </span>
                            </Link>
                            <p className="text-xs text-slate-500 leading-relaxed mb-4">
                                Kiệt tác nghỉ dưỡng 5 sao giao hòa giữa vẻ đẹp di sản truyền thống và kiến trúc hiện đại chuẩn quốc tế. Nơi tái định nghĩa chuẩn mực sang trọng và sự thư thái tinh khiết.
                            </p>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 inline-block text-xs">
                                <span className="font-bold text-slate-800">🏆 WINNER 2024</span>
                                <span className="block text-slate-500 text-[11px]">World Luxury Hotel Awards</span>
                            </div>
                        </div>
                        {/* Col 2 */}
                        <div>
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">Khu nghỉ dưỡng</h5>
                            <div className="space-y-3 text-xs text-slate-600">
                                <div>
                                    <strong className="block text-slate-900 font-semibold">Khách SẠn TA Đà Nẵng (Flagship)</strong>
                                    <p className="text-slate-500">08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Ngũ Hành Sơn, Đà Nẵng</p>
                                    <span className="text-blue-600 font-medium">+84 (0) 236 388 9900</span>
                                </div>
                                <div>
                                    <strong className="block text-slate-900 font-semibold">Khách Sạn TA Phú Quốc</strong>
                                    <p className="text-slate-500">Khu phức hợp Bãi Trường, Dương Tơ, TP. Phú Quốc</p>
                                    <span className="text-blue-600 font-medium">+84 (0) 297 388 9911</span>
                                </div>
                            </div>
                        </div>
                        {/* Col 3 */}
                        <div>
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">Khám phá & Dịch vụ</h5>
                            <ul className="space-y-2 text-xs text-slate-600">
                                <li><Link to="/rooms" className="hover:text-blue-600 transition">Phòng Hoàng Gia & Penthouse</Link></li>
                                <li><a href="#nha-hang" className="hover:text-blue-600 transition">Nhà hàng Michelin Starred</a></li>
                                <li><a href="#spa" className="hover:text-blue-600 transition">The Lotus Spa & Wellness</a></li>
                                <li><a href="#hoi-vien" className="hover:text-blue-600 transition">Câu lạc bộ Đặc quyền VIP</a></li>
                                <li><a href="#chinh-sach" className="hover:text-blue-600 transition">Chính sách đặt phòng & Hủy đổi</a></li>
                            </ul>
                        </div>
                        {/* Col 4 */}
                        <div>
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">Bản tin Đặc quyền</h5>
                            <p className="text-xs text-slate-500 mb-3">
                                Đăng ký nhận thông tin độc quyền về các kỳ nghỉ phiên bản giới hạn và ưu đãi hội viên VIP.
                            </p>
                            <div className="flex items-center">
                                <input
                                    type="email"
                                    placeholder="Địa chỉ email của quý khách..."
                                    className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-xs rounded-l-lg focus:outline-none focus:border-blue-600"
                                />
                                <button
                                    type="button"
                                    aria-label="Đăng ký nhận bản tin"
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-xs font-bold rounded-r-lg transition"
                                >
                                    →
                                </button>
                            </div>
                            <span className="block text-[10px] text-slate-400 mt-2">
                                Bảo mật thông tin tuyệt đối theo chuẩn quốc tế.
                            </span>
                        </div>
                    </div>
                    {/* Copyright */}
                    <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
                        <p>© 2025 Khách Sạn TA Đà Nẵng. All rights reserved.</p>
                        <div className="flex items-center space-x-6">
                            <a href="#dieu-khoan" className="hover:underline">Điều khoản dịch vụ</a>
                            <a href="#bao-mat" className="hover:underline">Chính sách bảo mật</a>
                            <a href="#so-do" className="hover:underline">Sơ đồ địa điểm</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}