import React, { useState, useEffect } from 'react';
import { DoorOpen, CheckCircle2, AlertTriangle, X, RefreshCw, Sparkles, Building, Layers, Trash2 } from 'lucide-react';
import { bookingService } from '../../../../services/bookingService';

// Helper format tiền tệ VNĐ
const formatCurrency = (amount) => {
    const num = Number(amount) || 0;
    return `${num.toLocaleString('vi-VN')}đ`;
};

// Helper format ngày hiển thị (VD: 25/10/2026)
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

export default function PreAssignRoomModal({
    isOpen,
    onClose,
    booking,
    onSuccess
}) {
    const [availableRooms, setAvailableRooms] = useState([]);
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showUnassignConfirm, setShowUnassignConfirm] = useState(false);

    const currentRoomId = booking?.room_id || (typeof booking?.room === 'object' ? booking?.room?.id : booking?.room);
    const currentRoomNumber = booking?.room_number || (typeof booking?.room === 'object' ? booking?.room?.room_number : null);

    // Reset state whenever modal opens
    useEffect(() => {
        if (!isOpen || !booking?.id) return;
        setErrorMessage('');
        setIsSubmitting(false);
        setShowAllCategories(false);
        setSelectedRoomId(currentRoomId ? String(currentRoomId) : '');
    }, [isOpen, booking?.id, currentRoomId]);

    // Load available rooms
    useEffect(() => {
        if (!isOpen || !booking?.id) return;

        let isMounted = true;
        const fetchRooms = async () => {
            setIsLoadingRooms(true);
            setErrorMessage('');
            try {
                const catId = booking.category_id || booking.category?.id;
                const res = await bookingService.getAvailableRoomsForBooking(
                    booking.id,
                    showAllCategories ? null : catId,
                    Boolean(showAllCategories)
                );

                if (isMounted && res && res.rooms) {
                    setAvailableRooms(res.rooms);
                    // Nếu đã có phòng gán trước đó và phòng đó nằm trong danh sách
                    if (currentRoomId && res.rooms.some(r => String(r.id) === String(currentRoomId))) {
                        setSelectedRoomId(String(currentRoomId));
                    } else if (res.rooms.length > 0 && !selectedRoomId) {
                        setSelectedRoomId(String(res.rooms[0].id));
                    }
                } else if (isMounted) {
                    setAvailableRooms([]);
                }
            } catch (err) {
                console.error('Lỗi lấy danh sách phòng trống:', err);
                if (isMounted) setErrorMessage('Không thể tải danh sách phòng khả dụng. Vui lòng thử lại.');
            } finally {
                if (isMounted) setIsLoadingRooms(false);
            }
        };

        fetchRooms();
        return () => {
            isMounted = false;
        };
    }, [isOpen, booking?.id, showAllCategories]);

    if (!isOpen || !booking) return null;

    const handleAssign = async () => {
        if (!selectedRoomId) {
            setErrorMessage('Vui lòng chọn phòng cụ thể để gán trước.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');
        try {
            const res = await bookingService.preAssignRoom(booking.id, Number(selectedRoomId));
            if (res.success) {
                if (onSuccess) {
                    onSuccess(res.data);
                }
                onClose();
            } else {
                setErrorMessage(res.message || 'Không thể gán phòng trước.');
            }
        } catch (err) {
            console.error('Lỗi khi gán phòng trước:', err);
            setErrorMessage('Đã xảy ra lỗi khi gán phòng. Vui lòng kiểm tra lại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUnassign = () => {
        setShowUnassignConfirm(true);
    };

    const executeUnassign = async () => {
        setIsSubmitting(true);
        setErrorMessage('');
        try {
            const res = await bookingService.preAssignRoom(booking.id, null);
            if (res.success) {
                setShowUnassignConfirm(false);
                if (onSuccess) {
                    onSuccess(res.data);
                }
                onClose();
            } else {
                setErrorMessage(res.message || 'Không thể hủy gán phòng.');
                setShowUnassignConfirm(false);
            }
        } catch (err) {
            console.error('Lỗi khi hủy gán phòng:', err);
            setErrorMessage('Đã xảy ra lỗi khi hủy gán phòng.');
            setShowUnassignConfirm(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedRoomObj = availableRooms.find(r => String(r.id) === String(selectedRoomId));
    const targetCategoryName = booking.category?.name || booking.room_name || 'Phòng tiêu chuẩn';

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-xl shrink-0">
                            🚪
                        </div>
                        <div>
                            <h3 className="font-bold text-base leading-snug">Gán Phòng Trước (Pre-assign Room)</h3>
                            <p className="text-xs text-emerald-100 opacity-90">
                                Gán số phòng vật lý cho đơn #{booking.booking_code} trước khi khách Check-in
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition text-white cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto space-y-4 flex-1">
                    {/* Error Banner */}
                    {errorMessage && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                            <AlertTriangle size={16} className="shrink-0 text-rose-500" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Booking Info Card */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-700">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <span className="text-slate-400 block text-[11px] font-medium">Khách hàng</span>
                                <span className="font-bold text-slate-900 block truncate">{booking.guest_name || 'Khách vãng lai'}</span>
                                <span className="text-[10px] text-slate-500">{booking.guest_phone || '—'}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px] font-medium">Hạng phòng đặt</span>
                                <span className="font-bold text-emerald-700 block truncate">{targetCategoryName}</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px] font-medium">Thời gian lưu trú</span>
                                <span className="font-bold text-slate-800 block">
                                    {formatDateDisplay(booking.check_in_date)} → {formatDateDisplay(booking.check_out_date)}
                                </span>
                                <span className="text-[10px] text-blue-600 font-semibold">{booking.nights || 1} đêm lưu trú</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[11px] font-medium">Phòng đã gán</span>
                                {currentRoomNumber ? (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-300">
                                            P.{currentRoomNumber}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-medium text-[10px] border border-amber-200">
                                        Chưa gán
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Filter & Toggle Option */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Building size={14} className="text-emerald-600" />
                            <span>Chọn phòng vật lý khả dụng ({availableRooms.length} phòng):</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={showAllCategories}
                                    onChange={(e) => setShowAllCategories(e.target.checked)}
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <span>Xem tất cả các hạng phòng</span>
                            </label>
                        </div>
                    </div>

                    {/* Room Grid / List */}
                    {isLoadingRooms ? (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                            <RefreshCw size={24} className="animate-spin text-emerald-600" />
                            <span className="text-xs">Đang kiểm tra phòng trống trong khoảng lưu trú...</span>
                        </div>
                    ) : availableRooms.length === 0 ? (
                        <div className="py-8 bg-amber-50/60 border border-dashed border-amber-200 rounded-xl text-center p-4">
                            <AlertTriangle size={24} className="mx-auto text-amber-500 mb-1.5" />
                            <p className="text-xs font-bold text-amber-900">Không tìm thấy phòng trống phù hợp</p>
                            <p className="text-[11px] text-amber-700 mt-0.5">
                                Tất cả phòng thuộc hạng "{targetCategoryName}" đều đã có đơn đặt trùng lịch. Bạn có thể thử bật tùy chọn "Xem tất cả các hạng phòng".
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                            {availableRooms.map((room) => {
                                const isSelected = String(room.id) === String(selectedRoomId);
                                const isCurrent = currentRoomId && String(room.id) === String(currentRoomId);
                                const isSameCategory = room.category?.id === (booking.category_id || booking.category?.id);

                                return (
                                    <div
                                        key={room.id}
                                        onClick={() => setSelectedRoomId(String(room.id))}
                                        className={`p-3 rounded-xl border text-left cursor-pointer transition relative flex flex-col justify-between ${
                                            isSelected
                                                ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                                                : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-1">
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-sm font-black text-slate-900">
                                                        P.{room.room_number}
                                                    </span>
                                                    {isCurrent && (
                                                        <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1 py-0.2 rounded border border-blue-200">
                                                            Đang gán
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                    <Layers size={11} className="text-slate-400" />
                                                    <span>Tầng {room.floor}</span>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                            )}
                                        </div>

                                        <div className="mt-2 pt-2 border-t border-slate-100">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span
                                                    className={`truncate font-medium max-w-[110px] ${
                                                        isSameCategory ? 'text-slate-700' : 'text-amber-700 font-bold'
                                                    }`}
                                                    title={room.category?.name}
                                                >
                                                    {room.category?.name || 'Tiêu chuẩn'}
                                                </span>
                                            </div>
                                            {room.category?.base_price && (
                                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                                    {formatCurrency(room.category.promo_price || room.category.base_price)}/đêm
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Selected Room Notification */}
                    {selectedRoomObj && (
                        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                            <Sparkles size={16} className="text-emerald-600 shrink-0" />
                            <div>
                                <span>Bạn đang chọn gán: </span>
                                <strong>Phòng {selectedRoomObj.room_number}</strong> (Tầng {selectedRoomObj.floor} - {selectedRoomObj.category?.name}).
                                <span className="block text-[11px] text-emerald-700 mt-0.5">
                                    ℹ️ Trạng thái phòng vẫn là Sẵn sàng (Available) cho đến khi khách tới và lễ tân ấn "Check-in".
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 sm:px-5 sm:py-3.5 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <div>
                        {currentRoomNumber && (
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={handleUnassign}
                                className="w-full sm:w-auto px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-200 transition inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                title="Bỏ gán số phòng đã chọn cho đơn này"
                            >
                                <Trash2 size={14} />
                                <span>Hủy gán phòng</span>
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
                        <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition cursor-pointer disabled:opacity-50 text-center"
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            disabled={isSubmitting || !selectedRoomId || String(selectedRoomId) === String(currentRoomId)}
                            onClick={handleAssign}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                        >
                            {isSubmitting ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    <span>Đang lưu...</span>
                                </>
                            ) : (
                                <>
                                    <DoorOpen size={14} />
                                    <span>Xác nhận gán phòng</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAL XÁC NHẬN HỦY GÁN PHÒNG (MODERN WHITE MODAL) */}
            {showUnassignConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-2xl max-w-md w-full border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 text-xl font-bold">
                                ⚠️
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-800 tracking-tight">
                                    Xác Nhận Hủy Gán Phòng
                                </h3>
                                <p className="text-xs font-semibold text-slate-400">
                                    Pre-assigned room cancellation
                                </p>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                            <div className="flex justify-between items-center text-slate-600">
                                <span className="font-medium">Mã đặt phòng:</span>
                                <span className="font-mono font-bold text-slate-800">#{booking?.booking_code}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-600">
                                <span className="font-medium">Khách hàng:</span>
                                <span className="font-bold text-slate-800">{booking?.guest_name}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-600">
                                <span className="font-medium">Phòng đang gán trước:</span>
                                <span className="font-black text-rose-600">P.{currentRoomNumber}</span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                            💡 Sau khi hủy, phòng <b>P.{currentRoomNumber}</b> sẽ quay về trạng thái sẵn sàng cho các đơn đặt khác. Đơn này sẽ trở thành trạng thái chờ xếp phòng lúc khách đến nhận.
                        </p>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => setShowUnassignConfirm(false)}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                            >
                                Giữ Lại
                            </button>
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={executeUnassign}
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 transition cursor-pointer flex items-center gap-1.5"
                            >
                                {isSubmitting ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        <span>Đang hủy...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={14} />
                                        <span>Xác Nhận Hủy Gán</span>
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
