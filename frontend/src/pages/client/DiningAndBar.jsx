import React, { useState } from 'react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';

export default function DiningAndBarPage() {
    const [activeCategory, setActiveCategory] = useState('all');
    const [activeFaq, setActiveFaq] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        email: '',
        venue: 'locean',
        tableType: 'window',
        date: '2026-09-25',
        mealTime: 'dinner-sunset',
        guests: '2',
        specialRequests: '',
        airportShuttle: false,
        sommelierConsult: false,
        isClubMember: true
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Venue Categories
    const categories = [
        { id: 'all', label: 'Tất cả địa điểm' },
        { id: 'finedining', label: 'Fine Dining Âu - Á' },
        { id: 'seafood', label: 'Hải Sản Tươi Sống' },
        { id: 'skybar', label: 'Sky Bar & Lounge' },
        { id: 'hightea', label: 'Trà Chiều Hoàng Hôn' }
    ];

    // Venues List
    const venues = [
        {
            id: 'locean',
            category: 'finedining',
            tag: 'Tầng 3 • Fine Dining',
            badge: 'Michelin Selected',
            title: "Nhà Hàng L'Océan",
            subtitle: 'Pháp - Việt Hiện Đại',
            description: 'Đỉnh cao nghệ thuật giao thoa ẩm thực Pháp tinh tế và thảo mộc Việt Nam thuần khiết. Không gian kiến trúc đại dương với hầm rượu vang Grand Cru danh giá.',
            hours: '11:30 - 14:00 | 18:00 - 22:30',
            dressCode: 'Elegant Smart Casual',
            signature: 'Súp Tôm Hùm Saffron & Bò Rossini Truffle',
            priceText: 'Từ 1.850.000đ / Khách',
            actionLabel: "Đặt bàn L'Océan",
            image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=80',
            badgeSpecial: 'Thực đơn nếm thử 7 món'
        },
        {
            id: 'vinhxanh',
            category: 'seafood',
            tag: 'Sân Vườn Sát Biển',
            badge: 'Hải Sản Sống',
            title: 'Hải Sản Vịnh Xanh',
            subtitle: 'Ocean Seafood Market',
            description: 'Chợ hải sản sống thượng hạng bên bờ sóng. Tự tay lựa chọn Tôm hùm bông, Cua Huỳnh Đế, Cá mú đỏ và thưởng thức nướng than hoa hương vị miền Trung trứ danh.',
            hours: '10:30 - 23:00 (Cả ngày)',
            dressCode: 'Resort Casual thoải mái',
            signature: 'Cua Huỳnh Đế Hấp Rượu Vang & Sò Điệp Nướng Mỡ Hành',
            priceText: 'Theo thời giá hải sản',
            actionLabel: 'Đặt bàn Vịnh Xanh',
            image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=700&q=80',
            badgeSpecial: 'Chế biến theo yêu cầu'
        },
        {
            id: 'skyhorizon',
            category: 'skybar',
            tag: 'Tầng 28 • Rooftop',
            badge: 'Sunset DJ Set',
            title: 'TA Sky Horizon Bar',
            subtitle: 'Cocktail & DJ Sunset',
            description: 'Quầy bar tầng thượng cao nhất bãi biển Mỹ Khê. Thưởng thức các ly cocktail signature lấy cảm hứng từ gia vị duyên hải và giai điệu Deep House ngắm hoàng hôn buông xuống.',
            hours: '16:30 - 01:00 Sáng',
            dressCode: 'Smart Casual / Party Chic',
            signature: 'Cocktail Sơn Trà Mint & Tapas Bò Wagyu',
            priceText: 'Từ 220.000đ / Cocktail',
            actionLabel: 'Đặt bàn Sky Bar',
            image: 'https://images.unsplash.com/photo-1574096079513-d8259312b785?auto=format&fit=crop&w=700&q=80',
            badgeSpecial: 'View vịnh 360 độ'
        },
        {
            id: 'palmgarden',
            category: 'hightea',
            tag: 'Sảnh Thông Tầng',
            badge: 'High Tea',
            title: 'The Palm Garden Lounge',
            subtitle: 'Trà Chiều Hoàng Gia',
            description: 'Lắng đọng cùng thanh âm piano du dương giữa ốc đảo xanh. Trải nghiệm tiệc trà chiều quý tộc với bánh ngọt thủ công kiểu Pháp, scone ấm giòn và hơn 30 loại trà mộc thượng hạng.',
            hours: '08:00 - 22:00 (Trà chiều: 14:00 - 17:30)',
            dressCode: 'Comfortable Elegance',
            signature: 'Imperial High Tea & Bánh Macaron Sen Huế',
            priceText: '650.000đ / Set 2 khách',
            actionLabel: 'Đặt tiệc trà chiều',
            image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=700&q=80',
            badgeSpecial: 'Vườn nhiệt đới yên ả'
        }
    ];

    // Signature Dishes
    const signatureDishes = [
        {
            tag: 'Signature #1',
            title: 'Tôm Hùm Mỹ Khê Đút Lò Bơ Tỏi Rừng Sơn Trà',
            desc: 'Tôm hùm bông tươi sống đút lò bơ thảo mộc rừng Sơn Trà và muối...',
            venue: "L'Océan & Vịnh Xanh",
            price: '1.450.000 VND',
            image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=500&q=80'
        },
        {
            tag: 'Signature #2',
            title: 'Bò Wagyu A5 Nướng Đá Muối Núi Lửa & Nấm Truffle',
            desc: 'Bò Wagyu Miyazaki thượng hạng nướng trực tiếp tại bàn trên phiến đá...',
            venue: "Nhà hàng L'Océan",
            price: '1.850.000 VND',
            image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=500&q=80'
        },
        {
            tag: 'Signature #3',
            title: 'Gỏi Cá Mai Bờ Biển TA Phong Cách Omakase',
            desc: 'Cá mai đánh bắt trong sương mai, kết hợp thính gạo rang cổ truyền, chan...',
            venue: 'Hải Sản Vịnh Xanh',
            price: '680.000 VND',
            image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=500&q=80'
        },
        {
            tag: 'Signature #4',
            title: 'Tráng Miệng Sen Ngọc & Vàng 24K Hoàng Tộc',
            desc: 'Mousse hạt sen Tịnh Tâm kết hợp socola trắng Valrhona, phủ lá vàng...',
            venue: 'The Palm & Sky Lounge',
            price: '320.000 VND',
            image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=500&q=80'
        }
    ];

    // FAQ list
    const faqs = [
        {
            q: 'Quy định về trang phục (Dress Code) tại các nhà hàng như thế nào?',
            a: "Tại nhà hàng Fine Dining L'Océan và TA Sky Horizon Bar sau 18:00, quý khách vui lòng diện trang phục lịch sự (Smart Casual - tránh mặc áo ba lỗ, đồ bơi hoặc dép xỏ ngón). Tại Nhà hàng Hải Sản Vịnh Xanh sát biển, trang phục dạo biển thoải mái hoàn toàn được chào đón."
        },
        {
            q: 'Chính sách mang rượu từ bên ngoài vào (Corkage fee) ra sao?',
            a: 'Khách sạn có áp dụng phí phục vụ rượu (corkage fee) đối với vang tiêu chuẩn và rượu mạnh ngoại nhập để phục vụ ly pha lê Riedel cao cấp và chuyên viên Sommelier chăm sóc. Khách lưu trú phòng Tổng Thống và hội viên Diamond được miễn phí 01 chai vang.'
        },
        {
            q: 'Khách sạn có phòng ăn riêng biệt (VIP Dining Room) cho tiệc kín không?',
            a: "Nhà hàng L'Océan và Vịnh Xanh có sẵn 4 phòng ăn VIP sức chứa từ 8 đến 24 khách với lối đi riêng tư, ban công nhìn thẳng ra biển và đội ngũ phục vụ riêng biệt, thích hợp cho tiếp khách ngoại giao hoặc họp mặt gia đình ấm cúng."
        },
        {
            q: 'Nhà hàng có thực đơn cho trẻ em, người ăn chay hoặc dị ứng thực phẩm không?',
            a: 'Đội ngũ bếp luôn chuẩn bị sẵn thực đơn chay thuần (Plant-based), Halal, không chứa Gluten và thực đơn dinh dưỡng riêng cho trẻ em. Quý khách chỉ cần thông báo trong phần ghi chú khi đặt bàn để Bếp trưởng chuẩn bị chỉn chu nhất.'
        }
    ];

    const filteredVenues = activeCategory === 'all'
        ? venues
        : venues.filter(v => v.category === activeCategory);

    const handleSelectVenue = (venueId) => {
        setFormData({ ...formData, venue: venueId });
        const bookingSection = document.getElementById('dat-ban-form');
        if (bookingSection) {
            bookingSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleSubmitBooking = (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setTimeout(() => {
            setIsSubmitting(false);
            alert(`Đã nhận yêu cầu đặt bàn thành công của Quý khách: ${formData.fullName}! Đội ngũ F&B Khách Sạn TA Đà Nẵng sẽ liên hệ xác nhận trong vòng 15 phút.`);
        }, 800);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white">
            {/* Reusable Navbar */}
            <Navbar
                actionText="📅 Đặt bàn ngay"
                actionLink="#dat-ban-form"
                onActionClick={() => {
                    const el = document.getElementById('dat-ban-form');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
            />


            {/* 3. HERO SPOTLIGHT SECTION */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-sm">
                    <div className="lg:col-span-7">
                        <span className="inline-block px-3.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-xs font-bold uppercase tracking-wider mb-4">
                            🍷 Tinh hoa ẩm thực mỹ vị đại dương & quốc tế
                        </span>
                        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight mb-3">
                            Hành Trình Vị Giác
                        </h1>
                        <p className="font-serif text-3xl sm:text-4xl lg:text-5xl text-blue-600 italic font-medium mb-5">
                            Thăng Hoa Bên Bờ Biển Mỹ Khê
                        </p>
                        <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-8 max-w-xl">
                            Hòa quyện phong vị biển nhiệt đới thuần khiết cùng kỹ nghệ ẩm thực đương đại. 4 không gian độc bản được sáng tạo bởi các bếp trưởng danh tiếng chuẩn Michelin Selected, mở ra dạ tiệc xúc cảm bất tận.
                        </p>
                        <div className="flex flex-wrap gap-4 mb-10">
                            <button
                                type="button"
                                onClick={() => {
                                    const el = document.getElementById('dat-ban-form');
                                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="px-6 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all"
                            >
                                🍽️ Đặt Bàn Trực Tuyến Ngay
                            </button>
                            <a
                                href="#menu-pdf"
                                className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm rounded-xl border border-slate-200 transition flex items-center gap-2"
                            >
                                <span>📖</span>
                                <span>Khám Phá Menu A La Carte (PDF)</span>
                            </a>
                        </div>

                        {/* 4 Pillars Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-slate-100">
                            <div>
                                <strong className="block text-blue-600 text-2xl font-bold">04</strong>
                                <span className="text-[11px] text-slate-500">Không gian ẩm thực độc bản</span>
                            </div>
                            <div>
                                <strong className="block text-blue-600 text-2xl font-bold">03</strong>
                                <span className="text-[11px] text-slate-500">Bếp trưởng Michelin Selected</span>
                            </div>
                            <div>
                                <strong className="block text-blue-600 text-2xl font-bold">1.200+</strong>
                                <span className="text-[11px] text-slate-500">Chai vang Grand Cru lưu trữ</span>
                            </div>
                            <div>
                                <strong className="block text-blue-600 text-2xl font-bold">100%</strong>
                                <span className="text-[11px] text-slate-500">Hải sản tươi sống trong ngày</span>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-5 relative">
                        <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white h-[420px] sm:h-[480px]">
                            <img
                                src="https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1000&q=80"
                                alt="Culinary Masterpiece TA Da Nang"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        {/* Overlaid Michelin Badge */}
                        <div className="absolute top-4 right-4 bg-red-600 text-white rounded-xl px-3 py-1.5 shadow-lg flex items-center gap-2 text-xs font-bold">
                            <span>★</span>
                            <span>MICHELIN GUIDE Selected 2024</span>
                        </div>
                        {/* Overlaid Quote Card */}
                        <div className="absolute -bottom-6 -left-6 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-200 max-w-xs hidden sm:flex items-center gap-3">
                            <img
                                src="https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=120&q=80"
                                alt="Chef Antoine Nguyen"
                                className="w-12 h-12 rounded-full object-cover shrink-0 border border-slate-200"
                            />
                            <div>
                                <p className="text-[11px] text-slate-700 italic leading-snug font-serif">
                                    "Hương vị đại dương là tác phẩm nghệ thuật sống động nhất."
                                </p>
                                <span className="text-[10px] text-slate-400 block mt-1 font-sans">
                                    Chef Antoine Nguyễn – Giám Đốc Ẩm Thực
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. VENUES SHOWCASE SECTION (FILTER + 4 VENUES) */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6 mb-8">
                    <div>
                        <span className="text-xs uppercase font-bold tracking-widest text-orange-500">
                            Bộ sưu tập không gian ẩm thực
                        </span>
                        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900 mt-1">
                            Bốn Trải Nghiệm Thưởng Vị Độc Bản
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1">
                            Mỗi nhà hàng và quán bar là một điểm chạm vị giác riêng biệt, từ không gian biển mở lộng gió đến tầng thượng ôm trọn đường chân trời vịnh Đà Nẵng.
                        </p>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex flex-wrap gap-2">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setActiveCategory(cat.id)}
                                className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${activeCategory === cat.id
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                                    }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2x2 Grid of Venues */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {filteredVenues.map((venue) => (
                        <div
                            key={venue.id}
                            className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                        >
                            <div>
                                <div className="relative h-64 overflow-hidden">
                                    <img
                                        src={venue.image}
                                        alt={venue.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent" />
                                    <div className="absolute top-4 left-4 flex gap-2">
                                        <span className="px-3 py-1 rounded-full bg-blue-600/90 text-white text-[11px] font-bold shadow-sm">
                                            {venue.tag}
                                        </span>
                                        <span className="px-3 py-1 rounded-full bg-amber-500 text-slate-900 text-[11px] font-bold shadow-sm">
                                            {venue.badge}
                                        </span>
                                    </div>
                                    <span className="absolute bottom-4 right-4 text-[11px] font-medium text-white/95 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg">
                                        {venue.badgeSpecial}
                                    </span>
                                </div>
                                <div className="p-6 sm:p-7">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h3 className="font-serif font-bold text-slate-900 text-2xl group-hover:text-blue-600 transition">
                                            {venue.title}
                                        </h3>
                                        <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-md shrink-0">
                                            {venue.subtitle}
                                        </span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5">
                                        {venue.description}
                                    </p>
                                    <div className="space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-700">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400">🕒</span>
                                            <span>{venue.hours}</span>
                                            <span className="text-slate-300">|</span>
                                            <span className="text-slate-400">👔</span>
                                            <span>{venue.dressCode}</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-amber-500">★</span>
                                            <span><strong>Món đặc trưng:</strong> {venue.signature}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 sm:p-7 pt-0 border-t border-slate-100 mt-2">
                                <div className="flex items-center justify-between pt-4">
                                    <button
                                        type="button"
                                        onClick={() => handleSelectVenue(venue.id)}
                                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition flex items-center gap-1.5"
                                    >
                                        <span>🍴</span>
                                        <span>{venue.actionLabel}</span>
                                    </button>
                                    <span className="font-serif font-bold text-base sm:text-lg text-slate-900">
                                        {venue.priceText}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 5. CHEF'S SIGNATURE DISHES (4 CARDS) */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>
                        <span className="text-xs uppercase font-bold tracking-widest text-orange-500">
                            Tuyệt tác mỹ vị độc quyền
                        </span>
                        <h2 className="font-serif text-3xl font-bold text-slate-900 mt-1">
                            Mỹ Vị Tinh Tuyển Của Tổng Bếp Trưởng
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1">
                            Những sáng tạo nghệ thuật tôn vinh nguồn liệu địa phương quý hiếm và kỹ thuật ẩm thực bậc thầy.
                        </p>
                    </div>
                    <div className="text-xs text-slate-600 bg-white px-3.5 py-2 rounded-xl border border-slate-200 flex items-center gap-2">
                        <span>🌿</span>
                        <span>Nguyên liệu tươi nhập mới mỗi sớm</span>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {signatureDishes.map((dish, idx) => (
                        <div
                            key={idx}
                            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition flex flex-col justify-between group"
                        >
                            <div>
                                <div className="relative h-44 overflow-hidden">
                                    <img
                                        src={dish.image}
                                        alt={dish.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                    />
                                    <span className="absolute top-3 right-3 bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                                        {dish.tag}
                                    </span>
                                </div>
                                <div className="p-4">
                                    <h4 className="font-serif font-bold text-slate-900 text-sm mb-1.5 group-hover:text-blue-600 transition leading-snug">
                                        {dish.title}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                                        {dish.desc}
                                    </p>
                                </div>
                            </div>
                            <div className="p-4 pt-0 border-t border-slate-100 flex items-end justify-between mt-2">
                                <div>
                                    <span className="text-[10px] text-slate-400 block">{dish.venue}</span>
                                    <span className="text-xs font-bold text-blue-600">{dish.price}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 6. SUMMER & CLUB MEMBER PROMO BANNER */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 sm:p-12 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl shrink-0">
                            🍷
                        </div>
                        <div>
                            <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider mb-2 inline-block">
                                Đặc quyền hội viên TA Club & Ưu đãi mùa hè
                            </span>
                            <h3 className="font-serif text-2xl sm:text-3xl font-bold">
                                Giảm 15% Toàn Bộ Menu & Tặng 01 Chai Vang Ý Prosecco
                            </h3>
                            <p className="text-blue-100 text-xs sm:text-sm mt-2 max-w-xl">
                                Áp dụng cho tiệc đặt từ 4 khách khi đặt bàn trực tuyến trước 18:00 mỗi ngày. Miễn phí nâng cấp vị trí bàn VIP sát cửa kính ngắm biển hoặc phòng tiệc hoa tươi riêng biệt.
                            </p>
                        </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-center sm:items-end gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                const el = document.getElementById('dat-ban-form');
                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="px-6 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition"
                        >
                            Áp Dụng Ưu Đãi Ngay
                        </button>
                        <span className="text-[11px] text-blue-200">Mã kích hoạt tự động qua SĐT</span>
                    </div>
                </div>
            </section>

            {/* 7. ONLINE TABLE RESERVATION FORM */}
            <section id="dat-ban-form" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-12">
                    <div className="text-center mb-8">
                        <span className="inline-block px-3.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold uppercase tracking-wider mb-2">
                            🛡️ Dịch vụ Concierge Ẩm thực 24/7
                        </span>
                        <h2 className="font-serif text-3xl font-bold text-slate-900">
                            Đặt Bàn Trực Tuyến Đẳng Cấp
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-lg mx-auto">
                            Vui lòng điền thông chi tiết dưới đây. Đội ngũ quản lý nhà hàng sẽ liên hệ xác nhận bàn VIP và tư vấn set menu phù hợp nhất trong vòng 15 phút.
                        </p>
                    </div>
                    <form onSubmit={handleSubmitBooking} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Họ và tên Quý khách <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.fullName}
                                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                    placeholder="Nguyễn Văn A"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Số điện thoại / Zalo <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    required
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="0905 123 456"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Địa chỉ Email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="quykhach@gmail.com"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Chọn Nhà Hàng / Quầy Bar <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.venue}
                                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                                >
                                    <option value="locean">Nhà hàng L'Océan (Fine Dining Pháp - Việt Tầng 3)</option>
                                    <option value="vinhxanh">Nhà hàng Hải Sản Vịnh Xanh (Sân vườn sát bờ biển)</option>
                                    <option value="skyhorizon">TA Sky Horizon Bar (Tầng 28 Rooftop)</option>
                                    <option value="palmgarden">The Palm Garden Lounge (Sảnh chính tiệc trà)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Quy mô bàn tiệc <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.tableType}
                                    onChange={(e) => setFormData({ ...formData, tableType: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                                >
                                    <option value="window">Bàn đôi lãng mạn 2 khách (Cửa sổ ngắm biển)</option>
                                    <option value="family">Bàn tiệc gia đình (4 - 6 khách)</option>
                                    <option value="group">Bàn tiệc nhóm bạn (8 - 12 khách)</option>
                                    <option value="vip">Phòng tiệc riêng tư VIP Dining Room (Trên 10 khách)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Ngày dùng bữa <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Khung giờ ẩm thực <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.mealTime}
                                    onChange={(e) => setFormData({ ...formData, mealTime: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                                >
                                    <option value="lunch">Bữa trưa thượng vị (11:30 - 13:30)</option>
                                    <option value="tea">Tiệc trà chiều hoàng hôn (14:30 - 17:00)</option>
                                    <option value="dinner-sunset">Bữa tối ngắm hoàng hôn (18:00 - 20:00)</option>
                                    <option value="dinner-late">Bữa tối muộn & Cocktail đêm (20:30 - 23:00)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                Yêu cầu đặc biệt & Sở thích dinh dưỡng
                            </label>
                            <textarea
                                rows={3}
                                value={formData.specialRequests}
                                onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                                placeholder="Ví dụ: Cần bàn sát ban công view biển, kỷ niệm ngày cưới (nhờ chuẩn bị hoa & nến), dị ứng hải sản vỏ cứng, cần thực đơn thuần chay hoặc không cay..."
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                            />
                        </div>

                        <div className="space-y-2 pt-2 text-xs text-slate-600">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.airportShuttle}
                                    onChange={(e) => setFormData({ ...formData, airportShuttle: e.target.checked })}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span>Kèm dịch vụ xe đưa đón sang trọng từ sân bay/trung tâm</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.sommelierConsult}
                                    onChange={(e) => setFormData({ ...formData, sommelierConsult: e.target.checked })}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span>Yêu cầu Chuyên gia Rượu vang (Sommelier) tư vấn trực tiếp</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isClubMember}
                                    onChange={(e) => setFormData({ ...formData, isClubMember: e.target.checked })}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span>Tôi là hội viên TA Club (Tích điểm & Ưu đãi 15%)</span>
                            </label>
                        </div>

                        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>🔒</span>
                                <span>Bảo mật thông tin quý khách tuyệt đối theo chuẩn quốc tế.</span>
                            </div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-orange-500/25 transition-all"
                            >
                                {isSubmitting ? 'Đang gửi thông tin...' : '✓ Xác Nhận Đặt Bàn Ngay'}
                            </button>
                        </div>
                    </form>
                </div>
            </section>

            {/* 8. DINING FAQ SECTION */}
            <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                    <div className="md:col-span-5">
                        <span className="text-xs uppercase font-bold tracking-widest text-blue-600">
                            Hỏi đáp dịch vụ ẩm thực
                        </span>
                        <h3 className="font-serif text-2xl font-bold text-slate-900 mt-1 mb-3">
                            Những Điều Cần Biết Khi Dùng Bữa Tại TA Đà Nẵng
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed mb-6">
                            Để đảm bảo trải nghiệm trọn vẹn và không gian thanh lịch cho toàn thể quý khách, xin vui lòng tham khảo các thông tin hướng dẫn dưới đây.
                        </p>
                        <div className="p-4 bg-white rounded-2xl border border-slate-200">
                            <strong className="block text-xs font-bold text-slate-900 mb-1">Cần hỗ trợ tiệc đặc biệt?</strong>
                            <p className="text-[11px] text-slate-500 leading-snug">
                                Liên hệ trực tiếp Quản lý F&B để tổ chức tiệc sinh nhật, cầu hôn bãi biển hay tiệc rượu doanh nghiệp riêng tư.
                            </p>
                            <span className="text-xs font-bold text-blue-600 block mt-2">
                                Hotline Ẩm thực: 1900 8899 (Ext 2) →
                            </span>
                        </div>
                    </div>
                    <div className="md:col-span-7 space-y-3">
                        {faqs.map((faq, idx) => (
                            <div
                                key={idx}
                                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition"
                            >
                                <button
                                    type="button"
                                    onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm text-slate-800 hover:text-blue-600 transition"
                                >
                                    <span className="flex items-center gap-2">
                                        <span className="text-blue-600">🍴</span>
                                        {faq.q}
                                    </span>
                                    <span className="text-slate-400 font-bold text-base shrink-0">
                                        {activeFaq === idx ? '▲' : '▼'}
                                    </span>
                                </button>
                                {activeFaq === idx && (
                                    <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3 bg-slate-50/50">
                                        {faq.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Reusable Footer */}
            <Footer />
        </div>
    );
}