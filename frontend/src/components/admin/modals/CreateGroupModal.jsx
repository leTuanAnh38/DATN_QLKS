import React, { useState, useEffect, useMemo } from 'react';
import { bookingService } from '../../../services/bookingService';
import { roomService } from '../../../services/roomService';

const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return `${num.toLocaleString('vi-VN')}đ`;
};

export default function CreateGroupModal({ isOpen, onClose, onSuccess }) {
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
            rooms: roomsPayload,
            deposit_amount: depositVal,
            note: note.trim() || null,
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

                        {/* KHỐI 2: THỜI GIAN LƯU TRÚ */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl items-center">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                    🗓️ Ngày Check-in (Nhận phòng):
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
                                    🗓️ Ngày Check-out (Trả phòng):
                                </label>
                                <input
                                    type="date"
                                    min={checkInDate || todayStr}
                                    value={checkOutDate}
                                    onChange={(e) => setCheckOutDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                                />
                            </div>

                            <div className="text-center sm:text-right pt-2 sm:pt-0">
                                <span className="text-[11px] text-slate-500 font-semibold block">Thời gian lưu trú:</span>
                                <span className="text-lg font-black text-indigo-700">{nights} đêm</span>
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

                        {/* KHỐI 4: HÓA ĐƠN VAT DOANH NGHIỆP */}
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

                        {/* TỔNG KẾT TÀI CHÍNH & TIỀN CỌC */}
                        <div className="p-4 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl space-y-3">
                            <div className="flex justify-between items-center text-xs text-slate-300">
                                <span>Tổng tiền phòng gốc ({totalRoomsCount} phòng • {nights} đêm):</span>
                                <span className="font-semibold">{formatCurrency(subtotalAmount)}</span>
                            </div>

                            {totalDiscount > 0 && (
                                <div className="flex justify-between items-center text-xs text-emerald-300 font-semibold">
                                    <span>Chiết khấu Doanh nghiệp ({discountPercent}%):</span>
                                    <span>-{formatCurrency(totalDiscount)}</span>
                                </div>
                            )}

                            <div className="pt-2 border-t border-slate-700/80 flex justify-between items-baseline">
                                <span className="text-sm font-bold">Tổng Giá Trị Hợp Đồng Đoàn:</span>
                                <span className="text-2xl font-black text-amber-400">{formatCurrency(grandTotal)}</span>
                            </div>

                            <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                                <div>
                                    <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                                        Tiền đặt cọc giữ chỗ (Mặc định 50%):
                                    </label>
                                    <input
                                        type="number"
                                        placeholder={String(Math.round(grandTotal * 0.5))}
                                        value={customDeposit}
                                        onChange={(e) => setCustomDeposit(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-mono"
                                    />
                                </div>
                                <div className="text-[11px] text-slate-400 text-right">
                                    Sau khi tạo đơn, hệ thống sẽ mở mã VietQR để Doanh nghiệp chuyển khoản cọc.
                                </div>
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
