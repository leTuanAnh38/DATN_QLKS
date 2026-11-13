import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Tag,
    Copy,
    Check,
    Clock,
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
    PhoneCall,
    CalendarCheck,
    Gem,
    X,
    Sparkles,
    Building2
} from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { promotionService } from '../../services/promotionService';
import { roomService } from '../../services/roomService';
import { hotelService } from '../../services/hotelService';
import { useHotelSettings, DEFAULT_BANNERS } from '../../store/hotelSettingStore';
import { resolveMediaUrl } from '../../utils/mediaUrl';

// ============================================================================
// HÀM TIỆN ÍCH & LOGIC KHUYẾN MÃI / GÓI NGHỈ DƯỠNG
// ============================================================================

// Thời gian tối đa để hiển thị đồng hồ đếm ngược (chỉ đếm khi voucher sắp hết hạn trong 30 ngày)
const COUNTDOWN_MAX_MS = 30 * 24 * 60 * 60 * 1000;

// Trích xuất URL hình ảnh hợp lệ từ object hạng phòng (tránh lỗi [object Object] khi images là array các đối tượng)
const extractCategoryImageUrl = (category, fallback) => {
    if (!category) return fallback;

    // 1. Kiểm tra feature_image dạng chuỗi
    if (typeof category.feature_image === 'string' && category.feature_image.trim()) {
        return resolveMediaUrl(category.feature_image, fallback);
    }

    // 2. Kiểm tra mảng images (chứa [{ id, image, image_url, is_feature }])
    if (Array.isArray(category.images) && category.images.length > 0) {
        const featureObj = category.images.find((img) => img && img.is_feature);
        const targetObj = featureObj || category.images[0];
        const raw =
            (typeof targetObj === 'string' && targetObj) ||
            targetObj?.image_url ||
            targetObj?.image;
        if (typeof raw === 'string' && raw.trim()) {
            return resolveMediaUrl(raw, fallback);
        }
    }

    // 3. Kiểm tra image_url hoặc image dạng chuỗi trực tiếp
    if (typeof category.image_url === 'string' && category.image_url.trim()) {
        return resolveMediaUrl(category.image_url, fallback);
    }
    if (typeof category.image === 'string' && category.image.trim()) {
        return resolveMediaUrl(category.image, fallback);
    }

    return fallback;
};

// Bỏ dấu tiếng Việt để so khớp tên hạng phòng / dịch vụ linh hoạt
const stripDiacritics = (str) =>
    String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase();

// Voucher còn hiệu lực: đang kích hoạt, trong thời hạn, còn lượt dùng
const isPromoLive = (promo, nowTs) => {
    if (!promo || promo.is_active === false) return false;
    if (promo.valid_from && new Date(promo.valid_from).getTime() > nowTs) return false;
    if (promo.valid_to && new Date(promo.valid_to).getTime() < nowTs) return false;
    const limit = Number(promo.usage_limit || 0);
    if (limit > 0 && Number(promo.used_count || 0) >= limit) return false;
    return true;
};

// Tính tiền giảm chuẩn logic ValidatePromoCodeView từ backend
const calcPromoDiscount = (promo, orderValue) => {
    if (!promo) return 0;
    if (promo.discount_type === 'percentage') {
        let discount = (orderValue * Number(promo.discount_value || 0)) / 100;
        if (promo.max_discount_amount) {
            discount = Math.min(discount, Number(promo.max_discount_amount));
        }
        return Math.round(discount);
    }
    return Math.min(orderValue, Number(promo.discount_value || 0));
};

const formatVnd = (value) => `${Math.round(Number(value) || 0).toLocaleString('vi-VN')}đ`;

const toDateInput = (date) => {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
};

// Dữ liệu dự phòng khi API chưa sẵn sàng hoặc rỗng
const FALLBACK_PROMOTIONS = [
    {
        id: 1,
        code: 'WELCOME10',
        name: 'Ưu đãi Chào mừng Khách mới',
        discount_type: 'percentage',
        discount_value: 10,
        min_order_value: 1500000,
        max_discount_amount: 500000,
        valid_from: '2026-01-01T00:00:00Z',
        valid_to: '2026-12-31T23:59:59Z',
        usage_limit: 500,
        used_count: 128,
        is_active: true
    },
    {
        id: 2,
        code: 'SUMMER2026',
        name: 'Tuyệt tác Nghỉ Dưỡng Mùa Lễ Hội 2026',
        discount_type: 'percentage',
        discount_value: 15,
        min_order_value: 2000000,
        max_discount_amount: 800000,
        valid_from: '2026-01-01T00:00:00Z',
        valid_to: '2026-12-31T23:59:59Z',
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
        valid_from: '2026-01-01T00:00:00Z',
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
        valid_from: '2026-01-01T00:00:00Z',
        valid_to: '2026-12-31T23:59:59Z',
        usage_limit: 150,
        used_count: 64,
        is_active: true
    }
];

const FALLBACK_CATEGORIES = [
    {
        id: 4,
        name: 'Grand Suite Oceanfront',
        base_price: 3800000,
        promo_price: 3420000,
        max_occupancy: 2,
        image_url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
    },
    {
        id: 3,
        name: 'Premier Ocean View King',
        base_price: 3200000,
        promo_price: 2880000,
        max_occupancy: 2,
        image_url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80'
    },
    {
        id: 1,
        name: 'Deluxe King City View',
        base_price: 1800000,
        promo_price: 1620000,
        max_occupancy: 2,
        image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80'
    }
];

const FALLBACK_SERVICES = [
    { id: 1, name: 'Đưa Đón Sân Bay Bằng Xe Maybach / Limousine', price: 2000000, is_active: true },
    { id: 2, name: 'Set Trà Chiều Hoàng Gia Royal High Tea', price: 350000, is_active: true },
    { id: 3, name: 'Massage Toàn Thân Đá Nóng Núi Lửa (60 Phút)', price: 650000, is_active: true },
    { id: 4, name: 'Vang Đỏ Bordeaux Grand Cru (Ly)', price: 240000, is_active: true },
    { id: 5, name: 'Bò Wagyu Úc Nướng Than Hoa Sốt Tiêu Rừng', price: 740000, is_active: true },
    { id: 6, name: 'Súp Tôm Hùm Nha Trang Saffron', price: 380000, is_active: true },
    { id: 7, name: 'Cocktail Đà Nẵng Sunset Signature', price: 190000, is_active: true },
    { id: 8, name: 'Set Thêm Gối Lông Vũ & Khăn Tắm Cao Cấp', price: 0, is_active: true }
];

// MẪU NỘI DUNG 3 GÓI NGHỈ DƯỠNG TRỌN GÓI
// Cấu hình ghép động với Hạng phòng, Dịch vụ và Voucher thật từ hệ thống
const PACKAGE_TEMPLATES = [
    {
        id: 'pkg-royal',
        badge: 'Suite Hướng Biển & Tiện Ích',
        title: 'Kỳ Nghỉ Hoàng Gia Đà Nẵng - Royal Oceanfront',
        description:
            'Trải nghiệm đỉnh cao tại phòng hướng biển Mỹ Khê, dịch vụ xe Limousine đưa đón sân bay và Set Trà Chiều Hoàng Gia ngắm hoàng hôn.',
        image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
        tier: 'premium',
        categoryKeywords: ['royal', 'presidential', 'penthouse', 'grand premier', 'suite'],
        promoCodes: ['SUMMER2026', 'VIP10', 'WELCOME10'],
        extraPerk: 'Hỗ trợ nhận phòng sớm & ưu tiên chọn tầng cao hướng biển',
        services: [
            { anyOf: ['dua don', 'limousine', 'maybach'], quantity: 1 },
            { anyOf: ['tra chieu', 'high tea'], quantity: 1 },
            { anyOf: ['massage toan than', 'massage', 'tri lieu co vai gay', 'spa'], quantity: 1 }
        ]
    },
    {
        id: 'pkg-honeymoon',
        badge: 'Kỷ Niệm & Trăng Mật',
        title: 'Trăng Mật Lãng Mạn - Oceanfront Honeymoon',
        description:
            'Không gian hướng biển ấm cúng cùng ly vang đỏ Bordeaux hảo hạng và bữa tối Bò Wagyu Úc nướng than hoa sốt tiêu rừng dành cho cặp đôi.',
        image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80',
        tier: 'comfort',
        categoryKeywords: ['oceanfront', 'seafront', 'ocean', 'king', 'suite'],
        promoCodes: ['WELCOME10', 'VIP10', 'SUMMER2026'],
        extraPerk: 'Trang trí bồn tắm hoa tươi lãng mạn & bánh kem kỷ niệm nghệ thuật',
        services: [
            { anyOf: ['bordeaux', 'vang do', 'ruou vang'], quantity: 1 },
            { anyOf: ['wagyu', 'bo'], quantity: 1 }
        ]
    },
    {
        id: 'pkg-gourmet',
        badge: 'Ẩm Thực & Tri Ân',
        title: 'Kỳ Nghỉ Ẩm Thực Biển - Luxury Gourmet',
        description:
            'Tận hưởng kỳ nghỉ biển tiện nghi sang trọng kết hợp đại tiệc Súp tôm hùm Nha Trang Saffron, Cocktail ngắm hoàng hôn và bộ gối lông vũ theo yêu cầu.',
        image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
        tier: 'standard',
        categoryKeywords: ['deluxe', 'superior', 'standard'],
        promoCodes: ['TADANANG', 'WELCOME10', 'VIP10'],
        extraPerk: 'Miễn phí dịch vụ giặt hấp lấy ngay 01 lượt & trà thảo mộc đón tiếp',
        services: [
            { anyOf: ['sup tom hum', 'tom hum'], quantity: 1 },
            { anyOf: ['sunset signature', 'cocktail'], quantity: 2 },
            { anyOf: ['goi long vu', 'goi'], quantity: 1 }
        ]
    }
];

export default function PromotionsPage() {
    const navigate = useNavigate();
    const { settings } = useHotelSettings();
    const starCount = settings?.stars || 3;
    const hotelName = settings?.hotel_name || 'Khách Sạn TA Đà Nẵng';

    // 1. STATE DỮ LIỆU TỪ HỆ THỐNG
    const [dbPromotions, setDbPromotions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [serviceCatalog, setServiceCatalog] = useState([]);
    const [isLoadingPromos, setIsLoadingPromos] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedCode, setCopiedCode] = useState(null);
    const [activeFaq, setActiveFaq] = useState(null);
    const [activePromoTab, setActivePromoTab] = useState('all'); // 'all' | 'percentage' | 'fixed'
    const [nowTs, setNowTs] = useState(() => Date.now());

    // 2. TẢI DỮ LIỆU ĐỒNG THỜI: VOUCHERS + HẠNG PHÒNG + DỊCH VỤ THỰC TẾ
    useEffect(() => {
        let isMounted = true;
        const loadAllData = async () => {
            setIsLoadingPromos(true);
            try {
                const [promoRes, catRes, svcRes] = await Promise.allSettled([
                    promotionService.getPromotions(),
                    roomService.getCategories(),
                    hotelService.getServices({ status: 'active' })
                ]);

                if (!isMounted) return;

                // Xử lý promotions
                if (promoRes.status === 'fulfilled' && promoRes.value?.success && Array.isArray(promoRes.value.data) && promoRes.value.data.length > 0) {
                    setDbPromotions(promoRes.value.data);
                } else {
                    setDbPromotions(FALLBACK_PROMOTIONS);
                }

                // Xử lý categories
                if (catRes.status === 'fulfilled') {
                    const cVal = catRes.value;
                    let list = [];
                    if (Array.isArray(cVal?.categories)) list = cVal.categories;
                    else if (Array.isArray(cVal)) list = cVal;
                    else if (Array.isArray(cVal?.results)) list = cVal.results;
                    else if (Array.isArray(cVal?.data)) list = cVal.data;

                    setCategories(list.length > 0 ? list : FALLBACK_CATEGORIES);
                } else {
                    setCategories(FALLBACK_CATEGORIES);
                }

                // Xử lý services
                if (svcRes.status === 'fulfilled' && svcRes.value?.success && Array.isArray(svcRes.value.items) && svcRes.value.items.length > 0) {
                    setServiceCatalog(svcRes.value.items.filter((s) => s.is_active !== false));
                } else {
                    setServiceCatalog(FALLBACK_SERVICES);
                }

                setNowTs(Date.now());
            } catch (err) {
                console.error('Lỗi khi tải dữ liệu trang khuyến mãi:', err);
                if (isMounted) {
                    setDbPromotions(FALLBACK_PROMOTIONS);
                    setCategories(FALLBACK_CATEGORIES);
                    setServiceCatalog(FALLBACK_SERVICES);
                }
            } finally {
                if (isMounted) {
                    setIsLoadingPromos(false);
                }
            }
        };

        loadAllData();
        return () => {
            isMounted = false;
        };
    }, []);

    // 3. DANH SÁCH VOUCHER CÒN HIỆU LỰC (ACTIVE + TRONG THỜI HẠN + CÒN LƯỢT DÙNG)
    const livePromotions = useMemo(
        () => dbPromotions.filter((item) => isPromoLive(item, nowTs)),
        [dbPromotions, nowTs]
    );

    // 4. TÍNH TOÁN ĐỒNG HỒ ĐẾM NGƯỢC THẬT (COUNTDOWN TIMER)
    // Đếm ngược theo voucher sắp hết hạn gần nhất trong vòng 30 ngày
    const nearestExpiringPromo = useMemo(() => {
        return (
            [...livePromotions]
                .filter((p) => p.valid_to && !isNaN(new Date(p.valid_to).getTime()))
                .sort((a, b) => new Date(a.valid_to).getTime() - new Date(b.valid_to).getTime())[0] || null
        );
    }, [livePromotions]);

    const msLeft = nearestExpiringPromo
        ? Math.max(0, new Date(nearestExpiringPromo.valid_to).getTime() - nowTs)
        : 0;
    const showCountdown = Boolean(nearestExpiringPromo) && msLeft > 0 && msLeft <= COUNTDOWN_MAX_MS;

    const timeLeft = {
        days: Math.floor(msLeft / 86400000),
        hours: Math.floor(msLeft / 3600000) % 24,
        minutes: Math.floor(msLeft / 60000) % 60,
        seconds: Math.floor(msLeft / 1000) % 60
    };

    // Tự động đếm ngược mỗi giây khi có voucher đang đếm
    useEffect(() => {
        if (!showCountdown) return undefined;
        const timer = setInterval(() => setNowTs(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [showCountdown]);

    // Mức chiết khấu % cao nhất hiện có
    const maxPercentVoucher = useMemo(() => {
        const list = livePromotions
            .filter((p) => p.discount_type === 'percentage')
            .map((p) => Number(p.discount_value) || 0);
        return list.length > 0 ? Math.max(...list) : 0;
    }, [livePromotions]);

    // 5. LỌC DANH SÁCH VOUCHER THEO TÌM KIẾM & PHÂN LOẠI
    const filteredDbPromotions = useMemo(() => {
        return livePromotions.filter((item) => {
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
    }, [livePromotions, searchTerm, activePromoTab]);

    // 6. SAO CHÉP MÃ VOUCHER 1-CHẠM
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

    // 7. ÁP DỤNG VOUCHER & CHUYỂN HƯỚNG ĐẶT PHÒNG
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

    // 8. TÍNH TOÁN CÁC GÓI NGHỈ DƯỠNG TRỌN GÓI THỰC TẾ
    // Ghép hạng phòng DB + Dịch vụ DB + Voucher DB, tính giá động theo số đêm lưu trú
    const packages = useMemo(() => {
        const poolCategories = categories.length > 0 ? categories : FALLBACK_CATEGORIES;
        const poolServices = serviceCatalog.length > 0 ? serviceCatalog : FALLBACK_SERVICES;

        const priceOf = (c) => Number(c.promo_price || c.base_price || 0);
        const sortedCats = [...poolCategories]
            .filter((c) => priceOf(c) > 0)
            .sort((a, b) => priceOf(a) - priceOf(b));

        if (sortedCats.length === 0) return [];

        const pickCategory = (tpl) => {
            const matched = sortedCats.filter((c) =>
                tpl.categoryKeywords.some((kw) => stripDiacritics(c.name).includes(kw))
            );
            const pool = matched.length > 0 ? matched : sortedCats;
            if (tpl.tier === 'premium') return pool[pool.length - 1];
            if (tpl.tier === 'standard') return pool[0];
            return pool[Math.floor((pool.length - 1) / 2)];
        };

        return PACKAGE_TEMPLATES.map((tpl) => {
            const category = pickCategory(tpl);
            if (!category) return null;

            // Ghép dịch vụ thật từ hệ thống
            const bundle = [];
            tpl.services.forEach((def) => {
                let found = null;
                for (const kw of def.anyOf) {
                    found = poolServices.find((s) => stripDiacritics(s.name).includes(kw));
                    if (found) break;
                }
                if (found && !bundle.some((b) => String(b.service_id) === String(found.id))) {
                    bundle.push({
                        service_id: found.id,
                        name: found.name,
                        price: Number(found.price || 0),
                        quantity: def.quantity || 1
                    });
                }
            });

            // Tìm promo code phù hợp và còn hiệu lực
            const promo =
                tpl.promoCodes
                    .map((code) =>
                        dbPromotions.find(
                            (p) => String(p.code).toUpperCase() === code && isPromoLive(p, nowTs)
                        )
                    )
                    .find(Boolean) || null;

            const roomPrice = priceOf(category);
            let nightsNeeded = 1;
            let perNightAfter = roomPrice;
            let discountTotal = 0;

            if (promo) {
                const minOrder = Number(promo.min_order_value || 0);
                nightsNeeded = Math.max(1, Math.ceil(minOrder / roomPrice));
                const orderValue = roomPrice * nightsNeeded;
                discountTotal = calcPromoDiscount(promo, orderValue);
                perNightAfter = Math.round((orderValue - discountTotal) / nightsNeeded);
            }

            const bundleTotal = bundle.reduce((sum, b) => sum + b.price * b.quantity, 0);
            const fallbackImage = tpl.image || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80';
            const cardImage = extractCategoryImageUrl(category, fallbackImage);

            return {
                ...tpl,
                category,
                bundle,
                promo,
                roomPrice,
                perNightAfter,
                nightsNeeded,
                hasDiscount: Boolean(promo) && discountTotal > 0,
                bundleTotal,
                cardImage,
                fallbackImage
            };
        }).filter(Boolean);
    }, [categories, serviceCatalog, dbPromotions, nowTs]);

    // 9. ĐẶT GÓI TRỌN GÓI: Chuyển hướng trực tiếp vào /checkout/:categoryId kèm dịch vụ & mã giảm giá
    const handleBookPackage = (pkg) => {
        const checkIn = new Date();
        const checkOut = new Date();
        checkOut.setDate(checkOut.getDate() + (pkg.nightsNeeded || 1));

        if (pkg.promo?.code) {
            try {
                localStorage.setItem('pending_promo_code', pkg.promo.code);
            } catch {
                // ignore
            }
        }

        navigate(`/checkout/${pkg.category.id}`, {
            state: {
                checkInDate: toDateInput(checkIn),
                checkOutDate: toDateInput(checkOut),
                promoCode: pkg.promo ? pkg.promo.code : '',
                packageServices: pkg.bundle.map((b) => ({
                    service_id: b.service_id,
                    quantity: b.quantity
                }))
            }
        });
    };

    // 10. HẠNG THẺ HỘI VIÊN VIP (ĐỒNG BỘ 100% VỚI HỆ THỐNG LOYALTY DATABASE)
    const membershipTiers = [
        {
            name: 'Đồng (Bronze)',
            code: 'BRONZE',
            level: 'Hạng Khởi Đầu',
            color: 'from-amber-800 to-amber-950',
            border: 'border-amber-900/15 hover:border-amber-700/40',
            bg: 'bg-white',
            discount: 'Giảm 0%',
            points: '0 điểm',
            pointsDesc: 'Đăng ký tài khoản nhận ngay',
            btnClass: 'border border-slate-200 hover:border-amber-500 text-slate-700 hover:text-amber-800 hover:bg-amber-50/50 bg-white',
            benefits: [
                'Tích 1 điểm cho mỗi 100.000 VNĐ thanh toán',
                'Quản lý lịch sử đặt phòng & hóa đơn trực tuyến',
                'Nhận thông báo ưu đãi độc quyền Flash Sale',
                'Áp dụng voucher chào mừng thành viên mới'
            ]
        },
        {
            name: 'Bạc (Silver)',
            code: 'SILVER',
            level: 'Thành Viên Thân Thiết',
            color: 'from-slate-500 to-slate-700',
            border: 'border-slate-200 hover:border-slate-400',
            bg: 'bg-white',
            discount: 'Giảm 5%',
            points: 'Từ 100 điểm',
            pointsDesc: 'Chi tiêu tích lũy từ 10.000.000đ',
            btnClass: 'border border-slate-200 hover:border-amber-500 text-slate-700 hover:text-amber-800 hover:bg-amber-50/50 bg-white',
            benefits: [
                'Tự động chiết khấu 5% tiền phòng mọi đơn đặt',
                'Tích lũy điểm thăng hạng nhanh chóng',
                'Ưu tiên check-in tại quầy riêng (Priority)',
                'Tặng đồ uống chào đón Welcome Drink cao cấp'
            ]
        },
        {
            name: 'Vàng (Gold)',
            code: 'GOLD',
            level: 'Thành Viên VIP Vàng',
            color: 'from-amber-500 to-amber-700',
            border: 'border-amber-300 hover:border-amber-500 ring-2 ring-amber-400/20',
            bg: 'bg-gradient-to-b from-amber-50/40 to-white',
            discount: 'Giảm 10%',
            points: 'Từ 300 điểm',
            pointsDesc: 'Chi tiêu tích lũy từ 30.000.000đ',
            badge: 'Phổ biến nhất',
            btnClass: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold hover:shadow-md hover:shadow-amber-500/20',
            benefits: [
                'Tự động chiết khấu 10% tiền phòng mọi đơn đặt',
                'Hỗ trợ nhận phòng sớm / trả muộn miễn phí',
                'Tặng 01 Set Trà Chiều Hoàng Gia Royal High Tea',
                'Nâng hạng phòng miễn phí (theo phòng trống)'
            ]
        },
        {
            name: 'Kim Cương (Diamond)',
            code: 'DIAMOND',
            level: 'Đặc Quyền Tối Thượng',
            color: 'from-sky-500 via-indigo-600 to-slate-900',
            border: 'border-indigo-300 hover:border-indigo-500 ring-2 ring-indigo-500/25',
            bg: 'bg-gradient-to-b from-indigo-50/40 to-white',
            discount: 'Giảm 15%',
            points: 'Từ 600 điểm',
            pointsDesc: 'Chi tiêu tích lũy từ 60.000.000đ',
            badge: 'Thượng Lưu',
            btnClass: 'bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-600 text-white font-bold hover:shadow-md hover:shadow-indigo-500/25',
            benefits: [
                'Tự động chiết khấu 15% tiền phòng trọn đời',
                'Đưa đón sân bay bằng xe Maybach / Limousine miễn phí',
                'Miễn phí bữa sáng Buffet cao cấp cho cả phòng',
                'Dịch vụ Concierge VIP 24/7 phục vụ riêng biệt'
            ]
        }
    ];

    // 11. CÂU HỎI THƯỜNG GẶP
    const faqs = [
        {
            q: 'Làm thế nào để áp dụng mã giảm giá khi đặt phòng trực tuyến?',
            a: 'Quý khách chỉ cần bấm nút "Sao chép" ở bất kỳ thẻ voucher nào trên trang này, sau đó bấm "Sử dụng ngay" hoặc truy cập trang Đặt phòng. Tại bước thanh toán cuối cùng, dán mã vào ô "Mã khuyến mãi" và bấm "Áp dụng", hệ thống sẽ tự động trừ số tiền chiết khấu tương ứng.'
        },
        {
            q: 'Khi bấm "Đặt Gói Này Ngay" thì các dịch vụ đi kèm có được tự động tính vào hóa đơn không?',
            a: 'Có! Khi quý khách chọn gói nghỉ dưỡng trọn gói, hệ thống sẽ tự động chuyển thẳng sang trang Thanh toán với hạng phòng tương ứng, tự động điền mã ưu đãi của gói và kích hoạt sẵn toàn bộ danh sách dịch vụ đi kèm mà quý khách không cần phải chọn lại thủ công.'
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
                        <nav className="flex items-center space-x-2 text-xs text-slate-500 whitespace-nowrap overflow-x-auto no-scrollbar">
                            <Link to="/" className="hover:text-amber-600 transition font-medium shrink-0">Trang chủ</Link>
                            <span className="text-slate-300 shrink-0">/</span>
                            <span className="text-slate-900 font-semibold truncate min-w-0">Ưu Đãi Đặc Quyền</span>
                        </nav>
                    </div>
                </div>

                {/* ============================================================== */}
                {/* 1. HERO SPOTLIGHT: ĐẬM CHẤT MARKETING NỀN SÁNG CAO CẤP VỚI COUNTDOWN */}
                {/* ============================================================== */}
                <header className="relative pt-12 pb-16 overflow-hidden border-b border-slate-200/80">
                    {/* Background Dynamic Banner with refined light overlay */}
                    <div className="absolute inset-0 z-0">
                        <img
                            src={resolveMediaUrl(settings?.banner_promotions, DEFAULT_BANNERS.banner_promotions)}
                            alt="Khuyến Mãi Banner"
                            onError={(e) => {
                                if (e.currentTarget.src !== DEFAULT_BANNERS.banner_promotions) {
                                    e.currentTarget.src = DEFAULT_BANNERS.banner_promotions;
                                }
                            }}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-white/90 backdrop-blur-[2px]" />
                        <div className="absolute inset-0 bg-gradient-to-b from-amber-50/40 via-white/85 to-slate-50" />
                    </div>
                    {/* Ambient Glow Orbs */}
                    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[320px] bg-gradient-to-r from-blue-300/25 via-rose-300/20 to-amber-300/25 blur-3xl rounded-full pointer-events-none z-0" />
                    <div className="absolute -top-20 right-10 w-72 h-72 bg-amber-200/30 rounded-full blur-3xl pointer-events-none z-0" />

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        <div className="text-center max-w-3xl mx-auto">
                            {/* Top Live Badge */}
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold uppercase tracking-widest shadow-xs mb-5 animate-pulse">
                                <Flame className="w-4 h-4 text-rose-500" />
                                <span>
                                    {maxPercentVoucher > 0
                                        ? `ĐẶC QUYỀN ĐỘC BẢN 2026 • CHIẾT KHẤU TỚI ${maxPercentVoucher}%`
                                        : 'ĐẶC QUYỀN ĐỘC BẢN 2026 • KHO ƯU ĐÃI THỰC TẾ'}
                                </span>
                            </div>

                            {/* Royal Headline */}
                            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-tight">
                                Kho Ưu Đãi & Voucher{' '}
                                <span className="bg-gradient-to-r from-amber-600 via-rose-600 to-orange-500 bg-clip-text text-transparent">
                                    Thượng Lưu
                                </span>
                            </h1>

                            <p className="mt-4 text-sm sm:text-base text-slate-600 font-normal leading-relaxed max-w-2xl mx-auto">
                                Tận hưởng kỳ nghỉ biển chuẩn {starCount} sao quốc tế tại {hotelName} với cam kết giá tốt nhất,
                                miễn phí nâng hạng phòng và voucher giảm giá trực tiếp cho mọi lượt đặt.
                            </p>

                            {/* FLASH SALE COUNTDOWN TIMER HOẶC LIVE STATUS */}
                            {showCountdown ? (
                                <div className="mt-8 inline-flex flex-col items-center bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/60">
                                    <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-widest mb-3">
                                        <Clock className="w-4 h-4 text-amber-600 animate-spin" style={{ animationDuration: '8s' }} />
                                        <span>
                                            {nearestExpiringPromo?.name
                                                ? `Ưu Đãi "${nearestExpiringPromo.name}" Sắp Kết Thúc:`
                                                : 'Chớp Nhoáng Giờ Vàng — Ưu Đãi Kết Thúc Sau:'}
                                        </span>
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

                                    {nearestExpiringPromo?.code && (
                                        <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
                                            <span>Áp dụng mã:</span>
                                            <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                {nearestExpiringPromo.code}
                                            </span>
                                            <span>• Hạn đến {formatDate(nearestExpiringPromo.valid_to)}</span>
                                        </div>
                                    )}
                                </div>
                            ) : livePromotions.length > 0 ? (
                                <div className="mt-8 inline-flex items-center gap-3 bg-white/95 backdrop-blur-md border border-amber-200/90 rounded-2xl px-5 py-3 shadow-lg shadow-slate-200/50">
                                    <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
                                    <div className="text-left">
                                        <div className="text-xs font-bold text-slate-900">
                                            Đang kích hoạt {livePromotions.length} mã ưu đãi độc quyền
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            Sao chép mã bên dưới hoặc chọn gói kỳ nghỉ trọn gói để áp dụng ngay
                                        </div>
                                    </div>
                                </div>
                            ) : null}

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
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5" />
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
                                <Tag className="w-4 h-4 text-amber-600" />
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
                                    activePromoTab === 'all'
                                        ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white font-bold shadow-md shadow-sky-900/20'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                            >
                                Tất cả ({livePromotions.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActivePromoTab('percentage')}
                                className={`px-4 py-2 rounded-xl transition cursor-pointer ${
                                    activePromoTab === 'percentage'
                                        ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white font-bold shadow-md shadow-sky-900/20'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                }`}
                            >
                                Giảm %
                            </button>
                            <button
                                type="button"
                                onClick={() => setActivePromoTab('fixed')}
                                className={`px-4 py-2 rounded-xl transition cursor-pointer ${
                                    activePromoTab === 'fixed'
                                        ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white font-bold shadow-md shadow-sky-900/20'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
                            <p className="text-xs text-slate-500 mt-1">Quý khách vui lòng thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc</p>
                            {(searchTerm || activePromoTab !== 'all') && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setActivePromoTab('all');
                                    }}
                                    className="mt-4 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-200 transition cursor-pointer"
                                >
                                    Đặt lại bộ lọc
                                </button>
                            )}
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
                                                <h3 className="text-sm font-bold text-slate-900 line-clamp-1 mt-1 group-hover:text-amber-600 transition-colors">
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
                                                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 active:scale-95 text-white font-bold text-xs shadow-md shadow-sky-900/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
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
                {/* 3. GÓI NGHỈ DƯỠNG TRỌN GÓI THƯỢNG LƯU (CURATED PACKAGES THẬT) */}
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
                                Trải nghiệm trọn vẹn phong vị ẩm thực thượng lưu, chăm sóc sức khỏe và nghỉ dưỡng ven biển được kết hợp tự động
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {packages.map((pkg) => (
                                <div
                                    key={pkg.id}
                                    className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-lg hover:shadow-2xl hover:border-slate-300 flex flex-col justify-between group hover:-translate-y-1.5 transition-all duration-300"
                                >
                                    <div>
                                        {/* Cover Image & Badges */}
                                        <div className="relative h-60 w-full overflow-hidden bg-slate-100">
                                            <img
                                                src={pkg.cardImage}
                                                alt={pkg.title}
                                                onError={(e) => {
                                                    if (e.currentTarget.src !== pkg.fallbackImage) {
                                                        e.currentTarget.src = pkg.fallbackImage;
                                                    }
                                                }}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent" />
                                            <div className="absolute top-4 left-4 flex flex-col gap-1.5 items-start">
                                                <span className="px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur-md text-white text-[10px] font-bold">
                                                    {pkg.badge}
                                                </span>
                                                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 text-white text-[10px] font-bold shadow-md">
                                                    {pkg.promo
                                                        ? pkg.promo.discount_type === 'percentage'
                                                            ? `Giảm ${pkg.promo.discount_value}%`
                                                            : `Giảm ${formatVnd(pkg.promo.discount_value)}`
                                                        : 'Trọn Gói Phòng & Dịch Vụ'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Body */}
                                        <div className="p-6">
                                            <div className="mb-2">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-semibold mb-2">
                                                    <Building2 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                                    <span className="truncate">Hạng phòng: {pkg.category.name}</span>
                                                </span>
                                                <h3 className="font-serif font-bold text-slate-900 text-lg group-hover:text-amber-600 transition-colors">
                                                    {pkg.title}
                                                </h3>
                                            </div>

                                            <p className="text-xs text-slate-600 leading-relaxed mb-4">
                                                {pkg.description}
                                            </p>

                                            {/* Perks checklist (Chỉ chứa tiện ích thực tế, không đưa điểm tích lũy vào đây) */}
                                            <ul className="space-y-2 border-t border-slate-100 pt-4 mb-4">
                                                <li className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                                    <span className="text-[11px] leading-tight">
                                                        Lưu trú tại <strong>{pkg.category.name}</strong> (tiêu chuẩn {pkg.category.max_occupancy || 2} khách/phòng)
                                                    </span>
                                                </li>
                                                {pkg.bundle.map((b, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                                        <span className="text-[11px] leading-tight">
                                                            Tặng <strong>{b.name}</strong> {b.quantity > 1 ? `(x${b.quantity})` : ''} — Trị giá <span className="text-amber-800 font-semibold">{formatVnd(b.price * b.quantity)}</span>
                                                        </span>
                                                    </li>
                                                ))}
                                                {pkg.extraPerk && (
                                                    <li className="flex items-start gap-2 text-xs text-slate-700">
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                                        <span className="text-[11px] leading-tight">{pkg.extraPerk}</span>
                                                    </li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Footer Price & Action */}
                                    <div className="p-6 pt-0 border-t border-slate-100">
                                        <div className="flex items-baseline justify-between pt-4 mb-3">
                                            <div>
                                                {pkg.hasDiscount ? (
                                                    <>
                                                        <span className="text-xs text-slate-400 line-through block">
                                                            {formatVnd(pkg.roomPrice)}
                                                        </span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-2xl font-bold text-amber-600">
                                                                {formatVnd(pkg.perNightAfter)}
                                                            </span>
                                                            <span className="text-xs text-slate-500">/ đêm</span>
                                                        </div>
                                                        {pkg.nightsNeeded > 1 && (
                                                            <span className="text-[10px] text-slate-400 block mt-0.5">
                                                                (Áp dụng khi đặt từ {pkg.nightsNeeded} đêm)
                                                            </span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div>
                                                        <span className="text-[10px] text-slate-400 block uppercase font-medium">
                                                            Giá phòng tiêu chuẩn
                                                        </span>
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-2xl font-bold text-amber-600">
                                                                {formatVnd(pkg.roomPrice)}
                                                            </span>
                                                            <span className="text-xs text-slate-500">/ đêm</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                                                    {pkg.promo ? 'Mã ưu đãi:' : 'Hình thức:'}
                                                </span>
                                                <strong className="font-mono text-xs text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 block mt-0.5">
                                                    {pkg.promo ? pkg.promo.code : 'Trọn gói'}
                                                </strong>
                                            </div>
                                        </div>

                                        {/* Giá trị quà tặng dịch vụ đi kèm */}
                                        {pkg.bundleTotal > 0 && (
                                            <div className="mb-4 px-3 py-2 rounded-xl bg-emerald-50/80 border border-emerald-200/80 flex items-center justify-between text-[11px]">
                                                <span className="text-emerald-800 font-medium flex items-center gap-1.5">
                                                    <Gift className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                    <span>Dịch vụ tặng kèm:</span>
                                                </span>
                                                <strong className="text-emerald-700 font-bold">+{formatVnd(pkg.bundleTotal)}</strong>
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => handleBookPackage(pkg)}
                                            className="w-full py-3 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-900/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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
                        <div className="text-center max-w-2xl mx-auto mb-8">
                            <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">
                                <Crown className="w-4 h-4 text-amber-600" />
                                <span>ĐẶC QUYỀN HỘI VIÊN TA CLUB</span>
                            </div>
                            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-slate-900">
                                Tích Điểm Tối Đa & Nâng Hạng Thẻ
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
                                Đăng ký tài khoản miễn phí để tự động tích điểm sau mỗi kỳ nghỉ. Càng tích lũy nhiều điểm, hạng thẻ càng cao và chiết khấu phòng càng lớn!
                            </p>
                        </div>

                        {/* Thanh giải thích quy tắc tích điểm 100k = 1 pt */}
                        <div className="max-w-3xl mx-auto mb-10 p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-white to-amber-50 border border-amber-200/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-2xs">
                            <div className="flex items-center gap-3 text-amber-950">
                                <span className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-base shrink-0 shadow-sm">
                                    ★
                                </span>
                                <div>
                                    <strong className="block font-bold text-slate-900">Cơ chế tích điểm tự động của hệ thống</strong>
                                    <span className="text-slate-600 text-[11px]">
                                        Cứ mỗi <strong>100.000 VNĐ</strong> thanh toán hóa đơn thành công khi check-out = <strong>1 điểm</strong> tích lũy vào tài khoản.
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200">
                                    Tự động thăng hạng
                                </span>
                                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                                    Giảm tới 15% trọn đời
                                </span>
                            </div>
                        </div>

                        {/* 4 Hạng thẻ hội viên chuẩn hóa theo Database */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {membershipTiers.map((tier, idx) => (
                                <div
                                    key={idx}
                                    className={`rounded-3xl border ${tier.border} ${tier.bg} p-6 flex flex-col justify-between shadow-md relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-300`}
                                >
                                    {tier.badge && (
                                        <span className="absolute top-4 right-4 bg-amber-400 text-slate-950 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                                            {tier.badge}
                                        </span>
                                    )}

                                    <div>
                                        <div className={`w-11 h-11 rounded-2xl bg-gradient-to-r ${tier.color} flex items-center justify-center text-white mb-4 shadow-md`}>
                                            <Crown className="w-5 h-5" />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{tier.level}</span>
                                        <h3 className="text-lg font-serif font-bold text-slate-900 mt-0.5 mb-2">{tier.name}</h3>

                                        <div className="mb-4 pb-3 border-b border-slate-100">
                                            <div className="flex items-baseline gap-1.5">
                                                <span className="text-2xl font-black text-amber-600">{tier.discount}</span>
                                                <span className="text-xs font-bold text-slate-700">• {tier.points}</span>
                                            </div>
                                            <span className="text-[11px] text-slate-400 block mt-0.5">{tier.pointsDesc}</span>
                                        </div>

                                        <ul className="space-y-2 text-xs text-slate-600 mb-6">
                                            {tier.benefits.map((b, i) => (
                                                <li key={i} className="flex items-start gap-2">
                                                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                                    <span className="text-[11px] leading-snug">{b}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <Link
                                        to="/login"
                                        className={`w-full py-2.5 rounded-xl text-xs font-bold text-center transition block shadow-xs ${tier.btnClass || 'border border-slate-200 hover:border-amber-500 text-slate-700 hover:text-amber-800 bg-white'}`}
                                    >
                                        Đăng Ký / Xem Thẻ
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
                            <span className="text-xs font-bold text-amber-600 uppercase tracking-widest block mb-2">
                                LỢI ÍCH ĐỘC QUYỀN
                            </span>
                            <h2 className="font-serif text-3xl font-bold text-slate-900">
                                Tại Sao Luôn Đặt Phòng Trực Tiếp Tại Website?
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-200/80 hover:border-amber-300 hover:shadow-md transition group">
                                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200/80 shadow-xs group-hover:scale-110 transition-transform">
                                    <Gem className="w-6 h-6 text-amber-600" />
                                </div>
                                <h3 className="font-serif font-bold text-slate-900 text-base mb-2 group-hover:text-amber-700 transition-colors">
                                    Cam Kết Giá Tốt Nhất
                                </h3>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Best Rate Guarantee: Bồi hoàn 100% phần chênh lệch và giảm thêm 10% nếu quý khách tìm thấy giá rẻ hơn trên bất kỳ đại lý nào.
                                </p>
                            </div>

                            <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-200/80 hover:border-amber-300 hover:shadow-md transition group">
                                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200/80 shadow-xs group-hover:scale-110 transition-transform">
                                    <Clock className="w-6 h-6 text-amber-600" />
                                </div>
                                <h3 className="font-serif font-bold text-slate-900 text-base mb-2 group-hover:text-amber-700 transition-colors">
                                    Nhận Sớm & Trả Muộn
                                </h3>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Linh hoạt nhận phòng sớm từ 10:00 sáng và trả phòng trễ đến 15:00 chiều không phụ thu (ưu tiên phụ thuộc tình trạng phòng).
                                </p>
                            </div>

                            <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-200/80 hover:border-amber-300 hover:shadow-md transition group">
                                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200/80 shadow-xs group-hover:scale-110 transition-transform">
                                    <Wine className="w-6 h-6 text-amber-600" />
                                </div>
                                <h3 className="font-serif font-bold text-slate-900 text-base mb-2 group-hover:text-amber-700 transition-colors">
                                    Đón Tiếp Chuẩn {starCount} Sao Cá Nhân Hóa
                                </h3>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Nước trái cây hữu cơ chào đón pha chế riêng, đĩa hoa quả nhiệt đới tươi mới mỗi ngày và quyền chọn hướng phòng đẹp nhất.
                                </p>
                            </div>

                            <div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-200/80 hover:border-amber-300 hover:shadow-md transition group">
                                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200/80 shadow-xs group-hover:scale-110 transition-transform">
                                    <CalendarCheck className="w-6 h-6 text-amber-600" />
                                </div>
                                <h3 className="font-serif font-bold text-slate-900 text-base mb-2 group-hover:text-amber-700 transition-colors">
                                    Đổi Ngày Miễn Phí 24H
                                </h3>
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
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white font-serif font-bold text-xl flex items-center justify-center mx-auto mb-4 shadow-md shadow-amber-500/25">
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
                                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm text-slate-800 hover:text-amber-700 transition cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-full bg-amber-50 text-amber-700 text-xs flex items-center justify-center font-bold border border-amber-200">
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
                    <div className="mt-10 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-amber-500/30">
                        <div className="text-left">
                            <strong className="text-white text-sm sm:text-base font-bold flex items-center gap-2">
                                <PhoneCall className="w-4 h-4 text-amber-400" />
                                <span>Cần hỗ trợ đặt phòng hoặc tư vấn ưu đãi đặc biệt?</span>
                            </strong>
                            <span className="text-xs text-amber-100/70">Đội ngũ Concierge phục vụ 24/7 luôn sẵn sàng hỗ trợ quý khách.</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <a
                                href={`tel:${(settings?.hotline || '1900 8899').replace(/\s+/g, '')}`}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-sky-900/20 transition cursor-pointer"
                            >
                                <PhoneCall className="w-4 h-4" />
                                <span>{settings?.hotline || '1900 8899'}</span>
                            </a>
                            <Link
                                to="/contact"
                                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition"
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
