import React, { useState, useEffect } from 'react';
import roomService from '../../services/roomService';

// =========================================================================
// CẤU HÌNH TRẠNG THÁI PHÒNG & MÀU SẮC CHUẨN PMS KHÁCH SẠN
// =========================================================================
export const ROOM_STATUSES = {
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

export default function RoomManagement() {
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

    // 1. Tải danh sách phòng từ API
    const fetchRooms = async () => {
        setIsLoading(true);
        const params = {};
        if (searchTerm) params.q = searchTerm;
        if (floorFilter !== 'all') params.floor = floorFilter;
        if (statusFilter !== 'all') params.status = statusFilter;
        if (categoryFilter !== 'all') params.category = categoryFilter;

        const res = await roomService.getAdminRooms(params);
        if (res.success) {
            setRooms(res.rooms || []);
            if (res.categories) setCategories(res.categories);
            if (res.floors) setFloors(res.floors);
            if (res.stats) setStats(res.stats);
        }
        setIsLoading(false);
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
        setQuickStatusLoadingId(roomId);
        const res = await roomService.updateRoomStatus(roomId, newStatus);
        setQuickStatusLoadingId(null);

        if (res.success) {
            // Cập nhật trạng thái trực tiếp trên state để UI phản hồi ngay lập tức
            setRooms((prev) =>
                prev.map((r) =>
                    r.id === roomId
                        ? { ...r, status: newStatus, status_display: res.room.status_display }
                        : r
                )
            );
            // Cập nhật lại stats
            fetchRooms();

            const statusObj = ROOM_STATUSES[newStatus] || {};
            setAlertMessage({
                type: 'success',
                text: `Phòng ${roomNumber} đã được chuyển sang trạng thái "${statusObj.label || newStatus}" thành công!`,
            });
            setTimeout(() => setAlertMessage(null), 3500);
        } else {
            setAlertMessage({
                type: 'error',
                text: res.message || 'Không thể đổi trạng thái phòng.',
            });
            setTimeout(() => setAlertMessage(null), 3500);
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
            fetchRooms();
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
            fetchRooms();
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
            fetchRooms();
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
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase tracking-wider">
                            HOTEL PMS • ROOM BOARD
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500">Sơ đồ phòng khách sạn trực quan</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Quản Lý Danh Sách & Sơ Đồ Phòng Thực Tế
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Kiểm soát trạng thái phòng thời gian thực, hỗ trợ Lễ tân đổi nhanh tình trạng phòng và cập nhật phòng mới.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={fetchRooms}
                        className="px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        title="Tải lại sơ đồ phòng"
                    >
                        <span>🔄</span>
                        <span className="hidden sm:inline">Làm Mới</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer"
                    >
                        <span>＋</span>
                        <span>Thêm Phòng Mới</span>
                    </button>
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
                    <span className="text-slate-400 italic">
                        Hiển thị <strong>{rooms.length}</strong> / {stats.total} phòng
                    </span>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* GRID LAYOUT: SƠ ĐỒ PHÒNG THỰC TẾ (ROOM BOARD) */}
            {/* ========================================================================= */}
            {isLoading ? (
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
                                            formatCurrency={formatCurrency}
                                            isLoading={quickStatusLoadingId === room.id}
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
                                formatCurrency={formatCurrency}
                                isLoading={quickStatusLoadingId === room.id}
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
        </div>
    );
}

// =========================================================================
// THẺ PHÒNG (ROOM CARD) - THIẾT KẾ GRID LAYOUT CHUẨN 5 SAO
// =========================================================================
function RoomCard({ room, onStatusChange, onEdit, onDelete, formatCurrency, isLoading }) {
    const statusConfig = ROOM_STATUSES[room.status] || ROOM_STATUSES.available;
    const [isMenuOpen, setIsMenuOpen] = useState(false);

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

                    {/* Badge tầng & Menu Sửa/Xóa */}
                    <div className="flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded-md bg-white/80 border border-slate-200/80 text-[10px] font-bold text-slate-600 shadow-2xs">
                            {room.floor}F
                        </span>
                        <button
                            type="button"
                            onClick={() => onEdit(room)}
                            className="w-6 h-6 rounded-md hover:bg-white text-slate-400 hover:text-slate-700 flex items-center justify-center text-xs transition cursor-pointer opacity-80 group-hover:opacity-100"
                            title="Chỉnh sửa thông tin phòng"
                        >
                            ✏️
                        </button>
                    </div>
                </div>

                {/* Tên hạng phòng nhỏ hơn ở dưới */}
                <div className="min-h-[32px]">
                    <h4
                        className="font-bold text-xs text-slate-800 line-clamp-2 leading-tight"
                        title={room.category_name}
                    >
                        {room.category_name}
                    </h4>
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                        {room.category_bed_type || '1 Giường King'}
                    </span>
                </div>
            </div>

            {/* Giá cơ bản */}
            <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
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
            {/* DROPDOWN / NÚT BẤM NHANH ĐỔI TRỰC TIẾP TRẠNG THÁI PHÒNG CHO LỄ TÂN */}
            {/* ========================================================================= */}
            <div className="mt-3 relative">
                <div className="flex items-center gap-1">
                    {/* Nút dropdown mở selector trạng thái */}
                    <select
                        value={room.status}
                        onChange={(e) => onStatusChange(room.id, e.target.value, room.room_number)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 hover:border-slate-400 rounded-xl text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs transition cursor-pointer"
                        title="Bấm để Lễ tân đổi nhanh trạng thái phòng này"
                    >
                        <option value="available">🟢 Trống (Available)</option>
                        <option value="occupied">🔴 Có khách (Occupied)</option>
                        <option value="cleaning">🟡 Đang dọn (Cleaning)</option>
                        <option value="maintenance">⚪ Bảo trì (Maintenance)</option>
                    </select>
                </div>

                {/* Nút hành động nhanh: Nếu đang Cleaning -> Bấm 1 click thành Available */}
                {room.status === 'cleaning' && (
                    <button
                        type="button"
                        onClick={() => onStatusChange(room.id, 'available', room.room_number)}
                        className="w-full mt-1.5 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg shadow-xs transition flex items-center justify-center gap-1 cursor-pointer animate-pulse"
                        title="Bấm nhanh để xác nhận phòng dọn xong sẵn sàng đón khách"
                    >
                        <span>✓</span>
                        <span>Đã dọn xong → Sẵn sàng đón khách</span>
                    </button>
                )}

                {/* Nếu đang Available -> Bấm 1 click thành Occupied (Check-in nhanh) */}
                {room.status === 'available' && (
                    <button
                        type="button"
                        onClick={() => onStatusChange(room.id, 'occupied', room.room_number)}
                        className="w-full mt-1.5 py-1 px-2 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
                        title="Bấm nhanh khi khách nhận phòng"
                    >
                        <span>🔑</span>
                        <span>Gán khách nhận phòng</span>
                    </button>
                )}

                {/* Nếu đang Occupied -> Bấm 1 click thành Cleaning (Khách Check-out) */}
                {room.status === 'occupied' && (
                    <button
                        type="button"
                        onClick={() => onStatusChange(room.id, 'cleaning', room.room_number)}
                        className="w-full mt-1.5 py-1 px-2 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-lg shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
                        title="Bấm nhanh khi khách trả phòng để báo buồng phòng dọn dẹp"
                    >
                        <span>🧹</span>
                        <span>Khách trả phòng → Báo dọn</span>
                    </button>
                )}
            </div>
        </div>
    );
}
