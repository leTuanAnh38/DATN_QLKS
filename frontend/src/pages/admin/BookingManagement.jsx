import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../store/authStore';
import { bookingService } from '../../services/bookingService';
import { hotelService } from '../../services/hotelService';
import roomService from '../../services/roomService';
import { notificationService } from '../../services/notificationService';
import HotelInvoiceModal from '../../components/admin/modals/HotelInvoiceModal';
import CheckOutModal from '../../components/admin/modals/CheckOutModal';
import CheckInModal from '../../components/admin/modals/CheckInModal';
import StayingGuestsModal from '../../components/admin/modals/StayingGuestsModal';
import Pagination from '../../components/common/Pagination';
import { useHasPermission } from '../../utils/permission';

// Format ngày tháng DD/MM/YYYY
const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—';
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

// Kiểm tra xem đã tới hoặc qua ngày check-in hay chưa (Chỉ cho phép No-show từ ngày check-in)
const isCheckInDateReached = (dateStr) => {
    if (!dateStr) return false;
    try {
        const parts = String(dateStr).split('T')[0].split('-');
        if (parts.length === 3) {
            const checkInDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            checkInDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return today >= checkInDate;
        }
    } catch {
        return false;
    }
    return false;
};

// Format thời gian chi tiết HH:MM • DD/MM/YYYY
const formatDateTimeDisplay = (isoStr) => {
    if (!isoStr) return '—';
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

// Danh sách các trạng thái đặt phòng
const STATUS_OPTIONS = [
    { value: 'pending', label: 'Chờ duyệt (Pending)', color: 'bg-amber-50 text-amber-800 border-amber-300 focus:ring-amber-500' },
    { value: 'paid', label: 'Chờ duyệt (Đã TT QR)', color: 'bg-amber-50 text-amber-800 border-amber-300 focus:ring-amber-500' },
    { value: 'confirmed', label: 'Đã xác nhận (Confirmed)', color: 'bg-blue-50 text-blue-800 border-blue-300 focus:ring-blue-500' },
    { value: 'checked_in', label: 'Đã Check-in (Checked-in)', color: 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-emerald-500' },
    { value: 'checked_out', label: 'Đã Check-out (Checked-out)', color: 'bg-purple-50 text-purple-800 border-purple-300 focus:ring-purple-500' },
    { value: 'completed', label: 'Đã Hoàn tất (Completed)', color: 'bg-indigo-50 text-indigo-800 border-indigo-300 focus:ring-indigo-500' },
    { value: 'no_show', label: 'Khách không đến (No-show)', color: 'bg-slate-100 text-slate-700 border-slate-300 focus:ring-slate-500' },
    { value: 'cancelled', label: 'Đã Hủy (Cancelled)', color: 'bg-rose-50 text-rose-800 border-rose-300 focus:ring-rose-500' }
];

export default function BookingManagement({ onBookingChanged, initialFilter = 'all' }) {
    // Phân quyền chi tiết theo Ma trận phân quyền RBAC
    const { user: currentUser } = useAuth();
    const currentUserRole = currentUser?.role || '';
    const canCreateBookings = useHasPermission('bookings', 'create');
    const canUpdateBookings = useHasPermission('bookings', 'update');
    const canDeleteBookings = useHasPermission('bookings', 'delete');
    // canManageBookings phục vụ các thao tác cập nhật đơn: Duyệt, Check-in, Check-out, No-show, Sửa
    const canManageBookings = canUpdateBookings;

    // 1. Quản lý State Dữ liệu
    const [bookings, setBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null); // ID của đơn đang được gọi API PATCH đổi trạng thái
    const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: '' }
    const [isSendingReminders, setIsSendingReminders] = useState(false);
    const [remindingBookingId, setRemindingBookingId] = useState(null);

    // 2. State Lọc & Tìm kiếm
    const [quickFilterMode, setQuickFilterMode] = useState(initialFilter);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchKeyword, setSearchKeyword] = useState('');
    const [copiedCode, setCopiedCode] = useState(null);

    // Phân trang
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    // Reset về trang 1 khi thay đổi điều kiện lọc
    useEffect(() => {
        setCurrentPage(1);
    }, [quickFilterMode, statusFilter, searchKeyword]);

    // Ref luôn lưu mode mới nhất để polling/focus không bị stale closure
    const quickFilterModeRef = useRef(quickFilterMode);
    useEffect(() => {
        quickFilterModeRef.current = quickFilterMode;
    }, [quickFilterMode]);

    // Đồng bộ khi prop initialFilter thay đổi từ Sidebar
    useEffect(() => {
        if (initialFilter) {
            setQuickFilterMode(initialFilter);
        }
    }, [initialFilter]);

    // 3. State Modal Xem Chi tiết Đơn đặt phòng
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [internalNoteInput, setInternalNoteInput] = useState('');
    const [isSavingInternalNote, setIsSavingInternalNote] = useState(false);

    // 4. State Modal Check-in (Thủ tục Nhận phòng & Gán phòng thực tế)
    const [checkInModalBooking, setCheckInModalBooking] = useState(null);
    const [availableRooms, setAvailableRooms] = useState([]);
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [checkInNote, setCheckInNote] = useState('');
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);
    const [isSubmittingCheckIn, setIsSubmittingCheckIn] = useState(false);
    const [confirmEarlyCheckIn, setConfirmEarlyCheckIn] = useState(false);
    const [applyEarlyCharge, setApplyEarlyCharge] = useState(true);
    const [confirmLateCheckIn, setConfirmLateCheckIn] = useState(false);

    // 5. State Modal Tiếp Đón Khách (Walk-in & Đặt phòng trước qua điện thoại)
    const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
    const [isStayingGuestsModalOpen, setIsStayingGuestsModalOpen] = useState(false);
    const [bookingTab, setBookingTab] = useState('walk_in'); // 'walk_in' | 'advance'
    const [walkInAvailableRooms, setWalkInAvailableRooms] = useState([]);
    const [advanceCategories, setAdvanceCategories] = useState([]);
    const [isLoadingWalkInRooms, setIsLoadingWalkInRooms] = useState(false);
    const [isLoadingCategories, setIsLoadingCategories] = useState(false);
    const [isSubmittingWalkIn, setIsSubmittingWalkIn] = useState(false);
    const [walkInForm, setWalkInForm] = useState({
        guest_name: '',
        guest_phone: '',
        identity_card: '',
        guest_email: '',
        room_id: '',
        category_id: '',
        check_in_date: new Date().toISOString().split('T')[0],
        check_out_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        initial_status: 'confirmed',
        note: '',
        internal_note: ''
    });

    // 6. State Modal In Hóa Đơn Đặt Phòng (Check-in Invoice Voucher)
    const [invoiceModalBooking, setInvoiceModalBooking] = useState(null);

    // 7. State Modal Thêm Dịch Vụ / Gọi Món Cho Khách (Tại quầy / Qua điện thoại)
    const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);
    const [serviceCatalog, setServiceCatalog] = useState([]);
    const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
    const [isSubmittingService, setIsSubmittingService] = useState(false);
    const [serviceMode, setServiceMode] = useState('menu'); // 'menu' | 'custom'
    const [serviceSearchKeyword, setServiceSearchKeyword] = useState('');
    const [serviceCategoryFilter, setServiceCategoryFilter] = useState('all');
    const [serviceForm, setServiceForm] = useState({
        service_id: '',
        custom_name: '',
        quantity: 1,
        price: '',
        note: '',
        service_status: 'completed'
    });

    // 8. State Modal Check-out (Bảng kê thanh toán & Trả phòng)
    const [checkOutModalBooking, setCheckOutModalBooking] = useState(null);

    // 9. State Modal Đánh dấu No-show (Khách không đến nhận phòng)
    const [noShowModalBooking, setNoShowModalBooking] = useState(null);
    const [noShowReason, setNoShowReason] = useState('Quá giờ check-in quy định không liên lạc được');
    const [customNoShowReason, setCustomNoShowReason] = useState('');
    const [isSubmittingNoShow, setIsSubmittingNoShow] = useState(false);

    // 9.1 State Modal Xác Nhận Hủy Đơn Đặt Phòng (Nền trắng giữa màn hình)
    const [cancelConfirmBooking, setCancelConfirmBooking] = useState(null);
    const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

    // 10. State Gia Hạn Lưu Trú (Extend Stay) trong Admin Detail Modal
    const [adminExtendNewDate, setAdminExtendNewDate] = useState('');
    const [isSubmittingAdminExtend, setIsSubmittingAdminExtend] = useState(false);
    const [adminExtendConflictError, setAdminExtendConflictError] = useState(null);

    // Tự động khởi tạo ngày check-out mới khi mở modal đơn checked_in
    useEffect(() => {
        if (selectedBooking && selectedBooking.status === 'checked_in' && selectedBooking.check_out_date) {
            setAdminExtendConflictError(null);
            try {
                const cur = new Date(selectedBooking.check_out_date);
                cur.setDate(cur.getDate() + 1);
                setAdminExtendNewDate(cur.toISOString().split('T')[0]);
            } catch {
                setAdminExtendNewDate('');
            }
        }
    }, [selectedBooking]);

    const adminExtendMinDate = useMemo(() => {
        if (!selectedBooking?.check_out_date) return '';
        try {
            const cur = new Date(selectedBooking.check_out_date);
            cur.setDate(cur.getDate() + 1);
            return cur.toISOString().split('T')[0];
        } catch {
            return '';
        }
    }, [selectedBooking]);

    const adminExtendCalc = useMemo(() => {
        if (!selectedBooking || !adminExtendNewDate) {
            return { extraNights: 0, nightlyRate: 0, extraAmount: 0, isValid: false };
        }
        try {
            const oldDate = new Date(selectedBooking.check_out_date);
            const newDate = new Date(adminExtendNewDate);
            const diffTime = newDate.getTime() - oldDate.getTime();
            const extraNights = Math.round(diffTime / (1000 * 3600 * 24));
            if (extraNights <= 0) {
                return { extraNights: 0, nightlyRate: 0, extraAmount: 0, isValid: false };
            }
            const dailyRate = Number(selectedBooking.daily_rate) ||
                (selectedBooking.nights > 0 ? Number(selectedBooking.total_amount) / selectedBooking.nights : 0);
            const extraAmount = extraNights * dailyRate;
            return { extraNights, nightlyRate: dailyRate, extraAmount, isValid: true };
        } catch {
            return { extraNights: 0, nightlyRate: 0, extraAmount: 0, isValid: false };
        }
    }, [selectedBooking, adminExtendNewDate]);

    const handleAdminExtendStay = async () => {
        if (!selectedBooking || !adminExtendNewDate) return;
        if (!canManageBookings) {
            showToast('error', 'Bạn không có quyền gia hạn lưu trú (Yêu cầu quyền Cập nhật đơn đặt phòng).');
            return;
        }
        if (!adminExtendCalc.isValid) {
            showToast('error', 'Ngày trả phòng mới phải sau ngày trả phòng hiện tại.');
            return;
        }

        try {
            setIsSubmittingAdminExtend(true);
            setAdminExtendConflictError(null);
            const res = await bookingService.extendStay(selectedBooking.id, adminExtendNewDate);
            if (res.success) {
                showToast('success', res.message || 'Gia hạn lưu trú thành công!');
                if (res.booking) {
                    setSelectedBooking(res.booking);
                } else {
                    setSelectedBooking((prev) => ({
                        ...prev,
                        check_out_date: res.new_check_out_date || adminExtendNewDate,
                        total_amount: res.new_total_amount || prev.total_amount
                    }));
                }
                fetchBookings(true);
            } else {
                setAdminExtendConflictError(res.message || 'Không thể gia hạn phòng.');
                showToast('error', res.message || 'Không thể gia hạn phòng.');
            }
        } catch (err) {
            const msg = err.message || 'Lỗi khi gửi yêu cầu gia hạn.';
            setAdminExtendConflictError(msg);
            showToast('error', msg);
        } finally {
            setIsSubmittingAdminExtend(false);
        }
    };

    // Helper hiển thị thông báo toast
    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    };

    // Kích hoạt quét và gửi thông báo nhắc nhở Check-in & Check-out hôm nay
    const handleTriggerDailyReminders = async () => {
        try {
            setIsSendingReminders(true);
            const res = await notificationService.triggerReminders(false);
            if (res.success && res.data) {
                const { guest_checkin_sent, staff_checkin_sent, guest_checkout_sent, staff_checkout_sent, total_notifications_created } = res.data;
                if (total_notifications_created > 0) {
                    showToast('success', `Đã gửi ${total_notifications_created} thông báo (${guest_checkin_sent + guest_checkout_sent} gửi khách, ${staff_checkin_sent + staff_checkout_sent} gửi nhân viên/quản lý)!`);
                } else {
                    showToast('info', 'Tất cả khách và nhân viên có lịch check-in/out hôm nay đều đã nhận được thông báo trước đó!');
                }
            } else {
                showToast('error', res.message || 'Lỗi khi kích hoạt thông báo');
            }
        } catch (e) {
            showToast('error', 'Không thể kết nối đến máy chủ thông báo');
        } finally {
            setIsSendingReminders(false);
        }
    };

    // Gửi thông báo nhắc nhở riêng cho 1 đơn cụ thể
    const handleSendReminderForBooking = async (bookingId) => {
        try {
            setRemindingBookingId(bookingId);
            const res = await notificationService.remindBooking(bookingId, 'auto', true, false);
            if (res.success) {
                showToast('success', res.message || 'Đã gửi thông báo nhắc nhở đến khách hàng thành công!');
            } else {
                showToast('error', res.message || 'Lỗi khi gửi thông báo nhắc nhở');
            }
        } catch (e) {
            showToast('error', 'Lỗi khi gửi thông báo nhắc nhở');
        } finally {
            setRemindingBookingId(null);
        }
    };

    // Tải danh sách đơn đặt phòng từ API (hỗ trợ lọc nhanh check-in-today / check-out-today)
    const fetchBookings = async (isSilent = false, overrideMode = null) => {
        try {
            if (!isSilent) setIsLoading(true);
            const activeMode = overrideMode || quickFilterModeRef.current;
            let res;
            if (activeMode === 'check-in-today') {
                res = await bookingService.getCheckInToday();
            } else if (activeMode === 'check-out-today') {
                res = await bookingService.getCheckOutToday();
            } else {
                res = await bookingService.getMyBookings({ no_page: 'true' });
            }

            if (res && res.success) {
                const list = res.data || [];
                setBookings(list);
                if (typeof onBookingChanged === 'function') {
                    onBookingChanged(list);
                }
            } else if (Array.isArray(res)) {
                setBookings(res);
                if (typeof onBookingChanged === 'function') {
                    onBookingChanged(res);
                }
            } else if (!isSilent) {
                showToast('error', res?.message || 'Không thể tải danh sách đơn đặt phòng.');
            }
        } catch (error) {
            if (!isSilent) showToast('error', error.message || 'Lỗi kết nối khi tải danh sách đặt phòng.');
        } finally {
            if (!isSilent) setIsLoading(false);
        }
    };

    // Khi chuyển đổi chế độ lọc nhanh (Tất cả / Check-in hôm nay / Check-out hôm nay)
    useEffect(() => {
        // Reset bộ lọc dropdown trạng thái về 'all' để không làm ẩn các đơn hợp lệ của chế độ mới
        setStatusFilter('all');
        fetchBookings(false, quickFilterMode);
    }, [quickFilterMode]);

    // Lắng nghe sự kiện đồng bộ cửa sổ & chu kỳ polling thời gian thực (8 giây)
    useEffect(() => {
        // 1. Tự động đồng bộ khi chuyển về tab này
        const handleFocus = () => fetchBookings(true);
        // 2. Nhận tín hiệu khi có khách vừa đặt phòng ở tab/cửa sổ khác
        const handleStorage = (e) => {
            if (e.key === 'pms_last_booking_event') {
                fetchBookings(true);
            }
        };
        const handleCustomBooking = () => fetchBookings(true);

        window.addEventListener('focus', handleFocus);
        window.addEventListener('storage', handleStorage);
        window.addEventListener('pms_booking_created', handleCustomBooking);

        // 3. Chu kỳ polling kiểm tra đơn mới mỗi 8 giây (đọc mode từ ref, không lo stale closure)
        const interval = setInterval(() => {
            fetchBookings(true);
        }, 8000);

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('pms_booking_created', handleCustomBooking);
            clearInterval(interval);
        };
    }, []);

    // Xử lý đổi trạng thái nhanh trực tiếp ngay tại ô Trạng thái trong bảng (API PATCH)
    const handleQuickStatusChange = async (bookingId, newStatus, skipConfirm = false) => {
        if (!bookingId || !newStatus) return;

        if (!canManageBookings) {
            showToast('error', 'Bạn không có quyền thay đổi trạng thái đơn đặt phòng.');
            return;
        }

        // Nếu chọn chuyển sang "checked_in": Bắt buộc phải thực hiện gán phòng thực tế qua Modal Check-in
        if (newStatus === 'checked_in') {
            const targetBooking = bookings.find((b) => b.id === bookingId);
            if (targetBooking) {
                handleOpenCheckInModal(targetBooking);
                return;
            }
        }

        // Nếu chọn chuyển sang "cancelled" mà chưa xác nhận qua modal -> Mở Modal Xác Nhận Hủy Đơn
        if (newStatus === 'cancelled' && !skipConfirm) {
            const targetBooking = bookings.find((b) => b.id === bookingId) || (selectedBooking?.id === bookingId ? selectedBooking : null);
            if (targetBooking) {
                setCancelConfirmBooking(targetBooking);
                return;
            }
        }

        // Lưu lại trạng thái cũ để rollback nếu lỗi
        const previousBookings = [...bookings];

        // Cập nhật optimistic trên giao diện
        setBookings((prev) =>
            prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
        );

        if (selectedBooking && selectedBooking.id === bookingId) {
            setSelectedBooking((prev) => ({ ...prev, status: newStatus }));
        }

        try {
            setUpdatingId(bookingId);
            const res = await bookingService.updateBookingStatus(bookingId, newStatus);

            if (res && res.success) {
                const updatedData = res.data;
                const statusName =
                    STATUS_OPTIONS.find((s) => s.value === newStatus)?.label || newStatus;
                showToast('success', `Đã đổi trạng thái đơn #${updatedData?.booking_code || bookingId} sang "${statusName}".`);

                // Đồng bộ lại dữ liệu đầy đủ từ server nếu có
                if (updatedData) {
                    setBookings((prev) =>
                        prev.map((b) => (b.id === bookingId ? { ...b, ...updatedData, status: newStatus } : b))
                    );
                    if (selectedBooking && selectedBooking.id === bookingId) {
                        setSelectedBooking((prev) => ({ ...prev, ...updatedData, status: newStatus }));
                    }
                }

                // Thông báo ra component cha để cập nhật số lượng badge
                if (typeof onBookingChanged === 'function') {
                    onBookingChanged();
                }

                // Phát tín hiệu đồng bộ realtime sang chuông thông báo và các tab khác
                try {
                    localStorage.setItem('pms_last_booking_event', Date.now().toString());
                    window.dispatchEvent(new CustomEvent('pms_booking_created'));
                } catch (e) { }
            } else {
                // Rollback nếu thất bại
                setBookings(previousBookings);
                if (selectedBooking && selectedBooking.id === bookingId) {
                    const prevStatus = previousBookings.find((b) => b.id === bookingId)?.status;
                    if (prevStatus) {
                        setSelectedBooking((prev) => ({ ...prev, status: prevStatus }));
                    }
                }
                const errorMsg = res?.message || 'Không thể đổi trạng thái đơn đặt phòng.';
                if (errorMsg.includes('Khách hàng chỉ có quyền') || errorMsg.includes('thẩm quyền') || res?.code === 403) {
                    showToast('error', '⚠️ Tài khoản hiện tại không có quyền duyệt đơn (Phiên Admin bị ghi đè bởi tài khoản khách). Vui lòng đăng xuất và đăng nhập lại Admin.');
                } else {
                    showToast('error', errorMsg);
                }
                fetchBookings(true);
            }
        } catch (error) {
            setBookings(previousBookings);
            if (selectedBooking && selectedBooking.id === bookingId) {
                const prevStatus = previousBookings.find((b) => b.id === bookingId)?.status;
                if (prevStatus) {
                    setSelectedBooking((prev) => ({ ...prev, status: prevStatus }));
                }
            }
            showToast('error', error.message || 'Lỗi kết nối máy chủ.');
            fetchBookings(true);
        } finally {
            setUpdatingId(null);
        }
    };

    // Xác nhận hủy đơn đặt phòng qua Modal xác nhận màu trắng
    const handleExecuteCancelBooking = async () => {
        if (!cancelConfirmBooking) return;
        try {
            setIsSubmittingCancel(true);
            const targetId = cancelConfirmBooking.id;
            await handleQuickStatusChange(targetId, 'cancelled', true);
            setCancelConfirmBooking(null);
        } catch (error) {
            showToast('error', error?.message || 'Có lỗi xảy ra khi hủy đơn.');
        } finally {
            setIsSubmittingCancel(false);
        }
    };

    // Mở modal xem chi tiết
    const handleOpenDetailModal = (booking) => {
        setSelectedBooking(booking);
        setInternalNoteInput(booking.internal_note || '');
    };

    // Lưu ghi chú nội bộ lễ tân
    const handleSaveInternalNote = async () => {
        if (!selectedBooking) return;
        if (!canManageBookings) {
            showToast('error', 'Bạn không có quyền chỉnh sửa ghi chú nội bộ.');
            return;
        }
        try {
            setIsSavingInternalNote(true);
            const res = await bookingService.updateBooking(selectedBooking.id, {
                internal_note: internalNoteInput.trim()
            });

            if (res && res.success) {
                showToast('success', 'Đã lưu ghi chú nội bộ lễ tân thành công.');
                setBookings((prev) =>
                    prev.map((b) =>
                        b.id === selectedBooking.id
                            ? { ...b, internal_note: internalNoteInput.trim() }
                            : b
                    )
                );
                setSelectedBooking((prev) => ({
                    ...prev,
                    internal_note: internalNoteInput.trim()
                }));
            } else {
                showToast('error', res?.message || 'Lỗi khi lưu ghi chú nội bộ.');
            }
        } catch (error) {
            showToast('error', error.message || 'Lỗi khi lưu ghi chú.');
        } finally {
            setIsSavingInternalNote(false);
        }
    };

    // Mở Modal Check-in (Nhận phòng & Gán phòng thực tế)
    const handleOpenCheckInModal = async (booking) => {
        if (!canManageBookings) {
            showToast('error', 'Chỉ nhân viên Lễ tân hoặc Quản lý mới có quyền thực hiện thủ tục Check-in nhận phòng.');
            return;
        }

        setCheckInModalBooking(booking);
        setSelectedRoomId('');
        setCheckInNote('');
        setAvailableRooms([]);
        setConfirmEarlyCheckIn(false);
        setApplyEarlyCharge(true);
        setConfirmLateCheckIn(false);
        setIsLoadingRooms(true);

        try {
            const res = await bookingService.getAvailableRoomsForBooking(
                booking.id,
                booking.category_id
            );
            if (res && res.success) {
                const rooms = res.rooms || [];
                setAvailableRooms(rooms);
                if (rooms.length > 0) {
                    setSelectedRoomId(String(rooms[0].id));
                }
            } else {
                showToast('error', res?.message || 'Không thể tải danh sách phòng trống.');
            }
        } catch (error) {
            showToast('error', error.message || 'Lỗi khi tải danh sách phòng trống.');
        } finally {
            setIsLoadingRooms(false);
        }
    };

    // Tính toán số ngày nhận phòng sớm (Early Check-in) & Trễ (Late Check-in)
    const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    // Kiểm tra đơn đặt phòng đã quá hạn lưu trú (Ngày trả phòng <= hôm nay)
    const isExpiredCheckInBooking = useMemo(() => {
        if (!checkInModalBooking?.check_out_date) return false;
        return String(checkInModalBooking.check_out_date).split('T')[0] <= todayDateStr;
    }, [checkInModalBooking?.check_out_date, todayDateStr]);

    const isEarlyCheckInBooking = useMemo(() => {
        if (!checkInModalBooking?.check_in_date || isExpiredCheckInBooking) return false;
        return String(checkInModalBooking.check_in_date).split('T')[0] > todayDateStr;
    }, [checkInModalBooking?.check_in_date, isExpiredCheckInBooking, todayDateStr]);

    const earlyDaysCount = useMemo(() => {
        if (!checkInModalBooking?.check_in_date || !isEarlyCheckInBooking) return 0;
        const d1 = new Date(String(checkInModalBooking.check_in_date).split('T')[0]);
        const d2 = new Date(todayDateStr);
        d1.setHours(0, 0, 0, 0);
        d2.setHours(0, 0, 0, 0);
        return Math.max(0, Math.round((d1 - d2) / (1000 * 60 * 60 * 24)));
    }, [checkInModalBooking?.check_in_date, isEarlyCheckInBooking, todayDateStr]);

    // Kiểm tra khách đến nhận phòng trễ ngày (Ngày nhận ban đầu < hôm nay và chưa quá hạn trả phòng)
    const isLateCheckInBooking = useMemo(() => {
        if (!checkInModalBooking?.check_in_date || isExpiredCheckInBooking) return false;
        return String(checkInModalBooking.check_in_date).split('T')[0] < todayDateStr;
    }, [checkInModalBooking?.check_in_date, isExpiredCheckInBooking, todayDateStr]);

    const lateDaysCount = useMemo(() => {
        if (!checkInModalBooking?.check_in_date || !isLateCheckInBooking) return 0;
        const dToday = new Date(todayDateStr);
        const dOriginal = new Date(String(checkInModalBooking.check_in_date).split('T')[0]);
        dToday.setHours(0, 0, 0, 0);
        dOriginal.setHours(0, 0, 0, 0);
        return Math.max(0, Math.round((dToday - dOriginal) / (1000 * 60 * 60 * 24)));
    }, [checkInModalBooking?.check_in_date, isLateCheckInBooking, todayDateStr]);

    const remainingNightsCount = useMemo(() => {
        if (!checkInModalBooking?.check_out_date) return 0;
        const dOut = new Date(String(checkInModalBooking.check_out_date).split('T')[0]);
        const dToday = new Date(todayDateStr);
        dOut.setHours(0, 0, 0, 0);
        dToday.setHours(0, 0, 0, 0);
        return Math.max(0, Math.round((dOut - dToday) / (1000 * 60 * 60 * 24)));
    }, [checkInModalBooking?.check_out_date, todayDateStr]);

    const estimatedEarlyCharge = useMemo(() => {
        if (!earlyDaysCount || !checkInModalBooking) return 0;
        let dailyRate = 0;
        if (checkInModalBooking.category?.promo_price) {
            dailyRate = Number(checkInModalBooking.category.promo_price);
        } else if (checkInModalBooking.category?.base_price) {
            dailyRate = Number(checkInModalBooking.category.base_price);
        } else if (checkInModalBooking.total_amount && checkInModalBooking.check_out_date && checkInModalBooking.check_in_date) {
            const originalNights = Math.max(1, Math.round((new Date(checkInModalBooking.check_out_date) - new Date(checkInModalBooking.check_in_date)) / (1000 * 60 * 60 * 24)));
            dailyRate = Number(checkInModalBooking.total_amount) / originalNights;
        }
        return dailyRate * earlyDaysCount;
    }, [earlyDaysCount, checkInModalBooking]);

    // Xác nhận hoàn tất thủ tục Check-in (Gán phòng thực tế & đổi trạng thái sang checked_in)
    const handleConfirmCheckIn = async () => {
        if (!checkInModalBooking) return;

        if (isExpiredCheckInBooking) {
            showToast('error', 'Đơn đặt phòng này đã quá hạn lưu trú, không thể thực hiện Check-in.');
            return;
        }

        if (!selectedRoomId) {
            showToast('error', 'Vui lòng chọn phòng thực tế trước khi hoàn tất Check-in.');
            return;
        }

        if (isEarlyCheckInBooking && !confirmEarlyCheckIn) {
            showToast('error', `Vui lòng tích xác nhận đồng ý cho khách nhận phòng sớm ${earlyDaysCount} ngày.`);
            return;
        }

        if (isLateCheckInBooking && !confirmLateCheckIn) {
            showToast('error', `Vui lòng tích xác nhận đồng ý cho khách nhận phòng trễ ${lateDaysCount} ngày.`);
            return;
        }

        try {
            setIsSubmittingCheckIn(true);
            const res = await bookingService.checkInBooking(checkInModalBooking.id, {
                room_id: selectedRoomId,
                internal_note: checkInNote.trim(),
                confirm_early_check_in: confirmEarlyCheckIn,
                apply_early_charge: applyEarlyCharge,
                confirm_late_check_in: confirmLateCheckIn
            });

            if (res && res.success) {
                const updatedBooking = res.data;
                const assignedRoom = res.room;
                const roomNum = assignedRoom?.room_number || checkInModalBooking.room_number;

                showToast(
                    'success',
                    `🔑 Check-in thành công cho khách "${checkInModalBooking.guest_name}" vào phòng ${roomNum}!`
                );

                // Cập nhật state bookings trên giao diện
                setBookings((prev) =>
                    prev.map((b) =>
                        b.id === checkInModalBooking.id
                            ? {
                                ...b,
                                ...(updatedBooking || {}),
                                status: 'checked_in',
                                room_number: roomNum || b.room_number,
                                actual_check_in: updatedBooking?.actual_check_in || new Date().toISOString(),
                                internal_note: checkInNote.trim() || b.internal_note
                            }
                            : b
                    )
                );

                // Nếu đang mở modal chi tiết cùng booking đó, cập nhật luôn
                if (selectedBooking && selectedBooking.id === checkInModalBooking.id) {
                    setSelectedBooking((prev) => ({
                        ...prev,
                        ...(updatedBooking || {}),
                        status: 'checked_in',
                        room_number: roomNum || prev.room_number,
                        actual_check_in: updatedBooking?.actual_check_in || new Date().toISOString(),
                        internal_note: checkInNote.trim() || prev.internal_note
                    }));
                }

                // Đóng modal Check-in
                setCheckInModalBooking(null);

                // Tự động mở Modal Hóa Đơn chuẩn mẫu để Lễ tân in ngay cho khách
                setInvoiceModalBooking({
                    ...checkInModalBooking,
                    ...(updatedBooking || {}),
                    status: 'checked_in',
                    room_number: roomNum || checkInModalBooking.room_number,
                    actual_check_in: updatedBooking?.actual_check_in || new Date().toISOString(),
                    internal_note: checkInNote.trim() || checkInModalBooking.internal_note
                });

                // Thông báo ra ngoài để AdminDashboard cập nhật thống kê/badge
                if (typeof onBookingChanged === 'function') {
                    onBookingChanged();
                }

                // Phát tín hiệu đồng bộ realtime sang chuông thông báo và các tab khác
                try {
                    localStorage.setItem('pms_last_booking_event', Date.now().toString());
                    window.dispatchEvent(new CustomEvent('pms_booking_created'));
                } catch (e) { }
            } else {
                showToast('error', res?.message || 'Check-in thất bại. Vui lòng kiểm tra lại tình trạng phòng.');
            }
        } catch (error) {
            showToast('error', error.message || 'Lỗi kết nối máy chủ khi Check-in.');
        } finally {
            setIsSubmittingCheckIn(false);
        }
    };

    // Mở Modal Tiếp Đón Khách (Walk-in hoặc Đặt trước qua điện thoại)
    const handleOpenWalkInModal = async (initialTab = 'walk_in') => {
        if (!canCreateBookings) {
            showToast('error', 'Bạn không có quyền tạo đơn đặt phòng mới (Yêu cầu quyền Thêm mới).');
            return;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        setBookingTab(initialTab);
        setWalkInForm({
            guest_name: '',
            guest_phone: '',
            identity_card: '',
            guest_email: '',
            room_id: '',
            category_id: '',
            check_in_date: todayStr,
            check_out_date: tomorrowStr,
            initial_status: 'confirmed',
            note: '',
            internal_note: ''
        });

        setIsWalkInModalOpen(true);
        setIsLoadingWalkInRooms(true);
        setIsLoadingCategories(true);

        try {
            const [roomsRes, catsRes] = await Promise.all([
                roomService.getAdminRooms({ status: 'available' }),
                roomService.getCategories()
            ]);

            if (roomsRes && roomsRes.success) {
                const rooms = roomsRes.rooms || [];
                setWalkInAvailableRooms(rooms);
                if (rooms.length > 0) {
                    setWalkInForm((prev) => ({ ...prev, room_id: String(rooms[0].id) }));
                }
            }

            const cats = catsRes?.categories || (Array.isArray(catsRes) ? catsRes : []);
            setAdvanceCategories(cats);
            if (cats.length > 0) {
                setWalkInForm((prev) => ({ ...prev, category_id: String(cats[0].id) }));
            }
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu phòng và hạng phòng:', error);
            showToast('error', error.message || 'Lỗi khi tải danh sách phòng/hạng phòng.');
        } finally {
            setIsLoadingWalkInRooms(false);
            setIsLoadingCategories(false);
        }
    };

    // Xác nhận tiếp đón (Walk-in Check-in ngay HOẶC Đặt phòng trước qua điện thoại)
    const handleConfirmWalkIn = async (e) => {
        if (e && e.preventDefault) e.preventDefault();

        if (!canCreateBookings) {
            showToast('error', 'Bạn không có quyền tạo đơn đặt phòng mới (Yêu cầu quyền Thêm mới).');
            return;
        }

        if (!walkInForm.guest_name.trim()) {
            showToast('error', 'Vui lòng nhập Họ và tên khách hàng.');
            return;
        }
        if (!walkInForm.guest_phone.trim()) {
            showToast('error', 'Vui lòng cung cấp Số điện thoại khách hàng.');
            return;
        }
        if (!walkInForm.identity_card.trim()) {
            showToast('error', 'Vui lòng nhập Số CCCD / Hộ chiếu (Passport).');
            return;
        }
        if (walkInForm.identity_card.trim().length < 8 || walkInForm.identity_card.trim().length > 20) {
            showToast('error', 'Số CCCD / Hộ chiếu phải từ 8 đến 20 ký tự.');
            return;
        }
        if (!walkInForm.check_out_date) {
            showToast('error', 'Vui lòng chọn ngày Check-out.');
            return;
        }

        if (bookingTab === 'walk_in') {
            if (!walkInForm.room_id) {
                showToast('error', 'Vui lòng chọn phòng thực tế trống để đón khách.');
                return;
            }
        } else {
            if (!walkInForm.category_id) {
                showToast('error', 'Vui lòng chọn Hạng phòng khách muốn đặt giữ chỗ.');
                return;
            }
            if (!walkInForm.check_in_date) {
                showToast('error', 'Vui lòng chọn ngày Check-in.');
                return;
            }
            if (walkInForm.check_out_date <= walkInForm.check_in_date) {
                showToast('error', 'Ngày Check-out bắt buộc phải sau ngày Check-in.');
                return;
            }
        }

        try {
            setIsSubmittingWalkIn(true);
            let res;
            if (bookingTab === 'walk_in') {
                res = await bookingService.createWalkInBooking(walkInForm);
            } else {
                res = await bookingService.createAdvanceReservation({
                    ...walkInForm,
                    status: walkInForm.initial_status || 'confirmed'
                });
            }

            if (res && res.success) {
                const newBooking = res.data || res.booking;
                if (bookingTab === 'walk_in') {
                    const assignedRoom = res.room;
                    const roomNum = assignedRoom?.room_number || 'đã chọn';
                    showToast(
                        'success',
                        `✨ Tiếp đón khách Walk-in thành công! Đã Check-in khách "${walkInForm.guest_name}" vào Phòng ${roomNum}.`
                    );
                } else {
                    const catObj = advanceCategories.find((c) => String(c.id) === String(walkInForm.category_id));
                    const catName = catObj?.name || 'đã chọn';
                    showToast(
                        'success',
                        `✨ Tạo đơn đặt giữ chỗ thành công! Mã đơn: #${newBooking?.booking_code || ''} (Hạng ${catName}).`
                    );
                }

                // Thêm đơn mới vào đầu danh sách bookings trên UI
                if (newBooking) {
                    setBookings((prev) => [newBooking, ...prev]);
                } else {
                    fetchBookings();
                }

                setIsWalkInModalOpen(false);

                // Tự động mở Modal Hóa Đơn nếu là Walk-in để Lễ tân in ngay
                if (bookingTab === 'walk_in' && newBooking) {
                    setInvoiceModalBooking(newBooking);
                }

                if (typeof onBookingChanged === 'function') {
                    onBookingChanged();
                }
            } else {
                showToast('error', res?.message || 'Không thể tạo đơn đặt phòng.');
            }
        } catch (error) {
            showToast('error', error.message || 'Lỗi kết nối khi gửi yêu cầu tiếp đón khách.');
        } finally {
            setIsSubmittingWalkIn(false);
        }
    };

    // Danh sách gợi ý nhanh các khoản phụ thu thường gặp
    const QUICK_SURCHARGES = [
        "Nước ngọt / Bia Mini Bar",
        "Đền bù ly / đồ thủy tinh vỡ",
        "Phụ thu trả phòng muộn (Late Check-out)",
        "Phụ thu nhận phòng sớm (Early Check-in)",
        "Giặt ủi nhanh lấy ngay",
        "Phụ thu khách ở thêm (Extra Person)"
    ];

    // Mở modal Thêm Dịch Vụ Cho Đơn Đặt Phòng (tại quầy / qua điện thoại)
    const openAddServiceModal = async () => {
        setIsAddServiceModalOpen(true);
        setServiceMode('menu');
        setServiceSearchKeyword('');
        setServiceCategoryFilter('all');
        setServiceForm({
            service_id: '',
            custom_name: '',
            quantity: 1,
            price: '',
            note: '',
            service_status: 'completed'
        });

        if (serviceCatalog.length === 0) {
            setIsLoadingCatalog(true);
            try {
                const res = await hotelService.getServiceItems({ status: 'active' });
                if (res && res.success && res.items) {
                    setServiceCatalog(res.items);
                }
            } catch (err) {
                console.error('Lỗi khi tải thực đơn dịch vụ:', err);
            } finally {
                setIsLoadingCatalog(false);
            }
        }
    };

    // Khi nhân viên chọn món từ danh mục
    const handleServiceSelect = (id) => {
        const item = serviceCatalog.find((s) => String(s.id) === String(id));
        setServiceForm((prev) => ({
            ...prev,
            service_id: id,
            price: item ? item.price : ''
        }));
    };

    // Xử lý gửi Form Thêm Dịch Vụ Cho Khách
    const handleAddExtraServiceSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!selectedBooking) return;

        if (serviceMode === 'menu' && !serviceForm.service_id) {
            showToast('error', 'Vui lòng chọn một món hoặc dịch vụ từ thực đơn.');
            return;
        }

        if (serviceMode === 'custom' && !serviceForm.custom_name.trim()) {
            showToast('error', 'Vui lòng nhập tên dịch vụ hoặc phụ phí.');
            return;
        }

        if (serviceMode === 'custom' && (serviceForm.price === '' || Number(serviceForm.price) < 0)) {
            showToast('error', 'Vui lòng nhập đơn giá hợp lệ.');
            return;
        }

        try {
            setIsSubmittingService(true);
            const payload = {
                quantity: Number(serviceForm.quantity) || 1,
                note: serviceForm.note.trim(),
                service_status: serviceForm.service_status
            };

            if (serviceMode === 'menu') {
                payload.service_id = serviceForm.service_id;
                if (serviceForm.price !== '') payload.price = Number(serviceForm.price);
            } else {
                payload.custom_name = serviceForm.custom_name.trim();
                payload.price = Number(serviceForm.price);
            }

            const res = await bookingService.addExtraService(selectedBooking.id, payload);
            if (res && res.success && res.booking) {
                showToast('success', res.message || 'Thêm dịch vụ cho khách thành công!');
                setSelectedBooking(res.booking);
                setBookings((prev) => prev.map((b) => (b.id === res.booking.id ? res.booking : b)));
                if (typeof onBookingChanged === 'function') {
                    onBookingChanged();
                }
                setIsAddServiceModalOpen(false);
            } else {
                showToast('error', res?.message || 'Không thể thêm dịch vụ. Vui lòng thử lại.');
            }
        } catch (error) {
            showToast('error', error.message || 'Lỗi kết nối khi thêm dịch vụ.');
        } finally {
            setIsSubmittingService(false);
        }
    };

    // Xóa dịch vụ / phụ phí khỏi đơn đặt phòng
    const handleRemoveExtraService = async (itemId, itemName) => {
        if (!selectedBooking) return;
        if (!window.confirm(`Bạn có chắc chắn muốn xóa "${itemName}" khỏi đơn đặt phòng này?`)) return;

        try {
            const res = await bookingService.removeExtraService(selectedBooking.id, itemId);
            if (res && res.success && res.booking) {
                showToast('success', res.message || 'Đã xóa dịch vụ thành công!');
                setSelectedBooking(res.booking);
                setBookings((prev) => prev.map((b) => (b.id === res.booking.id ? res.booking : b)));
                if (typeof onBookingChanged === 'function') {
                    onBookingChanged();
                }
            } else {
                showToast('error', res?.message || 'Không thể xóa dịch vụ.');
            }
        } catch (error) {
            showToast('error', error.message || 'Lỗi khi xóa dịch vụ.');
        }
    };

    // Đánh dấu nhanh yêu cầu dịch vụ đã giao xong (tính vào hóa đơn)
    const handleQuickCompleteService = async (rawId, itemName) => {
        if (!selectedBooking) return;
        try {
            const res = await hotelService.updateServiceRequestStatus(rawId, 'completed');
            if (res && res.success) {
                showToast('success', `Đã phục vụ xong món "${itemName}" và tính vào hóa đơn!`);
                const updatedRes = await bookingService.getBookingById(selectedBooking.id);
                const updated = updatedRes.data || updatedRes.booking || updatedRes;
                if (updated && updated.id) {
                    setSelectedBooking(updated);
                    setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
                    if (typeof onBookingChanged === 'function') {
                        onBookingChanged();
                    }
                }
            } else {
                showToast('error', res?.message || 'Không thể cập nhật trạng thái dịch vụ.');
            }
        } catch (error) {
            showToast('error', error.message || 'Lỗi khi cập nhật trạng thái dịch vụ.');
        }
    };

    // Trích xuất các nhóm dịch vụ từ thực đơn để lọc
    const serviceCategories = useMemo(() => {
        const cats = new Map();
        serviceCatalog.forEach((item) => {
            if (item.category && item.category.name) {
                cats.set(item.category.id, item.category.name);
            } else if (item.category_name) {
                cats.set(item.category_id || item.category_name, item.category_name);
            }
        });
        return Array.from(cats.entries()).map(([id, name]) => ({ id, name }));
    }, [serviceCatalog]);

    // Danh sách thực đơn đã qua lọc tìm kiếm / danh mục
    const filteredCatalog = useMemo(() => {
        return serviceCatalog.filter((item) => {
            const catId = item.category?.id || item.category_id;
            const matchesCategory =
                serviceCategoryFilter === 'all' || String(catId) === String(serviceCategoryFilter);
            const matchesSearch =
                !serviceSearchKeyword.trim() ||
                item.name.toLowerCase().includes(serviceSearchKeyword.toLowerCase()) ||
                (item.category?.name && item.category.name.toLowerCase().includes(serviceSearchKeyword.toLowerCase()));
            return matchesCategory && matchesSearch;
        });
    }, [serviceCatalog, serviceCategoryFilter, serviceSearchKeyword]);

    // Xử lý xác nhận đánh dấu No-show (Khách không đến nhận phòng)
    const handleConfirmNoShow = async () => {
        if (!noShowModalBooking) return;
        if (!isCheckInDateReached(noShowModalBooking.check_in_date)) {
            showToast('error', `Chưa tới ngày nhận phòng (${formatDateDisplay(noShowModalBooking.check_in_date)}). Không thể đánh dấu No-show. Vui lòng chọn Hủy đơn nếu khách báo hủy.`);
            return;
        }
        const finalReason = noShowReason === 'Khác' ? (customNoShowReason.trim() || 'Lý do khác') : noShowReason;
        try {
            setIsSubmittingNoShow(true);
            const res = await bookingService.markNoShow(noShowModalBooking.id, { reason: finalReason });
            if (res && res.success) {
                showToast('success', res.message || 'Đã đánh dấu No-show và giải phóng phòng thành công!');
                const updatedId = noShowModalBooking.id;
                setNoShowModalBooking(null);
                setCustomNoShowReason('');
                if (selectedBooking && selectedBooking.id === updatedId) {
                    setSelectedBooking(null);
                }
                await fetchBookings(true);
                if (typeof onBookingChanged === 'function') onBookingChanged();
            } else {
                showToast('error', res?.message || 'Không thể đánh dấu No-show.');
            }
        } catch (err) {
            showToast('error', err.message || 'Lỗi khi xử lý No-show.');
        } finally {
            setIsSubmittingNoShow(false);
        }
    };

    // Sao chép mã booking
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
        const checkedOut = bookings.filter((b) => b.status === 'checked_out' || b.status === 'completed').length;
        const noShow = bookings.filter((b) => b.status === 'no_show').length;
        const cancelled = bookings.filter((b) => b.status === 'cancelled').length;

        const totalRevenue = bookings
            .filter((b) => ['confirmed', 'checked_in', 'checked_out', 'completed'].includes(b.status))
            .reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

        return { total, pending, confirmed, checkedIn, checkedOut, noShow, cancelled, totalRevenue };
    }, [bookings]);

    // Dữ liệu đã lọc theo dropdown và tìm kiếm
    const filteredBookings = useMemo(() => {
        const result = bookings.filter((item) => {
            // Lọc trạng thái từ Dropdown
            if (statusFilter !== 'all') {
                if (statusFilter === 'checked_out') {
                    if (item.status !== 'checked_out' && item.status !== 'completed') return false;
                } else if (statusFilter === 'pending') {
                    if (!['pending', 'paid', 'PAID'].includes(item.status)) return false;
                } else if (item.status !== statusFilter) {
                    return false;
                }
            }
            // Lọc từ khóa tìm kiếm
            if (searchKeyword.trim()) {
                const q = searchKeyword.trim().toLowerCase();
                const matchCode = item.booking_code?.toLowerCase().includes(q);
                const matchGuest = item.guest_name?.toLowerCase().includes(q);
                const matchPhone = item.guest_phone?.toLowerCase().includes(q);
                const matchCccd = item.identity_card?.toLowerCase().includes(q);
                const matchRoom = item.room_name?.toLowerCase().includes(q);
                const matchRoomNum = String(item.room_number || '').toLowerCase().includes(q);
                return matchCode || matchGuest || matchPhone || matchCccd || matchRoom || matchRoomNum;
            }
            return true;
        });

        // Sắp xếp theo yêu cầu nghiệp vụ:
        // 1. Chờ duyệt (pending) lên đầu tiên
        // 2. Đã xác nhận (confirmed) kế tiếp
        // 3. Đang ở / lưu trú (checked_in) kế tiếp
        // 4. Các đơn đã hoàn tất / đã trả phòng / no-show / đã hủy
        // Trong cùng nhóm trạng thái: Đơn mới tạo nhất xếp lên đầu (-created_at)
        const STATUS_PRIORITY = {
            pending: 1,
            paid: 1,
            PAID: 1,
            confirmed: 2,
            checked_in: 3,
            checked_out: 4,
            completed: 4,
            no_show: 5,
            cancelled: 6
        };

        return [...result].sort((a, b) => {
            const priorityA = STATUS_PRIORITY[a.status] || 99;
            const priorityB = STATUS_PRIORITY[b.status] || 99;

            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            const timeA = new Date(a.created_at || 0).getTime();
            const timeB = new Date(b.created_at || 0).getTime();
            return timeB - timeA;
        });
    }, [bookings, statusFilter, searchKeyword]);

    // Phân trang danh sách đơn đặt phòng đã lọc & sắp xếp
    const totalPages = Math.ceil(filteredBookings.length / pageSize) || 1;
    const paginatedBookings = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredBookings.slice(start, start + pageSize);
    }, [filteredBookings, currentPage, pageSize]);

    return (
        <div className="space-y-6 min-w-0 max-w-full">
            {/* TOAST THÔNG BÁO NỔI */}
            {toast && (
                <div
                    className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-2.5 text-xs font-bold transition transform animate-in slide-in-from-top duration-300 ${toast.type === 'success'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30'
                        : 'bg-rose-600 text-white border-rose-500 shadow-rose-600/30'
                        }`}
                >
                    <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
                    <span>{toast.message}</span>
                </div>
            )}

            {/* HEADER PHÂN HỆ QUẢN LÝ ĐẶT PHÒNG */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
                <div>
                    <h2 className="text-2xl font-serif font-bold text-slate-900 tracking-tight">
                        Quản Lý Danh Sách Đặt Phòng
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Theo dõi danh sách khách lưu trú, xác nhận đơn mới, kiểm tra CCCD/Hộ chiếu và cập nhật trạng thái phòng.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* NÚT XUẤT DS KHAI BÁO LƯU TRÚ CHO CÔNG AN */}
                    <button
                        type="button"
                        onClick={() => setIsStayingGuestsModalOpen(true)}
                        className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/25 transition flex items-center gap-2 cursor-pointer active:scale-95"
                        title="Xem và xuất danh sách toàn bộ khách đang lưu trú thực tế tại khách sạn để nộp Công an phường"
                    >
                        <span>📋</span>
                        <span>Xuất DS Khai báo lưu trú</span>
                    </button>

                    {canCreateBookings && (
                        <button
                            type="button"
                            onClick={() => handleOpenWalkInModal('walk_in')}
                            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/25 hover:shadow-blue-600/40 transition flex items-center gap-2 cursor-pointer active:scale-95"
                            title="Tiếp đón khách vãng lai nhận phòng ngay hoặc đặt phòng trước qua điện thoại/Zalo"
                        >
                            <span>+ Tiếp đón & Đặt phòng tại quầy</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={fetchBookings}
                        disabled={isLoading}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
                        title="Tải lại danh sách mới nhất"
                    >
                        <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
                        <span>{isLoading ? 'Đang tải...' : 'Làm mới'}</span>
                    </button>
                </div>
            </div>

            {/* HÀNG THỐNG KÊ NHANH (QUICK STATS CARDS) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                {/* 1. Tổng đơn */}
                <div
                    onClick={() => setStatusFilter('all')}
                    className={`p-4 rounded-2xl border transition cursor-pointer ${statusFilter === 'all'
                        ? 'bg-blue-50 text-blue-800 border-blue-300 shadow-md ring-1 ring-blue-200'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 shadow-xs'
                        }`}
                >
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 block">
                        TỔNG ĐƠN
                    </span>
                    <div className="text-2xl font-black mt-1">{stats.total}</div>
                    <span className="text-[11px] opacity-75 mt-0.5 block">Tất cả kỳ nghỉ</span>
                </div>

                {/* 2. Chờ duyệt */}
                <div
                    onClick={() => setStatusFilter('pending')}
                    className={`p-4 rounded-2xl border transition cursor-pointer ${statusFilter === 'pending'
                        ? 'bg-amber-500 text-white border-amber-600 shadow-md'
                        : 'bg-amber-50/70 text-amber-900 border-amber-200 hover:border-amber-300 shadow-xs'
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                            CHỜ DUYỆT
                        </span>
                        {stats.pending > 0 && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                        )}
                    </div>
                    <div className="text-2xl font-black mt-1">{stats.pending}</div>
                    <span className="text-[11px] opacity-80 mt-0.5 block">Cần xử lý & xác nhận</span>
                </div>

                {/* 3. Đã xác nhận */}
                <div
                    onClick={() => setStatusFilter('confirmed')}
                    className={`p-4 rounded-2xl border transition cursor-pointer ${statusFilter === 'confirmed'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-md'
                        : 'bg-blue-50/70 text-blue-900 border-blue-200 hover:border-blue-300 shadow-xs'
                        }`}
                >
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 block">
                        ĐÃ XÁC NHẬN
                    </span>
                    <div className="text-2xl font-black mt-1">{stats.confirmed}</div>
                    <span className="text-[11px] opacity-80 mt-0.5 block">Sẵn sàng đón tiếp</span>
                </div>

                {/* 4. Đang lưu trú */}
                <div
                    onClick={() => setStatusFilter('checked_in')}
                    className={`p-4 rounded-2xl border transition cursor-pointer ${statusFilter === 'checked_in'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-md'
                        : 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:border-emerald-300 shadow-xs'
                        }`}
                >
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 block">
                        ĐANG Ở (IN-HOUSE)
                    </span>
                    <div className="text-2xl font-black mt-1">{stats.checkedIn}</div>
                    <span className="text-[11px] opacity-80 mt-0.5 block">Khách đang lưu trú</span>
                </div>

                {/* 5. Đã hủy */}
                <div
                    onClick={() => setStatusFilter('cancelled')}
                    className={`p-4 rounded-2xl border transition cursor-pointer ${statusFilter === 'cancelled'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-1 ring-rose-300'
                        : 'bg-rose-50/70 text-rose-900 border-rose-200 hover:border-rose-300 shadow-xs'
                        }`}
                >
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 block">
                        ĐÃ HỦY
                    </span>
                    <div className="text-2xl font-black mt-1">{stats.cancelled}</div>
                    <span className="text-[11px] opacity-80 mt-0.5 block">Đơn khách/lễ tân hủy</span>
                </div>

                {/* 6. Doanh thu dự kiến */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        DOANH THU ĐƠN
                    </span>
                    <div className="text-lg font-black text-rose-600 mt-1 truncate">
                        {stats.totalRevenue.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-400">VND</span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">Đơn hợp lệ</span>
                </div>
            </div>

            {/* BẢNG DỮ LIỆU CHÍNH & THANH CÔNG CỤ (FILTER & SEARCH) */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden min-w-0 max-w-full">
                {/* THANH FILTER DROPDOWN & TÌM KIẾM NHANH */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 bg-slate-50/50">
                    <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
                        {/* Thanh Lọc Nhanh Phân Hệ: Tất cả / Check-in hôm nay / Check-out hôm nay */}
                        <div className="flex items-center p-1 bg-slate-200/70 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setQuickFilterMode('all')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${quickFilterMode === 'all'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                                <span>Tất cả</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuickFilterMode('check-in-today')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${quickFilterMode === 'check-in-today'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-emerald-700 hover:text-emerald-800'
                                    }`}
                            >
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                </svg>
                                <span>Check-in hôm nay</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuickFilterMode('check-out-today')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${quickFilterMode === 'check-out-today'
                                    ? 'bg-purple-600 text-white shadow-xs'
                                    : 'text-purple-700 hover:text-purple-800'
                                    }`}
                            >
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span>Check-out hôm nay</span>
                            </button>
                        </div>

                        {/* Nút gửi thông báo Check-in / Check-out hôm nay */}
                        <button
                            type="button"
                            onClick={handleTriggerDailyReminders}
                            disabled={isSendingReminders}
                            title="Quét và gửi thông báo nhắc nhở đến Khách hàng và Nhân viên/Quản lý về lịch Check-in và Check-out hôm nay"
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-xs cursor-pointer ${isSendingReminders
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 hover:border-amber-400'
                                }`}
                        >
                            <svg className={`w-3.5 h-3.5 shrink-0 ${isSendingReminders ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {isSendingReminders ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                )}
                            </svg>
                            <span>{isSendingReminders ? 'Đang gửi...' : 'Gửi thông báo Check-in/out'}</span>
                        </button>

                        {/* 1. Thanh Filter (Dropdown) theo Trạng thái */}
                        <div className="flex items-center gap-1.5">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0 hidden sm:inline">
                                Lọc:
                            </label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 cursor-pointer"
                            >
                                <option value="all">Tất cả trạng thái ({stats.total})</option>
                                <option value="pending">⏳ Chờ duyệt ({stats.pending})</option>
                                <option value="confirmed">✓ Đã xác nhận ({stats.confirmed})</option>
                                <option value="checked_in">🏨 Đang lưu trú ({stats.checkedIn})</option>
                                <option value="checked_out">🏁 Đã trả phòng ({stats.checkedOut})</option>
                                <option value="no_show">🚫 Khách không đến ({stats.noShow})</option>
                                <option value="cancelled">✕ Đã hủy ({stats.cancelled})</option>
                            </select>
                        </div>

                        {statusFilter !== 'all' && (
                            <button
                                type="button"
                                onClick={() => setStatusFilter('all')}
                                className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer shrink-0"
                            >
                                Đặt lại
                            </button>
                        )}
                    </div>

                    {/* 2. Ô tìm kiếm nhanh */}
                    <div className="relative w-full xl:w-72 shrink-0">
                        <input
                            type="text"
                            placeholder="Tìm mã, khách, CCCD, SĐT, phòng..."
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            className="w-full pl-8 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition shadow-xs"
                        />
                        <span className="absolute left-2.5 top-2.5 text-slate-400 text-xs">🔍</span>
                        {searchKeyword && (
                            <button
                                type="button"
                                onClick={() => setSearchKeyword('')}
                                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* BẢNG DỮ LIỆU ĐẶT PHÒNG (DATA TABLE TỰ CO GIÃN VỪA KHÍT) */}
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                                <th className="py-3 px-2.5 whitespace-nowrap">Mã Booking</th>
                                <th className="py-3 px-2.5">Khách hàng & CCCD</th>
                                <th className="py-3 px-2.5">Phòng</th>
                                <th className="py-3 px-2.5 whitespace-nowrap">Check-in / Out</th>
                                <th className="py-3 px-2.5 whitespace-nowrap">Tổng tiền</th>
                                <th className="py-3 px-2.5 whitespace-nowrap">Trạng thái</th>
                                <th className="py-3 px-2 text-center whitespace-nowrap">Hành động</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {/* Loading State */}
                            {isLoading && (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-400">
                                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                        <span>Đang tải danh sách đơn đặt phòng...</span>
                                    </td>
                                </tr>
                            )}

                            {/* Empty State */}
                            {!isLoading && filteredBookings.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-400">
                                        <div className="text-3xl mb-2">📭</div>
                                        <p className="font-semibold text-slate-700">Không tìm thấy đơn đặt phòng nào</p>
                                        <p className="text-[11px] text-slate-400 mt-1">
                                            {searchKeyword
                                                ? 'Hãy thử tìm kiếm với từ khóa khác.'
                                                : 'Chưa có đơn đặt phòng nào phù hợp với bộ lọc hiện tại.'}
                                        </p>
                                    </td>
                                </tr>
                            )}

                            {/* Data Rows */}
                            {!isLoading &&
                                paginatedBookings.map((booking) => {
                                    const isRowUpdating = updatingId === booking.id;
                                    const totalAmountNum = Number(booking.total_amount) || 0;
                                    const statusConfig =
                                        STATUS_OPTIONS.find((s) => s.value === booking.status) || {
                                            color: 'bg-slate-100 text-slate-700 border-slate-200'
                                        };

                                    return (
                                        <tr
                                            key={booking.id}
                                            className={`hover:bg-blue-50/30 transition duration-150 ${isRowUpdating ? 'opacity-60 bg-slate-50' : ''
                                                }`}
                                        >
                                            {/* CỘT 1: MÃ BOOKING */}
                                            <td className="py-2.5 px-2.5 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-xs font-black text-slate-900 tracking-wider">
                                                        {booking.booking_code}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyCode(booking.booking_code)}
                                                        className="text-slate-400 hover:text-blue-600 transition text-[11px] p-0.5 rounded cursor-pointer"
                                                        title="Sao chép mã"
                                                    >
                                                        {copiedCode === booking.booking_code ? '✓' : '📋'}
                                                    </button>
                                                </div>
                                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                                    {formatDateTimeDisplay(booking.created_at)}
                                                </span>
                                            </td>

                                            {/* CỘT 2: TÊN KHÁCH & CCCD */}
                                            <td className="py-2.5 px-2.5 min-w-[120px] max-w-[155px]">
                                                <div className="font-bold text-slate-900 text-xs truncate" title={booking.guest_name}>
                                                    {booking.guest_name}
                                                </div>
                                                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                                    📞 {booking.guest_phone || 'Chưa có SĐT'}
                                                </div>
                                                {booking.identity_card ? (
                                                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-semibold text-slate-700 mt-0.5 border border-slate-200 max-w-full">
                                                        <span>🪪</span>
                                                        <span className="truncate">{booking.identity_card}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-amber-600 italic mt-0.5 block truncate">
                                                        Chưa có CCCD
                                                    </span>
                                                )}
                                            </td>

                                            {/* CỘT 3: PHÒNG */}
                                            <td className="py-2.5 px-2.5 min-w-[120px] max-w-[160px]">
                                                <strong className="text-slate-800 block text-xs font-semibold truncate" title={booking.room_name}>
                                                    {booking.room_name}
                                                </strong>
                                                <div className="mt-0.5">
                                                    {booking.room_number ? (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                                            Phòng {booking.room_number}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-medium border border-slate-200">
                                                            Chờ gán số phòng
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* CỘT 4: CHECK-IN / CHECK-OUT */}
                                            <td className="py-2.5 px-2.5 whitespace-nowrap">
                                                <div className="font-semibold text-slate-800 text-xs">
                                                    {formatDateDisplay(booking.check_in_date)}
                                                    <span className="text-slate-400 mx-1">→</span>
                                                    {formatDateDisplay(booking.check_out_date)}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                                    <span className="inline-block px-2 py-0.2 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                                                        🌙 {booking.nights || 1} đêm lưu trú
                                                    </span>
                                                    {/* Badge Khách đến muộn / Quá hạn nhận phòng */}
                                                    {(() => {
                                                        if (booking.status !== 'confirmed') return null;
                                                        const bCheckIn = booking.check_in_date ? String(booking.check_in_date).split('T')[0] : '';
                                                        const bCheckOut = booking.check_out_date ? String(booking.check_out_date).split('T')[0] : '';
                                                        const todayStr = new Date().toISOString().split('T')[0];
                                                        const currentHour = new Date().getHours();

                                                        if (bCheckOut && bCheckOut <= todayStr) {
                                                            return (
                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 text-[9.5px] font-bold border border-rose-200" title="Đã qua ngày trả phòng mà khách chưa check-in">
                                                                    ⛔ Quá hạn trả
                                                                </span>
                                                            );
                                                        }
                                                        if (bCheckIn && bCheckIn < todayStr) {
                                                            const d1 = new Date(todayStr);
                                                            const d2 = new Date(bCheckIn);
                                                            d1.setHours(0, 0, 0, 0);
                                                            d2.setHours(0, 0, 0, 0);
                                                            const daysLate = Math.max(1, Math.round((d1 - d2) / (1000 * 60 * 60 * 24)));
                                                            return (
                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-800 text-[9.5px] font-bold border border-amber-200" title={`Khách chưa check-in, trễ ${daysLate} ngày`}>
                                                                    ⏰ Trễ {daysLate}N
                                                                </span>
                                                            );
                                                        }
                                                        if (bCheckIn === todayStr && currentHour >= 18) {
                                                            return (
                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-800 text-[9.5px] font-bold border border-amber-200" title="Sau 18:00 khách chưa check-in">
                                                                    ⏰ Đến muộn (&gt;18h)
                                                                </span>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            </td>

                                            {/* CỘT 5: TỔNG TIỀN */}
                                            <td className="py-2.5 px-2.5 whitespace-nowrap">
                                                <div className="font-black text-xs sm:text-sm text-rose-600">
                                                    {Number(booking.grand_total_amount || totalAmountNum).toLocaleString('vi-VN')}
                                                    <span className="text-[10px] font-medium text-slate-400 ml-1">VND</span>
                                                </div>
                                                {booking.extra_services && booking.extra_services.length > 0 && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 mt-0.5 font-bold">
                                                        <span>🛎️ +{Number(booking.extra_services_total || 0).toLocaleString('vi-VN')}đ</span>
                                                    </span>
                                                )}
                                                {/* Phương thức & trạng thái thanh toán */}
                                                {(() => {
                                                    const isCancelled = ['cancelled', 'no_show'].includes(booking.status);
                                                    if (isCancelled) {
                                                        return (
                                                            <span className="text-[10px] text-rose-500 font-semibold block mt-0.5">
                                                                ✕ Đã hủy đơn
                                                            </span>
                                                        );
                                                    }
                                                    const isPaid = ['paid', 'PAID', 'completed', 'checked_out'].includes(booking.status) ||
                                                        booking.payment_status === 'COMPLETED' ||
                                                        booking.is_paid ||
                                                        (booking.note && (
                                                            booking.note.toLowerCase().includes('vietqr: đã thanh toán') ||
                                                            booking.note.toLowerCase().includes('đã thanh toán thành công')
                                                        ));

                                                    // Phân loại phương thức thanh toán thực tế
                                                    const rawMethod = (
                                                        booking.payment_method ||
                                                        (booking.payments && Array.isArray(booking.payments) && (
                                                            booking.payments.find(p => p.payment_status === 'COMPLETED')?.payment_method ||
                                                            booking.payments[0]?.payment_method
                                                        )) ||
                                                        booking.invoice?.payment_method ||
                                                        ''
                                                    );
                                                    const rawLower = String(rawMethod).trim().toLowerCase();
                                                    let isCash = ['cash', 'tiền mặt', 'tien_mat', 'reception', 'tai_quay', 'tại quầy', 'tại lễ tân'].includes(rawLower);
                                                    let isTransfer = ['transfer', 'vietqr', 'bank_transfer', 'chuyen_khoan', 'chuyển khoản', 'qr'].includes(rawLower);

                                                    const noteLower = (booking.note || '').toLowerCase();
                                                    if (!isCash && !isTransfer) {
                                                        if (noteLower.includes('vietqr') || noteLower.includes('chuyển khoản') || noteLower.includes('transfer')) {
                                                            isTransfer = true;
                                                        } else if (noteLower.includes('reception') || noteLower.includes('tiền mặt') || noteLower.includes('cash') || noteLower.includes('tại lễ tân') || noteLower.includes('tại quầy')) {
                                                            isCash = true;
                                                        } else if (['completed', 'checked_out'].includes(booking.status)) {
                                                            isCash = true;
                                                        }
                                                    }

                                                    if (isPaid) {
                                                        if (isCash) {
                                                            return (
                                                                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-1" title="Đã thanh toán bằng tiền mặt tại quầy">
                                                                    <span>✓</span> Tiền mặt (Đã TT)
                                                                </span>
                                                            );
                                                        }
                                                        if (isTransfer) {
                                                            return (
                                                                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-1" title="Đã thanh toán qua mã VietQR">
                                                                    <span>✓</span> VietQR (Đã TT)
                                                                </span>
                                                            );
                                                        }
                                                        return (
                                                            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mt-1" title="Đã thanh toán thành công">
                                                                <span>✓</span> Đã thanh toán
                                                            </span>
                                                        );
                                                    }
                                                    const rawPayment = booking.note && booking.note.includes('Thanh toán:')
                                                        ? booking.note.split('Thanh toán:')[1].trim().split('|')[0]
                                                        : (isCash ? 'Tại Lễ tân' : (isTransfer ? 'VietQR' : 'Tại Lễ tân'));
                                                    return (
                                                        <span className="text-[10px] text-slate-500 block mt-0.5 truncate max-w-[125px]">
                                                            💵 {rawPayment}
                                                        </span>
                                                    );
                                                })()}
                                            </td>

                                            {/* CỘT 6: TRẠNG THÁI (HIỂN THỊ CỐ ĐỊNH, KHÔNG CHO CHỈNH SỬA) */}
                                            <td className="py-2.5 px-2.5 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10.5px] font-bold border shadow-2xs select-none ${statusConfig.color}`}
                                                >
                                                    {statusConfig.label}
                                                </span>
                                                {isRowUpdating && (
                                                    <span className="text-[9px] text-blue-600 font-semibold block mt-0.5 animate-pulse">
                                                        Đang lưu...
                                                    </span>
                                                )}
                                            </td>

                                            {/* CỘT 7: HÀNH ĐỘNG (THIẾT KẾ GỌN GÀNG, KHÔNG PHÌNH CỘT) */}
                                            <td className="py-2.5 px-2 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1">
                                                    {/* Các nút thao tác nghiệp vụ: Chỉ dành cho Lễ tân, Quản lý, Owner, Admin */}
                                                    {canManageBookings && (
                                                        <>
                                                            {/* Nút Duyệt cho các đơn Chờ duyệt (Pending hoặc Đã TT QR) */}
                                                            {['pending', 'paid', 'PAID'].includes(booking.status) && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        disabled={isRowUpdating}
                                                                        onClick={() => handleQuickStatusChange(booking.id, 'confirmed')}
                                                                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-2xs transition inline-flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                                                                        title="Duyệt đơn đặt phòng (Chuyển sang Đã xác nhận)"
                                                                    >
                                                                        <span>✓</span>
                                                                        <span>Duyệt</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={isRowUpdating}
                                                                        onClick={() => setCancelConfirmBooking(booking)}
                                                                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-500 text-xs font-bold border border-slate-200 transition inline-flex items-center justify-center cursor-pointer active:scale-95 disabled:opacity-50"
                                                                        title="Từ chối / Hủy đơn đặt phòng này"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </>
                                                            )}

                                                            {/* Nút hành động chính theo trạng thái */}
                                                            {booking.status === 'confirmed' && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenCheckInModal(booking)}
                                                                        className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition inline-flex items-center gap-1 cursor-pointer active:scale-95"
                                                                        title="Thực hiện gán phòng và Check-in cho khách"
                                                                    >
                                                                        <span>🔑</span>
                                                                        <span>Check-in</span>
                                                                    </button>
                                                                    {isCheckInDateReached(booking.check_in_date) ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setNoShowModalBooking(booking)}
                                                                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-500 text-xs font-bold border border-slate-200 transition inline-flex items-center justify-center cursor-pointer active:scale-95"
                                                                            title="Đánh dấu Khách không đến (No-show)"
                                                                        >
                                                                            🚫
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            disabled
                                                                            className="w-7 h-7 rounded-lg bg-slate-50 text-slate-300 text-xs font-bold border border-slate-200/60 cursor-not-allowed opacity-50 inline-flex items-center justify-center"
                                                                            title={`Chưa tới ngày nhận phòng (${formatDateDisplay(booking.check_in_date)}). Không thể đánh dấu No-show. Nếu khách báo hủy trước, vui lòng chọn Hủy đơn.`}
                                                                        >
                                                                            🚫
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                            {booking.status === 'checked_in' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setCheckOutModalBooking(booking)}
                                                                    className="px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-[11px] shadow-2xs transition inline-flex items-center gap-1 cursor-pointer active:scale-95"
                                                                    title="Thực hiện thanh toán và Check-out trả phòng"
                                                                >
                                                                    <span>🧾</span>
                                                                    <span>Check-out</span>
                                                                </button>
                                                            )}
                                                        </>
                                                    )}

                                                    {/* Nút Xem chi tiết đơn (Mọi vai trò đều được xem) */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenDetailModal(booking)}
                                                        className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 transition inline-flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
                                                        title="Xem toàn bộ thông tin chi tiết đơn này"
                                                    >
                                                        👁️
                                                    </button>

                                                    {/* Nút In hóa đơn */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setInvoiceModalBooking(booking)}
                                                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-700 border border-slate-200 transition inline-flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
                                                        title="In hóa đơn đặt phòng (Chuẩn A4)"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                                        </svg>
                                                    </button>

                                                    {/* Nút Nhắc khách */}
                                                    {canManageBookings && ['pending', 'paid', 'PAID', 'confirmed', 'checked_in'].includes(booking.status) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSendReminderForBooking(booking.id)}
                                                            disabled={remindingBookingId === booking.id}
                                                            className="w-7 h-7 rounded-lg bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-800 border border-amber-200 transition inline-flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
                                                            title="Gửi thông báo nhắc nhở đến khách hàng này"
                                                        >
                                                            {remindingBookingId === booking.id ? '⏳' : '🔔'}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>

                {/* FOOTER BẢNG: PHÂN TRANG */}
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalCount={filteredBookings.length}
                    pageSize={pageSize}
                    onPageChange={(page) => setCurrentPage(page)}
                />
            </div>

            {/* ========================================================================= */}
            {/* MODAL CHI TIẾT ĐƠN ĐẶT PHÒNG TOÀN DIỆN */}
            {/* ========================================================================= */}
            {selectedBooking && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full p-6 sm:p-8 shadow-2xl text-left max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                        {/* Header Modal */}
                        <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-5">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-lg font-black text-blue-600 tracking-wider">
                                        #{selectedBooking.booking_code}
                                    </span>
                                    <span className="text-xs text-slate-400">•</span>
                                    <span className="text-xs text-slate-500">
                                        Tạo ngày {formatDateTimeDisplay(selectedBooking.created_at)}
                                    </span>
                                </div>
                                <h3 className="font-serif text-xl font-bold text-slate-900 mt-0.5">
                                    Chi Tiết Đơn Đặt Phòng
                                </h3>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedBooking(null)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center font-bold text-sm cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Thân Modal: Các nhóm thông tin */}
                        <div className="space-y-5 text-xs">
                            {/* KHỐI 1: TRẠNG THÁI HIỆN TẠI & THAO TÁC ĐỔI */}
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                        Trạng thái đơn hàng
                                    </span>
                                    <div className="font-bold text-slate-800 text-sm mt-0.5">
                                        {STATUS_OPTIONS.find((s) => s.value === selectedBooking.status)?.label ||
                                            selectedBooking.status}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-semibold text-slate-600">Đổi trạng thái:</label>
                                    {['completed', 'checked_out', 'cancelled', 'no_show'].includes(selectedBooking.status?.toLowerCase()) ? (
                                        <span className="px-3 py-1 bg-slate-100 text-slate-500 font-semibold rounded-xl text-xs border border-slate-200" title="Đơn đã đóng sổ (Check-out hoặc Hủy), không thể thay đổi trạng thái">
                                            🔒 Đã khóa sổ (Không thể đổi trạng thái)
                                        </span>
                                    ) : canManageBookings ? (
                                        <select
                                            value={selectedBooking.status}
                                            disabled={updatingId === selectedBooking.id}
                                            onChange={(e) =>
                                                handleQuickStatusChange(selectedBooking.id, e.target.value)
                                            }
                                            className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 cursor-pointer"
                                        >
                                            {STATUS_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className="px-3 py-1 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200">
                                            Chỉ xem (Không có quyền sửa)
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* KHỐI 2: THÔNG TIN KHÁCH HÀNG & PHÁP LÝ CCCD */}
                            <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
                                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                                    <span>👤</span>
                                    <span>Thông tin Khách hàng & Pháp lý</span>
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Họ và tên:</span>
                                        <strong className="text-slate-900 text-sm">{selectedBooking.guest_name}</strong>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Số CCCD / Hộ chiếu (Passport):</span>
                                        <strong className="font-mono text-sm text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block mt-0.5">
                                            🪪 {selectedBooking.identity_card || 'Chưa cung cấp'}
                                        </strong>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Số điện thoại:</span>
                                        <strong className="text-slate-900">
                                            {selectedBooking.guest_phone || 'Chưa cung cấp'}
                                        </strong>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Địa chỉ Email:</span>
                                        <strong className="text-slate-900">
                                            {selectedBooking.guest_email || 'Chưa cung cấp'}
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            {/* KHỐI 3: THÔNG TIN PHÒNG VÀ LƯU TRÚ */}
                            <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
                                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                                    <span>🏨</span>
                                    <span>Chi tiết Phòng & Lịch Trình</span>
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Hạng phòng:</span>
                                        <strong className="text-slate-900 text-sm">{selectedBooking.room_name}</strong>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Số phòng thực tế:</span>
                                        <strong className="text-slate-900 text-sm">
                                            {selectedBooking.room_number ? `Phòng ${selectedBooking.room_number}` : 'Chưa xếp phòng'}
                                        </strong>
                                    </div>
                                    {selectedBooking.actual_check_in && (
                                        <div className="col-span-1 sm:col-span-2">
                                            <span className="text-emerald-700 block text-[11px] font-semibold">Thời gian Check-in thực tế:</span>
                                            <strong className="text-emerald-800 text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                                                🔑 {formatDateTimeDisplay(selectedBooking.actual_check_in)}
                                            </strong>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Ngày Check-in:</span>
                                        <strong className="text-slate-900">
                                            {formatDateDisplay(selectedBooking.check_in_date)} (từ 14:00)
                                        </strong>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Ngày Check-out:</span>
                                        <strong className="text-slate-900">
                                            {formatDateDisplay(selectedBooking.check_out_date)} (trước 12:00)
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            {/* KHỐI 3.1: GIA HẠN LƯU TRÚ (EXTEND STAY) CHO ĐƠN ĐANG Ở (checked_in) */}
                            {canManageBookings && selectedBooking.status === 'checked_in' && (
                                <div className="p-4 rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-white space-y-3.5 shadow-2xs">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <h4 className="font-bold text-blue-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                            <span>🗓️</span>
                                            <span>Gia Hạn Lưu Trú (Extend Stay)</span>
                                        </h4>
                                        <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/70 px-2.5 py-0.5 rounded-full border border-blue-200">
                                            {selectedBooking.room_number ? `Đang ở Phòng ${selectedBooking.room_number}` : 'Đang lưu trú'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                                        <div>
                                            <label className="text-slate-500 block text-[11px] font-semibold mb-1">
                                                Ngày Check-out hiện tại:
                                            </label>
                                            <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                                                {formatDateDisplay(selectedBooking.check_out_date)}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-blue-950 block text-[11px] font-bold mb-1">
                                                Chọn ngày Check-out mới: <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                min={adminExtendMinDate}
                                                value={adminExtendNewDate}
                                                onChange={(e) => {
                                                    setAdminExtendNewDate(e.target.value);
                                                    setAdminExtendConflictError(null);
                                                }}
                                                className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-600/30 shadow-2xs cursor-pointer"
                                            />
                                        </div>

                                        <div>
                                            <button
                                                type="button"
                                                onClick={handleAdminExtendStay}
                                                disabled={isSubmittingAdminExtend || !adminExtendCalc.isValid}
                                                className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/25 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                            >
                                                {isSubmittingAdminExtend ? (
                                                    <>
                                                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                                        <span>Đang kiểm tra...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>✨</span>
                                                        <span>Xác nhận Gia hạn</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Xem trước chi phí phát sinh */}
                                    {adminExtendCalc.isValid && (
                                        <div className="p-3 bg-white/90 border border-blue-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 shadow-2xs">
                                            <div className="flex items-center gap-4 flex-wrap">
                                                <div>
                                                    <span className="text-slate-400 block text-[10px]">Số đêm thêm:</span>
                                                    <strong className="text-blue-700 font-bold">+{adminExtendCalc.extraNights} đêm</strong>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 block text-[10px]">Đơn giá phòng:</span>
                                                    <strong className="text-slate-800 font-mono">{adminExtendCalc.nightlyRate.toLocaleString('vi-VN')} đ/đêm</strong>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 block text-[10px]">Phát sinh thêm:</span>
                                                    <strong className="text-amber-600 font-black font-mono">+{adminExtendCalc.extraAmount.toLocaleString('vi-VN')} đ</strong>
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">Tổng tiền phòng mới:</span>
                                                <strong className="text-emerald-700 font-black font-mono text-sm">
                                                    {(Number(selectedBooking.total_amount) + adminExtendCalc.extraAmount).toLocaleString('vi-VN')} đ
                                                </strong>
                                            </div>
                                        </div>
                                    )}

                                    {/* Cảnh báo xung đột nếu phòng bị kẹt lịch */}
                                    {adminExtendConflictError && (
                                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2 animate-in fade-in">
                                            <span className="text-base">⚠️</span>
                                            <div>
                                                <strong className="font-bold block">Không thể gia hạn (Phòng bị kẹt lịch):</strong>
                                                <span className="text-[11px] leading-relaxed mt-0.5 block">{adminExtendConflictError}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* KHỐI 3.5: DỊCH VỤ PHÁT SINH TẠI PHÒNG (IN-ROOM SERVICES) */}
                            <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-purple-600 flex items-center gap-1.5">
                                            <span>🛎️</span>
                                            <span>Dịch Vụ Phát Sinh & Gọi Món Tại Phòng</span>
                                        </h4>
                                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                            {selectedBooking.extra_services?.length || 0} dịch vụ
                                        </span>
                                    </div>

                                    {/* Nút Thêm Dịch Vụ Cho Khách (Quy tắc: CHỈ hiển thị khi khách đang lưu trú - in-house / checked_in) */}
                                    {(canManageBookings || currentUserRole === 'service_staff') && 
                                     (selectedBooking.status === 'checked_in' || selectedBooking.status === 'IN_HOUSE') && (
                                        <button
                                            type="button"
                                            onClick={openAddServiceModal}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-sm hover:shadow-md transition cursor-pointer active:scale-95"
                                            title="Thêm dịch vụ khách sạn hoặc phụ thu cho khách đang lưu trú tại phòng"
                                        >
                                            <span className="text-sm leading-none font-black">+</span>
                                            <span>Thêm dịch vụ</span>
                                        </button>
                                    )}
                                </div>

                                {/* Yêu cầu dịch vụ đang chuẩn bị / chờ phục vụ (nếu có) */}
                                {selectedBooking.pending_services && selectedBooking.pending_services.length > 0 && (
                                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-amber-900 flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                                <span>Đang chuẩn bị / Chờ phục vụ ({selectedBooking.pending_services.length} yêu cầu):</span>
                                            </span>
                                            <span className="text-[10px] text-amber-700 font-medium">Chưa tính vào hóa đơn</span>
                                        </div>
                                        <div className="divide-y divide-amber-200/60">
                                            {selectedBooking.pending_services.map((req, idx) => (
                                                <div key={req.id || idx} className="py-2 flex items-center justify-between gap-3 text-xs">
                                                    <div>
                                                        <div className="font-semibold text-slate-800">
                                                            {req.service_name} <span className="text-amber-700 font-bold">(x{req.quantity})</span>
                                                        </div>
                                                        {req.note && (
                                                            <div className="text-[11px] text-slate-500 italic mt-0.5">
                                                                Ghi chú: {req.note}
                                                            </div>
                                                        )}
                                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                                            Trạng thái: <span className="font-semibold text-amber-700">{req.status_display || 'Chờ xử lý'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="font-bold text-slate-700">
                                                            {Number(req.total_price || (req.price * req.quantity)).toLocaleString('vi-VN')} VND
                                                        </span>
                                                        {(canManageBookings || currentUserRole === 'service_staff') && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleQuickCompleteService(req.raw_id, req.service_name)}
                                                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition cursor-pointer active:scale-95"
                                                                    title="Xác nhận đã phục vụ xong và chuyển vào hóa đơn thanh toán"
                                                                >
                                                                    <span>✓</span>
                                                                    <span>Đã giao</span>
                                                                </button>
                                                                {/* Ẩn thùng rác khi đơn đã bị khóa sổ hoặc không còn in-house */}
                                                                {(selectedBooking.status === 'checked_in' || selectedBooking.status === 'IN_HOUSE') && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveExtraService(req.id, req.service_name)}
                                                                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                                                        title="Hủy yêu cầu này"
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Danh sách dịch vụ đã hoàn thành & tính vào hóa đơn */}
                                {selectedBooking.extra_services && selectedBooking.extra_services.length > 0 ? (
                                    <div className="space-y-2">
                                        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                                            {selectedBooking.extra_services.map((item, idx) => {
                                                const cleanName = (item.service_name || '')
                                                    .replace(/\[Yêu cầu #\d+\]/gi, '')
                                                    .replace(/\(x\d+\)/gi, '')
                                                    .trim();
                                                return (
                                                    <div key={item.id || idx} className="p-2.5 bg-slate-50/60 flex items-center justify-between text-xs hover:bg-slate-100/60 transition group">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[10px]">
                                                                {idx + 1}
                                                            </span>
                                                            <div>
                                                                <strong className="text-slate-900 font-semibold block text-xs">
                                                                    {cleanName}
                                                                </strong>
                                                                <span className="text-[10px] text-slate-400">
                                                                    {item.quantity} x {Number(item.price || 0).toLocaleString('vi-VN')} VND
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-900">
                                                                {Number(item.total_price || (item.price * item.quantity)).toLocaleString('vi-VN')} VND
                                                            </span>
                                                            {/* Quy tắc: Chỉ hiển thị nút xóa (thùng rác) khi khách ĐANG LƯU TRÚ (in-house), ẩn hoàn toàn khi đơn đã khóa sổ (Check-out/Hủy/Hoàn tất) */}
                                                            {(canManageBookings || currentUserRole === 'service_staff') && 
                                                             (selectedBooking.status === 'checked_in' || selectedBooking.status === 'IN_HOUSE') && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveExtraService(item.id, cleanName)}
                                                                    className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                                                    title="Xóa phụ phí này khỏi đơn đặt phòng"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex items-center justify-between pt-1 text-xs">
                                            <span className="text-slate-500 font-medium">Tổng tiền dịch vụ phát sinh:</span>
                                            <strong className="text-purple-700 font-bold">
                                                +{Number(selectedBooking.extra_services_total || 0).toLocaleString('vi-VN')} VND
                                            </strong>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400 text-xs">
                                        <p>Chưa có phụ phí phát sinh nào được ghi nhận cho phòng này.</p>
                                        {(canManageBookings || currentUserRole === 'service_staff') && 
                                         (selectedBooking.status === 'checked_in' || selectedBooking.status === 'IN_HOUSE') && (
                                            <button
                                                type="button"
                                                onClick={openAddServiceModal}
                                                className="inline-block mt-1.5 text-purple-600 hover:text-purple-800 font-semibold cursor-pointer underline text-[11px]"
                                            >
                                                + Bấm vào đây để thêm dịch vụ hoặc món ăn
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* KHỐI 4: TÀI CHÍNH & THANH TOÁN (CHI TIẾT ĐỦ TIỀN PHÒNG + DỊCH VỤ) */}
                            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                                <div className="flex items-center justify-between text-xs text-slate-600">
                                    <span>Tiền phòng nghỉ ({selectedBooking.nights || 1} đêm):</span>
                                    <span className="font-semibold text-slate-800">
                                        {Number(selectedBooking.room_amount || selectedBooking.total_amount).toLocaleString('vi-VN')} VND
                                    </span>
                                </div>
                                {Number(selectedBooking.extra_services_total || 0) > 0 && (
                                    <div className="flex items-center justify-between text-xs text-purple-700 font-medium">
                                        <span>Phụ phí dịch vụ tại phòng ({selectedBooking.extra_services?.length || 0} món):</span>
                                        <span className="font-bold">
                                            +{Number(selectedBooking.extra_services_total).toLocaleString('vi-VN')} VND
                                        </span>
                                    </div>
                                )}
                                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                                            Tổng thanh toán thực tế (Grand Total)
                                        </span>
                                        <span className="text-[10px] text-slate-400 block">
                                            (Bao gồm tiền phòng + toàn bộ dịch vụ phát sinh & thuế phí)
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-black text-2xl text-rose-600">
                                            {Number(selectedBooking.grand_total_amount || selectedBooking.total_amount).toLocaleString('vi-VN')}
                                        </span>
                                        <span className="text-xs font-bold text-slate-500 ml-1">VND</span>
                                    </div>
                                </div>
                            </div>

                            {/* KHỐI 5: GHI CHÚ KHÁCH HÀNG & GHI CHÚ NỘI BỘ LỄ TÂN */}
                            <div className="space-y-3">
                                {selectedBooking.note && (
                                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                                        <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
                                            💬 Ghi chú của khách hàng:
                                        </span>
                                        <p className="text-xs text-amber-900 whitespace-pre-line">
                                            {selectedBooking.note}
                                        </p>
                                    </div>
                                )}

                                {/* Ghi chú nội bộ dành riêng cho Lễ tân */}
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                            📝 Ghi chú nội bộ Lễ tân:
                                        </label>
                                        <span className="text-[10px] text-slate-400">
                                            Chỉ nhân viên nội bộ mới xem được
                                        </span>
                                    </div>
                                    <textarea
                                        rows={2}
                                        placeholder="Nhập ghi chú (VD: Khách yêu cầu kê giường phụ, đã nhận cọc 500k...)"
                                        value={internalNoteInput}
                                        onChange={(e) => setInternalNoteInput(e.target.value)}
                                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                                    />
                                    {canManageBookings && (
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                disabled={isSavingInternalNote}
                                                onClick={handleSaveInternalNote}
                                                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-xs"
                                            >
                                                {isSavingInternalNote ? 'Đang lưu...' : 'Lưu ghi chú nội bộ'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Nút hành động Modal */}
                        {canManageBookings && ['pending', 'paid', 'PAID', 'confirmed', 'checked_in'].includes(selectedBooking.status) && (
                            <div className="pt-5 mt-6 border-t border-slate-100 flex items-center justify-center gap-2.5 flex-wrap">
                                {selectedBooking.status === 'confirmed' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleOpenCheckInModal(selectedBooking);
                                            }}
                                            className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                                        >
                                            <span>🔑</span>
                                            <span>Check-in</span>
                                        </button>
                                        {isCheckInDateReached(selectedBooking.check_in_date) ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNoShowModalBooking(selectedBooking);
                                                }}
                                                className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                                            >
                                                <span>🚫</span>
                                                <span>No-show</span>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled
                                                className="px-3.5 py-1.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl shadow-xs cursor-not-allowed inline-flex items-center gap-1.5 opacity-60 border border-slate-200"
                                                title={`Chưa tới ngày nhận phòng (${formatDateDisplay(selectedBooking.check_in_date)}). Không thể đánh dấu No-show.`}
                                            >
                                                <span>🚫</span>
                                                <span>No-show (Chưa tới ngày)</span>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            disabled={updatingId === selectedBooking.id}
                                            onClick={() => setCancelConfirmBooking(selectedBooking)}
                                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                            title="Hủy đơn đặt phòng này"
                                        >
                                            <span>✕</span>
                                            <span>Hủy đơn</span>
                                        </button>
                                    </>
                                )}

                                {['pending', 'paid', 'PAID'].includes(selectedBooking.status) && (
                                    <>
                                        <button
                                            type="button"
                                            disabled={updatingId === selectedBooking.id}
                                            onClick={() => handleQuickStatusChange(selectedBooking.id, 'confirmed')}
                                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                        >
                                            <span>✓</span>
                                            <span>Duyệt đơn</span>
                                        </button>
                                        <button
                                            type="button"
                                            disabled={updatingId === selectedBooking.id}
                                            onClick={() => setCancelConfirmBooking(selectedBooking)}
                                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                            title="Hủy đơn đặt phòng này"
                                        >
                                            <span>✕</span>
                                            <span>Hủy đơn</span>
                                        </button>
                                    </>
                                )}

                                {selectedBooking.status === 'checked_in' && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const b = selectedBooking;
                                            setSelectedBooking(null);
                                            setCheckOutModalBooking(b);
                                        }}
                                        className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                                    >
                                        <span>🧾</span>
                                        <span>Check-out trả phòng</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL CHECK-IN (THỦ TỤC NHẬN PHÒNG & GÁN PHÒNG THỰC TẾ) */}
            {/* ========================================================================= */}
            {checkInModalBooking && (
                <CheckInModal
                    booking={checkInModalBooking}
                    isOpen={Boolean(checkInModalBooking)}
                    onClose={() => setCheckInModalBooking(null)}
                    onSuccess={(updatedBooking, assignedRoom) => {
                        const roomNum = assignedRoom?.room_number || checkInModalBooking.room_number;
                        showToast(
                            'success',
                            `🔑 Check-in thành công cho khách "${checkInModalBooking.guest_name}" vào phòng ${roomNum || ''}!`
                        );
                        setBookings((prev) =>
                            prev.map((b) =>
                                b.id === checkInModalBooking.id
                                    ? {
                                        ...b,
                                        ...(updatedBooking || {}),
                                        status: 'checked_in',
                                        room_number: roomNum || b.room_number,
                                        actual_check_in: updatedBooking?.actual_check_in || new Date().toISOString()
                                    }
                                    : b
                            )
                        );
                        if (quickFilterMode === 'check-in-today') {
                            fetchBookings(true, 'check-in-today');
                        } else {
                            fetchBookings(true);
                        }
                        try {
                            localStorage.setItem('pms_last_booking_event', Date.now().toString());
                            window.dispatchEvent(new CustomEvent('pms_booking_created'));
                        } catch (e) { }
                        if (typeof onBookingChanged === 'function') {
                            onBookingChanged();
                        }
                        setCheckInModalBooking(null);
                    }}
                />
            )}

            {/* ========================================================================= */}
            {/* MODAL XUẤT DANH SÁCH KHAI BÁO LƯU TRÚ (CHO CÔNG AN PHƯỜNG)                */}
            {/* ========================================================================= */}
            <StayingGuestsModal
                isOpen={isStayingGuestsModalOpen}
                onClose={() => setIsStayingGuestsModalOpen(false)}
            />

            {/* ========================================================================= */}
            {/* MODAL KHÁCH VÃNG LAI (WALK-IN GUEST - ĐẶT & NHẬN PHÒNG ĐỒNG THỜI TẠI QUẦY) */}
            {/* ========================================================================= */}
            {isWalkInModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full p-6 sm:p-8 shadow-2xl text-left max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                        {/* Header Modal */}
                        <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-indigo-600/25">
                                    {bookingTab === 'walk_in' ? '🚶‍♂️' : '📞'}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200 uppercase tracking-wider">
                                            Tiếp Đón Tại Quầy (Front Desk)
                                        </span>
                                        <span className="text-xs text-slate-300">•</span>
                                        <span className="text-xs text-slate-500 font-medium">
                                            {bookingTab === 'walk_in' ? 'Check-in tức thì hôm nay' : 'Đặt giữ chỗ trước (Check-in ngày khác)'}
                                        </span>
                                    </div>
                                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                                        {bookingTab === 'walk_in' ? 'Khách Vãng Lai (Walk-in Guest)' : 'Đặt Phòng Trước (Phone / Advance Reservation)'}
                                    </h3>
                                </div>
                            </div>

                            <button
                                type="button"
                                disabled={isSubmittingWalkIn}
                                onClick={() => setIsWalkInModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center font-bold text-sm cursor-pointer disabled:opacity-50"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Thanh chuyển đổi 2 Tab Nghiệp Vụ */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-slate-100/90 rounded-2xl mb-6">
                            <button
                                type="button"
                                onClick={() => {
                                    setBookingTab('walk_in');
                                    const todayStr = new Date().toISOString().split('T')[0];
                                    setWalkInForm((prev) => ({ ...prev, check_in_date: todayStr }));
                                }}
                                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2.5 cursor-pointer ${bookingTab === 'walk_in'
                                    ? 'bg-white text-blue-700 shadow-md border border-slate-200/80 scale-[1.01]'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                    }`}
                            >
                                <span className="text-base">🚶‍♂️</span>
                                <div className="text-left">
                                    <div className="font-bold">1. Khách Vãng Lai (Walk-in)</div>
                                    <div className="text-[10px] font-normal opacity-75">Khách tới quầy & Nhận phòng ngay hôm nay</div>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setBookingTab('advance')}
                                className={`py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2.5 cursor-pointer ${bookingTab === 'advance'
                                    ? 'bg-white text-indigo-700 shadow-md border border-slate-200/80 scale-[1.01]'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                    }`}
                            >
                                <span className="text-base">📞</span>
                                <div className="text-left">
                                    <div className="font-bold">2. Đặt Trước Qua Điện Thoại / Zalo</div>
                                    <div className="text-[10px] font-normal opacity-75">Đặt giữ chỗ ngày khác, tới check-in sau</div>
                                </div>
                            </button>
                        </div>

                        {/* Thân Form 2 Cột chuẩn nghiệp vụ */}
                        <form onSubmit={handleConfirmWalkIn} className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* ==================== CỘT 1: THÔNG TIN KHÁCH HÀNG ==================== */}
                                <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-4">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                                        <h4 className="font-bold text-xs uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                                            <span>👤</span>
                                            <span>1. Thông tin Khách lưu trú</span>
                                        </h4>
                                        <span className="text-[10px] text-rose-500 font-semibold">* Bắt buộc</span>
                                    </div>

                                    {/* 1.1 Tên khách hàng */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Họ và tên khách hàng <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="VD: Nguyễn Văn An"
                                            value={walkInForm.guest_name}
                                            onChange={(e) =>
                                                setWalkInForm((prev) => ({ ...prev, guest_name: e.target.value }))
                                            }
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                        />
                                    </div>

                                    {/* 1.2 Số điện thoại */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Số điện thoại di động <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            required
                                            placeholder="VD: 0912345678"
                                            value={walkInForm.guest_phone}
                                            onChange={(e) =>
                                                setWalkInForm((prev) => ({ ...prev, guest_phone: e.target.value }))
                                            }
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                        />
                                        <span className="text-[10px] text-slate-400 mt-1 block">
                                            Hệ thống tự động tra cứu hoặc tạo hồ sơ thành viên mới theo SĐT này.
                                        </span>
                                    </div>

                                    {/* 1.3 Số CCCD / Hộ chiếu */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Số CCCD / Hộ chiếu (Passport) <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                required
                                                placeholder="VD: 048099001234"
                                                value={walkInForm.identity_card}
                                                onChange={(e) =>
                                                    setWalkInForm((prev) => ({ ...prev, identity_card: e.target.value }))
                                                }
                                                className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                            />
                                            <span className="absolute left-3 top-2.5 text-xs text-slate-400">🪪</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 mt-1 block">
                                            Quy định pháp lý bắt buộc khi lưu trú (Độ dài từ 8 - 20 ký tự).
                                        </span>
                                    </div>

                                    {/* 1.4 Email (Không bắt buộc) */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Địa chỉ Email <span className="text-slate-400 font-normal">(Nếu có)</span>
                                        </label>
                                        <input
                                            type="email"
                                            placeholder="VD: khachhang@gmail.com"
                                            value={walkInForm.guest_email}
                                            onChange={(e) =>
                                                setWalkInForm((prev) => ({ ...prev, guest_email: e.target.value }))
                                            }
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                        />
                                    </div>

                                    {/* 1.5 Ghi chú của khách */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Yêu cầu của khách <span className="text-slate-400 font-normal">(Ghi chú)</span>
                                        </label>
                                        <textarea
                                            rows={2}
                                            placeholder="VD: Khách yêu cầu tầng cao, thanh toán tiền mặt, lấy hóa đơn VAT..."
                                            value={walkInForm.note}
                                            onChange={(e) =>
                                                setWalkInForm((prev) => ({ ...prev, note: e.target.value }))
                                            }
                                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                        />
                                    </div>
                                </div>

                                {/* ==================== CỘT 2: THÔNG TIN PHÒNG & THỜI GIAN THEO TAB ==================== */}
                                {bookingTab === 'walk_in' ? (
                                    /* TAB 1: WALK-IN (NHẬN PHÒNG NGAY HÔM NAY) */
                                    <div className="p-5 rounded-2xl bg-emerald-50/30 border border-emerald-200/80 space-y-4">
                                        <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
                                            <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                                                <span>🏨</span>
                                                <span>2. Chọn Phòng Thực Tế & Thời Gian</span>
                                            </h4>
                                            <span className="text-[11px] font-bold text-emerald-700">
                                                {walkInAvailableRooms.length} phòng sẵn sàng
                                            </span>
                                        </div>

                                        {/* 2.1 Khung Ngày Check-in & Check-out */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                                    Ngày Check-in <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    disabled
                                                    value={walkInForm.check_in_date}
                                                    className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 cursor-not-allowed"
                                                    title="Khách Walk-in mặc định nhận phòng ngay hôm nay"
                                                />
                                                <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">
                                                    🕒 Hôm nay (Nhận phòng ngay)
                                                </span>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                                    Ngày Check-out <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    required
                                                    min={walkInForm.check_in_date}
                                                    value={walkInForm.check_out_date}
                                                    onChange={(e) =>
                                                        setWalkInForm((prev) => ({
                                                            ...prev,
                                                            check_out_date: e.target.value
                                                        }))
                                                    }
                                                    className="w-full px-3 py-2 bg-white border border-emerald-300 focus:border-emerald-600 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition cursor-pointer"
                                                />
                                                <span className="text-[10px] text-slate-500 mt-1 block">
                                                    Trước 12:00 trưa
                                                </span>
                                            </div>
                                        </div>

                                        {/* 2.2 Dropdown Chọn Phòng Thực Tế */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-xs font-bold text-slate-900">
                                                    Chọn phòng thực tế đón khách <span className="text-rose-500">*</span>
                                                </label>
                                                <span className="text-[10px] text-slate-400">
                                                    Liệt kê tất cả phòng trống
                                                </span>
                                            </div>

                                            {isLoadingWalkInRooms ? (
                                                <div className="p-3 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
                                                    <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                                                    Đang tải danh sách phòng khả dụng...
                                                </div>
                                            ) : walkInAvailableRooms.length === 0 ? (
                                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
                                                    ⚠️ Hiện tại khách sạn không còn phòng trống nào ở trạng thái "Sẵn sàng" (Available)!
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <select
                                                        id="walk-in-room-select"
                                                        value={walkInForm.room_id}
                                                        onChange={(e) =>
                                                            setWalkInForm((prev) => ({ ...prev, room_id: e.target.value }))
                                                        }
                                                        className="w-full px-4 py-3 bg-white border-2 border-emerald-400 focus:border-emerald-600 rounded-xl text-xs font-bold text-slate-900 shadow-xs focus:outline-none focus:ring-4 focus:ring-emerald-500/20 transition cursor-pointer appearance-none"
                                                    >
                                                        {walkInAvailableRooms.map((r) => {
                                                            const price =
                                                                Number(r.category?.promo_price) ||
                                                                Number(r.category_base_price) ||
                                                                Number(r.category?.base_price) ||
                                                                0;
                                                            return (
                                                                <option key={r.id} value={r.id}>
                                                                    Phòng {r.room_number} — Tầng {r.floor} • {r.category_name || r.category?.name} ({price.toLocaleString('vi-VN')} VND/đêm)
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-emerald-700 font-bold">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* 2.3 Thẻ tóm tắt phòng được chọn & Tính toán tiền */}
                                        {(() => {
                                            const selectedRoom = walkInAvailableRooms.find(
                                                (r) => String(r.id) === String(walkInForm.room_id)
                                            );
                                            const nights = Math.max(
                                                1,
                                                Math.round(
                                                    (new Date(walkInForm.check_out_date) - new Date(walkInForm.check_in_date)) /
                                                    (1000 * 60 * 60 * 24)
                                                ) || 1
                                            );
                                            const pricePerNight = selectedRoom
                                                ? Number(selectedRoom.category?.promo_price) ||
                                                Number(selectedRoom.category_base_price) ||
                                                Number(selectedRoom.category?.base_price) ||
                                                0
                                                : 0;
                                            const totalAmount = pricePerNight * nights;

                                            return (
                                                <div className="space-y-3 pt-1">
                                                    {selectedRoom && (
                                                        <div className="p-3 bg-white rounded-xl border border-emerald-200 flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center">
                                                                    {selectedRoom.room_number}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-slate-900 text-xs">
                                                                        Phòng {selectedRoom.room_number} — Tầng {selectedRoom.floor}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500">
                                                                        {selectedRoom.category_name || selectedRoom.category?.name} • {selectedRoom.category_bed_type || '1 Giường King'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                                                                🟢 Sẵn sàng
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-blue-950 text-white shadow-md space-y-2">
                                                        <div className="flex items-center justify-between text-xs text-slate-300">
                                                            <span>Đơn giá phòng:</span>
                                                            <span className="font-mono font-bold text-white">
                                                                {pricePerNight.toLocaleString('vi-VN')} VND / đêm
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-xs text-slate-300">
                                                            <span>Thời gian lưu trú:</span>
                                                            <span className="font-bold text-emerald-400">
                                                                🌙 {nights} đêm lưu trú
                                                            </span>
                                                        </div>
                                                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                                                Tổng tiền dự kiến:
                                                            </span>
                                                            <div className="text-right">
                                                                <span className="font-black text-xl text-rose-400">
                                                                    {totalAmount.toLocaleString('vi-VN')}
                                                                </span>
                                                                <span className="text-xs text-slate-300 ml-1">VND</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* 2.4 Ghi chú nội bộ Lễ tân (Thẻ từ / Cọc) */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                                Ghi chú nội bộ bàn giao thẻ từ
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="VD: Đã giao 2 thẻ từ phòng, đã thu cọc tiền mặt 500k..."
                                                value={walkInForm.internal_note}
                                                onChange={(e) =>
                                                    setWalkInForm((prev) => ({
                                                        ...prev,
                                                        internal_note: e.target.value
                                                    }))
                                                }
                                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    /* TAB 2: ĐẶT PHÒNG TRƯỚC (NHẬN PHÒNG NGÀY KHÁC TRONG TƯƠNG LAI) */
                                    <div className="p-5 rounded-2xl bg-indigo-50/30 border border-indigo-200/80 space-y-4">
                                        <div className="flex items-center justify-between pb-2 border-b border-indigo-200/60">
                                            <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                                                <span>📅</span>
                                                <span>2. Chọn Hạng Phòng & Ngày Đặt Giữ Chỗ</span>
                                            </h4>
                                            <span className="text-[11px] font-bold text-indigo-700">
                                                {advanceCategories.length} hạng phòng
                                            </span>
                                        </div>

                                        {/* 2.1 Chọn Ngày Check-in & Check-out tự do trong tương lai */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                                    Ngày Check-in <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    required
                                                    min={new Date().toISOString().split('T')[0]}
                                                    value={walkInForm.check_in_date}
                                                    onChange={(e) => {
                                                        const inDate = e.target.value;
                                                        setWalkInForm((prev) => {
                                                            let outDate = prev.check_out_date;
                                                            if (outDate <= inDate) {
                                                                const d = new Date(inDate);
                                                                d.setDate(d.getDate() + 1);
                                                                outDate = d.toISOString().split('T')[0];
                                                            }
                                                            return { ...prev, check_in_date: inDate, check_out_date: outDate };
                                                        });
                                                    }}
                                                    className="w-full px-3 py-2 bg-white border border-indigo-300 focus:border-indigo-600 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition cursor-pointer"
                                                />
                                                <span className="text-[10px] text-indigo-600 font-semibold mt-1 block">
                                                    🗓️ Ngày khách hẹn tới nhận phòng
                                                </span>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                                    Ngày Check-out <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    required
                                                    min={walkInForm.check_in_date || new Date().toISOString().split('T')[0]}
                                                    value={walkInForm.check_out_date}
                                                    onChange={(e) =>
                                                        setWalkInForm((prev) => ({
                                                            ...prev,
                                                            check_out_date: e.target.value
                                                        }))
                                                    }
                                                    className="w-full px-3 py-2 bg-white border border-indigo-300 focus:border-indigo-600 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition cursor-pointer"
                                                />
                                                <span className="text-[10px] text-slate-500 mt-1 block">
                                                    Trước 12:00 trưa
                                                </span>
                                            </div>
                                        </div>

                                        {/* 2.2 Dropdown Chọn Hạng Phòng Đặt Trước */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-xs font-bold text-slate-900">
                                                    Chọn Hạng phòng giữ chỗ <span className="text-rose-500">*</span>
                                                </label>
                                                <span className="text-[10px] text-slate-400">
                                                    Gán phòng cụ thể khi khách tới Check-in
                                                </span>
                                            </div>

                                            {isLoadingCategories ? (
                                                <div className="p-3 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
                                                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                                                    Đang tải danh mục hạng phòng...
                                                </div>
                                            ) : advanceCategories.length === 0 ? (
                                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold">
                                                    ⚠️ Không tìm thấy hạng phòng nào trong hệ thống!
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <select
                                                        id="advance-category-select"
                                                        value={walkInForm.category_id}
                                                        onChange={(e) =>
                                                            setWalkInForm((prev) => ({ ...prev, category_id: e.target.value }))
                                                        }
                                                        className="w-full px-4 py-3 bg-white border-2 border-indigo-400 focus:border-indigo-600 rounded-xl text-xs font-bold text-slate-900 shadow-xs focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition cursor-pointer appearance-none"
                                                    >
                                                        {advanceCategories.map((c) => {
                                                            const price = Number(c.promo_price) || Number(c.base_price) || 0;
                                                            return (
                                                                <option key={c.id} value={c.id}>
                                                                    {c.name} — {price.toLocaleString('vi-VN')} VND/đêm ({c.capacity || 2} khách • {c.bed_type || '1 Giường'})
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-indigo-700 font-bold">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* 2.3 Thẻ Preview Hạng Phòng & Tính Toán Tiền */}
                                        {(() => {
                                            const selectedCat = advanceCategories.find(
                                                (c) => String(c.id) === String(walkInForm.category_id)
                                            );
                                            const nights = Math.max(
                                                1,
                                                Math.round(
                                                    (new Date(walkInForm.check_out_date) - new Date(walkInForm.check_in_date)) /
                                                    (1000 * 60 * 60 * 24)
                                                ) || 1
                                            );
                                            const pricePerNight = selectedCat
                                                ? Number(selectedCat.promo_price) || Number(selectedCat.base_price) || 0
                                                : 0;
                                            const totalAmount = pricePerNight * nights;

                                            return (
                                                <div className="space-y-3 pt-1">
                                                    {selectedCat && (
                                                        <div className="p-3 bg-white rounded-xl border border-indigo-200 flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                                                                    🏨
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-slate-900 text-xs">
                                                                        {selectedCat.name}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500">
                                                                        Sức chứa: {selectedCat.capacity || 2} khách • {selectedCat.bed_type || '1 Giường đôi'} {selectedCat.size ? `• ${selectedCat.size} m²` : ''}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                                                                Đang mở đặt
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Trạng thái đơn đặt trước ban đầu */}
                                                    <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                                                        <span className="font-bold text-slate-700">Trạng thái đơn:</span>
                                                        <div className="flex items-center gap-3">
                                                            <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-emerald-700">
                                                                <input
                                                                    type="radio"
                                                                    name="initial_status"
                                                                    value="confirmed"
                                                                    checked={walkInForm.initial_status === 'confirmed'}
                                                                    onChange={() => setWalkInForm(prev => ({ ...prev, initial_status: 'confirmed' }))}
                                                                    className="accent-emerald-600"
                                                                />
                                                                <span>Đã xác nhận (Confirmed)</span>
                                                            </label>
                                                            <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-amber-700">
                                                                <input
                                                                    type="radio"
                                                                    name="initial_status"
                                                                    value="pending"
                                                                    checked={walkInForm.initial_status === 'pending'}
                                                                    onChange={() => setWalkInForm(prev => ({ ...prev, initial_status: 'pending' }))}
                                                                    className="accent-amber-600"
                                                                />
                                                                <span>Chờ duyệt (Pending)</span>
                                                            </label>
                                                        </div>
                                                    </div>

                                                    <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-md space-y-2">
                                                        <div className="flex items-center justify-between text-xs text-slate-300">
                                                            <span>Đơn giá hạng phòng:</span>
                                                            <span className="font-mono font-bold text-white">
                                                                {pricePerNight.toLocaleString('vi-VN')} VND / đêm
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-xs text-slate-300">
                                                            <span>Thời gian lưu trú:</span>
                                                            <span className="font-bold text-indigo-400">
                                                                🌙 {nights} đêm lưu trú
                                                            </span>
                                                        </div>
                                                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                                                Tổng tiền giữ chỗ:
                                                            </span>
                                                            <div className="text-right">
                                                                <span className="font-black text-xl text-rose-400">
                                                                    {totalAmount.toLocaleString('vi-VN')}
                                                                </span>
                                                                <span className="text-xs text-slate-300 ml-1">VND</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* 2.4 Ghi chú nội bộ tiếp nhận điện thoại */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                                Ghi chú nội bộ cuộc gọi / nguồn đặt
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="VD: Khách gọi Hotline lúc 10h, hẹn nhận phòng 14h, chưa thanh toán cọc..."
                                                value={walkInForm.internal_note}
                                                onChange={(e) =>
                                                    setWalkInForm((prev) => ({
                                                        ...prev,
                                                        internal_note: e.target.value
                                                    }))
                                                }
                                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Banner hướng dẫn giao dịch linh hoạt theo Tab */}
                            <div className={`p-3 rounded-xl text-[11px] flex items-start gap-2.5 border ${bookingTab === 'walk_in'
                                ? 'bg-purple-50/80 border-purple-200 text-purple-950'
                                : 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                                }`}>
                                <span className="text-base">ℹ️</span>
                                <div>
                                    {bookingTab === 'walk_in' ? (
                                        <>
                                            Khi bấm <strong>"Hoàn tất Check-in Walk-in"</strong>, hệ thống sẽ thực thi Transaction đồng thời:
                                            <span className="block mt-0.5 text-[10px] text-purple-800 font-medium">
                                                • Tự động tìm/tạo hồ sơ khách hàng $\rightarrow$ Tạo đơn đặt phòng với trạng thái <strong>Đã Check-in (checked_in)</strong> $\rightarrow$ Cập nhật phòng thành <strong>Đang có khách (occupied)</strong> $\rightarrow$ Mở hóa đơn bàn giao ngay.
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            Khi bấm <strong>"Tạo Đơn Đặt Giữ Chỗ"</strong>, hệ thống sẽ lưu đơn đặt phòng trước theo Hạng phòng:
                                            <span className="block mt-0.5 text-[10px] text-indigo-800 font-medium">
                                                • Tự động tạo hồ sơ khách hàng $\rightarrow$ Tạo đơn với trạng thái <strong>{walkInForm.initial_status === 'confirmed' ? 'Đã xác nhận (confirmed)' : 'Chờ duyệt (pending)'}</strong>. Khi khách tới quầy vào ngày Check-in, Lễ tân chỉ cần bấm nút <strong>"Check-in"</strong> trên danh sách để chọn phòng vật lý cụ thể và bàn giao thẻ từ.
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Footer Modal Action Buttons */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    disabled={isSubmittingWalkIn}
                                    onClick={() => setIsWalkInModalOpen(false)}
                                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                                >
                                    Hủy bỏ
                                </button>

                                <button
                                    type="submit"
                                    disabled={
                                        isSubmittingWalkIn ||
                                        !walkInForm.guest_name.trim() ||
                                        !walkInForm.guest_phone.trim() ||
                                        !walkInForm.identity_card.trim() ||
                                        !walkInForm.check_out_date ||
                                        (bookingTab === 'walk_in' && (isLoadingWalkInRooms || walkInAvailableRooms.length === 0 || !walkInForm.room_id)) ||
                                        (bookingTab === 'advance' && (isLoadingCategories || advanceCategories.length === 0 || !walkInForm.category_id || !walkInForm.check_in_date))
                                    }
                                    className={`px-6 py-2.5 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${bookingTab === 'walk_in'
                                        ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 shadow-blue-600/30'
                                        : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-indigo-600/30'
                                        }`}
                                >
                                    {isSubmittingWalkIn ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>{bookingTab === 'walk_in' ? 'Đang tạo đơn & Check-in...' : 'Đang tạo đơn giữ chỗ...'}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>{bookingTab === 'walk_in' ? '🔑' : '📅'}</span>
                                            <span>{bookingTab === 'walk_in' ? 'Hoàn tất Check-in Walk-in' : 'Tạo Đơn Đặt Giữ Chỗ (Xác nhận)'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL THÊM DỊCH VỤ / GỌI MÓN CHO ĐƠN ĐẶT PHÒNG (TẠI QUẦY / QUA ĐIỆN THOẠI) */}
            {/* ========================================================================= */}
            {isAddServiceModalOpen && selectedBooking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
                    <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8">
                        {/* Header Modal - Nền trắng trang nhã */}
                        <div className="p-5 bg-white border-b border-slate-100 text-slate-900 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center text-xl shrink-0 shadow-xs">
                                    🛎️
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                                            #{selectedBooking.booking_code}
                                        </span>
                                        <span className="text-slate-300">•</span>
                                        <span className="text-xs text-slate-600 font-semibold">
                                            {selectedBooking.room_number ? `Phòng ${selectedBooking.room_number}` : selectedBooking.room_name}
                                        </span>
                                    </div>
                                    <h3 className="font-serif text-lg font-bold text-slate-900 mt-1">
                                        Thêm Dịch Vụ / Gọi Món Cho Khách
                                    </h3>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        Khách hàng: <strong className="text-slate-800 font-semibold">{selectedBooking.guest_name}</strong>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAddServiceModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center font-bold text-sm cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Thanh chuyển chế độ: Từ Menu vs Tùy Chỉnh */}
                        <div className="p-3 bg-slate-50 border-b border-slate-200 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setServiceMode('menu')}
                                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${serviceMode === 'menu'
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                            >
                                <span>🍽️</span>
                                <span>Từ Menu Khách Sạn ({serviceCatalog.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setServiceMode('custom')}
                                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${serviceMode === 'custom'
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                            >
                                <span>✏️</span>
                                <span>Phụ Phí / Dịch Vụ Tùy Chỉnh</span>
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleAddExtraServiceSubmit} className="p-6 space-y-4 text-xs">
                            {serviceMode === 'menu' ? (
                                <div className="space-y-4">
                                    {/* Tìm kiếm và Lọc theo Danh mục */}
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    value={serviceSearchKeyword}
                                                    onChange={(e) => setServiceSearchKeyword(e.target.value)}
                                                    placeholder="Tìm kiếm món ăn, thức uống, spa..."
                                                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600/30"
                                                />
                                                <span className="absolute left-2.5 top-2.5 text-slate-400">🔍</span>
                                            </div>
                                            {serviceCategories.length > 0 && (
                                                <select
                                                    value={serviceCategoryFilter}
                                                    onChange={(e) => setServiceCategoryFilter(e.target.value)}
                                                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-600/30"
                                                >
                                                    <option value="all">Tất cả nhóm</option>
                                                    {serviceCategories.map((c) => (
                                                        <option key={c.id} value={c.id}>
                                                            {c.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    </div>

                                    {/* Dropdown / Danh sách chọn Dịch vụ */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                                            Chọn món hoặc dịch vụ <span className="text-rose-500">*</span>
                                        </label>
                                        {isLoadingCatalog ? (
                                            <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                                                <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                                                Đang tải danh mục thực đơn...
                                            </div>
                                        ) : filteredCatalog.length === 0 ? (
                                            <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                                                Không tìm thấy dịch vụ nào phù hợp với từ khóa.
                                            </div>
                                        ) : (
                                            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white shadow-inner">
                                                {filteredCatalog.map((item) => {
                                                    const isSelected = String(serviceForm.service_id) === String(item.id);
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            onClick={() => handleServiceSelect(item.id)}
                                                            className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition ${isSelected
                                                                ? 'bg-purple-50 text-purple-950 font-semibold'
                                                                : 'hover:bg-slate-50 text-slate-700'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <input
                                                                    type="radio"
                                                                    name="service_selection"
                                                                    checked={isSelected}
                                                                    onChange={() => handleServiceSelect(item.id)}
                                                                    className="w-4 h-4 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                                                />
                                                                <div className="truncate">
                                                                    <span className="block truncate font-bold text-slate-900 text-xs">
                                                                        {item.name}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 block truncate">
                                                                        {item.category?.name || item.category_name || 'Dịch vụ'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <span className="font-bold text-purple-700 shrink-0 text-xs">
                                                                {Number(item.price).toLocaleString('vi-VN')} VND
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Gợi ý nhanh các khoản phụ thu */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                            Gợi ý nhanh phụ phí:
                                        </label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {QUICK_SURCHARGES.map((sug, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setServiceForm((prev) => ({ ...prev, custom_name: sug }))}
                                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 border border-slate-200 text-slate-600 text-[11px] font-medium transition cursor-pointer"
                                                >
                                                    {sug}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Tên dịch vụ tùy chỉnh */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-800 mb-1">
                                            Tên dịch vụ / Phụ phí tùy chỉnh <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={serviceForm.custom_name}
                                            onChange={(e) => setServiceForm((prev) => ({ ...prev, custom_name: e.target.value }))}
                                            placeholder="VD: 2 Lon nước ngọt Coca, Phụ thu check-in sớm..."
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600/30"
                                        />
                                    </div>

                                    {/* Đơn giá tùy chỉnh */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-800 mb-1">
                                            Đơn giá (VND) <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="1000"
                                            value={serviceForm.price}
                                            onChange={(e) => setServiceForm((prev) => ({ ...prev, price: e.target.value }))}
                                            placeholder="VD: 40000"
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-600/30"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Cụm Số lượng & Đơn giá xem trước */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div>
                                    <label className="block text-xs font-bold text-slate-800 mb-1">
                                        Số lượng
                                    </label>
                                    <div className="flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setServiceForm((prev) => ({
                                                    ...prev,
                                                    quantity: Math.max(1, (Number(prev.quantity) || 1) - 1)
                                                }))
                                            }
                                            className="w-9 h-9 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-base flex items-center justify-center transition cursor-pointer"
                                        >
                                            -
                                        </button>
                                        <input
                                            type="number"
                                            min="1"
                                            max="99"
                                            value={serviceForm.quantity}
                                            onChange={(e) =>
                                                setServiceForm((prev) => ({
                                                    ...prev,
                                                    quantity: Math.max(1, parseInt(e.target.value) || 1)
                                                }))
                                            }
                                            className="flex-1 text-center font-bold text-slate-900 text-xs focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setServiceForm((prev) => ({
                                                    ...prev,
                                                    quantity: (Number(prev.quantity) || 1) + 1
                                                }))
                                            }
                                            className="w-9 h-9 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-base flex items-center justify-center transition cursor-pointer"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-800 mb-1">
                                        Đơn giá áp dụng (VND)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1000"
                                        value={serviceForm.price}
                                        onChange={(e) => setServiceForm((prev) => ({ ...prev, price: e.target.value }))}
                                        placeholder="0"
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-600/30"
                                    />
                                </div>
                            </div>

                            {/* Tùy chọn trạng thái dịch vụ */}
                            {serviceMode === 'menu' && (
                                <div className="space-y-1.5 pt-1">
                                    <label className="block text-xs font-bold text-slate-800">
                                        Trạng thái phục vụ:
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <label className={`p-2.5 rounded-xl border cursor-pointer flex items-start gap-2 transition ${serviceForm.service_status === 'completed'
                                            ? 'bg-purple-50/80 border-purple-400 text-purple-950 font-semibold shadow-xs'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}>
                                            <input
                                                type="radio"
                                                name="service_status"
                                                value="completed"
                                                checked={serviceForm.service_status === 'completed'}
                                                onChange={() => setServiceForm((prev) => ({ ...prev, service_status: 'completed' }))}
                                                className="mt-0.5 text-purple-600 focus:ring-purple-500"
                                            />
                                            <div>
                                                <span className="block text-xs font-bold text-slate-900">
                                                    ✓ Đã phục vụ xong
                                                </span>
                                                <span className="text-[10px] text-slate-500 leading-tight block">
                                                    Tính ngay vào hóa đơn thanh toán
                                                </span>
                                            </div>
                                        </label>

                                        <label className={`p-2.5 rounded-xl border cursor-pointer flex items-start gap-2 transition ${serviceForm.service_status === 'pending'
                                            ? 'bg-amber-50/80 border-amber-400 text-amber-950 font-semibold shadow-xs'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}>
                                            <input
                                                type="radio"
                                                name="service_status"
                                                value="pending"
                                                checked={serviceForm.service_status === 'pending'}
                                                onChange={() => setServiceForm((prev) => ({ ...prev, service_status: 'pending' }))}
                                                className="mt-0.5 text-amber-600 focus:ring-amber-500"
                                            />
                                            <div>
                                                <span className="block text-xs font-bold text-slate-900">
                                                    ⏳ Chờ chuẩn bị
                                                </span>
                                                <span className="text-[10px] text-slate-500 leading-tight block">
                                                    Chuyển bếp / buồng phòng làm
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Ghi chú phục vụ */}
                            <div>
                                <label className="block text-xs font-bold text-slate-800 mb-1">
                                    Ghi chú tiếp nhận (tùy chọn)
                                </label>
                                <input
                                    type="text"
                                    value={serviceForm.note}
                                    onChange={(e) => setServiceForm((prev) => ({ ...prev, note: e.target.value }))}
                                    placeholder="VD: Khách gọi hotline lúc 11:20, giao tận phòng 304, ít cay..."
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600/30"
                                />
                            </div>

                            {/* Banner Xem Trước Tổng Tiền */}
                            <div className="p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-slate-50 border border-purple-200 rounded-2xl flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                                        Thành tiền phụ phí dự kiến
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                        {serviceForm.quantity || 1} x {Number(serviceForm.price || 0).toLocaleString('vi-VN')} VND
                                    </span>
                                </div>
                                <div className="text-right">
                                    <strong className="text-lg font-black text-purple-900">
                                        {Number((serviceForm.quantity || 1) * (serviceForm.price || 0)).toLocaleString('vi-VN')}
                                    </strong>
                                    <span className="text-xs font-bold text-purple-700 ml-1">VND</span>
                                </div>
                            </div>

                            {/* Nút hành động */}
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    disabled={isSubmittingService}
                                    onClick={() => setIsAddServiceModalOpen(false)}
                                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                                >
                                    Đóng
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingService}
                                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md shadow-purple-600/20 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                                >
                                    {isSubmittingService ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Đang lưu...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-bold">+</span>
                                            <span>Xác nhận thêm dịch vụ</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL HÓA ĐƠN ĐẶT PHÒNG IN ẤN (CHUẨN FORM A4 MONOCHROME) */}
            {/* ========================================================================= */}
            {invoiceModalBooking && (
                <HotelInvoiceModal
                    booking={invoiceModalBooking}
                    onClose={() => setInvoiceModalBooking(null)}
                />
            )}

            {/* ========================================================================= */}
            {/* MODAL CHECK-OUT & LẬP HÓA ĐƠN TỔNG TRẢ PHÒNG */}
            {/* ========================================================================= */}
            {checkOutModalBooking && (
                <CheckOutModal
                    booking={checkOutModalBooking}
                    onClose={() => setCheckOutModalBooking(null)}
                    onSuccess={(result) => {
                        showToast('success', result?.message || 'Check-out và thanh toán thành công!');
                        const checkedOutId = checkOutModalBooking.id;
                        setBookings((prev) =>
                            prev.map((b) =>
                                b.id === checkedOutId
                                    ? { ...b, status: 'completed', status_display: 'Đã Hoàn tất (Completed)' }
                                    : b
                            )
                        );
                        fetchBookings(true);
                        try {
                            localStorage.setItem('pms_last_booking_event', Date.now().toString());
                            window.dispatchEvent(new CustomEvent('pms_booking_created'));
                        } catch (e) { }
                        if (typeof onBookingChanged === 'function') {
                            onBookingChanged();
                        }
                    }}
                    onOpenInvoice={(bookingData) => {
                        setInvoiceModalBooking(bookingData);
                    }}
                />
            )}

            {/* ========================================================================= */}
            {/* MODAL XÁC NHẬN KHÁCH KHÔNG ĐẾN NHẬN PHÒNG (NO-SHOW) */}
            {/* ========================================================================= */}
            {noShowModalBooking && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 shadow-2xl text-left animate-in zoom-in-95 duration-200">
                        {/* Header Modal */}
                        <div className="flex items-center gap-3.5 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center text-2xl shrink-0 font-bold">
                                🚫
                            </div>
                            <div>
                                <h3 className="font-serif text-lg font-bold text-slate-900">
                                    Xác nhận Khách Không Đến (No-show)
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Mã đơn: <strong className="font-mono text-slate-900">{noShowModalBooking.booking_code}</strong>
                                </p>
                            </div>
                        </div>

                        {/* Cảnh báo kiểm tra ngày nhận phòng */}
                        {!isCheckInDateReached(noShowModalBooking.check_in_date) ? (
                            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl mb-4 text-xs text-rose-900 leading-relaxed space-y-1.5">
                                <div className="font-bold flex items-center gap-1.5 text-rose-800">
                                    <span>⛔ CHƯA TỚI NGÀY NHẬN PHÒNG (KHÔNG THỂ NO-SHOW):</span>
                                </div>
                                <p className="font-medium">
                                    Đơn đặt phòng này có ngày check-in là <strong>{formatDateDisplay(noShowModalBooking.check_in_date)}</strong>. Theo quy chuẩn khách sạn, trạng thái No-show chỉ được ghi nhận từ ngày nhận phòng trở đi. Nếu khách chủ động báo trước là không đến, vui lòng đóng cửa sổ này và chọn thao tác <strong>Từ chối / Hủy đơn</strong>.
                                </p>
                            </div>
                        ) : (
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-4 text-xs text-amber-900 leading-relaxed space-y-1.5">
                                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                                    <span>⚠️ CẢNH BÁO QUAN TRỌNG:</span>
                                </div>
                                <p className="font-medium">
                                    Bạn có chắc chắn muốn đánh dấu đơn này là <strong>Khách không đến (No-show)</strong>? Hành động này sẽ hủy giữ chỗ và giải phóng phòng để bán cho khách khác. Tiền cọc (nếu có) sẽ không được hoàn lại.
                                </p>
                            </div>
                        )}

                        {/* Tóm tắt thông tin đơn đặt phòng */}
                        <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-2 mb-4 border border-slate-200/80">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Khách hàng:</span>
                                <strong className="text-slate-900">{noShowModalBooking.guest_name}</strong>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Số điện thoại:</span>
                                <span className="text-slate-800 font-semibold">{noShowModalBooking.guest_phone || 'Không có'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Hạng phòng & Số phòng:</span>
                                <span className="text-slate-900 font-bold">
                                    {noShowModalBooking.room_name} {noShowModalBooking.room_number ? `(Phòng ${noShowModalBooking.room_number})` : ''}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Thời gian lưu trú:</span>
                                <span className="text-slate-800">
                                    {formatDateDisplay(noShowModalBooking.check_in_date)} → {formatDateDisplay(noShowModalBooking.check_out_date)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                                <span className="text-slate-500">Tổng tiền đơn:</span>
                                <strong className="text-rose-600 font-bold text-sm">
                                    {Number(noShowModalBooking.grand_total_amount || noShowModalBooking.total_amount || 0).toLocaleString('vi-VN')} VND
                                </strong>
                            </div>
                        </div>

                        {/* Chọn lý do No-show */}
                        <div className="space-y-2 mb-6">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Lý do ghi nhận No-show:
                            </label>
                            <select
                                value={noShowReason}
                                onChange={(e) => setNoShowReason(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 cursor-pointer"
                            >
                                <option value="Quá giờ check-in quy định không liên lạc được">Quá giờ check-in quy định không liên lạc được</option>
                                <option value="Khách chủ động gọi điện báo không đến nhận phòng">Khách chủ động gọi điện báo không đến nhận phòng</option>
                                <option value="Khách hủy đột xuất sát giờ nhận phòng (Late Cancellation)">Khách hủy đột xuất sát giờ nhận phòng (Late Cancellation)</option>
                                <option value="Khách không cung cấp giấy tờ tùy thân hợp lệ khi đến">Khách không cung cấp giấy tờ tùy thân hợp lệ khi đến</option>
                                <option value="Khác">Lý do khác...</option>
                            </select>

                            {noShowReason === 'Khác' && (
                                <textarea
                                    rows={2}
                                    placeholder="Nhập lý do cụ thể..."
                                    value={customNoShowReason}
                                    onChange={(e) => setCustomNoShowReason(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 mt-2"
                                />
                            )}
                        </div>

                        {/* Nút hành động */}
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                disabled={isSubmittingNoShow || !isCheckInDateReached(noShowModalBooking.check_in_date)}
                                onClick={handleConfirmNoShow}
                                className="w-1/2 py-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                            >
                                {isSubmittingNoShow ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang xử lý...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>🚫</span>
                                        <span>Xác nhận No-show</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                disabled={isSubmittingNoShow}
                                onClick={() => setNoShowModalBooking(null)}
                                className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition text-center cursor-pointer"
                            >
                                Giữ lại đơn
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL XÁC NHẬN HỦY ĐƠN ĐẶT PHÒNG (NỀN TRẮNG GIỮA MÀN HÌNH) */}
            {/* ========================================================================= */}
            {cancelConfirmBooking && (
                <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl border border-slate-100 max-w-md w-full p-6 sm:p-7 shadow-2xl text-left animate-in zoom-in-95 duration-200 relative overflow-hidden">
                        {/* Nút đóng góc phải */}
                        <button
                            type="button"
                            disabled={isSubmittingCancel}
                            onClick={() => setCancelConfirmBooking(null)}
                            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold transition cursor-pointer"
                        >
                            ✕
                        </button>

                        {/* Icon & Tiêu đề trung tâm */}
                        <div className="flex flex-col items-center text-center mb-4">
                            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center text-2xl mb-3 shadow-xs font-bold">
                                ⚠️
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">
                                Xác nhận Hủy Đơn Đặt Phòng
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Mã đơn: <strong className="font-mono text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200 font-bold">#{cancelConfirmBooking.booking_code}</strong>
                            </p>
                        </div>

                        {/* Cảnh báo hành động */}
                        <div className="p-3.5 bg-rose-50/70 border border-rose-100 rounded-2xl mb-4 text-xs text-rose-900 leading-relaxed text-center">
                            Bạn có chắc chắn muốn hủy đơn đặt phòng này? <br />
                            <span className="text-rose-700 font-semibold">Hành động này sẽ giải phóng phòng và chuyển trạng thái sang Đã hủy.</span>
                        </div>

                        {/* Thẻ tóm tắt thông tin đơn đặt phòng */}
                        <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-2 mb-5 border border-slate-200/80">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Khách hàng:</span>
                                <strong className="text-slate-900">{cancelConfirmBooking.guest_name}</strong>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Số điện thoại:</span>
                                <span className="text-slate-800 font-semibold">{cancelConfirmBooking.guest_phone || 'Không có'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Phòng lưu trú:</span>
                                <span className="text-slate-900 font-bold">
                                    {cancelConfirmBooking.room_name || cancelConfirmBooking.category?.name || 'Chưa gán phòng'} {cancelConfirmBooking.room_number ? `(Phòng ${cancelConfirmBooking.room_number})` : ''}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Thời gian lưu trú:</span>
                                <span className="text-slate-800 font-medium">
                                    {formatDateDisplay(cancelConfirmBooking.check_in_date)} → {formatDateDisplay(cancelConfirmBooking.check_out_date)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                                <span className="text-slate-500 font-medium">Tổng tiền đơn:</span>
                                <strong className="text-rose-600 font-bold text-sm">
                                    {Number(cancelConfirmBooking.grand_total_amount || cancelConfirmBooking.total_amount || 0).toLocaleString('vi-VN')} VND
                                </strong>
                            </div>
                        </div>

                        {/* Nút hành động */}
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                disabled={isSubmittingCancel}
                                onClick={() => setCancelConfirmBooking(null)}
                                className="w-1/2 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition text-center cursor-pointer"
                            >
                                Không, giữ lại đơn
                            </button>

                            <button
                                type="button"
                                disabled={isSubmittingCancel}
                                onClick={handleExecuteCancelBooking}
                                className="w-1/2 py-2.5 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                            >
                                {isSubmittingCancel ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang hủy...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>✕</span>
                                        <span>Xác nhận Hủy đơn</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
