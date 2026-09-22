import React, { useState } from 'react';
import { Link } from 'react-router-dom';
// Dữ liệu danh sách phòng nghỉ
const ROOMS_DATA = [
    {
        id: "deluxe-ocean-king",
        numericId: 1,
        name: "Deluxe Ocean View King",
        tag: "Ưu Đãi -25%",
        badge: "Hướng biển 180°",
        tagColor: "bg-orange-500",
        rating: "4.92",
        reviews: "340+ đánh giá",
        tower: "Tháp Biển San Hô",
        specs: ["65 m² Không gian", "1 Giường King lớn", "Bồn tắm sục Marble", "Ban công riêng hướng vịnh"],
        oldPrice: "5.650.000",
        price: "4.238.000",
        image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: "executive-club-suite",
        numericId: 2,
        name: "Royal Executive Seafront Suite",
        tag: "Bán chạy nhất",
        tagColor: "bg-amber-600",
        rating: "4.98",
        reviews: "512 đánh giá",
        tower: "Khu vực Executive Club VIP",
        specs: ["110 m² (1 Khách + 1 Ngủ)", "Đặc quyền Executive Lounge", "Jacuzzi hướng biển ngoài trời", "Quầy Bar Rượu Vang VIP"],
        oldPrice: "9.200.000",
        price: "7.450.000",
        image: "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=800&q=80"
    },
    {
        id: "presidential-villa",
        numericId: 3,
        name: "Presidential Beachfront Pool Villa",
        tag: "Biệt thự độc bản",
        tagColor: "bg-blue-600",
        rating: "5.0",
        reviews: "189 đánh giá",
        tower: "Dinh thự độc lập mặt biển",
        specs: ["Hồ bơi vô cực riêng 45m²", "Quản gia Butler riêng 24/7", "Lối đi bãi biển riêng tư", "Bếp riêng & Đầu bếp cá nhân"],
        oldPrice: "22.000.000",
        price: "16.800.000",
        image: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80"
    }
];

// Dữ liệu các gói nghỉ dưỡng trọn gói
const PACKAGES_DATA = [
    {
        id: 'p1',
        badge: 'Phổ biến',
        name: 'Weekend Luxury Escape',
        duration: 'Gói 3N2Đ Nghỉ Cuối Tuần',
        desc: 'Tái tạo năng lượng nhanh chóng cuối tuần cho cặp đôi hoặc cá nhân bận rộn.',
        features: [
            '2 Đêm tại hạng phòng Deluxe Ocean View',
            "Buffet sáng thượng hạng hàng ngày tại L'Océan",
            'Tặng 01 tiệc trà chiều hoàng hôn High-Tea',
            'Đưa đón sân bay 2 chiều miễn phí'
        ],
        oldPrice: '12.500.000',
        price: '8.990.000',
        btnText: 'Đặt Gói Weekend',
        isHighlight: false
    },
    {
        id: 'p2',
        badge: 'Lãng mạn nhất',
        tag: 'DÀNH RIÊNG CHO CẶP ĐÔI',
        name: 'Honeymoon Serenade',
        duration: 'Gói 4N3Đ Trăng Mật',
        desc: 'Khoảnh khắc gắn kết thăng hoa với trang trí hoa tươi, nến và du thuyền.',
        features: [
            '3 Đêm tại Royal Executive Seafront Suite',
            '01 Bữa tối nến lãng mạn trên bãi biển riêng tư',
            '01 Tour du thuyền Catamaran ngắm hoàng hôn vịnh biển',
            'Liệu trình Lotus Spa đôi 90 phút & Chai Champagne Moët'
        ],
        oldPrice: '26.000.000',
        price: '19.500.000',
        btnText: 'Đặt Kỳ Nghỉ Trăng Mật',
        isHighlight: true
    },
    {
        id: 'p3',
        badge: 'Trọn gói',
        name: 'Family Harmony Vacation',
        duration: 'Gói 4N3Đ Gia Đình Đa Thế Hệ',
        desc: 'Trọn vẹn niềm vui sum vầy với câu lạc bộ trẻ em TA Kids và tiệc BBQ sân vườn.',
        features: [
            '3 Đêm tại 2-Bedroom Beachfront Pool Villa',
            '01 Tiệc nướng hải sản BBQ riêng tại sân vườn Villa',
            'Không giới hạn vé tham gia TA Kids Club & Lớp nấu ăn',
            'Xe đưa đón Mercedes Benz cỡ lớn dành cho cả nhà'
        ],
        oldPrice: '42.000.000',
        price: '29.800.000',
        btnText: 'Đặt Gói Gia Đình',
        isHighlight: false
    }
];

export default function TADaNangHotelLanding() {
    const [activeCategory, setActiveCategory] = useState('Tất cả (16)');
    const [bookingType, setBookingType] = useState('night');

    const categories = [
        'Tất cả (16)',
        'Deluxe Ocean',
        'Executive Suite',
        'Presidential Villa',
        'Sky Penthouse'
    ];

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
                            <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            The Leading Hotels of the World
                        </span>
                    </div>
                    <div className="flex items-center space-x-4 text-slate-300">
                        <span className="flex items-center gap-1.5 hover:text-white cursor-pointer transition">
                            <svg className="w-3.5 h-3.5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
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
                    {/* Brand Logo */}
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
                        <Link to="/" className="text-blue-600 font-semibold border-b-2 border-blue-600 pb-1">Trang chủ</Link>
                        <Link to="/rooms" className="hover:text-blue-600 transition">Phòng nghỉ & Suites</Link>
                        <a href="#am-thuc" className="hover:text-blue-600 transition">Ẩm thực & Bar</a>
                        <a href="#dich-vu-spa" className="hover:text-blue-600 transition">Dịch vụ Spa</a>
                        <a href="#uu-dai" className="hover:text-blue-600 transition">Ưu đãi đặc quyền</a>
                        <a href="#lien-he" className="hover:text-blue-600 transition">Liên hệ</a>
                    </nav>

                    {/* Header Actions */}
                    <div className="flex items-center space-x-4">
                        <Link to="/rooms" className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium text-sm rounded-lg shadow-md shadow-orange-500/20 hover:shadow-lg transition-all duration-200">
                            Đặt phòng ngay
                        </Link>
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

            {/* 3. HERO SECTION */}
            <section className="relative min-h-[560px] lg:h-[620px] flex items-center justify-center bg-slate-900 overflow-hidden">
                {/* Hero Background Image with Overlay */}
                <div className="absolute inset-0 z-0">
                    <img
                        src="https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1920&q=80"
                        alt="Khách Sạn TA Đà Nẵng Resort"
                        className="w-full h-full object-cover opacity-45 scale-105 transition duration-1000 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent" />
                </div>

                {/* Hero Content */}
                <div className="relative z-10 max-w-5xl mx-auto px-4 text-center text-white py-16">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs uppercase tracking-widest text-amber-300 font-semibold mb-6">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        Kỳ nghỉ thượng lưu đích thực • Chuẩn 5 sao quốc tế
                    </div>

                    <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight sm:leading-tight mb-6">
                        Khởi Đầu Kỳ Nghỉ Thượng Lưu Đích Thực <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-sky-200 to-amber-200">
                            Tại Khách Sạn TA Đà Nẵng
                        </span>
                    </h1>

                    <p className="text-base sm:text-lg text-slate-200 max-w-2xl mx-auto mb-8 font-light leading-relaxed">
                        Nơi vẻ đẹp hùng vĩ của biển Mỹ Khê hòa quyện tinh hoa kiến trúc nghỉ dưỡng đương đại.
                        Trải nghiệm dịch vụ quản gia 24/7 và sự thanh tĩnh tuyệt đối.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-slate-300">
                        <span className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Đảm bảo giá trực tiếp tốt nhất
                        </span>
                        <span className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Miễn phí linh hoạt đổi hủy 24h
                        </span>
                        <span className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Đưa đón sân bay VIP Mercedes-Benz
                        </span>
                    </div>
                </div>
            </section>

            {/* 4. FLOATING BOOKING SEARCH BAR WIDGET */}
            <div className="relative z-20 max-w-7xl mx-auto px-4 -mt-16 sm:-mt-20">
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-100 p-4 sm:p-6">
                    {/* Tab Selection */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-100">
                        <div className="flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900">
                                Đặt phòng nhanh trực tiếp • Nhận đặc quyền VIP
                            </span>
                        </div>

                        <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium">
                            <button
                                onClick={() => setBookingType('night')}
                                className={`px-3 py-1.5 rounded-md transition ${bookingType === 'night' ? 'bg-white text-blue-600 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Theo đêm
                            </button>
                            <button
                                onClick={() => setBookingType('package')}
                                className={`px-3 py-1.5 rounded-md transition ${bookingType === 'package' ? 'bg-white text-blue-600 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Theo gói trọn gói
                            </button>
                            <button
                                onClick={() => setBookingType('business')}
                                className={`px-3 py-1.5 rounded-md transition ${bookingType === 'business' ? 'bg-white text-blue-600 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Doanh nghiệp / Đoàn
                            </button>
                        </div>
                    </div>

                    {/* Form Fields Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {/* Field 1: Destination */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-500 transition">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Điểm đến / Chi nhánh
                            </label>
                            <div className="text-sm font-semibold text-slate-900 truncate">
                                Khách Sạn TA Đà Nẵng
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                                Biệt thự biển & Sky Suites
                            </div>
                        </div>

                        {/* Field 2: Check-in */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-500 transition">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Nhận phòng
                            </label>
                            <div className="text-sm font-semibold text-slate-900">
                                15/06/2025
                            </div>
                            <div className="text-xs text-slate-500">Chủ Nhật</div>
                        </div>

                        {/* Field 3: Check-out */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-500 transition">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Trả phòng
                            </label>
                            <div className="text-sm font-semibold text-slate-900">
                                18/06/2025
                            </div>
                            <div className="text-xs text-slate-500">3 Đêm lưu trú</div>
                        </div>

                        {/* Field 4: Guests & Rooms */}
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-500 transition">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                Khách & Số phòng
                            </label>
                            <div className="text-sm font-semibold text-slate-900">
                                2 Người lớn, 1 Trẻ em
                            </div>
                            <div className="text-xs text-blue-600 font-medium">1 Hạng Suite Hoàng Gia</div>
                        </div>

                        {/* Field 5: Action Button */}
                        <div className="flex flex-col justify-end">
                            <Link to="/rooms" className="w-full h-full min-h-[52px] bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                Tìm Phòng Trống
                            </Link>
                        </div>
                    </div>

                    {/* Quick Perks Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-6 text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">Đặc quyền đặt trực tuyến:</span>
                        <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                            🎁 Buffet sáng quốc tế mỗi ngày
                        </span>
                        <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                            💎 1.000.000 VND Voucher Lotus Spa
                        </span>
                        <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                            ⏰ Check-in sớm & Late Check-out tới 15:00
                        </span>
                    </div>
                </div>
            </div>

            {/* 5. ROOMS & SUITES SECTION */}
            <section id="phong-nghi" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto mb-12">
                    <div className="text-xs uppercase font-bold tracking-widest text-blue-600 mb-2">
                        BỘ SƯU TẬP KHÔNG GIAN NGHỈ DƯỠNG
                    </div>
                    <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                        Hạng Phòng & Dinh Thự Hoàng Gia
                    </h2>
                    <p className="text-slate-600 text-sm sm:text-base">
                        Được thiết kế tinh xảo từ gỗ teak tự nhiên, đá cẩm thạch Ý và ban công khoáng đạt hướng trọn vẹn vịnh biển trong xanh.
                    </p>
                </div>

                {/* Filter Pill Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition ${activeCategory === cat
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Room Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {ROOMS_DATA.map((room) => (
                        <div
                            key={room.id}
                            className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group"
                        >
                            {/* Card Image Container */}
                            <div className="relative h-64 overflow-hidden">
                                <Link to={`/rooms/${room.id}`} className="block w-full h-full">
                                    <img
                                        src={room.image}
                                        alt={room.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500 ease-out cursor-pointer"
                                    />
                                </Link>
                                <div className="absolute top-3 left-3 flex flex-wrap gap-2 pointer-events-none">
                                    <span className={`px-3 py-1 rounded-full text-white text-[11px] font-bold tracking-wide shadow-sm ${room.tagColor}`}>
                                        {room.tag}
                                    </span>
                                    {room.badge && (
                                        <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-medium shadow-sm">
                                            {room.badge}
                                        </span>
                                    )}
                                </div>
                                <button
                                    aria-label="Thêm vào yêu thích"
                                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-700 hover:text-red-500 transition shadow-sm"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                </button>
                            </div>

                            {/* Card Body */}
                            <div className="p-6 flex-1 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                                        <span className="font-semibold text-blue-600 uppercase tracking-wider">{room.tower}</span>
                                        <span className="flex items-center text-amber-500 font-bold">
                                            ★ {room.rating} <span className="text-slate-400 font-normal ml-1">({room.reviews})</span>
                                        </span>
                                    </div>

                                    <h3 className="font-serif text-lg font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition">
                                        <Link to={`/rooms/${room.id}`} className="hover:text-blue-600 transition">
                                            {room.name}
                                        </Link>
                                    </h3>

                                    {/* Specs Grid */}
                                    <div className="grid grid-cols-2 gap-2 mb-6 text-xs text-slate-600">
                                        {room.specs.map((spec, idx) => (
                                            <div key={idx} className="flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span className="truncate">{spec}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Pricing & CTA */}
                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <div>
                                        <span className="block text-xs line-through text-slate-400 font-normal">
                                            {room.oldPrice} VND
                                        </span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-xl font-black text-slate-900">{room.price}</span>
                                            <span className="text-[11px] font-bold text-slate-500 uppercase">VND / đêm</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Link to={`/rooms/${room.id}`} className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition">
                                            Chi tiết
                                        </Link>
                                        <Link to={`/rooms/${room.id}`} className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-600/30 flex items-center gap-1 transition">
                                            Đặt ngay
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

                {/* View All Rooms Button */}
                <div className="text-center mt-10">
                    <Link
                        to="/rooms"
                        className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/25 transition hover:scale-[1.02] active:scale-[0.98]"
                    >
                        Xem Toàn Bộ Danh Sách Phòng & Suites
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </Link>
                </div>

                {/* Custom Booking Assistance Banner */}
                <div className="mt-12 bg-blue-50 border border-blue-100 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
                            💎
                        </div>
                        <div>
                            <h4 className="font-serif font-bold text-slate-900 text-base">Cần phòng hội nghị lớn, tiệc cưới hoặc sự kiện đoàn cao cấp?</h4>
                            <p className="text-xs sm:text-sm text-slate-600">Đội ngũ chuyên viên sự kiện của Khách Sạn TA Đà Nẵng sẵn sàng kiến tạo không gian theo phong cách riêng của quý vị.</p>
                        </div>
                    </div>
                    <button className="whitespace-nowrap px-6 py-2.5 bg-white text-blue-600 font-semibold text-xs sm:text-sm border border-blue-200 hover:bg-blue-600 hover:text-white rounded-xl shadow-sm transition">
                        Tư Vấn Thiết Kế Kỳ Nghỉ Đoàn
                    </button>
                </div>
            </section>

            {/* 6. EXPERIENCES & AMENITIES */}
            <section id="dich-vu-spa" className="py-20 bg-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <div className="text-xs uppercase font-bold tracking-widest text-orange-600 mb-2">
                            ĐẶC QUYỀN TRẢI NGHIỆM ĐẲNG CẤP
                        </div>
                        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                            Nghệ Thuật Tận Hưởng Không Giới Hạn
                        </h2>
                        <p className="text-slate-600 text-sm sm:text-base">
                            Mỗi khoảnh khắc tại Khách Sạn TA Đà Nẵng đều được dày công biên soạn để đánh thức mọi giác quan và phục hồi năng lượng sống thuần khiết.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Feature 1 */}
                        <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition group">
                            <div className="relative h-64 overflow-hidden">
                                <img
                                    src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80"
                                    alt="Nhà Hàng Biển L'Océan"
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                />
                                <span className="absolute top-4 left-4 bg-red-600 text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase">
                                    Michelin Selected
                                </span>
                            </div>
                            <div className="p-6">
                                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Ẩm thực đỉnh cao</span>
                                <h3 className="font-serif text-xl font-bold text-slate-900 mt-1 mb-2">Nhà Hàng Biển L'Océan & Horizon Sky Lounge</h3>
                                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4">
                                    Hương vị tinh tuyển từ hải sản tươi sống đánh bắt trong ngày hòa tấu cùng nghệ thuật ẩm thực đương đại của các bếp trưởng hàng đầu thế giới, kết hợp bộ sưu tập hơn 400 loại vang quý hiếm.
                                </p>
                                <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
                                    <span className="text-slate-500">Phục vụ: 06:30 - 23:30 hàng ngày</span>
                                    <a href="#dat-ban" className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                        Đặt Bàn Ngay →
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Feature 2 */}
                        <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition group">
                            <div className="relative h-64 overflow-hidden">
                                <img
                                    src="https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80"
                                    alt="The Lotus Spa"
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                />
                                <span className="absolute top-4 left-4 bg-emerald-600 text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase">
                                    Liệu pháp thảo dược
                                </span>
                            </div>
                            <div className="p-6">
                                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Thư giãn & Phục hồi thân - tâm</span>
                                <h3 className="font-serif text-xl font-bold text-slate-900 mt-1 mb-2">The Lotus Spa & Onsen Khoáng Nóng Tự Nhiên</h3>
                                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4">
                                    Phương pháp bấm huyệt cổ truyền Á Đông kết hợp bồn ngâm khoáng nóng Onsen tinh khiết giúp thải độc sâu, xua tan căng thẳng và mang lại giấc ngủ trọn vẹn.
                                </p>
                                <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs">
                                    <span className="text-slate-500">12 Phòng Trị Liệu VIP Riêng Biệt</span>
                                    <a href="#menu-spa" className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                        Xem Menu Spa →
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 7. EXCLUSIVE PACKAGES & OFFERS */}
            <section id="uu-dai" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <div className="text-xs uppercase font-bold tracking-widest text-blue-600 mb-2">
                        GÓI NGHỈ DƯỠNG THIẾT KẾ ĐỘC QUYỀN
                    </div>
                    <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                        Kỳ Nghỉ Trọn Vẹn • Tiết Kiệm Tới 35%
                    </h2>
                    <p className="text-slate-600 text-sm sm:text-base">
                        Các gói kỳ nghỉ được tích hợp trọn vẹn vé máy bay, du thuyền ngắm hoàng hôn, spa và ẩm thực không phụ phí phát sinh.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {PACKAGES_DATA.map((pkg) => (
                        <div
                            key={pkg.id}
                            className={`rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 ${pkg.isHighlight
                                    ? 'bg-white border-2 border-orange-500 shadow-2xl relative scale-105'
                                    : 'bg-white border border-slate-200 shadow-sm hover:shadow-md'
                                }`}
                        >
                            {pkg.isHighlight && (
                                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[11px] font-black rounded-full uppercase tracking-wider shadow-md">
                                    {pkg.tag}
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">{pkg.duration}</span>
                                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-md">{pkg.badge}</span>
                                </div>

                                <h3 className="font-serif text-xl font-bold text-slate-900 mb-2">{pkg.name}</h3>
                                <p className="text-xs text-slate-500 mb-6">{pkg.desc}</p>

                                <ul className="space-y-3 mb-8 text-xs text-slate-600">
                                    {pkg.features.map((feat, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                            <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            <span>{feat}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="pt-6 border-t border-slate-100">
                                <span className="block text-xs line-through text-slate-400 font-normal">
                                    {pkg.oldPrice} VND
                                </span>
                                <div className="flex items-baseline gap-1 mb-4">
                                    <span className="text-2xl font-black text-slate-900">{pkg.price}</span>
                                    <span className="text-xs font-bold text-slate-500">VND / Gói</span>
                                </div>

                                <button
                                    className={`w-full py-3 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition shadow-sm ${pkg.isHighlight
                                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/30'
                                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                                        }`}
                                >
                                    {pkg.btnText}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 8. VIP CLUB MEMBERSHIP CTA BANNER */}
            <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-sky-600 rounded-3xl p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-8">
                    <div className="max-w-2xl">
                        <span className="px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-widest text-amber-300 inline-block mb-4">
                            TA CLUB • ĐẶC QUYỀN HỘI VIÊN
                        </span>
                        <h3 className="font-serif text-2xl sm:text-4xl font-bold mb-4">
                            Sẵn Sàng Cho Kỳ Nghỉ Trong Mơ Của Quý Vị Tại Khách Sạn TA Đà Nẵng?
                        </h3>
                        <p className="text-slate-100 text-sm sm:text-base mb-6 leading-relaxed">
                            Đăng ký tham gia câu lạc bộ thành viên TA Club để nhận ngay đặc quyền giảm 10% cho lần đặt phòng đầu tiên, nâng cấp hạng phòng miễn phí và phòng chờ sân bay riêng.
                        </p>
                        <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-200">
                            <span>✓ Tích lũy dặm bay & đêm nghỉ</span>
                            <span>✓ Tặng quà sinh nhật thượng lưu</span>
                            <span>✓ Bảo chứng chất lượng toàn cầu</span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row lg:flex-col gap-4 w-full lg:w-auto flex-shrink-0">
                        <Link to="/rooms" className="px-8 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-xl transition text-center whitespace-nowrap">
                            🎁 Đặt Phòng Nhận Ưu Đãi Ngay
                        </Link>
                        <button className="px-8 py-3.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 text-white font-semibold text-sm rounded-xl transition text-center whitespace-nowrap">
                            📞 Gọi Hotline VIP: 1900 8899
                        </button>
                    </div>
                </div>
            </section>

            {/* 9. FOOTER */}
            <footer className="bg-white border-t border-slate-200 pt-16 pb-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
                        {/* Col 1: Hotel Brand Info */}
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

                        {/* Col 2: Locations */}
                        <div>
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">Khu nghỉ dưỡng</h5>
                            <div className="space-y-3 text-xs text-slate-600">
                                <div>
                                    <strong className="block text-slate-900 font-semibold">Khách Sạn TA Đà Nẵng (Flagship)</strong>
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

                        {/* Col 3: Services & Policies */}
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

                        {/* Col 4: Newsletter */}
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

                    {/* Copyright & Legal Links */}
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