import React, { useState, useEffect, useMemo } from 'react';
import { bookingService } from '../../../../services/bookingService';
import { hotelService } from '../../../../services/hotelService';
import ExtendStayModal from './ExtendStayModal';
import DeleteServiceModal from './DeleteServiceModal';

export default function BookingDetailModal({
    isOpen,
    booking,
    onClose,
    canManageBookings = true,
    canCheckOut = true,
    currentUserRole = '',
    updatingId = null,
    formatDateTimeDisplay,
    formatDateDisplay,
    STATUS_OPTIONS = [],
    onOpenCheckIn,
    onOpenPreAssign,
    onOpenNoShow,
    onOpenCancel,
    onOpenCheckOut,
    onOpenAddService,
    onQuickStatusChange,
    onBookingUpdated,
    showToast,
    isCheckInDateReached
}) {
    const [internalNoteInput, setInternalNoteInput] = useState('');
    const [isSavingInternalNote, setIsSavingInternalNote] = useState(false);

    // Gia hạn lưu trú (Extend Stay)
    const [adminExtendNewDate, setAdminExtendNewDate] = useState('');
    const [isSubmittingAdminExtend, setIsSubmittingAdminExtend] = useState(false);
    const [adminExtendConflictError, setAdminExtendConflictError] = useState(null);
    const [showExtendConfirmModal, setShowExtendConfirmModal] = useState(false);

    // Xóa dịch vụ
    const [serviceToDelete, setServiceToDelete] = useState(null);

    const formatDateTime = (dt) => (formatDateTimeDisplay ? formatDateTimeDisplay(dt) : (dt || '—'));
    const formatDate = (d) => (formatDateDisplay ? formatDateDisplay(d) : (d || '—'));

    useEffect(() => {
        if (!isOpen || !booking) return;

        setInternalNoteInput(booking.internal_note || '');
        setShowExtendConfirmModal(false);
        setServiceToDelete(null);

        if (booking.status === 'checked_in' && booking.check_out_date) {
            setAdminExtendConflictError(null);
            try {
                const cur = new Date(booking.check_out_date);
                cur.setDate(cur.getDate() + 1);
                setAdminExtendNewDate(cur.toISOString().split('T')[0]);
            } catch {
                setAdminExtendNewDate('');
            }
        } else {
            setAdminExtendNewDate('');
            setAdminExtendConflictError(null);
        }
    }, [isOpen, booking]);

    const adminExtendMinDate = useMemo(() => {
        if (!booking?.check_out_date) return '';
        try {
            const cur = new Date(booking.check_out_date);
            cur.setDate(cur.getDate() + 1);
            return cur.toISOString().split('T')[0];
        } catch {
            return '';
        }
    }, [booking?.check_out_date]);

    const adminExtendCalc = useMemo(() => {
        if (!booking || !adminExtendNewDate) {
            return { extraNights: 0, nightlyRate: 0, extraAmount: 0, isValid: false };
        }
        try {
            const oldDate = new Date(booking.check_out_date);
            const newDate = new Date(adminExtendNewDate);
            const diffTime = newDate.getTime() - oldDate.getTime();
            const extraNights = Math.round(diffTime / (1000 * 3600 * 24));
            if (extraNights <= 0) {
                return { extraNights: 0, nightlyRate: 0, extraAmount: 0, isValid: false };
            }
            const dailyRate = Number(booking.daily_rate) ||
                (booking.nights > 0 ? Number(booking.total_amount) / booking.nights : 0);
            const extraAmount = extraNights * dailyRate;
            return { extraNights, nightlyRate: dailyRate, extraAmount, isValid: true };
        } catch {
            return { extraNights: 0, nightlyRate: 0, extraAmount: 0, isValid: false };
        }
    }, [booking, adminExtendNewDate]);

    const handleSaveInternalNote = async () => {
        if (!booking) return;
        if (!canManageBookings) {
            showToast?.('error', 'Bạn không có quyền chỉnh sửa ghi chú nội bộ.');
            return;
        }
        try {
            setIsSavingInternalNote(true);
            const res = await bookingService.updateBooking(booking.id, {
                internal_note: internalNoteInput.trim()
            });

            if (res && res.success) {
                showToast?.('success', 'Đã lưu ghi chú nội bộ lễ tân thành công.');
                onBookingUpdated?.({
                    ...booking,
                    internal_note: internalNoteInput.trim()
                });
            } else {
                showToast?.('error', res?.message || 'Lỗi khi lưu ghi chú nội bộ.');
            }
        } catch (error) {
            showToast?.('error', error.message || 'Lỗi khi lưu ghi chú.');
        } finally {
            setIsSavingInternalNote(false);
        }
    };

    const handleOpenExtendConfirm = () => {
        if (!booking || !adminExtendNewDate) return;
        if (!canManageBookings) {
            showToast?.('error', 'Bạn không có quyền gia hạn lưu trú (Yêu cầu quyền Cập nhật đơn đặt phòng).');
            return;
        }
        if (!adminExtendCalc.isValid) {
            showToast?.('error', 'Ngày trả phòng mới phải sau ngày trả phòng hiện tại.');
            return;
        }
        setShowExtendConfirmModal(true);
    };

    const handleAdminExtendStay = async () => {
        if (!booking || !adminExtendNewDate) return;
        if (!canManageBookings) {
            showToast?.('error', 'Bạn không có quyền gia hạn lưu trú (Yêu cầu quyền Cập nhật đơn đặt phòng).');
            return;
        }
        if (!adminExtendCalc.isValid) {
            showToast?.('error', 'Ngày trả phòng mới phải sau ngày trả phòng hiện tại.');
            return;
        }

        try {
            setIsSubmittingAdminExtend(true);
            setAdminExtendConflictError(null);
            const res = await bookingService.extendStay(booking.id, adminExtendNewDate);
            if (res.success) {
                showToast?.('success', res.message || 'Gia hạn lưu trú thành công!');
                setShowExtendConfirmModal(false);
                if (res.booking) {
                    onBookingUpdated?.(res.booking);
                } else {
                    onBookingUpdated?.({
                        ...booking,
                        check_out_date: res.new_check_out_date || adminExtendNewDate,
                        total_amount: res.new_total_amount || booking.total_amount
                    });
                }
            } else {
                setAdminExtendConflictError(res.message || 'Không thể gia hạn phòng.');
                showToast?.('error', res.message || 'Không thể gia hạn phòng.');
            }
        } catch (err) {
            const msg = err.message || 'Lỗi khi gửi yêu cầu gia hạn.';
            setAdminExtendConflictError(msg);
            showToast?.('error', msg);
        } finally {
            setIsSubmittingAdminExtend(false);
        }
    };

    const handleQuickCompleteService = async (rawId, itemName) => {
        if (!booking) return;
        try {
            const res = await hotelService.updateServiceRequestStatus(rawId, 'completed');
            if (res && res.success) {
                showToast?.('success', `Đã phục vụ xong món "${itemName}" và tính vào hóa đơn!`);
                const updatedRes = await bookingService.getBookingById(booking.id);
                const updated = updatedRes.data || updatedRes.booking || updatedRes;
                if (updated && updated.id) {
                    onBookingUpdated?.(updated);
                }
            } else {
                showToast?.('error', res?.message || 'Không thể cập nhật trạng thái dịch vụ.');
            }
        } catch (error) {
            showToast?.('error', error.message || 'Lỗi khi cập nhật trạng thái dịch vụ.');
        }
    };

    const handleRemoveExtraService = (itemId, itemName) => {
        if (!booking) return;
        setServiceToDelete({ itemId, itemName, isDeleting: false });
    };

    const executeRemoveExtraService = async () => {
        if (!booking || !serviceToDelete) return;
        setServiceToDelete((prev) => ({ ...prev, isDeleting: true }));
        try {
            const res = await bookingService.removeExtraService(booking.id, serviceToDelete.itemId);
            if (res && res.success && res.booking) {
                showToast?.('success', res.message || 'Đã xóa dịch vụ thành công!');
                onBookingUpdated?.(res.booking);
                setServiceToDelete(null);
            } else {
                showToast?.('error', res?.message || 'Không thể xóa dịch vụ.');
                setServiceToDelete((prev) => ({ ...prev, isDeleting: false }));
            }
        } catch (error) {
            showToast?.('error', error.message || 'Lỗi khi xóa dịch vụ.');
            setServiceToDelete((prev) => ({ ...prev, isDeleting: false }));
        }
    };

    if (!isOpen || !booking) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full p-6 sm:p-8 shadow-2xl text-left max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                    {/* Header Modal */}
                    <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-5">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-lg font-black text-blue-600 tracking-wider">
                                    #{booking.booking_code}
                                </span>
                                <span className="text-xs text-slate-400">•</span>
                                <span className="text-xs text-slate-500">
                                    Tạo ngày {formatDateTime(booking.created_at)}
                                </span>
                            </div>
                            <h3 className="font-serif text-xl font-bold text-slate-900 mt-0.5">
                                Chi Tiết Đơn Đặt Phòng
                            </h3>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center font-bold text-sm cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Thân Modal: Các nhóm thông tin */}
                    <div className="space-y-5 text-xs">
                        {/* KHỐI 1: TRẠNG THÁI HIỆN TẠI */}
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Trạng thái đơn hàng
                                </span>
                                <div className="font-bold text-slate-800 text-sm mt-0.5">
                                    {STATUS_OPTIONS.find((s) => s.value === booking.status)?.label ||
                                        booking.status}
                                </div>
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
                                    <strong className="text-slate-900 text-sm">{booking.guest_name}</strong>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[11px]">Số CCCD / Hộ chiếu (Passport):</span>
                                    <strong className="font-mono text-sm text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block mt-0.5">
                                        🪪 {booking.identity_card || 'Chưa cung cấp'}
                                    </strong>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[11px]">Số điện thoại:</span>
                                    <strong className="text-slate-900">
                                        {booking.guest_phone || 'Chưa cung cấp'}
                                    </strong>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[11px]">Địa chỉ Email:</span>
                                    <strong className="text-slate-900">
                                        {booking.guest_email || 'Chưa cung cấp'}
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
                                    <strong className="text-slate-900 text-sm">{booking.room_name}</strong>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[11px]">Số phòng thực tế:</span>
                                    <strong className="text-slate-900 text-sm">
                                        {booking.room_number ? `Phòng ${booking.room_number}` : 'Chưa xếp phòng'}
                                    </strong>
                                </div>
                                {booking.actual_check_in && (
                                    <div className="col-span-1 sm:col-span-2">
                                        <span className="text-emerald-700 block text-[11px] font-semibold">Thời gian Check-in thực tế:</span>
                                        <strong className="text-emerald-800 text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                                            🔑 {formatDateTime(booking.actual_check_in)}
                                        </strong>
                                    </div>
                                )}
                                <div>
                                    <span className="text-slate-400 block text-[11px]">Ngày Check-in:</span>
                                    <strong className="text-slate-900">
                                        {formatDate(booking.check_in_date)} (từ 14:00)
                                    </strong>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[11px]">Ngày Check-out:</span>
                                    <strong className="text-slate-900">
                                        {formatDate(booking.check_out_date)} (trước 12:00)
                                    </strong>
                                </div>
                            </div>
                        </div>

                        {/* KHỐI 3.1: GIA HẠN LƯU TRÚ (EXTEND STAY) CHO ĐƠN ĐANG Ở (checked_in) */}
                        {canManageBookings && booking.status === 'checked_in' && (
                            <div className="p-4 rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-white space-y-3.5 shadow-2xs">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <h4 className="font-bold text-blue-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                        <span>🗓️</span>
                                        <span>Gia Hạn Lưu Trú (Extend Stay)</span>
                                    </h4>
                                    <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/70 px-2.5 py-0.5 rounded-full border border-blue-200">
                                        {booking.room_number ? `Đang ở Phòng ${booking.room_number}` : 'Đang lưu trú'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                                    <div>
                                        <label className="text-slate-500 block text-[11px] font-semibold mb-1">
                                            Ngày Check-out hiện tại:
                                        </label>
                                        <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                                            {formatDate(booking.check_out_date)}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-blue-950 block text-[11px] font-bold mb-1">
                                            Chọn ngày Check-out mới: <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            min={adminExtendMinDate}
                                            value={adminExtendNewDate}
                                            onChange={(e) => {
                                                setAdminExtendNewDate(e.target.value);
                                                setAdminExtendConflictError(null);
                                            }}
                                            className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-600/30 shadow-2xs cursor-pointer"
                                        />
                                    </div>

                                    <div>
                                        <button
                                            type="button"
                                            onClick={handleOpenExtendConfirm}
                                            disabled={isSubmittingAdminExtend || !adminExtendCalc.isValid}
                                            className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/25 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                        >
                                            <span>✨</span>
                                            <span>Xác nhận Gia hạn</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Xem trước chi phí phát sinh */}
                                {adminExtendCalc.isValid && (
                                    <div className="p-3 bg-white/90 border border-blue-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 shadow-2xs">
                                        <div className="flex items-center gap-4 flex-wrap">
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">Số đêm thêm:</span>
                                                <strong className="text-blue-700 font-bold">+{adminExtendCalc.extraNights} đêm</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">Đơn giá phòng:</span>
                                                <strong className="text-slate-800 font-mono">{adminExtendCalc.nightlyRate.toLocaleString('vi-VN')} đ/đêm</strong>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">Phát sinh thêm:</span>
                                                <strong className="text-amber-600 font-black font-mono">+{adminExtendCalc.extraAmount.toLocaleString('vi-VN')} đ</strong>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[10px]">Tổng tiền phòng mới:</span>
                                            <strong className="text-emerald-700 font-black font-mono text-sm">
                                                {(Number(booking.total_amount) + adminExtendCalc.extraAmount).toLocaleString('vi-VN')} đ
                                            </strong>
                                        </div>
                                    </div>
                                )}

                                {/* Cảnh báo xung đột nếu phòng bị kẹt lịch */}
                                {adminExtendConflictError && (
                                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2 animate-in fade-in">
                                        <span className="text-base">⚠️</span>
                                        <div>
                                            <strong className="font-bold block">Không thể gia hạn (Phòng bị kẹt lịch):</strong>
                                            <span className="text-[11px] leading-relaxed mt-0.5 block">{adminExtendConflictError}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* KHỐI 3.5: DỊCH VỤ PHÁT SINH TẠI PHÒNG (IN-ROOM SERVICES) */}
                        <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-purple-600 flex items-center gap-1.5">
                                        <span>🛎️</span>
                                        <span>Dịch Vụ Phát Sinh & Gọi Món Tại Phòng</span>
                                    </h4>
                                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                        {booking.extra_services?.length || 0} dịch vụ
                                    </span>
                                </div>

                                {/* Nút Thêm Dịch Vụ Cho Khách */}
                                {(canManageBookings || currentUserRole === 'service_staff') &&
                                    (booking.status === 'checked_in' || booking.status === 'IN_HOUSE') && (
                                        <button
                                            type="button"
                                            onClick={onOpenAddService}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-sm hover:shadow-md transition cursor-pointer active:scale-95"
                                            title="Thêm dịch vụ khách sạn hoặc phụ thu cho khách đang lưu trú tại phòng"
                                        >
                                            <span className="text-sm leading-none font-black">+</span>
                                            <span>Thêm dịch vụ</span>
                                        </button>
                                    )}
                            </div>

                            {/* Yêu cầu dịch vụ đang chuẩn bị / chờ phục vụ */}
                            {booking.pending_services && booking.pending_services.length > 0 && (
                                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-amber-900 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                            <span>Đang chuẩn bị / Chờ phục vụ ({booking.pending_services.length} yêu cầu):</span>
                                        </span>
                                        <span className="text-[10px] text-amber-700 font-medium">Chờ giao phục vụ</span>
                                    </div>
                                    <div className="divide-y divide-amber-200/60">
                                        {booking.pending_services.map((req, idx) => (
                                            <div key={req.id || idx} className="py-2 flex items-center justify-between gap-3 text-xs">
                                                <div>
                                                    <div className="font-semibold text-slate-800">
                                                        {req.service_name} <span className="text-amber-700 font-bold">(x{req.quantity})</span>
                                                    </div>
                                                    {req.note && (
                                                        <div className="text-[11px] text-slate-500 italic mt-0.5">
                                                            Ghi chú: {req.note}
                                                        </div>
                                                    )}
                                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                                        Trạng thái: <span className="font-semibold text-amber-700">{req.status_display || 'Chờ xử lý'}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="font-bold text-slate-700">
                                                        {Number(req.total_price || (req.price * req.quantity)).toLocaleString('vi-VN')} VND
                                                    </span>
                                                    {(canManageBookings || currentUserRole === 'service_staff') && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuickCompleteService(req.raw_id, req.service_name)}
                                                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition cursor-pointer active:scale-95"
                                                                title="Xác nhận đã phục vụ xong và chuyển vào hóa đơn thanh toán"
                                                            >
                                                                <span>✓</span>
                                                                <span>Đã giao</span>
                                                            </button>
                                                            {(booking.status === 'checked_in' || booking.status === 'IN_HOUSE') && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveExtraService(req.id, req.service_name)}
                                                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                                                    title="Hủy yêu cầu này"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Danh sách dịch vụ đã hoàn thành phục vụ */}
                            {(() => {
                                const pendingIds = new Set(
                                    (booking.pending_services || []).map((p) => String(p.id))
                                );
                                const completedServices = (booking.extra_services || []).filter(
                                    (item) => !pendingIds.has(String(item.id))
                                );

                                if (completedServices.length > 0) {
                                    return (
                                        <div className="space-y-2">
                                            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                                                {completedServices.map((item, idx) => {
                                                    const cleanName = (item.service_name || '')
                                                        .replace(/\[Yêu cầu #\d+\]/gi, '')
                                                        .replace(/\(x\d+\)/gi, '')
                                                        .trim();
                                                    return (
                                                        <div key={item.id || idx} className="p-2.5 bg-slate-50/60 flex items-center justify-between text-xs hover:bg-slate-100/60 transition group">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-[10px]">
                                                                    {idx + 1}
                                                                </span>
                                                                <div>
                                                                    <strong className="text-slate-900 font-semibold block text-xs">
                                                                        {cleanName}
                                                                    </strong>
                                                                    <span className="text-[10px] text-slate-400">
                                                                        {item.quantity} x {Number(item.price || 0).toLocaleString('vi-VN')} VND
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-slate-900">
                                                                    {Number(item.total_price || (item.price * item.quantity)).toLocaleString('vi-VN')} VND
                                                                </span>
                                                                {(canManageBookings || currentUserRole === 'service_staff') &&
                                                                    (booking.status === 'checked_in' || booking.status === 'IN_HOUSE') && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveExtraService(item.id, cleanName)}
                                                                            className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                                                            title="Xóa phụ phí này khỏi đơn đặt phòng"
                                                                        >
                                                                            🗑️
                                                                        </button>
                                                                    )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex items-center justify-between pt-1 text-xs">
                                                <span className="text-slate-500 font-medium">Tổng tiền dịch vụ phát sinh:</span>
                                                <strong className="text-purple-700 font-bold">
                                                    +{Number(booking.extra_services_total || 0).toLocaleString('vi-VN')} VND
                                                </strong>
                                            </div>
                                        </div>
                                    );
                                }

                                if (booking.pending_services && booking.pending_services.length > 0) {
                                    return (
                                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center text-slate-400 text-xs">
                                            <p>Các món đang chuẩn bị ở trên sẽ chuyển xuống danh sách hoàn tất sau khi bấm <strong>"✓ Đã giao"</strong>.</p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400 text-xs">
                                        <p>Chưa có phụ phí phát sinh nào được ghi nhận cho phòng này.</p>
                                        {(canManageBookings || currentUserRole === 'service_staff') &&
                                            (booking.status === 'checked_in' || booking.status === 'IN_HOUSE') && (
                                                <button
                                                    type="button"
                                                    onClick={onOpenAddService}
                                                    className="inline-block mt-1.5 text-purple-600 hover:text-purple-800 font-semibold cursor-pointer underline text-[11px]"
                                                >
                                                    + Bấm vào đây để thêm dịch vụ hoặc món ăn
                                                </button>
                                            )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* KHỐI 4: TÀI CHÍNH & THANH TOÁN */}
                        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                            <div className="flex items-center justify-between text-xs text-slate-600">
                                <span>Tiền phòng nghỉ ({booking.nights || 1} đêm):</span>
                                <span className="font-semibold text-slate-800">
                                    {Number(booking.room_amount || booking.total_amount).toLocaleString('vi-VN')} VND
                                </span>
                            </div>
                            {Number(booking.extra_services_total || 0) > 0 && (
                                <div className="flex items-center justify-between text-xs text-purple-700 font-medium">
                                    <span>Phụ phí dịch vụ tại phòng ({booking.extra_services?.length || 0} món):</span>
                                    <span className="font-bold">
                                        +{Number(booking.extra_services_total).toLocaleString('vi-VN')} VND
                                    </span>
                                </div>
                            )}
                            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                                        Tổng thanh toán thực tế (Grand Total)
                                    </span>
                                    <span className="text-[10px] text-slate-400 block">
                                        (Bao gồm tiền phòng + toàn bộ dịch vụ phát sinh & thuế phí)
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="font-black text-2xl text-rose-600">
                                        {Number(booking.grand_total_amount || booking.total_amount).toLocaleString('vi-VN')}
                                    </span>
                                    <span className="text-xs font-bold text-slate-500 ml-1">VND</span>
                                </div>
                            </div>
                        </div>

                        {/* KHỐI 5: GHI CHÚ KHÁCH HÀNG & GHI CHÚ NỘI BỘ LỄ TÂN */}
                        <div className="space-y-3">
                            {booking.note && (
                                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                                    <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
                                        💬 Ghi chú của khách hàng:
                                    </span>
                                    <p className="text-xs text-amber-900 whitespace-pre-line">
                                        {booking.note}
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
                                {canManageBookings && (
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
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Nút hành động Modal */}
                    {((canManageBookings && ['pending', 'paid', 'PAID', 'confirmed', 'checked_in'].includes(booking.status)) ||
                        (canCheckOut && booking.status === 'checked_in')) && (
                            <div className="pt-5 mt-6 border-t border-slate-100 flex items-center justify-center gap-2.5 flex-wrap">
                                {booking.status === 'confirmed' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => onOpenCheckIn?.(booking)}
                                            className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                                        >
                                            <span>🔑</span>
                                            <span>Check-in</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onOpenPreAssign?.(booking)}
                                            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                                            title="Gán trước hoặc đổi phòng thực tế cho khách trước khi Check-in"
                                        >
                                            <span>🚪</span>
                                            <span>{booking.room_number ? `Đổi phòng (P.${booking.room_number})` : 'Gán phòng trước'}</span>
                                        </button>
                                        {(!isCheckInDateReached || isCheckInDateReached(booking.check_in_date)) ? (
                                            <button
                                                type="button"
                                                onClick={() => onOpenNoShow?.(booking)}
                                                className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                                            >
                                                <span>🚫</span>
                                                <span>No-show</span>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled
                                                className="px-3.5 py-1.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl shadow-xs cursor-not-allowed inline-flex items-center gap-1.5 opacity-60 border border-slate-200"
                                                title={`Chưa tới ngày nhận phòng (${formatDate(booking.check_in_date)}). Không thể đánh dấu No-show.`}
                                            >
                                                <span>🚫</span>
                                                <span>No-show (Chưa tới ngày)</span>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            disabled={updatingId === booking.id}
                                            onClick={() => onOpenCancel?.(booking)}
                                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                            title="Hủy đơn đặt phòng này"
                                        >
                                            <span>✕</span>
                                            <span>Hủy đơn</span>
                                        </button>
                                    </>
                                )}

                                {['pending', 'paid', 'PAID'].includes(booking.status) && (
                                    <>
                                        <button
                                            type="button"
                                            disabled={updatingId === booking.id}
                                            onClick={() => onQuickStatusChange?.(booking.id, 'confirmed')}
                                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                        >
                                            <span>✓</span>
                                            <span>Duyệt đơn</span>
                                        </button>
                                        <button
                                            type="button"
                                            disabled={updatingId === booking.id}
                                            onClick={() => onOpenCancel?.(booking)}
                                            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                            title="Hủy đơn đặt phòng này"
                                        >
                                            <span>✕</span>
                                            <span>Hủy đơn</span>
                                        </button>
                                    </>
                                )}

                                {booking.status === 'checked_in' && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenCheckOut?.(booking)}
                                        className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                                    >
                                        <span>🧾</span>
                                        <span>Check-out trả phòng</span>
                                    </button>
                                )}
                            </div>
                        )}
                </div>
            </div>

            {/* Sub-modal Xác nhận gia hạn lưu trú */}
            <ExtendStayModal
                isOpen={showExtendConfirmModal}
                booking={booking}
                newDate={adminExtendNewDate}
                calc={adminExtendCalc}
                isSubmitting={isSubmittingAdminExtend}
                onClose={() => setShowExtendConfirmModal(false)}
                onConfirm={handleAdminExtendStay}
                formatDateDisplay={formatDateDisplay}
            />

            {/* Sub-modal Xác nhận xóa dịch vụ */}
            <DeleteServiceModal
                isOpen={Boolean(serviceToDelete)}
                serviceToDelete={serviceToDelete}
                booking={booking}
                onClose={() => setServiceToDelete(null)}
                onConfirm={executeRemoveExtraService}
            />
        </>
    );
}
