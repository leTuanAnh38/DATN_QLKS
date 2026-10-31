import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../store/authStore';
import { bookingService } from '../../services/bookingService';
import { hotelService } from '../../services/hotelService';
import roomService from '../../services/roomService';
import { notificationService } from '../../services/notificationService';
import HotelInvoiceModal from '../../components/admin/modals/shared/HotelInvoiceModal';
import CheckOutModal from '../../components/admin/modals/shared/CheckOutModal';
import CheckInModal from '../../components/admin/modals/booking/CheckInModal';
import PreAssignRoomModal from '../../components/admin/modals/booking/PreAssignRoomModal';
import StayingGuestsModal from '../../components/admin/modals/booking/StayingGuestsModal';
import BookingDetailModal from '../../components/admin/modals/booking/BookingDetailModal';
import WalkInBookingModal from '../../components/admin/modals/booking/WalkInBookingModal';
import AddServiceModal from '../../components/admin/modals/booking/AddServiceModal';
import NoShowModal from '../../components/admin/modals/booking/NoShowModal';
import CancelBookingModal from '../../components/admin/modals/booking/CancelBookingModal';
import GroupBookingSection from '../../components/admin/groups/GroupBookingSection';
import Pagination from '../../components/common/Pagination';
import { useHasPermission } from '../../utils/permission';
import {
    Calendar,
    CalendarCheck,
    CheckCircle2,
    Clock,
    XCircle,
    BedDouble,
    WalletCards,
    RotateCw,
    Plus,
    FileSpreadsheet,
    Users,
    User,
    UserCheck,
    Building2,
    Search,
    X,
    Bell,
    Check,
    Copy,
    Phone,
    CreditCard,
    DoorClosed,
    DoorOpen,
    Moon,
    Eye,
    Printer,
    LogIn,
    LogOut,
    Key,
    Ban,
    DollarSign,
    Sparkles,
    AlertCircle,
    ChevronDown,
    SlidersHorizontal,
    Receipt,
    Zap
} from 'lucide-react';

const formatToLocalDateTimeString = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

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
    const canManageFinance = useHasPermission('finance', 'update') || useHasPermission('finance', 'create');
    const isCashier = currentUserRole === 'cashier';
    // canManageBookings phục vụ các thao tác cập nhật đơn: Duyệt, Check-in, No-show, Sửa (Lễ tân, Quản lý, Admin)
    const canManageBookings = canUpdateBookings;
    // canCheckOut tuân thủ nghiêm ngặt Ma trận phân quyền: Chỉ người có quyền cập nhật đơn đặt phòng (Lễ tân, Quản lý, Admin) mới được thực hiện Check-out
    const canCheckOut = canUpdateBookings;

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
    const [bookingSegment, setBookingSegment] = useState('individual'); // 'individual' | 'group'
    const groupBookingRef = useRef(null);
    const [isGroupRefreshing, setIsGroupRefreshing] = useState(false);

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

    // 4. State Modal Check-in (Thủ tục Nhận phòng & Gán phòng thực tế)
    const [checkInModalBooking, setCheckInModalBooking] = useState(null);
    const [preAssignModalBooking, setPreAssignModalBooking] = useState(null);

    // 5. State Modal Tiếp Đón Khách (Walk-in & Đặt phòng trước qua điện thoại)
    const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
    const [isStayingGuestsModalOpen, setIsStayingGuestsModalOpen] = useState(false);
    const [bookingTab, setBookingTab] = useState('walk_in'); // 'walk_in' | 'advance'

    // 6. State Modal In Hóa Đơn Đặt Phòng (Check-in Invoice Voucher)
    const [invoiceModalBooking, setInvoiceModalBooking] = useState(null);

    // 7. State Modal Thêm Dịch Vụ / Gọi Món Cho Khách (Tại quầy / Qua điện thoại)
    const [isAddServiceModalOpen, setIsAddServiceModalOpen] = useState(false);

    // 8. State Modal Check-out (Bảng kê thanh toán & Trả phòng)
    const [checkOutModalBooking, setCheckOutModalBooking] = useState(null);

    // 9. State Modal Đánh dấu No-show (Khách không đến nhận phòng)
    const [noShowModalBooking, setNoShowModalBooking] = useState(null);

    // 9.1 State Modal Xác Nhận Hủy Đơn Đặt Phòng (Nền trắng giữa màn hình)
    const [cancelConfirmBooking, setCancelConfirmBooking] = useState(null);
    const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);


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
    };

    // Mở Modal Check-in (Nhận phòng & Gán phòng thực tế)
    const handleOpenCheckInModal = (booking) => {
        if (!canManageBookings) {
            showToast('error', 'Chỉ nhân viên Lễ tân hoặc Quản lý mới có quyền thực hiện thủ tục Check-in nhận phòng.');
            return;
        }
        setCheckInModalBooking(booking);
    };

    // Mở Modal Tiếp Đón Khách (Walk-in hoặc Đặt trước qua điện thoại)
    const handleOpenWalkInModal = (initialTab = 'walk_in') => {
        if (!canCreateBookings) {
            showToast('error', 'Bạn không có quyền tạo đơn đặt phòng mới (Yêu cầu quyền Thêm mới).');
            return;
        }
        setBookingTab(initialTab);
        setIsWalkInModalOpen(true);
    };

    // Mở modal Thêm Dịch Vụ Cho Đơn Đặt Phòng (tại quầy / qua điện thoại)
    const openAddServiceModal = (booking) => {
        if (booking) setSelectedBooking(booking);
        setIsAddServiceModalOpen(true);
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

        const validBookings = bookings.filter((b) => ['confirmed', 'checked_in', 'checked_out', 'completed'].includes(b.status));
        const totalRevenue = validBookings.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
        const validCount = validBookings.length;

        return { total, pending, confirmed, checkedIn, checkedOut, noShow, cancelled, totalRevenue, validCount };
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
                <div>
                    <h2 className="text-2xl font-serif font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                        <CalendarCheck className="w-6 h-6 text-blue-600" />
                        <span>Quản Lý Danh Sách Đặt Phòng</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Theo dõi danh sách khách lưu trú, xác nhận đơn mới, kiểm tra CCCD/Hộ chiếu và cập nhật trạng thái phòng.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* NÚT XUẤT DS KHAI BÁO LƯU TRÚ CHO CÔNG AN (Chung toàn khách sạn) */}
                    <button
                        type="button"
                        onClick={() => setIsStayingGuestsModalOpen(true)}
                        className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs rounded-xl shadow-sm shadow-emerald-600/25 transition flex items-center gap-2 cursor-pointer active:scale-95"
                        title="Xem và xuất danh sách toàn bộ khách đang lưu trú thực tế tại khách sạn để nộp Công an phường"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Khai báo lưu trú</span>
                    </button>

                    {/* NÚT TẠO ĐẶT PHÒNG THAY ĐỔI ĐỘNG THEO PHÂN HỆ TAB */}
                    {bookingSegment === 'group' ? (
                        canCreateBookings && (
                            <button
                                type="button"
                                onClick={() => groupBookingRef.current?.openCreateModal?.()}
                                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-extrabold text-xs rounded-xl shadow-sm shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                                title="Tạo đơn đặt phòng theo đoàn hoặc hợp đồng doanh nghiệp B2B"
                            >
                                <Plus className="w-4 h-4 stroke-[2.5]" />
                                <span>Tạo Đặt Phòng Theo Đoàn</span>
                            </button>
                        )
                    ) : (
                        canCreateBookings && (
                            <button
                                type="button"
                                onClick={() => handleOpenWalkInModal('walk_in')}
                                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-blue-600/25 hover:shadow-blue-600/40 transition flex items-center gap-2 cursor-pointer active:scale-95"
                                title="Tiếp đón khách vãng lai nhận phòng ngay hoặc đặt phòng trước qua điện thoại/Zalo"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Tiếp đón & Đặt phòng</span>
                            </button>
                        )
                    )}

                    {/* NÚT LÀM MỚI ĐỒNG BỘ ĐỘNG THEO PHÂN HỆ TAB */}
                    <button
                        type="button"
                        onClick={async () => {
                            if (bookingSegment === 'group') {
                                if (groupBookingRef.current?.refresh) {
                                    setIsGroupRefreshing(true);
                                    try {
                                        await groupBookingRef.current.refresh();
                                    } finally {
                                        setIsGroupRefreshing(false);
                                    }
                                }
                            } else {
                                fetchBookings();
                            }
                        }}
                        disabled={bookingSegment === 'group' ? isGroupRefreshing : isLoading}
                        className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition flex items-center gap-2 cursor-pointer shadow-2xs active:scale-95 hover:border-slate-300 disabled:opacity-50"
                        title="Tải lại danh sách mới nhất"
                    >
                        <RotateCw className={`w-3.5 h-3.5 text-slate-600 ${(bookingSegment === 'group' ? isGroupRefreshing : isLoading) ? 'animate-spin text-indigo-600' : ''}`} />
                        <span>{(bookingSegment === 'group' ? isGroupRefreshing : isLoading) ? 'Đang tải...' : 'Làm mới'}</span>
                    </button>
                </div>
            </div>

            {/* SEGMENTED CONTROL: KHÁCH LẺ VS KHÁCH ĐOÀN */}
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80 w-fit">
                <button
                    type="button"
                    onClick={() => setBookingSegment('individual')}
                    className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer ${
                        bookingSegment === 'individual'
                            ? 'bg-white text-blue-700 shadow-sm shadow-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Khách Lẻ & Vãng Lai</span>
                </button>

                <button
                    type="button"
                    onClick={() => setBookingSegment('group')}
                    className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-2 cursor-pointer ${
                        bookingSegment === 'group'
                            ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-sm shadow-indigo-500/25'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Khách Đoàn & Doanh Nghiệp (B2B / Groups)</span>
                </button>
            </div>

            {bookingSegment === 'group' ? (
                <GroupBookingSection ref={groupBookingRef} />
            ) : (
                <>
                    {/* HÀNG THỐNG KÊ NHANH (QUICK STATS CARDS) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                {/* 1. Tổng đơn */}
                <div
                    onClick={() => setStatusFilter('all')}
                    className={`rounded-2xl p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between active:scale-98 ${
                        statusFilter === 'all'
                            ? 'bg-blue-50/70 border-blue-400 shadow-sm ring-2 ring-blue-500/20'
                            : 'bg-white border-slate-200/90 hover:border-blue-300 hover:shadow-xs hover:-translate-y-0.5'
                    }`}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                                Tổng đơn
                            </span>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-2xl font-black text-slate-900">{stats.total}</span>
                                <span className="text-xs text-slate-500 font-medium">đơn</span>
                            </div>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shrink-0">
                            <CalendarCheck className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-medium">Tất cả kỳ nghỉ:</span>
                            <span className="font-bold text-blue-600">100%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: '100%' }}></div>
                        </div>
                    </div>
                </div>

                {/* 2. Chờ duyệt */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
                    className={`rounded-2xl p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between active:scale-98 ${
                        statusFilter === 'pending'
                            ? 'bg-amber-50/70 border-amber-400 shadow-sm ring-2 ring-amber-500/20'
                            : 'bg-white border-slate-200/90 hover:border-amber-300 hover:shadow-xs hover:-translate-y-0.5'
                    }`}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                                    Chờ duyệt
                                </span>
                                {stats.pending > 0 && (
                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                                )}
                            </div>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-2xl font-black text-amber-800">{stats.pending}</span>
                                <span className="text-xs text-amber-600 font-medium">đơn</span>
                            </div>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-amber-100/60">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-amber-700 font-medium">Cần xử lý:</span>
                            <span className="font-bold text-amber-800">{Math.round((stats.pending / (stats.total || 1)) * 100)}%</span>
                        </div>
                        <div className="w-full bg-amber-100/70 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((stats.pending / (stats.total || 1)) * 100)}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* 3. Đã xác nhận */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'confirmed' ? 'all' : 'confirmed')}
                    className={`rounded-2xl p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between active:scale-98 ${
                        statusFilter === 'confirmed'
                            ? 'bg-indigo-50/70 border-indigo-400 shadow-sm ring-2 ring-indigo-500/20'
                            : 'bg-white border-slate-200/90 hover:border-indigo-300 hover:shadow-xs hover:-translate-y-0.5'
                    }`}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                                Đã xác nhận
                            </span>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-2xl font-black text-indigo-800">{stats.confirmed}</span>
                                <span className="text-xs text-indigo-600 font-medium">đơn</span>
                            </div>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/60 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-indigo-100/60">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-indigo-700 font-medium">Sẵn sàng đón:</span>
                            <span className="font-bold text-indigo-800">{Math.round((stats.confirmed / (stats.total || 1)) * 100)}%</span>
                        </div>
                        <div className="w-full bg-indigo-100/70 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((stats.confirmed / (stats.total || 1)) * 100)}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* 4. Đang lưu trú */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'checked_in' ? 'all' : 'checked_in')}
                    className={`rounded-2xl p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between active:scale-98 ${
                        statusFilter === 'checked_in'
                            ? 'bg-emerald-50/70 border-emerald-400 shadow-sm ring-2 ring-emerald-500/20'
                            : 'bg-white border-slate-200/90 hover:border-emerald-300 hover:shadow-xs hover:-translate-y-0.5'
                    }`}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                                Đang ở (In-House)
                            </span>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-2xl font-black text-emerald-800">{stats.checkedIn}</span>
                                <span className="text-xs text-emerald-600 font-medium">khách</span>
                            </div>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shrink-0">
                            <BedDouble className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-emerald-100/60">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-emerald-700 font-medium">Đang lưu trú:</span>
                            <span className="font-bold text-emerald-800">{Math.round((stats.checkedIn / (stats.total || 1)) * 100)}%</span>
                        </div>
                        <div className="w-full bg-emerald-100/70 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((stats.checkedIn / (stats.total || 1)) * 100)}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* 5. Đã hủy */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'cancelled' ? 'all' : 'cancelled')}
                    className={`rounded-2xl p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between active:scale-98 ${
                        statusFilter === 'cancelled'
                            ? 'bg-rose-50/70 border-rose-400 shadow-sm ring-2 ring-rose-500/20'
                            : 'bg-white border-slate-200/90 hover:border-rose-300 hover:shadow-xs hover:-translate-y-0.5'
                    }`}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                                Đã hủy
                            </span>
                            <div className="flex items-baseline gap-1 mt-1">
                                <span className="text-2xl font-black text-rose-800">{stats.cancelled}</span>
                                <span className="text-xs text-rose-600 font-medium">đơn</span>
                            </div>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center shrink-0">
                            <XCircle className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-rose-100/60">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-rose-700 font-medium">Tỷ lệ hủy:</span>
                            <span className="font-bold text-rose-800">{Math.round((stats.cancelled / (stats.total || 1)) * 100)}%</span>
                        </div>
                        <div className="w-full bg-rose-100/70 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((stats.cancelled / (stats.total || 1)) * 100)}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* 6. Tổng giá trị đơn đặt phòng */}
                <div 
                    className="rounded-2xl p-3.5 sm:p-4 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-white border border-emerald-200/90 shadow-2xs flex flex-col justify-between col-span-2 sm:col-span-1"
                    title={`Tổng doanh thu: ${stats.totalRevenue.toLocaleString('vi-VN')} VND từ ${stats.validCount || 0} đơn hợp lệ`}
                >
                    <div>
                        <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                                Tổng giá trị đơn
                            </span>
                            <div className="w-7 h-7 rounded-lg bg-emerald-100/80 text-emerald-700 border border-emerald-300/60 flex items-center justify-center shrink-0">
                                <WalletCards className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-1 mt-1.5">
                            <span className="text-base sm:text-[15px] xl:text-[17px] font-black text-emerald-900 tracking-tight whitespace-nowrap">
                                {stats.totalRevenue.toLocaleString('vi-VN')}
                            </span>
                            <span className="text-[10.5px] font-bold text-emerald-600 shrink-0">VND</span>
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-emerald-100 flex items-center justify-between text-[11px]">
                        <span className="text-emerald-700 font-medium">Hợp lệ:</span>
                        <span className="font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md border border-emerald-200/70 whitespace-nowrap">
                            {stats.validCount || 0} đơn
                        </span>
                    </div>
                </div>
            </div>

            {/* BẢNG DỮ LIỆU CHÍNH & THANH CÔNG CỤ (FILTER & SEARCH) */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden min-w-0 max-w-full">
                {/* THANH FILTER DROPDOWN & TÌM KIẾM NHANH */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-slate-50/60">
                    <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
                        {/* Thanh Lọc Nhanh Phân Hệ: Tất cả / Check-in hôm nay / Check-out hôm nay */}
                        <div className="flex items-center p-1 bg-slate-200/70 rounded-xl max-w-full overflow-x-auto scrollbar-none shrink-0 gap-0.5">
                            <button
                                type="button"
                                onClick={() => setQuickFilterMode('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${quickFilterMode === 'all'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                                <span>Tất cả</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuickFilterMode('check-in-today')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${quickFilterMode === 'check-in-today'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-emerald-700 hover:text-emerald-800'
                                    }`}
                            >
                                <LogIn className="w-3.5 h-3.5 shrink-0" />
                                <span>Check-in hôm nay</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuickFilterMode('check-out-today')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${quickFilterMode === 'check-out-today'
                                    ? 'bg-purple-600 text-white shadow-xs'
                                    : 'text-purple-700 hover:text-purple-800'
                                    }`}
                            >
                                <LogOut className="w-3.5 h-3.5 shrink-0" />
                                <span>Check-out hôm nay</span>
                            </button>
                        </div>

                        {/* Nút gửi thông báo Check-in / Check-out hôm nay */}
                        <button
                            type="button"
                            onClick={handleTriggerDailyReminders}
                            disabled={isSendingReminders}
                            title="Quét và gửi thông báo nhắc nhở đến Khách hàng và Nhân viên/Quản lý về lịch Check-in và Check-out hôm nay"
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs cursor-pointer whitespace-nowrap shrink-0 ${isSendingReminders
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 hover:border-amber-400'
                                }`}
                        >
                            <Bell className={`w-3.5 h-3.5 shrink-0 ${isSendingReminders ? 'animate-spin' : ''}`} />
                            <span>{isSendingReminders ? 'Đang gửi...' : 'Gửi thông báo Check-in/out'}</span>
                        </button>

                        {/* 1. Thanh Filter (Dropdown) theo Trạng thái */}
                        <div className="flex items-center gap-1.5">
                            <div className="relative">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="pl-3 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 cursor-pointer hover:border-slate-300 transition appearance-none"
                                >
                                    <option value="all">Tất cả trạng thái ({stats.total})</option>
                                    <option value="pending">⏳ Chờ duyệt ({stats.pending})</option>
                                    <option value="confirmed">✓ Đã xác nhận ({stats.confirmed})</option>
                                    <option value="checked_in">🏨 Đang lưu trú ({stats.checkedIn})</option>
                                    <option value="checked_out">🏁 Đã trả phòng ({stats.checkedOut})</option>
                                    <option value="no_show">🚫 Khách không đến ({stats.noShow})</option>
                                    <option value="cancelled">✕ Đã hủy ({stats.cancelled})</option>
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>

                        {statusFilter !== 'all' && (
                            <button
                                type="button"
                                onClick={() => setStatusFilter('all')}
                                className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold rounded-lg cursor-pointer shrink-0 transition"
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
                            className="w-full pl-8 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition shadow-2xs hover:border-slate-300"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        {searchKeyword && (
                            <button
                                type="button"
                                onClick={() => setSearchKeyword('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* BẢNG DỮ LIỆU ĐẶT PHÒNG (DATA TABLE TỰ CO GIÃN VỪA KHÍT - CHỈ HIỆN TRÊN DESKTOP/TABLET) */}
                <div className="hidden md:block overflow-x-auto w-full">
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
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-xs font-black text-slate-900 tracking-wider">
                                                        {booking.booking_code}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyCode(booking.booking_code)}
                                                        className="text-slate-400 hover:text-blue-600 p-0.5 rounded cursor-pointer transition hover:bg-slate-100"
                                                        title="Sao chép mã"
                                                    >
                                                        {copiedCode === booking.booking_code ? (
                                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                        ) : (
                                                            <Copy className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>
                                                </div>
                                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                                    {formatDateTimeDisplay(booking.created_at)}
                                                </span>
                                            </td>

                                            {/* CỘT 2: TÊN KHÁCH & CCCD */}
                                            <td className="py-2.5 px-3 min-w-[130px] max-w-[170px]">
                                                <div className="font-bold text-slate-900 text-xs truncate" title={booking.guest_name}>
                                                    {booking.guest_name}
                                                </div>
                                                <div className="text-[11px] text-slate-500 mt-0.5 truncate flex items-center gap-1">
                                                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                                    <span>{booking.guest_phone || 'Chưa có SĐT'}</span>
                                                </div>
                                                {booking.identity_card ? (
                                                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-semibold text-slate-700 mt-0.5 border border-slate-200 max-w-full">
                                                        <CreditCard className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                                        <span className="truncate">{booking.identity_card}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-amber-600 italic mt-0.5 block truncate">
                                                        Chưa có CCCD
                                                    </span>
                                                )}

                                                {/* BADGE DOANH NGHIỆP / CÔNG TY (CORPORATE) */}
                                                {(booking.customer_type === 'CORPORATE' || booking.company_name) && (
                                                    <div
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 font-sans text-[10px] font-bold text-indigo-700 mt-1 border border-indigo-200 max-w-full truncate"
                                                        title={`${booking.company_name || 'Khách Doanh nghiệp'} ${booking.company_tax_code ? `(MST: ${booking.company_tax_code})` : ''}`}
                                                    >
                                                        <Building2 className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                                                        <span className="truncate">{booking.company_name || 'Doanh nghiệp'}</span>
                                                        {booking.company_tax_code && (
                                                            <span className="text-indigo-500 font-mono text-[9px] shrink-0">({booking.company_tax_code})</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* CỘT 3: PHÒNG */}
                                            <td className="py-2.5 px-3 min-w-[120px] max-w-[160px]">
                                                <strong className="text-slate-800 block text-xs font-semibold truncate" title={booking.room_name}>
                                                    {booking.room_name}
                                                </strong>
                                                <div className="mt-0.5">
                                                    {booking.room_number ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                                                <DoorClosed className="w-3 h-3 text-emerald-600" />
                                                                <span>Phòng {booking.room_number}</span>
                                                            </span>
                                                            {canManageBookings && ['pending', 'paid', 'confirmed'].includes(booking.status) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setPreAssignModalBooking(booking);
                                                                    }}
                                                                    className="text-[9.5px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                                                                    title="Đổi số phòng đã gán trước"
                                                                >
                                                                    Đổi
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            {canManageBookings && ['pending', 'paid', 'confirmed'].includes(booking.status) ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setPreAssignModalBooking(booking);
                                                                    }}
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] font-bold border border-teal-200 transition cursor-pointer"
                                                                    title="Click để gán số phòng trước khi khách Check-in"
                                                                >
                                                                    <Plus className="w-2.5 h-2.5" />
                                                                    <span>Gán phòng</span>
                                                                </button>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-medium border border-slate-200">
                                                                    Chờ gán số phòng
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* CỘT 4: CHECK-IN / CHECK-OUT */}
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                <div className="font-semibold text-slate-800 text-xs">
                                                    {formatDateDisplay(booking.check_in_date)}
                                                    <span className="text-slate-400 mx-1">→</span>
                                                    {formatDateDisplay(booking.check_out_date)}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                                                        <Moon className="w-2.5 h-2.5" />
                                                        <span>{booking.nights || 1} đêm lưu trú</span>
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
                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[9.5px] font-bold border border-rose-200" title="Đã qua ngày trả phòng mà khách chưa check-in">
                                                                    <AlertCircle className="w-2.5 h-2.5" />
                                                                    <span>Quá hạn trả</span>
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
                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[9.5px] font-bold border border-amber-200" title={`Khách chưa check-in, trễ ${daysLate} ngày`}>
                                                                    <Clock className="w-2.5 h-2.5" />
                                                                    <span>Trễ {daysLate}N</span>
                                                                </span>
                                                            );
                                                        }
                                                        if (bCheckIn === todayStr && currentHour >= 18) {
                                                            return (
                                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[9.5px] font-bold border border-amber-200" title="Sau 18:00 khách chưa check-in">
                                                                    <Clock className="w-2.5 h-2.5" />
                                                                    <span>Đến muộn (&gt;18h)</span>
                                                                </span>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            </td>

                                            {/* CỘT 5: TỔNG TIỀN */}
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                {(() => {
                                                    const extraServicesNum = Number(booking.extra_services_total || 0);
                                                    const isGroupRoom = Boolean(booking.group_booking || booking.group_booking_code || booking.group_booking_id);
                                                    const isCancelled = ['cancelled', 'no_show'].includes(booking.status);
                                                    const isPaid = ['paid', 'PAID', 'completed', 'checked_out'].includes(booking.status) ||
                                                        booking.payment_status === 'COMPLETED' ||
                                                        booking.is_paid ||
                                                        (booking.note && (
                                                            booking.note.toLowerCase().includes('vietqr: đã thanh toán') ||
                                                            booking.note.toLowerCase().includes('đã thanh toán thành công')
                                                        ));

                                                    return (
                                                        <div>
                                                            {/* Dòng 1: Số tiền tổng thanh toán & nhãn phụ thu nếu có */}
                                                            <div className="flex items-baseline gap-1">
                                                                <span className="font-extrabold text-xs sm:text-sm text-slate-900 tracking-tight">
                                                                    {Number(booking.grand_total_amount || totalAmountNum).toLocaleString('vi-VN')}
                                                                </span>
                                                                <span className="text-[10px] font-semibold text-slate-400">₫</span>
                                                                {extraServicesNum > 0 && (
                                                                    <span
                                                                        className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/80 ml-0.5"
                                                                        title={`Bao gồm +${extraServicesNum.toLocaleString('vi-VN')}đ tiền dịch vụ`}
                                                                    >
                                                                        <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                                                        <span>+{extraServicesNum >= 1000000 ? `${(extraServicesNum / 1000000).toFixed(1)}M` : `${(extraServicesNum / 1000).toLocaleString('vi-VN')}k`}</span>
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Dòng 2: Trạng thái & Phương thức thanh toán chuẩn hóa */}
                                                            <div className="mt-0.5">
                                                                {isCancelled ? (
                                                                    <span className="inline-flex items-center gap-1 text-[9.5px] font-medium text-slate-400">
                                                                        ✕ Đã hủy đơn
                                                                    </span>
                                                                ) : isGroupRoom ? (
                                                                    isPaid ? (
                                                                        <span
                                                                            className="inline-flex items-center gap-1 text-[9.5px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200/80"
                                                                            title={`Chi phí đã quyết toán qua Hóa đơn đoàn #${booking.group_booking_code || ''}`}
                                                                        >
                                                                            <Building2 className="w-2.5 h-2.5" /> Đoàn đã quyết toán
                                                                        </span>
                                                                    ) : (
                                                                        <span
                                                                            className="inline-flex items-center gap-1 text-[9.5px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200/80"
                                                                            title={`Chi phí tiền phòng kết chuyển vào Hóa đơn đoàn #${booking.group_booking_code || ''}`}
                                                                        >
                                                                            <Building2 className="w-2.5 h-2.5" /> Gộp đoàn {booking.group_booking_code ? `#${booking.group_booking_code}` : ''}
                                                                        </span>
                                                                    )
                                                                ) : isPaid ? (
                                                                    (() => {
                                                                        const rawMethod = String(
                                                                            booking.payment_method ||
                                                                            (booking.payments?.[0]?.payment_method) ||
                                                                            booking.invoice?.payment_method ||
                                                                            ''
                                                                        ).trim().toLowerCase();
                                                                        const isCash = ['cash', 'tiền mặt', 'tien_mat', 'reception', 'tai_quay', 'tại quầy', 'tại lễ tân'].includes(rawMethod) ||
                                                                            (booking.note?.toLowerCase().includes('tiền mặt'));
                                                                        const isTransfer = ['transfer', 'vietqr', 'bank_transfer', 'chuyen_khoan', 'chuyển khoản', 'qr'].includes(rawMethod) ||
                                                                            (booking.note?.toLowerCase().includes('vietqr'));

                                                                        if (isTransfer) {
                                                                            return (
                                                                                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/80" title="Đã thanh toán qua mã chuyển khoản VietQR">
                                                                                    <Check className="w-2.5 h-2.5 text-emerald-600" /> VietQR (Đã TT)
                                                                                </span>
                                                                            );
                                                                        }
                                                                        return (
                                                                            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/80" title="Đã thanh toán tiền mặt tại quầy">
                                                                                <Check className="w-2.5 h-2.5 text-emerald-600" /> Tiền mặt (Đã TT)
                                                                            </span>
                                                                        );
                                                                    })()
                                                                ) : (
                                                                    (() => {
                                                                        const noteLower = (booking.note || '').toLowerCase();
                                                                        const isQR = noteLower.includes('vietqr') || noteLower.includes('chuyển khoản');
                                                                        if (isQR) {
                                                                            return (
                                                                                <span className="inline-flex items-center gap-1 text-[9.5px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/80">
                                                                                    <Clock className="w-2.5 h-2.5 text-amber-600" /> Chờ quét QR
                                                                                </span>
                                                                            );
                                                                        }
                                                                        return (
                                                                            <span className="inline-flex items-center gap-1 text-[9.5px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200">
                                                                                <DollarSign className="w-2.5 h-2.5 text-slate-500" /> Tại Lễ tân
                                                                            </span>
                                                                        );
                                                                    })()
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </td>

                                            {/* CỘT 6: TRẠNG THÁI (HIỂN THỊ CỐ ĐỊNH, KHÔNG CHO CHỈNH SỬA) */}
                                            <td className="py-2.5 px-3 whitespace-nowrap">
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
                                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
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
                                                                        className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-2xs transition inline-flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                                                                        title="Duyệt đơn đặt phòng (Chuyển sang Đã xác nhận)"
                                                                    >
                                                                        <Check className="w-3.5 h-3.5" />
                                                                        <span>Duyệt</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={isRowUpdating}
                                                                        onClick={() => setCancelConfirmBooking(booking)}
                                                                        className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-500 text-xs font-bold border border-slate-200 transition inline-flex items-center justify-center cursor-pointer active:scale-95 disabled:opacity-50"
                                                                        title="Từ chối / Hủy đơn đặt phòng này"
                                                                    >
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </>
                                                            )}

                                                            {/* Nút hành động chính theo trạng thái: confirmed -> check-in */}
                                                            {booking.status === 'confirmed' && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenCheckInModal(booking)}
                                                                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition inline-flex items-center gap-1 cursor-pointer active:scale-95"
                                                                        title="Thực hiện gán phòng và Check-in cho khách"
                                                                    >
                                                                        <Key className="w-3.5 h-3.5" />
                                                                        <span>Check-in</span>
                                                                    </button>
                                                                    {isCheckInDateReached(booking.check_in_date) ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setNoShowModalBooking(booking)}
                                                                            className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-500 text-xs font-bold border border-slate-200 transition inline-flex items-center justify-center cursor-pointer active:scale-95"
                                                                            title="Đánh dấu Khách không đến (No-show)"
                                                                        >
                                                                            <Ban className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            disabled
                                                                            className="w-7 h-7 rounded-xl bg-slate-50 text-slate-300 text-xs font-bold border border-slate-200/60 cursor-not-allowed opacity-50 inline-flex items-center justify-center"
                                                                            title={`Chưa tới ngày nhận phòng (${formatDateDisplay(booking.check_in_date)}). Không thể đánh dấu No-show. Nếu khách báo hủy trước, vui lòng chọn Hủy đơn.`}
                                                                        >
                                                                            <Ban className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </>
                                                    )}

                                                    {/* Nút Check-out: Dành cho Lễ tân, Quản lý, và Thu ngân */}
                                                    {(canManageBookings || canCheckOut) && booking.status === 'checked_in' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setCheckOutModalBooking(booking)}
                                                            className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-[11px] shadow-2xs transition inline-flex items-center gap-1 cursor-pointer active:scale-95"
                                                            title="Thực hiện thanh toán và Check-out trả phòng"
                                                        >
                                                            <LogOut className="w-3.5 h-3.5" />
                                                            <span>Check-out</span>
                                                        </button>
                                                    )}

                                                    {/* Nút Xem chi tiết đơn (Mọi vai trò đều được xem) */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenDetailModal(booking)}
                                                        className="w-7 h-7 rounded-xl bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 transition inline-flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
                                                        title="Xem toàn bộ thông tin chi tiết đơn này"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>

                                                    {/* Nút In hóa đơn */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setInvoiceModalBooking(booking)}
                                                        className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-700 border border-slate-200 transition inline-flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
                                                        title="In hóa đơn đặt phòng (Chuẩn A4)"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                    </button>

                                                    {/* Nút Nhắc khách */}
                                                    {canManageBookings && ['pending', 'paid', 'PAID', 'confirmed', 'checked_in'].includes(booking.status) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSendReminderForBooking(booking.id)}
                                                            disabled={remindingBookingId === booking.id}
                                                            className="w-7 h-7 rounded-xl bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-800 border border-amber-200 transition inline-flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
                                                            title="Gửi thông báo nhắc nhở đến khách hàng này"
                                                        >
                                                            <Bell className={`w-3.5 h-3.5 ${remindingBookingId === booking.id ? 'animate-spin' : ''}`} />
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

                {/* ========================================================================= */}
                {/* CHẾ ĐỘ THẺ DI ĐỘNG (MOBILE CARD VIEW - CHỈ HIỂN THỊ TRÊN MÀN HÌNH < MD)   */}
                {/* ========================================================================= */}
                <div className="block md:hidden divide-y divide-slate-100">
                    {/* Loading State */}
                    {isLoading && (
                        <div className="py-12 text-center text-slate-400">
                            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            <span>Đang tải danh sách đơn đặt phòng...</span>
                        </div>
                    )}

                    {/* Empty State */}
                    {!isLoading && filteredBookings.length === 0 && (
                        <div className="py-12 text-center text-slate-400 p-4">
                            <div className="text-3xl mb-2">📭</div>
                            <p className="font-semibold text-slate-700">Không tìm thấy đơn đặt phòng nào</p>
                            <p className="text-[11px] text-slate-400 mt-1">
                                {searchKeyword
                                    ? 'Hãy thử tìm kiếm với từ khóa khác.'
                                    : 'Chưa có đơn đặt phòng nào phù hợp với bộ lọc hiện tại.'}
                            </p>
                        </div>
                    )}

                    {/* Danh sách thẻ đơn đặt phòng */}
                    {!isLoading &&
                        paginatedBookings.map((booking) => {
                            const isRowUpdating = updatingId === booking.id;
                            const totalAmountNum = Number(booking.total_amount) || 0;
                            const statusConfig =
                                STATUS_OPTIONS.find((s) => s.value === booking.status) || {
                                    color: 'bg-slate-100 text-slate-700 border-slate-200',
                                    label: booking.status
                                };
                            const extraServicesNum = Number(booking.extra_services_total || 0);
                            const isGroupRoom = Boolean(booking.group_booking || booking.group_booking_code || booking.group_booking_id);
                            const isCancelled = ['cancelled', 'no_show'].includes(booking.status);
                            const isPaid = ['paid', 'PAID', 'completed', 'checked_out'].includes(booking.status) ||
                                booking.payment_status === 'COMPLETED' ||
                                booking.is_paid ||
                                (booking.note && (
                                    booking.note.toLowerCase().includes('vietqr: đã thanh toán') ||
                                    booking.note.toLowerCase().includes('đã thanh toán thành công')
                                ));

                            return (
                                <div
                                    key={booking.id}
                                    className={`p-3.5 sm:p-4 transition space-y-2.5 ${
                                        isRowUpdating ? 'opacity-60 bg-slate-50' : 'hover:bg-blue-50/20'
                                    }`}
                                >
                                    {/* 1. Header Card: Mã Booking & Trạng thái */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono text-xs font-black text-blue-700 tracking-wider">
                                                #{booking.booking_code}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyCode(booking.booking_code)}
                                                className="text-slate-400 hover:text-blue-600 p-0.5 rounded cursor-pointer transition hover:bg-slate-100"
                                                title="Sao chép mã"
                                            >
                                                {copiedCode === booking.booking_code ? (
                                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </div>
                                        <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border shadow-2xs ${statusConfig.color}`}
                                        >
                                            {statusConfig.label}
                                        </span>
                                    </div>

                                    {/* 2. Khách hàng & SĐT & CCCD */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                                                {booking.guest_name}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 mt-0.5">
                                                {booking.guest_phone ? (
                                                    <a
                                                        href={`tel:${booking.guest_phone}`}
                                                        className="text-blue-600 font-semibold hover:underline inline-flex items-center gap-1"
                                                    >
                                                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                                        <span>{booking.guest_phone}</span>
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-400 italic">Chưa có SĐT</span>
                                                )}
                                                {booking.identity_card && (
                                                    <span className="text-[10px] text-slate-600 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 inline-flex items-center gap-1">
                                                        <CreditCard className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                                        <span>{booking.identity_card}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-slate-400 shrink-0">
                                            {formatDateTimeDisplay(booking.created_at)}
                                        </span>
                                    </div>

                                    {/* 3. Chi tiết Phòng & Lịch trình Check-in/out */}
                                    <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/80 space-y-1.5 text-xs">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold text-slate-700 truncate" title={booking.room_type || booking.room_name}>
                                                {booking.room_type || booking.room_name || 'Phòng nghỉ'}
                                            </span>
                                            <div>
                                                {booking.room_number ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
                                                        <DoorClosed className="w-3 h-3 text-emerald-600" />
                                                        <span>Phòng {booking.room_number}</span>
                                                    </span>
                                                ) : canManageBookings && ['pending', 'paid', 'PAID', 'confirmed'].includes(booking.status) ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreAssignModalBooking(booking)}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] font-bold border border-teal-200 transition cursor-pointer"
                                                    >
                                                        <Plus className="w-2.5 h-2.5" />
                                                        <span>Gán phòng</span>
                                                    </button>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-medium border border-slate-200">
                                                        Chờ gán phòng
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200/50">
                                            <div className="font-semibold text-slate-800 flex items-center gap-1">
                                                <Calendar className="w-3 h-3 text-slate-400" />
                                                <span>{formatDateDisplay(booking.check_in_date)} → {formatDateDisplay(booking.check_out_date)}</span>
                                            </div>
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 text-[9.5px] font-bold border border-blue-100">
                                                <Moon className="w-2.5 h-2.5" />
                                                <span>{booking.nights || 1} đêm</span>
                                            </span>
                                        </div>

                                        {/* Hiển thị cảnh báo trễ nhận phòng nếu có */}
                                        {(() => {
                                            if (booking.status !== 'confirmed') return null;
                                            const bCheckIn = booking.check_in_date ? String(booking.check_in_date).split('T')[0] : '';
                                            const bCheckOut = booking.check_out_date ? String(booking.check_out_date).split('T')[0] : '';
                                            const todayStr = new Date().toISOString().split('T')[0];
                                            const currentHour = new Date().getHours();

                                            if (bCheckOut && bCheckOut <= todayStr) {
                                                return (
                                                    <div className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" />
                                                        <span>Quá hạn trả phòng mà khách chưa check-in</span>
                                                    </div>
                                                );
                                            }
                                            if (bCheckIn && bCheckIn < todayStr) {
                                                const d1 = new Date(todayStr);
                                                const d2 = new Date(bCheckIn);
                                                d1.setHours(0, 0, 0, 0);
                                                d2.setHours(0, 0, 0, 0);
                                                const daysLate = Math.max(1, Math.round((d1 - d2) / (1000 * 60 * 60 * 24)));
                                                return (
                                                    <div className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        <span>Khách chưa check-in, đã trễ {daysLate} ngày</span>
                                                    </div>
                                                );
                                            }
                                            if (bCheckIn === todayStr && currentHour >= 18) {
                                                return (
                                                    <div className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        <span>Đến muộn (&gt;18:00 khách chưa check-in)</span>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>

                                    {/* 4. Tổng tiền & Thanh toán */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-baseline gap-1">
                                                <span className="font-extrabold text-xs sm:text-sm text-slate-900 tracking-tight">
                                                    {Number(booking.grand_total_amount || totalAmountNum).toLocaleString('vi-VN')}
                                                </span>
                                                <span className="text-[10px] font-semibold text-slate-400">₫</span>
                                                {extraServicesNum > 0 && (
                                                    <span
                                                        className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200/80 ml-0.5"
                                                        title={`Bao gồm +${extraServicesNum.toLocaleString('vi-VN')}đ tiền dịch vụ`}
                                                    >
                                                        <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                                        <span>+{extraServicesNum >= 1000000 ? `${(extraServicesNum / 1000000).toFixed(1)}M` : `${(extraServicesNum / 1000).toLocaleString('vi-VN')}k`}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            {isCancelled ? (
                                                <span className="text-[10px] font-medium text-slate-400">✕ Đã hủy đơn</span>
                                            ) : isGroupRoom ? (
                                                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200/80">
                                                    <Building2 className="w-2.5 h-2.5" /> HĐ đoàn #{booking.group_booking_code || ''}
                                                </span>
                                            ) : isPaid ? (
                                                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/80">
                                                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                                                    <span>Đã thanh toán</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/80">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                    <span>Chưa thanh toán</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 5. CỤM NÚT THAO TÁC 1 CHẠM (THUMB-FRIENDLY ACTION BUTTONS) */}
                                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                        {/* Primary Status Actions */}
                                        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                                            {canManageBookings && ['pending', 'paid', 'PAID'].includes(booking.status) && (
                                                <>
                                                    <button
                                                        type="button"
                                                        disabled={isRowUpdating}
                                                        onClick={() => handleQuickStatusChange(booking.id, 'confirmed')}
                                                        className="flex-1 min-w-[80px] py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                        <span>Duyệt</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={isRowUpdating}
                                                        onClick={() => setCancelConfirmBooking(booking)}
                                                        className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-600 text-xs font-bold border border-slate-200 transition flex items-center justify-center cursor-pointer active:scale-95 disabled:opacity-50"
                                                        title="Từ chối / Hủy đơn"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}

                                            {canManageBookings && booking.status === 'confirmed' && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenCheckInModal(booking)}
                                                        className="flex-1 min-w-[100px] py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                                    >
                                                        <Key className="w-3.5 h-3.5" />
                                                        <span>Check-in</span>
                                                    </button>
                                                    {isCheckInDateReached(booking.check_in_date) ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setNoShowModalBooking(booking)}
                                                            className="py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-600 text-xs font-bold border border-slate-200 transition flex items-center justify-center cursor-pointer active:scale-95"
                                                            title="Đánh dấu No-show"
                                                        >
                                                            <Ban className="w-3.5 h-3.5" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            disabled
                                                            className="py-1.5 px-2 rounded-xl bg-slate-50 text-slate-300 text-xs font-bold border border-slate-200/60 cursor-not-allowed opacity-50 flex items-center justify-center"
                                                            title={`Chưa tới ngày nhận phòng (${formatDateDisplay(booking.check_in_date)}).`}
                                                        >
                                                            <Ban className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </>
                                            )}

                                            {(canManageBookings || canCheckOut) && booking.status === 'checked_in' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setCheckOutModalBooking(booking)}
                                                    className="flex-1 min-w-[110px] py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                                >
                                                    <LogOut className="w-3.5 h-3.5" />
                                                    <span>Check-out</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Secondary Tool Icons: Chi tiết, In hóa đơn, Nhắc nhở */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenDetailModal(booking)}
                                                className="py-1.5 px-2.5 rounded-xl bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-200 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 text-xs font-bold gap-1"
                                                title="Xem chi tiết"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                <span className="text-[11px]">Chi tiết</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setInvoiceModalBooking(booking)}
                                                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-700 border border-slate-200 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 text-xs"
                                                title="In hóa đơn"
                                            >
                                                <Printer className="w-3.5 h-3.5" />
                                            </button>
                                            {canManageBookings && ['pending', 'paid', 'PAID', 'confirmed', 'checked_in'].includes(booking.status) && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleSendReminderForBooking(booking.id)}
                                                    disabled={remindingBookingId === booking.id}
                                                    className="w-8 h-8 rounded-xl bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-800 border border-amber-200 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 text-xs"
                                                    title="Nhắc khách"
                                                >
                                                    <Bell className={`w-3.5 h-3.5 ${remindingBookingId === booking.id ? 'animate-spin' : ''}`} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
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

            </>
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

            {/* MODAL GÁN PHÒNG TRƯỚC (PRE-ASSIGN ROOM) */}
            {preAssignModalBooking && (
                <PreAssignRoomModal
                    booking={preAssignModalBooking}
                    isOpen={Boolean(preAssignModalBooking)}
                    onClose={() => setPreAssignModalBooking(null)}
                    onSuccess={(resData) => {
                        const newRoomNum = resData?.room_number || null;
                        const newRoomId = resData?.room_id || null;
                        showToast(
                            'success',
                            resData?.message || (newRoomNum ? `Đã gán phòng P.${newRoomNum} thành công!` : 'Đã hủy gán phòng!')
                        );
                        setBookings((prev) =>
                            prev.map((b) =>
                                b.id === preAssignModalBooking.id
                                    ? {
                                        ...b,
                                        room: newRoomId,
                                        room_id: newRoomId,
                                        room_number: newRoomNum
                                    }
                                    : b
                            )
                        );
                        if (selectedBooking && selectedBooking.id === preAssignModalBooking.id) {
                            setSelectedBooking((prev) => ({
                                ...prev,
                                room: newRoomId,
                                room_id: newRoomId,
                                room_number: newRoomNum
                            }));
                        }
                        if (quickFilterMode === 'check-in-today') {
                            fetchBookings(true, 'check-in-today');
                        } else {
                            fetchBookings(true);
                        }
                        setPreAssignModalBooking(null);
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

            {/* MODAL CHI TIẾT ĐƠN ĐẶT PHÒNG TOÀN DIỆN */}
            <BookingDetailModal
                isOpen={Boolean(selectedBooking)}
                booking={selectedBooking}
                onClose={() => setSelectedBooking(null)}
                canManageBookings={canManageBookings}
                canCheckOut={canCheckOut}
                currentUserRole={currentUserRole}
                updatingId={updatingId}
                formatDateTimeDisplay={formatDateTimeDisplay}
                formatDateDisplay={formatDateDisplay}
                STATUS_OPTIONS={STATUS_OPTIONS}
                onOpenCheckIn={(booking) => {
                    handleOpenCheckInModal(booking);
                }}
                onOpenPreAssign={(booking) => {
                    setPreAssignModalBooking(booking);
                }}
                onOpenNoShow={(booking) => {
                    setNoShowModalBooking(booking);
                }}
                onOpenCancel={(booking) => {
                    setCancelConfirmBooking(booking);
                }}
                onOpenCheckOut={(booking) => {
                    setSelectedBooking(null);
                    setCheckOutModalBooking(booking);
                }}
                onOpenAddService={() => {
                    setIsAddServiceModalOpen(true);
                }}
                onQuickStatusChange={(bookingId, newStatus) => {
                    handleQuickStatusChange(bookingId, newStatus);
                }}
                onBookingUpdated={(updated) => {
                    setSelectedBooking(updated);
                    setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
                    if (typeof onBookingChanged === 'function') {
                        onBookingChanged();
                    }
                }}
                showToast={showToast}
                isCheckInDateReached={isCheckInDateReached}
            />

            {/* MODAL KHÁCH VÃNG LAI (WALK-IN GUEST & ĐẶT PHÒNG TRƯỚC) */}
            <WalkInBookingModal
                isOpen={isWalkInModalOpen}
                initialTab={bookingTab}
                canCreateBookings={canCreateBookings}
                onClose={() => setIsWalkInModalOpen(false)}
                onSuccess={(newBooking) => {
                    if (newBooking) {
                        setBookings((prev) => [newBooking, ...prev]);
                        if (bookingTab === 'walk_in') {
                            setInvoiceModalBooking(newBooking);
                        }
                    } else {
                        fetchBookings(true);
                    }
                    setIsWalkInModalOpen(false);
                    if (typeof onBookingChanged === 'function') {
                        onBookingChanged();
                    }
                }}
                showToast={showToast}
            />

            {/* MODAL THÊM DỊCH VỤ / GỌI MÓN CHO ĐƠN ĐẶT PHÒNG */}
            <AddServiceModal
                isOpen={isAddServiceModalOpen && Boolean(selectedBooking)}
                booking={selectedBooking}
                onClose={() => setIsAddServiceModalOpen(false)}
                onSuccess={(updatedBooking) => {
                    setSelectedBooking(updatedBooking);
                    setBookings((prev) => prev.map((b) => (b.id === updatedBooking.id ? updatedBooking : b)));
                    if (typeof onBookingChanged === 'function') {
                        onBookingChanged();
                    }
                    setIsAddServiceModalOpen(false);
                }}
                showToast={showToast}
            />

            {/* MODAL HÓA ĐƠN ĐẶT PHÒNG IN ẤN */}
            {invoiceModalBooking && (
                <HotelInvoiceModal
                    booking={invoiceModalBooking}
                    onClose={() => setInvoiceModalBooking(null)}
                />
            )}

            {/* MODAL CHECK-OUT & LẬP HÓA ĐƠN TỔNG TRẢ PHÒNG */}
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

            {/* MODAL XÁC NHẬN KHÁCH KHÔNG ĐẾN NHẬN PHÒNG (NO-SHOW) */}
            <NoShowModal
                isOpen={Boolean(noShowModalBooking)}
                booking={noShowModalBooking}
                onClose={() => setNoShowModalBooking(null)}
                onSuccess={(updatedId) => {
                    setNoShowModalBooking(null);
                    if (selectedBooking && selectedBooking.id === updatedId) {
                        setSelectedBooking(null);
                    }
                    fetchBookings(true);
                    if (typeof onBookingChanged === 'function') onBookingChanged();
                }}
                isCheckInDateReached={isCheckInDateReached}
                formatDateDisplay={formatDateDisplay}
                showToast={showToast}
            />

            {/* MODAL XÁC NHẬN HỦY ĐƠN ĐẶT PHÒNG */}
            <CancelBookingModal
                isOpen={Boolean(cancelConfirmBooking)}
                booking={cancelConfirmBooking}
                isSubmitting={isSubmittingCancel}
                onClose={() => setCancelConfirmBooking(null)}
                onConfirm={handleExecuteCancelBooking}
                formatDateDisplay={formatDateDisplay}
            />
        </div>
    );
}
