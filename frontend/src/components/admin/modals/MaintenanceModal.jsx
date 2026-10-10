import React, { useState, useEffect } from 'react';
import { Wrench, AlertTriangle, CheckCircle2, X, DollarSign, Calendar, User, ShieldAlert, Sparkles, Clock, FileText } from 'lucide-react';

const COMMON_EQUIPMENTS = [
    'Điều hòa / Máy lạnh',
    'Vòi sen / Củ sen tắm',
    'Bồn cầu / Thiết bị vệ sinh',
    'Smart TV / Điều khiển TV',
    'Bình nóng lạnh',
    'Khóa thẻ từ phòng',
    'Két sắt điện tử',
    'Tủ lạnh Mini Bar',
    'Đèn chiếu sáng / Bóng đèn',
    'Ấm đun nước siêu tốc',
    'Gương tắm / Cửa kính',
    'Bàn ghế / Giường nệm'
];

const ISSUE_TYPES = [
    { value: 'ac', label: 'Điều hòa / Thông gió', icon: '❄️' },
    { value: 'plumbing', label: 'Hệ thống nước / Vệ sinh', icon: '🚰' },
    { value: 'electric', label: 'Điện / Chiếu sáng', icon: '💡' },
    { value: 'electronics', label: 'Điện tử (TV, Két, Tủ lạnh)', icon: '📺' },
    { value: 'furniture', label: 'Nội thất & Khóa cửa', icon: '🚪' },
    { value: 'other', label: 'Khác', icon: '🔧' },
];

export default function MaintenanceModal({
    isOpen,
    onClose,
    room,
    mode = 'create', // 'create' | 'complete'
    ticket = null,
    onSuccess,
    onOpenChangeRoom
}) {
    const [equipmentName, setEquipmentName] = useState('');
    const [issueType, setIssueType] = useState('ac');
    const [description, setDescription] = useState('');
    const [partsReplaced, setPartsReplaced] = useState('');
    const [cost, setCost] = useState('');
    const [isGuestFault, setIsGuestFault] = useState(false);
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Pre-fill form khi mở modal
    useEffect(() => {
        if (!isOpen) return;

        setErrorMessage('');
        setIsSubmitting(false);

        if (mode === 'complete' && ticket) {
            setEquipmentName(ticket.equipment_name || '');
            setIssueType(ticket.issue_type || 'ac');
            setDescription(ticket.description || '');
            setPartsReplaced(ticket.parts_replaced || '');
            setCost(ticket.cost ? String(ticket.cost) : '');
            setIsGuestFault(Boolean(ticket.is_guest_fault));
            setNote(ticket.note || '');
        } else {
            // Mode create
            setEquipmentName('');
            setIssueType('ac');
            setDescription('');
            setPartsReplaced('');
            setCost('');
            setIsGuestFault(Boolean(room?.status === 'occupied'));
            setNote('');
        }
    }, [isOpen, mode, ticket, room]);

    if (!isOpen || !room) return null;

    const currentBooking = room.current_booking;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        if (mode === 'create' && !equipmentName.trim()) {
            setErrorMessage('Vui lòng nhập tên thiết bị bị hư hỏng.');
            return;
        }

        setIsSubmitting(true);
        try {
            const numCost = parseInt(String(cost).replace(/\D/g, ''), 10) || 0;

            if (mode === 'create') {
                const payload = {
                    room_id: room.id,
                    equipment_name: equipmentName.trim(),
                    issue_type: issueType,
                    description: description.trim(),
                    parts_replaced: partsReplaced.trim(),
                    cost: numCost,
                    is_guest_fault: isGuestFault,
                    booking_id: isGuestFault && currentBooking ? currentBooking.id : null
                };
                await onSuccess(payload, 'create');
            } else {
                // Mode complete
                const payload = {
                    ticket_id: ticket?.id,
                    parts_replaced: partsReplaced.trim(),
                    cost: numCost,
                    is_guest_fault: isGuestFault,
                    note: note.trim()
                };
                await onSuccess(payload, 'complete');
            }
            onClose();
        } catch (err) {
            setErrorMessage(err.message || 'Thao tác bảo trì thất bại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCurrencyInput = (val) => {
        const numbersOnly = String(val).replace(/\D/g, '');
        if (!numbersOnly) return '';
        return Number(numbersOnly).toLocaleString('vi-VN');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
            <div
                className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`px-6 py-5 border-b flex items-center justify-between ${
                    mode === 'create'
                        ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
                        : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                }`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-xs border ${
                            mode === 'create'
                                ? 'bg-amber-500/10 border-amber-300 text-amber-700'
                                : 'bg-blue-500/10 border-blue-300 text-blue-700'
                        }`}>
                            <Wrench className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-lg text-slate-900 tracking-tight">
                                    {mode === 'create'
                                        ? `Báo Hỏng & Bảo Trì Phòng ${room.room_number}`
                                        : `Hoàn Tất Sửa Chữa Phòng ${room.room_number}`}
                                </h3>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    mode === 'create'
                                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                                        : 'bg-blue-100 text-blue-800 border-blue-300'
                                }`}>
                                    {mode === 'create' ? '⚪ Tiếp nhận sự cố' : '🔧 Nghiệm thu kỹ thuật'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Tầng {room.floor} • Hạng phòng: {room.category_name}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer font-bold text-sm"
                        title="Đóng"
                    >
                        ✕
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-slate-800 overflow-y-auto flex-1">
                    {errorMessage && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Hướng dẫn vận hành khi phòng đang có khách lưu trú */}
                    {currentBooking && (
                        <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0 text-base font-bold">
                                👤
                            </div>
                            <div className="flex-1 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                    <span className="font-bold text-slate-900">
                                        Phòng có khách đang ở: <span className="text-amber-900">{currentBooking.guest_name}</span>
                                    </span>
                                    <span className="font-mono text-[10px] font-bold text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-300">
                                        #{currentBooking.booking_code}
                                    </span>
                                </div>
                                <div className="text-[11px] text-slate-600 mt-1 space-y-0.5 leading-relaxed">
                                    <p>
                                        • <strong>Sửa nhanh tại chỗ:</strong> Kỹ thuật vào xử lý. Sau khi dọn dẹp xong, hệ thống tự động giữ nguyên trạng thái <em>Có khách (Occupied)</em>.
                                    </p>
                                    <p>
                                        • <strong>Sự cố nặng:</strong> Vui lòng sử dụng tính năng <em>Đổi phòng (Room Move)</em> cho khách trước khi cách ly phòng dài ngày.
                                    </p>
                                </div>
                                {onOpenChangeRoom && (
                                    <div className="pt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onClose();
                                                onOpenChangeRoom({
                                                    room,
                                                    booking: currentBooking,
                                                    reason: equipmentName ? `Hỏng thiết bị: ${equipmentName}` : 'Sự cố thiết bị phòng cần bảo trì',
                                                    issueType: issueType,
                                                    equipment: equipmentName
                                                });
                                            }}
                                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                                        >
                                            <span>🔄</span>
                                            <span>Sự cố nặng? Đổi phòng cho khách ngay</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Mode Create: Chọn thiết bị hỏng */}
                    {mode === 'create' ? (
                        <>
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Tên thiết bị hư hỏng <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ví dụ: Điều hòa Daikin, Củ sen tắm, Smart TV..."
                                    value={equipmentName}
                                    onChange={(e) => setEquipmentName(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white font-bold text-slate-900 text-sm"
                                />

                                {/* Gợi ý nhanh các thiết bị thông dụng */}
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    <span className="text-[10px] text-slate-400 py-0.5 mr-1 font-semibold">Gợi ý nhanh:</span>
                                    {COMMON_EQUIPMENTS.slice(0, 8).map((eq) => (
                                        <button
                                            type="button"
                                            key={eq}
                                            onClick={() => setEquipmentName(eq)}
                                            className="text-[10px] bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200 transition cursor-pointer"
                                        >
                                            + {eq}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Phân loại sự cố */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1.5">
                                    Phân loại sự cố kỹ thuật
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {ISSUE_TYPES.map((t) => (
                                        <button
                                            type="button"
                                            key={t.value}
                                            onClick={() => setIssueType(t.value)}
                                            className={`p-2 rounded-xl border text-left flex items-center gap-2 transition cursor-pointer ${
                                                issueType === t.value
                                                    ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold ring-2 ring-amber-400/20'
                                                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                            }`}
                                        >
                                            <span className="text-base">{t.icon}</span>
                                            <span className="text-[11px] truncate">{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Mô tả chi tiết lỗi */}
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Mô tả hiện trạng sự cố
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Chi tiết biểu hiện hỏng (VD: Điều hòa không phả hơi lạnh, quạt gió kêu to, vòi sen bị nứt cần gạt...)"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white text-slate-800"
                                />
                            </div>
                        </>
                    ) : (
                        /* Mode Complete: Hiển thị tóm tắt phiếu bảo trì */
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 font-medium">Phiếu bảo trì:</span>
                                <span className="font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">
                                    #{ticket?.ticket_code || 'MT-ACTIVE'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 font-medium">Thiết bị cần sửa:</span>
                                <span className="font-bold text-slate-900 text-sm">
                                    {ticket?.equipment_name || equipmentName}
                                </span>
                            </div>
                            {ticket?.description && (
                                <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/80 italic">
                                    "{ticket.description}"
                                </p>
                            )}
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-1">
                                <Clock className="w-3 h-3" />
                                <span>Thời gian tiếp nhận: {ticket?.start_date ? new Date(ticket.start_date).toLocaleString('vi-VN') : 'Hôm nay'}</span>
                            </div>
                        </div>
                    )}

                    {/* Vật tư thay thế */}
                    <div>
                        <label className="block font-bold text-slate-700 mb-1">
                            Vật tư thay thế / Phụ tùng lắp mới
                        </label>
                        <input
                            type="text"
                            placeholder="Ví dụ: 1 Củ sen Inax, 1 Tụ kích 35uF, 2 Bóng led âm trần..."
                            value={partsReplaced}
                            onChange={(e) => setPartsReplaced(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-slate-900"
                        />
                    </div>

                    {/* Chi phí & Trách nhiệm đền bù */}
                    <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex-1">
                                <label className="block font-bold text-slate-700 mb-1">
                                    Chi phí thay thế / Sửa chữa (VND)
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="0"
                                        value={formatCurrencyInput(cost)}
                                        onChange={(e) => setCost(e.target.value)}
                                        className="w-full pl-8 pr-12 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 text-sm focus:outline-none focus:border-blue-600"
                                    />
                                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₫</span>
                                    <span className="absolute right-3 top-2.5 text-[10px] text-slate-400 font-bold">VND</span>
                                </div>
                            </div>
                        </div>

                        {/* Tùy chọn trách nhiệm chi trả: Khách đền bù hay Khách sạn chịu phí */}
                        <div className="pt-2 border-t border-slate-200/60">
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
                                    <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                                        Nếu tích chọn, số tiền này sẽ được <strong>tự động thêm vào hóa đơn thanh toán phòng</strong> của khách khi làm thủ tục Check-out.
                                    </p>
                                </div>
                            </label>

                            {/* Thông tin đơn đặt phòng nếu khách làm hỏng */}
                            {isGuestFault && currentBooking && (
                                <div className="mt-2.5 p-2.5 bg-rose-50/80 rounded-xl border border-rose-200 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                        <span className="font-bold text-slate-800">
                                            Khách đang ở: {currentBooking.guest_name}
                                        </span>
                                    </div>
                                    <span className="font-mono text-[10px] font-bold text-rose-700 bg-white px-2 py-0.5 rounded border border-rose-200">
                                        #{currentBooking.booking_code}
                                    </span>
                                </div>
                            )}

                            {/* Cảnh báo khi phòng trống nhưng lại tích lỗi do khách */}
                            {isGuestFault && !currentBooking && (
                                <div className="mt-2.5 p-2.5 bg-amber-50 rounded-xl border border-amber-300 text-xs text-amber-900 flex items-start gap-2 animate-fadeIn">
                                    <span className="text-base leading-none">⚠️</span>
                                    <div>
                                        <span className="font-bold block text-amber-950">
                                            Phòng hiện đang trống (Không có khách lưu trú):
                                        </span>
                                        <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                                            • Nếu đây là sự cố do <strong>khách vừa trả phòng</strong> gây ra: Hệ thống sẽ ghi nhận phiếu bồi thường để truy cứu/phạt cọc, nhưng <em>không thể tự động đẩy vào hóa đơn Check-out</em> vì khách đã thanh toán xong.<br />
                                            • Nếu hỏng do <strong>hao mòn tự nhiên / kỹ thuật</strong>: Vui lòng <strong>bỏ tích</strong> ô này để tính vào chi phí bảo dưỡng định kỳ của khách sạn.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mode Complete: Ghi chú nghiệm thu */}
                    {mode === 'complete' && (
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">
                                Ghi chú nghiệm thu kỹ thuật
                            </label>
                            <input
                                type="text"
                                placeholder="Ví dụ: Đã test chạy 30 phút ổn định, bàn giao Buồng phòng vệ sinh..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-slate-900"
                            />
                        </div>
                    )}

                    {/* Thông báo quy trình chuẩn */}
                    <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-[11px] text-blue-800 leading-relaxed">
                        {mode === 'create' ? (
                            <span>
                                🛡️ <strong>Cách ly phòng:</strong> Sau khi xác nhận, phòng {room.room_number} sẽ tự động chuyển sang trạng thái <strong>Bảo trì (maintenance)</strong> và bị loại trừ khỏi quỹ phòng bán để tránh khách đặt nhầm.
                            </span>
                        ) : (
                            <span>
                                🧹 <strong>Quy trình bàn giao:</strong> Sau khi hoàn tất, phòng {room.room_number} sẽ tự động chuyển sang trạng thái <strong>Đang dọn dẹp (cleaning)</strong> để nhân viên Buồng phòng vệ sinh bụi bẩn trước khi mở bán trở lại.
                            </span>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition cursor-pointer text-xs"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`px-5 py-2.5 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-2 text-xs ${
                                mode === 'create'
                                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-amber-600/20'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-600/20'
                            }`}
                        >
                            {isSubmitting ? (
                                <span>Đang xử lý...</span>
                            ) : mode === 'create' ? (
                                <>
                                    <Wrench className="w-4 h-4" />
                                    <span>Xác nhận & Chuyển sang Bảo trì</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Hoàn tất & Bàn giao Buồng phòng</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
