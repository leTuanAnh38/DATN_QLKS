import React from 'react';
import {
    Wrench,
    Edit3,
    UserCheck,
    KeyRound,
    Bell,
    Search,
    Check,
    Sparkles,
    AlertTriangle,
    ClipboardList,
    User,
    Wine,
    Receipt,
    Eye,
    Luggage
} from 'lucide-react';
import { ROOM_STATUSES, ISSUE_TYPE_MAP } from '../../../utils/constants';

// =========================================================================
// THẺ PHÒNG (ROOM CARD) - THIẾT KẾ GRID LAYOUT CHUẨN 5 SAO PMS
// =========================================================================
export default function RoomCard({
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
    const hasCurrentGuest = Boolean(currentBk);
    const hasGuestContext = Boolean(currentBk || room.recent_booking);
    const isCheckMatchCurrentBooking = !room.latest_minibar_check?.booking_id || !currentBk?.id || String(room.latest_minibar_check.booking_id) === String(currentBk.id);
    const isInspectionRequested = hasGuestContext && isCheckMatchCurrentBooking && room.latest_minibar_check?.status === 'requested';
    const isInspectionCompleted = hasGuestContext && isCheckMatchCurrentBooking && room.latest_minibar_check?.status === 'completed' && room.status === 'occupied';

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
            className={`relative rounded-2xl border-2 p-3.5 flex flex-col justify-between transition-all duration-200 group ${statusConfig.cardClass} ${isInspectionRequested ? 'ring-3 ring-amber-500 ring-offset-2 border-amber-500 shadow-md' : ''
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
                        <span className="text-2xl sm:text-3xl font-black font-mono tabular-nums tracking-tight text-slate-900 leading-none">
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
                        <span className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 text-amber-600" /> LỄ TÂN ĐỢI KIỂM PHÒNG</span>
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
                            <Search className="w-3 h-3" />
                            <span>Kiểm tra phòng Check-out</span>
                        </button>
                    )}
                </div>
            )}

            {isInspectionCompleted && (
                <div className="mt-1.5 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800 flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-600" /> Đã kiểm phòng</span>
                    <span className="font-mono font-bold text-emerald-900">
                        {room.latest_minibar_check.total_amount > 0 ? formatCurrency(room.latest_minibar_check.total_amount) : 'Nguyên vẹn'}
                    </span>
                </div>
            )}

            {/* THÔNG BÁO KHÁCH ĐANG Ở YÊU CẦU DỌN PHÒNG LƯU TRÚ (MAKE-UP ROOM) */}
            {room.status === 'occupied' && room.is_cleaning_requested && (
                <div className="mt-2 p-2 rounded-xl bg-blue-500/10 border-2 border-blue-500 shadow-xs space-y-1.5 animate-in fade-in">
                    <div className="flex items-center justify-between text-[10px] font-black text-blue-900">
                        <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-blue-600" /> YÊU CẦU DỌN PHÒNG</span>
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
                        <Check className="w-3 h-3" />
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
                            <Wrench className="w-3.5 h-3.5 text-amber-700 shrink-0" />
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
                        <div className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-700 bg-rose-100/80 px-1.5 py-0.2 rounded border border-rose-300">
                            <AlertTriangle className="w-2.5 h-2.5" /> Khách làm hỏng
                        </div>
                    )}
                    {onViewHistory && (
                        <button
                            type="button"
                            onClick={() => onViewHistory(room)}
                            className="w-full text-center text-[10px] text-amber-800 hover:text-amber-950 font-bold underline pt-1 cursor-pointer block"
                            title={`Xem toàn bộ lịch sử sửa chữa phòng ${room.room_number}`}
                        >
                            <span className="flex items-center justify-center gap-1"><ClipboardList className="w-3 h-3" /> Xem nhật ký sửa phòng {room.room_number}</span>
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
                            <span className="truncate flex items-center gap-1" title={room.recent_booking.guest_name}><User className="w-3 h-3 text-amber-700 shrink-0" /> {room.recent_booking.guest_name}</span>
                            <span className="font-mono text-[9px] text-amber-800 bg-white px-1 rounded border border-amber-300 shrink-0">
                                #{room.recent_booking.booking_code}
                            </span>
                        </div>
                    )}
                    {room.latest_minibar_check && (
                        <div className="flex items-center justify-between text-[10px] text-amber-800 font-semibold pt-0.5 border-t border-amber-200/60">
                            <span className="text-amber-700 flex items-center gap-1"><Wine className="w-3 h-3" /> Tiêu thụ Minibar:</span>
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

                {/* 3. Nút cho phòng Cleaning: Minibar + Báo đồ bỏ quên (nếu có khách) + Xác nhận dọn dẹp xong */}
                {room.status === 'cleaning' && (
                    <div className="space-y-1.5">
                        {hasGuestContext ? (
                            (canAccessMinibar || canReportLostItem) && (
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
                            )
                        ) : (
                            <div className="p-1 px-1.5 rounded-lg bg-amber-50/80 border border-amber-200/60 text-[9.5px] text-amber-800 flex items-center justify-center gap-1 font-medium">
                                <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                                <span className="truncate">Vệ sinh sau sửa chữa / Phòng trống</span>
                            </div>
                        )}
                        {canMarkCleaned ? (
                            <button
                                type="button"
                                onClick={() => onStatusChange(room.id, hasCurrentGuest ? 'occupied' : 'available', room.room_number)}
                                className={`w-full py-1.5 px-2 text-white text-[10px] font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                    hasCurrentGuest
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                                        : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 animate-pulse'
                                }`}
                                title={hasCurrentGuest ? 'Xác nhận dọn xong, phòng trở lại trạng thái Có khách' : 'Xác nhận buồng phòng dọn xong để đưa phòng về trạng thái Sẵn sàng'}
                            >
                                <Check className="w-3.5 h-3.5" />
                                <span>{hasCurrentGuest ? 'Dọn xong → Khách ở tiếp' : 'Đã dọn xong → Sẵn sàng'}</span>
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
                                    <option value="available">Trống (Available)</option>
                                    <option value="cleaning">Đang dọn (Cleaning)</option>
                                </>
                            ) : userRole === 'receptionist' ? (
                                <>
                                    {room.status === 'cleaning' ? (
                                        <option value="available" disabled>Trống (Chờ buồng dọn xong)</option>
                                    ) : room.status === 'maintenance' ? (
                                        <option value="available" disabled>Trống (Phải qua Đang dọn)</option>
                                    ) : (
                                        <option value="available">Trống (Available)</option>
                                    )}
                                    <option value="cleaning">Đang dọn (Cleaning)</option>
                                    <option value="maintenance">Bảo trì (Maintenance)</option>
                                </>
                            ) : (
                                <>
                                    <option value="available">Trống (Available)</option>
                                    <option value="cleaning">Đang dọn (Cleaning)</option>
                                    <option value="maintenance">Bảo trì (Maintenance)</option>
                                </>
                            )}
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
}

