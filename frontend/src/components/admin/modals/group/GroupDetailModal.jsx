import React, { useState, useEffect, useMemo } from 'react';
import { bookingService } from '../../../../services/bookingService';
import api from '../../../../services/api';
import HotelInvoiceModal from '../shared/HotelInvoiceModal';

const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return `${num.toLocaleString('vi-VN')}đ`;
};

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

export default function GroupDetailModal({ group, isOpen, onClose, onRefresh }) {
    const [localGroup, setLocalGroup] = useState(group);

    useEffect(() => {
        if (group) {
            setLocalGroup(group);
        }
    }, [group]);

    const groupData = localGroup || group;

    const [isActionLoading, setIsActionLoading] = useState(false);
    const [actionMessage, setActionMessage] = useState(null);

    // Trạng thái Modal Quyết toán đoàn (Master Folio Settlement)
    const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
    const [settlementPaymentMethod, setSettlementPaymentMethod] = useState('transfer'); // 'transfer' | 'cash'
    const [isCompanyInvoice, setIsCompanyInvoice] = useState(
        Boolean(groupData?.corporate_partner_details || groupData?.corporate_partner || groupData?.company_name)
    );
    const [companyName, setCompanyName] = useState(
        groupData?.corporate_partner_details?.company_name || groupData?.corporate_partner?.company_name || groupData?.company_name || groupData?.group_name || ''
    );
    const [companyTaxCode, setCompanyTaxCode] = useState(
        groupData?.corporate_partner_details?.tax_code || groupData?.corporate_partner?.tax_code || groupData?.company_tax_code || ''
    );
    const [companyAddress, setCompanyAddress] = useState(
        groupData?.corporate_partner_details?.company_address || groupData?.corporate_partner?.company_address || groupData?.company_address || ''
    );
    const [invoiceRecipientEmail, setInvoiceRecipientEmail] = useState(
        groupData?.corporate_partner_details?.contact_email || groupData?.corporate_partner?.contact_email || groupData?.leader_email || ''
    );

    // Cấu hình ngân hàng VietQR động
    const [bankConfig, setBankConfig] = useState({
        bank_bin: '970422',
        account_no: '0344997778',
        account_name: 'KHACH SAN TA DA NANG'
    });

    useEffect(() => {
        let isMounted = true;
        api.get('/payments/config/').then(res => {
            if (isMounted) {
                const cData = res.data?.data || res.data;
                if (cData?.bank_bin) {
                    setBankConfig({
                        bank_bin: cData.bank_bin,
                        account_no: cData.account_no,
                        account_name: (cData.account_name || '').toUpperCase()
                    });
                }
            }
        }).catch(() => {});
        return () => { isMounted = false; };
    }, []);

    const subBookings = useMemo(() => {
        return groupData?.sub_bookings || [];
    }, [groupData?.sub_bookings]);
    const isCompleted = ['completed', 'checked_out'].includes(groupData?.status);
    const isCancelled = groupData?.status === 'cancelled';
    const hasInHouseRoom = groupData?.status === 'checked_in' || subBookings.some(b => b.status === 'checked_in');

    const inHouseSubBookings = useMemo(() => {
        return (subBookings || []).filter(b => b.status === 'checked_in');
    }, [subBookings]);

    const inspectionStats = useMemo(() => {
        const total = inHouseSubBookings.length;
        const completed = inHouseSubBookings.filter(b => b.latest_inspection?.status === 'completed').length;
        const requested = inHouseSubBookings.filter(b => b.latest_inspection?.status === 'requested').length;
        const pending = Math.max(0, total - completed - requested);
        const uninspectedRooms = inHouseSubBookings
            .filter(b => b.latest_inspection?.status !== 'completed')
            .map(b => b.room_number ? `P.${b.room_number}` : `#${b.booking_code}`);
        return { total, completed, requested, pending, uninspectedRooms };
    }, [inHouseSubBookings]);

    const totalContractAmount = useMemo(() => Number(groupData?.total_amount || 0), [groupData?.total_amount]);
    const depositAmount = useMemo(() => {
        if (groupData?.is_deposit_paid) {
            return Number(groupData?.deposit_amount || (totalContractAmount * 0.5));
        }
        return 0;
    }, [groupData?.is_deposit_paid, groupData?.deposit_amount, totalContractAmount]);

    const isFullPaid = useMemo(() => {
        return Boolean(groupData?.is_deposit_paid && Number(groupData?.deposit_amount || 0) >= totalContractAmount && totalContractAmount > 0);
    }, [groupData?.is_deposit_paid, groupData?.deposit_amount, totalContractAmount]);

    // Nếu công ty chi trả toàn bộ (ALL_INCLUSIVE), tổng hợp phụ phí dịch vụ phát sinh chưa thanh toán của các phòng
    const unpaidIncidentalsTotal = useMemo(() => {
        if (groupData?.billing_type !== 'ALL_INCLUSIVE') return 0;
        let sum = 0;
        (subBookings || []).forEach((b) => {
            if (b.extra_services && Array.isArray(b.extra_services)) {
                b.extra_services.forEach((s) => {
                    if (!s.is_paid) {
                        sum += Number(s.total_price || 0);
                    }
                });
            }
        });
        return sum;
    }, [groupData?.billing_type, subBookings]);

    const totalSettlementDue = useMemo(() => {
        return totalContractAmount + unpaidIncidentalsTotal;
    }, [totalContractAmount, unpaidIncidentalsTotal]);

    const remainingSettlementBalance = useMemo(() => {
        return Math.max(0, totalSettlementDue - depositAmount);
    }, [totalSettlementDue, depositAmount]);

    const groupQrUrl = useMemo(() => {
        if (!bankConfig.bank_bin || !bankConfig.account_no || remainingSettlementBalance <= 0) return '';
        const addInfo = encodeURIComponent(`Thanh toan doan ${groupData?.group_code || ''}`);
        return `https://img.vietqr.io/image/${bankConfig.bank_bin}-${bankConfig.account_no}-compact2.jpg?amount=${remainingSettlementBalance}&addInfo=${addInfo}&accountName=${encodeURIComponent(bankConfig.account_name)}`;
    }, [bankConfig, remainingSettlementBalance, groupData?.group_code]);

    const handleUpdateBillingType = async (newType) => {
        if (isCompleted || isCancelled) return;
        try {
            setIsActionLoading(true);
            const res = await bookingService.updateGroupBillingType(groupData.id, newType);
            if (res.success) {
                setActionMessage({
                    type: 'success',
                    text: `Đã đổi chính sách thanh toán sang: ${newType === 'ALL_INCLUSIVE' ? 'Công ty chi trả toàn bộ (ALL_INCLUSIVE)' : 'Khách tự trả phát sinh tại phòng (ROOM_ONLY)'}`
                });
                if (res.data) {
                    setLocalGroup(res.data);
                } else {
                    setLocalGroup(prev => ({
                        ...prev,
                        billing_type: newType,
                        billing_type_display: newType === 'ALL_INCLUSIVE' ? 'Công ty chi trả toàn bộ' : 'Khách tự trả phát sinh'
                    }));
                }
                if (typeof onRefresh === 'function') onRefresh(res.data, false);
            } else {
                setActionMessage({ type: 'error', text: res.message || 'Không thể cập nhật chính sách.' });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Lỗi khi cập nhật chính sách thanh toán.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    // State cho Modal xác nhận nền trắng giữa màn hình (thay thế window.confirm mặc định)
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        detail: '',
        confirmText: 'Xác nhận',
        confirmType: 'emerald', // 'emerald' | 'amber' | 'indigo' | 'rose'
        icon: '🔑',
        onConfirm: null
    });

    const showConfirm = ({ title, message, detail, confirmText, confirmType = 'emerald', icon = '🔑', onConfirm }) => {
        setConfirmDialog({
            isOpen: true,
            title,
            message,
            detail,
            confirmText: confirmText || 'Xác nhận',
            confirmType,
            icon,
            onConfirm
        });
    };

    const closeConfirm = () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false, onConfirm: null }));
    };

    if (!isOpen || !groupData) return null;

    // Check-in All Rooms (Thực thi)
    const executeCheckInAll = async () => {
        closeConfirm();
        try {
            setIsActionLoading(true);
            const res = await bookingService.groupCheckIn(groupData.id);
            if (res.success) {
                setActionMessage({ type: 'success', text: res.message || 'Check-in toàn bộ đoàn thành công!' });
                if (res.data) setLocalGroup(res.data);
                if (typeof onRefresh === 'function') onRefresh(res.data, false);
            } else {
                setActionMessage({ type: 'error', text: res.message });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Lỗi kết nối máy chủ.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    // Check-in All Rooms (Mở hộp thoại nền trắng)
    const handleCheckInAll = () => {
        showConfirm({
            title: 'Xác Nhận Check-in Toàn Đoàn',
            message: `Bạn có chắc chắn muốn Check-in đồng loạt cho toàn bộ các phòng thuộc đoàn #${groupData.group_code}?`,
            detail: `Đoàn khách: "${groupData.group_name}" • Đại diện: ${groupData.leader_name} (${groupData.leader_phone}). Tất cả ${subBookings.length} phòng sẽ tự động chuyển sang trạng thái "Đang ở (In-house)".`,
            confirmText: '✓ Đồng Ý Check-in Toàn Đoàn',
            confirmType: 'emerald',
            icon: '🔑',
            onConfirm: executeCheckInAll
        });
    };

    // Check-in từng phòng lẻ trong đoàn (Thực thi)
    const executeSingleRoomCheckIn = async (bookingId, roomNumber) => {
        closeConfirm();
        try {
            setIsActionLoading(true);
            const res = await bookingService.checkInBooking(bookingId, {});
            if (res.success) {
                setActionMessage({ type: 'success', text: `Check-in phòng ${roomNumber || bookingId} thành công!` });
                if (typeof onRefresh === 'function') onRefresh(null, false);
            } else {
                setActionMessage({ type: 'error', text: res.message || 'Lỗi khi check-in phòng.' });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Lỗi kết nối máy chủ.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    // Check-in từng phòng lẻ trong đoàn (Mở hộp thoại nền trắng)
    const handleSingleRoomCheckIn = (bookingId, roomNumber) => {
        showConfirm({
            title: 'Xác Nhận Check-in Phòng',
            message: `Xác nhận làm thủ tục nhận phòng cho phòng ${roomNumber || bookingId}?`,
            detail: `Phòng thuộc đoàn #${groupData.group_code} (${groupData.group_name}). Tiền phòng được bảo lãnh và quyết toán theo hợp đồng đoàn (Master-Billing).`,
            confirmText: '✓ Nhận Phòng Ngay',
            confirmType: 'emerald',
            icon: '🔑',
            onConfirm: () => executeSingleRoomCheckIn(bookingId, roomNumber)
        });
    };

    // Check-out từng phòng lẻ trong đoàn (Thực thi)
    const executeSingleRoomCheckOut = async (bookingId, roomNumber) => {
        closeConfirm();
        try {
            setIsActionLoading(true);
            const res = await bookingService.checkOut(bookingId, { payment_method: 'transfer' });
            if (res.success) {
                setActionMessage({ type: 'success', text: `Check-out phòng ${roomNumber || bookingId} thành công! Phòng đã chuyển sang trạng thái Dọn dẹp.` });
                if (typeof onRefresh === 'function') onRefresh(null, false);
            } else {
                setActionMessage({ type: 'error', text: res.message || 'Lỗi khi check-out phòng.' });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Lỗi kết nối máy chủ.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    // Check-out từng phòng lẻ trong đoàn (Mở hộp thoại nền trắng)
    const handleSingleRoomCheckOut = (bookingId, roomNumber) => {
        const isAllInclusive = groupData?.billing_type === 'ALL_INCLUSIVE';
        showConfirm({
            title: 'Xác Nhận Check-out Phòng Lẻ',
            message: `Xác nhận làm thủ tục trả phòng cho phòng ${roomNumber || bookingId}?`,
            detail: isAllInclusive
                ? `Tiền phòng & mọi dịch vụ phát sinh của phòng này đã được CÔNG TY BẢO LÃNH CHI TRẢ TOÀN BỘ theo HĐ đoàn #${groupData.group_code}. Khách không cần thanh toán tại quầy lễ tân.`
                : `Tiền phòng đã bảo lãnh theo HĐ đoàn #${groupData.group_code}. Khách lưu trú chỉ thanh toán dịch vụ phát sinh cá nhân (nếu có) tại quầy lễ tân. Sau khi trả phòng, phòng sẽ chuyển sang trạng thái "Cần dọn dẹp".`,
            confirmText: '✓ Xác Nhận Trả Phòng',
            confirmType: 'amber',
            icon: '🚪',
            onConfirm: () => executeSingleRoomCheckOut(bookingId, roomNumber)
        });
    };

    // Yêu cầu kiểm phòng toàn đoàn (Thực thi)
    const executeRequestGroupInspection = async () => {
        closeConfirm();
        try {
            setIsActionLoading(true);
            const res = await bookingService.requestGroupInspection(groupData.id);
            if (res.success) {
                setActionMessage({
                    type: 'success',
                    text: res.message || `Đã gửi yêu cầu kiểm tra ${inHouseSubBookings.length} phòng cho bộ phận Buồng phòng!`
                });
                if (res.data) setLocalGroup(res.data);
                if (typeof onRefresh === 'function') onRefresh(res.data, false);
            } else {
                setActionMessage({ type: 'error', text: res.message || 'Lỗi khi gửi yêu cầu kiểm phòng đoàn.' });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Lỗi kết nối máy chủ.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    // Yêu cầu kiểm phòng toàn đoàn (Mở hộp thoại nền trắng)
    const handleRequestGroupInspection = () => {
        if (inHouseSubBookings.length === 0) {
            alert('Không có phòng nào đang lưu trú (In-house) để gửi yêu cầu kiểm tra.');
            return;
        }
        showConfirm({
            title: 'Yêu Cầu Kiểm Phòng Toàn Đoàn',
            message: `Gửi yêu cầu bộ phận Buồng phòng tiến hành kiểm tra đón đầu Minibar & Hư hại cho tất cả ${inHouseSubBookings.length} phòng đang ở?`,
            detail: `Danh sách phòng: ${inHouseSubBookings.map(b => b.room_number ? `P.${b.room_number}` : `#${b.booking_code}`).join(', ')}. Thông báo ưu tiên cao sẽ được gửi ngay đến nhân viên buồng phòng để kiểm tra trước khi đoàn làm thủ tục Check-out.`,
            confirmText: '🛎️ Gửi Yêu Cầu Kiểm Phòng',
            confirmType: 'indigo',
            icon: '🛎️',
            onConfirm: executeRequestGroupInspection
        });
    };

    // Xác nhận quyết toán và Check-out Toàn Đoàn
    const handleConfirmGroupSettlement = async () => {
        try {
            setIsActionLoading(true);
            const payload = {
                payment_method: settlementPaymentMethod,
                mark_invoice_paid: true,
                is_company_invoice: isCompanyInvoice,
                company_name: isCompanyInvoice ? companyName.trim() : null,
                company_tax_code: isCompanyInvoice ? companyTaxCode.trim() : null,
                company_address: isCompanyInvoice ? companyAddress.trim() : null,
                invoice_recipient_email: isCompanyInvoice ? invoiceRecipientEmail.trim() : null
            };
            const res = await bookingService.groupCheckOut(groupData.id, payload);
            if (res.success) {
                setIsSettlementModalOpen(false);
                setActionMessage({ type: 'success', text: 'Quyết toán và check-out toàn bộ đoàn thành công!' });
                if (typeof onRefresh === 'function') onRefresh(null, true);
            } else {
                setActionMessage({ type: 'error', text: res.message || 'Check-out đoàn thất bại.' });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Lỗi kết nối máy chủ.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    // Confirm Deposit
    const handleConfirmDeposit = async () => {
        try {
            setIsActionLoading(true);
            const res = await bookingService.confirmGroupDeposit(groupData.id);
            if (res.success) {
                setActionMessage({ type: 'success', text: res.message });
                if (res.data) setLocalGroup(res.data);
                if (typeof onRefresh === 'function') onRefresh(res.data, false);
            } else {
                setActionMessage({ type: 'error', text: res.message });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Lỗi khi xác nhận tiền cọc.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    // Gửi lại Email xác nhận đoàn
    const handleResendEmail = async () => {
        try {
            setIsActionLoading(true);
            const res = await bookingService.resendGroupBookingEmail(groupData.id);
            if (res.success) {
                setActionMessage({ type: 'success', text: res.message || 'Đã gửi email xác nhận đoàn thành công!' });
            } else {
                setActionMessage({ type: 'error', text: res.message || 'Không thể gửi email đoàn.' });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Lỗi khi gửi email đoàn.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    // Hủy Toàn Bộ Đơn Đoàn (Thực thi)
    const executeCancelGroup = async (reason = 'Lễ tân / Quản lý yêu cầu hủy đoàn') => {
        closeConfirm();
        try {
            setIsActionLoading(true);
            const res = await bookingService.cancelGroupBooking(groupData.id, reason);
            if (res.success) {
                setActionMessage({ type: 'success', text: res.message || 'Đã hủy toàn bộ đoàn thành công!' });
                if (res.data) setLocalGroup(res.data);
                if (typeof onRefresh === 'function') onRefresh(res.data, false);
            } else {
                setActionMessage({ type: 'error', text: res.message || 'Lỗi khi hủy đơn đoàn.' });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Lỗi kết nối máy chủ.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    // Hủy Toàn Bộ Đơn Đoàn (Mở hộp thoại nền trắng)
    const handleCancelGroup = () => {
        if (hasInHouseRoom) {
            setActionMessage({
                type: 'error',
                text: 'Đoàn đang lưu trú tại khách sạn (In-house), không thể hủy. Vui lòng thực hiện thủ tục Check-out & Quyết toán.'
            });
            return;
        }

        showConfirm({
            title: 'Xác Nhận Hủy Toàn Bộ Đoàn',
            message: `Bạn có chắc chắn muốn HỦY TOÀN BỘ đơn đoàn #${groupData.group_code}?`,
            detail: `Đoàn "${groupData.group_name}" gồm ${subBookings.length} phòng. Tất cả các phòng con sẽ chuyển sang trạng thái "Đã Hủy", giải phóng phòng trống (available) và hủy các yêu cầu dịch vụ liên quan.`,
            confirmText: '✕ Xác Nhận Hủy Cả Đoàn',
            confirmType: 'rose',
            icon: '✕',
            onConfirm: () => executeCancelGroup('Lễ tân / Quản lý hủy đơn đoàn')
        });
    };

    // Hủy riêng 1 phòng con trong đoàn (Thực thi)
    const executeSingleRoomCancel = async (bookingId, roomNumber) => {
        closeConfirm();
        try {
            setIsActionLoading(true);
            const res = await bookingService.cancelBooking(bookingId, `Hủy lẻ phòng ${roomNumber || ''} trong đoàn #${groupData.group_code}`);
            if (res.success || res.status === 'cancelled') {
                setActionMessage({ type: 'success', text: `Đã hủy phòng ${roomNumber || bookingId} khỏi đoàn. Hệ thống đã tự động tính lại tổng tiền đoàn.` });
                if (typeof onRefresh === 'function') onRefresh(null, false);
            } else {
                setActionMessage({ type: 'error', text: res.message || 'Không thể hủy phòng này.' });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Lỗi khi hủy phòng lẻ.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    // Hủy riêng 1 phòng con trong đoàn (Mở hộp thoại nền trắng)
    const handleSingleRoomCancel = (bookingId, roomNumber) => {
        showConfirm({
            title: 'Xác Nhận Hủy Phòng Lẻ Khỏi Đoàn',
            message: `Bạn có chắc chắn muốn HỦY phòng ${roomNumber || bookingId} khỏi đoàn #${groupData.group_code}?`,
            detail: `Phòng này sẽ được hủy và giải phóng về trạng thái phòng trống. Các phòng còn lại của đoàn vẫn được giữ nguyên. Hệ thống sẽ tự động cập nhật lại tổng tiền hợp đồng của đoàn.`,
            confirmText: '✕ Xác Nhận Hủy Phòng Này',
            confirmType: 'rose',
            icon: '✕',
            onConfirm: () => executeSingleRoomCancel(bookingId, roomNumber)
        });
    };

    // State mở modal in hóa đơn đoàn
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

    // Dữ liệu mapping chuẩn cho HotelInvoiceModal
    const invoiceBookingData = useMemo(() => {
        if (!groupData) return null;
        const partner = groupData.corporate_partner_details || groupData.corporate_partner;
        const totalAmount = Number(groupData.total_amount) || 0;
        const depositAmount = Number(groupData.deposit_amount) || 0;
        const isAllInclusive = groupData.billing_type === 'ALL_INCLUSIVE';
        const finalGrandTotal = isAllInclusive ? (totalAmount + unpaidIncidentalsTotal) : totalAmount;

        return {
            ...groupData,
            id: groupData.id,
            is_group_master: true,
            billing_type: groupData.billing_type,
            billing_type_display: groupData.billing_type_display,
            is_all_inclusive: isAllInclusive,
            booking_code: groupData.group_code,
            group_code: groupData.group_code,
            group_name: groupData.group_name,
            guest_name: groupData.leader_name,
            customer_name: groupData.leader_name,
            guest_phone: groupData.leader_phone,
            guest_email: groupData.leader_email,
            customer_type: 'CORPORATE',
            company_name: partner?.company_name || groupData.company_name || groupData.group_name,
            company_tax_code: partner?.tax_code || groupData.company_tax_code || '—',
            company_address: partner?.address || groupData.company_address || '—',
            room_name: groupData.group_name,
            room_number: `Đoàn ${groupData.total_rooms || subBookings.length} phòng`,
            check_in_date: groupData.check_in_date,
            check_out_date: groupData.check_out_date,
            nights: groupData.nights || 1,
            total_amount: finalGrandTotal,
            room_amount: totalAmount,
            incidentals_amount: unpaidIncidentalsTotal,
            grand_total_amount: finalGrandTotal,
            deposit_amount: depositAmount,
            is_deposit_paid: Boolean(groupData.is_deposit_paid || isCompleted),
            status: groupData.status,
            is_paid: isCompleted,
            sub_bookings: subBookings || [],
            payment_method: 'Hợp đồng Doanh nghiệp B2B (VietQR / Chuyển khoản)',
            note: groupData.note || ''
        };
    }, [groupData, subBookings, isCompleted, unpaidIncidentalsTotal]);

    const [isEditingRoomingList, setIsEditingRoomingList] = useState(false);
    const [roomingForm, setRoomingForm] = useState({});

    const handleStartEditRooming = () => {
        if (isCompleted) {
            alert('Đoàn này đã hoàn tất lưu trú và quyết toán xong. Hồ sơ lưu trú đã khóa và không thể chỉnh sửa!');
            return;
        }
        const initial = {};
        subBookings.forEach((b) => {
            const existingGuests = (b.guests && Array.isArray(b.guests) && b.guests.length > 0)
                ? b.guests.map((g, gIdx) => ({
                    id: g.id || `guest_${b.id}_${gIdx}`,
                    full_name: g.full_name || '',
                    id_type: g.id_type || 'CCCD',
                    id_number: g.id_number || '',
                    date_of_birth: g.date_of_birth || '',
                    gender: g.gender || 'Nam',
                    nationality: g.nationality || 'Việt Nam',
                    is_primary: Boolean(g.is_primary ?? gIdx === 0)
                }))
                : [
                    {
                        id: `guest_${b.id}_primary`,
                        full_name: b.guest_name || groupData.leader_name || '',
                        id_type: 'CCCD',
                        id_number: b.identity_card || '',
                        date_of_birth: '',
                        gender: 'Nam',
                        nationality: 'Việt Nam',
                        is_primary: true
                    }
                ];

            const roomCap = Number(b.capacity || b.category?.capacity || 2);
            initial[b.id] = {
                booking_id: b.id,
                room_number: b.room_number,
                room_name: b.room_name,
                booking_code: b.booking_code,
                capacity: roomCap,
                guests: existingGuests
            };
        });
        setRoomingForm(initial);
        setIsEditingRoomingList(true);
    };

    const handleAddGuestToRoom = (bookingId) => {
        setRoomingForm((prev) => {
            const currentRoom = prev[bookingId];
            if (!currentRoom) return prev;
            const maxCap = Number(currentRoom.capacity || 2);
            if (currentRoom.guests.length >= maxCap) {
                alert(`Phòng này có sức chứa tối đa ${maxCap} người. Không thể thêm vượt quá sức chứa quy định!`);
                return prev;
            }
            const newGuest = {
                id: `guest_${bookingId}_${Date.now()}`,
                full_name: '',
                id_type: 'CCCD',
                id_number: '',
                date_of_birth: '',
                gender: 'Nam',
                nationality: 'Việt Nam',
                is_primary: false
            };
            return {
                ...prev,
                [bookingId]: {
                    ...currentRoom,
                    guests: [...currentRoom.guests, newGuest]
                }
            };
        });
    };

    const handleRemoveGuestFromRoom = (bookingId, guestIndex) => {
        setRoomingForm((prev) => {
            const currentRoom = prev[bookingId];
            if (!currentRoom) return prev;
            const newGuests = currentRoom.guests.filter((_, idx) => idx !== guestIndex);
            if (newGuests.length > 0 && !newGuests.some(g => g.is_primary)) {
                newGuests[0].is_primary = true;
            }
            return {
                ...prev,
                [bookingId]: {
                    ...currentRoom,
                    guests: newGuests
                }
            };
        });
    };

    const handleGuestFieldChange = (bookingId, guestIndex, field, value) => {
        setRoomingForm((prev) => {
            const currentRoom = prev[bookingId];
            if (!currentRoom) return prev;
            const updatedGuests = [...currentRoom.guests];
            updatedGuests[guestIndex] = {
                ...updatedGuests[guestIndex],
                [field]: value
            };
            return {
                ...prev,
                [bookingId]: {
                    ...currentRoom,
                    guests: updatedGuests
                }
            };
        });
    };

    const handleSaveRoomingList = async (e) => {
        if (e) {
            if (typeof e.preventDefault === 'function') e.preventDefault();
            if (typeof e.stopPropagation === 'function') e.stopPropagation();
        }
        try {
            setIsActionLoading(true);
            const roomsPayload = Object.values(roomingForm).map((roomItem) => {
                const primaryGuest = roomItem.guests.find(g => g.is_primary) || roomItem.guests[0];
                return {
                    booking_id: roomItem.booking_id,
                    guest_name: primaryGuest?.full_name || '',
                    identity_card: primaryGuest?.id_number || '',
                    guests: roomItem.guests.map(g => ({
                        full_name: g.full_name?.trim() || '',
                        id_type: g.id_type || 'CCCD',
                        id_number: g.id_number?.trim() || '',
                        date_of_birth: g.date_of_birth || null,
                        gender: g.gender || 'Nam',
                        nationality: g.nationality?.trim() || 'Việt Nam',
                        is_primary: Boolean(g.is_primary)
                    }))
                };
            });
            const res = await bookingService.updateRoomingList(groupData.id, { rooms: roomsPayload });
            if (res.success) {
                setActionMessage({ type: 'success', text: 'Cập nhật danh sách Rooming List và CCCD thành công!' });
                setIsEditingRoomingList(false);
                if (res.data) {
                    setLocalGroup(res.data);
                }
                if (typeof onRefresh === 'function') onRefresh(res.data, false);
            } else {
                setActionMessage({ type: 'error', text: res.message });
            }
        } catch (err) {
            setActionMessage({ type: 'error', text: 'Lỗi khi cập nhật Rooming List.' });
        } finally {
            setIsActionLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 flex items-center justify-center p-2.5 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 max-w-5xl w-full p-4 sm:p-8 shadow-2xl text-left max-h-[94vh] overflow-y-auto animate-in zoom-in-95 duration-200 flex flex-col justify-between">
                
                <div>
                    {/* MODAL HEADER */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 mb-5 gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white flex items-center justify-center text-lg sm:text-xl shadow-md shadow-indigo-500/20 shrink-0 mt-0.5">
                                🏢
                            </div>
                            <div className="min-w-0 flex-1">
                                {/* Hàng 1: Tiêu đề + Mã đoàn + Trạng thái */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="font-serif text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                                        {groupData.group_name}
                                    </h2>
                                    <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 shrink-0">
                                        #{groupData.group_code}
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide inline-flex items-center gap-1 shrink-0 ${
                                        isCancelled
                                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                            : isCompleted
                                            ? 'bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs'
                                            : groupData.status === 'checked_in'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-blue-100 text-blue-800'
                                    }`}>
                                        <span>{isCancelled ? '✕' : isCompleted ? '✓' : groupData.status === 'checked_in' ? '🔑' : '📋'}</span>
                                        <span>{isCancelled ? 'ĐÃ HỦY TOÀN ĐOÀN' : isCompleted ? 'ĐÃ HOÀN THÀNH (ĐÃ QUYẾT TOÁN)' : (groupData.status_display || groupData.status)}</span>
                                    </span>
                                </div>

                                {/* Hàng 2: Đối tác Doanh nghiệp & Chính sách thanh toán (Sub-line tinh gọn) */}
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5">
                                    {groupData.corporate_partner_details && (
                                        <span className="inline-flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 text-[11px]">
                                            🏢 {groupData.corporate_partner_details.company_name} (-{groupData.corporate_partner_details.discount_percent}%)
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        disabled={isCompleted || isCancelled || isActionLoading}
                                        onClick={() => handleUpdateBillingType(groupData.billing_type === 'ALL_INCLUSIVE' ? 'ROOM_ONLY' : 'ALL_INCLUSIVE')}
                                        title="Bấm để chuyển đổi chính sách chi trả giữa Công ty chi trả toàn bộ và Khách tự trả phát sinh"
                                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border transition inline-flex items-center gap-1 cursor-pointer active:scale-95 disabled:cursor-not-allowed ${
                                            groupData.billing_type === 'ALL_INCLUSIVE'
                                                ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 shadow-2xs'
                                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 shadow-2xs'
                                        }`}
                                    >
                                        <span>{groupData.billing_type === 'ALL_INCLUSIVE' ? '🏢 Công ty chi trả toàn bộ' : '👤 Khách tự trả phát sinh'}</span>
                                        {!isCompleted && !isCancelled && (
                                            <span className="text-[10px] text-slate-400 font-normal underline ml-0.5">đổi</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Cụm Action Buttons: Nằm ngang 1 hàng duy nhất, không bị gãy */}
                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                            <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={handleResendEmail}
                                className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 whitespace-nowrap shadow-2xs"
                                title="Gửi thư xác nhận đặt đoàn qua Email Trưởng đoàn / Công ty"
                            >
                                <span>✉️ Gửi Email Đoàn</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsInvoiceModalOpen(true)}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition inline-flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap shadow-2xs"
                                title="Xem và in hóa đơn thanh toán cho toàn đoàn"
                            >
                                <span>🖨️ In Hóa Đơn</span>
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center font-bold text-base cursor-pointer shrink-0"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* ACTION MESSAGE */}
                    {actionMessage && (
                        <div className={`mb-5 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                            actionMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                            <span>{actionMessage.type === 'success' ? '✓' : '⚠️'}</span>
                            <span>{actionMessage.text}</span>
                        </div>
                    )}

                    {/* BẢNG TỔNG QUAN HỢP ĐỒNG & THÔNG TIN TRƯỞNG ĐOÀN */}
                    <div className="bg-slate-50/90 rounded-2xl border border-slate-200 p-3.5 sm:p-4 mb-6">
                        {/* 4 Thẻ KPI Thông số chính */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                            <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quy mô đoàn</span>
                                <div className="text-sm sm:text-base font-black text-slate-900 mt-0.5">{groupData.total_rooms || subBookings.length} phòng</div>
                            </div>

                            <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Lưu trú</span>
                                <div className="text-xs font-bold text-slate-900 mt-0.5">
                                    {formatDate(groupData.check_in_date)} - {formatDate(groupData.check_out_date)} ({groupData.nights} đêm)
                                </div>
                            </div>

                            <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tổng tiền hợp đồng</span>
                                <div className="text-sm sm:text-base font-black text-indigo-700 mt-0.5">{formatCurrency(groupData.total_amount)}</div>
                            </div>

                            <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    {isCompleted ? 'Quyết toán hợp đồng' : (isFullPaid ? 'Thanh toán hợp đồng' : 'Đặt cọc')}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-xs font-bold text-slate-900">
                                        {formatCurrency(isCompleted ? groupData.total_amount : groupData.deposit_amount)}
                                    </span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                        isCompleted
                                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                            : isFullPaid
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            : groupData.is_deposit_paid
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-amber-100 text-amber-800'
                                    }`}>
                                        {isCompleted ? '✓ Đã quyết toán 100%' : (isFullPaid ? '✓ Đã thanh toán 100%' : (groupData.is_deposit_paid ? 'Đã cọc' : 'Chờ cọc'))}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Thanh thông tin Trưởng đoàn liền mạch */}
                        <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                                    👤
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                    <span className="text-slate-400 text-[11px] font-semibold">Trưởng đoàn:</span>
                                    <strong className="text-slate-900 font-bold">{groupData.leader_name}</strong>
                                    <span className="text-slate-600 flex items-center gap-1">📞 {groupData.leader_phone}</span>
                                    {groupData.leader_email && <span className="text-slate-600 flex items-center gap-1">✉️ {groupData.leader_email}</span>}
                                </div>
                            </div>

                            {!groupData.is_deposit_paid && (
                                <button
                                    type="button"
                                    disabled={isActionLoading}
                                    onClick={handleConfirmDeposit}
                                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer active:scale-95"
                                >
                                    💰 Xác nhận đã nhận tiền cọc
                                </button>
                            )}
                        </div>
                    </div>

                    {/* DANH SÁCH CÁC PHÒNG CON (SUB-BOOKINGS) & ROOMING LIST */}
                    <div className="space-y-3 mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                    <span>🛏️</span>
                                    <span>Danh Sách Phân Phòng & Khai Báo Lưu Trú ({subBookings.length} phòng)</span>
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Khai báo thông tin người đại diện và người ở cùng phòng cho toàn bộ đoàn
                                </p>
                            </div>

                            {isCompleted ? (
                                <span className="px-3.5 py-2 rounded-xl font-bold text-xs bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1.5 shadow-2xs self-start sm:self-auto select-none">
                                    <span>🔒</span>
                                    <span>Hồ sơ lưu trú đã khóa (Đoàn đã hoàn tất)</span>
                                </span>
                            ) : !isEditingRoomingList ? (
                                <button
                                    type="button"
                                    onClick={handleStartEditRooming}
                                    className="px-3.5 py-2 rounded-xl font-bold text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition flex items-center gap-1.5 cursor-pointer shadow-2xs self-start sm:self-auto"
                                >
                                    <span>📝</span>
                                    <span>Cập nhật Rooming List & Khai báo CCCD</span>
                                </button>
                            ) : (
                                <div className="flex items-center gap-2 self-start sm:self-auto">
                                    <button
                                        type="button"
                                        disabled={isActionLoading}
                                        onClick={handleSaveRoomingList}
                                        className="px-4 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                    >
                                        <span>💾</span>
                                        <span>Lưu Danh Sách Toàn Đoàn</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingRoomingList(false)}
                                        className="px-3.5 py-2 rounded-xl font-semibold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                    >
                                        Hủy
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* DANH SÁCH CÁC PHÒNG VÀ KHÁCH Ở TỪNG PHÒNG */}
                        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                            {subBookings.map((b, roomIdx) => {
                                const roomData = roomingForm[b.id];
                                const currentGuests = isEditingRoomingList
                                    ? (roomData?.guests || [])
                                    : (b.guests && b.guests.length > 0 ? b.guests : [{ full_name: b.guest_name || groupData.leader_name, identity_card: b.identity_card, is_primary: true }]);

                                const roomCap = Number(roomData?.capacity || b.capacity || b.category?.capacity || 2);
                                const guestCount = currentGuests.length;
                                const isFull = guestCount >= roomCap;

                                return (
                                    <div
                                        key={b.id || roomIdx}
                                        className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-200 shadow-2xs transition space-y-3"
                                    >
                                        {/* HEADER CỦA TỪNG PHÒNG */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                                            <div className="flex items-center gap-2.5">
                                                <span className="font-mono text-xs font-bold text-slate-400">#{roomIdx + 1}</span>
                                                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-col items-center justify-center shrink-0">
                                                    <span className="text-[8px] uppercase font-bold text-indigo-500">Phòng</span>
                                                    <span className="text-xs font-black text-indigo-800">{b.room_number || '—'}</span>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                                                        <span>{b.room_name || 'Phòng tiêu chuẩn'}</span>
                                                        <span className="font-mono text-[10px] text-slate-400">#{b.booking_code}</span>
                                                    </div>
                                                    <span className="text-[11px] text-slate-500">
                                                        Giá: <strong className="text-slate-700">{formatCurrency(b.total_amount)}</strong>
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {/* Badge hiển thị sức chứa và số lượng khách đã xếp */}
                                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border ${
                                                    isFull
                                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                                }`}>
                                                    <span>👥</span>
                                                    <span>{guestCount}/{roomCap} người</span>
                                                    {isFull && <span className="text-[9px] text-amber-600 font-semibold">(Đã tối đa)</span>}
                                                </span>

                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    b.status === 'checked_in'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : (b.status === 'completed' || b.status === 'checked_out')
                                                        ? 'bg-slate-100 text-slate-600'
                                                        : b.status === 'cancelled'
                                                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                        : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                    {b.status === 'cancelled' ? '✕ Đã Hủy' : (b.status_display || b.status)}
                                                </span>

                                                {/* Badge trạng thái kiểm phòng Minibar & Hư hại */}
                                                {b.status === 'checked_in' && (
                                                    b.latest_inspection?.status === 'completed' ? (
                                                        <span 
                                                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shadow-2xs"
                                                            title={b.latest_inspection.has_damage ? `Đã kiểm tra. Phát hiện hư hại: ${b.latest_inspection.damage_description}` : 'Đã kiểm tra Minibar & Hư hại'}
                                                        >
                                                            <span>✓</span>
                                                            <span>Đã kiểm phòng</span>
                                                            {Number(b.latest_inspection.total_amount || 0) > 0 && (
                                                                <span className="font-mono text-emerald-800 font-extrabold">({formatCurrency(b.latest_inspection.total_amount)})</span>
                                                            )}
                                                        </span>
                                                    ) : b.latest_inspection?.status === 'requested' ? (
                                                        <span 
                                                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 animate-pulse shadow-2xs"
                                                            title="Đã gửi yêu cầu, đang chờ Buồng phòng kiểm tra"
                                                        >
                                                            <span>⏳</span>
                                                            <span>Đang kiểm tra...</span>
                                                        </span>
                                                    ) : (
                                                        <span 
                                                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1"
                                                            title="Phòng chưa được kiểm tra Minibar & Hư hại"
                                                        >
                                                            <span>⚠️</span>
                                                            <span>Chưa kiểm phòng</span>
                                                        </span>
                                                    )
                                                )}

                                                {/* Thao tác Check-in / Check-out / Hủy cho từng phòng lẻ trong đoàn */}
                                                {!isEditingRoomingList && (
                                                    <div className="flex items-center gap-1.5">
                                                        {b.status === 'confirmed' && (
                                                             <button
                                                                type="button"
                                                                disabled={isActionLoading}
                                                                onClick={() => handleSingleRoomCheckIn(b.id, b.room_number)}
                                                                title="Check-in cho phòng lẻ này (Tiền phòng bảo lãnh theo HĐ đoàn)"
                                                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition flex items-center gap-1 cursor-pointer active:scale-95"
                                                            >
                                                                <span>🔑</span>
                                                                <span>Check-in</span>
                                                            </button>
                                                        )}
                                                        {['pending', 'confirmed'].includes(b.status) && (
                                                            <button
                                                                type="button"
                                                                disabled={isActionLoading}
                                                                onClick={() => handleSingleRoomCancel(b.id, b.room_number)}
                                                                title="Hủy riêng phòng lẻ này khỏi đoàn"
                                                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition flex items-center gap-1 cursor-pointer active:scale-95"
                                                            >
                                                                <span>✕</span>
                                                                <span>Hủy phòng</span>
                                                            </button>
                                                        )}
                                                        {b.status === 'checked_in' && (
                                                            <button
                                                                type="button"
                                                                disabled={isActionLoading}
                                                                onClick={() => handleSingleRoomCheckOut(b.id, b.room_number)}
                                                                title="Khách về sớm: Trả phòng lẻ (Tiền phòng bảo lãnh theo HĐ đoàn)"
                                                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition flex items-center gap-1 cursor-pointer active:scale-95"
                                                            >
                                                                <span>🚪</span>
                                                                <span>Trả phòng lẻ</span>
                                                            </button>
                                                        )}
                                                        {(b.status === 'completed' || b.status === 'checked_out') && (
                                                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                                                                <span>🧹</span>
                                                                <span>Đã dọn dẹp</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {isEditingRoomingList && (
                                                    <button
                                                        type="button"
                                                        disabled={isFull}
                                                        onClick={() => handleAddGuestToRoom(b.id)}
                                                        title={isFull ? `Phòng đã đạt sức chứa tối đa (${roomCap} người)` : 'Thêm người ở cùng phòng'}
                                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 ${
                                                            isFull
                                                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 cursor-pointer active:scale-95'
                                                        }`}
                                                    >
                                                        <span>➕</span>
                                                        <span>Thêm người ở cùng</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* DANH SÁCH KHÁCH TRONG PHÒNG */}
                                        <div className="space-y-2.5">
                                            {currentGuests.map((guest, gIdx) => {
                                                const isPrimary = Boolean(guest.is_primary || gIdx === 0);

                                                if (isEditingRoomingList) {
                                                    return (
                                                        <div
                                                            key={guest.id || gIdx}
                                                            className={`p-3 rounded-xl border transition ${
                                                                isPrimary
                                                                    ? 'bg-indigo-50/40 border-indigo-200'
                                                                    : 'bg-slate-50/70 border-slate-200'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                                                    <span>{isPrimary ? '⭐' : '👤'}</span>
                                                                    <span>{isPrimary ? 'Khách đại diện phòng' : `Người ở cùng phòng #${gIdx}`}</span>
                                                                </span>

                                                                {!isPrimary && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveGuestFromRoom(b.id, gIdx)}
                                                                        className="text-rose-600 hover:text-rose-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer p-1 hover:bg-rose-50 rounded-lg transition"
                                                                    >
                                                                        <span>🗑️ Xóa</span>
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {/* 6 TRƯỜNG THÔNG TIN KHAI BÁO LƯU TRÚ CHUẨN */}
                                                            <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 text-[11px]">
                                                                {/* 1. Họ và tên */}
                                                                <div className="sm:col-span-2">
                                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                                                                        Họ và tên <span className="text-rose-500">*</span>
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        value={guest.full_name || ''}
                                                                        onChange={(e) => handleGuestFieldChange(b.id, gIdx, 'full_name', e.target.value)}
                                                                        placeholder="Nguyễn Văn A"
                                                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                    />
                                                                </div>

                                                                {/* 2. Loại giấy tờ */}
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Loại giấy tờ</label>
                                                                    <select
                                                                        value={guest.id_type || 'CCCD'}
                                                                        onChange={(e) => handleGuestFieldChange(b.id, gIdx, 'id_type', e.target.value)}
                                                                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                                    >
                                                                        <option value="CCCD">CCCD / CMND</option>
                                                                        <option value="PASSPORT">Hộ chiếu</option>
                                                                        <option value="OTHER">Trẻ em / Khác</option>
                                                                    </select>
                                                                </div>

                                                                {/* 3. Số giấy tờ */}
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Số CCCD / Hộ chiếu</label>
                                                                    <input
                                                                        type="text"
                                                                        value={guest.id_number || ''}
                                                                        onChange={(e) => handleGuestFieldChange(b.id, gIdx, 'id_number', e.target.value)}
                                                                        placeholder="Số định danh..."
                                                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                    />
                                                                </div>

                                                                {/* 4. Giới tính */}
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Giới tính</label>
                                                                    <select
                                                                        value={guest.gender || 'Nam'}
                                                                        onChange={(e) => handleGuestFieldChange(b.id, gIdx, 'gender', e.target.value)}
                                                                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                                    >
                                                                        <option value="Nam">Nam</option>
                                                                        <option value="Nữ">Nữ</option>
                                                                        <option value="Khác">Khác</option>
                                                                    </select>
                                                                </div>

                                                                {/* 5. Ngày sinh */}
                                                                <div>
                                                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Ngày sinh</label>
                                                                    <input
                                                                        type="date"
                                                                        value={guest.date_of_birth || ''}
                                                                        onChange={(e) => handleGuestFieldChange(b.id, gIdx, 'date_of_birth', e.target.value)}
                                                                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                // Chế độ Xem (View Mode)
                                                return (
                                                    <div
                                                        key={guest.id || gIdx}
                                                        className="p-2.5 bg-slate-50/80 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs border border-slate-100"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm">{isPrimary ? '⭐' : '👤'}</span>
                                                            <div>
                                                                <span className="font-bold text-slate-900">{guest.full_name || 'Chưa cập nhật tên'}</span>
                                                                {isPrimary && (
                                                                    <span className="ml-2 text-[10px] font-bold px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded">
                                                                        Đại diện phòng
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3 text-slate-600 text-[11px]">
                                                            {guest.id_number ? (
                                                                <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-800">
                                                                    🪪 {guest.id_type || 'CCCD'}: {guest.id_number}
                                                                </span>
                                                            ) : (
                                                                <span className="text-amber-600 italic">Chưa có CCCD</span>
                                                            )}
                                                            {guest.gender && <span>• {guest.gender}</span>}
                                                            {guest.date_of_birth && <span>• 🎂 {guest.date_of_birth}</span>}
                                                            {guest.nationality && <span>• 🌐 {guest.nationality}</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* MODAL FOOTER & BULK ACTIONS */}
                <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        {isCompleted && (
                            <span className="px-3.5 py-2 bg-purple-50 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-center">
                                <span>✓</span>
                                <span>Hợp đồng đoàn đã hoàn tất Check-out & Quyết toán</span>
                            </span>
                        )}

                        {isCancelled && (
                            <span className="px-3.5 py-2 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-center">
                                <span>✕</span>
                                <span>Đơn đặt đoàn này ĐÃ BỊ HỦY</span>
                            </span>
                        )}

                        {!isCompleted && !isCancelled && groupData.status !== 'checked_in' && (
                            <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={handleCheckInAll}
                                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 text-center"
                            >
                                <span>🔑</span>
                                <span>Check-in Toàn Đoàn (1 chạm)</span>
                            </button>
                        )}

                        {!isCompleted && !isCancelled && hasInHouseRoom && (
                            <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={handleRequestGroupInspection}
                                className="w-full sm:w-auto px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl border border-indigo-200 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 text-center shadow-xs"
                                title="Gửi thông báo yêu cầu Buồng phòng kiểm tra đón đầu Minibar & Hư hại toàn bộ các phòng trong đoàn trước khi Check-out"
                            >
                                
                                <span>Kiểm Phòng Đoàn ({inHouseSubBookings.length} phòng)</span>
                            </button>
                        )}

                        {!isCompleted && !isCancelled && (groupData.status === 'checked_in' || hasInHouseRoom) && (
                            <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={() => setIsSettlementModalOpen(true)}
                                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 text-center"
                            >
                                <span>🧾</span>
                                <span>Check-out Toàn Đoàn & Quyết Toán</span>
                            </button>
                        )}

                        {!isCompleted && !isCancelled && !hasInHouseRoom && (
                            <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={handleCancelGroup}
                                className="w-full sm:w-auto px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 text-center"
                                title="Hủy toàn bộ đơn đoàn và đồng loạt hủy tất cả phòng con (chỉ áp dụng trước khi nhận phòng)"
                            >
                                <span>✕</span>
                                <span>Hủy Toàn Bộ Đoàn</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer text-center"
                        >
                            Đóng Cửa Sổ
                        </button>
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* MODAL QUYẾT TOÁN & CHECK-OUT TOÀN ĐOÀN (GROUP MASTER SETTLEMENT)          */}
                {/* ========================================================================= */}
                {isSettlementModalOpen && (
                    <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full p-6 sm:p-7 shadow-2xl text-left max-h-[92vh] overflow-y-auto space-y-5 animate-in zoom-in-95 duration-200">
                            
                            {/* HEADER */}
                            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                            #{groupData.group_code}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-800">
                                            Quyết Toán Check-out Đoàn
                                        </span>
                                    </div>
                                    <h3 className="font-serif text-xl font-bold text-slate-900 mt-1">
                                        Quyết Toán Hợp Đồng: {groupData.group_name}
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsSettlementModalOpen(false)}
                                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* CẢNH BÁO TÌNH TRẠNG KIỂM PHÒNG MINIBAR & HƯ HẠI */}
                            {inspectionStats.total > 0 && (
                                inspectionStats.uninspectedRooms.length > 0 ? (
                                    <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl text-xs space-y-2.5">
                                        <div className="flex items-start gap-2.5 text-amber-900">
                                            <span className="text-lg leading-none mt-0.5">⚠️</span>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <strong className="font-extrabold text-amber-950">
                                                        Lưu ý: Còn {inspectionStats.uninspectedRooms.length}/{inspectionStats.total} phòng chưa kiểm tra Minibar & Hư hại
                                                    </strong>
                                                    <span className="px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded font-bold text-[10px]">
                                                        Chưa kiểm: {inspectionStats.uninspectedRooms.length}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-amber-800 leading-relaxed text-[11px]">
                                                    Các phòng: <strong>{inspectionStats.uninspectedRooms.join(', ')}</strong> chưa được Buồng phòng kiểm kê đồ Minibar đã dùng hoặc tài sản hư hại. Nếu quý khách tiếp tục quyết toán ngay lúc này, các chi phí phát sinh chưa kiểm kê sẽ <strong>không được cộng vào Hóa đơn đoàn</strong>.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t border-amber-200/70">
                                            <span className="text-[11px] text-amber-700 italic">
                                                Khuyến nghị: Yêu cầu buồng phòng kiểm tra trước khi chốt hóa đơn.
                                            </span>
                                            <button
                                                type="button"
                                                disabled={isActionLoading}
                                                onClick={handleRequestGroupInspection}
                                                className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition shadow-2xs active:scale-95"
                                            >
                                                <span>🛎️</span>
                                                <span>Gửi yêu cầu kiểm tra ngay</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl text-xs font-bold shadow-2xs">
                                        <span className="text-sm">✓</span>
                                        <span>Tất cả {inspectionStats.total} phòng lưu trú trong đoàn đã hoàn tất kiểm tra Minibar & Hư hại an toàn. Đủ điều kiện Check-out toàn đoàn!</span>
                                    </div>
                                )
                            )}

                            {/* BẢNG KÊ QUYẾT TOÁN TÀI CHÍNH (FOLIO STATEMENT) */}
                            <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl border border-indigo-100/70 p-4 space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                    <span>📊</span>
                                    <span>Bảng kê tổng hợp công nợ hợp đồng đoàn</span>
                                </h4>

                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span>Giá trị hợp đồng phòng & dịch vụ đặt trước ({subBookings.length} phòng):</span>
                                        <span className="font-bold font-mono text-slate-900">{formatCurrency(totalContractAmount)}</span>
                                    </div>
                                    {groupData.billing_type === 'ALL_INCLUSIVE' && (
                                        <div className="flex justify-between items-center text-purple-700 bg-purple-50/80 px-2.5 py-1.5 rounded-xl border border-purple-200/60 font-semibold">
                                            <span className="flex items-center gap-1">
                                                <span>➕</span>
                                                <span>Dịch vụ phát sinh tại phòng (Công ty chi trả toàn bộ):</span>
                                            </span>
                                            <span className="font-mono font-bold">+{formatCurrency(unpaidIncidentalsTotal)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center text-emerald-700 bg-emerald-50/80 px-2.5 py-1.5 rounded-xl border border-emerald-200/60 font-semibold">
                                        <span className="flex items-center gap-1">
                                            <span>✓</span>
                                            <span>Đã đặt cọc trước (chuyển khoản):</span>
                                        </span>
                                        <span className="font-mono font-bold">-{formatCurrency(depositAmount)}</span>
                                    </div>
                                    {groupData.corporate_partner_details && (
                                        <div className="flex justify-between items-center text-purple-700 text-[11px]">
                                            <span>Ưu đãi Doanh nghiệp B2B ({groupData.corporate_partner_details.company_name}):</span>
                                            <span className="font-semibold">Đã áp dụng chiết khấu {groupData.corporate_partner_details.discount_percent}%</span>
                                        </div>
                                    )}
                                    <div className="pt-2 border-t border-slate-200/80 flex justify-between items-center">
                                        <span className="font-bold text-slate-900 text-sm">SỐ TIỀN CÒN PHẢI THU QUYẾT TOÁN:</span>
                                        <span className="font-mono text-lg font-black text-rose-600">
                                            {formatCurrency(remainingSettlementBalance)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* CHỌN PHƯƠNG THỨC THANH TOÁN */}
                            {remainingSettlementBalance > 0 && (
                                <div className="space-y-3">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                                        Phương thức thanh toán 50% còn lại
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setSettlementPaymentMethod('transfer')}
                                            className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
                                                settlementPaymentMethod === 'transfer'
                                                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                            }`}
                                        >
                                            <span className="text-xl">⚡</span>
                                            <div>
                                                <div className="text-xs font-bold text-slate-900">Chuyển khoản VietQR</div>
                                                <div className="text-[10px] text-slate-500">Mã QR động tự điền số tiền</div>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setSettlementPaymentMethod('cash')}
                                            className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
                                                settlementPaymentMethod === 'cash'
                                                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                            }`}
                                        >
                                            <span className="text-xl">💵</span>
                                            <div>
                                                <div className="text-xs font-bold text-slate-900">Tiền mặt tại Quầy</div>
                                                <div className="text-[10px] text-slate-500">Thu tiền mặt trực tiếp từ đại diện</div>
                                            </div>
                                        </button>
                                    </div>

                                    {/* VIETQR CARD HIỂN THỊ KHI CHỌN CHUYỂN KHOẢN */}
                                    {settlementPaymentMethod === 'transfer' && groupQrUrl && (
                                        <div className="p-4 bg-white rounded-2xl border-2 border-indigo-200/80 shadow-sm flex flex-col sm:flex-row items-center gap-4">
                                            <img
                                                src={groupQrUrl}
                                                alt="VietQR Group Settlement"
                                                className="w-36 h-36 rounded-xl bg-white p-1 shrink-0 border border-slate-200 shadow-xs"
                                            />
                                            <div className="space-y-1.5 text-xs text-left">
                                                <div className="font-bold text-indigo-700 uppercase tracking-wide text-[10px]">
                                                    Quét mã thanh toán quyết toán đoàn
                                                </div>
                                                <div className="font-mono text-lg font-black text-emerald-600">
                                                    {formatCurrency(remainingSettlementBalance)}
                                                </div>
                                                <div className="text-slate-700 text-[11px] space-y-1">
                                                    <div>🏦 Ngân hàng: <strong className="text-slate-900">MBBank ({bankConfig.bank_bin})</strong></div>
                                                    <div>💳 STK: <strong className="font-mono font-bold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">{bankConfig.account_no}</strong></div>
                                                    <div>👤 Chủ TK: <strong className="text-slate-900">{bankConfig.account_name}</strong></div>
                                                    <div>📝 Nội dung: <strong className="font-mono text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Thanh toan doan {groupData.group_code}</strong></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* THÔNG TIN HÓA ĐƠN GTGT (VAT) DOANH NGHIỆP */}
                            <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50/50">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={isCompanyInvoice}
                                        onChange={(e) => setIsCompanyInvoice(e.target.checked)}
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                    />
                                    <span className="text-xs font-bold text-slate-800">
                                        🏢 Xuất Hóa đơn điện tử GTGT (VAT) cho Doanh nghiệp / Công ty
                                    </span>
                                </label>

                                {isCompanyInvoice && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Tên Công Ty / Doanh Nghiệp *</label>
                                            <input
                                                type="text"
                                                value={companyName}
                                                onChange={(e) => setCompanyName(e.target.value)}
                                                placeholder="Công ty TNHH..."
                                                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-indigo-500 text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Mã Số Thuế (MST) *</label>
                                            <input
                                                type="text"
                                                value={companyTaxCode}
                                                onChange={(e) => setCompanyTaxCode(e.target.value)}
                                                placeholder="0312345678"
                                                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-indigo-500 text-xs font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Địa Chỉ Đăng Ký Kinh Doanh</label>
                                            <input
                                                type="text"
                                                value={companyAddress}
                                                onChange={(e) => setCompanyAddress(e.target.value)}
                                                placeholder="Số nhà, đường, quận, thành phố..."
                                                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-indigo-500 text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-600 block mb-1">Email Nhận Hóa Đơn Điện Tử</label>
                                            <input
                                                type="email"
                                                value={invoiceRecipientEmail}
                                                onChange={(e) => setInvoiceRecipientEmail(e.target.value)}
                                                placeholder="ketoan@congty.com"
                                                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:border-indigo-500 text-xs"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* HÀNH ĐỘNG XÁC NHẬN */}
                            <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setIsSettlementModalOpen(false)}
                                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer text-center"
                                >
                                    Quay lại
                                </button>
                                <button
                                    type="button"
                                    disabled={isActionLoading}
                                    onClick={handleConfirmGroupSettlement}
                                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-black text-xs shadow-lg shadow-orange-500/20 transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-center"
                                >
                                    <span>🧾</span>
                                    <span>
                                        Xác nhận Thu {formatCurrency(remainingSettlementBalance)} & Hoàn Tất Check-out Toàn Đoàn
                                    </span>
                                </button>
                            </div>

                        </div>
                    </div>
                )}

                {/* HOTEL INVOICE MODAL (IN HÓA ĐƠN ĐOÀN DÙNG CHUNG) */}
                {isInvoiceModalOpen && invoiceBookingData && (
                    <HotelInvoiceModal
                        booking={invoiceBookingData}
                        onClose={() => setIsInvoiceModalOpen(false)}
                    />
                )}

                {/* ========================================================================= */}
                {/* MODAL THÔNG BÁO XÁC NHẬN NỀN TRẮNG GIỮA MÀN HÌNH (CHECKIN/CHECKOUT)       */}
                {/* ========================================================================= */}
                {confirmDialog.isOpen && (
                    <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200 space-y-4">
                            {/* ICON */}
                            <div
                                className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-xs border"
                                style={{
                                    backgroundColor: confirmDialog.confirmType === 'emerald' ? '#ecfdf5' : confirmDialog.confirmType === 'amber' ? '#fffbeb' : '#eef2ff',
                                    borderColor: confirmDialog.confirmType === 'emerald' ? '#a7f3d0' : confirmDialog.confirmType === 'amber' ? '#fde68a' : '#c7d2fe',
                                }}
                            >
                                <span>{confirmDialog.icon || '🔔'}</span>
                            </div>

                            {/* TITLE & CONTENT */}
                            <div className="space-y-2">
                                <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900">
                                    {confirmDialog.title}
                                </h3>
                                <p className="text-sm font-semibold text-slate-800 leading-snug">
                                    {confirmDialog.message}
                                </p>
                                {confirmDialog.detail && (
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 leading-relaxed text-left">
                                        {confirmDialog.detail}
                                    </div>
                                )}
                            </div>

                            {/* ACTION BUTTONS */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeConfirm}
                                    disabled={isActionLoading}
                                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer active:scale-95 disabled:opacity-50"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="button"
                                    disabled={isActionLoading}
                                    onClick={() => {
                                        if (typeof confirmDialog.onConfirm === 'function') {
                                            confirmDialog.onConfirm();
                                        }
                                    }}
                                    className={`w-full py-2.5 px-4 rounded-xl text-white font-extrabold text-xs transition shadow-md cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                                        confirmDialog.confirmType === 'emerald'
                                            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 shadow-emerald-600/20'
                                            : confirmDialog.confirmType === 'amber'
                                            ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-amber-600/20'
                                            : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-600/20'
                                    }`}
                                >
                                    {isActionLoading ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        confirmDialog.confirmText || 'Xác nhận'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
