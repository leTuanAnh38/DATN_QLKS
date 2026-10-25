import React, { useState, useEffect, useMemo } from 'react';
import { bookingService } from '../../../services/bookingService';
import { roomService } from '../../../services/roomService';
import { hotelService } from '../../../services/hotelService';
import { useHasPermission } from '../../../utils/permission';
import api from '../../../services/api';

const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return `${num.toLocaleString('vi-VN')}đ`;
};

const getBankDisplayName = (bin) => {
    const banks = {
        '970422': 'MBBank (Quân Đội)',
        '970436': 'Vietcombank',
        '970407': 'Techcombank',
        '970415': 'VietinBank',
        '970418': 'BIDV',
        '970405': 'Agribank',
        '970423': 'TPBank',
        '970432': 'VPBank'
    };
    return banks[String(bin)] || `Ngân hàng (${bin})`;
};

export default function CreateGroupModal({ isOpen, onClose, onSuccess }) {
    const canCreateBookings = useHasPermission('bookings', 'create');
    const [categories, setCategories] = useState([]);
    const [partners, setPartners] = useState([]);
    const [hotelSettings, setHotelSettings] = useState({
        group_deposit_percent: 50
    });
    const [isLoadingInit, setIsLoadingInit] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Dịch vụ khách sạn khả dụng để chọn kèm cho từng phòng
    const [availableServices, setAvailableServices] = useState([]);
    const [isLoadingServices, setIsLoadingServices] = useState(false);
    const [activeServicePickerRoomKey, setActiveServicePickerRoomKey] = useState(null);
    const [serviceSearchQuery, setServiceSearchQuery] = useState('');
    const [selectedServiceCategory, setSelectedServiceCategory] = useState('all');

    // Danh sách phân phòng & khách lưu trú từng phòng (Rooming List)
    const [roomingList, setRoomingList] = useState([]);
    const [isRoomingListOpen, setIsRoomingListOpen] = useState(true);

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

    // Estimated Arrival & Guests
    const [estimatedArrivalTime, setEstimatedArrivalTime] = useState('14:00');
    const [estimatedGuests, setEstimatedGuests] = useState('');

    // Deposit Payment Method & Paid Status
    const [depositPaymentMethod, setDepositPaymentMethod] = useState('TRANSFER'); // 'TRANSFER' | 'CASH' | 'POS' | 'CREDIT'
    const [isDepositPaidNow, setIsDepositPaidNow] = useState(false);

    // Chính sách chi trả dịch vụ phát sinh (Billing Routing)
    const [billingType, setBillingType] = useState('ROOM_ONLY'); // 'ROOM_ONLY' | 'ALL_INCLUSIVE'

    // Multi-room selection: { [categoryId]: quantity }
    const [selectedRooms, setSelectedRooms] = useState({});

    // Deposit
    const [customDeposit, setCustomDeposit] = useState('');
    const [isDepositCustomized, setIsDepositCustomized] = useState(false);

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
        setIsDepositCustomized(false);

        Promise.allSettled([
            roomService.getCategories(),
            bookingService.getCorporatePartners({ active_only: true }),
            api.get('/hotel-settings/'),
            api.get('/payments/config/'),
            hotelService.getServices({ status: 'active' })
        ]).then(([catRes, partnerRes, hotelRes, payRes, svcRes]) => {
            if (!isMounted) return;
            if (catRes.status === 'fulfilled' && catRes.value?.categories) {
                setCategories(catRes.value.categories);
            }
            if (partnerRes.status === 'fulfilled' && partnerRes.value?.data) {
                setPartners(partnerRes.value.data);
            }
            if (hotelRes.status === 'fulfilled') {
                const hData = hotelRes.value.data?.data || hotelRes.value.data;
                if (hData) {
                    setHotelSettings(prev => ({
                        ...prev,
                        group_deposit_percent: Number(hData.group_deposit_percent) || 50
                    }));
                }
            }
            if (payRes?.status === 'fulfilled') {
                const pData = payRes.value.data?.data || payRes.value.data;
                if (pData?.bank_bin) {
                    setBankConfig({
                        bank_bin: pData.bank_bin,
                        account_no: pData.account_no,
                        account_name: (pData.account_name || '').toUpperCase()
                    });
                }
            }
            if (svcRes?.status === 'fulfilled' && svcRes.value?.success && Array.isArray(svcRes.value.items)) {
                setAvailableServices(svcRes.value.items);
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
                            const aInfo = res.availabilities[catId] || res.availabilities[String(catId)];
                            const maxAvail = aInfo?.available_rooms ?? 999;
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

    // Đồng bộ roomingList khi selectedRooms hoặc categories thay đổi
    useEffect(() => {
        setRoomingList((prevList) => {
            const nextList = [];
            let globalRoomIdx = 1;

            categories.forEach((cat) => {
                const qty = Number(selectedRooms[cat.id] || 0);
                if (qty > 0) {
                    const existingForCat = prevList.filter((r) => r.category_id === cat.id);
                    for (let i = 0; i < qty; i++) {
                        const roomKey = `${cat.id}_${i}`;
                        const existingRoom = existingForCat[i];
                        if (existingRoom) {
                            nextList.push({
                                ...existingRoom,
                                room_key: roomKey,
                                global_index: globalRoomIdx++,
                                category_name: cat.name,
                                capacity: Number(cat.capacity || 2),
                                room_index: i + 1,
                                services: existingRoom.services || []
                            });
                        } else {
                            const isFirstRoom = (globalRoomIdx === 1);
                            nextList.push({
                                room_key: roomKey,
                                global_index: globalRoomIdx++,
                                category_id: cat.id,
                                category_name: cat.name,
                                capacity: Number(cat.capacity || 2),
                                room_index: i + 1,
                                guests: [
                                    {
                                        id: `guest_${roomKey}_0`,
                                        full_name: isFirstRoom ? (leaderName || '') : '',
                                        id_type: 'CCCD',
                                        id_number: isFirstRoom ? (identityCard || '') : '',
                                        date_of_birth: '',
                                        gender: 'Nam',
                                        nationality: 'Việt Nam',
                                        is_primary: true
                                    }
                                ],
                                services: []
                            });
                        }
                    }
                }
            });

            return nextList;
        });
    }, [selectedRooms, categories]);

    const handleAddGuestToAllocatedRoom = (roomKey) => {
        setRoomingList((prev) =>
            prev.map((room) => {
                if (room.room_key !== roomKey) return room;
                if (room.guests.length >= room.capacity) {
                    alert(`Hạng phòng "${room.category_name}" chỉ có sức chứa tối đa ${room.capacity} khách. Không thể thêm vượt quá sức chứa quy định!`);
                    return room;
                }
                const newGuest = {
                    id: `guest_${roomKey}_${Date.now()}`,
                    full_name: '',
                    id_type: 'CCCD',
                    id_number: '',
                    date_of_birth: '',
                    gender: 'Nam',
                    nationality: 'Việt Nam',
                    is_primary: false
                };
                return {
                    ...room,
                    guests: [...room.guests, newGuest]
                };
            })
        );
    };

    const handleRemoveGuestFromAllocatedRoom = (roomKey, guestIdx) => {
        setRoomingList((prev) =>
            prev.map((room) => {
                if (room.room_key !== roomKey) return room;
                const nextGuests = room.guests.filter((_, idx) => idx !== guestIdx);
                if (nextGuests.length > 0 && !nextGuests.some((g) => g.is_primary)) {
                    nextGuests[0].is_primary = true;
                }
                return {
                    ...room,
                    guests: nextGuests
                };
            })
        );
    };

    const handleAllocatedGuestFieldChange = (roomKey, guestIdx, field, value) => {
        setRoomingList((prev) =>
            prev.map((room) => {
                if (room.room_key !== roomKey) return room;
                const nextGuests = [...room.guests];
                nextGuests[guestIdx] = {
                    ...nextGuests[guestIdx],
                    [field]: value
                };
                return {
                    ...room,
                    guests: nextGuests
                };
            })
        );
    };

    // Quản lý dịch vụ chọn kèm cho từng phòng
    const handleAddServiceToRoom = (roomKey, serviceItem) => {
        setRoomingList((prev) =>
            prev.map((room) => {
                if (room.room_key !== roomKey) return room;
                const existingServices = room.services || [];
                const existIdx = existingServices.findIndex((s) => s.service_id === serviceItem.id);
                if (existIdx >= 0) {
                    const updated = [...existingServices];
                    updated[existIdx] = {
                        ...updated[existIdx],
                        quantity: updated[existIdx].quantity + 1
                    };
                    return { ...room, services: updated };
                } else {
                    return {
                        ...room,
                        services: [
                            ...existingServices,
                            {
                                service_id: serviceItem.id,
                                name: serviceItem.name,
                                price: Number(serviceItem.price || 0),
                                quantity: 1,
                                category_name: serviceItem.category?.name || serviceItem.category_name || ''
                            }
                        ]
                    };
                }
            })
        );
    };

    const handleUpdateServiceQtyInRoom = (roomKey, serviceId, delta) => {
        setRoomingList((prev) =>
            prev.map((room) => {
                if (room.room_key !== roomKey) return room;
                const existingServices = room.services || [];
                const updated = existingServices
                    .map((s) => {
                        if (s.service_id === serviceId) {
                            return { ...s, quantity: s.quantity + delta };
                        }
                        return s;
                    })
                    .filter((s) => s.quantity > 0);
                return { ...room, services: updated };
            })
        );
    };

    const handleRemoveServiceFromRoom = (roomKey, serviceId) => {
        setRoomingList((prev) =>
            prev.map((room) => {
                if (room.room_key !== roomKey) return room;
                return {
                    ...room,
                    services: (room.services || []).filter((s) => s.service_id !== serviceId)
                };
            })
        );
    };

    // Nhóm danh mục dịch vụ để lọc
    const serviceCategories = useMemo(() => {
        const map = new Map();
        availableServices.forEach((svc) => {
            const catId = svc.category_id || svc.category?.id || svc.category_name || svc.category?.name || 'other';
            const catName = svc.category_name || svc.category?.name || 'Tiện ích khác';
            const catIcon = svc.category_icon || svc.category?.icon || '🛎️';
            if (!map.has(catId)) {
                map.set(catId, { id: catId, name: catName, icon: catIcon });
            }
        });
        return Array.from(map.values());
    }, [availableServices]);

    // Danh sách dịch vụ sau khi lọc tìm kiếm & nhóm
    const filteredServices = useMemo(() => {
        return availableServices.filter((svc) => {
            if (selectedServiceCategory !== 'all') {
                const catId = String(svc.category_id || svc.category?.id || '');
                const catName = svc.category_name || svc.category?.name || '';
                if (catId !== String(selectedServiceCategory) && catName !== selectedServiceCategory) {
                    return false;
                }
            }
            if (serviceSearchQuery.trim()) {
                const q = serviceSearchQuery.trim().toLowerCase();
                const nameMatch = (svc.name || '').toLowerCase().includes(q);
                const descMatch = (svc.description || '').toLowerCase().includes(q);
                const catMatch = ((svc.category_name || svc.category?.name || '')).toLowerCase().includes(q);
                if (!nameMatch && !descMatch && !catMatch) {
                    return false;
                }
            }
            return true;
        });
    }, [availableServices, selectedServiceCategory, serviceSearchQuery]);

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

    const { totalRoomsCount, subtotalAmount, totalServicesAmount, totalDiscount, grandTotal } = useMemo(() => {
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

        // Tính tổng tiền dịch vụ của tất cả các phòng
        let svcTotal = 0;
        roomingList.forEach((r) => {
            (r.services || []).forEach((s) => {
                svcTotal += Number(s.price || 0) * Number(s.quantity || 1);
            });
        });

        const discount = discountPercent > 0 ? (subtotal * discountPercent) / 100 : 0;
        const total = Math.max(0, subtotal - discount + svcTotal);

        return {
            totalRoomsCount: count,
            subtotalAmount: subtotal,
            totalServicesAmount: svcTotal,
            totalDiscount: discount,
            grandTotal: total
        };
    }, [categories, selectedRooms, nights, discountPercent, roomingList]);

    // Tự động tính số tiền cọc mặc định (50%) khi tổng giá trị đoàn thay đổi (nếu chưa chỉnh sửa thủ công)
    useEffect(() => {
        if (!isDepositCustomized) {
            const depRate = (Number(hotelSettings.group_deposit_percent) || 50) / 100;
            setCustomDeposit(grandTotal > 0 ? String(Math.round(grandTotal * depRate)) : '');
        }
    }, [grandTotal, hotelSettings.group_deposit_percent, isDepositCustomized]);

    // Cấu hình ngân hàng VietQR động
    const [bankConfig, setBankConfig] = useState({
        bank_bin: '970422',
        account_no: '0344997778',
        account_name: 'KHACH SAN TA DA NANG'
    });
    const [copiedField, setCopiedField] = useState('');

    const depPercent = Number(hotelSettings.group_deposit_percent) || 50;
    const depositVal = customDeposit !== '' ? Number(customDeposit) : Math.round(grandTotal * (depPercent / 100));

    const transferDescription = useMemo(() => {
        const removeAccents = (str) => {
            return String(str || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd').replace(/Đ/g, 'D');
        };
        const phone = (leaderPhone || '').replace(/\D/g, '').slice(-6);
        const namePart = removeAccents(leaderName.trim() || groupName.trim() || 'Doan').replace(/[^a-zA-Z0-9]/g, '');
        return `Coc doan ${phone ? phone + ' ' : ''}${namePart}`.trim().slice(0, 25) || 'Coc giu cho doan';
    }, [leaderPhone, leaderName, groupName]);

    const vietQrUrl = useMemo(() => {
        if (!bankConfig.bank_bin || !bankConfig.account_no || depositVal <= 0) return '';
        const addInfo = encodeURIComponent(transferDescription);
        return `https://img.vietqr.io/image/${bankConfig.bank_bin}-${bankConfig.account_no}-compact2.jpg?amount=${depositVal}&addInfo=${addInfo}&accountName=${encodeURIComponent(bankConfig.account_name)}`;
    }, [bankConfig, depositVal, transferDescription]);

    const handleCopyText = (text, fieldName) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(''), 2000);
    };

    // Room quantity change
    const handleRoomQtyChange = (catId, delta) => {
        const aInfo = availabilities[catId] || availabilities[String(catId)];
        const maxAvail = aInfo?.available_rooms ?? 999;

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

        if (!canCreateBookings) {
            setError('Bạn không có quyền tạo đơn đặt phòng theo đoàn (Chỉ dành cho Lễ tân, Quản lý hoặc Quản trị viên).');
            return;
        }

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

        if (identityCard.trim()) {
            if (identityCard.trim() === leaderPhone.trim()) {
                setError('Số CCCD / Hộ chiếu không thể trùng với Số điện thoại.');
                return;
            }
            if (identityCard.trim().length < 8 || identityCard.trim().length > 20) {
                setError('Số CCCD / Hộ chiếu phải từ 8 đến 20 ký tự hợp lệ.');
                return;
            }
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

        let combinedNote = note.trim();
        const prefixParts = [];
        if (estimatedArrivalTime) prefixParts.push(`Giờ đến dự kiến: ${estimatedArrivalTime}`);
        if (estimatedGuests) prefixParts.push(`Quy mô đoàn: ${estimatedGuests} khách`);
        if (prefixParts.length > 0) {
            const prefixStr = `[${prefixParts.join(' | ')}]`;
            combinedNote = combinedNote ? `${prefixStr} ${combinedNote}` : prefixStr;
        }

        const depPercent = Number(hotelSettings.group_deposit_percent) || 50;
        const depositVal = customDeposit !== '' ? Number(customDeposit) : Math.round(grandTotal * (depPercent / 100));

        // Danh sách phân phòng & khách lưu trú & dịch vụ đi kèm từng phòng (Rooming List)
        const roomingPayload = roomingList.map((r) => ({
            category_id: r.category_id,
            room_index: r.room_index,
            guests: (r.guests || []).filter((g) => (g.full_name || '').trim()),
            services: (r.services || []).map((s) => ({
                service_id: s.service_id,
                quantity: s.quantity
            }))
        })).filter((r) => r.guests.length > 0 || (r.services && r.services.length > 0));

        const payload = {
            group_name: groupName.trim() || `Đoàn khách ${leaderName.trim()}`,
            corporate_partner_id: selectedPartnerId ? Number(selectedPartnerId) : null,
            leader_name: leaderName.trim(),
            leader_phone: leaderPhone.trim(),
            leader_email: leaderEmail.trim() || null,
            identity_card: identityCard.trim() || '',
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            estimated_arrival_time: estimatedArrivalTime || null,
            total_guests_estimated: estimatedGuests ? Number(estimatedGuests) : null,
            rooms: roomsPayload,
            rooming_list: roomingPayload,
            deposit_amount: depositVal,
            deposit_payment_method: depositPaymentMethod,
            is_deposit_paid: isDepositPaidNow,
            billing_type: billingType,
            note: combinedNote || null,
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 flex items-center justify-center p-2.5 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 max-w-5xl w-full p-4 sm:p-8 shadow-2xl text-left max-h-[94vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                
                {/* MODAL HEADER */}
                <div className="flex items-start justify-between pb-4 border-b border-slate-200 mb-6">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center text-xl sm:text-2xl shadow-lg shadow-indigo-500/20 shrink-0">
                            🏢
                        </div>
                        <div>
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] sm:text-[11px] font-bold border border-blue-200 uppercase tracking-wide">
                                Phân Hệ Khách Đoàn & Doanh Nghiệp (M.I.C.E / B2B)
                            </span>
                            <h2 className="font-serif text-lg sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1">
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

                        {/* KHỐI 2: THỜI GIAN LƯU TRÚ & QUY MÔ ĐOÀN */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 p-4 bg-slate-50 border border-slate-200 rounded-2xl items-center">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                    🗓️ Ngày Check-in:
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
                                    ⏰ Giờ đến dự kiến (ETA):
                                </label>
                                <select
                                    value={estimatedArrivalTime}
                                    onChange={(e) => setEstimatedArrivalTime(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                                >
                                    <option value="08:00">08:00 (Sáng sớm)</option>
                                    <option value="10:00">10:00 (Sáng)</option>
                                    <option value="11:30">11:30 (Trưa)</option>
                                    <option value="12:00">12:00 (Trưa)</option>
                                    <option value="14:00">14:00 (Giờ chuẩn)</option>
                                    <option value="15:30">15:30 (Chiều)</option>
                                    <option value="18:00">18:00 (Tối)</option>
                                    <option value="20:00">20:00 (Tối muộn)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                    🗓️ Ngày Check-out:
                                </label>
                                <input
                                    type="date"
                                    min={checkInDate || todayStr}
                                    value={checkOutDate}
                                    onChange={(e) => setCheckOutDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                    👥 Số khách dự kiến:
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="VD: 15"
                                        value={estimatedGuests}
                                        onChange={(e) => setEstimatedGuests(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                                    />
                                    <span className="text-xs font-black text-indigo-700 shrink-0 whitespace-nowrap bg-indigo-50 px-2.5 py-2 rounded-xl border border-indigo-100">
                                        {nights} đêm
                                    </span>
                                </div>
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

                                    const availInfo = availabilities[cat.id] || availabilities[String(cat.id)];
                                    const availRooms = availInfo ? availInfo.available_rooms : null;
                                    const isSoldOut = availInfo ? (availInfo.is_sold_out || availRooms <= 0) : false;

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
                                                    {isLoadingAvail ? (
                                                        <span className="text-[10px] text-indigo-600 animate-pulse font-medium">Đang kiểm tra...</span>
                                                    ) : isSoldOut ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                                            🔴 Hết phòng
                                                        </span>
                                                    ) : availRooms !== null ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            🟢 Còn: <strong>{availRooms}</strong> phòng
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
                                                    title={availRooms !== null && qty >= availRooms ? `Chỉ còn ${availRooms} phòng trống, không thể chọn vượt quá số phòng trống!` : ''}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* KHỐI 3.5: DANH SÁCH KHÁCH LƯU TRÚ CHO TỪNG PHÒNG & DỊCH VỤ ĐI KÈM (ROOMING LIST) */}
                        {totalRoomsCount > 0 && (
                            <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/30 border border-indigo-200 rounded-2xl shadow-xs space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-indigo-100">
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                                            <span>👥</span>
                                            <span>Danh Sách Khách Lưu Trú Cho Từng Phòng & Dịch Vụ Đặt Kèm</span>
                                            <span className="text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                                                {totalRoomsCount} phòng • {roomingList.reduce((acc, r) => acc + (r.guests?.length || 0), 0)} khách
                                            </span>
                                        </h3>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            Khai báo trước danh sách người ở & dịch vụ tiện ích kèm theo từng phòng để hỗ trợ thủ tục nhận phòng (Fast Check-in) nhanh nhất.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setIsRoomingListOpen(!isRoomingListOpen)}
                                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <span>{isRoomingListOpen ? 'Thu gọn' : 'Mở rộng danh sách'}</span>
                                        <span>{isRoomingListOpen ? '▲' : '▼'}</span>
                                    </button>
                                </div>

                                {isRoomingListOpen && (
                                    <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                                        {roomingList.map((room) => {
                                            const roomCap = Number(room.capacity || 2);
                                            const guestCount = room.guests.length;
                                            const isFull = guestCount >= roomCap;

                                            return (
                                                <div
                                                    key={room.room_key}
                                                    className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-indigo-200 transition space-y-3"
                                                >
                                                    {/* Header của từng phòng */}
                                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                                                                #{room.global_index}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-900 text-xs sm:text-sm">
                                                                    Phòng {room.global_index}: {room.category_name}
                                                                </div>
                                                                <span className="text-[10px] text-slate-500">
                                                                    Sức chứa tối đa: <strong className="text-slate-700">{roomCap} khách/phòng</strong>
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {/* Sức chứa badge */}
                                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 border ${
                                                                isFull
                                                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                                            }`}>
                                                                <span>👥</span>
                                                                <span>{guestCount}/{roomCap} khách</span>
                                                                {isFull && <span className="text-amber-600 font-semibold">(Tối đa)</span>}
                                                            </span>

                                                            <button
                                                                type="button"
                                                                disabled={isFull}
                                                                onClick={() => handleAddGuestToAllocatedRoom(room.room_key)}
                                                                title={isFull ? `Phòng đã đạt sức chứa tối đa (${roomCap} khách)` : 'Thêm người ở cùng phòng này'}
                                                                className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition flex items-center gap-1 ${
                                                                    isFull
                                                                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 cursor-pointer active:scale-95'
                                                                }`}
                                                            >
                                                                <span>➕</span>
                                                                <span>Thêm người ở</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Danh sách khách trong phòng */}
                                                    <div className="space-y-2">
                                                        {room.guests.map((guest, gIdx) => {
                                                            const isPrimary = Boolean(guest.is_primary || gIdx === 0);

                                                            return (
                                                                <div
                                                                    key={guest.id || gIdx}
                                                                    className={`p-2.5 rounded-lg border transition ${
                                                                        isPrimary
                                                                            ? 'bg-indigo-50/40 border-indigo-200/80'
                                                                            : 'bg-slate-50/60 border-slate-200'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center justify-between mb-1.5">
                                                                        <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                                                                            <span>{isPrimary ? '⭐' : '👤'}</span>
                                                                            <span>{isPrimary ? 'Khách đại diện phòng' : `Khách ở cùng #${gIdx}`}</span>
                                                                        </span>

                                                                        {!isPrimary && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRemoveGuestFromAllocatedRoom(room.room_key, gIdx)}
                                                                                className="text-rose-600 hover:text-rose-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer p-0.5 hover:bg-rose-50 rounded transition"
                                                                            >
                                                                                <span>✕ Xóa</span>
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 text-[11px]">
                                                                        {/* Họ và tên */}
                                                                        <div className="sm:col-span-2">
                                                                            <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                                                                                Họ và tên
                                                                            </label>
                                                                            <input
                                                                                type="text"
                                                                                value={guest.full_name || ''}
                                                                                onChange={(e) => handleAllocatedGuestFieldChange(room.room_key, gIdx, 'full_name', e.target.value)}
                                                                                placeholder={isPrimary && room.global_index === 1 ? leaderName || 'Nguyễn Văn A' : 'Nguyễn Văn A'}
                                                                                className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                            />
                                                                        </div>

                                                                        {/* Loại giấy tờ */}
                                                                        <div>
                                                                            <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Loại giấy tờ</label>
                                                                            <select
                                                                                value={guest.id_type || 'CCCD'}
                                                                                onChange={(e) => handleAllocatedGuestFieldChange(room.room_key, gIdx, 'id_type', e.target.value)}
                                                                                className="w-full px-1.5 py-1 bg-white border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                                            >
                                                                                <option value="CCCD">CCCD / CMND</option>
                                                                                <option value="PASSPORT">Hộ chiếu</option>
                                                                                <option value="OTHER">Trẻ em / Khác</option>
                                                                            </select>
                                                                        </div>

                                                                        {/* Số giấy tờ */}
                                                                        <div>
                                                                            <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Số CCCD / Hộ chiếu</label>
                                                                            <input
                                                                                type="text"
                                                                                value={guest.id_number || ''}
                                                                                onChange={(e) => handleAllocatedGuestFieldChange(room.room_key, gIdx, 'id_number', e.target.value)}
                                                                                placeholder={isPrimary && room.global_index === 1 ? identityCard || 'Số định danh...' : 'Số định danh...'}
                                                                                className="w-full px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                            />
                                                                        </div>

                                                                        {/* Giới tính */}
                                                                        <div>
                                                                            <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Giới tính</label>
                                                                            <select
                                                                                value={guest.gender || 'Nam'}
                                                                                onChange={(e) => handleAllocatedGuestFieldChange(room.room_key, gIdx, 'gender', e.target.value)}
                                                                                className="w-full px-1.5 py-1 bg-white border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                                            >
                                                                                <option value="Nam">Nam</option>
                                                                                <option value="Nữ">Nữ</option>
                                                                                <option value="Khác">Khác</option>
                                                                            </select>
                                                                        </div>

                                                                        {/* Ngày sinh */}
                                                                        <div>
                                                                            <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Ngày sinh</label>
                                                                            <input
                                                                                type="date"
                                                                                value={guest.date_of_birth || ''}
                                                                                onChange={(e) => handleAllocatedGuestFieldChange(room.room_key, gIdx, 'date_of_birth', e.target.value)}
                                                                                className="w-full px-1.5 py-1 bg-white border border-slate-200 rounded-md text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Dịch vụ chọn kèm cho phòng này */}
                                                    <div className="pt-2.5 border-t border-slate-100 space-y-2">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                                                <span>🛎️</span>
                                                                <span>Dịch vụ tiện ích chọn kèm phòng này</span>
                                                                {room.services && room.services.length > 0 && (
                                                                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold text-[10px]">
                                                                        {room.services.length} dịch vụ
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveServicePickerRoomKey(activeServicePickerRoomKey === room.room_key ? null : room.room_key)}
                                                                className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 transition cursor-pointer active:scale-95"
                                                            >
                                                                <span>➕</span>
                                                                <span>{activeServicePickerRoomKey === room.room_key ? 'Đóng menu dịch vụ' : 'Thêm dịch vụ'}</span>
                                                            </button>
                                                        </div>

                                                        {/* Danh sách dịch vụ đã chọn cho phòng */}
                                                        {room.services && room.services.length > 0 ? (
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                {room.services.map((svc) => (
                                                                    <div key={svc.service_id} className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="text-xs font-bold text-slate-900 truncate">{svc.name}</div>
                                                                            <div className="text-[10px] text-indigo-700 font-semibold">
                                                                                {formatCurrency(svc.price)} / lần
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleUpdateServiceQtyInRoom(room.room_key, svc.service_id, -1)}
                                                                                className="w-5 h-5 rounded bg-white hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center cursor-pointer border border-slate-200"
                                                                            >
                                                                                -
                                                                            </button>
                                                                            <span className="w-5 text-center text-xs font-black text-slate-800">{svc.quantity}</span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleUpdateServiceQtyInRoom(room.room_key, svc.service_id, 1)}
                                                                                className="w-5 h-5 rounded bg-white hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center cursor-pointer border border-slate-200"
                                                                            >
                                                                                +
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleRemoveServiceFromRoom(room.room_key, svc.service_id)}
                                                                                className="text-slate-400 hover:text-rose-600 text-xs ml-1 cursor-pointer p-0.5"
                                                                                title="Xóa dịch vụ"
                                                                            >
                                                                                ✕
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] text-slate-400 italic">
                                                                Chưa chọn dịch vụ nào cho phòng này (như Buffet sáng, Spa, Đưa đón sân bay, Giặt ủi...).
                                                            </div>
                                                        )}

                                                        {/* Panel chọn dịch vụ cho phòng này */}
                                                        {activeServicePickerRoomKey === room.room_key && (
                                                            <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-200/90 space-y-3 animate-in fade-in duration-150 shadow-2xs">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                                                                        
                                                                        <span>Chọn dịch vụ khách sạn muốn thêm vào phòng #{room.global_index} ({room.category_name}):</span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setActiveServicePickerRoomKey(null);
                                                                            setServiceSearchQuery('');
                                                                            setSelectedServiceCategory('all');
                                                                        }}
                                                                        className="text-slate-400 hover:text-slate-700 text-xs px-2 py-0.5 rounded-md hover:bg-white transition cursor-pointer font-bold"
                                                                    >
                                                                        ✕ Đóng
                                                                    </button>
                                                                </div>

                                                                {/* Thanh tìm kiếm & Lọc nhóm dịch vụ */}
                                                                <div className="space-y-2">
                                                                    <div className="relative">
                                                                        <input
                                                                            type="text"
                                                                            value={serviceSearchQuery}
                                                                            onChange={(e) => setServiceSearchQuery(e.target.value)}
                                                                            placeholder="Tìm nhanh dịch vụ theo tên, tiện ích (Buffet, Spa, Xe, Giặt ủi...)"
                                                                            className="w-full pl-8 pr-8 py-1.5 bg-white border border-indigo-200/80 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                                                                        />
                                                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                                                                        {serviceSearchQuery && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setServiceSearchQuery('')}
                                                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                                                            >
                                                                                ✕
                                                                            </button>
                                                                        )}
                                                                    </div>

                                                                    {/* Nhóm dịch vụ (Tabs / Pills) */}
                                                                    {serviceCategories.length > 0 && (
                                                                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setSelectedServiceCategory('all')}
                                                                                className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition cursor-pointer ${
                                                                                    selectedServiceCategory === 'all'
                                                                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                                                                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                                                                }`}
                                                                            >
                                                                                Tất cả ({availableServices.length})
                                                                            </button>
                                                                            {serviceCategories.map((cat) => {
                                                                                const countInCat = availableServices.filter(
                                                                                    (s) => String(s.category_id || s.category?.id || '') === String(cat.id) || (s.category_name || s.category?.name) === cat.name
                                                                                ).length;
                                                                                return (
                                                                                    <button
                                                                                        key={cat.id}
                                                                                        type="button"
                                                                                        onClick={() => setSelectedServiceCategory(cat.id)}
                                                                                        className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
                                                                                            String(selectedServiceCategory) === String(cat.id)
                                                                                                ? 'bg-indigo-600 text-white shadow-2xs'
                                                                                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                                                                        }`}
                                                                                    >
                                                                                        <span>{cat.icon || '🛎️'}</span>
                                                                                        <span>{cat.name}</span>
                                                                                        <span className="opacity-70 text-[10px]">({countInCat})</span>
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Lưới hiển thị danh sách dịch vụ */}
                                                                {availableServices.length > 0 ? (
                                                                    filteredServices.length > 0 ? (
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                                                                            {filteredServices.map((svcItem) => {
                                                                                const existingInRoom = (room.services || []).find((s) => s.service_id === svcItem.id);
                                                                                const qtyInRoom = existingInRoom ? existingInRoom.quantity : 0;
                                                                                return (
                                                                                    <div
                                                                                        key={svcItem.id}
                                                                                        className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition ${
                                                                                            qtyInRoom > 0
                                                                                                ? 'bg-indigo-100/70 border-indigo-300 ring-1 ring-indigo-400/30'
                                                                                                : 'bg-white border-slate-200 hover:border-indigo-300 shadow-2xs'
                                                                                        }`}
                                                                                    >
                                                                                        <div className="min-w-0">
                                                                                            <div className="flex items-center justify-between gap-1 mb-1">
                                                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 truncate max-w-[130px]">
                                                                                                    {svcItem.category_icon || '🛎️'} {svcItem.category?.name || svcItem.category_name || 'Tiện ích'}
                                                                                                </span>
                                                                                                {qtyInRoom > 0 && (
                                                                                                    <span className="text-[10px] font-black text-indigo-700 bg-indigo-200/80 px-1.5 py-0.2 rounded-full">
                                                                                                        x{qtyInRoom}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                            <div className="font-bold text-slate-900 text-xs truncate" title={svcItem.name}>
                                                                                                {svcItem.name}
                                                                                            </div>
                                                                                            {svcItem.description && (
                                                                                                <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5" title={svcItem.description}>
                                                                                                    {svcItem.description}
                                                                                                </div>
                                                                                            )}
                                                                                            <div className="text-xs font-black text-indigo-700 mt-1">
                                                                                                {formatCurrency(svcItem.price)}
                                                                                            </div>
                                                                                        </div>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleAddServiceToRoom(room.room_key, svcItem)}
                                                                                            className={`mt-2 w-full py-1.5 px-2 rounded-lg font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1 active:scale-95 ${
                                                                                                qtyInRoom > 0
                                                                                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs'
                                                                                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                                                                                            }`}
                                                                                        >
                                                                                            <span>{qtyInRoom > 0 ? `✓ Thêm tiếp (+1)` : '➕ Thêm vào phòng'}</span>
                                                                                        </button>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-center py-6 bg-white rounded-xl border border-dashed border-slate-200 space-y-1.5">
                                                                            <div className="text-base">🔍</div>
                                                                            <p className="text-xs font-semibold text-slate-600">
                                                                                Không tìm thấy dịch vụ nào phù hợp với từ khóa "{serviceSearchQuery}".
                                                                            </p>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setServiceSearchQuery('');
                                                                                    setSelectedServiceCategory('all');
                                                                                }}
                                                                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                                                                            >
                                                                                Đặt lại tìm kiếm & danh mục
                                                                            </button>
                                                                        </div>
                                                                    )
                                                                ) : (
                                                                    <div className="text-center py-4 text-xs text-slate-400">
                                                                        Đang tải danh mục dịch vụ khách sạn...
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* KHỐI 4: GHI CHÚ YÊU CẦU CỦA ĐOÀN & GHI CHÚ NỘI BỘ LỄ TÂN */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                <span>📝</span>
                                <span>Ghi Chú & Yêu Cầu Phục Vụ Đoàn</span>
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                        Yêu cầu đặc biệt của đoàn (Special Requests):
                                    </label>
                                    <textarea
                                        rows={2}
                                        placeholder="VD: Bố trí các phòng gần nhau, tầng cao, nôi em bé, ăn sáng buffet chay, xe đón sân bay..."
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                                        Ghi chú nội bộ Lễ tân / Kinh doanh (Staff only):
                                    </label>
                                    <textarea
                                        rows={2}
                                        placeholder="VD: Khách VIP của Ban Giám đốc, đoàn hẹn nộp danh sách trước ngày 15, cho check-in sớm nếu có phòng..."
                                        value={internalNote}
                                        onChange={(e) => setInternalNote(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* KHỐI 5: HÓA ĐƠN VAT DOANH NGHIỆP */}
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

                        {/* TỔNG KẾT TÀI CHÍNH, TIỀN CỌC & PHƯƠNG THỨC THANH TOÁN */}
                        <div className="p-5 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-4">
                            <div className="flex justify-between items-center text-xs text-slate-600">
                                <span>Tổng tiền phòng gốc ({totalRoomsCount} phòng • {nights} đêm):</span>
                                <span className="font-semibold text-slate-800">{formatCurrency(subtotalAmount)}</span>
                            </div>

                            {totalDiscount > 0 && (
                                <div className="flex justify-between items-center text-xs text-emerald-600 font-semibold">
                                    <span>Chiết khấu Doanh nghiệp ({discountPercent}%):</span>
                                    <span>-{formatCurrency(totalDiscount)}</span>
                                </div>
                            )}

                            {totalServicesAmount > 0 && (
                                <div className="flex justify-between items-center text-xs text-indigo-600 font-semibold">
                                    <span>Tổng dịch vụ tiện ích đặt kèm ({roomingList.reduce((acc, r) => acc + (r.services?.length || 0), 0)} dịch vụ):</span>
                                    <span>+{formatCurrency(totalServicesAmount)}</span>
                                </div>
                            )}

                            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex justify-between items-baseline">
                                <span className="text-sm font-bold text-slate-800">Tổng Giá Trị Hợp Đồng Đoàn:</span>
                                <span className="text-2xl font-black text-indigo-600">{formatCurrency(grandTotal)}</span>
                            </div>

                            {/* CỌC & PHƯƠNG THỨC THANH TOÁN */}
                            <div className="pt-2 border-t border-slate-100 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
                                    {/* CỘT 1: TIỀN ĐẶT CỌC GIỮ CHỖ */}
                                    <div className="p-3 bg-amber-50/40 border border-amber-200/80 rounded-2xl space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <span>Tiền cọc giữ chỗ:</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border transition ${
                                                    Number(customDeposit) === grandTotal && grandTotal > 0
                                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                        : isDepositCustomized
                                                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                                                        : 'bg-amber-100 text-amber-900 border-amber-300'
                                                }`}>
                                                    {Number(customDeposit) === grandTotal && grandTotal > 0
                                                        ? '✓ 100% Trọn gói'
                                                        : isDepositCustomized
                                                        ? `Tùy chỉnh (${grandTotal > 0 ? Math.round((Number(customDeposit || 0) / grandTotal) * 100) : 0}%)`
                                                        : `Mặc định ${hotelSettings.group_deposit_percent || 50}%`}
                                                </span>
                                            </label>

                                            {/* Nút bấm nhanh 50% / 100% / Đặt lại */}
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsDepositCustomized(false);
                                                        const depRate = (Number(hotelSettings.group_deposit_percent) || 50) / 100;
                                                        setCustomDeposit(grandTotal > 0 ? String(Math.round(grandTotal * depRate)) : '');
                                                    }}
                                                    className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md border transition cursor-pointer active:scale-95 ${
                                                        !isDepositCustomized
                                                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                                                    }`}
                                                    title={`Áp dụng tỷ lệ cọc mặc định ${hotelSettings.group_deposit_percent || 50}%`}
                                                >
                                                    {hotelSettings.group_deposit_percent || 50}%
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsDepositCustomized(true);
                                                        setCustomDeposit(String(grandTotal));
                                                    }}
                                                    className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md border transition cursor-pointer active:scale-95 ${
                                                        Number(customDeposit) === grandTotal && grandTotal > 0
                                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                                                    }`}
                                                    title="Thanh toán trước 100% toàn bộ hợp đồng"
                                                >
                                                    100%
                                                </button>
                                                {isDepositCustomized && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsDepositCustomized(false);
                                                            const depRate = (Number(hotelSettings.group_deposit_percent) || 50) / 100;
                                                            setCustomDeposit(grandTotal > 0 ? String(Math.round(grandTotal * depRate)) : '');
                                                        }}
                                                        className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer active:scale-95"
                                                        title="Khôi phục lại số cọc mặc định"
                                                    >
                                                        Đặt lại
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                max={grandTotal || undefined}
                                                value={customDeposit}
                                                onChange={(e) => {
                                                    setIsDepositCustomized(true);
                                                    setCustomDeposit(e.target.value);
                                                }}
                                                placeholder={String(Math.round(grandTotal * ((hotelSettings.group_deposit_percent || 50) / 100)))}
                                                className="w-full pl-3.5 pr-14 py-2 bg-white border-2 border-amber-300 focus:border-amber-600 rounded-xl text-sm font-black text-amber-950 focus:outline-none focus:ring-4 focus:ring-amber-500/10 font-mono shadow-xs transition"
                                            />
                                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-amber-700 pointer-events-none select-none">
                                                VNĐ
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] pt-0.5 px-0.5">
                                            <span className="text-slate-600 font-medium">Quy đổi thành tiền:</span>
                                            <span className="font-black text-amber-700 text-xs">
                                                {formatCurrency(Number(customDeposit) || 0)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* CỘT 2: PHƯƠNG THỨC THANH TOÁN CỌC */}
                                    <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-slate-800">
                                                Phương thức thanh toán cọc:
                                            </label>
                                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                                                {depositPaymentMethod === 'TRANSFER'
                                                    ? 'Tự động VietQR'
                                                    : depositPaymentMethod === 'CASH'
                                                    ? '💵 Tiền mặt tại quầy'
                                                    : depositPaymentMethod === 'POS'
                                                    ? '💳 Máy quẹt POS'
                                                    : '🏢 Bảo lãnh B2B'}
                                            </span>
                                        </div>

                                        <select
                                            value={depositPaymentMethod}
                                            onChange={(e) => setDepositPaymentMethod(e.target.value)}
                                            className="w-full px-3.5 py-2 bg-white border-2 border-slate-200 focus:border-indigo-600 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 cursor-pointer shadow-xs transition"
                                        >
                                            <option value="TRANSFER">📱 Chuyển khoản VietQR (Quét tại quầy / Email)</option>
                                            <option value="CASH">💵 Tiền mặt tại quầy lễ tân</option>
                                            <option value="POS">💳 Quẹt thẻ máy POS</option>
                                            <option value="CREDIT">🏢 Bảo lãnh công nợ B2B (Thanh toán sau)</option>
                                        </select>

                                        <div className="text-[11px] text-slate-500 pt-0.5 px-0.5 truncate">
                                            {depositPaymentMethod === 'TRANSFER'
                                                ? '⚡ Quét mã VietQR trực tiếp tại quầy hoặc nhận qua Email'
                                                : depositPaymentMethod === 'CASH'
                                                ? '💵 Thu tiền mặt trực tiếp từ Trưởng đoàn tại quầy'
                                                : depositPaymentMethod === 'POS'
                                                ? '💳 Quẹt thẻ ngân hàng qua máy POS tại quầy lễ tân'
                                                : '🏢 Ghi nhận công nợ đối tác doanh nghiệp thanh toán sau'}
                                        </div>
                                    </div>
                                </div>

                                {/* KHUNG MÃ VIETQR TRỰC TIẾP TẠI QUẦY KHI CHỌN CHUYỂN KHOẢN */}
                                {depositPaymentMethod === 'TRANSFER' && depositVal > 0 && (
                                    <div className="p-4 bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-blue-50/70 rounded-2xl border-2 border-indigo-200 shadow-xs space-y-3 animate-in fade-in duration-200">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-indigo-100">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                <span className="text-xs font-bold uppercase tracking-wide text-indigo-950 flex items-center gap-1.5">
                                                    <span>📱</span> Mã VietQR Quét Trả Cọc Trực Tiếp Tại Quầy
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-full border border-indigo-200 shadow-2xs self-start sm:self-auto">
                                                ⚡ Tự động điền STK & Số tiền cọc
                                            </span>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-center gap-4">
                                            {/* Ảnh mã VietQR với viền đẹp */}
                                            <div className="relative p-2 bg-white rounded-2xl border-2 border-indigo-300 shadow-xs shrink-0 max-w-[170px] w-full aspect-square flex items-center justify-center">
                                                {vietQrUrl ? (
                                                    <img
                                                        src={vietQrUrl}
                                                        alt={`VietQR cọc ${formatCurrency(depositVal)}`}
                                                        className="w-full h-full object-contain rounded-xl"
                                                    />
                                                ) : (
                                                    <div className="text-[11px] text-slate-400 text-center">Đang tải mã QR...</div>
                                                )}
                                            </div>

                                            {/* Chi tiết thông tin chuyển khoản */}
                                            <div className="space-y-1.5 text-xs text-slate-700 flex-1 w-full text-left">
                                                <div className="flex justify-between items-baseline border-b border-indigo-100/80 pb-1.5">
                                                    <span className="text-slate-500 font-medium">Số tiền cọc cần quét:</span>
                                                    <strong className="text-base text-rose-600 font-black tracking-tight">{formatCurrency(depositVal)}</strong>
                                                </div>
                                                <div className="flex justify-between items-center border-b border-indigo-100/80 pb-1.5">
                                                    <span className="text-slate-500 font-medium">Ngân hàng:</span>
                                                    <strong className="text-slate-900 font-bold">{getBankDisplayName(bankConfig.bank_bin)}</strong>
                                                </div>
                                                <div className="flex justify-between items-center border-b border-indigo-100/80 pb-1.5">
                                                    <span className="text-slate-500 font-medium">Số tài khoản:</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <strong className="font-mono font-bold text-indigo-900 bg-white px-2 py-0.5 rounded-md border border-indigo-200 select-all">
                                                            {bankConfig.account_no}
                                                        </strong>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopyText(bankConfig.account_no, 'stk')}
                                                            className="px-1.5 py-0.5 text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded border border-indigo-200 transition cursor-pointer"
                                                        >
                                                            {copiedField === 'stk' ? '✓ Đã chép' : 'Sao chép'}
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center border-b border-indigo-100/80 pb-1.5">
                                                    <span className="text-slate-500 font-medium">Chủ tài khoản:</span>
                                                    <strong className="text-slate-900 font-bold">{bankConfig.account_name}</strong>
                                                </div>
                                                <div className="flex justify-between items-center pb-0.5">
                                                    <span className="text-slate-500 font-medium">Nội dung CK:</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <strong className="font-mono text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[11px] select-all">
                                                            {transferDescription}
                                                        </strong>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopyText(transferDescription, 'content')}
                                                            className="px-1.5 py-0.5 text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold rounded border border-amber-300 transition cursor-pointer"
                                                        >
                                                            {copiedField === 'content' ? '✓ Đã chép' : 'Sao chép'}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Nút thao tác nhanh xác nhận */}
                                                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsDepositPaidNow(true)}
                                                        className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                                                            isDepositPaidNow
                                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                                                        }`}
                                                    >
                                                        <span>{isDepositPaidNow ? '✓ Đã xác nhận khách quét xong' : '✓ Khách đã quét thanh toán xong'}</span>
                                                    </button>
                                                    {isDepositPaidNow && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsDepositPaidNow(false)}
                                                            className="py-2 px-2.5 bg-white hover:bg-slate-100 text-slate-600 font-bold text-[11px] rounded-xl border border-slate-200 transition cursor-pointer"
                                                            title="Chưa nhận được tiền, bỏ chọn"
                                                        >
                                                            Bỏ chọn
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-[10.5px] text-indigo-900/80 bg-white/80 p-2.5 rounded-xl border border-indigo-100 leading-relaxed">
                                            💡 <strong>Khách tại quầy:</strong> Khách dùng App Ngân hàng quét trực tiếp mã QR trên màn hình. Sau khi tài khoản khách sạn báo nhận tiền, bấm nút <em>"Khách đã quét thanh toán xong"</em> để đơn được duyệt sang trạng thái <strong>Confirmed</strong> ngay lập tức.
                                            <br />
                                            Nếu khách đặt từ xa qua điện thoại, bạn không cần quét mã này. Hệ thống sẽ tự động gửi email kèm mã QR đến hòm thư <strong>{leaderEmail || '(chưa nhập email)'}</strong>.
                                        </p>
                                    </div>
                                )}

                                {/* CHÍNH SÁCH THANH TOÁN PHÁT SINH (BILLING ROUTING) */}
                                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                                    <label className="text-[11px] text-slate-700 font-bold uppercase tracking-wider block">
                                        ⚖️ Chính sách chi trả dịch vụ phát sinh tại phòng:
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <div
                                            onClick={() => setBillingType('ROOM_ONLY')}
                                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex items-start gap-2.5 ${
                                                billingType === 'ROOM_ONLY'
                                                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="adminBillingType"
                                                checked={billingType === 'ROOM_ONLY'}
                                                onChange={() => setBillingType('ROOM_ONLY')}
                                                className="mt-0.5 w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            />
                                            <div className="text-[11px] leading-tight">
                                                <span className="font-bold text-slate-900 block">Khách tự trả phát sinh (ROOM_ONLY)</span>
                                                <span className="text-[10px] text-slate-500">Khách trả tiền dịch vụ tại quầy khi trả phòng lẻ.</span>
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => setBillingType('ALL_INCLUSIVE')}
                                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex items-start gap-2.5 ${
                                                billingType === 'ALL_INCLUSIVE'
                                                    ? 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-500/20'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="adminBillingType"
                                                checked={billingType === 'ALL_INCLUSIVE'}
                                                onChange={() => setBillingType('ALL_INCLUSIVE')}
                                                className="mt-0.5 w-3.5 h-3.5 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                            />
                                            <div className="text-[11px] leading-tight">
                                                <span className="font-bold text-slate-900 block">Công ty chi trả toàn bộ (ALL_INCLUSIVE)</span>
                                                <span className="text-[10px] text-slate-500">Gộp toàn bộ phát sinh vào hóa đơn tổng của đoàn.</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* CHECKBOX XÁC NHẬN ĐÃ THU CỌC TẠI QUẦY */}
                                <label className="flex items-center gap-3 p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl cursor-pointer hover:bg-emerald-50 transition">
                                    <input
                                        type="checkbox"
                                        checked={isDepositPaidNow}
                                        onChange={(e) => setIsDepositPaidNow(e.target.checked)}
                                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-400 cursor-pointer"
                                    />
                                    <div className="text-xs">
                                        <span className="font-bold text-emerald-700 block">
                                            ✓ Xác nhận đã thu đủ tiền cọc ngay tại quầy
                                        </span>
                                        <span className="text-[11px] text-slate-500">
                                            Đơn đoàn sẽ được duyệt sang trạng thái <strong>ĐÃ XÁC NHẬN (Confirmed)</strong> ngay lập tức.
                                        </span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* FOOTER ACTIONS */}
                        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={onClose}
                                className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer text-center"
                            >
                                Hủy bỏ
                            </button>

                            <button
                                type="submit"
                                disabled={isSubmitting || totalRoomsCount === 0}
                                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-center"
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
