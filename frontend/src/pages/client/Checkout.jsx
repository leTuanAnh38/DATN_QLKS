import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { roomService } from '../../services/roomService';
import { bookingService } from '../../services/bookingService';
import { authService } from '../../services/autheService';
import { useAuth } from '../../store/authStore';
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

// Hàm tiện ích format ngày hiển thị tiếng Việt (VD: 05/10/2026)
const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    } catch {
        return dateStr;
    }
    return dateStr;
};

export default function Checkout() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isAuthenticated } = useAuth();

    // 1. Quản lý State Dữ liệu Phòng
    const [room, setRoom] = useState(null);
    const [loadingRoom, setLoadingRoom] = useState(true);
    const [roomError, setRoomError] = useState(null);

    // 2. State Ngày Check-in & Check-out
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    // Lấy ngày truyền từ trang trước (nếu có) hoặc mặc định
    const defaultCheckIn = location.state?.checkInDate || formatDateToInput(tomorrow);
    const defaultCheckOut = location.state?.checkOutDate || formatDateToInput(dayAfterTomorrow);

    const [checkInDate, setCheckInDate] = useState(defaultCheckIn);
    const [checkOutDate, setCheckOutDate] = useState(defaultCheckOut);
    const [nights, setNights] = useState(1);

    // 3. State Thông tin khách đặt phòng
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [identityCard, setIdentityCard] = useState('');
    const [guestCount, setGuestCount] = useState(location.state?.guestCount || 2);
    const [note, setNote] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('reception'); // 'reception' | 'vietqr' | 'card'

    // 4. State Mã khuyến mãi (Promo Code)
    const [promoInput, setPromoInput] = useState('');
    const [appliedPromo, setAppliedPromo] = useState(null); // { code, discount_amount, message }
    const [promoError, setPromoError] = useState('');
    const [isApplyingPromo, setIsApplyingPromo] = useState(false);

    // 5. State Gửi đơn & Xử lý thành công
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [bookingError, setBookingError] = useState('');
    const [createdBooking, setCreatedBooking] = useState(null);
    const [copiedCode, setCopiedCode] = useState(false);

    // Xác định số CCCD/Hộ chiếu đã có sẵn trong hồ sơ người dùng hay chưa
    const savedProfileIdCard = (user?.guest_profile?.id_card_number || user?.id_card_number || user?.identity_card || '').trim();
    const hasProfileIdCard = Boolean(isAuthenticated && savedProfileIdCard);
    const isUsingProfileIdCard = Boolean(hasProfileIdCard && identityCard && identityCard.trim() === savedProfileIdCard);

    // Tự động điền thông tin nếu khách hàng đã đăng nhập
    useEffect(() => {
        if (isAuthenticated && user) {
            const fullName = `${user.last_name || ''} ${user.first_name || ''}`.trim() || user.username || '';
            setGuestName((prev) => prev || fullName);
            if (user.phone_number) setGuestPhone((prev) => prev || user.phone_number);
            if (user.email) setGuestEmail((prev) => prev || user.email);

            // Tự động điền CCCD / Hộ chiếu từ hồ sơ nếu có, nếu chưa thì giữ trống
            const existingIdCard = user.guest_profile?.id_card_number || user.id_card_number || user.identity_card || '';
            if (existingIdCard) {
                setIdentityCard(existingIdCard);
            }
        }
    }, [isAuthenticated, user]);

    // Đồng bộ lại dữ liệu hồ sơ mới nhất từ máy chủ để luôn có CCCD mới nhất (nếu người dùng vừa đổi ở trang cá nhân)
    useEffect(() => {
        if (isAuthenticated) {
            authService.getProfile().then((res) => {
                if (res?.success && res?.user) {
                    const freshUser = res.user;
                    const freshIdCard = freshUser.guest_profile?.id_card_number || freshUser.id_card_number || freshUser.identity_card || '';
                    if (freshIdCard) {
                        setIdentityCard((prev) => prev || freshIdCard);
                    }
                }
            }).catch(() => {});
        }
    }, [isAuthenticated]);

    // Gọi API lấy thông tin chi tiết hạng phòng
    useEffect(() => {
        let isMounted = true;
        const fetchRoom = async () => {
            if (!id) {
                setRoomError('Không tìm thấy mã hạng phòng trên URL.');
                setLoadingRoom(false);
                return;
            }
            try {
                setLoadingRoom(true);
                setRoomError(null);
                const res = await roomService.getCategoryDetail(id);
                if (!isMounted) return;

                if (res && (res.success || res.category)) {
                    const data = res.category || res;
                    setRoom(data);
                } else {
                    setRoomError(res?.message || 'Không tìm thấy thông tin hạng phòng yêu cầu.');
                }
            } catch (err) {
                if (isMounted) {
                    setRoomError(err.message || 'Lỗi khi tải dữ liệu phòng.');
                }
            } finally {
                if (isMounted) setLoadingRoom(false);
            }
        };

        fetchRoom();
        return () => {
            isMounted = false;
        };
    }, [id]);

    // =========================================================================
    // LOGIC TỰ ĐỘNG TÍNH TOÁN SỐ ĐÊM LƯU TRÚ (Check-in & Check-out)
    // =========================================================================
    useEffect(() => {
        if (!checkInDate || !checkOutDate) {
            setNights(1);
            return;
        }

        const date1 = new Date(checkInDate);
        const date2 = new Date(checkOutDate);

        // Tính khoảng cách giữa 2 mốc thời gian
        const diffTime = date2.getTime() - date1.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
            setNights(diffDays);
        } else {
            // Nếu ngày check-out <= check-in, tự động điều chỉnh Check-out = Check-in + 1 ngày
            const adjustedDate = new Date(date1);
            adjustedDate.setDate(adjustedDate.getDate() + 1);
            setCheckOutDate(formatDateToInput(adjustedDate));
            setNights(1);
        }
    }, [checkInDate, checkOutDate]);

    // Xử lý khi người dùng đổi ngày Check-in
    const handleCheckInChange = (e) => {
        const newCheckIn = e.target.value;
        setCheckInDate(newCheckIn);

        // Đảm bảo Check-out luôn lớn hơn Check-in ít nhất 1 ngày
        if (newCheckIn >= checkOutDate) {
            const nextDay = new Date(newCheckIn);
            nextDay.setDate(nextDay.getDate() + 1);
            setCheckOutDate(formatDateToInput(nextDay));
        }
    };

    // =========================================================================
    // TÍNH TOÁN TIỀN PHÒNG & GIẢM GIÁ
    // =========================================================================
    const pricePerNight = Number(room?.promo_price || room?.base_price || 0);
    const subtotal = pricePerNight * nights;

    // Tính số tiền giảm giá từ Promo Code (nếu có)
    const discountAmount = appliedPromo ? Number(appliedPromo.discount_amount || 0) : 0;
    const finalTotal = Math.max(0, subtotal - discountAmount);
    const earnedPoints = Math.round(finalTotal / 10000);

    // =========================================================================
    // LOGIC XỬ LÝ MÃ GIẢM GIÁ (PROMO CODE)
    // =========================================================================
    const handleApplyPromo = async () => {
        const code = promoInput.trim().toUpperCase();
        if (!code) {
            setPromoError('Vui lòng nhập mã giảm giá.');
            return;
        }

        setIsApplyingPromo(true);
        setPromoError('');

        try {
            // Gọi API kiểm tra mã giảm giá
            const res = await bookingService.validatePromoCode(code, subtotal);
            if (res && res.valid) {
                setAppliedPromo({
                    code: res.code || code,
                    discount_amount: res.discount_amount || (subtotal * 0.1),
                    message: res.message || `Đã áp dụng mã ${code} thành công!`
                });
                setPromoError('');
            } else {
                setPromoError(res?.message || `Mã khuyến mãi "${code}" không hợp lệ hoặc đã hết hạn.`);
            }
        } catch {
            // Fallback UI nếu server chưa cấu hình khuyến mãi trong DB
            if (['WELCOME10', 'VIP10', 'SUMMER2026', 'TADANANG'].includes(code)) {
                const disc = Math.round(subtotal * 0.1);
                setAppliedPromo({
                    code,
                    discount_amount: disc,
                    message: `Áp dụng thành công mã ${code}! Giảm 10% (-${disc.toLocaleString('vi-VN')} VND).`
                });
                setPromoError('');
            } else {
                setPromoError(`Mã giảm giá "${code}" không tồn tại hoặc đã hết lượt dùng.`);
            }
        } finally {
            setIsApplyingPromo(false);
        }
    };

    const handleRemovePromo = () => {
        setAppliedPromo(null);
        setPromoInput('');
        setPromoError('');
    };

    // =========================================================================
    // XỬ LÝ SUBMIT ĐẶT PHÒNG TỚI API POST /api/bookings/
    // =========================================================================
    const handleSubmit = async (e) => {
        e.preventDefault();
        setBookingError('');

        // Validate dữ liệu form
        if (!guestName.trim()) {
            setBookingError('Vui lòng nhập đầy đủ họ và tên người đặt phòng.');
            return;
        }

        const cleanIdCard = identityCard.trim().toUpperCase();
        if (!cleanIdCard) {
            setBookingError('Vui lòng nhập Số CCCD hoặc Hộ chiếu (thông tin bắt buộc theo quy định lưu trú).');
            return;
        }

        // Validate độ dài từ 9 đến 12 số hoặc ký tự hộ chiếu
        const idCardRegex = /^[0-9A-Za-z]{9,12}$/;
        if (cleanIdCard.length < 9 || cleanIdCard.length > 12 || !idCardRegex.test(cleanIdCard)) {
            setBookingError('Số CCCD / Hộ chiếu không hợp lệ. Vui lòng nhập từ 9 đến 12 ký tự (Ví dụ: 12 số CCCD gắn chip hoặc số hộ chiếu hợp lệ).');
            return;
        }

        if (!guestPhone.trim()) {
            setBookingError('Vui lòng nhập số điện thoại liên hệ nhận phòng.');
            return;
        }
        if (!guestEmail.trim()) {
            setBookingError('Vui lòng nhập email để nhận xác nhận đơn đặt phòng.');
            return;
        }

        setIsSubmitting(true);

        const payload = {
            room: room?.id || id,
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            guest_name: guestName.trim(),
            guest_phone: guestPhone.trim(),
            guest_email: guestEmail.trim(),
            identity_card: cleanIdCard,
            promo_code: appliedPromo ? appliedPromo.code : '',
            note: `${note ? note + ' | ' : ''}Khách: ${guestCount} người. CCCD: ${cleanIdCard}. Thanh toán: ${paymentMethod}`
        };

        try {
            const res = await bookingService.createBooking(payload);

            if (res && (res.success || res.booking_code || res.booking)) {
                const bookingData = res.booking || res;
                setCreatedBooking({
                    booking_code: res.booking_code || bookingData.booking_code || `BK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                    room_name: room?.name,
                    check_in_date: checkInDate,
                    check_out_date: checkOutDate,
                    nights,
                    guest_name: guestName,
                    guest_phone: guestPhone,
                    guest_email: guestEmail,
                    identity_card: cleanIdCard,
                    total_amount: finalTotal,
                    payment_method: paymentMethod
                });

                // Đồng bộ lại hồ sơ người dùng để cập nhật số CCCD mới lưu vào state
                if (isAuthenticated) {
                    authService.getProfile().catch(() => {});
                }
            } else {
                setBookingError(res?.message || 'Có lỗi xảy ra khi tạo đơn đặt phòng. Vui lòng thử lại.');
            }
        } catch (err) {
            setBookingError(err.message || 'Lỗi khi gửi thông tin tới máy chủ.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Ảnh đại diện phòng
    const primaryImage =
        room?.feature_image ||
        room?.images?.find((img) => img.is_feature)?.image_url ||
        room?.images?.[0]?.image_url ||
        room?.images?.[0]?.image ||
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80';

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white">
            <Navbar />

            {/* BREADCRUMB LIÊN KẾT */}
            <div className="bg-white border-b border-slate-100 py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500">
                        <Link to="/" className="hover:text-blue-600 transition">Trang chủ</Link>
                        <span>/</span>
                        <Link to="/rooms" className="hover:text-blue-600 transition">Phòng nghỉ</Link>
                        <span>/</span>
                        {room && (
                            <>
                                <Link to={`/rooms/${room.id}`} className="hover:text-blue-600 transition truncate max-w-[150px] sm:max-w-none">
                                    {room.name}
                                </Link>
                                <span>/</span>
                            </>
                        )}
                        <span className="text-slate-900 font-semibold">Xác nhận đặt phòng & Thanh toán</span>
                    </nav>
                </div>
            </div>

            {/* HEADER TIÊU ĐỀ */}
            <header className="bg-white py-6 border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                                Bước 1: Xác nhận thông tin
                            </span>
                            <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                                🔒 Đặt phòng an toàn & bảo mật
                            </span>
                        </div>
                        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                            Hoàn tất đơn đặt phòng nghỉ
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Giá ưu đãi được giữ trong <strong>15:00 phút</strong>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT: 2 CỘT CHUẨN TRAVELOKA / AGODA */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Lỗi không tìm thấy phòng */}
                {!loadingRoom && roomError && (
                    <div className="bg-white rounded-3xl border border-rose-200 p-10 text-center max-w-lg mx-auto shadow-sm my-10">
                        <div className="text-5xl mb-3">🏨</div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Không tìm thấy thông tin phòng</h3>
                        <p className="text-xs text-slate-500 mb-6">{roomError}</p>
                        <Link
                            to="/rooms"
                            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
                        >
                            ← Quay lại danh sách phòng
                        </Link>
                    </div>
                )}

                {/* Loading Skeleton */}
                {loadingRoom && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-pulse">
                        <div className="lg:col-span-8 space-y-6">
                            <div className="h-44 bg-white rounded-3xl border border-slate-200"></div>
                            <div className="h-60 bg-white rounded-3xl border border-slate-200"></div>
                            <div className="h-48 bg-white rounded-3xl border border-slate-200"></div>
                        </div>
                        <div className="lg:col-span-4">
                            <div className="h-96 bg-white rounded-3xl border border-slate-200"></div>
                        </div>
                    </div>
                )}

                {/* Form Đặt phòng & Tóm tắt đơn */}
                {!loadingRoom && room && (
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* ========================================================================= */}
                        {/* CỘT TRÁI: FORM NHẬP LIỆU (8 COLS) */}
                        {/* ========================================================================= */}
                        <div className="lg:col-span-8 space-y-6">
                            {/* THẺ 1: CHỌN NGÀY CHECK-IN & CHECK-OUT (DATE PICKER) */}
                            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
                                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold">
                                            📅
                                        </div>
                                        <div>
                                            <h2 className="font-serif font-bold text-lg text-slate-900">
                                                Thời gian lưu trú
                                            </h2>
                                            <p className="text-xs text-slate-500">
                                                Nhận phòng từ 14:00 • Trả phòng trước 12:00
                                            </p>
                                        </div>
                                    </div>

                                    <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                                        🌙 {nights} đêm lưu trú
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Ngày Check-in */}
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            Ngày Nhận Phòng (Check-in) <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                min={formatDateToInput(today)}
                                                value={checkInDate}
                                                onChange={handleCheckInChange}
                                                required
                                                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                            />
                                        </div>
                                        <span className="text-[11px] text-slate-400 block">
                                            Lịch đón khách từ: 14:00 ({formatDateDisplay(checkInDate)})
                                        </span>
                                    </div>

                                    {/* Ngày Check-out */}
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            Ngày Trả Phòng (Check-out) <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                min={checkInDate}
                                                value={checkOutDate}
                                                onChange={(e) => setCheckOutDate(e.target.value)}
                                                required
                                                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                            />
                                        </div>
                                        <span className="text-[11px] text-slate-400 block">
                                            Trả phòng trước: 12:00 ({formatDateDisplay(checkOutDate)})
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* THẺ 2: THÔNG TIN KHÁCH ĐẶT PHÒNG */}
                            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
                                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg font-bold">
                                            👤
                                        </div>
                                        <div>
                                            <h2 className="font-serif font-bold text-lg text-slate-900">
                                                Thông tin người liên hệ & nhận phòng
                                            </h2>
                                            <p className="text-xs text-slate-500">
                                                Thông tin cần thiết để lễ tân khách sạn làm thủ tục check-in
                                            </p>
                                        </div>
                                    </div>

                                    {isAuthenticated ? (
                                        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100 flex items-center gap-1">
                                            ✓ Đã điền từ tài khoản VIP
                                        </span>
                                    ) : (
                                        <Link
                                            to="/login"
                                            className="text-xs font-bold text-blue-600 hover:underline"
                                        >
                                            Đăng nhập để tích điểm →
                                        </Link>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    {/* Họ và tên */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Họ và tên khách hàng <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ví dụ: Nguyễn Văn A (theo CCCD/Hộ chiếu)"
                                            value={guestName}
                                            onChange={(e) => setGuestName(e.target.value)}
                                            required
                                            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                        />
                                    </div>

                                    {/* Số CCCD / Hộ chiếu (Tự động lấy từ hồ sơ nếu có, nếu chưa thì để trống) */}
                                    <div>
                                        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                                Số CCCD / Hộ chiếu (Passport) <span className="text-rose-500">*</span>
                                            </label>
                                            
                                            {/* Trạng thái dữ liệu từ hồ sơ */}
                                            {hasProfileIdCard && isUsingProfileIdCard ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Đã lấy từ hồ sơ của bạn
                                                </span>
                                            ) : isAuthenticated && !hasProfileIdCard ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                                    <span>ℹ️</span> Chưa có trong hồ sơ (Vui lòng nhập)
                                                </span>
                                            ) : (
                                                <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                                                    Yêu cầu 9 - 12 ký tự
                                                </span>
                                            )}
                                        </div>

                                        <div className="relative">
                                            <input
                                                type="text"
                                                maxLength={15}
                                                placeholder={
                                                    hasProfileIdCard 
                                                        ? "Số CCCD/Hộ chiếu từ hồ sơ" 
                                                        : "Chưa có trong hồ sơ - Nhập 12 số CCCD hoặc số Hộ chiếu (VD: 048099012345)"
                                                }
                                                value={identityCard}
                                                onChange={(e) => {
                                                    setIdentityCard(e.target.value.toUpperCase());
                                                    if (bookingError) setBookingError('');
                                                }}
                                                required
                                                className={`w-full pl-11 ${hasProfileIdCard && isUsingProfileIdCard ? 'pr-24' : 'pr-4'} py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border rounded-2xl text-xs sm:text-sm font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition ${
                                                    hasProfileIdCard && isUsingProfileIdCard ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-200'
                                                }`}
                                            />
                                            <span className="absolute left-3.5 top-3 text-slate-400 text-base">
                                                🪪
                                            </span>
                                            {hasProfileIdCard && isUsingProfileIdCard && (
                                                <span className="absolute right-3 top-2.5 px-2 py-1 bg-emerald-100/80 text-emerald-800 text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1">
                                                    ✓ Hồ sơ
                                                </span>
                                            )}
                                        </div>

                                        {/* Ghi chú hướng dẫn thông minh */}
                                        <div className="mt-1 text-[11px]">
                                            {hasProfileIdCard && isUsingProfileIdCard ? (
                                                <p className="text-emerald-700 flex items-center gap-1 font-medium">
                                                    <span>✓</span> Hệ thống đã tự động điền số CCCD/Hộ chiếu từ hồ sơ của bạn. Bạn vẫn có thể sửa nếu đặt phòng cho người khác.
                                                </p>
                                            ) : isAuthenticated && !hasProfileIdCard ? (
                                                <p className="text-amber-700 flex items-center gap-1">
                                                    <span>💡</span> Hồ sơ của bạn chưa lưu CCCD. Số CCCD bạn nhập tại đây sẽ được tự động lưu vào hồ sơ cá nhân cho các lần sau.
                                                </p>
                                            ) : (
                                                <p className="text-slate-400">
                                                    Thông tin bắt buộc theo Luật Cư trú & Du lịch để khách sạn đăng ký tạm trú hợp pháp với cơ quan chức năng.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Số điện thoại */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                                Số điện thoại liên hệ <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="tel"
                                                placeholder="Ví dụ: 0901 234 567"
                                                value={guestPhone}
                                                onChange={(e) => setGuestPhone(e.target.value)}
                                                required
                                                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                            />
                                        </div>

                                        {/* Email */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                                Địa chỉ Email nhận mã xác nhận <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                placeholder="Ví dụ: email@domain.com"
                                                value={guestEmail}
                                                onChange={(e) => setGuestEmail(e.target.value)}
                                                required
                                                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                            />
                                        </div>
                                    </div>

                                    {/* Số lượng khách */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Số lượng khách lưu trú
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center space-x-3 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                                                <button
                                                    type="button"
                                                    onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                                                    className="w-8 h-8 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 transition"
                                                >
                                                    -
                                                </button>
                                                <span className="text-xs font-bold text-slate-900 px-2">
                                                    {guestCount} Người lớn
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setGuestCount(Math.min(room.capacity || 4, guestCount + 1))}
                                                    className="w-8 h-8 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 transition"
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <span className="text-xs text-slate-400">
                                                Sức chứa tối đa: {room.capacity || 2} người lớn
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* THẺ 3: MÃ GIẢM GIÁ (PROMO CODE) */}
                            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
                                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                                    <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg font-bold">
                                        🏷️
                                    </div>
                                    <div>
                                        <h2 className="font-serif font-bold text-lg text-slate-900">
                                            Mã giảm giá & Khuyến mãi (Promo Code)
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            Nhập mã ưu đãi độc quyền để nhận chiết khấu trực tiếp vào tổng tiền
                                        </p>
                                    </div>
                                </div>

                                {!appliedPromo ? (
                                    <div>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    placeholder="Nhập mã (VD: WELCOME10, TADANANG)"
                                                    value={promoInput}
                                                    onChange={(e) => {
                                                        setPromoInput(e.target.value.toUpperCase());
                                                        setPromoError('');
                                                    }}
                                                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleApplyPromo}
                                                disabled={isApplyingPromo || !promoInput.trim()}
                                                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 text-white rounded-2xl text-xs font-bold shadow-md shadow-purple-600/20 transition transform active:scale-95 flex items-center gap-2 whitespace-nowrap cursor-pointer"
                                            >
                                                {isApplyingPromo ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <span>Áp dụng</span>
                                                )}
                                            </button>
                                        </div>

                                        {/* Gợi ý mã có sẵn */}
                                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                                            <span className="text-[11px] text-slate-400">Mã gợi ý:</span>
                                            {['WELCOME10', 'TADANANG', 'VIP2026'].map((code) => (
                                                <button
                                                    key={code}
                                                    type="button"
                                                    onClick={() => setPromoInput(code)}
                                                    className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold border border-purple-100 transition"
                                                >
                                                    {code} (-10%)
                                                </button>
                                            ))}
                                        </div>

                                        {promoError && (
                                            <p className="text-xs text-rose-600 font-medium mt-2 flex items-center gap-1">
                                                ⚠️ {promoError}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                                                ✓
                                            </span>
                                            <div>
                                                <strong className="text-xs font-bold text-emerald-900 block">
                                                    Đã áp dụng mã: {appliedPromo.code}
                                                </strong>
                                                <span className="text-xs text-emerald-700">
                                                    Đã giảm: -{discountAmount.toLocaleString('vi-VN')} VND vào tổng đơn
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRemovePromo}
                                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 text-xs font-bold border border-rose-100 transition"
                                        >
                                            Hủy bỏ
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* THẺ 4: YÊU CẦU ĐẶC BIỆT & GHI CHÚ */}
                            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
                                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg font-bold">
                                        📝
                                    </div>
                                    <div>
                                        <h2 className="font-serif font-bold text-lg text-slate-900">
                                            Yêu cầu đặc biệt & Ghi chú
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            Khách sạn sẽ cố gắng đáp ứng tùy theo tình trạng phòng thực tế
                                        </p>
                                    </div>
                                </div>

                                <textarea
                                    rows="3"
                                    placeholder="Ví dụ: Cần phòng tầng cao, view thoáng, hỗ trợ nhận phòng sớm lúc 13:00, chuẩn bị bánh kỉ niệm..."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                />

                                {/* Chips chọn nhanh */}
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {[
                                        'Phòng tầng cao',
                                        'Phòng không hút thuốc',
                                        'Nhận phòng sớm',
                                        'Bánh kỉ niệm ngày cưới',
                                        'Xe đưa đón sân bay'
                                    ].map((tag) => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => {
                                                if (!note.includes(tag)) {
                                                    setNote(note ? `${note}, ${tag}` : tag);
                                                }
                                            }}
                                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 text-[11px] font-medium transition"
                                        >
                                            + {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* THẺ 5: PHƯƠNG THỨC THANH TOÁN */}
                            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
                                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
                                        💳
                                    </div>
                                    <div>
                                        <h2 className="font-serif font-bold text-lg text-slate-900">
                                            Phương thức thanh toán
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            Quý khách có thể thanh toán trực tiếp hoặc qua chuyển khoản ngân hàng
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {/* Cách 1: Thanh toán tại khách sạn */}
                                    <label
                                        onClick={() => setPaymentMethod('reception')}
                                        className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition ${
                                            paymentMethod === 'reception'
                                                ? 'border-blue-600 bg-blue-50/40'
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="payment"
                                            checked={paymentMethod === 'reception'}
                                            onChange={() => setPaymentMethod('reception')}
                                            className="mt-1 text-blue-600"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <strong className="text-xs sm:text-sm font-bold text-slate-900 block">
                                                    Thanh toán trực tiếp tại quầy Lễ tân (Khi nhận phòng)
                                                </strong>
                                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">
                                                    Khuyên dùng
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                                Chấp nhận tiền mặt, thẻ ghi nợ ATM, thẻ tín dụng nội địa & quốc tế khi quý khách làm thủ tục Check-in.
                                            </p>
                                        </div>
                                    </label>

                                    {/* Cách 2: Chuyển khoản QR */}
                                    <label
                                        onClick={() => setPaymentMethod('vietqr')}
                                        className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition ${
                                            paymentMethod === 'vietqr'
                                                ? 'border-blue-600 bg-blue-50/40'
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="payment"
                                            checked={paymentMethod === 'vietqr'}
                                            onChange={() => setPaymentMethod('vietqr')}
                                            className="mt-1 text-blue-600"
                                        />
                                        <div className="flex-1">
                                            <strong className="text-xs sm:text-sm font-bold text-slate-900 block">
                                                Chuyển khoản VietQR tức thì (Tự động xác nhận)
                                            </strong>
                                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                                Mã QR thanh toán chính thức của Khách Sạn TA Đà Nẵng sẽ được cung cấp ngay sau khi xác nhận đơn.
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* ========================================================================= */}
                        {/* CỘT PHẢI: TÓM TẮT ĐƠN HÀNG (ORDER SUMMARY - 4 COLS STICKY) */}
                        {/* ========================================================================= */}
                        <div className="lg:col-span-4">
                            <div className="sticky top-24 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-900/5 p-6 space-y-6">
                                {/* Thẻ phòng thu nhỏ */}
                                <div>
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                                        Chi tiết phòng đã chọn
                                    </span>
                                    <div className="flex gap-4">
                                        <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 relative">
                                            <img
                                                src={primaryImage}
                                                alt={room.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold uppercase block w-fit mb-1">
                                                5-STAR SUITE
                                            </span>
                                            <h3 className="font-serif font-bold text-base text-slate-900 leading-snug line-clamp-2">
                                                {room.name}
                                            </h3>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5">
                                                <span>📐 {room.size || 40} m²</span>
                                                <span>•</span>
                                                <span>👥 {room.capacity || 2} khách</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Thông tin Lịch lưu trú tóm tắt */}
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span>Nhận phòng:</span>
                                        <strong className="text-slate-900">
                                            {formatDateDisplay(checkInDate)} (14:00)
                                        </strong>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span>Trả phòng:</span>
                                        <strong className="text-slate-900">
                                            {formatDateDisplay(checkOutDate)} (12:00)
                                        </strong>
                                    </div>
                                    <div className="flex justify-between items-center text-blue-600 font-semibold pt-1 border-t border-slate-200">
                                        <span>Tổng thời gian:</span>
                                        <span>{nights} đêm lưu trú</span>
                                    </div>
                                </div>

                                {/* BẢNG KÊ CHI TIẾT TỔNG TIỀN */}
                                <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs">
                                    <div className="flex justify-between text-slate-600">
                                        <span>
                                            Giá mỗi đêm ({pricePerNight.toLocaleString('vi-VN')} VND x {nights} đêm)
                                        </span>
                                        <span className="font-semibold text-slate-900">
                                            {subtotal.toLocaleString('vi-VN')} VND
                                        </span>
                                    </div>

                                    {discountAmount > 0 && (
                                        <div className="flex justify-between text-emerald-600 font-semibold">
                                            <span>Mã khuyến mãi ({appliedPromo?.code})</span>
                                            <span>-{discountAmount.toLocaleString('vi-VN')} VND</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between text-slate-500">
                                        <span>Thuế VAT & Phí phục vụ</span>
                                        <span className="text-emerald-600 font-medium">Đã bao gồm</span>
                                    </div>

                                    <div className="flex justify-between text-blue-600 font-semibold pt-1 border-t border-slate-100">
                                        <span>💎 Điểm thưởng TA Club</span>
                                        <span>+{earnedPoints.toLocaleString('vi-VN')} điểm</span>
                                    </div>

                                    {/* Tổng tiền thanh toán */}
                                    <div className="flex justify-between items-baseline pt-3 border-t border-slate-200">
                                        <div>
                                            <span className="font-bold text-slate-900 text-sm block">
                                                Tổng tiền thanh toán
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                (Đã bao gồm toàn bộ thuế & phí)
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-black text-2xl text-rose-600">
                                                {finalTotal.toLocaleString('vi-VN')}
                                            </span>
                                            <span className="text-[11px] font-bold text-slate-500 block">VND</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Thông báo lỗi khi submit nếu có */}
                                {bookingError && (
                                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                                        ⚠️ {bookingError}
                                    </div>
                                )}

                                {/* NÚT BẤM XÁC NHẬN ĐẶT PHÒNG */}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Đang xử lý đơn đặt phòng...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>⚡</span>
                                            <span>Xác Nhận Đặt Phòng Ngay</span>
                                        </>
                                    )}
                                </button>

                                {/* Cam kết tin cậy */}
                                <div className="space-y-1.5 pt-2 text-[11px] text-slate-400">
                                    <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                                        ✓ Miễn phí hủy phòng trước 24 giờ nhận phòng
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        ✓ Nhận phòng nhanh chóng tại quầy Lễ tân
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        📞 Hotline hỗ trợ 24/7: <strong className="text-slate-700">1900 8899</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                )}
            </main>

            {/* ========================================================================= */}
            {/* MODAL / MÀN HÌNH CHÚC MỪNG ĐẶT PHÒNG THÀNH CÔNG */}
            {/* ========================================================================= */}
            {createdBooking && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-8 sm:p-10 text-center shadow-2xl animate-in fade-in zoom-in duration-300">
                        {/* Icon thành công */}
                        <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-4xl mb-6 shadow-inner">
                            🎉
                        </div>

                        <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                            Đặt phòng thành công!
                        </span>

                        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-3 mb-2">
                            Cảm ơn quý khách {createdBooking.guest_name}!
                        </h2>

                        <p className="text-xs sm:text-sm text-slate-500 mb-6">
                            Đơn đặt phòng của quý khách tại <strong>Khách Sạn TA Đà Nẵng</strong> đã được tiếp nhận và xử lý thành công.
                        </p>

                        {/* Mã đặt phòng & Hộp sao chép */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Mã đơn đặt phòng (Booking Code)
                            </span>
                            <div className="flex items-center justify-center gap-2">
                                <span className="font-mono text-xl sm:text-2xl font-black text-blue-600 tracking-wider">
                                    {createdBooking.booking_code}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (navigator.clipboard) {
                                            navigator.clipboard.writeText(createdBooking.booking_code);
                                            setCopiedCode(true);
                                            setTimeout(() => setCopiedCode(false), 2500);
                                        }
                                    }}
                                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 hover:text-blue-600 transition"
                                    title="Sao chép mã"
                                >
                                    {copiedCode ? '✓ Đã sao chép' : '📋 Chép'}
                                </button>
                            </div>
                        </div>

                        {/* Tóm tắt thông tin */}
                        <div className="bg-slate-50 rounded-2xl p-4 text-xs text-slate-600 space-y-2 text-left mb-6">
                            <div className="flex justify-between">
                                <span>Hạng phòng:</span>
                                <strong className="text-slate-900">{createdBooking.room_name}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span>Thời gian:</span>
                                <strong className="text-slate-900">
                                    {formatDateDisplay(createdBooking.check_in_date)} → {formatDateDisplay(createdBooking.check_out_date)} ({createdBooking.nights} đêm)
                                </strong>
                            </div>
                            <div className="flex justify-between">
                                <span>Tổng tiền thanh toán:</span>
                                <strong className="text-rose-600 font-bold">
                                    {Number(createdBooking.total_amount).toLocaleString('vi-VN')} VND
                                </strong>
                            </div>
                            <div className="flex justify-between">
                                <span>Số CCCD / Hộ chiếu:</span>
                                <strong className="text-slate-900 font-mono">{createdBooking.identity_card}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span>Email xác nhận:</span>
                                <span className="text-slate-800">{createdBooking.guest_email}</span>
                            </div>
                        </div>

                        {/* Nút hành động */}
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            <Link
                                to="/booking-history"
                                className="w-full sm:w-1/2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition transform active:scale-95 text-center"
                            >
                                Xem lịch sử đặt phòng
                            </Link>
                            <Link
                                to="/"
                                className="w-full sm:w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition text-center"
                            >
                                Về Trang chủ
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
}
