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
import { useHotelSettings, DEFAULT_BANNERS } from '../../store/hotelSettingStore';
import { resolveMediaUrl } from '../../utils/mediaUrl';

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
        display_image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=800&q=80",
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

// Helper xác định nhóm danh mục dịch vụ (dining | spa | drinks | other)
const getServiceGroup = (item) => {
    const catName = (item?.category_name || item?.category?.name || '').toLowerCase();
    if (catName.includes('spa') || catName.includes('massage') || catName.includes('trị liệu') || catName.includes('chăm sóc') || catName.includes('wellness')) {
        return 'spa';
    }
    if (catName.includes('uống') || catName.includes('bar') || catName.includes('rượu') || catName.includes('vang') || catName.includes('trà') || catName.includes('cà phê') || catName.includes('cocktail')) {
        return 'drinks';
    }
    if (catName.includes('ẩm thực') || catName.includes('ăn') || catName.includes('f&b') || catName.includes('bò') || catName.includes('món') || catName.includes('dining')) {
        return 'dining';
    }
    return 'other';
};

// Helper nhãn nút CTA linh hoạt theo từng nhóm dịch vụ
const getServiceCtaLabel = (catName) => {
    const text = (catName || '').toLowerCase();
    if (text.includes('spa') || text.includes('wellness') || text.includes('trị liệu') || text.includes('massage')) {
        return 'Đặt Lịch Spa';
    }
    if (text.includes('uống') || text.includes('rượu') || text.includes('bar') || text.includes('vang') || text.includes('trà') || text.includes('cà phê')) {
        return 'Đặt Đồ Uống';
    }
    if (text.includes('ẩm thực') || text.includes('món') || text.includes('ăn') || text.includes('dining')) {
        return 'Xem & Đặt Món';
    }
    return 'Xem & Đặt Ngay';
};

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

    // Lọc dịch vụ theo tab; riêng tab "Tất Cả Dịch Vụ" chỉ hiển thị Thức ăn (dining) và Nước uống (drinks)
    const displayedServices = (() => {
        if (activeFilter !== 'all') {
            return displayList.filter((item) => getServiceGroup(item) === activeFilter).slice(0, 6);
        }

        const diningItems = displayList.filter((item) => getServiceGroup(item) === 'dining');
        const drinkItems = displayList.filter((item) => getServiceGroup(item) === 'drinks');

        // Kết hợp cân đối Thức ăn & Nước uống (ưu tiên 4 món ăn + 2 đồ uống trên lưới 6 thẻ)
        const selectedDrinks = drinkItems.slice(0, 2);
        const selectedDining = diningItems.slice(0, 6 - selectedDrinks.length);
        const combined = [...selectedDining, ...selectedDrinks];

        // Nếu tổng vẫn chưa đủ 6 thẻ thì bù thêm từ phần còn lại của dining hoặc drinks
        if (combined.length < 6) {
            const usedIds = new Set(combined.map((i) => i.id));
            for (const item of [...diningItems, ...drinkItems]) {
                if (!usedIds.has(item.id) && combined.length < 6) {
                    combined.push(item);
                    usedIds.add(item.id);
                }
            }
        }
        return combined;
    })();

    // Định dạng giá tiền chuẩn VND
    const formatPrice = (price) => {
        const num = Number(price) || 0;
        return num.toLocaleString('vi-VN') + ' ₫';
    };

    return (
        <section id="menu-dich-vu" className="py-16 sm:py-20 bg-gradient-to-b from-[#f4f8fb] via-[#f8fafc] to-[#f4f8fb] border-y border-slate-200/60 relative overflow-hidden transform-gpu">
            {/* Background Decorator Lights - sử dụng Radial Gradient nhẹ nhàng */}
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.12),transparent_70%)] pointer-events-none" />
            <div className="absolute bottom-10 right-0 w-[450px] h-[450px] bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.08),transparent_70%)] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                {/* 1. SECTION HEADER */}
                <div className="text-center max-w-3xl mx-auto mb-7">
                    <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-amber-700 mb-3">
                        ẨM THỰC &amp; DỊCH VỤ
                    </span>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-slate-900 tracking-tight leading-tight">
                        Tinh Hoa Dịch Vụ Nghỉ Dưỡng <br />
                        <span className="bg-gradient-to-r from-slate-900 via-amber-800 to-amber-600 bg-clip-text text-transparent inline-block transform-gpu">
                            Phục Vụ Tận Phòng 24/7
                        </span>
                    </h2>
                    <p className="text-slate-600 text-sm sm:text-base mt-3.5 leading-relaxed font-normal">
                        Thưởng thức mỹ vị ẩm thực thượng hạng, liệu trình The Lotus Spa thư giãn tái tạo năng lượng và hệ thống đồ uống cao cấp ngay trong không gian riêng tư của quý khách.
                    </p>
                </div>

                {/* Filter Tabs: Tách khỏi max-w-3xl để 4 nút nằm gọn 1 hàng cân đối trên Desktop */}
                <div className="max-w-5xl mx-auto mb-10 sm:mb-12">
                    <div className="flex flex-wrap lg:flex-nowrap items-center justify-center gap-2 sm:gap-2.5">
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
                                    className={`px-4 sm:px-5 py-2.5 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
                                        activeFilter === tab.id
                                            ? 'bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 text-white shadow-[0_8px_20px_-6px_rgba(2,132,199,0.45)] ring-1 ring-inset ring-white/20 scale-[1.03]'
                                            : 'bg-white text-slate-600 hover:bg-sky-50/60 hover:text-sky-700 border border-slate-200/90 hover:border-sky-300 shadow-2xs'
                                    }`}
                                >
                                    <TabIcon className="w-3.5 h-3.5 shrink-0" />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 2. SERVICES GRID */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
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
                ) : displayedServices.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto shadow-sm">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                            <BellRing className="w-7 h-7" />
                        </div>
                        <h4 className="text-base font-bold text-slate-800">Không tìm thấy dịch vụ trong mục này</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-4">Vui lòng chọn tab khác hoặc xem toàn bộ danh mục dịch vụ.</p>
                        <button
                            onClick={() => setActiveFilter('all')}
                            className="px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white rounded-xl text-xs font-semibold shadow-[0_8px_20px_-6px_rgba(2,132,199,0.45)] transition cursor-pointer"
                        >
                            Xem Tất Cả
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
                        {displayedServices.map((item) => {
                            const imgSrc = item.display_image || item.image_url || 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=80';
                            const categoryName = item.category_name || item.category?.name || (`Dịch vụ ${starCount} sao`);
                            const ctaLabel = getServiceCtaLabel(categoryName);

                            return (
                                <div
                                    key={item.id}
                                    className="group bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.08)] hover:shadow-[0_18px_40px_-14px_rgba(15,23,42,0.16)] hover:border-sky-200/90 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between h-full"
                                >
                                    {/* Image Wrapper: Chỉ giữ 1 nhãn danh mục góc trái, bỏ nhãn giả góc phải để ảnh thoáng đẹp */}
                                    <div className="relative h-56 sm:h-60 overflow-hidden bg-slate-100 shrink-0">
                                        <img
                                            src={imgSrc}
                                            alt={item.name}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/25 via-transparent to-black/10 pointer-events-none" />

                                        {/* Category Badge Top Left */}
                                        <span className="absolute top-3.5 left-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/60 backdrop-blur-md text-amber-200 text-[11px] font-semibold border border-white/15 shadow-xs">
                                            {getCategoryIconComponent(categoryName)}
                                            <span>{categoryName}</span>
                                        </span>
                                    </div>

                                    {/* Body Content */}
                                    <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mb-1.5">
                                                <Clock className="w-3 h-3 text-amber-600/80" />
                                                <span>Phục vụ tận phòng 24/7</span>
                                            </div>
                                            <h3 className="font-serif text-lg font-bold text-slate-900 group-hover:text-sky-700 transition-colors line-clamp-2 min-h-[3rem] leading-snug mb-2">
                                                {item.name}
                                            </h3>
                                            <p className="text-slate-500 text-xs sm:text-[13px] line-clamp-2 leading-relaxed font-normal min-h-[2.5rem] mb-5">
                                                {item.description || `Dịch vụ đẳng cấp được chế tác riêng phục vụ khách hàng lưu trú tại ${hotelName}.`}
                                            </p>
                                        </div>

                                        {/* Price & CTA pinned cleanly at bottom */}
                                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 mt-auto">
                                            <div className="min-w-0">
                                                <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                                                    Giá phục vụ
                                                </span>
                                                <span className="text-lg font-black text-slate-900 tracking-tight tabular-nums whitespace-nowrap">
                                                    {formatPrice(item.price)}
                                                </span>
                                            </div>
                                            <Link
                                                to="/services"
                                                state={{ serviceId: item.id }}
                                                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-xs transition-all duration-200 shadow-[0_8px_20px_-6px_rgba(2,132,199,0.45)] hover:shadow-[0_12px_24px_-6px_rgba(2,132,199,0.55)] ring-1 ring-inset ring-white/20 hover:-translate-y-0.5 active:scale-95 whitespace-nowrap shrink-0"
                                            >
                                                <span>{ctaLabel}</span>
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 3. LUXURY SERVICES PROMOTION BANNER (Giữ nguyên tông sáng trắng thanh lịch, bổ sung cụm ảnh minh họa sang trọng) */}
                <div className="mt-14 bg-gradient-to-br from-white via-white to-amber-50/40 rounded-3xl p-6 sm:p-10 text-slate-800 shadow-[0_18px_45px_-15px_rgba(15,23,42,0.1)] border border-amber-200/60 ring-1 ring-slate-900/5 relative overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-center gap-7 sm:gap-8 transform-gpu">
                    {/* Background Glow nhẹ nhàng bằng Radial Gradient thay vì blur nặng */}
                    <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-[radial-gradient(circle,rgba(251,191,36,0.14),transparent_70%)] pointer-events-none" />
                    <div className="absolute -left-20 -top-20 w-80 h-80 bg-[radial-gradient(circle,rgba(14,165,233,0.08),transparent_70%)] pointer-events-none" />

                    {/* Cột trái: Nội dung & Nút bấm (7 cột) */}
                    <div className="lg:col-span-7 space-y-4 text-center lg:text-left relative z-10">
                        <span className="block text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
                            IN-ROOM DINING &amp; CONCIERGE SERVICE
                        </span>
                        <h3 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 leading-snug">
                            Trải Nghiệm Đầy Đủ Thực Đơn Ẩm Thực & Tiện Ích Phòng {starCount} Sao
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                            Khách sạn hỗ trợ khách lưu trú gọi món ăn, đồ uống và đặt lịch The Lotus Spa trực tuyến qua điện thoại hoặc máy tính bảng trong phòng. Bộ phận Concierge giao tận cửa phòng chỉ trong 20 - 30 phút.
                        </p>

                        <div className="pt-1 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
                            <Link
                                to="/services"
                                className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-xs sm:text-sm uppercase tracking-wider rounded-xl transition-all shadow-[0_10px_24px_-6px_rgba(2,132,199,0.45)] hover:shadow-[0_14px_28px_-6px_rgba(2,132,199,0.55)] ring-1 ring-inset ring-white/20 hover:-translate-y-0.5 active:scale-95 text-center flex items-center justify-center gap-2"
                            >
                                <span>Khám Phá Menu Dịch Vụ</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                            <a
                                href={`tel:${(settings?.hotline || '1900 8899').replace(/\s+/g, '')}`}
                                className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 hover:border-amber-300 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs text-center flex items-center justify-center gap-2"
                            >
                                <Phone className="w-3.5 h-3.5 text-amber-600" />
                                <span>Hotline Phục Vụ: {settings?.hotline || '1900 8899'}</span>
                            </a>
                        </div>
                    </div>

                    {/* Cột phải: Cụm 2 ảnh minh họa In-Room Dining & Spa đồng bộ từ Cài Đặt Hệ Thống (5 cột) */}
                    <div className="lg:col-span-5 grid grid-cols-2 gap-3 sm:gap-4 relative z-10">
                        <div className="relative h-40 sm:h-48 rounded-2xl overflow-hidden shadow-md border border-slate-200/80 group">
                            <img
                                src={resolveMediaUrl(settings?.concierge_dining_img, DEFAULT_BANNERS.concierge_dining_img)}
                                alt="Ẩm thực phục vụ tận phòng"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />
                            <span className="absolute bottom-2.5 left-3 right-3 text-white text-[11px] font-bold">
                                Ẩm Thực Tại Phòng
                            </span>
                        </div>
                        <div className="relative h-40 sm:h-48 rounded-2xl overflow-hidden shadow-md border border-slate-200/80 group">
                            <img
                                src={resolveMediaUrl(settings?.concierge_spa_img, DEFAULT_BANNERS.concierge_spa_img)}
                                alt="Liệu trình The Lotus Spa"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />
                            <span className="absolute bottom-2.5 left-3 right-3 text-white text-[11px] font-bold">
                                The Lotus Spa 24/7
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
