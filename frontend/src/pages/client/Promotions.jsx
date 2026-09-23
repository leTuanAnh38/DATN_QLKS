import React, { useState } from 'react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';

export default function PromotionsPage() {
    const [activeCategory, setActiveCategory] = useState('all');
    const [copiedCode, setCopiedCode] = useState(null);
    const [activeFaq, setActiveFaq] = useState(null);
    const [emailSubscription, setEmailSubscription] = useState('');

    // Categories list with counts
    const categories = [
        { id: 'all', label: 'Tất cả ưu đãi', count: 18 },
        { id: 'rooms', label: 'Nghỉ dưỡng & Phòng Suite', count: 6 },
        { id: 'dining', label: 'Ẩm thực & Nhà hàng Michelin', count: 4 },
        { id: 'spa', label: 'The Lotus Spa & Wellness', count: 3 },
        { id: 'mice', label: 'Tiệc cưới & Hội nghị Sự kiện', count: 3 }
    ];

    // Offers Data
    const offers = [
        {
            id: 1,
            category: 'rooms',
            badge: 'Nghỉ dưỡng & Suites',
            highlightBadge: 'Tiết kiệm 25%',
            title: 'Kỳ Nghỉ Hoàng Gia - Long Stay Special',
            description: 'Giảm 25% cho lưu trú từ 3 đêm trở lên, miễn phí giặt là cao cấp hàng ngày & tặng thẻ tín dụng ẩm thực.',
            perks: [
                'Áp dụng từ 03 đêm lưu trú hạng Suite trở lên',
                'Tín dụng 1.000.000 VND sử dụng tại mọi quầy bar'
            ],
            originalPrice: '6.500.000 VND',
            price: '4.875.000 VND',
            unit: '/ đêm',
            code: 'LONGSTAY25',
            deadline: '31/08/2025',
            image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80'
        },
        {
            id: 2,
            category: 'rooms',
            badge: 'Tuần trăng mật',
            highlightBadge: 'Tặng bữa tối nến',
            title: 'Trăng Mật Thiên Đường - Honeymoon Serenade',
            description: 'Set trang trí hoa tươi & nến thơm, bồn sục hoa hồng view biển, bữa tối lãng mạn riêng bên bờ biển.',
            perks: [
                '1 Chai Moët & Chandon Brut Imperial ướp lạnh',
                'Bữa tối 5 món phong cách Châu Âu ngay bãi biển'
            ],
            originalPrice: '11.200.000 VND',
            price: '8.400.000 VND',
            unit: '/ gói',
            code: 'HONEYMOON',
            deadline: '31/08/2025',
            image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=600&q=80'
        },
        {
            id: 3,
            category: 'dining',
            badge: 'Ẩm thực Michelin',
            highlightBadge: 'Tặng Cocktail Skybar',
            title: 'Weekend Gourmet Getaway',
            description: 'Buffet hải sản tôm hùm không giới hạn tại nhà hàng Ocean Breeze, tặng cocktail sunset sky bar.',
            perks: [
                'Tôm hùm Nha Trang & hàu Pháp chế biến tại bàn',
                'Miễn phí 02 signature cocktail tại Sky Bar 28'
            ],
            originalPrice: '2.100.000 VND',
            price: '1.450.000 VND',
            unit: '/ khách',
            code: 'GOURMET28',
            deadline: '31/08/2025',
            image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80'
        },
        {
            id: 4,
            category: 'rooms',
            badge: 'Hội viên đặt sớm',
            highlightBadge: 'Giảm 20% giá gốc',
            title: 'Early Bird 2025 - Đặt Sớm Giá Tốt',
            description: 'Đặt trước 30 ngày giảm ngay 20% trên giá phòng tốt nhất, bảo lưu và đổi lịch linh hoạt.',
            perks: [
                'Linh hoạt đổi ngày lưu trú không thu phụ phí',
                'Tích điểm nhân đôi hạng thẻ TA Club'
            ],
            originalPrice: '4.800.000 VND',
            price: '3.840.000 VND',
            unit: '/ đêm',
            code: 'EARLY2025',
            deadline: '31/08/2025',
            image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80'
        },
        {
            id: 5,
            category: 'spa',
            badge: 'The Lotus Spa',
            highlightBadge: 'Giảm 30% online',
            title: 'The Lotus Spa Rejuvenation',
            description: 'Combo 90 phút trị liệu bùn khoáng nóng & massage đá muối Himalaya nguyên bản, giải tỏa căng thẳng.',
            perks: [
                'Xông hơi thảo dược & tắm ngâm bồn sục Jacuzzi',
                'Tặng set trà thanh nhiệt hữu cơ sau liệu trình'
            ],
            originalPrice: '2.600.000 VND',
            price: '1.820.000 VND',
            unit: '/ liệu trình',
            code: 'LOTUSRELAX',
            deadline: '31/08/2025',
            image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=600&q=80'
        },
        {
            id: 6,
            category: 'mice',
            badge: 'Tiệc & Hội nghị M.I.C.E',
            highlightBadge: 'Tặng tea-break cao cấp',
            title: 'Gói Hội Nghị & Sự Kiện M.I.C.E',
            description: 'Miễn phí phòng họp Ballroom hiện đại kèm tiệc trà tea-break bánh ngọt thượng hạng cho đoàn từ 30 khách.',
            perks: [
                'Màn hình LED P2 4K và hệ thống âm thanh vòm',
                'Đội ngũ chuyên viên sự kiện tận tâm phục vụ riêng'
            ],
            originalPrice: 'Chỉ từ',
            price: '650.000 VND',
            unit: '/ khách',
            code: 'MICETA2025',
            deadline: '31/08/2025',
            image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=600&q=80'
        }
    ];

    // FAQs Data
    const faqs = [
        {
            q: 'Làm thế nào để áp dụng mã giảm giá khi đặt phòng?',
            a: 'Quý khách chỉ cần sao chép mã ưu đãi (ví dụ: TASUMMER35) và nhập vào ô "Mã khuyến mãi" ở bước tìm kiếm phòng hoặc bước thanh toán cuối cùng. Hệ thống sẽ tự động trừ trực tiếp số tiền tương ứng vào tổng hóa đơn.'
        },
        {
            q: 'Ưu đãi có áp dụng kèm chính sách hoàn hủy linh hoạt không?',
            a: 'Đa phần các gói ưu đãi tại Khách Sạn TA Đà Nẵng đều đi kèm chính sách hủy hoặc đổi ngày miễn phí trước 24 giờ nhận phòng. Riêng các gói Flash Sale hoặc ưu đãi Đặt sớm không hoàn lại sẽ có ghi chú rõ ràng trên từng thẻ.'
        },
        {
            q: 'Mã khuyến mãi có áp dụng vào các ngày Lễ, Tết không?',
            a: 'Tùy thuộc vào từng chương trình khuyến mãi. Một số mã áp dụng xuyên suốt, trong khi một số gói đặc biệt có thể áp dụng phụ thu lễ tết theo quy định của khách sạn. Quý khách vui lòng kiểm tra chi tiết trên từng ưu đãi hoặc liên hệ Concierge 1900 8899.'
        }
    ];

    const handleCopyCode = (code) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2500);
    };

    const filteredOffers = activeCategory === 'all' ? offers : offers.filter(o => o.category === activeCategory);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white">
            {/* Reusable Navbar */}
            <Navbar />


            {/* 3. SPOTLIGHT HERO PROMOTION BANNER */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
                <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 rounded-3xl overflow-hidden shadow-2xl relative text-white border border-blue-800/40">
                    <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                        {/* Left Content */}
                        <div className="lg:col-span-7 p-8 sm:p-12 lg:p-14 flex flex-col justify-between relative z-10">
                            <div>
                                <div className="flex flex-wrap items-center gap-2.5 mb-5">
                                    <span className="px-3.5 py-1 rounded-full bg-orange-500 text-white text-xs font-bold uppercase tracking-wider shadow-sm">
                                        🔥 Ưu đãi giới hạn - Chỉ còn 12 suất
                                    </span>
                                    <span className="px-3 py-1 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30 text-xs font-semibold">
                                        ⭐ Hạng sang Luxury Suite
                                    </span>
                                </div>
                                <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
                                    Tuyệt Tác Mùa Hè 2025: Kỳ Nghỉ Biển Thượng Lưu Tiết Kiệm Tới <span className="text-amber-400">35%</span>
                                </h1>
                                <p className="text-slate-300 text-sm sm:text-base font-light leading-relaxed mb-8 max-w-xl">
                                    Trải nghiệm kỳ nghỉ bên bờ biển Mỹ Khê danh tiếng với đặc quyền đưa đón sân bay xe limousine Mercedes-Benz riêng, buffet sáng phong vị Michelin Selected, tiệc trà chiều hoàng hôn tầng 25 và 60 phút thanh tẩy năng lượng tại The Lotus Spa.
                                </p>
                                {/* 4 Feature Highlights */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
                                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center">
                                        <span className="text-xl block mb-1">🚘</span>
                                        <strong className="text-[11px] block text-white font-semibold leading-tight">Đưa đón VIP</strong>
                                        <span className="text-[10px] text-slate-300">Mercedes S-Class</span>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center">
                                        <span className="text-xl block mb-1">🍽️</span>
                                        <strong className="text-[11px] block text-white font-semibold leading-tight">Buffet Sáng</strong>
                                        <span className="text-[10px] text-slate-300">Michelin Selected</span>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center">
                                        <span className="text-xl block mb-1">☕</span>
                                        <strong className="text-[11px] block text-white font-semibold leading-tight">Sunset Tea</strong>
                                        <span className="text-[10px] text-slate-300">TA Lounge Tầng 25</span>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-center">
                                        <span className="text-xl block mb-1">🪷</span>
                                        <strong className="text-[11px] block text-white font-semibold leading-tight">Trị liệu 60 phút</strong>
                                        <span className="text-[10px] text-slate-300">The Lotus Spa</span>
                                    </div>
                                </div>
                            </div>
                            {/* Coupon Bar & CTA */}
                            <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-white/10">
                                <div className="flex items-center bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 gap-3">
                                    <span className="text-xs text-slate-300">Mã độc quyền:</span>
                                    <span className="font-mono text-base font-bold text-amber-300 tracking-wider">TASUMMER35</span>
                                    <button
                                        type="button"
                                        onClick={() => handleCopyCode('TASUMMER35')}
                                        className="text-xs text-blue-300 hover:text-white font-semibold underline transition ml-2"
                                    >
                                        {copiedCode === 'TASUMMER35' ? '✓ Đã chép' : 'Sao chép mã'}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    className="px-6 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl transition-all duration-200"
                                >
                                    Đặt Kỳ Nghỉ Ngay →
                                </button>
                            </div>
                        </div>
                        {/* Right Image Visual */}
                        <div className="lg:col-span-5 relative min-h-[320px] lg:min-h-full">
                            <img
                                src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80"
                                alt="Luxury Ocean Suite"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-blue-900/90 via-transparent to-transparent" />
                            {/* Floating Award Badge */}
                            <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/40 max-w-[220px]">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-amber-500 text-base">🏆</span>
                                    <span className="text-[11px] font-bold text-slate-900 uppercase">Top Resort 2025</span>
                                </div>
                                <p className="text-[10px] text-slate-600 leading-tight">
                                    Tạp chí Condé Nast Traveler bình chọn top khu nghỉ dưỡng ven biển đẹp nhất Châu Á.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. FILTER TABS & EXPIRATION NOTE */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
                    <div>
                        <span className="text-xs uppercase font-bold tracking-widest text-blue-600">Danh mục trải nghiệm</span>
                        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                            Khám Phá Ưu Đãi Phù Hợp
                        </h2>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm self-start md:self-auto">
                        <span className="text-blue-600">⏱️</span>
                        <span>Áp dụng cho mọi kỳ lưu trú từ nay đến hết <strong>31/08/2025</strong></span>
                    </div>
                </div>
                {/* Filter Tab Buttons */}
                <div className="flex flex-wrap gap-2.5 mt-6">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActiveCategory(cat.id)}
                            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${activeCategory === cat.id
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                                    : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                                }`}
                        >
                            <span>{cat.label}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${activeCategory === cat.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                }`}>
                                {cat.count}
                            </span>
                        </button>
                    ))}
                </div>
            </section>

            {/* 5. OFFERS GRID (3-COL BALANCED LAYOUT) */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                    {filteredOffers.map((offer) => (
                        <div
                            key={offer.id}
                            className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1"
                        >
                            <div>
                                {/* Image Banner with Badges */}
                                <div className="relative h-56 w-full overflow-hidden">
                                    <img
                                        src={offer.image}
                                        alt={offer.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                                    {/* Top Left Badges */}
                                    <div className="absolute top-3.5 left-3.5 flex flex-col gap-1.5 items-start">
                                        <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-semibold">
                                            {offer.badge}
                                        </span>
                                        <span className="px-3 py-1 rounded-full bg-orange-500 text-white text-[11px] font-bold shadow-sm">
                                            {offer.highlightBadge}
                                        </span>
                                    </div>
                                    {/* Bottom Right Deadline */}
                                    <div className="absolute bottom-3 right-3 text-[11px] text-white/90 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-lg">
                                        Hạn: {offer.deadline}
                                    </div>
                                </div>
                                {/* Card Content */}
                                <div className="p-6">
                                    <h3 className="font-serif font-bold text-slate-900 text-lg group-hover:text-blue-600 transition mb-2">
                                        {offer.title}
                                    </h3>
                                    <p className="text-xs text-slate-600 leading-relaxed mb-4">
                                        {offer.description}
                                    </p>
                                    {/* Perks Checklist */}
                                    <ul className="space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-700 mb-4">
                                        {offer.perks.map((perk, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="text-blue-600 font-bold">✓</span>
                                                <span className="text-[11px] leading-tight">{perk}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            {/* Card Footer: Pricing & Actions */}
                            <div className="p-6 pt-0 border-t border-slate-100 mt-2">
                                <div className="flex items-end justify-between mb-4 pt-4">
                                    <div>
                                        {offer.originalPrice !== 'Chỉ từ' && (
                                            <span className="text-xs text-slate-400 line-through block">
                                                {offer.originalPrice}
                                            </span>
                                        )}
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-xl font-bold text-blue-600">{offer.price}</span>
                                            <span className="text-xs text-slate-500">{offer.unit}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Mã:</span>
                                        <strong className="font-mono text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                            {offer.code}
                                        </strong>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => alert(`Đã kích hoạt ưu đãi gói: ${offer.title} với mã ${offer.code}`)}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg transition-all duration-200"
                                >
                                    Xem chi tiết & Đặt ngay
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* 6. DIRECT BOOKING GUARANTEES (4 PILLARS) */}
            <section className="py-16 bg-white border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-2xl mx-auto mb-12">
                        <span className="text-xs uppercase font-bold tracking-widest text-blue-600">Đặc quyền độc nhất</span>
                        <h2 className="font-serif text-3xl font-bold text-slate-900 mt-2">
                            Tại Sao Nên Đặt Trực Tiếp Tại Khách Sạn TA?
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 mt-2">
                            Tận hưởng sự an tâm tuyệt đối và những đặc quyền cá nhân hóa chỉ dành riêng cho quý khách khi đặt phòng qua kênh chính thức.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 hover:shadow-md transition">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold mb-4">
                                💎
                            </div>
                            <h3 className="font-serif font-bold text-slate-900 text-base mb-1.5">Cam Kết Giá Tốt Nhất</h3>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Bảo đảm giá trực tiếp luôn là tốt nhất (Best Rate Guarantee). Bồi hoàn 100% chênh lệch nếu quý khách tìm thấy giá rẻ hơn ở bất kỳ đâu.
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 hover:shadow-md transition">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold mb-4">
                                🕒
                            </div>
                            <h3 className="font-serif font-bold text-slate-900 text-base mb-1.5">Nhận Sớm & Trả Phòng Muộn</h3>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Linh hoạt nhận phòng sớm từ 10:00 sáng và trả phòng trễ đến 16:00 chiều (tùy thuộc vào tình trạng phòng sẵn có lúc đến).
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 hover:shadow-md transition">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold mb-4">
                                🍸
                            </div>
                            <h3 className="font-serif font-bold text-slate-900 text-base mb-1.5">Đón Tiếp Chu Đáo 5 Sao</h3>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Thức uống chào đón độc quyền pha chế theo mùa và đĩa trái cây nhiệt đới hữu cơ thượng hạng được thay mới mỗi ngày tại phòng.
                            </p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 hover:shadow-md transition">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold mb-4">
                                📅
                            </div>
                            <h3 className="font-serif font-bold text-slate-900 text-base mb-1.5">Hủy Phòng Miễn Phí 24H</h3>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Chính sách thay đổi ngày lưu trú và hủy phòng linh động không tính phí trước 24 giờ nhận phòng cho tất cả khách đặt trực tuyến.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 7. SECRET SALE VOUCHER BOX */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-8">
                    <div className="max-w-xl">
                        <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider mb-3 inline-block">
                            🔒 Secret Private Sale • Độc Quyền Hội Viên
                        </span>
                        <h2 className="font-serif text-3xl sm:text-4xl font-bold leading-tight mb-3">
                            Đăng Ký Nhận Voucher Bí Mật Giảm Thêm 500.000 VNĐ
                        </h2>
                        <p className="text-slate-300 text-xs sm:text-sm font-light leading-relaxed">
                            Nhận thông báo ưu tiên trước 48 giờ về các chương trình giảm giá chớp nhoáng (Flash Sale) mùa lễ hội và mã voucher giảm trực tiếp 500.000 VND cho kỳ nghỉ đầu tiên của quý khách.
                        </p>
                    </div>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            alert(`Mã voucher bí mật 500K đã được gửi tới email: ${emailSubscription}`);
                            setEmailSubscription('');
                        }}
                        className="w-full lg:w-auto flex-1 max-w-md"
                    >
                        <div className="flex flex-col sm:flex-row gap-2.5">
                            <input
                                type="email"
                                required
                                value={emailSubscription}
                                onChange={(e) => setEmailSubscription(e.target.value)}
                                placeholder="Nhập địa chỉ email của bạn..."
                                className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white/15 transition"
                            />
                            <button
                                type="submit"
                                className="whitespace-nowrap px-6 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition"
                            >
                                Nhận Voucher →
                            </button>
                        </div>
                        <span className="block text-[11px] text-slate-400 mt-2 text-center sm:text-left">
                            🔒 Cam kết bảo mật thông tin cá nhân. Hủy đăng ký bất kỳ lúc nào.
                        </span>
                    </form>
                </div>
            </section>

            {/* 8. FAQ ACCORDION */}
            <section className="py-12 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-8">
                    <span className="text-xs uppercase font-bold tracking-widest text-blue-600">Hỗ trợ thông tin</span>
                    <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                        Điều Khoản & Câu Hỏi Thường Gặp
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Mọi điều bạn cần biết để áp dụng ưu đãi một cách thuận lợi và trọn vẹn nhất.
                    </p>
                </div>
                <div className="space-y-3">
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
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">
                                        {idx + 1}
                                    </span>
                                    <span>{faq.q}</span>
                                </div>
                                <span className="text-slate-400 font-bold text-base">
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
                <div className="mt-8 text-center text-xs text-slate-500">
                    Quý khách cần hỗ trợ thêm thông tin riêng? Hãy liên hệ Hệ thống đài Chăm sóc Khách hàng 24/7:{' '}
                    <strong className="text-blue-600">1900 8899</strong> hoặc gửi thư về{' '}
                    <a href="mailto:concierge@tadananghotel.com" className="text-orange-500 underline">
                        concierge@tadananghotel.com
                    </a>
                </div>
            </section>

            {/* Reusable Footer */}
            <Footer />
        </div>
    );
}