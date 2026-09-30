import React, { useState, useEffect, useMemo, useRef } from 'react';
import hotelService from '../../services/hotelService';

// Format thời gian trôi qua dạng "Vừa xong", "5 phút trước", "1 giờ trước"
const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHours = Math.floor(diffMin / 60);

        if (diffSec < 60) return 'Vừa đặt lệnh';
        if (diffMin < 60) return `${diffMin} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString('vi-VN');
    } catch {
        return dateStr;
    }
};

export default function ServiceRequestKanban() {
    // 1. Data States
    const [kanbanData, setKanbanData] = useState({
        pending: [],
        in_progress: [],
        completed: [],
        cancelled: [],
        stats: { total: 0, pending_count: 0, in_progress_count: 0, completed_count: 0, total_revenue: 0 }
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdatingId, setIsUpdatingId] = useState(null);

    // 2. Filter & Search
    const [searchKeyword, setSearchKeyword] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
    const [showCancelled, setShowCancelled] = useState(false);

    // 3. Drag and Drop States
    const [draggedItemId, setDraggedItemId] = useState(null);
    const [activeDropZone, setActiveDropZone] = useState(null); // 'pending' | 'in_progress' | 'completed'

    // 4. Toast
    const [toast, setToast] = useState(null);

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    };

    // Tải dữ liệu Kanban từ API
    const fetchKanbanData = async (isSilent = false) => {
        try {
            if (!isSilent) setIsLoading(true);
            const res = await hotelService.getKanbanRequests();
            if (res && res.success) {
                setKanbanData(res.kanban);
            } else if (!isSilent) {
                showToast('error', res?.message || 'Không thể tải bảng điều phối dịch vụ.');
            }
        } catch (error) {
            if (!isSilent) showToast('error', 'Lỗi kết nối khi tải Kanban.');
        } finally {
            if (!isSilent) setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchKanbanData();

        // 1. Polling tự động mỗi 6 giây để nhân viên nhận đơn mới ngay lập tức
        const interval = setInterval(() => {
            fetchKanbanData(true);
        }, 6000);

        // 2. Lắng nghe sự kiện khách vừa gọi dịch vụ ở tab khác (cross-tab sync)
        const handleStorage = (e) => {
            if (e.key === 'pms_last_service_event') {
                fetchKanbanData(true);
            }
        };
        const handleCustomService = () => fetchKanbanData(true);

        window.addEventListener('storage', handleStorage);
        window.addEventListener('pms_service_created', handleCustomService);
        window.addEventListener('pms_service_updated', handleCustomService);
        window.addEventListener('focus', () => fetchKanbanData(true));

        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('pms_service_created', handleCustomService);
            window.removeEventListener('pms_service_updated', handleCustomService);
        };
    }, []);

    // Xử lý cập nhật trạng thái thẻ (Dùng chung cho cả Drag & Drop và Nút bấm)
    const handleUpdateStatus = async (itemId, newStatus) => {
        if (!itemId || !newStatus) return;

        // Tìm thẻ hiện tại trong state
        let currentItem = null;
        let sourceColumn = null;
        for (const col of ['pending', 'in_progress', 'completed', 'cancelled']) {
            const found = kanbanData[col]?.find((item) => item.id === itemId);
            if (found) {
                currentItem = found;
                sourceColumn = col;
                break;
            }
        }

        if (!currentItem || sourceColumn === newStatus) return;

        // Lưu bản sao cũ để rollback nếu lỗi
        const previousState = { ...kanbanData };

        // Cập nhật Optimistic trên UI
        setKanbanData((prev) => {
            const updatedItem = { ...currentItem, status: newStatus };
            const newSourceList = prev[sourceColumn].filter((i) => i.id !== itemId);
            const newTargetList = [updatedItem, ...prev[newStatus]];

            return {
                ...prev,
                [sourceColumn]: newSourceList,
                [newStatus]: newTargetList,
                stats: {
                    ...prev.stats,
                    pending_count: newStatus === 'pending' ? prev.stats.pending_count + 1 : (sourceColumn === 'pending' ? prev.stats.pending_count - 1 : prev.stats.pending_count),
                    in_progress_count: newStatus === 'in_progress' ? prev.stats.in_progress_count + 1 : (sourceColumn === 'in_progress' ? prev.stats.in_progress_count - 1 : prev.stats.in_progress_count),
                    completed_count: newStatus === 'completed' ? prev.stats.completed_count + 1 : (sourceColumn === 'completed' ? prev.stats.completed_count - 1 : prev.stats.completed_count)
                }
            };
        });

        try {
            setIsUpdatingId(itemId);
            const res = await hotelService.updateServiceRequestStatus(itemId, newStatus);

            if (res && res.success) {
                const statusLabels = {
                    pending: 'Chờ xử lý',
                    in_progress: 'Đang thực hiện',
                    completed: 'Hoàn thành (Đã ghi nhận vào hóa đơn phòng)',
                    cancelled: 'Đã hủy'
                };
                showToast('success', `Đã chuyển yêu cầu phòng ${currentItem.room_number} sang "${statusLabels[newStatus]}".`);
                fetchKanbanData(true);
            } else {
                setKanbanData(previousState);
                showToast('error', res?.message || 'Không thể chuyển trạng thái.');
            }
        } catch (error) {
            setKanbanData(previousState);
            showToast('error', error.message || 'Lỗi kết nối máy chủ.');
        } finally {
            setIsUpdatingId(null);
        }
    };

    // =========================================================================
    // DRAG AND DROP HANDLERS (HTML5 NATIVE API)
    // =========================================================================
    const handleDragStart = (e, itemId) => {
        setDraggedItemId(itemId);
        e.dataTransfer.setData('text/plain', String(itemId));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, columnKey) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (activeDropZone !== columnKey) {
            setActiveDropZone(columnKey);
        }
    };

    const handleDragLeave = (e) => {
        // Chỉ reset khi rời hẳn khỏi container cột
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setActiveDropZone(null);
        }
    };

    const handleDrop = (e, targetColumnKey) => {
        e.preventDefault();
        setActiveDropZone(null);
        const itemIdStr = e.dataTransfer.getData('text/plain') || draggedItemId;
        const itemId = Number(itemIdStr);

        if (itemId) {
            handleUpdateStatus(itemId, targetColumnKey);
        }
        setDraggedItemId(null);
    };

    const handleDragEnd = () => {
        setDraggedItemId(null);
        setActiveDropZone(null);
    };

    // Lọc danh sách thẻ trong từng cột theo từ khóa tìm kiếm
    const filterColumnItems = (items = []) => {
        if (!searchKeyword.trim() && selectedCategoryFilter === 'all') {
            return items;
        }

        return items.filter((item) => {
            const q = searchKeyword.trim().toLowerCase();
            const matchSearch =
                !q ||
                String(item.room_number).toLowerCase().includes(q) ||
                item.service_name?.toLowerCase().includes(q) ||
                item.guest_name?.toLowerCase().includes(q) ||
                item.booking_code?.toLowerCase().includes(q) ||
                item.note?.toLowerCase().includes(q);

            const matchCat =
                selectedCategoryFilter === 'all' ||
                item.category_name?.toLowerCase().includes(selectedCategoryFilter.toLowerCase());

            return matchSearch && matchCat;
        });
    };

    // Cấu hình hiển thị 3 cột chính
    const columns = [
        {
            key: 'pending',
            title: 'Chờ xử lý (Pending)',
            icon: '⏳',
            headerBg: 'bg-amber-500/10 text-amber-800 border-amber-300',
            badgeBg: 'bg-amber-500 text-white',
            borderColor: 'border-amber-200',
            accentHover: 'hover:border-amber-400',
            dropHighlight: 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/30'
        },
        {
            key: 'in_progress',
            title: 'Đang làm (In Progress)',
            icon: '👨‍🍳',
            headerBg: 'bg-blue-500/10 text-blue-800 border-blue-300',
            badgeBg: 'bg-blue-600 text-white',
            borderColor: 'border-blue-200',
            accentHover: 'hover:border-blue-400',
            dropHighlight: 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-400/30'
        },
        {
            key: 'completed',
            title: 'Hoàn thành (Completed)',
            icon: '✓',
            headerBg: 'bg-emerald-500/10 text-emerald-800 border-emerald-300',
            badgeBg: 'bg-emerald-600 text-white',
            borderColor: 'border-emerald-200',
            accentHover: 'hover:border-emerald-400',
            dropHighlight: 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-400/30'
        }
    ];

    const stats = kanbanData.stats || {};

    return (
        <div className="space-y-6">
            {/* TOAST THÔNG BÁO */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 animate-bounce">
                    <div
                        className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-xs font-semibold backdrop-blur-md ${
                            toast.type === 'success'
                                ? 'bg-emerald-900/90 text-white border border-emerald-500/40 shadow-emerald-900/30'
                                : 'bg-rose-900/90 text-white border border-rose-500/40 shadow-rose-900/30'
                        }`}
                    >
                        <span className="text-base">{toast.type === 'success' ? '✅' : '⚠️'}</span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}

            {/* HEADER & THỐNG KÊ NHANH 4 CHỈ SỐ */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase tracking-wider">
                            PMS CONCIERGE & IN-ROOM DINING
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Live Sync thời gian thực
                        </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                        Quản Lý Yêu Cầu Dịch Vụ Tại Phòng
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Điều phối gọi món, đồ uống, trị liệu spa và tiện ích buồng phòng theo mô hình Kanban kéo thả.
                    </p>
                </div>

                {/* 4 Mini Stat Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Tổng yêu cầu</span>
                        <strong className="text-base font-black text-slate-900">{stats.total || 0}</strong>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 text-center">
                        <span className="text-[10px] text-amber-700 block font-bold uppercase">Chờ xử lý</span>
                        <strong className="text-base font-black text-amber-600">{stats.pending_count || 0}</strong>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                        <span className="text-[10px] text-blue-700 block font-bold uppercase">Đang làm</span>
                        <strong className="text-base font-black text-blue-600">{stats.in_progress_count || 0}</strong>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                        <span className="text-[10px] text-emerald-700 block font-bold uppercase">Doanh thu dịch vụ</span>
                        <strong className="text-xs font-black text-emerald-600 block truncate">
                            {Number(stats.total_revenue || 0).toLocaleString('vi-VN')} đ
                        </strong>
                    </div>
                </div>
            </div>

            {/* BỘ LỌC TÌM KIẾM & NÚT THAO TÁC */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl border border-slate-200 shadow-xs text-xs">
                {/* Search Input */}
                <div className="relative w-full sm:w-80">
                    <input
                        type="text"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        placeholder="Tìm số phòng, mã đơn, tên khách, món..."
                        className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
                    {searchKeyword && (
                        <button
                            type="button"
                            onClick={() => setSearchKeyword('')}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Filter & Action Buttons */}
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                    <button
                        type="button"
                        onClick={() => fetchKanbanData(false)}
                        disabled={isLoading}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                        <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
                        <span>Làm mới</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowCancelled(!showCancelled)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                            showCancelled
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        <span>✕ Đơn đã hủy ({kanbanData.cancelled?.length || 0})</span>
                    </button>
                </div>
            </div>

            {/* BẢNG KANBAN BOARD 3 CỘT (DRAG AND DROP) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                {columns.map((col) => {
                    const columnItems = filterColumnItems(kanbanData[col.key] || []);
                    const isDropTarget = activeDropZone === col.key;

                    return (
                        <div
                            key={col.key}
                            onDragOver={(e) => handleDragOver(e, col.key)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, col.key)}
                            className={`bg-slate-100/70 rounded-3xl border ${
                                col.borderColor
                            } p-4 flex flex-col min-h-[580px] transition-all duration-200 ${
                                isDropTarget ? col.dropHighlight : ''
                            }`}
                        >
                            {/* Column Header */}
                            <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-200/80">
                                <div className="flex items-center gap-2">
                                    <span className="text-base">{col.icon}</span>
                                    <h3 className="font-bold text-xs text-slate-900 tracking-wide uppercase">
                                        {col.title}
                                    </h3>
                                </div>
                                <span
                                    className={`px-2 py-0.5 rounded-full text-xs font-bold shadow-xs ${col.badgeBg}`}
                                >
                                    {columnItems.length}
                                </span>
                            </div>

                            {/* Cards Container */}
                            <div className="flex-1 space-y-3.5 overflow-y-auto max-h-[750px] pr-1 scrollbar-thin">
                                {columnItems.length === 0 ? (
                                    <div className="h-44 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 text-xs text-center p-4">
                                        <span className="text-2xl mb-1">📭</span>
                                        <span>Không có yêu cầu nào</span>
                                        <span className="text-[10px] text-slate-400 mt-0.5">
                                            Kéo thả thẻ vào đây để đổi trạng thái
                                        </span>
                                    </div>
                                ) : (
                                    columnItems.map((item) => {
                                        const isDraggingThis = draggedItemId === item.id;
                                        const isUpdatingThis = isUpdatingId === item.id;
                                        const totalAmt = Number(item.total_price) || 0;

                                        return (
                                            <div
                                                key={item.id}
                                                draggable={true}
                                                onDragStart={(e) => handleDragStart(e, item.id)}
                                                onDragEnd={handleDragEnd}
                                                className={`bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing relative overflow-hidden flex flex-col justify-between ${
                                                    col.accentHover
                                                } ${isDraggingThis ? 'opacity-40 scale-95 border-blue-400' : ''}`}
                                            >
                                                {/* Loading overlay when updating */}
                                                {isUpdatingThis && (
                                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center z-10">
                                                        <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
                                                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                            <span>Đang lưu...</span>
                                                        </div>
                                                    </div>
                                                )}

                                                <div>
                                                    {/* Card Header: Số phòng & Hạng phòng */}
                                                    <div className="flex items-start justify-between gap-2 pb-2 mb-2.5 border-b border-slate-100">
                                                        <div>
                                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-900 text-white font-mono font-bold text-xs tracking-wider shadow-xs">
                                                                <span>🚪</span>
                                                                <span>Phòng {item.room_number || 'Chờ xếp'}</span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 block mt-1 font-medium">
                                                                #{item.booking_code} • {item.guest_name}
                                                            </span>
                                                        </div>

                                                        {/* Badge nhóm dịch vụ */}
                                                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100 shrink-0">
                                                            {item.category_name || 'Dịch vụ'}
                                                        </span>
                                                    </div>

                                                    {/* Card Body: Tên dịch vụ & Số lượng */}
                                                    <div className="flex items-start gap-3 my-2">
                                                        {item.service_image ? (
                                                            <img
                                                                src={item.service_image}
                                                                alt={item.service_name}
                                                                className="w-12 h-12 rounded-xl object-cover border border-slate-100 shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center text-lg shrink-0">
                                                                🍽️
                                                            </div>
                                                        )}

                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2">
                                                                {item.service_name}
                                                            </h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold font-mono">
                                                                    x{item.quantity} suất
                                                                </span>
                                                                <span className="text-xs font-black text-rose-600">
                                                                    {totalAmt.toLocaleString('vi-VN')} đ
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Ghi chú riêng của khách (nếu có) */}
                                                    {item.note && (
                                                        <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 my-2.5 flex items-start gap-1.5">
                                                            <span className="shrink-0">💬</span>
                                                            <span className="font-medium italic leading-relaxed">
                                                                "{item.note}"
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Card Footer: Thời gian & Nút bấm chuyển trạng thái */}
                                                <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                                        <span>⏱️</span>
                                                        <span>{formatTimeAgo(item.created_at)}</span>
                                                    </span>

                                                    {/* CÁC NÚT BẤM CHUYỂN NHANH THEO CỘT */}
                                                    <div className="flex items-center gap-1.5">
                                                        {col.key === 'pending' && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateStatus(item.id, 'cancelled')}
                                                                    title="Hủy yêu cầu này"
                                                                    className="px-2 py-1 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg text-[10px] font-bold transition cursor-pointer"
                                                                >
                                                                    ✕ Hủy
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                                                                    title="Bắt đầu chuẩn bị"
                                                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                                                                >
                                                                    <span>Bắt đầu</span>
                                                                    <span>➔</span>
                                                                </button>
                                                            </>
                                                        )}

                                                        {col.key === 'in_progress' && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateStatus(item.id, 'pending')}
                                                                    title="Trả về Chờ xử lý"
                                                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition cursor-pointer"
                                                                >
                                                                    ↩ Chờ
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateStatus(item.id, 'completed')}
                                                                    title="Đã phục vụ xong tận phòng"
                                                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                                                                >
                                                                    <span>✓ Đã giao</span>
                                                                </button>
                                                            </>
                                                        )}

                                                        {col.key === 'completed' && (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                                                    ✓ Đã tính hóa đơn
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                                                                    title="Mở lại yêu cầu này"
                                                                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded text-[10px] font-bold"
                                                                >
                                                                    ↩
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* DANH SÁCH YÊU CẦU ĐÃ HỦY (EXPANDABLE) */}
            {showCancelled && (
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="text-base">✕</span>
                            <h3 className="font-bold text-sm text-slate-900">
                                Danh Sách Yêu Cầu Dịch Vụ Đã Hủy ({kanbanData.cancelled?.length || 0})
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCancelled(false)}
                            className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                        >
                            Thu gọn ▲
                        </button>
                    </div>

                    {kanbanData.cancelled?.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">Chưa có yêu cầu nào bị hủy.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {kanbanData.cancelled?.map((item) => (
                                <div
                                    key={item.id}
                                    className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2 opacity-75"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-800">
                                            Phòng {item.room_number || 'Chờ xếp'} (#{item.booking_code})
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[10px]">
                                            Đã hủy
                                        </span>
                                    </div>
                                    <div className="font-semibold text-slate-700">
                                        {item.service_name} (x{item.quantity})
                                    </div>
                                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[10px] text-slate-400">
                                        <span>{formatTimeAgo(item.created_at)}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateStatus(item.id, 'pending')}
                                            className="text-blue-600 hover:underline font-bold"
                                        >
                                            Khôi phục ↩
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
