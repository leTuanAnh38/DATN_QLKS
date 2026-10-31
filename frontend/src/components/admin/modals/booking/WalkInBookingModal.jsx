import React, { useState, useEffect } from 'react';
import {
    X,
    User,
    UserCheck,
    Building2,
    PhoneCall,
    CreditCard,
    Mail,
    Calendar,
    Clock,
    Sparkles,
    Plus,
    Minus,
    Trash2,
    ChevronDown,
    BedDouble,
    Info,
    ClipboardCheck,
    CheckCircle2,
    BellRing,
    Moon
} from 'lucide-react';
import roomService from '../../../../services/roomService';
import { bookingService } from '../../../../services/bookingService';
import { hotelService } from '../../../../services/hotelService';

// Helper format date DD/MM/YYYY
const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    try {
        const [y, m, d] = dateStr.split('-');
        if (!y || !m || !d) return dateStr;
        return `${d}/${m}/${y}`;
    } catch {
        return dateStr;
    }
};

// Component Chọn Dịch Vụ Đặt Kèm cho Modal Tiếp Đón Khách (Walk-in & Đặt phòng trước)
function WalkInServicePicker({
    serviceCatalog = [],
    selectedServices = [],
    onChangeServices,
    isExpanded,
    onToggleExpand,
    accentColor = 'indigo'
}) {
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [quantity, setQuantity] = useState(1);

    const handleAdd = () => {
        if (!selectedServiceId) return;
        const item = serviceCatalog.find((s) => String(s.id) === String(selectedServiceId));
        if (!item) return;

        const existingIdx = selectedServices.findIndex((s) => String(s.service_id) === String(selectedServiceId));
        let updated;
        if (existingIdx >= 0) {
            updated = [...selectedServices];
            updated[existingIdx].quantity += Number(quantity) || 1;
        } else {
            updated = [
                ...selectedServices,
                {
                    service_id: item.id,
                    name: item.name,
                    price: Number(item.price || 0),
                    quantity: Number(quantity) || 1
                }
            ];
        }
        onChangeServices(updated);
        setSelectedServiceId('');
        setQuantity(1);
    };

    const handleRemove = (index) => {
        const updated = selectedServices.filter((_, idx) => idx !== index);
        onChangeServices(updated);
    };

    const handleUpdateQty = (index, delta) => {
        const updated = [...selectedServices];
        const newQty = (Number(updated[index].quantity) || 1) + delta;
        if (newQty <= 0) {
            handleRemove(index);
        } else {
            updated[index].quantity = newQty;
            onChangeServices(updated);
        }
    };

    const servicesSubtotal = selectedServices.reduce(
        (sum, s) => sum + (Number(s.price || 0) * Number(s.quantity || 1)),
        0
    );

    const isEmerald = accentColor === 'emerald';
    const borderColor = isEmerald ? 'border-emerald-200' : 'border-indigo-200';
    const bgHeader = isEmerald ? 'bg-emerald-50/60 hover:bg-emerald-100/50' : 'bg-indigo-50/60 hover:bg-indigo-100/50';
    const textColor = isEmerald ? 'text-emerald-800' : 'text-indigo-800';
    const badgeColor = isEmerald ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-indigo-100 text-indigo-800 border-indigo-300';
    const btnColor = isEmerald ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700';

    return (
        <div className={`rounded-xl border ${borderColor} overflow-hidden bg-white text-xs`}>
            <button
                type="button"
                onClick={onToggleExpand}
                className={`w-full p-2.5 flex items-center justify-between transition cursor-pointer ${bgHeader}`}
            >
                <div className="flex items-center gap-2">
                    <BellRing className={`w-4 h-4 ${isEmerald ? 'text-emerald-600' : 'text-indigo-600'}`} />
                    <span className={`font-bold ${textColor}`}>
                        Dịch vụ & Tiện ích đặt kèm
                    </span>
                    {selectedServices.length > 0 && (
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${badgeColor}`}>
                            {selectedServices.length} món (+{servicesSubtotal.toLocaleString('vi-VN')} đ)
                        </span>
                    )}
                </div>
                <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {isExpanded && (
                <div className="p-3 space-y-2.5 border-t border-slate-100 bg-slate-50/30">
                    <div className="flex gap-2 items-center">
                        <select
                            value={selectedServiceId}
                            onChange={(e) => setSelectedServiceId(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="">-- Chọn dịch vụ / món từ menu --</option>
                            {serviceCatalog.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name} ({Number(s.price || 0).toLocaleString('vi-VN')} đ)
                                </option>
                            ))}
                        </select>
                        <input
                            type="number"
                            min="1"
                            max="99"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-14 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-center font-bold"
                            title="Số lượng"
                        />
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={!selectedServiceId}
                            className={`px-3 py-1.5 text-white font-bold rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 ${btnColor}`}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Thêm</span>
                        </button>
                    </div>

                    {selectedServices.length > 0 ? (
                        <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-lg overflow-hidden max-h-36 overflow-y-auto bg-white">
                            {selectedServices.map((item, idx) => (
                                <div key={idx} className="p-2 flex items-center justify-between hover:bg-slate-50 transition">
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-slate-800 truncate">{item.name}</div>
                                        <div className="text-[10px] text-slate-400">
                                            {Number(item.price).toLocaleString('vi-VN')} đ/suất
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 overflow-hidden text-[11px]">
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateQty(idx, -1)}
                                                className="w-5 h-5 flex items-center justify-center hover:bg-slate-200 transition text-slate-600 font-bold"
                                            >
                                                <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="w-6 text-center font-bold text-slate-800">{item.quantity}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleUpdateQty(idx, 1)}
                                                className="w-5 h-5 flex items-center justify-center hover:bg-slate-200 transition text-slate-600 font-bold"
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <span className="font-bold text-slate-900 w-20 text-right font-mono">
                                            {(Number(item.price) * Number(item.quantity)).toLocaleString('vi-VN')} đ
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemove(idx)}
                                            className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                                            title="Xóa dịch vụ"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[11px] text-slate-400 text-center py-1">
                            Chưa chọn dịch vụ nào. Khách có thể yêu cầu thêm sau khi nhận phòng.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

export default function WalkInBookingModal({
    isOpen,
    initialTab = 'walk_in',
    canCreateBookings = true,
    onClose,
    onSuccess,
    showToast
}) {
    const [bookingTab, setBookingTab] = useState(initialTab);
    const [walkInAvailableRooms, setWalkInAvailableRooms] = useState([]);
    const [advanceCategories, setAdvanceCategories] = useState([]);
    const [categoryAvailabilities, setCategoryAvailabilities] = useState({});
    const [isLoadingWalkInRooms, setIsLoadingWalkInRooms] = useState(false);
    const [isLoadingCategories, setIsLoadingCategories] = useState(false);
    const [isLoadingAvailabilities, setIsLoadingAvailabilities] = useState(false);
    const [isSubmittingWalkIn, setIsSubmittingWalkIn] = useState(false);
    const [corporatePartners, setCorporatePartners] = useState([]);
    const [serviceCatalog, setServiceCatalog] = useState([]);
    const [isServicesAccordionOpen, setIsServicesAccordionOpen] = useState(false);

    const [walkInForm, setWalkInForm] = useState({
        customer_type: 'MEMBER',
        company_name: '',
        company_tax_code: '',
        company_address: '',
        guest_name: '',
        guest_phone: '',
        identity_card: '',
        guest_email: '',
        create_account: false,
        room_id: '',
        category_id: '',
        check_in_date: new Date().toISOString().split('T')[0],
        check_out_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        initial_status: 'confirmed',
        note: '',
        internal_note: '',
        selected_services: []
    });

    const fetchCategoryAvailabilities = async (checkIn, checkOut) => {
        if (!checkIn || !checkOut) return;
        try {
            setIsLoadingAvailabilities(true);
            const res = await bookingService.checkAvailability({
                check_in_date: checkIn,
                check_out_date: checkOut,
                category_id: 'all'
            });
            if (res && res.success && res.availabilities) {
                setCategoryAvailabilities(res.availabilities);
            }
        } catch (err) {
            console.error('Lỗi kiểm tra số phòng trống theo ngày:', err);
        } finally {
            setIsLoadingAvailabilities(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;

        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        setBookingTab(initialTab);
        setWalkInForm({
            customer_type: 'MEMBER',
            company_name: '',
            company_tax_code: '',
            company_address: '',
            guest_name: '',
            guest_phone: '',
            identity_card: '',
            guest_email: '',
            create_account: false,
            room_id: '',
            category_id: '',
            check_in_date: todayStr,
            check_out_date: tomorrowStr,
            initial_status: 'confirmed',
            note: '',
            internal_note: '',
            selected_services: []
        });
        setIsServicesAccordionOpen(false);

        setIsLoadingWalkInRooms(true);
        setIsLoadingCategories(true);

        Promise.all([
            roomService.getAdminRooms({ status: 'available' }),
            roomService.getCategories(),
            bookingService.getCorporatePartners().catch(() => ({ success: false, data: [] })),
            hotelService.getServiceItems({ status: 'active' }).catch(() => ({ success: false, items: [] }))
        ])
            .then(([roomsRes, catsRes, partnersRes, servicesRes]) => {
                if (servicesRes && servicesRes.success && servicesRes.items) {
                    setServiceCatalog(servicesRes.items);
                }
                if (partnersRes && partnersRes.success) {
                    setCorporatePartners(partnersRes.data || []);
                }
                if (roomsRes && roomsRes.success) {
                    const rooms = roomsRes.rooms || [];
                    setWalkInAvailableRooms(rooms);
                    if (rooms.length > 0) {
                        setWalkInForm((prev) => ({ ...prev, room_id: String(rooms[0].id) }));
                    }
                }
                const cats = catsRes?.categories || (Array.isArray(catsRes) ? catsRes : []);
                setAdvanceCategories(cats);
                if (cats.length > 0) {
                    setWalkInForm((prev) => ({ ...prev, category_id: String(cats[0].id) }));
                }
                fetchCategoryAvailabilities(todayStr, tomorrowStr);
            })
            .catch((error) => {
                console.error('Lỗi khi tải dữ liệu phòng và hạng phòng:', error);
                showToast?.('error', error.message || 'Lỗi khi tải danh sách phòng/hạng phòng.');
            })
            .finally(() => {
                setIsLoadingWalkInRooms(false);
                setIsLoadingCategories(false);
            });
    }, [isOpen, initialTab]);

    useEffect(() => {
        if (isOpen && bookingTab === 'advance' && walkInForm.check_in_date && walkInForm.check_out_date) {
            fetchCategoryAvailabilities(walkInForm.check_in_date, walkInForm.check_out_date);
        }
    }, [isOpen, bookingTab, walkInForm.check_in_date, walkInForm.check_out_date]);

    // Live calculations
    const nights = Math.max(
        1,
        Math.round(
            (new Date(walkInForm.check_out_date) - new Date(walkInForm.check_in_date)) /
            (1000 * 60 * 60 * 24)
        ) || 1
    );

    const selectedRoom = walkInAvailableRooms.find(
        (r) => String(r.id) === String(walkInForm.room_id)
    );
    const selectedCat = advanceCategories.find(
        (c) => String(c.id) === String(walkInForm.category_id)
    );

    const pricePerNight = bookingTab === 'walk_in'
        ? (selectedRoom
            ? Number(selectedRoom.category?.promo_price) ||
              Number(selectedRoom.category_base_price) ||
              Number(selectedRoom.category?.base_price) ||
              0
            : 0)
        : (selectedCat
            ? Number(selectedCat.promo_price) || Number(selectedCat.base_price) || 0
            : 0);

    const roomAmount = pricePerNight * nights;
    const servicesTotal = (walkInForm.selected_services || []).reduce(
        (sum, s) => sum + (Number(s.price || 0) * Number(s.quantity || 1)),
        0
    );
    const grandTotal = roomAmount + servicesTotal;

    const curAvail = selectedCat ? categoryAvailabilities[selectedCat.id] : null;
    const curAvailRooms = curAvail ? curAvail.available_rooms : (selectedCat?.available_rooms ?? null);
    const isCurSoldOut = curAvail ? curAvail.is_sold_out : (curAvailRooms !== null && curAvailRooms <= 0);

    const handleConfirmWalkIn = async (e) => {
        if (e && e.preventDefault) e.preventDefault();

        if (!canCreateBookings) {
            showToast?.('error', 'Bạn không có quyền tạo đơn đặt phòng mới (Yêu cầu quyền Thêm mới).');
            return;
        }

        if (!walkInForm.guest_name.trim()) {
            showToast?.('error', 'Vui lòng nhập Họ và tên khách hàng.');
            return;
        }
        if (!walkInForm.guest_phone.trim()) {
            showToast?.('error', 'Vui lòng cung cấp Số điện thoại khách hàng.');
            return;
        }
        if (!walkInForm.identity_card.trim()) {
            showToast?.('error', 'Vui lòng nhập Số CCCD / Hộ chiếu (Passport).');
            return;
        }
        if (walkInForm.identity_card.trim().length < 8 || walkInForm.identity_card.trim().length > 20) {
            showToast?.('error', 'Số CCCD / Hộ chiếu phải từ 8 đến 20 ký tự.');
            return;
        }
        if (!walkInForm.check_out_date) {
            showToast?.('error', 'Vui lòng chọn ngày Check-out.');
            return;
        }

        if (bookingTab === 'walk_in') {
            if (!walkInForm.room_id) {
                showToast?.('error', 'Vui lòng chọn phòng thực tế trống để đón khách.');
                return;
            }
        } else {
            if (!walkInForm.category_id) {
                showToast?.('error', 'Vui lòng chọn Hạng phòng khách muốn đặt giữ chỗ.');
                return;
            }
            if (!walkInForm.check_in_date) {
                showToast?.('error', 'Vui lòng chọn ngày Check-in.');
                return;
            }
            if (walkInForm.check_out_date <= walkInForm.check_in_date) {
                showToast?.('error', 'Ngày Check-out bắt buộc phải sau ngày Check-in.');
                return;
            }
        }

        try {
            setIsSubmittingWalkIn(true);
            let res;
            const payload = {
                ...walkInForm,
                services: (walkInForm.selected_services || []).map((s) => ({
                    service_id: s.service_id,
                    quantity: s.quantity,
                    note: s.note || ''
                }))
            };
            if (bookingTab === 'walk_in') {
                res = await bookingService.createWalkInBooking(payload);
            } else {
                res = await bookingService.createAdvanceReservation({
                    ...payload,
                    status: walkInForm.initial_status || 'confirmed'
                });
            }

            if (res && res.success) {
                const newBooking = res.data || res.booking;
                if (bookingTab === 'walk_in') {
                    const assignedRoom = res.room;
                    const roomNum = assignedRoom?.room_number || 'đã chọn';
                    showToast?.(
                        'success',
                        `Tạo đơn Walk-in #${newBooking?.booking_code || ''} thành công! Đã giữ Phòng ${roomNum} cho khách "${walkInForm.guest_name}".`
                    );
                } else {
                    const catObj = advanceCategories.find((c) => String(c.id) === String(walkInForm.category_id));
                    const catName = catObj?.name || 'đã chọn';
                    showToast?.(
                        'success',
                        `Tạo đơn giữ chỗ thành công! Mã đơn #${newBooking?.booking_code || ''} (Hạng ${catName}).`
                    );
                }

                onSuccess?.(newBooking, { bookingTab });
                onClose?.();
            } else {
                showToast?.('error', res?.message || 'Không thể tạo đơn đặt phòng.');
            }
        } catch (error) {
            showToast?.('error', error.message || 'Lỗi kết nối khi gửi yêu cầu tiếp đón khách.');
        } finally {
            setIsSubmittingWalkIn(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200/90 max-w-4xl w-full shadow-2xl text-left max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* ==================== 1. FIXED HEADER ==================== */}
                <div className="p-5 sm:px-6 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                            {bookingTab === 'walk_in' ? (
                                <UserCheck className="w-5 h-5" />
                            ) : (
                                <PhoneCall className="w-5 h-5" />
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200/80 uppercase tracking-wide">
                                    Tiếp Đón Tại Quầy (Front Desk)
                                </span>
                                <span className="text-xs text-slate-300">•</span>
                                <span className="text-xs text-slate-500 font-medium">
                                    {bookingTab === 'walk_in'
                                        ? 'Check-in tức thì hôm nay'
                                        : 'Đặt giữ chỗ trước (Check-in sau)'}
                                </span>
                            </div>
                            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5 tracking-tight">
                                {bookingTab === 'walk_in'
                                    ? 'Khách Vãng Lai (Walk-in Guest)'
                                    : 'Đặt Phòng Trước (Phone / Advance Reservation)'}
                            </h3>
                        </div>
                    </div>

                    <button
                        type="button"
                        disabled={isSubmittingWalkIn}
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                        title="Đóng modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ==================== 2. TAB SWITCHER ==================== */}
                <div className="px-5 sm:px-6 pt-4 pb-2 shrink-0 bg-white">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                        <button
                            type="button"
                            onClick={() => {
                                setBookingTab('walk_in');
                                const todayStr = new Date().toISOString().split('T')[0];
                                setWalkInForm((prev) => ({ ...prev, check_in_date: todayStr }));
                            }}
                            className={`py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2.5 cursor-pointer ${
                                bookingTab === 'walk_in'
                                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80 font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <UserCheck className="w-4 h-4" />
                            <div className="text-left">
                                <div>1. Khách Vãng Lai (Walk-in)</div>
                                <div className="text-[10px] text-slate-400 font-normal hidden sm:block">
                                    Tới quầy nhận phòng ngay hôm nay
                                </div>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => setBookingTab('advance')}
                            className={`py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2.5 cursor-pointer ${
                                bookingTab === 'advance'
                                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <PhoneCall className="w-4 h-4" />
                            <div className="text-left">
                                <div>2. Đặt Trước Qua Điện Thoại / Zalo</div>
                                <div className="text-[10px] text-slate-400 font-normal hidden sm:block">
                                    Giữ chỗ ngày khác, tới check-in sau
                                </div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* ==================== 3. FORM BODY + STICKY FOOTER ==================== */}
                <form onSubmit={handleConfirmWalkIn} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* SCROLLABLE CONTENT AREA */}
                    <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                            {/* ==================== CỘT 1: THÔNG TIN KHÁCH HÀNG ==================== */}
                            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-3.5">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                                    <div className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                        <User className="w-4 h-4 text-blue-600" />
                                        <span>1. Thông tin Khách lưu trú</span>
                                    </div>
                                    <span className="text-[10px] text-rose-500 font-semibold">* Bắt buộc</span>
                                </div>

                                {/* 1.0 Phân loại khách hàng: Cá nhân vs Doanh nghiệp */}
                                <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-xl text-xs">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setWalkInForm((prev) => ({
                                                ...prev,
                                                customer_type: 'MEMBER',
                                                company_name: '',
                                                company_tax_code: '',
                                                company_address: ''
                                            }))
                                        }
                                        className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                            walkInForm.customer_type === 'MEMBER'
                                                ? 'bg-white text-slate-900 shadow-2xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <User className="w-3.5 h-3.5" />
                                        <span>Cá nhân / Gia đình</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setWalkInForm((prev) => ({ ...prev, customer_type: 'CORPORATE' }))}
                                        className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                            walkInForm.customer_type === 'CORPORATE'
                                                ? 'bg-indigo-600 text-white shadow-2xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <Building2 className="w-3.5 h-3.5" />
                                        <span>Doanh nghiệp / Đoàn</span>
                                    </button>
                                </div>

                                {/* THÔNG TIN DOANH NGHIỆP NẾU CHỌN CORPORATE */}
                                {walkInForm.customer_type === 'CORPORATE' && (
                                    <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2.5 animate-in fade-in">
                                        <div className="flex items-center justify-between pb-1 border-b border-indigo-200/60">
                                            <div className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                                                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                                                <span>Thông tin Xuất hóa đơn GTGT (VAT)</span>
                                            </div>
                                        </div>

                                        {corporatePartners.length > 0 && (
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                                    Chọn nhanh từ Đối tác B2B đã ký hợp đồng:
                                                </label>
                                                <select
                                                    value={walkInForm.corporate_partner_id || ''}
                                                    onChange={(e) => {
                                                        const pid = e.target.value;
                                                        if (!pid) {
                                                            setWalkInForm((prev) => ({
                                                                ...prev,
                                                                corporate_partner_id: '',
                                                                company_name: '',
                                                                company_tax_code: '',
                                                                company_address: ''
                                                            }));
                                                            return;
                                                        }
                                                        const found = corporatePartners.find(
                                                            (p) => String(p.id) === String(pid)
                                                        );
                                                        if (found) {
                                                            setWalkInForm((prev) => ({
                                                                ...prev,
                                                                corporate_partner_id: pid,
                                                                company_name: found.company_name || prev.company_name,
                                                                company_tax_code: found.tax_code || prev.company_tax_code,
                                                                company_address: found.company_address || prev.company_address,
                                                                guest_name: prev.guest_name || found.contact_person || '',
                                                                guest_phone: prev.guest_phone || found.contact_phone || '',
                                                                guest_email: prev.guest_email || found.contact_email || ''
                                                            }));
                                                        }
                                                    }}
                                                    className="w-full px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                >
                                                    <option value="">-- Nhập thông tin doanh nghiệp mới / Vãng lai --</option>
                                                    {corporatePartners.map((p) => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.company_name} {p.tax_code ? `(MST: ${p.tax_code})` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                                Tên công ty / Doanh nghiệp <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required={walkInForm.customer_type === 'CORPORATE'}
                                                placeholder="VD: CÔNG TY CỔ PHẦN CÔNG NGHỆ FPT"
                                                value={walkInForm.company_name}
                                                onChange={(e) =>
                                                    setWalkInForm((prev) => ({ ...prev, company_name: e.target.value }))
                                                }
                                                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                                    Mã số thuế (MST) <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    required={walkInForm.customer_type === 'CORPORATE'}
                                                    placeholder="VD: 0101234567"
                                                    value={walkInForm.company_tax_code}
                                                    onChange={(e) =>
                                                        setWalkInForm((prev) => ({
                                                            ...prev,
                                                            company_tax_code: e.target.value.trim()
                                                        }))
                                                    }
                                                    className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                                    Địa chỉ xuất hóa đơn GTGT <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    required={walkInForm.customer_type === 'CORPORATE'}
                                                    placeholder="Địa chỉ trụ sở theo ĐKKD..."
                                                    value={walkInForm.company_address}
                                                    onChange={(e) =>
                                                        setWalkInForm((prev) => ({
                                                            ...prev,
                                                            company_address: e.target.value
                                                        }))
                                                    }
                                                    className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 1.1 Tên khách hàng */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        {walkInForm.customer_type === 'CORPORATE'
                                            ? 'Họ tên Người đại diện / Trưởng đoàn'
                                            : 'Họ và tên khách hàng'}{' '}
                                        <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="VD: Nguyễn Văn An"
                                        value={walkInForm.guest_name}
                                        onChange={(e) =>
                                            setWalkInForm((prev) => ({ ...prev, guest_name: e.target.value }))
                                        }
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                                    />
                                </div>

                                {/* 1.2 Số điện thoại */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Số điện thoại di động <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        placeholder="VD: 0912345678"
                                        value={walkInForm.guest_phone}
                                        onChange={(e) =>
                                            setWalkInForm((prev) => ({ ...prev, guest_phone: e.target.value }))
                                        }
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-1 block">
                                        Hệ thống tự động tra cứu hồ sơ cũ hoặc tạo mới theo SĐT.
                                    </span>
                                </div>

                                {/* 1.3 Số CCCD / Hộ chiếu */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Số CCCD / Hộ chiếu (Passport) <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            required
                                            placeholder="VD: 048099001234"
                                            value={walkInForm.identity_card}
                                            onChange={(e) =>
                                                setWalkInForm((prev) => ({ ...prev, identity_card: e.target.value }))
                                            }
                                            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                                        />
                                        <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-1 block">
                                        Bắt buộc khi khai báo lưu trú (8 - 20 ký tự).
                                    </span>
                                </div>

                                {/* 1.4 Email */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Địa chỉ Email <span className="text-slate-400 font-normal">(Không bắt buộc)</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="email"
                                            placeholder="VD: khachhang@gmail.com"
                                            value={walkInForm.guest_email}
                                            onChange={(e) =>
                                                setWalkInForm((prev) => ({ ...prev, guest_email: e.target.value }))
                                            }
                                            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                                        />
                                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                                    </div>
                                </div>

                                {/* 1.5 Tùy chọn Đăng ký tài khoản Thành viên */}
                                <div className="p-3 bg-blue-50/60 border border-blue-200/70 rounded-xl space-y-1">
                                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(walkInForm.create_account)}
                                            onChange={(e) =>
                                                setWalkInForm((prev) => ({
                                                    ...prev,
                                                    create_account: e.target.checked
                                                }))
                                            }
                                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                                        />
                                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                                            <span>Tạo tài khoản thành viên Loyalty</span>
                                        </span>
                                    </label>
                                    <p className="text-[10px] text-slate-500 pl-6.5 leading-relaxed">
                                        {walkInForm.create_account
                                            ? 'Tạo tài khoản để khách đăng nhập Website, tích điểm loyalty và theo dõi lịch sử.'
                                            : 'Không tích: Khách vãng lai thông thường (tránh tạo tài khoản ảo).'}
                                    </p>
                                </div>

                                {/* 1.6 Ghi chú của khách */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Yêu cầu của khách <span className="text-slate-400 font-normal">(Ghi chú)</span>
                                    </label>
                                    <textarea
                                        rows={2}
                                        placeholder="VD: Khách yêu cầu tầng cao, thanh toán tiền mặt, xuất hóa đơn VAT..."
                                        value={walkInForm.note}
                                        onChange={(e) =>
                                            setWalkInForm((prev) => ({ ...prev, note: e.target.value }))
                                        }
                                        className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
                                    />
                                </div>
                            </div>

                            {/* ==================== CỘT 2: THÔNG TIN PHÒNG & THỜI GIAN ==================== */}
                            {bookingTab === 'walk_in' ? (
                                /* TAB 1: WALK-IN (NHẬN PHÒNG NGAY HÔM NAY) */
                                <div className="p-4 rounded-xl bg-emerald-50/30 border border-emerald-200/80 space-y-3.5">
                                    <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60 gap-2">
                                        <div className="font-bold text-xs uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                                            <BedDouble className="w-4 h-4 text-emerald-600" />
                                            <span>2. Chọn phòng thực tế & Thời gian</span>
                                        </div>
                                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                                            {walkInAvailableRooms.length} phòng sẵn sàng
                                        </span>
                                    </div>

                                    {/* 2.1 Khung Ngày Check-in & Check-out */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                                Ngày Check-in <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                                                <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                <span>Hôm nay ({formatDateDisplay(walkInForm.check_in_date)})</span>
                                            </div>
                                            <span className="text-[10px] text-emerald-700 font-medium mt-1 block">
                                                Nhận phòng ngay tại quầy
                                            </span>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                                                <span>
                                                    Ngày Check-out <span className="text-rose-500">*</span>
                                                </span>
                                                <span className="text-[10px] text-slate-400">Trước 12:00</span>
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="date"
                                                    required
                                                    min={walkInForm.check_in_date}
                                                    value={walkInForm.check_out_date}
                                                    onChange={(e) =>
                                                        setWalkInForm((prev) => ({
                                                            ...prev,
                                                            check_out_date: e.target.value
                                                        }))
                                                    }
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-xs font-bold text-slate-900 transition cursor-pointer"
                                                />
                                            </div>
                                            <span className="text-[10px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                                                <Moon className="w-3 h-3" />
                                                <span>Thời gian lưu trú: {nights} đêm</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* 2.2 Dropdown Chọn Phòng Thực Tế */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-xs font-bold text-slate-900">
                                                Chọn phòng đón khách <span className="text-rose-500">*</span>
                                            </label>
                                            <span className="text-[10px] text-slate-400">
                                                Danh sách phòng trống khả dụng
                                            </span>
                                        </div>

                                        {isLoadingWalkInRooms ? (
                                            <div className="p-3 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
                                                <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                                                Đang tải danh sách phòng khả dụng...
                                            </div>
                                        ) : walkInAvailableRooms.length === 0 ? (
                                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
                                                Hiện tại khách sạn không còn phòng trống ở trạng thái "Sẵn sàng"!
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <select
                                                    id="walk-in-room-select"
                                                    value={walkInForm.room_id}
                                                    onChange={(e) =>
                                                        setWalkInForm((prev) => ({ ...prev, room_id: e.target.value }))
                                                    }
                                                    className="w-full pl-3 pr-8 py-2.5 bg-white border-2 border-emerald-400 focus:border-emerald-600 rounded-xl text-xs font-bold text-slate-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition cursor-pointer appearance-none"
                                                >
                                                    {walkInAvailableRooms.map((r) => {
                                                        const price =
                                                            Number(r.category?.promo_price) ||
                                                            Number(r.category_base_price) ||
                                                            Number(r.category?.base_price) ||
                                                            0;
                                                        return (
                                                            <option key={r.id} value={r.id}>
                                                                Phòng {r.room_number} — Tầng {r.floor} • {r.category_name || r.category?.name} ({price.toLocaleString('vi-VN')} đ/đêm)
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                <ChevronDown className="w-4 h-4 text-emerald-700 pointer-events-none absolute right-3 top-3.5" />
                                            </div>
                                        )}
                                    </div>

                                    {/* 2.2.1 Thẻ Tóm Tắt Phòng & Dự Toán Tiền (Được gộp tinh gọn) */}
                                    {selectedRoom && (
                                        <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs space-y-2.5">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                                        {selectedRoom.room_number}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-slate-900 text-xs truncate">
                                                            Phòng {selectedRoom.room_number} — Tầng {selectedRoom.floor}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 truncate">
                                                            {selectedRoom.category_name || selectedRoom.category?.name} •{' '}
                                                            {selectedRoom.category_bed_type || '1 Giường King'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 flex items-center gap-1 shrink-0">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    <span>Sẵn sàng</span>
                                                </span>
                                            </div>

                                            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                                                <div className="flex items-center justify-between text-slate-600">
                                                    <span>Tiền phòng ({nights} đêm x {pricePerNight.toLocaleString('vi-VN')} đ):</span>
                                                    <span className="font-mono font-bold text-slate-900">
                                                        {roomAmount.toLocaleString('vi-VN')} VND
                                                    </span>
                                                </div>
                                                {servicesTotal > 0 && (
                                                    <div className="flex items-center justify-between text-emerald-700 font-medium">
                                                        <span>
                                                            Dịch vụ đặt kèm ({(walkInForm.selected_services || []).length} món):
                                                        </span>
                                                        <span className="font-mono font-bold">
                                                            +{servicesTotal.toLocaleString('vi-VN')} VND
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 font-bold text-slate-800">
                                                    <span className="uppercase text-[11px] tracking-wide text-slate-600">
                                                        Tổng thanh toán:
                                                    </span>
                                                    <span className="font-black text-base text-rose-600 font-mono">
                                                        {grandTotal.toLocaleString('vi-VN')} VND
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* 2.2.2 Chọn Dịch Vụ Đặt Kèm */}
                                    <WalkInServicePicker
                                        serviceCatalog={serviceCatalog}
                                        selectedServices={walkInForm.selected_services || []}
                                        onChangeServices={(services) =>
                                            setWalkInForm((prev) => ({ ...prev, selected_services: services }))
                                        }
                                        isExpanded={isServicesAccordionOpen}
                                        onToggleExpand={() => setIsServicesAccordionOpen(!isServicesAccordionOpen)}
                                        accentColor="emerald"
                                    />

                                    {/* 2.3 Ghi chú nội bộ Lễ tân (Thẻ từ / Cọc) */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                                            Ghi chú nội bộ bàn giao thẻ từ / cọc
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="VD: Đã giao 2 thẻ từ phòng, đã thu cọc tiền mặt 500k..."
                                            value={walkInForm.internal_note}
                                            onChange={(e) =>
                                                setWalkInForm((prev) => ({
                                                    ...prev,
                                                    internal_note: e.target.value
                                                }))
                                            }
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                                        />
                                    </div>
                                </div>
                            ) : (
                                /* TAB 2: ĐẶT PHÒNG TRƯỚC (NHẬN PHÒNG NGÀY KHÁC TRONG TƯƠNG LAI) */
                                <div className="p-4 rounded-xl bg-indigo-50/30 border border-indigo-200/80 space-y-3.5">
                                    <div className="flex items-center justify-between pb-2 border-b border-indigo-200/60 gap-2">
                                        <div className="font-bold text-xs uppercase tracking-wider text-indigo-900 flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-indigo-600" />
                                            <span>2. Chọn Hạng Phòng & Ngày Giữ Chỗ</span>
                                        </div>
                                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full shrink-0">
                                            {advanceCategories.length} hạng phòng
                                        </span>
                                    </div>

                                    {/* 2.1 Chọn Ngày Check-in & Check-out tự do trong tương lai */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                                Ngày Check-in <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                required
                                                min={new Date().toISOString().split('T')[0]}
                                                value={walkInForm.check_in_date}
                                                onChange={(e) => {
                                                    const inDate = e.target.value;
                                                    setWalkInForm((prev) => {
                                                        let outDate = prev.check_out_date;
                                                        if (outDate <= inDate) {
                                                            const d = new Date(inDate);
                                                            d.setDate(d.getDate() + 1);
                                                            outDate = d.toISOString().split('T')[0];
                                                        }
                                                        return {
                                                            ...prev,
                                                            check_in_date: inDate,
                                                            check_out_date: outDate
                                                        };
                                                    });
                                                }}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-xs font-bold text-slate-900 transition cursor-pointer"
                                            />
                                            <span className="text-[10px] text-indigo-600 font-medium mt-1 block">
                                                Ngày khách hẹn nhận phòng
                                            </span>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                                                <span>
                                                    Ngày Check-out <span className="text-rose-500">*</span>
                                                </span>
                                                <span className="text-[10px] text-slate-400">Trước 12:00</span>
                                            </label>
                                            <input
                                                type="date"
                                                required
                                                min={walkInForm.check_in_date || new Date().toISOString().split('T')[0]}
                                                value={walkInForm.check_out_date}
                                                onChange={(e) =>
                                                    setWalkInForm((prev) => ({
                                                        ...prev,
                                                        check_out_date: e.target.value
                                                    }))
                                                }
                                                className="w-full px-3 py-2 bg-white border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 rounded-xl text-xs font-bold text-slate-900 transition cursor-pointer"
                                            />
                                            <span className="text-[10px] text-indigo-700 font-semibold mt-1 flex items-center gap-1">
                                                <Moon className="w-3 h-3" />
                                                <span>Thời gian lưu trú: {nights} đêm</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* 2.2 Dropdown Chọn Hạng Phòng Đặt Trước */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-xs font-bold text-slate-900">
                                                Chọn Hạng phòng giữ chỗ <span className="text-rose-500">*</span>
                                            </label>
                                            <span className="text-[10px] text-slate-400">
                                                Gán số phòng thực tế khi khách tới
                                            </span>
                                        </div>

                                        {isLoadingCategories ? (
                                            <div className="p-3 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
                                                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                                                Đang tải danh mục hạng phòng...
                                            </div>
                                        ) : advanceCategories.length === 0 ? (
                                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold">
                                                Không tìm thấy hạng phòng nào trong hệ thống!
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <select
                                                    id="advance-category-select"
                                                    value={walkInForm.category_id}
                                                    onChange={(e) =>
                                                        setWalkInForm((prev) => ({
                                                            ...prev,
                                                            category_id: e.target.value
                                                        }))
                                                    }
                                                    className="w-full pl-3 pr-8 py-2.5 bg-white border-2 border-indigo-400 focus:border-indigo-600 rounded-xl text-xs font-bold text-slate-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer appearance-none"
                                                >
                                                    {advanceCategories.map((c) => {
                                                        const price = Number(c.promo_price) || Number(c.base_price) || 0;
                                                        const availInfo = categoryAvailabilities[c.id];
                                                        const availRooms = availInfo
                                                            ? availInfo.available_rooms
                                                            : (c.available_rooms ?? c.rooms_count ?? null);
                                                        const isSoldOut = availInfo
                                                            ? availInfo.is_sold_out
                                                            : (availRooms !== null && availRooms <= 0);

                                                        return (
                                                            <option
                                                                key={c.id}
                                                                value={c.id}
                                                                className={isSoldOut ? 'text-rose-600 font-bold bg-rose-50' : ''}
                                                            >
                                                                {c.name} — {price.toLocaleString('vi-VN')} đ/đêm ({c.capacity || 2} khách)
                                                                {availRooms !== null
                                                                    ? isSoldOut
                                                                        ? ' [HẾT PHÒNG]'
                                                                        : ` [Còn ${availRooms} phòng]`
                                                                    : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                <ChevronDown className="w-4 h-4 text-indigo-700 pointer-events-none absolute right-3 top-3.5" />
                                            </div>
                                        )}
                                    </div>

                                    {/* 2.2.1 Thẻ Tóm Tắt Hạng Phòng & Dự Toán Tiền (Được gộp tinh gọn) */}
                                    {selectedCat && (
                                        <div className="p-3.5 rounded-xl bg-white border border-indigo-200/90 shadow-2xs space-y-2.5">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="font-bold text-slate-900 text-xs truncate">
                                                        {selectedCat.name}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 truncate">
                                                        Sức chứa: {selectedCat.capacity || 2} khách •{' '}
                                                        {selectedCat.bed_type || '1 Giường đôi'}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    {isLoadingAvailabilities ? (
                                                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200 animate-pulse">
                                                            Đang kiểm tra...
                                                        </span>
                                                    ) : curAvailRooms !== null ? (
                                                        <span
                                                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                                                isCurSoldOut
                                                                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                                                                    : curAvailRooms <= 2
                                                                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                                            }`}
                                                        >
                                                            {isCurSoldOut
                                                                ? 'Đã hết phòng'
                                                                : `Còn ${curAvailRooms} phòng trống`}
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                                                            Đang mở đặt
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Trạng thái đơn ban đầu */}
                                            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/70 flex items-center justify-between text-xs">
                                                <span className="font-semibold text-slate-700 text-[11px]">Trạng thái đơn:</span>
                                                <div className="flex items-center gap-3">
                                                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-emerald-700 text-xs">
                                                        <input
                                                            type="radio"
                                                            name="initial_status"
                                                            value="confirmed"
                                                            checked={walkInForm.initial_status === 'confirmed'}
                                                            onChange={() =>
                                                                setWalkInForm((prev) => ({
                                                                    ...prev,
                                                                    initial_status: 'confirmed'
                                                                }))
                                                            }
                                                            className="accent-emerald-600"
                                                        />
                                                        <span>Đã xác nhận</span>
                                                    </label>
                                                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-amber-700 text-xs">
                                                        <input
                                                            type="radio"
                                                            name="initial_status"
                                                            value="pending"
                                                            checked={walkInForm.initial_status === 'pending'}
                                                            onChange={() =>
                                                                setWalkInForm((prev) => ({
                                                                    ...prev,
                                                                    initial_status: 'pending'
                                                                }))
                                                            }
                                                            className="accent-amber-600"
                                                        />
                                                        <span>Chờ duyệt</span>
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                                                <div className="flex items-center justify-between text-slate-600">
                                                    <span>Tiền phòng ({nights} đêm x {pricePerNight.toLocaleString('vi-VN')} đ):</span>
                                                    <span className="font-mono font-bold text-slate-900">
                                                        {roomAmount.toLocaleString('vi-VN')} VND
                                                    </span>
                                                </div>
                                                {servicesTotal > 0 && (
                                                    <div className="flex items-center justify-between text-indigo-700 font-medium">
                                                        <span>
                                                            Dịch vụ đặt kèm ({(walkInForm.selected_services || []).length} món):
                                                        </span>
                                                        <span className="font-mono font-bold">
                                                            +{servicesTotal.toLocaleString('vi-VN')} VND
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 font-bold text-slate-800">
                                                    <span className="uppercase text-[11px] tracking-wide text-slate-600">
                                                        Tổng tiền giữ chỗ:
                                                    </span>
                                                    <span className="font-black text-base text-rose-600 font-mono">
                                                        {grandTotal.toLocaleString('vi-VN')} VND
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* 2.2.2 Dịch vụ đặt kèm */}
                                    <WalkInServicePicker
                                        serviceCatalog={serviceCatalog}
                                        selectedServices={walkInForm.selected_services || []}
                                        onChangeServices={(services) =>
                                            setWalkInForm((prev) => ({ ...prev, selected_services: services }))
                                        }
                                        isExpanded={isServicesAccordionOpen}
                                        onToggleExpand={() => setIsServicesAccordionOpen(!isServicesAccordionOpen)}
                                        accentColor="indigo"
                                    />

                                    {/* 2.3 Ghi chú nội bộ cuộc gọi */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                                            Ghi chú nội bộ cuộc gọi / nguồn đặt
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="VD: Khách gọi Hotline lúc 10h, hẹn nhận phòng 14h, chưa thanh toán cọc..."
                                            value={walkInForm.internal_note}
                                            onChange={(e) =>
                                                setWalkInForm((prev) => ({
                                                    ...prev,
                                                    internal_note: e.target.value
                                                }))
                                            }
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Banner hướng dẫn giao dịch */}
                        <div className="p-3 rounded-xl text-xs bg-slate-50 border border-slate-200/80 flex items-start gap-2.5 text-slate-600">
                            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                            <div className="leading-relaxed">
                                {bookingTab === 'walk_in' ? (
                                    <>
                                        Khi bấm <strong className="text-slate-800">"Tạo Đơn Walk-in"</strong>: Hệ thống tự động lưu đơn trạng thái <strong className="text-emerald-700">Đã xác nhận (confirmed)</strong> và gán giữ phòng thực tế đã chọn. Lễ tân có thể thu tiền phòng (QR/Tiền mặt) và bấm <strong>Check-in</strong> ngay trên danh sách.
                                    </>
                                ) : (
                                    <>
                                        Khi bấm <strong className="text-slate-800">"Tạo Đơn Đặt Giữ Chỗ"</strong>: Hệ thống lưu đơn đặt phòng trước theo Hạng phòng. Khi khách tới quầy vào ngày Check-in, Lễ tân chỉ cần bấm <strong>"Check-in"</strong> để chọn phòng vật lý cụ thể và bàn giao chìa khóa.
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ==================== 4. FIXED FOOTER ACTION BAR ==================== */}
                    <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
                        {/* Live Total Display */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-medium">Tổng dự kiến:</span>
                            <span className="font-mono font-black text-lg sm:text-xl text-rose-600">
                                {grandTotal.toLocaleString('vi-VN')}{' '}
                                <span className="text-xs font-semibold text-slate-500">VND</span>
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                                • {nights} đêm lưu trú
                            </span>
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                disabled={isSubmittingWalkIn}
                                onClick={onClose}
                                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 disabled:opacity-50 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
                            >
                                Hủy bỏ
                            </button>

                            <button
                                type="submit"
                                disabled={
                                    isSubmittingWalkIn ||
                                    !walkInForm.guest_name.trim() ||
                                    !walkInForm.guest_phone.trim() ||
                                    !walkInForm.identity_card.trim() ||
                                    !walkInForm.check_out_date ||
                                    (bookingTab === 'walk_in' &&
                                        (isLoadingWalkInRooms ||
                                            walkInAvailableRooms.length === 0 ||
                                            !walkInForm.room_id)) ||
                                    (bookingTab === 'advance' &&
                                        (isLoadingCategories ||
                                            advanceCategories.length === 0 ||
                                            !walkInForm.category_id ||
                                            !walkInForm.check_in_date))
                                }
                                className={`px-5 py-2 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    bookingTab === 'walk_in'
                                        ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                                }`}
                            >
                                {isSubmittingWalkIn ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>
                                            {bookingTab === 'walk_in'
                                                ? 'Đang tạo đơn...'
                                                : 'Đang tạo giữ chỗ...'}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <ClipboardCheck className="w-4 h-4" />
                                        <span>
                                            {bookingTab === 'walk_in'
                                                ? 'Tạo Đơn Walk-in'
                                                : 'Tạo Đơn Đặt Giữ Chỗ'}
                                        </span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
