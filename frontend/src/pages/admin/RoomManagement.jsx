import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2,
    DoorOpen,
    UserCheck,
    Sparkles,
    Wrench,
    Search,
    RefreshCw,
    ClipboardList,
    Plus,
    Layers,
    X,
    Eye,
    Wine,
    Luggage,
    Receipt,
    KeyRound,
    Check,
    ChevronDown,
    Edit3,
} from 'lucide-react';
import roomService from '../../services/roomService';
import { bookingService } from '../../services/bookingService';
import CheckOutModal from '../../components/admin/modals/CheckOutModal';
import HotelInvoiceModal from '../../components/admin/modals/HotelInvoiceModal';
import MaintenanceModal from '../../components/admin/modals/MaintenanceModal';
import MaintenanceHistoryModal from '../../components/admin/modals/MaintenanceHistoryModal';
import ChangeRoomModal from '../../components/admin/modals/ChangeRoomModal';
import MinibarModal from '../../components/admin/modals/MinibarModal';
import ReportLostItemModal from '../../components/admin/modals/ReportLostItemModal';
import { useAuth } from '../../store/authStore';
import { useHasPermission } from '../../utils/permission';

// Tiện ích format ngày DD/MM/YYYY
const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const parts = String(dateStr).split('T')[0].split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    } catch {
        return dateStr;
    }
    return dateStr;
};

// Tiện ích format ngày giờ chi tiết HH:mm • DD/MM/YYYY
const formatDateTime = (isoStr) => {
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

// =========================================================================
// CẤU HÌNH TRẠNG THÁI PHÒNG & MÀU SẮC CHUẨN PMS KHÁCH SẠN
// =========================================================================
const ROOM_STATUSES = {
    available: {
        key: 'available',
        label: 'Phòng trống (Sẵn sàng)',
        shortLabel: 'Trống',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/90 font-bold',
        cardClass: 'bg-white hover:bg-emerald-50/20 border-slate-200/90 hover:border-emerald-400 text-slate-800 shadow-2xs hover:shadow-md transition-all duration-200',
        indicatorColor: 'bg-emerald-500',
        btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        icon: '🟢',
    },
    occupied: {
        key: 'occupied',
        label: 'Đang có khách lưu trú',
        shortLabel: 'Có khách',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/90 font-bold',
        cardClass: 'bg-rose-50/30 hover:bg-rose-50/50 border-rose-200/90 hover:border-rose-400 text-slate-800 shadow-2xs hover:shadow-md transition-all duration-200',
        indicatorColor: 'bg-rose-500',
        btnClass: 'bg-rose-600 hover:bg-rose-700 text-white',
        icon: '🔴',
    },
    cleaning: {
        key: 'cleaning',
        label: 'Đang dọn dẹp (Housekeeping)',
        shortLabel: 'Đang dọn',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/90 font-bold',
        cardClass: 'bg-amber-50/30 hover:bg-amber-50/50 border-amber-200/90 hover:border-amber-400 text-slate-800 shadow-2xs hover:shadow-md transition-all duration-200',
        indicatorColor: 'bg-amber-500',
        btnClass: 'bg-amber-500 hover:bg-amber-600 text-white',
        icon: '🟡',
    },
    maintenance: {
        key: 'maintenance',
        label: 'Đang bảo trì / Hỏng hóc',
        shortLabel: 'Bảo trì',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 font-bold',
        cardClass: 'bg-slate-50/80 hover:bg-slate-100/80 border-slate-300 hover:border-slate-400 text-slate-800 shadow-2xs hover:shadow-md transition-all duration-200',
        indicatorColor: 'bg-slate-400',
        btnClass: 'bg-slate-600 hover:bg-slate-700 text-white',
        icon: '⚪',
    },
};

const ISSUE_TYPE_MAP = {
    ac: 'Điều hòa / Thông gió',
    plumbing: 'Hệ thống nước / Thiết bị vệ sinh',
    electric: 'Điện / Chiếu sáng',
    electronics: 'Điện tử (TV, Tủ lạnh, Két)',
    furniture: 'Nội thất & Khóa cửa',
    other: 'Khác',
};

export default function RoomManagement({ onNavigateToBookings, onNavigateToCustomer }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isManagerOrAdmin = Boolean(user?.is_superuser || ['admin', 'owner', 'manager'].includes(user?.role));
    const canCreateRoom = useHasPermission('rooms', 'create') || isManagerOrAdmin;
    const canUpdateRoom = useHasPermission('rooms', 'update') || isManagerOrAdmin;
    const canDeleteRoom = useHasPermission('rooms', 'delete') || isManagerOrAdmin;
    const canManageBookings = useHasPermission('bookings', 'update');

    const [rooms, setRooms] = useState([]);
    const [categories, setCategories] = useState([]);
    const [floors, setFloors] = useState([]);
    const [stats, setStats] = useState({
        total: 0,
        available: 0,
        occupied: 0,
        cleaning: 0,
        maintenance: 0,
        occupancy_rate: 0,
    });
    const [isLoading, setIsLoading] = useState(true);

    // Bộ lọc
    const [searchTerm, setSearchTerm] = useState('');
    const [floorFilter, setFloorFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [groupByFloor, setGroupByFloor] = useState(true);

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);

    // Form data Tạo phòng
    const [createFormData, setCreateFormData] = useState({
        room_number: '',
        floor: 1,
        category_id: '',
        status: 'available',
    });

    // Form data Sửa phòng
    const [editFormData, setEditFormData] = useState({
        room_number: '',
        floor: 1,
        category_id: '',
        status: 'available',
    });

    const [alertMessage, setAlertMessage] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [quickStatusLoadingId, setQuickStatusLoadingId] = useState(null);

    // =========================================================================
    // MODAL PMS LIÊN KẾT BOOKING: CHECK-IN, CHECK-OUT, CHI TIẾT LƯU TRÚ
    // =========================================================================
    const [checkOutBooking, setCheckOutBooking] = useState(null);
    const [invoiceModalBooking, setInvoiceModalBooking] = useState(null);
    const [selectedOccupiedRoom, setSelectedOccupiedRoom] = useState(null);

    // Modal Bảo trì & Báo hỏng thiết bị phòng
    const [maintenanceModalData, setMaintenanceModalData] = useState({
        isOpen: false,
        room: null,
        mode: 'create', // 'create' | 'complete'
        ticket: null,
    });

    // Modal Xem Nhật ký & Lịch sử bảo trì toàn khách sạn / từng phòng
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyModalRoom, setHistoryModalRoom] = useState(null);

    // Modal Đổi phòng cho khách đang lưu trú (Room Move)
    const [changeRoomModalData, setChangeRoomModalData] = useState({
        isOpen: false,
        room: null,
        booking: null,
        reason: '',
        equipment: '',
        issueType: 'ac',
    });

    // Modal Kiểm kê Minibar
    const [minibarModalData, setMinibarModalData] = useState({
        isOpen: false,
        room: null,
    });

    const handleOpenMinibar = (room) => {
        setMinibarModalData({
            isOpen: true,
            room: room,
        });
    };

    // Modal Báo đồ thất lạc (Lost & Found)
    const [lostItemModalData, setLostItemModalData] = useState({
        isOpen: false,
        room: null,
    });

    const handleOpenLostItem = (room) => {
        setLostItemModalData({
            isOpen: true,
            room: room,
        });
    };

    // Modal / Yêu cầu dọn phòng lưu trú (Make-up room)
    const [makeUpModalRoom, setMakeUpModalRoom] = useState(null);
    const [makeUpNote, setMakeUpNote] = useState('');
    const [isSubmittingMakeUp, setIsSubmittingMakeUp] = useState(false);

    const handleOpenMakeUpModal = (room) => {
        setMakeUpModalRoom(room);
        setMakeUpNote('Khách yêu cầu dọn phòng, thay ga gối & khăn tắm');
    };

    const handleConfirmRequestCleaning = async (e) => {
        if (e) e.preventDefault();
        if (!makeUpModalRoom) return;
        setIsSubmittingMakeUp(true);
        try {
            const res = await roomService.requestRoomCleaning(makeUpModalRoom.id, makeUpNote);
            if (res.success) {
                setAlertMessage({
                    type: 'success',
                    text: res.message || `Đã tiếp nhận yêu cầu dọn phòng ${makeUpModalRoom.room_number}. Hệ thống đã gửi thông báo đến bộ phận Buồng phòng!`,
                });
                setMakeUpModalRoom(null);
                setMakeUpNote('');
                await fetchRooms(true);
                setTimeout(() => setAlertMessage(null), 3500);
            } else {
                alert(res.message || 'Không thể gửi yêu cầu dọn phòng.');
            }
        } catch (err) {
            console.error('Lỗi yêu cầu dọn phòng:', err);
        } finally {
            setIsSubmittingMakeUp(false);
        }
    };

    const handleCompleteCleaning = async (room) => {
        setQuickStatusLoadingId(room.id);
        try {
            const res = await roomService.completeRoomCleaning(room.id);
            if (res.success) {
                setAlertMessage({
                    type: 'success',
                    text: `Phòng ${room.room_number} đã được xác nhận dọn dẹp sạch sẽ! Trạng thái phòng vẫn tiếp tục "Có khách".`,
                });
                await fetchRooms(true);
                setTimeout(() => setAlertMessage(null), 3500);
            } else {
                alert(res.message || 'Không thể xác nhận hoàn tất dọn phòng.');
            }
        } catch (err) {
            console.error('Lỗi hoàn tất dọn phòng:', err);
        } finally {
            setQuickStatusLoadingId(null);
        }
    };

    const handleOpenChangeRoom = ({ room, booking, reason = '', equipment = '', issueType = 'ac' }) => {
        setChangeRoomModalData({
            isOpen: true,
            room: room || null,
            booking: booking || room?.current_booking || null,
            reason: reason || '',
            equipment: equipment || '',
            issueType: issueType || 'ac',
        });
    };

    const handleChangeRoomSuccess = async (res) => {
        setAlertMessage({
            type: 'success',
            text: res.message || 'Đổi phòng cho khách thành công!',
        });
        await fetchRooms(true);
        setTimeout(() => setAlertMessage(null), 4000);
    };

    // Modal Gán phòng & Check-in đón khách
    const [assignModalRoom, setAssignModalRoom] = useState(null);
    const [eligibleBookings, setEligibleBookings] = useState([]);
    const [isLoadingEligible, setIsLoadingEligible] = useState(false);
    const [assignSearchTerm, setAssignSearchTerm] = useState('');
    const [assignFilterMode, setAssignFilterMode] = useState('match_category'); // 'match_category' | 'all'
    const [isSubmittingAssignCheckIn, setIsSubmittingAssignCheckIn] = useState(false);
    const [checkInWarningModal, setCheckInWarningModal] = useState(null);

    // Lưu trữ bộ lọc hiện tại vào ref để polling ngầm đọc đúng giá trị mới nhất (chống stale closure)
    const filtersRef = useRef({ searchTerm, floorFilter, statusFilter, categoryFilter });
    useEffect(() => {
        filtersRef.current = { searchTerm, floorFilter, statusFilter, categoryFilter };
    }, [searchTerm, floorFilter, statusFilter, categoryFilter]);

    // 1. Tải danh sách phòng từ API (hỗ trợ silent mode để không unmount UI khi cập nhật ngầm)
    const fetchRooms = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        const { searchTerm: q, floorFilter: f, statusFilter: s, categoryFilter: c } = filtersRef.current;
        const params = {};
        if (q) params.q = q;
        if (f !== 'all') params.floor = f;
        if (s !== 'all') params.status = s;
        if (c !== 'all') params.category = c;

        try {
            const res = await roomService.getAdminRooms(params);
            if (res.success) {
                setRooms(res.rooms || []);
                if (res.categories) setCategories(res.categories);
                if (res.floors) setFloors(res.floors);
                if (res.stats) setStats(res.stats);
            }
        } catch (err) {
            console.error('Lỗi khi tải danh sách phòng:', err);
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, []);

    // Lắng nghe sự kiện realtime từ hệ thống PMS & Chu kỳ polling ngầm (đồng bộ khi App/Web khác thao tác)
    useEffect(() => {
        const handleSyncEvent = () => {
            fetchRooms(true);
        };

        // 1. Tự động đồng bộ ngay khi người dùng click quay lại tab trình duyệt này
        window.addEventListener('focus', handleSyncEvent);
        // 2. Nhận tín hiệu khi có thay đổi từ tab khác
        window.addEventListener('storage', handleSyncEvent);
        // 3. Các sự kiện PMS Custom Events
        window.addEventListener('pms_booking_created', handleSyncEvent);
        window.addEventListener('pms_room_updated', handleSyncEvent);
        window.addEventListener('pms_minibar_updated', handleSyncEvent);

        // 4. Chu kỳ Polling tự động mỗi 5 giây (silent=true, chạy ngầm mượt mà không nhấp nháy giao diện)
        const interval = setInterval(() => {
            fetchRooms(true);
        }, 5000);

        return () => {
            window.removeEventListener('focus', handleSyncEvent);
            window.removeEventListener('storage', handleSyncEvent);
            window.removeEventListener('pms_booking_created', handleSyncEvent);
            window.removeEventListener('pms_room_updated', handleSyncEvent);
            window.removeEventListener('pms_minibar_updated', handleSyncEvent);
            clearInterval(interval);
        };
    }, [fetchRooms]);

    // Tải danh mục loại phòng khi mở form nếu cần
    const fetchCategories = async () => {
        const res = await roomService.getCategories();
        if (res.success && res.categories) {
            setCategories(res.categories);
        }
    };

    useEffect(() => {
        fetchRooms();
    }, [floorFilter, statusFilter, categoryFilter, fetchRooms]);

    useEffect(() => {
        fetchCategories();
    }, []);

    // Điều hướng tab hoặc trang liên quan
    const handleGoToBookings = () => {
        setSelectedOccupiedRoom(null);
        setAssignModalRoom(null);
        if (typeof onNavigateToBookings === 'function') {
            onNavigateToBookings('all');
        } else {
            navigate('/admin?tab=bookings');
        }
    };

    const handleGoToCustomer = (guestId) => {
        if (!guestId) return;
        setSelectedOccupiedRoom(null);
        if (typeof onNavigateToCustomer === 'function') {
            onNavigateToCustomer(guestId);
        } else {
            navigate(`/admin/customers/${guestId}`);
        }
    };

    // Thao tác Check-out từ Sơ đồ phòng PMS
    const handleOpenCheckOut = (room) => {
        if (!canManageBookings) {
            alert('Chỉ nhân viên Lễ tân hoặc Quản lý mới có quyền thực hiện thủ tục Check-out trả phòng.');
            return;
        }
        if (room.current_booking) {
            setCheckOutBooking(room.current_booking);
        } else {
            // Trường hợp phòng có khách nhưng không có bản ghi booking (VD: đổi thủ công)
            handleQuickStatusChange(room.id, 'cleaning', room.room_number);
        }
    };

    const handleCheckOutSuccess = () => {
        setCheckOutBooking(null);
        setSelectedOccupiedRoom(null);
        setAlertMessage({
            type: 'success',
            text: `🧾 Đã hoàn tất Check-out & quyết toán hóa đơn! Phòng đã chuyển sang trạng thái "🟡 Đang dọn dẹp (Housekeeping)".`
        });
        fetchRooms(true);
        setTimeout(() => setAlertMessage(null), 4500);
    };

    // Thao tác Xem chi tiết khách đang lưu trú
    const handleViewOccupied = (room) => {
        setSelectedOccupiedRoom(room);
    };

    // Thao tác Mở Modal Gán phòng đón khách
    const handleOpenAssignModal = async (room) => {
        if (!canManageBookings) {
            alert('Chỉ nhân viên Lễ tân hoặc Quản lý mới có quyền thực hiện thủ tục Gán phòng đón khách.');
            return;
        }
        setAssignModalRoom(room);
        setAssignSearchTerm('');
        setAssignFilterMode('match_category');
        setIsLoadingEligible(true);
        try {
            const res = await bookingService.getMyBookings();
            if (res && res.success && Array.isArray(res.data)) {
                // Lọc các đơn đang chờ nhận phòng (confirmed hoặc pending)
                const pendingList = res.data.filter((b) => ['confirmed', 'pending'].includes(b.status));
                setEligibleBookings(pendingList);
            } else {
                setEligibleBookings([]);
            }
        } catch (err) {
            console.error('Lỗi khi tải danh sách đơn đặt phòng:', err);
            setEligibleBookings([]);
        } finally {
            setIsLoadingEligible(false);
        }
    };

    // Thực hiện gọi API Check-in khi các điều kiện đã được thỏa mãn hoặc xác nhận
    const executeAssignCheckIn = async (booking, confirmEarly = false, applyCharge = true, confirmLate = false, isEarly = false, isLate = false, earlyDays = 0, lateDays = 0) => {
        setIsSubmittingAssignCheckIn(true);
        try {
            const res = await bookingService.checkInBooking(booking.id, {
                room_id: assignModalRoom.id,
                internal_note: `Gán và Check-in trực tiếp từ Sơ đồ phòng PMS vào phòng ${assignModalRoom.room_number}${isEarly ? ` (Nhận phòng sớm ${earlyDays} ngày)` : isLate ? ` (Nhận phòng trễ ${lateDays} ngày)` : ''}`,
                confirm_early_check_in: confirmEarly,
                apply_early_charge: applyCharge,
                confirm_late_check_in: confirmLate
            });
            if (res && res.success) {
                setAlertMessage({
                    type: 'success',
                    text: res.message || `🔑 Check-in thành công cho khách "${booking.guest_name}" vào phòng ${assignModalRoom.room_number}!`
                });
                setCheckInWarningModal(null);
                setAssignModalRoom(null);
                fetchRooms(true);
                setTimeout(() => setAlertMessage(null), 4500);
            } else {
                setAlertMessage({
                    type: 'error',
                    text: res?.message || 'Check-in thất bại. Vui lòng kiểm tra lại tình trạng phòng.'
                });
                setTimeout(() => setAlertMessage(null), 5000);
            }
        } catch (err) {
            console.error('Lỗi khi thực hiện Check-in:', err);
            setAlertMessage({
                type: 'error',
                text: 'Đã xảy ra lỗi khi kết nối máy chủ để Check-in.'
            });
            setTimeout(() => setAlertMessage(null), 5000);
        } finally {
            setIsSubmittingAssignCheckIn(false);
        }
    };

    // Xác nhận Gán phòng & Check-in ngay
    const handleConfirmAssignCheckIn = async (booking) => {
        if (!canManageBookings) {
            setAlertMessage({
                type: 'error',
                text: 'Chỉ nhân viên Lễ tân hoặc Quản lý mới có quyền thực hiện Check-in.'
            });
            setTimeout(() => setAlertMessage(null), 4000);
            return;
        }
        if (!assignModalRoom || isSubmittingAssignCheckIn) return;

        const todayStr = new Date().toISOString().split('T')[0];
        const isExpired = booking.check_out_date && String(booking.check_out_date).split('T')[0] <= todayStr;
        if (isExpired) {
            setAlertMessage({
                type: 'error',
                text: `⛔ Đơn đặt phòng #${booking.booking_code} đã quá hạn lưu trú (Ngày trả phòng dự kiến là ${formatDate(booking.check_out_date)}). Không thể Check-in.`
            });
            setTimeout(() => setAlertMessage(null), 5000);
            return;
        }

        const isEarly = booking.check_in_date && String(booking.check_in_date).split('T')[0] > todayStr;
        const isLate = booking.check_in_date && String(booking.check_in_date).split('T')[0] < todayStr;

        if (isEarly) {
            const d1 = new Date(String(booking.check_in_date).split('T')[0]);
            const d2 = new Date(todayStr);
            d1.setHours(0, 0, 0, 0);
            d2.setHours(0, 0, 0, 0);
            const earlyDays = Math.max(1, Math.round((d1 - d2) / (1000 * 60 * 60 * 24)));

            setCheckInWarningModal({
                type: 'early',
                booking,
                earlyDays,
                todayStr,
                confirmEarly: true,
                applyCharge: true,
                confirmLate: false,
                isEarly: true,
                isLate: false,
            });
            return;
        }

        if (isLate) {
            const dToday = new Date(todayStr);
            const dOriginal = new Date(String(booking.check_in_date).split('T')[0]);
            const dOut = new Date(String(booking.check_out_date).split('T')[0]);
            dToday.setHours(0, 0, 0, 0);
            dOriginal.setHours(0, 0, 0, 0);
            dOut.setHours(0, 0, 0, 0);
            const lateDays = Math.max(1, Math.round((dToday - dOriginal) / (1000 * 60 * 60 * 24)));
            const remainingNights = Math.max(1, Math.round((dOut - dToday) / (1000 * 60 * 60 * 24)));

            setCheckInWarningModal({
                type: 'late',
                booking,
                lateDays,
                remainingNights,
                todayStr,
                confirmEarly: false,
                applyCharge: false,
                confirmLate: true,
                isEarly: false,
                isLate: true,
            });
            return;
        }

        await executeAssignCheckIn(booking, false, true, false, false, false, 0, 0);
    };

    // Lọc danh sách đơn phù hợp trong Modal Gán phòng
    const filteredEligibleBookings = eligibleBookings.filter((b) => {
        if (assignSearchTerm) {
            const term = assignSearchTerm.toLowerCase();
            const matchName = (b.guest_name || '').toLowerCase().includes(term);
            const matchPhone = (b.guest_phone || '').toLowerCase().includes(term);
            const matchCode = (b.booking_code || '').toLowerCase().includes(term);
            if (!matchName && !matchPhone && !matchCode) return false;
        }

        if (assignFilterMode === 'match_category' && assignModalRoom) {
            const roomCatId = assignModalRoom.category?.id || assignModalRoom.category_id;
            const bCatId = b.category?.id || b.category_id || (b.room?.category?.id);
            if (roomCatId && bCatId) {
                return String(roomCatId) === String(bCatId);
            }
            if (assignModalRoom.category_name && (b.category_name || b.room_type)) {
                return (b.category_name || b.room_type).toLowerCase() === assignModalRoom.category_name.toLowerCase();
            }
        }
        return true;
    });

    // Tìm kiếm
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchRooms();
    };

    // Reset bộ lọc
    const handleResetFilters = () => {
        setSearchTerm('');
        setFloorFilter('all');
        setStatusFilter('all');
        setCategoryFilter('all');
        fetchRooms();
    };

    // Helper format tiền tệ
    const formatCurrency = (amount) => {
        if (!amount && amount !== 0) return '—';
        return Number(amount).toLocaleString('vi-VN') + ' ₫';
    };

    // =========================================================================
    // 2. THAO TÁC ĐỔI NHANH TRẠNG THÁI PHÒNG (Cho Lễ tân / Buồng phòng / Kỹ thuật)
    // =========================================================================
    // Mở modal Báo hỏng thiết bị & Bắt đầu bảo trì
    const handleOpenReportMaintenance = (room) => {
        setMaintenanceModalData({
            isOpen: true,
            room: room,
            mode: 'create',
            ticket: null,
        });
    };

    // Mở modal Hoàn tất sửa chữa & Bàn giao buồng phòng dọn dẹp
    const handleOpenCompleteMaintenance = (room) => {
        setMaintenanceModalData({
            isOpen: true,
            room: room,
            mode: 'complete',
            ticket: room.active_maintenance || null,
        });
    };

    // Callback khi submit form modal bảo trì
    const handleMaintenanceSuccess = async (payload, mode) => {
        if (mode === 'create') {
            const res = await roomService.createMaintenanceTicket(payload);
            if (res && res.success) {
                setAlertMessage({
                    type: 'success',
                    text: res.message || `Đã chuyển phòng ${maintenanceModalData.room?.room_number} sang "Đang bảo trì".`,
                });
                await fetchRooms(true);
                setTimeout(() => setAlertMessage(null), 3500);
            } else {
                throw new Error(res?.message || 'Không thể lập phiếu bảo trì.');
            }
        } else {
            const ticketId = payload.ticket_id || maintenanceModalData.ticket?.id;
            if (!ticketId) {
                await handleDirectStatusChange(maintenanceModalData.room.id, 'cleaning', maintenanceModalData.room.room_number);
                return;
            }
            const res = await roomService.completeMaintenanceTicket(ticketId, payload);
            if (res && res.success) {
                setAlertMessage({
                    type: 'success',
                    text: res.message || `Đã hoàn tất sửa chữa phòng ${maintenanceModalData.room?.room_number}! Bàn giao Buồng phòng dọn dẹp.`,
                });
                await fetchRooms(true);
                setTimeout(() => setAlertMessage(null), 3500);
            } else {
                throw new Error(res?.message || 'Không thể hoàn tất bảo trì.');
            }
        }
    };

    const handleDirectStatusChange = async (roomId, newStatus, roomNumber) => {
        setQuickStatusLoadingId(roomId);
        try {
            const res = await roomService.updateRoomStatus(roomId, newStatus);
            if (res && res.success) {
                setAlertMessage({
                    type: 'success',
                    text: `Phòng ${roomNumber} đã được chuyển sang "${ROOM_STATUSES[newStatus]?.label || newStatus}".`,
                });
                await fetchRooms(true);
                setTimeout(() => setAlertMessage(null), 3000);
            }
        } catch (err) {
            console.error('Lỗi đổi trạng thái:', err);
        } finally {
            setQuickStatusLoadingId(null);
        }
    };

    const handleQuickStatusChange = async (roomId, newStatus, roomNumber) => {
        const currentRoom = rooms.find((r) => r.id === roomId);
        const oldStatus = currentRoom ? currentRoom.status : null;
        if (oldStatus === newStatus) return;

        // BẢO VỆ PHÒNG CÓ KHÁCH: Chặn tuyệt đối đổi trạng thái trực tiếp khi phòng đang có khách lưu trú
        if (oldStatus === 'occupied') {
            setAlertMessage({
                type: 'error',
                text: `Phòng ${roomNumber} hiện đang có khách lưu trú. Vui lòng thực hiện thủ tục "Trả phòng & Quyết toán" theo đúng quy trình PMS.`,
            });
            setTimeout(() => setAlertMessage(null), 4000);
            return;
        }

        // Chặn chuyển thủ công sang 'occupied' mà không có khách
        if (newStatus === 'occupied') {
            setAlertMessage({
                type: 'error',
                text: `Không thể chuyển phòng ${roomNumber} sang "Có khách" bằng thao tác nhanh. Vui lòng bấm "Gán phòng & Check-in ngay" để tạo hồ sơ khách.`,
            });
            setTimeout(() => setAlertMessage(null), 4000);
            return;
        }

        // Nếu chuyển sang Bảo trì: Mở Modal Báo hỏng thiết bị để lưu thông tin chi tiết
        if (newStatus === 'maintenance') {
            handleOpenReportMaintenance(currentRoom);
            return;
        }

        // Nếu phòng đang là bảo trì mà chuyển sang dọn dẹp: Mở Modal Hoàn tất sửa chữa để nhập vật tư/chi phí
        if (oldStatus === 'maintenance' && newStatus === 'cleaning') {
            handleOpenCompleteMaintenance(currentRoom);
            return;
        }

        setQuickStatusLoadingId(roomId);

        // 1. Optimistic UI: Cập nhật ngay lập tức trạng thái phòng để không giật lag
        setRooms((prev) =>
            prev.map((r) =>
                r.id === roomId
                    ? {
                          ...r,
                          status: newStatus,
                          status_display: ROOM_STATUSES[newStatus]?.label || newStatus,
                      }
                    : r
            )
        );

        // 2. Optimistic UI: Cập nhật ngay bộ đếm thống kê tổng quan
        if (oldStatus) {
            setStats((prev) => {
                const updated = {
                    ...prev,
                    [oldStatus]: Math.max(0, (prev[oldStatus] || 0) - 1),
                    [newStatus]: (prev[newStatus] || 0) + 1,
                };
                if (updated.total > 0) {
                    updated.occupancy_rate = Math.round((updated.occupied / updated.total) * 1000) / 10;
                }
                return updated;
            });
        }

        try {
            const res = await roomService.updateRoomStatus(roomId, newStatus);
            if (res.success) {
                // Cập nhật dữ liệu từ phản hồi server nếu có
                if (res.room) {
                    setRooms((prev) =>
                        prev.map((r) => (r.id === roomId ? { ...r, ...res.room } : r))
                    );
                }
                if (res.stats) {
                    setStats(res.stats);
                } else {
                    // Đồng bộ ngầm trong nền, không unmount giao diện, không cuộn nhảy
                    await fetchRooms(true);
                }

                const statusObj = ROOM_STATUSES[newStatus] || {};
                setAlertMessage({
                    type: 'success',
                    text: `Phòng ${roomNumber} đã được chuyển sang trạng thái "${statusObj.label || newStatus}" thành công!`,
                });
                setTimeout(() => setAlertMessage(null), 3000);
            } else {
                // Rollback nếu thất bại
                if (oldStatus && currentRoom) {
                    setRooms((prev) =>
                        prev.map((r) => (r.id === roomId ? currentRoom : r))
                    );
                    setStats((prev) => {
                        const updated = {
                            ...prev,
                            [newStatus]: Math.max(0, (prev[newStatus] || 0) - 1),
                            [oldStatus]: (prev[oldStatus] || 0) + 1,
                        };
                        if (updated.total > 0) {
                            updated.occupancy_rate = Math.round((updated.occupied / updated.total) * 1000) / 10;
                        }
                        return updated;
                    });
                }
                setAlertMessage({
                    type: 'error',
                    text: res.message || 'Không thể đổi trạng thái phòng.',
                });
                setTimeout(() => setAlertMessage(null), 3500);
            }
        } catch (err) {
            console.error('Lỗi khi đổi trạng thái phòng:', err);
            if (oldStatus && currentRoom) {
                setRooms((prev) =>
                    prev.map((r) => (r.id === roomId ? currentRoom : r))
                );
            }
            setAlertMessage({
                type: 'error',
                text: 'Có lỗi xảy ra khi đổi trạng thái phòng.',
            });
            setTimeout(() => setAlertMessage(null), 3500);
        } finally {
            setQuickStatusLoadingId(null);
        }
    };

    // =========================================================================
    // 3. TẠO MỚI PHÒNG THỰC TẾ
    // =========================================================================
    const handleOpenCreate = () => {
        const defaultCatId = categories.length > 0 ? categories[0].id : '';
        setCreateFormData({
            room_number: '',
            floor: 1,
            category_id: defaultCatId,
            status: 'available',
        });
        setIsCreateModalOpen(true);
    };

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const payload = {
            room_number: createFormData.room_number.trim(),
            floor: parseInt(createFormData.floor) || 1,
            category_id: parseInt(createFormData.category_id),
            status: createFormData.status,
        };

        const res = await roomService.createRoom(payload);
        setIsSubmitting(false);

        if (res.success) {
            setIsCreateModalOpen(false);
            setAlertMessage({
                type: 'success',
                text: res.message || `Đã thêm phòng ${payload.room_number} vào sơ đồ phòng thành công!`,
            });
            fetchRooms(true);
            setTimeout(() => setAlertMessage(null), 3500);
        } else {
            setAlertMessage({
                type: 'error',
                text: res.message || 'Tạo phòng thất bại. Vui lòng kiểm tra lại.',
            });
        }
    };

    // =========================================================================
    // 4. CHỈNH SỬA PHÒNG
    // =========================================================================
    const handleOpenEdit = (room) => {
        setSelectedRoom(room);
        setEditFormData({
            room_number: room.room_number,
            floor: room.floor,
            category_id: room.category?.id || room.category_id || (categories[0]?.id || ''),
            status: room.status,
        });
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const payload = {
            room_number: editFormData.room_number.trim(),
            floor: parseInt(editFormData.floor) || 1,
            category_id: parseInt(editFormData.category_id),
            status: editFormData.status,
        };

        const res = await roomService.updateRoom(selectedRoom.id, payload);
        setIsSubmitting(false);

        if (res.success) {
            setIsEditModalOpen(false);
            setAlertMessage({
                type: 'success',
                text: res.message || `Cập nhật phòng ${payload.room_number} thành công!`,
            });
            fetchRooms(true);
            setTimeout(() => setAlertMessage(null), 3500);
        } else {
            setAlertMessage({
                type: 'error',
                text: res.message || 'Cập nhật phòng thất bại.',
            });
        }
    };

    // =========================================================================
    // 5. XÓA PHÒNG AN TOÀN
    // =========================================================================
    const handleOpenDelete = (room) => {
        setSelectedRoom(room);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedRoom) return;
        setIsSubmitting(true);

        const res = await roomService.deleteRoom(selectedRoom.id);
        setIsSubmitting(false);

        if (res.success) {
            setIsDeleteModalOpen(false);
            setAlertMessage({
                type: 'success',
                text: res.message || `Đã xóa phòng ${selectedRoom.room_number} khỏi hệ thống!`,
            });
            fetchRooms(true);
            setTimeout(() => setAlertMessage(null), 3500);
        } else {
            setAlertMessage({
                type: 'error',
                text: res.message || 'Xóa phòng thất bại.',
            });
        }
    };

    // Nhóm phòng theo tầng nếu chọn `groupByFloor`
    const groupedRooms = floors.reduce((acc, fl) => {
        acc[fl] = rooms.filter((r) => r.floor === fl);
        return acc;
    }, {});

    return (
        <div className="space-y-6">
            {/* Header Banner & Quick Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-serif font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                        <Building2 className="w-6 h-6 text-blue-600" />
                        <span>Quản Lý Danh Sách & Sơ Đồ Phòng</span>
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Kiểm soát trạng thái phòng thời gian thực, hỗ trợ Lễ tân đổi nhanh tình trạng phòng và cập nhật phòng mới.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => fetchRooms(true)}
                        className="px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-2 cursor-pointer hover:border-slate-300"
                        title="Tải lại sơ đồ phòng"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isLoading ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline">Làm Mới</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setHistoryModalRoom(null);
                            setIsHistoryModalOpen(true);
                        }}
                        className="px-3.5 py-2.5 bg-amber-50/80 hover:bg-amber-100/80 border border-amber-300/80 text-amber-900 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-2 cursor-pointer"
                        title="Xem lịch sử hỏng hóc, sửa chữa thiết bị, vật tư thay thế & chi phí"
                    >
                        <ClipboardList className="w-3.5 h-3.5 text-amber-700" />
                        <span className="hidden sm:inline">Nhật Ký Bảo Trì</span>
                    </button>
                    {canCreateRoom && (
                        <button
                            type="button"
                            onClick={handleOpenCreate}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer active:scale-98"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Thêm Phòng Mới</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Alert Message Toast */}
            {alertMessage && (
                <div
                    className={`p-4 rounded-2xl flex items-center justify-between text-xs font-medium border transition animate-fadeIn ${
                        alertMessage.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        <span className="text-base">{alertMessage.type === 'success' ? '✅' : '⚠️'}</span>
                        <span>{alertMessage.text}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAlertMessage(null)}
                        className="text-slate-400 hover:text-slate-700 font-bold ml-4 cursor-pointer"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* ========================================================================= */}
            {/* KPI STATS CARDS: BẢNG CHỈ SỐ TRẠNG THÁI TOÀN KHÁCH SẠN */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* 1. Tổng số phòng */}
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
                                Tổng số phòng
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-1">
                                <span className="text-2xl font-black text-slate-900">{stats.total}</span>
                                <span className="text-xs text-slate-500 font-medium">phòng</span>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shrink-0">
                            <Building2 className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-medium">Công suất:</span>
                            <span className="font-bold text-blue-600">{stats.occupancy_rate}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(stats.occupancy_rate, 100)}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* 2. Phòng Trống (Available) */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'available' ? 'all' : 'available')}
                    className={`rounded-2xl p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between active:scale-98 ${
                        statusFilter === 'available'
                            ? 'bg-emerald-50/70 border-emerald-400 shadow-sm ring-2 ring-emerald-500/20'
                            : 'bg-white border-slate-200/90 hover:border-emerald-300 hover:shadow-xs hover:-translate-y-0.5'
                    }`}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                                Trống (Sẵn sàng)
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-1">
                                <span className="text-2xl font-black text-emerald-800">{stats.available}</span>
                                <span className="text-xs text-emerald-600 font-medium">phòng</span>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shrink-0">
                            <DoorOpen className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-emerald-100/60">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-emerald-700 font-medium">Tỷ lệ trống:</span>
                            <span className="font-bold text-emerald-700">{Math.round((stats.available / (stats.total || 1)) * 100)}%</span>
                        </div>
                        <div className="w-full bg-emerald-100/70 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((stats.available / (stats.total || 1)) * 100)}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* 3. Có khách (Occupied) */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'occupied' ? 'all' : 'occupied')}
                    className={`rounded-2xl p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between active:scale-98 ${
                        statusFilter === 'occupied'
                            ? 'bg-rose-50/70 border-rose-400 shadow-sm ring-2 ring-rose-500/20'
                            : 'bg-white border-slate-200/90 hover:border-rose-300 hover:shadow-xs hover:-translate-y-0.5'
                    }`}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                                Đang có khách
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-1">
                                <span className="text-2xl font-black text-rose-800">{stats.occupied}</span>
                                <span className="text-xs text-rose-600 font-medium">phòng</span>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center shrink-0">
                            <UserCheck className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-rose-100/60">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-rose-700 font-medium">Đang ở:</span>
                            <span className="font-bold text-rose-700">{Math.round((stats.occupied / (stats.total || 1)) * 100)}%</span>
                        </div>
                        <div className="w-full bg-rose-100/70 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((stats.occupied / (stats.total || 1)) * 100)}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* 4. Đang dọn dẹp (Cleaning) */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'cleaning' ? 'all' : 'cleaning')}
                    className={`rounded-2xl p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between active:scale-98 ${
                        statusFilter === 'cleaning'
                            ? 'bg-amber-50/70 border-amber-400 shadow-sm ring-2 ring-amber-500/20'
                            : 'bg-white border-slate-200/90 hover:border-amber-300 hover:shadow-xs hover:-translate-y-0.5'
                    }`}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                                Đang dọn dẹp
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-1">
                                <span className="text-2xl font-black text-amber-800">{stats.cleaning}</span>
                                <span className="text-xs text-amber-600 font-medium">phòng</span>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shrink-0">
                            <Sparkles className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-amber-100/60">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-amber-700 font-medium">Chờ dọn:</span>
                            <span className="font-bold text-amber-700">{Math.round((stats.cleaning / (stats.total || 1)) * 100)}%</span>
                        </div>
                        <div className="w-full bg-amber-100/70 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((stats.cleaning / (stats.total || 1)) * 100)}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* 5. Đang bảo trì (Maintenance) */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'maintenance' ? 'all' : 'maintenance')}
                    className={`rounded-2xl p-4 border transition-all duration-200 cursor-pointer flex flex-col justify-between active:scale-98 col-span-2 sm:col-span-1 ${
                        statusFilter === 'maintenance'
                            ? 'bg-slate-100 border-slate-400 shadow-sm ring-2 ring-slate-500/20'
                            : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs hover:-translate-y-0.5'
                    }`}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                                Đang bảo trì
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-1">
                                <span className="text-2xl font-black text-slate-800">{stats.maintenance}</span>
                                <span className="text-xs text-slate-500 font-medium">phòng</span>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 border border-slate-300/80 flex items-center justify-center shrink-0">
                            <Wrench className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-600 font-medium">Sửa chữa:</span>
                            <span className="font-bold text-slate-700">{Math.round((stats.maintenance / (stats.total || 1)) * 100)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-slate-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((stats.maintenance / (stats.total || 1)) * 100)}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* THANH BỘ LỌC ĐA TIÊU CHÍ & CHẾ ĐỘ HIỂN THỊ */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200 shadow-2xs space-y-2.5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Ô tìm kiếm số phòng hoặc hạng phòng */}
                    <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Tìm số phòng (101, 204...) hoặc hạng phòng..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-24 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-600 focus:bg-white text-slate-900 transition"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-20 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <button
                            type="submit"
                            className="absolute right-1 top-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg transition cursor-pointer"
                        >
                            Tìm kiếm
                        </button>
                    </form>

                    {/* Bộ lọc dropdowns & chế độ hiển thị */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        {/* Lọc Tầng */}
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                            <span className="text-slate-500 font-semibold text-[11px]">Tầng:</span>
                            <select
                                value={floorFilter}
                                onChange={(e) => setFloorFilter(e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer py-1"
                            >
                                <option value="all">Tất cả tầng</option>
                                {floors.map((fl) => (
                                    <option key={fl} value={fl}>
                                        Tầng {fl}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Lọc Hạng Phòng */}
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                            <span className="text-slate-500 font-semibold text-[11px]">Hạng:</span>
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer py-1 max-w-[150px] truncate"
                            >
                                <option value="all">Tất cả hạng</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Lọc Trạng Thái */}
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                            <span className="text-slate-500 font-semibold text-[11px]">Trạng thái:</span>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer py-1"
                            >
                                <option value="all">Tất cả</option>
                                <option value="available">🟢 Trống</option>
                                <option value="occupied">🔴 Có khách</option>
                                <option value="cleaning">🟡 Đang dọn</option>
                                <option value="maintenance">⚪ Bảo trì</option>
                            </select>
                        </div>

                        {/* Toggle Group theo tầng */}
                        <button
                            type="button"
                            onClick={() => setGroupByFloor(!groupByFloor)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                                groupByFloor
                                    ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-2xs'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                            title="Gom nhóm hiển thị theo từng tầng hoặc trải phẳng toàn bộ"
                        >
                            <Layers className="w-3.5 h-3.5" />
                            <span>{groupByFloor ? 'Theo Tầng' : 'Trải Phẳng'}</span>
                        </button>

                        {(searchTerm || floorFilter !== 'all' || statusFilter !== 'all' || categoryFilter !== 'all') && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="px-2.5 py-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl font-bold transition text-xs cursor-pointer flex items-center gap-1"
                                title="Xóa toàn bộ bộ lọc"
                            >
                                <X className="w-3.5 h-3.5" />
                                <span>Bỏ lọc</span>
                            </button>
                        )}

                        {/* Badge đếm số lượng phòng */}
                        <div className="ml-auto flex items-center gap-2 pl-2">
                            {isLoading && rooms.length > 0 && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold animate-pulse border border-blue-100">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                                    Đang đồng bộ...
                                </span>
                            )}
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-semibold">
                                Hiển thị <strong className="text-slate-900">{rooms.length}</strong> / {stats.total} phòng
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* GRID LAYOUT: SƠ ĐỒ PHÒNG THỰC TẾ (ROOM BOARD) */}
            {/* ========================================================================= */}
            {isLoading && rooms.length === 0 ? (
                <div className="bg-white rounded-3xl p-16 border border-slate-200 text-center shadow-xs">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <span className="text-xs text-slate-500 font-bold">Đang tải sơ đồ phòng thời gian thực...</span>
                </div>
            ) : rooms.length === 0 ? (
                <div className="bg-white rounded-3xl p-16 border border-slate-200 text-center shadow-xs">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">
                        🔍
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Không tìm thấy phòng nào phù hợp</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        Vui lòng thử thay đổi số phòng tìm kiếm, chọn lại tầng hoặc làm mới bộ lọc.
                    </p>
                    <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
                    >
                        Khôi phục tất cả phòng
                    </button>
                </div>
            ) : groupByFloor ? (
                /* CHẾ ĐỘ 1: NHÓM THEO TỪNG TẦNG */
                <div className="space-y-6">
                    {floors.map((fl) => {
                        const floorRooms = groupedRooms[fl] || [];
                        if (floorRooms.length === 0) return null;

                        const floorAvailable = floorRooms.filter((r) => r.status === 'available').length;
                        const floorOccupied = floorRooms.filter((r) => r.status === 'occupied').length;

                        return (
                            <div
                                key={fl}
                                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4"
                            >
                                {/* Header của Tầng */}
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-black text-sm flex items-center justify-center shadow-xs">
                                            {fl}F
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                                                Tầng {fl} • Khu Vực Phòng Nghỉ
                                            </h3>
                                            <p className="text-[11px] text-slate-400">
                                                Tổng {floorRooms.length} phòng • {floorAvailable} trống • {floorOccupied} có khách
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
                                        Khách Sạn TA Đà Nẵng
                                    </span>
                                </div>

                                {/* Grid các Card phòng của Tầng */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
                                    {floorRooms.map((room) => (
                                        <RoomCard
                                            key={room.id}
                                            room={room}
                                            onStatusChange={handleQuickStatusChange}
                                            onEdit={handleOpenEdit}
                                            onDelete={handleOpenDelete}
                                            onOpenCheckOut={handleOpenCheckOut}
                                            onOpenAssign={handleOpenAssignModal}
                                            onViewOccupied={handleViewOccupied}
                                            onOpenMinibar={handleOpenMinibar}
                                            onOpenLostItem={handleOpenLostItem}
                                            onRequestCleaning={handleOpenMakeUpModal}
                                            onCompleteCleaning={handleCompleteCleaning}
                                            onReportMaintenance={handleOpenReportMaintenance}
                                            onCompleteMaintenance={handleOpenCompleteMaintenance}
                                            onViewHistory={(r) => {
                                                setHistoryModalRoom(r);
                                                setIsHistoryModalOpen(true);
                                            }}
                                            formatCurrency={formatCurrency}
                                            formatDate={formatDate}
                                            isLoading={quickStatusLoadingId === room.id}
                                            canUpdateRoom={canUpdateRoom}
                                            canDeleteRoom={canDeleteRoom}
                                            isManagerOrAdmin={isManagerOrAdmin}
                                            userRole={user?.role}
                                            canManageBookings={canManageBookings}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* CHẾ ĐỘ 2: TRẢI PHẲNG TẤT CẢ CÁC THẺ PHÒNG */
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
                        {rooms.map((room) => (
                            <RoomCard
                                key={room.id}
                                room={room}
                                onStatusChange={handleQuickStatusChange}
                                onEdit={handleOpenEdit}
                                onDelete={handleOpenDelete}
                                onOpenCheckOut={handleOpenCheckOut}
                                onOpenAssign={handleOpenAssignModal}
                                onViewOccupied={handleViewOccupied}
                                onOpenMinibar={handleOpenMinibar}
                                onOpenLostItem={handleOpenLostItem}
                                onRequestCleaning={handleOpenMakeUpModal}
                                onCompleteCleaning={handleCompleteCleaning}
                                onReportMaintenance={handleOpenReportMaintenance}
                                onCompleteMaintenance={handleOpenCompleteMaintenance}
                                onViewHistory={(r) => {
                                    setHistoryModalRoom(r);
                                    setIsHistoryModalOpen(true);
                                }}
                                formatCurrency={formatCurrency}
                                formatDate={formatDate}
                                isLoading={quickStatusLoadingId === room.id}
                                canUpdateRoom={canUpdateRoom}
                                canDeleteRoom={canDeleteRoom}
                                isManagerOrAdmin={isManagerOrAdmin}
                                userRole={user?.role}
                                canManageBookings={canManageBookings}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 1: THÊM PHÒNG MỚI */}
            {/* ========================================================================= */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header: Tone nền trắng trang nhã, hiện đại */}
                        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-xl font-bold shadow-xs">
                                    ＋
                                </div>
                                <div>
                                    <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                                        Thêm Phòng Mới Vào Sơ Đồ
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Khởi tạo số phòng, phân loại tầng và gắn hạng phòng tương ứng
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm"
                                title="Đóng cửa sổ"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleCreateRoom} className="p-6 space-y-4 text-xs text-slate-800 overflow-y-auto flex-1">
                            {/* Số phòng & Tầng */}
                            <div className="grid grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Số phòng thực tế <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ví dụ: 101, 204, 502"
                                        value={createFormData.room_number}
                                        onChange={(e) => setCreateFormData({ ...createFormData, room_number: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white font-bold text-slate-900 text-sm"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">Mỗi số phòng là duy nhất</span>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Vị trí Tầng <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={createFormData.floor}
                                        onChange={(e) => setCreateFormData({ ...createFormData, floor: parseInt(e.target.value) || 1 })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white font-bold text-slate-900 text-xs"
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20].map((fl) => (
                                            <option key={fl} value={fl}>
                                                Tầng {fl}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Hạng phòng */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Hạng phòng (Room Category) <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    required
                                    value={createFormData.category_id}
                                    onChange={(e) => setCreateFormData({ ...createFormData, category_id: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white font-bold text-slate-900 text-xs"
                                >
                                    <option value="" disabled>-- Chọn loại phòng --</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} ({formatCurrency(c.base_price)}/đêm - {c.bed_type})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Trạng thái khởi tạo */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1.5">
                                    Trạng thái ban đầu
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.values(ROOM_STATUSES).map((st) => (
                                        <label
                                            key={st.key}
                                            className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                                                createFormData.status === st.key
                                                    ? `${st.badgeClass} ring-2 ring-blue-500/20 font-bold`
                                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="create_status"
                                                value={st.key}
                                                checked={createFormData.status === st.key}
                                                onChange={(e) => setCreateFormData({ ...createFormData, status: e.target.value })}
                                                className="hidden"
                                            />
                                            <span className="text-sm">{st.icon}</span>
                                            <span className="text-xs truncate">{st.shortLabel}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition cursor-pointer"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
                                >
                                    {isSubmitting ? 'Đang tạo phòng...' : 'Tạo Phòng Mới'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 2: CHỈNH SỬA PHÒNG */}
            {/* ========================================================================= */}
            {isEditModalOpen && selectedRoom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header: Tone nền trắng trang nhã, hiện đại */}
                        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-xl shadow-xs">
                                    ✏️
                                </div>
                                <div>
                                    <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                                        Chỉnh Sửa Thông Tin Phòng {selectedRoom.room_number}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Cập nhật số phòng, tầng hoặc hạng phòng trong sơ đồ
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsEditModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm"
                                title="Đóng cửa sổ"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs text-slate-800 overflow-y-auto flex-1">
                            <div className="grid grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Số phòng thực tế <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={editFormData.room_number}
                                        onChange={(e) => setEditFormData({ ...editFormData, room_number: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white font-bold text-slate-900 text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Vị trí Tầng <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={editFormData.floor}
                                        onChange={(e) => setEditFormData({ ...editFormData, floor: parseInt(e.target.value) || 1 })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white font-bold text-slate-900 text-xs"
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20].map((fl) => (
                                            <option key={fl} value={fl}>
                                                Tầng {fl}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Hạng phòng (Room Category) <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    required
                                    value={editFormData.category_id}
                                    onChange={(e) => setEditFormData({ ...editFormData, category_id: e.target.value })}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white font-bold text-slate-900 text-xs"
                                >
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} ({formatCurrency(c.base_price)}/đêm - {c.bed_type})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1.5">
                                    Trạng thái phòng
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.values(ROOM_STATUSES).map((st) => (
                                        <label
                                            key={st.key}
                                            className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                                                editFormData.status === st.key
                                                    ? `${st.badgeClass} ring-2 ring-blue-500/20 font-bold`
                                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="edit_status"
                                                value={st.key}
                                                checked={editFormData.status === st.key}
                                                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                                                className="hidden"
                                            />
                                            <span className="text-sm">{st.icon}</span>
                                            <span className="text-xs truncate">{st.shortLabel}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                {canDeleteRoom && isManagerOrAdmin ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditModalOpen(false);
                                            handleOpenDelete(selectedRoom);
                                        }}
                                        className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                                    >
                                        <span>🗑️</span> Xóa phòng này
                                    </button>
                                ) : <div />}
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="px-4 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition cursor-pointer"
                                    >
                                        Hủy bỏ
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
                                    >
                                        {isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 3: XÁC NHẬN XÓA PHÒNG AN TOÀN */}
            {/* ========================================================================= */}
            {isDeleteModalOpen && selectedRoom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-3xl mx-auto shadow-inner border border-rose-200">
                                🗑️
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900">
                                    Xác Nhận Xóa Phòng {selectedRoom.room_number}?
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Hành động này sẽ xóa phòng {selectedRoom.room_number} (Tầng {selectedRoom.floor}) khỏi sơ đồ phòng của khách sạn. Thao tác không thể hoàn tác.
                                </p>
                            </div>

                            {/* Card tóm tắt phòng sắp xóa */}
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-left flex items-center justify-between">
                                <div>
                                    <div className="text-lg font-black text-slate-900">
                                        Phòng {selectedRoom.room_number}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        Tầng {selectedRoom.floor} • {selectedRoom.category_name}
                                    </div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${ROOM_STATUSES[selectedRoom.status]?.badgeClass}`}>
                                    {ROOM_STATUSES[selectedRoom.status]?.shortLabel || selectedRoom.status}
                                </span>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                >
                                    Hủy Bỏ
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/30 transition disabled:opacity-50 cursor-pointer"
                                >
                                    {isSubmitting ? 'Đang xóa...' : 'Xác Nhận Xóa'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 4: CHECK-OUT & QUYẾT TOÁN HÓA ĐƠN TRỰC TIẾP TỪ SƠ ĐỒ PHÒNG PMS */}
            {/* ========================================================================= */}
            {checkOutBooking && (
                <CheckOutModal
                    booking={checkOutBooking}
                    onClose={() => setCheckOutBooking(null)}
                    onSuccess={handleCheckOutSuccess}
                    onOpenInvoice={(inv) => {
                        setCheckOutBooking(null);
                        setInvoiceModalBooking(inv);
                    }}
                />
            )}

            {/* ========================================================================= */}
            {/* MODAL 5: XEM & IN HÓA ĐƠN VOUCHER CHECK-IN / CHECK-OUT */}
            {/* ========================================================================= */}
            {invoiceModalBooking && (
                <HotelInvoiceModal
                    booking={invoiceModalBooking}
                    onClose={() => setInvoiceModalBooking(null)}
                />
            )}

            {/* ========================================================================= */}
            {/* MODAL 6: CHI TIẾT PHÒNG ĐANG CÓ KHÁCH LƯU TRÚ (OCCUPIED DETAIL) */}
            {/* ========================================================================= */}
            {selectedOccupiedRoom && selectedOccupiedRoom.current_booking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-2xl font-bold shadow-xs">
                                    🏨
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-lg text-slate-900 tracking-tight">
                                            Phòng {selectedOccupiedRoom.room_number}
                                        </h3>
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                            🔴 Đang lưu trú
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Tầng {selectedOccupiedRoom.floor} • {selectedOccupiedRoom.category_name} ({formatCurrency(selectedOccupiedRoom.category_base_price)}/đêm)
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedOccupiedRoom(null)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm"
                                title="Đóng cửa sổ"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
                            {/* Card 1: Khách hàng */}
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                                    <span className="font-bold uppercase text-[10px] text-slate-400 tracking-wider">
                                        Hồ sơ khách hàng
                                    </span>
                                    {selectedOccupiedRoom.current_booking.guest_id && (
                                        <button
                                            type="button"
                                            onClick={() => handleGoToCustomer(selectedOccupiedRoom.current_booking.guest_id)}
                                            className="text-blue-600 hover:text-blue-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                        >
                                            <span>Xem hồ sơ CRM ➔</span>
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-slate-800">
                                    <div>
                                        <span className="text-[10px] text-slate-400 block">Họ và tên:</span>
                                        <span className="font-bold text-sm text-slate-900">
                                            {selectedOccupiedRoom.current_booking.guest_name}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 block">Số điện thoại:</span>
                                        <span className="font-bold text-slate-900">
                                            {selectedOccupiedRoom.current_booking.guest_phone || '—'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 block">Email:</span>
                                        <span className="font-medium text-slate-700 truncate block">
                                            {selectedOccupiedRoom.current_booking.guest_email || '—'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 block">CCCD / Hộ chiếu:</span>
                                        <span className="font-mono font-bold text-slate-900">
                                            {selectedOccupiedRoom.current_booking.identity_card || 'Chưa cập nhật'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Thông tin Đặt phòng */}
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                                    <span className="font-bold uppercase text-[10px] text-slate-400 tracking-wider">
                                        Thông tin lưu trú & Booking
                                    </span>
                                    <span className="font-mono font-bold text-xs bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-300">
                                        #{selectedOccupiedRoom.current_booking.booking_code}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-slate-800">
                                    <div>
                                        <span className="text-[10px] text-slate-400 block">Ngày nhận (Check-in):</span>
                                        <span className="font-bold text-slate-900">
                                            {formatDate(selectedOccupiedRoom.current_booking.check_in_date)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 block">Ngày trả (Check-out):</span>
                                        <span className="font-bold text-rose-700">
                                            {formatDate(selectedOccupiedRoom.current_booking.check_out_date)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 block">Check-in thực tế:</span>
                                        <span className="font-medium text-slate-700">
                                            {formatDateTime(selectedOccupiedRoom.current_booking.actual_check_in)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 block">Tổng tiền phòng:</span>
                                        <span className="font-black text-sm text-emerald-700">
                                            {formatCurrency(selectedOccupiedRoom.current_booking.total_amount)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={handleGoToBookings}
                                className="px-3 py-2 text-slate-600 hover:text-blue-700 font-bold text-xs rounded-xl hover:bg-slate-200/60 transition flex items-center gap-1.5 cursor-pointer"
                                title="Đi tới trang Quản lý Đặt phòng"
                            >
                                <span>📋</span>
                                <span>Quản lý Đặt phòng</span>
                            </button>
                            {canManageBookings && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const currentRoom = selectedOccupiedRoom;
                                            const b = selectedOccupiedRoom.current_booking;
                                            setSelectedOccupiedRoom(null);
                                            handleOpenChangeRoom({
                                                room: currentRoom,
                                                booking: b,
                                                reason: '',
                                            });
                                        }}
                                        className="px-3.5 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 text-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                                        title="Chuyển khách sang phòng trống mới"
                                    >
                                        <span>🔄</span>
                                        <span>Đổi phòng</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const b = selectedOccupiedRoom.current_booking;
                                            setSelectedOccupiedRoom(null);
                                            setCheckOutBooking(b);
                                        }}
                                        className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold rounded-xl shadow-md shadow-rose-600/20 text-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                                        title="Thực hiện thủ tục Check-out trả phòng"
                                    >
                                        <span>🧾</span>
                                        <span>Check-out</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 7: GÁN PHÒNG & CHECK-IN ĐÓN KHÁCH (ROOM ASSIGNMENT MODAL) */}
            {/* ========================================================================= */}
            {assignModalRoom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-2xl font-bold shadow-xs">
                                    🔑
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-lg text-slate-900 tracking-tight">
                                            Gán Phòng {assignModalRoom.room_number} & Check-in Đón Khách
                                        </h3>
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                            🟢 Sẵn sàng đón khách
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Tầng {assignModalRoom.floor} • Hạng phòng: {assignModalRoom.category_name} ({formatCurrency(assignModalRoom.category_base_price)}/đêm)
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAssignModalRoom(null)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm"
                                title="Đóng cửa sổ"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Thanh tìm kiếm & Bộ lọc cùng hạng phòng */}
                        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                {/* Search input */}
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        placeholder="Tìm kiếm theo tên khách, số điện thoại hoặc mã đơn..."
                                        value={assignSearchTerm}
                                        onChange={(e) => setAssignSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-600 text-slate-900"
                                    />
                                    <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
                                </div>

                                {/* Filter tabs */}
                                <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setAssignFilterMode('match_category')}
                                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-[11px] ${
                                            assignFilterMode === 'match_category'
                                                ? 'bg-white text-emerald-800 font-bold shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Cùng hạng phòng
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAssignFilterMode('all')}
                                        className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-[11px] ${
                                            assignFilterMode === 'all'
                                                ? 'bg-white text-blue-800 font-bold shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Tất cả đơn chờ nhận
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Danh sách các đơn chờ nhận phòng */}
                        <div className="p-6 space-y-3 text-xs overflow-y-auto flex-1">
                            {isLoadingEligible ? (
                                <div className="py-12 text-center">
                                    <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                    <span className="text-slate-500 font-medium">Đang tải danh sách đơn đặt phòng chờ nhận...</span>
                                </div>
                            ) : filteredEligibleBookings.length === 0 ? (
                                <div className="py-12 text-center space-y-3">
                                    <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center text-2xl mx-auto">
                                        📭
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">
                                            {assignFilterMode === 'match_category'
                                                ? `Không có đơn nào thuộc hạng "${assignModalRoom.category_name}" đang chờ nhận phòng.`
                                                : 'Không tìm thấy đơn đặt phòng nào phù hợp.'}
                                        </h4>
                                        <p className="text-slate-500 text-xs mt-1">
                                            Bạn có thể thử chuyển sang xem "Tất cả đơn chờ nhận" hoặc tiếp đón khách vãng lai (Walk-in).
                                        </p>
                                    </div>
                                    {assignFilterMode === 'match_category' && (
                                        <button
                                            type="button"
                                            onClick={() => setAssignFilterMode('all')}
                                            className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-bold text-xs transition cursor-pointer"
                                        >
                                            Hiển thị tất cả đơn chờ nhận phòng ➔
                                        </button>
                                    )}
                                </div>
                            ) : (
                                filteredEligibleBookings.map((b) => {
                                    const isCatMatch =
                                        String(b.category?.id || b.category_id || b.room?.category?.id) ===
                                            String(assignModalRoom.category?.id || assignModalRoom.category_id) ||
                                        (b.category_name || b.room_type || '').toLowerCase() === (assignModalRoom.category_name || '').toLowerCase();

                                    const todayStr = new Date().toISOString().split('T')[0];
                                    const bookingCheckInStr = b.check_in_date ? String(b.check_in_date).split('T')[0] : '';
                                    const bookingCheckOutStr = b.check_out_date ? String(b.check_out_date).split('T')[0] : '';
                                    const isExpired = Boolean(bookingCheckOutStr && bookingCheckOutStr <= todayStr);
                                    const isEarly = Boolean(!isExpired && bookingCheckInStr && bookingCheckInStr > todayStr);
                                    const isLate = Boolean(!isExpired && bookingCheckInStr && bookingCheckInStr < todayStr);
                                    let earlyDays = 0;
                                    let lateDays = 0;
                                    if (isEarly) {
                                        const d1 = new Date(bookingCheckInStr);
                                        const d2 = new Date(todayStr);
                                        d1.setHours(0, 0, 0, 0);
                                        d2.setHours(0, 0, 0, 0);
                                        earlyDays = Math.max(1, Math.round((d1 - d2) / (1000 * 60 * 60 * 24)));
                                    } else if (isLate) {
                                        const d1 = new Date(todayStr);
                                        const d2 = new Date(bookingCheckInStr);
                                        d1.setHours(0, 0, 0, 0);
                                        d2.setHours(0, 0, 0, 0);
                                        lateDays = Math.max(1, Math.round((d1 - d2) / (1000 * 60 * 60 * 24)));
                                    }

                                    return (
                                        <div
                                            key={b.id}
                                            className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                                isExpired
                                                    ? 'bg-rose-50/40 border-rose-200'
                                                    : isEarly
                                                    ? 'bg-amber-50/40 hover:bg-amber-50 border-amber-200'
                                                    : isLate
                                                    ? 'bg-orange-50/40 hover:bg-orange-50 border-orange-200'
                                                    : isCatMatch
                                                    ? 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200'
                                                    : 'bg-white hover:bg-slate-50 border-slate-200'
                                            }`}
                                        >
                                            <div className="space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-black text-sm text-slate-900">
                                                        {b.guest_name}
                                                    </span>
                                                    <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                        #{b.booking_code}
                                                    </span>
                                                    {isExpired && (
                                                        <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300 flex items-center gap-1">
                                                            ⛔ Quá hạn trả
                                                        </span>
                                                    )}
                                                    {isEarly && (
                                                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1">
                                                            ⚡ Sớm {earlyDays} ngày
                                                        </span>
                                                    )}
                                                    {isLate && (
                                                        <span className="text-[10px] font-bold text-orange-800 bg-orange-100 px-2.5 py-0.5 rounded-full border border-orange-300 flex items-center gap-1">
                                                            ⏰ Trễ {lateDays} ngày
                                                        </span>
                                                    )}
                                                    {isCatMatch ? (
                                                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                                                            ✓ Đúng hạng phòng
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                                            Hạng đặt: {b.category_name || b.room_type || 'Khác'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3 text-slate-500 text-[11px]">
                                                    <span>📞 {b.guest_phone || '—'}</span>
                                                    <span>•</span>
                                                    <span>
                                                        📅 {formatDate(b.check_in_date)} ➔ {formatDate(b.check_out_date)}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="font-bold text-slate-700">
                                                        {formatCurrency(b.total_amount)}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                disabled={isSubmittingAssignCheckIn || isExpired}
                                                onClick={() => handleConfirmAssignCheckIn(b)}
                                                className={`px-4 py-2 font-bold rounded-xl text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 text-white ${
                                                    isExpired
                                                        ? 'bg-slate-400 cursor-not-allowed'
                                                        : isEarly
                                                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                                                        : isLate
                                                        ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-600/20'
                                                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                                                }`}
                                            >
                                                <span>{isExpired ? '⛔' : isEarly ? '⚡' : isLate ? '⏰' : '🔑'}</span>
                                                <span>
                                                    {isExpired
                                                        ? 'Quá hạn lưu trú'
                                                        : isEarly
                                                        ? `Check-in sớm (${earlyDays}N)`
                                                        : isLate
                                                        ? `Check-in trễ (${lateDays}N)`
                                                        : 'Gán phòng & Check-in ngay'}
                                                </span>
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={handleGoToBookings}
                                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                            >
                                <span>📋 Đi tới Quản lý Đặt phòng</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setAssignModalRoom(null)}
                                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition cursor-pointer text-xs"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL CẢNH BÁO NHẬN PHÒNG SỚM / TRỄ (MODERN WHITE MODAL) */}
            {/* ========================================================================= */}
            {checkInWarningModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-2xl max-w-md w-full border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3.5">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-xl font-bold ${
                                checkInWarningModal.type === 'early' 
                                    ? 'bg-amber-100 text-amber-600' 
                                    : 'bg-indigo-100 text-indigo-600'
                            }`}>
                                {checkInWarningModal.type === 'early' ? '⚡' : '⏰'}
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-800 tracking-tight">
                                    {checkInWarningModal.type === 'early' ? 'Cảnh Báo Nhận Phòng Sớm' : 'Cảnh Báo Nhận Phòng Trễ'}
                                </h3>
                                <p className="text-xs font-semibold text-slate-400">
                                    {checkInWarningModal.type === 'early' ? 'Early Check-in Confirmation' : 'Late Check-in Confirmation'}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                            <div className="flex justify-between items-center text-slate-600">
                                <span className="font-medium">Khách hàng:</span>
                                <span className="font-bold text-slate-800">{checkInWarningModal.booking.guest_name}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-600">
                                <span className="font-medium">Mã đặt phòng:</span>
                                <span className="font-mono font-bold text-slate-800">#{checkInWarningModal.booking.booking_code}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-600">
                                <span className="font-medium">Lịch đặt ban đầu:</span>
                                <span className="font-bold text-slate-800">{formatDate(checkInWarningModal.booking.check_in_date)}</span>
                            </div>
                            {checkInWarningModal.type === 'early' ? (
                                <div className="flex justify-between items-center text-amber-700 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 font-medium">
                                    <span>Đến sớm:</span>
                                    <span className="font-black text-amber-800">{checkInWarningModal.earlyDays} ngày (Nhận hôm nay)</span>
                                </div>
                            ) : (
                                <div className="flex justify-between items-center text-indigo-700 bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-200 font-medium">
                                    <span>Đến trễ:</span>
                                    <span className="font-black text-indigo-800">{checkInWarningModal.lateDays} ngày (Ở lại {checkInWarningModal.remainingNights} đêm)</span>
                                </div>
                            )}
                        </div>

                        <div className="text-xs text-slate-600 leading-relaxed bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                            {checkInWarningModal.type === 'early' ? (
                                <span>💡 Hệ thống sẽ chuyển ngày bắt đầu lưu trú sang hôm nay <b>({formatDate(checkInWarningModal.todayStr)})</b> và tự động tính thêm phụ phí cho <b>{checkInWarningModal.earlyDays} đêm</b> ở sớm.</span>
                            ) : (
                                <span>💡 Khách sẽ nhận phòng ở <b>{checkInWarningModal.remainingNights} đêm</b> còn lại đến ngày <b>{formatDate(checkInWarningModal.booking.check_out_date)}</b>.</span>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                disabled={isSubmittingAssignCheckIn}
                                onClick={() => setCheckInWarningModal(null)}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                            >
                                Hủy Bỏ
                            </button>
                            <button
                                type="button"
                                disabled={isSubmittingAssignCheckIn}
                                onClick={() => executeAssignCheckIn(
                                    checkInWarningModal.booking,
                                    checkInWarningModal.confirmEarly,
                                    checkInWarningModal.applyCharge,
                                    checkInWarningModal.confirmLate,
                                    checkInWarningModal.isEarly,
                                    checkInWarningModal.isLate,
                                    checkInWarningModal.earlyDays,
                                    checkInWarningModal.lateDays
                                )}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-1.5"
                            >
                                {isSubmittingAssignCheckIn ? (
                                    <>
                                        <span className="animate-spin text-sm">⏳</span>
                                        <span>Đang xử lý...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>✓</span>
                                        <span>Xác Nhận Check-In</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL 5: BÁO HỎNG & NGHIỆM THU BẢO TRÌ THIẾT BỊ PHÒNG */}
            {/* ========================================================================= */}
            <MaintenanceModal
                isOpen={maintenanceModalData.isOpen}
                onClose={() => setMaintenanceModalData((prev) => ({ ...prev, isOpen: false }))}
                room={maintenanceModalData.room}
                mode={maintenanceModalData.mode}
                ticket={maintenanceModalData.ticket}
                onSuccess={handleMaintenanceSuccess}
                onOpenChangeRoom={handleOpenChangeRoom}
            />

            {/* ========================================================================= */}
            {/* MODAL 6: ĐỔI PHÒNG CHO KHÁCH LƯU TRÚ (ROOM MOVE) */}
            {/* ========================================================================= */}
            {changeRoomModalData.isOpen && (
                <ChangeRoomModal
                    isOpen={changeRoomModalData.isOpen}
                    onClose={() => setChangeRoomModalData((prev) => ({ ...prev, isOpen: false }))}
                    room={changeRoomModalData.room}
                    booking={changeRoomModalData.booking}
                    initialReason={changeRoomModalData.reason}
                    initialEquipment={changeRoomModalData.equipment}
                    initialIssueType={changeRoomModalData.issueType}
                    onSuccess={handleChangeRoomSuccess}
                />
            )}

            {/* ========================================================================= */}
            {/* MODAL 7: LỊCH SỬ BẢO TRÌ & SỬA CHỮA THIẾT BỊ TOÀN KHÁCH SẠN */}
            {/* ========================================================================= */}
            <MaintenanceHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => {
                    setIsHistoryModalOpen(false);
                    setHistoryModalRoom(null);
                }}
                filterRoomId={historyModalRoom?.id || null}
                filterRoomNumber={historyModalRoom?.room_number || null}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
            />

            {/* ========================================================================= */}
            {/* MODAL 8: KIỂM KÊ MINIBAR TRONG PHÒNG */}
            {/* ========================================================================= */}
            <MinibarModal
                isOpen={minibarModalData.isOpen}
                onClose={() => setMinibarModalData({ isOpen: false, room: null })}
                room={minibarModalData.room}
                onSuccess={(res) => {
                    setAlertMessage({
                        type: 'success',
                        text: res.message || 'Kiểm kê Minibar thành công!',
                    });
                    fetchRooms(true);
                    setTimeout(() => setAlertMessage(null), 3500);
                }}
            />

            {/* ========================================================================= */}
            {/* MODAL 9: BÁO ĐỒ THẤT LẠC (LOST & FOUND) */}
            {/* ========================================================================= */}
            <ReportLostItemModal
                isOpen={lostItemModalData.isOpen}
                onClose={() => setLostItemModalData({ isOpen: false, room: null })}
                room={lostItemModalData.room}
                onSuccess={(res) => {
                    setAlertMessage({
                        type: 'success',
                        text: res.message || 'Đã ghi nhận đồ thất lạc thành công!',
                    });
                    setTimeout(() => setAlertMessage(null), 3500);
                }}
            />

            {/* ========================================================================= */}
            {/* MODAL 10: YÊU CẦU DỌN PHÒNG LƯU TRÚ (MAKE-UP ROOM) */}
            {/* ========================================================================= */}
            {makeUpModalRoom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div
                        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white text-slate-900">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-xl shadow-xs">
                                    🧹
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-slate-900 tracking-tight">
                                        Yêu Cầu Dọn Phòng {makeUpModalRoom.room_number}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Dọn dẹp phòng lưu trú (Make-up room) cho khách đang ở
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMakeUpModalRoom(null)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleConfirmRequestCleaning} className="p-6 space-y-4 text-xs">
                            <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-1.5">
                                <div className="flex justify-between items-center text-slate-600">
                                    <span>Khách lưu trú:</span>
                                    <span className="font-bold text-slate-900">
                                        {makeUpModalRoom.current_booking?.guest_name || 'Khách lưu trú'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-slate-600">
                                    <span>Mã đặt phòng:</span>
                                    <span className="font-mono font-bold text-blue-700">
                                        #{makeUpModalRoom.current_booking?.booking_code || 'BK'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-slate-600">
                                    <span>Trạng thái phòng:</span>
                                    <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                        ● Có khách (Bảo lưu dữ liệu phòng)
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Ghi chú yêu cầu của khách
                                </label>
                                <textarea
                                    rows={3}
                                    value={makeUpNote}
                                    onChange={(e) => setMakeUpNote(e.target.value)}
                                    placeholder="VD: Khách nhờ thay ga gối, bổ sung 2 khăn tắm và dọn rác..."
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white text-slate-800 text-xs font-medium"
                                />
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {[
                                        'Dọn phòng tổng quát',
                                        'Thay ga gối & khăn tắm',
                                        'Bổ sung nước uống & đồ dùng',
                                        'Dọn rác & hút bụi'
                                    ].map((quickText) => (
                                        <button
                                            key={quickText}
                                            type="button"
                                            onClick={() => setMakeUpNote(quickText)}
                                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-medium transition cursor-pointer"
                                        >
                                            + {quickText}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setMakeUpModalRoom(null)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingMakeUp}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition cursor-pointer flex items-center gap-1.5"
                                >
                                    {isSubmittingMakeUp ? 'Đang gửi...' : '🧹 Gửi Yêu Cầu Buồng Phòng'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// =========================================================================
// THẺ PHÒNG (ROOM CARD) - THIẾT KẾ GRID LAYOUT CHUẨN 5 SAO PMS
// =========================================================================
function RoomCard({
    room,
    onStatusChange,
    onEdit,
    onDelete,
    onOpenCheckOut,
    onOpenAssign,
    onViewOccupied,
    onOpenMinibar,
    onOpenLostItem,
    onRequestCleaning,
    onCompleteCleaning,
    onReportMaintenance,
    onCompleteMaintenance,
    onViewHistory,
    formatCurrency,
    formatDate,
    isLoading,
    canUpdateRoom = true,
    canDeleteRoom = false,
    isManagerOrAdmin = false,
    userRole = '',
    canManageBookings = false
}) {
    const statusConfig = ROOM_STATUSES[room.status] || ROOM_STATUSES.available;
    const currentBk = room.current_booking;
    const isCheckMatchCurrentBooking = !room.latest_minibar_check?.booking_id || !currentBk?.id || String(room.latest_minibar_check.booking_id) === String(currentBk.id);
    const isInspectionRequested = isCheckMatchCurrentBooking && room.latest_minibar_check?.status === 'requested';
    const isInspectionCompleted = isCheckMatchCurrentBooking && room.latest_minibar_check?.status === 'completed' && room.status === 'occupied';

    // Phân quyền chuyên trách theo vai trò vận hành PMS:
    // 1. Minibar: Buồng phòng, Lễ tân, Quản lý, Admin (Kỹ thuật & Phục vụ không có)
    const canAccessMinibar = !['technician', 'service_staff', 'cashier'].includes(userRole);

    // 2. Báo đồ bỏ quên: Buồng phòng, Phục vụ phòng (Room Service), Kỹ thuật viên, Lễ tân, Quản lý, Admin
    const canReportLostItem = !['cashier'].includes(userRole);

    // 3. Đã dọn xong -> Sẵn sàng: CHỈ Buồng phòng, Quản lý, Admin (Lễ tân chỉ theo dõi, không tự ý duyệt phòng sạch)
    const canMarkCleaned = ['housekeeper', 'manager', 'owner', 'admin'].includes(userRole) || isManagerOrAdmin;

    // 4. Báo hỏng thiết bị: Buồng phòng, Phục vụ, Kỹ thuật viên, Lễ tân, Quản lý, Admin
    const canReportMaintenance = !['cashier'].includes(userRole);

    // 5. Sửa xong -> Nghiệm thu & Bàn giao dọn: Kỹ thuật viên, Quản lý, Admin
    const canCompleteMaintenance = ['technician', 'admin', 'owner', 'manager'].includes(userRole);

    // 6. Dropdown đổi trạng thái phòng thủ công:
    // - Buồng phòng: Chỉ đổi giữa Trống (available) và Đang dọn (cleaning)
    // - Lễ tân, Quản lý, Admin: Toàn quyền
    // - Kỹ thuật viên, Phục vụ, Thu ngân: KHÔNG ĐƯỢC ĐỔI (Không hiển thị dropdown)
    const canUseStatusDropdown = canUpdateRoom && !['technician', 'service_staff', 'cashier'].includes(userRole);

    return (
        <div
            className={`relative rounded-2xl border-2 p-3.5 flex flex-col justify-between transition-all duration-200 group ${statusConfig.cardClass} ${
                isInspectionRequested ? 'ring-3 ring-amber-500 ring-offset-2 border-amber-500 shadow-md' : ''
            }`}
        >
            {/* Loading Overlay khi đang đổi trạng thái */}
            {isLoading && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-xs rounded-2xl flex items-center justify-center z-20">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}

            {/* Top row: Số phòng to rõ & Badge tầng / thao tác */}
            <div>
                <div className="flex items-start justify-between gap-1 mb-1">
                    {/* Số phòng to rõ */}
                    <div className="flex items-baseline gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">P.</span>
                        <span className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-none">
                            {room.room_number}
                        </span>
                    </div>

                    {/* Badge tầng & Menu Sửa / Báo hỏng */}
                    <div className="flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded-md bg-white/80 border border-slate-200/80 text-[10px] font-bold text-slate-600 shadow-2xs">
                            {room.floor}F
                        </span>
                        {/* Nút Báo hỏng thiết bị (khi phòng chưa ở trạng thái bảo trì) */}
                        {room.status !== 'maintenance' && canReportMaintenance && onReportMaintenance && (
                            <button
                                type="button"
                                onClick={() => onReportMaintenance(room)}
                                className="w-6 h-6 rounded-md hover:bg-amber-100 text-slate-400 hover:text-amber-700 flex items-center justify-center text-xs transition cursor-pointer opacity-80 group-hover:opacity-100"
                                title="Báo hỏng thiết bị & Đưa vào bảo trì"
                            >
                                <Wrench className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {isManagerOrAdmin && (
                            <button
                                type="button"
                                onClick={() => onEdit(room)}
                                className="w-6 h-6 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-700 flex items-center justify-center text-xs transition cursor-pointer opacity-80 group-hover:opacity-100"
                                title="Chỉnh sửa thông tin phòng"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Tên hạng phòng */}
                <div className="min-h-[30px]">
                    <h4
                        className="font-bold text-xs text-slate-800 line-clamp-1 leading-tight"
                        title={room.category_name}
                    >
                        {room.category_name}
                    </h4>
                    <span className="text-[10px] text-slate-500 font-medium block">
                        {room.category_bed_type || '1 Giường King'}
                    </span>
                </div>
            </div>

            {/* Giá cơ bản & Trạng thái badge */}
            <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-900">
                    {formatCurrency(room.category_base_price)}
                    <span className="text-[9px] font-normal text-slate-500">/đêm</span>
                </span>

                {/* Trạng thái hiện tại badge */}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusConfig.badgeClass} flex items-center gap-1`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.indicatorColor}`}></span>
                    <span>{statusConfig.shortLabel}</span>
                </span>
            </div>

            {/* ========================================================================= */}
            {/* THÔNG TIN KHÁCH LƯU TRÚ (DÀNH CHO PHÒNG OCCUPIED) */}
            {/* ========================================================================= */}
            {room.status === 'occupied' && (
                <div className="mt-2 p-2 rounded-xl bg-white/95 border border-rose-200/90 shadow-2xs space-y-1">
                    {currentBk ? (
                        <>
                            <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-xs text-slate-900 truncate flex items-center gap-1.5" title={currentBk.guest_name}>
                                    <UserCheck className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                    <span className="truncate">{currentBk.guest_name}</span>
                                </span>
                                <span className="text-[9px] font-mono font-bold text-rose-700 bg-rose-50 px-1 rounded border border-rose-200 shrink-0">
                                    #{currentBk.booking_code}
                                </span>
                            </div>
                            <div className="text-[10px] text-slate-600 flex items-center justify-between pt-0.5">
                                <span className="text-slate-400">Trả phòng:</span>
                                <span className="font-semibold text-rose-700">
                                    {formatDate(currentBk.check_out_date)}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="text-[11px] text-slate-600 italic">
                            Khách lưu trú vãng lai
                        </div>
                    )}
                </div>
            )}

            {/* THÔNG TIN BỔ SUNG CHO PHÒNG TRỐNG (AVAILABLE) ĐỂ CÂN BẰNG CHIỀU CAO CARD */}
            {room.status === 'available' && (
                <div className="mt-2 p-1.5 px-2 rounded-xl bg-emerald-50/50 border border-emerald-200/50 text-[10px] text-emerald-800 flex items-center justify-between font-medium">
                    <span className="flex items-center gap-1.5">
                        <KeyRound className="w-3 h-3 text-emerald-600" />
                        <span>Sẵn sàng đón khách</span>
                    </span>
                    <span className="font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded text-[9px]">Sạch</span>
                </div>
            )}

            {/* ========================================================================= */}
            {/* THÔNG BÁO LỄ TÂN ĐỢI KIỂM TRA PHÒNG CHECK-OUT (MINIBAR & HƯ HẠI)           */}
            {/* ========================================================================= */}
            {isInspectionRequested && (
                <div className="mt-2 p-2 rounded-xl bg-amber-500/10 border-2 border-amber-500 shadow-xs space-y-1.5 animate-in fade-in">
                    <div className="flex items-center justify-between text-[10px] font-black text-amber-900">
                        <span className="flex items-center gap-1">🛎️ LỄ TÂN ĐỢI KIỂM PHÒNG</span>
                        <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded text-[9px] font-mono tracking-wider animate-pulse">CHECK-OUT</span>
                    </div>
                    <p className="text-[10px] text-amber-950 font-medium leading-tight">
                        Lễ tân đang đợi kiểm Minibar & Hư hại để quyết toán.
                    </p>
                    {canAccessMinibar && onOpenMinibar && (
                        <button
                            type="button"
                            onClick={() => onOpenMinibar(room)}
                            className="w-full py-1.5 px-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-[10px] font-bold rounded-lg shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <span>🔍</span>
                            <span>Kiểm tra phòng Check-out</span>
                        </button>
                    )}
                </div>
            )}

            {isInspectionCompleted && (
                <div className="mt-1.5 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800 flex items-center justify-between font-semibold">
                    <span>✓ Đã kiểm phòng</span>
                    <span className="font-mono font-bold text-emerald-900">
                        {room.latest_minibar_check.total_amount > 0 ? formatCurrency(room.latest_minibar_check.total_amount) : 'Nguyên vẹn'}
                    </span>
                </div>
            )}

            {/* THÔNG BÁO KHÁCH ĐANG Ở YÊU CẦU DỌN PHÒNG LƯU TRÚ (MAKE-UP ROOM) */}
            {room.status === 'occupied' && room.is_cleaning_requested && (
                <div className="mt-2 p-2 rounded-xl bg-blue-500/10 border-2 border-blue-500 shadow-xs space-y-1.5 animate-in fade-in">
                    <div className="flex items-center justify-between text-[10px] font-black text-blue-900">
                        <span className="flex items-center gap-1">🧹 YÊU CẦU DỌN PHÒNG</span>
                        <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded text-[9px] font-mono tracking-wider animate-pulse">MAKE-UP</span>
                    </div>
                    <p className="text-[10px] text-blue-950 font-medium leading-tight">
                        {room.cleaning_request_note || 'Khách yêu cầu dọn phòng lưu trú'}
                    </p>
                    <button
                        type="button"
                        onClick={() => onCompleteCleaning && onCompleteCleaning(room)}
                        className="w-full py-1.5 px-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[10px] font-bold rounded-lg shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Xác nhận buồng phòng đã dọn dẹp xong cho khách đang ở"
                    >
                        <span>✓</span>
                        <span>Xác nhận đã dọn xong</span>
                    </button>
                </div>
            )}

            {/* ========================================================================= */}
            {/* THÔNG TIN BẢO TRÌ THIẾT BỊ (DÀNH CHO PHÒNG MAINTENANCE) */}
            {/* ========================================================================= */}
            {room.status === 'maintenance' && (
                <div className="mt-2 p-2 rounded-xl bg-amber-50/80 border border-amber-200 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-[11px] text-amber-900 truncate flex items-center gap-1" title={room.active_maintenance?.equipment_name || 'Đang bảo trì'}>
                            <span>🛠️</span>
                            <span className="truncate">{room.active_maintenance?.equipment_name || 'Đang bảo trì'}</span>
                        </span>
                        {room.active_maintenance?.ticket_code && (
                            <span className="text-[9px] font-mono font-bold text-amber-800 bg-white px-1 rounded border border-amber-300 shrink-0">
                                #{room.active_maintenance.ticket_code}
                            </span>
                        )}
                    </div>
                    {(room.active_maintenance?.issue_type_display || room.active_maintenance?.issue_type) && (
                        <div className="text-[10px] text-slate-600 line-clamp-1" title={room.active_maintenance.issue_type_display || ISSUE_TYPE_MAP[room.active_maintenance.issue_type] || room.active_maintenance.issue_type}>
                            Lỗi: <span className="font-semibold text-slate-700">{room.active_maintenance.issue_type_display || ISSUE_TYPE_MAP[room.active_maintenance.issue_type] || room.active_maintenance.issue_type}</span>
                        </div>
                    )}
                    {room.active_maintenance?.is_guest_fault && (
                        <div className="inline-block text-[9px] font-bold text-rose-700 bg-rose-100/80 px-1.5 py-0.2 rounded border border-rose-300">
                            ⚠️ Khách làm hỏng
                        </div>
                    )}
                    {onViewHistory && (
                        <button
                            type="button"
                            onClick={() => onViewHistory(room)}
                            className="w-full text-center text-[10px] text-amber-800 hover:text-amber-950 font-bold underline pt-1 cursor-pointer block"
                            title={`Xem toàn bộ lịch sử sửa chữa phòng ${room.room_number}`}
                        >
                            📋 Xem nhật ký sửa phòng {room.room_number}
                        </button>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* THÔNG TIN PHÒNG ĐANG DỌN (DÀNH CHO PHÒNG CLEANING) */}
            {/* ========================================================================= */}
            {room.status === 'cleaning' && (room.recent_booking || room.latest_minibar_check) && (
                <div className="mt-2 p-2 rounded-xl bg-amber-50/80 border border-amber-200 shadow-2xs space-y-1 text-[10px]">
                    {room.recent_booking && (
                        <div className="flex items-center justify-between gap-1 font-bold text-amber-900 truncate">
                            <span className="truncate" title={room.recent_booking.guest_name}>👤 {room.recent_booking.guest_name}</span>
                            <span className="font-mono text-[9px] text-amber-800 bg-white px-1 rounded border border-amber-300 shrink-0">
                                #{room.recent_booking.booking_code}
                            </span>
                        </div>
                    )}
                    {room.latest_minibar_check && (
                        <div className="flex items-center justify-between text-[10px] text-amber-800 font-semibold pt-0.5 border-t border-amber-200/60">
                            <span className="text-amber-700">🍾 Tiêu thụ Minibar:</span>
                            <strong className="text-amber-900 font-bold">{formatCurrency(room.latest_minibar_check.total_amount)}</strong>
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* CÁC NÚT THAO TÁC NGHIỆP VỤ PMS (CHECK-IN / CHECK-OUT / DỌN DẸP / BẢO TRÌ) */}
            {/* ========================================================================= */}
            <div className="mt-2.5 space-y-1.5">
                {/* 1. Nút cho phòng Occupied: Check-out trực tiếp & Tiện ích buồng phòng */}
                {room.status === 'occupied' && (() => {
                    const showCleaningBtn = !room.is_cleaning_requested && Boolean(onRequestCleaning);
                    const showMinibarBtn = canAccessMinibar && Boolean(onOpenMinibar);
                    const showLostItemBtn = canReportLostItem && Boolean(onOpenLostItem);
                    const activeCount = [Boolean(currentBk), showCleaningBtn, showMinibarBtn, showLostItemBtn].filter(Boolean).length;
                    const gridColsClass = activeCount === 4 ? 'grid-cols-4' : activeCount === 3 ? 'grid-cols-3' : activeCount === 2 ? 'grid-cols-2' : 'grid-cols-1';

                    return (
                        <div className="space-y-1.5">
                            {canManageBookings && (
                                <button
                                    type="button"
                                    onClick={() => onOpenCheckOut(room)}
                                    className="w-full py-1.5 px-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-[10px] font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                                    title="Thực hiện thủ tục Check-out & Lập Hóa Đơn Quyết Toán"
                                >
                                    <Receipt className="w-3.5 h-3.5" />
                                    <span className="truncate whitespace-nowrap">Trả phòng & Quyết toán</span>
                                </button>
                            )}

                            {/* Hàng 2: Cụm tiện ích phụ thu gọn chuẩn PMS */}
                            {activeCount > 0 && (
                                <div className={`grid ${gridColsClass} gap-1`}>
                                    {currentBk && (
                                        <button
                                            type="button"
                                            onClick={() => onViewOccupied(room)}
                                            className="py-1 px-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-semibold rounded-lg transition flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-2xs hover:border-slate-300"
                                            title="Xem đầy đủ hồ sơ khách & thông tin lưu trú"
                                        >
                                            <Eye className="w-3.5 h-3.5 text-slate-600" />
                                            <span className="text-[9px] font-medium leading-none">Khách</span>
                                        </button>
                                    )}
                                    {showCleaningBtn && (
                                        <button
                                            type="button"
                                            onClick={() => onRequestCleaning(room)}
                                            className="py-1 px-1 bg-blue-50/90 hover:bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-bold rounded-lg transition flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-2xs"
                                            title="Khách đang ở yêu cầu dọn phòng lưu trú (Make-up room)"
                                        >
                                            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                                            <span className="text-[9px] font-bold leading-none">Dọn</span>
                                        </button>
                                    )}
                                    {showMinibarBtn && (
                                        <button
                                            type="button"
                                            onClick={() => onOpenMinibar(room)}
                                            className="py-1 px-1 bg-amber-50/90 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold rounded-lg transition flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-2xs"
                                            title="Kiểm kê Minibar phòng khách đang ở"
                                        >
                                            <Wine className="w-3.5 h-3.5 text-amber-600" />
                                            <span className="text-[9px] font-bold leading-none">Minibar</span>
                                        </button>
                                    )}
                                    {showLostItemBtn && (
                                        <button
                                            type="button"
                                            onClick={() => onOpenLostItem(room)}
                                            className="py-1 px-1 bg-purple-50/90 hover:bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-bold rounded-lg transition flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-2xs"
                                            title="Báo đồ khách bỏ quên (Lost & Found)"
                                        >
                                            <Luggage className="w-3.5 h-3.5 text-purple-600" />
                                            <span className="text-[9px] font-bold leading-none">Đồ rơi</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* 2. Nút cho phòng Available: Gán phòng đón khách (Check-in) */}
                {room.status === 'available' && canManageBookings && (
                    <button
                        type="button"
                        onClick={() => onOpenAssign(room)}
                        className="w-full py-2 px-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[11px] font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                        title="Chọn đơn đặt phòng chờ nhận để Gán phòng & Check-in ngay"
                    >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Gán phòng đón khách</span>
                    </button>
                )}

                {/* 3. Nút cho phòng Cleaning: Minibar + Báo đồ bỏ quên + Xác nhận dọn dẹp xong */}
                {room.status === 'cleaning' && (
                    <div className="space-y-1.5">
                        {(canAccessMinibar || canReportLostItem) && (
                            <div className={`grid ${canAccessMinibar && canReportLostItem ? 'grid-cols-2' : 'grid-cols-1'} gap-1`}>
                                {canAccessMinibar && onOpenMinibar && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenMinibar(room)}
                                        className="py-1.5 px-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-lg shadow-2xs transition flex items-center justify-center gap-1 cursor-pointer"
                                        title="Kiểm kê đồ Minibar tủ lạnh để tính vào hóa đơn khách"
                                    >
                                        <Wine className="w-3.5 h-3.5" />
                                        <span className="truncate whitespace-nowrap">Minibar</span>
                                    </button>
                                )}
                                {canReportLostItem && onOpenLostItem && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenLostItem(room)}
                                        className="py-1.5 px-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded-lg shadow-2xs transition flex items-center justify-center gap-1 cursor-pointer"
                                        title="Báo phát hiện đồ khách bỏ quên (Lost & Found)"
                                    >
                                        <Luggage className="w-3.5 h-3.5" />
                                        <span className="truncate whitespace-nowrap">Đồ thất lạc</span>
                                    </button>
                                )}
                            </div>
                        )}
                        {canMarkCleaned ? (
                            <button
                                type="button"
                                onClick={() => onStatusChange(room.id, 'available', room.room_number)}
                                className="w-full py-1.5 px-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-[10px] font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer animate-pulse"
                                title="Xác nhận buồng phòng dọn xong để đưa phòng về trạng thái Sẵn sàng"
                            >
                                <Check className="w-3.5 h-3.5" />
                                <span>Đã dọn xong → Sẵn sàng</span>
                            </button>
                        ) : (
                            <div className="w-full py-1.5 px-2 bg-amber-100/90 text-amber-800 text-[10px] font-medium rounded-xl border border-amber-300 text-center flex items-center justify-center gap-1 shadow-2xs">
                                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                                <span>Đang chờ Buồng phòng dọn dẹp</span>
                            </div>
                        )}
                    </div>
                )}

                {/* 4. Nút cho phòng Maintenance: Nghiệm thu & Bàn giao dọn */}
                {room.status === 'maintenance' && canCompleteMaintenance && (
                    <button
                        type="button"
                        onClick={() => onCompleteMaintenance ? onCompleteMaintenance(room) : onStatusChange(room.id, 'cleaning', room.room_number)}
                        className="w-full py-2 px-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-[10px] font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-amber-500/20 active:scale-98"
                        title="Nghiệm thu sửa chữa, nhập vật tư thay thế, chi phí & bàn giao buồng phòng dọn dẹp"
                    >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Sửa xong → Nghiệm thu & Dọn</span>
                    </button>
                )}

                {/* Dropdown chỉnh sửa trạng thái thủ công:
                    CHỈ hiển thị cho phòng Trống (Available), Đang dọn (Cleaning), hoặc Bảo trì (Maintenance).
                    KHÔNG hiển thị cho phòng Đang có khách (Occupied) nhằm bảo vệ dữ liệu lưu trú, chống bấm nhầm làm hỏng luồng Check-out PMS. */}
                {canUseStatusDropdown && room.status !== 'occupied' && (
                    <div className="pt-1 border-t border-slate-200/60">
                        <select
                            value={room.status}
                            onChange={(e) => onStatusChange(room.id, e.target.value, room.room_number)}
                            className="w-full px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition cursor-pointer"
                            title="Đổi trạng thái thủ công"
                        >
                            {userRole === 'housekeeper' ? (
                                <>
                                    <option value="available">🟢 Trống (Available)</option>
                                    <option value="cleaning">🟡 Đang dọn (Cleaning)</option>
                                </>
                            ) : userRole === 'receptionist' ? (
                                <>
                                    {room.status === 'cleaning' ? (
                                        <option value="available" disabled>🟢 Trống (Chờ buồng dọn xong)</option>
                                    ) : (
                                        <option value="available">🟢 Trống (Available)</option>
                                    )}
                                    <option value="cleaning">🟡 Đang dọn (Cleaning)</option>
                                    <option value="maintenance">⚪ Bảo trì (Maintenance)</option>
                                </>
                            ) : (
                                <>
                                    <option value="available">🟢 Trống (Available)</option>
                                    <option value="cleaning">🟡 Đang dọn (Cleaning)</option>
                                    <option value="maintenance">⚪ Bảo trì (Maintenance)</option>
                                </>
                            )}
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
}
