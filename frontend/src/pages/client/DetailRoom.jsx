import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ROOMS_DATA, getRoomById } from '../../data/roomsData';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';

// Danh sách các ảnh chi tiết hạng phòng
const GALLERY_IMAGES = [
    {
        id: 1,
        title: 'Góc nhìn chính - Tầm nhìn trực diện biển Mỹ Khê 180°',
        url: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80',
        span: 'col-span-12 lg:col-span-6 row-span-2'
    },
    {
        id: 2,
        title: 'Phòng khách sang trọng',
        url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80',
        span: 'col-span-6 lg:col-span-3'
    },
    {
        id: 3,
        title: 'Ban công ngắm hoàng hôn',
        url: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=600&q=80',
        span: 'col-span-6 lg:col-span-3'
    },
    {
        id: 4,
        title: 'Bồn sục Jacuzzi cẩm thạch',
        url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
        span: 'col-span-6 lg:col-span-3'
    },
    {
        id: 5,
        title: 'Góc làm việc thượng lưu',
        url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80',
        span: 'col-span-6 lg:col-span-3'
    }
];

// Danh sách tiện nghi phân nhóm
const AMENITY_GROUPS = [
    {
        title: 'Không gian & Giường ngủ',
        icon: '🛏️',
        items: [
            'Đệm Simmons Beautyrest Black chuẩn khách sạn 6 sao',
            'Bộ ga gối lụa tơ tằm Ai Cập mật độ 600 sợi dệt',
            'Phòng khách riêng biệt với sofa Ligne Roset Pháp',
            'Menu 6 loại gối chống dị ứng cá nhân hóa theo yêu cầu'
        ]
    },
    {
        title: 'Phòng tắm & Spa tại gia',
        icon: '🛁',
        items: [
            'Bồn tắm Jacuzzi thủy lực đặt cạnh khung kính sát biển',
            'Bộ sản phẩm chăm sóc cao cấp Diptyque Paris nguyên bản',
            'Phòng tắm mưa nhiệt đới đôi Hansgrohe áp lực massage',
            'Áo choàng tắm sợi tre hữu cơ và máy sấy tóc Dyson Supersonic'
        ]
    },
    {
        title: 'Ẩm thực & Bar mini',
        icon: '☕',
        items: [
            'Máy pha cà phê Nespresso Gran Lattissima kèm viên nén refill mỗi ngày',
            'Minibar miễn phí cao cấp (rượu vang đón khách, nước khoáng San Pellegrino)',
            'Bộ trà gốm thủ công Minh Long cùng các dòng trà hữu cơ thượng hạng'
        ]
    },
    {
        title: 'Công nghệ Smart Room',
        icon: '📱',
        items: [
            'Hệ thống điều khiển cảm ứng thông minh Lutron (ánh sáng, rèm, nhiệt độ)',
            '2 Smart TV Samsung OLED 65-inch kết nối AirPlay & Netflix 4K',
            'Loa vòm không dây Bang & Olufsen Beosound Level cao cấp'
        ]
    }
];

// Đặc quyền Club Lounge
const CLUB_PRIVILEGES = [
    {
        icon: '🍸',
        title: 'Trà chiều & Sunset Canapés',
        desc: 'Thưởng thức tiệc trà chiều hoàng gia (14:30 - 16:30) và tiệc cocktail rượu vang ngắm hoàng hôn (17:30 - 19:30) miễn phí mỗi ngày.'
    },
    {
        icon: '🚘',
        title: 'Đưa đón sân bay Đà Nẵng 2 chiều',
        desc: 'Xe Mercedes-Benz E-Class riêng đón và tiễn tận cửa ga quốc tế/nội địa, hỗ trợ hành lý VIP chuyên biệt.'
    },
    {
        icon: '🤵',
        title: 'Quản gia riêng (Butler Service 24/7)',
        desc: 'Dịch vụ đóng gói/mở hành lý, đặt bàn ưu tiên tại các nhà hàng Michelin và chăm sóc tỉ mỉ từng chi tiết.'
    },
    {
        icon: '👔',
        title: 'Là ủi miễn phí & Check-out trễ',
        desc: 'Miễn phí 03 món giặt là/ngày và quyền check-out muộn tới 16:00 (tùy thuộc tình trạng phòng sẵn có).'
    }
];

// Các phòng tương tự
const SIMILAR_ROOMS = [
    {
        id: 1,
        name: 'Deluxe Ocean View King',
        tag: '65 M² • HƯỚNG BIỂN',
        rating: '4.92',
        reviews: '280',
        desc: 'Không gian tinh khôi với ban công riêng lộng gió biển, đệm êm ái và bồn tắm ngâm sâu thư thái.',
        price: '3.850.000',
        image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80'
    },
    {
        id: 2,
        name: 'Grand Premier Oceanfront Suite',
        tag: '130 M² • CORNER SUITE',
        rating: '4.99',
        reviews: '189',
        desc: 'Căn góc hai mặt biển ngoạn mục, phòng ăn riêng cho 4 người và quầy bar cocktail cá nhân hóa.',
        price: '11.200.000',
        image: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=600&q=80'
    },
    {
        id: 3,
        name: 'Presidential Beachfront Villa',
        tag: '350 M² • PRIVATE POOL VILLA',
        rating: '5.0',
        reviews: '84',
        desc: 'Dinh thự biệt lập trước biển với hồ bơi vô cực riêng, đầu bếp cá nhân và quản gia túc trực 24/7.',
        price: '26.500.000',
        image: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=600&q=80'
    }
];

export default function RoomDetailPage() {
    const { id } = useParams();
    const room = getRoomById(id) || ROOMS_DATA[0];

    const [isSaved, setIsSaved] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState('standard'); // 'standard' | 'spa'
    const [guestCount, setGuestCount] = useState(2);
    const nights = 2;

    const basePricePerNight = room.basePrice || 7450000;
    const packageSurchargePerNight = selectedPackage === 'spa' ? 1200000 : 0;
    const totalPricePerNight = basePricePerNight + packageSurchargePerNight;

    const roomSubtotal = totalPricePerNight * nights;
    const vatAndService = Math.round(roomSubtotal * 0.05); // 5%
    const finalTotal = roomSubtotal + vatAndService;
    const earnedPoints = Math.round(finalTotal / 10000);

    const gallery = room.gallery && room.gallery.length > 0 ? room.gallery : GALLERY_IMAGES;
    const similarRooms = ROOMS_DATA.filter((item) => item.id !== room.id).slice(0, 3);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white">
            <Navbar
                actionText="Đặt phòng ngay"
                actionLink="#dat-phong"
                onActionClick={() => {
                    const el = document.getElementById('dat-phong');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
            />


            {/* 3. BREADCRUMB & HEADER ACTIONS */}
            <div className="bg-white border-b border-slate-100 py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500">
                        <Link to="/" className="hover:text-blue-600 transition">Trang chủ</Link>
                        <span>/</span>
                        <Link to="/rooms" className="hover:text-blue-600 transition">Phòng nghỉ & Suites</Link>
                        <span>/</span>
                        <span className="text-slate-900 font-semibold truncate max-w-xs sm:max-w-none">
                            {room.name}
                        </span>
                    </nav>

                    <div className="flex items-center space-x-4 text-xs font-semibold text-slate-600">
                        <button className="flex items-center gap-1.5 hover:text-blue-600 transition">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            Chia sẻ
                        </button>
                        <button
                            onClick={() => setIsSaved(!isSaved)}
                            className={`flex items-center gap-1.5 transition ${isSaved ? 'text-red-500' : 'hover:text-red-500'}`}
                        >
                            <svg className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                            {isSaved ? 'Đã lưu yêu thích' : 'Lưu yêu thích'}
                        </button>
                    </div>
                </div>
            </div>

            {/* 4. TITLE & BADGES BAR */}
            <section className="bg-white pt-6 pb-4">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className={`px-3 py-0.5 rounded-full text-white text-xs font-bold uppercase tracking-wider ${room.tagColor || 'bg-orange-500'}`}>
                                    {room.tag}
                                </span>
                                {room.subTag && (
                                    <span className="px-3 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">
                                        👑 {room.subTag}
                                    </span>
                                )}
                                <span className="text-xs text-slate-500 font-medium">{room.floor}</span>
                            </div>
                            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
                                {room.name}
                            </h1>
                        </div>

                        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl flex-shrink-0">
                            <span className="flex items-center gap-1 text-amber-500 text-lg font-bold">
                                ★ {room.rating}
                            </span>
                            <div className="border-l border-slate-200 pl-3">
                                <div className="text-xs font-bold text-slate-900">Tuyệt hảo xuất sắc</div>
                                <a href="#danh-gia" className="text-[11px] text-blue-600 hover:underline">
                                    {room.reviewCount} lượt đánh giá thực tế
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. LUXURY PHOTO GALLERY (5-GRID WITH VIEW ALL BUTTON) */}
            <section className="bg-white pb-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-12 gap-3 h-[420px] sm:h-[500px] lg:h-[560px] rounded-3xl overflow-hidden relative">
                        {/* Main Hero Photo */}
                        <div className="col-span-12 lg:col-span-6 relative group overflow-hidden h-full">
                            <img
                                src={gallery[0].url}
                                alt={gallery[0].title}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-700 ease-out cursor-pointer"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent flex flex-col justify-end p-6 text-white pointer-events-none">
                                <span className="text-[11px] uppercase tracking-widest text-amber-300 font-bold mb-1">
                                    Góc nhìn chính
                                </span>
                                <p className="font-serif text-lg sm:text-xl font-bold">
                                    {gallery[0].title}
                                </p>
                            </div>
                            <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md p-2 rounded-full text-white cursor-pointer hover:bg-black/60 transition">
                                🔍
                            </div>
                        </div>

                        {/* 4 Thumbnails */}
                        <div className="hidden lg:grid col-span-6 grid-cols-2 gap-3 h-full">
                            {gallery.slice(1, 5).map((img) => (
                                <div key={img.id} className="relative group overflow-hidden rounded-xl h-full">
                                    <img
                                        src={img.url}
                                        alt={img.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500 ease-out cursor-pointer"
                                    />
                                    <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/10 transition" />
                                    <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-[11px] text-white font-medium">
                                        {img.title}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* View All Photos Button */}
                        <button className="absolute bottom-5 right-5 z-10 bg-white/95 hover:bg-white text-slate-900 text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg backdrop-blur-md flex items-center gap-2 transition hover:scale-105">
                            <span>📷</span>
                            Tất cả {gallery.length > 5 ? gallery.length : 24} ảnh
                        </button>
                    </div>
                </div>
            </section>

            {/* 6. MAIN CONTENT AREA & STICKY BOOKING WIDGET */}
            <section className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* LEFT COLUMN: DETAIL CONTENT (65% ~ 8 COLS) */}
                    <div className="lg:col-span-8 space-y-12">
                        {/* Quick Specs Strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                                    📐
                                </div>
                                <div>
                                    <span className="block text-[11px] text-slate-400 uppercase font-semibold">Diện tích</span>
                                    <strong className="text-sm text-slate-900">{room.area}</strong>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                                    🌊
                                </div>
                                <div>
                                    <span className="block text-[11px] text-slate-400 uppercase font-semibold">Tầm nhìn</span>
                                    <strong className="text-sm text-slate-900">{room.view}</strong>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                                    👥
                                </div>
                                <div>
                                    <span className="block text-[11px] text-slate-400 uppercase font-semibold">Sức chứa</span>
                                    <strong className="text-sm text-slate-900">{room.capacity}</strong>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                                    🛏️
                                </div>
                                <div>
                                    <span className="block text-[11px] text-slate-400 uppercase font-semibold">Giường ngủ</span>
                                    <strong className="text-sm text-slate-900">{room.bed}</strong>
                                </div>
                            </div>
                        </div>

                        {/* Architecture Description */}
                        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                            <span className="text-xs uppercase font-bold tracking-widest text-orange-600">
                                Trải Nghiệm Thượng Lưu Đặc Quyền
                            </span>
                            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
                                Bản giao hưởng giữa kiến trúc duy mỹ và đại dương bao la
                            </h2>
                            <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-light">
                                {room.description}
                            </p>
                            <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-light">
                                {room.subDescription}
                            </p>
                        </div>

                        {/* 5-Star Amenities Grid */}
                        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                                <div>
                                    <span className="text-xs uppercase font-bold tracking-widest text-blue-600">Tiện ích chuẩn quốc tế</span>
                                    <h3 className="font-serif text-2xl font-bold text-slate-900 mt-1">Tiện nghi phòng nghỉ cao cấp</h3>
                                </div>
                                <span className="text-xs text-slate-500 font-medium hidden sm:inline">Hơn 40+ tiện ích tích hợp</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {AMENITY_GROUPS.map((group, idx) => (
                                    <div key={idx} className="space-y-3">
                                        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                                            <span className="text-xl">{group.icon}</span>
                                            <h4 className="font-serif font-bold text-base text-slate-900">{group.title}</h4>
                                        </div>
                                        <ul className="space-y-2.5 text-xs text-slate-600">
                                            {group.items.map((item, itemIdx) => (
                                                <li key={itemIdx} className="flex items-start gap-2">
                                                    <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span className="leading-relaxed">{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Executive Club Privileges */}
                        <div className="bg-gradient-to-br from-blue-50 via-indigo-50/50 to-white p-6 sm:p-8 rounded-3xl border border-blue-100 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                <div>
                                    <span className="text-xs uppercase font-bold tracking-widest text-blue-600">
                                        Đặc Quyền Hội Viên Club Suite
                                    </span>
                                    <h3 className="font-serif text-2xl font-bold text-slate-900 mt-1">
                                        Đặc quyền Executive Club Tầng 25
                                    </h3>
                                </div>
                                <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-bold">
                                    Tận hưởng trọn vẹn
                                </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-600 mb-6 font-light">
                                Quý khách đặt phòng Executive Suite được tự động nâng cấp quyền tiếp cận toàn bộ hệ sinh thái dịch vụ riêng tư, không giới hạn tại TA Lounge.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {CLUB_PRIVILEGES.map((priv, idx) => (
                                    <div key={idx} className="bg-white p-5 rounded-2xl border border-blue-100/80 shadow-sm">
                                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl mb-3">
                                            {priv.icon}
                                        </div>
                                        <h4 className="font-serif font-bold text-sm text-slate-900 mb-1">{priv.title}</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed">{priv.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Floor Plan */}
                        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <span className="text-xs uppercase font-bold tracking-widest text-blue-600">Mặt bằng bố trí</span>
                                    <h3 className="font-serif text-2xl font-bold text-slate-900 mt-1">
                                        Sơ đồ không gian Suite (Floor Plan)
                                    </h3>
                                </div>
                                <span className="text-xs text-slate-500">Tỷ lệ kiến trúc 1:50</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                {/* SVG Blueprint Illustration */}
                                <div className="md:col-span-6 bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-300">
                                    <div className="border-2 border-blue-600 rounded-xl p-4 relative h-56 flex flex-col justify-between text-[11px] font-mono text-slate-600 bg-white">
                                        <div className="flex justify-between items-center border-b pb-2">
                                            <span className="text-blue-600 font-bold">BAN CÔNG VIEW BIỂN</span>
                                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">110 M² LUXURY LAYOUT</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 my-2 flex-1">
                                            <div className="border border-slate-200 p-2 rounded flex flex-col justify-center items-center text-center bg-slate-50/50">
                                                <span className="font-bold text-slate-800">PHÒNG KHÁCH</span>
                                                <span className="text-[10px] text-slate-400">Sofa & Bar Rượu</span>
                                            </div>
                                            <div className="border border-slate-200 p-2 rounded flex flex-col justify-center items-center text-center bg-blue-50/30">
                                                <span className="font-bold text-slate-800">JACUZZI</span>
                                                <span className="text-[10px] text-blue-600">Kính tràn biển</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 border-t pt-2">
                                            <div className="text-center font-bold text-slate-800">PHÒNG NGỦ KING</div>
                                            <div className="text-center text-slate-500">WALK-IN CLOSET</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="md:col-span-6 space-y-3 text-xs text-slate-600 leading-relaxed">
                                    <h4 className="font-serif font-bold text-base text-slate-900">Thiết kế phân vùng mở thông minh</h4>
                                    <p>
                                        Suite được phân bổ khoa học nhằm tối đa hóa tầm nhìn biển từ mọi vị trí: phòng khách rộng 38m² kết nối liền mạch với ban công mở, phòng ngủ cách âm chuẩn studio quốc tế đảm bảo sự tĩnh lặng tuyệt đối, và phòng tắm cẩm thạch độc lập chuẩn sanctuary spa.
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 pt-2 text-slate-800 font-semibold">
                                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                            Ban công: <span className="text-blue-600">22 m² lát sàn gỗ teak</span>
                                        </div>
                                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                            Phòng tắm: <span className="text-blue-600">24 m² có bồn sục view biển</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Policies */}
                        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
                            <h3 className="font-serif text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <span>🛡️</span> Chính sách nhận & trả phòng minh bạch
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-[11px] text-slate-400 uppercase font-bold block mb-1">Thời gian nhận phòng</span>
                                    <div className="text-lg font-bold text-slate-900 mb-1">14:00</div>
                                    <p className="text-slate-500">Hỗ trợ nhận sớm theo tình trạng phòng</p>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-[11px] text-slate-400 uppercase font-bold block mb-1">Thời gian trả phòng</span>
                                    <div className="text-lg font-bold text-slate-900 mb-1">12:00</div>
                                    <p className="text-blue-600 font-semibold">Hội viên Club được trễ tới 16:00</p>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-[11px] text-slate-400 uppercase font-bold block mb-1">Chính sách hủy phòng</span>
                                    <div className="text-lg font-bold text-emerald-600 mb-1">Linh hoạt 24h</div>
                                    <p className="text-slate-500">Miễn phí hủy trước 24 giờ nhận phòng</p>
                                </div>
                            </div>
                        </div>

                        {/* Guest Reviews */}
                        <div id="danh-gia" className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                                <div>
                                    <span className="text-xs uppercase font-bold tracking-widest text-blue-600">Trải nghiệm khách hàng</span>
                                    <h3 className="font-serif text-2xl font-bold text-slate-900 mt-1">
                                        Đánh giá từ những du khách tinh hoa
                                    </h3>
                                </div>

                                <div className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl">
                                    <span className="font-black text-2xl">4.98</span>
                                    <span className="text-xs text-amber-100 font-medium leading-tight">trên thang 5.0</span>
                                </div>
                            </div>

                            {/* Sub-scores */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-8 mb-8 border-b border-slate-100 text-xs">
                                <div>
                                    <div className="flex justify-between text-slate-600 mb-1">
                                        <span>Độ sạch sẽ</span>
                                        <strong className="text-slate-900">5.0</strong>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="w-full h-full bg-blue-600" />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-slate-600 mb-1">
                                        <span>Tầm nhìn</span>
                                        <strong className="text-slate-900">5.0</strong>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="w-full h-full bg-blue-600" />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-slate-600 mb-1">
                                        <span>Dịch vụ & Quản gia</span>
                                        <strong className="text-slate-900">4.9</strong>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="w-[98%] h-full bg-blue-600" />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-slate-600 mb-1">
                                        <span>Tiện nghi phòng</span>
                                        <strong className="text-slate-900">4.9</strong>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="w-[98%] h-full bg-blue-600" />
                                    </div>
                                </div>
                            </div>

                            {/* Testimonial items */}
                            <div className="space-y-6">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                                                ML
                                            </div>
                                            <div>
                                                <strong className="text-xs text-slate-900 block">Michael Laurent</strong>
                                                <span className="text-[11px] text-slate-400">Du khách từ Singapore • Kỳ nghỉ 4 đêm • Tháng 02/2025</span>
                                            </div>
                                        </div>
                                        <span className="text-amber-500 text-xs font-bold">★★★★★</span>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed italic">
                                        "Không có từ nào diễn tả được khoảnh khắc ngắm mặt trời mọc trên biển Mỹ Khê ngay từ chiếc giường Super King. Dịch vụ đón tiễn xe Mercedes mượt mà, nhân viên Lounge tầng 25 nhận diện tên khách ngay từ ngày thứ nhất. Đây chắc chắn là suite biển đẳng cấp nhất miền Trung Việt Nam."
                                    </p>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-xs">
                                                TH
                                            </div>
                                            <div>
                                                <strong className="text-xs text-slate-900 block">Trần Hoàng Oanh</strong>
                                                <span className="text-[11px] text-slate-400">Khách VIP Diamond • Kỳ nghỉ kỉ niệm ngày cưới • Tháng 01/2025</span>
                                            </div>
                                        </div>
                                        <span className="text-amber-500 text-xs font-bold">★★★★★</span>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed italic">
                                        "Bồn sục Jacuzzi bằng đá cẩm thạch nhìn thẳng ra biển hoàng hôn là góc tuyệt vời nhất của phòng. Quản gia chuẩn bị sẵn bánh chúc mừng và rượu vang rất chu đáo. Tiện nghi Dyson và Diptyque chứng minh sự chăm chút vượt bậc của Khách Sạn TA Đà Nẵng."
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: STICKY BOOKING WIDGET (35% ~ 4 COLS) */}
                    <div className="lg:col-span-4" id="dat-phong">
                        <div className="sticky top-28 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-900/5 p-6 space-y-6">
                            {/* Pricing Header */}
                            <div className="pb-5 border-b border-slate-100">
                                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                    <span className="uppercase font-bold tracking-wider text-blue-600">Giá ưu đãi đặt trực tiếp độc quyền</span>
                                    <span className="text-emerald-600 font-bold">🛡️</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-slate-900">
                                        {totalPricePerNight.toLocaleString('vi-VN')}
                                    </span>
                                    <span className="text-xs font-bold text-slate-500 uppercase">VND / đêm</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-slate-400 line-through">{room.priceOld} VND</span>
                                    <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-[11px] font-bold">
                                        Tiết kiệm {Math.max(10, Math.round((1 - (room.basePrice / (room.oldPriceNum || room.basePrice * 1.2))) * 100))}%
                                    </span>
                                </div>
                            </div>

                            {/* Date Selection */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Thời gian lưu trú (Ngày đến - Ngày đi)
                                </label>
                                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                                    <div className="border-r border-slate-200 pr-2">
                                        <span className="block text-[10px] text-slate-400 uppercase font-semibold">Nhận phòng</span>
                                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                                            📅 28/03/2025
                                        </div>
                                    </div>
                                    <div className="pl-2">
                                        <span className="block text-[10px] text-slate-400 uppercase font-semibold">Trả phòng</span>
                                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                                            📅 30/03/2025
                                        </div>
                                    </div>
                                </div>
                                <span className="block text-right text-[11px] text-blue-600 font-medium mt-1">
                                    Tổng thời gian: {nights} đêm
                                </span>
                            </div>

                            {/* Guest Counter */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Số lượng khách & Phòng
                                </label>
                                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                                        <span>👥</span> {guestCount} Người lớn, 0 Trẻ em
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100"
                                        >
                                            -
                                        </button>
                                        <span className="text-xs font-bold">{guestCount}</span>
                                        <button
                                            onClick={() => setGuestCount(Math.min(4, guestCount + 1))}
                                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Upgrade Packages Radio */}
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Gói dịch vụ cao cấp kèm theo
                                </label>

                                {/* Option 1 */}
                                <div
                                    onClick={() => setSelectedPackage('standard')}
                                    className={`p-3.5 rounded-2xl border cursor-pointer transition ${selectedPackage === 'standard'
                                            ? 'border-blue-600 bg-blue-50/50'
                                            : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                checked={selectedPackage === 'standard'}
                                                onChange={() => setSelectedPackage('standard')}
                                                className="text-blue-600"
                                            />
                                            <div>
                                                <span className="text-xs font-bold text-slate-900 block">
                                                    Gói Club Suite Tiêu Chuẩn
                                                </span>
                                                <p className="text-[11px] text-slate-500 mt-0.5">
                                                    Bao gồm ăn sáng thượng hạng, Trà chiều & Cocktail Tầng 25, xe Mercedes đưa đón 2 chiều.
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded uppercase flex-shrink-0">
                                            ĐÃ BAO GỒM
                                        </span>
                                    </div>
                                </div>

                                {/* Option 2 */}
                                <div
                                    onClick={() => setSelectedPackage('spa')}
                                    className={`p-3.5 rounded-2xl border cursor-pointer transition ${selectedPackage === 'spa'
                                            ? 'border-blue-600 bg-blue-50/50'
                                            : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                checked={selectedPackage === 'spa'}
                                                onChange={() => setSelectedPackage('spa')}
                                                className="text-blue-600"
                                            />
                                            <div>
                                                <span className="text-xs font-bold text-slate-900 block">
                                                    Gói Club & The Lotus Spa
                                                </span>
                                                <p className="text-[11px] text-slate-500 mt-0.5">
                                                    Toàn bộ đặc quyền Club + 60 phút massage thảo dược biển đôi mỗi ngày tại The Lotus Spa.
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-bold text-orange-600 flex-shrink-0">
                                            +1.200.000đ<span className="text-[9px] text-slate-400 block font-normal">/đêm</span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Price Breakdown */}
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                                <div className="flex justify-between text-slate-600">
                                    <span>{totalPricePerNight.toLocaleString('vi-VN')} VND x {nights} đêm</span>
                                    <span>{roomSubtotal.toLocaleString('vi-VN')} VND</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Thuế VAT & Phí dịch vụ (5%)</span>
                                    <span>{vatAndService.toLocaleString('vi-VN')} VND</span>
                                </div>
                                <div className="flex justify-between text-blue-600 font-semibold pt-1 border-t border-slate-200">
                                    <span>💎 Tích lũy TA Club Points</span>
                                    <span>+{earnedPoints.toLocaleString('vi-VN')} điểm</span>
                                </div>
                                <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                                    <span className="font-bold text-slate-900 text-sm">Tổng thanh toán dự kiến</span>
                                    <div className="text-right">
                                        <span className="font-black text-xl text-orange-600">
                                            {finalTotal.toLocaleString('vi-VN')}
                                        </span>
                                        <span className="text-[11px] text-slate-500 font-bold block">VND</span>
                                    </div>
                                </div>
                            </div>

                            {/* Main CTA */}
                            <button className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-2xl shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition">
                                <span>⚡</span>
                                Tiến Hành Đặt Phòng Ngay
                            </button>

                            {/* Trust Guarantees */}
                            <div className="space-y-2 pt-2 text-[11px] text-slate-500">
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-500">✓</span> Cam kết giá tốt nhất trực tiếp từ Khách Sạn TA
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-500">✓</span> Miễn phí hủy phòng trước 24 giờ nhận phòng
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-500">✓</span> Thanh toán bảo mật chuẩn mã hóa SSL 256-bit
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-blue-600">📞</span> Hỗ trợ tư vấn phòng VIP trực tiếp: <strong className="text-slate-700">1900 8899</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 7. SIMILAR SUITES SECTION */}
            <section className="py-16 bg-white border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
                        <div>
                            <span className="text-xs uppercase font-bold tracking-widest text-blue-600">Khám phá thêm</span>
                            <h3 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                                Các hạng phòng nghỉ & Suites tương tự
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                Lựa chọn không gian nghỉ dưỡng phù hợp hoàn hảo với phong cách của quý khách.
                            </p>
                        </div>
                        <Link to="/rooms" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                            Xem tất cả các hạng phòng →
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {similarRooms.map((sRoom) => (
                            <div
                                key={sRoom.id}
                                className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group"
                            >
                                <Link to={`/rooms/${sRoom.id}`} className="block relative h-56 overflow-hidden">
                                    <img
                                        src={sRoom.image}
                                        alt={sRoom.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                    />
                                    <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                        {sRoom.tag}
                                    </span>
                                </Link>

                                <div className="p-6 flex-1 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                                            <span className="flex items-center text-amber-500 font-bold">
                                                ★ {sRoom.rating} <span className="text-slate-400 font-normal ml-1">({sRoom.reviewCount} đánh giá)</span>
                                            </span>
                                        </div>
                                        <h4 className="font-serif font-bold text-lg text-slate-900 group-hover:text-blue-600 transition mb-2">
                                            <Link to={`/rooms/${sRoom.id}`} className="hover:text-blue-600 transition">
                                                {sRoom.name}
                                            </Link>
                                        </h4>
                                        <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                                            {sRoom.description}
                                        </p>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Từ</span>
                                            <div className="flex items-baseline gap-1">
                                                <strong className="text-base font-black text-slate-900">{sRoom.priceCurrent}</strong>
                                                <span className="text-[10px] text-slate-500">/ đêm</span>
                                            </div>
                                        </div>
                                        <Link
                                            to={`/rooms/${sRoom.id}`}
                                            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                                        >
                                            Xem chi tiết
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <Footer />

        </div>
    );
}
