import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
    BedDouble,
    Bath,
    Coffee,
    Tv,
    Camera,
    ZoomIn,
    Users,
    ShieldCheck,
    CheckCircle2,
    Share2,
    Heart,
    Clock,
    ClipboardList,
    Check,
    ChevronRight,
    ChevronLeft,
    Star,
    Maximize2,
    Compass,
    ArrowRight,
    PhoneCall,
    AlertCircle,
    Crown,
    Info,
    Tag,
    DoorClosed,
    Layers,
    Award,
    X
} from 'lucide-react';
import { roomService } from '../../services/roomService';
import { bookingService } from '../../services/bookingService';
import { reviewService } from '../../services/reviewService';
import { useAuth } from '../../store/authStore';
import UserAvatar from '../../components/common/UserAvatar';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import {
    RoomLightboxModal,
    SimilarRoomsSection,
    RoomBookingWidget,
    RoomFloorPlan,
    RoomPolicies,
    RoomReviewsSection
} from '../../components/client/room-detail';
import { useHotelSettings } from '../../store/hotelSettingStore';

// Hàm tiện ích format ngày thành chuỗi YYYY-MM-DD
const formatDateToInput = (date) => {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
};

// Hàm tiện ích lấy ngày tiếp theo (YYYY-MM-DD) để đảm bảo Check-out luôn sau Check-in
const getNextDayString = (dateStr) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        d.setDate(d.getDate() + 1);
        return formatDateToInput(d);
    } catch {
        return '';
    }
};

// Ảnh mặc định bổ trợ cao cấp nếu Hạng phòng chưa upload đủ 5 ảnh
const FALLBACK_GALLERY = [
    {
        id: 'fb-1',
        title: 'Tầm nhìn trực diện biển Mỹ Khê 180°',
        url: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'fb-2',
        title: 'Phòng khách & Không gian nghỉ dưỡng sang trọng',
        url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
    },
    {
        id: 'fb-3',
        title: 'Ban công đón bình minh và hoàng hôn biển',
        url: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=800&q=80'
    },
    {
        id: 'fb-4',
        title: 'Bồn tắm sục Jacuzzi cẩm thạch thư giãn',
        url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80'
    },
    {
        id: 'fb-5',
        title: 'Bàn trà & Góc làm việc thượng lưu',
        url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'
    }
];

// Danh sách tiện nghi tiêu chuẩn khách sạn cao cấp
const STANDARD_AMENITY_GROUPS = [
    {
        title: 'Không gian & Giường ngủ',
        icon: BedDouble,
        items: [
            'Nệm lò xo túi cao cấp nâng đỡ cơ thể chuẩn công thái học',
            'Bộ ga gối cotton satin dệt mật độ cao thoáng khí, mềm mại',
            'Bàn làm việc & Khu vực tiếp khách thư giãn tiện nghi',
            'Hệ thống rèm cản sáng 100% đảm bảo giấc ngủ trọn vẹn'
        ]
    },
    {
        title: 'Phòng tắm & Thư giãn',
        icon: Bath,
        items: [
            'Phòng tắm đứng hiện đại với vòi sen phun mưa áp lực massage',
            'Bộ sản phẩm vệ sinh cá nhân cao cấp (Eco-friendly organic)',
            'Áo choàng tắm mềm mại, khăn bông cao cấp và máy sấy tóc ion',
            'Hệ thống nước nóng lạnh trung tâm ổn định 24/7'
        ]
    },
    {
        title: 'Ẩm thực & Thức uống tại phòng',
        icon: Coffee,
        items: [
            'Ấm đun siêu tốc & Bộ ly tách trà gốm sứ sang trọng',
            'Trà thảo mộc, cà phê hòa tan & nước khoáng miễn phí mỗi ngày',
            'Tủ lạnh mini bar tiện lợi bảo quản đồ uống mát lạnh'
        ]
    },
    {
        title: 'Công nghệ & Tiện ích thông minh',
        icon: Tv,
        items: [
            'Smart TV màn hình rộng kết nối Internet & truyền hình kỹ thuật số',
            'Wifi cáp quang tốc độ cao phủ sóng toàn phòng nghỉ',
            'Điều hòa không khí 2 chiều inverter êm ái, lọc không khí',
            'Két sắt điện tử an toàn bảo mật tài sản giá trị'
        ]
    }
];

// Hàm xác định hướng nhìn linh hoạt theo tên hoặc đặc trưng phòng
const getRoomViewText = (roomName) => {
    const text = (roomName || '').toLowerCase();
    if (text.includes('ocean') || text.includes('biển') || text.includes('sea')) return 'Trực diện biển Mỹ Khê';
    if (text.includes('vườn') || text.includes('garden')) return 'Hướng sân vườn nhiệt đới';
    if (text.includes('núi') || text.includes('mountain') || text.includes('hill')) return 'Hướng núi & bán đảo Sơn Trà';
    if (text.includes('hồ bơi') || text.includes('pool')) return 'Hướng hồ bơi vô cực';
    if (text.includes('sông') || text.includes('river')) return 'Hướng sông Hàn lung linh';
    return 'Hướng thành phố Đà Nẵng';
};

// Hàm lấy icon / emoji tiện ích đặc trưng (ưu tiên icon từ DB, fallback thông minh theo tên)
const getAmenityIcon = (amenity) => {
    if (amenity?.icon && amenity.icon.trim()) {
        return amenity.icon;
    }
    const name = (amenity?.name || '').toLowerCase();
    if (name.includes('wifi') || name.includes('mạng') || name.includes('internet')) return '📶';
    if (name.includes('tv') || name.includes('tivi')) return '📺';
    if (name.includes('tắm') || name.includes('jacuzzi') || name.includes('bồn')) return '🛁';
    if (name.includes('điều hòa') || name.includes('máy lạnh') || name.includes('lạnh')) return '❄️';
    if (name.includes('két') || name.includes('an toàn')) return '🔒';
    if (name.includes('ban công') || name.includes('biển') || name.includes('ngắm')) return '🌅';
    if (name.includes('cafe') || name.includes('cà phê') || name.includes('trà')) return '☕';
    if (name.includes('minibar') || name.includes('nước khoáng') || name.includes('tủ lạnh')) return '🍸';
    if (name.includes('sấy')) return '💨';
    if (name.includes('bàn') || name.includes('việc')) return '💼';
    if (name.includes('áo choàng') || name.includes('dép')) return '👘';
    if (name.includes('phục vụ') || name.includes('24/7')) return '🛎️';
    if (name.includes('hồ bơi') || name.includes('bơi')) return '🏊';
    return '✨';
};

// Phân tích chính sách hủy phòng thành từng điều khoản trực quan
const parseCancellationPolicy = (rawText) => {
    const defaultText = '• Miễn phí hủy phòng trước 48 giờ so với giờ nhận phòng (14:00 ngày Check-in).\n• Hủy phòng trong vòng 24 - 48 giờ: Phí hủy tương đương 50% tiền phòng đêm đầu tiên.\n• Hủy phòng trong vòng dưới 24 giờ hoặc không đến nhận phòng (No-show): Phí hủy tương đương 100% tiền phòng đêm đầu tiên.\n• Hỗ trợ dời ngày miễn phí 01 lần nếu thông báo trước 24 giờ (tùy thuộc vào tình trạng phòng khả dụng).';
    const text = (rawText || defaultText).trim();
    return text
        .split('\n')
        .map((l) => l.replace(/^[•\-\*]\s*/, '').trim())
        .filter(Boolean);
};

// Gán nhãn và mã màu phân loại theo mức độ phạt hủy
const getPolicyBadge = (line) => {
    const lower = line.toLowerCase();
    if (lower.includes('miễn phí hủy') || lower.includes('trước 48')) {
        return {
            label: 'Miễn phí hủy',
            badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
            dotClass: 'bg-emerald-500'
        };
    }
    if (lower.includes('50%')) {
        return {
            label: 'Phí 50%',
            badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
            dotClass: 'bg-amber-500'
        };
    }
    if (lower.includes('100%') || lower.includes('no-show') || lower.includes('không đến')) {
        return {
            label: 'Phí 100%',
            badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
            dotClass: 'bg-rose-500'
        };
    }
    if (lower.includes('dời ngày') || lower.includes('đổi lịch')) {
        return {
            label: 'Dời ngày linh hoạt',
            badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
            dotClass: 'bg-sky-500'
        };
    }
    return {
        label: 'Quy định lưu trú',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200/80',
        dotClass: 'bg-slate-400'
    };
};

export default function DetailRoom() {
    const { settings } = useHotelSettings();
    const starCount = settings?.stars || 3;
    // 1. Hook useParams() lấy tham số ID / Slug từ URL
    const { id, roomId, slug } = useParams();
    const currentRoomId = id || roomId || slug;
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    // Các state quản lý Dữ liệu, Loading và Lỗi
    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State giao diện
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [isSaved, setIsSaved] = useState(false);
    const [selectedPackage] = useState('standard'); // Gói cố định: 'standard' (đã bỏ lựa chọn gói kèm theo)
    const incomingGuests = location.state?.guestCount || searchParams.get('guests');
    const [guestCount, setGuestCount] = useState(incomingGuests ? Math.max(1, Number(incomingGuests)) : 2);
    const [similarRooms, setSimilarRooms] = useState([]);
    const [lightboxIndex, setLightboxIndex] = useState(null);
    const [availability, setAvailability] = useState(null);

    // Touch tracking refs cho thao tác vuốt ảnh trên thiết bị di động
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);
    const touchEndX = useRef(0);
    const touchEndY = useRef(0);
    const isSwiping = useRef(false);

    // Touch tracking refs cho Lightbox modal
    const lightboxTouchStartX = useRef(0);
    const lightboxTouchStartY = useRef(0);
    const lightboxTouchEndX = useRef(0);
    const lightboxTouchEndY = useRef(0);
    const isLightboxSwiping = useRef(false);

    const { user, isAuthenticated } = useAuth();

    // State quản lý đánh giá thực tế từ CSDL
    const [reviews, setReviews] = useState([]);
    const [isLoadingReviews, setIsLoadingReviews] = useState(false);
    const [bookingToReview, setBookingToReview] = useState(null);
    const [cleanlinessScore, setCleanlinessScore] = useState(5);
    const [serviceScore, setServiceScore] = useState(5);
    const [locationScore, setLocationScore] = useState(5);
    const [valueScore, setValueScore] = useState(5);
    const [reviewComment, setReviewComment] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [reviewToast, setReviewToast] = useState(null);
    const [copiedShareLink, setCopiedShareLink] = useState(false);
    const [toastNotice, setToastNotice] = useState(null);

    const showToastNotice = (type, text) => {
        setToastNotice({ type, text });
        setTimeout(() => setToastNotice(null), 3500);
    };

    const showReviewToast = (type, text) => {
        setReviewToast({ type, text });
        setTimeout(() => setReviewToast(null), 4000);
    };

    const fetchRoomReviews = async (categoryId) => {
        if (!categoryId) return;
        try {
            setIsLoadingReviews(true);
            const res = await reviewService.getReviews({ room_category: categoryId });
            if (res && res.success) {
                setReviews(res.data || []);
            }
        } catch (e) {
            console.error('Không thể tải danh sách đánh giá:', e);
        } finally {
            setIsLoadingReviews(false);
        }
    };

    // Kiểm tra booking cần đánh giá (từ Lịch sử đặt phòng hoặc URL ?review_booking_id=...)
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const reviewBookingId = searchParams.get('review_booking_id');

        if (location.state?.bookingToReview) {
            setBookingToReview(location.state.bookingToReview);
            setTimeout(() => {
                const el = document.getElementById('danh-gia');
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 600);
        } else if (reviewBookingId && isAuthenticated) {
            // Lấy thông tin đơn đặt phòng nếu chưa có trong state
            bookingService.getMyBookings().then((res) => {
                const bookingsList = res?.bookings || res?.results || (Array.isArray(res) ? res : []);
                const found = bookingsList.find((b) => String(b.id) === String(reviewBookingId));
                if (found) {
                    setBookingToReview(found);
                }
                setTimeout(() => {
                    const el = document.getElementById('danh-gia');
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 600);
            }).catch((err) => {
                console.error('Lỗi khi lấy thông tin đơn cần đánh giá:', err);
            });
        } else if (location.hash === '#danh-gia') {
            setTimeout(() => {
                const el = document.getElementById('danh-gia');
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 600);
        }
    }, [location.search, location.state, location.hash, isAuthenticated]);

    // Tìm đơn hoàn tất của khách cho hạng phòng này để gợi ý đánh giá nếu chưa đánh giá
    const [eligibleBooking, setEligibleBooking] = useState(null);
    useEffect(() => {
        if (!isAuthenticated || !room?.id) return;
        bookingService.getMyBookings().then((res) => {
            const bookingsList = res?.bookings || res?.results || (Array.isArray(res) ? res : []);
            const match = bookingsList.find((b) => 
                b.status === 'completed' && 
                !b.review && 
                (String(b.category_id) === String(room.id) || String(b.room_category?.id) === String(room.id))
            );
            if (match) {
                setEligibleBooking(match);
            }
        }).catch(() => {});
    }, [isAuthenticated, room?.id]);

    // Tính toán thống kê đánh giá thời gian thực
    const reviewStats = useMemo(() => {
        const total = reviews.length;
        if (total === 0) {
            return {
                total: 0,
                average: (room?.rating || 5.0).toFixed(1),
                cleanliness: '5.0',
                service: '5.0',
                location: '5.0',
                value: '5.0',
            };
        }
        const sumOverall = reviews.reduce((acc, r) => acc + (parseFloat(r.overall_rating) || 0), 0);
        const sumClean = reviews.reduce((acc, r) => acc + (parseFloat(r.cleanliness_score) || 0), 0);
        const sumService = reviews.reduce((acc, r) => acc + (parseFloat(r.service_score) || 0), 0);
        const sumLocation = reviews.reduce((acc, r) => acc + (parseFloat(r.location_score) || 0), 0);
        const sumValue = reviews.reduce((acc, r) => acc + (parseFloat(r.value_score) || 0), 0);

        return {
            total,
            average: (sumOverall / total).toFixed(1),
            cleanliness: (sumClean / total).toFixed(1),
            service: (sumService / total).toFixed(1),
            location: (sumLocation / total).toFixed(1),
            value: (sumValue / total).toFixed(1),
        };
    }, [reviews, room?.rating]);

    // Xử lý gửi đánh giá mới
    const handleSubmitReview = async (e) => {
        if (e) e.preventDefault();
        if (!bookingToReview?.id) {
            showReviewToast('error', 'Không tìm thấy thông tin đơn đặt phòng để đánh giá.');
            return;
        }
        if (!reviewComment.trim()) {
            showReviewToast('error', 'Vui lòng nhập nội dung nhận xét hoặc chia sẻ trải nghiệm của bạn.');
            return;
        }

        try {
            setIsSubmittingReview(true);
            const payload = {
                booking_id: bookingToReview.id,
                cleanliness_score: cleanlinessScore,
                service_score: serviceScore,
                location_score: locationScore,
                value_score: valueScore,
                comment: reviewComment.trim()
            };

            const res = await reviewService.createReview(payload);
            if (res && res.success) {
                showReviewToast('success', 'Cảm ơn quý khách đã gửi đánh giá trải nghiệm nghỉ dưỡng!');
                setReviewComment('');
                setBookingToReview(null);
                setEligibleBooking(null);
                if (room?.id) {
                    await fetchRoomReviews(room.id);
                }
            } else {
                showReviewToast('error', res?.message || 'Không thể gửi đánh giá. Vui lòng thử lại sau.');
            }
        } catch (err) {
            console.error('Lỗi khi gửi đánh giá:', err);
            showReviewToast('error', err?.response?.data?.message || err?.message || 'Đã xảy ra lỗi khi gửi đánh giá.');
        } finally {
            setIsSubmittingReview(false);
        }
    };

    // Quản lý ngày Check-in & Check-out (Đồng bộ nhận từ location.state / URL hoặc mặc định hôm nay -> ngày mai)
    const incomingCheckIn = location.state?.checkInDate || searchParams.get('checkIn');
    const incomingCheckOut = location.state?.checkOutDate || searchParams.get('checkOut');

    const today = new Date();
    const defaultCheckInDate = (incomingCheckIn && typeof incomingCheckIn === 'string' && incomingCheckIn.trim() !== '')
        ? incomingCheckIn.trim()
        : formatDateToInput(today);

    const defaultTomorrow = new Date(defaultCheckInDate);
    defaultTomorrow.setDate(defaultTomorrow.getDate() + 1);
    const fallbackCheckOutDate = formatDateToInput(defaultTomorrow);

    const defaultCheckOutDate = (incomingCheckOut && typeof incomingCheckOut === 'string' && incomingCheckOut.trim() !== '')
        ? incomingCheckOut.trim()
        : fallbackCheckOutDate;

    const [checkInDate, setCheckInDate] = useState(defaultCheckInDate);
    const [checkOutDate, setCheckOutDate] = useState(defaultCheckOutDate);

    // Tính số đêm lưu trú động theo ngày nhận & trả phòng
    const nights = useMemo(() => {
        try {
            const d1 = new Date(checkInDate);
            const d2 = new Date(checkOutDate);
            const diffTime = d2.getTime() - d1.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays > 0 ? diffDays : 1;
        } catch {
            return 2;
        }
    }, [checkInDate, checkOutDate]);

    // Kiểm tra tình trạng phòng trống thời gian thực theo khoảng ngày
    useEffect(() => {
        if (!room?.id || !checkInDate || !checkOutDate) return;
        let isMounted = true;
        bookingService
            .checkAvailability({
                category_id: room.id,
                check_in_date: checkInDate,
                check_out_date: checkOutDate
            })
            .then((res) => {
                if (isMounted && res && res.success) {
                    setAvailability(res);
                }
            })
            .catch(() => {});
        return () => {
            isMounted = false;
        };
    }, [room?.id, checkInDate, checkOutDate]);

    // 2. Hook useEffect() gọi API chi tiết phòng qua roomService
    useEffect(() => {
        let isMounted = true;

        if (!currentRoomId) {
            setError('Không xác định được mã phòng trên thanh địa chỉ URL.');
            setLoading(false);
            return;
        }

        const fetchRoomData = async () => {
            try {
                setLoading(true);
                setError(null);
                setSelectedImageIndex(0);

                // Gọi API GET /api/rooms/categories/${currentRoomId}/
                const res = await roomService.getCategoryDetail(currentRoomId);

                if (!isMounted) return;

                if (res && (res.success || res.category)) {
                    const categoryData = res.category || res;
                    setRoom(categoryData);
                    // Cập nhật số khách mặc định theo sức chứa
                    if (categoryData.capacity) {
                        setGuestCount(Math.min(categoryData.capacity, 2));
                    }
                    // Tải danh sách đánh giá thực tế của hạng phòng
                    fetchRoomReviews(categoryData.id);
                } else {
                    setError(res?.message || 'Không tìm thấy thông tin hạng phòng yêu cầu.');
                }
            } catch (err) {
                if (isMounted) {
                    setError(err?.response?.data?.detail || err?.message || 'Đã xảy ra lỗi khi kết nối đến máy chủ.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        // Gọi API lấy các hạng phòng khác cho mục "Các hạng phòng tương tự"
        const fetchSimilarRooms = async () => {
            try {
                const res = await roomService.getCategories();
                if (isMounted && res && (res.categories || res.results)) {
                    const list = res.categories || res.results || [];
                    const filtered = list.filter(
                        (c) => String(c.id) !== String(currentRoomId) && c.slug !== currentRoomId
                    );
                    setSimilarRooms(filtered.slice(0, 3));
                }
            } catch (e) {
                console.error('Không thể tải các phòng tương tự:', e);
            }
        };

        fetchRoomData();
        fetchSimilarRooms();

        // Cuộn mượt lên đầu trang mỗi khi đổi ID phòng
        window.scrollTo({ top: 0, behavior: 'smooth' });

        return () => {
            isMounted = false;
        };
    }, [currentRoomId]);

    // =========================================================================
    // DỮ LIỆU GALLERY & CÁC HÀM ĐIỀU HƯỚNG ẢNH (Khai báo trước các early return để tuân thủ Rules of Hooks)
    // =========================================================================
    const gallery = useMemo(() => {
        if (!room) return FALLBACK_GALLERY;
        const apiImageList = (room.images && room.images.length > 0)
            ? room.images.map((img, idx) => ({
                id: img.id || idx,
                url: img.image_url || img.image,
                title: img.is_feature
                    ? `${room.name} - Ảnh đại diện chính`
                    : `${room.name} - Góc nhìn ${idx + 1}`
            }))
            : (room.feature_image ? [{ id: 1, url: room.feature_image, title: room.name }] : []);
        return apiImageList.length > 0 ? apiImageList : FALLBACK_GALLERY;
    }, [room]);

    const safeImageIndex = selectedImageIndex < gallery.length ? selectedImageIndex : 0;

    // Các hàm điều hướng ảnh cho Mobile và Gallery
    const handlePrevImage = () => {
        if (gallery.length <= 1) return;
        setSelectedImageIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
    };

    const handleNextImage = () => {
        if (gallery.length <= 1) return;
        setSelectedImageIndex((prev) => (prev + 1) % gallery.length);
    };

    const handleTouchStart = (e) => {
        isSwiping.current = false;
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        touchEndX.current = e.touches[0].clientX;
        touchEndY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
        touchEndX.current = e.touches[0].clientX;
        touchEndY.current = e.touches[0].clientY;
        if (Math.abs(touchEndX.current - touchStartX.current) > 10) {
            isSwiping.current = true;
        }
    };

    const handleTouchEnd = () => {
        const diffX = touchStartX.current - touchEndX.current;
        const diffY = touchStartY.current - touchEndY.current;
        // Kiểm tra vuốt ngang: chênh lệch X > 40px và theo phương ngang nhiều hơn dọc
        if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0) {
                // Vuốt sang trái -> Xem ảnh kế tiếp
                handleNextImage();
            } else {
                // Vuốt sang phải -> Xem ảnh trước
                handlePrevImage();
            }
        }
        setTimeout(() => {
            isSwiping.current = false;
        }, 150);
    };

    const openLightbox = (index = safeImageIndex) => {
        setLightboxIndex(index);
    };

    const closeLightbox = () => {
        setLightboxIndex(null);
    };

    // Điều khiển cảm ứng & phím tắt trong Lightbox modal
    const handleLightboxTouchStart = (e) => {
        isLightboxSwiping.current = false;
        lightboxTouchStartX.current = e.touches[0].clientX;
        lightboxTouchStartY.current = e.touches[0].clientY;
        lightboxTouchEndX.current = e.touches[0].clientX;
        lightboxTouchEndY.current = e.touches[0].clientY;
    };

    const handleLightboxTouchMove = (e) => {
        lightboxTouchEndX.current = e.touches[0].clientX;
        lightboxTouchEndY.current = e.touches[0].clientY;
        if (Math.abs(lightboxTouchEndX.current - lightboxTouchStartX.current) > 10) {
            isLightboxSwiping.current = true;
        }
    };

    const handleLightboxTouchEnd = () => {
        const diffX = lightboxTouchStartX.current - lightboxTouchEndX.current;
        const diffY = lightboxTouchStartY.current - lightboxTouchEndY.current;
        if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0) {
                setLightboxIndex((prev) => (prev + 1) % gallery.length);
            } else {
                setLightboxIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
            }
        }
        setTimeout(() => {
            isLightboxSwiping.current = false;
        }, 150);
    };

    useEffect(() => {
        if (lightboxIndex === null) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setLightboxIndex(null);
            if (e.key === 'ArrowLeft') {
                setLightboxIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
            }
            if (e.key === 'ArrowRight') {
                setLightboxIndex((prev) => (prev + 1) % gallery.length);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxIndex, gallery.length]);

    // =========================================================================
    // TRẠNG THÁI 1: LOADING STATE (Hiển thị Skeleton Loader chuẩn 5 sao)
    // =========================================================================
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">
                <Navbar />

                {/* Shimmer Breadcrumb */}
                <div className="bg-white border-b border-slate-100 py-3">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center space-x-3">
                        <div className="h-4 w-16 bg-slate-200 rounded animate-pulse"></div>
                        <span className="text-slate-300">/</span>
                        <div className="h-4 w-28 bg-slate-200 rounded animate-pulse"></div>
                        <span className="text-slate-300">/</span>
                        <div className="h-4 w-40 bg-slate-200 rounded animate-pulse"></div>
                    </div>
                </div>

                {/* Shimmer Title */}
                <div className="bg-white pt-6 pb-4">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <div className="h-5 w-24 bg-slate-200 rounded-full animate-pulse"></div>
                                <div className="h-5 w-32 bg-slate-200 rounded-full animate-pulse"></div>
                            </div>
                            <div className="h-10 w-80 sm:w-96 bg-slate-200 rounded-xl animate-pulse"></div>
                        </div>
                        <div className="h-14 w-44 bg-slate-200 rounded-2xl animate-pulse"></div>
                    </div>
                </div>

                {/* Shimmer 5-Grid Gallery Skeleton */}
                <div className="bg-white pb-8">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid grid-cols-12 gap-3 h-[420px] sm:h-[500px] lg:h-[560px] rounded-3xl overflow-hidden">
                            <div className="col-span-12 lg:col-span-6 bg-slate-200 animate-pulse relative">
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        Đang tải dữ liệu phòng nghỉ...
                                    </p>
                                </div>
                            </div>
                            <div className="hidden lg:grid col-span-6 grid-cols-2 gap-3 h-full">
                                <div className="bg-slate-200 animate-pulse rounded-xl"></div>
                                <div className="bg-slate-200 animate-pulse rounded-xl"></div>
                                <div className="bg-slate-200 animate-pulse rounded-xl"></div>
                                <div className="bg-slate-200 animate-pulse rounded-xl"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Shimmer Content & Sticky Widget */}
                <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                        <div className="lg:col-span-8 space-y-6">
                            <div className="h-24 bg-white rounded-2xl border border-slate-200 animate-pulse"></div>
                            <div className="h-52 bg-white rounded-3xl border border-slate-200 animate-pulse"></div>
                            <div className="h-72 bg-white rounded-3xl border border-slate-200 animate-pulse"></div>
                        </div>
                        <div className="lg:col-span-4">
                            <div className="h-96 bg-white rounded-3xl border border-slate-200 animate-pulse"></div>
                        </div>
                    </div>
                </div>

                <Footer />
            </div>
        );
    }

    // =========================================================================
    // TRẠNG THÁI 2: ERROR STATE (Không tìm thấy phòng hoặc ID sai)
    // =========================================================================
    if (error || !room) {
        return (
            <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased flex flex-col justify-between">
                <Navbar />

                <main className="flex-1 flex items-center justify-center px-4 py-16">
                    <div className="max-w-lg w-full bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center shadow-xl shadow-slate-900/5">
                        <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center text-3xl mb-6 shadow-inner">
                            <AlertCircle className="w-10 h-10 text-rose-500" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-rose-600 bg-rose-50 px-3 py-1 rounded-full">
                            Không tìm thấy dữ liệu
                        </span>
                        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-3 mb-2">
                            Không tìm thấy hạng phòng
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 mb-8 leading-relaxed">
                            {error || `Hạng phòng với mã nhận diện "${currentRoomId}" không tồn tại hoặc đã tạm dừng phục vụ trên hệ thống.`}
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <Link
                                to="/rooms"
                                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white rounded-xl text-xs font-bold shadow-lg shadow-sky-900/20 transition transform active:scale-95 flex items-center justify-center gap-2"
                            >
                                <ArrowRight className="w-4 h-4 rotate-180" /> Xem danh sách phòng nghỉ
                            </Link>
                            <Link
                                to="/"
                                className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center"
                            >
                                Về Trang chủ
                            </Link>
                        </div>
                    </div>
                </main>

                <Footer />
            </div>
        );
    }

    // =========================================================================
    // TRẠNG THÁI 3: SUCCESS STATE (Map dữ liệu động từ API vào giao diện)
    // =========================================================================

    // 2. Map Thông tin cơ bản & Giá cả
    const basePriceNum = Number(room.base_price || 0);
    const promoPriceNum = room.promo_price ? Number(room.promo_price) : null;
    const hasPromo = promoPriceNum && promoPriceNum > 0 && promoPriceNum < basePriceNum;

    // Giá áp dụng mỗi đêm
    const effectiveBasePrice = hasPromo ? promoPriceNum : basePriceNum;
    const packageSurchargePerNight = selectedPackage === 'spa' ? 1200000 : 0;
    const totalPricePerNight = effectiveBasePrice + packageSurchargePerNight;

    // Tính tổng tiền & điểm thưởng (Giá niêm yết đã bao gồm thuế VAT & phí phục vụ đồng bộ với trang Checkout)
    const roomSubtotal = totalPricePerNight * nights;
    const finalTotal = roomSubtotal;
    const earnedPoints = Math.floor(finalTotal / 100000);

    const discountPercent = hasPromo && basePriceNum > 0
        ? Math.round(((basePriceNum - promoPriceNum) / basePriceNum) * 100)
        : 0;

    const roomViewText = getRoomViewText(room?.name);

    const getRoomHeadline = (r) => {
        if (!r?.name) return 'Không gian nghỉ dưỡng sang trọng & tinh tế';
        const lowerName = r.name.toLowerCase();
        if (lowerName.includes('ocean') || lowerName.includes('biển') || lowerName.includes('sea')) {
            return 'Bản giao hưởng giữa kiến trúc duy mỹ và đại dương bao la';
        }
        if (lowerName.includes('suite') || lowerName.includes('penthouse') || lowerName.includes('vip') || lowerName.includes('presidential')) {
            return `Đỉnh cao trải nghiệm nghỉ dưỡng thượng lưu tại ${r.name}`;
        }
        if (lowerName.includes('family') || lowerName.includes('gia đình')) {
            return `Không gian ấm cúng và tiện nghi hoàn hảo cho cả gia đình`;
        }
        return `Không gian nghỉ dưỡng tinh tế và thư thái tại ${r.name}`;
    };
    const roomHeadline = getRoomHeadline(room);

    const checkRoomHasJacuzzi = (r) => {
        const text = ((r?.name || '') + ' ' + (r?.bed_type || '')).toLowerCase();
        const hasInAmenity = (r?.amenities || []).some((a) => (a.name || '').toLowerCase().includes('jacuzzi') || (a.name || '').toLowerCase().includes('bồn tắm'));
        return hasInAmenity || text.includes('jacuzzi') || text.includes('penthouse') || text.includes('suite');
    };
    const roomHasJacuzzi = checkRoomHasJacuzzi(room);

    const checkRoomHasBalcony = (r) => {
        const text = (r?.name || '').toLowerCase();
        const hasInAmenity = (r?.amenities || []).some((a) => (a.name || '').toLowerCase().includes('ban công') || (a.name || '').toLowerCase().includes('balcony'));
        return hasInAmenity || text.includes('ban công') || text.includes('ocean') || text.includes('biển');
    };
    const roomHasBalcony = checkRoomHasBalcony(room);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-amber-500 selection:text-white pb-20 lg:pb-0">
            <Navbar
                actionText="Đặt phòng ngay"
                actionLink="#dat-phong"
                onActionClick={() => {
                    const el = document.getElementById('dat-phong');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
            />

            {/* BREADCRUMB LIÊN KẾT ĐỘNG & NÚT THAO TÁC */}
            <div className="bg-white border-b border-slate-100 py-2.5 sm:py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
                    {/* Breadcrumb bên trái: luôn 1 dòng mượt mà, co dãn thông minh */}
                    <nav className="flex items-center space-x-1.5 sm:space-x-2 text-xs text-slate-500 whitespace-nowrap overflow-x-auto no-scrollbar min-w-0 flex-1">
                        <Link to="/" className="hover:text-amber-600 transition shrink-0">Trang chủ</Link>
                        <span className="text-slate-300 shrink-0">/</span>
                        <Link to="/rooms" className="hover:text-amber-600 transition shrink-0">Phòng nghỉ & Suites</Link>
                        <span className="text-slate-300 shrink-0">/</span>
                        <span className="text-slate-900 font-semibold truncate min-w-0">
                            {room.name}
                        </span>
                    </nav>

                    {/* Thao tác nhanh bên phải: Chia sẻ & Lưu yêu thích luôn nằm cùng hàng ở góc phải */}
                    <div className="flex items-center space-x-2 sm:space-x-4 text-xs font-semibold text-slate-600 shrink-0">
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    if (navigator?.clipboard?.writeText) {
                                        await navigator.clipboard.writeText(window.location.href);
                                    } else {
                                        const ta = document.createElement('textarea');
                                        ta.value = window.location.href;
                                        document.body.appendChild(ta);
                                        ta.select();
                                        document.execCommand('copy');
                                        document.body.removeChild(ta);
                                    }
                                    setCopiedShareLink(true);
                                    showToastNotice('success', 'Đã sao chép liên kết phòng vào bộ nhớ tạm thành công!');
                                    setTimeout(() => setCopiedShareLink(false), 2500);
                                } catch {
                                    showToastNotice('info', 'Đã sao chép liên kết phòng!');
                                }
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 hover:text-amber-600 transition cursor-pointer"
                            title="Chia sẻ liên kết hạng phòng"
                        >
                            {copiedShareLink ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-emerald-700 font-bold text-[11px] sm:text-xs">Đã chép</span>
                                </>
                            ) : (
                                <>
                                    <Share2 className="w-3.5 h-3.5 text-slate-500" />
                                    <span className="text-[11px] sm:text-xs">Chia sẻ</span>
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsSaved(!isSaved)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-50 transition cursor-pointer ${isSaved ? 'text-rose-500' : 'hover:text-rose-500'}`}
                            title={isSaved ? 'Đã lưu yêu thích' : 'Lưu yêu thích'}
                        >
                            <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-rose-500 text-rose-500' : ''}`} />
                            <span className="text-[11px] sm:text-xs">{isSaved ? 'Đã lưu' : 'Yêu thích'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* TIÊU ĐỀ & HUY HIỆU ĐỘNG */}
            <section className="bg-white pt-4 sm:pt-6 pb-3 sm:pb-4">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                            {/* Dải huy hiệu sang trọng, gọn gàng */}
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-orange-500 to-amber-500 shadow-2xs">
                                    {room.size ? `${room.size} M²` : 'LUXURY SUITE'}
                                </span>
                                {hasPromo && (
                                    <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                                        <Tag className="w-3 h-3 text-rose-500" /> Giảm {discountPercent}%
                                    </span>
                                )}
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> {starCount}-STAR RESORT
                                </span>
                                {room.total_rooms_count > 0 && (
                                    <span className="text-[10px] sm:text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        <span>{room.total_rooms_count} phòng sẵn sàng</span>
                                    </span>
                                )}
                            </div>
                            <h1 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
                                {room.name}
                            </h1>
                        </div>

                        {/* Hộp đánh giá: trên mobile gọn gàng tự nhiên (self-start), không bị bè 100% chiều ngang */}
                        <div className="inline-flex items-center gap-3 bg-slate-50 border border-slate-200/80 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl shrink-0 self-start md:self-auto shadow-2xs">
                            <span className="flex items-center gap-1 text-amber-500 text-base sm:text-lg font-bold">
                                <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-400 text-amber-400" /> {reviewStats.average}
                            </span>
                            <div className="border-l border-slate-200 pl-2.5 sm:pl-3">
                                <div className="text-xs font-bold text-slate-900">
                                    {parseFloat(reviewStats.average) >= 4.8 ? 'Tuyệt hảo xuất sắc' : (parseFloat(reviewStats.average) >= 4.0 ? 'Rất tốt' : 'Tốt')}
                                </div>
                                <a href="#danh-gia" className="text-[10px] sm:text-[11px] text-amber-600 hover:underline font-medium block">
                                    {reviewStats.total > 0 ? `${reviewStats.total} lượt đánh giá thực tế` : 'Đang cập nhật đánh giá'}
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* GALLERY TỰ ĐỘNG THÍCH ỨNG THEO SỐ LƯỢNG ẢNH THỰC TẾ */}
            <section className="bg-white pb-6 sm:pb-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-12 gap-3 h-[420px] sm:h-[500px] lg:h-[560px] rounded-3xl overflow-hidden relative select-none">
                        {/* Ảnh chính lớn (Tràn 100% nếu chỉ có 1 ảnh hoặc trên mobile, hoặc 50% nếu có từ 2 ảnh trở lên trên desktop) */}
                        <div
                            className={`${gallery.length === 1 ? 'col-span-12' : 'col-span-12 lg:col-span-6'} relative group overflow-hidden h-full cursor-pointer touch-pan-y`}
                            onClick={() => {
                                if (!isSwiping.current) openLightbox(safeImageIndex);
                            }}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <img
                                key={safeImageIndex}
                                src={gallery[safeImageIndex]?.url || gallery[0]?.url}
                                alt={gallery[safeImageIndex]?.title || room.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-700 ease-out"
                            />

                            {/* Lớp gradient bóng mờ và tiêu đề ảnh */}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex flex-col justify-end p-5 sm:p-6 text-white pointer-events-none pb-12 sm:pb-6">
                                <span className="text-[11px] uppercase tracking-widest text-amber-300 font-bold mb-1">
                                    {gallery.length === 1 ? 'Hình ảnh phòng' : `Góc nhìn ${safeImageIndex + 1} / ${gallery.length}`}
                                </span>
                                <p className="font-serif text-base sm:text-xl font-bold pr-24 sm:pr-28 line-clamp-1">
                                    {gallery[safeImageIndex]?.title || room.name}
                                </p>
                            </div>

                            {/* Badge đếm số thứ tự ảnh góc trên bên trái */}
                            <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-xs font-semibold flex items-center gap-1.5 border border-white/10 shadow">
                                <Camera className="w-3.5 h-3.5 text-amber-300" />
                                <span>{safeImageIndex + 1} / {gallery.length}</span>
                            </div>

                            {/* Nút Phóng to ảnh góc trên bên phải */}
                            <div
                                className="absolute top-4 right-4 z-10 bg-black/40 backdrop-blur-md p-2 rounded-full text-white cursor-pointer hover:bg-black/60 transition"
                                title="Xem toàn màn hình"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openLightbox(safeImageIndex);
                                }}
                            >
                                <ZoomIn className="w-4 h-4 text-white" />
                            </div>

                            {/* Nút Mũi tên chuyển ảnh Trái / Phải trên ảnh chính */}
                            {gallery.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                             e.stopPropagation();
                                             handlePrevImage();
                                        }}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/45 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-md transition-all active:scale-95 shadow-lg border border-white/20 cursor-pointer"
                                        aria-label="Ảnh trước"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleNextImage();
                                        }}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/45 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-md transition-all active:scale-95 shadow-lg border border-white/20 cursor-pointer"
                                        aria-label="Ảnh tiếp theo"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </>
                            )}

                            {/* Dải chấm tròn phân trang ảnh trên Mobile (< lg) */}
                            {gallery.length > 1 && (
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 lg:hidden bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                                    {gallery.map((_, dotIdx) => (
                                        <button
                                            key={dotIdx}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedImageIndex(dotIdx);
                                            }}
                                            onTouchStart={(e) => e.stopPropagation()}
                                            className={`transition-all duration-300 rounded-full cursor-pointer ${
                                                safeImageIndex === dotIdx
                                                    ? 'w-5 h-2 bg-amber-400'
                                                    : 'w-2 h-2 bg-white/60 hover:bg-white'
                                            }`}
                                            aria-label={`Xem ảnh ${dotIdx + 1}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Các ảnh phụ bên phải (Chỉ hiển thị trên Desktop >= lg khi có từ 2 ảnh trở lên) */}
                        {gallery.length >= 2 && (
                            <div className={`hidden lg:grid col-span-6 gap-3 h-full ${
                                gallery.length === 2
                                    ? 'grid-cols-1'
                                    : gallery.length === 3
                                        ? 'grid-rows-2'
                                        : 'grid-cols-2'
                            }`}>
                                {gallery.slice(1, 5).map((img, idx) => {
                                    const actualIndex = idx + 1;
                                    const isSelected = safeImageIndex === actualIndex;
                                    return (
                                        <div
                                            key={img.id || idx}
                                            onClick={() => setSelectedImageIndex(actualIndex)}
                                            className={`relative group overflow-hidden rounded-xl h-full cursor-pointer border-2 transition ${
                                                isSelected ? 'border-amber-400' : 'border-transparent'
                                            }`}
                                        >
                                            <img
                                                src={img.url}
                                                alt={img.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition duration-500 ease-out"
                                            />
                                            <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/10 transition" />
                                            <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-[11px] text-white font-medium">
                                                {img.title}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Nút Xem tất cả ảnh */}
                        <button
                            type="button"
                            onClick={() => openLightbox(safeImageIndex)}
                            className="absolute bottom-4 right-4 sm:bottom-5 sm:right-5 z-20 bg-white/95 hover:bg-white text-slate-900 text-xs font-bold px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl shadow-lg backdrop-blur-md flex items-center gap-2 transition hover:scale-105 cursor-pointer"
                        >
                            <Camera className="w-4 h-4 text-slate-700" />
                            {gallery.length === 1 ? 'Xem ảnh' : `Tất cả ${gallery.length} ảnh`}
                        </button>
                    </div>

                    {/* DẢI THUMBNAIL CUỘN NGANG DÀNH RIÊNG CHO MOBILE & TABLET (< lg) */}
                    {gallery.length > 1 && (
                        <div className="lg:hidden mt-3">
                            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none snap-x touch-pan-x">
                                {gallery.map((img, idx) => {
                                    const isSelected = safeImageIndex === idx;
                                    return (
                                        <button
                                            key={img.id || idx}
                                            type="button"
                                            onClick={() => setSelectedImageIndex(idx)}
                                            className={`relative shrink-0 w-20 h-16 sm:w-24 sm:h-18 rounded-xl overflow-hidden border-2 transition-all snap-start cursor-pointer ${
                                                isSelected
                                                    ? 'border-amber-500 ring-2 ring-amber-400/50 scale-102 shadow-md'
                                                    : 'border-slate-200 opacity-60 hover:opacity-100'
                                            }`}
                                            aria-label={`Ảnh ${idx + 1}`}
                                        >
                                            <img
                                                src={img.url}
                                                alt={img.title}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className={`absolute inset-0 transition-opacity ${isSelected ? 'bg-transparent' : 'bg-black/20'}`} />
                                            <span className={`absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded font-bold font-mono ${
                                                isSelected ? 'bg-amber-500 text-white' : 'bg-black/70 text-white'
                                            }`}>
                                                {idx + 1}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* KHU VỰC THÔNG TIN CHÍNH & STICKY BOOKING WIDGET */}
            <section className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* CỘT TRÁI: THÔNG TIN CHI TIẾT (8 COLS) */}
                    <div className="lg:col-span-8 space-y-12 min-w-0">
                        {/* THÔNG SỐ CƠ BẢN: Map Diện tích (size), Sức chứa (capacity), Giường ngủ (bed_type) */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                                    <Maximize2 className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className="block text-[11px] text-slate-400 uppercase font-semibold">Diện tích</span>
                                    <strong className="text-sm text-slate-900 block truncate" title={room.size ? `${room.size} m²` : '45 m²'}>
                                        {room.size ? `${room.size} m²` : '45 m²'}
                                    </strong>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                                    <Compass className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className="block text-[11px] text-slate-400 uppercase font-semibold">Tầm nhìn</span>
                                    <strong className="text-sm text-slate-900 block truncate" title={roomViewText}>
                                        {roomViewText}
                                    </strong>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className="block text-[11px] text-slate-400 uppercase font-semibold">Sức chứa</span>
                                    <strong className="text-sm text-slate-900 block truncate" title={room.capacity ? `${room.capacity} Người lớn` : '2 Người lớn'}>
                                        {room.capacity ? `${room.capacity} Người lớn` : '2 Người lớn'}
                                    </strong>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                                    <BedDouble className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className="block text-[11px] text-slate-400 uppercase font-semibold">Giường ngủ</span>
                                    <strong
                                        className="text-xs sm:text-[13px] font-bold text-slate-900 block leading-tight break-words"
                                        title={room.bed_type || '1 Giường Đôi King'}
                                    >
                                        {room.bed_type || '1 Giường Đôi King'}
                                    </strong>
                                </div>
                            </div>
                        </div>

                        {/* MÔ TẢ HẠNG PHÒNG */}
                        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-5">
                         
                            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
                                {roomHeadline}
                            </h2>

                            {/* Mô tả ngắn (Short Description) được đóng khung nổi bật */}
                            {room.short_description && (
                                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-slate-50 border border-amber-200/70 flex items-start gap-3 text-slate-800 text-xs sm:text-sm leading-relaxed font-medium shadow-2xs break-words">
                                    <Compass className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-0.5">
                                            Tổng quan nổi bật
                                        </span>
                                        <p className="text-slate-800 leading-relaxed font-normal break-words">
                                            {room.short_description.replace(/&nbsp;/g, ' ')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Mô tả chi tiết (Rich Text Editor HTML) */}
                            {room.description ? (
                                <div
                                    className="text-slate-600 text-xs sm:text-sm leading-relaxed font-light space-y-3 pt-2 border-t border-slate-100 break-words overflow-hidden [&>p]:mb-3 [&>p]:break-words [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-2 [&>ul>li]:text-slate-600 [&>ul>li]:break-words [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:space-y-2 [&>strong]:font-semibold [&>strong]:text-slate-900"
                                    dangerouslySetInnerHTML={{
                                        __html: room.description.replace(/&nbsp;/g, ' ')
                                    }}
                                />
                            ) : (
                                <div className="text-slate-600 text-xs sm:text-sm leading-relaxed font-light space-y-3 pt-2 border-t border-slate-100">
                                    <p>
                                        Hạng phòng được bài trí trang nhã theo phong cách hiện đại kết hợp văn hóa biển miền Trung, sở hữu ban công thoáng đãng, giường ngủ êm ái cùng đầy đủ trang thiết bị đẳng cấp quốc tế.
                                    </p>
                                    <p>
                                        Mỗi góc nhỏ đều được chăm chút tỉ mỉ từ ánh sáng, mùi hương đến chất liệu nội thất nhập khẩu, mang tới cho quý khách một kỳ nghỉ thư thái và tái tạo năng lượng hoàn hảo.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* TIỆN ÍCH (AMENITIES): MAP MẢNG DỮ LIỆU TỪ API */}
                        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs">
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                                <div>
                                    <span className="text-xs uppercase font-bold tracking-widest text-amber-600">
                                        Tiện ích tích hợp
                                    </span>
                                    <h3 className="font-serif text-2xl font-bold text-slate-900 mt-1">
                                        Tiện nghi phòng nghỉ cao cấp
                                    </h3>
                                </div>
                                <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                                    Hơn 30+ tiện ích tích hợp
                                </span>
                            </div>

                            {/* 1. Tiện ích riêng biệt của Hạng phòng lấy từ API */}
                            {room.amenities && room.amenities.length > 0 && (
                                <div className="mb-8">
                                    <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-3">
                                        Tiện ích đặc trưng của hạng phòng này:
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                        {room.amenities.map((amenity, idx) => (
                                            <div
                                                key={amenity.id || idx}
                                                className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50/40 border border-amber-100/80 hover:border-amber-300 hover:bg-amber-50/80 transition group"
                                            >
                                                <span className="w-9 h-9 rounded-xl bg-white shadow-xs flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition border border-amber-100/60 select-none">
                                                    {amenity.icon || getAmenityIcon(amenity)}
                                                </span>
                                                <span className="text-xs font-bold text-slate-800 group-hover:text-amber-800 transition">
                                                    {amenity.name}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 2. Tiện ích tiêu chuẩn 5 sao resort phân theo nhóm */}
                            <div className="space-y-4 pt-6 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400">
                                        Tiện nghi tiêu chuẩn trang bị sẵn trong phòng:
                                    </h4>
                                    <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                                        Phục vụ suốt kỳ nghỉ
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                                    {STANDARD_AMENITY_GROUPS.map((group, idx) => {
                                        const GroupIcon = group.icon;
                                        return (
                                            <div
                                                key={idx}
                                                className="bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-200/80 p-5 sm:p-6 transition shadow-2xs hover:shadow-xs space-y-4"
                                            >
                                                <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-700 flex items-center justify-center shrink-0">
                                                            <GroupIcon className="w-4 h-4" />
                                                        </div>
                                                        <h4 className="font-serif font-bold text-base text-slate-900 tracking-tight">
                                                            {group.title}
                                                        </h4>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200/80 shadow-3xs">
                                                        {group.items.length} tiện nghi
                                                    </span>
                                                </div>

                                                <ul className="space-y-2.5">
                                                    {group.items.map((item, itemIdx) => (
                                                        <li key={itemIdx} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed font-normal">
                                                            <div className="w-4 h-4 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 shadow-3xs">
                                                                <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                                                            </div>
                                                            <span className="flex-1">{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* SƠ ĐỒ BỐ TRÍ KHÔNG GIAN (FLOOR PLAN) */}
                        <RoomFloorPlan
                            room={room}
                            roomHasJacuzzi={roomHasJacuzzi}
                            roomHasBalcony={roomHasBalcony}
                            roomViewText={roomViewText}
                        />

                        {/* CHÍNH SÁCH NHẬN & TRẢ PHÒNG & HỦY PHÒNG */}
                        <RoomPolicies
                            room={room}
                            settings={settings}
                            starCount={starCount}
                        />

                        {/* ĐÁNH GIÁ TỪ KHÁCH HÀNG THỰC TẾ & FORM ĐÁNH GIÁ KỲ NGHỈ */}
                        <RoomReviewsSection
                            room={room}
                            settings={settings}
                            reviews={reviews}
                            isLoadingReviews={isLoadingReviews}
                            reviewStats={reviewStats}
                            bookingToReview={bookingToReview}
                            setBookingToReview={setBookingToReview}
                            eligibleBooking={eligibleBooking}
                            setEligibleBooking={setEligibleBooking}
                            reviewToast={reviewToast}
                            setReviewToast={setReviewToast}
                            onReviewSubmitted={() => room?.id && fetchRoomReviews(room.id)}
                        />
                    </div>

                    {/* CỘT PHẢI: STICKY BOOKING WIDGET (4 COLS) */}
                    <RoomBookingWidget
                        room={room}
                        settings={settings}
                        totalPricePerNight={totalPricePerNight}
                        hasPromo={hasPromo}
                        discountPercent={discountPercent}
                        basePriceNum={basePriceNum}
                        checkInDate={checkInDate}
                        setCheckInDate={setCheckInDate}
                        checkOutDate={checkOutDate}
                        setCheckOutDate={setCheckOutDate}
                        guestCount={guestCount}
                        setGuestCount={setGuestCount}
                        nights={nights}
                        roomSubtotal={roomSubtotal}
                        earnedPoints={earnedPoints}
                        finalTotal={finalTotal}
                        availability={availability}
                        selectedPackage={selectedPackage}
                        formatDateToInput={formatDateToInput}
                        getNextDayString={getNextDayString}
                    />
                </div>
            </section>

            {/* MỤC CÁC HẠNG PHÒNG TƯƠNG TỰ (GỌI API TỰ ĐỘNG) */}
            <SimilarRoomsSection similarRooms={similarRooms} />

            {/* LIGHTBOX MODAL XEM ẢNH FULL SIZE */}
            <RoomLightboxModal
                lightboxIndex={lightboxIndex}
                gallery={gallery}
                onClose={closeLightbox}
                setLightboxIndex={setLightboxIndex}
            />

            {/* Toast Thông báo sang trọng */}
            {toastNotice && (
                <div className="fixed top-24 right-4 sm:right-8 z-50 p-4 rounded-2xl shadow-2xl border flex items-center gap-3 text-xs sm:text-sm font-semibold animate-in fade-in slide-in-from-top-4 duration-300 max-w-md bg-white border-slate-200 text-slate-800 shadow-slate-900/10">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="flex-1">{toastNotice.text}</span>
                    <button
                        type="button"
                        onClick={() => setToastNotice(null)}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer transition"
                    >
                        ✕
                    </button>
                </div>
            )}

            <Footer />
        </div>
    );
}
