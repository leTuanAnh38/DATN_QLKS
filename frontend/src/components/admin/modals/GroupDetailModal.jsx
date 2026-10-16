import React, { useState, useEffect, useMemo } from 'react';
import { bookingService } from '../../../services/bookingService';
import api from '../../../services/api';
import HotelInvoiceModal from './HotelInvoiceModal';

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

    const totalContractAmount = useMemo(() => Number(groupData?.total_amount || 0), [groupData?.total_amount]);
    const depositAmount = useMemo(() => {
        if (groupData?.is_deposit_paid) {
            return Number(groupData?.deposit_amount || (totalContractAmount * 0.5));
        }
        return 0;
    }, [groupData?.is_deposit_paid, groupData?.deposit_amount, totalContractAmount]);

    const remainingSettlementBalance = useMemo(() => {
        return Math.max(0, totalContractAmount - depositAmount);
    }, [totalContractAmount, depositAmount]);

    const groupQrUrl = useMemo(() => {
        if (!bankConfig.bank_bin || !bankConfig.account_no || remainingSettlementBalance <= 0) return '';
        const addInfo = encodeURIComponent(`Thanh toan doan ${groupData?.group_code || ''}`);
        return `https://img.vietqr.io/image/${bankConfig.bank_bin}-${bankConfig.account_no}-compact2.jpg?amount=${remainingSettlementBalance}&addInfo=${addInfo}&accountName=${encodeURIComponent(bankConfig.account_name)}`;
    }, [bankConfig, remainingSettlementBalance, groupData?.group_code]);

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
        showConfirm({
            title: 'Xác Nhận Check-out Phòng Lẻ',
            message: `Xác nhận trả phòng sớm cho phòng ${roomNumber || bookingId}?`,
            detail: `Tiền phòng đã bảo lãnh theo HĐ đoàn #${groupData.group_code}. Khách lưu trú chỉ thanh toán dịch vụ phát sinh cá nhân (nếu có). Sau khi trả phòng, phòng sẽ chuyển sang trạng thái "Cần dọn dẹp".`,
            confirmText: '✓ Xác Nhận Trả Phòng',
            confirmType: 'amber',
            icon: '🚪',
            onConfirm: () => executeSingleRoomCheckOut(bookingId, roomNumber)
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

    const subBookings = groupData.sub_bookings || [];
    const isCompleted = ['completed', 'checked_out'].includes(groupData?.status);

    // State mở modal in hóa đơn đoàn
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

    // Dữ liệu mapping chuẩn cho HotelInvoiceModal
    const invoiceBookingData = useMemo(() => {
        if (!groupData) return null;
        const partner = groupData.corporate_partner_details || groupData.corporate_partner;
        const totalAmount = Number(groupData.total_amount) || 0;
        const depositAmount = Number(groupData.deposit_amount) || 0;

        return {
            ...groupData,
            id: groupData.id,
            is_group_master: true,
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
            total_amount: totalAmount,
            room_amount: totalAmount,
            grand_total_amount: totalAmount,
            deposit_amount: depositAmount,
            is_deposit_paid: Boolean(groupData.is_deposit_paid || isCompleted),
            status: groupData.status,
            is_paid: isCompleted,
            sub_bookings: subBookings || [],
            payment_method: 'Hợp đồng Doanh nghiệp B2B (VietQR / Chuyển khoản)',
            note: groupData.note || ''
        };
    }, [groupData, subBookings, isCompleted]);

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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 flex items-center justify-center p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 max-w-5xl w-full p-6 sm:p-8 shadow-2xl text-left max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200 flex flex-col justify-between">
                
                <div>
                    {/* MODAL HEADER */}
                    <div className="flex items-start justify-between pb-4 border-b border-slate-200 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20 shrink-0">
                                🏢
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                                        #{groupData.group_code}
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide flex items-center gap-1 ${
                                        groupData.status === 'checked_in'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : isCompleted
                                            ? 'bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs'
                                            : 'bg-blue-100 text-blue-800'
                                    }`}>
                                        <span>{isCompleted ? '✓' : groupData.status === 'checked_in' ? '🔑' : '📋'}</span>
                                        <span>{isCompleted ? 'ĐÃ HOÀN THÀNH (ĐÃ QUYẾT TOÁN)' : (groupData.status_display || groupData.status)}</span>
                                    </span>
                                    {groupData.corporate_partner_details && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                            🏢 {groupData.corporate_partner_details.company_name} (-{groupData.corporate_partner_details.discount_percent}%)
                                        </span>
                                    )}
                                </div>
                                <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                                    {groupData.group_name}
                                </h2>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setIsInvoiceModalOpen(true)}
                                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                                title="Xem và in hóa đơn thanh toán cho toàn đoàn"
                            >
                                <span>🖨️ In Hóa Đơn Đoàn</span>
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition flex items-center justify-center font-bold text-base cursor-pointer shrink-0"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* ACTION MESSAGE */}
                    {actionMessage && (
                        <div className={`mb-6 p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                            actionMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                            <span>{actionMessage.type === 'success' ? '✓' : '⚠️'}</span>
                            <span>{actionMessage.text}</span>
                        </div>
                    )}

                    {/* OVERVIEW STATS */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Quy mô đoàn</span>
                            <div className="text-base font-black text-slate-900 mt-0.5">{groupData.total_rooms || subBookings.length} phòng</div>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Lưu trú</span>
                            <div className="text-xs font-bold text-slate-900 mt-0.5">
                                {formatDate(groupData.check_in_date)} - {formatDate(groupData.check_out_date)} ({groupData.nights} đêm)
                            </div>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng tiền hợp đồng</span>
                            <div className="text-base font-black text-indigo-700 mt-0.5">{formatCurrency(groupData.total_amount)}</div>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                                {isCompleted ? 'Quyết toán hợp đồng' : 'Đặt cọc'}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs font-bold text-slate-900">
                                    {formatCurrency(isCompleted ? groupData.total_amount : groupData.deposit_amount)}
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                    isCompleted
                                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                        : groupData.is_deposit_paid
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-800'
                                }`}>
                                    {isCompleted ? '✓ Đã quyết toán 100%' : groupData.is_deposit_paid ? 'Đã cọc' : 'Chờ cọc'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* LEADER INFO */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 mb-6 flex flex-wrap items-center justify-between gap-4 text-xs">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                                👤
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-bold">Người đại diện / Trưởng đoàn</span>
                                <strong className="text-slate-900">{groupData.leader_name}</strong>
                                <span className="text-slate-500 ml-2">📞 {groupData.leader_phone}</span>
                                {groupData.leader_email && <span className="text-slate-500 ml-2">✉️ {groupData.leader_email}</span>}
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
                                                        : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                    {b.status_display || b.status}
                                                </span>

                                                {/* Thao tác Check-in / Check-out cho từng phòng lẻ trong đoàn */}
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
                <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        {isCompleted && (
                            <span className="px-3.5 py-2 bg-purple-50 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <span>✓</span>
                                <span>Hợp đồng đoàn đã hoàn tất Check-out & Quyết toán</span>
                            </span>
                        )}

                        {!isCompleted && groupData.status !== 'checked_in' && (
                            <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={handleCheckInAll}
                                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                                <span>🔑</span>
                                <span>Check-in Toàn Đoàn (1 chạm)</span>
                            </button>
                        )}

                        {!isCompleted && groupData.status === 'checked_in' && (
                            <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={() => setIsSettlementModalOpen(true)}
                                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                                <span>🧾</span>
                                <span>Check-out Toàn Đoàn & Quyết Toán</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => setIsInvoiceModalOpen(true)}
                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                            title="Xem và in hóa đơn thanh toán toàn đoàn"
                        >
                            <span>🖨️ In Hóa Đơn Đoàn</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
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

                            {/* BẢNG KÊ QUYẾT TOÁN TÀI CHÍNH (FOLIO STATEMENT) */}
                            <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl border border-indigo-100/70 p-4 space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                    <span>📊</span>
                                    <span>Bảng kê tổng hợp công nợ hợp đồng đoàn</span>
                                </h4>

                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span>Tổng giá trị hợp đồng ({subBookings.length} phòng):</span>
                                        <span className="font-bold font-mono text-slate-900">{formatCurrency(totalContractAmount)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-emerald-700 bg-emerald-50/80 px-2.5 py-1.5 rounded-xl border border-emerald-200/60 font-semibold">
                                        <span className="flex items-center gap-1">
                                            <span>✓</span>
                                            <span>Đã đặt cọc trước (50% chuyển khoản):</span>
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
                                        <div className="p-4 bg-slate-900 rounded-2xl text-white flex flex-col sm:flex-row items-center gap-4">
                                            <img
                                                src={groupQrUrl}
                                                alt="VietQR Group Settlement"
                                                className="w-36 h-36 rounded-xl bg-white p-1.5 shrink-0 shadow-md"
                                            />
                                            <div className="space-y-1.5 text-xs text-left">
                                                <div className="font-bold text-indigo-300 uppercase tracking-wide text-[10px]">
                                                    Quét mã thanh toán quyết toán đoàn
                                                </div>
                                                <div className="font-mono text-base font-black text-emerald-400">
                                                    {formatCurrency(remainingSettlementBalance)}
                                                </div>
                                                <div className="text-slate-300 text-[11px] space-y-0.5">
                                                    <div>🏦 Ngân hàng: <strong>MBBank ({bankConfig.bank_bin})</strong></div>
                                                    <div>💳 STK: <strong className="font-mono text-white">{bankConfig.account_no}</strong></div>
                                                    <div>👤 Chủ TK: <strong>{bankConfig.account_name}</strong></div>
                                                    <div>📝 Nội dung: <strong className="font-mono text-amber-300">Thanh toan doan {groupData.group_code}</strong></div>
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
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsSettlementModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
                                >
                                    Quay lại
                                </button>
                                <button
                                    type="button"
                                    disabled={isActionLoading}
                                    onClick={handleConfirmGroupSettlement}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-black text-xs shadow-lg shadow-orange-500/20 transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-2"
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
