import React, { useState, useEffect, useMemo } from 'react';
import { bookingService } from '../../../services/bookingService';
import { roomService } from '../../../services/roomService';
import { useHasPermission } from '../../../utils/permission';

const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return `${num.toLocaleString('vi-VN')}đ`;
};

export default function CreateGroupModal({ isOpen, onClose, onSuccess }) {
    const canCreateBookings = useHasPermission('bookings', 'create');
    const [categories, setCategories] = useState([]);
    const [partners, setPartners] = useState([]);
    const [isLoadingInit, setIsLoadingInit] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Dates
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const [checkInDate, setCheckInDate] = useState(todayStr);
    const [checkOutDate, setCheckOutDate] = useState(tomorrowStr);

    // Group info
    const [groupName, setGroupName] = useState('');
    const [selectedPartnerId, setSelectedPartnerId] = useState('');
    const [leaderName, setLeaderName] = useState('');
    const [leaderPhone, setLeaderPhone] = useState('');
    const [leaderEmail, setLeaderEmail] = useState('');
    const [identityCard, setIdentityCard] = useState('');
    const [note, setNote] = useState('');
    const [internalNote, setInternalNote] = useState('');

    // Estimated Arrival & Guests
    const [estimatedArrivalTime, setEstimatedArrivalTime] = useState('14:00');
    const [estimatedGuests, setEstimatedGuests] = useState('');

    // Deposit Payment Method & Paid Status
    const [depositPaymentMethod, setDepositPaymentMethod] = useState('TRANSFER'); // 'TRANSFER' | 'CASH' | 'POS' | 'CREDIT'
    const [isDepositPaidNow, setIsDepositPaidNow] = useState(false);

    // Chính sách chi trả dịch vụ phát sinh (Billing Routing)
    const [billingType, setBillingType] = useState('ROOM_ONLY'); // 'ROOM_ONLY' | 'ALL_INCLUSIVE'

    // Multi-room selection: { [categoryId]: quantity }
    const [selectedRooms, setSelectedRooms] = useState({});

    // Deposit
    const [customDeposit, setCustomDeposit] = useState('');

    // VAT Invoice
    const [isCompanyInvoice, setIsCompanyInvoice] = useState(false);
    const [companyName, setCompanyName] = useState('');
    const [companyTaxCode, setCompanyTaxCode] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [invoiceRecipientEmail, setInvoiceRecipientEmail] = useState('');

    // Load categories & corporate partners
    useEffect(() => {
        if (!isOpen) return;
        let isMounted = true;
        setIsLoadingInit(true);
        setError('');

        Promise.allSettled([
            roomService.getCategories(),
            bookingService.getCorporatePartners({ active_only: true })
        ]).then(([catRes, partnerRes]) => {
            if (!isMounted) return;
            if (catRes.status === 'fulfilled' && catRes.value?.categories) {
                setCategories(catRes.value.categories);
            }
            if (partnerRes.status === 'fulfilled' && partnerRes.value?.data) {
                setPartners(partnerRes.value.data);
            }
            setIsLoadingInit(false);
        });

        return () => { isMounted = false; };
    }, [isOpen]);

    // Room Availabilities
    const [availabilities, setAvailabilities] = useState({});
    const [isLoadingAvail, setIsLoadingAvail] = useState(false);

    useEffect(() => {
        let isMounted = true;
        if (!isOpen || !checkInDate || !checkOutDate) return;

        setIsLoadingAvail(true);
        bookingService.checkAvailability({
            check_in_date: checkInDate,
            check_out_date: checkOutDate
        })
            .then((res) => {
                if (isMounted && res.success && res.availabilities) {
                    setAvailabilities(res.availabilities);
                    setSelectedRooms((prev) => {
                        let updated = false;
                        const next = { ...prev };
                        Object.entries(next).forEach(([catId, qty]) => {
                            const maxAvail = res.availabilities[catId]?.available_rooms ?? 999;
                            if (qty > maxAvail) {
                                next[catId] = Math.max(0, maxAvail);
                                updated = true;
                            }
                        });
                        return updated ? next : prev;
                    });
                }
            })
            .catch((err) => {
                console.error('Error checking availability in modal:', err);
            })
            .finally(() => {
                if (isMounted) setIsLoadingAvail(false);
            });

        return () => { isMounted = false; };
    }, [isOpen, checkInDate, checkOutDate]);

    // Calculate nights
    const nights = useMemo(() => {
        if (!checkInDate || !checkOutDate) return 1;
        try {
            const d1 = new Date(checkInDate);
            const d2 = new Date(checkOutDate);
            const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
            return diff > 0 ? diff : 1;
        } catch {
            return 1;
        }
    }, [checkInDate, checkOutDate]);

    // Active partner details
    const activePartner = useMemo(() => {
        if (!selectedPartnerId) return null;
        return partners.find((p) => String(p.id) === String(selectedPartnerId)) || null;
    }, [selectedPartnerId, partners]);

    // Auto-fill corporate details when partner changes
    useEffect(() => {
        if (activePartner) {
            setIsCompanyInvoice(true);
            setCompanyName(activePartner.company_name || '');
            setCompanyTaxCode(activePartner.tax_code || '');
            setCompanyAddress(activePartner.company_address || '');
            setInvoiceRecipientEmail(activePartner.contact_email || '');
            if (!groupName) {
                setGroupName(`Đoàn ${activePartner.company_name}`);
            }
        }
    }, [activePartner]);

    // Calculate totals
    const discountPercent = activePartner ? Number(activePartner.discount_percent || 0) : 0;

    const { totalRoomsCount, subtotalAmount, totalDiscount, grandTotal } = useMemo(() => {
        let count = 0;
        let subtotal = 0;
        categories.forEach((cat) => {
            const qty = Number(selectedRooms[cat.id] || 0);
            if (qty > 0) {
                count += qty;
                const unitPrice = Number(cat.promo_price || cat.base_price || 0);
                subtotal += unitPrice * nights * qty;
            }
        });

        const discount = discountPercent > 0 ? (subtotal * discountPercent) / 100 : 0;
        const total = Math.max(0, subtotal - discount);

        return {
            totalRoomsCount: count,
            subtotalAmount: subtotal,
            totalDiscount: discount,
            grandTotal: total
        };
    }, [categories, selectedRooms, nights, discountPercent]);

    // Room quantity change
    const handleRoomQtyChange = (catId, delta) => {
        const catAvail = availabilities[catId]?.available_rooms;
        const maxAvail = (catAvail !== undefined) ? catAvail : 999;

        setSelectedRooms((prev) => {
            const current = Number(prev[catId] || 0);
            let next = current + delta;
            if (next < 0) next = 0;
            if (next > maxAvail) next = maxAvail;
            return { ...prev, [catId]: next };
        });
    };

    // Form submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!canCreateBookings) {
            setError('Bạn không có quyền tạo đơn đặt phòng theo đoàn (Chỉ dành cho Lễ tân, Quản lý hoặc Quản trị viên).');
            return;
        }

        if (totalRoomsCount === 0) {
            setError('Vui lòng chọn ít nhất 1 phòng trong cơ cấu đoàn.');
            return;
        }

        if (!leaderName.trim()) {
            setError('Vui lòng nhập Họ tên Trưởng đoàn / Người đại diện.');
            return;
        }

        if (!leaderPhone.trim()) {
            setError('Vui lòng nhập Số điện thoại Trưởng đoàn.');
            return;
        }

        if (checkOutDate <= checkInDate) {
            setError('Ngày trả phòng phải sau ngày nhận phòng.');
            return;
        }

        const roomsPayload = [];
        Object.entries(selectedRooms).forEach(([catId, qty]) => {
            if (Number(qty) > 0) {
                roomsPayload.push({
                    category_id: Number(catId),
                    quantity: Number(qty)
                });
            }
        });

        let combinedNote = note.trim();
        const prefixParts = [];
        if (estimatedArrivalTime) prefixParts.push(`Giờ đến dự kiến: ${estimatedArrivalTime}`);
        if (estimatedGuests) prefixParts.push(`Quy mô đoàn: ${estimatedGuests} khách`);
        if (prefixParts.length > 0) {
            const prefixStr = `[${prefixParts.join(' | ')}]`;
            combinedNote = combinedNote ? `${prefixStr} ${combinedNote}` : prefixStr;
        }

        const depositVal = customDeposit !== '' ? Number(customDeposit) : Math.round(grandTotal * 0.5);

        const payload = {
            group_name: groupName.trim() || `Đoàn khách ${leaderName.trim()}`,
            corporate_partner_id: selectedPartnerId ? Number(selectedPartnerId) : null,
            leader_name: leaderName.trim(),
            leader_phone: leaderPhone.trim(),
            leader_email: leaderEmail.trim() || null,
            identity_card: identityCard.trim() || '',
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            estimated_arrival_time: estimatedArrivalTime || null,
            total_guests_estimated: estimatedGuests ? Number(estimatedGuests) : null,
            rooms: roomsPayload,
            deposit_amount: depositVal,
            deposit_payment_method: depositPaymentMethod,
            is_deposit_paid: isDepositPaidNow,
            billing_type: billingType,
            note: combinedNote || null,
            internal_note: internalNote.trim() || null,
            is_company_invoice: isCompanyInvoice,
            company_name: isCompanyInvoice ? companyName.trim() : null,
            company_tax_code: isCompanyInvoice ? companyTaxCode.trim() : null,
            company_address: isCompanyInvoice ? companyAddress.trim() : null,
            invoice_recipient_email: isCompanyInvoice ? invoiceRecipientEmail.trim() : null
        };

        try {
            setIsSubmitting(true);
            const res = await bookingService.createGroupBooking(payload);
            if (res.success) {
                if (typeof onSuccess === 'function') {
                    onSuccess(res.data);
                }
                onClose();
            } else {
                setError(res.message || 'Không thể tạo đơn đặt đoàn.');
            }
        } catch (err) {
            console.error('Lỗi khi tạo đơn đoàn:', err);
            setError('Đã xảy ra lỗi hệ thống khi gửi dữ liệu.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 flex items-center justify-center p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full p-6 sm:p-8 shadow-2xl text-left max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                
                {/* MODAL HEADER */}
                <div className="flex items-start justify-between pb-4 border-b border-slate-200 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20 shrink-0">
                            🏢
                        </div>
                        <div>
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200 uppercase tracking-wide">
                                Phân Hệ Khách Đoàn & Doanh Nghiệp (M.I.C.E / B2B)
                            </span>
                            <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                                Tạo Đơn Đặt Phòng Theo Đoàn (Group Booking)
                            </h2>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center font-bold text-base cursor-pointer shrink-0"
                    >
                        ✕
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                {isLoadingInit ? (
                    <div className="py-16 text-center space-y-3">
                        <div className="w-9 h-9 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-xs text-slate-500 font-semibold">Đang tải danh mục phòng và danh bạ đối tác doanh nghiệp...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        
                        {/* KHỐI 1: THÔNG TIN ĐỐI TÁC DOANH NGHIỆP & TÊN ĐOÀN */}
                        <div className="p-5 bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-slate-200 rounded-2xl space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                    <span>🏢</span>
                                    <span>Thông Tin Đoàn & Khách Hàng Doanh Nghiệp</span>
                                </h3>
                                {activePartner && (
                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-black border border-emerald-300">
                                        ✓ Ưu đãi Hợp đồng: Giảm {activePartner.discount_percent}%
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                        Chọn Đối tác Doanh nghiệp (Nếu có):
                                    </label>
                                    <select
                                        value={selectedPartnerId}
                                        onChange={(e) => setSelectedPartnerId(e.target.value)}
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
                                    >
                                        <option value="">-- Đặt đoàn khách du lịch tự do (Không có HĐ B2B) --</option>
                                        {partners.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.company_name} (#{p.corporate_code} - Giảm {p.discount_percent}%)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                        Tên Đoàn / Mục đích chuyến đi: <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="VD: Đoàn FPT Software Team Building 2026"
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Người đại diện đoàn */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200/80">
                                <div className="sm:col-span-1">
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                        Trưởng đoàn: <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Họ và tên"
                                        value={leaderName}
                                        onChange={(e) => setLeaderName(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                        required
                                    />
                                </div>
                                <div className="sm:col-span-1">
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                        Số điện thoại: <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        placeholder="0912..."
                                        value={leaderPhone}
                                        onChange={(e) => setLeaderPhone(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                        required
                                    />
                                </div>
                                <div className="sm:col-span-1">
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                        Email:
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="truongdoan@email.com"
                                        value={leaderEmail}
                                        onChange={(e) => setLeaderEmail(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    />
                                </div>
                                <div className="sm:col-span-1">
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                        CCCD / Passport:
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Số CCCD"
                                        value={identityCard}
                                        onChange={(e) => setIdentityCard(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* KHỐI 2: THỜI GIAN LƯU TRÚ & QUY MÔ ĐOÀN */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 p-4 bg-slate-50 border border-slate-200 rounded-2xl items-center">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                    🗓️ Ngày Check-in:
                                </label>
                                <input
                                    type="date"
                                    min={todayStr}
                                    value={checkInDate}
                                    onChange={(e) => setCheckInDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                    ⏰ Giờ đến dự kiến (ETA):
                                </label>
                                <select
                                    value={estimatedArrivalTime}
                                    onChange={(e) => setEstimatedArrivalTime(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                                >
                                    <option value="08:00">08:00 (Sáng sớm)</option>
                                    <option value="10:00">10:00 (Sáng)</option>
                                    <option value="11:30">11:30 (Trưa)</option>
                                    <option value="12:00">12:00 (Trưa)</option>
                                    <option value="14:00">14:00 (Giờ chuẩn)</option>
                                    <option value="15:30">15:30 (Chiều)</option>
                                    <option value="18:00">18:00 (Tối)</option>
                                    <option value="20:00">20:00 (Tối muộn)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                    🗓️ Ngày Check-out:
                                </label>
                                <input
                                    type="date"
                                    min={checkInDate || todayStr}
                                    value={checkOutDate}
                                    onChange={(e) => setCheckOutDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                    👥 Số khách dự kiến:
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="VD: 15"
                                        value={estimatedGuests}
                                        onChange={(e) => setEstimatedGuests(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                                    />
                                    <span className="text-xs font-black text-indigo-700 shrink-0 whitespace-nowrap bg-indigo-50 px-2.5 py-2 rounded-xl border border-indigo-100">
                                        {nights} đêm
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* KHỐI 3: CHỌN CƠ CẤU PHÒNG CHO ĐOÀN (MULTI-ROOM SELECTION) */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                    <span>🛏️</span>
                                    <span>Cơ Cấu Phòng Đoàn Cần Đặt</span>
                                </h3>
                                <div className="flex items-center gap-2">
                                    {isLoadingAvail && (
                                        <span className="text-[11px] text-indigo-600 font-semibold animate-pulse">
                                            Đang kiểm tra phòng trống...
                                        </span>
                                    )}
                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                                        Đã chọn: {totalRoomsCount} phòng
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                                {categories.map((cat) => {
                                    const qty = Number(selectedRooms[cat.id] || 0);
                                    const basePrice = Number(cat.promo_price || cat.base_price || 0);
                                    const discountedPrice = discountPercent > 0 ? basePrice * (1 - discountPercent / 100) : basePrice;

                                    const availInfo = availabilities[cat.id];
                                    const availRooms = availInfo ? availInfo.available_rooms : null;
                                    const isSoldOut = availInfo ? availInfo.is_sold_out : false;

                                    return (
                                        <div
                                            key={cat.id}
                                            className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                                                isSoldOut
                                                    ? 'bg-slate-50 border-slate-200 opacity-60'
                                                    : qty > 0
                                                    ? 'bg-indigo-50/70 border-indigo-300 shadow-xs'
                                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-slate-900 text-xs truncate">{cat.name}</h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="font-black text-indigo-700 text-xs">{formatCurrency(discountedPrice)}/đêm</span>
                                                    {discountPercent > 0 && (
                                                        <span className="line-through text-[10px] text-slate-400">{formatCurrency(basePrice)}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                    <span className="text-[10px] text-slate-500">Sức chứa: {cat.capacity || 2} khách</span>
                                                    <span className="text-slate-300">•</span>
                                                    {isSoldOut ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                                            Hết phòng
                                                        </span>
                                                    ) : availRooms !== null ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            Còn: <strong>{availRooms}</strong> phòng
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {/* Quantity Counter */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    disabled={qty <= 0}
                                                    onClick={() => handleRoomQtyChange(cat.id, -1)}
                                                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 font-black text-sm flex items-center justify-center cursor-pointer transition active:scale-95"
                                                >
                                                    -
                                                </button>
                                                <span className="w-8 text-center font-black text-slate-900 text-sm">{qty}</span>
                                                <button
                                                    type="button"
                                                    disabled={isSoldOut || (availRooms !== null && qty >= availRooms)}
                                                    onClick={() => handleRoomQtyChange(cat.id, 1)}
                                                    className="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black text-sm flex items-center justify-center cursor-pointer transition active:scale-95 shadow-xs"
                                                    title={availRooms !== null && qty >= availRooms ? `Chỉ còn ${availRooms} phòng trống` : ''}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* KHỐI 4: GHI CHÚ YÊU CẦU CỦA ĐOÀN & GHI CHÚ NỘI BỘ LỄ TÂN */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                <span>📝</span>
                                <span>Ghi Chú & Yêu Cầu Phục Vụ Đoàn</span>
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                        Yêu cầu đặc biệt của đoàn (Special Requests):
                                    </label>
                                    <textarea
                                        rows={2}
                                        placeholder="VD: Bố trí các phòng gần nhau, tầng cao, nôi em bé, ăn sáng buffet chay, xe đón sân bay..."
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                        Ghi chú nội bộ Lễ tân / Kinh doanh (Staff only):
                                    </label>
                                    <textarea
                                        rows={2}
                                        placeholder="VD: Khách VIP của Ban Giám đốc, đoàn hẹn nộp danh sách trước ngày 15, cho check-in sớm nếu có phòng..."
                                        value={internalNote}
                                        onChange={(e) => setInternalNote(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* KHỐI 5: HÓA ĐƠN VAT DOANH NGHIỆP */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <label className="flex items-center justify-between cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <span className="text-base">📑</span>
                                    <div>
                                        <span className="text-xs font-bold text-slate-900 block">Xuất Hóa đơn Giá trị gia tăng (VAT) cho Công ty</span>
                                        <span className="text-[10px] text-slate-500">Cung cấp Mã số thuế và địa chỉ công ty để bộ phận Kế toán lập hóa đơn điện tử</span>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={isCompanyInvoice}
                                    onChange={(e) => setIsCompanyInvoice(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 rounded-md focus:ring-indigo-500 cursor-pointer"
                                />
                            </label>

                            {isCompanyInvoice && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200 animate-in fade-in duration-200">
                                    <div className="space-y-1 sm:col-span-2">
                                        <label className="text-[10px] font-bold text-slate-600 uppercase">Tên Doanh Nghiệp / Công ty *</label>
                                        <input
                                            type="text"
                                            placeholder="VD: Công ty Cổ phần FPT"
                                            value={companyName}
                                            onChange={(e) => setCompanyName(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                            required={isCompanyInvoice}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600 uppercase">Mã số thuế (MST) *</label>
                                        <input
                                            type="text"
                                            placeholder="VD: 0101248141"
                                            value={companyTaxCode}
                                            onChange={(e) => setCompanyTaxCode(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                            required={isCompanyInvoice}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600 uppercase">Email nhận HĐĐT</label>
                                        <input
                                            type="email"
                                            placeholder="ketoan@company.com"
                                            value={invoiceRecipientEmail}
                                            onChange={(e) => setInvoiceRecipientEmail(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                        />
                                    </div>
                                    <div className="space-y-1 sm:col-span-2">
                                        <label className="text-[10px] font-bold text-slate-600 uppercase">Địa chỉ đăng ký kinh doanh</label>
                                        <input
                                            type="text"
                                            placeholder="Địa chỉ trụ sở công ty..."
                                            value={companyAddress}
                                            onChange={(e) => setCompanyAddress(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* TỔNG KẾT TÀI CHÍNH, TIỀN CỌC & PHƯƠNG THỨC THANH TOÁN */}
                        <div className="p-5 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-4">
                            <div className="flex justify-between items-center text-xs text-slate-600">
                                <span>Tổng tiền phòng gốc ({totalRoomsCount} phòng • {nights} đêm):</span>
                                <span className="font-semibold text-slate-800">{formatCurrency(subtotalAmount)}</span>
                            </div>

                            {totalDiscount > 0 && (
                                <div className="flex justify-between items-center text-xs text-emerald-600 font-semibold">
                                    <span>Chiết khấu Doanh nghiệp ({discountPercent}%):</span>
                                    <span>-{formatCurrency(totalDiscount)}</span>
                                </div>
                            )}

                            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex justify-between items-baseline">
                                <span className="text-sm font-bold text-slate-800">Tổng Giá Trị Hợp Đồng Đoàn:</span>
                                <span className="text-2xl font-black text-indigo-600">{formatCurrency(grandTotal)}</span>
                            </div>

                            {/* CỌC & PHƯƠNG THỨC THANH TOÁN */}
                            <div className="pt-2 border-t border-slate-100 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                                    <div>
                                        <label className="text-[11px] text-slate-600 font-semibold block mb-1">
                                            Tiền đặt cọc giữ chỗ (Mặc định 50%):
                                        </label>
                                        <input
                                            type="number"
                                            placeholder={String(Math.round(grandTotal * 0.5))}
                                            value={customDeposit}
                                            onChange={(e) => setCustomDeposit(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[11px] text-slate-600 font-semibold block mb-1">
                                            Phương thức thanh toán cọc:
                                        </label>
                                        <select
                                            value={depositPaymentMethod}
                                            onChange={(e) => setDepositPaymentMethod(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
                                        >
                                            <option value="TRANSFER">📱 Chuyển khoản VietQR</option>
                                            <option value="CASH">💵 Tiền mặt tại quầy lễ tân</option>
                                            <option value="POS">💳 Quẹt thẻ máy POS</option>
                                            <option value="CREDIT">🏢 Bảo lãnh công nợ B2B (Thanh toán sau)</option>
                                        </select>
                                    </div>
                                </div>

                                {/* CHÍNH SÁCH THANH TOÁN PHÁT SINH (BILLING ROUTING) */}
                                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                                    <label className="text-[11px] text-slate-700 font-bold uppercase tracking-wider block">
                                        ⚖️ Chính sách chi trả dịch vụ phát sinh tại phòng:
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <div
                                            onClick={() => setBillingType('ROOM_ONLY')}
                                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex items-start gap-2.5 ${
                                                billingType === 'ROOM_ONLY'
                                                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="adminBillingType"
                                                checked={billingType === 'ROOM_ONLY'}
                                                onChange={() => setBillingType('ROOM_ONLY')}
                                                className="mt-0.5 w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            />
                                            <div className="text-[11px] leading-tight">
                                                <span className="font-bold text-slate-900 block">Khách tự trả phát sinh (ROOM_ONLY)</span>
                                                <span className="text-[10px] text-slate-500">Khách trả tiền dịch vụ tại quầy khi trả phòng lẻ.</span>
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => setBillingType('ALL_INCLUSIVE')}
                                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex items-start gap-2.5 ${
                                                billingType === 'ALL_INCLUSIVE'
                                                    ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="adminBillingType"
                                                checked={billingType === 'ALL_INCLUSIVE'}
                                                onChange={() => setBillingType('ALL_INCLUSIVE')}
                                                className="mt-0.5 w-3.5 h-3.5 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                            />
                                            <div className="text-[11px] leading-tight">
                                                <span className="font-bold text-slate-900 block">Công ty chi trả toàn bộ (ALL_INCLUSIVE)</span>
                                                <span className="text-[10px] text-slate-500">Gộp toàn bộ phát sinh vào hóa đơn tổng của đoàn.</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* CHECKBOX XÁC NHẬN ĐÃ THU CỌC TẠI QUẦY */}
                                <label className="flex items-center gap-3 p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl cursor-pointer hover:bg-emerald-50 transition">
                                    <input
                                        type="checkbox"
                                        checked={isDepositPaidNow}
                                        onChange={(e) => setIsDepositPaidNow(e.target.checked)}
                                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-400 cursor-pointer"
                                    />
                                    <div className="text-xs">
                                        <span className="font-bold text-emerald-700 block">
                                            ✓ Xác nhận đã thu đủ tiền cọc ngay tại quầy
                                        </span>
                                        <span className="text-[11px] text-slate-500">
                                            Đơn đoàn sẽ được duyệt sang trạng thái <strong>ĐÃ XÁC NHẬN (Confirmed)</strong> ngay lập tức.
                                        </span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* FOOTER ACTIONS */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={onClose}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                                Hủy bỏ
                            </button>

                            <button
                                type="submit"
                                disabled={isSubmitting || totalRoomsCount === 0}
                                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang tạo đơn đoàn...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>✓</span>
                                        <span>Tạo Đơn Đặt Đoàn ({totalRoomsCount} phòng)</span>
                                    </>
                                )}
                            </button>
                        </div>

                    </form>
                )}

            </div>
        </div>
    );
}
