import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, AlertTriangle, CheckCircle2, X, DoorOpen, User, Building, ShieldAlert, Info, Sparkles, Wrench, RefreshCw } from 'lucide-react';
import { bookingService } from '../../../services/bookingService';

const QUICK_REASONS = [
    { label: 'Hỏng máy lạnh / điều hòa', icon: '❄️', type: 'ac', defaultStatus: 'maintenance' },
    { label: 'Sự cố nước / vệ sinh', icon: '🚰', type: 'water', defaultStatus: 'maintenance' },
    { label: 'Sự cố điện / mất điện', icon: '💡', type: 'electric', defaultStatus: 'maintenance' },
    { label: 'Khóa từ / Cửa hỏng', icon: '🚪', type: 'lock', defaultStatus: 'maintenance' },
    { label: 'Phòng ồn ào / Khách yêu cầu', icon: '🔇', type: 'other', defaultStatus: 'cleaning' },
    { label: 'Sự cố kỹ thuật khác', icon: '🔧', type: 'other', defaultStatus: 'maintenance' },
];

export default function ChangeRoomModal({
    isOpen,
    onClose,
    room,
    booking,
    initialReason = '',
    initialIssueType = 'ac',
    initialEquipment = '',
    onSuccess
}) {
    const [availableRooms, setAvailableRooms] = useState([]);
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [showAllCategories, setShowAllCategories] = useState(false);

    const [reason, setReason] = useState('');
    const [issueType, setIssueType] = useState('ac');
    const [oldRoomStatus, setOldRoomStatus] = useState('maintenance'); // 'maintenance' | 'cleaning'
    const [equipmentName, setEquipmentName] = useState('');
    const [partsReplaced, setPartsReplaced] = useState('');
    const [cost, setCost] = useState('');
    const [isGuestFault, setIsGuestFault] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const currentBooking = booking || room?.current_booking;

    // Helper format tiền tệ VND cho ô nhập
    const formatCurrencyInput = (val) => {
        const numbersOnly = String(val).replace(/\D/g, '');
        if (!numbersOnly) return '';
        return Number(numbersOnly).toLocaleString('vi-VN');
    };

    // Pre-fill form values when modal opens
    useEffect(() => {
        if (!isOpen || !currentBooking?.id) return;

        setErrorMessage('');
        setIsSubmitting(false);
        setReason(initialReason || '');
        setIssueType(initialIssueType || 'ac');
        setEquipmentName(initialEquipment || '');
        setPartsReplaced('');
        setCost('');
        setIsGuestFault(false);
        setOldRoomStatus('maintenance');
        setShowAllCategories(false);
    }, [isOpen, currentBooking?.id]);

    // Fetch available rooms whenever modal opens or showAllCategories toggles
    useEffect(() => {
        if (!isOpen || !currentBooking?.id) return;
        fetchAvailableRooms(showAllCategories);
    }, [isOpen, currentBooking?.id, showAllCategories]);

    const fetchAvailableRooms = async (allCats) => {
        if (!currentBooking?.id) return;
        setIsLoadingRooms(true);
        try {
            const catId = (currentBooking.category_id || room?.category_id || room?.category?.id);
            const res = await bookingService.getAvailableRoomsForBooking(
                currentBooking.id,
                allCats ? null : catId,
                Boolean(allCats)
            );
            if (res && res.rooms) {
                // Lọc bỏ phòng hiện tại nếu lọt vào danh sách
                const filtered = res.rooms.filter((r) => r.id !== room?.id);
                setAvailableRooms(filtered);
                if (filtered.length > 0) {
                    setSelectedRoomId(String(filtered[0].id));
                } else {
                    setSelectedRoomId('');
                }
            } else {
                setAvailableRooms([]);
                setSelectedRoomId('');
            }
        } catch (err) {
            console.error('Lỗi lấy danh sách phòng trống:', err);
            setAvailableRooms([]);
        } finally {
            setIsLoadingRooms(false);
        }
    };

    if (!isOpen || !room || !currentBooking) return null;

    const currentCatName = room.category_name || room.category?.name || currentBooking.room_name || 'Tiêu chuẩn';

    const handleSelectQuickReason = (item) => {
        setReason(item.label);
        setIssueType(item.type);
        setOldRoomStatus(item.defaultStatus);
        if (!equipmentName && item.defaultStatus === 'maintenance') {
            setEquipmentName(item.label.replace('Sự cố ', '').replace('Hỏng ', ''));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        if (!selectedRoomId) {
            setErrorMessage('Vui lòng chọn phòng trống mới để chuyển khách sang.');
            return;
        }

        if (!reason.trim()) {
            setErrorMessage('Vui lòng nhập lý do đổi phòng.');
            return;
        }

        setIsSubmitting(true);
        try {
            const numCost = parseInt(String(cost).replace(/\D/g, ''), 10) || 0;
            const payload = {
                new_room_id: parseInt(selectedRoomId, 10),
                reason: reason.trim(),
                old_room_status: oldRoomStatus,
                maintenance_equipment: equipmentName.trim() || reason.trim(),
                maintenance_issue_type: issueType,
                maintenance_description: reason.trim(),
                parts_replaced: partsReplaced.trim(),
                cost: numCost,
                is_guest_fault: isGuestFault
            };

            const res = await bookingService.changeRoom(currentBooking.id, payload);
            if (res.success) {
                if (onSuccess) {
                    onSuccess(res);
                }
                onClose();
            } else {
                setErrorMessage(res.message || 'Đổi phòng thất bại.');
            }
        } catch (err) {
            setErrorMessage(err.message || 'Có lỗi xảy ra khi đổi phòng.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedNewRoom = availableRooms.find((r) => String(r.id) === String(selectedRoomId));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
            <div
                className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-indigo-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-300 text-indigo-700 flex items-center justify-center text-2xl font-bold shadow-xs">
                            <ArrowRightLeft className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-lg text-slate-900 tracking-tight">
                                    Đổi Phòng Cho Khách Lưu Trú
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                                    Room Move
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Chuyển khách P.{room.room_number} sang phòng trống mới khi gặp sự cố hư hỏng
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm"
                        title="Đóng cửa sổ"
                    >
                        ✕
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
                    {errorMessage && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* 1. KHỐI THÔNG TIN PHÒNG HIỆN TẠI & KHÁCH HÀNG */}
                    <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                            <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">
                                Phòng & Khách hàng hiện tại
                            </span>
                            <span className="font-mono text-xs font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                                #{currentBooking.booking_code}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-slate-700">
                            <div>
                                <span className="text-[10px] text-slate-400 block">Phòng đang ở:</span>
                                <span className="font-bold text-sm text-rose-700">
                                    Phòng {room.room_number} (Tầng {room.floor})
                                </span>
                                <span className="text-[10px] text-slate-500 block truncate">
                                    {currentCatName}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] text-slate-400 block">Khách lưu trú:</span>
                                <span className="font-bold text-sm text-slate-900 block truncate">
                                    {currentBooking.guest_name}
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                    {currentBooking.guest_phone ? `📞 ${currentBooking.guest_phone}` : 'Đang lưu trú'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 2. KHỐI CHỌN PHÒNG MỚI (NEW ROOM) */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="font-bold text-slate-800 flex items-center gap-1.5">
                                <DoorOpen className="w-4 h-4 text-emerald-600" />
                                <span>Chọn phòng trống mới bàn giao cho khách</span>
                                <span className="text-rose-500">*</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowAllCategories(!showAllCategories)}
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                                    showAllCategories
                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                }`}
                            >
                                {showAllCategories ? '✓ Đang hiện tất cả hạng phòng' : '+ Mở rộng tìm mọi hạng phòng'}
                            </button>
                        </div>

                        {isLoadingRooms ? (
                            <div className="p-4 text-center bg-slate-50 rounded-2xl border border-slate-200">
                                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                                <span className="text-slate-500 text-[11px]">Đang tìm các phòng trống khả dụng...</span>
                            </div>
                        ) : availableRooms.length === 0 ? (
                            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs flex items-start gap-2">
                                <span className="text-base leading-none">⚠️</span>
                                <div>
                                    <span className="font-bold block">
                                        Không có phòng trống nào thuộc hạng "{currentCatName}".
                                    </span>
                                    <p className="text-[11px] text-amber-800 mt-0.5">
                                        Hãy bấm vào nút <strong>"+ Mở rộng tìm mọi hạng phòng"</strong> ở trên để nâng hạng phòng (Upgrade) cho khách sang hạng phòng khác đang còn trống.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <select
                                    value={selectedRoomId}
                                    onChange={(e) => setSelectedRoomId(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-emerald-50/40 border-2 border-emerald-400 focus:border-emerald-600 rounded-2xl font-bold text-slate-900 text-xs shadow-xs focus:outline-none transition cursor-pointer"
                                >
                                    {availableRooms.map((r) => {
                                        const rCatName = r.category_name || r.category?.name || 'Tiêu chuẩn';
                                        const isDifferentCat = rCatName !== currentCatName;
                                        return (
                                            <option key={r.id} value={r.id}>
                                                Phòng {r.room_number} — Tầng {r.floor} • {rCatName} {isDifferentCat ? '★ [Hạng phòng khác]' : ''}
                                            </option>
                                        );
                                    })}
                                </select>

                                {selectedNewRoom && (
                                    <div className="mt-2 p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            <span>
                                                Sẵn sàng chuyển khách sang: <strong>Phòng {selectedNewRoom.room_number}</strong> (Tầng {selectedNewRoom.floor})
                                            </span>
                                        </div>
                                        <span className="font-bold text-[11px] text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                                            {selectedNewRoom.category_name || selectedNewRoom.category?.name}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 3. LÝ DO ĐỔI PHÒNG (REASON) */}
                    <div>
                        <label className="block font-bold text-slate-800 mb-1">
                            Lý do đổi phòng <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Ví dụ: Hỏng máy lạnh Daikin rò rỉ nước, cần tháo dỡ sửa chữa..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white font-medium text-slate-900 text-xs"
                        />

                        {/* Gợi ý lý do nhanh */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="text-[10px] text-slate-400 py-0.5 mr-1 font-semibold">Chọn nhanh lý do:</span>
                            {QUICK_REASONS.map((item) => (
                                <button
                                    type="button"
                                    key={item.label}
                                    onClick={() => handleSelectQuickReason(item)}
                                    className={`text-[10px] px-2 py-0.5 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                                        reason === item.label
                                            ? 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold'
                                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                    }`}
                                >
                                    <span>{item.icon}</span>
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 4. HƯỚNG XỬ LÝ PHÒNG CŨ (OLD ROOM STATUS) */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <label className="block font-bold text-slate-800">
                            Trạng thái phòng cũ (P.{room.room_number}) sau khi khách chuyển đi:
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {/* Option 1: Chuyển sang Bảo trì */}
                            <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                                oldRoomStatus === 'maintenance'
                                    ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/20'
                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}>
                                <input
                                    type="radio"
                                    name="oldRoomStatus"
                                    value="maintenance"
                                    checked={oldRoomStatus === 'maintenance'}
                                    onChange={() => setOldRoomStatus('maintenance')}
                                    className="mt-0.5 text-slate-700"
                                />
                                <div>
                                    <span className="font-bold text-slate-900 flex items-center gap-1">
                                        <span>⚪ Đang bảo trì (Maintenance)</span>
                                    </span>
                                    <span className="text-[10px] text-slate-500 block mt-0.5 leading-tight">
                                        Tự động cách ly phòng và lập phiếu bảo trì cho Kỹ thuật viên vào sửa chữa.
                                    </span>
                                </div>
                            </label>

                            {/* Option 2: Chuyển sang Dọn dẹp */}
                            <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                                oldRoomStatus === 'cleaning'
                                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/20'
                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}>
                                <input
                                    type="radio"
                                    name="oldRoomStatus"
                                    value="cleaning"
                                    checked={oldRoomStatus === 'cleaning'}
                                    onChange={() => setOldRoomStatus('cleaning')}
                                    className="mt-0.5 text-amber-600"
                                />
                                <div>
                                    <span className="font-bold text-amber-900 flex items-center gap-1">
                                        <span>🟡 Đang dọn dẹp (Cleaning)</span>
                                    </span>
                                    <span className="text-[10px] text-slate-500 block mt-0.5 leading-tight">
                                        Chỉ cần Buồng phòng dọn dẹp vệ sinh lại để sẵn sàng đón khách tiếp theo.
                                    </span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* 5. KHỐI VẬT TƯ, CHI PHÍ & NGUỒN CHI PHÍ (KHI PHÒNG CŨ CHUYỂN BẢO TRÌ) */}
                    {oldRoomStatus === 'maintenance' && (
                        <div className="p-4 bg-orange-50/60 rounded-2xl border border-orange-200/80 space-y-3 animate-fadeIn">
                            <div className="flex items-center gap-2 text-slate-800 font-bold">
                                <Wrench className="w-4 h-4 text-orange-600" />
                                <span>Kê khai vật tư & Chi phí bảo trì phòng cũ (nếu đã xác định)</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Tên vật tư thay thế */}
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                                        Vật tư thay thế / Phụ tùng
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ví dụ: 1 Củ sen Inax, Tụ quạt, Bàn kính..."
                                        value={partsReplaced}
                                        onChange={(e) => setPartsReplaced(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 text-slate-900 text-xs"
                                    />
                                </div>

                                {/* Chi phí sửa chữa */}
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                                        Chi phí sửa chữa / Thay thế (VND)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="0"
                                            value={formatCurrencyInput(cost)}
                                            onChange={(e) => setCost(e.target.value)}
                                            className="w-full pl-7 pr-12 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 text-xs focus:outline-none focus:border-orange-500"
                                        />
                                        <span className="absolute left-2.5 top-2 text-slate-400 font-bold">₫</span>
                                        <span className="absolute right-3 top-2 text-[10px] text-slate-400 font-bold">VND</span>
                                    </div>
                                </div>
                            </div>

                            {/* Nguồn chi phí: Khách đền bù hay Khách sạn chịu */}
                            <div className="pt-2 border-t border-orange-200/60">
                                <label className="flex items-start gap-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isGuestFault}
                                        onChange={(e) => setIsGuestFault(e.target.checked)}
                                        className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                                    />
                                    <div>
                                        <span className="font-bold text-rose-700 block">
                                            Do khách hàng làm hư hỏng (Khách bồi thường)
                                        </span>
                                        <p className="text-[10px] text-slate-600 mt-0.5 leading-relaxed">
                                            • Nếu tích chọn: Khoản tiền này sẽ được <strong>tự động ghi nhận vào hóa đơn đơn đặt phòng của khách</strong> và tiếp tục đi theo khách sang phòng mới để thu khi làm thủ tục Check-out.<br />
                                            • Nếu bỏ tích: Chi phí được tính vào <strong>Quỹ bảo trì của Khách sạn</strong> (Khách không mất phí).
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}
                </form>

                {/* Footer Buttons */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                    >
                        Hủy bỏ
                    </button>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !selectedRoomId || availableRooms.length === 0}
                        className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white shadow-md transition flex items-center gap-2 cursor-pointer ${
                            isSubmitting || !selectedRoomId || availableRooms.length === 0
                                ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 active:scale-95 shadow-indigo-600/25'
                        }`}
                    >
                        {isSubmitting ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Đang xử lý đổi phòng...</span>
                            </>
                        ) : (
                            <>
                                <ArrowRightLeft className="w-4 h-4" />
                                <span>Xác nhận Đổi phòng</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
