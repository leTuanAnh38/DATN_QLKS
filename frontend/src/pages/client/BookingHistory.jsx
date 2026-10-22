import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { bookingService } from '../../services/bookingService';
import { reviewService } from '../../services/reviewService';
import { useAuth } from '../../store/authStore';
import PaymentModal from '../../components/common/PaymentModal';
import Pagination from '../../components/common/Pagination';

// Tiện ích format ngày tiếng Việt (VD: 05/10/2026)
const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    try {
        const parts = String(dateStr).split('T')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    } catch {
        return dateStr;
    }
    return dateStr;
};

// Tiện ích format thời gian chi tiết (VD: 14:30 29/09/2026)
const formatDateTimeDisplay = (isoStr) => {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `${time} • ${date}`;
    } catch {
        return isoStr;
    }
};

// Tiện ích trích xuất & chuẩn hóa thông tin Đặt phòng theo đoàn (Group Booking / B2B)
export const getGroupBookingInfo = (booking) => {
    if (!booking) return { isGroup: false };

    // Phải có liên kết group_booking thực tế hoặc mã đoàn / ghi chú đoàn hợp lệ
    // LƯU Ý: Tuyệt đối không dùng is_master_billed vì model Booking có default=True cho mọi đơn khách lẻ!
    const hasGroupFk = Boolean(booking.group_booking || booking.group_booking_id);
    const hasGroupCode = Boolean(booking.group_booking_code && String(booking.group_booking_code).trim());
    const hasGroupName = Boolean(booking.group_booking_name && String(booking.group_booking_name).trim());
    const hasGroupNote = Boolean(
        booking.note && (
            booking.note.includes('Đoàn thuộc Đoàn #') ||
            /#GRP-[A-Za-z0-9]+/i.test(booking.note)
        )
    );

    const isGroup = hasGroupFk || hasGroupCode || hasGroupName || hasGroupNote;

    if (!isGroup) {
        return { isGroup: false };
    }

    let code = (booking.group_booking_code || '').trim();
    let name = (booking.group_booking_name || '').trim();

    // Fallback trích xuất từ booking.note nếu API chỉ có note: "[Đoàn thuộc Đoàn #GRP-483411 - Đoàn du lịch LTA Đà Nẵng]"
    if (!code && booking.note) {
        const match = booking.note.match(/#?(GRP-[A-Za-z0-9]+)/i);
        if (match) code = match[1].toUpperCase();
    }
    if (!name && booking.note && booking.note.includes(' - ')) {
        const afterDash = booking.note.split(' - ')[1];
        if (afterDash) {
            name = afterDash.replace(/[\]]/g, '').trim();
        }
    }
    if (!name && booking.company_name) {
        name = booking.company_name;
    }

    // Nếu không có mã đoàn hoặc FK đoàn thực tế thì không phải là đơn đoàn
    if (!code && !hasGroupFk) {
        return { isGroup: false };
    }

    const groupId = booking.group_booking_id || (typeof booking.group_booking === 'object' ? booking.group_booking?.id : booking.group_booking);

    return {
        isGroup: true,
        groupId: groupId || code,
        groupCode: code || 'GRP-B2B',
        groupName: name || 'Khách đoàn',
        isMasterBilled: booking.is_master_billed !== false
    };
};

export default function BookingHistory() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isAuthenticated } = useAuth();

    // 1. Quản lý State danh sách đơn đặt phòng
    const [bookings, setBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [toastMessage, setToastMessage] = useState(null); // { type: 'success' | 'error', text: '' }

    // 2. State Lọc & Tìm kiếm
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled'
    const [bookingTypeFilter, setBookingTypeFilter] = useState('all'); // 'all' | 'individual' | 'group'
    const [searchKeyword, setSearchKeyword] = useState('');

    // Phân trang danh sách đơn đặt phòng
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    // 3. State Modal Hủy phòng
    const [cancelModalBooking, setCancelModalBooking] = useState(null);
    const [cancelScope, setCancelScope] = useState('single'); // 'single' | 'group'
    const [cancelReason, setCancelReason] = useState('Thay đổi lịch trình chuyến đi');
    const [customReason, setCustomReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);

    // 4. State sao chép mã
    const [copiedCode, setCopiedCode] = useState(null);

    // 5. State Modal Đánh giá (Review)
    const [reviewModalBooking, setReviewModalBooking] = useState(null);
    const [cleanlinessScore, setCleanlinessScore] = useState(5);
    const [serviceScore, setServiceScore] = useState(5);
    const [locationScore, setLocationScore] = useState(5);
    const [valueScore, setValueScore] = useState(5);
    const [reviewComment, setReviewComment] = useState('');
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    // 6. State Modal Xem Đánh Giá Của Tôi
    const [viewReviewModalBooking, setViewReviewModalBooking] = useState(null);

    // 7. State Modal Gia Hạn Thời Gian Lưu Trú (Extend Stay)
    const [extendModalBooking, setExtendModalBooking] = useState(null);
    const [newCheckOutDate, setNewCheckOutDate] = useState('');
    const [isSubmittingExtend, setIsSubmittingExtend] = useState(false);
    const [extendConflictError, setExtendConflictError] = useState(null);
    const [selectedPaymentBooking, setSelectedPaymentBooking] = useState(null);

    const handleOpenExtendModal = (booking) => {
        setExtendModalBooking(booking);
        setExtendConflictError(null);
        try {
            const curDate = new Date(booking.check_out_date);
            curDate.setDate(curDate.getDate() + 1);
            setNewCheckOutDate(curDate.toISOString().split('T')[0]);
        } catch {
            setNewCheckOutDate('');
        }
    };

    // Ngày tối thiểu cho phép chọn (ngày sau check_out_date hiện tại)
    const extendMinDate = useMemo(() => {
        if (!extendModalBooking?.check_out_date) return '';
        try {
            const cur = new Date(extendModalBooking.check_out_date);
            cur.setDate(cur.getDate() + 1);
            return cur.toISOString().split('T')[0];
        } catch {
            return '';
        }
    }, [extendModalBooking]);

    // Tính toán số đêm & chi phí phát sinh
    const extendCalculation = useMemo(() => {
        if (!extendModalBooking || !newCheckOutDate) {
            return { extraNights: 0, nightlyRate: 0, extraAmount: 0, isValid: false };
        }
        try {
            const oldDate = new Date(extendModalBooking.check_out_date);
            const newDate = new Date(newCheckOutDate);
            const diffTime = newDate.getTime() - oldDate.getTime();
            const extraNights = Math.round(diffTime / (1000 * 3600 * 24));
            if (extraNights <= 0) {
                return { extraNights: 0, nightlyRate: 0, extraAmount: 0, isValid: false };
            }
            const dailyRate = Number(extendModalBooking.daily_rate) ||
                (extendModalBooking.nights > 0 ? Number(extendModalBooking.total_amount) / extendModalBooking.nights : 0);
            const extraAmount = extraNights * dailyRate;
            return { extraNights, nightlyRate: dailyRate, extraAmount, isValid: true };
        } catch {
            return { extraNights: 0, nightlyRate: 0, extraAmount: 0, isValid: false };
        }
    }, [extendModalBooking, newCheckOutDate]);

    // Gửi yêu cầu gia hạn lưu trú
    const handleConfirmExtendStay = async () => {
        if (!extendModalBooking || !newCheckOutDate) return;
        if (!extendCalculation.isValid) {
            showToast('error', 'Ngày trả phòng mới phải sau ngày trả phòng hiện tại.');
            return;
        }

        try {
            setIsSubmittingExtend(true);
            setExtendConflictError(null);
            const res = await bookingService.extendStay(extendModalBooking.id, newCheckOutDate);
            if (res.success) {
                showToast('success', res.message || 'Gia hạn thời gian lưu trú thành công!');
                setExtendModalBooking(null);
                fetchBookings(); // Tải lại danh sách
            } else {
                setExtendConflictError(res.message || 'Không thể gia hạn phòng.');
                showToast('error', res.message || 'Không thể gia hạn phòng.');
            }
        } catch (err) {
            const msg = err.message || 'Lỗi kết nối khi gửi yêu cầu gia hạn.';
            setExtendConflictError(msg);
            showToast('error', msg);
        } finally {
            setIsSubmittingExtend(false);
        }
    };

    // Mở modal Đánh giá
    const handleOpenReviewModal = (booking) => {
        setReviewModalBooking(booking);
        setCleanlinessScore(5);
        setServiceScore(5);
        setLocationScore(5);
        setValueScore(5);
        setReviewComment('');
    };

    // Mở modal Xem đánh giá
    const handleOpenViewReviewModal = (booking) => {
        setViewReviewModalBooking(booking);
    };

    // Gửi đánh giá
    const handleSubmitReview = async () => {
        if (!reviewModalBooking) return;
        if (!reviewComment.trim()) {
            showToast('error', 'Vui lòng nhập nội dung cảm nhận của bạn.');
            return;
        }

        try {
            setIsSubmittingReview(true);
            const res = await reviewService.createReview({
                booking_id: reviewModalBooking.id,
                cleanliness_score: cleanlinessScore,
                service_score: serviceScore,
                location_score: locationScore,
                value_score: valueScore,
                comment: reviewComment.trim(),
            });

            if (res && (res.success || res.id || res.data?.id)) {
                const createdReview = res.data || res;
                showToast('success', 'Cảm ơn quý khách đã gửi đánh giá trải nghiệm kỳ nghỉ!');
                // Đồng bộ state để đổi nút Đánh giá -> Xem đánh giá của tôi ngay lập tức
                setBookings((prev) =>
                    prev.map((b) =>
                        b.id === reviewModalBooking.id
                            ? { ...b, review: createdReview }
                            : b
                    )
                );
                setReviewModalBooking(null);
            } else {
                showToast('error', res?.message || 'Không thể gửi đánh giá. Vui lòng thử lại.');
            }
        } catch (err) {
            showToast('error', err.message || 'Lỗi khi gửi đánh giá.');
        } finally {
            setIsSubmittingReview(false);
        }
    };

    // Hiển thị Toast tự tắt sau 3.5 giây
    const showToast = (type, text) => {
        setToastMessage({ type, text });
        setTimeout(() => setToastMessage(null), 3500);
    };

    // Lắng nghe toast được truyền từ điều hướng (ví dụ hủy hoặc thanh toán từ Checkout)
    useEffect(() => {
        if (location.state?.toast) {
            const { type, text } = location.state.toast;
            showToast(type || 'info', text);
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Tải danh sách đơn đặt phòng của chính người dùng
    const fetchBookings = async (isSilent = false) => {
        if (!isAuthenticated) {
            if (!isSilent) setIsLoading(false);
            return;
        }

        try {
            if (!isSilent) {
                setIsLoading(true);
                setErrorMessage('');
            }
            const res = await bookingService.getMyBookings();

            if (res && res.success) {
                setBookings(res.data || []);
            } else if (Array.isArray(res)) {
                setBookings(res);
            } else if (!isSilent) {
                setErrorMessage(res?.message || 'Không thể tải danh sách đơn đặt phòng.');
            }
        } catch (err) {
            if (!isSilent) setErrorMessage(err.message || 'Lỗi khi kết nối tới máy chủ.');
        } finally {
            if (!isSilent) setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBookings();

        const handleFocus = () => fetchBookings(true);
        const handleStorage = (e) => {
            if (e.key === 'pms_last_booking_event') {
                fetchBookings(true);
            }
        };
        const handleCustomBooking = () => fetchBookings(true);

        window.addEventListener('focus', handleFocus);
        window.addEventListener('storage', handleStorage);
        window.addEventListener('pms_booking_created', handleCustomBooking);

        // Chu kỳ polling kiểm tra cập nhật trạng thái đơn (10 giây)
        const interval = setInterval(() => {
            fetchBookings(true);
        }, 10000);

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('pms_booking_created', handleCustomBooking);
            clearInterval(interval);
        };
    }, [isAuthenticated]);

    // Xử lý Hủy đặt phòng (Khách lẻ hoặc Hủy đoàn)
    const handleConfirmCancel = async () => {
        if (!cancelModalBooking) return;

        const finalReason = cancelReason === 'Khác' ? customReason.trim() || 'Lý do cá nhân' : cancelReason;
        const groupInfo = getGroupBookingInfo(cancelModalBooking);

        try {
            setIsCancelling(true);
            if (cancelScope === 'group' && groupInfo.isGroup) {
                // Hủy toàn bộ các phòng trong đoàn
                const targetGroupId = groupInfo.groupId || groupInfo.groupCode;
                const res = await bookingService.cancelGroupBooking(targetGroupId, finalReason);
                if (res && res.success) {
                    showToast('success', `Đã hủy toàn bộ đoàn #${groupInfo.groupCode} thành công.`);
                    // Đồng bộ trạng thái tất cả phòng trong đoàn thành 'cancelled'
                    setBookings((prev) =>
                        prev.map((b) => {
                            const bGroup = getGroupBookingInfo(b);
                            if (bGroup.isGroup && bGroup.groupCode === groupInfo.groupCode) {
                                return { ...b, status: 'cancelled', status_display: 'Đã Hủy' };
                            }
                            return b;
                        })
                    );
                    setCancelModalBooking(null);
                    setCustomReason('');
                    setCancelScope('single');
                } else {
                    showToast('error', res?.message || 'Không thể hủy đơn đoàn. Vui lòng thử lại sau.');
                }
            } else {
                // Hủy riêng phòng này
                const res = await bookingService.cancelBooking(cancelModalBooking.id, finalReason);
                if (res && (res.success || res.status === 'cancelled')) {
                    showToast('success', `Đã hủy đơn ${cancelModalBooking.booking_code} thành công.`);
                    setBookings((prev) =>
                        prev.map((b) =>
                            b.id === cancelModalBooking.id
                                ? { ...b, status: 'cancelled', status_display: 'Đã Hủy' }
                                : b
                        )
                    );
                    setCancelModalBooking(null);
                    setCustomReason('');
                    setCancelScope('single');
                } else {
                    showToast('error', res?.message || 'Không thể hủy đơn đặt phòng. Vui lòng thử lại sau.');
                }
            }
        } catch (err) {
            showToast('error', err.message || 'Lỗi xử lý khi hủy đơn.');
        } finally {
            setIsCancelling(false);
        }
    };

    // Sao chép mã booking vào clipboard
    const handleCopyCode = (code) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(code);
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(null), 2000);
        }
    };

    // Thống kê nhanh số lượng đơn
    const stats = useMemo(() => {
        const total = bookings.length;
        const pending = bookings.filter((b) => ['pending', 'paid', 'PAID'].includes(b.status)).length;
        const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
        const checkedIn = bookings.filter((b) => b.status === 'checked_in').length;
        const completed = bookings.filter((b) => b.status === 'completed' || b.status === 'checked_out').length;
        const cancelled = bookings.filter((b) => b.status === 'cancelled').length;
        const groupCount = bookings.filter((b) => getGroupBookingInfo(b).isGroup).length;
        const individualCount = total - groupCount;
        return { total, pending, confirmed, checkedIn, completed, cancelled, groupCount, individualCount };
    }, [bookings]);

    // Lọc danh sách theo Tab trạng thái, loại đơn và từ khóa tìm kiếm
    const filteredBookings = useMemo(() => {
        return bookings.filter((item) => {
            const groupInfo = getGroupBookingInfo(item);

            // Lọc theo loại đơn: Tất cả | Khách lẻ | Đoàn B2B
            if (bookingTypeFilter === 'individual' && groupInfo.isGroup) return false;
            if (bookingTypeFilter === 'group' && !groupInfo.isGroup) return false;

            // Lọc trạng thái
            if (statusFilter !== 'all') {
                if (statusFilter === 'completed') {
                    if (item.status !== 'completed' && item.status !== 'checked_out') return false;
                } else if (statusFilter === 'pending') {
                    if (!['pending', 'paid', 'PAID'].includes(item.status)) return false;
                } else if (item.status !== statusFilter) {
                    return false;
                }
            }
            // Lọc từ khóa tìm kiếm (mã booking, tên phòng, số cccd, mã đoàn, tên đoàn)
            if (searchKeyword.trim()) {
                const q = searchKeyword.trim().toLowerCase();
                const matchCode = item.booking_code?.toLowerCase().includes(q);
                const matchRoom = item.room_name?.toLowerCase().includes(q);
                const matchCccd = item.identity_card?.toLowerCase().includes(q);
                const matchGuest = item.guest_name?.toLowerCase().includes(q);
                const matchGroupCode = groupInfo.isGroup && groupInfo.groupCode?.toLowerCase().includes(q);
                const matchGroupName = groupInfo.isGroup && groupInfo.groupName?.toLowerCase().includes(q);
                return matchCode || matchRoom || matchCccd || matchGuest || matchGroupCode || matchGroupName;
            }
            return true;
        });
    }, [bookings, statusFilter, bookingTypeFilter, searchKeyword]);

    // Reset về trang 1 khi đổi bộ lọc hoặc số đơn trên mỗi trang
    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, bookingTypeFilter, searchKeyword, pageSize]);

    // Tính toán phân trang
    const totalPages = Math.ceil(filteredBookings.length / pageSize) || 1;
    const paginatedBookings = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredBookings.slice(start, start + pageSize);
    }, [filteredBookings, currentPage, pageSize]);

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        window.scrollTo({ top: 300, behavior: 'smooth' });
    };

    // Cấu hình Badge Trạng thái theo yêu cầu chuẩn:
    // Pending: Vàng, Confirmed: Xanh dương, Checked_in: Xanh lá, Cancelled: Đỏ
    const renderStatusBadge = (status) => {
        switch (status) {
            case 'pending':
            case 'paid':
            case 'PAID':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        ⏳ Chờ duyệt
                    </span>
                );
            case 'confirmed':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        ✓ Đã xác nhận
                    </span>
                );
            case 'checked_in':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        🏨 Đang lưu trú
                    </span>
                );
            case 'completed':
            case 'checked_out':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        Hoàn thành
                    </span>
                );
            case 'no_show':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                        🚫 Khách không đến (No-show)
                    </span>
                );
            case 'cancelled':
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        ✕ Đã hủy
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {status || 'Đang xử lý'}
                    </span>
                );
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white">
            <Navbar />

            {/* BREADCRUMB */}
            <div className="bg-white border-b border-slate-100 py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500">
                        <Link to="/" className="hover:text-blue-600 transition">Trang chủ</Link>
                        <span>/</span>
                        <Link to="/profile" className="hover:text-blue-600 transition">Hồ sơ cá nhân</Link>
                        <span>/</span>
                        <span className="text-slate-900 font-semibold">Lịch sử đặt phòng</span>
                    </nav>
                </div>
            </div>

            {/* HEADER TIÊU ĐỀ */}
            <header className="bg-white border-b border-slate-100 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            
                            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                                Lịch sử & Đơn đặt phòng của tôi
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
                                Theo dõi chi tiết các kỳ nghỉ, tình trạng duyệt đơn và thông tin nhận phòng tại Khách Sạn TA Đà Nẵng.
                            </p>
                        </div>
                    </div>

                    {/* HÀNG THỐNG KÊ NHANH (QUICK STATS) */}
                    {isAuthenticated && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-100">
                            <div className="col-span-2 sm:col-span-1 bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Tổng số đơn
                                </span>
                                <div className="text-2xl font-black text-slate-900 mt-1">
                                    {stats.total}
                                </div>
                                {stats.groupCount > 0 && (
                                    <div className="text-[10px] text-slate-500 font-medium mt-1 flex items-center gap-1.5 flex-wrap">
                                        <span>{stats.individualCount} khách lẻ</span>
                                        <span>•</span>
                                        <span className="text-indigo-600 font-bold">{stats.groupCount} theo đoàn</span>
                                    </div>
                                )}
                            </div>
                            <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200/70">
                                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                                    Chờ duyệt
                                </span>
                                <div className="text-2xl font-black text-amber-800 mt-1">
                                    {stats.pending}
                                </div>
                            </div>
                            <div className="bg-blue-50/60 rounded-2xl p-4 border border-blue-200/70">
                                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                                    Đã xác nhận
                                </span>
                                <div className="text-2xl font-black text-blue-800 mt-1">
                                    {stats.confirmed}
                                </div>
                            </div>
                            <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-200/70">
                                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                                    Đang lưu trú
                                </span>
                                <div className="text-2xl font-black text-emerald-800 mt-1">
                                    {stats.checkedIn}
                                </div>
                            </div>
                            <div className="bg-blue-50/60 rounded-2xl p-4 border border-blue-200/70">
                                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
                                    Hoàn thành
                                </span>
                                <div className="text-2xl font-black text-blue-700 mt-1">
                                    {stats.completed}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* TOAST THÔNG BÁO NỔI */}
                {toastMessage && (
                    <div
                        className={`fixed top-20 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold transition transform animate-in slide-in-from-top duration-300 ${
                            toastMessage.type === 'success'
                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
                                : 'bg-rose-600 text-white border-rose-500 shadow-rose-500/20'
                        }`}
                    >
                        <span>{toastMessage.type === 'success' ? '✓' : '⚠️'}</span>
                        <span>{toastMessage.text}</span>
                    </div>
                )}

                {/* TRƯỜNG HỢP CHƯA ĐĂNG NHẬP */}
                {!isAuthenticated && (
                    <div className="bg-white rounded-3xl border border-slate-200 p-10 sm:p-14 text-center max-w-xl mx-auto shadow-sm my-6">
                        <div className="w-20 h-20 mx-auto rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center text-4xl mb-4">
                            🔒
                        </div>
                        <h2 className="font-serif text-2xl font-bold text-slate-900 mb-2">
                            Vui lòng đăng nhập tài khoản
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 mb-6">
                            Để bảo mật thông tin và xem lịch sử các đơn đặt phòng của chính bạn, vui lòng đăng nhập vào hệ thống TA Hotel.
                        </p>
                        <Link
                            to="/login"
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition inline-flex items-center gap-2 cursor-pointer"
                        >
                            <span>🔑</span>
                            <span>Đăng nhập ngay</span>
                        </Link>
                    </div>
                )}

                {/* KHI ĐÃ ĐĂNG NHẬP */}
                {isAuthenticated && (
                    <div className="space-y-6">
                        {/* THANH CÔNG CỤ: TABS LỌC THEO TRẠNG THÁI, PHÂN LOẠI LOẠI ĐƠN & Ô TÌM KIẾM */}
                        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3.5">
                            {/* Hàng 1: Nút Phân loại Đơn khách lẻ / Đơn đoàn B2B + Ô tìm kiếm */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
                                        Phân loại:
                                    </span>
                                    <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200/70">
                                        <button
                                            type="button"
                                            onClick={() => setBookingTypeFilter('all')}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                                bookingTypeFilter === 'all'
                                                    ? 'bg-white text-slate-900 shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            Tất cả ({stats.total})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setBookingTypeFilter('individual')}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                                bookingTypeFilter === 'individual'
                                                    ? 'bg-white text-slate-900 shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <span>👤 Khách lẻ</span>
                                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-200/80 text-slate-700">
                                                {stats.individualCount}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setBookingTypeFilter('group')}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                                bookingTypeFilter === 'group'
                                                    ? 'bg-indigo-600 text-white shadow-xs'
                                                    : 'text-indigo-700 hover:bg-indigo-50/60'
                                            }`}
                                        >
                                            <span>🏢 Theo đoàn B2B</span>
                                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                                                bookingTypeFilter === 'group'
                                                    ? 'bg-indigo-800 text-white'
                                                    : 'bg-indigo-100 text-indigo-700'
                                            }`}>
                                                {stats.groupCount}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                {/* Ô tìm kiếm nhanh */}
                                <div className="relative min-w-[260px] sm:w-80">
                                    <input
                                        type="text"
                                        placeholder="Tìm theo Mã đơn (BK-...), Mã đoàn (GRP-...), phòng..."
                                        value={searchKeyword}
                                        onChange={(e) => setSearchKeyword(e.target.value)}
                                        className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                    />
                                    <span className="absolute left-3 top-2.5 text-slate-400 text-xs">
                                        🔍
                                    </span>
                                    {searchKeyword && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchKeyword('')}
                                            className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Hàng 2: Tabs lọc theo trạng thái đơn */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                                {[
                                    { key: 'all', label: 'Tất cả trạng thái', count: stats.total },
                                    { key: 'pending', label: 'Chờ duyệt', count: stats.pending, color: 'text-amber-600' },
                                    { key: 'confirmed', label: 'Đã xác nhận', count: stats.confirmed, color: 'text-blue-600' },
                                    { key: 'checked_in', label: 'Đang lưu trú', count: stats.checkedIn, color: 'text-emerald-600' },
                                    { key: 'completed', label: 'Hoàn thành', count: stats.completed, color: 'text-blue-600' },
                                    { key: 'cancelled', label: 'Đã hủy', count: stats.cancelled, color: 'text-rose-600' }
                                ].map((tab) => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setStatusFilter(tab.key)}
                                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                                            statusFilter === tab.key
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`}
                                    >
                                        <span>{tab.label}</span>
                                        <span
                                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                                                statusFilter === tab.key
                                                    ? 'bg-slate-700 text-white'
                                                    : 'bg-slate-200/80 text-slate-600'
                                            }`}
                                        >
                                            {tab.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* HIỂN THỊ LỖI NẾU CÓ */}
                        {errorMessage && (
                            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center justify-between">
                                <span>⚠️ {errorMessage}</span>
                                <button
                                    onClick={fetchBookings}
                                    className="text-xs font-bold text-rose-800 underline cursor-pointer"
                                >
                                    Thử lại
                                </button>
                            </div>
                        )}

                        {/* LOADING SKELETON */}
                        {isLoading && (
                            <div className="space-y-4 animate-pulse">
                                {[1, 2, 3].map((n) => (
                                    <div
                                        key={n}
                                        className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col md:flex-row gap-6 items-center"
                                    >
                                        <div className="w-full md:w-44 h-32 bg-slate-200 rounded-2xl"></div>
                                        <div className="flex-1 space-y-3 w-full">
                                            <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                                            <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                                            <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                                        </div>
                                        <div className="w-full md:w-40 h-10 bg-slate-200 rounded-xl"></div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* TRẠNG THÁI RỖNG (EMPTY STATE) */}
                        {!isLoading && filteredBookings.length === 0 && (
                            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-xs my-8">
                                <div className="text-5xl mb-3">🧳</div>
                                <h3 className="font-serif text-lg font-bold text-slate-900 mb-1">
                                    {statusFilter === 'all'
                                        ? 'Bạn chưa có đơn đặt phòng nào'
                                        : `Không có đơn đặt phòng nào ở mục "${
                                              statusFilter === 'pending'
                                                  ? 'Chờ duyệt'
                                                  : statusFilter === 'confirmed'
                                                  ? 'Đã xác nhận'
                                                  : statusFilter === 'checked_in'
                                                  ? 'Đang lưu trú'
                                                  : statusFilter === 'completed'
                                                  ? 'Hoàn thành'
                                                  : 'Đã hủy'
                                          }"`}
                                </h3>
                                <p className="text-xs text-slate-500 mb-6">
                                    {searchKeyword
                                        ? 'Không tìm thấy kết quả phù hợp với từ khóa bạn tìm kiếm.'
                                        : 'Hãy lên kế hoạch cho kỳ nghỉ tuyệt vời cùng gia đình và người thân tại Khách Sạn TA Đà Nẵng ngay hôm nay.'}
                                </p>
                                <Link
                                    to="/rooms"
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>🏨</span>
                                    <span>Khám phá phòng nghỉ ngay</span>
                                </Link>
                            </div>
                        )}

                        {/* DANH SÁCH CÁC ĐƠN DẠNG THẺ (CARD LAYOUT) XẾP THEO CHIỀU DỌC */}
                        {!isLoading && filteredBookings.length > 0 && (
                            <div className="space-y-5">
                                {paginatedBookings.map((booking) => {
                                    // Xác định ảnh thumbnail phòng
                                    const roomThumbnail =
                                        booking.room_image ||
                                        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';

                                    const isCancelled = ['cancelled', 'no_show'].includes(booking.status);
                                    const isPending = ['pending', 'paid', 'PAID'].includes(booking.status);
                                    const canCancel = ['pending', 'confirmed', 'paid', 'PAID'].includes(booking.status);
                                    const isPaid = !isCancelled && Boolean(
                                        booking.payment_status === 'COMPLETED' ||
                                        booking.is_paid ||
                                        ['paid', 'PAID', 'completed', 'checked_out'].includes(booking.status) ||
                                        (booking.payments && Array.isArray(booking.payments) && booking.payments.some(p => p.payment_status === 'COMPLETED')) ||
                                        (booking.note && (
                                            booking.note.toLowerCase().includes('vietqr: đã thanh toán') ||
                                            booking.note.toLowerCase().includes('đã thanh toán thành công')
                                        ))
                                    );

                                    // Xác định phương thức thanh toán thực tế của đơn
                                    const getMethodCode = () => {
                                        const raw = (
                                            booking.payment_method ||
                                            (booking.payments && Array.isArray(booking.payments) && (
                                                booking.payments.find(p => p.payment_status === 'COMPLETED')?.payment_method ||
                                                booking.payments[0]?.payment_method
                                            )) ||
                                            booking.invoice?.payment_method ||
                                            ''
                                        );
                                        const rawLower = String(raw).trim().toLowerCase();
                                        if (['cash', 'tiền mặt', 'tien_mat', 'reception', 'tai_quay', 'tại quầy', 'tại lễ tân'].includes(rawLower)) {
                                            return 'CASH';
                                        }
                                        if (['transfer', 'vietqr', 'bank_transfer', 'chuyen_khoan', 'chuyển khoản', 'qr'].includes(rawLower)) {
                                            return 'TRANSFER';
                                        }

                                        const noteLower = (booking.note || '').toLowerCase();
                                        if (noteLower.includes('vietqr') || noteLower.includes('chuyển khoản') || noteLower.includes('transfer')) {
                                            return 'TRANSFER';
                                        }
                                        if (noteLower.includes('reception') || noteLower.includes('tiền mặt') || noteLower.includes('cash') || noteLower.includes('tại lễ tân') || noteLower.includes('tại quầy')) {
                                            return 'CASH';
                                        }
                                        if (['completed', 'checked_out'].includes(booking.status)) {
                                            return 'CASH';
                                        }
                                        return 'CASH';
                                    };

                                    const methodCode = getMethodCode();
                                    const isCash = methodCode === 'CASH';
                                    const isTransfer = methodCode === 'TRANSFER';
                                    const grandTotalNum = Number(booking.grand_total_amount ?? booking.total_amount) || 0;
                                    const roomAmountNum = Number(booking.room_amount ?? booking.total_amount) || 0;
                                    const paidAmountNum = Number(booking.paid_amount || 0);
                                    const remainingBalanceNum = Number(
                                        booking.remaining_balance != null 
                                            ? booking.remaining_balance 
                                            : (booking.remaining_amount != null 
                                                ? booking.remaining_amount 
                                                : Math.max(0, grandTotalNum - paidAmountNum))
                                    );
                                    const isNotCheckedOut = !['completed', 'checked_out', 'cancelled', 'no_show'].includes(booking.status);
                                    const hasRemainingPayment = isNotCheckedOut && remainingBalanceNum > 0;
                                    const extraServices = (Array.isArray(booking.extra_services) && booking.extra_services.length > 0)
                                        ? booking.extra_services
                                        : (Array.isArray(booking.selected_services) && booking.selected_services.length > 0)
                                            ? booking.selected_services
                                            : (Array.isArray(booking.service_requests) ? booking.service_requests : []);
                                    const extraServicesTotal = Number(booking.extra_services_total) || 
                                        extraServices.reduce((sum, s) => sum + Number(s.total_price || (s.price * (s.quantity || 1)) || 0), 0);
                                    const hasExtraServices = extraServices.length > 0;
                                    const groupInfo = getGroupBookingInfo(booking);

                                    return (
                                        <div
                                            key={booking.id}
                                            className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden ${
                                                groupInfo.isGroup
                                                    ? 'border-indigo-200 hover:border-indigo-300 hover:shadow-md'
                                                    : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                                            }`}
                                        >
                                            {/* 1. HEADER CỦA THẺ: MÃ ĐƠN, NGÀY ĐẶT, HUY HIỆU ĐOÀN B2B & BADGE TRẠNG THÁI */}
                                            <div className={`px-5 sm:px-7 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 ${
                                                groupInfo.isGroup
                                                    ? 'bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-slate-50/70 border-indigo-100'
                                                    : 'bg-slate-50/70 border-slate-100'
                                            }`}>
                                                <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                                             Mã đơn:
                                                        </span>
                                                        <span className="font-mono text-sm font-black text-slate-900 tracking-wider">
                                                            {booking.booking_code}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopyCode(booking.booking_code)}
                                                            className="p-1 text-slate-400 hover:text-blue-600 transition rounded-md hover:bg-slate-200/60 text-xs cursor-pointer"
                                                            title="Sao chép mã đơn"
                                                        >
                                                            {copiedCode === booking.booking_code ? '✓' : '📋'}
                                                        </button>
                                                    </div>

                                                    {/* HUY HIỆU PHÂN BIỆT: ĐƠN THEO ĐOÀN VS KHÁCH LẺ */}
                                                    {groupInfo.isGroup ? (
                                                        <span
                                                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white text-indigo-700 border border-indigo-200 shadow-2xs"
                                                            title={`Phòng thuộc Hợp đồng đoàn #${groupInfo.groupCode} - ${groupInfo.groupName}`}
                                                        >
                                                            <span>🏢</span>
                                                            <span className="font-extrabold text-indigo-800">ĐOÀN: #{groupInfo.groupCode}</span>
                                                            {groupInfo.groupName && (
                                                                <span className="hidden sm:inline font-medium text-slate-600 max-w-[220px] truncate">
                                                                    • {groupInfo.groupName}
                                                                </span>
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                            <span>👤</span>
                                                            <span>Khách lẻ</span>
                                                        </span>
                                                    )}

                                                    <span className="hidden sm:inline text-slate-300">•</span>

                                                    <span className="text-xs text-slate-400 hidden sm:inline">
                                                        Đặt lúc: {formatDateTimeDisplay(booking.created_at)}
                                                    </span>
                                                </div>

                                                {/* BADGE TRẠNG THÁI PHÒNG & TRẠNG THÁI THANH TOÁN */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {renderStatusBadge(booking.status)}

                                                    {/* Badge Trạng thái thanh toán (KHÔNG HIỆN nếu đơn đã hủy) */}
                                                    {!isCancelled && (
                                                        groupInfo.isGroup && groupInfo.isMasterBilled ? (
                                                            <span
                                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs"
                                                                title={`Tiền phòng được công ty/trưởng đoàn bảo lãnh quyết toán tập trung qua Hợp đồng đoàn #${groupInfo.groupCode}. Khách lưu trú không phải trả tiền phòng.`}
                                                            >
                                                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                                                <span>🏢 Quyết toán qua HĐ Đoàn</span>
                                                            </span>
                                                        ) : (hasRemainingPayment && paidAmountNum > 0) ? (
                                                            <span
                                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-xs"
                                                                title={`Đã thanh toán trước ${paidAmountNum.toLocaleString('vi-VN')} đ. Còn phải thanh toán thêm ${remainingBalanceNum.toLocaleString('vi-VN')} đ khi trả phòng.`}
                                                            >
                                                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                                                <span>{isCash ? '✓ Tiền mặt (Còn thanh toán)' : (isTransfer ? '✓ VietQR (Còn thanh toán)' : '✓ Đã TT một phần')}</span>
                                                            </span>
                                                        ) : (hasRemainingPayment && paidAmountNum === 0) ? (
                                                            <span
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200"
                                                                title="Chưa thanh toán tiền phòng"
                                                            >
                                                                <span>💵 Chưa TT</span>
                                                            </span>
                                                        ) : (booking.payment_status === 'COMPLETED' || isPaid) ? (
                                                            <span
                                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs"
                                                                title={isCash ? "Đã thanh toán bằng tiền mặt tại quầy lễ tân" : (isTransfer ? "Đã thanh toán thành công qua VietQR" : "Đã thanh toán")}
                                                            >
                                                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                                {isCash ? '✓ Tiền mặt (Đã TT)' : (isTransfer ? '✓ VietQR (Đã TT)' : '✓ Đã thanh toán')}
                                                            </span>
                                                        ) : (
                                                            <span
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200"
                                                                title="Chưa thanh toán tiền phòng"
                                                            >
                                                                <span>💵 Chưa TT</span>
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                            </div>

                                            {/* 2. BODY CỦA THẺ: ẢNH THUMBNAIL, TÊN PHÒNG, NGÀY THÁNG, TỔNG TIỀN */}
                                            <div className="p-5 sm:p-7">
                                                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                                                    {/* Phần bên trái: Ảnh thumbnail + Chi tiết phòng */}
                                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 flex-1">
                                                        {/* Thumbnail phòng */}
                                                        <div className="relative w-full sm:w-44 h-32 shrink-0 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-xs">
                                                            <img
                                                                src={roomThumbnail}
                                                                alt={booking.room_name}
                                                                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                                                                onError={(e) => {
                                                                    e.target.src =
                                                                        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';
                                                                }}
                                                            />
                                                            {booking.room_number && (
                                                                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold">
                                                                    Phòng {booking.room_number}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Thông tin phòng & thời gian lưu trú */}
                                                        <div className="space-y-2 flex-1">
                                                             <div>
                                                                {booking.category_id ? (
                                                                    <Link
                                                                        to={`/rooms/${booking.category_id}`}
                                                                        className="font-serif text-lg sm:text-xl font-bold text-slate-900 hover:text-blue-600 transition tracking-tight"
                                                                    >
                                                                        {booking.room_name}
                                                                    </Link>
                                                                ) : (
                                                                    <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900">
                                                                        {booking.room_name}
                                                                    </h3>
                                                                )}
                                                            </div>

                                                            {/* Lịch Check-in -> Check-out */}
                                                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                                                <div className="inline-flex items-center gap-1.5 font-semibold text-slate-800 bg-slate-100/80 px-2.5 py-1 rounded-xl">
                                                                    <span>📅</span>
                                                                    <span>{formatDateDisplay(booking.check_in_date)}</span>
                                                                    <span className="text-slate-400">→</span>
                                                                    <span>{formatDateDisplay(booking.check_out_date)}</span>
                                                                </div>

                                                                <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-100">
                                                                    🌙 {booking.nights || 1} đêm lưu trú
                                                                </span>
                                                            </div>

                                                            {/* CCCD và Người nhận phòng */}
                                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-1">
                                                                <span>
                                                                    Khách: <strong>{booking.guest_name}</strong>
                                                                </span>
                                                                {booking.identity_card && (
                                                                    <span className="font-mono flex items-center gap-1 text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                                                        <span>🪪</span>
                                                                        <span>{booking.identity_card}</span>
                                                                    </span>
                                                                )}
                                                                {booking.guest_phone && (
                                                                    <span>📞 {booking.guest_phone}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Phần bên phải: Tổng tiền & Nút thao tác */}
                                                    <div className="w-full lg:w-auto flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between lg:justify-center gap-4 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                                                        {groupInfo.isGroup && groupInfo.isMasterBilled ? (
                                                            /* HIỂN THỊ TÀI CHÍNH CHO PHÒNG THUỘC ĐOÀN B2B (MASTER-BILLING) */
                                                            (() => {
                                                                const isGroupAllInclusive = Boolean(
                                                                    booking.is_all_inclusive || 
                                                                    booking.is_company_all_inclusive || 
                                                                    booking.billing_type === 'ALL_INCLUSIVE' ||
                                                                    booking.group_billing_type === 'ALL_INCLUSIVE' ||
                                                                    booking.group_booking_billing_type === 'ALL_INCLUSIVE'
                                                                );
                                                                const guestRemainingBalance = Number(
                                                                    booking.remaining_balance != null 
                                                                        ? booking.remaining_balance 
                                                                        : (booking.remaining_amount != null ? booking.remaining_amount : 0)
                                                                );
                                                                
                                                                const isFullyCoveredByCompany = isGroupAllInclusive || guestRemainingBalance === 0;

                                                                return (
                                                                    <div className="text-left lg:text-right">
                                                                        <span className="text-[11px] font-bold uppercase tracking-wider block text-slate-400">
                                                                            Chi phí khách thanh toán
                                                                        </span>
                                                                        
                                                                        {isFullyCoveredByCompany ? (
                                                                            <>
                                                                                <div className="text-xl sm:text-2xl font-black mt-0.5 text-indigo-700">
                                                                                    0 <span className="text-xs font-bold text-slate-500">VND</span>
                                                                                </div>
                                                                                <div className="mt-1 flex flex-col items-start lg:items-end gap-1 text-[11px]">
                                                                                    <span className="text-slate-400">
                                                                                        Tiền phòng: <strong>{roomAmountNum.toLocaleString('vi-VN')} đ</strong> (Công ty chi trả)
                                                                                    </span>
                                                                                </div>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <div className="text-xl sm:text-2xl font-black mt-0.5 text-amber-600">
                                                                                    +{guestRemainingBalance > 0 ? guestRemainingBalance.toLocaleString('vi-VN') : extraServicesTotal.toLocaleString('vi-VN')} VND
                                                                                </div>
                                                                                <div className="mt-1 flex flex-col items-start lg:items-end gap-1 text-[11px]">
                                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/80 font-bold shadow-2xs">
                                                                                        <span>Dịch vụ phát sinh riêng ({extraServices.length}):</span>
                                                                                        <strong>+{extraServicesTotal.toLocaleString('vi-VN')} đ</strong>
                                                                                    </span>
                                                                                    <span className="text-slate-400">
                                                                                        Tiền phòng: <strong>{roomAmountNum.toLocaleString('vi-VN')} đ</strong> (Công ty chi trả)
                                                                                    </span>
                                                                                    <span className="text-amber-700 font-medium">
                                                                                        (Thu khi khách trả phòng)
                                                                                    </span>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()
                                                        ) : (
                                                            /* HIỂN THỊ TÀI CHÍNH CHO ĐƠN KHÁCH LẺ */
                                                            <div className="text-left lg:text-right">
                                                                {isCancelled ? (
                                                                    <>
                                                                        <span className="text-[11px] font-bold uppercase tracking-wider block text-rose-500">
                                                                            Đơn đã hủy
                                                                        </span>
                                                                        <div className="text-xl sm:text-2xl font-black mt-0.5 text-slate-400 line-through">
                                                                            {grandTotalNum.toLocaleString('vi-VN')} <span className="text-xs font-bold text-slate-500">VND</span>
                                                                        </div>
                                                                    </>
                                                                ) : hasRemainingPayment ? (
                                                                    <>
                                                                        <span className={`text-[11px] font-bold uppercase tracking-wider block ${paidAmountNum > 0 ? 'text-slate-500' : 'text-rose-500'}`}>
                                                                            {paidAmountNum > 0 ? 'Tổng giá trị đơn' : 'Tổng tiền cần thanh toán'}
                                                                        </span>
                                                                        <div className={`text-xl sm:text-2xl font-black mt-0.5 ${paidAmountNum > 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                                                                            {grandTotalNum.toLocaleString('vi-VN')} <span className="text-xs font-bold text-slate-500">VND</span>
                                                                        </div>
                                                                        <div className="mt-1 flex flex-col items-start lg:items-end gap-1 text-[11px]">
                                                                            {hasExtraServices ? (
                                                                                <span className="text-slate-500">
                                                                                    Tiền phòng: <strong className="text-slate-700">{roomAmountNum.toLocaleString('vi-VN')} đ</strong>
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-[10px] text-slate-400 block">
                                                                                    (Đã bao gồm thuế & phí phục vụ)
                                                                                </span>
                                                                            )}
                                                                            {paidAmountNum > 0 && (
                                                                                <span className="text-emerald-700 font-medium">
                                                                                    Đã thanh toán trước: <strong>{paidAmountNum.toLocaleString('vi-VN')} đ</strong>
                                                                                </span>
                                                                            )}
                                                                            {(paidAmountNum > 0 || booking.status === 'checked_in') && (
                                                                                <div className="mt-1 flex items-center justify-between lg:justify-end gap-1.5 text-xs font-bold">
                                                                                    <span className="text-amber-700">
                                                                                        {booking.status === 'checked_in' ? 'Cần thanh toán khi Check-out:' : 'Cần thanh toán:'}
                                                                                    </span>
                                                                                    <span className="font-black text-amber-600">
                                                                                        +{remainingBalanceNum.toLocaleString('vi-VN')} VND
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <span className="text-[11px] font-bold uppercase tracking-wider block text-emerald-700">
                                                                            {isCash ? '✓ Đã thanh toán (Tiền mặt)' : (isTransfer ? '✓ Đã thanh toán (VietQR)' : '✓ Đã thanh toán')}
                                                                        </span>
                                                                        <div className="text-xl sm:text-2xl font-black mt-0.5 text-emerald-600">
                                                                            {grandTotalNum.toLocaleString('vi-VN')} <span className="text-xs font-bold text-slate-500">VND</span>
                                                                        </div>
                                                                        {hasExtraServices ? (
                                                                            <div className="mt-1 flex flex-col items-start lg:items-end gap-1 text-[11px]">
                                                                                <span className="text-slate-500">
                                                                                    Tiền phòng: <strong className="text-slate-700">{roomAmountNum.toLocaleString('vi-VN')} đ</strong>
                                                                                </span>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-[10px] text-slate-400 block">
                                                                                (Đã bao gồm thuế & phí phục vụ)
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* NÚT THAO TÁC */}
                                                        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                                                            {/* Nút Thanh toán ngay (VietQR): Chỉ hiện khi đơn khách lẻ CHƯA thanh toán (Ẩn với đơn đoàn Master-Billing) */}
                                                            {booking.status === 'pending' && !isPaid && (!groupInfo.isGroup || !groupInfo.isMasterBilled) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedPaymentBooking(booking)}
                                                                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/25 active:scale-95"
                                                                    title="Mở mã QR quét thanh toán chuyển khoản"
                                                                >
                                                                    <span>📱</span>
                                                                    <span>Thanh toán ngay (VietQR)</span>
                                                                </button>
                                                            )}

                                                            {/* Nút Hủy đặt phòng (Hỗ trợ cả khách lẻ và đơn đoàn) */}
                                                            {canCancel && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setCancelModalBooking(booking);
                                                                        setCancelScope('single');
                                                                    }}
                                                                    className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                                                >
                                                                    <span>✕</span>
                                                                    <span>{groupInfo.isGroup ? 'Hủy phòng / Hủy đoàn' : 'Hủy đặt phòng'}</span>
                                                                </button>
                                                            )}

                                                            {/* NÚT GIA HẠN PHÒNG CHO KHÁCH ĐANG Ở (checked_in) */}
                                                            {booking.status === 'checked_in' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenExtendModal(booking)}
                                                                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-blue-600/25 active:scale-95"
                                                                >
                                                                    <span>🗓️</span>
                                                                    <span>Gia hạn phòng</span>
                                                                </button>
                                                            )}

                                                            {/* ĐƠN HOÀN TẤT (COMPLETED): ĐÁNH GIÁ HOẶC XEM ĐÁNH GIÁ CỦA TÔI */}
                                                            {booking.status === 'completed' && (
                                                                <>
                                                                    {!booking.review ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const catId = booking.category_id || booking.room_category?.id || booking.category;
                                                                                if (catId) {
                                                                                    navigate(`/rooms/${catId}?review_booking_id=${booking.id}#danh-gia`, {
                                                                                        state: { bookingToReview: booking }
                                                                                    });
                                                                                } else {
                                                                                    handleOpenReviewModal(booking);
                                                                                }
                                                                            }}
                                                                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-amber-500/20 active:scale-95"
                                                                        >
                                                                            <span className="text-amber-200 text-sm">★</span>
                                                                            <span>Đánh giá</span>
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleOpenViewReviewModal(booking)}
                                                                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                                                                        >
                                                                            <span className="text-amber-500 text-sm">★</span>
                                                                            <span>Xem đánh giá của tôi</span>
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}

                                                            {/* NÚT ĐẶT LẠI: Chỉ hiển thị khi đơn đặt phòng đã hoàn thành (completed) */}
                                                            {booking.status === 'completed' && (booking.category_id || booking.room_category?.id || booking.category) && (
                                                                <Link
                                                                    to={`/checkout/${booking.category_id || booking.room_category?.id || booking.category}`}
                                                                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                                                >
                                                                    <span>Đặt lại</span>
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* CHI TIẾT CÁC DỊCH VỤ PHÁT SINH TẠI PHÒNG (NẾU CÓ) */}
                                            {hasExtraServices && (() => {
                                                const isGroupAllInclusive = Boolean(
                                                    booking.is_all_inclusive || 
                                                    booking.is_company_all_inclusive || 
                                                    booking.billing_type === 'ALL_INCLUSIVE' ||
                                                    booking.group_billing_type === 'ALL_INCLUSIVE' ||
                                                    booking.group_booking_billing_type === 'ALL_INCLUSIVE'
                                                );
                                                const guestRemainingBalance = Number(
                                                    booking.remaining_balance != null 
                                                        ? booking.remaining_balance 
                                                        : (booking.remaining_amount != null ? booking.remaining_amount : 0)
                                                );
                                                const isFullyCoveredByCompany = groupInfo.isGroup && groupInfo.isMasterBilled && (isGroupAllInclusive || guestRemainingBalance === 0);

                                                return (
                                                    <div className="bg-white px-5 sm:px-7 py-4 border-t border-slate-100">
                                                        <div className="flex items-center justify-between gap-2 mb-2.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                                                    isFullyCoveredByCompany 
                                                                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/70' 
                                                                        : (extraServices.some(s => (s.service_name || '').toLowerCase().includes('bồi thường')) ? 'bg-rose-50 text-rose-700 border border-rose-200/70' : 'bg-slate-100 text-slate-700 border border-slate-200/80')
                                                                }`}>
                                                                    {isFullyCoveredByCompany ? 'Dịch vụ đặt kèm theo đoàn' : (extraServices.some(s => (s.service_name || '').toLowerCase().includes('bồi thường')) ? 'Dịch vụ & Phụ phí' : 'Dịch vụ & Tiện ích')}
                                                                </span>
                                                                <span className="text-xs font-semibold text-slate-500">
                                                                    Đã ghi nhận ({extraServices.length} mục)
                                                                </span>
                                                            </div>
                                                            <span className={`text-xs font-bold ${isFullyCoveredByCompany ? 'text-indigo-700' : 'text-slate-800'}`}>
                                                                {isFullyCoveredByCompany
                                                                    ? `${extraServicesTotal > 0 ? `Đoàn chi trả: ${extraServicesTotal.toLocaleString('vi-VN')} VND` : 'Tiện ích miễn phí'}`
                                                                    : (extraServicesTotal > 0 ? `Phụ thu: +${extraServicesTotal.toLocaleString('vi-VN')} VND` : 'Tiện ích miễn phí')
                                                                }
                                                            </span>
                                                        </div>
                                                        <div className="divide-y divide-slate-100 text-xs">
                                                            {extraServices.map((srv, idx) => {
                                                                const cleanName = (srv.service_name || '')
                                                                    .replace(/\[Yêu cầu #\d+\]/gi, '')
                                                                    .replace(/\(x\d+\)/gi, '')
                                                                    .trim();
                                                                const isDamage = cleanName.toLowerCase().includes('bồi thường');
                                                                const srvTotal = Number(srv.total_price != null ? srv.total_price : (srv.price * (srv.quantity || 1)));
                                                                return (
                                                                    <div key={srv.id || idx} className={`py-1.5 flex items-center justify-between ${isDamage ? 'text-rose-900 font-medium' : 'text-slate-700'}`}>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`w-1.5 h-1.5 rounded-full ${isDamage ? 'bg-rose-500' : (isFullyCoveredByCompany ? 'bg-indigo-500' : 'bg-amber-500')}`}></span>
                                                                            {isDamage && (
                                                                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                                                                    ⚠️ Bồi thường
                                                                                </span>
                                                                            )}
                                                                            <span className={`font-semibold ${isDamage ? 'text-rose-900' : 'text-slate-900'}`}>{cleanName}</span>
                                                                            <span className="text-slate-400 text-[11px]">(x{srv.quantity || 1})</span>
                                                                            {isFullyCoveredByCompany && srvTotal > 0 && (
                                                                                <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                                                    ✓ Công ty chi trả
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className={`font-bold ${isDamage ? 'text-rose-700' : (srvTotal > 0 ? (isFullyCoveredByCompany ? 'text-indigo-800' : 'text-slate-800') : 'text-emerald-700')}`}>
                                                                            {srvTotal > 0 ? `${srvTotal.toLocaleString('vi-VN')} VND` : 'Miễn phí'}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* BANNER THÔNG TIN HỢP ĐỒNG ĐOÀN CHO PHÒNG THUỘC ĐOÀN B2B */}
                                            {groupInfo.isGroup && (
                                                <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-indigo-50/90 px-5 sm:px-7 py-3 border-t border-indigo-100/90 flex flex-wrap items-center justify-between gap-3 text-xs">
                                                   
                                                    <div className="text-[11px] text-indigo-700 font-medium flex items-center gap-1.5">
                                                        <span>ℹ️</span>
                                                        <span>
                                                            {groupInfo.isMasterBilled
                                                                ? 'Tiền phòng thanh toán tập trung theo HĐ đoàn. Khách chỉ thanh toán dịch vụ riêng khi trả phòng.'
                                                                : 'Phòng thuộc danh sách phân bổ của đoàn.'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Ghi chú đính kèm nếu có (Ẩn tiền tố đoàn trùng lặp) */}
                                            {booking.note && !booking.note.includes('Đoàn thuộc Đoàn #') && (
                                                <div className="bg-slate-50/50 px-5 sm:px-7 py-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-start gap-2">
                                                    <span className="font-bold text-slate-400 shrink-0">Ghi chú:</span>
                                                    <span className="truncate">{booking.note}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* PHÂN TRANG DANH SÁCH ĐƠN ĐẶT PHÒNG */}
                        {!isLoading && filteredBookings.length > 0 && (
                            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs mt-6">
                                <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-3 bg-slate-50/70 border-b border-slate-100 gap-3 text-xs text-slate-500">
                                    <div className="flex items-center gap-2">
                                        <span>Số đơn mỗi trang:</span>
                                        <select
                                            value={pageSize}
                                            onChange={(e) => {
                                                setPageSize(Number(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                        >
                                            <option value={5}>5 đơn / trang</option>
                                            <option value={10}>10 đơn / trang</option>
                                            <option value={20}>20 đơn / trang</option>
                                        </select>
                                    </div>
                                    <span className="text-[11px] text-slate-400">
                                        Hiển thị <strong>{paginatedBookings.length}</strong> / <strong>{filteredBookings.length}</strong> đơn đặt phòng (Tổng {bookings.length})
                                    </span>
                                </div>

                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={handlePageChange}
                                    totalCount={filteredBookings.length}
                                    pageSize={pageSize}
                                />
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* ========================================================================= */}
            {/* MODAL XÁC NHẬN HỦY ĐẶT PHÒNG (DÀNH CHO ĐƠN PENDING) */}
            {/* ========================================================================= */}
            {cancelModalBooking && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 sm:p-8 shadow-2xl text-left animate-in zoom-in-95 duration-200">
                        {/* Header Modal */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl shrink-0 font-bold">
                                ⚠️
                            </div>
                            <div>
                                <h3 className="font-serif text-lg font-bold text-slate-900">
                                    Xác nhận Hủy Đặt Phòng
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Mã đơn: <strong className="font-mono text-slate-800">{cancelModalBooking.booking_code}</strong>
                                </p>
                            </div>
                        </div>

                        {/* Phạm vi hủy nếu là Đơn theo đoàn */}
                        {(() => {
                            const modalGroup = cancelModalBooking ? getGroupBookingInfo(cancelModalBooking) : { isGroup: false };
                            if (!modalGroup.isGroup) return null;
                            return (
                                <div className="mb-4 p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2">
                                    <label className="block text-xs font-bold text-indigo-950 uppercase tracking-wider">
                                        Phạm vi hủy (Đoàn #{modalGroup.groupCode}):
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                        <label className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition ${
                                            cancelScope === 'single'
                                                ? 'border-indigo-600 bg-white ring-2 ring-indigo-500/20 shadow-xs'
                                                : 'border-indigo-100 bg-white/70 hover:bg-white'
                                        }`}>
                                            <input
                                                type="radio"
                                                name="cancelScope"
                                                value="single"
                                                checked={cancelScope === 'single'}
                                                onChange={() => setCancelScope('single')}
                                                className="accent-indigo-600"
                                            />
                                            <div>
                                                <strong className="block text-slate-800">Chỉ hủy phòng này</strong>
                                                <span className="text-[11px] text-slate-500 font-mono">#{cancelModalBooking.booking_code}</span>
                                            </div>
                                        </label>

                                        <label className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition ${
                                            cancelScope === 'group'
                                                ? 'border-rose-600 bg-rose-50/70 ring-2 ring-rose-500/20 shadow-xs'
                                                : 'border-indigo-100 bg-white/70 hover:bg-white'
                                        }`}>
                                            <input
                                                type="radio"
                                                name="cancelScope"
                                                value="group"
                                                checked={cancelScope === 'group'}
                                                onChange={() => setCancelScope('group')}
                                                className="accent-rose-600"
                                            />
                                            <div>
                                                <strong className="block text-rose-700">Hủy toàn bộ đoàn</strong>
                                                <span className="text-[11px] text-rose-500">Đồng bộ hủy tất cả phòng</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Tóm tắt đơn hủy */}
                        <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-2 mb-4 border border-slate-200/80">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Hạng phòng:</span>
                                <strong className="text-slate-900">{cancelModalBooking.room_name}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Thời gian:</span>
                                <span className="text-slate-800 font-medium">
                                    {formatDateDisplay(cancelModalBooking.check_in_date)} → {formatDateDisplay(cancelModalBooking.check_out_date)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Tổng tiền cần thanh toán:</span>
                                <strong className="text-rose-600 font-bold">
                                    {Number(cancelModalBooking.grand_total_amount ?? cancelModalBooking.total_amount).toLocaleString('vi-VN')} VND
                                </strong>
                            </div>
                        </div>

                        {/* Chọn lý do hủy */}
                        <div className="space-y-2 mb-6">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Vui lòng chọn lý do hủy phòng:
                            </label>
                            <select
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                            >
                                <option value="Thay đổi lịch trình chuyến đi">Thay đổi lịch trình chuyến đi</option>
                                <option value="Đặt nhầm ngày hoặc thông tin phòng">Đặt nhầm ngày hoặc thông tin phòng</option>
                                <option value="Tìm thấy mức giá hoặc nơi ở khác phù hợp hơn">Tìm thấy mức giá hoặc nơi ở khác phù hợp hơn</option>
                                <option value="Khác">Lý do cá nhân khác...</option>
                            </select>

                            {cancelReason === 'Khác' && (
                                <textarea
                                    rows={2}
                                    placeholder="Nhập lý do cụ thể của bạn..."
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 mt-2"
                                />
                            )}

                            <span className="text-[11px] text-slate-400 block pt-1">
                                ℹ️ Sau khi hủy, đơn phòng sẽ chuyển sang trạng thái <strong>Đã Hủy</strong> và phòng sẽ được giải phóng cho khách hàng khác.
                            </span>
                        </div>

                        {/* Nút hành động */}
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                disabled={isCancelling}
                                onClick={handleConfirmCancel}
                                className="w-1/2 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                {isCancelling ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang hủy đơn...</span>
                                    </>
                                ) : (
                                    <span>{cancelScope === 'group' ? 'Xác nhận Hủy Toàn Bộ Đoàn' : 'Xác nhận Hủy Phòng'}</span>
                                )}
                            </button>

                            <button
                                type="button"
                                disabled={isCancelling}
                                onClick={() => setCancelModalBooking(null)}
                                className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition text-center cursor-pointer"
                            >
                                Giữ lại đơn
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 2: KHÁCH HÀNG GỬI ĐÁNH GIÁ (REVIEW & RATING) */}
            {/* ========================================================================= */}
            {reviewModalBooking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
                        {/* Header Modal */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center text-xl font-bold">
                                    ★
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                                        Đánh giá kỳ nghỉ của bạn
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {reviewModalBooking.room_name} • Mã đơn:{' '}
                                        <strong className="font-mono text-slate-700">
                                            {reviewModalBooking.booking_code}
                                        </strong>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReviewModalBooking(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Điểm trung bình tự động tính */}
                        <div className="p-3.5 bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50 rounded-2xl border border-amber-200/80 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <span className="text-2xl">🌟</span>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                                        Điểm đánh giá tổng quan
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xl font-black text-amber-600">
                                            {((cleanlinessScore + serviceScore + locationScore + valueScore) / 4).toFixed(1)}
                                        </span>
                                        <span className="text-xs text-slate-400 font-medium">/ 5.0</span>
                                        <span className="text-xs text-amber-700 font-bold ml-1">
                                            {((cleanlinessScore + serviceScore + locationScore + valueScore) / 4) >= 4.5
                                                ? '• Tuyệt vời'
                                                : ((cleanlinessScore + serviceScore + locationScore + valueScore) / 4) >= 4.0
                                                ? '• Rất tốt'
                                                : '• Hài lòng'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-amber-400 text-lg select-none">
                                {'★'.repeat(Math.round((cleanlinessScore + serviceScore + locationScore + valueScore) / 4))}
                                <span className="text-slate-200">
                                    {'★'.repeat(5 - Math.round((cleanlinessScore + serviceScore + locationScore + valueScore) / 4))}
                                </span>
                            </div>
                        </div>

                        {/* 4 Tiêu chí đánh giá sao */}
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Chấm điểm các tiêu chí dịch vụ:
                            </label>

                            {[
                                { key: 'cleanliness', label: 'Mức độ Sạch sẽ (Cleanliness)', val: cleanlinessScore, set: setCleanlinessScore },
                                { key: 'service', label: 'Chất lượng Dịch vụ (Service)', val: serviceScore, set: setServiceScore },
                                { key: 'location', label: 'Vị trí & Cảnh quan (Location)', val: locationScore, set: setLocationScore },
                                { key: 'value', label: 'Giá trị tương xứng (Value)', val: valueScore, set: setValueScore },
                            ].map((criterion) => (
                                <div
                                    key={criterion.key}
                                    className="p-3 bg-slate-50 hover:bg-slate-100/70 transition rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                >
                                    <div>
                                        <span className="text-xs font-bold text-slate-800">
                                            {criterion.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 self-end sm:self-auto">
                                        <div className="flex items-center gap-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    onClick={() => criterion.set(star)}
                                                    className="p-1 hover:scale-125 transition-transform text-lg select-none cursor-pointer"
                                                    title={`${star}/5 sao`}
                                                >
                                                    <span className={star <= criterion.val ? 'text-amber-400' : 'text-slate-200'}>
                                                        ★
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                        <span className="font-mono font-bold text-xs text-amber-700 w-8 text-right">
                                            {criterion.val}/5
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Ô nhập nội dung cảm nhận */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Cảm nhận chi tiết của bạn <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                rows={3}
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                placeholder="Hãy chia sẻ trải nghiệm thực tế về phòng nghỉ, nhân viên phục vụ, đồ ăn sáng và tiện nghi tại khách sạn..."
                                className="w-full p-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-amber-500 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition leading-relaxed"
                            />
                            <span className="text-[11px] text-slate-400 block">
                                Đánh giá của bạn giúp khách sạn nâng cao chất lượng dịch vụ và hỗ trợ du khách khác tham khảo.
                            </span>
                        </div>

                        {/* Nút thao tác */}
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="button"
                                disabled={isSubmittingReview}
                                onClick={handleSubmitReview}
                                className="w-1/2 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-500/30 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                            >
                                {isSubmittingReview ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang gửi đánh giá...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>★</span>
                                        <span>Gửi Đánh Giá</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                disabled={isSubmittingReview}
                                onClick={() => setReviewModalBooking(null)}
                                className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition text-center cursor-pointer"
                            >
                                Để sau
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 3: XEM ĐÁNH GIÁ CỦA TÔI */}
            {/* ========================================================================= */}
            {viewReviewModalBooking && viewReviewModalBooking.review && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
                        {/* Header Modal */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center text-xl font-bold">
                                    ★
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                                        Đánh giá của bạn
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {viewReviewModalBooking.room_name} • Mã đơn:{' '}
                                        <strong className="font-mono text-slate-700">
                                            {viewReviewModalBooking.booking_code}
                                        </strong>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setViewReviewModalBooking(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Điểm tổng quan */}
                        <div className="p-4 bg-gradient-to-r from-amber-50 via-orange-50/40 to-slate-50 rounded-2xl border border-amber-200/80 flex items-center justify-between">
                            <div>
                                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                                    Điểm đánh giá trung bình
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-2xl font-black text-amber-600">
                                        {Number(viewReviewModalBooking.review.overall_rating || 5).toFixed(1)}
                                    </span>
                                    <span className="text-xs text-slate-400">/ 5.0</span>
                                </div>
                            </div>
                            <div className="text-amber-400 text-xl">
                                {'★'.repeat(Math.round(Number(viewReviewModalBooking.review.overall_rating || 5)))}
                                <span className="text-slate-200">
                                    {'★'.repeat(5 - Math.round(Number(viewReviewModalBooking.review.overall_rating || 5)))}
                                </span>
                            </div>
                        </div>

                        {/* 4 Tiêu chí chi tiết */}
                        <div className="grid grid-cols-2 gap-2.5 text-xs">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                <span className="text-slate-600">Sạch sẽ:</span>
                                <strong className="text-slate-900 font-mono">
                                    {viewReviewModalBooking.review.cleanliness_score}/5 ★
                                </strong>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                <span className="text-slate-600">Dịch vụ:</span>
                                <strong className="text-slate-900 font-mono">
                                    {viewReviewModalBooking.review.service_score}/5 ★
                                </strong>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                <span className="text-slate-600">Vị trí:</span>
                                <strong className="text-slate-900 font-mono">
                                    {viewReviewModalBooking.review.location_score}/5 ★
                                </strong>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                <span className="text-slate-600">Giá trị:</span>
                                <strong className="text-slate-900 font-mono">
                                    {viewReviewModalBooking.review.value_score}/5 ★
                                </strong>
                            </div>
                        </div>

                        {/* Nội dung đánh giá của khách */}
                        <div className="space-y-1">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                                Nội dung nhận xét:
                            </span>
                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs sm:text-sm text-slate-800 leading-relaxed font-normal">
                                "{viewReviewModalBooking.review.comment}"
                            </div>
                            <span className="text-[10px] text-slate-400 block pt-0.5">
                                Gửi lúc: {formatDateTimeDisplay(viewReviewModalBooking.review.created_at)}
                            </span>
                        </div>

                        {/* Phản hồi từ khách sạn (theo thiết kế viền trái vàng) */}
                        {viewReviewModalBooking.review.admin_reply ? (
                            <div className="p-4 bg-gray-50 border-l-4 border-yellow-500 rounded-r-2xl space-y-1.5 shadow-2xs">
                                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                    <span>🏨</span>
                                    <span>Khách sạn phản hồi:</span>
                                </span>
                                <p className="text-xs text-slate-700 leading-relaxed font-normal">
                                    {viewReviewModalBooking.review.admin_reply}
                                </p>
                            </div>
                        ) : (
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-500 italic flex items-center gap-2">
                                <span>⏳</span>
                                <span>Khách sạn đã ghi nhận đánh giá của bạn và sẽ sớm phản hồi.</span>
                            </div>
                        )}

                        {/* Nút đóng */}
                        <button
                            type="button"
                            onClick={() => setViewReviewModalBooking(null)}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            )}

            {/* 7. MODAL GIA HẠN THỜI GIAN LƯU TRÚ DÀNH CHO KHÁCH HÀNG */}
            {extendModalBooking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 text-left animate-in zoom-in-95 duration-200">
                        {/* Header Modal */}
                        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center text-xl shadow-xs">
                                    🗓️
                                </div>
                                <div>
                                    <h3 className="font-bold text-base sm:text-lg text-slate-900">
                                        Gia Hạn Thời Gian Lưu Trú
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Đơn #{extendModalBooking.booking_code} • {extendModalBooking.room_name || 'Phòng nghỉ'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setExtendModalBooking(null)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition flex items-center justify-center font-bold text-sm cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Thông tin phòng hiện tại */}
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5 text-xs text-slate-600">
                            <div className="flex items-center justify-between">
                                <span>Hạng phòng:</span>
                                <strong className="text-slate-900 font-semibold">{extendModalBooking.room_name}</strong>
                            </div>
                            {extendModalBooking.room_number && (
                                <div className="flex items-center justify-between">
                                    <span>Phòng đang ở:</span>
                                    <strong className="text-blue-600 font-bold font-mono">Phòng {extendModalBooking.room_number}</strong>
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <span>Ngày nhận phòng (Check-in):</span>
                                <strong className="text-slate-800">{formatDateDisplay(extendModalBooking.check_in_date)}</strong>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Ngày trả phòng hiện tại:</span>
                                <strong className="text-slate-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-amber-900">
                                    {formatDateDisplay(extendModalBooking.check_out_date)} (trước 12:00)
                                </strong>
                            </div>
                        </div>

                        {/* Chọn ngày trả phòng mới */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-900 block">
                                Chọn ngày trả phòng (Check-out) mới: <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="date"
                                min={extendMinDate}
                                value={newCheckOutDate}
                                onChange={(e) => {
                                    setNewCheckOutDate(e.target.value);
                                    setExtendConflictError(null);
                                }}
                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition cursor-pointer shadow-xs"
                            />
                            <p className="text-[11px] text-slate-400">
                                * Chỉ được chọn ngày sau ngày trả phòng hiện tại ({formatDateDisplay(extendModalBooking.check_out_date)}).
                            </p>
                        </div>

                        {/* Xem trước chi phí phát sinh */}
                        {extendCalculation.isValid && (
                            <div className="p-4 bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50 rounded-2xl border border-blue-200/80 space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600">Số đêm lưu trú thêm:</span>
                                    <strong className="text-blue-700 font-bold">+{extendCalculation.extraNights} đêm</strong>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600">Đơn giá phòng tham khảo:</span>
                                    <span className="text-slate-800 font-mono">{extendCalculation.nightlyRate.toLocaleString('vi-VN')} đ/đêm</span>
                                </div>
                                <div className="pt-2 border-t border-blue-200/60 flex items-center justify-between">
                                    <span className="font-bold text-slate-900">Số tiền dự kiến tính thêm:</span>
                                    <strong className="text-amber-600 font-mono text-base font-black">
                                        +{extendCalculation.extraAmount.toLocaleString('vi-VN')} đ
                                    </strong>
                                </div>
                            </div>
                        )}

                        {/* Cảnh báo lỗi kẹt phòng nếu có */}
                        {extendConflictError && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2 animate-in fade-in">
                                <span className="text-base">⚠️</span>
                                <div>
                                    <strong className="font-bold block">Không thể gia hạn:</strong>
                                    <span className="text-[11px] leading-relaxed mt-0.5 block">{extendConflictError}</span>
                                </div>
                            </div>
                        )}

                        {/* Nút thao tác */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setExtendModalBooking(null)}
                                disabled={isSubmittingExtend}
                                className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-bold text-xs transition cursor-pointer"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmExtendStay}
                                disabled={isSubmittingExtend || !extendCalculation.isValid}
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/25 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                                {isSubmittingExtend ? (
                                    <>
                                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                        <span>Đang kiểm tra & gia hạn...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Xác nhận gia hạn</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Thanh toán VietQR động khi khách bấm "Thanh toán ngay" */}
            {selectedPaymentBooking && (
                <PaymentModal
                    isOpen={true}
                    booking={{
                        id: selectedPaymentBooking.id,
                        total_amount: Number(selectedPaymentBooking.grand_total_amount ?? selectedPaymentBooking.total_amount) || 0,
                        booking_code: selectedPaymentBooking.booking_code,
                        customer_name: user?.full_name || selectedPaymentBooking.guest_name || 'Quý khách'
                    }}
                    onSuccess={() => {
                        showToast('success', `Đã xác nhận thanh toán cho đơn ${selectedPaymentBooking.booking_code} thành công!`);
                        setSelectedPaymentBooking(null);
                        fetchBookings(true);
                    }}
                    onCancelBooking={(code) => {
                        showToast('info', `Đã hủy đơn đặt phòng ${code || selectedPaymentBooking.booking_code} thành công.`);
                        setSelectedPaymentBooking(null);
                        fetchBookings(true);
                    }}
                    onClose={() => setSelectedPaymentBooking(null)}
                />
            )}

            <Footer />
        </div>
    );
}
