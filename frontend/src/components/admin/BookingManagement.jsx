import React, { useState, useEffect, useMemo } from 'react';
import { bookingService } from '../../services/bookingService';

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
    { value: 'confirmed', label: 'Đã xác nhận (Confirmed)', color: 'bg-blue-50 text-blue-800 border-blue-300 focus:ring-blue-500' },
    { value: 'checked_in', label: 'Đã Check-in (Checked-in)', color: 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-emerald-500' },
    { value: 'checked_out', label: 'Đã Check-out (Checked-out)', color: 'bg-purple-50 text-purple-800 border-purple-300 focus:ring-purple-500' },
    { value: 'cancelled', label: 'Đã Hủy (Cancelled)', color: 'bg-rose-50 text-rose-800 border-rose-300 focus:ring-rose-500' }
];

export default function BookingManagement({ onBookingChanged }) {
    // 1. Quản lý State Dữ liệu
    const [bookings, setBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null); // ID của đơn đang được gọi API PATCH đổi trạng thái
    const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: '' }

    // 2. State Lọc & Tìm kiếm
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchKeyword, setSearchKeyword] = useState('');
    const [copiedCode, setCopiedCode] = useState(null);

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

    // Helper hiển thị thông báo toast
    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    };

    // Tải toàn bộ danh sách đơn đặt phòng từ API
    const fetchBookings = async () => {
        try {
            setIsLoading(true);
            const res = await bookingService.getMyBookings();
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
            } else {
                showToast('error', res?.message || 'Không thể tải danh sách đơn đặt phòng.');
            }
        } catch (error) {
            showToast('error', error.message || 'Lỗi kết nối khi tải danh sách đặt phòng.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBookings();
    }, []);

    // Xử lý đổi trạng thái nhanh trực tiếp ngay tại ô Trạng thái trong bảng (API PATCH)
    const handleQuickStatusChange = async (bookingId, newStatus) => {
        if (!bookingId || !newStatus) return;

        // Nếu chọn chuyển sang "checked_in": Bắt buộc phải thực hiện gán phòng thực tế qua Modal Check-in
        if (newStatus === 'checked_in') {
            const targetBooking = bookings.find((b) => b.id === bookingId);
            if (targetBooking) {
                handleOpenCheckInModal(targetBooking);
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
            } else {
                // Rollback nếu thất bại
                setBookings(previousBookings);
                if (selectedBooking && selectedBooking.id === bookingId) {
                    const prevStatus = previousBookings.find((b) => b.id === bookingId)?.status;
                    if (prevStatus) {
                        setSelectedBooking((prev) => ({ ...prev, status: prevStatus }));
                    }
                }
                showToast('error', res?.message || 'Không thể đổi trạng thái đơn đặt phòng.');
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
        } finally {
            setUpdatingId(null);
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
        setCheckInModalBooking(booking);
        setSelectedRoomId('');
        setCheckInNote('');
        setAvailableRooms([]);
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

    // Xác nhận hoàn tất thủ tục Check-in (Gán phòng thực tế & đổi trạng thái sang checked_in)
    const handleConfirmCheckIn = async () => {
        if (!checkInModalBooking) return;
        if (!selectedRoomId) {
            showToast('error', 'Vui lòng chọn phòng thực tế trước khi hoàn tất Check-in.');
            return;
        }

        try {
            setIsSubmittingCheckIn(true);
            const res = await bookingService.checkInBooking(checkInModalBooking.id, {
                room_id: selectedRoomId,
                internal_note: checkInNote.trim()
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

                // Thông báo ra ngoài để AdminDashboard cập nhật thống kê/badge
                if (typeof onBookingChanged === 'function') {
                    onBookingChanged();
                }
            } else {
                showToast('error', res?.message || 'Check-in thất bại. Vui lòng kiểm tra lại tình trạng phòng.');
            }
        } catch (error) {
            showToast('error', error.message || 'Lỗi kết nối máy chủ khi Check-in.');
        } finally {
            setIsSubmittingCheckIn(false);
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
        const pending = bookings.filter((b) => b.status === 'pending').length;
        const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
        const checkedIn = bookings.filter((b) => b.status === 'checked_in').length;
        const checkedOut = bookings.filter((b) => b.status === 'checked_out').length;
        const cancelled = bookings.filter((b) => b.status === 'cancelled').length;

        const totalRevenue = bookings
            .filter((b) => ['confirmed', 'checked_in', 'checked_out'].includes(b.status))
            .reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

        return { total, pending, confirmed, checkedIn, checkedOut, cancelled, totalRevenue };
    }, [bookings]);

    // Dữ liệu đã lọc theo dropdown và tìm kiếm
    const filteredBookings = useMemo(() => {
        return bookings.filter((item) => {
            // Lọc trạng thái từ Dropdown
            if (statusFilter !== 'all' && item.status !== statusFilter) {
                return false;
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
    }, [bookings, statusFilter, searchKeyword]);

    return (
        <div className="space-y-6">
            {/* TOAST THÔNG BÁO NỔI */}
            {toast && (
                <div
                    className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-2.5 text-xs font-bold transition transform animate-in slide-in-from-top duration-300 ${
                        toast.type === 'success'
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
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase tracking-wider">
                            🏨 Quản trị Lễ tân & Đón tiếp
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500 font-medium">
                            Xử lý đặt phòng thời gian thực
                        </span>
                    </div>
                    <h2 className="text-2xl font-serif font-bold text-slate-900 tracking-tight">
                        Quản Lý Danh Sách Đặt Phòng
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Theo dõi danh sách khách lưu trú, xác nhận đơn mới, kiểm tra CCCD/Hộ chiếu và cập nhật trạng thái phòng.
                    </p>
                </div>

                <div className="flex items-center gap-3">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {/* 1. Tổng đơn */}
                <div
                    onClick={() => setStatusFilter('all')}
                    className={`p-4 rounded-2xl border transition cursor-pointer ${
                        statusFilter === 'all'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-md'
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
                    className={`p-4 rounded-2xl border transition cursor-pointer ${
                        statusFilter === 'pending'
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
                    className={`p-4 rounded-2xl border transition cursor-pointer ${
                        statusFilter === 'confirmed'
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
                    className={`p-4 rounded-2xl border transition cursor-pointer ${
                        statusFilter === 'checked_in'
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

                {/* 5. Doanh thu dự kiến */}
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
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                {/* THANH FILTER DROPDOWN & TÌM KIẾM NHANH */}
                <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                        {/* 1. Thanh Filter (Dropdown) theo Trạng thái theo yêu cầu */}
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0">
                                🎯 Lọc trạng thái:
                            </label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 cursor-pointer"
                            >
                                <option value="all">Tất cả trạng thái ({stats.total})</option>
                                <option value="pending">⏳ Chờ duyệt (Pending - {stats.pending})</option>
                                <option value="confirmed">✓ Đã xác nhận (Confirmed - {stats.confirmed})</option>
                                <option value="checked_in">🏨 Đang lưu trú (Checked-in - {stats.checkedIn})</option>
                                <option value="checked_out">🏁 Đã trả phòng (Checked-out - {stats.checkedOut})</option>
                                <option value="cancelled">✕ Đã hủy (Cancelled - {stats.cancelled})</option>
                            </select>
                        </div>

                        {statusFilter !== 'all' && (
                            <button
                                type="button"
                                onClick={() => setStatusFilter('all')}
                                className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                            >
                                Đặt lại bộ lọc
                            </button>
                        )}
                    </div>

                    {/* 2. Ô tìm kiếm nhanh */}
                    <div className="relative min-w-[280px]">
                        <input
                            type="text"
                            placeholder="Tìm Mã đơn, tên khách, CCCD, SĐT, số phòng..."
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition shadow-xs"
                        />
                        <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
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

                {/* BẢNG DỮ LIỆU ĐẶT PHÒNG (DATA TABLE) */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                                <th className="py-3.5 px-4">Mã Booking</th>
                                <th className="py-3.5 px-4">Tên khách & CCCD</th>
                                <th className="py-3.5 px-4">Phòng</th>
                                <th className="py-3.5 px-4">Check-in / Check-out</th>
                                <th className="py-3.5 px-4">Tổng tiền</th>
                                <th className="py-3.5 px-4">Trạng thái (Đổi nhanh)</th>
                                <th className="py-3.5 px-4 text-center">Hành động</th>
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
                                filteredBookings.map((booking) => {
                                    const isRowUpdating = updatingId === booking.id;
                                    const totalAmountNum = Number(booking.total_amount) || 0;
                                    const statusConfig =
                                        STATUS_OPTIONS.find((s) => s.value === booking.status) || {
                                            color: 'bg-slate-100 text-slate-700 border-slate-200'
                                        };

                                    return (
                                        <tr
                                            key={booking.id}
                                            className={`hover:bg-blue-50/30 transition duration-150 ${
                                                isRowUpdating ? 'opacity-60 bg-slate-50' : ''
                                            }`}
                                        >
                                            {/* CỘT 1: MÃ BOOKING */}
                                            <td className="py-4 px-4 whitespace-nowrap">
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
                                            <td className="py-4 px-4">
                                                <div className="font-bold text-slate-900 text-xs">
                                                    {booking.guest_name}
                                                </div>
                                                <div className="text-[11px] text-slate-500 mt-0.5">
                                                    📞 {booking.guest_phone || 'Chưa có SĐT'}
                                                </div>
                                                {booking.identity_card ? (
                                                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-semibold text-slate-700 mt-1 border border-slate-200">
                                                        <span>🪪</span>
                                                        <span>{booking.identity_card}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-amber-600 italic mt-0.5 block">
                                                        Chưa có CCCD
                                                    </span>
                                                )}
                                            </td>

                                            {/* CỘT 3: PHÒNG */}
                                            <td className="py-4 px-4">
                                                <strong className="text-slate-800 block text-xs font-semibold">
                                                    {booking.room_name}
                                                </strong>
                                                <div className="mt-0.5">
                                                    {booking.room_number ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                                            Phòng {booking.room_number}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-medium border border-slate-200">
                                                            Chờ gán số phòng
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* CỘT 4: CHECK-IN / CHECK-OUT */}
                                            <td className="py-4 px-4 whitespace-nowrap">
                                                <div className="font-semibold text-slate-800 text-xs">
                                                    {formatDateDisplay(booking.check_in_date)}
                                                    <span className="text-slate-400 mx-1">→</span>
                                                    {formatDateDisplay(booking.check_out_date)}
                                                </div>
                                                <span className="inline-block mt-0.5 px-2 py-0.2 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                                                    🌙 {booking.nights || 1} đêm lưu trú
                                                </span>
                                            </td>

                                            {/* CỘT 5: TỔNG TIỀN */}
                                            <td className="py-4 px-4 whitespace-nowrap">
                                                <div className="font-black text-sm text-rose-600">
                                                    {totalAmountNum.toLocaleString('vi-VN')}
                                                    <span className="text-[10px] font-medium text-slate-400 ml-1">VND</span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 block">
                                                    {booking.note && booking.note.includes('Thanh toán:')
                                                        ? booking.note.split('Thanh toán:')[1].trim().split('|')[0]
                                                        : 'Thanh toán tại Lễ tân'}
                                                </span>
                                            </td>

                                            {/* CỘT 6: TRẠNG THÁI (SELECT DROPDOWN ĐỔI NHANH NGAY TẠI BẢNG) */}
                                            <td className="py-4 px-4 whitespace-nowrap">
                                                <div className="relative inline-block">
                                                    <select
                                                        value={booking.status}
                                                        disabled={isRowUpdating}
                                                        onChange={(e) =>
                                                            handleQuickStatusChange(booking.id, e.target.value)
                                                        }
                                                        className={`text-xs font-bold py-1.5 pl-3 pr-7 rounded-xl border shadow-xs transition cursor-pointer appearance-none focus:outline-none focus:ring-2 ${statusConfig.color}`}
                                                    >
                                                        {STATUS_OPTIONS.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {/* Caret icon */}
                                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                {isRowUpdating && (
                                                    <span className="text-[10px] text-blue-600 font-semibold block mt-1 animate-pulse">
                                                        Đang lưu...
                                                    </span>
                                                )}
                                            </td>

                                            {/* CỘT 7: HÀNH ĐỘNG */}
                                            <td className="py-4 px-4 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-2">
                                                    {booking.status === 'confirmed' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenCheckInModal(booking)}
                                                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-600/25 hover:shadow-emerald-600/40 transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95 animate-pulse hover:animate-none"
                                                            title="Thực hiện thủ tục gán phòng và Check-in cho khách"
                                                        >
                                                            <span className="text-sm">🔑</span>
                                                            <span>Thực hiện Check-in</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenDetailModal(booking)}
                                                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-bold text-xs transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                                        title="Xem toàn bộ thông tin chi tiết đơn này"
                                                    >
                                                        <span>👁️</span>
                                                        <span>Chi tiết</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>

                {/* FOOTER BẢNG: ĐẾM SỐ LƯỢNG */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-100 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <div>
                        Hiển thị <strong>{filteredBookings.length}</strong> / <strong>{bookings.length}</strong> đơn đặt phòng
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>💡 Lễ tân có thể chọn trực tiếp ô Trạng thái để cập nhật nhanh tức thì xuống CSDL.</span>
                    </div>
                </div>
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

                            {/* KHỐI 4: TÀI CHÍNH & THANH TOÁN */}
                            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                                        Tổng tiền thanh toán
                                    </span>
                                    <span className="text-[10px] text-slate-400 block">
                                        (Đã bao gồm thuế GTGT & phí dịch vụ 5%)
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="font-black text-2xl text-rose-600">
                                        {Number(selectedBooking.total_amount).toLocaleString('vi-VN')}
                                    </span>
                                    <span className="text-xs font-bold text-slate-500 ml-1">VND</span>
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
                                </div>
                            </div>
                        </div>

                        {/* Nút hành động Modal */}
                        <div className="pt-5 mt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>🖨️</span>
                                    <span>In phiếu đặt phòng</span>
                                </button>

                                {selectedBooking.status === 'confirmed' && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleOpenCheckInModal(selectedBooking);
                                        }}
                                        className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/25 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                                    >
                                        <span>🔑</span>
                                        <span>Thực hiện Check-in ngay</span>
                                    </button>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedBooking(null)}
                                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                            >
                                Đóng cửa sổ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL CHECK-IN (THỦ TỤC NHẬN PHÒNG & GÁN PHÒNG THỰC TẾ) */}
            {/* ========================================================================= */}
            {checkInModalBooking && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full p-6 sm:p-7 shadow-2xl text-left max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                        {/* Header Modal */}
                        <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-xl shadow-md shadow-emerald-500/20">
                                    🔑
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-black text-emerald-700">
                                            #{checkInModalBooking.booking_code}
                                        </span>
                                        <span className="text-xs text-slate-300">•</span>
                                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200 uppercase">
                                            Đã xác nhận (Confirmed)
                                        </span>
                                    </div>
                                    <h3 className="font-serif text-xl font-bold text-slate-900 mt-0.5">
                                        Thủ Tục Check-in Nhận Phòng
                                    </h3>
                                </div>
                            </div>

                            <button
                                type="button"
                                disabled={isSubmittingCheckIn}
                                onClick={() => setCheckInModalBooking(null)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center font-bold text-sm cursor-pointer disabled:opacity-50"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-5 text-xs">
                            {/* 1. THÔNG TIN TÓM TẮT ĐƠN ĐẶT PHÒNG */}
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200/80 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                        <span>📋</span>
                                        <span>Thông tin tóm tắt khách & phòng</span>
                                    </span>
                                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                        🌙 {checkInModalBooking.nights || 1} đêm lưu trú
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-1 text-slate-700">
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Tên khách lưu trú:</span>
                                        <strong className="text-slate-900 text-sm block truncate">
                                            👤 {checkInModalBooking.guest_name}
                                        </strong>
                                        <span className="text-[10px] text-slate-500 mt-0.5 block">
                                            📞 {checkInModalBooking.guest_phone || 'Chưa có SĐT'}
                                        </span>
                                    </div>

                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Số CCCD / Hộ chiếu:</span>
                                        <div className="mt-0.5">
                                            {checkInModalBooking.identity_card ? (
                                                <strong className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 inline-flex items-center gap-1">
                                                    <span>🪪</span>
                                                    <span>{checkInModalBooking.identity_card}</span>
                                                </strong>
                                            ) : (
                                                <span className="text-amber-600 italic font-medium">Chưa có CCCD</span>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Hạng phòng đã đặt:</span>
                                        <strong className="text-slate-900 text-xs block text-emerald-800 font-bold mt-0.5">
                                            🏨 {checkInModalBooking.room_name}
                                        </strong>
                                    </div>

                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Ngày Check-out dự kiến:</span>
                                        <strong className="text-slate-900 text-xs block mt-0.5">
                                            🗓️ {formatDateDisplay(checkInModalBooking.check_out_date)} (trước 12:00)
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            {/* 2. FORM GÁN PHÒNG THỰC TẾ (QUAN TRỌNG NHẤT) */}
                            <div className="p-4 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/20 space-y-3">
                                <div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <span>🚪</span>
                                            <span>Gán phòng thực tế đón khách</span>
                                            <span className="text-rose-500">*</span>
                                        </label>
                                        <span className="text-[11px] font-bold text-emerald-700">
                                            {availableRooms.length} phòng khả dụng
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        Hệ thống tự động lọc các phòng thực tế thuộc hạng{' '}
                                        <strong className="text-slate-800">{checkInModalBooking.room_name}</strong> và đang có trạng thái{' '}
                                        <strong className="text-emerald-700">Sẵn sàng (Available)</strong>.
                                    </p>
                                </div>

                                {/* Loading state khi fetch phòng */}
                                {isLoadingRooms && (
                                    <div className="p-5 text-center bg-white rounded-xl border border-slate-200">
                                        <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                        <span className="text-slate-500 text-xs">
                                            Đang tìm kiếm phòng trống thuộc hạng {checkInModalBooking.room_name}...
                                        </span>
                                    </div>
                                )}

                                {/* Khi không còn phòng trống nào */}
                                {!isLoadingRooms && availableRooms.length === 0 && (
                                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-2">
                                        <div className="flex items-center gap-2 font-bold text-xs">
                                            <span>⚠️</span>
                                            <span>Không có phòng trống nào thuộc hạng này đang sẵn sàng đón khách!</span>
                                        </div>
                                        <p className="text-[11px] text-rose-700">
                                            Tất cả các phòng hạng <strong>{checkInModalBooking.room_name}</strong> hiện đều đang có khách lưu trú hoặc đang dọn dẹp/bảo trì.
                                            Vui lòng kiểm tra lại sơ đồ buồng phòng hoặc giải phóng phòng trước khi Check-in.
                                        </p>
                                    </div>
                                )}

                                {/* Dropdown chọn phòng khi có phòng trống */}
                                {!isLoadingRooms && availableRooms.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <select
                                                id="check-in-select-room"
                                                value={selectedRoomId}
                                                onChange={(e) => setSelectedRoomId(e.target.value)}
                                                disabled={isSubmittingCheckIn}
                                                className="w-full px-4 py-3 bg-white border-2 border-emerald-400 focus:border-emerald-600 rounded-xl text-xs font-bold text-slate-900 shadow-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/20 transition cursor-pointer appearance-none"
                                            >
                                                {availableRooms.map((room) => (
                                                    <option key={room.id} value={room.id}>
                                                        Phòng {room.room_number} — Tầng {room.floor} ({room.category_name || checkInModalBooking.room_name}) — Sẵn sàng đón khách
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-emerald-700 font-bold">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>

                                        {/* Card tóm tắt phòng được chọn */}
                                        {(() => {
                                            const selectedRoom = availableRooms.find(
                                                (r) => String(r.id) === String(selectedRoomId)
                                            );
                                            if (!selectedRoom) return null;
                                            return (
                                                <div className="p-3 bg-white rounded-xl border border-emerald-200 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white font-black text-sm flex items-center justify-center">
                                                            {selectedRoom.room_number}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900 text-xs">
                                                                Phòng số {selectedRoom.room_number}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500">
                                                                Tầng {selectedRoom.floor} • {selectedRoom.category_name || checkInModalBooking.room_name}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                                                        🟢 Trạng thái: Sẵn sàng
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>

                            {/* 3. GHI CHÚ NỘI BỘ LỄ TÂN KHI CHECK-IN */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                        📝 Ghi chú bàn giao / Thủ tục đón tiếp:
                                    </label>
                                    <span className="text-[10px] text-slate-400">Không bắt buộc</span>
                                </div>
                                <input
                                    type="text"
                                    placeholder="VD: Đã bàn giao 2 thẻ từ phòng, đã kiểm tra CCCD, nhận cọc..."
                                    value={checkInNote}
                                    onChange={(e) => setCheckInNote(e.target.value)}
                                    disabled={isSubmittingCheckIn}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition"
                                />
                            </div>

                            {/* 4. TÓM TẮT CAM KẾT VÀ BẢO ĐẢM TỰ ĐỘNG CỦA HỆ THỐNG */}
                            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
                                <span className="text-sm">ℹ️</span>
                                <div>
                                    Khi bấm <strong>"Hoàn tất Check-in"</strong>, hệ thống sẽ thực thi Transaction đồng thời:
                                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-[10px] text-blue-800">
                                        <li>Cập nhật đơn thành <strong>Đã Check-in (checked_in)</strong> và ghi nhận thời gian nhận phòng thực tế.</li>
                                        <li>Cập nhật phòng thực tế thành <strong>Đang có khách (occupied)</strong> để tránh trùng lặp.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Footer Modal */}
                        <div className="pt-5 mt-6 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                disabled={isSubmittingCheckIn}
                                onClick={() => setCheckInModalBooking(null)}
                                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                                Hủy bỏ
                            </button>

                            <button
                                type="button"
                                disabled={
                                    isSubmittingCheckIn ||
                                    isLoadingRooms ||
                                    availableRooms.length === 0 ||
                                    !selectedRoomId
                                }
                                onClick={handleConfirmCheckIn}
                                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 cursor-pointer active:scale-95"
                            >
                                {isSubmittingCheckIn ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang hoàn tất Check-in...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>🔑</span>
                                        <span>Hoàn tất Check-in</span>
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
