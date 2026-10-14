import React, { useState, useEffect, useMemo } from 'react';
import { Bell, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';
import { bookingService } from '../../../services/bookingService';
import { paymentService } from '../../../services/paymentService';
import api from '../../../services/api';

// Helper format tiền tệ VNĐ
const formatCurrency = (amount) => {
    const num = Number(amount) || 0;
    return `${num.toLocaleString('vi-VN')}đ`;
};

// Helper format ngày hiển thị
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

// Helper format ngày giờ hiển thị chi tiết (VD: 16:30 14/10/2026)
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

export default function CheckInModal({ booking, isOpen = true, onClose, onSuccess }) {
    // 1. STATE DỮ LIỆU PHÒNG & THỦ TỤC
    const [availableRooms, setAvailableRooms] = useState([]);
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [checkInNote, setCheckInNote] = useState('');
    const [isLoadingRooms, setIsLoadingRooms] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Danh sách dịch vụ đặt kèm trước (Add-on Services)
    const [servicesList, setServicesList] = useState(() => {
        if (booking?.selected_services && Array.isArray(booking.selected_services) && booking.selected_services.length > 0) {
            return booking.selected_services;
        }
        if (booking?.service_requests && Array.isArray(booking.service_requests) && booking.service_requests.length > 0) {
            return booking.service_requests;
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

    // Form thanh toán thu nốt phần remaining_balance khi click "Thu tiền & Check-in"
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'transfer'
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

    // Cấu hình ngân hàng VietQR
    const [bankConfig, setBankConfig] = useState({
        bank_bin: '970422',
        account_no: '123456789',
        account_name: 'KHACH SAN TA DA NANG'
    });

    // Thông báo màu trắng giữa màn hình (thay thế browser alert mặc định)
    const [centerModalNotice, setCenterModalNotice] = useState(null);

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
        if (booking?.guests && Array.isArray(booking.guests) && booking.guests.length > 0) {
            return booking.guests.map((g, idx) => ({
                id: g.id || `guest_${idx}_${Date.now()}`,
                full_name: g.full_name || '',
                id_type: g.id_type || 'CCCD',
                id_number: g.id_number || '',
                date_of_birth: g.date_of_birth || '',
                gender: g.gender || 'Nam',
                nationality: g.nationality || 'Việt Nam',
                is_primary: Boolean(g.is_primary ?? idx === 0)
            }));
        }
        const details = booking?.guest_details || {};
        return [
            {
                id: 'primary',
                full_name: details.full_name || booking?.guest_name || '',
                id_type: details.id_type || 'CCCD',
                id_number: details.id_number || booking?.identity_card || '',
                date_of_birth: details.date_of_birth || '',
                gender: details.gender || 'Nam',
                nationality: details.nationality || 'Việt Nam',
                is_primary: true
            }
        ];
    });

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

    const paidAmount = useMemo(() => {
        if (booking?.paid_amount !== undefined && booking?.paid_amount !== null) {
            return Number(booking.paid_amount);
        }
        if (booking?.is_paid || booking?.status === 'paid' || booking?.payment_status === 'COMPLETED') {
            return baseRoomCharge;
        }
        return 0;
    }, [booking, baseRoomCharge]);

    const effectiveRemainingBalance = useMemo(() => {
        return Math.max(0, effectiveRoomCharge - paidAmount);
    }, [effectiveRoomCharge, paidAmount]);

    // Đánh giá trạng thái tài chính
    const isFullyPaid = effectiveRemainingBalance <= 0; // Trường hợp 2 (Pre-paid)

    // 4. TẢI DANH SÁCH PHÒNG TRỐNG & CẤU HÌNH VIETQR
    useEffect(() => {
        if (!booking?.id || !isOpen) return;

        let isMounted = true;
        const loadInitialData = async () => {
            setIsLoadingRooms(true);
            try {
                // Tải danh sách phòng trống khả dụng
                const roomRes = await bookingService.getAvailableRoomsForBooking(
                    booking.id,
                    booking.category_id || booking.category?.id
                );
                if (isMounted && roomRes?.success) {
                    const rooms = roomRes.rooms || [];
                    setAvailableRooms(rooms);
                    if (rooms.length > 0) {
                        setSelectedRoomId(String(rooms[0].id));
                    }
                }

                // Tải cấu hình ngân hàng VietQR
                const configRes = await api.get('/payments/config/');
                const cData = configRes.data?.data || configRes.data;
                if (isMounted && cData?.bank_bin) {
                    setBankConfig({
                        bank_bin: cData.bank_bin,
                        account_no: cData.account_no,
                        account_name: (cData.account_name || '').toUpperCase()
                    });
                }
                // Tải chi tiết đơn đặt phòng để lấy danh sách dịch vụ đặt trước mới nhất
                const bookingDetailRes = await api.get(`/bookings/${booking.id}/`);
                const bDetail = bookingDetailRes.data?.data || bookingDetailRes.data;
                if (isMounted && bDetail) {
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

    // Xử lý gửi báo chuẩn bị cho bộ phận F&B / Spa (Cách 2: Bắn chuông thông báo, giữ nguyên status 'pending' để F&B tự nhận)
    const handleNotifyService = async (serviceReqId) => {
        try {
            setIsUpdatingServiceId(serviceReqId);

            // Tính toán thời gian hẹn phục vụ dựa trên lựa chọn hẹn giờ
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
                // Nếu giờ chọn nhỏ hơn giờ hiện tại (ví dụ hiện tại 21:00 mà chọn 08:00 sáng hôm sau)
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

            setNotifiedServiceIds(prev => new Set([...prev, serviceReqId]));

            // Cập nhật lại request_time và is_scheduled trong danh sách dịch vụ trên giao diện
            setServicesList(prev => prev.map(s => s.id === serviceReqId ? {
                ...s,
                request_time: isScheduledChoice ? targetIso : null,
                is_scheduled: isScheduledChoice,
                note: s.note ? `${s.note} [${label}]` : label
            } : s));

            try {
                localStorage.setItem('pms_last_service_event', Date.now().toString());
            } catch (e) {}

            const timeFormatted = targetIso ? new Date(targetIso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
            const popupMsg = preset === 'now'
                ? 'Đã gửi chuông báo cho bộ phận F&B / Spa chuẩn bị phục vụ ngay! Đơn ở trạng thái "Chờ xử lý" để nhân viên tiếp nhận.'
                : `Đã gửi chuông báo cho bộ phận F&B / Spa. Giờ hẹn phục vụ: ${timeFormatted} (${label}). Đơn ở trạng thái "Chờ xử lý" để nhân viên chủ động chuẩn bị đúng giờ!`;

            showCenterNotice({
                title: 'Đã Báo F&B / Spa Chuẩn Bị',
                message: popupMsg,
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

    // VietQR URL động cho số tiền còn thiếu (effectiveRemainingBalance)
    const qrUrl = useMemo(() => {
        if (!bankConfig.bank_bin || !bankConfig.account_no || effectiveRemainingBalance <= 0) return '';
        const bCode = booking?.booking_code || `BK-${booking?.id}`;
        const addInfo = encodeURIComponent(`Thanh toan checkin ${bCode}`);
        return `https://img.vietqr.io/image/${bankConfig.bank_bin}-${bankConfig.account_no}-compact2.jpg?amount=${effectiveRemainingBalance}&addInfo=${addInfo}&accountName=${encodeURIComponent(bankConfig.account_name)}`;
    }, [bankConfig, effectiveRemainingBalance, booking]);

    // 5. THỰC HIỆN CHECK-IN (GỌI API GÁN PHÒNG & ĐỔI TRẠNG THÁI SANG CHECKED_IN)
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

    // A. Xử lý trường hợp 2 (Pre-paid) hoặc Cho nợ: Check-in trực tiếp
    const handleDirectCheckIn = () => {
        executeCheckIn();
    };

    // B. Xử lý "Cho nợ & Check-in": Khách chưa trả đủ nhưng được phép lên phòng trước
    const handleDebtAndCheckIn = () => {
        const confirmMsg = `Khách còn thiếu ${formatCurrency(effectiveRemainingBalance)}. Bạn có chắc chắn muốn cho khách nợ và hoàn tất nhận phòng? Phần nợ sẽ được dồn vào Folio để thu khi Check-out.`;
        if (window.confirm(confirmMsg)) {
            executeCheckIn(`[Lễ tân cho nợ tiền phòng]: Còn thiếu ${formatCurrency(effectiveRemainingBalance)} khi Check-in, sẽ thu khi Check-out`);
        }
    };

    // C. Xử lý "Thu tiền & Check-in": Thu tiền mặt hoặc quét VietQR xong rồi Check-in
    const handleConfirmPaymentAndCheckIn = async () => {
        try {
            setIsProcessingPayment(true);

            // Ghi nhận bản ghi thanh toán nốt phần effectiveRemainingBalance vào hệ thống
            await paymentService.confirmPayment({
                booking_id: booking.id,
                amount: effectiveRemainingBalance,
                payment_method: paymentMethod === 'transfer' ? 'TRANSFER' : 'CASH'
            });

            // Sau khi ghi nhận thanh toán thành công, hoàn tất thủ tục Check-in
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

    if (!isOpen || !booking) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full p-6 sm:p-7 shadow-2xl text-left max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200 flex flex-col justify-between">
                
                {/* ========================================================================= */}
                {/* 1. HEADER MODAL                                                           */}
                {/* ========================================================================= */}
                <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-xl shadow-md shadow-emerald-500/20 shrink-0">
                            🔑
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                                    #{booking.booking_code}
                                </span>
                                <span className="text-xs text-slate-300">•</span>
                                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200 uppercase">
                                    {booking.status_display || 'Chờ nhận phòng'}
                                </span>
                            </div>
                            <h3 className="font-serif text-xl font-bold text-slate-900 mt-1">
                                Thủ Tục Check-in & Khai Báo Lưu Trú
                            </h3>
                        </div>
                    </div>

                    <button
                        type="button"
                        disabled={isSubmitting || isProcessingPayment}
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center font-bold text-sm cursor-pointer disabled:opacity-50"
                    >
                        ✕
                    </button>
                </div>

                <div className="space-y-4 text-xs">
                    {/* ===================================================================== */}
                    {/* 2. TÓM TẮT TÀI CHÍNH (FOLIO BALANCE SUMMARY) - YÊU CẦU TRỌNG TÂM      */}
                    {/* ===================================================================== */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 via-slate-50/50 to-blue-50/30 border border-slate-200/80 shadow-2xs">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/60">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                <span>💳</span>
                                <span>Tóm tắt tài chính trước nhận phòng (Folio Balance)</span>
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                isFullyPaid
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                    : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}>
                                {isFullyPaid ? '✓ Đã thanh toán 100%' : 'Chưa thanh toán đủ'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Tiền phòng */}
                            <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <span className="text-[10px] text-slate-400 block font-medium">Tiền phòng ({booking.nights || 1} đêm):</span>
                                <strong className="text-sm font-bold text-slate-900 block mt-0.5">
                                    {formatCurrency(effectiveRoomCharge)}
                                </strong>
                                {isEarlyCheckIn && applyEarlyCharge && (
                                    <span className="text-[9px] text-emerald-600 font-semibold block">
                                        (Đã gồm +{formatCurrency(estimatedEarlyCharge)} ở sớm)
                                    </span>
                                )}
                            </div>

                            {/* Đã thanh toán */}
                            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                                <span className="text-[10px] text-emerald-600 block font-medium">Đã thanh toán trước:</span>
                                <strong className="text-sm font-bold text-emerald-700 block mt-0.5">
                                    {formatCurrency(paidAmount)}
                                </strong>
                            </div>

                            {/* Còn thiếu / Remaining Balance */}
                            <div className={`p-3 rounded-xl border ${
                                isFullyPaid
                                    ? 'bg-slate-50 border-slate-200'
                                    : 'bg-rose-50 border-rose-200'
                            }`}>
                                <span className={`text-[10px] block font-medium ${isFullyPaid ? 'text-slate-500' : 'text-rose-600'}`}>
                                    Còn thiếu (Cần thu):
                                </span>
                                <strong className={`text-base font-black block mt-0.5 ${
                                    isFullyPaid ? 'text-emerald-700' : 'text-rose-600'
                                }`}>
                                    {isFullyPaid ? '0đ (Đã đủ)' : formatCurrency(effectiveRemainingBalance)}
                                </strong>
                            </div>
                        </div>

                        {/* Thông báo thông minh theo trường hợp */}
                        {isFullyPaid ? (
                            <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[11px] flex items-center gap-2">
                                <span className="text-base">✅</span>
                                <div>
                                    <strong>Trường hợp Pre-paid:</strong> Khách đã thanh toán 100% online trước đó. Lễ tân chỉ cần gán phòng và bàn giao thẻ từ cho khách.
                                </div>
                            </div>
                        ) : (
                            <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-[11px] flex items-center gap-2">
                                <span className="text-base">ℹ️</span>
                                <div>
                                    <strong>Trường hợp Post-paid:</strong> Khách còn nợ <strong>{formatCurrency(effectiveRemainingBalance)}</strong>. Bạn có thể thu ngay qua Tiền mặt/VietQR hoặc chọn <em>"Cho nợ & Check-in"</em> để thu khi Check-out.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ===================================================================== */}
                    {/* CẢNH BÁO QUÁ HẠN LƯU TRÚ / NHẬN PHÒNG SỚM / NHẬN PHÒNG TRỄ           */}
                    {/* ===================================================================== */}

                    {/* 1. ĐƠN ĐÃ QUÁ HẠN LƯU TRÚ */}
                    {isExpiredCheckIn && (
                        <div className="p-3.5 rounded-2xl border-2 border-rose-400 bg-rose-50/40 text-rose-800 space-y-1.5 animate-in fade-in">
                            <div className="flex items-center gap-2 font-bold text-xs">
                                <span>⛔</span>
                                <span>Đơn đặt phòng đã quá hạn lưu trú (Ngày trả phòng dự kiến: {formatDateDisplay(booking.check_out_date)})</span>
                            </div>
                            <p className="text-[11px] text-rose-700 leading-relaxed">
                                Không thể thực hiện Check-in cho đơn này. Lễ tân vui lòng đánh dấu đơn sang <strong>Khách không đến (No-show)</strong> hoặc tạo đơn đặt phòng mới.
                            </p>
                        </div>
                    )}

                    {/* 2. NHẬN PHÒNG SỚM (EARLY CHECK-IN) */}
                    {isEarlyCheckIn && (
                        <div className="p-3.5 rounded-2xl border-2 border-emerald-400 bg-emerald-50/30 space-y-2.5 animate-in fade-in">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-emerald-950 text-xs uppercase flex items-center gap-1.5">
                                    <span>⚡</span>
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
                                        <strong className="text-emerald-700">+{formatCurrency(estimatedEarlyCharge)}</strong>)
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

                    {/* 3. KHÁCH ĐẾN TRỄ (LATE CHECK-IN) */}
                    {isLateCheckIn && (
                        <div className="p-3.5 rounded-2xl border-2 border-amber-400 bg-amber-50/30 space-y-2.5 animate-in fade-in">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-amber-950 text-xs uppercase flex items-center gap-1.5">
                                    <span>⏰</span>
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

                    {/* ===================================================================== */}
                    {/* ===================================================================== */}
                    {/* 3. TÓM TẮT THÔNG TIN PHÒNG & GÁN PHÒNG THỰC TẾ                        */}
                    {/* ===================================================================== */}
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-2xs">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                            <div>
                                <span className="text-slate-400 block text-[11px]">Người đặt phòng:</span>
                                <strong className="text-slate-900 text-xs block truncate mt-0.5">
                                    👤 {booking.guest_name}
                                </strong>
                                <span className="text-[10px] text-slate-500 block">
                                    📞 {booking.guest_phone || 'Chưa có SĐT'}
                                </span>
                            </div>

                            <div>
                                <span className="text-slate-400 block text-[11px]">Hạng phòng & Tiêu chuẩn:</span>
                                <strong className="text-slate-900 text-xs block text-emerald-800 font-bold mt-0.5">
                                    🏨 {booking.room_name}
                                </strong>
                                <span className="text-[10px] text-emerald-700 font-semibold block">
                                    👥 Tiêu chuẩn: {roomCapacity} người lớn
                                </span>
                            </div>

                            <div>
                                <span className="text-slate-400 block text-[11px]">Lịch trình lưu trú:</span>
                                <strong className="text-slate-900 text-xs block mt-0.5">
                                    🗓️ {formatDateDisplay(booking.check_in_date)} → {formatDateDisplay(booking.check_out_date)}
                                </strong>
                                <span className="text-[10px] text-slate-500 block">
                                    Thời gian: {booking.nights || 1} đêm
                                </span>
                            </div>
                        </div>

                        {/* GÁN PHÒNG THỰC TẾ */}
                        <div className="pt-2 border-t border-slate-100">
                            <label className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between mb-1.5">
                                <span className="flex items-center gap-1.5">
                                    <span>🚪</span>
                                    <span>Gán phòng thực tế đón khách</span>
                                    <span className="text-rose-500">*</span>
                                </span>
                                <span className="text-[10px] text-emerald-700 font-bold">
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
                                    ⚠️ Không có phòng trống thuộc hạng <strong>{booking.room_name}</strong> sẵn sàng đón khách.
                                </div>
                            ) : (
                                <select
                                    value={selectedRoomId}
                                    onChange={(e) => setSelectedRoomId(e.target.value)}
                                    disabled={isSubmitting || isProcessingPayment}
                                    className="w-full px-3 py-2 bg-emerald-50/30 border-2 border-emerald-400 focus:border-emerald-600 rounded-xl text-xs font-bold text-slate-900 shadow-xs focus:outline-none transition cursor-pointer"
                                >
                                    {availableRooms.map((room) => (
                                        <option key={room.id} value={room.id}>
                                            Phòng {room.room_number} — Tầng {room.floor} ({room.category_name || booking.room_name})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* ===================================================================== */}
                    {/* 3.5 NHẮC NHỞ DỊCH VỤ TIỆN ÍCH ĐÃ ĐẶT TRƯỚC (ADD-ON SERVICES)           */}
                    {/* ===================================================================== */}
                    {servicesList && servicesList.length > 0 && (
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/70 via-amber-50/40 to-orange-50/30 border-2 border-amber-300 shadow-xs space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">🧺</span>
                                    <div>
                                        <h4 className="font-bold text-amber-950 text-xs uppercase tracking-wider flex items-center gap-2">
                                            <span>Dịch vụ khách đã đặt kèm trước</span>
                                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black">
                                                {servicesList.length} dịch vụ
                                            </span>
                                        </h4>
                                        <p className="text-[10px] text-amber-800">
                                            Vui lòng xác nhận thời gian phục vụ với khách và thông báo cho bộ phận F&B / Spa / Lễ tân chuẩn bị.
                                        </p>
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300 flex items-center gap-1">
                                    <span>🟢</span>
                                    <span>Đã thanh toán trước</span>
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {servicesList.map((svc, idx) => {
                                    const total = Number(svc.total_price || ((svc.unit_price || svc.service_price || svc.price || 0) * (svc.quantity || 1)));
                                    const isUpdatingThis = isUpdatingServiceId === svc.id;
                                    const isCompleted = svc.status === 'completed';
                                    const isInProgress = svc.status === 'in_progress' || svc.status === 'delivering';

                                    return (
                                        <div
                                            key={svc.id || idx}
                                            className="p-3 bg-white/95 rounded-xl border border-amber-200/90 shadow-2xs flex flex-col justify-between hover:border-amber-400 transition"
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
                                                            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-lg shrink-0">
                                                                🛎️
                                                            </div>
                                                        )}
                                                        <div>
                                                            <strong className="text-xs font-bold text-slate-900 block leading-tight">
                                                                {svc.service_name}
                                                            </strong>
                                                            <span className="text-[10px] text-slate-500 block mt-0.5">
                                                                Số lượng: <strong className="text-amber-700">x{svc.quantity || 1}</strong> • {formatCurrency(total)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 border ${
                                                        isCompleted
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : isInProgress
                                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                            : notifiedServiceIds.has(svc.id)
                                                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                    }`}>
                                                        {isCompleted ? 'Đã phục vụ' : isInProgress ? 'Đang thực hiện' : notifiedServiceIds.has(svc.id) ? 'Đã báo (Chờ làm)' : 'Chờ xử lý'}
                                                    </span>
                                                </div>

                                                {(svc.note || (svc.is_scheduled && svc.request_time)) && (
                                                    <div className="mt-2 p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-600 space-y-0.5">
                                                        {svc.is_scheduled && svc.request_time && (
                                                            <div className="font-semibold text-slate-700 flex items-center gap-1">
                                                                <span>⏱️ Giờ hẹn phục vụ:</span>
                                                                <span className="text-amber-800 font-bold bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-300">
                                                                    {formatDateTimeDisplay(svc.request_time)}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {svc.note && (
                                                            <div className="italic text-amber-800 truncate" title={svc.note}>
                                                                💬 Ghi chú: "{svc.note}"
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* THANH CHỌN NHANH THỜI GIAN GIAO (KHI KHÁCH HẸN GIỜ) */}
                                                {!isCompleted && !isInProgress && (
                                                    <div className="mt-2 pt-2 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-1.5">
                                                        <span className="text-[10px] font-bold text-amber-950 flex items-center gap-1">
                                                            <span>⏰</span>
                                                            <span>Hẹn giờ giao:</span>
                                                        </span>
                                                        <div className="flex flex-wrap items-center gap-1 bg-amber-100/60 p-1 rounded-xl border border-amber-300/80">
                                                            {[
                                                                { id: 'now', label: '⚡ Giao ngay' },
                                                                { id: '30m', label: '+30p' },
                                                                { id: '1h', label: '+1h' },
                                                                { id: '2h', label: '+2h' }
                                                            ].map((opt) => {
                                                                const isSelected = (serviceScheduleTimes[svc.id] || 'now') === opt.id;
                                                                return (
                                                                    <button
                                                                        key={opt.id}
                                                                        type="button"
                                                                        onClick={() => setServiceScheduleTimes(prev => ({ ...prev, [svc.id]: opt.id }))}
                                                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                                                            isSelected
                                                                                ? 'bg-amber-600 text-white shadow-2xs'
                                                                                : 'text-amber-900 hover:bg-white hover:text-slate-900'
                                                                        }`}
                                                                    >
                                                                        {opt.label}
                                                                    </button>
                                                                );
                                                            })}

                                                            {/* Ô nhập giờ tùy chọn (Ví dụ: 20:00 tối) */}
                                                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition ${
                                                                serviceScheduleTimes[svc.id] === 'custom'
                                                                    ? 'bg-white border-amber-500 shadow-2xs text-amber-950 ring-1 ring-amber-400'
                                                                    : 'bg-white/70 border-amber-200 text-slate-600 hover:bg-white'
                                                            }`}>
                                                                <span className="text-[10px] font-bold">🕒 Đặt giờ:</span>
                                                                <input
                                                                    type="time"
                                                                    value={serviceCustomTimes[svc.id] || '20:00'}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setServiceCustomTimes(prev => ({ ...prev, [svc.id]: val }));
                                                                        setServiceScheduleTimes(prev => ({ ...prev, [svc.id]: 'custom' }));
                                                                    }}
                                                                    onClick={() => setServiceScheduleTimes(prev => ({ ...prev, [svc.id]: 'custom' }))}
                                                                    className="bg-transparent text-[11px] font-black text-slate-800 outline-none cursor-pointer w-[62px]"
                                                                    title="Chọn giờ cụ thể muốn giao (ví dụ 20:00)"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                                                <span className="text-[10px] text-slate-400">
                                                    Mã phiếu: #{svc.id}
                                                </span>
                                                {isCompleted ? (
                                                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                                        <span>✓</span>
                                                        <span>Đã hoàn tất</span>
                                                    </span>
                                                ) : isInProgress ? (
                                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 flex items-center gap-1">
                                                        <span>👨‍🍳</span>
                                                        <span>F&B/Spa đang làm...</span>
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={isUpdatingThis}
                                                        onClick={() => handleNotifyService(svc.id)}
                                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                                                            notifiedServiceIds.has(svc.id)
                                                                ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                                                                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-xs'
                                                        }`}
                                                        title={notifiedServiceIds.has(svc.id) ? 'Đã gửi chuông báo. Nhấn để gửi nhắc lại.' : 'Bắn tín hiệu chuông báo bộ phận F&B/Spa chuẩn bị'}
                                                    >
                                                        {isUpdatingThis ? (
                                                            <span>Đang gửi...</span>
                                                        ) : notifiedServiceIds.has(svc.id) ? (
                                                            <>
                                                                <span>✓</span>
                                                                <span>Đã báo F&B/Spa (Bấm để nhắc lại)</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span>🔔</span>
                                                                <span>Báo F&B/Spa chuẩn bị</span>
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

                    {/* ===================================================================== */}
                    {/* 4. KHAI BÁO THÔNG TIN KHÁCH LƯU TRÚ (DYNAMIC FORM)                    */}
                    {/* ===================================================================== */}
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <span className="text-base">📋</span>
                                <div>
                                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                                        Danh sách khách lưu trú ({guests.length} người)
                                    </h4>
                                    <p className="text-[10px] text-slate-500">
                                        Khai báo CCCD/Hộ chiếu phục vụ thủ tục đăng ký tạm trú
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddGuest}
                                disabled={isSubmitting || isProcessingPayment}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                            >
                                <span>➕</span>
                                <span>Thêm người ở cùng</span>
                            </button>
                        </div>

                        {/* CẢNH BÁO THÔNG MINH KHI VƯỢT QUÁ TIÊU CHUẨN SỨC CHỨA */}
                        {isOverCapacity && (
                            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-center gap-2.5 animate-in fade-in">
                                <span className="text-xl shrink-0">⚠️</span>
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
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded-md border border-blue-200">
                                                    ⭐ Đại diện chính
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
                                                <span>🗑️</span>
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

                    {/* ===================================================================== */}
                    {/* 4. FORM THU TIỀN NHANH (KHI CLICK "THU TIỀN & CHECK-IN")              */}
                    {/* ===================================================================== */}
                    {showPaymentForm && !isFullyPaid && (
                        <div className="p-4 rounded-2xl border-2 border-amber-400 bg-amber-50/30 space-y-4 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5">
                                    <span>💰</span>
                                    <span>Thu nốt phần tiền phòng còn thiếu:</span>
                                    <span className="text-rose-600 text-sm font-extrabold">{formatCurrency(effectiveRemainingBalance)}</span>
                                </h4>
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentForm(false)}
                                    className="text-[10px] text-slate-500 hover:text-slate-800 font-bold underline cursor-pointer"
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
                                            ? 'bg-amber-100/70 border-amber-500 ring-2 ring-amber-500/20 text-slate-900'
                                            : 'bg-white border-slate-200 text-slate-700'
                                    }`}
                                >
                                    <span className="text-xl">💵</span>
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
                                            ? 'bg-blue-100/70 border-blue-500 ring-2 ring-blue-500/20 text-slate-900'
                                            : 'bg-white border-slate-200 text-slate-700'
                                    }`}
                                >
                                    <span className="text-xl">🏦</span>
                                    <div>
                                        <div className="font-bold text-xs">Chuyển khoản VietQR</div>
                                        <div className="text-[10px] text-slate-500">Quét mã chuyển nhanh</div>
                                    </div>
                                </button>
                            </div>

                            {/* KHU VỰC HIỂN THỊ VIETQR NẾU CHỌN CHUYỂN KHOẢN */}
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
                                        <div>Số tiền cần quét: <strong className="text-rose-600 font-bold text-sm">{formatCurrency(effectiveRemainingBalance)}</strong></div>
                                        <div className="text-[10px] text-blue-700 bg-blue-50 p-1.5 rounded-lg border border-blue-200">
                                            Nội dung: <strong className="font-mono">Thanh toan checkin {booking.booking_code}</strong>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Hướng dẫn thanh toán nhanh */}
                            <p className="text-[11px] text-slate-500 italic">
                                * Lễ tân vui lòng nhận tiền mặt hoặc đợi khách quét mã VietQR thành công, sau đó bấm nút <strong>"Xác nhận Đã thu & Check-in"</strong> ở góc dưới để hoàn tất.
                            </p>
                        </div>
                    )}

                    {/* GHI CHÚ BÀN GIAO CHECK-IN */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                            📝 Ghi chú nhận phòng (Lễ tân):
                        </label>
                        <input
                            type="text"
                            placeholder="VD: Đã giao 2 chìa khóa, khách đi kèm 1 trẻ em..."
                            value={checkInNote}
                            onChange={(e) => setCheckInNote(e.target.value)}
                            disabled={isSubmitting || isProcessingPayment}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition"
                        />
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* 5. FOOTER BUTTONS - LOGIC THÔNG MINH THEO YÊU CẦU                         */}
                {/* ========================================================================= */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        disabled={isSubmitting || isProcessingPayment}
                        onClick={onClose}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                        Hủy bỏ
                    </button>

                    {/* LOGIC THÔNG MINH THEO YÊU CẦU: */}
                    {isFullyPaid ? (
                        /* TRƯỜNG HỢP 2 (PRE-PAID): Chỉ hiện 1 nút "Hoàn tất Check-in" */
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
                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Đang Check-in...</span>
                                </>
                            ) : (
                                <>
                                    <span>🔑</span>
                                    <span>Hoàn tất Check-in & Lưu thông tin</span>
                                </>
                            )}
                        </button>
                    ) : showPaymentForm ? (
                        /* TRƯỜNG HỢP 1B: ĐÃ MỞ FORM THU TIỀN -> Hiện nút Xác nhận thu tiền & Check-in ở footer */
                        <>
                            {/* Nút Cho nợ & Check-in (Vẫn cho phép nếu khách đổi ý) */}
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
                                className="px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                title="Cho khách nhận phòng trước, ghi nhận nợ tiền phòng vào Folio và thu khi check-out"
                            >
                                <span>📋</span>
                                <span>Cho nợ & Check-in</span>
                            </button>

                            {/* Nút Xác nhận đã thu tiền & Check-in (Thực thi chính thức) */}
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
                                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                                {isProcessingPayment ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang xử lý thanh toán & Check-in...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>✓</span>
                                        <span>Xác nhận Đã thu {formatCurrency(effectiveRemainingBalance)} & Check-in</span>
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        /* TRƯỜNG HỢP 1A: CHƯA MỞ FORM THU TIỀN -> Hiện "Cho nợ & Check-in" hoặc "Thu tiền & Check-in" (để mở form) */
                        <>
                            {/* Nút 1: Cho nợ & Check-in */}
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
                                className="px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs rounded-xl border border-amber-300 transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                                title="Cho khách nhận phòng trước, ghi nhận nợ tiền phòng vào Folio và thu khi check-out"
                            >
                                <span>📋</span>
                                <span>Cho nợ & Check-in</span>
                            </button>

                            {/* Nút 2: Mở form thu tiền */}
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
                                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/25 transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                                <span>💵</span>
                                <span>Thu tiền & Check-in ({formatCurrency(effectiveRemainingBalance)})</span>
                            </button>
                        </>
                    )}
                </div>

            </div>

            {/* MODAL THÔNG BÁO MÀU TRẮNG Ở GIỮA MÀN HÌNH */}
            {centerModalNotice && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-2xl max-w-sm w-full border border-slate-100 flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-200 relative">
                        {/* Nút X đóng góc trên bên phải */}
                        <button
                            type="button"
                            onClick={() => setCenterModalNotice(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Icon nhận diện thương hiệu/thông báo */}
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner ${
                            centerModalNotice.type === 'error'
                                ? 'bg-rose-50 border-2 border-rose-200/80 text-rose-600'
                                : centerModalNotice.type === 'warning'
                                ? 'bg-amber-50 border-2 border-amber-200/80 text-amber-600'
                                : centerModalNotice.icon === 'bell'
                                ? 'bg-amber-50 border-2 border-amber-200/80 text-amber-600'
                                : 'bg-emerald-50 border-2 border-emerald-200/80 text-emerald-600'
                        }`}>
                            {centerModalNotice.type === 'error' ? (
                                <XCircle className="w-8 h-8" />
                            ) : centerModalNotice.type === 'warning' ? (
                                <AlertTriangle className="w-8 h-8" />
                            ) : centerModalNotice.icon === 'bell' ? (
                                <Bell className="w-8 h-8 animate-bounce" />
                            ) : (
                                <CheckCircle2 className="w-8 h-8" />
                            )}
                        </div>

                        {/* Tiêu đề & nội dung thông báo */}
                        <div className="space-y-1.5">
                            <h3 className="text-lg font-black text-slate-800 tracking-tight">
                                {centerModalNotice.title || 'Thông Báo'}
                            </h3>
                            <p className="text-sm font-medium text-slate-600 leading-relaxed px-2">
                                {centerModalNotice.message}
                            </p>
                        </div>

                        {/* Nút xác nhận Đã hiểu */}
                        <button
                            type="button"
                            onClick={() => setCenterModalNotice(null)}
                            className="w-full py-3 px-5 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-black hover:to-slate-900 text-white font-bold text-sm rounded-2xl shadow-lg shadow-slate-900/20 transition-all cursor-pointer active:scale-95"
                        >
                            Đã hiểu
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
