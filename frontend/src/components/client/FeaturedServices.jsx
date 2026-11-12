import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    LayoutGrid,
    Award,
    UtensilsCrossed,
    Flower2,
    Wine,
    BellRing,
    Clock,
    Phone,
    ArrowRight
} from 'lucide-react';
import hotelService from '../../services/hotelService';
import { useHotelSettings } from '../../store/hotelSettingStore';

// Danh sách dịch vụ mẫu cao cấp dự phòng (fallback) để giao diện luôn tráng lệ
const FALLBACK_SERVICES = [
    {
        id: 101,
        name: "Bò Wagyu Úc Nướng Than Hoa Sốt Tiêu Rừng",
        category_name: "Ẩm thực & Bar",
        price: "750000",
        description: "Thịt thăn bò Wagyu nhập khẩu đạt chứng nhận marble 7+, nướng trên than gáo dừa thơm lừng kèm khoai tây nghiền nấm truffle.",
        display_image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
        badge: "Chef's Signature"
    },
    {
        id: 102,
        name: "Súp Tôm Hùm Nha Trang Nấu Saffron",
        category_name: "Ẩm thực & Bar",
        price: "380000",
        description: "Tôm hùm bông tươi sống kết hợp nhụy hoa nghệ tây Iran cao cấp, tạo nên vị ngọt đậm đà quý phái.",
        display_image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80",
        badge: "Michelin Selected"
    },
    {
        id: 103,
        name: "Liệu Trình The Lotus Signature Body Treatment (90 Phút)",
        category_name: "Spa & Wellness",
        price: "1250000",
        description: "Massage toàn thân kết hợp tinh dầu sen trắng quý hiếm, đá núi lửa ấm và bồn ngâm thảo dược giải tỏa mệt mỏi.",
        display_image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
        badge: "Thảo Dược Cổ Truyền"
    },
    {
        id: 104,
        name: "Set Trà Chiều Hoàng Gia Vịnh Biển (High Tea For Two)",
        category_name: "Ẩm thực & Bar",
        price: "450000",
        description: "Khay 3 tầng gồm 8 loại bánh pastry thủ công Pháp, macaron hạnh nhân, finger sandwich và ấm trà Dilmah thượng hạng.",
        display_image: "https://images.unsplash.com/photo-1577968897966-3d4325b36b61?auto=format&fit=crop&w=800&q=80",
        badge: "Best Seller"
    },
    {
        id: 105,
        name: "Liệu Pháp Thủy Hóa Da Mặt & Trẻ Hóa Tế Bào (60 Phút)",
        category_name: "Spa & Wellness",
        price: "850000",
        description: "Sử dụng tinh chất tế bào gốc hữu cơ và máy sóng siêu âm lạnh giúp làn da căng bóng, rạng rỡ tức thì.",
        display_image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80",
        badge: "Chăm Sóc VIP"
    },
    {
        id: 106,
        name: "Rượu Vang Đỏ Château Margaux Grand Cru Classé",
        category_name: "Đồ uống & Bar",
        price: "2450000",
        description: "Niên vụ đặc biệt 2018 mang hương thơm phức hợp của quả mọng đen, gỗ sồi Pháp và tannin mượt mà như nhung.",
        display_image: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80",
        badge: "Hầm Vang TA Exclusive"
    }
];

// Helper biểu tượng vector chuẩn Luxury cho danh mục dịch vụ
const getCategoryIconComponent = (catName) => {
    const text = (catName || '').toLowerCase();
    if (text.includes('spa') || text.includes('wellness') || text.includes('trị liệu')) {
        return <Flower2 className="w-3.5 h-3.5 text-amber-300" />;
    }
    if (text.includes('uống') || text.includes('rượu') || text.includes('bar') || text.includes('vang')) {
        return <Wine className="w-3.5 h-3.5 text-amber-300" />;
    }
    if (text.includes('ẩm thực') || text.includes('món') || text.includes('ăn') || text.includes('dining')) {
        return <UtensilsCrossed className="w-3.5 h-3.5 text-amber-300" />;
    }
    return <BellRing className="w-3.5 h-3.5 text-amber-300" />;
};

export default function FeaturedServices() {
    const { settings } = useHotelSettings();
    const starCount = settings?.stars || 3;
    const hotelName = settings?.hotel_name || 'Khách Sạn TA Đà Nẵng';
    const [services, setServices] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeFilter, setActiveFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchServiceData = async () => {
            try {
                setLoading(true);
                const [itemsRes, catRes] = await Promise.all([
                    hotelService.getServiceItems(),
                    hotelService.getServiceCategories()
                ]);

                if (catRes.success && catRes.categories?.length > 0) {
                    setCategories(catRes.categories);
                }

                if (itemsRes.success && itemsRes.items?.length > 0) {
                    setServices(itemsRes.items);
                } else {
                    setServices(FALLBACK_SERVICES);
                }
            } catch (err) {
                console.warn('Dùng dữ liệu dịch vụ dự phòng:', err);
                setServices(FALLBACK_SERVICES);
            } finally {
                setLoading(false);
            }
        };

        fetchServiceData();
    }, []);

    // Danh sách items hiển thị (ghép fallback nếu backend ít dữ liệu)
    const displayList = services.length >= 4 ? services : [...services, ...FALLBACK_SERVICES.slice(services.length)];

    // Lọc dịch vụ theo tab
    const filteredServices = displayList.filter(item => {
        if (activeFilter === 'all') return true;
        const catName = (item.category_name || item.category?.name || '').toLowerCase();
        if (activeFilter === 'dining') return catName.includes('ẩm thực') || catName.includes('ăn') || catName.includes('f&b') || catName.includes('bò') || catName.includes('món');
        if (activeFilter === 'spa') return catName.includes('spa') || catName.includes('massage') || catName.includes('trị liệu') || catName.includes('chăm sóc');
        if (activeFilter === 'drinks') return catName.includes('uống') || catName.includes('bar') || catName.includes('rượu') || catName.includes('trà') || catName.includes('cà phê');
        return true;
    });

    // Định dạng giá tiền chuẩn VND
    const formatPrice = (price) => {
        const num = Number(price) || 0;
        return num.toLocaleString('vi-VN') + ' ₫';
    };

    return (
        <section id="menu-dich-vu" className="py-20 bg-gradient-to-b from-white via-slate-50 to-slate-100 relative overflow-hidden transform-gpu">
            {/* Background Decorator Lights - sử dụng Radial Gradient thay vì blur nặng để chống giật nhấp nháy trên iOS/Mobile */}
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.18),transparent_70%)] pointer-events-none" />
            <div className="absolute bottom-10 right-0 w-[450px] h-[450px] bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.12),transparent_70%)] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                {/* 1. SECTION HEADER */}
                <div className="text-center max-w-3xl mx-auto mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs font-bold uppercase tracking-widest mb-3">
                        <Award className="w-3.5 h-3.5 text-amber-600" />
                        <span>ĐẶC QUYỀN DỊCH VỤ & ẨM THỰC {starCount} SAO</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-slate-900 tracking-tight leading-tight">
                        Tinh Hoa Dịch Vụ Nghỉ Dưỡng <br />
                        <span className="bg-gradient-to-r from-slate-900 via-amber-800 to-amber-600 bg-clip-text text-transparent inline-block transform-gpu">
                            Phục Vụ Tận Phòng 24/7
                        </span>
                    </h2>
                    <p className="text-slate-600 text-sm sm:text-base mt-4 leading-relaxed font-normal">
                        Thưởng thức mỹ vị ẩm thực thượng hạng, liệu trình The Lotus Spa thư giãn tái tạo năng lượng và hệ thống đồ uống cao cấp ngay trong không gian riêng tư của quý khách.
                    </p>

                    {/* Filter Tabs */}
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-8">
                        {[
                            { id: 'all', label: 'Tất Cả Dịch Vụ', icon: LayoutGrid },
                            { id: 'dining', label: 'Ẩm Thực Thượng Hạng', icon: UtensilsCrossed },
                            { id: 'spa', label: 'The Lotus Spa & Wellness', icon: Flower2 },
                            { id: 'drinks', label: 'Đồ Uống & Bar Cao Cấp', icon: Wine },
                        ].map((tab) => {
                            const TabIcon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveFilter(tab.id)}
                                    className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-2 shadow-xs cursor-pointer ${
                                        activeFilter === tab.id
                                            ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-md shadow-sky-900/20 scale-105 border border-sky-600'
                                            : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                                    }`}
                                >
                                    <TabIcon className="w-3.5 h-3.5" />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 2. SERVICES GRID */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                        {[1, 2, 3, 4, 5, 6].map((idx) => (
                            <div key={idx} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-pulse">
                                <div className="h-56 bg-slate-200" />
                                <div className="p-6 space-y-3">
                                    <div className="h-5 bg-slate-200 rounded w-3/4" />
                                    <div className="h-4 bg-slate-100 rounded w-full" />
                                    <div className="h-4 bg-slate-100 rounded w-1/2" />
                                    <div className="pt-4 flex justify-between items-center">
                                        <div className="h-6 bg-slate-200 rounded w-1/3" />
                                        <div className="h-8 bg-slate-200 rounded w-1/3" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredServices.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto shadow-sm">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                            <BellRing className="w-7 h-7" />
                        </div>
                        <h4 className="text-base font-bold text-slate-800">Không tìm thấy dịch vụ trong mục này</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-4">Vui lòng chọn tab khác hoặc xem toàn bộ danh mục dịch vụ.</p>
                        <button
                            onClick={() => setActiveFilter('all')}
                            className="px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white rounded-xl text-xs font-semibold shadow-md shadow-sky-900/20 transition cursor-pointer"
                        >
                            Xem Tất Cả
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                        {filteredServices.slice(0, 6).map((item) => {
                            const imgSrc = item.display_image || item.image_url || 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80';
                            const categoryName = item.category_name || item.category?.name || (`Dịch vụ ${starCount} sao`);
                            const badgeText = item.badge || (Number(item.price) > 1000000 ? 'Đặc Quyền VIP' : 'Được Yêu Thích');

                            return (
                                <div
                                    key={item.id}
                                    className="group bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-amber-300 transition-all duration-300 flex flex-col justify-between h-full"
                                >
                                    {/* Image Wrapper */}
                                    <div className="relative h-60 overflow-hidden bg-slate-100 shrink-0">
                                        <img
                                            src={imgSrc}
                                            alt={item.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/20" />

                                        {/* Category Badge Top Left */}
                                        <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 text-amber-300 text-[11px] font-bold border border-white/10 shadow-sm">
                                            {getCategoryIconComponent(categoryName)}
                                            <span>{categoryName}</span>
                                        </span>

                                        {/* Status Badge Top Right */}
                                        <span className="absolute top-4 right-4 inline-flex items-center px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-600 to-amber-700 text-white text-[10px] font-black uppercase tracking-wider shadow-md">
                                            {badgeText}
                                        </span>

                                        {/* Price overlay at bottom of image */}
                                        <div className="absolute bottom-3 left-4 right-4 flex items-baseline justify-between text-white">
                                            <span className="text-xs text-slate-200 font-medium">Giá phục vụ:</span>
                                            <span className="text-xl font-black text-amber-300 drop-shadow-sm">
                                                {formatPrice(item.price)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Body Content */}
                                    <div className="p-6 flex-1 flex flex-col justify-between">
                                        <div>
                                            <h3 className="font-serif text-lg font-bold text-slate-900 group-hover:text-amber-700 transition line-clamp-1 min-h-[1.75rem] mb-2">
                                                {item.name}
                                            </h3>
                                            <p className="text-slate-500 text-xs sm:text-sm line-clamp-2 leading-relaxed font-normal min-h-[2.5rem] mb-6">
                                                {item.description || `Dịch vụ đẳng cấp được chế tác riêng phục vụ khách hàng lưu trú tại ${hotelName}.`}
                                            </p>
                                        </div>

                                        {/* Actions pinned at bottom */}
                                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 mt-auto">
                                            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                <span>Phục vụ 24/7</span>
                                            </span>
                                            <Link
                                                to="/services"
                                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs transition duration-200 shadow-md shadow-sky-900/20 group-hover:shadow"
                                            >
                                                <span>Xem & Đặt Món</span>
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 3. LUXURY SERVICES PROMOTION BANNER (Nền trắng nhẹ nhàng, thanh lịch) */}
                <div className="mt-16 bg-white rounded-3xl p-8 sm:p-12 text-slate-800 shadow-xl shadow-slate-200/60 border border-slate-200/90 relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-8 transform-gpu">
                    {/* Background Glow nhẹ nhàng bằng Radial Gradient thay vì blur nặng */}
                    <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-[radial-gradient(circle,rgba(251,191,36,0.12),transparent_70%)] pointer-events-none" />
                    <div className="absolute -left-20 -top-20 w-80 h-80 bg-[radial-gradient(circle,rgba(251,191,36,0.08),transparent_70%)] pointer-events-none" />

                    <div className="space-y-3 text-center lg:text-left max-w-2xl relative z-10">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200/80 shadow-xs">
                            <BellRing className="w-3.5 h-3.5 text-amber-600" />
                            <span>IN-ROOM DINING & CONCIERGE SERVICE</span>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 leading-snug">
                            Trải Nghiệm Đầy Đủ Thực Đơn Ẩm Thực & Tiện Ích Phòng {starCount} Sao
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                            Khách sạn hỗ trợ khách lưu trú gọi món ăn, đồ uống và đặt lịch The Lotus Spa trực tuyến qua điện thoại hoặc máy tính bảng trong phòng. Bộ phận Concierge giao tận cửa phòng chỉ trong 20 - 30 phút.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0 w-full lg:w-auto relative z-10">
                        <Link
                            to="/services"
                            className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-xs sm:text-sm uppercase tracking-wider rounded-xl transition shadow-lg shadow-sky-900/20 text-center flex items-center justify-center gap-2"
                        >
                            <span>Khám Phá Menu Dịch Vụ</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                        <a
                            href={`tel:${(settings?.hotline || '1900 8899').replace(/\s+/g, '')}`}
                            className="w-full sm:w-auto px-6 py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 font-bold text-xs sm:text-sm rounded-xl transition shadow-xs text-center flex items-center justify-center gap-2"
                        >
                            <Phone className="w-3.5 h-3.5 text-amber-600" />
                            <span>Hotline Phục Vụ: {settings?.hotline || '1900 8899'}</span>
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}
