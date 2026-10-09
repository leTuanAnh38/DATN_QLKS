import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import roomService from '../../services/roomService';
import { bookingService } from '../../services/bookingService';
import CheckOutModal from '../../components/admin/modals/CheckOutModal';
import HotelInvoiceModal from '../../components/admin/modals/HotelInvoiceModal';
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
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        cardClass: 'bg-emerald-50/80 hover:bg-emerald-50 border-emerald-300 hover:border-emerald-500 text-emerald-950 shadow-xs hover:shadow-md',
        indicatorColor: 'bg-emerald-500',
        btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        icon: '🟢',
    },
    occupied: {
        key: 'occupied',
        label: 'Đang có khách lưu trú',
        shortLabel: 'Có khách',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
        cardClass: 'bg-rose-50/80 hover:bg-rose-50 border-rose-300 hover:border-rose-500 text-rose-950 shadow-xs hover:shadow-md',
        indicatorColor: 'bg-rose-500',
        btnClass: 'bg-rose-600 hover:bg-rose-700 text-white',
        icon: '🔴',
    },
    cleaning: {
        key: 'cleaning',
        label: 'Đang dọn dẹp (Housekeeping)',
        shortLabel: 'Đang dọn',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        cardClass: 'bg-amber-50/80 hover:bg-amber-50 border-amber-300 hover:border-amber-500 text-amber-950 shadow-xs hover:shadow-md',
        indicatorColor: 'bg-amber-500',
        btnClass: 'bg-amber-500 hover:bg-amber-600 text-white',
        icon: '🟡',
    },
    maintenance: {
        key: 'maintenance',
        label: 'Đang bảo trì / Hỏng hóc',
        shortLabel: 'Bảo trì',
        badgeClass: 'bg-slate-200 text-slate-800 border-slate-300',
        cardClass: 'bg-slate-100/90 hover:bg-slate-100 border-slate-300 hover:border-slate-400 text-slate-800 shadow-xs hover:shadow-md',
        indicatorColor: 'bg-slate-400',
        btnClass: 'bg-slate-600 hover:bg-slate-700 text-white',
        icon: '⚪',
    },
};

export default function RoomManagement({ onNavigateToBookings, onNavigateToCustomer }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const canCreateRoom = useHasPermission('rooms', 'create');
    const canUpdateRoom = useHasPermission('rooms', 'update');
    const canDeleteRoom = useHasPermission('rooms', 'delete');
    const isManagerOrAdmin = Boolean(user && (['admin', 'owner', 'manager'].includes(user.role) || user.is_superuser));
    const canManageBookings = Boolean(user && (['admin', 'owner', 'manager', 'receptionist'].includes(user.role) || user.is_superuser));

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

    // Modal Gán phòng & Check-in đón khách
    const [assignModalRoom, setAssignModalRoom] = useState(null);
    const [eligibleBookings, setEligibleBookings] = useState([]);
    const [isLoadingEligible, setIsLoadingEligible] = useState(false);
    const [assignSearchTerm, setAssignSearchTerm] = useState('');
    const [assignFilterMode, setAssignFilterMode] = useState('match_category'); // 'match_category' | 'all'
    const [isSubmittingAssignCheckIn, setIsSubmittingAssignCheckIn] = useState(false);

    // Lắng nghe sự kiện realtime từ hệ thống PMS (đồng bộ khi check-in, check-out từ tab Quản lý Đặt phòng)
    useEffect(() => {
        const handleSyncEvent = () => {
            fetchRooms(true);
        };
        window.addEventListener('pms_booking_created', handleSyncEvent);
        window.addEventListener('pms_room_updated', handleSyncEvent);
        return () => {
            window.removeEventListener('pms_booking_created', handleSyncEvent);
            window.removeEventListener('pms_room_updated', handleSyncEvent);
        };
    }, []);

    // 1. Tải danh sách phòng từ API (hỗ trợ silent mode để không unmount UI khi cập nhật ngầm)
    const fetchRooms = async (silent = false) => {
        if (!silent) setIsLoading(true);
        const params = {};
        if (searchTerm) params.q = searchTerm;
        if (floorFilter !== 'all') params.floor = floorFilter;
        if (statusFilter !== 'all') params.status = statusFilter;
        if (categoryFilter !== 'all') params.category = categoryFilter;

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
    };

    // Tải danh mục loại phòng khi mở form nếu cần
    const fetchCategories = async () => {
        const res = await roomService.getCategories();
        if (res.success && res.categories) {
            setCategories(res.categories);
        }
    };

    useEffect(() => {
        fetchRooms();
    }, [floorFilter, statusFilter, categoryFilter]);

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

    // Xác nhận Gán phòng & Check-in ngay
    const handleConfirmAssignCheckIn = async (booking) => {
        if (!canManageBookings) {
            alert('Chỉ nhân viên Lễ tân hoặc Quản lý mới có quyền thực hiện Check-in.');
            return;
        }
        if (!assignModalRoom || isSubmittingAssignCheckIn) return;

        const todayStr = new Date().toISOString().split('T')[0];
        const isExpired = booking.check_out_date && String(booking.check_out_date).split('T')[0] <= todayStr;
        if (isExpired) {
            alert(`⛔ Đơn đặt phòng #${booking.booking_code} đã quá hạn lưu trú (Ngày trả phòng dự kiến là ${formatDate(booking.check_out_date)}). Không thể Check-in.`);
            return;
        }

        const isEarly = booking.check_in_date && String(booking.check_in_date).split('T')[0] > todayStr;
        const isLate = booking.check_in_date && String(booking.check_in_date).split('T')[0] < todayStr;
        let earlyDays = 0;
        let lateDays = 0;
        let confirmEarly = false;
        let confirmLate = false;
        let applyCharge = true;

        if (isEarly) {
            const d1 = new Date(String(booking.check_in_date).split('T')[0]);
            const d2 = new Date(todayStr);
            d1.setHours(0, 0, 0, 0);
            d2.setHours(0, 0, 0, 0);
            earlyDays = Math.max(1, Math.round((d1 - d2) / (1000 * 60 * 60 * 24)));

            const confirmMsg = `⚡ CẢNH BÁO NHẬN PHÒNG SỚM (Early Check-in):\n\nKhách hàng "${booking.guest_name}" có ngày đặt ban đầu là ${formatDate(booking.check_in_date)} (đến sớm ${earlyDays} ngày).\n\nHệ thống sẽ chuyển ngày bắt đầu lưu trú sang hôm nay (${formatDate(todayStr)}) và tự động cộng thêm tiền phòng cho ${earlyDays} đêm ở sớm.\n\nBạn có đồng ý thực hiện Check-in sớm không?`;
            const ok = window.confirm(confirmMsg);
            if (!ok) return;

            confirmEarly = true;
            applyCharge = true;
        } else if (isLate) {
            const dToday = new Date(todayStr);
            const dOriginal = new Date(String(booking.check_in_date).split('T')[0]);
            const dOut = new Date(String(booking.check_out_date).split('T')[0]);
            dToday.setHours(0, 0, 0, 0);
            dOriginal.setHours(0, 0, 0, 0);
            dOut.setHours(0, 0, 0, 0);
            lateDays = Math.max(1, Math.round((dToday - dOriginal) / (1000 * 60 * 60 * 24)));
            const remainingNights = Math.max(1, Math.round((dOut - dToday) / (1000 * 60 * 60 * 24)));

            const confirmMsg = `⏰ CẢNH BÁO NHẬN PHÒNG TRỄ (Late Check-in):\n\nKhách hàng "${booking.guest_name}" đến trễ ${lateDays} ngày so với lịch ban đầu (${formatDate(booking.check_in_date)}).\n\nKhách sẽ nhận phòng ở ${remainingNights} đêm còn lại đến ngày ${formatDate(booking.check_out_date)}.\n\nBạn có đồng ý thực hiện Check-in trễ cho khách không?`;
            const ok = window.confirm(confirmMsg);
            if (!ok) return;

            confirmLate = true;
        }

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
                setAssignModalRoom(null);
                fetchRooms(true);
                setTimeout(() => setAlertMessage(null), 4500);
            } else {
                alert(res?.message || 'Check-in thất bại. Vui lòng kiểm tra lại tình trạng phòng.');
            }
        } catch (err) {
            console.error('Lỗi khi thực hiện Check-in:', err);
            alert('Đã xảy ra lỗi khi kết nối máy chủ để Check-in.');
        } finally {
            setIsSubmittingAssignCheckIn(false);
        }
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
    // 2. THAO TÁC ĐỔI NHANH TRẠNG THÁI PHÒNG (Cho Lễ tân / Buồng phòng)
    // =========================================================================
    const handleQuickStatusChange = async (roomId, newStatus, roomNumber) => {
        const currentRoom = rooms.find((r) => r.id === roomId);
        const oldStatus = currentRoom ? currentRoom.status : null;
        if (oldStatus === newStatus) return;

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
                    <h1 className="text-2xl font-serif font-bold text-slate-900 tracking-tight">
                        Quản Lý Danh Sách & Sơ Đồ Phòng Thực Tế
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Kiểm soát trạng thái phòng thời gian thực, hỗ trợ Lễ tân đổi nhanh tình trạng phòng và cập nhật phòng mới.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => fetchRooms(true)}
                        className="px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        title="Tải lại sơ đồ phòng"
                    >
                        <span className={isLoading ? "animate-spin inline-block" : "inline-block"}>🔄</span>
                        <span className="hidden sm:inline">Làm Mới</span>
                    </button>
                    {canCreateRoom && (
                        <button
                            type="button"
                            onClick={handleOpenCreate}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer"
                        >
                            <span>＋</span>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {/* 1. Tổng số phòng */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                            Tổng số phòng
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-2xl font-black text-slate-900">{stats.total}</span>
                            <span className="text-[11px] text-slate-500 font-medium">phòng</span>
                        </div>
                        <span className="text-[10px] text-blue-600 font-bold block mt-0.5">
                            Công suất: {stats.occupancy_rate}%
                        </span>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center text-xl font-bold shadow-xs">
                        🏢
                    </div>
                </div>

                {/* 2. Phòng Trống (Available) */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'available' ? 'all' : 'available')}
                    className={`rounded-2xl p-4 border transition cursor-pointer ${
                        statusFilter === 'available'
                            ? 'bg-emerald-100 border-emerald-400 shadow-md ring-2 ring-emerald-500/20'
                            : 'bg-white border-slate-200 hover:border-emerald-300 shadow-xs'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-bold uppercase text-emerald-700 block tracking-wider">
                                Trống (Sẵn sàng)
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-1">
                                <span className="text-2xl font-black text-emerald-800">{stats.available}</span>
                                <span className="text-[11px] text-emerald-600 font-medium">phòng</span>
                            </div>
                            <span className="text-[10px] text-emerald-700 block mt-0.5 font-semibold">
                                Có thể nhận khách ngay
                            </span>
                        </div>
                        <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center text-xl font-bold shadow-xs">
                            🟢
                        </div>
                    </div>
                </div>

                {/* 3. Có khách (Occupied) */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'occupied' ? 'all' : 'occupied')}
                    className={`rounded-2xl p-4 border transition cursor-pointer ${
                        statusFilter === 'occupied'
                            ? 'bg-rose-100 border-rose-400 shadow-md ring-2 ring-rose-500/20'
                            : 'bg-white border-slate-200 hover:border-rose-300 shadow-xs'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-bold uppercase text-rose-700 block tracking-wider">
                                Đang có khách
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-1">
                                <span className="text-2xl font-black text-rose-800">{stats.occupied}</span>
                                <span className="text-[11px] text-rose-600 font-medium">phòng</span>
                            </div>
                            <span className="text-[10px] text-rose-700 block mt-0.5 font-semibold">
                                Đang lưu trú tại khách sạn
                            </span>
                        </div>
                        <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center text-xl font-bold shadow-xs">
                            🔴
                        </div>
                    </div>
                </div>

                {/* 4. Đang dọn dẹp (Cleaning) */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'cleaning' ? 'all' : 'cleaning')}
                    className={`rounded-2xl p-4 border transition cursor-pointer ${
                        statusFilter === 'cleaning'
                            ? 'bg-amber-100 border-amber-400 shadow-md ring-2 ring-amber-500/20'
                            : 'bg-white border-slate-200 hover:border-amber-300 shadow-xs'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-bold uppercase text-amber-700 block tracking-wider">
                                Đang dọn dẹp
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-1">
                                <span className="text-2xl font-black text-amber-800">{stats.cleaning}</span>
                                <span className="text-[11px] text-amber-600 font-medium">phòng</span>
                            </div>
                            <span className="text-[10px] text-amber-700 block mt-0.5 font-semibold">
                                Buồng phòng đang xử lý
                            </span>
                        </div>
                        <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-xl font-bold shadow-xs">
                            🟡
                        </div>
                    </div>
                </div>

                {/* 5. Đang bảo trì (Maintenance) */}
                <div
                    onClick={() => setStatusFilter(statusFilter === 'maintenance' ? 'all' : 'maintenance')}
                    className={`rounded-2xl p-4 border transition cursor-pointer ${
                        statusFilter === 'maintenance'
                            ? 'bg-slate-200 border-slate-400 shadow-md ring-2 ring-slate-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-bold uppercase text-slate-600 block tracking-wider">
                                Đang bảo trì
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-1">
                                <span className="text-2xl font-black text-slate-800">{stats.maintenance}</span>
                                <span className="text-[11px] text-slate-500 font-medium">phòng</span>
                            </div>
                            <span className="text-[10px] text-slate-600 block mt-0.5 font-semibold">
                                Đang sửa chữa kỹ thuật
                            </span>
                        </div>
                        <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-600 border border-slate-300 flex items-center justify-center text-xl font-bold shadow-xs">
                            ⚪
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* THANH BỘ LỌC ĐA TIÊU CHÍ & CHẾ ĐỘ HIỂN THỊ */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Ô tìm kiếm số phòng hoặc hạng phòng */}
                    <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo số phòng (VD: 101, 204) hoặc tên hạng phòng..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-24 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-600 focus:bg-white text-slate-900"
                        />
                        <span className="absolute left-3 top-3 text-slate-400 text-xs">🔍</span>
                        <button
                            type="submit"
                            className="absolute right-1.5 top-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg transition cursor-pointer"
                        >
                            Tìm kiếm
                        </button>
                    </form>

                    {/* Bộ lọc dropdowns */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        {/* Lọc Tầng */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-medium text-[11px]">Tầng:</span>
                            <select
                                value={floorFilter}
                                onChange={(e) => setFloorFilter(e.target.value)}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600 text-slate-800 cursor-pointer"
                            >
                                <option value="all">Tất cả các tầng</option>
                                {floors.map((fl) => (
                                    <option key={fl} value={fl}>
                                        Tầng {fl}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Lọc Hạng Phòng */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-medium text-[11px]">Hạng:</span>
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600 text-slate-800 cursor-pointer max-w-[180px] truncate"
                            >
                                <option value="all">Tất cả hạng phòng</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Lọc Trạng Thái */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-medium text-[11px]">Trạng thái:</span>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-600 text-slate-800 cursor-pointer"
                            >
                                <option value="all">Tất cả trạng thái</option>
                                <option value="available">🟢 Phòng trống</option>
                                <option value="occupied">🔴 Đang có khách</option>
                                <option value="cleaning">🟡 Đang dọn dẹp</option>
                                <option value="maintenance">⚪ Đang bảo trì</option>
                            </select>
                        </div>

                        {/* Toggle Group theo tầng */}
                        <button
                            type="button"
                            onClick={() => setGroupByFloor(!groupByFloor)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                                groupByFloor
                                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                            title="Gom nhóm hiển thị theo từng tầng hoặc trải phẳng toàn bộ"
                        >
                            <span>📑</span>
                            <span>{groupByFloor ? 'Theo Tầng' : 'Trải Phẳng'}</span>
                        </button>

                        {(searchTerm || floorFilter !== 'all' || statusFilter !== 'all' || categoryFilter !== 'all') && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="px-2.5 py-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl font-bold transition text-xs cursor-pointer"
                                title="Xóa bộ lọc"
                            >
                                ✕ Bỏ lọc
                            </button>
                        )}
                    </div>
                </div>

                {/* Chú giải trạng thái màu sắc nhanh */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-slate-400 font-bold uppercase text-[10px]">Quy chuẩn màu thẻ:</span>
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>Trống (Green)</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-semibold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            <span>Có khách (Red/Rose)</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <span>Đang dọn (Yellow/Amber)</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-300">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            <span>Bảo trì (Gray)</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isLoading && rooms.length > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[11px] font-bold animate-pulse border border-blue-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                                Đang đồng bộ...
                            </span>
                        )}
                        <span className="text-slate-400 italic text-xs">
                            Hiển thị <strong>{rooms.length}</strong> / {stats.total} phòng
                        </span>
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
                        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={handleGoToBookings}
                                className="px-3 py-2 text-slate-600 hover:text-slate-900 font-bold text-xs rounded-xl hover:bg-slate-200/60 transition flex items-center gap-1 cursor-pointer"
                            >
                                <span>📋</span>
                                <span>Quản lý Đặt phòng</span>
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedOccupiedRoom(null)}
                                    className="px-3.5 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition cursor-pointer text-xs"
                                >
                                    Đóng
                                </button>
                                {canManageBookings && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const b = selectedOccupiedRoom.current_booking;
                                            setSelectedOccupiedRoom(null);
                                            setCheckOutBooking(b);
                                        }}
                                        className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold rounded-xl shadow-md shadow-rose-600/20 text-xs transition flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <span>🧾</span>
                                        <span>Thực hiện Check-out & Quyết toán</span>
                                    </button>
                                )}
                            </div>
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

    return (
        <div
            className={`relative rounded-2xl border-2 p-3.5 flex flex-col justify-between transition-all duration-200 group ${statusConfig.cardClass}`}
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

                    {/* Badge tầng & Menu Sửa */}
                    <div className="flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded-md bg-white/80 border border-slate-200/80 text-[10px] font-bold text-slate-600 shadow-2xs">
                            {room.floor}F
                        </span>
                        {canUpdateRoom && (
                            <button
                                type="button"
                                onClick={() => onEdit(room)}
                                className="w-6 h-6 rounded-md hover:bg-white text-slate-400 hover:text-slate-700 flex items-center justify-center text-xs transition cursor-pointer opacity-80 group-hover:opacity-100"
                                title="Chỉnh sửa thông tin phòng"
                            >
                                ✏️
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
                                <span className="font-bold text-xs text-slate-900 truncate flex items-center gap-1" title={currentBk.guest_name}>
                                    <span>👤</span>
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

            {/* ========================================================================= */}
            {/* CÁC NÚT THAO TÁC NGHIỆP VỤ PMS (CHECK-IN / CHECK-OUT / DỌN DẸP) */}
            {/* ========================================================================= */}
            <div className="mt-2.5 space-y-1.5">
                {/* 1. Nút cho phòng Occupied: Check-out trực tiếp & Xem chi tiết */}
                {room.status === 'occupied' && (
                    <div className="space-y-1">
                        {canManageBookings && (
                            <button
                                type="button"
                                onClick={() => onOpenCheckOut(room)}
                                className="w-full py-1.5 px-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-[10px] font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                                title="Thực hiện thủ tục Check-out & Lập Hóa Đơn Quyết Toán"
                            >
                                <span>🧾</span>
                                <span>Trả phòng & Quyết toán</span>
                            </button>
                        )}
                        {currentBk && (
                            <button
                                type="button"
                                onClick={() => onViewOccupied(room)}
                                className="w-full py-1 px-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-semibold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                                title="Xem đầy đủ hồ sơ khách & thông tin lưu trú"
                            >
                                <span>👁️</span>
                                <span>Xem thông tin khách</span>
                            </button>
                        )}
                    </div>
                )}

                {/* 2. Nút cho phòng Available: Gán phòng đón khách (Check-in) */}
                {room.status === 'available' && canManageBookings && (
                    <button
                        type="button"
                        onClick={() => onOpenAssign(room)}
                        className="w-full py-2 px-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-[11px] font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Chọn đơn đặt phòng chờ nhận để Gán phòng & Check-in ngay"
                    >
                        <span>🔑</span>
                        <span>Gán phòng đón khách</span>
                    </button>
                )}

                {/* 3. Nút cho phòng Cleaning: Xác nhận dọn dẹp xong */}
                {room.status === 'cleaning' && (
                    <button
                        type="button"
                        onClick={() => onStatusChange(room.id, 'available', room.room_number)}
                        className="w-full py-2 px-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-[10px] font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1 cursor-pointer animate-pulse"
                        title="Xác nhận buồng phòng dọn xong để đưa phòng về trạng thái Sẵn sàng"
                    >
                        <span>✓</span>
                        <span>Đã dọn xong → Sẵn sàng</span>
                    </button>
                )}

                {/* 4. Nút cho phòng Maintenance: Báo sửa xong */}
                {room.status === 'maintenance' && (
                    <button
                        type="button"
                        onClick={() => onStatusChange(room.id, 'cleaning', room.room_number)}
                        className="w-full py-1.5 px-2 bg-slate-700 hover:bg-slate-800 text-white text-[10px] font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
                        title="Bảo trì xong, chuyển buồng phòng dọn dẹp"
                    >
                        <span>🧹</span>
                        <span>Sửa xong → Báo dọn</span>
                    </button>
                )}

                {/* Dropdown chỉnh sửa trạng thái thủ công */}
                {canUpdateRoom && userRole !== 'cashier' && (
                    <div className="pt-1 border-t border-slate-200/50">
                        <select
                            value={room.status}
                            onChange={(e) => onStatusChange(room.id, e.target.value, room.room_number)}
                            className="w-full px-2 py-1 bg-white/80 hover:bg-white border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition cursor-pointer"
                            title="Đổi trạng thái thủ công"
                        >
                            {userRole === 'housekeeper' ? (
                                <>
                                    <option value="available">🟢 Trống (Available)</option>
                                    <option value="cleaning">🟡 Đang dọn (Cleaning)</option>
                                </>
                            ) : (
                                <>
                                    <option value="available">🟢 Trống (Available)</option>
                                    <option value="occupied">🔴 Có khách (Occupied)</option>
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
