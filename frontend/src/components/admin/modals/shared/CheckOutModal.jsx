import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Receipt,
    CheckCircle2,
    AlertTriangle,
    X,
    Printer,
    Clock,
    Building2,
    User,
    Phone,
    BedDouble,
    DoorOpen,
    Moon,
    BellRing,
    Zap,
    RotateCw,
    Wine,
    Wrench,
    MessageSquare,
    Info,
    Trash2,
    Tag,
    Sparkles,
    UtensilsCrossed,
    Package,
    Gift,
    Car,
    Check,
    CreditCard,
    QrCode,
    Banknote,
    FileText,
    Lock
} from 'lucide-react';
import { bookingService } from '../../../../services/bookingService';
import { paymentService } from '../../../../services/paymentService';
import hotelService from '../../../../services/hotelService';
import roomService from '../../../../services/roomService';
import api from '../../../../services/api';

// Helper render icon cho confirm modal thông báo
const renderConfirmIcon = (icon, type) => {
    if (React.isValidElement(icon)) return icon;
    if (icon === 'zap') return <Zap className="w-7 h-7 text-amber-500" />;
    if (icon === 'trash') return <Trash2 className="w-7 h-7 text-rose-500" />;
    if (icon === 'check') return <CheckCircle2 className="w-7 h-7 text-emerald-500" />;
    if (icon === 'warning') return <AlertTriangle className="w-7 h-7 text-amber-500" />;
    if (type === 'rose') return <AlertTriangle className="w-7 h-7 text-rose-500" />;
    if (type === 'emerald') return <CheckCircle2 className="w-7 h-7 text-emerald-500" />;
    return <AlertTriangle className="w-7 h-7 text-amber-500" />;
};

// Helper format tiền tệ VNĐ
const formatCurrency = (amount) => {
    const num = Number(amount) || 0;
    return `${num.toLocaleString('vi-VN')}đ`;
};

// Helper format ngày giờ
const formatDateTime = (isoStr) => {
    if (!isoStr) return '—';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `${time} • ${date}`;
    } catch {
        return isoStr;
    }
};

// Helper format ngày ngắn
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

export default function CheckOutModal({ booking, onClose, onSuccess, onOpenInvoice }) {
    const [summary, setSummary] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Form thanh toán & Ghi chú
    const [checkoutNote, setCheckoutNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [completedInvoice, setCompletedInvoice] = useState(null);

    // Hóa đơn Giá trị gia tăng (VAT) Doanh nghiệp
    const [isCompanyInvoice, setIsCompanyInvoice] = useState(false);
    const [companyName, setCompanyName] = useState('');
    const [companyTaxCode, setCompanyTaxCode] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [invoiceRecipientEmail, setInvoiceRecipientEmail] = useState('');

    // Trạng thái xử lý thanh toán phần nợ remaining_balance
    const [isProcessingDebtPayment, setIsProcessingDebtPayment] = useState(false);
    const [isDebtPaid, setIsDebtPaid] = useState(false); // Đã giải quyết xong phần nợ chưa
    const [paymentMethod, setPaymentMethod] = useState('bank_transfer'); // 'bank_transfer' | 'cash'

    // Xử lý các dịch vụ chưa hoàn tất phục vụ (pending, in_progress, delivering)
    const [serviceActionLoading, setServiceActionLoading] = useState(null); // id of request or 'bulk'
    const [serviceActionMsg, setServiceActionMsg] = useState(null); // { type, text }

    // =========================================================================
    // QUY TRÌNH KIỂM PHÒNG CHECK-OUT (MINIBAR & HƯ HẠI TÀI SẢN)
    // =========================================================================
    const [inspectionStatus, setInspectionStatus] = useState('none'); // 'none' | 'requested' | 'completed'
    const [inspectionData, setInspectionData] = useState(null);
    const [isRequestingInspection, setIsRequestingInspection] = useState(false);
    const [inspectionFeedback, setInspectionFeedback] = useState(null);
    const [inspectionNote, setInspectionNote] = useState('');

    // Modal thông báo xác nhận màu trắng giữa màn hình (thay thế window.confirm mặc định)
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        bullets: [],
        detail: '',
        confirmText: 'Xác nhận',
        cancelText: 'Huỷ',
        confirmType: 'amber', // 'amber' | 'emerald' | 'rose' | 'indigo'
        icon: 'zap',
        onConfirm: null
    });

    const showConfirm = ({
        title,
        message = '',
        bullets = [],
        detail = '',
        confirmText = 'Xác nhận',
        cancelText = 'Huỷ',
        confirmType = 'amber',
        icon = 'zap',
        onConfirm
    }) => {
        setConfirmDialog({
            isOpen: true,
            title,
            message,
            bullets,
            detail,
            confirmText,
            cancelText,
            confirmType,
            icon,
            onConfirm
        });
    };

    const closeConfirm = () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false, onConfirm: null }));
    };

    // Cấu hình ngân hàng VietQR động
    const [bankConfig, setBankConfig] = useState({
        bank_bin: '970422',
        account_no: '0344997778',
        account_name: 'KHACH SAN TA DA NANG'
    });

    // Cấu hình khách sạn & phụ thu động từ Cài đặt hệ thống
    const [hotelSettings, setHotelSettings] = useState({
        check_out_time: '12:00',
        late_checkout_12pm_3pm: 30,
        late_checkout_3pm_6pm: 50,
        late_checkout_after_6pm: 100
    });
    const [applyLateSurcharge, setApplyLateSurcharge] = useState(true);

    // Hàm refresh lại bảng kê sau khi thao tác dịch vụ hoặc buồng phòng hoàn thành kiểm tra
    const refreshSummary = useCallback(async () => {
        if (!booking?.id) return;
        try {
            const res = await bookingService.getBookingSummary(booking.id);
            if (res?.success && res?.data) {
                setSummary(res.data);
            } else if (res?.data) {
                setSummary(res.data);
            }
        } catch (err) {
            console.error('Lỗi khi cập nhật lại bảng kê Folio:', err);
        }
    }, [booking?.id]);

    // Lấy thông tin trạng thái kiểm tra phòng gần nhất
    const fetchInspectionStatus = useCallback(async () => {
        const rId = booking?.room || booking?.room_id || summary?.room_id;
        if (!rId && !booking?.id) return;
        try {
            const res = await roomService.getLatestInspection({
                room_id: rId,
                booking_id: booking?.id
            });
            if (res.success && res.check) {
                setInspectionData(res.check);
                setInspectionStatus(res.check.status || 'none');
            } else {
                setInspectionData(null);
                setInspectionStatus('none');
            }
        } catch (err) {
            console.error('Lỗi khi tải thông tin kiểm phòng:', err);
        }
    }, [booking?.id, booking?.room, booking?.room_id, summary?.room_id]);

    // Gửi yêu cầu Buồng phòng kiểm tra phòng Check-out
    const handleRequestInspection = async () => {
        const rId = booking?.room || booking?.room_id || summary?.room_id;
        if (!rId) {
            alert('Không tìm thấy thông tin số phòng để gửi yêu cầu kiểm tra.');
            return;
        }

        try {
            setIsRequestingInspection(true);
            setInspectionFeedback(null);
            const res = await roomService.requestRoomInspection({
                room_id: rId,
                booking_id: booking?.id,
                note: inspectionNote.trim() || 'Lễ tân yêu cầu kiểm phòng Check-out (Minibar & Hư hại)'
            });

            if (res.success) {
                setInspectionStatus('requested');
                setInspectionData(res.data);
                setInspectionFeedback({
                    type: 'success',
                    message: 'Đã gửi thông báo yêu cầu kiểm phòng đến bộ phận Buồng phòng!'
                });

                // Phát tín hiệu đồng bộ realtime sang RoomManagement & các tab khác
                try {
                    localStorage.setItem('pms_last_minibar_event', Date.now().toString());
                    window.dispatchEvent(new Event('pms_minibar_updated'));
                    window.dispatchEvent(new Event('pms_room_updated'));
                } catch { }

                setTimeout(() => setInspectionFeedback(null), 4000);
            } else {
                alert(res.message || 'Không thể gửi yêu cầu kiểm phòng.');
            }
        } catch (err) {
            console.error('Lỗi khi gửi yêu cầu kiểm phòng:', err);
            alert('Đã xảy ra lỗi kết nối khi gửi yêu cầu kiểm phòng.');
        } finally {
            setIsRequestingInspection(false);
        }
    };

    // Lễ tân xác nhận kiểm tra nhanh tại quầy (trường hợp khách vội, xác nhận không dùng và không hư hại)
    const handleQuickSelfInspection = () => {
        const rId = booking?.room || booking?.room_id || summary?.room_id;
        if (!rId) {
            alert('Không tìm thấy thông tin phòng.');
            return;
        }

        showConfirm({
            title: 'Xác nhận kiểm tra nhanh tại quầy',
            icon: 'zap',
            confirmType: 'amber',
            confirmText: 'Xác nhận hoàn tất',
            cancelText: 'Huỷ',
            bullets: [
                'Khách không sử dụng đồ ăn/uống trong Minibar.',
                'Trang thiết bị phòng nguyên vẹn, không có hư hại.'
            ],
            detail: 'Bạn có muốn ghi nhận hoàn tất kiểm phòng ngay?',
            onConfirm: async () => {
                closeConfirm();
                try {
                    setIsRequestingInspection(true);
                    const res = await roomService.createMinibarCheck({
                        room_id: rId,
                        booking_id: booking?.id,
                        items_consumed: [],
                        has_damage: false,
                        damage_amount: 0,
                        note: 'Lễ tân xác nhận kiểm nhanh tại quầy (Phòng nguyên vẹn & Không tiêu thụ Minibar)'
                    });

                    if (res.success) {
                        setInspectionStatus('completed');
                        setInspectionData(res.data);
                        setInspectionFeedback({
                            type: 'success',
                            message: 'Đã xác nhận phòng nguyên vẹn và hoàn tất kiểm phòng!'
                        });
                        await refreshSummary();

                        try {
                            localStorage.setItem('pms_last_minibar_event', Date.now().toString());
                            window.dispatchEvent(new Event('pms_minibar_updated'));
                            window.dispatchEvent(new Event('pms_room_updated'));
                        } catch { }

                        setTimeout(() => setInspectionFeedback(null), 4000);
                    } else {
                        alert(res.message || 'Không thể ghi nhận kiểm phòng.');
                    }
                } catch (err) {
                    console.error('Lỗi kiểm nhanh tại quầy:', err);
                    alert('Đã xảy ra lỗi khi kết nối máy chủ.');
                } finally {
                    setIsRequestingInspection(false);
                }
            }
        });
    };

    // 1. TẢI BẢNG KÊ CHI TIẾT TỪ BACKEND
    useEffect(() => {
        if (!booking?.id) return;

        let isMounted = true;
        const fetchSummaryAndConfig = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const [summaryRes, configRes, hotelRes] = await Promise.allSettled([
                    bookingService.getBookingSummary(booking.id),
                    api.get('/payments/config/'),
                    api.get('/hotel-settings/')
                ]);

                if (isMounted) {
                    if (summaryRes.status === 'fulfilled' && summaryRes.value?.success && summaryRes.value?.data) {
                        setSummary(summaryRes.value.data);
                    } else if (summaryRes.status === 'fulfilled' && summaryRes.value?.data) {
                        setSummary(summaryRes.value.data);
                    } else {
                        setError('Không thể tải bảng kê chi tiết thanh toán từ hệ thống.');
                    }

                    if (configRes.status === 'fulfilled') {
                        const cData = configRes.value.data?.data || configRes.value.data;
                        if (cData?.bank_bin) {
                            setBankConfig({
                                bank_bin: cData.bank_bin,
                                account_no: cData.account_no,
                                account_name: (cData.account_name || '').toUpperCase()
                            });
                        }
                    }

                    if (hotelRes.status === 'fulfilled') {
                        const hData = hotelRes.value.data?.data || hotelRes.value.data;
                        if (hData) {
                            setHotelSettings(prev => ({
                                ...prev,
                                check_out_time: hData.check_out_time || prev.check_out_time,
                                late_checkout_12pm_3pm: hData.late_checkout_12pm_3pm !== undefined && hData.late_checkout_12pm_3pm !== null ? Number(hData.late_checkout_12pm_3pm) : 30,
                                late_checkout_3pm_6pm: hData.late_checkout_3pm_6pm !== undefined && hData.late_checkout_3pm_6pm !== null ? Number(hData.late_checkout_3pm_6pm) : 50,
                                late_checkout_after_6pm: hData.late_checkout_after_6pm !== undefined && hData.late_checkout_after_6pm !== null ? Number(hData.late_checkout_after_6pm) : 100
                            }));
                        }
                    }
                }
            } catch (err) {
                if (isMounted) {
                    setError('Lỗi kết nối máy chủ khi lấy bảng kê thanh toán.');
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchSummaryAndConfig();
        fetchInspectionStatus();

        return () => {
            isMounted = false;
        };
    }, [booking?.id, fetchInspectionStatus]);

    // Lắng nghe sự kiện buồng phòng kiểm tra xong (Realtime / Cross-tab synchronization)
    useEffect(() => {
        const handleSyncInspection = () => {
            fetchInspectionStatus();
            refreshSummary();
        };
        window.addEventListener('pms_minibar_updated', handleSyncInspection);
        window.addEventListener('pms_room_updated', handleSyncInspection);
        window.addEventListener('storage', handleSyncInspection);
        return () => {
            window.removeEventListener('pms_minibar_updated', handleSyncInspection);
            window.removeEventListener('pms_room_updated', handleSyncInspection);
            window.removeEventListener('storage', handleSyncInspection);
        };
    }, [fetchInspectionStatus, refreshSummary]);

    // Danh sách các dịch vụ chưa hoàn thành (chờ xử lý hoặc đang thực hiện)
    const uncompletedServices = useMemo(() => {
        return (summary?.extra_services || []).filter(
            (s) => s.source === 'service_request' && ['pending', 'in_progress', 'delivering'].includes(s.status)
        );
    }, [summary]);

    // Chuẩn hóa và tối ưu danh sách dịch vụ phát sinh hiển thị trên Bảng kê Folio
    // Gom gọn các lượt dọn phòng Make-up Room miễn phí (0đ) đã hoàn tất để tránh làm rối bảng kê tính tiền
    const displayExtraServices = useMemo(() => {
        const rawList = summary?.extra_services || [];
        if (!rawList.length) return [];

        const result = [];
        const cleaningCompletedGroup = [];

        rawList.forEach((svc) => {
            const isCleaning = (svc.service_name || '').toLowerCase().includes('make-up') || (svc.service_name || '').toLowerCase().includes('dọn dẹp');
            const isZeroPrice = Number(svc.price || 0) === 0 && Number(svc.total_price || 0) === 0;

            // Nếu là dọn phòng lưu trú miễn phí đã hoàn tất: gom lại
            if (isCleaning && isZeroPrice && svc.status === 'completed') {
                cleaningCompletedGroup.push(svc);
            } else {
                result.push(svc);
            }
        });

        if (cleaningCompletedGroup.length > 0) {
            if (cleaningCompletedGroup.length === 1) {
                result.push(cleaningCompletedGroup[0]);
            } else {
                const first = cleaningCompletedGroup[0];
                result.push({
                    ...first,
                    id: 'grouped_cleaning',
                    service_name: `Dọn dẹp phòng lưu trú (Make-up Room) — ${cleaningCompletedGroup.length} lượt`,
                    quantity: cleaningCompletedGroup.length,
                    price: 0,
                    total_price: 0,
                    is_grouped: true,
                    grouped_items: cleaningCompletedGroup,
                    created_at: cleaningCompletedGroup[cleaningCompletedGroup.length - 1].created_at
                });
            }
        }

        return result;
    }, [summary?.extra_services]);

    const executeServiceStatusUpdate = async (requestId, serviceItem, newStatus) => {
        try {
            setServiceActionLoading(requestId);
            setServiceActionMsg(null);

            const res = await hotelService.updateServiceRequestStatus(
                requestId,
                newStatus,
                newStatus === 'cancelled'
                    ? 'Hủy tại bước Check-out do khách không sử dụng'
                    : 'Xác nhận hoàn thành tại bước Check-out'
            );

            if (res.success) {
                setServiceActionMsg({
                    type: newStatus === 'cancelled' ? 'info' : 'success',
                    text: newStatus === 'cancelled'
                        ? `Đã hủy dịch vụ "${serviceItem.service_name}" và trừ ${formatCurrency(serviceItem.total_price)} khỏi hóa đơn!`
                        : `Đã xác nhận dịch vụ "${serviceItem.service_name}" hoàn tất phục vụ!`
                });

                // Cập nhật lại summary và số tiền
                await refreshSummary();

                // Tự tắt thông báo sau 4 giây
                setTimeout(() => {
                    setServiceActionMsg(null);
                }, 4000);
            } else {
                alert(res.message || 'Không thể cập nhật trạng thái dịch vụ. Vui lòng thử lại.');
            }
        } catch (err) {
            console.error('Lỗi khi cập nhật dịch vụ:', err);
            alert('Đã xảy ra lỗi khi kết nối máy chủ để cập nhật dịch vụ.');
        } finally {
            setServiceActionLoading(null);
        }
    };

    // Xử lý xác nhận đã hoàn thành hoặc hủy dịch vụ trực tiếp trong modal check-out
    const handleQuickUpdateServiceStatus = (serviceItem, newStatus) => {
        const requestId = serviceItem.request_id || (typeof serviceItem.id === 'string' && serviceItem.id.startsWith('req_') ? serviceItem.id.replace('req_', '') : serviceItem.id);
        if (!requestId) return;

        if (newStatus === 'cancelled') {
            showConfirm({
                title: 'Xác nhận khách không dùng dịch vụ',
                icon: 'trash',
                confirmType: 'rose',
                confirmText: 'Xác nhận hủy & Trừ tiền',
                cancelText: 'Giữ lại',
                message: `Khách KHÔNG sử dụng dịch vụ "${serviceItem.service_name}"?`,
                bullets: [
                    'Hệ thống sẽ hủy yêu cầu dịch vụ này.',
                    `Số tiền ${formatCurrency(serviceItem.total_price)} sẽ tự động TRỪ khỏi hóa đơn check-out ngay lập tức.`
                ],
                detail: 'Khoản tiền này sẽ được trừ khỏi tổng tiền thanh toán của phòng.',
                onConfirm: () => {
                    closeConfirm();
                    executeServiceStatusUpdate(requestId, serviceItem, newStatus);
                }
            });
            return;
        }

        executeServiceStatusUpdate(requestId, serviceItem, newStatus);
    };

    // Xác nhận nhanh TẤT CẢ các dịch vụ đang chờ thành hoàn tất
    const handleCompleteAllServices = () => {
        if (!uncompletedServices.length) return;
        showConfirm({
            title: 'Xác nhận hoàn thành tất cả dịch vụ',
            icon: 'check',
            confirmType: 'emerald',
            confirmText: 'Đã phục vụ tất cả',
            cancelText: 'Huỷ',
            message: `Xác nhận tất cả ${uncompletedServices.length} dịch vụ đang chờ đã được phục vụ cho khách?`,
            detail: 'Toàn bộ các dịch vụ trên sẽ được chuyển sang trạng thái "Đã phục vụ" và tính vào hóa đơn.',
            onConfirm: async () => {
                closeConfirm();
                try {
                    setServiceActionLoading('bulk');
                    for (const svc of uncompletedServices) {
                        const reqId = svc.request_id || (typeof svc.id === 'string' && svc.id.startsWith('req_') ? svc.id.replace('req_', '') : svc.id);
                        if (reqId) {
                            await hotelService.updateServiceRequestStatus(
                                reqId,
                                'completed',
                                'Xác nhận hoàn thành hàng loạt tại bước Check-out'
                            );
                        }
                    }
                    setServiceActionMsg({
                        type: 'success',
                        text: `Đã xác nhận hoàn thành tất cả ${uncompletedServices.length} dịch vụ!`
                    });
                    await refreshSummary();
                    setTimeout(() => {
                        setServiceActionMsg(null);
                    }, 4000);
                } catch (err) {
                    console.error('Lỗi khi hoàn thành tất cả dịch vụ:', err);
                    alert('Có lỗi xảy ra khi cập nhật dịch vụ.');
                } finally {
                    setServiceActionLoading(null);
                }
            }
        });
    };

    // 2. TÍNH TOÁN CÁC KHOẢN MỤC TÀI CHÍNH (FOLIO BALANCE) TỪ BACKEND TRẢ VỀ
    const roomCharge = useMemo(() => {
        return Number(summary?.room_charge ?? booking?.room_charge ?? booking?.total_amount ?? 0);
    }, [summary, booking]);

    const dailyRate = useMemo(() => {
        return Number(summary?.daily_rate ?? booking?.price_per_night ?? booking?.category?.promo_price ?? booking?.category?.base_price ?? (roomCharge / (summary?.nights || booking?.nights || 1)));
    }, [summary, booking, roomCharge]);

    const nightsCount = useMemo(() => {
        return Number(summary?.nights ?? booking?.nights ?? 1);
    }, [summary, booking]);

    const roomSubtotal = useMemo(() => {
        if (summary?.room_subtotal !== undefined && summary?.room_subtotal !== null) {
            return Number(summary.room_subtotal);
        }
        return dailyRate * nightsCount;
    }, [summary, dailyRate, nightsCount]);

    const promoDiscount = useMemo(() => {
        return Number(summary?.promotion_discount ?? booking?.promotion_discount ?? 0);
    }, [summary, booking]);

    const membershipDiscount = useMemo(() => {
        return Number(summary?.membership_discount ?? booking?.membership_discount ?? 0);
    }, [summary, booking]);

    const totalDiscount = useMemo(() => {
        if (summary?.total_discount !== undefined && summary?.total_discount !== null) {
            return Number(summary.total_discount);
        }
        const diff = Math.max(0, roomSubtotal - roomCharge);
        return diff > 0 ? diff : (promoDiscount + membershipDiscount);
    }, [summary, roomSubtotal, roomCharge, promoDiscount, membershipDiscount]);

    const promoCode = useMemo(() => {
        return summary?.promotion_code || booking?.promotion_code || booking?.applied_promotion?.code || '';
    }, [summary, booking]);

    const serviceCharge = useMemo(() => {
        return Number(summary?.service_charge ?? summary?.total_service_charge ?? booking?.service_charge ?? booking?.extra_services_total ?? 0);
    }, [summary, booking]);

    const totalAmount = useMemo(() => {
        if (summary?.total_amount !== undefined && summary?.total_amount !== null) {
            return Number(summary.total_amount);
        }
        if (summary?.grand_total !== undefined && summary?.grand_total !== null) {
            return Number(summary.grand_total);
        }
        return Number(roomCharge + serviceCharge);
    }, [summary, roomCharge, serviceCharge]);

    const paidAmount = useMemo(() => {
        if (summary?.paid_amount !== undefined && summary?.paid_amount !== null) {
            return Number(summary.paid_amount);
        }
        if (booking?.paid_amount !== undefined && booking?.paid_amount !== null) {
            return Number(booking.paid_amount);
        }
        return 0;
    }, [summary, booking]);

    const isGroupRoom = Boolean(
        booking?.group_booking ||
        booking?.group_booking_code ||
        booking?.group_booking_id ||
        summary?.is_group_room
    );

    const isCompanyAllInclusive = Boolean(
        summary?.is_company_all_inclusive ||
        booking?.is_company_all_inclusive ||
        summary?.group_billing_type === 'ALL_INCLUSIVE' ||
        booking?.group_billing_type === 'ALL_INCLUSIVE' ||
        booking?.billing_type === 'ALL_INCLUSIVE'
    );

    const groupBookingCode = summary?.group_booking_code || booking?.group_booking_code || booking?.group_code || '';

    // Dịch vụ phát sinh tại phòng (chưa thanh toán)
    const unpaidServiceCharge = useMemo(() => {
        if (summary?.unpaid_services_total !== undefined && summary?.unpaid_services_total !== null) {
            return Number(summary.unpaid_services_total);
        }
        return Number(summary?.service_charge ?? booking?.extra_services_total ?? 0);
    }, [summary, booking]);

    // Tự động phát hiện trả phòng muộn (Late Check-out Detection) theo Cài đặt hệ thống
    const lateCheckOutInfo = useMemo(() => {
        if (!booking?.check_out_date) return null;
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;
        const bCheckOutStr = String(booking.check_out_date).split('T')[0];

        // Nếu ngày hiện tại trước ngày check-out dự kiến thì không phải trả phòng muộn
        if (todayStr < bCheckOutStr) return null;

        const [stdH, stdM] = (hotelSettings.check_out_time || '12:00').split(':').map(Number);
        const stdDecimal = (stdH || 12) + (stdM || 0) / 60;
        const currentDecimal = now.getHours() + now.getMinutes() / 60;

        // Nếu đúng ngày check-out nhưng trước hoặc đúng giờ chuẩn
        if (todayStr === bCheckOutStr && currentDecimal <= stdDecimal) {
            return null;
        }

        let percent = Number(hotelSettings.late_checkout_after_6pm !== undefined ? hotelSettings.late_checkout_after_6pm : 100);
        let rule = `Sau 18:00 tối (+${percent}% 1 đêm)`;
        if (todayStr === bCheckOutStr) {
            if (currentDecimal <= 15) {
                percent = Number(hotelSettings.late_checkout_12pm_3pm !== undefined ? hotelSettings.late_checkout_12pm_3pm : 30);
                rule = `12:00 - 15:00 (+${percent}%)`;
            } else if (currentDecimal <= 18) {
                percent = Number(hotelSettings.late_checkout_3pm_6pm !== undefined ? hotelSettings.late_checkout_3pm_6pm : 50);
                rule = `15:00 - 18:00 (+${percent}%)`;
            }
        } else {
            rule = `Quá hạn trả phòng >= 1 ngày (+${percent}%)`;
        }

        const nights = Math.max(1, Number(summary?.nights || booking.nights) || 1);
        const rawRoom = Number(summary?.room_charge ?? booking.room_amount ?? booking.total_amount ?? 0);
        const dailyRate = nights > 0 ? (rawRoom / nights) : rawRoom;
        const amount = Math.round((dailyRate * percent) / 100);

        const currentTimeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

        return {
            percent,
            amount,
            rule,
            currentTime: currentTimeStr
        };
    }, [booking, summary, hotelSettings]);

    const lateChargeAmount = (lateCheckOutInfo && applyLateSurcharge) ? lateCheckOutInfo.amount : 0;

    // Số tiền còn thiếu ban đầu từ backend (Folio Balance Due)
    const initialRemainingBalance = useMemo(() => {
        if (isGroupRoom) {
            // Nếu công ty chi trả toàn bộ (ALL_INCLUSIVE): công ty gánh cả tiền phòng và dịch vụ minibar/phát sinh
            if (isCompanyAllInclusive) {
                return 0;
            }
            // Đối với phòng thuộc đoàn công ty (ROOM_ONLY - Master-Billing), tiền phòng chuyển HĐ đoàn,
            // khách lẻ chỉ thanh toán phần dịch vụ phát sinh cá nhân tại phòng (nếu có)
            return Math.max(0, unpaidServiceCharge + lateChargeAmount - paidAmount);
        }
        if (summary?.remaining_balance !== undefined && summary?.remaining_balance !== null) {
            return Number(summary.remaining_balance) + lateChargeAmount;
        }
        if (summary?.remaining_amount !== undefined && summary?.remaining_amount !== null) {
            return Number(summary.remaining_amount) + lateChargeAmount;
        }
        return Math.max(0, totalAmount + lateChargeAmount - paidAmount);
    }, [isGroupRoom, isCompanyAllInclusive, unpaidServiceCharge, lateChargeAmount, summary, totalAmount, paidAmount]);

    // Số tiền còn thiếu thực tế (sau khi lễ tân vừa bấm xác nhận thanh toán nợ)
    const currentRemainingBalance = useMemo(() => {
        if (isDebtPaid) return 0;
        return initialRemainingBalance;
    }, [isDebtPaid, initialRemainingBalance]);

    // Kiểm tra xem khách đã thanh toán đủ tiền chưa
    const isPaymentSettled = currentRemainingBalance <= 0;

    // 3. TẠO URL VIETQR ĐỘNG THEO ĐÚNG SỐ TIỀN REMAINING_BALANCE
    const qrUrl = useMemo(() => {
        if (!bankConfig.bank_bin || !bankConfig.account_no || currentRemainingBalance <= 0) return '';
        const bCode = summary?.booking_code || booking.booking_code || `BK-${booking.id}`;
        const addInfo = encodeURIComponent(`Thanh toan checkout ${bCode}`);
        return `https://img.vietqr.io/image/${bankConfig.bank_bin}-${bankConfig.account_no}-compact2.jpg?amount=${currentRemainingBalance}&addInfo=${addInfo}&accountName=${encodeURIComponent(bankConfig.account_name)}`;
    }, [bankConfig, currentRemainingBalance, summary, booking]);

    // 4. XỬ LÝ XÁC NHẬN THANH TOÁN PHẦN NỢ (REMAINING BALANCE)
    const handleConfirmDebtPayment = async () => {
        if (currentRemainingBalance <= 0) return;

        try {
            setIsProcessingDebtPayment(true);

            // Ghi nhận bản ghi thanh toán nốt phần nợ vào database
            await paymentService.confirmPayment({
                booking_id: booking.id,
                amount: currentRemainingBalance,
                payment_method: paymentMethod === 'bank_transfer' ? 'TRANSFER' : 'CASH'
            });

            // Đánh dấu đã giải quyết xong công nợ -> Nút Hoàn tất Check-out sẽ sáng lên
            setIsDebtPaid(true);
        } catch (err) {
            console.error('Lỗi khi ghi nhận thanh toán nợ Check-out:', err);
            alert(err.response?.data?.message || 'Không thể ghi nhận thanh toán. Vui lòng thử lại.');
        } finally {
            setIsProcessingDebtPayment(false);
        }
    };

    const executeActualCheckOut = async () => {
        try {
            setIsSubmitting(true);
            const res = await bookingService.checkOut(booking.id, {
                payment_method: paymentMethod,
                note: checkoutNote.trim(),
                late_checkout_surcharge: lateChargeAmount,
                is_company_invoice: isCompanyInvoice,
                company_name: isCompanyInvoice ? companyName.trim() : null,
                company_tax_code: isCompanyInvoice ? companyTaxCode.trim() : null,
                company_address: isCompanyInvoice ? companyAddress.trim() : null,
                invoice_recipient_email: isCompanyInvoice ? invoiceRecipientEmail.trim() : null
            });

            if (res.success && res.data) {
                setCompletedInvoice(res.data.invoice || res.data);

                // Phát tín hiệu đồng bộ realtime
                try {
                    localStorage.setItem('pms_last_booking_event', Date.now().toString());
                    window.dispatchEvent(new CustomEvent('pms_booking_created'));
                } catch (e) {
                    console.error('Lỗi khi phát tín hiệu pms event:', e);
                }

                onClose();
                if (typeof onSuccess === 'function') {
                    try {
                        onSuccess(res.data);
                    } catch (callbackErr) {
                        console.error('Lỗi trong onSuccess checkout:', callbackErr);
                    }
                }
            } else {
                alert(res.message || 'Check-out thất bại. Vui lòng kiểm tra lại.');
            }
        } catch (err) {
            console.error('Lỗi khi thực hiện Check-out:', err);
            alert('Đã xảy ra lỗi khi kết nối máy chủ để thực hiện Check-out.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const checkUncompletedServicesThenCheckout = () => {
        const svcNames = uncompletedServices.map((s) => `${s.service_name} (${formatCurrency(s.total_price)})`);
        showConfirm({
            title: 'Lưu ý dịch vụ chưa hoàn thành',
            icon: 'warning',
            confirmType: 'amber',
            confirmText: 'Chấp nhận & Tiếp tục',
            cancelText: 'Kiểm tra lại',
            message: `Hiện vẫn còn ${uncompletedServices.length} dịch vụ chưa được xác nhận hoàn thành:`,
            bullets: svcNames,
            detail: 'Toàn bộ tiền của các dịch vụ này VẪN SẼ ĐƯỢC TÍNH vào hóa đơn của khách. Bạn có chắc chắn muốn tiếp tục check-out ngay bây giờ?',
            onConfirm: () => {
                closeConfirm();
                executeActualCheckOut();
            }
        });
    };

    // 5. GỬI YÊU CẦU HOÀN TẤT CHECK-OUT TỚI API POST /api/bookings/:id/check-out/
    const handleConfirmCheckOut = () => {
        // Cảnh báo nếu Buồng phòng đang trong tiến trình kiểm phòng
        if (inspectionStatus === 'requested') {
            showConfirm({
                title: 'Lưu ý tiến độ kiểm phòng',
                icon: 'warning',
                confirmType: 'amber',
                confirmText: 'Tiếp tục trả phòng',
                cancelText: 'Chờ buồng phòng',
                message: 'Bộ phận Buồng phòng hiện đang kiểm tra phòng này.',
                bullets: [
                    'Nếu check-out ngay, các phụ phí Minibar hoặc Bồi thường hư hại (nếu buồng phòng tìm thấy) sẽ không kịp cộng vào hóa đơn.'
                ],
                detail: 'Bạn có muốn tiếp tục hoàn tất trả phòng ngay bây giờ?',
                onConfirm: () => {
                    closeConfirm();
                    if (uncompletedServices.length > 0) {
                        checkUncompletedServicesThenCheckout();
                    } else {
                        executeActualCheckOut();
                    }
                }
            });
            return;
        }

        // Cảnh báo lễ tân nếu còn dịch vụ chưa phục vụ hoặc chưa hủy
        if (uncompletedServices.length > 0) {
            checkUncompletedServicesThenCheckout();
            return;
        }

        executeActualCheckOut();
    };

    if (!booking) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 max-w-4xl w-full shadow-2xl text-left max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                {/* ========================================================================= */}
                {/* 1. FIXED MODAL HEADER                                                     */}
                {/* ========================================================================= */}
                <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-200/90 flex items-center justify-between shrink-0 bg-white">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
                            <Receipt className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                                    #{summary?.booking_code || booking.booking_code}
                                </span>
                                <span className="text-xs text-slate-300">•</span>
                                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 uppercase tracking-wide">
                                    {summary?.room_number ? `Phòng ${summary.room_number}` : (booking.room_number ? `Phòng ${booking.room_number}` : 'Đang lưu trú')}
                                </span>
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mt-1">
                                {completedInvoice ? 'Hóa Đơn Thanh Toán Đã Hoàn Tất' : 'Bảng Kê Chi Tiết & Trả Phòng (Check-out)'}
                            </h2>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center cursor-pointer shrink-0"
                        title="Đóng cửa sổ"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ========================================================================= */}
                {/* 2. SCROLLABLE NỘI DUNG CHÍNH (LOADING / ERROR / THÀNH CÔNG / BẢNG KÊ)      */}
                {/* ========================================================================= */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                    {isLoading ? (
                        <div className="py-20 text-center space-y-4">
                            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                            <p className="text-xs font-semibold text-slate-600">
                                Đang tổng hợp dữ liệu Folio tiền phòng và các dịch vụ phát sinh từ hệ thống...
                            </p>
                        </div>
                    ) : error ? (
                        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3 my-4">
                            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
                            <p className="text-sm font-bold text-rose-800">{error}</p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer transition"
                            >
                                Đóng cửa sổ
                            </button>
                        </div>
                    ) : completedInvoice ? (
                        /* 2A. MÀN HÌNH HOÀN TẤT CHECK-OUT THÀNH CÔNG */
                        <div className="space-y-6 my-2">
                            <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl text-center space-y-3">
                                <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-500/30">
                                    <CheckCircle2 className="w-9 h-9 text-white" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                                    Khách Hàng Trả Phòng Thành Công!
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                                    Phòng <strong>{summary?.room_number || booking.room_number}</strong> đã hoàn tất thủ tục trả phòng và chuyển sang trạng thái <strong>Đang dọn dẹp (Cleaning)</strong>.
                                </p>
                                <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-emerald-300 font-mono text-sm font-bold text-emerald-800 shadow-xs">
                                    <span>Mã hóa đơn:</span>
                                    <span>{completedInvoice.invoice_code}</span>
                                </div>
                            </div>

                            {/* Tóm tắt số tiền đã thanh toán */}
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                                <div className="flex justify-between text-slate-600">
                                    <span>Tổng tiền phòng:</span>
                                    <span className="font-semibold text-slate-900">{formatCurrency(roomCharge)}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Tổng tiền dịch vụ:</span>
                                    <span className="font-semibold text-slate-900">{formatCurrency(serviceCharge)}</span>
                                </div>
                                <div className="flex justify-between text-slate-600">
                                    <span>Tổng chi phí lưu trú (Folio Total):</span>
                                    <span className="font-semibold text-slate-900">{formatCurrency(totalAmount)}</span>
                                </div>
                                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-bold">
                                    <span className="text-sm text-slate-800">Tổng tiền đã thanh toán hoàn tất:</span>
                                    <span className="text-xl text-emerald-700 font-black">{formatCurrency(totalAmount)}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                {onOpenInvoice && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            onOpenInvoice({
                                                ...booking,
                                                status: 'completed',
                                                room_amount: roomCharge,
                                                extra_services_total: serviceCharge,
                                                grand_total_amount: totalAmount,
                                                invoice: completedInvoice
                                            });
                                        }}
                                        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer"
                                    >
                                        <Printer className="w-4 h-4 text-slate-600" />
                                        <span>In Hóa Đơn Chuẩn A4</span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                                >
                                    Đóng Cửa Sổ
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* 2B. BẢNG KÊ CHI TIẾT TRƯỚC THANH TOÁN (FOLIO ITEMIZED TABLE) */
                        <div className="space-y-6">
                            {/* CẢNH BÁO TRẢ PHÒNG MUỘN (LATE CHECK-OUT) THEO CÀI ĐẶT HỆ THỐNG */}
                            {lateCheckOutInfo && (
                                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                                                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                                <span>Phát hiện Trả phòng muộn (Late Check-out) lúc {lateCheckOutInfo.currentTime}</span>
                                                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                                    {lateCheckOutInfo.rule}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 leading-relaxed">
                                                Quy định khách sạn: Giờ trả phòng chuẩn là <strong>{hotelSettings.check_out_time || '12:00'}</strong>. Khách check-out muộn áp dụng phụ thu <strong>+{lateCheckOutInfo.percent}%</strong> tiền phòng 1 ngày (~<strong className="text-slate-900">{formatCurrency(lateCheckOutInfo.amount)}</strong>).
                                            </p>
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto shrink-0 transition">
                                            <input
                                                type="checkbox"
                                                checked={applyLateSurcharge}
                                                onChange={(e) => setApplyLateSurcharge(e.target.checked)}
                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                            />
                                            <span className="text-xs font-bold text-slate-800">
                                                {applyLateSurcharge ? 'Áp dụng phụ thu' : 'Miễn phụ thu (Waive)'}
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* THÔNG BÁO GỘP ĐOÀN MASTER-BILLING */}
                            {isGroupRoom && (
                                <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs space-y-1">
                                    <div className="flex items-center justify-between font-bold text-indigo-900">
                                        <span className="flex items-center gap-1.5">
                                            <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                                            <span>ĐƠN PHÒNG THUỘC ĐOÀN KHÁCH: {summary?.group_booking_name || booking.group_booking_name || 'Khách đoàn Doanh nghiệp'}</span>
                                        </span>
                                        <span className="font-mono text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-bold">
                                            MÃ ĐOÀN: #{groupBookingCode}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-indigo-800">
                                        {isCompanyAllInclusive ? (
                                            <>* <strong>Chính sách Công ty chi trả toàn bộ (All-Inclusive):</strong> Toàn bộ tiền phòng ({formatCurrency(roomCharge)}) và chi phí dịch vụ/minibar phát sinh được kết chuyển vào Hóa đơn tổng của Doanh nghiệp. Khách lưu trú không phải trả bất kỳ khoản phí nào tại quầy.</>
                                        ) : (
                                            <>* <strong>Chính sách Master-Billing (Room Only):</strong> Tiền phòng ({formatCurrency(roomCharge)}) được kết chuyển vào Hóa đơn tổng của Doanh nghiệp. Khách lưu trú chỉ thanh toán dịch vụ cá nhân phát sinh tại phòng (nếu có).</>
                                        )}
                                    </p>
                                </div>
                            )}

                            {/* THÔNG TIN KHÁCH VÀ PHÒNG */}
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 text-xs">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <span className="text-[11px] text-slate-400 block">Khách hàng lưu trú:</span>
                                        <strong className="text-slate-900 text-sm block truncate mt-0.5">
                                            <span className="inline-flex items-center gap-1.5">
                                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span>{summary?.guest_name || booking.guest_name}</span>
                                            </span>
                                        </strong>
                                        <span className="text-[11px] text-slate-500 block mt-0.5">
                                            <span className="inline-flex items-center gap-1.5">
                                                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span>{summary?.guest_phone || booking.guest_phone || 'Chưa có SĐT'}</span>
                                            </span>
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] text-slate-400 block">Hạng phòng & Số phòng:</span>
                                        <strong className="text-slate-900 text-xs block font-bold mt-0.5">
                                            <span className="inline-flex items-center gap-1.5">
                                                <BedDouble className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span>{summary?.room_name || booking.room_name}</span>
                                            </span>
                                        </strong>
                                        <span className="text-[11px] text-slate-600 font-bold block mt-0.5">
                                            <span className="inline-flex items-center gap-1.5">
                                                <DoorOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                <span>{summary?.room_number ? `Phòng số: ${summary.room_number}` : (booking.room_number ? `Phòng số: ${booking.room_number}` : 'Chưa gán số phòng')}</span>
                                            </span>
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] text-slate-400 block">Thời gian lưu trú:</span>
                                        <div className="text-[11px] text-slate-700 font-medium mt-0.5">
                                            <span>Check-in: {formatDateTime(summary?.actual_check_in || summary?.check_in_date || booking.check_in_date)}</span>
                                        </div>
                                        <div className="text-[11px] text-slate-700 font-medium">
                                            <span>Check-out: {formatDateTime(new Date().toISOString())}</span>
                                        </div>
                                        <span className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 bg-white text-slate-700 border border-slate-200 text-[10px] font-bold rounded-md">
                                            <Moon className="w-3 h-3 text-slate-500 shrink-0" />
                                            <span>{summary?.nights || booking.nights || 1} đêm lưu trú</span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                        {/* ================================================================= */}
                        {/* QUY TRÌNH KIỂM PHÒNG CHECK-OUT (MINIBAR & HƯ HẠI TÀI SẢN)        */}
                        {/* ================================================================= */}
                        <div className="p-4 rounded-2xl border transition-all bg-white shadow-2xs border-slate-200">
                            {/* Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2.5">
                                    <div>
                                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                                            <span>Quy Trình Kiểm Tra Phòng (Minibar & Hư Hại)</span>
                                        </h4>
                                        <p className="text-[11px] text-slate-500">
                                            Thông báo bộ phận Buồng phòng kiểm tra thực tế trước khi thanh toán Check-out
                                        </p>
                                    </div>
                                </div>

                                {/* Trạng thái badge */}
                                {inspectionStatus === 'completed' ? (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs self-start sm:self-auto">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>Đã kiểm phòng xong</span>
                                    </span>
                                ) : inspectionStatus === 'requested' ? (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 flex items-center gap-1.5 animate-pulse shadow-2xs self-start sm:self-auto">
                                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                        <span>Đang đợi Buồng phòng kiểm</span>
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1.5 self-start sm:self-auto">
                                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span>Chưa kiểm phòng Check-out</span>
                                    </span>
                                )}
                            </div>

                            {/* Thông báo thao tác kiểm phòng */}
                            {inspectionFeedback && (
                                <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 animate-in fade-in">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span className="font-medium">{inspectionFeedback.message}</span>
                                </div>
                            )}

                            {/* Body theo từng trạng thái */}
                            <div className="pt-3">
                                {/* TRẠNG THÁI 1: CHƯA YÊU CẦU */}
                                {inspectionStatus === 'none' && (
                                    <div className="space-y-3">
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-600 leading-relaxed">
                                            Khách đang làm thủ tục trả phòng. Bấm nút <strong>"Yêu Cầu Kiểm Phòng"</strong> bên dưới để gửi thông báo tức thì đến nhân viên Buồng phòng đi kiểm tra đồ dùng Minibar và thiết bị phòng {summary?.room_number || booking.room_number}.
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <input
                                                type="text"
                                                placeholder="Ghi chú thêm cho Buồng phòng (VD: Khách vội, cần kiểm nhanh)..."
                                                value={inspectionNote}
                                                onChange={(e) => setInspectionNote(e.target.value)}
                                                className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-amber-500 font-medium text-slate-800"
                                            />
                                            <button
                                                type="button"
                                                disabled={isRequestingInspection}
                                                onClick={handleRequestInspection}
                                                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                                            >
                                                <BellRing className="w-4 h-4" />
                                                <span>{isRequestingInspection ? 'Đang gửi...' : 'Yêu Cầu Kiểm Phòng'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isRequestingInspection}
                                                onClick={handleQuickSelfInspection}
                                                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                                                title="Khách cam kết không dùng đồ và phòng nguyên vẹn, kiểm nhanh để checkout"
                                            >
                                                <Zap className="w-4 h-4 text-amber-600" />
                                                <span>Kiểm nhanh tại quầy</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* TRẠNG THÁI 2: ĐANG CHỜ BUỒNG PHÒNG */}
                                {inspectionStatus === 'requested' && (
                                    <div className="space-y-3">
                                        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                                                    <span>Đã gửi thông báo kiểm phòng tới bộ phận Buồng phòng!</span>
                                                </div>
                                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                                    • Người yêu cầu: <strong className="text-slate-800">{inspectionData?.requested_by_name || 'Lễ tân'}</strong> lúc {formatDateTime(inspectionData?.created_at || new Date().toISOString())}
                                                    {inspectionData?.note && <span className="block mt-0.5">• Ghi chú: <em className="text-slate-700">"{inspectionData.note}"</em></span>}
                                                </p>
                                                <p className="text-[11px] text-slate-500">
                                                    Nhân viên Buồng phòng đang kiểm tra phòng. Bảng kê hóa đơn sẽ tự động nhảy số tiền khi buồng phòng xác nhận trên hệ thống.
                                                </p>
                                            </div>

                                            <div className="flex sm:flex-col gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        await fetchInspectionStatus();
                                                        await refreshSummary();
                                                    }}
                                                    className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                                                >
                                                    <RotateCw className="w-3.5 h-3.5" />
                                                    <span>Làm mới kết quả</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isRequestingInspection}
                                                    onClick={handleQuickSelfInspection}
                                                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                    title="Xác nhận khách không dùng đồ và tài sản nguyên vẹn"
                                                >
                                                    <Zap className="w-4 h-4" />
                                                    <span>Khách xác nhận không dùng</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* TRẠNG THÁI 3: ĐÃ KIỂM PHÒNG XONG */}
                                {inspectionStatus === 'completed' && (
                                    <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-2.5">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-2">
                                            <div className="text-xs text-emerald-950 font-bold flex items-center gap-2 flex-wrap">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                <span>
                                                    Buồng phòng đã hoàn tất kiểm tra lúc {formatDateTime(inspectionData?.completed_at || inspectionData?.created_at)}
                                                </span>
                                                {inspectionData?.inspector_name && (
                                                    <span className="text-[11px] font-medium text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                                                        Nhân viên: {inspectionData.inspector_name}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    await fetchInspectionStatus();
                                                    await refreshSummary();
                                                }}
                                                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer self-start sm:self-auto inline-flex items-center gap-1"
                                            >
                                                <RotateCw className="w-3 h-3" />
                                                <span>Cập nhật lại</span>
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                            {/* Báo cáo Minibar */}
                                            <div className="bg-white p-2.5 rounded-xl border border-emerald-200/80 space-y-1">
                                                <div className="font-bold text-slate-800 flex items-center justify-between">
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <Wine className="w-4 h-4 text-amber-600 shrink-0" />
                                                        <span>Đồ uống / Đồ ăn Minibar:</span>
                                                    </span>
                                                    <span className="font-mono text-emerald-700">
                                                        {formatCurrency(inspectionData?.total_amount || 0)}
                                                    </span>
                                                </div>
                                                {inspectionData?.items_consumed && inspectionData.items_consumed.length > 0 ? (
                                                    <ul className="text-[11px] text-slate-600 space-y-0.5 pt-1 border-t border-slate-100">
                                                        {inspectionData.items_consumed.map((it, idx) => {
                                                            const itemName = it.name || it.item_name || it.service_name || 'Mặt hàng minibar';
                                                            const itemTotal = it.total != null ? it.total : (it.total_price != null ? it.total_price : (Number(it.price || 0) * Number(it.quantity || 1)));
                                                            return (
                                                                <li key={idx} className="flex justify-between items-center">
                                                                    <span>• {itemName} <strong className="text-slate-800 font-semibold">(x{it.quantity || 1})</strong></span>
                                                                    <span className="font-semibold text-slate-700">{formatCurrency(itemTotal)}</span>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                ) : (
                                                    <p className="text-[11px] text-slate-500 italic">
                                                        Khách không sử dụng đồ trong minibar.
                                                    </p>
                                                )}
                                            </div>

                                            {/* Báo cáo Hư hại / Bồi thường */}
                                            <div className="bg-white p-2.5 rounded-xl border border-emerald-200/80 space-y-1">
                                                <div className="font-bold text-slate-800 flex items-center justify-between">
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <Wrench className="w-4 h-4 text-slate-600 shrink-0" />
                                                        <span>Tình trạng tài sản phòng:</span>
                                                    </span>
                                                    {inspectionData?.has_damage ? (
                                                        <span className="font-mono text-rose-700 font-bold">
                                                            +{formatCurrency(inspectionData?.damage_amount || 0)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-emerald-700 font-bold inline-flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                                            <span>Nguyên vẹn</span>
                                                        </span>
                                                    )}
                                                </div>
                                                {inspectionData?.has_damage ? (
                                                    <div className="text-[11px] text-rose-800 bg-rose-50 p-2 rounded-lg border border-rose-200 space-y-0.5">
                                                        <p className="font-bold inline-flex items-center gap-1">
                                                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                                            <span>Có hư hại ghi nhận:</span>
                                                        </p>
                                                        <p className="leading-relaxed">{inspectionData.damage_description || 'Hư hại đồ dùng trong phòng'}</p>
                                                        <p className="font-semibold text-rose-900 mt-1">
                                                            Đã cộng khoản đền bù <strong>{formatCurrency(inspectionData.damage_amount)}</strong> vào bảng kê Folio bên dưới.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-slate-500 italic">
                                                        Trang thiết bị và đồ dùng trong phòng đầy đủ, hoạt động bình thường.
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {inspectionData?.note && (
                                            <p className="text-[11px] text-slate-600 bg-white/80 p-2 rounded-lg border border-emerald-100 flex items-start gap-1.5">
                                                <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                <span><strong>Ghi chú:</strong> {inspectionData.note}</span>
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ================================================================= */}
                        {/* THÔNG BÁO TÁC VỤ DỊCH VỤ NHANH (NẾU CÓ)                          */}
                        {/* ================================================================= */}
                        {serviceActionMsg && (
                            <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between transition-all shadow-xs ${serviceActionMsg.type === 'success'
                                    ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                                    : 'bg-sky-50/90 border-sky-200 text-sky-900'
                                }`}>
                                <span className="flex items-center gap-2 font-medium">
                                    {serviceActionMsg.type === 'success' ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    ) : (
                                        <Info className="w-4 h-4 text-sky-600 shrink-0" />
                                    )}
                                    <span>{serviceActionMsg.text}</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setServiceActionMsg(null)}
                                    className="w-6 h-6 rounded-lg hover:bg-black/5 text-slate-400 hover:text-slate-600 transition flex items-center justify-center cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}

                        {/* CẢNH BÁO THÔNG MINH: CÓ DỊCH VỤ CHƯA ĐÁNH DẤU HOÀN THÀNH */}
                        {uncompletedServices.length > 0 && (
                            <div className="p-3.5 rounded-2xl bg-amber-50/95 border border-amber-300/90 shadow-xs text-xs space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2.5">
                                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                        <div>
                                            <strong className="text-amber-950 font-bold block text-xs">
                                                Lưu ý: Phát hiện {uncompletedServices.length} dịch vụ chưa đánh dấu hoàn thành!
                                            </strong>
                                            <p className="text-[11px] text-amber-900/90 mt-0.5 leading-relaxed">
                                                Khách đang làm thủ tục trả phòng nhưng vẫn còn dịch vụ ở trạng thái <em>Chờ xử lý / Đang thực hiện</em> (ví dụ: xe đưa đón Maybach/Limousine hoặc món ăn).
                                                Vui lòng hỏi khách:
                                                Nếu <strong>đã phục vụ</strong>, bấm <strong>[Đã phục vụ]</strong>.
                                                Nếu <strong>khách không dùng</strong> (chưa kịp phục vụ hoặc khách hủy), bấm <strong>[Khách không dùng]</strong> để hệ thống tự động trừ tiền khỏi hóa đơn.
                                            </p>
                                        </div>
                                    </div>
                                    {uncompletedServices.length > 1 && (
                                        <button
                                            type="button"
                                            disabled={Boolean(serviceActionLoading)}
                                            onClick={handleCompleteAllServices}
                                            className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[10px] transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>{serviceActionLoading === 'bulk' ? 'Đang cập nhật...' : 'Xác nhận tất cả đã dùng'}</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ================================================================= */}
                        {/* BẢNG KÊ CHI TIẾT KHOẢN MỤC (FOLIO STATEMENT)                     */}
                        {/* ================================================================= */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                    <Receipt className="w-4 h-4 text-slate-700 shrink-0" />
                                    <span>Bảng Kê Chi Tiết Folio Thanh Toán</span>
                                </h3>
                                <span className="text-[11px] text-slate-400">Đơn vị: VNĐ</span>
                            </div>

                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                                        <tr>
                                            <th className="py-2.5 px-4 w-[52%]">Khoản mục thanh toán</th>
                                            <th className="py-2.5 px-3 text-center w-[14%]">Số lượng</th>
                                            <th className="py-2.5 px-3 text-right w-[17%]">Đơn giá</th>
                                            <th className="py-2.5 px-4 text-right w-[17%]">Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {/* 1. TIỀN PHÒNG */}
                                        <tr className="bg-white font-medium hover:bg-slate-50/50">
                                            <td className="py-3 px-4">
                                                <div className="font-bold text-slate-900">
                                                    Tiền lưu trú phòng: {summary?.room_name || booking.room_name}
                                                </div>
                                                <div className="text-[11px] text-slate-400">
                                                    {formatDate(summary?.check_in_date || booking.check_in_date)} → {formatDate(summary?.check_out_date || booking.check_out_date)}
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-center font-bold text-slate-700">
                                                {nightsCount} đêm
                                            </td>
                                            <td className="py-3 px-3 text-right text-slate-600">
                                                {formatCurrency(dailyRate)}
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-slate-900">
                                                {formatCurrency(roomSubtotal)}
                                            </td>
                                        </tr>

                                        {/* 1.1 CHIẾT KHẤU / ƯU ĐÃI KHUYẾN MÃI (NẾU CÓ) */}
                                        {totalDiscount > 0 && (
                                            <tr className="bg-emerald-50/25 hover:bg-emerald-50/40 border-l-2 border-emerald-500">
                                                <td className="py-2.5 px-4">
                                                    <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                                                        <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                        <span>
                                                            Ưu đãi giảm giá {promoCode ? `(${promoCode})` : ''}
                                                        </span>
                                                        <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                                            Khấu trừ
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-emerald-600 mt-0.5">
                                                        {promoDiscount > 0 && `Mã ưu đãi: -${formatCurrency(promoDiscount)}`}
                                                        {promoDiscount > 0 && membershipDiscount > 0 && ' • '}
                                                        {membershipDiscount > 0 && `Hạng thành viên: -${formatCurrency(membershipDiscount)}`}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-3 text-center text-emerald-700 font-semibold">
                                                    1
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">
                                                    -{formatCurrency(totalDiscount)}
                                                </td>
                                                <td className="py-2.5 px-4 text-right font-bold text-emerald-700">
                                                    -{formatCurrency(totalDiscount)}
                                                </td>
                                            </tr>
                                        )}

                                        {/* 2. DỊCH VỤ PHÁT SINH */}
                                        {displayExtraServices && displayExtraServices.length > 0 ? (
                                            displayExtraServices.map((svc, idx) => {
                                                const isDamage = svc.service_name?.includes('Bồi thường');
                                                const isCleaning = (svc.service_name || '').toLowerCase().includes('dọn') || (svc.service_name || '').toLowerCase().includes('make-up');
                                                const isZeroPrice = Number(svc.price || 0) === 0 && Number(svc.total_price || 0) === 0;
                                                const isPaid = Boolean(svc.is_paid);
                                                const isServiceRequest = svc.source === 'service_request';
                                                const isUncompleted = isServiceRequest && ['pending', 'in_progress', 'delivering'].includes(svc.status);
                                                const isItemActionLoading = serviceActionLoading === (svc.request_id || svc.id);

                                                return (
                                                    <tr
                                                        key={svc.id || idx}
                                                        className={`${isDamage
                                                                ? 'bg-rose-50/30 hover:bg-rose-50/50 border-l-2 border-rose-400'
                                                                : isUncompleted
                                                                    ? 'bg-amber-50/30 hover:bg-amber-50/50 border-l-2 border-amber-400'
                                                                    : isZeroPrice
                                                                        ? 'bg-slate-50/40 hover:bg-slate-50/70'
                                                                        : 'hover:bg-slate-50/60'
                                                            }`}
                                                    >
                                                        <td className="py-2.5 px-4">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`font-semibold text-slate-800 inline-flex items-center gap-1.5 ${isDamage ? 'text-rose-900 font-bold' : ''}`}>
                                                                    <span className="shrink-0">
                                                                        {isDamage ? (
                                                                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                                                        ) : isCleaning ? (
                                                                            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                                                                        ) : isPaid ? (
                                                                            <Package className="w-3.5 h-3.5 text-emerald-500" />
                                                                        ) : (
                                                                            <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" />
                                                                        )}
                                                                    </span>
                                                                    <span>{svc.service_name}</span>
                                                                </span>

                                                                {/* Huy hiệu thanh toán */}
                                                                {isZeroPrice ? (
                                                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold shrink-0 inline-flex items-center gap-1">
                                                                        <Gift className="w-2.5 h-2.5" />
                                                                        <span>Miễn phí (FOC)</span>
                                                                    </span>
                                                                ) : isPaid ? (
                                                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold shrink-0 inline-flex items-center gap-1">
                                                                        <CheckCircle2 className="w-2.5 h-2.5" />
                                                                        <span>Đã trả trước</span>
                                                                    </span>
                                                                ) : isCompanyAllInclusive ? (
                                                                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-bold shrink-0 inline-flex items-center gap-1">
                                                                        <Building2 className="w-2.5 h-2.5" />
                                                                        <span>Công ty chi trả</span>
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[9px] font-semibold shrink-0">
                                                                        Thu tại quầy
                                                                    </span>
                                                                )}

                                                                {/* Huy hiệu trạng thái phục vụ */}
                                                                {isServiceRequest && (
                                                                    svc.status === 'completed' ? (
                                                                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-300 text-[9px] font-bold shrink-0 inline-flex items-center gap-1">
                                                                            <CheckCircle2 className="w-2.5 h-2.5" />
                                                                            <span>Đã phục vụ</span>
                                                                        </span>
                                                                    ) : svc.status === 'in_progress' || svc.status === 'delivering' ? (
                                                                        <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-300 text-[9px] font-bold shrink-0 inline-flex items-center gap-1">
                                                                            <Car className="w-2.5 h-2.5" />
                                                                            <span>Đang thực hiện</span>
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-bold animate-pulse shrink-0 inline-flex items-center gap-1">
                                                                            <Clock className="w-2.5 h-2.5" />
                                                                            <span>Chờ phục vụ</span>
                                                                        </span>
                                                                    )
                                                                )}
                                                            </div>

                                                            {/* Dòng thao tác nhanh nếu dịch vụ chưa hoàn thành hoặc chi tiết dọn phòng */}
                                                            <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap">
                                                                {svc.is_grouped ? (
                                                                    <div className="text-[10px] text-slate-500 font-medium">
                                                                        Đã phục vụ {svc.quantity} lượt trong kỳ lưu trú (Lần gần nhất: {formatDateTime(svc.created_at)})
                                                                    </div>
                                                                ) : svc.created_at ? (
                                                                    <div className="text-[10px] text-slate-400">
                                                                        Thời gian đặt: {formatDateTime(svc.created_at)}
                                                                    </div>
                                                                ) : <div />}

                                                                {isUncompleted && (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <button
                                                                            type="button"
                                                                            disabled={Boolean(serviceActionLoading)}
                                                                            onClick={() => handleQuickUpdateServiceStatus(svc, 'completed')}
                                                                            className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs"
                                                                            title="Khách đã sử dụng dịch vụ này, xác nhận hoàn thành để tính vào hóa đơn"
                                                                        >
                                                                            <Check className="w-3 h-3" />
                                                                            <span>{isItemActionLoading ? '...' : 'Đã phục vụ'}</span>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={Boolean(serviceActionLoading)}
                                                                            onClick={() => handleQuickUpdateServiceStatus(svc, 'cancelled')}
                                                                            className="px-2 py-0.5 rounded-md bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-[10px] transition cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs"
                                                                            title="Khách không sử dụng hoặc hủy dịch vụ, hủy yêu cầu và TRỪ tiền khỏi hóa đơn ngay lập tức"
                                                                        >
                                                                            <X className="w-3 h-3" />
                                                                            <span>{isItemActionLoading ? '...' : 'Khách không dùng (Trừ tiền)'}</span>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center text-slate-700 font-semibold">
                                                            x{svc.quantity}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right text-slate-600">
                                                            {formatCurrency(svc.price)}
                                                        </td>
                                                        <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                                                            {formatCurrency(svc.total_price)}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr className="bg-white">
                                                <td colSpan={4} className="py-3 px-4 text-center text-slate-400 italic text-[11px]">
                                                    Không phát sinh dịch vụ ăn uống, spa hoặc phụ phí tại phòng.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>

                                    {/* FOOTER BẢNG KÊ: BẮT BUỘC THEO YÊU CẦU ĐỀ BÀI */}
                                    <tfoot className="bg-slate-50/90 border-t border-slate-200">
                                        {/* Tổng tiền phòng */}
                                        <tr>
                                            <td colSpan={3} className="py-2 px-4 text-right font-semibold text-slate-600">
                                                {totalDiscount > 0 ? 'Cộng tiền phòng (Room Subtotal):' : 'Tiền phòng thuần (Room Charge):'}
                                            </td>
                                            <td className="py-2 px-4 text-right font-bold text-slate-800">
                                                {formatCurrency(totalDiscount > 0 ? roomSubtotal : roomCharge)}
                                            </td>
                                        </tr>

                                        {/* Khấu trừ khuyến mãi / ưu đãi (nếu có) */}
                                        {totalDiscount > 0 && (
                                            <tr className="bg-emerald-50/40">
                                                <td colSpan={3} className="py-1.5 px-4 text-right text-emerald-800 font-medium text-[11px]">
                                                    - Khấu trừ ưu đãi {promoCode ? `(${promoCode})` : ''}:
                                                </td>
                                                <td className="py-1.5 px-4 text-right font-bold text-emerald-700 text-[11px]">
                                                    -{formatCurrency(totalDiscount)}
                                                </td>
                                            </tr>
                                        )}

                                        {totalDiscount > 0 && (
                                            <tr>
                                                <td colSpan={3} className="py-1.5 px-4 text-right font-semibold text-slate-700 text-[11px]">
                                                    Tiền phòng sau ưu đãi:
                                                </td>
                                                <td className="py-1.5 px-4 text-right font-bold text-slate-900 text-[11px]">
                                                    {formatCurrency(roomCharge)}
                                                </td>
                                            </tr>
                                        )}

                                        {/* Dịch vụ đặt trước */}
                                        {Number(summary?.prepaid_services_total || 0) > 0 && (
                                            <tr>
                                                <td colSpan={3} className="py-1.5 px-4 text-right text-slate-600 font-medium text-[11px]">
                                                    + Dịch vụ đặt kèm trước (Đã thanh toán Online):
                                                </td>
                                                <td className="py-1.5 px-4 text-right font-semibold text-slate-800 text-[11px]">
                                                    {formatCurrency(summary.prepaid_services_total)}
                                                </td>
                                            </tr>
                                        )}

                                        {/* Dịch vụ phát sinh */}
                                        {Number(summary?.unpaid_services_total || 0) > 0 && (
                                            <tr>
                                                <td colSpan={3} className="py-1.5 px-4 text-right text-slate-600 font-medium text-[11px]">
                                                    + Dịch vụ phát sinh trong kỳ nghỉ (Cần thu):
                                                </td>
                                                <td className="py-1.5 px-4 text-right font-semibold text-slate-800 text-[11px]">
                                                    {formatCurrency(summary.unpaid_services_total)}
                                                </td>
                                            </tr>
                                        )}

                                        {/* Tổng dịch vụ */}
                                        <tr>
                                            <td colSpan={3} className="py-2 px-4 text-right font-semibold text-slate-600">
                                                Tổng toàn bộ dịch vụ (Service Charge):
                                            </td>
                                            <td className="py-2 px-4 text-right font-bold text-slate-800">
                                                {formatCurrency(serviceCharge)}
                                            </td>
                                        </tr>

                                        {/* Tổng chi phí */}
                                        <tr className="border-t border-slate-200">
                                            <td colSpan={3} className="py-2 px-4 text-right font-semibold text-slate-700">
                                                Tổng chi phí phòng & dịch vụ:
                                            </td>
                                            <td className="py-2 px-4 text-right font-bold text-slate-900">
                                                {formatCurrency(totalAmount)}
                                            </td>
                                        </tr>

                                        {/* Phụ thu trả phòng muộn (nếu có áp dụng) */}
                                        {lateChargeAmount > 0 && (
                                            <tr className="bg-amber-50/70 border-t border-amber-200">
                                                <td colSpan={3} className="py-2 px-4 text-right text-amber-900 font-semibold text-xs">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                                        <span>Phụ thu trả phòng muộn ({lateCheckOutInfo?.rule || `+${lateCheckOutInfo?.percent}%`}):</span>
                                                    </span>
                                                </td>
                                                <td className="py-2 px-4 text-right font-bold text-amber-800 text-xs">
                                                    +{formatCurrency(lateChargeAmount)}
                                                </td>
                                            </tr>
                                        )}

                                        {/* Khấu trừ tiền phòng / chi phí gộp đoàn nếu là phòng thuộc đoàn */}
                                        {isGroupRoom && (
                                            <tr className="bg-slate-50 border-t border-slate-200">
                                                <td colSpan={3} className="py-2 px-4 text-right font-bold text-slate-800 text-xs">
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <Building2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                                                        <span>
                                                            {isCompanyAllInclusive
                                                                ? `Chuyển thanh toán TOÀN BỘ (Tiền phòng & Dịch vụ minibar) vào Hóa đơn đoàn #${groupBookingCode}:`
                                                                : `Chuyển thanh toán vào Hóa đơn đoàn #${groupBookingCode}:`}
                                                        </span>
                                                    </span>
                                                </td>
                                                <td className="py-2 px-4 text-right font-bold text-slate-800 text-sm">
                                                    -{formatCurrency(isCompanyAllInclusive ? (totalAmount + lateChargeAmount - paidAmount) : roomCharge)}
                                                </td>
                                            </tr>
                                        )}

                                        {/* Số tiền Đã thanh toán trước đó (chữ xanh lá) */}
                                        {paidAmount > 0 && (
                                            <tr className="border-t border-slate-100">
                                                <td colSpan={3} className="py-2 px-4 text-right font-bold text-slate-700">
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                        <span>Số tiền Đã thanh toán trước đó:</span>
                                                    </span>
                                                </td>
                                                <td className="py-2 px-4 text-right font-black text-emerald-600 text-sm">
                                                    -{formatCurrency(paidAmount + (isDebtPaid ? initialRemainingBalance : 0))}
                                                </td>
                                            </tr>
                                        )}

                                        {/* SỐ TIỀN CẦN THANH TOÁN THÊM: remaining_balance */}
                                        <tr className={`border-t-2 ${currentRemainingBalance > 0 ? 'bg-slate-50 border-slate-900' : 'bg-slate-50 border-slate-200'}`}>
                                            <td colSpan={3} className="py-3 px-4 text-right font-extrabold text-xs uppercase tracking-wide">
                                                <span className="text-slate-900">
                                                    {isGroupRoom ? 'SỐ TIỀN THỰC THU KHÁCH TẠI QUẦY (Guest Balance Due):' : (currentRemainingBalance > 0 ? 'SỐ TIỀN CẦN THANH TOÁN THÊM (Remaining Balance):' : 'CÔNG NỢ CÒN LẠI (Folio Balance):')}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <span className={`text-xl font-black ${currentRemainingBalance > 0 ? 'text-rose-600 font-extrabold' : 'text-emerald-700 font-black'
                                                    }`}>
                                                    {currentRemainingBalance > 0 ? formatCurrency(currentRemainingBalance) : (isGroupRoom ? (isCompanyAllInclusive ? '0đ (CÔNG TY CHI TRẢ TOÀN BỘ)' : '0đ (HĐ ĐOÀN ĐÃ BẢO LÃNH)') : '0đ (ĐÃ THANH TOÁN ĐỦ)')}
                                                </span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* ================================================================= */}
                        {/* 3. LOGIC THANH TOÁN THÔNG MINH THEO YÊU CẦU ĐỀ BÀI                */}
                        {/* ================================================================= */}

                        {/* TRƯỜNG HỢP A: remaining_balance > 0 (Có nợ tiền phòng hoặc dịch vụ) */}
                        {currentRemainingBalance > 0 ? (
                            <div className="p-4.5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4 animate-in fade-in duration-200">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <CreditCard className="w-4 h-4 text-slate-700 shrink-0" />
                                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm uppercase tracking-wide">
                                            Yêu cầu thu thêm tiền phát sinh: <span className="text-rose-600 font-black">{formatCurrency(currentRemainingBalance)}</span>
                                        </h4>
                                    </div>
                                    <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[10px] border border-rose-200">
                                        Chưa thanh toán
                                    </span>
                                </div>

                                <p className="text-[11px] text-slate-500">
                                    Khách có phát sinh dịch vụ hoặc chưa thanh toán đủ tiền phòng. Vui lòng quét mã VietQR hoặc thu tiền mặt trước khi bấm hoàn tất Check-out.
                                </p>

                                {/* Lựa chọn phương thức thu */}
                                <div className="flex items-center gap-3">
                                    <label className="text-[11px] font-bold text-slate-700">Hình thức thanh toán:</label>
                                    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('bank_transfer')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${paymentMethod === 'bank_transfer'
                                                    ? 'bg-white text-slate-900 shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'
                                                }`}
                                        >
                                            <QrCode className="w-3.5 h-3.5" />
                                            <span>Quét mã VietQR</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPaymentMethod('cash')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${paymentMethod === 'cash'
                                                    ? 'bg-white text-slate-900 shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'
                                                }`}
                                        >
                                            <Banknote className="w-3.5 h-3.5" />
                                            <span>Tiền mặt tại quầy</span>
                                        </button>
                                    </div>
                                </div>

                                {/* FORM THANH TOÁN VIETQR */}
                                {paymentMethod === 'bank_transfer' && (
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-5">
                                        {/* Mã QR với viền nổi bật */}
                                        <div className="relative p-2 bg-white rounded-2xl border border-slate-300 max-w-[180px] w-full aspect-square flex items-center justify-center shrink-0 shadow-2xs">
                                            {qrUrl ? (
                                                <img
                                                    src={qrUrl}
                                                    alt={`VietQR thanh toán ${formatCurrency(currentRemainingBalance)}`}
                                                    className="w-full h-full object-contain rounded-xl"
                                                />
                                            ) : (
                                                <div className="text-[11px] text-slate-400 text-center">Đang nạp mã QR...</div>
                                            )}
                                        </div>

                                        {/* Chi tiết số tiền yêu cầu thanh toán */}
                                        <div className="space-y-2 text-xs text-slate-700 flex-1 w-full">
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                                <span>VietQR Chuyển khoản tức thì</span>
                                            </div>

                                            <div className="space-y-1 pt-1">
                                                <div className="flex justify-between border-b border-slate-200/70 pb-1">
                                                    <span className="text-slate-500">Ngân hàng:</span>
                                                    <strong className="text-slate-900">{bankConfig.bank_bin}</strong>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-200/70 pb-1">
                                                    <span className="text-slate-500">Số tài khoản:</span>
                                                    <strong className="font-mono text-slate-900">{bankConfig.account_no}</strong>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-200/70 pb-1">
                                                    <span className="text-slate-500">Chủ tài khoản:</span>
                                                    <strong className="text-slate-900">{bankConfig.account_name}</strong>
                                                </div>
                                                <div className="flex justify-between items-baseline pt-1">
                                                    <span className="font-bold text-slate-800">Số tiền cần quét:</span>
                                                    <strong className="text-base text-rose-600 font-black">{formatCurrency(currentRemainingBalance)}</strong>
                                                </div>
                                            </div>

                                            {/* Nút xác nhận thanh toán nợ */}
                                            <div className="pt-2">
                                                <button
                                                    type="button"
                                                    disabled={isProcessingDebtPayment}
                                                    onClick={handleConfirmDebtPayment}
                                                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                                                >
                                                    {isProcessingDebtPayment ? (
                                                        <>
                                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                            <span>Đang xác nhận thanh toán...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle2 className="w-4 h-4 text-white" />
                                                            <span>Xác nhận Đã nhận {formatCurrency(currentRemainingBalance)} qua VietQR</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* FORM THU TIỀN MẶT */}
                                {paymentMethod === 'cash' && (
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="font-bold text-slate-900 text-xs">Thu ngân tại quầy lễ tân:</div>
                                            <p className="text-[11px] text-slate-500">
                                                Lễ tân nhận trực tiếp số tiền <strong className="text-rose-600">{formatCurrency(currentRemainingBalance)}</strong> từ khách hàng.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={isProcessingDebtPayment}
                                            onClick={handleConfirmDebtPayment}
                                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                                        >
                                            {isProcessingDebtPayment ? (
                                                <>
                                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    <span>Đang ghi nhận...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Banknote className="w-4 h-4" />
                                                    <span>Xác nhận Đã thu tiền mặt</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* TRƯỜNG HỢP B: remaining_balance <= 0 */
                            isGroupRoom ? (
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 flex items-center justify-between animate-in fade-in duration-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
                                            <Building2 className="w-5 h-5 text-indigo-400" />
                                        </div>
                                        <div>
                                            <strong className="text-sm text-slate-900 block">
                                                {isCompanyAllInclusive
                                                    ? 'Quy chế Master-Billing: Công ty chi trả toàn bộ (All-Inclusive)'
                                                    : 'Quy chế Master-Billing: Tiền phòng chuyển HĐ Đoàn'}
                                            </strong>
                                            <span className="text-[11px] text-slate-500">
                                                {isCompanyAllInclusive
                                                    ? `Toàn bộ tiền phòng và phụ phí dịch vụ minibar đã được kết chuyển vào Hóa đơn tổng của Doanh nghiệp (#${groupBookingCode}). Khách không phải thanh toán tại quầy.`
                                                    : `Tiền phòng đã được kết chuyển vào Hóa đơn tổng của Doanh nghiệp (#${groupBookingCode}). Khách không nợ dịch vụ phát sinh tại phòng.`}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-800 font-black text-xs">
                                        0đ CẦN THU
                                    </span>
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 flex items-center justify-between animate-in fade-in duration-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                            <CheckCircle2 className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <strong className="text-sm text-slate-900 block">Folio Đã Cân Bằng (Đã Thanh Toán Đủ 100%)</strong>
                                            <span className="text-[11px] text-slate-500">
                                                Toàn bộ tiền phòng và phụ phí dịch vụ đã được tất toán thành công. Không phát sinh công nợ tại quầy.
                                            </span>
                                        </div>
                                    </div>
                                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs">
                                        0đ CẦN THU
                                    </span>
                                </div>
                            )
                        )}

                        {/* KHỐI HÓA ĐƠN VAT DOANH NGHIỆP / CÔNG TY */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <label className="flex items-center justify-between cursor-pointer select-none">
                                <div className="flex items-center gap-2.5">
                                    <Building2 className="w-4 h-4 text-slate-700 shrink-0" />
                                    <div>
                                        <span className="text-xs font-bold text-slate-900 block">Yêu cầu xuất Hóa đơn GTGT (VAT) Doanh nghiệp</span>
                                        <span className="text-[10px] text-slate-500">Dành cho khách đi công tác, đoàn công ty cần hóa đơn đỏ hợp lệ</span>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={isCompanyInvoice}
                                    onChange={(e) => setIsCompanyInvoice(e.target.checked)}
                                    className="w-4 h-4 text-slate-900 rounded-md focus:ring-slate-900 cursor-pointer"
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
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-700"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600 uppercase">Mã số thuế (MST) *</label>
                                        <input
                                            type="text"
                                            placeholder="VD: 0101248141"
                                            value={companyTaxCode}
                                            onChange={(e) => setCompanyTaxCode(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-700"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600 uppercase">Email nhận HĐĐT</label>
                                        <input
                                            type="email"
                                            placeholder="ketoan@company.com"
                                            value={invoiceRecipientEmail}
                                            onChange={(e) => setInvoiceRecipientEmail(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-700"
                                        />
                                    </div>
                                    <div className="space-y-1 sm:col-span-2">
                                        <label className="text-[10px] font-bold text-slate-600 uppercase">Địa chỉ đăng ký kinh doanh</label>
                                        <input
                                            type="text"
                                            placeholder="Địa chỉ ghi trên giấy phép ĐKKD"
                                            value={companyAddress}
                                            onChange={(e) => setCompanyAddress(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-700"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* GHI CHÚ NỘI BỘ KHI CHECK-OUT */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <span>Ghi chú trả phòng (Lễ tân):</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal">Không bắt buộc</span>
                            </label>
                            <input
                                type="text"
                                placeholder="VD: Khách đã bàn giao thẻ phòng, đồ đạc đầy đủ, hài lòng với dịch vụ..."
                                value={checkoutNote}
                                onChange={(e) => setCheckoutNote(e.target.value)}
                                disabled={isSubmitting}
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-700 transition"
                            />
                        </div>

                    </div>
                )}
                </div>

                {/* ========================================================================= */}
                {/* 3. STICKY FOOTER (ACTION BAR)                                             */}
                {/* ========================================================================= */}
                {!completedInvoice && !isLoading && !error && (
                    <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200/90 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="text-xs">
                            {!isPaymentSettled ? (
                                <span className="text-rose-600 font-bold flex items-center gap-1.5">
                                    <Lock className="w-4 h-4 text-rose-500 shrink-0" />
                                    <span>Cần tất toán khoản nợ <strong className="font-extrabold">{formatCurrency(currentRemainingBalance)}</strong> để hoàn tất Check-out</span>
                                </span>
                            ) : (
                                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>Folio đã cân bằng • Sẵn sàng hoàn tất Check-out</span>
                                </span>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2.5 shrink-0">
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={onClose}
                                className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition cursor-pointer disabled:opacity-50"
                            >
                                Hủy bỏ
                            </button>

                            <button
                                type="button"
                                disabled={isSubmitting || !isPaymentSettled}
                                onClick={handleConfirmCheckOut}
                                className={`px-5 py-2.5 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer active:scale-95 text-white ${
                                    !isPaymentSettled
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                                }`}
                                title={!isPaymentSettled ? 'Vui lòng hoàn tất thanh toán số tiền còn thiếu trước khi Check-out.' : 'Nhấn để hoàn tất Check-out và trả phòng'}
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang xử lý Check-out...</span>
                                    </>
                                ) : (
                                    <>
                                        {isPaymentSettled ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Lock className="w-4 h-4 text-slate-400" />}
                                        <span>Hoàn Tất Check-out & Trả Phòng</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* MODAL THÔNG BÁO XÁC NHẬN MÀU TRẮNG GIỮA MÀN HÌNH (THAY THẾ WINDOW.CONFIRM) */}
                {/* ========================================================================= */}
                {confirmDialog.isOpen && (
                    <div
                        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) closeConfirm();
                        }}
                    >
                        <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200 space-y-4">
                            {/* ICON TRÒN / BO GÓC NỔI BẬT */}
                            <div
                                className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-xs border"
                                style={{
                                    backgroundColor:
                                        confirmDialog.confirmType === 'emerald'
                                            ? '#ecfdf5'
                                            : confirmDialog.confirmType === 'amber'
                                            ? '#fffbeb'
                                            : confirmDialog.confirmType === 'rose'
                                            ? '#fff1f2'
                                            : '#eef2ff',
                                    borderColor:
                                        confirmDialog.confirmType === 'emerald'
                                            ? '#a7f3d0'
                                            : confirmDialog.confirmType === 'amber'
                                            ? '#fde68a'
                                            : confirmDialog.confirmType === 'rose'
                                            ? '#fecdd3'
                                            : '#c7d2fe',
                                }}
                            >
                                {renderConfirmIcon(confirmDialog.icon, confirmDialog.confirmType)}
                            </div>

                            {/* TIÊU ĐỀ & NỘI DUNG */}
                            <div className="space-y-2">
                                <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                                    {confirmDialog.title}
                                </h3>
                                {confirmDialog.message && (
                                    <p className="text-xs sm:text-sm font-semibold text-slate-700 leading-snug">
                                        {confirmDialog.message}
                                    </p>
                                )}
                                {confirmDialog.bullets && confirmDialog.bullets.length > 0 && (
                                    <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80 text-xs text-slate-700 text-left space-y-2 shadow-2xs">
                                        {confirmDialog.bullets.map((b, idx) => (
                                            <div key={idx} className="flex items-start gap-2.5">
                                                <span className="text-amber-500 font-bold shrink-0 mt-0.5">•</span>
                                                <span className="font-medium text-slate-800 leading-relaxed">{b}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {confirmDialog.detail && (
                                    <p className="text-xs text-slate-500 font-medium italic pt-1">
                                        {confirmDialog.detail}
                                    </p>
                                )}
                            </div>

                            {/* NÚT THAO TÁC: HUỶ VÀ ĐỒNG Ý */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeConfirm}
                                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer active:scale-95 text-center justify-center"
                                >
                                    {confirmDialog.cancelText || 'Huỷ'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (typeof confirmDialog.onConfirm === 'function') {
                                            confirmDialog.onConfirm();
                                        }
                                    }}
                                    className={`w-full py-2.5 px-4 rounded-xl text-white font-extrabold text-xs transition shadow-md cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 ${
                                        confirmDialog.confirmType === 'emerald'
                                            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 shadow-emerald-600/20'
                                            : confirmDialog.confirmType === 'rose'
                                            ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-600/20'
                                            : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/20'
                                    }`}
                                >
                                    {confirmDialog.confirmText || 'Xác nhận'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
