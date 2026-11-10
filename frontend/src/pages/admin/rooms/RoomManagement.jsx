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
    Edit3,
    Trash2,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Zap,
    Calendar,
    Phone,
    User,
    Bell,
    Inbox,
    ArrowRight,
    Lightbulb,
    Hotel,
} from 'lucide-react';
import roomService from '../../../services/roomService';
import { bookingService } from '../../../services/bookingService';
import CheckOutModal from '../../../components/admin/modals/shared/CheckOutModal';
import HotelInvoiceModal from '../../../components/admin/modals/shared/HotelInvoiceModal';
import MaintenanceModal from '../../../components/admin/modals/room/MaintenanceModal';
import MaintenanceHistoryModal from '../../../components/admin/modals/room/MaintenanceHistoryModal';
import ChangeRoomModal from '../../../components/admin/modals/room/ChangeRoomModal';
import MinibarModal from '../../../components/admin/modals/room/MinibarModal';
import ReportLostItemModal from '../../../components/admin/modals/shared/ReportLostItemModal';
import { useAuth } from '../../../store/authStore';
import { useHasPermission } from '../../../utils/permission';
import { formatDate, formatDateTime } from '../../../utils/formatters';
import { ROOM_STATUSES, ISSUE_TYPE_MAP } from '../../../utils/constants';
import {
    RoomCard,
    RoomStatsBar,
    OccupiedRoomDetailModal,
    RoomFormModal,
    AssignRoomModal
} from '../../../components/admin/rooms';

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
                setAlertMessage({
                    type: 'error',
                    text: res.message || 'Không thể gửi yêu cầu dọn phòng.'
                });
                setTimeout(() => setAlertMessage(null), 4000);
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
                setAlertMessage({
                    type: 'error',
                    text: res.message || 'Không thể xác nhận hoàn tất dọn phòng.'
                });
                setTimeout(() => setAlertMessage(null), 4000);
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
            setAlertMessage({
                type: 'error',
                text: 'Chỉ nhân viên Lễ tân hoặc Quản lý mới có quyền thực hiện thủ tục Check-out trả phòng.'
            });
            setTimeout(() => setAlertMessage(null), 4000);
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
            text: `Đã hoàn tất Check-out & quyết toán hóa đơn! Phòng đã chuyển sang trạng thái "Đang dọn dẹp (Housekeeping)".`
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
            setAlertMessage({
                type: 'error',
                text: 'Chỉ nhân viên Lễ tân hoặc Quản lý mới có quyền thực hiện thủ tục Gán phòng đón khách.'
            });
            setTimeout(() => setAlertMessage(null), 4000);
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
                    text: res.message || `Check-in thành công cho khách "${booking.guest_name}" vào phòng ${assignModalRoom.room_number}!`
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
                text: `Đơn đặt phòng #${booking.booking_code} đã quá hạn lưu trú (Ngày trả phòng dự kiến là ${formatDate(booking.check_out_date)}). Không thể Check-in.`
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

    const handleCreateRoom = async (formDataOrEvent) => {
        if (formDataOrEvent?.preventDefault) formDataOrEvent.preventDefault();
        const src = (formDataOrEvent?.room_number !== undefined) ? formDataOrEvent : createFormData;
        setIsSubmitting(true);

        const payload = {
            room_number: src.room_number.trim(),
            floor: parseInt(src.floor) || 1,
            category_id: parseInt(src.category_id),
            status: src.status,
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

    const handleSaveEdit = async (formDataOrEvent) => {
        if (formDataOrEvent?.preventDefault) formDataOrEvent.preventDefault();
        const src = (formDataOrEvent?.room_number !== undefined) ? formDataOrEvent : editFormData;
        setIsSubmitting(true);

        const payload = {
            room_number: src.room_number.trim(),
            floor: parseInt(src.floor) || 1,
            category_id: parseInt(src.category_id),
            status: src.status,
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
        setIsDeleteModalOpen(false);

        if (res.success) {
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
                    <h1 className="text-2xl font-sans font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
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

            {/* Alert Message Toast - Luôn hiển thị trên cùng (z-[99999]) */}
            {alertMessage && (
                <div
                    className={`fixed top-5 right-5 z-[99999] max-w-md p-4 rounded-2xl flex items-center justify-between text-xs font-semibold border shadow-2xl transition animate-fadeIn ${alertMessage.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                >
                    <div className="flex items-center gap-2.5">
                        {alertMessage.type === 'success' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                        )}
                        <span>{alertMessage.text}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAlertMessage(null)}
                        className="text-slate-400 hover:text-slate-700 font-bold ml-4 cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* KPI STATS CARDS: BẢNG CHỈ SỐ TRẠNG THÁI TOÀN KHÁCH SẠN */}
            <RoomStatsBar
                stats={stats}
                statusFilter={statusFilter}
                onStatusFilterChange={(f) => setStatusFilter(f)}
            />

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
                                <option value="available">Trống (Sẵn sàng)</option>
                                <option value="occupied">Có khách</option>
                                <option value="cleaning">Đang dọn</option>
                                <option value="maintenance">Bảo trì</option>
                            </select>
                        </div>

                        {/* Toggle Group theo tầng */}
                        <button
                            type="button"
                            onClick={() => setGroupByFloor(!groupByFloor)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${groupByFloor
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
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <Search className="w-8 h-8" />
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

            {/* MODAL 1: THÊM PHÒNG MỚI */}
            <RoomFormModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                mode="create"
                categories={categories}
                onSubmit={handleCreateRoom}
                isSubmitting={isSubmitting}
            />

            {/* MODAL 2: CHỈNH SỬA PHÒNG */}
            <RoomFormModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                mode="edit"
                initialData={selectedRoom}
                categories={categories}
                onSubmit={handleSaveEdit}
                isSubmitting={isSubmitting}
                onDelete={() => handleOpenDelete(selectedRoom)}
                canDeleteRoom={canDeleteRoom}
                isManagerOrAdmin={isManagerOrAdmin}
            />

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
                            <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-inner border border-rose-200">
                                <Trash2 className="w-8 h-8 text-rose-600" />
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
                    showToast={showToast}
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

            {/* MODAL 6: CHI TIẾT PHÒNG ĐANG CÓ KHÁCH LƯU TRÚ (OCCUPIED DETAIL) */}
            <OccupiedRoomDetailModal
                room={selectedOccupiedRoom}
                onClose={() => setSelectedOccupiedRoom(null)}
                onGoToCustomer={handleGoToCustomer}
                onGoToBookings={handleGoToBookings}
                canManageBookings={canManageBookings}
                onOpenChangeRoom={(room, booking) => {
                    setSelectedOccupiedRoom(null);
                    handleOpenChangeRoom({ room, booking, reason: "" });
                }}
                onOpenCheckOut={(booking) => {
                    setSelectedOccupiedRoom(null);
                    setCheckOutBooking(booking);
                }}
            />

            {/* ========================================================================= */}
            {/* MODAL 7: GÁN PHÒNG & CHECK-IN ĐÓN KHÁCH (ROOM ASSIGNMENT MODAL) */}
            {/* ========================================================================= */}
            <AssignRoomModal
                room={assignModalRoom}
                onClose={() => setAssignModalRoom(null)}
                eligibleBookings={eligibleBookings}
                isLoadingEligible={isLoadingEligible}
                isSubmitting={isSubmittingAssignCheckIn}
                onConfirmAssign={handleConfirmAssignCheckIn}
                onGoToBookings={handleGoToBookings}
            />

            {/* ========================================================================= */}
            {/* MODAL CẢNH BÁO NHẬN PHÒNG SỚM / TRỄ (MODERN WHITE MODAL) */}
            {/* ========================================================================= */}
            {checkInWarningModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-2xl max-w-md w-full border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3.5">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-xl font-bold ${checkInWarningModal.type === 'early'
                                    ? 'bg-amber-100 text-amber-600'
                                    : 'bg-indigo-100 text-indigo-600'
                                }`}>
                                {checkInWarningModal.type === 'early' ? <Zap className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
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
                                <span className="flex items-start gap-1.5"><Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" /><span>Hệ thống sẽ chuyển ngày bắt đầu lưu trú sang hôm nay <b>({formatDate(checkInWarningModal.todayStr)})</b> và tự động tính thêm phụ phí cho <b>{checkInWarningModal.earlyDays} đêm</b> ở sớm.</span></span>
                            ) : (
                                <span className="flex items-start gap-1.5"><Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" /><span>Khách sẽ nhận phòng ở <b>{checkInWarningModal.remainingNights} đêm</b> còn lại đến ngày <b>{formatDate(checkInWarningModal.booking.check_out_date)}</b>.</span></span>
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
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>Đang xử lý...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-3.5 h-3.5" />
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
                                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
                                    <Sparkles className="w-5 h-5" />
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
                            ><X className="w-4 h-4" /></button>
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
                                    {isSubmittingMakeUp ? 'Đang gửi...' : <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Gửi Yêu Cầu Buồng Phòng</span>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
