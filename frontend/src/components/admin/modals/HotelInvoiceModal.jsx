import React, { useState, useEffect } from 'react';
import api from '../../../services/api';

/**
 * Component Modal & Mẫu In Hóa Đơn Đặt Phòng (Check-in Invoice Voucher)
 * Thiết kế chuẩn phom Hóa đơn / Phiếu xác nhận nhận phòng Khách sạn:
 * - Tông màu trắng đen / monochrome trang nhã, sắc nét cho in ấn giấy A4
 * - KHÔNG có icon emoji, KHÔNG có chữ màu mè hay badge gradient
 * - Tương thích lệnh in trình duyệt window.print() (chỉ in nội dung hóa đơn, ẩn hoàn toàn giao diện xung quanh)
 */
export default function HotelInvoiceModal({ booking, payment, transaction, paymentMethod, onClose }) {
    if (!booking) return null;

    // Tự động tải thông tin khách sạn từ Cài đặt hệ thống
    const [hotelInfo, setHotelInfo] = useState({
        hotel_name: 'Khách Sạn TA Đà Nẵng',
        hotel_slogan: 'Khách Sạn & Khu Nghỉ Dưỡng',
        address: '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Quận Ngũ Hành Sơn, TP. Đà Nẵng',
        hotline: '1900 8899',
        email: 'contact@tahotel.vn',
        tax_code: '0401234567'
    });

    useEffect(() => {
        let isMounted = true;
        api.get('/hotel-settings/')
            .then(res => {
                const data = res.data?.data || res.data;
                if (data && isMounted) {
                    setHotelInfo(prev => ({
                        ...prev,
                        hotel_name: data.hotel_name || prev.hotel_name,
                        hotel_slogan: data.hotel_slogan || prev.hotel_slogan,
                        address: data.address || prev.address,
                        hotline: data.hotline || prev.hotline,
                        email: data.email || prev.email,
                        tax_code: data.tax_code || prev.tax_code,
                    }));
                }
            })
            .catch(() => {});
        return () => { isMounted = false; };
    }, []);

    // Helper format ngày DD/MM/YYYY
    const formatDate = (dateStr) => {
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

    // Helper format ngày giờ DD/MM/YYYY HH:mm
    const formatDateTime = (isoStr) => {
        if (!isoStr) {
            const now = new Date();
            const time = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
            const date = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            return `${date} ${time}`;
        }
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
            const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            return `${date} ${time}`;
        } catch {
            return isoStr;
        }
    };

    // Helper format tiền tệ VNĐ: e.g. 1,440,000đ
    const formatCurrency = (amount) => {
        const num = Number(amount) || 0;
        return `${num.toLocaleString('vi-VN')}đ`;
    };

    // Xác định chuẩn hóa mã phương thức thanh toán: 'CASH' | 'TRANSFER' | 'CREDIT_CARD' | 'MOMO' | 'MIXED'
    const resolvePaymentMethodCode = () => {
        // 1. Kiểm tra nếu danh sách payments có nhiều phương thức khác nhau đã hoàn tất
        if (booking?.payments && Array.isArray(booking.payments)) {
            const completed = booking.payments.filter(p => p.payment_status === 'COMPLETED');
            if (completed.length > 0) {
                const normalizedMethods = new Set();
                completed.forEach(p => {
                    const m = String(p.payment_method || '').trim().toLowerCase();
                    if (['cash', 'tiền mặt', 'tien_mat', 'reception'].includes(m)) {
                        normalizedMethods.add('CASH');
                    } else if (['transfer', 'bank_transfer', 'vietqr', 'chuyen_khoan', 'chuyển khoản', 'qr'].includes(m)) {
                        normalizedMethods.add('TRANSFER');
                    } else if (['credit_card', 'card', 'the_tin_dung'].includes(m)) {
                        normalizedMethods.add('CREDIT_CARD');
                    } else if (['momo'].includes(m)) {
                        normalizedMethods.add('MOMO');
                    } else if (m) {
                        normalizedMethods.add(m.toUpperCase());
                    }
                });
                if (normalizedMethods.size > 1) {
                    return 'MIXED';
                }
                if (normalizedMethods.size === 1) {
                    return Array.from(normalizedMethods)[0];
                }
            }
        }

        const raw = (
            paymentMethod ||
            payment?.payment_method ||
            payment?.method ||
            transaction?.payment_method ||
            transaction?.method ||
            booking?.payment_method ||
            booking?.invoice?.payment_method ||
            ''
        );

        const rawLower = String(raw).trim().toLowerCase();
        if (rawLower === 'mixed' || rawLower.includes('hỗn hợp') || rawLower.includes('hon_hop')) {
            return 'MIXED';
        }
        if (['cash', 'tiền mặt', 'tien_mat', 'reception', 'tai_quay', 'tại quầy', 'tại lễ tân'].includes(rawLower)) {
            return 'CASH';
        }
        if (['transfer', 'bank_transfer', 'vietqr', 'chuyen_khoan', 'chuyển khoản', 'qr'].includes(rawLower)) {
            return 'TRANSFER';
        }
        if (['credit_card', 'card', 'the_tin_dung', 'thẻ tín dụng'].includes(rawLower)) {
            return 'CREDIT_CARD';
        }
        if (['momo'].includes(rawLower)) {
            return 'MOMO';
        }

        // Kiểm tra tiếp trong booking.note
        const noteLower = (booking?.note || '').toLowerCase();
        if ((noteLower.includes('vietqr') || noteLower.includes('chuyển khoản')) && 
            (noteLower.includes('tiền mặt') || noteLower.includes('tại quầy') || noteLower.includes('reception') || noteLower.includes('cash'))) {
            return 'MIXED';
        }
        if (noteLower.includes('vietqr') || noteLower.includes('chuyển khoản') || noteLower.includes('transfer')) {
            return 'TRANSFER';
        }
        if (noteLower.includes('reception') || noteLower.includes('tiền mặt') || noteLower.includes('cash') || noteLower.includes('tại lễ tân') || noteLower.includes('tại quầy')) {
            return 'CASH';
        }

        // Nếu đơn đã hoàn thành/check-out mà không có ghi chú VietQR -> Mặc định là Tiền mặt tại quầy
        if (['completed', 'checked_out'].includes(booking?.status)) {
            return 'CASH';
        }

        return 'CASH';
    };

    // Nhãn trạng thái phương thức thanh toán cho bảng Chi tiết tiền phòng
    const getPaidMethodLabel = () => {
        const code = resolvePaymentMethodCode();
        if (code === 'MIXED') return 'Đã thanh toán (Hỗn hợp Tiền mặt & VietQR)';
        if (code === 'CASH') return 'Đã thanh toán (Tiền mặt)';
        if (code === 'TRANSFER') return 'Đã thanh toán (VietQR)';
        if (code === 'CREDIT_CARD') return 'Đã thanh toán (Thẻ tín dụng)';
        if (code === 'MOMO') return 'Đã thanh toán (Ví MoMo)';
        return 'Đã thanh toán';
    };

    // Nhãn dòng khấu trừ đã thanh toán trong khối Tổng kết
    const getPaidAdvanceLabel = () => {
        const code = resolvePaymentMethodCode();
        if (code === 'MIXED') return '✓ Đã thanh toán (Hỗn hợp Tiền mặt & VietQR):';
        if (code === 'CASH') return '✓ Đã thanh toán (Tiền mặt):';
        if (code === 'TRANSFER') return '✓ Đã thanh toán (VietQR):';
        if (code === 'CREDIT_CARD') return '✓ Đã thanh toán (Thẻ tín dụng):';
        if (code === 'MOMO') return '✓ Đã thanh toán (Ví MoMo):';
        return '✓ Đã thanh toán:';
    };

    const isGroupMaster = Boolean(booking.is_group_master || booking.is_group_booking);
    const isGroupRoom = !isGroupMaster && Boolean(
        booking.group_booking || 
        booking.group_booking_code || 
        booking.group_booking_id
    );

    const isCompanyAllInclusive = Boolean(
        booking.is_company_all_inclusive ||
        booking.group_billing_type === 'ALL_INCLUSIVE' ||
        booking.billing_type === 'ALL_INCLUSIVE' ||
        booking.group_booking?.billing_type === 'ALL_INCLUSIVE'
    );

    // Trích xuất phương thức thanh toán hiển thị trên thông tin đặt phòng
    const getPaymentMethod = () => {
        if (isGroupMaster) {
            return booking.payment_method || 'Hợp đồng Doanh nghiệp B2B (VietQR / Chuyển khoản)';
        }
        if (isGroupRoom) {
            return `Gộp HĐ đoàn #${booking.group_booking_code || ''} (Master-Billing)`;
        }
        const code = resolvePaymentMethodCode();
        if (code === 'MIXED') return 'Hỗn hợp (Tiền mặt & Chuyển khoản VietQR)';
        if (code === 'CASH') return 'Tiền mặt (Tại quầy lễ tân)';
        if (code === 'TRANSFER') return 'Chuyển khoản VietQR';
        if (code === 'CREDIT_CARD') return 'Thẻ tín dụng / Ghi nợ';
        if (code === 'MOMO') return 'Ví điện tử MoMo';
        if (booking.note && booking.note.includes('Thanh toán:')) {
            const method = booking.note.split('Thanh toán:')[1].trim().split('|')[0].trim();
            if (method) return method;
        }
        return 'Tiền mặt / Chuyển khoản';
    };

    // Trích xuất yêu cầu đặc biệt từ note
    const getSpecialRequest = () => {
        if (!booking.note) return 'Không có yêu cầu đặc biệt';
        const cleaned = booking.note.replace(/Thanh toán:[^|]+(\|)?/gi, '').trim();
        return cleaned || 'Không có yêu cầu đặc biệt';
    };

    const nights = Math.max(1, Number(booking.nights) || 1);
    
    // Đối với đoàn (isGroupMaster): tiền phòng thuần được bóc tách từ các phòng con (không bao gồm tiền dịch vụ đã kê riêng)
    const isGroupAllInclusive = isGroupMaster && (booking.billing_type === 'ALL_INCLUSIVE' || booking.is_all_inclusive);

    // Thu thập toàn bộ dịch vụ phát sinh của các phòng con trong đoàn
    const groupSubExtraServices = React.useMemo(() => {
        if (!isGroupMaster || !Array.isArray(booking.sub_bookings)) return [];
        const items = [];
        booking.sub_bookings.forEach((sub, sIdx) => {
            const roomNum = sub.room?.room_number || sub.room_number || `Phòng ${sIdx + 1}`;
            const services = Array.isArray(sub.extra_services) ? sub.extra_services : [];
            services.forEach((s) => {
                items.push({
                    ...s,
                    room_number: roomNum,
                    sub_booking_code: sub.booking_code
                });
            });
        });
        return items;
    }, [isGroupMaster, booking.sub_bookings]);

    const groupSubServicesTotal = React.useMemo(() => {
        return groupSubExtraServices.reduce((sum, s) => sum + (Number(s.price || 0) * Number(s.quantity || 1)), 0);
    }, [groupSubExtraServices]);

    // Phụ phí dịch vụ phát sinh tại phòng (In-Room Dining / Services)
    const extraServices = isGroupMaster
        ? (isGroupAllInclusive ? groupSubExtraServices : [])
        : (Array.isArray(booking.extra_services) ? booking.extra_services : []);

    const extraServicesTotal = isGroupMaster
        ? (isGroupAllInclusive ? groupSubServicesTotal : 0)
        : (Number(booking.extra_services_total) || 
            extraServices.reduce((sum, s) => sum + (Number(s.price || 0) * Number(s.quantity || 1)), 0));

    // Tính tiền phòng thuần:
    // Nếu là đoàn và có danh sách phòng con: tính tổng tiền phòng thực tế của các phòng con
    const groupPureRoomsAmount = React.useMemo(() => {
        if (!isGroupMaster || !Array.isArray(booking.sub_bookings) || booking.sub_bookings.length === 0) {
            return null;
        }
        return booking.sub_bookings.reduce((sum, sub) => {
            const subServices = Array.isArray(sub.extra_services)
                ? sub.extra_services.reduce((sSum, s) => sSum + (Number(s.price || 0) * Number(s.quantity || 1)), 0)
                : 0;
            const subTotal = Number(sub.total_amount || 0);
            const subRoom = subTotal > subServices 
                ? (subTotal - subServices) 
                : Number(sub.room_charge != null ? sub.room_charge : (sub.room_amount || subTotal));
            return sum + (subRoom > 0 ? subRoom : 0);
        }, 0);
    }, [isGroupMaster, booking.sub_bookings]);

    const rawRoomAmount = Number(booking.room_amount || booking.total_amount) || 0;
    const roomAmount = isGroupMaster
        ? (groupPureRoomsAmount != null ? groupPureRoomsAmount : Math.max(0, rawRoomAmount - extraServicesTotal))
        : rawRoomAmount;
    
    // Tách biệt các khoản giảm giá:
    // 1. Giảm giá Hạng thành viên (Loyalty & Membership Program)
    const membershipDiscount = Number(booking.membership_discount) || 0;
    // 2. Mã khuyến mãi (Promotion Voucher)
    const hasPromotion = Boolean(
        booking.promotion_code || 
        booking.applied_promotion || 
        (booking.promotion_discount && Number(booking.promotion_discount) > 0) ||
        (booking.discount_amount && Number(booking.discount_amount) > 0)
    );
    const hasDiscount = hasPromotion || membershipDiscount > 0;

    let pricePerNight = Number(booking.daily_rate) || 0;
    if (!pricePerNight || pricePerNight <= 0 || !hasDiscount) {
        pricePerNight = Math.round((roomAmount + membershipDiscount) / nights);
    }

    const roomSubtotal = isGroupMaster ? roomAmount : (pricePerNight * nights);
    const totalDiscount = Math.max(0, roomSubtotal - roomAmount);

    // Tính chính xác số tiền giảm cho từng khoản:
    const promoDiscount = booking.promotion_discount != null && Number(booking.promotion_discount) > 0
        ? Number(booking.promotion_discount)
        : hasPromotion 
            ? Math.max(0, totalDiscount - membershipDiscount)
            : 0;

    const tierName = booking.guest_tier_name || 
        booking.guest?.current_tier?.name || 
        booking.guest_profile?.vip_tier || 
        'Hội viên';

    // Tổng thanh toán thực tế (Grand Total bao gồm cả tiền phòng và toàn bộ dịch vụ phát sinh)
    const grandTotal = isGroupMaster 
        ? (roomAmount + extraServicesTotal)
        : (roomAmount + extraServicesTotal);

    // Xác định đơn đã hủy hay không
    const isCancelled = ['cancelled', 'no_show'].includes(booking.status);
    const isCompleted = ['completed', 'checked_out'].includes(booking.status);

    // Xác định tiền phòng đã được thanh toán trước hay chưa
    const isRoomPaid = !isCancelled && Boolean(
        booking.is_paid ||
        booking.payment_status === 'COMPLETED' ||
        ['paid', 'PAID', 'completed', 'checked_out'].includes(booking.status) ||
        (booking.payments && Array.isArray(booking.payments) && booking.payments.some(p => p.payment_status === 'COMPLETED')) ||
        (booking.note && (
            booking.note.toLowerCase().includes('vietqr: đã thanh toán') ||
            booking.note.toLowerCase().includes('đã thanh toán thành công')
        ))
    );

    const completedPayments = React.useMemo(() => {
        if (!booking?.payments || !Array.isArray(booking.payments)) return [];
        return booking.payments.filter(p => p.payment_status === 'COMPLETED');
    }, [booking?.payments]);

    const getPaymentTrancheLabel = (p, index) => {
        const m = String(p.payment_method || '').toUpperCase();
        let methodName = 'Tiền mặt';
        if (['TRANSFER', 'VIETQR', 'BANK_TRANSFER'].includes(m)) {
            methodName = 'Chuyển khoản VietQR';
        } else if (['CREDIT_CARD', 'CARD', 'THE_TIN_DUNG'].includes(m)) {
            methodName = 'Thẻ tín dụng';
        } else if (['MOMO'].includes(m)) {
            methodName = 'Ví MoMo';
        }
        return `✓ Đợt ${index + 1} (${methodName}):`;
    };

    const paidAmount = isCancelled ? 0 : (
        isGroupMaster
            ? (isCompleted ? grandTotal : (booking.is_deposit_paid ? Number(booking.deposit_amount || 0) : 0))
            : (isCompleted ? grandTotal : Number(booking.paid_amount ?? (isRoomPaid ? roomAmount : 0)))
    );
    const balanceDue = isCancelled ? 0 : (
        isGroupMaster
            ? (isCompleted ? 0 : Math.max(0, grandTotal - paidAmount))
            : (isGroupRoom
                ? (isCompleted || isCompanyAllInclusive ? 0 : Math.max(0, extraServicesTotal - paidAmount))
                : (isCompleted ? 0 : Math.max(0, grandTotal - paidAmount)))
    );
    const bookingCodeDisplay = `#${String(booking.booking_code || booking.group_code || '').replace('-', '')}`;
    const printDate = formatDateTime(booking.actual_check_in || booking.created_at || new Date().toISOString());

    // Lắng nghe phím Escape để đóng nhanh modal
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Kích hoạt lệnh in trình duyệt
    const handlePrint = () => {
        window.print();
    };

    return (
        <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-start justify-center p-2 sm:p-4 backdrop-blur-xs"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            {/* Scoped CSS cho chế độ in A4: Ẩn tất cả body, chỉ hiển thị duy nhất #hotel-invoice-printable */}
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 15mm 15mm 15mm 15mm;
                    }
                    body {
                        background: #ffffff !important;
                        color: #000000 !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #hotel-invoice-printable,
                    #hotel-invoice-printable * {
                        visibility: visible !important;
                    }
                    #hotel-invoice-printable {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                    }
                    .no-print {
                        display: none !important;
                    }

                    /* Xóa triệt để khung viền, nền xám/bạc và padding quanh các nhãn trạng thái (badge) */
                    #hotel-invoice-printable td span,
                    #hotel-invoice-printable th span,
                    #hotel-invoice-printable span[class*="rounded"],
                    #hotel-invoice-printable span[class*="border"],
                    #hotel-invoice-printable .status-badge,
                    #hotel-invoice-printable td [class*="rounded"],
                    #hotel-invoice-printable td [class*="border"] {
                        border: none !important;
                        border-width: 0 !important;
                        background: transparent !important;
                        background-color: transparent !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        outline: none !important;
                    }

                    /* Đảm bảo hàng bảng không bị in bóng nền màu xám */
                    #hotel-invoice-printable tr,
                    #hotel-invoice-printable td {
                        background: transparent !important;
                        background-color: transparent !important;
                    }

                    /* Chữ trạng thái hiển thị màu đen rõ nét trên giấy in */
                    #hotel-invoice-printable td span {
                        color: #111827 !important;
                        font-weight: 600 !important;
                    }
                }
            `}</style>

            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-2 sm:my-6">
                {/* THANH ĐIỀU KHIỂN (Ẩn khi in) - Sticky top */}
                <div className="no-print sticky top-0 z-20 bg-slate-900 text-white px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between border-b border-slate-800 shadow-xs">
                    <div className="flex items-center gap-1.5 sm:gap-2 truncate mr-2">
                        <span className="font-bold text-xs sm:text-sm tracking-wide truncate">
                            Xem Trước Hóa Đơn
                        </span>
                        <span className="text-[11px] sm:text-xs text-slate-400 font-mono shrink-0">
                            ({bookingCodeDisplay})
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                        >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            <span className="hidden sm:inline">In hóa đơn (Ctrl + P)</span>
                            <span className="inline sm:hidden">In</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg transition cursor-pointer"
                        >
                            Đóng
                        </button>
                    </div>
                </div>

                {/* VÙNG NỘI DUNG HÓA ĐƠN IN ẤN (CHUẨN FORM ẢNH MẪU - ĐEN TRẮNG, KHÔNG ICON, KHÔNG CHỮ MÀU) */}
                <div className="overflow-x-auto w-full">
                    <div
                        id="hotel-invoice-printable"
                        className="p-5 sm:p-10 bg-white text-slate-900 font-sans min-w-[620px] sm:min-w-0"
                        style={{ minHeight: '680px', color: '#111827' }}
                    >
                    {/* 1. HEADER: THÔNG TIN KHÁCH SẠN VÀ TIÊU ĐỀ HÓA ĐƠN */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4">
                        {/* Cột trái: Tên khách sạn & địa chỉ chính thức của Khách Sạn TA Đà Nẵng */}
                        <div className="flex items-start gap-3.5">
                            {hotelInfo.logo_url ? (
                                <img
                                    src={hotelInfo.logo_url}
                                    alt={hotelInfo.hotel_name}
                                    className="w-12 h-12 object-contain shrink-0 rounded-lg border border-slate-200"
                                />
                            ) : (
                                <div className="w-11 h-11 shrink-0 rounded-xl bg-slate-900 text-white flex items-center justify-center font-serif font-black text-xl shadow-xs border border-slate-900 tracking-tighter">
                                    TA
                                </div>
                            )}
                            <div>
                                <h1 className="text-lg font-bold text-slate-900 leading-tight uppercase font-serif tracking-wide">
                                    {hotelInfo.hotel_name || 'Khách Sạn TA Đà Nẵng'}
                                </h1>
                                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mt-0.5">
                                    {hotelInfo.hotel_slogan || (hotelInfo.stars ? `${hotelInfo.stars}-Star Hotel & Resort` : 'Khách Sạn & Khu Nghỉ Dưỡng')}
                                </p>
                                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                    {hotelInfo.address || '08 Võ Nguyên Giáp, Bãi biển Mỹ Khê, Quận Ngũ Hành Sơn, TP. Đà Nẵng'}
                                </p>
                                <p className="text-[11px] text-slate-600 leading-relaxed font-mono">
                                    Hotline: {hotelInfo.hotline || '1900 8899'} | Email: {hotelInfo.email || 'contact@tahotel.vn'}{hotelInfo.tax_code ? ` | MST: ${hotelInfo.tax_code}` : ''}
                                </p>
                            </div>
                        </div>

                        {/* Cột phải: Tiêu đề Hóa Đơn & Mã đơn */}
                        <div className="text-left sm:text-right">
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 uppercase">
                                {isGroupMaster 
                                    ? (isCompleted ? 'HÓA ĐƠN THANH TOÁN ĐOÀN LƯU TRÚ & HỢP ĐỒNG B2B' : 'BẢNG KÊ CHI PHÍ TẠM TÍNH (GUEST FOLIO)')
                                    : (isCompleted ? 'HÓA ĐƠN THANH TOÁN (TAX INVOICE)' : 'HÓA ĐƠN ĐẶT PHÒNG')
                                }
                            </h2>
                            {isCancelled ? (
                                <span className="inline-block my-1 px-2.5 py-0.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded print:border-none print:bg-transparent print:shadow-none print:p-0 print:text-black">
                                    ✕ ĐƠN ĐÃ HỦY
                                </span>
                            ) : isCompleted ? (
                                <span className="inline-block my-1 px-2.5 py-0.5 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded print:border-none print:bg-transparent print:shadow-none print:p-0 print:text-black">
                                    ✓ ĐÃ QUYẾT TOÁN & HOÀN THÀNH
                                </span>
                            ) : isGroupMaster ? (
                                <span className="inline-block my-1 px-2.5 py-0.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded print:border-none print:bg-transparent print:shadow-none print:p-0 print:text-black">
                                    ⏳ BẢN TẠM TÍNH (CHỜ QUYẾT TOÁN KHI TRẢ PHÒNG)
                                </span>
                            ) : null}
                            <p className="text-xs text-slate-700 mt-1.5 font-medium">
                                {isGroupMaster ? 'Mã hợp đồng đoàn:' : 'Mã đặt phòng:'} <strong className="font-bold text-slate-900">{bookingCodeDisplay}</strong>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Ngày lập: {printDate}
                            </p>
                        </div>
                    </div>

                    {/* Đường phân cách mảnh */}
                    <div className="border-t border-slate-200 my-4" />

                    {/* 2. KHỐI THÔNG TIN: THÔNG TIN KHÁCH HÀNG & THÔNG TIN ĐẶT PHÒNG (2 CỘT) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs py-2">
                        {/* 2.0 KHỐI PHÁP NHÂN DOANH NGHIỆP XUẤT HÓA ĐƠN VAT */}
                        {(booking.customer_type === 'CORPORATE' || booking.company_name || booking.invoice?.company_name) && (
                            <div className="sm:col-span-2 p-3.5 bg-slate-50 border border-slate-300 rounded-lg text-xs space-y-2 print:bg-transparent print:border-slate-400">
                                <div className="font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 flex items-center justify-between">
                                    <span>ĐƠN VỊ CÔNG TY / TỔ CHỨC (HÓA ĐƠN DOANH NGHIỆP):</span>
                                    <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-bold print:border print:border-slate-300">
                                        VAT CORPORATE
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-slate-800">
                                    <div>
                                        <span className="text-slate-500 block text-[11px]">Tên đơn vị (Công ty):</span>
                                        <strong className="text-slate-900 block mt-0.5">{booking.company_name || booking.invoice?.company_name || '—'}</strong>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block text-[11px]">Mã số thuế (MST):</span>
                                        <strong className="font-mono text-slate-900 block mt-0.5">{booking.company_tax_code || booking.invoice?.tax_code || '—'}</strong>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block text-[11px]">Địa chỉ trụ sở công ty:</span>
                                        <span className="text-slate-900 block mt-0.5 leading-snug">{booking.company_address || booking.invoice?.company_address || '—'}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2.0.1 KHỐI THÔNG TIN ĐOÀN KHÁCH & MASTER-BILLING */}
                        {isGroupRoom && (
                            <div className="sm:col-span-2 p-3.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs space-y-1.5 print:bg-transparent print:border-slate-400">
                                <div className="font-bold uppercase tracking-wider text-indigo-900 border-b border-indigo-200/60 pb-1 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <span>🏢</span> PHÒNG THUỘC ĐOÀN KHÁCH: {booking.group_booking_name || booking.company_name || 'Khách đoàn Doanh nghiệp'}
                                    </span>
                                    <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-bold print:border print:border-slate-300">
                                        MÃ ĐOÀN: #{booking.group_booking_code || ''}
                                    </span>
                                </div>
                                <p className="text-[11px] text-indigo-800 leading-snug">
                                    * <strong>Chính sách thanh toán Master-Billing:</strong> {
                                        (booking.is_company_all_inclusive || booking.group_billing_type === 'ALL_INCLUSIVE')
                                            ? 'Toàn bộ tiền phòng và mọi dịch vụ phát sinh được CÔNG TY BẢO LÃNH CHI TRẢ TOÀN BỘ trên Hóa đơn tổng đoàn. Khách lưu trú không cần thanh toán bất kỳ khoản nào tại quầy lễ tân.'
                                            : `Tiền phòng được kết chuyển và quyết toán trên Hóa đơn tổng của Doanh nghiệp (${booking.is_group_fully_paid ? 'Công ty đã thanh toán đủ 100%' : (booking.is_group_deposit_paid ? 'Công ty đã đặt cọc' : 'Công ty thanh toán tập trung')}). Khách lưu trú tại phòng chỉ thanh toán các khoản dịch vụ phát sinh cá nhân tại quầy khi trả phòng lẻ.`
                                    }
                                </p>
                            </div>
                        )}

                        {/* 2.1 CỘT TRÁI: THÔNG TIN KHÁCH HÀNG */}
                        <div>
                            <h3 className="font-bold text-[11px] uppercase tracking-wider text-slate-900 pb-1.5 border-b border-slate-200 mb-3">
                                {booking.customer_type === 'CORPORATE' ? 'NGƯỜI ĐẠI DIỆN LƯU TRÚ / NHẬN PHÒNG:' : 'THÔNG TIN KHÁCH HÀNG:'}
                            </h3>
                            <div className="space-y-2 text-slate-700">
                                <div className="flex">
                                    <span className="w-28 shrink-0 text-slate-500">Họ tên khách:</span>
                                    <strong className="text-slate-900 font-bold">{booking.guest_name || booking.customer_name || (typeof booking.guest === 'string' ? booking.guest : booking.guest?.name) || 'Khách vãng lai'}</strong>
                                </div>
                                <div className="flex">
                                    <span className="w-28 shrink-0 text-slate-500">Số điện thoại:</span>
                                    <span className="text-slate-900 font-medium">{booking.guest_phone || booking.guest?.phone_number || '—'}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-28 shrink-0 text-slate-500">Email:</span>
                                    <span className="text-slate-900 font-medium">{booking.guest_email || booking.guest?.email || '—'}</span>
                                </div>
                                <div className="flex">
                                    <span className="w-28 shrink-0 text-slate-500">CCCD / Hộ chiếu:</span>
                                    <span className="text-slate-900 font-medium">{booking.identity_card || booking.guest?.identity_card || '—'}</span>
                                </div>
                            </div>
                        </div>

                        {/* 2.2 CỘT PHẢI: THÔNG TIN ĐẶT PHÒNG */}
                        <div>
                            <h3 className="font-bold text-[11px] uppercase tracking-wider text-slate-900 pb-1.5 border-b border-slate-200 mb-3">
                                THÔNG TIN ĐẶT PHÒNG:
                            </h3>
                            <div className="space-y-2 text-slate-700">
                                <div className="flex">
                                    <span className="w-28 shrink-0 text-slate-500">{isGroupMaster ? 'Mã hợp đồng đoàn:' : 'Mã đặt phòng:'}</span>
                                    <strong className="text-slate-900 font-bold">{bookingCodeDisplay}</strong>
                                </div>
                                <div className="flex">
                                    <span className="w-28 shrink-0 text-slate-500">{isGroupMaster ? 'Quy mô lưu trú:' : 'Phòng lưu trú:'}</span>
                                    <strong className="text-slate-900 font-bold">
                                        {isGroupMaster
                                            ? `${booking.total_rooms || booking.sub_bookings?.length || 1} phòng • ${booking.room_name || booking.group_name || 'Khách đoàn'}`
                                            : `${(booking.room_number || booking.room?.room_number) ? `Phòng ${booking.room_number || booking.room?.room_number}` : 'Chưa xếp số'} (${booking.room_name || booking.category?.name || booking.room?.room_type_name || 'Tiêu chuẩn'})`
                                        }
                                    </strong>
                                </div>
                                <div className="flex">
                                    <span className="w-28 shrink-0 text-slate-500">Thời gian lưu trú:</span>
                                    <span className="text-slate-900 font-medium">
                                        {formatDate(booking.check_in_date)} đến {formatDate(booking.check_out_date)} ({nights} đêm)
                                    </span>
                                </div>
                                <div className="flex">
                                    <span className="w-28 shrink-0 text-slate-500">Phương thức:</span>
                                    <span className="text-slate-900 font-medium">{getPaymentMethod()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. BẢNG CHI TIẾT THANH TOÁN PHÒNG NGHỈ HOẶC DANH SÁCH PHÒNG ĐOÀN */}
                    <div className="mt-6">
                        <h4 className="font-bold text-xs text-slate-900 mb-2">
                            {isGroupMaster ? 'Bảng kê chi tiết các phòng thuộc hợp đồng đoàn lưu trú:' : 'Chi tiết thanh toán phòng nghỉ:'}
                        </h4>

                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-300 text-slate-700">
                                        <th className="py-2.5 text-left font-bold uppercase text-[11px] tracking-wider w-[38%]">
                                            {isGroupMaster ? 'DANH MỤC PHÒNG & KHÁCH LƯU TRÚ' : 'NỘI DUNG THANH TOÁN'}
                                        </th>
                                        <th className="py-2.5 text-center font-bold uppercase text-[11px] tracking-wider w-[22%]">
                                            TRẠNG THÁI
                                        </th>
                                        <th className="py-2.5 text-right font-bold uppercase text-[11px] tracking-wider w-[15%]">
                                            ĐƠN GIÁ
                                        </th>
                                        <th className="py-2.5 text-center font-bold uppercase text-[11px] tracking-wider w-[10%]">
                                            SỐ LƯỢNG
                                        </th>
                                        <th className="py-2.5 text-right font-bold uppercase text-[11px] tracking-wider w-[15%]">
                                            THÀNH TIỀN
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isGroupMaster && Array.isArray(booking.sub_bookings) && booking.sub_bookings.length > 0 ? (
                                        booking.sub_bookings.map((sub, idx) => {
                                            const subRoomNum = sub.room?.room_number || sub.room_number;
                                            const subCatName = sub.category?.name || sub.room_name || 'Phòng tiêu chuẩn';
                                            const subGuest = sub.guest_name || sub.customer_name || 'Theo danh sách đoàn';
                                            const subNights = Math.max(1, Number(sub.nights || nights));
                                            const subRoomCharge = Number(sub.room_charge != null ? sub.room_charge : (sub.room_amount || 0));
                                            const subTotal = isGroupAllInclusive 
                                                ? (subRoomCharge > 0 ? subRoomCharge : (Number(sub.daily_rate || 0) * subNights))
                                                : Number(sub.total_amount || sub.room_amount || 0);
                                            const subPricePerNight = Number(sub.daily_rate || (subNights > 0 && subTotal > 0 ? Math.round(subTotal / subNights) : subTotal));

                                            return (
                                                <tr key={sub.id || idx} className="border-b border-slate-200">
                                                    <td className="py-3 text-left">
                                                        <div className="font-bold text-slate-900 text-xs">
                                                            {subRoomNum ? `Phòng ${subRoomNum}` : `Phòng ${idx + 1}`} - {subCatName}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                                            Mã: #{sub.booking_code} | Khách ở: {subGuest} ({subNights} đêm x {formatCurrency(subPricePerNight)})
                                                        </div>
                                                    </td>
                                                    <td className="py-3 text-center">
                                                        {isCompleted ? (
                                                            <span className="inline-block text-[10.5px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 print:border-none print:bg-transparent print:shadow-none print:p-0 print:text-black">
                                                                ✓ Đã quyết toán
                                                            </span>
                                                        ) : (
                                                            <span className="inline-block text-[10.5px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 print:border-none print:bg-transparent print:shadow-none print:p-0 print:text-black">
                                                                Bảo lãnh theo HĐ đoàn
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 text-right text-slate-800 font-medium">
                                                        {formatCurrency(subPricePerNight)}
                                                    </td>
                                                    <td className="py-3 text-center text-slate-800 font-medium">
                                                        {subNights} đêm
                                                    </td>
                                                    <td className="py-3 text-right font-bold text-slate-900">
                                                        {formatCurrency(subTotal)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr className="border-b border-slate-200">
                                            <td className="py-3 text-left">
                                                <div className="font-bold text-slate-900 text-xs">
                                                    {isGroupMaster ? `Hợp đồng đoàn: ${booking.group_name || booking.room_name || 'Khách đoàn'}` : 'Tiền phòng nghỉ - Room Charge'}
                                                </div>
                                                <div className="text-[11px] text-slate-500 mt-0.5">
                                                    {isGroupMaster 
                                                        ? `Gói lưu trú đoàn ${booking.total_rooms || 1} phòng (${nights} đêm)`
                                                        : `${(booking.room_number || booking.room?.room_number) ? `Phòng ${booking.room_number || booking.room?.room_number}` : (booking.room_name || booking.category?.name || 'Phòng tiêu chuẩn')} (${nights} đêm x ${formatCurrency(pricePerNight)})`
                                                    }
                                                </div>
                                            </td>
                                            <td className="py-3 text-center">
                                                {isCancelled ? (
                                                    <span className="inline-block text-[10.5px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 print:border-none print:bg-transparent print:shadow-none print:p-0 print:text-black">
                                                        ✕ Đơn đã hủy
                                                    </span>
                                                ) : isCompleted ? (
                                                    <span className="inline-block text-[10.5px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 print:border-none print:bg-transparent print:shadow-none print:p-0 print:text-black">
                                                        ✓ Đã quyết toán
                                                    </span>
                                                ) : isGroupRoom ? (
                                                    <span className="inline-block text-[10.5px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 print:border-none print:bg-transparent print:shadow-none print:p-0 print:text-black" title="Chi phí tính vào Hóa đơn đoàn">
                                                         Gộp HĐ đoàn #{booking.group_booking_code || ''}
                                                    </span>
                                                ) : isRoomPaid ? (
                                                    <span className="inline-block text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 print:border-none print:bg-transparent print:shadow-none print:p-0 print:text-black">
                                                        ✓ {getPaidMethodLabel()}
                                                    </span>
                                                ) : (
                                                    <span className="inline-block text-[10.5px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 print:border-none print:bg-transparent print:shadow-none print:p-0 print:text-black">
                                                        Chưa thanh toán
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 text-right text-slate-800 font-medium">
                                                {formatCurrency(pricePerNight)}
                                            </td>
                                            <td className="py-3 text-center text-slate-800 font-medium">
                                                {nights} đêm
                                            </td>
                                            <td className="py-3 text-right font-bold text-slate-900">
                                                {formatCurrency(roomSubtotal)}
                                            </td>
                                        </tr>
                                    )}

                                    {/* CÁC DÒNG DỊCH VỤ PHÁT SINH / GỌI MÓN TẠI PHÒNG */}
                                    {extraServices.length === 0 && extraServicesTotal > 0 && (
                                        <tr className="border-b border-slate-200">
                                            <td className="py-2.5 text-left">
                                                <div className="font-bold text-slate-900 text-xs">
                                                    Dịch vụ phát sinh & Tiện ích tại phòng
                                                </div>
                                                <div className="text-[10px] text-slate-500">
                                                    Phí dịch vụ ghi nhận theo hóa đơn
                                                </div>
                                            </td>
                                            <td className="py-2.5 text-center">
                                                <span className="inline-block text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 print:border-none print:bg-transparent print:shadow-none print:p-0 print:text-black">
                                                    Chưa thanh toán (Thu khi Check-out)
                                                </span>
                                            </td>
                                            <td className="py-2.5 text-right text-slate-800 font-medium">
                                                {formatCurrency(extraServicesTotal)}
                                            </td>
                                            <td className="py-2.5 text-center text-slate-800 font-medium">
                                                1
                                            </td>
                                            <td className="py-2.5 text-right font-bold text-slate-900">
                                                {formatCurrency(extraServicesTotal)}
                                            </td>
                                        </tr>
                                    )}

                                    {extraServices.map((service, idx) => {
                                        const cleanName = (service.service_name || '')
                                            .replace(/\[Yêu cầu #\d+\]/gi, '')
                                            .replace(/\(x\d+\)/gi, '')
                                            .trim();
                                        const isDamageCompensation = cleanName.toLowerCase().includes('bồi thường');
                                        const isTimeSurcharge = cleanName.toLowerCase().includes('phụ thu') || cleanName.toLowerCase().includes('sớm') || cleanName.toLowerCase().includes('muộn');
                                        const serviceIsPaid = Boolean(
                                            service.is_paid || 
                                            (booking.status === 'completed' && booking.invoice?.status === 'paid')
                                        );
                                        return (
                                            <tr key={service.id || idx} className={`border-b border-slate-200 ${isDamageCompensation ? 'bg-rose-50/20 print:bg-transparent' : ''}`}>
                                                <td className="py-2.5 text-left">
                                                    <div className={`font-bold text-xs ${isDamageCompensation ? 'text-rose-900 flex items-center gap-1.5' : 'text-slate-900'}`}>
                                                        {isDamageCompensation && <span className="text-rose-600"></span>}
                                                        <span>{cleanName}</span>
                                                    </div>
                                                    <div className={`text-[10px] ${isDamageCompensation ? 'text-rose-600 font-medium' : isTimeSurcharge ? 'text-amber-700 font-medium print:text-slate-600' : 'text-slate-500'}`}>
                                                        {isGroupMaster 
                                                            ? `Phục vụ ${service.room_number ? (String(service.room_number).startsWith('Phòng') ? service.room_number : `Phòng ${service.room_number}`) : ''} (Mã #${service.sub_booking_code || ''}) • Gộp vào HĐ đoàn`
                                                            : (isDamageCompensation 
                                                                ? 'Bồi thường thiệt hại / hư hỏng thiết bị phòng' 
                                                                : isTimeSurcharge 
                                                                ? 'Phụ thu quy định thời gian nhận / trả phòng khách sạn' 
                                                                : 'Dịch vụ phát sinh / Gọi món tại phòng')
                                                        }
                                                    </div>
                                                </td>
                                                <td className="py-2.5 text-center">
                                                    {serviceIsPaid || isCompleted ? (
                                                        <span className="inline-block text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 print:border-none print:bg-transparent print:shadow-none print:p-0 print:text-black">
                                                            {isGroupMaster ? '✓ Đã quyết toán' : `✓ ${getPaidMethodLabel()}`}
                                                        </span>
                                                    ) : (
                                                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border print:border-none print:bg-transparent print:shadow-none print:p-0 print:text-black ${
                                                            isGroupMaster 
                                                                ? 'text-indigo-700 bg-indigo-50 border-indigo-200' 
                                                                : isDamageCompensation 
                                                                ? 'text-rose-700 bg-rose-50 border-rose-200' 
                                                                : 'text-amber-700 bg-amber-50 border-amber-200'
                                                        }`}>
                                                            {isGroupMaster ? 'Gộp HĐ đoàn (Master-Billing)' : (isDamageCompensation ? 'Chưa thanh toán (Thu bồi thường)' : 'Chưa thanh toán (Thu khi Check-out)')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 text-right text-slate-800 font-medium">
                                                    {formatCurrency(service.price)}
                                                </td>
                                                <td className="py-2.5 text-center text-slate-800 font-medium">
                                                    {service.quantity}
                                                </td>
                                                <td className="py-2.5 text-right font-bold text-slate-900">
                                                    {formatCurrency(service.total_price || (service.price * service.quantity))}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 4. KHỐI TỔNG KẾT TIỀN & YÊU CẦU ĐẶC BIỆT */}
                    <div className="mt-4 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                        {/* Cột trái: Yêu cầu đặc biệt của khách */}
                        <div className="pt-2 text-slate-600">
                            <span className="font-bold text-slate-900 italic">Yêu cầu đặc biệt: </span>
                            <span className="italic">"{getSpecialRequest()}"</span>
                        </div>

                        {/* Cột phải: Các dòng cộng tiền, khấu trừ giảm giá, tạm tính, tổng cộng */}
                        <div className="space-y-2 text-right">
                            <div className="flex justify-between sm:justify-end gap-6 text-slate-700">
                                <span className="text-slate-500">Cộng tiền phòng:</span>
                                <span className="font-medium text-slate-900 w-28 text-right">
                                    {formatCurrency(roomSubtotal)}
                                </span>
                            </div>

                            {/* Khấu trừ mã khuyến mãi (nếu có) */}
                            {promoDiscount > 0 && (
                                <div className="flex justify-between sm:justify-end gap-6 text-slate-700">
                                    <span className="text-slate-500">
                                        Khấu trừ khuyến mãi ({booking.promotion_code || 'ƯU ĐÃI'}):
                                    </span>
                                    <span className="font-medium text-slate-900 w-28 text-right">
                                        -{formatCurrency(promoDiscount)}
                                    </span>
                                </div>
                            )}

                            {/* Ưu đãi Hạng thành viên (nếu có) */}
                            {membershipDiscount > 0 && (
                                <div className="flex justify-between sm:justify-end gap-6 text-slate-700">
                                    <span className="text-slate-500">
                                        Ưu đãi hạng thành viên ({tierName}):
                                    </span>
                                    <span className="font-medium text-slate-900 w-28 text-right">
                                        -{formatCurrency(membershipDiscount)}
                                    </span>
                                </div>
                            )}

                            {/* Trường hợp có chiết khấu nhưng không phân tách được */}
                            {promoDiscount === 0 && membershipDiscount === 0 && totalDiscount > 0 && (
                                <div className="flex justify-between sm:justify-end gap-6 text-slate-700">
                                    <span className="text-slate-500">
                                        Khấu trừ giảm giá ({booking.promotion_code || 'ƯU ĐÃI'}):
                                    </span>
                                    <span className="font-medium text-slate-900 w-28 text-right">
                                        -{formatCurrency(totalDiscount)}
                                    </span>
                                </div>
                            )}

                            <div className="flex justify-between sm:justify-end gap-6 text-slate-700">
                                <span className="text-slate-500">Tiền phòng sau ưu đãi:</span>
                                <span className="font-medium text-slate-900 w-28 text-right">
                                    {formatCurrency(roomAmount)}
                                </span>
                            </div>

                            {extraServicesTotal > 0 && (
                                <div className="flex justify-between sm:justify-end gap-6 text-slate-700 font-semibold">
                                    <span>
                                        {isGroupMaster 
                                            ? `Dịch vụ phát sinh tại các phòng (Công ty chi trả toàn bộ${extraServices.length > 0 ? ` - ${extraServices.length} món` : ''}):`
                                            : `Dịch vụ phát sinh${extraServices.length > 0 ? ` (${extraServices.length} món)` : ''}:`
                                        }
                                    </span>
                                    <span className="w-28 text-right text-slate-900">
                                        +{formatCurrency(extraServicesTotal)}
                                    </span>
                                </div>
                            )}

                            {isGroupMaster && !isGroupAllInclusive && groupSubServicesTotal > 0 && (
                                <div className="flex justify-between sm:justify-end gap-6 text-slate-500 italic text-[11px]">
                                    <span>* Dịch vụ phát sinh ({groupSubExtraServices.length} món): Khách tự thanh toán tại quầy lẻ khi trả phòng</span>
                                    <span className="w-28 text-right font-medium">({formatCurrency(groupSubServicesTotal)})</span>
                                </div>
                            )}

                            <div className="pt-2 border-t border-slate-300 flex justify-between sm:justify-end items-baseline gap-6">
                                <span className="font-bold text-xs text-slate-800 uppercase">
                                    {isGroupMaster && extraServicesTotal > 0 ? 'Tổng hợp đồng (Phòng & Dịch vụ):' : 'Tổng giá trị phòng & dịch vụ:'}
                                </span>
                                <span className="font-bold text-sm text-slate-900 w-36 text-right">
                                    {formatCurrency(grandTotal)}
                                </span>
                            </div>

                            {isGroupMaster ? (
                                <>
                                    <div className="flex justify-between sm:justify-end gap-6 text-slate-700">
                                        <span className="text-slate-500">Tổng giá trị hợp đồng ({booking.total_rooms || booking.sub_bookings?.length || 1} phòng):</span>
                                        <span className="font-bold text-slate-900 w-36 text-right">
                                            {formatCurrency(grandTotal)}
                                        </span>
                                    </div>
                                    {Number(booking.deposit_amount) > 0 && (
                                        <div className="flex justify-between sm:justify-end gap-6 text-emerald-700 font-semibold text-[11px]">
                                            <span>✓ Tiền cọc đã thanh toán ({booking.is_deposit_paid || isCompleted ? 'Đã nhận' : 'Chờ xác nhận'}):</span>
                                            <span className="w-36 text-right font-bold">
                                                -{formatCurrency(booking.deposit_amount)}
                                            </span>
                                        </div>
                                    )}
                                    {isCompleted && (
                                        <div className="flex justify-between sm:justify-end gap-6 text-purple-700 font-semibold text-[11px]">
                                            <span>✓ Quyết toán thanh toán đợt cuối khi check-out:</span>
                                            <span className="w-36 text-right font-bold">
                                                -{formatCurrency(Math.max(0, grandTotal - Number(booking.deposit_amount || 0)))}
                                            </span>
                                        </div>
                                    )}
                                    <div className="pt-2 border-t-2 border-slate-900 flex justify-between sm:justify-end items-baseline gap-6">
                                        <div>
                                            <span className="font-black text-xs sm:text-sm text-slate-900 uppercase block">
                                                {isCompleted ? 'Trạng thái thanh toán:' : 'Còn lại cần quyết toán:'}
                                            </span>
                                            <span className="text-[10px] text-slate-500 italic block font-normal">
                                                {isCompleted ? '(Hợp đồng đã quyết toán toàn bộ 100%)' : '(Thu khi đoàn trả phòng / thanh lý HĐ)'}
                                            </span>
                                        </div>
                                        <span className="font-black text-base sm:text-lg text-slate-900 w-36 text-right">
                                            {isCompleted ? '0đ (Đã thanh toán 100%)' : formatCurrency(balanceDue)}
                                        </span>
                                    </div>
                                </>
                            ) : isGroupRoom ? (
                                <>
                                    <div className="flex justify-between sm:justify-end gap-6 text-indigo-700 font-semibold text-[11px] bg-indigo-50/60 p-1.5 rounded border border-indigo-100">
                                        <span>{isCompanyAllInclusive ? ` Chuyển thanh toán TOÀN BỘ (Phòng & Dịch vụ) vào Hóa đơn đoàn #${booking.group_booking_code || ''}:` : ` Chuyển thanh toán vào Hóa đơn đoàn #${booking.group_booking_code || ''}:`}</span>
                                        <span className="w-36 text-right font-bold text-indigo-800">
                                            -{formatCurrency(isCompanyAllInclusive ? (roomAmount + extraServicesTotal) : roomAmount)}
                                        </span>
                                    </div>
                                    {completedPayments.length > 1 ? (
                                        completedPayments.map((p, idx) => (
                                            <div key={p.id || idx} className="flex justify-between sm:justify-end gap-6 text-emerald-700 font-semibold text-[11px]">
                                                <span>{getPaymentTrancheLabel(p, idx)}</span>
                                                <span className="w-36 text-right font-bold">
                                                    -{formatCurrency(p.amount)}
                                                </span>
                                            </div>
                                        ))
                                    ) : paidAmount > 0 ? (
                                        <div className="flex justify-between sm:justify-end gap-6 text-emerald-700 font-semibold text-[11px]">
                                            <span>{getPaidAdvanceLabel()}</span>
                                            <span className="w-36 text-right font-bold">
                                                -{formatCurrency(paidAmount)}
                                            </span>
                                        </div>
                                    ) : null}
                                    <div className="pt-2 border-t-2 border-slate-900 flex justify-between sm:justify-end items-baseline gap-6">
                                        <div>
                                            <span className="font-black text-xs sm:text-sm text-slate-900 uppercase block">
                                                Thực thu khách tại quầy:
                                            </span>
                                            <span className="text-[10px] text-slate-500 italic block font-normal">
                                                {isCompanyAllInclusive ? '(Công ty chi trả toàn bộ phòng & dịch vụ)' : '(Tiền phòng quyết toán tập trung qua HĐ đoàn)'}
                                            </span>
                                        </div>
                                        <span className="font-black text-base sm:text-lg text-slate-900 w-36 text-right">
                                            {formatCurrency(isCompleted ? 0 : balanceDue)}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {completedPayments.length > 1 ? (
                                        completedPayments.map((p, idx) => (
                                            <div key={p.id || idx} className="flex justify-between sm:justify-end gap-6 text-emerald-700 font-semibold text-[11px]">
                                                <span>{getPaymentTrancheLabel(p, idx)}</span>
                                                <span className="w-36 text-right font-bold">
                                                    -{formatCurrency(p.amount)}
                                                </span>
                                            </div>
                                        ))
                                    ) : paidAmount > 0 ? (
                                        <div className="flex justify-between sm:justify-end gap-6 text-emerald-700 font-semibold text-[11px]">
                                            <span>{getPaidAdvanceLabel()}</span>
                                            <span className="w-36 text-right font-bold">
                                                -{formatCurrency(paidAmount)}
                                            </span>
                                        </div>
                                    ) : null}

                                    <div className="pt-2 border-t-2 border-slate-900 flex justify-between sm:justify-end items-baseline gap-6">
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-xs sm:text-sm text-slate-900 uppercase">
                                                {isCompleted ? 'Còn lại cần thu:' : (paidAmount > 0 ? 'Thực thu khi trả phòng:' : 'Tổng thanh toán:')}
                                            </span>
                                            {isCompleted && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                    ✓ ĐÃ THANH TOÁN ĐỦ (100%)
                                                </span>
                                            )}
                                        </div>
                                        <span className={`font-black text-base sm:text-lg w-36 text-right ${isCompleted ? 'text-emerald-700' : 'text-slate-900'}`}>
                                            {formatCurrency(isCompleted ? 0 : (paidAmount > 0 ? balanceDue : grandTotal))}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* 5. KHỐI CHỮ KÝ: KHÁCH HÀNG KÝ NHẬN & ĐẠI DIỆN KHÁCH SẠN */}
                    <div className="mt-14 pt-4 grid grid-cols-2 gap-8 text-center text-xs">
                        <div>
                            <p className="font-bold text-slate-900">
                                {isGroupMaster 
                                    ? 'Đại diện Doanh nghiệp / Trưởng đoàn' 
                                    : (booking.customer_type === 'CORPORATE' ? 'Đại diện Doanh nghiệp / Khách ký nhận' : 'Khách hàng ký nhận')}
                            </p>
                            <p className="text-[11px] text-slate-500 italic mt-0.5">
                                {isGroupMaster || booking.customer_type === 'CORPORATE' ? '(Ký, ghi rõ họ tên & đóng dấu)' : '(Ký, ghi rõ họ tên)'}
                            </p>
                            <div className="h-20 sm:h-24"></div>
                            <p className="font-semibold text-slate-800 text-xs">
                                {booking.guest_name || booking.leader_name || ''}
                            </p>
                        </div>

                        <div>
                            <p className="font-bold text-slate-900">
                                Đại diện khách sạn
                            </p>
                            <p className="text-[11px] text-slate-500 italic mt-0.5">
                                (Ký, ghi rõ họ tên)
                            </p>
                            <div className="h-20 sm:h-24"></div>
                            <p className="font-semibold text-slate-800 text-xs">
                                Lễ tân Khách Sạn TA Đà Nẵng
                            </p>
                        </div>
                    </div>
                </div>
            </div>

                {/* FOOTER NÚT THAO TÁC Ở ĐÁY MODAL (Ẩn khi in) */}
                <div className="no-print bg-slate-50 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs text-slate-500">
                    <div className="hidden sm:block">
                        <span>💡 Lưu ý: Trình duyệt hỗ trợ chọn <strong>"Save as PDF"</strong> (Lưu thành tệp PDF) hoặc in ra máy in A4 tiêu chuẩn.</span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg transition cursor-pointer text-center"
                        >
                            Đóng cửa sổ
                        </button>
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="flex-1 sm:flex-none px-5 py-2.5 sm:py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            <span>In hóa đơn ngay</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
