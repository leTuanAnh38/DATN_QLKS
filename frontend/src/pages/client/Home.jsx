import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import FeaturedRoomCategories from '../../components/client/FeaturedRoomCategories';
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
            <Navbar />


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

            {/* 5. LIVE ROOM CATEGORIES SECTION (Connected to Django Backend PMS) */}
            <div id="phong-nghi">
                <FeaturedRoomCategories />
            </div>

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
                                    <Link to="/dining" className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                        Đặt Bàn Ngay →
                                    </Link>
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
                                    <Link to="/spa" className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                        Xem Menu Spa →
                                    </Link>
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

                                <Link
                                    to="/promotions"
                                    className={`w-full py-3 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition shadow-sm text-center block ${pkg.isHighlight
                                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/30'
                                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                                        }`}
                                >
                                    {pkg.btnText}
                                </Link>
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

            <Footer />

        </div>
    );
}