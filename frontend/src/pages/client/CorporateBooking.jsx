import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { roomService } from '../../services/roomService';
import { bookingService } from '../../services/bookingService';
import { useAuth } from '../../store/authStore';

const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return `${num.toLocaleString('vi-VN')}đ`;
};

export default function CorporateBooking() {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();

    // Data states
    const [categories, setCategories] = useState([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState(true);

    // Corporate Code Validation
    const [corporateCodeInput, setCorporateCodeInput] = useState('');
    const [isValidatingCode, setIsValidatingCode] = useState(false);
    const [appliedPartner, setAppliedPartner] = useState(null);
    const [codeError, setCodeError] = useState('');

    // Dates
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const [checkInDate, setCheckInDate] = useState(todayStr);
    const [checkOutDate, setCheckOutDate] = useState(tomorrowStr);

    // Multi-room selection: { [catId]: quantity }
    const [selectedRooms, setSelectedRooms] = useState({});

    // Leader info
    const [groupName, setGroupName] = useState('');
    const [leaderName, setLeaderName] = useState(user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user?.username || ''));
    const [leaderPhone, setLeaderPhone] = useState(user?.phone_number || '');
    const [leaderEmail, setLeaderEmail] = useState(user?.email || '');
    const [identityCard, setIdentityCard] = useState('');
    const [note, setNote] = useState('');

    // VAT Invoice
    const [isCompanyInvoice, setIsCompanyInvoice] = useState(true);
    const [companyName, setCompanyName] = useState('');
    const [companyTaxCode, setCompanyTaxCode] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [invoiceRecipientEmail, setInvoiceRecipientEmail] = useState('');

    // Submission & Success Modal
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [createdGroup, setCreatedGroup] = useState(null);

    // Load room categories
    useEffect(() => {
        let isMounted = true;
        setIsLoadingCategories(true);
        roomService.getCategories()
            .then((res) => {
                if (isMounted && res?.categories) {
                    setCategories(res.categories);
                }
            })
            .finally(() => {
                if (isMounted) setIsLoadingCategories(false);
            });
        return () => { isMounted = false; };
    }, []);

    // Room Availabilities state: { [catId]: { available_rooms, total_rooms, is_sold_out } }
    const [availabilities, setAvailabilities] = useState({});
    const [isLoadingAvail, setIsLoadingAvail] = useState(false);

    useEffect(() => {
        let isMounted = true;
        if (!checkInDate || !checkOutDate) return;
        setIsLoadingAvail(true);
        bookingService.checkAvailability({
            check_in_date: checkInDate,
            check_out_date: checkOutDate
        })
            .then((res) => {
                if (isMounted && res.success && res.availabilities) {
                    setAvailabilities(res.availabilities);
                    // Cắt giảm số lượng phòng đã chọn nếu ngày mới làm số phòng trống ít hơn
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
                console.error('Error checking room availability:', err);
            })
            .finally(() => {
                if (isMounted) setIsLoadingAvail(false);
            });

        return () => { isMounted = false; };
    }, [checkInDate, checkOutDate]);

    // Validate corporate code
    const handleApplyCorporateCode = async (e) => {
        e?.preventDefault();
        setCodeError('');
        if (!corporateCodeInput.trim()) return;

        try {
            setIsValidatingCode(true);
            const res = await bookingService.validateCorporateCode(corporateCodeInput.trim());
            if (res.success && res.partner) {
                setAppliedPartner(res.partner);
                // Pre-fill VAT info
                setCompanyName(res.partner.company_name || '');
                setCompanyTaxCode(res.partner.tax_code || '');
                setCompanyAddress(res.partner.company_address || '');
                setInvoiceRecipientEmail(res.partner.contact_email || '');
                if (!groupName) {
                    setGroupName(`Đoàn ${res.partner.company_name}`);
                }
            } else {
                setCodeError(res.message || 'Mã doanh nghiệp không hợp lệ.');
                setAppliedPartner(null);
            }
        } catch (err) {
            setCodeError('Lỗi kiểm tra mã doanh nghiệp.');
            setAppliedPartner(null);
        } finally {
            setIsValidatingCode(false);
        }
    };

    // Remove partner code
    const handleRemovePartner = () => {
        setAppliedPartner(null);
        setCorporateCodeInput('');
        setCodeError('');
    };

    // Nights
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

    // Financial calculations
    const discountPercent = appliedPartner ? Number(appliedPartner.discount_percent || 0) : 0;

    const { totalRoomsCount, subtotalAmount, totalDiscount, grandTotal, depositAmount } = useMemo(() => {
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
        const deposit = Math.round(total * 0.5);

        return {
            totalRoomsCount: count,
            subtotalAmount: subtotal,
            totalDiscount: discount,
            grandTotal: total,
            depositAmount: deposit
        };
    }, [categories, selectedRooms, nights, discountPercent]);

    // Handle room qty
    const handleRoomQtyChange = (catId, delta) => {
        const catAvail = availabilities[catId]?.available_rooms;
        const maxAvail = (catAvail !== undefined) ? catAvail : 999;

        setSelectedRooms((prev) => {
            const cur = Number(prev[catId] || 0);
            let next = cur + delta;
            if (next < 0) next = 0;
            if (next > maxAvail) next = maxAvail;
            return { ...prev, [catId]: next };
        });
    };

    // Submit group booking
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitError('');

        if (totalRoomsCount === 0) {
            setSubmitError('Vui lòng chọn ít nhất 1 phòng trong danh sách bên dưới.');
            return;
        }

        if (!leaderName.trim()) {
            setSubmitError('Vui lòng nhập Họ tên Trưởng đoàn / Người phụ trách.');
            return;
        }

        if (!leaderPhone.trim()) {
            setSubmitError('Vui lòng nhập Số điện thoại liên hệ.');
            return;
        }

        if (checkOutDate <= checkInDate) {
            setSubmitError('Ngày trả phòng phải sau ngày nhận phòng.');
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

        const payload = {
            group_name: groupName.trim() || `Đoàn khách ${leaderName.trim()}`,
            corporate_code: appliedPartner ? appliedPartner.corporate_code : null,
            corporate_partner_id: appliedPartner ? appliedPartner.id : null,
            leader_name: leaderName.trim(),
            leader_phone: leaderPhone.trim(),
            leader_email: leaderEmail.trim() || null,
            identity_card: identityCard.trim() || '',
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            rooms: roomsPayload,
            deposit_amount: depositAmount,
            note: note.trim() || null,
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
                setCreatedGroup({
                    group_code: res.group_code,
                    deposit_amount: res.deposit_amount,
                    total_amount: res.total_amount,
                    total_rooms: res.total_rooms
                });
            } else {
                setSubmitError(res.message || 'Không thể tạo đơn đặt đoàn.');
            }
        } catch (err) {
            console.error('Lỗi khi gửi yêu cầu đặt đoàn:', err);
            setSubmitError('Đã xảy ra lỗi kết nối. Vui lòng thử lại sau.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
            <Navbar />

            <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
                {/* HERO BANNER - WHITE / LIGHT THEME */}
                <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50/70 p-8 sm:p-12 border border-slate-200/80 shadow-sm">
                    <div className="relative z-10 max-w-3xl space-y-4">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100/80 border border-blue-200 text-blue-800 text-xs font-bold uppercase tracking-wider">
                            <span>🏢</span>
                            <span>Cổng Đặt Phòng Dành Cho Doanh Nghiệp & Đoàn M.I.C.E</span>
                        </div>
                        <h1 className="font-serif text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                            Chương Trình Khách Hàng Doanh Nghiệp & Đặt Theo Đoàn
                        </h1>
                        <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                            Đặt nhiều phòng cùng lúc với chính sách chiết khấu hợp đồng ưu đãi, hỗ trợ xuất Hóa đơn GTGT (VAT) điện tử hợp lệ và chính sách đặt cọc giữ chỗ linh hoạt.
                        </p>
                    </div>
                </div>

                {submitError && (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 shadow-xs">
                        <span>⚠️</span>
                        <span>{submitError}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* BƯỚC 1: XÁC THỰC MÃ DOANH NGHIỆP */}
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <span>🔑</span>
                                    <span>1. Nhập Mã Đối Tác Doanh Nghiệp (Corporate Code)</span>
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Nếu công ty bạn đã ký kết thỏa thuận hợp tác, nhập mã để kích hoạt giá ưu đãi theo hợp đồng.
                                </p>
                            </div>
                        </div>

                        {!appliedPartner ? (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-lg">
                                <input
                                    type="text"
                                    placeholder="Nhập mã (VD: FPT2026, VIETTEL2026...)"
                                    value={corporateCodeInput}
                                    onChange={(e) => setCorporateCodeInput(e.target.value.toUpperCase())}
                                    className="flex-1 px-4 py-3 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                />
                                <button
                                    type="button"
                                    disabled={isValidatingCode || !corporateCodeInput.trim()}
                                    onClick={handleApplyCorporateCode}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl shadow-md transition cursor-pointer disabled:opacity-50"
                                >
                                    {isValidatingCode ? 'Đang kiểm tra...' : 'Áp Dụng Mã'}
                                </button>
                            </div>
                        ) : (
                            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xl shrink-0 shadow-xs">
                                        ✓
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-900 text-sm">{appliedPartner.company_name}</span>
                                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-mono font-bold border border-emerald-300">
                                                #{appliedPartner.corporate_code}
                                            </span>
                                        </div>
                                        <span className="text-xs text-emerald-700 font-medium">
                                            Đã kích hoạt mức chiết khấu độc quyền <strong>{appliedPartner.discount_percent}%</strong> cho toàn bộ các phòng trong đoàn.
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleRemovePartner}
                                    className="text-xs text-slate-500 hover:text-rose-600 font-semibold transition cursor-pointer"
                                >
                                    ✕ Đổi mã khác
                                </button>
                            </div>
                        )}

                        {codeError && (
                            <p className="text-xs text-rose-600 font-semibold">{codeError}</p>
                        )}
                    </div>

                    {/* BƯỚC 2: CHỌN THỜI GIAN LƯU TRÚ */}
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <span>🗓️</span>
                            <span>2. Chọn Lịch Trình Lưu Trú Của Đoàn</span>
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                    Ngày nhận phòng (Check-in):
                                </label>
                                <input
                                    type="date"
                                    min={todayStr}
                                    value={checkInDate}
                                    onChange={(e) => setCheckInDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer transition"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                    Ngày trả phòng (Check-out):
                                </label>
                                <input
                                    type="date"
                                    min={checkInDate || todayStr}
                                    value={checkOutDate}
                                    onChange={(e) => setCheckOutDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer transition"
                                />
                            </div>

                            <div className="text-center sm:text-right pt-2 sm:pt-0">
                                <span className="text-xs text-slate-500 block font-semibold">Thời gian đoàn lưu trú:</span>
                                <span className="text-2xl font-black text-blue-600">{nights} đêm</span>
                            </div>
                        </div>
                    </div>

                    {/* BƯỚC 3: CƠ CẤU PHÒNG ĐOÀN (MULTI-ROOM SELECTION) */}
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <span>🛏️</span>
                                    <span>3. Chọn Số Lượng & Hạng Phòng Cần Đặt</span>
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Tùy chọn linh hoạt số lượng cho từng hạng phòng khác nhau trong cùng một đơn.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {isLoadingAvail && (
                                    <span className="text-xs text-blue-600 font-semibold animate-pulse flex items-center gap-1.5">
                                        <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang cập nhật chỗ trống...</span>
                                    </span>
                                )}
                                <span className="px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                                    Tổng: {totalRoomsCount} phòng
                                </span>
                            </div>
                        </div>

                        {isLoadingCategories ? (
                            <div className="py-12 text-center text-xs text-slate-400">Đang tải danh sách hạng phòng...</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                            className={`p-4 rounded-2xl border transition flex items-center justify-between gap-4 ${
                                                isSoldOut
                                                    ? 'bg-slate-50/50 border-slate-200 opacity-60'
                                                    : qty > 0
                                                    ? 'bg-blue-50/60 border-blue-500 shadow-xs'
                                                    : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-slate-900 text-sm truncate">{cat.name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="font-black text-blue-600 text-sm">{formatCurrency(discountedPrice)}</span>
                                                    <span className="text-[11px] text-slate-500">/đêm</span>
                                                    {discountPercent > 0 && (
                                                        <span className="line-through text-xs text-slate-400">{formatCurrency(basePrice)}</span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                    <span className="text-[11px] text-slate-500">Sức chứa: {cat.capacity || 2} khách/phòng</span>
                                                    <span className="text-slate-300">•</span>
                                                    {isLoadingAvail ? (
                                                        <span className="text-[11px] text-blue-600 animate-pulse font-medium">Đang kiểm tra chỗ...</span>
                                                    ) : isSoldOut ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                                            🔴 Hết phòng trống
                                                        </span>
                                                    ) : availRooms !== null ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            🟢 Còn trống: <strong className="font-extrabold text-emerald-800">{availRooms}</strong> phòng
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {/* Quantity Counter */}
                                            <div className="flex items-center gap-2 shrink-0 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                                                <button
                                                    type="button"
                                                    disabled={qty <= 0}
                                                    onClick={() => handleRoomQtyChange(cat.id, -1)}
                                                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 font-black text-base flex items-center justify-center cursor-pointer transition active:scale-95"
                                                >
                                                    -
                                                </button>
                                                <span className="w-8 text-center font-black text-slate-900 text-sm">{qty}</span>
                                                <button
                                                    type="button"
                                                    disabled={isSoldOut || (availRooms !== null && qty >= availRooms)}
                                                    onClick={() => handleRoomQtyChange(cat.id, 1)}
                                                    className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black text-base flex items-center justify-center cursor-pointer transition active:scale-95 shadow-xs"
                                                    title={availRooms !== null && qty >= availRooms ? `Chỉ còn ${availRooms} phòng trống` : ''}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* BƯỚC 4: THÔNG TIN TRƯỞNG ĐOÀN & XUẤT HÓA ĐƠN VAT */}
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <span>👤</span>
                            <span>4. Thông Tin Người Đại Diện & Hóa Đơn GTGT (VAT)</span>
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                    Tên Đoàn / Sự kiện:
                                </label>
                                <input
                                    type="text"
                                    placeholder="VD: Đoàn Hội Thảo FPT Đà Nẵng"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                    Trưởng đoàn / Người phụ trách: <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Họ và tên"
                                    value={leaderName}
                                    onChange={(e) => setLeaderName(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                    Số điện thoại liên hệ: <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    placeholder="0912..."
                                    value={leaderPhone}
                                    onChange={(e) => setLeaderPhone(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                    Email nhận hợp đồng / Xác nhận:
                                </label>
                                <input
                                    type="email"
                                    placeholder="truongdoan@company.com"
                                    value={leaderEmail}
                                    onChange={(e) => setLeaderEmail(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                                />
                            </div>
                        </div>

                        {/* Hóa đơn VAT */}
                        <div className="pt-4 border-t border-slate-200 space-y-4">
                            <label className="flex items-center justify-between cursor-pointer p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 transition">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">📑</span>
                                    <div>
                                        <span className="text-xs font-bold text-slate-900 block">Yêu cầu xuất Hóa đơn GTGT (VAT) cho Công ty</span>
                                        <span className="text-[11px] text-slate-500">Khách sạn sẽ phát hành hóa đơn điện tử hợp lệ gửi về email kế toán</span>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={isCompanyInvoice}
                                    onChange={(e) => setIsCompanyInvoice(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded-md focus:ring-blue-500 cursor-pointer"
                                />
                            </label>

                            {isCompanyInvoice && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-blue-50/40 border border-blue-200/80 animate-in fade-in duration-200">
                                    <div className="sm:col-span-2">
                                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Tên Doanh Nghiệp / Công ty *</label>
                                        <input
                                            type="text"
                                            placeholder="Tên đầy đủ theo giấy phép ĐKKD"
                                            value={companyName}
                                            onChange={(e) => setCompanyName(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            required={isCompanyInvoice}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Mã số thuế (MST) *</label>
                                        <input
                                            type="text"
                                            placeholder="VD: 0101248141"
                                            value={companyTaxCode}
                                            onChange={(e) => setCompanyTaxCode(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            required={isCompanyInvoice}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Email nhận HĐĐT</label>
                                        <input
                                            type="email"
                                            placeholder="ketoan@company.com"
                                            value={invoiceRecipientEmail}
                                            onChange={(e) => setInvoiceRecipientEmail(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Địa chỉ đăng ký kinh doanh</label>
                                        <input
                                            type="text"
                                            placeholder="Địa chỉ trụ sở công ty..."
                                            value={companyAddress}
                                            onChange={(e) => setCompanyAddress(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* TỔNG KẾT & ĐẶT CỌC */}
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
                        <div className="space-y-2 text-xs">
                            <div className="flex justify-between text-slate-600">
                                <span>Tổng tiền phòng gốc ({totalRoomsCount} phòng • {nights} đêm):</span>
                                <span className="font-semibold text-slate-900">{formatCurrency(subtotalAmount)}</span>
                            </div>
                            {totalDiscount > 0 && (
                                <div className="flex justify-between text-emerald-600 font-semibold">
                                    <span>Chiết khấu đối tác Corporate ({discountPercent}%):</span>
                                    <span>-{formatCurrency(totalDiscount)}</span>
                                </div>
                            )}
                            <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                                <span className="text-base font-bold text-slate-900">Tổng Giá Trị Hợp Đồng Đoàn:</span>
                                <span className="text-2xl sm:text-3xl font-black text-amber-600">{formatCurrency(grandTotal)}</span>
                            </div>
                            <div className="pt-2 flex justify-between items-baseline text-sm">
                                <span className="text-slate-600 font-medium">Tiền đặt cọc giữ chỗ (50%):</span>
                                <span className="text-xl font-black text-blue-600">{formatCurrency(depositAmount)}</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <p className="text-[11px] text-slate-500 max-w-md">
                                Sau khi gửi đơn, hệ thống sẽ mở mã QR VietQR để Doanh nghiệp quét thanh toán tiền cọc 50%. Khách sạn sẽ liên hệ xác nhận trong vòng 15 phút.
                            </p>

                            <button
                                type="submit"
                                disabled={isSubmitting || totalRoomsCount === 0}
                                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-orange-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang xử lý đơn đoàn...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>🏢</span>
                                        <span>Xác Nhận Đặt Phòng Đoàn ({totalRoomsCount} phòng)</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>

                {/* MODAL THÀNH CÔNG & MÃ VIETQR ĐẶT CỌC */}
                {createdGroup && (
                    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-500/30">
                                ✓
                            </div>
                            <div>
                                <h3 className="font-serif text-2xl font-bold text-slate-900">
                                    Đăng Ký Đặt Đoàn Thành Công!
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Mã đơn đoàn của quý khách: <strong className="font-mono text-indigo-700 font-black text-sm">#{createdGroup.group_code}</strong>
                                </p>
                            </div>

                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left text-xs space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Quy mô đoàn:</span>
                                    <strong className="text-slate-900">{createdGroup.total_rooms} phòng</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Tổng tiền hợp đồng:</span>
                                    <strong className="text-slate-900">{formatCurrency(createdGroup.total_amount)}</strong>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-slate-200 font-bold">
                                    <span className="text-slate-700">Tiền đặt cọc cần thanh toán (50%):</span>
                                    <strong className="text-rose-600 text-sm">{formatCurrency(createdGroup.deposit_amount)}</strong>
                                </div>
                            </div>

                            {/* Mã VietQR cọc */}
                            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl inline-block mx-auto">
                                <img
                                    src={`https://img.vietqr.io/image/970422-123456789-compact2.jpg?amount=${createdGroup.deposit_amount}&addInfo=Coc%20doan%20${createdGroup.group_code}&accountName=KHACH%20SAN%20TA%20DA%20NANG`}
                                    alt="VietQR Deposit"
                                    className="w-48 h-48 mx-auto rounded-xl object-contain shadow-xs"
                                />
                                <span className="text-[10px] text-slate-500 block mt-1.5 font-semibold">
                                    Quét mã VietQR bằng app ngân hàng để chuyển cọc tự động
                                </span>
                            </div>

                            <div className="flex items-center gap-3 justify-center pt-2">
                                <button
                                    type="button"
                                    onClick={() => navigate('/')}
                                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                                >
                                    Về Trang Chủ
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
