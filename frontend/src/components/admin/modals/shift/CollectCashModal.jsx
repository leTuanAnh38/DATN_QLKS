import React, { useState, useEffect, useMemo } from 'react';
import {
    Banknote,
    X,
    Search,
    Check,
    CheckCircle2,
    Calendar,
    DoorOpen,
    User,
    Phone,
    CreditCard,
    QrCode,
    AlertCircle,
    ArrowRight,
    Loader2,
    Receipt
} from 'lucide-react';
import api from '../../../../services/api';
import { paymentService } from '../../../../services/paymentService';
import { bookingService } from '../../../../services/bookingService';

/**
 * Format tiền tệ VNĐ: e.g. 1.500.000 đ
 */
const formatVND = (val) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
};

/**
 * Format ngày DD/MM/YYYY
 */
const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const parts = String(dateStr).split('T')[0].split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    } catch {
        return dateStr;
    }
    return dateStr;
};

export default function CollectCashModal({ isOpen, onClose, onSuccess, initialBooking = null }) {
    const [bookings, setBookings] = useState([]);
    const [isLoadingBookings, setIsLoadingBookings] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [quickTab, setQuickTab] = useState('unpaid'); // 'unpaid' | 'checked_in' | 'all'
    const [selectedBooking, setSelectedBooking] = useState(initialBooking);

    // Form inputs
    const [collectAmount, setCollectAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('CASH'); // 'CASH' | 'TRANSFER' | 'CREDIT_CARD'
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    // Tải danh sách đơn đặt phòng để thu tiền
    useEffect(() => {
        if (!isOpen) return;

        // Nếu đã có initialBooking thì tự chọn
        if (initialBooking) {
            setSelectedBooking(initialBooking);
            return;
        }

        const fetchAllActiveBookings = async () => {
            setIsLoadingBookings(true);
            try {
                const res = await bookingService.getMyBookings({ no_page: 'true' });
                const list = (res && res.success ? res.data : (Array.isArray(res) ? res : []));
                
                // Lọc danh sách nghiệp vụ:
                // 1. Loại bỏ các đơn đã hủy (cancelled) hoặc khách không đến (no_show)
                // 2. Loại bỏ các đơn ĐÃ CHECK-OUT / HOÀN TẤT mà ĐÃ THANH TOÁN ĐỦ (không còn nợ tiền)
                const activeList = list.filter((b) => {
                    if (['cancelled', 'no_show'].includes(b.status)) return false;

                    const total = Number(b.total_amount || 0);
                    const paid = Number(b.paid_amount || 0);
                    const remaining = Number(
                        b.remaining_balance !== undefined && b.remaining_balance !== null
                            ? b.remaining_balance
                            : Math.max(0, total - paid)
                    );

                    const isCheckedOut = ['checked_out', 'completed'].includes(b.status);
                    const isFullyPaid = Boolean(b.is_paid || remaining <= 0);

                    // Khách đã trả phòng VÀ đã thanh toán đủ -> Tuyệt đối không hiện lên thu tiền
                    if (isCheckedOut && isFullyPaid) return false;

                    return true;
                });

                // Sắp xếp ưu tiên thông minh:
                // 1. Các đơn còn thiếu tiền (remaining > 0) lên đầu
                // 2. Đơn đang ở (checked_in) lên trước
                // 3. Đơn mới nhất
                activeList.sort((a, b) => {
                    const remA = Number(a.remaining_balance ?? Math.max(0, (Number(a.total_amount) || 0) - (Number(a.paid_amount) || 0)));
                    const remB = Number(b.remaining_balance ?? Math.max(0, (Number(b.total_amount) || 0) - (Number(b.paid_amount) || 0)));

                    const aHasDebt = remA > 0 ? 1 : 0;
                    const bHasDebt = remB > 0 ? 1 : 0;
                    if (aHasDebt !== bHasDebt) return bHasDebt - aHasDebt;

                    const aInHouse = a.status === 'checked_in' ? 1 : 0;
                    const bInHouse = b.status === 'checked_in' ? 1 : 0;
                    if (aInHouse !== bInHouse) return bInHouse - aInHouse;

                    return (b.id || 0) - (a.id || 0);
                });

                setBookings(activeList);
            } catch (err) {
                console.error('Lỗi khi tải danh sách đơn đặt phòng:', err);
            } finally {
                setIsLoadingBookings(false);
            }
        };

        fetchAllActiveBookings();
    }, [isOpen, initialBooking]);

    // Khi chọn một đơn đặt phòng: tự động tính và gợi ý số tiền còn thiếu (remaining balance)
    useEffect(() => {
        if (!selectedBooking) {
            setCollectAmount('');
            return;
        }

        const total = Number(selectedBooking.total_amount || 0);
        let paid = 0;
        if (selectedBooking.paid_amount !== undefined && selectedBooking.paid_amount !== null) {
            paid = Number(selectedBooking.paid_amount || 0);
        } else if (Array.isArray(selectedBooking.payments)) {
            paid = selectedBooking.payments
                .filter((p) => p.payment_status === 'COMPLETED')
                .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        }

        let remaining = Math.max(0, total - paid);
        if (selectedBooking.remaining_balance !== undefined && selectedBooking.remaining_balance !== null) {
            remaining = Math.max(0, Number(selectedBooking.remaining_balance));
        }

        // Mặc định điền số tiền còn thiếu, nếu đã thanh toán đủ thì để trống
        setCollectAmount(remaining > 0 ? String(Math.round(remaining)) : '');
        setNote(`Thu tiền tại quầy cho đơn ${selectedBooking.booking_code}`);
        setErrorMsg(null);
    }, [selectedBooking]);

    // Lọc danh sách booking theo tab và từ khóa tìm kiếm
    const filteredBookings = useMemo(() => {
        let list = bookings;

        // Lọc theo Quick Tab
        if (quickTab === 'unpaid') {
            list = list.filter((b) => {
                const rem = Number(b.remaining_balance ?? Math.max(0, (Number(b.total_amount) || 0) - (Number(b.paid_amount) || 0)));
                return rem > 0 || !b.is_paid;
            });
        } else if (quickTab === 'checked_in') {
            list = list.filter((b) => b.status === 'checked_in');
        }

        const kw = searchKeyword.trim().toLowerCase();
        if (!kw) return list.slice(0, 15); // Hiển thị 15 đơn phù hợp nhất khi chưa tìm kiếm

        return list.filter((b) => {
            const code = (b.booking_code || '').toLowerCase();
            const guestName = (b.guest_name || b.guest?.get_full_name || b.guest?.username || '').toLowerCase();
            const phone = (b.guest_phone || b.guest?.phone_number || b.guest?.phone || '').toLowerCase();
            const roomNo = String(b.room_number || (typeof b.room === 'object' && b.room ? b.room.room_number : '') || '').toLowerCase();
            const roomName = (b.room_name || b.category_name || '').toLowerCase();
            return code.includes(kw) || guestName.includes(kw) || phone.includes(kw) || roomNo.includes(kw) || roomName.includes(kw);
        }).slice(0, 20);
    }, [bookings, searchKeyword, quickTab]);

    // Tính toán số liệu tài chính của đơn đang chọn
    const bookingFinancials = useMemo(() => {
        if (!selectedBooking) return null;
        const total = Number(selectedBooking.total_amount || 0);
        let paid = 0;
        if (selectedBooking.paid_amount !== undefined && selectedBooking.paid_amount !== null) {
            paid = Number(selectedBooking.paid_amount || 0);
        } else if (Array.isArray(selectedBooking.payments)) {
            paid = selectedBooking.payments
                .filter((p) => p.payment_status === 'COMPLETED')
                .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        }

        let remaining = Math.max(0, total - paid);
        if (selectedBooking.remaining_balance !== undefined && selectedBooking.remaining_balance !== null) {
            remaining = Math.max(0, Number(selectedBooking.remaining_balance));
        }

        return { total, paid, remaining };
    }, [selectedBooking]);

    // Xử lý gửi biểu mẫu thu tiền
    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg(null);

        if (!selectedBooking) {
            setErrorMsg('Vui lòng chọn một đơn đặt phòng cần thu tiền.');
            return;
        }

        const amountNum = Number(collectAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            setErrorMsg('Số tiền thu phải lớn hơn 0 VND.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await paymentService.collectCash({
                booking_id: selectedBooking.id || selectedBooking.booking_code,
                amount: amountNum,
                payment_method: paymentMethod,
                note: note.trim()
            });

            if (res && (res.success || res.id || res.data)) {
                const recordedData = res.data || res;
                if (typeof onSuccess === 'function') {
                    onSuccess(recordedData, selectedBooking);
                }
                onClose();
            } else {
                setErrorMsg(res?.message || 'Không thể ghi nhận thu tiền. Vui lòng thử lại.');
            }
        } catch (err) {
            console.error('Lỗi khi thu tiền mặt tại quầy:', err);
            const msg = err.response?.data?.message || err.response?.data?.detail || 'Đã xảy ra lỗi khi kết nối máy chủ.';
            setErrorMsg(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 flex items-center justify-center p-2.5 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full p-4 sm:p-8 shadow-2xl text-left max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                {/* 1. HEADER MODAL */}
                <div className="flex items-start justify-between pb-4 border-b border-slate-200 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl shadow-md shadow-emerald-600/30 shrink-0">
                            <Banknote className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                <span>Lập Phiếu Thu / Thu Tiền Tại Quầy</span>
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                                Ghi nhận dòng tiền thanh toán trực tiếp của khách hàng vào sổ quỹ khách sạn
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {errorMsg && (
                    <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-xs sm:text-sm animate-shake">
                        <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                        <div>
                            <span className="font-bold">Lỗi xử lý: </span>
                            <span>{errorMsg}</span>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* 2. CHỌN ĐƠN ĐẶT PHÒNG */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            1. Chọn Đơn Đặt Phòng Cần Thu Tiền <span className="text-rose-500">*</span>
                        </label>

                        {!selectedBooking ? (
                            <div className="space-y-3">
                                {/* Thanh Tab Lọc Nhanh */}
                                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                                    <button
                                        type="button"
                                        onClick={() => setQuickTab('unpaid')}
                                        className={`flex-1 py-1.5 px-2 rounded-lg text-center transition cursor-pointer ${
                                            quickTab === 'unpaid'
                                                ? 'bg-white text-emerald-700 shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        ⚠️ Còn nợ / Cần thu
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setQuickTab('checked_in')}
                                        className={`flex-1 py-1.5 px-2 rounded-lg text-center transition cursor-pointer ${
                                            quickTab === 'checked_in'
                                                ? 'bg-white text-blue-700 shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        🏨 Khách đang ở
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setQuickTab('all')}
                                        className={`flex-1 py-1.5 px-2 rounded-lg text-center transition cursor-pointer ${
                                            quickTab === 'all'
                                                ? 'bg-white text-slate-900 shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Tất cả đơn hợp lệ
                                    </button>
                                </div>

                                {/* Thanh tìm kiếm đơn */}
                                <div className="relative">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={searchKeyword}
                                        onChange={(e) => setSearchKeyword(e.target.value)}
                                        placeholder="Tìm theo Mã đơn (BK-...), Tên khách, SĐT, Số phòng (VD: 101, 202)..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                                    />
                                </div>

                                {/* Danh sách kết quả gợi ý */}
                                <div className="border border-slate-200 rounded-2xl max-h-60 overflow-y-auto divide-y divide-slate-100 bg-white shadow-2xs">
                                    {isLoadingBookings ? (
                                        <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                                            <span>Đang tải danh sách đơn đặt phòng...</span>
                                        </div>
                                    ) : filteredBookings.length === 0 ? (
                                        <div className="p-6 text-center text-xs text-slate-400">
                                            Không tìm thấy đơn đặt phòng nào phù hợp với bộ lọc hiện tại.
                                        </div>
                                    ) : (
                                        filteredBookings.map((b) => {
                                            const guestName = b.guest_name || b.guest?.get_full_name || b.guest?.username || 'Khách vãng lai';
                                            const roomNo = b.room_number || (typeof b.room === 'object' && b.room ? b.room.room_number : null);
                                            const roomCategory = b.room_name || b.category_name || (typeof b.category === 'object' && b.category ? b.category.name : '') || 'Phòng tiêu chuẩn';
                                            const hasRoomAssigned = Boolean(roomNo);

                                            const total = Number(b.total_amount || 0);
                                            const remaining = Number(
                                                b.remaining_balance !== undefined && b.remaining_balance !== null
                                                    ? b.remaining_balance
                                                    : Math.max(0, total - (Number(b.paid_amount) || 0))
                                            );
                                            const isUnpaid = remaining > 0;
                                            const isCheckedIn = b.status === 'checked_in';

                                            return (
                                                <button
                                                    key={b.id}
                                                    type="button"
                                                    onClick={() => setSelectedBooking(b)}
                                                    className="w-full p-3 text-left hover:bg-emerald-50/50 flex items-center justify-between gap-3 transition cursor-pointer group"
                                                >
                                                    <div className="space-y-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                                #{b.booking_code}
                                                            </span>
                                                            <span className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 truncate">
                                                                {guestName}
                                                            </span>
                                                            {isCheckedIn && (
                                                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                                    Đang ở
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 flex items-center gap-2.5 flex-wrap">
                                                            {hasRoomAssigned ? (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                                                                    🚪 Phòng {roomNo}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 font-medium border border-amber-200">
                                                                    🚪 Chưa gán phòng
                                                                </span>
                                                            )}
                                                            <span className="truncate max-w-[150px] text-slate-600" title={roomCategory}>
                                                                {roomCategory}
                                                            </span>
                                                            <span className="text-slate-400">|</span>
                                                            <span>📅 {formatDate(b.check_in_date)} - {formatDate(b.check_out_date)}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        {isUnpaid ? (
                                                            <>
                                                                <div className="font-mono font-black text-xs sm:text-sm text-amber-600">
                                                                    {formatVND(remaining)}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400">
                                                                    Còn thiếu / {formatVND(total)}
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="font-mono font-bold text-xs text-emerald-600 flex items-center justify-end gap-1">
                                                                    <span>✓ Đã thanh toán</span>
                                                                </div>
                                                                <div className="text-[10px] text-slate-400">
                                                                    Tổng: {formatVND(total)}
                                                                </div>
                                                            </>
                                                        )}
                                                        <span className="text-[10px] text-emerald-600 font-bold group-hover:underline inline-flex items-center gap-0.5 mt-0.5">
                                                            Chọn thu tiền <ArrowRight className="w-3 h-3" />
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Thẻ thông tin đơn đã chọn */
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/50 border border-emerald-200 relative">
                                <button
                                    type="button"
                                    onClick={() => setSelectedBooking(null)}
                                    className="absolute top-3.5 right-3.5 text-xs text-slate-400 hover:text-rose-600 font-bold px-2 py-1 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition cursor-pointer"
                                    title="Chọn đơn khác"
                                >
                                    Đổi đơn khác
                                </button>

                                <div className="space-y-2.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-bold text-xs bg-emerald-600 text-white px-2.5 py-0.5 rounded-lg shadow-2xs">
                                            #{selectedBooking.booking_code}
                                        </span>
                                        <span className="font-bold text-sm text-slate-900">
                                            {selectedBooking.guest_name || selectedBooking.guest?.get_full_name || selectedBooking.guest?.username || 'Khách vãng lai'}
                                        </span>
                                        {(selectedBooking.guest_phone || selectedBooking.guest?.phone_number) && (
                                            <span className="text-xs text-slate-500">
                                                📞 {selectedBooking.guest_phone || selectedBooking.guest?.phone_number}
                                            </span>
                                        )}
                                        {selectedBooking.status === 'checked_in' && (
                                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300">
                                                Khách đang ở
                                            </span>
                                        )}
                                    </div>

                                    <div className="text-xs text-slate-600 flex items-center gap-3 flex-wrap">
                                        {selectedBooking.room_number ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                                                🚪 Phòng {selectedBooking.room_number} ({selectedBooking.room_name || 'Phòng tiêu chuẩn'})
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-medium border border-amber-200">
                                                🚪 Chưa gán phòng ({selectedBooking.room_name || 'Phòng tiêu chuẩn'})
                                            </span>
                                        )}
                                        <span>📅 Lưu trú: <strong>{formatDate(selectedBooking.check_in_date)}</strong> ➔ <strong>{formatDate(selectedBooking.check_out_date)}</strong></span>
                                    </div>

                                    {/* Bảng cân đối tài chính */}
                                    {bookingFinancials && (
                                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 text-xs">
                                            <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                                                <span className="text-slate-400 block text-[10px] uppercase font-bold">Tổng tiền đơn</span>
                                                <strong className="text-slate-900 font-mono text-xs sm:text-sm">
                                                    {formatVND(bookingFinancials.total)}
                                                </strong>
                                            </div>
                                            <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                                                <span className="text-slate-400 block text-[10px] uppercase font-bold">Đã thanh toán</span>
                                                <strong className="text-blue-600 font-mono text-xs sm:text-sm">
                                                    {formatVND(bookingFinancials.paid)}
                                                </strong>
                                            </div>
                                            <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                                                <span className="text-slate-400 block text-[10px] uppercase font-bold">Còn thiếu (Cần thu)</span>
                                                <strong className={`font-mono text-xs sm:text-sm ${bookingFinancials.remaining > 0 ? 'text-amber-600 font-black' : 'text-emerald-600'}`}>
                                                    {formatVND(bookingFinancials.remaining)}
                                                </strong>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 3. NHẬP THÔNG TIN TIỀN THU */}
                    <div className="space-y-4 pt-2 border-t border-slate-100">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                            2. Thông Tin Phiếu Thu & Hình Thức Thanh Toán
                        </label>

                        {/* Số tiền thu */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-bold text-slate-700">
                                    Số tiền thực thu (VND) <span className="text-rose-500">*</span>
                                </label>
                                {bookingFinancials && bookingFinancials.remaining > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setCollectAmount(String(bookingFinancials.remaining))}
                                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 transition cursor-pointer"
                                        >
                                            Thu hết nợ ({formatVND(bookingFinancials.remaining)})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCollectAmount(String(Math.round(bookingFinancials.total * 0.5)))}
                                            className="text-[11px] font-bold text-blue-700 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 transition cursor-pointer"
                                        >
                                            Thu cọc 50%
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="1000"
                                    step="1000"
                                    value={collectAmount}
                                    onChange={(e) => setCollectAmount(e.target.value)}
                                    placeholder="Nhập số tiền thực thu, ví dụ: 500000"
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-base font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                                    required
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">
                                    VND
                                </span>
                            </div>
                            {collectAmount && Number(collectAmount) > 0 && (
                                <p className="text-xs text-emerald-600 font-bold mt-1.5 flex items-center gap-1">
                                    <span>Bằng chữ: </span>
                                    <span className="font-mono">{formatVND(collectAmount)}</span>
                                </p>
                            )}
                        </div>

                        {/* Phương thức thanh toán */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-2">
                                Phương thức thanh toán
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('CASH')}
                                    className={`p-3 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                                        paymentMethod === 'CASH'
                                            ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold shadow-xs'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <Banknote className="w-5 h-5 text-amber-600" />
                                    <span className="text-xs">Tiền mặt tại quầy</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('TRANSFER')}
                                    className={`p-3 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                                        paymentMethod === 'TRANSFER'
                                            ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold shadow-xs'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <QrCode className="w-5 h-5 text-blue-600" />
                                    <span className="text-xs">Chuyển khoản VietQR</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('CREDIT_CARD')}
                                    className={`p-3 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                                        paymentMethod === 'CREDIT_CARD'
                                            ? 'bg-purple-50 border-purple-400 text-purple-900 font-bold shadow-xs'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <CreditCard className="w-5 h-5 text-purple-600" />
                                    <span className="text-xs">Quẹt thẻ POS</span>
                                </button>
                            </div>
                        </div>

                        {/* Ghi chú thu tiền */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                Ghi chú phiếu thu (Lưu vào lịch sử đơn)
                            </label>
                            <input
                                type="text"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="VD: Khách nộp tiền cọc mặt tại quầy, Thu tiền phòng nhận phòng..."
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                            />
                        </div>
                    </div>

                    {/* 4. FOOTER ACTIONS */}
                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-100 transition cursor-pointer text-center"
                        >
                            Hủy bỏ
                        </button>

                        <button
                            type="submit"
                            disabled={isSubmitting || !selectedBooking || !collectAmount || Number(collectAmount) <= 0}
                            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Đang ghi nhận...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>Xác Nhận & Lưu Phiếu Thu</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
