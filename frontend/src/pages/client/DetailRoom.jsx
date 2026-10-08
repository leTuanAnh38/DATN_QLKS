import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { roomService } from '../../services/roomService';
import { bookingService } from '../../services/bookingService';
import { reviewService } from '../../services/reviewService';
import { useAuth } from '../../store/authStore';
import UserAvatar from '../../components/common/UserAvatar';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';

// Hàm tiện ích format ngày thành chuỗi YYYY-MM-DD
const formatDateToInput = (date) => {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
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

// Danh sách tiện nghi tiêu chuẩn 5 sao resort
const STANDARD_AMENITY_GROUPS = [
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

export default function DetailRoom() {
    // 1. Hook useParams() lấy tham số ID / Slug từ URL
    const { id, roomId, slug } = useParams();
    const currentRoomId = id || roomId || slug;
    const navigate = useNavigate();

    // Các state quản lý Dữ liệu, Loading và Lỗi
    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State giao diện
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [isSaved, setIsSaved] = useState(false);
    const [selectedPackage] = useState('standard'); // Gói cố định: 'standard' (đã bỏ lựa chọn gói kèm theo)
    const [guestCount, setGuestCount] = useState(2);
    const [similarRooms, setSimilarRooms] = useState([]);
    const [lightboxImage, setLightboxImage] = useState(null);
    const [availability, setAvailability] = useState(null);

    const location = useLocation();
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

    // Quản lý ngày Check-in & Check-out (Mặc định hôm nay -> 2 đêm sau)
    const today = new Date();
    const defaultCheckInDate = formatDateToInput(today);
    const defaultCheckOut = new Date(today);
    defaultCheckOut.setDate(defaultCheckOut.getDate() + 2);
    const defaultCheckOutDate = formatDateToInput(defaultCheckOut);

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
                                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
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
                        <div className="w-20 h-20 mx-auto rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center text-4xl mb-6 shadow-inner">
                            🏨
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
                                className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition transform active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span>←</span> Xem danh sách phòng nghỉ
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

    // 1. Map Hình ảnh: Lấy danh sách ảnh từ room.images của API
    const apiImageList = (room.images && room.images.length > 0)
        ? room.images.map((img, idx) => ({
            id: img.id || idx,
            url: img.image_url || img.image,
            title: img.is_feature
                ? `${room.name} - Ảnh đại diện chính`
                : `${room.name} - Góc nhìn ${idx + 1}`
        }))
        : (room.feature_image ? [{ id: 1, url: room.feature_image, title: room.name }] : []);

    // Nếu API trả về ít hơn 5 ảnh, bổ trợ ảnh fallback để khung 5-Grid không bị khuyết
    const gallery = apiImageList.length >= 5
        ? apiImageList
        : [...apiImageList, ...FALLBACK_GALLERY.slice(apiImageList.length)];

    // 2. Map Thông tin cơ bản & Giá cả
    const basePriceNum = Number(room.base_price || 0);
    const promoPriceNum = room.promo_price ? Number(room.promo_price) : null;
    const hasPromo = promoPriceNum && promoPriceNum > 0 && promoPriceNum < basePriceNum;

    // Giá áp dụng mỗi đêm
    const effectiveBasePrice = hasPromo ? promoPriceNum : basePriceNum;
    const packageSurchargePerNight = selectedPackage === 'spa' ? 1200000 : 0;
    const totalPricePerNight = effectiveBasePrice + packageSurchargePerNight;

    // Tính tổng tiền & điểm thưởng
    const roomSubtotal = totalPricePerNight * nights;
    const vatAndService = Math.round(roomSubtotal * 0.05); // 5% thuế & phí phục vụ
    const finalTotal = roomSubtotal + vatAndService;
    const earnedPoints = Math.round(finalTotal / 10000);

    const discountPercent = hasPromo && basePriceNum > 0
        ? Math.round(((basePriceNum - promoPriceNum) / basePriceNum) * 100)
        : 0;

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

            {/* BREADCRUMB LIÊN KẾT ĐỘNG */}
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
                        <button
                            type="button"
                            onClick={() => {
                                if (navigator.clipboard) {
                                    navigator.clipboard.writeText(window.location.href);
                                    alert('Đã sao chép liên kết phòng vào clipboard!');
                                }
                            }}
                            className="flex items-center gap-1.5 hover:text-blue-600 transition"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            Chia sẻ
                        </button>
                        <button
                            type="button"
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

            {/* TIÊU ĐỀ & HUY HIỆU ĐỘNG */}
            <section className="bg-white pt-6 pb-4">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="px-3 py-0.5 rounded-full text-white text-xs font-bold uppercase tracking-wider bg-orange-500">
                                    {room.size ? `${room.size} M²` : 'LUXURY SUITE'}
                                </span>
                                {hasPromo && (
                                    <span className="px-3 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold uppercase tracking-wider">
                                        🔥 Ưu đãi giảm {discountPercent}%
                                    </span>
                                )}
                                <span className="px-3 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">
                                    👑 5-STAR RESORT
                                </span>
                                {room.total_rooms_count > 0 && (
                                    <span className="text-xs text-slate-500 font-medium">
                                        • Hệ thống có {room.total_rooms_count} phòng sẵn sàng
                                    </span>
                                )}
                            </div>
                            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
                                {room.name}
                            </h1>
                        </div>

                        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl flex-shrink-0">
                            <span className="flex items-center gap-1 text-amber-500 text-lg font-bold">
                                ★ {reviewStats.average}
                            </span>
                            <div className="border-l border-slate-200 pl-3">
                                <div className="text-xs font-bold text-slate-900">
                                    {parseFloat(reviewStats.average) >= 4.8 ? 'Tuyệt hảo xuất sắc' : (parseFloat(reviewStats.average) >= 4.0 ? 'Rất tốt' : 'Tốt')}
                                </div>
                                <a href="#danh-gia" className="text-[11px] text-blue-600 hover:underline">
                                    {reviewStats.total > 0 ? `${reviewStats.total} lượt đánh giá thực tế` : 'Đang cập nhật đánh giá'}
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* GALLERY 5-GRID MAP TỪ DỮ LIỆU ẢNH API */}
            <section className="bg-white pb-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-12 gap-3 h-[420px] sm:h-[500px] lg:h-[560px] rounded-3xl overflow-hidden relative">
                        {/* Ảnh chính lớn (Bên trái) */}
                        <div
                            className="col-span-12 lg:col-span-6 relative group overflow-hidden h-full cursor-pointer"
                            onClick={() => setLightboxImage(gallery[selectedImageIndex]?.url || gallery[0]?.url)}
                        >
                            <img
                                src={gallery[selectedImageIndex]?.url || gallery[0]?.url}
                                alt={gallery[selectedImageIndex]?.title || room.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-700 ease-out"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent flex flex-col justify-end p-6 text-white pointer-events-none">
                                <span className="text-[11px] uppercase tracking-widest text-amber-300 font-bold mb-1">
                                    Góc nhìn chính
                                </span>
                                <p className="font-serif text-lg sm:text-xl font-bold">
                                    {gallery[selectedImageIndex]?.title || room.name}
                                </p>
                            </div>
                            <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md p-2 rounded-full text-white cursor-pointer hover:bg-black/60 transition">
                                🔍
                            </div>
                        </div>

                        {/* 4 Thumbnails nhỏ (Bên phải) */}
                        <div className="hidden lg:grid col-span-6 grid-cols-2 gap-3 h-full">
                            {gallery.slice(1, 5).map((img, idx) => {
                                const actualIndex = idx + 1;
                                const isSelected = selectedImageIndex === actualIndex;
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

                        {/* Nút Xem tất cả ảnh */}
                        <button
                            type="button"
                            onClick={() => setLightboxImage(gallery[selectedImageIndex]?.url || gallery[0]?.url)}
                            className="absolute bottom-5 right-5 z-10 bg-white/95 hover:bg-white text-slate-900 text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg backdrop-blur-md flex items-center gap-2 transition hover:scale-105"
                        >
                            <span>📷</span>
                            Tất cả {gallery.length} ảnh
                        </button>
                    </div>
                </div>
            </section>

            {/* KHU VỰC THÔNG TIN CHÍNH & STICKY BOOKING WIDGET */}
            <section className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* CỘT TRÁI: THÔNG TIN CHI TIẾT (8 COLS) */}
                    <div className="lg:col-span-8 space-y-12">
                        {/* THÔNG SỐ CƠ BẢN: Map Diện tích (size), Sức chứa (capacity), Giường ngủ (bed_type) */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                                    📐
                                </div>
                                <div>
                                    <span className="block text-[11px] text-slate-400 uppercase font-semibold">Diện tích</span>
                                    <strong className="text-sm text-slate-900">
                                        {room.size ? `${room.size} m²` : '45 m²'}
                                    </strong>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                                    🌊
                                </div>
                                <div>
                                    <span className="block text-[11px] text-slate-400 uppercase font-semibold">Tầm nhìn</span>
                                    <strong className="text-sm text-slate-900">
                                        {room.name.toLowerCase().includes('ocean') || room.name.toLowerCase().includes('biển')
                                            ? 'Trực diện biển'
                                            : 'View thành phố'}
                                    </strong>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                                    👥
                                </div>
                                <div>
                                    <span className="block text-[11px] text-slate-400 uppercase font-semibold">Sức chứa</span>
                                    <strong className="text-sm text-slate-900">
                                        {room.capacity ? `${room.capacity} Người lớn` : '2 Người lớn'}
                                    </strong>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                                    🛏️
                                </div>
                                <div>
                                    <span className="block text-[11px] text-slate-400 uppercase font-semibold">Giường ngủ</span>
                                    <strong className="text-sm text-slate-900 truncate max-w-[130px]" title={room.bed_type}>
                                        {room.bed_type || '1 Giường Đôi King'}
                                    </strong>
                                </div>
                            </div>
                        </div>

                        {/* MÔ TẢ HẠNG PHÒNG */}
                        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-5">
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs uppercase font-bold tracking-widest">
                                    Trải Nghiệm Thượng Lưu Đặc Quyền
                                </span>
                            </div>
                            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
                                Bản giao hưởng giữa kiến trúc duy mỹ và đại dương bao la
                            </h2>

                            {/* Mô tả ngắn (Short Description) được đóng khung nổi bật */}
                            {room.short_description && (
                                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-100 flex items-start gap-3 text-slate-800 text-xs sm:text-sm leading-relaxed font-medium shadow-2xs">
                                    <span className="text-lg select-none">✨</span>
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block mb-0.5">
                                            Tổng quan nổi bật
                                        </span>
                                        <p className="text-slate-800 leading-relaxed font-normal">
                                            {room.short_description}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Mô tả chi tiết (Rich Text Editor HTML) */}
                            {room.description ? (
                                <div
                                    className="text-slate-600 text-xs sm:text-sm leading-relaxed font-light space-y-3 pt-2 border-t border-slate-100 [&>p]:mb-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-2 [&>ul>li]:text-slate-600 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:space-y-2 [&>strong]:font-semibold [&>strong]:text-slate-900"
                                    dangerouslySetInnerHTML={{ __html: room.description }}
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
                                    <span className="text-xs uppercase font-bold tracking-widest text-blue-600">
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
                                                className="flex items-center gap-3 p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100 hover:border-blue-300 hover:bg-blue-50 transition group"
                                            >
                                                <span className="w-9 h-9 rounded-xl bg-white shadow-xs flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition">
                                                    {amenity.icon || '✨'}
                                                </span>
                                                <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition">
                                                    {amenity.name}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 2. Tiện ích tiêu chuẩn 5 sao resort phân theo nhóm */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-100">
                                {STANDARD_AMENITY_GROUPS.map((group, idx) => (
                                    <div key={idx} className="space-y-3">
                                        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                                            <span className="text-xl">{group.icon}</span>
                                            <h4 className="font-serif font-bold text-base text-slate-900">
                                                {group.title}
                                            </h4>
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

                        {/* SƠ ĐỒ BỐ TRÍ KHÔNG GIAN (FLOOR PLAN) */}
                        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs">
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
                                <div className="md:col-span-6 bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-300">
                                    <div className="border-2 border-blue-600 rounded-xl p-4 relative h-56 flex flex-col justify-between text-[11px] font-mono text-slate-600 bg-white">
                                        <div className="flex justify-between items-center border-b pb-2">
                                            <span className="text-blue-600 font-bold uppercase">{room.name}</span>
                                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                                {room.size ? `${room.size} M²` : 'STANDARD'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 my-2 flex-1">
                                            <div className="border border-slate-200 p-2 rounded flex flex-col justify-center items-center text-center bg-slate-50/50">
                                                <span className="font-bold text-slate-800">KHÔNG GIAN NGHỈ</span>
                                                <span className="text-[10px] text-slate-400">{room.bed_type}</span>
                                            </div>
                                            <div className="border border-slate-200 p-2 rounded flex flex-col justify-center items-center text-center bg-blue-50/30">
                                                <span className="font-bold text-slate-800">PHÒNG TẮM</span>
                                                <span className="text-[10px] text-blue-600">Jacuzzi cao cấp</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 border-t pt-2">
                                            <div className="text-center font-bold text-slate-800">BAN CÔNG RIÊNG</div>
                                            <div className="text-center text-slate-500">SMART SYSTEM</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-6 space-y-3 text-xs text-slate-600 leading-relaxed">
                                    <h4 className="font-serif font-bold text-base text-slate-900">Thiết kế phân vùng mở thông minh</h4>
                                    <p>
                                        Hạng phòng được bố trí khoa học nhằm tối đa hóa sự thông thoáng và ánh sáng tự nhiên. Hệ thống kính cách âm chuẩn studio quốc tế đảm bảo không gian yên tĩnh tuyệt đối cho giấc ngủ trọn vẹn.
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 pt-2 text-slate-800 font-semibold">
                                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                            Diện tích: <span className="text-blue-600">{room.size ? `${room.size} m²` : '40 m²'}</span>
                                        </div>
                                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                            Giường: <span className="text-blue-600">{room.bed_type || 'King Size'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CHÍNH SÁCH NHẬN & TRẢ PHÒNG & HỦY PHÒNG */}
                        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                                <div>
                                    <span className="text-xs uppercase font-bold tracking-widest text-blue-600">
                                        Quy định & Quyền lợi lưu trú
                                    </span>
                                    <h3 className="font-serif text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                                        <span>🛡️</span> Chính sách nhận, trả phòng & bảo đảm quyền lợi
                                    </h3>
                                </div>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 self-start sm:self-auto">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Tiêu chuẩn 5 sao quốc tế
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3.5">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
                                        🕒
                                    </div>
                                    <div>
                                        <span className="text-[11px] text-slate-400 uppercase font-bold block mb-0.5">
                                            Thời gian nhận phòng (Check-in)
                                        </span>
                                        <div className="text-base font-bold text-slate-900">Từ 14:00</div>
                                        <p className="text-slate-500 mt-0.5 leading-relaxed">
                                            Hỗ trợ nhận phòng sớm miễn phí tùy theo tình trạng phòng sẵn có lúc đến.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3.5">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0">
                                        🕛
                                    </div>
                                    <div>
                                        <span className="text-[11px] text-slate-400 uppercase font-bold block mb-0.5">
                                            Thời gian trả phòng (Check-out)
                                        </span>
                                        <div className="text-base font-bold text-slate-900">Trước 12:00</div>
                                        <p className="text-blue-600 font-semibold mt-0.5 leading-relaxed">
                                            Hội viên VIP được ưu tiên hỗ trợ check-out trễ linh hoạt đến 16:00.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Chi tiết chính sách hủy & đổi lịch riêng biệt của hạng phòng */}
                            <div className="p-5 sm:p-6 bg-gradient-to-br from-blue-50/70 via-slate-50 to-emerald-50/30 rounded-2xl border border-blue-100/80 space-y-3">
                                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                                    <span className="text-base">📋</span>
                                    <span>Chính sách hủy phòng & hoàn tiền áp dụng cho hạng phòng này:</span>
                                </div>
                                <div className="text-slate-700 text-xs sm:text-sm leading-relaxed whitespace-pre-line pl-6 font-normal">
                                    {room.cancellation_policy ||
                                        '• Miễn phí hủy phòng trước 48 giờ trước ngày nhận phòng tiêu chuẩn.\n• Hủy phòng trong vòng 24 - 48 giờ trước ngày nhận phòng tính phí 50% đêm đầu tiên.\n• Hủy phòng dưới 24 giờ tính phí 100% đêm đầu tiên.'}
                                </div>
                            </div>
                        </div>

                        {/* ĐÁNH GIÁ TỪ KHÁCH HÀNG THỰC TẾ & FORM ĐÁNH GIÁ KỲ NGHỈ */}
                        <div id="danh-gia" className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-8 scroll-mt-24">
                            {/* 1. TIÊU ĐỀ & ĐIỂM TỔNG QUAN */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs uppercase font-bold tracking-widest text-blue-600">Trải nghiệm khách hàng</span>
                                        <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black uppercase">
                                            Đã xác thực
                                        </span>
                                    </div>
                                    <h3 className="font-serif text-2xl font-bold text-slate-900 mt-1">
                                        Đánh giá & Trải nghiệm thực tế
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Được đóng góp bởi những du khách đã hoàn tất kỳ nghỉ tại {room.name}
                                    </p>
                                </div>

                                <div className="flex items-center gap-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-5 py-3 rounded-2xl shadow-md shadow-amber-500/20 shrink-0">
                                    <div className="text-right">
                                        <div className="text-[11px] text-amber-100 font-semibold uppercase tracking-wider">
                                            {parseFloat(reviewStats.average) >= 4.8 ? 'Tuyệt hảo' : (parseFloat(reviewStats.average) >= 4.0 ? 'Rất tốt' : 'Hài lòng')}
                                        </div>
                                        <div className="text-[10px] text-amber-200">
                                            {reviewStats.total} lượt đánh giá
                                        </div>
                                    </div>
                                    <div className="border-l border-amber-400/40 pl-3">
                                        <span className="font-black text-3xl">{reviewStats.average}</span>
                                        <span className="text-xs text-amber-200"> /5.0</span>
                                    </div>
                                </div>
                            </div>

                            {/* 2. THỐNG KÊ 4 TIÊU CHÍ ĐÁNH GIÁ (SẠCH SẼ, DỊCH VỤ, VỊ TRÍ, GIÁ TRỊ) */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <div className="space-y-1.5 p-2 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-slate-700">Sạch sẽ</span>
                                        <span className="font-bold text-slate-900">{reviewStats.cleanliness}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                        <div
                                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                            style={{ width: `${(parseFloat(reviewStats.cleanliness) / 5) * 100}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5 p-2 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-slate-700">Dịch vụ</span>
                                        <span className="font-bold text-slate-900">{reviewStats.service}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                        <div
                                            className="bg-blue-500 h-full rounded-full transition-all duration-500"
                                            style={{ width: `${(parseFloat(reviewStats.service) / 5) * 100}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5 p-2 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-slate-700">Vị trí</span>
                                        <span className="font-bold text-slate-900">{reviewStats.location}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                        <div
                                            className="bg-purple-500 h-full rounded-full transition-all duration-500"
                                            style={{ width: `${(parseFloat(reviewStats.location) / 5) * 100}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5 p-2 bg-white rounded-xl border border-slate-200/60 shadow-2xs">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-semibold text-slate-700">Giá trị</span>
                                        <span className="font-bold text-slate-900">{reviewStats.value}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                        <div
                                            className="bg-amber-500 h-full rounded-full transition-all duration-500"
                                            style={{ width: `${(parseFloat(reviewStats.value) / 5) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 3. TOAST THÔNG BÁO GỬI ĐÁNH GIÁ */}
                            {reviewToast && (
                                <div
                                    className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold animate-in fade-in duration-300 ${
                                        reviewToast.type === 'success'
                                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                            : 'bg-rose-50 text-rose-800 border border-rose-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span>{reviewToast.type === 'success' ? '✓' : '⚠️'}</span>
                                        <span>{reviewToast.text}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setReviewToast(null)}
                                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

                            {/* 4. FORM VIẾT ĐÁNH GIÁ (KHI CÓ BOOKING CẦN ĐÁNH GIÁ) */}
                            {bookingToReview && (
                                <div className="p-6 bg-gradient-to-br from-amber-50/60 via-white to-orange-50/40 rounded-3xl border-2 border-amber-400/60 shadow-lg shadow-amber-500/10 space-y-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-200/60">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-lg shadow-sm shadow-amber-500/20">
                                                ★
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-900 text-sm sm:text-base">
                                                        Đánh giá kỳ nghỉ của quý khách
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-mono text-[11px] font-bold">
                                                        #{bookingToReview.booking_code}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {bookingToReview.room_name || room.name}
                                                    {bookingToReview.room_number ? ` • Phòng ${bookingToReview.room_number}` : ''}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setBookingToReview(null)}
                                            className="self-end sm:self-auto text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition"
                                        >
                                            ✕ Thu gọn
                                        </button>
                                    </div>

                                    {/* Điểm tổng quan dự kiến */}
                                    <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-amber-200/80 shadow-2xs">
                                        <div>
                                            <span className="text-xs font-semibold text-slate-500 block">
                                                Điểm đánh giá trung bình:
                                            </span>
                                            <span className="font-serif text-xl font-bold text-slate-900">
                                                {(((cleanlinessScore + serviceScore + locationScore + valueScore) / 4)).toFixed(1)} / 5.0
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {[1, 2, 3, 4, 5].map((s) => (
                                                <svg
                                                    key={s}
                                                    className={`w-5 h-5 ${
                                                        s <= Math.round((cleanlinessScore + serviceScore + locationScore + valueScore) / 4)
                                                            ? 'text-amber-400 fill-amber-400'
                                                            : 'text-slate-200 fill-slate-200'
                                                    }`}
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 4 Tiêu chí đánh giá sao */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* Tiêu chí 1: Sạch sẽ */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200">
                                            <div>
                                                <span className="text-xs font-semibold text-slate-700">Mức độ sạch sẽ</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <button
                                                        key={star}
                                                        type="button"
                                                        onClick={() => setCleanlinessScore(star)}
                                                        className="p-1 hover:scale-125 transition-transform cursor-pointer"
                                                        title={`${star} sao`}
                                                    >
                                                        <svg
                                                            className={`w-6 h-6 ${star <= cleanlinessScore ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'} transition-colors`}
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                        </svg>
                                                    </button>
                                                ))}
                                                <span className="text-xs font-bold text-amber-600 ml-1.5 w-6 text-right">{cleanlinessScore}.0</span>
                                            </div>
                                        </div>

                                        {/* Tiêu chí 2: Dịch vụ */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200">
                                            <div>
                                                <span className="text-xs font-semibold text-slate-700">Chất lượng phục vụ</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <button
                                                        key={star}
                                                        type="button"
                                                        onClick={() => setServiceScore(star)}
                                                        className="p-1 hover:scale-125 transition-transform cursor-pointer"
                                                        title={`${star} sao`}
                                                    >
                                                        <svg
                                                            className={`w-6 h-6 ${star <= serviceScore ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'} transition-colors`}
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                        </svg>
                                                    </button>
                                                ))}
                                                <span className="text-xs font-bold text-amber-600 ml-1.5 w-6 text-right">{serviceScore}.0</span>
                                            </div>
                                        </div>

                                        {/* Tiêu chí 3: Vị trí */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200">
                                            <div>
                                                <span className="text-xs font-semibold text-slate-700">Vị trí & Cảnh quan</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <button
                                                        key={star}
                                                        type="button"
                                                        onClick={() => setLocationScore(star)}
                                                        className="p-1 hover:scale-125 transition-transform cursor-pointer"
                                                        title={`${star} sao`}
                                                    >
                                                        <svg
                                                            className={`w-6 h-6 ${star <= locationScore ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'} transition-colors`}
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                        </svg>
                                                    </button>
                                                ))}
                                                <span className="text-xs font-bold text-amber-600 ml-1.5 w-6 text-right">{locationScore}.0</span>
                                            </div>
                                        </div>

                                        {/* Tiêu chí 4: Giá trị */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200">
                                            <div>
                                                <span className="text-xs font-semibold text-slate-700">Giá trị tương xứng chi phí</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <button
                                                        key={star}
                                                        type="button"
                                                        onClick={() => setValueScore(star)}
                                                        className="p-1 hover:scale-125 transition-transform cursor-pointer"
                                                        title={`${star} sao`}
                                                    >
                                                        <svg
                                                            className={`w-6 h-6 ${star <= valueScore ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'} transition-colors`}
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                        </svg>
                                                    </button>
                                                ))}
                                                <span className="text-xs font-bold text-amber-600 ml-1.5 w-6 text-right">{valueScore}.0</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Nhận xét cảm nhận */}
                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-slate-700">
                                            Chia sẻ chi tiết cảm nhận của quý khách:
                                        </label>
                                        <textarea
                                            rows={4}
                                            value={reviewComment}
                                            onChange={(e) => setReviewComment(e.target.value)}
                                            placeholder="Phòng nghỉ, dịch vụ phòng, tầm nhìn và sự chu đáo của nhân viên đáp ứng kỳ vọng của bạn như thế nào?..."
                                            className="w-full p-4 rounded-2xl border border-amber-200/90 focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 text-xs sm:text-sm text-slate-800 outline-none transition bg-white"
                                        />
                                    </div>

                                    {/* Nút gửi */}
                                    <div className="flex items-center justify-end gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setBookingToReview(null)}
                                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
                                        >
                                            Hủy bỏ
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSubmitReview}
                                            disabled={isSubmittingReview}
                                            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs transition shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isSubmittingReview ? (
                                                <>
                                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                                    <span>Đang gửi đánh giá...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>★</span>
                                                    <span>Gửi Đánh Giá Của Bạn</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 5. GỢI Ý ĐÁNH GIÁ NẾU KHÁCH CÓ ĐƠN COMPLETED CHƯA REVIEW */}
                            {!bookingToReview && eligibleBooking && (
                                <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50 rounded-2xl border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg shrink-0">
                                            ✨
                                        </div>
                                        <div>
                                            <strong className="text-xs sm:text-sm text-amber-950 block">
                                                Quý khách vừa hoàn tất kỳ nghỉ tại phòng này (Mã đơn: #{eligibleBooking.booking_code})!
                                            </strong>
                                            <p className="text-[11px] text-amber-800 mt-0.5">
                                                Hãy chia sẻ cảm nhận trải nghiệm của bạn để giúp cộng đồng du khách và hỗ trợ khách sạn hoàn thiện hơn.
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setBookingToReview(eligibleBooking)}
                                        className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition shrink-0 cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                                    >
                                        <span>★</span>
                                        <span>Viết Đánh Giá Ngay</span>
                                    </button>
                                </div>
                            )}

                            {/* 6. DANH SÁCH ĐÁNH GIÁ THỰC TẾ TỪ CƠ SỞ DỮ LIỆU */}
                            <div className="space-y-4">
                                {isLoadingReviews ? (
                                    <div className="py-12 text-center space-y-3">
                                        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                        <p className="text-xs text-slate-500">Đang tải danh sách đánh giá thực tế...</p>
                                    </div>
                                ) : reviews.length === 0 ? (
                                    <div className="py-12 px-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-center space-y-3">
                                        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl mx-auto">
                                            ⭐
                                        </div>
                                        <h4 className="font-serif text-base font-bold text-slate-800">
                                            Chưa có đánh giá nào cho hạng phòng này
                                        </h4>
                                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                                            Hãy là một trong những vị khách đầu tiên trải nghiệm không gian nghỉ dưỡng tuyệt hảo này và để lại cảm nhận của bạn!
                                        </p>
                                    </div>
                                ) : (
                                    reviews.map((rev) => {
                                        const guestFullName = rev.guest_name || rev.guest_full_name || rev.guest?.username || 'Du khách lưu trú';
                                        const reviewDateStr = rev.created_at ? new Date(rev.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
                                        return (
                                            <div
                                                key={rev.id}
                                                className="p-5 sm:p-6 bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-200/80 transition space-y-3"
                                            >
                                                {/* Header đánh giá */}
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                    <div className="flex items-center gap-3">
                                                        <UserAvatar
                                                            avatar={rev.guest_avatar}
                                                            name={guestFullName}
                                                            size="md"
                                                            role="guest"
                                                        />
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <strong className="text-xs sm:text-sm text-slate-900 block font-bold">
                                                                    {guestFullName}
                                                                </strong>
                                                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                                                    ✓ Đã lưu trú
                                                                </span>
                                                            </div>
                                                            <span className="text-[11px] text-slate-400">
                                                                {reviewDateStr ? `Đánh giá ngày ${reviewDateStr}` : 'Đánh giá đã xác thực'} • {room.name}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 self-start sm:self-auto bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                                                        <div className="flex items-center gap-0.5">
                                                            {[1, 2, 3, 4, 5].map((s) => (
                                                                <svg
                                                                    key={s}
                                                                    className={`w-3.5 h-3.5 ${
                                                                        s <= Math.round(parseFloat(rev.overall_rating) || 5)
                                                                            ? 'text-amber-400 fill-amber-400'
                                                                            : 'text-slate-200 fill-slate-200'
                                                                    }`}
                                                                    viewBox="0 0 20 20"
                                                                >
                                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                                </svg>
                                                            ))}
                                                        </div>
                                                        <span className="font-bold text-xs text-amber-600">
                                                            {parseFloat(rev.overall_rating || 5).toFixed(1)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Điểm 4 tiêu chí mini tags */}
                                                <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 pt-1">
                                                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">
                                                        Sạch sẽ: <strong className="text-slate-800">{rev.cleanliness_score || 5}/5</strong>
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">
                                                        Dịch vụ: <strong className="text-slate-800">{rev.service_score || 5}/5</strong>
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">
                                                        Vị trí: <strong className="text-slate-800">{rev.location_score || 5}/5</strong>
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">
                                                        Giá trị: <strong className="text-slate-800">{rev.value_score || 5}/5</strong>
                                                    </span>
                                                </div>

                                                {/* Nội dung đánh giá */}
                                                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal pt-1">
                                                    "{rev.comment}"
                                                </p>

                                                {/* Phản hồi từ Ban quản lý khách sạn nếu có */}
                                                {rev.admin_reply && (
                                                    <div className="mt-3 p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-1.5 ml-4 sm:ml-6">
                                                        <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                                                            <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                                                                👑
                                                            </div>
                                                            <span>Phản hồi từ Ban Quản Lý Khách Sạn TA Resort</span>
                                                        </div>
                                                        <p className="text-xs text-blue-950/90 leading-relaxed italic pl-7">
                                                            "{rev.admin_reply}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* CỘT PHẢI: STICKY BOOKING WIDGET (4 COLS) */}
                    <div className="lg:col-span-4" id="dat-phong">
                        <div className="sticky top-28 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-900/5 p-6 space-y-6">
                            {/* Khối giá hiển thị động */}
                            <div className="pb-5 border-b border-slate-100">
                                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                    <span className="uppercase font-bold tracking-wider text-blue-600">
                                        Giá ưu đãi đặt trực tiếp
                                    </span>
                                    <span className="text-emerald-600 font-bold"> Giá tốt nhất</span>
                                </div>

                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-slate-900">
                                        {totalPricePerNight.toLocaleString('vi-VN')}
                                    </span>
                                    <span className="text-xs font-bold text-slate-500 uppercase">VND / đêm</span>
                                </div>

                                {hasPromo && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-slate-400 line-through">
                                            {basePriceNum.toLocaleString('vi-VN')} VND
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[11px] font-bold">
                                            Tiết kiệm {discountPercent}%
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Ngày lưu trú */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Thời gian lưu trú
                                </label>
                                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                                    <div className="border-r border-slate-200 pr-2">
                                        <span className="block text-[10px] text-slate-400 uppercase font-semibold">Nhận phòng</span>
                                        <input
                                            type="date"
                                            min={formatDateToInput(new Date())}
                                            value={checkInDate}
                                            onChange={(e) => {
                                                const newIn = e.target.value;
                                                setCheckInDate(newIn);
                                                if (newIn >= checkOutDate) {
                                                    const nextDay = new Date(newIn);
                                                    nextDay.setDate(nextDay.getDate() + 1);
                                                    setCheckOutDate(formatDateToInput(nextDay));
                                                }
                                            }}
                                            className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer mt-0.5"
                                        />
                                    </div>
                                    <div className="pl-2">
                                        <span className="block text-[10px] text-slate-400 uppercase font-semibold">Trả phòng</span>
                                        <input
                                            type="date"
                                            min={checkInDate}
                                            value={checkOutDate}
                                            onChange={(e) => setCheckOutDate(e.target.value)}
                                            className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer mt-0.5"
                                        />
                                    </div>
                                </div>
                                <span className="block text-right text-[11px] text-blue-600 font-medium mt-1">
                                    Thời gian: {nights} đêm lưu trú
                                </span>
                            </div>

                            {/* Số lượng khách (tối đa theo capacity của phòng) */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Số lượng khách
                                </label>
                                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                                        <span>👥</span> {guestCount} Người lớn (Tối đa {room.capacity || 2} người)
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            type="button"
                                            onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 transition"
                                        >
                                            -
                                        </button>
                                        <span className="text-xs font-bold">{guestCount}</span>
                                        <button
                                            type="button"
                                            onClick={() => setGuestCount(Math.min(room.capacity || 4, guestCount + 1))}
                                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 transition"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Bảng chiết tính chi phí minh bạch */}
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                                <div className="flex justify-between text-slate-600">
                                    <span>{totalPricePerNight.toLocaleString('vi-VN')} VND x {nights} đêm</span>
                                    <span>{roomSubtotal.toLocaleString('vi-VN')} VND</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Thuế VAT & Phí phục vụ (5%)</span>
                                    <span>{vatAndService.toLocaleString('vi-VN')} VND</span>
                                </div>
                                <div className="flex justify-between text-blue-600 font-semibold pt-1 border-t border-slate-200">
                                    <span> Tích lũy TA Club Points</span>
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

                            {/* Thông báo tình trạng phòng trống */}
                            {availability && (
                                <div>
                                    {availability.is_sold_out ? (
                                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
                                            <div className="font-bold flex items-center gap-1.5">
                                                <span>⚠️</span>
                                                <span>Hạng phòng này hiện đã kín chỗ cho hôm nay!</span>
                                            </div>
                                            <p className="text-[11px] text-rose-700">
                                                Quý khách có thể bấm Tiến hành đặt phòng để chọn ngày lưu trú khác còn trống.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between text-xs text-emerald-800 bg-emerald-50/80 px-3 py-2 rounded-xl border border-emerald-200">
                                            <span className="font-medium flex items-center gap-1.5">
                                                <span>✓</span> Sẵn sàng đón khách
                                            </span>
                                            <span className="font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md border border-emerald-300">
                                                🟢 Còn {availability.available_rooms} phòng trống
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Nút bấm Đặt phòng */}
                            <button
                                type="button"
                                onClick={() => {
                                    navigate(`/checkout/${room.id}`, {
                                        state: {
                                            checkInDate,
                                            checkOutDate,
                                            guestCount,
                                            selectedPackage
                                        }
                                    });
                                }}
                                className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm rounded-2xl shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
                            >
                                <span></span>
                                Tiến Hành Đặt Phòng Ngay
                            </button>

                            {/* Cam kết tin cậy */}
                            <div className="space-y-2 pt-2 text-[11px] text-slate-500">
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-500">✓</span> Cam kết giá tốt nhất trực tiếp từ Khách Sạn TA
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-500">✓</span> Miễn phí hủy phòng trước 24 giờ nhận phòng
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-emerald-500">✓</span> Hỗ trợ tư vấn phòng VIP trực tiếp: <strong className="text-slate-700">1900 8899</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* MỤC CÁC HẠNG PHÒNG TƯƠNG TỰ (GỌI API TỰ ĐỘNG) */}
            {similarRooms.length > 0 && (
                <section className="py-16 bg-white border-t border-slate-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
                            <div>
                                <span className="text-xs uppercase font-bold tracking-widest text-blue-600">
                                    Khám phá thêm
                                </span>
                                <h3 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                                    Các hạng phòng nghỉ & Suites tương tự
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                    Lựa chọn không gian nghỉ dưỡng phù hợp hoàn hảo với phong cách của quý khách.
                                </p>
                            </div>
                            <Link
                                to="/rooms"
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                            >
                                Xem tất cả các hạng phòng →
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {similarRooms.map((sRoom) => {
                                const sImg = sRoom.feature_image || sRoom.images?.[0]?.image_url || sRoom.images?.[0]?.image || 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80';
                                const sPrice = Number(sRoom.promo_price || sRoom.base_price || 0);

                                return (
                                    <div
                                        key={sRoom.id}
                                        className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col group"
                                    >
                                        <Link to={`/rooms/${sRoom.id}`} className="block relative h-56 overflow-hidden">
                                            <img
                                                src={sImg}
                                                alt={sRoom.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                            />
                                            <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                                {sRoom.size ? `${sRoom.size} M²` : 'LUXURY'}
                                            </span>
                                        </Link>

                                        <div className="p-6 flex-1 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                                                    <span className="flex items-center text-amber-500 font-bold">
                                                        ★ 4.95
                                                    </span>
                                                    <span>👥 {sRoom.capacity || 2} khách</span>
                                                </div>
                                                <h4 className="font-serif font-bold text-lg text-slate-900 group-hover:text-blue-600 transition mb-2">
                                                    <Link to={`/rooms/${sRoom.id}`} className="hover:text-blue-600 transition">
                                                        {sRoom.name}
                                                    </Link>
                                                </h4>
                                                <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                                                    {sRoom.short_description ||
                                                        sRoom.description?.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim() ||
                                                        'Không gian nghỉ dưỡng thanh lịch, ngắm trọn bình minh và hoàng hôn biển.'}
                                                </p>
                                            </div>

                                            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                                <div>
                                                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Từ</span>
                                                    <div className="flex items-baseline gap-1">
                                                        <strong className="text-base font-black text-slate-900">
                                                            {sPrice.toLocaleString('vi-VN')}
                                                        </strong>
                                                        <span className="text-[10px] text-slate-500">VND/đêm</span>
                                                    </div>
                                                </div>
                                                <Link
                                                    to={`/rooms/${sRoom.id}`}
                                                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-xl text-xs font-bold transition"
                                                >
                                                    Xem chi tiết
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* LIGHTBOX MODAL XEM ẢNH FULL SIZE */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out"
                    onClick={() => setLightboxImage(null)}
                >
                    <div className="relative max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
                        <img src={lightboxImage} alt="Phóng to" className="w-full h-full object-contain max-h-[85vh] rounded-2xl" />
                        <button
                            type="button"
                            onClick={() => setLightboxImage(null)}
                            className="absolute top-4 right-4 bg-black/60 text-white rounded-full w-10 h-10 flex items-center justify-center text-lg hover:bg-black transition"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
}
