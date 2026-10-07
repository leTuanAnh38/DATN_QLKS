import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Tag,
    Copy,
    Check,
    Clock,
    Sparkles,
    Gift,
    ShieldCheck,
    ArrowRight,
    Search,
    Percent,
    Star,
    Crown,
    ChevronDown,
    ChevronUp,
    Calendar,
    Flame,
    CheckCircle2,
    Wine,
    Coffee,
    Compass,
    Mail,
    PhoneCall
} from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { promotionService } from '../../services/promotionService';

export default function PromotionsPage() {
    const navigate = useNavigate();

    // 1. STATE DỮ LIỆU KHUYẾN MÃI TỪ BACKEND
    const [dbPromotions, setDbPromotions] = useState([]);
    const [isLoadingPromos, setIsLoadingPromos] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedCode, setCopiedCode] = useState(null);
    const [activeFaq, setActiveFaq] = useState(null);
    const [activePromoTab, setActivePromoTab] = useState('all'); // 'all' | 'percentage' | 'fixed'

    // 2. STATE ĐỒNG HỒ ĐẾM NGƯỢC FLASH SALE (COUNTDOWN TIMER)
    const [timeLeft, setTimeLeft] = useState({
        days: 2,
        hours: 14,
        minutes: 38,
        seconds: 45
    });

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev.seconds > 0) {
                    return { ...prev, seconds: prev.seconds - 1 };
                } else if (prev.minutes > 0) {
                    return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
                } else if (prev.hours > 0) {
                    return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
                } else if (prev.days > 0) {
                    return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
                }
                return prev;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // 3. TẢI DỮ LIỆU VOUCHER THỰC TẾ TỪ BACKEND API
    useEffect(() => {
        const loadPromotions = async () => {
            setIsLoadingPromos(true);
            try {
                const res = await promotionService.getPromotions();
                if (res.success && Array.isArray(res.data) && res.data.length > 0) {
                    setDbPromotions(res.data);
                } else {
                    // Fallback mặc định phong phú nếu database chưa có voucher nào
                    setDbPromotions([
                        {
                            id: 1,
                            code: 'WELCOME10',
                            name: 'Ưu đãi Chào mừng Khách mới',
                            discount_type: 'percentage',
                            discount_value: 10,
                            min_order_value: 1500000,
                            max_discount_amount: 500000,
                            valid_to: '2026-12-31T23:59:59Z',
                            usage_limit: 500,
                            used_count: 128,
                            is_active: true
                        },
                        {
                            id: 2,
                            code: 'SUMMER2026',
                            name: 'Tuyệt tác Biển Hè Rực Rỡ 2026',
                            discount_type: 'percentage',
                            discount_value: 15,
                            min_order_value: 2000000,
                            max_discount_amount: 800000,
                            valid_to: '2026-08-31T23:59:59Z',
                            usage_limit: 200,
                            used_count: 85,
                            is_active: true
                        },
                        {
                            id: 3,
                            code: 'VIP10',
                            name: 'Đặc quyền Thành viên TA Club',
                            discount_type: 'percentage',
                            discount_value: 10,
                            min_order_value: 0,
                            max_discount_amount: null,
                            valid_to: '2026-12-31T23:59:59Z',
                            usage_limit: 1000,
                            used_count: 312,
                            is_active: true
                        },
                        {
                            id: 4,
                            code: 'TADANANG',
                            name: 'Tri ân Kỳ nghỉ Biển Đà Nẵng',
                            discount_type: 'fixed',
                            discount_value: 300000,
                            min_order_value: 3000000,
                            max_discount_amount: null,
                            valid_to: '2026-10-31T23:59:59Z',
                            usage_limit: 150,
                            used_count: 64,
                            is_active: true
                        }
                    ]);
                }
            } catch (err) {
                console.error('Lỗi tải danh sách khuyến mãi:', err);
            } finally {
                setIsLoadingPromos(false);
            }
        };

        loadPromotions();
    }, []);

    // 4. LỌC DANH SÁCH VOUCHER THỰC TẾ
    const filteredDbPromotions = useMemo(() => {
        return dbPromotions.filter((item) => {
            if (!item.is_active) return false;
            const query = searchTerm.toLowerCase().trim();
            const matchSearch =
                !query ||
                (item.code && item.code.toLowerCase().includes(query)) ||
                (item.name && item.name.toLowerCase().includes(query));

            if (!matchSearch) return false;

            if (activePromoTab === 'percentage') return item.discount_type === 'percentage';
            if (activePromoTab === 'fixed') return item.discount_type === 'fixed';
            return true;
        });
    }, [dbPromotions, searchTerm, activePromoTab]);

    // 5. SAO CHÉP MÃ VOUCHER 1-CHẠM
    const handleCopyCode = (code) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        try {
            localStorage.setItem('pending_promo_code', code);
        } catch {
            // ignore
        }
        setTimeout(() => setCopiedCode(null), 3000);
    };

    // 6. ÁP DỤNG VOUCHER & CHUYỂN HƯỚNG ĐẶT PHÒNG
    const handleApplyAndBook = (code) => {
        try {
            localStorage.setItem('pending_promo_code', code);
        } catch {
            // ignore
        }
        navigate(`/rooms?promo=${encodeURIComponent(code)}`);
    };

    // Format ngày hiển thị
    const formatDate = (dateStr) => {
        if (!dateStr) return 'Vô thời hạn';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    };

    // 7. CÁC GÓI NGHỈ DƯỠNG NỔI BẬT (FEATURED PACKAGES)
    const featuredPackages = [
        {
            id: 'pkg-1',
            badge: 'Trọn gói Nghỉ dưỡng & Suite',
            highlightBadge: 'Tiết kiệm 35%',
            title: 'Kỳ Nghỉ Hoàng Gia - Long Stay Special',
            description: 'Giảm 35% cho kỳ nghỉ từ 3 đêm trở lên tại các hạng Suite hướng biển Mỹ Khê, đưa đón Mercedes riêng & tặng thẻ ẩm thực 1.000.000đ.',
            perks: [
                'Đưa đón sân bay 2 chiều xe Limousine cao cấp',
                'Buffet sáng phong vị Michelin Selected hàng ngày',
                'Trà chiều Sunset High Tea tầng 25 miễn phí',
                'Tặng 60 phút massage thảo dược tại The Lotus Spa'
            ],
            originalPrice: '6.500.000đ',
            price: '4.225.000đ',
            unit: '/ đêm',
            code: 'LONGSTAY35',
            image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
        },
        {
            id: 'pkg-2',
            badge: 'Kỷ Niệm & Trăng Mật',
            highlightBadge: 'Tặng Bữa Tối Nến',
            title: 'Trăng Mật Thiên Đường - Honeymoon Serenade',
            description: 'Set trang trí bồn sục hoa hồng view biển, rượu vang Pháp Moët & Chandon ướp lạnh và bữa tối lãng mạn 5 món tại bãi biển riêng.',
            perks: [
                'Trang trí phòng tân hôn hoa tươi & bánh kem nghệ thuật',
                '1 Chai Champagne Moët & Chandon Imperial ướp lạnh',
                'Bữa tối nến 5 món phong vị Âu bên bờ biển riêng',
                'Nâng hạng phòng miễn phí lên Ocean Panorama Suite'
            ],
            originalPrice: '11.200.000đ',
            price: '7.850.000đ',
            unit: '/ gói 3N2Đ',
            code: 'HONEYMOON',
            image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80'
        },
        {
            id: 'pkg-3',
            badge: 'Ẩm thực & Sky Bar',
            highlightBadge: 'Buffet Tôm Hùm',
            title: 'Weekend Gourmet & Sky Bar Escape',
            description: 'Thưởng thức đại tiệc Buffet Hải sản Tôm hùm Nha Trang không giới hạn tại nhà hàng Ocean Breeze và chill trọn vẹn tại Sky Bar 28.',
            perks: [
                'Buffet Tôm hùm và hàu Pháp chế biến nóng tại bàn',
                'Miễn phí 02 Signature Cocktail tại Sky Bar tầng 28',
                'Check-in nhận phòng sớm từ 11:00 trưa không phụ phí',
                'Bể bơi vô cực nước ấm chân mây view biển Mỹ Khê'
            ],
            originalPrice: '2.400.000đ',
            price: '1.680.000đ',
            unit: '/ khách',
            code: 'GOURMET28',
            image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80'
        }
    ];

    // 8. HẠNG THẺ HỘI VIÊN VIP
    const membershipTiers = [
        {
            name: 'Hội Viên Bạc (Silver)',
            level: 'Hạng Khởi Đầu',
            color: 'from-slate-500 to-slate-700',
            border: 'border-slate-200',
            bg: 'bg-white',
            discount: 'Giảm 5%',
            points: 'Tích 1x Điểm',
            benefits: [
                'Chiết khấu trực tiếp 5% mọi đơn đặt phòng',
                'Ưu tiên check-in tại quầy Priority',
                'Miễn phí đồ uống chào đón Welcome Drink',
                'Tặng voucher sinh nhật trị giá 200.000đ'
            ]
        },
        {
            name: 'Hội Viên Vàng (Gold)',
            level: 'Được Yêu Thích Nhất',
            color: 'from-amber-500 to-yellow-600',
            border: 'border-amber-300 ring-2 ring-amber-300/30',
            bg: 'bg-white',
            discount: 'Giảm 10%',
            points: 'Tích 1.5x Điểm',
            badge: 'POPULAR',
            benefits: [
                'Chiết khấu trực tiếp 10% giá phòng & ẩm thực',
                'Miễn phí nâng hạng phòng (khi có phòng trống)',
                'Check-out muộn tới 14:00 chiều',
                'Đĩa trái cây nhiệt đới tươi mới mỗi ngày',
                'Giảm 20% các dịch vụ tại The Lotus Spa'
            ]
        },
        {
            name: 'Kim Cương (Diamond VIP)',
            level: 'Đẳng Cấp Thượng Lưu',
            color: 'from-blue-600 to-indigo-700',
            border: 'border-blue-300 ring-2 ring-blue-300/30',
            bg: 'bg-white',
            discount: 'Giảm 15% - 20%',
            points: 'Tích 2x Điểm',
            badge: 'EXCLUSIVE',
            benefits: [
                'Chiết khấu tối đa 20% toàn bộ dịch vụ khách sạn',
                'Đưa đón sân bay Limousine Mercedes miễn phí',
                'Sử dụng không giới hạn Executive Lounge tầng 25',
                'Linh hoạt Check-in sớm 10:00 & Check-out trễ 16:00',
                'Quản gia riêng phục vụ 24/7 (Dedicated Butler)'
            ]
        }
    ];

    // 9. CÂU HỎI THƯỜNG GẶP
    const faqs = [
        {
            q: 'Làm thế nào để áp dụng mã giảm giá khi đặt phòng trực tuyến?',
            a: 'Quý khách chỉ cần bấm nút "Sao chép" ở bất kỳ thẻ voucher nào trên trang này, sau đó bấm "Sử dụng ngay" hoặc truy cập trang Đặt phòng. Tại bước thanh toán cuối cùng, dán mã vào ô "Mã khuyến mãi" và bấm "Áp dụng", hệ thống sẽ tự động trừ số tiền chiết khấu tương ứng.'
        },
        {
            q: 'Ưu đãi có áp dụng đồng thời với chính sách hoàn hủy miễn phí không?',
            a: 'Đa phần các gói ưu đãi tại Khách Sạn TA Đà Nẵng đều áp dụng chính sách hủy phòng hoặc đổi ngày linh hoạt miễn phí trước 24 giờ nhận phòng. Riêng các mã Flash Sale chớp nhoáng sẽ có ghi chú rõ ràng trên từng thẻ.'
        },
        {
            q: 'Mã khuyến mãi có áp dụng vào dịp Lễ, Tết hoặc cuối tuần không?',
            a: 'Các mã ưu đãi như WELCOME10, VIP10 và SUMMER2026 áp dụng xuyên suốt tất cả các ngày trong tuần. Vào các ngày Lễ Tết cao điểm, một số gói có thể áp dụng phụ thu theo quy định dịch vụ nhưng vẫn giữ nguyên giá trị chiết khấu cam kết.'
        },
        {
            q: 'Tôi có thể dùng chung voucher giảm giá cùng với quyền lợi thẻ hội viên VIP không?',
            a: 'Có! Khách sạn TA Đà Nẵng khuyến khích hội viên tận hưởng đặc quyền tối đa. Quý khách có thể vừa áp dụng voucher chiến dịch vừa tích lũy điểm thưởng thành viên TA Club bình thường.'
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-amber-500 selection:text-white flex flex-col justify-between">
            {/* Top Navigation */}
            <div>
                <Navbar />

                {/* Breadcrumb Navigation */}
                <div className="bg-white border-b border-slate-200/80 py-3">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <nav className="flex items-center space-x-2 text-xs text-slate-500">
                            <Link to="/" className="hover:text-blue-600 transition font-medium">Trang chủ</Link>
                            <span>/</span>
                            <span className="text-slate-900 font-semibold">Ưu Đãi Đặc Quyền</span>
                        </nav>
                    </div>
                </div>

                {/* ============================================================== */}
                {/* 1. HERO SPOTLIGHT: ĐẬM CHẤT MARKETING NỀN SÁNG CAO CẤP VỚI COUNTDOWN */}
                {/* ============================================================== */}
                <header className="relative pt-12 pb-16 overflow-hidden bg-gradient-to-b from-blue-50/70 via-amber-50/25 to-slate-50 border-b border-slate-200/80">
                    {/* Ambient Glow Orbs */}
                    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[320px] bg-gradient-to-r from-blue-300/25 via-rose-300/20 to-amber-300/25 blur-3xl rounded-full pointer-events-none -z-0" />
                    <div className="absolute -top-20 right-10 w-72 h-72 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        <div className="text-center max-w-3xl mx-auto">
                            {/* Top Live Badge */}
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold uppercase tracking-widest shadow-xs mb-5 animate-pulse">
                                <Flame className="w-4 h-4 text-rose-500" />
                                <span>ĐẶC QUYỀN ĐỘC BẢN 2026 • CHIẾT KHẤU TỚI 35%</span>
                            </div>

                            {/* Royal Headline */}
                            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-tight">
                                Kho Ưu Đãi & Voucher{' '}
                                <span className="bg-gradient-to-r from-amber-600 via-rose-600 to-orange-500 bg-clip-text text-transparent">
                                    Thượng Lưu
                                </span>
                            </h1>

                            <p className="mt-4 text-sm sm:text-base text-slate-600 font-normal leading-relaxed max-w-2xl mx-auto">
                                Tận hưởng kỳ nghỉ biển chuẩn 5 sao quốc tế tại Khách Sạn TA Đà Nẵng với cam kết giá tốt nhất,
                                miễn phí nâng hạng phòng và voucher giảm giá trực tiếp cho mọi lượt đặt.
                            </p>

                            {/* FLASH SALE COUNTDOWN TIMER */}
                            <div className="mt-8 inline-flex flex-col items-center bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/60">
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-widest mb-3">
                                    <Clock className="w-4 h-4 text-amber-600 animate-spin" style={{ animationDuration: '8s' }} />
                                    <span>Chớp Nhoáng Giờ Vàng — Ưu Đãi Kết Thúc Sau:</span>
                                </div>

                                <div className="flex items-center gap-2 sm:gap-4 font-mono">
                                    <div className="flex flex-col items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 sm:px-5 py-2 min-w-[64px] shadow-xs">
                                        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{String(timeLeft.days).padStart(2, '0')}</span>
                                        <span className="text-[10px] text-slate-500 uppercase font-sans font-medium">Ngày</span>
                                    </div>
                                    <span className="text-xl sm:text-2xl font-bold text-slate-300">:</span>
                                    <div className="flex flex-col items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 sm:px-5 py-2 min-w-[64px] shadow-xs">
                                        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{String(timeLeft.hours).padStart(2, '0')}</span>
                                        <span className="text-[10px] text-slate-500 uppercase font-sans font-medium">Giờ</span>
                                    </div>
                                    <span className="text-xl sm:text-2xl font-bold text-slate-300">:</span>
                                    <div className="flex flex-col items-center bg-slate-50 border border-slate-200 rounded-2xl px-3.5 sm:px-5 py-2 min-w-[64px] shadow-xs">
                                        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{String(timeLeft.minutes).padStart(2, '0')}</span>
                                        <span className="text-[10px] text-slate-500 uppercase font-sans font-medium">Phút</span>
                                    </div>
                                    <span className="text-xl sm:text-2xl font-bold text-slate-300">:</span>
                                    <div className="flex flex-col items-center bg-rose-50 border border-rose-200 rounded-2xl px-3.5 sm:px-5 py-2 min-w-[64px] shadow-xs">
                                        <span className="text-2xl sm:text-3xl font-extrabold text-rose-600">{String(timeLeft.seconds).padStart(2, '0')}</span>
                                        <span className="text-[10px] text-rose-500 uppercase font-sans font-medium">Giây</span>
                                    </div>
                                </div>
                            </div>

                            {/* Search Bar */}
                            <div className="mt-8 max-w-lg mx-auto relative">
                                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Tìm kiếm voucher: WELCOME10, Hè 2026, VIP..."
                                    className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-white border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 shadow-md transition"
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* ============================================================== */}
                {/* 2. REAL VOUCHERS HUB: THẺ TICKET CẮT RĂNG CƯA TỪ DATABASE THẬT */}
                {/* ============================================================== */}
                <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header kho voucher */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-widest mb-1.5">
                                <Sparkles className="w-4 h-4 text-amber-600" />
                                <span>VOUCHER KHUYẾN MÃI ĐANG KÍCH HOẠT</span>
                            </div>
                            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
                                Kho Mã Giảm Giá Trực Tiếp
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                Sao chép mã 1-chạm và áp dụng ngay tại bước đặt phòng để nhận chiết khấu tức thì
                            </p>
                        </div>

                        {/* Filter Tabs (% vs Fixed) */}
                        <div className="flex items-center bg-white border border-slate-200 p-1 rounded-2xl shadow-xs self-start md:self-auto text-xs font-semibold">
                            <button
                                type="button"
                                onClick={() => setActivePromoTab('all')}
                                className={`px-4 py-2 rounded-xl transition cursor-pointer ${
                                    activePromoTab === 'all' ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                            >
                                Tất cả ({dbPromotions.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActivePromoTab('percentage')}
                                className={`px-4 py-2 rounded-xl transition cursor-pointer ${
                                    activePromoTab === 'percentage' ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                            >
                                Giảm %
                            </button>
                            <button
                                type="button"
                                onClick={() => setActivePromoTab('fixed')}
                                className={`px-4 py-2 rounded-xl transition cursor-pointer ${
                                    activePromoTab === 'fixed' ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                            >
                                Giảm tiền mặt
                            </button>
                        </div>
                    </div>

                    {/* Grid Voucher Cards (Ticket Stub Design) */}
                    {isLoadingPromos ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[1, 2, 3, 4].map((n) => (
                                <div key={n} className="h-64 rounded-3xl bg-slate-200/60 animate-pulse border border-slate-200" />
                            ))}
                        </div>
                    ) : filteredDbPromotions.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
                            <Tag className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                            <h3 className="text-base font-bold text-slate-900">Không tìm thấy voucher phù hợp</h3>
                            <p className="text-xs text-slate-500 mt-1">Quý khách vui lòng thử tìm kiếm với từ khóa khác</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {filteredDbPromotions.map((promo) => {
                                const isPercentage = promo.discount_type === 'percentage';
                                const isCopied = copiedCode === promo.code;

                                return (
                                    <div
                                        key={promo.id || promo.code}
                                        className="relative bg-white rounded-3xl border border-slate-200 hover:border-amber-400 p-6 flex flex-col justify-between shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden"
                                    >
                                        {/* Perforated ticket cutout circle (notch effect) */}
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-slate-50 rounded-full border-b border-slate-200" />
                                        <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-6 bg-slate-50 rounded-full border-r border-slate-200" />
                                        <div className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 bg-slate-50 rounded-full border-l border-slate-200" />

                                        {/* Card Header & Discount Value */}
                                        <div>
                                            <div className="flex items-center justify-between gap-2 mb-3">
                                                <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold uppercase tracking-wider">
                                                    {isPercentage ? 'Giảm %' : 'Tiền mặt'}
                                                </span>
                                                <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                    <span>Hạn: {formatDate(promo.valid_to)}</span>
                                                </span>
                                            </div>

                                            {/* Mức giảm to bản ấn tượng */}
                                            <div className="mb-3">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-rose-600 to-orange-500">
                                                        {isPercentage ? `-${promo.discount_value}%` : `-${Number(promo.discount_value).toLocaleString('vi-VN')}đ`}
                                                    </span>
                                                </div>
                                                <h3 className="text-sm font-bold text-slate-900 line-clamp-1 mt-1 group-hover:text-blue-600 transition-colors">
                                                    {promo.name || `Khuyến mãi ${promo.code}`}
                                                </h3>
                                            </div>

                                            {/* Điều kiện áp dụng */}
                                            <div className="space-y-1.5 text-[11px] text-slate-600 border-t border-slate-100 pt-3 mb-4">
                                                {promo.min_order_value > 0 ? (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Đơn tối thiểu:</span>
                                                        <strong className="text-slate-900 font-semibold">{Number(promo.min_order_value).toLocaleString('vi-VN')} đ</strong>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Đơn tối thiểu:</span>
                                                        <strong className="text-emerald-600 font-bold">Không giới hạn</strong>
                                                    </div>
                                                )}

                                                {isPercentage && promo.max_discount_amount && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-500">Giảm tối đa:</span>
                                                        <strong className="text-slate-900 font-semibold">{Number(promo.max_discount_amount).toLocaleString('vi-VN')} đ</strong>
                                                    </div>
                                                )}

                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Lượt đã dùng:</span>
                                                    <span className="text-amber-700 font-bold">{promo.used_count || 0}/{promo.usage_limit || 100}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Coupon Code Block & Action Buttons */}
                                        <div className="pt-2">
                                            <div className="flex items-center justify-between bg-amber-50/80 border border-dashed border-amber-300 rounded-2xl px-3.5 py-2.5 mb-3">
                                                <div className="min-w-0">
                                                    <span className="text-[9px] uppercase tracking-wider text-amber-800 block font-bold">Mã Voucher:</span>
                                                    <span className="font-mono text-sm font-extrabold text-amber-900 tracking-wider truncate block">
                                                        {promo.code}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyCode(promo.code)}
                                                    className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-bold ${
                                                        isCopied
                                                            ? 'bg-emerald-600 text-white shadow-xs'
                                                            : 'bg-white hover:bg-amber-100 text-amber-900 border border-amber-200'
                                                    }`}
                                                    title="Sao chép mã voucher"
                                                >
                                                    {isCopied ? (
                                                        <>
                                                            <Check className="w-3.5 h-3.5" />
                                                            <span className="text-[10px]">Đã chép</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3.5 h-3.5" />
                                                            <span className="text-[10px]">Chép</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleApplyAndBook(promo.code)}
                                                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                                            >
                                                <span>Sử Dụng Ngay</span>
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* ============================================================== */}
                {/* 3. GÓI NGHỈ DƯỠNG TRỌN GÓI THƯỢNG LƯU (CURATED PACKAGES) */}
                {/* ============================================================== */}
                <section className="py-16 bg-white border-t border-slate-200/80">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center max-w-2xl mx-auto mb-12">
                            <span className="text-xs font-bold text-rose-600 uppercase tracking-widest block mb-2">
                                GÓI KỲ NGHỈ ĐỘC BẢN
                            </span>
                            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900">
                                Tuyệt Tác Nghỉ Dưỡng Trọn Gói
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 mt-2">
                                Trải nghiệm trọn vẹn phong vị ẩm thực thượng lưu, chăm sóc sức khỏe và nghỉ dưỡng ven biển
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {featuredPackages.map((pkg) => (
                                <div
                                    key={pkg.id}
                                    className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-lg hover:shadow-2xl hover:border-slate-300 flex flex-col justify-between group hover:-translate-y-1.5 transition-all duration-300"
                                >
                                    <div>
                                        {/* Cover Image & Badges */}
                                        <div className="relative h-60 w-full overflow-hidden">
                                            <img
                                                src={pkg.image}
                                                alt={pkg.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent" />
                                            <div className="absolute top-4 left-4 flex flex-col gap-1.5 items-start">
                                                <span className="px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur-md text-white text-[10px] font-bold">
                                                    {pkg.badge}
                                                </span>
                                                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 text-white text-[10px] font-bold shadow-md">
                                                    {pkg.highlightBadge}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Body */}
                                        <div className="p-6">
                                            <h3 className="font-serif font-bold text-slate-900 text-lg group-hover:text-blue-600 transition-colors mb-2">
                                                {pkg.title}
                                            </h3>
                                            <p className="text-xs text-slate-600 leading-relaxed mb-4">
                                                {pkg.description}
                                            </p>

                                            {/* Perks checklist */}
                                            <ul className="space-y-2 border-t border-slate-100 pt-4 mb-4">
                                                {pkg.perks.map((perk, i) => (
                                                   <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                                        <span className="text-[11px] leading-tight">{perk}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Footer Price & Action */}
                                    <div className="p-6 pt-0 border-t border-slate-100">
                                        <div className="flex items-baseline justify-between pt-4 mb-4">
                                            <div>
                                                <span className="text-xs text-slate-400 line-through block">{pkg.originalPrice}</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-2xl font-bold text-amber-600">{pkg.price}</span>
                                                    <span className="text-xs text-slate-500">{pkg.unit}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Mã gói:</span>
                                                <strong className="font-mono text-xs text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                                    {pkg.code}
                                                </strong>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleApplyAndBook(pkg.code)}
                                            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                        >
                                            <span>Đặt Gói Này Ngay</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ============================================================== */}
                {/* 4. CHƯƠNG TRÌNH HỘI VIÊN VIP TA CLUB (LOYALTY TIERS) */}
                {/* ============================================================== */}
                <section className="py-16 bg-slate-50 border-t border-slate-200/80">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center max-w-2xl mx-auto mb-12">
                            <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">
                                <Crown className="w-4 h-4 text-amber-600" />
                                <span>ĐẶC QUYỀN HỘI VIÊN TA CLUB</span>
                            </div>
                            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900">
                                Tích Điểm Tối Đa & Nâng Hạng Thẻ
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 mt-2">
                                Đăng ký hoàn toàn miễn phí để nhận ngay chiết khấu phòng và quyền lợi VIP suốt kỳ nghỉ
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {membershipTiers.map((tier, idx) => (
                                <div
                                    key={idx}
                                    className={`rounded-3xl border ${tier.border} ${tier.bg} p-6 sm:p-8 flex flex-col justify-between shadow-md relative overflow-hidden group hover:-translate-y-1 transition-all`}
                                >
                                    {tier.badge && (
                                        <span className="absolute top-4 right-4 bg-amber-400 text-slate-950 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                                            {tier.badge}
                                        </span>
                                    )}

                                    <div>
                                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-r ${tier.color} flex items-center justify-center text-white mb-4 shadow-md`}>
                                            <Crown className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">{tier.level}</span>
                                        <h3 className="text-xl font-serif font-bold text-slate-900 mt-1 mb-2">{tier.name}</h3>

                                        <div className="flex items-baseline gap-2 mb-6">
                                            <span className="text-3xl font-extrabold text-amber-600">{tier.discount}</span>
                                            <span className="text-xs text-slate-500">• {tier.points}</span>
                                        </div>

                                        <ul className="space-y-2.5 text-xs text-slate-600 border-t border-slate-100 pt-4 mb-6">
                                            {tier.benefits.map((b, i) => (
                                                <li key={i} className="flex items-start gap-2">
                                                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                                    <span>{b}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <Link
                                        to="/login"
                                        className="w-full py-3 rounded-xl border border-slate-200 hover:border-blue-600 text-slate-700 hover:text-blue-600 hover:bg-blue-50/50 bg-white text-xs font-bold text-center transition block shadow-xs"
                                    >
                                        Đăng Ký Thành Viên Ngay
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ============================================================== */}
                {/* 5. CAM KẾT 4 TRỤ CỘT ĐẶT TRỰC TIẾP (BEST RATE GUARANTEE) */}
                {/* ============================================================== */}
                <section className="py-16 bg-white border-t border-slate-200/80">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center max-w-2xl mx-auto mb-12">
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest block mb-2">
                                LỢI ÍCH ĐỘC QUYỀN
                            </span>
                            <h2 className="font-serif text-3xl font-bold text-slate-900">
                                Tại Sao Luôn Đặt Phòng Trực Tiếp Tại Website?
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition">
                                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl font-bold mb-4 border border-amber-200 shadow-xs">
                                    💎
                                </div>
                                <h3 className="font-serif font-bold text-slate-900 text-base mb-2">Cam Kết Giá Tốt Nhất</h3>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Best Rate Guarantee: Bồi hoàn 100% phần chênh lệch và giảm thêm 10% nếu quý khách tìm thấy giá rẻ hơn trên bất kỳ đại lý nào.
                                </p>
                            </div>

                            <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition">
                                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center text-2xl font-bold mb-4 border border-blue-200 shadow-xs">
                                    🕒
                                </div>
                                <h3 className="font-serif font-bold text-slate-900 text-base mb-2">Nhận Sớm & Trả Muộn</h3>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Linh hoạt nhận phòng sớm từ 10:00 sáng và trả phòng trễ đến 15:00 chiều không phụ thu (ưu tiên phụ thuộc tình trạng phòng).
                                </p>
                            </div>

                            <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition">
                                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center text-2xl font-bold mb-4 border border-rose-200 shadow-xs">
                                    🍸
                                </div>
                                <h3 className="font-serif font-bold text-slate-900 text-base mb-2">Đón Tiếp 5 Sao Cá Nhân</h3>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Nước trái cây hữu cơ chào đón pha chế riêng, đĩa hoa quả nhiệt đới tươi mới mỗi ngày và quyền chọn hướng phòng đẹp nhất.
                                </p>
                            </div>

                            <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-bold mb-4 border border-emerald-200 shadow-xs">
                                    📅
                                </div>
                                <h3 className="font-serif font-bold text-slate-900 text-base mb-2">Đổi Ngày Miễn Phí 24H</h3>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Dễ dàng thay đổi lịch trình và hủy đơn không mất phí trước 24 giờ nhận phòng cho tất cả các đơn đặt trên website chính thức.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ============================================================== */}
                {/* 6. HƯỚNG DẪN 3 BƯỚC ÁP DỤNG MÃ (HOW IT WORKS) */}
                {/* ============================================================== */}
                <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-200/80">
                    <div className="text-center max-w-2xl mx-auto mb-10">
                        <span className="text-xs font-bold text-amber-700 uppercase tracking-widest block mb-1">
                            TIỆN LỢI & NHANH CHÓNG
                        </span>
                        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
                            Cách Áp Dụng Mã Ưu Đãi Chỉ Trong 3 Bước
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-center relative hover:shadow-md transition">
                            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-serif font-bold text-xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-blue-600/25">
                                1
                            </div>
                            <h3 className="font-bold text-slate-900 text-base mb-1.5">Sao Chép Mã Ưu Đãi</h3>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Chọn chương trình phù hợp trên trang này và bấm nút <strong>"Chép"</strong> để lưu mã voucher vào bộ nhớ tạm.
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-center relative hover:shadow-md transition">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white font-serif font-bold text-xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-amber-500/25">
                                2
                            </div>
                            <h3 className="font-bold text-slate-900 text-base mb-1.5">Chọn Phòng Yêu Thích</h3>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Truy cập danh sách phòng, lựa chọn hạng phòng Suite và số đêm lưu trú lý tưởng cho kỳ nghỉ của quý khách.
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-center relative hover:shadow-md transition">
                            <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white font-serif font-bold text-xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-rose-500/25">
                                3
                            </div>
                            <h3 className="font-bold text-slate-900 text-base mb-1.5">Dán Mã & Nhận Chiết Khấu</h3>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Dán mã tại ô <strong>"Mã khuyến mãi"</strong> ở bước thanh toán để được trừ tiền trực tiếp vào hóa đơn phòng.
                            </p>
                        </div>
                    </div>
                </section>

                {/* ============================================================== */}
                {/* 7. FAQ ACCORDION & CONCIERGE 24/7 */}
                {/* ============================================================== */}
                <section className="py-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-200/80">
                    <div className="text-center mb-8">
                        <span className="text-xs font-bold text-rose-600 uppercase tracking-widest block mb-1">
                            HỖ TRỢ KHÁCH HÀNG
                        </span>
                        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
                            Câu Hỏi Thường Gặp Về Khuyến Mãi
                        </h2>
                    </div>

                    <div className="space-y-3">
                        {faqs.map((faq, idx) => (
                            <div
                                key={idx}
                                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs transition hover:border-slate-300"
                            >
                                <button
                                    type="button"
                                    onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm text-slate-800 hover:text-blue-600 transition cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-slate-100 text-blue-600 text-xs flex items-center justify-center font-bold border border-slate-200">
                                            {idx + 1}
                                        </span>
                                        <span>{faq.q}</span>
                                    </div>
                                    <span className="text-slate-400 font-bold">
                                        {activeFaq === idx ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </span>
                                </button>
                                {activeFaq === idx && (
                                    <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3 bg-slate-50/60">
                                        {faq.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Concierge Banner */}
                    <div className="mt-10 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-indigo-400/30">
                        <div className="text-left">
                            <strong className="text-white text-sm sm:text-base font-bold block">Cần hỗ trợ đặt phòng hoặc tư vấn ưu đãi đặc biệt?</strong>
                            <span className="text-xs text-blue-100">Đội ngũ Concierge phục vụ 24/7 luôn sẵn sàng hỗ trợ quý khách.</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <a
                                href="tel:19008899"
                                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
                            >
                                <PhoneCall className="w-4 h-4" />
                                <span>1900 8899</span>
                            </a>
                            <Link
                                to="/contact"
                                className="px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/25 transition"
                            >
                                Liên Hệ Concierge
                            </Link>
                        </div>
                    </div>
                </section>
            </div>

            {/* Reusable Footer */}
            <Footer />
        </div>
    );
}