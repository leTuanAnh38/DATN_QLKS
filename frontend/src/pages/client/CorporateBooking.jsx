import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { roomService } from '../../services/roomService';
import { hotelService } from '../../services/hotelService';
import { bookingService } from '../../services/bookingService';
import { useAuth } from '../../store/authStore';
import api from '../../services/api';
import { useHotelSettings } from '../../store/hotelSettingStore';
import { 
    Building2, 
    Tag, 
    FileText, 
    Headphones, 
    KeyRound, 
    Check, 
    Sparkles, 
    Percent, 
    ShieldCheck, 
    Receipt, 
    Users, 
    Calendar, 
    ArrowRight,
    AlertCircle,
    BedDouble,
    UserCheck,
    User,
    Scale,
    CreditCard,
    Plus,
    Minus,
    Trash2,
    Search,
    ChevronDown,
    ChevronUp,
    Copy,
    CheckCircle2,
    Bell,
    X,
    CalendarDays
} from 'lucide-react';

const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return `${num.toLocaleString('vi-VN')} VND`;
};

const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    } catch {
        return dateStr;
    }
    return dateStr;
};

const formatDateToInput = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function CorporateBooking() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { user, isAuthenticated } = useAuth();
    const { settings } = useHotelSettings();

    // Data states
    const [categories, setCategories] = useState([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState(true);

    // Dịch vụ khách sạn khả dụng để chọn kèm cho từng phòng
    const [availableServices, setAvailableServices] = useState([]);
    const [isLoadingServices, setIsLoadingServices] = useState(false);
    const [activeServicePickerRoomKey, setActiveServicePickerRoomKey] = useState(null);
    const [serviceSearchQuery, setServiceSearchQuery] = useState('');
    const [selectedServiceCategory, setSelectedServiceCategory] = useState('all');

    // Hình thức thanh toán: 'DEPOSIT_50' (Cọc 50%) hoặc 'FULL' (Thanh toán tất cả 100%)
    const [paymentOption, setPaymentOption] = useState('DEPOSIT_50');

    // Chính sách chi trả dịch vụ phát sinh: 'ROOM_ONLY' (Khách tự trả) hoặc 'ALL_INCLUSIVE' (Công ty chi trả toàn bộ)
    const [billingType, setBillingType] = useState('ROOM_ONLY');

    // Dynamic VietQR Bank Config (Tải từ hệ thống cấu hình ngân hàng)
    const [bankConfig, setBankConfig] = useState({
        bank_bin: '970422',
        account_no: '0344997778',
        account_name: 'KHACH SAN TA DA NANG'
    });
    const [copiedField, setCopiedField] = useState(null);

    // Dynamic Hotel Policies from System Settings
    const [hotelSettings, setHotelSettings] = useState({
        group_deposit_percent: 50,
        vat_percent: 8,
        service_charge_percent: 5,
        check_in_time: '14:00',
        check_out_time: '12:00'
    });

    // Tự động tải cấu hình ngân hàng & Cài đặt hệ thống từ Backend
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
                    setHotelSettings(prev => ({
                        ...prev,
                        group_deposit_percent: Number(hData.group_deposit_percent) || 50,
                        vat_percent: Number(hData.vat_percent) || 8,
                        service_charge_percent: Number(hData.service_charge_percent) || 5,
                        check_in_time: hData.check_in_time || prev.check_in_time,
                        check_out_time: hData.check_out_time || prev.check_out_time
                    }));
                }
            }
        }).catch((err) => {
            console.error('Không thể tải cấu hình ngân hàng hoặc cài đặt khách sạn:', err);
        });
        return () => { isMounted = false; };
    }, []);

    // Corporate Code Validation
    const [corporateCodeInput, setCorporateCodeInput] = useState('');
    const [isValidatingCode, setIsValidatingCode] = useState(false);
    const [appliedPartner, setAppliedPartner] = useState(null);
    const [codeError, setCodeError] = useState('');

    // Dates - Safe local dates with query/state fallback
    const todayStr = useMemo(() => formatDateToInput(new Date()), []);
    const tomorrowStr = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return formatDateToInput(d);
    }, []);

    const initialCheckIn = location.state?.checkInDate || searchParams.get('checkIn') || todayStr;
    const initialCheckOut = location.state?.checkOutDate || searchParams.get('checkOut') || tomorrowStr;

    const [checkInDate, setCheckInDate] = useState(initialCheckIn);
    const [checkOutDate, setCheckOutDate] = useState(initialCheckOut);

    // Multi-room selection: { [catId]: quantity }
    const [selectedRooms, setSelectedRooms] = useState({});

    // Leader info
    const [groupName, setGroupName] = useState('');
    const [leaderName, setLeaderName] = useState(user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user?.username || ''));
    const [leaderPhone, setLeaderPhone] = useState(user?.phone_number || '');
    const [leaderEmail, setLeaderEmail] = useState(user?.email || '');
    const [identityCard, setIdentityCard] = useState(
        user?.guest_profile?.id_card_number || user?.id_card_number || user?.identity_card || user?.id_number || ''
    );
    const [note, setNote] = useState('');

    // Tự động đồng bộ thông tin Trưởng đoàn & CCCD khi hồ sơ người dùng (User Profile) thay đổi hoặc tải xong
    useEffect(() => {
        if (user) {
            const fullName = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user.username || '');
            const phone = user.phone_number || '';
            const email = user.email || '';
            const cccd = user.guest_profile?.id_card_number || user.id_card_number || user.identity_card || user.id_number || '';

            setLeaderName((prev) => prev || fullName);
            setLeaderPhone((prev) => prev || phone);
            setLeaderEmail((prev) => prev || email);
            setIdentityCard((prev) => prev || cccd);
        }
    }, [user]);

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
    const [isPaidSuccess, setIsPaidSuccess] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [preparedGroupPayload, setPreparedGroupPayload] = useState(null);
    const [modalError, setModalError] = useState('');
    const [toastNotice, setToastNotice] = useState(null); // { type: 'warning' | 'error' | 'success', text: '' }

    const showToastNotice = (type, text) => {
        setToastNotice({ type, text });
        setTimeout(() => setToastNotice(null), 4000);
    };

    // Tự động kiểm tra trạng thái thanh toán VietQR (Long Polling 3s/lần)
    useEffect(() => {
        if (!createdGroup?.group_code || isPaidSuccess) return;

        let isMounted = true;
        let isChecking = false;

        const checkStatus = async () => {
            if (isChecking || !isMounted) return;
            isChecking = true;
            try {
                const res = await api.get(`/payments/${createdGroup.group_code}/status/`);
                if (isMounted && res.data?.status === 'COMPLETED') {
                    setIsPaidSuccess(true);
                }
            } catch (err) {
                // Nuốt lỗi mạng tạm thời trong lúc polling
            } finally {
                isChecking = false;
            }
        };

        checkStatus();
        const intervalId = setInterval(checkStatus, 3000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [createdGroup, isPaidSuccess]);

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

    // Load danh mục dịch vụ khách sạn đang phục vụ
    useEffect(() => {
        let isMounted = true;
        setIsLoadingServices(true);
        hotelService.getServices({ status: 'active' })
            .then((res) => {
                if (isMounted && res?.success && Array.isArray(res.items)) {
                    setAvailableServices(res.items);
                }
            })
            .catch((err) => {
                console.error('Không thể tải danh sách dịch vụ:', err);
            })
            .finally(() => {
                if (isMounted) setIsLoadingServices(false);
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

    // Rooming List state: Danh sách phân phòng & khách lưu trú từng phòng (Tùy chọn)
    const [roomingList, setRoomingList] = useState([]);
    const [isRoomingListOpen, setIsRoomingListOpen] = useState(true);

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
                        const currentGlobalIdx = globalRoomIdx++;
                        const isFirstRoom = currentGlobalIdx === 1;

                        if (existingRoom) {
                            nextList.push({
                                ...existingRoom,
                                room_key: roomKey,
                                global_index: currentGlobalIdx,
                                category_name: cat.name,
                                capacity: Number(cat.capacity || 2),
                                room_index: i + 1,
                                services: existingRoom.services || []
                            });
                        } else {
                            nextList.push({
                                room_key: roomKey,
                                global_index: currentGlobalIdx,
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

    // Tự động điền Trưởng đoàn & CCCD vào Phòng 1 nếu chưa nhập
    useEffect(() => {
        if (roomingList.length > 0) {
            setRoomingList((prev) => {
                if (prev.length === 0) return prev;
                const firstRoom = prev[0];
                if (firstRoom.guests && firstRoom.guests.length > 0) {
                    const firstGuest = firstRoom.guests[0];
                    if (!firstGuest.full_name && leaderName) {
                        const next = [...prev];
                        next[0] = {
                            ...firstRoom,
                            guests: [
                                {
                                    ...firstGuest,
                                    full_name: leaderName,
                                    id_number: firstGuest.id_number || identityCard || ''
                                },
                                ...firstRoom.guests.slice(1)
                            ]
                        };
                        return next;
                    }
                }
                return prev;
            });
        }
    }, [leaderName, identityCard]);

    const handleAddGuestToAllocatedRoom = (roomKey) => {
        setRoomingList((prev) =>
            prev.map((room) => {
                if (room.room_key !== roomKey) return room;
                if (room.guests.length >= room.capacity) {
                    showToastNotice('warning', `Hạng phòng "${room.category_name}" chỉ có sức chứa tối đa ${room.capacity} khách. Không thể thêm vượt quá quy định!`);
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

    // Danh sách nhóm dịch vụ duy nhất để lọc
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

    // Danh sách dịch vụ sau khi lọc theo từ khóa tìm kiếm và nhóm dịch vụ
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

    const { totalRoomsCount, subtotalAmount, totalDiscount, totalServicesAmount, grandTotal, depositAmount } = useMemo(() => {
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

        // Tính tổng tiền dịch vụ đã chọn cho tất cả các phòng
        let servicesTotal = 0;
        roomingList.forEach((r) => {
            (r.services || []).forEach((s) => {
                servicesTotal += Number(s.price || 0) * Number(s.quantity || 1);
            });
        });

        const discount = discountPercent > 0 ? (subtotal * discountPercent) / 100 : 0;
        const total = Math.max(0, subtotal - discount + servicesTotal);
        const groupDepositPercent = Number(hotelSettings.group_deposit_percent) || 50;
        const deposit = paymentOption === 'FULL' ? total : Math.round(total * (groupDepositPercent / 100));

        return {
            totalRoomsCount: count,
            subtotalAmount: subtotal,
            totalDiscount: discount,
            totalServicesAmount: servicesTotal,
            grandTotal: total,
            depositAmount: deposit
        };
    }, [categories, selectedRooms, nights, discountPercent, roomingList, paymentOption, hotelSettings.group_deposit_percent]);

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

        if (isCompanyInvoice) {
            if (!companyName.trim()) {
                setSubmitError('Vui lòng nhập Tên đầy đủ của công ty / doanh nghiệp xuất hóa đơn.');
                return;
            }
            if (!companyTaxCode.trim()) {
                setSubmitError('Vui lòng nhập Mã số thuế doanh nghiệp.');
                return;
            }
            if (!companyAddress.trim()) {
                setSubmitError('Vui lòng nhập Địa chỉ trụ sở ghi trên hóa đơn công ty.');
                return;
            }
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

        // Danh sách phân phòng & khách lưu trú & dịch vụ đi kèm từng phòng
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
            corporate_code: appliedPartner ? appliedPartner.corporate_code : null,
            corporate_partner_id: appliedPartner ? appliedPartner.id : null,
            leader_name: leaderName.trim(),
            leader_phone: leaderPhone.trim(),
            leader_email: leaderEmail.trim() || null,
            identity_card: identityCard.trim() || '',
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            rooms: roomsPayload,
            rooming_list: roomingPayload,
            payment_option: paymentOption,
            deposit_amount: depositAmount,
            billing_type: billingType,
            note: note.trim() || null,
            is_company_invoice: isCompanyInvoice,
            company_name: isCompanyInvoice ? companyName.trim() : null,
            company_tax_code: isCompanyInvoice ? companyTaxCode.trim() : null,
            company_address: isCompanyInvoice ? companyAddress.trim() : null,
            invoice_recipient_email: isCompanyInvoice ? invoiceRecipientEmail.trim() : null
        };

        // Lưu thông tin đơn đặt đoàn và mở Modal xác nhận tóm tắt
        setModalError('');
        setPreparedGroupPayload(payload);
        setShowConfirmModal(true);
    };

    // Thực thi gọi API tạo đơn đặt phòng đoàn sau khi xác nhận trên Modal
    const handleConfirmGroupBooking = async () => {
        if (!preparedGroupPayload) return;
        try {
            setIsSubmitting(true);
            setModalError('');
            const res = await bookingService.createGroupBooking(preparedGroupPayload);
            if (res.success) {
                setShowConfirmModal(false);
                setIsSubmitting(false);
                setCreatedGroup({
                    group_code: res.group_code,
                    deposit_amount: res.deposit_amount,
                    total_amount: res.total_amount,
                    total_rooms: res.total_rooms,
                    payment_option: paymentOption
                });
            } else {
                setIsSubmitting(false);
                const errMsg = res.message || 'Không thể tạo đơn đặt đoàn. Vui lòng kiểm tra lại.';
                setModalError(errMsg);
                setSubmitError(errMsg);
            }
        } catch (err) {
            console.error('Lỗi khi gửi yêu cầu đặt đoàn:', err);
            setIsSubmitting(false);
            const errMsg = err.response?.data?.message || err.message || 'Đã xảy ra lỗi kết nối. Vui lòng thử lại sau.';
            setModalError(errMsg);
            setSubmitError(errMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-900">
            <Navbar />

            {/* BREADCRUMB ĐỒNG BỘ 100% VỚI CÁC TRANG KHÁC */}
            <div className="bg-white border-b border-slate-100 py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500">
                        <Link to="/" className="hover:text-amber-600 transition">Trang chủ</Link>
                        <span>/</span>
                        <Link to="/rooms" className="hover:text-amber-600 transition">Phòng nghỉ & Suites</Link>
                        <span>/</span>
                        <span className="text-slate-900 font-semibold truncate">Đặt phòng theo đoàn công ty</span>
                    </nav>
                </div>
            </div>

            <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

                {/* 2. HERO BANNER LUXURY SÁNG SỦA, TINH TẾ */}
                <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-50 via-white to-amber-50/40 border border-slate-200/90 shadow-md">
                    {/* Ảnh resort sáng nét, phủ nhẹ ở góc phải */}
                    <div className="absolute right-0 top-0 bottom-0 w-full md:w-1/2 overflow-hidden pointer-events-none opacity-60 md:opacity-95">
                        <img
                            src={settings?.banner_corporate || "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80"}
                            alt="Đặt phòng theo đoàn khách sạn TA Đà Nẵng"
                            className="w-full h-full object-cover object-center"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/45 to-transparent" />
                    </div>

                    <div className="relative z-10 p-6 sm:p-10 space-y-6 max-w-2xl">
                        <div className="space-y-3">
                        

                            <h1 className="font-serif text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                                Khách Hàng Doanh Nghiệp <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700">
                                    & Đặt Phòng Theo Đoàn
                                </span>
                            </h1>
                            <p className="text-slate-600 text-xs sm:text-sm sm:leading-relaxed font-normal">
                                Giải pháp lưu trú toàn diện cho công tác, hội thảo và du lịch tập thể. Đặt nhiều phòng cùng lúc với chiết khấu hợp đồng ưu đãi, xuất Hóa đơn GTGT (VAT) điện tử hợp lệ và điều phối chuyên nghiệp.
                            </p>
                        </div>

                        {/* Các tiện ích & đặc quyền dành riêng cho đoàn */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200/80">
                            <div className="flex items-center gap-3 bg-white/95 p-3.5 rounded-2xl border border-slate-200 shadow-2xs hover:border-amber-400 hover:shadow-xs transition-all">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/80 shadow-2xs">
                                    <Percent className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900">Chiết Khấu B2B</h4>
                                    <p className="text-[11px] text-slate-500">Ưu đãi theo hợp đồng</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 bg-white/95 p-3.5 rounded-2xl border border-slate-200 shadow-2xs hover:border-amber-400 hover:shadow-xs transition-all">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/80 shadow-2xs">
                                    <Receipt className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900">Hóa Đơn VAT</h4>
                                    <p className="text-[11px] text-slate-500">Xuất hóa đơn hợp lệ</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 bg-white/95 p-3.5 rounded-2xl border border-slate-200 shadow-2xs hover:border-amber-400 hover:shadow-xs transition-all">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/80 shadow-2xs">
                                    <Headphones className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900">Trợ Lý Đoàn</h4>
                                    <p className="text-[11px] text-slate-500">Hỗ trợ check-in 24/7</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {submitError && (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 shadow-xs">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{submitError}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* BƯỚC 1: XÁC THỰC MÃ DOANH NGHIỆP */}
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/60 shadow-2xs">
                                        <KeyRound className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <span>1. Nhập Mã Đối Tác Doanh Nghiệp (Corporate Code)</span>
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 pl-10.5">
                                    Nếu công ty bạn đã ký kết thỏa thuận hợp tác, nhập mã để kích hoạt giá ưu đãi theo hợp đồng.
                                </p>
                            </div>
                        </div>

                        {!appliedPartner ? (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-lg sm:pl-10.5">
                                <input
                                    type="text"
                                    placeholder="Nhập mã (VD: FPT2026, VIETTEL2026...)"
                                    value={corporateCodeInput}
                                    onChange={(e) => setCorporateCodeInput(e.target.value.toUpperCase())}
                                    className="flex-1 px-4 py-3 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                                />
                                <button
                                    type="button"
                                    disabled={isValidatingCode || !corporateCodeInput.trim()}
                                    onClick={handleApplyCorporateCode}
                                    className="px-6 py-3 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-xs rounded-2xl shadow-md shadow-sky-900/20 hover:shadow-sky-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
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
                            <p className="text-xs text-rose-600 font-semibold pl-10.5">{codeError}</p>
                        )}
                    </div>

                    {/* BƯỚC 2: CHỌN THỜI GIAN LƯU TRÚ */}
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/60 shadow-2xs">
                                <Calendar className="w-4 h-4 text-amber-600" />
                            </div>
                            <span>2. Chọn Lịch Trình Lưu Trú Của Đoàn</span>
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center pl-0 sm:pl-10.5">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Ngày nhận phòng (Check-in):
                                </label>
                                <input
                                    type="date"
                                    min={todayStr}
                                    value={checkInDate}
                                    onChange={(e) => setCheckInDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer transition font-sans tabular-nums"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                    Ngày trả phòng (Check-out):
                                </label>
                                <input
                                    type="date"
                                    min={checkInDate || todayStr}
                                    value={checkOutDate}
                                    onChange={(e) => setCheckOutDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer transition font-sans tabular-nums"
                                />
                            </div>

                            <div className="text-center sm:text-right pt-2 sm:pt-0">
                                <span className="text-xs text-slate-500 block font-medium">Thời gian đoàn lưu trú:</span>
                                <span className="text-2xl font-black text-amber-600 font-sans tabular-nums">{nights} đêm</span>
                            </div>
                        </div>
                    </div>

                    {/* BƯỚC 3: CƠ CẤU PHÒNG ĐOÀN (MULTI-ROOM SELECTION) */}
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/60 shadow-2xs">
                                        <BedDouble className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <span>3. Chọn Số Lượng & Hạng Phòng Cần Đặt</span>
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 pl-10.5">
                                    Tùy chọn linh hoạt số lượng cho từng hạng phòng khác nhau trong cùng một đơn.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {isLoadingAvail && (
                                    <span className="text-xs text-amber-600 font-semibold animate-pulse flex items-center gap-1.5">
                                        <div className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang cập nhật chỗ trống...</span>
                                    </span>
                                )}
                                <span className="px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-xs font-bold font-sans tabular-nums">
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
                                            className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                                                isSoldOut
                                                    ? 'bg-slate-50/50 border-slate-200 opacity-60'
                                                    : qty > 0
                                                    ? 'bg-amber-50/40 border-amber-400/90 shadow-2xs ring-1 ring-amber-400/20'
                                                    : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-slate-900 text-sm truncate">{cat.name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="font-black text-amber-600 text-sm font-sans tabular-nums">{formatCurrency(discountedPrice)}</span>
                                                    <span className="text-[11px] text-slate-500">/đêm</span>
                                                    {discountPercent > 0 && (
                                                        <span className="line-through text-xs text-slate-400 font-sans tabular-nums">{formatCurrency(basePrice)}</span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                    <span className="text-[11px] text-slate-500">Sức chứa: {cat.capacity || 2} khách/phòng</span>
                                                    <span className="text-slate-300">•</span>
                                                    {isLoadingAvail ? (
                                                        <span className="text-[11px] text-amber-600 animate-pulse font-medium">Đang kiểm tra chỗ...</span>
                                                    ) : isSoldOut ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                                            <span>Hết phòng trống</span>
                                                        </span>
                                                    ) : availRooms !== null ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                            <span>Còn trống: <strong className="font-extrabold text-emerald-800 font-sans tabular-nums">{availRooms}</strong> phòng</span>
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {/* Quantity Counter */}
                                            <div className="flex items-center gap-1.5 shrink-0 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                                                <button
                                                    type="button"
                                                    disabled={qty <= 0}
                                                    onClick={() => handleRoomQtyChange(cat.id, -1)}
                                                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 font-black text-sm flex items-center justify-center cursor-pointer transition active:scale-95"
                                                >
                                                    <Minus className="w-3.5 h-3.5" />
                                                </button>
                                                <span className="w-8 text-center font-black text-slate-900 text-sm font-sans tabular-nums">{qty}</span>
                                                <button
                                                    type="button"
                                                    disabled={isSoldOut || (availRooms !== null && qty >= availRooms)}
                                                    onClick={() => handleRoomQtyChange(cat.id, 1)}
                                                    className="w-8 h-8 rounded-lg bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:from-slate-200 disabled:to-slate-200 disabled:cursor-not-allowed text-white font-black text-sm flex items-center justify-center cursor-pointer transition active:scale-95 shadow-2xs"
                                                    title={availRooms !== null && qty >= availRooms ? `Chỉ còn ${availRooms} phòng trống` : ''}
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* BƯỚC 4: THÔNG TIN TRƯỞNG ĐOÀN & XUẤT HÓA ĐƠN VAT */}
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/60 shadow-2xs">
                                <UserCheck className="w-4 h-4 text-amber-600" />
                            </div>
                            <span>4. Thông Tin Người Đại Diện & Hóa Đơn GTGT (VAT)</span>
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Tên Đoàn / Sự kiện:
                                </label>
                                <input
                                    type="text"
                                    placeholder="VD: Đoàn Hội Thảo FPT Đà Nẵng"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Trưởng đoàn / Người phụ trách: <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Họ và tên"
                                    value={leaderName}
                                    onChange={(e) => setLeaderName(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Số điện thoại liên hệ: <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    placeholder="0912..."
                                    value={leaderPhone}
                                    onChange={(e) => setLeaderPhone(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Email nhận hợp đồng / Xác nhận:
                                </label>
                                <input
                                    type="email"
                                    placeholder="truongdoan@company.com"
                                    value={leaderEmail}
                                    onChange={(e) => setLeaderEmail(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                        Số CCCD / Hộ chiếu người đại diện:
                                    </label>
                                    {(user?.guest_profile?.id_card_number || user?.id_card_number || user?.identity_card || user?.id_number) && identityCard && (
                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                                            <span>✓</span>
                                            <span>Từ hồ sơ cá nhân</span>
                                        </span>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    placeholder="12 số CCCD hoặc mã Hộ chiếu (Passport)"
                                    value={identityCard}
                                    onChange={(e) => setIdentityCard(e.target.value.toUpperCase())}
                                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Phục vụ khai báo lưu trú tạm trú nhanh theo quy định.
                                </p>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                    Yêu cầu đặc biệt / Ghi chú cho đoàn:
                                </label>
                                <input
                                    type="text"
                                    placeholder="VD: Cần hỗ trợ check-in sớm, bố trí phòng gần nhau..."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Khách sạn sẽ tiếp nhận và phản hồi theo khả năng đáp ứng.
                                </p>
                            </div>
                        </div>

                        {/* Hóa đơn VAT */}
                        <div className="pt-4 border-t border-slate-200 space-y-4">
                            <label className="flex items-center justify-between cursor-pointer p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 transition">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/60">
                                        <FileText className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-slate-900 block">Yêu cầu xuất Hóa đơn GTGT (VAT) cho Công ty</span>
                                        <span className="text-[11px] text-slate-500">Khách sạn sẽ phát hành hóa đơn điện tử hợp lệ gửi về email kế toán</span>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={isCompanyInvoice}
                                    onChange={(e) => setIsCompanyInvoice(e.target.checked)}
                                    className="w-4 h-4 text-amber-600 rounded-md focus:ring-amber-500 cursor-pointer accent-amber-600"
                                />
                            </label>

                            {isCompanyInvoice && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl bg-amber-50/30 border border-amber-200/80 animate-in fade-in duration-200">
                                    <div className="sm:col-span-2">
                                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Tên Doanh Nghiệp / Công ty *</label>
                                        <input
                                            type="text"
                                            placeholder="Tên đầy đủ theo giấy phép ĐKKD"
                                            value={companyName}
                                            onChange={(e) => setCompanyName(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
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
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
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
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Địa chỉ đăng ký kinh doanh</label>
                                        <input
                                            type="text"
                                            placeholder="Địa chỉ trụ sở công ty..."
                                            value={companyAddress}
                                            onChange={(e) => setCompanyAddress(e.target.value)}
                                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* BƯỚC 5: DANH SÁCH PHÂN PHÒNG & NGƯỜI Ở CÙNG (ROOMING LIST - TÙY CHỌN) */}
                    {totalRoomsCount > 0 && (
                        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/60 shadow-2xs">
                                            <Users className="w-4 h-4 text-amber-600" />
                                        </div>
                                        <span>5. Danh Sách Khách Lưu Trú Cho Từng Phòng</span>
                                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80">
                                            Tùy chọn - Không bắt buộc
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1 pl-10.5">
                                        Khai báo trước danh sách người ở cho từng phòng để nhận phòng nhanh (Fast Check-in) khi đến. Nếu chưa có danh sách chính xác, bạn có thể bỏ qua để Lễ tân hỗ trợ sau.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setIsRoomingListOpen(!isRoomingListOpen)}
                                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                >
                                    <span>{isRoomingListOpen ? 'Thu gọn' : 'Mở danh sách'}</span>
                                    {isRoomingListOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                            </div>

                            {isRoomingListOpen && (
                                <div className="space-y-4">
                                    {roomingList.map((room) => {
                                        const roomCap = Number(room.capacity || 2);
                                        const guestCount = room.guests.length;
                                        const isFull = guestCount >= roomCap;

                                        return (
                                            <div
                                                key={room.room_key}
                                                className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition space-y-3"
                                            >
                                                {/* Header của từng phòng */}
                                                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white font-black text-xs flex items-center justify-center shadow-xs font-sans tabular-nums">
                                                            #{room.global_index}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900 text-xs sm:text-sm">
                                                                Phòng {room.global_index}: {room.category_name}
                                                            </div>
                                                            <span className="text-[11px] text-slate-500">
                                                                Sức chứa tối đa: <strong className="text-slate-700 font-sans tabular-nums">{roomCap} người lớn</strong>
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {/* Badge sức chứa */}
                                                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border font-sans tabular-nums ${
                                                            isFull
                                                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                                : 'bg-white text-slate-700 border-slate-200'
                                                        }`}>
                                                            <Users className="w-3.5 h-3.5 text-slate-500" />
                                                            <span>{guestCount}/{roomCap} người</span>
                                                            {isFull && <span className="text-[10px] text-amber-600 font-semibold">(Đã tối đa)</span>}
                                                        </span>

                                                        <button
                                                            type="button"
                                                            disabled={isFull}
                                                            onClick={() => handleAddGuestToAllocatedRoom(room.room_key)}
                                                            title={isFull ? `Phòng đã đạt sức chứa tối đa (${roomCap} người)` : 'Thêm người ở cùng'}
                                                            className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 ${
                                                                isFull
                                                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 cursor-pointer active:scale-95'
                                                            }`}
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                            <span>Thêm người ở cùng</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Danh sách khách trong phòng */}
                                                <div className="space-y-2.5">
                                                    {room.guests.map((guest, gIdx) => {
                                                        const isPrimary = Boolean(guest.is_primary || gIdx === 0);

                                                        return (
                                                            <div
                                                                key={guest.id || gIdx}
                                                                className={`p-3 rounded-xl border transition ${
                                                                    isPrimary
                                                                        ? 'bg-amber-50/40 border-amber-200/90'
                                                                        : 'bg-white border-slate-200'
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                                                        {isPrimary ? (
                                                                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                                                        ) : (
                                                                            <User className="w-3.5 h-3.5 text-slate-500" />
                                                                        )}
                                                                        <span>{isPrimary ? 'Khách đại diện phòng' : `Người ở cùng phòng #${gIdx}`}</span>
                                                                    </span>

                                                                    {!isPrimary && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveGuestFromAllocatedRoom(room.room_key, gIdx)}
                                                                            className="text-rose-600 hover:text-rose-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer p-0.5 hover:bg-rose-50 rounded transition"
                                                                        >
                                                                            <Trash2 className="w-3 h-3" />
                                                                            <span>Xóa</span>
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
                                                                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500"
                                                                        />
                                                                    </div>

                                                                    {/* Loại giấy tờ */}
                                                                    <div>
                                                                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Loại giấy tờ</label>
                                                                        <select
                                                                            value={guest.id_type || 'CCCD'}
                                                                            onChange={(e) => handleAllocatedGuestFieldChange(room.room_key, gIdx, 'id_type', e.target.value)}
                                                                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500 cursor-pointer"
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
                                                                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500"
                                                                        />
                                                                    </div>

                                                                    {/* Giới tính */}
                                                                    <div>
                                                                        <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Giới tính</label>
                                                                        <select
                                                                            value={guest.gender || 'Nam'}
                                                                            onChange={(e) => handleAllocatedGuestFieldChange(room.room_key, gIdx, 'gender', e.target.value)}
                                                                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500 cursor-pointer"
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
                                                                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500 cursor-pointer font-sans tabular-nums"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Dịch vụ chọn kèm cho phòng này */}
                                                <div className="pt-3 border-t border-slate-200/80 space-y-2.5">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                                            <Bell className="w-3.5 h-3.5 text-amber-600" />
                                                            <span>Dịch vụ tiện ích chọn kèm phòng này</span>
                                                            {room.services && room.services.length > 0 && (
                                                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] font-sans tabular-nums">
                                                                    {room.services.length} dịch vụ
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveServicePickerRoomKey(activeServicePickerRoomKey === room.room_key ? null : room.room_key)}
                                                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 transition cursor-pointer active:scale-95"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                            <span>{activeServicePickerRoomKey === room.room_key ? 'Đóng menu' : 'Thêm dịch vụ'}</span>
                                                        </button>
                                                    </div>

                                                    {/* Danh sách dịch vụ đã chọn cho phòng */}
                                                    {room.services && room.services.length > 0 ? (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            {room.services.map((svc) => (
                                                                <div key={svc.service_id} className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="text-xs font-bold text-slate-900 truncate">{svc.name}</div>
                                                                        <div className="text-[11px] text-amber-600 font-semibold font-sans tabular-nums">
                                                                            {formatCurrency(svc.price)} / lần
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleUpdateServiceQtyInRoom(room.room_key, svc.service_id, -1)}
                                                                            className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center cursor-pointer"
                                                                        >
                                                                            -
                                                                        </button>
                                                                        <span className="w-5 text-center text-xs font-black text-slate-800 font-sans tabular-nums">{svc.quantity}</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleUpdateServiceQtyInRoom(room.room_key, svc.service_id, 1)}
                                                                            className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center cursor-pointer"
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
                                                        <div className="text-[11px] text-slate-400 italic">
                                                            Chưa chọn dịch vụ nào cho phòng này (như Buffet sáng, Spa, Minibar, Đưa đón sân bay...).
                                                        </div>
                                                    )}

                                                    {/* Panel chọn dịch vụ cho phòng này */}
                                                    {activeServicePickerRoomKey === room.room_key && (
                                                        <div className="p-3.5 bg-amber-50/40 rounded-2xl border border-amber-200/80 space-y-3 animate-in fade-in duration-150 shadow-2xs">
                                                            <div className="flex items-center justify-between">
                                                                <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                                                                    <Bell className="w-3.5 h-3.5 text-amber-600" />
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
                                                                        className="w-full pl-8 pr-8 py-1.5 bg-white border border-amber-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                                                                    />
                                                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
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
                                                                                    ? 'bg-slate-900 text-white shadow-2xs'
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
                                                                                            ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-2xs'
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

                                                            {/* Lưới danh sách dịch vụ */}
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
                                                                                            ? 'bg-amber-100/70 border-amber-300 ring-1 ring-amber-400/30'
                                                                                            : 'bg-white border-slate-200 hover:border-amber-300 shadow-2xs'
                                                                                    }`}
                                                                                >
                                                                                    <div className="min-w-0">
                                                                                        <div className="flex items-center justify-between gap-1 mb-1">
                                                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 truncate max-w-[130px]">
                                                                                                {svcItem.category_icon || '🛎️'} {svcItem.category?.name || svcItem.category_name || 'Tiện ích'}
                                                                                            </span>
                                                                                            {qtyInRoom > 0 && (
                                                                                                <span className="text-[10px] font-black text-amber-800 bg-amber-200/80 px-1.5 py-0.2 rounded-full font-sans tabular-nums">
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
                                                                                        <div className="text-xs font-black text-amber-700 mt-1 font-sans tabular-nums">
                                                                                            {formatCurrency(svcItem.price)}
                                                                                        </div>
                                                                                    </div>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleAddServiceToRoom(room.room_key, svcItem)}
                                                                                        className={`mt-2 w-full py-1.5 px-2 rounded-lg font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1 active:scale-95 ${
                                                                                            qtyInRoom > 0
                                                                                                ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white hover:from-sky-700 hover:to-blue-800 shadow-2xs'
                                                                                                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
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
                                                                            className="text-[11px] font-bold text-amber-600 hover:text-amber-800 underline cursor-pointer"
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

                    {/* TỔNG KẾT & CHỌN HÌNH THỨC THANH TOÁN */}
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-6">
                        {/* 1. CHÍNH SÁCH THANH TOÁN PHÁT SINH TẠI PHÒNG (BILLING ROUTING) */}
                        <div className="space-y-3 pb-5 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <Scale className="w-4 h-4 text-amber-600" />
                                    <span>Chính sách chi trả dịch vụ phát sinh tại phòng (Minibar, Giặt là, Ăn uống...):</span>
                                </label>
                                <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">Quy định hạch toán</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {/* Tùy chọn 1: Khách tự trả phát sinh (ROOM_ONLY) */}
                                <div
                                    onClick={() => setBillingType('ROOM_ONLY')}
                                    className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 ${
                                        billingType === 'ROOM_ONLY'
                                            ? 'border-amber-500 bg-amber-50/50 shadow-sm ring-2 ring-amber-500/20'
                                            : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="billingType"
                                        checked={billingType === 'ROOM_ONLY'}
                                        onChange={() => setBillingType('ROOM_ONLY')}
                                        className="mt-1 w-4 h-4 text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer"
                                    />
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-slate-900">Khách tự trả chi phí phát sinh</span>
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                                                Mặc định
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">
                                            Công ty chỉ chi trả tiền phòng & dịch vụ đặt trước theo hợp đồng. Khách từng phòng tự thanh toán chi phí phát sinh cá nhân khi trả phòng lẻ tại quầy lễ tân.
                                        </p>
                                    </div>
                                </div>

                                {/* Tùy chọn 2: Công ty chi trả toàn bộ (ALL_INCLUSIVE) */}
                                <div
                                    onClick={() => setBillingType('ALL_INCLUSIVE')}
                                    className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 ${
                                        billingType === 'ALL_INCLUSIVE'
                                            ? 'border-orange-500 bg-orange-50/50 shadow-sm ring-2 ring-orange-500/20'
                                            : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="billingType"
                                        checked={billingType === 'ALL_INCLUSIVE'}
                                        onChange={() => setBillingType('ALL_INCLUSIVE')}
                                        className="mt-1 w-4 h-4 text-orange-600 focus:ring-orange-500 accent-orange-600 cursor-pointer"
                                    />
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-slate-900">Công ty chi trả toàn bộ</span>
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800">
                                                Bao trọn gói
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">
                                            Công ty bảo lãnh toàn bộ chi phí. Mọi dịch vụ phát sinh của các phòng sẽ được gộp vào Hóa đơn tổng (Master Folio) của công ty để quyết toán khi trả đoàn.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. CHỌN HÌNH THỨC THANH TOÁN */}
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                <CreditCard className="w-4 h-4 text-amber-600" />
                                <span>Lựa chọn hình thức thanh toán cho toàn đoàn:</span>
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {/* Tùy chọn A: Đặt cọc 50% */}
                                <div
                                    onClick={() => setPaymentOption('DEPOSIT_50')}
                                    className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 ${
                                        paymentOption === 'DEPOSIT_50'
                                            ? 'border-amber-500 bg-amber-50/50 shadow-sm ring-2 ring-amber-500/20'
                                            : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="paymentOption"
                                        checked={paymentOption === 'DEPOSIT_50'}
                                        onChange={() => setPaymentOption('DEPOSIT_50')}
                                        className="mt-1 w-4 h-4 text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer"
                                    />
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-slate-900">Đặt cọc {hotelSettings.group_deposit_percent || 50}% giữ phòng</span>
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                                Phổ biến
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">
                                            Thanh toán trước {hotelSettings.group_deposit_percent || 50}% (gồm phòng & dịch vụ). {100 - (hotelSettings.group_deposit_percent || 50)}% còn lại thanh toán khi làm thủ tục nhận phòng hoặc trả phòng.
                                        </p>
                                        <div className="text-xs font-bold text-amber-700 pt-0.5 font-sans tabular-nums">
                                            Số tiền thanh toán: {formatCurrency(Math.round(grandTotal * ((hotelSettings.group_deposit_percent || 50) / 100)))}
                                        </div>
                                    </div>
                                </div>

                                {/* Tùy chọn B: Thanh toán 100% */}
                                <div
                                    onClick={() => setPaymentOption('FULL')}
                                    className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 ${
                                        paymentOption === 'FULL'
                                            ? 'border-emerald-600 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20'
                                            : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="paymentOption"
                                        checked={paymentOption === 'FULL'}
                                        onChange={() => setPaymentOption('FULL')}
                                        className="mt-1 w-4 h-4 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                                    />
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-slate-900">Thanh toán toàn bộ 100%</span>
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                Trọn gói
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">
                                            Tất toán toàn bộ chi phí ngay. Toàn bộ phòng và dịch vụ được tất toán sẵn, khách đoàn đến chỉ việc nhận phòng.
                                        </p>
                                        <div className="text-xs font-bold text-emerald-600 pt-0.5 font-sans tabular-nums">
                                            Số tiền thanh toán: {formatCurrency(grandTotal)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. BẢNG TÍNH CHI TIẾT TỔNG HỢP */}
                        <div className="space-y-2 text-xs pt-4 border-t border-slate-200 font-sans tabular-nums">
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
                            {totalServicesAmount > 0 && (
                                <div className="flex justify-between text-amber-700 font-semibold">
                                    <span>Tổng chi phí dịch vụ chọn kèm các phòng:</span>
                                    <span>+{formatCurrency(totalServicesAmount)}</span>
                                </div>
                            )}
                            <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                                <span className="text-base font-bold text-slate-900">Tổng Giá Trị Hợp Đồng Toàn Đoàn:</span>
                                <span className="text-2xl sm:text-3xl font-black text-amber-600">{formatCurrency(grandTotal)}</span>
                            </div>
                            <div className="pt-2 flex justify-between items-baseline text-sm bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/80">
                                <span className="text-slate-800 font-bold">
                                    {paymentOption === 'FULL'
                                        ? 'Số tiền thanh toán ngay (100% Trọn gói):'
                                        : `Tiền đặt cọc giữ chỗ (${hotelSettings.group_deposit_percent || 50}% Tổng đơn):`}
                                </span>
                                <span className="text-xl font-black text-amber-600">{formatCurrency(depositAmount)}</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <p className="text-[11px] text-slate-500 max-w-md">
                                {paymentOption === 'FULL'
                                    ? 'Sau khi gửi đơn, hệ thống sẽ mở mã QR VietQR để Doanh nghiệp quét thanh toán toàn bộ 100%. Khách sạn sẽ liên hệ xác nhận trong vòng 15 phút.'
                                    : `Sau khi gửi đơn, hệ thống sẽ mở mã QR VietQR để Doanh nghiệp quét thanh toán tiền cọc ${hotelSettings.group_deposit_percent || 50}%. Khách sạn sẽ liên hệ xác nhận trong vòng 15 phút.`}
                            </p>

                            <button
                                type="submit"
                                disabled={isSubmitting || totalRoomsCount === 0}
                                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-sky-900/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang xử lý đơn đoàn...</span>
                                    </>
                                ) : (
                                    <>
                                        <Building2 className="w-4 h-4" />
                                        <span>
                                            {paymentOption === 'FULL'
                                                ? `Xác Nhận & Thanh Toán 100% (${totalRoomsCount} phòng)`
                                                : `Xác Nhận & Đặt Cọc ${hotelSettings.group_deposit_percent || 50}% (${totalRoomsCount} phòng)`}
                                        </span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>

                {/* MODAL XÁC NHẬN HỢP ĐỒNG ĐẶT PHÒNG ĐOÀN TRƯỚC KHI TẠO ĐƠN */}
                {showConfirmModal && (
                    <div
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                setShowConfirmModal(false);
                                setIsSubmitting(false);
                            }
                        }}
                        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
                    >
                        <div className="bg-white rounded-3xl border border-slate-200/80 max-w-2xl w-full shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200">
                            {/* Header - Nền trắng sang trọng đồng bộ */}
                            <div className="bg-white border-b border-slate-100 p-5 sm:p-6 relative flex items-center justify-between">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0 shadow-xs">
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900">
                                            Xác Nhận Hợp Đồng Đặt Phòng Đoàn
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Vui lòng rà soát lại thông tin đoàn và chi phí trước khi thanh toán
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowConfirmModal(false);
                                        setIsSubmitting(false);
                                    }}
                                    className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition p-2 rounded-xl cursor-pointer"
                                    title="Đóng"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-5 sm:p-6 space-y-4 max-h-[calc(85vh-160px)] overflow-y-auto text-xs sm:text-sm">
                                {/* Thông báo lỗi nếu có khi gọi API */}
                                {modalError && (
                                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2.5 animate-in fade-in duration-150">
                                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <strong className="font-bold block text-rose-800">Không thể tạo đơn đặt đoàn:</strong>
                                            <span className="mt-0.5 block">{modalError}</span>
                                        </div>
                                    </div>
                                )}

                                {/* 1. Thông tin đoàn & Người phụ trách */}
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                            Thông tin đoàn & Trưởng đoàn
                                        </span>
                                        {appliedPartner && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                                Đối tác: {appliedPartner.partner_name} (-{discountPercent}%)
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                                        <div>
                                            <span className="text-slate-400 block text-[11px]">Tên đoàn:</span>
                                            <strong className="text-slate-800 text-sm">{groupName.trim() || `Đoàn khách ${leaderName.trim()}`}</strong>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[11px]">Trưởng đoàn / Phụ trách:</span>
                                            <strong className="text-slate-800">{leaderName}</strong>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[11px]">Số điện thoại:</span>
                                            <strong className="text-slate-800">{leaderPhone}</strong>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block text-[11px]">Email nhận hợp đồng:</span>
                                            <strong className="text-slate-800">{leaderEmail || 'Chưa cung cấp'}</strong>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Thời gian đoàn lưu trú */}
                                <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-200/70 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
                                            Lịch trình lưu trú
                                        </span>
                                        <span className="font-black text-amber-800 text-sm">{nights} đêm</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                                        <div className="flex items-center gap-2">
                                            <CalendarDays className="w-4 h-4 text-amber-600 shrink-0" />
                                            <div>
                                                <span className="text-slate-500 text-[11px] block">Nhận phòng ({hotelSettings.check_in_time || '14:00'})</span>
                                                <strong className="text-slate-800">{formatDateDisplay(checkInDate)}</strong>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <CalendarDays className="w-4 h-4 text-amber-600 shrink-0" />
                                            <div>
                                                <span className="text-slate-500 text-[11px] block">Trả phòng ({hotelSettings.check_out_time || '12:00'})</span>
                                                <strong className="text-slate-800">{formatDateDisplay(checkOutDate)}</strong>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Danh sách phòng đã chọn */}
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                            Danh sách hạng phòng đoàn
                                        </span>
                                        <span className="font-bold text-amber-700 text-xs">
                                            Tổng cộng: {totalRoomsCount} phòng
                                        </span>
                                    </div>
                                    <div className="divide-y divide-slate-200/70">
                                        {categories.filter((cat) => Number(selectedRooms[cat.id]) > 0).map((cat) => {
                                            const qty = Number(selectedRooms[cat.id]);
                                            const unitPrice = Number(cat.promo_price || cat.base_price || 0);
                                            const roomSubtotal = unitPrice * nights * qty;
                                            return (
                                                <div key={cat.id} className="flex justify-between items-center py-2 text-xs">
                                                    <div>
                                                        <span className="font-bold text-slate-800">{cat.name}</span>
                                                        <span className="text-slate-500 block text-[11px]">
                                                            {qty} phòng × {nights} đêm × {formatCurrency(unitPrice)}/đêm
                                                        </span>
                                                    </div>
                                                    <span className="font-bold text-slate-900 font-sans tabular-nums">
                                                        {formatCurrency(roomSubtotal)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 4. Hóa đơn VAT (nếu có) */}
                                {isCompanyInvoice && (
                                    <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-200/70 space-y-2 text-xs">
                                        <div className="flex items-center gap-1.5 text-blue-900 font-bold uppercase tracking-wider text-[11px]">
                                            <Receipt className="w-3.5 h-3.5" />
                                            <span>Thông tin xuất hóa đơn VAT doanh nghiệp</span>
                                        </div>
                                        <div className="space-y-1 text-slate-700">
                                            <div>Công ty: <strong className="text-slate-900">{companyName}</strong></div>
                                            <div>Mã số thuế: <strong className="text-slate-900">{companyTaxCode}</strong></div>
                                            <div>Địa chỉ: <span className="text-slate-800">{companyAddress}</span></div>
                                            {invoiceRecipientEmail && (
                                                <div>Email nhận HĐĐT: <span className="text-slate-800">{invoiceRecipientEmail}</span></div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 5. Tóm tắt tài chính & Tiền cọc */}
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                                        Chi tiết tài chính hợp đồng
                                    </span>
                                    <div className="space-y-1.5 text-xs font-sans tabular-nums">
                                        <div className="flex justify-between text-slate-600">
                                            <span>Tổng tiền phòng gốc ({totalRoomsCount} phòng × {nights} đêm):</span>
                                            <span className="font-semibold text-slate-800">{formatCurrency(subtotalAmount)}</span>
                                        </div>
                                        {totalDiscount > 0 && (
                                            <div className="flex justify-between text-emerald-600 font-medium">
                                                <span>Chiết khấu đối tác ({discountPercent}%):</span>
                                                <span>-{formatCurrency(totalDiscount)}</span>
                                            </div>
                                        )}
                                        {totalServicesAmount > 0 && (
                                            <div className="flex justify-between text-amber-700 font-medium">
                                                <span>Phí dịch vụ chọn kèm các phòng:</span>
                                                <span>+{formatCurrency(totalServicesAmount)}</span>
                                            </div>
                                        )}
                                        <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                                            <span className="font-bold text-slate-900 text-sm">Tổng giá trị hợp đồng toàn đoàn:</span>
                                            <span className="text-lg font-black text-slate-900">{formatCurrency(grandTotal)}</span>
                                        </div>
                                    </div>

                                    {/* Khối tiền cọc cần thanh toán ngay */}
                                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 flex justify-between items-baseline">
                                        <div>
                                            <span className="font-bold text-amber-900 text-xs block">
                                                {paymentOption === 'FULL'
                                                    ? 'Số tiền thanh toán ngay (100% Trọn gói):'
                                                    : `Tiền đặt cọc giữ chỗ (${hotelSettings.group_deposit_percent || 50}% Tổng đơn):`}
                                            </span>
                                            {paymentOption !== 'FULL' && (
                                                <span className="text-[11px] text-amber-700">
                                                    Còn lại {formatCurrency(grandTotal - depositAmount)} thanh toán khi nhận phòng
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xl font-black text-amber-600 font-sans tabular-nums">
                                            {formatCurrency(depositAmount)}
                                        </span>
                                    </div>
                                </div>

                                {/* 6. Hướng dẫn VietQR */}
                                <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-amber-900 space-y-1">
                                    <div className="flex items-center gap-1.5 font-bold">
                                        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                                        <span>Quy trình thanh toán & Xác nhận tự động</span>
                                    </div>
                                    <p className="text-amber-800/90 pl-5.5">
                                        {paymentOption === 'FULL'
                                            ? 'Sau khi bấm xác nhận, hệ thống sẽ mở mã QR VietQR để Doanh nghiệp quét thanh toán toàn bộ 100%. Khách sạn sẽ liên hệ xác nhận trong vòng 15 phút.'
                                            : `Sau khi bấm xác nhận, hệ thống sẽ mở mã QR VietQR để Doanh nghiệp quét thanh toán tiền cọc ${hotelSettings.group_deposit_percent || 50}%. Khách sạn sẽ liên hệ xác nhận trong vòng 15 phút.`}
                                    </p>
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowConfirmModal(false);
                                        setIsSubmitting(false);
                                    }}
                                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
                                >
                                    Kiểm tra lại
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmGroupBooking}
                                    disabled={isSubmitting}
                                    className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-900/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Đang xử lý đơn đoàn...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Building2 className="w-4 h-4" />
                                            <span>
                                                {paymentOption === 'FULL'
                                                    ? `Xác Nhận & Thanh Toán 100% (${totalRoomsCount} phòng)`
                                                    : `Xác Nhận & Đặt Cọc ${hotelSettings.group_deposit_percent || 50}% (${totalRoomsCount} phòng)`}
                                            </span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL THÀNH CÔNG & MÃ VIETQR THANH TOÁN */}
                {createdGroup && (() => {
                    const isFull = createdGroup.payment_option === 'FULL';
                    const qrNote = isFull ? `TT toan doan ${createdGroup.group_code}` : `Coc doan ${createdGroup.group_code}`;

                    return (
                        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
                            <div className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
                                {isPaidSuccess ? (
                                    /* MÀN HÌNH TỰ ĐỘNG XÁC NHẬN THANH TOÁN THÀNH CÔNG */
                                    <div className="space-y-5 animate-in zoom-in-95 duration-200">
                                        <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/40">
                                            <Check className="w-10 h-10" />
                                        </div>
                                        <div>
                                            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider">
                                                Đã Nhận Tiền Thành Công
                                            </span>
                                            <h3 className="font-serif text-2xl font-black text-slate-900 mt-2">
                                                {isFull ? 'Tất Toán Hợp Đồng Đoàn Thành Công!' : 'Xác Nhận Đặt Cọc Đoàn Thành Công!'}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Hệ thống đã nhận được tiền chuyển khoản VietQR cho đơn đoàn <strong className="font-mono text-amber-700 font-black">#{createdGroup.group_code}</strong>.
                                            </p>
                                        </div>

                                        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-left text-xs space-y-2 font-sans tabular-nums">
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Trạng thái hợp đồng:</span>
                                                <strong className="text-emerald-700 font-bold">Đã xác nhận (Confirmed)</strong>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Quy mô đoàn:</span>
                                                <strong className="text-slate-900">{createdGroup.total_rooms} phòng</strong>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-600">Tổng giá trị hợp đồng:</span>
                                                <strong className="text-slate-900">{formatCurrency(createdGroup.total_amount)}</strong>
                                            </div>
                                            <div className="flex justify-between pt-2 border-t border-emerald-200/80 font-bold">
                                                <span className="text-slate-700">
                                                    {isFull ? 'Số tiền đã tất toán (100%):' : `Số tiền cọc đã thanh toán (${hotelSettings.group_deposit_percent || 50}%):`}
                                                </span>
                                                <strong className="text-emerald-600 text-sm">{formatCurrency(createdGroup.deposit_amount)}</strong>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center pt-2">
                                            <button
                                                type="button"
                                                onClick={() => navigate('/booking-history')}
                                                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-sky-600 via-blue-600 to-cyan-700 hover:from-sky-700 hover:via-blue-700 hover:to-cyan-800 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-900/20 transition cursor-pointer"
                                            >
                                                Xem Lịch Sử Đặt Phòng
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => navigate('/')}
                                                className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                                            >
                                                Về Trang Chủ
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* MÀN HÌNH QUÉT MÃ VIETQR VÀ CHỜ CHUYỂN KHOẢN */
                                    <>
                                        <div className="w-16 h-16 rounded-2xl bg-amber-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-amber-500/30">
                                            <Building2 className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <h3 className="font-serif text-2xl font-bold text-slate-900">
                                                {isFull ? 'Thanh Toán Hợp Đồng Đoàn 100%' : `Thanh Toán Đặt Cọc Đoàn ${hotelSettings.group_deposit_percent || 50}%`}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Mã đơn đoàn của quý khách: <strong className="font-mono text-amber-700 font-black text-sm">#{createdGroup.group_code}</strong>
                                            </p>
                                        </div>

                                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left text-xs space-y-2 font-sans tabular-nums">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Quy mô đoàn:</span>
                                                <strong className="text-slate-900">{createdGroup.total_rooms} phòng</strong>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Tổng tiền hợp đồng:</span>
                                                <strong className="text-slate-900">{formatCurrency(createdGroup.total_amount)}</strong>
                                            </div>
                                            <div className="flex justify-between pt-2 border-t border-slate-200 font-bold">
                                                <span className="text-slate-700">
                                                    {isFull ? 'Số tiền thanh toán tất cả (100%):' : `Tiền đặt cọc cần thanh toán (${hotelSettings.group_deposit_percent || 50}%):`}
                                                </span>
                                                <strong className="text-amber-700 text-sm">{formatCurrency(createdGroup.deposit_amount)}</strong>
                                            </div>
                                        </div>

                                        {/* Mã VietQR cọc tự động từ cấu hình hệ thống */}
                                        <div className="p-3 bg-amber-50/50 border border-amber-200/80 rounded-2xl inline-block mx-auto max-w-sm w-full">
                                            <img
                                                src={`https://img.vietqr.io/image/${bankConfig.bank_bin}-${bankConfig.account_no}-compact2.jpg?amount=${createdGroup.deposit_amount}&addInfo=${encodeURIComponent(qrNote)}&accountName=${encodeURIComponent(bankConfig.account_name)}`}
                                                alt="VietQR Payment"
                                                className="w-48 h-48 mx-auto rounded-xl object-contain shadow-xs bg-white p-1"
                                            />
                                            
                                            {/* Trạng thái lắng nghe giao dịch realtime */}
                                            <div className="flex items-center justify-center gap-2 py-1.5 px-3 mt-2 text-[11px] text-amber-900 font-bold bg-white rounded-xl border border-amber-200 shadow-2xs">
                                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></div>
                                                <span>Đang chờ nhận tiền chuyển khoản... (Tự động xác nhận)</span>
                                            </div>

                                            {/* Khung chi tiết thông tin chuyển khoản */}
                                            <div className="mt-3 p-3 bg-white rounded-xl border border-amber-100 text-left text-xs space-y-1.5 shadow-2xs font-sans tabular-nums">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-500 text-[11px]">Ngân hàng:</span>
                                                    <strong className="text-slate-900 font-bold">MB Bank ({bankConfig.bank_bin})</strong>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-500 text-[11px]">Số tài khoản:</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <strong className="font-mono text-amber-700 font-extrabold text-xs">{bankConfig.account_no}</strong>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(bankConfig.account_no);
                                                                setCopiedField('acc');
                                                                setTimeout(() => setCopiedField(null), 2000);
                                                            }}
                                                            className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer flex items-center gap-1"
                                                            title="Sao chép số tài khoản"
                                                        >
                                                            {copiedField === 'acc' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                                            <span>{copiedField === 'acc' ? 'Đã chép' : 'Sao chép'}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-500 text-[11px]">Chủ tài khoản:</span>
                                                    <strong className="text-slate-900 uppercase text-[11px] font-bold">{bankConfig.account_name}</strong>
                                                </div>
                                                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                                    <span className="text-slate-500 text-[11px]">Nội dung CK:</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <strong className="font-mono text-amber-800 font-bold text-xs bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                                            {qrNote}
                                                        </strong>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(qrNote);
                                                                setCopiedField('note');
                                                                setTimeout(() => setCopiedField(null), 2000);
                                                            }}
                                                            className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer flex items-center gap-1"
                                                            title="Sao chép nội dung chuyển khoản"
                                                        >
                                                            {copiedField === 'note' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                                            <span>{copiedField === 'note' ? 'Đã chép' : 'Sao chép'}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
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
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })()}
            </main>

            {/* Toast Thông báo sang trọng */}
            {toastNotice && (
                <div className="fixed top-24 right-4 sm:right-8 z-50 p-4 rounded-2xl shadow-2xl border flex items-center gap-3 text-xs sm:text-sm font-semibold animate-in fade-in slide-in-from-top-4 duration-300 max-w-md bg-white border-slate-200 text-slate-800 shadow-slate-900/10">
                    <AlertCircle className={`w-5 h-5 shrink-0 ${toastNotice.type === 'warning' ? 'text-amber-500' : toastNotice.type === 'error' ? 'text-rose-500' : 'text-emerald-500'}`} />
                    <span className="flex-1">{toastNotice.text}</span>
                    <button
                        type="button"
                        onClick={() => setToastNotice(null)}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer transition"
                    >
                        ✕
                    </button>
                </div>
            )}

            <Footer />
        </div>
    );
}
