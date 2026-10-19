import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { roomService } from '../../services/roomService';
import { bookingService } from '../../services/bookingService';
import { hotelService } from '../../services/hotelService';
import { authService } from '../../services/autheService';
import { useAuth } from '../../store/authStore';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import PaymentModal, { PaymentSection } from '../../components/common/PaymentModal';
import { useHotelSettings } from '../../store/hotelSettingStore';
import api from '../../services/api';

// Hàm tiện ích format ngày thành chuỗi YYYY-MM-DD
const formatDateToInput = (date) => {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
};

// Hàm tiện ích format ngày hiển thị tiếng Việt (VD: 05/10/2026)
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

export default function Checkout() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isAuthenticated } = useAuth();
    const { settings } = useHotelSettings();
    const starCount = settings?.stars || 3;

    // 1. Quản lý State Dữ liệu Phòng
    const [room, setRoom] = useState(null);
    const [loadingRoom, setLoadingRoom] = useState(true);
    const [roomError, setRoomError] = useState(null);

    // 2. State Ngày Check-in & Check-out
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    // Lấy ngày truyền từ trang trước (nếu có) hoặc mặc định
    const defaultCheckIn = location.state?.checkInDate || formatDateToInput(tomorrow);
    const defaultCheckOut = location.state?.checkOutDate || formatDateToInput(dayAfterTomorrow);

    const [checkInDate, setCheckInDate] = useState(defaultCheckIn);
    const [checkOutDate, setCheckOutDate] = useState(defaultCheckOut);
    const [nights, setNights] = useState(1);

    // 3. State Thông tin khách đặt phòng & Doanh nghiệp
    const [customerType, setCustomerType] = useState('MEMBER'); // 'MEMBER' | 'CORPORATE'
    const [companyName, setCompanyName] = useState('');
    const [companyTaxCode, setCompanyTaxCode] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [taxCodeError, setTaxCodeError] = useState('');
    const [isBookerTheGuest, setIsBookerTheGuest] = useState(true);
    const [actualGuests, setActualGuests] = useState([
        { full_name: '', id_type: 'CCCD', identity_card: '', phone_number: '', is_primary: true }
    ]);

    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [identityCard, setIdentityCard] = useState('');
    const [guestCount, setGuestCount] = useState(location.state?.guestCount || 2);
    const [note, setNote] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('reception'); // 'reception' | 'vietqr' | 'card'

    // Helper kiểm tra định dạng Mã số thuế Việt Nam (10 số doanh nghiệp hoặc 13 số chi nhánh)
    const validateTaxCode = (code) => {
        const clean = (code || '').trim();
        if (!clean) return 'Vui lòng nhập mã số thuế';
        const mstRegex = /^(\d{10}|\d{13}|\d{10}-\d{3})$/;
        if (!mstRegex.test(clean)) {
            return 'MST không hợp lệ. Chuẩn MST Việt Nam gồm 10 số (công ty mẹ) hoặc 13 số / 10-3 số (chi nhánh).';
        }
        return '';
    };

    // Chuyển đổi tab Khách cá nhân / Doanh nghiệp & tự động dọn sạch dữ liệu thừa
    const handleSwitchCustomerType = (type) => {
        if (type === 'CORPORATE' && !isAuthenticated) {
            setBookingError('Quý khách vui lòng đăng nhập tài khoản để đặt phòng theo diện Doanh nghiệp / Tổ chức.');
            return;
        }
        setCustomerType(type);
        setBookingError('');
        if (type === 'MEMBER') {
            // Tự động xóa/reset các trường company_* về rỗng để tránh gửi nhầm dữ liệu rác lên Backend
            setCompanyName('');
            setCompanyTaxCode('');
            setCompanyAddress('');
            setTaxCodeError('');
            setIsBookerTheGuest(true);
        }
    };

    // 4. State Mã khuyến mãi (Promo Code)
    const [promoInput, setPromoInput] = useState('');
    const [appliedPromo, setAppliedPromo] = useState(null); // { code, discount_amount, message }
    const [promoError, setPromoError] = useState('');
    const [isApplyingPromo, setIsApplyingPromo] = useState(false);

    // 5. State Dịch vụ tiện ích gợi ý đi kèm (Upselling Add-on Services)
    const [servicesList, setServicesList] = useState([]);
    const [loadingServices, setLoadingServices] = useState(false);
    const [selectedServices, setSelectedServices] = useState({}); // { [serviceId]: quantity }
    const [serviceFilter, setServiceFilter] = useState('all');
    const [isExpandedServices, setIsExpandedServices] = useState(false);

    // 6. State Gửi đơn & Xử lý thành công
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [bookingError, setBookingError] = useState('');
    const [createdBooking, setCreatedBooking] = useState(null);
    const [copiedCode, setCopiedCode] = useState(false);

    // 7. Quản lý kiểm tra tình trạng phòng trống (Chống Overbooking)
    const [availability, setAvailability] = useState(null);
    const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

    // Cấu hình Cài đặt hệ thống (giờ check-in/out, thuế VAT, phí dịch vụ)
    const [hotelSettings, setHotelSettings] = useState({
        check_in_time: '14:00',
        check_out_time: '12:00',
        vat_percent: 8,
        service_charge_percent: 5
    });

    useEffect(() => {
        let isMounted = true;
        api.get('/hotel-settings/')
            .then(res => {
                const data = res.data?.data || res.data;
                if (isMounted && data) {
                    setHotelSettings({
                        check_in_time: data.check_in_time || '14:00',
                        check_out_time: data.check_out_time || '12:00',
                        vat_percent: Number(data.vat_percent) || 8,
                        service_charge_percent: Number(data.service_charge_percent) || 5,
                        hotline: data.hotline || '1900 8899',
                        hotel_name: data.hotel_name || 'Khách Sạn TA Đà Nẵng'
                    });
                }
            })
            .catch(err => console.error('Lỗi tải cài đặt khách sạn:', err));
        return () => { isMounted = false; };
    }, []);

    // Tải danh sách Dịch vụ đang hoạt động từ Backend (API GET /api/services/)
    useEffect(() => {
        let isMounted = true;
        setLoadingServices(true);
        hotelService
            .getServices({ status: 'active' })
            .then((res) => {
                if (isMounted && res && res.success) {
                    const activeList = (res.items || []).filter((item) => item.is_active !== false);
                    setServicesList(activeList);
                }
            })
            .catch((err) => {
                console.error('Lỗi khi tải danh sách dịch vụ gợi ý:', err);
            })
            .finally(() => {
                if (isMounted) setLoadingServices(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    // Toggle chọn / bỏ chọn dịch vụ
    const handleToggleService = (svcId) => {
        setSelectedServices((prev) => {
            const next = { ...prev };
            if (next[svcId]) {
                delete next[svcId];
            } else {
                next[svcId] = 1;
            }
            return next;
        });
    };

    // Tăng / giảm số lượng dịch vụ
    const handleUpdateServiceQty = (svcId, delta) => {
        setSelectedServices((prev) => {
            const current = prev[svcId] || 0;
            const nextVal = current + delta;
            const next = { ...prev };
            if (nextVal <= 0) {
                delete next[svcId];
            } else {
                next[svcId] = Math.min(20, nextVal);
            }
            return next;
        });
    };

    // Xác định số CCCD/Hộ chiếu đã có sẵn trong hồ sơ người dùng hay chưa
    const savedProfileIdCard = (user?.guest_profile?.id_card_number || user?.id_card_number || user?.identity_card || '').trim();
    const hasProfileIdCard = Boolean(isAuthenticated && savedProfileIdCard);
    const isUsingProfileIdCard = Boolean(hasProfileIdCard && identityCard && identityCard.trim() === savedProfileIdCard);

    // Tự động điền thông tin nếu khách hàng đã đăng nhập
    useEffect(() => {
        if (isAuthenticated && user) {
            const fullName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || '';
            setGuestName((prev) => prev || fullName);
            if (user.phone_number) setGuestPhone((prev) => prev || user.phone_number);
            if (user.email) setGuestEmail((prev) => prev || user.email);

            // Tự động điền CCCD / Hộ chiếu từ hồ sơ nếu có, nếu chưa thì giữ trống
            const existingIdCard = user.guest_profile?.id_card_number || user.id_card_number || user.identity_card || '';
            if (existingIdCard) {
                setIdentityCard(existingIdCard);
            }
        }
    }, [isAuthenticated, user]);

    // Đồng bộ lại dữ liệu hồ sơ mới nhất từ máy chủ để luôn có CCCD mới nhất (nếu người dùng vừa đổi ở trang cá nhân)
    useEffect(() => {
        if (isAuthenticated) {
            authService.getProfile().then((res) => {
                if (res?.success && res?.user) {
                    const freshUser = res.user;
                    const freshIdCard = freshUser.guest_profile?.id_card_number || freshUser.id_card_number || freshUser.identity_card || '';
                    if (freshIdCard) {
                        setIdentityCard((prev) => prev || freshIdCard);
                    }
                }
            }).catch(() => { });
        }
    }, [isAuthenticated]);

    // Kiểm tra tình trạng phòng trống thời gian thực (Availability & Chống Overbooking)
    useEffect(() => {
        const catId = room?.id || id;
        if (!catId || !checkInDate || !checkOutDate) return;

        let isMounted = true;
        setIsCheckingAvailability(true);

        bookingService
            .checkAvailability({
                category_id: catId,
                check_in_date: checkInDate,
                check_out_date: checkOutDate
            })
            .then((res) => {
                if (isMounted && res && res.success) {
                    setAvailability(res);
                }
            })
            .catch((err) => {
                console.error('Lỗi khi kiểm tra phòng trống:', err);
            })
            .finally(() => {
                if (isMounted) setIsCheckingAvailability(false);
            });

        return () => {
            isMounted = false;
        };
    }, [room?.id, id, checkInDate, checkOutDate]);

    // Gọi API lấy thông tin chi tiết hạng phòng
    useEffect(() => {
        let isMounted = true;
        const fetchRoom = async () => {
            if (!id) {
                setRoomError('Không tìm thấy mã hạng phòng trên URL.');
                setLoadingRoom(false);
                return;
            }
            try {
                setLoadingRoom(true);
                setRoomError(null);
                const res = await roomService.getCategoryDetail(id);
                if (!isMounted) return;

                if (res && (res.success || res.category)) {
                    const data = res.category || res;
                    setRoom(data);
                } else {
                    setRoomError(res?.message || 'Không tìm thấy thông tin hạng phòng yêu cầu.');
                }
            } catch (err) {
                if (isMounted) {
                    setRoomError(err.message || 'Lỗi khi tải dữ liệu phòng.');
                }
            } finally {
                if (isMounted) setLoadingRoom(false);
            }
        };

        fetchRoom();
        return () => {
            isMounted = false;
        };
    }, [id]);

    // =========================================================================
    // LOGIC TỰ ĐỘNG TÍNH TOÁN SỐ ĐÊM LƯU TRÚ (Check-in & Check-out)
    // =========================================================================
    useEffect(() => {
        if (!checkInDate || !checkOutDate) {
            setNights(1);
            return;
        }

        const date1 = new Date(checkInDate);
        const date2 = new Date(checkOutDate);

        // Tính khoảng cách giữa 2 mốc thời gian
        const diffTime = date2.getTime() - date1.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
            setNights(diffDays);
        } else {
            // Nếu ngày check-out <= check-in, tự động điều chỉnh Check-out = Check-in + 1 ngày
            const adjustedDate = new Date(date1);
            adjustedDate.setDate(adjustedDate.getDate() + 1);
            setCheckOutDate(formatDateToInput(adjustedDate));
            setNights(1);
        }
    }, [checkInDate, checkOutDate]);

    // Xử lý khi người dùng đổi ngày Check-in
    const handleCheckInChange = (e) => {
        const newCheckIn = e.target.value;
        setCheckInDate(newCheckIn);

        // Đảm bảo Check-out luôn lớn hơn Check-in ít nhất 1 ngày
        if (newCheckIn >= checkOutDate) {
            const nextDay = new Date(newCheckIn);
            nextDay.setDate(nextDay.getDate() + 1);
            setCheckOutDate(formatDateToInput(nextDay));
        }
    };

    // =========================================================================
    // TÍNH TOÁN TIỀN PHÒNG, DỊCH VỤ ĐI KÈM & TỔNG THANH TOÁN
    // =========================================================================
    const pricePerNight = Number(room?.promo_price || room?.base_price || 0);
    const subtotal = pricePerNight * nights;

    // Chiết khấu theo Hạng thành viên (Loyalty & Membership Program)
    const userTier = isAuthenticated && user?.current_tier ? user.current_tier : null;
    const tierDiscountPercent = userTier ? Number(userTier.discount_percent || 0) : 0;
    const tierDiscountAmount = tierDiscountPercent > 0 ? Math.round((subtotal * tierDiscountPercent) / 100) : 0;

    // Tính số tiền giảm giá từ Promo Code (nếu có)
    const discountAmount = appliedPromo ? Number(appliedPromo.discount_amount || 0) : 0;
    const roomNetTotal = Math.max(0, subtotal - tierDiscountAmount - discountAmount);

    // Danh sách chi tiết các dịch vụ tiện ích đã chọn
    const selectedServicesArray = Object.entries(selectedServices)
        .map(([svcId, qty]) => {
            const svc = servicesList.find((s) => String(s.id) === String(svcId));
            if (!svc) return null;
            const unitPrice = Number(svc.price || 0);
            return {
                service_id: svc.id,
                name: svc.name,
                category_name: svc.category_name,
                category_icon: svc.category_icon,
                unit_price: unitPrice,
                quantity: qty,
                total_price: unitPrice * qty,
                image: svc.display_image || svc.image_url || ''
            };
        })
        .filter(Boolean);

    // Tổng tiền toàn bộ dịch vụ đã tick chọn
    const totalServicesAmount = selectedServicesArray.reduce((acc, item) => acc + item.total_price, 0);

    // Tổng thanh toán cuối cùng (Tiền phòng + Tiền dịch vụ - Giảm giá)
    const finalTotal = roomNetTotal + totalServicesAmount;

    // Quy tắc: 100.000 VNĐ thanh toán thành công = 1 điểm tích lũy
    const earnedPoints = Math.floor(finalTotal / 100000);

    // Danh sách các nhóm dịch vụ để lọc tabs
    const serviceCategories = ['all', ...Array.from(new Set(servicesList.map((s) => s.category_name).filter(Boolean)))];

    const filteredServices = useMemo(() => {
        const raw = serviceFilter === 'all'
            ? servicesList
            : servicesList.filter((s) => s.category_name === serviceFilter);
        // Đưa các dịch vụ khách đã chọn lên đầu danh sách để dễ theo dõi
        return [...raw].sort((a, b) => {
            const aSelected = Boolean(selectedServices[a.id]);
            const bSelected = Boolean(selectedServices[b.id]);
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
            return 0;
        });
    }, [servicesList, serviceFilter, selectedServices]);

    // Khi chọn 'Tất cả dịch vụ' và danh sách nhiều hơn 4 món, mặc định chỉ hiển thị 4 món đầu (trừ khi người dùng bấm 'Xem thêm')
    const INITIAL_SERVICES_LIMIT = 4;
    const shouldShowExpandButton = filteredServices.length > INITIAL_SERVICES_LIMIT;
    const displayedServices = isExpandedServices || !shouldShowExpandButton
        ? filteredServices
        : filteredServices.slice(0, INITIAL_SERVICES_LIMIT);

    // =========================================================================
    // LOGIC XỬ LÝ MÃ GIẢM GIÁ (PROMO CODE)
    // =========================================================================
    const handleApplyPromo = async () => {
        const code = promoInput.trim().toUpperCase();
        if (!code) {
            setPromoError('Vui lòng nhập mã giảm giá.');
            return;
        }

        setIsApplyingPromo(true);
        setPromoError('');

        try {
            // Gọi API kiểm tra mã giảm giá
            const res = await bookingService.validatePromoCode(code, subtotal);
            if (res && res.valid) {
                setAppliedPromo({
                    code: res.code || code,
                    discount_amount: res.discount_amount || (subtotal * 0.1),
                    message: res.message || `Đã áp dụng mã ${code} thành công!`
                });
                setPromoError('');
            } else {
                setPromoError(res?.message || `Mã khuyến mãi "${code}" không hợp lệ hoặc đã hết hạn.`);
            }
        } catch {
            // Fallback UI nếu server chưa cấu hình khuyến mãi trong DB
            if (['WELCOME10', 'VIP10', 'SUMMER2026', 'TADANANG'].includes(code)) {
                const disc = Math.round(subtotal * 0.1);
                setAppliedPromo({
                    code,
                    discount_amount: disc,
                    message: `Áp dụng thành công mã ${code}! Giảm 10% (-${disc.toLocaleString('vi-VN')} VND).`
                });
                setPromoError('');
            } else {
                setPromoError(`Mã giảm giá "${code}" không tồn tại hoặc đã hết lượt dùng.`);
            }
        } finally {
            setIsApplyingPromo(false);
        }
    };

    const handleRemovePromo = () => {
        setAppliedPromo(null);
        setPromoInput('');
        setPromoError('');
    };

    // =========================================================================
    // XỬ LÝ SUBMIT ĐẶT PHÒNG TỚI API POST /api/bookings/
    // =========================================================================
    const handleSubmit = async (e) => {
        e.preventDefault();
        setBookingError('');

        // Validate dữ liệu form
        if (!guestName.trim()) {
            setBookingError('Vui lòng nhập đầy đủ họ và tên người đặt phòng.');
            return;
        }

        const cleanIdCard = identityCard.trim().toUpperCase();
        if (!cleanIdCard) {
            setBookingError('Vui lòng nhập Số CCCD hoặc Hộ chiếu (thông tin bắt buộc theo quy định lưu trú).');
            return;
        }

        // Validate độ dài từ 9 đến 12 số hoặc ký tự hộ chiếu
        const idCardRegex = /^[0-9A-Za-z]{9,12}$/;
        if (cleanIdCard.length < 9 || cleanIdCard.length > 12 || !idCardRegex.test(cleanIdCard)) {
            setBookingError('Số CCCD / Hộ chiếu không hợp lệ. Vui lòng nhập từ 9 đến 12 ký tự (Ví dụ: 12 số CCCD gắn chip hoặc số hộ chiếu hợp lệ).');
            return;
        }

        if (!guestPhone.trim()) {
            setBookingError('Vui lòng nhập số điện thoại liên hệ nhận phòng.');
            return;
        }
        if (!guestEmail.trim()) {
            setBookingError('Vui lòng nhập email để nhận xác nhận đơn đặt phòng.');
            return;
        }

        // Validate dữ liệu Doanh nghiệp (CORPORATE)
        if (customerType === 'CORPORATE') {
            if (!isAuthenticated) {
                setBookingError('Quý khách vui lòng đăng nhập tài khoản để đặt phòng cho Doanh nghiệp.');
                return;
            }
            if (!companyName.trim()) {
                setBookingError('Vui lòng nhập đầy đủ tên công ty / doanh nghiệp.');
                return;
            }
            const cleanTax = companyTaxCode.trim();
            if (!cleanTax) {
                setBookingError('Vui lòng nhập mã số thuế doanh nghiệp.');
                return;
            }
            const taxErr = validateTaxCode(cleanTax);
            if (taxErr) {
                setBookingError(taxErr);
                return;
            }
            if (!companyAddress.trim()) {
                setBookingError('Vui lòng nhập địa chỉ trụ sở / xuất hóa đơn của công ty.');
                return;
            }
        }

        // Chuẩn bị danh sách khách lưu trú thực tế (BookingGuest)
        let guestsPayload = [];
        if (customerType !== 'CORPORATE' || isBookerTheGuest) {
            guestsPayload.push({
                full_name: guestName.trim(),
                id_type: 'CCCD',
                identity_card: cleanIdCard,
                phone_number: guestPhone.trim(),
                is_primary: true
            });
            if (customerType === 'CORPORATE') {
                actualGuests.forEach((g) => {
                    if (g.full_name && g.full_name.trim()) {
                        guestsPayload.push({
                            full_name: g.full_name.trim(),
                            id_type: g.id_type || 'CCCD',
                            identity_card: (g.identity_card || '').trim(),
                            phone_number: (g.phone_number || '').trim(),
                            is_primary: false
                        });
                    }
                });
            }
        } else {
            const validActualGuests = actualGuests.filter((g) => g.full_name && g.full_name.trim());
            if (validActualGuests.length === 0) {
                setBookingError('Vui lòng khai báo ít nhất 1 người lưu trú thực tế (nhân sự/khách nhận phòng).');
                return;
            }
            guestsPayload = validActualGuests.map((g, idx) => ({
                full_name: g.full_name.trim(),
                id_type: g.id_type || 'CCCD',
                identity_card: (g.identity_card || '').trim(),
                phone_number: (g.phone_number || '').trim(),
                is_primary: idx === 0
            }));
        }

        // Kiểm tra sức chứa tối đa của phòng
        const totalGuestsCount = guestsPayload.length;
        const roomCapacity = Number(room?.capacity || 2);
        if (totalGuestsCount > roomCapacity) {
            setBookingError(`Số người lưu trú (${totalGuestsCount} khách) vượt quá sức chứa tối đa của hạng phòng (${roomCapacity} người lớn). Vui lòng điều chỉnh hoặc đặt thêm phòng.`);
            return;
        }

        setIsSubmitting(true);

        // Chuẩn bị mảng dịch vụ đi kèm theo định dạng chuẩn của Backend
        const servicesPayload = selectedServicesArray.map((item) => ({
            service_id: item.service_id,
            quantity: item.quantity
        }));

        const payload = {
            room: room?.id || id,
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            guest_name: guestName.trim(),
            guest_phone: guestPhone.trim(),
            guest_email: guestEmail.trim(),
            identity_card: cleanIdCard,
            customer_type: customerType,
            company_name: customerType === 'CORPORATE' ? companyName.trim() : '',
            company_tax_code: customerType === 'CORPORATE' ? companyTaxCode.trim() : '',
            company_address: customerType === 'CORPORATE' ? companyAddress.trim() : '',
            guests: guestsPayload,
            promo_code: appliedPromo ? appliedPromo.code : '',
            discount_amount: appliedPromo ? discountAmount : 0,
            selected_services: servicesPayload,
            payment_method: paymentMethod,
            note: `${note ? note + ' | ' : ''}Khách: ${totalGuestsCount || guestCount} người. CCCD: ${cleanIdCard}.${customerType === 'CORPORATE' ? ` [Công ty: ${companyName.trim()} - MST: ${companyTaxCode.trim()}]` : ''} Thanh toán: ${paymentMethod}`
        };

        try {
            const res = await bookingService.createBooking(payload);

            if (res && (res.success || res.booking_code || res.booking)) {
                const bookingData = res.booking || res.data || res;
                const serverTotal = bookingData.total_amount ? Number(bookingData.total_amount) : (res.summary?.total_amount ? Number(res.summary.total_amount) : finalTotal);

                setCreatedBooking({
                    id: bookingData.id || res.id,
                    booking_code: res.booking_code || bookingData.booking_code || `BK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                    room_name: room?.name,
                    check_in_date: checkInDate,
                    check_out_date: checkOutDate,
                    nights,
                    guest_name: guestName,
                    guest_phone: guestPhone,
                    guest_email: guestEmail,
                    identity_card: cleanIdCard,
                    total_amount: serverTotal,
                    selected_services: res.selected_services || selectedServicesArray,
                    payment_method: paymentMethod
                });

                // Đồng bộ lại hồ sơ người dùng để cập nhật số CCCD mới lưu vào state
                if (isAuthenticated) {
                    authService.getProfile().catch(() => { });
                }

                // Phát tín hiệu thông báo thời gian thực tới tất cả tab (Admin Dashboard, Lịch sử đặt phòng)
                try {
                    localStorage.setItem('pms_last_booking_event', Date.now().toString());
                    window.dispatchEvent(new Event('pms_booking_created'));
                } catch {
                    // ignore storage errors
                }
            } else {
                setBookingError(res?.message || 'Có lỗi xảy ra khi tạo đơn đặt phòng. Vui lòng thử lại.');
                if (res?.suggested_categories) {
                    setAvailability((prev) => ({
                        ...(prev || {}),
                        is_sold_out: true,
                        suggested_categories: res.suggested_categories
                    }));
                }
            }
        } catch (err) {
            setBookingError(err.response?.data?.message || err.message || 'Lỗi khi gửi thông tin tới máy chủ.');
            if (err.response?.data?.suggested_categories) {
                setAvailability((prev) => ({
                    ...(prev || {}),
                    is_sold_out: true,
                    suggested_categories: err.response.data.suggested_categories
                }));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Ảnh đại diện phòng
    const primaryImage =
        room?.feature_image ||
        room?.images?.find((img) => img.is_feature)?.image_url ||
        room?.images?.[0]?.image_url ||
        room?.images?.[0]?.image ||
        'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80';

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white">
            <Navbar />

            {/* BREADCRUMB LIÊN KẾT */}
            <div className="bg-white border-b border-slate-100 py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center space-x-2 text-xs text-slate-500">
                        <Link to="/" className="hover:text-blue-600 transition">Trang chủ</Link>
                        <span>/</span>
                        <Link to="/rooms" className="hover:text-blue-600 transition">Phòng nghỉ</Link>
                        <span>/</span>
                        {room && (
                            <>
                                <Link to={`/rooms/${room.id}`} className="hover:text-blue-600 transition truncate max-w-[150px] sm:max-w-none">
                                    {room.name}
                                </Link>
                                <span>/</span>
                            </>
                        )}
                        <span className="text-slate-900 font-semibold">Xác nhận đặt phòng & Thanh toán</span>
                    </nav>
                </div>
            </div>

            {/* HEADER TIÊU ĐỀ */}
            <header className="bg-white py-6 border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                       
                        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                            Hoàn tất đơn đặt phòng nghỉ
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Giá ưu đãi được giữ trong <strong>15:00 phút</strong>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT: 2 CỘT CHUẨN TRAVELOKA / AGODA */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Lỗi không tìm thấy phòng */}
                {!loadingRoom && roomError && (
                    <div className="bg-white rounded-3xl border border-rose-200 p-10 text-center max-w-lg mx-auto shadow-sm my-10">
                        <div className="text-5xl mb-3">🏨</div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Không tìm thấy thông tin phòng</h3>
                        <p className="text-xs text-slate-500 mb-6">{roomError}</p>
                        <Link
                            to="/rooms"
                            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
                        >
                            ← Quay lại danh sách phòng
                        </Link>
                    </div>
                )}

                {/* Loading Skeleton */}
                {loadingRoom && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-pulse">
                        <div className="lg:col-span-8 space-y-6">
                            <div className="h-44 bg-white rounded-3xl border border-slate-200"></div>
                            <div className="h-60 bg-white rounded-3xl border border-slate-200"></div>
                            <div className="h-48 bg-white rounded-3xl border border-slate-200"></div>
                        </div>
                        <div className="lg:col-span-4">
                            <div className="h-96 bg-white rounded-3xl border border-slate-200"></div>
                        </div>
                    </div>
                )}

                {/* Form Đặt phòng & Tóm tắt đơn */}
                {!loadingRoom && room && (
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                        {/* ========================================================================= */}
                        {/* CỘT TRÁI: FORM NHẬP LIỆU (8 COLS) */}
                        {/* ========================================================================= */}
                        <div className="lg:col-span-8 space-y-6">
                            {/* THẺ 1: CHỌN NGÀY CHECK-IN & CHECK-OUT (DATE PICKER) */}
                            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
                                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold">
                                            📅
                                        </div>
                                        <div>
                                            <h2 className="font-serif font-bold text-lg text-slate-900">
                                                Thời gian lưu trú
                                            </h2>
                                            <p className="text-xs text-slate-500">
                                                Nhận phòng từ {hotelSettings.check_in_time || '14:00'} • Trả phòng trước {hotelSettings.check_out_time || '12:00'}
                                            </p>
                                        </div>
                                    </div>

                                    <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                                        {nights} đêm lưu trú
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Ngày Check-in */}
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            Ngày Nhận Phòng (Check-in) <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                min={formatDateToInput(today)}
                                                value={checkInDate}
                                                onChange={handleCheckInChange}
                                                required
                                                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                            />
                                        </div>
                                        <span className="text-[11px] text-slate-400 block">
                                            Lịch đón khách từ: {hotelSettings.check_in_time || '14:00'} ({formatDateDisplay(checkInDate)})
                                        </span>
                                    </div>

                                    {/* Ngày Check-out */}
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            Ngày Trả Phòng (Check-out) <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                min={checkInDate}
                                                value={checkOutDate}
                                                onChange={(e) => setCheckOutDate(e.target.value)}
                                                required
                                                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                            />
                                        </div>
                                        <span className="text-[11px] text-slate-400 block">
                                            Trả phòng trước: {hotelSettings.check_out_time || '12:00'} ({formatDateDisplay(checkOutDate)})
                                        </span>
                                    </div>
                                </div>

                                {/* Thông báo tình trạng phòng thời gian thực (Availability & Hết phòng) */}
                                {isCheckingAvailability ? (
                                    <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2 text-xs text-slate-500">
                                        <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        <span>Đang kiểm tra số lượng phòng trống thời gian thực...</span>
                                    </div>
                                ) : availability?.is_sold_out ? (
                                    <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
                                        <div className="flex items-center gap-2 text-rose-800 font-bold text-xs sm:text-sm">
                                            <span className="text-base">⚠️</span>
                                            <span>Hạng phòng này đã KÍN CHỖ trong khoảng thời gian đã chọn!</span>
                                        </div>
                                        <p className="text-xs text-rose-700 leading-relaxed">
                                            Rất tiếc, tất cả các phòng thuộc hạng <strong>{room.name}</strong> đã được đặt kín từ <strong>{formatDateDisplay(checkInDate)}</strong> đến <strong>{formatDateDisplay(checkOutDate)}</strong>. Quý khách vui lòng đổi ngày lưu trú hoặc tham khảo các hạng phòng tương đương còn trống dưới đây:
                                        </p>

                                        {/* Danh sách các hạng phòng khác còn trống gợi ý */}
                                        {availability.suggested_categories?.length > 0 && (
                                            <div className="pt-2 border-t border-rose-200/80 space-y-2">
                                                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider block">
                                                    ✨ Các hạng phòng khác còn trống cho kỳ nghỉ của bạn:
                                                </span>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {availability.suggested_categories.map((cat) => (
                                                        <Link
                                                            key={cat.id}
                                                            to={`/checkout/${cat.id}`}
                                                            state={{ checkInDate, checkOutDate, guestCount }}
                                                            className="p-3 bg-white hover:bg-blue-50/50 rounded-xl border border-slate-200 hover:border-blue-400 transition flex items-center justify-between group cursor-pointer shadow-xs"
                                                        >
                                                            <div>
                                                                <strong className="text-xs font-bold text-slate-900 block group-hover:text-blue-600">
                                                                    {cat.name}
                                                                </strong>
                                                                <span className="text-[10px] text-emerald-700 font-medium block">
                                                                    🟢 Còn {cat.available_rooms} phòng trống • {Number(cat.promo_price || cat.base_price).toLocaleString('vi-VN')} VND
                                                                </span>
                                                            </div>
                                                            <span className="text-blue-600 font-bold text-xs group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
                                                                Đặt ngay →
                                                            </span>
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : availability?.available_rooms > 0 ? (
                                    <div className="mt-4 p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                                            <span>✓</span>
                                            <span>
                                                Phòng còn trống ({availability.available_rooms} phòng sẵn sàng đón khách)
                                            </span>
                                        </div>
                                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/60 px-2.5 py-0.5 rounded-full border border-emerald-300">
                                            🟢 Khả dụng
                                        </span>
                                    </div>
                                ) : null}
                            </div>

                            {/* THẺ 2: THÔNG TIN KHÁCH ĐẶT PHÒNG */}
                            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
                                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg font-bold">
                                            👤
                                        </div>
                                        <div>
                                            <h2 className="font-serif font-bold text-lg text-slate-900">
                                                Thông tin người liên hệ & nhận phòng
                                            </h2>
                                            <p className="text-xs text-slate-500">
                                                Thông tin cần thiết để lễ tân khách sạn làm thủ tục check-in
                                            </p>
                                        </div>
                                    </div>

                                    {isAuthenticated ? (
                                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1">
                                            ✓ Đã điền từ tài khoản
                                        </span>
                                    ) : (
                                        <Link
                                            to="/login"
                                            className="text-xs font-bold text-blue-600 hover:underline"
                                        >
                                            Đăng nhập để tích điểm →
                                        </Link>
                                    )}
                                </div>

                                {/* TAB CHỌN LOẠI ĐẶT PHÒNG: CÁ NHÂN / GIA ĐÌNH vs CÔNG TY / ĐI CÔNG TÁC (XUẤT HÓA ĐƠN VAT) */}
                                <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl mb-6">
                                    <button
                                        type="button"
                                        onClick={() => handleSwitchCustomerType('MEMBER')}
                                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                                            customerType === 'MEMBER'
                                                ? 'bg-white text-slate-900 shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <span>👤</span>
                                        <span>Đặt Cá nhân / Gia đình</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSwitchCustomerType('CORPORATE')}
                                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                                            customerType === 'CORPORATE'
                                                ? 'bg-blue-600 text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <span>🏢</span>
                                        <span>Công ty / Đi công tác (Cần VAT)</span>
                                    </button>
                                </div>

                                {/* KHỐI THÔNG TIN DOANH NGHIỆP & XUẤT HÓA ĐƠN VAT */}
                                {customerType === 'CORPORATE' && (
                                    <div className="mb-6 p-4 sm:p-5 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-4 animate-in fade-in">
                                        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-base shadow-2xs">
                                                    🏢
                                                </div>
                                                <div>
                                                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                                                        Thông tin Pháp nhân Doanh nghiệp (Xuất hóa đơn VAT)
                                                    </h3>
                                                    <p className="text-[11px] text-slate-500">
                                                        Dành cho khách đi công tác cần hóa đơn điện tử GTGT hợp lệ để quyết toán với công ty
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="px-2.5 py-1 rounded-lg bg-white text-slate-700 text-[10px] font-extrabold uppercase tracking-wider border border-slate-200 shadow-2xs">
                                                VAT Invoice
                                            </span>
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                                    Tên công ty / Doanh nghiệp <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="Ví dụ: Công ty Cổ phần Công nghệ và Truyền thông TA"
                                                    value={companyName}
                                                    onChange={(e) => setCompanyName(e.target.value)}
                                                    required
                                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-[11px] sm:placeholder:text-xs placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                                                            Mã số thuế (MST) <span className="text-rose-500">*</span>
                                                        </label>
                                                        <span className="text-[10px] text-slate-400">10 số hoặc 13 số</span>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Ví dụ: 0101234567 hoặc 0101234567-001"
                                                        value={companyTaxCode}
                                                        onChange={(e) => {
                                                            const val = e.target.value.trim();
                                                            setCompanyTaxCode(val);
                                                            if (val) {
                                                                const err = validateTaxCode(val);
                                                                setTaxCodeError(err);
                                                            } else {
                                                                setTaxCodeError('');
                                                            }
                                                        }}
                                                        required
                                                        className={`w-full px-4 py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-mono text-slate-900 placeholder:font-sans placeholder:text-[11px] sm:placeholder:text-xs placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-600/30 transition ${
                                                            taxCodeError ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200 focus:border-blue-600'
                                                        }`}
                                                    />
                                                    {taxCodeError && (
                                                        <p className="text-[11px] text-rose-600 mt-1 font-medium flex items-center gap-1">
                                                            <span>⚠️</span> {taxCodeError}
                                                        </p>
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                                        Địa chỉ trụ sở công ty <span className="text-rose-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="Địa chỉ đăng ký kinh doanh..."
                                                        value={companyAddress}
                                                        onChange={(e) => setCompanyAddress(e.target.value)}
                                                        required
                                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-[11px] sm:placeholder:text-xs placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                                    />
                                                </div>
                                            </div>

                                            <div className="pt-2.5 border-t border-slate-200/80 text-[11px] text-slate-600 flex items-center justify-between flex-wrap gap-2">
                                                <span>💡 Quý khách cần đặt từ 3 phòng trở lên cho cả đoàn du lịch / công ty?</span>
                                                <Link
                                                    to="/corporate-booking"
                                                    className="font-bold text-blue-600 hover:text-blue-800 underline flex items-center gap-1 transition"
                                                >
                                                    <span>Xem trang Đặt phòng theo đoàn (B2B)</span>
                                                    <span>→</span>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {/* Họ và tên */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Họ và tên khách hàng <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ví dụ: Nguyễn Văn A (theo CCCD/Hộ chiếu)"
                                            value={guestName}
                                            onChange={(e) => setGuestName(e.target.value)}
                                            required
                                            className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-[11px] sm:placeholder:text-xs placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                        />
                                    </div>

                                    {/* Số CCCD / Hộ chiếu */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Số CCCD / Hộ chiếu (Passport) <span className="text-rose-500">*</span>
                                        </label>

                                        <div className="relative">
                                            <input
                                                type="text"
                                                maxLength={15}
                                                placeholder="Nhập số CCCD (12 số) hoặc số Hộ chiếu"
                                                value={identityCard}
                                                onChange={(e) => {
                                                    setIdentityCard(e.target.value.toUpperCase());
                                                    if (bookingError) setBookingError('');
                                                }}
                                                required
                                                className="w-full pl-11 pr-4 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-mono font-medium text-slate-900 placeholder:font-sans placeholder:text-[11px] sm:placeholder:text-xs placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                            />
                                            <span className="absolute left-3.5 top-3 text-slate-400 text-base">
                                                🪪
                                            </span>
                                        </div>

                                        {/* Ghi chú hướng dẫn */}
                                        <div className="mt-1.5 text-[11px]">
                                            {isAuthenticated && !hasProfileIdCard ? (
                                                <p className="text-amber-600 flex items-center gap-1 font-medium">
                                                    <span>💡</span> Số CCCD bạn nhập sẽ được tự động lưu vào hồ sơ cá nhân cho các lần sau.
                                                </p>
                                            ) : (
                                                <p className="text-slate-400">
                                                    Thông tin bắt buộc để làm thủ tục nhận phòng. Bạn có thể chỉnh sửa nếu đặt hộ người khác.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Số điện thoại */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                                Số điện thoại liên hệ <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="tel"
                                                placeholder="Ví dụ: 0901 234 567"
                                                value={guestPhone}
                                                onChange={(e) => setGuestPhone(e.target.value)}
                                                required
                                                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-[11px] sm:placeholder:text-xs placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                            />
                                        </div>

                                        {/* Email */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                                Địa chỉ Email nhận mã xác nhận <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                placeholder="Ví dụ: email@domain.com"
                                                value={guestEmail}
                                                onChange={(e) => setGuestEmail(e.target.value)}
                                                required
                                                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-[11px] sm:placeholder:text-xs placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                            />
                                        </div>
                                    </div>

                                    {/* Số lượng khách */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                            Số lượng khách lưu trú
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center space-x-3 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                                                <button
                                                    type="button"
                                                    onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                                                    className="w-8 h-8 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 transition"
                                                >
                                                    -
                                                </button>
                                                <span className="text-xs font-bold text-slate-900 px-2">
                                                    {guestCount} Người lớn
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setGuestCount(Math.min(room.capacity || 4, guestCount + 1))}
                                                    className="w-8 h-8 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 transition"
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <span className="text-xs text-slate-400">
                                                Sức chứa tối đa: {room?.capacity || 2} người lớn
                                            </span>
                                        </div>
                                    </div>

                                    {/* PHÂN ĐỊNH: NGƯỜI ĐẶT ĐẠI DIỆN vs NGƯỜI LƯU TRÚ THỰC TẾ (CHỈ ÁP DỤNG KHI ĐẶT CHO CÔNG TY / ĐI CÔNG TÁC) */}
                                    {customerType === 'CORPORATE' && (
                                        <div className="pt-2">
                                            <label className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100/70 cursor-pointer transition">
                                                <input
                                                    type="checkbox"
                                                    checked={isBookerTheGuest}
                                                    onChange={(e) => setIsBookerTheGuest(e.target.checked)}
                                                    className="w-4 h-4 rounded text-blue-600 mt-0.5 cursor-pointer accent-blue-600"
                                                />
                                                <div className="text-xs">
                                                    <span className="font-bold text-slate-900 block">
                                                        Tôi đồng thời là người nhận phòng & lưu trú thực tế
                                                    </span>
                                                    <span className="text-slate-500 text-[11px] block mt-0.5 leading-relaxed">
                                                        Bỏ chọn nếu bạn là <strong>Nhân sự (HR) / Thư ký / Đại diện công ty</strong> đặt phòng cho cấp trên hoặc đồng nghiệp đi công tác (người đặt không trực tiếp đến ở).
                                                    </span>
                                                </div>
                                            </label>
                                        </div>
                                    )}

                                    {/* KHAI BÁO DANH SÁCH NHÂN SỰ / KHÁCH LƯU TRÚ THỰC TẾ (CHỈ ÁP DỤNG KHI ĐẶT CHO CÔNG TY) */}
                                    {customerType === 'CORPORATE' && (() => {
                                        const roomCap = Number(room?.capacity || 2);
                                        const currentTotalGuests = (isBookerTheGuest ? 1 : 0) + actualGuests.length;
                                        const isMaxCapacityReached = currentTotalGuests >= roomCap;

                                        return (
                                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-base">📋</span>
                                                        <div>
                                                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                                                Danh sách người lưu trú ({isBookerTheGuest ? 1 + actualGuests.filter(g => g.full_name?.trim()).length : actualGuests.filter(g => g.full_name?.trim()).length} / {roomCap} khách tối đa)
                                                            </h4>
                                                            <p className="text-[10px] text-slate-500">
                                                                Khai báo trước thông tin để Lễ tân đối chiếu và làm thủ tục check-in nhanh chóng
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        disabled={isMaxCapacityReached}
                                                        onClick={() => {
                                                            if (isMaxCapacityReached) return;
                                                            setActualGuests(prev => [...prev, { full_name: '', id_type: 'CCCD', identity_card: '', phone_number: '', is_primary: false }]);
                                                        }}
                                                        className={`px-3 py-1.5 font-bold text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                                                            isMaxCapacityReached
                                                                ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-70'
                                                                : 'bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 shadow-2xs'
                                                        }`}
                                                        title={isMaxCapacityReached ? `Phòng này chỉ ở tối đa ${roomCap} người lớn` : 'Thêm người ở cùng phòng'}
                                                    >
                                                        <span>➕ Thêm người ở</span>
                                                        <span className="text-[10px] opacity-75">({currentTotalGuests}/{roomCap})</span>
                                                    </button>
                                                </div>

                                                {/* THÔNG BÁO GIỚI HẠN SỨC CHỨA THEO QUY ĐỊNH PHÒNG */}
                                                {isMaxCapacityReached && (
                                                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs flex items-center gap-2 animate-in fade-in">
                                                        <span className="text-sm shrink-0">ℹ️</span>
                                                        <span className="leading-tight text-[11px]">
                                                            Đã đạt sức chứa tối đa của hạng phòng (<strong>{roomCap} người lớn</strong>). Nếu có thêm người hoặc đoàn đông, quý khách vui lòng đặt thêm phòng hoặc liên hệ lễ tân.
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="space-y-2.5">
                                                    {actualGuests.map((guest, idx) => (
                                                        <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 shadow-2xs">
                                                            <div className="flex items-center justify-between text-xs">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-bold text-slate-800">
                                                                        #{idx + 1}. Khách lưu trú {idx === 0 && !isBookerTheGuest ? '(Người đại diện nhận phòng)' : ''}
                                                                    </span>
                                                                    {idx === 0 && !isBookerTheGuest && (
                                                                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-bold">
                                                                            Nhận phòng chính
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {actualGuests.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setActualGuests(prev => prev.filter((_, i) => i !== idx))}
                                                                        className="text-rose-500 hover:text-rose-700 text-[11px] font-bold cursor-pointer"
                                                                    >
                                                                         Xóa
                                                                    </button>
                                                                )}
                                                            </div>

                                                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                                                {/* Họ và tên */}
                                                                <div className="sm:col-span-4">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Họ và tên khách/nhân sự *"
                                                                        value={guest.full_name}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            setActualGuests(prev => prev.map((g, i) => i === idx ? { ...g, full_name: val } : g));
                                                                        }}
                                                                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                    />
                                                                </div>

                                                                {/* Loại giấy tờ: CCCD hoặc Hộ chiếu */}
                                                                <div className="sm:col-span-2">
                                                                    <select
                                                                        value={guest.id_type || 'CCCD'}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            setActualGuests(prev => prev.map((g, i) => i === idx ? { ...g, id_type: val } : g));
                                                                        }}
                                                                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                                                    >
                                                                        <option value="CCCD">CCCD</option>
                                                                        <option value="PASSPORT">Hộ chiếu</option>
                                                                    </select>
                                                                </div>

                                                                {/* Số giấy tờ */}
                                                                <div className="sm:col-span-3">
                                                                    <input
                                                                        type="text"
                                                                        placeholder={guest.id_type === 'PASSPORT' ? 'Số Hộ chiếu...' : 'Số CCCD...'}
                                                                        value={guest.identity_card}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            setActualGuests(prev => prev.map((g, i) => i === idx ? { ...g, identity_card: val.toUpperCase() } : g));
                                                                        }}
                                                                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                    />
                                                                </div>

                                                                {/* Số ĐT */}
                                                                <div className="sm:col-span-3">
                                                                    <input
                                                                        type="tel"
                                                                        placeholder="Số ĐT nhận phòng"
                                                                        value={guest.phone_number}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            setActualGuests(prev => prev.map((g, i) => i === idx ? { ...g, phone_number: val } : g));
                                                                        }}
                                                                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* THẺ: NÂNG TẦM KỲ NGHỈ - DỊCH VỤ GỢI Ý ĐI KÈM (UPSELLING ADD-ON SERVICES) */}
                            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center text-lg shadow-md shadow-orange-500/20 shrink-0">
                                            ✨
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h2 className="font-serif font-bold text-lg sm:text-xl text-slate-900 tracking-tight truncate">
                                                    Nâng tầm kỳ nghỉ - Dịch vụ gợi ý đi kèm
                                                </h2>
                                                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider shrink-0">
                                                    Gợi ý HOT
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-none">
                                                Đặt kèm tiện ích cao cấp ngay hôm nay để thanh toán gộp 1 lần qua VietQR và được khách sạn phục vụ chu đáo nhất
                                            </p>
                                        </div>
                                    </div>

                                    {selectedServicesArray.length > 0 && (
                                        <div className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50/80 border border-amber-200 text-xs font-bold shadow-xs whitespace-nowrap self-start sm:self-center">
                                            <span className="text-amber-900 flex items-center gap-1">
                                                <span>🧺</span> Đã chọn:
                                            </span>
                                            <span className="px-2 py-0.5 rounded-lg bg-orange-100/90 text-orange-700 font-extrabold text-xs">
                                                {selectedServicesArray.length} dịch vụ
                                            </span>
                                            <span className="text-amber-300">•</span>
                                            <span className="text-emerald-700 font-black tracking-tight">
                                                +{totalServicesAmount.toLocaleString('vi-VN')} ₫
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* BỘ LỌC DANH MỤC NHANH (TABS) */}
                                {serviceCategories.length > 2 && (
                                    <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none text-xs">
                                        {serviceCategories.map((catName) => {
                                            const isActive = serviceFilter === catName;
                                            return (
                                                <button
                                                    key={catName}
                                                    type="button"
                                                    onClick={() => {
                                                        setServiceFilter(catName);
                                                        setIsExpandedServices(false);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${isActive
                                                        ? 'bg-slate-900 text-white shadow-sm'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                        }`}
                                                >
                                                    {catName === 'all' ? 'Tất cả dịch vụ' : catName}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* DANH SÁCH CÁC DỊCH VỤ CARD */}
                                {loadingServices ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {[1, 2, 3, 4].map((i) => (
                                            <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse"></div>
                                        ))}
                                    </div>
                                ) : filteredServices.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        Chưa có dịch vụ nào trong danh mục này.
                                    </div>
                                ) : (
                                    <div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {displayedServices.map((svc) => {
                                                const isSelected = Boolean(selectedServices[svc.id]);
                                                const currentQty = selectedServices[svc.id] || 1;
                                                const svcImg = svc.display_image || svc.image_url || 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=400&q=80';
                                                const priceNum = Number(svc.price || 0);

                                                return (
                                                    <div
                                                        key={svc.id}
                                                        className={`group relative rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between ${isSelected
                                                            ? 'border-amber-400 bg-gradient-to-br from-amber-50/40 via-white to-orange-50/30 shadow-md shadow-amber-500/10 ring-1 ring-amber-400'
                                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                                                            }`}
                                                    >
                                                        <div className="flex gap-3.5 items-start">
                                                            {/* Checkbox chọn dịch vụ */}
                                                            <div className="pt-0.5">
                                                                <input
                                                                    type="checkbox"
                                                                    id={`svc-check-${svc.id}`}
                                                                    checked={isSelected}
                                                                    onChange={() => handleToggleService(svc.id)}
                                                                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-slate-300 cursor-pointer"
                                                                />
                                                            </div>

                                                            {/* Ảnh đại diện dịch vụ */}
                                                            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden shrink-0 relative border border-slate-100 bg-slate-50">
                                                                <img
                                                                    src={svcImg}
                                                                    alt={svc.name}
                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                    onError={(e) => {
                                                                        e.target.src = 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=400&q=80';
                                                                    }}
                                                                />
                                                            </div>

                                                            {/* Thông tin dịch vụ */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    {svc.category_name && (
                                                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                                                            {svc.category_icon ? `${svc.category_icon} ` : ''}{svc.category_name}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <h4
                                                                    onClick={() => handleToggleService(svc.id)}
                                                                    className="font-bold text-xs sm:text-sm text-slate-900 mt-1 cursor-pointer hover:text-orange-600 transition truncate"
                                                                    title={svc.name}
                                                                >
                                                                    {svc.name}
                                                                </h4>

                                                                {svc.description && (
                                                                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                                                        {svc.description}
                                                                    </p>
                                                                )}

                                                                <div className="mt-1.5 font-bold text-xs text-orange-600">
                                                                    {priceNum.toLocaleString('vi-VN')} <span className="text-[10px] font-semibold text-slate-500">VNĐ</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Khu vực Tùy chỉnh số lượng khi đã chọn */}
                                                        {isSelected && (
                                                            <div className="mt-3 pt-3 border-t border-amber-200/60 flex items-center justify-between text-xs animate-in fade-in duration-200">
                                                                <span className="text-[11px] font-semibold text-slate-600">
                                                                    Số lượng sử dụng:
                                                                </span>

                                                                <div className="flex items-center gap-2">
                                                                    <div className="inline-flex items-center bg-white border border-amber-300 rounded-xl shadow-xs overflow-hidden">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleUpdateServiceQty(svc.id, -1)}
                                                                            className="w-7 h-7 flex items-center justify-center font-bold text-slate-600 hover:bg-amber-100 active:bg-amber-200 transition"
                                                                            title="Giảm số lượng"
                                                                        >
                                                                            -
                                                                        </button>
                                                                        <span className="w-8 text-center font-bold text-slate-900 text-xs">
                                                                            {currentQty}
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleUpdateServiceQty(svc.id, 1)}
                                                                            className="w-7 h-7 flex items-center justify-center font-bold text-slate-600 hover:bg-amber-100 active:bg-amber-200 transition"
                                                                            title="Tăng số lượng"
                                                                        >
                                                                            +
                                                                        </button>
                                                                    </div>

                                                                    <span className="text-[11px] font-extrabold text-slate-900 ml-1">
                                                                        = {(priceNum * currentQty).toLocaleString('vi-VN')} ₫
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Nút Xem thêm / Thu gọn khi danh sách nhiều dịch vụ */}
                                        {shouldShowExpandButton && (
                                            <div className="mt-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsExpandedServices(!isExpandedServices)}
                                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-100 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 text-slate-700 text-xs font-bold transition-all border border-slate-200 shadow-2xs cursor-pointer active:scale-95"
                                                >
                                                    {isExpandedServices ? (
                                                        <>
                                                            <span>Thu gọn danh sách dịch vụ</span>
                                                            <span className="text-sm font-black leading-none">↑</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>Xem thêm {filteredServices.length - INITIAL_SERVICES_LIMIT} dịch vụ tiện ích khác</span>
                                                            <span className="text-sm font-black leading-none">↓</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Footer tóm tắt dịch vụ tiện ích */}
                                {selectedServicesArray.length > 0 && (
                                    <div className="mt-4 p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-2 text-amber-900 font-medium">
                                            <span>✓</span>
                                            <span>
                                                Đã thêm <strong>{selectedServicesArray.length} tiện ích</strong> vào đơn đặt phòng. Tiền dịch vụ sẽ được cộng gộp vào mã QR thanh toán.
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedServices({})}
                                            className="text-[11px] font-bold text-rose-600 hover:underline self-end sm:self-auto"
                                        >
                                            Xóa toàn bộ dịch vụ đã chọn
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* THẺ 3: MÃ GIẢM GIÁ (PROMO CODE) */}
                            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
                                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                                    <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg font-bold">
                                        🏷️
                                    </div>
                                    <div>
                                        <h2 className="font-serif font-bold text-lg text-slate-900">
                                            Mã giảm giá & Khuyến mãi (Promo Code)
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            Nhập mã ưu đãi độc quyền để nhận chiết khấu trực tiếp vào tổng tiền
                                        </p>
                                    </div>
                                </div>

                                {!appliedPromo ? (
                                    <div>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    placeholder="Nhập mã (VD: WELCOME10, TADANANG)"
                                                    value={promoInput}
                                                    onChange={(e) => {
                                                        setPromoInput(e.target.value.toUpperCase());
                                                        setPromoError('');
                                                    }}
                                                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-900 placeholder:text-[11px] sm:placeholder:text-xs placeholder:text-slate-400 placeholder:font-normal placeholder:capitalize focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleApplyPromo}
                                                disabled={isApplyingPromo || !promoInput.trim()}
                                                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 text-white rounded-2xl text-xs font-bold shadow-md shadow-purple-600/20 transition transform active:scale-95 flex items-center gap-2 whitespace-nowrap cursor-pointer"
                                            >
                                                {isApplyingPromo ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <span>Áp dụng</span>
                                                )}
                                            </button>
                                        </div>

                                        {/* Gợi ý mã có sẵn */}
                                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                                            <span className="text-[11px] text-slate-400">Mã gợi ý:</span>
                                            {['WELCOME10', 'TADANANG', 'VIP2026'].map((code) => (
                                                <button
                                                    key={code}
                                                    type="button"
                                                    onClick={() => setPromoInput(code)}
                                                    className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold border border-purple-100 transition"
                                                >
                                                    {code} (-10%)
                                                </button>
                                            ))}
                                        </div>

                                        {promoError && (
                                            <p className="text-xs text-rose-600 font-medium mt-2 flex items-center gap-1">
                                                ⚠️ {promoError}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                                                ✓
                                            </span>
                                            <div>
                                                <strong className="text-xs font-bold text-emerald-900 block">
                                                    Đã áp dụng mã: {appliedPromo.code}
                                                </strong>
                                                <span className="text-xs text-emerald-700">
                                                    Đã giảm: -{discountAmount.toLocaleString('vi-VN')} VND vào tổng đơn
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRemovePromo}
                                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 text-xs font-bold border border-rose-100 transition"
                                        >
                                            Hủy bỏ
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* THẺ 4: YÊU CẦU ĐẶC BIỆT & GHI CHÚ */}
                            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
                                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg font-bold">
                                        📝
                                    </div>
                                    <div>
                                        <h2 className="font-serif font-bold text-lg text-slate-900">
                                            Yêu cầu đặc biệt & Ghi chú
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            Khách sạn sẽ cố gắng đáp ứng tùy theo tình trạng phòng thực tế
                                        </p>
                                    </div>
                                </div>

                                <textarea
                                    rows="3"
                                    placeholder="Ví dụ: Cần phòng tầng cao, view thoáng, hỗ trợ nhận phòng sớm lúc 13:00, chuẩn bị bánh kỉ niệm..."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-[11px] sm:placeholder:text-xs placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition"
                                />

                                {/* Chips chọn nhanh */}
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {[
                                        'Phòng tầng cao',
                                        'Phòng không hút thuốc',
                                        'Nhận phòng sớm',
                                        'Bánh kỉ niệm ngày cưới',
                                        'Xe đưa đón sân bay'
                                    ].map((tag) => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => {
                                                if (!note.includes(tag)) {
                                                    setNote(note ? `${note}, ${tag}` : tag);
                                                }
                                            }}
                                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 text-[11px] font-medium transition"
                                        >
                                            + {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* THẺ 5: PHƯƠNG THỨC THANH TOÁN */}
                            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
                                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
                                        💳
                                    </div>
                                    <div>
                                        <h2 className="font-serif font-bold text-lg text-slate-900">
                                            Phương thức thanh toán
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            Quý khách có thể thanh toán trực tiếp hoặc qua chuyển khoản ngân hàng
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {/* Cách 1: Thanh toán tại khách sạn */}
                                    <label
                                        onClick={() => setPaymentMethod('reception')}
                                        className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition ${paymentMethod === 'reception'
                                                ? 'border-blue-600 bg-blue-50/40'
                                                : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="payment"
                                            checked={paymentMethod === 'reception'}
                                            onChange={() => setPaymentMethod('reception')}
                                            className="mt-1 text-blue-600"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <strong className="text-xs sm:text-sm font-bold text-slate-900 block">
                                                    Thanh toán trực tiếp tại quầy Lễ tân (Khi nhận phòng)
                                                </strong>
                                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">
                                                    Khuyên dùng
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                                Chấp nhận tiền mặt, thẻ ghi nợ ATM, thẻ tín dụng nội địa & quốc tế khi quý khách làm thủ tục Check-in.
                                            </p>
                                        </div>
                                    </label>

                                    {/* Cách 2: Chuyển khoản QR */}
                                    <label
                                        onClick={() => setPaymentMethod('vietqr')}
                                        className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition ${paymentMethod === 'vietqr'
                                                ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20'
                                                : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="payment"
                                            checked={paymentMethod === 'vietqr'}
                                            onChange={() => setPaymentMethod('vietqr')}
                                            className="mt-1 text-blue-600"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <strong className="text-xs sm:text-sm font-bold text-slate-900 block">
                                                    Chuyển khoản VietQR tức thì (Tự động xác nhận)
                                                </strong>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                                    Miễn phí 24/7
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                                Mã QR thanh toán VietQR chính thức sẽ hiển thị ngay sau khi quý khách bấm nút <strong>"Xác nhận đặt phòng"</strong> bên dưới.
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* ========================================================================= */}
                        {/* CỘT PHẢI: TÓM TẮT ĐƠN HÀNG (ORDER SUMMARY - 4 COLS STICKY) */}
                        {/* ========================================================================= */}
                        <div className="lg:col-span-4 h-full">
                            <div className="lg:sticky lg:top-24 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-900/5 p-5 sm:p-6 space-y-4 sm:space-y-5 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
                                {/* Thẻ phòng thu nhỏ */}
                                <div>
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                                        Chi tiết phòng đã chọn
                                    </span>
                                    <div className="flex gap-4">
                                        <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 relative">
                                            <img
                                                src={primaryImage}
                                                alt={room.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold uppercase block w-fit mb-1">
                                                {starCount}-STAR SUITE
                                            </span>
                                            <h3 className="font-serif font-bold text-base text-slate-900 leading-snug line-clamp-2">
                                                {room.name}
                                            </h3>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5">
                                                <span>📐 {room.size || 40} m²</span>
                                                <span>•</span>
                                                <span>👥 {room.capacity || 2} khách</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Thông tin Lịch lưu trú tóm tắt */}
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span>Nhận phòng:</span>
                                        <strong className="text-slate-900">
                                            {formatDateDisplay(checkInDate)} ({hotelSettings.check_in_time || '14:00'})
                                        </strong>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-600">
                                        <span>Trả phòng:</span>
                                        <strong className="text-slate-900">
                                            {formatDateDisplay(checkOutDate)} ({hotelSettings.check_out_time || '12:00'})
                                        </strong>
                                    </div>
                                    <div className="flex justify-between items-center text-blue-600 font-semibold pt-1 border-t border-slate-200">
                                        <span>Tổng thời gian:</span>
                                        <span>{nights} đêm lưu trú</span>
                                    </div>
                                </div>

                                {/* BẢNG KÊ CHI TIẾT TỔNG TIỀN (ORDER SUMMARY) */}
                                <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs">
                                    {/* 1. Tiền phòng gốc */}
                                    <div className="flex justify-between text-slate-700">
                                        <span>
                                            Tiền phòng ({pricePerNight.toLocaleString('vi-VN')} ₫ × {nights} đêm)
                                        </span>
                                        <span className="font-bold text-slate-900">
                                            {subtotal.toLocaleString('vi-VN')} VND
                                        </span>
                                    </div>

                                    {/* 2. Dịch vụ tiện ích gợi ý đi kèm (Liệt kê chi tiết từng món x số lượng) */}
                                    {selectedServicesArray.length > 0 && (
                                        <div className="pt-2 pb-1 border-t border-dashed border-amber-200/80 space-y-1.5 bg-amber-50/50 p-2.5 rounded-xl border">
                                            <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                                                <span className="flex items-center gap-1">
                                                    <span></span> Dịch vụ đi kèm ({selectedServicesArray.length}):
                                                </span>
                                                <span className="text-orange-600 font-extrabold">
                                                    +{totalServicesAmount.toLocaleString('vi-VN')} VND
                                                </span>
                                            </div>

                                            <div className="space-y-1 pl-2 text-[11px] text-slate-600">
                                                {selectedServicesArray.map((item) => (
                                                    <div key={item.service_id} className="flex justify-between items-center">
                                                        <span className="truncate max-w-[170px]" title={item.name}>
                                                            • {item.name} <strong className="text-slate-800">×{item.quantity}</strong>
                                                        </span>
                                                        <span className="font-semibold text-slate-800 shrink-0">
                                                            {item.total_price.toLocaleString('vi-VN')} ₫
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 3. Chiết khấu hạng thành viên */}
                                    {tierDiscountAmount > 0 && (
                                        <div className="flex justify-between text-emerald-600 font-semibold">
                                            <span>Chiết khấu hạng {userTier?.name} ({tierDiscountPercent}%)</span>
                                            <span>-{tierDiscountAmount.toLocaleString('vi-VN')} VND</span>
                                        </div>
                                    )}

                                    {/* 4. Mã khuyến mãi (Promo Code) */}
                                    {discountAmount > 0 && (
                                        <div className="flex justify-between text-blue-600 font-semibold">
                                            <span>Mã khuyến mãi ({appliedPromo?.code})</span>
                                            <span>-{discountAmount.toLocaleString('vi-VN')} VND</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between text-slate-500">
                                        <span>Thuế VAT ({hotelSettings.vat_percent || 8}%) & Phí phục vụ ({hotelSettings.service_charge_percent || 5}%)</span>
                                        <span className="text-emerald-600 font-medium">Đã bao gồm</span>
                                    </div>

                                    <div className="flex justify-between text-amber-700 font-semibold pt-1 border-t border-slate-100">
                                        <span>⭐ Tích lũy điểm thưởng (+1 pt / 100.000đ)</span>
                                        <span>+{earnedPoints.toLocaleString('vi-VN')} điểm</span>
                                    </div>

                                    {/* Tổng cộng cần thanh toán */}
                                    <div className="flex justify-between items-baseline pt-3 border-t border-slate-200">
                                        <div>
                                            <span className="font-bold text-slate-900 text-sm block">
                                                Tổng cộng cần thanh toán
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                (Phòng + Dịch vụ đi kèm)
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-black text-2xl text-rose-600">
                                                {finalTotal.toLocaleString('vi-VN')}
                                            </span>
                                            <span className="text-[11px] font-bold text-slate-500 block">VND</span>
                                            {tierDiscountAmount > 0 && (
                                                <span className="text-[10px] font-semibold text-emerald-600 block mt-0.5">
                                                    (Đã tiết kiệm {tierDiscountAmount.toLocaleString('vi-VN')} VND)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Thông báo lỗi khi submit nếu có */}
                                {bookingError && (
                                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                                        ⚠️ {bookingError}
                                    </div>
                                )}

                                {/* Cảnh báo hết phòng ở cột tóm tắt */}
                                {availability?.is_sold_out && (
                                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                                        <span>🚫</span>
                                        <span>Hạng phòng đã hết chỗ cho ngày bạn chọn.</span>
                                    </div>
                                )}

                                {/* NÚT BẤM XÁC NHẬN ĐẶT PHÒNG */}
                                <button
                                    type="submit"
                                    disabled={isSubmitting || availability?.is_sold_out}
                                    className={`w-full py-4 text-white font-bold text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 transition ${availability?.is_sold_out
                                            ? 'bg-slate-400 cursor-not-allowed shadow-none'
                                            : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                                        }`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Đang xử lý đơn đặt phòng...</span>
                                        </>
                                    ) : availability?.is_sold_out ? (
                                        <span>Hạng Phòng Đã Hết (Vui Lòng Chọn Ngày Khác)</span>
                                    ) : (
                                        <>
                                            <span></span>
                                            <span>Xác Nhận Đặt Phòng Ngay</span>
                                        </>
                                    )}
                                </button>

                                {/* Cam kết tin cậy */}
                                <div className="space-y-1.5 pt-2 text-[11px] text-slate-500">
                                    <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                                        <span>🛡️</span>
                                        <span>Chính sách hủy: {room?.cancellation_policy ? 'Áp dụng theo quy định riêng của hạng phòng' : 'Miễn phí hủy trước 24 giờ'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        ✓ Nhận phòng nhanh chóng tại quầy Lễ tân
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        📞 Hotline hỗ trợ 24/7: <strong className="text-slate-700">{hotelSettings.hotline || '1900 8899'}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                )}
            </main>

            {/* ========================================================================= */}
            {/* MODAL / MÀN HÌNH CHÚC MỪNG ĐẶT PHÒNG THÀNH CÔNG */}
            {/* ========================================================================= */}
            {/* Modal sau khi tạo đơn thành công */}
            {createdBooking && (
                createdBooking.payment_method === 'vietqr' ? (
                    <PaymentModal
                        isOpen={true}
                        booking={createdBooking}
                        amount={createdBooking.total_amount}
                        bookingCode={createdBooking.booking_code}
                        customerName={createdBooking.guest_name}
                        onClose={(meta) => {
                            const code = meta?.bookingCode || createdBooking.booking_code;
                            setCreatedBooking(null);
                            if (meta?.cancelled) {
                                navigate('/booking-history', {
                                    state: {
                                        toast: {
                                            type: 'info',
                                            text: `Đã hủy đơn đặt phòng ${code} thành công.`
                                        }
                                    }
                                });
                            } else {
                                navigate('/booking-history', {
                                    state: {
                                        toast: {
                                            type: 'info',
                                            text: `Đơn đặt phòng ${code} đã được lưu tạm. Quý khách có thể thanh toán sau.`
                                        }
                                    }
                                });
                            }
                        }}
                        onCancelBooking={(cancelCode) => {
                            const code = cancelCode || createdBooking.booking_code;
                            setCreatedBooking(null);
                            navigate('/booking-history', {
                                state: {
                                    toast: {
                                        type: 'info',
                                        text: `Đã hủy đơn đặt phòng ${code} thành công.`
                                    }
                                }
                            });
                        }}
                        onSuccess={() => {
                            try {
                                localStorage.setItem('pms_last_booking_event', Date.now().toString());
                                window.dispatchEvent(new Event('pms_booking_created'));
                            } catch { }
                            setCreatedBooking((prev) => ({
                                ...prev,
                                payment_method: 'vietqr_success',
                                is_paid: true
                            }));
                        }}
                        onConfirm={() => {
                            try {
                                localStorage.setItem('pms_last_booking_event', Date.now().toString());
                                window.dispatchEvent(new Event('pms_booking_created'));
                            } catch { }
                            setCreatedBooking((prev) => ({
                                ...prev,
                                payment_method: 'vietqr_success',
                                is_paid: true
                            }));
                        }}
                    />
                ) : (
                    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-8 sm:p-10 text-center shadow-2xl animate-in fade-in zoom-in duration-300">
                        {/* Icon thành công */}
                        <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-4xl mb-6 shadow-inner">
                            🎉
                        </div>

                        <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                            {createdBooking.is_paid || createdBooking.payment_method === 'vietqr_success'
                                ? 'Thanh toán & Đặt phòng thành công!'
                                : 'Đặt phòng thành công!'}
                        </span>

                        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-3 mb-2">
                            Cảm ơn quý khách {createdBooking.guest_name}!
                        </h2>

                        <p className="text-xs sm:text-sm text-slate-500 mb-6">
                            Đơn đặt phòng của quý khách tại <strong>Khách Sạn TA Đà Nẵng</strong> đã được tiếp nhận và xử lý thành công.
                        </p>

                        {/* Mã đặt phòng & Hộp sao chép */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Mã đơn đặt phòng (Booking Code)
                            </span>
                            <div className="flex items-center justify-center gap-2">
                                <span className="font-mono text-xl sm:text-2xl font-black text-blue-600 tracking-wider">
                                    {createdBooking.booking_code}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (navigator.clipboard) {
                                            navigator.clipboard.writeText(createdBooking.booking_code);
                                            setCopiedCode(true);
                                            setTimeout(() => setCopiedCode(false), 2500);
                                        }
                                    }}
                                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 hover:text-blue-600 transition cursor-pointer"
                                    title="Sao chép mã"
                                >
                                    {copiedCode ? '✓ Đã sao chép' : '📋 Chép'}
                                </button>
                            </div>
                        </div>

                        {/* Tóm tắt thông tin */}
                        <div className="bg-slate-50 rounded-2xl p-4 text-xs text-slate-600 space-y-2 text-left mb-6">
                            <div className="flex justify-between">
                                <span>Hạng phòng:</span>
                                <strong className="text-slate-900">{createdBooking.room_name}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span>Thời gian:</span>
                                <strong className="text-slate-900">
                                    {formatDateDisplay(createdBooking.check_in_date)} → {formatDateDisplay(createdBooking.check_out_date)} ({createdBooking.nights} đêm)
                                </strong>
                            </div>
                            {createdBooking.selected_services?.length > 0 && (
                                <div className="flex justify-between items-start pt-1 border-t border-slate-200">
                                    <span className="text-amber-800 font-semibold">✨ Dịch vụ đặt kèm ({createdBooking.selected_services.length}):</span>
                                    <div className="text-right space-y-0.5">
                                        {createdBooking.selected_services.map((s, idx) => (
                                            <div key={idx} className="font-semibold text-slate-900 text-[11px]">
                                                {s.service_name || s.name} <strong className="text-orange-600">×{s.quantity}</strong>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span>Tổng tiền thanh toán:</span>
                                <strong className="text-rose-600 font-bold">
                                    {Number(createdBooking.total_amount).toLocaleString('vi-VN')} VND
                                </strong>
                            </div>
                            <div className="flex justify-between">
                                <span>Phương thức:</span>
                                <strong className={createdBooking.is_paid || createdBooking.payment_method === 'vietqr_success' ? "text-emerald-700 font-bold" : "text-slate-800"}>
                                    {createdBooking.is_paid || createdBooking.payment_method === 'vietqr_success'
                                        ? '✓ Đã thanh toán VietQR'
                                        : 'Thanh toán khi nhận phòng (Reception)'}
                                </strong>
                            </div>
                            <div className="flex justify-between">
                                <span>Số CCCD / Hộ chiếu:</span>
                                <strong className="text-slate-900 font-mono">{createdBooking.identity_card}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span>Email xác nhận:</span>
                                <span className="text-slate-800">{createdBooking.guest_email}</span>
                            </div>
                        </div>

                        {/* Nút hành động */}
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            <Link
                                to="/booking-history"
                                className="w-full sm:w-1/2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition transform active:scale-95 text-center"
                            >
                                Xem lịch sử đặt phòng
                            </Link>
                            <Link
                                to="/"
                                className="w-full sm:w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition text-center"
                            >
                                Về Trang chủ
                            </Link>
                        </div>
                    </div>
                </div>
            ))}

            <Footer />
        </div>
    );
}
