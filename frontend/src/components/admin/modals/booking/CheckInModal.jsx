import React, { useState, useEffect, useMemo } from 'react';
import {
    X,
    KeyRound,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Building2,
    Calendar,
    Clock,
    Zap,
    User,
    Users,
    Phone,
    BedDouble,
    CreditCard,
    Plus,
    Minus,
    Trash2,
    Bell,
    Banknote,
    QrCode,
    FileSpreadsheet,
    MessageSquare,
    Info,
    Sparkles,
    Car,
    UtensilsCrossed,
    Bed,
    ChevronDown,
    Moon
} from 'lucide-react';
import { bookingService } from '../../../../services/bookingService';
import { paymentService } from '../../../../services/paymentService';
import api from '../../../../services/api';

// Helper format tiền tệ VNĐ
const formatCurrency = (amount) => {
    const num = Number(amount) || 0;
    return `${num.toLocaleString('vi-VN')}đ`;
};

// Helper format ngày hiển thị (VD: 14/10/2026)
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

// Helper format ngày giờ hiển thị chi tiết (VD: 16:30 ngày 14/10/2026)
const formatDateTimeDisplay = (dateStr) => {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const timePart = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const datePart = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `${timePart} ngày ${datePart}`;
    } catch {
        return dateStr;
    }
};

// Helper phân loại nhóm dịch vụ để tùy biến thông báo nhân viên
const getServiceDeptMeta = (serviceName = '', categoryName = '') => {
    const text = `${categoryName || ''} ${serviceName || ''}`.trim().toLowerCase();
    if (['sân bay', 'xe', 'đưa đón', 'transfer', 'airport', 'taxi', 'shuttle', 'đón tiễn'].some((k) => text.includes(k))) {
        return {
            dept: 'Điều vận / Đội xe',
            icon: Car,
            action: 'sắp xếp xe & tài xế',
            inProgressLabel: 'Điều vận đang điều xe...',
            timePrompt: 'Hẹn giờ đón:'
        };
    }
    if (['spa', 'massage', 'trị liệu', 'xông hơi', 'sauna', 'thư giãn', 'wellness', 'chăm sóc da'].some((k) => text.includes(k))) {
        return {
            dept: 'Spa & Trị liệu',
            icon: Sparkles,
            action: 'chuẩn bị phòng trị liệu & KTV',
            inProgressLabel: 'Spa đang trị liệu...',
            timePrompt: 'Hẹn giờ liệu trình:'
        };
    }
    if (['gối', 'khăn', 'tắm', 'giặt', 'ủi', 'buồng phòng', 'tiện ích', 'bàn chải', 'kem đánh răng', 'dép', 'dọn phòng', 'housekeeping', 'laundry', 'amenities', 'chăn', 'nệm'].some((k) => text.includes(k))) {
        return {
            dept: 'Buồng phòng',
            icon: Bed,
            action: 'chuẩn bị tiện ích buồng phòng',
            inProgressLabel: 'Buồng phòng đang làm...',
            timePrompt: 'Hẹn giờ mang lên:'
        };
    }
    return {
        dept: 'Bếp / F&B',
        icon: UtensilsCrossed,
        action: 'chuẩn bị và chế biến món ăn',
        inProgressLabel: 'Bếp đang nấu...',
        timePrompt: 'Hẹn giờ phục vụ:'
    };
};

export default function CheckInModal({ booking: initialBooking, isOpen = true, onClose, onSuccess }) {
    // Lưu trữ booking state nội bộ để đồng bộ với chi tiết mới nhất từ backend
    const [booking, setBooking] = useState(initialBooking);

    useEffect(() => {
        setBooking(initialBooking);
    }, [initialBooking]);

    // 1. STATE DỮ LIỆU PHÒNG & THỦ TỤC
    const [availableRooms, setAvailableRooms] = useState([]);
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [checkInNote, setCheckInNote] = useState('');
    const [isLoadingRooms, setIsLoadingRooms] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Danh sách dịch vụ đặt kèm trước (Add-on Services)
    const [servicesList, setServicesList] = useState(() => {
        if (initialBooking?.selected_services && Array.isArray(initialBooking.selected_services) && initialBooking.selected_services.length > 0) {
            return initialBooking.selected_services;
        }
        if (initialBooking?.service_requests && Array.isArray(initialBooking.service_requests) && initialBooking.service_requests.length > 0) {
            return initialBooking.service_requests;
        }
        return [];
    });
    const [isUpdatingServiceId, setIsUpdatingServiceId] = useState(null);
    const [notifiedServiceIds, setNotifiedServiceIds] = useState(new Set());
    // Lưu lựa chọn hẹn giờ giao cho từng dịch vụ: { [serviceId]: 'now' | '30m' | '1h' | '2h' | 'custom' }
    const [serviceScheduleTimes, setServiceScheduleTimes] = useState({});
    // Lưu giờ cụ thể tùy chọn (VD: '20:00'): { [serviceId]: '20:00' }
    const [serviceCustomTimes, setServiceCustomTimes] = useState({});

    // Xử lý Early Check-in (Đến sớm) / Late Check-in (Đến trễ)
    const [confirmEarlyCheckIn, setConfirmEarlyCheckIn] = useState(false);
    const [applyEarlyCharge, setApplyEarlyCharge] = useState(true);
    const [confirmLateCheckIn, setConfirmLateCheckIn] = useState(false);

    // Cấu hình khách sạn & phụ thu động từ Cài đặt hệ thống
    const [hotelSettings, setHotelSettings] = useState({
        check_in_time: '14:00',
        check_out_time: '12:00',
        early_checkin_before_6am: 100,
        early_checkin_6am_9am: 50,
        early_checkin_9am_12pm: 30,
        early_checkin_9am_2pm: 30
    });
    const [applySameDayEarlyCharge, setApplySameDayEarlyCharge] = useState(true);

    // Form thanh toán thu nốt phần remaining_balance khi click "Thu tiền & Check-in"
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'transfer'
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

    // Cấu hình ngân hàng VietQR động
    const [bankConfig, setBankConfig] = useState({
        bank_bin: '970422',
        account_no: '0344997778',
        account_name: 'KHACH SAN TA DA NANG'
    });

    // Tự động tải cấu hình tài khoản thụ hưởng & Cài đặt hệ thống từ Backend
    useEffect(() => {
        let isMounted = true;
        Promise.allSettled([
            api.get('/payments/config/'),
            api.get('/hotel-settings/')
        ]).then(([bankRes, hotelRes]) => {
            if (!isMounted) return;
            if (bankRes.status === 'fulfilled') {
                const data = bankRes.value.data?.data || bankRes.value.data;
                if (data && data.account_no) {
                    setBankConfig({
                        bank_bin: data.bank_bin || '970422',
                        account_no: data.account_no,
                        account_name: (data.account_name || 'KHACH SAN TA DA NANG').toUpperCase()
                    });
                }
            }
            if (hotelRes.status === 'fulfilled') {
                const hData = hotelRes.value.data?.data || hotelRes.value.data;
                if (hData) {
                    const early9to12 = hData.early_checkin_9am_12pm !== undefined && hData.early_checkin_9am_12pm !== null
                        ? Number(hData.early_checkin_9am_12pm)
                        : (hData.early_checkin_9am_2pm !== undefined && hData.early_checkin_9am_2pm !== null ? Number(hData.early_checkin_9am_2pm) : 30);

                    setHotelSettings((prev) => ({
                        ...prev,
                        check_in_time: hData.check_in_time || prev.check_in_time,
                        check_out_time: hData.check_out_time || prev.check_out_time,
                        early_checkin_before_6am: hData.early_checkin_before_6am !== undefined && hData.early_checkin_before_6am !== null ? Number(hData.early_checkin_before_6am) : 100,
                        early_checkin_6am_9am: hData.early_checkin_6am_9am !== undefined && hData.early_checkin_6am_9am !== null ? Number(hData.early_checkin_6am_9am) : 50,
                        early_checkin_9am_12pm: early9to12,
                        early_checkin_9am_2pm: early9to12
                    }));
                }
            }
        }).catch(() => {});
        return () => { isMounted = false; };
    }, []);

    // Thông báo màu trắng giữa màn hình (thay thế browser alert mặc định)
    const [centerModalNotice, setCenterModalNotice] = useState(null);
    const [showDebtConfirmModal, setShowDebtConfirmModal] = useState(false);

    const showCenterNotice = ({ title = 'Thông Báo', message, type = 'info', icon = null }) => {
        setCenterModalNotice({ title, message, type, icon });
    };

    // Tự động tắt thông báo giữa màn hình sau 4 giây
    useEffect(() => {
        if (!centerModalNotice) return;
        const timer = setTimeout(() => {
            setCenterModalNotice(null);
        }, 4000);
        return () => clearTimeout(timer);
    }, [centerModalNotice]);

    // Sức chứa tiêu chuẩn của phòng/hạng phòng
    const roomCapacity = useMemo(() => {
        return Number(booking?.capacity || booking?.category?.capacity || 2);
    }, [booking]);

    // DANH SÁCH KHÁCH LƯU TRÚ (KHAI BÁO LƯU TRÚ KHI CHECK-IN)
    const [guests, setGuests] = useState(() => {
        const details = booking?.guest_details || {};
        const fallbackIdCard = (details.id_number || booking?.identity_card || '').trim();

        if (booking?.guests && Array.isArray(booking.guests) && booking.guests.length > 0) {
            return booking.guests.map((g, idx) => {
                const isPrimary = Boolean(g.is_primary ?? idx === 0);
                const guestIdCard = (g.id_number || g.identity_card || (isPrimary ? fallbackIdCard : '') || '').trim();
                return {
                    id: g.id || `guest_${idx}_${Date.now()}`,
                    full_name: g.full_name || (isPrimary ? (details.full_name || booking?.guest_name || '') : ''),
                    id_type: g.id_type || details.id_type || 'CCCD',
                    id_number: guestIdCard,
                    date_of_birth: g.date_of_birth || (isPrimary ? details.date_of_birth : '') || '',
                    gender: g.gender || (isPrimary ? details.gender : 'Nam') || 'Nam',
                    nationality: g.nationality || (isPrimary ? details.nationality : 'Việt Nam') || 'Việt Nam',
                    is_primary: isPrimary
                };
            });
        }
        return [
            {
                id: 'primary',
                full_name: details.full_name || booking?.guest_name || '',
                id_type: details.id_type || 'CCCD',
                id_number: fallbackIdCard,
                date_of_birth: details.date_of_birth || '',
                gender: details.gender || 'Nam',
                nationality: details.nationality || 'Việt Nam',
                is_primary: true
            }
        ];
    });

    // Đồng bộ lại danh sách khách nếu booking thay đổi hoặc vừa được tải về từ Backend
    useEffect(() => {
        const details = booking?.guest_details || {};
        const fallbackIdCard = (details.id_number || booking?.identity_card || '').trim();

        if (booking?.guests && Array.isArray(booking.guests) && booking.guests.length > 0) {
            setGuests(booking.guests.map((g, idx) => {
                const isPrimary = Boolean(g.is_primary ?? idx === 0);
                const guestIdCard = (g.id_number || g.identity_card || (isPrimary ? fallbackIdCard : '') || '').trim();
                return {
                    id: g.id || `guest_${idx}_${Date.now()}`,
                    full_name: g.full_name || (isPrimary ? (details.full_name || booking?.guest_name || '') : ''),
                    id_type: g.id_type || details.id_type || 'CCCD',
                    id_number: guestIdCard,
                    date_of_birth: g.date_of_birth || (isPrimary ? details.date_of_birth : '') || '',
                    gender: g.gender || (isPrimary ? details.gender : 'Nam') || 'Nam',
                    nationality: g.nationality || (isPrimary ? details.nationality : 'Việt Nam') || 'Việt Nam',
                    is_primary: isPrimary
                };
            }));
        }
    }, [booking?.id, booking?.guests, booking?.identity_card]);

    // State cho tính năng [Dán nhanh danh sách đoàn] (Bulk / Fast Paste from Excel/Clipboard)
    const [showFastPasteModal, setShowFastPasteModal] = useState(false);
    const [fastPasteText, setFastPasteText] = useState('');
    const [fastPasteError, setFastPasteError] = useState('');

    const handleApplyFastPaste = () => {
        setFastPasteError('');
        const raw = (fastPasteText || '').trim();
        if (!raw) {
            setFastPasteError('Vui lòng dán danh sách khách từ Excel hoặc văn bản.');
            return;
        }

        const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
        if (lines.length === 0) {
            setFastPasteError('Không tìm thấy dòng dữ liệu nào hợp lệ.');
            return;
        }

        const parsedGuests = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Tách theo Tab (khi copy từ Excel) hoặc dấu phẩy (,) hoặc gạch đứng (|)
            let parts = line.includes('\t')
                ? line.split('\t')
                : line.includes(',')
                    ? line.split(',')
                    : line.includes('|')
                        ? line.split('|')
                        : line.split(/\s{2,}/);

            parts = parts.map((p) => p.trim());
            const fullName = parts[0] || '';
            if (!fullName) continue;

            const idCard = parts[1] || '';
            const genderRaw = (parts[2] || '').toLowerCase();
            let gender = 'Nam';
            if (genderRaw.includes('nữ') || genderRaw.includes('female') || genderRaw === 'f') {
                gender = 'Nữ';
            } else if (genderRaw.includes('khác') || genderRaw.includes('other')) {
                gender = 'Khác';
            }

            const dob = parts[3] || '';

            parsedGuests.push({
                id: `fast_guest_${Date.now()}_${i}`,
                full_name: fullName,
                id_type: 'CCCD',
                id_number: idCard,
                gender: gender,
                date_of_birth: dob,
                nationality: 'Việt Nam',
                is_primary: parsedGuests.length === 0 && guests.length === 0
            });
        }

        if (parsedGuests.length === 0) {
            setFastPasteError('Không thể phân tích dữ liệu. Vui lòng kiểm tra lại định dạng.');
            return;
        }

        setGuests((prev) => {
            const isSingleEmpty = prev.length === 1 && !prev[0].full_name.trim();
            if (isSingleEmpty) {
                return parsedGuests;
            }
            return [...prev, ...parsedGuests];
        });

        setShowFastPasteModal(false);
        setFastPasteText('');
        showCenterNotice({
            title: 'Dán Danh Sách Thành Công',
            message: `Đã nạp thành công ${parsedGuests.length} khách lưu trú vào danh sách nhận phòng!`,
            type: 'success'
        });
    };

    const isOverCapacity = guests.length > roomCapacity;

    const handleAddGuest = () => {
        setGuests((prev) => [
            ...prev,
            {
                id: `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                full_name: '',
                id_type: 'CCCD',
                id_number: '',
                date_of_birth: '',
                gender: 'Nam',
                nationality: 'Việt Nam',
                is_primary: false
            }
        ]);
    };

    const handleRemoveGuest = (indexToRemove) => {
        setGuests((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const handleGuestChange = (index, field, value) => {
        setGuests((prev) =>
            prev.map((g, idx) => (idx === index ? { ...g, [field]: value } : g))
        );
    };

    const validateGuests = () => {
        if (!guests || guests.length === 0) {
            showCenterNotice({
                title: 'Chưa Đủ Thông Tin Khách',
                message: 'Vui lòng khai báo ít nhất thông tin 1 khách lưu trú.',
                type: 'warning'
            });
            return false;
        }

        for (let i = 0; i < guests.length; i++) {
            const g = guests[i];
            const title = g.is_primary ? 'Người đại diện đặt phòng' : `Khách đi cùng #${i}`;

            if (!g.full_name || !g.full_name.trim()) {
                showCenterNotice({
                    title: 'Thiếu Họ Và Tên',
                    message: `Vui lòng nhập đầy đủ Họ và tên cho ${title}.`,
                    type: 'warning'
                });
                return false;
            }

            // Bắt buộc nhập số CCCD/Hộ chiếu trừ khi chọn OTHER (Trẻ em / Khác)
            if (g.id_type !== 'OTHER') {
                if (!g.id_number || !g.id_number.trim()) {
                    showCenterNotice({
                        title: 'Thiếu Giấy Tờ Tùy Thân',
                        message: `Vui lòng nhập Số ${g.id_type === 'PASSPORT' ? 'Hộ chiếu' : 'CCCD/CMND'} cho ${title}.`,
                        type: 'warning'
                    });
                    return false;
                }
            }
        }
        return true;
    };

    const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    // 2. TÍNH TOÁN ĐẾN SỚM (EARLY) / ĐẾN TRỄ (LATE) / QUÁ HẠN LƯU TRÚ
    const isExpiredCheckIn = useMemo(() => {
        if (!booking?.check_out_date) return false;
        return String(booking.check_out_date).split('T')[0] <= todayDateStr;
    }, [booking?.check_out_date, todayDateStr]);

    const isEarlyCheckIn = useMemo(() => {
        if (!booking?.check_in_date || isExpiredCheckIn) return false;
        return String(booking.check_in_date).split('T')[0] > todayDateStr;
    }, [booking?.check_in_date, isExpiredCheckIn, todayDateStr]);

    const earlyDaysCount = useMemo(() => {
        if (!booking?.check_in_date || !isEarlyCheckIn) return 0;
        const d1 = new Date(String(booking.check_in_date).split('T')[0]);
        const d2 = new Date(todayDateStr);
        d1.setHours(0, 0, 0, 0);
        d2.setHours(0, 0, 0, 0);
        return Math.max(0, Math.round((d1 - d2) / (1000 * 60 * 60 * 24)));
    }, [booking?.check_in_date, isEarlyCheckIn, todayDateStr]);

    const isLateCheckIn = useMemo(() => {
        if (!booking?.check_in_date || isExpiredCheckIn) return false;
        return String(booking.check_in_date).split('T')[0] < todayDateStr;
    }, [booking?.check_in_date, isExpiredCheckIn, todayDateStr]);

    const lateDaysCount = useMemo(() => {
        if (!booking?.check_in_date || !isLateCheckIn) return 0;
        const dToday = new Date(todayDateStr);
        const dOriginal = new Date(String(booking.check_in_date).split('T')[0]);
        dToday.setHours(0, 0, 0, 0);
        dOriginal.setHours(0, 0, 0, 0);
        return Math.max(0, Math.round((dToday - dOriginal) / (1000 * 60 * 60 * 24)));
    }, [booking?.check_in_date, isLateCheckIn, todayDateStr]);

    const remainingNightsCount = useMemo(() => {
        if (!booking?.check_out_date) return 0;
        const dOut = new Date(String(booking.check_out_date).split('T')[0]);
        const dToday = new Date(todayDateStr);
        dOut.setHours(0, 0, 0, 0);
        dToday.setHours(0, 0, 0, 0);
        return Math.max(0, Math.round((dOut - dToday) / (1000 * 60 * 60 * 24)));
    }, [booking?.check_out_date, todayDateStr]);

    // 3. TÍNH TOÁN TÀI CHÍNH FOLIO BALANCE ĐỘNG TỪ BACKEND
    const baseRoomCharge = useMemo(() => {
        return Number(booking?.room_charge ?? booking?.room_amount ?? booking?.total_amount ?? 0);
    }, [booking]);

    const dailyRate = useMemo(() => {
        if (booking?.daily_rate) return Number(booking.daily_rate);
        const nights = booking?.nights || 1;
        return Number(baseRoomCharge / nights);
    }, [booking, baseRoomCharge]);

    // Tiền phụ thu dự kiến khi đến sớm
    const estimatedEarlyCharge = useMemo(() => {
        if (!isEarlyCheckIn || !earlyDaysCount) return 0;
        return dailyRate * earlyDaysCount;
    }, [isEarlyCheckIn, earlyDaysCount, dailyRate]);

    // Tiền phòng hiệu dụng (Đã cộng thêm phụ thu đến sớm nếu có)
    const effectiveRoomCharge = useMemo(() => {
        if (isEarlyCheckIn && applyEarlyCharge) {
            return baseRoomCharge + estimatedEarlyCharge;
        }
        return baseRoomCharge;
    }, [baseRoomCharge, isEarlyCheckIn, applyEarlyCharge, estimatedEarlyCharge]);

    // Tự động phát hiện nhận phòng sớm trong ngày (Same-day Early Check-in) theo Cài đặt hệ thống
    const sameDayEarlyCheckInInfo = useMemo(() => {
        if (!booking?.check_in_date || isEarlyCheckIn || isLateCheckIn || isExpiredCheckIn) return null;
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;
        const bCheckInStr = String(booking.check_in_date).split('T')[0];

        if (todayStr !== bCheckInStr) return null;

        const [stdH, stdM] = (hotelSettings.check_in_time || '14:00').split(':').map(Number);
        const stdDecimal = (stdH || 14) + (stdM || 0) / 60;
        const currentDecimal = now.getHours() + now.getMinutes() / 60;

        if (currentDecimal >= stdDecimal) return null;

        let percent = Number(hotelSettings.early_checkin_before_6am !== undefined ? hotelSettings.early_checkin_before_6am : 100);
        let rule = `Trước 06:00 sáng (+${percent}% 1 đêm)`;
        if (currentDecimal >= 9) {
            const p = hotelSettings.early_checkin_9am_12pm !== undefined ? hotelSettings.early_checkin_9am_12pm : hotelSettings.early_checkin_9am_2pm;
            percent = Number(p !== undefined ? p : 30);
            rule = `09:00 - ${hotelSettings.check_in_time || '14:00'} (+${percent}%)`;
        } else if (currentDecimal >= 6) {
            percent = Number(hotelSettings.early_checkin_6am_9am !== undefined ? hotelSettings.early_checkin_6am_9am : 50);
            rule = `06:00 - 09:00 (+${percent}%)`;
        }

        const nights = Math.max(1, Number(booking.nights) || 1);
        const rawRoom = Number(booking?.room_charge ?? booking?.room_amount ?? booking?.total_amount ?? 0);
        const dayRate = nights > 0 ? (rawRoom / nights) : rawRoom;
        const amount = Math.round((dayRate * percent) / 100);

        const currentTimeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        return {
            percent,
            amount,
            rule,
            currentTime: currentTimeStr
        };
    }, [booking, isEarlyCheckIn, isLateCheckIn, isExpiredCheckIn, hotelSettings]);

    const sameDayEarlySurcharge = (sameDayEarlyCheckInInfo && applySameDayEarlyCharge) ? sameDayEarlyCheckInInfo.amount : 0;

    const isGroupRoom = Boolean(
        booking?.group_booking ||
        booking?.group_booking_code ||
        booking?.group_booking_id
    );

    const paidAmount = useMemo(() => {
        if (booking?.paid_amount !== undefined && booking?.paid_amount !== null) {
            return Number(booking.paid_amount);
        }
        if (booking?.is_paid || booking?.status === 'paid' || booking?.payment_status === 'COMPLETED') {
            return baseRoomCharge;
        }
        return 0;
    }, [booking, baseRoomCharge]);

    const preOrderedServicesTotal = useMemo(() => {
        return Number(booking?.service_charge ?? booking?.extra_services_total ?? 0);
    }, [booking]);

    const totalExpectedCharges = useMemo(() => {
        return effectiveRoomCharge + sameDayEarlySurcharge + preOrderedServicesTotal;
    }, [effectiveRoomCharge, sameDayEarlySurcharge, preOrderedServicesTotal]);

    const effectiveRemainingBalance = useMemo(() => {
        if (isGroupRoom) {
            return 0;
        }
        return Math.max(0, totalExpectedCharges - paidAmount);
    }, [isGroupRoom, totalExpectedCharges, paidAmount]);

    const isFullyPaid = isGroupRoom || effectiveRemainingBalance <= 0;

    const areServicesPaid = useMemo(() => {
        if (!servicesList || servicesList.length === 0) return false;
        const allItemsPaid = servicesList.every((s) => Boolean(s.is_paid));
        const isBookingPaid = Boolean(booking?.status === 'paid' || booking?.status === 'PAID' || booking?.payment_status === 'COMPLETED');
        return allItemsPaid || (isBookingPaid && isFullyPaid);
    }, [servicesList, booking, isFullyPaid]);

    // 4. TẢI DANH SÁCH PHÒNG TRỐNG & CẤU HÌNH VIETQR
    useEffect(() => {
        if (!booking?.id || !isOpen) return;

        let isMounted = true;
        const loadInitialData = async () => {
            setIsLoadingRooms(true);
            try {
                const roomRes = await bookingService.getAvailableRoomsForBooking(
                    booking.id,
                    booking.category_id || booking.category?.id
                );
                if (isMounted && roomRes?.success) {
                    const rooms = roomRes.rooms || [];
                    setAvailableRooms(rooms);
                    if (rooms.length > 0) {
                        const preAssignedId = booking.room_id || (typeof booking.room === 'object' ? booking.room?.id : booking.room);
                        const match = preAssignedId ? rooms.find((r) => String(r.id) === String(preAssignedId)) : null;
                        setSelectedRoomId(String(match ? match.id : rooms[0].id));
                    }
                }

                const configRes = await api.get('/payments/config/');
                const cData = configRes.data?.data || configRes.data;
                if (isMounted && cData?.bank_bin) {
                    setBankConfig({
                        bank_bin: cData.bank_bin,
                        account_no: cData.account_no,
                        account_name: (cData.account_name || '').toUpperCase()
                    });
                }

                const bookingDetailRes = await api.get(`/bookings/${booking.id}/`);
                const bDetail = bookingDetailRes.data?.data || bookingDetailRes.data;
                if (isMounted && bDetail) {
                    setBooking((prev) => ({ ...prev, ...bDetail }));
                    if (Array.isArray(bDetail.selected_services) && bDetail.selected_services.length > 0) {
                        setServicesList(bDetail.selected_services);
                    } else if (Array.isArray(bDetail.service_requests) && bDetail.service_requests.length > 0) {
                        setServicesList(bDetail.service_requests);
                    }
                }
            } catch (err) {
                console.error('Lỗi khi tải dữ liệu phục vụ Check-in:', err);
            } finally {
                if (isMounted) setIsLoadingRooms(false);
            }
        };

        loadInitialData();

        return () => {
            isMounted = false;
        };
    }, [booking?.id, isOpen]);

    const handleNotifyService = async (serviceReqId) => {
        try {
            setIsUpdatingServiceId(serviceReqId);

            const preset = serviceScheduleTimes[serviceReqId] || 'now';
            let targetIso = null;
            let label = 'Khách cần phục vụ ngay khi nhận phòng';
            if (preset === 'now') {
                targetIso = new Date().toISOString();
                label = 'Khách cần phục vụ ngay khi nhận phòng';
            } else if (preset === '30m') {
                targetIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();
                label = 'Khách hẹn giao sau 30 phút';
            } else if (preset === '1h') {
                targetIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
                label = 'Khách hẹn giao sau 1 tiếng';
            } else if (preset === '2h') {
                targetIso = new Date(Date.now() + 120 * 60 * 1000).toISOString();
                label = 'Khách hẹn giao sau 2 tiếng';
            } else if (preset === 'custom') {
                const customTime = serviceCustomTimes[serviceReqId] || '20:00';
                const [hrs, mins] = customTime.split(':').map(Number);
                const targetDate = new Date();
                targetDate.setHours(hrs || 0, mins || 0, 0, 0);
                if (targetDate.getTime() < Date.now() - 5 * 60 * 1000) {
                    targetDate.setDate(targetDate.getDate() + 1);
                }
                targetIso = targetDate.toISOString();
                label = `Khách hẹn giao lúc ${customTime}`;
            }

            const isScheduledChoice = preset !== 'now';
            const res = await api.post(`/services/requests/${serviceReqId}/notify-staff/`, {
                request_time: targetIso,
                schedule_label: label,
                is_scheduled: isScheduledChoice
            });

            setNotifiedServiceIds((prev) => new Set([...prev, serviceReqId]));

            setServicesList((prev) =>
                prev.map((s) =>
                    s.id === serviceReqId
                        ? {
                              ...s,
                              request_time: isScheduledChoice ? targetIso : null,
                              is_scheduled: isScheduledChoice,
                              note: s.note ? `${s.note} [${label}]` : label
                          }
                        : s
                )
            );

            try {
                localStorage.setItem('pms_last_service_event', Date.now().toString());
            } catch (e) {}

            const targetSvc = servicesList.find((s) => s.id === serviceReqId);
            const deptMeta = getServiceDeptMeta(targetSvc?.service_name, targetSvc?.category_name);
            const timeFormatted = targetIso
                ? new Date(targetIso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                : '';
            const popupMsg =
                preset === 'now'
                    ? `Đã gửi chuông báo cho bộ phận ${deptMeta.dept} ${deptMeta.action} phục vụ ngay! Đơn ở trạng thái "Chờ xử lý" để nhân viên tiếp nhận.`
                    : `Đã gửi chuông báo cho bộ phận ${deptMeta.dept}. Giờ hẹn phục vụ: ${timeFormatted} (${label}). Đơn ở trạng thái "Chờ xử lý" để nhân viên chủ động chuẩn bị đúng giờ!`;

            showCenterNotice({
                title: `Đã Báo ${deptMeta.dept} Chuẩn Bị`,
                message: res.data?.message || popupMsg,
                type: 'success',
                icon: 'bell'
            });
        } catch (err) {
            console.error('Lỗi khi gửi thông báo dịch vụ:', err);
            showCenterNotice({
                title: 'Không Thể Gửi Thông Báo',
                message: err.response?.data?.message || 'Không thể gửi thông báo tới bộ phận dịch vụ. Vui lòng thử lại sau.',
                type: 'error'
            });
        } finally {
            setIsUpdatingServiceId(null);
        }
    };

    const qrUrl = useMemo(() => {
        if (!bankConfig.bank_bin || !bankConfig.account_no || effectiveRemainingBalance <= 0) return '';
        const bCode = booking?.booking_code || `BK-${booking?.id}`;
        const addInfo = encodeURIComponent(`Thanh toan checkin ${bCode}`);
        return `https://img.vietqr.io/image/${bankConfig.bank_bin}-${bankConfig.account_no}-compact2.jpg?amount=${effectiveRemainingBalance}&addInfo=${addInfo}&accountName=${encodeURIComponent(
            bankConfig.account_name
        )}`;
    }, [bankConfig, effectiveRemainingBalance, booking]);

    const executeCheckIn = async (extraNote = '') => {
        if (!selectedRoomId) {
            showCenterNotice({
                title: 'Chưa Chọn Phòng',
                message: 'Vui lòng chọn phòng thực tế trước khi hoàn tất Check-in.',
                type: 'warning'
            });
            return;
        }

        if (isEarlyCheckIn && !confirmEarlyCheckIn) {
            showCenterNotice({
                title: 'Xác Nhận Check-in Sớm',
                message: `Vui lòng tích xác nhận đồng ý cho khách nhận phòng sớm ${earlyDaysCount} ngày.`,
                type: 'warning'
            });
            return;
        }

        if (isLateCheckIn && !confirmLateCheckIn) {
            showCenterNotice({
                title: 'Xác Nhận Check-in Trễ',
                message: `Vui lòng tích xác nhận đồng ý cho khách nhận phòng trễ ${lateDaysCount} ngày.`,
                type: 'warning'
            });
            return;
        }

        if (!validateGuests()) {
            return;
        }

        try {
            setIsSubmitting(true);
            const finalNote = [checkInNote.trim(), extraNote.trim()].filter(Boolean).join(' | ');

            const guestsPayload = guests.map((g) => ({
                full_name: g.full_name.trim(),
                id_type: g.id_type,
                id_number: g.id_number ? g.id_number.trim() : '',
                date_of_birth: g.date_of_birth || null,
                gender: g.gender || null,
                nationality: g.nationality ? g.nationality.trim() : 'Việt Nam',
                is_primary: Boolean(g.is_primary)
            }));

            const res = await bookingService.checkInBooking(booking.id, {
                room_id: selectedRoomId,
                internal_note: finalNote,
                confirm_early_check_in: confirmEarlyCheckIn,
                apply_early_charge: applyEarlyCharge,
                same_day_early_surcharge: sameDayEarlySurcharge,
                confirm_late_check_in: confirmLateCheckIn,
                guests: guestsPayload
            });

            if (res && res.success) {
                onClose();
                if (typeof onSuccess === 'function') {
                    try {
                        onSuccess(res.data, res.room);
                    } catch (callbackErr) {
                        console.error('Lỗi trong onSuccess callback:', callbackErr);
                    }
                }
            } else {
                showCenterNotice({
                    title: 'Check-in Thất Bại',
                    message: res?.message || 'Check-in thất bại. Vui lòng kiểm tra lại.',
                    type: 'error'
                });
            }
        } catch (err) {
            console.error('Lỗi khi thực hiện Check-in:', err);
            showCenterNotice({
                title: 'Lỗi Kết Nối',
                message: err.response?.data?.message || err.message || 'Lỗi kết nối máy chủ khi Check-in.',
                type: 'error'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDirectCheckIn = () => {
        executeCheckIn();
    };

    const handleDebtAndCheckIn = () => {
        setShowDebtConfirmModal(true);
    };

    const handleConfirmPaymentAndCheckIn = async () => {
        if (effectiveRemainingBalance <= 0) {
            return executeCheckIn();
        }
        try {
            setIsProcessingPayment(true);

            await paymentService.confirmPayment({
                booking_id: booking.id,
                amount: effectiveRemainingBalance,
                payment_method: paymentMethod === 'transfer' ? 'TRANSFER' : 'CASH'
            });

            const methodLabel = paymentMethod === 'transfer' ? 'VietQR' : 'Tiền mặt';
            await executeCheckIn(`[Đã thu đủ ${formatCurrency(effectiveRemainingBalance)} qua ${methodLabel} lúc Check-in]`);
        } catch (err) {
            console.error('Lỗi khi ghi nhận thanh toán Check-in:', err);
            showCenterNotice({
                title: 'Thanh Toán Thất Bại',
                message: err.response?.data?.message || 'Ghi nhận thanh toán thất bại. Vui lòng thử lại.',
                type: 'error'
            });
        } finally {
            setIsProcessingPayment(false);
        }
    };

    const targetRoom = availableRooms.find((r) => String(r.id) === String(selectedRoomId));
    const targetRoomNumber = targetRoom?.room_number || booking?.room_number;

    if (!isOpen || !booking) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200/90 max-w-4xl w-full shadow-2xl text-left max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* ========================================================================= */}
                {/* 1. FIXED HEADER                                                           */}
                {/* ========================================================================= */}
                <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                            <KeyRound className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                    #{booking.booking_code}
                                </span>
                                <span className="text-xs text-slate-300">•</span>
                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200 uppercase">
                                    {booking.status_display || 'Chờ nhận phòng'}
                                </span>
                            </div>
                            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5 tracking-tight">
                                Thủ Tục Check-in & Khai Báo Lưu Trú
                            </h3>
                        </div>
                    </div>

                    <button
                        type="button"
                        disabled={isSubmitting || isProcessingPayment}
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                        title="Đóng modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ========================================================================= */}
                {/* 2. SCROLLABLE BODY CONTENT                                                */}
                {/* ========================================================================= */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 text-xs">
                    {/* TÓM TẮT TÀI CHÍNH (FOLIO BALANCE SUMMARY) */}
                    <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <CreditCard className="w-4 h-4 text-slate-500" />
                                <span>Tóm tắt tài chính trước nhận phòng (Folio Balance)</span>
                            </div>
                            <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                    isGroupRoom
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                        : isFullyPaid
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                            >
                                {isGroupRoom ? (
                                    <span className="flex items-center gap-1">
                                        <Building2 className="w-3 h-3" />
                                        <span>Gộp đoàn #{booking.group_booking_code || ''}</span>
                                    </span>
                                ) : isFullyPaid ? (
                                    <span className="flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>Đã thanh toán 100%</span>
                                    </span>
                                ) : (
                                    <span>Chưa thanh toán đủ</span>
                                )}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Tiền phòng / Tổng chi phí */}
                            <div className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
                                <span className="text-[10px] text-slate-400 block font-medium">
                                    {preOrderedServicesTotal > 0
                                        ? `Tổng chi phí (${booking.nights || 1} đêm):`
                                        : `Tiền phòng (${booking.nights || 1} đêm):`}
                                </span>
                                <strong className="text-sm font-bold text-slate-900 block mt-0.5 font-mono">
                                    {formatCurrency(totalExpectedCharges)}
                                </strong>
                                {preOrderedServicesTotal > 0 && (
                                    <span className="text-[10px] text-indigo-600 font-semibold block mt-0.5">
                                        (Gồm {formatCurrency(effectiveRoomCharge)} phòng + {formatCurrency(preOrderedServicesTotal)} DV)
                                    </span>
                                )}
                                {isEarlyCheckIn && applyEarlyCharge && (
                                    <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
                                        (Đã gồm +{formatCurrency(estimatedEarlyCharge)} ở sớm)
                                    </span>
                                )}
                                {sameDayEarlySurcharge > 0 && (
                                    <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                                        (Đã gồm +{formatCurrency(sameDayEarlySurcharge)} nhận sớm hôm nay)
                                    </span>
                                )}
                            </div>

                            {/* Đã thanh toán / Hình thức */}
                            {isGroupRoom ? (
                                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 shadow-2xs">
                                    <span className="text-[10px] text-indigo-600 block font-medium">Hình thức quyết toán:</span>
                                    <strong
                                        className="text-xs font-bold text-indigo-800 block mt-0.5 truncate flex items-center gap-1"
                                        title={`Hóa đơn đoàn #${booking.group_booking_code || ''}`}
                                    >
                                        <Building2 className="w-3.5 h-3.5" />
                                        <span>HĐ đoàn #{booking.group_booking_code || ''}</span>
                                    </strong>
                                    <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                                        {booking.group_deposit_status ||
                                            (booking.is_group_fully_paid ||
                                            (booking.is_group_deposit_paid &&
                                                Number(booking.group_deposit_amount || 0) >=
                                                    Number(booking.group_total_amount || 0))
                                                ? 'Đã thanh toán 100% đoàn'
                                                : booking.is_group_deposit_paid
                                                ? 'Đã cọc 50% đoàn'
                                                : 'Chờ cọc đoàn')}
                                    </span>
                                </div>
                            ) : (
                                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 shadow-2xs">
                                    <span className="text-[10px] text-emerald-600 block font-medium">Đã thanh toán trước:</span>
                                    <strong className="text-sm font-bold text-emerald-700 block mt-0.5 font-mono">
                                        {formatCurrency(paidAmount)}
                                    </strong>
                                    {paidAmount > totalExpectedCharges && (
                                        <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                                            (Đã thanh toán dư +{formatCurrency(paidAmount - totalExpectedCharges)})
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Còn thiếu / Remaining Balance */}
                            <div
                                className={`p-3 rounded-xl border shadow-2xs ${
                                    isGroupRoom
                                        ? 'bg-emerald-50/50 border-emerald-200'
                                        : isFullyPaid
                                        ? 'bg-slate-50 border-slate-200'
                                        : 'bg-rose-50 border-rose-200'
                                }`}
                            >
                                <span
                                    className={`text-[10px] block font-medium ${
                                        isGroupRoom
                                            ? 'text-emerald-700'
                                            : isFullyPaid
                                            ? 'text-slate-500'
                                            : 'text-rose-600'
                                    }`}
                                >
                                    {isGroupRoom ? 'Cần thu khách lẻ:' : 'Còn thiếu (Cần thu):'}
                                </span>
                                <strong
                                    className={`text-base font-black block mt-0.5 font-mono ${
                                        isGroupRoom
                                            ? 'text-emerald-700'
                                            : isFullyPaid
                                            ? 'text-emerald-700'
                                            : 'text-rose-600'
                                    }`}
                                >
                                    {isGroupRoom
                                        ? '0đ (HĐ Đoàn)'
                                        : isFullyPaid
                                        ? '0đ (Đã đủ)'
                                        : formatCurrency(effectiveRemainingBalance)}
                                </strong>
                            </div>
                        </div>

                        {/* Thông báo thông minh theo trường hợp */}
                        {isGroupRoom ? (
                            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-900 text-xs flex items-start gap-2">
                                <Building2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                                <div className="leading-relaxed">
                                    <strong>Chính sách Master-Billing (Đoàn {booking.group_booking_name ? `"${booking.group_booking_name}"` : 'Doanh nghiệp'}):</strong> Chi phí tiền phòng được quyết toán trên Hóa đơn tổng của Doanh nghiệp. Lễ tân gán phòng, tiếp nhận CCCD khách lưu trú và bàn giao chìa khóa mà <strong>không thu tiền phòng của khách</strong>.
                                </div>
                            </div>
                        ) : isFullyPaid ? (
                            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <div className="leading-relaxed">
                                    <strong>Trường hợp Pre-paid:</strong> Khách đã thanh toán 100% online trước đó. Lễ tân chỉ cần gán phòng và bàn giao thẻ từ cho khách.
                                </div>
                            </div>
                        ) : (
                            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2">
                                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div className="leading-relaxed">
                                    <strong>Trường hợp Post-paid:</strong> Khách còn nợ <strong>{formatCurrency(effectiveRemainingBalance)}</strong>. Bạn có thể thu ngay qua Tiền mặt/VietQR hoặc chọn <em>"Cho nợ & Check-in"</em> để thu khi Check-out.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* CẢNH BÁO QUÁ HẠN LƯU TRÚ / NHẬN PHÒNG SỚM / NHẬN PHÒNG TRỄ */}
                    {isExpiredCheckIn && (
                        <div className="p-3.5 rounded-xl border-2 border-rose-300 bg-rose-50/50 text-rose-800 space-y-1.5 animate-in fade-in">
                            <div className="flex items-center gap-2 font-bold text-xs text-rose-900">
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>Đơn đặt phòng đã quá hạn lưu trú (Ngày trả phòng dự kiến: {formatDateDisplay(booking.check_out_date)})</span>
                            </div>
                            <p className="text-[11px] text-rose-700 leading-relaxed">
                                Không thể thực hiện Check-in cho đơn này. Lễ tân vui lòng đánh dấu đơn sang <strong>Khách không đến (No-show)</strong> hoặc tạo đơn mới.
                            </p>
                        </div>
                    )}

                    {isEarlyCheckIn && (
                        <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/40 space-y-2.5 animate-in fade-in">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-emerald-950 text-xs uppercase flex items-center gap-1.5">
                                    <Zap className="w-4 h-4 text-emerald-600" />
                                    <span>Khách đến sớm hơn dự kiến: {earlyDaysCount} ngày</span>
                                </h4>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                                    Lịch cũ: {formatDateDisplay(booking.check_in_date)}
                                </span>
                            </div>

                            <p className="text-[11px] text-slate-600 leading-relaxed">
                                Khách đến nhận phòng hôm nay (<strong>{formatDateDisplay(todayDateStr)}</strong>). Hệ thống sẽ cập nhật ngày nhận phòng thực tế bắt đầu từ hôm nay.
                            </p>

                            <div className="pt-2 border-t border-emerald-200/60 space-y-2 text-xs">
                                <label className="flex items-center gap-2 cursor-pointer font-medium select-none p-1.5 rounded-lg hover:bg-white/70 transition text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={applyEarlyCharge}
                                        onChange={(e) => setApplyEarlyCharge(e.target.checked)}
                                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span className="text-[11px]">
                                        Tự động tính thêm tiền phòng cho {earlyDaysCount} đêm ở sớm (
                                        <strong className="text-emerald-700 font-mono">+{formatCurrency(estimatedEarlyCharge)}</strong>)
                                    </span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer select-none p-2 rounded-xl bg-white border border-emerald-300 shadow-2xs transition">
                                    <input
                                        type="checkbox"
                                        checked={confirmEarlyCheckIn}
                                        onChange={(e) => setConfirmEarlyCheckIn(e.target.checked)}
                                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-900">
                                        Tôi xác nhận đồng ý cho khách nhận phòng sớm từ hôm nay <span className="text-rose-600">*</span>
                                    </span>
                                </label>
                            </div>
                        </div>
                    )}

                    {sameDayEarlyCheckInInfo && (
                        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                                        <Clock className="w-4 h-4 text-amber-600" />
                                        <span>Nhận phòng sớm trong ngày (Early Check-in) lúc {sameDayEarlyCheckInInfo.currentTime}</span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                            {sameDayEarlyCheckInInfo.rule}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 leading-relaxed">
                                        Giờ nhận phòng chuẩn: <strong>{hotelSettings.check_in_time || '14:00'}</strong>. Phụ thu <strong>+{sameDayEarlyCheckInInfo.percent}%</strong> tiền phòng (~<strong className="text-slate-900 font-mono">{formatCurrency(sameDayEarlyCheckInInfo.amount)}</strong>).
                                    </p>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto shrink-0 transition">
                                    <input
                                        type="checkbox"
                                        checked={applySameDayEarlyCharge}
                                        onChange={(e) => setApplySameDayEarlyCharge(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-800">
                                        {applySameDayEarlyCharge ? 'Áp dụng phụ thu' : 'Miễn phụ thu (Waive)'}
                                    </span>
                                </label>
                            </div>
                        </div>
                    )}

                    {isLateCheckIn && (
                        <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/40 space-y-2.5 animate-in fade-in">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-amber-950 text-xs uppercase flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-amber-600" />
                                    <span>Khách đến trễ: {lateDaysCount} ngày</span>
                                </h4>
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-300">
                                    Lịch cũ: {formatDateDisplay(booking.check_in_date)}
                                </span>
                            </div>

                            <p className="text-[11px] text-slate-600 leading-relaxed">
                                Khách đến nhận phòng trễ {lateDaysCount} ngày so với ban đầu. Khách sẽ ở <strong>{remainingNightsCount} đêm còn lại</strong> đến ngày {formatDateDisplay(booking.check_out_date)}.
                            </p>

                            <div className="pt-2 border-t border-amber-200/60 text-xs">
                                <label className="flex items-center gap-2 cursor-pointer select-none p-2 rounded-xl bg-white border border-amber-300 shadow-2xs transition">
                                    <input
                                        type="checkbox"
                                        checked={confirmLateCheckIn}
                                        onChange={(e) => setConfirmLateCheckIn(e.target.checked)}
                                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-900">
                                        Tôi xác nhận cho khách nhận phòng ở {remainingNightsCount} đêm còn lại <span className="text-rose-600">*</span>
                                    </span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* TÓM TẮT THÔNG TIN PHÒNG & GÁN PHÒNG THỰC TẾ */}
                    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-2xs">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                            <div>
                                <span className="text-slate-400 block text-[11px]">Người đặt phòng:</span>
                                <strong className="text-slate-900 text-xs block truncate mt-0.5 flex items-center gap-1">
                                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>{booking.guest_name}</span>
                                </strong>
                                <span className="text-[10px] text-slate-500 block mt-0.5 flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>{booking.guest_phone || 'Chưa có SĐT'}</span>
                                </span>
                            </div>

                            <div>
                                <span className="text-slate-400 block text-[11px]">Hạng phòng & Tiêu chuẩn:</span>
                                <strong className="text-emerald-800 text-xs block font-bold mt-0.5 flex items-center gap-1">
                                    <BedDouble className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>{booking.room_name}</span>
                                </strong>
                                <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5 flex items-center gap-1">
                                    <Users className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>Tiêu chuẩn: {roomCapacity} người lớn</span>
                                </span>
                            </div>

                            <div>
                                <span className="text-slate-400 block text-[11px]">Lịch trình lưu trú:</span>
                                <strong className="text-slate-900 text-xs block mt-0.5 flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>
                                        {formatDateDisplay(booking.check_in_date)} → {formatDateDisplay(booking.check_out_date)}
                                    </span>
                                </strong>
                                <span className="text-[10px] text-slate-500 block mt-0.5 flex items-center gap-1">
                                    <Moon className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>Thời gian: {booking.nights || 1} đêm</span>
                                </span>
                            </div>
                        </div>

                        {/* GÁN PHÒNG THỰC TẾ */}
                        <div className="pt-2 border-t border-slate-100">
                            <label className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between mb-1.5">
                                <span className="flex items-center gap-1.5">
                                    <BedDouble className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Gán phòng thực tế đón khách</span>
                                    <span className="text-rose-500">*</span>
                                </span>
                                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    {availableRooms.length} phòng khả dụng
                                </span>
                            </label>

                            {isLoadingRooms ? (
                                <div className="p-3 text-center bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-1"></div>
                                    <span className="text-slate-500 text-[10px]">Đang tìm phòng trống...</span>
                                </div>
                            ) : availableRooms.length === 0 ? (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px]">
                                    Không có phòng trống thuộc hạng <strong>{booking.room_name}</strong> sẵn sàng đón khách.
                                </div>
                            ) : (
                                <div className="relative">
                                    <select
                                        value={selectedRoomId}
                                        onChange={(e) => setSelectedRoomId(e.target.value)}
                                        disabled={isSubmitting || isProcessingPayment}
                                        className="w-full pl-3 pr-8 py-2 bg-emerald-50/30 border-2 border-emerald-400 focus:border-emerald-600 rounded-xl text-xs font-bold text-slate-900 shadow-xs focus:outline-none transition cursor-pointer appearance-none"
                                    >
                                        {availableRooms.map((room) => (
                                            <option key={room.id} value={room.id}>
                                                Phòng {room.room_number} — Tầng {room.floor} ({room.category_name || booking.room_name})
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-emerald-700 pointer-events-none absolute right-3 top-3" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* DỊCH VỤ TIỆN ÍCH ĐÃ ĐẶT TRƯỚC (ADD-ON SERVICES) */}
                    {servicesList && servicesList.length > 0 && (
                        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
                            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                                        <Bell className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                                            <span>Dịch vụ khách đã đặt kèm trước</span>
                                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black">
                                                {servicesList.length} dịch vụ
                                            </span>
                                        </h4>
                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                            Xác nhận thời gian phục vụ với khách và thông báo cho bộ phận liên quan chuẩn bị.
                                        </p>
                                    </div>
                                </div>
                                {areServicesPaid ? (
                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 flex items-center gap-1 shadow-2xs">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>Đã thanh toán trước</span>
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-200 flex items-center gap-1 shadow-2xs">
                                        <Clock className="w-3 h-3 text-amber-600" />
                                        <span>Thu khi nhận phòng</span>
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {servicesList.map((svc, idx) => {
                                    const total = Number(
                                        svc.total_price ||
                                            (svc.unit_price || svc.service_price || svc.price || 0) * (svc.quantity || 1)
                                    );
                                    const isUpdatingThis = isUpdatingServiceId === svc.id;
                                    const isCompleted = svc.status === 'completed';
                                    const isInProgress = svc.status === 'in_progress' || svc.status === 'delivering';
                                    const deptMeta = getServiceDeptMeta(svc.service_name, svc.category_name);
                                    const DeptIcon = deptMeta.icon || Bed;
                                    const isSvcPaid = Boolean(svc.is_paid) || areServicesPaid;

                                    return (
                                        <div
                                            key={svc.id || idx}
                                            className="p-3 bg-slate-50/70 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition"
                                        >
                                            <div>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        {svc.image ? (
                                                            <img
                                                                src={svc.image}
                                                                alt={svc.service_name}
                                                                className="w-10 h-10 rounded-lg object-cover border border-slate-100 shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
                                                                <DeptIcon className="w-5 h-5 text-slate-600" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <strong className="text-xs font-bold text-slate-900 block leading-tight">
                                                                {svc.service_name}
                                                            </strong>
                                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                                <span className="text-[10px] text-slate-500">
                                                                    Số lượng: <strong className="text-slate-800">x{svc.quantity || 1}</strong> • {formatCurrency(total)}
                                                                </span>
                                                                {isSvcPaid ? (
                                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold">
                                                                        Đã thanh toán
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-bold">
                                                                        Thu khi Check-in
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <span
                                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 border ${
                                                            isCompleted
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                : isInProgress
                                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                : notifiedServiceIds.has(svc.id)
                                                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                                        }`}
                                                    >
                                                        {isCompleted
                                                            ? 'Đã phục vụ'
                                                            : isInProgress
                                                            ? 'Đang thực hiện'
                                                            : notifiedServiceIds.has(svc.id)
                                                            ? 'Đã báo (Chờ làm)'
                                                            : 'Chờ xử lý'}
                                                    </span>
                                                </div>

                                                {(svc.note || (svc.is_scheduled && svc.request_time)) && (
                                                    <div className="mt-2 p-1.5 rounded-lg bg-white border border-slate-200 text-[10px] text-slate-600 space-y-0.5">
                                                        {svc.is_scheduled && svc.request_time && (
                                                            <div className="font-semibold text-slate-700 flex items-center gap-1">
                                                                <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                                                                <span>Giờ hẹn:</span>
                                                                <span className="text-blue-800 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                                                    {formatDateTimeDisplay(svc.request_time)}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {svc.note && (
                                                            <div className="italic text-slate-600 truncate flex items-center gap-1" title={svc.note}>
                                                                <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                                                                <span>Ghi chú: "{svc.note}"</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* THANH CHỌN NHANH THỜI GIAN PHỤC VỤ */}
                                                {!isCompleted && !isInProgress && (
                                                    <div className="mt-2 pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-1.5">
                                                        <span className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                                                            <Clock className="w-3 h-3 text-slate-500" />
                                                            <span>{deptMeta.timePrompt || 'Hẹn giờ phục vụ:'}</span>
                                                        </span>
                                                        <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                                                            {[
                                                                { id: 'now', label: 'Phục vụ ngay' },
                                                                { id: '30m', label: '+30p' },
                                                                { id: '1h', label: '+1h' },
                                                                { id: '2h', label: '+2h' }
                                                            ].map((opt) => {
                                                                const isSelected = (serviceScheduleTimes[svc.id] || 'now') === opt.id;
                                                                return (
                                                                    <button
                                                                        key={opt.id}
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setServiceScheduleTimes((prev) => ({ ...prev, [svc.id]: opt.id }))
                                                                        }
                                                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                                                            isSelected
                                                                                ? 'bg-blue-600 text-white shadow-2xs'
                                                                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                                                        }`}
                                                                    >
                                                                        {opt.label}
                                                                    </button>
                                                                );
                                                            })}

                                                            {/* Ô nhập giờ tùy chọn */}
                                                            <div
                                                                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition ${
                                                                    serviceScheduleTimes[svc.id] === 'custom'
                                                                        ? 'bg-blue-50 border-blue-500 shadow-2xs text-blue-950 ring-1 ring-blue-400'
                                                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                                }`}
                                                            >
                                                                <span className="text-[10px] font-bold">Đặt giờ:</span>
                                                                <input
                                                                    type="time"
                                                                    value={serviceCustomTimes[svc.id] || '20:00'}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setServiceCustomTimes((prev) => ({ ...prev, [svc.id]: val }));
                                                                        setServiceScheduleTimes((prev) => ({ ...prev, [svc.id]: 'custom' }));
                                                                    }}
                                                                    onClick={() =>
                                                                        setServiceScheduleTimes((prev) => ({ ...prev, [svc.id]: 'custom' }))
                                                                    }
                                                                    className="bg-transparent text-[11px] font-black text-slate-800 outline-none cursor-pointer w-[58px]"
                                                                    title="Chọn giờ cụ thể muốn giao"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    #{svc.id}
                                                </span>
                                                {isCompleted ? (
                                                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        <span>Đã hoàn tất</span>
                                                    </span>
                                                ) : isInProgress ? (
                                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 flex items-center gap-1">
                                                        <DeptIcon className="w-3 h-3" />
                                                        <span>{deptMeta.inProgressLabel}</span>
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={isUpdatingThis}
                                                        onClick={() => handleNotifyService(svc.id)}
                                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                                                            notifiedServiceIds.has(svc.id)
                                                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                                                        }`}
                                                        title={
                                                            notifiedServiceIds.has(svc.id)
                                                                ? 'Đã gửi chuông báo. Nhấn để gửi nhắc lại.'
                                                                : `Bắn tín hiệu chuông báo bộ phận ${deptMeta.dept} chuẩn bị`
                                                        }
                                                    >
                                                        {isUpdatingThis ? (
                                                            <span>Đang gửi...</span>
                                                        ) : notifiedServiceIds.has(svc.id) ? (
                                                            <>
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                <span>Đã báo {deptMeta.dept} (Bấm để nhắc lại)</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Bell className="w-3 h-3" />
                                                                <span>Báo {deptMeta.dept} chuẩn bị</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* KHAI BÁO THÔNG TIN KHÁCH LƯU TRÚ (DYNAMIC FORM) */}
                    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-slate-700 shrink-0" />
                                <div>
                                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                                        Danh sách khách lưu trú ({guests.length} người)
                                    </h4>
                                    <p className="text-[10px] text-slate-500">
                                        Khai báo CCCD/Hộ chiếu phục vụ thủ tục đăng ký tạm trú
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowFastPasteModal(true)}
                                    disabled={isSubmitting || isProcessingPayment}
                                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs"
                                    title="Dán nhanh danh sách đoàn từ Excel hoặc văn bản"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                    <span>Dán nhanh từ Excel</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddGuest}
                                    disabled={isSubmitting || isProcessingPayment}
                                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Thêm người</span>
                                </button>
                            </div>
                        </div>

                        {/* CẢNH BÁO KHI VƯỢT QUÁ TIÊU CHUẨN SỨC CHỨA */}
                        {isOverCapacity && (
                            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-center gap-2.5 animate-in fade-in">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                <div className="leading-tight">
                                    <strong className="font-bold text-amber-950">Số lượng khách vượt quá tiêu chuẩn phòng!</strong>
                                    <div className="text-[11px] text-amber-800 mt-0.5">
                                        Phòng có tiêu chuẩn <strong>{roomCapacity} người lớn</strong> nhưng danh sách đang có <strong>{guests.length} khách</strong>. Lưu ý kiểm tra phụ thu thêm người!
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* DANH SÁCH FORM KHÁCH HÀNG */}
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                            {guests.map((guest, idx) => (
                                <div
                                    key={guest.id || idx}
                                    className={`p-3 rounded-xl border transition ${
                                        guest.is_primary
                                            ? 'bg-blue-50/40 border-blue-200 ring-1 ring-blue-300/40'
                                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-xs text-slate-800">
                                                {idx + 1}. {guest.is_primary ? 'Người đại diện đặt phòng' : `Khách đi cùng #${idx}`}
                                            </span>
                                            {guest.is_primary ? (
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded-md border border-blue-200 flex items-center gap-1">
                                                    <Sparkles className="w-3 h-3 text-blue-600" />
                                                    <span>Đại diện chính</span>
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-medium rounded-md">
                                                    Đi cùng
                                                </span>
                                            )}
                                        </div>

                                        {!guest.is_primary && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveGuest(idx)}
                                                disabled={isSubmitting || isProcessingPayment}
                                                className="text-rose-600 hover:text-rose-800 text-xs font-bold flex items-center gap-1 cursor-pointer transition p-1 hover:bg-rose-50 rounded-lg active:scale-95"
                                                title="Xóa người này"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                <span className="text-[11px]">Xóa</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 text-[11px]">
                                        {/* Họ và tên */}
                                        <div className="sm:col-span-2 space-y-0.5">
                                            <label className="text-[10px] font-semibold text-slate-600">
                                                Họ và tên <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Nguyễn Văn A"
                                                value={guest.full_name}
                                                onChange={(e) => handleGuestChange(idx, 'full_name', e.target.value)}
                                                disabled={isSubmitting || isProcessingPayment}
                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                            />
                                        </div>

                                        {/* Loại giấy tờ */}
                                        <div className="space-y-0.5">
                                            <label className="text-[10px] font-semibold text-slate-600">
                                                Loại giấy tờ
                                            </label>
                                            <select
                                                value={guest.id_type}
                                                onChange={(e) => handleGuestChange(idx, 'id_type', e.target.value)}
                                                disabled={isSubmitting || isProcessingPayment}
                                                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                            >
                                                <option value="CCCD">CCCD / CMND</option>
                                                <option value="PASSPORT">Hộ chiếu</option>
                                                <option value="OTHER">Trẻ em / Khác</option>
                                            </select>
                                        </div>

                                        {/* Số giấy tờ */}
                                        <div className="sm:col-span-2 space-y-0.5">
                                            <label className="text-[10px] font-semibold text-slate-600">
                                                Số CCCD / Hộ chiếu {guest.id_type !== 'OTHER' && <span className="text-rose-500">*</span>}
                                            </label>
                                            <input
                                                type="text"
                                                placeholder={guest.id_type === 'OTHER' ? 'Không bắt buộc' : 'Số định danh...'}
                                                value={guest.id_number}
                                                onChange={(e) => handleGuestChange(idx, 'id_number', e.target.value)}
                                                disabled={isSubmitting || isProcessingPayment}
                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                                            />
                                        </div>

                                        {/* Giới tính */}
                                        <div className="space-y-0.5">
                                            <label className="text-[10px] font-semibold text-slate-600">
                                                Giới tính
                                            </label>
                                            <select
                                                value={guest.gender || 'Nam'}
                                                onChange={(e) => handleGuestChange(idx, 'gender', e.target.value)}
                                                disabled={isSubmitting || isProcessingPayment}
                                                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                            >
                                                <option value="Nam">Nam</option>
                                                <option value="Nữ">Nữ</option>
                                                <option value="Khác">Khác</option>
                                            </select>
                                        </div>

                                        {/* Ngày sinh */}
                                        <div className="sm:col-span-2 space-y-0.5">
                                            <label className="text-[10px] font-semibold text-slate-600">
                                                Ngày sinh
                                            </label>
                                            <input
                                                type="date"
                                                value={guest.date_of_birth || ''}
                                                onChange={(e) => handleGuestChange(idx, 'date_of_birth', e.target.value)}
                                                disabled={isSubmitting || isProcessingPayment}
                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                            />
                                        </div>

                                        {/* Quốc tịch */}
                                        <div className="sm:col-span-2 space-y-0.5">
                                            <label className="text-[10px] font-semibold text-slate-600">
                                                Quốc tịch
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Việt Nam"
                                                value={guest.nationality || 'Việt Nam'}
                                                onChange={(e) => handleGuestChange(idx, 'nationality', e.target.value)}
                                                disabled={isSubmitting || isProcessingPayment}
                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* FORM THU TIỀN NHANH */}
                    {showPaymentForm && !isFullyPaid && (
                        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/40 space-y-3.5 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5">
                                    <Banknote className="w-4 h-4 text-amber-600" />
                                    <span>Thu nốt phần tiền phòng còn thiếu:</span>
                                    <span className="text-rose-600 text-sm font-extrabold font-mono">
                                        {formatCurrency(effectiveRemainingBalance)}
                                    </span>
                                </h4>
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentForm(false)}
                                    className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold underline cursor-pointer"
                                >
                                    Đóng form thu tiền
                                </button>
                            </div>

                            {/* CHỌN HÌNH THỨC THU TIỀN */}
                            <div className="grid grid-cols-2 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('cash')}
                                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                                        paymentMethod === 'cash'
                                            ? 'bg-amber-100/70 border-amber-500 ring-2 ring-amber-500/20 text-slate-900 shadow-2xs'
                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                                        <Banknote className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-xs">Tiền mặt tại quầy</div>
                                        <div className="text-[10px] text-slate-500">Lễ tân thu trực tiếp</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('transfer')}
                                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center gap-2.5 ${
                                        paymentMethod === 'transfer'
                                            ? 'bg-blue-100/70 border-blue-500 ring-2 ring-blue-500/20 text-slate-900 shadow-2xs'
                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200">
                                        <QrCode className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-xs">Chuyển khoản VietQR</div>
                                        <div className="text-[10px] text-slate-500">Quét mã chuyển nhanh</div>
                                    </div>
                                </button>
                            </div>

                            {/* KHU VỰC HIỂN THỊ VIETQR */}
                            {paymentMethod === 'transfer' && (
                                <div className="p-3 bg-white rounded-xl border border-blue-200 flex flex-col sm:flex-row items-center gap-4">
                                    <div className="w-32 h-32 p-1.5 bg-white border-2 border-dashed border-blue-400 rounded-xl shrink-0 aspect-square flex items-center justify-center">
                                        {qrUrl ? (
                                            <img
                                                src={qrUrl}
                                                alt="Mã VietQR thu tiền Check-in"
                                                className="w-full h-full object-contain"
                                            />
                                        ) : (
                                            <span className="text-[10px] text-slate-400">Đang tạo mã QR...</span>
                                        )}
                                    </div>

                                    <div className="space-y-1 text-[11px] text-slate-700 flex-1">
                                        <div>Ngân hàng: <strong>{bankConfig.bank_bin}</strong></div>
                                        <div>Số tài khoản: <strong className="font-mono text-xs">{bankConfig.account_no}</strong></div>
                                        <div>Chủ tài khoản: <strong>{bankConfig.account_name}</strong></div>
                                        <div>
                                            Số tiền cần quét:{' '}
                                            <strong className="text-rose-600 font-bold text-sm font-mono">
                                                {formatCurrency(effectiveRemainingBalance)}
                                            </strong>
                                        </div>
                                        <div className="text-[10px] text-blue-700 bg-blue-50 p-1.5 rounded-lg border border-blue-200 font-mono">
                                            Nội dung: <strong>Thanh toan checkin {booking.booking_code}</strong>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <p className="text-[10px] text-slate-500 italic">
                                * Lễ tân vui lòng nhận tiền mặt hoặc đợi khách quét mã VietQR thành công, sau đó bấm nút <strong>"Xác nhận Đã thu & Check-in"</strong> để hoàn tất.
                            </p>
                        </div>
                    )}

                    {/* GHI CHÚ BÀN GIAO CHECK-IN */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-slate-500" />
                            <span>Ghi chú nhận phòng (Lễ tân):</span>
                        </label>
                        <input
                            type="text"
                            placeholder="VD: Đã giao 2 chìa khóa thẻ từ, cọc 500k, khách đi kèm 1 trẻ em..."
                            value={checkInNote}
                            onChange={(e) => setCheckInNote(e.target.value)}
                            disabled={isSubmitting || isProcessingPayment}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                        />
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* 3. FIXED FOOTER ACTION BAR                                                */}
                {/* ========================================================================= */}
                <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200/80 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                    {/* Live Balance / Cần thu */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Cần thu tại quầy:</span>
                        <span
                            className={`font-mono font-black text-base sm:text-lg ${
                                isGroupRoom || isFullyPaid ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                        >
                            {isGroupRoom ? '0đ (HĐ Đoàn)' : isFullyPaid ? '0đ (Đã đủ)' : formatCurrency(effectiveRemainingBalance)}
                        </span>
                    </div>

                    <div className="flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            disabled={isSubmitting || isProcessingPayment}
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 disabled:opacity-50 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer text-center"
                        >
                            Hủy bỏ
                        </button>

                        {isGroupRoom ? (
                            <button
                                type="button"
                                disabled={
                                    isSubmitting ||
                                    availableRooms.length === 0 ||
                                    !selectedRoomId ||
                                    isExpiredCheckIn ||
                                    (isEarlyCheckIn && !confirmEarlyCheckIn) ||
                                    (isLateCheckIn && !confirmLateCheckIn)
                                }
                                onClick={handleDirectCheckIn}
                                className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang Check-in...</span>
                                    </>
                                ) : (
                                    <>
                                        <Building2 className="w-4 h-4" />
                                        <span>Xác nhận Check-in Phòng Đoàn #{booking.group_booking_code || ''}</span>
                                    </>
                                )}
                            </button>
                        ) : isFullyPaid ? (
                            <button
                                type="button"
                                disabled={
                                    isSubmitting ||
                                    availableRooms.length === 0 ||
                                    !selectedRoomId ||
                                    isExpiredCheckIn ||
                                    (isEarlyCheckIn && !confirmEarlyCheckIn) ||
                                    (isLateCheckIn && !confirmLateCheckIn)
                                }
                                onClick={handleDirectCheckIn}
                                className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang Check-in...</span>
                                    </>
                                ) : (
                                    <>
                                        <KeyRound className="w-4 h-4" />
                                        <span>Hoàn tất Check-in & Bàn giao phòng</span>
                                    </>
                                )}
                            </button>
                        ) : showPaymentForm ? (
                            <>
                                <button
                                    type="button"
                                    disabled={
                                        isSubmitting ||
                                        isProcessingPayment ||
                                        availableRooms.length === 0 ||
                                        !selectedRoomId ||
                                        isExpiredCheckIn ||
                                        (isEarlyCheckIn && !confirmEarlyCheckIn) ||
                                        (isLateCheckIn && !confirmLateCheckIn)
                                    }
                                    onClick={handleDebtAndCheckIn}
                                    className="w-full sm:w-auto px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                    title="Cho khách nhận phòng trước, ghi nhận nợ tiền phòng vào Folio và thu khi check-out"
                                >
                                    <CreditCard className="w-3.5 h-3.5" />
                                    <span>Cho nợ & Check-in</span>
                                </button>

                                <button
                                    type="button"
                                    disabled={
                                        isSubmitting ||
                                        isProcessingPayment ||
                                        availableRooms.length === 0 ||
                                        !selectedRoomId ||
                                        isExpiredCheckIn ||
                                        (isEarlyCheckIn && !confirmEarlyCheckIn) ||
                                        (isLateCheckIn && !confirmLateCheckIn)
                                    }
                                    onClick={handleConfirmPaymentAndCheckIn}
                                    className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                                >
                                    {isProcessingPayment ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Đang xử lý thanh toán & Check-in...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Banknote className="w-4 h-4" />
                                            <span>Xác nhận Đã thu {formatCurrency(effectiveRemainingBalance)} & Check-in</span>
                                        </>
                                    )}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    disabled={
                                        isSubmitting ||
                                        isProcessingPayment ||
                                        availableRooms.length === 0 ||
                                        !selectedRoomId ||
                                        isExpiredCheckIn ||
                                        (isEarlyCheckIn && !confirmEarlyCheckIn) ||
                                        (isLateCheckIn && !confirmLateCheckIn)
                                    }
                                    onClick={handleDebtAndCheckIn}
                                    className="w-full sm:w-auto px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                    title="Cho khách nhận phòng trước, ghi nhận nợ tiền phòng vào Folio và thu khi check-out"
                                >
                                    <CreditCard className="w-3.5 h-3.5" />
                                    <span>Cho nợ & Check-in</span>
                                </button>

                                <button
                                    type="button"
                                    disabled={
                                        isSubmitting ||
                                        isProcessingPayment ||
                                        availableRooms.length === 0 ||
                                        !selectedRoomId ||
                                        isExpiredCheckIn ||
                                        (isEarlyCheckIn && !confirmEarlyCheckIn) ||
                                        (isLateCheckIn && !confirmLateCheckIn)
                                    }
                                    onClick={() => setShowPaymentForm(true)}
                                    className="w-full sm:w-auto px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-600/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                                >
                                    <Banknote className="w-4 h-4" />
                                    <span>Thu tiền & Check-in ({formatCurrency(effectiveRemainingBalance)})</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* MODAL THÔNG BÁO Ở GIỮA MÀN HÌNH */}
            {centerModalNotice && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-2xl max-w-sm w-full border border-slate-100 flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-200 relative">
                        <button
                            type="button"
                            onClick={() => setCenterModalNotice(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                                centerModalNotice.type === 'error'
                                    ? 'bg-rose-50 border-2 border-rose-200/80 text-rose-600'
                                    : centerModalNotice.type === 'warning'
                                    ? 'bg-amber-50 border-2 border-amber-200/80 text-amber-600'
                                    : centerModalNotice.icon === 'bell'
                                    ? 'bg-amber-50 border-2 border-amber-200/80 text-amber-600'
                                    : 'bg-emerald-50 border-2 border-emerald-200/80 text-emerald-600'
                            }`}
                        >
                            {centerModalNotice.type === 'error' ? (
                                <XCircle className="w-7 h-7" />
                            ) : centerModalNotice.type === 'warning' ? (
                                <AlertTriangle className="w-7 h-7" />
                            ) : centerModalNotice.icon === 'bell' ? (
                                <Bell className="w-7 h-7 animate-bounce" />
                            ) : (
                                <CheckCircle2 className="w-7 h-7" />
                            )}
                        </div>

                        <div className="space-y-1">
                            <h3 className="text-base font-bold text-slate-900 tracking-tight">
                                {centerModalNotice.title || 'Thông Báo'}
                            </h3>
                            <p className="text-xs font-medium text-slate-600 leading-relaxed px-1">
                                {centerModalNotice.message}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setCenterModalNotice(null)}
                            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
                        >
                            Đã hiểu
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL XÁC NHẬN CHO NỢ & CHECK-IN */}
            {showDebtConfirmModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-2xl max-w-md w-full border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                                <CreditCard className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                                    Xác Nhận Cho Nợ Tiền Phòng
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Ghi nhận số nợ vào Folio để thu khi Check-out
                                </p>
                            </div>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
                            <div className="flex justify-between items-center text-slate-600">
                                <span className="font-medium">Khách hàng:</span>
                                <span className="font-bold text-slate-800">{booking?.guest_name}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-600">
                                <span className="font-medium">Mã đặt phòng:</span>
                                <span className="font-mono font-bold text-slate-800">#{booking?.booking_code}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-600">
                                <span className="font-medium">Phòng nhận:</span>
                                <span className="font-bold text-indigo-600">P.{targetRoomNumber || 'Chưa gán'}</span>
                            </div>
                            <div className="flex justify-between items-center text-amber-800 bg-amber-50/80 p-2.5 rounded-lg border border-amber-200">
                                <span className="font-medium">Số tiền còn thiếu:</span>
                                <span className="font-black text-sm text-rose-600 font-mono">
                                    {formatCurrency(effectiveRemainingBalance)}
                                </span>
                            </div>
                        </div>

                        <div className="text-[11px] text-slate-600 leading-relaxed bg-amber-50/50 p-3 rounded-xl border border-amber-100 flex items-start gap-2">
                            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span>
                                Khách chưa thanh toán đủ tiền phòng nhưng được phép lên phòng trước. Toàn bộ số nợ{' '}
                                <strong className="font-mono">{formatCurrency(effectiveRemainingBalance)}</strong> sẽ tự động được dồn vào <strong>Folio</strong> để thu khi khách làm thủ tục Check-out.
                            </span>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => setShowDebtConfirmModal(false)}
                                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                            >
                                Hủy Bỏ
                            </button>
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => {
                                    setShowDebtConfirmModal(false);
                                    executeCheckIn(
                                        `[Lễ tân cho nợ tiền phòng]: Còn thiếu ${formatCurrency(
                                            effectiveRemainingBalance
                                        )} khi Check-in, sẽ thu khi Check-out`
                                    );
                                }}
                                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang xử lý...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>Cho Nợ & Hoàn Tất Check-in</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL POPUP: [DÁN NHANH DANH SÁCH ĐOÀN] TỪ EXCEL */}
            {showFastPasteModal && (
                <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-2xl max-w-xl w-full border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150 relative">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0">
                                    <FileSpreadsheet className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                                        Dán nhanh danh sách khách đoàn từ Excel
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Sao chép từ file bảng tính Excel hoặc Zalo và dán vào khung bên dưới
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowFastPasteModal(false);
                                    setFastPasteError('');
                                }}
                                className="text-slate-400 hover:text-slate-600 transition p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 text-indigo-900 text-xs space-y-1">
                            <div className="font-bold flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Định dạng hỗ trợ mỗi dòng:</span>
                            </div>
                            <code className="block bg-white p-2 rounded-lg font-mono text-[11px] text-indigo-950 border border-indigo-200/80">
                                Họ và tên [Tab hoặc Phẩy] Số CCCD [Tab hoặc Phẩy] Giới tính [Tab hoặc Phẩy] Ngày sinh
                            </code>
                            <p className="text-[10px] text-indigo-700 italic">
                                Ví dụ: "Nguyễn Văn Nam &nbsp;&nbsp;&nbsp; 048099001234 &nbsp;&nbsp;&nbsp; Nam &nbsp;&nbsp;&nbsp; 1990-05-15"
                            </p>
                        </div>

                        <div>
                            <textarea
                                rows={7}
                                value={fastPasteText}
                                onChange={(e) => {
                                    setFastPasteText(e.target.value);
                                    if (fastPasteError) setFastPasteError('');
                                }}
                                placeholder="Dán nội dung từ Excel vào đây...&#10;Trần Thị Lan	048198005678	Nữ	1995-10-20&#10;Lê Văn Hoàng	048092003456	Nam	1988-02-12"
                                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                            />
                            {fastPasteError && (
                                <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>{fastPasteError}</span>
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowFastPasteModal(false);
                                    setFastPasteError('');
                                }}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                onClick={handleApplyFastPaste}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer active:scale-95 flex items-center gap-1.5"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Phân tích & Nạp danh sách</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
