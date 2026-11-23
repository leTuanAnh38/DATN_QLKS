import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    RotateCw,
    Search,
    SlidersHorizontal,
    Layers,
    BedDouble,
    Moon,
    Calendar,
    CheckCircle2,
    Clock,
    Key,
    ShieldCheck,
    Users,
    User,
    Phone,
    CreditCard,
    Building2,
    Sparkles,
    X,
    AlertTriangle,
    DoorClosed,
    Check,
    FileText,
    Info,
    ArrowRight,
    Plus
} from 'lucide-react';
import { bookingService } from '../../../services/bookingService';
import roomService from '../../../services/roomService';
import { useHasPermission } from '../../../utils/permission';
import WalkInBookingModal from '../../../components/admin/modals/booking/WalkInBookingModal';

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

// Cấu hình màu sắc theo trạng thái với hiệu ứng Gradient sang trọng
const STATUS_CONFIG = {
    pending: {
        label: 'Chờ xác nhận',
        bg: 'bg-gradient-to-r from-amber-500 to-amber-600',
        hoverBg: 'hover:from-amber-600 hover:to-amber-700',
        border: 'border-amber-600/80',
        text: 'text-white',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300'
    },
    paid: {
        label: 'Chờ duyệt (Đã TT QR)',
        bg: 'bg-gradient-to-r from-amber-500 to-amber-600',
        hoverBg: 'hover:from-amber-600 hover:to-amber-700',
        border: 'border-amber-600/80',
        text: 'text-white',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300'
    },
    PAID: {
        label: 'Chờ duyệt (Đã TT QR)',
        bg: 'bg-gradient-to-r from-amber-500 to-amber-600',
        hoverBg: 'hover:from-amber-600 hover:to-amber-700',
        border: 'border-amber-600/80',
        text: 'text-white',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300'
    },
    confirmed: {
        label: 'Đã xác nhận',
        bg: 'bg-gradient-to-r from-blue-600 to-indigo-600',
        hoverBg: 'hover:from-blue-700 hover:to-indigo-700',
        border: 'border-blue-700/80',
        text: 'text-white',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-300'
    },
    checked_in: {
        label: 'Đang lưu trú',
        bg: 'bg-gradient-to-r from-emerald-600 to-teal-600',
        hoverBg: 'hover:from-emerald-700 hover:to-teal-700',
        border: 'border-emerald-700/80',
        text: 'text-white',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300'
    },
    checked_out: {
        label: 'Đã trả phòng',
        bg: 'bg-gradient-to-r from-slate-500 to-slate-600',
        hoverBg: 'hover:from-slate-600 hover:to-slate-700',
        border: 'border-slate-600/80',
        text: 'text-white',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300'
    },
    completed: {
        label: 'Đã hoàn tất',
        bg: 'bg-gradient-to-r from-slate-500 to-slate-600',
        hoverBg: 'hover:from-slate-600 hover:to-slate-700',
        border: 'border-slate-600/80',
        text: 'text-white',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300'
    }
};

export default function BookingTimeline({ onNavigateToBookings }) {
    const canCreateBookings = useHasPermission('bookings', 'create');

    // 1. Quản lý Thời Gian (Tháng / Năm)
    const today = useMemo(() => new Date(), []);
    const todayDateStr = useMemo(
        () =>
            `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
                today.getDate()
            ).padStart(2, '0')}`,
        [today]
    );
    const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());

    // 2. State Dữ liệu Sơ đồ
    const [rooms, setRooms] = useState([]);
    const [unassignedBookings, setUnassignedBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const [toast, setToast] = useState(null);

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    // 3. State Bộ lọc & Tìm kiếm
    const [searchRoom, setSearchRoom] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterFloor, setFilterFloor] = useState('all');

    // 4. State Tooltip Nổi khi Hover
    const [hoveredBooking, setHoveredBooking] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    // 5. State Modal Chi tiết Booking & Tạo đơn nhanh từ ô trống
    const [selectedBookingModal, setSelectedBookingModal] = useState(null);
    const [quickCreatePreset, setQuickCreatePreset] = useState(null);

    // Ref cho vùng scroll để tự động cuộn đến ngày hôm nay nếu ở tháng hiện tại
    const gridScrollRef = useRef(null);

    // Chiều rộng mỗi cột ngày (px) - Tối ưu 44px hiển thị nhiều ngày hơn trên 1366/1536px
    const CELL_WIDTH = 44;

    // Tính toán số ngày trong tháng được chọn
    const daysInMonth = useMemo(() => {
        return new Date(currentYear, currentMonth, 0).getDate();
    }, [currentYear, currentMonth]);

    // Danh sách ngày trong tháng
    const daysArray = useMemo(() => {
        const days = [];
        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(currentYear, currentMonth - 1, d);
            const dayOfWeek = dateObj.getDay(); // 0: CN, 6: T7
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isToday =
                today.getDate() === d &&
                today.getMonth() + 1 === currentMonth &&
                today.getFullYear() === currentYear;

            days.push({
                day: d,
                dateStr: `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
                dayOfWeek,
                dayName: dayNames[dayOfWeek],
                isWeekend,
                isToday
            });
        }
        return days;
    }, [currentYear, currentMonth, daysInMonth, today]);

    // Gọi API lấy dữ liệu Timeline
    const fetchTimelineData = async () => {
        try {
            setIsLoading(true);
            setErrorMsg(null);
            const res = await bookingService.getTimeline({
                month: currentMonth,
                year: currentYear
            });

            if (res && res.success) {
                setRooms(res.rooms || []);
                setUnassignedBookings(res.unassigned_bookings || []);
            } else {
                setErrorMsg(res?.message || 'Không thể tải dữ liệu sơ đồ đặt phòng.');
            }
        } catch (err) {
            console.error('Lỗi khi fetch sơ đồ timeline:', err);
            setErrorMsg(err.message || 'Lỗi kết nối máy chủ.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTimelineData();
    }, [currentMonth, currentYear]);

    // Điều hướng tháng trước
    const handlePrevMonth = () => {
        if (currentMonth === 1) {
            setCurrentMonth(12);
            setCurrentYear((prev) => prev - 1);
        } else {
            setCurrentMonth((prev) => prev - 1);
        }
    };

    // Điều hướng tháng sau
    const handleNextMonth = () => {
        if (currentMonth === 12) {
            setCurrentMonth(1);
            setCurrentYear((prev) => prev + 1);
        } else {
            setCurrentMonth((prev) => prev + 1);
        }
    };

    // Nút quay về Hôm nay
    const handleJumpToToday = () => {
        const now = new Date();
        setCurrentMonth(now.getMonth() + 1);
        setCurrentYear(now.getFullYear());
    };

    // Cuộn đến ngày hôm nay nếu ở tháng hiện tại
    useEffect(() => {
        if (
            gridScrollRef.current &&
            currentMonth === today.getMonth() + 1 &&
            currentYear === today.getFullYear()
        ) {
            const todayDay = today.getDate();
            const targetScrollLeft = Math.max(0, (todayDay - 3) * CELL_WIDTH);
            gridScrollRef.current.scrollTo({
                left: targetScrollLeft,
                behavior: 'smooth'
            });
        }
    }, [currentMonth, currentYear, isLoading, today]);

    // Danh sách các Hạng phòng độc nhất để lọc
    const categoryOptions = useMemo(() => {
        const cats = new Map();
        rooms.forEach((r) => {
            if (r.category && r.category.id) {
                cats.set(r.category.id, r.category.name);
            }
        });
        return Array.from(cats.entries()).map(([id, name]) => ({ id, name }));
    }, [rooms]);

    // Danh sách các Tầng để lọc
    const floorOptions = useMemo(() => {
        const floors = new Set();
        rooms.forEach((r) => {
            if (r.floor !== undefined && r.floor !== null) {
                floors.add(r.floor);
            }
        });
        return Array.from(floors).sort((a, b) => a - b);
    }, [rooms]);

    // Danh sách phòng sau khi áp dụng bộ lọc (Tầng, Hạng phòng, Số phòng)
    const filteredRooms = useMemo(() => {
        return rooms.filter((r) => {
            if (searchRoom.trim()) {
                const q = searchRoom.trim().toLowerCase();
                const matchNum = String(r.room_number || '').toLowerCase().includes(q);
                const matchCat = String(r.category_name || '').toLowerCase().includes(q);
                if (!matchNum && !matchCat) return false;
            }
            if (filterCategory !== 'all') {
                if (String(r.category?.id) !== String(filterCategory)) return false;
            }
            if (filterFloor !== 'all') {
                if (String(r.floor) !== String(filterFloor)) return false;
            }
            return true;
        });
    }, [rooms, searchRoom, filterCategory, filterFloor]);

    // Thống kê nhanh trong tháng
    const stats = useMemo(() => {
        let totalMonthBookings = 0;
        let pendingCount = 0;
        let confirmedCount = 0;
        let checkedInCount = 0;
        let completedCount = 0;

        rooms.forEach((r) => {
            (r.bookings || []).forEach((b) => {
                totalMonthBookings++;
                if (['pending', 'paid', 'PAID'].includes(b.status)) pendingCount++;
                else if (b.status === 'confirmed') confirmedCount++;
                else if (b.status === 'checked_in') checkedInCount++;
                else if (['checked_out', 'completed'].includes(b.status)) completedCount++;
            });
        });

        return {
            totalRooms: rooms.length,
            totalBookings: totalMonthBookings + unassignedBookings.length,
            pending: pendingCount,
            confirmed: confirmedCount,
            checkedIn: checkedInCount,
            completed: completedCount
        };
    }, [rooms, unassignedBookings]);

    // Xử lý vị trí và hiển thị Tooltip khi hover thẻ đặt phòng
    const handleCardMouseEnter = (e, booking, room) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltipPos({
            x: Math.min(window.innerWidth - 320, Math.max(10, rect.left + rect.width / 2 - 140)),
            y: rect.top > 260 ? rect.top - 12 : rect.bottom + 12,
            placement: rect.top > 260 ? 'top' : 'bottom'
        });
        setHoveredBooking({ ...booking, roomInfo: room });
    };

    const handleCardMouseLeave = () => {
        setHoveredBooking(null);
    };

    // Kiểm tra một ô (Phòng + Ngày) đã có đơn chiếm chỗ hay chưa
    const isCellOccupied = (room, dateStr) => {
        return (room.bookings || []).some((b) => {
            const ci = String(b.check_in_date || '').split('T')[0];
            const co = String(b.check_out_date || '').split('T')[0];
            if (!ci || !co) return false;
            return ci === dateStr || (ci <= dateStr && dateStr < co);
        });
    };

    // Bấm vào ô ngày trống trên Timeline để mở Modal tạo đơn đặt phòng điền sẵn Phòng & Ngày
    const handleEmptyCellClick = (room, dayObj) => {
        if (!canCreateBookings) return;
        if (dayObj.dateStr < todayDateStr) {
            showToast('error', 'Chỉ có thể tạo đơn đặt phòng từ ngày hôm nay trở đi.');
            return;
        }
        const nextDate = new Date(currentYear, currentMonth - 1, dayObj.day + 1);
        const nextDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(
            nextDate.getDate()
        ).padStart(2, '0')}`;
        const isToday = dayObj.dateStr === todayDateStr;
        const canWalkInNow = isToday && room.status === 'available';

        setQuickCreatePreset({
            tab: canWalkInNow ? 'walk_in' : 'advance',
            roomId: room.id,
            roomNumber: room.room_number,
            categoryId: room.category?.id || room.category_id || '',
            checkInDate: dayObj.dateStr,
            checkOutDate: nextDateStr,
            internalNote: !canWalkInNow
                ? `Giữ phòng P.${room.room_number} (chọn từ Lịch biểu Timeline ngày ${dayObj.day}/${currentMonth}/${currentYear})`
                : ''
        });
    };

    // Hàm tính toán vị trí toạ độ pixel (Left & Width) của thẻ đặt phòng trên hàng ngang
    const calculateBookingBlock = (booking) => {
        const monthStart = new Date(currentYear, currentMonth - 1, 1);
        const monthEnd = new Date(currentYear, currentMonth - 1, daysInMonth, 23, 59, 59);

        const checkIn = new Date(booking.check_in_date);
        const checkOut = new Date(booking.check_out_date);

        const startsBeforeMonth = checkIn < monthStart;
        const endsAfterMonth = checkOut > monthEnd;

        // Ngày bắt đầu và ngày kết thúc trong tháng (1-indexed)
        const startDay = startsBeforeMonth ? 1 : checkIn.getDate();
        const endDay = endsAfterMonth ? daysInMonth : checkOut.getDate();

        // Độ dài tính theo ngày (ít nhất 1 ô)
        const diffDays = Math.max(1, endDay - startDay);

        // Vị trí Left (px)
        const left = (startDay - 1) * CELL_WIDTH + (startsBeforeMonth ? 0 : 3);

        // Độ rộng Width (px):
        // Nếu cùng ngày (diffDays === 0 do cùng ngày check-in/out): width = CELL_WIDTH - 6
        // Nếu khác ngày: width = diffDays * CELL_WIDTH - 6
        const width = Math.max(CELL_WIDTH - 6, diffDays * CELL_WIDTH - 6);

        return {
            left,
            width,
            startsBeforeMonth,
            endsAfterMonth,
            startDay,
            endDay
        };
    };

    return (
        <div className="space-y-3 animate-in fade-in duration-200">
            {/* TOAST THÔNG BÁO NỔI */}
            {toast && (
                <div
                    className={`fixed top-5 right-5 z-[99999] max-w-md px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-2 text-xs font-bold transition animate-in slide-in-from-top duration-300 ${
                        toast.type === 'success'
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30'
                            : 'bg-rose-600 text-white border-rose-500 shadow-rose-600/30'
                    }`}
                >
                    {toast.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                    ) : (
                        <AlertTriangle className="w-4 h-4 text-white shrink-0" />
                    )}
                    <span>{toast.message}</span>
                </div>
            )}

            {/* 1. HEADER & THANH ĐIỀU HƯỚNG THÁNG COMPACT */}
            <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div>
                        <h2 className="text-lg sm:text-xl font-sans font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-blue-600 shrink-0" />
                            <span>Lịch Đặt Phòng (Tape Chart)</span>
                        </h2>
                    </div>

                    {/* KPI Pills gọn ngay trên Header tiết kiệm ~120px chiều dọc */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold tabular-nums">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                            {stats.totalRooms} phòng
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {stats.checkedIn} đang ở
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                            {stats.confirmed} xác nhận
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                            {stats.pending} chờ duyệt
                        </span>
                        {canCreateBookings && (
                            <span className="hidden 2xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50/70 text-blue-700 border border-blue-200/80 font-semibold">
                                <Plus className="w-3 h-3" />
                                Bấm ô ngày trống để đặt nhanh
                            </span>
                        )}
                    </div>
                </div>

                {/* KHỐI ĐIỀU HƯỚNG THÁNG */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center bg-white text-slate-800 border border-slate-200/90 rounded-xl p-0.5 shadow-2xs">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                            title="Chuyển về tháng trước"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="px-3 py-0.5 text-center min-w-[115px] border-x border-slate-100 bg-slate-50/70 rounded mx-0.5">
                            <span className="text-xs font-black text-slate-900 tracking-tight">
                                Tháng {currentMonth} / {currentYear}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                            title="Chuyển sang tháng tiếp theo"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handleJumpToToday}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200/80 transition flex items-center gap-1 cursor-pointer"
                        title="Về tháng hiện tại"
                    >
                        <CalendarDays className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                        <span>Hôm nay</span>
                    </button>

                    <button
                        type="button"
                        onClick={fetchTimelineData}
                        disabled={isLoading}
                        className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200/90 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Tải lại dữ liệu từ CSDL"
                    >
                        <RotateCw className={`w-3.5 h-3.5 shrink-0 ${isLoading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
                    </button>
                </div>
            </div>

            {/* 2. THANH BỘ LỌC + CHÚ THÍCH MÀU (GỘP 1 HÀNG GỌN) */}
            <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                    <div className="relative w-48 sm:w-56">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute inset-y-0 left-2.5 my-auto pointer-events-none" />
                        <input
                            type="text"
                            value={searchRoom}
                            onChange={(e) => setSearchRoom(e.target.value)}
                            placeholder="Tìm số phòng (101, 202)..."
                            className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 hover:bg-white focus:bg-white rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition text-xs font-medium"
                        />
                    </div>

                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="py-1.5 px-2.5 bg-slate-50 hover:bg-white rounded-lg border border-slate-200 text-slate-700 font-medium text-xs cursor-pointer max-w-[160px]"
                    >
                        <option value="all">Tất cả Hạng phòng</option>
                        {categoryOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>

                    <select
                        value={filterFloor}
                        onChange={(e) => setFilterFloor(e.target.value)}
                        className="py-1.5 px-2.5 bg-slate-50 hover:bg-white rounded-lg border border-slate-200 text-slate-700 font-medium text-xs cursor-pointer"
                    >
                        <option value="all">Tất cả Tầng</option>
                        {floorOptions.map((f) => (
                            <option key={f} value={f}>
                                Tầng {f}
                            </option>
                        ))}
                    </select>

                    <span className="text-slate-400 text-[11px] font-medium whitespace-nowrap">
                        <strong className="text-slate-800">{filteredRooms.length}</strong>/{rooms.length} phòng
                    </span>
                </div>

                {/* Chú thích màu gọn */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200/80 text-amber-800">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>Chờ duyệt
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200/80 text-blue-800">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>Xác nhận
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200/80 text-emerald-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>Đang ở
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">
                        <span className="w-2 h-2 rounded-full bg-slate-500"></span>Đã trả
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 border border-rose-200/80 text-rose-700">
                        <span className="w-2 h-2 rounded-full bg-rose-400"></span>T7/CN
                    </span>
                </div>
            </div>

            {/* 4. SƠ ĐỒ TRỰC QUAN GANTT TIMELINE (GRID BẢNG TÍNH) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs z-40 flex flex-col items-center justify-center gap-3">
                        <div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-bold text-slate-700">Đang tải sơ đồ phòng Tháng {currentMonth}/{currentYear}...</span>
                    </div>
                )}

                {errorMsg ? (
                    <div className="p-10 text-center">
                        <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-2.5">
                            <AlertTriangle className="w-5 h-5 text-rose-600" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mb-1">Không thể tải dữ liệu sơ đồ</h4>
                        <p className="text-xs text-slate-500 mb-3">{errorMsg}</p>
                        <button
                            type="button"
                            onClick={fetchTimelineData}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
                        >
                            Thử lại
                        </button>
                    </div>
                ) : (
                    <div
                        ref={gridScrollRef}
                        className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-225px)] min-h-[380px] relative scrollbar-thin scrollbar-thumb-slate-300"
                    >
                        <div style={{ width: `${168 + daysInMonth * CELL_WIDTH}px` }} className="relative select-none">
                            {/* HÀNG TIÊU ĐỀ: DANH SÁCH NGÀY TRONG THÁNG (STICKY TOP) */}
                            <div className="sticky top-0 z-30 flex bg-slate-900 text-white border-b border-slate-800 shadow-xs">
                                <div className="w-[168px] min-w-[168px] px-3 py-2 sticky left-0 z-40 bg-slate-950 flex flex-col justify-center border-r border-slate-800">
                                    <span className="text-[11px] font-black text-white tracking-wide uppercase">
                                        Phòng / Ngày
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        Tháng {currentMonth}/{currentYear}
                                    </span>
                                </div>

                                <div className="flex">
                                    {daysArray.map((d) => (
                                        <div
                                            key={d.day}
                                            style={{ width: `${CELL_WIDTH}px`, minWidth: `${CELL_WIDTH}px` }}
                                            className={`py-1 px-0.5 text-center border-r border-slate-800 flex flex-col items-center justify-center transition ${
                                                d.isWeekend
                                                    ? 'bg-slate-950/90 text-rose-300'
                                                    : d.isToday
                                                    ? 'bg-blue-600 text-white font-black'
                                                    : 'text-slate-300'
                                            }`}
                                            title={`${d.dayName}, ngày ${d.day}/${currentMonth}/${currentYear}`}
                                        >
                                            <span className="text-[9.5px] font-bold opacity-80 block leading-none">
                                                {d.dayName}
                                            </span>
                                            <span
                                                className={`text-[11px] font-black rounded-full w-5 h-5 flex items-center justify-center mt-0.5 ${
                                                    d.isToday ? 'bg-white text-blue-700 shadow-xs' : ''
                                                }`}
                                            >
                                                {d.day}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* BODY: DANH SÁCH TỪNG PHÒNG VÀ CÁC THẺ ĐẶT PHÒNG */}
                            <div className="divide-y divide-slate-100">
                                {filteredRooms.length === 0 ? (
                                    <div className="p-12 text-center text-slate-400 text-xs">
                                        Không tìm thấy phòng nào phù hợp với bộ lọc hiện tại.
                                    </div>
                                ) : (
                                    filteredRooms.map((room) => {
                                        const roomStatusDot =
                                            room.status === 'occupied'
                                                ? 'bg-rose-500'
                                                : room.status === 'cleaning'
                                                ? 'bg-amber-500'
                                                : room.status === 'maintenance'
                                                ? 'bg-slate-400'
                                                : 'bg-emerald-500';

                                        return (
                                            <div
                                                key={room.id}
                                                className="flex h-11 hover:bg-slate-50/60 transition group relative"
                                            >
                                                <div className="w-[168px] min-w-[168px] px-2.5 py-1 sticky left-0 z-20 bg-white group-hover:bg-slate-50 border-r border-slate-200 flex flex-col justify-center shadow-xs">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <span
                                                                className={`w-2 h-2 rounded-full ${roomStatusDot} shrink-0`}
                                                                title={`Trạng thái: ${room.status_display}`}
                                                            ></span>
                                                            <span className="font-mono font-black text-slate-900 text-xs tracking-tight">
                                                                P.{room.room_number}
                                                            </span>
                                                        </div>
                                                        <span className="text-[9.5px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200/60">
                                                            T.{room.floor}
                                                        </span>
                                                    </div>
                                                    <span
                                                        className="text-[10.5px] text-slate-500 truncate block leading-tight"
                                                        title={room.category_name}
                                                    >
                                                        {room.category_name || 'Hạng tiêu chuẩn'}
                                                    </span>
                                                </div>

                                                {/* VÙNG LƯỚI NGANG (CÁC Ô NGÀY & CÁC THẺ CARD ĐẶT PHÒNG) */}
                                                <div className="flex-1 relative flex">
                                                    {/* Lớp nền các ô ngày (bấm ô trống >= hôm nay để tạo đơn nhanh) */}
                                                    {daysArray.map((d) => {
                                                        const occupied = isCellOccupied(room, d.dateStr);
                                                        const canBookCell =
                                                            canCreateBookings &&
                                                            !occupied &&
                                                            d.dateStr >= todayDateStr;
                                                        return (
                                                            <div
                                                                key={d.day}
                                                                onClick={
                                                                    canBookCell
                                                                        ? () => handleEmptyCellClick(room, d)
                                                                        : undefined
                                                                }
                                                                title={
                                                                    canBookCell
                                                                        ? `Bấm để tạo đơn cho P.${room.room_number} ngày ${d.day}/${currentMonth}/${currentYear}`
                                                                        : undefined
                                                                }
                                                                style={{
                                                                    width: `${CELL_WIDTH}px`,
                                                                    minWidth: `${CELL_WIDTH}px`
                                                                }}
                                                                className={`h-full border-r border-slate-100 shrink-0 relative ${
                                                                    d.isWeekend
                                                                        ? 'bg-rose-50/40'
                                                                        : d.isToday
                                                                        ? 'bg-blue-50/40'
                                                                        : 'bg-transparent'
                                                                } ${
                                                                    canBookCell
                                                                        ? 'cursor-pointer hover:bg-blue-100/70 transition-colors group/cell'
                                                                        : ''
                                                                }`}
                                                            >
                                                                {canBookCell && (
                                                                    <span className="opacity-0 group-hover/cell:opacity-100 transition-opacity absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                        <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center shadow-xs">
                                                                            <Plus className="w-3 h-3 stroke-[2.5]" />
                                                                        </span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}

                                                    {/* Lớp hiển thị các Thẻ Đặt Phòng (Booking Cards) Thông Minh */}
                                                    {(room.bookings || []).map((booking) => {
                                                        const {
                                                            left,
                                                            width,
                                                            startsBeforeMonth,
                                                            endsAfterMonth,
                                                            diffDays
                                                        } = calculateBookingBlock(booking);

                                                        const cfg =
                                                            STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;

                                                        // Phân loại độ rộng để hiển thị nội dung thông minh, không bị cắt chữ
                                                        const isNarrow = width < 85; // ~1 ngày
                                                        const isMedium = width >= 85 && width < 145; // ~2 ngày
                                                        const isWide = width >= 145; // >= 3 ngày

                                                        return (
                                                            <div
                                                                key={booking.id}
                                                                onClick={() => setSelectedBookingModal({ ...booking, roomInfo: room })}
                                                                onMouseEnter={(e) => handleCardMouseEnter(e, booking, room)}
                                                                onMouseLeave={handleCardMouseLeave}
                                                                style={{
                                                                    left: `${left}px`,
                                                                    width: `${width}px`
                                                                }}
                                                                className={`absolute top-1 h-9 rounded-lg ${cfg.bg} ${cfg.hoverBg} ${cfg.border} ${cfg.text} border shadow-xs px-2 flex items-center justify-between cursor-pointer transition-all transform hover:scale-[1.01] hover:shadow-md hover:z-20 overflow-hidden active:scale-95 ring-1 ring-white/20`}
                                                            >
                                                                {/* Mũi tên chỉ báo đơn bắt đầu từ tháng trước */}
                                                                {startsBeforeMonth && (
                                                                    <span className="text-[10px] font-bold opacity-80 mr-1 shrink-0">
                                                                        ◄
                                                                    </span>
                                                                )}

                                                                {/* NỘI DUNG THẺ THÔNG MINH THEO ĐỘ DÀI */}
                                                                {isNarrow ? (
                                                                    // Thẻ 1 ngày hẹp: Hiển thị 1 dòng tên ngắn gọn, KHÔNG ép 2 dòng gây cắt cụt
                                                                    <div className="flex-1 min-w-0 flex items-center justify-center">
                                                                        <span className="text-[11px] font-extrabold truncate text-center block w-full px-0.5 leading-tight tracking-tight">
                                                                            {booking.guest_name ? booking.guest_name.split(' ').pop() : `#${booking.booking_code?.slice(-4)}`}
                                                                        </span>
                                                                    </div>
                                                                ) : isMedium ? (
                                                                    // Thẻ 2 ngày: Hiển thị Tên + Mã đơn
                                                                    <div className="flex-1 min-w-0 pr-1">
                                                                        <span className="text-xs font-extrabold truncate block leading-tight">
                                                                            {booking.guest_name}
                                                                        </span>
                                                                        <span className="text-[10px] opacity-85 truncate block font-mono">
                                                                            #{booking.booking_code}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    // Thẻ rộng từ 3 ngày trở lên: Hiển thị Icon + Tên + Badge đêm + Mã đơn
                                                                    <div className="flex-1 min-w-0 pr-1 flex items-center gap-1.5">
                                                                        {booking.group_name ? (
                                                                            <Building2 className="w-3.5 h-3.5 shrink-0 opacity-90" />
                                                                        ) : (
                                                                            <User className="w-3.5 h-3.5 shrink-0 opacity-90" />
                                                                        )}
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="text-xs font-extrabold truncate block leading-tight">
                                                                                    {booking.guest_name}
                                                                                </span>
                                                                                <span className="text-[9px] opacity-90 shrink-0 font-bold bg-black/20 px-1 rounded">
                                                                                    {booking.nights || diffDays}đ
                                                                                </span>
                                                                            </div>
                                                                            <span className="text-[10px] opacity-85 truncate block font-mono">
                                                                                #{booking.booking_code}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Mũi tên chỉ báo đơn kéo dài sang tháng sau */}
                                                                {endsAfterMonth && (
                                                                    <span className="text-[10px] font-bold opacity-80 ml-1 shrink-0">
                                                                        ►
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 5. PHẦN ĐƠN CHỜ GÁN PHÒNG (UNASSIGNED BOOKINGS NẾU CÓ TRONG THÁNG) */}
            {unassignedBookings.length > 0 && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                            <div>
                                <h4 className="text-sm font-bold text-amber-900">
                                    Có {unassignedBookings.length} đơn đặt phòng trong tháng chưa được gán số phòng cụ thể
                                </h4>
                                <p className="text-[11px] text-amber-700">
                                    Khách đã đặt theo Hạng phòng. Lễ tân cần gán số phòng trống trước hoặc trong khi khách làm thủ tục Check-in.
                                </p>
                            </div>
                        </div>
                        {onNavigateToBookings && (
                            <button
                                type="button"
                                onClick={onNavigateToBookings}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                            >
                                Đi đến Quản lý Đặt phòng →
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
                        {unassignedBookings.map((b) => (
                            <div
                                key={b.id}
                                onClick={() => setSelectedBookingModal(b)}
                                className="p-3 bg-white rounded-2xl border border-amber-200/80 shadow-2xs hover:shadow-xs cursor-pointer transition flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-xs text-slate-900 truncate">
                                            {b.guest_name}
                                        </span>
                                        <span className="text-[10px] font-mono text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-bold">
                                            #{b.booking_code}
                                        </span>
                                    </div>
                                    <span className="text-[11px] text-slate-500 block truncate">
                                        {b.category_name || 'Hạng phòng'}
                                    </span>
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-600">
                                    <span>{formatDateDisplay(b.check_in_date)} → {formatDateDisplay(b.check_out_date)}</span>
                                    <span className="font-bold text-blue-600">({b.nights} đêm)</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 6. TOOLTIP THÔNG TIN CHI TIẾT KHI HOVER VÀO THẺ (FIXED TRÁNH BỊ CHE) */}
            {/* ========================================================================= */}
            {hoveredBooking && (
                <div
                    style={{
                        position: 'fixed',
                        left: `${tooltipPos.x}px`,
                        top: tooltipPos.placement === 'top' ? 'auto' : `${tooltipPos.y}px`,
                        bottom: tooltipPos.placement === 'top' ? `${window.innerHeight - tooltipPos.y}px` : 'auto',
                        width: '290px',
                        zIndex: 9999
                    }}
                    className="pointer-events-none bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/80 text-xs backdrop-blur-md transition-all duration-150 animate-in fade-in zoom-in-95"
                >
                    {/* Header Tooltip: Tên khách & Mã đơn */}
                    <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
                        <div>
                            <span className="font-extrabold text-white text-sm block">
                                {hoveredBooking.guest_name}
                            </span>
                            <span className="text-[10px] text-blue-400 font-mono font-bold">
                                #{hoveredBooking.booking_code}
                            </span>
                            {hoveredBooking.group_name && (
                                <span className="text-[10px] text-amber-300 flex items-center gap-1 font-bold mt-1">
                                    <Building2 className="w-3 h-3 text-amber-400" />
                                    <span>Đoàn: {hoveredBooking.group_name}</span>
                                </span>
                            )}
                        </div>
                        <span
                            className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                STATUS_CONFIG[hoveredBooking.status]?.badgeClass || 'bg-slate-800 text-slate-300'
                            }`}
                        >
                            {hoveredBooking.status_display || STATUS_CONFIG[hoveredBooking.status]?.label}
                        </span>
                    </div>

                    {/* Nội dung ngày đến - ngày đi, phòng, số đêm */}
                    <div className="space-y-2 pt-2.5 text-[11px]">
                        <div className="flex items-center justify-between text-slate-300">
                            <span className="text-slate-400 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                Ngày lưu trú:
                            </span>
                            <span className="font-bold text-white">
                                {formatDateDisplay(hoveredBooking.check_in_date)} → {formatDateDisplay(hoveredBooking.check_out_date)}
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-300">
                            <span className="text-slate-400 flex items-center gap-1.5">
                                <Moon className="w-3.5 h-3.5 text-amber-400" />
                                Thời gian:
                            </span>
                            <span className="font-extrabold text-amber-400">
                                {hoveredBooking.nights || 1} đêm
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-300">
                            <span className="text-slate-400 flex items-center gap-1.5">
                                <DoorClosed className="w-3.5 h-3.5 text-emerald-400" />
                                Số phòng:
                            </span>
                            <span className="font-black text-emerald-400 font-mono">
                                {hoveredBooking.room_number ? `P.${hoveredBooking.room_number}` : 'Chưa gán số'}
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-300">
                            <span className="text-slate-400 flex items-center gap-1.5">
                                <BedDouble className="w-3.5 h-3.5 text-slate-400" />
                                Hạng phòng:
                            </span>
                            <span className="font-medium text-slate-200 truncate max-w-[150px]">
                                {hoveredBooking.category_name || 'Tiêu chuẩn'}
                            </span>
                        </div>

                        {hoveredBooking.guest_phone && (
                            <div className="flex items-center justify-between text-slate-300">
                                <span className="text-slate-400 flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                                    Điện thoại:
                                </span>
                                <span className="font-mono text-slate-200 font-bold">{hoveredBooking.guest_phone}</span>
                            </div>
                        )}

                        {hoveredBooking.service_amount > 0 && (
                            <div className="flex items-center justify-between text-slate-300 text-[11px]">
                                <span className="text-slate-400 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                    Tiền dịch vụ:
                                </span>
                                <span className="font-bold text-amber-400">
                                    +{Number(hoveredBooking.service_amount).toLocaleString('vi-VN')} VND
                                </span>
                            </div>
                        )}

                        <div className="flex items-center justify-between text-slate-300 pt-2 border-t border-slate-800">
                            <span className="text-slate-400 flex items-center gap-1.5">
                                <CreditCard className="w-3.5 h-3.5 text-rose-400" />
                                Tổng tiền:
                            </span>
                            <span className="font-black text-rose-400 text-xs">
                                {Number(hoveredBooking.grand_total_amount || hoveredBooking.total_amount || 0).toLocaleString('vi-VN')} VND
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 7. MODAL XEM CHI TIẾT NHANH KHI CLICK VÀO THẺ ĐẶT PHÒNG */}
            {/* ========================================================================= */}
            {selectedBookingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-blue-400 shrink-0">
                                    <FileText className="w-4.5 h-4.5" />
                                </div>
                                <div>
                                    <h3 className="font-sans font-bold text-base text-white">
                                        Đơn Đặt Phòng <span className="font-mono">#{selectedBookingModal.booking_code}</span>
                                    </h3>
                                    <span className="text-[11px] text-slate-400">
                                        Chi tiết đơn lưu trú trên sơ đồ PMS
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedBookingModal(null)}
                                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-3.5 text-xs overflow-y-auto flex-1">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                                        Khách đại diện phòng
                                    </span>
                                    <strong className="text-sm font-extrabold text-slate-900 block mt-0.5">
                                        {selectedBookingModal.guest_name}
                                    </strong>
                                    {selectedBookingModal.group_name && (
                                        <span className="text-xs text-amber-700 font-bold flex items-center gap-1.5 mt-1">
                                            <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                            <span>Thuộc đoàn: {selectedBookingModal.group_name} {selectedBookingModal.booker_name ? `(Trưởng đoàn: ${selectedBookingModal.booker_name})` : ''}</span>
                                        </span>
                                    )}
                                    {selectedBookingModal.occupants && selectedBookingModal.occupants.length > 1 && (
                                        <span className="text-[11px] text-slate-600 flex items-center gap-1 mt-1">
                                            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span>Khách cùng phòng: {selectedBookingModal.occupants.join(', ')}</span>
                                        </span>
                                    )}
                                    <span className="text-[11px] text-slate-500 block mt-0.5 font-medium">
                                        {selectedBookingModal.guest_phone || selectedBookingModal.guest_email || '—'}
                                    </span>
                                </div>
                                <span
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                                        STATUS_CONFIG[selectedBookingModal.status]?.badgeClass || 'bg-slate-100 text-slate-700'
                                    }`}
                                >
                                    {selectedBookingModal.status_display || selectedBookingModal.status}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Số phòng</span>
                                    <strong className="text-sm text-emerald-700 block mt-0.5 font-mono font-black">
                                        {selectedBookingModal.room_number ? `P.${selectedBookingModal.room_number}` : 'Chưa gán số'}
                                    </strong>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Hạng phòng</span>
                                    <strong className="text-xs text-slate-800 block mt-0.5 truncate font-bold">
                                        {selectedBookingModal.category_name || 'Tiêu chuẩn'}
                                    </strong>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Check-in (Đến)</span>
                                    <strong className="text-xs text-slate-900 block mt-0.5 font-bold">
                                        {formatDateDisplay(selectedBookingModal.check_in_date)}
                                    </strong>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Check-out (Đi)</span>
                                    <strong className="text-xs text-slate-900 block mt-0.5 font-bold">
                                        {formatDateDisplay(selectedBookingModal.check_out_date)}
                                    </strong>
                                </div>
                            </div>

                            {selectedBookingModal.service_amount > 0 && (
                                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 flex items-center justify-between">
                                    <span className="text-slate-600 font-medium flex items-center gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                        Phụ phí & Dịch vụ phòng:
                                    </span>
                                    <strong className="text-xs text-amber-700 font-black">
                                        +{Number(selectedBookingModal.service_amount).toLocaleString('vi-VN')} VND
                                    </strong>
                                </div>
                            )}

                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                <span className="font-bold text-slate-600">Tổng tiền thanh toán:</span>
                                <strong className="text-base text-rose-600 font-black">
                                    {Number(selectedBookingModal.grand_total_amount || selectedBookingModal.total_amount || 0).toLocaleString('vi-VN')} VND
                                </strong>
                            </div>

                            {selectedBookingModal.note && (
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Ghi chú của khách:</span>
                                    <p className="text-slate-700 italic">{selectedBookingModal.note}</p>
                                </div>
                            )}

                            {selectedBookingModal.internal_note && (
                                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                                    <span className="text-[10px] font-bold text-amber-700 uppercase block mb-1">Ghi chú nội bộ lễ tân:</span>
                                    <p className="text-amber-900 whitespace-pre-line">{selectedBookingModal.internal_note}</p>
                                </div>
                            )}
                        </div>

                        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => setSelectedBookingModal(null)}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
                            >
                                Đóng
                            </button>
                            {onNavigateToBookings && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedBookingModal(null);
                                        onNavigateToBookings();
                                    }}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                                >
                                    <span>Quản lý chi tiết & Xử lý đơn</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 8. MODAL TẠO ĐƠN ĐẶT PHÒNG NHANH KHI BẤM Ô TRỐNG TRÊN TIMELINE */}
            <WalkInBookingModal
                isOpen={Boolean(quickCreatePreset)}
                initialTab={quickCreatePreset?.tab || 'walk_in'}
                initialPreset={quickCreatePreset}
                canCreateBookings={canCreateBookings}
                onClose={() => setQuickCreatePreset(null)}
                onSuccess={() => {
                    fetchTimelineData();
                }}
                showToast={showToast}
            />
        </div>
    );
}
