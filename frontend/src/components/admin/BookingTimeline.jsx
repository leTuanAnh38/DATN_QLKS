import React, { useState, useEffect, useMemo, useRef } from 'react';
import { bookingService } from '../../services/bookingService';
import roomService from '../../services/roomService';

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

// Cấu hình màu sắc theo trạng thái
const STATUS_CONFIG = {
    pending: {
        label: 'Chờ xác nhận',
        bg: 'bg-amber-500',
        hoverBg: 'hover:bg-amber-600',
        border: 'border-amber-600',
        text: 'text-white',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300'
    },
    confirmed: {
        label: 'Đã xác nhận',
        bg: 'bg-blue-600',
        hoverBg: 'hover:bg-blue-700',
        border: 'border-blue-700',
        text: 'text-white',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-300'
    },
    checked_in: {
        label: 'Đang lưu trú',
        bg: 'bg-emerald-600',
        hoverBg: 'hover:bg-emerald-700',
        border: 'border-emerald-700',
        text: 'text-white',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300'
    },
    checked_out: {
        label: 'Đã trả phòng',
        bg: 'bg-slate-500',
        hoverBg: 'hover:bg-slate-600',
        border: 'border-slate-600',
        text: 'text-white',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300'
    },
    completed: {
        label: 'Đã hoàn tất',
        bg: 'bg-slate-500',
        hoverBg: 'hover:bg-slate-600',
        border: 'border-slate-600',
        text: 'text-white',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300'
    }
};

export default function BookingTimeline({ onNavigateToBookings }) {
    // 1. Quản lý Thời Gian (Tháng / Năm)
    const today = useMemo(() => new Date(), []);
    const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(today.getFullYear());

    // 2. State Dữ liệu Sơ đồ
    const [rooms, setRooms] = useState([]);
    const [unassignedBookings, setUnassignedBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);

    // 3. State Bộ lọc & Tìm kiếm
    const [searchRoom, setSearchRoom] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterFloor, setFilterFloor] = useState('all');

    // 4. State Tooltip Nổi khi Hover
    const [hoveredBooking, setHoveredBooking] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    // 5. State Modal Chi tiết Booking khi bấm vào thẻ
    const [selectedBookingModal, setSelectedBookingModal] = useState(null);

    // Ref cho vùng scroll để tự động cuộn đến ngày hôm nay nếu ở tháng hiện tại
    const gridScrollRef = useRef(null);

    // Chiều rộng mỗi cột ngày (px)
    const CELL_WIDTH = 46;

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
                if (b.status === 'pending') pendingCount++;
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
        <div className="space-y-6">
            {/* 1. HEADER & THANH ĐIỀU HƯỚNG THÁNG */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-serif font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                        <span>Lịch Đặt Phòng Theo Sơ Đồ Trực Quan</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Theo dõi mật độ lưu trú, phát hiện phòng trống và giám sát các đợt Check-in / Check-out theo từng phòng.
                    </p>
                </div>

                {/* KHỐI ĐIỀU HƯỚNG THÁNG "Tháng trước" < "Tháng 6 / 2026" > "Tháng sau" */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center bg-white text-slate-800 border border-slate-200 rounded-2xl p-1.5 shadow-xs">
                        {/* Nút Tháng trước */}
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition flex items-center gap-1.5 active:scale-95"
                            title="Chuyển về tháng trước"
                        >
                            <span>‹</span>
                            <span>Tháng trước</span>
                        </button>

                        {/* Nhãn Tháng / Năm hiện tại */}
                        <div className="px-4 py-1.5 text-center min-w-[150px] border-x border-slate-200 bg-blue-50/60">
                            <span className="block text-[11px] text-blue-600 uppercase tracking-widest font-bold font-mono">
                                PMS TIMELINE
                            </span>
                            <span className="text-sm font-bold text-slate-900 tracking-wide">
                                Tháng {currentMonth} / {currentYear}
                            </span>
                        </div>

                        {/* Nút Tháng sau */}
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition flex items-center gap-1.5 active:scale-95"
                            title="Chuyển sang tháng tiếp theo"
                        >
                            <span>Tháng sau</span>
                            <span>›</span>
                        </button>
                    </div>

                    {/* Nút Quay về Hôm nay */}
                    <button
                        type="button"
                        onClick={handleJumpToToday}
                        className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition flex items-center gap-1.5 active:scale-95"
                        title="Về tháng hiện tại"
                    >
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Hôm nay</span>
                    </button>

                    {/* Nút Làm mới dữ liệu */}
                    <button
                        type="button"
                        onClick={fetchTimelineData}
                        disabled={isLoading}
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 disabled:opacity-60"
                        title="Tải lại dữ liệu từ CSDL"
                    >
                        <svg className={`w-3.5 h-3.5 shrink-0 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>{isLoading ? 'Đang tải...' : 'Làm mới'}</span>
                    </button>
                </div>
            </div>

            {/* 2. CHÚ THÍCH MÀU SẮC (LEGEND) & BẢNG THỐNG KÊ NHANH */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Khối Thống kê nhanh */}
                <div className="lg:col-span-5 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-around text-center">
                    <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            Tổng Phòng
                        </span>
                        <span className="text-xl font-black text-slate-900">{stats.totalRooms}</span>
                    </div>
                    <div className="w-px h-8 bg-slate-200"></div>
                    <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-600 block tracking-wider">
                            Đang Ở
                        </span>
                        <span className="text-xl font-black text-emerald-700">{stats.checkedIn}</span>
                    </div>
                    <div className="w-px h-8 bg-slate-200"></div>
                    <div>
                        <span className="text-[10px] uppercase font-bold text-blue-600 block tracking-wider">
                            Đã Xác Nhận
                        </span>
                        <span className="text-xl font-black text-blue-700">{stats.confirmed}</span>
                    </div>
                    <div className="w-px h-8 bg-slate-200"></div>
                    <div>
                        <span className="text-[10px] uppercase font-bold text-amber-600 block tracking-wider">
                            Chờ Duyệt
                        </span>
                        <span className="text-xl font-black text-amber-600">{stats.pending}</span>
                    </div>
                </div>

                {/* Khối Chú thích màu sắc (Legend) */}
                <div className="lg:col-span-7 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Quy tắc màu:
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Chờ xác nhận (Cam) */}
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded bg-amber-500 border border-amber-600 shadow-xs shrink-0"></span>
                            <span className="text-slate-700 font-medium">Chờ xác nhận</span>
                        </div>
                        {/* Đã xác nhận (Xanh dương) */}
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded bg-blue-600 border border-blue-700 shadow-xs shrink-0"></span>
                            <span className="text-slate-700 font-medium">Đã xác nhận</span>
                        </div>
                        {/* Đang lưu trú (Xanh lá) */}
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded bg-emerald-600 border border-emerald-700 shadow-xs shrink-0"></span>
                            <span className="text-slate-700 font-medium">Đang lưu trú</span>
                        </div>
                        {/* Đã trả phòng/Trống (Xám) */}
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded bg-slate-400 border border-slate-500 shadow-xs shrink-0"></span>
                            <span className="text-slate-700 font-medium">Đã trả phòng</span>
                        </div>
                        {/* Cuối tuần (Hồng nhạt) */}
                        <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded bg-rose-100 border border-rose-300 shadow-xs shrink-0"></span>
                            <span className="text-rose-700 font-medium">Cuối tuần (T7, CN)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. THANH BỘ LỌC TÌM KIẾM THEO PHÒNG, TẦNG, HẠNG PHÒNG */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                    {/* Tìm kiếm phòng */}
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            🔍
                        </span>
                        <input
                            type="text"
                            value={searchRoom}
                            onChange={(e) => setSearchRoom(e.target.value)}
                            placeholder="Tìm theo số phòng (VD: 101, 202)..."
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition text-xs"
                        />
                    </div>

                    {/* Lọc Hạng phòng */}
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="py-2 px-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 font-medium text-xs focus:ring-2 focus:ring-blue-100"
                    >
                        <option value="all">Tất cả Hạng phòng</option>
                        {categoryOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>

                    {/* Lọc Tầng */}
                    <select
                        value={filterFloor}
                        onChange={(e) => setFilterFloor(e.target.value)}
                        className="py-2 px-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 font-medium text-xs focus:ring-2 focus:ring-blue-100"
                    >
                        <option value="all">Tất cả Tầng</option>
                        {floorOptions.map((f) => (
                            <option key={f} value={f}>
                                Tầng {f}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="text-slate-500 text-xs">
                    Hiển thị <strong>{filteredRooms.length}</strong> / <strong>{rooms.length}</strong> phòng
                </div>
            </div>

            {/* 4. SƠ ĐỒ TRỰC QUAN GANTT TIMELINE (GRID BẢNG TÍNH) */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs z-40 flex flex-col items-center justify-center gap-3">
                        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-bold text-slate-700">Đang tải sơ đồ phòng Tháng {currentMonth}/{currentYear}...</span>
                    </div>
                )}

                {errorMsg ? (
                    <div className="p-12 text-center">
                        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-xl mx-auto mb-3">
                            ⚠️
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mb-1">Không thể tải dữ liệu sơ đồ</h4>
                        <p className="text-xs text-slate-500 mb-4">{errorMsg}</p>
                        <button
                            type="button"
                            onClick={fetchTimelineData}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md"
                        >
                            Thử lại
                        </button>
                    </div>
                ) : (
                    <div
                        ref={gridScrollRef}
                        className="overflow-x-auto overflow-y-auto max-h-[750px] relative scrollbar-thin scrollbar-thumb-slate-300"
                    >
                        <div style={{ width: `${200 + daysInMonth * CELL_WIDTH}px` }} className="relative select-none">
                            {/* ========================================================================= */}
                            {/* HÀNG TIÊU ĐỀ: DANH SÁCH NGÀY TRONG THÁNG (STICKY TOP) */}
                            {/* ========================================================================= */}
                            <div className="sticky top-0 z-30 flex bg-slate-900 text-white border-b border-slate-800 shadow-xs">
                                {/* Cột Góc trên cùng bên trái (Phòng / Ngày) */}
                                <div className="w-[200px] min-w-[200px] p-3 sticky left-0 z-40 bg-slate-950 flex flex-col justify-center border-r border-slate-800">
                                    <span className="text-xs font-bold text-white tracking-wide uppercase">
                                        Phòng / Ngày
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                        Tháng {currentMonth}/{currentYear}
                                    </span>
                                </div>

                                {/* Các ô Ngày trong tháng (1, 2, 3... 30/31) */}
                                <div className="flex">
                                    {daysArray.map((d) => (
                                        <div
                                            key={d.day}
                                            style={{ width: `${CELL_WIDTH}px`, minWidth: `${CELL_WIDTH}px` }}
                                            className={`p-1.5 text-center border-r border-slate-800 flex flex-col items-center justify-center transition ${
                                                d.isWeekend
                                                    ? 'bg-rose-950/70 text-rose-200'
                                                    : d.isToday
                                                    ? 'bg-blue-600 text-white font-black'
                                                    : 'text-slate-300'
                                            }`}
                                            title={`${d.dayName}, ngày ${d.day}/${currentMonth}/${currentYear}`}
                                        >
                                            <span className="text-[10px] font-semibold opacity-80 block">
                                                {d.dayName}
                                            </span>
                                            <span
                                                className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center mt-0.5 ${
                                                    d.isToday ? 'bg-white text-blue-700 shadow-xs' : ''
                                                }`}
                                            >
                                                {d.day}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ========================================================================= */}
                            {/* BODY: DANH SÁCH TỪNG PHÒNG VÀ CÁC THẺ ĐẶT PHÒNG */}
                            {/* ========================================================================= */}
                            <div className="divide-y divide-slate-100">
                                {filteredRooms.length === 0 ? (
                                    <div className="p-16 text-center text-slate-400 text-xs">
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
                                                className="flex h-14 hover:bg-slate-50/60 transition group relative"
                                            >
                                                {/* CỘT DỌC BÊN TRÁI (STICKY LEFT): Tên phòng và Tên hạng phòng nhỏ bên dưới */}
                                                <div className="w-[200px] min-w-[200px] px-3.5 py-1.5 sticky left-0 z-20 bg-white group-hover:bg-slate-50 border-r border-slate-200 flex flex-col justify-center shadow-xs">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <span
                                                                className={`w-2 h-2 rounded-full ${roomStatusDot} shrink-0`}
                                                                title={`Trạng thái: ${room.status_display}`}
                                                            ></span>
                                                            <span className="font-bold text-slate-900 text-sm tracking-tight font-mono">
                                                                P.{room.room_number}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                                                            T.{room.floor}
                                                        </span>
                                                    </div>
                                                    <span
                                                        className="text-[11px] text-slate-500 truncate block mt-0.5"
                                                        title={room.category_name}
                                                    >
                                                        {room.category_name || 'Hạng tiêu chuẩn'}
                                                    </span>
                                                </div>

                                                {/* VÙNG LƯỚI NGANG (CÁC Ô NGÀY & CÁC THẺ CARD ĐẶT PHÒNG) */}
                                                <div className="flex-1 relative flex">
                                                    {/* Lớp nền các ô ngày */}
                                                    {daysArray.map((d) => (
                                                        <div
                                                            key={d.day}
                                                            style={{
                                                                width: `${CELL_WIDTH}px`,
                                                                minWidth: `${CELL_WIDTH}px`
                                                            }}
                                                            className={`h-full border-r border-slate-100 shrink-0 ${
                                                                d.isWeekend
                                                                    ? 'bg-rose-50/50'
                                                                    : d.isToday
                                                                    ? 'bg-blue-50/40'
                                                                    : 'bg-transparent'
                                                            }`}
                                                        ></div>
                                                    ))}

                                                    {/* Lớp hiển thị các Thẻ Đặt Phòng (Booking Cards) */}
                                                    {(room.bookings || []).map((booking) => {
                                                        const {
                                                            left,
                                                            width,
                                                            startsBeforeMonth,
                                                            endsAfterMonth
                                                        } = calculateBookingBlock(booking);

                                                        const cfg =
                                                            STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;

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
                                                                className={`absolute top-2 h-10 rounded-xl ${cfg.bg} ${cfg.hoverBg} ${cfg.border} ${cfg.text} border shadow-xs px-2 flex items-center justify-between cursor-pointer transition transform hover:scale-[1.01] hover:z-20 overflow-hidden active:scale-95`}
                                                            >
                                                                {/* Mũi tên chỉ báo đơn bắt đầu từ tháng trước */}
                                                                {startsBeforeMonth && (
                                                                    <span className="text-[10px] font-bold opacity-80 mr-1 shrink-0">
                                                                        ◄
                                                                    </span>
                                                                )}

                                                                {/* Tên khách và Mã đơn */}
                                                                <div className="flex-1 min-w-0 pr-1">
                                                                    <span className="text-xs font-bold truncate block leading-tight">
                                                                        {booking.guest_name}
                                                                    </span>
                                                                    <span className="text-[10px] opacity-85 truncate block font-mono">
                                                                        #{booking.booking_code}
                                                                    </span>
                                                                </div>

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
                            <span className="text-lg">⚠️</span>
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
                        width: '280px',
                        zIndex: 9999
                    }}
                    className="pointer-events-none bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 text-xs backdrop-blur-md transition-all duration-150 animate-in fade-in zoom-in-95"
                >
                    {/* Header Tooltip: Tên khách & Mã đơn */}
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
                        <div>
                            <span className="font-bold text-white text-sm block">
                                {hoveredBooking.guest_name}
                            </span>
                            <span className="text-[10px] text-blue-400 font-mono">
                                #{hoveredBooking.booking_code}
                            </span>
                        </div>
                        <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                STATUS_CONFIG[hoveredBooking.status]?.badgeClass || 'bg-slate-800 text-slate-300'
                            }`}
                        >
                            {hoveredBooking.status_display || STATUS_CONFIG[hoveredBooking.status]?.label}
                        </span>
                    </div>

                    {/* Nội dung ngày đến - ngày đi, phòng, số đêm */}
                    <div className="space-y-1.5 pt-2 text-[11px]">
                        <div className="flex items-center justify-between text-slate-300">
                            <span className="text-slate-400">📅 Ngày lưu trú:</span>
                            <span className="font-semibold text-white">
                                {formatDateDisplay(hoveredBooking.check_in_date)} → {formatDateDisplay(hoveredBooking.check_out_date)}
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-300">
                            <span className="text-slate-400">🌙 Thời gian:</span>
                            <span className="font-bold text-amber-400">
                                {hoveredBooking.nights || 1} đêm
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-300">
                            <span className="text-slate-400">🚪 Số phòng:</span>
                            <span className="font-bold text-emerald-400">
                                {hoveredBooking.room_number ? `Phòng ${hoveredBooking.room_number}` : 'Chưa gán số'}
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-300">
                            <span className="text-slate-400">🏷️ Hạng phòng:</span>
                            <span className="font-medium text-slate-200 truncate max-w-[150px]">
                                {hoveredBooking.category_name || 'Tiêu chuẩn'}
                            </span>
                        </div>

                        {hoveredBooking.guest_phone && (
                            <div className="flex items-center justify-between text-slate-300">
                                <span className="text-slate-400">📞 Điện thoại:</span>
                                <span className="font-mono text-slate-200">{hoveredBooking.guest_phone}</span>
                            </div>
                        )}

                        <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800">
                            <span className="text-slate-400">💰 Tổng tiền:</span>
                            <span className="font-bold text-rose-400">
                                {Number(hoveredBooking.total_amount || 0).toLocaleString('vi-VN')} VND
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 7. MODAL XEM CHI TIẾT NHANH KHI CLICK VÀO THẺ ĐẶT PHÒNG */}
            {/* ========================================================================= */}
            {selectedBookingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <span className="text-xl">📋</span>
                                <div>
                                    <h3 className="font-serif font-bold text-base">
                                        Đơn Đặt Phòng #{selectedBookingModal.booking_code}
                                    </h3>
                                    <span className="text-[11px] text-slate-400">
                                        Chi tiết đơn lưu trú trên sơ đồ PMS
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedBookingModal(null)}
                                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-xs">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                                        Khách hàng
                                    </span>
                                    <strong className="text-sm font-bold text-slate-900 block mt-0.5">
                                        {selectedBookingModal.guest_name}
                                    </strong>
                                    <span className="text-[11px] text-slate-500">
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
                                    <strong className="text-sm text-emerald-700 block mt-0.5 font-mono">
                                        {selectedBookingModal.room_number ? `Phòng ${selectedBookingModal.room_number}` : 'Chưa gán số'}
                                    </strong>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Hạng phòng</span>
                                    <strong className="text-xs text-slate-800 block mt-0.5 truncate">
                                        {selectedBookingModal.category_name || 'Tiêu chuẩn'}
                                    </strong>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Check-in (Đến)</span>
                                    <strong className="text-xs text-slate-900 block mt-0.5">
                                        {formatDateDisplay(selectedBookingModal.check_in_date)}
                                    </strong>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Check-out (Đi)</span>
                                    <strong className="text-xs text-slate-900 block mt-0.5">
                                        {formatDateDisplay(selectedBookingModal.check_out_date)}
                                    </strong>
                                </div>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                <span className="font-medium text-slate-600">Tổng tiền thanh toán:</span>
                                <strong className="text-base text-rose-600 font-bold">
                                    {Number(selectedBookingModal.total_amount || 0).toLocaleString('vi-VN')} VND
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

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setSelectedBookingModal(null)}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
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
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition"
                                >
                                    Quản lý chi tiết & Xử lý đơn →
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
